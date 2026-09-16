import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useExportEngine } from './useExportEngine';
import { isPreviewSuspendedForExport } from '@/utils/previewSuspension';
import { getTrimPreviewTime, setTrimPreviewTime } from '@/utils/playbackClock';

// Small hook-lifecycle harness: browser media/React rendering are covered by
// the browser smoke test; these tests force otherwise timing-sensitive exits.
const harness = vi.hoisted(() => ({ state: null as any, cleanups: [] as Array<() => void> }));
const mocks = vi.hoisted(() => ({
  store: null as any,
  managers: [] as any[],
  runWorker: vi.fn(),
  startCapture: vi.fn(),
  restoreCanvas: vi.fn(),
  clearCache: vi.fn(),
  constructorError: null as Error | null,
}));

vi.mock('react', () => ({
  useState: (initial: any) => {
    harness.state = initial;
    return [initial, (update: any) => { harness.state = typeof update === 'function' ? update(harness.state) : update; }];
  },
  useRef: (initial: any) => ({ current: initial }),
  useCallback: (callback: any) => callback,
  useEffect: (effect: () => any) => { const cleanup = effect(); if (cleanup) harness.cleanups.push(cleanup); },
}));
vi.mock('@/store/editorStore', () => ({ useEditorStore: { getState: () => mocks.store } }));
vi.mock('./engine/ExportWorkerManager', () => ({
  ExportWorkerManager: class {
    dispose = vi.fn();
    download = vi.fn();
    constructor(public options: any) {
      if (mocks.constructorError) throw mocks.constructorError;
      mocks.managers.push(this);
    }
    export(signal: AbortSignal) { return mocks.runWorker(this, signal); }
  },
}));
vi.mock('./ExportPipeline', () => ({ defaultExportPipeline: { start: (...args: any[]) => mocks.startCapture(...args) } }));
vi.mock('./exportCanvasSize', () => ({ promoteCanvasToExportSize: async () => mocks.restoreCanvas }));
vi.mock('./engine/VideoNormalizer', () => ({ clearNormalizedCache: () => mocks.clearCache() }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

const config = { fps: 30, width: 640, height: 360, bitrate: 1_000_000, format: 'mp4' as const, filename: 'test', aspectRatio: '16:9' };
let writable: { write: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> };
let fileHandle: any;

beforeEach(() => {
  mocks.managers.length = 0;
  mocks.constructorError = null;
  harness.cleanups.length = 0;
  vi.resetAllMocks();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  writable = { write: vi.fn().mockResolvedValue(undefined), close: vi.fn().mockResolvedValue(undefined) };
  fileHandle = { name: 'test.mp4', createWritable: vi.fn().mockResolvedValue(writable) };
  mocks.store = {
    tracks: [], mediaLibrary: [], totalDuration: 10, aspectRatio: '16:9', pipWindows: {},
    history: [{ label: 'Adjust Speed Frame' }], previewCanvas: {},
    pause: vi.fn(), selectSpeedFrame: vi.fn(),
  };
  mocks.runWorker.mockImplementation(async (manager) => {
    manager.options.callbacks.onComplete(42);
    return { filename: 'test.mp4', savedViaRuntime: false };
  });
  mocks.startCapture.mockReturnValue({ promise: Promise.resolve({ blob: new Blob(['capture']) }), cancel: vi.fn() });
  setTrimPreviewTime(5);
});

afterEach(() => {
  harness.cleanups.splice(0).forEach(cleanup => cleanup());
  expect(isPreviewSuspendedForExport()).toBe(false);
  setTrimPreviewTime(null);
  vi.restoreAllMocks();
});

describe('export restores preview on every exit', () => {
  it('suspends before preparation, exports without retaining history, and allows another edited export', async () => {
    const history = mocks.store.history;
    mocks.runWorker.mockImplementation(async (manager) => {
      expect(isPreviewSuspendedForExport()).toBe(true);
      expect(manager.options.timeline).not.toHaveProperty('history');
      expect(manager.options.timeline).not.toHaveProperty('previewCanvas');
      manager.options.callbacks.onComplete(42);
      return { filename: 'test.mp4' };
    });
    const engine = useExportEngine();
    await engine.startExport(config);
    expect(mocks.store.pause).toHaveBeenCalled();
    expect(mocks.store.selectSpeedFrame).toHaveBeenCalledWith(null, null);
    expect(getTrimPreviewTime()).toBeNull();
    expect(isPreviewSuspendedForExport()).toBe(false);
    expect(mocks.managers[0].dispose).toHaveBeenCalled();
    expect(mocks.store.history).toBe(history);
    expect(harness.state.phase).toBe('completed');

    await engine.startExport(config);
    expect(mocks.managers).toHaveLength(2);
    expect(isPreviewSuspendedForExport()).toBe(false);
    expect(mocks.clearCache).toHaveBeenCalledTimes(2);
  });

  it('ignores a second click while the first export is still preparing', async () => {
    const pending = deferred<any>();
    mocks.runWorker.mockReturnValue(pending.promise);
    const engine = useExportEngine();
    const first = engine.startExport(config);
    await engine.startExport(config);
    expect(mocks.managers).toHaveLength(1);
    expect(isPreviewSuspendedForExport()).toBe(true);
    pending.resolve({ filename: 'test.mp4' });
    await first;
    expect(isPreviewSuspendedForExport()).toBe(false);
  });

  it('terminates the failed worker and resumes preview BEFORE capture fallback', async () => {
    mocks.runWorker.mockRejectedValue(new Error('decoder crashed at 35%'));
    mocks.startCapture.mockImplementation(() => {
      expect(mocks.managers[0].dispose).toHaveBeenCalled();
      expect(isPreviewSuspendedForExport()).toBe(false);
      return { promise: Promise.resolve({ blob: new Blob(['capture']) }), cancel: vi.fn() };
    });
    await useExportEngine().startExport(config, fileHandle);
    expect(harness.state.phase).toBe('completed');
    expect(writable.write).toHaveBeenCalled();
    expect(mocks.restoreCanvas).toHaveBeenCalledTimes(1);
  });

  it.each(['cancel', 'unmount'] as const)('releases preview on %s without launching fallback', async (action) => {
    mocks.runWorker.mockImplementation((_manager, signal: AbortSignal) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new Error('AbortError')), { once: true });
    }));
    const engine = useExportEngine();
    const run = engine.startExport(config);
    if (action === 'cancel') engine.cancelExport();
    else harness.cleanups.splice(0).forEach(cleanup => cleanup());
    await run;
    expect(harness.state.phase).toBe('cancelled');
    expect(mocks.managers[0].dispose).toHaveBeenCalled();
    expect(mocks.startCapture).not.toHaveBeenCalled();
    expect(isPreviewSuspendedForExport()).toBe(false);
  });

  it('restores preview even if worker construction fails', async () => {
    mocks.constructorError = new Error('Worker unavailable');
    await useExportEngine().startExport(config);
    expect(harness.state.phase).toBe('error');
    expect(isPreviewSuspendedForExport()).toBe(false);
  });

  it('cancels capture fallback and restores the canvas without saving incomplete output', async () => {
    mocks.runWorker.mockRejectedValue(new Error('worker failed'));
    const started = deferred<void>();
    const capture = deferred<any>();
    const cancel = vi.fn(() => capture.reject(new Error('Export cancelled by user.')));
    mocks.startCapture.mockImplementation(() => { started.resolve(); return { promise: capture.promise, cancel }; });
    const engine = useExportEngine();
    const run = engine.startExport(config, fileHandle);
    await started.promise;
    engine.cancelExport();
    await run;
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(harness.state.phase).toBe('cancelled');
    expect(mocks.restoreCanvas).toHaveBeenCalledTimes(1);
    expect(writable.write).not.toHaveBeenCalled();
  });

  it('restores preview and canvas if both worker and fallback fail', async () => {
    mocks.runWorker.mockRejectedValue(new Error('worker failed'));
    mocks.startCapture.mockImplementation(() => ({ promise: Promise.reject(new Error('capture failed')), cancel: vi.fn() }));
    await useExportEngine().startExport(config, fileHandle);
    expect(harness.state.phase).toBe('error');
    expect(mocks.restoreCanvas).toHaveBeenCalledTimes(1);
    expect(isPreviewSuspendedForExport()).toBe(false);
  });
});
