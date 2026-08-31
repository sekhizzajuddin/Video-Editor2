import { AudioSlider } from './AudioSlider';

interface EQSectionProps {
  bass: number;
  mid: number;
  treble: number;
  onBassChange: (val: number) => void;
  onMidChange: (val: number) => void;
  onTrebleChange: (val: number) => void;
}

export function EQSection({ bass, mid, treble, onBassChange, onMidChange, onTrebleChange }: EQSectionProps) {
  return (
    <div className="bg-[var(--theme-bg-card)] rounded-xl border border-[var(--theme-border)] p-3 space-y-3 shadow-sm">
      <span className="text-[10px] font-bold text-[var(--theme-text-primary)] uppercase tracking-wider">EQ</span>
      
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
        value={mid}
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