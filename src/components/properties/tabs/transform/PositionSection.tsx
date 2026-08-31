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
    <div className="bg-popover rounded border border-border">
      <button
        onClick={() => toggleSection('position')}
        className="w-full flex items-center justify-between p-2.5 text-xs text-foreground group"
      >
        <span className="font-medium">Position</span>
        <div className="flex items-center gap-2">
          <div
            onClick={(e) => {
              e.stopPropagation();
              setPropVal('transform.x', 0, { transform: { ...selectedClip.transform, x: 0 } });
              setPropVal('transform.y', 0, { transform: { ...selectedClip.transform, y: 0 } });
              scheduleSaveSnapshot();
            }}
            className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-accent rounded transition-all"
            title="Reset Position"
          >
            <RotateCcw className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
          </div>
          {collapsedSections['position'] ? (
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </div>
      </button>
      {!collapsedSections['position'] && (
        <div className="px-2.5 pb-2.5 space-y-4">
          {/* Position X */}
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-[10px] text-muted-foreground">X Position</label>
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
              className="w-full px-2 py-1 bg-card border border-border rounded text-xs text-foreground focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Position Y */}
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-[10px] text-muted-foreground">Y Position</label>
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
              className="w-full px-2 py-1 bg-card border border-border rounded text-xs text-foreground focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>
      )}
    </div>
  );
}