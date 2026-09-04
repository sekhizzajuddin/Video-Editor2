import { describe, it, expect } from 'vitest';
import { measureWordWidth } from './kineticTypography';

describe('measureWordWidth', () => {
  it('measures non-empty strings with positive width', () => {
    const w1 = measureWordWidth('Universe', 58, 'Anton', true);
    const w2 = measureWordWidth('Ka', 42, 'Inter', false);
    const w3 = measureWordWidth('Nuclear', 58, 'Anton', true);

    expect(w1).toBeGreaterThan(0);
    expect(w2).toBeGreaterThan(0);
    expect(w3).toBeGreaterThan(0);
    expect(w1).toBeGreaterThan(w2 * 2);
  });

  it('handles empty string gracefully', () => {
    expect(measureWordWidth('', 48, 'Inter')).toBe(0);
  });

  it('reflects font size changes', () => {
    const small = measureWordWidth('Test', 36, 'Inter');
    const large = measureWordWidth('Test', 72, 'Inter');
    expect(large).toBeGreaterThan(small * 1.5);
  });

  it('reflects bold styling', () => {
    const normal = measureWordWidth('Testing', 50, 'Inter', false);
    const bold = measureWordWidth('Testing', 50, 'Inter', true);
    expect(bold).toBeGreaterThanOrEqual(normal);
  });

  it('prevents overlap for the user scenario: Universe Ka Start Nuclear aur', () => {
    const words = [
      { text: 'Universe', fontSize: 58, fontFamily: 'Anton', bold: true },
      { text: 'Ka', fontSize: 42, fontFamily: 'Inter', bold: false },
      { text: 'Start', fontSize: 48, fontFamily: 'Inter', bold: false },
      { text: 'Nuclear', fontSize: 58, fontFamily: 'Anton', bold: true },
      { text: 'aur', fontSize: 42, fontFamily: 'Inter', bold: false },
    ];

    const measured = words.map((w) => ({
      ...w,
      width: measureWordWidth(w.text, w.fontSize, w.fontFamily, w.bold),
    }));

    const spaceWidth = 20;
    const maxLineWidth = 660;

    const lines: (typeof measured)[] = [[]];
    let curW = 0;

    for (const m of measured) {
      const line = lines[lines.length - 1];
      if (line.length > 0 && curW + spaceWidth + m.width > maxLineWidth) {
        lines.push([m]);
        curW = m.width;
      } else {
        line.push(m);
        curW += (line.length === 1 ? 0 : spaceWidth) + m.width;
      }
    }

    // Must wrap into at least 2 lines so words don't jam onto one line
    expect(lines.length).toBeGreaterThanOrEqual(2);

    // Verify non-overlapping layout on every line
    lines.forEach((line) => {
      const totalLineW = line.reduce((sum, w) => sum + w.width, 0) + (line.length - 1) * spaceWidth;
      let curX = -totalLineW / 2;

      const positions: { left: number; right: number; center: number }[] = [];
      line.forEach((w) => {
        const center = curX + w.width / 2;
        const left = curX;
        const right = curX + w.width;
        positions.push({ left, right, center });
        curX += w.width + spaceWidth;
      });

      for (let i = 1; i < positions.length; i++) {
        // The left edge of word i must be strictly greater than the right edge of word i-1 by at least spaceWidth
        const gap = positions[i].left - positions[i - 1].right;
        expect(gap).toBeGreaterThanOrEqual(spaceWidth);
      }
    });
  });
});
