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

export class GeminiLiveClient {
  private ws: WebSocket | null = null;
  private isConnected = false;
  private resolveConnect: ((value: boolean) => void) | null = null;
  private rejectConnect: ((reason?: any) => void) | null = null;

  public onAudioData: ((pcmData: Int16Array) => void) | null = null;
  public onTextResponse: ((text: string) => void) | null = null;
  public onClose: (() => void) | null = null;
  public onError: ((error: any) => void) | null = null;
  public onTurnComplete: (() => void) | null = null;

  constructor() {}

  public async connect(config: GeminiLiveConfig = {}): Promise<boolean> {
    const apiKey = getGeminiKey();
    if (!apiKey) {
      throw new Error('Gemini API Key is not set.');
    }

    const modelName = config.model || 'models/gemini-2.0-flash-live-001';
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

        this.ws.onclose = (ev) => {
          this.isConnected = false;
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

    if (config.tools) {
      setupMsg.setup.tools = config.tools;
    }

    this.ws.send(JSON.stringify(setupMsg));
  }

  private async handleMessage(data: any) {
    if (data instanceof Blob) {
      const text = await data.text();
      this.processJsonResponse(text);
    } else if (typeof data === 'string') {
      this.processJsonResponse(data);
    }
  }

  private processJsonResponse(jsonStr: string) {
    try {
      const msg = JSON.parse(jsonStr);
      
      if (msg.setupComplete) {
        if (this.resolveConnect) {
          this.resolveConnect(true);
          this.resolveConnect = null;
          this.rejectConnect = null;
        }
      } else if (msg.serverContent) {
        if (msg.serverContent.turnComplete && this.onTurnComplete) {
          this.onTurnComplete();
        }
        
        const parts = msg.serverContent?.modelTurn?.parts || [];
        for (const part of parts) {
          if (part.text && this.onTextResponse) {
            this.onTextResponse(part.text);
          }
          if (part.inlineData && part.inlineData.mimeType.startsWith('audio/pcm') && this.onAudioData) {
            // Decode base64 PCM data (24kHz, 16-bit, mono)
            const binaryStr = window.atob(part.inlineData.data);
            const bytes = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) {
              bytes[i] = binaryStr.charCodeAt(i);
            }
            const pcmData = new Int16Array(bytes.buffer);
            this.onAudioData(pcmData);
          }
        }
      }
    } catch (e) {
      console.error('Failed to parse Gemini Live message:', e);
    }
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

  public disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }
}
