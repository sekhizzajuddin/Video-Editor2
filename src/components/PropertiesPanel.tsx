import {
  Move3D,
  Palette,
  Gauge,
  Music,
  Trash2,
  Copy,
  Scissors,
  ChevronDown,
  ChevronRight,
  X,
} from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { useState } from 'react';
import type { PropertiesTab } from '@/types';

export function PropertiesPanel() {
  const {
    tracks,
    selectedClipId,
    activePropertiesTab,
    setActivePropertiesTab,
    updateClip,
    removeClip,
    copyClip,
    duplicateClip,
    splitClip,
    currentTime,
  } = useEditorStore();

  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  // Find the selected clip
  let selectedClip = null;
  let selectedTrack = null;
  for (const track of tracks) {
    const clip = track.clips.find((c) => c.id === selectedClipId);
    if (clip) {
      selectedClip = clip;
      selectedTrack = track;
      break;
    }
  }

  const toggleSection = (section: string) => {
    setCollapsedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const tabs: { id: PropertiesTab; label: string; icon: typeof Move3D }[] = [
    { id: 'transform', label: 'Transform', icon: Move3D },
    { id: 'color', label: 'Color', icon: Palette },
    { id: 'speed', label: 'Speed', icon: Gauge },
    { id: 'audio', label: 'Audio', icon: Music },
  ];

  if (!selectedClip) {
    return (
      <div className="h-full flex flex-col bg-[#252525] border-l border-[#3e3e3e]">
        {/* Tabs */}
        <div className="flex border-b border-[#3e3e3e]">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                className="flex-1 py-2.5 text-[10px] font-medium uppercase tracking-wider flex flex-col items-center gap-1 text-[#a0a0a0]"
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <Move3D className="w-10 h-10 text-[#3e3e3e] mx-auto mb-3" />
            <p className="text-sm text-[#a0a0a0]">No clip selected</p>
            <p className="text-xs text-[#a0a0a0] mt-1 opacity-60">
              Click a clip on the timeline to edit its properties
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#252525] border-l border-[#3e3e3e]">
      {/* Tabs */}
      <div className="flex border-b border-[#3e3e3e]">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activePropertiesTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActivePropertiesTab(tab.id)}
              className={`flex-1 py-2.5 text-[10px] font-medium uppercase tracking-wider flex flex-col items-center gap-1 transition-colors ${
                isActive
                  ? 'text-white border-b-2 border-amber-500 bg-[#2d2d2d]'
                  : 'text-[#a0a0a0] hover:text-white hover:bg-[#2d2d2d]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Clip Info Header */}
      <div className="p-3 border-b border-[#3e3e3e] bg-[#2a2a2a]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-white">
            {selectedTrack?.name} / Clip
          </span>
          <button
            onClick={() => useEditorStore.getState().selectClip(null)}
            className="p-1 text-[#a0a0a0] hover:text-white transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={copyClip}
            title="Copy"
            className="p-1.5 bg-[#1e1e1e] rounded text-[#a0a0a0] hover:text-white transition-colors"
          >
            <Copy className="w-3 h-3" />
          </button>
          <button
            onClick={duplicateClip}
            title="Duplicate"
            className="p-1.5 bg-[#1e1e1e] rounded text-[#a0a0a0] hover:text-white transition-colors"
          >
            <Copy className="w-3 h-3" />
          </button>
          <button
            onClick={() => splitClip(selectedClip.id, currentTime)}
            title="Split at playhead"
            className="p-1.5 bg-[#1e1e1e] rounded text-[#a0a0a0] hover:text-white transition-colors"
          >
            <Scissors className="w-3 h-3" />
          </button>
          <button
            onClick={() => removeClip(selectedClip.id)}
            title="Delete"
            className="p-1.5 bg-[#1e1e1e] rounded text-red-400 hover:text-red-300 transition-colors"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Properties Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {activePropertiesTab === 'transform' && (
          <div className="space-y-3">
            {/* Position */}
            <div className="bg-[#2d2d2d] rounded border border-[#3e3e3e]">
              <button
                onClick={() => toggleSection('position')}
                className="w-full flex items-center justify-between p-2.5 text-xs text-white"
              >
                <span className="font-medium">Position</span>
                {collapsedSections['position'] ? (
                  <ChevronRight className="w-3.5 h-3.5 text-[#a0a0a0]" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-[#a0a0a0]" />
                )}
              </button>
              {!collapsedSections['position'] && (
                <div className="px-2.5 pb-2.5 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-[#a0a0a0] block mb-1">X Position</label>
                      <input
                        type="number"
                        value={selectedClip.transform.x}
                        onChange={(e) =>
                          updateClip(selectedClip.id, {
                            transform: { ...selectedClip.transform, x: Number(e.target.value) },
                          })
                        }
                        className="w-full px-2 py-1 bg-[#1e1e1e] border border-[#3e3e3e] rounded text-xs text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-[#a0a0a0] block mb-1">Y Position</label>
                      <input
                        type="number"
                        value={selectedClip.transform.y}
                        onChange={(e) =>
                          updateClip(selectedClip.id, {
                            transform: { ...selectedClip.transform, y: Number(e.target.value) },
                          })
                        }
                        className="w-full px-2 py-1 bg-[#1e1e1e] border border-[#3e3e3e] rounded text-xs text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Scale */}
            <div className="bg-[#2d2d2d] rounded border border-[#3e3e3e]">
              <button
                onClick={() => toggleSection('scale')}
                className="w-full flex items-center justify-between p-2.5 text-xs text-white"
              >
                <span className="font-medium">Scale</span>
                {collapsedSections['scale'] ? (
                  <ChevronRight className="w-3.5 h-3.5 text-[#a0a0a0]" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-[#a0a0a0]" />
                )}
              </button>
              {!collapsedSections['scale'] && (
                <div className="px-2.5 pb-2.5">
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={10}
                      max={200}
                      value={selectedClip.transform.scale}
                      onChange={(e) =>
                        updateClip(selectedClip.id, {
                          transform: {
                            ...selectedClip.transform,
                            scale: Number(e.target.value),
                          },
                        })
                      }
                      className="flex-1 h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
                    />
                    <span className="text-[11px] text-white w-10 text-right">
                      {selectedClip.transform.scale}%
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Rotation */}
            <div className="bg-[#2d2d2d] rounded border border-[#3e3e3e]">
              <button
                onClick={() => toggleSection('rotation')}
                className="w-full flex items-center justify-between p-2.5 text-xs text-white"
              >
                <span className="font-medium">Rotation</span>
                {collapsedSections['rotation'] ? (
                  <ChevronRight className="w-3.5 h-3.5 text-[#a0a0a0]" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-[#a0a0a0]" />
                )}
              </button>
              {!collapsedSections['rotation'] && (
                <div className="px-2.5 pb-2.5">
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={-180}
                      max={180}
                      value={selectedClip.transform.rotation}
                      onChange={(e) =>
                        updateClip(selectedClip.id, {
                          transform: {
                            ...selectedClip.transform,
                            rotation: Number(e.target.value),
                          },
                        })
                      }
                      className="flex-1 h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
                    />
                    <span className="text-[11px] text-white w-10 text-right">
                      {selectedClip.transform.rotation}°
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Opacity */}
            <div className="bg-[#2d2d2d] rounded border border-[#3e3e3e]">
              <button
                onClick={() => toggleSection('opacity')}
                className="w-full flex items-center justify-between p-2.5 text-xs text-white"
              >
                <span className="font-medium">Opacity</span>
                {collapsedSections['opacity'] ? (
                  <ChevronRight className="w-3.5 h-3.5 text-[#a0a0a0]" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-[#a0a0a0]" />
                )}
              </button>
              {!collapsedSections['opacity'] && (
                <div className="px-2.5 pb-2.5">
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={selectedClip.opacity}
                      onChange={(e) =>
                        updateClip(selectedClip.id, {
                          opacity: Number(e.target.value),
                        })
                      }
                      className="flex-1 h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
                    />
                    <span className="text-[11px] text-white w-10 text-right">
                      {Math.round(selectedClip.opacity * 100)}%
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activePropertiesTab === 'color' && (
          <div className="space-y-3">
            {['Brightness', 'Contrast', 'Saturation', 'Hue', 'Blur'].map((name) => (
              <div key={name} className="bg-[#2d2d2d] rounded border border-[#3e3e3e] p-2.5">
                <label className="text-xs text-white font-medium block mb-2">{name}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={0}
                    max={200}
                    defaultValue={name === 'Blur' ? 0 : 100}
                    className="flex-1 h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
                  />
                  <span className="text-[11px] text-white w-10 text-right">
                    {name === 'Blur' ? '0' : '100'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {activePropertiesTab === 'speed' && (
          <div className="space-y-3">
            <div className="bg-[#2d2d2d] rounded border border-[#3e3e3e] p-2.5">
              <label className="text-xs text-white font-medium block mb-2">Speed</label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0.25}
                  max={3}
                  step={0.25}
                  value={selectedClip.speed}
                  onChange={(e) =>
                    updateClip(selectedClip.id, { speed: Number(e.target.value) })
                  }
                  className="flex-1 h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
                />
                <span className="text-[11px] text-white w-10 text-right">
                  {selectedClip.speed}x
                </span>
              </div>
            </div>
            <div className="bg-[#2d2d2d] rounded border border-[#3e3e3e] p-2.5">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-[#a0a0a0] block mb-1">Duration</label>
                  <div className="px-2 py-1 bg-[#1e1e1e] border border-[#3e3e3e] rounded text-xs text-white">
                    {selectedClip.duration.toFixed(2)}s
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-[#a0a0a0] block mb-1">Start</label>
                  <input
                    type="number"
                    step={0.1}
                    value={selectedClip.startTime}
                    onChange={(e) =>
                      updateClip(selectedClip.id, {
                        startTime: Number(e.target.value),
                      })
                    }
                    className="w-full px-2 py-1 bg-[#1e1e1e] border border-[#3e3e3e] rounded text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            </div>
            <div className="bg-[#2d2d2d] rounded border border-[#3e3e3e] p-2.5">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-[#a0a0a0] block mb-1">Trim Start</label>
                  <input
                    type="number"
                    step={0.1}
                    min={0}
                    value={selectedClip.trimStart}
                    onChange={(e) =>
                      updateClip(selectedClip.id, {
                        trimStart: Number(e.target.value),
                      })
                    }
                    className="w-full px-2 py-1 bg-[#1e1e1e] border border-[#3e3e3e] rounded text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#a0a0a0] block mb-1">Trim End</label>
                  <input
                    type="number"
                    step={0.1}
                    min={0}
                    value={selectedClip.trimEnd}
                    onChange={(e) =>
                      updateClip(selectedClip.id, {
                        trimEnd: Number(e.target.value),
                      })
                    }
                    className="w-full px-2 py-1 bg-[#1e1e1e] border border-[#3e3e3e] rounded text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {activePropertiesTab === 'audio' && (
          <div className="space-y-3">
            <div className="bg-[#2d2d2d] rounded border border-[#3e3e3e] p-2.5">
              <label className="text-xs text-white font-medium block mb-2">Volume</label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  defaultValue={1}
                  className="flex-1 h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
                />
                <span className="text-[11px] text-white w-10 text-right">100%</span>
              </div>
            </div>
            <div className="bg-[#2d2d2d] rounded border border-[#3e3e3e] p-2.5">
              <label className="text-xs text-white font-medium block mb-2">Pan</label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={-1}
                  max={1}
                  step={0.1}
                  defaultValue={0}
                  className="flex-1 h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
                />
                <span className="text-[11px] text-white w-10 text-right">Center</span>
              </div>
            </div>
            <div className="bg-[#2d2d2d] rounded border border-[#3e3e3e] p-2.5">
              <label className="text-xs text-white font-medium block mb-2">Fade In</label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={5}
                  step={0.1}
                  defaultValue={0}
                  className="flex-1 h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
                />
                <span className="text-[11px] text-white w-10 text-right">0s</span>
              </div>
            </div>
            <div className="bg-[#2d2d2d] rounded border border-[#3e3e3e] p-2.5">
              <label className="text-xs text-white font-medium block mb-2">Fade Out</label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={5}
                  step={0.1}
                  defaultValue={0}
                  className="flex-1 h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
                />
                <span className="text-[11px] text-white w-10 text-right">0s</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
