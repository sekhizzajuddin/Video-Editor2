import React, { useState } from 'react';
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
import { TrackContextMenu } from '@/components/track/TrackContextMenu';

interface TimelineTrackHeaderProps {
  track: TimelineTrack;
  tracks: TimelineTrack[];
  selectedTrackId: string | null;

  isRecordingVoiceover: boolean;
  recordingTrackId: string | null;
  recordingSeconds?: number;
  selectTrack: (id: string) => void;
  reorderTrack: (sourceId: string, newIndex: number) => void;
  removeTrack: (id: string) => void;
  toggleTrackLock: (id: string) => void;
  toggleTrackMute: (id: string) => void;

  handleVoiceoverRecordingToggle: (id: string) => void;
}

export function TimelineTrackHeader({
  track,
  tracks,
  selectedTrackId,

  isRecordingVoiceover,
  recordingTrackId,
  recordingSeconds,
  selectTrack,
  reorderTrack,
  removeTrack,
  toggleTrackLock,
  toggleTrackMute,

  handleVoiceoverRecordingToggle,
}: TimelineTrackHeaderProps) {
  const [trackContextMenu, setTrackContextMenu] = useState<{ x: number; y: number; trackId: string } | null>(null);
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

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setTrackContextMenu({ x: e.clientX, y: e.clientY, trackId: track.id });
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onContextMenu={handleContextMenu}
      className={`flex items-center justify-between px-2 border-b border-[var(--theme-border)] transition-colors select-none ${
        selectedTrackId === track.id
          ? 'bg-[var(--theme-bg-subpanel)] border-l-2 border-l-blue-600'
          : 'bg-[var(--theme-bg-panel)] hover:bg-black/5 dark:hover:bg-white/5 border-l-2 border-l-transparent'
      }`}
      style={{ height: getTrackHeight(track) }}
      onClick={() => selectTrack(track.id)}
    >
      <div className="flex items-center gap-1.5 shrink-0">
        <GripVertical className="w-3.5 h-3.5 text-[var(--theme-text-muted)] shrink-0 cursor-grab hover:text-[var(--theme-text-primary)]" />
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-600 dark:bg-red-600 text-white truncate tracking-tight shrink-0 min-w-[20px] text-center shadow-sm leading-none">
          {track.name}
        </span>
        
        {track.subtitleVariants && Object.keys(track.subtitleVariants).length > 0 && (
          <select
            value={track.selectedSubtitleLanguage || ''}
            onChange={(e) => {
              e.stopPropagation();
              const lang = e.target.value;
              const store = useEditorStore.getState();
              const newTracks = store.tracks.map(t => {
                if (t.id === track.id) {
                  return {
                    ...t,
                    selectedSubtitleLanguage: lang,
                    clips: t.subtitleVariants![lang] || []
                  };
                }
                return t;
              });
              useEditorStore.setState({ tracks: newTracks });
            }}
            onClick={e => e.stopPropagation()}
            className="ml-1 bg-[var(--theme-bg-card)] border border-[var(--theme-border)] text-[10px] text-[var(--theme-text-primary)] rounded px-1 py-0.5 outline-none cursor-pointer font-mono font-medium shadow-sm max-w-[45px]"
          >
            {Object.keys(track.subtitleVariants).map(lang => (
              <option key={lang} value={lang}>{lang}</option>
            ))}
          </select>
        )}

        {linkedFxTrack && (
          <span
            className="ml-1 px-1 py-0.5 bg-rose-500/15 text-rose-500 border border-rose-500/25 rounded text-[7px] font-bold uppercase tracking-wider scale-90"
            title={`Affected by FX track ${linkedFxTrack.name}`}
          >
            FX
          </span>
        )}
      </div>

      <div className="flex items-center gap-0.5 shrink-0 ml-auto pl-1">
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleTrackLock(track.id);
          }}
          title={track.locked ? 'Unlock' : 'Lock'}
          className={`p-1 rounded-md transition-colors ${
            track.locked ? 'text-amber-500 bg-amber-500/10' : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)] hover:bg-black/5 dark:hover:bg-white/5'
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
            className={`p-1 rounded-md transition-all ${
              isRecordingVoiceover && recordingTrackId === track.id
                ? 'bg-red-600 text-white animate-pulse shadow-lg shadow-red-600/35 scale-110'
                : 'text-[var(--theme-text-muted)] hover:text-red-500 hover:bg-red-500/10'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
          </button>
        )}

        {track.type !== 'audio' && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              useEditorStore.getState().toggleTrackHidden(track.id);
            }}
            title={track.hidden ? 'Show Track' : 'Hide Track'}
            className={`p-1 rounded-md transition-colors ${
              track.hidden ? 'text-red-500 bg-red-500/10' : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)] hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            {track.hidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        )}

        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleTrackMute(track.id);
          }}
          title={track.muted ? 'Unmute Track' : 'Mute Track'}
          className={`p-1 rounded-md transition-colors ${
            track.muted ? 'text-red-500 bg-red-500/10' : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)] hover:bg-black/5 dark:hover:bg-white/5'
          }`}
        >
          {track.muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
        </button>

        {tracks.length > 1 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              removeTrack(track.id);
            }}
            title="Remove track"
            className="p-1 text-[var(--theme-text-muted)] hover:text-red-500 hover:bg-red-500/10 rounded-md transition-colors"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>

      {trackContextMenu && (
        <TrackContextMenu
          x={trackContextMenu.x}
          y={trackContextMenu.y}
          trackId={trackContextMenu.trackId}
          onClose={() => setTrackContextMenu(null)}
        />
      )}
    </div>
  );
}
