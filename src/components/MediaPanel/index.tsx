// ─────────────────────────────────────────────────────────────────────────────
// [MOBILE SYNC] Desktop feature — it has a MOBILE counterpart.
// Rule: if an update changes LOGIC, changes ARCHITECTURE, or FIXES A BUG, apply
// the same change to the mobile file(s) below. SKIP if the update is UI-only.
// Mobile counterpart:
//   src/mobile/components/MobileMediaSheet.tsx
//   src/mobile/lib/timeline.ts
// ─────────────────────────────────────────────────────────────────────────────

import {
  Film,
  Music,
  Image,
  Search,
  Mic,
  Grid3X3,
  List,
  Upload,
  Sparkles,
  Waves,
  Folder,
  Sun,
  Droplets,
  Zap,
  Trash2,
  X,
  Loader2,
  Type,
  Play,
  AlertTriangle,
  Tv2,
  Clapperboard,
  Radio,
  ScanLine,
  Aperture,
  Hexagon,
  FlipHorizontal,
  ZoomIn,
  Focus,
  Eye,
  Flame,
  Monitor,
  CloudSnow,
  CloudRain,
  Star,
  Wind,
  Leaf,
  Heart,
  Code2,
  ChevronDown,
  ChevronRight,
  Square,
  Plus,
  Globe,
  Scissors,
  Wand2,
  Wrench,
} from 'lucide-react';
import React, { useState, useRef, useCallback, useEffect, Fragment, useMemo } from 'react';
import { useEditorStore, getAllClipsDeep, findClipInTracks } from '@/store/editorStore';
import { usePlaybackTime } from '@/hooks/usePlaybackTime';
import { isKineticMediaId } from '@/utils/kineticSync';
import { useShallow } from 'zustand/react/shallow';
import type { MediaTab, MediaType, MediaItem } from '@/types';
import { probeFile } from '@/utils/mediaProbe';
import { saveFileToDB } from '@/utils/projectPersistence';
import { storeMediaHandle } from '@/utils/mediaFileHandle';
import { parseSRT } from '@/utils/srtParser';
import { repairAudioFile } from '@/utils/audioRepair';
import demoA from '../../assets/transition_demo_a.webp';
import demoB from '../../assets/transition_demo_b.webp';
import { toast } from 'sonner';
import { parseCubeLut } from '@/utils/lutParser';
import { detectBeats } from '@/utils/beatDetection';
import { MOTION_TEMPLATES, MotionTemplate } from '@/utils/motionTemplates';
import { captureCanvasChunk } from '@/utils/canvasCapture';
import { analyzeCanvasChunkWithGemini } from '@/utils/aiClient';
import { generateCombinedSfx } from '@/utils/elevenLabsClient';
const AiSoundDesigner = React.lazy(() => import('../AiSoundDesigner').then(m => ({ default: m.AiSoundDesigner })));
const AIGeneratorModal = React.lazy(() => import('../AIGeneratorModal').then(m => ({ default: m.AIGeneratorModal })));
const AutoVideoModal = React.lazy(() => import('../AutoVideoModal').then(m => ({ default: m.AutoVideoModal })));
// Timeline FX — dragged to FX tracks. type field maps to PreviewCanvas fxType.
// Color Correction — dragged to a video/image clip to apply that preset
// Particle Effects — dragged to a video/image/FX clip
import { TRANSITIONS, FX_EFFECTS, COLOR_CORRECTION_EFFECTS, PARTICLE_EFFECTS } from "@/constants/mediaPanel";
import { TemplatePreviewCardProps, TransitionCardProps } from "@/types/mediaPanel";
import { formatDuration, formatSimpleTime, formatSize, getMediaColor, getMediaIcon } from "@/utils/mediaHelpers";
import { useMediaImport } from "@/hooks/media/useMediaImport";
import { useTTS } from "@/hooks/media/useTTS";
import { useAudioFeatures } from "@/hooks/media/useAudioFeatures";
import { UploadProgressOverlay } from '@/components/ui/UploadProgressOverlay';

export const TemplatePreviewCard = React.memo(function TemplatePreviewCard({ tmpl, onDragStart, onClick }: TemplatePreviewCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isHovered || !canvasRef.current) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let startTime = performance.now();
    const duration = tmpl.defaultDuration > 0 ? tmpl.defaultDuration : 4;

    const render = (now: number) => {
      const elapsed = (now - startTime) / 1000;
      const progress = (elapsed % duration) / duration;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#141414';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (tmpl.type === 'text' && tmpl.textSettings) {
        ctx.save();
        
        let scale = 1;
        let opacity = 1;
        let x = canvas.width / 2;
        let y = canvas.height / 2;
        let rotation = 0;

        const animPreset = tmpl.textSettings.animation?.in || 'none';
        
        if (progress < 0.2) {
          const t = progress / 0.2;
          if (animPreset === 'fadeIn') opacity = t;
          else if (animPreset === 'zoom') { scale = 0.5 + t * 0.5; opacity = t; }
          else if (animPreset === 'slideUp') y = canvas.height * 0.7 - t * (canvas.height * 0.2);
          else if (animPreset === 'slideDown') y = canvas.height * 0.3 + t * (canvas.height * 0.2);
          else if (animPreset === 'slideLeft') x = canvas.width * 0.2 + t * (canvas.width * 0.3);
          else if (animPreset === 'slideRight') x = canvas.width * 0.8 - t * (canvas.width * 0.3);
          else if (animPreset === 'bounce') {
            scale = Math.sin(t * Math.PI) * 1.2;
            if (scale > 1) scale = 1 + (scale - 1) * 0.3;
          }
          else if (animPreset === 'typewriter') opacity = 1;
        } else if (progress > 0.8) {
          const t = (1 - progress) / 0.2;
          const outPreset = tmpl.textSettings.animation?.out || 'fadeOut';
          if (outPreset === 'fadeOut') opacity = t;
          else if (outPreset === 'zoom') { scale = 1.0 - (1 - t) * 0.5; opacity = t; }
          else if (outPreset === 'slideUp') y = canvas.height * 0.5 - (1 - t) * (canvas.height * 0.3);
          else if (outPreset === 'slideDown') y = canvas.height * 0.5 + (1 - t) * (canvas.height * 0.3);
          else if (outPreset === 'slideLeft') x = canvas.width * 0.5 - (1 - t) * (canvas.width * 0.3);
          else if (outPreset === 'slideRight') x = canvas.width * 0.5 + (1 - t) * (canvas.width * 0.3);
        }

        if (tmpl.animations) {
          if (tmpl.animations['transform.scale']) {
            const track = tmpl.animations['transform.scale'];
            const time = progress * duration;
            const kf = track.find(k => k.time >= time) || track[track.length - 1];
            if (kf) scale = kf.value / 100;
          }
          if (tmpl.animations['transform.rotation']) {
            const track = tmpl.animations['transform.rotation'];
            const time = progress * duration;
            const kf = track.find(k => k.time >= time) || track[track.length - 1];
            if (kf) rotation = (kf.value * Math.PI) / 180;
          }
          if (tmpl.animations['opacity']) {
            const track = tmpl.animations['opacity'];
            const time = progress * duration;
            const kf = track.find(k => k.time >= time) || track[track.length - 1];
            if (kf) opacity = kf.value;
          }
        }

        ctx.globalAlpha = opacity;
        ctx.translate(x, y);
        ctx.rotate(rotation);
        ctx.scale(scale, scale);

        let fontName = tmpl.textSettings.fontFamily || 'Inter';
        ctx.font = `${tmpl.textSettings.bold ? 'bold ' : ''}10px "${fontName}", sans-serif`;
        ctx.fillStyle = tmpl.textSettings.color || '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const textStr = tmpl.textSettings.text.split('\n')[0];
        const previewText = animPreset === 'typewriter' && progress < 0.8
          ? textStr.slice(0, Math.floor((progress / 0.8) * textStr.length))
          : textStr;
        ctx.fillText(previewText, 0, 0);

        ctx.restore();
      } else if (tmpl.type === 'video') {
        if (tmpl.category === 'particle' && tmpl.particleSettings) {
          ctx.fillStyle = tmpl.particleSettings.color === 'auto' ? '#ff4400' : (tmpl.particleSettings.color || '#ffffff');
          const pType = tmpl.particleSettings.type;
          const count = 12;
          for (let pIdx = 0; pIdx < count; pIdx++) {
            let px = (pIdx * 17 + elapsed * (tmpl.particleSettings.wind || 0) * 10) % canvas.width;
            let py = (pIdx * 11 + elapsed * (tmpl.particleSettings.speed || 50) * 0.4) % canvas.height;
            if (tmpl.particleSettings.gravity < 0) {
              py = canvas.height - py;
            }
            ctx.beginPath();
            if (pType === 'hearts') {
              ctx.arc(px, py, 2, 0, 2 * Math.PI);
            } else if (pType === 'rain') {
              ctx.moveTo(px, py);
              ctx.lineTo(px + 1, py + 4);
              ctx.strokeStyle = ctx.fillStyle;
              ctx.lineWidth = 1;
              ctx.stroke();
              continue;
            } else {
              ctx.arc(px, py, 1.5, 0, 2 * Math.PI);
            }
            ctx.fill();
          }
        } else if (tmpl.category === 'color-preset' && tmpl.colorFilters) {
          ctx.fillStyle = '#ef4444';
          ctx.fillRect(5, 5, canvas.width / 2 - 5, canvas.height - 10);
          ctx.fillStyle = '#3b82f6';
          ctx.fillRect(canvas.width / 2, 5, canvas.width / 2 - 5, canvas.height - 10);
          
          ctx.save();
          ctx.globalCompositeOperation = 'hue';
          ctx.fillStyle = tmpl.accentColor;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.restore();
        } else if (tmpl.category === 'fx-overlay') {
          ctx.fillStyle = '#27272a';
          ctx.fillRect(10, 5, canvas.width - 20, canvas.height - 10);
          if (tmpl.id === 'fx_cinematic_bars') {
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, canvas.width, 4);
            ctx.fillRect(0, canvas.height - 4, canvas.width, 4);
          } else if (tmpl.id === 'fx_terminal_scanline') {
            ctx.strokeStyle = '#22c55e';
            ctx.lineWidth = 0.5;
            for (let yL = 2; yL < canvas.height; yL += 3) {
              ctx.beginPath();
              ctx.moveTo(0, yL);
              ctx.lineTo(canvas.width, yL);
              ctx.stroke();
            }
          } else {
            ctx.strokeStyle = tmpl.accentColor;
            ctx.lineWidth = 1;
            ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);
          }
        }
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    animationFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [isHovered, tmpl]);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="flex items-center gap-2.5 p-2.5 rounded border border-[#3e3e3e] hover:border-amber-500/50 bg-[#1e1e1e] hover:bg-[#2a2a2a] cursor-pointer transition-all group"
    >
      <div className="w-16 h-10 bg-[#141414] rounded overflow-hidden shrink-0 flex items-center justify-center border border-[#3e3e3e]/40 relative">
        {isHovered ? (
          <canvas
            ref={canvasRef}
            width={64}
            height={40}
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ background: `${tmpl.accentColor}12` }}
          >
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: tmpl.accentColor }} />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-xs text-white font-medium truncate">{tmpl.name}</p>
        <p className="text-[9px] text-[#6a6a6a] truncate">{tmpl.description}</p>
        <p className="text-[8px] mt-0.5" style={{ color: tmpl.accentColor + 'cc' }}>
          {tmpl.defaultDuration > 0 ? `${tmpl.defaultDuration}s` : 'Preset'} · {tmpl.category}
        </p>
      </div>
      <span className="text-[8px] text-amber-400/40 group-hover:text-amber-400/80 transition-colors shrink-0">DRAG</span>
    </div>
  );
});

const generateId = () => Math.random().toString(36).substr(2, 9);

export function MediaPanel() {
  const [isLocalImporting, setIsLocalImporting] = useState(false);
  const { detectingBeatId, handleDetectBeats } = useAudioFeatures();
  
  const handleRepairAudio = async (media: MediaItem) => {
    if (media.type !== 'audio') return;
    toast.loading('Repairing audio...', { id: 'repair' });
    try {
      const { resolveMediaFile } = await import('@/utils/mediaFileHandle');
      const file = await resolveMediaFile(media.id);
      if (!file) throw new Error('Could not read file');
      
      const repairedBlob = await repairAudioFile(file);
      
      toast.dismiss('repair');
      toast.success('Audio repaired! Please select a location to save it.');
      
      const suggestedName = media.name.replace(/\.[^/.]+$/, "") + "_repaired.wav";
      
      let handle;
      try {
        if ('showSaveFilePicker' in window) {
          handle = await (window as any).showSaveFilePicker({
            suggestedName,
            types: [{
              description: 'WAV Audio File',
              accept: { 'audio/wav': ['.wav'] },
            }],
          });
          const writable = await handle.createWritable();
          await writable.write(repairedBlob);
          await writable.close();
        }
      } catch (e) {
        const url = URL.createObjectURL(repairedBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = suggestedName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      
      const repairedFile = new File([repairedBlob], suggestedName, { type: 'audio/wav' });
      const newMediaItem = await probeFile(repairedFile);
      
      await saveFileToDB(newMediaItem.id, repairedFile);
      if (handle) {
         try { await storeMediaHandle(newMediaItem.id, repairedFile, handle); } catch (e) {}
      }
      
      useEditorStore.getState().addMedia(newMediaItem);
      toast.success('Repaired audio added to library!');
      
    } catch (e) {
      console.error(e);
      toast.error('Failed to repair audio.', { id: 'repair' });
    }
  };

  const { ttsText, setTtsText, ttsLanguage, setTtsLanguage, ttsRate, setTtsRate, ttsPitch, setTtsPitch, ttsEngine, setTtsEngine, ttsVoice, setTtsVoice, isGeneratingTTS, ttsAudioRef, previewTTS, generateTTS } = useTTS();
  const { isDragging, isUploading: importing, progressText: hookProgressText, progressPercent: hookProgressPercent, currentFileName: hookCurrentFileName, fileInputRef, handleDragOver, handleDragLeave, handleDrop, handleFileSelect } = useMediaImport();
  const {
    mediaLibrary,
    activeMediaTab,
    setActiveMediaTab,
    addMedia,
    removeMedia,
    insertTextClip,
    addBeatMarkers,
    clearBeatMarkers,
    autoSyncTrackToBeats,
    projectTemplates,
    saveProjectAsTemplate,
    deleteProjectTemplate,
    loadProjectTemplate,
    // Click-to-apply store helpers
    tracks,
    pipWindows,
    addTrack,
    addClip,
    updateClip,
    selectClip,
    saveSnapshot,
    subtitles,
    selectedSubtitleId,
    selectSubtitle,
    addTextMedia,
    rippleDeleteClip,
    removeClip,
    seek,
    aiVideoIsGenerating,
    aiVideoProgress,
  } = useEditorStore(useShallow(s => ({
    mediaLibrary: s.mediaLibrary,
    activeMediaTab: s.activeMediaTab,
    setActiveMediaTab: s.setActiveMediaTab,
    addMedia: s.addMedia,
    removeMedia: s.removeMedia,
    insertTextClip: s.insertTextClip,
    addBeatMarkers: s.addBeatMarkers,
    clearBeatMarkers: s.clearBeatMarkers,
    autoSyncTrackToBeats: s.autoSyncTrackToBeats,
    projectTemplates: s.projectTemplates,
    saveProjectAsTemplate: s.saveProjectAsTemplate,
    deleteProjectTemplate: s.deleteProjectTemplate,
    loadProjectTemplate: s.loadProjectTemplate,
    tracks: s.tracks,
    pipWindows: s.pipWindows,
    addTrack: s.addTrack,
    addClip: s.addClip,
    updateClip: s.updateClip,
    selectClip: s.selectClip,
    saveSnapshot: s.saveSnapshot,
    subtitles: s.subtitles,
    selectedSubtitleId: s.selectedSubtitleId,
    selectSubtitle: s.selectSubtitle,
    addTextMedia: s.addTextMedia,
    rippleDeleteClip: s.rippleDeleteClip,
    removeClip: s.removeClip,
    seek: s.seek,
    aiVideoIsGenerating: s.aiVideoIsGenerating,
    aiVideoProgress: s.aiVideoProgress,
  })));

  // PERF: MediaPanel (~3.5k lines) only uses the playhead to highlight which
  // timeline text clip is currently active and as the default insertion point for
  // new clips. Both tolerate a 5 Hz signal, whereas selecting raw `currentTime`
  // re-rendered the whole panel on every playback store write. Insertion handlers
  // that need an exact value already call useEditorStore.getState().currentTime.
  const currentTime = usePlaybackTime(5);
  // Used to highlight the selected kinetic word layer in the text-clip list.
  const selectedClipId = useEditorStore((s) => s.selectedClipId);

  const [syncTargetTrack, setSyncTargetTrack] = useState('');
  const [syncAudioClip, setSyncAudioClip] = useState('');
  const [syncEveryNBeats, setSyncEveryNBeats] = useState(4);
  const [syncTransitionType, setSyncTransitionType] = useState('dissolve');
  const [isSyncing, setIsSyncing] = useState(false);

  const usedMediaIds = useMemo(() => {
    const clips = getAllClipsDeep({ tracks, pipWindows } as any);
    return new Set(clips.map(c => c.mediaId).filter(Boolean));
  }, [tracks, pipWindows]);

  // Click-to-apply fallback handlers
  const handleTemplateClick = (tmpl: any) => {
    if (tmpl.type === 'video') {
      const { selectedClipId, currentTime } = useEditorStore.getState();
      let targetClip = findClipInTracks(tracks, selectedClipId, useEditorStore.getState().pipWindows);
      
      if (!targetClip) {
        const videoTrack = tracks.find(t => t.type === 'video');
        if (videoTrack) {
          targetClip = videoTrack.clips.find(c => currentTime >= c.startTime && currentTime <= c.startTime + c.duration);
        }
      }

      if (!targetClip) {
        toast.error("Please select a video clip on the timeline first, or seek to a clip to apply the template.");
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

      updateClip(targetClip.id, updates);
      saveSnapshot();
      return;
    }

    let targetTrack = tracks.find((t) => t.type === 'text');
    if (!targetTrack) {
      addTrack('text');
      targetTrack = useEditorStore.getState().tracks.find((t) => t.type === 'text');
    }
    if (!targetTrack) return;

    const { currentTime } = useEditorStore.getState();
    let startTime = currentTime;
    let attempts = 0;
    const maxAttempts = 100;
    while (attempts < maxAttempts && targetTrack.clips.some((c) => Math.max(0, Math.min(startTime + tmpl.defaultDuration, c.startTime + c.duration) - Math.max(startTime, c.startTime)) > 0)) {
       startTime += tmpl.defaultDuration + 0.1;
       attempts++;
    }

    const mediaId = `tmpl_media_${Math.random().toString(36).substr(2, 9)}`;
    const clipId  = `tmpl_clip_${Math.random().toString(36).substr(2, 9)}`;
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
      trackId: targetTrack.id,
      startTime,
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
    selectClip(clipId);
    saveSnapshot();
    toast.success(`Added text template "${tmpl.name}" to timeline`);
  };

  const handleEffectClick = (effect: any) => {
    let targetTrack = tracks.find((t) => t.type === 'fx');
    if (!targetTrack) {
      addTrack('fx');
      targetTrack = useEditorStore.getState().tracks.find((t) => t.type === 'fx');
    }
    if (!targetTrack) return;

    const { currentTime } = useEditorStore.getState();
    let startTime = currentTime;
    let attempts = 0;
    const maxAttempts = 100;
    const defaultDuration = 5;
    while (attempts < maxAttempts && targetTrack.clips.some((c) => Math.max(0, Math.min(startTime + defaultDuration, c.startTime + c.duration) - Math.max(startTime, c.startTime)) > 0)) {
       startTime += defaultDuration + 0.1;
       attempts++;
    }

    const FX_TYPE_MAP: Record<string, string> = Object.fromEntries(
      FX_EFFECTS.map((fx) => [fx.name, fx.type])
    );
    const fxType = FX_TYPE_MAP[effect.name] ?? effect.type ?? effect.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const fxMediaId = `fx_media_${Math.random().toString(36).substr(2, 9)}`;
    const fxClipId = `fx_clip_${Math.random().toString(36).substr(2, 9)}`;
    
    addMedia({
      id: fxMediaId,
      name: effect.name,
      type: 'fx',
      duration: defaultDuration,
      url: '',
      createdAt: Date.now(),
      fxType,
    });
    
    const fxClip: any = {
      id: fxClipId,
      mediaId: fxMediaId,
      trackId: targetTrack.id,
      startTime,
      duration: defaultDuration,
      trimStart: 0,
      trimEnd: 0,
      transform: { x: 0, y: 0, scale: 100, rotation: 0 },
      opacity: 1,
      speed: 1,
      effects: [],
      fxSettings: {
        type: fxType as any,
        intensity: 100,
      },
    };
    addClip(fxClip);
    selectClip(fxClipId);
    saveSnapshot();
    toast.success(`Added effect "${effect.name}" to FX track`);
  };

  const handleColorPresetClick = (effect: any) => {
    const { selectedClipId, tracks } = useEditorStore.getState();

    if (selectedClipId) {
      let foundClip: any = null;
      for (const t of tracks) {
        foundClip = t.clips.find(c => c.id === selectedClipId);
        if (foundClip) break;
      }
      if (foundClip) {
        const existing = foundClip.colorFilters ?? {
          temperature: 0, tint: 0, exposure: 0, contrast: 100,
          saturation: 100, blur: 0, fadedFilm: 0, vignette: 0,
        };
        updateClip(foundClip.id, {
          colorFilters: { ...existing, ...effect.preset },
        });
        saveSnapshot();
        toast.success(`Applied color preset "${effect.name}" to selected clip`);
        return;
      }
    }

    toast.error('Select a clip on the timeline first to apply this color preset');
  };

  const handleParticleClick = (effect: any) => {
    const { selectedClipId, tracks } = useEditorStore.getState();
    const defaults = effect.defaultSettings;

    if (selectedClipId) {
      let foundClip: any = null;
      for (const t of tracks) {
        foundClip = t.clips.find(c => c.id === selectedClipId);
        if (foundClip) break;
      }
      if (foundClip) {
        updateClip(foundClip.id, {
          particleSettings: {
            type: effect.type,
            emitterX: 50,
            emitterY: 100,
            ...defaults,
          },
        });
        saveSnapshot();
        toast.success(`Applied particle effect "${effect.name}" to selected clip`);
        return;
      }
    }

    toast.error('Select a clip on the timeline first to apply this particle effect');
  };
  const [searchQuery, setSearchQuery] = useState('');
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState<string>('');
  const [importProgressPct, setImportProgressPct] = useState<number>(0);
  
  // TTS State variables
  const [isDragOver, setIsDragOver] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [openSection, setOpenSection] = useState<'fx' | 'color' | 'particles'>('fx');
  const [previewItem, setPreviewItem] = useState<any | null>(null);
  const [templateCategory, setTemplateCategory] = useState<string>('all');
  const [templateSubTab, setTemplateSubTab] = useState<'text' | 'video' | 'project'>('text');
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDesc, setTemplateDesc] = useState('');
  const [confirmLoadTemplateId, setConfirmLoadTemplateId] = useState<string | null>(null);

  // Subtab and generator states
  const [textSubTab, setTextSubTab] = useState<'text' | 'subtitle'>('text');
  const [isGeneratingCaptions, setIsGeneratingCaptions] = useState(false);
  const [captionProgress, setCaptionProgress] = useState(0);
  const [showCaptionLanguageModal, setShowCaptionLanguageModal] = useState(false);
  const [selectedCaptionLanguages, setSelectedCaptionLanguages] = useState<string[]>(['EN']);

  // AI SFX Generator States

  const [sfxVisionProvider, setSfxVisionProvider] = useState<'gemini' | 'groq'>('gemini');

  const [isAnalyzingSfx, setIsAnalyzingSfx] = useState(false);
  const [sfxAnalysisCues, setSfxAnalysisCues] = useState<any[] | null>(null);
  const [sfxChunkStartTime, setSfxChunkStartTime] = useState(0);
  const [isGeneratingSfxBackground, setIsGeneratingSfxBackground] = useState(false);
  const [sfxGenerationProgress, setSfxGenerationProgress] = useState(0);
  const [sfxGeneratedCues, setSfxGeneratedCues] = useState<any[] | null>(null);
  const sfxBlobUrlsRef = useRef<string[]>([]);
  useEffect(() => {
    return () => {
      sfxBlobUrlsRef.current.forEach(u => URL.revokeObjectURL(u));
      sfxBlobUrlsRef.current = [];
    };
  }, []);
  const [showAiSfxModal, setShowAiSfxModal] = useState(false);
  const [showAIGeneratorModal, setShowAIGeneratorModal] = useState(false);
  const [showAutoVideoModal, setShowAutoVideoModal] = useState(false);
  const lutInputRef = useRef<HTMLInputElement>(null);
  const srtInputRef = useRef<HTMLInputElement>(null);

  const CAPTION_LANGUAGES = [
    { code: 'EN', name: 'English' },
    { code: 'HI', name: 'Hindi' },
    { code: 'ES', name: 'Spanish' },
    { code: 'FR', name: 'French' },
    { code: 'DE', name: 'German' },
    { code: 'JA', name: 'Japanese' }
  ];

  const handleGenerateCaptions = async (languages: string[]) => {
    setShowCaptionLanguageModal(false);
    setIsGeneratingCaptions(true);
    setCaptionProgress(0);
    try {
      const { generateAutoCaptions } = await import('@/utils/autoCaptions');
      await generateAutoCaptions(languages, (p) => setCaptionProgress(p));
      toast.success("Auto Captions generated!");
    } catch (err: any) {
      console.error(err);
      toast.error(`Auto Captions failed: ${err.message || err}`);
    } finally {
      setIsGeneratingCaptions(false);
    }
  };

  const [isRecordingScreen, setIsRecordingScreen] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const startScreenRecord = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      const chunks: Blob[] = [];
      recorder.ondataavailable = e => chunks.push(e.data);
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const file = new File([blob], 'Screen Record.webm', { type: 'video/webm' });
        
        setIsLocalImporting(true);
        try {
          const url = URL.createObjectURL(file);
          const meta = await probeFile(file);
          const id = 'rec_' + Date.now();
          await saveFileToDB(id, file); // Save to OPFS/IDB for persistence
          
          addMedia({
            id,
            name: 'Screen Record.webm',
            type: 'video',
            url,
            duration: meta.duration,
            width: meta.width,
            height: meta.height,
            frameRate: meta.frameRate,
            createdAt: Date.now()
          });
        } catch (e) {
          console.error(e);
        } finally {
          setIsLocalImporting(false);
          setIsRecordingScreen(false);
        }
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecordingScreen(true);

      stream.getVideoTracks()[0].onended = () => {
        if (recorder.state === 'recording') recorder.stop();
      };
    } catch (err) {
      console.error(err);
      setIsRecordingScreen(false);
    }
  };

  const stopScreenRecord = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
    }
  };

  // FIX M25: Cancel speechSynthesis when component unmounts to prevent audio leaks
  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try { mediaRecorderRef.current.stop(); } catch (e) {}
      }
      if (mediaRecorderRef.current?.stream) {
        mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
      }
      if (ttsAudioRef.current) {
        try {
          ttsAudioRef.current.pause();
          ttsAudioRef.current.src = '';
        } catch (_) {}
        ttsAudioRef.current = null;
      }
    };
  }, []);

  const [mediaTypeFilter, setMediaTypeFilter] = useState<'all' | 'video' | 'audio' | 'image'>('all');

  const tabs: { id: MediaTab; label: string; icon: typeof Film }[] = [
    { id: 'project', label: 'Media', icon: Folder },
    { id: 'audio', label: 'Audio', icon: Music },
    { id: 'text', label: 'Text', icon: Type },
    { id: 'effects', label: 'Effects', icon: Waves },
    { id: 'transitions', label: 'Transitions', icon: Sparkles },
    { id: 'templates', label: 'Elements', icon: Clapperboard },
  ];

  const filteredMedia = useMemo(() => mediaLibrary.filter((m) => {
    if (m.type === 'text' || m.type === 'fx') return false;
    if (searchQuery && !m.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (mediaTypeFilter === 'video') return m.type === 'video';
    if (mediaTypeFilter === 'audio') return m.type === 'audio';
    if (mediaTypeFilter === 'image') return m.type === 'image';
    return true;
  }), [mediaLibrary, searchQuery, mediaTypeFilter]);

  const handleDragStart = (e: React.DragEvent, mediaId: string) => {
    e.dataTransfer.setData('application/procut-media', mediaId);
    e.dataTransfer.effectAllowed = 'copy';
    // Store on window so timeline can read it during dragover
    // (browsers block dataTransfer.getData during dragover for security)
    (window as any).__procutDraggingMediaId = mediaId;
  };

  // Real import with probing
  const importFiles = useCallback(async (files: FileList | File[]) => {
    setIsLocalImporting(true);
    setImportProgressPct(0);
    const fileArray = Array.from(files);

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      setImportProgress(`Importing ${file.name} (${i + 1}/${fileArray.length})...`);
      setImportProgressPct((i / fileArray.length) * 100);

      try {
        const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
        const supportedExtensions = [
          '.mp4', '.webm', '.ogg', '.mov', '.mkv',
          '.mp3', '.wav', '.m4a', '.aac',
          '.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg',
          '.cube'
        ];
        if (!supportedExtensions.includes(ext)) {
          toast.error(`Unsupported file type: ${file.name}`);
          continue;
        }

        // Handle .cube LUT files specially
        if (file.name.toLowerCase().endsWith('.cube')) {
          const text = await file.text();
          const lutData = parseCubeLut(text);
          const lutId = `lut_${Date.now()}_${Math.random().toString(36).substr(2,5)}`;
          // FIX M6: Pass the file argument so LUT is saved to IndexedDB on project reload
          const lutBlob = new Blob([text], { type: 'text/plain' });
          const lutFile = new File([lutBlob], file.name, { type: 'text/plain', lastModified: file.lastModified });
          addMedia({
            id: lutId,
            name: file.name.replace(/\.cube$/i, ''),
            type: 'lut',
            duration: 0,
            url: '',
            size: file.size,
            createdAt: Date.now(),
            lutData,
          }, lutFile);
        } else {
          const mediaItem = await probeFile(file);
          addMedia(mediaItem, file);
        }
      } catch (err) {
        console.error(`Failed to import ${file.name}:`, err);
        toast.error(`Failed to import ${file.name}: ${err instanceof Error ? err.message : String(err)}`);
      }
      setImportProgressPct(((i + 1) / fileArray.length) * 100);
    }

    setIsLocalImporting(false);
    setImportProgress('');
    setImportProgressPct(0);
  }, [addMedia]);

  // Beat detection handler
  // LUT file import handler
  const handleLutImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    importFiles(files);
    e.target.value = '';
  }, [importFiles]);

  const handleImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    importFiles(files);
    // Reset input so the same file can be re-imported
    e.target.value = '';
  }, [importFiles]);

  const handleSrtImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const parsed = parseSRT(text);
      if (parsed.length === 0) {
        toast.error("Failed to parse SRT or file is empty.");
        return;
      }

      const store = useEditorStore.getState();
      store.importSubtitles(parsed);
      store.recalcTotalDuration?.(); // If it exists
      toast.warning(`Imported ${parsed.length} subtitles onto a new 'Subtitles' track!`);
    };

    reader.readAsText(file);
    e.target.value = '';
  }, []);

  const relinkInputRef = useRef<HTMLInputElement>(null);

  const handleRelinkFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsLocalImporting(true);
    setImportProgress('Re-linking project files...');
    setImportProgressPct(0);

    const fileArray = Array.from(files);
    const missing = mediaLibrary.filter(
      (m) => m.type !== 'text' && m.type !== 'fx' && (m.url === 'PENDING_RESTORE' || !m.url)
    );

    let linkedCount = 0;

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      const match = missing.find((m) => m.name === file.name);
      setImportProgressPct((i / fileArray.length) * 100);
      if (match) {
        setImportProgress(`Linking ${file.name}...`);
        try {
          if (match.url && match.url.startsWith('blob:')) {
            URL.revokeObjectURL(match.url);
          }
          if (match.thumbnail && match.thumbnail.startsWith('blob:') && match.thumbnail !== match.url) {
            URL.revokeObjectURL(match.thumbnail);
          }
          const objectUrl = URL.createObjectURL(file);

          // Save file to IndexedDB
          await saveFileToDB(match.id, file);

          // Capture a persistent file handle when possible (Chromium 86+).
          // <input type="file"> does not expose FileSystemFileHandle directly,
          // but we attempt the property anyway in case future browsers allow it.
          const possibleHandle = (file as unknown as { handle?: FileSystemFileHandle }).handle;
          try {
            await storeMediaHandle(match.id, file, possibleHandle);
          } catch {
            // ignore — IDB fallback path still works
          }

          // Update the media library URL
          useEditorStore.setState((state) => ({
            mediaLibrary: state.mediaLibrary.map((m) =>
              m.id === match.id
                ? {
                    ...m,
                    url: objectUrl,
                    thumbnail: m.type === 'image' ? objectUrl : m.thumbnail === 'PENDING_RESTORE' ? objectUrl : m.thumbnail,
                  }
                : m
            ),
          }));
          linkedCount++;
        } catch (err) {
          console.error(`Failed to link ${file.name}:`, err);
        }
      }
    }

    setImportProgressPct(100);
    // Refresh state in editor store
    useEditorStore.getState().recalcTotalDuration();
    useEditorStore.getState().saveSnapshot();

    // Dispatch event to notify PreviewCanvas to redraw
    window.dispatchEvent(new CustomEvent('procut-frame-updated'));

    setIsLocalImporting(false);
    setImportProgress('');
    setImportProgressPct(0);
    toast.success(`Successfully re-linked ${linkedCount} files!`);
    e.target.value = '';
  };

  // Drag-and-drop zone handlers
  const handleZoneDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only accept file drops, not media panel drags
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragOver(true);
    }
  }, []);

  const handleZoneDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleZoneDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      importFiles(files);
    }
  }, [importFiles]);

  const handleDelete = (id: string) => {
    const item = mediaLibrary.find((m) => m.id === id);
    if (item && item.url && item.url.startsWith('blob:')) {
      try { URL.revokeObjectURL(item.url); } catch (e) { console.error(e); }
    }
    if (item && item.thumbnail && item.thumbnail.startsWith('blob:')) {
      try { URL.revokeObjectURL(item.thumbnail); } catch (e) { console.error(e); }
    }
    removeMedia(id);
    setConfirmDeleteId(null);
  };
  const renderMediaThumbnail = (media: MediaItem) => {
    if (media.thumbnail) {
      return (
        <img
          src={media.thumbnail}
          crossOrigin="anonymous"
          alt={media.name}
          className="w-full h-full object-cover rounded-sm"
          draggable={false}
        />
      );
    }
    return (
      <div className="flex items-center justify-center h-full">
        {getMediaIcon(media.type)}
      </div>
    );
  };

  const renderWaveformPreview = (media: MediaItem) => {
    if (!media.waveformPeaks || media.waveformPeaks.length === 0) return null;
    const peaks = media.waveformPeaks;
    // Show ~30 bars for the mini preview
    const step = Math.max(1, Math.floor(peaks.length / 30));
    const displayPeaks: number[] = [];
    for (let i = 0; i < peaks.length; i += step) {
      displayPeaks.push(peaks[i]);
    }

    return (
      <div className="flex items-end gap-px h-6 mt-1">
        {displayPeaks.map((peak, i) => (
          <div
            key={i}
            className="flex-1 bg-emerald-400/50 rounded-sm"
            style={{
              height: `${Math.max(8, peak * 100)}%`,
              minWidth: '1px',
            }}
          />
        ))}
      </div>
    );
  };
  const handleAnalyzeSfx = async () => {
    setIsAnalyzingSfx(true);
    setSfxAnalysisCues(null);
    setSfxGeneratedCues(null);
    sfxBlobUrlsRef.current.forEach(u => URL.revokeObjectURL(u));
    sfxBlobUrlsRef.current = [];
    
    try {
      const { totalDuration } = useEditorStore.getState();
      const chunkDuration = 10;
      const allCues: any[] = [];
      let requestCount = 0;
      
      // Calculate total chunks for progress tracking
      const totalChunks = Math.ceil(totalDuration / chunkDuration);
      
      for (let t = 0; t < totalDuration; t += chunkDuration) {
        const chunkIndex = Math.floor(t / chunkDuration) + 1;
        
        // Rate limit: Max 14 requests per minute
        if (requestCount >= 14) {
          toast.loading(`Rate limit reached (14 req/min). Pausing for 90 seconds before continuing...`, { id: 'sfx-analyze', duration: 90000 });
          await new Promise(resolve => setTimeout(resolve, 90000));
          requestCount = 0;
        }
        
        toast.loading(`Analyzing timeline chunk ${chunkIndex}/${totalChunks}...`, { id: 'sfx-analyze' });
        
        const chunkData = await captureCanvasChunk(t, chunkDuration, 5);
        const cues = await analyzeCanvasChunkWithGemini(chunkData, chunkDuration, sfxVisionProvider);
        
        // Shift cues to their absolute position on the timeline
        const absoluteCues = cues.map(cue => ({
          ...cue,
          start: t + cue.start,
          end: t + cue.end
        }));
        
        allCues.push(...absoluteCues);
        requestCount++;
      }
      
      // Set the start time to 0 since we analyzed the whole timeline
      setSfxChunkStartTime(0);
      setSfxAnalysisCues(allCues);
      
      toast.success('Full timeline analyzed successfully!', { id: 'sfx-analyze' });
    } catch (err: any) {
      console.error('SFX Analysis failed:', err);
      toast.error(`SFX Analysis failed: ${err.message || String(err)}`, { id: 'sfx-analyze' });
    } finally {
      setIsAnalyzingSfx(false);
    }
  };

  const handleGenerateSfxBackground = async () => {
    if (!sfxAnalysisCues || sfxAnalysisCues.length === 0) return;
    
    setIsGeneratingSfxBackground(true);
    setSfxGenerationProgress(0);
    // Revoke any previous blob URLs before generating new ones
    sfxBlobUrlsRef.current.forEach(u => URL.revokeObjectURL(u));
    sfxBlobUrlsRef.current = [];
    
    try {
      toast.loading(`Generating SFX via ElevenLabs...`, { id: 'sfx-gen' });
      
      const generatedBlobs = await generateCombinedSfx(
        sfxAnalysisCues,
        (progress) => setSfxGenerationProgress(progress)
      );
      
      const generated = sfxAnalysisCues.map((cue, i) => {
        const audioBlob = generatedBlobs[i];
        if (!audioBlob || audioBlob.size === 0) {
          return { ...cue, options: [] };
        }
        
        const blobUrl = URL.createObjectURL(audioBlob);
        sfxBlobUrlsRef.current.push(blobUrl);
        
        return {
          ...cue,
          options: [
            {
              id: `el_${Date.now()}_${i}`,
              name: `AI: ${cue.query.slice(0, 30)}`,
              duration: cue.end - cue.start,
              previewUrl: blobUrl,
              blob: audioBlob,
              tags: ['ai-generated', 'sfx']
            }
          ]
        };
      });
      
      setSfxGeneratedCues(generated);
      toast.success('SFX generation complete!', { id: 'sfx-gen' });
    } catch (err: any) {
      toast.error(`Generation error: ${err.message}`, { id: 'sfx-gen' });
    } finally {
      setIsGeneratingSfxBackground(false);
    }
  };

  return (
    <div
      data-help-id="media-panel"
      className="h-full flex flex-row bg-[var(--theme-bg-panel)] border-r border-[var(--theme-border)] text-[var(--theme-text-primary)] select-none overflow-hidden"
      onDragOver={handleZoneDragOver}
      onDragLeave={handleZoneDragLeave}
      onDrop={handleZoneDrop}
    >
      {/* Left Icon Rail (56px) */}
      <div className="w-14 shrink-0 bg-[var(--theme-bg-app)] border-r border-[var(--theme-border)] flex flex-col justify-between items-center py-2 z-10">
        <div className="flex flex-col items-center gap-1 w-full">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeMediaTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveMediaTab(tab.id)}
                className={`w-11 h-12 rounded-xl flex flex-col items-center justify-center gap-1 transition-all group relative ${
                  isActive
                    ? 'bg-blue-600/15 text-blue-500 font-semibold shadow-[inset_0_0_0_1px_rgba(59,130,246,0.3)]'
                    : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)] hover:bg-[var(--theme-bg-subpanel)]'
                }`}
                title={tab.label}
              >
                {isActive && (
                  <div className="absolute left-0 top-2.5 bottom-2.5 w-1 bg-blue-500 rounded-r-full" />
                )}
                <Icon className={`w-4 h-4 transition-transform group-hover:scale-110 ${isActive ? 'text-blue-500' : ''}`} />
                <span className="text-[9px] tracking-tight leading-none">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Bottom Status Dot */}
        <div className="flex flex-col items-center gap-1 pt-2 border-t border-[var(--theme-border)]/50 w-full">
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[8px] font-semibold text-emerald-400">Ready</span>
          </div>
        </div>
      </div>

      {/* Subpanel Content (flex-1) */}
      <div className="flex-1 min-w-0 flex flex-col h-full bg-[var(--theme-bg-panel)] overflow-hidden relative">
        {/* Upload Progress Overlay */}
        <UploadProgressOverlay
          isDragging={isDragOver || isDragging}
          isUploading={importing || isLocalImporting || importProgressPct > 0}
          progressText={hookProgressText || importProgress || 'Importing media files...'}
          progressPercent={hookProgressPercent || importProgressPct}
          fileName={hookCurrentFileName}
        />

        {/* Subpanel Top Header */}
        <div className="h-10 px-3 border-b border-[var(--theme-border)] flex items-center justify-between shrink-0 bg-[var(--theme-bg-panel)]/80 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-semibold text-[var(--theme-text-primary)] tracking-wide capitalize">
              {activeMediaTab === 'project' ? 'Media Library' : activeMediaTab === 'templates' ? 'Elements' : activeMediaTab}
            </h2>
            {activeMediaTab === 'project' && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--theme-bg-subpanel)] text-[var(--theme-text-muted)] border border-[var(--theme-border)] font-mono">
                {filteredMedia.length}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            {activeMediaTab === 'project' && (
              <div className="flex bg-[var(--theme-bg-subpanel)] rounded-lg p-0.5 border border-[var(--theme-border)]">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1 rounded-md transition-all ${
                    viewMode === 'grid'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)]'
                  }`}
                  title="Grid View"
                >
                  <Grid3X3 className="w-3 h-3" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-1 rounded-md transition-all ${
                    viewMode === 'list'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)]'
                  }`}
                  title="List View"
                >
                  <List className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        </div>

        {activeMediaTab === 'project' && (
          <div className="flex-1 overflow-y-auto flex flex-col min-h-0">
            {/* Search & Category Filter Pills */}
            <div className="p-2.5 space-y-2 border-b border-[var(--theme-border)] bg-[var(--theme-bg-panel)] shrink-0">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--theme-text-muted)]" />
                <label htmlFor="media-search" className="sr-only">Search media</label>
                <input
                  id="media-search"
                  type="text"
                  placeholder="Search media..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-7 py-1.5 bg-[var(--theme-bg-subpanel)] border border-[var(--theme-border)] rounded-lg text-xs text-[var(--theme-text-primary)] placeholder-[var(--theme-text-muted)] focus:outline-none focus:border-blue-500 transition-colors"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)]"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Category Filter Pills */}
              <div className="flex items-center gap-1 overflow-x-auto [&::-webkit-scrollbar]:hidden">
                {(['all', 'video', 'audio', 'image'] as const).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setMediaTypeFilter(cat)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-medium capitalize transition-all whitespace-nowrap ${
                      mediaTypeFilter === cat
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-[var(--theme-bg-subpanel)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)] hover:bg-[var(--theme-bg-card)] border border-[var(--theme-border)]'
                    }`}
                  >
                    {cat === 'all' ? 'All' : cat === 'image' ? 'Images' : cat + 's'}
                  </button>
                ))}
              </div>
            </div>

            {/* Dashed Import Dropzone Card */}
            <div className="p-2.5 pb-1">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-blue-500/30 hover:border-blue-500/60 rounded-xl p-3.5 bg-gradient-to-b from-blue-500/[0.04] to-transparent hover:from-blue-500/[0.08] transition-all cursor-pointer group flex flex-col items-center text-center gap-1.5"
              >
                <div className="w-8 h-8 rounded-full bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-500 group-hover:scale-110 group-hover:bg-blue-600/20 transition-all">
                  <Upload className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-[var(--theme-text-primary)]">Import Media</p>
                  <p className="text-[10px] text-[var(--theme-text-muted)] mt-0.5">Videos, Images, Audio</p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  className="btn-primary-gradient px-3 py-1 text-[11px] font-medium rounded-lg text-white shadow-md hover:shadow-blue-500/20 transition-all flex items-center gap-1 mt-0.5"
                >
                  <Plus className="w-3 h-3" />
                  Import
                </button>
              </div>
            </div>

            {/* Quick Action Tools */}
            <div className="px-2.5 py-1 grid grid-cols-3 gap-1.5">
              <button
                onClick={() => setShowAIGeneratorModal(true)}
                disabled={importing}
                className="relative py-1.5 px-2 bg-gradient-to-r from-amber-500/10 to-orange-500/10 hover:from-amber-500/20 hover:to-orange-500/20 border border-amber-500/30 hover:border-amber-500/60 text-amber-500 rounded-lg text-[10px] font-medium flex items-center justify-center gap-1 transition-all disabled:opacity-50 overflow-hidden"
                title="AI Video Generation"
              >
                {aiVideoIsGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                {aiVideoIsGenerating ? `${Math.round(aiVideoProgress)}%` : 'AI Video'}
              </button>
              <button
                onClick={() => setShowAutoVideoModal(true)}
                disabled={importing}
                className="py-1.5 px-2 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 hover:border-indigo-500/60 text-indigo-400 rounded-lg text-[10px] font-medium flex items-center justify-center gap-1 transition-all disabled:opacity-50"
                title="Auto Faceless Video Generator"
              >
                <Wand2 className="w-3 h-3" />
                Auto Vid
              </button>
              <button
                onClick={isRecordingScreen ? stopScreenRecord : startScreenRecord}
                disabled={importing}
                className={`py-1.5 px-2 border rounded-lg text-[10px] font-medium flex items-center justify-center gap-1 transition-all disabled:opacity-50 ${
                  isRecordingScreen
                    ? 'border-red-500 bg-red-500/20 text-red-400 animate-pulse'
                    : 'border-[var(--theme-border)] bg-[var(--theme-bg-subpanel)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)] hover:border-red-500/50'
                }`}
                title="Record Screen"
              >
                {isRecordingScreen ? <Square className="w-3 h-3 text-red-400" /> : <Monitor className="w-3 h-3" />}
                {isRecordingScreen ? 'Stop' : 'Record'}
              </button>
            </div>

            {/* Missing files warning banner */}
            {(() => {
              const missing = mediaLibrary.filter(
                (m) => m.type !== 'text' && m.type !== 'fx' && (m.url === 'PENDING_RESTORE' || !m.url)
              );
              if (missing.length > 0) {
                return (
                  <div className="mx-2.5 my-1.5 p-2.5 bg-red-950/40 border border-red-500/30 rounded-xl flex flex-col gap-2">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold text-red-200">
                          {missing.length} Missing files in project
                        </p>
                        <p className="text-[10px] text-red-300/80 leading-normal mt-0.5">
                          Some local files need re-linking for this browser session.
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => relinkInputRef.current?.click()}
                      className="w-full py-1 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-200 text-xs font-medium rounded-lg transition-colors"
                    >
                      Re-link Files
                    </button>
                  </div>
                );
              }
              return null;
            })()}

            {/* Media Item In-Panel Preview */}
            {previewItem && (
              <div className="mx-2.5 my-1.5 p-2 bg-[var(--theme-bg-subpanel)] border border-[var(--theme-border)] rounded-xl flex flex-col gap-1.5 relative">
                <div className="relative aspect-video bg-black flex items-center justify-center rounded-lg overflow-hidden">
                  {previewItem.type === 'video' && previewItem.url && previewItem.url !== 'PENDING_RESTORE' && (
                    <video
                      key={previewItem.id}
                      src={previewItem.url}
                      crossOrigin="anonymous"
                      controls
                      className="w-full h-full object-contain"
                      autoPlay={false}
                    />
                  )}
                  {previewItem.type === 'audio' && previewItem.url && previewItem.url !== 'PENDING_RESTORE' && (
                    <div className="p-3 w-full flex flex-col items-center justify-center">
                      <Music className="w-8 h-8 text-blue-400 mb-2" />
                      <audio src={previewItem.url} controls className="w-full h-8" />
                    </div>
                  )}
                  {previewItem.type === 'image' && previewItem.url && previewItem.url !== 'PENDING_RESTORE' && (
                    <img src={previewItem.url} crossOrigin="anonymous" className="w-full h-full object-contain" alt="" />
                  )}
                  <button
                    onClick={() => setPreviewItem(null)}
                    className="absolute top-1.5 right-1.5 p-1 bg-black/60 hover:bg-black/80 rounded-full text-white/70 hover:text-white transition-colors"
                    title="Close Preview"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="px-1 py-0.5 text-[10px] text-[var(--theme-text-muted)] truncate font-medium flex justify-between items-center">
                  <span className="truncate flex-1 pr-2 text-[var(--theme-text-primary)]">{previewItem.name}</span>
                  <span className="shrink-0 font-mono">{formatDuration(previewItem.duration)}</span>
                </div>
              </div>
            )}

            {/* Media Grid / List */}
            <div className="flex-1 p-2.5 pt-1">
              {filteredMedia.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-[var(--theme-text-muted)]">
                  <Film className="w-8 h-8 mb-2 opacity-30" />
                  <p className="text-xs font-medium">No media found</p>
                  <p className="text-[10px] mt-1 text-center px-4">
                    Import files or drag them into this panel
                  </p>
                </div>
              ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-2 gap-2">
                  {filteredMedia.map((media) => (
                    <div
                      key={media.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, media.id)}
                      onMouseEnter={() => setHoveredItem(media.id)}
                      onMouseLeave={() => setHoveredItem(null)}
                      onClick={() => setPreviewItem(media)}
                      className={`group relative rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg-card)] hover:border-blue-500/50 hover:shadow-md transition-all cursor-grab active:cursor-grabbing overflow-hidden ${
                        usedMediaIds.has(media.id) ? 'ring-2 ring-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.3)]' : ''
                      }`}
                    >
                      {/* Thumbnail Container */}
                      <div className="h-20 relative bg-black/20 overflow-hidden">
                        {renderMediaThumbnail(media)}

                        {/* Video Play Overlay */}
                        {media.type === 'video' && (
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30 backdrop-blur-[1px]">
                            <div className="w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg">
                              <Play className="w-3 h-3 ml-0.5 fill-white" />
                            </div>
                          </div>
                        )}

                        {/* Top Right Delete Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteId(media.id);
                          }}
                          className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-red-600 rounded-md text-white opacity-0 group-hover:opacity-100 transition-all shadow-sm"
                          title="Delete media"
                        >
                          <Trash2 className="w-2.5 h-2.5" />
                        </button>

                        {/* Duration Pill (Bottom-left) */}
                        {media.duration > 0 && (
                          <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-black/75 backdrop-blur-sm rounded text-[8px] font-mono text-white font-medium">
                            {formatDuration(media.duration)}
                          </div>
                        )}

                        {/* Type Icon Badge (Bottom-right) */}
                        <div className="absolute bottom-1 right-1 px-1 py-0.5 bg-black/75 backdrop-blur-sm rounded text-[7px] font-semibold text-white/80 uppercase">
                          {media.type}
                        </div>
                      </div>

                      {/* Card Info */}
                      <div className="p-2">
                        <p className="text-[11px] font-medium text-[var(--theme-text-primary)] truncate group-hover:text-blue-500 transition-colors">
                          {media.name}
                        </p>
                        <div className="flex items-center gap-1 mt-0.5 text-[9px] text-[var(--theme-text-muted)] font-mono">
                          {media.width && media.height ? `${media.width}×${media.height}` : formatSize(media.size)}
                        </div>

                        {/* Audio Waveform */}
                        {media.type === 'audio' && renderWaveformPreview(media)}
                      </div>

                      {/* Delete Confirmation Overlay */}
                      {confirmDeleteId === media.id && (
                        <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center gap-1.5 z-20 p-2 text-center">
                          <p className="text-[10px] font-semibold text-white">Delete file?</p>
                          <div className="flex gap-1.5">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDelete(media.id); }}
                              className="px-2 py-0.5 bg-red-600 hover:bg-red-500 text-white text-[9px] font-medium rounded-md transition-colors"
                            >
                              Delete
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }}
                              className="px-2 py-0.5 bg-gray-700 hover:bg-gray-600 text-white text-[9px] font-medium rounded-md transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col space-y-1">
                  {filteredMedia.map((media) => (
                    <div
                      key={media.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, media.id)}
                      onMouseEnter={() => setHoveredItem(media.id)}
                      onMouseLeave={() => setHoveredItem(null)}
                      onClick={() => setPreviewItem(media)}
                      className={`flex items-center gap-2 p-2 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg-card)] hover:border-blue-500/50 hover:bg-[var(--theme-bg-subpanel)] cursor-grab transition-all group ${
                        usedMediaIds.has(media.id) ? 'border-l-4 border-l-blue-500 bg-blue-500/5' : ''
                      }`}
                    >
                      <div className="w-10 h-8 rounded-md overflow-hidden bg-black/30 shrink-0 flex items-center justify-center">
                        {media.thumbnail ? (
                          <img src={media.thumbnail} crossOrigin="anonymous" alt="" className="w-full h-full object-cover" draggable={false} />
                        ) : (
                          getMediaIcon(media.type)
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-medium text-[var(--theme-text-primary)] truncate">{media.name}</p>
                        <p className="text-[9px] text-[var(--theme-text-muted)] font-mono">
                          {formatDuration(media.duration)} · {formatSize(media.size)}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteId(media.id);
                          }}
                          className="p-1 text-[var(--theme-text-muted)] hover:text-red-500 rounded transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>

                      {confirmDeleteId === media.id && (
                        <div className="absolute right-2 flex items-center gap-1 bg-[var(--theme-bg-panel)] border border-[var(--theme-border)] rounded-lg p-1 shadow-lg z-20">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(media.id); }}
                            className="px-2 py-0.5 bg-red-600 hover:bg-red-500 text-white text-[9px] font-medium rounded transition-colors"
                          >
                            Delete
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }}
                            className="px-2 py-0.5 bg-gray-700 hover:bg-gray-600 text-white text-[9px] font-medium rounded transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}



        {activeMediaTab === 'audio' && (
          <div className="flex-1 overflow-y-auto p-3 space-y-4 scrollbar-thin">
            {/* Timeline Voiceover Info */}
            <div className="p-3.5 bg-[var(--theme-bg-card)] border border-[var(--theme-border)] rounded-xl shadow-sm transition-colors">
              <p className="text-[10px] font-bold text-rose-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 animate-pulse" />
                Voiceover Recorder
              </p>
              <p className="text-xs text-[var(--theme-text-muted)] leading-relaxed">
                Click the microphone icon <Mic className="w-3 h-3 inline text-red-500 mx-0.5" /> in any audio track header to record live narration directly onto the timeline at the playhead position.
              </p>
            </div>

            {/* AI Text-to-Speech Generator */}
            <div className="p-3.5 bg-[var(--theme-bg-card)] border border-[var(--theme-border)] rounded-xl space-y-3.5 shadow-sm transition-colors">
              <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                AI Text-to-Speech (TTS)
              </p>

              {/* Textarea */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-[var(--theme-text-muted)] uppercase tracking-wider font-semibold">Script / Speech Text</label>
                <textarea
                  value={ttsText}
                  onChange={(e) => setTtsText(e.target.value)}
                  placeholder="Type or paste the speech script here..."
                  maxLength={200}
                  className="w-full h-24 bg-[var(--theme-bg-subpanel)] text-[var(--theme-text-primary)] text-xs border border-[var(--theme-border)] rounded-lg p-2.5 resize-none focus:outline-none focus:border-blue-500 placeholder-[var(--theme-text-muted)]/50 scrollbar-thin shadow-inner transition-colors"
                />
                <div className="flex justify-end">
                  <span className="text-[9px] text-[var(--theme-text-muted)] font-mono font-medium">{ttsText.length}/200 chars</span>
                </div>
              </div>

              {/* Engine Toggle */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-[var(--theme-text-muted)] uppercase tracking-wider font-semibold">TTS Voice Quality</label>
                <div className="flex flex-col gap-1 bg-[var(--theme-bg-subpanel)] p-1 border border-[var(--theme-border)] rounded-lg">
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setTtsEngine('gemini');
                        setTtsVoice('Aoede');
                      }}
                      className={`flex-1 py-1.5 text-[10px] rounded-md transition-all font-semibold ${
                        ttsEngine === 'gemini'
                          ? 'bg-blue-600 text-white font-bold shadow-sm'
                          : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)] hover:bg-black/5 dark:hover:bg-white/5'
                      }`}
                    >
                      ✨ Gemini 2.5 Flash
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTtsEngine('edge');
                        setTtsVoice('en-US-AriaNeural');
                      }}
                      className={`flex-1 py-1.5 text-[10px] rounded-md transition-all font-semibold ${
                        ttsEngine === 'edge'
                          ? 'bg-blue-600 text-white font-bold shadow-sm'
                          : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)] hover:bg-black/5 dark:hover:bg-white/5'
                      }`}
                    >
                      🚀 Edge
                    </button>
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setTtsEngine('neural');
                        setTtsVoice('alloy');
                      }}
                      className={`flex-1 py-1.5 text-[10px] rounded-md transition-all font-semibold ${
                        ttsEngine === 'neural'
                          ? 'bg-blue-600 text-white font-bold shadow-sm'
                          : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)] hover:bg-black/5 dark:hover:bg-white/5'
                      }`}
                    >
                      🔥 Cloud
                    </button>
                    <button
                      type="button"
                      onClick={() => setTtsEngine('standard')}
                      className={`flex-1 py-1.5 text-[10px] rounded-md transition-all font-semibold ${
                        ttsEngine === 'standard'
                          ? 'bg-blue-600 text-white font-bold shadow-sm'
                          : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)] hover:bg-black/5 dark:hover:bg-white/5'
                      }`}
                    >
                      Standard
                    </button>
                  </div>
                </div>
              </div>

              {ttsEngine === 'edge' ? (
                /* Edge Voices selector */
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-[var(--theme-text-muted)] uppercase tracking-wider font-semibold">AI Voice Profile (Microsoft Edge)</label>
                  <select
                    value={ttsVoice}
                    onChange={(e) => setTtsVoice(e.target.value)}
                    className="w-full bg-[var(--theme-bg-subpanel)] text-[var(--theme-text-primary)] text-xs border border-[var(--theme-border)] rounded-lg px-2.5 py-2 focus:outline-none focus:border-blue-500 cursor-pointer shadow-sm"
                  >
                    <option value="en-US-AriaNeural">English (US) - Aria (Female)</option>
                    <option value="en-US-GuyNeural">English (US) - Guy (Male)</option>
                    <option value="en-US-JennyNeural">English (US) - Jenny (Female)</option>
                    <option value="en-GB-SoniaNeural">English (UK) - Sonia (Female)</option>
                    <option value="en-GB-RyanNeural">English (UK) - Ryan (Male)</option>
                    <option value="hi-IN-SwaraNeural">Hindi (India) - Swara (Female)</option>
                    <option value="hi-IN-MadhurNeural">Hindi (India) - Madhur (Male)</option>
                    <option value="es-ES-ElviraNeural">Spanish (Spain) - Elvira (Female)</option>
                    <option value="es-ES-AlvaroNeural">Spanish (Spain) - Alvaro (Male)</option>
                    <option value="fr-FR-DeniseNeural">French (France) - Denise (Female)</option>
                    <option value="fr-FR-HenriNeural">French (France) - Henri (Male)</option>
                  </select>
                </div>
              ) : ttsEngine === 'neural' ? (
                /* Neural Voices selector */
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-[var(--theme-text-muted)] uppercase tracking-wider font-semibold">AI Voice Profile (OpenAI)</label>
                  <select
                    value={ttsVoice}
                    onChange={(e) => setTtsVoice(e.target.value)}
                    className="w-full bg-[var(--theme-bg-subpanel)] text-[var(--theme-text-primary)] text-xs border border-[var(--theme-border)] rounded-lg px-2.5 py-2 focus:outline-none focus:border-blue-500 cursor-pointer appearance-none shadow-sm"
                  >
                    <option value="alloy">Alloy (Warm, Balanced)</option>
                    <option value="echo">Echo (Crisp, Direct)</option>
                    <option value="fable">Fable (Narrator, Dramatic)</option>
                    <option value="onyx">Onyx (Deep, Professional)</option>
                    <option value="nova">Nova (Energetic, Clear)</option>
                    <option value="shimmer">Shimmer (Professional, Friendly)</option>
                  </select>
                </div>
              ) : ttsEngine === 'gemini' ? (
                /* Gemini Voices selector */
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-[var(--theme-text-muted)] uppercase tracking-wider font-semibold">AI Voice Profile (Gemini 2.5)</label>
                  <select
                    value={ttsVoice}
                    onChange={(e) => setTtsVoice(e.target.value)}
                    className="w-full bg-[var(--theme-bg-subpanel)] text-[var(--theme-text-primary)] text-xs border border-[var(--theme-border)] rounded-lg px-2.5 py-2 focus:outline-none focus:border-blue-500 cursor-pointer appearance-none shadow-sm"
                  >
                    <option value="Aoede">Aoede (Warm, Engaging)</option>
                    <option value="Charon">Charon (Deep, Authoritative)</option>
                    <option value="Fenrir">Fenrir (Dynamic, Energetic)</option>
                    <option value="Kore">Kore (Clear, Professional)</option>
                    <option value="Puck">Puck (Friendly, Expressive)</option>
                  </select>
                </div>
              ) : (
                /* Standard Languages selector */
                <>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] text-[var(--theme-text-muted)] uppercase tracking-wider font-semibold">Voice Language</label>
                    <select
                      value={ttsLanguage}
                      onChange={(e) => setTtsLanguage(e.target.value)}
                      className="w-full bg-[var(--theme-bg-subpanel)] text-[var(--theme-text-primary)] text-xs border border-[var(--theme-border)] rounded-lg px-2.5 py-2 focus:outline-none focus:border-blue-500 cursor-pointer appearance-none shadow-sm"
                    >
                      <option value="en">English (United States)</option>
                      <option value="es">Spanish (Spain)</option>
                      <option value="fr">French (France)</option>
                      <option value="de">German (Germany)</option>
                      <option value="it">Italian (Italy)</option>
                      <option value="ja">Japanese (Japan)</option>
                      <option value="ko">Korean (South Korea)</option>
                      <option value="zh">Chinese (Mandarin)</option>
                      <option value="hi">Hindi (India)</option>
                      <option value="pt">Portuguese (Portugal)</option>
                      <option value="ru">Russian (Russia)</option>
                    </select>
                  </div>

                  {/* Controls Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Speed / Rate */}
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between text-[10px] text-[var(--theme-text-muted)] uppercase tracking-wider font-medium">
                        <span>Speed</span>
                        <span className="font-mono text-[var(--theme-text-primary)] font-bold">{ttsRate}x</span>
                      </div>
                      <input
                        type="range"
                        min="0.5"
                        max="2"
                        step="0.1"
                        value={ttsRate}
                        onChange={(e) => setTtsRate(Number(e.target.value))}
                        className="w-full accent-blue-600"
                      />
                    </div>

                    {/* Pitch */}
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between text-[10px] text-[var(--theme-text-muted)] uppercase tracking-wider font-medium">
                        <span>Pitch</span>
                        <span className="font-mono text-[var(--theme-text-primary)] font-bold">{ttsPitch}</span>
                      </div>
                      <input
                        type="range"
                        min="0.5"
                        max="1.5"
                        step="0.1"
                        value={ttsPitch}
                        onChange={(e) => setTtsPitch(Number(e.target.value))}
                        className="w-full accent-blue-600"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={previewTTS}
                  disabled={!ttsText.trim() || isGeneratingTTS}
                  className="flex-1 py-2 text-xs border border-[var(--theme-border)] hover:border-blue-500 bg-[var(--theme-bg-subpanel)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)] rounded-lg transition-all font-semibold disabled:opacity-30 disabled:pointer-events-none"
                >
                  Preview Speech
                </button>
                <button
                  type="button"
                  onClick={generateTTS}
                  disabled={!ttsText.trim() || isGeneratingTTS}
                  className="flex-1 py-2 text-xs bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-lg shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-1.5 disabled:opacity-30 disabled:pointer-events-none"
                >
                  {isGeneratingTTS ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      Generate & Import
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* AI SFX Generator */}
            <div className="p-3.5 bg-[var(--theme-bg-card)] border border-[var(--theme-border)] rounded-xl space-y-3.5 mt-4 shadow-sm transition-colors">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold text-teal-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Waves className="w-3.5 h-3.5" />
                  AI SFX Generator (HuggingFace)
                </p>
              </div>
              <p className="text-xs text-[var(--theme-text-muted)] leading-relaxed">
                Analyze a 10-second chunk of your timeline starting from the current playhead. The AI will generate custom Sound Effects based on the visuals and transitions.
              </p>
              
              {!sfxAnalysisCues ? (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-[var(--theme-text-muted)] flex justify-between">
                      <span>Vision Model</span>
                    </label>
                    <select
                      value={sfxVisionProvider}
                      onChange={(e) => setSfxVisionProvider(e.target.value as 'gemini' | 'groq')}
                      className="w-full bg-[var(--theme-bg-subpanel)] text-xs text-[var(--theme-text-primary)] border border-[var(--theme-border)] rounded-lg px-3 py-2 outline-none focus:border-teal-500 transition-colors appearance-none shadow-sm"
                    >
                      <option value="gemini">Gemini 3.1 Flash Lite (High Speed)</option>
                      <option value="groq">Groq LLaMA-4 Scout (Reasoning)</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={handleAnalyzeSfx}
                    disabled={isAnalyzingSfx}
                    className="w-full py-2 text-xs bg-teal-500/15 hover:bg-teal-500/25 text-teal-600 dark:text-teal-400 border border-teal-500/30 rounded-lg transition-all font-semibold flex items-center justify-center gap-1.5 disabled:opacity-30 disabled:pointer-events-none"
                  >
                    {isAnalyzingSfx ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Analyzing Timeline...
                      </>
                    ) : (
                      <>
                        <ScanLine className="w-3.5 h-3.5" />
                        Analyze 10s Chunk
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="space-y-3 border-t border-[var(--theme-border)] pt-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-[var(--theme-text-primary)]">Found {sfxAnalysisCues.length} SFX cues</p>
                    <button 
                      onClick={() => {
                        setSfxAnalysisCues(null);
                        setSfxGeneratedCues(null);
                        sfxBlobUrlsRef.current.forEach(u => URL.revokeObjectURL(u));
                        sfxBlobUrlsRef.current = [];
                      }}
                      className="text-[10px] text-red-500 hover:text-red-400 font-medium"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="max-h-32 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                    {sfxAnalysisCues.map((cue, idx) => (
                      <div key={idx} className="bg-[var(--theme-bg-subpanel)] p-2 rounded-lg border border-[var(--theme-border)]">
                        <div className="flex justify-between text-[10px] text-teal-500 mb-1 font-mono font-medium">
                          <span>{cue.start.toFixed(1)}s – {cue.end.toFixed(1)}s</span>
                          <span className="text-[var(--theme-text-muted)]">@{(sfxChunkStartTime + cue.start).toFixed(1)}s</span>
                        </div>
                        <input
                          type="text"
                          value={cue.query}
                          onChange={(e) => {
                            const newCues = [...sfxAnalysisCues];
                            newCues[idx].query = e.target.value;
                            setSfxAnalysisCues(newCues);
                          }}
                          className="w-full bg-transparent text-xs text-white border-b border-[#3e3e3e] focus:border-teal-500 focus:outline-none py-1"
                        />
                        <p className="text-[9px] text-[#6a6a6a] mt-1 italic">{cue.reason}</p>
                      </div>
                    ))}
                  </div>
                  
                  {!sfxGeneratedCues ? (
                    <div className="space-y-3">

                      <button
                        type="button"
                      onClick={handleGenerateSfxBackground}
                      disabled={isGeneratingSfxBackground}
                      className="w-full py-2 text-xs bg-amber-500 hover:bg-amber-600 text-black font-semibold rounded-lg shadow-lg hover:shadow-amber-500/10 transition-all flex flex-col items-center justify-center gap-1 disabled:opacity-50 disabled:pointer-events-none"
                    >
                      {isGeneratingSfxBackground ? (
                        <>
                          <div className="flex items-center gap-1.5">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Generating...</span>
                          </div>
                          <div className="w-3/4 h-1 bg-black/20 rounded-full mt-1 overflow-hidden">
                            <div 
                              className="h-full bg-white transition-all duration-300"
                              style={{ width: `${sfxGenerationProgress}%` }}
                            />
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Generate Audio (Background)</span>
                        </div>
                      )}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowAiSfxModal(true)}
                      className="w-full py-2 text-xs bg-teal-500 hover:bg-teal-600 text-black font-semibold rounded-lg shadow-lg hover:shadow-teal-500/10 transition-all flex items-center justify-center gap-1.5"
                    >
                      <Play className="w-3.5 h-3.5" />
                      Start Preview
                    </button>
                  )}
                </div>
              )}
            </div>
            
          </div>
        )}

        {activeMediaTab === 'text' && (
          <div className="flex-1 overflow-hidden flex flex-col p-2 min-h-0 bg-[var(--theme-bg-panel)] transition-colors">
            {/* Sub-tabs header */}
            <div className="flex border-b border-[var(--theme-border)] shrink-0 mb-3 bg-[var(--theme-bg-subpanel)] rounded-t-lg overflow-hidden">
              <button
                onClick={() => setTextSubTab('text')}
                className={`flex-1 py-2 text-xs font-bold border-b-2 transition-all ${
                  textSubTab === 'text'
                    ? 'text-blue-600 dark:text-blue-400 border-blue-500 bg-[var(--theme-bg-card)]'
                    : 'text-[var(--theme-text-muted)] border-transparent hover:text-[var(--theme-text-primary)] hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                Text Clips
              </button>
              <button
                onClick={() => setTextSubTab('subtitle')}
                className={`flex-1 py-2 text-xs font-bold border-b-2 transition-all ${
                  textSubTab === 'subtitle'
                    ? 'text-blue-600 dark:text-blue-400 border-blue-500 bg-[var(--theme-bg-card)]'
                    : 'text-[var(--theme-text-muted)] border-transparent hover:text-[var(--theme-text-primary)] hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                Subtitles
              </button>
            </div>

            {textSubTab === 'text' ? (() => {
              const textLibraryItems = mediaLibrary.filter(m => m.type === 'text');
              const clips = tracks.flatMap(t => t.clips);
              const unusedTextItems = textLibraryItems.filter(item => !clips.some(c => c.mediaId === item.id));
              
              const timelineTextClips = clips
                .filter(c => c.textSettings !== undefined && c.textSettings !== null)
                .sort((a, b) => a.startTime - b.startTime);

              return (
                <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                  <button
                    onClick={() => {
                      addTextMedia("New Text");
                      toast.success("Created 'New Text' asset! Drag it to timeline or click '+' to add.");
                    }}
                    className="w-full py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all mb-3 shrink-0 shadow-md shadow-blue-500/20"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Text Clip
                  </button>

                  <div className="flex-1 overflow-y-auto space-y-4 scrollbar-thin pr-1 pb-4 min-h-0">
                    {/* Group 1: Text Assets (Not on Timeline) */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-amber-500">Text Library (Not on Timeline)</span>
                        <span className="text-[9px] text-[var(--theme-text-muted)] font-mono font-medium">{unusedTextItems.length} items</span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2">
                        {unusedTextItems.map((item) => (
                          <div
                            key={item.id}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData('application/procut-media', item.id);
                              (window as any).__procutDraggingMediaId = item.id;
                            }}
                            className="p-2.5 bg-[var(--theme-bg-card)] border border-[var(--theme-border)] hover:border-blue-500/50 rounded-xl flex flex-col justify-between h-[82px] cursor-grab active:cursor-grabbing relative group select-none transition-all shadow-sm"
                          >
                            <div className="flex items-center gap-1.5 overflow-hidden">
                              <Type className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                              <span className="text-[10px] text-[var(--theme-text-primary)] font-semibold truncate pr-6">{item.name}</span>
                            </div>
                            <div className="text-[9px] text-[var(--theme-text-muted)] truncate bg-[var(--theme-bg-subpanel)] p-1.5 rounded-md border border-[var(--theme-border)] max-h-[36px] overflow-hidden leading-tight font-mono">
                              {item.textContent || 'Text'}
                            </div>
                            
                            <div className="absolute top-1.5 right-1.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  let targetTrack = tracks.find(t => t.type === 'text');
                                  if (!targetTrack) {
                                    addTrack('text');
                                    const freshTracks = useEditorStore.getState().tracks;
                                    targetTrack = freshTracks.find(t => t.type === 'text');
                                  }
                                  if (targetTrack) {
                                    const clipId = generateId();
                                    let startTime = currentTime;
                                    let attempts = 0;
                                    const maxAttempts = 100;
                                    while (attempts < maxAttempts && targetTrack.clips.some((c) => Math.max(0, Math.min(startTime + 3, c.startTime + c.duration) - Math.max(startTime, c.startTime)) > 0)) {
                                       startTime += 3.1;
                                       attempts++;
                                    }
                                    
                                    addClip({
                                      id: clipId,
                                      mediaId: item.id,
                                      trackId: targetTrack.id,
                                      startTime,
                                      duration: 3,
                                      trimStart: 0,
                                      trimEnd: 0,
                                      transform: { x: 0, y: 140, scale: 100, rotation: 0 },
                                      opacity: 1,
                                      speed: 1,
                                      effects: [],
                                      zIndex: 9999,
                                      textSettings: {
                                        text: item.textContent || 'Text',
                                        fontSize: 26,
                                        fontFamily: 'Inter',
                                        color: '#ffffff',
                                        strokeWidth: 4,
                                        strokeColor: '#000000',
                                        bold: true,
                                        shadow: true,
                                        textAlign: 'center',
                                        backgroundColor: 'transparent',
                                        italic: false,
                                        underline: false
                                      }
                                    });
                                    toast.success("Added text to timeline!");
                                  }
                                }}
                                className="p-1 bg-blue-500/20 text-blue-500 hover:bg-blue-600 hover:text-white rounded-md transition-colors"
                                title="Add to Timeline at Playhead"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeMedia(item.id);
                                }}
                                className="p-1 bg-red-500/20 text-red-500 hover:bg-red-600 hover:text-white rounded-md transition-colors"
                                title="Delete from Library"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                        {unusedTextItems.length === 0 && (
                          <div className="col-span-2 flex flex-col items-center justify-center py-6 text-center text-[var(--theme-text-muted)] border border-[var(--theme-border)] border-dashed rounded-xl bg-[var(--theme-bg-subpanel)]/50">
                            <span className="text-[10px]">No unassigned text assets</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Group 2: Timeline Text Clips (On Timeline) */}
                    <div>
                      <div className="flex items-center justify-between mb-2 border-t border-[var(--theme-border)] pt-3">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-teal-500">Timeline Clips (Sorted by Time)</span>
                        <span className="text-[9px] text-[var(--theme-text-muted)] font-mono font-medium">{timelineTextClips.length} clips</span>
                      </div>

                      <div className="space-y-2">
                        {timelineTextClips.map((c) => {
                          const isActive = currentTime >= c.startTime && currentTime <= (c.startTime + c.duration);
                          return (
                            <div
                              key={c.id}
                              onClick={() => {
                                seek(c.startTime);
                                selectClip(c.id);
                              }}
                              className={`group relative p-2.5 rounded-xl border transition-all cursor-pointer shadow-sm ${
                                isActive ? 'bg-blue-500/10 border-blue-500' : 'bg-[var(--theme-bg-card)] border-[var(--theme-border)] hover:border-blue-500/40'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-1.5 overflow-hidden">
                                  <Type className="w-3.5 h-3.5 text-teal-500 shrink-0" />
                                  <span className="text-[11px] text-[var(--theme-text-primary)] font-semibold truncate pr-8">
                                    {c.textSettings?.text?.trim() || 'Text Clip'}
                                  </span>
                                  {isKineticMediaId(c.mediaId) && !!c.pipWindowIds?.length && (
                                    <span className="text-[8px] uppercase tracking-wider text-purple-600 dark:text-purple-300 font-bold bg-purple-500/15 px-1.5 py-0.5 rounded border border-purple-500/25 shrink-0">
                                      {(pipWindows?.[c.pipWindowIds[0]]?.tracks?.length ?? 0)}w
                                    </span>
                                  )}
                                </div>

                                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 shrink-0">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      rippleDeleteClip(c.id);
                                    }}
                                    className="p-1 bg-rose-500/20 text-rose-400 hover:bg-rose-500 hover:text-white rounded transition-colors"
                                    title="Ripple Delete (Cuts segment & shifts tracks)"
                                  >
                                    <Scissors className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      removeClip(c.id);
                                    }}
                                    className="p-1 bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white rounded transition-colors"
                                    title="Delete from Timeline only"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>

                              <div className="mt-1 flex items-center gap-2">
                                <span className="text-[9px] font-mono text-[#5a5a5a]">
                                  {formatSimpleTime(c.startTime)} - {formatSimpleTime(c.startTime + c.duration)}
                                </span>
                                {isActive && (
                                  <span className="text-[8px] uppercase tracking-wider text-amber-500 font-semibold bg-amber-500/10 px-1 rounded border border-amber-500/20">
                                    Active
                                  </span>
                                )}
                              </div>

                              {/* Per-word PiP layers. These live inside a PiP window rather than
                                  on a main track, so they were invisible in this panel — the user
                                  could see the sentence but not the words it drives. Listing them
                                  here makes the whole kinetic group inspectable, and clicking a
                                  word selects it so its transform box appears on that word alone. */}
                              {isKineticMediaId(c.mediaId) && !!c.pipWindowIds?.length && (() => {
                                const pipWin = pipWindows?.[c.pipWindowIds[0]];
                                const wordTracks = (pipWin?.tracks ?? []).filter(t => t.type === 'text');
                                if (wordTracks.length === 0) return null;
                                return (
                                  <div className="mt-2 pl-2 border-l border-teal-500/20 space-y-1">
                                    {wordTracks.map((wt) => {
                                      const wordClip = wt.clips[0];
                                      if (!wordClip) return null;
                                      const wordText = wordClip.textSettings?.text?.trim() || '—';
                                      const isWordSelected = selectedClipId === wordClip.id;
                                      return (
                                        <div
                                          key={wordClip.id}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            useEditorStore.getState().setActivePipWindow(c.pipWindowIds![0]);
                                            selectClip(wordClip.id);
                                          }}
                                          className={`flex items-center justify-between gap-2 px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                                            isWordSelected
                                              ? 'bg-teal-500/20 text-teal-200'
                                              : 'text-[#9a9a9a] hover:bg-white/5 hover:text-white'
                                          }`}
                                          title={`Select "${wordText}" in the PiP window`}
                                        >
                                          <span className="text-[10px] truncate">{wordText}</span>
                                          <span className="text-[8px] font-mono text-[#5a5a5a] shrink-0">
                                            {formatSimpleTime(wordClip.startTime)}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                );
                              })()}
                            </div>
                          );
                        })}
                        {timelineTextClips.length === 0 && (
                          <div className="flex flex-col items-center justify-center py-6 text-center text-[#555] border border-[#2e2e2e]/40 border-dashed rounded bg-[#1e1e1e]/20">
                            <span className="text-[10px]">No active text clips on timeline</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                </div>
              );
            })() : (
              <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                <div className="flex gap-2 mb-3 shrink-0">
                  <button
                    onClick={() => setShowCaptionLanguageModal(true)}
                    disabled={isGeneratingCaptions}
                    className="flex-1 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 shadow-md shadow-blue-500/20"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {isGeneratingCaptions ? `${captionProgress}%` : 'Auto-Captions'}
                  </button>
                  <button
                    onClick={() => srtInputRef.current?.click()}
                    disabled={importing}
                    className="flex-1 py-2 bg-[var(--theme-bg-subpanel)] hover:bg-black/5 dark:hover:bg-white/5 text-[var(--theme-text-primary)] border border-[var(--theme-border)] rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                  >
                    <Upload className="w-3.5 h-3.5 text-purple-500" />
                    SRT Import
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto flex flex-col gap-2 min-h-0 scrollbar-thin pr-1 pb-4">
                  {subtitles.map((sub: any) => {
                    const isSelected = selectedSubtitleId === sub.id;
                    return (
                      <div
                        key={sub.id}
                        onClick={() => {
                          useEditorStore.setState({ currentTime: sub.startTime });
                          selectSubtitle(sub.id);
                        }}
                        className={`p-3 bg-[var(--theme-bg-card)] border rounded-xl cursor-pointer transition-all flex flex-col gap-2 shadow-sm ${
                          isSelected ? 'border-blue-500 bg-blue-500/10' : 'border-[var(--theme-border)] hover:border-blue-500/40'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[9px] text-[var(--theme-text-muted)] font-mono border-b border-[var(--theme-border)] pb-1.5">
                          <span className="bg-[var(--theme-bg-subpanel)] px-2 py-0.5 rounded-md border border-[var(--theme-border)] text-blue-600 dark:text-blue-400 font-bold">
                            In: {sub.startTime.toFixed(2)}s
                          </span>
                          <span className="bg-[var(--theme-bg-subpanel)] px-2 py-0.5 rounded-md border border-[var(--theme-border)] text-blue-600 dark:text-blue-400 font-bold">
                            Out: {sub.endTime.toFixed(2)}s
                          </span>
                        </div>
                        
                        <div className="space-y-1.5">
                          <div className="text-[11px] text-[var(--theme-text-primary)] leading-relaxed font-semibold">
                            {sub.text}
                          </div>
                          {sub.translations && Object.entries(sub.translations).map(([lang, val]) => {
                            if (lang === 'en') return null;
                            return (
                              <div key={lang} className="text-[10px] text-teal-600 dark:text-teal-400 leading-relaxed flex gap-1.5 items-start bg-teal-500/10 p-1.5 border border-teal-500/20 rounded-md">
                                <span className="text-[8px] uppercase px-1 py-0.2 bg-teal-500/20 rounded border border-teal-500/30 text-teal-600 dark:text-teal-400 shrink-0 font-bold font-mono mt-0.5">
                                  {lang}
                                </span>
                                <span>{val as string}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  
                  {subtitles.length === 0 && (
                    <div className="flex-1 flex flex-col items-center justify-center py-12 text-center text-[var(--theme-text-muted)]">
                      <Globe className="w-8 h-8 mb-2 opacity-30 text-blue-500" />
                      <span className="text-xs font-bold text-[var(--theme-text-primary)]">No Subtitles Generated</span>
                      <span className="text-[10px] mt-1 opacity-70 max-w-[200px] leading-normal">
                        Click "Auto-Captions" or "SRT Import" to create subtitles for your project.
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Language Selection Modal */}
            {showCaptionLanguageModal && (
              <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center backdrop-blur-sm p-4">
                <div className="bg-[var(--theme-bg-panel)] border border-[var(--theme-border)] rounded-2xl shadow-2xl p-5 w-full max-w-[380px] text-[var(--theme-text-primary)] animate-in fade-in zoom-in-95 duration-150">
                  <h3 className="text-sm font-bold text-[var(--theme-text-primary)] mb-2 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-blue-500" />
                    Generate Auto-Captions
                  </h3>
                  <p className="text-[11px] text-[var(--theme-text-muted)] mb-4 leading-normal">
                    Select target transcription languages. The AI will analyze timeline speech and create multi-lingual captions.
                  </p>
                  
                  <div className="space-y-1.5 max-h-[180px] overflow-y-auto mb-5 pr-1 border border-[var(--theme-border)] rounded-xl p-2 bg-[var(--theme-bg-subpanel)] scrollbar-thin">
                    {CAPTION_LANGUAGES.map(lang => (
                      <label key={lang.code} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer transition-colors select-none text-xs">
                        <input 
                          type="checkbox"
                          checked={selectedCaptionLanguages.includes(lang.code)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedCaptionLanguages(prev => [...prev, lang.code]);
                            } else {
                              setSelectedCaptionLanguages(prev => prev.filter(c => c !== lang.code));
                            }
                          }}
                          className="w-3.5 h-3.5 rounded border-[var(--theme-border)] text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-[var(--theme-text-primary)] font-semibold">{lang.name} ({lang.code})</span>
                      </label>
                    ))}
                  </div>

                  <div className="flex justify-end gap-2.5 pt-2 border-t border-[var(--theme-border)]">
                    <button
                      onClick={() => setShowCaptionLanguageModal(false)}
                      className="px-3.5 py-1.5 text-xs text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)] transition-colors font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleGenerateCaptions(selectedCaptionLanguages)}
                      disabled={selectedCaptionLanguages.length === 0}
                      className="px-4 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-blue-500/20 disabled:opacity-50"
                    >
                      Generate
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Templates Tab ── */}
        {activeMediaTab === 'templates' && (() => {
          let filtered = MOTION_TEMPLATES;
          
          if (templateSubTab === 'text') {
            filtered = MOTION_TEMPLATES.filter((t) => t.type === 'text');
            if (templateCategory !== 'all') {
              filtered = filtered.filter((t) => t.category === templateCategory);
            }
          } else if (templateSubTab === 'video') {
            filtered = MOTION_TEMPLATES.filter((t) => t.type === 'video');
            if (templateCategory !== 'all') {
              filtered = filtered.filter((t) => t.category === templateCategory);
            }
          }

          const categories = templateSubTab === 'text'
            ? [
                { id: 'all', label: 'All Text' },
                { id: 'title', label: 'Titles' },
                { id: 'lower-third', label: 'Lower Thirds' },
                { id: 'social', label: 'Social Badges' },
                { id: 'kinetic', label: 'Kinetic Texts' }
              ]
            : [
                { id: 'all', label: 'All Video' },
                { id: 'particle', label: 'Particles' },
                { id: 'color-preset', label: 'Color Presets' },
                { id: 'fx-overlay', label: 'FX Overlays' }
              ];

          return (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Sub-Tab Selector */}
              <div className="flex border-b border-[var(--theme-border)] bg-[var(--theme-bg-subpanel)]">
                <button
                  onClick={() => { setTemplateSubTab('text'); setTemplateCategory('all'); }}
                  className={`flex-1 py-2 text-xs font-bold border-b-2 transition-colors ${
                    templateSubTab === 'text'
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-[var(--theme-bg-card)]'
                      : 'border-transparent text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)] hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  Text Templates
                </button>
                <button
                  onClick={() => { setTemplateSubTab('video'); setTemplateCategory('all'); }}
                  className={`flex-1 py-2 text-xs font-bold border-b-2 transition-colors ${
                    templateSubTab === 'video'
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-[var(--theme-bg-card)]'
                      : 'border-transparent text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)] hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  Video Templates
                </button>
                <button
                  onClick={() => setTemplateSubTab('project')}
                  className={`flex-1 py-2 text-xs font-bold border-b-2 transition-colors ${
                    templateSubTab === 'project'
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-[var(--theme-bg-card)]'
                      : 'border-transparent text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)] hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  Project Layouts
                </button>
              </div>

              {templateSubTab !== 'project' ? (
                <div className="flex-1 overflow-y-auto flex flex-col">
                  {/* Category filter pills */}
                  <div className="flex gap-1.5 p-2 flex-wrap border-b border-[var(--theme-border)] bg-[var(--theme-bg-subpanel)]">
                    {categories.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => setTemplateCategory(cat.id)}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${
                          templateCategory === cat.id
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'bg-[var(--theme-bg-card)] border border-[var(--theme-border)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)]'
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-[var(--theme-text-muted)] px-3 py-1.5 font-semibold uppercase tracking-wider">
                    {templateSubTab === 'text' 
                      ? 'Drag to Text Track / Click to Insert' 
                      : 'Drag to Video Clip / Click to Apply'}
                  </p>
                  <div className="flex flex-col gap-1.5 p-2">
                    {filtered.map((tmpl) => (
                      <TemplatePreviewCard
                        key={tmpl.id}
                        tmpl={tmpl}
                        onDragStart={(e) => {
                          e.dataTransfer.setData('application/procut-template', tmpl.id);
                          e.dataTransfer.effectAllowed = 'copy';
                        }}
                        onClick={() => handleTemplateClick(tmpl)}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto flex flex-col p-2 space-y-3">
                  {/* Action card: Save Timeline */}
                  <button
                    onClick={() => setShowSaveTemplateModal(true)}
                    className="w-full py-3 px-4 rounded-xl border border-dashed border-blue-500/40 hover:border-blue-500 bg-blue-500/5 hover:bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm"
                  >
                    <span>Save Current Timeline as Template</span>
                  </button>

                  <div className="flex flex-col gap-2">
                    {projectTemplates.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-center text-[var(--theme-text-muted)]">
                        <p className="text-xs font-semibold text-[var(--theme-text-primary)]">No Project Templates saved yet</p>
                        <p className="text-[10px] mt-1">Configure your tracks and clips, then click save above to reuse it.</p>
                      </div>
                    ) : (
                      projectTemplates.map((tmpl) => {
                        const dateStr = new Date(tmpl.createdAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        });

                        return (
                          <div
                            key={tmpl.id}
                            className="flex flex-col p-3 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg-card)] hover:border-blue-500/30 transition-all group shadow-sm"
                          >
                            <div className="flex justify-between items-start gap-2">
                              <div className="min-w-0">
                                <h4 className="text-xs text-[var(--theme-text-primary)] font-bold truncate">{tmpl.name}</h4>
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
            </div>
          );
        })()}

        {activeMediaTab === 'transitions' && (
          <div className="flex-1 overflow-y-auto p-2 space-y-4">
            {/* Auto Beat Sync Tool Card */}
            <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/30 rounded-xl p-3.5 space-y-3 shadow-sm transition-colors">
              <div className="flex items-center gap-2 text-indigo-500">
                <Sparkles className="w-4 h-4 text-indigo-500 animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-wider">🤖 Auto Beat Sync</span>
              </div>
              <p className="text-[10px] text-[var(--theme-text-muted)] leading-tight">
                Automatically align video cuts & apply professional transitions synchronized to your audio track's beat markers.
              </p>

              <div className="space-y-2">
                {/* Audio Clip Selection */}
                <div>
                  <label className="text-[9px] uppercase tracking-wider text-[var(--theme-text-muted)] font-semibold block mb-1">Select Audio Track (Beats Source)</label>
                  <select
                    value={syncAudioClip}
                    onChange={(e) => setSyncAudioClip(e.target.value)}
                    className="w-full bg-[var(--theme-bg-subpanel)] border border-[var(--theme-border)] text-xs text-[var(--theme-text-primary)] rounded-lg p-2 focus:outline-none focus:border-indigo-500 shadow-sm"
                  >
                    <option value="">Select audio...</option>
                    {tracks.flatMap(t => t.clips)
                      .filter(c => c.mediaId?.startsWith('clip_') || c.mediaId?.includes('audio') || c.audioSettings) 
                      .map(c => {
                        const mediaName = mediaLibrary.find(m => m.id === c.mediaId)?.name;
                        return (
                          <option key={c.id} value={c.id}>
                            🎵 {mediaName || c.id}
                          </option>
                        );
                      })
                    }
                  </select>
                </div>

                {/* Target Video Track Selection */}
                <div>
                  <label className="text-[9px] uppercase tracking-wider text-[var(--theme-text-muted)] font-semibold block mb-1">Select Video Track to Sync</label>
                  <select
                    value={syncTargetTrack}
                    onChange={(e) => setSyncTargetTrack(e.target.value)}
                    className="w-full bg-[var(--theme-bg-subpanel)] border border-[var(--theme-border)] text-xs text-[var(--theme-text-primary)] rounded-lg p-2 focus:outline-none focus:border-indigo-500 shadow-sm"
                  >
                    <option value="">Select video track...</option>
                    {tracks.filter(t => t.type === 'video').map(t => (
                      <option key={t.id} value={t.id}>
                        📺 {t.name || `Track ${t.id}`}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {/* Every N Beats */}
                  <div>
                    <label className="text-[9px] uppercase tracking-wider text-[var(--theme-text-muted)] font-semibold block mb-1">Interval (Beats)</label>
                    <select
                      value={syncEveryNBeats}
                      onChange={(e) => setSyncEveryNBeats(Number(e.target.value))}
                      className="w-full bg-[var(--theme-bg-subpanel)] border border-[var(--theme-border)] text-xs text-[var(--theme-text-primary)] rounded-lg p-2 focus:outline-none focus:border-indigo-500 shadow-sm"
                    >
                      <option value="1">Every Beat (1)</option>
                      <option value="2">2 Beats</option>
                      <option value="4">4 Beats (1 Bar)</option>
                      <option value="8">8 Beats (2 Bars)</option>
                    </select>
                  </div>

                  {/* Transition Type */}
                  <div>
                    <label className="text-[9px] uppercase tracking-wider text-[var(--theme-text-muted)] font-semibold block mb-1">Transition</label>
                    <select
                      value={syncTransitionType}
                      onChange={(e) => setSyncTransitionType(e.target.value)}
                      className="w-full bg-[var(--theme-bg-subpanel)] border border-[var(--theme-border)] text-xs text-[var(--theme-text-primary)] rounded-lg p-2 focus:outline-none focus:border-indigo-500 shadow-sm"
                    >
                      <option value="">None (Hard Cuts)</option>
                      <option value="dissolve">Cross Dissolve</option>
                      <option value="shake">Camera Shake</option>
                      <option value="flash">Flash Cut</option>
                      <option value="zoomRush">Zoom Rush</option>
                      <option value="glitch">RGB Glitch</option>
                      <option value="lightLeak">Light Leak</option>
                      <option value="whipPan">Whip Pan</option>
                      <option value="pixelate">Pixelate</option>
                      <option value="mirror">Kaleidoscope</option>
                    </select>
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  if (!syncTargetTrack || !syncAudioClip) {
                    toast.error('Please select both an Audio clip and a Video track!');
                    return;
                  }
                  setIsSyncing(true);
                  setTimeout(() => {
                    autoSyncTrackToBeats(syncTargetTrack, syncAudioClip, syncEveryNBeats, syncTransitionType || undefined);
                    setIsSyncing(false);
                  }, 600);
                }}
                disabled={isSyncing || !syncTargetTrack || !syncAudioClip}
                className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-40 text-xs font-bold text-white rounded-lg transition-all shadow-md shadow-indigo-500/20 active:scale-[0.98] flex items-center justify-center gap-1.5"
              >
                {isSyncing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Syncing Cuts...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    Auto Beat Sync!
                  </>
                )}
              </button>
            </div>

            <div className="h-px bg-[var(--theme-border)]" />

            <p className="text-xs text-[var(--theme-text-muted)] mb-1 font-medium">Drag transitions between clips on timeline (Hover to preview)</p>
            <div className="grid grid-cols-2 gap-2">
              {TRANSITIONS.map((transition) => (
                <TransitionCard key={transition.name} transition={transition} />
              ))}
            </div>
          </div>
        )}

        {activeMediaTab === 'effects' && (() => {
          const Section = ({ id, label, color, children }: { id: 'fx'|'color'|'particles'; label: string; color: string; children: React.ReactNode }) => (
            <div>
              <button
                onClick={() => setOpenSection(prev => prev === id ? 'fx' : id)}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors mb-1`}
              >
                <span className={`text-[10px] font-bold uppercase tracking-wider ${color}`}>{label}</span>
                {openSection === id
                  ? <ChevronDown className="w-3 h-3 text-[var(--theme-text-muted)]" />
                  : <ChevronRight className="w-3 h-3 text-[var(--theme-text-muted)]" />}
              </button>
              {openSection === id && <div className="mb-3">{children}</div>}
            </div>
          );

          return (
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {/* ── Timeline FX ── */}
              <Section id="fx" label="Timeline FX" color="text-rose-500">
                <p className="text-[9px] text-[var(--theme-text-muted)] px-1 mb-1.5 font-medium">Add FX Track first, then drag here</p>
                <div className="grid grid-cols-1 gap-1">
                  {FX_EFFECTS.map((effect) => {
                    const Icon = effect.icon;
                    return (
                      <div
                        key={effect.name}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('application/procut-effect', effect.name);
                          e.dataTransfer.effectAllowed = 'copy';
                        }}
                        onClick={() => handleEffectClick(effect)}
                        onMouseEnter={() => setHoveredItem(effect.name)}
                        onMouseLeave={() => setHoveredItem(null)}
                        className="flex items-center gap-2.5 px-2.5 py-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl border border-transparent hover:border-[var(--theme-border)] cursor-pointer transition-colors group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
                          <Icon className={`w-4 h-4 ${effect.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-xs text-[var(--theme-text-primary)] font-semibold block leading-tight">{effect.name}</span>
                          <span className="text-[9px] text-[var(--theme-text-muted)]">{effect.desc}</span>
                        </div>
                        <span className="text-[8px] text-rose-500/70 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity font-bold font-mono">FX</span>
                      </div>
                    );
                  })}
                </div>
              </Section>

              <div className="h-px bg-[var(--theme-border)]" />

              {/* ── Color Presets ── */}
              <Section id="color" label="Color Presets" color="text-amber-500">
                <p className="text-[9px] text-[var(--theme-text-muted)] px-1 mb-1.5 font-medium">Drag onto a video / image clip</p>
                <div className="grid grid-cols-1 gap-1">
                  {COLOR_CORRECTION_EFFECTS.map((effect) => {
                    const Icon = effect.icon;
                    return (
                      <div
                        key={effect.name}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('application/procut-color-preset', JSON.stringify(effect.preset));
                          e.dataTransfer.setData('application/procut-effect', effect.name);
                          e.dataTransfer.effectAllowed = 'copy';
                        }}
                        onClick={() => handleColorPresetClick(effect)}
                        onMouseEnter={() => setHoveredItem(effect.name)}
                        onMouseLeave={() => setHoveredItem(null)}
                        className="flex items-center gap-2.5 px-2.5 py-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl border border-transparent hover:border-[var(--theme-border)] cursor-pointer transition-colors group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                          <Icon className={`w-4 h-4 ${effect.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-xs text-[var(--theme-text-primary)] font-semibold block leading-tight">{effect.name}</span>
                          <span className="text-[9px] text-[var(--theme-text-muted)]">{effect.desc}</span>
                        </div>
                        <span className="text-[8px] text-amber-500/70 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity font-bold font-mono">CC</span>
                      </div>
                    );
                  })}
                </div>
              </Section>

              <div className="h-px bg-[var(--theme-border)]" />

              {/* ── Particle Effects ── */}
              <Section id="particles" label="✦ Particle Effects" color="text-violet-500">
                <p className="text-[9px] text-[var(--theme-text-muted)] px-1 mb-1.5 font-medium">Drag onto any video/image clip — click emitter on preview to reposition</p>
                <div className="grid grid-cols-1 gap-1">
                  {PARTICLE_EFFECTS.map((effect) => {
                    const Icon = effect.icon;
                    return (
                      <div
                        key={effect.name}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('application/procut-particle', effect.type);
                          e.dataTransfer.effectAllowed = 'copy';
                        }}
                        onClick={() => handleParticleClick(effect)}
                        onMouseEnter={() => setHoveredItem(effect.name)}
                        onMouseLeave={() => setHoveredItem(null)}
                        className="flex items-center gap-2.5 px-2.5 py-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl border border-transparent hover:border-[var(--theme-border)] cursor-pointer transition-colors group"
                      >
                        <div className={`w-8 h-8 rounded-lg ${effect.bgColor} border flex items-center justify-center shrink-0 shadow-sm`}>
                          <Icon className={`w-4 h-4 ${effect.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-xs text-[var(--theme-text-primary)] font-semibold block leading-tight">{effect.name}</span>
                          <span className="text-[9px] text-[var(--theme-text-muted)]">{effect.desc}</span>
                        </div>
                        <span className="text-[8px] text-violet-500/70 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity font-bold font-mono">✦</span>
                      </div>
                    );
                  })}
                </div>
              </Section>
            </div>
          );
        })()}

      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="video/*,audio/*,image/*,.cube"
        onChange={handleImport}
        className="hidden"
      />
      <input
        ref={lutInputRef}
        type="file"
        multiple
        accept=".cube"
        onChange={handleLutImport}
        className="hidden"
      />
      <input
        ref={relinkInputRef}
        type="file"
        multiple
        accept="video/*,audio/*,image/*"
        onChange={handleRelinkFiles}
        className="hidden"
      />
      <input
        ref={srtInputRef}
        type="file"
        accept=".srt"
        onChange={handleSrtImport}
        className="hidden"
      />

      {/* Save Template Modal */}
      {showSaveTemplateModal && (
        <div className="fixed inset-0 bg-black/60 z-[120] flex items-center justify-center backdrop-blur-sm p-4">
          <div className="bg-[var(--theme-bg-panel)] border border-[var(--theme-border)] rounded-2xl p-5 w-80 space-y-4 shadow-2xl text-[var(--theme-text-primary)] animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-[var(--theme-text-primary)] uppercase tracking-wider">Save Project Template</h4>
              <button
                onClick={() => setShowSaveTemplateModal(false)}
                className="p-1 rounded-md text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="space-y-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-[var(--theme-text-muted)] uppercase tracking-wider font-semibold">Template Name</label>
                <input
                  type="text"
                  placeholder="e.g. My Vlog Layout"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  className="bg-[var(--theme-bg-subpanel)] border border-[var(--theme-border)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--theme-text-primary)] placeholder-[var(--theme-text-muted)]/50 focus:outline-none focus:border-blue-500 shadow-sm"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-[var(--theme-text-muted)] uppercase tracking-wider font-semibold">Description</label>
                <textarea
                  placeholder="What is this template for?"
                  value={templateDesc}
                  rows={2}
                  onChange={(e) => setTemplateDesc(e.target.value)}
                  className="bg-[var(--theme-bg-subpanel)] border border-[var(--theme-border)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--theme-text-primary)] placeholder-[var(--theme-text-muted)]/50 focus:outline-none focus:border-blue-500 resize-none shadow-sm"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={async () => {
                  if (!templateName.trim()) return;
                  await saveProjectAsTemplate(templateName, templateDesc);
                  setTemplateName('');
                  setTemplateDesc('');
                  setShowSaveTemplateModal(false);
                }}
                disabled={!templateName.trim()}
                className="flex-1 py-2 text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 rounded-lg transition-all shadow-md shadow-blue-500/20"
              >
                Save Template
              </button>
              <button
                onClick={() => setShowSaveTemplateModal(false)}
                className="flex-1 py-2 text-xs font-semibold text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)] bg-[var(--theme-bg-subpanel)] hover:bg-black/5 dark:hover:bg-white/5 border border-[var(--theme-border)] rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Load Template Confirmation Modal */}
      {confirmLoadTemplateId && (
        <div className="fixed inset-0 bg-black/60 z-[120] flex items-center justify-center">
          <div className="bg-[#2d2d2d] border border-red-500/20 rounded-lg p-5 w-80 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 text-amber-500">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h4 className="text-xs font-semibold uppercase tracking-wider">Overwrite Timeline?</h4>
            </div>

            <p className="text-xs text-[#a0a0a0] leading-relaxed">
              Loading this template will **completely overwrite** your current timeline tracks and layout. This action can be undone.
            </p>

            <div className="flex gap-2 pt-1">
              <button
                onClick={async () => {
                  await loadProjectTemplate(confirmLoadTemplateId);
                  setConfirmLoadTemplateId(null);
                }}
                className="flex-1 py-1.5 text-xs font-medium text-white bg-amber-500 hover:bg-amber-600 rounded transition-colors"
              >
                Load Template
              </button>
              <button
                onClick={() => setConfirmLoadTemplateId(null)}
                className="flex-1 py-1.5 text-xs font-medium text-[#a0a0a0] hover:text-white bg-[#3e3e3e] hover:bg-[#4d4d4d] rounded transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Video Generator Modal */}
      {showAIGeneratorModal && (
        <React.Suspense fallback={null}>
          <AIGeneratorModal onClose={() => setShowAIGeneratorModal(false)} />
        </React.Suspense>
      )}

      {/* Auto Video Generator Modal */}
      {showAutoVideoModal && (
        <React.Suspense fallback={null}>
          <AutoVideoModal onClose={() => setShowAutoVideoModal(false)} />
        </React.Suspense>
      )}

      {/* AI SFX Designer Modal */}
      {showAiSfxModal && sfxGeneratedCues && (
        <React.Suspense fallback={null}>
          <AiSoundDesigner
            onClose={() => setShowAiSfxModal(false)}
            mode="generate"
            clip={{
              duration: useEditorStore.getState().totalDuration || 10,
              trimStart: 0,
              startTime: sfxChunkStartTime,
              mediaId: null
            }}
            cues={sfxGeneratedCues}
          />
        </React.Suspense>
      )}
    </div>
  );
}

export const TransitionCard = React.memo(function TransitionCard({ transition, onClick, isMobile }: TransitionCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isVisible, setIsVisible] = useState(!isMobile);
  const active = isMobile ? isVisible : isHovered;
  const animationRef = useRef<number | null>(null);
  
  useEffect(() => {
    if (!isMobile || !canvasRef.current) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) setIsVisible(true);
      else setIsVisible(false);
    }, { threshold: 0.1 });
    observer.observe(canvasRef.current);
    return () => observer.disconnect();
  }, [isMobile]);

  // FIX H8: keep latest transition so the rAF closure doesn't go stale
  // when the parent re-renders with a new transition object.
  const transitionRef = useRef(transition);
  useEffect(() => { transitionRef.current = transition; }, [transition]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;

    // Preload transition demo images
    const imgA = new window.Image();
    imgA.src = demoA;
    const imgB = new window.Image();
    imgB.src = demoB;

    let start: number | null = null;
    const duration = 1500; // 1.5s loop duration

    const draw = (t: number) => {
      ctx.clearRect(0, 0, W, H);
      const nameLower = transitionRef.current.name.toLowerCase();

      const drawImageCover = (img: HTMLImageElement, opacity: number, scaleMultiplier: number = 1, tx: number = 0, ty: number = 0) => {
        if (!img.complete || img.naturalWidth === 0) {
          ctx.fillStyle = img === imgA ? '#ef4444' : '#3b82f6';
          ctx.globalAlpha = opacity;
          ctx.fillRect(0, 0, W, H);
          ctx.globalAlpha = 1.0;
          return;
        }
        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.translate(W / 2 + tx, H / 2 + ty);
        ctx.scale(scaleMultiplier, scaleMultiplier);

        const iw = img.naturalWidth;
        const ih = img.naturalHeight;
        const scale = Math.max(W / iw, H / ih);
        const dw = iw * scale;
        const dh = ih * scale;

        ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
        ctx.restore();
      };

      if (nameLower.includes('dissolve')) {
        drawImageCover(imgA, 1 - t);
        drawImageCover(imgB, t);
      } else if (nameLower.includes('fade')) {
        if (t < 0.5) {
          drawImageCover(imgA, 1 - t * 2);
        } else {
          drawImageCover(imgB, (t - 0.5) * 2);
        }
      } else if (nameLower.includes('wipe')) {
        if (nameLower.includes('left')) {
          drawImageCover(imgA, 1);
          ctx.save();
          ctx.beginPath();
          ctx.rect(W * (1 - t), 0, W * t, H);
          ctx.clip();
          drawImageCover(imgB, 1);
          ctx.restore();
        } else {
          drawImageCover(imgA, 1);
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, 0, W * t, H);
          ctx.clip();
          drawImageCover(imgB, 1);
          ctx.restore();
        }
      } else if (nameLower.includes('slide')) {
        if (nameLower.includes('up')) {
          drawImageCover(imgA, 1, 1, 0, -H * t);
          drawImageCover(imgB, 1, 1, 0, H * (1 - t));
        } else if (nameLower.includes('down')) {
          drawImageCover(imgA, 1, 1, 0, H * t);
          drawImageCover(imgB, 1, 1, 0, -H * (1 - t));
        } else {
          drawImageCover(imgA, 1, 1, -W * t, 0);
          drawImageCover(imgB, 1, 1, W * (1 - t), 0);
        }
      } else if (nameLower.includes('zoom')) {
        if (nameLower.includes('out')) {
          drawImageCover(imgB, 1);
          drawImageCover(imgA, 1 - t, 1 - t);
        } else {
          drawImageCover(imgA, 1 - t);
          drawImageCover(imgB, t, t);
        }
      } else if (nameLower.includes('shake')) {
        const intensity = 10;
        const seed = Math.floor(t * 60);
        const rng = (s: number) => {
          const x = Math.sin(s * 12.9898 + 78.233) * 43758.5453123;
          return x - Math.floor(x);
        };
        const offsetX = (rng(seed) - 0.5) * intensity * (1 - t);
        const offsetY = (rng(seed + 1) - 0.5) * intensity * (1 - t);
        const rot = (rng(seed + 2) - 0.5) * 5 * (1 - t);

        ctx.save();
        ctx.translate(W / 2 + offsetX, H / 2 + offsetY);
        ctx.rotate((rot * Math.PI) / 180);
        ctx.translate(-W / 2, -H / 2);
        drawImageCover(imgA, 1);
        if (t > 0.7) {
          ctx.globalAlpha = (t - 0.7) / 0.3;
          drawImageCover(imgB, 1);
        }
        ctx.restore();
      } else if (nameLower.includes('flash')) {
        const flashIntensity = Math.sin(t * Math.PI);
        drawImageCover(imgA, 1);
        if (flashIntensity > 0.1) {
          ctx.save();
          ctx.fillStyle = '#FFFFFF';
          ctx.globalAlpha = flashIntensity;
          ctx.fillRect(0, 0, W, H);
          ctx.restore();
        }
        if (t > 0.5) {
          ctx.save();
          ctx.globalAlpha = Math.min(1, (t - 0.5) * 4);
          drawImageCover(imgB, 1);
          ctx.restore();
        }
      } else if (nameLower.includes('zoom rush')) {
        const ease = t === 0 ? 0 : t === 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2;
        if (t < 0.8) {
          ctx.save();
          ctx.globalAlpha = 1 - ease;
          drawImageCover(imgA, 1, 1 + ease * 1.5);
          ctx.restore();
        }
        if (t > 0.2) {
          ctx.save();
          ctx.globalAlpha = ease;
          drawImageCover(imgB, 1, 2 - ease * 1.5);
          ctx.restore();
        }
      } else if (nameLower.includes('glitch')) {
        const slices = 12;
        const rng = (s: number) => {
          const x = Math.sin(s * 12.9898 + 78.233) * 43758.5453123;
          return x - Math.floor(x);
        };
        
        ctx.save();
        for (let i = 0; i < slices; i++) {
          const sy = (H / slices) * i;
          const sliceH = H / slices;
          const seed = i + Math.floor(t * 30);
          const offsetX = (rng(seed) - 0.5) * 20 * (1 - t);
          const rgbOffset = 5 * (1 - t);

          ctx.globalCompositeOperation = 'screen';
          drawImageCover(imgA, 1, 1, offsetX - rgbOffset, sy);
          drawImageCover(imgA, 1, 1, offsetX, sy);
          drawImageCover(imgA, 1, 1, offsetX + rgbOffset, sy);
        }
        ctx.restore();

        if (t > 0.6) {
          ctx.save();
          ctx.globalAlpha = (t - 0.6) / 0.4;
          drawImageCover(imgB, 1);
          ctx.restore();
        }
      } else if (nameLower.includes('light leak')) {
        drawImageCover(imgA, 1);
        ctx.save();
        const gradient = ctx.createRadialGradient(W * 0.8, -H * 0.2, 0, W * 0.8, -H * 0.2, W * 1.2);
        const alpha = Math.sin(t * Math.PI) * 0.6;
        gradient.addColorStop(0, `rgba(255, 107, 53, ${alpha})`);
        gradient.addColorStop(0.5, `rgba(255, 107, 53, ${alpha * 0.5})`);
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.globalCompositeOperation = 'screen';
        ctx.fillRect(0, 0, W, H);
        ctx.restore();

        if (t > 0.5) {
          ctx.save();
          ctx.globalAlpha = (t - 0.5) * 2;
          drawImageCover(imgB, 1);
          ctx.restore();
        }
      } else if (nameLower.includes('whip pan')) {
        const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        const fromOffset = ease * W;
        
        ctx.save();
        drawImageCover(imgA, 1, 1, fromOffset, 0);
        ctx.restore();

        if (t > 0.1) {
          const toX = -W + W * ease;
          ctx.save();
          drawImageCover(imgB, 1, 1, toX, 0);
          ctx.restore();
        }
      } else if (nameLower.includes('pixelate')) {
        const pixelSize = Math.floor(1 + Math.sin(t * Math.PI) * 15);
        if (pixelSize <= 1) {
          drawImageCover(imgA, 1);
        } else {
          const offWidth = Math.ceil(W / pixelSize);
          const offHeight = Math.ceil(H / pixelSize);
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = offWidth;
          tempCanvas.height = offHeight;
          const tempCtx = tempCanvas.getContext('2d')!;
          
          tempCtx.save();
          tempCtx.scale(offWidth / W, offHeight / H);
          if (imgA.complete && imgA.naturalWidth > 0) {
            const scale = Math.max(W / imgA.naturalWidth, H / imgA.naturalHeight);
            const dw = imgA.naturalWidth * scale;
            const dh = imgA.naturalHeight * scale;
            tempCtx.drawImage(imgA, (W - dw)/2, (H - dh)/2, dw, dh);
          }
          tempCtx.restore();

          ctx.save();
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(tempCanvas, 0, 0, W, H);
          ctx.imageSmoothingEnabled = true;
          ctx.restore();
        }

        if (t > 0.5) {
          ctx.save();
          ctx.globalAlpha = (t - 0.5) * 2;
          drawImageCover(imgB, 1);
          ctx.restore();
        }
      } else if (nameLower.includes('kaleidoscope')) {
        const segments = 4;
        
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = W;
        tempCanvas.height = H;
        const tempCtx = tempCanvas.getContext('2d')!;
        if (imgA.complete && imgA.naturalWidth > 0) {
          const scale = Math.max(W / imgA.naturalWidth, H / imgA.naturalHeight);
          const dw = imgA.naturalWidth * scale;
          const dh = imgA.naturalHeight * scale;
          tempCtx.drawImage(imgA, (W - dw)/2, (H - dh)/2, dw, dh);
        }

        ctx.save();
        ctx.translate(W / 2, H / 2);
        for (let i = 0; i < segments; i++) {
          ctx.save();
          ctx.rotate((i * Math.PI * 2) / segments);
          const scale = 1 + Math.sin(t * Math.PI) * 0.2;
          ctx.scale(scale, scale);
          
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.arc(0, 0, Math.max(W, H), -Math.PI / segments, Math.PI / segments);
          ctx.closePath();
          ctx.clip();
          ctx.drawImage(tempCanvas, -W / 2, -H / 2, W, H);
          ctx.restore();
        }
        ctx.restore();

        if (t > 0.5) {
          ctx.save();
          ctx.globalAlpha = (t - 0.5) * 2;
          drawImageCover(imgB, 1);
          ctx.restore();
        }
      } else {
        drawImageCover(imgA, 1 - t);
        drawImageCover(imgB, t);
      }
    };

    const animate = (timestamp: number) => {
      if (!start) start = timestamp;
      const elapsed = timestamp - start;
      const progress = (elapsed % duration) / duration;
      draw(progress);
      if (active) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    if (active) {
      animationRef.current = requestAnimationFrame(animate);
    } else {
      draw(0);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [active, transition]);

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('application/procut-transition', transition.name);
        e.dataTransfer.effectAllowed = 'copy';
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
        onClick={onClick}
      className="flex flex-col bg-[#1a1a1a] border border-[#3e3e3e] hover:border-purple-500 rounded overflow-hidden cursor-grab transition-all duration-150 relative group"
    >
      <div className="w-full aspect-video bg-black relative">
        <canvas
          ref={canvasRef}
          width={160}
          height={90}
          className="w-full h-full object-cover"
        />
        {!active && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center pointer-events-none transition-opacity group-hover:opacity-0">
            <Sparkles className="w-5 h-5 text-purple-400/80 animate-pulse" />
          </div>
        )}
      </div>
      <div className="p-1.5 flex flex-col min-w-0 bg-[#252525]">
        <span className="text-[10px] text-white font-medium truncate block">
          {transition.name}
        </span>
        <span className="text-[8px] text-[#a0a0a0] truncate">
          {transition.preview}
        </span>
      </div>
    </div>
  );
});

  
