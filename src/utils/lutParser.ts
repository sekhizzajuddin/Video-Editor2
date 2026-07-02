/**
 * lutParser.ts — .cube LUT file parser + trilinear interpolation engine.
 *
 * Supports 3D LUTs in the Adobe .cube format (the universal standard).
 * Provides pixel-level application via getImageData / putImageData.
 */

import type { LutData } from '@/types';

// ── Parser ────────────────────────────────────────────────────────────────────

/**
 * Parse a .cube LUT file text into a typed LutData object.
 * Supports 3D LUTs with arbitrary sizes (typically 17, 33, or 65).
 */
export function parseCubeLut(text: string): LutData {
  const lines = text.split(/\r?\n/);
  let size = 0;
  let title: string | undefined;
  let domainMin: [number, number, number] = [0, 0, 0];
  let domainMax: [number, number, number] = [1, 1, 1];
  const entries: number[] = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;

    if (line.startsWith('TITLE')) {
      title = line.replace(/^TITLE\s+/, '').replace(/"/g, '');
      continue;
    }
    if (line.startsWith('LUT_3D_SIZE')) {
      size = parseInt(line.split(/\s+/)[1], 10);
      continue;
    }
    if (line.startsWith('DOMAIN_MIN')) {
      const parts = line.split(/\s+/);
      domainMin = [parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])];
      continue;
    }
    if (line.startsWith('DOMAIN_MAX')) {
      const parts = line.split(/\s+/);
      domainMax = [parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])];
      continue;
    }
    // Skip non-numeric header lines
    if (/^[A-Z_]/.test(line)) continue;

    const parts = line.split(/\s+/);
    if (parts.length >= 3) {
      entries.push(parseFloat(parts[0]), parseFloat(parts[1]), parseFloat(parts[2]));
    }
  }

  if (size === 0) throw new Error('LUT_3D_SIZE not found in .cube file');

  const expected = size * size * size * 3;
  if (entries.length < expected) {
    throw new Error(`LUT data incomplete: expected ${expected} values, got ${entries.length}`);
  }

  return {
    size,
    table: new Float32Array(entries),
    domainMin,
    domainMax,
    title,
  };
}

// ── Trilinear Interpolation ───────────────────────────────────────────────────

/**
 * Apply a parsed 3D LUT to a single RGB triple.
 * Returns [r, g, b] in range [0, 255].
 *
 * @param r  Input red   (0-255)
 * @param g  Input green (0-255)
 * @param b  Input blue  (0-255)
 * @param lut Parsed LUT data
 */
export function applyLutToPixel(
  r: number,
  g: number,
  b: number,
  lut: LutData,
): [number, number, number] {
  const { size, table, domainMin, domainMax } = lut;
  const last = size - 1;

  // Normalize to [0,1] and remap to domain
  const rn = (r / 255 - domainMin[0]) / (domainMax[0] - domainMin[0]);
  const gn = (g / 255 - domainMin[1]) / (domainMax[1] - domainMin[1]);
  const bn = (b / 255 - domainMin[2]) / (domainMax[2] - domainMin[2]);

  // Scale to LUT grid coordinates
  const rx = Math.max(0, Math.min(last, rn * last));
  const gx = Math.max(0, Math.min(last, gn * last));
  const bx = Math.max(0, Math.min(last, bn * last));

  const r0 = Math.floor(rx), r1 = Math.min(r0 + 1, last);
  const g0 = Math.floor(gx), g1 = Math.min(g0 + 1, last);
  const b0 = Math.floor(bx), b1 = Math.min(b0 + 1, last);

  const rf = rx - r0, gf = gx - g0, bf = bx - b0;

  // Helper: lookup RGB at LUT grid index
  const idx = (ri: number, gi: number, bi: number) => (bi * size * size + gi * size + ri) * 3;

  // Trilinear interpolation
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  const channels: [number, number, number] = [0, 0, 0];
  for (let c = 0; c < 3; c++) {
    const c000 = table[idx(r0, g0, b0) + c];
    const c100 = table[idx(r1, g0, b0) + c];
    const c010 = table[idx(r0, g1, b0) + c];
    const c110 = table[idx(r1, g1, b0) + c];
    const c001 = table[idx(r0, g0, b1) + c];
    const c101 = table[idx(r1, g0, b1) + c];
    const c011 = table[idx(r0, g1, b1) + c];
    const c111 = table[idx(r1, g1, b1) + c];

    const c00 = lerp(c000, c100, rf);
    const c10 = lerp(c010, c110, rf);
    const c01 = lerp(c001, c101, rf);
    const c11 = lerp(c011, c111, rf);
    const c0  = lerp(c00,  c10,  gf);
    const c1  = lerp(c01,  c11,  gf);
    channels[c] = lerp(c0, c1, bf);
  }

  return [
    Math.round(Math.max(0, Math.min(1, channels[0])) * 255),
    Math.round(Math.max(0, Math.min(1, channels[1])) * 255),
    Math.round(Math.max(0, Math.min(1, channels[2])) * 255),
  ];
}

// ── Canvas Pixel Pass ─────────────────────────────────────────────────────────

/**
 * Apply a LUT to all pixels of an offscreen canvas context in-place.
 * Uses intensity blending: 0 = original, 100 = full LUT.
 *
 * @param ctx       2D context of the offscreen canvas
 * @param w         Canvas width
 * @param h         Canvas height
 * @param lut       Parsed LUT data
 * @param intensity 0-100, blend factor
 */
export function applyLutToCanvas(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  lut: LutData,
  intensity: number,
): void {
  if (w <= 0 || h <= 0) return;
  const blend = Math.max(0, Math.min(100, intensity)) / 100;
  const inv = 1 - blend;

  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const or = data[i];
    const og = data[i + 1];
    const ob = data[i + 2];
    const [lr, lg, lb] = applyLutToPixel(or, og, ob, lut);
    data[i]     = Math.round(or * inv + lr * blend);
    data[i + 1] = Math.round(og * inv + lg * blend);
    data[i + 2] = Math.round(ob * inv + lb * blend);
    // Alpha unchanged
  }

  ctx.putImageData(imageData, 0, 0);
}
