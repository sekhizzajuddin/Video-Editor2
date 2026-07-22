import { TEXT_TEMPLATES } from '@/utils/textTemplates';
import { toast } from 'sonner';
import type { Clip } from '@/types';

interface TextTabProps {
  selectedClip: Clip;
  updateClip: (clipId: string, updates: any) => void;
}

export function TextTab({ selectedClip, updateClip }: TextTabProps) {
  if (!selectedClip.textSettings) return null;

  return (
    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-white uppercase tracking-wider">Text Properties</h3>
      </div>
      
      <div className="flex flex-col gap-4">
        {/* Content */}
        <div className="flex flex-col gap-2">
          <label className="text-xs text-[#a0a0a0]">Content</label>
          <textarea
            value={selectedClip.textSettings.text}
            onChange={(e) => updateClip(selectedClip.id, { textSettings: { ...selectedClip.textSettings!, text: e.target.value } })}
            onBlur={() => {}}
            className="bg-[#1e1e1e] text-white text-xs border border-[#3e3e3e] rounded p-2 min-h-[60px] resize-none focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* Style Presets */}
        <div className="flex flex-col gap-2">
          <label className="text-xs text-[#a0a0a0]">Style Presets</label>
          <div className="grid grid-cols-2 gap-1.5 max-h-[160px] overflow-y-auto p-1.5 border border-[#3e3e3e]/40 rounded bg-[#181818] scrollbar-thin">
            {TEXT_TEMPLATES.map((tmpl) => (
              <button
                key={tmpl.name}
                onClick={() => {
                  updateClip(selectedClip.id, {
                    textSettings: {
                      ...selectedClip.textSettings!,
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

        {/* Font Family */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] text-[#a0a0a0] uppercase tracking-wider">Font Family</label>
          <select
            value={selectedClip.textSettings.fontFamily || 'Arial'}
            onChange={(e) => updateClip(selectedClip.id, { textSettings: { ...selectedClip.textSettings!, fontFamily: e.target.value } })}
            className="bg-[#1e1e1e] text-white text-xs border border-[#3e3e3e] rounded p-2 focus:outline-none focus:border-amber-500"
          >
            <option value="Arial">Arial</option>
            <option value="Helvetica">Helvetica</option>
            <option value="Times New Roman">Times New Roman</option>
            <option value="Georgia">Georgia</option>
            <option value="Verdana">Verdana</option>
            <option value="Impact">Impact</option>
            <option value="Comic Sans MS">Comic Sans MS</option>
            <option value="Roboto">Roboto</option>
            <option value="Open Sans">Open Sans</option>
            <option value="Lato">Lato</option>
          </select>
        </div>

        {/* Font Size */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] text-[#a0a0a0] uppercase tracking-wider">Font Size</label>
          <input
            type="number"
            min={8}
            max={200}
            value={selectedClip.textSettings.fontSize || 48}
            onChange={(e) => updateClip(selectedClip.id, { textSettings: { ...selectedClip.textSettings!, fontSize: Number(e.target.value) } })}
            className="bg-[#1e1e1e] text-white text-xs border border-[#3e3e3e] rounded p-2 focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* Color */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] text-[#a0a0a0] uppercase tracking-wider">Color</label>
          <input
            type="color"
            value={selectedClip.textSettings.color || '#ffffff'}
            onChange={(e) => updateClip(selectedClip.id, { textSettings: { ...selectedClip.textSettings!, color: e.target.value } })}
            className="w-full h-8 rounded cursor-pointer bg-[#1e1e1e] border border-[#3e3e3e]"
          />
        </div>

        {/* Text Style Toggles */}
        <div className="flex flex-col gap-2">
          <label className="text-[10px] text-[#a0a0a0] uppercase tracking-wider">Style</label>
          <div className="flex gap-2">
            <button
              onClick={() => updateClip(selectedClip.id, { textSettings: { ...selectedClip.textSettings!, bold: !selectedClip.textSettings.bold } })}
              className={`flex-1 py-1.5 px-3 rounded text-[11px] font-medium transition-colors border ${
                selectedClip.textSettings.bold
                  ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                  : 'bg-[#1e1e1e] border-[#3e3e3e] text-[#a0a0a0] hover:text-white'
              }`}
            >
              Bold
            </button>
            <button
              onClick={() => updateClip(selectedClip.id, { textSettings: { ...selectedClip.textSettings!, italic: !selectedClip.textSettings.italic } })}
              className={`flex-1 py-1.5 px-3 rounded text-[11px] font-medium transition-colors border ${
                selectedClip.textSettings.italic
                  ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                  : 'bg-[#1e1e1e] border-[#3e3e3e] text-[#a0a0a0] hover:text-white'
              }`}
            >
              Italic
            </button>
            <button
              onClick={() => updateClip(selectedClip.id, { textSettings: { ...selectedClip.textSettings!, underline: !selectedClip.textSettings.underline } })}
              className={`flex-1 py-1.5 px-3 rounded text-[11px] font-medium transition-colors border ${
                selectedClip.textSettings.underline
                  ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                  : 'bg-[#1e1e1e] border-[#3e3e3e] text-[#a0a0a0] hover:text-white'
              }`}
            >
              Underline
            </button>
          </div>
        </div>

        {/* Shadow */}
        <div className="flex items-center justify-between p-3 bg-[#1e1e1e] rounded-md border border-[#3e3e3e]">
          <span className="text-xs text-[#a0a0a0]">Shadow</span>
          <button
            onClick={() => updateClip(selectedClip.id, { textSettings: { ...selectedClip.textSettings!, shadow: !selectedClip.textSettings.shadow } })}
            className={`w-10 h-5 rounded-full transition-colors relative ${selectedClip.textSettings.shadow ? 'bg-amber-500' : 'bg-[#3e3e3e]'}`}
          >
            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${selectedClip.textSettings.shadow ? 'left-[22px]' : 'left-0.5'}`} />
          </button>
        </div>
      </div>
    </div>
  );
}