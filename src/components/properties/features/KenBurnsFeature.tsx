import React, { useState } from 'react';
import { ImageIcon, ChevronDown, ChevronRight } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { FeatureProps } from './types';
import { ClipKenBurnsSettings } from '@/types';

export const KenBurnsFeature = ({ clip }: FeatureProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const updateClip = useEditorStore((state) => state.updateClip);
  
  const kb = clip.kenBurns;
  const isKbEnabled = kb?.enabled ?? false;
  
  const defaultKb: ClipKenBurnsSettings = {
    enabled: false,
    startScale: 100, startPanX: 0, startPanY: 0,
    endScale: 120,   endPanX: 0,   endPanY: 0,
    easing: 'easeInOut',
  };
  
  const kbVal = kb || defaultKb;

  const updateKb = (patch: Partial<ClipKenBurnsSettings>) => {
    const merged = { ...kbVal, ...patch };
    
    // Constrain pan based on scale to prevent seeing edges
    const maxStartPan = Math.max(0, (merged.startScale - 100) / 2);
    merged.startPanX = Math.max(-maxStartPan, Math.min(maxStartPan, merged.startPanX));
    merged.startPanY = Math.max(-maxStartPan, Math.min(maxStartPan, merged.startPanY));

    const maxEndPan = Math.max(0, (merged.endScale - 100) / 2);
    merged.endPanX = Math.max(-maxEndPan, Math.min(maxEndPan, merged.endPanX));
    merged.endPanY = Math.max(-maxEndPan, Math.min(maxEndPan, merged.endPanY));

    updateClip(clip.id, { kenBurns: merged });
  };

  const KbSlider = ({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void }) => (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-[#a0a0a0] w-12">{label}</span>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        onMouseUp={() => useEditorStore.getState().saveSnapshot()}
        className="flex-1 h-1 bg-[#3e3e3e] rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-emerald-500 [&::-webkit-slider-thumb]:rounded-full"
      />
      <span className="text-[10px] font-mono text-[#d0d0d0] w-8 text-right">{Math.round(value)}</span>
    </div>
  );

  return (
    <div className="bg-[#2d2d2d] rounded border border-[#3e3e3e] mt-3">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-2.5 text-xs text-white group"
      >
        <div className="flex items-center gap-2">
          <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
          <span className="font-medium">Ken Burns Effect</span>
          {isKbEnabled && <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full font-semibold">ON</span>}
        </div>
        <div className="flex items-center gap-2">
          <div
            onClick={e => { e.stopPropagation(); updateKb({ enabled: !isKbEnabled }); useEditorStore.getState().saveSnapshot(); }}
            className="flex items-center gap-1 px-2 py-0.5 bg-[#1e1e1e] hover:bg-[#3e3e3e] border border-[#3e3e3e] rounded text-[10px] transition-colors"
            title={isKbEnabled ? 'Disable Ken Burns' : 'Enable Ken Burns'}
          >
            <span className={isKbEnabled ? 'text-emerald-400' : 'text-[#a0a0a0]'}>{isKbEnabled ? 'Enabled' : 'Enable'}</span>
          </div>
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-[#a0a0a0]" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-[#a0a0a0]" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="px-2.5 pb-3 space-y-3 border-t border-[#3e3e3e]/30 pt-2.5">
          {/* Start Frame */}
          <div className="space-y-2">
            <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">Start Frame</p>
            <KbSlider label="Scale" value={kbVal.startScale} min={100} max={300} step={1} onChange={v => updateKb({ startScale: v })} />
            <KbSlider label="Pan X" value={kbVal.startPanX} min={-((kbVal.startScale - 100) / 2)} max={(kbVal.startScale - 100) / 2} step={1} onChange={v => updateKb({ startPanX: v })} />
            <KbSlider label="Pan Y" value={kbVal.startPanY} min={-((kbVal.startScale - 100) / 2)} max={(kbVal.startScale - 100) / 2} step={1} onChange={v => updateKb({ startPanY: v })} />
          </div>

          <div className="h-px bg-[#3e3e3e]/50" />

          {/* End Frame */}
          <div className="space-y-2">
            <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">End Frame</p>
            <KbSlider label="Scale" value={kbVal.endScale} min={100} max={300} step={1} onChange={v => updateKb({ endScale: v })} />
            <KbSlider label="Pan X" value={kbVal.endPanX} min={-((kbVal.endScale - 100) / 2)} max={(kbVal.endScale - 100) / 2} step={1} onChange={v => updateKb({ endPanX: v })} />
            <KbSlider label="Pan Y" value={kbVal.endPanY} min={-((kbVal.endScale - 100) / 2)} max={(kbVal.endScale - 100) / 2} step={1} onChange={v => updateKb({ endPanY: v })} />
          </div>
          
          <div className="space-y-1 pt-1">
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-[#d0d0d0]">Easing</span>
            </div>
            <select
              value={kbVal.easing}
              onChange={(e) => {
                updateKb({ easing: e.target.value as any });
                useEditorStore.getState().saveSnapshot();
              }}
              className="w-full bg-[#1a1a1a] border border-[#3e3e3e] rounded p-1.5 text-xs text-white outline-none focus:border-emerald-500"
            >
              <option value="linear">Linear (Constant speed)</option>
              <option value="easeIn">Ease In (Start slow)</option>
              <option value="easeOut">Ease Out (End slow)</option>
              <option value="easeInOut">Ease In/Out (Smooth)</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
};
