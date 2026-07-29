/**
 * imageBitmapPool.ts
 *
 * LRU pool of ImageBitmap instances. Reusing ImageBitmaps via createImageBitmap
 * (or via video element capture) avoids GC churn during heavy scrubbing where
 * the engine allocates several bitmaps per frame. Capacity is bounded so we
 * never hold more than ~64 MB of decoded pixels.
 *
 * Usage:
 *   const bmp = await acquireImageBitmap(url, w, h);
 *   // ... draw bmp to canvas ...
 *   releaseImageBitmap(bmp);   // returns to pool
 *
 * The bitmap is closed when the pool evicts it.
 */

interface Entry {
  bitmap: ImageBitmap;
  width: number;
  height: number;
  lastUsed: number;
}

const pool: Entry[] = [];
const MAX_ENTRIES = 32;
const MAX_PIXELS = 64 * 1024 * 1024; // 64 MB cap

let totalPixels = 0;

/**
 * Try to find a reusable bitmap in the pool. If none, return null so the
 * caller can create one. The caller should call `releaseImageBitmap()`
 * after rendering, which inserts it into the pool (subject to LRU eviction).
 */
export function acquireImageBitmap(width: number, height: number): ImageBitmap | null {
  const now = performance.now();
  // Reuse exact dimensions first
  for (let i = 0; i < pool.length; i++) {
    if (pool[i].width === width && pool[i].height === height) {
      const entry = pool.splice(i, 1)[0];
      entry.lastUsed = now;
      // Keep in pool (do not re-insert; caller will release)
      pool.push(entry);
      return entry.bitmap;
    }
  }
  return null;
}

/**
 * Return a bitmap to the pool. If the pool is at capacity, the LRU entry is
 * closed and dropped.
 */
export function releaseImageBitmap(bitmap: ImageBitmap): void {
  const now = performance.now();
  const w = bitmap.width;
  const h = bitmap.height;
  const pixels = w * h;

  // Evict to make room
  while (pool.length >= MAX_ENTRIES || totalPixels + pixels > MAX_PIXELS) {
    const evicted = pool.shift();
    if (!evicted) break;
    try { evicted.bitmap.close(); } catch { /* already closed */ }
    totalPixels -= evicted.width * evicted.height;
  }

  pool.push({ bitmap, width: w, height: h, lastUsed: now });
  totalPixels += pixels;
}

/**
 * Clear the entire pool. Called on project unload or memory pressure.
 */
export function clearImageBitmapPool(): void {
  for (const e of pool) {
    try { e.bitmap.close(); } catch { /* ignore */ }
  }
  pool.length = 0;
  totalPixels = 0;
}

export function getImageBitmapPoolStats() {
  return {
    entries: pool.length,
    maxEntries: MAX_ENTRIES,
    pixelsMB: Math.round(totalPixels / 1024 / 1024),
    maxPixelsMB: Math.round(MAX_PIXELS / 1024 / 1024),
  };
}
