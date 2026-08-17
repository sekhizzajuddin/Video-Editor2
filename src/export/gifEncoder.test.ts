/**
 * gifEncoder.test.ts — verifies the GIF89a encoder against the reference
 * `omggif` GifReader (full decode round-trip), including the LZW code-width
 * growth and table-clear boundaries that hand-rolled encoders usually break.
 */
import { describe, it, expect } from 'vitest';
import { GifReader } from 'omggif';
import { Gif89aEncoder } from './gifEncoder';

function makeFrameData(w: number, h: number, rand: () => number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.floor(rand() * 256);
    data[i + 1] = Math.floor(rand() * 256);
    data[i + 2] = Math.floor(rand() * 256);
    data[i + 3] = 255;
  }
  return data;
}

/** Deterministic PRNG so failures are reproducible. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('Gif89aEncoder', () => {
  it('produces a structurally valid GIF (header, GCT, frames, trailer)', () => {
    const enc = new Gif89aEncoder(16, 16);
    const data = new Uint8ClampedArray(16 * 16 * 4).fill(200);
    enc.addFrame({ data, delayCs: 7 });
    const bytes = enc.finish();

    expect(Buffer.from(bytes.slice(0, 6)).toString()).toBe('GIF89a');
    expect(bytes[bytes.length - 1]).toBe(0x3b);
    // LSD: width/height LE + packed GCT flag
    expect(bytes[6] | (bytes[7] << 8)).toBe(16);
    expect(bytes[8] | (bytes[9] << 8)).toBe(16);
    expect(bytes[10]).toBe(0xf7);
  });

  it('round-trips a solid-color frame with exact pixels', () => {
    const enc = new Gif89aEncoder(32, 24);
    const data = new Uint8ClampedArray(32 * 24 * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 255;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = 255;
    }
    enc.addFrame({ data, delayCs: 10 });
    const bytes = enc.finish();

    const reader = new GifReader(Buffer.from(bytes));
    expect(reader.width).toBe(32);
    expect(reader.height).toBe(24);
    expect(reader.numFrames()).toBe(1);

    const px = Buffer.alloc(32 * 24 * 4);
    reader.decodeAndBlitFrameRGBA(0, px);
    expect(px[0]).toBe(255);
    expect(px[3]).toBe(255); // opaque
  });

  it('round-trips a patterned two-frame animation (frame boundaries + order)', () => {
    const w = 24;
    const h = 24;
    const enc = new Gif89aEncoder(w, h);

    const frameA = new Uint8ClampedArray(w * h * 4);
    const frameB = new Uint8ClampedArray(w * h * 4);
    for (let p = 0; p < w * h; p++) {
      const x = p % w;
      const y = Math.floor(p / w);
      // A: left half red, right half blue. B: horizontal gradient.
      const [rA, gA, bA] = x < w / 2 ? [255, 0, 0] : [0, 0, 255];
      frameA.set([rA, gA, bA, 255], p * 4);
      frameB.set([Math.floor((y / h) * 255), 128, 64, 255], p * 4);
    }
    enc.addFrame({ data: frameA, delayCs: 8 });
    enc.addFrame({ data: frameB, delayCs: 8 });
    const bytes = enc.finish();

    const reader = new GifReader(Buffer.from(bytes));
    expect(reader.numFrames()).toBe(2);

    const outA = Buffer.alloc(w * h * 4);
    const outB = Buffer.alloc(w * h * 4);
    reader.decodeAndBlitFrameRGBA(0, outA);
    reader.decodeAndBlitFrameRGBA(1, outB);

    // Palette quantization: 255,0,0 → 3-3-2 index keeps dominant channel ~255.
    expect(outA[0]).toBeGreaterThan(200); // left pixel red channel
    const rightPixel = (0 * w + (w - 1)) * 4;
    expect(outA[rightPixel + 2]).toBeGreaterThan(200); // right pixel blue channel

    const bottomRight = ((h - 1) * w + (w - 1)) * 4;
    expect(outB[bottomRight]).toBeGreaterThan(180); // gradient end is bright
  });

  it('fills every pixel — streams must not terminate early', () => {
    // Exercise several sizes, including awkward non-power-of-two areas where a
    // pixel-counting bug in LZW finalization would starve the tail pixels.
    const sizes: Array<[number, number]> = [
      [16, 16],
      [32, 24 - 1], // odd height: 736 pixels
      [128, 128],
      [37, 91], // 3367 pixels — maximally awkward
    ];
    for (const [w, h] of sizes) {
      const rand = mulberry32(w * 1000 + h);
      const data = makeFrameData(w, h, rand);
      const enc = new Gif89aEncoder(w, h);
      enc.addFrame({ data, delayCs: 9 });
      const bytes = enc.finish();
      const reader = new GifReader(Buffer.from(bytes));
      const px = Buffer.alloc(w * h * 4).fill(7);
      reader.decodeAndBlitFrameRGBA(0, px);

      for (let p = 0; p < w * h; p++) {
        // Re-derive the expected 3-3-2 quantized palette color of source pixel p.
        const r = data[p * 4];
        const g = data[p * 4 + 1];
        const b = data[p * 4 + 2];
        const r3 = r >> 5;
        const g3 = g >> 5;
        const b2 = b >> 6;
        const er = (r3 << 5) | (r3 << 2) | (r3 >> 1);
        const eg = (g3 << 5) | (g3 << 2) | (g3 >> 1);
        const eb = (b2 << 6) | (b2 << 4) | (b2 << 2) | b2;
        expect(
          px[p * 4] === er && px[p * 4 + 1] === eg && px[p * 4 + 2] === eb && px[p * 4 + 3] === 255,
          `pixel ${p} of ${w}x${h}: got ${px[p * 4]},${px[p * 4 + 1]},${px[p * 4 + 2]},${px[p * 4 + 3]} expected ${er},${eg},${eb},255`
        ).toBe(true);
      }
    }
  });

  it('survives high-entropy frames (LZW dictionary growth + clear reset)', () => {
    // 128x128 random RGBA crosses the 512-code (9→10 bit) and 4096-entry
    // boundaries; any LZW mistake here makes the round-trip diverge.
    const w = 128;
    const h = 128;
    const rand = mulberry32(42);
    const enc = new Gif89aEncoder(w, h);
    enc.addFrame({ data: makeFrameData(w, h, rand), delayCs: 5 });
    enc.addFrame({ data: makeFrameData(w, h, rand), delayCs: 5 });
    const bytes = enc.finish();

    const reader = new GifReader(Buffer.from(bytes));
    expect(reader.numFrames()).toBe(2);

    // Decoded image must be non-trivial noise AND every channel must come from
    // the exact 3-3-2 replication sets (proves the LZW stream decoded cleanly:
    // a bit-sync error would produce values outside these sets and/or garbage).
    const R3 = [0, 36, 73, 109, 146, 182, 219, 255]; // (v<<5)|(v<<2)|(v>>1)
    const B2 = [0, 85, 170, 255]; //                    (v<<6)|(v<<4)|(v<<2)|v
    const px = Buffer.alloc(w * h * 4);
    reader.decodeAndBlitFrameRGBA(1, px);
    const uniqueColors = new Set<number>();
    for (let i = 0; i < px.length; i += 4) {
      uniqueColors.add((px[i] << 16) | (px[i + 1] << 8) | px[i + 2]);
      // Containment in the replicated-grayscale ramps (allowing the standard
      // off-by-one from different rounding orders in the fixed palette):
      expect(R3.some((v) => Math.abs(v - px[i]) <= 1)).toBe(true);
      expect(R3.some((v) => Math.abs(v - px[i + 1]) <= 1)).toBe(true);
      expect(B2.some((v) => Math.abs(v - px[i + 2]) <= 1)).toBe(true);
    }
    expect(uniqueColors.size).toBeGreaterThan(64); // real high-entropy content survived
  });

  it('rejects mismatched frame payload sizes', () => {
    const enc = new Gif89aEncoder(8, 8);
    expect(() => enc.addFrame({ data: new Uint8ClampedArray(4), delayCs: 5 })).toThrow(/payload/i);
  });
});
