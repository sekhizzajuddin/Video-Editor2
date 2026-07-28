import { RotateCcw, ChevronDown, ChevronRight } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { KeyframeControl, KeyframeMiniTimeline } from '@/components/KeyframeControls';
import { addOrUpdateKeyframe } from '@/utils/keyframes';
import type { TimelineClip, ClipAnimations } from '@/types';
import { scheduleSaveSnapshot } from '@/utils/snapshotScheduler';

interface OpacitySectionProps {
  selectedClip: TimelineClip;
  localTime: number;
  absoluteStartTime: number;
  animations: ClipAnimations;
  collapsedSections: Record<string, boolean>;
  toggleSection: (section: string) => void;
  getPropVal: (base: number, propKey: string) => number;
  setPropVal: (propKey: string, value: number, baseUpdateObj: any) => void;
  updateClip: (clipId: string, updates: any, options?: { ripple?: boolean }) => void;
}

export function OpacitySection({
  selectedClip,
  localTime,
  absoluteStartTime,
  animations,
  collapsedSections,
  toggleSection,
  getPropVal,
  setPropVal,
  updateClip,
}: OpacitySectionProps) {
  return (
    <div className="bg-[#2d2d2d] rounded border border-[#3e3e3e]">
      <button
        onClick={() => toggleSection('opacity')}
        className="w-full flex items-center justify-between p-2.5 text-xs text-white group"
      >
        <span className="font-medium">Opacity</span>
        <div className="flex items-center gap-2">
          <div
            onClick={(e) => {
              e.stopPropagation();
              setPropVal('opacity', 1, { opacity: 1 });
              scheduleSaveSnapshot();
            }}
            className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-[#4a4a4a] rounded transition-all"
            title="Reset Opacity"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#a0a0a0] hover:text-white" />
          </div>
          {collapsedSections['opacity'] ? (
            <ChevronRight className="w-3.5 h-3.5 text-[#a0a0a0]" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-[#a0a0a0]" />
          )}
        </div>
      </button>
      {!collapsedSections['opacity'] && (
        <div className="px-2.5 pb-2.5 space-y-1.5">
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-[#a0a0a0]">Opacity Value</span>
            <KeyframeControl
              propertyKey="opacity"
              value={getPropVal(selectedClip.opacity ?? 1, 'opacity')}
              keyframes={animations['opacity'] || []}
              currentTime={localTime}
              clipId={selectedClip.id}
              onAddKeyframe={(time, val) => {
                const newKf = addOrUpdateKeyframe(animations['opacity'] || [], time, val, { easing: 'bezier' });
                updateClip(selectedClip.id, {
                  animations: { ...animations, opacity: newKf }
                });
              }}
              onRemoveKeyframe={(time) => {
                const newKf = (animations['opacity'] || []).filter(k => Math.abs(k.time - time) > 0.03);
                updateClip(selectedClip.id, {
                  animations: { ...animations, opacity: newKf }
                });
              }}
              onUpdateEasing={(time, easing) => {
                const newKf = (animations['opacity'] || []).map(k => 
                  Math.abs(k.time - time) < 0.03 ? { ...k, easing } : k
                );
                updateClip(selectedClip.id, {
                  animations: { ...animations, opacity: newKf }
                });
              }}
              onJumpToNext={() => {
                const next = (animations['opacity'] || []).find(k => k.time > localTime + 0.05);
                if (next) useEditorStore.getState().seek(absoluteStartTime + next.time);
              }}
              onJumpToPrev={() => {
                const prev = [...(animations['opacity'] || [])].reverse().find(k => k.time < localTime - 0.05);
                if (prev) useEditorStore.getState().seek(absoluteStartTime + prev.time);
              }}
            />
          </div>
          <KeyframeMiniTimeline
            keyframes={animations['opacity'] || []}
            currentTime={localTime}
            duration={selectedClip.duration}
            onSeek={(t) => useEditorStore.getState().seek(absoluteStartTime + t)}
          />
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={getPropVal(selectedClip.opacity ?? 1, 'opacity')}
              title="Double-click to reset to 100%"
              onChange={(e) => setPropVal('opacity', Number(e.target.value), { opacity: Number(e.target.value) })}
              onMouseUp={() => scheduleSaveSnapshot()}
              onDoubleClick={() => {
                setPropVal('opacity', 1, { opacity: 1 });
                scheduleSaveSnapshot();
              }}
              className="flex-1 h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
            />
            <span 
              className="text-[11px] text-white w-10 text-right cursor-pointer hover:text-amber-500 transition-colors"
              title="Click to cycle values"
              onClick={() => {
                const steps = [0, 25, 50, 75, 100];
                const cur = Math.round(getPropVal(selectedClip.opacity ?? 1, 'opacity') * 100);
                let next = steps.find(s => s > cur) ?? steps[0];
                setPropVal('opacity', next / 100, { opacity: next / 100 });
                scheduleSaveSnapshot();
              }}
            >
              {Math.round(getPropVal(selectedClip.opacity ?? 1, 'opacity') * 100)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}