import { useEditorStore } from '../store/editorStore';
import { synchronousSeek } from '../hooks/useMediaPlayback';
import { ExportProgress } from './types';

export interface FrameCaptureOptions {
  canvas: HTMLCanvasElement;
  startAt: number;
  endAt: number;
  fps: number;
  onProgress?: (progress: ExportProgress) => void;
  shouldCancel?: () => boolean;
}

/**
 * Deterministic frame streaming generator for high-precision video encoding.
 * Steals timeline control, seeks synchronously per frame, forces canvas redraws, and yields
 * native VideoFrames one by one to prevent Out-Of-Memory (OOM) accumulation during 4K exports.
 */
export async function* streamCapturedFrames(opts: FrameCaptureOptions): AsyncGenerator<VideoFrame, void, unknown> {
  const store = useEditorStore.getState();
  const totalDuration = Math.max(0.1, opts.endAt - opts.startAt);
  const totalFrames = Math.ceil(totalDuration * opts.fps);

  // Ensure normal playback is paused during offline rendering
  if (store.isPlaying) {
    store.pause();
  }
  if (!store.isExporting) {
    store.setIsExporting(true);
  }

  // Seek to initial start position
  await synchronousSeek(opts.startAt);
  window.dispatchEvent(new CustomEvent('procut-frame-updated'));
  await yieldToEventLoop(20);

  for (let i = 0; i < totalFrames; i++) {
    if (opts.shouldCancel && opts.shouldCancel()) {
      break;
    }

    const t = Math.min(opts.endAt, opts.startAt + i / opts.fps);
    
    // Synchronously wait for hardware decode of video elements at timestamp t
    await synchronousSeek(t);
    
    // Notify canvas engine to paint the decoded frame onto the offscreen target
    window.dispatchEvent(new CustomEvent('procut-frame-updated'));
    await yieldToEventLoop(0); // Yield to macro-task queue for canvas flush

    const timestampUs = Math.floor((i * 1_000_000) / opts.fps);
    const durationUs = Math.floor(1_000_000 / opts.fps);

    if (typeof window.VideoFrame !== 'undefined') {
      const frame = new VideoFrame(opts.canvas, {
        timestamp: timestampUs,
        duration: durationUs,
      });
      yield frame;
    }

    if (opts.onProgress) {
      const percentage = Math.min(99, Math.floor(((i + 1) / totalFrames) * 100));
      opts.onProgress({
        stage: 'capturing',
        percentage,
        message: `Rendering frames (${i + 1}/${totalFrames})...`
      });
    }

    // Release CPU thread periodically to prevent browser UI freezing / watchdog timeout
    if (i % 15 === 0) {
      await yieldToEventLoop(0);
    }
  }

  // Restore timeline position to start
  await synchronousSeek(opts.startAt);
  window.dispatchEvent(new CustomEvent('procut-frame-updated'));

  // BUG FIX: nothing in the entire export stack ever cleared this flag, so
  // after the first canvas-capture export the preview RAF loop stayed stuck in
  // "export stepping" mode and (pre-fix) the canvas buffer stayed at the
  // hard-coded 854×480 landscape defaults forever. Leave export mode once the
  // frame stream is done. (promoteCanvasToExportSize also restores it, this is
  // a belt-and-braces guard for callers that skip the util.)
  useEditorStore.getState().setIsExporting(false);
}

function yieldToEventLoop(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
