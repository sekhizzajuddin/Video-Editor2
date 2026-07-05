import { X, Settings, Keyboard, Monitor, HardDrive, RotateCcw, FolderOpen, Sliders, AlertTriangle, Search, RotateCw, History, Trash2 } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { useState, useRef, useCallback, useEffect } from 'react';
import { probeFile } from '@/utils/mediaProbe';
import { getAutosavesFromDB, deleteAutosaveFromDB, restoreSnapshotMedia } from '@/utils/projectPersistence';
import { clearPreviewCaches } from './PreviewCanvas';
import { DEFAULT_SHORTCUTS, getShortcutString } from '@/utils/keyboardShortcuts';

export function SettingsModal() {
  const { showSettingsModal, setShowSettingsModal, resetProject, addMedia, settings, updateSettings } = useEditorStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      try {
        const mediaItem = await probeFile(file);
        // FIX C6: Pass the actual File object so it gets persisted to IndexedDB
        addMedia(mediaItem, file);
      } catch (err) {
        console.error(`Failed to import ${file.name}:`, err);
      }
    }
    setShowSettingsModal(false);
    e.target.value = '';
  }, [addMedia, setShowSettingsModal]);
  const [activeTab, setActiveTab] = useState<'general' | 'keyboard' | 'performance' | 'controls' | 'recovery'>('general');
  const [searchQuery, setSearchQuery] = useState('');
  const [autosaves, setAutosaves] = useState<any[]>([]);

  const loadAutosaves = useCallback(async () => {
    try {
      const list = await getAutosavesFromDB();
      setAutosaves(list);
    } catch (err) {
      console.error('Failed to load autosaves:', err);
    }
  }, []);

  useEffect(() => {
    if (showSettingsModal && activeTab === 'recovery') {
      loadAutosaves();
    }
  }, [showSettingsModal, activeTab, loadAutosaves]);

  const handleRestoreAutosave = async (as: any) => {
    const confirmed = window.confirm("Restore this versioned auto-save? Unsaved changes in your current timeline will be lost.");
    if (!confirmed) return;

    try {
      const restored = await restoreSnapshotMedia(as);
      const loadedTracks = restored.tracks.map((t: any) => ({
        ...t,
        overLayers: t.overLayers || [],
      }));
      
      useEditorStore.setState({
        tracks: loadedTracks,
        mediaLibrary: restored.mediaLibrary,
        currentTime: restored.currentTime,
        aspectRatio: restored.aspectRatio || '16:9',
        history: [
          {
            tracks: JSON.parse(JSON.stringify(loadedTracks)),
            currentTime: restored.currentTime,
          }
        ],
        historyIndex: 0,
      });
      useEditorStore.getState().recalcTotalDuration();
      setShowSettingsModal(false);
    } catch (err) {
      console.error("Failed to restore autosave:", err);
      alert("Failed to restore autosave.");
    }
  };
  const [recordingActionId, setRecordingActionId] = useState<string | null>(null);
  const [conflictDetail, setConflictDetail] = useState<{
    actionId: string;
    conflictingActionId: string;
    keyCombo: string;
  } | null>(null);

  // Listen to window keydown while recording a hotkey combo
  useEffect(() => {
    if (!recordingActionId) return;

    const handleRecordKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Escape key cancels recording
      if (e.key === 'Escape') {
        setRecordingActionId(null);
        return;
      }

      const combo = getShortcutString(e);
      if (!combo) return; // ignore pure modifiers

      // Check if this key combo conflicts with any other action
      const customShortcuts = settings.keyboardShortcuts || {};
      const currentShortcuts: Record<string, string> = {};
      for (const def of DEFAULT_SHORTCUTS) {
        currentShortcuts[def.id] = customShortcuts[def.id] !== undefined ? customShortcuts[def.id] : def.defaultKey;
      }

      // Find the conflicting action ID
      const conflictingActionId = Object.entries(currentShortcuts).find(
        ([actionId, keyCombo]) => actionId !== recordingActionId && keyCombo.toLowerCase() === combo.toLowerCase()
      )?.[0];

      if (conflictingActionId) {
        setConflictDetail({
          actionId: recordingActionId,
          conflictingActionId,
          keyCombo: combo,
        });
      } else {
        // Direct assignment
        const newShortcuts = { ...customShortcuts, [recordingActionId]: combo };
        updateSettings({ keyboardShortcuts: newShortcuts });
        setRecordingActionId(null);
      }
    };

    window.addEventListener('keydown', handleRecordKeyDown, true); // useCapture to intercept before main App handler
    return () => window.removeEventListener('keydown', handleRecordKeyDown, true);
  }, [recordingActionId, settings.keyboardShortcuts, updateSettings]);

  const handleResolveConflict = (overwrite: boolean) => {
    if (!conflictDetail) return;
    const { actionId, conflictingActionId, keyCombo } = conflictDetail;

    if (overwrite) {
      const customShortcuts = settings.keyboardShortcuts || {};
      const newShortcuts = { ...customShortcuts };
      
      // Clear the conflicting action
      newShortcuts[conflictingActionId] = '';
      // Bind this action
      newShortcuts[actionId] = keyCombo;

      updateSettings({ keyboardShortcuts: newShortcuts });
    }
    
    setConflictDetail(null);
    setRecordingActionId(null);
  };

  if (!showSettingsModal) return null;

  const tabs = [
    { id: 'general' as const, label: 'General', icon: Settings },
    { id: 'controls' as const, label: 'Controls', icon: Sliders },
    { id: 'keyboard' as const, label: 'Shortcuts', icon: Keyboard },
    { id: 'performance' as const, label: 'Performance', icon: Monitor },
    { id: 'recovery' as const, label: 'Recovery', icon: History },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center">
      <div className="bg-[#2d2d2d] rounded-lg shadow-2xl w-[540px] max-h-[80vh] overflow-hidden border border-[#3e3e3e]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#3e3e3e]">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-amber-400" />
            <h2 className="text-sm font-semibold text-white">Settings</h2>
          </div>
          <button
            onClick={() => setShowSettingsModal(false)}
            className="p-1 text-[#a0a0a0] hover:text-white rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex" style={{ maxHeight: 'calc(80vh - 65px)' }}>
          {/* Sidebar */}
          <div className="w-36 border-r border-[#3e3e3e] bg-[#252525]">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full px-3 py-2.5 text-xs flex items-center gap-2 transition-colors ${
                    activeTab === tab.id
                      ? 'text-white bg-[#3e3e3e] border-l-2 border-amber-500'
                      : 'text-[#a0a0a0] hover:text-white hover:bg-[#2d2d2d]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {activeTab === 'general' && (
              <div className="space-y-4">
                <h3 className="text-xs font-semibold text-white uppercase tracking-wider">Project Settings</h3>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs text-white">Autosave</span>
                      <p className="text-[10px] text-[#a0a0a0]">Save project automatically</p>
                    </div>
                    <button
                      onClick={() => updateSettings({ autosave: !settings.autosave })}
                      className={`w-9 h-5 rounded-full transition-colors relative ${
                        settings.autosave ? 'bg-amber-500' : 'bg-[#3e3e3e]'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all ${
                          settings.autosave ? 'left-4.5' : 'left-0.5'
                        }`}
                        style={{ left: settings.autosave ? '18px' : '2px' }}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs text-white">Snap to Clips</span>
                      <p className="text-[10px] text-[#a0a0a0]">Auto-snap clips when dragging</p>
                    </div>
                    <button
                      onClick={() => updateSettings({ snapEnabled: !settings.snapEnabled })}
                      className={`w-9 h-5 rounded-full transition-colors relative ${
                        settings.snapEnabled ? 'bg-amber-500' : 'bg-[#3e3e3e]'
                      }`}
                    >
                      <div
                        className="w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all"
                        style={{ left: settings.snapEnabled ? '18px' : '2px' }}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs text-white">Show Waveforms</span>
                      <p className="text-[10px] text-[#a0a0a0]">Display audio waveforms on clips</p>
                    </div>
                    <button
                      onClick={() => updateSettings({ showWaveform: !settings.showWaveform })}
                      className={`w-9 h-5 rounded-full transition-colors relative ${
                        settings.showWaveform ? 'bg-amber-500' : 'bg-[#3e3e3e]'
                      }`}
                    >
                      <div
                        className="w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all"
                        style={{ left: settings.showWaveform ? '18px' : '2px' }}
                      />
                    </button>
                  </div>
                </div>

                <div className="border-t border-[#3e3e3e] pt-4">
                  <h3 className="text-xs font-semibold text-white uppercase tracking-wider mb-3">Default Settings</h3>

                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] text-[#a0a0a0] block mb-1">Default Image Duration (seconds)</label>
                      <input
                        type="number"
                        value={settings.defaultDuration}
                        onChange={(e) => updateSettings({ defaultDuration: Number(e.target.value) })}
                        onBlur={(e) => {
                          // FIX M16: Clamp value to valid range on blur so invalid values are not persisted
                          const val = Number(e.target.value);
                          const clamped = Math.max(1, Math.min(60, isNaN(val) ? 5 : val));
                          updateSettings({ defaultDuration: clamped });
                        }}
                        min={1}
                        max={60}
                        placeholder="1-60"
                        className="w-full px-2 py-1.5 bg-[#1e1e1e] border border-[#3e3e3e] rounded text-xs text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t border-[#3e3e3e] pt-4">
                  <h3 className="text-xs font-semibold text-white uppercase tracking-wider mb-3">Project Actions</h3>
                  <div className="space-y-2">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full px-3 py-2 bg-[#252525] border border-[#3e3e3e] rounded text-xs text-[#a0a0a0] hover:text-white hover:border-amber-500 transition-colors flex items-center gap-2"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      Import Media Files
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="video/*,audio/*,image/*"
                      onChange={handleImport}
                      className="hidden"
                    />
                    <button
                      onClick={() => {
                        // FIX C8: Confirm before resetting from settings panel
                        const hasContent = useEditorStore.getState().tracks.some(t => t.clips.length > 0);
                        if (hasContent) {
                          const confirmed = window.confirm(
                            'Reset the project?\n\nAll tracks, clips and media will be removed. This cannot be undone.'
                          );
                          if (!confirmed) return;
                        }
                        resetProject();
                        setShowSettingsModal(false);
                      }}
                      className="w-full px-3 py-2 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-400 hover:bg-red-500/20 transition-colors flex items-center gap-2"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Reset Project
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'controls' && (
              <div className="space-y-4">
                <h3 className="text-xs font-semibold text-white uppercase tracking-wider">Canvas Controls</h3>
                
                <div className="space-y-4">
                  <div className="bg-[#252525] rounded p-3 border border-[#3e3e3e]">
                    <label className="flex items-center justify-between text-xs text-white font-medium mb-3">
                      Scroll Speed
                      <span className="text-amber-500">{settings.scrollSpeed.toFixed(1)}x</span>
                    </label>
                    <input
                      type="range"
                      min={0.1}
                      max={3}
                      step={0.1}
                      value={settings.scrollSpeed}
                      onChange={(e) => updateSettings({ scrollSpeed: Number(e.target.value) })}
                      className="w-full h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
                    />
                    <p className="text-[10px] text-[#a0a0a0] mt-2">
                      Adjusts the timeline and track scrolling speed.
                    </p>
                  </div>

                  <div className="bg-[#252525] rounded p-3 border border-[#3e3e3e]">
                    <label className="flex items-center justify-between text-xs text-white font-medium mb-3">
                      Gesture Zoom Sensitivity
                      <span className="text-amber-500">{settings.gestureSensitivity.toFixed(1)}x</span>
                    </label>
                    <input
                      type="range"
                      min={0.1}
                      max={3}
                      step={0.1}
                      value={settings.gestureSensitivity}
                      onChange={(e) => updateSettings({ gestureSensitivity: Number(e.target.value) })}
                      className="w-full h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
                    />
                    <p className="text-[10px] text-[#a0a0a0] mt-2">
                      Adjusts the zoom speed when using trackpad gestures or Ctrl+Scroll in the canvas.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'keyboard' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-semibold text-white uppercase tracking-wider">Keyboard Shortcuts</h3>
                  <button
                    onClick={() => {
                      // FIX M17: Also clear any active recording state when resetting shortcuts
                      setRecordingActionId(null);
                      setConflictDetail(null);
                      updateSettings({ keyboardShortcuts: {} });
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 text-[10px] text-red-400 hover:text-red-300 hover:bg-red-950/20 border border-red-900/30 rounded transition-colors"
                  >
                    <RotateCw className="w-3 h-3" />
                    Reset to Defaults
                  </button>
                </div>

                {/* Search Bar */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-[#a0a0a0]" />
                  <input
                    type="text"
                    placeholder="Search shortcuts..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-[#1e1e1e] border border-[#3e3e3e] rounded pl-8 pr-3 py-1.5 text-xs text-white placeholder-[#a0a0a0] focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Scrollable list of actions grouped by Category */}
                <div className="overflow-y-auto space-y-4 pr-1" style={{ maxHeight: 'calc(80vh - 220px)' }}>
                  {(() => {
                    const customShortcuts = settings.keyboardShortcuts || {};
                    
                    // Filter shortcuts
                    const filtered = DEFAULT_SHORTCUTS.filter((def) =>
                      def.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      def.category.toLowerCase().includes(searchQuery.toLowerCase())
                    );

                    // Group by category
                    const categories = Array.from(new Set(DEFAULT_SHORTCUTS.map(s => s.category)));

                    return categories.map((cat) => {
                      const catShortcuts = filtered.filter(s => s.category === cat);
                      if (catShortcuts.length === 0) return null;

                      return (
                        <div key={cat} className="space-y-1.5">
                          <p className="text-[10px] font-semibold text-amber-500 uppercase tracking-wider px-1">{cat}</p>
                          <div className="space-y-0.5">
                            {catShortcuts.map((def) => {
                              const customKey = customShortcuts[def.id];
                              const isCustom = customKey !== undefined;
                              const currentCombo = isCustom ? customKey : def.defaultKey;
                              const isRecording = recordingActionId === def.id;

                              return (
                                <div
                                  key={def.id}
                                  className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-[#252525] border border-transparent hover:border-[#3e3e3e]/40 transition-all group"
                                >
                                  <div className="flex flex-col">
                                    <span className="text-xs text-white font-medium">{def.label}</span>
                                    {isCustom && customKey === '' && (
                                      <span className="text-[9px] text-red-400">Unbound</span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-1.5">
                                    <button
                                      onClick={() => setRecordingActionId(isRecording ? null : def.id)}
                                      className={`px-2.5 py-1 text-[10px] font-mono border rounded min-w-[70px] text-center transition-all ${
                                        isRecording
                                          ? 'bg-amber-500/20 border-amber-500 text-amber-400 animate-pulse'
                                          : currentCombo
                                          ? 'bg-[#1e1e1e] border-[#3e3e3e] text-[#a0a0a0] hover:text-white hover:border-[#a0a0a0]'
                                          : 'bg-[#1e1e1e] border-dashed border-red-500/40 text-red-400 hover:text-red-300'
                                      }`}
                                    >
                                      {isRecording ? 'Press...' : currentCombo || 'None'}
                                    </button>

                                    {isCustom && (
                                      <button
                                        onClick={() => {
                                          const newShortcuts = { ...customShortcuts };
                                          delete newShortcuts[def.id]; // Delete custom mapping -> reverts to default
                                          updateSettings({ keyboardShortcuts: newShortcuts });
                                        }}
                                        title="Reset to default key"
                                        className="p-1 hover:bg-[#3e3e3e] rounded text-[#a0a0a0] hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                                      >
                                        <RotateCcw className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>

                {/* Conflict Overlay Modal */}
                {conflictDetail && (
                  <div className="absolute inset-0 bg-black/80 flex items-center justify-center p-4 z-[110]">
                    <div className="bg-[#2d2d2d] border border-red-500/30 rounded-lg p-4 max-w-sm w-full space-y-3 shadow-2xl">
                      <div className="flex items-center gap-2 text-red-400">
                        <AlertTriangle className="w-5 h-5 shrink-0" />
                        <h4 className="text-xs font-semibold uppercase tracking-wider">Hotkey Conflict</h4>
                      </div>
                      
                      <p className="text-xs text-[#a0a0a0] leading-relaxed">
                        The combination <span className="font-mono text-white px-1.5 py-0.5 bg-[#1e1e1e] border border-[#3e3e3e] rounded text-[10px]">{conflictDetail.keyCombo}</span> is already bound to:
                        <strong className="block text-white mt-1">
                          {DEFAULT_SHORTCUTS.find(s => s.id === conflictDetail.conflictingActionId)?.label}
                        </strong>
                      </p>

                      <div className="flex gap-2 pt-1.5">
                        <button
                          onClick={() => handleResolveConflict(true)}
                          className="flex-1 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded transition-colors"
                        >
                          Overwrite
                        </button>
                        <button
                          onClick={() => handleResolveConflict(false)}
                          className="flex-1 py-1.5 text-xs font-medium text-[#a0a0a0] hover:text-white bg-[#3e3e3e] hover:bg-[#4d4d4d] rounded transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'performance' && (
              <div className="space-y-4">
                <h3 className="text-xs font-semibold text-white uppercase tracking-wider">Performance</h3>

                <div className="space-y-3">
                  <div className="bg-[#252525] rounded p-3 border border-[#3e3e3e]">
                    <div className="flex items-center gap-2 mb-2">
                      <Monitor className="w-4 h-4 text-blue-400" />
                      <span className="text-xs text-white font-medium">Preview Quality</span>
                    </div>
                    <select
                      value={settings.previewQuality}
                      onChange={(e) => updateSettings({ previewQuality: e.target.value as any })}
                      className="w-full px-2 py-1.5 bg-[#1e1e1e] border border-[#3e3e3e] rounded text-xs text-white focus:outline-none focus:border-amber-500"
                    >
                      <option value="full">Full (Best Quality)</option>
                      <option value="half">Half (Balanced)</option>
                      <option value="quarter">Quarter (Best Performance)</option>
                    </select>
                  </div>

                  <div className="bg-[#252525] rounded p-3 border border-[#3e3e3e]">
                    <div className="flex items-center gap-2 mb-2">
                      <HardDrive className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs text-white font-medium">Cache Settings</span>
                    </div>
                    <p className="text-[10px] text-[#a0a0a0] mb-2">
                      Clear cached preview files to free up disk space
                    </p>
                    <button 
                      onClick={() => {
                        clearPreviewCaches();
                        alert('Preview image cache cleared successfully!');
                      }}
                      className="px-3 py-1.5 bg-[#1e1e1e] border border-[#3e3e3e] rounded text-xs text-[#a0a0a0] hover:text-white hover:border-amber-500 transition-colors"
                    >
                      Clear Cache
                    </button>
                  </div>

                  <div className="bg-[#252525] rounded p-3 border border-[#3e3e3e]">
                    <span className="text-xs text-white font-medium">Timeline Rendering</span>
                    <div className="mt-2 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-[#a0a0a0]">Show thumbnails</span>
                        <button
                          onClick={() => updateSettings({ showThumbnails: !settings.showThumbnails })}
                          className={`w-9 h-5 rounded-full transition-colors relative ${
                            settings.showThumbnails ? 'bg-amber-500' : 'bg-[#3e3e3e]'
                          }`}
                        >
                          <div
                            className="w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all"
                            style={{ left: settings.showThumbnails ? '18px' : '2px' }}
                          />
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-[#a0a0a0]">Hardware acceleration</span>
                        <button
                          onClick={() => updateSettings({ hardwareAcceleration: !settings.hardwareAcceleration })}
                          className={`w-9 h-5 rounded-full transition-colors relative ${
                            settings.hardwareAcceleration ? 'bg-amber-500' : 'bg-[#3e3e3e]'
                          }`}
                        >
                          <div
                            className="w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all"
                            style={{ left: settings.hardwareAcceleration ? '18px' : '2px' }}
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'recovery' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-semibold text-white uppercase tracking-wider">Project Recovery History</h3>
                  <button
                    onClick={loadAutosaves}
                    className="p-1 hover:bg-[#3e3e3e] rounded text-[#a0a0a0] hover:text-white transition-colors"
                    title="Refresh autosaves list"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-[10px] text-[#a0a0a0]">
                  Periodic background snapshots of your project. Keep up to 10 versions.
                </p>

                <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
                  {autosaves.length === 0 ? (
                    <div className="text-center py-8 text-xs text-[#6a6a6a]">
                      No recovery snapshots found.
                    </div>
                  ) : (
                    autosaves.map((as) => (
                      <div
                        key={as.timestamp}
                        className="bg-[#252525] rounded p-2.5 border border-[#3e3e3e] flex items-center justify-between gap-3 text-xs hover:border-[#4e4e4e] transition-colors"
                      >
                        <div className="flex flex-col gap-0.5">
                          <span className="font-semibold text-[#d0d0d0]">
                            {new Date(as.timestamp).toLocaleString()}
                          </span>
                          <span className="text-[10px] text-[#808080]">
                            {as.tracks.reduce((acc: number, t: any) => acc + t.clips.length, 0)} clips • {as.mediaLibrary.length} media items
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => handleRestoreAutosave(as)}
                            className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-black font-semibold text-[10px] uppercase rounded transition-colors"
                          >
                            Restore
                          </button>
                          <button
                            onClick={async () => {
                              if (confirm('Delete this recovery point?')) {
                                await deleteAutosaveFromDB(as.timestamp);
                                loadAutosaves();
                              }
                            }}
                            className="p-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
