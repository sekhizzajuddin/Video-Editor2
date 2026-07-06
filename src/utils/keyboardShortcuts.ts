import React from 'react';

export interface KeyboardShortcutDef {
  id: string;
  label: string;
  category: 'Playback & Navigation' | 'Timeline Editing' | 'Tools Selection' | 'System';
  defaultKey: string; // e.g. "Space", "Ctrl+z", "Shift+a", "Delete"
}

export const DEFAULT_SHORTCUTS: KeyboardShortcutDef[] = [
  // Playback & Navigation
  { id: 'play_pause', label: 'Play / Pause', category: 'Playback & Navigation', defaultKey: 'Space' },
  { id: 'shuttle_reverse', label: 'Shuttle Reverse (J)', category: 'Playback & Navigation', defaultKey: 'j' },
  { id: 'shuttle_pause', label: 'Shuttle Pause (K)', category: 'Playback & Navigation', defaultKey: 'k' },
  { id: 'shuttle_forward', label: 'Shuttle Forward (L)', category: 'Playback & Navigation', defaultKey: 'l' },
  { id: 'seek_frame_left', label: 'Step Back 1 Frame', category: 'Playback & Navigation', defaultKey: 'ArrowLeft' },
  { id: 'seek_frame_right', label: 'Step Forward 1 Frame', category: 'Playback & Navigation', defaultKey: 'ArrowRight' },
  { id: 'seek_second_left', label: 'Step Back 1 Second', category: 'Playback & Navigation', defaultKey: 'Shift+ArrowLeft' },
  { id: 'seek_second_right', label: 'Step Forward 1 Second', category: 'Playback & Navigation', defaultKey: 'Shift+ArrowRight' },
  { id: 'seek_start', label: 'Go to Start (Home)', category: 'Playback & Navigation', defaultKey: 'Home' },
  { id: 'seek_end', label: 'Go to End (End)', category: 'Playback & Navigation', defaultKey: 'End' },
  { id: 'set_in_point', label: 'Set In Point', category: 'Playback & Navigation', defaultKey: 'i' },
  { id: 'set_out_point', label: 'Set Out Point', category: 'Playback & Navigation', defaultKey: 'o' },
  { id: 'add_marker', label: 'Add Marker', category: 'Playback & Navigation', defaultKey: 'm' },

  // Tools Selection
  { id: 'tool_select', label: 'Selection Tool', category: 'Tools Selection', defaultKey: 'v' },
  { id: 'tool_split', label: 'Razor/Split Tool', category: 'Tools Selection', defaultKey: 's' },
  { id: 'tool_hand', label: 'Hand Tool', category: 'Tools Selection', defaultKey: 'h' },
  { id: 'tool_zoom', label: 'Zoom Tool', category: 'Tools Selection', defaultKey: 'z' },
  { id: 'tool_ripple', label: 'Ripple Edit Tool', category: 'Tools Selection', defaultKey: 'b' },
  { id: 'tool_track_select', label: 'Track Select Forward', category: 'Tools Selection', defaultKey: 'a' },
  { id: 'tool_track_select_backward', label: 'Track Select Backward', category: 'Tools Selection', defaultKey: 'Shift+a' },
  { id: 'tool_rate_stretch', label: 'Rate Stretch Tool', category: 'Tools Selection', defaultKey: 'r' },

  // Timeline Editing
  { id: 'split_clip', label: 'Split Clip at Playhead', category: 'Timeline Editing', defaultKey: 'Ctrl+k' },
  { id: 'delete_selected', label: 'Delete Selected Clip/Transition', category: 'Timeline Editing', defaultKey: 'Delete' },
  { id: 'cut_clip', label: 'Cut Clip', category: 'Timeline Editing', defaultKey: 'Ctrl+x' },
  { id: 'copy_clip_whole', label: 'Copy (Whole)', category: 'Timeline Editing', defaultKey: 'Ctrl+c' },
  { id: 'copy_clip_base', label: 'Copy Clip (Base)', category: 'Timeline Editing', defaultKey: 'Ctrl+Shift+C' },
  { id: 'copy_clip_style', label: 'Copy Style', category: 'Timeline Editing', defaultKey: 'Ctrl+Alt+C' },
  { id: 'paste_clip_whole', label: 'Paste (Whole)', category: 'Timeline Editing', defaultKey: 'Ctrl+v' },
  { id: 'paste_clip_base', label: 'Paste Clip (Base)', category: 'Timeline Editing', defaultKey: 'Ctrl+Shift+V' },
  { id: 'paste_clip_style', label: 'Paste Style', category: 'Timeline Editing', defaultKey: 'Ctrl+Alt+V' },
  { id: 'duplicate_clip', label: 'Duplicate Selected Clip', category: 'Timeline Editing', defaultKey: 'Ctrl+d' },
  { id: 'select_all_clips_forward', label: 'Select Clips Forward', category: 'Timeline Editing', defaultKey: 'Alt+ArrowRight' },
  { id: 'select_all_clips_backward', label: 'Select Clips Backward', category: 'Timeline Editing', defaultKey: 'Alt+ArrowLeft' },
  { id: 'zoom_timeline_in', label: 'Zoom Timeline In', category: 'Timeline Editing', defaultKey: 'Ctrl+=' },
  { id: 'zoom_timeline_out', label: 'Zoom Timeline Out', category: 'Timeline Editing', defaultKey: 'Ctrl+-' },
  { id: 'toggle_snap', label: 'Toggle Snapping', category: 'Timeline Editing', defaultKey: 'n' },

  // System
  { id: 'undo', label: 'Undo Action', category: 'System', defaultKey: 'Ctrl+z' },
  { id: 'redo', label: 'Redo Action', category: 'System', defaultKey: 'Ctrl+Shift+z' },
  { id: 'redo_alt', label: 'Redo Action (Alt)', category: 'System', defaultKey: 'Ctrl+y' },
];

export const SHORTCUT_PROFILES: Record<string, Record<string, string>> = {
  'Default': {},
  'Premiere Pro': {
    'tool_select': 'v',
    'tool_split': 'c',
    'tool_track_select': 'a',
    'split_clip': 'Ctrl+k',
    'undo': 'Ctrl+z',
  },
  'Final Cut Pro': {
    'tool_select': 'a',
    'tool_split': 'b',
    'split_clip': 'Ctrl+b',
    'zoom_timeline_in': 'Ctrl+=',
    'zoom_timeline_out': 'Ctrl+-',
  },
  'DaVinci Resolve': {
    'tool_select': 'a',
    'tool_split': 'b',
    'split_clip': 'Ctrl+\\',
  }
};

export function getShortcutString(e: KeyboardEvent | React.KeyboardEvent): string {
  const parts: string[] = [];
  
  // Use a standardized modifier detection that supports cross-platform cmd vs ctrl
  const isCtrl = e.ctrlKey || e.metaKey;
  if (isCtrl) parts.push('Ctrl');
  if (e.shiftKey) parts.push('Shift');
  if (e.altKey) parts.push('Alt');

  let key = e.key;
  if (key === ' ') {
    key = 'Space';
  } else if (key.length === 1) {
    key = key.toLowerCase();
  }
  
  // Filter out pure modifiers so they aren't bound alone by mistake
  if (['control', 'shift', 'alt', 'meta'].includes(key.toLowerCase())) {
    return '';
  }
  
  parts.push(key);
  return parts.join('+');
}
