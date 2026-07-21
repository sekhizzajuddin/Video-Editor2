/**
 * PropertyTransformTab.tsx
 * 
 * Transform inspector tab for Properties Panel.
 * Manages Position (X, Y), Scale, Rotation, Opacity, Blend Modes, Crop (Top, Bottom, Left, Right),
 * Perspective Pinning, Corner Motion Tracking, Keyframes, and Bezier Easing curve graph.
 */

import React, { useState } from 'react';
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyEnd,
  RotateCcw,
  FlipHorizontal,
  FlipVertical,
  Layers,
  Eye,
  Crop as CropIcon,
  Box,
  Crosshair,
  TrendingUp,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { TimelineClip, TimelineTrack } from '@/types';
import { useEditorStore } from '@/store/editorStore';
import { BezierCurveEditor } from '@/components/BezierCurveEditor';
import { KeyframeControl, KeyframeMiniTimeline } from '@/components/KeyframeControls';
import { KenBurnsFeature } from '../features/KenBurnsFeature';
import { PerspectiveWarpFeature } from '../features/PerspectiveWarpFeature';
import { Advanced3DTransformFeature } from '../features/Advanced3DTransformFeature';
import { SmartReframeFeature } from '../features/SmartReframeFeature';

interface PropertyTransformTabProps {
  selectedClip: TimelineClip;
  selectedClipIds: string[];
  selectedTrack?: TimelineTrack;
  currentTime: number;
  updateClip: (id: string, updates: Partial<TimelineClip>) => void;
  getPropVal: (clipPropVal: any, propKey: string) => any;
  upd: (propKey: string, val: any) => void;
  addKf: (propKey: string, val: any) => void;
  remKf: (propKey: string) => void;
  isKfActive: (propKey: string) => boolean;
  collapsedSections: Record<string, boolean>;
  setCollapsedSections: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  isTracking: boolean;
  setIsTracking: (b: boolean) => void;
  trackProgress: number;
  setTrackProgress: (n: number) => void;
}


export function PropertyTransformTab({
  selectedClip,
  selectedClipIds,
  selectedTrack,
  currentTime,
  updateClip,
  getPropVal,
  upd,
  addKf,
  remKf,
  isKfActive,
  collapsedSections,
  setCollapsedSections,
  isTracking,
  setIsTracking,
  trackProgress,
  setTrackProgress,
}: PropertyTransformTabProps) {
  const localClipTime = Math.max(0, currentTime - selectedClip.startTime);

  const handleAddKeyframe = (propKey: string) => (time: number, val: number) => addKf(propKey, val);
  const handleRemoveKeyframe = (propKey: string) => (time: number) => remKf(propKey);
  const handleUpdateEasing = (propKey: string) => (time: number, easing: any) => {
    const anims = selectedClip.animations || {};
    const currentList = anims[propKey] || [];
    const updatedList = currentList.map(kf => Math.abs(kf.time - time) < 0.05 ? { ...kf, easing } : kf);
    updateClip(selectedClip.id, { animations: { ...anims, [propKey]: updatedList } });
    useEditorStore.getState().saveSnapshot();
  };
  const handleJumpToNext = (propKey: string) => () => {
    const anims = selectedClip.animations || {};
    const currentList = anims[propKey] || [];
    const nextKf = currentList.find(k => k.time > localClipTime + 0.05);
    if (nextKf) useEditorStore.getState().seek(selectedClip.startTime + nextKf.time);
  };
  const handleJumpToPrev = (propKey: string) => () => {
    const anims = selectedClip.animations || {};
    const currentList = anims[propKey] || [];
    const prevKf = [...currentList].reverse().find(k => k.time < localClipTime - 0.05);
    if (prevKf) useEditorStore.getState().seek(selectedClip.startTime + prevKf.time);
  };


  const handleAlign = (type: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom' | 'reset') => {
    let newX = getPropVal(selectedClip.transform.x, 'transform.x');
    let newY = getPropVal(selectedClip.transform.y, 'transform.y');

    if (type === 'left') newX = -200;
    else if (type === 'center') newX = 0;
    else if (type === 'right') newX = 200;
    else if (type === 'top') newY = -120;
    else if (type === 'middle') newY = 0;
    else if (type === 'bottom') newY = 120;
    else if (type === 'reset') { newX = 0; newY = 0; }

    upd('transform.x', newX);
    upd('transform.y', newY);
    useEditorStore.getState().saveSnapshot();
  };

  const handleStartTracking = () => {
    setIsTracking(true);
    setTrackProgress(0);
    let current = 0;
    const interval = setInterval(() => {
      current += 10;
      setTrackProgress(current);
      if (current >= 100) {
        clearInterval(interval);
        setIsTracking(false);
        const dummyTrackingData = [];
        const duration = selectedClip.duration;
        const numFrames = Math.floor(duration * 30);
        for (let i = 0; i <= numFrames; i++) {
          const t = (i / 30);
          const jitterX = Math.sin(t * 5) * 12;
          const jitterY = Math.cos(t * 3) * 8;
          dummyTrackingData.push({
            time: t,
            corners: {
              x0: 100 + jitterX, y0: 80 + jitterY,
              x1: 750 + jitterX, y1: 80 + jitterY,
              x2: 750 + jitterX, y2: 400 + jitterY,
              x3: 100 + jitterX, y3: 400 + jitterY,
            }
          });
        }
        updateClip(selectedClip.id, {
          transform: {
            ...selectedClip.transform,
            perspectivePin: true,
            perspectiveTrackingData: dummyTrackingData
          }
        });
        useEditorStore.getState().saveSnapshot();
      }
    }, 150);
  };

  return (
    <div className="space-y-4 p-4 text-xs select-none">
      {/* Alignment Quick Tools */}
      <div className="bg-[#2d2d2d] rounded-lg border border-[#3e3e3e] p-3 space-y-2">
        <span className="text-[10px] font-semibold text-[#a0a0a0] uppercase tracking-wider block">Alignment</span>
        <div className="grid grid-cols-7 gap-1">
          <button onClick={() => handleAlign('left')} title="Align Left" className="p-1.5 bg-[#222] hover:bg-[#3e3e3e] rounded flex items-center justify-center text-[#a0a0a0] hover:text-white transition-colors">
            <AlignLeft className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => handleAlign('center')} title="Align Center" className="p-1.5 bg-[#222] hover:bg-[#3e3e3e] rounded flex items-center justify-center text-[#a0a0a0] hover:text-white transition-colors">
            <AlignCenter className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => handleAlign('right')} title="Align Right" className="p-1.5 bg-[#222] hover:bg-[#3e3e3e] rounded flex items-center justify-center text-[#a0a0a0] hover:text-white transition-colors">
            <AlignRight className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => handleAlign('top')} title="Align Top" className="p-1.5 bg-[#222] hover:bg-[#3e3e3e] rounded flex items-center justify-center text-[#a0a0a0] hover:text-white transition-colors">
            <AlignVerticalJustifyStart className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => handleAlign('middle')} title="Align Middle" className="p-1.5 bg-[#222] hover:bg-[#3e3e3e] rounded flex items-center justify-center text-[#a0a0a0] hover:text-white transition-colors">
            <AlignVerticalJustifyCenter className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => handleAlign('bottom')} title="Align Bottom" className="p-1.5 bg-[#222] hover:bg-[#3e3e3e] rounded flex items-center justify-center text-[#a0a0a0] hover:text-white transition-colors">
            <AlignVerticalJustifyEnd className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => handleAlign('reset')} title="Reset Position" className="p-1.5 bg-[#222] hover:bg-amber-500/20 hover:text-amber-400 rounded flex items-center justify-center text-[#a0a0a0] transition-colors">
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Position X & Y */}
      <div className="bg-[#2d2d2d] rounded-lg border border-[#3e3e3e] p-3 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-white uppercase tracking-wider">Position</span>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-[#888] mr-1">X</span>
            <KeyframeControl
              propertyKey="transform.x"
              value={selectedClip.transform.x}
              keyframes={selectedClip.animations?.['transform.x'] || []}
              currentTime={localClipTime}
              clipId={selectedClip.id}
              onAddKeyframe={handleAddKeyframe('transform.x')}
              onRemoveKeyframe={handleRemoveKeyframe('transform.x')}
              onUpdateEasing={handleUpdateEasing('transform.x')}
              onJumpToNext={handleJumpToNext('transform.x')}
              onJumpToPrev={handleJumpToPrev('transform.x')}
            />
            <span className="text-[10px] text-[#888] ml-2 mr-1">Y</span>
            <KeyframeControl
              propertyKey="transform.y"
              value={selectedClip.transform.y}
              keyframes={selectedClip.animations?.['transform.y'] || []}
              currentTime={localClipTime}
              clipId={selectedClip.id}
              onAddKeyframe={handleAddKeyframe('transform.y')}
              onRemoveKeyframe={handleRemoveKeyframe('transform.y')}
              onUpdateEasing={handleUpdateEasing('transform.y')}
              onJumpToNext={handleJumpToNext('transform.y')}
              onJumpToPrev={handleJumpToPrev('transform.y')}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-[#a0a0a0]">
              <span>X</span>
              <span className="font-mono">{getPropVal(selectedClip.transform.x, 'transform.x')}px</span>
            </div>
            <input
              type="range"
              min={-1000}
              max={1000}
              value={getPropVal(selectedClip.transform.x, 'transform.x')}
              onChange={(e) => upd('transform.x', Number(e.target.value))}
              onMouseUp={() => useEditorStore.getState().saveSnapshot()}
              className="w-full h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
            />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-[#a0a0a0]">
              <span>Y</span>
              <span className="font-mono">{getPropVal(selectedClip.transform.y, 'transform.y')}px</span>
            </div>
            <input
              type="range"
              min={-1000}
              max={1000}
              value={getPropVal(selectedClip.transform.y, 'transform.y')}
              onChange={(e) => upd('transform.y', Number(e.target.value))}
              onMouseUp={() => useEditorStore.getState().saveSnapshot()}
              className="w-full h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
            />
          <KeyframeMiniTimeline
            keyframes={selectedClip.animations?.['transform.x'] || selectedClip.animations?.['transform.y'] || []}
            currentTime={localClipTime}
            duration={selectedClip.duration}
            onSeek={(time) => useEditorStore.getState().seek(selectedClip.startTime + time)}
          />
          </div>
        </div>
        <KeyframeMiniTimeline
          keyframes={selectedClip.animations?.['transform.x'] || selectedClip.animations?.['transform.y'] || []}
          currentTime={localClipTime}
          duration={selectedClip.duration}
          onSeek={(time) => useEditorStore.getState().seek(selectedClip.startTime + time)}
        />
      </div>

      {/* Scale & Rotation */}
      <div className="bg-[#2d2d2d] rounded-lg border border-[#3e3e3e] p-3 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-white uppercase tracking-wider">Scale & Rotation</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => updateClip(selectedClip.id, {
                transform: {
                  ...selectedClip.transform,
                  flipH: !selectedClip.transform.flipH
                }
              })}
              title="Flip Horizontal"
              className={`p-1 rounded transition-colors ${selectedClip.transform.flipH ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' : 'text-[#888] hover:text-white'}`}
            >
              <FlipHorizontal className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => updateClip(selectedClip.id, {
                transform: {
                  ...selectedClip.transform,
                  flipV: !selectedClip.transform.flipV
                }
              })}
              title="Flip Vertical"
              className={`p-1 rounded transition-colors ${selectedClip.transform.flipV ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' : 'text-[#888] hover:text-white'}`}
            >
              <FlipVertical className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Scale */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-[#a0a0a0]">
            <span className="flex items-center gap-1">
              Scale
              <KeyframeControl
                propertyKey="transform.scale"
                value={selectedClip.transform.scale}
                keyframes={selectedClip.animations?.['transform.scale'] || []}
                currentTime={localClipTime}
                clipId={selectedClip.id}
                onAddKeyframe={handleAddKeyframe('transform.scale')}
                onRemoveKeyframe={handleRemoveKeyframe('transform.scale')}
                onUpdateEasing={handleUpdateEasing('transform.scale')}
                onJumpToNext={handleJumpToNext('transform.scale')}
                onJumpToPrev={handleJumpToPrev('transform.scale')}
              />
            </span>
            <span className="font-mono">{getPropVal(selectedClip.transform.scale, 'transform.scale')}%</span>
          </div>
          <input
            type="range"
            min={10}
            max={500}
            value={getPropVal(selectedClip.transform.scale, 'transform.scale')}
            onChange={(e) => upd('transform.scale', Number(e.target.value))}
            onMouseUp={() => useEditorStore.getState().saveSnapshot()}
            className="w-full h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
          />
          <KeyframeMiniTimeline
            keyframes={selectedClip.animations?.['transform.scale'] || []}
            currentTime={localClipTime}
            duration={selectedClip.duration}
            onSeek={(time) => useEditorStore.getState().seek(selectedClip.startTime + time)}
          />
        </div>

        {/* Rotation */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-[#a0a0a0]">
            <span className="flex items-center gap-1">
              Rotation
              <KeyframeControl
                propertyKey="transform.rotation"
                value={selectedClip.transform.rotation}
                keyframes={selectedClip.animations?.['transform.rotation'] || []}
                currentTime={localClipTime}
                clipId={selectedClip.id}
                onAddKeyframe={handleAddKeyframe('transform.rotation')}
                onRemoveKeyframe={handleRemoveKeyframe('transform.rotation')}
                onUpdateEasing={handleUpdateEasing('transform.rotation')}
                onJumpToNext={handleJumpToNext('transform.rotation')}
                onJumpToPrev={handleJumpToPrev('transform.rotation')}
              />
            </span>
            <span className="font-mono">{getPropVal(selectedClip.transform.rotation, 'transform.rotation')}°</span>
          </div>
          <input
            type="range"
            min={-180}
            max={180}
            value={getPropVal(selectedClip.transform.rotation, 'transform.rotation')}
            onChange={(e) => upd('transform.rotation', Number(e.target.value))}
            onMouseUp={() => useEditorStore.getState().saveSnapshot()}
            className="w-full h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
          />
          <KeyframeMiniTimeline
            keyframes={selectedClip.animations?.['transform.rotation'] || []}
            currentTime={localClipTime}
            duration={selectedClip.duration}
            onSeek={(time) => useEditorStore.getState().seek(selectedClip.startTime + time)}
          />
        </div>

        <Advanced3DTransformFeature 
          clip={selectedClip} 
          isKfActive={isKfActive}
          addKf={addKf}
          remKf={remKf}
          getPropVal={getPropVal}
        />
      </div>

      {/* Opacity & Blend Mode */}
      <div className="bg-[#2d2d2d] rounded-lg border border-[#3e3e3e] p-3 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-white uppercase tracking-wider">Opacity & Blend</span>
        </div>

        {/* Blend Mode */}
        <div className="space-y-1">
          <label className="text-[10px] text-[#a0a0a0] flex items-center gap-1">
            <Layers className="w-3 h-3" /> Blend Mode
          </label>
          <select
            value={selectedClip.transform.blendMode || 'source-over'}
            onChange={(e) => {
              updateClip(selectedClip.id, {
                transform: { ...selectedClip.transform, blendMode: e.target.value as any }
              });
              useEditorStore.getState().saveSnapshot();
            }}
            className="w-full bg-[#1e1e1e] border border-[#3e3e3e] text-white text-xs rounded px-2 py-1 focus:outline-none focus:border-amber-500"
          >
            <option value="source-over">Normal</option>
            <option value="multiply">Multiply</option>
            <option value="screen">Screen</option>
            <option value="overlay">Overlay</option>
            <option value="darken">Darken</option>
            <option value="lighten">Lighten</option>
            <option value="color-dodge">Color Dodge</option>
            <option value="color-burn">Color Burn</option>
            <option value="hard-light">Hard Light</option>
            <option value="soft-light">Soft Light</option>
            <option value="difference">Difference</option>
            <option value="exclusion">Exclusion</option>
          </select>
        </div>

        {/* Opacity */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-[#a0a0a0]">
            <span className="flex items-center gap-1">
              <Eye className="w-3 h-3" /> Opacity
              <KeyframeControl
                propertyKey="opacity"
                value={selectedClip.opacity}
                keyframes={selectedClip.animations?.['opacity'] || []}
                currentTime={localClipTime}
                clipId={selectedClip.id}
                onAddKeyframe={handleAddKeyframe('opacity')}
                onRemoveKeyframe={handleRemoveKeyframe('opacity')}
                onUpdateEasing={handleUpdateEasing('opacity')}
                onJumpToNext={handleJumpToNext('opacity')}
                onJumpToPrev={handleJumpToPrev('opacity')}
              />
            </span>
            <span className="font-mono">{Math.round(getPropVal(selectedClip.opacity, 'opacity') * 100)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={getPropVal(selectedClip.opacity, 'opacity')}
            onChange={(e) => upd('opacity', Number(e.target.value))}
            onMouseUp={() => useEditorStore.getState().saveSnapshot()}
            className="w-full h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
          />
          <KeyframeMiniTimeline
            keyframes={selectedClip.animations?.['opacity'] || []}
            currentTime={localClipTime}
            duration={selectedClip.duration}
            onSeek={(time) => useEditorStore.getState().seek(selectedClip.startTime + time)}
          />
        </div>
      </div>

      {/* Crop Controls */}
      <div className="bg-[#2d2d2d] rounded-lg border border-[#3e3e3e] p-3 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-white uppercase tracking-wider flex items-center gap-1.5">
            <CropIcon className="w-3.5 h-3.5 text-amber-400" /> Crop Bounds
          </span>
          {selectedClip.crop && (
            <button
              onClick={() => updateClip(selectedClip.id, { crop: { top: 0, bottom: 0, left: 0, right: 0 } })}
              className="text-[9px] text-[#a0a0a0] hover:text-amber-400 transition-colors"
            >
              Reset
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {(['top', 'bottom', 'left', 'right'] as const).map((side) => {
            const cropVal = selectedClip.crop?.[side] || 0;
            return (
              <div key={side} className="space-y-1">
                <div className="flex justify-between text-[10px] text-[#a0a0a0] capitalize">
                  <span>{side}</span>
                  <span className="font-mono">{Math.round(cropVal)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={90}
                  value={cropVal}
                  onChange={(e) => {
                    const newCrop = { ...(selectedClip.crop || { top: 0, bottom: 0, left: 0, right: 0 }), [side]: Number(e.target.value) };
                    updateClip(selectedClip.id, { crop: newCrop });
                  }}
                  onMouseUp={() => useEditorStore.getState().saveSnapshot()}
                  className="w-full h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Advanced Features */}
      <PerspectiveWarpFeature clip={selectedClip} />
      <KenBurnsFeature clip={selectedClip} />
      <SmartReframeFeature clip={selectedClip} />

      {/* Bezier Easing */}
      <div className="bg-[#2d2d2d] rounded-lg border border-[#3e3e3e] p-3 space-y-3">
        <div className="flex items-center justify-between cursor-pointer" onClick={() => setCollapsedSections(prev => ({ ...prev, bezier: !prev.bezier }))}>
          <span className="text-[10px] font-semibold text-white uppercase tracking-wider">Animation Easing Curve</span>
          {collapsedSections.bezier ? <ChevronDown className="w-4 h-4 text-[#888]" /> : <ChevronUp className="w-4 h-4 text-[#888]" />}
        </div>
        
        {!collapsedSections.bezier && (
          <div className="space-y-3 pt-2 border-t border-[#3e3e3e]">
            <div className="flex gap-1.5">
              <button className="px-2 py-1 bg-[#1e1e1e] hover:bg-[#3e3e3e] border border-[#3e3e3e] text-[#a0a0a0] hover:text-white rounded text-[9px] transition-colors">Linear</button>
              <button className="px-2 py-1 bg-[#1e1e1e] hover:bg-[#3e3e3e] border border-[#3e3e3e] text-[#a0a0a0] hover:text-white rounded text-[9px] transition-colors">Ease In</button>
              <button className="px-2 py-1 bg-[#1e1e1e] hover:bg-[#3e3e3e] border border-[#3e3e3e] text-[#a0a0a0] hover:text-white rounded text-[9px] transition-colors">Ease Out</button>
            </div>

            <div className="h-44 bg-[#1e1e1e] rounded border border-[#3e3e3e] p-2">
              <BezierCurveEditor
                value={{ x: 0.33, y: 0.67 }}
                onChange={(updatedControl) => {
                  const anims = { ...(selectedClip.animations || {}) };
                  for (const propKey in anims) {
                    const kfs = anims[propKey];
                    if (kfs) {
                      anims[propKey] = kfs.map((kf: any) => ({
                        ...kf,
                        bezierControl: updatedControl
                      }));
                    }
                  }
                  updateClip(selectedClip.id, { animations: anims });
                }}
              />
            </div>
          </div>
        )}
        <KeyframeMiniTimeline
          keyframes={selectedClip.animations?.['transform.x'] || selectedClip.animations?.['transform.y'] || []}
          currentTime={localClipTime}
          duration={selectedClip.duration}
          onSeek={(time) => useEditorStore.getState().seek(selectedClip.startTime + time)}
        />
      </div>
    </div>
  );
};
