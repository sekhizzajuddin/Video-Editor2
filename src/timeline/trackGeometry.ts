import { DEFAULT_TRACK_HEIGHT, THIN_TRACK_HEIGHT } from './timelineConstants';
import type { TimelineTrack } from '@/types';

export const getTrackHeight = (track: TimelineTrack) => {
  return track.type === 'text' || track.type === 'fx' ? THIN_TRACK_HEIGHT : DEFAULT_TRACK_HEIGHT;
};

export const getTrackTop = (tracks: TimelineTrack[], index: number) => {
  let top = 0;
  for (let i = 0; i < index; i++) top += getTrackHeight(tracks[i]);
  return top;
};

export const getTrackAtY = (tracks: TimelineTrack[], y: number) => {
  let currentY = 0;
  for (let i = 0; i < tracks.length; i++) {
    const h = getTrackHeight(tracks[i]);
    if (y >= currentY && y < currentY + h) return i;
    currentY += h;
  }
  return tracks.length - 1;
};
