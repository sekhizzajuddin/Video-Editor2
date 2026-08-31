interface PresetRampsSectionProps {
  isRamped: boolean;
  onSpeedChange: (val: number) => void;
}

export function PresetRampsSection({ isRamped, onSpeedChange }: PresetRampsSectionProps) {
  if (isRamped) return null;

  const presets = [
    { name: 'Slow Mo', speed: 0.3 },
    { name: 'Speed Up', speed: 2.0 },
    { name: 'Fast', speed: 3.0 },
    { name: 'Normal', speed: 1.0 },
  ];

  return (
    <div className="bg-[var(--theme-bg-card)] rounded-xl border border-[var(--theme-border)] p-3 shadow-sm">
      <span className="text-xs font-bold text-[var(--theme-text-primary)] block mb-2">Preset Ramps</span>
      <div className="grid grid-cols-2 gap-2">
        {presets.map((preset) => (
          <button
            key={preset.name}
            onClick={() => onSpeedChange(preset.speed)}
            className="px-2.5 py-2 bg-[var(--theme-bg-subpanel)] hover:bg-black/5 dark:hover:bg-white/5 border border-[var(--theme-border)] rounded-lg text-[10px] font-semibold text-[var(--theme-text-primary)] transition-all shadow-sm"
          >
            {preset.name} ({preset.speed}x)
          </button>
        ))}
      </div>
    </div>
  );
}