import { describe, it, expect } from 'vitest';
import { validateSceneQuality } from './generateMotionGraphicsFromDialogue';
import type { MotionGraphicSpec } from './motionGraphicRenderer';

const WORLD = `
  <svg viewBox="0 0 1920 1080">
    <polygon points="0,1080 400,600 900,1080"/><polygon points="900,1080 1400,500 1920,1080"/>
    <rect x="100" y="700" width="60" height="200"/><rect x="200" y="760" width="60" height="140"/>
    <rect x="300" y="800" width="60" height="100"/><rect x="400" y="840" width="60" height="60"/>
    <circle cx="600" cy="500" r="20"/><circle cx="700" cy="470" r="20"/>
    <circle cx="800" cy="440" r="20"/><circle cx="900" cy="410" r="20"/>
    <ellipse cx="1000" cy="900" rx="80" ry="16"/><line x1="600" y1="500" x2="900" y2="410"/>
    <path d="M600 500 C700 420 800 380 900 410"/>
  </svg>
  <div class="caption">Growth 2010 → 2024</div>
`;

const TYPOGRAPHY = `
  <div style="font-size:120px">BIG WORDS</div>
  <div style="font-size:80px">more words</div>
`;

const spec = (html: string): MotionGraphicSpec => ({
  width: 1920,
  height: 1080,
  fps: 30,
  duration: 5,
  canvasElements: [],
  htmlCssScenes: [
    { enterAt: 0, exitAt: 2.5, description: 'Opening', htmlCss: html },
    { enterAt: 2.5, exitAt: 5, description: 'Closing', htmlCss: html },
  ],
});

describe('validateSceneQuality', () => {
  it('accepts a dense vector scene', () => {
    expect(validateSceneQuality(spec(WORLD), 'vox')).toEqual([]);
  });

  it('rejects typography-only scenes for vector styles', () => {
    const issues = validateSceneQuality(spec(TYPOGRAPHY), 'vox');
    expect(issues).toHaveLength(2);
    expect(issues[0]).toMatch(/Scene 1 .* only 0 SVG shape elements/);
    expect(issues[0]).toMatch(/at least 12/);
  });

  it('flags a missing htmlCssScenes list outright', () => {
    const issues = validateSceneQuality({ ...spec(WORLD), htmlCssScenes: [] }, 'vox');
    expect(issues[0]).toMatch(/No htmlCssScenes/);
  });

  it('holds the minimal style to a lower bar', () => {
    const minimal = `<svg viewBox="0 0 1920 1080">
      <circle cx="10" cy="10" r="4"/><circle cx="40" cy="10" r="4"/>
      <circle cx="70" cy="10" r="4"/><circle cx="100" cy="10" r="4"/>
      <line x1="0" y1="40" x2="400" y2="40"/>
    </svg>`;
    expect(validateSceneQuality(spec(minimal), 'minimal')).toEqual([]);
    expect(validateSceneQuality(spec(minimal), 'vox')).toHaveLength(2);
  });
});
