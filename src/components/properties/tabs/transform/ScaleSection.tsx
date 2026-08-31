import { RotateCcw, ChevronDown, ChevronRight } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { KeyframeControl, KeyframeMiniTimeline } from '@/components/KeyframeControls';
import { addOrUpdateKeyframe } from '@/utils/keyframes';
import type { TimelineClip, ClipAnimations } from '@/types';
import { scheduleSaveSnapshot } from '@/utils/snapshotScheduler';

interface ScaleSectionProps {
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
    <div className="bg-[var(--theme-bg-card)] rounded-xl border border-[var(--theme-border)] shadow-sm transition-all">
      <button
        onClick={() => toggleSection('scale')}
        className="w-full flex items-center justify-between p-3 text-xs text-[var(--theme-text-primary)] font-semibold group"
      >
        <span>Scale</span>
        <div className="flex items-center gap-2">
          <div
            onClick={(e) => {
              e.stopPropagation();
              setPropVal('transform.scale', 100, { transform: { ...selectedClip.transform, scale: 100 } });
              scheduleSaveSnapshot();
            }}
            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded-md transition-all"
            title="Reset Scale"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)]" />
          </div>
          {collapsedSections['scale'] ? (
            <ChevronRight className="w-3.5 h-3.5 text-[var(--theme-text-muted)]" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-[var(--theme-text-muted)]" />
          )}
        </div>
      </button>
      {!collapsedSections['scale'] && (
        <div className="px-3 pb-3 space-y-2 border-t border-[var(--theme-border)] pt-3">
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-[var(--theme-text-muted)] font-medium">Scale Multiplier</span>
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
              onMouseUp={() => scheduleSaveSnapshot()}
              onDoubleClick={() => {
                setPropVal('transform.scale', 100, { transform: { ...selectedClip.transform, scale: 100 } });
                scheduleSaveSnapshot();
              }}
              className="flex-1 h-1 bg-[var(--theme-border)] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-blue-600 [&::-webkit-slider-thumb]:rounded-full"
            />
            <span 
              className="text-[11px] text-[var(--theme-text-primary)] w-10 text-right cursor-pointer hover:text-blue-500 font-mono transition-colors"
              title="Click to cycle common values"
              onClick={() => {
                const steps = [10, 25, 50, 75, 100, 150, 200, 300, 400];
                const cur = getPropVal(selectedClip.transform.scale, 'transform.scale');
                let next = steps.find(s => s > cur) ?? steps[0];
                setPropVal('transform.scale', next, { transform: { ...selectedClip.transform, scale: next } });
                scheduleSaveSnapshot();
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