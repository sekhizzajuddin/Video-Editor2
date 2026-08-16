/**
 * MotionEffectsPanel.tsx
 *
 * FX-tab UI for motion-tracked REGION effects.
 *
 * Workflow the panel drives:
 *   1. Add an effect  -> a default region box appears in the centre of the frame.
 *   2. Position it    -> nudge/size controls place it over the feature (hand, face).
 *   3. Track          -> the SSD tracker follows that box across the clip.
 *   4. Tune           -> pick the motion (shake/jiggle/...), intensity, speed, feather.
 *
 * Tracking is optional: without it the region stays put, which is fine for a
 * subject that does not move much. With it, the effect follows the subject.
 */

import { useState } from 'react';
import { Activity, Crosshair, Plus, Trash2, Loader2, Brush, SquareDashed } from 'lucide-react';
import { toast } from 'sonner';
import type { TimelineClip } from '@/types';
import {
  getFrameSize,
  quadToRect,
  rectToQuad,
  defaultRegionQuad,
  normalizeRegionToFrame,
} from '@/utils/frameSpace';
import { useEditorStore } from '@/store/editorStore';
import { trackMotion } from '@/utils/motionTracker';
import { trackColorMask } from '@/utils/motionMaskTracker';
import { decodeMaskRle } from '@/utils/motionMask';
import {
  DEFAULT_MOTION_EFFECT,
  MOTION_EFFECT_INFO,
  type MotionEffectSettings,
  type MotionEffectType,
} from '@/utils/motionEffects';

interface MotionEffectsPanelProps {
  selectedClip: TimelineClip;
  /** Live video elements, needed to run the tracker. */
  videoElements: Map<string, HTMLVideoElement>;
}

const rectOf = quadToRect;
const cornersFrom = rectToQuad;

export function MotionEffectsPanel({ selectedClip, videoElements }: MotionEffectsPanelProps) {
  const updateClip = useEditorStore((s) => s.updateClip);
  const [trackingIndex, setTrackingIndex] = useState<number | null>(null);
  const [trackProgress, setTrackProgress] = useState(0);
  const [paintArmed, setPaintArmed] = useState<number | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Regions live in FRAME space — the visible picture, which is 854x480 only on
  // a 16:9 project. Every default, clamp and readout below follows this.
  const aspectRatio = useEditorStore((s) => s.aspectRatio);
  const frame = getFrameSize(aspectRatio);

  const effects: MotionEffectSettings[] = selectedClip.motionEffects ?? [];

  const writeEffects = (next: MotionEffectSettings[]) => {
    updateClip(selectedClip.id, { motionEffects: next } as any);
  };

  const patch = (index: number, changes: Partial<MotionEffectSettings>) => {
    writeEffects(effects.map((e, i) => (i === index ? { ...e, ...changes } : e)));
  };

  const addEffect = () => {
    writeEffects([
      ...effects,
      {
        ...DEFAULT_MOTION_EFFECT,
        enabled: true,
        seed: Math.floor(Math.random() * 1000) + 1,
        // Centred in the VISIBLE picture for the current aspect ratio. The old
        // hard-coded (427, 240) is the centre of a 16:9 overlay box, which on a
        // 9:16 project is 157px to the RIGHT of the picture's right-hand edge —
        // the box appeared outside the canvas and nothing could be painted.
        baseCorners: defaultRegionQuad(frame.W, frame.H),
      },
    ]);
    useEditorStore.getState().saveSnapshot('Add Motion Effect');
    // Jump straight into placing it — that is always the next thing the user wants.
    setEditing(effects.length);
  };

  const removeEffect = (index: number) => {
    if (editingIndex === index) setEditing(null);
    writeEffects(effects.filter((_, i) => i !== index));
    useEditorStore.getState().saveSnapshot('Remove Motion Effect');
  };

  const armPaint = (index: number | null) => {
    window.dispatchEvent(
      new CustomEvent('procut-motion-paint-arm', {
        detail: index === null ? null : { index, clipId: selectedClip.id },
      })
    );
    setPaintArmed(index);
  };

  /**
   * Enter / leave region-edit mode.
   *
   * While editing, the overlay shows the region box or brush AND disables the
   * clip's transform handles — otherwise a drag intended for the region moves
   * the whole clip and the region can never be placed.
   */
  const setEditing = (index: number | null) => {
    window.dispatchEvent(
      new CustomEvent('procut-motion-region-edit', {
        detail: index === null ? null : { index, clipId: selectedClip.id },
      })
    );
    setEditingIndex(index);
    if (index === null) armPaint(null);
  };

  const runTracking = async (index: number) => {
    const effect = effects[index];
    const videoEl = videoElements.get(selectedClip.id);

    if (!videoEl) {
      toast.error('Video not loaded yet — move the playhead over this clip first.');
      return;
    }

    const store = useEditorStore.getState();
    const clipLocalTime = Math.max(0, store.currentTime - selectedClip.startTime);
    const remaining = Math.max(0.1, selectedClip.duration - clipLocalTime);

    setTrackingIndex(index);
    setTrackProgress(0);

    try {
      if (effect.regionMode === 'paint') {
        // ── Colour-signature tracking ──────────────────────────────────────
        if (!effect.strokeRle || !effect.strokeWidth || !effect.strokeHeight) {
          toast.error('Paint over the feature first, then press Re-track.');
          return;
        }

        const decoded = decodeMaskRle(
          effect.strokeRle,
          effect.strokeWidth * effect.strokeHeight
        );
        const stroke = new Uint8Array(decoded.length);
        for (let i = 0; i < decoded.length; i++) stroke[i] = decoded[i] > 127 ? 1 : 0;

        const result = await trackColorMask(
          videoEl,
          store.currentTime,
          remaining,
          stroke,
          effect.strokeWidth,
          effect.strokeHeight,
          {
            tolerance: effect.colorTolerance ?? 22,
            choke: effect.maskChoke ?? 0,
            feather: Math.round((effect.feather ?? 12) / 3),
            // Analyse in the same space the stroke was painted in.
            aspectRatio,
            clipTransform: selectedClip.transform,
            onProgress: (p) => setTrackProgress(Math.round(p * 100)),
          }
        );

        if (!result) {
          toast.error('Could not analyse the painted area — try a broader stroke.');
          return;
        }

        patch(index, {
          colorSignature: result.signature,
          maskCache: {
            width: result.width,
            height: result.height,
            frames: result.frames,
          },
        });
        useEditorStore.getState().saveSnapshot('Track Colour Region');
        toast.success(`Analysed ${result.frames.length} frames — the effect now follows the painted colour.`);
      } else {
        // ── Box tracking ───────────────────────────────────────────────────
        if (!effect.baseCorners) {
          toast.error('Position the region box first.');
          return;
        }
        const results = await trackMotion(
          videoEl,
          store.currentTime,
          remaining,
          // Clamp first: a region saved before the frame-space fix (or authored
          // under a different aspect ratio) can sit outside the picture, and the
          // tracker would then lift its template from blank canvas and go nowhere.
          normalizeRegionToFrame(effect.baseCorners, frame.W, frame.H),
          (progress) => setTrackProgress(Math.round(progress * 100)),
          selectedClip.transform
        );
        const track = results.map((r) => ({
          time: Math.max(0, r.time - selectedClip.startTime),
          corners: r.corners,
        }));
        patch(index, { track });
        useEditorStore.getState().saveSnapshot('Track Motion Region');
        toast.success(`Tracked ${track.length} frames — the effect now follows the subject.`);
      }
    } catch (err: any) {
      console.error('[MotionEffects] tracking failed:', err);
      toast.error(`Tracking failed: ${err?.message ?? 'unknown error'}`);
    } finally {
      setTrackingIndex(null);
      setTrackProgress(0);
    }
  };

  return (
    <div className="bg-[#2d2d2d] rounded border border-[#3e3e3e]">
      <div className="flex items-center justify-between p-2.5 border-b border-[#3e3e3e]/40">
        <span className="text-xs text-white font-medium flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-orange-400" />
          Motion Tracked Effects
          {effects.length > 0 && (
            <span className="text-[9px] bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded-full font-semibold">
              {effects.length}
            </span>
          )}
        </span>
        <button
          onClick={addEffect}
          className="p-1 rounded bg-orange-600/20 hover:bg-orange-600 text-orange-300 hover:text-white transition-colors"
          title="Add a tracked region effect"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="p-2.5 space-y-3">
        {effects.length === 0 && (
          <p className="text-[10px] text-[#808080] leading-relaxed">
            Shake, jiggle or pulse just <span className="text-[#b0b0b0]">part</span> of the frame —
            a hand, a face — and have it follow the subject as they move.
            Press <span className="text-orange-400">+</span> to add one, then drag the box that
            appears on the preview over the feature.
          </p>
        )}

        {effects.map((effect, index) => {
          const info = MOTION_EFFECT_INFO.find((m) => m.type === effect.type);
          const r = rectOf(normalizeRegionToFrame(effect.baseCorners, frame.W, frame.H));
          const isTracking = trackingIndex === index;
          const tracked = (effect.track?.length ?? 0) > 0;

          return (
            <div key={index} className="bg-[#242424] rounded border border-[#3a3a3a] p-2.5 space-y-2.5">
              {/* Header */}
              <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={effect.enabled}
                    onChange={(e) => patch(index, { enabled: e.target.checked })}
                    className="rounded bg-[#1e1e1e] border-[#3e3e3e] text-orange-500 focus:ring-0"
                  />
                  <span className="text-[11px] text-[#d0d0d0] font-medium">
                    Region {index + 1}
                  </span>
                </label>
                <div className="flex items-center gap-1.5">
                  {tracked && (
                    <span className="text-[8px] uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                      Tracked
                    </span>
                  )}
                  <button
                    onClick={() => setEditing(editingIndex === index ? null : index)}
                    className={`px-1.5 py-0.5 rounded text-[9px] font-semibold border transition-colors ${
                      editingIndex === index
                        ? 'bg-orange-600 border-orange-500 text-white'
                        : 'bg-[#1e1e1e] border-[#3e3e3e] text-[#a0a0a0] hover:text-white'
                    }`}
                    title={
                      editingIndex === index
                        ? 'Finish placing — re-enables the clip transform box'
                        : 'Show the region on the preview and disable the clip transform box'
                    }
                  >
                    {editingIndex === index ? 'Done' : 'Edit Region'}
                  </button>
                  <button
                    onClick={() => removeEffect(index)}
                    className="p-1 rounded text-[#888] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    title="Remove"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Motion type */}
              <div>
                <label className="block text-[10px] text-[#a0a0a0] mb-1 font-medium">Motion</label>
                <select
                  value={effect.type}
                  onChange={(e) => patch(index, { type: e.target.value as MotionEffectType })}
                  className="w-full px-2 py-1.5 bg-[#1e1e1e] border border-[#3e3e3e] rounded text-xs text-white focus:outline-none focus:border-orange-500 cursor-pointer"
                >
                  {MOTION_EFFECT_INFO.map((m) => (
                    <option key={m.type} value={m.type}>{m.label}</option>
                  ))}
                </select>
                {info && <p className="text-[9px] text-[#707070] mt-1">{info.description}</p>}
                {editingIndex === index && (
                  <p className="text-[9px] text-orange-400/90 mt-1.5 leading-relaxed">
                    Placing region — the clip transform box is disabled so it cannot move
                    while you work. Press <span className="font-semibold">Done</span> when finished.
                  </p>
                )}
              </div>

              {/* Selection shape: box vs painted colour */}
              <div className="space-y-1.5 pt-1 border-t border-[#3e3e3e]/30">
                <span className="text-[10px] text-[#a0a0a0] font-medium">Selection</span>
                <div className="grid grid-cols-2 gap-1">
                  {([
                    ['box', 'Box', SquareDashed],
                    ['paint', 'Paint', Brush],
                  ] as const).map(([mode, label, Icon]) => (
                    <button
                      key={mode}
                      onClick={() => {
                        patch(index, { regionMode: mode });
                        if (mode !== 'paint') armPaint(null);
                      }}
                      className={`py-1.5 text-[10px] rounded border transition-colors flex items-center justify-center gap-1 ${
                        (effect.regionMode ?? 'box') === mode
                          ? 'bg-orange-600 border-orange-500 text-white'
                          : 'bg-[#1e1e1e] border-[#3e3e3e] text-[#a0a0a0] hover:text-white'
                      }`}
                    >
                      <Icon className="w-3 h-3" /> {label}
                    </button>
                  ))}
                </div>

                {/* Inside vs outside */}
                <span className="text-[10px] text-[#a0a0a0] font-medium block pt-1">Apply To</span>
                <div className="grid grid-cols-2 gap-1">
                  {([
                    ['inside', 'Inside selection'],
                    ['outside', 'Outside selection'],
                  ] as const).map(([mode, label]) => (
                    <button
                      key={mode}
                      onClick={() => patch(index, { applyMode: mode })}
                      className={`py-1.5 text-[10px] rounded border transition-colors ${
                        (effect.applyMode ?? 'inside') === mode
                          ? 'bg-orange-600 border-orange-500 text-white'
                          : 'bg-[#1e1e1e] border-[#3e3e3e] text-[#a0a0a0] hover:text-white'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className="text-[9px] text-[#707070]">
                  {(effect.applyMode ?? 'inside') === 'outside'
                    ? 'Everything EXCEPT the selection moves — hold a subject steady while the scene shakes.'
                    : 'Only the selected area moves.'}
                </p>
              </div>

              {/* Paint controls */}
              {effect.regionMode === 'paint' && (
                <div className="space-y-1.5 pt-1 border-t border-[#3e3e3e]/30">
                  <button
                    onClick={() => armPaint(paintArmed === index ? null : index)}
                    className={`w-full py-1.5 rounded text-[10px] font-medium transition-colors flex items-center justify-center gap-1.5 border ${
                      paintArmed === index
                        ? 'bg-orange-600 border-orange-500 text-white'
                        : 'bg-[#1f2933] border-orange-500/30 text-orange-300 hover:bg-[#283542]'
                    }`}
                  >
                    <Brush className="w-3 h-3" />
                    {paintArmed === index ? 'Painting — drag on the preview' : 'Paint Region'}
                  </button>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-[10px] text-[#a0a0a0] font-medium">Brush Size</label>
                      <span className="text-[10px] text-orange-400 font-mono">{effect.brushSize ?? 40}px</span>
                    </div>
                    <input
                      type="range" min={8} max={160} step={2}
                      value={effect.brushSize ?? 40}
                      onChange={(e) => patch(index, { brushSize: parseFloat(e.target.value) } as any)}
                      className="w-full h-1 bg-[#2a2a2a] rounded-lg accent-orange-500 cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-[10px] text-[#a0a0a0] font-medium">Colour Tolerance</label>
                      <span className="text-[10px] text-orange-400 font-mono">{effect.colorTolerance ?? 22}</span>
                    </div>
                    <input
                      type="range" min={5} max={60} step={1}
                      value={effect.colorTolerance ?? 22}
                      onChange={(e) => patch(index, { colorTolerance: parseFloat(e.target.value) })}
                      className="w-full h-1 bg-[#2a2a2a] rounded-lg accent-orange-500 cursor-pointer"
                    />
                    <p className="text-[9px] text-[#707070] mt-1">
                      Higher catches more shades of the painted colour. Re-track after changing.
                    </p>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-[10px] text-[#a0a0a0] font-medium">Mask Choke</label>
                      <span className="text-[10px] text-orange-400 font-mono">
                        {(effect.maskChoke ?? 0) > 0 ? '+' : ''}{effect.maskChoke ?? 0}px
                      </span>
                    </div>
                    <input
                      type="range" min={-6} max={6} step={1}
                      value={effect.maskChoke ?? 0}
                      onChange={(e) => patch(index, { maskChoke: parseFloat(e.target.value) })}
                      className="w-full h-1 bg-[#2a2a2a] rounded-lg accent-orange-500 cursor-pointer"
                    />
                  </div>
                </div>
              )}

              {/* Region placement (box mode only) */}
              {(effect.regionMode ?? 'box') === 'box' && (
              <div className="space-y-1.5 pt-1 border-t border-[#3e3e3e]/30">
                <span className="text-[10px] text-[#a0a0a0] font-medium">Region</span>
                <div className="grid grid-cols-2 gap-1.5">
                  {([
                    ['X', r.cx, (v: number) => cornersFrom(v, r.cy, r.w, r.h)],
                    ['Y', r.cy, (v: number) => cornersFrom(r.cx, v, r.w, r.h)],
                    ['W', r.w, (v: number) => cornersFrom(r.cx, r.cy, v, r.h)],
                    ['H', r.h, (v: number) => cornersFrom(r.cx, r.cy, r.w, v)],
                  ] as const).map(([label, value, build]) => (
                    <div key={label} className="flex items-center gap-1">
                      <span className="text-[9px] text-[#707070] w-3">{label}</span>
                      <input
                        type="number"
                        value={Math.round(value)}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          if (!Number.isFinite(v)) return;
                          // Editing the box invalidates any existing track.
                          // Clamp to the frame so a typo cannot push the region
                          // into the letterbox bars, where there is nothing to track.
                          patch(index, {
                            baseCorners: normalizeRegionToFrame(build(v), frame.W, frame.H),
                            track: undefined,
                          });
                        }}
                        className="w-full px-1.5 py-1 bg-[#1e1e1e] border border-[#3e3e3e] rounded text-[10px] text-white focus:outline-none focus:border-orange-500"
                      />
                    </div>
                  ))}
                </div>
                <p className="text-[9px] text-[#707070]">
                  Drag the <span className="text-orange-400">orange box</span> on the preview to place it
                  over the feature — or type exact values above. Then press Track.
                  Coordinates are in frame space: {frame.W} x {frame.H} for this {aspectRatio} project.
                </p>
              </div>
              )}

              {/* Track */}
              <button
                onClick={() => runTracking(index)}
                disabled={isTracking}
                className="w-full py-1.5 bg-[#1f2933] hover:bg-[#283542] disabled:opacity-60 border border-orange-500/30 text-orange-300 rounded text-[10px] font-medium transition-colors flex items-center justify-center gap-1.5"
              >
                {isTracking ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Tracking… {trackProgress}%
                  </>
                ) : (
                  <>
                    <Crosshair className="w-3 h-3" />
                    {tracked ? 'Re-track Region' : 'Track Region'}
                  </>
                )}
              </button>

              {/* Sliders */}
              {([
                ['Intensity', 'intensity', 0, 100, 1, '%'],
                ['Speed', 'speed', 0.5, 30, 0.5, ' Hz'],
                ['Edge Feather', 'feather', 0, 60, 1, 'px'],
                ['Region Padding', 'regionScale', 100, 200, 5, '%'],
              ] as const).map(([label, key, min, max, step, unit]) => (
                <div key={key}>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[10px] text-[#a0a0a0] font-medium">{label}</label>
                    <span className="text-[10px] text-orange-400 font-mono">
                      {(effect[key] as number) ?? 0}{unit}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={(effect[key] as number) ?? 0}
                    onChange={(e) => patch(index, { [key]: parseFloat(e.target.value) } as any)}
                    onMouseUp={() => useEditorStore.getState().saveSnapshot('Adjust Motion Effect')}
                    className="w-full h-1 bg-[#2a2a2a] rounded-lg accent-orange-500 cursor-pointer"
                  />
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
