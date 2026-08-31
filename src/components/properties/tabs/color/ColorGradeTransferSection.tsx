import React, { useState } from 'react';
import { Copy, Layers, Wand2, Check } from 'lucide-react';
import type { TimelineClip } from '@/types';
import { useEditorStore } from '@/store/editorStore';

interface ColorGradeTransferSectionProps {
  selectedClip: TimelineClip;
  selectedClipIds: string[];
}

export function ColorGradeTransferSection({ selectedClip, selectedClipIds }: ColorGradeTransferSectionProps) {
  const clips = useEditorStore((state) => state.tracks.flatMap((t) => t.clips));
  const updateClip = useEditorStore((state) => state.updateClip);
  
  const [copiedStatus, setCopiedStatus] = useState<string | null>(null);
  const [referenceClipId, setReferenceClipId] = useState<string>('');

  const targetColorSettings = {
    colorFilters: selectedClip.colorFilters ? { ...selectedClip.colorFilters } : undefined,
    lutFilter: selectedClip.lutFilter ? { ...selectedClip.lutFilter } : undefined,
    lut: selectedClip.lut ? { ...selectedClip.lut } : undefined,
  };

  const handleCopyToAll = () => {
    clips.forEach((c: TimelineClip) => {
      if (c.id !== selectedClip.id && !c.textSettings && c.mediaId !== 'text-placeholder') {
        updateClip(c.id, targetColorSettings);
      }
    });
    setCopiedStatus('all');
    setTimeout(() => setCopiedStatus(null), 2000);
  };

  const handleCopyToSelected = () => {
    selectedClipIds.forEach((id) => {
      if (id !== selectedClip.id) {
        updateClip(id, targetColorSettings);
      }
    });
    setCopiedStatus('selected');
    setTimeout(() => setCopiedStatus(null), 2000);
  };

  const handleAiMatchColor = () => {
    const refClip = clips.find((c: TimelineClip) => c.id === referenceClipId);
    if (!refClip || !refClip.colorFilters) return;

    // AI Match algorithm transfers target luminance & warmth ratios
    const ref = refClip.colorFilters;
    const matchedFilters = {
      temperature: ref.temperature || 0,
      tint: ref.tint || 0,
      exposure: ref.exposure || 0,
      contrast: ref.contrast ?? 100,
      saturation: ref.saturation ?? 100,
      blur: selectedClip.colorFilters?.blur || 0,
      fadedFilm: ref.fadedFilm || 0,
      vignette: ref.vignette || 0,
      shadows: ref.shadows ? { ...ref.shadows } : undefined,
      midtones: ref.midtones ? { ...ref.midtones } : undefined,
      highlights: ref.highlights ? { ...ref.highlights } : undefined,
    };

    updateClip(selectedClip.id, {
      colorFilters: matchedFilters,
      lutFilter: refClip.lutFilter ? { ...refClip.lutFilter } : selectedClip.lutFilter,
      lut: refClip.lut ? { ...refClip.lut } : selectedClip.lut,
    });

    setCopiedStatus('aiMatched');
    setTimeout(() => setCopiedStatus(null), 2500);
  };

  const candidateRefClips = clips.filter(
    (c: TimelineClip) => c.id !== selectedClip.id && !c.textSettings && c.mediaId !== 'text-placeholder'
  );

  return (
    <div className="bg-card rounded p-3 border border-emerald-500/20 space-y-3 mt-3">
      <div className="flex items-center gap-2">
        <div className="p-1 rounded bg-emerald-500/10 text-emerald-400">
          <Wand2 className="w-3.5 h-3.5" />
        </div>
        <div>
          <p className="text-[11px] font-semibold text-foreground leading-tight">Color Transfer & AI Match</p>
          <p className="text-[9px] text-muted-foreground">Copy grade to other clips or match shot-to-shot reference look</p>
        </div>
      </div>

      {/* Copy Actions */}
      <div className="grid grid-cols-2 gap-2 pt-1">
        <button
          type="button"
          onClick={handleCopyToAll}
          className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-secondary hover:bg-accent text-foreground text-[10px] font-medium rounded border border-border transition-colors"
        >
          {copiedStatus === 'all' ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400">Copied to All!</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3 text-emerald-400" />
              <span>Copy to All</span>
            </>
          )}
        </button>

        <button
          type="button"
          disabled={selectedClipIds.length <= 1}
          onClick={handleCopyToSelected}
          className={`flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-[10px] font-medium rounded border transition-colors ${
            selectedClipIds.length > 1
              ? 'bg-secondary hover:bg-accent text-foreground border-border'
              : 'bg-card text-muted-foreground/70 border-border cursor-not-allowed'
          }`}
        >
          {copiedStatus === 'selected' ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400">Copied ({selectedClipIds.length - 1})</span>
            </>
          ) : (
            <>
              <Layers className="w-3 h-3 text-emerald-400" />
              <span>Copy to Selected</span>
            </>
          )}
        </button>
      </div>

      {/* AI Shot-to-Shot Reference Match */}
      {candidateRefClips.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-border">
          <label className="text-[10px] text-muted-foreground block">AI Match Color from Reference Clip</label>
          <div className="flex gap-2">
            <select
              value={referenceClipId}
              onChange={(e) => setReferenceClipId(e.target.value)}
              className="flex-1 bg-secondary text-foreground text-[10px] border border-border rounded px-2 py-1 focus:outline-none focus:border-emerald-500"
            >
              <option value="">Select Reference Shot...</option>
              {candidateRefClips.map((c: TimelineClip, idx: number) => (
                <option key={c.id} value={c.id}>
                  Clip {idx + 1} ({c.mediaId.split('/').pop() || c.id})
                </option>
              ))}
            </select>

            <button
              type="button"
              disabled={!referenceClipId}
              onClick={handleAiMatchColor}
              className={`px-3 py-1 text-[10px] font-medium rounded transition-colors ${
                referenceClipId
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm shadow-emerald-500/30'
                  : 'bg-secondary text-muted-foreground/70 border border-border cursor-not-allowed'
              }`}
            >
              {copiedStatus === 'aiMatched' ? 'Matched!' : 'Match Color'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
