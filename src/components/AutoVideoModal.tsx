import React, { useState, useRef } from 'react';
import {
  X, Loader2, Wand2, Mic, Settings, Play, Type,
  Upload, Music, Volume2
} from 'lucide-react';
import { useEditorStore } from '../store/editorStore';
import { useShallow } from 'zustand/react/shallow';
import { toast } from 'sonner';
import { generateAutoVideoBlueprintV2, AutoVideoBlueprintV2 } from '../utils/aiClient';
import { AutoVoxBlueprintView } from './AutoVoxBlueprintView';

const newId = () => crypto.randomUUID();

interface AutoVideoModalProps {
  onClose: () => void;
}

// PIP stagger layout: pip index → {x%, y%, scale%}
const PIP_OFFSETS = [
  { x: -25, y: 12,  scale: 74 },
  { x:  26, y: -6,  scale: 74 },
  { x:   0, y: -24, scale: 70 },
  { x: -34, y: -18, scale: 65 },
];

export function AutoVideoModal({ onClose }: AutoVideoModalProps) {
  const { settings, addMedia, addClip, addTrack } = useEditorStore(
    useShallow((s) => ({
      settings:  s.settings,
      addMedia:  s.addMedia,
      addClip:   s.addClip,
      addTrack:  s.addTrack,
    }))
  );

  const geminiApiKey = settings?.geminiApiKey || import.meta.env.VITE_GEMINI_API_KEY;

  // ── Inputs ────────────────────────────────────────────────────────────────
  const [script,           setScript]           = useState('');
  const [audioFile,        setAudioFile]        = useState<File | null>(null);
  const [ttsVoice,         setTtsVoice]         = useState('en-US-AriaNeural');
  const [visualStyle,      setVisualStyle]      = useState('vox_vintage');
  const [customInstructions, setCustomInstructions] = useState('');
  const [characterRef,     setCharacterRef]     = useState<string | null>(null);

  // ── Audio state ───────────────────────────────────────────────────────────
  const [audioMediaId,      setAudioMediaId]      = useState<string | null>(null);
  const [audioDuration,     setAudioDuration]     = useState(0);
  const [wordTimestamps,    setWordTimestamps]    = useState<{ word: string; start: number; end: number }[]>([]);
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(null);

  // ── Blueprint ─────────────────────────────────────────────────────────────
  const [blueprint, setBlueprint] = useState<AutoVideoBlueprintV2 | null>(null);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [isGeneratingBP,    setIsGeneratingBP]    = useState(false);
  const [isAssembling,      setIsAssembling]      = useState(false);
  const [status,   setStatus]   = useState('');
  const [progress, setProgress] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const charInputRef = useRef<HTMLInputElement>(null);

  const isBusy = isGeneratingAudio || isGeneratingBP || isAssembling;

  // ── Step 1a: TTS Audio ────────────────────────────────────────────────────
  const handleGenerateAudio = async () => {
    if (!script.trim()) { toast.error('Please enter a script first.'); return; }
    setIsGeneratingAudio(true);
    setStatus('Generating voiceover…');
    setProgress(10);
    try {
      const resp = await fetch(`/api/tts?text=${encodeURIComponent(script)}&voice=${ttsVoice}&rate=1&pitch=1`);
      if (!resp.ok) throw new Error('TTS API request failed. Check your server connection.');
      const blob = await resp.blob();
      const objUrl = URL.createObjectURL(blob);
      const mid = `tts_${Date.now()}`;

      const dur: number = await new Promise((res) => {
        const a = new Audio(objUrl);
        a.onloadedmetadata = () => res(isFinite(a.duration) ? a.duration : 10);
        a.onerror = () => res(10);
        setTimeout(() => res(10), 3000);
      });

      addMedia(
        { id: mid, name: 'Voiceover (AI)', type: 'audio', duration: dur, url: objUrl, createdAt: Date.now() },
        new File([blob], `${mid}.mp3`, { type: blob.type || 'audio/mp3' })
      );

      // Mock word timestamps (evenly distributed)
      const words = script.split(/\s+/).filter(Boolean);
      const tpw   = dur / Math.max(words.length, 1);
      const ts    = words.map((w, i) => ({ word: w, start: i * tpw, end: (i + 1) * tpw }));

      setAudioMediaId(mid);
      setAudioDuration(dur);
      setWordTimestamps(ts);
      setGeneratedAudioUrl(objUrl);
      setProgress(100);
      toast.success(`Audio generated (${dur.toFixed(1)}s). Now click "Generate Blueprint".`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsGeneratingAudio(false);
      setTimeout(() => { setProgress(0); setStatus(''); }, 1500);
    }
  };

  // ── Step 1b: Upload audio ─────────────────────────────────────────────────
  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];
    setAudioFile(file);
    const objUrl = URL.createObjectURL(file);
    const dur: number = await new Promise((res) => {
      const a = new Audio(objUrl);
      a.onloadedmetadata = () => res(isFinite(a.duration) ? a.duration : 30);
      a.onerror = () => res(30);
      setTimeout(() => res(30), 3000);
    });
    const mid = `uploaded_audio_${Date.now()}`;
    addMedia({ id: mid, name: file.name, type: 'audio', duration: dur, url: objUrl, createdAt: Date.now() }, file);
    // Estimate word timestamps
    const wc  = Math.max(1, Math.round(dur * 2.5));
    const tpw = dur / wc;
    const ts  = Array.from({ length: wc }, (_, i) => ({ word: `w${i}`, start: i * tpw, end: (i + 1) * tpw }));
    setAudioMediaId(mid);
    setAudioDuration(dur);
    setWordTimestamps(ts);
    setGeneratedAudioUrl(objUrl);
    toast.success(`Audio loaded (${dur.toFixed(1)}s). Now click "Generate Blueprint".`);
  };

  // ── Step 2: Generate Blueprint ────────────────────────────────────────────
  const handleGenerateBlueprint = async () => {
    if (!geminiApiKey) { toast.error('Gemini API key required. Check Settings.'); return; }
    if (!audioMediaId || wordTimestamps.length === 0) {
      toast.error('Generate or upload the audio first (Step 1).');
      return;
    }
    setIsGeneratingBP(true);
    setStatus('AI is analysing your script and building the blueprint…');
    setProgress(20);
    try {
      const bp = await generateAutoVideoBlueprintV2(
        script,
        wordTimestamps,
        audioDuration,
        geminiApiKey,
        customInstructions || undefined,
        characterRef ? 'Use provided character reference.' : undefined,
        visualStyle
      );
      if (!bp || !Array.isArray(bp.scenes) || bp.scenes.length === 0) {
        throw new Error('AI returned an empty blueprint. Please try again.');
      }
      setBlueprint(bp);
      setProgress(100);
      toast.success(`Blueprint ready — ${bp.scenes.length} dialogues, ${bp.globalBackgrounds.length} backgrounds.`);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message);
    } finally {
      setIsGeneratingBP(false);
      setTimeout(() => { setProgress(0); setStatus(''); }, 1500);
    }
  };

  // ── Step 3: Assemble Timeline ─────────────────────────────────────────────
  const handleAssemble = async () => {
    if (!blueprint || !audioMediaId) {
      toast.error('Generate the blueprint first.');
      return;
    }

    const accountId = settings?.cloudflareAccountId || import.meta.env.VITE_CLOUDFLARE_ACCOUNT_ID;
    const apiToken  = settings?.cloudflareApiToken  || import.meta.env.VITE_CLOUDFLARE_API_TOKEN;
    if (!accountId || !apiToken) {
      toast.error('Cloudflare API credentials are required. Check Settings → Cloudflare.');
      return;
    }

    // Pick a local folder to store generated images
    let dirHandle: FileSystemDirectoryHandle | null = null;
    try {
      dirHandle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
    } catch {
      toast.error('Local folder access denied. Assembly cancelled.');
      return;
    }

    setIsAssembling(true);
    setProgress(5);
    setStatus('Starting assembly…');

    try {
      const cfUrl = `/cf-api/accounts/${accountId}/ai/run/@cf/stabilityai/stable-diffusion-xl-base-1.0`;

      // Helper: generate image via Cloudflare SDXL (with 1 retry)
      const fetchCfImage = async (prompt: string): Promise<Blob> => {
        for (let attempt = 1; attempt <= 2; attempt++) {
          const res = await fetch(cfUrl, {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt }),
          });
          if (!res.ok) {
            if (attempt === 2) throw new Error(`Cloudflare HTTP ${res.status}`);
            await new Promise(r => setTimeout(r, 2000));
            continue;
          }
          const blob = await res.blob();
          if (blob.size < 500) throw new Error('Empty image response from Cloudflare');
          return blob;
        }
        throw new Error('Failed to generate image');
      };

      // Helper: if resolvedUrl is a blob: URL already in memory, re-fetch its blob
      const getBlobFromUrl = async (blobUrl: string): Promise<Blob> => {
        const res = await fetch(blobUrl);
        return res.blob();
      };

      // Helper: save blob to local folder + register media, return mediaId
      const saveImage = async (blob: Blob, name: string, duration: number): Promise<string> => {
        const filename = `${name}_${Date.now()}.jpg`;
        const fh = await dirHandle!.getFileHandle(filename, { create: true });
        const wr = await fh.createWritable();
        await wr.write(blob);
        await wr.close();
        const localFile = await fh.getFile();
        const url = URL.createObjectURL(localFile);
        const mid = `auto_${newId()}`;
        addMedia({ id: mid, name, type: 'image', duration, url, createdAt: Date.now() }, localFile);
        return mid;
      };

      // ── Ensure we have enough video tracks ───────────────────────────────
      // We need: Track 0 (v1) = BG, Tracks 1..maxPips = PIPs, one text track, one audio track
      const maxPips = blueprint.scenes.reduce((m, s) => Math.max(m, s.pipItems.length), 0);

      // Get current state of tracks (fresh from store)
      const getStoreTracks = () => useEditorStore.getState().tracks;

      // Helper: ensure at least N video tracks exist, return their IDs (0-indexed)
      const ensureVideoTracks = (needed: number): string[] => {
        let vTracks = getStoreTracks().filter(t => t.type === 'video');
        while (vTracks.length < needed) {
          addTrack('video');
          vTracks = getStoreTracks().filter(t => t.type === 'video');
        }
        return vTracks.map(t => t.id);
      };

      // Helper: ensure at least one text track exists, return its ID
      const ensureTextTrack = (): string => {
        let tTracks = getStoreTracks().filter(t => t.type === 'text');
        if (tTracks.length === 0) {
          addTrack('text');
          tTracks = getStoreTracks().filter(t => t.type === 'text');
        }
        return tTracks[0].id;
      };

      // Helper: ensure at least one audio track exists, return its ID
      const ensureAudioTrack = (): string => {
        let aTracks = getStoreTracks().filter(t => t.type === 'audio');
        if (aTracks.length === 0) {
          addTrack('audio');
          aTracks = getStoreTracks().filter(t => t.type === 'audio');
        }
        return aTracks[0].id;
      };

      // Need: 1 BG track + maxPips PIP tracks = maxPips + 1 video tracks total
      const videoTrackIds = ensureVideoTracks(maxPips + 1);
      const bgTrackId     = videoTrackIds[0];
      const textTrackId   = ensureTextTrack();
      const audioTrackId  = ensureAudioTrack();

      const totalScenes = blueprint.scenes.length;

      // ── STEP A: Download all required backgrounds ─────────────────────────
      setStatus('Generating global backgrounds…');
      const bgMediaIds: Record<number, string> = {};
      const usedBgIndices = [...new Set(blueprint.scenes.map(s => s.selectedBackgroundIndex))];

      for (let i = 0; i < usedBgIndices.length; i++) {
        const bgIdx = usedBgIndices[i];
        const bg = blueprint.globalBackgrounds[bgIdx];
        if (!bg) continue;
        setStatus(`Generating background ${bgIdx + 1}/${blueprint.globalBackgrounds.length}…`);
        setProgress(5 + (i / usedBgIndices.length) * 10);

        try {
          let blob: Blob;
          if (bg.resolvedUrl?.startsWith('blob:')) {
            blob = await getBlobFromUrl(bg.resolvedUrl);
          } else {
            blob = await fetchCfImage(bg.prompt);
          }
          bgMediaIds[bgIdx] = await saveImage(blob, `bg_${bgIdx}`, audioDuration);
        } catch (e: any) {
          console.warn(`Background ${bgIdx} failed:`, e);
          toast(`Background ${bgIdx + 1} failed to generate — scene will use no background.`, { icon: '⚠️' });
        }
      }

      // ── STEP B: Process each dialogue scene ──────────────────────────────
      for (let sIdx = 0; sIdx < totalScenes; sIdx++) {
        const scene = blueprint.scenes[sIdx];
        const pctStart = 15 + (sIdx / totalScenes) * 75;
        setProgress(Math.round(pctStart));
        setStatus(`Scene ${sIdx + 1}/${totalScenes}: Adding background clip…`);

        // B1: Background clip on videoTrackIds[0]
        const bgMid = bgMediaIds[scene.selectedBackgroundIndex];
        if (bgMid) {
          addClip({
            id:           `clip_bg_${newId()}`,
            mediaId:      bgMid,
            trackId:      bgTrackId,
            startTime:    scene.startTime,
            duration:     scene.duration,
            trimStart:    0,
            trimEnd:      0,
            opacity:      1,
            speed:        1,
            effects:      [],
            transform:    { x: 0, y: 0, scale: 100, rotation: 0 },
            animations:   {
              'transform.scale': [
                { time: 0,              value: 100 },
                { time: scene.duration, value: 108 },
              ],
            },
          });
        }

        // B2: PIP clips on videoTrackIds[1], [2], [3], …
        for (let pIdx = 0; pIdx < scene.pipItems.length; pIdx++) {
          const pip  = scene.pipItems[pIdx];
          const tOff = PIP_OFFSETS[pIdx] ?? PIP_OFFSETS[0];
          const pipTrackId = videoTrackIds[pIdx + 1];
          if (!pipTrackId) continue;

          setStatus(`Scene ${sIdx + 1}/${totalScenes}: PIP ${pIdx + 1}/${scene.pipItems.length}…`);

          try {
            let blob: Blob;
            if (pip.resolvedUrl?.startsWith('blob:')) {
              blob = await getBlobFromUrl(pip.resolvedUrl);
            } else {
              blob = await fetchCfImage(pip.prompt);
            }

            const pipMid = await saveImage(blob, `pip_s${sIdx}_p${pIdx}`, scene.duration);

            addClip({
              id:           `clip_pip_${newId()}`,
              mediaId:      pipMid,
              trackId:      pipTrackId,
              startTime:    scene.startTime,
              duration:     scene.duration,
              trimStart:    0,
              trimEnd:      0,
              opacity:      1,
              speed:        1,
              effects:      [],
              transform:    {
                x:        tOff.x,
                y:        tOff.y + 18,
                scale:    tOff.scale - 5,
                rotation: 0,
              },
              chromaKey: {
                enabled:   true,
                color:     '#00ff00',
                threshold: 40,
                softness:  20,
              },
              animations: {
                'transform.y': [
                  { time: 0,                                value: tOff.y + 18, easing: 'easeOut' },
                  { time: Math.min(0.6, scene.duration),   value: tOff.y,      easing: 'linear'  },
                  { time: scene.duration,                  value: tOff.y - 8              },
                ],
                'transform.scale': [
                  { time: 0,                                value: tOff.scale - 5, easing: 'easeOut' },
                  { time: Math.min(0.6, scene.duration),   value: tOff.scale,     easing: 'linear'  },
                  { time: scene.duration,                  value: tOff.scale + 4              },
                ],
              },
            });
          } catch (e: any) {
            console.warn(`PIP scene ${sIdx} / pip ${pIdx} failed:`, e);
          }
        }

        // B3: Subtitle / caption text clip
        const textMid = `text_${newId()}`;
        addMedia({
          id:          textMid,
          name:        scene.narration.slice(0, 25) + (scene.narration.length > 25 ? '…' : ''),
          type:        'text',
          duration:    scene.duration,
          url:         '',
          createdAt:   Date.now(),
          textContent: scene.narration,
        });

        addClip({
          id:          `clip_txt_${newId()}`,
          mediaId:     textMid,
          trackId:     textTrackId,
          startTime:   scene.startTime,
          duration:    scene.duration,
          trimStart:   0,
          trimEnd:     0,
          opacity:     1,
          speed:       1,
          effects:     [],
          transform:   { x: 0, y: 38, scale: 100, rotation: 0 },
          textSettings: {
            text:            scene.narration,
            fontFamily:      'Inter',
            fontSize:        30,
            color:           '#ffffff',
            backgroundColor: 'rgba(0,0,0,0.55)',
            bold:            true,
            italic:          false,
            underline:       false,
            shadow:          true,
            shadowColor:     '#000000',
            shadowBlur:      8,
            textAlign:       'center',
          },
          zIndex: 9999,
        });
      }

      // ── STEP C: Audio clip ────────────────────────────────────────────────
      setStatus('Adding voiceover to timeline…');
      setProgress(92);

      addClip({
        id:        `clip_audio_${newId()}`,
        mediaId:   audioMediaId,
        trackId:   audioTrackId,
        startTime: 0,
        duration:  audioDuration,
        trimStart: 0,
        trimEnd:   0,
        opacity:   1,
        speed:     1,
        effects:   [],
        transform: { x: 0, y: 0, scale: 100, rotation: 0 },
      });

      setProgress(100);
      setStatus('Done! ✓');
      toast.success(`Video assembled! ${totalScenes} scenes, ${audioDuration.toFixed(1)}s timeline.`);
      setTimeout(onClose, 1200);

    } catch (e: any) {
      console.error(e);
      toast.error(`Assembly failed: ${e.message}`);
    } finally {
      setIsAssembling(false);
    }
  };

  const handleCharRefUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const reader = new FileReader();
    reader.onload = (ev) => { if (ev.target?.result) setCharacterRef(ev.target.result as string); };
    reader.readAsDataURL(e.target.files[0]);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl w-full max-w-6xl h-[88vh] shadow-2xl flex flex-col overflow-hidden">

        {/* ── Header ───────────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a2a] bg-[#1a1a1a] shrink-0">
          <div className="flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-indigo-400" />
            <h2 className="text-sm font-semibold text-white">Vox-Style Auto Video</h2>
          </div>
          <button
            onClick={onClose}
            disabled={isBusy}
            className="p-1 text-[#6a6a6a] hover:text-white rounded hover:bg-white/10 disabled:opacity-50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Body ─────────────────────────────────────────── */}
        <div className="flex flex-1 overflow-hidden">

          {/* ── LEFT: Controls ───────────────────────────── */}
          <div className="w-72 min-w-[272px] border-r border-[#2a2a2a] bg-[#171717] flex flex-col p-4 gap-3 overflow-y-auto shrink-0">

            {/* Script */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[#a0a0a0] flex items-center gap-1.5">
                <Type className="w-3.5 h-3.5" /> Script
              </label>
              <textarea
                value={script}
                onChange={(e) => setScript(e.target.value)}
                placeholder="Paste your raw script here…"
                disabled={isBusy}
                className="w-full h-28 bg-[#1e1e1e] border border-[#3e3e3e] rounded-lg px-3 py-2 text-xs text-white focus:border-indigo-500 outline-none resize-none disabled:opacity-60"
              />
            </div>

            {/* Audio Upload */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[#a0a0a0] flex items-center gap-1.5">
                <Music className="w-3.5 h-3.5" /> Upload Audio (optional)
              </label>
              <input type="file" accept="audio/*" ref={fileInputRef} onChange={handleAudioUpload} className="hidden" />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isBusy}
                className="w-full bg-[#1e1e1e] border border-dashed border-[#3e3e3e] hover:border-indigo-500 rounded-lg p-2.5 flex flex-col items-center justify-center gap-1 transition-colors disabled:opacity-60"
              >
                <Upload className="w-4 h-4 text-[#6a6a6a]" />
                <span className="text-xs text-[#8a8a8a]">{audioFile ? audioFile.name : 'Upload Audio File'}</span>
              </button>
            </div>

            {/* Generated Audio Preview */}
            {generatedAudioUrl && (
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wider flex items-center gap-1">
                  <Volume2 className="w-3 h-3" /> Audio · {audioDuration.toFixed(1)}s
                </label>
                <audio controls src={generatedAudioUrl} className="w-full h-8 rounded" />
              </div>
            )}

            {/* Voice selector */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[#a0a0a0]">Voice Actor</label>
              <select
                value={ttsVoice}
                onChange={(e) => setTtsVoice(e.target.value)}
                disabled={isBusy}
                className="w-full bg-[#1e1e1e] border border-[#3e3e3e] rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-indigo-500 disabled:opacity-60"
              >
                <option value="en-US-AriaNeural">Aria (Female EN)</option>
                <option value="en-US-GuyNeural">Guy (Male EN)</option>
                <option value="hi-IN-SwaraNeural">Swara (Hindi Female)</option>
                <option value="hi-IN-MadhurNeural">Madhur (Hindi Male)</option>
              </select>
            </div>

            {/* Visual Style */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[#a0a0a0]">Visual Style</label>
              <select
                value={visualStyle}
                onChange={(e) => setVisualStyle(e.target.value)}
                disabled={isBusy}
                className="w-full bg-[#1e1e1e] border border-[#3e3e3e] rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-indigo-500 disabled:opacity-60"
              >
                <option value="vox_vintage">Vox Documentary (Vintage Collage)</option>
                <option value="vox_realistic">Vox Documentary (Realistic)</option>
                <option value="style_anime">Anime (AI Gen)</option>
                <option value="style_watercolor">Watercolor (AI Gen)</option>
                <option value="style_papercut">Papercut (AI Gen)</option>
              </select>
            </div>

            {/* Character Ref */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[#a0a0a0] flex items-center justify-between">
                <span>Character Ref <span className="text-[#5a5a5a]">(optional)</span></span>
                {characterRef && (
                  <button onClick={() => setCharacterRef(null)} className="text-red-400 hover:text-red-300 text-[10px]">
                    Remove
                  </button>
                )}
              </label>
              <input type="file" accept="image/*" ref={charInputRef} onChange={handleCharRefUpload} className="hidden" />
              <div
                onClick={() => !characterRef && charInputRef.current?.click()}
                className={`w-full h-14 bg-[#1e1e1e] border border-dashed rounded-lg flex items-center justify-center overflow-hidden transition-colors ${characterRef ? 'border-[#3e3e3e]' : 'border-[#3e3e3e] hover:border-indigo-500 cursor-pointer'}`}
              >
                {characterRef
                  ? <img src={characterRef} alt="Char ref" className="w-full h-full object-cover" />
                  : <span className="text-[10px] text-[#6a6a6a]">Upload style reference</span>
                }
              </div>
            </div>

            {/* Custom Instructions */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[#a0a0a0]">Custom AI Instructions</label>
              <textarea
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                placeholder="E.g. Dark moody thriller, neon colors…"
                disabled={isBusy}
                className="w-full h-12 bg-[#1e1e1e] border border-[#3e3e3e] rounded-lg px-3 py-2 text-xs text-white focus:border-indigo-500 outline-none resize-none disabled:opacity-60"
              />
            </div>

            {/* ── CTA Buttons ─────────────────────── */}
            <div className="mt-auto pt-2 flex flex-col gap-2">
              {/* Step 1: Generate Audio */}
              <button
                onClick={handleGenerateAudio}
                disabled={isBusy || !script.trim()}
                className="w-full py-2.5 bg-violet-700 hover:bg-violet-600 disabled:opacity-50 text-white text-xs font-medium rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                {isGeneratingAudio ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
                {generatedAudioUrl ? 'Regenerate Audio' : '1. Generate Audio'}
              </button>

              {/* Step 2: Generate Blueprint */}
              <button
                onClick={handleGenerateBlueprint}
                disabled={isBusy || !audioMediaId}
                className="w-full py-2.5 bg-[#2a2a2a] hover:bg-[#333] border border-[#3e3e3e] hover:border-indigo-600 disabled:opacity-50 text-white text-xs font-medium rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                {isGeneratingBP ? <Loader2 className="w-4 h-4 animate-spin" /> : <Settings className="w-4 h-4" />}
                {audioMediaId ? '2. Generate Blueprint' : '2. Generate Blueprint (need audio)'}
              </button>
            </div>
          </div>

          {/* ── RIGHT: Blueprint Preview ──────────────── */}
          <div className="flex-1 bg-[#141414] flex flex-col relative overflow-hidden">

            {/* Top bar */}
            <div className="px-4 py-3 border-b border-[#2a2a2a] flex items-center justify-between bg-[#1a1a1a] shrink-0">
              <h3 className="text-sm font-semibold text-white">
                {blueprint ? `Blueprint · ${blueprint.scenes.length} Dialogues` : 'Scene Blueprint'}
              </h3>
              {blueprint && !isAssembling && (
                <button
                  onClick={handleAssemble}
                  disabled={isBusy}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg flex items-center gap-2 transition-colors shadow-lg shadow-indigo-900/30"
                >
                  <Play className="w-3.5 h-3.5" />
                  Assemble Video
                </button>
              )}
              {isAssembling && (
                <div className="flex items-center gap-2 text-xs text-indigo-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Assembling…
                </div>
              )}
            </div>

            {/* Blueprint content */}
            <div className="flex-1 overflow-y-auto p-4">
              {!blueprint && !isGeneratingBP && (
                <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-indigo-900/20 border border-indigo-800/30 flex items-center justify-center">
                    <Wand2 className="w-7 h-7 text-indigo-400" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white mb-1">Ready to Build</div>
                    <div className="text-xs text-[#6a6a6a] max-w-xs leading-relaxed">
                      {!generatedAudioUrl
                        ? 'Paste your script → click "Generate Audio" → then "Generate Blueprint".'
                        : 'Audio is ready. Click "Generate Blueprint" to create your scene plan.'}
                    </div>
                  </div>
                </div>
              )}

              {isGeneratingBP && (
                <div className="flex flex-col items-center justify-center h-full gap-3">
                  <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                  <div className="text-sm text-white font-medium">{status || 'Building blueprint…'}</div>
                  <div className="text-xs text-[#6a6a6a]">AI is analysing script and creating dialogue scenes…</div>
                </div>
              )}

              {blueprint && (
                <AutoVoxBlueprintView
                  blueprint={blueprint}
                  onChange={setBlueprint}
                  disabled={isBusy}
                />
              )}
            </div>

            {/* Progress bar overlay during assembly */}
            {isAssembling && (
              <div className="absolute bottom-4 left-4 right-4 bg-[#1e1e1e] border border-[#3e3e3e] rounded-xl p-3.5 shadow-2xl">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-white font-medium truncate pr-4">{status}</span>
                  <span className="text-[#6a6a6a] shrink-0">{progress}%</span>
                </div>
                <div className="w-full h-1.5 bg-[#141414] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-600 to-violet-500 rounded-full transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
