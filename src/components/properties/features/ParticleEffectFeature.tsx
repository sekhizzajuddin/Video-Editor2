import React from 'react';
import { TimelineClip } from '@/types';
import { useEditorStore } from '@/store/editorStore';

interface ParticleEffectFeatureProps {
  clip: TimelineClip;
}

export function ParticleEffectFeature({ clip }: ParticleEffectFeatureProps) {
  const updateClip = useEditorStore((state) => state.updateClip);
  const ps = clip.particleSettings;
  if (!ps) return null;

  const upd = (patch: Partial<typeof ps>) =>
    updateClip(clip.id, { particleSettings: { ...ps, ...patch } });

  return (
    <div className="flex flex-col gap-3 bg-[#1e1e1e] rounded p-3 border border-violet-500/20">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold text-violet-400 uppercase tracking-wider">✦ Particle Effect</p>
        <button
          onClick={() => updateClip(clip.id, { particleSettings: undefined })}
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
            <span className="text-[10px] text-white">{(ps as any)[key]}{unit}</span>
          </div>
          <input type="range" min={min} max={max} value={(ps as any)[key]}
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
            <span className="text-[10px] text-white">{(ps as any)[key]}{unit}</span>
          </div>
          <input type="range" min={min} max={max} value={(ps as any)[key]}
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
}
