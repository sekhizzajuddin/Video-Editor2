import { AudioSlider } from './AudioSlider';
import { Sparkles, RotateCcw } from 'lucide-react';

interface EQSectionProps {
  bass: number;
  mid: number;
  treble: number;
  onBassChange: (val: number) => void;
  onMidChange: (val: number) => void;
  onTrebleChange: (val: number) => void;
}

const EQ_PRESETS = [
  { name: 'Flat', b: 0, m: 0, t: 0 },
  { name: 'Vocal Clarity', b: -2, m: 3, t: 4 },
  { name: 'Bass Boost', b: 6, m: 0, t: 1 },
  { name: 'Podcast', b: 3, m: 1, t: 2 },
  { name: 'Bright Treble', b: -3, m: 1, t: 6 },
  { name: 'Warm / Deep', b: 4, m: -2, t: -2 },
];

export function EQSection({ bass, mid, treble, onBassChange, onMidChange, onTrebleChange }: EQSectionProps) {
  const isModified = bass !== 0 || (mid ?? 0) !== 0 || treble !== 0;

  const handleApplyPreset = (b: number, m: number, t: number) => {
    onBassChange(b);
    onMidChange(m);
    onTrebleChange(t);
  };

  return (
    <div className="bg-[var(--theme-bg-card)] rounded-xl border border-[var(--theme-border)] p-3 space-y-3 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold text-[var(--theme-text-primary)] uppercase tracking-wider">Equalizer (EQ)</span>
          {isModified && (
            <span className="text-[8px] bg-amber-500/20 text-amber-400 px-1.5 py-0.2 rounded-full font-semibold uppercase">
              ACTIVE
            </span>
          )}
        </div>
        {isModified && (
          <button
            type="button"
            onClick={() => handleApplyPreset(0, 0, 0)}
            title="Reset EQ to 0 dB"
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* EQ Presets */}
      <div className="space-y-1">
        <span className="text-[10px] font-medium text-[var(--theme-text-muted)] flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-amber-400" />
          <span>Presets</span>
        </span>
        <div className="grid grid-cols-3 gap-1">
          {EQ_PRESETS.map((p) => {
            const isSelected = bass === p.b && (mid ?? 0) === p.m && treble === p.t;
            return (
              <button
                key={p.name}
                type="button"
                onClick={() => handleApplyPreset(p.b, p.m, p.t)}
                className={`px-1.5 py-1 rounded text-[9px] font-medium transition-colors border text-center truncate ${
                  isSelected
                    ? 'bg-amber-500/20 border-amber-500/60 text-amber-300 font-semibold shadow-sm'
                    : 'bg-[var(--theme-bg-subpanel)] border-[var(--theme-border)] text-[var(--theme-text-muted)] hover:text-white hover:border-amber-500/30'
                }`}
                title={`${p.name}: Bass ${p.b > 0 ? `+${p.b}` : p.b}dB, Mid ${p.m > 0 ? `+${p.m}` : p.m}dB, Treble ${p.t > 0 ? `+${p.t}` : p.t}dB`}
              >
                {p.name}
              </button>
            );
          })}
        </div>
      </div>
      
      <AudioSlider
        label="Bass"
        value={bass}
        min={-15}
        max={15}
        onChange={onBassChange}
        formatValue={(v) => v > 0 ? `+${v}` : `${v}`}
      />
      
      <AudioSlider
        label="Mid"
        value={mid ?? 0}
        min={-15}
        max={15}
        onChange={onMidChange}
        formatValue={(v) => v > 0 ? `+${v}` : `${v}`}
      />
      
      <AudioSlider
        label="Treble"
        value={treble}
        min={-15}
        max={15}
        onChange={onTrebleChange}
        formatValue={(v) => v > 0 ? `+${v}` : `${v}`}
      />
    </div>
  );
}