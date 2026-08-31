interface FontSizeSectionProps {
  fontSize: number;
  onChange: (val: number) => void;
}

export function FontSizeSection({ fontSize, onChange }: FontSizeSectionProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] text-[var(--theme-text-muted)] font-semibold uppercase tracking-wider">Font Size</label>
      <input
        type="number"
        min={8}
        max={200}
        value={fontSize || 48}
        onChange={(e) => onChange(Number(e.target.value))}
        className="bg-[var(--theme-bg-subpanel)] text-[var(--theme-text-primary)] text-xs border border-[var(--theme-border)] rounded-xl p-2.5 focus:outline-none focus:border-blue-500 shadow-sm"
      />
    </div>
  );
}