interface MaskSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  prop: string;
  onChange: (prop: string, val: number) => void;
}

export function MaskSlider({ label, value, min, max, unit, prop, onChange }: MaskSliderProps) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center text-[11px]">
        <span className="text-[var(--theme-text-primary)]">{label}</span>
        <span className="font-mono text-[var(--theme-text-muted)]">{value}{unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(prop, Number(e.target.value))}
        onMouseUp={() => {}}
        className="w-full h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
      />
    </div>
  );
}