import React, { useState, useEffect } from 'react';
import { X, Loader2, Sparkles, Image as ImageIcon, Video, Wand2, Download, Plus, Trash2 } from 'lucide-react';
import { fetchVideoModels, generateAIVideo, checkVideoJobStatus } from '../utils/openRouterVideo';
import { OpenRouterModel } from '../types';
import { useEditorStore } from '../store/editorStore';
import { toast } from 'sonner';

interface AIGeneratorModalProps {
  onClose: () => void;
}

export function AIGeneratorModal({ onClose }: AIGeneratorModalProps) {
  const { settings, addMedia, aiVideoIsGenerating, aiVideoProgress, aiVideoJobId, aiVideoResultUrl, setAIVideoGenerationState } = useEditorStore();
  const openRouterApiKey = settings?.openRouterApiKey || import.meta.env.VITE_OPENROUTER_API_KEY;
  const geminiApiKey = settings?.geminiApiKey || import.meta.env.VITE_GEMINI_API_KEY;

  const [workingApiKey, setWorkingApiKey] = useState<string>('');
  const [models, setModels] = useState<OpenRouterModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(true);
  const [selectedModel, setSelectedModel] = useState<string>('');
  
  const [prompt, setPrompt] = useState('');
  const [referenceUrl, setReferenceUrl] = useState('');
  const [isEnhancing, setIsEnhancing] = useState(false);

  useEffect(() => {
    async function loadModels() {
      const envKey = import.meta.env.VITE_OPENROUTER_API_KEY;
      const settingsKey = settings?.openRouterApiKey;

      if (!envKey && !settingsKey) {
        setLoadingModels(false);
        return;
      }

      setLoadingModels(true);
      
      let fetchedModels: OpenRouterModel[] = [];
      let activeKey = '';

      // First try ENV key
      if (envKey) {
        try {
          fetchedModels = await fetchVideoModels(envKey);
          if (fetchedModels.length > 0) activeKey = envKey;
        } catch (e) {
          console.warn('ENV API key failed, falling back to settings key', e);
        }
      }

      // If ENV failed or missing, try settings key
      if (fetchedModels.length === 0 && settingsKey) {
        try {
          fetchedModels = await fetchVideoModels(settingsKey);
          if (fetchedModels.length > 0) activeKey = settingsKey;
        } catch (e) {
          console.warn('Settings API key also failed', e);
        }
      }

      setModels(fetchedModels);
      
      // Store the active key in a ref or state if needed, or just let the generate function use the same logic
      // But we need to use this active key for generating videos as well.
      if (activeKey) {
        setWorkingApiKey(activeKey);
      }

      if (fetchedModels.length > 0) {
        setSelectedModel(fetchedModels[0].id);
      }
      
      setLoadingModels(false);
    }
    loadModels();
  }, [settings?.openRouterApiKey]);

  const handleEnhancePrompt = async () => {
    if (!prompt.trim()) {
      toast.error('Please enter a basic prompt first to enhance.');
      return;
    }
    if (!geminiApiKey) {
      toast.error('Gemini API key is required to enhance prompts.');
      return;
    }
    setIsEnhancing(true);
    try {
      const { enhancePromptWithGemini } = await import('../utils/aiClient');
      const enhanced = await enhancePromptWithGemini(prompt, geminiApiKey);
      setPrompt(enhanced);
      toast.success('Prompt enhanced!');
    } catch (e: any) {
      console.error(e);
      toast.error(`Enhancement failed: ${e.message}`);
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleGenerate = async () => {
    if (!workingApiKey) {
      toast.error('Please configure your OpenRouter API key in settings or env.');
      return;
    }
    if (!prompt.trim()) {
      toast.error('Please enter a prompt.');
      return;
    }
    
    setAIVideoGenerationState({
      aiVideoIsGenerating: true,
      aiVideoProgress: 10,
      aiVideoResultUrl: null
    });
    
    try {
      const idOrUrl = await generateAIVideo(prompt, selectedModel, workingApiKey, referenceUrl || undefined);
      
      // If it's a URL (synchronous or fast return)
      if (idOrUrl.startsWith('http') || idOrUrl.startsWith('blob:')) {
        setAIVideoGenerationState({
          aiVideoResultUrl: idOrUrl,
          aiVideoIsGenerating: false,
          aiVideoProgress: 100
        });
        return;
      }
      
      // Otherwise, it's a job ID, we need to poll
      setAIVideoGenerationState({ aiVideoJobId: idOrUrl });
      pollStatus(idOrUrl);

    } catch (e: any) {
      console.error(e);
      toast.error(e.message);
      setAIVideoGenerationState({
        aiVideoIsGenerating: false,
        aiVideoProgress: 0
      });
    }
  };

  const pollStatus = async (id: string) => {
    if (!workingApiKey) return;
    
    let attempts = 0;
    const maxAttempts = 60; // 60 * 5s = 5 minutes timeout
    
    const interval = setInterval(async () => {
      attempts++;
      setAIVideoGenerationState({ aiVideoProgress: Math.min(95, 10 + (attempts * 1.5)) });
      
      const { status, resultUrl, error } = await checkVideoJobStatus(id, workingApiKey);
      
      if (status === 'completed' && resultUrl) {
        clearInterval(interval);
        setAIVideoGenerationState({
          aiVideoResultUrl: resultUrl,
          aiVideoProgress: 100,
          aiVideoIsGenerating: false,
          aiVideoJobId: null
        });
        toast.success('AI Generation complete!');
      } else if (status === 'failed' || error || attempts >= maxAttempts) {
        clearInterval(interval);
        setAIVideoGenerationState({
          aiVideoIsGenerating: false,
          aiVideoProgress: 0,
          aiVideoJobId: null
        });
        toast.error(error || 'Generation timed out or failed.');
      }
    }, 5000);
  };

  const handleImportToProject = () => {
    if (!aiVideoResultUrl) return;
    
    const isVideo = aiVideoResultUrl.includes('.mp4') || aiVideoResultUrl.includes('video');
    const id = `ai_gen_${Date.now()}`;
    
    addMedia({
      id,
      name: `AI Gen ${isVideo ? 'Video' : 'Image'}`,
      type: isVideo ? 'video' : 'image',
      url: aiVideoResultUrl,
      duration: isVideo ? 5 : 0, // Default duration if not determinable easily
      createdAt: Date.now()
    });
    
    toast.success('Imported to Media Library!');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl w-full max-w-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#2a2a2a] bg-[#1a1a1a]">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <h2 className="text-sm font-semibold text-white">AI Video & Image Generation (OpenRouter)</h2>
          </div>
          <button onClick={onClose} className="p-1 text-[#6a6a6a] hover:text-white rounded transition-colors hover:bg-white/10">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 flex flex-col gap-4 overflow-y-auto max-h-[70vh]">
          {/* Model Selection */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[#a0a0a0]">Select AI Model</label>
            {loadingModels ? (
              <div className="h-9 flex items-center px-3 border border-[#3e3e3e] rounded text-xs text-[#a0a0a0] bg-[#1e1e1e]">
                <Loader2 className="w-3 h-3 animate-spin mr-2" /> Loading models...
              </div>
            ) : (
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full bg-[#1e1e1e] border border-[#3e3e3e] rounded px-3 py-2 text-xs text-white focus:border-amber-500 outline-none"
              >
                {models.length === 0 && <option disabled>No models found (Check API Key)</option>}
                {models.map(m => {
                  const isFree = m.pricing.prompt === "0" && m.pricing.completion === "0";
                  return (
                    <option key={m.id} value={m.id}>
                      {m.id.toLowerCase().includes('nvidia') ? '🟢 NVIDIA ' : '🌐 '}{m.name} {isFree ? '(FREE)' : '(PAID)'}
                    </option>
                  );
                })}
              </select>
            )}
            <span className="text-[10px] text-amber-500/80">Uses your OpenRouter API Key. Note: Not all models are guaranteed free.</span>
          </div>

          {/* Reference Image */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[#a0a0a0]">Reference Image URL (Optional)</label>
            <input
              type="text"
              placeholder="https://example.com/image.jpg"
              value={referenceUrl}
              onChange={(e) => setReferenceUrl(e.target.value)}
              className="w-full bg-[#1e1e1e] border border-[#3e3e3e] rounded px-3 py-2 text-xs text-white focus:border-amber-500 outline-none"
            />
          </div>

          {/* Prompt */}
          <div className="flex flex-col gap-1.5 relative">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-[#a0a0a0]">Prompt</label>
              <button
                onClick={handleEnhancePrompt}
                disabled={isEnhancing || !prompt}
                className="text-[10px] flex items-center gap-1 text-purple-400 hover:text-purple-300 disabled:opacity-50"
              >
                {isEnhancing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                Enhance with Gemini
              </button>
            </div>
            <textarea
              placeholder="A cinematic shot of a cyberpunk city at night with neon lights..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full bg-[#1e1e1e] border border-[#3e3e3e] rounded p-3 text-xs text-white focus:border-amber-500 outline-none min-h-[100px] resize-y"
            />
          </div>

          {/* Result / Progress Area */}
          {aiVideoIsGenerating && (
            <div className="flex flex-col items-center justify-center py-12 px-6 border-2 border-dashed border-[#333333] rounded-lg bg-[#1A1A1A]">
              <Loader2 className="w-10 h-10 text-amber-500 animate-spin mb-4" />
              <div className="text-sm font-medium mb-2 text-center">Generating your masterpiece...</div>
              <div className="w-full max-w-xs bg-black rounded-full h-2 mb-2 overflow-hidden relative">
                <div 
                  className="bg-gradient-to-r from-amber-600 to-amber-400 h-2 rounded-full transition-all duration-300 ease-out absolute top-0 left-0" 
                  style={{ width: `${aiVideoProgress}%` }}
                ></div>
              </div>
              <div className="text-xs text-[#888888]">{Math.round(aiVideoProgress)}%</div>
            </div>
          )}

          {aiVideoResultUrl && !aiVideoIsGenerating && (
            <div className="flex flex-col gap-4 border border-[#333333] rounded-lg p-2 bg-[#1A1A1A]">
              <div className="relative aspect-video rounded overflow-hidden bg-black group">
                {aiVideoResultUrl.includes('.mp4') || selectedModel.includes('video') ? (
                  <video 
                    src={aiVideoResultUrl} 
                    controls 
                    autoPlay 
                    loop 
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <img 
                    src={aiVideoResultUrl} 
                    alt="Generated" 
                    className="w-full h-full object-contain"
                  />
                )}
              </div>
              
              <div className="flex justify-between items-center px-2 pb-2">
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      addMedia({
                        id: crypto.randomUUID(),
                        name: `AI_${selectedModel.split('/')[1] || 'Media'}_${Date.now()}`,
                        type: aiVideoResultUrl.includes('.mp4') || selectedModel.includes('video') ? 'video' : 'image',
                        url: aiVideoResultUrl,
                        duration: 5, // Default for video models
                        folderId: undefined,
                        createdAt: Date.now()
                      });
                      toast.success('Added to Media Library');
                    }}
                    className="px-4 py-2 bg-[#333333] hover:bg-[#444444] text-white text-xs font-medium rounded flex items-center justify-center gap-2 transition-colors"
                  >
                    <Plus className="w-3 h-3" /> Add to Library
                  </button>
                  <a
                    href={aiVideoResultUrl}
                    download
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 border border-[#333333] hover:bg-[#333333] text-white text-xs font-medium rounded flex items-center justify-center gap-2 transition-colors"
                  >
                    <Download className="w-3 h-3" /> Download
                  </a>
                  <button
                    onClick={() => setAIVideoGenerationState({ aiVideoResultUrl: null })}
                    className="px-3 py-2 border border-red-500/30 hover:bg-red-500/10 text-red-400 text-xs font-medium rounded flex items-center justify-center transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-[#2a2a2a] bg-[#1a1a1a] flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-[#a0a0a0] hover:text-white transition-colors"
          >
            Close
          </button>
          {!aiVideoIsGenerating && !aiVideoResultUrl && (
            <button
              onClick={handleGenerate}
              disabled={!prompt || !workingApiKey || models.length === 0}
              className="px-6 py-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-black text-xs font-bold rounded flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Generate Magic
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
