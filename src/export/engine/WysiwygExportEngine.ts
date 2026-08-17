import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import { useEditorStore } from '@/store/editorStore';
import { renderCanvasEngine } from '@/components/preview/CanvasRenderingEngine';
import { AudioMixer } from './AudioMixer';
import { ExportPhase } from '../types';
import { ParticlePool } from '@/utils/canvasEffects';

export interface WysiwygExportConfig {
  width: number;
  height: number;
  fps: number;
  bitrate?: number;
  format: string;
  filename: string;
  outputFolder?: string;
  aspectRatio: string;
}

export interface WysiwygExportCallbacks {
  onProgress: (progress: number, currentFrame: number, eta: number) => void;
  onPhaseChange: (phase: ExportPhase) => void;
  onPreviewFrame?: (canvas: HTMLCanvasElement, currentFrame: number, totalFrames: number, currentTime: number) => void;
  onComplete: (fileSize: number, filename: string, blob: Blob) => void;
  onError: (error: Error) => void;
  onWarning?: (message: string) => void;
}

export class WysiwygExportEngine {
  private config: WysiwygExportConfig;
  private callbacks: WysiwygExportCallbacks;
  private fileHandle?: FileSystemFileHandle | null;
  private cancelled = false;

  constructor(
    config: WysiwygExportConfig,
    callbacks: WysiwygExportCallbacks,
    fileHandle?: FileSystemFileHandle | null
  ) {
    this.config = config;
    this.callbacks = callbacks;
    this.fileHandle = fileHandle;
  }

  cancel(): void {
    this.cancelled = true;
  }

  private async getSupportedCodec(width: number, height: number, bitrate: number, fps: number): Promise<string> {
    const candidates = [
      'avc1.640034', // High Profile Level 5.2 (4K & High FPS)
      'avc1.640028', // High Profile Level 4.0 (1080p high quality)
      'avc1.4d002a', // Main Profile Level 4.2
      'avc1.4d0028', // Main Profile Level 4.0
      'avc1.42001f', // Baseline Profile Level 3.1
      'avc1.42E01F', // Baseline Profile Level 3.1 (Alternate)
    ];

    if (typeof window.VideoEncoder !== 'undefined') {
      for (const codec of candidates) {
        try {
          const res = await window.VideoEncoder.isConfigSupported({
            codec,
            width,
            height,
            bitrate,
            framerate: fps,
          });
          if (res.supported) return codec;
        } catch {}
      }
    }
    return (width > 1920 || height > 1080) ? 'avc1.640034' : 'avc1.42E01F';
  }

  async export(signal: AbortSignal): Promise<{ filename: string; savedViaRuntime: boolean; blob: Blob }> {
    this.cancelled = false;
    const store = useEditorStore.getState();

    // 1. Calculate duration
    let duration = (store as any).totalDuration || (store as any).duration || 0;
    if (!duration && store.tracks) {
      for (const track of store.tracks) {
        for (const clip of track.clips || []) {
          const end = (clip.startTime || 0) + (clip.duration || 0);
          if (end > duration) duration = end;
        }
      }
    }
    duration = Math.max(0.1, duration);
    const totalFrames = Math.ceil(duration * this.config.fps);
    const startTime = Date.now();

    const abortHandler = () => {
      this.cancel();
    };
    signal.addEventListener('abort', abortHandler);

    // 2. Setup Dedicated Export Video Elements Pool
    const exportVideoMap = new Map<string, HTMLVideoElement>();
    const mediaLibraryMap = new Map(store.mediaLibrary?.map((m: any) => [m.id, m.url]) || []);

    const getSpeedRampMediaTime = (clip: any, ct: number): number => {
      const elapsed = ct - clip.startTime;
      const trim = clip.trimStart ?? clip.startOffset ?? 0;
      const speed = clip.speed ?? 1;
      const ramp = clip.speedRamp;
      if (!ramp || ramp.length < 2) return elapsed * speed + trim;
      try {
        const keys = [...ramp].sort((a: any, b: any) => a.sourceTime - b.sourceTime);
        let timelineCursor = 0;
        for (let j = 0; j < keys.length - 1; j++) {
          const a = keys[j];
          const b = keys[j + 1];
          const deltaSource = b.sourceTime - a.sourceTime;
          const avgSpeed = (a.speed + b.speed) / 2;
          const segTimeline = avgSpeed > 0.001 ? deltaSource / avgSpeed : 0;
          if (elapsed < timelineCursor + segTimeline) {
            const local = elapsed - timelineCursor;
            const ratio = segTimeline > 0.001 ? local / segTimeline : 0;
            return a.sourceTime + ratio * deltaSource * (a.speed / Math.max(0.001, avgSpeed));
          }
          timelineCursor += segTimeline;
        }
        const last = keys[keys.length - 1];
        return last.sourceTime + Math.max(0, elapsed - timelineCursor) * last.speed + trim;
      } catch {
        return elapsed * speed + trim;
      }
    };

    this.callbacks.onPhaseChange('preparing');

    // Pre-load all required video elements invisibly
    const loadPromises: Promise<void>[] = [];
    for (const track of store.tracks) {
      if (track.type !== 'video' || track.hidden || track.muted) continue;
      for (const clip of track.clips || []) {
        const mediaId = clip.mediaId || clip.id;
        const url = mediaLibraryMap.get(mediaId) || (clip as any).url;
        if (!url || exportVideoMap.has(clip.id)) continue;

        const video = document.createElement('video');
        video.src = url;
        video.muted = true;
        video.playsInline = true;
        video.preload = 'auto';
        video.crossOrigin = 'anonymous';

        loadPromises.push(new Promise<void>((resolve) => {
          let resolved = false;
          const done = () => { if (!resolved) { resolved = true; resolve(); } };
          video.onloadedmetadata = done;
          video.onerror = done;
          setTimeout(done, 10000); // 10s max wait per video
        }));

        exportVideoMap.set(clip.id, video);
      }
    }
    if (loadPromises.length > 0) {
      await Promise.all(loadPromises);
    }

    // 3. Setup Export Canvas at exact target resolution
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = this.config.width;
    exportCanvas.height = this.config.height;

    const compositeCtxRef: { current: CanvasRenderingContext2D | null } = { current: null };
    const offscreenCanvasPool: { current: Map<string, HTMLCanvasElement> } = { current: new Map() };
    const particlePoolsRef: { current: Map<string, ParticlePool> } = { current: new Map() };
    const lastParticleTimeRef: { current: number | null } = { current: null };
    const lastFrameCanvasRef: { current: HTMLCanvasElement | null } = { current: null };

    // 4. Configure VideoEncoder & mp4-muxer
    const bitrate = this.config.bitrate || 15_000_000;
    const codec = await this.getSupportedCodec(this.config.width, this.config.height, bitrate, this.config.fps);
    const supportsAudio = typeof window.AudioEncoder !== 'undefined' && typeof window.OfflineAudioContext !== 'undefined';

    const muxer = new Muxer({
      target: new ArrayBufferTarget(),
      video: {
        codec: 'avc',
        width: this.config.width,
        height: this.config.height,
        frameRate: this.config.fps,
      },
      audio: supportsAudio ? {
        codec: 'aac',
        numberOfChannels: 2,
        sampleRate: 48_000,
      } : undefined,
      fastStart: 'in-memory',
    });

    let videoEncoder: VideoEncoder | null = null;
    let encodeError: Error | null = null;

    try {
      videoEncoder = new window.VideoEncoder({
        output: (chunk, meta) => {
          if (!this.cancelled) {
            muxer.addVideoChunk(chunk, meta as any);
          }
        },
        error: (e: any) => {
          console.error('[WysiwygExportEngine] VideoEncoder error:', e);
          encodeError = new Error(`Video encoding failed: ${e?.message || e}`);
        },
      });

      videoEncoder.configure({
        codec,
        width: this.config.width,
        height: this.config.height,
        bitrate,
        framerate: this.config.fps,
        latencyMode: 'quality',
        avc: { format: 'avc' },
      });

      this.callbacks.onPhaseChange('rendering');

      // 5. Deterministic Frame Stepping Loop (WYSIWYG)
      for (let i = 0; i < totalFrames; i++) {
        if (this.cancelled || signal.aborted) {
          throw new Error('AbortError');
        }
        if (encodeError) throw encodeError;

        const currentTime = Math.min(duration, i / this.config.fps);

        // Seek all dedicated export video elements synchronously
        const seekPromises: Promise<void>[] = [];
        for (const track of store.tracks) {
          if (track.type !== 'video' || track.hidden || track.muted) continue;
          for (const clip of track.clips || []) {
            if (currentTime >= clip.startTime && currentTime <= clip.startTime + clip.duration) {
              const v = exportVideoMap.get(clip.id);
              if (v && v.readyState >= 1) {
                const mediaTime = getSpeedRampMediaTime(clip, currentTime);
                if (Math.abs(v.currentTime - mediaTime) > 0.01) {
                  seekPromises.push(new Promise<void>((resolve) => {
                    let resolved = false;
                    const handler = () => {
                      if (resolved) return;
                      resolved = true;
                      v.removeEventListener('seeked', handler);
                      resolve();
                    };
                    v.addEventListener('seeked', handler);
                    v.currentTime = mediaTime;
                    setTimeout(handler, 800); // 800ms generous fallback timeout
                  }));
                }
              }
            }
          }
        }
        if (seekPromises.length > 0) {
          await Promise.all(seekPromises);
        }

        // Render scene onto export canvas using dedicated exportVideoMap
        const currentStore = useEditorStore.getState();
        await renderCanvasEngine({
          canvas: exportCanvas,
          compositeCtxRef,
          offscreenCanvasPool,
          particlePoolsRef,
          lastParticleTimeRef,
          lastFrameCanvasRef,
          isScrubbing: false,
          renderDeps: {
            currentTime,
            tracks: currentStore.tracks,
            selectedClipId: null,
            mediaLibrary: currentStore.mediaLibrary,
            videoElements: exportVideoMap,
            viewport: { x: 0, y: 0, zoom: 1 },
            settings: currentStore.settings,
            showGrid: false,
            canvasBgColor: '#000000',
            isPlaying: false,
            aspectRatio: this.config.aspectRatio,
            isExporting: true,
            exportWidth: this.config.width,
            exportHeight: this.config.height,
            showProgressBar: false,
            imageRevision: 0,
            requestRedraw: () => {},
          },
        });

        // Live preview callback for Export Modal window
        if (this.callbacks.onPreviewFrame) {
          this.callbacks.onPreviewFrame(exportCanvas, i + 1, totalFrames, currentTime);
        }

        // Encode frame
        const timestampUs = Math.floor((i * 1_000_000) / this.config.fps);
        const durationUs = Math.floor(1_000_000 / this.config.fps);
        const vf = new VideoFrame(exportCanvas, {
          timestamp: timestampUs,
          duration: durationUs,
        });

        const isKeyframe = i === 0 || i % (this.config.fps * 2) === 0;
        videoEncoder.encode(vf, { keyFrame: isKeyframe });
        vf.close();

        // Progress & ETA calculation
        const elapsed = (Date.now() - startTime) / 1000;
        const progress = Math.min(90, Math.floor(((i + 1) / totalFrames) * 85));
        const rate = (i + 1) / (elapsed || 0.001); // frames per second
        const remainingFrames = totalFrames - (i + 1);
        const eta = rate > 0 ? remainingFrames / rate : 0;

        this.callbacks.onProgress(progress, i + 1, eta);

        // Yield macro-task every 3 frames to keep browser UI and Live Preview interactive
        if (i % 3 === 0) {
          await new Promise((r) => setTimeout(r, 0));
        }
      }

      await videoEncoder.flush();
      if (videoEncoder.state !== 'closed') videoEncoder.close();
      videoEncoder = null;

      // 6. Mix & Encode Audio Offline
      if (supportsAudio && !this.cancelled) {
        this.callbacks.onPhaseChange('muxing');
        this.callbacks.onProgress(92, totalFrames, 2);

        try {
          const audioMixer = new AudioMixer();
          const currentStore = useEditorStore.getState();
          const audioBuffer = await audioMixer.mix(currentStore, duration);

          if (audioBuffer && audioBuffer.length > 0) {
            let audioEncoder: AudioEncoder | null = new window.AudioEncoder({
              output: (chunk, meta) => {
                if (!this.cancelled) {
                  muxer.addAudioChunk(chunk, meta as any);
                }
              },
              error: (e: any) => {
                console.warn('[WysiwygExportEngine] AudioEncoder warning:', e);
              },
            });

            audioEncoder.configure({
              codec: 'mp4a.40.2',
              numberOfChannels: 2,
              sampleRate: 48_000,
              bitrate: 192_000,
            });

            // Convert audioBuffer into AudioData chunks
            const sampleRate = audioBuffer.sampleRate;
            const numChannels = audioBuffer.numberOfChannels;
            const totalSamples = audioBuffer.length;
            const chunkSize = 1024; // AAC frame length

            const ch0 = audioBuffer.getChannelData(0);
            const ch1 = numChannels > 1 ? audioBuffer.getChannelData(1) : ch0;

            for (let offset = 0; offset < totalSamples; offset += chunkSize) {
              if (this.cancelled) break;
              const currentChunk = Math.min(chunkSize, totalSamples - offset);
              const planarData = new Float32Array(currentChunk * 2);
              planarData.set(ch0.subarray(offset, offset + currentChunk), 0);
              planarData.set(ch1.subarray(offset, offset + currentChunk), currentChunk);

              const audioData = new window.AudioData({
                format: 'f32-planar',
                sampleRate,
                numberOfFrames: currentChunk,
                numberOfChannels: 2,
                timestamp: Math.floor((offset / sampleRate) * 1_000_000),
                data: planarData,
              });

              audioEncoder.encode(audioData);
              audioData.close();
            }

            if (audioEncoder && audioEncoder.state !== 'closed') {
              await audioEncoder.flush();
              audioEncoder.close();
            }
          }
        } catch (audioErr) {
          console.warn('[WysiwygExportEngine] Audio mixing error:', audioErr);
        }
      }

      // 7. Finalize Muxer
      this.callbacks.onPhaseChange('finalizing');
      this.callbacks.onProgress(98, totalFrames, 1);

      muxer.finalize();
      const { buffer } = muxer.target as ArrayBufferTarget;
      const outBlob = new Blob([buffer], { type: 'video/mp4' });

      // Save directly to file handle if available
      const finalFilename = `${this.config.filename}.mp4`;
      if (this.fileHandle) {
        try {
          const writable = await this.fileHandle.createWritable();
          await writable.write(outBlob);
          await writable.close();
        } catch (fhErr) {
          console.warn('[WysiwygExportEngine] Failed to write directly to fileHandle:', fhErr);
        }
      }

      this.callbacks.onPhaseChange('completed');
      this.callbacks.onProgress(100, totalFrames, 0);
      this.callbacks.onComplete(outBlob.size, finalFilename, outBlob);

      return {
        filename: finalFilename,
        savedViaRuntime: !!this.fileHandle,
        blob: outBlob,
      };
    } finally {
      signal.removeEventListener('abort', abortHandler);
      store.setIsExporting(false);
      // Clean up headless video pool
      exportVideoMap.forEach(v => {
        v.removeAttribute('src');
        v.load();
      });
      exportVideoMap.clear();
      
      if (videoEncoder && (videoEncoder as any).state !== 'closed') {
        try { videoEncoder.close(); } catch {}
      }
    }
  }
}
