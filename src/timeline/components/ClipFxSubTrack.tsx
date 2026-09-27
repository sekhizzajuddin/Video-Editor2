import React from 'react';
import { Sparkles, ChevronDown, ChevronUp, Eye, EyeOff, X, RefreshCw, Wand2 } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import type { TimelineClip } from '@/types';
import { toast } from 'sonner';

interface ClipFxSubTrackProps {
  clip: TimelineClip;
  width: number;
  trackLocked?: boolean;
}

export const ClipFxSubTrack = React.memo(function ClipFxSubTrack({
  clip,
  width,
  trackLocked = false,
}: ClipFxSubTrackProps) {
  const fxSettings = clip.fxSettings;
  if (!fxSettings) return null;

  const isEnabled = fxSettings.enabled !== false;
  const isCollapsed = fxSettings.isCollapsed ?? true;
  const isCustomAi = fxSettings.type === 'custom_html';
  const fxName = fxSettings.customFxName || (isCustomAi ? 'Custom AI FX' : fxSettings.type.replace(/_/g, ' '));
  const intensity = fxSettings.intensity ?? 100;

  const toggleCollapsed = (e: React.MouseEvent) => {
    e.stopPropagation();
    useEditorStore.getState().updateClip(clip.id, {
      fxSettings: {
        ...fxSettings,
        isCollapsed: !isCollapsed,
      },
    });
  };

  const toggleEnabled = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextEnabled = !isEnabled;
    useEditorStore.getState().updateClip(clip.id, {
      fxSettings: {
        ...fxSettings,
        enabled: nextEnabled,
      },
    });
    toast.info(nextEnabled ? `FX enabled on ${(clip as any).name || clip.id}` : `FX bypassed on ${(clip as any).name || clip.id}`);
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    useEditorStore.getState().updateClip(clip.id, {
      fxSettings: undefined,
    });
    useEditorStore.getState().saveSnapshot('Remove FX from Clip');
    toast.success(`Removed FX from ${(clip as any).name || clip.id}`);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isCustomAi) {
      useEditorStore.getState().openCustomFxMaker(clip.id);
    } else {
      useEditorStore.getState().setActivePropertiesTab('effects');
      useEditorStore.getState().selectClip(clip.id);
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isCustomAi) {
      useEditorStore.getState().openCustomFxMaker(clip.id);
    }
  };

  // Semi-Collapsed View (Sleek 18px top ribbon directly over the clip)
  if (isCollapsed) {
    return (
      <div
        className={`absolute top-0 left-0 right-0 h-[18px] z-30 pointer-events-auto select-none overflow-hidden transition-all duration-150 flex items-center justify-between px-1.5 rounded-t ${
          isEnabled
            ? 'bg-gradient-to-r from-rose-950/95 via-purple-950/90 to-slate-900/95 border-b border-rose-500/40 text-rose-200 shadow-sm'
            : 'bg-slate-950/90 border-b border-slate-700/40 text-slate-400 opacity-60'
        }`}
        onClick={(e) => {
          e.stopPropagation();
          useEditorStore.getState().selectClip(clip.id);
        }}
        onDoubleClick={handleDoubleClick}
        title={`FX Sub-Track: ${fxName} (${isEnabled ? 'Active' : 'Bypassed'}). Double-click to edit/re-generate.`}
      >
        <div className="flex items-center gap-1 min-w-0 pr-1">
          <Sparkles className={`w-2.5 h-2.5 shrink-0 ${isEnabled ? 'text-amber-400 animate-pulse' : 'text-slate-500'}`} />
          {width > 65 && (
            <span className="text-[8px] font-bold truncate max-w-[140px] tracking-tight">
              {fxName}
            </span>
          )}
          {width > 120 && isCustomAi && (
            <span className="text-[6.5px] font-bold px-1 py-px rounded bg-rose-500/25 text-rose-300 border border-rose-500/30 leading-none">
              AI OVERLAY
            </span>
          )}
          {!isEnabled && (
            <span className="text-[6.5px] font-bold px-1 py-px rounded bg-red-500/20 text-red-400 border border-red-500/30 leading-none">
              BYPASSED
            </span>
          )}
        </div>

        {!trackLocked && (
          <div className="flex items-center gap-0.5 shrink-0 ml-1">
            {/* Eye / Bypass Toggle */}
            <button
              onClick={toggleEnabled}
              title={isEnabled ? 'Bypass FX' : 'Enable FX'}
              className="p-0.5 rounded hover:bg-white/10 text-rose-300/80 hover:text-white transition-colors"
            >
              {isEnabled ? <Eye className="w-2.5 h-2.5 text-rose-400" /> : <EyeOff className="w-2.5 h-2.5 text-slate-500" />}
            </button>

            {/* Expand Toggle */}
            <button
              onClick={toggleCollapsed}
              title="Expand FX Sub-Track"
              className="p-0.5 rounded hover:bg-white/10 text-rose-300/80 hover:text-white transition-colors"
            >
              <ChevronDown className="w-2.5 h-2.5" />
            </button>

            {/* Remove Button */}
            {width > 90 && (
              <button
                onClick={handleRemove}
                title="Remove FX from Clip"
                className="p-0.5 rounded hover:bg-red-500/20 text-rose-300/60 hover:text-red-400 transition-colors"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // Expanded View (Full 36px Sub-Track Lane with In-Depth Controls directly over the clip)
  return (
    <div
      className={`absolute top-0 left-0 right-0 h-[36px] z-30 pointer-events-auto select-none overflow-hidden transition-all duration-150 flex flex-col justify-between p-1 rounded-t border-b ${
        isEnabled
          ? 'bg-gradient-to-br from-slate-950/95 via-rose-950/90 to-purple-950/95 border-rose-500/50 text-rose-200 shadow-md'
          : 'bg-slate-950/90 border-slate-700/50 text-slate-400 opacity-70'
      }`}
      onClick={(e) => {
        e.stopPropagation();
        useEditorStore.getState().selectClip(clip.id);
      }}
      title={`FX Sub-Track: ${fxName}. Double-click to edit/re-generate.`}
    >
      {/* Top Header Row */}
      <div className="flex items-center justify-between min-w-0">
        <div className="flex items-center gap-1.5 min-w-0 pr-1">
          <Sparkles className={`w-3 h-3 shrink-0 ${isEnabled ? 'text-amber-400 animate-pulse' : 'text-slate-500'}`} />
          <span className="text-[9px] font-bold text-white truncate max-w-[180px] drop-shadow-sm">
            {fxName}
          </span>
          <span className="text-[7px] font-bold px-1 py-0.5 rounded bg-rose-500/25 text-rose-300 border border-rose-500/30 leading-none">
            {isCustomAi ? 'AI MOTION FX' : 'VFX'}
          </span>
        </div>

        {!trackLocked && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={toggleCollapsed}
              title="Collapse FX Sub-Track"
              className="p-0.5 rounded hover:bg-white/10 text-rose-300/80 hover:text-white transition-colors"
            >
              <ChevronUp className="w-3 h-3" />
            </button>
            <button
              onClick={handleRemove}
              title="Remove FX from Clip"
              className="p-0.5 rounded hover:bg-red-500/20 text-rose-300/60 hover:text-red-400 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Bottom Controls Row */}
      <div className="flex items-center gap-1.5 pt-0.5 text-[8px]">
        {/* Re-Think / Edit Button */}
        {isCustomAi && (
          <button
            onClick={handleEdit}
            title="Open AI Custom FX Maker to re-think or modify"
            className="flex items-center gap-1 px-1.5 py-0.5 bg-gradient-to-r from-rose-600/40 to-purple-600/40 hover:from-rose-600/60 hover:to-purple-600/60 text-rose-200 border border-rose-500/40 rounded font-semibold transition-all hover:scale-105 active:scale-95 shadow-sm"
          >
            <Wand2 className="w-2.5 h-2.5 text-amber-300" />
            <span>Re-Think FX</span>
          </button>
        )}

        {/* Bypass / Enable Toggle */}
        <button
          onClick={toggleEnabled}
          title={isEnabled ? 'Bypass FX' : 'Enable FX'}
          className={`flex items-center gap-1 px-1.5 py-0.5 rounded font-medium border transition-colors ${
            isEnabled
              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30'
              : 'bg-red-500/20 border-red-500/40 text-red-300 hover:bg-red-500/30'
          }`}
        >
          {isEnabled ? <Eye className="w-2.5 h-2.5" /> : <EyeOff className="w-2.5 h-2.5" />}
          <span>{isEnabled ? 'Active' : 'Bypassed'}</span>
        </button>

        {/* Intensity indicator */}
        <span className="text-[7.5px] text-rose-300/70 font-mono ml-auto">
          {intensity}%
        </span>
      </div>
    </div>
  );
});
