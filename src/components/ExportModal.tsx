import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { X, Download, AlertCircle, FolderOpen, Film, Eye, Sparkles } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { useShallow } from 'zustand/react/shallow';
import { useExportEngine, RESOLUTION_PRESETS, Resolution } from '@/export/useExportEngine';
import { ExportPhase } from '@/export/types';

const RUNTIME_URL = 'http://127.0.0.1:12589';

function generateFilename(projectName: string): string {
  const safeName = (projectName || 'Untitled_Project').replace(/[<>:"/\\|?*]+/g, '_').trim();
  const now = new Date();
  const date = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const time = `${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
  return `${safeName}_${date}_${time}`;
}

function LiveExportPreview({
  sourceCanvas,
  aspectRatio,
}: {
  sourceCanvas: HTMLCanvasElement | null;
  aspectRatio: string;
}) {
  const displayCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!sourceCanvas || !displayCanvasRef.current) return;
    const ctx = displayCanvasRef.current.getContext('2d');
    if (!ctx) return;
    const disp = displayCanvasRef.current;
    ctx.clearRect(0, 0, disp.width, disp.height);
    ctx.drawImage(sourceCanvas, 0, 0, disp.width, disp.height);
  }, [sourceCanvas]);

  const aspectClass =
    aspectRatio === '9:16'
      ? 'w-[120px] h-[213px]'
      : aspectRatio === '1:1'
        ? 'w-[160px] h-[160px]'
        : 'w-[240px] h-[135px]';

  return (
    <div className="flex flex-col items-center justify-center p-3 bg-[#1e1e1e] rounded-lg border border-[#3e3e3e]">
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-amber-400 mb-2">
        <Eye className="w-3.5 h-3.5" />
        <span>Live Export Preview</span>
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse ml-1" />
      </div>
      <div className={`relative bg-black rounded overflow-hidden shadow-2xl border border-[#333] flex items-center justify-center ${aspectClass}`}>
        <canvas
          ref={displayCanvasRef}
          width={sourceCanvas ? sourceCanvas.width : 640}
          height={sourceCanvas ? sourceCanvas.height : 360}
          className="w-full h-full object-contain"
        />
        {!sourceCanvas && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-[#606060]">
            Rendering frame...
          </div>
        )}
      </div>
    </div>
  );
}

export function ExportModal() {
  const { showExportModal, setShowExportModal, aspectRatio, projectName } = useEditorStore(
    useShallow(s => ({
      showExportModal: s.showExportModal,
      setShowExportModal: s.setShowExportModal,
      aspectRatio: s.aspectRatio,
      projectName: s.projectName,
    }))
  );

  const initialResolution = useMemo(() => {
    if (aspectRatio === '9:16') return RESOLUTION_PRESETS['9:16_1080'];
    if (aspectRatio === '1:1') return RESOLUTION_PRESETS['1:1_1080'];
    return RESOLUTION_PRESETS['16:9_1080'];
  }, [aspectRatio]);

  const [selectedResolution, setSelectedResolution] = useState<Resolution>(initialResolution);
  const [format, setFormat] = useState<'mp4' | 'webm' | 'gif' | 'prores' | 'wav'>('mp4');
  const [fps, setFps] = useState<number>(30);
  const [filename, setFilename] = useState('');
  const [outputFolder, setOutputFolder] = useState(() => localStorage.getItem('exportOutputFolder') || '');
  const [isBrowsing, setIsBrowsing] = useState(false);

  // Auto-generate filename when modal opens
  useEffect(() => {
    if (showExportModal) {
      setSelectedResolution(initialResolution);
      setFilename(generateFilename(projectName));
      const savedFolder = localStorage.getItem('exportOutputFolder');
      if (savedFolder) setOutputFolder(savedFolder);
    }
  }, [showExportModal, initialResolution, projectName]);

  const { exportState, previewCanvas, startExport, cancelExport, downloadFile } = useExportEngine();

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
      console.warn('Folder picker unavailable:', e);
    } finally {
      setIsBrowsing(false);
    }
  }, []);

  const handleExport = useCallback(async () => {
    const exportFilename = filename.trim() || generateFilename(projectName);

    const PICKER_TYPES: Record<string, { description: string; accept: Record<string, string[]>; ext: string }> = {
      mp4:    { description: 'MP4 Video',     accept: { 'video/mp4': ['.mp4'] },        ext: 'mp4' },
      webm:   { description: 'WebM Video',    accept: { 'video/webm': ['.webm'] },      ext: 'webm' },
      gif:    { description: 'Animated GIF',  accept: { 'image/gif': ['.gif'] },        ext: 'gif' },
      wav:    { description: 'WAV Audio',     accept: { 'audio/wav': ['.wav'] },        ext: 'wav' },
      prores: { description: 'MP4 Video',     accept: { 'video/mp4': ['.mp4'] },        ext: 'mp4' },
    };
    const pickerCfg = PICKER_TYPES[format] || PICKER_TYPES.mp4;

    let fileHandle: FileSystemFileHandle | null = null;
    if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
      try {
        fileHandle = await (window as any).showSaveFilePicker({
          suggestedName: `${exportFilename}.${pickerCfg.ext}`,
          types: [pickerCfg]
        });
      } catch (err: any) {
        if (err.name === 'AbortError') return;
      }
    }

    await startExport({
      fps,
      width: selectedResolution.width,
      height: selectedResolution.height,
      bitrate: selectedResolution.maxBitrate,
      format,
      filename: exportFilename,
      outputFolder: outputFolder || '',
      aspectRatio,
    }, fileHandle);
  }, [startExport, selectedResolution, format, fps, filename, outputFolder, projectName, aspectRatio]);

  if (!showExportModal) return null;

  const isWorking = exportState.phase !== 'idle' && exportState.phase !== 'completed' && exportState.phase !== 'cancelled' && exportState.phase !== 'error';
  const canEdit = exportState.phase === 'idle' || exportState.phase === 'completed';

  const getPhaseLabel = (phase: ExportPhase): string => {
    const labels: Record<ExportPhase, string> = {
      idle: 'Ready',
      analyzing: 'Analyzing timeline...',
      preparing: 'Preparing assets & decoder...',
      capturing: 'Rendering frames...',
      rendering: 'Rendering frames (WYSIWYG)...',
      encoding: 'Encoding video...',
      muxing: 'Mixing audio & muxing...',
      finalizing: 'Finalizing MP4...',
      completed: 'Export complete!',
      complete: 'Export complete!',
      cancelled: 'Cancelled',
      error: 'Error occurred',
    };
    return labels[phase] || 'Processing...';
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
            <h2 className="text-sm font-semibold text-white">Export Video (WYSIWYG)</h2>
          </div>
          <button
            onClick={() => isWorking ? cancelExport() : setShowExportModal(false)}
            className="p-1 text-[#a0a0a0] hover:text-white rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {/* Live Preview Window during Export */}
          {isWorking && (
            <LiveExportPreview
              sourceCanvas={previewCanvas}
              aspectRatio={aspectRatio}
            />
          )}

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

          {/* Progress Display */}
          {isWorking && (
            <div className="bg-[#252525] rounded p-4 border border-[#3e3e3e] space-y-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-amber-400">{getPhaseLabel(exportState.phase)}</span>
                <span className="text-xs font-bold text-white">{exportState.progress.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-[#1a1a1a] rounded-full h-2.5 overflow-hidden relative">
                <div 
                  className="bg-amber-500 h-2.5 rounded-full transition-all duration-300 ease-out" 
                  style={{ width: `${Math.max(exportState.progress, 2)}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-[#a0a0a0]">
                {exportState.totalFrames > 0 && (
                  <span>Frame {exportState.currentFrame} / {exportState.totalFrames}</span>
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
              <button onClick={downloadFile} className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-xs rounded font-medium transition-colors">
                ⬇ Download ({formatFileSize(exportState.fileSize)})
              </button>
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
              <button onClick={handleExport} className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs rounded font-medium transition-colors flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Start Export
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
