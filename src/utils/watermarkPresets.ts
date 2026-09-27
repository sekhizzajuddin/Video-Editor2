/**
 * watermarkPresets.ts
 * 
 * Presets and smart detection algorithms for removing video watermarks,
 * channel bugs, timestamps, and logos.
 */

import type { ObjectRemovalMode, ObjectRemovalShape, WatermarkRegion } from '@/types';

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
