import React from 'react';
import {
  Sparkles,
  Zap,
  Music,
  Unlink2,
  Scissors,
  Copy,
  Palette,
  Box,
  Trash2,
  Edit,
  Bookmark,
  Tag,
  Layers,
  X,
  Loader2,
} from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import type { TimelineTrack, TimelineMarker } from '@/types';
import type { TimelineState } from '../hooks/useTimelineState';

interface TimelineModalsProps {
  timelineState: TimelineState;
  tracks: TimelineTrack[];
  markers: TimelineMarker[];
  recordingSeconds: number;
  handleGenerateSubtitles: (clipId: string, mode: 'standard' | 'dynamic') => void;
  handleOpenSfxGenerator: (clipId: string) => void;
  handleGenerateSFX: () => void;
  handleAuditionSFX: () => void;
  handleAutoCueSFX: () => void;
  handleVoiceoverRecordingToggle: (trackId: string) => void;
}

export function TimelineModals({
  timelineState,
  tracks,
  markers,
  recordingSeconds,
  handleGenerateSubtitles,
  handleOpenSfxGenerator,
  handleGenerateSFX,
  handleAuditionSFX,
  handleAutoCueSFX,
  handleVoiceoverRecordingToggle,
}: TimelineModalsProps) {
  const {
    contextMenu,
    setContextMenu,
    markerContextMenu,
    setMarkerContextMenu,
    isTranscribing,
    sfxModalClipId,
    setSfxModalClipId,
    sfxCategory,
    setSfxCategory,
    sfxDuration,
    setSfxDuration,
    sfxName,
    setSfxName,
    isAnalyzingSfx,
    isSynthesizingSfx,
    sfxAutoCueClipId,
    setSfxAutoCueClipId,
    sfxUserDescription,
    setSfxUserDescription,
    sfxAutoCueMode,
    setSfxAutoCueMode,
    isAnalyzingAutoCue,
    autoCueProgress,
  } = timelineState;

  const {
    isRecordingVoiceover,
    recordingTrackId,
    unlinkAudio,
    breakLinkConnection,
    splitClip,
    updateMarker,
    removeMarker,
    updateClip,
    updateOverLayer,
    addOverLayer,
  } = useEditorStore();

  const handleEditMarker = (markerId: string) => {
    const marker = markers.find(m => m.id === markerId);
    if (!marker) return;
    const newName = prompt('Rename marker:', marker.name);
    if (newName !== null) {
      updateMarker(markerId, { name: newName });
    }
    setMarkerContextMenu(null);
  };

  const handleZIndexChange = (clipId: string, isOverLayer: boolean, action: 'front' | 'back' | 'forward' | 'backward') => {
    const clip = isOverLayer 
      ? tracks.flatMap(t => t.overLayers || []).find(c => c.id === clipId)
      : tracks.flatMap(t => t.clips).find(c => c.id === clipId);
    
    if (!clip) return;
    const currentZ = clip.zIndex || 0;
    
    let newZ = currentZ;
    if (action === 'forward') newZ = currentZ + 1;
    else if (action === 'backward') newZ = currentZ - 1;
    else if (action === 'front') newZ = 9999;
    else if (action === 'back') newZ = -9999;

    if (isOverLayer) {
      updateOverLayer(clipId, { zIndex: newZ });
    } else {
      updateClip(clipId, { zIndex: newZ });
    }
    setContextMenu(null);
  };

  return (
    <>
      {/* ── Context Menu ──────────────────────────────────────────────── */}
      {contextMenu && (
        <div
          className="fixed z-[200] bg-[#2d2d2d] border border-[#4e4e4e] rounded-lg shadow-2xl py-1 min-w-[190px] text-white"
          style={{
            left: `${Math.min(contextMenu.x, window.innerWidth - 200)}px`,
            top: `${Math.min(contextMenu.y, window.innerHeight - 300)}px`,
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {contextMenu.clipId === '' ? (
            // Clicked track background empty options
            <>
              {contextMenu.trackId && (
                <button
                  className="w-full text-left px-3 py-2 text-xs text-white hover:bg-[#3e3e3e] flex items-center gap-2 transition-colors border-b border-[#3e3e3e]"
                  onClick={() => {
                    addOverLayer(contextMenu.trackId!);
                    setContextMenu(null);
                  }}
                >
                  <Layers className="w-3.5 h-3.5 text-cyan-400" />
                  Add Over Layer
                </button>
              )}
              <button
                className="w-full text-left px-3 py-2 text-xs text-[#a0a0a0] hover:text-white hover:bg-[#3e3e3e] flex items-center gap-2 transition-colors"
                onClick={() => {
                  const state = useEditorStore.getState();
                  if (state.clipboardData || state.clipboardClip) {
                    state.pasteClip();
                  } else {
                    alert('Clipboard is empty.');
                  }
                  setContextMenu(null);
                }}
              >
                <Box className="w-3.5 h-3.5" />
                Paste Clip Here
              </button>
            </>
          ) : (
            // Clicked a clip
            <>
              {contextMenu.isOverLayer ? (
                <>
                  <div className="px-3 pb-1 text-[10px] text-[#a0a0a0] font-semibold border-b border-[#3e3e3e] mb-1 uppercase tracking-wider">
                    Over-Layer Options
                  </div>
                  <div className="px-3 py-1.5 text-[10px] text-[#a0a0a0] mt-0.5">Move Layer Row</div>
                  <div className="grid grid-cols-4 gap-1 px-3 py-1">
                    <button
                      title="Bring to Front"
                      className="px-1.5 py-1 bg-[#1e1e1e] hover:bg-[#3e3e3e] text-[10px] rounded transition-colors"
                      onClick={() => handleZIndexChange(contextMenu.clipId, true, 'front')}
                    >
                      Top
                    </button>
                    <button
                      title="Send to Back"
                      className="px-1.5 py-1 bg-[#1e1e1e] hover:bg-[#3e3e3e] text-[10px] rounded transition-colors"
                      onClick={() => handleZIndexChange(contextMenu.clipId, true, 'back')}
                    >
                      Bot
                    </button>
                    <button
                      title="Move Up"
                      className="px-1.5 py-1 bg-[#1e1e1e] hover:bg-[#3e3e3e] text-[10px] rounded transition-colors"
                      onClick={() => handleZIndexChange(contextMenu.clipId, true, 'forward')}
                    >
                      Up
                    </button>
                    <button
                      title="Move Down"
                      className="px-1.5 py-1 bg-[#1e1e1e] hover:bg-[#3e3e3e] text-[10px] rounded transition-colors"
                      onClick={() => handleZIndexChange(contextMenu.clipId, true, 'backward')}
                    >
                      Dn
                    </button>
                  </div>
                  <div className="h-px bg-[#3e3e3e] my-1" />
                  <button
                    className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-[#3e3e3e] flex items-center gap-2 transition-colors"
                    onClick={() => {
                      useEditorStore.getState().removeOverLayer(contextMenu.clipId);
                      setContextMenu(null);
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete Over-Layer
                  </button>
                </>
              ) : (
                <>
                  {contextMenu.trackId && (
                    <button
                      className="w-full text-left px-3 py-2 text-xs text-white hover:bg-[#3e3e3e] flex items-center gap-2 transition-colors border-b border-[#3e3e3e]"
                      onClick={() => {
                        addOverLayer(contextMenu.trackId!);
                        setContextMenu(null);
                      }}
                    >
                      <Layers className="w-3.5 h-3.5 text-cyan-400" />
                      Add Over Layer
                    </button>
                  )}
                  <div className="px-3 pb-1 text-[10px] text-[#a0a0a0] font-semibold border-b border-[#3e3e3e] mb-1 uppercase tracking-wider">
                    Clip Options
                  </div>

                  {/* AI Options (only for Video/Image clips, not audio/text) */}
                  {contextMenu.mediaType !== 'audio' && contextMenu.mediaType !== 'text' && (
                    <>
                      <button
                        className="w-full text-left px-3 py-2 text-xs text-white hover:bg-[#3e3e3e] flex items-center gap-2 transition-colors"
                        onClick={() => {
                          handleGenerateSubtitles(contextMenu.clipId, 'standard');
                          setContextMenu(null);
                        }}
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        Generate Subtitles / Captions
                      </button>
                      <button
                        className="w-full text-left px-3 py-2 text-xs text-white hover:bg-[#3e3e3e] flex items-center gap-2 transition-colors border-b border-[#3e3e3e] pb-2"
                        onClick={() => {
                          handleGenerateSubtitles(contextMenu.clipId, 'dynamic');
                          setContextMenu(null);
                        }}
                      >
                        <Zap className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
                        Generate Dynamic Typography
                      </button>
                      <button
                        className="w-full text-left px-3 py-2 text-xs text-white hover:bg-[#3e3e3e] flex items-center gap-2 transition-colors"
                        onClick={() => {
                          handleOpenSfxGenerator(contextMenu.clipId);
                          setContextMenu(null);
                        }}
                      >
                        <Music className="w-3.5 h-3.5 text-cyan-400" />
                        AI Generate Sound Effect (SFX)
                      </button>
                      <button
                        className="w-full text-left px-3 py-2 text-xs text-white hover:bg-[#3e3e3e] flex items-center gap-2 transition-colors border-b border-[#3e3e3e] pb-2"
                        onClick={() => {
                          setSfxAutoCueClipId(contextMenu.clipId);
                          setSfxUserDescription('');
                          setSfxAutoCueMode('visual');
                          setContextMenu(null);
                        }}
                      >
                        <Sparkles className="w-3.5 h-3.5 text-pink-400" />
                        AI Auto-Cue Sound Effects
                      </button>
                    </>
                  )}

                  {/* Extract Audio */}
                  {contextMenu.mediaType === 'video' && !tracks.flatMap(t => t.clips).find(c => c.id === contextMenu.clipId)?.linkedClipId && (
                    <button
                      className="w-full text-left px-3 py-2 text-xs text-white hover:bg-[#3e3e3e] flex items-center gap-2 transition-colors"
                      onClick={() => {
                        unlinkAudio(contextMenu.clipId);
                        setContextMenu(null);
                      }}
                    >
                      <Unlink2 className="w-3.5 h-3.5 text-emerald-400" />
                      Extract Audio
                    </button>
                  )}
                  {/* Break Link Connection */}
                  {tracks.flatMap(t => t.clips).find(c => c.id === contextMenu.clipId)?.linkedClipId && (
                    <button
                      className="w-full text-left px-3 py-2 text-xs text-white hover:bg-[#3e3e3e] flex items-center gap-2 transition-colors"
                      onClick={() => {
                        breakLinkConnection(contextMenu.clipId);
                        setContextMenu(null);
                      }}
                    >
                      <Unlink2 className="w-3.5 h-3.5 text-red-400" />
                      Break Link Connection
                    </button>
                  )}
                  <button
                    className="w-full text-left px-3 py-2 text-xs text-white hover:bg-[#3e3e3e] flex items-center gap-2 transition-colors"
                    onClick={() => {
                      splitClip(contextMenu.clipId, useEditorStore.getState().currentTime);
                      setContextMenu(null);
                    }}
                  >
                    <Scissors className="w-3.5 h-3.5 text-amber-400" />
                    Split at Playhead
                  </button>
                  <div className="h-px bg-[#3e3e3e] my-1" />
                  <button
                    className="w-full text-left px-3 py-2 text-xs text-white hover:bg-[#3e3e3e] flex items-center gap-2 transition-colors"
                    onClick={() => {
                      useEditorStore.getState().copyClip('clip' as const);
                      setContextMenu(null);
                    }}
                  >
                    <Copy className="w-3.5 h-3.5 text-blue-400" />
                    Copy Clip (Base)
                  </button>
                  <button
                    className="w-full text-left px-3 py-2 text-xs text-white hover:bg-[#3e3e3e] flex items-center gap-2 transition-colors"
                    onClick={() => {
                      useEditorStore.getState().copyClip('style' as const);
                      setContextMenu(null);
                    }}
                  >
                    <Palette className="w-3.5 h-3.5 text-purple-400" />
                    Copy Style
                  </button>
                  <button
                    className="w-full text-left px-3 py-2 text-xs text-white hover:bg-[#3e3e3e] flex items-center gap-2 transition-colors"
                    onClick={() => {
                      useEditorStore.getState().copyClip('whole' as const);
                      setContextMenu(null);
                    }}
                  >
                    <Box className="w-3.5 h-3.5 text-amber-400" />
                    Copy (Whole)
                  </button>
                  <div className="h-px bg-[#3e3e3e] my-1" />
                  <button
                    className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-[#3e3e3e] flex items-center gap-2 transition-colors"
                    onClick={() => {
                      useEditorStore.getState().removeClip(contextMenu.clipId);
                      setContextMenu(null);
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete Clip
                  </button>
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Marker Context Menu ────────────────────────────────────────── */}
      {markerContextMenu && (() => {
        const marker = markers.find(m => m.id === markerContextMenu.markerId);
        if (!marker) return null;
        return (
          <div
            className="fixed z-[200] bg-[#2d2d2d] border border-[#4e4e4e] rounded-lg shadow-2xl py-2 min-w-[200px] text-white max-h-[80vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
            style={{
              left: `${Math.min(markerContextMenu.x, window.innerWidth - 220)}px`,
              top: `${Math.min(markerContextMenu.y, window.innerHeight - 320)}px`,
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="px-3 pb-2 text-[10px] text-[#a0a0a0] font-semibold border-b border-[#3e3e3e] mb-1.5 uppercase tracking-wider">
              Edit Marker
            </div>
            <button
              className="w-full text-left px-3 py-1.5 text-xs text-white hover:bg-[#3e3e3e] flex items-center gap-2 transition-colors"
              onClick={() => handleEditMarker(marker.id)}
            >
              <Edit className="w-3.5 h-3.5 text-amber-400" />
              Rename Marker
            </button>
            
            <div className="px-3 py-1 text-[10px] text-[#a0a0a0] mt-1.5">Color</div>
            <div className="grid grid-cols-6 gap-1 px-3 py-1.5">
              {['#fbbf24', '#3b82f6', '#22c55e', '#ef4444', '#8b5cf6', '#ffffff'].map((color) => (
                <button
                  key={color}
                  onClick={() => {
                    updateMarker(marker.id, { color });
                    setMarkerContextMenu(null);
                  }}
                  className={`w-5 h-5 rounded-full border transition-all ${
                    marker.color === color ? 'border-white scale-110 shadow-md' : 'border-transparent hover:border-white/50'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>

            <div className="px-3 py-1 text-[10px] text-[#a0a0a0] mt-1">Marker Type</div>
            .            <div className="px-1.5 pb-1.5 space-y-0.5">
              <button
                className={`w-full text-left px-2 py-1 text-xs rounded flex items-center gap-2 transition-colors ${marker.type === 'standard' || !marker.type ? 'bg-amber-500/20 text-amber-400' : 'text-white hover:bg-[#3e3e3e]'}`}
                onClick={() => { updateMarker(marker.id, { type: 'standard' }); setMarkerContextMenu(null); }}
              >
                <Bookmark className="w-3 h-3" /> Standard
              </button>
              <button
                className={`w-full text-left px-2 py-1 text-xs rounded flex items-center gap-2 transition-colors ${marker.type === 'sponsor' ? 'bg-green-500/20 text-green-400' : 'text-white hover:bg-[#3e3e3e]'}`}
                onClick={() => { updateMarker(marker.id, { type: 'sponsor', color: '#22c55e' }); setMarkerContextMenu(null); }}
              >
                <Tag className="w-3 h-3" /> Sponsor Segment
              </button>
              <button
                className={`w-full text-left px-2 py-1 text-xs rounded flex items-center gap-2 transition-colors ${marker.type === 'chapter' ? 'bg-blue-500/20 text-blue-400' : 'text-white hover:bg-[#3e3e3e]'}`}
                onClick={() => { updateMarker(marker.id, { type: 'chapter', color: '#3b82f6' }); setMarkerContextMenu(null); }}
              >
                <Layers className="w-3 h-3" /> Chapter Marker
              </button>
            </div>

            <div className="h-px bg-[#3e3e3e] my-1.5" />
            <button
              className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-[#3e3e3e] flex items-center gap-2 transition-colors"
              onClick={() => {
                removeMarker(marker.id);
                setMarkerContextMenu(null);
              }}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete Marker
            </button>
          </div>
        );
      })()}

      {/* Floating Voiceover Recording Timer Banner */}
      {isRecordingVoiceover && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[300] bg-red-950/95 border border-red-500/30 text-white px-4 py-2 rounded-full shadow-2xl flex items-center gap-3 animate-pulse">
          <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-ping" />
          <span className="text-xs font-semibold uppercase tracking-wider text-red-200">
            Recording Voiceover
          </span>
          <span className="text-xs font-mono font-bold text-red-100 bg-red-900/60 border border-red-500/20 px-2 py-0.5 rounded-full">
            {Math.floor(recordingSeconds / 60).toString().padStart(2, '0')}:
            {(recordingSeconds % 60).toString().padStart(2, '0')}s
          </span>
          <button
            onClick={() => {
              const track = tracks.find(t => t.id === recordingTrackId);
              if (track) handleVoiceoverRecordingToggle(track.id);
            }}
            className="text-[10px] text-red-300 hover:text-white bg-red-900/40 hover:bg-red-800 border border-red-500/25 px-2.5 py-1 rounded-full transition-colors ml-1 uppercase font-semibold"
          >
            Done
          </button>
        </div>
      )}

      {/* Floating AI Transcribing Loader Toast */}
      {isTranscribing && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[300] bg-[#1e1e1e]/95 border border-amber-500/30 text-white px-5 py-3 rounded-full shadow-2xl flex items-center gap-3">
          <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
          <span className="text-xs font-semibold uppercase tracking-wider text-amber-200">
            AI Transcribing Clip Audio...
          </span>
          <span className="text-[10px] text-[#8a8a8a] bg-[#141414] border border-[#3e3e3e] px-2 py-0.5 rounded-full">
            This may take a few seconds
          </span>
        </div>
      )}

      {/* AI Sound Effects Generator Modal */}
      {sfxModalClipId && (
        <div className="fixed inset-0 bg-black/80 z-[500] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#1e1e1e] border border-[#3e3e3e] rounded-xl shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 bg-[#252525] border-b border-[#3e3e3e] flex justify-between items-center">
              <h3 className="text-sm font-semibold text-cyan-400 flex items-center gap-2">
                <Music className="w-4 h-4" />
                AI Sound Effects (SFX) Generator
              </h3>
              <button
                onClick={() => setSfxModalClipId(null)}
                className="text-[#a0a0a0] hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="p-3 bg-[#141414] border border-[#3e3e3e] rounded-lg">
                {isAnalyzingSfx ? (
                  <div className="flex items-center gap-2 text-xs text-[#a0a0a0]">
                    <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
                    <span>AI is analyzing clip tags and choosing a matching sound...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-cyan-300">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>AI recommends category: <strong className="text-white uppercase">{sfxCategory}</strong></span>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-[#8a8a8a] uppercase tracking-wider font-semibold">Sound Name</label>
                <input
                  type="text"
                  value={sfxName}
                  onChange={(e) => setSfxName(e.target.value)}
                  placeholder="Name of the sound effect"
                  className="w-full bg-[#141414] text-white text-xs border border-[#3e3e3e] rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-[#8a8a8a] uppercase tracking-wider font-semibold">SFX Category / Profile</label>
                <select
                  value={sfxCategory}
                  onChange={(e) => setSfxCategory(e.target.value)}
                  className="w-full bg-[#141414] text-white text-xs border border-[#3e3e3e] rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500 cursor-pointer"
                >
                  <option value="explosion">💥 Explosion (Crash, Boom, Hit)</option>
                  <option value="laser">⚡ Laser (Zap, Ray Gun, Shot)</option>
                  <option value="swoosh">💨 Swoosh (Wind Sweep, Whoosh, Pass)</option>
                  <option value="jump">🦘 Retro Jump (Upward Sweep, Pop)</option>
                  <option value="bubble">🫧 Bubble Pop (Liquid, Cute Click)</option>
                  <option value="alarm">🚨 Alarm (Siren, Siren Alert, Beep)</option>
                  <option value="click">🖱️ Click (UI Tick, Small Snap)</option>
                  <option value="ambient">🌬️ Ambient (Wind Hum, Static, Room Tone)</option>
                  <option value="waves">🌊 Ocean Waves (Water Flow, Deep Hum)</option>
                  <option value="flying">✈️ Flying Drone (Engine Buzz, Flight Whoosh)</option>
                  <option value="magic">✨ Magic Chimes (Sparkles, Fairy Dust)</option>
                  <option value="punch">🤛 Punch / Hit (Impact Thud, Slap)</option>
                  <option value="footsteps">👣 Footsteps (Walking, Gravel Steps)</option>
                  <option value="gunshot">🔫 Gunshot Blast (Pistol Crack, Rifle Shot)</option>
                  <option value="spark">⚡ Electrical Spark (Lightning Crackle)</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between text-[10px] text-[#8a8a8a] uppercase tracking-wider font-semibold">
                  <span>Sound Duration</span>
                  <span className="font-mono text-cyan-400">{sfxDuration.toFixed(1)}s</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="5.0"
                  step="0.1"
                  value={sfxDuration}
                  onChange={(e) => setSfxDuration(Number(e.target.value))}
                  className="w-full accent-cyan-400"
                />
              </div>
            </div>

            <div className="p-4 bg-[#252525] border-t border-[#3e3e3e] flex gap-2 justify-end">
              <button
                onClick={() => setSfxModalClipId(null)}
                className="px-4 py-2 text-xs text-[#a0a0a0] hover:text-white transition-colors"
              >
                Cancel
              </button>

              <button
                onClick={handleAuditionSFX}
                className="px-4 py-2 text-xs border border-[#4e4e4e] hover:border-cyan-500/50 hover:bg-cyan-500/10 text-cyan-400 font-medium rounded-lg transition-all"
              >
                🔊 Audition Sound
              </button>

              <button
                onClick={handleGenerateSFX}
                disabled={isSynthesizingSfx || isAnalyzingSfx}
                className="px-4 py-2 text-xs bg-cyan-500 hover:bg-cyan-600 text-black font-semibold rounded-lg flex items-center gap-1.5 disabled:opacity-45 disabled:pointer-events-none transition-all shadow-lg hover:shadow-cyan-500/10"
              >
                {isSynthesizingSfx ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Synthesizing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    Generate & Add
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Sound Effects Auto-Cue Modal */}
      {sfxAutoCueClipId && (
        <div className="fixed inset-0 bg-black/80 z-[500] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#1e1e1e] border border-[#3e3e3e] rounded-xl shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 bg-[#252525] border-b border-[#3e3e3e] flex justify-between items-center">
              <h3 className="text-sm font-semibold text-pink-400 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-pink-400 font-semibold" />
                AI Sound Effects Auto-Cue Panel
              </h3>
              <button
                onClick={() => {
                  if (!isAnalyzingAutoCue) setSfxAutoCueClipId(null);
                }}
                className="text-[#a0a0a0] hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex bg-[#141414] border-b border-[#3e3e3e] p-1">
              <button
                type="button"
                disabled={isAnalyzingAutoCue}
                onClick={() => setSfxAutoCueMode('visual')}
                className={`flex-1 py-2 text-xs rounded transition-all font-medium flex items-center justify-center gap-1.5 ${
                  sfxAutoCueMode === 'visual'
                    ? 'bg-[#252525] text-white font-semibold shadow-inner border border-[#3e3e3e]'
                    : 'text-[#a0a0a0] hover:text-white disabled:opacity-50'
                }`}
              >
                👁️ Visual Motion Scan
              </button>
              <button
                type="button"
                disabled={isAnalyzingAutoCue}
                onClick={() => setSfxAutoCueMode('ai_script')}
                className={`flex-1 py-2 text-xs rounded transition-all font-medium flex items-center justify-center gap-1.5 ${
                  sfxAutoCueMode === 'ai_script'
                    ? 'bg-[#252525] text-white font-semibold shadow-inner border border-[#3e3e3e]'
                    : 'text-[#a0a0a0] hover:text-white disabled:opacity-50'
                }`}
              >
                📝 AI Script Planner
              </button>
            </div>

            <div className="p-4 space-y-4">
              {isAnalyzingAutoCue ? (
                <div className="py-8 flex flex-col items-center justify-center space-y-4">
                  <Loader2 className="w-8 h-8 text-pink-400 animate-spin" />
                  <div className="text-center">
                    <p className="text-xs font-semibold text-white">
                      {sfxAutoCueMode === 'visual' ? 'Scanning Video Pixels...' : 'AI Planning Sound Cue Points...'}
                    </p>
                    <p className="text-[10px] text-[#8a8a8a] mt-1">This will automatically synthesize and place sounds.</p>
                  </div>
                  <div className="w-full max-w-xs bg-[#141414] h-2 rounded-full overflow-hidden border border-[#3e3e3e] mt-2">
                    <div
                      className="bg-pink-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${autoCueProgress}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-pink-400 font-semibold">{autoCueProgress}% done</span>
                </div>
              ) : (
                <>
                  {sfxAutoCueMode === 'visual' ? (
                    <div className="space-y-3">
                      <p className="text-xs text-[#a0a0a0] leading-relaxed">
                        This option scans the actual video track frames locally (in the browser). It detects **visual motion peaks, cuts, flashes, and transitions** and automatically generates and places swooshes and hits.
                      </p>
                      <div className="p-3 bg-pink-950/20 border border-pink-500/20 rounded-lg text-[10px] text-pink-300/90 leading-relaxed">
                        💡 <strong>Note:</strong> Perfect for fast-paced videos, gaming montages, transition-heavy shorts, or action edits! Runs completely offline in seconds.
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs text-[#a0a0a0] leading-relaxed">
                        Write a brief description of the action cue sequence happening in this video clip, and the AI will formulate precise timestamped sound cues for the timeline.
                      </p>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] text-[#8a8a8a] uppercase tracking-wider font-semibold">Video Action Script</label>
                        <textarea
                          value={sfxUserDescription}
                          onChange={(e) => setSfxUserDescription(e.target.value)}
                          placeholder="e.g., A player runs on grass, jumps, shoots a futuristic gun, and hits a target which explodes..."
                          className="w-full h-24 bg-[#141414] text-white text-xs border border-[#3e3e3e] rounded-lg p-2.5 resize-none focus:outline-none focus:border-pink-500 placeholder-[#5a5a5a] scrollbar-thin"
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="p-4 bg-[#252525] border-t border-[#3e3e3e] flex gap-2 justify-end">
              <button
                disabled={isAnalyzingAutoCue}
                onClick={() => setSfxAutoCueClipId(null)}
                className="px-4 py-2 text-xs text-[#a0a0a0] hover:text-white transition-colors disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                onClick={handleAutoCueSFX}
                disabled={isAnalyzingAutoCue || (sfxAutoCueMode === 'ai_script' && !sfxUserDescription.trim())}
                className="px-5 py-2 text-xs bg-pink-500 hover:bg-pink-600 text-white font-semibold rounded-lg flex items-center gap-1.5 disabled:opacity-45 disabled:pointer-events-none transition-all shadow-lg hover:shadow-pink-500/10"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Run AI Auto-Cue
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
