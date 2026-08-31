import React from 'react';
import { Sliders, Sparkles, Clock, Palette, LayoutGrid, Droplet } from 'lucide-react';

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
  transparent: boolean;
  setTransparent: (val: boolean) => void;
}

const STYLE_OPTIONS = [
  { value: 'vox', label: 'Vox Explainer (Flat Vector World)' },
  { value: 'documentary', label: 'Documentary (Vox / Johnny Harris)' },
  { value: 'kurzgesagt', label: 'Vector Explainer (Kurzgesagt)' },
  { value: 'mrbeast', label: 'MrBeast Hype (Bold Pop)' },
  { value: 'hormozi', label: 'Alex Hormozi (Snap Badges)' },
  { value: 'cyberpunk', label: 'Neon Cyberpunk (HUD Grid)' },
  { value: 'minimal', label: 'Minimal Clean (Swiss Typo)' },
  { value: 'editorial', label: 'Vintage Newspaper / Paper Cutout' },
  { value: 'mixed', label: 'Mixed (AI Decides)' },
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
  transparent,
  setTransparent,
}) => {
  return (
    <div className="bg-secondary border border-border rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-2">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-amber-400" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
            Generation Settings
          </h3>
        </div>

        {/* Provider Toggle */}
        <div className="flex items-center bg-background p-0.5 rounded-lg border border-border">
          <button
            type="button"
            onClick={() => setProvider('gemini')}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
              provider === 'gemini'
                ? 'bg-amber-400 text-black font-semibold shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
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
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Groq
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Style Dropdown */}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Palette className="w-3.5 h-3.5 text-amber-400/80" />
            Motion Style
          </label>
          <select
            value={style}
            onChange={(e) => setStyle(e.target.value)}
            className="w-full bg-background border border-border rounded text-sm text-foreground px-2.5 py-1.5 focus:outline-none focus:border-amber-400 transition"
          >
            {STYLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-background text-foreground">
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Layout Dropdown */}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground flex items-center gap-1.5">
            <LayoutGrid className="w-3.5 h-3.5 text-amber-400/80" />
            Layout Composition
          </label>
          <select
            value={layout}
            onChange={(e) => setLayout(e.target.value)}
            className="w-full bg-background border border-border rounded text-sm text-foreground px-2.5 py-1.5 focus:outline-none focus:border-amber-400 transition"
          >
            {LAYOUT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-background text-foreground">
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Transparent overlay toggle — the whole point of the overlay pipeline */}
      <div className="pt-1 border-t border-border/60">
        <button
          type="button"
          onClick={() => setTransparent(!transparent)}
          className="w-full flex items-start gap-2.5 text-left group"
          title="Remove full-frame backgrounds so the motion graphics composite over your footage"
        >
          <div
            className={`mt-0.5 w-9 h-5 shrink-0 rounded-full p-0.5 transition-colors ${
              transparent ? 'bg-amber-400' : 'bg-accent'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-black transition-transform ${
                transparent ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-xs text-foreground font-medium">
              <Droplet className="w-3.5 h-3.5 text-amber-400/80" />
              Transparent background
            </div>
            <p className="text-[11px] text-muted-foreground/80 leading-snug mt-0.5">
              {transparent
                ? 'Full-frame backdrops are stripped so the animation overlays your base video.'
                : 'Keeps the AI-designed backdrop. Turn off only if you want a self-contained plate.'}
            </p>
          </div>
        </button>
      </div>

      {/* Target Duration Slider (only in text mode) */}
      {mode === 'text' && (
        <div className="space-y-1.5 pt-1 border-t border-border/60">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground flex items-center gap-1.5">
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
            className="w-full accent-amber-400 cursor-pointer h-1.5 bg-background rounded-lg appearance-none"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground/70">
            <span>5s</span>
            <span>15s</span>
            <span>30s</span>
          </div>
        </div>
      )}

      {/* Custom Prompt */}
      <div className="space-y-1 pt-1 border-t border-border/60">
        <label className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-400/80" />
          Custom Instructions / Prompt
        </label>
        <textarea
          value={customPrompt}
          onChange={(e) => setCustomPrompt(e.target.value)}
          placeholder='Additional instructions... e.g. "use red and black colors only", "add 3D bounce"'
          rows={2}
          className="w-full bg-background border border-border rounded text-sm text-foreground placeholder:text-muted-foreground/70 p-2.5 resize-none focus:outline-none focus:border-amber-400 transition"
        />
      </div>
    </div>
  );
};
