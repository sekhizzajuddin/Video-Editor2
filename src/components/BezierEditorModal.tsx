import React, { useState } from 'react';
import { BezierCurveEditor } from './BezierCurveEditor';
import { BEZIER_PRESETS } from '@/utils/bezierPresets';
import { BezierControl } from '@/types';
import { X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  initialValue: BezierControl;
  onClose: () => void;
  onApply: (value: BezierControl) => void;
}

export const BezierEditorModal: React.FC<Props> = ({
  isOpen,
  initialValue,
  onClose,
  onApply
}) => {
  const [value, setValue] = useState<BezierControl>(initialValue);
  const [activeCategory, setActiveCategory] = useState<string>('all');

  if (!isOpen) return null;

  const categories = ['all', 'standard', 'smooth', 'sharp', 'bounce'];
  const filteredPresets = activeCategory === 'all' 
    ? BEZIER_PRESETS 
    : BEZIER_PRESETS.filter(p => p.category === activeCategory);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#1e1e1e] border border-[#3e3e3e] rounded-xl shadow-2xl w-[420px] max-w-[95vw] flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#3e3e3e]">
          <div>
            <h3 className="text-sm font-semibold text-white">Bezier Curve Editor</h3>
            <p className="text-[10px] text-[#888] mt-0.5">Drag handles to customize easing</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-[#3e3e3e] rounded-lg text-[#888] hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Editor */}
        <div className="p-4 flex flex-col items-center">
          <BezierCurveEditor
            value={value}
            onChange={setValue}
            width={320}
            height={280}
          />
        </div>

        {/* Presets */}
        <div className="px-4 pb-2">
          <div className="flex gap-1 mb-2 overflow-x-auto pb-1 scrollbar-thin">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-2.5 py-1 rounded text-[10px] font-medium capitalize whitespace-nowrap transition-colors ${
                  activeCategory === cat
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'bg-[#2a2a2a] text-[#888] border border-[#3e3e3e] hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          
          <div className="grid grid-cols-3 gap-1.5 max-h-32 overflow-y-auto p-1 scrollbar-thin">
            {filteredPresets.map(preset => (
              <button
                key={preset.name}
                onClick={() => setValue(preset.value)}
                className={`px-2 py-1.5 rounded border text-left transition-all ${
                  Math.abs((value.x) - preset.value.x) < 0.01 && 
                  Math.abs((value.y) - preset.value.y) < 0.01
                    ? 'bg-amber-500/10 border-amber-500/40 text-amber-400'
                    : 'bg-[#252525] border-[#3e3e3e] text-[#aaa] hover:border-[#555] hover:text-white'
                }`}
                title={preset.description}
              >
                <div className="text-[10px] font-medium truncate">{preset.name}</div>
                <div className="text-[8px] text-[#666] truncate">{preset.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-[#3e3e3e] flex gap-2">
          <button
            onClick={() => setValue({ x: 0.5, y: 0, inX: 0.5, inY: 1 })}
            className="px-3 py-1.5 text-[11px] text-[#888] hover:text-white bg-[#2a2a2a] hover:bg-[#333] border border-[#3e3e3e] rounded transition-colors"
          >
            Reset
          </button>
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-[11px] text-[#aaa] hover:text-white bg-[#2a2a2a] hover:bg-[#333] border border-[#3e3e3e] rounded transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onApply(value);
              onClose();
            }}
            className="px-4 py-1.5 text-[11px] font-medium text-black bg-amber-500 hover:bg-amber-400 rounded transition-colors"
          >
            Apply Easing
          </button>
        </div>
      </div>
    </div>
  );
};
