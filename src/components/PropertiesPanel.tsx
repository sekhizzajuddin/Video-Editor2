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
    selectedTransitionClipId,
    updateTransition,
    removeTransition,
  } = useEditorStore();

  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  // Find the selected transition
  let selectedTransitionClip = null;
  let selectedTransition = null;
  if (selectedTransitionClipId) {
    for (const track of tracks) {
      const clip = track.clips.find((c) => c.id === selectedTransitionClipId);
      if (clip && clip.transitionIn) {
        selectedTransitionClip = clip;
        selectedTransition = clip.transitionIn;
        break;
      }
    }
  }

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

  if (selectedTransition && selectedTransitionClip) {
    const alignment = selectedTransition.params?.alignment as string || 'center';

    return (
      <div className="h-full flex flex-col bg-[#252525] border-l border-[#3e3e3e]">
        {/* Header */}
        <div className="p-4 border-b border-[#3e3e3e] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-purple-600/20 text-purple-400 rounded">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Transition Settings</h3>
              <p className="text-[11px] text-[#a0a0a0] truncate max-w-[180px]">
                {selectedTransition.name}
              </p>
            </div>
          </div>
          <button
            onClick={() => useEditorStore.getState().selectTransition(null)}
            className="p-1 hover:bg-[#3e3e3e] rounded text-[#a0a0a0] hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-4 space-y-4 overflow-y-auto">
          {/* Transition Type Info */}
          <div className="bg-[#2d2d2d] rounded border border-[#3e3e3e] p-3">
            <span className="text-[10px] text-purple-400 font-semibold uppercase tracking-wider block mb-1">
              Effect Type
            </span>
            <span className="text-sm text-white font-medium capitalize">
              {selectedTransition.type}
            </span>
          </div>

          {/* Duration Slider */}
          <div className="bg-[#2d2d2d] rounded border border-[#3e3e3e] p-3 space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs text-white font-medium">Duration</label>
              <span className="text-xs font-mono text-purple-300">
                {selectedTransition.duration.toFixed(1)}s
              </span>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0.1}
                max={5.0}
                step={0.1}
                value={selectedTransition.duration}
                onChange={(e) =>
                  updateTransition(selectedTransitionClip.id, {
                    duration: parseFloat(e.target.value),
                  })
                }
                className="flex-1 h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:rounded-full hover:[&::-webkit-slider-thumb]:bg-purple-400 transition-all"
              />
            </div>
            <div className="flex justify-between text-[9px] text-[#a0a0a0]">
              <span>0.1s</span>
              <span>5.0s</span>
            </div>
          </div>

          {/* Alignment Selector */}
          <div className="bg-[#2d2d2d] rounded border border-[#3e3e3e] p-3 space-y-2">
            <label className="text-xs text-white font-medium block">Alignment</label>
            <div className="relative">
              <select
                value={alignment}
                onChange={(e) =>
                  updateTransition(selectedTransitionClip.id, {
                    params: { ...selectedTransition.params, alignment: e.target.value },
                  })
                }
                className="w-full bg-[#1e1e1e] border border-[#3e3e3e] text-xs text-white rounded px-2.5 py-1.5 focus:outline-none focus:border-purple-500 appearance-none cursor-pointer"
              >
                <option value="center">Center at Cut</option>
                <option value="left">Start at Cut</option>
                <option value="right">End at Cut</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[#a0a0a0] absolute right-2.5 top-2.5 pointer-events-none" />
            </div>
          </div>

          {/* Delete Button */}
          <button
            onClick={() => removeTransition(selectedTransitionClip.id)}
            className="w-full py-2 bg-red-600/10 hover:bg-red-600 border border-red-500/20 hover:border-red-500 text-red-400 hover:text-white rounded text-xs font-medium transition-colors flex items-center justify-center gap-1.5 mt-4"
          >
            <Trash2 className="w-3.5 h-3.5" /> Remove Transition
          </button>
        </div>
      </div>
    );
  }

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

  const defaultColorFilters = {
    temperature: 0,
    tint: 0,
    exposure: 0,
    contrast: 100,
    saturation: 100,
    blur: 0,
    fadedFilm: 0,
    vignette: 0,
  };

  const clipFilters = selectedClip.colorFilters || defaultColorFilters;

  const handleFilterChange = (key: keyof typeof defaultColorFilters, val: number) => {
    if (!selectedClip) return;
    const current = selectedClip.colorFilters || defaultColorFilters;
    updateClip(selectedClip.id, {
      colorFilters: {
        ...current,
        [key]: val,
      },
    });
  };

  const handleFilterReset = (key: keyof typeof defaultColorFilters) => {
    if (!selectedClip) return;
    const current = selectedClip.colorFilters || defaultColorFilters;
    const defaultVal = defaultColorFilters[key];
    updateClip(selectedClip.id, {
      colorFilters: {
        ...current,
        [key]: defaultVal,
      },
    });
    useEditorStore.getState().saveSnapshot();
  };

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
                        onBlur={() => useEditorStore.getState().saveSnapshot()}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                        }}
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
                        onBlur={() => useEditorStore.getState().saveSnapshot()}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                        }}
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
                      title="Double-click to reset to 100%"
                      onChange={(e) =>
                        updateClip(selectedClip.id, {
                          transform: {
                            ...selectedClip.transform,
                            scale: Number(e.target.value),
                          },
                        })
                      }
                      onMouseUp={() => useEditorStore.getState().saveSnapshot()}
                      onDoubleClick={() => {
                        updateClip(selectedClip.id, {
                          transform: {
                            ...selectedClip.transform,
                            scale: 100,
                          },
                        });
                        useEditorStore.getState().saveSnapshot();
                      }}
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
                      title="Double-click to reset to 0°"
                      onChange={(e) =>
                        updateClip(selectedClip.id, {
                          transform: {
                            ...selectedClip.transform,
                            rotation: Number(e.target.value),
                          },
                        })
                      }
                      onMouseUp={() => useEditorStore.getState().saveSnapshot()}
                      onDoubleClick={() => {
                        updateClip(selectedClip.id, {
                          transform: {
                            ...selectedClip.transform,
                            rotation: 0,
                          },
                        });
                        useEditorStore.getState().saveSnapshot();
                      }}
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
                      title="Double-click to reset to 100%"
                      onChange={(e) =>
                        updateClip(selectedClip.id, {
                          opacity: Number(e.target.value),
                        })
                      }
                      onMouseUp={() => useEditorStore.getState().saveSnapshot()}
                      onDoubleClick={() => {
                        updateClip(selectedClip.id, {
                          opacity: 1,
                        });
                        useEditorStore.getState().saveSnapshot();
                      }}
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
            {/* Basic Correction Section */}
            <div className="bg-[#2d2d2d] rounded border border-[#3e3e3e]">
              <button
                onClick={() => toggleSection('colorBasic')}
                className="w-full flex items-center justify-between p-2.5 text-xs text-white"
              >
                <span className="font-medium">Basic Correction</span>
                {collapsedSections['colorBasic'] ? (
                  <ChevronRight className="w-3.5 h-3.5 text-[#a0a0a0]" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-[#a0a0a0]" />
                )}
              </button>
              {!collapsedSections['colorBasic'] && (
                <div className="px-2.5 pb-3 space-y-3 border-t border-[#3e3e3e]/30 pt-2.5">
                  {/* Temperature */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-[#d0d0d0]">Temperature</span>
                      <span className="font-mono text-[#a0a0a0]">
                        {clipFilters.temperature > 0 ? `+${clipFilters.temperature}` : clipFilters.temperature}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={-100}
                        max={100}
                        value={clipFilters.temperature}
                        onChange={(e) => handleFilterChange('temperature', Number(e.target.value))}
                        onMouseUp={() => useEditorStore.getState().saveSnapshot()}
                        onDoubleClick={() => handleFilterReset('temperature')}
                        title="Double-click to reset to 0"
                        className="flex-1 h-1 bg-gradient-to-r from-blue-500 via-[#3e3e3e] to-orange-500 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow"
                      />
                    </div>
                  </div>

                  {/* Tint */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-[#d0d0d0]">Tint</span>
                      <span className="font-mono text-[#a0a0a0]">
                        {clipFilters.tint > 0 ? `+${clipFilters.tint}` : clipFilters.tint}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={-100}
                        max={100}
                        value={clipFilters.tint}
                        onChange={(e) => handleFilterChange('tint', Number(e.target.value))}
                        onMouseUp={() => useEditorStore.getState().saveSnapshot()}
                        onDoubleClick={() => handleFilterReset('tint')}
                        title="Double-click to reset to 0"
                        className="flex-1 h-1 bg-gradient-to-r from-green-500 via-[#3e3e3e] to-pink-500 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow"
                      />
                    </div>
                  </div>

                  {/* Exposure */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-[#d0d0d0]">Exposure</span>
                      <span className="font-mono text-[#a0a0a0]">
                        {clipFilters.exposure > 0 ? `+${clipFilters.exposure}` : clipFilters.exposure}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={-100}
                        max={100}
                        value={clipFilters.exposure}
                        onChange={(e) => handleFilterChange('exposure', Number(e.target.value))}
                        onMouseUp={() => useEditorStore.getState().saveSnapshot()}
                        onDoubleClick={() => handleFilterReset('exposure')}
                        title="Double-click to reset to 0"
                        className="flex-1 h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
                      />
                    </div>
                  </div>

                  {/* Contrast */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-[#d0d0d0]">Contrast</span>
                      <span className="font-mono text-[#a0a0a0]">{clipFilters.contrast}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={0}
                        max={200}
                        value={clipFilters.contrast}
                        onChange={(e) => handleFilterChange('contrast', Number(e.target.value))}
                        onMouseUp={() => useEditorStore.getState().saveSnapshot()}
                        onDoubleClick={() => handleFilterReset('contrast')}
                        title="Double-click to reset to 100%"
                        className="flex-1 h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
                      />
                    </div>
                  </div>

                  {/* Saturation */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-[#d0d0d0]">Saturation</span>
                      <span className="font-mono text-[#a0a0a0]">{clipFilters.saturation}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={0}
                        max={200}
                        value={clipFilters.saturation}
                        onChange={(e) => handleFilterChange('saturation', Number(e.target.value))}
                        onMouseUp={() => useEditorStore.getState().saveSnapshot()}
                        onDoubleClick={() => handleFilterReset('saturation')}
                        title="Double-click to reset to 100%"
                        className="flex-1 h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
                      />
                    </div>
                  </div>

                  {/* Blur */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-[#d0d0d0]">Blur</span>
                      <span className="font-mono text-[#a0a0a0]">{clipFilters.blur}px</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={0}
                        max={20}
                        value={clipFilters.blur}
                        onChange={(e) => handleFilterChange('blur', Number(e.target.value))}
                        onMouseUp={() => useEditorStore.getState().saveSnapshot()}
                        onDoubleClick={() => handleFilterReset('blur')}
                        title="Double-click to reset to 0px"
                        className="flex-1 h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Creative Section */}
            <div className="bg-[#2d2d2d] rounded border border-[#3e3e3e]">
              <button
                onClick={() => toggleSection('colorCreative')}
                className="w-full flex items-center justify-between p-2.5 text-xs text-white"
              >
                <span className="font-medium">Creative</span>
                {collapsedSections['colorCreative'] ? (
                  <ChevronRight className="w-3.5 h-3.5 text-[#a0a0a0]" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-[#a0a0a0]" />
                )}
              </button>
              {!collapsedSections['colorCreative'] && (
                <div className="px-2.5 pb-3 space-y-3 border-t border-[#3e3e3e]/30 pt-2.5">
                  {/* Faded Film */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-[#d0d0d0]">Faded Film</span>
                      <span className="font-mono text-[#a0a0a0]">{clipFilters.fadedFilm}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={clipFilters.fadedFilm}
                        onChange={(e) => handleFilterChange('fadedFilm', Number(e.target.value))}
                        onMouseUp={() => useEditorStore.getState().saveSnapshot()}
                        onDoubleClick={() => handleFilterReset('fadedFilm')}
                        title="Double-click to reset to 0%"
                        className="flex-1 h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
                      />
                    </div>
                  </div>

                  {/* Vignette */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-[#d0d0d0]">Vignette</span>
                      <span className="font-mono text-[#a0a0a0]">
                        {clipFilters.vignette > 0 ? `+${clipFilters.vignette}` : clipFilters.vignette}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={-100}
                        max={100}
                        value={clipFilters.vignette}
                        onChange={(e) => handleFilterChange('vignette', Number(e.target.value))}
                        onMouseUp={() => useEditorStore.getState().saveSnapshot()}
                        onDoubleClick={() => handleFilterReset('vignette')}
                        title="Double-click to reset to 0"
                        className="flex-1 h-1 bg-gradient-to-r from-white via-[#3e3e3e] to-black rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
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
                  title="Double-click to reset to 1.0x"
                  onChange={(e) => {
                    const newSpeed = Number(e.target.value);
                    const sourceDuration = selectedClip.duration * selectedClip.speed;
                    const newDuration = sourceDuration / newSpeed;
                    updateClip(selectedClip.id, {
                      speed: newSpeed,
                      duration: newDuration,
                    });
                  }}
                  onMouseUp={() => useEditorStore.getState().saveSnapshot()}
                  onDoubleClick={() => {
                    const newSpeed = 1.0;
                    const sourceDuration = selectedClip.duration * selectedClip.speed;
                    const newDuration = sourceDuration / newSpeed;
                    updateClip(selectedClip.id, {
                      speed: newSpeed,
                      duration: newDuration,
                    });
                    useEditorStore.getState().saveSnapshot();
                  }}
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
                    onBlur={() => useEditorStore.getState().saveSnapshot()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    }}
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
                    onBlur={() => useEditorStore.getState().saveSnapshot()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    }}
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
                    onBlur={() => useEditorStore.getState().saveSnapshot()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    }}
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
