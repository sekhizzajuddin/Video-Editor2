import { AudioSlider } from './AudioSlider';

interface PanSectionProps {
  pan: number;
  onChange: (val: number) => void;
  onReset: () => void;
}

export function PanSection({ pan, onChange, onReset }: PanSectionProps) {
  const formatPan = (p: number) => {
    if (p === 0) return 'Center';
    return p > 0 ? `R ${Math.round(p * 100)}%` : `L ${Math.round(Math.abs(p) * 100)}%`;
  };

  return (
    <div className="bg-[var(--theme-bg-card)] rounded-xl border border-[var(--theme-border)] p-3 space-y-1.5 shadow-sm">
      <AudioSlider
        label="Pan"
        value={pan}
        min={-1}
        max={1}
        step={0.05}
        onChange={onChange}
        onReset={onReset}
        formatValue={formatPan}
        gradient="bg-gradient-to-r from-blue-500 via-[var(--theme-border)] to-indigo-500"
      />
    </div>
  );
}