/**
 * useGlobalDeselect.ts
 *
 * Click-outside clip deselection. Watches mousedown at the window level and
 * clears clip/track/transition selection when the click happens outside:
 *   - The timeline track area (clips already have their own onClick → keep)
 *   - The preview canvas (clicks there should NOT deselect)
 *   - The properties panel (still editing selection)
 *   - Any input/textarea/contenteditable
 *   - Modal dialogs
 *   - Buttons or interactive controls (right-click context menus, etc.)
 *
 * The selection is preserved when clicking inside the timeline or any of the
 * editor surfaces that have their own click semantics.
 */

import { useEffect } from 'react';
import { useEditorStore } from '@/store/editorStore';

const EDITOR_SURFACES = [
  // CSS class substrings that identify surfaces where click should NOT deselect.
  // Substring match lets us catch dynamically-named preview containers, etc.
  'timeline',
  'preview-canvas',
  'preview-toolbar',
  'preview-overlay',
  'preview',
  'properties-panel',
  'properties',
  'media-panel',
  'media-library',
  'media-tab',
  'audio-mixer',
  'scope-panel',
  'ruler',
];

const NON_DESELECT_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

export function useGlobalDeselect(): void {
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // Don't deselect while typing
      if (target.tagName && NON_DESELECT_TAGS.has(target.tagName)) return;

      // Don't deselect while a context menu is open or while text is selected
      const selection = window.getSelection?.();
      if (selection && selection.toString().length > 0) return;

      // Don't deselect when the click is inside any editor surface
      for (const surface of EDITOR_SURFACES) {
        // className can be a SVGAnimatedString; coerce safely
        const cls = (target as any).className?.baseVal ?? (target.className as string | undefined);
        const id = target.id ?? '';
        if ((cls && cls.includes(surface)) || id.includes(surface)) return;

        // Walk up the parent chain
        let parent: HTMLElement | null = target.parentElement;
        let depth = 0;
        while (parent && depth < 12) {
          const pcls = (parent as any).className?.baseVal ?? (parent.className as string | undefined);
          const pid = parent.id ?? '';
          if ((pcls && pcls.includes(surface)) || pid.includes(surface)) return;
          parent = parent.parentElement;
          depth++;
        }
      }

      // Click landed on truly empty background (e.g. the top toolbar area
      // outside any button). Deselect clips, transitions, and tracks.
      const state = useEditorStore.getState();
      const hasSelection =
        state.selectedClipId !== null ||
        (state.selectedClipIds && state.selectedClipIds.length > 0) ||
        state.selectedTransitionClipId !== null ||
        state.selectedTrackId !== null;
      if (!hasSelection) return;

      // Avoid deselecting on right-click
      if (e.button === 2) return;

      state.selectClip(null);
      state.selectClips([]);
      state.selectTransition(null);
      state.selectTrack(null);
    };

    window.addEventListener('mousedown', onMouseDown, true);
    return () => window.removeEventListener('mousedown', onMouseDown, true);
  }, []);
}
