import React from 'react';
import {
  Plus, Trash2, Lock, Unlock, Volume2, VolumeX, Eye, EyeOff,
  ArrowUp, ArrowDown, Type
} from 'lucide-react';
import { ContextMenu, type ContextMenuItem } from '../ui/ContextMenu';
import { useEditorStore } from '@/store/editorStore';

interface TrackContextMenuProps {
  x: number;
  y: number;
  trackId: string;
  onClose: () => void;
}

export function TrackContextMenu({ x, y, trackId, onClose }: TrackContextMenuProps) {
  const state = useEditorStore.getState();
  const track = state.tracks.find(t => t.id === trackId);
  if (!track) return null;

  const addTrack = state.addTrack;
  const removeTrack = state.removeTrack;
  const toggleTrackLock = state.toggleTrackLock;
  const toggleTrackMute = state.toggleTrackMute;
  const toggleTrackHidden = state.toggleTrackHidden;
  const reorderTrack = state.reorderTrack;
  const insertTextClip = state.insertTextClip;

  const trackIdx = state.tracks.findIndex(t => t.id === trackId);

  const items: ContextMenuItem[] = [
    {
      id: 'add-above',
      label: `Add ${track.type === 'audio' ? 'Audio' : 'Video'} Track Above`,
      icon: <Plus className="w-3.5 h-3.5" />,
      onClick: () => addTrack(track.type),
    },
    {
      id: 'add-below',
      label: `Add ${track.type === 'audio' ? 'Audio' : 'Video'} Track Below`,
      icon: <Plus className="w-3.5 h-3.5" />,
      onClick: () => {
        addTrack(track.type);
      },
    },
    { id: 'sep1', label: '', separator: true },
    {
      id: 'move-up',
      label: 'Move Track Up',
      icon: <ArrowUp className="w-3.5 h-3.5" />,
      disabled: trackIdx <= 0,
      onClick: () => reorderTrack(trackId, Math.max(0, trackIdx - 1)),
    },
    {
      id: 'move-down',
      label: 'Move Track Down',
      icon: <ArrowDown className="w-3.5 h-3.5" />,
      disabled: trackIdx >= state.tracks.length - 1,
      onClick: () => reorderTrack(trackId, Math.min(state.tracks.length - 1, trackIdx + 1)),
    },
    { id: 'sep2', label: '', separator: true },
    {
      id: 'lock',
      label: track.locked ? 'Unlock Track' : 'Lock Track',
      icon: track.locked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />,
      onClick: () => toggleTrackLock(trackId),
    },
    {
      id: 'mute',
      label: track.muted ? 'Unmute Track' : 'Mute Track',
      icon: track.muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />,
      onClick: () => toggleTrackMute(trackId),
    },
    {
      id: 'hide',
      label: track.hidden ? 'Show Track' : 'Hide Track',
      icon: track.hidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />,
      onClick: () => toggleTrackHidden(trackId),
    },
    { id: 'sep3', label: '', separator: true },
    {
      id: 'add-text',
      label: 'Insert Text Clip',
      icon: <Type className="w-3.5 h-3.5" />,
      onClick: () => insertTextClip({ text: 'New Text' }),
    },
    { id: 'sep4', label: '', separator: true },
    {
      id: 'delete',
      label: 'Delete Track',
      variant: 'danger',
      icon: <Trash2 className="w-3.5 h-3.5" />,
      onClick: () => {
        if (window.confirm(`Delete track "${track.name}"? Clips on this track will be removed.`)) {
          removeTrack(trackId);
        }
      },
    },
  ];

  return <ContextMenu x={x} y={y} items={items} onClose={onClose} />;
}
