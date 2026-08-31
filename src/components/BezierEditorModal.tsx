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
      <div className="bg-card border border-border rounded-xl shadow-2xl w-[420px] max-w-[95vw] flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Bezier Curve Editor</h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">Drag handles to customize easing</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-accent rounded-lg text-muted-foreground hover:text-foreground transition-colors"
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
                    : 'bg-secondary text-muted-foreground border border-border hover:text-foreground'
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
                    : 'bg-secondary border-border text-muted-foreground hover:border-border hover:text-foreground'
                }`}
                title={preset.description}
              >
                <div className="text-[10px] font-medium truncate">{preset.name}</div>
                <div className="text-[8px] text-muted-foreground/70 truncate">{preset.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-border flex gap-2">
          <button
            onClick={() => setValue({ x: 0.5, y: 0, inX: 0.5, inY: 1 })}
            className="px-3 py-1.5 text-[11px] text-muted-foreground hover:text-foreground bg-secondary hover:bg-accent border border-border rounded transition-colors"
          >
            Reset
          </button>
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-[11px] text-muted-foreground hover:text-foreground bg-secondary hover:bg-accent border border-border rounded transition-colors"
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
