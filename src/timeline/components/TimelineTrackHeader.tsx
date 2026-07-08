import React from 'react';
import {
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Trash2,
  GripVertical,
  Link,
  Pin,
  Mic,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import type { TimelineTrack, EditorState } from '@/types';
import { getTrackHeight } from '../trackGeometry';

interface TimelineTrackHeaderProps {
  track: TimelineTrack;
  tracks: TimelineTrack[];
  selectedTrackId: string | null;
  hoveredOverLayerRegion: EditorState['hoveredOverLayerRegion'] | null;
  pinnedOverLayerTrackId: string | null;
  isRecordingVoiceover: boolean;
  recordingTrackId: string | null;
  recordingSeconds?: number;
  selectTrack: (id: string) => void;
  reorderTrack: (sourceId: string, newIndex: number) => void;
  removeTrack: (id: string) => void;
  toggleTrackLock: (id: string) => void;
  toggleTrackMute: (id: string) => void;
  setPinnedOverLayerTrackId: (id: string | null) => void;
  handleVoiceoverRecordingToggle: (id: string) => void;
}

export function TimelineTrackHeader({
  track,
  tracks,
  selectedTrackId,
  hoveredOverLayerRegion,
  pinnedOverLayerTrackId,
  isRecordingVoiceover,
  recordingTrackId,
  recordingSeconds,
  selectTrack,
  reorderTrack,
  removeTrack,
  toggleTrackLock,
  toggleTrackMute,
  setPinnedOverLayerTrackId,
  handleVoiceoverRecordingToggle,
}: TimelineTrackHeaderProps) {
  const linkedFxTrack = tracks.find(t => t.type === 'fx' && t.linkedTrackId === track.id);
  const isLinkedToTrack = track.type === 'fx' && track.linkedTrackId;
  const linkedTargetTrackName = isLinkedToTrack ? tracks.find(t => t.id === track.linkedTrackId)?.name : '';

  const isMutedOrHidden = track.type === 'audio' ? track.muted : track.hidden;

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/x-track-reorder', track.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/x-track-reorder')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    const sourceId = e.dataTransfer.getData('application/x-track-reorder');
    if (sourceId && sourceId !== track.id) {
      const newIndex = tracks.findIndex(t => t.id === track.id);
      reorderTrack(sourceId, newIndex);
    }
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={`flex items-center px-2 border-b border-[#3e3e3e] ${
        selectedTrackId === track.id ? 'bg-[#3e3e3e]' : ''
      }`}
      style={{ height: getTrackHeight(track, hoveredOverLayerRegion, pinnedOverLayerTrackId) }}
      onClick={() => selectTrack(track.id)}
    >
      <div className="flex items-center gap-1 flex-1 min-w-0">
        <GripVertical className="w-3 h-3 text-[#a0a0a0] shrink-0 cursor-grab" />
        <span className="text-[11px] text-white font-medium truncate">{track.name}</span>
        
        {linkedFxTrack && (
          <span
            className="ml-1.5 px-1 py-0.5 bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-[3px] text-[8px] font-semibold uppercase tracking-wider scale-90"
            title={`Affected by FX track ${linkedFxTrack.name}`}
          >
            FX Active
          </span>
        )}
        
        {track.type === 'fx' && track.linkedTrackId && (
          <div
            className="flex items-center gap-0.5 ml-1 text-amber-400 opacity-80"
            title={`Linked to ${linkedTargetTrackName}`}
          >
            <Link className="w-3 h-3" />
            <span className="text-[9px]">{linkedTargetTrackName}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-0.5 shrink-0">
        {(track.overLayers || []).length > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setPinnedOverLayerTrackId(pinnedOverLayerTrackId === track.id ? null : track.id);
            }}
            title={pinnedOverLayerTrackId === track.id ? 'Unpin Over Layers' : 'Pin Over Layers Open'}
            className={`p-0.5 rounded transition-colors ${
              pinnedOverLayerTrackId === track.id ? 'text-cyan-400' : 'text-[#a0a0a0] hover:text-white'
            }`}
          >
            <Pin
              className="w-3 h-3"
              style={{ transform: pinnedOverLayerTrackId === track.id ? 'none' : 'rotate(45deg)' }}
            />
          </button>
        )}

        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleTrackLock(track.id);
          }}
          title={track.locked ? 'Unlock' : 'Lock'}
          className={`p-0.5 rounded transition-colors ${
            track.locked ? 'text-amber-400' : 'text-[#a0a0a0] hover:text-white'
          }`}
        >
          {track.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
        </button>

        {track.type === 'audio' && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleVoiceoverRecordingToggle(track.id);
            }}
            title={isRecordingVoiceover && recordingTrackId === track.id ? 'Stop Voiceover Recording' : 'Record Voiceover'}
            className={`p-0.5 rounded transition-all ${
              isRecordingVoiceover && recordingTrackId === track.id
                ? 'bg-red-600 text-white animate-pulse shadow-lg shadow-red-600/35 scale-110'
                : 'text-[#a0a0a0] hover:text-red-400'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
          </button>
        )}

        <button
          onClick={(e) => {
            e.stopPropagation();
            if (track.type === 'audio') {
              toggleTrackMute(track.id);
            } else {
              useEditorStore.getState().toggleTrackHidden(track.id);
            }
          }}
          title={track.type === 'audio' ? (track.muted ? 'Unmute Track' : 'Mute Track') : (track.hidden ? 'Show Track' : 'Hide Track')}
          className={`p-0.5 rounded transition-colors ${
            isMutedOrHidden ? 'text-red-400' : 'text-[#a0a0a0] hover:text-white'
          }`}
        >
          {track.type === 'audio' ? (
            track.muted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />
          ) : (
            track.hidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />
          )}
        </button>

        {tracks.length > 1 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              removeTrack(track.id);
            }}
            title="Remove track"
            className="p-0.5 text-[#a0a0a0] hover:text-red-400 rounded transition-colors"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}
