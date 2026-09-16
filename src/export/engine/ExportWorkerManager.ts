import { ExportWorkerConfig } from './export.worker';
import { ExportPhase } from '../types';
import { AudioMixer } from './AudioMixer';
import { normalizeVideoBlobForExport } from './VideoNormalizer';
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
  private disposed = false;
  private workerError: Error | null = null;
  private rejectPendingExport: ((error: Error) => void) | null = null;

  constructor(options: ExporterOptions) {
    // Never retain the whole Zustand store (history, preview DOM, audio graph,
    // etc.) in exporterRef after a completed export. Capture only export data,
    // once, so subsequent edits cannot alter an in-flight render either.
    this.options = {
      ...options,
      config: { ...options.config },
      timeline: this.serializeTimeline(options.timeline),
    };
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

    const failWorker = (error: Error) => {
      this.workerError = error;
      this.options.callbacks.onError(error);
      // A native Worker error does NOT arrive as a {type: 'ERROR'} message.
      // Reject the wait as well, so export can clean up and restore preview.
      this.rejectPendingExport?.(error);
    };
    this.worker.onerror = (err: ErrorEvent) => {
      console.error('[ExportWorkerManager] Worker script error:', err);
      failWorker(new Error(err.message || 'Export worker error occurred'));
    };
    this.worker.onmessageerror = () => failWorker(new Error('Export worker response could not be read'));
  }

  private checkActive(signal: AbortSignal): void {
    if (signal.aborted || this.disposed) throw new Error('AbortError');
    if (this.workerError) throw this.workerError;
  }

  async export(signal: AbortSignal): Promise<{filename: string, savedViaRuntime: boolean}> {
    this.startTime = Date.now();
    
    this.checkActive(signal);
    const serializedTimeline = this.options.timeline;

    // Mix audio on main thread where OfflineAudioContext is fully supported
    this.options.callbacks.onPhaseChange('preparing');

    // Make every video media exportable BEFORE handing off to the worker.
    // The worker demuxes with MP4Box (ISO-BMFF only); WebM/MKV screen
    // recordings and similar files must be transcoded to MP4 here on the main
    // thread (HTMLVideoElement decode isn't available in workers), otherwise
    // the export renders black frames with working audio.
    await this.normalizeTimelineMedia(serializedTimeline, signal);
    this.checkActive(signal);
    let audioPayload: any = null;
    const transferables: Transferable[] = [];

    try {
      const startAt = typeof this.options.config.startAt === 'number' ? Math.max(0, this.options.config.startAt) : 0;
      const endAt = typeof this.options.config.endAt === 'number' && this.options.config.endAt > startAt
        ? this.options.config.endAt
        : (serializedTimeline.duration || 10);
      const rangeDuration = Math.max(0.1, endAt - startAt);

      const audioMixer = new AudioMixer();
      const audioBuffer = await audioMixer.mix(serializedTimeline, rangeDuration, startAt);
      this.checkActive(signal);
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
      this.checkActive(signal);
      console.warn('Audio pre-mix failed on main thread:', err);
    }

    this.checkActive(signal);

    // Collect all pre-fetched ArrayBuffers from media items and transfer them
    // to the worker to avoid cross-thread blob URL access failures.
    const mediaBuffers: Record<string, any> = {};
    for (const m of (serializedTimeline.media || [])) {
      if (m._fileBlob) {
        mediaBuffers[m.id] = m._fileBlob;
        delete m._fileBlob;
      }
      // The original HEVC blob was retained only for main-thread audio mixing;
      // do not clone it into the worker as a second large payload.
      delete m._audioBlob;
    }

    // Install completion/error/cancel handlers BEFORE posting START_EXPORT.
    // This also makes synchronous worker adapters and fast startup errors safe.
    return new Promise<{filename: string, savedViaRuntime: boolean}>((resolve, reject) => {
      const originalOnMessage = this.worker.onmessage;
      const cleanup = () => {
        signal.removeEventListener('abort', abortHandler);
        this.worker.onmessage = originalOnMessage;
        this.rejectPendingExport = null;
      };
      const fail = (error: Error) => {
        cleanup();
        reject(error);
      };
      const abortHandler = () => {
        try {
          if (!this.disposed) this.worker.postMessage({ type: 'CANCEL' });
        } catch {
          // A crashed/terminated worker may reject postMessage as well.
        } finally {
          fail(new Error('AbortError'));
        }
      };

      this.rejectPendingExport = fail;
      signal.addEventListener('abort', abortHandler);
      this.worker.onmessage = (event) => {
        if (originalOnMessage) originalOnMessage.call(this.worker, event);

        const { type, payload } = event.data;
        if (type === 'COMPLETE') {
          cleanup();
          resolve({
            filename: payload.filename,
            savedViaRuntime: !!payload.savedViaRuntime || !!payload.savedDirectly,
          });
        } else if (type === 'ERROR') {
          fail(new Error(payload.message));
        }
      };

      try {
        this.checkActive(signal);
        this.worker.postMessage({
          type: 'START_EXPORT',
          payload: {
            timeline: serializedTimeline,
            config: this.options.config,
            audioData: audioPayload,
            fileHandle: this.options.fileHandle || null,
            mediaBuffers,
          },
        }, transferables);
        // Blobs/data now belong to the worker. download() only needs the output
        // filename and OPFS, not the input project or its undo snapshots.
        this.options.timeline = null;
      } catch (error) {
        fail(error instanceof Error ? error : new Error(String(error)));
      }
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
    if (this.disposed) return;
    this.disposed = true;
    this.rejectPendingExport?.(new Error('AbortError'));
    this.worker.onmessage = null;
    this.worker.onerror = null;
    this.worker.onmessageerror = null;
    this.worker.terminate();
    this.options.timeline = null;
    this.options.fileHandle = null;
  }

  /**
   * Replace non-MP4 video URLs in the serialized timeline with transcoded MP4
   * object URLs so the worker's MP4Box demuxer can read every clip. Mutates
   * only the serialized copy — never the store.
   */
  private async normalizeTimelineMedia(serializedTimeline: any, signal: AbortSignal): Promise<void> {
    const libraryMap = new Map<string, any>();
    for (const media of (serializedTimeline.media || [])) {
      if (media?.id) libraryMap.set(media.id, media);
    }

    // Only prepare media referenced by timeline clips. Import libraries can
    // contain dozens of unused HEVC files; converting those would waste minutes
    // before frame 0 without changing the export.
    const mediaMap = new Map<string, any>();
    for (const track of (serializedTimeline.tracks || [])) {
      for (const clip of (track.clips || [])) {
        if (!clip.mediaId || mediaMap.has(clip.mediaId)) continue;
        mediaMap.set(
          clip.mediaId,
          libraryMap.get(clip.mediaId) || {
            id: clip.mediaId,
            url: clip.url,
            name: clip.name,
            type: clip.type || (track.type === 'audio' ? 'audio' : 'video'),
          },
        );
      }
    }

    serializedTimeline.media = Array.from(mediaMap.values());

    // Process sequentially: opening many HEVC decoders/encoders together can
    // exhaust Chrome's media session limit before export even begins.
    for (const m of serializedTimeline.media as any[]) {
      this.checkActive(signal);
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

        this.checkActive(signal);
        if (fileBlob) {
          const originalBlob = fileBlob instanceof Blob ? fileBlob : new Blob([fileBlob as any]);
          const isVideo = m.type === 'video' || originalBlob.type.startsWith('video/') || /\.(mp4|mov|m4v|webm|mkv|avi|hevc)$/i.test(m.name || '');

          // Keep original bytes for OfflineAudioContext. A normalized H.264 proxy
          // is video-only, while its HEVC source may still contain the audio used
          // by the timeline mix.
          m._audioBlob = originalBlob;
          m._fileBlob = originalBlob;

          if (isVideo) {
            const normalized = await normalizeVideoBlobForExport(
              originalBlob,
              `${m.id}:${originalBlob.size}:${(fileBlob as File).lastModified || 0}`,
              m.name || m.id,
              (message) => this.options.callbacks.onWarning?.(message),
            );
            if (normalized.warning) this.options.callbacks.onWarning?.(normalized.warning);
            if (normalized.transcoded) {
              const normalizedResponse = await fetch(normalized.url);
              if (!normalizedResponse.ok) throw new Error(`failed to read normalized video (${normalizedResponse.status})`);
              m._fileBlob = await normalizedResponse.blob();
              m._normalizedFromCodec = 'hevc-or-unsupported';
            }
          }

          (m as any)._fileSize = m._fileBlob.size;
        } else {
          console.warn('[Export] Media could not be loaded (will be black):', m.id, m.name || '', 'url:', m.url?.slice(0, 50));
          // Push warning to UI via callback if available
          this.options.callbacks.onWarning?.(
            `"${m.name || m.id}" could not be loaded for export — its segment may be black. Try re-importing the file.`
          );
        }
      } catch (e: any) {
        this.checkActive(signal);
        console.warn('[Export] Media prep failed for:', m.id, e);
        this.options.callbacks.onWarning?.(`"${m.name || m.id}" could not be prepared: ${e?.message || e}`);
      }
    }

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
      pipWindows: timeline.pipWindows || {},
    };
    
    // Deep clone just in case there are nested non-serializable proxies
    return JSON.parse(JSON.stringify(safeTimeline));
  }
}
