// ─────────────────────────────────────────────────────────────────────────────
// [SHARED CORE] Used by BOTH the desktop editor (src/App.tsx → DesktopApp) and
// the mobile editor (src/mobile/App.tsx → MobileApp). There is NO separate mobile
// copy — edit ONCE here. LOGIC / ARCHITECTURE / BUGFIX changes automatically apply
// to both UIs. UI-only changes belong in the individual UI layer instead.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { X, Download, AlertCircle, FolderOpen, Film, Bookmark, Sparkles, Layers } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { useShallow } from 'zustand/react/shallow';
import { useExportEngine, RESOLUTION_PRESETS, Resolution } from '@/export/useExportEngine';
import { ExportPhase } from '@/export/types';
import { recommendedVideoBitrate } from '@/export/quality';
import { formatCentisecondTime } from '@/timeline/timelineUtils';

const RUNTIME_URL = 'http://127.0.0.1:12589';

function generateFilename(projectName: string): string {
  const safeName = (projectName || 'Untitled_Project').replace(/[<>:"/\\|?*]+/g, '_').trim();
  const now = new Date();
  const date = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const time = `${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
  return `${safeName}_${date}_${time}`;
}

export function ExportModal() {
  const { showExportModal, setShowExportModal, aspectRatio, projectName, exportRegions, selectedExportRegionId, totalDuration } = useEditorStore(
    useShallow(s => ({
      showExportModal: s.showExportModal,
      setShowExportModal: s.setShowExportModal,
      aspectRatio: s.aspectRatio,
      projectName: s.projectName,
      exportRegions: s.exportRegions || [],
      selectedExportRegionId: s.selectedExportRegionId,
      totalDuration: s.totalDuration,
    }))
  );

  const initialResolution = useMemo(() => {
    if (aspectRatio === '9:16') return RESOLUTION_PRESETS['9:16_1080'];
    if (aspectRatio === '1:1') return RESOLUTION_PRESETS['1:1_1080'];
    return RESOLUTION_PRESETS['16:9_1080'];
  }, [aspectRatio]);

  const [selectedResolution, setSelectedResolution] = useState<Resolution>(initialResolution);
  const [quality, setQuality] = useState<'low' | 'medium' | 'high' | 'ultra'>('high');
  const [format, setFormat] = useState<'mp4' | 'webm' | 'gif' | 'prores' | 'wav'>('mp4');
  const [fps, setFps] = useState<number>(30);
  const [transparentBackground, setTransparentBackground] = useState<boolean>(true);
  const [filename, setFilename] = useState('');
  const [outputFolder, setOutputFolder] = useState(() => localStorage.getItem('exportOutputFolder') || '');
  const [isBrowsing, setIsBrowsing] = useState(false);
  const [exportScope, setExportScope] = useState<string>('full');
  const [batchStatus, setBatchStatus] = useState<{ current: number; total: number; name: string } | null>(null);

  // Auto-generate filename and default export scope when modal opens
  useEffect(() => {
    if (showExportModal) {
      setSelectedResolution(initialResolution);
      setFilename(generateFilename(projectName));
      // Refresh saved folder
      const savedFolder = localStorage.getItem('exportOutputFolder');
      if (savedFolder) setOutputFolder(savedFolder);

      // Default scope: selected region if any, else first region, else full
      if (selectedExportRegionId && exportRegions.some(r => r.id === selectedExportRegionId)) {
        setExportScope(selectedExportRegionId);
      } else if (exportRegions.length > 0) {
        setExportScope(exportRegions[0].id);
      } else {
        setExportScope('full');
      }
      setBatchStatus(null);
    }
  }, [showExportModal, initialResolution, projectName, selectedExportRegionId, exportRegions]);

  const { exportState, startExport, cancelExport, downloadFile } = useExportEngine();

  const handleBrowseFolder = useCallback(async () => {
    setIsBrowsing(true);
    try {
      const resp = await fetch(`${RUNTIME_URL}/pick-folder`, { signal: AbortSignal.timeout(60000) });
      const data = await resp.json();
      if (data.path) {
        setOutputFolder(data.path);
        localStorage.setItem('exportOutputFolder', data.path);
      }
    } catch (e) {
      console.warn('Folder picker unavailable (runtime not running?):', e);
    } finally {
      setIsBrowsing(false);
    }
  }, []);

  const handleExport = useCallback(async () => {
    const baseFilename = filename.trim() || generateFilename(projectName);

    const PICKER_TYPES: Record<string, { description: string; accept: Record<string, string[]>; ext: string }> = {
      mp4:    { description: 'MP4 Video',     accept: { 'video/mp4': ['.mp4'] },        ext: 'mp4' },
      webm:   { description: 'WebM Video',    accept: { 'video/webm': ['.webm'] },      ext: 'webm' },
      gif:    { description: 'Animated GIF',  accept: { 'image/gif': ['.gif'] },        ext: 'gif' },
      wav:    { description: 'WAV Audio',     accept: { 'audio/wav': ['.wav'] },        ext: 'wav' },
      prores: { description: 'MP4 Video',     accept: { 'video/mp4': ['.mp4'] },        ext: 'mp4' },
    };
    const pickerCfg = PICKER_TYPES[format] || PICKER_TYPES.mp4;

    // Batch Export All Marked Regions
    if (exportScope === 'batch' && exportRegions.length > 0) {
      for (let i = 0; i < exportRegions.length; i++) {
        const region = exportRegions[i];
        const clipName = `${baseFilename}_${(region.name || `clip_${i + 1}`).replace(/\s+/g, '_')}`;
        setBatchStatus({ current: i + 1, total: exportRegions.length, name: region.name || `Region ${i + 1}` });

        let fileHandle: FileSystemFileHandle | null = null;
        if (typeof window !== 'undefined' && 'showSaveFilePicker' in window && i === 0) {
          try {
            fileHandle = await (window as any).showSaveFilePicker({
              suggestedName: `${clipName}.${pickerCfg.ext}`,
              types: [pickerCfg],
            });
          } catch (err: any) {
            if (err.name === 'AbortError') return;
          }
        }

        try {
          await startExport({
            fps,
            width: selectedResolution.width,
            height: selectedResolution.height,
            bitrate: recommendedVideoBitrate(selectedResolution.width, selectedResolution.height, fps, quality),
            quality,
            format,
            filename: clipName,
            outputFolder: outputFolder || '',
            aspectRatio,
            startAt: region.startTime,
            endAt: region.endTime,
            transparentBackground: (format === 'webm' || format === 'prores' || format === 'gif') ? transparentBackground : false,
          }, fileHandle);
        } catch (batchErr) {
          console.error('[ExportModal] Batch region export failed:', batchErr);
        }
      }
      setBatchStatus(null);
      return;
    }

    // Specific Region Export
    const activeRegion = exportRegions.find(r => r.id === exportScope);
    const startAt = activeRegion ? activeRegion.startTime : 0;
    const endAt = activeRegion ? activeRegion.endTime : (totalDuration || 10);
    const exportFilename = activeRegion
      ? `${baseFilename}_${(activeRegion.name || 'region').replace(/\s+/g, '_')}`
      : baseFilename;

    let fileHandle: FileSystemFileHandle | null = null;
    if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
      try {
        fileHandle = await (window as any).showSaveFilePicker({
          suggestedName: `${exportFilename}.${pickerCfg.ext}`,
          types: [pickerCfg],
        });
      } catch (err: any) {
        if (err.name === 'AbortError') return;
      }
    }

    try {
      await startExport({
        fps,
        width: selectedResolution.width,
        height: selectedResolution.height,
        bitrate: recommendedVideoBitrate(selectedResolution.width, selectedResolution.height, fps, quality),
        quality,
        format,
        filename: exportFilename,
        outputFolder: outputFolder || '',
        aspectRatio,
        startAt,
        endAt,
        transparentBackground: (format === 'webm' || format === 'prores' || format === 'gif') ? transparentBackground : false,
      }, fileHandle);
    } catch (exportErr: any) {
      console.error('[ExportModal] Export failed:', exportErr);
    }
  }, [startExport, selectedResolution, format, fps, quality, filename, outputFolder, projectName, aspectRatio, exportScope, exportRegions, totalDuration, transparentBackground]);

  if (!showExportModal) return null;

  const isWorking = exportState.phase !== 'idle' && exportState.phase !== 'completed' && exportState.phase !== 'cancelled' && exportState.phase !== 'error';
  const canEdit = exportState.phase === 'idle' || exportState.phase === 'completed';

  const getPhaseLabel = (phase: ExportPhase): string => {
    const labels: Record<ExportPhase, string> = {
      idle: 'Ready',
      analyzing: 'Analyzing timeline...',
      preparing: 'Preparing assets...',
      capturing: 'Capturing frames...',
      rendering: 'Rendering frames...',
      encoding: 'Encoding video...',
      muxing: 'Combining audio & video...',
      finalizing: 'Finalizing...',
      completed: 'Export complete!',
      complete: 'Export complete!',
      cancelled: 'Cancelled',
      error: 'Error occurred',
    };
    return labels[phase] || 'Unknown';
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Truncate long folder paths for display
  const displayFolder = outputFolder
    ? (outputFolder.length > 40 ? '...' + outputFolder.slice(-37) : outputFolder)
    : 'Desktop (default)';

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
      <div className="bg-[#2d2d2d] rounded-lg shadow-2xl w-full max-w-lg overflow-hidden border border-[#3e3e3e]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#3e3e3e]">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-amber-400" />
            <h2 className="text-sm font-semibold text-white">Export Video</h2>
          </div>
          <button
            onClick={() => exportState.phase === 'rendering' ? cancelExport() : setShowExportModal(false)}
            className="p-1 text-[#a0a0a0] hover:text-white rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {/* Filename Input */}
          <div>
            <label className="text-xs text-[#a0a0a0] block mb-1.5">Filename</label>
            <div className="flex gap-2 items-center">
              <Film className="w-4 h-4 text-[#606060] shrink-0" />
              <input
                type="text"
                disabled={!canEdit}
                value={filename}
                onChange={e => setFilename(e.target.value)}
                placeholder="Enter filename..."
                className="flex-1 bg-[#252525] text-white text-xs border border-[#3e3e3e] rounded px-3 py-2 focus:outline-none focus:border-amber-500 disabled:opacity-40 placeholder-[#606060]"
              />
              <span className="text-xs text-[#606060] shrink-0">.{format}</span>
            </div>
          </div>

          {/* Output Folder */}
          <div>
            <label className="text-xs text-[#a0a0a0] block mb-1.5">Save to</label>
            <div className="flex gap-2 items-center">
              <div 
                className="flex-1 bg-[#252525] text-xs border border-[#3e3e3e] rounded px-3 py-2 overflow-hidden text-ellipsis whitespace-nowrap"
                title={outputFolder || 'Desktop (default)'}
              >
                <span className={outputFolder ? 'text-white' : 'text-[#606060]'}>{displayFolder}</span>
              </div>
              <button
                disabled={!canEdit || isBrowsing}
                onClick={handleBrowseFolder}
                className="shrink-0 px-3 py-2 bg-[#353535] hover:bg-[#404040] text-[#a0a0a0] hover:text-white text-xs border border-[#3e3e3e] rounded transition-colors disabled:opacity-40 flex items-center gap-1.5"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                {isBrowsing ? 'Picking...' : 'Browse'}
              </button>
            </div>
          </div>

          {/* Export Range / Scope Selector */}
          {exportRegions.length > 0 && (
            <div className="bg-[#232323] p-2.5 rounded-lg border border-[#3a3a3a]">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <Bookmark className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Export Scope</span>
                </label>
                <span className="text-[10px] text-emerald-400 font-medium bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                  {exportRegions.length} Mark{exportRegions.length > 1 ? 's' : ''} Set
                </span>
              </div>

              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-0.5">
                {/* Full Timeline Option */}
                <button
                  type="button"
                  disabled={!canEdit}
                  onClick={() => setExportScope('full')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs border transition-all text-left ${
                    exportScope === 'full'
                      ? 'bg-blue-600/20 border-blue-500 text-white font-medium shadow-sm ring-1 ring-blue-500/40'
                      : 'bg-[#2a2a2a] border-[#383838] text-[#a0a0a0] hover:text-white hover:border-[#555]'
                  }`}
                >
                  <span className="flex items-center gap-2 truncate">
                    <Film className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span className="truncate">Full Timeline</span>
                  </span>
                  <span className="font-mono text-[10px] text-[#888] shrink-0 ml-2">
                    {formatTime(totalDuration || 0)}
                  </span>
                </button>

                {/* Individual Export Regions */}
                {exportRegions.map((region, idx) => (
                  <button
                    key={region.id}
                    type="button"
                    disabled={!canEdit}
                    onClick={() => setExportScope(region.id)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs border transition-all text-left ${
                      exportScope === region.id
                        ? 'bg-emerald-600/20 border-emerald-500 text-white font-medium shadow-sm ring-1 ring-emerald-500/40'
                        : 'bg-[#2a2a2a] border-[#383838] text-[#a0a0a0] hover:text-white hover:border-[#555]'
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      <span
                        className="w-2 h-2 rounded-full shrink-0 shadow-sm"
                        style={{ backgroundColor: region.color || '#10b981' }}
                      />
                      <span className="truncate">{region.name || `Mark ${idx + 1}`}</span>
                      <span className="text-[10px] text-[#777] font-mono shrink-0">
                        ({formatCentisecondTime(region.startTime)} - {formatCentisecondTime(region.endTime)})
                      </span>
                    </span>
                    <span className="font-mono text-[10px] text-emerald-400 font-semibold shrink-0 ml-2">
                      {formatTime(region.endTime - region.startTime)}
                    </span>
                  </button>
                ))}

                {/* Batch Export All Option (if > 1 mark) */}
                {exportRegions.length > 1 && (
                  <button
                    type="button"
                    disabled={!canEdit}
                    onClick={() => setExportScope('batch')}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs border transition-all text-left ${
                      exportScope === 'batch'
                        ? 'bg-amber-600/20 border-amber-500 text-white font-semibold shadow-sm ring-1 ring-amber-500/40'
                        : 'bg-[#2a2a2a] border-[#383838] text-[#a0a0a0] hover:text-white hover:border-[#555]'
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="text-amber-300">Batch Export All ({exportRegions.length} Clips)</span>
                    </span>
                    <span className="text-[10px] text-amber-400/80 font-mono shrink-0 ml-2">
                      Multiple files
                    </span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Resolution Selector */}
          <div>
            <label className="text-xs text-[#a0a0a0] block mb-1.5">Resolution</label>
            <select
              disabled={!canEdit}
              value={selectedResolution.name}
              onChange={(e) => {
                const preset = Object.values(RESOLUTION_PRESETS).find(r => r.name === e.target.value);
                if (preset) setSelectedResolution(preset);
              }}
              className="w-full bg-[#252525] text-white text-xs border border-[#3e3e3e] rounded px-3 py-2 focus:outline-none focus:border-amber-500 cursor-pointer disabled:opacity-40"
            >
              {Object.values(RESOLUTION_PRESETS).map(res => (
                <option key={res.name} value={res.name}>
                  {res.name} ({res.width}x{res.height})
                </option>
              ))}
            </select>
          </div>

          {/* Quality / compression selector */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-[#a0a0a0]">Quality &amp; file size</label>
              <span className="text-[10px] text-[#707070]">
                ~{(recommendedVideoBitrate(selectedResolution.width, selectedResolution.height, fps, quality) / 1_000_000).toFixed(1)} Mbps
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {(['low', 'medium', 'high', 'ultra'] as const).map((level) => (
                <button
                  key={level}
                  disabled={!canEdit}
                  onClick={() => setQuality(level)}
                  className={`px-2 py-1.5 rounded text-[11px] capitalize border transition-colors ${
                    quality === level
                      ? 'bg-amber-600/20 border-amber-500 text-amber-400'
                      : 'bg-[#252525] border-[#3e3e3e] text-[#a0a0a0] hover:text-white disabled:opacity-40'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[10px] text-[#666]">High is recommended for YouTube: sharp H.264 with a smaller upload.</p>
          </div>

          {/* FPS & Format Row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#a0a0a0] block mb-1.5">Frame Rate</label>
              <div className="flex gap-1.5">
                {[24, 30, 60].map((f) => (
                  <button
                    key={f}
                    disabled={!canEdit}
                    onClick={() => setFps(f)}
                    className={`flex-1 px-2 py-1.5 rounded text-xs border transition-colors ${
                      fps === f
                        ? 'bg-amber-600/20 border-amber-500 text-amber-400'
                        : 'bg-[#252525] border-[#3e3e3e] text-[#a0a0a0] hover:text-white hover:border-[#a0a0a0] disabled:opacity-40'
                    }`}
                  >
                    {f}fps
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-[#a0a0a0] block mb-1.5">Format</label>
              <select 
                disabled={!canEdit}
                value={format} 
                onChange={(e) => setFormat(e.target.value as any)}
                className="w-full bg-[#252525] text-white text-xs border border-[#3e3e3e] rounded px-3 py-[7px] focus:outline-none focus:border-amber-500 cursor-pointer disabled:opacity-40"
              >
                <option value="mp4">MP4 (H.264)</option>
                <option value="webm">WebM (VP9)</option>
                <option value="prores">Apple ProRes (MOV)</option>
                <option value="gif">Animated GIF</option>
                <option value="wav">WAV Audio</option>
              </select>
            </div>
          </div>

          {/* Transparent Alpha Channel Option (WebM / ProRes / GIF) */}
          {(format === 'webm' || format === 'prores' || format === 'gif') && (
            <div className="bg-[#232323] p-2.5 rounded-lg border border-[#3a3a3a] flex items-center justify-between transition-all">
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded flex items-center justify-center bg-emerald-500/10 text-emerald-400">
                  <Layers className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                    <span>Transparent Background</span>
                    <span className="text-[10px] text-emerald-400 font-medium bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                      Alpha Channel
                    </span>
                  </div>
                  <p className="text-[10px] text-[#888] mt-0.5">
                    Preserves transparent cutouts &amp; masks without solid black background.
                  </p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={transparentBackground}
                disabled={!canEdit}
                onClick={() => setTransparentBackground(v => !v)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  transparentBackground ? 'bg-emerald-500' : 'bg-[#404040]'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    transparentBackground ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          )}

          <div className="flex items-center gap-1.5 text-[10px] text-[#707070]">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500/80" />
            Hybrid decoding: HEVC/H.265 uses hardware; H.264, VP8 and VP9 use software
          </div>

          {/* Progress Display */}
          {isWorking && (
            <div className="bg-[#252525] rounded p-4 border border-[#3e3e3e] space-y-3">
              {batchStatus && (
                <div className="flex items-center justify-between px-2.5 py-1 bg-amber-500/10 border border-amber-500/25 rounded text-amber-300 text-[11px] font-semibold">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3" />
                    <span>Batch Exporting: Clip {batchStatus.current} of {batchStatus.total}</span>
                  </span>
                  <span className="text-[10px] text-amber-400 font-mono">({batchStatus.name})</span>
                </div>
              )}
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-amber-400">{getPhaseLabel(exportState.phase)}</span>
                <span className="text-xs font-bold text-white">{exportState.progress.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-[#1a1a1a] rounded-full h-2.5 overflow-hidden relative">
                <div 
                  className="bg-amber-500 h-2.5 rounded-full transition-all duration-500 ease-out" 
                  style={{ width: `${Math.max(exportState.progress, exportState.phase === 'preparing' ? 5 : exportState.phase === 'analyzing' ? 2 : 0)}%` }}
                />
                {(exportState.phase === 'rendering' || exportState.phase === 'encoding' || exportState.phase === 'muxing') && (
                  <div 
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%)',
                      backgroundSize: '200% 100%',
                      animation: 'shimmer 1.5s infinite',
                      clipPath: `inset(0 ${100 - exportState.progress}% 0 0 round 9999px)`
                    }}
                  />
                )}
              </div>
              <div className="flex justify-between text-[10px] text-[#a0a0a0]">
                {exportState.phase === 'rendering' ? (
                  <span>Frame {exportState.currentFrame} / {exportState.totalFrames}</span>
                ) : (
                  <span className="capitalize">{exportState.phase}...</span>
                )}
                {exportState.estimatedTimeRemaining > 0 && (
                  <span>ETA: {formatTime(exportState.estimatedTimeRemaining)}</span>
                )}
              </div>
            </div>
          )}
          
          {exportState.phase === 'error' && (
            <div className="bg-red-900/30 border border-red-500/40 rounded p-3 flex items-start gap-2">
               <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
               <div>
                 <p className="text-xs text-red-200 font-semibold mb-1">Export Failed</p>
                 {exportState.warnings.map((w, i) => (
                   <p key={i} className="text-[10px] text-red-300">{w}</p>
                 ))}
               </div>
            </div>
          )}

          {exportState.phase !== 'error' && exportState.warnings.length > 0 && (
            <div className="bg-yellow-900/30 border border-yellow-500/40 rounded p-3 flex items-start gap-2">
               <AlertCircle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
               <div>
                 <p className="text-xs text-yellow-200 font-semibold mb-1">Export Warnings</p>
                 {exportState.warnings.map((w, i) => (
                   <p key={i} className="text-[10px] text-yellow-300">{w}</p>
                 ))}
               </div>
            </div>
          )}

        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-[#3e3e3e] bg-[#252525]/50">
          {exportState.phase === 'completed' ? (
            <>
              {exportState.savedViaRuntime && (
                <span className="text-xs text-green-400 mr-auto flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-400 inline-block"></span>
                  Saved to {outputFolder ? outputFolder.split(/[/\\]/).pop() : 'Desktop'}!
                </span>
              )}
              <button onClick={() => setShowExportModal(false)} className="px-4 py-2 text-xs text-[#a0a0a0] hover:text-white transition-colors">
                Close
              </button>
              {!exportState.savedViaRuntime && (
                <button onClick={downloadFile} className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-xs rounded font-medium transition-colors">
                  ⬇ Download ({formatFileSize(exportState.fileSize)})
                </button>
              )}
            </>
          ) : isWorking ? (
            <>
              <button onClick={cancelExport} className="px-4 py-2 text-xs text-red-400 hover:text-red-300 transition-colors">
                Cancel
              </button>
              <button disabled className="px-4 py-2 bg-amber-600/50 text-white text-xs rounded font-medium cursor-not-allowed">
                Exporting...
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setShowExportModal(false)} className="px-4 py-2 text-xs text-[#a0a0a0] hover:text-white transition-colors">
                Cancel
              </button>
              <button onClick={handleExport} className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs rounded font-medium transition-colors">
                Start Export
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
