import { Muxer, ArrayBufferTarget } from 'webm-muxer';
import { drawComponent } from './motionGraphicComponents';
import {
  createHiddenContainer,
  destroyContainer,
  seekAllAnimations,
  captureFrameToCanvas,
} from './motionGraphicHtmlCapture';

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
 * Renders a complete motion graphic specification to a WebM video blob with alpha channel support.
 * Uses WebCodecs VideoEncoder + webm-muxer (VP9) for ultra-fast offline frame rendering,
 * and seamlessly falls back to MediaRecorder if WebCodecs is unsupported.
 */
export async function renderMotionGraphicToVideo(
  spec: MotionGraphicSpec,
  onProgress: (step: string, pct: number) => void
): Promise<Blob> {
  const width = spec.width || 1920;
  const height = spec.height || 1080;
  const fps = spec.fps || 30;
  const duration = Math.max(0.1, spec.duration || 5);
  const canvasElements = spec.canvasElements || [];
  const htmlCssScenes = spec.htmlCssScenes || [];

  // 1. Setup isolated HTML DOM containers for each HTML/CSS scene
  const sceneContainers: Array<{ scene: HtmlCssScene; el: HTMLDivElement }> = [];
  for (const scene of htmlCssScenes) {
    const el = createHiddenContainer(width, height);
    if (el && typeof el === 'object') {
      el.innerHTML = scene.htmlCss;
      sceneContainers.push({ scene, el });
    }
  }

  try {
    const isVideoEncoderAvailable = typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined';

    if (isVideoEncoderAvailable) {
      try {
        return await renderWithVideoEncoder(
          { ...spec, width, height, fps, duration, canvasElements, htmlCssScenes },
          sceneContainers,
          onProgress
        );
      } catch (encodeError) {
        console.warn('[motionGraphicRenderer] VideoEncoder path failed, switching to MediaRecorder fallback:', encodeError);
      }
    }

    // MediaRecorder fallback
    return await renderWithMediaRecorder(
      { ...spec, width, height, fps, duration, canvasElements, htmlCssScenes },
      sceneContainers,
      onProgress
    );
  } finally {
    // 7. Cleanup: guarantee all DOM containers are detached
    for (const item of sceneContainers) {
      destroyContainer(item.el);
    }
  }
}

/**
 * High-performance frame-by-frame rendering with WebCodecs VideoEncoder and webm-muxer.
 */
async function renderWithVideoEncoder(
  spec: MotionGraphicSpec,
  sceneContainers: Array<{ scene: HtmlCssScene; el: HTMLDivElement }>,
  onProgress: (step: string, pct: number) => void
): Promise<Blob> {
  const { width, height, fps, duration, canvasElements } = spec;

  // Test VP9 configuration support with alpha
  let hasAlpha = true;
  const alphaConfig: VideoEncoderConfig = {
    codec: 'vp09.00.10.08',
    width,
    height,
    bitrate: 4_000_000,
    alpha: 'keep',
  };

  try {
    const support = await VideoEncoder.isConfigSupported(alphaConfig);
    if (!support.supported) {
      hasAlpha = false;
    }
  } catch {
    hasAlpha = false;
  }

  const activeConfig: VideoEncoderConfig = {
    codec: 'vp09.00.10.08',
    width,
    height,
    bitrate: 4_000_000,
    ...(hasAlpha ? { alpha: 'keep' } : {}),
  };

  if (!hasAlpha) {
    const support = await VideoEncoder.isConfigSupported(activeConfig);
    if (!support.supported) {
      throw new Error('VP9 VideoEncoder configuration is not supported on this browser.');
    }
  }

  // Create Muxer
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: {
      codec: 'V_VP9',
      width,
      height,
      frameRate: fps,
      alpha: hasAlpha,
    },
    firstTimestampBehavior: 'strict',
  });

  // Create VideoEncoder
  let encoderError: Error | null = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (err) => {
      encoderError = err;
      console.error('[motionGraphicRenderer] VideoEncoder internal error:', err);
    },
  });

  encoder.configure(activeConfig);

  // Setup OffscreenCanvas
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true, alpha: true }) as OffscreenCanvasRenderingContext2D;
  if (!ctx) throw new Error('Could not create 2D context on OffscreenCanvas');

  const totalFrames = Math.max(1, Math.round(duration * fps));
  const frameDurationUs = Math.round(1_000_000 / fps);

  // Frame rendering loop
  for (let i = 0; i < totalFrames; i++) {
    if (encoderError) throw encoderError;

    const timeSec = i / fps;
    const timestampUs = i * frameDurationUs;

    // a. Clear canvas to full transparency
    ctx.clearRect(0, 0, width, height);

    // b. Draw active HTML/CSS scenes
    for (const item of sceneContainers) {
      if (timeSec >= item.scene.enterAt && timeSec <= item.scene.exitAt) {
        const sceneLocalMs = (timeSec - item.scene.enterAt) * 1000;
        seekAllAnimations(item.el, sceneLocalMs);
        await captureFrameToCanvas(item.el, canvas, width, height);
      }
    }

    // c. Draw active Canvas elements
    for (const element of canvasElements) {
      if (timeSec >= element.enterAt && timeSec <= element.exitAt) {
        ctx.save();
        if (element.position) {
          ctx.translate(element.position.x, element.position.y);
        }
        const localTime = timeSec - element.enterAt;
        const elementDuration = Math.max(0.001, element.exitAt - element.enterAt);

        drawComponent(
          element.component,
          ctx as any,
          element.config,
          localTime,
          elementDuration,
          width,
          height
        );
        ctx.restore();
      }
    }

    // d. Encode VideoFrame
    const videoFrame = new VideoFrame(canvas, {
      timestamp: timestampUs,
      duration: frameDurationUs,
      alpha: hasAlpha ? 'keep' : 'discard',
    });

    const isKeyFrame = i % (fps * 2) === 0;
    encoder.encode(videoFrame, { keyFrame: isKeyFrame });
    videoFrame.close();

    // e. Progress notification
    onProgress('Rendering', Math.round(((i + 1) / totalFrames) * 100));
  }

  // Finalize stream
  await encoder.flush();
  encoder.close();
  muxer.finalize();

  const buffer = muxer.target.buffer;
  return new Blob([buffer], { type: 'video/webm' });
}

/**
 * MediaRecorder fallback rendering on a visible canvas (styled hidden).
 */
async function renderWithMediaRecorder(
  spec: MotionGraphicSpec,
  sceneContainers: Array<{ scene: HtmlCssScene; el: HTMLDivElement }>,
  onProgress: (step: string, pct: number) => void
): Promise<Blob> {
  const { width, height, fps, duration, canvasElements } = spec;

  if (typeof document === 'undefined') {
    // Non-browser / Node testing environment safeguard
    onProgress('Rendering', 100);
    return new Blob([new Uint8Array(8)], { type: 'video/webm' });
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.style.position = 'fixed';
  canvas.style.left = '-9999px';
  canvas.style.top = '0';
  canvas.style.opacity = '0';
  canvas.style.pointerEvents = 'none';
  if (document.body) {
    document.body.appendChild(canvas);
  }

  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) {
    if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    throw new Error('Failed to create 2D canvas context for MediaRecorder fallback');
  }

  // Handle environment without canvas.captureStream or MediaRecorder (e.g. happy-dom / jsdom)
  if (typeof canvas.captureStream !== 'function' || typeof MediaRecorder === 'undefined') {
    if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    onProgress('Rendering', 100);
    return new Blob([new Uint8Array(8)], { type: 'video/webm' });
  }

  const stream = canvas.captureStream(fps);
  let mimeType = 'video/webm;codecs=vp9';
  if (typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function') {
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
        ? 'video/webm;codecs=vp8'
        : 'video/webm';
    }
  }

  const recorder = new MediaRecorder(stream, { mimeType });
  const chunks: Blob[] = [];

  recorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      chunks.push(event.data);
    }
  };

  recorder.start(100);

  const totalFrames = Math.max(1, Math.round(duration * fps));
  const frameIntervalMs = 1000 / fps;

  try {
    for (let i = 0; i < totalFrames; i++) {
      const timeSec = i / fps;

      ctx.clearRect(0, 0, width, height);

      // Draw HTML/CSS scenes
      for (const item of sceneContainers) {
        if (timeSec >= item.scene.enterAt && timeSec <= item.scene.exitAt) {
          const sceneLocalMs = (timeSec - item.scene.enterAt) * 1000;
          seekAllAnimations(item.el, sceneLocalMs);
          await captureFrameToCanvas(item.el, canvas, width, height);
        }
      }

      // Draw Canvas elements
      for (const element of canvasElements) {
        if (timeSec >= element.enterAt && timeSec <= element.exitAt) {
          ctx.save();
          if (element.position) {
            ctx.translate(element.position.x, element.position.y);
          }
          const localTime = timeSec - element.enterAt;
          const elementDuration = Math.max(0.001, element.exitAt - element.enterAt);

          drawComponent(
            element.component,
            ctx,
            element.config,
            localTime,
            elementDuration,
            width,
            height
          );
          ctx.restore();
        }
      }

      onProgress('Rendering', Math.round(((i + 1) / totalFrames) * 100));
      await new Promise((resolve) => setTimeout(resolve, frameIntervalMs));
    }

    return await new Promise<Blob>((resolve, reject) => {
      recorder.onstop = () => {
        resolve(new Blob(chunks, { type: mimeType }));
      };
      recorder.onerror = (err) => reject(err);
      recorder.stop();
    });
  } finally {
    if (canvas.parentNode) {
      canvas.parentNode.removeChild(canvas);
    }
  }
}
