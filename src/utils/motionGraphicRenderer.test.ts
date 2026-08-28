import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createHiddenContainer,
  destroyContainer,
  seekAllAnimations,
  captureFrameToCanvas,
} from './motionGraphicHtmlCapture';
import {
  renderMotionGraphicToVideo,
  MotionGraphicSpec,
} from './motionGraphicRenderer';
import {
  generateMotionGraphicsFromDialogue,
  GenerativeMotionOptions,
} from './generateMotionGraphicsFromDialogue';

describe('motionGraphicHtmlCapture', () => {
  it('handles hidden DOM container lifecycle safely', () => {
    const container = createHiddenContainer(1920, 1080);
    expect(container).toBeDefined();

    destroyContainer(container);
  });

  it('seeks animations using Web Animation API when available', () => {
    const mockPause = vi.fn();
    const mockAnimation = {
      pause: mockPause,
      currentTime: 0,
    };
    const mockContainer = {
      getAnimations: vi.fn().mockReturnValue([mockAnimation]),
    } as any;

    seekAllAnimations(mockContainer, 1500);
    expect(mockPause).toHaveBeenCalledTimes(1);
    expect(mockAnimation.currentTime).toBe(1500);
  });

  it('captures frame to canvas without throwing', async () => {
    const mockContainer = {
      childNodes: [],
      innerHTML: '<div style="color:red;">Test Graphic</div>',
    } as any;
    
    const mockCanvas = {
      getContext: vi.fn().mockReturnValue({
        drawImage: vi.fn(),
      }),
    } as any;

    await expect(captureFrameToCanvas(mockContainer, mockCanvas, 300, 200)).resolves.not.toThrow();
  });
});

describe('motionGraphicRenderer', () => {
  it('renders a motion graphic spec without crashing', async () => {
    const spec: MotionGraphicSpec = {
      width: 640,
      height: 360,
      fps: 15,
      duration: 0.2,
      canvasElements: [
        {
          component: 'KineticWord',
          enterAt: 0,
          exitAt: 0.2,
          config: {
            text: 'Hello World',
            color: '#ffff00',
          },
          position: { x: 320, y: 180 },
        },
      ],
      htmlCssScenes: [
        {
          enterAt: 0,
          exitAt: 0.2,
          description: 'Badge Scene',
          htmlCss: '<div style="font-size:24px;color:cyan;">Scene Test</div>',
        },
      ],
    };

    const progressUpdates: Array<{ step: string; pct: number }> = [];
    const blob = await renderMotionGraphicToVideo(spec, (step, pct) => {
      progressUpdates.push({ step, pct });
    });

    expect(blob).toBeDefined();
    expect(blob instanceof Blob).toBe(true);
    expect(progressUpdates.length).toBeGreaterThan(0);
  });
});

describe('generateMotionGraphicsFromDialogue', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('generates motion graphic spec and renders video from text dialogue', async () => {
    const mockSpecResponse = {
      transcribedText: 'Transform your videos with AI',
      duration: 2,
      canvasElements: [
        {
          component: 'KineticWord',
          enterAt: 0,
          exitAt: 2,
          config: { text: 'TRANSFORM', color: '#FFE600' },
          position: { x: 960, y: 540 },
        },
      ],
      htmlCssScenes: [],
    };

    // Mock global fetch for Gemini API
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: JSON.stringify(mockSpecResponse) }],
            },
          },
        ],
      }),
    });

    const options: GenerativeMotionOptions = {
      provider: 'gemini',
      style: 'mrbeast',
      layout: 'kinetic',
      dialogueText: 'Transform your videos with AI',
      targetDuration: 2,
    };

    const progressUpdates: Array<{ step: string; pct: number }> = [];
    const result = await generateMotionGraphicsFromDialogue(
      null,
      2,
      options,
      (step, pct) => {
        progressUpdates.push({ step, pct });
      }
    );

    expect(result).toBeDefined();
    expect(result.spec).toBeDefined();
    expect(result.spec.duration).toBe(2);
    expect(result.spec.canvasElements.length).toBeGreaterThan(0);
    expect(result.transcribedText).toBe('Transform your videos with AI');
    expect(result.webmBlob instanceof Blob).toBe(true);
    expect(progressUpdates.some((p) => p.pct === 100)).toBe(true);
  });
});
