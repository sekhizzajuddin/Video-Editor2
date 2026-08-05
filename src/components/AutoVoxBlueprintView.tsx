import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Trash2, ZoomIn, RefreshCw, Loader2, X, ChevronDown, Sparkles } from 'lucide-react';
import { AutoVideoBlueprintV2, AutoVideoSceneV2 } from '../utils/aiClient';
import { generateImageFromCloudflare } from '../utils/cloudflareClient';
import { useEditorStore } from '../store/editorStore';

// ---------------------------------------------------------------------------
// Global sequential queue to avoid Cloudflare API rate-limit bursts
// ---------------------------------------------------------------------------
let cfQueue: Promise<void> = Promise.resolve();

// ---------------------------------------------------------------------------
// ImageTile — auto-generates from Cloudflare, re-generates when prompt changes
// ---------------------------------------------------------------------------
interface ImageTileProps {
  prompt: string;
  resolvedUrl?: string;
  settings: any;
  onPreview: (url: string | null) => void;
  onDelete?: () => void;
  onUrlResolved?: (url: string) => void;
  width?: string;
  height?: string;
}

function ImageTile({ prompt, resolvedUrl, settings, onPreview, onDelete, onUrlResolved, width = 'w-32', height = 'h-20' }: ImageTileProps) {
  const [url, setUrl] = useState<string | null>(resolvedUrl ?? null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const lastPromptRef = useRef<string>('');
  const cancelledRef = useRef(false);

  const generate = useCallback(async () => {
    const accountId = settings?.cloudflareAccountId || import.meta.env.VITE_CLOUDFLARE_ACCOUNT_ID;
    const apiToken = settings?.cloudflareApiToken || import.meta.env.VITE_CLOUDFLARE_API_TOKEN;
    if (!accountId || !apiToken || !prompt) return;

    cancelledRef.current = false;
    setStatus('loading');
    setUrl(null);

    // Queue sequentially to avoid rate-limits
    const myTurn = cfQueue.then(async () => {
      if (cancelledRef.current) return;
      try {
        await new Promise(r => setTimeout(r, 600)); // small spacing
        if (cancelledRef.current) return;
        const result = await generateImageFromCloudflare(prompt, accountId, apiToken);
        if (cancelledRef.current) return;
        setUrl(result);
        setStatus('idle');
        onUrlResolved?.(result);
      } catch (e) {
        if (!cancelledRef.current) setStatus('error');
      }
    });
    cfQueue = myTurn.catch(() => {});
  }, [prompt, settings, onUrlResolved]);

  useEffect(() => {
    if (prompt !== lastPromptRef.current) {
      lastPromptRef.current = prompt;
      if (resolvedUrl) {
        // use cached URL if prompt didn't change externally
        setUrl(resolvedUrl);
        setStatus('idle');
      } else {
        generate();
      }
    }
    return () => { cancelledRef.current = true; };
  }, [prompt, resolvedUrl]); // Re-generate whenever prompt changes

  return (
    <div className={`relative shrink-0 rounded-lg overflow-hidden bg-[#111] border border-[#2a2a2a] group cursor-pointer ${width} ${height}`}>
      {/* Loading state */}
      {status === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-[#111]">
          <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
          <span className="text-[9px] text-[#6a6a6a] text-center px-1">Generating...</span>
        </div>
      )}

      {/* Error state */}
      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 p-2 bg-[#111]">
          <span className="text-[9px] text-red-400 text-center">Failed</span>
          <button
            onClick={(e) => { e.stopPropagation(); generate(); }}
            className="text-[9px] text-indigo-400 hover:text-indigo-300 underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Image */}
      {url && (
        <img
          src={url}
          alt="Generated"
          className="w-full h-full object-cover"
          onClick={() => onPreview(url)}
        />
      )}

      {/* Hover overlay — click to preview */}
      {url && (
        <div
          className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100"
          onClick={() => onPreview(url)}
        >
          <ZoomIn className="w-4 h-4 text-white" />
        </div>
      )}

      {/* Delete button */}
      {onDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="absolute top-1 right-1 p-0.5 bg-red-500/80 hover:bg-red-600 rounded transition-opacity opacity-0 group-hover:opacity-100 z-10"
          title="Delete"
        >
          <Trash2 className="w-2.5 h-2.5 text-white" />
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Image Preview Modal with editable prompt
// ---------------------------------------------------------------------------
interface PreviewModalProps {
  prompt: string;
  url: string | null;
  onClose: () => void;
  onPromptChange: (newPrompt: string) => void;
}

function ImagePreviewModal({ prompt, url, onClose, onPromptChange }: PreviewModalProps) {
  const [editPrompt, setEditPrompt] = useState(prompt);
  const changed = editPrompt.trim() !== prompt.trim();

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl max-w-xl w-full p-5 flex flex-col gap-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-white flex items-center gap-2">
            <ZoomIn className="w-4 h-4 text-indigo-400" /> Image Preview
          </span>
          <button onClick={onClose} className="text-[#6a6a6a] hover:text-white rounded p-1 hover:bg-white/10">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Image */}
        <div className="w-full aspect-video rounded-xl overflow-hidden bg-black/40 flex items-center justify-center">
          {url ? (
            <img src={url} alt="Preview" className="w-full h-full object-contain" />
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
              <span className="text-xs text-[#6a6a6a]">Generating image...</span>
            </div>
          )}
        </div>

        {/* Prompt editor */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-semibold text-[#8a8a8a] uppercase tracking-wider">
            Image Prompt — edit and apply to regenerate
          </label>
          <textarea
            value={editPrompt}
            onChange={(e) => setEditPrompt(e.target.value)}
            className="w-full h-20 bg-[#0e0e0e] border border-[#2a2a2a] focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-white outline-none resize-none"
          />
        </div>

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-[#8a8a8a] hover:text-white border border-[#2a2a2a] rounded-lg transition-colors"
          >
            Close
          </button>
          <button
            onClick={() => { if (changed) { onPromptChange(editPrompt.trim()); onClose(); } }}
            disabled={!changed}
            className="px-4 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Apply & Regenerate
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AutoVoxBlueprintView — Main exported component
// ---------------------------------------------------------------------------
export interface AutoVoxBlueprintViewProps {
  blueprint: AutoVideoBlueprintV2;
  onChange: (updated: AutoVideoBlueprintV2) => void;
  disabled?: boolean;
}

export function AutoVoxBlueprintView({ blueprint, onChange, disabled }: AutoVoxBlueprintViewProps) {
  const settings = useEditorStore((s) => s.settings) as any;

  // Preview modal state
  const [previewModal, setPreviewModal] = useState<{
    url: string | null;
    prompt: string;
    onPromptChange: (p: string) => void;
  } | null>(null);

  // ── Backgrounds helpers ──────────────────────────────────────────────────

  const updateBgPrompt = (bgIdx: number, newPrompt: string) => {
    const newBgs = blueprint.globalBackgrounds.map((bg, i) =>
      i === bgIdx ? { prompt: newPrompt, resolvedUrl: undefined } : bg
    );
    onChange({ ...blueprint, globalBackgrounds: newBgs });
  };

  const setBgUrl = (bgIdx: number, url: string) => {
    const newBgs = blueprint.globalBackgrounds.map((bg, i) =>
      i === bgIdx ? { ...bg, resolvedUrl: url } : bg
    );
    onChange({ ...blueprint, globalBackgrounds: newBgs });
  };

  const deleteBg = (bgIdx: number) => {
    if (blueprint.globalBackgrounds.length <= 1) return;
    const newBgs = blueprint.globalBackgrounds.filter((_, i) => i !== bgIdx);
    const newScenes = blueprint.scenes.map((s) => ({
      ...s,
      selectedBackgroundIndex: Math.min(s.selectedBackgroundIndex, newBgs.length - 1)
    }));
    onChange({ ...blueprint, globalBackgrounds: newBgs, scenes: newScenes });
  };

  const addBackground = () => {
    const newBg = { prompt: `cinematic backdrop related to: ${blueprint.storyTheme}` };
    onChange({ ...blueprint, globalBackgrounds: [...blueprint.globalBackgrounds, newBg] });
  };

  // ── Scene/PIP helpers ────────────────────────────────────────────────────

  const updateSceneBg = (sceneIdx: number, bgIdx: number) => {
    const newScenes = blueprint.scenes.map((s, i) =>
      i === sceneIdx ? { ...s, selectedBackgroundIndex: bgIdx } : s
    );
    onChange({ ...blueprint, scenes: newScenes });
  };

  const updatePipPrompt = (sceneIdx: number, pipIdx: number, newPrompt: string) => {
    const newScenes = blueprint.scenes.map((s, i) => {
      if (i !== sceneIdx) return s;
      const newPips = s.pipItems.map((p, j) =>
        j === pipIdx ? { prompt: newPrompt, resolvedUrl: undefined } : p
      );
      return { ...s, pipItems: newPips };
    });
    onChange({ ...blueprint, scenes: newScenes });
  };

  const setPipUrl = (sceneIdx: number, pipIdx: number, url: string) => {
    const newScenes = blueprint.scenes.map((s, i) => {
      if (i !== sceneIdx) return s;
      const newPips = s.pipItems.map((p, j) =>
        j === pipIdx ? { ...p, resolvedUrl: url } : p
      );
      return { ...s, pipItems: newPips };
    });
    onChange({ ...blueprint, scenes: newScenes });
  };

  const deletePip = (sceneIdx: number, pipIdx: number) => {
    const newScenes = blueprint.scenes.map((s, i) => {
      if (i !== sceneIdx) return s;
      return { ...s, pipItems: s.pipItems.filter((_, j) => j !== pipIdx) };
    });
    onChange({ ...blueprint, scenes: newScenes });
  };

  const addPip = (sceneIdx: number) => {
    const scene = blueprint.scenes[sceneIdx];
    const newPip = { prompt: `${scene.narration} — foreground element, isolated on #00FF00 green screen` };
    const newScenes = blueprint.scenes.map((s, i) =>
      i === sceneIdx ? { ...s, pipItems: [...s.pipItems, newPip] } : s
    );
    onChange({ ...blueprint, scenes: newScenes });
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4">
      {/* ── Story Theme ─────────────────────────────────── */}
      <div className="bg-gradient-to-r from-indigo-900/30 to-violet-900/20 border border-indigo-700/30 rounded-xl p-3.5 flex items-start gap-3">
        <Sparkles className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
        <div>
          <div className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest mb-1">Story Theme</div>
          <div className="text-xs text-white/90 leading-snug">{blueprint.storyTheme}</div>
        </div>
      </div>

      {/* ── Global Backgrounds ──────────────────────────── */}
      <div className="bg-[#181818] border border-[#252525] rounded-xl p-3.5">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[9px] font-bold text-[#7a7a7a] uppercase tracking-widest">
            Global Backgrounds ({blueprint.globalBackgrounds.length})
          </div>
          <button
            onClick={addBackground}
            disabled={disabled}
            className="flex items-center gap-1 text-[10px] text-indigo-400 hover:text-indigo-300 disabled:opacity-40 border border-indigo-700/40 hover:border-indigo-500 rounded-md px-2 py-1 transition-colors"
          >
            <Plus className="w-3 h-3" /> Add
          </button>
        </div>

        <div className="flex gap-3 flex-wrap">
          {blueprint.globalBackgrounds.map((bg, bgIdx) => (
            <div key={`bg-${bgIdx}-${bg.prompt.substring(0, 20)}`} className="flex flex-col gap-1 items-center">
              <div className="text-[9px] text-[#5a5a5a] font-medium">BG {bgIdx + 1}</div>
              <ImageTile
                prompt={bg.prompt}
                resolvedUrl={bg.resolvedUrl}
                settings={settings}
                width="w-36"
                height="h-24"
                onPreview={(url) => setPreviewModal({
                  url,
                  prompt: bg.prompt,
                  onPromptChange: (p) => updateBgPrompt(bgIdx, p)
                })}
                onDelete={blueprint.globalBackgrounds.length > 1 ? () => deleteBg(bgIdx) : undefined}
                onUrlResolved={(url) => setBgUrl(bgIdx, url)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── Dialogue Rows ───────────────────────────────── */}
      {blueprint.scenes.map((scene, sceneIdx) => (
        <div
          key={`scene-${sceneIdx}`}
          className="bg-[#181818] border border-[#252525] rounded-xl p-3.5"
        >
          {/* Row header */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1 min-w-0">
              <div className="text-[9px] font-bold text-[#5a5a5a] uppercase tracking-widest mb-1">
                Dialogue {sceneIdx + 1} &nbsp;·&nbsp; {scene.startTime.toFixed(1)}s – {scene.endTime.toFixed(1)}s &nbsp;·&nbsp; {scene.duration.toFixed(1)}s
              </div>
              <div className="text-xs text-[#b0b0b0] leading-snug line-clamp-2">
                "{scene.narration}"
              </div>
            </div>

            {/* Background selector */}
            <div className="flex flex-col gap-1 shrink-0">
              <div className="text-[9px] text-[#5a5a5a] font-medium">Background</div>
              <div className="relative">
                <select
                  value={scene.selectedBackgroundIndex}
                  onChange={(e) => updateSceneBg(sceneIdx, parseInt(e.target.value))}
                  disabled={disabled}
                  className="appearance-none bg-[#0e0e0e] border border-[#2a2a2a] hover:border-indigo-600 focus:border-indigo-500 rounded-lg px-2.5 py-1 pr-6 text-[11px] text-white outline-none cursor-pointer disabled:opacity-50 transition-colors"
                >
                  {blueprint.globalBackgrounds.map((_, bgIdx) => (
                    <option key={bgIdx} value={bgIdx}>BG {bgIdx + 1}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[#6a6a6a] pointer-events-none" />
              </div>
            </div>
          </div>

          {/* PIP content tiles — scrollable row if more than 3 */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-[#2a2a2a] scrollbar-track-transparent">
            {scene.pipItems.map((pip, pipIdx) => (
              <ImageTile
                key={`pip-${sceneIdx}-${pipIdx}-${pip.prompt.substring(0, 15)}`}
                prompt={pip.prompt}
                resolvedUrl={pip.resolvedUrl}
                settings={settings}
                width="w-32"
                height="h-20"
                onPreview={(url) => setPreviewModal({
                  url,
                  prompt: pip.prompt,
                  onPromptChange: (p) => updatePipPrompt(sceneIdx, pipIdx, p)
                })}
                onDelete={scene.pipItems.length > 1 ? () => deletePip(sceneIdx, pipIdx) : undefined}
                onUrlResolved={(url) => setPipUrl(sceneIdx, pipIdx, url)}
              />
            ))}

            {/* Add PIP tile */}
            {!disabled && (
              <button
                onClick={() => addPip(sceneIdx)}
                className="shrink-0 w-32 h-20 rounded-lg border border-dashed border-[#333] hover:border-indigo-600/60 flex flex-col items-center justify-center gap-1.5 transition-colors group"
              >
                <Plus className="w-4 h-4 text-[#5a5a5a] group-hover:text-indigo-400 transition-colors" />
                <span className="text-[9px] text-[#5a5a5a] group-hover:text-indigo-400 transition-colors">Add Content</span>
              </button>
            )}
          </div>
        </div>
      ))}

      {/* Preview Modal */}
      {previewModal && (
        <ImagePreviewModal
          prompt={previewModal.prompt}
          url={previewModal.url}
          onClose={() => setPreviewModal(null)}
          onPromptChange={previewModal.onPromptChange}
        />
      )}
    </div>
  );
}
