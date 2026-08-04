import React, { useState, useRef } from 'react';
import { X, Loader2, Wand2, Mic, Settings, Play, Type, Image as ImageIcon, Map, Video, Upload, Music } from 'lucide-react';
import { useEditorStore } from '../store/editorStore';
import { useShallow } from 'zustand/react/shallow';
import { toast } from 'sonner';
import { generateAutoVideoBlueprint, alignScriptToAudio, AutoVideoBlueprint } from '../utils/aiClient';
import { fetchStockVisualForScene } from '../utils/pexelsClient';
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
        });

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
        characterRef ? "Use provided character reference." : undefined
      );

      setBlueprint(generatedBlueprint);
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

  // STEP 2: Assemble Video (Fetch media + add to timeline)
  const handleAssemble = async () => {
    if (!blueprint || !audioMediaId || !pexelsApiKey) {
      toast.error('Missing blueprint or API keys.');
      return;
    }

    setIsGenerating(true);
    setProgress(10);
    setStatus('Assembling scenes...');

    try {
      const generatedClips: any[] = [];
      const totalScenes = blueprint.scenes.length;
      let sceneIndex = 0;
      let currentStartTime = 0;

      for (const scene of blueprint.scenes) {
        setStatus(`Sourcing media ${sceneIndex + 1}/${totalScenes}...`);
        
        let videoUrl = null;
        let isImage = false;
        
        try {
          if (scene.visualSource === 'pexels') {
            const visual = await fetchStockVisualForScene(scene.pexelsQuery || '', 'landscape', pexelsApiKey);
            if (visual) {
               videoUrl = visual.url;
               isImage = visual.type === 'image';
            }
          } else if (scene.visualSource === 'pollinations' && scene.pollinationsPrompt) {
            // Pollinations
            let url = `https://image.pollinations.ai/prompt/${encodeURIComponent(scene.pollinationsPrompt)}?width=1920&height=1080&nologo=true`;
            if (characterRef) url += `&image=${encodeURIComponent(characterRef)}`;
            videoUrl = url;
            isImage = true;
          } else if (scene.visualSource === 'map') {
             // We'd render map here, for now use a placeholder
             videoUrl = null; // Map logic should ideally run offline and save blob
          }
        } catch (e) {
          console.error('Visual search failed:', e);
        }

        if (videoUrl) {
          const mediaId = `auto_${Date.now()}_${sceneIndex}`;
          
          addMedia({
             id: mediaId,
             name: `Scene ${sceneIndex + 1}`,
             type: isImage ? 'image' : 'video',
             duration: scene.duration,
             url: videoUrl,
             createdAt: Date.now()
          });

          generatedClips.push({
            id: `clip_${uuidv4()}`,
            mediaId,
            startTime: currentStartTime,
            duration: scene.duration,
            track: 0,
            mediaStartTime: 0,
            fx: visualStyle !== 'realistic' ? [visualStyle] : []
          });
          
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
        }
        
        currentStartTime += scene.duration;
        sceneIndex++;
        setProgress(10 + Math.floor((sceneIndex / totalScenes) * 80));
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
              trackId: v2Track?.id || 'v2',
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
           addClip({
              id: gc.id,
              mediaId: gc.mediaId,
              trackId: v1Track?.id || 'v1',
              startTime: gc.startTime,
              duration: gc.duration,
              trimStart: 0,
              trimEnd: 0,
              opacity: 1,
              speed: 1,
              transform: { x: 0, y: 0, scale: 100, rotation: 0 },
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
                      <img src={characterRef} alt="Char Ref" className="w-full h-full object-cover" />
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
