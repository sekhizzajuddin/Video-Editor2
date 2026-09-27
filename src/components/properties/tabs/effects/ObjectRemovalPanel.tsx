import React from 'react';
import type { TimelineClip, ClipObjectRemovalSettings, ObjectRemovalMode, ObjectRemovalShape } from '@/types';
import { useEditorStore } from '@/store/editorStore';
import { getAnimatedValue, addOrUpdateKeyframe } from '@/utils/keyframes';
import { KeyframeControl } from '@/components/KeyframeControls';
import { usePlaybackTime } from '@/hooks/usePlaybackTime';

import { WATERMARK_PRESETS } from '@/utils/watermarkPresets';

interface ObjectRemovalPanelProps {
  selectedClip: TimelineClip;
}

const defaultSettings: ClipObjectRemovalSettings = {
  enabled: false,
  mode: 'content_aware',
  shape: 'rectangle',
  x: 50,
  y: 50,
  width: 25,
  height: 25,
  rotation: 0,
  feather: 12,
  opacity: 100,
  stretchStrength: 80,
  patchSourceX: 25,
  patchSourceY: 25,
  showHighlight: true,
  temporalSmoothing: true,
  quality: 'preview',
};

export function ObjectRemovalPanel({ selectedClip }: ObjectRemovalPanelProps) {
  const updateClip = useEditorStore((state) => state.updateClip);
  const saveSnapshot = useEditorStore((state) => state.saveSnapshot);
  const openWatermarkRemover = useEditorStore((state) => state.openWatermarkRemover);
  const currentTime = usePlaybackTime(10);

  const or = selectedClip.objectRemoval || defaultSettings;
  const animations = selectedClip.animations || {};
  const localTime = Math.max(0, currentTime - (selectedClip.startTime ?? 0));

  const getVal = (base: number | undefined, defaultVal: number, propKey: string): number => {
    return getAnimatedValue(
      base ?? defaultVal,
      currentTime,
      selectedClip.startTime ?? 0,
      animations[propKey]
    );
  };

  const updateOR = (patch: Partial<ClipObjectRemovalSettings>) => {
    updateClip(selectedClip.id, {
      objectRemoval: {
        ...or,
        ...patch,
      },
    });
  };

  const applyPreset = (preset: typeof WATERMARK_PRESETS[0]) => {
    updateClip(selectedClip.id, {
      objectRemoval: {
        ...or,
        enabled: true,
        x: preset.x,
        y: preset.y,
        width: preset.width,
        height: preset.height,
        feather: preset.feather,
        mode: preset.mode,
        shape: preset.shape,
        stretchStrength: preset.stretchStrength ?? 85,
      },
    });
    saveSnapshot(`Apply ${preset.name} Watermark Preset`);
  };

  const setSliderValue = (propKey: string, propName: keyof ClipObjectRemovalSettings, value: number) => {
    const kfs = animations[propKey] || [];
    const isOnKeyframe = kfs.some((k: any) => Math.abs(k.time - localTime) < 0.05);

    if (isOnKeyframe) {
      const updatedKfs = addOrUpdateKeyframe(kfs, localTime, value, { easing: 'linear' });
      updateClip(selectedClip.id, {
        objectRemoval: { ...or, [propName]: value },
        animations: { ...animations, [propKey]: updatedKfs },
      });
    } else {
      updateClip(selectedClip.id, {
        objectRemoval: { ...or, [propName]: value },
      });
    }
  };

  const handleAddKf = (propKey: string, val: number) => {
    const kfs = animations[propKey] || [];
    const updatedKfs = addOrUpdateKeyframe(kfs, localTime, val, { easing: 'linear' });
    updateClip(selectedClip.id, {
      animations: { ...animations, [propKey]: updatedKfs },
    });
  };

  const handleRemoveKf = (propKey: string) => {
    const kfs = animations[propKey] || [];
    const updatedKfs = kfs.filter((k: any) => Math.abs(k.time - localTime) > 0.03);
    updateClip(selectedClip.id, {
      animations: { ...animations, [propKey]: updatedKfs },
    });
  };



  const renderSliderControl = (
    label: string,
    propName: keyof ClipObjectRemovalSettings,
    propKey: string,
    val: number,
    min: number,
    max: number,
    step: number,
    unit: string = ''
  ) => {
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-[var(--theme-text-muted)] font-medium">{label}</span>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-cyan-400 font-mono">
              {val.toFixed(step < 1 ? 1 : 0)}{unit}
            </span>
            <KeyframeControl
              propertyKey={propKey}
              value={val}
              keyframes={animations[propKey] || []}
              currentTime={localTime}
              clipId={selectedClip.id}
              onAddKeyframe={(time, v) => handleAddKf(propKey, v)}
              onRemoveKeyframe={() => handleRemoveKf(propKey)}
            />
          </div>
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={val}
          onChange={(e) => setSliderValue(propKey, propName, parseFloat(e.target.value))}
          onMouseUp={() => saveSnapshot()}
          className="w-full h-1.5 bg-[#1a1a2e] rounded-lg appearance-none cursor-pointer accent-cyan-500 hover:accent-cyan-400 transition-all"
        />
      </div>
    );
  };

  return (
    <div className="bg-[var(--theme-bg-card)] rounded-xl border border-cyan-500/30 p-3.5 space-y-4 shadow-sm">
      {/* Header with Enable Switch & Watermark Studio Button */}
      <div className="flex items-center justify-between pb-2.5 border-b border-[var(--theme-border)]">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-[var(--theme-text-primary)]">
            ✨ AI Watermark & Object Remover
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => openWatermarkRemover(selectedClip.id)}
            className="px-2 py-0.5 text-[10px] font-bold bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-500 dark:text-cyan-300 border border-cyan-500/30 rounded-md transition-all shadow-sm"
            title="Open large interactive Watermark Remover Studio"
          >
            Studio
          </button>
          <button
            onClick={() => {
              updateOR({ enabled: !or.enabled });
              saveSnapshot();
            }}
            className={`w-8 h-4 rounded-full transition-all relative ${
              or.enabled ? 'bg-cyan-500 shadow-sm' : 'bg-[var(--theme-bg-subpanel)] border border-[var(--theme-border)]'
            }`}
          >
            <div
              className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform shadow-sm ${
                or.enabled ? 'left-[17px]' : 'left-[1px]'
              }`}
            />
          </button>
        </div>
      </div>

      {/* 1-Click Watermark Corner Presets */}
      <div className="space-y-1.5 bg-[var(--theme-bg-subpanel)] p-2.5 rounded-lg border border-[var(--theme-border)]">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-[var(--theme-text-muted)] tracking-wider uppercase">
            ⚡ Quick Watermark Presets
          </span>
        </div>
        <div className="grid grid-cols-4 gap-1 pt-1">
          {WATERMARK_PRESETS.slice(0, 4).map((p) => (
            <button
              key={p.id}
              onClick={() => applyPreset(p)}
              className="py-1 px-1.5 rounded bg-black/10 dark:bg-white/5 hover:bg-cyan-500/20 border border-[var(--theme-border)] hover:border-cyan-500/40 text-[10px] font-medium text-slate-300 hover:text-cyan-300 text-center transition-all truncate"
              title={`${p.name}: ${p.description}`}
            >
              {p.icon} {p.name.replace(' ', '')}
            </button>
          ))}
        </div>
      </div>

      {or.enabled && (
        <div className="space-y-4 pt-1 animate-fadeIn">
          {/* Mode Selector 2x2 Grid */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold text-[var(--theme-text-muted)] tracking-wider uppercase">Inpainting Engine Mode</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => { updateOR({ mode: 'content_aware' }); saveSnapshot(); }}
                className={`p-2.5 rounded-lg text-[11px] font-bold transition-all text-left border ${
                  or.mode === 'content_aware'
                    ? 'bg-cyan-500/20 border-cyan-500 text-cyan-600 dark:text-cyan-300 shadow-sm'
                    : 'bg-[var(--theme-bg-subpanel)] border-[var(--theme-border)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)]'
                }`}
              >
                🔮 Content-Aware
              </button>
              <button
                onClick={() => { updateOR({ mode: 'patch_replace' }); saveSnapshot(); }}
                className={`p-2.5 rounded-lg text-[11px] font-bold transition-all text-left border ${
                  or.mode === 'patch_replace'
                    ? 'bg-cyan-500/20 border-cyan-500 text-cyan-600 dark:text-cyan-300 shadow-sm'
                    : 'bg-[var(--theme-bg-subpanel)] border-[var(--theme-border)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)]'
                }`}
              >
                📋 Patch Replace
              </button>
              <button
                onClick={() => { updateOR({ mode: 'blur_conceal' }); saveSnapshot(); }}
                className={`p-2.5 rounded-lg text-[11px] font-bold transition-all text-left border ${
                  or.mode === 'blur_conceal'
                    ? 'bg-cyan-500/20 border-cyan-500 text-cyan-600 dark:text-cyan-300 shadow-sm'
                    : 'bg-[var(--theme-bg-subpanel)] border-[var(--theme-border)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)]'
                }`}
              >
                💧 Blur Conceal
              </button>
              <button
                onClick={() => { updateOR({ mode: 'pixelate' }); saveSnapshot(); }}
                className={`p-2.5 rounded-lg text-[11px] font-bold transition-all text-left border ${
                  or.mode === 'pixelate'
                    ? 'bg-cyan-500/20 border-cyan-500 text-cyan-600 dark:text-cyan-300 shadow-sm'
                    : 'bg-[var(--theme-bg-subpanel)] border-[var(--theme-border)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)]'
                }`}
              >
                🔲 Mosaic Pixelate
              </button>
            </div>
          </div>

          {/* Mask Shape and Quality Selector Row */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="space-y-1">
              <span className="text-[10px] text-[var(--theme-text-muted)] font-semibold uppercase">Mask Shape</span>
              <div className="flex bg-[var(--theme-bg-subpanel)] p-1 rounded-lg border border-[var(--theme-border)]">
                {(['rectangle', 'ellipse'] as ObjectRemovalShape[]).map((shape) => (
                  <button
                    key={shape}
                    onClick={() => { updateOR({ shape }); saveSnapshot(); }}
                    className={`flex-1 py-1 text-[10px] font-semibold capitalize rounded-md transition-all ${
                      or.shape === shape ? 'bg-cyan-600 text-white shadow-sm' : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)]'
                    }`}
                  >
                    {shape}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] text-[var(--theme-text-muted)] font-semibold uppercase">Render Quality</span>
              <div className="flex bg-[var(--theme-bg-subpanel)] p-1 rounded-lg border border-[var(--theme-border)]">
                {(['preview', 'export'] as const).map((q) => (
                  <button
                    key={q}
                    onClick={() => { updateOR({ quality: q }); saveSnapshot(); }}
                    className={`flex-1 py-1 text-[10px] font-semibold capitalize rounded-md transition-all ${
                      or.quality === q ? 'bg-blue-600 text-white shadow-sm' : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)]'
                    }`}
                  >
                    {q === 'preview' ? 'Fast 60fps' : 'Studio High'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Helper Switches */}
          <div className="bg-[var(--theme-bg-subpanel)] p-3 rounded-xl border border-[var(--theme-border)] space-y-2">
            <label className="flex items-center justify-between cursor-pointer select-none">
              <span className="text-[11px] text-cyan-600 dark:text-cyan-400 font-semibold flex items-center gap-1.5">
                🎯 Show Target Outline Guide
              </span>
              <input
                type="checkbox"
                checked={or.showHighlight ?? true}
                onChange={(e) => { updateOR({ showHighlight: e.target.checked }); saveSnapshot(); }}
                className="rounded accent-cyan-500 cursor-pointer"
              />
            </label>
            <label className="flex items-center justify-between cursor-pointer select-none">
              <span className="text-[11px] text-[var(--theme-text-muted)] font-semibold">
                ⚡ Temporal Frame Smoothing
              </span>
              <input
                type="checkbox"
                checked={or.temporalSmoothing ?? true}
                onChange={(e) => { updateOR({ temporalSmoothing: e.target.checked }); saveSnapshot(); }}
                className="rounded accent-cyan-500 cursor-pointer"
              />
            </label>
          </div>

          {/* Position and Geometry Sliders */}
          <div className="space-y-3 pt-1 border-t border-[var(--theme-border)]">
            <span className="text-[10px] font-bold text-[var(--theme-text-muted)] tracking-wider uppercase block">Target Mask Placement</span>
            {renderSliderControl('Center X Position', 'x', 'objectRemoval.x', getVal(or.x, 50, 'objectRemoval.x'), 0, 100, 0.5, '%')}
            {renderSliderControl('Center Y Position', 'y', 'objectRemoval.y', getVal(or.y, 50, 'objectRemoval.y'), 0, 100, 0.5, '%')}
            {renderSliderControl('Box Width', 'width', 'objectRemoval.width', getVal(or.width, 25, 'objectRemoval.width'), 1, 100, 0.5, '%')}
            {renderSliderControl('Box Height', 'height', 'objectRemoval.height', getVal(or.height, 25, 'objectRemoval.height'), 1, 100, 0.5, '%')}
            {renderSliderControl('Rotation Angle', 'rotation', 'objectRemoval.rotation', getVal(or.rotation, 0, 'objectRemoval.rotation'), -180, 180, 1, '°')}
            {renderSliderControl('Edge Feather Softness', 'feather', 'objectRemoval.feather', getVal(or.feather, 12, 'objectRemoval.feather'), 0, 50, 1, 'px')}
            {renderSliderControl('Removal Opacity Mix', 'opacity', 'objectRemoval.opacity', getVal(or.opacity, 100, 'objectRemoval.opacity'), 0, 100, 1, '%')}
          </div>

          {/* Mode Specific Controls */}
          {or.mode === 'content_aware' && (
            <div className="bg-cyan-500/10 p-3 rounded-xl border border-cyan-500/20 space-y-2 mt-2">
              <span className="text-[11px] font-bold text-cyan-600 dark:text-cyan-400 block">🔮 Content-Aware Diffusion</span>
              {renderSliderControl('Inward Stretch Strength', 'stretchStrength', 'objectRemoval.stretchStrength', getVal(or.stretchStrength, 80, 'objectRemoval.stretchStrength'), 1, 100, 1, '%')}
            </div>
          )}

          {or.mode === 'patch_replace' && (
            <div className="bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20 space-y-3 mt-2">
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 block">📋 Clone Stamp Source</span>
              {renderSliderControl('Source Sampling X', 'patchSourceX', 'objectRemoval.patchSourceX', getVal(or.patchSourceX, 30, 'objectRemoval.patchSourceX'), 0, 100, 0.5, '%')}
              {renderSliderControl('Source Sampling Y', 'patchSourceY', 'objectRemoval.patchSourceY', getVal(or.patchSourceY, 30, 'objectRemoval.patchSourceY'), 0, 100, 0.5, '%')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export { ObjectRemovalPanel as ObjectRemovalSection };
