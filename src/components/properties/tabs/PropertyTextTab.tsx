/**
 * PropertyTextTab.tsx
 * 
 * Text inspector tab for Properties Panel.
 * Manages Content, Font Family, Font Size, Colors, Stroke Width, Text Alignment,
 * Style Presets, and Text Animation IN/OUT Presets.
 */

import React from 'react';
import { TimelineClip } from '@/types';
import { TextBasicFeature } from '../features/TextBasicFeature';
import { TextAdvancedFeature } from '../features/TextAdvancedFeature';

interface PropertyTextTabProps {
  selectedClip: TimelineClip;
  updateClip: (id: string, updates: Partial<TimelineClip>) => void;
}

export function PropertyTextTab({ selectedClip, updateClip }: PropertyTextTabProps) {
  if (!selectedClip.textSettings) return null;

  const textSettings = selectedClip.textSettings;

  return (
    <div className="space-y-4 p-4 text-xs select-none">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-white uppercase tracking-wider">Text Properties</h3>
      </div>
      
      <TextBasicFeature clip={selectedClip} />
      <TextAdvancedFeature clip={selectedClip} />
    </div>
  );
}
