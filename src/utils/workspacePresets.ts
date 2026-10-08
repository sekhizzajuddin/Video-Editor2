// ─────────────────────────────────────────────────────────────────────────────
// Workspace Layout Presets
// Shared between SettingsModal and TopToolbar for consistent layout switching.
// ─────────────────────────────────────────────────────────────────────────────

export interface WorkspacePreset {
  id: string;
  label: string;
  description: string;
  icon: string;          // emoji for quick visual identification
  category: 'production' | 'creative' | 'review';
  leftWidth: number;
  rightWidth: number;
  timelineHeight: number;
  /** Schematic proportions for the mini-preview (0–1 range) */
  preview: {
    left: number;    // fraction of total width
    right: number;   // fraction of total width
    timeline: number; // fraction of total height
  };
}

export const WORKSPACE_PRESETS: WorkspacePreset[] = [
  // ── Production ──────────────────────────────────────────────────────────
  {
    id: 'Editing',
    label: 'Classic Editing',
    description: 'Balanced workspace for general video editing with all panels visible.',
    icon: '🎬',
    category: 'production',
    leftWidth: 350,
    rightWidth: 380,
    timelineHeight: 300,
    preview: { left: 0.25, right: 0.28, timeline: 0.38 },
  },
  {
    id: 'Color',
    label: 'Color Grading',
    description: 'Expanded properties panel for color wheels, curves, and LUT preview.',
    icon: '🎨',
    category: 'production',
    leftWidth: 200,
    rightWidth: 400,
    timelineHeight: 320,
    preview: { left: 0.15, right: 0.35, timeline: 0.42 },
  },
  {
    id: 'Audio',
    label: 'Audio Suite',
    description: 'Tall timeline for waveform editing, mixing, and audio ducking.',
    icon: '🎧',
    category: 'production',
    leftWidth: 200,
    rightWidth: 280,
    timelineHeight: 420,
    preview: { left: 0.16, right: 0.22, timeline: 0.55 },
  },
  {
    id: 'Compact',
    label: 'Compact',
    description: 'Narrow side panels maximize the preview canvas for detail work.',
    icon: '📐',
    category: 'production',
    leftWidth: 190,
    rightWidth: 210,
    timelineHeight: 280,
    preview: { left: 0.14, right: 0.16, timeline: 0.36 },
  },
  // ── Creative ────────────────────────────────────────────────────────────
  {
    id: 'Generative',
    label: 'AI Studio',
    description: 'Full-screen AI generative workspace without properties panel.',
    icon: '✨',
    category: 'creative',
    leftWidth: 200,
    rightWidth: 0,
    timelineHeight: 250,
    preview: { left: 0.16, right: 0, timeline: 0.35 },
  },
  {
    id: 'Storyboard',
    label: 'Storyboard',
    description: 'Wide media browser for asset-heavy planning and storyboarding.',
    icon: '📋',
    category: 'creative',
    leftWidth: 360,
    rightWidth: 240,
    timelineHeight: 280,
    preview: { left: 0.3, right: 0.18, timeline: 0.36 },
  },
  {
    id: 'Writer',
    label: 'Writer\'s Room',
    description: 'Focused editing with text & effects panel and minimal distractions.',
    icon: '✍️',
    category: 'creative',
    leftWidth: 220,
    rightWidth: 320,
    timelineHeight: 260,
    preview: { left: 0.17, right: 0.28, timeline: 0.34 },
  },
  // ── Review ──────────────────────────────────────────────────────────────
  {
    id: 'Cinema',
    label: 'Cinema Preview',
    description: 'Maximum preview area for client review and final quality checks.',
    icon: '🎥',
    category: 'review',
    leftWidth: 180,
    rightWidth: 180,
    timelineHeight: 200,
    preview: { left: 0.12, right: 0.12, timeline: 0.26 },
  },
  {
    id: 'Vertical',
    label: 'Vertical Edit',
    description: 'Optimized for 9:16 Shorts, Reels, and TikTok content creation.',
    icon: '📱',
    category: 'review',
    leftWidth: 230,
    rightWidth: 300,
    timelineHeight: 260,
    preview: { left: 0.18, right: 0.25, timeline: 0.34 },
  },
];

export function getPresetById(id: string): WorkspacePreset | undefined {
  return WORKSPACE_PRESETS.find(p => p.id === id);
}

export function getPresetLayout(id: string): { preset: string; leftWidth: number; rightWidth: number; timelineHeight: number } {
  const preset = getPresetById(id);
  if (!preset) return { preset: 'Editing', leftWidth: 350, rightWidth: 380, timelineHeight: 300 };
  return {
    preset: preset.id,
    leftWidth: preset.leftWidth,
    rightWidth: preset.rightWidth,
    timelineHeight: preset.timelineHeight,
  };
}

export const PRESET_CATEGORIES = [
  { id: 'production' as const, label: 'Production', description: 'Standard editing workflows' },
  { id: 'creative' as const, label: 'Creative', description: 'AI, text & storyboard focused' },
  { id: 'review' as const, label: 'Review', description: 'Preview & delivery focused' },
];
