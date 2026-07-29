/**
 * storageMonitor.ts
 *
 * Browser storage health meter. Reports quota usage from navigator.storage.estimate()
 * and warns the user when 80%+ full. Also exposes the RAM windowed cache stats.
 */

import { getCacheStats } from './ramWindowedBlobCache';

export interface StorageReport {
  quotaMB: number;
  usedMB: number;
  percent: number;
  windowCache: {
    entries: number;
    maxEntries: number;
    windowSeconds: number;
  };
}

export async function getStorageReport(): Promise<StorageReport | null> {
  let quotaMB = 0;
  let usedMB = 0;
  let percent = 0;

  if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
    try {
      const { quota, usage } = await navigator.storage.estimate();
      quotaMB = Math.round((quota ?? 0) / 1024 / 1024);
      usedMB = Math.round((usage ?? 0) / 1024 / 1024);
      percent = quota ? Math.round((usedMB / quotaMB) * 100) : 0;
    } catch {
      // Permission denied or unsupported — silent fallthrough
    }
  }

  return {
    quotaMB,
    usedMB,
    percent,
    windowCache: getCacheStats(),
  };
}

export interface StorageMonitorHandle {
  stop: () => void;
}

/**
 * Periodically poll storage usage. Calls `onWarn` when usage crosses 80%.
 * Returns a handle to stop the monitor.
 */
export function startStorageMonitor(
  onWarn: (report: StorageReport) => void,
  intervalMs: number = 60_000,
): StorageMonitorHandle {
  let warned = false;
  const id = window.setInterval(async () => {
    const report = await getStorageReport();
    if (!report) return;
    if (report.percent >= 80 && !warned) {
      warned = true;
      onWarn(report);
    } else if (report.percent < 70) {
      // Reset warn flag so we re-warn if usage climbs back up.
      warned = false;
    }
  }, intervalMs);

  return {
    stop: () => window.clearInterval(id),
  };
}
