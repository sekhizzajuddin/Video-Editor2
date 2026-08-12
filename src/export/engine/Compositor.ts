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
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  
  // Buffers and Uniforms
  private positionBuffer: WebGLBuffer;
  private texCoordBuffer: WebGLBuffer;
  private vao: WebGLVertexArrayObject;
  private texture: WebGLTexture;
  
  private matrixLocation: WebGLUniformLocation;
  private opacityLocation: WebGLUniformLocation;
  private ckEnabledLoc: WebGLUniformLocation;
  private ckColorLoc: WebGLUniformLocation;
  private ckThresholdLoc: WebGLUniformLocation;
  private ckSoftnessLoc: WebGLUniformLocation;
  private ckSpillLoc: WebGLUniformLocation;
  private ckTypeLoc: WebGLUniformLocation;
  
  constructor(canvas: OffscreenCanvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', {
      premultipliedAlpha: false,
      alpha: false,
      preserveDrawingBuffer: true,
      powerPreference: 'low-power', // Avoids competing with main thread for high-power GPU
      antialias: false,
      depth: false,
      stencil: false,
    });
    if (!gl) throw new Error('WebGL2 not supported');
    this.gl = gl;

    // Enable blending for transparency
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    // Compile shaders
    const vs = this.createShader(gl.VERTEX_SHADER, vertexShaderSource);
    const fs = this.createShader(gl.FRAGMENT_SHADER, fragmentShaderSource);
    this.program = this.createProgram(vs, fs);

    // Look up uniforms
    this.matrixLocation = gl.getUniformLocation(this.program, 'u_matrix')!;
    this.opacityLocation = gl.getUniformLocation(this.program, 'u_opacity')!;
    
    this.ckEnabledLoc = gl.getUniformLocation(this.program, 'u_chromaKeyEnabled')!;
    this.ckColorLoc = gl.getUniformLocation(this.program, 'u_keyColor')!;
    this.ckThresholdLoc = gl.getUniformLocation(this.program, 'u_threshold')!;
    this.ckSoftnessLoc = gl.getUniformLocation(this.program, 'u_softness')!;
    this.ckSpillLoc = gl.getUniformLocation(this.program, 'u_spillSuppression')!;
    this.ckTypeLoc = gl.getUniformLocation(this.program, 'u_keyType')!;

    // Create VAO
    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);

    // Set up positions
    this.positionBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      0, 0,
      1, 0,
      0, 1,
      0, 1,
      1, 0,
      1, 1,
    ]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    // Set up texture coords (note: WebGL has Y up, VideoFrames are usually Y down. We flip here)
    this.texCoordBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      0, 0,
      1, 0,
      0, 1,
      0, 1,
      1, 0,
      1, 1,
    ]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);

    // Create texture
    this.texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  }

  private createShader(type: number, source: string): WebGLShader {
    const gl = this.gl;
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader)!);
    }
    return shader;
  }

  private createProgram(vs: WebGLShader, fs: WebGLShader): WebGLProgram {
    const gl = this.gl;
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(prog)!);
    }
    return prog;
  }

  // Basic 3x3 matrix math for 2D transformations
  private getProjectionMatrix(width: number, height: number): Float32Array {
    return new Float32Array([
      2 / width, 0, 0,
      0, -2 / height, 0,
      -1, 1, 1,
    ]);
  }

  private m3Multiply(a: Float32Array, b: Float32Array): Float32Array {
    const m = new Float32Array(9);
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        m[i * 3 + j] = a[i * 3 + 0] * b[0 * 3 + j] +
                       a[i * 3 + 1] * b[1 * 3 + j] +
                       a[i * 3 + 2] * b[2 * 3 + j];
      }
    }
    return m;
  }

  private m3Translate(m: Float32Array, tx: number, ty: number): Float32Array {
    return this.m3Multiply(m, new Float32Array([
      1, 0, 0,
      0, 1, 0,
      tx, ty, 1,
    ]));
  }

  private m3Rotate(m: Float32Array, angleInRadians: number): Float32Array {
    const c = Math.cos(angleInRadians);
    const s = Math.sin(angleInRadians);
    return this.m3Multiply(m, new Float32Array([
      c, -s, 0,
      s, c, 0,
      0, 0, 1,
    ]));
  }

  private m3Scale(m: Float32Array, sx: number, sy: number): Float32Array {
    return this.m3Multiply(m, new Float32Array([
      sx, 0, 0,
      0, sy, 0,
      0, 0, 1,
    ]));
  }

  async render(layers: RenderLayer[]) {
    const gl = this.gl;
    
    // Check if the WebGL context has been lost (e.g. GPU pressure from main thread)
    if (gl.isContextLost()) {
      console.warn('[Compositor] WebGL context lost - using 2D canvas fallback for this frame');
      await this.render2DFallback(layers);
      return;
    }
    
    // Clear background
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);

    for (const layer of layers) {
      if (layer.type === 'video' && layer.frame) {
        
        // Upload VideoFrame to GPU
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, layer.frame);

        // Compute Transform Matrix
        let matrix = this.getProjectionMatrix(this.canvas.width, this.canvas.height);
        
        // Calculate center for transform origin
        const w = layer.frame.displayWidth;
        const h = layer.frame.displayHeight;
        const cx = this.canvas.width / 2;
        const cy = this.canvas.height / 2;

        // Apply global translation + rotation
        matrix = this.m3Translate(matrix, cx + layer.transform.x, cy + layer.transform.y);
        matrix = this.m3Rotate(matrix, (layer.transform.rotation * Math.PI) / 180);
        matrix = this.m3Scale(matrix, layer.transform.scale, layer.transform.scale);
        
        // Move back from center so draw goes from top-left of image
        matrix = this.m3Translate(matrix, -w / 2, -h / 2);
        
        // Scale to image dimensions
        matrix = this.m3Scale(matrix, w, h);

        gl.uniformMatrix3fv(this.matrixLocation, false, matrix);
        gl.uniform1f(this.opacityLocation, layer.opacity);

        if (layer.chromaKey && layer.chromaKey.enabled) {
          gl.uniform1i(this.ckEnabledLoc, 1);
          
          const hex = layer.chromaKey.color.replace('#', '');
          const r = parseInt(hex.substring(0, 2), 16) / 255.0;
          const g = parseInt(hex.substring(2, 4), 16) / 255.0;
          const b = parseInt(hex.substring(4, 6), 16) / 255.0;
          gl.uniform3f(this.ckColorLoc, r, g, b);
          
          gl.uniform1f(this.ckThresholdLoc, layer.chromaKey.threshold);
          gl.uniform1f(this.ckSoftnessLoc, layer.chromaKey.softness);
          gl.uniform1f(this.ckSpillLoc, layer.chromaKey.spillSuppression || 0);
          
          // Determine key type (1=green, 2=blue)
          let keyType = 0;
          if (g >= r && g >= b) keyType = 1;
          else if (b >= r && b >= g) keyType = 2;
          gl.uniform1i(this.ckTypeLoc, keyType);
        } else {
          gl.uniform1i(this.ckEnabledLoc, 0);
        }

        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }
      
      // TODO: Handle 'text' layers by rendering to 2D canvas, creating ImageBitmap, and passing to WebGL
    }
  }

  private async render2DFallback(layers: RenderLayer[]) {
    const ctx = this.canvas.getContext('2d') as OffscreenCanvasRenderingContext2D | null;
    if (!ctx) return;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    for (const layer of layers) {
      if (layer.type === 'video' && layer.frame) {
        ctx.globalAlpha = layer.opacity;
        ctx.drawImage(layer.frame, 0, 0, this.canvas.width, this.canvas.height);
        ctx.globalAlpha = 1;
      }
    }
  }

  dispose() {
    this.gl.deleteProgram(this.program);
    this.gl.deleteBuffer(this.positionBuffer);
    this.gl.deleteBuffer(this.texCoordBuffer);
    this.gl.deleteVertexArray(this.vao);
    this.gl.deleteTexture(this.texture);
  }
}
