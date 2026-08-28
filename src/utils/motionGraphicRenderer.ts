import { Muxer, ArrayBufferTarget } from 'webm-muxer';
import { drawComponent } from './motionGraphicComponents';
import {
  SceneStage,
  SeekMode,
  createSceneStage,
  destroySceneStage,
  captureSceneFrame,
  probeCaptureCapabilities,
} from './cssSceneRasterizer';

export interface MotionGraphicSpec {
  width: number;
  height: number;
  fps: number;
  duration: number;
  canvasElements: CanvasElement[];
  htmlCssScenes: HtmlCssScene[];
}

export interface CanvasElement {
  component: string;
  enterAt: number;
  exitAt: number;
  config: Record<string, any>;
  position?: { x: number; y: number };
}

export interface HtmlCssScene {
  enterAt: number;
  exitAt: number;
  description: string;
  htmlCss: string;
}

/**
 * How the rendered overlay carries transparency.
 *
 * - `alpha`   → real VP9 alpha channel WebM (best: perfect edges, no keying).
 * - `key`     → opaque WebM rendered over `keyColor`; the caller attaches a
 *               chroma-key effect to the clip so the colour is removed at
 *               composite time (fallback for browsers without VP9 alpha).
 * - `opaque`  → no transparency at all (last-resort MediaRecorder path).
 */
export type MotionAlphaMode = 'alpha' | 'key' | 'opaque';

export const MOTION_KEY_COLOR = '#ff00ff';

export interface MotionGraphicRenderOptions {
  width?: number;
  height?: number;
  fps?: number;
  duration?: number;
  /** Strip full-frame backdrops from HTML scenes (default true). */
  transparent?: boolean;
  /** Force a specific transparency strategy instead of auto-detecting. */
  alphaMode?: MotionAlphaMode;
  keyColor?: string;
  signal?: AbortSignal;
}

export interface MotionGraphicVideo {
  blob: Blob;
  alphaMode: MotionAlphaMode;
  keyColor: string | null;
  width: number;
  height: number;
  fps: number;
  duration: number;
  frameCount: number;
  sceneCount: number;
  /** False when the engine cannot rasterize *animated* CSS in SVG images. */
  cssAnimationSupport: boolean;
  /** Strategy actually used to bake the animation into each frame. */
  seekMode: SeekMode;
  /** How many opaque full-frame backdrops were removed for transparency. */
  strippedBackdrops: number;
}

interface SceneRuntime {
  scene: HtmlCssScene;
  stage: SceneStage;
}

/**
 * Renders a complete motion graphic specification to a WebM blob.
 *
 * Pipeline per frame:
 *   1. clear (or fill with the key colour)
 *   2. rasterize every active HTML/CSS scene, seeked to that exact time
 *   3. draw every active canvas component
 *   4. encode (WebCodecs VP9, alpha when supported) → WebM via webm-muxer
 *
 * Falls back to MediaRecorder (key-colour composite) when WebCodecs is missing.
 */
export async function renderMotionGraphicToVideo(
  spec: MotionGraphicSpec,
  onProgress: (step: string, pct: number) => void,
  options: MotionGraphicRenderOptions = {}
): Promise<MotionGraphicVideo> {
  const width = Math.round(options.width || spec.width || 1920);
  const height = Math.round(options.height || spec.height || 1080);
  const fps = Math.max(1, Math.round(options.fps || spec.fps || 30));
  const duration = Math.max(0.1, options.duration || spec.duration || 5);
  const canvasElements = spec.canvasElements || [];
  const htmlCssScenes = spec.htmlCssScenes || [];
  const transparent = options.transparent !== false;

  // 1. Build isolated DOM stages for each HTML/CSS scene.
  const scenes: SceneRuntime[] = [];
  let strippedBackdrops = 0;
  for (const scene of htmlCssScenes) {
    if (!scene.htmlCss || !scene.htmlCss.trim()) continue;
    const stage = createSceneStage(scene.htmlCss, { width, height, transparent });
    if (!stage) continue;
    strippedBackdrops += stage.strippedBackdrops;
    scenes.push({ scene, stage });
  }

  // Pick the baking strategy once: native paused-CSS when the engine animates
  // SVG images, our own @keyframes evaluator when it only rasterizes them, and
  // a single finished frame when it can't rasterize them at all.
  const capabilities = scenes.some((s) => s.stage.hasAnimations)
    ? await probeCaptureCapabilities()
    : ({ svgOk: true, cssAnimOk: true, mode: 'css' } as const);
  const seekMode: SeekMode = capabilities.mode;

  const normalized: MotionGraphicSpec = {
    width,
    height,
    fps,
    duration,
    canvasElements,
    htmlCssScenes,
  };

  try {
    const isVideoEncoderAvailable =
      typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined';

    if (isVideoEncoderAvailable) {
      try {
        return await renderWithVideoEncoder(normalized, scenes, onProgress, {
          ...options,
          transparent,
          seekMode,
          capabilities,
          strippedBackdrops,
        });
      } catch (encodeError: any) {
        if (options.signal?.aborted) throw encodeError;
        console.warn(
          '[motionGraphicRenderer] VideoEncoder path failed, switching to MediaRecorder fallback:',
          encodeError
        );
      }
    }

    return await renderWithMediaRecorder(normalized, scenes, onProgress, {
      ...options,
      transparent,
      seekMode,
      capabilities,
      strippedBackdrops,
    });
  } finally {
    for (const item of scenes) destroySceneStage(item.stage);
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Frame composition (shared by both backends)
 * ────────────────────────────────────────────────────────────────────────── */

/** Per-scene cache of already rasterized *static* (animation-free) scenes. */
type StaticSceneCache = Map<number, OffscreenCanvas | HTMLCanvasElement>;

async function paintFrame(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  spec: MotionGraphicSpec,
  scenes: SceneRuntime[],
  timeSec: number,
  alphaMode: MotionAlphaMode,
  keyColor: string,
  seekMode: SeekMode,
  staticCache?: StaticSceneCache
): Promise<void> {
  const { width, height, canvasElements } = spec;

  ctx.clearRect(0, 0, width, height);

  // (a) Backing plate only when we cannot encode a real alpha channel.
  if (alphaMode !== 'alpha') {
    ctx.save();
    ctx.fillStyle = alphaMode === 'key' ? keyColor : '#000000';
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  // (b) HTML/CSS scenes — the actual "Vox style" vector animation.
  for (let i = 0; i < scenes.length; i++) {
    const item = scenes[i];
    if (timeSec < item.scene.enterAt || timeSec > item.scene.exitAt) continue;
    // Engines that can't rasterize the SVG at all get the scene's finished
    // state, so the overlay shows the complete artwork instead of a blank frame.
    const localTime =
      seekMode === 'static'
        ? Math.max(1, item.scene.exitAt - item.scene.enterAt) + 60
        : timeSec - item.scene.enterAt;

    if (!item.stage.hasAnimations) {
      // Nothing moves: rasterize once and blit the cached bitmap every frame
      // instead of re-serializing the same markup hundreds of times.
      let cached = staticCache?.get(i);
      if (!cached && typeof OffscreenCanvas !== 'undefined') {
        cached = new OffscreenCanvas(width, height);
        await captureSceneFrame(item.stage, cached, 0, seekMode);
        staticCache?.set(i, cached);
      }
      if (cached) {
        ctx.drawImage(cached as CanvasImageSource, 0, 0, width, height);
        continue;
      }
    }

    await captureSceneFrame(
      item.stage,
      ctx.canvas as OffscreenCanvas | HTMLCanvasElement,
      localTime,
      seekMode
    );
  }

  // (c) Canvas 2D components (KineticWord, VectorShape, …).
  for (const element of canvasElements) {
    if (timeSec < element.enterAt || timeSec > element.exitAt) continue;
    ctx.save();
    if (element.position) {
      ctx.translate(element.position.x, element.position.y);
    }
    const localTime = timeSec - element.enterAt;
    const elementDuration = Math.max(0.001, element.exitAt - element.enterAt);
    try {
      drawComponent(
        element.component,
        ctx as any,
        element.config,
        localTime,
        elementDuration,
        width,
        height
      );
    } catch (err) {
      console.warn(`[motionGraphicRenderer] Component "${element.component}" failed:`, err);
    }
    ctx.restore();
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * WebCodecs backend
 * ────────────────────────────────────────────────────────────────────────── */

async function waitForEncoderSlot(encoder: VideoEncoder, limit = 8): Promise<void> {
  if (encoder.encodeQueueSize <= limit) return;
  await new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      encoder.removeEventListener('dequeue', onDequeue);
      clearTimeout(timer);
      resolve();
    };
    const onDequeue = () => {
      if (encoder.encodeQueueSize <= limit) finish();
    };
    const timer = setTimeout(finish, 60);
    encoder.addEventListener('dequeue', onDequeue);
  });
}

async function renderWithVideoEncoder(
  spec: MotionGraphicSpec,
  scenes: SceneRuntime[],
  onProgress: (step: string, pct: number) => void,
  options: MotionGraphicRenderOptions & {
    seekMode: SeekMode;
    capabilities: { svgOk: boolean; cssAnimOk: boolean; mode: SeekMode };
    strippedBackdrops: number;
  }
): Promise<MotionGraphicVideo> {
  const { width, height, fps, duration } = spec;

  // Pick the best codec configuration this browser actually supports.
  const candidateCodecs = ['vp09.00.41.08', 'vp09.00.40.08', 'vp09.00.10.08', 'vp8'];
  let hasAlpha = false;
  let selectedCodec = 'vp09.00.41.08';
  let configured = false;

  // The caller may pin a strategy; otherwise prefer a real alpha channel.
  const requestedAlpha = options.alphaMode ? options.alphaMode === 'alpha' : true;

  if (requestedAlpha) {
    for (const codec of candidateCodecs) {
      try {
        const support = await VideoEncoder.isConfigSupported({
          codec,
          width,
          height,
          bitrate: 8_000_000,
          alpha: 'keep',
        });
        if (support.supported) {
          selectedCodec = codec;
          hasAlpha = true;
          configured = true;
          break;
        }
      } catch {
        /* try next */
      }
    }
  }

  if (!configured) {
    for (const codec of candidateCodecs) {
      try {
        const support = await VideoEncoder.isConfigSupported({
          codec,
          width,
          height,
          bitrate: 8_000_000,
        });
        if (support.supported) {
          selectedCodec = codec;
          configured = true;
          break;
        }
      } catch {
        /* try next */
      }
    }
  }

  if (!configured) {
    throw new Error('No supported VP9/VP8 VideoEncoder configuration on this browser.');
  }

  const alphaMode: MotionAlphaMode = hasAlpha ? 'alpha' : 'key';
  const keyColor = options.keyColor || MOTION_KEY_COLOR;

  const activeConfig: VideoEncoderConfig = {
    codec: selectedCodec,
    width,
    height,
    bitrate: 8_000_000,
    ...(hasAlpha ? { alpha: 'keep' } : {}),
  };

  const support = await VideoEncoder.isConfigSupported(activeConfig);
  if (!support.supported) {
    throw new Error('VideoEncoder configuration is not supported on this browser.');
  }

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: {
      codec: selectedCodec.startsWith('vp8') ? 'V_VP8' : 'V_VP9',
      width,
      height,
      frameRate: fps,
      alpha: hasAlpha,
    },
    firstTimestampBehavior: 'strict',
  });

  let encoderError: Error | null = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (err) => {
      encoderError = err;
      console.error('[motionGraphicRenderer] VideoEncoder internal error:', err);
    },
  });

  encoder.configure(activeConfig);

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d', {
    willReadFrequently: false,
    alpha: true,
  }) as OffscreenCanvasRenderingContext2D | null;
  if (!ctx) {
    encoder.close();
    throw new Error('Could not create 2D context on OffscreenCanvas');
  }

  const totalFrames = Math.max(1, Math.round(duration * fps));
  const frameDurationUs = Math.round(1_000_000 / fps);
  const staticCache: StaticSceneCache = new Map();

  try {
    for (let i = 0; i < totalFrames; i++) {
      if (options.signal?.aborted) {
        throw new DOMException('Render aborted', 'AbortError');
      }
      if (encoderError) throw encoderError;

      const timeSec = Math.min(duration, i / fps);

      await paintFrame(
        ctx,
        spec,
        scenes,
        timeSec,
        alphaMode,
        keyColor,
        options.seekMode,
        staticCache
      );

      const videoFrame = new VideoFrame(canvas, {
        timestamp: i * frameDurationUs,
        duration: frameDurationUs,
        alpha: hasAlpha ? 'keep' : 'discard',
      });

      const isKeyFrame = i % (fps * 2) === 0;
      encoder.encode(videoFrame, { keyFrame: isKeyFrame });
      videoFrame.close();

      await waitForEncoderSlot(encoder);

      // Keep the UI thread responsive during long renders.
      if (i % 6 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      onProgress('Rendering', Math.round(((i + 1) / totalFrames) * 100));
    }

    await encoder.flush();
    if (encoderError) throw encoderError;
  } finally {
    try {
      if (encoder.state !== 'closed') encoder.close();
    } catch {
      /* ignore */
    }
  }

  muxer.finalize();
  const buffer = muxer.target.buffer;

  return {
    blob: new Blob([buffer], { type: 'video/webm' }),
    alphaMode,
    keyColor: alphaMode === 'key' ? keyColor : null,
    width,
    height,
    fps,
    duration,
    frameCount: totalFrames,
    sceneCount: scenes.length,
    cssAnimationSupport: options.capabilities.cssAnimOk,
    seekMode: options.seekMode,
    strippedBackdrops: options.strippedBackdrops,
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * MediaRecorder fallback
 * ────────────────────────────────────────────────────────────────────────── */

async function renderWithMediaRecorder(
  spec: MotionGraphicSpec,
  scenes: SceneRuntime[],
  onProgress: (step: string, pct: number) => void,
  options: MotionGraphicRenderOptions & {
    seekMode: SeekMode;
    capabilities: { svgOk: boolean; cssAnimOk: boolean; mode: SeekMode };
    strippedBackdrops: number;
  }
): Promise<MotionGraphicVideo> {
  const { width, height, fps, duration } = spec;

  const empty = (frameCount: number, sceneCount: number): MotionGraphicVideo => ({
    blob: new Blob([new Uint8Array(8)], { type: 'video/webm' }),
    alphaMode: 'opaque',
    keyColor: null,
    width,
    height,
    fps,
    duration,
    frameCount,
    sceneCount,
    cssAnimationSupport: options.capabilities.cssAnimOk,
    seekMode: options.seekMode,
    strippedBackdrops: options.strippedBackdrops,
  });

  if (typeof document === 'undefined') {
    onProgress('Rendering', 100);
    return empty(0, scenes.length);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.style.position = 'fixed';
  canvas.style.left = '-9999px';
  canvas.style.top = '0';
  canvas.style.opacity = '0';
  canvas.style.pointerEvents = 'none';

  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) {
    throw new Error('Failed to create 2D canvas context for MediaRecorder fallback');
  }

  // Environment without captureStream/MediaRecorder (jsdom, happy-dom, SSR).
  if (typeof canvas.captureStream !== 'function' || typeof MediaRecorder === 'undefined') {
    onProgress('Rendering', 100);
    return empty(0, scenes.length);
  }

  if (document.body) document.body.appendChild(canvas);

  // MediaRecorder cannot carry an alpha channel, so the scene is baked over the
  // key colour and the caller chroma-keys it back out at composite time.
  const alphaMode: MotionAlphaMode = 'key';
  const keyColor = options.keyColor || MOTION_KEY_COLOR;

  const stream = canvas.captureStream(fps);
  let mimeType = 'video/webm;codecs=vp9';
  if (typeof MediaRecorder.isTypeSupported === 'function') {
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
        ? 'video/webm;codecs=vp8'
        : 'video/webm';
    }
  }

  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) chunks.push(event.data);
  };

  const totalFrames = Math.max(1, Math.round(duration * fps));
  const frameIntervalMs = 1000 / fps;
  const staticCache: StaticSceneCache = new Map();

  recorder.start(100);

  try {
    for (let i = 0; i < totalFrames; i++) {
      if (options.signal?.aborted) {
        throw new DOMException('Render aborted', 'AbortError');
      }
      const timeSec = Math.min(duration, i / fps);
      await paintFrame(
        ctx,
        spec,
        scenes,
        timeSec,
        alphaMode,
        keyColor,
        options.seekMode,
        staticCache
      );
      onProgress('Rendering', Math.round(((i + 1) / totalFrames) * 100));
      await new Promise((resolve) => setTimeout(resolve, frameIntervalMs));
    }

    const blob = await new Promise<Blob>((resolve, reject) => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
      recorder.onerror = (err) => reject(err);
      recorder.stop();
    });

    return {
      blob,
      alphaMode,
      keyColor,
      width,
      height,
      fps,
      duration,
      frameCount: totalFrames,
      sceneCount: scenes.length,
      cssAnimationSupport: options.capabilities.cssAnimOk,
      seekMode: options.seekMode,
      strippedBackdrops: options.strippedBackdrops,
    };
  } finally {
    if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    for (const track of stream.getTracks()) track.stop();
  }
}
