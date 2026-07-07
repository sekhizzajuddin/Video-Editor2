import React, { useState, useEffect } from 'react';
import { Sparkles, X, Loader2 } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { AIMotionGraphicSuggestion } from '@/utils/aiClient';
import { TITLE_TEMPLATES } from '@/utils/titleTemplates';

interface AiMotionGraphicsProps {
  clip: any;
  suggestions: AIMotionGraphicSuggestion[];
  onClose: () => void;
}

export function AiMotionGraphicsDesigner({ clip, suggestions, onClose }: AiMotionGraphicsProps) {
  const { tracks, addMedia, addClip, addTrack } = useEditorStore();
  const [selectedSuggestions, setSelectedSuggestions] = useState<Record<number, boolean>>({});
  const [customTexts, setCustomTexts] = useState<Record<number, string>>({});
  const [isApplying, setIsApplying] = useState(false);

  useEffect(() => {
    const defaults: Record<number, boolean> = {};
    const texts: Record<number, string> = {};
    suggestions.forEach((s, idx) => {
      defaults[idx] = true; // Checked by default
      texts[idx] = s.suggestedText;
    });
    setSelectedSuggestions(defaults);
    setCustomTexts(texts);
  }, [suggestions]);

  const handleApply = async () => {
    setIsApplying(true);

    // 1. Find or create a text track
    let textTrack = tracks.find((t) => t.type === 'text');
    if (!textTrack) {
      addTrack('text');
      const updatedTracks = useEditorStore.getState().tracks;
      textTrack = updatedTracks.find((t) => t.type === 'text');
    }

    if (!textTrack) {
      alert('Could not find or create a text track on the timeline.');
      setIsApplying(false);
      return;
    }

    useEditorStore.getState().startTransaction();
    try {
      for (let i = 0; i < suggestions.length; i++) {
        if (!selectedSuggestions[i]) continue;
        const suggestion = suggestions[i];
        const textVal = customTexts[i] || suggestion.suggestedText;

        const tmpl = TITLE_TEMPLATES.find((t) => t.id === suggestion.templateId);
        if (!tmpl) continue;

        const mediaId = `tmpl_media_${Math.random().toString(36).substring(2, 11)}`;
        const clipId  = `tmpl_clip_${Math.random().toString(36).substring(2, 11)}`;

        // Global start time = clip.startTime + suggestion.start
        const globalStart = clip.startTime + suggestion.start;

        addMedia({
          id: mediaId,
          name: tmpl.name,
          type: 'text',
          duration: tmpl.defaultDuration,
          url: '',
          createdAt: Date.now(),
        });

        addClip({
          id: clipId,
          mediaId,
          trackId: textTrack.id,
          startTime: globalStart,
          duration: tmpl.defaultDuration,
          trimStart: 0,
          trimEnd: 0,
          transform: { x: 0, y: 0, scale: 100, rotation: 0 },
          opacity: 1,
          speed: 1,
          effects: [],
          textSettings: { 
            ...tmpl.textSettings, 
            text: textVal 
          },
          animations: tmpl.animations ? { ...tmpl.animations } : undefined,
        } as any);

        useEditorStore.getState().selectClip(clipId);
      }
      useEditorStore.getState().saveSnapshot();
      onClose();
    } catch (err) {
      console.error('Failed to apply suggested motion graphics:', err);
      alert('Failed to apply motion graphics.');
    } finally {
      useEditorStore.getState().endTransaction();
      setIsApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl bg-[#1e1e1e] border border-[#3e3e3e] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#3e3e3e] bg-[#222] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-teal-400 animate-pulse" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">AI Suggested Motion Graphics</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-[#2d2d2d] text-[#8a8a8a] hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 scrollbar-thin">
          {suggestions.map((suggestion, idx) => {
            const tmpl = TITLE_TEMPLATES.find((t) => t.id === suggestion.templateId) || {
              name: suggestion.templateId,
              description: 'Motion Graphic Template',
              accentColor: '#0d9488',
              category: 'Motion Graphic'
            };

            return (
              <div 
                key={idx}
                className={`p-3 rounded-lg border transition-all ${
                  selectedSuggestions[idx] 
                    ? 'bg-[#182828]/25 border-teal-500/40 shadow-sm' 
                    : 'bg-[#222]/30 border-[#2d2d2d] opacity-50'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={!!selectedSuggestions[idx]}
                    onChange={(e) => setSelectedSuggestions({ ...selectedSuggestions, [idx]: e.target.checked })}
                    className="w-4 h-4 mt-1 accent-teal-500 cursor-pointer rounded"
                  />

                  {/* Details */}
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span 
                          className="px-2 py-0.5 rounded-[4px] text-[8px] font-bold uppercase tracking-wider text-black"
                          style={{ backgroundColor: tmpl.accentColor }}
                        >
                          {tmpl.category}
                        </span>
                        <h4 className="text-xs font-bold text-white">{tmpl.name}</h4>
                      </div>
                      <span className="text-[10px] text-teal-400 font-mono font-semibold">
                        At {suggestion.start.toFixed(1)}s - {(suggestion.start + (tmpl.defaultDuration || 4)).toFixed(1)}s
                      </span>
                    </div>

                    <p className="text-[10px] text-[#a0a0a0] leading-relaxed">
                      <strong>AI Suggestion:</strong> {suggestion.reason}
                    </p>

                    {/* Edit text input */}
                    <div className="flex flex-col gap-1 bg-[#141414] p-2 rounded border border-[#2d2d2d]">
                      <label className="text-[9px] text-[#6a6a6a] font-medium uppercase tracking-wider">Custom Overlay Text</label>
                      <input
                        type="text"
                        value={customTexts[idx] ?? ''}
                        disabled={!selectedSuggestions[idx]}
                        onChange={(e) => setCustomTexts({ ...customTexts, [idx]: e.target.value })}
                        className="bg-[#1c1c1c] text-white text-xs border border-[#2d2d2d] focus:border-teal-500 rounded px-2.5 py-1.5 focus:outline-none w-full disabled:opacity-50"
                        placeholder="Customize text here..."
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-[#3e3e3e] bg-[#222] flex items-center justify-between">
          <span className="text-[10px] text-[#8a8a8a]">
            Selected: {Object.values(selectedSuggestions).filter(Boolean).length} / {suggestions.length} templates
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 border border-[#3e3e3e] hover:bg-[#2d2d2d] rounded-lg text-xs text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={isApplying || Object.values(selectedSuggestions).filter(Boolean).length === 0}
              className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shadow"
            >
              {isApplying ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Applying...
                </>
              ) : (
                'Apply to Timeline'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
