import { AudioSlider } from './AudioSlider';

interface VolumeSectionProps {
  volume: number;
  onChange: (val: number) => void;
  onReset: () => void;
}

export function VolumeSection({ volume, onChange, onReset }: VolumeSectionProps) {
  return (
    <div className="bg-[var(--theme-bg-card)] rounded-xl border border-[var(--theme-border)] p-3 space-y-1.5 shadow-sm">
      <AudioSlider
        label="Volume"
        value={volume}
        min={-40}
        max={12}
        step={0.5}
        onChange={onChange}
        onReset={onReset}
        formatValue={(v) => v > 0 ? `+${v.toFixed(1)}` : v.toFixed(1) + ' dB'}
      />
    </div>
  );
}