import { TEXT_BACKGROUNDS } from '@/utils/textBackgrounds';

interface TextBackgroundSectionProps {
  backgroundColor?: string;
  backgroundStyle?: string;
  onChangeColor: (val: string) => void;
  onChangeStyle: (val: string) => void;
}

export function TextBackgroundSection({ backgroundColor, backgroundStyle, onChangeColor, onChangeStyle }: TextBackgroundSectionProps) {
  const bgColor = backgroundColor && backgroundColor !== 'transparent' ? backgroundColor : '#000000';
  const isEnabled = backgroundColor && backgroundColor !== 'transparent';

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-[var(--theme-text-primary)]">Background Style</label>
        <label className="relative inline-flex items-center cursor-pointer">
          <input 
            type="checkbox" 
            className="sr-only peer"
            checked={!!isEnabled}
            onChange={(e) => {
              if (e.target.checked) onChangeColor('#000000');
              else onChangeColor('transparent');
            }}
          />
          <div className="w-8 h-4 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-500"></div>
        </label>
      </div>
      
      {isEnabled && (
        <div className="flex flex-col gap-3 mt-1">
          <div className="flex gap-2 items-center">
            <span className="text-xs text-[var(--theme-text-secondary)] w-14">Color</span>
            <input 
              type="color" 
              value={bgColor.startsWith('rgba') ? '#000000' : bgColor} 
              onChange={(e) => onChangeColor(e.target.value)} 
              className="w-full h-8 bg-transparent cursor-pointer rounded overflow-hidden" 
            />
          </div>
          
          <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
            {TEXT_BACKGROUNDS.map((bg) => (
              <button
                key={bg.id}
                onClick={() => onChangeStyle(bg.id)}
                className={`flex flex-col items-center justify-center p-2 rounded-md border text-xs transition-colors ${backgroundStyle === bg.id || (!backgroundStyle && bg.id === 'solid_pill') ? 'bg-indigo-500/20 border-indigo-500 text-white' : 'bg-[var(--theme-bg-secondary)] border-transparent text-[var(--theme-text-secondary)] hover:bg-[var(--theme-bg-hover)]'}`}
                title={bg.name}
              >
                <div className="truncate w-full text-center">{bg.name}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
