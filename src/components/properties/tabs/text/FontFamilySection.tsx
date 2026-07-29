import { useEffect, useState } from 'react';
import { Upload, Trash2, Type } from 'lucide-react';
import {
  addCustomFont,
  removeCustomFont,
  getCustomFonts,
  getAllAvailableFonts,
  restoreCustomFonts,
  type CustomFont,
} from '@/utils/fontManager';
import { toast } from 'sonner';

interface FontFamilySectionProps {
  fontFamily: string;
  onChange: (val: string) => void;
}

export function FontFamilySection({ fontFamily, onChange }: FontFamilySectionProps) {
  const [customFonts, setCustomFonts] = useState<CustomFont[]>([]);

  useEffect(() => {
    restoreCustomFonts().then(() => {
      setCustomFonts(getCustomFonts());
    });
  }, []);

  const handleUpload = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['ttf', 'otf', 'woff', 'woff2'].includes(ext || '')) {
      toast.error('Please upload .ttf, .otf, .woff, or .woff2 file');
      return;
    }
    try {
      const font = await addCustomFont(file);
      setCustomFonts(getCustomFonts());
      onChange(font.family);
      toast.success(`Loaded: ${font.family}`);
    } catch (err) {
      toast.error(`Failed to load font: ${(err as Error).message}`);
    }
  };

  const handleRemove = (family: string) => {
    if (window.confirm(`Remove font "${family}"?`)) {
      removeCustomFont(family);
      setCustomFonts(getCustomFonts());
      if (fontFamily === family) onChange('Arial');
      toast.success(`Removed: ${family}`);
    }
  };

  const allFonts = getAllAvailableFonts();

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label className="text-[10px] text-[#a0a0a0] uppercase tracking-wider">Font Family</label>
        <label className="flex items-center gap-1 px-2 py-0.5 bg-[#2a2a2a] hover:bg-[#3e3e3e] border border-[#3e3e3e] rounded text-[10px] text-amber-400 cursor-pointer transition-colors">
          <Upload className="w-3 h-3" />
          Upload
          <input
            type="file"
            accept=".ttf,.otf,.woff,.woff2"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file);
              e.target.value = '';
            }}
          />
        </label>
      </div>
      <select
        value={fontFamily || 'Arial'}
        onChange={(e) => onChange(e.target.value)}
        className="bg-[#1e1e1e] text-white text-xs border border-[#3e3e3e] rounded p-2 focus:outline-none focus:border-amber-500"
      >
        <optgroup label="System Fonts">
          {allFonts.filter((f) => !customFonts.find((c) => c.family === f)).map((font) => (
            <option key={font} value={font}>{font}</option>
          ))}
        </optgroup>
        {customFonts.length > 0 && (
          <optgroup label="Your Custom Fonts">
            {customFonts.map((font) => (
              <option key={font.family} value={font.family}>{font.family}</option>
            ))}
          </optgroup>
        )}
      </select>
      {customFonts.length > 0 && (
        <div className="flex flex-col gap-1 mt-1">
          <p className="text-[9px] text-[#6a6a6a] uppercase tracking-wider">Manage Custom Fonts</p>
          {customFonts.map((font) => (
            <div
              key={font.family}
              className="flex items-center gap-2 px-2 py-1 bg-[#1e1e1e] border border-[#3e3e3e] rounded text-[10px]"
            >
              <Type className="w-3 h-3 text-amber-400" />
              <span className="flex-1 truncate" style={{ fontFamily: font.family }}>
                {font.family}
              </span>
              <button
                onClick={() => handleRemove(font.family)}
                className="text-red-400 hover:text-red-300 transition-colors"
                title="Remove font"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
