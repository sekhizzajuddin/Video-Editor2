import { DEFAULT_TRACK_HEIGHT, THIN_TRACK_HEIGHT, OVER_LAYER_ROW_HEIGHT } from './timelineConstants';
import type { TimelineTrack, EditorState } from '@/types';

export const getTrackHeight = (
  track: TimelineTrack,
  hoveredRegion: EditorState['hoveredOverLayerRegion'] | null,
  pinnedTrackId: string | null = null
) => {
  const base = track.type === 'text' || track.type === 'fx' ? THIN_TRACK_HEIGHT : DEFAULT_TRACK_HEIGHT;
  const isOpen = pinnedTrackId === track.id || (hoveredRegion && hoveredRegion.trackId === track.id);
  if (!isOpen) return base;

  // Find active over-layers overlapping the hovered region
  const region = hoveredRegion || { trackId: track.id, startTime: 0, endTime: Infinity };
  const activeCount = (track.overLayers || []).filter((ol) => {
    return ol.startTime < region.endTime && ol.startTime + ol.duration > region.startTime;
  }).length;

  return base + activeCount * OVER_LAYER_ROW_HEIGHT;
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
