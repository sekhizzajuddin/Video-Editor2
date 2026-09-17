import React, { useState, useEffect, useMemo } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { X, Zap, Loader2, Sparkles, VolumeX, CheckCircle2, Film, Mic, ChevronRight, Layers } from 'lucide-react';
import { syncVideoClipWithTts, GEMINI_SPEED_SYNC_MODELS, GeminiSpeedSyncModel, AiSpeedSyncResult } from '@/utils/aiSpeedSync';
import { toast } from 'sonner';

interface ClipOption {
  id: string;
  name: string;
  trackName: string;
  duration: number;
  startTime: number;
  type: 'video' | 'audio';
}

export const AiSpeedSyncModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const tracks = useEditorStore(state => state.tracks);
  const selectedClipId = useEditorStore(state => state.selectedClipId);
  const selectedClipIds = useEditorStore(state => state.selectedClipIds);
  const mediaLibrary = useEditorStore(state => state.mediaLibrary);

  // Find all available video and audio clips across tracks
  const { videoClips, audioClips } = useMemo(() => {
    const vClips: ClipOption[] = [];
    const aClips: ClipOption[] = [];

    for (const track of tracks) {
      if (track.muted || track.hidden) continue;
      for (const clip of track.clips || []) {
        const media = mediaLibrary.find(m => m.id === clip.mediaId);
        const isVideo = track.type === 'video' || media?.type === 'video';
        const isAudio = track.type === 'audio' || media?.type === 'audio';

        const item: ClipOption = {
          id: clip.id,
          name: media?.name || (isVideo ? 'Video Clip' : 'Audio Clip'),
          trackName: track.name || (isVideo ? 'Video Track' : 'Audio Track'),
          duration: clip.duration,
          startTime: clip.startTime,
          type: isVideo ? 'video' : 'audio',
        };

        if (isVideo) {
          vClips.push(item);
        } else if (isAudio) {
          aClips.push(item);
        }
      }
    }

    return { videoClips: vClips, audioClips: aClips };
  }, [tracks, mediaLibrary]);

  // Pre-selected clips derived from timeline selection
  const preSelectedVideoId = useMemo(() => {
    const candidateIds = selectedClipIds.length > 0 ? selectedClipIds : (selectedClipId ? [selectedClipId] : []);
    const preVideo = videoClips.find(c => candidateIds.includes(c.id));
    return preVideo?.id || videoClips[0]?.id || '';
  }, [selectedClipIds, selectedClipId, videoClips]);

  const preSelectedTtsId = useMemo(() => {
    const candidateIds = selectedClipIds.length > 0 ? selectedClipIds : (selectedClipId ? [selectedClipId] : []);
    const preAudio = audioClips.find(c => candidateIds.includes(c.id));
    return preAudio?.id || audioClips[0]?.id || '';
  }, [selectedClipIds, selectedClipId, audioClips]);

  // User manual overrides from dropdown
  const [userVideoId, setUserVideoId] = useState<string | null>(null);
  const [userTtsId, setUserTtsId] = useState<string | null>(null);

  // Active selections (user chosen if still present, otherwise pre-selected)
  const selectedVideoId = (userVideoId && videoClips.some(c => c.id === userVideoId))
    ? userVideoId
    : preSelectedVideoId;

  const selectedTtsId = (userTtsId && audioClips.some(c => c.id === userTtsId))
    ? userTtsId
    : preSelectedTtsId;

  const [alignStartTime, setAlignStartTime] = useState(true);
  const [muteOriginalAudio, setMuteOriginalAudio] = useState(true);
  const [selectedModel, setSelectedModel] = useState<GeminiSpeedSyncModel>('gemini-3.5-flash-preview');

  const [isSyncing, setIsSyncing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [phaseMessage, setPhaseMessage] = useState('');
  const [syncResult, setSyncResult] = useState<AiSpeedSyncResult | null>(null);

  const handleStartSync = async () => {
    if (!selectedVideoId || !selectedTtsId) {
      toast.error('Please select both a video clip and a TTS audio clip.');
      return;
    }

    setIsSyncing(true);
    setProgress(5);
    setPhaseMessage('Preparing audio channels...');
    setSyncResult(null);

    try {
      const result = await syncVideoClipWithTts(
        selectedVideoId,
        selectedTtsId,
        {
          alignStartTime,
          muteOriginalAudio,
          targetModel: selectedModel,
        },
        (prog, msg) => {
          setProgress(prog);
          setPhaseMessage(msg);
        }
      );

      setSyncResult(result);
      toast.success(`Speed Sync complete! Applied ${result.speedFrames.length} speed frames using ${result.successfulModel}.`);
    } catch (err: any) {
      console.error('[AiSpeedSyncModal] Sync error:', err);
      toast.error(err?.message || 'Failed to sync video speed with TTS.');
    } finally {
      setIsSyncing(false);
    }
  };

  const selectedVideo = videoClips.find(c => c.id === selectedVideoId);
  const selectedTts = audioClips.find(c => c.id === selectedTtsId);

  return (
    <div className="fixed inset-0 bg-black/70 z-[999] flex items-center justify-center backdrop-blur-sm p-4">
      <div className="bg-[#1e1e1e] border border-white/10 rounded-2xl shadow-2xl p-5 w-full max-w-[520px] text-white animate-in fade-in zoom-in-95 duration-150 relative">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={isSyncing}
          className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-colors disabled:opacity-50"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              AI Speed Sync (TTS Voiceover)
              <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/20 text-amber-300 rounded border border-amber-500/30">
                Speed Frames
              </span>
            </h2>
            <p className="text-[11px] text-white/60">
              Scans video & TTS audio cadence to dynamically rate-stretch video without cutting clips.
            </p>
          </div>
        </div>

        {/* Model Cascade Indicator */}
        <div className="mt-3 mb-4 p-2.5 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-1.5 text-white/70">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>AI Model Pipeline:</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] font-mono text-cyan-300">
            <span className="bg-cyan-500/20 px-1.5 py-0.5 rounded border border-cyan-500/30 font-semibold">
              gemini-3.5-flash-preview
            </span>
            <ChevronRight className="w-3 h-3 text-white/30" />
            <span className="text-white/50">3.1 Flash Lite</span>
            <ChevronRight className="w-3 h-3 text-white/30" />
            <span className="text-white/40">3.8 Flash</span>
          </div>
        </div>

        {/* Clip Selection */}
        <div className="space-y-3 mb-4">
          {/* Video Clip Selector */}
          <div>
            <label className="flex items-center justify-between text-xs font-semibold mb-1 text-white/80">
              <span className="flex items-center gap-1.5">
                <Film className="w-3.5 h-3.5 text-blue-400" />
                Target Video Clip (receives Speed Frames)
              </span>
              {selectedVideo && (
                <span className="text-[10px] text-white/50 font-normal">
                  {selectedVideo.duration.toFixed(2)}s • Starts at {selectedVideo.startTime.toFixed(2)}s
                </span>
              )}
            </label>
            {videoClips.length === 0 ? (
              <div className="p-2.5 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                No video clips found on timeline. Add a video clip first.
              </div>
            ) : (
              <select
                value={selectedVideoId}
                onChange={(e) => setUserVideoId(e.target.value)}
                disabled={isSyncing}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-500/50 outline-none"
              >
                {videoClips.map(clip => (
                  <option key={clip.id} value={clip.id} className="bg-[#262626] text-white">
                    {clip.name} ({clip.trackName} — {clip.duration.toFixed(1)}s)
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* TTS Audio Clip Selector */}
          <div>
            <label className="flex items-center justify-between text-xs font-semibold mb-1 text-white/80">
              <span className="flex items-center gap-1.5">
                <Mic className="w-3.5 h-3.5 text-emerald-400" />
                TTS Voiceover Clip (timing reference)
              </span>
              {selectedTts && (
                <span className="text-[10px] text-white/50 font-normal">
                  {selectedTts.duration.toFixed(2)}s • Starts at {selectedTts.startTime.toFixed(2)}s
                </span>
              )}
            </label>
            {audioClips.length === 0 ? (
              <div className="p-2.5 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                No audio / TTS clips found on timeline. Generate TTS in the Media panel first.
              </div>
            ) : (
              <select
                value={selectedTtsId}
                onChange={(e) => setUserTtsId(e.target.value)}
                disabled={isSyncing}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-emerald-500/50 outline-none"
              >
                {audioClips.map(clip => (
                  <option key={clip.id} value={clip.id} className="bg-[#262626] text-white">
                    {clip.name} ({clip.trackName} — {clip.duration.toFixed(1)}s)
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Options */}
        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/10 space-y-2.5 mb-4 text-xs">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={alignStartTime}
              onChange={(e) => setAlignStartTime(e.target.checked)}
              disabled={isSyncing}
              className="rounded border-white/20 bg-white/5 text-amber-500 focus:ring-0"
            />
            <span className="text-white/80">Align Video Clip start to match TTS Clip start</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={muteOriginalAudio}
              onChange={(e) => setMuteOriginalAudio(e.target.checked)}
              disabled={isSyncing}
              className="rounded border-white/20 bg-white/5 text-amber-500 focus:ring-0"
            />
            <span className="text-white/80 flex items-center gap-1.5">
              <VolumeX className="w-3.5 h-3.5 text-white/50" />
              Mute original video audio (recommended so only TTS is heard)
            </span>
          </label>
        </div>

        {/* Live Progress */}
        {isSyncing && (
          <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-2">
            <div className="flex items-center justify-between text-xs text-amber-300 font-medium">
              <span className="flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                {phaseMessage || 'Analyzing media...'}
              </span>
              <span>{progress}%</span>
            </div>
            <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-cyan-400 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Success Result Breakdown */}
        {syncResult && !isSyncing && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-2 text-xs">
            <div className="flex items-center justify-between text-emerald-300 font-semibold">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                Speed Frames Applied ({syncResult.speedFrames.length} points)
              </span>
              <span className="text-[10px] font-mono bg-emerald-500/20 px-1.5 py-0.5 rounded text-emerald-200">
                {syncResult.successfulModel}
              </span>
            </div>
            {syncResult.alignmentMode && (
              <div className="flex items-center gap-2 text-[11px]">
                <span className={`px-1.5 py-0.5 rounded border font-semibold ${
                  syncResult.alignmentMode === 'word-level'
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                }`}>
                  {syncResult.alignmentMode === 'word-level' ? 'Word-level alignment' : 'Cadence alignment'}
                </span>
                {syncResult.alignmentMode === 'word-level' && syncResult.stretchFrameCount ? (
                  <span className="text-white/60">
                    {syncResult.stretchFrameCount} hold frame{syncResult.stretchFrameCount > 1 ? 's' : ''} for extra TTS words
                  </span>
                ) : null}
              </div>
            )}
            {syncResult.summary && (
              <p className="text-[11px] text-white/70 italic">
                "{syncResult.summary}"
              </p>
            )}
            <div className="max-h-24 overflow-y-auto space-y-1 pr-1 text-[11px] font-mono text-white/60">
              {syncResult.segments.map((seg, idx) => (
                <div key={idx} className="flex justify-between py-0.5 border-b border-white/5">
                  <span>Seg {idx + 1}: {seg.startOffset.toFixed(2)}s - {seg.endOffset.toFixed(2)}s</span>
                  <span className={`font-semibold ${seg.speed > 1.05 ? 'text-amber-400' : seg.speed < 0.95 ? 'text-cyan-400' : 'text-emerald-400'}`}>
                    {seg.speed.toFixed(2)}x speed
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/10">
          <button
            onClick={onClose}
            disabled={isSyncing}
            className="px-4 py-2 text-xs text-white/60 hover:text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {syncResult ? 'Close' : 'Cancel'}
          </button>

          {!syncResult ? (
            <button
              onClick={handleStartSync}
              disabled={isSyncing || !selectedVideoId || !selectedTtsId}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black flex items-center gap-2 shadow-lg shadow-amber-500/20 disabled:opacity-50 transition-all"
            >
              {isSyncing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Analyzing Audio...
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5 fill-black" />
                  Analyze & Apply Speed Frames
                </>
              )}
            </button>
          ) : (
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 transition-all shadow-lg shadow-emerald-600/20"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Done
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
