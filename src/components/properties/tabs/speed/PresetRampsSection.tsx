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
    <div className="bg-popover rounded border border-border p-3">
      <span className="text-xs font-medium text-foreground block mb-2">Preset Ramps</span>
      <div className="grid grid-cols-2 gap-1.5">
        {presets.map((preset) => (
          <button
            key={preset.name}
            onClick={() => onSpeedChange(preset.speed)}
            className="px-2 py-1.5 bg-card hover:bg-accent border border-border rounded text-[10px] text-foreground transition-colors"
          >
            {preset.name} ({preset.speed}x)
          </button>
        ))}
      </div>
    </div>
  );
}