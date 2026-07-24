import * as ort from 'onnxruntime-web';
// @ts-ignore
import { DemucsProcessor } from 'demucs-web';

// Ensure WebAssembly backend uses the correct paths from a CDN to avoid Vite bundling issues
ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/';
ort.env.wasm.numThreads = navigator.hardwareConcurrency || 4;

// Default model URL (htdemucs embedded model)
const MODEL_URL = 'https://huggingface.co/timcsy/demucs-onnx/resolve/main/htdemucs_embedded.onnx';

class AIVocalSeparator {
  private processor: DemucsProcessor | null = null;
  private isModelLoaded = false;
  private currentProgress = 0;

  constructor() {
    this.processor = new DemucsProcessor({
      ort,
      onProgress: (progress: number) => {
        this.currentProgress = progress;
        if (import.meta.env.DEV) console.log(`[Demucs AI] Processing progress: ${(progress * 100).toFixed(1)}%`);
      },
    });
  }

  /**
   * Initializes the AI Model. This will download the model (approx 150MB) and cache it in the browser.
   */
  async loadModel(onProgress?: (progress: number) => void) {
    if (this.isModelLoaded && this.processor) return;

    if (import.meta.env.DEV) console.log('[Demucs AI] Loading AI Model...');
    if (onProgress) onProgress(0.1); // Simulate start of download
    
    try {
      await this.processor!.loadModel(MODEL_URL);
      this.isModelLoaded = true;
      if (onProgress) onProgress(1.0);
      if (import.meta.env.DEV) console.log('[Demucs AI] AI Model loaded successfully.');
    } catch (error) {
      console.error('[Demucs AI] Failed to load model:', error);
      throw new Error('Failed to load AI Vocal Separation model.');
    }
  }

  /**
   * Process an AudioBuffer through the Demucs AI Model.
   * Note: This is an intensive offline process and takes time.
   */
  async separateAudioBuffer(audioBuffer: AudioBuffer, onProgress?: (p: number) => void): Promise<{ vocals: AudioBuffer, backgroundMusic: AudioBuffer }> {
    if (!this.isModelLoaded || !this.processor) {
      await this.loadModel(onProgress);
    }

    if (import.meta.env.DEV) console.log('[Demucs AI] Starting separation...');
    
    // Get raw audio data (Left and Right channels)
    let leftChannel: Float32Array;
    let rightChannel: Float32Array;

    if (audioBuffer.numberOfChannels === 2) {
      leftChannel = audioBuffer.getChannelData(0);
      rightChannel = audioBuffer.getChannelData(1);
    } else {
      // Mono to stereo fallback
      leftChannel = audioBuffer.getChannelData(0);
      rightChannel = new Float32Array(leftChannel);
    }

    // Capture progress updates
    const progressInterval = setInterval(() => {
      if (onProgress) onProgress(this.currentProgress);
    }, 500);

    try {
      // Run the heavy AI inference
      // result contains: { vocals: Float32Array[], drums: Float32Array[], bass: Float32Array[], other: Float32Array[] }
      const result = await this.processor!.separate(leftChannel, rightChannel);
      
      clearInterval(progressInterval);
      if (onProgress) onProgress(1.0);

      const ctx = new OfflineAudioContext(2, result.vocals[0].length, 44100);

      // Create Vocals Buffer
      const vocalsBuffer = ctx.createBuffer(2, result.vocals[0].length, 44100);
      vocalsBuffer.copyToChannel(result.vocals[0], 0);
      vocalsBuffer.copyToChannel(result.vocals[1], 1);

      // Mix drums, bass, and other to create Background Music
      const bgmBuffer = ctx.createBuffer(2, result.vocals[0].length, 44100);
      const bgmLeft = new Float32Array(result.vocals[0].length);
      const bgmRight = new Float32Array(result.vocals[0].length);

      for (let i = 0; i < bgmLeft.length; i++) {
        bgmLeft[i] = result.drums[0][i] + result.bass[0][i] + result.other[0][i];
        bgmRight[i] = result.drums[1][i] + result.bass[1][i] + result.other[1][i];
      }

      bgmBuffer.copyToChannel(bgmLeft, 0);
      bgmBuffer.copyToChannel(bgmRight, 1);

      if (import.meta.env.DEV) console.log('[Demucs AI] Separation complete!');

      return {
        vocals: vocalsBuffer,
        backgroundMusic: bgmBuffer
      };

    } catch (error) {
      clearInterval(progressInterval);
      console.error('[Demucs AI] Error during separation:', error);
      throw error;
    }
  }

  /**
   * Helper to convert an AudioBuffer to an Object URL (Blob) for playback
   */
  public async audioBufferToBlobUrl(buffer: AudioBuffer): Promise<string> {
    return new Promise((resolve) => {
      const numOfChan = buffer.numberOfChannels;
      const length = buffer.length * numOfChan * 2 + 44;
      const waveBuffer = new ArrayBuffer(length);
      const view = new DataView(waveBuffer);
      
      const channels = [];
      let sample = 0;
      let offset = 0;
      let pos = 0;

      // write WAVE header
      setUint32(0x46464952);                         // "RIFF"
      setUint32(length - 8);                         // file length - 8
      setUint32(0x45564157);                         // "WAVE"
      
      setUint32(0x20746d66);                         // "fmt " chunk
      setUint32(16);                                 // length = 16
      setUint16(1);                                  // PCM (uncompressed)
      setUint16(numOfChan);
      setUint32(buffer.sampleRate);
      setUint32(buffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
      setUint16(numOfChan * 2);                      // block-align
      setUint16(16);                                 // 16-bit
      
      setUint32(0x61746164);                         // "data" - chunk
      setUint32(length - pos - 4);                   // chunk length

      for (let i = 0; i < buffer.numberOfChannels; i++) {
        channels.push(buffer.getChannelData(i));
      }

      while (pos < length) {
        for (let i = 0; i < numOfChan; i++) {
          sample = Math.max(-1, Math.min(1, channels[i][offset])); // clamp
          sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0; // scale to 16-bit signed int
          view.setInt16(pos, sample, true);          // write 16-bit sample
          pos += 2;
        }
        offset++;
      }

      const blob = new Blob([waveBuffer], { type: "audio/wav" });
      const url = URL.createObjectURL(blob);
      resolve(url);

      function setUint16(data: number) {
        view.setUint16(pos, data, true);
        pos += 2;
      }

      function setUint32(data: number) {
        view.setUint32(pos, data, true);
        pos += 4;
      }
    });
  }
}

export const aiVocalSeparator = new AIVocalSeparator();
