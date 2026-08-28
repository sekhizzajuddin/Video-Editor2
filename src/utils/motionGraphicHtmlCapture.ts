/**
 * HTML/CSS capture helpers for the generative motion graphics pipeline.
 *
 * These are thin, backwards-compatible wrappers around
 * `./cssSceneRasterizer`, which owns the actual strategy (freeze CSS animations
 * with a negative `animation-delay` + `animation-play-state: paused`, serialize
 * into an SVG `foreignObject`, then rasterize onto a canvas).
 *
 * The Web Animations based `seekAllAnimations()` below is still the right tool
 * for **live** documents (e.g. the on-screen iframe preview): those keep their
 * animation timeline, so scrubbing `currentTime` works there. It is *not*
 * sufficient for the SVG-image rasterization path, because serialization resets
 * every animation to t=0 — see cssSceneRasterizer for the full explanation.
 */

import {
  SceneStage,
  createSceneStage,
  destroySceneStage,
  captureSceneFrame,
  rasterizeSvgToCanvas,
  serializeSceneStage,
  seekSceneStage,
} from './cssSceneRasterizer';

export type { SceneStage };

export interface HiddenContainerOptions {
  width: number;
  height: number;
  transparent?: boolean;
}

/**
 * Creates an off-screen, isolated DOM container for rendering HTML/CSS motion
 * graphics scenes and wraps it in a seekable `SceneStage`.
 */
export function createHiddenContainer(width: number, height: number): HTMLDivElement;
export function createHiddenContainer(
  width: number,
  height: number,
  options: HiddenContainerOptions & { asStage: true }
): SceneStage | null;
export function createHiddenContainer(
  width: number,
  height: number,
  options?: HiddenContainerOptions & { asStage?: boolean }
): HTMLDivElement | SceneStage | null {
  if (typeof document === 'undefined') {
    return { style: {} } as HTMLDivElement;
  }

  if (options?.asStage) {
    return createSceneStage('', {
      width,
      height,
      transparent: options.transparent !== false,
    });
  }

  const stage = createSceneStage('', {
    width,
    height,
    transparent: options?.transparent !== false,
  });
  return stage ? stage.el : ({ style: {} } as HTMLDivElement);
}

/** Removes and cleans up an off-screen container from the DOM. */
export function destroyContainer(container: HTMLDivElement | SceneStage | null | undefined): void {
  if (!container) return;
  if ((container as SceneStage).el) {
    destroySceneStage(container as SceneStage);
    return;
  }
  const el = container as HTMLDivElement;
  if (el.parentNode) el.parentNode.removeChild(el);
}

/**
 * Scrubs every CSS / Web Animation in the container's subtree to `timeMs`.
 *
 * NOTE: this only affects the live DOM. Use `seekSceneStage()` (or
 * `captureSceneFrame()`) before serializing to an SVG image.
 */
export function seekAllAnimations(container: HTMLElement, timeMs: number): void {
  if (!container) return;
  try {
    if (typeof container.getAnimations === 'function') {
      const animations = container.getAnimations({ subtree: true });
      for (const anim of animations) {
        try {
          anim.pause();
          anim.currentTime = timeMs;
        } catch {
          // Individual animation does not support currentTime seeking.
        }
      }
    }
  } catch (err) {
    console.warn('[motionGraphicHtmlCapture] seekAllAnimations warning:', err);
  }
}

/**
 * Serializes the container's HTML/CSS into an SVG foreignObject, decodes it into
 * an image and draws it onto the target canvas.
 *
 * When `timeSec` is supplied the stage is seeked first, which is what makes
 * per-frame capture produce *different* frames instead of a frozen one.
 */
export async function captureFrameToCanvas(
  container: HTMLElement | SceneStage,
  targetCanvas: OffscreenCanvas | HTMLCanvasElement,
  width: number,
  height: number,
  timeSec?: number
): Promise<void> {
  if (
    typeof document === 'undefined' ||
    typeof Image === 'undefined' ||
    typeof URL === 'undefined' ||
    !container
  ) {
    return;
  }

  // Fast path: a real SceneStage (animations already indexed).
  const stage = container as SceneStage;
  if (stage.el && stage.seekStyle !== undefined) {
    if (typeof timeSec === 'number') seekSceneStage(stage, timeSec);
    const ok = await rasterizeSvgToCanvas(
      serializeSceneStage(stage),
      targetCanvas,
      width || stage.width,
      height || stage.height
    );
    if (!ok) drawCaptureFallback(targetCanvas, width, height);
    return;
  }

  // Legacy path: a bare HTMLElement. Wrap it in a temporary stage so the same
  // sanitising / serialization rules apply, then draw.
  const temp = createSceneStage((container as HTMLElement).innerHTML || '', {
    width,
    height,
    transparent: false,
  });
  try {
    if (!temp) {
      drawCaptureFallback(targetCanvas, width, height);
      return;
    }
    const ok = await captureSceneFrame(temp, targetCanvas, timeSec ?? 0);
    if (!ok) drawCaptureFallback(targetCanvas, width, height);
  } finally {
    destroySceneStage(temp);
  }
}

function drawCaptureFallback(
  targetCanvas: OffscreenCanvas | HTMLCanvasElement,
  width: number,
  height: number
): void {
  try {
    const ctx = targetCanvas.getContext('2d') as
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D
      | null;
    if (!ctx || typeof ctx.save !== 'function') return;
    ctx.save();
    ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.fillRect(10, 10, Math.max(0, width - 20), Math.max(0, height - 20));
    ctx.strokeRect(10, 10, Math.max(0, width - 20), Math.max(0, height - 20));
    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('HTML Scene render fallback', 30, 50);
    ctx.restore();
  } catch {
    /* ignore */
  }
}
