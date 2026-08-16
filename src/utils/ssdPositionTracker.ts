/**
 * ssdPositionTracker.ts
 * 
 * SSD (Sum of Squared Differences) position tracker for Motion Tracked Effects.
 * 
 * Used as the POSITION stage in the hybrid tracking pipeline:
 *   1. SSD finds WHERE the object is (this file)
 *   2. Colour matching produces the MASK shape (motionMask.ts)
 * 
 * The SSD approach is already proven in motionTracker.ts for box-mode tracking.
 * This module adapts it for paint-mode: instead of tracking a user-drawn box,
 * it tracks the BOUNDING BOX of the painted stroke.
 * 
 * Performance: <1ms per frame at 32×32 template size on a 240px analysis canvas.
 */

/**
 * Capture a grayscale SSD template from the analysis canvas at the given
 * bounding box (in analysis-space pixels).
 * 
 * Returns a serializable template object, or null on failure.
 */
export interface SsdTemplate {
  /** Flat grayscale patch, row-major, `patchSize * patchSize` entries. */
  patchData: number[];
  /** Side length of the square template. */
  patchSize: number;
  /** Centre of the template in analysis-space at capture time. */
  originX: number;
  originY: number;
}

export function captureSsdTemplate(
  imageData: ImageData,
  cx: number,
  cy: number,
  desiredSize: number = 32
): SsdTemplate | null {
  const { width, height, data } = imageData;
  const patchSize = Math.min(desiredSize, Math.min(width, height));
  const half = Math.floor(patchSize / 2);

  const startX = Math.max(0, Math.round(cx) - half);
  const startY = Math.max(0, Math.round(cy) - half);
  const endX = Math.min(width, startX + patchSize);
  const endY = Math.min(height, startY + patchSize);
  const w = endX - startX;
  const h = endY - startY;
  if (w < 8 || h < 8) return null;

  const patchData: number[] = new Array(patchSize * patchSize).fill(128);
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const srcIdx = ((startY + py) * width + (startX + px)) * 4;
      patchData[py * patchSize + px] = Math.round(
        0.299 * data[srcIdx] + 0.587 * data[srcIdx + 1] + 0.114 * data[srcIdx + 2]
      );
    }
  }

  return {
    patchData,
    patchSize,
    originX: cx,
    originY: cy,
  };
}

/**
 * Find the best-matching position for the template in the given frame.
 * 
 * Returns the new centre (in analysis-space pixels) and a confidence score,
 * or null if the match is too poor (scene cut, object left the frame).
 * 
 * @param imageData  Current frame's full ImageData at analysis resolution.
 * @param template   The grayscale template captured on frame 1.
 * @param lastX      Last known X position (analysis pixels).
 * @param lastY      Last known Y position (analysis pixels).
 * @param searchRadius  How far to search from lastX/lastY, in pixels.
 */
export function ssdTrackPosition(
  imageData: ImageData,
  template: SsdTemplate,
  lastX: number,
  lastY: number,
  searchRadius: number
): { x: number; y: number; confidence: number } | null {
  const { width, height, data } = imageData;
  const { patchData, patchSize } = template;
  const half = Math.floor(patchSize / 2);

  // Build grayscale view of the search region
  const sx0 = Math.max(0, Math.round(lastX) - searchRadius - half);
  const sy0 = Math.max(0, Math.round(lastY) - searchRadius - half);
  const sx1 = Math.min(width, Math.round(lastX) + searchRadius + half);
  const sy1 = Math.min(height, Math.round(lastY) + searchRadius + half);
  const sW = sx1 - sx0;
  const sH = sy1 - sy0;
  if (sW <= patchSize || sH <= patchSize) return null;

  // Extract grayscale of search region
  const searchGray = new Float32Array(sW * sH);
  for (let y = 0; y < sH; y++) {
    for (let x = 0; x < sW; x++) {
      const srcIdx = ((sy0 + y) * width + (sx0 + x)) * 4;
      searchGray[y * sW + x] =
        0.299 * data[srcIdx] + 0.587 * data[srcIdx + 1] + 0.114 * data[srcIdx + 2];
    }
  }

  const templateF32 = new Float32Array(patchData);

  // Slide the template across the search region
  const scanW = sW - patchSize;
  const scanH = sH - patchSize;
  let bestDx = 0, bestDy = 0;
  let minSSD = Infinity;

  // Step size: 1 for small searches, 2 for large
  const step = searchRadius > 50 ? 2 : 1;

  for (let dy = 0; dy < scanH; dy += step) {
    for (let dx = 0; dx < scanW; dx += step) {
      let ssd = 0;
      // Compare every other row for speed (2× faster, <1% accuracy loss)
      for (let ty = 0; ty < patchSize; ty += 2) {
        const tRow = ty * patchSize;
        const sRow = (dy + ty) * sW + dx;
        for (let tx = 0; tx < patchSize; tx++) {
          const diff = templateF32[tRow + tx] - searchGray[sRow + tx];
          ssd += diff * diff;
        }
        if (ssd > minSSD) break; // early exit
      }
      if (ssd < minSSD) {
        minSSD = ssd;
        bestDx = dx;
        bestDy = dy;
      }
    }
  }

  // Convert back to analysis-space coordinates
  const foundX = sx0 + bestDx + half;
  const foundY = sy0 + bestDy + half;

  // Confidence: 0 = worst, 1 = perfect match
  const maxSSD = 255 * 255 * (patchSize * patchSize / 2); // /2 because we skip rows
  const confidence = 1 - Math.min(1, minSSD / maxSSD);

  // Reject very poor matches (scene cut, object left frame)
  if (confidence < 0.12) return null;

  return { x: foundX, y: foundY, confidence };
}
