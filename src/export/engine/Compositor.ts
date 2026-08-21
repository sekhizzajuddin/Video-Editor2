import { RenderLayer, FrameOverlay } from './FrameScheduler';
import { ExportWorkerConfig } from './export.worker';
import {
  applyColorGradingWheelsOnData,
  applyFxEffect,
  applyColorOverlays,
} from '@/utils/canvasEffects';
import { applyLutToCanvas } from '@/utils/lutParser';
import { applyCurvesToImageData as applyCurves, buildCurveLUT as buildLUT, isCurveActive as isCurveOn } from '@/utils/curvesEngine';
import { applyVectorMaskToContext } from '@/utils/vectorMaskEngine';
import { renderParticlesDeterministic } from './exportEffects';
import { applyAdjustmentLayerPass } from '@/utils/adjustmentLayerEngine';
import { drawPerspectiveTexture, getProjectedCorners } from '@/utils/canvasEffects';
import { generateObjectRemovalInpaint } from '@/utils/objectRemoval';
import { applyPreRenderedMaskIfAvailable, preRenderedMaskCache } from '@/utils/aiBackground';

const IDENTITY_CURVE_LUT = (() => {
  const lut = new Uint8ClampedArray(256);
  for (let i = 0; i < 256; i++) lut[i] = i;
  return lut;
})();

const vertexShaderSource = `#version 300 es
layout(location = 0) in vec2 a_position;
layout(location = 1) in vec2 a_texCoord;
out vec2 v_texCoord;

uniform mat3 u_matrix;

void main() {
  vec3 position = u_matrix * vec3(a_position, 1.0);
  gl_Position = vec4(position.xy, 0.0, 1.0);
  v_texCoord = a_texCoord;
}
`;

const fragmentShaderSource = `#version 300 es
precision highp float;

in vec2 v_texCoord;
out vec4 outColor;

uniform sampler2D u_image;
uniform float u_opacity;

// Chroma key uniforms
uniform bool u_chromaKeyEnabled;
uniform vec3 u_keyColor;
uniform float u_threshold;
uniform float u_softness;
uniform float u_spillSuppression;
uniform int u_keyType; // 0=none, 1=green, 2=blue

vec3 rgb2yuv(vec3 rgb) {
    float y = 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;
    float u = -0.1687 * rgb.r - 0.3313 * rgb.g + 0.5 * rgb.b + 128.0/255.0;
    float v = 0.5 * rgb.r - 0.4187 * rgb.g - 0.0813 * rgb.b + 128.0/255.0;
    return vec3(y, u, v);
}

void main() {
    vec4 texColor = texture(u_image, v_texCoord);
    if (!u_chromaKeyEnabled) {
        outColor = texColor * u_opacity;
        return;
    }

    vec3 yuv = rgb2yuv(texColor.rgb);
    vec3 keyYuv = rgb2yuv(u_keyColor);
    
    // Calculate distance in UV space
    float dist = distance(yuv.yz, keyYuv.yz) * 255.0;
    float th = u_threshold * 2.4;
    float soft = u_softness * 2.4;
    
    float alpha = 1.0;
    if (dist < th) {
        alpha = 0.0;
    } else if (dist < th + soft && soft > 0.0) {
        alpha = (dist - th) / soft;
    }
    
    // Spill suppression
    vec3 outRgb = texColor.rgb;
    if (u_spillSuppression > 0.0) {
        float r = outRgb.r * 255.0;
        float g = outRgb.g * 255.0;
        float b = outRgb.b * 255.0;
        
        if (u_keyType == 1) { // Green Screen
            float gSpill = max(0.0, g - max(r, b)) * (u_spillSuppression / 100.0);
            g = max(0.0, g - gSpill);
            r = min(255.0, r + gSpill * 0.25);
            b = min(255.0, b + gSpill * 0.25);
        } else if (u_keyType == 2) { // Blue Screen
            float bSpill = max(0.0, b - max(r, g)) * (u_spillSuppression / 100.0);
            b = max(0.0, b - bSpill);
            r = min(255.0, r + bSpill * 0.25);
            g = min(255.0, g + bSpill * 0.25);
        }
        outRgb = vec3(r/255.0, g/255.0, b/255.0);
    }
    
    // Pre-multiply alpha
    outColor = vec4(outRgb * alpha, texColor.a * alpha) * u_opacity;
}
`;

export class Compositor {
  private canvas: OffscreenCanvas;
  private ctx: OffscreenCanvasRenderingContext2D;
  private aspectRatio: string;

  // WebGL-based VideoFrame converter — handles NV12/YUV→RGBA on the GPU.
  private glCanvas: OffscreenCanvas | null = null;
  private gl: WebGL2RenderingContext | null = null;
  private glProgram: WebGLProgram | null = null;
  private glTexture: WebGLTexture | null = null;

  constructor(canvas: OffscreenCanvas, aspectRatio: string = '16:9') {
    this.canvas = canvas;
    this.aspectRatio = aspectRatio;
    this.ctx = canvas.getContext('2d', { alpha: false }) as OffscreenCanvasRenderingContext2D;
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';
  }

  /**
   * Width/height of the UI preview coordinate space for the current aspect
   * ratio. Clip transforms (x/y) and text font sizes are authored in this
   * space, so export rendering scales them by canvas/view.
   */
  private getViewSize(): { viewW: number; viewH: number } {
    let viewW = 854;
    const viewH = 480;
    if (this.aspectRatio === '9:16') {
      viewW = Math.round(480 * (9 / 16));
    } else if (this.aspectRatio === '1:1') {
      viewW = 480;
    } else if (this.aspectRatio === '4:3') {
      viewW = Math.round(480 * (4 / 3));
    }
    return { viewW, viewH };
  }

  /**
   * Lazily initialise a WebGL2 context used solely to convert VideoFrame
   * pixels (which may be in NV12 / I420 on Windows hardware decoders) into
   * an RGBA ImageBitmap that the 2D compositing canvas can draw.
   */
  private initWebGLConverter(): boolean {
    if (this.gl) return true;            // already initialised
    try {
      this.glCanvas = new OffscreenCanvas(1, 1);
      const gl = this.glCanvas.getContext('webgl2', {
        alpha: true,
        premultipliedAlpha: false,
        preserveDrawingBuffer: true,
      }) as WebGL2RenderingContext | null;
      if (!gl) return false;

      // ---- Vertex shader: fullscreen triangle from gl_VertexID ----
      const vsSrc = `#version 300 es
      void main() {
        // Generates a triangle that covers [-1,1] clip space.
        float x = float((gl_VertexID & 1) << 2) - 1.0;
        float y = float((gl_VertexID & 2) << 1) - 1.0;
        gl_Position = vec4(x, y, 0.0, 1.0);
      }`;

      // ---- Fragment shader: sample texture at screen UV ----
      const fsSrc = `#version 300 es
      precision mediump float;
      uniform sampler2D u_tex;
      out vec4 outColor;
      void main() {
        vec2 uv = gl_FragCoord.xy / vec2(textureSize(u_tex, 0));
        // Flip Y — framebuffer origin is bottom-left, video origin is top-left.
        uv.y = 1.0 - uv.y;
        outColor = texture(u_tex, uv);
      }`;

      const compile = (type: number, src: string): WebGLShader | null => {
        const s = gl.createShader(type);
        if (!s) return null;
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
          console.warn('[Compositor] Shader compile error:', gl.getShaderInfoLog(s));
          gl.deleteShader(s);
          return null;
        }
        return s;
      };

      const vs = compile(gl.VERTEX_SHADER, vsSrc);
      const fs = compile(gl.FRAGMENT_SHADER, fsSrc);
      if (!vs || !fs) return false;

      const prog = gl.createProgram()!;
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        console.warn('[Compositor] Program link error:', gl.getProgramInfoLog(prog));
        return false;
      }
      // Shaders are baked into the program, safe to delete handles.
      gl.deleteShader(vs);
      gl.deleteShader(fs);

      const tex = gl.createTexture();
      if (!tex) return false;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

      this.gl = gl;
      this.glProgram = prog;
      this.glTexture = tex;
      return true;
    } catch (e) {
      console.warn('[Compositor] WebGL converter init failed:', e);
      return false;
    }
  }

  /**
   * Convert a VideoFrame to an ImageBitmap via WebGL2.  texImage2D accepts
   * VideoFrame as a source and performs NV12/I420/RGBA → RGBA conversion
   * entirely on the GPU, avoiding the black-frame bug that plagues 2D-canvas
   * drawImage / createImageBitmap on Windows hardware-decoded frames.
   */
  private convertFrameWebGL(frame: VideoFrame): ImageBitmap | null {
    if (!this.initWebGLConverter()) return null;
    const gl = this.gl!;
    const canvas = this.glCanvas!;

    const w = frame.displayWidth  || (frame as any).codedWidth  || 1920;
    const h = frame.displayHeight || (frame as any).codedHeight || 1080;

    // Resize the converter canvas to match the frame.
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width  = w;
      canvas.height = h;
    }
    gl.viewport(0, 0, w, h);

    // Upload the VideoFrame as a texture (GPU-side YUV→RGBA).
    gl.bindTexture(gl.TEXTURE_2D, this.glTexture!);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, frame as any);

    gl.useProgram(this.glProgram!);
    gl.uniform1i(gl.getUniformLocation(this.glProgram!, 'u_tex'), 0);

    gl.drawArrays(gl.TRIANGLES, 0, 3);

    return canvas.transferToImageBitmap();
  }

  /**
   * Resolve a CanvasImageSource that is safe to draw in a 2D context.
   * - If the source is a VideoFrame (e.g. from mediabunny off-main-thread path
   *   that bypassed CanvasSink), we convert it via WebGL (GPU YUV→RGBA) or
   *   via createImageBitmap as fallback — drawing VideoFrame directly onto
   *   OffscreenCanvas 2D is black on Windows hardware decoders.
   * - OffscreenCanvas / ImageBitmap / HTMLCanvasElement are returned as-is.
   */
  private async resolveDrawable(frame: CanvasImageSource | VideoFrame): Promise<{ drawable: CanvasImageSource, cleanup: (() => void) | null }> {
    const anyFrame = frame as any;
    // Detect VideoFrame by presence of codedWidth/codedHeight or class name
    const isVideoFrame = typeof VideoFrame !== 'undefined' && frame instanceof VideoFrame;
    if (!isVideoFrame) {
      return { drawable: frame as CanvasImageSource, cleanup: null };
    }
    const vf = frame as VideoFrame;
    // Try WebGL converter first (avoids black NV12 frames)
    try {
      const bmp = this.convertFrameWebGL(vf);
      if (bmp) {
        return { drawable: bmp, cleanup: () => { try { bmp.close(); } catch {} } };
      }
    } catch {}
    // Fallback: createImageBitmap is widely supported in workers and handles
    // VideoFrame → RGBA conversion.
    try {
      const bmp2 = await createImageBitmap(vf);
      return { drawable: bmp2, cleanup: () => { try { bmp2.close(); } catch {} } };
    } catch {
      // Last resort: return the VideoFrame itself — may be black on some drivers
      return { drawable: vf as unknown as CanvasImageSource, cleanup: null };
    }
  }

  public async render(layers: RenderLayer[], overlays: FrameOverlay[] = []) {
    // Fill background
    this.ctx.fillStyle = '#0a0a0a';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Separate adjustment layers from content layers
    const contentLayers = layers.filter(l => l.type !== 'adjustment');
    const adjustmentLayers = layers.filter(l => l.type === 'adjustment');

    // Two-pass approach if adjustment layers exist:
    // 1. Render all content layers to an intermediate canvas
    // 2. Apply adjustment layer passes over the composited result
    const needsIntermediate = adjustmentLayers.length > 0;
    
    let targetCtx: OffscreenCanvasRenderingContext2D = this.ctx;
    let tempCanvas: OffscreenCanvas | null = null;
    
    if (needsIntermediate) {
      tempCanvas = new OffscreenCanvas(this.canvas.width, this.canvas.height);
      const tempCtx = tempCanvas.getContext('2d', { alpha: true }) as OffscreenCanvasRenderingContext2D;
      tempCtx.fillStyle = '#0a0a0a';
      tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
      targetCtx = tempCtx;
    }

    // First pass: render all content layers
    for (const layer of contentLayers) {
      if (layer.type === 'text') {
        this.renderTextLayer(layer);
        continue;
      }
      if (layer.type === 'adjustment') {
        continue;
      }
      if (layer.type === 'video' && layer.frame) {
        targetCtx.save();

        // Clip-to-clip transition geometry (fractional, resolution-agnostic)
        const tg = layer.transitionGeometry;
        if (tg) {
          const CW = this.canvas.width;
          const CH = this.canvas.height;
          if (tg.clipRect) {
            targetCtx.beginPath();
            targetCtx.rect(
              tg.clipRect.x * CW,
              tg.clipRect.y * CH,
              tg.clipRect.w * CW,
              tg.clipRect.h * CH
            );
            targetCtx.clip();
          }
          targetCtx.translate(CW / 2 + tg.translateX * CW, CH / 2 + tg.translateY * CH);
          if (tg.rotation) targetCtx.rotate(tg.rotation);
          if (tg.scale !== 1) targetCtx.scale(tg.scale, tg.scale);
          targetCtx.translate(-CW / 2, -CH / 2);
        }

        // --------------------------------------------------------------------
        // ORIENTATION FIX:
        // AssetDecoder's CanvasSink already yields canvases in DISPLAY
        // dimensions (rotated according to metadata). Previously we swapped
        // width/height again based on sourceRotation, which double-rotated and
        // produced "wrong orientation". Now sourceRotation is always 0 from
        // AssetDecoder (see its comment), so vw/vh are simply the frame's
        // intrinsic size. If a future decoder returns raw frames, we still
        // handle rotation via sourceRotation below — but we do NOT pre-swap
        // vw/vh. The size for layout is display size; drawing handles rotation.
        // --------------------------------------------------------------------
        const frameAny = layer.frame as any;
        let vw = frameAny.displayWidth || frameAny.width || frameAny.videoWidth || frameAny.codedWidth || 1920;
        let vh = frameAny.displayHeight || frameAny.height || frameAny.videoHeight || frameAny.codedHeight || 1080;
        // Fallback: if frame is OffscreenCanvas, its .width/.height are display dims
        if (frameAny.__isCanvas || frameAny instanceof OffscreenCanvas) {
          vw = frameAny.width || vw;
          vh = frameAny.height || vh;
        }
        const srcRot = layer.sourceRotation || 0;
        // NOTE: srcRot is 0 when CanvasSink already rotated. If a decoder
        // ever returns raw + rotation, we will rotate at draw time, not size time.
        // Do NOT swap vw/vh here — that caused double-swap bug.

        const W = this.canvas.width;
        const H = this.canvas.height;
        
        // 1. Calculate active view dimensions based on PROJECT aspect ratio
        let viewW = 854;
        let viewH = 480;
        if (this.aspectRatio === '9:16') {
            viewW = Math.round(480 * (9 / 16));
        } else if (this.aspectRatio === '1:1') {
            viewW = 480;
        } else if (this.aspectRatio === '4:3') {
            viewW = Math.round(480 * (4 / 3));
        }

        // 2. Calculate base size to fit the export canvas
        const scaleToFit = Math.min(W / vw, H / vh);
        const baseW = vw * scaleToFit;
        const baseH = vh * scaleToFit;

        // 3. Extract and convert scale (UI uses 100 for 100%)
        let scale = layer.transform.scale;
        if (scale <= 10 && scale > 0) scale = scale * 100; // legacy '1' scale
        if (!Number.isFinite(scale) || scale <= 0) scale = 100;
        const finalScale = scale / 100;
        
        const finalW = Math.max(1, baseW * finalScale);
        const finalH = Math.max(1, baseH * finalScale);

        // 4. Scale UI coordinates (relative to viewW x viewH) to export resolution
        const exportScaleX = W / viewW;
        const exportScaleY = H / viewH;
        
        const tx = (layer.transform.x || 0) * exportScaleX;
        const ty = (layer.transform.y || 0) * exportScaleY;

        // 5. Apply global translation + rotation
        const cx = W / 2;
        const cy = H / 2;
        targetCtx.translate(cx + tx, cy + ty);
        targetCtx.rotate(((layer.transform.rotation || 0) * Math.PI) / 180);
        
        // Perspective pin warp: use the preview's grid-based corner warping
        // when perspectivePin is enabled and corners are defined.
        const hasPerspectiveWarp = layer.perspectivePin && layer.perspectiveCorners;
        
        // 3D rotation (rotationX/Y): squash by cos(angle) to reproduce the
        // preview's perspective flattening (full corner warp would need
        // per-clip projection; this matches the preview's simulated-3D squash).
        // Skip this if we're doing a full perspective warp.
        if (!hasPerspectiveWarp) {
          const rotX3d = layer.rotationX || 0;
          const rotY3d = layer.rotationY || 0;
          if (Math.abs(rotX3d) > 0.01 || Math.abs(rotY3d) > 0.01) {
            const sx3d = Math.cos((rotY3d * Math.PI) / 180);
            const sy3d = Math.cos((rotX3d * Math.PI) / 180);
            if (Math.abs(sx3d) > 0.001 && Math.abs(sy3d) > 0.001) {
              targetCtx.scale(sx3d, sy3d);
            }
          }
        }
        if (layer.flipH || layer.flipV) {
          targetCtx.scale(layer.flipH ? -1 : 1, layer.flipV ? -1 : 1);
        }
        
        targetCtx.globalAlpha = layer.opacity ?? 1;
        targetCtx.globalCompositeOperation = layer.blendMode || 'source-over';

        // 6. Resolve drawable + crop handling
        targetCtx.save();

        const resolved = await this.resolveDrawable(layer.frame as any);
        let drawable: CanvasImageSource = resolved.drawable;

        // Apply AI background removal mask if enabled
        if (layer.aiBackground?.enabled && layer.frame) {
          const frame = layer.frame as any;
          const sourceTimeMs = frame.sourceTime !== undefined ? (frame.sourceTime * 1000) : 0;
          
          const dw = (drawable as any).width || (drawable as any).videoWidth || W;
          const dh = (drawable as any).height || (drawable as any).videoHeight || H;

          // Create a temp canvas to apply the mask
          const tempCanvas = typeof OffscreenCanvas !== 'undefined' 
            ? new OffscreenCanvas(dw, dh)
            : document.createElement('canvas');
          tempCanvas.width = dw;
          tempCanvas.height = dh;
          const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true })!;
          
          // Draw the original frame
          tempCtx.drawImage(drawable, 0, 0);
          
          // Apply the pre-rendered mask from cache
          // Note: For export, we need to use the cached masks that were prepared during "Prepare Export" phase
          // The applyPreRenderedMaskIfAvailable function looks up masks by clipId and current time
          const clipId = frame.clipId || '_default';
          const modelSelection = layer.aiBackground.modelSelection ?? 1;
          const choke = layer.aiBackground.choke ?? 0;
          const feather = layer.aiBackground.feather ?? layer.aiBackground.edgeBlur ?? 0;
          const spillSuppression = layer.aiBackground.spillSuppression ?? 0;
          const spillColor = layer.aiBackground.spillColor;
          
          // For export, we need to simulate the video time for mask lookup
          // We'll create a mock element with the currentTime property
          const mockElement = {
            currentTime: frame.sourceTime || 0,
            videoWidth: dw,
            videoHeight: dh,
          };
          
          // Try to apply the cached mask
          const maskApplied = applyPreRenderedMaskIfAvailable(
            tempCtx,
            tempCanvas.width,
            tempCanvas.height,
            mockElement as any,
            clipId,
            false, // isPlaying = false for export
            modelSelection,
            choke,
            feather,
            spillSuppression,
            spillColor
          );
          
          if (maskApplied) {
            drawable = tempCanvas;
          } else {
            console.warn('[Compositor] AI background mask not found in cache for clip', clipId, 'at time', frame.sourceTime);
          }
        }
        
        // Apply object removal inpainting if enabled
        if (layer.objectRemoval?.enabled && layer.frame) {
          const frame = layer.frame as any;
          const sourceTimeMs = frame.sourceTime !== undefined ? (frame.sourceTime * 1000) : 0;
          
          try {
            const curW = (drawable as any).width || (drawable as any).videoWidth || W;
            const curH = (drawable as any).height || (drawable as any).videoHeight || H;
            const inpaintedCanvas = generateObjectRemovalInpaint(
              curW,
              curH,
              layer.objectRemoval,
              frame.sourceTime || 0,
              frame.clipStartTime || 0,
              drawable,
              frame.clip?.animations,
              frame.clipId
            );
            drawable = inpaintedCanvas;
          } catch (err) {
            console.warn('[Compositor] Object removal failed:', err);
          }
        }

        // If perspective warp is enabled, draw using the corner-warp grid
        // instead of the standard transform pipeline.
        if (hasPerspectiveWarp && layer.perspectiveCorners) {
          const corners = layer.perspectiveCorners;
          // Map normalized corner offsets (0-100 range from UI) to canvas coordinates
          const tl = { x: cx + tx + (corners.topLeft?.x || 0) * exportScaleX, y: cy + ty + (corners.topLeft?.y || 0) * exportScaleY };
          const tr = { x: cx + tx + (corners.topRight?.x || 0) * exportScaleX, y: cy + ty + (corners.topRight?.y || 0) * exportScaleY };
          const br = { x: cx + tx + (corners.bottomRight?.x || 0) * exportScaleX, y: cy + ty + (corners.bottomRight?.y || 0) * exportScaleY };
          const bl = { x: cx + tx + (corners.bottomLeft?.x || 0) * exportScaleX, y: cy + ty + (corners.bottomLeft?.y || 0) * exportScaleY };
          
          targetCtx.restore(); // Exit the transform save before applying warp
          targetCtx.save();
          
          // Apply the perspective texture warp using the same 8×8 grid as preview
          drawPerspectiveTexture(
            targetCtx as unknown as CanvasRenderingContext2D,
            drawable,
            { x0: tl.x, y0: tl.y, x1: tr.x, y1: tr.y, x2: br.x, y2: br.y, x3: bl.x, y3: bl.y }
          );
          
          // Skip the standard drawImage path since we've already drawn with warp
          continue;
        }

        // Fast GPU-backed color controls. Keeping these in Canvas2D's filter
        // pipeline avoids a full-resolution getImageData/putImageData roundtrip
        // on every frame (the main reason one minute exports took 5–10 minutes).
        const cf = layer.colorFilters;
        const effectNames = (layer.effects || []).map((x) => String(x).toLowerCase());
        const cssFilters: string[] = [];
        if (cf) {
          const brightness = Math.max(0, 100 + (Number.isFinite(cf.exposure) ? cf.exposure : 0));
          cssFilters.push(`brightness(${brightness}%)`);
          cssFilters.push(`contrast(${Math.max(0, cf.contrast || 0)}%)`);
          cssFilters.push(`saturate(${Math.max(0, cf.saturation || 0)}%)`);
          if (cf.blur > 0) cssFilters.push(`blur(${Math.min(100, cf.blur)}px)`);
          // Canvas filters do not expose independent temperature/tint. A small
          // sepia+hue shift is a hardware-accelerated, stable approximation.
          const warmth = Math.max(-100, Math.min(100, cf.temperature || 0));
          const tint = Math.max(-100, Math.min(100, cf.tint || 0));
          if (warmth !== 0) cssFilters.push(`sepia(${Math.abs(warmth) * 0.28}%) hue-rotate(${warmth < 0 ? 180 : 0}deg)`);
          if (tint !== 0) cssFilters.push(`hue-rotate(${tint * 0.18}deg)`);
        }
        if (effectNames.some((x) => x.includes('black') || x.includes('monochrome') || x === 'grayscale')) cssFilters.push('grayscale(100%)');
        if (effectNames.some((x) => x.includes('sepia') || x.includes('vintage'))) cssFilters.push('sepia(70%)');
        this.ctx.filter = cssFilters.length ? cssFilters.join(' ') : 'none';

        // Determine source dimensions for cropping
        const drawableAny = drawable as any;
        const srcFullW = drawableAny.width || drawableAny.videoWidth || vw || finalW;
        const srcFullH = drawableAny.height || drawableAny.videoHeight || vh || finalH;

        let sx = 0, sy = 0, sW = srcFullW, sH = srcFullH;
        let dW = finalW, dH = finalH;
        let dX = -finalW / 2, dY = -finalH / 2;

        if (layer.crop) {
          const l = Math.max(0, Math.min(0.99, (layer.crop.left || 0) / 100));
          const r = Math.max(0, Math.min(0.99, (layer.crop.right || 0) / 100));
          const t = Math.max(0, Math.min(0.99, (layer.crop.top || 0) / 100));
          const b = Math.max(0, Math.min(0.99, (layer.crop.bottom || 0) / 100));
          if (l + r < 0.99 && t + b < 0.99) {
            sW = srcFullW * (1 - l - r);
            sH = srcFullH * (1 - t - b);
            sx = srcFullW * l;
            sy = srcFullH * t;
            dW = finalW * (1 - l - r);
            dH = finalH * (1 - t - b);
            // Keep visual center stable by offsetting for asymmetric crop
            const xShift = (l - r) * finalW * 0.5;
            const yShift = (t - b) * finalH * 0.5;
            dX = -dW / 2 + xShift;
            dY = -dH / 2 + yShift;
          }
        }

        // Common geometric masks are clipped on the compositor and therefore
        // work for ordinary frames, filtered frames and transition layers.
        const mask = layer.mask;
        if (mask?.enabled && mask.type !== 'matte') {
          const maskX = dX + dW * ((mask.x ?? 50) / 100);
          const maskY = dY + dH * ((mask.y ?? 50) / 100);
          const maskW = dW * ((mask.width ?? 100) / 100);
          const maskH = dH * ((mask.height ?? 100) / 100);
          targetCtx.beginPath();
          if (mask.type === 'circle') {
            targetCtx.ellipse(maskX, maskY, Math.abs(maskW / 2), Math.abs(maskH / 2), ((mask.rotation || 0) * Math.PI) / 180, 0, Math.PI * 2);
          } else {
            targetCtx.rect(maskX - maskW / 2, maskY - maskH / 2, maskW, maskH);
          }
          // Canvas clipping cannot invert a path portably; non-inverted masks
          // cover the overwhelming majority of editor projects.
          if (!mask.invert && !mask.inverted) targetCtx.clip();
        }

        // Vector bezier mask (mirrors preview's applyVectorMaskToContext).
        if (layer.vectorMask?.enabled) {
          applyVectorMaskToContext(
            targetCtx as unknown as CanvasRenderingContext2D,
            layer.vectorMask,
            Math.round(dW),
            Math.round(dH)
          );
        }

        // ── Pixel-pass effects (keying, color wheels, curves, LUT, FX) ────────
        // Any of these requires getImageData/putImageData, so they run on a temp
        // canvas whose pixels are then blitted once — mirroring the preview's
        // offscreen pass ordering.
        const hasChromaKey = !!(layer.chromaKey && layer.chromaKey.enabled);
        const hasLumaKey = !!(layer.lumaKey && layer.lumaKey.enabled);
        const cw = layer.colorWheels;
        const hasWheels = !!(cw && (cw.shadows || cw.midtones || cw.highlights));
        const curvesData = layer.curves;
        const hasCurves = !!curvesData && (
          isCurveOn(curvesData.rgb) || isCurveOn(curvesData.r) ||
          isCurveOn(curvesData.g) || isCurveOn(curvesData.b) || isCurveOn(curvesData.luma)
        );
        const hasLut = !!(layer.lutData);
        const hasFx = !!layer.fxSettings;

        try {
          if (hasChromaKey || hasLumaKey || hasWheels || hasCurves || hasLut || hasFx) {
            const tempCanvas = new OffscreenCanvas(Math.max(1, Math.round(dW)), Math.max(1, Math.round(dH)));
            const tempCtx = tempCanvas.getContext('2d', { alpha: true }) as OffscreenCanvasRenderingContext2D | null;
            if (tempCtx) {
              // Apply the color filters on the temp context (so keying/wheels/etc
              // see the graded pixels), then reset before pixel passes.
              tempCtx.filter = cssFilters.length ? cssFilters.join(' ') : 'none';
              if (srcRot !== 0) {
                tempCtx.translate(dW / 2, dH / 2);
                tempCtx.rotate((srcRot * Math.PI) / 180);
                tempCtx.drawImage(drawable as any, sx, sy, sW, sH, -dW / 2, -dH / 2, dW, dH);
              } else {
                tempCtx.drawImage(drawable as any, sx, sy, sW, sH, 0, 0, dW, dH);
              }
              tempCtx.filter = 'none';

              if (hasChromaKey) this.applyChromaKey(tempCtx, tempCanvas.width, tempCanvas.height, layer.chromaKey!);
              if (hasLumaKey) this.applyLumaKey(tempCtx, tempCanvas.width, tempCanvas.height, layer.lumaKey!);
              if (hasWheels) {
                applyColorGradingWheelsOnData(
                  tempCtx as unknown as CanvasRenderingContext2D,
                  tempCanvas.width, tempCanvas.height,
                  cw!.shadows, cw!.midtones, cw!.highlights
                );
              }
              if (hasCurves) {
                const rgbLut = isCurveOn(curvesData.rgb) ? buildLUT(curvesData.rgb) : IDENTITY_CURVE_LUT;
                const rLut = isCurveOn(curvesData.r) ? buildLUT(curvesData.r) : null;
                const gLut = isCurveOn(curvesData.g) ? buildLUT(curvesData.g) : null;
                const bLut = isCurveOn(curvesData.b) ? buildLUT(curvesData.b) : null;
                const lumaLut = isCurveOn(curvesData.luma) ? buildLUT(curvesData.luma) : null;
                try {
                  const imgData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
                  applyCurves(imgData, rgbLut, rLut, gLut, bLut, lumaLut);
                  tempCtx.putImageData(imgData, 0, 0);
                } catch (e) {
                  console.warn('[Compositor] Curves failed:', e);
                }
              }
              if (hasLut) {
                applyLutToCanvas(
                  tempCtx as unknown as CanvasRenderingContext2D,
                  tempCanvas.width, tempCanvas.height,
                  layer.lutData,
                  layer.lutIntensity ?? 100
                );
              }
              if (hasFx) {
                const localTime = Math.max(0, (layer.timestampSeconds ?? 0) - (layer.startTime ?? 0));
                applyFxEffect(
                  tempCtx as unknown as CanvasRenderingContext2D,
                  tempCanvas.width, tempCanvas.height,
                  layer.fxSettings.type,
                  layer.fxSettings.intensity ?? 100,
                  localTime,
                  false
                );
              }

              targetCtx.filter = 'none';
              targetCtx.drawImage(tempCanvas, dX, dY, dW, dH);
            } else {
              if (srcRot !== 0) targetCtx.rotate((srcRot * Math.PI) / 180);
              targetCtx.drawImage(drawable as any, sx, sy, sW, sH, dX, dY, dW, dH);
            }
          } else {
            if (srcRot !== 0) {
              targetCtx.rotate((srcRot * Math.PI) / 180);
            }
            // Use 9-arg drawImage when crop present or source dimensions differ
            if (sx !== 0 || sy !== 0 || sW !== srcFullW || sH !== srcFullH) {
              targetCtx.drawImage(drawable as any, sx, sy, sW, sH, dX, dY, dW, dH);
            } else {
              targetCtx.drawImage(drawable, dX, dY, dW, dH);
            }
          }
        } finally {
          if (resolved.cleanup) resolved.cleanup();
        }

        if (cf && (cf.fadedFilm !== 0 || cf.vignette !== 0)) {
          targetCtx.save();
          targetCtx.filter = 'none';
          targetCtx.globalCompositeOperation = 'source-over';
          if (cf.fadedFilm > 0) {
            targetCtx.globalAlpha = Math.min(0.35, cf.fadedFilm / 300) * (layer.opacity ?? 1);
            targetCtx.fillStyle = '#d8cbb4';
            targetCtx.fillRect(dX, dY, dW, dH);
          }
          if (cf.vignette !== 0 && typeof targetCtx.createRadialGradient === 'function') {
            const grad = targetCtx.createRadialGradient(0, 0, Math.min(dW, dH) * 0.15, 0, 0, Math.max(dW, dH) * 0.7);
            const strength = Math.min(0.9, Math.abs(cf.vignette) / 100);
            grad.addColorStop(0.45, 'rgba(0,0,0,0)');
            grad.addColorStop(1, cf.vignette > 0 ? `rgba(0,0,0,${strength})` : `rgba(255,255,255,${strength})`);
            targetCtx.globalAlpha = layer.opacity ?? 1;
            targetCtx.fillStyle = grad;
            targetCtx.fillRect(dX, dY, dW, dH);
          }
          targetCtx.restore();
        }
        
        targetCtx.restore();
        targetCtx.restore();
        targetCtx.globalCompositeOperation = 'source-over';
      }
    }

    // Full-frame transition overlays
    for (const ov of overlays) {
      if (!ov || !(ov.alpha > 0.001)) continue;
      targetCtx.save();
      targetCtx.globalAlpha = Math.min(1, ov.alpha);
      targetCtx.fillStyle = ov.color;
      targetCtx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      targetCtx.restore();
    }

    // ── Particle effects (full-frame pass) ──────────────────────────────────
    // Mirrors the preview: particles are drawn in view space, over everything,
    // and are now deterministic so the exported field is stable across runs.
    const { viewW: pvW, viewH: pvH } = this.getViewSize();
    const particleScale = this.canvas.width / pvW; // all aspect ratios scale uniformly
    for (const layer of contentLayers) {
      if (!layer.particleSettings) continue;
      const localTime = (layer.timestampSeconds ?? 0) - (layer.startTime ?? 0);
      targetCtx.save();
      targetCtx.scale(particleScale, particleScale);
      renderParticlesDeterministic(
        targetCtx as unknown as CanvasRenderingContext2D,
        layer.clipId || `clip-${layer.order ?? 0}`,
        layer.particleSettings,
        pvW,
        pvH,
        localTime
      );
      targetCtx.restore();
    }

    // ── FX track effects (full-frame shader pass) ────────────────────────────
    // FX-track clips carry `fxSettings` (Glitch, VHS, Cinematic Bars, Old Film,
    // …) that are applied over the WHOLE composited frame, not a single clip's
    // pixels. Each active FX layer's shader runs in z-order over the already
    // composited content + particles, mirroring the preview's timeline-FX pass.
    for (const layer of contentLayers) {
      if (layer.type !== 'fx' || !layer.fxSettings) continue;
      const localTime = Math.max(0, (layer.timestampSeconds ?? 0) - (layer.startTime ?? 0));
      applyFxEffect(
        targetCtx as unknown as CanvasRenderingContext2D,
        this.canvas.width,
        this.canvas.height,
        layer.fxSettings.type,
        layer.fxSettings.intensity ?? 100,
        localTime,
        false
      );
    }

    // Second pass: apply adjustment layers over composited content
    if (needsIntermediate && tempCanvas) {
      // Blit intermediate canvas to main canvas
      this.ctx.drawImage(tempCanvas, 0, 0);
      
      // Apply each adjustment layer in z-order
      for (const adjLayer of adjustmentLayers) {
        // Reconstruct a minimal clip object from the layer data
        const adjClip: any = {
          id: adjLayer.clipId || 'adj',
          disabled: false,
          opacity: adjLayer.opacity ?? 1,
          colorFilters: adjLayer.colorFilters,
        };
        applyAdjustmentLayerPass(
          this.ctx as unknown as CanvasRenderingContext2D,
          adjClip,
          this.canvas.width,
          this.canvas.height
        );
      }
    }
  }

  /**
   * Compute the entry/exit text-animation modifiers (opacity / scale / offset)
   * for a text clip at a given time. This mirrors the preview's text branch in
   * CanvasRenderingEngine exactly, so text animations that are visible in the
   * editor now also render in the exported file.
   *
   * NOTE: This previously did not exist in the export path at all — animated
   * text (fade, zoom, bounce, slide, elastic, typewriter, …) rendered correctly
   * in the preview but exported as a static, full-opacity title.
   */
  private computeTextAnimation(clip: any, timestampSeconds?: number) {
    const out = { opacity: 1, scaleX: 1, scaleY: 1, offsetX: 0, offsetY: 0 };
    const anim = clip?.textSettings?.animation;
    if (!anim) return out;

    const currentTime = timestampSeconds ?? 0;
    const startTime = clip.startTime || 0;
    const duration = clip.duration || 0;
    const inDuration = anim.inDuration || 0.1;
    const outDuration = anim.outDuration || 0.1;
    const timeSinceStart = currentTime - startTime;
    const timeUntilEnd = startTime + duration - currentTime;

    if (timeSinceStart < inDuration && timeSinceStart >= 0) {
      const progress = inDuration > 0 ? timeSinceStart / inDuration : 1;
      switch (anim.in) {
        case 'fadeIn':
          out.opacity = progress;
          break;
        case 'zoom':
          out.scaleX = out.scaleY = progress;
          out.opacity = progress;
          break;
        case 'bounce':
          out.scaleX = out.scaleY = 1 - Math.cos(progress * Math.PI * 2) * (1 - progress) * 0.5;
          break;
        case 'slideUp':
          out.offsetY = (1 - progress) * 100;
          out.opacity = progress;
          break;
        case 'slideDown':
          out.offsetY = -(1 - progress) * 100;
          out.opacity = progress;
          break;
        case 'slideLeft':
          out.offsetX = (1 - progress) * 100;
          out.opacity = progress;
          break;
        case 'slideRight':
          out.offsetX = -(1 - progress) * 100;
          out.opacity = progress;
          break;
        case 'elastic': {
          const p = progress;
          out.scaleX = out.scaleY = Math.pow(2, -10 * p) * Math.sin((p * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
          break;
        }
        case 'scaleFlip':
          out.scaleY = progress;
          break;
        case 'zoomBlur':
          out.scaleX = out.scaleY = 1 + (1 - progress);
          out.opacity = progress;
          break;
        default:
          break;
      }
    } else if (timeUntilEnd < outDuration && timeUntilEnd >= 0) {
      const progress = outDuration > 0 ? 1 - timeUntilEnd / outDuration : 1;
      switch (anim.out) {
        case 'fadeOut':
          out.opacity = 1 - progress;
          break;
        case 'zoom':
          out.scaleX = out.scaleY = 1 - progress;
          out.opacity = 1 - progress;
          break;
        case 'slideUp':
          out.offsetY = -(progress * 100);
          out.opacity = 1 - progress;
          break;
        case 'slideDown':
          out.offsetY = progress * 100;
          out.opacity = 1 - progress;
          break;
        case 'slideLeft':
          out.offsetX = -(progress * 100);
          out.opacity = 1 - progress;
          break;
        case 'slideRight':
          out.offsetX = progress * 100;
          out.opacity = 1 - progress;
          break;
        default:
          break;
      }
    }
    return out;
  }

  /**
   * Draw a text/title clip. Mirrors the preview's text branch in
   * CanvasRenderingEngine (font construction, background pill, stroke, shadow,
   * underline, and now entry/exit animation) scaled from the UI view space to
   * the export resolution.
   */
  private renderTextLayer(layer: RenderLayer) {
    const clip = layer.textData || {};
    const ts = clip.textSettings || {
      text: clip.text || 'Text',
      fontSize: 48,
      fontFamily: 'sans-serif',
      color: '#ffffff',
    };
    const anim = this.computeTextAnimation(clip, layer.timestampSeconds);

    let text: string = ts.text || clip.textContent || 'Text';
    // Typewriter in-animation progressively reveals characters (mirrors preview).
    if (ts.animation && ts.animation.in === 'typewriter' && ts.text) {
      const inDuration = ts.animation.inDuration || 0.1;
      const timeSinceStart = (layer.timestampSeconds ?? 0) - (clip.startTime || 0);
      if (timeSinceStart < inDuration && timeSinceStart >= 0) {
        const progress = inDuration > 0 ? timeSinceStart / inDuration : 1;
        const charsToShow = Math.ceil((ts.text.length || 0) * progress);
        text = (ts.text || '').substring(0, charsToShow);
      }
    }
    if (!text) return;

    const W = this.canvas.width;
    const H = this.canvas.height;
    const { viewW, viewH } = this.getViewSize();
    // Font sizes are authored against the preview view; scale to export size.
    const uiScale = Math.min(W / viewW, H / viewH);

    this.ctx.save();

    const tg = layer.transitionGeometry;
    if (tg) {
      if (tg.clipRect) {
        this.ctx.beginPath();
        this.ctx.rect(tg.clipRect.x * W, tg.clipRect.y * H, tg.clipRect.w * W, tg.clipRect.h * H);
        this.ctx.clip();
      }
      this.ctx.translate(W / 2 + tg.translateX * W, H / 2 + tg.translateY * H);
      if (tg.rotation) this.ctx.rotate(tg.rotation);
      if (tg.scale !== 1) this.ctx.scale(tg.scale, tg.scale);
      this.ctx.translate(-W / 2, -H / 2);
    }

    const exportScaleX = W / viewW;
    const exportScaleY = H / viewH;
    const tx = (layer.transform.x || 0) * exportScaleX;
    const ty = (layer.transform.y || 0) * exportScaleY;

    let scale = layer.transform.scale ?? 100;
    if (scale <= 10 && scale > 0) scale = scale * 100; // legacy '1' scale
    const finalScale = (scale / 100) * uiScale;

    this.ctx.translate(W / 2 + tx, H / 2 + ty);
    this.ctx.rotate(((layer.transform.rotation || 0) * Math.PI) / 180);
    this.ctx.scale(finalScale, finalScale);

    // Entry/exit animation: offset + scale compose inside the already-scaled
    // context exactly like the preview's text branch, so the exported motion
    // matches the editor frame-for-frame.
    this.ctx.translate(anim.offsetX, anim.offsetY);
    this.ctx.scale(anim.scaleX, anim.scaleY);

    this.ctx.globalAlpha = (layer.opacity ?? 1) * anim.opacity;
    this.ctx.globalCompositeOperation = layer.blendMode || 'source-over';

    const fontStyle: string[] = [];
    if (ts.italic) fontStyle.push('italic');
    if (ts.bold) fontStyle.push('bold');
    const fontWeightStyle = fontStyle.join(' ');
    const fontSize = ts.fontSize || 48;
    this.ctx.font = `${fontWeightStyle ? fontWeightStyle + ' ' : ''}${fontSize}px ${ts.fontFamily || 'sans-serif'}`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    const lines = String(text).split('\n');
    const lineHeight = fontSize * 1.2;
    const blockHeight = lines.length * lineHeight;

    // Background pill (matches preview padding maths)
    if (ts.backgroundColor && ts.backgroundColor !== 'transparent') {
      let maxWidth = 0;
      for (const line of lines) {
        maxWidth = Math.max(maxWidth, this.ctx.measureText(line).width);
      }
      const paddingX = fontSize * 0.5;
      const paddingY = fontSize * 0.3;
      const bgX = -(maxWidth / 2) - paddingX;
      const bgY = -(blockHeight / 2) - paddingY;
      const bgW = maxWidth + paddingX * 2;
      const bgH = blockHeight + paddingY * 2;
      const radius = Math.min(8, bgH / 4);
      this.ctx.fillStyle = ts.backgroundColor;
      this.ctx.beginPath();
      this.ctx.moveTo(bgX + radius, bgY);
      this.ctx.lineTo(bgX + bgW - radius, bgY);
      this.ctx.quadraticCurveTo(bgX + bgW, bgY, bgX + bgW, bgY + radius);
      this.ctx.lineTo(bgX + bgW, bgY + bgH - radius);
      this.ctx.quadraticCurveTo(bgX + bgW, bgY + bgH, bgX + bgW - radius, bgY + bgH);
      this.ctx.lineTo(bgX + radius, bgY + bgH);
      this.ctx.quadraticCurveTo(bgX, bgY + bgH, bgX, bgY + bgH - radius);
      this.ctx.lineTo(bgX, bgY + radius);
      this.ctx.quadraticCurveTo(bgX, bgY, bgX + radius, bgY);
      this.ctx.closePath();
      this.ctx.fill();
    }

    if (ts.shadow) {
      this.ctx.shadowColor = ts.shadowColor || 'rgba(0,0,0,0.8)';
      this.ctx.shadowBlur = ts.shadowBlur !== undefined ? ts.shadowBlur : 10;
      this.ctx.shadowOffsetX = 2;
      this.ctx.shadowOffsetY = 2;
    }

    const firstLineY = -(blockHeight / 2) + lineHeight / 2;
    for (let i = 0; i < lines.length; i++) {
      const lineY = firstLineY + i * lineHeight;
      if (ts.strokeColor && ts.strokeWidth) {
        this.ctx.strokeStyle = ts.strokeColor;
        this.ctx.lineWidth = ts.strokeWidth;
        this.ctx.strokeText(lines[i], 0, lineY);
      }
      this.ctx.fillStyle = ts.color || '#ffffff';
      this.ctx.fillText(lines[i], 0, lineY);

      if (ts.underline) {
        const lw = this.ctx.measureText(lines[i]).width;
        this.ctx.save();
        this.ctx.shadowColor = 'transparent';
        this.ctx.beginPath();
        this.ctx.strokeStyle = ts.color || '#ffffff';
        this.ctx.lineWidth = Math.max(1, fontSize / 15);
        this.ctx.moveTo(-lw / 2, lineY + fontSize * 0.45);
        this.ctx.lineTo(lw / 2, lineY + fontSize * 0.45);
        this.ctx.stroke();
        this.ctx.restore();
      }
    }

    this.ctx.restore();
    this.ctx.globalCompositeOperation = 'source-over';
  }

  private applyChromaKey(ctx: OffscreenCanvasRenderingContext2D, width: number, height: number, settings: { color: string; threshold: number; softness: number; spillSuppression: number }) {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    
    // Parse hex color
    const hex = settings.color.replace('#', '');
    const kr = parseInt(hex.substring(0, 2), 16);
    const kg = parseInt(hex.substring(2, 4), 16);
    const kb = parseInt(hex.substring(4, 6), 16);
    
    const kyuv = this.rgb2yuv(kr, kg, kb);
    const th = settings.threshold * 2.4;
    const soft = settings.softness * 2.4;
    
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      
      if (a === 0) continue;

      const yuv = this.rgb2yuv(r, g, b);
      
      // Distance in UV space
      const dy = yuv.u - kyuv.u;
      const dz = yuv.v - kyuv.v;
      const dist = Math.sqrt(dy * dy + dz * dz) * 255.0;
      
      let alpha = 1.0;
      if (dist < th) {
        alpha = 0.0;
      } else if (dist < th + soft && soft > 0) {
        alpha = (dist - th) / soft;
      }
      
      if (alpha < 1.0) {
        data[i + 3] = a * alpha;
        
        // Spill suppression
        if (settings.spillSuppression > 0 && alpha > 0.0) {
           const spill = settings.spillSuppression / 100.0;
           // If key color is mostly green
           if (kg >= kr && kg >= kb) {
             const gSpill = Math.max(0, g - Math.max(r, b)) * spill;
             data[i + 1] = Math.max(0, g - gSpill);
           } 
           // If key color is mostly blue
           else if (kb >= kr && kb >= kg) {
             const bSpill = Math.max(0, b - Math.max(r, g)) * spill;
             data[i + 2] = Math.max(0, b - bSpill);
           }
        }
      }
    }
    
    ctx.putImageData(imageData, 0, 0);
  }

  /**
   * Luma key: make pixels above/below a brightness threshold transparent.
   * Mirrors `applyLumaKeyOnData` in the preview (canvasEffects.ts) so luma-keyed
   * clips export identically instead of keeping their background.
   */
  private applyLumaKey(
    ctx: OffscreenCanvasRenderingContext2D,
    width: number,
    height: number,
    settings: { type: 'dark' | 'light'; threshold: number; softness: number }
  ) {
    try {
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;
      const th = (settings.threshold / 100) * 255;
      const soft = (settings.softness / 100) * 255;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const luma = 0.299 * r + 0.587 * g + 0.114 * b;

        if (settings.type === 'dark') {
          if (luma < th) {
            data[i + 3] = 0;
          } else if (luma < th + soft && soft > 0) {
            const factor = (luma - th) / soft;
            data[i + 3] = Math.round(data[i + 3] * factor);
          }
        } else {
          const lightTh = 255 - th;
          if (luma > lightTh) {
            data[i + 3] = 0;
          } else if (luma > lightTh - soft && soft > 0) {
            const factor = (lightTh - luma) / soft;
            data[i + 3] = Math.round(data[i + 3] * factor);
          }
        }
      }
      ctx.putImageData(imageData, 0, 0);
    } catch (err) {
      console.error('[Compositor] Luma key failed:', err);
    }
  }

  private rgb2yuv(r: number, g: number, b: number) {
    const y = 0.299 * (r/255) + 0.587 * (g/255) + 0.114 * (b/255);
    const u = -0.1687 * (r/255) - 0.3313 * (g/255) + 0.5 * (b/255) + 128.0/255.0;
    const v = 0.5 * (r/255) - 0.4187 * (g/255) - 0.0813 * (b/255) + 128.0/255.0;
    return { y, u, v };
  }

  dispose() {
    if (this.gl) {
      if (this.glTexture)  this.gl.deleteTexture(this.glTexture);
      if (this.glProgram)  this.gl.deleteProgram(this.glProgram);
      // Lose the WebGL context explicitly so the GPU resources are freed.
      const ext = this.gl.getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext();
    }
    this.gl = null;
    this.glProgram = null;
    this.glTexture = null;
    this.glCanvas = null;
  }
}
