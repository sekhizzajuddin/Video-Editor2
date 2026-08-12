import { RenderLayer } from './FrameScheduler';
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

  constructor(canvas: OffscreenCanvas) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', {
      willReadFrequently: true, // Optimizes for getImageData (used in Chroma Key)
      alpha: false,
    });
    if (!ctx) throw new Error('2D context not supported');
    this.ctx = ctx as OffscreenCanvasRenderingContext2D;
  }

  async render(layers: RenderLayer[]) {
    const ctx = this.ctx;
    
    // Clear background
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    for (const layer of layers) {
      if (layer.type === 'video' && layer.frame) {
        ctx.save();
        
        const vw = layer.frame.displayWidth;
        const vh = layer.frame.displayHeight;
        const W = this.canvas.width;
        const H = this.canvas.height;
        
        // 1. Calculate base size to fit the export canvas (matching UI previewMath.ts)
        const scaleToFit = Math.min(W / vw, H / vh);
        const baseW = vw * scaleToFit;
        const baseH = vh * scaleToFit;

        // 2. Extract and convert scale (UI uses 100 for 100%)
        // Fallback to 1.0 if scale is somehow 1 (old FrameScheduler bug)
        let scale = layer.transform.scale;
        if (scale <= 10 && scale > 0) scale = scale * 100; // Auto-correct legacy '1' scale
        const finalScale = scale / 100;
        
        const finalW = baseW * finalScale;
        const finalH = baseH * finalScale;

        // 3. Scale UI coordinates (854x480) to Export Resolution
        const exportScaleX = W / 854;
        const exportScaleY = H / 480;
        const tx = layer.transform.x * exportScaleX;
        const ty = layer.transform.y * exportScaleY;

        // 4. Apply global translation + rotation
        const cx = W / 2;
        const cy = H / 2;
        ctx.translate(cx + tx, cy + ty);
        ctx.rotate((layer.transform.rotation * Math.PI) / 180);
        
        ctx.globalAlpha = layer.opacity;

        // 5. Draw the frame exactly as sized
        ctx.drawImage(layer.frame, -finalW / 2, -finalH / 2, finalW, finalH);
        
        ctx.restore();

        // Apply Chroma Key (Green Screen) if enabled
        if (layer.chromaKey && layer.chromaKey.enabled) {
          this.applyChromaKey(layer.chromaKey);
        }
      }
    }
  }

  private applyChromaKey(settings: { color: string; threshold: number; softness: number; spillSuppression: number }) {
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;
    
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
    // 2D context doesn't require explicit GL resource disposal
  }
}
