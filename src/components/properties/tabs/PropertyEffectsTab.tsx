/**
 * PropertyEffectsTab.tsx
 * 
 * Effects inspector tab for Properties Panel.
 * Handles Timeline FX parameters (Glitch, VHS, RGB Split, Blurs, etc.),
 * Particle Emitter controls (Type, Emitter X/Y, Amount, Speed, Size, Gravity, Wind, Glow),
 * and AI Motion Graphics generator buttons.
 */

import React from 'react';
import {
  Wand2,
  Sparkles,
  Loader2
} from 'lucide-react';
import { TimelineClip, TimelineTrack } from '@/types';

interface PropertyEffectsTabProps {
  selectedClip: TimelineClip;
  selectedTrack?: TimelineTrack;
  updateClip: (id: string, updates: Partial<TimelineClip>) => void;
  aiProvider: 'gemini' | 'groq';
  setAiProvider: (provider: 'gemini' | 'groq') => void;
  isAnalyzingMotionGraphics: boolean;
  motionGraphicsAnalyzeProgress: string;
  handleAiMotionGraphicsDesign: () => void;
}

export function PropertyEffectsTab({
  selectedClip,
  selectedTrack,
  updateClip,
  aiProvider,
  setAiProvider,
  isAnalyzingMotionGraphics,
  motionGraphicsAnalyzeProgress,
  handleAiMotionGraphicsDesign,
}: PropertyEffectsTabProps) {
  return (
    <div className="space-y-4 p-4 text-xs select-none">
      <h3 className="text-xs font-semibold text-white uppercase tracking-wider">Effect Settings</h3>

      {/* AI Text & Motion Graphics */}
      {selectedClip && selectedClip.mediaId !== 'text-placeholder' && !selectedClip.textSettings && selectedTrack?.type === 'video' && (
        <div className="bg-[#142323] border border-teal-500/30 rounded p-3 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-teal-400" />
            <span className="text-xs text-white font-semibold">AI Motion & Text Gen</span>
          </div>
          <p className="text-[11px] text-[#90b8b8]">
            Automatically generate subtitles, kinetic typography, or motion graphics for this clip.
          </p>

          {/* AI Provider Configuration */}
          <div className="pt-2 border-t border-[#3e3e3e]/40">
            <div className="flex items-center gap-2">
              <label className="text-[10px] text-white">AI Provider:</label>
              <select 
                value={aiProvider}
                onChange={(e) => setAiProvider(e.target.value as 'gemini' | 'groq')}
                className="bg-[#1e1e1e] text-white text-[10px] border border-[#3e3e3e] rounded px-2 py-1 focus:outline-none focus:border-teal-500"
              >
                <option value="gemini">Gemini</option>
                <option value="groq">Groq</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {isAnalyzingMotionGraphics ? (
              <div className="flex flex-col items-center justify-center gap-2 py-1.5 bg-[#1e2828] rounded border border-teal-500/20">
                <Loader2 className="w-3 h-3 text-teal-500 animate-spin" />
                <span className="text-[10px] text-teal-400 font-medium">
                  {motionGraphicsAnalyzeProgress}...
                </span>
              </div>
            ) : (
              <button
                onClick={handleAiMotionGraphicsDesign}
                className="w-full py-1.5 bg-[#2a2a2a] hover:bg-[#3e3e3e] text-white rounded text-[11px] font-medium transition-colors border border-[#3e3e3e]"
              >
                Generate Motion Graphics
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Timeline FX Settings ── */}
      {selectedClip.fxSettings && (
        <div className="flex flex-col gap-3 bg-[#1e1e1e] rounded p-3 border border-rose-500/20">
          <p className="text-[10px] font-semibold text-rose-400 uppercase tracking-wider">Timeline FX</p>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-[#a0a0a0]">Effect Type</label>
            <select
              value={selectedClip.fxSettings.type}
              onChange={(e) => updateClip(selectedClip.id, { fxSettings: { ...selectedClip.fxSettings!, type: e.target.value as any } })}
              className="bg-[#252525] text-white text-xs border border-[#3e3e3e] rounded px-2 py-1.5 focus:outline-none focus:border-rose-500"
            >
              <option value="vfx_breakdown">VFX Breakdown</option>
              <option value="bw_to_color">B&W to Color</option>
              <option value="glitch">Glitch</option>
              <option value="old_film">Old Film</option>
              <option value="vhs">VHS</option>
              <option value="cinematic_bars">Cinematic Bars</option>
              <option value="neon_glow">Neon Glow</option>
              <option value="rgb_split">RGB Split</option>
              <option value="pixelate">Pixelate</option>
              <option value="mirror">Mirror</option>
              <option value="zoom_blur">Zoom Blur</option>
              <option value="lens_flare">Lens Flare</option>
              <option value="night_vision">Night Vision</option>
              <option value="thermal">Thermal</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-[#a0a0a0]">Intensity — {selectedClip.fxSettings.intensity ?? 100}%</label>
            <input type="range" min="0" max="100"
              value={selectedClip.fxSettings.intensity ?? 100}
              onChange={(e) => updateClip(selectedClip.id, { fxSettings: { ...selectedClip.fxSettings!, intensity: Number(e.target.value) } })}
              className="flex-1 accent-rose-500"
            />
          </div>
        </div>
      )}

      {/* ── Particle Settings ── */}
      {selectedClip.particleSettings && (() => {
        const ps = selectedClip.particleSettings!;
        const upd = (patch: Partial<typeof ps>) =>
          updateClip(selectedClip.id, { particleSettings: { ...ps, ...patch } });

        return (
          <div className="flex flex-col gap-3 bg-[#1e1e1e] rounded p-3 border border-violet-500/20">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold text-violet-400 uppercase tracking-wider">✦ Particle Effect</p>
              <button
                onClick={() => updateClip(selectedClip.id, { particleSettings: undefined })}
                className="text-[9px] text-red-400/70 hover:text-red-400 px-1.5 py-0.5 rounded border border-red-500/20 hover:border-red-500/40 transition-colors"
              >Remove</button>
            </div>

            {/* Type selector */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-[#a0a0a0]">Effect Type</label>
              <select
                value={ps.type}
                onChange={(e) => upd({ type: e.target.value as any })}
                className="bg-[#252525] text-white text-xs border border-[#3e3e3e] rounded px-2 py-1.5 focus:outline-none focus:border-violet-500"
              >
                <option value="snow">❄️ Snow</option>
                <option value="rain">🌧️ Rain</option>
                <option value="fire">🔥 Fire</option>
                <option value="sparkles">✨ Sparkles</option>
                <option value="confetti">🎊 Confetti</option>
                <option value="smoke">💨 Smoke</option>
                <option value="bubbles">🫧 Bubbles</option>
                <option value="leaves">🍂 Leaves</option>
                <option value="hearts">💖 Hearts</option>
                <option value="matrix">💻 Matrix</option>
              </select>
            </div>

            {/* Emitter Position */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-[#a0a0a0]">Emitter Position</label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[9px] text-[#6a6a6a]">X — {Math.round(ps.emitterX)}%</span>
                  <input type="range" min="0" max="100" value={ps.emitterX}
                    onChange={(e) => upd({ emitterX: Number(e.target.value) })}
                    className="w-full accent-violet-500" />
                </div>
                <div>
                  <span className="text-[9px] text-[#6a6a6a]">Y — {Math.round(ps.emitterY)}%</span>
                  <input type="range" min="0" max="100" value={ps.emitterY}
                    onChange={(e) => upd({ emitterY: Number(e.target.value) })}
                    className="w-full accent-violet-500" />
                </div>
              </div>
              <p className="text-[9px] text-[#4a4a4a]">Or click on the preview canvas to set emitter position</p>
            </div>

            {/* Core controls */}
            {([
              { key: 'amount',    label: 'Amount',    min: 1,    max: 500, unit: '' },
              { key: 'speed',     label: 'Speed',     min: 0,    max: 200, unit: '%' },
              { key: 'intensity', label: 'Opacity',   min: 0,    max: 100, unit: '%' },
              { key: 'size',      label: 'Size',      min: 10,   max: 300, unit: '%' },
            ] as const).map(({ key, label, min, max, unit }) => (
              <div key={key} className="flex flex-col gap-0.5">
                <div className="flex justify-between">
                  <span className="text-[10px] text-[#a0a0a0]">{label}</span>
                  <span className="text-[10px] text-white">{ps[key]}{unit}</span>
                </div>
                <input type="range" min={min} max={max} value={ps[key]}
                  onChange={(e) => upd({ [key]: Number(e.target.value) } as any)}
                  className="w-full accent-violet-500" />
              </div>
            ))}

            {/* Physics */}
            <p className="text-[9px] font-semibold text-[#6a6a6a] uppercase tracking-wider mt-1">Physics</p>
            {([
              { key: 'gravity',     label: 'Gravity',     min: -100, max: 100, unit: '' },
              { key: 'wind',        label: 'Wind',        min: -100, max: 100, unit: '' },
              { key: 'spread',      label: 'Spread',      min: 0,    max: 180, unit: '°' },
              { key: 'lifetime',    label: 'Lifetime',    min: 10,   max: 300, unit: '%' },
              { key: 'turbulence',  label: 'Turbulence',  min: 0,    max: 100, unit: '' },
            ] as const).map(({ key, label, min, max, unit }) => (
              <div key={key} className="flex flex-col gap-0.5">
                <div className="flex justify-between">
                  <span className="text-[10px] text-[#a0a0a0]">{label}</span>
                  <span className="text-[10px] text-white">{ps[key]}{unit}</span>
                </div>
                <input type="range" min={min} max={max} value={ps[key]}
                  onChange={(e) => upd({ [key]: Number(e.target.value) } as any)}
                  className="w-full accent-cyan-500" />
              </div>
            ))}

            {/* Visual */}
            <p className="text-[9px] font-semibold text-[#6a6a6a] uppercase tracking-wider mt-1">Visual</p>
            <div className="flex flex-col gap-0.5">
              <div className="flex justify-between">
                <span className="text-[10px] text-[#a0a0a0]">Color Variance</span>
                <span className="text-[10px] text-white">{ps.colorVariance}</span>
              </div>
              <input type="range" min="0" max="100" value={ps.colorVariance}
                onChange={(e) => upd({ colorVariance: Number(e.target.value) })}
                className="w-full accent-pink-500" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[#a0a0a0]">Base Color</span>
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-[#6a6a6a]">{ps.color === 'auto' ? 'auto' : ps.color}</span>
                {ps.color !== 'auto' && (
                  <input type="color" value={ps.color}
                    onChange={(e) => upd({ color: e.target.value })}
                    className="w-6 h-6 rounded cursor-pointer border border-[#3e3e3e] bg-transparent" />
                )}
                <button
                  onClick={() => upd({ color: ps.color === 'auto' ? '#ffffff' : 'auto' })}
                  className="text-[9px] text-[#a0a0a0] hover:text-white px-1.5 py-0.5 border border-[#3e3e3e] rounded"
                >{ps.color === 'auto' ? 'Custom' : 'Auto'}</button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[#a0a0a0]">Glow Effect</span>
              <button
                onClick={() => upd({ glow: !ps.glow })}
                className={`text-[9px] px-2 py-0.5 rounded border transition-colors ${ps.glow ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300' : 'border-[#3e3e3e] text-[#6a6a6a] hover:text-white'}`}
              >{ps.glow ? 'ON' : 'OFF'}</button>
            </div>
          </div>
        );
      })()}

      {/* Empty state */}
      {!selectedClip.fxSettings && !selectedClip.particleSettings && (
        <div className="text-xs text-[#a0a0a0] flex flex-col items-center justify-center p-8 text-center border border-dashed border-[#3e3e3e] rounded">
          <Wand2 className="w-8 h-8 mb-2 opacity-50" />
          <p className="mb-1">No effects on this clip</p>
          <p className="text-[10px] text-[#5a5a5a]">Drag a Timeline FX or Particle Effect from the Effects panel onto this clip</p>
        </div>
      )}
    </div>
  );
}
