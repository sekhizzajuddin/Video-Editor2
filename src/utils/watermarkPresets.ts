/**
 * watermarkPresets.ts
 * 
 * Presets and smart detection algorithms for removing video watermarks,
 * channel bugs, timestamps, and logos.
 */

import type { ObjectRemovalMode, ObjectRemovalShape, WatermarkRegion, WatermarkColorProfileId } from '@/types';

export interface WatermarkPreset {
  id: string;
  name: string;
  category: 'social' | 'broadcast' | 'stock' | 'custom';
  description: string;
  icon: string;
  x: number;          // Center X in %
  y: number;          // Center Y in %
  width: number;      // Width in %
  height: number;     // Height in %
  feather: number;    // Softness in px
  mode: ObjectRemovalMode;
  shape: ObjectRemovalShape;
  stretchStrength?: number;
}

export const WATERMARK_PRESETS: WatermarkPreset[] = [
  {
    id: 'bottom-right',
    name: 'Bottom Right',
    category: 'social',
    description: 'TikTok, CapCut, Bandicam, InShot watermark badge',
    icon: '↘️',
    x: 88,
    y: 88,
    width: 20,
    height: 12,
    feather: 14,
    mode: 'content_aware',
    shape: 'rectangle',
    stretchStrength: 85,
  },
  {
    id: 'top-right',
    name: 'Top Right',
    category: 'broadcast',
    description: 'TV Broadcast bug, channel station ID, YouTube branding',
    icon: '↗️',
    x: 88,
    y: 12,
    width: 20,
    height: 12,
    feather: 14,
    mode: 'content_aware',
    shape: 'rectangle',
    stretchStrength: 85,
  },
  {
    id: 'top-left',
    name: 'Top Left',
    category: 'social',
    description: 'Creator handle, TikTok username stamp, social tag',
    icon: '↖️',
    x: 12,
    y: 12,
    width: 20,
    height: 12,
    feather: 14,
    mode: 'content_aware',
    shape: 'rectangle',
    stretchStrength: 85,
  },
  {
    id: 'bottom-left',
    name: 'Bottom Left',
    category: 'broadcast',
    description: 'Timecode display, subtitle branding, date stamp',
    icon: '↙️',
    x: 12,
    y: 88,
    width: 20,
    height: 12,
    feather: 14,
    mode: 'content_aware',
    shape: 'rectangle',
    stretchStrength: 85,
  },
  {
    id: 'center-stamp',
    name: 'Center Stamp',
    category: 'stock',
    description: 'Stock footage preview stamps & copyright watermarks',
    icon: '🎯',
    x: 50,
    y: 50,
    width: 38,
    height: 22,
    feather: 18,
    mode: 'content_aware',
    shape: 'rectangle',
    stretchStrength: 90,
  },
  {
    id: 'blur-delogo-br',
    name: 'Blur De-Logo BR',
    category: 'broadcast',
    description: 'Smooth Gaussian blur conceal for high-contrast logos',
    icon: '💧',
    x: 88,
    y: 88,
    width: 18,
    height: 10,
    feather: 16,
    mode: 'blur_conceal',
    shape: 'rectangle',
  },
  {
    id: 'censor-pixelate',
    name: 'Mosaic Censor',
    category: 'custom',
    description: 'Classic pixelated block censor for logos & numbers',
    icon: '🔲',
    x: 50,
    y: 50,
    width: 24,
    height: 16,
    feather: 4,
    mode: 'pixelate',
    shape: 'rectangle',
  },
];

/**
 * Fast client-side heuristic scanner to detect watermark candidates
 * by analyzing high-frequency edge densities across the 4 corners of the video frame.
 */
export function detectWatermarkRegion(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  width: number,
  height: number
): { x: number; y: number; width: number; height: number; cornerName: string; confidence: number } | null {
  try {
    const scanW = 160;
    const scanH = 90;
    const offCanvas = typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(scanW, scanH)
      : typeof document !== 'undefined'
      ? document.createElement('canvas')
      : null;
    if (!offCanvas) {
      return { x: 88, y: 88, width: 20, height: 12, cornerName: 'Bottom-Right (Default)', confidence: 50 };
    }
    offCanvas.width = scanW;
    offCanvas.height = scanH;

    const ctx = offCanvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
    if (!ctx) {
      return { x: 88, y: 88, width: 20, height: 12, cornerName: 'Bottom-Right (Default)', confidence: 50 };
    }

    ctx.drawImage(canvas as any, 0, 0, scanW, scanH);
    const imgData = ctx.getImageData(0, 0, scanW, scanH);
    const data = imgData.data;

    // Corner zones: width 35% of frame, height 30% of frame
    const qw = Math.floor(scanW * 0.35);
    const qh = Math.floor(scanH * 0.30);

    const corners = [
      { name: 'Top-Left', x0: 0, y0: 0, x1: qw, y1: qh, targetX: 12, targetY: 12 },
      { name: 'Top-Right', x0: scanW - qw, y0: 0, x1: scanW, y1: qh, targetX: 88, targetY: 12 },
      { name: 'Bottom-Left', x0: 0, y0: scanH - qh, x1: qw, y1: scanH, targetX: 12, targetY: 88 },
      { name: 'Bottom-Right', x0: scanW - qw, y0: scanH - qh, x1: scanW, y1: scanH, targetX: 88, targetY: 88 },
    ];

    let bestCorner = corners[3]; // default bottom-right
    let maxEdgeScore = -1;

    for (const c of corners) {
      let edgeSum = 0;
      let pixelCount = 0;

      for (let y = c.y0 + 1; y < c.y1 - 1; y++) {
        for (let x = c.x0 + 1; x < c.x1 - 1; x++) {
          const idx = (y * scanW + x) * 4;
          const idxR = (y * scanW + (x + 1)) * 4;
          const idxD = ((y + 1) * scanW + x) * 4;

          const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
          const lumR = 0.299 * data[idxR] + 0.587 * data[idxR + 1] + 0.114 * data[idxR + 2];
          const lumD = 0.299 * data[idxD] + 0.587 * data[idxD + 1] + 0.114 * data[idxD + 2];

          const grad = Math.abs(lum - lumR) + Math.abs(lum - lumD);
          if (grad > 28) {
            edgeSum += grad;
          }
          pixelCount++;
        }
      }

      const score = edgeSum / Math.max(1, pixelCount);
      if (score > maxEdgeScore) {
        maxEdgeScore = score;
        bestCorner = c;
      }
    }

    const confidence = Math.min(100, Math.round(maxEdgeScore * 2.5));

    return {
      x: bestCorner.targetX,
      y: bestCorner.targetY,
      width: 20,
      height: 12,
      cornerName: bestCorner.name,
      confidence,
    };
  } catch (err) {
    console.warn('[WatermarkDetector] Heuristic analysis failed:', err);
    return {
      x: 88,
      y: 88,
      width: 20,
      height: 12,
      cornerName: 'Bottom-Right (Default)',
      confidence: 50,
    };
  }
}

/**
 * Smart AI detection using Gemini Vision if user has configured API key.
 * Analyzes video frame snapshot and returns the exact watermark bounding box.
 */
export async function detectWatermarkWithAI(
  frameDataUrl: string,
  geminiApiKey?: string
): Promise<{ detected: boolean; x: number; y: number; width: number; height: number; label: string } | null> {
  const apiKey = geminiApiKey || (typeof localStorage !== 'undefined' ? localStorage.getItem('gemini_api_key') : null);
  if (!apiKey) return null;

  try {
    const base64Data = frameDataUrl.replace(/^data:image\/[a-zA-Z]+;base64,/, '');

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: 'Analyze this video frame and locate any watermark, TV channel bug, creator handle, or logo. ' +
                    'Return ONLY valid JSON matching this schema: ' +
                    '{"detected": boolean, "x": number, "y": number, "width": number, "height": number, "label": string}. ' +
                    'Coordinates x, y must be the center point in percentage (0 to 100). ' +
                    'width and height must also be in percentage (1 to 100). Do not include markdown or backticks.',
                },
                {
                  inline_data: {
                    mime_type: 'image/jpeg',
                    data: base64Data,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 256,
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) return null;

    const cleaned = candidateText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    if (parsed && typeof parsed.x === 'number' && typeof parsed.y === 'number') {
      return {
        detected: parsed.detected ?? true,
        x: Math.max(0, Math.min(100, parsed.x)),
        y: Math.max(0, Math.min(100, parsed.y)),
        width: Math.max(4, Math.min(60, parsed.width ?? 20)),
        height: Math.max(4, Math.min(40, parsed.height ?? 12)),
        label: parsed.label || 'Detected Watermark',
      };
    }
  } catch (err) {
    console.warn('[WatermarkDetector] AI detection failed or skipped:', err);
  }

  return null;
}

/**
 * ============================================================================
 * FAMOUS WATERMARK COLOR SIGNATURES & REVERSE ALPHA UNBLENDING DATABASE
 * ============================================================================
 */

export interface WatermarkColorSample {
  name: string;
  hex: string;
  rgb: [number, number, number];
  typicalAlphaRange: [number, number]; // e.g., [0.15, 0.85]
  isWhiteOrNeutral?: boolean;
  isDarkShadow?: boolean;
}

export interface WatermarkColorProfile {
  id: WatermarkColorProfileId;
  name: string;
  shortName: string;
  icon: string;
  brands: string;
  description: string;
  primaryHex: string;
  accentHex?: string;
  defaultTolerance: number;
  supportsAlphaUnblend: boolean;
  colors: WatermarkColorSample[];
}

export const FAMOUS_WATERMARK_COLOR_PROFILES: WatermarkColorProfile[] = [
  {
    id: 'auto_smart',
    name: 'Auto Smart (Semi-White + All Famous Brands)',
    shortName: 'Auto Smart',
    icon: '✨',
    brands: 'Universal: Veo, Sora, TikTok, KineMaster, Filmora, Stock, TV',
    description: 'Automatically isolates Semi-Transparent White (#FFFFFF), Silver (#E6E6E6), and famous brand accent colors while keeping clean background pixels untouched.',
    primaryHex: '#FFFFFF',
    accentHex: '#25F4EE',
    defaultTolerance: 55,
    supportsAlphaUnblend: true,
    colors: [
      { name: 'Semi-Transparent White', hex: '#FFFFFF', rgb: [255, 255, 255], typicalAlphaRange: [0.12, 1.0], isWhiteOrNeutral: true },
      { name: 'Translucent Silver', hex: '#E6E6E6', rgb: [230, 230, 230], typicalAlphaRange: [0.15, 0.90], isWhiteOrNeutral: true },
      { name: 'TikTok Neon Cyan', hex: '#25F4EE', rgb: [37, 244, 238], typicalAlphaRange: [0.60, 1.0] },
      { name: 'TikTok / KineMaster Red', hex: '#EE1D51', rgb: [238, 29, 81], typicalAlphaRange: [0.60, 1.0] },
      { name: 'KineMaster Coral Red', hex: '#E72229', rgb: [231, 34, 41], typicalAlphaRange: [0.60, 1.0] },
      { name: 'Filmora Mint Cyan', hex: '#28D7C8', rgb: [40, 215, 200], typicalAlphaRange: [0.60, 1.0] },
      { name: 'Filmora / Viva Orange', hex: '#FF5500', rgb: [255, 85, 0], typicalAlphaRange: [0.60, 1.0] },
      { name: 'Drop Shadow Black', hex: '#000000', rgb: [0, 0, 0], typicalAlphaRange: [0.15, 0.55], isDarkShadow: true },
    ],
  },
  {
    id: 'semi_white',
    name: 'Semi-Transparent White (#FFFFFF)',
    shortName: 'Semi-White',
    icon: '🤍',
    brands: 'Google Veo, Gemini, Sora, Runway, Luma, Kling, YouTube, TV Bugs',
    description: 'Uses Mathematical Reverse Alpha Unblending to subtract translucent white/silver overlays (#FFFFFF to #D4D4D8) and restore the real video pixels underneath.',
    primaryHex: '#FFFFFF',
    accentHex: '#E2E8F0',
    defaultTolerance: 55,
    supportsAlphaUnblend: true,
    colors: [
      { name: 'Pure White Veil', hex: '#FFFFFF', rgb: [255, 255, 255], typicalAlphaRange: [0.10, 0.95], isWhiteOrNeutral: true },
      { name: 'Frost Silver', hex: '#E8E8E8', rgb: [232, 232, 232], typicalAlphaRange: [0.15, 0.85], isWhiteOrNeutral: true },
      { name: 'Soft Gray Mist', hex: '#D4D4D8', rgb: [212, 212, 216], typicalAlphaRange: [0.15, 0.80], isWhiteOrNeutral: true },
    ],
  },
  {
    id: 'tiktok',
    name: 'TikTok / Douyin (#FFFFFF + #25F4EE + #EE1D51)',
    shortName: 'TikTok',
    icon: '🎵',
    brands: 'TikTok, Douyin, Musical.ly',
    description: 'Targets TikTok pure white text (#FFFFFF) plus chromatic glitch Cyan (#25F4EE) and Neon Red/Pink (#EE1D51 / #FE2C55) with dark drop-shadow.',
    primaryHex: '#25F4EE',
    accentHex: '#EE1D51',
    defaultTolerance: 60,
    supportsAlphaUnblend: true,
    colors: [
      { name: 'TikTok White', hex: '#FFFFFF', rgb: [255, 255, 255], typicalAlphaRange: [0.50, 1.0], isWhiteOrNeutral: true },
      { name: 'TikTok Glitch Cyan', hex: '#25F4EE', rgb: [37, 244, 238], typicalAlphaRange: [0.50, 1.0] },
      { name: 'TikTok Glitch Pink-Red', hex: '#EE1D51', rgb: [238, 29, 81], typicalAlphaRange: [0.50, 1.0] },
      { name: 'TikTok Crimson', hex: '#FE2C55', rgb: [254, 44, 85], typicalAlphaRange: [0.50, 1.0] },
      { name: 'TikTok Shadow', hex: '#010101', rgb: [1, 1, 1], typicalAlphaRange: [0.15, 0.50], isDarkShadow: true },
    ],
  },
  {
    id: 'kinemaster',
    name: 'KineMaster (#FFFFFF + #E72229)',
    shortName: 'KineMaster',
    icon: '🎬',
    brands: 'KineMaster Mobile & Pro ("Made with KINEMASTER")',
    description: 'Targets KineMaster translucent white typography (#FFFFFF) and signature Coral Red K-logo (#E72229 / #FF3B30).',
    primaryHex: '#E72229',
    accentHex: '#FFFFFF',
    defaultTolerance: 58,
    supportsAlphaUnblend: true,
    colors: [
      { name: 'KineMaster White', hex: '#FFFFFF', rgb: [255, 255, 255], typicalAlphaRange: [0.40, 1.0], isWhiteOrNeutral: true },
      { name: 'KineMaster Brand Red', hex: '#E72229', rgb: [231, 34, 41], typicalAlphaRange: [0.55, 1.0] },
      { name: 'KineMaster Coral', hex: '#FF3B30', rgb: [255, 59, 48], typicalAlphaRange: [0.55, 1.0] },
      { name: 'KineMaster Shadow', hex: '#141414', rgb: [20, 20, 20], typicalAlphaRange: [0.15, 0.50], isDarkShadow: true },
    ],
  },
  {
    id: 'filmora',
    name: 'Wondershare Filmora (#FFFFFF + #28D7C8 + #FF5500)',
    shortName: 'Filmora',
    icon: '💎',
    brands: 'Wondershare Filmora, FilmoraGo',
    description: 'Targets Filmora white text (#FFFFFF), Mint-Cyan diamond icon (#28D7C8 / #00E5FF), and Brand Orange (#FF5500).',
    primaryHex: '#28D7C8',
    accentHex: '#FF5500',
    defaultTolerance: 58,
    supportsAlphaUnblend: true,
    colors: [
      { name: 'Filmora White', hex: '#FFFFFF', rgb: [255, 255, 255], typicalAlphaRange: [0.40, 1.0], isWhiteOrNeutral: true },
      { name: 'Filmora Mint Cyan', hex: '#28D7C8', rgb: [40, 215, 200], typicalAlphaRange: [0.50, 1.0] },
      { name: 'Filmora Aqua', hex: '#00E5FF', rgb: [0, 229, 255], typicalAlphaRange: [0.50, 1.0] },
      { name: 'Filmora Coral Orange', hex: '#FF5500', rgb: [255, 85, 0], typicalAlphaRange: [0.50, 1.0] },
    ],
  },
  {
    id: 'shutterstock',
    name: 'Stock Agencies (Shutterstock / Getty / Adobe)',
    shortName: 'Stock Veil',
    icon: '🏛️',
    brands: 'Shutterstock, Getty Images, iStock, Adobe Stock, Pond5, Storyblocks',
    description: 'Specialized low-opacity reverse alpha unblender for 15%–50% translucent white/gray stock preview watermarks and red accents (#E31B23).',
    primaryHex: '#FFFFFF',
    accentHex: '#E31B23',
    defaultTolerance: 62,
    supportsAlphaUnblend: true,
    colors: [
      { name: 'Stock Translucent White', hex: '#FFFFFF', rgb: [255, 255, 255], typicalAlphaRange: [0.10, 0.60], isWhiteOrNeutral: true },
      { name: 'Stock Neutral Gray', hex: '#CCCCCC', rgb: [204, 204, 204], typicalAlphaRange: [0.10, 0.60], isWhiteOrNeutral: true },
      { name: 'Shutterstock Red', hex: '#E31B23', rgb: [227, 27, 35], typicalAlphaRange: [0.35, 0.95] },
    ],
  },
  {
    id: 'bandicam',
    name: 'Screen Recorders (Bandicam / Camtasia / OBS)',
    shortName: 'Bandicam',
    icon: '🖥️',
    brands: 'www.BANDICAM.com, Camtasia, Fraps, Action!, ScreenRec',
    description: 'Targets crisp white URL lettering (#FFFFFF) and its dark anti-aliased outer stroke (#1A1A1A).',
    primaryHex: '#FFFFFF',
    accentHex: '#1A1A1A',
    defaultTolerance: 56,
    supportsAlphaUnblend: true,
    colors: [
      { name: 'Bandicam White', hex: '#FFFFFF', rgb: [255, 255, 255], typicalAlphaRange: [0.35, 1.0], isWhiteOrNeutral: true },
      { name: 'Bandicam Light Gray', hex: '#DCDCDC', rgb: [220, 220, 220], typicalAlphaRange: [0.30, 0.90], isWhiteOrNeutral: true },
      { name: 'Recorder Dark Stroke', hex: '#1A1A1A', rgb: [26, 26, 26], typicalAlphaRange: [0.20, 0.65], isDarkShadow: true },
    ],
  },
  {
    id: 'capcut',
    name: 'CapCut / InShot / VivaVideo / Canva',
    shortName: 'CapCut / Social',
    icon: '📱',
    brands: 'CapCut, InShot, VivaVideo, YouCut, VN, Canva, Kapwing, Veed',
    description: 'Targets mobile & web editor watermarks in White (#FFFFFF), Viva/InShot Orange (#FF6600), and Canva Cyan (#00C4CC).',
    primaryHex: '#FFFFFF',
    accentHex: '#FF6600',
    defaultTolerance: 56,
    supportsAlphaUnblend: true,
    colors: [
      { name: 'CapCut / InShot White', hex: '#FFFFFF', rgb: [255, 255, 255], typicalAlphaRange: [0.30, 1.0], isWhiteOrNeutral: true },
      { name: 'VivaVideo / InShot Orange', hex: '#FF6600', rgb: [255, 102, 0], typicalAlphaRange: [0.50, 1.0] },
      { name: 'Canva Cyan', hex: '#00C4CC', rgb: [0, 196, 204], typicalAlphaRange: [0.50, 1.0] },
      { name: 'Canva Purple', hex: '#7D2AE8', rgb: [125, 42, 232], typicalAlphaRange: [0.50, 1.0] },
    ],
  },
  {
    id: 'dark_logo',
    name: 'Dark / Black Watermark (#000000 – #2C2C2C)',
    shortName: 'Dark / Black',
    icon: '🖤',
    brands: 'Dark Channel Bugs, Black Text on Bright / Daylit Videos',
    description: 'Detects semi-transparent or solid black/charcoal watermarks (#000000 to #2C2C2C) over bright backgrounds.',
    primaryHex: '#000000',
    accentHex: '#2C2C2C',
    defaultTolerance: 55,
    supportsAlphaUnblend: true,
    colors: [
      { name: 'Pure Black', hex: '#000000', rgb: [0, 0, 0], typicalAlphaRange: [0.15, 1.0], isDarkShadow: true },
      { name: 'Charcoal Gray', hex: '#2C2C2C', rgb: [44, 44, 44], typicalAlphaRange: [0.15, 0.95], isDarkShadow: true },
    ],
  },
  {
    id: 'custom_color',
    name: 'Custom Picked Watermark Color',
    shortName: 'Custom Color',
    icon: '🎨',
    brands: 'Any Custom Brand Logo or Eyedropper Sampled Color',
    description: 'Isolates pixels matching your custom hex color (or sampled via the video canvas eyedropper) and blends only those pixels with the surrounding background.',
    primaryHex: '#FFFFFF',
    defaultTolerance: 55,
    supportsAlphaUnblend: true,
    colors: [],
  },
  {
    id: 'full_box',
    name: 'Full Box Harmonic Infill (Solid Badges)',
    shortName: 'Full Box',
    icon: '⬛',
    brands: 'Opaque Rectangular Banners & Solid Box Overlays',
    description: 'Replaces 100% of the marked bounding box with Harmonic Dirichlet Coons surface interpolation and camera grain.',
    primaryHex: '#FFFFFF',
    defaultTolerance: 100,
    supportsAlphaUnblend: false,
    colors: [],
  },
];

export function hexToRgb(hex: string): [number, number, number] {
  const clean = (hex || '#FFFFFF').replace('#', '').trim();
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16) || 255;
    const g = parseInt(clean[1] + clean[1], 16) || 255;
    const b = parseInt(clean[2] + clean[2], 16) || 255;
    return [r, g, b];
  }
  const num = parseInt(clean.substring(0, 6), 16);
  if (isNaN(num)) return [255, 255, 255];
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return (
    '#' +
    [clamp(r), clamp(g), clamp(b)]
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

export function getWatermarkColorProfile(profileId?: WatermarkColorProfileId): WatermarkColorProfile {
  return (
    FAMOUS_WATERMARK_COLOR_PROFILES.find((p) => p.id === profileId) ||
    FAMOUS_WATERMARK_COLOR_PROFILES[0]
  );
}

/**
 * Scans the pixels inside the user's marked watermark bounding box and compares
 * them against the surrounding clean background border ring to automatically
 * identify the watermark's exact color code (Hex/RGB), estimated semi-transparency (alpha),
 * and closest Famous Watermark Profile.
 */
export function scanWatermarkColorInBox(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  xPct: number,
  yPct: number,
  wPct: number,
  hPct: number
): {
  detectedHex: string;
  detectedRgb: [number, number, number];
  estimatedAlphaPct: number;
  estimatedOpacity: number;
  matchedProfileId: WatermarkColorProfileId;
  matchedProfileName: string;
  watermarkPixelsPct: number;
  watermarkPixelRatio: number;
} {
  const fallback = {
    detectedHex: '#FFFFFF',
    detectedRgb: [255, 255, 255] as [number, number, number],
    estimatedAlphaPct: 45,
    estimatedOpacity: 45,
    matchedProfileId: 'semi_white' as WatermarkColorProfileId,
    matchedProfileName: 'Semi-Transparent White (#FFFFFF)',
    watermarkPixelsPct: 25,
    watermarkPixelRatio: 0.25,
  };

  try {
    const cw = canvas.width || 640;
    const ch = canvas.height || 360;
    const ctx = canvas.getContext('2d', { willReadFrequently: true }) as
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D
      | null;
    if (!ctx) return fallback;

    const cx = (xPct / 100) * cw;
    const cy = (yPct / 100) * ch;
    const bw = Math.max(8, Math.round((wPct / 100) * cw));
    const bh = Math.max(8, Math.round((hPct / 100) * ch));
    const pad = 6;

    const sx = Math.max(0, Math.floor(cx - bw / 2 - pad));
    const sy = Math.max(0, Math.floor(cy - bh / 2 - pad));
    const sw = Math.min(cw - sx, bw + pad * 2);
    const sh = Math.min(ch - sy, bh + pad * 2);
    if (sw <= 4 || sh <= 4) return fallback;

    const imgData = ctx.getImageData(sx, sy, sw, sh);
    const data = imgData.data;

    // 1. Sample clean perimeter ring to estimate local background mean RGB & luminance
    let bgR = 0, bgG = 0, bgB = 0, bgCount = 0;
    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        const isBorder = x < pad || x >= sw - pad || y < pad || y >= sh - pad;
        if (!isBorder) continue;
        const idx = (y * sw + x) * 4;
        bgR += data[idx];
        bgG += data[idx + 1];
        bgB += data[idx + 2];
        bgCount++;
      }
    }

    if (bgCount === 0) return fallback;
    bgR /= bgCount;
    bgG /= bgCount;
    bgB /= bgCount;
    const bgLum = 0.299 * bgR + 0.587 * bgG + 0.114 * bgB;

    // 2. Scan interior pixels for watermark outliers (deviating significantly from background)
    let wmR = 0, wmG = 0, wmB = 0, wmWeightSum = 0;
    let wmPixelCount = 0;
    let totalInterior = 0;
    let alphaSum = 0;

    for (let y = pad; y < sh - pad; y++) {
      for (let x = pad; x < sw - pad; x++) {
        totalInterior++;
        const idx = (y * sw + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        const dR = r - bgR;
        const dG = g - bgG;
        const dB = b - bgB;
        const colorDist = Math.sqrt(0.3 * dR * dR + 0.59 * dG * dG + 0.11 * dB * dB);

        if (colorDist > 16) {
          wmPixelCount++;
          const weight = colorDist;
          wmR += r * weight;
          wmG += g * weight;
          wmB += b * weight;
          wmWeightSum += weight;

          // Estimate implied alpha if blending toward white or black
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          const estAlpha =
            lum >= bgLum
              ? (lum - bgLum) / Math.max(15, 255 - bgLum)
              : (bgLum - lum) / Math.max(15, bgLum);
          alphaSum += Math.max(0.1, Math.min(1.0, estAlpha));
        }
      }
    }

    if (wmPixelCount === 0 || wmWeightSum === 0) return fallback;

    const avgWmR = wmR / wmWeightSum;
    const avgWmG = wmG / wmWeightSum;
    const avgWmB = wmB / wmWeightSum;
    const avgAlpha = alphaSum / wmPixelCount;

    // Unblend the observed average watermark pixel from background to find the true pure watermark source color
    const unblendFactor = Math.max(0.25, Math.min(1.0, avgAlpha));
    let pureR = bgR + (avgWmR - bgR) / unblendFactor;
    let pureG = bgG + (avgWmG - bgG) / unblendFactor;
    let pureB = bgB + (avgWmB - bgB) / unblendFactor;

    pureR = Math.max(0, Math.min(255, pureR));
    pureG = Math.max(0, Math.min(255, pureG));
    pureB = Math.max(0, Math.min(255, pureB));

    // If low saturation and high brightness, snap cleanly to #FFFFFF (Semi-Transparent White)
    const maxC = Math.max(pureR, pureG, pureB);
    const minC = Math.min(pureR, pureG, pureB);
    const sat = maxC - minC;
    const pureLum = 0.299 * pureR + 0.587 * pureG + 0.114 * pureB;

    let matchedProfileId: WatermarkColorProfileId = 'auto_smart';
    let matchedProfileName = 'Auto Smart (Semi-White + Famous Brands)';

    if (pureLum > 195 && sat < 38) {
      pureR = 255;
      pureG = 255;
      pureB = 255;
      matchedProfileId = 'semi_white';
      matchedProfileName = 'Semi-Transparent White (#FFFFFF)';
    } else if (pureLum < 55 && sat < 35) {
      pureR = 0;
      pureG = 0;
      pureB = 0;
      matchedProfileId = 'dark_logo';
      matchedProfileName = 'Dark / Black Watermark (#000000)';
    } else {
      // Find closest famous brand color
      let bestDist = Infinity;
      for (const prof of FAMOUS_WATERMARK_COLOR_PROFILES) {
        if (prof.id === 'auto_smart' || prof.id === 'semi_white' || prof.id === 'custom_color' || prof.id === 'full_box') continue;
        for (const c of prof.colors) {
          if (c.isWhiteOrNeutral || c.isDarkShadow) continue;
          const dist = Math.hypot(pureR - c.rgb[0], pureG - c.rgb[1], pureB - c.rgb[2]);
          if (dist < bestDist) {
            bestDist = dist;
            if (dist < 75) {
              matchedProfileId = prof.id;
              matchedProfileName = prof.name;
            }
          }
        }
      }
    }

    const detectedHex = rgbToHex(pureR, pureG, pureB);
    const estimatedAlphaPct = Math.max(12, Math.min(100, Math.round(avgAlpha * 100)));
    const watermarkPixelRatio = Math.max(0.01, Math.min(1.0, wmPixelCount / Math.max(1, totalInterior)));
    const watermarkPixelsPct = Math.max(1, Math.min(100, Math.round(watermarkPixelRatio * 100)));

    return {
      detectedHex,
      detectedRgb: [Math.round(pureR), Math.round(pureG), Math.round(pureB)],
      estimatedAlphaPct,
      estimatedOpacity: estimatedAlphaPct,
      matchedProfileId,
      matchedProfileName,
      watermarkPixelsPct,
      watermarkPixelRatio,
    };
  } catch (err) {
    console.warn('[WatermarkScanner] Failed to scan watermark color in box:', err);
    return fallback;
  }
}

