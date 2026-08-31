interface TextColorSectionProps {
  color: string;
  onChange: (val: string) => void;
}

export function TextColorSection({ color, onChange }: TextColorSectionProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] text-[var(--theme-text-muted)] font-semibold uppercase tracking-wider">Color</label>
      <input
        type="color"
        value={color || '#ffffff'}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-9 rounded-xl cursor-pointer bg-[var(--theme-bg-subpanel)] border border-[var(--theme-border)] p-1 shadow-sm"
      />
    </div>
  );
}