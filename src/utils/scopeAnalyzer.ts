export interface ScopeData {
  waveform: {
    r: Uint32Array;
    g: Uint32Array;
    b: Uint32Array;
    luminance: Uint32Array;
    maxLuminance: number;
    maxRGB: number;
  };
  vectorscopeImageData: ImageData;
}

export class ScopeAnalyzer {
  private canvas: OffscreenCanvas;
  private ctx: OffscreenCanvasRenderingContext2D;
  private vectorscopeImageData: ImageData;
  private uvs: Uint32Array; // Accumulator for 256x256 vectorscope grid

  constructor() {
    // We analyze a small representation for performance (256x144 = 36864 pixels)
    // This is more than enough for scopes and extremely fast to iterate.
    this.canvas = new OffscreenCanvas(256, 144);
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })!;
    this.vectorscopeImageData = new ImageData(256, 256);
    this.uvs = new Uint32Array(256 * 256);
  }

  analyzeCanvas(sourceCanvas: HTMLCanvasElement, intensityMultiplier: number = 1.0): ScopeData | null {
    let imageData: ImageData;
    try {
      this.ctx.drawImage(sourceCanvas, 0, 0, this.canvas.width, this.canvas.height);
      imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    } catch (e) {
      // Catch SecurityError if canvas is tainted by cross-origin data
      console.warn('ScopeAnalyzer: Failed to get image data (likely tainted canvas)', e);
      return null;
    }
    
    const data = imageData.data;
    const pixelCount = data.length / 4;

    const waveform = {
      r: new Uint32Array(256),
      g: new Uint32Array(256),
      b: new Uint32Array(256),
      luminance: new Uint32Array(256),
      maxLuminance: 0,
      maxRGB: 0,
    };

    this.uvs.fill(0); // Reset vectorscope accumulator

    // 2. Accumulate histogram and UVs
    for (let i = 0; i < pixelCount; i++) {
      const idx = i * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];

      if (a === 0) continue; // Skip fully transparent

      // Waveform
      const luminance = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      waveform.luminance[luminance]++;
      waveform.r[r]++;
      waveform.g[g]++;
      waveform.b[b]++;

      // Vectorscope (YUV conversion)
      const u = 128 + (-0.169 * r - 0.331 * g + 0.5 * b);
      const v = 128 + (0.5 * r - 0.419 * g - 0.081 * b);

      const uClamped = Math.max(0, Math.min(255, Math.round(u)));
      const vClamped = Math.max(0, Math.min(255, Math.round(v)));

      this.uvs[vClamped * 256 + uClamped]++;
    }

    // Find max for waveform scaling
    for (let i = 0; i < 256; i++) {
      if (waveform.luminance[i] > waveform.maxLuminance) waveform.maxLuminance = waveform.luminance[i];
      if (waveform.r[i] > waveform.maxRGB) waveform.maxRGB = waveform.r[i];
      if (waveform.g[i] > waveform.maxRGB) waveform.maxRGB = waveform.g[i];
      if (waveform.b[i] > waveform.maxRGB) waveform.maxRGB = waveform.b[i];
    }

    // 3. Render Vectorscope to ImageData
    let maxUV = 1;
    for (let i = 0; i < this.uvs.length; i++) {
      if (this.uvs[i] > maxUV) maxUV = this.uvs[i];
    }

    const vData = this.vectorscopeImageData.data;
    const vScale = (255 / Math.sqrt(maxUV)) * intensityMultiplier;

    for (let v = 0; v < 256; v++) {
      for (let u = 0; u < 256; u++) {
        const idx = v * 256 + u;
        const hits = this.uvs[idx];
        const pIdx = idx * 4;

        if (hits > 0) {
          // Color based on hue
          const hue = Math.atan2(v - 128, u - 128); // -PI to PI
          const saturation = Math.min(1, Math.sqrt(Math.pow(u - 128, 2) + Math.pow(v - 128, 2)) / 128);
          
          // HSL to RGB
          const c = saturation;
          const x = c * (1 - Math.abs((((hue + Math.PI) / (Math.PI / 3)) % 2) - 1));
          const m = 1 - c;

          let r1, g1, b1;
          const hNorm = (hue + Math.PI) / (Math.PI / 3); 
          
          if (hNorm < 1) { r1 = c; g1 = x; b1 = 0; }
          else if (hNorm < 2) { r1 = x; g1 = c; b1 = 0; }
          else if (hNorm < 3) { r1 = 0; g1 = c; b1 = x; }
          else if (hNorm < 4) { r1 = 0; g1 = x; b1 = c; }
          else if (hNorm < 5) { r1 = x; g1 = 0; b1 = c; }
          else { r1 = c; g1 = 0; b1 = x; }

          const intensity = Math.min(255, Math.sqrt(hits) * vScale);
          
          vData[pIdx] = Math.round((r1 + m) * 255);
          vData[pIdx + 1] = Math.round((g1 + m) * 255);
          vData[pIdx + 2] = Math.round((b1 + m) * 255);
          vData[pIdx + 3] = Math.round(intensity);
        } else {
          vData[pIdx + 3] = 0;
        }
      }
    }

    return {
      waveform,
      vectorscopeImageData: this.vectorscopeImageData,
    };
  }
}

export const scopeAnalyzer = new ScopeAnalyzer();
