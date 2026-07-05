import React, { useState, useRef, useEffect } from 'react';
import { Play, Square, Sparkles, Check, X, Loader2, Volume2 } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { AICueResult } from '@/utils/aiClient';
import { AudioOption } from '@/utils/audioSearchClient';

interface CueWithOptions extends AICueResult {
  options: AudioOption[];
}

interface AiSoundDesignerProps {
  clip: any;
  cues: CueWithOptions[];
  onClose: () => void;
}

export function AiSoundDesigner({ clip, cues, onClose }: AiSoundDesignerProps) {
  const { tracks, addMedia, addClip, addTrack } = useEditorStore();
  const [selectedOptions, setSelectedOptions] = useState<Record<number, number>>({});
  const [playingOption, setPlayingOption] = useState<{ cueIndex: number; optionIndex: number } | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [applyProgress, setApplyProgress] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize selected options to the first option (best match) by default
  useEffect(() => {
    const defaults: Record<number, number> = {};
    cues.forEach((cue, index) => {
      if (cue.options && cue.options.length > 0) {
        defaults[index] = 0; // select the first Freesound option
      }
    });
    setSelectedOptions(defaults);
  }, [cues]);

  // Clean up audio player on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const handlePlayPreview = (cueIndex: number, optionIndex: number, url: string) => {
    if (playingOption?.cueIndex === cueIndex && playingOption?.optionIndex === optionIndex) {
      // Toggle play/stop
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setPlayingOption(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
    }

    setPlayingOption({ cueIndex, optionIndex });
    const audio = new Audio(url);
    audio.crossOrigin = 'anonymous';
    audioRef.current = audio;
    audio.play().catch((err) => {
      console.error('Audio preview play failed:', err);
      setPlayingOption(null);
    });

    audio.onended = () => {
      setPlayingOption(null);
    };
  };

  const handleApply = async () => {
    setIsApplying(true);
    setApplyProgress(0);

    // Get (or create) the target audio track
    let audioTrack = tracks.find((t) => t.type === 'audio');
    if (!audioTrack) {
      addTrack('audio');
      // Fetch tracks state directly
      const updatedTracks = useEditorStore.getState().tracks;
      audioTrack = updatedTracks.find((t) => t.type === 'audio');
    }

    if (!audioTrack) {
      alert('Could not find or create an audio track on the timeline.');
      setIsApplying(false);
      return;
    }

    const totalCues = Object.keys(selectedOptions).length;
    let completed = 0;

    useEditorStore.getState().startTransaction();
    try {
      for (const [cueIdxStr, optionIdx] of Object.entries(selectedOptions)) {
        const cueIdx = parseInt(cueIdxStr);
        const cue = cues[cueIdx];
        const option = cue.options[optionIdx];

        if (!option) continue;

        try {
          // 1. Download the audio preview blob
          const res = await fetch(option.previewUrl);
          if (!res.ok) throw new Error(`Fetch audio returned status ${res.status}`);

          const blob = await res.blob();

          // Convert blob to File object (needed by addMedia)
          const filename = `${cue.query.replace(/\s+/g, '_')}_${option.id}.mp3`;
          const file = new File([blob], filename, { type: 'audio/mp3', lastModified: Date.now() });

          // 2. Generate new MediaItem metadata
          const mediaId = `ai_audio_${option.id}_${Date.now()}`;
          const mediaItem = {
            id: mediaId,
            name: option.name.length > 30 ? option.name.substring(0, 30) + '...' : option.name,
            type: 'audio' as const,
            duration: option.duration,
            url: URL.createObjectURL(blob),
            createdAt: Date.now()
          };

          // 3. Add to media library (and IndexedDB)
          addMedia(mediaItem, file);

          // 4. Compute start position relative to clip
          // Global timeline start time = clip.startTime + cue.start
          const globalStart = clip.startTime + cue.start;

          // 5. Add audio clip to the audio track
          const clipId = `clip_ai_audio_${option.id}_${Date.now()}`;
          const audioClip = {
            id: clipId,
            mediaId: mediaId,
            trackId: audioTrack.id,
            startTime: globalStart,
            duration: Math.min(option.duration, cue.end - cue.start),
            trimStart: 0,
            trimEnd: 0,
            opacity: 1,
            speed: 1,
            effects: [],
            transform: { x: 0, y: 0, scale: 100, rotation: 0 },
            audioSettings: {
              volume: 0,
              pan: 0,
              fadeIn: 0,
              fadeOut: 0,
              bass: 0,
              treble: 0,
              muted: false,
              preservePitch: true,
              pitch: 0,
              voiceFormant: 0,
              humanize: false,
            }
          };

          addClip(audioClip);
        } catch (err) {
          console.error(`Failed to download and add SFX: ${option.name}`, err);
        }

        completed++;
        setApplyProgress(Math.round((completed / totalCues) * 100));
      }
    } finally {
      useEditorStore.getState().endTransaction();
    }

    setIsApplying(false);
    onClose();
    alert('AI Sound Effects added to timeline successfully!');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-4xl max-h-[85vh] flex flex-col bg-[#1e1e1e]/95 border border-[#3e3e3e] rounded-xl shadow-2xl overflow-hidden text-white">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#3e3e3e] bg-[#252525]">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <h2 className="font-semibold text-sm">AI Interactive Sound Designer</h2>
          </div>
          <button 
            onClick={onClose} 
            disabled={isApplying}
            className="p-1 hover:bg-[#3e3e3e] rounded text-[#a0a0a0] hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded text-xs text-amber-300">
            <strong>Grok-Style Storyboard Audition:</strong> Gemini has analyzed the storyboard grid of your video. Review the suggested sound effect cues below, preview different sound options, select the ones you prefer, and click apply to add them to your track.
          </div>

          <div className="space-y-4">
            {cues.map((cue, cueIdx) => (
              <div key={cueIdx} className="bg-[#2a2a2a] border border-[#3e3e3e] rounded-lg p-4 space-y-3">
                
                {/* Cue Metadata Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-[#3e3e3e] pb-2">
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 font-semibold text-[10px] rounded uppercase tracking-wider">
                      {cue.type}
                    </span>
                    <h3 className="font-medium text-xs capitalize text-white">
                      {cue.query}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[#a0a0a0]">
                    <span>Position:</span>
                    <strong className="text-white bg-[#1e1e1e] px-2 py-0.5 rounded">
                      {cue.start.toFixed(1)}s - {cue.end.toFixed(1)}s
                    </strong>
                  </div>
                </div>

                {/* Justification Reason */}
                <p className="text-[10px] text-[#a0a0a0] italic">
                  <strong>Trigger context:</strong> {cue.reason}
                </p>

                {/* Audio Options List */}
                <div className="grid gap-2">
                  {cue.options && cue.options.length > 0 ? (
                    cue.options.map((option, optIdx) => {
                      const isSelected = selectedOptions[cueIdx] === optIdx;
                      const isPlaying = playingOption?.cueIndex === cueIdx && playingOption?.optionIndex === optIdx;

                      return (
                        <div
                          key={option.id}
                          className={`flex items-center justify-between gap-3 p-2.5 rounded border transition-all ${
                            isSelected
                              ? 'bg-amber-500/10 border-amber-500 text-white'
                              : 'bg-[#1e1e1e] border-[#3e3e3e] text-[#a0a0a0] hover:text-white'
                          }`}
                        >
                          {/* Left: Radio selector & Play Preview button */}
                          <div className="flex items-center gap-3 min-w-0">
                            <input
                              type="radio"
                              name={`cue-option-${cueIdx}`}
                              checked={isSelected}
                              onChange={() => setSelectedOptions({ ...selectedOptions, [cueIdx]: optIdx })}
                              className="rounded-full border-[#3e3e3e] text-amber-500 bg-[#1e1e1e] focus:ring-0 focus:ring-offset-0 cursor-pointer"
                            />
                            
                            <button
                              onClick={() => handlePlayPreview(cueIdx, optIdx, option.previewUrl)}
                              className={`p-1.5 rounded-full transition-colors ${
                                isPlaying ? 'bg-red-500 text-white animate-pulse' : 'bg-[#2a2a2a] text-white hover:bg-[#3e3e3e]'
                              }`}
                            >
                              {isPlaying ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                            </button>

                            <div className="min-w-0">
                              <span className="text-xs font-medium block truncate text-white">
                                {option.name}
                              </span>
                              <span className="text-[9px] text-[#a0a0a0]">
                                Duration: {option.duration.toFixed(1)}s | Tags: {option.tags.slice(0, 4).join(', ')}
                              </span>
                            </div>
                          </div>

                          {/* Right: Selected flag */}
                          {isSelected && (
                            <span className="text-[10px] text-amber-400 font-medium flex items-center gap-1">
                              <Check className="w-3 h-3" /> Selected
                            </span>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-[10px] text-red-400/80 py-1">
                      No matching sound effects found on Freesound for this cue.
                    </div>
                  )}
                </div>

              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#3e3e3e] bg-[#252525]">
          <span className="text-[10px] text-[#a0a0a0]">
            Selected: {Object.keys(selectedOptions).length} / {cues.length} Cues
          </span>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={isApplying}
              className="px-4 py-2 text-xs font-medium text-white hover:bg-[#3e3e3e] rounded transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={isApplying || Object.keys(selectedOptions).length === 0}
              className="px-5 py-2 text-xs font-medium text-white bg-amber-500 hover:bg-amber-600 active:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-lg flex items-center gap-1.5 transition-colors"
            >
              {isApplying ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Applying ({applyProgress}%)</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Add Sound Effects</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
