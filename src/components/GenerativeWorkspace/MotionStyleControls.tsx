import React from 'react';
import { Sliders, Sparkles, Cpu, Clock, Palette, LayoutGrid } from 'lucide-react';

export interface MotionStyleControlsProps {
  style: string;
  setStyle: (val: string) => void;
  layout: string;
  setLayout: (val: string) => void;
  provider: 'gemini' | 'groq';
  setProvider: (val: 'gemini' | 'groq') => void;
  customPrompt: string;
  setCustomPrompt: (val: string) => void;
  targetDuration: number;
  setTargetDuration: (val: number) => void;
  mode: 'clip' | 'text';
}

const STYLE_OPTIONS = [
  { value: 'mixed', label: 'Mixed (AI Decides)' },
  { value: 'mrbeast', label: 'MrBeast Hype' },
  { value: 'hormozi', label: 'Alex Hormozi' },
  { value: 'cyberpunk', label: 'Neon Cyberpunk' },
  { value: 'minimal', label: 'Minimal Clean' },
  { value: 'editorial', label: 'News/Editorial' },
];

const LAYOUT_OPTIONS = [
  { value: 'mixed', label: 'Mixed (AI Decides)' },
  { value: 'kinetic', label: 'Kinetic Typography' },
  { value: 'lower-third', label: 'Lower Third' },
  { value: 'data-viz', label: 'Data Visualization' },
];

export const MotionStyleControls: React.FC<MotionStyleControlsProps> = ({
  style,
  setStyle,
  layout,
  setLayout,
  provider,
  setProvider,
  customPrompt,
  setCustomPrompt,
  targetDuration,
  setTargetDuration,
  mode,
}) => {
  return (
    <div className="bg-[#252525] border border-[#3e3e3e] rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between border-b border-[#3e3e3e] pb-2">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-amber-400" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-white">
            Generation Settings
          </h3>
        </div>

        {/* Provider Toggle */}
        <div className="flex items-center bg-[#1a1a1a] p-0.5 rounded-lg border border-[#3e3e3e]">
          <button
            type="button"
            onClick={() => setProvider('gemini')}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
              provider === 'gemini'
                ? 'bg-amber-400 text-black font-semibold shadow-sm'
                : 'text-[#a0a0a0] hover:text-white'
            }`}
          >
            Gemini
          </button>
          <button
            type="button"
            onClick={() => setProvider('groq')}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
              provider === 'groq'
                ? 'bg-amber-400 text-black font-semibold shadow-sm'
                : 'text-[#a0a0a0] hover:text-white'
            }`}
          >
            Groq
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Style Dropdown */}
        <div className="space-y-1">
          <label className="text-xs text-[#a0a0a0] flex items-center gap-1.5">
            <Palette className="w-3.5 h-3.5 text-amber-400/80" />
            Motion Style
          </label>
          <select
            value={style}
            onChange={(e) => setStyle(e.target.value)}
            className="w-full bg-[#1a1a1a] border border-[#3e3e3e] rounded text-sm text-white px-2.5 py-1.5 focus:outline-none focus:border-amber-400 transition"
          >
            {STYLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-[#1a1a1a] text-white">
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Layout Dropdown */}
        <div className="space-y-1">
          <label className="text-xs text-[#a0a0a0] flex items-center gap-1.5">
            <LayoutGrid className="w-3.5 h-3.5 text-amber-400/80" />
            Layout Composition
          </label>
          <select
            value={layout}
            onChange={(e) => setLayout(e.target.value)}
            className="w-full bg-[#1a1a1a] border border-[#3e3e3e] rounded text-sm text-white px-2.5 py-1.5 focus:outline-none focus:border-amber-400 transition"
          >
            {LAYOUT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-[#1a1a1a] text-white">
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Target Duration Slider (only in text mode) */}
      {mode === 'text' && (
        <div className="space-y-1.5 pt-1 border-t border-[#3e3e3e]/60">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#a0a0a0] flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400/80" />
              Target Duration
            </span>
            <span className="font-semibold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
              {targetDuration}s
            </span>
          </div>
          <input
            type="range"
            min={5}
            max={30}
            step={1}
            value={targetDuration}
            onChange={(e) => setTargetDuration(Number(e.target.value))}
            className="w-full accent-amber-400 cursor-pointer h-1.5 bg-[#1a1a1a] rounded-lg appearance-none"
          />
          <div className="flex justify-between text-[10px] text-[#606060]">
            <span>5s</span>
            <span>15s</span>
            <span>30s</span>
          </div>
        </div>
      )}

      {/* Custom Prompt */}
      <div className="space-y-1 pt-1 border-t border-[#3e3e3e]/60">
        <label className="text-xs text-[#a0a0a0] flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-400/80" />
          Custom Instructions / Prompt
        </label>
        <textarea
          value={customPrompt}
          onChange={(e) => setCustomPrompt(e.target.value)}
          placeholder='Additional instructions... e.g. "use red and black colors only", "add 3D bounce"'
          rows={2}
          className="w-full bg-[#1a1a1a] border border-[#3e3e3e] rounded text-sm text-white placeholder-[#606060] p-2.5 resize-none focus:outline-none focus:border-amber-400 transition"
        />
      </div>
    </div>
  );
};
