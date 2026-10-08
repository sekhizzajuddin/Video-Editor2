/**
 * propertiesTypes.ts
 * 
 * Shared interfaces and type definitions for Properties Panel tabs.
 */

import React from 'react';
import { TimelineClip, TimelineTrack, MediaItem } from '@/types';

export type PropertiesTab =
  | 'transform'
  | 'mask'
  | 'color'
  | 'speed'
  | 'audio'
  | 'text'
  | 'effects'
  | 'ai'
  | 'thumbnail'
  | 'pip'
  | 'history';

export interface BasePropertyTabProps {
  selectedClip: TimelineClip;
  selectedTrack?: TimelineTrack;
  currentTime: number;
  mediaLibrary: MediaItem[];
  updateClip: (id: string, updates: Partial<TimelineClip>) => void;
}
