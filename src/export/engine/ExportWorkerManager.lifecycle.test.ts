import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExportWorkerManager } from './ExportWorkerManager';
import { getFileFromDB } from '@/utils/projectPersistence';

const { mix } = vi.hoisted(() => ({ mix: vi.fn() }));
vi.mock('./AudioMixer', () => ({ AudioMixer: class { mix(...args: any[]) { return mix(...args); } } }));
vi.mock('./VideoNormalizer', () => ({ normalizeVideoBlobForExport: vi.fn().mockResolvedValue({ transcoded: false }) }));
vi.mock('@/utils/projectPersistence', () => ({ getFileFromDB: vi.fn().mockResolvedValue(new Blob(['video'], { type: 'video/mp4' })) }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
}

class FakeWorker {
  onmessage: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  onmessageerror: (() => void) | null = null;
  started = deferred<any>();
  postMessage = vi.fn((message: any) => {
    if (message.type === 'START_EXPORT') this.started.resolve(message.payload);
  });
  terminate = vi.fn();
  emit(type: string, payload: any = {}) { this.onmessage?.({ data: { type, payload } }); }
}

const config = { fps: 30, width: 640, height: 360, bitrate: 1_000_000, format: 'mp4' as const, filename: 'test', aspectRatio: '16:9' };
const managers: ExportWorkerManager[] = [];
let worker: FakeWorker;

function makeManager(timeline: any = { tracks: [], mediaLibrary: [], totalDuration: 10 }) {
  const callbacks = { onProgress: vi.fn(), onPhaseChange: vi.fn(), onComplete: vi.fn(), onError: vi.fn(), onWarning: vi.fn() };
  const manager = new ExportWorkerManager({ timeline, config, callbacks });
  managers.push(manager);
  return { manager, callbacks };
}

beforeEach(() => {
  worker = new FakeWorker();
  vi.stubGlobal('Worker', vi.fn(() => worker));
  mix.mockReset().mockResolvedValue(null);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  managers.splice(0).forEach(manager => manager.dispose());
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('export lifecycle after editing', () => {
  it('detaches Speed Frame data and never retains/serializes the undo stack or preview DOM', async () => {
    const clip = { id: 'clip', startTime: 0, duration: 10, speedFrames: [{ id: 'sf', sourceTime: 4, timelineOffset: 5 }], speedFrameSourceEnd: 10 };
    const timeline: any = { tracks: [{ type: 'text', clips: [clip] }], mediaLibrary: [], totalDuration: 10 };
    // These are deliberately non-serializable; the exporter must not touch them.
    timeline.history = [timeline];
    timeline.previewCanvas = { owner: timeline };
    const { manager } = makeManager(timeline);
    expect((manager as any).options.timeline).not.toHaveProperty('history');
    expect((manager as any).options.timeline).not.toHaveProperty('previewCanvas');
    clip.speedFrames[0].timelineOffset = 6; // later UI edit cannot alter this export

    const run = manager.export(new AbortController().signal);
    const payload = await worker.started.promise;
    expect(payload.timeline.tracks[0].clips[0].speedFrames[0].timelineOffset).toBe(5);
    expect(payload.timeline.tracks[0].clips[0].speedFrameSourceEnd).toBe(10);
    expect((manager as any).options.timeline).toBeNull();
    worker.emit('COMPLETE', { filename: 'test.mp4', fileSize: 42 });
    await expect(run).resolves.toEqual({ filename: 'test.mp4', savedViaRuntime: false });
    manager.dispose();
    manager.dispose();
    expect(worker.terminate).toHaveBeenCalledTimes(1);
    expect(timeline.history).toHaveLength(1); // export never clears user undo
  });

  it.each(['error', 'messageerror'] as const)('rejects a native worker %s instead of hanging with preview suspended', async (kind) => {
    const { manager, callbacks } = makeManager();
    const run = manager.export(new AbortController().signal);
    await worker.started.promise;
    const rejected = expect(run).rejects.toThrow(kind === 'error' ? 'decoder crashed' : 'response could not be read');
    if (kind === 'error') worker.onerror?.({ message: 'decoder crashed' });
    else worker.onmessageerror?.();
    await rejected;
    expect(callbacks.onError).toHaveBeenCalledTimes(1);
  });

  it('handles an immediate completion response without missing the message', async () => {
    worker.postMessage.mockImplementation(message => {
      if (message.type === 'START_EXPORT') worker.emit('COMPLETE', { filename: 'fast.mp4', savedDirectly: true, fileSize: 42 });
    });
    const { manager } = makeManager();
    await expect(manager.export(new AbortController().signal)).resolves.toEqual({ filename: 'fast.mp4', savedViaRuntime: true });
  });

  it('does not start a worker when cancelled during media preparation', async () => {
    const file = deferred<Blob>();
    vi.mocked(getFileFromDB).mockReturnValueOnce(file.promise as any);
    const { manager } = makeManager({
      tracks: [{ type: 'video', clips: [{ id: 'clip', mediaId: 'media', duration: 10, startTime: 0 }] }],
      mediaLibrary: [{ id: 'media', type: 'video', name: 'video.mp4' }], totalDuration: 10,
    });
    const controller = new AbortController();
    const run = manager.export(controller.signal);
    const rejected = expect(run).rejects.toThrow('AbortError');
    controller.abort();
    file.resolve(new Blob(['video'], { type: 'video/mp4' }));
    await rejected;
    expect(worker.postMessage).not.toHaveBeenCalled();
    expect(mix).not.toHaveBeenCalled();
  });

  it('does not start a worker when cancelled during the Speed Frame audio pre-mix', async () => {
    const started = deferred<void>();
    const mixed = deferred<null>();
    mix.mockImplementation(() => { started.resolve(); return mixed.promise; });
    const { manager } = makeManager();
    const controller = new AbortController();
    const run = manager.export(controller.signal);
    await started.promise;
    const rejected = expect(run).rejects.toThrow('AbortError');
    controller.abort();
    mixed.resolve(null);
    await rejected;
    expect(worker.postMessage).not.toHaveBeenCalled();
  });

  it('remembers startup errors that happen before START_EXPORT is posted', async () => {
    const { manager } = makeManager();
    worker.onerror?.({ message: 'Worker could not start' });
    await expect(manager.export(new AbortController().signal)).rejects.toThrow('Worker could not start');
    expect(worker.postMessage).not.toHaveBeenCalled();
  });

  it.each(['abort', 'dispose'] as const)('settles an active export on %s and removes cancel handlers', async (action) => {
    const { manager } = makeManager();
    const controller = new AbortController();
    const run = manager.export(controller.signal);
    await worker.started.promise;
    const rejected = expect(run).rejects.toThrow('AbortError');
    if (action === 'abort') controller.abort();
    else manager.dispose();
    await rejected;
    worker.postMessage.mockClear();
    controller.abort();
    manager.dispose();
    expect(worker.postMessage).not.toHaveBeenCalled();
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });
});
