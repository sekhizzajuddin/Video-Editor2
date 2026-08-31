interface TextContentSectionProps {
  text: string;
  onChange: (val: string) => void;
}

export function TextContentSection({ text, onChange }: TextContentSectionProps) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs text-muted-foreground">Content</label>
      <textarea
        value={text}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => {}}
        className="bg-card text-foreground text-xs border border-border rounded p-2 min-h-[60px] resize-none focus:outline-none focus:border-amber-500"
      />
    </div>
  );
}