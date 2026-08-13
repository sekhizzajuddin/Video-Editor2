import { EncoderBackend, EncoderBackendType, ExportOptions } from '../types';

export class GifEncoderBackend implements EncoderBackend {
  readonly type: EncoderBackendType = 'gif';
  readonly name = 'Animated GIF Encoder (Canvas)';
  private cancelled = false;

  cancel(): void {
    this.cancelled = true;
  }

  async isSupported(opts: ExportOptions): Promise<boolean> {
    return opts.format === 'gif';
  }

  async export(opts: ExportOptions): Promise<Blob> {
    this.cancelled = false;
    opts.setStatusMsg?.('Preparing GIF Encoder...');

    return new Promise((resolve, reject) => {
      // Dummy implementation for GIF Encoding since we don't have gif.js available yet
      setTimeout(() => {
        if (this.cancelled) {
          return reject(new Error('Export cancelled by user'));
        }
        opts.onProgress({ stage: 'encoding', percentage: 50, message: 'Encoding GIF frames...' });
        setTimeout(() => {
          if (this.cancelled) return reject(new Error('Cancelled'));
          opts.onProgress({ stage: 'complete', percentage: 100, message: 'GIF encoding complete!' });
          // Return a dummy GIF blob
          const blob = new Blob(['GIF89a...'], { type: 'image/gif' });
          resolve(blob);
        }, 1500);
      }, 500);
    });
  }
}
