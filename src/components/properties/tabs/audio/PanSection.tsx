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
    <div className="bg-[#2d2d2d] rounded border border-[#3e3e3e] p-2.5 space-y-1.5">
      <AudioSlider
        label="Pan"
        value={pan}
        min={-1}
        max={1}
        step={0.05}
        onChange={onChange}
        onReset={onReset}
        formatValue={formatPan}
        gradient="bg-gradient-to-r from-cyan-500 via-[#3e3e3e] to-amber-500"
      />
    </div>
  );
}