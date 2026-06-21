import { X, Settings, Keyboard, Monitor, HardDrive, RotateCcw } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { useState } from 'react';

export function SettingsModal() {
  const { showSettingsModal, setShowSettingsModal, resetProject, loadDemoProject } = useEditorStore();
  const [activeTab, setActiveTab] = useState<'general' | 'keyboard' | 'performance'>('general');
  const [autosave, setAutosave] = useState(true);
  const [showWaveforms, setShowWaveforms] = useState(true);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [defaultDuration, setDefaultDuration] = useState(5);

  if (!showSettingsModal) return null;

  const tabs = [
    { id: 'general' as const, label: 'General', icon: Settings },
    { id: 'keyboard' as const, label: 'Shortcuts', icon: Keyboard },
    { id: 'performance' as const, label: 'Performance', icon: Monitor },
  ];

  const shortcuts = [
    { key: 'Space', action: 'Play / Pause' },
    { key: 'S', action: 'Split tool' },
    { key: 'V', action: 'Select tool' },
    { key: 'H', action: 'Hand tool' },
    { key: 'Z', action: 'Zoom tool' },
    { key: 'Delete', action: 'Delete clip' },
    { key: 'Ctrl + C', action: 'Copy clip' },
    { key: 'Ctrl + V', action: 'Paste clip' },
    { key: 'Ctrl + X', action: 'Cut clip' },
    { key: 'Ctrl + D', action: 'Duplicate clip' },
    { key: 'Ctrl + Z', action: 'Undo' },
    { key: 'Ctrl + Y', action: 'Redo' },
    { key: '+', action: 'Zoom in' },
    { key: '-', action: 'Zoom out' },
    { key: 'Home', action: 'Go to start' },
    { key: 'End', action: 'Go to end' },
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
                      onClick={() => setAutosave(!autosave)}
                      className={`w-9 h-5 rounded-full transition-colors relative ${
                        autosave ? 'bg-amber-500' : 'bg-[#3e3e3e]'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all ${
                          autosave ? 'left-4.5' : 'left-0.5'
                        }`}
                        style={{ left: autosave ? '18px' : '2px' }}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs text-white">Snap to Clips</span>
                      <p className="text-[10px] text-[#a0a0a0]">Auto-snap clips when dragging</p>
                    </div>
                    <button
                      onClick={() => setSnapEnabled(!snapEnabled)}
                      className={`w-9 h-5 rounded-full transition-colors relative ${
                        snapEnabled ? 'bg-amber-500' : 'bg-[#3e3e3e]'
                      }`}
                    >
                      <div
                        className="w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all"
                        style={{ left: snapEnabled ? '18px' : '2px' }}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs text-white">Show Waveforms</span>
                      <p className="text-[10px] text-[#a0a0a0]">Display audio waveforms on clips</p>
                    </div>
                    <button
                      onClick={() => setShowWaveforms(!showWaveforms)}
                      className={`w-9 h-5 rounded-full transition-colors relative ${
                        showWaveforms ? 'bg-amber-500' : 'bg-[#3e3e3e]'
                      }`}
                    >
                      <div
                        className="w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all"
                        style={{ left: showWaveforms ? '18px' : '2px' }}
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
                        value={defaultDuration}
                        onChange={(e) => setDefaultDuration(Number(e.target.value))}
                        min={1}
                        max={60}
                        className="w-full px-2 py-1.5 bg-[#1e1e1e] border border-[#3e3e3e] rounded text-xs text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t border-[#3e3e3e] pt-4">
                  <h3 className="text-xs font-semibold text-white uppercase tracking-wider mb-3">Project Actions</h3>
                  <div className="space-y-2">
                    <button
                      onClick={() => { loadDemoProject(); setShowSettingsModal(false); }}
                      className="w-full px-3 py-2 bg-[#252525] border border-[#3e3e3e] rounded text-xs text-[#a0a0a0] hover:text-white hover:border-amber-500 transition-colors flex items-center gap-2"
                    >
                      <HardDrive className="w-3.5 h-3.5" />
                      Load Demo Project
                    </button>
                    <button
                      onClick={() => { resetProject(); setShowSettingsModal(false); }}
                      className="w-full px-3 py-2 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-400 hover:bg-red-500/20 transition-colors flex items-center gap-2"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Reset Project
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'keyboard' && (
              <div>
                <h3 className="text-xs font-semibold text-white uppercase tracking-wider mb-3">Keyboard Shortcuts</h3>
                <div className="space-y-0.5">
                  {shortcuts.map(({ key, action }) => (
                    <div
                      key={key}
                      className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-[#3e3e3e] transition-colors"
                    >
                      <span className="text-xs text-white">{action}</span>
                      <kbd className="px-2 py-0.5 bg-[#1e1e1e] border border-[#3e3e3e] rounded text-[10px] text-[#a0a0a0] font-mono">
                        {key}
                      </kbd>
                    </div>
                  ))}
                </div>
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
                    <select className="w-full px-2 py-1.5 bg-[#1e1e1e] border border-[#3e3e3e] rounded text-xs text-white focus:outline-none focus:border-amber-500">
                      <option>Full (Best Quality)</option>
                      <option>Half (Balanced)</option>
                      <option>Quarter (Best Performance)</option>
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
                    <button className="px-3 py-1.5 bg-[#1e1e1e] border border-[#3e3e3e] rounded text-xs text-[#a0a0a0] hover:text-white hover:border-amber-500 transition-colors">
                      Clear Cache
                    </button>
                  </div>

                  <div className="bg-[#252525] rounded p-3 border border-[#3e3e3e]">
                    <span className="text-xs text-white font-medium">Timeline Rendering</span>
                    <div className="mt-2 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-[#a0a0a0]">Show thumbnails</span>
                        <button className="w-9 h-5 rounded-full bg-amber-500 relative">
                          <div className="w-4 h-4 rounded-full bg-white absolute top-0.5" style={{ left: '18px' }} />
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-[#a0a0a0]">Hardware acceleration</span>
                        <button className="w-9 h-5 rounded-full bg-amber-500 relative">
                          <div className="w-4 h-4 rounded-full bg-white absolute top-0.5" style={{ left: '18px' }} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
