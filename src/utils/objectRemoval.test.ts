import { describe, it, expect, beforeEach } from 'vitest';
import { applyObjectRemoval, generateObjectRemovalInpaint, clearObjectRemovalCache } from './objectRemoval';
import type { ClipObjectRemovalSettings } from '@/types';

class MockCanvasContext {
  width: number;
  height: number;
  data: Uint8ClampedArray;
  globalAlpha: number = 1.0;
  globalCompositeOperation: string = 'source-over';
  imageSmoothingEnabled: boolean = true;
  filter: string = 'none';

  constructor(width: number, height: number, initialColor = [0, 128, 0, 255]) {
    this.width = width;
    this.height = height;
    this.data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < this.data.length; i += 4) {
      this.data[i] = initialColor[0];
      this.data[i + 1] = initialColor[1];
      this.data[i + 2] = initialColor[2];
      this.data[i + 3] = initialColor[3];
    }
  }

  get canvas() {
    return {
      width: this.width,
      height: this.height,
      getContext: () => this,
    };
  }

  save() {}
  restore() {}
  translate() {}
  rotate() {}
  beginPath() {}
  rect() {}
  ellipse() {}
  clip() {}
  stroke() {}
  fill() {}
  fillText() {}
  moveTo() {}
  lineTo() {}
  setLineDash() {}
  createLinearGradient() { return { addColorStop() {} }; }
  createRadialGradient() { return { addColorStop() {} }; }

  clearRect(x: number, y: number, w: number, h: number) {
    const startX = Math.max(0, Math.floor(x));
    const startY = Math.max(0, Math.floor(y));
    const endX = Math.min(this.width, Math.ceil(x + w));
    const endY = Math.min(this.height, Math.ceil(y + h));
    for (let py = startY; py < endY; py++) {
      for (let px = startX; px < endX; px++) {
        const idx = (py * this.width + px) * 4;
        this.data[idx] = 0;
        this.data[idx + 1] = 0;
        this.data[idx + 2] = 0;
        this.data[idx + 3] = 0;
      }
    }
  }

  getImageData(sx: number, sy: number, sw: number, sh: number) {
    const outData = new Uint8ClampedArray(sw * sh * 4);
    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        const srcX = Math.max(0, Math.min(this.width - 1, sx + x));
        const srcY = Math.max(0, Math.min(this.height - 1, sy + y));
        const srcIdx = (srcY * this.width + srcX) * 4;
        const dstIdx = (y * sw + x) * 4;
        outData[dstIdx] = this.data[srcIdx];
        outData[dstIdx + 1] = this.data[srcIdx + 1];
        outData[dstIdx + 2] = this.data[srcIdx + 2];
        outData[dstIdx + 3] = this.data[srcIdx + 3];
      }
    }
    return { data: outData, width: sw, height: sh };
  }

  createImageData(w: number, h: number) {
    return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h };
  }

  putImageData(imageData: { data: Uint8ClampedArray; width: number; height: number }, dx: number, dy: number) {
    const { data: inData, width: sw, height: sh } = imageData;
    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        const targetX = dx + x;
        const targetY = dy + y;
        if (targetX < 0 || targetX >= this.width || targetY < 0 || targetY >= this.height) continue;
        const srcIdx = (y * sw + x) * 4;
        const dstIdx = (targetY * this.width + targetX) * 4;
        this.data[dstIdx] = inData[srcIdx];
        this.data[dstIdx + 1] = inData[srcIdx + 1];
        this.data[dstIdx + 2] = inData[srcIdx + 2];
        this.data[dstIdx + 3] = inData[srcIdx + 3];
      }
    }
  }

  drawImage(source: any, ...args: number[]) {
    // Basic drawImage simulation
    let sx = 0, sy = 0, sw = this.width, sh = this.height;
    let dx = 0, dy = 0, dw = this.width, dh = this.height;

    if (args.length === 2) {
      dx = args[0]; dy = args[1];
    } else if (args.length === 4) {
      dx = args[0]; dy = args[1]; dw = args[2]; dh = args[3];
    } else if (args.length === 8) {
      sx = args[0]; sy = args[1]; sw = args[2]; sh = args[3];
      dx = args[4]; dy = args[5]; dw = args[6]; dh = args[7];
    }

    const srcCtx = source.getContext ? source.getContext('2d') : null;
    if (!srcCtx) return;

    for (let y = 0; y < dh; y++) {
      for (let x = 0; x < dw; x++) {
        const targetX = Math.round(dx + x);
        const targetY = Math.round(dy + y);
        if (targetX < 0 || targetX >= this.width || targetY < 0 || targetY >= this.height) continue;

        const srcX = Math.round(sx + (x / Math.max(1, dw)) * sw);
        const srcY = Math.round(sy + (y / Math.max(1, dh)) * sh);
        if (srcX < 0 || srcX >= srcCtx.width || srcY < 0 || srcY >= srcCtx.height) continue;

        const srcIdx = (srcY * srcCtx.width + srcX) * 4;
        const dstIdx = (targetY * this.width + targetX) * 4;

        const srcAlpha = (srcCtx.data[srcIdx + 3] / 255) * this.globalAlpha;
        if (srcAlpha <= 0) continue;

        const dstAlpha = 1 - srcAlpha;
        this.data[dstIdx] = Math.round(srcCtx.data[srcIdx] * srcAlpha + this.data[dstIdx] * dstAlpha);
        this.data[dstIdx + 1] = Math.round(srcCtx.data[srcIdx + 1] * srcAlpha + this.data[dstIdx + 1] * dstAlpha);
        this.data[dstIdx + 2] = Math.round(srcCtx.data[srcIdx + 2] * srcAlpha + this.data[dstIdx + 2] * dstAlpha);
        this.data[dstIdx + 3] = 255;
      }
    }
  }
}

describe('Harmonic Inpainting & Watermark Removal Engine', () => {
  beforeEach(() => {
    clearObjectRemovalCache();
    // Provide OffscreenCanvas / Canvas mock if needed in environment
    if (typeof OffscreenCanvas === 'undefined') {
      (global as any).OffscreenCanvas = class {
        width: number;
        height: number;
        private _ctx: MockCanvasContext;
        constructor(w: number, h: number) {
          this.width = w;
          this.height = h;
          this._ctx = new MockCanvasContext(w, h);
        }
        getContext() {
          return this._ctx;
        }
      };
    }
  });

  it('eliminates white watermark text on green background and blends with surrounding color', () => {
    const W = 200;
    const H = 200;
    // Green video background: (0, 150, 0)
    const ctx = new MockCanvasContext(W, H, [0, 150, 0, 255]);

    // Stamp a stark white watermark box in the center (80x80 to 120x120)
    for (let y = 80; y < 120; y++) {
      for (let x = 80; x < 120; x++) {
        const idx = (y * W + x) * 4;
        ctx.data[idx] = 255;     // White
        ctx.data[idx + 1] = 255;
        ctx.data[idx + 2] = 255;
        ctx.data[idx + 3] = 255;
      }
    }

    const settings: ClipObjectRemovalSettings = {
      enabled: true,
      mode: 'content_aware',
      shape: 'rectangle',
      x: 50,
      y: 50,
      width: 25,
      height: 25,
      rotation: 0,
      feather: 8,
      opacity: 100,
      stretchStrength: 80,
    };

    applyObjectRemoval(
      ctx as any,
      W,
      H,
      settings,
      0,
      0,
      ctx.canvas as any,
      undefined,
      false,
      'test_clip'
    );

    // Center pixel of watermark before inpaint was 255, 255, 255 (white)
    const centerIdx = (100 * W + 100) * 4;
    const r = ctx.data[centerIdx];
    const g = ctx.data[centerIdx + 1];
    const b = ctx.data[centerIdx + 2];
    const a = ctx.data[centerIdx + 3];

    // The infilled color must match the green background (G >> R, G >> B)
    expect(g).toBeGreaterThan(100);
    expect(r).toBeLessThan(40);
    expect(b).toBeLessThan(40);
    // Crucial: No destination-out hole punching (alpha must remain 255)
    expect(a).toBe(255);
  });

  it('generateObjectRemovalInpaint never returns empty or black frame in single-region mode', () => {
    const W = 100;
    const H = 100;
    const sourceCtx = new MockCanvasContext(W, H, [50, 100, 200, 255]);

    const settings: ClipObjectRemovalSettings = {
      enabled: true,
      mode: 'content_aware',
      shape: 'rectangle',
      x: 80,
      y: 80,
      width: 20,
      height: 20,
      rotation: 0,
      feather: 5,
      opacity: 100,
      stretchStrength: 80,
    };

    const result = generateObjectRemovalInpaint(
      W,
      H,
      settings,
      0,
      0,
      sourceCtx.canvas as any,
      undefined,
      'export_clip'
    );

    expect(result).toBeDefined();
    const resCtx = (result as any).getContext('2d') as MockCanvasContext;
    expect(resCtx).toBeDefined();

    // Verify background pixel outside watermark area retains source color
    const cornerIdx = (10 * W + 10) * 4;
    expect(resCtx.data[cornerIdx]).toBe(50);
    expect(resCtx.data[cornerIdx + 1]).toBe(100);
    expect(resCtx.data[cornerIdx + 2]).toBe(200);
    expect(resCtx.data[cornerIdx + 3]).toBe(255);
  });

  it('handles patch_replace with color calibration offset', () => {
    const W = 200;
    const H = 200;
    const ctx = new MockCanvasContext(W, H, [100, 100, 100, 255]);

    const settings: ClipObjectRemovalSettings = {
      enabled: true,
      mode: 'patch_replace',
      shape: 'rectangle',
      x: 70,
      y: 70,
      width: 20,
      height: 20,
      rotation: 0,
      feather: 6,
      opacity: 100,
      patchSourceX: 20,
      patchSourceY: 20,
    };

    expect(() => {
      applyObjectRemoval(
        ctx as any,
        W,
        H,
        settings,
        0,
        0,
        ctx.canvas as any,
        undefined,
        false,
        'patch_test'
      );
    }).not.toThrow();

    // Alpha at target must remain opaque 255
    const targetIdx = (140 * W + 140) * 4;
    expect(ctx.data[targetIdx + 3]).toBe(255);
  });
});
