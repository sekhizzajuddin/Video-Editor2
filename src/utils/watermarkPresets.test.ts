import { describe, it, expect } from 'vitest';
import { WATERMARK_PRESETS, detectWatermarkRegion } from './watermarkPresets';

describe('watermarkPresets', () => {
  it('defines standard corner presets', () => {
    expect(WATERMARK_PRESETS.length).toBeGreaterThanOrEqual(5);

    const br = WATERMARK_PRESETS.find((p) => p.id === 'bottom-right');
    expect(br).toBeDefined();
    expect(br?.x).toBe(88);
    expect(br?.y).toBe(88);
    expect(br?.mode).toBe('content_aware');

    const tr = WATERMARK_PRESETS.find((p) => p.id === 'top-right');
    expect(tr).toBeDefined();
    expect(tr?.x).toBe(88);
    expect(tr?.y).toBe(12);

    const tl = WATERMARK_PRESETS.find((p) => p.id === 'top-left');
    expect(tl).toBeDefined();
    expect(tl?.x).toBe(12);
    expect(tl?.y).toBe(12);
  });

  it('runs heuristic detection safely with mock canvas', () => {
    const mockCanvas = {
      width: 640,
      height: 360,
      getContext: () => ({
        drawImage: () => {},
        getImageData: () => ({
          data: new Uint8ClampedArray(160 * 90 * 4),
        }),
      }),
    } as any;

    const detected = detectWatermarkRegion(mockCanvas, 640, 360);
    expect(detected).toBeDefined();
    expect(detected?.x).toBeGreaterThan(0);
    expect(detected?.y).toBeGreaterThan(0);
    expect(detected?.confidence).toBeGreaterThanOrEqual(0);
  });
});
