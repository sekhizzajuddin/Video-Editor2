import { describe, expect, it, vi } from 'vitest';
import { ExportPipeline } from './ExportPipeline';
import type { EncoderBackend, ExportOptions } from './types';

const backend = (): EncoderBackend => ({
  type: 'webcodecs', name: 'Test encoder',
  isSupported: vi.fn().mockResolvedValue(true),
  export: vi.fn().mockResolvedValue(new Blob(['video'])),
  cancel: vi.fn(),
});

describe('capture fallback cancellation', () => {
  it('does not start encoding if cancelled while checking backend support', async () => {
    const pipeline = new ExportPipeline();
    const encoder = backend();
    let select!: (backend: EncoderBackend) => void;
    vi.spyOn(pipeline, 'selectBestBackend').mockReturnValue(new Promise(resolve => { select = resolve; }));
    const task = pipeline.start({} as ExportOptions);
    task.cancel();
    select(encoder);
    await expect(task.promise).rejects.toThrow('Export cancelled');
    expect(encoder.export).not.toHaveBeenCalled();
  });

  it('still starts the selected backend when not cancelled', async () => {
    const pipeline = new ExportPipeline();
    const encoder = backend();
    vi.spyOn(pipeline, 'selectBestBackend').mockResolvedValue(encoder);
    const result = await pipeline.start({} as ExportOptions).promise;
    expect(encoder.export).toHaveBeenCalledTimes(1);
    expect(result.backendType).toBe('webcodecs');
    expect(result.blob.size).toBeGreaterThan(0);
  });
});
