/**
 * PlaybackDiagnosticsModal.tsx
 *
 * Professional studio-grade Playback Health & Diagnostics Inspector.
 * Allows users and developers to:
 *   - Inspect real-time timeline, decoders, and canvas engine status when playback stutters
 *   - Review automated root-cause analysis (pinpointing conflicting clips, stalled decoders, or heavy shaders)
 *   - Download full diagnostic .json log files
 *   - Copy diagnostic summaries directly to clipboard
 *   - Capture live snapshots on-demand
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  Bug,
  Download,
  Copy,
  Check,
  Trash2,
  Camera,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Layers,
  Cpu,
  Monitor,
  Film,
  RefreshCw,
} from 'lucide-react';
import { playbackDiagnostics, PlaybackIncident } from '@/utils/playbackDiagnostics';
import { useEditorStore } from '@/store/editorStore';
import { getCurrentPerfState } from '@/utils/performanceMonitor';

interface PlaybackDiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PlaybackDiagnosticsModal({ isOpen, onClose }: PlaybackDiagnosticsModalProps) {
  const [incidents, setIncidents] = useState<PlaybackIncident[]>([]);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'decoders' | 'system' | 'events'>('overview');
  const [copied, setCopied] = useState(false);
  const [liveRefreshTick, setLiveRefreshTick] = useState(0);

  const isBuffering = useEditorStore((s) => s.isBuffering);
  const isPlaying = useEditorStore((s) => s.isPlaying);
  const currentTime = useEditorStore((s) => s.currentTime);
  const perfState = getCurrentPerfState();

  useEffect(() => {
    if (!isOpen) return;

    const refresh = () => {
      const list = playbackDiagnostics.getIncidents();
      setIncidents(list);
      if (list.length > 0 && !selectedIncidentId) {
        setSelectedIncidentId(list[0].id);
      }
    };
    refresh();

    const unsub = playbackDiagnostics.subscribe(() => {
      refresh();
    });

    const interval = setInterval(() => {
      setLiveRefreshTick((t) => t + 1);
    }, 1000);

    return () => {
      unsub();
      clearInterval(interval);
    };
  }, [isOpen, selectedIncidentId]);

  if (!isOpen) return null;

  const currentIncident = incidents.find((i) => i.id === selectedIncidentId) || incidents[0] || null;

  const handleDownload = () => {
    playbackDiagnostics.downloadLog(currentIncident?.id);
  };

  const handleCopy = async () => {
    const success = await playbackDiagnostics.copyToClipboard(currentIncident?.id);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCaptureSnapshot = () => {
    const snapshot = playbackDiagnostics.recordIncident(
      'MANUAL_SNAPSHOT',
      `Manual snapshot captured by user at ${currentTime.toFixed(2)}s`
    );
    if (snapshot) {
      setIncidents(playbackDiagnostics.getIncidents());
      setSelectedIncidentId(snapshot.id);
    }
  };

  const handleClear = () => {
    playbackDiagnostics.clearIncidents();
    setIncidents([]);
    setSelectedIncidentId(null);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div
        className="flex flex-col w-full max-w-5xl h-[85vh] max-h-[820px] bg-[#121318] border border-white/10 rounded-2xl shadow-2xl overflow-hidden text-neutral-200 font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Bug className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-white tracking-wide">
                  Playback Diagnostics & Health Inspector
                </h2>
                <span
                  className={`px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider rounded-full border ${
                    isBuffering
                      ? 'bg-rose-500/15 text-rose-400 border-rose-500/30 animate-pulse'
                      : isPlaying
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                  }`}
                >
                  {isBuffering ? 'Buffering' : isPlaying ? 'Playing' : 'Paused'}
                </span>
                <span className="text-xs font-mono text-neutral-400 bg-black/40 px-2 py-0.5 rounded border border-white/5">
                  {perfState.fps} FPS
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                Live flight recorder & timeline decoder monitor. Pinpoints frame drops, seeking stalls, and track conflicts.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCaptureSnapshot}
              title="Capture instantaneous state snapshot"
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-white/10 flex items-center gap-1.5 transition-all shadow-sm"
            >
              <Camera className="w-3.5 h-3.5 text-blue-400" />
              Capture Snapshot
            </button>
            <button
              onClick={handleDownload}
              title="Download diagnostic file as JSON"
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5 transition-all shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              Download Log (.json)
            </button>
            <button
              onClick={handleCopy}
              title="Copy summary to clipboard"
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-white/10 flex items-center gap-1.5 transition-all shadow-sm"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied!' : 'Copy Summary'}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body: Left sidebar (Incidents list) + Right detail area */}
        <div className="flex flex-1 min-h-0">
          {/* Left: Incidents History */}
          <div className="w-72 border-r border-white/10 bg-black/20 flex flex-col min-h-0">
            <div className="p-3 border-b border-white/10 flex items-center justify-between text-xs text-neutral-400">
              <span className="font-semibold uppercase tracking-wider text-[10px]">
                Incidents Logged ({incidents.length})
              </span>
              {incidents.length > 0 && (
                <button
                  onClick={handleClear}
                  title="Clear incident history"
                  className="p-1 text-neutral-400 hover:text-rose-400 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {incidents.length === 0 ? (
                <div className="p-6 text-center text-xs text-neutral-500">
                  <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500/40 mb-2" />
                  <p className="font-medium text-neutral-400">No Incidents Recorded</p>
                  <p className="mt-1 text-[11px]">
                    Playback is smooth. If you experience stutter, click &quot;Capture Snapshot&quot; above.
                  </p>
                </div>
              ) : (
                incidents.map((inc) => {
                  const isSelected = inc.id === currentIncident?.id;
                  const dateStr = new Date(inc.timestamp).toLocaleTimeString();
                  return (
                    <button
                      key={inc.id}
                      onClick={() => setSelectedIncidentId(inc.id)}
                      className={`w-full text-left p-2.5 rounded-xl border transition-all text-xs ${
                        isSelected
                          ? 'bg-blue-600/15 border-blue-500/40 text-white shadow-sm'
                          : 'bg-white/[0.02] border-white/5 text-neutral-400 hover:bg-white/[0.05] hover:text-neutral-200'
                      }`}
                    >
                      <div className="flex items-center justify-between font-mono text-[10px]">
                        <span
                          className={`font-semibold ${
                            inc.severity === 'critical' || inc.severity === 'error'
                              ? 'text-rose-400'
                              : inc.severity === 'warning'
                              ? 'text-amber-400'
                              : 'text-blue-400'
                          }`}
                        >
                          {inc.type}
                        </span>
                        <span className="text-neutral-500">{dateStr}</span>
                      </div>
                      <div className="mt-1 text-[11px] font-medium text-neutral-300 line-clamp-1">
                        {inc.triggerReason}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[10px] text-neutral-400">
                        <span>t={inc.playhead.currentTime.toFixed(2)}s</span>
                        <span>•</span>
                        <span>{inc.playhead.fps} fps</span>
                        <span>•</span>
                        <span>{inc.timeline.activeClips.length} clips</span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right: Detailed Tabs & State View */}
          <div className="flex-1 flex flex-col min-w-0 bg-[#0e0f12]">
            {/* Tab navigation */}
            <div className="flex items-center gap-1 px-6 border-b border-white/10 bg-white/[0.01]">
              <button
                onClick={() => setActiveTab('overview')}
                className={`py-3 px-3 text-xs font-medium border-b-2 transition-all flex items-center gap-1.5 ${
                  activeTab === 'overview'
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                Root Cause & Overview
              </button>
              <button
                onClick={() => setActiveTab('decoders')}
                className={`py-3 px-3 text-xs font-medium border-b-2 transition-all flex items-center gap-1.5 ${
                  activeTab === 'decoders'
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <Film className="w-3.5 h-3.5" />
                Media Decoders ({currentIncident?.decoders.length ?? 0})
              </button>
              <button
                onClick={() => setActiveTab('system')}
                className={`py-3 px-3 text-xs font-medium border-b-2 transition-all flex items-center gap-1.5 ${
                  activeTab === 'system'
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <Cpu className="w-3.5 h-3.5" />
                System & Canvas Engine
              </button>
              <button
                onClick={() => setActiveTab('events')}
                className={`py-3 px-3 text-xs font-medium border-b-2 transition-all flex items-center gap-1.5 ${
                  activeTab === 'events'
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                Flight Recorder
              </button>
            </div>

            {/* Tab Contents */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {currentIncident ? (
                <>
                  {activeTab === 'overview' && (
                    <div className="space-y-6">
                      {/* Suspected Culprit Banner */}
                      <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <h3 className="text-xs font-semibold text-amber-300 uppercase tracking-wider">
                            Suspected Culprit Identified
                          </h3>
                          <p className="text-sm font-medium text-white">
                            {currentIncident.analysis.suspectedCulprit}
                          </p>
                          <ul className="mt-2 space-y-1 text-xs text-amber-200/80 list-disc list-inside">
                            {currentIncident.analysis.diagnosticHints.map((hint, idx) => (
                              <li key={idx}>{hint}</li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {/* Quick Snapshot Metrics */}
                      <div className="grid grid-cols-4 gap-3">
                        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                          <span className="text-[10px] text-neutral-400 uppercase tracking-wider">Playhead Position</span>
                          <div className="text-lg font-mono font-semibold text-white mt-0.5">
                            {currentIncident.playhead.currentTime.toFixed(3)}s
                          </div>
                        </div>
                        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                          <span className="text-[10px] text-neutral-400 uppercase tracking-wider">Frame Rate</span>
                          <div
                            className={`text-lg font-mono font-semibold mt-0.5 ${
                              currentIncident.playhead.fps < 30 ? 'text-rose-400' : 'text-emerald-400'
                            }`}
                          >
                            {currentIncident.playhead.fps} FPS
                          </div>
                        </div>
                        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                          <span className="text-[10px] text-neutral-400 uppercase tracking-wider">Active Timeline Clips</span>
                          <div className="text-lg font-mono font-semibold text-white mt-0.5">
                            {currentIncident.timeline.activeClips.length} clips
                          </div>
                        </div>
                        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                          <span className="text-[10px] text-neutral-400 uppercase tracking-wider">Decoders in Pool</span>
                          <div className="text-lg font-mono font-semibold text-white mt-0.5">
                            {currentIncident.decoders.length} elements
                          </div>
                        </div>
                      </div>

                      {/* Active Clips at Incident */}
                      <div className="space-y-3">
                        <h4 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-blue-400" />
                          Active Timeline Clips at {currentIncident.playhead.currentTime.toFixed(2)}s
                        </h4>
                        {currentIncident.timeline.activeClips.length === 0 ? (
                          <p className="text-xs text-neutral-500 italic">No active clips at this moment.</p>
                        ) : (
                          <div className="space-y-2">
                            {currentIncident.timeline.activeClips.map((clip) => (
                              <div
                                key={clip.id}
                                className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between text-xs"
                              >
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-white">{clip.name}</span>
                                    <span className="text-[10px] font-mono bg-neutral-800 text-neutral-400 px-1.5 py-0.5 rounded">
                                      Track: {clip.trackId} ({clip.trackType})
                                    </span>
                                    {clip.splitGroupId && (
                                      <span className="text-[10px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded">
                                        SplitGroup: {clip.splitGroupId}
                                      </span>
                                    )}
                                  </div>
                                  <div className="mt-1 flex items-center gap-3 text-[11px] text-neutral-400">
                                    <span>Start: {clip.startTime}s</span>
                                    <span>Duration: {clip.duration}s</span>
                                    <span>TrimStart: {clip.trimStart}s</span>
                                    <span>Speed: {clip.speed}x</span>
                                  </div>
                                </div>
                                <div className="flex flex-wrap gap-1 max-w-[40%] justify-end">
                                  {clip.effectsSummary.length === 0 ? (
                                    <span className="text-[10px] text-neutral-500">No effects</span>
                                  ) : (
                                    clip.effectsSummary.map((eff, i) => (
                                      <span
                                        key={i}
                                        className="px-2 py-0.5 text-[10px] font-medium bg-purple-500/10 text-purple-300 border border-purple-500/20 rounded-md"
                                      >
                                        {eff}
                                      </span>
                                    ))
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {activeTab === 'decoders' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                          Media Decoder Elements State
                        </h4>
                        <span className="text-xs text-neutral-400">
                          Total elements: {currentIncident.decoders.length}
                        </span>
                      </div>

                      {currentIncident.decoders.length === 0 ? (
                        <p className="text-xs text-neutral-500">Decoder pool is empty.</p>
                      ) : (
                        <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/[0.01]">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-white/[0.03] text-neutral-400 font-semibold border-b border-white/10 text-[10px] uppercase tracking-wider">
                              <tr>
                                <th className="p-3">Clip ID</th>
                                <th className="p-3">Type</th>
                                <th className="p-3">ReadyState</th>
                                <th className="p-3">Seeking</th>
                                <th className="p-3">CurrentTime</th>
                                <th className="p-3">Rate</th>
                                <th className="p-3">Resolution</th>
                                <th className="p-3">Network</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 font-mono text-[11px]">
                              {currentIncident.decoders.map((d: any) => {
                                const isStalled = d.readyState < 2 || d.seeking;
                                return (
                                  <tr
                                    key={d.clipId}
                                    className={`hover:bg-white/[0.02] ${
                                      isStalled ? 'bg-amber-500/[0.04]' : ''
                                    }`}
                                  >
                                    <td className="p-3 font-semibold text-neutral-200">
                                      {d.clipId}
                                      {d.shareKey && (
                                        <div className="text-[9px] text-neutral-500">key: {d.shareKey}</div>
                                      )}
                                    </td>
                                    <td className="p-3 uppercase text-neutral-400">{d.type}</td>
                                    <td className="p-3">
                                      <span
                                        className={`px-1.5 py-0.5 rounded text-[10px] ${
                                          d.readyState >= 3
                                            ? 'bg-emerald-500/15 text-emerald-400'
                                            : d.readyState === 2
                                            ? 'bg-blue-500/15 text-blue-400'
                                            : 'bg-rose-500/15 text-rose-400 font-bold'
                                        }`}
                                      >
                                        {d.readyStateText} ({d.readyState})
                                      </span>
                                    </td>
                                    <td className="p-3">
                                      {d.seeking ? (
                                        <span className="text-rose-400 font-bold animate-pulse">SEEKING...</span>
                                      ) : (
                                        <span className="text-neutral-500">No</span>
                                      )}
                                    </td>
                                    <td className="p-3 text-white">{d.currentTime}s</td>
                                    <td className="p-3 text-neutral-400">{d.playbackRate}x</td>
                                    <td className="p-3 text-neutral-400">
                                      {d.videoWidth > 0 ? `${d.videoWidth}x${d.videoHeight}` : '—'}
                                    </td>
                                    <td className="p-3 text-neutral-500">{d.networkStateText}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'system' && (
                    <div className="space-y-6">
                      <div>
                        <h4 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-3">
                          Hardware & Operating Environment
                        </h4>
                        <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                            <span className="text-[10px] text-neutral-500 uppercase tracking-wider">Browser & OS</span>
                            <div className="text-neutral-300 font-sans text-xs break-all">
                              {currentIncident.system.userAgent}
                            </div>
                          </div>
                          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                            <span className="text-[10px] text-neutral-500 uppercase tracking-wider">GPU Renderer</span>
                            <div className="text-neutral-300 font-sans text-xs break-all">
                              {currentIncident.system.gpuRenderer}
                            </div>
                          </div>
                          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between">
                            <span className="text-[10px] text-neutral-500 uppercase">CPU Cores</span>
                            <span className="text-white font-semibold">{currentIncident.system.cores} cores</span>
                          </div>
                          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between">
                            <span className="text-[10px] text-neutral-500 uppercase">Device Memory (RAM)</span>
                            <span className="text-white font-semibold">
                              {currentIncident.system.deviceMemoryGB ? `${currentIncident.system.deviceMemoryGB} GB` : 'N/A'}
                            </span>
                          </div>
                          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between">
                            <span className="text-[10px] text-neutral-500 uppercase">Screen & DPR</span>
                            <span className="text-white font-semibold">
                              {currentIncident.system.screenResolution} @ {currentIncident.system.devicePixelRatio}x
                            </span>
                          </div>
                          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between">
                            <span className="text-[10px] text-neutral-500 uppercase">JS Heap Memory</span>
                            <span className="text-white font-semibold">
                              {currentIncident.system.jsHeapUsedMB
                                ? `${currentIncident.system.jsHeapUsedMB} MB / ${currentIncident.system.jsHeapTotalMB} MB`
                                : 'N/A'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-3">
                          Canvas Engine State
                        </h4>
                        <div className="grid grid-cols-4 gap-3 text-xs font-mono">
                          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                            <span className="text-[10px] text-neutral-500 uppercase">Canvas Resolution</span>
                            <div className="text-white font-semibold mt-1">
                              {currentIncident.canvasEngine.canvasWidth}x{currentIncident.canvasEngine.canvasHeight}
                            </div>
                          </div>
                          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                            <span className="text-[10px] text-neutral-500 uppercase">Frame Render Time</span>
                            <div className="text-white font-semibold mt-1">
                              {currentIncident.canvasEngine.lastFrameDurationMs}ms
                            </div>
                          </div>
                          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                            <span className="text-[10px] text-neutral-500 uppercase">Offscreen Buffers</span>
                            <div className="text-white font-semibold mt-1">
                              {currentIncident.canvasEngine.offscreenPoolCount} canvases
                            </div>
                          </div>
                          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                            <span className="text-[10px] text-neutral-500 uppercase">DrawQueue Count</span>
                            <div className="text-white font-semibold mt-1">
                              {currentIncident.canvasEngine.drawQueueCount} items
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'events' && (
                    <div className="space-y-3 font-mono text-xs">
                      <h4 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider font-sans">
                        Recent Flight Recorder Trail ({currentIncident.recentFlightEvents.length} events)
                      </h4>
                      <div className="bg-black/30 rounded-xl border border-white/10 p-3 max-h-[400px] overflow-y-auto space-y-1">
                        {currentIncident.recentFlightEvents.map((ev, i) => (
                          <div key={i} className="flex items-start gap-2 text-[11px] leading-relaxed">
                            <span className="text-neutral-500 shrink-0">[{ev.timeStr}]</span>
                            <span
                              className={`uppercase text-[10px] px-1 rounded shrink-0 ${
                                ev.category === 'seek'
                                  ? 'bg-blue-500/15 text-blue-400'
                                  : ev.category === 'buffer'
                                  ? 'bg-amber-500/15 text-amber-400'
                                  : ev.category === 'boundary'
                                  ? 'bg-purple-500/15 text-purple-400'
                                  : 'bg-neutral-800 text-neutral-400'
                              }`}
                            >
                              {ev.category}
                            </span>
                            <span className="text-neutral-300">{ev.message}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="p-12 text-center text-neutral-500 text-xs">
                  <Bug className="w-10 h-10 mx-auto text-neutral-600 mb-2" />
                  <p className="font-semibold text-neutral-400">No Incident Selected</p>
                  <p className="mt-1">Select an incident from the left sidebar or capture a snapshot.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
