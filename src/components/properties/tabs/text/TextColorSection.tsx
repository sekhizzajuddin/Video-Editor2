interface TextColorSectionProps {
  color: string;
  onChange: (val: string) => void;
}

export function TextColorSection({ color, onChange }: TextColorSectionProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Color</label>
      <input
        type="color"
        value={color || '#ffffff'}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-8 rounded cursor-pointer bg-card border border-border"
      />
    </div>
  );
}