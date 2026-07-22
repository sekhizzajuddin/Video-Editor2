interface TextShadowSectionProps {
  shadow: boolean;
  onToggle: () => void;
}

export function TextShadowSection({ shadow, onToggle }: TextShadowSectionProps) {
  return (
    <div className="flex items-center justify-between p-3 bg-[#1e1e1e] rounded-md border border-[#3e3e3e]">
      <span className="text-xs text-[#a0a0a0]">Shadow</span>
      <button
        onClick={onToggle}
        className={`w-10 h-5 rounded-full transition-colors relative ${shadow ? 'bg-amber-500' : 'bg-[#3e3e3e]'}`}
      >
        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${shadow ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </div>
  );
}