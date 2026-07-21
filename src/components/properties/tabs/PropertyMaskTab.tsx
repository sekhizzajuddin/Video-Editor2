/**
 * PropertyMaskTab.tsx
 * 
 * Mask inspector tab for Properties Panel.
 * Handles Rectangle, Circle, Split, Filmstrip, Heart, Star, and Matte masking.
 * Includes Position, Dimensions, Rotation, Roundness, Feather, and Invert controls.
 */

import React from 'react';
import { TimelineClip, TimelineTrack, MediaItem } from '@/types';
import { MaskFeature } from '../features/MaskFeature';
import { AiBackgroundRemovalFeature } from '../features/AiBackgroundRemovalFeature';

interface PropertyMaskTabProps {
  selectedClip: TimelineClip;
  tracks: TimelineTrack[];
  mediaLibrary: MediaItem[];
  updateClip: (id: string, updates: Partial<TimelineClip>) => void;
}

export function PropertyMaskTab({
  selectedClip,
  tracks,
  mediaLibrary,
  updateClip,
}: PropertyMaskTabProps) {
  return (
    <div className="space-y-4 p-4 text-xs select-none">
      <MaskFeature clip={selectedClip} tracks={tracks} mediaLibrary={mediaLibrary} />
      <AiBackgroundRemovalFeature clip={selectedClip} />
    </div>
  );
}
