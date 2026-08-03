import { EncoderBackend, EncoderBackendType, ExportOptions } from './types';
import { WebCodecsBackend } from './backends/WebCodecsBackend';
import { WebMWebCodecsBackend } from './backends/WebMWebCodecsBackend';
import { MediaRecorderBackend } from './backends/MediaRecorderBackend';

export class ExportPipeline {
  private backends: EncoderBackend[] = [
    new WebCodecsBackend(),         // MP4 frame-by-frame (best for MP4)
    new WebMWebCodecsBackend(),     // WebM frame-by-frame (best for WebM)
    new MediaRecorderBackend(),     // Legacy real-time fallback
  ];
  private activeBackend: EncoderBackend | null = null;

  async selectBestBackend(opts: ExportOptions): Promise<EncoderBackend> {
    for (const backend of this.backends) {
      if (await backend.isSupported(opts)) {
        return backend;
      }
    }
    // Fallback to MediaRecorder regardless if nothing matched explicitly
    return new MediaRecorderBackend();
  }

  start(opts: ExportOptions): {
    promise: Promise<{ blob: Blob; backendType: EncoderBackendType }>;
    cancel: () => void;
  } {
    let cancelled = false;

    const promise = (async () => {
      const selectedBackend = await this.selectBestBackend(opts);
      this.activeBackend = selectedBackend;

      if (import.meta.env.DEV) {
        console.log(`[ExportPipeline] Selected backend: ${selectedBackend.name}`);
      }
      opts.setStatusMsg?.(`Using encoder: ${selectedBackend.name}`);

      try {
        const blob = await selectedBackend.export(opts);
        return { blob, backendType: selectedBackend.type };
      } catch (err: any) {
        if (cancelled || err.message?.includes('cancelled')) {
          throw new Error('Export cancelled by user.');
        }

        // Automatic High-Reliability Failover:
        // If any WebCodecs backend fails, fall back to MediaRecorder
        if (selectedBackend.type === 'webcodecs' || selectedBackend.type === 'webm-webcodecs') {
          console.warn(`[ExportPipeline] ${selectedBackend.name} failed, falling back to MediaRecorder...`, err);
          opts.setStatusMsg?.('Hardware encoder failed, falling back to software recording...');
          
          const fallbackBackend = new MediaRecorderBackend();
          this.activeBackend = fallbackBackend;
          const fallbackBlob = await fallbackBackend.export(opts);
          return { blob: fallbackBlob, backendType: fallbackBackend.type };
        }

        throw err;
      } finally {
        this.activeBackend = null;
      }
    })();

    const cancel = () => {
      cancelled = true;
      if (this.activeBackend) {
        this.activeBackend.cancel();
      }
    };

    return { promise, cancel };
  }
}

export const defaultExportPipeline = new ExportPipeline();
