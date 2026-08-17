export type ExportQuality = 'low' | 'medium' | 'high' | 'ultra';

/**
 * YouTube-friendly H.264 targets. These are intentionally VBR targets rather
 * than maximum encoder rates: visually complex scenes get enough detail while
 * normal footage stays small enough to upload quickly.
 */
export function recommendedVideoBitrate(
  width: number,
  height: number,
  fps: number,
  quality: ExportQuality = 'high',
): number {
  const pixels = Math.max(1, width * height);
  const fpsFactor = fps > 30 ? 1.45 : fps < 30 ? 0.9 : 1;

  let highTarget: number;
  if (pixels >= 3840 * 2160) highTarget = 35_000_000;
  else if (pixels >= 2560 * 1440) highTarget = 16_000_000;
  else if (pixels >= 1920 * 1080) highTarget = 8_000_000;
  else if (pixels >= 1280 * 720) highTarget = 5_000_000;
  else highTarget = 2_500_000;

  const qualityFactor: Record<ExportQuality, number> = {
    low: 0.5,
    medium: 0.72,
    high: 1,
    ultra: 1.35,
  };
  return Math.round(highTarget * fpsFactor * qualityFactor[quality]);
}

/** AVC profile/level strings valid for the requested frame size/rate. */
export function h264CodecCandidates(width: number, height: number, fps: number): string[] {
  const macroblocksPerFrame = Math.ceil(width / 16) * Math.ceil(height / 16);
  const macroblocksPerSecond = macroblocksPerFrame * fps;

  // Levels are selected conservatively so Chrome does not accept configure()
  // and then asynchronously close the encoder on the first frame.
  let level = '1f'; // 3.1: 720p30
  if (macroblocksPerFrame > 3600 || macroblocksPerSecond > 108_000) level = '28'; // 4.0
  if (macroblocksPerFrame > 8192 || macroblocksPerSecond > 245_760) level = '2a'; // 4.2
  if (macroblocksPerFrame > 8704 || macroblocksPerSecond > 522_240) level = '33'; // 5.1
  if (macroblocksPerSecond > 983_040) level = '34'; // 5.2

  return [
    `avc1.6400${level}`, // High profile: best compression
    `avc1.4d00${level}`, // Main profile: broad hardware support
    `avc1.4200${level}`, // Baseline fallback
  ];
}
