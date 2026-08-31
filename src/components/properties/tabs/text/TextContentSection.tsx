interface TextContentSectionProps {
  text: string;
  onChange: (val: string) => void;
}

export function TextContentSection({ text, onChange }: TextContentSectionProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] text-[var(--theme-text-muted)] font-semibold uppercase tracking-wider">Content</label>
      <textarea
        value={text}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => {}}
        className="bg-[var(--theme-bg-subpanel)] text-[var(--theme-text-primary)] text-xs border border-[var(--theme-border)] rounded-xl p-3 min-h-[70px] resize-none focus:outline-none focus:border-blue-500 shadow-sm"
      />
    </div>
  );
}