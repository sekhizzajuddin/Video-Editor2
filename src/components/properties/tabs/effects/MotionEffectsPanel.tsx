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
import { Activity, Crosshair, Plus, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { TimelineClip, CornerPoints } from '@/types';
import { useEditorStore } from '@/store/editorStore';
import { trackMotion } from '@/utils/motionTracker';
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

/** A centred default box — big enough to grab, small enough to reposition. */
function defaultCorners(): CornerPoints {
  const cx = 427;
  const cy = 240;
  const half = 70;
  return {
    x0: cx - half, y0: cy - half,
    x1: cx + half, y1: cy - half,
    x2: cx + half, y2: cy + half,
    x3: cx - half, y3: cy + half,
  };
}

function rectOf(c: CornerPoints) {
  const xs = [c.x0, c.x1, c.x2, c.x3];
  const ys = [c.y0, c.y1, c.y2, c.y3];
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, w: maxX - minX, h: maxY - minY };
}

function cornersFrom(cx: number, cy: number, w: number, h: number): CornerPoints {
  const hw = Math.max(8, w) / 2;
  const hh = Math.max(8, h) / 2;
  return {
    x0: cx - hw, y0: cy - hh,
    x1: cx + hw, y1: cy - hh,
    x2: cx + hw, y2: cy + hh,
    x3: cx - hw, y3: cy + hh,
  };
}

export function MotionEffectsPanel({ selectedClip, videoElements }: MotionEffectsPanelProps) {
  const updateClip = useEditorStore((s) => s.updateClip);
  const [trackingIndex, setTrackingIndex] = useState<number | null>(null);
  const [trackProgress, setTrackProgress] = useState(0);

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
        baseCorners: defaultCorners(),
      },
    ]);
    useEditorStore.getState().saveSnapshot('Add Motion Effect');
  };

  const removeEffect = (index: number) => {
    writeEffects(effects.filter((_, i) => i !== index));
    useEditorStore.getState().saveSnapshot('Remove Motion Effect');
  };

  const runTracking = async (index: number) => {
    const effect = effects[index];
    const videoEl = videoElements.get(selectedClip.id);

    if (!videoEl) {
      toast.error('Video not loaded yet — move the playhead over this clip first.');
      return;
    }
    if (!effect.baseCorners) {
      toast.error('Position the region box first.');
      return;
    }

    const store = useEditorStore.getState();
    const clipLocalTime = Math.max(0, store.currentTime - selectedClip.startTime);
    const remaining = Math.max(0.1, selectedClip.duration - clipLocalTime);

    setTrackingIndex(index);
    setTrackProgress(0);

    try {
      const results = await trackMotion(
        videoEl,
        store.currentTime,
        remaining,
        effect.baseCorners,
        (progress) => setTrackProgress(Math.round(progress * 100))
      );

      // Store times RELATIVE to the clip so the track stays valid if the clip is
      // moved along the timeline.
      const track = results.map((r) => ({
        time: Math.max(0, r.time - selectedClip.startTime),
        corners: r.corners,
      }));

      patch(index, { track });
      useEditorStore.getState().saveSnapshot('Track Motion Region');
      toast.success(`Tracked ${track.length} frames — the effect now follows the subject.`);
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
            Press <span className="text-orange-400">+</span> to add one.
          </p>
        )}

        {effects.map((effect, index) => {
          const info = MOTION_EFFECT_INFO.find((m) => m.type === effect.type);
          const r = rectOf(effect.baseCorners ?? defaultCorners());
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
              </div>

              {/* Region placement */}
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
                          patch(index, { baseCorners: build(v), track: undefined });
                        }}
                        className="w-full px-1.5 py-1 bg-[#1e1e1e] border border-[#3e3e3e] rounded text-[10px] text-white focus:outline-none focus:border-orange-500"
                      />
                    </div>
                  ))}
                </div>
                <p className="text-[9px] text-[#707070]">
                  Coordinates are in preview space (854 x 480). Place the box over the feature, then track.
                </p>
              </div>

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
