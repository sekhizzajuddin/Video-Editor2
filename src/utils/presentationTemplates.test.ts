import { describe, it, expect, beforeEach } from 'vitest';
import {
  PRESENTATION_TEMPLATES,
  generatePlaceholderSvg,
  applyPresentationTemplate,
  formatClipsToPresentation,
} from './presentationTemplates';
import { useEditorStore } from '@/store/editorStore';

describe('presentationTemplates', () => {
  beforeEach(() => {
    useEditorStore.setState({
      tracks: [
        { id: 'v1', name: 'Video 1', type: 'video', clips: [] },
        { id: 'a1', name: 'Audio 1', type: 'audio', clips: [] },
      ],
      mediaLibrary: [],
      selectedClipId: null,
      selectedClipIds: [],
      currentTime: 0,
    });
  });

  it('contains at least 10 premium presentation templates with valid configurations', () => {
    expect(PRESENTATION_TEMPLATES.length).toBeGreaterThanOrEqual(10);

    for (const tmpl of PRESENTATION_TEMPLATES) {
      expect(tmpl.id).toBeTruthy();
      expect(tmpl.name).toBeTruthy();
      expect(tmpl.description).toBeTruthy();
      expect(tmpl.defaultDuration).toBeGreaterThan(0);
      expect(tmpl.accentColor).toMatch(/^#[0-9a-fA-F]{6}$/);

      // A-roll config
      expect(tmpl.aRoll).toBeDefined();
      expect(tmpl.aRoll.transform).toBeDefined();
      expect(typeof tmpl.aRoll.transform.scale).toBe('number');

      // B-roll config
      expect(tmpl.bRoll).toBeDefined();
      expect(tmpl.bRoll.transform).toBeDefined();
      expect(typeof tmpl.bRoll.transform.scale).toBe('number');
    }
  });

  it('generates valid SVG data URLs for A-Roll and B-Roll placeholders', () => {
    const aSvg = generatePlaceholderSvg('a-roll', 'Speaker Host', '1080p Stream');
    expect(aSvg.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true);
    expect(aSvg).toContain('A-ROLL');
    expect(aSvg).toContain('Speaker%20Host');

    const bSvg = generatePlaceholderSvg('b-roll', 'Demo Slide', 'Presentation Stream');
    expect(bSvg.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true);
    expect(bSvg).toContain('B-ROLL');
    expect(bSvg).toContain('Demo%20Slide');
  });

  it('applies presentation template to timeline creating multi-track clips', () => {
    const tmpl = PRESENTATION_TEMPLATES[0]; // Keynote Dual Stage (50/50)
    applyPresentationTemplate({
      template: tmpl,
      startTime: 2.0,
      speakerName: 'Jane Doe',
      topicTitle: 'Q3 Earnings',
    });

    const state = useEditorStore.getState();
    const videoTracks = state.tracks.filter((t) => t.type === 'video');
    expect(videoTracks.length).toBeGreaterThanOrEqual(2);

    // At least 2 video clips (A-Roll & B-Roll) created at startTime 2.0
    const allClips = state.tracks.flatMap((t) => t.clips);
    const aRollClip = allClips.find((c) => c.name?.includes('A-Roll'));
    const bRollClip = allClips.find((c) => c.name?.includes('B-Roll'));

    expect(aRollClip).toBeDefined();
    expect(bRollClip).toBeDefined();
    expect(aRollClip?.startTime).toBe(2.0);
    expect(bRollClip?.startTime).toBe(2.0);
    expect(aRollClip?.duration).toBe(tmpl.defaultDuration);
    expect(bRollClip?.duration).toBe(tmpl.defaultDuration);

    // Transforms match template definition
    expect(aRollClip?.transform.x).toBe(tmpl.aRoll.transform.x);
    expect(bRollClip?.transform.x).toBe(tmpl.bRoll.transform.x);
  });

  it('formats existing timeline clips when formatClipsToPresentation is called', () => {
    const tmpl = PRESENTATION_TEMPLATES.find((t) => t.id === 'pip_executive_bottom_right')!;
    useEditorStore.setState({
      tracks: [
        {
          id: 'v1',
          name: 'Video 1',
          type: 'video',
          clips: [
            {
              id: 'test_c1',
              mediaId: 'm1',
              trackId: 'v1',
              startTime: 0,
              duration: 5,
              trimStart: 0,
              trimEnd: 0,
              transform: { x: 0, y: 0, scale: 100, rotation: 0 },
              opacity: 1,
              speed: 1,
              effects: [],
            },
            {
              id: 'test_c2',
              mediaId: 'm2',
              trackId: 'v1',
              startTime: 0,
              duration: 5,
              trimStart: 0,
              trimEnd: 0,
              transform: { x: 0, y: 0, scale: 100, rotation: 0 },
              opacity: 1,
              speed: 1,
              effects: [],
            },
          ],
        },
      ],
    });

    formatClipsToPresentation(tmpl, 'test_c1', 'test_c2');

    const state = useEditorStore.getState();
    const c1 = state.tracks[0].clips.find((c) => c.id === 'test_c1');
    const c2 = state.tracks[0].clips.find((c) => c.id === 'test_c2');

    expect(c1?.transform.x).toBe(tmpl.aRoll.transform.x);
    expect(c1?.transform.scale).toBe(tmpl.aRoll.transform.scale);
    expect(c2?.transform.x).toBe(tmpl.bRoll.transform.x);
    expect(c2?.transform.scale).toBe(tmpl.bRoll.transform.scale);
  });
});
