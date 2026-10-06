// ─────────────────────────────────────────────────────────────────────────────
// [SHARED CORE] Used by BOTH the desktop editor (src/App.tsx → DesktopApp) and
// the mobile editor (src/mobile/App.tsx → MobileApp). There is NO separate mobile
// copy — edit ONCE here. LOGIC / ARCHITECTURE / BUGFIX changes automatically apply
// to both UIs. UI-only changes belong in the individual UI layer instead.
// ─────────────────────────────────────────────────────────────────────────────

import { X, Settings, Keyboard, Monitor, HardDrive, RotateCcw, FolderOpen, Sliders, AlertTriangle, Search, RotateCw, History, Trash2, Heart, LayoutGrid, Check } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { useShallow } from 'zustand/react/shallow';
import { useState, useRef, useCallback, useEffect } from 'react';
import { probeFile } from '@/utils/mediaProbe';
import { getAutosavesFromDB, deleteAutosaveFromDB, restoreSnapshotMedia } from '@/utils/projectPersistence';
import { clearPreviewCaches } from '@/utils/canvasEffects';
import { getStorageReport, startStorageMonitor } from '@/utils/storageMonitor';
import { clearImageBitmapPool, getImageBitmapPoolStats } from '@/utils/imageBitmapPool';
import { clearAllMediaWindows } from '@/utils/ramWindowedBlobCache';
import { DEFAULT_SHORTCUTS, getShortcutString, SHORTCUT_PROFILES } from '@/utils/keyboardShortcuts';
import { toast } from 'sonner';
import { WORKSPACE_PRESETS, PRESET_CATEGORIES, getPresetLayout, type WorkspacePreset } from '@/utils/workspacePresets';

export function SettingsModal() {
  const { showSettingsModal, setShowSettingsModal, resetProject, addMedia, settings, updateSettings, aspectRatio, reframeProject, showProgressBar, useProxies, setUseProxies, setShowProgressBar, progressBarColor, setProgressBarColor, progressBarHeight, setProgressBarHeight, workspaceLayout, setWorkspaceLayout } = useEditorStore(useShallow(s => ({ showSettingsModal: s.showSettingsModal, setShowSettingsModal: s.setShowSettingsModal, resetProject: s.resetProject, addMedia: s.addMedia, settings: s.settings, updateSettings: s.updateSettings, aspectRatio: s.aspectRatio, reframeProject: s.reframeProject, showProgressBar: s.showProgressBar, useProxies: s.useProxies, setUseProxies: s.setUseProxies, setShowProgressBar: s.setShowProgressBar, progressBarColor: s.progressBarColor, setProgressBarColor: s.setProgressBarColor, progressBarHeight: s.progressBarHeight, setProgressBarHeight: s.setProgressBarHeight, workspaceLayout: s.workspaceLayout, setWorkspaceLayout: s.setWorkspaceLayout })));
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
  const [activeTab, setActiveTab] = useState<'general' | 'workspace' | 'keyboard' | 'performance' | 'controls' | 'recovery' | 'engagement'>('general');
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
      const loadedTracks = restored.tracks;
      
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
      toast.error("Failed to restore autosave.");
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
    { id: 'workspace' as const, label: 'Workspace', icon: LayoutGrid },
    { id: 'controls' as const, label: 'Controls', icon: Sliders },
    { id: 'keyboard' as const, label: 'Shortcuts', icon: Keyboard },
    { id: 'performance' as const, label: 'Performance', icon: Monitor },
    { id: 'recovery' as const, label: 'Recovery', icon: History },
    { id: 'engagement' as const, label: 'Engagement', icon: Heart },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center">
      <div className={`bg-[var(--theme-bg-panel)] rounded-2xl shadow-2xl max-h-[85vh] overflow-hidden border border-[var(--theme-border)] text-[var(--theme-text-primary)] transition-all duration-200 ${activeTab === 'workspace' ? 'w-[720px]' : 'w-[580px]'}`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--theme-border)]">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-sm font-bold text-[var(--theme-text-primary)]">Settings</h2>
          </div>
          <button
            onClick={() => setShowSettingsModal(false)}
            className="p-1 text-[var(--theme-text-muted)] hover:text-white rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex" style={{ maxHeight: 'calc(80vh - 65px)' }}>
          {/* Sidebar */}
          <div className="w-36 border-r border-[var(--theme-border)] bg-[var(--theme-bg-subpanel)]">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full px-3 py-2.5 text-xs flex items-center gap-2 transition-colors ${
                    activeTab === tab.id
                      ? 'text-white bg-[var(--theme-bg-card)] border-l-2 border-blue-600 dark:border-blue-400'
                      : 'text-[var(--theme-text-muted)] hover:text-white hover:bg-[var(--theme-bg-panel)]'
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
                <h3 className="text-xs font-bold text-[var(--theme-text-primary)] uppercase tracking-wider">Project Settings</h3>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-medium text-[var(--theme-text-primary)]">Autosave</span>
                      <p className="text-[10px] text-[var(--theme-text-muted)]">Save project automatically</p>
                    </div>
                    <button
                      onClick={() => updateSettings({ autosave: !settings.autosave })}
                      className={`w-9 h-5 rounded-full transition-colors relative ${
                        settings.autosave ? 'bg-blue-600' : 'bg-[var(--theme-bg-card)]'
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
                      <span className="text-xs font-medium text-[var(--theme-text-primary)]">Snap to Clips</span>
                      <p className="text-[10px] text-[var(--theme-text-muted)]">Auto-snap clips when dragging</p>
                    </div>
                    <button
                      onClick={() => updateSettings({ snapEnabled: !settings.snapEnabled })}
                      className={`w-9 h-5 rounded-full transition-colors relative ${
                        settings.snapEnabled ? 'bg-blue-600' : 'bg-[var(--theme-bg-card)]'
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
                      <span className="text-xs font-medium text-[var(--theme-text-primary)]">Show Waveforms</span>
                      <p className="text-[10px] text-[var(--theme-text-muted)]">Display audio waveforms on clips</p>
                    </div>
                    <button
                      onClick={() => updateSettings({ showWaveform: !settings.showWaveform })}
                      className={`w-9 h-5 rounded-full transition-colors relative ${
                        settings.showWaveform ? 'bg-blue-600' : 'bg-[var(--theme-bg-card)]'
                      }`}
                    >
                      <div
                        className="w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all"
                        style={{ left: settings.showWaveform ? '18px' : '2px' }}
                      />
                    </button>
                  </div>
                </div>

                <div className="border-t border-[var(--theme-border)] pt-4">
                  <h3 className="text-xs font-bold text-[var(--theme-text-primary)] uppercase tracking-wider mb-3">Default Settings</h3>

                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] text-[var(--theme-text-muted)] block mb-1">Default Image Duration (seconds)</label>
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
                        className="w-full px-2 py-1.5 bg-[var(--theme-bg-subpanel)] border border-[var(--theme-border)] rounded text-xs font-medium text-[var(--theme-text-primary)] focus:outline-none focus:border-blue-600 dark:border-blue-400"
                      />
                    </div>
                  </div>
                </div>

                
                <div className="border-t border-[var(--theme-border)] pt-4">
                  <h3 className="text-xs font-bold text-[var(--theme-text-primary)] uppercase tracking-wider mb-3">Smart Reframing</h3>
                  <p className="text-[10px] text-[var(--theme-text-muted)] mb-3">
                    Automatically convert your project for different platforms (e.g. TikTok / Shorts). 
                    This will scale and crop all your existing video clips to fill the new aspect ratio.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        if (confirm('Reframe project to 16:9 Landscape? This will adjust all clip scales.')) {
                          reframeProject('16:9');
                        }
                      }}
                      className={`flex-1 py-2 rounded text-xs transition-colors ${aspectRatio === '16:9' ? 'bg-blue-600 text-black font-semibold' : 'bg-[var(--theme-bg-subpanel)] border border-[var(--theme-border)] text-[var(--theme-text-muted)] hover:text-white'}`}
                    >
                      16:9 (Landscape)
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Reframe project to 9:16 Vertical? This will adjust all clip scales.')) {
                          reframeProject('9:16');
                        }
                      }}
                      className={`flex-1 py-2 rounded text-xs transition-colors ${aspectRatio === '9:16' ? 'bg-blue-600 text-black font-semibold' : 'bg-[var(--theme-bg-subpanel)] border border-[var(--theme-border)] text-[var(--theme-text-muted)] hover:text-white'}`}
                    >
                      9:16 (Vertical)
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Reframe project to 1:1 Square? This will adjust all clip scales.')) {
                          reframeProject('1:1');
                        }
                      }}
                      className={`flex-1 py-2 rounded text-xs transition-colors ${aspectRatio === '1:1' ? 'bg-blue-600 text-black font-semibold' : 'bg-[var(--theme-bg-subpanel)] border border-[var(--theme-border)] text-[var(--theme-text-muted)] hover:text-white'}`}
                    >
                      1:1 (Square)
                    </button>
                  </div>
                </div>

                <div className="border-t border-[var(--theme-border)] pt-4">
                  <h3 className="text-xs font-bold text-[var(--theme-text-primary)] uppercase tracking-wider mb-3">AI API Keys</h3>
                  <p className="text-[10px] text-[var(--theme-text-muted)] mb-3">
                    These local keys act as a fallback if the Vercel environment variables hit a rate limit (429) or connection error.
                  </p>
                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] text-white block mb-1">Gemini API Key</label>
                      <input
                        type="password"
                        placeholder="AIzaSy..."
                        value={settings.geminiApiKey || ''}
                        onChange={(e) => updateSettings({ geminiApiKey: e.target.value })}
                        className="w-full px-2 py-1.5 bg-[var(--theme-bg-subpanel)] border border-[var(--theme-border)] rounded text-xs font-medium text-[var(--theme-text-primary)] focus:outline-none focus:border-blue-600 dark:border-blue-400"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-white block mb-1">Groq API Key</label>
                      <input
                        type="password"
                        placeholder="gsk_..."
                        value={settings.groqApiKey || ''}
                        onChange={(e) => updateSettings({ groqApiKey: e.target.value })}
                        className="w-full px-2 py-1.5 bg-[var(--theme-bg-subpanel)] border border-[var(--theme-border)] rounded text-xs font-medium text-[var(--theme-text-primary)] focus:outline-none focus:border-blue-600 dark:border-blue-400"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-white block mb-1">ElevenLabs API Key</label>
                      <input
                        type="password"
                        placeholder="sk_..."
                        value={settings.elevenLabsApiKey || ''}
                        onChange={(e) => updateSettings({ elevenLabsApiKey: e.target.value })}
                        className="w-full px-2 py-1.5 bg-[var(--theme-bg-subpanel)] border border-[var(--theme-border)] rounded text-xs font-medium text-[var(--theme-text-primary)] focus:outline-none focus:border-blue-600 dark:border-blue-400"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-white block mb-1">Freesound API Key</label>
                      <input
                        type="password"
                        placeholder="For AI Sound Design..."
                        value={settings.freesoundApiKey || ''}
                        onChange={(e) => updateSettings({ freesoundApiKey: e.target.value })}
                        className="w-full px-2 py-1.5 bg-[var(--theme-bg-subpanel)] border border-[var(--theme-border)] rounded text-xs font-medium text-[var(--theme-text-primary)] focus:outline-none focus:border-blue-600 dark:border-blue-400"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-white block mb-1">Cloudflare Account ID (For AI Images)</label>
                      <input
                        type="password"
                        placeholder="4cd6b614..."
                        value={settings.cloudflareAccountId || ''}
                        onChange={(e) => updateSettings({ cloudflareAccountId: e.target.value })}
                        className="w-full px-2 py-1.5 bg-[var(--theme-bg-subpanel)] border border-[var(--theme-border)] rounded text-xs font-medium text-[var(--theme-text-primary)] focus:outline-none focus:border-blue-600 dark:border-blue-400"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-white block mb-1">Cloudflare API Token</label>
                      <input
                        type="password"
                        placeholder="cfat_..."
                        value={settings.cloudflareApiToken || ''}
                        onChange={(e) => updateSettings({ cloudflareApiToken: e.target.value })}
                        className="w-full px-2 py-1.5 bg-[var(--theme-bg-subpanel)] border border-[var(--theme-border)] rounded text-xs font-medium text-[var(--theme-text-primary)] focus:outline-none focus:border-blue-600 dark:border-blue-400"
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t border-[var(--theme-border)] pt-4">
                  <h3 className="text-xs font-bold text-[var(--theme-text-primary)] uppercase tracking-wider mb-3">Project Actions</h3>
                  <div className="space-y-2">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full px-3 py-2 bg-[var(--theme-bg-subpanel)] border border-[var(--theme-border)] rounded text-xs text-[var(--theme-text-muted)] hover:text-white hover:border-blue-600 dark:border-blue-400 transition-colors flex items-center gap-2"
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
                        resetProject(true);
                        setShowSettingsModal(false);
                      }}
                      className="w-full px-3 py-2 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-400 hover:bg-red-500/20 transition-colors flex items-center gap-2"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Reset Project
                    </button>
                  </div>

                  {/* Export Settings */}
                  <h3 className="text-xs font-bold text-[var(--theme-text-primary)] uppercase tracking-wider pt-2">Export Settings</h3>
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <div>
                          <span className="text-xs font-medium text-[var(--theme-text-primary)]">Default Output Folder</span>
                          <p className="text-[10px] text-[var(--theme-text-muted)]">Where exported videos are saved</p>
                        </div>
                      </div>
                      <div className="flex gap-2 items-center">
                        <div className="flex-1 bg-[var(--theme-bg-subpanel)] text-xs border border-[var(--theme-border)] rounded px-3 py-2 text-[var(--theme-text-muted)] overflow-hidden text-ellipsis whitespace-nowrap" title={localStorage.getItem('exportOutputFolder') || 'Desktop (default)'}>
                          {localStorage.getItem('exportOutputFolder') || 'Desktop (default)'}
                        </div>
                        <button
                          onClick={async () => {
                            try {
                              const resp = await fetch('http://127.0.0.1:12589/pick-folder', { signal: AbortSignal.timeout(60000) });
                              const data = await resp.json();
                              if (data.path) {
                                localStorage.setItem('exportOutputFolder', data.path);
                                toast.success(`Export folder set to: ${data.path}`);
                                // Force re-render
                                setShowSettingsModal(false);
                                setTimeout(() => setShowSettingsModal(true), 50);
                              }
                            } catch {
                              toast.error('Could not open folder picker. Make sure Hikmah Runtime is running.');
                            }
                          }}
                          className="shrink-0 px-3 py-2 bg-[#353535] hover:bg-[#404040] text-[var(--theme-text-muted)] hover:text-white text-xs border border-[var(--theme-border)] rounded transition-colors flex items-center gap-1.5"
                        >
                          <FolderOpen className="w-3.5 h-3.5" />
                          Browse
                        </button>
                        {localStorage.getItem('exportOutputFolder') && (
                          <button
                            onClick={() => {
                              localStorage.removeItem('exportOutputFolder');
                              toast.success('Reset to Desktop');
                              setShowSettingsModal(false);
                              setTimeout(() => setShowSettingsModal(true), 50);
                            }}
                            className="shrink-0 px-2 py-2 text-[var(--theme-text-muted)] hover:text-white text-xs transition-colors"
                            title="Reset to Desktop"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Workspace Layouts Tab ──────────────────────────────────── */}
            {activeTab === 'workspace' && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-xs font-bold text-[var(--theme-text-primary)] uppercase tracking-wider">Workspace Layouts</h3>
                  <p className="text-[10px] text-[var(--theme-text-muted)] mt-1">Choose a layout optimized for your workflow. Panel sizes adjust instantly.</p>
                </div>

                {/* Current layout indicator */}
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/8 border border-blue-500/20">
                  <LayoutGrid className="w-3.5 h-3.5 text-blue-500" />
                  <span className="text-[11px] text-[var(--theme-text-muted)]">Active:</span>
                  <span className="text-[11px] font-semibold text-blue-500">
                    {WORKSPACE_PRESETS.find(p => p.id === workspaceLayout?.preset)?.label || workspaceLayout?.preset || 'Classic Editing'}
                  </span>
                </div>

                {PRESET_CATEGORIES.map((cat) => {
                  const presets = WORKSPACE_PRESETS.filter(p => p.category === cat.id);
                  if (presets.length === 0) return null;
                  return (
                    <div key={cat.id} className="space-y-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-[var(--theme-text-primary)] uppercase tracking-wider">{cat.label}</span>
                        <span className="text-[9px] text-[var(--theme-text-muted)]">— {cat.description}</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        {presets.map((preset) => {
                          const isActive = workspaceLayout?.preset === preset.id;
                          return (
                            <button
                              key={preset.id}
                              onClick={() => setWorkspaceLayout(getPresetLayout(preset.id))}
                              className={`group relative rounded-xl border p-3 text-left transition-all duration-150 ${
                                isActive
                                  ? 'border-blue-500 bg-blue-500/8 ring-1 ring-blue-500/30 shadow-sm shadow-blue-500/10'
                                  : 'border-[var(--theme-border)] bg-[var(--theme-bg-subpanel)] hover:border-blue-500/40 hover:bg-[var(--theme-bg-card)]'
                              }`}
                            >
                              {/* Active badge */}
                              {isActive && (
                                <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center">
                                  <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                                </div>
                              )}

                              {/* Mini wireframe preview */}
                              <div className="w-full h-[52px] rounded-md border border-[var(--theme-border)] bg-[var(--theme-bg-panel)] mb-2.5 overflow-hidden flex flex-col">
                                {/* Top bar */}
                                <div className="h-[4px] bg-[var(--theme-border)] shrink-0" />
                                {/* Main area */}
                                <div className="flex-1 flex min-h-0">
                                  {/* Left panel */}
                                  <div
                                    className={`shrink-0 border-r transition-colors ${
                                      isActive ? 'bg-blue-500/15 border-blue-500/30' : 'bg-[var(--theme-bg-subpanel)] border-[var(--theme-border)]'
                                    }`}
                                    style={{ width: `${preset.preview.left * 100}%` }}
                                  />
                                  {/* Center: preview + timeline */}
                                  <div className="flex-1 flex flex-col min-w-0">
                                    <div className={`flex-1 transition-colors ${
                                      isActive ? 'bg-blue-500/5' : 'bg-[var(--theme-bg-app)]'
                                    }`} />
                                    <div
                                      className={`shrink-0 border-t transition-colors ${
                                        isActive ? 'bg-blue-500/12 border-blue-500/30' : 'bg-[var(--theme-bg-card)] border-[var(--theme-border)]'
                                      }`}
                                      style={{ height: `${preset.preview.timeline * 100}%` }}
                                    />
                                  </div>
                                  {/* Right panel */}
                                  {preset.preview.right > 0 && (
                                    <div
                                      className={`shrink-0 border-l transition-colors ${
                                        isActive ? 'bg-blue-500/15 border-blue-500/30' : 'bg-[var(--theme-bg-subpanel)] border-[var(--theme-border)]'
                                      }`}
                                      style={{ width: `${preset.preview.right * 100}%` }}
                                    />
                                  )}
                                </div>
                              </div>

                              {/* Label & description */}
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <span className="text-sm leading-none">{preset.icon}</span>
                                <span className={`text-[11px] font-semibold ${isActive ? 'text-blue-500' : 'text-[var(--theme-text-primary)]'}`}>
                                  {preset.label}
                                </span>
                              </div>
                              <p className="text-[9px] text-[var(--theme-text-muted)] leading-relaxed line-clamp-2">
                                {preset.description}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {/* Custom note */}
                <div className="mt-2 px-3 py-2 rounded-lg bg-[var(--theme-bg-subpanel)] border border-[var(--theme-border)]">
                  <p className="text-[10px] text-[var(--theme-text-muted)]">
                    <span className="font-medium text-[var(--theme-text-primary)]">Tip:</span> Drag panel edges in the editor to fine-tune sizes. Manual resizing switches to "Custom" layout.
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'engagement' && (
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-[var(--theme-text-primary)] uppercase tracking-wider">Social Engagement</h3>
                
                <div className="bg-[var(--theme-bg-subpanel)] rounded p-3 border border-[var(--theme-border)]">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Heart className="w-4 h-4 text-pink-500" />
                      <span className="text-xs font-medium text-[var(--theme-text-primary)] font-medium">Dynamic Progress Bar</span>
                    </div>
                    <button
                      onClick={() => setShowProgressBar(!showProgressBar)}
                      className={`w-9 h-5 rounded-full transition-colors relative ${
                        showProgressBar ? 'bg-pink-500' : 'bg-[var(--theme-bg-card)]'
                      }`}
                    >
                      <div
                        className="w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all"
                        style={{ left: showProgressBar ? '18px' : '2px' }}
                      />
                    </button>
                  </div>
                  <p className="text-[10px] text-[var(--theme-text-muted)] mb-4">
                    Displays a continuous progress bar during playback. Often used in YouTube Shorts and TikToks to improve viewer retention.
                  </p>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-[var(--theme-text-primary)]">Bar Color</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-[var(--theme-text-muted)] font-mono">{progressBarColor.toUpperCase()}</span>
                        <input
                          type="color"
                          value={progressBarColor}
                          onChange={(e) => setProgressBarColor(e.target.value)}
                          className="w-6 h-6 rounded cursor-pointer bg-transparent border-0 p-0"
                          style={{ WebkitAppearance: 'none' }}
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-medium text-[var(--theme-text-primary)]">
                        <span>Bar Height</span>
                        <span className="text-pink-500">{progressBarHeight}px</span>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={20}
                        step={1}
                        value={progressBarHeight}
                        onChange={(e) => setProgressBarHeight(Number(e.target.value))}
                        className="w-full h-1 bg-[var(--theme-bg-card)] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-pink-500 [&::-webkit-slider-thumb]:rounded-full"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'controls' && (
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-[var(--theme-text-primary)] uppercase tracking-wider">Canvas Controls</h3>
                
                <div className="space-y-4">
                  <div className="bg-[var(--theme-bg-subpanel)] rounded p-3 border border-[var(--theme-border)]">
                    <label className="flex items-center justify-between text-xs font-medium text-[var(--theme-text-primary)] font-medium mb-3">
                      Scroll Speed
                      <span className="text-blue-600 dark:text-blue-400">{settings.scrollSpeed.toFixed(1)}x</span>
                    </label>
                    <input
                      type="range"
                      min={0.1}
                      max={3}
                      step={0.1}
                      value={settings.scrollSpeed}
                      onChange={(e) => updateSettings({ scrollSpeed: Number(e.target.value) })}
                      className="w-full h-1 bg-[var(--theme-bg-card)] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-blue-600 [&::-webkit-slider-thumb]:rounded-full"
                    />
                    <p className="text-[10px] text-[var(--theme-text-muted)] mt-2">
                      Adjusts the timeline and track scrolling speed.
                    </p>
                  </div>

                  <div className="bg-[var(--theme-bg-subpanel)] rounded p-3 border border-[var(--theme-border)]">
                    <label className="flex items-center justify-between text-xs font-medium text-[var(--theme-text-primary)] font-medium mb-3">
                      Gesture Zoom Sensitivity
                      <span className="text-blue-600 dark:text-blue-400">{settings.gestureSensitivity.toFixed(1)}x</span>
                    </label>
                    <input
                      type="range"
                      min={0.1}
                      max={3}
                      step={0.1}
                      value={settings.gestureSensitivity}
                      onChange={(e) => updateSettings({ gestureSensitivity: Number(e.target.value) })}
                      className="w-full h-1 bg-[var(--theme-bg-card)] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-blue-600 [&::-webkit-slider-thumb]:rounded-full"
                    />
                    <p className="text-[10px] text-[var(--theme-text-muted)] mt-2">
                      Adjusts the zoom speed when using trackpad gestures or Ctrl+Scroll in the canvas.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'keyboard' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-bold text-[var(--theme-text-primary)] uppercase tracking-wider">Keyboard Shortcuts</h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = '.json';
                        input.onchange = (e) => {
                          const file = (e.target as HTMLInputElement).files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = (re) => {
                            try {
                              const json = JSON.parse(re.target?.result as string);
                              updateSettings({ keyboardShortcuts: json });
                              toast.success("Shortcuts imported successfully.");
                            } catch (err) { toast.error("Invalid JSON file"); }
                          };
                          reader.readAsText(file);
                        };
                        input.click();
                      }}
                      className="px-2.5 py-1 text-[10px] text-blue-600 dark:text-blue-400 hover:text-amber-300 border border-amber-900/30 hover:bg-amber-900/20 rounded transition-colors"
                    >Import</button>
                    <button
                      onClick={() => {
                        const json = JSON.stringify(settings.keyboardShortcuts || {}, null, 2);
                        const blob = new Blob([json], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'procut-shortcuts.json';
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        // FIX C3: release blob URL to prevent memory leak
                        setTimeout(() => URL.revokeObjectURL(url), 0);
                      }}
                      className="px-2.5 py-1 text-[10px] text-blue-600 dark:text-blue-400 hover:text-amber-300 border border-amber-900/30 hover:bg-amber-900/20 rounded transition-colors"
                    >Export</button>
                    <select
                      className="bg-[var(--theme-bg-subpanel)] border border-[var(--theme-border)] text-[10px] text-[var(--theme-text-muted)] hover:text-white px-2 py-1 rounded focus:outline-none"
                      onChange={(e) => {
                        if (e.target.value === 'Default') {
                          updateSettings({ keyboardShortcuts: {} });
                        } else {
                          const profile = SHORTCUT_PROFILES[e.target.value];
                          if (profile) {
                             updateSettings({ keyboardShortcuts: profile });
                          }
                        }
                        // Reset dropdown selection visually
                        e.target.value = "";
                      }}
                    >
                       <option value="">-- Presets --</option>
                       {Object.keys(SHORTCUT_PROFILES).map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
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
                      Reset
                    </button>
                  </div>
                </div>

                {/* Search Bar */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-[var(--theme-text-muted)]" />
                  <input
                    type="text"
                    placeholder="Search shortcuts..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-[var(--theme-bg-subpanel)] border border-[var(--theme-border)] rounded pl-8 pr-3 py-1.5 text-xs font-medium text-[var(--theme-text-primary)] placeholder-[#a0a0a0] focus:outline-none focus:border-blue-600 dark:border-blue-400"
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
                          <p className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider px-1">{cat}</p>
                          <div className="space-y-0.5">
                            {catShortcuts.map((def) => {
                              const customKey = customShortcuts[def.id];
                              const isCustom = customKey !== undefined;
                              const currentCombo = isCustom ? customKey : def.defaultKey;
                              const isRecording = recordingActionId === def.id;

                              return (
                                <div
                                  key={def.id}
                                  className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-[var(--theme-bg-subpanel)] border border-transparent hover:border-[var(--theme-border)]/40 transition-all group"
                                >
                                  <div className="flex flex-col">
                                    <span className="text-xs font-medium text-[var(--theme-text-primary)] font-medium">{def.label}</span>
                                    {isCustom && customKey === '' && (
                                      <span className="text-[9px] text-red-400">Unbound</span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-1.5">
                                    <button
                                      onClick={() => setRecordingActionId(isRecording ? null : def.id)}
                                      className={`px-2.5 py-1 text-[10px] font-mono border rounded min-w-[70px] text-center transition-all ${
                                        isRecording
                                          ? 'bg-blue-600/20 border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400 animate-pulse'
                                          : currentCombo
                                          ? 'bg-[var(--theme-bg-subpanel)] border-[var(--theme-border)] text-[var(--theme-text-muted)] hover:text-white hover:border-[#a0a0a0]'
                                          : 'bg-[var(--theme-bg-subpanel)] border-dashed border-red-500/40 text-red-400 hover:text-red-300'
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
                                        className="p-1 hover:bg-[var(--theme-bg-card)] rounded text-[var(--theme-text-muted)] hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
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
                    <div className="bg-[var(--theme-bg-panel)] border border-red-500/30 rounded-lg p-4 max-w-sm w-full space-y-3 shadow-2xl">
                      <div className="flex items-center gap-2 text-red-400">
                        <AlertTriangle className="w-5 h-5 shrink-0" />
                        <h4 className="text-xs font-semibold uppercase tracking-wider">Hotkey Conflict</h4>
                      </div>
                      
                      <p className="text-xs text-[var(--theme-text-muted)] leading-relaxed">
                        The combination <span className="font-mono text-white px-1.5 py-0.5 bg-[var(--theme-bg-subpanel)] border border-[var(--theme-border)] rounded text-[10px]">{conflictDetail.keyCombo}</span> is already bound to:
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
                          className="flex-1 py-1.5 text-xs font-medium text-[var(--theme-text-muted)] hover:text-white bg-[var(--theme-bg-card)] hover:bg-[#4d4d4d] rounded transition-colors"
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
                <h3 className="text-xs font-bold text-[var(--theme-text-primary)] uppercase tracking-wider">Performance</h3>

                <div className="space-y-3">
                  <div className="bg-[var(--theme-bg-subpanel)] rounded p-3 border border-[var(--theme-border)]">
                    <div className="flex items-center gap-2 mb-2">
                      <Monitor className="w-4 h-4 text-blue-400" />
                      <span className="text-xs font-medium text-[var(--theme-text-primary)] font-medium">Preview Quality</span>
                    </div>
                    <select
                      value={settings.previewQuality}
                      onChange={(e) => updateSettings({ previewQuality: e.target.value as any })}
                      className="w-full px-2 py-1.5 bg-[var(--theme-bg-subpanel)] border border-[var(--theme-border)] rounded text-xs font-medium text-[var(--theme-text-primary)] focus:outline-none focus:border-blue-600 dark:border-blue-400"
                    >
                      <option value="full">Full (Best Quality)</option>
                      <option value="half">Half (Balanced)</option>
                      <option value="quarter">Quarter (Best Performance)</option>
                    </select>
                  </div>

                  <div className="bg-[var(--theme-bg-subpanel)] rounded p-3 border border-[var(--theme-border)]">
                    <div className="flex items-center gap-2 mb-2">
                      <Monitor className="w-4 h-4 text-purple-400" />
                      <span className="text-xs font-medium text-[var(--theme-text-primary)] font-medium">Preview Gating & Short-Circuit</span>
                    </div>
                    <select
                      value={settings.previewMode || 'auto'}
                      onChange={(e) => updateSettings({ previewMode: e.target.value as any })}
                      className="w-full px-2 py-1.5 bg-[var(--theme-bg-subpanel)] border border-[var(--theme-border)] rounded text-xs font-medium text-[var(--theme-text-primary)] focus:outline-none focus:border-blue-600 dark:border-blue-400"
                    >
                      <option value="auto">Auto (engine short-circuits on heavy FX)</option>
                      <option value="fast">Fast (downscale 2×, skip heavy CPU loops)</option>
                      <option value="high">High Quality (always render full FX)</option>
                    </select>
                    <p className="text-[10px] text-[var(--theme-text-muted)] mt-1.5">
                      Controls whether high-cost CPU effects (AI background, Object removal, Chroma key) are short-circuited during active video playback to lock 60 FPS.
                    </p>
                  </div>

                  <div className="bg-[var(--theme-bg-subpanel)] rounded p-3 border border-[var(--theme-border)]">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <Monitor className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs font-medium text-[var(--theme-text-primary)] font-medium">Proxy Workflow</span>
                      </div>
                      <button
                        onClick={() => setUseProxies(!useProxies)}
                        className={`w-9 h-5 rounded-full transition-colors relative ${
                          useProxies ? 'bg-emerald-500' : 'bg-[var(--theme-bg-card)]'
                        }`}
                      >
                        <div
                          className="w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all"
                          style={{ left: useProxies ? '18px' : '2px' }}
                        />
                      </button>
                    </div>
                    <p className="text-[10px] text-[var(--theme-text-muted)]">Use low-resolution proxy files for smooth playback on heavy projects.</p>
                  </div>

                  <div className="bg-[var(--theme-bg-subpanel)] rounded p-3 border border-[var(--theme-border)]">
                    <div className="flex items-center gap-2 mb-2">
                      <HardDrive className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-medium text-[var(--theme-text-primary)] font-medium">Cache Settings</span>
                    </div>
                    <p className="text-[10px] text-[var(--theme-text-muted)] mb-2">
                      Clear cached preview files to free up disk space
                    </p>
                    <button
                      onClick={() => {
                        clearPreviewCaches();
                        toast.success('Preview image cache cleared successfully!');
                      }}
                      className="px-3 py-1.5 bg-[var(--theme-bg-subpanel)] border border-[var(--theme-border)] rounded text-xs text-[var(--theme-text-muted)] hover:text-white hover:border-blue-600 dark:border-blue-400 transition-colors"
                    >
                      Clear Cache
                    </button>
                  </div>

                  <div className="bg-[var(--theme-bg-subpanel)] rounded p-3 border border-[var(--theme-border)]">
                    <div className="flex items-center gap-2 mb-2">
                      <HardDrive className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span className="text-xs font-medium text-[var(--theme-text-primary)] font-medium">Storage Health</span>
                    </div>
                    <p className="text-[10px] text-[var(--theme-text-muted)] mb-2">
                      Browser storage quota + RAM cache usage. Streams from SSD when possible.
                    </p>
                    <StorageHealthWidget />
                  </div>

                  <div className="bg-[var(--theme-bg-subpanel)] rounded p-3 border border-[var(--theme-border)]">
                    <span className="text-xs font-medium text-[var(--theme-text-primary)] font-medium">Timeline Rendering</span>
                    <div className="mt-2 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-[var(--theme-text-muted)]">Show thumbnails</span>
                        <button
                          onClick={() => updateSettings({ showThumbnails: !settings.showThumbnails })}
                          className={`w-9 h-5 rounded-full transition-colors relative ${
                            settings.showThumbnails ? 'bg-blue-600' : 'bg-[var(--theme-bg-card)]'
                          }`}
                        >
                          <div
                            className="w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all"
                            style={{ left: settings.showThumbnails ? '18px' : '2px' }}
                          />
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-[var(--theme-text-muted)]">Hardware acceleration</span>
                        <button
                          onClick={() => updateSettings({ hardwareAcceleration: !settings.hardwareAcceleration })}
                          className={`w-9 h-5 rounded-full transition-colors relative ${
                            settings.hardwareAcceleration ? 'bg-blue-600' : 'bg-[var(--theme-bg-card)]'
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
                  <h3 className="text-xs font-bold text-[var(--theme-text-primary)] uppercase tracking-wider">Project Recovery History</h3>
                  <button
                    onClick={loadAutosaves}
                    className="p-1 hover:bg-[var(--theme-bg-card)] rounded text-[var(--theme-text-muted)] hover:text-white transition-colors"
                    title="Refresh autosaves list"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-[10px] text-[var(--theme-text-muted)]">
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
                        className="bg-[var(--theme-bg-subpanel)] rounded p-2.5 border border-[var(--theme-border)] flex items-center justify-between gap-3 text-xs hover:border-[#4e4e4e] transition-colors"
                      >
                        <div className="flex flex-col gap-0.5">
                          <span className="font-semibold text-[var(--theme-text-primary)]">
                            {new Date(as.timestamp).toLocaleString()}
                          </span>
                          <span className="text-[10px] text-[var(--theme-text-muted)]">
                            {as.tracks.reduce((acc: number, t: any) => acc + t.clips.length, 0)} clips • {as.mediaLibrary.length} media items
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => handleRestoreAutosave(as)}
                            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-600 text-black font-semibold text-[10px] uppercase rounded transition-colors"
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

/**
 * StorageHealthWidget — live storage quota + RAM cache usage.
 * Polls storage.estimate() and the windowed cache stats every 5s while open.
 */
function StorageHealthWidget() {
  const [report, setReport] = useState<{
    quotaMB: number;
    usedMB: number;
    percent: number;
    windowCache: { entries: number; maxEntries: number; windowSeconds: number };
    bitmapPixelsMB: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      const r = await getStorageReport();
      const bitmap = getImageBitmapPoolStats();
      if (cancelled) return;
      setReport({
        quotaMB: r?.quotaMB ?? 0,
        usedMB: r?.usedMB ?? 0,
        percent: r?.percent ?? 0,
        windowCache: r?.windowCache ?? { entries: 0, maxEntries: 0, windowSeconds: 0 },
        bitmapPixelsMB: bitmap.pixelsMB,
      });
    };
    tick();
    const id = window.setInterval(tick, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  // Subscribe to storage warnings.
  useEffect(() => {
    const handle = startStorageMonitor((r) => {
      toast.warning(
        `Storage ${r.percent}% full (${r.usedMB} MB / ${r.quotaMB} MB). Consider clearing preview caches.`,
      );
    }, 60_000);
    return handle.stop;
  }, []);

  if (!report) return <div className="text-[10px] text-[#666]">Loading...</div>;

  const percent = Math.min(100, report.percent);
  const color =
    percent >= 90 ? 'bg-red-500' : percent >= 70 ? 'bg-blue-600' : 'bg-emerald-500';

  return (
    <div className="space-y-2">
      <div>
        <div className="flex justify-between text-[10px] text-[var(--theme-text-muted)] mb-1">
          <span>Browser Storage</span>
          <span>
            {report.usedMB} MB / {report.quotaMB} MB
          </span>
        </div>
        <div className="h-1.5 bg-[var(--theme-bg-subpanel)] rounded overflow-hidden">
          <div
            className={`h-full ${color} transition-all duration-300`}
            style={{ width: `${percent}%` }}
          />
        </div>
        <div className="text-[9px] text-[#666] mt-0.5">{percent}% used</div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-[10px]">
        <div className="bg-[var(--theme-bg-subpanel)] rounded px-2 py-1.5">
          <div className="text-[var(--theme-text-muted)]">RAM Window</div>
          <div className="text-white">
            {report.windowCache.entries}/{report.windowCache.maxEntries}
          </div>
          <div className="text-[9px] text-[#666]">±{report.windowCache.windowSeconds}s each</div>
        </div>
        <div className="bg-[var(--theme-bg-subpanel)] rounded px-2 py-1.5">
          <div className="text-[var(--theme-text-muted)]">Bitmap Cache</div>
          <div className="text-white">{report.bitmapPixelsMB} MB</div>
          <div className="text-[9px] text-[#666]">capped at 64 MB</div>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => {
            clearImageBitmapPool();
            toast.success('ImageBitmap cache cleared.');
          }}
          className="px-2 py-1 bg-[var(--theme-bg-subpanel)] border border-[var(--theme-border)] rounded text-[10px] text-[var(--theme-text-muted)] hover:text-white hover:border-blue-600 dark:border-blue-400 transition-colors"
        >
          Clear Bitmaps
        </button>
        <button
          onClick={() => {
            clearAllMediaWindows();
            toast.success('RAM windowed cache cleared.');
          }}
          className="px-2 py-1 bg-[var(--theme-bg-subpanel)] border border-[var(--theme-border)] rounded text-[10px] text-[var(--theme-text-muted)] hover:text-white hover:border-blue-600 dark:border-blue-400 transition-colors"
        >
          Clear RAM Cache
        </button>
      </div>
    </div>
  );
}
