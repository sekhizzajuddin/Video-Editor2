import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useEditorStore, findClipInTracks } from '@/store/editorStore';
import { useShallow } from 'zustand/react/shallow';
import type { CustomFxItem, TimelineClip } from '@/types';
import { generateCustomFx, type CustomFxProgress } from '@/utils/customFxDirector';
import { X, Sparkles, Music, Eye, RefreshCw, Check, AlertTriangle, Loader2, Film } from 'lucide-react';

export function CustomFxMakerModal({ onClose }: { onClose: () => void }) {
  const { tracks, customFxTargetClipId, addCustomFx, pipWindows, mediaLibrary } = useEditorStore(
    useShallow((s) => ({
      tracks: s.tracks,
      customFxTargetClipId: s.customFxTargetClipId,
      addCustomFx: s.addCustomFx,
      pipWindows: s.pipWindows,
      mediaLibrary: s.mediaLibrary,
    }))
  );

  const [phase, setPhase] = useState<CustomFxProgress['phase']>('idle');
  const [message, setMessage] = useState('');
  const [percent, setPercent] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Result state
  const [resultHtml, setResultHtml] = useState<string | null>(null);
  const [resultName, setResultName] = useState('');
  const [resultDescription, setResultDescription] = useState('');
  const [resultReasoning, setResultReasoning] = useState('');
  const [resultPrompt, setResultPrompt] = useState('');
  const [resultThumbnail, setResultThumbnail] = useState<string | undefined>();
  const [audioBreakdown, setAudioBreakdown] = useState<CustomFxItem['audioBreakdown']>(null);
  const [visualBreakdown, setVisualBreakdown] = useState<CustomFxItem['visualBreakdown']>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [iterationCount, setIterationCount] = useState(1);
  const [previewBgMode, setPreviewBgMode] = useState<'video' | 'checkerboard'>('video');
  const [videoFrameSnapshot, setVideoFrameSnapshot] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  // Find the target clip
  const targetClip = React.useMemo(() => {
    if (!customFxTargetClipId) return null;
    return findClipInTracks(tracks, customFxTargetClipId, pipWindows);
  }, [tracks, customFxTargetClipId, pipWindows]);

  // Find media URL for the target clip
  const mediaUrl = React.useMemo(() => {
    if (!targetClip) return null;
    const mediaItem = mediaLibrary.find((m) => m.id === targetClip.mediaId);
    return mediaItem?.url || mediaItem?.thumbnail || null;
  }, [targetClip, mediaLibrary]);

  const startGeneration = useCallback(async (isRegen = false) => {
    if (!targetClip || !mediaUrl) {
      setError('No clip selected or media not found');
      return;
    }

    setError(null);
    if (isRegen) {
      setPhase('reasoning');
      setMessage('⚡ Reusing analyzed scene data • AI thinking deeper...');
      setPercent(40);
    } else {
      setPhase('scanning');
      setMessage('Starting multimodal scan (Groq Whisper + Gemini Vision)...');
      setPercent(5);
    }

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const nextIteration = isRegen ? iterationCount + 1 : 1;
      if (isRegen) {
        setIterationCount(nextIteration);
      }

      const result = await generateCustomFx(
        targetClip,
        mediaUrl,
        targetClip.mediaId,
        customPrompt || undefined,
        (progress) => {
          setPhase(progress.phase);
          setMessage(progress.message);
          setPercent(progress.percent);
        },
        controller.signal,
        {
          cachedScan: isRegen ? { audioBreakdown, visualBreakdown } : undefined,
          isRegenerate: isRegen,
          iteration: nextIteration,
          previousReasoning: resultReasoning || undefined,
        }
      );

      setResultHtml(result.htmlCss);
      setResultName(result.name);
      setResultDescription(result.description);
      setResultReasoning(result.reasoning);
      setResultPrompt(result.prompt);
      setResultThumbnail(result.thumbnail);
      setAudioBreakdown(result.audioBreakdown);
      setVisualBreakdown(result.visualBreakdown);
      if (result.videoFrameSnapshot) {
        setVideoFrameSnapshot(result.videoFrameSnapshot);
      }
      setPhase('done');
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      console.error('[CustomFxMaker] Generation failed:', err);
      setError(err?.message || 'Generation failed');
      setPhase('error');
    } finally {
      setIsRegenerating(false);
    }
  }, [targetClip, mediaUrl, customPrompt, audioBreakdown, visualBreakdown, iterationCount, resultReasoning]);

  // Auto-start generation when modal opens and clip is available
  const startedRef = useRef(false);
  useEffect(() => {
    if (targetClip && mediaUrl && phase === 'idle' && !startedRef.current) {
      startedRef.current = true;
      startGeneration(false);
    }
  }, [targetClip, mediaUrl, phase, startGeneration]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const handleRegenerate = useCallback(() => {
    abortRef.current?.abort();
    setIsRegenerating(true);
    setResultHtml(null);
    setTimeout(() => startGeneration(true), 50);
  }, [startGeneration]);

  const handleConfirm = useCallback(() => {
    if (!resultHtml || !targetClip) return;

    const fxItem: CustomFxItem = {
      id: `custom-fx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: resultName || 'Custom AI Effect',
      description: resultDescription,
      category: 'custom',
      htmlCss: resultHtml,
      thumbnail: resultThumbnail,
      audioBreakdown,
      visualBreakdown,
      reasoning: resultReasoning,
      prompt: resultPrompt,
      duration: targetClip.duration || 5,
      createdAt: Date.now(),
    };

    addCustomFx(fxItem);

    // Automatically connect and insert onto FX track directly above targetClip
    const state = useEditorStore.getState();
    const fxTrackId = state.ensureFxTrackAbove(targetClip.trackId);
    const fxClipId = `custom-fx-clip-${Date.now()}`;
    const fxClip: TimelineClip = {
      id: fxClipId,
      mediaId: fxItem.id,
      trackId: fxTrackId,
      startTime: targetClip.startTime,
      duration: targetClip.duration,
      trimStart: 0,
      trimEnd: 0,
      opacity: 1,
      speed: 1,
      effects: [],
      transform: { x: 0, y: 0, scale: 1, rotation: 0 },
      linkedClipId: targetClip.id,
      fxSettings: {
        type: 'custom_html',
        intensity: 100,
        customFxId: fxItem.id,
        customHtmlCss: fxItem.htmlCss,
        customFxName: fxItem.name,
      },
    };

    state.insertClip(fxClip as any, targetClip.startTime, fxTrackId);
    state.updateClip(targetClip.id, { linkedClipId: fxClipId });
    state.selectClip(fxClipId);
    state.saveSnapshot('Apply Custom FX to Clip');
    onClose();
  }, [resultHtml, targetClip, resultName, resultDescription, resultThumbnail, audioBreakdown, visualBreakdown, resultReasoning, resultPrompt, addCustomFx, onClose]);

  // Update preview when result changes
  useEffect(() => {
    if (resultHtml && previewRef.current) {
      const container = previewRef.current;
      container.innerHTML = '';
      const w = container.clientWidth || 600;
      const scale = w / 1920;
      const wrapper = document.createElement('div');
      wrapper.style.cssText = `transform:scale(${scale});transform-origin:top left;width:1920px;height:1080px;position:absolute;top:0;left:0;pointer-events:none;overflow:hidden;`;
      wrapper.innerHTML = resultHtml;
      container.appendChild(wrapper);
    }
  }, [resultHtml, previewBgMode]);

  const isProcessing = phase !== 'idle' && phase !== 'done' && phase !== 'error';
  const clipName = React.useMemo(() => {
    if (!targetClip) return 'Unknown clip';
    const media = mediaLibrary.find((m) => m.id === targetClip.mediaId);
    return media?.name || targetClip.id;
  }, [targetClip, mediaLibrary]);

  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget && !isProcessing) onClose(); }}
    >
      <div className="bg-[var(--theme-bg-panel)] border border-[var(--theme-border)] rounded-2xl shadow-2xl w-[680px] max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--theme-border)] bg-gradient-to-r from-rose-500/10 via-purple-500/5 to-transparent">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-rose-400" />
            <span className="text-sm font-bold text-[var(--theme-text-primary)]">AI Custom FX Maker</span>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="p-1 rounded-lg hover:bg-[var(--theme-bg-subpanel)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)] disabled:opacity-50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Clip Info */}
          <div className="flex items-center gap-3 p-3 bg-[var(--theme-bg-subpanel)] rounded-xl border border-[var(--theme-border)]">
            <div className="w-10 h-10 rounded-lg bg-rose-500/20 border border-rose-500/30 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-rose-400" />
            </div>
            <div>
              <div className="text-xs font-bold text-[var(--theme-text-primary)]">{clipName}</div>
              <div className="text-[10px] text-[var(--theme-text-muted)]">
                Duration: {(targetClip?.duration || 0).toFixed(1)}s
              </div>
            </div>
          </div>

          {/* Progress Section */}
          {isProcessing && (
            <div className="space-y-3">
              {/* Progress Bar */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-[var(--theme-text-muted)]">{message}</span>
                  <span className="text-rose-400 font-bold">{percent}%</span>
                </div>
                <div className="h-1.5 bg-[var(--theme-bg-subpanel)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-rose-500 to-purple-500 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>

              {/* Agent Cards */}
              <div className="grid grid-cols-2 gap-2">
                <div className={`p-3 rounded-xl border ${phase === 'scanning' ? 'border-cyan-500/30 bg-cyan-500/5' : 'border-[var(--theme-border)] bg-[var(--theme-bg-subpanel)]'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <Music className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="text-[10px] font-bold text-[var(--theme-text-primary)]">Audio Agent</span>
                    {phase === 'scanning' && <Loader2 className="w-3 h-3 text-cyan-400 animate-spin" />}
                  </div>
                  <p className="text-[9px] text-[var(--theme-text-muted)]">
                    {audioBreakdown ? '✅ Transcription complete' : phase === 'scanning' ? 'Transcribing speech...' : 'Waiting...'}
                  </p>
                </div>
                <div className={`p-3 rounded-xl border ${phase === 'scanning' ? 'border-purple-500/30 bg-purple-500/5' : 'border-[var(--theme-border)] bg-[var(--theme-bg-subpanel)]'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <Eye className="w-3.5 h-3.5 text-purple-400" />
                    <span className="text-[10px] font-bold text-[var(--theme-text-primary)]">Visual Agent</span>
                    {phase === 'scanning' && <Loader2 className="w-3 h-3 text-purple-400 animate-spin" />}
                  </div>
                  <p className="text-[9px] text-[var(--theme-text-muted)]">
                    {visualBreakdown ? '✅ Scene analyzed' : phase === 'scanning' ? 'Analyzing frames...' : 'Waiting...'}
                  </p>
                </div>
              </div>

              {/* Reasoning Phase */}
              {(phase === 'reasoning' || phase === 'validating' || phase === 'retrying') && (
                <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/5">
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-[10px] font-bold text-[var(--theme-text-primary)]">
                      {phase === 'retrying' ? 'Refining Design...' : 'Co-Reasoning Engine'}
                    </span>
                    <Loader2 className="w-3 h-3 text-amber-400 animate-spin" />
                  </div>
                  <p className="text-[9px] text-[var(--theme-text-muted)]">{message}</p>
                </div>
              )}
            </div>
          )}

          {/* Error State */}
          {phase === 'error' && error && (
            <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <span className="text-xs font-bold text-red-400">Generation Failed</span>
              </div>
              <p className="text-[10px] text-red-300/80 mb-3">{error}</p>
              <button
                onClick={handleRegenerate}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/40 rounded-lg text-[10px] font-semibold transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                Retry
              </button>
            </div>
          )}

          {/* Results Section */}
          {phase === 'done' && resultHtml && (
            <div className="space-y-3">
              {/* Agent Insights */}
              <div className="grid grid-cols-2 gap-2">
                {/* Audio Insight */}
                <div className="p-3 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg-subpanel)]">
                  <div className="flex items-center gap-2 mb-2">
                    <Music className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="text-[10px] font-bold text-[var(--theme-text-primary)]">Audio Insight</span>
                  </div>
                  {audioBreakdown ? (
                    <div className="space-y-1">
                      <p className="text-[9px] text-[var(--theme-text-muted)] line-clamp-2">{audioBreakdown.transcript.slice(0, 100)}...</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {audioBreakdown.keywords.slice(0, 4).map((kw) => (
                          <span key={kw} className="px-1.5 py-0.5 bg-cyan-500/10 border border-cyan-500/20 rounded text-[8px] text-cyan-300">{kw}</span>
                        ))}
                      </div>
                      <div className="flex gap-2 mt-1">
                        <span className="text-[8px] text-[var(--theme-text-muted)]">Tone: <span className="text-cyan-300">{audioBreakdown.tone}</span></span>
                        <span className="text-[8px] text-[var(--theme-text-muted)]">Pace: <span className="text-cyan-300">{audioBreakdown.pace}</span></span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[9px] text-[var(--theme-text-muted)] italic">No audio data available</p>
                  )}
                </div>

                {/* Vision Insight */}
                <div className="p-3 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg-subpanel)]">
                  <div className="flex items-center gap-2 mb-2">
                    <Eye className="w-3.5 h-3.5 text-purple-400" />
                    <span className="text-[10px] font-bold text-[var(--theme-text-primary)]">Vision Insight</span>
                  </div>
                  {visualBreakdown ? (
                    <div className="space-y-1">
                      <p className="text-[9px] text-[var(--theme-text-muted)]"><strong>Type:</strong> {visualBreakdown.sceneType}</p>
                      <p className="text-[9px] text-[var(--theme-text-muted)] line-clamp-1"><strong>Subjects:</strong> {visualBreakdown.subjects}</p>
                      <p className="text-[9px] text-[var(--theme-text-muted)]"><strong>Safe Zone:</strong> {visualBreakdown.safeZones}</p>
                      <div className="flex gap-1 mt-1">
                        {visualBreakdown.palette.slice(0, 5).map((c, i) => (
                          <div key={i} className="w-4 h-4 rounded border border-white/20" style={{ backgroundColor: c }} title={c} />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-[9px] text-[var(--theme-text-muted)] italic">No visual data available</p>
                  )}
                </div>
              </div>

              {/* AI Reasoning */}
              <div className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/5">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-[10px] font-bold text-[var(--theme-text-primary)]">AI Reasoning</span>
                </div>
                <p className="text-[9px] text-[var(--theme-text-muted)] leading-relaxed">{resultReasoning}</p>
              </div>

              {/* Cached Scan Indicator & Deep-Thinking Status */}
              <div className="flex items-center justify-between px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-[9px]">
                <div className="flex items-center gap-1.5 text-emerald-300">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span><strong>Clip Data Cached & Locked:</strong> Audio & Vision scan preserved — regenerating thinks deeper without re-scanning.</span>
                </div>
                {iterationCount > 1 && (
                  <span className="px-1.5 py-0.5 bg-purple-500/20 border border-purple-500/30 text-purple-300 rounded font-mono font-bold text-[8px] shrink-0">
                    Iteration #{iterationCount}
                  </span>
                )}
              </div>

              {/* Animation Preview with Transparency Verification */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-[var(--theme-text-primary)]">Transparent Overlay Preview</span>
                    <span className="px-1.5 py-0.2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded text-[8px] font-semibold">100% Transparent</span>
                  </div>
                  <div className="flex items-center gap-1 bg-[var(--theme-bg-panel)] p-0.5 rounded-lg border border-[var(--theme-border)] text-[9px]">
                    <button
                      type="button"
                      onClick={() => setPreviewBgMode('video')}
                      className={`px-2 py-0.5 rounded transition-colors ${previewBgMode === 'video' ? 'bg-rose-500/20 text-rose-300 font-semibold' : 'text-[var(--theme-text-muted)] hover:text-white'}`}
                    >
                      Over Video Frame
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewBgMode('checkerboard')}
                      className={`px-2 py-0.5 rounded transition-colors ${previewBgMode === 'checkerboard' ? 'bg-rose-500/20 text-rose-300 font-semibold' : 'text-[var(--theme-text-muted)] hover:text-white'}`}
                    >
                      Checkerboard
                    </button>
                  </div>
                </div>

                <div className="relative w-full aspect-video rounded-xl border border-[var(--theme-border)] overflow-hidden shadow-inner bg-black">
                  {/* Background Plate */}
                  {previewBgMode === 'video' ? (
                    videoFrameSnapshot ? (
                      <img src={videoFrameSnapshot} alt="Video Backdrop" className="absolute inset-0 w-full h-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 bg-neutral-900 flex items-center justify-center">
                        <Film className="w-8 h-8 text-neutral-700 animate-pulse" />
                      </div>
                    )
                  ) : (
                    <div className="absolute inset-0 bg-[radial-gradient(#404040_1.5px,transparent_1.5px)] [background-size:16px_16px] bg-[#121212]" />
                  )}

                  {/* Rendered Motion Graphics Overlay */}
                  <div
                    ref={previewRef}
                    className="absolute inset-0 pointer-events-none"
                  />
                </div>
              </div>

              {/* Editable Prompt & Deep-Thinking Regenerate */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-[var(--theme-text-primary)]">Custom Prompt & Director Notes</span>
                  <button
                    onClick={handleRegenerate}
                    disabled={isRegenerating || isProcessing}
                    className="flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-rose-600 to-purple-600 hover:from-rose-500 hover:to-purple-500 text-white rounded-lg text-[9px] font-bold shadow-md transition-all active:scale-95 disabled:opacity-50"
                    title="Bypass scanning and prompt the AI to think deeper for a fresh, higher-fidelity design"
                  >
                    <Sparkles className={`w-3 h-3 ${isRegenerating ? 'animate-spin' : ''}`} />
                    {isRegenerating ? 'Thinking Deeper...' : '✨ Regenerate (Think Deeper)'}
                  </button>
                </div>
                <textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="Optional notes to direct the AI (e.g. 'Emphasize the financial numbers with a neon chart', 'Use a futuristic radar HUD in top right', 'Make it more dramatic')..."
                  className="w-full h-16 bg-[var(--theme-bg-subpanel)] border border-[var(--theme-border)] rounded-lg p-2 text-[10px] text-[var(--theme-text-primary)] placeholder-[var(--theme-text-muted)] resize-none focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>
          )}

          {/* No clip selected */}
          {!targetClip && (
            <div className="text-center py-8">
              <p className="text-xs text-[var(--theme-text-muted)]">No clip selected. Please select a video clip first.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--theme-border)] bg-[var(--theme-bg-subpanel)]">
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-1.5 text-xs font-medium text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)] border border-[var(--theme-border)] rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!resultHtml || phase !== 'done'}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-gradient-to-r from-rose-600 to-purple-600 hover:from-rose-500 hover:to-purple-500 text-white text-xs font-bold rounded-lg shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Check className="w-3.5 h-3.5" />
            Confirm & Add to FX
          </button>
        </div>
      </div>
    </div>
  );
}
