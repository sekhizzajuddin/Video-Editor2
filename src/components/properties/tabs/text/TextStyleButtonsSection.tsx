interface TextStyleButtonsSectionProps {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  onBoldToggle: () => void;
  onItalicToggle: () => void;
  onUnderlineToggle: () => void;
}

export function TextStyleButtonsSection({ bold, italic, underline, onBoldToggle, onItalicToggle, onUnderlineToggle }: TextStyleButtonsSectionProps) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Style</label>
      <div className="flex gap-2">
        <button
          onClick={onBoldToggle}
          className={`flex-1 py-1.5 px-3 rounded text-[11px] font-medium transition-colors border ${
            bold
              ? 'bg-amber-500/20 border-amber-500 text-amber-400'
              : 'bg-card border-border text-muted-foreground hover:text-foreground'
          }`}
        >
          Bold
        </button>
        <button
          onClick={onItalicToggle}
          className={`flex-1 py-1.5 px-3 rounded text-[11px] font-medium transition-colors border ${
            italic
              ? 'bg-amber-500/20 border-amber-500 text-amber-400'
              : 'bg-card border-border text-muted-foreground hover:text-foreground'
          }`}
        >
          Italic
        </button>
        <button
          onClick={onUnderlineToggle}
          className={`flex-1 py-1.5 px-3 rounded text-[11px] font-medium transition-colors border ${
            underline
              ? 'bg-amber-500/20 border-amber-500 text-amber-400'
              : 'bg-card border-border text-muted-foreground hover:text-foreground'
          }`}
        >
          Underline
        </button>
      </div>
    </div>
  );
}