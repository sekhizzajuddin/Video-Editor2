interface TextShadowSectionProps {
  shadow: boolean;
  onToggle: () => void;
}

export function TextShadowSection({ shadow, onToggle }: TextShadowSectionProps) {
  return (
    <div className="flex items-center justify-between p-3 bg-[var(--theme-bg-subpanel)] rounded-xl border border-[var(--theme-border)] shadow-sm">
      <span className="text-xs text-[var(--theme-text-primary)] font-semibold">Shadow</span>
      <button
        onClick={onToggle}
        className={`w-10 h-5 rounded-full transition-colors relative ${shadow ? 'bg-blue-600' : 'bg-[var(--theme-bg-card)] border border-[var(--theme-border)]'}`}
      >
        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow-sm ${shadow ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </div>
  );
}