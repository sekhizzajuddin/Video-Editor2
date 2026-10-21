import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Search,
  Sparkles,
  LayoutTemplate,
  Tv2,
  Columns2,
  Film,
  Play,
  Layers,
  Settings2,
  Check,
  ChevronRight,
  Plus,
  Trash2,
  SlidersHorizontal,
  Video,
  User,
  ExternalLink,
  Wand2,
} from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { useShallow } from 'zustand/react/shallow';
import {
  PRESENTATION_TEMPLATES,
  PresentationTemplate,
  PresentationCategory,
  applyPresentationTemplate,
  formatClipsToPresentation,
  renderPresentationCanvas,
} from '@/utils/presentationTemplates';
import { MOTION_TEMPLATES, MotionTemplate } from '@/utils/motionTemplates';
import { TemplatePreviewCard } from '../index';
import { toast } from 'sonner';

interface PresentationCardProps {
  tmpl: PresentationTemplate;
  selectedClipsCount: number;
  onApply: (tmpl: PresentationTemplate) => void;
  onFormatSelected: (tmpl: PresentationTemplate) => void;
  onCustomize: (tmpl: PresentationTemplate) => void;
  onDragStart: (e: React.DragEvent) => void;
}

const PresentationCard = React.memo(function PresentationCard({
  tmpl,
  selectedClipsCount,
  onApply,
  onFormatSelected,
  onCustomize,
  onDragStart,
}: PresentationCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (!isHovered) {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      // Render clean static thumbnail
      renderPresentationCanvas(ctx, canvas.width, canvas.height, 0.35, tmpl);
      return;
    }

    let startTime = performance.now();
    const duration = tmpl.defaultDuration || 6;

    const loop = (now: number) => {
      const elapsed = (now - startTime) / 1000;
      const progress = (elapsed % duration) / duration;
      renderPresentationCanvas(ctx, canvas.width, canvas.height, progress, tmpl);
      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, [isHovered, tmpl]);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="flex flex-col p-3 rounded-xl border border-[var(--theme-border)] hover:border-blue-500/50 bg-[var(--theme-bg-card)] hover:bg-[var(--theme-bg-subpanel)] transition-all group shadow-sm"
    >
      {/* Canvas Animated Preview & Badges */}
      <div className="relative w-full aspect-video bg-[#0a0a0c] rounded-lg overflow-hidden border border-white/5 mb-2.5">
        <canvas
          ref={canvasRef}
          width={256}
          height={144}
          className="w-full h-full object-cover"
        />

        {/* Top Badges */}
        <div className="absolute top-2 left-2 flex items-center gap-1.5 pointer-events-none">
          <span
            className="text-[9px] font-bold px-1.5 py-0.5 rounded shadow backdrop-blur-md"
            style={{
              backgroundColor: `${tmpl.accentColor}26`,
              color: tmpl.accentColor,
              border: `1px solid ${tmpl.accentColor}40`,
            }}
          >
            {tmpl.categoryLabel}
          </span>
          <span className="text-[9px] font-mono font-medium px-1.5 py-0.5 rounded bg-black/70 text-zinc-300 border border-white/10 backdrop-blur-md">
            {tmpl.badge}
          </span>
        </div>

        {/* Drag Pill */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <span className="text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-amber-500/90 text-black shadow">
            DRAG
          </span>
        </div>

        {/* Play indicator on hover */}
        {isHovered && (
          <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-sm flex items-center gap-1 text-[9px] text-white/80 pointer-events-none">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>LIVE PREVIEW</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="min-w-0 flex-1">
          <h4 className="text-xs font-bold text-[var(--theme-text-primary)] truncate group-hover:text-blue-500 transition-colors">
            {tmpl.name}
          </h4>
          <p className="text-[10px] text-[var(--theme-text-muted)] mt-0.5 line-clamp-2 leading-relaxed">
            {tmpl.description}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-2 pt-2 border-t border-[var(--theme-border)] flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1 text-[9px] text-[var(--theme-text-muted)] font-mono">
          <span>{tmpl.defaultDuration}s</span>
          <span>•</span>
          <span className="capitalize">{tmpl.category}</span>
        </div>

        <div className="flex items-center gap-1.5">
          {selectedClipsCount > 0 && (
            <button
              onClick={() => onFormatSelected(tmpl)}
              title="Apply layout to selected clips on timeline"
              className="px-2 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/30 text-[10px] font-bold transition-colors"
            >
              Format Selected
            </button>
          )}

          <button
            onClick={() => onCustomize(tmpl)}
            title="Choose specific media from library"
            className="p-1 rounded bg-[var(--theme-bg-subpanel)] hover:bg-black/10 dark:hover:bg-white/10 text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)] border border-[var(--theme-border)] transition-colors"
          >
            <Settings2 className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => onApply(tmpl)}
            className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold transition-colors shadow-sm flex items-center gap-1"
          >
            <span>Insert</span>
          </button>
        </div>
      </div>
    </div>
  );
});

export function TemplatesTab() {
  const {
    mediaLibrary,
    tracks,
    selectedClipId,
    selectedClipIds,
    projectTemplates,
    saveProjectAsTemplate,
    deleteProjectTemplate,
    loadProjectTemplate,
    addMedia,
    addClip,
    selectClip,
    saveSnapshot,
  } = useEditorStore(
    useShallow((s) => ({
      mediaLibrary: s.mediaLibrary,
      tracks: s.tracks,
      selectedClipId: s.selectedClipId,
      selectedClipIds: s.selectedClipIds || [],
      projectTemplates: s.projectTemplates,
      saveProjectAsTemplate: s.saveProjectAsTemplate,
      deleteProjectTemplate: s.deleteProjectTemplate,
      loadProjectTemplate: s.loadProjectTemplate,
      addMedia: s.addMedia,
      addClip: s.addClip,
      selectClip: s.selectClip,
      saveSnapshot: s.saveSnapshot,
    }))
  );

  const selectedClipsCount = useMemo(() => {
    if (selectedClipIds.length > 0) return selectedClipIds.length;
    return selectedClipId ? 1 : 0;
  }, [selectedClipIds, selectedClipId]);

  // Sub-tabs: A/B Roll is premier default
  const [subTab, setSubTab] = useState<'ab-roll' | 'text' | 'video' | 'project'>('ab-roll');

  // A/B Roll filters
  const [abCategory, setAbCategory] = useState<PresentationCategory>('all');
  const [abRatioFilter, setAbRatioFilter] = useState<'all' | '16:9' | '9:16'>('all');
  const [abSearch, setAbSearch] = useState('');

  // Customize modal state
  const [customizingTmpl, setCustomizingTmpl] = useState<PresentationTemplate | null>(null);
  const [customARollMediaId, setCustomARollMediaId] = useState<string>('');
  const [customBRollMediaId, setCustomBRollMediaId] = useState<string>('');
  const [customSpeakerName, setCustomSpeakerName] = useState<string>('');
  const [customTopicTitle, setCustomTopicTitle] = useState<string>('');

  // Project templates modal state
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDesc, setTemplateDesc] = useState('');
  const [confirmLoadTemplateId, setConfirmLoadTemplateId] = useState<string | null>(null);

  // Text / Video filters
  const [textCategory, setTextCategory] = useState<string>('all');
  const [videoCategory, setVideoCategory] = useState<string>('all');

  const usableMediaItems = useMemo(() => {
    return mediaLibrary.filter((m) => m.type === 'video' || m.type === 'image');
  }, [mediaLibrary]);

  const filteredAbTemplates = useMemo(() => {
    return PRESENTATION_TEMPLATES.filter((tmpl) => {
      if (abCategory !== 'all' && tmpl.category !== abCategory) return false;
      if (abRatioFilter !== 'all') {
        if (abRatioFilter === '16:9' && tmpl.badge === '9:16') return false;
        if (abRatioFilter === '9:16' && tmpl.badge === '16:9') return false;
      }
      if (abSearch.trim()) {
        const q = abSearch.toLowerCase();
        const matchName = tmpl.name.toLowerCase().includes(q);
        const matchDesc = tmpl.description.toLowerCase().includes(q);
        const matchCat = tmpl.categoryLabel.toLowerCase().includes(q);
        if (!matchName && !matchDesc && !matchCat) return false;
      }
      return true;
    });
  }, [abCategory, abRatioFilter, abSearch]);

  const filteredTextTemplates = useMemo(() => {
    let list = MOTION_TEMPLATES.filter((t) => t.type === 'text');
    if (textCategory !== 'all') {
      list = list.filter((t) => t.category === textCategory);
    }
    return list;
  }, [textCategory]);

  const filteredVideoTemplates = useMemo(() => {
    let list = MOTION_TEMPLATES.filter((t) => t.type === 'video');
    if (videoCategory !== 'all') {
      list = list.filter((t) => t.category === videoCategory);
    }
    return list;
  }, [videoCategory]);

  // Insert handler
  const handleApplyAbTemplate = useCallback((tmpl: PresentationTemplate) => {
    applyPresentationTemplate({
      template: tmpl,
      speakerName: 'Host Speaker',
      topicTitle: 'Showcase Demo',
    });
  }, []);

  // Format existing selected clips
  const handleFormatSelected = useCallback(
    (tmpl: PresentationTemplate) => {
      let aId = selectedClipId;
      let bId: string | undefined = undefined;

      if (selectedClipIds.length >= 2) {
        aId = selectedClipIds[0];
        bId = selectedClipIds[1];
      } else if (selectedClipIds.length === 1) {
        aId = selectedClipIds[0];
      }

      if (!aId) {
        toast.error('Please select at least 1 clip on the timeline first');
        return;
      }

      formatClipsToPresentation(tmpl, aId, bId);
    },
    [selectedClipId, selectedClipIds]
  );

  // Open customize dialog
  const handleOpenCustomize = useCallback(
    (tmpl: PresentationTemplate) => {
      setCustomizingTmpl(tmpl);
      setCustomARollMediaId(usableMediaItems[0]?.id || '');
      setCustomBRollMediaId(usableMediaItems[1]?.id || usableMediaItems[0]?.id || '');
      setCustomSpeakerName('');
      setCustomTopicTitle('');
    },
    [usableMediaItems]
  );

  // Commit customize insert
  const handleCommitCustomize = useCallback(() => {
    if (!customizingTmpl) return;
    applyPresentationTemplate({
      template: customizingTmpl,
      aRollMediaId: customARollMediaId || undefined,
      bRollMediaId: customBRollMediaId || undefined,
      speakerName: customSpeakerName.trim() || undefined,
      topicTitle: customTopicTitle.trim() || undefined,
    });
    setCustomizingTmpl(null);
  }, [
    customizingTmpl,
    customARollMediaId,
    customBRollMediaId,
    customSpeakerName,
    customTopicTitle,
  ]);

  // Drag start for presentation templates
  const handleAbDragStart = useCallback((e: React.DragEvent, tmpl: PresentationTemplate) => {
    e.dataTransfer.setData('application/procut-presentation-template', tmpl.id);
    e.dataTransfer.setData('application/procut-template', tmpl.id);
    e.dataTransfer.effectAllowed = 'copy';
  }, []);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[var(--theme-bg-panel)] select-none">
      {/* Sub-Tab Navigation Header */}
      <div className="flex border-b border-[var(--theme-border)] bg-[var(--theme-bg-subpanel)] shrink-0 overflow-x-auto">
        <button
          onClick={() => setSubTab('ab-roll')}
          className={`flex-1 min-w-[100px] py-2 px-2.5 text-xs font-bold border-b-2 transition-colors flex items-center justify-center gap-1.5 ${
            subTab === 'ab-roll'
              ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-[var(--theme-bg-card)]'
              : 'border-transparent text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)] hover:bg-black/5 dark:hover:bg-white/5'
          }`}
        >
          <Tv2 className="w-3.5 h-3.5 text-blue-500" />
          <span>A & B Roll</span>
          <span className="text-[9px] px-1 py-0.2 rounded-full bg-blue-500/20 text-blue-400 font-extrabold uppercase">
            New
          </span>
        </button>

        <button
          onClick={() => setSubTab('text')}
          className={`flex-1 min-w-[90px] py-2 px-2 text-xs font-bold border-b-2 transition-colors ${
            subTab === 'text'
              ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-[var(--theme-bg-card)]'
              : 'border-transparent text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)] hover:bg-black/5 dark:hover:bg-white/5'
          }`}
        >
          Text Motion
        </button>

        <button
          onClick={() => setSubTab('video')}
          className={`flex-1 min-w-[90px] py-2 px-2 text-xs font-bold border-b-2 transition-colors ${
            subTab === 'video'
              ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-[var(--theme-bg-card)]'
              : 'border-transparent text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)] hover:bg-black/5 dark:hover:bg-white/5'
          }`}
        >
          Video Effects
        </button>

        <button
          onClick={() => setSubTab('project')}
          className={`flex-1 min-w-[95px] py-2 px-2 text-xs font-bold border-b-2 transition-colors ${
            subTab === 'project'
              ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-[var(--theme-bg-card)]'
              : 'border-transparent text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)] hover:bg-black/5 dark:hover:bg-white/5'
          }`}
        >
          Project Layouts
        </button>
      </div>

      {/* ── Sub-Tab Content ── */}

      {/* 1. A & B Roll Presentations */}
      {subTab === 'ab-roll' && (
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
          {/* Search & Ratio Header */}
          <div className="p-2 border-b border-[var(--theme-border)] bg-[var(--theme-bg-subpanel)] flex flex-col gap-2 shrink-0">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--theme-text-muted)]" />
              <input
                type="text"
                placeholder="Search presentation styles (Keynote, PiP, Vox...)"
                value={abSearch}
                onChange={(e) => setAbSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-[var(--theme-bg-card)] border border-[var(--theme-border)] rounded-lg text-xs text-[var(--theme-text-primary)] placeholder-[var(--theme-text-muted)] focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            {/* Category Pills & Aspect Filter */}
            <div className="flex items-center justify-between gap-1 overflow-x-auto pb-0.5">
              <div className="flex gap-1 flex-wrap">
                {[
                  { id: 'all', label: 'All Styles' },
                  { id: 'split', label: 'Split Screen' },
                  { id: 'pip', label: 'Picture-in-Picture' },
                  { id: 'keynote', label: 'Keynote & Launch' },
                  { id: 'editorial', label: 'Editorial & Vox' },
                  { id: 'shorts', label: 'Shorts & Reels' },
                  { id: 'cinematic', label: 'Cinematic' },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setAbCategory(cat.id as PresentationCategory)}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap transition-all ${
                      abCategory === cat.id
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-[var(--theme-bg-card)] border border-[var(--theme-border)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)]'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Ratio toggle */}
              <div className="flex bg-[var(--theme-bg-card)] p-0.5 rounded-lg border border-[var(--theme-border)] shrink-0">
                {(['all', '16:9', '9:16'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setAbRatioFilter(r)}
                    className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase transition-colors ${
                      abRatioFilter === r
                        ? 'bg-blue-600 text-white'
                        : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)]'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Timeline Selection Helper Banner */}
          {selectedClipsCount > 0 && (
            <div className="mx-2 mt-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-2 text-amber-500 shrink-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span className="text-[10px] font-medium truncate">
                  <strong>{selectedClipsCount} clip(s) selected</strong> on timeline. Click &apos;Format Selected&apos; to reframe them.
                </span>
              </div>
            </div>
          )}

          {/* Templates Grid */}
          <div className="p-2 flex flex-col gap-2.5">
            {filteredAbTemplates.length === 0 ? (
              <div className="py-12 text-center text-[var(--theme-text-muted)]">
                <p className="text-xs font-semibold">No presentation templates match your search</p>
                <p className="text-[10px] mt-1">Try clearing filters or search query.</p>
              </div>
            ) : (
              filteredAbTemplates.map((tmpl) => (
                <PresentationCard
                  key={tmpl.id}
                  tmpl={tmpl}
                  selectedClipsCount={selectedClipsCount}
                  onApply={handleApplyAbTemplate}
                  onFormatSelected={handleFormatSelected}
                  onCustomize={handleOpenCustomize}
                  onDragStart={(e) => handleAbDragStart(e, tmpl)}
                />
              ))
            )}
          </div>
        </div>
      )}

      {/* 2. Text Motion Graphics */}
      {subTab === 'text' && (
        <div className="flex-1 overflow-y-auto flex flex-col min-h-0">
          <div className="flex gap-1.5 p-2 flex-wrap border-b border-[var(--theme-border)] bg-[var(--theme-bg-subpanel)] shrink-0">
            {[
              { id: 'all', label: 'All Text' },
              { id: 'title', label: 'Titles' },
              { id: 'lower-third', label: 'Lower Thirds' },
              { id: 'social', label: 'Social Badges' },
              { id: 'kinetic', label: 'Kinetic Texts' },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setTextCategory(cat.id)}
                className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${
                  textCategory === cat.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-[var(--theme-bg-card)] border border-[var(--theme-border)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)]'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <p className="text-[10px] text-[var(--theme-text-muted)] px-3 py-1.5 font-semibold uppercase tracking-wider shrink-0">
            Drag to Text Track / Click to Insert
          </p>

          <div className="flex flex-col gap-1.5 p-2">
            {filteredTextTemplates.map((tmpl) => (
              <TemplatePreviewCard
                key={tmpl.id}
                tmpl={tmpl}
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/procut-template', tmpl.id);
                  e.dataTransfer.effectAllowed = 'copy';
                }}
                onClick={() => {
                  // Direct insert text template
                  const state = useEditorStore.getState();
                  let textTrack = state.tracks.find((t) => t.type === 'text');
                  if (!textTrack) {
                    state.addTrack('text');
                    textTrack = useEditorStore.getState().tracks.find((t) => t.type === 'text');
                  }
                  if (!textTrack) return;

                  const mediaId = `tmpl_media_${Math.random().toString(36).substr(2, 9)}`;
                  const clipId = `tmpl_clip_${Math.random().toString(36).substr(2, 9)}`;
                  state.addMedia({
                    id: mediaId,
                    name: tmpl.name,
                    type: 'text',
                    duration: tmpl.defaultDuration,
                    url: '',
                    createdAt: Date.now(),
                  });
                  state.addClip({
                    id: clipId,
                    mediaId,
                    trackId: textTrack.id,
                    startTime: state.currentTime,
                    duration: tmpl.defaultDuration,
                    trimStart: 0,
                    trimEnd: 0,
                    transform: { x: 0, y: 0, scale: 100, rotation: 0 },
                    opacity: 1,
                    speed: 1,
                    effects: [],
                    textSettings: { ...tmpl.textSettings },
                    animations: tmpl.animations ? { ...tmpl.animations } : undefined,
                  } as any);
                  state.selectClip(clipId);
                  state.saveSnapshot();
                  toast.success(`Added text template "${tmpl.name}" to timeline`);
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* 3. Video Effects & Particles */}
      {subTab === 'video' && (
        <div className="flex-1 overflow-y-auto flex flex-col min-h-0">
          <div className="flex gap-1.5 p-2 flex-wrap border-b border-[var(--theme-border)] bg-[var(--theme-bg-subpanel)] shrink-0">
            {[
              { id: 'all', label: 'All Video' },
              { id: 'particle', label: 'Particles' },
              { id: 'color-preset', label: 'Color Presets' },
              { id: 'fx-overlay', label: 'FX Overlays' },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setVideoCategory(cat.id)}
                className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${
                  videoCategory === cat.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-[var(--theme-bg-card)] border border-[var(--theme-border)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)]'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <p className="text-[10px] text-[var(--theme-text-muted)] px-3 py-1.5 font-semibold uppercase tracking-wider shrink-0">
            Drag to Video Clip / Click to Apply
          </p>

          <div className="flex flex-col gap-1.5 p-2">
            {filteredVideoTemplates.map((tmpl) => (
              <TemplatePreviewCard
                key={tmpl.id}
                tmpl={tmpl}
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/procut-template', tmpl.id);
                  e.dataTransfer.effectAllowed = 'copy';
                }}
                onClick={() => {
                  const state = useEditorStore.getState();
                  const targetClipId = state.selectedClipId;
                  if (!targetClipId) {
                    toast.error('Select a clip on the timeline first to apply this effect');
                    return;
                  }
                  const updates: any = {};
                  if (tmpl.category === 'color-preset' && tmpl.colorFilters) {
                    updates.colorFilters = { ...tmpl.colorFilters };
                    toast.success(`Applied color preset "${tmpl.name}" to selected clip`);
                  } else if (tmpl.category === 'particle' && tmpl.particleSettings) {
                    updates.particleSettings = { ...tmpl.particleSettings };
                    toast.success(`Applied particle preset "${tmpl.name}" to selected clip`);
                  } else if (tmpl.category === 'fx-overlay' && tmpl.fxSettings) {
                    updates.fxSettings = { ...tmpl.fxSettings };
                    toast.success(`Applied effect "${tmpl.name}" to selected clip`);
                  }
                  state.updateClip(targetClipId, updates);
                  state.saveSnapshot();
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* 4. Project Layouts */}
      {subTab === 'project' && (
        <div className="flex-1 overflow-y-auto flex flex-col p-2 space-y-3 min-h-0">
          <button
            onClick={() => setShowSaveTemplateModal(true)}
            className="w-full py-3 px-4 rounded-xl border border-dashed border-blue-500/40 hover:border-blue-500 bg-blue-500/5 hover:bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Save Current Timeline as Template</span>
          </button>

          <div className="flex flex-col gap-2">
            {projectTemplates.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center text-[var(--theme-text-muted)]">
                <p className="text-xs font-semibold text-[var(--theme-text-primary)]">
                  No Project Templates saved yet
                </p>
                <p className="text-[10px] mt-1">
                  Configure your tracks and clips, then click save above to reuse it.
                </p>
              </div>
            ) : (
              projectTemplates.map((tmpl) => {
                const dateStr = new Date(tmpl.createdAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                });

                return (
                  <div
                    key={tmpl.id}
                    className="flex flex-col p-3 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg-card)] hover:border-blue-500/30 transition-all group shadow-sm"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0">
                        <h4 className="text-xs text-[var(--theme-text-primary)] font-bold truncate">
                          {tmpl.name}
                        </h4>
                        {tmpl.description && (
                          <p className="text-[10px] text-[var(--theme-text-muted)] mt-0.5 line-clamp-2 leading-relaxed">
                            {tmpl.description}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={async () => {
                          await deleteProjectTemplate(tmpl.id);
                        }}
                        className="p-1 hover:bg-red-500/10 rounded-md text-[var(--theme-text-muted)] hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                        title="Delete Template"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex justify-between items-center mt-3 pt-2.5 border-t border-[var(--theme-border)]">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[8px] text-[var(--theme-text-muted)]">
                          {dateStr}
                        </span>
                        <span className="text-[9px] text-[var(--theme-text-muted)] font-mono font-medium">
                          {tmpl.tracks.length} track(s) · {(tmpl.totalDuration || 0).toFixed(1)}s
                        </span>
                      </div>

                      <button
                        onClick={() => setConfirmLoadTemplateId(tmpl.id)}
                        className="px-3 py-1 text-[10px] font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-md transition-colors shadow-sm"
                      >
                        Load
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ── Modal: Customize & Assign Media for A/B Roll ── */}
      {customizingTmpl && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[var(--theme-bg-card)] border border-[var(--theme-border)] rounded-2xl p-5 shadow-2xl flex flex-col gap-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-bold text-[var(--theme-text-primary)] flex items-center gap-1.5">
                  <Tv2 className="w-4 h-4 text-blue-500" />
                  <span>Configure Presentation: {customizingTmpl.name}</span>
                </h3>
                <p className="text-[11px] text-[var(--theme-text-muted)] mt-0.5">
                  Select media from your library or customize text badges.
                </p>
              </div>
              <button
                onClick={() => setCustomizingTmpl(null)}
                className="p-1 text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)] rounded"
              >
                ✕
              </button>
            </div>

            {/* A-Roll Source Selector */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-[var(--theme-text-primary)] flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-indigo-400" />
                <span>A-Roll Media (Speaker / Host)</span>
              </label>
              <select
                value={customARollMediaId}
                onChange={(e) => setCustomARollMediaId(e.target.value)}
                className="w-full py-1.5 px-2.5 bg-[var(--theme-bg-subpanel)] border border-[var(--theme-border)] rounded-lg text-xs text-[var(--theme-text-primary)] focus:outline-none focus:border-blue-500"
              >
                <option value="">Auto-Generated 1080p A-Roll Stream</option>
                {usableMediaItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.type})
                  </option>
                ))}
              </select>
            </div>

            {/* B-Roll Source Selector */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-[var(--theme-text-primary)] flex items-center gap-1">
                <Film className="w-3.5 h-3.5 text-cyan-400" />
                <span>B-Roll Media (Showcase / Cutaway / Slide)</span>
              </label>
              <select
                value={customBRollMediaId}
                onChange={(e) => setCustomBRollMediaId(e.target.value)}
                className="w-full py-1.5 px-2.5 bg-[var(--theme-bg-subpanel)] border border-[var(--theme-border)] rounded-lg text-xs text-[var(--theme-text-primary)] focus:outline-none focus:border-blue-500"
              >
                <option value="">Auto-Generated 1080p B-Roll Stream</option>
                {usableMediaItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.type})
                  </option>
                ))}
              </select>
            </div>

            {/* Text Badges Customization */}
            <div className="grid grid-cols-2 gap-3 pt-1 border-t border-[var(--theme-border)]">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-medium text-[var(--theme-text-muted)]">
                  Speaker / Host Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Alex Miller"
                  value={customSpeakerName}
                  onChange={(e) => setCustomSpeakerName(e.target.value)}
                  className="py-1.5 px-2 bg-[var(--theme-bg-subpanel)] border border-[var(--theme-border)] rounded text-xs text-[var(--theme-text-primary)] focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-medium text-[var(--theme-text-muted)]">
                  Topic / Chapter Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Live System Demo"
                  value={customTopicTitle}
                  onChange={(e) => setCustomTopicTitle(e.target.value)}
                  className="py-1.5 px-2 bg-[var(--theme-bg-subpanel)] border border-[var(--theme-border)] rounded text-xs text-[var(--theme-text-primary)] focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end gap-2 mt-2 pt-3 border-t border-[var(--theme-border)]">
              <button
                onClick={() => setCustomizingTmpl(null)}
                className="px-3 py-1.5 text-xs text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCommitCustomize}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Insert Presentation</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Save Project Template ── */}
      {showSaveTemplateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[var(--theme-bg-card)] border border-[var(--theme-border)] rounded-2xl p-5 shadow-2xl flex flex-col gap-3">
            <h3 className="text-sm font-bold text-[var(--theme-text-primary)]">
              Save Timeline as Template
            </h3>
            <p className="text-[11px] text-[var(--theme-text-muted)]">
              This layout and clip configuration can be loaded anytime into new projects.
            </p>
            <input
              type="text"
              placeholder="Template name (e.g. Tech Review Template)"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              className="py-1.5 px-3 bg-[var(--theme-bg-subpanel)] border border-[var(--theme-border)] rounded-lg text-xs text-[var(--theme-text-primary)] focus:outline-none focus:border-blue-500"
            />
            <textarea
              placeholder="Description (optional)"
              rows={2}
              value={templateDesc}
              onChange={(e) => setTemplateDesc(e.target.value)}
              className="py-1.5 px-3 bg-[var(--theme-bg-subpanel)] border border-[var(--theme-border)] rounded-lg text-xs text-[var(--theme-text-primary)] focus:outline-none focus:border-blue-500 resize-none"
            />
            <div className="flex justify-end gap-2 mt-2 pt-2 border-t border-[var(--theme-border)]">
              <button
                onClick={() => setShowSaveTemplateModal(false)}
                className="px-3 py-1.5 text-xs text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)]"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!templateName.trim()) {
                    toast.error('Please enter a template name');
                    return;
                  }
                  await saveProjectAsTemplate(templateName.trim(), templateDesc.trim());
                  setShowSaveTemplateModal(false);
                  setTemplateName('');
                  setTemplateDesc('');
                  toast.success('Project template saved successfully!');
                }}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
              >
                Save Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Confirm Load Project Template ── */}
      {confirmLoadTemplateId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[var(--theme-bg-card)] border border-[var(--theme-border)] rounded-2xl p-5 shadow-2xl flex flex-col gap-3">
            <h3 className="text-sm font-bold text-[var(--theme-text-primary)]">
              Load Project Template?
            </h3>
            <p className="text-[11px] text-[var(--theme-text-muted)] leading-relaxed">
              Loading this template will replace the current timeline tracks and clips. A history snapshot will be created so you can undo.
            </p>
            <div className="flex justify-end gap-2 mt-2 pt-2 border-t border-[var(--theme-border)]">
              <button
                onClick={() => setConfirmLoadTemplateId(null)}
                className="px-3 py-1.5 text-xs text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)]"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const id = confirmLoadTemplateId;
                  setConfirmLoadTemplateId(null);
                  await loadProjectTemplate(id);
                  toast.success('Project template loaded!');
                }}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
              >
                Load Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
