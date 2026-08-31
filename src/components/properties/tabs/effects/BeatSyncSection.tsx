import React, { useState } from 'react';
import { Music2, Loader2, Sparkles, CheckCircle2 } from 'lucide-react';
import type { TimelineClip } from '@/types';
import { useEditorStore } from '@/store/editorStore';
import { detectBeats } from '@/utils/beatDetection';
import { toast } from 'sonner';

interface BeatSyncSectionProps {
  selectedClip: TimelineClip;
}

export function BeatSyncSection({ selectedClip }: BeatSyncSectionProps) {
  const mediaLibrary = useEditorStore((s) => s.mediaLibrary);
  const addBeatMarkers = useEditorStore((s) => s.addBeatMarkers);

  const [isDetecting, setIsDetecting] = useState(false);
  const [bpm, setBpm] = useState<number | null>(null);
  const [beatCount, setBeatCount] = useState<number | null>(null);

  const mediaItem = mediaLibrary.find((m) => m.id === selectedClip.mediaId);
  const audioUrl = mediaItem?.url || '';

  const handleDetectBeats = async () => {
    if (!audioUrl) {
      toast.warning('No audio source found for this clip.');
      return;
    }

    setIsDetecting(true);
    try {
      const result = await detectBeats(audioUrl);
      const detectedBpm = Math.round(result.bpm);
      setBpm(detectedBpm);
      setBeatCount(result.beats.length);
      addBeatMarkers(selectedClip.mediaId, result.beats);
      toast.success(`Found ${result.beats.length} beats (~${detectedBpm} BPM). Added to timeline ruler!`);
    } catch (err: any) {
      console.error('Beat detection failed:', err);
      toast.error('Beat detection failed. Please ensure the clip has valid audio.');
    } finally {
      setIsDetecting(false);
    }
  };

  return (
    <div className="bg-[var(--theme-bg-card)] border border-cyan-500/30 rounded-xl p-3.5 space-y-3 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-500">
            <Music2 className="w-3.5 h-3.5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-[var(--theme-text-primary)]">Auto Beat Sync & Detection</h4>
            <p className="text-[9px] text-[var(--theme-text-muted)]">Detects music tempo & marks snap points on timeline</p>
          </div>
        </div>
        {bpm !== null && (
          <span className="text-[10px] font-mono font-bold text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-md border border-cyan-500/30">
            {bpm} BPM
          </span>
        )}
      </div>

      <p className="text-[10px] text-[var(--theme-text-muted)] leading-relaxed">
        Analyze the audio rhythms of this clip to generate magnetic snap markers on the timeline for perfectly timed cuts and transitions.
      </p>

      {beatCount !== null && (
        <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-2.5 py-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span className="font-medium">{beatCount} beat markers active on ruler for audio alignment</span>
        </div>
      )}

      <button
        type="button"
        onClick={handleDetectBeats}
        disabled={isDetecting || !audioUrl}
        className="w-full py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md shadow-blue-500/20"
      >
        {isDetecting ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Analyzing Audio Beats...
          </>
        ) : (
          <>
            <Sparkles className="w-3.5 h-3.5 text-white/90" />
            {beatCount !== null ? 'Re-detect & Sync Beats' : 'Detect Beats & Add Markers'}
          </>
        )}
      </button>
    </div>
  );
}
