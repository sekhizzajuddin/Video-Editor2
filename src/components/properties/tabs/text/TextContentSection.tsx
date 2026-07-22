interface TextContentSectionProps {
  text: string;
  onChange: (val: string) => void;
}

export function TextContentSection({ text, onChange }: TextContentSectionProps) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs text-[#a0a0a0]">Content</label>
      <textarea
        value={text}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => {}}
        className="bg-[#1e1e1e] text-white text-xs border border-[#3e3e3e] rounded p-2 min-h-[60px] resize-none focus:outline-none focus:border-amber-500"
      />
    </div>
  );
}