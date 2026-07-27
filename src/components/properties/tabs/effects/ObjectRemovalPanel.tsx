import React from 'react';
import type { TimelineClip, ClipObjectRemovalSettings, ObjectRemovalMode, ObjectRemovalShape } from '@/types';
import { useEditorStore } from '@/store/editorStore';
import { getAnimatedValue, addOrUpdateKeyframe } from '@/utils/keyframes';
import { KeyframeControl } from '@/components/KeyframeControls';

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
  const currentTime = useEditorStore((state) => state.currentTime);

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
          <span className="text-[11px] text-[#a0a0a0] font-medium">{label}</span>
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
    <div className="bg-[#21212a] rounded-lg border border-[#363645] p-3.5 space-y-4 text-white shadow-lg">
      {/* Header with Enable Switch */}
      <div className="flex items-center justify-between pb-2 border-b border-[#323242]">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
            ✨ AI Object Remove & Inpainting
          </span>
        </div>
        <button
          onClick={() => {
            updateOR({ enabled: !or.enabled });
            saveSnapshot();
          }}
          className={`w-9 h-5 rounded-full transition-all relative ${
            or.enabled ? 'bg-cyan-500 shadow-[0_0_12px_rgba(6,182,212,0.5)]' : 'bg-[#3e3e4e]'
          }`}
        >
          <div
            className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
              or.enabled ? 'left-[18px]' : 'left-[2px]'
            }`}
          />
        </button>
      </div>

      {or.enabled && (
        <div className="space-y-4 pt-1 animate-fadeIn">
          {/* Mode Selector 2x2 Grid */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold text-[#b8b8cc] tracking-wide uppercase">Inpainting Engine Mode</span>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => { updateOR({ mode: 'content_aware' }); saveSnapshot(); }}
                className={`p-2 rounded text-[11px] font-medium transition-all text-left border ${
                  or.mode === 'content_aware'
                    ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 font-semibold shadow-[0_0_8px_rgba(6,182,212,0.3)]'
                    : 'bg-[#181822] border-[#2e2e3e] text-[#9090a8] hover:border-[#46465e]'
                }`}
              >
                🔮 Content-Aware
              </button>
              <button
                onClick={() => { updateOR({ mode: 'patch_replace' }); saveSnapshot(); }}
                className={`p-2 rounded text-[11px] font-medium transition-all text-left border ${
                  or.mode === 'patch_replace'
                    ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 font-semibold shadow-[0_0_8px_rgba(6,182,212,0.3)]'
                    : 'bg-[#181822] border-[#2e2e3e] text-[#9090a8] hover:border-[#46465e]'
                }`}
              >
                📋 Patch Replace
              </button>
              <button
                onClick={() => { updateOR({ mode: 'blur_conceal' }); saveSnapshot(); }}
                className={`p-2 rounded text-[11px] font-medium transition-all text-left border ${
                  or.mode === 'blur_conceal'
                    ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 font-semibold shadow-[0_0_8px_rgba(6,182,212,0.3)]'
                    : 'bg-[#181822] border-[#2e2e3e] text-[#9090a8] hover:border-[#46465e]'
                }`}
              >
                💧 Blur Conceal
              </button>
              <button
                onClick={() => { updateOR({ mode: 'pixelate' }); saveSnapshot(); }}
                className={`p-2 rounded text-[11px] font-medium transition-all text-left border ${
                  or.mode === 'pixelate'
                    ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 font-semibold shadow-[0_0_8px_rgba(6,182,212,0.3)]'
                    : 'bg-[#181822] border-[#2e2e3e] text-[#9090a8] hover:border-[#46465e]'
                }`}
              >
                🔲 Mosaic Pixelate
              </button>
            </div>
          </div>

          {/* Mask Shape and Quality Selector Row */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="space-y-1">
              <span className="text-[11px] text-[#b8b8cc] font-medium">Mask Shape</span>
              <div className="flex bg-[#181822] p-1 rounded border border-[#2e2e3e]">
                {(['rectangle', 'ellipse'] as ObjectRemovalShape[]).map((shape) => (
                  <button
                    key={shape}
                    onClick={() => { updateOR({ shape }); saveSnapshot(); }}
                    className={`flex-1 py-1 text-[10px] capitalize rounded transition-colors ${
                      or.shape === shape ? 'bg-cyan-600 text-white font-semibold' : 'text-[#808098] hover:text-white'
                    }`}
                  >
                    {shape}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] text-[#b8b8cc] font-medium">Render Quality</span>
              <div className="flex bg-[#181822] p-1 rounded border border-[#2e2e3e]">
                {(['preview', 'export'] as const).map((q) => (
                  <button
                    key={q}
                    onClick={() => { updateOR({ quality: q }); saveSnapshot(); }}
                    className={`flex-1 py-1 text-[10px] capitalize rounded transition-colors ${
                      or.quality === q ? 'bg-blue-600 text-white font-semibold' : 'text-[#808098] hover:text-white'
                    }`}
                  >
                    {q === 'preview' ? 'Fast 60fps' : 'Studio High'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Helper Switches */}
          <div className="bg-[#181822] p-2.5 rounded-md border border-[#2e2e3e] space-y-2">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-[11px] text-cyan-300 font-medium flex items-center gap-1.5">
                🎯 Show Target Area Outline Guide
              </span>
              <input
                type="checkbox"
                checked={or.showHighlight ?? true}
                onChange={(e) => { updateOR({ showHighlight: e.target.checked }); saveSnapshot(); }}
                className="rounded text-cyan-500 bg-[#282838] border-[#404058] focus:ring-0 cursor-pointer"
              />
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-[11px] text-[#a0a0b8]">
                ⚡ Temporal Frame Smoothing
              </span>
              <input
                type="checkbox"
                checked={or.temporalSmoothing ?? true}
                onChange={(e) => { updateOR({ temporalSmoothing: e.target.checked }); saveSnapshot(); }}
                className="rounded text-cyan-500 bg-[#282838] border-[#404058] focus:ring-0 cursor-pointer"
              />
            </label>
          </div>

          {/* Position and Geometry Sliders */}
          <div className="space-y-3 pt-1">
            <span className="text-[11px] font-semibold text-[#b8b8cc] tracking-wide uppercase block">Target Mask Placement</span>
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
            <div className="bg-gradient-to-br from-cyan-950/40 to-blue-950/40 p-3 rounded border border-cyan-800/50 space-y-2 mt-2">
              <span className="text-[11px] font-semibold text-cyan-300 block">🔮 Content-Aware Diffusion Tuning</span>
              {renderSliderControl('Inward Stretch Strength', 'stretchStrength', 'objectRemoval.stretchStrength', getVal(or.stretchStrength, 80, 'objectRemoval.stretchStrength'), 1, 100, 1, '%')}
            </div>
          )}

          {or.mode === 'patch_replace' && (
            <div className="bg-gradient-to-br from-blue-950/40 to-emerald-950/40 p-3 rounded border border-emerald-800/50 space-y-3 mt-2">
              <span className="text-[11px] font-semibold text-emerald-300 block">📋 Clone Stamp Reference Source</span>
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
