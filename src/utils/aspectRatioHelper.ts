/**
 * aspectRatioHelper.ts — Smart resolution analysis & aspect ratio helpers.
 */

export type AspectRatioType = '16:9' | '9:16' | '1:1' | '4:3';

/**
 * Calculates the closest standard aspect ratio preset for a given pixel width and height.
 */
export function detectAspectRatio(width: number, height: number): AspectRatioType {
  if (!width || !height || width <= 0 || height <= 0) return '16:9';
  const ratio = width / height;

  const presets: Array<{ type: AspectRatioType; value: number }> = [
    { type: '16:9', value: 16 / 9 },  // 1.7778
    { type: '9:16', value: 9 / 16 },  // 0.5625
    { type: '1:1', value: 1 / 1 },    // 1.0000
    { type: '4:3', value: 4 / 3 },    // 1.3333
  ];

  let closestPreset = presets[0];
  let smallestDiff = Math.abs(ratio - presets[0].value);

  for (let i = 1; i < presets.length; i++) {
    const diff = Math.abs(ratio - presets[i].value);
    if (diff < smallestDiff) {
      smallestDiff = diff;
      closestPreset = presets[i];
    }
  }

  return closestPreset.type;
}

/**
 * Returns a human-friendly descriptive label for aspect ratio presets.
 */
export function formatAspectRatioLabel(ratio: AspectRatioType | string): string {
  switch (ratio) {
    case '16:9':
      return '16:9 Landscape Widescreen (YouTube, TV, Movies)';
    case '9:16':
      return '9:16 Vertical (TikTok, Shorts, Reels, Stories)';
    case '1:1':
      return '1:1 Square (Instagram Posts, Feed)';
    case '4:3':
      return '4:3 Classic TV / iPad (Standard)';
    default:
      return ratio;
  }
}

/**
 * Gets reference dimensions and preview badges for an aspect ratio.
 */
export function getAspectRatioMetadata(ratio: AspectRatioType | string): {
  label: string;
  shortLabel: string;
  badge: string;
  previewClass: string;
  width: number;
  height: number;
} {
  switch (ratio) {
    case '9:16':
      return {
        label: '9:16 Vertical (Shorts/TikTok)',
        shortLabel: '9:16 Vertical',
        badge: '📱 9:16 Vertical',
        previewClass: 'w-12 h-20',
        width: 1080,
        height: 1920,
      };
    case '1:1':
      return {
        label: '1:1 Square (Instagram)',
        shortLabel: '1:1 Square',
        badge: '🔲 1:1 Square',
        previewClass: 'w-16 h-16',
        width: 1080,
        height: 1080,
      };
    case '4:3':
      return {
        label: '4:3 Standard (Classic)',
        shortLabel: '4:3 Standard',
        badge: '📺 4:3 Standard',
        previewClass: 'w-18 h-14',
        width: 1440,
        height: 1080,
      };
    case '16:9':
    default:
      return {
        label: '16:9 Widescreen (Landscape)',
        shortLabel: '16:9 Widescreen',
        badge: '🖥️ 16:9 Landscape',
        previewClass: 'w-20 h-11',
        width: 1920,
        height: 1080,
      };
  }
}
