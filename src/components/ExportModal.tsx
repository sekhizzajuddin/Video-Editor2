import React, { useState, useCallback, useMemo } from 'react';
import { X, Download, AlertCircle } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { useShallow } from 'zustand/react/shallow';
import { useExportEngine, RESOLUTION_PRESETS, Resolution } from '@/export/useExportEngine';
import { ExportPhase } from '@/export/types';

export function ExportModal() {
  const { showExportModal, setShowExportModal } = useEditorStore(
    useShallow(s => ({
      showExportModal: s.showExportModal,
      setShowExportModal: s.setShowExportModal,
    }))
  );

  const [selectedResolution, setSelectedResolution] = useState<Resolution>(RESOLUTION_PRESETS['16:9_1080']);
  const [quality, setQuality] = useState<'low' | 'medium' | 'high' | 'ultra'>('high');
  const [format, setFormat] = useState<'mp4' | 'webm'>('mp4');
  const [fps, setFps] = useState<number>(30);

  const { exportState, startExport, cancelExport, downloadFile } = useExportEngine();

  const handleExport = useCallback(async () => {
    await startExport({
      fps,
      width: selectedResolution.width,
      height: selectedResolution.height,
      bitrate: selectedResolution.maxBitrate,
      format,
      filename: `export_${Date.now()}`,
    });
  }, [startExport, selectedResolution, format, fps]);

  if (!showExportModal) return null;

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

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
      <div className="bg-[#2d2d2d] rounded-lg shadow-2xl w-full max-w-lg overflow-hidden border border-[#3e3e3e]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#3e3e3e]">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-amber-400" />
            <h2 className="text-sm font-semibold text-white">Export Video (v2.0 Beta)</h2>
          </div>
          <button
            onClick={() => exportState.phase === 'rendering' ? cancelExport() : setShowExportModal(false)}
            className="p-1 text-[#a0a0a0] hover:text-white rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Resolution Selector */}
          <div>
            <label className="text-xs text-[#a0a0a0] block mb-2">Resolution</label>
            <select
              disabled={exportState.phase !== 'idle' && exportState.phase !== 'completed'}
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

          {/* FPS Selector */}
          <div>
            <label className="text-xs text-[#a0a0a0] block mb-2">Frame Rate</label>
            <div className="flex gap-2">
              {[24, 30, 60].map((f) => (
                <button
                  key={f}
                  disabled={exportState.phase !== 'idle' && exportState.phase !== 'completed'}
                  onClick={() => setFps(f)}
                  className={`flex-1 px-4 py-2 rounded text-xs border transition-colors ${
                    fps === f
                      ? 'bg-amber-600/20 border-amber-500 text-amber-400'
                      : 'bg-[#252525] border-[#3e3e3e] text-[#a0a0a0] hover:text-white hover:border-[#a0a0a0] disabled:opacity-40'
                  }`}
                >
                  {f} fps
                </button>
              ))}
            </div>
          </div>

          {/* Quality Selector */}
          <div>
            <label className="text-xs text-[#a0a0a0] block mb-2">Quality</label>
            <div className="flex gap-2">
              {(['low', 'medium', 'high', 'ultra'] as const).map(q => (
                <button
                  key={q}
                  disabled={exportState.phase !== 'idle' && exportState.phase !== 'completed'}
                  onClick={() => setQuality(q)}
                  className={`flex-1 px-3 py-2 rounded text-xs border transition-colors capitalize ${
                    quality === q
                      ? 'bg-amber-600/20 border-amber-500 text-amber-400'
                      : 'bg-[#252525] border-[#3e3e3e] text-[#a0a0a0] hover:text-white hover:border-[#a0a0a0] disabled:opacity-40'
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Format Selector */}
          <div>
            <label className="text-xs text-[#a0a0a0] block mb-2">Format</label>
            <select 
              disabled={exportState.phase !== 'idle' && exportState.phase !== 'completed'}
              value={format} 
              onChange={(e) => setFormat(e.target.value as any)}
              className="w-full bg-[#252525] text-white text-xs border border-[#3e3e3e] rounded px-3 py-2 focus:outline-none focus:border-amber-500 cursor-pointer disabled:opacity-40"
            >
              <option value="mp4">MP4 (H.264)</option>
              <option value="webm">WebM (VP9)</option>
            </select>
          </div>

          {/* Progress Display */}
          {exportState.phase !== 'idle' && exportState.phase !== 'completed' && exportState.phase !== 'cancelled' && exportState.phase !== 'error' && (
            <div className="bg-[#252525] rounded p-4 border border-[#3e3e3e] space-y-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-amber-400">{getPhaseLabel(exportState.phase)}</span>
                <span className="text-xs font-bold text-white">{exportState.progress.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-[#1a1a1a] rounded-full h-2.5 overflow-hidden">
                <div 
                  className="bg-amber-500 h-2.5 rounded-full transition-all duration-300" 
                  style={{ width: `${exportState.progress}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-[#a0a0a0]">
                <span>Frame {exportState.currentFrame} / {exportState.totalFrames}</span>
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

        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-[#3e3e3e] bg-[#252525]/50">
          {exportState.phase === 'completed' ? (
            <>
              <button onClick={() => setShowExportModal(false)} className="px-4 py-2 text-xs text-[#a0a0a0] hover:text-white transition-colors">
                Close
              </button>
              <button onClick={downloadFile} className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-xs rounded font-medium transition-colors">
                ⬇ Download ({formatFileSize(exportState.fileSize)})
              </button>
            </>
          ) : exportState.phase === 'rendering' || exportState.phase === 'muxing' ? (
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
