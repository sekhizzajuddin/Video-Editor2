/**
 * Professional AI Object Removal & Content-Aware Inpainting Engine
 * 
 * Hardware-accelerated real-time inpainting for video playback.
 * Supports: Content-Aware Color Stretch, Patch Replace (Clone Stamp), Gaussian Blur Conceal, Mosaic Pixelate
 * 
 * Performance targets: 60 FPS @ 1080p, 30 FPS @ 4K with LRU gradient caching & directional stretching.
 */

import type { ClipObjectRemovalSettings } from '@/types';
import { getAnimatedValue } from '@/utils/keyframes';
import { detectSceneChange } from './humanDetection';
import { getObjectRemovalSettingsHash } from './settingsHash';
import { getWatermarkColorProfile, hexToRgb } from './watermarkPresets';

// Scratch canvases for offscreen compositing (reused across frames to prevent GC pauses)
// Support both DOM (main thread) and OffscreenCanvas (worker)
let scratchCanvas: HTMLCanvasElement | OffscreenCanvas | null = null;
let scratchCtx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null;

let tempCanvas: HTMLCanvasElement | OffscreenCanvas | null = null;
let tempCtx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null;

function getScratchCanvas(width: number, height: number): { canvas: HTMLCanvasElement | OffscreenCanvas; ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D } {
  if (!scratchCanvas || !scratchCtx) {
    // Worker-safe: use OffscreenCanvas if available, fallback to DOM canvas
    if (typeof OffscreenCanvas !== 'undefined') {
      scratchCanvas = new OffscreenCanvas(Math.max(width, Math.ceil(width / 256) * 256), Math.max(height, Math.ceil(height / 256) * 256));
    } else {
      scratchCanvas = document.createElement('canvas');
      scratchCanvas.width = Math.max(width, Math.ceil(width / 256) * 256);
      scratchCanvas.height = Math.max(height, Math.ceil(height / 256) * 256);
    }
    scratchCtx = scratchCanvas.getContext('2d', { willReadFrequently: true })!;
  }
  if (scratchCanvas.width < width || scratchCanvas.height < height) {
    scratchCanvas.width = Math.max(width, Math.ceil(width / 256) * 256);
    scratchCanvas.height = Math.max(height, Math.ceil(height / 256) * 256);
  }
  return { canvas: scratchCanvas, ctx: scratchCtx! };
}

function getTempCanvas(width: number, height: number): { canvas: HTMLCanvasElement | OffscreenCanvas; ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D } {
  if (!tempCanvas || !tempCtx) {
    // Worker-safe: use OffscreenCanvas if available, fallback to DOM canvas
    if (typeof OffscreenCanvas !== 'undefined') {
      tempCanvas = new OffscreenCanvas(Math.max(width, Math.ceil(width / 256) * 256), Math.max(height, Math.ceil(height / 256) * 256));
    } else {
      tempCanvas = document.createElement('canvas');
      tempCanvas.width = Math.max(width, Math.ceil(width / 256) * 256);
      tempCanvas.height = Math.max(height, Math.ceil(height / 256) * 256);
    }
    tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true })!;
  }
  if (tempCanvas.width < width || tempCanvas.height < height) {
    tempCanvas.width = Math.max(width, Math.ceil(width / 256) * 256);
    tempCanvas.height = Math.max(height, Math.ceil(height / 256) * 256);
  }
  return { canvas: tempCanvas, ctx: tempCtx! };
}

// Feather gradient cache to avoid regenerating radial gradients every frame
const featherGradientCache = new Map<string, CanvasGradient>();
const temporalInpaintCache = new Map<string, { canvas: HTMLCanvasElement | OffscreenCanvas; frameCount: number; settingsHash: string }>();

/**
 * Interpolate settings from keyframes at current timeline time
 */
function interpolateSettings(
  settings: ClipObjectRemovalSettings,
  currentTime: number,
  clipStartTime: number,
  animations?: any
): ClipObjectRemovalSettings {
  if (!animations) return settings;

  return {
    ...settings,
    x: getAnimatedValue(settings.x ?? 50, currentTime, clipStartTime, animations['objectRemoval.x']),
    y: getAnimatedValue(settings.y ?? 50, currentTime, clipStartTime, animations['objectRemoval.y']),
    width: getAnimatedValue(settings.width ?? 20, currentTime, clipStartTime, animations['objectRemoval.width']),
    height: getAnimatedValue(settings.height ?? 20, currentTime, clipStartTime, animations['objectRemoval.height']),
    rotation: getAnimatedValue(settings.rotation ?? 0, currentTime, clipStartTime, animations['objectRemoval.rotation']),
    feather: getAnimatedValue(settings.feather ?? 10, currentTime, clipStartTime, animations['objectRemoval.feather']),
    opacity: getAnimatedValue(settings.opacity ?? 100, currentTime, clipStartTime, animations['objectRemoval.opacity']),
    stretchStrength: getAnimatedValue(settings.stretchStrength ?? 80, currentTime, clipStartTime, animations['objectRemoval.stretchStrength']),
    patchSourceX: getAnimatedValue(settings.patchSourceX ?? 30, currentTime, clipStartTime, animations['objectRemoval.patchSourceX']),
    patchSourceY: getAnimatedValue(settings.patchSourceY ?? 30, currentTime, clipStartTime, animations['objectRemoval.patchSourceY']),
  };
}

/**
 * Convert percentage-based settings to pixel coordinates
 */
function getPixelBounds(
  settings: ClipObjectRemovalSettings,
  clipWidth: number,
  clipHeight: number
): {
  centerX: number;
  centerY: number;
  w: number;
  h: number;
  rotation: number;
  feather: number;
} {
  return {
    centerX: (settings.x / 100) * clipWidth,
    centerY: (settings.y / 100) * clipHeight,
    w: Math.max(2, (settings.width / 100) * clipWidth),
    h: Math.max(2, (settings.height / 100) * clipHeight),
    rotation: (settings.rotation * Math.PI) / 180,
    feather: Math.min(settings.feather, Math.min(clipWidth, clipHeight) * 0.25),
  };
}

/**
 * Draw the removal mask path (rectangle or ellipse)
 */
function drawMaskPath(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  cx: number,
  cy: number,
  w: number,
  h: number,
  rotation: number,
  shape: string
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);

  if (shape === 'ellipse') {
    ctx.beginPath();
    ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
  } else {
    ctx.beginPath();
    ctx.rect(-w / 2, -h / 2, w, h);
  }

  ctx.restore();
}

/**
 * Draw highlight overlay for editing/placement mode
 */
function drawHighlightOverlay(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  bounds: ReturnType<typeof getPixelBounds>,
  settings: ClipObjectRemovalSettings,
  clipWidth: number,
  clipHeight: number
): void {
  const { centerX, centerY, w, h, rotation } = bounds;

  ctx.save();
  ctx.strokeStyle = settings.mode === 'patch_replace' ? '#00D4FF' : '#FF3366';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);

  drawMaskPath(ctx, centerX, centerY, w + 8, h + 8, rotation, settings.shape);
  ctx.stroke();

  // Draw crosshair center
  ctx.setLineDash([]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(centerX - 10, centerY);
  ctx.lineTo(centerX + 10, centerY);
  ctx.moveTo(centerX, centerY - 10);
  ctx.lineTo(centerX, centerY + 10);
  ctx.stroke();

  // Draw source patch indicator for patch_replace mode
  if (settings.mode === 'patch_replace' && settings.patchSourceX !== undefined && settings.patchSourceY !== undefined) {
    const srcX = (settings.patchSourceX / 100) * clipWidth;
    const srcY = (settings.patchSourceY / 100) * clipHeight;

    ctx.strokeStyle = '#00FF88';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    drawMaskPath(ctx, srcX, srcY, w, h, rotation, settings.shape);
    ctx.stroke();

    // Draw connection line
    ctx.setLineDash([2, 4]);
    ctx.strokeStyle = 'rgba(0, 255, 136, 0.7)';
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(srcX, srcY);
    ctx.stroke();
  }

  // Label
  ctx.fillStyle = settings.mode === 'patch_replace' ? '#00D4FF' : '#FF3366';
  ctx.font = 'bold 12px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  const label = settings.mode === 'content_aware' ? 'CONTENT-AWARE INPAINT' 
    : settings.mode === 'patch_replace' ? 'PATCH REPLACE (CLONE STAMP)'
    : settings.mode === 'blur_conceal' ? 'GAUSSIAN CONCEAL'
    : 'MOSAIC PIXELATE';
  ctx.fillText(label, centerX, centerY - h / 2 - 12);

  ctx.restore();
}

/**
 * ============================================
 * MODE 1: Smart Watermark Color Unblending & Harmonic Inpainting Engine
 * ============================================
 * Combines:
 * 1. Famous Watermark Color & Semi-Transparent White (#FFFFFF) Pixel Segmentation
 * 2. Mathematical Reverse Alpha Unblending: Original = (Watermarked - alpha * LogoColor) / (1 - alpha)
 *    (Inspired by open-source GeminiWatermarkTool / VeoWatermarkRemover / Dekel et al. CVPR)
 * 3. Local Clean-Pixel Telea Diffusion (propagates untouched background pixels between letters across letter strokes)
 * 4. Harmonic Dirichlet Coons Surface Infill & Adaptive Camera Sensor Film Grain
 */
function applyContentAwareStretch(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  sourceCanvas: HTMLCanvasElement | CanvasImageSource,
  bounds: ReturnType<typeof getPixelBounds>,
  settings: ClipObjectRemovalSettings,
  clipWidth: number,
  clipHeight: number
): void {
  const { centerX, centerY, w, h, rotation, feather } = bounds;
  const strength = (settings.stretchStrength ?? 80) / 100;
  const opacity = (settings.opacity ?? 100) / 100;
  const profileId = settings.watermarkProfile ?? 'auto_smart';
  const tolerance = Math.max(5, Math.min(100, settings.colorTolerance ?? 55)) / 100;
  const useAlphaUnblend = settings.alphaUnblend !== false;

  const pad = Math.max(4, Math.ceil(feather) + 4);
  const patchW = Math.ceil(w + pad * 2);
  const patchH = Math.ceil(h + pad * 2);

  if (patchW <= 4 || patchH <= 4) return;

  const { canvas: scCanvas, ctx: scCtx } = getScratchCanvas(patchW, patchH);
  scCtx.save();
  scCtx.clearRect(0, 0, patchW, patchH);
  scCtx.translate(patchW / 2, patchH / 2);
  if (rotation !== 0) {
    scCtx.rotate(-rotation);
  }
  scCtx.drawImage(sourceCanvas, -centerX, -centerY);
  scCtx.restore();

  const boxX = pad;
  const boxY = pad;
  const boxW = Math.max(2, Math.round(w));
  const boxH = Math.max(2, Math.round(h));

  const imgData = scCtx.getImageData(0, 0, patchW, patchH);
  const data = imgData.data;

  // Boundary ring thickness for sampling surrounding clean video pixels
  const ring = Math.max(2, Math.min(pad, Math.round(feather * 0.5) + 3));

  // Boundary color arrays: T (top), B (bottom), L (left), R (right)
  const T = new Float32Array(boxW * 3);
  const B = new Float32Array(boxW * 3);
  const L = new Float32Array(boxH * 3);
  const R = new Float32Array(boxH * 3);

  let sumBorderLum = 0;
  let sumBorderLumSq = 0;
  let borderSampleCount = 0;

  // Sample top and bottom boundary strips
  for (let x = 0; x < boxW; x++) {
    const px = Math.max(0, Math.min(patchW - 1, boxX + x));
    let tR = 0, tG = 0, tB = 0, tCount = 0;
    let bR = 0, bG = 0, bB = 0, bCount = 0;

    for (let k = 1; k <= ring; k++) {
      const pyT = Math.max(0, boxY - k);
      const idxT = (pyT * patchW + px) * 4;
      tR += data[idxT]; tG += data[idxT + 1]; tB += data[idxT + 2];
      tCount++;

      const pyB = Math.min(patchH - 1, boxY + boxH + k - 1);
      const idxB = (pyB * patchW + px) * 4;
      bR += data[idxB]; bG += data[idxB + 1]; bB += data[idxB + 2];
      bCount++;

      const lumT = 0.299 * data[idxT] + 0.587 * data[idxT + 1] + 0.114 * data[idxT + 2];
      sumBorderLum += lumT; sumBorderLumSq += lumT * lumT;
      const lumB = 0.299 * data[idxB] + 0.587 * data[idxB + 1] + 0.114 * data[idxB + 2];
      sumBorderLum += lumB; sumBorderLumSq += lumB * lumB;
      borderSampleCount += 2;
    }

    T[x * 3] = tR / Math.max(1, tCount);
    T[x * 3 + 1] = tG / Math.max(1, tCount);
    T[x * 3 + 2] = tB / Math.max(1, tCount);

    B[x * 3] = bR / Math.max(1, bCount);
    B[x * 3 + 1] = bG / Math.max(1, bCount);
    B[x * 3 + 2] = bB / Math.max(1, bCount);
  }

  // Sample left and right boundary strips
  for (let y = 0; y < boxH; y++) {
    const py = Math.max(0, Math.min(patchH - 1, boxY + y));
    let lR = 0, lG = 0, lB = 0, lCount = 0;
    let rR = 0, rG = 0, rB = 0, rCount = 0;

    for (let k = 1; k <= ring; k++) {
      const pxL = Math.max(0, boxX - k);
      const idxL = (py * patchW + pxL) * 4;
      lR += data[idxL]; lG += data[idxL + 1]; lB += data[idxL + 2];
      lCount++;

      const pxR = Math.min(patchW - 1, boxX + boxW + k - 1);
      const idxR = (py * patchW + pxR) * 4;
      rR += data[idxR]; rG += data[idxR + 1]; rB += data[idxR + 2];
      rCount++;

      const lumL = 0.299 * data[idxL] + 0.587 * data[idxL + 1] + 0.114 * data[idxL + 2];
      sumBorderLum += lumL; sumBorderLumSq += lumL * lumL;
      const lumR = 0.299 * data[idxR] + 0.587 * data[idxR + 1] + 0.114 * data[idxR + 2];
      sumBorderLum += lumR; sumBorderLumSq += lumR * lumR;
      borderSampleCount += 2;
    }

    L[y * 3] = lR / Math.max(1, lCount);
    L[y * 3 + 1] = lG / Math.max(1, lCount);
    L[y * 3 + 2] = lB / Math.max(1, lCount);

    R[y * 3] = rR / Math.max(1, rCount);
    R[y * 3 + 1] = rG / Math.max(1, rCount);
    R[y * 3 + 2] = rB / Math.max(1, rCount);
  }

  // Corner bilinear nodes
  const ctlR = 0.5 * (T[0] + L[0]);
  const ctlG = 0.5 * (T[1] + L[1]);
  const ctlB = 0.5 * (T[2] + L[2]);

  const lastWIdx = (boxW - 1) * 3;
  const ctrR = 0.5 * (T[lastWIdx] + R[0]);
  const ctrG = 0.5 * (T[lastWIdx + 1] + R[1]);
  const ctrB = 0.5 * (T[lastWIdx + 2] + R[2]);

  const lastHIdx = (boxH - 1) * 3;
  const cblR = 0.5 * (B[0] + L[lastHIdx]);
  const cblG = 0.5 * (B[1] + L[lastHIdx + 1]);
  const cblB = 0.5 * (B[2] + L[lastHIdx + 2]);

  const cbrR = 0.5 * (B[lastWIdx] + R[lastHIdx]);
  const cbrG = 0.5 * (B[lastWIdx + 1] + R[lastHIdx + 1]);
  const cbrB = 0.5 * (B[lastWIdx + 2] + R[lastHIdx + 2]);

  // Estimate camera sensor grain amplitude from border luminance variance
  let grainAmp = 1.6;
  let borderSigma = 4.0;
  if (borderSampleCount > 10) {
    const meanLum = sumBorderLum / borderSampleCount;
    const variance = Math.max(0, (sumBorderLumSq / borderSampleCount) - (meanLum * meanLum));
    borderSigma = Math.sqrt(variance);
    grainAmp = Math.min(5.0, Math.max(0.8, borderSigma * 0.38)) * Math.max(0.4, strength);
  }

  const numPixels = boxW * boxH;
  const macroBG = new Float32Array(numPixels * 3);
  const invW = 1 / Math.max(1, boxW - 1);
  const invH = 1 / Math.max(1, boxH - 1);

  // Step 1: Compute Macro Harmonic Dirichlet Coons Background Field
  for (let y = 0; y < boxH; y++) {
    const v = y * invH;
    const Sv = v * v * (3 - 2 * v);
    const oneMinusSv = 1 - Sv;
    const y3 = y * 3;
    const lyR = L[y3], lyG = L[y3 + 1], lyB = L[y3 + 2];
    const ryR = R[y3], ryG = R[y3 + 1], ryB = R[y3 + 2];
    const rowIdx = y * boxW;

    for (let x = 0; x < boxW; x++) {
      const u = x * invW;
      const Su = u * u * (3 - 2 * u);
      const oneMinusSu = 1 - Su;
      const x3 = x * 3;

      const loftY_R = oneMinusSv * T[x3] + Sv * B[x3];
      const loftY_G = oneMinusSv * T[x3 + 1] + Sv * B[x3 + 1];
      const loftY_B = oneMinusSv * T[x3 + 2] + Sv * B[x3 + 2];

      const loftX_R = oneMinusSu * lyR + Su * ryR;
      const loftX_G = oneMinusSu * lyG + Su * ryG;
      const loftX_B = oneMinusSu * lyB + Su * ryB;

      const loftXY_R = oneMinusSu * oneMinusSv * ctlR + Su * oneMinusSv * ctrR + oneMinusSu * Sv * cblR + Su * Sv * cbrR;
      const loftXY_G = oneMinusSu * oneMinusSv * ctlG + Su * oneMinusSv * ctrG + oneMinusSu * Sv * cblG + Su * Sv * cbrG;
      const loftXY_B = oneMinusSu * oneMinusSv * ctlB + Su * oneMinusSv * ctrB + oneMinusSu * Sv * cblB + Su * Sv * cbrB;

      const pIdx = (rowIdx + x) * 3;
      macroBG[pIdx] = Math.max(0, Math.min(255, loftY_R + loftX_R - loftXY_R));
      macroBG[pIdx + 1] = Math.max(0, Math.min(255, loftY_G + loftX_G - loftXY_G));
      macroBG[pIdx + 2] = Math.max(0, Math.min(255, loftY_B + loftX_B - loftXY_B));
    }
  }

  const { canvas: stCanvas, ctx: stCtx } = getTempCanvas(patchW, patchH);
  const outImgData = stCtx.createImageData(patchW, patchH);
  const outData = outImgData.data;

  // If user explicitly chose Full Box Infill (or tolerance >= 0.99), replace entire box
  if (profileId === 'full_box' || tolerance >= 0.99) {
    for (let y = 0; y < boxH; y++) {
      const outRowOffset = (boxY + y) * patchW;
      const rowIdx = y * boxW;
      for (let x = 0; x < boxW; x++) {
        const pIdx = (rowIdx + x) * 3;
        const seed = ((boxX + x) * 1973 + (boxY + y) * 9277) ^ 0x5bf03635;
        let hsh = (seed ^ (seed >>> 16)) * 0x45d9f3b;
        hsh = (hsh ^ (hsh >>> 16)) * 0x45d9f3b;
        hsh = (hsh ^ (hsh >>> 16));
        const grain = (((hsh & 0xffff) / 65535 - 0.5) * 2) * grainAmp;

        let alpha = 1.0;
        if (settings.shape === 'ellipse') {
          const nx = (x - (boxW - 1) * 0.5) / Math.max(1, boxW * 0.5);
          const ny = (y - (boxH - 1) * 0.5) / Math.max(1, boxH * 0.5);
          const dist = Math.sqrt(nx * nx + ny * ny);
          if (dist >= 1.0) alpha = 0.0;
          else {
            const fNorm = Math.max(0.01, feather / Math.min(w, h));
            if (dist > 1.0 - fNorm) {
              const t = (1.0 - dist) / fNorm;
              alpha = t * t * (3 - 2 * t);
            }
          }
        } else if (feather > 0.5) {
          const edgeDist = Math.min(Math.min(x, boxW - 1 - x), Math.min(y, boxH - 1 - y));
          const t = Math.min(1.0, edgeDist / feather);
          alpha = t * t * (3 - 2 * t);
        }

        const outIdx = (outRowOffset + (boxX + x)) * 4;
        outData[outIdx] = Math.max(0, Math.min(255, Math.round(macroBG[pIdx] + grain)));
        outData[outIdx + 1] = Math.max(0, Math.min(255, Math.round(macroBG[pIdx + 1] + grain)));
        outData[outIdx + 2] = Math.max(0, Math.min(255, Math.round(macroBG[pIdx + 2] + grain)));
        outData[outIdx + 3] = Math.round(alpha * 255);
      }
    }
    stCtx.putImageData(outImgData, 0, 0);
    ctx.save();
    ctx.translate(centerX, centerY);
    if (rotation !== 0) ctx.rotate(rotation);
    ctx.globalAlpha = opacity;
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(stCanvas, -patchW / 2, -patchH / 2);
    ctx.restore();
    return;
  }

  // Step 2: Smart Watermark Pixel Color Detection & Alpha Estimation
  const profile = getWatermarkColorProfile(profileId);
  const customRgb = settings.targetColor ? hexToRgb(settings.targetColor) : null;

  // Build active target color list
  const targetColors: { r: number; g: number; b: number; isWhite: boolean; isDark: boolean }[] = [];
  if (profileId === 'custom_color' && customRgb) {
    const lum = 0.299 * customRgb[0] + 0.587 * customRgb[1] + 0.114 * customRgb[2];
    const sat = Math.max(...customRgb) - Math.min(...customRgb);
    targetColors.push({
      r: customRgb[0],
      g: customRgb[1],
      b: customRgb[2],
      isWhite: lum > 200 && sat < 35,
      isDark: lum < 50 && sat < 35,
    });
  } else {
    for (const c of profile.colors) {
      targetColors.push({
        r: c.rgb[0],
        g: c.rgb[1],
        b: c.rgb[2],
        isWhite: !!c.isWhiteOrNeutral,
        isDark: !!c.isDarkShadow,
      });
    }
    // Also include user's custom targetColor if specified
    if (customRgb && settings.targetColor && settings.targetColor.toUpperCase() !== '#FFFFFF') {
      targetColors.push({
        r: customRgb[0],
        g: customRgb[1],
        b: customRgb[2],
        isWhite: false,
        isDark: false,
      });
    }
  }

  const checkWhite = targetColors.some((c) => c.isWhite);
  const checkDark = profileId === 'dark_logo';
  const checkShadow = targetColors.some((c) => c.isDark) && !checkDark;

  // Sensitivity thresholds controlled by colorTolerance (default 0.55)
  const lumThresh = Math.max(5, 34 * (1.12 - tolerance) + borderSigma * 0.45);
  const colorMatchRadius = 35 + tolerance * 75;

  const wmAlpha = new Float32Array(numPixels);     // Estimated watermark alpha [0..1]
  const wmMask = new Float32Array(numPixels);      // Detection confidence [0..1]
  const wmColor = new Float32Array(numPixels * 3); // Detected pure watermark color (R,G,B)

  for (let y = 0; y < boxH; y++) {
    const srcRow = (boxY + y) * patchW;
    const rowIdx = y * boxW;

    for (let x = 0; x < boxW; x++) {
      const idx = (srcRow + (boxX + x)) * 4;
      const pR = data[idx];
      const pG = data[idx + 1];
      const pB = data[idx + 2];
      const pLum = 0.299 * pR + 0.587 * pG + 0.114 * pB;

      const pIdx = rowIdx + x;
      const pIdx3 = pIdx * 3;
      const bgR = macroBG[pIdx3];
      const bgG = macroBG[pIdx3 + 1];
      const bgB = macroBG[pIdx3 + 2];
      const bgLum = 0.299 * bgR + 0.587 * bgG + 0.114 * bgB;

      let bestMask = 0;
      let bestEstAlpha = 0;
      let bestWmR = 255, bestWmG = 255, bestWmB = 255;

      // Test A: Semi-Transparent or Opaque White / Silver Watermark (#FFFFFF / #E6E6E6)
      if (checkWhite) {
        const dLum = pLum - bgLum;
        const aR = (pR - bgR) / Math.max(10, 255 - bgR);
        const aG = (pG - bgG) / Math.max(10, 255 - bgG);
        const aB = (pB - bgB) / Math.max(10, 255 - bgB);
        const minChannelAlpha = Math.min(aR, aG, aB);
        const avgChannelAlpha = (aR + aG + aB) / 3;
        const sat = Math.max(pR, pG, pB) - Math.min(pR, pG, pB);

        // Either all 3 channels shifted upward toward white, OR pixel is bright neutral white
        if (
          (dLum > lumThresh * 0.55 && minChannelAlpha > 0.035) ||
          (pLum > 195 && sat < 42 && dLum > lumThresh * 0.35)
        ) {
          const estA = Math.max(0.05, Math.min(1.0, Math.max(avgChannelAlpha, dLum / Math.max(12, 255 - bgLum))));
          const conf = Math.min(1.0, Math.max((dLum - lumThresh * 0.35) / Math.max(8, lumThresh), estA * 1.35));
          if (conf > bestMask) {
            bestMask = conf;
            bestEstAlpha = estA;
            bestWmR = 255;
            bestWmG = 255;
            bestWmB = 255;
          }
        }
      }

      // Test B: Famous Brand Accent Colors & Custom Target Color
      for (let k = 0; k < targetColors.length; k++) {
        const tc = targetColors[k];
        if (tc.isWhite || (tc.isDark && !checkDark)) continue;

        const distToTarget = Math.sqrt(
          0.3 * (pR - tc.r) * (pR - tc.r) +
          0.59 * (pG - tc.g) * (pG - tc.g) +
          0.11 * (pB - tc.b) * (pB - tc.b)
        );
        const bgDistToTarget = Math.sqrt(
          0.3 * (bgR - tc.r) * (bgR - tc.r) +
          0.59 * (bgG - tc.g) * (bgG - tc.g) +
          0.11 * (bgB - tc.b) * (bgB - tc.b)
        );
        const diffFromBg = Math.sqrt(
          0.3 * (pR - bgR) * (pR - bgR) +
          0.59 * (pG - bgG) * (pG - bgG) +
          0.11 * (pB - bgB) * (pB - bgB)
        );

        // Vector projection of (P - BG) onto (Target - BG)
        const vR = tc.r - bgR, vG = tc.g - bgG, vB = tc.b - bgB;
        const vLenSq = Math.max(144, vR * vR + vG * vG + vB * vB);
        const projAlpha = ((pR - bgR) * vR + (pG - bgG) * vG + (pB - bgB) * vB) / vLenSq;

        if (
          (distToTarget < colorMatchRadius && bgDistToTarget > distToTarget + 8) ||
          (projAlpha > 0.14 && diffFromBg > lumThresh * 0.7 && distToTarget < colorMatchRadius * 1.25)
        ) {
          const estA = Math.max(0.10, Math.min(1.0, Math.max(projAlpha, 1 - distToTarget / (colorMatchRadius * 1.35))));
          const conf = Math.min(1.0, Math.max(estA, diffFromBg / Math.max(10, lumThresh)));
          if (conf > bestMask) {
            bestMask = conf;
            bestEstAlpha = estA;
            bestWmR = tc.r;
            bestWmG = tc.g;
            bestWmB = tc.b;
          }
        }
      }

      // Test C: Local High-Frequency Spike (catches fine anti-aliased letter strokes)
      if (bestMask < 0.5 && x >= 2 && x < boxW - 2 && y >= 2 && y < boxH - 2) {
        const diffFromBg = Math.sqrt(
          0.3 * (pR - bgR) * (pR - bgR) +
          0.59 * (pG - bgG) * (pG - bgG) +
          0.11 * (pB - bgB) * (pB - bgB)
        );
        if (diffFromBg > lumThresh * 1.35 && profileId === 'auto_smart') {
          const conf = Math.min(1.0, (diffFromBg - lumThresh) / Math.max(12, lumThresh));
          if (conf > bestMask) {
            bestMask = conf;
            bestEstAlpha = Math.min(1.0, diffFromBg / 95);
            bestWmR = pLum >= bgLum ? 255 : 0;
            bestWmG = pLum >= bgLum ? 255 : 0;
            bestWmB = pLum >= bgLum ? 255 : 0;
          }
        }
      }

      wmMask[pIdx] = bestMask;
      wmAlpha[pIdx] = bestEstAlpha;
      wmColor[pIdx3] = bestWmR;
      wmColor[pIdx3 + 1] = bestWmG;
      wmColor[pIdx3 + 2] = bestWmB;
    }
  }

  // Step 3: Detect adjacent dark drop-shadows & dilate 1-pixel anti-aliased compression fringe
  const dilatedMask = new Float32Array(wmMask);
  for (let y = 1; y < boxH - 1; y++) {
    const rowIdx = y * boxW;
    const srcRow = (boxY + y) * patchW;
    for (let x = 1; x < boxW - 1; x++) {
      const pIdx = rowIdx + x;
      const maxNeighbor = Math.max(
        wmMask[pIdx - 1],
        wmMask[pIdx + 1],
        wmMask[pIdx - boxW],
        wmMask[pIdx + boxW],
        wmMask[pIdx - boxW - 1] * 0.7,
        wmMask[pIdx - boxW + 1] * 0.7,
        wmMask[pIdx + boxW - 1] * 0.7,
        wmMask[pIdx + boxW + 1] * 0.7
      );

      if (maxNeighbor > 0.22 && wmMask[pIdx] < maxNeighbor) {
        // Check if this neighboring pixel is a dark drop-shadow around a bright letter
        const idx = (srcRow + (boxX + x)) * 4;
        const pLum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        const bgLum =
          0.299 * macroBG[pIdx * 3] +
          0.587 * macroBG[pIdx * 3 + 1] +
          0.114 * macroBG[pIdx * 3 + 2];

        if (checkShadow && bgLum - pLum > lumThresh * 0.55) {
          dilatedMask[pIdx] = Math.min(1.0, maxNeighbor * 0.9);
          wmAlpha[pIdx] = Math.max(wmAlpha[pIdx], Math.min(0.85, (bgLum - pLum) / Math.max(15, bgLum)));
          wmColor[pIdx * 3] = 0;
          wmColor[pIdx * 3 + 1] = 0;
          wmColor[pIdx * 3 + 2] = 0;
        } else {
          // Soft 1px anti-aliasing halo expansion
          dilatedMask[pIdx] = Math.max(wmMask[pIdx], maxNeighbor * 0.62);
          if (wmAlpha[pIdx] < 0.05) {
            wmAlpha[pIdx] = maxNeighbor * 0.35;
          }
        }
      }
    }
  }

  // Step 4: Local Clean-Pixel Telea Diffusion
  // Confirmed clean background pixels inside the box (between watermark letters) propagate
  // their exact local color across the 2–5px letter strokes!
  const localBG = new Float32Array(numPixels * 3);
  const confWeight = new Float32Array(numPixels);

  for (let y = 0; y < boxH; y++) {
    const srcRow = (boxY + y) * patchW;
    const rowIdx = y * boxW;
    for (let x = 0; x < boxW; x++) {
      const pIdx = rowIdx + x;
      const pIdx3 = pIdx * 3;
      const m = dilatedMask[pIdx];

      if (m < 0.08) {
        // Confirmed clean background pixel right inside the watermark box!
        const idx = (srcRow + (boxX + x)) * 4;
        localBG[pIdx3] = data[idx];
        localBG[pIdx3 + 1] = data[idx + 1];
        localBG[pIdx3 + 2] = data[idx + 2];
        confWeight[pIdx] = 1.0;
      } else {
        // Seed watermarked pixel with Macro Harmonic Coons background
        localBG[pIdx3] = macroBG[pIdx3];
        localBG[pIdx3 + 1] = macroBG[pIdx3 + 1];
        localBG[pIdx3 + 2] = macroBG[pIdx3 + 2];
        confWeight[pIdx] = 0.08;
      }
    }
  }

  // Run 6 fast spatial diffusion passes so clean inter-letter pixels fill adjacent letter strokes
  for (let pass = 0; pass < 6; pass++) {
    for (let y = 1; y < boxH - 1; y++) {
      const rowIdx = y * boxW;
      for (let x = 1; x < boxW - 1; x++) {
        const pIdx = rowIdx + x;
        if (confWeight[pIdx] >= 0.99) continue; // Keep confirmed clean pixels locked

        const n0 = pIdx - 1;
        const n1 = pIdx + 1;
        const n2 = pIdx - boxW;
        const n3 = pIdx + boxW;
        const n4 = pIdx - boxW - 1;
        const n5 = pIdx - boxW + 1;
        const n6 = pIdx + boxW - 1;
        const n7 = pIdx + boxW + 1;

        const w0 = confWeight[n0];
        const w1 = confWeight[n1];
        const w2 = confWeight[n2];
        const w3 = confWeight[n3];
        const w4 = confWeight[n4] * 0.7;
        const w5 = confWeight[n5] * 0.7;
        const w6 = confWeight[n6] * 0.7;
        const w7 = confWeight[n7] * 0.7;
        const wSelf = confWeight[pIdx] * 0.5;

        const wSum = w0 + w1 + w2 + w3 + w4 + w5 + w6 + w7 + wSelf;
        if (wSum > 0.001) {
          const pIdx3 = pIdx * 3;
          localBG[pIdx3] =
            (localBG[n0 * 3] * w0 +
              localBG[n1 * 3] * w1 +
              localBG[n2 * 3] * w2 +
              localBG[n3 * 3] * w3 +
              localBG[n4 * 3] * w4 +
              localBG[n5 * 3] * w5 +
              localBG[n6 * 3] * w6 +
              localBG[n7 * 3] * w7 +
              localBG[pIdx3] * wSelf) /
            wSum;

          localBG[pIdx3 + 1] =
            (localBG[n0 * 3 + 1] * w0 +
              localBG[n1 * 3 + 1] * w1 +
              localBG[n2 * 3 + 1] * w2 +
              localBG[n3 * 3 + 1] * w3 +
              localBG[n4 * 3 + 1] * w4 +
              localBG[n5 * 3 + 1] * w5 +
              localBG[n6 * 3 + 1] * w6 +
              localBG[n7 * 3 + 1] * w7 +
              localBG[pIdx3 + 1] * wSelf) /
            wSum;

          localBG[pIdx3 + 2] =
            (localBG[n0 * 3 + 2] * w0 +
              localBG[n1 * 3 + 2] * w1 +
              localBG[n2 * 3 + 2] * w2 +
              localBG[n3 * 3 + 2] * w3 +
              localBG[n4 * 3 + 2] * w4 +
              localBG[n5 * 3 + 2] * w5 +
              localBG[n6 * 3 + 2] * w6 +
              localBG[n7 * 3 + 2] * w7 +
              localBG[pIdx3 + 2] * wSelf) /
            wSum;

          confWeight[pIdx] = Math.min(0.95, wSum * 0.22);
        }
      }
    }
  }

  // Step 5: Mathematical Reverse Alpha Unblending + Local Background Synthesis
  for (let y = 0; y < boxH; y++) {
    const srcRow = (boxY + y) * patchW;
    const rowIdx = y * boxW;

    for (let x = 0; x < boxW; x++) {
      const pIdx = rowIdx + x;
      const maskVal = dilatedMask[pIdx];

      // Clean background pixel! Leave 100% of the original sharp video pixel untouched!
      if (maskVal <= 0.015) {
        continue;
      }

      const pIdx3 = pIdx * 3;
      const locR = localBG[pIdx3];
      const locG = localBG[pIdx3 + 1];
      const locB = localBG[pIdx3 + 2];

      const srcIdx = (srcRow + (boxX + x)) * 4;
      const obsR = data[srcIdx];
      const obsG = data[srcIdx + 1];
      const obsB = data[srcIdx + 2];

      const estAlpha = wmAlpha[pIdx];
      const wR = wmColor[pIdx3];
      const wG = wmColor[pIdx3 + 1];
      const wB = wmColor[pIdx3 + 2];

      // Coherent camera sensor grain
      const seed = ((boxX + x) * 1973 + (boxY + y) * 9277) ^ 0x5bf03635;
      let hsh = (seed ^ (seed >>> 16)) * 0x45d9f3b;
      hsh = (hsh ^ (hsh >>> 16)) * 0x45d9f3b;
      hsh = (hsh ^ (hsh >>> 16));
      const grain = (((hsh & 0xffff) / 65535 - 0.5) * 2) * grainAmp;

      const bgWithGrainR = Math.max(0, Math.min(255, locR + grain));
      const bgWithGrainG = Math.max(0, Math.min(255, locG + grain));
      const bgWithGrainB = Math.max(0, Math.min(255, locB + grain));

      let finalR = bgWithGrainR;
      let finalG = bgWithGrainG;
      let finalB = bgWithGrainB;

      // Apply Reverse Alpha Unblending for semi-transparent watermarks:
      // Original = (Observed - alpha * WatermarkColor) / (1 - alpha)
      if (useAlphaUnblend && estAlpha > 0.04 && estAlpha < 0.76) {
        const safeAlpha = Math.min(0.72, estAlpha * 0.88);
        const invOneMinusA = 1 / Math.max(0.25, 1 - safeAlpha);

        let unblendR = (obsR - safeAlpha * wR) * invOneMinusA;
        let unblendG = (obsG - safeAlpha * wG) * invOneMinusA;
        let unblendB = (obsB - safeAlpha * wB) * invOneMinusA;

        // Softly regularize against local clean background so H.264 compression artifacts don't spike
        unblendR = Math.max(locR - 26, Math.min(locR + 26, unblendR));
        unblendG = Math.max(locG - 26, Math.min(locG + 26, unblendG));
        unblendB = Math.max(locB - 26, Math.min(locB + 26, unblendB));

        // Smoothly transition from Reverse Alpha Unblending (for low/medium alpha)
        // to Local Clean Background Inpainting (for high/opaque alpha)
        const t = Math.max(0, Math.min(1, (estAlpha * strength - 0.20) / 0.50));
        const opaqueWeight = t * t * (3 - 2 * t);

        finalR = (1 - opaqueWeight) * unblendR + opaqueWeight * bgWithGrainR;
        finalG = (1 - opaqueWeight) * unblendG + opaqueWeight * bgWithGrainG;
        finalB = (1 - opaqueWeight) * unblendB + opaqueWeight * bgWithGrainB;
      }

      // Outer bounding box feathering
      let boxAlpha = 1.0;
      if (settings.shape === 'ellipse') {
        const nx = (x - (boxW - 1) * 0.5) / Math.max(1, boxW * 0.5);
        const ny = (y - (boxH - 1) * 0.5) / Math.max(1, boxH * 0.5);
        const dist = Math.sqrt(nx * nx + ny * ny);
        if (dist >= 1.0) {
          boxAlpha = 0.0;
        } else {
          const fNorm = Math.max(0.01, feather / Math.min(w, h));
          if (dist > 1.0 - fNorm) {
            const t = (1.0 - dist) / fNorm;
            boxAlpha = t * t * (3 - 2 * t);
          }
        }
      } else if (feather > 0.5) {
        const edgeDistX = Math.min(x, boxW - 1 - x);
        const edgeDistY = Math.min(y, boxH - 1 - y);
        const edgeDist = Math.min(edgeDistX, edgeDistY);
        const t = Math.min(1.0, edgeDist / feather);
        boxAlpha = t * t * (3 - 2 * t);
      }

      const pixelBlendAlpha = Math.min(1.0, maskVal * 1.45) * boxAlpha;
      outData[srcIdx] = Math.max(0, Math.min(255, Math.round(finalR)));
      outData[srcIdx + 1] = Math.max(0, Math.min(255, Math.round(finalG)));
      outData[srcIdx + 2] = Math.max(0, Math.min(255, Math.round(finalB)));
      outData[srcIdx + 3] = Math.round(pixelBlendAlpha * 255);
    }
  }

  stCtx.putImageData(outImgData, 0, 0);

  // Composite back onto destination canvas with clean source-over (NEVER destination-out)
  ctx.save();
  ctx.translate(centerX, centerY);
  if (rotation !== 0) {
    ctx.rotate(rotation);
  }
  ctx.globalAlpha = opacity;
  ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(stCanvas, -patchW / 2, -patchH / 2);
  ctx.restore();
}

/**
 * ============================================
 * MODE 2: Color-Calibrated Patch Replace (Clone Stamp)
 * ============================================
 * Samples from reference patch coordinates (patchSourceX, patchSourceY),
 * computes boundary lighting offset Delta RGB to match target exposure,
 * and composites with smooth Hermite feathering.
 */
function applyPatchReplace(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  sourceCanvas: HTMLCanvasElement | CanvasImageSource,
  bounds: ReturnType<typeof getPixelBounds>,
  settings: ClipObjectRemovalSettings,
  clipWidth: number,
  clipHeight: number
): void {
  const { centerX, centerY, w, h, rotation, feather } = bounds;
  const srcX = ((settings.patchSourceX ?? 30) / 100) * clipWidth;
  const srcY = ((settings.patchSourceY ?? 30) / 100) * clipHeight;
  const opacity = (settings.opacity ?? 100) / 100;

  const pad = Math.max(4, Math.ceil(feather) + 4);
  const patchW = Math.ceil(w + pad * 2);
  const patchH = Math.ceil(h + pad * 2);

  if (patchW <= 4 || patchH <= 4) return;

  // Extract source clone patch around (srcX, srcY)
  const { canvas: ptCanvas, ctx: ptCtx } = getTempCanvas(patchW, patchH);
  ptCtx.save();
  ptCtx.clearRect(0, 0, patchW, patchH);
  ptCtx.translate(patchW / 2, patchH / 2);
  if (rotation !== 0) {
    ptCtx.rotate(-rotation);
  }
  ptCtx.drawImage(sourceCanvas, -srcX, -srcY);
  ptCtx.restore();

  // Extract target surrounding region to measure lighting / white balance
  const { canvas: scCanvas, ctx: scCtx } = getScratchCanvas(patchW, patchH);
  scCtx.save();
  scCtx.clearRect(0, 0, patchW, patchH);
  scCtx.translate(patchW / 2, patchH / 2);
  if (rotation !== 0) {
    scCtx.rotate(-rotation);
  }
  scCtx.drawImage(sourceCanvas, -centerX, -centerY);
  scCtx.restore();

  const boxX = pad;
  const boxY = pad;
  const boxW = Math.max(2, Math.round(w));
  const boxH = Math.max(2, Math.round(h));

  const ptImgData = ptCtx.getImageData(0, 0, patchW, patchH);
  const ptData = ptImgData.data;

  const scImgData = scCtx.getImageData(0, 0, patchW, patchH);
  const scData = scImgData.data;

  // Sample perimeter ring on both patches to calibrate lighting offset (Poisson approximation)
  let sumTargetR = 0, sumTargetG = 0, sumTargetB = 0;
  let sumSourceR = 0, sumSourceG = 0, sumSourceB = 0;
  let borderCount = 0;
  const ring = Math.max(2, Math.min(pad, 6));

  for (let x = 0; x < boxW; x += 2) {
    const px = Math.max(0, Math.min(patchW - 1, boxX + x));
    for (let k = 1; k <= ring; k++) {
      const pyT = Math.max(0, boxY - k);
      const idxT = (pyT * patchW + px) * 4;
      sumTargetR += scData[idxT]; sumTargetG += scData[idxT + 1]; sumTargetB += scData[idxT + 2];
      sumSourceR += ptData[idxT]; sumSourceG += ptData[idxT + 1]; sumSourceB += ptData[idxT + 2];

      const pyB = Math.min(patchH - 1, boxY + boxH + k - 1);
      const idxB = (pyB * patchW + px) * 4;
      sumTargetR += scData[idxB]; sumTargetG += scData[idxB + 1]; sumTargetB += scData[idxB + 2];
      sumSourceR += ptData[idxB]; sumSourceG += ptData[idxB + 1]; sumSourceB += ptData[idxB + 2];
      borderCount += 2;
    }
  }

  for (let y = 0; y < boxH; y += 2) {
    const py = Math.max(0, Math.min(patchH - 1, boxY + y));
    for (let k = 1; k <= ring; k++) {
      const pxL = Math.max(0, boxX - k);
      const idxL = (py * patchW + pxL) * 4;
      sumTargetR += scData[idxL]; sumTargetG += scData[idxL + 1]; sumTargetB += scData[idxL + 2];
      sumSourceR += ptData[idxL]; sumSourceG += ptData[idxL + 1]; sumSourceB += ptData[idxL + 2];

      const pxR = Math.min(patchW - 1, boxX + boxW + k - 1);
      const idxR = (py * patchW + pxR) * 4;
      sumTargetR += scData[idxR]; sumTargetG += scData[idxR + 1]; sumTargetB += scData[idxR + 2];
      sumSourceR += ptData[idxR]; sumSourceG += ptData[idxR + 1]; sumSourceB += ptData[idxR + 2];
      borderCount += 2;
    }
  }

  const deltaR = borderCount > 0 ? (sumTargetR - sumSourceR) / borderCount : 0;
  const deltaG = borderCount > 0 ? (sumTargetG - sumSourceG) / borderCount : 0;
  const deltaB = borderCount > 0 ? (sumTargetB - sumSourceB) / borderCount : 0;

  // Apply calibrated lighting and alpha feathering
  for (let y = 0; y < patchH; y++) {
    for (let x = 0; x < patchW; x++) {
      const idx = (y * patchW + x) * 4;
      const inBoxX = x >= boxX && x < boxX + boxW;
      const inBoxY = y >= boxY && y < boxY + boxH;

      if (!inBoxX || !inBoxY) {
        ptData[idx + 3] = 0; // Transparent outside box
        continue;
      }

      const localX = x - boxX;
      const localY = y - boxY;

      let alpha = 1.0;
      if (settings.shape === 'ellipse') {
        const nx = (localX - (boxW - 1) * 0.5) / Math.max(1, boxW * 0.5);
        const ny = (localY - (boxH - 1) * 0.5) / Math.max(1, boxH * 0.5);
        const dist = Math.sqrt(nx * nx + ny * ny);
        if (dist >= 1.0) {
          alpha = 0.0;
        } else {
          const fNorm = Math.max(0.01, feather / Math.min(w, h));
          if (dist > 1.0 - fNorm) {
            const t = (1.0 - dist) / fNorm;
            alpha = t * t * (3 - 2 * t);
          }
        }
      } else {
        const edgeDistX = Math.min(localX, boxW - 1 - localX);
        const edgeDistY = Math.min(localY, boxH - 1 - localY);
        const edgeDist = Math.min(edgeDistX, edgeDistY);
        if (feather > 0.5) {
          const t = Math.min(1.0, edgeDist / feather);
          alpha = t * t * (3 - 2 * t);
        }
      }

      ptData[idx] = Math.max(0, Math.min(255, ptData[idx] + deltaR));
      ptData[idx + 1] = Math.max(0, Math.min(255, ptData[idx + 1] + deltaG));
      ptData[idx + 2] = Math.max(0, Math.min(255, ptData[idx + 2] + deltaB));
      ptData[idx + 3] = Math.round(alpha * 255);
    }
  }

  ptCtx.putImageData(ptImgData, 0, 0);

  ctx.save();
  ctx.translate(centerX, centerY);
  if (rotation !== 0) {
    ctx.rotate(rotation);
  }
  ctx.globalAlpha = opacity;
  ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(ptCanvas, -patchW / 2, -patchH / 2);
  ctx.restore();
}

/**
 * ============================================
 * MODE 3 & 4: Watermark-Neutralized Blur Conceal & Mosaic Pixelate
 * ============================================
 * Pre-neutralizes high-contrast watermark text glyphs against the background mean
 * BEFORE blurring, completely eliminating bright glowing smudges.
 */
function applyBlurConceal(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  sourceCanvas: HTMLCanvasElement | CanvasImageSource,
  bounds: ReturnType<typeof getPixelBounds>,
  settings: ClipObjectRemovalSettings,
  clipWidth: number,
  clipHeight: number
): void {
  const { centerX, centerY, w, h, rotation, feather } = bounds;
  const isPixelate = settings.mode === 'pixelate';
  const opacity = (settings.opacity ?? 100) / 100;

  const pad = Math.max(4, Math.ceil(feather) + 4);
  const boxW = Math.ceil(w + pad * 2);
  const boxH = Math.ceil(h + pad * 2);

  if (boxW <= 4 || boxH <= 4) return;

  const { canvas: bcCanvas, ctx: bcCtx } = getTempCanvas(boxW, boxH);
  bcCtx.save();
  bcCtx.clearRect(0, 0, boxW, boxH);
  bcCtx.translate(boxW / 2, boxH / 2);
  if (rotation !== 0) {
    bcCtx.rotate(-rotation);
  }
  bcCtx.drawImage(sourceCanvas, -centerX, -centerY);
  bcCtx.restore();

  const innerX = pad;
  const innerY = pad;
  const innerW = Math.max(2, Math.round(w));
  const innerH = Math.max(2, Math.round(h));

  const imgData = bcCtx.getImageData(0, 0, boxW, boxH);
  const data = imgData.data;

  // Sample border to calculate true background tone
  let sumR = 0, sumG = 0, sumB = 0, borderCount = 0;
  for (let x = 0; x < innerW; x += 2) {
    const px = Math.max(0, Math.min(boxW - 1, innerX + x));
    const idxT = (Math.max(0, innerY - 2) * boxW + px) * 4;
    sumR += data[idxT]; sumG += data[idxT + 1]; sumB += data[idxT + 2];
    const idxB = (Math.min(boxH - 1, innerY + innerH + 1) * boxW + px) * 4;
    sumR += data[idxB]; sumG += data[idxB + 1]; sumB += data[idxB + 2];
    borderCount += 2;
  }
  const meanR = borderCount > 0 ? sumR / borderCount : 128;
  const meanG = borderCount > 0 ? sumG / borderCount : 128;
  const meanB = borderCount > 0 ? sumB / borderCount : 128;
  const meanLum = 0.299 * meanR + 0.587 * meanG + 0.114 * meanB;

  // Pre-neutralize watermark text glyphs so bright white text doesn't bloom
  for (let y = 0; y < innerH; y++) {
    for (let x = 0; x < innerW; x++) {
      const idx = ((innerY + y) * boxW + (innerX + x)) * 4;
      const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      const diff = Math.abs(lum - meanLum);
      if (diff > 20) {
        const pull = Math.min(0.85, (diff - 20) / 45);
        data[idx] = Math.round(data[idx] * (1 - pull) + meanR * pull);
        data[idx + 1] = Math.round(data[idx + 1] * (1 - pull) + meanG * pull);
        data[idx + 2] = Math.round(data[idx + 2] * (1 - pull) + meanB * pull);
      }
    }
  }
  bcCtx.putImageData(imgData, 0, 0);

  if (isPixelate) {
    const pixelSize = Math.max(6, Math.floor(Math.min(w, h) / 14));
    const smallW = Math.max(1, Math.ceil(boxW / pixelSize));
    const smallH = Math.max(1, Math.ceil(boxH / pixelSize));

    const { canvas: smallCanvas, ctx: smallCtx } = getScratchCanvas(smallW, smallH);
    smallCtx.imageSmoothingEnabled = false;
    smallCtx.clearRect(0, 0, smallW, smallH);
    smallCtx.drawImage(bcCanvas, 0, 0, boxW, boxH, 0, 0, smallW, smallH);

    bcCtx.imageSmoothingEnabled = false;
    bcCtx.clearRect(0, 0, boxW, boxH);
    bcCtx.drawImage(smallCanvas, 0, 0, smallW, smallH, 0, 0, boxW, boxH);
    bcCtx.imageSmoothingEnabled = true;
  } else {
    const blurAmount = Math.max(14, Math.min(w, h) / 3.5);
    bcCtx.filter = `blur(${blurAmount}px)`;
    bcCtx.drawImage(bcCanvas, 0, 0);
    bcCtx.filter = 'none';
  }

  // Feather alpha channel and make exterior completely transparent
  const processedData = bcCtx.getImageData(0, 0, boxW, boxH);
  const pData = processedData.data;

  for (let y = 0; y < boxH; y++) {
    for (let x = 0; x < boxW; x++) {
      const idx = (y * boxW + x) * 4;
      const inBoxX = x >= innerX && x < innerX + innerW;
      const inBoxY = y >= innerY && y < innerY + innerH;
      if (!inBoxX || !inBoxY) {
        pData[idx + 3] = 0;
        continue;
      }
      const localX = x - innerX;
      const localY = y - innerY;

      let alpha = 1.0;
      if (settings.shape === 'ellipse') {
        const nx = (localX - (innerW - 1) * 0.5) / Math.max(1, innerW * 0.5);
        const ny = (localY - (innerH - 1) * 0.5) / Math.max(1, innerH * 0.5);
        const dist = Math.sqrt(nx * nx + ny * ny);
        if (dist >= 1.0) {
          alpha = 0.0;
        } else {
          const fNorm = Math.max(0.01, feather / Math.min(w, h));
          if (dist > 1.0 - fNorm) {
            const t = (1.0 - dist) / fNorm;
            alpha = t * t * (3 - 2 * t);
          }
        }
      } else {
        const edgeDistX = Math.min(localX, innerW - 1 - localX);
        const edgeDistY = Math.min(localY, innerH - 1 - localY);
        const edgeDist = Math.min(edgeDistX, edgeDistY);
        if (feather > 0.5) {
          const t = Math.min(1.0, edgeDist / feather);
          alpha = t * t * (3 - 2 * t);
        }
      }
      pData[idx + 3] = Math.round(alpha * 255);
    }
  }
  bcCtx.putImageData(processedData, 0, 0);

  ctx.save();
  ctx.translate(centerX, centerY);
  if (rotation !== 0) {
    ctx.rotate(rotation);
  }
  ctx.globalAlpha = opacity;
  ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(bcCanvas, -boxW / 2, -boxH / 2);
  ctx.restore();
}

/**
 * Helper to execute a single removal/inpaint pass for one region
 */
function applySingleRemovalPass(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  clipWidth: number,
  clipHeight: number,
  settings: ClipObjectRemovalSettings,
  currentTime: number,
  clipStartTime: number,
  sourceCanvas: HTMLCanvasElement | OffscreenCanvas | CanvasImageSource,
  animations?: any,
  isPlaying: boolean = false,
  cacheKey: string = '_default'
): void {
  // Interpolate keyframes for fluid temporal motion tracking
  const interpolated = interpolateSettings(settings, currentTime, clipStartTime, animations);

  // Calculate pixel bounding box and dimensions
  const bounds = getPixelBounds(interpolated, clipWidth, clipHeight);

  // Skip rendering if mask is completely off-screen (bounds culling optimization)
  if (
    bounds.centerX < -bounds.w || bounds.centerX > clipWidth + bounds.w ||
    bounds.centerY < -bounds.h || bounds.centerY > clipHeight + bounds.h
  ) {
    return;
  }

  if (isPlaying && settings.temporalSmoothing !== false) {
    const settingsHash = `${interpolated.mode}_${interpolated.x.toFixed(1)}_${interpolated.y.toFixed(1)}_${interpolated.width.toFixed(1)}_${interpolated.height.toFixed(1)}_${interpolated.rotation.toFixed(1)}_${interpolated.watermarkProfile ?? 'auto_smart'}_${interpolated.targetColor ?? ''}_${interpolated.colorTolerance ?? 38}_${interpolated.alphaUnblend !== false ? 1 : 0}`;
    const sceneChanged = detectSceneChange(cacheKey + '_objr', sourceCanvas as HTMLCanvasElement);
    
    let cacheEntry = temporalInpaintCache.get(cacheKey);
    if (!sceneChanged && cacheEntry && cacheEntry.settingsHash === settingsHash && cacheEntry.frameCount < 3) {
      ctx.drawImage(cacheEntry.canvas, 0, 0);
      cacheEntry.frameCount++;
      
      if (interpolated.showHighlight) {
        drawHighlightOverlay(ctx, bounds, interpolated, clipWidth, clipHeight);
      }
      return;
    }
    
    if (!cacheEntry) {
      const cacheCanvas = document.createElement('canvas');
      cacheCanvas.width = clipWidth;
      cacheCanvas.height = clipHeight;
      cacheEntry = { canvas: cacheCanvas, frameCount: 0, settingsHash };
      temporalInpaintCache.set(cacheKey, cacheEntry);
    } else if (cacheEntry.canvas.width !== clipWidth || cacheEntry.canvas.height !== clipHeight) {
      cacheEntry.canvas.width = clipWidth;
      cacheEntry.canvas.height = clipHeight;
    }
    
    cacheEntry.settingsHash = settingsHash;
    cacheEntry.frameCount = 0;
    
    const cacheCtx = cacheEntry.canvas.getContext('2d', { willReadFrequently: true });
    if (cacheCtx) {
      cacheCtx.clearRect(0, 0, clipWidth, clipHeight);
      
      switch (interpolated.mode) {
        case 'content_aware':
          applyContentAwareStretch(cacheCtx, sourceCanvas, bounds, interpolated, clipWidth, clipHeight);
          break;
        case 'patch_replace':
          applyPatchReplace(cacheCtx, sourceCanvas, bounds, interpolated, clipWidth, clipHeight);
          break;
        case 'blur_conceal':
        case 'pixelate':
          applyBlurConceal(cacheCtx, sourceCanvas, bounds, interpolated, clipWidth, clipHeight);
          break;
      }
      ctx.drawImage(cacheEntry.canvas, 0, 0);
    }
  } else {
    // Execute algorithm based on mode directly
    switch (interpolated.mode) {
      case 'content_aware':
        applyContentAwareStretch(ctx, sourceCanvas, bounds, interpolated, clipWidth, clipHeight);
        break;
      case 'patch_replace':
        applyPatchReplace(ctx, sourceCanvas, bounds, interpolated, clipWidth, clipHeight);
        break;
      case 'blur_conceal':
      case 'pixelate':
        applyBlurConceal(ctx, sourceCanvas, bounds, interpolated, clipWidth, clipHeight);
        break;
    }
  }

  // Draw visual helper guide outline if highlight mode is enabled
  if (interpolated.showHighlight) {
    drawHighlightOverlay(ctx, bounds, interpolated, clipWidth, clipHeight);
  }
}

/**
 * ============================================
 * MAIN ENTRY: Apply AI Object Removal & Inpainting
 * ============================================
 */
export function applyObjectRemoval(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  clipWidth: number,
  clipHeight: number,
  settings: ClipObjectRemovalSettings,
  currentTime: number,
  clipStartTime: number,
  sourceCanvas: HTMLCanvasElement | CanvasImageSource,
  animations?: any,
  isPlaying: boolean = false,
  clipId: string = '_default'
): void {
  if (!settings || !settings.enabled) return;

  const activeRegions = (settings.regions && settings.regions.length > 0)
    ? settings.regions.filter(r => r.enabled)
    : null;

  if (activeRegions && activeRegions.length > 0) {
    let currentSrc = sourceCanvas;
    for (let i = 0; i < activeRegions.length; i++) {
      const reg = activeRegions[i];
      const singleSettings: ClipObjectRemovalSettings = {
        enabled: true,
        mode: reg.mode,
        shape: reg.shape,
        x: reg.x,
        y: reg.y,
        width: reg.width,
        height: reg.height,
        rotation: reg.rotation ?? 0,
        feather: reg.feather ?? settings.feather ?? 10,
        opacity: reg.opacity ?? settings.opacity ?? 100,
        stretchStrength: reg.stretchStrength ?? settings.stretchStrength ?? 80,
        patchSourceX: reg.patchSourceX ?? settings.patchSourceX ?? 30,
        patchSourceY: reg.patchSourceY ?? settings.patchSourceY ?? 30,
        watermarkProfile: reg.watermarkProfile ?? settings.watermarkProfile ?? 'auto_smart',
        targetColor: reg.targetColor ?? settings.targetColor,
        colorTolerance: reg.colorTolerance ?? settings.colorTolerance ?? 38,
        alphaUnblend: reg.alphaUnblend ?? settings.alphaUnblend ?? true,
        showHighlight: settings.showHighlight,
        temporalSmoothing: settings.temporalSmoothing,
        quality: settings.quality,
      };

      applySingleRemovalPass(
        ctx,
        clipWidth,
        clipHeight,
        singleSettings,
        currentTime,
        clipStartTime,
        currentSrc,
        animations,
        isPlaying,
        `${clipId}_r${reg.id || i}`
      );

      if (i < activeRegions.length - 1) {
        const { canvas: sc, ctx: scCtx } = getScratchCanvas(clipWidth, clipHeight);
        scCtx.clearRect(0, 0, clipWidth, clipHeight);
        scCtx.drawImage(ctx.canvas as any, 0, 0);
        currentSrc = sc;
      }
    }
    return;
  }

  // Single region default execution
  applySingleRemovalPass(
    ctx,
    clipWidth,
    clipHeight,
    settings,
    currentTime,
    clipStartTime,
    sourceCanvas,
    animations,
    isPlaying,
    clipId
  );
}

/**
 * Generate inpaint result for object removal (worker-safe version).
 * Returns the inpainted canvas that can be cached and reused.
 * This is extracted from applyObjectRemoval to allow caching in export worker.
 */
export function generateObjectRemovalInpaint(
  clipWidth: number,
  clipHeight: number,
  settings: ClipObjectRemovalSettings,
  currentTime: number,
  clipStartTime: number,
  sourceCanvas: HTMLCanvasElement | OffscreenCanvas | CanvasImageSource,
  animations?: any,
  clipId: string = '_default'
): HTMLCanvasElement | OffscreenCanvas {
  const resultCanvas = typeof OffscreenCanvas !== 'undefined' 
    ? new OffscreenCanvas(clipWidth, clipHeight)
    : document.createElement('canvas');
  resultCanvas.width = clipWidth;
  resultCanvas.height = clipHeight;
  const resultCtx = resultCanvas.getContext('2d', { willReadFrequently: true })!;
  
  resultCtx.clearRect(0, 0, clipWidth, clipHeight);
  resultCtx.drawImage(sourceCanvas, 0, 0);
  
  if (!settings || !settings.enabled) {
    return resultCanvas;
  }

  const activeRegions = (settings.regions && settings.regions.length > 0)
    ? settings.regions.filter(r => r.enabled)
    : null;

  if (activeRegions && activeRegions.length > 0) {
    for (let i = 0; i < activeRegions.length; i++) {
      const reg = activeRegions[i];
      const singleSettings: ClipObjectRemovalSettings = {
        enabled: true,
        mode: reg.mode,
        shape: reg.shape,
        x: reg.x,
        y: reg.y,
        width: reg.width,
        height: reg.height,
        rotation: reg.rotation ?? 0,
        feather: reg.feather ?? settings.feather ?? 10,
        opacity: reg.opacity ?? settings.opacity ?? 100,
        stretchStrength: reg.stretchStrength ?? settings.stretchStrength ?? 80,
        patchSourceX: reg.patchSourceX ?? settings.patchSourceX ?? 30,
        patchSourceY: reg.patchSourceY ?? settings.patchSourceY ?? 30,
        watermarkProfile: reg.watermarkProfile ?? settings.watermarkProfile ?? 'auto_smart',
        targetColor: reg.targetColor ?? settings.targetColor,
        colorTolerance: reg.colorTolerance ?? settings.colorTolerance ?? 38,
        alphaUnblend: reg.alphaUnblend ?? settings.alphaUnblend ?? true,
        showHighlight: false,
        temporalSmoothing: settings.temporalSmoothing,
        quality: settings.quality,
      };

      const interpolated = interpolateSettings(singleSettings, currentTime, clipStartTime, animations);
      const bounds = getPixelBounds(interpolated, clipWidth, clipHeight);
      if (
        bounds.centerX < -bounds.w || bounds.centerX > clipWidth + bounds.w ||
        bounds.centerY < -bounds.h || bounds.centerY > clipHeight + bounds.h
      ) {
        continue;
      }

      switch (interpolated.mode) {
        case 'content_aware':
          applyContentAwareStretch(resultCtx, resultCanvas, bounds, interpolated, clipWidth, clipHeight);
          break;
        case 'patch_replace':
          applyPatchReplace(resultCtx, resultCanvas, bounds, interpolated, clipWidth, clipHeight);
          break;
        case 'blur_conceal':
        case 'pixelate':
          applyBlurConceal(resultCtx, resultCanvas, bounds, interpolated, clipWidth, clipHeight);
          break;
      }
    }
    return resultCanvas;
  }
  
  // Interpolate keyframes for fluid temporal motion tracking
  const interpolated = interpolateSettings(settings, currentTime, clipStartTime, animations);
  
  // Calculate pixel bounding box and dimensions
  const bounds = getPixelBounds(interpolated, clipWidth, clipHeight);
  
  // Skip rendering if mask is completely off-screen
  if (
    bounds.centerX < -bounds.w || bounds.centerX > clipWidth + bounds.w ||
    bounds.centerY < -bounds.h || bounds.centerY > clipHeight + bounds.h
  ) {
    resultCtx.drawImage(sourceCanvas, 0, 0);
    return resultCanvas;
  }
  
  // Check temporal cache first
  const settingsHash = getObjectRemovalSettingsHash(interpolated);
  const sceneChanged = detectSceneChange(clipId + '_objr', sourceCanvas as HTMLCanvasElement);
  
  let cacheEntry = temporalInpaintCache.get(clipId);
  if (!sceneChanged && cacheEntry && cacheEntry.settingsHash === settingsHash && cacheEntry.frameCount < 3) {
    // Use cached result
    resultCtx.drawImage(cacheEntry.canvas, 0, 0);
    cacheEntry.frameCount++;
    return resultCanvas;
  }
  
  // Execute algorithm based on mode
  switch (interpolated.mode) {
    case 'content_aware':
      applyContentAwareStretch(resultCtx, sourceCanvas, bounds, interpolated, clipWidth, clipHeight);
      break;
    case 'patch_replace':
      applyPatchReplace(resultCtx, sourceCanvas, bounds, interpolated, clipWidth, clipHeight);
      break;
    case 'blur_conceal':
    case 'pixelate':
      applyBlurConceal(resultCtx, sourceCanvas, bounds, interpolated, clipWidth, clipHeight);
      break;
  }
  
  // Update cache
  if (!cacheEntry) {
    cacheEntry = { canvas: resultCanvas, frameCount: 0, settingsHash };
    temporalInpaintCache.set(clipId, cacheEntry);
  } else {
    cacheEntry.canvas = resultCanvas;
    cacheEntry.frameCount = 0;
    cacheEntry.settingsHash = settingsHash;
  }
  
  return resultCanvas;
}

/**
 * Clear cached resources on unmount / cleanup
 */
export function clearObjectRemovalCache(): void {
  featherGradientCache.clear();
  scratchCanvas = null;
  scratchCtx = null;
  tempCanvas = null;
  tempCtx = null;
  temporalInpaintCache.clear();
}
