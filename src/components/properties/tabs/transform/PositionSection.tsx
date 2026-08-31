import { RotateCcw, ChevronDown, ChevronRight } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { KeyframeControl, KeyframeMiniTimeline } from '@/components/KeyframeControls';
import { addOrUpdateKeyframe } from '@/utils/keyframes';
import type { TimelineClip, ClipAnimations } from '@/types';
import { scheduleSaveSnapshot } from '@/utils/snapshotScheduler';

interface PositionSectionProps {
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

export function PositionSection({
  selectedClip,
  localTime,
  absoluteStartTime,
  animations,
  collapsedSections,
  toggleSection,
  getPropVal,
  setPropVal,
  updateClip,
}: PositionSectionProps) {
  return (
    <div className="bg-[var(--theme-bg-card)] rounded-xl border border-[var(--theme-border)] shadow-sm transition-all">
      <button
        onClick={() => toggleSection('position')}
        className="w-full flex items-center justify-between p-3 text-xs text-[var(--theme-text-primary)] font-semibold group"
      >
        <span>Position</span>
        <div className="flex items-center gap-2">
          <div
            onClick={(e) => {
              e.stopPropagation();
              setPropVal('transform.x', 0, { transform: { ...selectedClip.transform, x: 0 } });
              setPropVal('transform.y', 0, { transform: { ...selectedClip.transform, y: 0 } });
              scheduleSaveSnapshot();
            }}
            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded-md transition-all"
            title="Reset Position"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)]" />
          </div>
          {collapsedSections['position'] ? (
            <ChevronRight className="w-3.5 h-3.5 text-[var(--theme-text-muted)]" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-[var(--theme-text-muted)]" />
          )}
        </div>
      </button>
      {!collapsedSections['position'] && (
        <div className="px-3 pb-3 space-y-4 border-t border-[var(--theme-border)] pt-3">
          {/* Position X */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-[10px] text-[var(--theme-text-muted)] font-medium">X Position</label>
              <KeyframeControl
                propertyKey="transform.x"
                value={getPropVal(selectedClip.transform.x, 'transform.x')}
                keyframes={animations['transform.x'] || []}
                currentTime={localTime}
                clipId={selectedClip.id}
                onAddKeyframe={(time, val) => {
                  const newKf = addOrUpdateKeyframe(animations['transform.x'] || [], time, val, { easing: 'bezier' });
                  updateClip(selectedClip.id, {
                    animations: { ...animations, 'transform.x': newKf }
                  });
                }}
                onRemoveKeyframe={(time) => {
                  const newKf = (animations['transform.x'] || []).filter(k => Math.abs(k.time - time) > 0.03);
                  updateClip(selectedClip.id, {
                    animations: { ...animations, 'transform.x': newKf }
                  });
                }}
                onUpdateEasing={(time, easing) => {
                  const newKf = (animations['transform.x'] || []).map(k => 
                    Math.abs(k.time - time) < 0.03 ? { ...k, easing } : k
                  );
                  updateClip(selectedClip.id, {
                    animations: { ...animations, 'transform.x': newKf }
                  });
                }}
                onJumpToNext={() => {
                  const next = (animations['transform.x'] || []).find(k => k.time > localTime + 0.05);
                  if (next) useEditorStore.getState().seek(absoluteStartTime + next.time);
                }}
                onJumpToPrev={() => {
                  const prev = [...(animations['transform.x'] || [])].reverse().find(k => k.time < localTime - 0.05);
                  if (prev) useEditorStore.getState().seek(absoluteStartTime + prev.time);
                }}
              />
            </div>
            <KeyframeMiniTimeline
              keyframes={animations['transform.x'] || []}
              currentTime={localTime}
              duration={selectedClip.duration}
              onSeek={(t) => useEditorStore.getState().seek(absoluteStartTime + t)}
            />
            <input
              type="number"
              value={Math.round(getPropVal(selectedClip.transform.x, 'transform.x'))}
              onChange={(e) => setPropVal('transform.x', Number(e.target.value), { transform: { ...selectedClip.transform, x: Number(e.target.value) } })}
              onBlur={() => scheduleSaveSnapshot()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              }}
              className="w-full px-2.5 py-1.5 bg-[var(--theme-bg-subpanel)] border border-[var(--theme-border)] rounded-lg text-xs text-[var(--theme-text-primary)] focus:outline-none focus:border-blue-500 shadow-sm"
            />
          </div>

          {/* Position Y */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-[10px] text-[var(--theme-text-muted)] font-medium">Y Position</label>
              <KeyframeControl
                propertyKey="transform.y"
                value={getPropVal(selectedClip.transform.y, 'transform.y')}
                keyframes={animations['transform.y'] || []}
                currentTime={localTime}
                clipId={selectedClip.id}
                onAddKeyframe={(time, val) => {
                  const newKf = addOrUpdateKeyframe(animations['transform.y'] || [], time, val, { easing: 'bezier' });
                  updateClip(selectedClip.id, {
                    animations: { ...animations, 'transform.y': newKf }
                  });
                }}
                onRemoveKeyframe={(time) => {
                  const newKf = (animations['transform.y'] || []).filter(k => Math.abs(k.time - time) > 0.03);
                  updateClip(selectedClip.id, {
                    animations: { ...animations, 'transform.y': newKf }
                  });
                }}
                onUpdateEasing={(time, easing) => {
                  const newKf = (animations['transform.y'] || []).map(k => 
                    Math.abs(k.time - time) < 0.03 ? { ...k, easing } : k
                  );
                  updateClip(selectedClip.id, {
                    animations: { ...animations, 'transform.y': newKf }
                  });
                }}
                onJumpToNext={() => {
                  const next = (animations['transform.y'] || []).find(k => k.time > localTime + 0.05);
                  if (next) useEditorStore.getState().seek(absoluteStartTime + next.time);
                }}
                onJumpToPrev={() => {
                  const prev = [...(animations['transform.y'] || [])].reverse().find(k => k.time < localTime - 0.05);
                  if (prev) useEditorStore.getState().seek(absoluteStartTime + prev.time);
                }}
              />
            </div>
            <KeyframeMiniTimeline
              keyframes={animations['transform.y'] || []}
              currentTime={localTime}
              duration={selectedClip.duration}
              onSeek={(t) => useEditorStore.getState().seek(absoluteStartTime + t)}
            />
            <input
              type="number"
              value={Math.round(getPropVal(selectedClip.transform.y, 'transform.y'))}
              onChange={(e) => setPropVal('transform.y', Number(e.target.value), { transform: { ...selectedClip.transform, y: Number(e.target.value) } })}
              onBlur={() => scheduleSaveSnapshot()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              }}
              className="w-full px-2.5 py-1.5 bg-[var(--theme-bg-subpanel)] border border-[var(--theme-border)] rounded-lg text-xs text-[var(--theme-text-primary)] focus:outline-none focus:border-blue-500 shadow-sm"
            />
          </div>
        </div>
      )}
    </div>
  );
}