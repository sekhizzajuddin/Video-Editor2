import { DEFAULT_TRACK_HEIGHT, THIN_TRACK_HEIGHT, OVER_LAYER_ROW_HEIGHT } from './timelineConstants';
import type { TimelineTrack, EditorState } from '@/types';

export const getTrackHeight = (
  track: TimelineTrack,
  hoveredRegion: EditorState['hoveredOverLayerRegion'] | null,
  pinnedTrackId: string | null = null
) => {
  const base = track.type === 'text' || track.type === 'fx' ? THIN_TRACK_HEIGHT : DEFAULT_TRACK_HEIGHT;
  
  const hasOverLayers = (track.overLayers || []).length > 0;
  const isOpen = pinnedTrackId === track.id || 
                 (hoveredRegion && hoveredRegion.trackId === track.id) ||
                 hasOverLayers;
  
  if (!isOpen) return base;

  // Simple lane calculation to find max rows needed
  const sorted = [...(track.overLayers || [])].sort((a, b) => a.startTime - b.startTime);
  const lanes: number[] = [];
  for (const ol of sorted) {
    let placed = false;
    for (let i = 0; i < lanes.length; i++) {
      if (lanes[i] <= ol.startTime) {
        lanes[i] = ol.startTime + ol.duration;
        placed = true;
        break;
      }
    }
    if (!placed) lanes.push(ol.startTime + ol.duration);
  }

  const totalRows = Math.max(lanes.length, 1);
  return base + totalRows * OVER_LAYER_ROW_HEIGHT;
};

export const getTrackTop = (
  tracks: TimelineTrack[],
  index: number,
  hoveredRegion: EditorState['hoveredOverLayerRegion'] | null,
  pinnedTrackId: string | null = null
) => {
  let top = 0;
  for (let i = 0; i < index; i++) top += getTrackHeight(tracks[i], hoveredRegion, pinnedTrackId);
  return top;
};

export const getTrackAtY = (
  tracks: TimelineTrack[],
  y: number,
  hoveredRegion: EditorState['hoveredOverLayerRegion'] | null,
  pinnedTrackId: string | null = null
) => {
  let currentY = 0;
  for (let i = 0; i < tracks.length; i++) {
    const h = getTrackHeight(tracks[i], hoveredRegion, pinnedTrackId);
    if (y >= currentY && y < currentY + h) return i;
    currentY += h;
  }
  return tracks.length - 1;
};
