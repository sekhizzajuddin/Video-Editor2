import { ExportWorkerConfig } from './export.worker';
import { ExportPhase } from '../types';
import { AudioMixer } from './AudioMixer';
import { normalizeVideoForExport } from './VideoNormalizer';

export interface ExporterCallbacks {
  onProgress: (progress: number, currentFrame: number, eta: number) => void;
  onPhaseChange: (phase: ExportPhase) => void;
  onComplete: (fileSize: number) => void;
  onError: (error: Error) => void;
  /** Non-fatal problems (e.g. a clip that could not be decoded). */
  onWarning?: (message: string) => void;
}

export interface ExporterOptions {
  timeline: any;
  config: ExportWorkerConfig;
  fileHandle?: FileSystemFileHandle | null;
  callbacks: ExporterCallbacks;
}

export class ExportWorkerManager {
  private worker: Worker;
  private options: ExporterOptions;
  private startTime: number = 0;

  constructor(options: ExporterOptions) {
    this.options = options;
    // Create worker using vite's ?worker import or standard URL
    this.worker = new Worker(new URL('./export.worker.ts', import.meta.url), {
      type: 'module',
    });
    
    this.setupWorkerListeners();
  }

  private setupWorkerListeners() {
    this.worker.onmessage = (event) => {
      const { type, payload } = event.data;
      
      switch (type) {
        case 'PROGRESS':
          const elapsed = (Date.now() - this.startTime) / 1000;
          const progress = payload.progress;
          const rate = progress / (elapsed || 0.001); // percent per second
          const remaining = rate > 0 ? (100 - progress) / rate : 0;
          
          this.options.callbacks.onProgress(
            progress,
            payload.currentFrame,
            remaining
          );
          break;
          
        case 'PHASE_CHANGE':
          this.options.callbacks.onPhaseChange(payload.phase as ExportPhase);
          break;
          
        case 'COMPLETE':
          this.options.callbacks.onComplete(payload.fileSize);
          break;
          
        case 'ERROR':
          this.options.callbacks.onError(new Error(payload.message));
          break;

        case 'WARNING':
          this.options.callbacks.onWarning?.(payload.message);
          break;
      }
    };
  }

  async export(signal: AbortSignal): Promise<{filename: string, savedViaRuntime: boolean}> {
    this.startTime = Date.now();
    
    const serializedTimeline = this.serializeTimeline(this.options.timeline);

    // Mix audio on main thread where OfflineAudioContext is fully supported
    this.options.callbacks.onPhaseChange('preparing');

    // Make every video media exportable BEFORE handing off to the worker.
    // The worker demuxes with MP4Box (ISO-BMFF only); WebM/MKV screen
    // recordings and similar files must be transcoded to MP4 here on the main
    // thread (HTMLVideoElement decode isn't available in workers), otherwise
    // the export renders black frames with working audio.
    await this.normalizeTimelineMedia(serializedTimeline);
    let audioPayload: any = null;
    const transferables: Transferable[] = [];

    try {
      const audioMixer = new AudioMixer();
      const audioBuffer = await audioMixer.mix(serializedTimeline, serializedTimeline.duration);
      if (audioBuffer && audioBuffer.length > 0) {
        const ch0 = audioBuffer.getChannelData(0);
        const ch1 = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : ch0;
        
        const ch0Copy = new Float32Array(ch0);
        const ch1Copy = new Float32Array(ch1);

        audioPayload = {
          sampleRate: audioBuffer.sampleRate,
          numberOfChannels: 2,
          length: audioBuffer.length,
          channels: [ch0Copy, ch1Copy]
        };

        transferables.push(ch0Copy.buffer, ch1Copy.buffer);
      }
    } catch (err) {
      console.warn('Audio pre-mix failed on main thread:', err);
    }

    // Collect all pre-fetched ArrayBuffers from media items and transfer them
    // to the worker to avoid cross-thread blob URL access failures.
    const mediaBuffers: Record<string, ArrayBuffer> = {};
    for (const m of (serializedTimeline.media || [])) {
      if (m._arrayBuffer) {
        mediaBuffers[m.id] = m._arrayBuffer;
        transferables.push(m._arrayBuffer);
        delete m._arrayBuffer; // Don't try to JSON-clone the ArrayBuffer
      }
    }

    // Transfer timeline data, audio PCM, and optional fileHandle to worker
    this.worker.postMessage({
      type: 'START_EXPORT',
      payload: {
        timeline: serializedTimeline,
        config: this.options.config,
        audioData: audioPayload,
        fileHandle: this.options.fileHandle || null,
        mediaBuffers,
      }
    }, transferables);

    // Handle cancellation
    signal.addEventListener('abort', () => {
      this.worker.postMessage({ type: 'CANCEL' });
    });

    // We rely on the callbacks passed via options, but we can also return a promise
    return new Promise<{filename: string, savedViaRuntime: boolean}>((resolve, reject) => {
      const cleanup = () => {
        signal.removeEventListener('abort', abortHandler);
        this.worker.onmessage = originalOnMessage;
      };
      
      const abortHandler = () => {
        reject(new Error('AbortError'));
        cleanup();
      };
      
      signal.addEventListener('abort', abortHandler);
      
      // Hook into the worker onmessage to resolve/reject this promise
      const originalOnMessage = this.worker.onmessage;
      this.worker.onmessage = (event) => {
        if (originalOnMessage) originalOnMessage.call(this.worker, event);
        
        const { type, payload } = event.data;
        if (type === 'COMPLETE') {
          resolve({ 
            filename: payload.filename, 
            savedViaRuntime: !!payload.savedViaRuntime || !!payload.savedDirectly 
          });
          cleanup();
        } else if (type === 'ERROR') {
          reject(new Error(payload.message));
          cleanup();
        }
      };
    });
  }

  async download(filename: string): Promise<void> {
    const root = await navigator.storage.getDirectory();
    try {
      const fileHandle = await root.getFileHandle(filename);
      const file = await fileHandle.getFile();
      const url = URL.createObjectURL(file);
      
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 200);
    } catch (err) {
      console.error('Failed to download from OPFS:', err);
    }
  }

  dispose(): void {
    this.worker.terminate();
  }

  /**
   * Replace non-MP4 video URLs in the serialized timeline with transcoded MP4
   * object URLs so the worker's MP4Box demuxer can read every clip. Mutates
   * only the serialized copy — never the store.
   */
  private async normalizeTimelineMedia(serializedTimeline: any): Promise<void> {
    const media: any[] = serializedTimeline.media || [];
    const videoItems = media.filter((m) => {
      if (!m?.url) return false;
      if (m.type === 'video') return true;
      // Some imports lack a type; sniff by extension, defaulting to video-ish names.
      const name = String(m.name || '');
      return /\.(mp4|mov|m4v|webm|mkv|ogv|ogg|avi)$/i.test(name);
    });

    await Promise.all(videoItems.map(async (m) => {
      try {
        // Step 1: Normalize (transcode WebM/MKV to MP4 if needed).
        const result = await normalizeVideoForExport(m.url, m.name);
        if (result.warning) {
          this.options.callbacks.onWarning?.(result.warning);
          return;
        }
        if (result.transcoded) {
          m.url = result.url;
        }

        // Step 2: CRITICAL FIX — Blob URLs (blob:http://...) live in the main
        // thread's memory and CANNOT be fetched from inside a Web Worker.
        // The AssetDecoder in the worker calls fetch(url) which silently returns
        // an error → no frames decoded → black video.
        //
        // Solution: fetch the bytes here on the main thread (where blob URLs are
        // accessible) and replace the url with a data-URI string, OR attach the
        // ArrayBuffer directly on the media item so the worker can use it.
        if (m.url && (m.url.startsWith('blob:') || m.url.startsWith('http://localhost'))) {
          try {
            const response = await fetch(m.url);
            if (!response.ok) throw new Error(`fetch ${response.status}`);
            const arrayBuffer = await response.arrayBuffer();
            // Attach the raw bytes. We'll transfer this buffer to the worker later.
            m._arrayBuffer = arrayBuffer;
            // Keep url as a signal for AssetDecoder; it will prefer _arrayBuffer.
          } catch (fetchErr: any) {
            this.options.callbacks.onWarning?.(
              `"${m.name || m.id}" media could not be read: ${fetchErr?.message || fetchErr}. It may appear black in the output.`
            );
          }
        }
      } catch (e: any) {
        this.options.callbacks.onWarning?.(
          `"${m.name || m.id}" could not be prepared for export: ${e?.message || e}`
        );
      }
    }));
  }

  private serializeTimeline(timeline: any): any {
    // Strip functions and DOM references (like VideoElement/Canvas cache)
    // We only extract exactly what we need to avoid JSON stringify circular errors
    // caused by React Fiber nodes attached to DOM elements in the store.
    let duration = timeline.totalDuration || timeline.duration || 0;
    if (!duration && timeline.tracks) {
      for (const track of timeline.tracks) {
        for (const clip of track.clips || []) {
          const end = (clip.startTime || 0) + (clip.duration || 0);
          if (end > duration) duration = end;
        }
      }
    }
    duration = Math.max(0.1, duration);

    const safeTimeline = {
      tracks: timeline.tracks || [],
      media: timeline.mediaLibrary || timeline.media || [], // Worker expects 'media'
      duration,
      totalDuration: duration,
      aspectRatio: timeline.aspectRatio || 16/9,
    };
    
    // Deep clone just in case there are nested non-serializable proxies
    return JSON.parse(JSON.stringify(safeTimeline));
  }
}
