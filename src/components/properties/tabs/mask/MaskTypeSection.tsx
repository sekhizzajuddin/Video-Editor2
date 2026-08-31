interface MaskTypeSectionProps {
  maskType: string;
  onChange: (val: string) => void;
}

export function MaskTypeSection({ maskType, onChange }: MaskTypeSectionProps) {
  const types = ['rectangle', 'circle', 'split', 'filmstrip', 'heart', 'star', 'matte'];

  return (
    <div className="space-y-1">
      <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Mask Shape</label>
      <div className="grid grid-cols-4 gap-1.5">
        {types.map((t) => (
          <button
            key={t}
            onClick={() => onChange(t)}
            className={`p-2 rounded text-[9px] font-medium uppercase transition-colors border ${
              maskType === t
                ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                : 'bg-card border-border text-muted-foreground hover:text-foreground hover:bg-popover'
            }`}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}