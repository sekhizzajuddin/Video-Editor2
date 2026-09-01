import React, { useState, useEffect, useRef } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { useVoiceSyncStore } from '@/store/voiceSyncStore';
import { 
  X, Mic, Loader2, Play, Square, Check, Plus, AlertCircle, Trash2, 
  RefreshCw, CheckSquare, Square as UncheckedSquare, Volume2, ArrowLeft,
  Sparkles, Sliders
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  SyncWord, 
  SyncWordPair, 
  analyzeSourceAudio, 
  analyzeTtsAudio, 
  pairWordsAlgorithm,
  applyVoiceSyncToTimeline,
  extractAudioFromTracks,
  renderMediaItemToWav,
  findMissingWordInGap,
  setCachedSourceBlob,
  getCachedSourceBlob,
  setCachedTtsBlob,
  getCachedTtsBlob
} from '@/utils/syncStudioEngine';
import { MillisecondTimeInput } from './MillisecondTimeInput';

const CAPTION_LANGUAGES = [
  { code: 'EN', name: 'English' }, 
  { code: 'HI', name: 'Hindi' }, 
  { code: 'ES', name: 'Spanish' },
  { code: 'FR', name: 'French' },
  { code: 'DE', name: 'German' },
  { code: 'JA', name: 'Japanese' },
  { code: 'ZH', name: 'Chinese' },
  { code: 'AR', name: 'Arabic' }
];

export const VoiceSyncStudioModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const store = useEditorStore();
  const tracks = store.tracks;
  const mediaLibrary = store.mediaLibrary.filter(m => m.type === 'audio' || m.type === 'video');

  // Persistent Store State
  const {
    step,
    sourceTrackIds,
    rawScript,
    language,
    ttsMediaId,
    pairs,
    isProcessing,
    loadingText,
    setStep,
    setSourceTrackIds,
    setRawScript,
    setLanguage,
    setTtsMediaId,
    setPairs,
    updatePair,
    updateSourceWord,
    updateTtsWord,
    addPairAt,
    removePair,
    setAllConfirmed,
    setIsProcessing,
    clearData
  } = useVoiceSyncStore();

  // Full TTS Preview Audio
  const [isPlayingTtsPreview, setIsPlayingTtsPreview] = useState(false);
  const ttsPreviewAudioRef = useRef<HTMLAudioElement | null>(null);

  // Segment Audio Playback (for individual words)
  const [playingSegmentId, setPlayingSegmentId] = useState<string | null>(null);
  const activeAudioRef = useRef<{ audio: HTMLAudioElement; url: string; cleanup: () => void } | null>(null);

  // Stop all audio on unmount
  useEffect(() => {
    return () => {
      if (activeAudioRef.current) {
        activeAudioRef.current.audio.pause();
        URL.revokeObjectURL(activeAudioRef.current.url);
      }
      if (ttsPreviewAudioRef.current) {
        ttsPreviewAudioRef.current.pause();
      }
    };
  }, []);

  // Helper to play small slice of a blob
  const playChunk = async (type: 'source' | 'tts', start: number, end: number, segmentKey: string) => {
    let blob = type === 'source' ? getCachedSourceBlob() : getCachedTtsBlob();
    
    // If blob not in memory, try to re-render it
    if (!blob) {
      try {
        if (type === 'source') {
          if (sourceTrackIds.length === 0) return toast.error('No source tracks selected');
          blob = await extractAudioFromTracks(sourceTrackIds, store.totalDuration || 10);
          if (blob) setCachedSourceBlob(blob);
        } else {
          if (!ttsMediaId) return toast.error('No TTS media selected');
          blob = await renderMediaItemToWav(ttsMediaId);
          if (blob) setCachedTtsBlob(blob);
        }
      } catch (e: any) {
        return toast.error('Could not render audio preview: ' + e.message);
      }
    }

    if (!blob) return toast.error('Audio data not available');

    // If already playing this segment, stop it
    if (playingSegmentId === segmentKey && activeAudioRef.current) {
      activeAudioRef.current.audio.pause();
      activeAudioRef.current.audio.removeEventListener('timeupdate', activeAudioRef.current.cleanup);
      URL.revokeObjectURL(activeAudioRef.current.url);
      activeAudioRef.current = null;
      setPlayingSegmentId(null);
      return;
    }

    // Stop existing playback
    if (activeAudioRef.current) {
      activeAudioRef.current.audio.pause();
      activeAudioRef.current.audio.removeEventListener('timeupdate', activeAudioRef.current.cleanup);
      URL.revokeObjectURL(activeAudioRef.current.url);
      activeAudioRef.current = null;
    }

    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.currentTime = Math.max(0, start);
    
    setPlayingSegmentId(segmentKey);

    const onTimeUpdate = () => {
      if (audio.currentTime >= end || audio.paused || audio.ended) {
        audio.pause();
        audio.removeEventListener('timeupdate', onTimeUpdate);
        URL.revokeObjectURL(url);
        activeAudioRef.current = null;
        setPlayingSegmentId(null);
      }
    };
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.play().catch(e => {
      console.warn('Playback error:', e);
      setPlayingSegmentId(null);
    });

    activeAudioRef.current = { audio, url, cleanup: onTimeUpdate };
  };

  // Toggle Full TTS Preview
  const handleToggleTtsPreview = () => {
    if (isPlayingTtsPreview && ttsPreviewAudioRef.current) {
      ttsPreviewAudioRef.current.pause();
      setIsPlayingTtsPreview(false);
      return;
    }

    const selectedMedia = mediaLibrary.find(m => m.id === ttsMediaId);
    if (!selectedMedia || !selectedMedia.url) {
      return toast.error('Please select a valid TTS audio file first.');
    }

    if (ttsPreviewAudioRef.current) {
      ttsPreviewAudioRef.current.pause();
    }

    const audio = new Audio(selectedMedia.url);
    audio.play().then(() => {
      setIsPlayingTtsPreview(true);
    }).catch(err => {
      toast.error('Failed to play preview: ' + err.message);
    });

    audio.onended = () => setIsPlayingTtsPreview(false);
    audio.onpause = () => setIsPlayingTtsPreview(false);
    ttsPreviewAudioRef.current = audio;
  };

  // ─── Handlers ──────────────────────────────────────────────────────────

  const handleAnalyzeSource = async () => {
    if (sourceTrackIds.length === 0) return toast.error('Please select at least one source track.');
    setIsProcessing(true, 'Rendering & Extracting Source Audio...');
    try {
      const blob = await extractAudioFromTracks(sourceTrackIds, store.totalDuration || 10);
      if (!blob) throw new Error('Failed to render selected timeline tracks.');
      setCachedSourceBlob(blob);

      setIsProcessing(true, 'AI Extracting Exact Words & Timestamps (Gemini Flash)...');
      const sWords = await analyzeSourceAudio(blob, language, rawScript);

      if (sWords.length === 0) {
        throw new Error('No words detected in source audio. Check track selection or raw script.');
      }

      // Initialize pairs with source words
      setPairs(sWords.map(w => ({
        id: crypto.randomUUID(),
        sourceWord: w,
        confirmed: false
      })));
      setStep(2);
      toast.success(`Extracted ${sWords.length} source words!`);
    } catch (e: any) {
      toast.error(e.message || 'Error analyzing source audio');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAnalyzeTts = async () => {
    if (!ttsMediaId) return toast.error('Please select a TTS Audio file from your media library.');
    let sourceBlob = getCachedSourceBlob();
    if (!sourceBlob) {
      sourceBlob = await extractAudioFromTracks(sourceTrackIds, store.totalDuration || 10);
      if (sourceBlob) setCachedSourceBlob(sourceBlob);
    }

    setIsProcessing(true, 'Decoding & Rendering TTS Audio...');
    try {
      const tBlob = await renderMediaItemToWav(ttsMediaId);
      setCachedTtsBlob(tBlob);

      setIsProcessing(true, 'AI Extracting TTS Words & Building Word Groups...');
      const sourceWords = pairs.map(p => p.sourceWord);
      const tWords = await analyzeTtsAudio(tBlob, language, sourceWords);

      const matchedPairs = pairWordsAlgorithm(sourceWords, tWords);
      setPairs(matchedPairs);
      setStep(3);
      toast.success(`Grouped ${matchedPairs.length} dialogue word pairs!`);
    } catch (e: any) {
      toast.error(e.message || 'Error analyzing TTS');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFallbackMissingWord = async (index: number) => {
    let sourceBlob = getCachedSourceBlob();
    let ttsBlob = getCachedTtsBlob();
    if (!sourceBlob || !ttsBlob) {
      return toast.error('Audio cache missing. Please re-run analysis.');
    }

    const prev = pairs[index - 1];
    const next = pairs[index];
    if (!prev || !next) {
      return toast.error('Need surrounding words to calculate audio gap.');
    }

    const hint = window.prompt('Enter missing word to recover:');
    if (!hint || !hint.trim()) return;

    setIsProcessing(true, `Targeted AI Micro-Analysis for "${hint.trim()}" in audio gap...`);
    try {
      const gap = await findMissingWordInGap(
        sourceBlob, ttsBlob,
        prev.sourceWord.end, next.sourceWord.start,
        prev.ttsWord?.end || prev.sourceWord.end, next.ttsWord?.start || next.sourceWord.start,
        hint.trim()
      );

      const newPair: SyncWordPair = {
        id: crypto.randomUUID(),
        sourceWord: {
          id: crypto.randomUUID(),
          word: hint.trim(),
          start: Math.round(gap.sourceStart * 1000) / 1000,
          end: Math.round(gap.sourceEnd * 1000) / 1000
        },
        ttsWord: {
          id: crypto.randomUUID(),
          word: hint.trim(),
          start: Math.round(gap.ttsStart * 1000) / 1000,
          end: Math.round(gap.ttsEnd * 1000) / 1000
        },
        confirmed: true
      };

      addPairAt(index, newPair);
      toast.success(`Recovered missing word "${hint.trim()}"!`);
    } catch (e: any) {
      toast.error(e.message || 'Failed to detect word in gap');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApply = () => {
    try {
      const confirmedCount = pairs.filter(p => p.confirmed && p.ttsWord).length;
      if (confirmedCount === 0) {
        return toast.error('Please check at least one confirmed word group to apply.');
      }

      let targetTrackId = tracks.find(t => t.type === 'audio')?.id;
      if (!targetTrackId) {
        useEditorStore.getState().addTrack('audio');
        const newTracks = useEditorStore.getState().tracks;
        targetTrackId = newTracks.find(t => t.type === 'audio')?.id;
      }

      if (!targetTrackId) throw new Error('Could not find or create a target audio track.');

      applyVoiceSyncToTimeline(targetTrackId, ttsMediaId, pairs);
      toast.success(`Applied ${confirmedCount} synchronized words to timeline with Auto-Pitch!`);
      onClose();
    } catch (e: any) {
      toast.error(e.message || 'Failed to apply voice sync');
    }
  };

  const handleClearConfirm = () => {
    if (window.confirm('Clear all Voice Sync Studio data? This will reset all extracted words, timings, and progress.')) {
      clearData();
      setCachedSourceBlob(null);
      setCachedTtsBlob(null);
      if (ttsPreviewAudioRef.current) ttsPreviewAudioRef.current.pause();
      if (activeAudioRef.current) activeAudioRef.current.audio.pause();
      toast.info('Voice Sync Studio reset.');
    }
  };

  const confirmedCount = pairs.filter(p => p.confirmed).length;
  const allConfirmed = pairs.length > 0 && confirmedCount === pairs.length;

  return (
    <div className="fixed inset-0 bg-black/70 z-[999] flex items-center justify-center backdrop-blur-md p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-[var(--theme-bg-panel)] border border-[var(--theme-border)] rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden text-[var(--theme-text-primary)]">
        
        {/* ─── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--theme-border)] bg-[var(--theme-bg-subpanel)] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-500 shadow-sm">
              <Mic className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold tracking-tight">Voice Sync Studio</h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/20">
                  Word-by-Word
                </span>
              </div>
              <p className="text-[11px] text-[var(--theme-text-muted)]">
                AI Alignment • 1ms Precision • Rate-Stretch Auto Pitch
              </p>
            </div>
          </div>

          {/* Stepper Navigation */}
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1 bg-black/20 dark:bg-white/5 rounded-full border border-[var(--theme-border)] text-xs font-semibold">
            <button 
              onClick={() => setStep(1)} 
              className={`px-2.5 py-1 rounded-full transition-all ${step === 1 ? 'bg-blue-600 text-white shadow-sm' : 'text-[var(--theme-text-muted)] hover:text-white'}`}
            >
              1. Source Tracks
            </button>
            <span className="text-[var(--theme-text-muted)]">›</span>
            <button 
              onClick={() => pairs.length > 0 && setStep(2)} 
              disabled={pairs.length === 0}
              className={`px-2.5 py-1 rounded-full transition-all disabled:opacity-40 ${step === 2 ? 'bg-blue-600 text-white shadow-sm' : 'text-[var(--theme-text-muted)] hover:text-white'}`}
            >
              2. TTS Media
            </button>
            <span className="text-[var(--theme-text-muted)]">›</span>
            <button 
              onClick={() => pairs.some(p => p.ttsWord) && setStep(3)} 
              disabled={!pairs.some(p => p.ttsWord)}
              className={`px-2.5 py-1 rounded-full transition-all disabled:opacity-40 ${step === 3 ? 'bg-blue-600 text-white shadow-sm' : 'text-[var(--theme-text-muted)] hover:text-white'}`}
            >
              3. Verify & Apply
            </button>
          </div>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-2">
            {pairs.length > 0 && (
              <button
                onClick={handleClearConfirm}
                title="Clear all extracted sync data"
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Clear Data</span>
              </button>
            )}

            <button 
              onClick={onClose} 
              disabled={isProcessing} 
              title="Close window (data is saved automatically)"
              className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors disabled:opacity-50"
            >
              <X className="w-4 h-4 text-[var(--theme-text-muted)] hover:text-white" />
            </button>
          </div>
        </div>

        {/* ─── Body ────────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-hidden relative flex flex-col">
          {/* Processing Overlay */}
          {isProcessing && (
            <div className="absolute inset-0 bg-[var(--theme-bg-panel)]/85 backdrop-blur-md z-50 flex flex-col items-center justify-center p-6 text-center animate-in fade-in">
              <div className="relative mb-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center animate-pulse">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                </div>
              </div>
              <h3 className="text-sm font-bold text-white mb-1">Processing Voice Sync</h3>
              <p className="text-xs text-blue-300 font-medium max-w-md">{loadingText || 'Please wait...'}</p>
            </div>
          )}

          {/* ─── STEP 1: Source Track Selection ────────────────────────────── */}
          {step === 1 && (
            <div className="p-6 space-y-6 overflow-y-auto h-full max-w-3xl mx-auto w-full">
              <div className="p-4 bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-transparent border border-blue-500/20 rounded-xl flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <p className="font-bold text-blue-300">Step 1: Select Source Video/Audio Tracks</p>
                  <p className="text-[var(--theme-text-muted)] leading-relaxed">
                    Select the timeline tracks containing your original spoken dialogue. Gemini Flash Lite will transcribe every single word with millisecond timestamps.
                  </p>
                </div>
              </div>

              {/* Source Tracks */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-2.5 text-[var(--theme-text-secondary)]">
                  1. Select Source Tracks ({sourceTrackIds.length} Selected)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2.5 bg-[var(--theme-bg-subpanel)] rounded-xl border border-[var(--theme-border)] max-h-48 overflow-y-auto">
                  {tracks.map(t => {
                    const isSelected = sourceTrackIds.includes(t.id);
                    return (
                      <label 
                        key={t.id} 
                        className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-all ${
                          isSelected 
                            ? 'bg-blue-500/15 border-blue-500/40 text-white shadow-sm' 
                            : 'bg-black/10 dark:bg-white/5 border-transparent hover:border-white/10 text-[var(--theme-text-muted)]'
                        }`}
                      >
                        <input 
                          type="checkbox" 
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) setSourceTrackIds([...sourceTrackIds, t.id]);
                            else setSourceTrackIds(sourceTrackIds.filter(id => id !== t.id));
                          }}
                          className="w-4 h-4 rounded border-[var(--theme-border)] text-blue-600 focus:ring-blue-500"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold truncate">{t.name || t.type.toUpperCase()}</span>
                            <span className="text-[9px] uppercase px-1.5 py-0.2 rounded font-mono bg-black/30 border border-white/10 text-[var(--theme-text-muted)]">
                              {t.type}
                            </span>
                          </div>
                          <span className="text-[10px] text-[var(--theme-text-muted)]">{t.clips.length} clip(s)</span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Language Selection */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-[var(--theme-text-secondary)]">
                  2. Dialogue Language
                </label>
                <select 
                  value={language} 
                  onChange={e => setLanguage(e.target.value)} 
                  className="w-full bg-[var(--theme-bg-subpanel)] border border-[var(--theme-border)] rounded-xl p-3 text-xs font-medium outline-none focus:border-blue-500 transition-colors"
                >
                  {CAPTION_LANGUAGES.map(l => (
                    <option key={l.code} value={l.code}>{l.name} ({l.code})</option>
                  ))}
                </select>
              </div>

              {/* Raw Script (Optional) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--theme-text-secondary)]">
                    3. Raw Reference Script <span className="text-[var(--theme-text-muted)] font-normal">(Optional, Highly Recommended)</span>
                  </label>
                  <span className="text-[10px] text-blue-400">Forces 100% accurate spelling & word extraction</span>
                </div>
                <textarea 
                  value={rawScript} 
                  onChange={e => setRawScript(e.target.value)}
                  placeholder="Paste your original dialogue script here..."
                  className="w-full bg-[var(--theme-bg-subpanel)] border border-[var(--theme-border)] rounded-xl p-3.5 text-xs font-mono h-28 outline-none focus:border-blue-500 transition-colors placeholder:text-[var(--theme-text-muted)]/50"
                />
              </div>

              {/* Action Button */}
              <button 
                onClick={handleAnalyzeSource} 
                disabled={sourceTrackIds.length === 0}
                className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold tracking-wide shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                AI Analyze & Extract Source Words
              </button>
            </div>
          )}

          {/* ─── STEP 2: Source Words Review & TTS Audio Selector ───────────── */}
          {step === 2 && (
            <div className="p-6 space-y-5 overflow-hidden h-full flex flex-col">
              
              {/* TTS Audio Picker Bar */}
              <div className="p-4 bg-[var(--theme-bg-subpanel)] border border-[var(--theme-border)] rounded-xl shrink-0 space-y-3 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-bold text-white flex items-center gap-2">
                      <Volume2 className="w-4 h-4 text-purple-400" />
                      Select TTS Voiceover Audio File
                    </h3>
                    <p className="text-[11px] text-[var(--theme-text-muted)]">
                      Pick the generated TTS audio file from your Media Library
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleToggleTtsPreview}
                      disabled={!ttsMediaId}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all disabled:opacity-40 ${
                        isPlayingTtsPreview 
                          ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' 
                          : 'bg-black/20 hover:bg-black/40 text-purple-300 border-purple-500/30'
                      }`}
                    >
                      {isPlayingTtsPreview ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      <span>{isPlayingTtsPreview ? 'Stop Audio' : 'Preview Full TTS'}</span>
                    </button>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <select 
                    value={ttsMediaId} 
                    onChange={e => setTtsMediaId(e.target.value)} 
                    className="flex-1 bg-[var(--theme-bg-panel)] border border-[var(--theme-border)] rounded-xl p-2.5 text-xs font-medium outline-none focus:border-purple-500"
                  >
                    <option value="" disabled>Choose Audio file from Media Library...</option>
                    {mediaLibrary.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.type.toUpperCase()}{m.duration ? ` - ${m.duration.toFixed(1)}s` : ''})
                      </option>
                    ))}
                  </select>

                  <button 
                    onClick={handleAnalyzeTts} 
                    disabled={!ttsMediaId}
                    className="py-2.5 px-5 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold tracking-wide shadow-md shadow-purple-500/20 transition-all flex items-center justify-center gap-2 shrink-0"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    Start Sync & Match Words
                  </button>
                </div>
              </div>

              {/* Source Words Vertical List Header */}
              <div className="flex items-center justify-between shrink-0">
                <span className="text-xs font-bold text-[var(--theme-text-secondary)] uppercase tracking-wider">
                  Extracted Source Words ({pairs.length} Words)
                </span>
                <span className="text-[11px] text-[var(--theme-text-muted)]">
                  Use Up/Down arrows to adjust timing by 1ms
                </span>
              </div>

              {/* Source Words Table */}
              <div className="flex-1 min-h-0 border border-[var(--theme-border)] rounded-xl overflow-hidden flex flex-col bg-[var(--theme-bg-subpanel)]">
                <div className="grid grid-cols-[40px_1fr_60px_100px_100px_80px] gap-2 px-4 py-2.5 border-b border-[var(--theme-border)] bg-[var(--theme-bg-panel)] text-[11px] font-bold text-[var(--theme-text-secondary)] shrink-0">
                  <span>#</span>
                  <span>Source Word</span>
                  <span className="text-center">Play</span>
                  <span className="text-center">Start (s)</span>
                  <span className="text-center">End (s)</span>
                  <span className="text-center">Duration</span>
                </div>

                <div className="overflow-y-auto p-2 space-y-1 flex-1">
                  {pairs.map((p, idx) => {
                    const dur = Math.max(0, p.sourceWord.end - p.sourceWord.start);
                    const segKey = `src_${p.id}`;
                    const isPlaying = playingSegmentId === segKey;

                    return (
                      <div 
                        key={p.id} 
                        className="grid grid-cols-[40px_1fr_60px_100px_100px_80px] gap-2 items-center px-2 py-1.5 hover:bg-black/10 dark:hover:bg-white/5 rounded-lg text-xs transition-colors"
                      >
                        <span className="text-[var(--theme-text-muted)] font-mono text-[11px] px-2">{idx + 1}</span>
                        
                        <input 
                          type="text"
                          value={p.sourceWord.word} 
                          onChange={e => updateSourceWord(p.id, { word: e.target.value })}
                          className="bg-transparent border-b border-transparent focus:border-blue-500 outline-none font-medium text-white px-1"
                        />

                        <div className="flex justify-center">
                          <button 
                            onClick={() => playChunk('source', p.sourceWord.start, p.sourceWord.end, segKey)}
                            className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all ${
                              isPlaying 
                                ? 'bg-amber-500 text-black shadow-sm' 
                                : 'bg-blue-500/15 text-blue-400 hover:bg-blue-500/30'
                            }`}
                            title="Play source word segment"
                          >
                            {isPlaying ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3 ml-0.5" />}
                          </button>
                        </div>

                        <MillisecondTimeInput 
                          value={p.sourceWord.start} 
                          onChange={val => updateSourceWord(p.id, { start: val })}
                          className="text-blue-300"
                        />

                        <MillisecondTimeInput 
                          value={p.sourceWord.end} 
                          onChange={val => updateSourceWord(p.id, { end: val })}
                          className="text-blue-300"
                        />

                        <span className="text-center font-mono text-[11px] text-[var(--theme-text-muted)]">
                          {dur.toFixed(3)}s
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Back Button */}
              <div className="flex justify-between items-center shrink-0">
                <button 
                  onClick={() => setStep(1)} 
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[var(--theme-text-muted)] hover:text-white rounded-lg hover:bg-white/5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to Source Settings
                </button>
              </div>
            </div>
          )}

          {/* ─── STEP 3: Grouped Matching, Manual Review & Apply ────────────── */}
          {step === 3 && (
            <div className="h-full flex flex-col p-4 sm:p-5 overflow-hidden">
              
              {/* Workspace Top Toolbar */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 mb-3 border-b border-[var(--theme-border)] shrink-0">
                <div>
                  <h3 className="text-xs font-bold text-white flex items-center gap-2">
                    Review Word Groups & Align Timings
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300">
                      {confirmedCount} / {pairs.length} Confirmed
                    </span>
                  </h3>
                  <p className="text-[11px] text-[var(--theme-text-muted)]">
                    Check boxes to confirm groups. Arrow keys adjust timestamps with 1ms resolution.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button 
                    onClick={() => setAllConfirmed(!allConfirmed)} 
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-black/20 hover:bg-black/40 border border-[var(--theme-border)] rounded-lg text-xs font-semibold text-[var(--theme-text-secondary)] hover:text-white transition-all"
                  >
                    {allConfirmed ? <CheckSquare className="w-3.5 h-3.5 text-green-400" /> : <UncheckedSquare className="w-3.5 h-3.5" />}
                    <span>{allConfirmed ? 'Uncheck All' : 'Check All Confirmed'}</span>
                  </button>

                  <button 
                    onClick={() => setStep(2)} 
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-[var(--theme-text-muted)] hover:text-white rounded-lg hover:bg-white/5"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Back
                  </button>
                </div>
              </div>

              {/* Grouped Word Cards List */}
              <div className="flex-1 overflow-y-auto pr-1 space-y-3 min-h-0">
                {pairs.map((p, index) => {
                  const sDur = Math.max(0, p.sourceWord.end - p.sourceWord.start);
                  const tDur = p.ttsWord ? Math.max(0, p.ttsWord.end - p.ttsWord.start) : 0;
                  const gap = tDur - sDur;
                  
                  const srcKey = `src_${p.id}`;
                  const ttsKey = `tts_${p.id}`;
                  const isSrcPlaying = playingSegmentId === srcKey;
                  const isTtsPlaying = playingSegmentId === ttsKey;

                  return (
                    <React.Fragment key={p.id}>
                      {/* Add Word Fallback Button Between Groups */}
                      {index > 0 && (
                        <div className="flex justify-center -my-1.5 relative z-10">
                          <button 
                            onClick={() => handleFallbackMissingWord(index)} 
                            className="px-3 py-0.5 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold rounded-full flex items-center gap-1 shadow-md hover:scale-105 transition-all border border-blue-400/40"
                            title="Recover missing word in audio gap between these groups"
                          >
                            <Plus className="w-3 h-3" /> Add Missing Word Below Group {index}
                          </button>
                        </div>
                      )}

                      {/* Group Card (Designed according to user ASCII plan) */}
                      <div 
                        className={`p-3.5 rounded-xl border transition-all ${
                          p.confirmed 
                            ? 'border-green-500/50 bg-green-500/10 shadow-sm shadow-green-500/5' 
                            : 'border-[var(--theme-border)] bg-[var(--theme-bg-subpanel)] hover:border-white/20'
                        }`}
                      >
                        {/* Group Header */}
                        <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-white/5">
                          <div className="flex items-center gap-2.5">
                            <input 
                              type="checkbox" 
                              checked={p.confirmed} 
                              onChange={e => updatePair(p.id, { confirmed: e.target.checked })} 
                              className="w-4 h-4 rounded border-[var(--theme-border)] text-green-500 focus:ring-green-500 cursor-pointer"
                            />
                            <span className="text-xs font-bold text-white">Group {index + 1}</span>
                          </div>

                          <div className="flex items-center gap-2">
                            {/* Duration Gap Pill */}
                            <span 
                              className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold border ${
                                Math.abs(gap) <= 0.15 
                                  ? 'bg-green-500/15 text-green-400 border-green-500/20' 
                                  : Math.abs(gap) <= 0.4 
                                    ? 'bg-amber-500/15 text-amber-400 border-amber-500/20' 
                                    : 'bg-red-500/15 text-red-400 border-red-500/20'
                              }`}
                              title="TTS Duration minus Source Duration"
                            >
                              Duration Gap: {gap >= 0 ? '+' : ''}{gap.toFixed(3)}s
                            </span>

                            <button 
                              onClick={() => removePair(p.id)}
                              title="Delete this group"
                              className="p-1 text-[var(--theme-text-muted)] hover:text-red-400 rounded transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Source Row */}
                        <div className="grid grid-cols-[55px_1fr_36px_85px_85px_65px] gap-2 items-center text-xs mb-2">
                          <span className="text-[11px] font-bold text-blue-400">Source:</span>
                          
                          <input 
                            type="text"
                            value={p.sourceWord.word} 
                            onChange={e => updateSourceWord(p.id, { word: e.target.value })} 
                            className="bg-black/20 border border-white/10 rounded px-2 py-1 font-medium text-white outline-none focus:border-blue-500"
                          />

                          <button 
                            onClick={() => playChunk('source', p.sourceWord.start, p.sourceWord.end, srcKey)}
                            className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all ${
                              isSrcPlaying 
                                ? 'bg-amber-500 text-black shadow-sm' 
                                : 'bg-blue-500/15 text-blue-400 hover:bg-blue-500/30'
                            }`}
                            title="Play source word"
                          >
                            {isSrcPlaying ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3 ml-0.5" />}
                          </button>

                          <MillisecondTimeInput 
                            value={p.sourceWord.start} 
                            onChange={val => updateSourceWord(p.id, { start: val })}
                            className="text-blue-300"
                          />

                          <MillisecondTimeInput 
                            value={p.sourceWord.end} 
                            onChange={val => updateSourceWord(p.id, { end: val })}
                            className="text-blue-300"
                          />

                          <span className="text-[10px] font-mono text-[var(--theme-text-muted)] text-center">
                            {sDur.toFixed(3)}s
                          </span>
                        </div>

                        {/* TTS Row */}
                        <div className="grid grid-cols-[55px_1fr_36px_85px_85px_65px] gap-2 items-center text-xs">
                          <span className="text-[11px] font-bold text-purple-400">TTS:</span>
                          
                          <input 
                            type="text"
                            value={p.ttsWord?.word || ''} 
                            placeholder="[Missing TTS word]"
                            onChange={e => updateTtsWord(p.id, { word: e.target.value })} 
                            className="bg-black/20 border border-white/10 rounded px-2 py-1 font-medium text-white outline-none focus:border-purple-500 placeholder:text-red-400/60"
                          />

                          <button 
                            onClick={() => p.ttsWord && playChunk('tts', p.ttsWord.start, p.ttsWord.end, ttsKey)}
                            disabled={!p.ttsWord}
                            className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all disabled:opacity-30 ${
                              isTtsPlaying 
                                ? 'bg-amber-500 text-black shadow-sm' 
                                : 'bg-purple-500/15 text-purple-400 hover:bg-purple-500/30'
                            }`}
                            title="Play TTS word"
                          >
                            {isTtsPlaying ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3 ml-0.5" />}
                          </button>

                          <MillisecondTimeInput 
                            value={p.ttsWord?.start || 0} 
                            disabled={!p.ttsWord}
                            onChange={val => updateTtsWord(p.id, { start: val })}
                            className="text-purple-300"
                          />

                          <MillisecondTimeInput 
                            value={p.ttsWord?.end || 0} 
                            disabled={!p.ttsWord}
                            onChange={val => updateTtsWord(p.id, { end: val })}
                            className="text-purple-300"
                          />

                          <span className="text-[10px] font-mono text-[var(--theme-text-muted)] text-center">
                            {tDur.toFixed(3)}s
                          </span>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>

              {/* Bottom Apply Action Bar */}
              <div className="pt-3.5 mt-2 border-t border-[var(--theme-border)] shrink-0 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-[11px] text-[var(--theme-text-muted)]">
                  <span className="font-bold text-white">{confirmedCount}</span> of {pairs.length} word groups confirmed. Unchecked groups will be skipped.
                </div>

                <button 
                  onClick={handleApply} 
                  disabled={confirmedCount === 0}
                  className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold tracking-wide transition-all shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  Apply {confirmedCount} Confirmed Words to Timeline
                </button>
              </div>

            </div>
          )}

        </div>
      </div>
    </div>
  );
};
