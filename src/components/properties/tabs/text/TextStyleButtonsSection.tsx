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
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] text-[var(--theme-text-muted)] font-semibold uppercase tracking-wider">Style</label>
      <div className="flex gap-2">
        <button
          onClick={onBoldToggle}
          className={`flex-1 py-2 px-3 rounded-lg text-[11px] font-bold transition-all border ${
            bold
              ? 'bg-blue-500/15 border-blue-500 text-blue-600 dark:text-blue-400 shadow-sm'
              : 'bg-[var(--theme-bg-subpanel)] border-[var(--theme-border)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)]'
          }`}
        >
          Bold
        </button>
        <button
          onClick={onItalicToggle}
          className={`flex-1 py-2 px-3 rounded-lg text-[11px] font-bold transition-all border ${
            italic
              ? 'bg-blue-500/15 border-blue-500 text-blue-600 dark:text-blue-400 shadow-sm'
              : 'bg-[var(--theme-bg-subpanel)] border-[var(--theme-border)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)]'
          }`}
        >
          Italic
        </button>
        <button
          onClick={onUnderlineToggle}
          className={`flex-1 py-2 px-3 rounded-lg text-[11px] font-bold transition-all border ${
            underline
              ? 'bg-blue-500/15 border-blue-500 text-blue-600 dark:text-blue-400 shadow-sm'
              : 'bg-[var(--theme-bg-subpanel)] border-[var(--theme-border)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)]'
          }`}
        >
          Underline
        </button>
      </div>
    </div>
  );
}