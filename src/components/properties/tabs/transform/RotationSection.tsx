import { RotateCcw, ChevronDown, ChevronRight } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { KeyframeControl, KeyframeMiniTimeline } from '@/components/KeyframeControls';
import { addOrUpdateKeyframe } from '@/utils/keyframes';
import type { TimelineClip, ClipAnimations } from '@/types';
import { scheduleSaveSnapshot } from '@/utils/snapshotScheduler';

interface RotationSectionProps {
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

export function RotationSection({
  selectedClip,
  localTime,
  absoluteStartTime,
  animations,
  collapsedSections,
  toggleSection,
  getPropVal,
  setPropVal,
  updateClip,
}: RotationSectionProps) {
  return (
    <div className="bg-[var(--theme-bg-card)] rounded-xl border border-[var(--theme-border)] shadow-sm transition-all">
      <button
        onClick={() => toggleSection('rotation')}
        className="w-full flex items-center justify-between p-3 text-xs text-[var(--theme-text-primary)] font-semibold group"
      >
        <span>Rotation</span>
        <div className="flex items-center gap-2">
          <div
            onClick={(e) => {
              e.stopPropagation();
              setPropVal('transform.rotation', 0, { transform: { ...selectedClip.transform, rotation: 0 } });
              setPropVal('transform.rotationX', 0, { transform: { ...selectedClip.transform, rotationX: 0 } });
              setPropVal('transform.rotationY', 0, { transform: { ...selectedClip.transform, rotationY: 0 } });
              scheduleSaveSnapshot();
            }}
            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded-md transition-all"
            title="Reset Rotation"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)]" />
          </div>
          {collapsedSections['rotation'] ? (
            <ChevronRight className="w-3.5 h-3.5 text-[var(--theme-text-muted)]" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-[var(--theme-text-muted)]" />
          )}
        </div>
      </button>
      {!collapsedSections['rotation'] && (
        <div className="px-3 pb-3 space-y-3 border-t border-[var(--theme-border)] pt-3">
          {/* Rotate X */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-[10px] text-[var(--theme-text-muted)] font-medium">Rotate X (3D)</label>
              <KeyframeControl
                propertyKey="transform.rotationX"
                value={getPropVal(selectedClip.transform.rotationX ?? 0, 'transform.rotationX')}
                keyframes={animations['transform.rotationX'] || []}
                currentTime={localTime}
                clipId={selectedClip.id}
                onAddKeyframe={(time, val) => {
                  const newKf = addOrUpdateKeyframe(animations['transform.rotationX'] || [], time, val, { easing: 'bezier' });
                  updateClip(selectedClip.id, {
                    animations: { ...animations, 'transform.rotationX': newKf }
                  });
                }}
                onRemoveKeyframe={(time) => {
                  const newKf = (animations['transform.rotationX'] || []).filter(k => Math.abs(k.time - time) > 0.03);
                  updateClip(selectedClip.id, {
                    animations: { ...animations, 'transform.rotationX': newKf }
                  });
                }}
                onUpdateEasing={(time, easing) => {
                  const newKf = (animations['transform.rotationX'] || []).map(k => 
                    Math.abs(k.time - time) < 0.03 ? { ...k, easing } : k
                  );
                  updateClip(selectedClip.id, {
                    animations: { ...animations, 'transform.rotationX': newKf }
                  });
                }}
                onJumpToNext={() => {
                  const next = (animations['transform.rotationX'] || []).find(k => k.time > localTime + 0.05);
                  if (next) useEditorStore.getState().seek(absoluteStartTime + next.time);
                }}
                onJumpToPrev={() => {
                  const prev = [...(animations['transform.rotationX'] || [])].reverse().find(k => k.time < localTime - 0.05);
                  if (prev) useEditorStore.getState().seek(absoluteStartTime + prev.time);
                }}
              />
            </div>
            <KeyframeMiniTimeline
              keyframes={animations['transform.rotationX'] || []}
              currentTime={localTime}
              duration={selectedClip.duration}
              onSeek={(t) => useEditorStore.getState().seek(absoluteStartTime + t)}
            />
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={-180}
                max={180}
                value={getPropVal(selectedClip.transform.rotationX ?? 0, 'transform.rotationX')}
                title="Double-click to reset to 0°"
                onChange={(e) => setPropVal('transform.rotationX', Number(e.target.value), { transform: { ...selectedClip.transform, rotationX: Number(e.target.value) } })}
                onMouseUp={() => scheduleSaveSnapshot()}
                onDoubleClick={() => {
                  setPropVal('transform.rotationX', 0, { transform: { ...selectedClip.transform, rotationX: 0 } });
                  scheduleSaveSnapshot();
                }}
                className="flex-1 h-1 bg-[var(--theme-border)] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-blue-600 [&::-webkit-slider-thumb]:rounded-full"
              />
              <span 
                className="text-[11px] text-[var(--theme-text-primary)] w-10 text-right cursor-pointer hover:text-blue-500 font-mono transition-colors"
                title="Click to step 45°"
                onClick={() => {
                  const cur = getPropVal(selectedClip.transform.rotationX ?? 0, 'transform.rotationX');
                  let next = cur + 45;
                  if (next > 180) next = -180;
                  setPropVal('transform.rotationX', next, { transform: { ...selectedClip.transform, rotationX: next } });
                  scheduleSaveSnapshot();
                }}
              >
                {Math.round(getPropVal(selectedClip.transform.rotationX ?? 0, 'transform.rotationX'))}°
              </span>
            </div>
          </div>

          {/* Rotate Y */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-[10px] text-[var(--theme-text-muted)] font-medium">Rotate Y (3D)</label>
              <KeyframeControl
                propertyKey="transform.rotationY"
                value={getPropVal(selectedClip.transform.rotationY ?? 0, 'transform.rotationY')}
                keyframes={animations['transform.rotationY'] || []}
                currentTime={localTime}
                clipId={selectedClip.id}
                onAddKeyframe={(time, val) => {
                  const newKf = addOrUpdateKeyframe(animations['transform.rotationY'] || [], time, val, { easing: 'bezier' });
                  updateClip(selectedClip.id, {
                    animations: { ...animations, 'transform.rotationY': newKf }
                  });
                }}
                onRemoveKeyframe={(time) => {
                  const newKf = (animations['transform.rotationY'] || []).filter(k => Math.abs(k.time - time) > 0.03);
                  updateClip(selectedClip.id, {
                    animations: { ...animations, 'transform.rotationY': newKf }
                  });
                }}
                onUpdateEasing={(time, easing) => {
                  const newKf = (animations['transform.rotationY'] || []).map(k => 
                    Math.abs(k.time - time) < 0.03 ? { ...k, easing } : k
                  );
                  updateClip(selectedClip.id, {
                    animations: { ...animations, 'transform.rotationY': newKf }
                  });
                }}
                onJumpToNext={() => {
                  const next = (animations['transform.rotationY'] || []).find(k => k.time > localTime + 0.05);
                  if (next) useEditorStore.getState().seek(absoluteStartTime + next.time);
                }}
                onJumpToPrev={() => {
                  const prev = [...(animations['transform.rotationY'] || [])].reverse().find(k => k.time < localTime - 0.05);
                  if (prev) useEditorStore.getState().seek(absoluteStartTime + prev.time);
                }}
              />
            </div>
            <KeyframeMiniTimeline
              keyframes={animations['transform.rotationY'] || []}
              currentTime={localTime}
              duration={selectedClip.duration}
              onSeek={(t) => useEditorStore.getState().seek(absoluteStartTime + t)}
            />
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={-180}
                max={180}
                value={getPropVal(selectedClip.transform.rotationY ?? 0, 'transform.rotationY')}
                title="Double-click to reset to 0°"
                onChange={(e) => setPropVal('transform.rotationY', Number(e.target.value), { transform: { ...selectedClip.transform, rotationY: Number(e.target.value) } })}
                onMouseUp={() => scheduleSaveSnapshot()}
                onDoubleClick={() => {
                  setPropVal('transform.rotationY', 0, { transform: { ...selectedClip.transform, rotationY: 0 } });
                  scheduleSaveSnapshot();
                }}
                className="flex-1 h-1 bg-[var(--theme-border)] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-blue-600 [&::-webkit-slider-thumb]:rounded-full"
              />
              <span 
                className="text-[11px] text-[var(--theme-text-primary)] w-10 text-right cursor-pointer hover:text-blue-500 font-mono transition-colors"
                title="Click to step 45°"
                onClick={() => {
                  const cur = getPropVal(selectedClip.transform.rotationY ?? 0, 'transform.rotationY');
                  let next = cur + 45;
                  if (next > 180) next = -180;
                  setPropVal('transform.rotationY', next, { transform: { ...selectedClip.transform, rotationY: next } });
                  scheduleSaveSnapshot();
                }}
              >
                {Math.round(getPropVal(selectedClip.transform.rotationY ?? 0, 'transform.rotationY'))}°
              </span>
            </div>
          </div>

          {/* Rotate Z */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-[10px] text-[var(--theme-text-muted)] font-medium">Rotate Z</label>
              <KeyframeControl
                propertyKey="transform.rotation"
                value={getPropVal(selectedClip.transform.rotation, 'transform.rotation')}
                keyframes={animations['transform.rotation'] || []}
                currentTime={localTime}
                clipId={selectedClip.id}
                onAddKeyframe={(time, val) => {
                  const newKf = addOrUpdateKeyframe(animations['transform.rotation'] || [], time, val, { easing: 'bezier' });
                  updateClip(selectedClip.id, {
                    animations: { ...animations, 'transform.rotation': newKf }
                  });
                }}
                onRemoveKeyframe={(time) => {
                  const newKf = (animations['transform.rotation'] || []).filter(k => Math.abs(k.time - time) > 0.03);
                  updateClip(selectedClip.id, {
                    animations: { ...animations, 'transform.rotation': newKf }
                  });
                }}
                onUpdateEasing={(time, easing) => {
                  const newKf = (animations['transform.rotation'] || []).map(k => 
                    Math.abs(k.time - time) < 0.03 ? { ...k, easing } : k
                  );
                  updateClip(selectedClip.id, {
                    animations: { ...animations, 'transform.rotation': newKf }
                  });
                }}
                onJumpToNext={() => {
                  const next = (animations['transform.rotation'] || []).find(k => k.time > localTime + 0.05);
                  if (next) useEditorStore.getState().seek(absoluteStartTime + next.time);
                }}
                onJumpToPrev={() => {
                  const prev = [...(animations['transform.rotation'] || [])].reverse().find(k => k.time < localTime - 0.05);
                  if (prev) useEditorStore.getState().seek(absoluteStartTime + prev.time);
                }}
              />
            </div>
            <KeyframeMiniTimeline
              keyframes={animations['transform.rotation'] || []}
              currentTime={localTime}
              duration={selectedClip.duration}
              onSeek={(t) => useEditorStore.getState().seek(absoluteStartTime + t)}
            />
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={-180}
                max={180}
                value={getPropVal(selectedClip.transform.rotation, 'transform.rotation')}
                title="Double-click to reset to 0°"
                onChange={(e) => setPropVal('transform.rotation', Number(e.target.value), { transform: { ...selectedClip.transform, rotation: Number(e.target.value) } })}
                onMouseUp={() => scheduleSaveSnapshot()}
                onDoubleClick={() => {
                  setPropVal('transform.rotation', 0, { transform: { ...selectedClip.transform, rotation: 0 } });
                  scheduleSaveSnapshot();
                }}
                className="flex-1 h-1 bg-[var(--theme-border)] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-blue-600 [&::-webkit-slider-thumb]:rounded-full"
              />
              <span 
                className="text-[11px] text-[var(--theme-text-primary)] w-10 text-right cursor-pointer hover:text-blue-500 font-mono transition-colors"
                title="Click to step 45°"
                onClick={() => {
                  const cur = getPropVal(selectedClip.transform.rotation ?? 0, 'transform.rotation');
                  let next = cur + 45;
                  if (next > 180) next = -180;
                  setPropVal('transform.rotation', next, { transform: { ...selectedClip.transform, rotation: next } });
                  scheduleSaveSnapshot();
                }}
              >
                {Math.round(getPropVal(selectedClip.transform.rotation, 'transform.rotation'))}°
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}