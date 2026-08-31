interface ColorSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (val: number) => void;
  onReset?: () => void;
  formatValue?: (val: number) => string;
  gradient?: string;
  title?: string;
}

export function ColorSlider({ 
  label, 
  value, 
  min, 
  max, 
  onChange, 
  onReset, 
  formatValue,
  gradient,
  title 
}: ColorSliderProps) {
  const displayValue = formatValue ? formatValue(value) : value.toString();
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center text-[11px]">
        <span className="text-[var(--theme-text-primary)] font-medium">{label}</span>
        <span className="font-mono text-[var(--theme-text-muted)] text-[10px]">{displayValue}</span>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          onMouseUp={() => {}}
          onDoubleClick={() => onReset && onReset()}
          title={title || "Double-click to reset"}
          className={`flex-1 h-1 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-blue-600 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow ${gradient || 'bg-[var(--theme-border)]'}`}
        />
      </div>
    </div>
  );
}