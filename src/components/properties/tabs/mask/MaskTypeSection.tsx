interface MaskTypeSectionProps {
  maskType: string;
  onChange: (val: string) => void;
}

export function MaskTypeSection({ maskType, onChange }: MaskTypeSectionProps) {
  const types = ['rectangle', 'circle', 'split', 'filmstrip', 'heart', 'star', 'matte'];

  return (
    <div className="space-y-1">
      <label className="text-[10px] uppercase tracking-wider text-[#a0a0a0]">Mask Shape</label>
      <div className="grid grid-cols-4 gap-1.5">
        {types.map((t) => (
          <button
            key={t}
            onClick={() => onChange(t)}
            className={`p-2 rounded text-[9px] font-medium uppercase transition-colors border ${
              maskType === t
                ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                : 'bg-[#1e1e1e] border-[#3e3e3e] text-[#a0a0a0] hover:text-white hover:bg-[#2d2d2d]'
            }`}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}