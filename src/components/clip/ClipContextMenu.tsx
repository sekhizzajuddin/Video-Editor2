import React from 'react';
import {
  Scissors, Bookmark, Copy, Trash2, Trash, Volume2, VolumeX,
  Replace, ArrowRight,
  Repeat, ArrowLeftRight, Sparkles
} from 'lucide-react';
import { ContextMenu, type ContextMenuItem } from '../ui/ContextMenu';
import { useEditorStore, findClipInTracks } from '@/store/editorStore';

interface ClipContextMenuProps {
  x: number;
  y: number;
  clipId: string;
  onClose: () => void;
}

export function ClipContextMenu({ x, y, clipId, onClose }: ClipContextMenuProps) {
  const state = useEditorStore.getState();

  const clip = findClipInTracks(state.tracks, clipId, state.pipWindows);
  if (!clip) {
    return null;
  }

  const splitClip = state.splitClip;
  const removeClip = state.removeClip;
  const duplicateClip = state.duplicateClip;
  const rippleDeleteClip = state.rippleDeleteClip;
  const liftClip = state.liftClip;
  const extractClip = state.extractClip;
  const copyClip = state.copyClip;
  const updateClip = state.updateClip;
  const addMarker = state.addMarker;
  const replaceClipMedia = state.replaceClipMedia;

  const items: ContextMenuItem[] = [
    {
      id: 'split',
      label: 'Split at Playhead',
      shortcut: 'Ctrl+K',
      icon: <Scissors className="w-3.5 h-3.5" />,
      onClick: () => splitClip(clipId, state.currentTime),
    },
    {
      id: 'marker',
      label: 'Add Marker Here',
      shortcut: 'M',
      icon: <Bookmark className="w-3.5 h-3.5" />,
      onClick: () => addMarker(state.currentTime),
    },
    {
      id: 'ai-speed-sync',
      label: 'AI Speed Sync with TTS...',
      icon: <Sparkles className="w-3.5 h-3.5 text-cyan-400" />,
      onClick: () => {
        state.selectClip(clipId);
        state.setShowAiSpeedSyncModal(true);
      },
    },
    { id: 'sep1', label: '', separator: true },
    {
      id: 'copy',
      label: 'Copy',
      shortcut: 'Ctrl+C',
      icon: <Copy className="w-3.5 h-3.5" />,
      onClick: () => copyClip('whole'),
    },
    {
      id: 'duplicate',
      label: 'Duplicate',
      shortcut: 'Ctrl+D',
      icon: <Repeat className="w-3.5 h-3.5" />,
      onClick: () => duplicateClip(),
    },
    { id: 'sep2', label: '', separator: true },
    {
      id: 'lift',
      label: 'Lift (Close Gap on Track)',
      shortcut: 'Shift+;',
      icon: <ArrowRight className="w-3.5 h-3.5" />,
      onClick: () => liftClip(clipId),
    },
    {
      id: 'extract',
      label: 'Extract (Close Gap All Tracks)',
      shortcut: ',',
      icon: <ArrowLeftRight className="w-3.5 h-3.5" />,
      onClick: () => extractClip(clipId),
    },
    { id: 'sep3', label: '', separator: true },
    {
      id: 'replace',
      label: 'Replace with Media...',
      icon: <Replace className="w-3.5 h-3.5" />,
      onClick: () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'video/*,audio/*,image/*';
          input.onchange = async (e: Event) => {
            const target = e.target as HTMLInputElement;
            const file = target.files?.[0];
            if (!file) return;
            try {
              const { probeFile } = await import('@/utils/mediaProbe');
              const mediaItem = await probeFile(file);
              state.addMedia(mediaItem, file);
              setTimeout(() => replaceClipMedia(clipId, mediaItem.id), 100);
            } catch {
              window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Failed to replace.', type: 'error' }}));
            }
          };
        input.click();
      },
    },
    {
      id: 'mute',
      label: clip.disabled ? 'Unmute Clip' : 'Mute Clip',
      icon: clip.disabled ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />,
      onClick: () => updateClip(clipId, { disabled: !clip.disabled }),
    },
    { id: 'sep4', label: '', separator: true },
    {
      id: 'delete',
      label: 'Delete',
      icon: <Trash className="w-3.5 h-3.5" />,
      onClick: () => removeClip(clipId),
    },
    {
      id: 'ripple-delete',
      label: 'Ripple Delete',
      variant: 'danger',
      icon: <Trash2 className="w-3.5 h-3.5" />,
      onClick: () => rippleDeleteClip(clipId),
    },
  ];

  return <ContextMenu x={x} y={y} items={items} onClose={onClose} />;
}
