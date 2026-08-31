interface MaskEnableSectionProps {
  enabled: boolean;
  onToggle: () => void;
}

export function MaskEnableSection({ enabled, onToggle }: MaskEnableSectionProps) {
  return (
    <div className="flex items-center justify-between p-3 bg-[var(--theme-bg-subpanel)] rounded-md border border-[var(--theme-border)]">
      <span className="text-xs text-[var(--theme-text-muted)]">Enable Masking</span>
      <button
        onClick={onToggle}
        className={`w-10 h-5 rounded-full transition-colors relative ${enabled ? 'bg-amber-500' : 'bg-[#3e3e3e]'}`}
      >
        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${enabled ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </div>
  );
}