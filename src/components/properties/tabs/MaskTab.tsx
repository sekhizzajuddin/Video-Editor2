/**
 * MaskTab.tsx — Vector Bezier & Shape Masking Property Inspector.
 *
 * Provides interactive preset shape selection (Rectangle, Ellipse, Polygon, Custom Bezier),
 * soft edge feathering (0-50px), invert mask toggle, expansion/choke offset (-50px to +50px),
 * and mask opacity controls for timeline clips.
 */

import React from 'react';
import type { TimelineClip, ClipVectorMaskSettings } from '@/types';
import { createPresetVectorMask } from '@/utils/vectorMaskEngine';
import { Square, Circle, Pentagon, PenTool, Eye, EyeOff, Sliders, RotateCcw, Sparkles } from 'lucide-react';

interface MaskTabProps {
  selectedClip: TimelineClip;
  updateClip: (clipId: string, updates: any) => void;
}

export function MaskTab({ selectedClip, updateClip }: MaskTabProps) {
  const vectorMask: ClipVectorMaskSettings = selectedClip.vectorMask || {
    enabled: false,
    shapeType: 'rectangle',
    points: [
      { x: 10, y: 10 },
      { x: 90, y: 10 },
      { x: 90, y: 90 },
      { x: 10, y: 90 },
    ],
    closed: true,
    feather: 0,
    inverted: false,
    expansion: 0,
    opacity: 100,
  };

  const handleToggleMask = () => {
    if (!selectedClip.vectorMask) {
      updateClip(selectedClip.id, { vectorMask: createPresetVectorMask('rectangle') });
    } else {
      updateClip(selectedClip.id, {
        vectorMask: { ...vectorMask, enabled: !vectorMask.enabled },
      });
    }
  };

  const handleSelectShapePreset = (shapeType: 'rectangle' | 'ellipse' | 'polygon' | 'bezier') => {
    const newMask = createPresetVectorMask(shapeType);
    updateClip(selectedClip.id, { vectorMask: newMask });
  };

  const handleUpdateVectorMask = (updates: Partial<ClipVectorMaskSettings>) => {
    updateClip(selectedClip.id, {
      vectorMask: { ...vectorMask, ...updates },
    });
  };

  return (
    <div className="space-y-5 text-xs text-zinc-300">
      {/* Enable Mask Header */}
      <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
        <div className="flex items-center gap-2">
          <PenTool className="h-4 w-4 text-indigo-400" />
          <span className="font-semibold text-white">Vector Bezier Mask</span>
        </div>
        <button
          onClick={handleToggleMask}
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
            vectorMask.enabled
              ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
              : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white'
          }`}
        >
          {vectorMask.enabled ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          {vectorMask.enabled ? 'Enabled' : 'Disabled'}
        </button>
      </div>

      {vectorMask.enabled && (
        <>
          {/* Preset Shape Selector */}
          <div className="space-y-2">
            <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Mask Shape Preset</label>
            <div className="grid grid-cols-4 gap-2">
              <button
                onClick={() => handleSelectShapePreset('rectangle')}
                className={`flex flex-col items-center justify-center gap-1.5 rounded-lg border p-2.5 transition-all ${
                  vectorMask.shapeType === 'rectangle'
                    ? 'border-indigo-500 bg-indigo-950/40 text-indigo-300 shadow-md'
                    : 'border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700 hover:text-white'
                }`}
              >
                <Square className="h-4 w-4" />
                <span className="text-[10px] font-medium">Rectangle</span>
              </button>

              <button
                onClick={() => handleSelectShapePreset('ellipse')}
                className={`flex flex-col items-center justify-center gap-1.5 rounded-lg border p-2.5 transition-all ${
                  vectorMask.shapeType === 'ellipse'
                    ? 'border-indigo-500 bg-indigo-950/40 text-indigo-300 shadow-md'
                    : 'border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700 hover:text-white'
                }`}
              >
                <Circle className="h-4 w-4" />
                <span className="text-[10px] font-medium">Ellipse</span>
              </button>

              <button
                onClick={() => handleSelectShapePreset('polygon')}
                className={`flex flex-col items-center justify-center gap-1.5 rounded-lg border p-2.5 transition-all ${
                  vectorMask.shapeType === 'polygon'
                    ? 'border-indigo-500 bg-indigo-950/40 text-indigo-300 shadow-md'
                    : 'border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700 hover:text-white'
                }`}
              >
                <Pentagon className="h-4 w-4" />
                <span className="text-[10px] font-medium">Polygon</span>
              </button>

              <button
                onClick={() => handleSelectShapePreset('bezier')}
                className={`flex flex-col items-center justify-center gap-1.5 rounded-lg border p-2.5 transition-all ${
                  vectorMask.shapeType === 'bezier'
                    ? 'border-indigo-500 bg-indigo-950/40 text-indigo-300 shadow-md'
                    : 'border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700 hover:text-white'
                }`}
              >
                <PenTool className="h-4 w-4" />
                <span className="text-[10px] font-medium">Bezier</span>
              </button>
            </div>
          </div>

          {/* Mask Parameters */}
          <div className="space-y-4 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3.5">
            {/* Soft Feathering */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-zinc-400 font-medium">Feather (Soft Edge)</span>
                <span className="font-mono text-indigo-300">{vectorMask.feather}px</span>
              </div>
              <input
                type="range"
                min={0}
                max={50}
                step={1}
                value={vectorMask.feather}
                onChange={(e) => handleUpdateVectorMask({ feather: Number(e.target.value) })}
                className="w-full h-1.5 bg-zinc-800 accent-indigo-500 rounded-lg cursor-pointer"
              />
            </div>

            {/* Expansion / Choke */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-zinc-400 font-medium">Expansion / Choke</span>
                <span className="font-mono text-indigo-300">{vectorMask.expansion > 0 ? `+${vectorMask.expansion}` : vectorMask.expansion}px</span>
              </div>
              <input
                type="range"
                min={-50}
                max={50}
                step={1}
                value={vectorMask.expansion}
                onChange={(e) => handleUpdateVectorMask({ expansion: Number(e.target.value) })}
                className="w-full h-1.5 bg-zinc-800 accent-indigo-500 rounded-lg cursor-pointer"
              />
            </div>

            {/* Mask Opacity */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-zinc-400 font-medium">Mask Opacity</span>
                <span className="font-mono text-indigo-300">{vectorMask.opacity}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={vectorMask.opacity}
                onChange={(e) => handleUpdateVectorMask({ opacity: Number(e.target.value) })}
                className="w-full h-1.5 bg-zinc-800 accent-indigo-500 rounded-lg cursor-pointer"
              />
            </div>

            {/* Invert Mask Toggle */}
            <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80">
              <span className="text-[11px] font-medium text-zinc-300">Invert Mask (Clip Out)</span>
              <button
                onClick={() => handleUpdateVectorMask({ inverted: !vectorMask.inverted })}
                className={`px-3 py-1 rounded text-[11px] font-semibold transition-colors ${
                  vectorMask.inverted
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white'
                }`}
              >
                {vectorMask.inverted ? 'Inverted (Clip Out)' : 'Standard (Clip In)'}
              </button>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center justify-between pt-1">
            <button
              onClick={() => handleSelectShapePreset(vectorMask.shapeType)}
              className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-white transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              Reset Shape Points
            </button>
          </div>
        </>
      )}
    </div>
  );
}
