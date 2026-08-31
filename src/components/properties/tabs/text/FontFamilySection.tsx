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
        <label className="text-[10px] text-[var(--theme-text-muted)] font-semibold uppercase tracking-wider">Font Family</label>
        <label className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-lg text-[10px] text-blue-600 dark:text-blue-400 font-bold cursor-pointer transition-all shadow-sm">
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
        className="bg-[var(--theme-bg-subpanel)] text-[var(--theme-text-primary)] text-xs border border-[var(--theme-border)] rounded-xl p-2.5 focus:outline-none focus:border-blue-500 shadow-sm"
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
          <p className="text-[9px] text-[var(--theme-text-muted)] font-semibold uppercase tracking-wider">Manage Custom Fonts</p>
          {customFonts.map((font) => (
            <div
              key={font.family}
              className="flex items-center gap-2 px-2.5 py-1.5 bg-[var(--theme-bg-subpanel)] border border-[var(--theme-border)] rounded-lg text-[10px] text-[var(--theme-text-primary)]"
            >
              <Type className="w-3.5 h-3.5 text-blue-500" />
              <span className="flex-1 truncate" style={{ fontFamily: font.family }}>
                {font.family}
              </span>
              <button
                onClick={() => handleRemove(font.family)}
                className="text-rose-500 hover:text-rose-400 p-1 transition-colors"
                title="Remove font"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
