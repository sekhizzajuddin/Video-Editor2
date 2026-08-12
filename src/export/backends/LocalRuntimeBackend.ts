import { EncoderBackend, EncoderBackendType, ExportOptions } from '../types';

export class LocalRuntimeBackend implements EncoderBackend {
  readonly type: EncoderBackendType = 'ffmpeg';
  readonly name = 'Hikmah Local Native FFmpeg Runtime';
  private cancelled = false;
  private ws: WebSocket | null = null;

  cancel(): void {
    this.cancelled = true;
    if (this.ws) {
      try {
        this.ws.send(JSON.stringify({ type: 'CANCEL' }));
        this.ws.close();
      } catch (e) {}
    }
  }

  async isSupported(_opts: ExportOptions): Promise<boolean> {
    // Check if Hikmah Runtime is active on port 12589 or 9000
    const ports = [12589, 9000];
    for (const port of ports) {
      try {
        const isAlive = await new Promise<boolean>((resolve) => {
          const testWs = new WebSocket(`ws://127.0.0.1:${port}`);
          const timer = setTimeout(() => {
            testWs.close();
            resolve(false);
          }, 600);

          testWs.onopen = () => {
            clearTimeout(timer);
            testWs.close();
            resolve(true);
          };

          testWs.onerror = () => {
            clearTimeout(timer);
            resolve(false);
          };
        });

        if (isAlive) return true;
      } catch (e) {}
    }
    return false;
  }

  async export(opts: ExportOptions): Promise<Blob> {
    this.cancelled = false;
    opts.setStatusMsg?.('Connecting to Hikmah Local Runtime (Native FFmpeg)...');

    const port = 12589;
    return new Promise<Blob>((resolve, reject) => {
      try {
        this.ws = new WebSocket(`ws://127.0.0.1:${port}`);

        this.ws.onopen = () => {
          opts.setStatusMsg?.('Connected to Hikmah Runtime. Preparing export...');
          opts.onProgress({ stage: 'preparing', percentage: 10, message: 'Connected to local FFmpeg runtime...' });

          // Send export metadata
          this.ws?.send(JSON.stringify({
            type: 'START_NATIVE_EXPORT',
            payload: {
              width: opts.width,
              height: opts.height,
              fps: opts.fps,
              bitrate: opts.bitrate || 12_000_000,
              format: opts.format,
            }
          }));
        };

        this.ws.onmessage = (event) => {
          if (this.cancelled) return;
          try {
            const data = JSON.parse(event.data);
            if (data.event === 'PROGRESS') {
              opts.onProgress({
                stage: 'rendering',
                percentage: data.progress || 50,
                message: `FFmpeg encoding: ${Math.round(data.progress || 0)}%`,
              });
            } else if (data.event === 'COMPLETE' && data.blob) {
              opts.onProgress({ stage: 'complete', percentage: 100, message: 'Native export complete!' });
              resolve(data.blob);
            } else if (data.event === 'ERROR') {
              reject(new Error(data.message || 'Hikmah Runtime export error'));
            }
          } catch (e) {}
        };

        this.ws.onerror = (_err) => {
          reject(new Error('Connection error with Hikmah Local Runtime.'));
        };

        this.ws.onclose = () => {
          if (!this.cancelled) {
            // If closed unexpectedly
          }
        };

      } catch (err: any) {
        reject(err);
      }
    });
  }
}
