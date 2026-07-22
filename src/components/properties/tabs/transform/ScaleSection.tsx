import { RotateCcw, ChevronDown, ChevronRight } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { KeyframeControl, KeyframeMiniTimeline } from '@/components/KeyframeControls';
import { addOrUpdateKeyframe } from '@/utils/keyframes';
import type { Clip, ClipAnimations } from '@/types';

interface ScaleSectionProps {
  selectedClip: Clip;
  localTime: number;
  absoluteStartTime: number;
  animations: ClipAnimations;
  collapsedSections: Record<string, boolean>;
  toggleSection: (section: string) => void;
  getPropVal: (base: number, propKey: string) => number;
  setPropVal: (propKey: string, value: number, baseUpdateObj: any) => void;
  updateClip: (clipId: string, updates: any, options?: { ripple?: boolean }) => void;
}

export function ScaleSection({
  selectedClip,
  localTime,
  absoluteStartTime,
  animations,
  collapsedSections,
  toggleSection,
  getPropVal,
  setPropVal,
  updateClip,
}: ScaleSectionProps) {
  return (
    <div className="bg-[#2d2d2d] rounded border border-[#3e3e3e]">
      <button
        onClick={() => toggleSection('scale')}
        className="w-full flex items-center justify-between p-2.5 text-xs text-white group"
      >
        <span className="font-medium">Scale</span>
        <div className="flex items-center gap-2">
          <div
            onClick={(e) => {
              e.stopPropagation();
              setPropVal('transform.scale', 100, { transform: { ...selectedClip.transform, scale: 100 } });
              useEditorStore.getState().saveSnapshot();
            }}
            className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-[#4a4a4a] rounded transition-all"
            title="Reset Scale"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#a0a0a0] hover:text-white" />
          </div>
          {collapsedSections['scale'] ? (
            <ChevronRight className="w-3.5 h-3.5 text-[#a0a0a0]" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-[#a0a0a0]" />
          )}
        </div>
      </button>
      {!collapsedSections['scale'] && (
        <div className="px-2.5 pb-2.5 space-y-1.5">
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-[#a0a0a0]">Scale Multiplier</span>
            <KeyframeControl
              propertyKey="transform.scale"
              value={getPropVal(selectedClip.transform.scale, 'transform.scale')}
              keyframes={animations['transform.scale'] || []}
              currentTime={localTime}
              clipId={selectedClip.id}
              onAddKeyframe={(time, val) => {
                const newKf = addOrUpdateKeyframe(animations['transform.scale'] || [], time, val, { easing: 'bezier' });
                updateClip(selectedClip.id, {
                  animations: { ...animations, 'transform.scale': newKf }
                });
              }}
              onRemoveKeyframe={(time) => {
                const newKf = (animations['transform.scale'] || []).filter(k => Math.abs(k.time - time) > 0.03);
                updateClip(selectedClip.id, {
                  animations: { ...animations, 'transform.scale': newKf }
                });
              }}
              onUpdateEasing={(time, easing) => {
                const newKf = (animations['transform.scale'] || []).map(k => 
                  Math.abs(k.time - time) < 0.03 ? { ...k, easing } : k
                );
                updateClip(selectedClip.id, {
                  animations: { ...animations, 'transform.scale': newKf }
                });
              }}
              onJumpToNext={() => {
                const next = (animations['transform.scale'] || []).find(k => k.time > localTime + 0.05);
                if (next) useEditorStore.getState().seek(absoluteStartTime + next.time);
              }}
              onJumpToPrev={() => {
                const prev = [...(animations['transform.scale'] || [])].reverse().find(k => k.time < localTime - 0.05);
                if (prev) useEditorStore.getState().seek(absoluteStartTime + prev.time);
              }}
            />
          </div>
          <KeyframeMiniTimeline
            keyframes={animations['transform.scale'] || []}
            currentTime={localTime}
            duration={selectedClip.duration}
            onSeek={(t) => useEditorStore.getState().seek(absoluteStartTime + t)}
          />
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={10}
              max={400}
              value={getPropVal(selectedClip.transform.scale, 'transform.scale')}
              title="Double-click to reset to 100%"
              onChange={(e) => setPropVal('transform.scale', Number(e.target.value), { transform: { ...selectedClip.transform, scale: Number(e.target.value) } })}
              onMouseUp={() => useEditorStore.getState().saveSnapshot()}
              onDoubleClick={() => {
                setPropVal('transform.scale', 100, { transform: { ...selectedClip.transform, scale: 100 } });
                useEditorStore.getState().saveSnapshot();
              }}
              className="flex-1 h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
            />
            <span 
              className="text-[11px] text-white w-10 text-right cursor-pointer hover:text-amber-500 transition-colors"
              title="Click to cycle common values"
              onClick={() => {
                const steps = [10, 25, 50, 75, 100, 150, 200, 300, 400];
                const cur = getPropVal(selectedClip.transform.scale, 'transform.scale');
                let next = steps.find(s => s > cur) ?? steps[0];
                setPropVal('transform.scale', next, { transform: { ...selectedClip.transform, scale: next } });
                useEditorStore.getState().saveSnapshot();
              }}
            >
              {Math.round(getPropVal(selectedClip.transform.scale, 'transform.scale'))}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}