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
    <div className="space-y-4 text-xs text-[var(--theme-text-primary)] p-4">
      {/* Enable Mask Header */}
      <div className="flex items-center justify-between rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg-card)] p-3.5 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500">
            <PenTool className="h-4 w-4" />
          </div>
          <span className="font-bold text-xs text-[var(--theme-text-primary)]">Vector Bezier Mask</span>
        </div>
        <button
          onClick={handleToggleMask}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold transition-all ${
            vectorMask.enabled
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm shadow-blue-500/20'
              : 'bg-[var(--theme-bg-subpanel)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)] border border-[var(--theme-border)]'
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
            <label className="text-[10px] font-bold text-[var(--theme-text-muted)] uppercase tracking-wider">Mask Shape Preset</label>
            <div className="grid grid-cols-4 gap-2">
              <button
                onClick={() => handleSelectShapePreset('rectangle')}
                className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border p-3 transition-all ${
                  vectorMask.shapeType === 'rectangle'
                    ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold shadow-sm'
                    : 'border-[var(--theme-border)] bg-[var(--theme-bg-card)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)] hover:border-blue-500/30'
                }`}
              >
                <Square className="h-4 w-4" />
                <span className="text-[10px] font-semibold">Rectangle</span>
              </button>

              <button
                onClick={() => handleSelectShapePreset('ellipse')}
                className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border p-3 transition-all ${
                  vectorMask.shapeType === 'ellipse'
                    ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold shadow-sm'
                    : 'border-[var(--theme-border)] bg-[var(--theme-bg-card)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)] hover:border-blue-500/30'
                }`}
              >
                <Circle className="h-4 w-4" />
                <span className="text-[10px] font-semibold">Ellipse</span>
              </button>

              <button
                onClick={() => handleSelectShapePreset('polygon')}
                className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border p-3 transition-all ${
                  vectorMask.shapeType === 'polygon'
                    ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold shadow-sm'
                    : 'border-[var(--theme-border)] bg-[var(--theme-bg-card)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)] hover:border-blue-500/30'
                }`}
              >
                <Pentagon className="h-4 w-4" />
                <span className="text-[10px] font-semibold">Polygon</span>
              </button>

              <button
                onClick={() => handleSelectShapePreset('bezier')}
                className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border p-3 transition-all ${
                  vectorMask.shapeType === 'bezier'
                    ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold shadow-sm'
                    : 'border-[var(--theme-border)] bg-[var(--theme-bg-card)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)] hover:border-blue-500/30'
                }`}
              >
                <PenTool className="h-4 w-4" />
                <span className="text-[10px] font-semibold">Bezier</span>
              </button>
            </div>
          </div>

          {/* Mask Parameters */}
          <div className="space-y-4 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg-card)] p-4 shadow-sm">
            {/* Soft Feathering */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[var(--theme-text-muted)] font-medium">Feather (Soft Edge)</span>
                <span className="font-mono text-blue-600 dark:text-blue-400 font-bold">{vectorMask.feather}px</span>
              </div>
              <input
                type="range"
                min={0}
                max={50}
                step={1}
                value={vectorMask.feather}
                onChange={(e) => handleUpdateVectorMask({ feather: Number(e.target.value) })}
                className="w-full h-1 bg-[var(--theme-border)] accent-blue-600 rounded-full cursor-pointer"
              />
            </div>

            {/* Expansion / Choke */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[var(--theme-text-muted)] font-medium">Expansion / Choke</span>
                <span className="font-mono text-blue-600 dark:text-blue-400 font-bold">{vectorMask.expansion > 0 ? `+${vectorMask.expansion}` : vectorMask.expansion}px</span>
              </div>
              <input
                type="range"
                min={-50}
                max={50}
                step={1}
                value={vectorMask.expansion}
                onChange={(e) => handleUpdateVectorMask({ expansion: Number(e.target.value) })}
                className="w-full h-1 bg-[var(--theme-border)] accent-blue-600 rounded-full cursor-pointer"
              />
            </div>

            {/* Mask Opacity */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[var(--theme-text-muted)] font-medium">Mask Opacity</span>
                <span className="font-mono text-blue-600 dark:text-blue-400 font-bold">{vectorMask.opacity}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={vectorMask.opacity}
                onChange={(e) => handleUpdateVectorMask({ opacity: Number(e.target.value) })}
                className="w-full h-1 bg-[var(--theme-border)] accent-blue-600 rounded-full cursor-pointer"
              />
            </div>

            {/* Invert Mask Toggle */}
            <div className="flex items-center justify-between pt-3 border-t border-[var(--theme-border)]">
              <span className="text-[11px] font-semibold text-[var(--theme-text-primary)]">Invert Mask (Clip Out)</span>
              <button
                onClick={() => handleUpdateVectorMask({ inverted: !vectorMask.inverted })}
                className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${
                  vectorMask.inverted
                    ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                    : 'bg-[var(--theme-bg-subpanel)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)] border border-[var(--theme-border)]'
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
              className="flex items-center gap-1.5 text-[11px] text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)] font-medium transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset Shape Points
            </button>
          </div>
        </>
      )}
    </div>
  );
}
