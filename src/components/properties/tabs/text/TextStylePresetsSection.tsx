import { TEXT_TEMPLATES, presetToTextAnimationPatch } from '@/utils/textTemplates';
import { toast } from 'sonner';

interface TextStylePresetsSectionProps {
  textSettings: any;
  clipId: string;
  updateClip: (clipId: string, updates: any) => void;
}

export function TextStylePresetsSection({ textSettings, clipId, updateClip }: TextStylePresetsSectionProps) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs text-[#a0a0a0]">Style Presets</label>
      <div className="grid grid-cols-2 gap-1.5 max-h-[160px] overflow-y-auto p-1.5 border border-[#3e3e3e]/40 rounded bg-[#181818] scrollbar-thin">
        {TEXT_TEMPLATES.map((tmpl) => (
          <button
            key={tmpl.name}
            onClick={() => {
              updateClip(clipId, {
                textSettings: {
                  ...textSettings,
                  fontSize: tmpl.settings.fontSize,
                  fontFamily: tmpl.settings.fontFamily,
                  color: tmpl.settings.color,
                  bold: tmpl.settings.bold || false,
                  italic: tmpl.settings.italic || false,
                  underline: tmpl.settings.underline || false,
                  shadow: tmpl.settings.shadow || false,
                  backgroundColor: tmpl.settings.backgroundColor || 'transparent',
                  strokeColor: tmpl.settings.strokeColor || undefined,
                  strokeWidth: tmpl.settings.strokeWidth || undefined,
                  animationPreset: tmpl.settings.animationPreset || undefined,
                  ...presetToTextAnimationPatch(tmpl.settings.animationPreset),
                }
              });
              toast.success(`Applied style "${tmpl.name}"`);
            }}
            className="p-2 bg-[#2d2d2d] hover:bg-[#3e3e3e] border border-[#3e3e3e] rounded text-left truncate transition-colors text-[10px] text-white flex items-center justify-center font-semibold"
            title={tmpl.name}
          >
            <span className={tmpl.style} style={{ fontSize: '10px' }}>{tmpl.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}