import { RenderLayer, FrameOverlay, FramePostEffect } from './FrameScheduler';
import { ExportWorkerConfig } from './export.worker';
import {
  applyColorGradingWheelsOnData,
  applyFxEffect,
  applyColorOverlays,
} from '@/utils/canvasEffects';
import { applyLutToCanvas } from '@/utils/lutParser';
import { applyCurvesToImageData as applyCurves, buildCurveLUT as buildLUT, isCurveActive as isCurveOn } from '@/utils/curvesEngine';
import { applyVectorMaskToContext, applyVectorMaskRaster, vectorMaskNeedsRaster } from '@/utils/vectorMaskEngine';
import { applyGeometricMaskToCanvas } from './geometricMask';
import { applyFeatheredRectMask, applyNoiseRevealMask, applyNoiseBandMask } from '@/utils/transitionEngine';
import { renderParticlesDeterministic } from './exportEffects';
import { applyAdjustmentLayerPass } from '@/utils/adjustmentLayerEngine';
import { drawPerspectiveTexture, getProjectedCorners } from '@/utils/canvasEffects';
import { generateObjectRemovalInpaint } from '@/utils/objectRemoval';
import { applyPreRenderedMaskIfAvailable, preRenderedMaskCache } from '@/utils/aiBackground';
import { applyTransitionPostEffect } from '@/utils/transitionEngine';
import { drawTextBackground } from '@/utils/textBackgrounds';
import { applyEasing, smoothNoise } from '@/utils/textAnimationEasing';
import { createSceneStage, captureSceneFrame, destroySceneStage, type SceneStage, type SeekMode } from '@/utils/cssSceneRasterizer';
import { calculateElementAnimation, renderElement } from '@/utils/elementRenderer';

// ── Custom FX SceneStage cache for export ─────────────────────────────────────
const _exportFxStageCache = new Map<string, { stage: SceneStage; seekMode: SeekMode; htmlHash: number }>();
function _exportSimpleHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return h;
}

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

  /** Non-fatal export warnings surfaced to the worker/caller. */
  public warnings: string[] = [];
  /** Dedup set for one-per-clip warnings. */
  private _warnedOnce = new Set<string>();

  // WebGL-based VideoFrame converter — handles NV12/YUV→RGBA on the GPU.
  private glCanvas: OffscreenCanvas | null = null;
  private gl: WebGL2RenderingContext | null = null;
  private glProgram: WebGLProgram | null = null;
  private glTexture: WebGLTexture | null = null;

  public transparentBackground: boolean = false;

  constructor(canvas: OffscreenCanvas, aspectRatio: string = '16:9', transparentBackground: boolean = false) {
    this.canvas = canvas;
    this.aspectRatio = aspectRatio;
    this.transparentBackground = transparentBackground;
    this.ctx = canvas.getContext('2d', { alpha: true }) as OffscreenCanvasRenderingContext2D;
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

  public async render(layers: RenderLayer[], overlays: FrameOverlay[] = [], postEffect?: FramePostEffect) {
    // Fill background or clear for transparent export
    if (this.transparentBackground) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    } else {
      this.ctx.fillStyle = '#0a0a0a';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

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
      if (this.transparentBackground) {
        tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
      } else {
        tempCtx.fillStyle = '#0a0a0a';
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
      }
      targetCtx = tempCtx;
    }

    // First pass: render all content layers
    for (const layer of contentLayers) {
      if (layer.type === 'text') {
        this.renderTextLayer(layer, targetCtx);
        continue;
      }
      if (layer.type === 'element') {
        this.renderElementLayer(layer, targetCtx);
        continue;
      }
      if (layer.type === 'adjustment') {
        continue;
      }
      if (layer.type === 'video' && layer.frame) {
        // Clip-to-clip transition geometry (fractional, resolution-agnostic)
        const tg = layer.transitionGeometry;

        // ── Layer isolation buffer ──────────────────────────────────────────
        // Two features need the layer rendered into its OWN frame-size buffer
        // before compositing: soft vector masks (feather / partial opacity —
        // a clip() cannot express them) and soft transition geometry (feathered
        // wipe edges / motion blur), both of which are mask/filter passes that
        // would otherwise punch holes in — or blur — the layers beneath.
        const vMask = layer.vectorMask;
        const vMaskSoft = vectorMaskNeedsRaster(vMask);
        const tgSoft = !!tg && (
          (tg.clipFeather ?? 0) > 0.0005 ||
          (tg.blur ?? 0) > 0.0005 ||
          !!tg.noiseReveal ||
          !!tg.noiseTrail ||
          (!!tg.slices && tg.slices.spread > 0.0005)
        );
        const outerTargetCtx = targetCtx;
        let vMaskBuffer: OffscreenCanvas | null = null;
        if ((vMask?.enabled && vMaskSoft) || tgSoft) {
          const buf = new OffscreenCanvas(this.canvas.width, this.canvas.height);
          const bufCtx = buf.getContext('2d', { alpha: true }) as OffscreenCanvasRenderingContext2D | null;
          if (bufCtx) {
            vMaskBuffer = buf;
            targetCtx = bufCtx;
          }
        }

        // Balances the two save() calls of the layer block, then applies the
        // isolation-buffer passes (blur → feathered wipe edge → vector mask)
        // and composites the layer back onto the real target. Must be invoked
        // on EVERY exit path (including the perspective-warp `continue` below).
        const finishLayer = () => {
          targetCtx.restore();
          targetCtx.restore();
          targetCtx.globalCompositeOperation = 'source-over';

          if (vMaskBuffer) {
            // Motion blur for blur-dissolve transitions (buffer holds ONLY
            // this layer — blurring here never touches the clips beneath).
            if (tg && (tg.blur ?? 0) > 0.0005) {
              const blurPx = Math.max(1, tg.blur! * vMaskBuffer.width);
              const tmp = new OffscreenCanvas(vMaskBuffer.width, vMaskBuffer.height);
              const tctx = tmp.getContext('2d');
              if (tctx) {
                tctx.filter = `blur(${blurPx}px)`;
                tctx.drawImage(vMaskBuffer, 0, 0);
                tctx.filter = 'none';
                const back = vMaskBuffer.getContext('2d');
                if (back) {
                  back.globalCompositeOperation = 'copy';
                  back.drawImage(tmp, 0, 0);
                  back.globalCompositeOperation = 'source-over';
                }
              }
            }
            // Feathered wipe edge: gradient destination-in on the reveal edge
            // (shared helper — identical routine to the preview renderer).
            if (tg?.clipRect && (tg.clipFeather ?? 0) > 0.0005) {
              applyFeatheredRectMask(
                targetCtx as unknown as CanvasRenderingContext2D,
                tg.clipRect,
                tg.clipFeather!,
                vMaskBuffer.width,
                vMaskBuffer.height
              );
            }
            // Particle trail: snapshot band-masked copies of the layer BEFORE
            // the erosion mask below removes those pixels (same order as the
            // preview — otherwise flying particles would have no content).
            const trailLayers: Array<{ bmp: ImageBitmap; alpha: number; dx: number; dy: number; scale: number }> = [];
            if (tg?.noiseTrail) {
              const tr = tg.noiseTrail;
              if (tr.center > 0.02 && tr.center < 0.98) {
                for (let k = 1; k <= 2; k++) {
                  const tb = new OffscreenCanvas(vMaskBuffer.width, vMaskBuffer.height);
                  const tc = tb.getContext('2d');
                  if (!tc) break;
                  tc.drawImage(vMaskBuffer, 0, 0);
                  applyNoiseBandMask(tc, tr.center, 0.09, tr.cell, tb.width, tb.height);
                  trailLayers.push({
                    bmp: tb.transferToImageBitmap(),
                    alpha: (layer.opacity ?? 1) * (k === 1 ? 0.8 : 0.45),
                    dx: tr.windX * k * this.canvas.width,
                    dy: tr.windY * k * this.canvas.height,
                    scale: k === 2 ? 0.96 : 1,
                  });
                }
              }
            }
            // Particle dissolve: punch the deterministic noise grid out of the
            // layer (same hash mask the preview uses — frame-seek safe).
            if (tg?.noiseReveal) {
              applyNoiseRevealMask(
                targetCtx as unknown as CanvasRenderingContext2D,
                tg.noiseReveal.amount,
                tg.noiseReveal.cell,
                vMaskBuffer.width,
                vMaskBuffer.height,
                !!tg.noiseReveal.invert
              );
            }
            if (vMask?.enabled && vMaskSoft) {
              applyVectorMaskRaster(
                targetCtx as unknown as CanvasRenderingContext2D,
                vMask,
                this.canvas.width,
                this.canvas.height
              );
            }
            outerTargetCtx.save();
            outerTargetCtx.globalAlpha = 1;
            outerTargetCtx.globalCompositeOperation = 'source-over';
            if (tg?.slices && tg.slices.spread > 0.0005) {
              // Disassemble/Assemble: composite strip-by-strip with alternating
              // perpendicular offsets (same strip math as the preview blit).
              const { count, axis, spread } = tg.slices;
              const n = Math.max(2, Math.round(count));
              const BW = vMaskBuffer.width;
              const BH = vMaskBuffer.height;
              for (let i = 0; i < n; i++) {
                const dir = i % 2 === 0 ? 1 : -1;
                if (axis === 'x') {
                  const bw = BW / n;
                  const off = dir * spread * BH;
                  outerTargetCtx.drawImage(vMaskBuffer, i * bw, 0, Math.ceil(bw) + 1, BH,
                    (i * BW) / n, off, BW / n + 1, BH);
                } else {
                  const bh = BH / n;
                  const off = dir * spread * BW;
                  outerTargetCtx.drawImage(vMaskBuffer, 0, i * bh, BW, Math.ceil(bh) + 1,
                    off, (i * BH) / n, BW, BH / n + 1);
                }
              }
            } else {
              outerTargetCtx.drawImage(vMaskBuffer, 0, 0);
            }
            outerTargetCtx.restore();

            // In-air particle trail passes: band-masked layer copies drifting
            // with the wind, fading out (mirrors the preview 1:1).
            for (const tl of trailLayers) {
              outerTargetCtx.save();
              outerTargetCtx.globalAlpha = Math.min(1, tl.alpha);
              if (tl.scale !== 1) {
                outerTargetCtx.translate(this.canvas.width / 2, this.canvas.height / 2);
                outerTargetCtx.scale(tl.scale, tl.scale);
                outerTargetCtx.translate(-this.canvas.width / 2, -this.canvas.height / 2);
              }
              outerTargetCtx.drawImage(tl.bmp, tl.dx, tl.dy);
              outerTargetCtx.restore();
              try { tl.bmp.close(); } catch { /* ignore */ }
            }
            targetCtx = outerTargetCtx;
          }
        };

        targetCtx.save();

        if (tg) {
          const CW = this.canvas.width;
          const CH = this.canvas.height;
          // Hard wipe clip — skipped when a feather is present: the gradient
          // mask in finishLayer() replaces it (both = double-masked edge).
          if (tg.clipRect && !(tgSoft && (tg.clipFeather ?? 0) > 0.0005)) {
            targetCtx.beginPath();
            targetCtx.rect(
              tg.clipRect.x * CW,
              tg.clipRect.y * CH,
              tg.clipRect.w * CW,
              tg.clipRect.h * CH
            );
            targetCtx.clip();
          }
          if (tg.clipCircle && tg.clipCircle.r > 0.0001) {
            targetCtx.beginPath();
            targetCtx.arc(tg.clipCircle.x * CW, tg.clipCircle.y * CH, tg.clipCircle.r * CW, 0, Math.PI * 2);
            targetCtx.clip();
          }
          if (tg.clipWedge && tg.clipWedge.angle < Math.PI * 2 - 0.0001) {
            targetCtx.beginPath();
            targetCtx.moveTo(tg.clipWedge.cx * CW, tg.clipWedge.cy * CH);
            targetCtx.arc(tg.clipWedge.cx * CW, tg.clipWedge.cy * CH, Math.max(CW, CH) * 1.2, -Math.PI / 2, -Math.PI / 2 + tg.clipWedge.angle);
            targetCtx.closePath();
            targetCtx.clip();
          }
          targetCtx.translate(CW / 2 + tg.translateX * CW, CH / 2 + tg.translateY * CH);
          if (tg.rotation) targetCtx.rotate(tg.rotation);
          const tgSX = tg.scale * (tg.scaleX ?? 1);
          const tgSY = tg.scale * (tg.scaleY ?? 1);
          if (tgSX !== 1 || tgSY !== 1) targetCtx.scale(tgSX, tgSY);
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

        // Hard-edge, full-opacity vector masks: exact zero-cost clip in frame
        // space (still untransformed here — matches preview ordering). Also
        // serves as the graceful fallback when a soft mask's isolation buffer
        // could not be created (loses feather/opacity but keeps the cutout).
        if (vMask?.enabled && !vMaskBuffer) {
          applyVectorMaskToContext(targetCtx as unknown as CanvasRenderingContext2D, vMask, W, H);
        }
        
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
        
        // Perspective pin or 3D rotation: use grid-based corner perspective warping
        const hasPerspectivePin = !!(layer.perspectivePin && layer.perspectiveCorners);
        const has3dRotation = Math.abs(layer.rotationX || 0) > 0.01 || Math.abs(layer.rotationY || 0) > 0.01;
        const hasPerspectiveWarp = hasPerspectivePin || has3dRotation;

        if (!hasPerspectiveWarp) {
          targetCtx.translate(cx + tx, cy + ty);
          targetCtx.rotate(((layer.transform.rotation || 0) * Math.PI) / 180);
          if (layer.flipH || layer.flipV) {
            targetCtx.scale(layer.flipH ? -1 : 1, layer.flipV ? -1 : 1);
          }
        }
        
        targetCtx.globalAlpha = layer.opacity ?? 1;
        targetCtx.globalCompositeOperation = layer.blendMode || 'source-over';

        // 6. Resolve drawable + crop handling
        targetCtx.save();

        const resolved = await this.resolveDrawable(layer.frame as any);
        let drawable: CanvasImageSource = resolved.drawable;

        // Apply AI background removal mask if enabled
        if (layer.aiBackground?.enabled && layer.frame) {
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
          
          // Use layer properties (not frame — raw VideoFrame has no clipId/sourceTime)
          const clipId = layer.clipId || '_default';
          const modelSelection = layer.aiBackground.modelSelection ?? 1;
          const choke = layer.aiBackground.choke ?? 0;
          const feather = layer.aiBackground.feather ?? layer.aiBackground.edgeBlur ?? 0;
          const spillSuppression = layer.aiBackground.spillSuppression ?? 0;
          const spillColor = layer.aiBackground.spillColor;
          
          // Source media time: timeline time minus clip start.
          // The pre-rendered AI mask cache is keyed by SOURCE media time (what
          // the preview's video element reports: trimStart + elapsed·speed), so
          // the speed/trim-aware mapping is REQUIRED — clip-local time missed
          // the cache for trimmed or speed-changed clips and the cutout
          // silently vanished on export.
          const sourceTime = layer.sourceMediaTime ?? ((layer.timestampSeconds ?? 0) - (layer.startTime ?? 0));
          
          // Attach currentTime to drawable so getVideoCurrentTime can look up the temporal mask,
          // and so applyPreRenderedMaskIfAvailable can draw real frame pixels in blur/color/outline modes.
          (drawable as any).currentTime = sourceTime;
          
          const extraOptions = {
            mode: layer.aiBackground.mode ?? 'remove',
            blurStrength: layer.aiBackground.blurStrength ?? 12,
            strokeColor: layer.aiBackground.strokeColor ?? '#ffffff',
            strokeWidth: layer.aiBackground.strokeWidth ?? 4,
            strokeGlow: layer.aiBackground.strokeGlow ?? false,
            bgColor: layer.aiBackground.bgColor ?? '#1e1e24',
            isExporting: true,
          };

          // Try to apply the cached mask
          const maskApplied = applyPreRenderedMaskIfAvailable(
            tempCtx,
            tempCanvas.width,
            tempCanvas.height,
            drawable as any,
            clipId,
            false, // isPlaying = false for export
            modelSelection,
            choke,
            feather,
            spillSuppression,
            spillColor,
            extraOptions
          );
          
          if (maskApplied) {
            drawable = tempCanvas;
          }
        }
        
        // Apply object removal inpainting if enabled
        if (layer.objectRemoval?.enabled && layer.frame) {
          try {
            const curW = (drawable as any).width || (drawable as any).videoWidth || W;
            const curH = (drawable as any).height || (drawable as any).videoHeight || H;
            // Use layer properties — raw VideoFrame has no clipId/sourceTime/animations.
            // FrameScheduler already pre-interpolated objectRemoval keyframes, so
            // animations=undefined avoids redundant re-interpolation.
            const sourceTime = (layer.timestampSeconds ?? 0) - (layer.startTime ?? 0);
            const inpaintedCanvas = generateObjectRemovalInpaint(
              curW,
              curH,
              layer.objectRemoval,
              sourceTime,
              layer.startTime || 0,
              drawable,
              undefined,  // animations already pre-interpolated by FrameScheduler
              layer.clipId || '_default'
            );
            drawable = inpaintedCanvas;
          } catch (err) {
            console.warn('[Compositor] Object removal failed:', err);
          }
        }

        // If perspective warp (perspective pin or 3D rotation) is enabled,
        // draw using the corner-warp grid matching preview.
        if (hasPerspectiveWarp) {
          let warpCorners: { x0: number; y0: number; x1: number; y1: number; x2: number; y2: number; x3: number; y3: number };
          if (hasPerspectivePin && layer.perspectiveCorners) {
            const corners = layer.perspectiveCorners as any;
            const inX0 = corners.x0 ?? corners.topLeft?.x ?? 0;
            const inY0 = corners.y0 ?? corners.topLeft?.y ?? 0;
            const inX1 = corners.x1 ?? corners.topRight?.x ?? viewW;
            const inY1 = corners.y1 ?? corners.topRight?.y ?? 0;
            const inX2 = corners.x2 ?? corners.bottomRight?.x ?? viewW;
            const inY2 = corners.y2 ?? corners.bottomRight?.y ?? viewH;
            const inX3 = corners.x3 ?? corners.bottomLeft?.x ?? 0;
            const inY3 = corners.y3 ?? corners.bottomLeft?.y ?? viewH;

            const ccx = (inX0 + inX1 + inX2 + inX3) / 4;
            const ccy = (inY0 + inY1 + inY2 + inY3) / 4;
            const rotRad = ((layer.transform.rotation || 0) * Math.PI) / 180;
            const cos = Math.cos(rotRad);
            const sin = Math.sin(rotRad);
            const aX = layer.transform.x || 0;
            const aY = layer.transform.y || 0;

            const transformCorner = (x: number, y: number) => {
              let dx = (x - ccx) * finalScale;
              let dy = (y - ccy) * finalScale;
              const rx = dx * cos - dy * sin;
              const ry = dx * sin + dy * cos;
              return {
                x: (ccx + rx + aX) * exportScaleX,
                y: (ccy + ry + aY) * exportScaleY,
              };
            };

            let c0 = transformCorner(inX0, inY0);
            let c1 = transformCorner(inX1, inY1);
            let c2 = transformCorner(inX2, inY2);
            let c3 = transformCorner(inX3, inY3);

            if (layer.flipH) {
              const t0 = c0; c0 = c1; c1 = t0;
              const t3 = c3; c3 = c2; c2 = t3;
            }
            if (layer.flipV) {
              const t0 = c0; c0 = c3; c3 = t0;
              const t1 = c1; c1 = c2; c2 = t1;
            }
            warpCorners = { x0: c0.x, y0: c0.y, x1: c1.x, y1: c1.y, x2: c2.x, y2: c2.y, x3: c3.x, y3: c3.y };
          } else {
            const D = 800 * (W / viewW);
            warpCorners = getProjectedCorners(
              vw, vh,
              finalScale * scaleToFit,
              layer.rotationX || 0,
              layer.rotationY || 0,
              layer.transform.rotation || 0,
              tx, ty,
              cx, cy,
              D,
              !!layer.flipH,
              !!layer.flipV
            );
          }

          // Apply the perspective texture warp using the same 8×8 grid as preview
          drawPerspectiveTexture(
            targetCtx as unknown as CanvasRenderingContext2D,
            drawable,
            warpCorners
          );

          finishLayer();
          if (resolved.cleanup) resolved.cleanup();
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
        targetCtx.filter = cssFilters.length ? cssFilters.join(' ') : 'none';

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

        // ── Geometric masks ─────────────────────────────────────────────────
        // Rasterized onto the clip's content buffer below (destination-in),
        // mirroring the preview's applyClipMaskOffscreen. This supports ALL
        // mask types (incl. invert, feather, roundness, rect rotation and the
        // split/filmstrip/heart/star shapes) — the old clip()-based path
        // silently dropped invert/feather/roundness/rotation, ignored most
        // shapes, had no matte path, and even defaulted size differently
        // (100 vs the preview's 50). 'matte' rasterizes to null with a
        // one-time warning (source clip unavailable in the worker).
        const mask = layer.mask;
        const useGeomMask = !!mask?.enabled;

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
                  false,
                  layer.fxSettings
                );
              }

              if (useGeomMask) {
                applyGeometricMaskToCanvas(
                  tempCtx as unknown as CanvasRenderingContext2D,
                  mask!,
                  tempCanvas.width,
                  tempCanvas.height
                );
              }

              targetCtx.filter = 'none';
              targetCtx.drawImage(tempCanvas, dX, dY, dW, dH);
            } else {
              if (srcRot !== 0) targetCtx.rotate((srcRot * Math.PI) / 180);
              targetCtx.drawImage(drawable as any, sx, sy, sW, sH, dX, dY, dW, dH);
            }
          } else if (useGeomMask) {
            // Geometric mask without pixel-FX: rasterize the content into a
            // temp buffer so the (possibly inverted/feathered/rotated) mask
            // can be composited with destination-in — clip() cannot express
            // those. Rotation of the SOURCE happens in buffer space so the
            // mask percentages stay relative to the clip rect, like preview.
            const mwpx = Math.max(1, Math.round(dW));
            const mhpx = Math.max(1, Math.round(dH));
            const mCanvas = new OffscreenCanvas(mwpx, mhpx);
            const mCtx = mCanvas.getContext('2d', { alpha: true }) as OffscreenCanvasRenderingContext2D | null;
            if (mCtx) {
              mCtx.filter = cssFilters.length ? cssFilters.join(' ') : 'none';
              if (srcRot !== 0) {
                mCtx.translate(dW / 2, dH / 2);
                mCtx.rotate((srcRot * Math.PI) / 180);
                mCtx.drawImage(drawable as any, sx, sy, sW, sH, -dW / 2, -dH / 2, dW, dH);
              } else if (sx !== 0 || sy !== 0 || sW !== srcFullW || sH !== srcFullH) {
                mCtx.drawImage(drawable as any, sx, sy, sW, sH, 0, 0, dW, dH);
              } else {
                mCtx.drawImage(drawable, 0, 0, dW, dH);
              }
              mCtx.filter = 'none';
              applyGeometricMaskToCanvas(mCtx as unknown as CanvasRenderingContext2D, mask!, mwpx, mhpx);
              targetCtx.drawImage(mCanvas, dX, dY, dW, dH);
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
        
        finishLayer();
      }
    }

    // Full-frame transition overlays (flat colour or directional gradient band)
    for (const ov of overlays) {
      if (!ov || !(ov.alpha > 0.001)) continue;
      targetCtx.save();
      targetCtx.globalAlpha = Math.min(1, ov.alpha);
      if (ov.rect && ov.gradientDir) {
        const W = this.canvas.width;
        const H = this.canvas.height;
        const x = ov.rect.x * W, y = ov.rect.y * H, w = ov.rect.w * W, h = ov.rect.h * H;
        let g: CanvasGradient;
        switch (ov.gradientDir) {
          case 'right': g = targetCtx.createLinearGradient(x, 0, x + w, 0); break;
          case 'up':    g = targetCtx.createLinearGradient(0, y + h, 0, y); break;
          case 'down':  g = targetCtx.createLinearGradient(0, y, 0, y + h); break;
          case 'left':
          default:      g = targetCtx.createLinearGradient(x + w, 0, x, 0); break;
        }
        g.addColorStop(0, ov.color);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        targetCtx.fillStyle = g as any;
        targetCtx.fillRect(x, y, w, h);
      } else {
        targetCtx.fillStyle = ov.color;
        targetCtx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      }
      targetCtx.restore();
    }

    // Full-frame transition pixel post-effect (rgbSplit / pixelate).
    // Applied after layers + overlays so the exported frame matches the
    // preview's transition composite order.
    if (postEffect && postEffect.type !== 'none' && postEffect.amount > 0.001) {
      applyTransitionPostEffect(this.ctx, this.canvas.width, this.canvas.height, postEffect.type, postEffect.amount);
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
      if (!layer.fxSettings) continue;
      if (layer.fxSettings.enabled === false) continue;
      if ((layer.fxSettings.intensity ?? 100) <= 0) continue;
      if (layer.type === 'video' && layer.frame) continue;
      const localTime = Math.max(0, (layer.timestampSeconds ?? 0) - (layer.startTime ?? 0));
      // Custom HTML/CSS FX: render via SceneStage pipeline
      if (layer.fxSettings.type === 'custom_html' && layer.fxSettings.customHtmlCss) {
        const cacheKey = layer.clipId || `fx-${layer.order ?? 0}`;
        const htmlHash = _exportSimpleHash(layer.fxSettings.customHtmlCss);
        let cached = _exportFxStageCache.get(cacheKey);
        if (!cached || cached.htmlHash !== htmlHash) {
          if (cached) destroySceneStage(cached.stage);
          const stage = createSceneStage(layer.fxSettings.customHtmlCss, {
            width: this.canvas.width, height: this.canvas.height, transparent: true,
          });
          if (stage) {
            cached = { stage, seekMode: stage.hasAnimations ? 'css' : 'static', htmlHash };
            _exportFxStageCache.set(cacheKey, cached);
          }
        }
        if (cached) {
          try {
            await captureSceneFrame(cached.stage, this.canvas, localTime, cached.seekMode);
          } catch (e) {
            console.warn('[Compositor] Custom FX export render error:', e);
          }
        }
      } else {
        applyFxEffect(
          targetCtx as unknown as CanvasRenderingContext2D,
          this.canvas.width,
          this.canvas.height,
          layer.fxSettings.type,
          layer.fxSettings.intensity ?? 100,
          localTime,
          false,
          layer.fxSettings
        );
      }
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
    const out = { opacity: 1, scaleX: 1, scaleY: 1, offsetX: 0, offsetY: 0, rotation: 0 };

    // Reset per-frame text animation flags to prevent stale state leaking across frames
    delete clip.__revealWipeProgress;
    delete clip.__letterSpacingProgress;
    delete clip.__waveProgress;
    delete clip.__scrambleProgress;
    delete clip.__colorCyclePhase;

    const anim = clip?.textSettings?.animation;
    if (!anim) return out;

    const currentTime = timestampSeconds ?? 0;
    const startTime = clip.startTime || 0;
    const duration = clip.duration || 0;
    const inDuration = anim.inDuration || 0.1;
    const outDuration = anim.outDuration || 0.1;
    const timeSinceStart = currentTime - startTime;
    const timeUntilEnd = startTime + duration - currentTime;

    const easingType = anim.easing || 'easeOut';

    if (timeSinceStart < inDuration && timeSinceStart >= 0) {
      const rawProgress = inDuration > 0 ? timeSinceStart / inDuration : 1;
      const needsCustomEasing = !['bounce', 'elastic', 'dropBounce'].includes(anim.in);
      const progress = needsCustomEasing ? applyEasing(rawProgress, easingType) : rawProgress;
      switch (anim.in) {
        case 'fadeIn':
          out.opacity = progress;
          break;
        case 'zoom':
          out.scaleX = out.scaleY = progress;
          out.opacity = progress;
          break;
        case 'bounce':
          out.scaleX = out.scaleY = 1 - Math.cos(rawProgress * Math.PI * 2) * (1 - rawProgress) * 0.5;
          break;
        case 'slideUp':
          out.offsetY = (1 - progress) * 100;
          out.opacity = Math.min(1, rawProgress * 3);
          break;
        case 'slideDown':
          out.offsetY = -(1 - progress) * 100;
          out.opacity = Math.min(1, rawProgress * 3);
          break;
        case 'slideLeft':
          out.offsetX = (1 - progress) * 100;
          out.opacity = Math.min(1, rawProgress * 3);
          break;
        case 'slideRight':
          out.offsetX = -(1 - progress) * 100;
          out.opacity = Math.min(1, rawProgress * 3);
          break;
        case 'elastic': {
          const ep = rawProgress;
          out.scaleX = out.scaleY = Math.pow(2, -10 * ep) * Math.sin((ep * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
          break;
        }
        case 'scaleFlip':
          out.scaleY = progress;
          break;
        case 'zoomBlur':
          out.scaleX = out.scaleY = 1 + (1 - progress);
          out.opacity = progress;
          break;
        case 'revealWipe':
          clip.__revealWipeProgress = progress;
          break;
        case 'splitReveal':
          out.scaleX = out.scaleY = 0.1 + progress * 0.9;
          out.opacity = progress;
          break;
        case 'glitch': {
          const intensity = (1 - rawProgress) * 15;
          out.offsetX = (Math.random() - 0.5) * intensity;
          out.offsetY = (Math.random() - 0.5) * intensity * 0.5;
          out.opacity = rawProgress > 0.1 ? 1 : rawProgress * 10;
          break;
        }
        case 'letterSpacing':
          clip.__letterSpacingProgress = progress;
          out.opacity = Math.min(1, rawProgress * 2);
          break;
        case 'rollUp':
          out.offsetY = (1 - progress) * 150;
          out.opacity = progress;
          out.scaleY = 0.6 + progress * 0.4;
          break;
        case 'spinIn':
          out.rotation = (1 - progress) * 360;
          out.scaleX = out.scaleY = progress;
          out.opacity = Math.min(1, rawProgress * 2);
          break;
        case 'dropBounce': {
          let t = rawProgress;
          let bounceVal = 0;
          if (t < 0.3636) bounceVal = 7.5625 * t * t;
          else if (t < 0.7272) bounceVal = 7.5625 * (t -= 0.5454) * t + 0.75;
          else if (t < 0.9090) bounceVal = 7.5625 * (t -= 0.8181) * t + 0.9375;
          else bounceVal = 7.5625 * (t -= 0.9545) * t + 0.984375;
          out.offsetY = -(1 - bounceVal) * 200;
          out.opacity = Math.min(1, rawProgress * 3);
          break;
        }
        case 'flipX':
          out.scaleY = Math.abs(Math.cos((1 - progress) * Math.PI));
          out.opacity = rawProgress > 0.15 ? 1 : rawProgress * 6;
          break;
        case 'flipY':
          out.scaleX = Math.abs(Math.cos((1 - progress) * Math.PI));
          out.opacity = rawProgress > 0.15 ? 1 : rawProgress * 6;
          break;
        case 'blurIn':
          out.opacity = progress;
          out.scaleX = out.scaleY = 1 + (1 - progress) * 0.08;
          break;
        case 'expandWidth':
          out.scaleX = progress;
          out.scaleY = 1;
          out.opacity = Math.min(1, rawProgress * 2);
          break;
        case 'wave':
          clip.__waveProgress = progress;
          out.opacity = Math.min(1, rawProgress * 2);
          break;
        case 'scramble':
          clip.__scrambleProgress = rawProgress;
          out.opacity = 1;
          break;
        default:
          break;
      }
    } else if (timeUntilEnd < outDuration && timeUntilEnd >= 0) {
      const rawProgress = outDuration > 0 ? 1 - timeUntilEnd / outDuration : 1;
      const needsCustomEasing = !['bounce', 'elastic'].includes(anim.out);
      const progress = needsCustomEasing ? applyEasing(rawProgress, easingType) : rawProgress;
      switch (anim.out) {
        case 'fadeOut':
          out.opacity = 1 - progress;
          break;
        case 'zoom':
          out.scaleX = out.scaleY = 1 - progress;
          out.opacity = 1 - progress;
          break;
        case 'bounce':
          out.scaleX = out.scaleY = 1 - Math.cos(rawProgress * Math.PI * 2) * (1 - rawProgress) * 0.5;
          break;
        case 'slideUp':
          out.offsetY = -(progress * 100);
          out.opacity = 1 - Math.min(1, rawProgress * 1.5);
          break;
        case 'slideDown':
          out.offsetY = progress * 100;
          out.opacity = 1 - Math.min(1, rawProgress * 1.5);
          break;
        case 'slideLeft':
          out.offsetX = -(progress * 100);
          out.opacity = 1 - Math.min(1, rawProgress * 1.5);
          break;
        case 'slideRight':
          out.offsetX = progress * 100;
          out.opacity = 1 - Math.min(1, rawProgress * 1.5);
          break;
        case 'elastic': {
          const ep = rawProgress;
          out.scaleX = out.scaleY = Math.pow(2, -10 * ep) * Math.sin((ep * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
          break;
        }
        case 'scaleFlip':
          out.scaleY = 1 - progress;
          break;
        case 'zoomBlur':
          out.scaleX = out.scaleY = 1 + progress;
          out.opacity = 1 - progress;
          break;
        case 'revealWipe':
          clip.__revealWipeProgress = 1 - progress;
          break;
        case 'splitReveal':
          out.scaleX = out.scaleY = 0.1 + (1 - progress) * 0.9;
          out.opacity = 1 - progress;
          break;
        case 'glitch': {
          const intensity = rawProgress * 15;
          out.offsetX = (Math.random() - 0.5) * intensity;
          out.offsetY = (Math.random() - 0.5) * intensity * 0.5;
          out.opacity = rawProgress < 0.9 ? 1 : (1 - rawProgress) * 10;
          break;
        }
        case 'letterSpacing':
          clip.__letterSpacingProgress = 1 - progress;
          out.opacity = Math.min(1, (1 - rawProgress) * 2);
          break;
        case 'rollUp':
          out.offsetY = -(progress * 150);
          out.opacity = 1 - progress;
          out.scaleY = 0.6 + (1 - progress) * 0.4;
          break;
        case 'spinIn':
          out.rotation = progress * 360;
          out.scaleX = out.scaleY = 1 - progress;
          out.opacity = 1 - Math.min(1, rawProgress * 1.5);
          break;
        case 'dropBounce': {
          out.offsetY = progress * 200;
          out.opacity = 1 - progress;
          break;
        }
        case 'flipX':
          out.scaleY = Math.abs(Math.cos(progress * Math.PI));
          out.opacity = Math.min(1, (1 - rawProgress) * 2);
          break;
        case 'flipY':
          out.scaleX = Math.abs(Math.cos(progress * Math.PI));
          out.opacity = Math.min(1, (1 - rawProgress) * 2);
          break;
        case 'blurIn':
          out.opacity = 1 - progress;
          out.scaleX = out.scaleY = 1 + progress * 0.08;
          break;
        case 'expandWidth':
          out.scaleX = 1 - progress;
          out.scaleY = 1;
          out.opacity = 1 - Math.min(1, rawProgress * 1.5);
          break;
        case 'wave':
          clip.__waveProgress = 1 - progress;
          out.opacity = Math.min(1, (1 - rawProgress) * 2);
          break;
        case 'scramble':
          clip.__scrambleProgress = 1 - rawProgress;
          out.opacity = rawProgress > 0.8 ? (1 - rawProgress) * 5 : 1;
          break;
        default:
          break;
      }
    }
    
    else if (anim.loop && anim.loop !== 'none') {
      const loopSpeed = anim.loopSpeed || 1;
      const t = timeSinceStart * loopSpeed;
      switch (anim.loop) {
        case 'wiggle': {
          const clipSeed = clip.id ? clip.id.charCodeAt(0) + clip.id.charCodeAt(Math.min(1, clip.id.length - 1)) : 42;
          out.rotation += (smoothNoise(clipSeed + 200, t, 2) - 0.5) * 3;
          out.offsetX += (smoothNoise(clipSeed, t, 3) - 0.5) * 6;
          out.offsetY += (smoothNoise(clipSeed + 100, t, 2.5) - 0.5) * 4;
          break;
        }
        case 'pulse': {
          const s = 1 + Math.sin(t * Math.PI * 2) * 0.03;
          out.scaleX *= s;
          out.scaleY *= s;
          break;
        }
        case 'float':
          out.offsetY += Math.sin(t * Math.PI * 0.8) * 8;
          out.offsetX += Math.cos(t * Math.PI * 0.5) * 3;
          break;
        case 'neonFlicker': {
          const clipSeed = clip.id ? clip.id.charCodeAt(0) + clip.id.charCodeAt(Math.min(1, clip.id.length - 1)) : 42;
          const flickerVal = smoothNoise(clipSeed, t, 8);
          out.opacity = flickerVal < 0.15 ? 0.7 : 1;
          break;
        }
        case 'shake': {
          const clipSeed = clip.id ? clip.id.charCodeAt(0) + clip.id.charCodeAt(Math.min(1, clip.id.length - 1)) : 42;
          out.offsetX += (smoothNoise(clipSeed, t, 12) - 0.5) * 8;
          break;
        }
        case 'colorCycle':
          clip.__colorCyclePhase = (t * 360) % 360;
          break;
      }
    } else {
      // Hold phase: keep intro's completed state so wipe / spacing remains stable
      if (anim.in === 'revealWipe') {
        clip.__revealWipeProgress = 1;
      } else if (anim.in === 'letterSpacing') {
        clip.__letterSpacingProgress = 1;
      } else if (anim.in === 'scramble') {
        clip.__scrambleProgress = 1;
      }
    }

    return out;
  }

  /**
   * Draw an element clip (Shape, Emoji, Sticker, Badge) with entry, continuous,
   * and exit animations matching Preview Canvas.
   */
  private renderElementLayer(layer: RenderLayer, renderCtx?: OffscreenCanvasRenderingContext2D) {
    const ctx = renderCtx ?? this.ctx;
    const es = (layer as any).elementSettings || (layer.clipData as any)?.elementSettings;
    if (!es) return;
    const w = es.width || 220;
    const h = es.height || 160;
    const clipStart = (layer as any).startTime ?? 0;
    const clipDuration = (layer.clipData as any)?.duration ?? 5;
    const anim = calculateElementAnimation(layer.timestampSeconds ?? 0, clipStart, clipDuration, es);

    const W = this.canvas.width;
    const H = this.canvas.height;
    const tr = layer.transform || { x: 0, y: 0, scale: 100, rotation: 0 };
    const px = W / 2 + (tr.x ?? 0);
    const py = H / 2 + (tr.y ?? 0);
    const scale = (tr.scale ?? 100) / 100;
    const rot = tr.rotation ?? 0;

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate((rot * Math.PI) / 180);
    ctx.scale(scale, scale);
    ctx.globalAlpha = (layer.opacity ?? 1);

    renderElement(ctx as any, es, w, h, anim);
    ctx.restore();
  }

  /**
   * Draw a text/title clip. Mirrors the preview's text branch in
   * CanvasRenderingEngine (font construction, background pill, stroke, shadow,
   * underline, and now entry/exit animation) scaled from the UI view space to
   * the export resolution.
   */
  private renderTextLayer(layer: RenderLayer, renderCtx?: OffscreenCanvasRenderingContext2D) {
    const ctx = renderCtx ?? this.ctx;
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

    ctx.save();

    const tg = layer.transitionGeometry;
    if (tg) {
      if (tg.clipRect) {
        ctx.beginPath();
        ctx.rect(tg.clipRect.x * W, tg.clipRect.y * H, tg.clipRect.w * W, tg.clipRect.h * H);
        ctx.clip();
      }
      ctx.translate(W / 2 + tg.translateX * W, H / 2 + tg.translateY * H);
      if (tg.rotation) ctx.rotate(tg.rotation);
      if (tg.scale !== 1) ctx.scale(tg.scale, tg.scale);
      ctx.translate(-W / 2, -H / 2);
    }

    const exportScaleX = W / viewW;
    const exportScaleY = H / viewH;
    const tx = (layer.transform.x || 0) * exportScaleX;
    const ty = (layer.transform.y || 0) * exportScaleY;

    let scale = layer.transform.scale ?? 100;
    if (scale <= 10 && scale > 0) scale = scale * 100; // legacy '1' scale
    const finalScale = (scale / 100) * uiScale;

    ctx.translate(W / 2 + tx, H / 2 + ty);
    ctx.rotate(((layer.transform.rotation || 0) * Math.PI) / 180);

    const rotX3d = layer.rotationX || 0;
    const rotY3d = layer.rotationY || 0;
    if (Math.abs(rotX3d) > 0.01 || Math.abs(rotY3d) > 0.01) {
      const sx3d = Math.cos((rotY3d * Math.PI) / 180);
      const sy3d = Math.cos((rotX3d * Math.PI) / 180);
      if (Math.abs(sx3d) > 0.001 && Math.abs(sy3d) > 0.001) {
        ctx.scale(sx3d, sy3d);
      }
    }

    const scaleX = finalScale * (layer.flipH ? -1 : 1);
    const scaleY = finalScale * (layer.flipV ? -1 : 1);
    ctx.scale(scaleX, scaleY);

    // Entry/exit animation: offset + scale compose inside the already-scaled
    // context exactly like the preview's text branch, so the exported motion
    // matches the editor frame-for-frame.
    ctx.translate(anim.offsetX, anim.offsetY);
    if (anim.rotation) {
      ctx.rotate((anim.rotation * Math.PI) / 180);
    }
    ctx.scale(anim.scaleX, anim.scaleY);

    ctx.globalAlpha = (layer.opacity ?? 1) * anim.opacity;
    ctx.globalCompositeOperation = layer.blendMode || 'source-over';

    const fontStyle: string[] = [];
    if (ts.italic) fontStyle.push('italic');
    if (ts.bold) fontStyle.push('bold');
    const fontWeightStyle = fontStyle.join(' ');
    const fontSize = ts.fontSize || 48;
    const fontFamily = ts.fontFamily ? `"${ts.fontFamily}", sans-serif` : 'sans-serif';
    ctx.font = `${fontWeightStyle ? fontWeightStyle + ' ' : ''}${fontSize}px ${fontFamily}`;
    const textAlign = ts.textAlign || 'center';
    ctx.textAlign = textAlign;
    ctx.textBaseline = 'middle';

    const lines = String(text).split('\n');
    const lineHeight = fontSize * 1.25;
    const blockHeight = lines.length * lineHeight;

    let maxLineWidth = 0;
    for (const line of lines) {
      maxLineWidth = Math.max(maxLineWidth, ctx.measureText(line).width);
    }
    const paddingX = fontSize * 0.5;
    const paddingY = fontSize * 0.3;

    // Background pill (matches preview padding maths)
    if (ts.backgroundColor && ts.backgroundColor !== 'transparent') {
      const bgX = -(maxLineWidth / 2) - paddingX;
      const bgY = -(blockHeight / 2) - paddingY;
      const bgW = maxLineWidth + paddingX * 2;
      const bgH = blockHeight + paddingY * 2;
      
      drawTextBackground(
        ctx,
        ts.backgroundStyle || 'solid_pill',
        bgX,
        bgY,
        bgW,
        bgH,
        ts.backgroundColor
      );
    }

    if (ts.shadow) {
      ctx.shadowColor = ts.shadowColor || 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = ts.shadowBlur !== undefined ? ts.shadowBlur : 10;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
    } else {
      ctx.shadowColor = 'transparent';
    }

    // ── Per-unit cascade animation & enhanced text rendering ────────────
    const perUnit = ts.animation?.perUnit || 'all';
    const stagger = ts.animation?.stagger || 0.05;
    const revealWipeProgress = clip.__revealWipeProgress;
    const letterSpacingProg = clip.__letterSpacingProgress;
    const waveProgress = clip.__waveProgress;
    const scrambleProgress = clip.__scrambleProgress;
    const colorCyclePhase = clip.__colorCyclePhase;

    // Gradient fill
    let textFillStyle: string | CanvasGradient = ts.color || '#ffffff';
    if (ts.gradientColors && ts.gradientColors.length >= 2) {
      const gDir = ts.gradientDirection || 'horizontal';
      const halfW = maxLineWidth / 2;
      const halfH = blockHeight / 2;
      let grad: CanvasGradient;
      if (gDir === 'vertical') {
        grad = ctx.createLinearGradient(0, -halfH, 0, halfH);
      } else if (gDir === 'diagonal') {
        grad = ctx.createLinearGradient(-halfW, -halfH, halfW, halfH);
      } else {
        grad = ctx.createLinearGradient(-halfW, 0, halfW, 0);
      }
      ts.gradientColors.forEach((c: string, idx: number) => {
        grad.addColorStop(idx / (ts.gradientColors!.length - 1), c);
      });
      textFillStyle = grad;
    }

    // Color cycle hue rotation
    if (colorCyclePhase !== undefined) {
      ctx.filter = `hue-rotate(${colorCyclePhase}deg)`;
    }

    // Reveal wipe clip
    if (revealWipeProgress !== undefined) {
      ctx.save();
      const wipeW = (maxLineWidth + paddingX * 2) * revealWipeProgress;
      ctx.beginPath();
      ctx.rect(-(maxLineWidth / 2) - paddingX, -(blockHeight / 2) - paddingY, wipeW, blockHeight + paddingY * 2);
      ctx.clip();
    }

    const firstLineY = -(blockHeight / 2) + lineHeight / 2;
    const needsPerUnit = (perUnit !== 'all' && ts.animation && (ts.animation.in !== 'none' || ts.animation.out !== 'none'))
      || letterSpacingProg !== undefined
      || waveProgress !== undefined
      || scrambleProgress !== undefined;

    if (needsPerUnit) {
      const currentTime = layer.timestampSeconds ?? 0;
      const inDuration = ts.animation?.inDuration || 0.5;
      const timeSinceStart = currentTime - (clip.startTime || 0);
      const timeUntilEnd = ((clip.startTime || 0) + (clip.duration || 0)) - currentTime;
      const outDuration = ts.animation?.outDuration || 0.5;
      const isInPhase = timeSinceStart < inDuration && timeSinceStart >= 0;
      const isOutPhase = timeUntilEnd < outDuration && timeUntilEnd >= 0;

      let unitIndex = 0;
      for (let i = 0; i < lines.length; i++) {
        const lineY = firstLineY + i * lineHeight;
        const lineText = lines[i];
        const lineTextWidth = ctx.measureText(lineText).width;

        let cursorX = 0;
        if (textAlign === 'left') {
          cursorX = -(maxLineWidth / 2);
        } else if (textAlign === 'right') {
          cursorX = (maxLineWidth / 2) - lineTextWidth;
        } else {
          cursorX = -(lineTextWidth / 2);
        }

        let units: { text: string; x: number; width: number }[] = [];
        if (perUnit === 'character' || letterSpacingProg !== undefined || waveProgress !== undefined || scrambleProgress !== undefined) {
          if (letterSpacingProg !== undefined) {
            const extraSpacing = (1 - letterSpacingProg) * fontSize * 0.3;
            const totalExtraWidth = extraSpacing * (lineText.length - 1);
            if (textAlign === 'left') {
              cursorX = -(maxLineWidth / 2);
            } else if (textAlign === 'right') {
              cursorX = (maxLineWidth / 2) - (lineTextWidth + totalExtraWidth);
            } else {
              cursorX = -((lineTextWidth + totalExtraWidth) / 2);
            }
            for (let c = 0; c < lineText.length; c++) {
              const ch = lineText[c];
              const chW = ctx.measureText(ch).width;
              units.push({ text: ch, x: cursorX + chW / 2, width: chW });
              cursorX += chW + extraSpacing;
            }
          } else {
            for (let c = 0; c < lineText.length; c++) {
              const ch = lineText[c];
              const chW = ctx.measureText(ch).width;
              units.push({ text: ch, x: cursorX + chW / 2, width: chW });
              cursorX += chW;
            }
          }
        } else {
          const words = lineText.split(/(\s+)/);
          for (const word of words) {
            const wW = ctx.measureText(word).width;
            units.push({ text: word, x: cursorX + wW / 2, width: wW });
            cursorX += wW;
          }
        }

        for (const unit of units) {
          ctx.save();
          const totalUnits = lines.reduce((sum, l) => sum + (perUnit === 'character' ? l.length : l.split(/\s+/).length), 0);
          const totalAnimTime = inDuration;
          const unitAnimTime = Math.max(0.02, totalAnimTime - (totalUnits - 1) * stagger);
          const unitDelay = unitIndex * stagger;
          let unitProgress = 1;
          
          if (isInPhase) {
            unitProgress = Math.max(0, Math.min(1, (timeSinceStart - unitDelay) / unitAnimTime));
          } else if (isOutPhase) {
            unitProgress = Math.max(0, Math.min(1, 1 - (timeSinceStart - ((clip.duration || 0) - outDuration) - unitDelay) / unitAnimTime));
          }

          let waveOffsetY = 0;
          if (waveProgress !== undefined) {
            waveOffsetY = Math.sin((unitIndex * 0.5) + waveProgress * Math.PI * 4) * fontSize * 0.3 * (1 - waveProgress);
          }

          let renderText = unit.text;
          if (scrambleProgress !== undefined && scrambleProgress < 1) {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
            if (Math.random() > scrambleProgress) {
              renderText = chars[Math.floor(Math.random() * chars.length)];
            }
          }

          const unitScale = perUnit !== 'all' ? unitProgress : 1;
          const unitOpacity = perUnit !== 'all' ? unitProgress : 1;

          ctx.globalAlpha *= unitOpacity;
          ctx.translate(unit.x, lineY + waveOffsetY);
          ctx.scale(unitScale, unitScale);

          if (ts.threeD && ts.threeDDepth) {
            const depth = ts.threeDDepth || 3;
            for (let d = depth; d > 0; d--) {
              const shade = Math.max(0, 1 - d * 0.15);
              ctx.save();
              ctx.translate(d * 1.5, d * 1.5);
              ctx.fillStyle = `rgba(0,0,0,${shade * 0.6})`;
              ctx.fillText(renderText, 0, 0);
              ctx.restore();
            }
          }

          if (ts.outerStrokeColor && ts.outerStrokeWidth) {
            ctx.strokeStyle = ts.outerStrokeColor;
            ctx.lineWidth = (ts.outerStrokeWidth || 4) + (ts.strokeWidth || 0);
            ctx.lineJoin = 'round';
            ctx.strokeText(renderText, 0, 0);
          }

          if (ts.strokeColor && ts.strokeWidth) {
            ctx.strokeStyle = ts.strokeColor;
            ctx.lineWidth = ts.strokeWidth;
            ctx.lineJoin = 'round';
            ctx.strokeText(renderText, 0, 0);
          }

          ctx.fillStyle = textFillStyle;
          ctx.fillText(renderText, 0, 0);

          ctx.restore();
          unitIndex++;
        }

        if (ts.underline) {
          let lineStartX = -lineTextWidth / 2;
          let lineEndX = lineTextWidth / 2;
          if (textAlign === 'left') {
            lineStartX = -maxLineWidth / 2;
            lineEndX = -maxLineWidth / 2 + lineTextWidth;
          } else if (textAlign === 'right') {
            lineStartX = maxLineWidth / 2 - lineTextWidth;
            lineEndX = maxLineWidth / 2;
          }
          ctx.save();
          ctx.shadowColor = 'transparent';
          ctx.beginPath();
          ctx.strokeStyle = ts.color || '#ffffff';
          ctx.lineWidth = Math.max(1, fontSize / 15);
          ctx.moveTo(lineStartX, lineY + fontSize * 0.45);
          ctx.lineTo(lineEndX, lineY + fontSize * 0.45);
          ctx.stroke();
          ctx.restore();
        }
      }
    } else {
      for (let i = 0; i < lines.length; i++) {
        const lineY = firstLineY + i * lineHeight;
        const lineText = lines[i];
        const lw = ctx.measureText(lineText).width;

        let lineAnchorX = 0;
        let lineStartX = -lw / 2;
        let lineEndX = lw / 2;

        if (textAlign === 'left') {
          lineAnchorX = -maxLineWidth / 2;
          lineStartX = -maxLineWidth / 2;
          lineEndX = -maxLineWidth / 2 + lw;
        } else if (textAlign === 'right') {
          lineAnchorX = maxLineWidth / 2;
          lineStartX = maxLineWidth / 2 - lw;
          lineEndX = maxLineWidth / 2;
        }

        if (ts.threeD && ts.threeDDepth) {
          const depth = ts.threeDDepth || 3;
          for (let d = depth; d > 0; d--) {
            const shade = Math.max(0, 1 - d * 0.15);
            ctx.save();
            ctx.translate(d * 1.5, d * 1.5);
            ctx.fillStyle = `rgba(0,0,0,${shade * 0.6})`;
            ctx.fillText(lineText, lineAnchorX, lineY);
            ctx.restore();
          }
        }

        if (ts.outerStrokeColor && ts.outerStrokeWidth) {
          ctx.strokeStyle = ts.outerStrokeColor;
          ctx.lineWidth = (ts.outerStrokeWidth || 4) + (ts.strokeWidth || 0);
          ctx.lineJoin = 'round';
          ctx.strokeText(lineText, lineAnchorX, lineY);
        }

        if (ts.strokeColor && ts.strokeWidth) {
          ctx.strokeStyle = ts.strokeColor;
          ctx.lineWidth = ts.strokeWidth;
          ctx.lineJoin = 'round';
          ctx.strokeText(lineText, lineAnchorX, lineY);
        }

        ctx.fillStyle = textFillStyle;
        ctx.fillText(lineText, lineAnchorX, lineY);

        if (ts.underline) {
          ctx.save();
          ctx.shadowColor = 'transparent';
          ctx.beginPath();
          ctx.strokeStyle = ts.color || '#ffffff';
          ctx.lineWidth = Math.max(1, fontSize / 15);
          ctx.moveTo(lineStartX, lineY + fontSize * 0.45);
          ctx.lineTo(lineEndX, lineY + fontSize * 0.45);
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    if (revealWipeProgress !== undefined) ctx.restore();
    if (colorCyclePhase !== undefined) ctx.filter = 'none';

    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';
  }

  private applyChromaKey(ctx: OffscreenCanvasRenderingContext2D, width: number, height: number, settings: { color: string; threshold: number; softness: number; spillSuppression: number; edgeFeather?: number }) {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    
    // Parse hex color with support for 3, 4, 6, 8 hex digits
    let hex = (settings.color || '#00ff00').replace('#', '').trim();
    if (hex.length === 3 || hex.length === 4) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    const kr = parseInt(hex.substring(0, 2), 16) || 0;
    const kg = parseInt(hex.substring(2, 4), 16) || 255;
    const kb = parseInt(hex.substring(4, 6), 16) || 0;
    
    const ku = -0.1687 * kr - 0.3313 * kg + 0.5 * kb + 128;
    const kv = 0.5 * kr - 0.4187 * kg - 0.0813 * kb + 128;
    const th = Math.max(0, settings.threshold) * 2.4;
    const soft = Math.max(0, settings.softness) * 2.4;
    
    const isGreenScreen = kg >= kr && kg >= kb;
    const isBlueScreen = kb >= kr && kb >= kg;

    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a === 0) continue;

      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      const u = -0.1687 * r - 0.3313 * g + 0.5 * b + 128;
      const v = 0.5 * r - 0.4187 * g - 0.0813 * b + 128;
      
      const dist = Math.sqrt((u - ku) ** 2 + (v - kv) ** 2);
      
      let alpha = 1.0;
      if (dist < th) {
        alpha = 0.0;
      } else if (dist < th + soft && soft > 0) {
        alpha = (dist - th) / soft;
      }
      
      data[i + 3] = Math.round(alpha * a);
      
      // Spill suppression on key boundary & fringe
      if (settings.spillSuppression > 0 && dist < th + soft + 30) {
        const factor = settings.spillSuppression / 100.0;
        if (isGreenScreen) {
          const excess = Math.max(0, g - Math.max(r, b));
          if (excess > 0) {
            const gSpill = excess * factor;
            data[i + 1] = Math.max(0, Math.round(g - gSpill));
            data[i] = Math.min(255, Math.round(r + gSpill * 0.25));
            data[i + 2] = Math.min(255, Math.round(b + gSpill * 0.25));
          }
        } else if (isBlueScreen) {
          const excess = Math.max(0, b - Math.max(r, g));
          if (excess > 0) {
            const bSpill = excess * factor;
            data[i + 2] = Math.max(0, Math.round(b - bSpill));
            data[i] = Math.min(255, Math.round(r + bSpill * 0.25));
            data[i + 1] = Math.min(255, Math.round(g + bSpill * 0.25));
          }
        }
      }
    }

    // Edge feather: separable box blur on alpha channel (matches preview's blurAlphaChannel)
    const edgeFeather = settings.edgeFeather ?? 0;
    if (edgeFeather > 0) {
      const radius = Math.max(1, Math.floor(edgeFeather));
      this.blurAlphaChannel(imageData, radius);
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

  /**
   * Separable O(N) sliding-window box blur on the alpha channel only.
   * Mirrors the preview's blurAlphaChannel in canvasEffects.ts so chroma-keyed
   * clips export with the same soft feathered edges as the preview.
   */
  private blurAlphaChannel(imageData: ImageData, radius: number): void {
    const { width: w, height: h, data } = imageData;
    if (w * h === 0 || radius <= 0) return;
    radius = Math.min(radius, Math.floor(Math.min(w, h) / 2));

    const size = w * h;
    const alpha = new Float32Array(size);
    const temp = new Float32Array(size);

    for (let i = 0; i < size; i++) alpha[i] = data[i * 4 + 3];

    // Horizontal pass
    for (let y = 0; y < h; y++) {
      let sum = 0;
      for (let x = 0; x <= radius; x++) sum += alpha[y * w + x];
      for (let x = 0; x < w; x++) {
        const left = Math.max(0, x - radius - 1);
        const right = Math.min(w - 1, x + radius);
        const count = right - left + 1;
        if (x > 0) { sum -= alpha[y * w + left]; sum += alpha[y * w + right]; }
        temp[y * w + x] = sum / count;
      }
    }

    // Vertical pass
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let y = 0; y <= radius; y++) sum += temp[y * w + x];
      for (let y = 0; y < h; y++) {
        const top = Math.max(0, y - radius - 1);
        const bottom = Math.min(h - 1, y + radius);
        const count = bottom - top + 1;
        if (y > 0) { sum -= temp[top * w + x]; sum += temp[bottom * w + x]; }
        alpha[y * w + x] = sum / count;
      }
    }

    for (let i = 0; i < size; i++) data[i * 4 + 3] = Math.floor(alpha[i]);
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
