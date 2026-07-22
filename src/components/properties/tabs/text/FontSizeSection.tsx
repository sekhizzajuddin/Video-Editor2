interface FontSizeSectionProps {
  fontSize: number;
  onChange: (val: number) => void;
}

export function FontSizeSection({ fontSize, onChange }: FontSizeSectionProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] text-[#a0a0a0] uppercase tracking-wider">Font Size</label>
      <input
        type="number"
        min={8}
        max={200}
        value={fontSize || 48}
        onChange={(e) => onChange(Number(e.target.value))}
        className="bg-[#1e1e1e] text-white text-xs border border-[#3e3e3e] rounded p-2 focus:outline-none focus:border-amber-500"
      />
    </div>
  );
}