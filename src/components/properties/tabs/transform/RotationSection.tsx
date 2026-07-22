import { RotateCcw, ChevronDown, ChevronRight } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { KeyframeControl, KeyframeMiniTimeline } from '@/components/KeyframeControls';
import { addOrUpdateKeyframe } from '@/utils/keyframes';
import type { TimelineClip, ClipAnimations } from '@/types';

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
    <div className="bg-[#2d2d2d] rounded border border-[#3e3e3e]">
      <button
        onClick={() => toggleSection('rotation')}
        className="w-full flex items-center justify-between p-2.5 text-xs text-white group"
      >
        <span className="font-medium">Rotation</span>
        <div className="flex items-center gap-2">
          <div
            onClick={(e) => {
              e.stopPropagation();
              setPropVal('transform.rotation', 0, { transform: { ...selectedClip.transform, rotation: 0 } });
              setPropVal('transform.rotationX', 0, { transform: { ...selectedClip.transform, rotationX: 0 } });
              setPropVal('transform.rotationY', 0, { transform: { ...selectedClip.transform, rotationY: 0 } });
              useEditorStore.getState().saveSnapshot();
            }}
            className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-[#4a4a4a] rounded transition-all"
            title="Reset Rotation"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#a0a0a0] hover:text-white" />
          </div>
          {collapsedSections['rotation'] ? (
            <ChevronRight className="w-3.5 h-3.5 text-[#a0a0a0]" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-[#a0a0a0]" />
          )}
        </div>
      </button>
      {!collapsedSections['rotation'] && (
        <div className="px-2.5 pb-2.5 space-y-3">
          {/* Rotate X */}
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-[10px] text-[#a0a0a0]">Rotate X (3D)</label>
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
                onMouseUp={() => useEditorStore.getState().saveSnapshot()}
                onDoubleClick={() => {
                  setPropVal('transform.rotationX', 0, { transform: { ...selectedClip.transform, rotationX: 0 } });
                  useEditorStore.getState().saveSnapshot();
                }}
                className="flex-1 h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
              />
              <span 
                className="text-[11px] text-white w-10 text-right cursor-pointer hover:text-amber-500 transition-colors"
                title="Click to step 45°"
                onClick={() => {
                  const cur = getPropVal(selectedClip.transform.rotationX ?? 0, 'transform.rotationX');
                  let next = cur + 45;
                  if (next > 180) next = -180;
                  setPropVal('transform.rotationX', next, { transform: { ...selectedClip.transform, rotationX: next } });
                  useEditorStore.getState().saveSnapshot();
                }}
              >
                {Math.round(getPropVal(selectedClip.transform.rotationX ?? 0, 'transform.rotationX'))}°
              </span>
            </div>
          </div>

          {/* Rotate Y */}
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-[10px] text-[#a0a0a0]">Rotate Y (3D)</label>
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
                onMouseUp={() => useEditorStore.getState().saveSnapshot()}
                onDoubleClick={() => {
                  setPropVal('transform.rotationY', 0, { transform: { ...selectedClip.transform, rotationY: 0 } });
                  useEditorStore.getState().saveSnapshot();
                }}
                className="flex-1 h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
              />
              <span 
                className="text-[11px] text-white w-10 text-right cursor-pointer hover:text-amber-500 transition-colors"
                title="Click to step 45°"
                onClick={() => {
                  const cur = getPropVal(selectedClip.transform.rotationY ?? 0, 'transform.rotationY');
                  let next = cur + 45;
                  if (next > 180) next = -180;
                  setPropVal('transform.rotationY', next, { transform: { ...selectedClip.transform, rotationY: next } });
                  useEditorStore.getState().saveSnapshot();
                }}
              >
                {Math.round(getPropVal(selectedClip.transform.rotationY ?? 0, 'transform.rotationY'))}°
              </span>
            </div>
          </div>

          {/* Rotate Z */}
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-[10px] text-[#a0a0a0]">Rotate Z</label>
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
                onMouseUp={() => useEditorStore.getState().saveSnapshot()}
                onDoubleClick={() => {
                  setPropVal('transform.rotation', 0, { transform: { ...selectedClip.transform, rotation: 0 } });
                  useEditorStore.getState().saveSnapshot();
                }}
                className="flex-1 h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
              />
              <span 
                className="text-[11px] text-white w-10 text-right cursor-pointer hover:text-amber-500 transition-colors"
                title="Click to step 45°"
                onClick={() => {
                  const cur = getPropVal(selectedClip.transform.rotation ?? 0, 'transform.rotation');
                  let next = cur + 45;
                  if (next > 180) next = -180;
                  setPropVal('transform.rotation', next, { transform: { ...selectedClip.transform, rotation: next } });
                  useEditorStore.getState().saveSnapshot();
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