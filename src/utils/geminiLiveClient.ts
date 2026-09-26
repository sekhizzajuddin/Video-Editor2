import { getGeminiKey } from './aiClient';

// Configuration for the Gemini Multimodal Live API
const HOST = 'generativelanguage.googleapis.com';
const WS_URL = `wss://${HOST}/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent`;

export interface GeminiLiveConfig {
  model?: string;
  systemInstruction?: string;
  voiceName?: string; // Aoede, Charon, Fenrir, Kore, Puck
  tools?: any[];
}

export interface LiveFunctionCall {
  id: string;
  name: string;
  args: any;
}

export interface LiveFunctionResponse {
  id: string;
  response: any;
}

export class GeminiLiveClient {
  private ws: WebSocket | null = null;
  private isConnected = false;
  private resolveConnect: ((value: boolean) => void) | null = null;
  private rejectConnect: ((reason?: any) => void) | null = null;

  // Audio Playback context for 24kHz output
  private audioCtx: AudioContext | null = null;
  private nextPlayTime: number = 0;
  private activeAudioSources: AudioBufferSourceNode[] = [];

  // Mic capture context for 16kHz input
  private micStream: MediaStream | null = null;
  private micAudioCtx: AudioContext | null = null;
  private micProcessor: ScriptProcessorNode | null = null;

  // Callbacks
  public onAudioData: ((pcmData: Int16Array) => void) | null = null;
  public onTextResponse: ((text: string) => void) | null = null;
  public onClose: (() => void) | null = null;
  public onError: ((error: any) => void) | null = null;
  public onTurnComplete: (() => void) | null = null;
  public onInterrupted: (() => void) | null = null;
  public onToolCall: ((calls: LiveFunctionCall[]) => Promise<LiveFunctionResponse[]> | void) | null = null;

  constructor() {}

  public get connected(): boolean {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
  }

  public async connect(config: GeminiLiveConfig = {}): Promise<boolean> {
    const apiKey = getGeminiKey();
    if (!apiKey) {
      throw new Error('Gemini API Key is not set. Please set it in Settings or your environment.');
    }

    const modelName = config.model || 'models/gemini-2.0-flash-exp';
    const url = `${WS_URL}?key=${apiKey}`;

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(url);
        this.resolveConnect = resolve;
        this.rejectConnect = reject;

        this.ws.onopen = () => {
          this.isConnected = true;
          this.sendSetupMessage(config, modelName);
        };

        this.ws.onmessage = async (event) => {
          await this.handleMessage(event.data);
        };

        this.ws.onclose = () => {
          this.isConnected = false;
          this.stopAudioPlayback();
          if (this.onClose) this.onClose();
        };

        this.ws.onerror = (err) => {
          console.error('Gemini Live WS Error:', err);
          if (this.onError) this.onError(err);
          if (this.rejectConnect) {
            this.rejectConnect(err);
            this.rejectConnect = null;
            this.resolveConnect = null;
          }
          if (this.ws) {
            this.ws.close();
            this.ws = null;
          }
          this.isConnected = false;
          this.stopAudioPlayback();
        };
      } catch (err) {
        if (this.rejectConnect) {
          this.rejectConnect(err);
        } else {
          reject(err);
        }
      }
    });
  }

  private sendSetupMessage(config: GeminiLiveConfig, modelName: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const setupMsg: any = {
      setup: {
        model: modelName,
        generationConfig: {
          responseModalities: ["AUDIO", "TEXT"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: config.voiceName || 'Aoede'
              }
            }
          }
        }
      }
    };

    if (config.systemInstruction) {
      setupMsg.setup.systemInstruction = {
        parts: [{ text: config.systemInstruction }]
      };
    }

    if (config.tools && config.tools.length > 0) {
      setupMsg.setup.tools = config.tools;
    }

    this.ws.send(JSON.stringify(setupMsg));
  }

  private async handleMessage(data: any) {
    if (data instanceof Blob) {
      const text = await data.text();
      await this.processJsonResponse(text);
    } else if (typeof data === 'string') {
      await this.processJsonResponse(data);
    }
  }

  private async processJsonResponse(jsonStr: string) {
    try {
      const msg = JSON.parse(jsonStr);

      if (msg.setupComplete) {
        if (this.resolveConnect) {
          this.resolveConnect(true);
          this.resolveConnect = null;
          this.rejectConnect = null;
        }
        return;
      }

      // Handle function / tool calling
      if (msg.toolCall?.functionCalls) {
        const functionCalls: LiveFunctionCall[] = msg.toolCall.functionCalls.map((fc: any) => ({
          id: fc.id,
          name: fc.name,
          args: fc.args || {},
        }));

        if (this.onToolCall) {
          const responses = await this.onToolCall(functionCalls);
          if (responses && responses.length > 0) {
            this.sendToolResponse(responses);
          }
        }
        return;
      }

      if (msg.serverContent) {
        if (msg.serverContent.interrupted) {
          this.stopAudioPlayback();
          if (this.onInterrupted) this.onInterrupted();
        }

        if (msg.serverContent.turnComplete && this.onTurnComplete) {
          this.onTurnComplete();
        }

        const parts = msg.serverContent?.modelTurn?.parts || [];
        for (const part of parts) {
          if (part.text && this.onTextResponse) {
            this.onTextResponse(part.text);
          }

          if (part.inlineData && part.inlineData.mimeType.startsWith('audio/pcm')) {
            // Decode base64 PCM data (24kHz, 16-bit, mono)
            const binaryStr = window.atob(part.inlineData.data);
            const bytes = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) {
              bytes[i] = binaryStr.charCodeAt(i);
            }
            const pcmData = new Int16Array(bytes.buffer);
            
            // Invoke callback if registered
            if (this.onAudioData) {
              this.onAudioData(pcmData);
            }

            // Play incoming audio through speaker
            this.queueAudioPlayback(pcmData, 24000);
          }
        }
      }
    } catch (e) {
      console.error('Failed to parse Gemini Live message:', e);
    }
  }

  /**
   * Responds to Gemini's toolCall with the tool execution results.
   */
  public sendToolResponse(functionResponses: LiveFunctionResponse[]) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const payload = {
      toolResponse: {
        functionResponses: functionResponses.map((fr) => ({
          id: fr.id,
          response: {
            output: fr.response ?? { success: true },
          },
        })),
      },
    };

    this.ws.send(JSON.stringify(payload));
  }

  public sendText(text: string, endTurn: boolean = true) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const msg = {
      clientContent: {
        turns: [
          {
            role: 'user',
            parts: [{ text }]
          }
        ],
        turnComplete: endTurn
      }
    };
    this.ws.send(JSON.stringify(msg));
  }

  public sendFrame(base64Jpeg: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    
    // Strip data URL prefix if present
    const b64Data = base64Jpeg.includes(',') ? base64Jpeg.split(',')[1] : base64Jpeg;

    const msg = {
      realtimeInput: {
        mediaChunks: [
          {
            mimeType: 'image/jpeg',
            data: b64Data
          }
        ]
      }
    };
    this.ws.send(JSON.stringify(msg));
  }
  
  public sendAudioChunk(base64Pcm: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    
    const msg = {
      realtimeInput: {
        mediaChunks: [
          {
            mimeType: 'audio/pcm;rate=16000',
            data: base64Pcm
          }
        ]
      }
    };
    this.ws.send(JSON.stringify(msg));
  }

  // ── Audio Playback Management (24kHz PCM from Gemini) ─────────────────────

  private initAudioPlaybackContext() {
    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioContextClass({ sampleRate: 24000 });
      this.nextPlayTime = this.audioCtx.currentTime;
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  private queueAudioPlayback(pcmData: Int16Array, sampleRate = 24000) {
    try {
      this.initAudioPlaybackContext();
      if (!this.audioCtx) return;

      const float32 = new Float32Array(pcmData.length);
      for (let i = 0; i < pcmData.length; i++) {
        float32[i] = pcmData[i] / 32768.0;
      }

      const buffer = this.audioCtx.createBuffer(1, float32.length, sampleRate);
      buffer.copyToChannel(float32, 0);

      const source = this.audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(this.audioCtx.destination);

      const currentTime = this.audioCtx.currentTime;
      const startTime = Math.max(currentTime, this.nextPlayTime);
      source.start(startTime);
      this.nextPlayTime = startTime + buffer.duration;

      this.activeAudioSources.push(source);
      source.onended = () => {
        this.activeAudioSources = this.activeAudioSources.filter(s => s !== source);
      };
    } catch (err) {
      console.warn('Failed to queue Gemini audio playback:', err);
    }
  }

  public stopAudioPlayback() {
    for (const src of this.activeAudioSources) {
      try { src.stop(); } catch { /* ignore */ }
    }
    this.activeAudioSources = [];
    if (this.audioCtx) {
      this.nextPlayTime = this.audioCtx.currentTime;
    }
  }

  // ── Microphone Stream Capture (16kHz PCM to Gemini) ────────────────────────

  public async startMicStream(): Promise<void> {
    if (this.micStream) return;

    this.micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: 16000,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      }
    });

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.micAudioCtx = new AudioContextClass({ sampleRate: 16000 });
    const source = this.micAudioCtx.createMediaStreamSource(this.micStream);

    // Buffer 2048 samples at 16kHz ≈ 128ms per chunk
    this.micProcessor = this.micAudioCtx.createScriptProcessor(2048, 1, 1);

    this.micProcessor.onaudioprocess = (e) => {
      if (!this.connected) return;

      const inputData = e.inputBuffer.getChannelData(0);
      const pcm16 = new Int16Array(inputData.length);
      for (let i = 0; i < inputData.length; i++) {
        const s = Math.max(-1, Math.min(1, inputData[i]));
        pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }

      // Convert to base64
      let binary = '';
      const bytes = new Uint8Array(pcm16.buffer);
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const b64 = window.btoa(binary);
      this.sendAudioChunk(b64);
    };

    source.connect(this.micProcessor);
    this.micProcessor.connect(this.micAudioCtx.destination);
  }

  public stopMicStream() {
    if (this.micProcessor) {
      try { this.micProcessor.disconnect(); } catch { /* ignore */ }
      this.micProcessor = null;
    }
    if (this.micAudioCtx) {
      try { this.micAudioCtx.close(); } catch { /* ignore */ }
      this.micAudioCtx = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach(t => t.stop());
      this.micStream = null;
    }
  }

  public disconnect() {
    this.stopMicStream();
    this.stopAudioPlayback();
    if (this.audioCtx) {
      try { this.audioCtx.close(); } catch { /* ignore */ }
      this.audioCtx = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }
}

