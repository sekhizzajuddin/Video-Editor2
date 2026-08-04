import React, { useState, useRef } from 'react';
import { X, Loader2, Wand2, Mic, Settings, Play, Type, Image as ImageIcon, Map, Video, Upload, Music } from 'lucide-react';
import { useEditorStore } from '../store/editorStore';
import { useShallow } from 'zustand/react/shallow';
import { toast } from 'sonner';
import { generateAutoVideoBlueprint, alignScriptToAudio, AutoVideoBlueprint, generateSourceAdaptivePrompt } from '../utils/aiClient';
import { fetchStockVisualOptionsForScene, generatePollinationsImageWithReference } from '../utils/pexelsClient';
import { AutoVideoSceneList } from './AutoVideoSceneList';
import { AutoVideoPreviewTrimmer } from './AutoVideoPreviewTrimmer';

const uuidv4 = () => crypto.randomUUID();

interface AutoVideoModalProps {
  onClose: () => void;
}

export function AutoVideoModal({ onClose }: AutoVideoModalProps) {
  const { settings, addMedia, addClip, tracks } = useEditorStore(useShallow(s => ({
    settings: s.settings,
    addMedia: s.addMedia,
    addClip: s.addClip,
    tracks: s.tracks
  })));

  const geminiApiKey = (settings as any)?.geminiApiKey || import.meta.env.VITE_GEMINI_API_KEY;
  const pexelsApiKey = (settings as any)?.pexelsApiKey || import.meta.env.VITE_PEXELS_API_KEY;
  const groqApiKey = (settings as any)?.groqApiKey || import.meta.env.VITE_GROQ_API_KEY;

  const [activeTab, setActiveTab] = useState<'script' | 'audio' | 'both'>('script');
  
  // Inputs
  const [script, setScript] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  
  // Generation Options
  const [ttsVoice, setTtsVoice] = useState('en-US-AriaNeural');
  const [visualStyle, setVisualStyle] = useState('realistic');
  const [customInstructions, setCustomInstructions] = useState('');
  const [characterRef, setCharacterRef] = useState<string | null>(null);

  // State
  const [isGenerating, setIsGenerating] = useState(false);
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0);

  // Output
  const [blueprint, setBlueprint] = useState<AutoVideoBlueprint | null>(null);
  const [audioMediaId, setAudioMediaId] = useState<string | null>(null);
  const [audioDuration, setAudioDuration] = useState<number>(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const charInputRef = useRef<HTMLInputElement>(null);

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAudioFile(e.target.files[0]);
    }
  };

  const handleCharRefUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setCharacterRef(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // STEP 1: Generate Blueprint (Audio + Script -> Scenes)
  const handleGenerateBlueprint = async () => {
    if (!geminiApiKey) {
      toast.error('Gemini API key is required.');
      return;
    }

    setIsGenerating(true);
    setProgress(10);
    setStatus('Processing audio & script...');

    try {
      let finalScript = script;
      let finalAudioId = '';
      let finalDuration = 0;
      let wordTimestamps: { word: string; start: number; end: number }[] = [];

      if (activeTab === 'script') {
        if (!script.trim()) throw new Error('Please enter a script.');
        
        setStatus('Generating voiceover (TTS)...');
        // TTS
        const ttsUrl = `/api/tts?text=${encodeURIComponent(script)}&voice=${ttsVoice}&rate=1&pitch=1`;
        const audioResponse = await fetch(ttsUrl);
        if (!audioResponse.ok) throw new Error('Failed to generate voiceover.');
        
        const audioBlob = await audioResponse.blob();
        const audioObjectUrl = URL.createObjectURL(audioBlob);
        finalAudioId = `tts_${Date.now()}`;
        
        const audioEl = new Audio(audioObjectUrl);
        await new Promise((resolve) => {
          audioEl.onloadedmetadata = resolve;
          audioEl.onerror = resolve;
          setTimeout(resolve, 3000);
        });
        finalDuration = (audioEl.duration && isFinite(audioEl.duration)) ? audioEl.duration : 10;
        
        addMedia({
          id: finalAudioId,
          name: `Voiceover (AI)`,
          type: 'audio',
          duration: finalDuration,
          url: audioObjectUrl,
          createdAt: Date.now()
        }, new File([audioBlob], `${finalAudioId}.mp3`, { type: audioBlob.type || 'audio/mp3' }));

        // Mock timestamps for TTS (since our API doesn't return them currently)
        const words = script.split(' ');
        const timePerWord = finalDuration / words.length;
        wordTimestamps = words.map((w, i) => ({
          word: w,
          start: i * timePerWord,
          end: (i + 1) * timePerWord
        }));

      } else {
        throw new Error('Audio import flow requires backend transcription which is mocked out for now. Please use Script tab.');
      }

      setAudioMediaId(finalAudioId);
      setAudioDuration(finalDuration);

      setStatus('AI is planning scenes...');
      setProgress(50);

      const generatedBlueprint = await generateAutoVideoBlueprint(
        finalScript,
        wordTimestamps,
        finalDuration,
        geminiApiKey,
        customInstructions,
        characterRef ? "Use provided character reference." : undefined,
        visualStyle
      );

      if (!generatedBlueprint || !Array.isArray(generatedBlueprint.scenes) || generatedBlueprint.scenes.length === 0) {
        throw new Error('AI returned an empty scene blueprint. Please try again.');
      }

      setBlueprint(generatedBlueprint);
      
      setStatus('Fetching alternative video clips...');
      const scenesWithOptions = await Promise.all(
        generatedBlueprint.scenes.map(async (scene) => {
          if (scene.visualSource === 'pexels' && scene.pexelsQuery) {
            const options = await fetchStockVisualOptionsForScene(scene.pexelsQuery, 'landscape', pexelsApiKey, 4);
            return { ...scene, visualOptions: options, selectedVisualUrl: options[0]?.url };
          } else if (scene.visualSource === 'pollinations') {
            if (Array.isArray(scene.layeredPrompts) && scene.layeredPrompts.length > 0) {
              const layeredVisuals = scene.layeredPrompts.map((lp: any, idx: number) => {
                const promptText = typeof lp === 'string' ? lp : (lp?.prompt || scene.pollinationsPrompt || scene.narration || '');
                const isGS = typeof lp === 'object' && lp !== null ? Boolean(lp.isGreenScreen) : idx > 0;
                const res = generatePollinationsImageWithReference(promptText, characterRef, undefined, 1920, 1080);
                return { url: res.url, isGreenScreen: isGS, trackOffset: idx };
              });
              return { ...scene, layeredVisuals };
            } else if (scene.pollinationsPrompt) {
              const options = [];
              for (let i = 0; i < 1; i++) {
                options.push(generatePollinationsImageWithReference(scene.pollinationsPrompt, characterRef, undefined, 1920, 1080));
              }
              return { ...scene, visualOptions: options, selectedVisualUrl: options[0]?.url };
            }
          }
          return scene;
        })
      );
      setBlueprint({ ...generatedBlueprint, scenes: scenesWithOptions });

      setStatus('Blueprint ready!');
      setProgress(100);
      toast.success('Scene blueprint generated! Please review it.');

    } catch (e: any) {
      console.error(e);
      toast.error(e.message);
    } finally {
      setIsGenerating(false);
      setTimeout(() => { setProgress(0); setStatus(''); }, 2000);
    }
  };

  const handleRegenerateVisuals = async (index: number) => {
    if (!blueprint) return;
    const newBlueprint = { ...blueprint };
    const scene = newBlueprint.scenes[index];
    
    if (scene.visualSource === 'pexels' && scene.pexelsQuery) {
      const options = await fetchStockVisualOptionsForScene(scene.pexelsQuery, 'landscape', pexelsApiKey, 4);
      scene.visualOptions = options;
      scene.selectedVisualUrl = options[0]?.url;
    } else if (scene.visualSource === 'pollinations' && scene.pollinationsPrompt) {
      const res = generatePollinationsImageWithReference(scene.pollinationsPrompt, characterRef, undefined, 1920, 1080);
      scene.visualOptions = [{ url: res.url, type: 'image', source: 'pollinations' }];
      scene.selectedVisualUrl = res.url;
      scene.layeredVisuals = undefined;
    }
    setBlueprint(newBlueprint);
  };

  const handleSourceChange = async (index: number, newSource: 'pexels' | 'pollinations' | 'map') => {
    if (!blueprint) return;
    const newBlueprint = { ...blueprint };
    const scene = newBlueprint.scenes[index];
    scene.visualSource = newSource;
    setBlueprint({ ...newBlueprint });

    if (groqApiKey) {
      try {
        const adaptive = await generateSourceAdaptivePrompt(scene.narration, newSource, groqApiKey);
        if (newSource === 'pexels' && adaptive.query) {
          scene.pexelsQuery = adaptive.query;
          scene.pexelsAlternates = adaptive.alternatives;
        } else if (newSource === 'pollinations' && adaptive.prompt) {
          scene.pollinationsPrompt = adaptive.prompt;
          scene.pollinationsVariants = adaptive.variants;
          scene.layeredPrompts = adaptive.layeredPrompts;
        } else if (newSource === 'map' && adaptive.mapAnimation) {
          scene.mapAnimation = adaptive.mapAnimation;
        }
        setBlueprint({ ...newBlueprint });
        handleRegenerateVisuals(index);
      } catch (err) {
        console.error(err);
      }
    }
  };

  // STEP 2: Assemble Video (Fetch media + add to timeline)
  const handleAssemble = async () => {
    if (!blueprint || !audioMediaId || !pexelsApiKey) {
      toast.error('Missing blueprint or API keys.');
      return;
    }

    let dirHandle: any = null;
    try {
      dirHandle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
    } catch (e) {
      toast.error('Local folder access denied. Assembly cancelled.');
      return;
    }

    setIsGenerating(true);
    setProgress(10);
    setStatus('Assembling scenes to local SSD...');

    try {
      const generatedClips: any[] = [];
      const totalScenes = blueprint.scenes.length;
      let sceneIndex = 0;
      let currentStartTime = 0;

      for (const scene of blueprint.scenes) {
        setStatus(`Downloading media ${sceneIndex + 1}/${totalScenes} to local disk...`);
        
        let videoUrl = scene.selectedVisualUrl;
        let isImage = false;
        let downloadedUrls: { url: string, isImage: boolean, isGreenScreen: boolean, trackOffset: number }[] = [];
        
        if (scene.layeredVisuals && scene.layeredVisuals.length > 0) {
           for (const lv of scene.layeredVisuals) {
             downloadedUrls.push({ url: lv.url, isImage: true, isGreenScreen: lv.isGreenScreen, trackOffset: lv.trackOffset });
           }
        } else {
           if (!videoUrl) {
             try {
               if (scene.visualSource === 'pexels') {
                 const options = await fetchStockVisualOptionsForScene(scene.pexelsQuery || '', 'landscape', pexelsApiKey, 1);
                 if (options.length > 0) { videoUrl = options[0].url; isImage = options[0].type === 'image'; }
               } else if (scene.visualSource === 'pollinations' && scene.pollinationsPrompt) {
                 const res = generatePollinationsImageWithReference(scene.pollinationsPrompt, characterRef, undefined, 1920, 1080);
                 videoUrl = res.url;
                 isImage = true;
               }
             } catch (e) { console.error(e); }
           } else {
              isImage = videoUrl.includes('pollinations') || videoUrl.endsWith('.jpg') || videoUrl.endsWith('.png');
           }
           if (videoUrl) {
             downloadedUrls.push({ url: videoUrl, isImage, isGreenScreen: false, trackOffset: 0 });
           }
        }

        const localObjects = [];
        let layerIndex = 1;
        for (const dl of downloadedUrls) {
          const isPollinations = dl.url.includes('pollinations.ai');
          let localObjectUrl = null;
          let localFile: File | undefined = undefined;
          
          let success = false;
          let attempts = 0;
          const maxAttempts = isPollinations ? 5 : 2;
          
          // Pre-fetch cooldown for pollinations to space out API calls
          if (isPollinations) {
            const preDelay = (layerIndex === 1 && sceneIndex === 0) ? 500 : 3000;
            setStatus(`Clip ${sceneIndex + 1}/${totalScenes} · Layer ${layerIndex}/${downloadedUrls.length} — Waiting ${Math.round(preDelay / 1000)}s before request...`);
            await new Promise(r => setTimeout(r, preDelay));
          }
          
          while (!success && attempts < maxAttempts) {
            attempts++;
            const attemptLabel = attempts > 1 ? ` (Retry ${attempts - 1}/${maxAttempts - 1})` : '';
            setStatus(`Clip ${sceneIndex + 1}/${totalScenes} · Layer ${layerIndex}/${downloadedUrls.length}${attemptLabel} — Downloading...`);
            
            try {
              // On retry for pollinations, bust the cache with a new seed
              let fetchUrl = dl.url;
              if (isPollinations && attempts > 1) {
                fetchUrl = fetchUrl.replace(/seed=\d+/, `seed=${Math.floor(Math.random() * 1000000)}`);
              }
              
              const res = await fetch(fetchUrl);
              
              // Handle 429 rate limit with aggressive backoff
              if (res.status === 429) {
                const backoff429 = Math.min(30000, 5000 * Math.pow(2, attempts - 1)); // 5s, 10s, 20s, 30s, 30s
                setStatus(`Clip ${sceneIndex + 1}/${totalScenes} · Layer ${layerIndex} — Rate limited (429). Backing off ${Math.round(backoff429 / 1000)}s...`);
                console.warn(`Pollinations 429 — backing off ${backoff429}ms (attempt ${attempts})`);
                await new Promise(r => setTimeout(r, backoff429));
                continue;
              }
              
              // Handle 500 server errors with moderate backoff
              if (res.status >= 500) {
                const backoff500 = Math.min(15000, 3000 * attempts); // 3s, 6s, 9s, 12s, 15s
                setStatus(`Clip ${sceneIndex + 1}/${totalScenes} · Layer ${layerIndex} — Server error (${res.status}). Retrying in ${Math.round(backoff500 / 1000)}s...`);
                console.warn(`Pollinations ${res.status} — retrying in ${backoff500}ms`);
                await new Promise(r => setTimeout(r, backoff500));
                continue;
              }
              
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              
              const blob = await res.blob();
              
              // Validate blob — pollinations sometimes returns tiny error pages
              if (isPollinations && blob.size < 2000) {
                throw new Error(`Response too small (${blob.size} bytes) — likely an error placeholder`);
              }
              
              const ext = dl.isImage ? 'jpg' : 'mp4';
              const filename = `scene_${Date.now()}_${sceneIndex}_t${dl.trackOffset}.${ext}`;
              const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
              const writable = await fileHandle.createWritable();
              await writable.write(blob);
              await writable.close();
              localFile = await fileHandle.getFile();
              localObjectUrl = URL.createObjectURL(localFile!);
              success = true;
              setStatus(`Clip ${sceneIndex + 1}/${totalScenes} · Layer ${layerIndex}/${downloadedUrls.length} — ✓ Downloaded`);
            } catch (e: any) {
              console.error(`Download failed (Attempt ${attempts}/${maxAttempts}):`, e);
              if (attempts >= maxAttempts) {
                setStatus(`Clip ${sceneIndex + 1}/${totalScenes} · Layer ${layerIndex} — All retries exhausted, using direct URL`);
                localObjectUrl = dl.url; // fallback to raw URL
              } else {
                // Exponential backoff: ~3s, ~5.4s, ~9.7s, ~17.5s
                const backoffMs = Math.min(25000, 3000 * Math.pow(1.8, attempts - 1));
                setStatus(`Clip ${sceneIndex + 1}/${totalScenes} · Layer ${layerIndex} — Error: ${e.message}. Retrying in ${Math.round(backoffMs / 1000)}s...`);
                await new Promise(r => setTimeout(r, backoffMs));
              }
            }
          }
          
          if (localObjectUrl) {
             localObjects.push({ ...dl, localObjectUrl, localFile });
          }
          layerIndex++;
        }

        for (const locObj of localObjects) {
          const mediaId = `auto_${Date.now()}_${sceneIndex}_t${locObj.trackOffset}`;
          
          addMedia({
             id: mediaId,
             name: `Scene ${sceneIndex + 1} ${locObj.isGreenScreen ? '(Layer)' : ''}`,
             type: locObj.isImage ? 'image' : 'video',
             duration: scene.duration,
             url: locObj.localObjectUrl,
             createdAt: Date.now()
          }, locObj.localFile);

          let animations: any = undefined;
          if (visualStyle.startsWith('vox_')) {
             if (locObj.trackOffset === 0) {
               // Background: Slow scale up
               animations = {
                 'transform.scale': [
                    { time: 0, value: 100, easing: 'linear' },
                    { time: scene.duration, value: 110 }
                 ]
               };
             } else {
               // Foreground (Parallax): Slide up and scale slightly
               animations = {
                 'transform.y': [
                    { time: 0, value: 30, easing: 'easeOut' },
                    { time: Math.min(1, scene.duration), value: 0, easing: 'linear' },
                    { time: scene.duration, value: -10 }
                 ],
                 'transform.scale': [
                    { time: 0, value: 85, easing: 'easeOut' },
                    { time: Math.min(1, scene.duration), value: 90, easing: 'linear' },
                    { time: scene.duration, value: 95 }
                 ]
               };
             }
          } else if (locObj.isGreenScreen) {
             animations = {
               'transform.y': [
                 { time: 0, value: 10, easing: 'easeInOut' },
                 { time: scene.duration / 2, value: 15, easing: 'easeInOut' },
                 { time: scene.duration, value: 10 }
               ]
             };
          }
          
          let fx = visualStyle !== 'realistic' && !locObj.isGreenScreen ? [visualStyle] : [];
          if (visualStyle === 'vox_vintage' && locObj.trackOffset === 0) {
             fx = ['old_film']; // Override background FX for vintage vox
          }

          generatedClips.push({
            id: `clip_${uuidv4()}`,
            mediaId,
            startTime: currentStartTime,
            duration: scene.duration,
            track: locObj.trackOffset,
            mediaStartTime: scene.mediaStartTime || 0,
            fx,
            chromaKey: locObj.isGreenScreen ? { enabled: true, color: '#00ff00', threshold: 40, softness: 20 } : undefined,
            transform: locObj.isGreenScreen ? { x: 0, y: 10, scale: 90, rotation: 0 } : undefined,
            animations
          });
        }
        
        // Subtitles
          const textMediaId = `text_media_${uuidv4()}`;
          addMedia({
            id: textMediaId,
            name: scene.narration.substring(0, 15) + '...',
            type: 'text',
            duration: scene.duration,
            url: '',
            createdAt: Date.now(),
            textContent: scene.narration
          });
          
          generatedClips.push({
            id: `text_${uuidv4()}`,
            mediaId: textMediaId,
            startTime: currentStartTime,
            duration: scene.duration,
            track: 1,
            textSettings: {
               text: scene.narration,
               fontFamily: 'Inter',
               fontSize: 32,
               color: '#ffffff',
               bold: true,
               align: 'center',
               verticalAlign: 'bottom',
               shadowColor: '#000000',
               shadowBlur: 4,
               outlineColor: '#000000',
               outlineWidth: 2,
               backgroundOpacity: 0
            }
          });
        
        // Track whether this scene hit pollinations
        const usedPollinations = downloadedUrls.some(dl => dl.url.includes('pollinations.ai'));
        
        currentStartTime += scene.duration;
        sceneIndex++;
        setProgress(10 + Math.floor((sceneIndex / totalScenes) * 80));
        
        // Inter-scene cooldown to prevent burst rate limits on pollinations
        if (usedPollinations && sceneIndex < totalScenes) {
          setStatus(`Scene ${sceneIndex}/${totalScenes} done ✓ — Cooling down 4s before next scene...`);
          await new Promise(r => setTimeout(r, 4000));
        }
      }

      setStatus('Adding to timeline...');
      
      const v1Track = tracks.find(t => t.id === 'v1');
      const v2Track = tracks.find(t => t.id === 'v2');
      const a1Track = tracks.find(t => t.id === 'a1');
      
      addClip({
        id: `audio_${uuidv4()}`,
        mediaId: audioMediaId,
        trackId: a1Track?.id || 'a1',
        startTime: 0,
        duration: audioDuration,
        trimStart: 0,
        trimEnd: 0,
        opacity: 1,
        speed: 1,
        transform: { x: 0, y: 0, scale: 100, rotation: 0 },
        effects: []
      });

      for (const gc of generatedClips) {
        if (gc.textSettings) {
           addClip({
              id: gc.id,
              mediaId: gc.mediaId,
              trackId: 'v4', // Text track on top
              startTime: gc.startTime,
              duration: gc.duration,
              trimStart: 0,
              trimEnd: 0,
              opacity: 1,
              speed: 1,
              transform: { x: 0, y: 0, scale: 100, rotation: 0 },
              textSettings: gc.textSettings,
              effects: []
           });
        } else {
           const trackNum = (gc.track || 0) + 1;
           const targetTrackId = tracks.find(t => t.id === `v${trackNum}`)?.id || `v${trackNum}`;
           
           addClip({
              id: gc.id,
              mediaId: gc.mediaId,
              trackId: targetTrackId,
              startTime: gc.startTime,
              duration: gc.duration,
              trimStart: 0,
              trimEnd: 0,
              opacity: 1,
              speed: 1,
              transform: gc.transform || { x: 0, y: 0, scale: 100, rotation: 0 },
              chromaKey: gc.chromaKey,
              animations: gc.animations,
              effects: (gc.fx || []).map((fx: string) => ({ id: uuidv4(), type: fx, intensity: 100 }))
           });
        }
      }

      setProgress(100);
      toast.success('Video successfully assembled!');
      setTimeout(() => { onClose(); }, 1000);

    } catch (e: any) {
      console.error(e);
      toast.error(`Assembly failed: ${e.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl w-full max-w-6xl h-[80vh] shadow-2xl flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#2a2a2a] bg-[#1a1a1a] shrink-0">
          <div className="flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-indigo-400" />
            <h2 className="text-sm font-semibold text-white">Auto-Faceless Video Generator</h2>
          </div>
          <button onClick={onClose} disabled={isGenerating} className="p-1 text-[#6a6a6a] hover:text-white rounded transition-colors hover:bg-white/10 disabled:opacity-50">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex flex-1 overflow-hidden">
          
          {/* Left Panel: Studio & Inputs */}
          <div className="w-1/3 min-w-[320px] border-r border-[#2a2a2a] bg-[#171717] flex flex-col p-4 gap-4 overflow-y-auto custom-scrollbar">
            
            {/* Tabs */}
            <div className="flex bg-[#1a1a1a] rounded p-1 border border-[#2a2a2a]">
              {(['script', 'audio', 'both'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors capitalize ${activeTab === tab ? 'bg-[#2a2a2a] text-white shadow-sm' : 'text-[#8a8a8a] hover:text-white'}`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Inputs based on tab */}
            {(activeTab === 'script' || activeTab === 'both') && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-[#a0a0a0] flex items-center gap-2">
                  <Type className="w-3.5 h-3.5" /> Script
                </label>
                <textarea
                  value={script}
                  onChange={(e) => setScript(e.target.value)}
                  placeholder="Enter your script here..."
                  className="w-full h-32 bg-[#1e1e1e] border border-[#3e3e3e] rounded px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none resize-none"
                />
              </div>
            )}

            {(activeTab === 'audio' || activeTab === 'both') && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-[#a0a0a0] flex items-center gap-2">
                  <Music className="w-3.5 h-3.5" /> Audio Voiceover
                </label>
                <input
                  type="file"
                  accept="audio/*"
                  ref={fileInputRef}
                  onChange={handleAudioUpload}
                  className="hidden"
                />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full bg-[#1e1e1e] border border-dashed border-[#3e3e3e] hover:border-indigo-500 rounded p-4 flex flex-col items-center justify-center gap-2 transition-colors"
                >
                  <Upload className="w-5 h-5 text-[#6a6a6a]" />
                  <span className="text-xs text-[#8a8a8a]">
                    {audioFile ? audioFile.name : 'Upload Audio File'}
                  </span>
                </button>
              </div>
            )}

            {/* Settings */}
            <div className="flex flex-col gap-4 mt-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-[#a0a0a0]">Voice Actor (for Script)</label>
                <select
                  value={ttsVoice}
                  onChange={(e) => setTtsVoice(e.target.value)}
                  className="w-full bg-[#1e1e1e] border border-[#3e3e3e] rounded px-3 py-2 text-xs text-white outline-none focus:border-indigo-500"
                >
                  <option value="en-US-AriaNeural">Aria (Female)</option>
                  <option value="en-US-GuyNeural">Guy (Male)</option>
                  <option value="hi-IN-SwaraNeural">Swara (Hindi Female)</option>
                  <option value="hi-IN-MadhurNeural">Madhur (Hindi Male)</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-[#a0a0a0]">Visual Style</label>
                <select
                  value={visualStyle}
                  onChange={(e) => setVisualStyle(e.target.value)}
                  className="w-full bg-[#1e1e1e] border border-[#3e3e3e] rounded px-3 py-2 text-xs text-white outline-none focus:border-indigo-500"
                >
                  <option value="realistic">Realistic (Stock / Pexels)</option>
                  <option value="style_anime">Anime (AI Gen)</option>
                  <option value="style_watercolor">Watercolor (AI Gen)</option>
                  <option value="style_papercut">Papercut (AI Gen)</option>
                  <option value="vox_vintage">Vox Documentary (Vintage Collage)</option>
                  <option value="vox_realistic">Vox Documentary (Realistic)</option>
                </select>
              </div>

              {visualStyle !== 'realistic' && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-[#a0a0a0] flex items-center justify-between">
                    <span>Character Reference (Optional)</span>
                    {characterRef && (
                      <button onClick={() => setCharacterRef(null)} className="text-red-400 hover:text-red-300 text-[10px]">Remove</button>
                    )}
                  </label>
                  <input type="file" accept="image/*" ref={charInputRef} onChange={handleCharRefUpload} className="hidden" />
                  <div 
                    onClick={() => !characterRef && charInputRef.current?.click()}
                    className={`w-full h-24 bg-[#1e1e1e] border border-dashed rounded flex flex-col items-center justify-center overflow-hidden transition-colors ${characterRef ? 'border-[#3e3e3e]' : 'border-[#3e3e3e] hover:border-indigo-500 cursor-pointer'}`}
                  >
                    {characterRef ? (
                      <img src={characterRef} crossOrigin="anonymous" alt="Char Ref" className="w-full h-full object-cover" />
                    ) : (
                      <>
                        <ImageIcon className="w-5 h-5 text-[#6a6a6a] mb-1" />
                        <span className="text-[10px] text-[#8a8a8a]">Upload image for style consistency</span>
                      </>
                    )}
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-[#a0a0a0]">Custom AI Instructions (Optional)</label>
                <textarea
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  placeholder="E.g. Make it a dark, moody thriller..."
                  className="w-full h-16 bg-[#1e1e1e] border border-[#3e3e3e] rounded px-3 py-2 text-xs text-white focus:border-indigo-500 outline-none resize-none"
                />
              </div>
            </div>

            <div className="mt-auto pt-4 flex flex-col gap-2">
              <button
                onClick={handleGenerateBlueprint}
                disabled={isGenerating || (activeTab === 'script' && !script.trim()) || (activeTab === 'audio' && !audioFile)}
                className="w-full py-2.5 bg-[#2a2a2a] hover:bg-[#333] border border-[#3e3e3e] disabled:opacity-50 text-white text-sm font-medium rounded flex items-center justify-center gap-2 transition-colors"
              >
                {isGenerating && !blueprint ? <Loader2 className="w-4 h-4 animate-spin" /> : <Settings className="w-4 h-4" />}
                1. Generate Blueprint
              </button>
            </div>
          </div>

          {/* Right Panel: Scene Editor & Assemble */}
          <div className="flex-1 bg-[#141414] flex flex-col relative overflow-hidden">
            <div className="p-4 border-b border-[#2a2a2a] flex items-center justify-between bg-[#1a1a1a]">
              <h3 className="text-sm font-semibold text-white">Preview & Scene Blueprint</h3>
              {blueprint && (
                <button
                  onClick={handleAssemble}
                  disabled={isGenerating}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-medium rounded flex items-center justify-center gap-2 transition-colors shadow-lg"
                >
                  {isGenerating && blueprint ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                  2. Assemble Video
                </button>
              )}
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 custom-scrollbar">
              {audioFile && activeTab === 'audio' && (
                <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded p-3">
                  <h4 className="text-xs font-medium text-[#8a8a8a] mb-2 uppercase tracking-wider">Audio Source Preview</h4>
                  <AutoVideoPreviewTrimmer 
                    url={URL.createObjectURL(audioFile)} 
                    type="audio" 
                    duration={audioDuration || 60} 
                    onTrimChange={() => {}} 
                  />
                </div>
              )}

              <AutoVideoSceneList 
                scenes={blueprint?.scenes || []}
                onChange={(newScenes) => {
                  if (blueprint) setBlueprint({ ...blueprint, scenes: newScenes });
                }}
                disabled={isGenerating}
                onRegenerateVisuals={handleRegenerateVisuals}
                onSourceChange={handleSourceChange}
              />
            </div>

            {/* Status Bar Overlay */}
            {isGenerating && (
              <div className="absolute bottom-4 left-4 right-4 bg-[#1e1e1e] border border-[#3e3e3e] rounded-lg p-3 shadow-xl">
                <div className="flex items-center justify-between text-xs text-[#a0a0a0] mb-2">
                  <span className="font-medium text-white">{status}</span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full h-1.5 bg-[#141414] rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-indigo-500 rounded-full transition-all duration-300"
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
