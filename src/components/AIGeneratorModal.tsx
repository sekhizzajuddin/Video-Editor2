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
  const { settings, addMedia } = useEditorStore();
  const openRouterApiKey = settings?.openRouterApiKey;
  const geminiApiKey = settings?.geminiApiKey;

  const [models, setModels] = useState<OpenRouterModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(true);
  const [selectedModel, setSelectedModel] = useState<string>('');
  
  const [prompt, setPrompt] = useState('');
  const [referenceUrl, setReferenceUrl] = useState('');
  const [isEnhancing, setIsEnhancing] = useState(false);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  useEffect(() => {
    async function loadModels() {
      if (!openRouterApiKey) {
        setLoadingModels(false);
        return;
      }
      setLoadingModels(true);
      const fetchedModels = await fetchVideoModels(openRouterApiKey);
      setModels(fetchedModels);
      if (fetchedModels.length > 0) {
        setSelectedModel(fetchedModels[0].id);
      }
      setLoadingModels(false);
    }
    loadModels();
  }, [openRouterApiKey]);

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
    if (!openRouterApiKey) {
      toast.error('Please configure your OpenRouter API key in settings.');
      return;
    }
    if (!prompt.trim()) {
      toast.error('Please enter a prompt.');
      return;
    }
    
    setIsGenerating(true);
    setGenerationProgress(10);
    setResultUrl(null);
    
    try {
      const idOrUrl = await generateAIVideo(prompt, selectedModel, openRouterApiKey, referenceUrl || undefined);
      
      // If it's a URL (synchronous or fast return)
      if (idOrUrl.startsWith('http') || idOrUrl.startsWith('blob:')) {
        setResultUrl(idOrUrl);
        setIsGenerating(false);
        setGenerationProgress(100);
        return;
      }
      
      // Otherwise, it's a job ID, we need to poll
      setJobId(idOrUrl);
      pollStatus(idOrUrl);

    } catch (e: any) {
      console.error(e);
      toast.error(e.message);
      setIsGenerating(false);
      setGenerationProgress(0);
    }
  };

  const pollStatus = async (id: string) => {
    if (!openRouterApiKey) return;
    
    let attempts = 0;
    const maxAttempts = 60; // 60 * 5s = 5 minutes timeout
    
    const interval = setInterval(async () => {
      attempts++;
      setGenerationProgress(Math.min(95, 10 + (attempts * 1.5)));
      
      const { status, resultUrl, error } = await checkVideoJobStatus(id, openRouterApiKey);
      
      if (status === 'completed' && resultUrl) {
        clearInterval(interval);
        setResultUrl(resultUrl);
        setGenerationProgress(100);
        setIsGenerating(false);
        setJobId(null);
        toast.success('AI Generation complete!');
      } else if (status === 'failed' || error || attempts >= maxAttempts) {
        clearInterval(interval);
        setIsGenerating(false);
        setGenerationProgress(0);
        setJobId(null);
        toast.error(error || 'Generation timed out or failed.');
      }
    }, 5000);
  };

  const handleImportToProject = () => {
    if (!resultUrl) return;
    
    const isVideo = resultUrl.includes('.mp4') || resultUrl.includes('video');
    const id = `ai_gen_${Date.now()}`;
    
    addMedia({
      id,
      name: `AI Gen ${isVideo ? 'Video' : 'Image'}`,
      type: isVideo ? 'video' : 'image',
      url: resultUrl,
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
                      {m.name} {isFree ? '(FREE)' : '(PAID)'}
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
          {(isGenerating || resultUrl) && (
            <div className="mt-2 p-4 border border-[#3e3e3e] rounded-lg bg-[#1e1e1e] flex flex-col items-center justify-center min-h-[200px] relative overflow-hidden">
              {isGenerating && (
                <div className="flex flex-col items-center gap-3 w-full max-w-xs z-10">
                  <div className="relative">
                    <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
                    <div className="absolute inset-0 bg-amber-500/20 blur-xl rounded-full" />
                  </div>
                  <p className="text-xs text-[#a0a0a0] font-medium text-center">
                    Generating your media...<br />
                    <span className="text-[10px] text-[#6a6a6a]">This usually takes 1-3 minutes for video.</span>
                  </p>
                  
                  {/* Progress Bar */}
                  <div className="w-full h-1.5 bg-[#2a2a2a] rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-amber-600 to-amber-400 transition-all duration-500 ease-out" 
                      style={{ width: `${generationProgress}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-amber-500/80">{Math.round(generationProgress)}%</span>
                </div>
              )}
              
              {resultUrl && (
                <div className="w-full h-full flex flex-col gap-3">
                  {resultUrl.includes('.mp4') || resultUrl.includes('video') ? (
                    <video src={resultUrl} controls className="w-full h-auto max-h-[300px] rounded border border-[#3e3e3e] object-contain bg-black" />
                  ) : (
                    <img src={resultUrl} alt="Generated" className="w-full h-auto max-h-[300px] rounded border border-[#3e3e3e] object-contain bg-black" />
                  )}
                  
                  <div className="flex gap-2 w-full mt-2">
                    <button
                      onClick={handleImportToProject}
                      className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-black text-xs font-semibold rounded flex items-center justify-center gap-1 transition-colors"
                    >
                      <Plus className="w-3 h-3" /> Import to Project
                    </button>
                    <a
                      href={resultUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-2 bg-[#2a2a2a] hover:bg-[#3e3e3e] text-white text-xs font-medium rounded flex items-center justify-center gap-1 transition-colors"
                    >
                      <Download className="w-3 h-3" /> Download
                    </a>
                    <button
                      onClick={() => setResultUrl(null)}
                      className="px-3 py-2 border border-red-500/30 hover:bg-red-500/10 text-red-400 text-xs font-medium rounded flex items-center justify-center transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}
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
          {!isGenerating && !resultUrl && (
            <button
              onClick={handleGenerate}
              disabled={!prompt || !openRouterApiKey || models.length === 0}
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
