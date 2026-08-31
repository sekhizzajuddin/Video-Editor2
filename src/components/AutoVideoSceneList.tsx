import React, { useEffect, useState } from 'react';
import { AutoVideoScene } from '../utils/aiClient';
import { Settings, Image as ImageIcon, Map, Video, X, ChevronUp, ChevronDown, Scissors, RefreshCw } from 'lucide-react';
import { AutoVideoPreviewTrimmer } from './AutoVideoPreviewTrimmer';

import { generateImageFromCloudflare } from '../utils/cloudflareClient';
import { useEditorStore } from '../store/editorStore';

// Global queue to serialize Pollinations image generation (avoid 429 burst rate limits)
let pollinationsQueue: Promise<void> = Promise.resolve();

const SequentialImage: React.FC<{ src: string; alt: string; className: string }> = ({ src, alt, className }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'queued' | 'connecting' | 'generating' | 'downloading' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [statusLog, setStatusLog] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const settings = useEditorStore(s => s.settings) as any;
  const isPollinations = src && src.includes('pollinations.ai');
  const isCloudflare = src && src.startsWith('cloudflare://');

  useEffect(() => {
    if (!isPollinations && !isCloudflare) return;
    if (!src) return;
    
    let cancelled = false;

    const fetchImage = async () => {
      if (cancelled) return;
      setStatus('queued');
      setProgress(5);
      setStatusLog('Queued for generation...');

      // Wait for previous queue item to finish (sequential generation)
      const myTurn = pollinationsQueue.then(async () => {
        if (cancelled) return;
        
        const maxAttempts = 4;
        let attempt = 0;

        while (attempt < maxAttempts && !cancelled) {
          attempt++;
          setRetryCount(attempt > 1 ? attempt - 1 : 0);

          try {
            // Pre-fetch delay to avoid bursting
            if (attempt > 1) {
              const backoff = Math.min(20000, 4000 * Math.pow(1.5, attempt - 1));
              setStatus('connecting');
              setProgress(10);
              setStatusLog(`Retry ${attempt - 1}/${maxAttempts - 1} — waiting ${Math.round(backoff / 1000)}s...`);
              await new Promise(r => setTimeout(r, backoff));
            } else {
              // Small delay even on first attempt
              await new Promise(r => setTimeout(r, 800));
            }

            if (cancelled) return;
            setStatus('generating');
            setProgress(20);
            setStatusLog(attempt > 1 ? `Attempt ${attempt}: Sending to AI...` : 'Sending prompt to AI...');

            if (cancelled) return;
            setStatus('downloading');
            setProgress(60);
            setStatusLog(attempt > 1 ? `Attempt ${attempt}: Loading image...` : 'Generating & loading...');

            if (isCloudflare) {
              const prompt = decodeURIComponent(src.replace('cloudflare://', ''));
              const accountId = settings?.cloudflareAccountId || import.meta.env.VITE_CLOUDFLARE_ACCOUNT_ID;
              const apiToken = settings?.cloudflareApiToken || import.meta.env.VITE_CLOUDFLARE_API_TOKEN;
              
              if (!accountId || !apiToken) {
                throw new Error('Cloudflare API credentials are not set.');
              }
              
              const localUrl = await generateImageFromCloudflare(prompt, accountId, apiToken);
              if (cancelled) return;
              setImageUrl(localUrl);
              setStatus('done');
              setProgress(100);
              setStatusLog('✓ Complete');
              return;
            }

            let fetchUrl = src;
            if (attempt > 1 && isPollinations) {
              const models = ['flux', 'turbo', 'unity'];
              const nextModel = models[(attempt - 1) % models.length];
              fetchUrl = fetchUrl.replace(/seed=\d+/, `seed=${Math.floor(Math.random() * 1000000)}`);
              if (fetchUrl.includes('model=')) {
                fetchUrl = fetchUrl.replace(/model=[a-z0-9_-]+/i, `model=${nextModel}`);
              } else {
                fetchUrl += `&model=${nextModel}`;
              }
            }

            await new Promise<void>((resolve, reject) => {
              const img = new Image();
              img.crossOrigin = 'anonymous'; // Important for canvas
              img.onload = () => {
                if (cancelled) return resolve();
                setImageUrl(fetchUrl);
                setStatus('done');
                setProgress(100);
                setStatusLog('✓ Complete');
                resolve();
              };
              img.onerror = () => {
                reject(new Error('Image failed to load'));
              };
              img.src = fetchUrl;
            });
            
            return; // Success — exit retry loop
          } catch (err: any) {
            if (cancelled) return;
            if (attempt >= maxAttempts || isCloudflare) {
              // Fallback to high-reliability placeholder so preview doesn't break
              const fallbackUrl = src.includes('green%20screen') || src.includes('PIP') 
                ? 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="576"><rect width="1024" height="576" fill="%2300FF00"/><text x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="black" font-size="24">PIP Layer</text></svg>'
                : 'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?w=1024&q=80';
              setImageUrl(fallbackUrl);
              setStatus('done');
              setProgress(100);
              setStatusLog('✓ Loaded (Fallback)');
            }
          }
        }
      });

      // Chain onto the global queue so next image waits for this one
      pollinationsQueue = myTurn.catch(() => {});
      await myTurn;
    };

    fetchImage();

    return () => {
      cancelled = true;
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [src]);

  if (isPollinations || isCloudflare) {
    // Show generated image once ready
    if (status === 'done' && imageUrl) {
      return <img src={imageUrl} alt={alt} crossOrigin="anonymous" className={className} />;
    }

    // Show progress UI while generating
    const progressColor = status === 'error' ? 'bg-red-500' : status === 'done' ? 'bg-green-500' : 'bg-indigo-500';
    const pulseClass = status === 'generating' || status === 'connecting' ? 'animate-pulse' : '';

    return (
      <div className={`bg-background flex flex-col items-center justify-center ${className} relative overflow-hidden`}>
        {/* Background shimmer */}
        <div className={`absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-indigo-500/10 to-indigo-500/5 ${pulseClass}`} />
        
        {/* Content */}
        <div className="z-10 flex flex-col items-center w-full px-3">
          {status === 'error' ? (
            <div className="w-4 h-4 rounded-full border-2 border-red-500 flex items-center justify-center mb-1">
              <X className="w-2.5 h-2.5 text-red-500" />
            </div>
          ) : (
            <div className="relative mb-1">
              <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" className="text-[#2a2a2a]" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-indigo-500" />
              </svg>
            </div>
          )}
          
          <span className="text-[9px] text-foreground font-medium mb-0.5 text-center leading-tight">{statusLog}</span>
          
          {retryCount > 0 && (
            <span className="text-[8px] text-amber-400/80 mb-1">Retry #{retryCount}</span>
          )}
          
          {/* Progress bar */}
          <div className="w-full h-1 bg-background rounded-full overflow-hidden mt-1">
            <div 
              className={`h-full ${progressColor} rounded-full transition-all duration-500 ease-out`}
              style={{ width: `${progress}%` }}
            />
          </div>
          
          <span className="text-[8px] text-muted-foreground/70 mt-0.5">{progress}%</span>
        </div>
      </div>
    );
  }
  
  return <img src={src} alt={alt} crossOrigin="anonymous" className={className} loading="lazy" />;
};


interface AutoVideoSceneListProps {
  scenes: AutoVideoScene[];
  onChange: (scenes: AutoVideoScene[]) => void;
  disabled?: boolean;
  onRegenerateVisuals?: (index: number) => void;
  onSourceChange?: (index: number, newSource: 'pexels' | 'pollinations' | 'cloudflare' | 'map') => void;
}

export const AutoVideoSceneList: React.FC<AutoVideoSceneListProps> = ({ scenes, onChange, disabled, onRegenerateVisuals, onSourceChange }) => {
  const updateScene = (index: number, updates: Partial<AutoVideoScene>) => {
    const newScenes = [...scenes];
    newScenes[index] = { ...newScenes[index], ...updates };
    onChange(newScenes);
  };

  const removeScene = (index: number) => {
    const newScenes = [...scenes];
    newScenes.splice(index, 1);
    onChange(newScenes);
  };

  const moveScene = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === scenes.length - 1) return;

    const newScenes = [...scenes];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const temp = newScenes[index];
    newScenes[index] = newScenes[targetIndex];
    newScenes[targetIndex] = temp;
    onChange(newScenes);
  };

  if (!scenes || scenes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 border border-dashed border-border rounded bg-card/50 text-muted-foreground">
        <p className="text-sm">No scenes generated yet.</p>
        <p className="text-xs mt-1">Generate a blueprint to see the scene breakdown here.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
      {scenes.map((scene, idx) => (
        <div key={idx} className="bg-card border border-border rounded p-3 flex flex-col gap-2">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-2">
              <span className="bg-secondary text-xs font-mono px-2 py-0.5 rounded text-muted-foreground">
                {scene.startTime.toFixed(1)}s - {scene.endTime.toFixed(1)}s
              </span>
              <span className="text-xs text-muted-foreground">Duration: {scene.duration.toFixed(1)}s</span>
            </div>
            <div className="flex items-center gap-1">
              <button 
                onClick={() => moveScene(idx, 'up')}
                disabled={disabled || idx === 0}
                className="p-1 text-muted-foreground/70 hover:text-foreground disabled:opacity-30"
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={() => moveScene(idx, 'down')}
                disabled={disabled || idx === scenes.length - 1}
                className="p-1 text-muted-foreground/70 hover:text-foreground disabled:opacity-30"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={() => removeScene(idx)}
                disabled={disabled}
                className="p-1 text-muted-foreground/70 hover:text-red-400 disabled:opacity-30 ml-2"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          
          <div className="text-sm text-foreground font-medium bg-background p-2 rounded border border-border">
            "{scene.narration}"
          </div>

          <div className="grid grid-cols-2 gap-3 mt-1">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Visual Source</label>
              <div className="flex gap-2">
                {(['pexels', 'pollinations', 'cloudflare', 'map'] as const).map(src => (
                  <button
                    key={src}
                    disabled={disabled}
                    onClick={() => {
                      if (onSourceChange) {
                        onSourceChange(idx, src);
                      } else {
                        updateScene(idx, { visualSource: src });
                      }
                    }}
                    className={`flex-1 py-1.5 text-xs rounded border flex items-center justify-center gap-1.5 transition-colors
                      ${scene.visualSource === src 
                        ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300' 
                        : 'bg-secondary border-transparent text-muted-foreground hover:bg-accent'
                      }`}
                  >
                    {src === 'pexels' && <Video className="w-3.5 h-3.5" />}
                    {(src === 'pollinations' || src === 'cloudflare') && <ImageIcon className="w-3.5 h-3.5" />}
                    {src === 'map' && <Map className="w-3.5 h-3.5" />}
                    <span className="capitalize">{src}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  {scene.visualSource === 'pexels' ? 'Search Query' : 
                   (scene.visualSource === 'pollinations' || scene.visualSource === 'cloudflare') ? 'Image Prompt' : 'Map Waypoints'}
                </label>
                {scene.visualSource !== 'map' && onRegenerateVisuals && (
                  <button 
                    onClick={() => onRegenerateVisuals(idx)} 
                    disabled={disabled}
                    className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 text-[10px] font-medium"
                  >
                    <RefreshCw className="w-3 h-3" /> Fetch / Generate
                  </button>
                )}
              </div>
              {scene.visualSource === 'pexels' && (
                <input 
                  type="text" 
                  value={scene.pexelsQuery || ''}
                  onChange={e => updateScene(idx, { pexelsQuery: e.target.value })}
                  disabled={disabled}
                  className="w-full bg-background border border-border rounded px-2 py-1.5 text-xs text-foreground outline-none focus:border-indigo-500"
                />
              )}
              {(scene.visualSource === 'pollinations' || scene.visualSource === 'cloudflare') && (
                <textarea 
                  value={scene.pollinationsPrompt || ''}
                  onChange={e => updateScene(idx, { pollinationsPrompt: e.target.value })}
                  disabled={disabled}
                  rows={2}
                  className="w-full bg-background border border-border rounded px-2 py-1.5 text-xs text-foreground outline-none focus:border-indigo-500 resize-none"
                />
              )}
              {scene.visualSource === 'map' && (
                <div className="text-xs text-muted-foreground bg-background border border-border rounded px-2 py-1.5 flex items-center gap-2">
                  <Map className="w-3.5 h-3.5 text-indigo-400" />
                  {scene.mapAnimation?.waypoints?.length || 0} waypoints plotted
                </div>
              )}
            </div>
          </div>

          {scene.visualSource === 'map' && scene.mapAnimation && (
            <div className="mt-2 w-full h-32 bg-background rounded border border-border flex items-center justify-center relative overflow-hidden">
               <div className="absolute inset-0 bg-[url('https://upload.wikimedia.org/wikipedia/commons/e/ec/World_map_blank_without_borders.svg')] bg-cover opacity-20" />
               <div className="flex flex-col items-center z-10 text-muted-foreground">
                 <Map className="w-8 h-8 mb-2 opacity-50 text-indigo-400" />
                 <span className="text-xs font-medium text-foreground">{(scene.mapAnimation?.type || 'route').toUpperCase()} ANIMATION</span>
                 <span className="text-[10px] mt-1">{scene.mapAnimation?.waypoints?.length || 0} waypoints plotted</span>
               </div>
            </div>
          )}

          {scene.layeredVisuals && scene.layeredVisuals.length > 0 && (
            <div className="mt-2 flex flex-col gap-1">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Multi-Layer Elements (BG + PIP)</label>
              <div className="grid grid-cols-2 gap-2">
                {scene.layeredVisuals.map((lv, lIdx) => (
                  <div key={lIdx} className="w-full h-20 bg-black rounded overflow-hidden relative border border-border">
                    <SequentialImage src={lv.url} alt={`Layer ${lIdx}`} className="w-full h-full object-cover" />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-1 text-[8px] text-white flex justify-between">
                      <span>{lv.isGreenScreen ? 'PIP (Green Screen)' : 'Background'}</span>
                      <span>Track {lv.trackOffset}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!scene.layeredVisuals && scene.visualOptions && scene.visualOptions.length > 0 && (
            <div className="mt-2 flex flex-col gap-1">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Alternative Clips</label>
              <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
                {scene.visualOptions.map((opt, oIdx) => (
                  <div 
                    key={oIdx} 
                    onClick={() => updateScene(idx, { selectedVisualUrl: opt.url })}
                    className={`w-24 h-16 shrink-0 rounded overflow-hidden cursor-pointer border-2 transition-all ${
                      (scene.selectedVisualUrl === opt.url || (!scene.selectedVisualUrl && oIdx === 0)) 
                        ? 'border-indigo-500 opacity-100' 
                        : 'border-transparent opacity-50 hover:opacity-100'
                    }`}
                  >
                    <SequentialImage src={opt.thumbnail || opt.url} alt="thumbnail" className="w-full h-full object-cover bg-black" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {scene.selectedVisualUrl && scene.visualOptions?.find(o => o.url === scene.selectedVisualUrl)?.type === 'video' && (
             <div className="mt-2 bg-background border border-border p-2 rounded">
               <AutoVideoPreviewTrimmer 
                 url={scene.selectedVisualUrl} 
                 type="video" 
                 duration={scene.visualOptions?.find(o => o.url === scene.selectedVisualUrl)?.duration || 15}
                 onTrimChange={(start, end) => updateScene(idx, { mediaStartTime: start, mediaEndTime: end })}
               />
               <div className="text-[10px] text-muted-foreground mt-2 flex justify-between items-center">
                 <span>Previewing: <span className="text-foreground">{scene.mediaStartTime?.toFixed(1) || 0}s</span> to <span className="text-foreground">{scene.mediaEndTime?.toFixed(1) || (scene.mediaStartTime || 0) + scene.duration}s</span></span>
                 <span className="text-indigo-400">Fixed Dialogue Target: {scene.duration.toFixed(1)}s</span>
               </div>
             </div>
          )}
        </div>
      ))}
    </div>
  );
};
