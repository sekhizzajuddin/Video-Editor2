/**
 * previewMath.ts
 * 
 * Math coordinate transformation functions and pixel manipulation utilities for Preview Canvas.
 * 
 * Connected to:
 * - PropertyPanel: Transform values (scale, x, y, rotation) and keyframe animations.
 * - Timeline: Current time position for keyframe animation interpolation.
 * - InteractiveCanvasOverlay: Screen <-> Image pixel coordinate mapping for mask drawing & crop handles.
 */

import { getAnimatedValue } from '@/utils/keyframes';
import { useEditorStore } from '@/store/editorStore';

/**
 * Helper to get active perRatioFraming adjustments for a clip
 */
function getPerRatioFraming(clipId: string, aX: number, aY: number, aScale: number) {
  try {
    const state = useEditorStore.getState();
    if (state.perRatioFramingEnabled && state.perRatioFraming[state.aspectRatio]?.[clipId]) {
      const framing = state.perRatioFraming[state.aspectRatio][clipId];
      if (framing.x !== undefined) aX += framing.x;
      if (framing.y !== undefined) aY += framing.y;
      if (framing.scale !== undefined) aScale *= (framing.scale / 100);
    }
  } catch (e) {
    // ignore outside store context
  }
  return { aX, aY, aScale };
}

/**
 * Calculates base and scaled dimensions for a given clip based on media type & viewport size.
 */
export function getClipDimensions(
  clip: any,
  mediaLibrary: any[],
  W: number,
  H: number
): { width: number; height: number } {
  if (!clip) return { width: 0, height: 0 };
  const mediaItem = mediaLibrary.find((m) => m.id === clip.mediaId) || null;
  let vw = W;
  let vh = H;
  
  if (mediaItem?.type === 'video' || mediaItem?.type === 'image') {
    vw = mediaItem.width || 1920;
    vh = mediaItem.height || 1080;
  } else if (mediaItem?.type === 'text' || clip.textSettings || clip.mediaId === 'text-placeholder') {
    const ts = clip.textSettings;
    if (ts) {
      const fontSize = Number(ts.fontSize) || 48;
      const text = String(ts.text || '');
      const lines = text.split('\n');
      const estCharWidth = fontSize * 0.6;
      const longestLine = lines.reduce((max: number, l: string) => Math.max(max, l.length), 0);
      vw = Math.max(80, longestLine * estCharWidth + 40);
      vh = lines.length * (fontSize * 1.35) + 20;
    } else {
      vw = 300;
      vh = 80;
    }
  }

  let scaleToFit = 1;
  if (mediaItem?.type === 'video' || mediaItem?.type === 'image') {
    scaleToFit = Math.min(W / (vw || 1), H / (vh || 1));
  }
  const baseW = vw * scaleToFit;
  const baseH = vh * scaleToFit;
  
  let scale = clip.transform?.scale ?? 100;
  const framed = getPerRatioFraming(clip.id, 0, 0, scale);
  scale = framed.aScale;

  return {
    width: baseW * (scale / 100),
    height: baseH * (scale / 100),
  };
}

/**
 * Maps screen coordinates (mouse/touch position) to unscaled clip image space coordinates.
 */
export function screenToImageCoords(
  mx: number,
  my: number,
  clip: any,
  baseW: number,
  baseH: number,
  currentTime: number
) {
  let aX = getAnimatedValue(clip.transform.x, currentTime, clip.startTime, clip.animations?.['transform.x']);
  let aY = getAnimatedValue(clip.transform.y, currentTime, clip.startTime, clip.animations?.['transform.y']);
  let aScale = getAnimatedValue(clip.transform.scale, currentTime, clip.startTime, clip.animations?.['transform.scale']);
  const aRot = getAnimatedValue(clip.transform.rotation, currentTime, clip.startTime, clip.animations?.['transform.rotation']);

  const framed = getPerRatioFraming(clip.id, aX, aY, aScale);
  aX = framed.aX;
  aY = framed.aY;
  aScale = framed.aScale;

  // 1. Translate back by clip center offset
  const tx = mx - aX;
  const ty = my - aY;

  // 2. Rotate back by negative rotation
  const theta = (-aRot * Math.PI) / 180;
  const rx = tx * Math.cos(theta) - ty * Math.sin(theta);
  const ry = tx * Math.sin(theta) + ty * Math.cos(theta);

  // 3. Scale back
  const sf = aScale / 100 || 1;
  const imgX = rx / sf;
  const imgY = ry / sf;

  // 4. Map from center-origin to top-left of image space
  return {
    x: imgX + baseW / 2,
    y: imgY + baseH / 2
  };
}

/**
 * Maps unscaled clip image space coordinates to screen viewport coordinates.
 */
export function imageToScreenCoords(
  ix: number,
  iy: number,
  clip: any,
  baseW: number,
  baseH: number,
  currentTime: number
) {
  let aX = getAnimatedValue(clip.transform.x, currentTime, clip.startTime, clip.animations?.['transform.x']);
  let aY = getAnimatedValue(clip.transform.y, currentTime, clip.startTime, clip.animations?.['transform.y']);
  let aScale = getAnimatedValue(clip.transform.scale, currentTime, clip.startTime, clip.animations?.['transform.scale']);
  const aRot = getAnimatedValue(clip.transform.rotation, currentTime, clip.startTime, clip.animations?.['transform.rotation']);

  const framed = getPerRatioFraming(clip.id, aX, aY, aScale);
  aX = framed.aX;
  aY = framed.aY;
  aScale = framed.aScale;

  // 1. Map to center-origin
  const cx = ix - baseW / 2;
  const cy = iy - baseH / 2;

  // 2. Scale
  const sf = aScale / 100 || 1;
  const sx = cx * sf;
  const sy = cy * sf;

  // 3. Rotate
  const theta = (aRot * Math.PI) / 180;
  const rx = sx * Math.cos(theta) - sy * Math.sin(theta);
  const ry = sx * Math.sin(theta) + sy * Math.cos(theta);

  // 4. Translate
  return {
    x: rx + aX,
    y: ry + aY
  };
}

/**
 * High-performance flood fill algorithm for magic wand selection on canvas ImageData.
 */
export function floodFill(
  imgData: ImageData,
  startX: number,
  startY: number,
  tolerance: number = 30
): Uint8ClampedArray {
  const w = imgData.width;
  const h = imgData.height;
  const pixels = imgData.data;
  const visited = new Uint8Array(w * h);
  const mask = new Uint8ClampedArray(w * h);

  const sx = Math.max(0, Math.min(w - 1, Math.floor(startX)));
  const sy = Math.max(0, Math.min(h - 1, Math.floor(startY)));

  const targetIdx = (sy * w + sx) * 4;
  const targetR = pixels[targetIdx];
  const targetG = pixels[targetIdx + 1];
  const targetB = pixels[targetIdx + 2];
  const targetA = pixels[targetIdx + 3];

  const queue: [number, number][] = [[sx, sy]];
  let head = 0;
  visited[sy * w + sx] = 1;

  while (head < queue.length) {
    const [cx, cy] = queue[head++];
    const idx = cy * w + cx;
    mask[idx] = 255;

    const neighbors = [
      [cx + 1, cy],
      [cx - 1, cy],
      [cx, cy + 1],
      [cx, cy - 1]
    ];

    for (const [nx, ny] of neighbors) {
      if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
        const nIdx = ny * w + nx;
        if (!visited[nIdx]) {
          visited[nIdx] = 1;
          const pIdx = nIdx * 4;
          const dr = pixels[pIdx] - targetR;
          const dg = pixels[pIdx + 1] - targetG;
          const db = pixels[pIdx + 2] - targetB;
          const da = pixels[pIdx + 3] - targetA;
          const dist = Math.sqrt(dr * dr + dg * dg + db * db + da * da);
          if (dist <= tolerance) {
            queue.push([nx, ny]);
          }
        }
      }
    }
  }
  return mask;
}

/**
 * Fast multi-pass color-diffusion inpainting for erasing masked regions in ImageData.
 */
export function inpaint(imageData: ImageData, maskData: Uint8ClampedArray) {
  const w = imageData.width;
  const h = imageData.height;
  const pixels = imageData.data;
  const src = new Uint8ClampedArray(pixels);

  for (let iter = 0; iter < 18; iter++) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const maskIdx = y * w + x;

        if (maskData[maskIdx] > 128) {
          let rSum = 0, gSum = 0, bSum = 0, aSum = 0;
          let count = 0;

          const neighborCoords = [
            [Math.max(0, y - 1), x],
            [Math.min(h - 1, y + 1), x],
            [y, Math.max(0, x - 1)],
            [y, Math.min(w - 1, x + 1)]
          ];

          neighborCoords.forEach(([ny, nx]) => {
            const nIdx = (ny * w + nx) * 4;
            const nMIdx = ny * w + nx;
            if (maskData[nMIdx] <= 128) {
              rSum += src[nIdx];
              gSum += src[nIdx + 1];
              bSum += src[nIdx + 2];
              aSum += src[nIdx + 3];
              count++;
            }
          });

          if (count > 0) {
            pixels[idx] = rSum / count;
            pixels[idx + 1] = gSum / count;
            pixels[idx + 2] = bSum / count;
            pixels[idx + 3] = aSum / count;
          } else {
            let rSumAll = 0, gSumAll = 0, bSumAll = 0, aSumAll = 0;
            neighborCoords.forEach(([ny, nx]) => {
              const nIdx = (ny * w + nx) * 4;
              rSumAll += pixels[nIdx];
              gSumAll += pixels[nIdx + 1];
              bSumAll += pixels[nIdx + 2];
              aSumAll += pixels[nIdx + 3];
            });
            pixels[idx] = rSumAll / 4;
            pixels[idx + 1] = gSumAll / 4;
            pixels[idx + 2] = bSumAll / 4;
            pixels[idx + 3] = aSumAll / 4;
          }
        }
      }
    }
    src.set(pixels);
  }
}
