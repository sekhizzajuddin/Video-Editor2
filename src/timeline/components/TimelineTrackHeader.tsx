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

const TRACK_TYPE_COLORS: Record<string, { dot: string; bg: string; text: string }> = {
  video: { dot: 'bg-blue-500', bg: 'bg-blue-50 dark:bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400' },
  audio: { dot: 'bg-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400' },
  text: { dot: 'bg-amber-500', bg: 'bg-amber-50 dark:bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400' },
  fx: { dot: 'bg-rose-500', bg: 'bg-rose-50 dark:bg-rose-500/10', text: 'text-rose-600 dark:text-rose-400' },
};

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

  const typeStyle = TRACK_TYPE_COLORS[track.type] || TRACK_TYPE_COLORS.video;

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onContextMenu={handleContextMenu}
      className={`group flex items-center px-2.5 border-b transition-all ${
        selectedTrackId === track.id
          ? 'bg-slate-100 dark:bg-[#1e242f] border-slate-200 dark:border-[#2a303c]'
          : 'bg-white dark:bg-[#0f1219] border-slate-200/70 dark:border-[#1e242f]/70 hover:bg-slate-50 dark:hover:bg-[#151a23]'
      }`}
      style={{ height: getTrackHeight(track) }}
      onClick={() => selectTrack(track.id)}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <GripVertical className="w-3 h-3 text-slate-400 dark:text-slate-500 shrink-0 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className={`w-2 h-2 rounded-full ${typeStyle.dot} shrink-0`} />
        <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 truncate tracking-wide">{track.name}</span>
        
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
            className="ml-2 bg-slate-100 dark:bg-[#1e242f] border border-slate-200 dark:border-[#2a303c] text-[10px] text-slate-700 dark:text-slate-300 rounded-full px-2 py-0.5 outline-none cursor-pointer"
          >
            {Object.keys(track.subtitleVariants).map(lang => (
              <option key={lang} value={lang}>{lang}</option>
            ))}
          </select>
        )}

        {linkedFxTrack && (
          <span className="ml-1.5 px-1.5 py-0.5 bg-rose-100 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20 rounded-full text-[8px] font-bold uppercase tracking-wider">
            FX
          </span>
        )}
        
        {track.type === 'fx' && track.linkedTrackId && (
          <div className="flex items-center gap-0.5 ml-1 text-amber-600 dark:text-amber-400">
            <Link className="w-3 h-3" />
            <span className="text-[9px] font-medium">{linkedTargetTrackName}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-0.5 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleTrackLock(track.id);
          }}
          title={track.locked ? 'Unlock' : 'Lock'}
          className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
            track.locked ? 'bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400' : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1e242f]'
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
            className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
              isRecordingVoiceover && recordingTrackId === track.id
                ? 'bg-red-600 text-white animate-pulse shadow-lg shadow-red-600/20'
                : 'text-slate-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10'
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
            className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
              track.hidden ? 'bg-red-100 dark:bg-red-500/10 text-red-500' : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1e242f]'
            }`}
          >
            {track.hidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
          </button>
        )}

        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleTrackMute(track.id);
          }}
          title={track.muted ? 'Unmute Track' : 'Mute Track'}
          className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
            track.muted ? 'bg-red-100 dark:bg-red-500/10 text-red-500' : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1e242f]'
          }`}
        >
          {track.muted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
        </button>

        {tracks.length > 1 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              removeTrack(track.id);
            }}
            title="Remove track"
            className="w-6 h-6 rounded-full flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
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
