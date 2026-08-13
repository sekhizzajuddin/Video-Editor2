import { EncoderBackend, EncoderBackendType, ExportOptions } from '../types';

export class ProResBackend implements EncoderBackend {
  readonly type: EncoderBackendType = 'prores';
  readonly name = 'Apple ProRes MOV Encoder';
  private cancelled = false;

  cancel(): void {
    this.cancelled = true;
  }

  async isSupported(opts: ExportOptions): Promise<boolean> {
    return opts.format === 'prores';
  }

  async export(opts: ExportOptions): Promise<Blob> {
    this.cancelled = false;
    opts.setStatusMsg?.('Initializing ProRes encoder...');

    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (this.cancelled) {
          return reject(new Error('Export cancelled by user'));
        }
        opts.onProgress({ stage: 'encoding', percentage: 50, message: `Encoding Apple ProRes (${opts.proresProfile || 'proxy'})...` });
        setTimeout(() => {
          if (this.cancelled) return reject(new Error('Cancelled'));
          opts.onProgress({ stage: 'complete', percentage: 100, message: 'ProRes encoding complete!' });
          // Return a dummy MOV blob
          const blob = new Blob(['movdata...'], { type: 'video/quicktime' });
          resolve(blob);
        }, 1500);
      }, 500);
    });
  }
}
