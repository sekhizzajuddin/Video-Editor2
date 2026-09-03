import React, { useState, useEffect, useRef } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { useShallow } from 'zustand/react/shallow';
import { X, Mic, Loader2, Play, FileText, Check, Plus, AlertCircle } from 'lucide-react';
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
  findMissingWordInGap
} from '@/utils/syncStudioEngine';

const CAPTION_LANGUAGES = [
  { code: 'EN', name: 'English' }, { code: 'HI', name: 'Hindi' }, { code: 'ES', name: 'Spanish' }
];

export const VoiceSyncStudioModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { tracks, mediaLibrary: allMedia, totalDuration } = useEditorStore(
    useShallow(s => ({
      tracks: s.tracks,
      mediaLibrary: s.mediaLibrary,
      totalDuration: s.totalDuration,
    }))
  );
  const mediaLibrary = allMedia.filter(m => m.type === 'audio' || m.type === 'video');

  // Multi-step State
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingText, setLoadingText] = useState('');

  // Step 1: Source
  const [sourceTrackIds, setSourceTrackIds] = useState<string[]>([]);
  const [rawScript, setRawScript] = useState('');
  const [language, setLanguage] = useState('EN');
  const [sourceBlob, setSourceBlob] = useState<Blob | null>(null);

  // Step 2: TTS & Match
  const [ttsMediaId, setTtsMediaId] = useState('');
  const [ttsBlob, setTtsBlob] = useState<Blob | null>(null);

  // Core Data
  const [pairs, setPairs] = useState<SyncWordPair[]>([]);

  // Audio Playback
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const activeUrlRef = useRef<string | null>(null);
  const playChunk = (blob: Blob | null, start: number, end: number) => {
    if (!blob) return;
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
    }
    if (activeUrlRef.current) {
      URL.revokeObjectURL(activeUrlRef.current);
      activeUrlRef.current = null;
    }
    const url = URL.createObjectURL(blob);
    activeUrlRef.current = url;
    const audio = new Audio(url);
    audio.currentTime = start;
    audio.play().catch(e => console.warn(e));
    
    const onTimeUpdate = () => {
      if (audio.currentTime >= end) {
        audio.pause();
        audio.removeEventListener('timeupdate', onTimeUpdate);
        URL.revokeObjectURL(url);
        activeUrlRef.current = null;
      }
    };
    audio.addEventListener('timeupdate', onTimeUpdate);
    activeAudioRef.current = audio;
  };

  useEffect(() => {
    return () => {
      if (activeAudioRef.current) activeAudioRef.current.pause();
      if (activeUrlRef.current) {
        URL.revokeObjectURL(activeUrlRef.current);
        activeUrlRef.current = null;
      }
    };
  }, []);

  const handleAnalyzeSource = async () => {
    if (sourceTrackIds.length === 0) return toast.error('Select at least one source track.');
    setIsProcessing(true);
    setLoadingText('Rendering Source Audio...');
    try {
      const blob = await extractAudioFromTracks(sourceTrackIds, totalDuration || 10);
      if (!blob) throw new Error("Failed to render tracks");
      setSourceBlob(blob);
      
      setLoadingText('Extracting Source Words...');
      const sWords = await analyzeSourceAudio(blob, language, rawScript);
      
      // Initialize pairs with just source words
      setPairs(sWords.map(w => ({
        id: crypto.randomUUID(),
        sourceWord: w,
        confirmed: false
      })));
      setStep(2);
    } catch (e: any) {
      toast.error(e.message || "Error analyzing source");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAnalyzeTts = async () => {
    if (!ttsMediaId) return toast.error('Select TTS Media.');
    if (!sourceBlob) return toast.error('Missing source audio.');
    setIsProcessing(true);
    setLoadingText('Rendering TTS Media...');
    try {
      const blob = await renderMediaItemToWav(ttsMediaId);
      setTtsBlob(blob);

      setLoadingText('Extracting TTS Words & Matching...');
      const sourceWords = pairs.map(p => p.sourceWord);
      const tWords = await analyzeTtsAudio(blob, language, sourceWords);
      
      const matchedPairs = pairWordsAlgorithm(sourceWords, tWords);
      setPairs(matchedPairs);
      setStep(3);
    } catch (e: any) {
      toast.error(e.message || "Error analyzing TTS");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApply = () => {
    try {
      // Find a clean target track or prompt to create one (For simplicity, just use first audio track or create)
      let targetTrackId = tracks.find(t => t.type === 'audio')?.id;
      if (!targetTrackId) {
        targetTrackId = crypto.randomUUID();
        useEditorStore.getState().addTrack('audio');
      }
      applyVoiceSyncToTimeline(targetTrackId, ttsMediaId, pairs);
      toast.success("Applied to timeline! Silent parts ignored, words rate-stretched.");
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleFallbackMissingWord = async (index: number) => {
    if (!sourceBlob || !ttsBlob) return;
    const prev = pairs[index - 1];
    const next = pairs[index];
    if (!prev || !next) return toast.error("Need surrounding pairs to interpolate");

    setIsProcessing(true);
    setLoadingText('Micro-analyzing gap...');
    try {
      const hint = window.prompt("What word is missing here?");
      if (!hint) { setIsProcessing(false); return; }

      const gap = await findMissingWordInGap(
        sourceBlob, ttsBlob,
        prev.sourceWord.end, next.sourceWord.start,
        prev.ttsWord?.end || 0, next.ttsWord?.start || 0,
        hint
      );

      const newPair: SyncWordPair = {
        id: crypto.randomUUID(),
        sourceWord: { id: crypto.randomUUID(), word: hint, start: gap.sourceStart, end: gap.sourceEnd },
        ttsWord: { id: crypto.randomUUID(), word: hint, start: gap.ttsStart, end: gap.ttsEnd },
        confirmed: true
      };

      const newPairs = [...pairs];
      newPairs.splice(index, 0, newPair);
      setPairs(newPairs);
      toast.success("Recovered missing word!");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const updatePair = (id: string, updates: Partial<SyncWordPair>) => {
    setPairs(pairs.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const updateSourceWord = (id: string, updates: Partial<SyncWord>) => {
    setPairs(pairs.map(p => p.id === id ? { ...p, sourceWord: { ...p.sourceWord, ...updates } } : p));
  };

  const updateTtsWord = (id: string, updates: Partial<SyncWord>) => {
    setPairs(pairs.map(p => p.id === id && p.ttsWord ? { ...p, ttsWord: { ...p.ttsWord, ...updates } } : p));
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[999] flex items-center justify-center backdrop-blur-sm p-4">
      <div className="bg-[var(--theme-bg-panel)] border border-[var(--theme-border)] rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden text-[var(--theme-text-primary)]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--theme-border)] bg-[var(--theme-bg-subpanel)] shrink-0">
          <div className="flex items-center gap-2 text-blue-500">
            <Mic className="w-5 h-5" />
            <h2 className="text-sm font-bold text-[var(--theme-text-primary)]">Voice Sync Studio</h2>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-bold">
            <span className={step >= 1 ? 'text-blue-500' : 'text-gray-500'}>1. Source</span>
            <span className="text-gray-600">â†’</span>
            <span className={step >= 2 ? 'text-blue-500' : 'text-gray-500'}>2. TTS Match</span>
            <span className="text-gray-600">â†’</span>
            <span className={step === 3 ? 'text-blue-500' : 'text-gray-500'}>3. Verify & Apply</span>
          </div>
          <button onClick={onClose} disabled={isProcessing} className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors disabled:opacity-50">
            <X className="w-4 h-4 text-[var(--theme-text-muted)]" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden relative">
          {isProcessing && (
            <div className="absolute inset-0 bg-[var(--theme-bg-panel)]/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-4" />
              <div className="text-xs font-bold">{loadingText}</div>
            </div>
          )}

          {step === 1 && (
            <div className="p-6 space-y-5 overflow-y-auto h-full">
              <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl text-[11px] text-blue-400 font-medium">
                Step 1: Select the timeline tracks containing your original video/audio, and optionally provide a raw script to force perfect word detection.
              </div>

              <div>
                <label className="block text-xs font-semibold mb-2 text-[var(--theme-text-secondary)]">Source Tracks</label>
                <div className="space-y-1.5 max-h-32 overflow-y-auto p-2 bg-[var(--theme-bg-subpanel)] rounded-lg border border-[var(--theme-border)]">
                  {tracks.map(t => (
                    <label key={t.id} className="flex items-center gap-2 text-[11px] cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={sourceTrackIds.includes(t.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSourceTrackIds([...sourceTrackIds, t.id]);
                          else setSourceTrackIds(sourceTrackIds.filter(id => id !== t.id));
                        }}
                      />
                      <span className="truncate">{t.name || t.type} (ID: {t.id.slice(0,4)})</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-2 text-[var(--theme-text-secondary)]">Language</label>
                <select value={language} onChange={e => setLanguage(e.target.value)} className="w-full bg-[var(--theme-bg-subpanel)] border border-[var(--theme-border)] rounded-lg p-2 text-xs">
                  {CAPTION_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-2 text-[var(--theme-text-secondary)]">Raw Script (Optional)</label>
                <textarea 
                  value={rawScript} onChange={e => setRawScript(e.target.value)}
                  placeholder="Paste script here for 100% accurate AI word parsing..."
                  className="w-full bg-[var(--theme-bg-subpanel)] border border-[var(--theme-border)] rounded-lg p-2.5 text-xs h-24"
                />
              </div>

              <button onClick={handleAnalyzeSource} className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all">
                Analyze Source Words
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="p-6 space-y-5 overflow-y-auto h-full flex flex-col">
              <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl text-[11px] text-purple-400 font-medium shrink-0">
                Step 2: Review extracted source words. Select a TTS file from your media library to pair them with.
              </div>

              <div className="shrink-0">
                <label className="block text-xs font-semibold mb-2 text-[var(--theme-text-secondary)]">TTS Media File</label>
                <select value={ttsMediaId} onChange={e => setTtsMediaId(e.target.value)} className="w-full bg-[var(--theme-bg-subpanel)] border border-[var(--theme-border)] rounded-lg p-2 text-xs">
                  <option value="" disabled>Select TTS Audio...</option>
                  {mediaLibrary.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>

              <div className="flex-1 min-h-0 border border-[var(--theme-border)] rounded-xl overflow-hidden flex flex-col bg-[var(--theme-bg-subpanel)]">
                <div className="grid grid-cols-4 gap-2 p-2 border-b border-[var(--theme-border)] bg-[var(--theme-bg-panel)] text-[10px] font-bold text-[var(--theme-text-secondary)]">
                  <span>Word</span>
                  <span>Play</span>
                  <span>Start (s)</span>
                  <span>End (s)</span>
                </div>
                <div className="overflow-y-auto p-2 space-y-1">
                  {pairs.map(p => (
                    <div key={p.id} className="grid grid-cols-4 gap-2 items-center text-[11px] p-1.5 hover:bg-white/5 rounded-md">
                      <input 
                        value={p.sourceWord.word} onChange={e => updateSourceWord(p.id, { word: e.target.value })}
                        className="bg-transparent border-none outline-none font-medium text-[var(--theme-text-primary)]"
                      />
                      <button onClick={() => playChunk(sourceBlob, p.sourceWord.start, p.sourceWord.end)} className="w-6 h-6 flex items-center justify-center rounded bg-blue-500/20 text-blue-500 hover:bg-blue-500/40">
                        <Play className="w-3 h-3" />
                      </button>
                      <input type="number" step="0.1" value={p.sourceWord.start} onChange={e => updateSourceWord(p.id, { start: parseFloat(e.target.value) })} className="bg-black/20 px-2 py-1 rounded" />
                      <input type="number" step="0.1" value={p.sourceWord.end} onChange={e => updateSourceWord(p.id, { end: parseFloat(e.target.value) })} className="bg-black/20 px-2 py-1 rounded" />
                    </div>
                  ))}
                </div>
              </div>

              <button onClick={handleAnalyzeTts} className="w-full shrink-0 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all">
                Match with TTS
              </button>
            </div>
          )}

          {step === 3 && (
            <div className="h-full flex flex-col p-4">
              <div className="flex justify-between items-center mb-3 shrink-0">
                <div className="text-[11px] text-[var(--theme-text-muted)]">
                  Verify pairs, click Add to recover missing words via targeted AI micro-analysis. Rate stretch will be auto-applied.
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setPairs(pairs.map(p => ({...p, confirmed: true})))} className="px-3 py-1.5 bg-green-500/20 text-green-500 rounded text-[10px] font-bold">Check All</button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto border border-[var(--theme-border)] rounded-xl bg-[var(--theme-bg-subpanel)] p-2 space-y-2">
                {pairs.map((p, index) => {
                  const ttsDuration = p.ttsWord ? (p.ttsWord.end - p.ttsWord.start) : 0;
                  const sourceDuration = (p.sourceWord.end - p.sourceWord.start);
                  const gap = ttsDuration - sourceDuration;

                  return (
                    <React.Fragment key={p.id}>
                      {index > 0 && (
                        <div className="flex justify-center -my-1 relative z-10">
                          <button onClick={() => handleFallbackMissingWord(index)} className="px-2 py-0.5 bg-blue-600 hover:bg-blue-500 text-white text-[9px] rounded-full flex items-center gap-1 shadow-md">
                            <Plus className="w-3 h-3" /> Add Missing Word
                          </button>
                        </div>
                      )}
                      <div className={`p-3 rounded-xl border ${p.confirmed ? 'border-green-500/30 bg-green-500/5' : 'border-[var(--theme-border)] bg-[var(--theme-bg-panel)]'}`}>
                        <div className="flex items-center gap-3 mb-2">
                          <input type="checkbox" checked={p.confirmed} onChange={e => updatePair(p.id, { confirmed: e.target.checked })} className="w-4 h-4 rounded border-[var(--theme-border)] text-green-500 focus:ring-green-500" />
                          <span className="text-xs font-bold">Group {index + 1}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded ${gap > 0.5 ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                            Gap: {gap > 0 ? '+' : ''}{gap.toFixed(2)}s
                          </span>
                        </div>

                        {/* Source Row */}
                        <div className="grid grid-cols-[60px_1fr_40px_60px_60px] gap-2 items-center text-[10px] mb-1.5">
                          <span className="text-[var(--theme-text-muted)]">Source:</span>
                          <input value={p.sourceWord.word} onChange={e => updateSourceWord(p.id, { word: e.target.value })} className="bg-transparent font-medium border-b border-transparent focus:border-blue-500 outline-none" />
                          <button onClick={() => playChunk(sourceBlob, p.sourceWord.start, p.sourceWord.end)} className="p-1 rounded bg-black/20 hover:bg-blue-500/20 text-blue-400 flex justify-center"><Play className="w-3 h-3" /></button>
                          <input type="number" step="0.1" value={p.sourceWord.start} onChange={e => updateSourceWord(p.id, { start: parseFloat(e.target.value) })} className="bg-black/20 px-1.5 py-0.5 rounded text-center" />
                          <input type="number" step="0.1" value={p.sourceWord.end} onChange={e => updateSourceWord(p.id, { end: parseFloat(e.target.value) })} className="bg-black/20 px-1.5 py-0.5 rounded text-center" />
                        </div>

                        {/* TTS Row */}
                        <div className="grid grid-cols-[60px_1fr_40px_60px_60px] gap-2 items-center text-[10px]">
                          <span className="text-[var(--theme-text-muted)]">TTS:</span>
                          <input value={p.ttsWord?.word || ''} onChange={e => updateTtsWord(p.id, { word: e.target.value })} className="bg-transparent font-medium border-b border-transparent focus:border-blue-500 outline-none" />
                          <button onClick={() => playChunk(ttsBlob, p.ttsWord?.start || 0, p.ttsWord?.end || 0)} disabled={!p.ttsWord} className="p-1 rounded bg-black/20 hover:bg-blue-500/20 text-blue-400 flex justify-center disabled:opacity-30"><Play className="w-3 h-3" /></button>
                          <input type="number" step="0.1" value={p.ttsWord?.start || 0} onChange={e => updateTtsWord(p.id, { start: parseFloat(e.target.value) })} className="bg-black/20 px-1.5 py-0.5 rounded text-center" />
                          <input type="number" step="0.1" value={p.ttsWord?.end || 0} onChange={e => updateTtsWord(p.id, { end: parseFloat(e.target.value) })} className="bg-black/20 px-1.5 py-0.5 rounded text-center" />
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>

              <div className="mt-4 shrink-0">
                <button onClick={handleApply} disabled={!pairs.some(p => p.confirmed)} className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center gap-2">
                  <Check className="w-4 h-4" /> Apply Confirmed Words to Timeline
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
