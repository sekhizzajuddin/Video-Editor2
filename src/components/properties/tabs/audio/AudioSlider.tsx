interface AudioSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (val: number) => void;
  onReset?: () => void;
  formatValue?: (val: number) => string;
  gradient?: string;
}

export function AudioSlider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  onReset,
  formatValue,
  gradient,
}: AudioSliderProps) {
  const displayValue = formatValue ? formatValue(value) : value.toString();
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <label className="text-[10px] text-[var(--theme-text-muted)] font-medium">{label}</label>
        <span className="text-[10px] font-mono text-[var(--theme-text-primary)]">{displayValue}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onDoubleClick={() => onReset && onReset()}
        className={`w-full h-1 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-blue-600 [&::-webkit-slider-thumb]:rounded-full ${gradient || 'bg-[var(--theme-border)]'}`}
      />
    </div>
  );
}