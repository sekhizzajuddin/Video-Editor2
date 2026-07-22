interface FontFamilySectionProps {
  fontFamily: string;
  onChange: (val: string) => void;
}

export function FontFamilySection({ fontFamily, onChange }: FontFamilySectionProps) {
  const fonts = ['Arial', 'Helvetica', 'Times New Roman', 'Georgia', 'Verdana', 'Impact', 'Comic Sans MS', 'Roboto', 'Open Sans', 'Lato'];

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] text-[#a0a0a0] uppercase tracking-wider">Font Family</label>
      <select
        value={fontFamily || 'Arial'}
        onChange={(e) => onChange(e.target.value)}
        className="bg-[#1e1e1e] text-white text-xs border border-[#3e3e3e] rounded p-2 focus:outline-none focus:border-amber-500"
      >
        {fonts.map((font) => (
          <option key={font} value={font}>{font}</option>
        ))}
      </select>
    </div>
  );
}