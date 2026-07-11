import React, { useState, useRef, useEffect } from 'react';
import { Play, Square, Sparkles, Check, X, Loader2, Volume2, Info, RefreshCw } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { AICueResult } from '@/utils/aiClient';
import { AudioOption } from '@/utils/audioSearchClient';
import { toast } from 'sonner';

interface CueWithOptions extends AICueResult {
  options: AudioOption[];
}

interface AiSoundDesignerProps {
  clip: any;
  cues: CueWithOptions[];
  onClose: () => void;
}

export function AiSoundDesigner({ clip, cues, onClose }: AiSoundDesignerProps) {
  const { tracks, addMedia, addClip, addTrack, mediaLibrary } = useEditorStore();
  
  // Find video media URL
  const media = mediaLibrary.find((m) => m.id === clip.mediaId);
  const videoUrl = media?.url;

  // Selected option indices for each cue
  const [selectedOptions, setSelectedOptions] = useState<Record<number, number>>({});
  const [activeCueIndex, setActiveCueIndex] = useState<number>(0);
  
  // Audition playback states
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0); // relative to clip: 0 to clip.duration
  const [isApplying, setIsApplying] = useState(false);
  const [applyProgress, setApplyProgress] = useState(0);

  // References
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioPlayersRef = useRef<Record<number, HTMLAudioElement>>({});
  const playheadIntervalRef = useRef<number | null>(null);

  // Initialize selections to first Freesound option
  useEffect(() => {
    const defaults: Record<number, number> = {};
    cues.forEach((cue, index) => {
      if (cue.options && cue.options.length > 0) {
        defaults[index] = 0;
      }
    });
    setSelectedOptions(defaults);
    if (cues.length > 0) {
      setActiveCueIndex(0);
    }
  }, [cues]);

  // Sync / Playback Engine loop
  useEffect(() => {
    const syncAudioEngine = () => {
      if (!videoRef.current) return;
      const v = videoRef.current;
      const relTime = Math.max(0, v.currentTime - clip.trimStart);
      setCurrentTime(relTime);

      // Enforce duration boundary
      if (relTime >= clip.duration) {
        v.pause();
        v.currentTime = clip.trimStart;
        setIsPlaying(false);
        // Pause all audios
        Object.values(audioPlayersRef.current).forEach((aud) => {
          aud.pause();
          aud.currentTime = 0;
        });
        return;
      }

      // Sync each cue's audio player
      cues.forEach((cue, cueIdx) => {
        const optionIdx = selectedOptions[cueIdx];
        if (optionIdx === undefined) return;
        const option = cue.options[optionIdx];
        if (!option) return;

        // Ensure audio instance exists in cache
        let audio = audioPlayersRef.current[cueIdx];
        if (!audio || audio.src !== option.previewUrl) {
          if (audio) {
            audio.pause();
          }
          audio = new Audio(option.previewUrl);
          audio.crossOrigin = 'anonymous';
          audioPlayersRef.current[cueIdx] = audio;
        }

        const isWithinRange = relTime >= cue.start && relTime < cue.end;

        if (isWithinRange && isPlaying) {
          if (audio.paused) {
            audio.play().catch((err) => console.warn('Preview audio failed to play:', err));
          }
          // Synchronize timing if drifting by > 0.15s
          const expectedAudioTime = relTime - cue.start;
          if (Math.abs(audio.currentTime - expectedAudioTime) > 0.15) {
            audio.currentTime = expectedAudioTime;
          }
        } else {
          if (!audio.paused) {
            audio.pause();
            audio.currentTime = 0;
          }
        }
      });
    };

    if (isPlaying) {
      playheadIntervalRef.current = window.setInterval(syncAudioEngine, 50);
    } else {
      if (playheadIntervalRef.current) {
        clearInterval(playheadIntervalRef.current);
        playheadIntervalRef.current = null;
      }
      // Pause all audios when paused
      Object.values(audioPlayersRef.current).forEach((aud) => {
        aud.pause();
      });
    }

    return () => {
      if (playheadIntervalRef.current) {
        clearInterval(playheadIntervalRef.current);
      }
    };
  }, [isPlaying, cues, selectedOptions, clip]);

  // Clean up players on unmount
  useEffect(() => {
    return () => {
      Object.values(audioPlayersRef.current).forEach((aud) => {
        aud.pause();
      });
      audioPlayersRef.current = {};
    };
  }, []);

  const handlePlayPause = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      // Seek back if we are near the end
      const relTime = videoRef.current.currentTime - clip.trimStart;
      if (relTime >= clip.duration - 0.05) {
        videoRef.current.currentTime = clip.trimStart;
      }
      videoRef.current.play().catch((err) => console.error('Video preview play failed:', err));
      setIsPlaying(true);
    }
  };

  // Timeline seeking click handler
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const relativeSeek = percentage * clip.duration;
    
    if (videoRef.current) {
      videoRef.current.currentTime = clip.trimStart + relativeSeek;
      setCurrentTime(relativeSeek);
      
      // Update audio playheads
      cues.forEach((cue, cueIdx) => {
        const audio = audioPlayersRef.current[cueIdx];
        if (audio) {
          const isWithin = relativeSeek >= cue.start && relativeSeek < cue.end;
          if (isWithin) {
            audio.currentTime = relativeSeek - cue.start;
            if (isPlaying && audio.paused) {
              audio.play().catch(() => {});
            }
          } else {
            audio.pause();
            audio.currentTime = 0;
          }
        }
      });
    }
  };

  // Play/pause a single option in the inspector pane
  const [playingOptionKey, setPlayingOptionKey] = useState<string | null>(null);
  const inspectorAudioRef = useRef<HTMLAudioElement | null>(null);

  const handleAuditionOption = (option: AudioOption, key: string) => {
    if (playingOptionKey === key) {
      if (inspectorAudioRef.current) {
        inspectorAudioRef.current.pause();
      }
      setPlayingOptionKey(null);
      return;
    }

    if (inspectorAudioRef.current) {
      inspectorAudioRef.current.pause();
    }

    // Stop main preview while auditioning individual track
    if (isPlaying && videoRef.current) {
      videoRef.current.pause();
      setIsPlaying(false);
    }

    const aud = new Audio(option.previewUrl);
    aud.crossOrigin = 'anonymous';
    inspectorAudioRef.current = aud;
    setPlayingOptionKey(key);
    
    aud.play().catch((err) => {
      console.error('Audition sound failed:', err);
      setPlayingOptionKey(null);
    });

    aud.onended = () => {
      setPlayingOptionKey(null);
    };
  };

  // Cleanup inspector audio
  useEffect(() => {
    return () => {
      if (inspectorAudioRef.current) {
        inspectorAudioRef.current.pause();
      }
    };
  }, []);

  const handleApply = async () => {
    setIsApplying(true);
    setApplyProgress(0);

    // Stop playback
    if (videoRef.current) {
      videoRef.current.pause();
    }
    setIsPlaying(false);
    Object.values(audioPlayersRef.current).forEach((aud) => aud.pause());
    if (inspectorAudioRef.current) {
      inspectorAudioRef.current.pause();
    }

    // Get (or create) the target audio track
    let audioTrack = tracks.find((t) => t.type === 'audio');
    if (!audioTrack) {
      addTrack('audio');
      const updatedTracks = useEditorStore.getState().tracks;
      audioTrack = updatedTracks.find((t) => t.type === 'audio');
    }

    if (!audioTrack) {
      toast.error('Could not find or create an audio track on the timeline.');
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
          // Download audio preview
          const res = await fetch(option.previewUrl);
          if (!res.ok) throw new Error(`Status ${res.status}`);

          const blob = await res.blob();
          const filename = `${cue.query.replace(/\s+/g, '_')}_${option.id}.mp3`;
          const file = new File([blob], filename, { type: 'audio/mp3', lastModified: Date.now() });

          const mediaId = `ai_audio_${option.id}_${Date.now()}`;
          const mediaItem = {
            id: mediaId,
            name: option.name.length > 25 ? option.name.substring(0, 25) + '...' : option.name,
            type: 'audio' as const,
            duration: option.duration,
            url: URL.createObjectURL(blob),
            createdAt: Date.now()
          };

          addMedia(mediaItem, file);

          // Add to audio track
          const globalStart = clip.startTime + cue.start;
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
              volume: 80,
              pan: 0,
              fadeIn: 0.2,
              fadeOut: 0.2,
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
          console.error(`Failed to import SFX ${option.name}:`, err);
        }

        completed++;
        setApplyProgress(Math.round((completed / totalCues) * 100));
      }
      toast.success('AI Sound Design successfully imported to track!');
    } catch (err: any) {
      toast.error(`Import failed: ${err.message}`);
    } finally {
      useEditorStore.getState().endTransaction();
    }

    setIsApplying(false);
    onClose();
  };

  const activeCue = cues[activeCueIndex];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/75 backdrop-blur-md">
      <div className="w-full max-w-5xl h-[82vh] flex flex-col bg-[#141414] border border-[#2d2d2d] rounded-2xl shadow-2xl overflow-hidden text-white">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2d2d2d] bg-[#1a1a1a]">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="font-semibold text-sm">AI Sound Designer Workspace</h2>
              <p className="text-[10px] text-[#a0a0a0]">Preview, select and layout sound effects dynamically synced with video</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            disabled={isApplying}
            className="p-1 hover:bg-[#2d2d2d] rounded-lg text-[#a0a0a0] hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Workspace Body */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
          
          {/* Left Column: Video Preview */}
          <div className="w-full lg:w-3/5 border-r border-[#2d2d2d] flex flex-col bg-[#0b0b0b]">
            <div className="flex-1 flex items-center justify-center p-4 relative">
              {videoUrl ? (
                <video
                  ref={videoRef}
                  src={videoUrl}
                  className="max-w-full max-h-[35vh] rounded-lg bg-black border border-[#2d2d2d] shadow-lg"
                  muted
                  playsInline
                />
              ) : (
                <div className="text-xs text-[#606060]">No video source available</div>
              )}
            </div>
            
            {/* Player Controls Bar */}
            <div className="px-6 py-3 border-t border-[#2d2d2d] bg-[#141414] flex items-center justify-between gap-4">
              <button
                onClick={handlePlayPause}
                className="px-4 py-1.5 bg-[#202020] hover:bg-[#2e2e2e] rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-[#303030]"
              >
                {isPlaying ? <Square className="w-3.5 h-3.5 fill-white text-white" /> : <Play className="w-3.5 h-3.5 fill-white text-white" />}
                <span>{isPlaying ? 'Pause' : 'Play'}</span>
              </button>

              <div className="flex items-center gap-3 text-xs font-mono text-[#a0a0a0]">
                <span className="text-white font-bold">{currentTime.toFixed(2)}s</span>
                <span>/</span>
                <span>{clip.duration.toFixed(2)}s</span>
              </div>
            </div>
          </div>

          {/* Right Column: Audio Cue Selector / Inspector */}
          <div className="w-full lg:w-2/5 flex flex-col bg-[#111] overflow-y-auto">
            {activeCue ? (
              <div className="p-5 flex-1 flex flex-col gap-5">
                {/* Selected Cue Details */}
                <div className="p-4 bg-[#1a1a1a] border border-[#2d2d2d] rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] px-2 py-0.5 bg-amber-500/20 text-amber-400 font-bold uppercase rounded tracking-wider">
                      {activeCue.type}
                    </span>
                    <span className="text-[10px] text-[#a0a0a0] font-mono">
                      {activeCue.start.toFixed(1)}s - {activeCue.end.toFixed(1)}s
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold capitalize text-white">{activeCue.query}</h3>
                  <p className="text-[10px] text-[#a0a0a0] leading-relaxed italic">
                    <Info className="w-3 h-3 inline mr-1 text-amber-500" />
                    <strong>Trigger context:</strong> {activeCue.reason}
                  </p>
                </div>

                {/* Option List */}
                <div className="space-y-2">
                  <h4 className="text-[10px] text-[#a0a0a0] uppercase font-bold tracking-wider mb-2">Alternate Sound Options (Freesound)</h4>
                  
                  {activeCue.options && activeCue.options.length > 0 ? (
                    activeCue.options.map((option, optIdx) => {
                      const isSelected = selectedOptions[activeCueIndex] === optIdx;
                      const isOptionPlaying = playingOptionKey === `${activeCueIndex}-${optIdx}`;

                      return (
                        <div
                          key={option.id}
                          onClick={() => setSelectedOptions({ ...selectedOptions, [activeCueIndex]: optIdx })}
                          className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-amber-500/10 border-amber-500 text-white'
                              : 'bg-[#1a1a1a] border-[#222] text-[#808080] hover:text-[#fff] hover:border-[#444]'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <input
                              type="radio"
                              name={`active-cue-opt-${activeCueIndex}`}
                              checked={isSelected}
                              onChange={() => setSelectedOptions({ ...selectedOptions, [activeCueIndex]: optIdx })}
                              className="w-3.5 h-3.5 text-amber-500 bg-black border-[#3a3a3a] focus:ring-0 focus:ring-offset-0"
                            />
                            <div className="min-w-0">
                              <span className="text-xs font-semibold block truncate text-white">
                                {option.name}
                              </span>
                              <span className="text-[9px] text-[#808080]">
                                Duration: {option.duration.toFixed(1)}s | Tags: {option.tags.slice(0, 3).join(', ')}
                              </span>
                            </div>
                          </div>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAuditionOption(option, `${activeCueIndex}-${optIdx}`);
                            }}
                            className={`p-1.5 rounded-full transition-colors flex items-center justify-center ${
                              isOptionPlaying ? 'bg-red-600 text-white animate-pulse' : 'bg-[#282828] text-[#a0a0a0] hover:text-white'
                            }`}
                          >
                            {isOptionPlaying ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-xs text-red-400 py-3 text-center bg-red-950/20 rounded-xl border border-red-900/30">
                      No sound assets found on Freesound for this query.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-xs text-[#606060]">
                Select a sound block in the timeline below to inspect and customize.
              </div>
            )}
          </div>

        </div>

        {/* Bottom Timeline Preview Panel */}
        <div className="border-t border-[#2d2d2d] bg-[#0c0c0c] p-6 space-y-3">
          <div className="flex items-center justify-between text-xs text-[#a0a0a0]">
            <span className="font-semibold text-[10px] uppercase tracking-wider">Workspace Preview Timeline</span>
            <span className="text-[9px]">Click blocks to audition alternates. Click empty track to seek.</span>
          </div>

          <div className="relative border border-[#222] rounded-xl overflow-hidden bg-[#111]">
            {/* Timeline Ruler */}
            <div className="h-6 border-b border-[#222] bg-[#141414] relative flex items-center text-[9px] text-[#606060] select-none font-mono">
              {Array.from({ length: Math.ceil(clip.duration) + 1 }).map((_, sec) => (
                <div
                  key={sec}
                  style={{ left: `${(sec / clip.duration) * 100}%` }}
                  className="absolute transform -translate-x-1/2 flex flex-col items-center"
                >
                  <span className="h-1.5 w-0.5 bg-[#333] mb-0.5"></span>
                  <span>{sec}s</span>
                </div>
              ))}
            </div>

            {/* Tracks View */}
            <div 
              onClick={handleTimelineClick}
              className="h-20 relative overflow-hidden cursor-crosshair select-none"
            >
              {/* Cue Blocks */}
              {cues.map((cue, idx) => {
                const selectedOptIdx = selectedOptions[idx];
                const option = cue.options[selectedOptIdx];
                const isActive = activeCueIndex === idx;

                const leftPos = (cue.start / clip.duration) * 100;
                const widthPos = ((cue.end - cue.start) / clip.duration) * 100;

                return (
                  <div
                    key={idx}
                    style={{
                      left: `${leftPos}%`,
                      width: `${widthPos}%`,
                      top: `${(idx % 2) * 36 + 6}px`,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveCueIndex(idx);
                    }}
                    className={`absolute h-7 rounded-lg px-2 flex items-center justify-between text-[9px] font-semibold border shadow transition-all cursor-pointer select-none ${
                      isActive
                        ? 'bg-amber-500 border-amber-600 text-black z-10'
                        : 'bg-[#202020] border-[#303030] text-[#a0a0a0] hover:border-[#505050] hover:text-white'
                    }`}
                  >
                    <span className="truncate block max-w-[80%] capitalize">
                      {cue.query}
                    </span>
                    <span className="text-[8px] font-mono opacity-80 shrink-0">
                      {option ? `${option.duration.toFixed(0)}s` : 'N/A'}
                    </span>
                  </div>
                );
              })}

              {/* Sweeping Vertical Playhead */}
              <div
                style={{ left: `${(currentTime / clip.duration) * 100}%` }}
                className="absolute top-0 bottom-0 w-0.5 bg-red-500 shadow-md pointer-events-none"
              >
                <div className="w-1.5 h-1.5 bg-red-500 rounded-full absolute -top-1 -left-[2px]" />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#2d2d2d] bg-[#1a1a1a]">
          <span className="text-[10px] text-[#a0a0a0]">
            Ready to import {cues.length} audio tracks to timeline
          </span>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={isApplying}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#202020] hover:bg-[#2c2c2c] rounded-lg border border-[#303030] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={isApplying || Object.keys(selectedOptions).length === 0}
              className="px-5 py-2 text-xs font-bold text-black bg-amber-400 hover:bg-amber-500 active:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-lg flex items-center gap-1.5 transition-colors"
            >
              {isApplying ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Importing ({applyProgress}%)</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-3.5 h-3.5 fill-black" />
                  <span>Import Sound Design</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
