export interface CurvePoint {
  x: number;
  y: number;
  id: string;
}

export type CurveChannelKey = 'rgb' | 'r' | 'g' | 'b' | 'luma';

export interface CurveChannel {
  channel: CurveChannelKey;
  points: CurvePoint[];
}

export interface CurvesData {
  rgb: CurveChannel | null;
  r: CurveChannel | null;
  g: CurveChannel | null;
  b: CurveChannel | null;
  luma: CurveChannel | null;
}

export const DEFAULT_CURVES: CurvesData = {
  rgb: null,
  r: null,
  g: null,
  b: null,
  luma: null,
};

export function isCurveActive(curve: CurveChannel | null | undefined): boolean {
  return !!curve && curve.points.length > 0;
}

export function buildCurveLUT(curve: CurveChannel | null | undefined): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(256);
  if (!curve || curve.points.length === 0) {
    for (let i = 0; i < 256; i++) lut[i] = i;
    return lut;
  }

  const sorted = [...curve.points].sort((a, b) => a.x - b.x);
  if (sorted.length === 1) {
    for (let i = 0; i < 256; i++) lut[i] = Math.round(sorted[0].y * 255);
    return lut;
  }

  for (let i = 0; i < 256; i++) {
    lut[i] = Math.round(catmullRomInterpolate(sorted, i / 255) * 255);
  }
  return lut;
}

function catmullRomInterpolate(points: CurvePoint[], t: number): number {
  if (t <= points[0].x) return points[0].y;
  if (t >= points[points.length - 1].x) return points[points.length - 1].y;

  let p1Idx = 0;
  for (let i = 0; i < points.length - 1; i++) {
    if (points[i].x <= t && points[i + 1].x >= t) {
      p1Idx = i;
      break;
    }
  }
  const p0 = points[Math.max(0, p1Idx - 1)];
  const p1 = points[p1Idx];
  const p2 = points[Math.min(points.length - 1, p1Idx + 1)];
  const p3 = points[Math.min(points.length - 1, p1Idx + 2)];

  const range = p1.x - p0.x || 1;
  const localT = (t - p0.x) / range;
  const t2 = localT * localT;
  const t3 = t2 * localT;

  return 0.5 * (
    2 * p1.y +
    (-p0.y + p2.y) * localT +
    (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
    (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3
  );
}

export function applyCurvesToImageData(
  imageData: ImageData,
  rgbLut: Uint8ClampedArray,
  rLut: Uint8ClampedArray | null,
  gLut: Uint8ClampedArray | null,
  bLut: Uint8ClampedArray | null,
  lumaLut: Uint8ClampedArray | null,
): void {
  const data = imageData.data;
  const hasRgb = true;
  const hasR = !!rLut;
  const hasG = !!gLut;
  const hasB = !!bLut;
  const hasLuma = !!lumaLut;
  const rgbIdentity = rgbLut[0] === 0 && rgbLut[255] === 255 &&
    Array.from(rgbLut).every((v, i) => v === i);
  const rIdentity = !hasR || (rLut![0] === 0 && rLut![255] === 255);
  const gIdentity = !hasG || (gLut![0] === 0 && gLut![255] === 255);
  const bIdentity = !hasB || (bLut![0] === 0 && bLut![255] === 255);
  const lumaIdentity = !hasLuma || (lumaLut![0] === 0 && lumaLut![255] === 255);

  if (rgbIdentity && rIdentity && gIdentity && bIdentity && lumaIdentity) return;

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    if (!rgbIdentity) {
      r = rgbLut[r];
      g = rgbLut[g];
      b = rgbLut[b];
    }
    if (hasR && !rIdentity) r = rLut![r];
    if (hasG && !gIdentity) g = gLut![g];
    if (hasB && !bIdentity) b = bLut![b];

    if (hasLuma && !lumaIdentity) {
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      const newLuma = lumaLut![Math.round(Math.max(0, Math.min(255, luma)))];
      const ratio = luma > 0 ? newLuma / luma : 0;
      r = Math.min(255, Math.max(0, r * ratio));
      g = Math.min(255, Math.max(0, g * ratio));
      b = Math.min(255, Math.max(0, b * ratio));
    }

    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  }
}
