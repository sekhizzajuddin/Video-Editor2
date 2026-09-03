// ─────────────────────────────────────────────────────────────────────────────
// [SHARED CORE] Used by BOTH the desktop editor (src/App.tsx → DesktopApp) and
// the mobile editor (src/mobile/App.tsx → MobileApp). There is NO separate mobile
// copy — edit ONCE here. LOGIC / ARCHITECTURE / BUGFIX changes automatically apply
// to both UIs. UI-only changes belong in the individual UI layer instead.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { useShallow } from 'zustand/react/shallow';
import { getAspectRatioMetadata } from '@/utils/aspectRatioHelper';
import { Monitor, Smartphone, Layout, ArrowRight, Check, X } from 'lucide-react';
import { toast } from 'sonner';

export function AspectRatioConflictModal() {
  const { aspectRatioConflictData, resolveAspectRatioConflict, setAspectRatioConflictData } = useEditorStore(
    useShallow(s => ({
      aspectRatioConflictData: s.aspectRatioConflictData,
      resolveAspectRatioConflict: s.resolveAspectRatioConflict,
      setAspectRatioConflictData: s.setAspectRatioConflictData,
    }))
  );
  const [dontAskAgain, setDontAskAgain] = useState(false);

  if (!aspectRatioConflictData) return null;

  const { mediaName, videoWidth, videoHeight, detectedRatio, currentRatio } = aspectRatioConflictData;
  const detectedMeta = getAspectRatioMetadata(detectedRatio);
  const currentMeta = getAspectRatioMetadata(currentRatio);

  const handleApplyNewRatio = () => {
    resolveAspectRatioConflict(true, dontAskAgain);
    toast.success(`Project canvas aspect ratio updated to ${detectedMeta.shortLabel}!`, {
      description: `All clips have been reframed to fill the new ${detectedRatio} aspect ratio.`,
    });
  };

  const handleKeepCurrentRatio = () => {
    resolveAspectRatioConflict(false, dontAskAgain);
    toast.info(`Project aspect ratio retained as ${currentMeta.shortLabel}.`);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl text-zinc-100">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <Layout className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Aspect Ratio Mismatch</h3>
              <p className="text-xs text-zinc-400">First video clip added to project</p>
            </div>
          </div>
          <button
            onClick={handleKeepCurrentRatio}
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Message */}
        <div className="my-5 space-y-4">
          <p className="text-sm text-zinc-300 leading-relaxed">
            The video clip <span className="font-semibold text-indigo-300">"{mediaName}"</span> ({videoWidth}×{videoHeight}) has a different aspect ratio than your project canvas.
          </p>

          {/* Comparison Cards */}
          <div className="grid grid-cols-2 gap-3">
            {/* Current Project Ratio */}
            <div className="flex flex-col items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 text-center">
              <span className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold mb-2">Current Canvas</span>
              <div className={`my-2 flex items-center justify-center rounded border border-zinc-700 bg-zinc-800/80 ${currentMeta.previewClass}`}>
                <span className="text-[10px] font-mono text-zinc-400">{currentRatio}</span>
              </div>
              <span className="text-xs font-medium text-zinc-300 mt-2">{currentMeta.shortLabel}</span>
            </div>

            {/* Detected Video Ratio */}
            <div className="flex flex-col items-center justify-between rounded-lg border border-indigo-500/40 bg-indigo-950/20 p-4 text-center">
              <span className="text-[11px] uppercase tracking-wider text-indigo-400 font-semibold mb-2">Clip Resolution</span>
              <div className={`my-2 flex items-center justify-center rounded border border-indigo-500/50 bg-indigo-900/40 ${detectedMeta.previewClass}`}>
                <span className="text-[10px] font-mono text-indigo-200 font-bold">{detectedRatio}</span>
              </div>
              <span className="text-xs font-semibold text-indigo-300 mt-2">{detectedMeta.shortLabel}</span>
            </div>
          </div>
        </div>

        {/* Don't Ask Again */}
        <div className="mb-6 flex items-center gap-2">
          <input
            type="checkbox"
            id="dontAskAgain"
            checked={dontAskAgain}
            onChange={(e) => setDontAskAgain(e.target.value ? e.target.checked : false)}
            className="h-4 w-4 rounded border-zinc-700 bg-zinc-800 text-indigo-600 focus:ring-indigo-500"
          />
          <label htmlFor="dontAskAgain" className="text-xs text-zinc-400 cursor-pointer select-none">
            Remember choice & don't ask again for this project
          </label>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-zinc-800 pt-4">
          <button
            onClick={handleKeepCurrentRatio}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors"
          >
            Keep {currentRatio} Canvas
          </button>

          <button
            onClick={handleApplyNewRatio}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 transition-colors"
          >
            <Check className="h-4 w-4" />
            Switch to {detectedRatio} ({detectedMeta.shortLabel.split(' ')[0]})
          </button>
        </div>
      </div>
    </div>
  );
}
