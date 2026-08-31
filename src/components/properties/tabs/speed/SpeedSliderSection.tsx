interface SpeedSliderSectionProps {
  speed: number;
  isRamped: boolean;
  isReversed?: boolean;
  freezeFrame?: number;
  onSpeedChange: (val: number) => void;
  onReset: () => void;
  onToggleReverse: () => void;
  onFreezeFrame: () => void;
  onClearFreeze: () => void;
}

export function SpeedSliderSection({
  speed,
  isRamped,
  isReversed,
  freezeFrame,
  onSpeedChange,
  onReset,
  onToggleReverse,
  onFreezeFrame,
  onClearFreeze,
}: SpeedSliderSectionProps) {
  return (
    <div className="bg-[var(--theme-bg-card)] rounded-xl border border-[var(--theme-border)] p-3 space-y-3 shadow-sm">
      <label className="text-xs text-[var(--theme-text-primary)] font-bold block">Speed</label>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={0.25}
          max={3}
          step={0.25}
          value={isRamped ? 1.0 : speed}
          disabled={isRamped || freezeFrame !== undefined}
          title={isRamped ? "Disable Speed Ramping to adjust flat speed" : freezeFrame !== undefined ? "Clear Freeze Frame to adjust speed" : "Double-click to reset to 1.0x"}
          onChange={(e) => onSpeedChange(Number(e.target.value))}
          onDoubleClick={onReset}
          className={`flex-1 h-1 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full ${
            isRamped || freezeFrame !== undefined
              ? 'bg-[var(--theme-bg-subpanel)] [&::-webkit-slider-thumb]:bg-[var(--theme-text-muted)] cursor-not-allowed opacity-50'
              : 'bg-[var(--theme-border)] [&::-webkit-slider-thumb]:bg-blue-600'
          }`}
        />
        <span className="text-[11px] text-[var(--theme-text-primary)] w-14 text-right select-none font-mono font-medium">
          {isRamped ? 'Ramped' : freezeFrame !== undefined ? 'Frozen' : `${speed.toFixed(2)}x`}
        </span>
      </div>

      {/* Reverse + Freeze Frame buttons */}
      <div className="flex gap-2 pt-0.5">
        <button
          onClick={onToggleReverse}
          disabled={freezeFrame !== undefined}
          title={isReversed ? "Click to play forward" : "Click to play backward"}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-bold transition-all ${
            isReversed
              ? 'bg-purple-600 text-white shadow-sm'
              : 'bg-[var(--theme-bg-subpanel)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)] border border-[var(--theme-border)]'
          } disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          <span className="text-[13px]">&#9194;</span> Reverse
        </button>

        {freezeFrame !== undefined ? (
          <button
            onClick={onClearFreeze}
            title={`Frozen at ${freezeFrame.toFixed(2)}s — click to unfreeze`}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-bold bg-blue-600 text-white hover:bg-blue-500 transition-all shadow-sm"
          >
            &#10052; Unfreeze
          </button>
        ) : (
          <button
            onClick={onFreezeFrame}
            disabled={isRamped}
            title="Freeze clip at current playhead position"
            className="flex-1 flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-bold bg-[var(--theme-bg-subpanel)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)] border border-[var(--theme-border)] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            &#10052; Freeze
          </button>
        )}
      </div>

      {freezeFrame !== undefined && (
        <div className="text-[10px] text-blue-500 font-medium text-center">
          Holding frame at {freezeFrame.toFixed(3)}s
        </div>
      )}
    </div>
  );
}