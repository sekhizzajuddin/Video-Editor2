import { ExportWorkerConfig } from './export.worker';
import { ExportPhase } from '../types';
import { AudioMixer } from './AudioMixer';
import { normalizeVideoForExport } from './VideoNormalizer';
import { getFileFromDB } from '@/utils/projectPersistence';

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
    const mediaBuffers: Record<string, any> = {};
    for (const m of (serializedTimeline.media || [])) {
      if (m._fileBlob) {
        mediaBuffers[m.id] = m._fileBlob;
        delete m._fileBlob;
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
    const mediaMap = new Map<string, any>();
    for (const m of (serializedTimeline.media || [])) {
      if (m?.id) mediaMap.set(m.id, m);
    }
    for (const track of (serializedTimeline.tracks || [])) {
      for (const clip of (track.clips || [])) {
        if (clip.mediaId && !mediaMap.has(clip.mediaId)) {
          mediaMap.set(clip.mediaId, { id: clip.mediaId, url: clip.url, name: clip.name, type: clip.type || 'video' });
        }
      }
    }

    serializedTimeline.media = Array.from(mediaMap.values());

    await Promise.all(serializedTimeline.media.map(async (m: any) => {
      try {
        let fileBlob: Blob | File | null = null;

        // 1. Try IDB (primary store)
        try {
          fileBlob = await getFileFromDB(m.id);
        } catch (idbErr) {
          console.warn('[Export] IDB lookup failed for', m.id, idbErr);
        }

        // 2. Try handle store (FileSystemFileHandle backed)
        if (!fileBlob) {
          try {
            const { resolveMediaFile } = await import('@/utils/mediaFileHandle');
            fileBlob = await resolveMediaFile(m.id);
            if (fileBlob) console.log('[Export] Resolved', m.id, 'via handle store');
          } catch {}
        }

        // 3. Try current blob URL (live object URL from preview)
        if (!fileBlob && m.url && m.url !== 'PENDING_RESTORE' && m.url.startsWith('blob:')) {
          try {
            const response = await fetch(m.url);
            if (response.ok) fileBlob = await response.blob();
          } catch {}
        }

        // 4. Try data URL or http URL
        if (!fileBlob && m.url && m.url !== 'PENDING_RESTORE') {
          try {
            // For data: URLs or regular http(s) that may still be reachable
            if (m.url.startsWith('data:') || m.url.startsWith('http')) {
              const response = await fetch(m.url);
              if (response.ok) fileBlob = await response.blob();
            }
          } catch {}
        }

        // 5. Last resort: try to clone from video element if it exists in DOM (preview)
        // This covers cases where IDB was cleared but preview still holds decoded data
        if (!fileBlob && m.url && m.url.startsWith('blob:')) {
          try {
            // Find a video element that might still hold this blob
            const videos = document.querySelectorAll('video');
            for (const v of Array.from(videos as any)) {
              if ((v as HTMLVideoElement).src === m.url) {
                // We can't get File from video element directly, but we already tried fetch
                break;
              }
            }
          } catch {}
        }

        if (fileBlob) {
          // If it's a File, convert to Blob for transfer, but keep type
          const blob = fileBlob instanceof Blob ? fileBlob : new Blob([fileBlob as any]);
          // Ensure we transfer as ArrayBuffer for worker (convert Blob to ArrayBuffer later via postMessage transferables? We keep Blob here and let worker create BlobSource)
          // For efficiency, if it's large, keep as Blob and let worker's BlobSource handle it
          m._fileBlob = blob;
          // Also store size for debugging
          (m as any)._fileSize = blob.size;
        } else {
          console.warn('[Export] Media could not be loaded (will be black):', m.id, m.name || '', 'url:', m.url?.slice(0, 50));
          // Push warning to UI via callback if available
          this.options.callbacks.onWarning?.(
            `"${m.name || m.id}" could not be loaded for export — its segment may be black. Try re-importing the file.`
          );
        }
      } catch (e: any) {
        console.warn('[Export] Media prep failed for:', m.id, e);
      }
    }));

    // Debug: log how many media were resolved
    const resolved = (serializedTimeline.media as any[]).filter((m: any) => !!m._fileBlob).length;
    const total = (serializedTimeline.media as any[]).length;
    console.log(`[Export] Media resolved: ${resolved}/${total}`);
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
