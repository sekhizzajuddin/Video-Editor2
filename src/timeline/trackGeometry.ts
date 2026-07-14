import { DEFAULT_TRACK_HEIGHT, THIN_TRACK_HEIGHT, OVER_LAYER_ROW_HEIGHT } from './timelineConstants';
import type { TimelineTrack, EditorState } from '@/types';

export const getTrackHeight = (
  track: TimelineTrack,
  hoveredRegion: any | null = null,
  pinnedTrackId: string | null = null
) => {
  if (!track) return DEFAULT_TRACK_HEIGHT;
  const base = track.type === 'text' || track.type === 'fx' ? THIN_TRACK_HEIGHT : DEFAULT_TRACK_HEIGHT;
  
  // Always show over layers if track has any
  const hasOverLayers = (track.overLayers || []).length > 0;
  const isOpen = pinnedTrackId === track.id || 
                 (hoveredRegion && hoveredRegion.trackId === track.id) ||
                 hasOverLayers;
  
  if (!isOpen) return base;

  // Find active over-layers overlapping the hovered region
  const region = hoveredRegion || { trackId: track.id, startTime: 0, endTime: Infinity };
  const activeOverLayers = (track.overLayers || []).filter((ol) => {
    return ol.startTime < region.endTime && ol.startTime + ol.duration > region.startTime;
  });

  // Use actual over layer count
  const totalRows = Math.max(activeOverLayers.length, hasOverLayers ? 1 : 0);
  
  return base + totalRows * OVER_LAYER_ROW_HEIGHT;
};

export const getTrackTop = (
  tracks: TimelineTrack[],
  index: number,
  hoveredRegion: any | null = null,
  pinnedTrackId: string | null = null
) => {
  let top = 0;
  // Ensure we don't go out of bounds if index is greater than tracks.length
  const limit = Math.min(index, tracks.length);
  for (let i = 0; i < limit; i++) {
    top += getTrackHeight(tracks[i], hoveredRegion, pinnedTrackId);
  }
  return top;
};

export const getTrackAtY = (
  tracks: TimelineTrack[],
  y: number,
  hoveredRegion: any | null = null,
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
