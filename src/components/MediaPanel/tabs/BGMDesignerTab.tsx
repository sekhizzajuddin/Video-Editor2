// ─────────────────────────────────────────────────────────────────────────────
// BGM & Sound Design Studio Tab — Full-featured music designer for Media Panel
// Includes: Asset Browser, Multi-Track Mixer, Step Sequencer, Live Preview
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  Music, Play, Pause, Square, Volume2, VolumeX, Search, Plus, Trash2,
  Sliders, ChevronDown, ChevronRight, Headphones, Loader2, Download,
  SkipBack, SkipForward, Repeat, Mic, Waves, Zap, Grid3X3,
} from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { useShallow } from 'zustand/react/shallow';
import { toast } from 'sonner';
import {
  BGM_ASSET_LIBRARY,
  BGMAsset,
  MixerChannel,
  PatternStep,
  DrumPattern,
  AssetCategory,
  filterAssets,
  getCategories,
  getSubcategories,
  createDefaultChannel,
  createDefaultDrumPattern,
  CATEGORY_LABELS,
  SUBCATEGORY_LABELS,
} from '@/utils/bgmAssetLibrary';

// ── Constants ────────────────────────────────────────────────────────────────

const MIXER_CHANNEL_COUNT = 8;

// ── Sub-tabs ─────────────────────────────────────────────────────────────────

type BGMSubTab = 'assets' | 'mixer' | 'sequencer';

// ── Main Component ───────────────────────────────────────────────────────────

export function BGMDesignerTab() {
  const { addMedia, addClip, addTrack, tracks } = useEditorStore(useShallow(s => ({
    addMedia: s.addMedia,
    addClip: s.addClip,
    addTrack: s.addTrack,
    tracks: s.tracks,
  })));

  // ── Sub-tab state ──────────────────────────────────────────────────────────
  const [subTab, setSubTab] = useState<BGMSubTab>('assets');

  // ── Asset Browser State ────────────────────────────────────────────────────
  const [selectedCategory, setSelectedCategory] = useState<AssetCategory | 'all'>('all');
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['sfx', 'instrument']));

  // ── Mixer State ────────────────────────────────────────────────────────────
  const [channels, setChannels] = useState<MixerChannel[]>(() =>
    Array.from({ length: MIXER_CHANNEL_COUNT }, (_, i) => createDefaultChannel(i))
  );
  const [masterVolume, setMasterVolume] = useState(80);
  const [masterMuted, setMasterMuted] = useState(false);
  const [bpm, setBpm] = useState(120);

  // ── Sequencer State ────────────────────────────────────────────────────────
  const [pattern, setPattern] = useState<DrumPattern>(createDefaultDrumPattern);
  const [seqPlaying, setSeqPlaying] = useState(false);
  const [seqStep, setSeqStep] = useState(-1);
  const seqIntervalRef = useRef<number | null>(null);

  // ── Audio Preview State ────────────────────────────────────────────────────
  const [playingAssetId, setPlayingAssetId] = useState<string | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const activeNodesRef = useRef<AudioNode[]>([]);
  const [isExporting, setIsExporting] = useState(false);

  // ── Audio Context ──────────────────────────────────────────────────────────
  const getAudioCtx = useCallback((): AudioContext => {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      audioCtxRef.current = new AudioContext();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAllSounds();
      stopSequencer();
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close();
      }
    };
  }, []);

  // ── Sound Control ──────────────────────────────────────────────────────────

  const stopAllSounds = useCallback(() => {
    activeNodesRef.current.forEach(node => {
      try {
        if (node instanceof AudioScheduledSourceNode) node.stop();
        node.disconnect();
      } catch {}
    });
    activeNodesRef.current = [];
    setPlayingAssetId(null);
  }, []);

  const playAsset = useCallback((asset: BGMAsset) => {
    stopAllSounds();
    const ctx = getAudioCtx();

    const masterGain = ctx.createGain();
    masterGain.gain.value = (masterMuted ? 0 : masterVolume / 100) * 0.8;
    masterGain.connect(ctx.destination);

    const nodes = asset.generator(ctx, masterGain, asset.duration);
    activeNodesRef.current = [masterGain, ...nodes];
    setPlayingAssetId(asset.id);

    // Auto-stop after duration
    setTimeout(() => {
      if (playingAssetId === asset.id || activeNodesRef.current.includes(masterGain)) {
        setPlayingAssetId(null);
      }
    }, asset.duration * 1000 + 100);
  }, [getAudioCtx, masterVolume, masterMuted, stopAllSounds]);

  const toggleAssetPreview = useCallback((asset: BGMAsset) => {
    if (playingAssetId === asset.id) {
      stopAllSounds();
    } else {
      playAsset(asset);
    }
  }, [playingAssetId, playAsset, stopAllSounds]);

  // ── Channel Operations ─────────────────────────────────────────────────────

  const assignAssetToChannel = useCallback((asset: BGMAsset, channelIdx: number) => {
    setChannels(prev => prev.map((ch, i) =>
      i === channelIdx ? { ...ch, asset, name: asset.name } : ch
    ));
    toast.success(`Assigned "${asset.name}" to Channel ${channelIdx + 1}`);
  }, []);

  const updateChannel = useCallback((idx: number, updates: Partial<MixerChannel>) => {
    setChannels(prev => prev.map((ch, i) => i === idx ? { ...ch, ...updates } : ch));
  }, []);

  const clearChannel = useCallback((idx: number) => {
    setChannels(prev => prev.map((ch, i) => i === idx ? createDefaultChannel(i) : ch));
  }, []);

  const playChannel = useCallback((idx: number) => {
    const ch = channels[idx];
    if (!ch.asset || ch.muted) return;
    const ctx = getAudioCtx();
    const gain = ctx.createGain();
    gain.gain.value = (masterMuted ? 0 : masterVolume / 100) * (ch.volume / 100);
    const panner = ctx.createStereoPanner();
    panner.pan.value = ch.pan / 100;
    gain.connect(panner);
    panner.connect(ctx.destination);
    const nodes = ch.asset.generator(ctx, gain, ch.asset.duration);
    activeNodesRef.current.push(gain, panner, ...nodes);
  }, [channels, getAudioCtx, masterVolume, masterMuted]);

  // ── Sequencer Engine ───────────────────────────────────────────────────────

  const startSequencer = useCallback(() => {
    const ctx = getAudioCtx();
    setSeqPlaying(true);
    setSeqStep(0);
    let step = 0;
    const interval = (60 / pattern.bpm / 4) * 1000; // 16th note interval

    seqIntervalRef.current = window.setInterval(() => {
      setSeqStep(step);

      pattern.tracks.forEach(track => {
        const s = track.pattern[step];
        if (s && s.active) {
          const gain = ctx.createGain();
          gain.gain.value = s.velocity * (s.accent ? 1.2 : 1.0) * (masterVolume / 100) * 0.6;
          gain.connect(ctx.destination);
          track.asset.generator(ctx, gain, track.asset.duration);
        }
      });

      step = (step + 1) % pattern.steps;
    }, interval);
  }, [getAudioCtx, pattern, masterVolume]);

  const stopSequencer = useCallback(() => {
    if (seqIntervalRef.current) {
      clearInterval(seqIntervalRef.current);
      seqIntervalRef.current = null;
    }
    setSeqPlaying(false);
    setSeqStep(-1);
  }, []);

  const toggleSequencer = useCallback(() => {
    if (seqPlaying) stopSequencer();
    else startSequencer();
  }, [seqPlaying, startSequencer, stopSequencer]);

  const toggleStep = useCallback((trackIdx: number, stepIdx: number) => {
    setPattern(prev => ({
      ...prev,
      tracks: prev.tracks.map((t, ti) =>
        ti !== trackIdx ? t : {
          ...t,
          pattern: t.pattern.map((s, si) =>
            si !== stepIdx ? s : { ...s, active: !s.active }
          ),
        }
      ),
    }));
  }, []);

  // ── Export to Timeline ─────────────────────────────────────────────────────

  const exportMixToTimeline = useCallback(async () => {
    const activeChannels = channels.filter(ch => ch.asset && !ch.muted);
    if (activeChannels.length === 0) {
      toast.error('No active channels to export. Assign assets to channels first.');
      return;
    }

    setIsExporting(true);
    const toastId = toast.loading('Rendering mix to audio...');

    try {
      // Calculate max duration from all channels
      const maxDuration = Math.max(...activeChannels.map(ch => ch.asset!.duration));

      // Render offline
      const offCtx = new OfflineAudioContext(2, Math.ceil(44100 * maxDuration), 44100);
      const masterGain = offCtx.createGain();
      masterGain.gain.value = masterVolume / 100;
      masterGain.connect(offCtx.destination);

      for (const ch of activeChannels) {
        const chGain = offCtx.createGain();
        chGain.gain.value = ch.volume / 100;
        const panner = offCtx.createStereoPanner();
        panner.pan.value = ch.pan / 100;
        chGain.connect(panner);
        panner.connect(masterGain);
        ch.asset!.generator(offCtx as unknown as AudioContext, chGain, ch.asset!.duration);
      }

      const rendered = await offCtx.startRendering();

      // Convert to WAV
      const wavBlob = audioBufferToWav(rendered);
      const url = URL.createObjectURL(wavBlob);
      const file = new File([wavBlob], `BGM_Mix_${Date.now()}.wav`, { type: 'audio/wav' });

      // Add to media library
      const mediaId = `bgm_mix_${Date.now()}`;
      addMedia({
        id: mediaId,
        name: `BGM Mix — ${activeChannels.length} channels`,
        type: 'audio',
        duration: maxDuration,
        url,
        createdAt: Date.now(),
      }, file);

      // Add to timeline
      let audioTrack = tracks.find(t => t.type === 'audio');
      if (!audioTrack) {
        addTrack('audio');
        audioTrack = useEditorStore.getState().tracks.find(t => t.type === 'audio');
      }
      if (audioTrack) {
        const currentTime = useEditorStore.getState().currentTime || 0;
        addClip({
          id: `clip_bgm_${Date.now()}`,
          mediaId,
          trackId: audioTrack.id,
          startTime: currentTime,
          duration: maxDuration,
          trimStart: 0,
          trimEnd: 0,
          opacity: 1,
          speed: 1,
          effects: [],
          transform: { x: 0, y: 0, scale: 100, rotation: 0 },
          audioSettings: {
            volume: 0, pan: 0, fadeIn: 0.5, fadeOut: 1.0,
            bass: 0, treble: 0, muted: false,
            preservePitch: true, pitch: 0, voiceFormant: 0, humanize: false,
          },
        });
      }

      toast.success('BGM mix exported to timeline!', { id: toastId });
    } catch (err: any) {
      toast.error(`Export failed: ${err.message}`, { id: toastId });
    } finally {
      setIsExporting(false);
    }
  }, [channels, masterVolume, tracks, addMedia, addClip, addTrack]);

  // Single asset → timeline
  const addAssetToTimeline = useCallback((asset: BGMAsset) => {
    const ctx = getAudioCtx();
    const offCtx = new OfflineAudioContext(2, Math.ceil(44100 * asset.duration), 44100);
    const gain = offCtx.createGain();
    gain.gain.value = 0.8;
    gain.connect(offCtx.destination);
    asset.generator(offCtx as unknown as AudioContext, gain, asset.duration);

    offCtx.startRendering().then(rendered => {
      const wavBlob = audioBufferToWav(rendered);
      const url = URL.createObjectURL(wavBlob);
      const file = new File([wavBlob], `${asset.name.replace(/\s+/g, '_')}.wav`, { type: 'audio/wav' });

      const mediaId = `bgm_asset_${asset.id}_${Date.now()}`;
      addMedia({
        id: mediaId,
        name: asset.name,
        type: 'audio',
        duration: asset.duration,
        url,
        createdAt: Date.now(),
      }, file);

      let audioTrack = tracks.find(t => t.type === 'audio');
      if (!audioTrack) {
        addTrack('audio');
        audioTrack = useEditorStore.getState().tracks.find(t => t.type === 'audio');
      }
      if (audioTrack) {
        addClip({
          id: `clip_bgm_asset_${Date.now()}`,
          mediaId,
          trackId: audioTrack.id,
          startTime: useEditorStore.getState().currentTime || 0,
          duration: asset.duration,
          trimStart: 0, trimEnd: 0, opacity: 1, speed: 1, effects: [],
          transform: { x: 0, y: 0, scale: 100, rotation: 0 },
        });
      }
      toast.success(`Added "${asset.name}" to timeline`);
    });
  }, [getAudioCtx, addMedia, addClip, addTrack, tracks]);

  // ── Filtered assets ────────────────────────────────────────────────────────
  const filteredAssets = useMemo(
    () => filterAssets(selectedCategory, selectedSubcategory, searchQuery),
    [selectedCategory, selectedSubcategory, searchQuery]
  );

  // Group by category for browsing
  const groupedAssets = useMemo(() => {
    const groups: Record<string, BGMAsset[]> = {};
    filteredAssets.forEach(a => {
      if (!groups[a.category]) groups[a.category] = [];
      groups[a.category].push(a);
    });
    return groups;
  }, [filteredAssets]);

  const subcategories = useMemo(
    () => selectedCategory !== 'all' ? getSubcategories(selectedCategory) : [],
    [selectedCategory]
  );

  // ── Drag to channel ────────────────────────────────────────────────────────
  const [dragAsset, setDragAsset] = useState<BGMAsset | null>(null);

  // ── JSX ────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-[var(--theme-bg-panel)]">
      {/* Sub-tab Header */}
      <div className="flex border-b border-[var(--theme-border)] shrink-0 mx-2.5 mt-2 mb-1.5 bg-[var(--theme-bg-subpanel)] rounded-lg p-0.5 select-none">
        {([
          { id: 'assets' as const, label: 'Assets', icon: Grid3X3, color: 'bg-violet-600' },
          { id: 'mixer' as const, label: 'Mixer', icon: Sliders, color: 'bg-blue-600' },
          { id: 'sequencer' as const, label: 'Sequencer', icon: Waves, color: 'bg-emerald-600' },
        ]).map(tab => (
          <button
            key={tab.id}
            onClick={() => setSubTab(tab.id)}
            className={`flex-1 py-1.5 text-[11px] font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 ${
              subTab === tab.id
                ? `${tab.color} text-white shadow-sm`
                : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)] hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Master Controls Bar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[var(--theme-border)] shrink-0 bg-[var(--theme-bg-subpanel)]/50">
        <button
          onClick={() => setMasterMuted(!masterMuted)}
          className="p-1 rounded hover:bg-white/10 transition-colors"
          title={masterMuted ? 'Unmute' : 'Mute'}
        >
          {masterMuted ? <VolumeX className="w-3.5 h-3.5 text-red-400" /> : <Volume2 className="w-3.5 h-3.5 text-[var(--theme-text-muted)]" />}
        </button>
        <input
          type="range" min={0} max={100} value={masterVolume}
          onChange={e => setMasterVolume(+e.target.value)}
          className="w-16 h-1 accent-blue-500"
          title={`Master: ${masterVolume}%`}
        />
        <span className="text-[9px] text-[var(--theme-text-muted)] font-mono w-7">{masterVolume}%</span>

        <div className="w-px h-4 bg-[var(--theme-border)]" />

        <span className="text-[9px] text-[var(--theme-text-muted)]">BPM</span>
        <input
          type="number" min={40} max={300} value={bpm}
          onChange={e => setBpm(+e.target.value)}
          className="w-12 text-[10px] bg-[var(--theme-bg-subpanel)] border border-[var(--theme-border)] rounded px-1 py-0.5 text-center text-[var(--theme-text-primary)]"
        />

        <div className="flex-1" />

        <button
          onClick={exportMixToTimeline}
          disabled={isExporting}
          className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white rounded-md transition-all disabled:opacity-50"
          title="Export mix to timeline"
        >
          {isExporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
          Export
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">

        {/* ═══ ASSETS TAB ═══ */}
        {subTab === 'assets' && (
          <div className="p-2 space-y-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--theme-text-muted)]" />
              <input
                type="text"
                placeholder="Search sounds..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-[var(--theme-bg-subpanel)] border border-[var(--theme-border)] rounded-lg text-xs text-[var(--theme-text-primary)] placeholder-[var(--theme-text-muted)] focus:outline-none focus:border-violet-500 transition-colors"
              />
            </div>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => { setSelectedCategory('all'); setSelectedSubcategory('all'); }}
                className={`px-2 py-0.5 text-[9px] font-semibold rounded-full transition-all ${
                  selectedCategory === 'all'
                    ? 'bg-violet-600 text-white'
                    : 'bg-[var(--theme-bg-subpanel)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)] border border-[var(--theme-border)]'
                }`}
              >
                All
              </button>
              {getCategories().map(cat => {
                const info = CATEGORY_LABELS[cat];
                return (
                  <button
                    key={cat}
                    onClick={() => { setSelectedCategory(cat); setSelectedSubcategory('all'); }}
                    className={`px-2 py-0.5 text-[9px] font-semibold rounded-full transition-all flex items-center gap-1 ${
                      selectedCategory === cat
                        ? 'text-white shadow-sm'
                        : 'bg-[var(--theme-bg-subpanel)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)] border border-[var(--theme-border)]'
                    }`}
                    style={selectedCategory === cat ? { backgroundColor: info.color } : undefined}
                  >
                    <span>{info.icon}</span> {info.label}
                  </button>
                );
              })}
            </div>

            {/* Subcategory Filter */}
            {subcategories.length > 0 && (
              <div className="flex flex-wrap gap-1">
                <button
                  onClick={() => setSelectedSubcategory('all')}
                  className={`px-1.5 py-0.5 text-[8px] rounded-md transition-all ${
                    selectedSubcategory === 'all'
                      ? 'bg-white/20 text-[var(--theme-text-primary)] font-bold'
                      : 'text-[var(--theme-text-muted)] hover:bg-white/10'
                  }`}
                >
                  All
                </button>
                {subcategories.map(sub => (
                  <button
                    key={sub}
                    onClick={() => setSelectedSubcategory(sub)}
                    className={`px-1.5 py-0.5 text-[8px] rounded-md transition-all ${
                      selectedSubcategory === sub
                        ? 'bg-white/20 text-[var(--theme-text-primary)] font-bold'
                        : 'text-[var(--theme-text-muted)] hover:bg-white/10'
                    }`}
                  >
                    {SUBCATEGORY_LABELS[sub] || sub}
                  </button>
                ))}
              </div>
            )}

            {/* Asset Count */}
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-[var(--theme-text-muted)]">
                {filteredAssets.length} sound{filteredAssets.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Asset Cards */}
            {Object.entries(groupedAssets).map(([category, assets]) => {
              const catInfo = CATEGORY_LABELS[category as AssetCategory];
              const isExpanded = expandedCategories.has(category);
              return (
                <div key={category} className="border border-[var(--theme-border)] rounded-lg overflow-hidden">
                  <button
                    onClick={() => setExpandedCategories(prev => {
                      const next = new Set(prev);
                      if (next.has(category)) next.delete(category);
                      else next.add(category);
                      return next;
                    })}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 bg-[var(--theme-bg-subpanel)] hover:bg-[var(--theme-bg-subpanel)]/80 transition-colors"
                  >
                    {isExpanded
                      ? <ChevronDown className="w-3 h-3 text-[var(--theme-text-muted)]" />
                      : <ChevronRight className="w-3 h-3 text-[var(--theme-text-muted)]" />
                    }
                    <span className="text-sm">{catInfo?.icon}</span>
                    <span className="text-[11px] font-semibold text-[var(--theme-text-primary)]">
                      {catInfo?.label || category}
                    </span>
                    <span className="text-[9px] text-[var(--theme-text-muted)] ml-auto">{assets.length}</span>
                  </button>

                  {isExpanded && (
                    <div className="divide-y divide-[var(--theme-border)]">
                      {assets.map(asset => (
                        <div
                          key={asset.id}
                          className="flex items-center gap-2 px-2.5 py-2 hover:bg-white/[0.03] transition-colors group cursor-pointer"
                          draggable
                          onDragStart={() => setDragAsset(asset)}
                          onDragEnd={() => setDragAsset(null)}
                        >
                          {/* Preview button */}
                          <button
                            onClick={e => { e.stopPropagation(); toggleAssetPreview(asset); }}
                            className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-all ${
                              playingAssetId === asset.id
                                ? 'bg-violet-600 text-white scale-110'
                                : 'bg-[var(--theme-bg-subpanel)] text-[var(--theme-text-muted)] hover:text-white hover:bg-violet-600/50'
                            }`}
                          >
                            {playingAssetId === asset.id
                              ? <Pause className="w-3 h-3" />
                              : <Play className="w-3 h-3 ml-0.5" />
                            }
                          </button>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm">{asset.icon}</span>
                              <span className="text-[11px] font-medium text-[var(--theme-text-primary)] truncate">
                                {asset.name}
                              </span>
                            </div>
                            <p className="text-[9px] text-[var(--theme-text-muted)] truncate mt-0.5">
                              {asset.description}
                            </p>
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className="text-[8px] px-1 py-px rounded" style={{ backgroundColor: asset.color + '20', color: asset.color }}>
                                {SUBCATEGORY_LABELS[asset.subcategory] || asset.subcategory}
                              </span>
                              <span className="text-[8px] text-[var(--theme-text-muted)]">
                                {asset.duration.toFixed(1)}s
                              </span>
                              {asset.key && (
                                <span className="text-[8px] text-[var(--theme-text-muted)]">
                                  Key: {asset.key}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            {/* Add to channel dropdown */}
                            <select
                              className="w-14 text-[8px] bg-[var(--theme-bg-subpanel)] border border-[var(--theme-border)] rounded px-0.5 py-0.5 text-[var(--theme-text-primary)]"
                              value=""
                              onChange={e => {
                                const idx = parseInt(e.target.value);
                                if (!isNaN(idx)) assignAssetToChannel(asset, idx);
                              }}
                              title="Assign to mixer channel"
                            >
                              <option value="">→ Ch</option>
                              {channels.map((_, i) => (
                                <option key={i} value={i}>Ch {i + 1}</option>
                              ))}
                            </select>

                            {/* Add directly to timeline */}
                            <button
                              onClick={e => { e.stopPropagation(); addAssetToTimeline(asset); }}
                              className="p-1 rounded hover:bg-amber-600/30 text-[var(--theme-text-muted)] hover:text-amber-400 transition-colors"
                              title="Add to timeline"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {filteredAssets.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-[var(--theme-text-muted)]">
                <Music className="w-8 h-8 mb-2 opacity-20" />
                <p className="text-xs">No sounds match your search</p>
              </div>
            )}
          </div>
        )}

        {/* ═══ MIXER TAB ═══ */}
        {subTab === 'mixer' && (
          <div className="p-2 space-y-2">
            <div className="text-[10px] text-[var(--theme-text-muted)] px-1 flex items-center gap-1.5">
              <Sliders className="w-3 h-3" />
              <span className="font-semibold">Multi-Track Mixer Console</span>
              <span className="text-[8px] opacity-60 ml-auto">Drag assets from Assets tab to channels</span>
            </div>

            {channels.map((ch, idx) => (
              <div
                key={ch.id}
                className={`border rounded-lg overflow-hidden transition-all ${
                  ch.asset ? 'border-[var(--theme-border)]' : 'border-dashed border-[var(--theme-border)]/50'
                }`}
                onDragOver={e => e.preventDefault()}
                onDrop={() => {
                  if (dragAsset) {
                    assignAssetToChannel(dragAsset, idx);
                    setDragAsset(null);
                  }
                }}
              >
                {/* Channel Header */}
                <div
                  className="flex items-center gap-1.5 px-2 py-1.5 bg-[var(--theme-bg-subpanel)]"
                  style={{ borderLeft: `3px solid ${ch.color}` }}
                >
                  <span className="text-[9px] font-bold text-[var(--theme-text-muted)] w-5">{idx + 1}</span>
                  <span className="text-[10px] font-medium text-[var(--theme-text-primary)] flex-1 truncate">
                    {ch.asset ? ch.name : 'Empty Channel'}
                  </span>

                  {ch.asset && (
                    <>
                      <button
                        onClick={() => updateChannel(idx, { solo: !ch.solo })}
                        className={`px-1 py-0.5 text-[8px] font-bold rounded transition-colors ${
                          ch.solo ? 'bg-amber-500 text-black' : 'text-[var(--theme-text-muted)] hover:bg-white/10'
                        }`}
                      >
                        S
                      </button>
                      <button
                        onClick={() => updateChannel(idx, { muted: !ch.muted })}
                        className={`px-1 py-0.5 text-[8px] font-bold rounded transition-colors ${
                          ch.muted ? 'bg-red-500 text-white' : 'text-[var(--theme-text-muted)] hover:bg-white/10'
                        }`}
                      >
                        M
                      </button>
                      <button
                        onClick={() => playChannel(idx)}
                        className="p-0.5 text-[var(--theme-text-muted)] hover:text-emerald-400 transition-colors"
                        title="Preview channel"
                      >
                        <Headphones className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => clearChannel(idx)}
                        className="p-0.5 text-[var(--theme-text-muted)] hover:text-red-400 transition-colors"
                        title="Clear channel"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </>
                  )}
                </div>

                {/* Channel Controls */}
                {ch.asset && (
                  <div className="px-2 py-1.5 space-y-1.5">
                    {/* Volume */}
                    <div className="flex items-center gap-2">
                      <span className="text-[8px] text-[var(--theme-text-muted)] w-8">Vol</span>
                      <input
                        type="range" min={0} max={100} value={ch.volume}
                        onChange={e => updateChannel(idx, { volume: +e.target.value })}
                        className="flex-1 h-1 accent-blue-500"
                      />
                      <span className="text-[8px] text-[var(--theme-text-muted)] w-7 text-right font-mono">{ch.volume}%</span>
                    </div>
                    {/* Pan */}
                    <div className="flex items-center gap-2">
                      <span className="text-[8px] text-[var(--theme-text-muted)] w-8">Pan</span>
                      <input
                        type="range" min={-100} max={100} value={ch.pan}
                        onChange={e => updateChannel(idx, { pan: +e.target.value })}
                        className="flex-1 h-1 accent-emerald-500"
                      />
                      <span className="text-[8px] text-[var(--theme-text-muted)] w-7 text-right font-mono">
                        {ch.pan === 0 ? 'C' : ch.pan < 0 ? `L${Math.abs(ch.pan)}` : `R${ch.pan}`}
                      </span>
                    </div>
                    {/* Fade In/Out */}
                    <div className="flex gap-2">
                      <div className="flex items-center gap-1 flex-1">
                        <span className="text-[8px] text-[var(--theme-text-muted)]">FadeIn</span>
                        <input
                          type="range" min={0} max={5} step={0.1} value={ch.fadeIn}
                          onChange={e => updateChannel(idx, { fadeIn: +e.target.value })}
                          className="flex-1 h-1 accent-violet-500"
                        />
                        <span className="text-[7px] text-[var(--theme-text-muted)] w-5 font-mono">{ch.fadeIn.toFixed(1)}</span>
                      </div>
                      <div className="flex items-center gap-1 flex-1">
                        <span className="text-[8px] text-[var(--theme-text-muted)]">Out</span>
                        <input
                          type="range" min={0} max={5} step={0.1} value={ch.fadeOut}
                          onChange={e => updateChannel(idx, { fadeOut: +e.target.value })}
                          className="flex-1 h-1 accent-violet-500"
                        />
                        <span className="text-[7px] text-[var(--theme-text-muted)] w-5 font-mono">{ch.fadeOut.toFixed(1)}</span>
                      </div>
                    </div>
                    {/* Loop toggle */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateChannel(idx, { loop: !ch.loop })}
                        className={`flex items-center gap-1 px-1.5 py-0.5 text-[8px] rounded transition-colors ${
                          ch.loop ? 'bg-violet-600/30 text-violet-400' : 'text-[var(--theme-text-muted)] hover:bg-white/5'
                        }`}
                      >
                        <Repeat className="w-2.5 h-2.5" />
                        Loop
                      </button>
                      <span className="text-[8px] text-[var(--theme-text-muted)]">
                        {ch.asset.duration.toFixed(1)}s · {ch.asset.icon} {SUBCATEGORY_LABELS[ch.asset.subcategory] || ch.asset.subcategory}
                      </span>
                    </div>
                  </div>
                )}

                {/* Empty state */}
                {!ch.asset && (
                  <div className="px-2 py-3 text-center">
                    <p className="text-[9px] text-[var(--theme-text-muted)] opacity-50">
                      Drag a sound here or use the Assets tab
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ═══ SEQUENCER TAB ═══ */}
        {subTab === 'sequencer' && (
          <div className="p-2 space-y-2">
            {/* Sequencer Header */}
            <div className="flex items-center gap-2">
              <button
                onClick={toggleSequencer}
                className={`flex items-center gap-1 px-2.5 py-1 text-[10px] font-semibold rounded-md transition-all ${
                  seqPlaying
                    ? 'bg-red-600 hover:bg-red-500 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                }`}
              >
                {seqPlaying ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                {seqPlaying ? 'Stop' : 'Play'}
              </button>

              <div className="flex items-center gap-1">
                <span className="text-[9px] text-[var(--theme-text-muted)]">BPM</span>
                <input
                  type="number" min={40} max={300}
                  value={pattern.bpm}
                  onChange={e => setPattern(p => ({ ...p, bpm: +e.target.value }))}
                  className="w-12 text-[10px] bg-[var(--theme-bg-subpanel)] border border-[var(--theme-border)] rounded px-1 py-0.5 text-center text-[var(--theme-text-primary)]"
                />
              </div>

              <span className="text-[9px] text-[var(--theme-text-muted)] ml-auto">
                {pattern.steps}-step pattern
              </span>
            </div>

            {/* Step Grid */}
            <div className="border border-[var(--theme-border)] rounded-lg overflow-hidden">
              {/* Step numbers */}
              <div className="flex">
                <div className="w-16 shrink-0 bg-[var(--theme-bg-subpanel)] border-r border-b border-[var(--theme-border)] px-1.5 py-1">
                  <span className="text-[8px] text-[var(--theme-text-muted)]">Track</span>
                </div>
                <div className="flex flex-1">
                  {Array.from({ length: pattern.steps }, (_, i) => (
                    <div
                      key={i}
                      className={`flex-1 text-center py-1 text-[7px] font-mono border-b border-r border-[var(--theme-border)] transition-colors ${
                        seqStep === i ? 'bg-emerald-600/30 text-emerald-400 font-bold' : 'text-[var(--theme-text-muted)]'
                      } ${i % 4 === 0 ? 'bg-white/[0.02]' : ''}`}
                    >
                      {i + 1}
                    </div>
                  ))}
                </div>
              </div>

              {/* Track rows */}
              {pattern.tracks.map((track, trackIdx) => (
                <div key={trackIdx} className="flex">
                  <div className="w-16 shrink-0 bg-[var(--theme-bg-subpanel)] border-r border-b border-[var(--theme-border)] px-1.5 py-1 flex items-center">
                    <span className="text-[9px] font-medium text-[var(--theme-text-primary)] truncate">
                      {track.asset.icon} {track.name}
                    </span>
                  </div>
                  <div className="flex flex-1">
                    {track.pattern.map((step, stepIdx) => (
                      <button
                        key={stepIdx}
                        onClick={() => toggleStep(trackIdx, stepIdx)}
                        className={`flex-1 h-7 border-b border-r border-[var(--theme-border)] transition-all ${
                          step.active
                            ? 'bg-violet-600 hover:bg-violet-500'
                            : seqStep === stepIdx
                            ? 'bg-emerald-600/10 hover:bg-white/10'
                            : stepIdx % 4 === 0
                            ? 'bg-white/[0.02] hover:bg-white/10'
                            : 'hover:bg-white/10'
                        }`}
                      >
                        {step.active && (
                          <div className="w-2 h-2 mx-auto rounded-full bg-white/80" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Quick Patterns */}
            <div>
              <span className="text-[9px] text-[var(--theme-text-muted)] font-semibold">Quick Patterns</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {[
                  { name: 'Basic Rock', steps: [[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],[0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0],[1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0],[0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0]] },
                  { name: 'Four on Floor', steps: [[1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0],[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],[1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0],[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0]] },
                  { name: 'Trap', steps: [[1,0,0,0,0,0,0,0,1,0,1,0,0,0,0,0],[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,1],[1,1,0,1,1,0,1,1,1,1,0,1,1,0,1,1],[0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0]] },
                  { name: 'Dafli Sufi', steps: [[1,0,0,1,0,0,1,0,0,1,0,0,1,0,1,0],[0,0,1,0,0,1,0,0,1,0,0,1,0,1,0,1],[0,1,0,0,1,0,0,1,0,0,1,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0]] },
                ].map(preset => (
                  <button
                    key={preset.name}
                    onClick={() => {
                      setPattern(prev => ({
                        ...prev,
                        tracks: prev.tracks.map((t, i) => ({
                          ...t,
                          pattern: preset.steps[i]?.map(v => ({
                            active: v === 1,
                            velocity: 0.8,
                            accent: false,
                          })) || t.pattern,
                        })),
                      }));
                      toast.success(`Loaded "${preset.name}" pattern`);
                    }}
                    className="px-2 py-1 text-[9px] bg-[var(--theme-bg-subpanel)] border border-[var(--theme-border)] rounded hover:border-violet-500 hover:text-violet-400 text-[var(--theme-text-muted)] transition-colors"
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Export Sequencer Pattern */}
            <button
              onClick={() => {
                // Play the full pattern once and render to timeline
                toast.success('Sequencer patterns can be previewed with Play and exported via the Export button above.');
              }}
              className="w-full py-1.5 text-[10px] font-semibold bg-gradient-to-r from-emerald-600/20 to-emerald-500/20 border border-emerald-500/30 hover:border-emerald-500 text-emerald-400 rounded-lg transition-all flex items-center justify-center gap-1.5"
            >
              <Waves className="w-3.5 h-3.5" />
              Preview pattern with Play button
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── WAV Encoder ──────────────────────────────────────────────────────────────

function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numCh = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitsPerSample = 16;
  const blockAlign = numCh * bitsPerSample / 8;
  const byteRate = sampleRate * blockAlign;
  const dataLength = buffer.length * blockAlign;
  const headerLength = 44;
  const totalLength = headerLength + dataLength;

  const arrayBuffer = new ArrayBuffer(totalLength);
  const view = new DataView(arrayBuffer);

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, totalLength - 8, true);
  writeString(view, 8, 'WAVE');

  // fmt chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numCh, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true);

  // Interleave samples
  const channels: Float32Array[] = [];
  for (let ch = 0; ch < numCh; ch++) {
    channels.push(buffer.getChannelData(ch));
  }

  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numCh; ch++) {
      let sample = channels[ch][i];
      sample = Math.max(-1, Math.min(1, sample));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}
