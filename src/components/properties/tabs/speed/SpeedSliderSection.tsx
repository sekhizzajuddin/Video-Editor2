interface SpeedSliderSectionProps {
  speed: number;
  isRamped: boolean;
  onSpeedChange: (val: number) => void;
  onReset: () => void;
}

export function SpeedSliderSection({ speed, isRamped, onSpeedChange, onReset }: SpeedSliderSectionProps) {
  return (
    <div className="bg-[#2d2d2d] rounded border border-[#3e3e3e] p-2.5">
      <label className="text-xs text-white font-medium block mb-2">Speed</label>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={0.25}
          max={3}
          step={0.25}
          value={isRamped ? 1.0 : speed}
          disabled={isRamped}
          title={isRamped ? "Disable Speed Ramping to adjust flat speed" : "Double-click to reset to 1.0x"}
          onChange={(e) => onSpeedChange(Number(e.target.value))}
          onDoubleClick={onReset}
          className={`flex-1 h-1 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full ${
            isRamped
              ? 'bg-[#222] [&::-webkit-slider-thumb]:bg-[#444] cursor-not-allowed'
              : 'bg-[#3e3e3e] [&::-webkit-slider-thumb]:bg-amber-500'
          }`}
        />
        <span className="text-[11px] text-white w-12 text-right select-none font-mono">
          {isRamped ? 'Ramped' : `${speed.toFixed(2)}x`}
        </span>
      </div>
    </div>
  );
}