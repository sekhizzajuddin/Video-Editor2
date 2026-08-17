import { RenderLayer, FrameOverlay } from './FrameScheduler';
import { ExportWorkerConfig } from './export.worker';

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

  public async render(layers: RenderLayer[], overlays: FrameOverlay[] = []) {
    // Diagnostic log to see if layers are being dropped before compositor
    if (Math.random() < 0.05) { // Log occasionally to avoid spam
       console.log('[Compositor] rendering frame with layers:', layers.map(l => ({ type: l.type, zIndex: l.zIndex })));
    }

    // Fill background
    this.ctx.fillStyle = '#0a0a0a';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    for (const layer of layers) {
      if (layer.type === 'text') {
        // Text/title clips previously had NO export path at all — the preview
        // showed them but the rendered file dropped them (or produced a black
        // frame when text was the only visible layer).
        this.renderTextLayer(layer);
        continue;
      }
      if (layer.type === 'video' && layer.frame) {
        this.ctx.save();

        // Clip-to-clip transition geometry. Expressed in fractions of the frame by
        // the shared transition engine, so it maps onto any export resolution.
        // Applied OUTSIDE the clip's own transform so it behaves like a camera
        // move on the finished layer, exactly as the preview does it.
        const tg = layer.transitionGeometry;
        if (tg) {
          const CW = this.canvas.width;
          const CH = this.canvas.height;
          if (tg.clipRect) {
            this.ctx.beginPath();
            this.ctx.rect(
              tg.clipRect.x * CW,
              tg.clipRect.y * CH,
              tg.clipRect.w * CW,
              tg.clipRect.h * CH
            );
            this.ctx.clip();
          }
          this.ctx.translate(CW / 2 + tg.translateX * CW, CH / 2 + tg.translateY * CH);
          if (tg.rotation) this.ctx.rotate(tg.rotation);
          if (tg.scale !== 1) this.ctx.scale(tg.scale, tg.scale);
          this.ctx.translate(-CW / 2, -CH / 2);
        }

        const frameAny = layer.frame as any;
        let vw = frameAny.displayWidth || frameAny.codedWidth || frameAny.width || 1920;
        let vh = frameAny.displayHeight || frameAny.codedHeight || frameAny.height || 1080;
        const srcRot = layer.sourceRotation || 0;
        const isRotated = srcRot === 90 || srcRot === 270 || srcRot === -90;
        if (isRotated) {
          vw = frameAny.displayHeight || frameAny.codedHeight || frameAny.height || 1080;
          vh = frameAny.displayWidth || frameAny.codedWidth || frameAny.width || 1920;
        }

        const W = this.canvas.width;
        const H = this.canvas.height;
        
        // 1. Calculate active view dimensions based on PROJECT aspect ratio (matches UI preview)
        let viewW = 854;
        let viewH = 480;
        if (this.aspectRatio === '9:16') {
            viewW = Math.round(480 * (9 / 16));
        } else if (this.aspectRatio === '1:1') {
            viewW = 480;
        } else if (this.aspectRatio === '4:3') {
            viewW = Math.round(480 * (4 / 3));
        }

        // 2. Calculate base size to fit the export canvas (matching UI previewMath.ts)
        const scaleToFit = Math.min(W / vw, H / vh);
        const baseW = vw * scaleToFit;
        const baseH = vh * scaleToFit;

        // 3. Extract and convert scale (UI uses 100 for 100%)
        let scale = layer.transform.scale;
        if (scale <= 10 && scale > 0) scale = scale * 100; // Auto-correct legacy '1' scale
        const finalScale = scale / 100;
        
        const finalW = baseW * finalScale;
        const finalH = baseH * finalScale;

        // 4. Scale UI coordinates (relative to viewW x viewH) to Export Resolution
        // UI coordinates (transform.x/y) represent 1 unit per pixel in the view area.
        // We need to scale these units up to the export canvas size.
        const exportScaleX = W / viewW;
        const exportScaleY = H / viewH;
        
        const tx = layer.transform.x * exportScaleX;
        const ty = layer.transform.y * exportScaleY;

        // 5. Apply global translation + rotation
        const cx = W / 2;
        const cy = H / 2;
        this.ctx.translate(cx + tx, cy + ty);
        this.ctx.rotate((layer.transform.rotation * Math.PI) / 180);
        
        this.ctx.globalAlpha = layer.opacity;
        // Honour the clip's blend mode (Multiply/Screen/Overlay/...). Without this
        // the export silently flattened every blended clip to Normal.
        this.ctx.globalCompositeOperation = layer.blendMode || 'source-over';

        // 6. Draw the frame, applying source metadata rotation
        this.ctx.save();
        
        const drawable: CanvasImageSource = layer.frame;
        
        if (layer.chromaKey && layer.chromaKey.enabled) {
          // Optimization: Draw to a tightly-bound offscreen canvas first to apply Chroma Key ONLY 
          // to this layer's pixels, avoiding expensive 1080p full-canvas iteration and preventing 
          // background layer pixel destruction!
          const tempCanvas = new OffscreenCanvas(Math.max(1, finalW), Math.max(1, finalH));
          const tempCtx = tempCanvas.getContext('2d', { alpha: true }) as OffscreenCanvasRenderingContext2D;
          
          tempCtx.save();
          if (srcRot !== 0) {
            tempCtx.translate(finalW / 2, finalH / 2);
            tempCtx.rotate((srcRot * Math.PI) / 180);
            if (isRotated) {
              tempCtx.drawImage(drawable, -finalH / 2, -finalW / 2, finalH, finalW);
            } else {
              tempCtx.drawImage(drawable, -finalW / 2, -finalH / 2, finalW, finalH);
            }
          } else {
            if (isRotated) {
              // Should not happen if srcRot === 0, but fallback
              tempCtx.drawImage(drawable, 0, 0, finalH, finalW);
            } else {
              tempCtx.drawImage(drawable, 0, 0, finalW, finalH);
            }
          }
          tempCtx.restore();

          this.applyChromaKey(tempCtx, tempCanvas.width, tempCanvas.height, layer.chromaKey);
          
          this.ctx.drawImage(tempCanvas, -finalW / 2, -finalH / 2, finalW, finalH);
        } else {
          // Standard Draw
          if (srcRot !== 0) {
            this.ctx.rotate((srcRot * Math.PI) / 180);
          }
          
          if (isRotated) {
            this.ctx.drawImage(drawable, -finalH / 2, -finalW / 2, finalH, finalW);
          } else {
            this.ctx.drawImage(drawable, -finalW / 2, -finalH / 2, finalW, finalH);
          }
        }
        
        if (drawable !== layer.frame) {
          (drawable as ImageBitmap).close?.();
        }
        
        this.ctx.restore();
        this.ctx.restore();
        // Defensive: ctx.restore() already unwinds this, but an early return in a
        // future edit must never leak a blend mode onto the following layer.
        this.ctx.globalCompositeOperation = 'source-over';
      }
    }

    // Full-frame transition overlays (flash, dip-to-black/white, light leak).
    for (const ov of overlays) {
      if (!ov || !(ov.alpha > 0.001)) continue;
      this.ctx.save();
      this.ctx.globalAlpha = Math.min(1, ov.alpha);
      this.ctx.fillStyle = ov.color;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.restore();
    }
  }

  /**
   * Draw a text/title clip. Mirrors the preview's text branch in
   * CanvasRenderingEngine (font construction, background pill, stroke, shadow,
   * underline) scaled from the UI view space to the export resolution.
   */
  private renderTextLayer(layer: RenderLayer) {
    const clip = layer.textData || {};
    const ts = clip.textSettings || {
      text: clip.text || 'Text',
      fontSize: 48,
      fontFamily: 'sans-serif',
      color: '#ffffff',
    };
    const text: string = ts.text || clip.textContent || 'Text';
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

    this.ctx.globalAlpha = layer.opacity;
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
