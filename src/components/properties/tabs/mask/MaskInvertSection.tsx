interface MaskInvertSectionProps {
  invert: boolean;
  onToggle: () => void;
}

export function MaskInvertSection({ invert, onToggle }: MaskInvertSectionProps) {
  return (
    <div className="flex items-center justify-between p-3 bg-[#1e1e1e] rounded-md border border-[#3e3e3e]">
      <span className="text-xs text-[#a0a0a0]">Invert Mask</span>
      <button
        onClick={onToggle}
        className={`w-10 h-5 rounded-full transition-colors relative ${invert ? 'bg-amber-500' : 'bg-[#3e3e3e]'}`}
      >
        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${invert ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </div>
  );
}