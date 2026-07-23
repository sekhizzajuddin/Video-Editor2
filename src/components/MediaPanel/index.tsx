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
} from 'lucide-react';
import React, { useState, useRef, useCallback, useEffect, Fragment, useMemo } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { useShallow } from 'zustand/react/shallow';
import type { MediaTab, MediaType, MediaItem } from '@/types';
import { probeFile } from '@/utils/mediaProbe';
import { saveFileToDB } from '@/utils/projectPersistence';
import { parseSRT } from '@/utils/srtParser';
import demoA from '../../assets/transition_demo_a.webp';
import demoB from '../../assets/transition_demo_b.webp';
import { toast } from 'sonner';
import { parseCubeLut } from '@/utils/lutParser';
import { detectBeats } from '@/utils/beatDetection';
import { MOTION_TEMPLATES, MotionTemplate } from '@/utils/motionTemplates';
import { captureCanvasChunk } from '@/utils/canvasCapture';
import { analyzeCanvasChunkWithGemini } from '@/utils/aiClient';
import { generateCombinedSfx } from '@/utils/elevenLabsClient';
import { AiSoundDesigner } from '../AiSoundDesigner';
import { AIGeneratorModal } from '../AIGeneratorModal';
// Timeline FX — dragged to FX tracks. type field maps to PreviewCanvas fxType.
// Color Correction — dragged to a video/image clip to apply that preset
// Particle Effects — dragged to a video/image/FX clip
import { TEXT_TEMPLATES } from '@/utils/textTemplates';
import { TRANSITIONS, FX_EFFECTS, COLOR_CORRECTION_EFFECTS, PARTICLE_EFFECTS } from "@/constants/mediaPanel";
import { TemplatePreviewCardProps, TransitionCardProps } from "@/types/mediaPanel";
import { formatDuration, formatSimpleTime, formatSize, getMediaColor, getMediaIcon } from "@/utils/mediaHelpers";
import { useMediaImport } from "@/hooks/media/useMediaImport";
import { useTTS } from "@/hooks/media/useTTS";
import { useAudioFeatures } from "@/hooks/media/useAudioFeatures";

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
    const { ttsText, setTtsText, ttsLanguage, setTtsLanguage, ttsRate, setTtsRate, ttsPitch, setTtsPitch, ttsEngine, setTtsEngine, ttsVoice, setTtsVoice, isGeneratingTTS, ttsAudioRef, previewTTS, generateTTS } = useTTS();
    const { isDragging, isUploading: importing, fileInputRef, handleDragOver, handleDragLeave, handleDrop, handleFileSelect } = useMediaImport();
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
    currentTime,
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
    currentTime: s.currentTime,
    seek: s.seek,
    aiVideoIsGenerating: s.aiVideoIsGenerating,
    aiVideoProgress: s.aiVideoProgress,
  })));

  const [syncTargetTrack, setSyncTargetTrack] = useState('');
  const [syncAudioClip, setSyncAudioClip] = useState('');
  const [syncEveryNBeats, setSyncEveryNBeats] = useState(4);
  const [syncTransitionType, setSyncTransitionType] = useState('dissolve');
  const [isSyncing, setIsSyncing] = useState(false);

  // Click-to-apply fallback handlers
  const handleTemplateClick = (tmpl: any) => {
    if (tmpl.type === 'video') {
      const { selectedClipId, currentTime } = useEditorStore.getState();
      let targetClip = tracks.flatMap(t => t.clips).find(c => c.id === selectedClipId);
      
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

    const FX_TYPE_MAP: Record<string, string> = {
      'VFX Breakdown':     'vfx_breakdown',
      'B&W to Color':      'bw_to_color',
      'Glitch':            'glitch',
      'Old Film':          'old_film',
      'VHS':               'vhs',
      'Cinematic Bars':    'cinematic_bars',
      'Neon Glow':         'neon_glow',
      'RGB Split':         'rgb_split',
      'Pixelate':          'pixelate',
      'Mirror':            'mirror',
      'Zoom Blur':         'zoom_blur',
      'Lens Flare':        'lens_flare',
      'Night Vision':      'night_vision',
      'Thermal':           'thermal',
    };
    const fxType = FX_TYPE_MAP[effect.name] ?? effect.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
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
  const [isGeneratingKineticTypo, setIsGeneratingKineticTypo] = useState(false);
  const [kineticTypoProgress, setKineticTypoProgress] = useState(0);
  const [showKineticTypoModal, setShowKineticTypoModal] = useState(false);
  const [kineticTypoScript, setKineticTypoScript] = useState('english');
  const [englishCasing, setEnglishCasing] = useState<'all_caps' | 'first_letter_caps' | 'none'>('none');
  const [kineticTypoStyle, setKineticTypoStyle] = useState<string>('random');
  const [kineticTypoAnimation, setKineticTypoAnimation] = useState<string>('random');
  const [kineticTypoProvider, setKineticTypoProvider] = useState<'gemini' | 'groq'>('groq');

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

  const handleGenerateKineticTypography = async () => {
    const { selectedClipId, tracks } = useEditorStore.getState();
    let targetClip = tracks.flatMap(t => t.clips).find(c => c.id === selectedClipId);
    
    if (!targetClip) {
      const { currentTime } = useEditorStore.getState();
      const videoTrack = tracks.find(t => t.type === 'video');
      if (videoTrack) {
        targetClip = videoTrack.clips.find(c => currentTime >= c.startTime && currentTime <= c.startTime + c.duration);
      }
    }
    
    if (!targetClip) {
      toast.error('Please select a video or audio clip on the timeline first.');
      return;
    }
    
    setIsGeneratingKineticTypo(true);
    setKineticTypoProgress(0);
    setShowKineticTypoModal(false);
    
    try {
      const { generateKineticTypography } = await import('@/utils/kineticTypography');
      await generateKineticTypography(
        targetClip,
        targetClip.trackId,
        {
          script: kineticTypoScript,
          englishCasing,
          casing: englishCasing,
          styleSelection: kineticTypoStyle,
          animationSelection: kineticTypoAnimation,
          provider: kineticTypoProvider
        },
        (p) => setKineticTypoProgress(p)
      );
      toast.success("Kinetic Typography Generated!");
    } catch (e: any) {
      console.error(e);
      toast.error(`Kinetic Typography failed: ${e.message || e}`);
    } finally {
      setIsGeneratingKineticTypo(false);
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

  const tabs: { id: MediaTab; label: string; icon: typeof Film }[] = [
    { id: 'project', label: 'Project', icon: Folder },
    { id: 'text', label: 'Text', icon: Type },
    { id: 'audio', label: 'Audio', icon: Music },
    { id: 'templates', label: 'Templates', icon: Clapperboard },
    { id: 'transitions', label: 'Transitions', icon: Sparkles },
    { id: 'effects', label: 'Effects', icon: Waves },
  ];

  const filteredMedia = useMemo(() => mediaLibrary.filter((m) =>
    m.type !== 'text' && m.type !== 'fx' &&
    m.name.toLowerCase().includes(searchQuery.toLowerCase())
  ), [mediaLibrary, searchQuery]);

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
        alert("Failed to parse SRT or file is empty.");
        return;
      }

      const store = useEditorStore.getState();
      store.importSubtitles(parsed);
      store.recalcTotalDuration?.(); // If it exists
      alert(`Imported ${parsed.length} subtitles onto a new 'Subtitles' track!`);
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
      className="h-full flex flex-col bg-[#252525] border-r border-[#3e3e3e]"
      onDragOver={handleZoneDragOver}
      onDragLeave={handleZoneDragLeave}
      onDrop={handleZoneDrop}
    >
      {/* Tabs */}
      <div className="flex overflow-x-auto border-b border-[#3e3e3e] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] px-1 bg-[#1a1a1a]/50">
        {tabs.map((tab, idx) => {
          const Icon = tab.icon;
          const isActive = activeMediaTab === tab.id;
          return (
            <Fragment key={tab.id}>
              {idx > 0 && <div className="w-px h-5 bg-[#3e3e3e] self-center shrink-0 mx-1" />}
              <button
                onClick={() => setActiveMediaTab(tab.id)}
                className={`flex-1 py-2.5 px-3 text-[10px] font-medium uppercase tracking-wider flex flex-col items-center gap-1 transition-colors ${
                  isActive
                    ? 'text-white border-b-2 border-amber-500 bg-[#2d2d2d]'
                    : 'text-[#a0a0a0] hover:text-white hover:bg-[#2d2d2d]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            </Fragment>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col relative">
        {/* Drag-drop overlay */}
        {isDragOver && (
          <div className="absolute inset-0 z-50 bg-amber-500/10 border-2 border-dashed border-amber-500 flex items-center justify-center rounded">
            <div className="text-center">
              <Upload className="w-8 h-8 text-amber-400 mx-auto mb-2" />
              <p className="text-sm text-amber-300 font-medium">Drop files to import</p>
              <p className="text-xs text-amber-400/60 mt-1">Video, Audio, or Image files</p>
            </div>
          </div>
        )}

        {/* Import progress */}
        {importing && (
          <div className="px-3 py-2 bg-amber-500/10 border-b border-amber-500/20 space-y-1.5 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 overflow-hidden">
                <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin shrink-0" />
                <span className="text-[10px] text-amber-300 truncate font-medium">{importProgress}</span>
              </div>
              <span className="text-[10px] text-amber-400 font-mono shrink-0">{Math.round(importProgressPct)}%</span>
            </div>
            <div className="w-full h-1 bg-amber-950 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${importProgressPct}%` }}
              />
            </div>
          </div>
        )}

        {activeMediaTab === 'project' && (
          <>
            {/* Search & View Controls */}
            <div className="p-2 border-b border-[#3e3e3e]">
              <div className="relative mb-2">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#a0a0a0]" />
                <label htmlFor="media-search" className="sr-only">Search media</label>
                <input
                  id="media-search"
                  type="text"
                  placeholder="Search media..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-[#1e1e1e] border border-[#3e3e3e] rounded text-xs text-white placeholder-[#a0a0a0] focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[#a0a0a0]">
                    {filteredMedia.length} items
                  </span>
                </div>
                <div className="flex bg-[#1e1e1e] rounded border border-[#3e3e3e]">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-1 rounded transition-colors ${
                      viewMode === 'grid' ? 'bg-[#3e3e3e] text-white' : 'text-[#a0a0a0] hover:text-white'
                    }`}
                  >
                    <Grid3X3 className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-1 rounded transition-colors ${
                      viewMode === 'list' ? 'bg-[#3e3e3e] text-white' : 'text-[#a0a0a0] hover:text-white'
                    }`}
                  >
                    <List className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>

            {/* Media List */}
            <div className="flex-1 overflow-y-auto">
              {/* Import Buttons */}
              <div className="p-2 flex gap-1.5">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importing}
                  className="flex-1 py-2 border-2 border-dashed border-[#3e3e3e] rounded text-[#a0a0a0] hover:text-white hover:border-amber-500 text-xs flex items-center justify-center gap-1 transition-colors disabled:opacity-50"
                  title="Import Video, Audio, or Image files"
                >
                  {importing ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Upload className="w-3 h-3" />
                  )}
                  {importing ? 'Importing...' : 'Import Media'}
                </button>
                <button
                  onClick={() => srtInputRef.current?.click()}
                  disabled={importing}
                  className="flex-1 py-2 border-2 border-dashed border-[#3e3e3e] rounded text-[#a0a0a0] hover:text-white hover:border-purple-500 text-xs flex items-center justify-center gap-1 transition-colors disabled:opacity-50"
                  title="Import Subtitles (.srt file)"
                >
                  <Type className="w-3 h-3 text-purple-400" />
                  Import Subtitles
                </button>
              </div>
              <div className="flex px-2 mt-2 gap-2">
                <button
                  onClick={isRecordingScreen ? stopScreenRecord : startScreenRecord}
                  disabled={importing}
                  className={`flex-1 py-2 border-2 ${isRecordingScreen ? 'border-red-500 bg-red-500/10 text-red-400' : 'border-dashed border-[#3e3e3e] text-[#a0a0a0] hover:text-white hover:border-red-500'} rounded text-xs flex items-center justify-center gap-1 transition-colors disabled:opacity-50`}
                  title="Record Screen"
                >
                  {isRecordingScreen ? <Square className="w-3 h-3 text-red-400" /> : <Monitor className="w-3 h-3 text-red-400" />}
                  {isRecordingScreen ? 'Stop' : 'Record'}
                </button>
                <button
                  onClick={() => setShowAIGeneratorModal(true)}
                  disabled={importing}
                  className="relative flex-1 py-2 bg-gradient-to-r from-amber-600/20 to-amber-500/20 hover:from-amber-600/40 hover:to-amber-500/40 border-2 border-dashed border-amber-500/50 hover:border-amber-500 text-amber-500 hover:text-amber-400 rounded text-xs flex items-center justify-center gap-1 transition-all disabled:opacity-50 overflow-hidden"
                  title="AI Generation"
                >
                  {aiVideoIsGenerating && (
                    <div 
                      className="absolute left-0 top-0 bottom-0 bg-amber-500/20 transition-all duration-300 ease-out z-0"
                      style={{ width: `${aiVideoProgress}%` }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-1">
                    {aiVideoIsGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    {aiVideoIsGenerating ? `${Math.round(aiVideoProgress)}%` : 'AI Gen'}
                  </span>
                </button>
              </div>

              {/* Missing files warning banner */}
              {(() => {
                const missing = mediaLibrary.filter(
                  (m) => m.type !== 'text' && m.type !== 'fx' && (m.url === 'PENDING_RESTORE' || !m.url)
                );
                if (missing.length > 0) {
                  return (
                    <div className="mx-2 mb-2 p-3 bg-red-950/40 border border-red-500/30 rounded flex flex-col gap-2">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-semibold text-red-200">
                            {missing.length} Missing files in project
                          </p>
                          <p className="text-[10px] text-red-300/80 leading-normal mt-0.5">
                            Some local media files are not linked to this browser session. Please re-link them.
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => relinkInputRef.current?.click()}
                        className="w-full py-1 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-200 text-xs font-medium rounded transition-colors"
                      >
                        Re-link Files
                      </button>
                    </div>
                  );
                }
                return null;
              })()}

              {previewItem && (
                <div className="mx-2 mb-2 p-2 bg-[#252525] border border-[#3e3e3e] rounded flex flex-col gap-2 relative">
                  <div className="relative aspect-video bg-black flex items-center justify-center rounded overflow-hidden">
                    {previewItem.type === 'video' && previewItem.url && previewItem.url !== 'PENDING_RESTORE' && (
                      <video
                        key={previewItem.id}
                        src={previewItem.url}
                        controls
                        className="w-full h-full object-contain"
                        autoPlay={false}
                      />
                    )}
                    {previewItem.type === 'audio' && previewItem.url && previewItem.url !== 'PENDING_RESTORE' && (
                      <div className="p-3 w-full flex flex-col items-center justify-center">
                        <Music className="w-8 h-8 text-emerald-400 mb-2" />
                        <audio src={previewItem.url} controls className="w-full h-8" />
                      </div>
                    )}
                    {previewItem.type === 'image' && previewItem.url && previewItem.url !== 'PENDING_RESTORE' && (
                      <img src={previewItem.url} className="w-full h-full object-contain" alt="" />
                    )}
                    <button
                      onClick={() => setPreviewItem(null)}
                      className="absolute top-1.5 right-1.5 p-1 bg-black/60 hover:bg-black/80 rounded-full text-white/70 hover:text-white transition-colors"
                      title="Close Preview"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="px-1 py-0.5 text-[10px] text-[#a0a0a0] truncate font-medium flex justify-between items-center">
                    <span className="truncate flex-1 pr-2">{previewItem.name}</span>
                    <span className="shrink-0">{formatDuration(previewItem.duration)}</span>
                  </div>
                </div>
              )}

              {filteredMedia.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-[#a0a0a0]">
                  <Film className="w-10 h-10 mb-3 opacity-20" />
                  <p className="text-xs font-medium">No media yet</p>
                  <p className="text-[10px] mt-1.5 text-center px-4">
                    Import video, audio, or image files<br />
                    or drag & drop them here
                  </p>
                </div>
              ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-2 gap-1.5 p-2">
                  {filteredMedia.map((media) => (
                    <div
                      key={media.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, media.id)}
                      onMouseEnter={() => setHoveredItem(media.id)}
                      onMouseLeave={() => setHoveredItem(null)}
                      onClick={() => setPreviewItem(media)}
                      className={`${getMediaColor(media.type)} border rounded overflow-hidden cursor-grab hover:brightness-110 transition-all group relative`}
                    >
                      {/* Thumbnail */}
                      <div className="h-16 relative bg-black/20">
                        {renderMediaThumbnail(media)}

                        {/* Play overlay for video */}
                        {media.type === 'video' && (
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="w-7 h-7 bg-black/60 rounded-full flex items-center justify-center backdrop-blur-sm">
                              <Play className="w-3.5 h-3.5 text-white ml-0.5" fill="white" />
                            </div>
                          </div>
                        )}

                        {/* Delete button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteId(media.id);
                          }}
                          className="absolute top-0.5 right-0.5 p-0.5 bg-black/60 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/80 transition-all"
                        >
                          <X className="w-2.5 h-2.5 text-white" />
                        </button>

                        {/* Type badge */}
                        <div className="absolute bottom-0.5 left-0.5 px-1 py-0.5 bg-black/60 rounded text-[7px] text-white/70 uppercase font-medium">
                          {media.type}
                        </div>
                      </div>

                      {/* Info */}
                      <div className="p-1.5">
                        <p className="text-[10px] text-white truncate">{media.name}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <p className="text-[9px] text-[#a0a0a0]">{formatDuration(media.duration)}</p>
                          {media.width && media.height && (
                            <p className="text-[9px] text-[#a0a0a0]">· {media.width}×{media.height}</p>
                          )}
                        </div>

                        {/* Audio waveform mini preview */}
                        {media.type === 'audio' && renderWaveformPreview(media)}
                      </div>

                      {/* Delete confirmation */}
                      {confirmDeleteId === media.id && (
                        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-1.5 z-20 rounded">
                          <p className="text-[9px] text-white">Delete?</p>
                          <div className="flex gap-1">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDelete(media.id); }}
                              className="px-2 py-0.5 bg-red-500 hover:bg-red-400 text-white text-[9px] rounded transition-colors"
                            >
                              Delete
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }}
                              className="px-2 py-0.5 bg-[#3e3e3e] hover:bg-[#5e5e5e] text-white text-[9px] rounded transition-colors"
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
                <div className="flex flex-col">
                  {filteredMedia.map((media) => (
                    <div
                      key={media.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, media.id)}
                      onMouseEnter={() => setHoveredItem(media.id)}
                      onMouseLeave={() => setHoveredItem(null)}
                      onClick={() => setPreviewItem(media)}
                      className="flex items-center gap-2 p-2 hover:bg-[#3e3e3e] cursor-grab border-b border-[#3e3e3e] transition-colors group"
                    >
                      {/* Thumbnail in list view */}
                      <div className="w-10 h-7 rounded overflow-hidden bg-black/30 shrink-0 flex items-center justify-center">
                        {media.thumbnail ? (
                          <img src={media.thumbnail} alt="" className="w-full h-full object-cover" draggable={false} />
                        ) : (
                          getMediaIcon(media.type)
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-white truncate">{media.name}</p>
                        <p className="text-[9px] text-[#a0a0a0]">
                          {formatDuration(media.duration)} · {formatSize(media.size)}
                          {media.width && media.height ? ` · ${media.width}×${media.height}` : ''}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {media.type === 'video' && <Play className="w-3 h-3 text-[#a0a0a0]" />}
                        {(media.type === 'audio' || media.type === 'video') && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDetectBeats(media); }}
                            title="Detect Beats"
                            disabled={detectingBeatId === media.id}
                            className="p-0.5 text-[#a0a0a0] hover:text-yellow-400 rounded transition-colors disabled:opacity-50"
                          >
                            {detectingBeatId === media.id
                              ? <Loader2 className="w-3 h-3 animate-spin" />
                              : <Waves className="w-3 h-3" />
                            }
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteId(media.id);
                          }}
                          className="p-0.5 text-[#a0a0a0] hover:text-red-400 rounded transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>


                      {/* Delete confirmation overlay for list */}
                      {confirmDeleteId === media.id && (
                        <div className="absolute right-2 flex items-center gap-1 bg-[#2d2d2d] border border-[#3e3e3e] rounded px-2 py-1 shadow-lg z-20">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(media.id); }}
                            className="px-2 py-0.5 bg-red-500 hover:bg-red-400 text-white text-[9px] rounded transition-colors"
                          >
                            Delete
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }}
                            className="px-2 py-0.5 bg-[#3e3e3e] hover:bg-[#5e5e5e] text-white text-[9px] rounded transition-colors"
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
          </>
        )}



        {activeMediaTab === 'audio' && (
          <div className="flex-1 overflow-y-auto p-3 space-y-4 scrollbar-thin">
            {/* Timeline Voiceover Info */}
            <div className="p-3 bg-[#1e1e1e]/40 border border-[#3e3e3e] rounded-lg">
              <p className="text-[10px] font-semibold text-rose-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 animate-pulse" />
                Voiceover Recorder
              </p>
              <p className="text-xs text-[#a0a0a0] leading-relaxed">
                Click the microphone icon <Mic className="w-3 h-3 inline text-red-500 mx-0.5" /> in any audio track header to record live narration directly onto the timeline at the playhead position.
              </p>
            </div>

            {/* AI Text-to-Speech Generator */}
            <div className="p-3 bg-[#1e1e1e]/60 border border-[#3e3e3e] rounded-lg space-y-3.5">
              <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                AI Text-to-Speech (TTS)
              </p>

              {/* Textarea */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-[#8a8a8a] uppercase tracking-wider font-medium">Script / Speech Text</label>
                <textarea
                  value={ttsText}
                  onChange={(e) => setTtsText(e.target.value)}
                  placeholder="Type or paste the speech script here..."
                  maxLength={200}
                  className="w-full h-24 bg-[#141414] text-white text-xs border border-[#3e3e3e] rounded-lg p-2.5 resize-none focus:outline-none focus:border-amber-500 placeholder-[#5a5a5a] scrollbar-thin"
                />
                <div className="flex justify-end">
                  <span className="text-[9px] text-[#6a6a6a] font-mono">{ttsText.length}/200 chars</span>
                </div>
              </div>

              {/* Engine Toggle */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-[#8a8a8a] uppercase tracking-wider font-medium">TTS Voice Quality</label>
                <div className="flex flex-col gap-1 bg-[#141414] p-1 border border-[#3e3e3e] rounded-lg">
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setTtsEngine('gemini');
                        setTtsVoice('Aoede');
                      }}
                      className={`flex-1 py-1.5 text-[10px] rounded transition-all font-semibold ${
                        ttsEngine === 'gemini'
                          ? 'bg-amber-500 text-black font-bold shadow'
                          : 'text-[#a0a0a0] hover:text-white'
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
                      className={`flex-1 py-1.5 text-[10px] rounded transition-all font-semibold ${
                        ttsEngine === 'edge'
                          ? 'bg-[#3e3e3e] text-white font-bold shadow'
                          : 'text-[#a0a0a0] hover:text-white'
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
                      className={`flex-1 py-1.5 text-[10px] rounded transition-all font-semibold ${
                        ttsEngine === 'neural'
                          ? 'bg-[#3e3e3e] text-white font-bold shadow'
                          : 'text-[#a0a0a0] hover:text-white'
                      }`}
                    >
                      🔥 Cloud
                    </button>
                    <button
                      type="button"
                      onClick={() => setTtsEngine('standard')}
                      className={`flex-1 py-1.5 text-[10px] rounded transition-all font-semibold ${
                        ttsEngine === 'standard'
                          ? 'bg-[#3e3e3e] text-white font-bold shadow'
                          : 'text-[#a0a0a0] hover:text-white'
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
                  <label className="text-[10px] text-[#8a8a8a] uppercase tracking-wider font-medium">AI Voice Profile (Microsoft Edge)</label>
                  <select
                    value={ttsVoice}
                    onChange={(e) => setTtsVoice(e.target.value)}
                    className="w-full bg-[#141414] text-white text-xs border border-[#3e3e3e] rounded-lg px-2.5 py-2 focus:outline-none focus:border-amber-500 cursor-pointer"
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
                  <label className="text-[10px] text-[#8a8a8a] uppercase tracking-wider font-medium">AI Voice Profile (OpenAI)</label>
                  <select
                    value={ttsVoice}
                    onChange={(e) => setTtsVoice(e.target.value)}
                    className="w-full bg-[#141414] text-white text-xs border border-[#3e3e3e] rounded-lg px-2.5 py-2 focus:outline-none focus:border-amber-500 cursor-pointer appearance-none"
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
                  <label className="text-[10px] text-[#8a8a8a] uppercase tracking-wider font-medium">AI Voice Profile (Gemini 2.5)</label>
                  <select
                    value={ttsVoice}
                    onChange={(e) => setTtsVoice(e.target.value)}
                    className="w-full bg-[#141414] text-white text-xs border border-[#3e3e3e] rounded-lg px-2.5 py-2 focus:outline-none focus:border-amber-500 cursor-pointer appearance-none"
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
                    <label className="text-[10px] text-[#8a8a8a] uppercase tracking-wider font-medium">Voice Language</label>
                    <select
                      value={ttsLanguage}
                      onChange={(e) => setTtsLanguage(e.target.value)}
                      className="w-full bg-[#141414] text-white text-xs border border-[#3e3e3e] rounded-lg px-2.5 py-2 focus:outline-none focus:border-amber-500 cursor-pointer appearance-none"
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
                      <div className="flex justify-between text-[10px] text-[#8a8a8a] uppercase tracking-wider">
                        <span>Speed</span>
                        <span className="font-mono text-white">{ttsRate}x</span>
                      </div>
                      <input
                        type="range"
                        min="0.5"
                        max="2"
                        step="0.1"
                        value={ttsRate}
                        onChange={(e) => setTtsRate(Number(e.target.value))}
                        className="w-full accent-amber-500"
                      />
                    </div>

                    {/* Pitch */}
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between text-[10px] text-[#8a8a8a] uppercase tracking-wider">
                        <span>Pitch</span>
                        <span className="font-mono text-white">{ttsPitch}</span>
                      </div>
                      <input
                        type="range"
                        min="0.5"
                        max="1.5"
                        step="0.1"
                        value={ttsPitch}
                        onChange={(e) => setTtsPitch(Number(e.target.value))}
                        className="w-full accent-amber-500"
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
                  className="flex-1 py-2 text-xs border border-[#4e4e4e] hover:border-white text-[#a0a0a0] hover:text-white rounded-lg transition-all font-medium disabled:opacity-30 disabled:pointer-events-none"
                >
                  Preview Speech
                </button>
                <button
                  type="button"
                  onClick={generateTTS}
                  disabled={!ttsText.trim() || isGeneratingTTS}
                  className="flex-1 py-2 text-xs bg-amber-500 hover:bg-amber-600 text-black font-semibold rounded-lg shadow-lg hover:shadow-amber-500/10 transition-all flex items-center justify-center gap-1.5 disabled:opacity-30 disabled:pointer-events-none"
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
            <div className="p-3 bg-[#1e1e1e]/60 border border-[#3e3e3e] rounded-lg space-y-3.5 mt-4">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold text-teal-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Waves className="w-3.5 h-3.5" />
                  AI SFX Generator (HuggingFace)
                </p>
              </div>
              <p className="text-xs text-[#a0a0a0] leading-relaxed">
                Analyze a 10-second chunk of your timeline starting from the current playhead. The AI will generate custom Sound Effects based on the visuals and transitions.
              </p>
              
              {!sfxAnalysisCues ? (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-medium text-[#a0a0a0] flex justify-between">
                      <span>Vision Model</span>
                    </label>
                    <select
                      value={sfxVisionProvider}
                      onChange={(e) => setSfxVisionProvider(e.target.value as 'gemini' | 'groq')}
                      className="w-full bg-[#141414] text-xs text-white border border-[#3e3e3e] rounded-lg px-3 py-2 outline-none focus:border-teal-500 transition-colors appearance-none"
                    >
                      <option value="gemini">Gemini 3.1 Flash Lite (High Speed)</option>
                      <option value="groq">Groq LLaMA-4 Scout (Reasoning)</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={handleAnalyzeSfx}
                    disabled={isAnalyzingSfx}
                    className="w-full py-2 text-xs bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 border border-teal-500/30 rounded-lg transition-all flex items-center justify-center gap-1.5 disabled:opacity-30 disabled:pointer-events-none"
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
                <div className="space-y-3 border-t border-[#3e3e3e] pt-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-white">Found {sfxAnalysisCues.length} SFX cues</p>
                    <button 
                      onClick={() => {
                        setSfxAnalysisCues(null);
                        setSfxGeneratedCues(null);
                        sfxBlobUrlsRef.current.forEach(u => URL.revokeObjectURL(u));
                        sfxBlobUrlsRef.current = [];
                      }}
                      className="text-[10px] text-red-400 hover:text-red-300"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="max-h-32 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                    {sfxAnalysisCues.map((cue, idx) => (
                      <div key={idx} className="bg-[#141414] p-2 rounded border border-[#3e3e3e]">
                        <div className="flex justify-between text-[10px] text-teal-400 mb-1 font-mono">
                          <span>{cue.start.toFixed(1)}s – {cue.end.toFixed(1)}s</span>
                          <span className="text-[#6a6a6a]">@{(sfxChunkStartTime + cue.start).toFixed(1)}s</span>
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
          <div className="flex-1 overflow-hidden flex flex-col p-2 min-h-0 bg-[#1e1e1e]/20">
            {/* Sub-tabs header */}
            <div className="flex border-b border-[#3e3e3e] shrink-0 mb-3 bg-[#1e1e1e]/40 rounded-t overflow-hidden">
              <button
                onClick={() => setTextSubTab('text')}
                className={`flex-1 py-2 text-xs font-semibold border-b-2 transition-all ${
                  textSubTab === 'text'
                    ? 'text-white border-amber-500 bg-[#2d2d2d]/30'
                    : 'text-[#a0a0a0] border-transparent hover:text-white hover:bg-[#2d2d2d]/10'
                }`}
              >
                Text Clips
              </button>
              <button
                onClick={() => setTextSubTab('subtitle')}
                className={`flex-1 py-2 text-xs font-semibold border-b-2 transition-all ${
                  textSubTab === 'subtitle'
                    ? 'text-white border-amber-500 bg-[#2d2d2d]/30'
                    : 'text-[#a0a0a0] border-transparent hover:text-white hover:bg-[#2d2d2d]/10'
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
                      const txt = prompt("Enter text content:", "New Text");
                      if (txt) {
                        addTextMedia(txt);
                        toast.success("Text asset created! Drag it to timeline or click '+' to add.");
                      }
                    }}
                    className="w-full py-2 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors mb-3 shrink-0 shadow"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Text Clip
                  </button>

                  <div className="flex-1 overflow-y-auto space-y-4 scrollbar-thin pr-1 pb-4 min-h-0">
                    {/* Group 1: Text Assets (Not on Timeline) */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-amber-500">Text Library (Not on Timeline)</span>
                        <span className="text-[9px] text-[#666] font-mono">{unusedTextItems.length} items</span>
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
                            className="p-2.5 bg-[#252525] border border-[#383838] hover:border-amber-500/50 rounded flex flex-col justify-between h-[82px] cursor-grab active:cursor-grabbing relative group select-none transition-all shadow-sm"
                          >
                            <div className="flex items-center gap-1.5 overflow-hidden">
                              <Type className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                              <span className="text-[10px] text-white font-medium truncate pr-6">{item.name}</span>
                            </div>
                            <div className="text-[9px] text-[#a0a0a0] truncate bg-[#161616] p-1 rounded border border-[#2e2e2e] max-h-[36px] overflow-hidden leading-tight font-mono">
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
                                className="p-0.5 bg-amber-500/20 text-amber-400 hover:bg-amber-500 hover:text-white rounded transition-colors"
                                title="Add to Timeline at Playhead"
                              >
                                <Plus className="w-2.5 h-2.5" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeMedia(item.id);
                                }}
                                className="p-0.5 bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white rounded transition-colors"
                                title="Delete from Library"
                              >
                                <Trash2 className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                        {unusedTextItems.length === 0 && (
                          <div className="col-span-2 flex flex-col items-center justify-center py-6 text-center text-[#555] border border-[#2e2e2e]/40 border-dashed rounded bg-[#1e1e1e]/20">
                            <span className="text-[10px]">No unassigned text assets</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Group 2: Timeline Text Clips (On Timeline) */}
                    <div>
                      <div className="flex items-center justify-between mb-2 border-t border-[#3e3e3e]/40 pt-3">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-teal-400">Timeline Clips (Sorted by Time)</span>
                        <span className="text-[9px] text-[#666] font-mono">{timelineTextClips.length} clips</span>
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
                              className={`group relative p-2.5 rounded border transition-all cursor-pointer ${
                                isActive ? 'bg-amber-500/10 border-amber-500/50' : 'bg-[#1b1b1b] border-[#2c2c2c] hover:border-[#444]'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-1.5 overflow-hidden">
                                  <Type className="w-3.5 h-3.5 text-teal-500 shrink-0" />
                                  <span className="text-[11px] text-[#d0d0d0] font-medium truncate pr-8">
                                    {c.textSettings?.text || 'Text Clip'}
                                  </span>
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

                  {/* Kinetic Typography Trigger Section */}
                  <div className="mt-2 p-3 bg-[#172323] border border-teal-500/20 rounded flex flex-col gap-2 shrink-0">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-teal-400 animate-pulse" />
                      <span className="text-xs font-semibold text-teal-300">Kinetic Typography AI</span>
                    </div>
                    <p className="text-[10px] text-teal-400/80 leading-relaxed">
                      Automatically transcribe and animate any timeline clip word-by-word with premium style matching. Select a clip to start.
                    </p>
                    {isGeneratingKineticTypo ? (
                      <div className="flex items-center justify-between py-1.5 px-3 bg-[#111a1a] border border-teal-500/20 rounded mt-1">
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-3.5 h-3.5 text-teal-400 animate-spin" />
                          <span className="text-[10px] text-teal-300">Generating kinetic words...</span>
                        </div>
                        <span className="text-xs font-bold text-teal-400 font-mono">{kineticTypoProgress.toFixed(0)}%</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowKineticTypoModal(true)}
                        className="w-full py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded text-[11px] font-semibold transition-colors mt-1 flex items-center justify-center gap-1.5 shadow"
                      >
                        <Sparkles className="w-3 h-3" /> Generate Kinetic Typography
                      </button>
                    )}
                  </div>
                </div>
              );
            })() : (
              <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                <div className="flex gap-2 mb-3 shrink-0">
                  <button
                    onClick={() => setShowCaptionLanguageModal(true)}
                    disabled={isGeneratingCaptions}
                    className="flex-1 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 shadow"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {isGeneratingCaptions ? `${captionProgress}%` : 'Auto-Captions'}
                  </button>
                  <button
                    onClick={() => srtInputRef.current?.click()}
                    disabled={importing}
                    className="flex-1 py-2 bg-[#2d2d2d] hover:bg-[#3e3e3e] text-white border border-[#3e3e3e] rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <Upload className="w-3.5 h-3.5 text-purple-400" />
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
                        className={`p-3 bg-[#252525] border rounded cursor-pointer transition-all flex flex-col gap-2 hover:border-[#4e4e4e] shadow-sm ${
                          isSelected ? 'border-amber-500 bg-[#2d271a]' : 'border-[#3e3e3e]'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[9px] text-[#a0a0a0] font-mono border-b border-[#303030] pb-1.5">
                          <span className="bg-[#1e1e1e] px-1.5 py-0.5 rounded border border-[#2e2e2e] text-amber-400 font-semibold">
                            In: {sub.startTime.toFixed(2)}s
                          </span>
                          <span className="bg-[#1e1e1e] px-1.5 py-0.5 rounded border border-[#2e2e2e] text-amber-400 font-semibold">
                            Out: {sub.endTime.toFixed(2)}s
                          </span>
                        </div>
                        
                        <div className="space-y-1.5">
                          <div className="text-[11px] text-white leading-relaxed font-semibold">
                            {sub.text}
                          </div>
                          {sub.translations && Object.entries(sub.translations).map(([lang, val]) => {
                            if (lang === 'en') return null;
                            return (
                              <div key={lang} className="text-[10px] text-teal-400 leading-relaxed flex gap-1 items-start bg-[#1c2323]/40 p-1.5 border border-teal-500/10 rounded">
                                <span className="text-[8px] uppercase px-1 py-0.2 bg-teal-500/10 rounded border border-teal-500/20 text-teal-400 shrink-0 font-bold font-mono mt-0.5">
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
                    <div className="flex-1 flex flex-col items-center justify-center py-12 text-center text-[#6a6a6a]">
                      <Globe className="w-8 h-8 mb-2 opacity-30 text-amber-500" />
                      <span className="text-xs font-semibold">No Subtitles Generated</span>
                      <span className="text-[10px] mt-1 opacity-60 max-w-[200px] leading-normal">
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
                <div className="bg-[#1e1e1e] border border-[#3e3e3e] rounded-lg shadow-xl p-5 w-full max-w-[380px]">
                  <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    Generate Auto-Captions
                  </h3>
                  <p className="text-[11px] text-[#a0a0a0] mb-4 leading-normal">
                    Select target transcription languages. The AI will analyze timeline speech and create multi-lingual captions.
                  </p>
                  
                  <div className="space-y-1.5 max-h-[180px] overflow-y-auto mb-5 pr-1 border border-[#2d2d2d] rounded p-2 bg-[#151515] scrollbar-thin">
                    {CAPTION_LANGUAGES.map(lang => (
                      <label key={lang.code} className="flex items-center gap-2.5 p-2 rounded hover:bg-[#252525] cursor-pointer transition-colors select-none text-xs">
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
                          className="w-3.5 h-3.5 rounded border-[#3e3e3e] bg-[#2a2a2a] text-amber-500 focus:ring-amber-500 focus:ring-offset-[#1e1e1e]"
                        />
                        <span className="text-white font-medium">{lang.name} ({lang.code})</span>
                      </label>
                    ))}
                  </div>

                  <div className="flex justify-end gap-2.5 pt-2 border-t border-[#2d2d2d]">
                    <button
                      onClick={() => setShowCaptionLanguageModal(false)}
                      className="px-3.5 py-1.5 text-xs text-[#a0a0a0] hover:text-white transition-colors font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleGenerateCaptions(selectedCaptionLanguages)}
                      disabled={selectedCaptionLanguages.length === 0}
                      className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-semibold transition-colors disabled:opacity-50"
                    >
                      Generate
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Kinetic Typography Customization Modal */}
            {showKineticTypoModal && (
              <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center backdrop-blur-sm p-4 animate-fadeIn">
                <div className="bg-[#1e1e1e] border border-[#3e3e3e] rounded-lg shadow-xl p-5 w-full max-w-[380px]">
                  <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-teal-400" />
                    Kinetic Typography Config
                  </h3>
                  <p className="text-[11px] text-[#a0a0a0] mb-4 leading-normal">
                    Generate highly stylized, word-by-word visual animations synced with speech.
                  </p>
                  
                  <div className="space-y-4 mb-5">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] text-[#a0a0a0] uppercase font-bold tracking-wider">Select Script / Language</label>
                      <select
                        value={kineticTypoScript}
                        onChange={(e) => setKineticTypoScript(e.target.value)}
                        className="bg-[#151515] text-white text-xs border border-[#3e3e3e] rounded p-2 focus:outline-none focus:border-teal-500 w-full"
                      >
                        <option value="english">English Script</option>
                        <option value="roman_urdu_hindi">Roman Urdu/Hindi (English text)</option>
                        <option value="hindi">Devanagari Hindi Script (हिंदी)</option>
                        <option value="spanish">Spanish</option>
                        <option value="french">French</option>
                        <option value="german">German</option>
                      </select>
                    </div>
                    
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] text-[#a0a0a0] uppercase font-bold tracking-wider flex justify-between items-center">
                        AI Reasoning Provider
                        {kineticTypoProvider === 'groq' && <span className="px-1.5 py-0.5 rounded text-[8px] bg-purple-500/20 text-purple-400 font-bold border border-purple-500/30">LLaMA 3.3 (Text)</span>}
                        {kineticTypoProvider === 'gemini' && <span className="px-1.5 py-0.5 rounded text-[8px] bg-blue-500/20 text-blue-400 font-bold border border-blue-500/30">Flash 2.0 (Vision)</span>}
                      </label>
                      <select
                        value={kineticTypoProvider}
                        onChange={(e) => setKineticTypoProvider(e.target.value as 'gemini'|'groq')}
                        className="bg-[#151515] text-white text-xs border border-[#3e3e3e] rounded p-2 focus:outline-none focus:border-teal-500 w-full"
                      >
                        <option value="groq">Groq (Faster, Advanced NLP & Timing)</option>
                        <option value="gemini">Gemini (Analyzes Scene Video Frames)</option>
                      </select>
                    </div>

                    {(kineticTypoScript === 'english' || kineticTypoScript === 'roman_urdu_hindi') && (
                      <div className="space-y-2 border-t border-[#2d2d2d] pt-3">
                        <label className="text-[10px] text-[#a0a0a0] uppercase font-bold tracking-wider block">Casing Constraints</label>
                        <div className="grid grid-cols-2 gap-2">
                          <label className="flex items-center gap-2 p-2 bg-[#151515] border border-[#2d2d2d] rounded cursor-pointer text-xs select-none">
                            <input
                              type="checkbox"
                              checked={englishCasing === 'all_caps'}
                              onChange={(e) => setEnglishCasing(e.target.checked ? 'all_caps' : 'none')}
                              className="w-3.5 h-3.5 rounded border-[#3e3e3e] bg-[#2a2a2a] text-teal-500 focus:ring-teal-500 focus:ring-offset-[#1e1e1e]"
                            />
                            <span className="text-white text-[10px]">ALL CAPS</span>
                          </label>
                          <label className="flex items-center gap-2 p-2 bg-[#151515] border border-[#2d2d2d] rounded cursor-pointer text-xs select-none">
                            <input
                              type="checkbox"
                              checked={englishCasing === 'first_letter_caps'}
                              onChange={(e) => setEnglishCasing(e.target.checked ? 'first_letter_caps' : 'none')}
                              className="w-3.5 h-3.5 rounded border-[#3e3e3e] bg-[#2a2a2a] text-teal-500 focus:ring-teal-500 focus:ring-offset-[#1e1e1e]"
                            />
                            <span className="text-white text-[10px]">First Letter Caps</span>
                          </label>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col gap-1.5 border-t border-[#2d2d2d] pt-3">
                      <label className="text-[10px] text-[#a0a0a0] uppercase font-bold tracking-wider">Style Selection</label>
                      <select
                        value={kineticTypoStyle}
                        onChange={(e) => setKineticTypoStyle(e.target.value)}
                        className="bg-[#151515] text-white text-xs border border-[#3e3e3e] rounded p-2 focus:outline-none focus:border-teal-500 w-full"
                      >
                        <option value="random">AI / Random Style Presets</option>
                        {TEXT_TEMPLATES.map((t) => (
                          <option key={t.name} value={t.name}>Specific: {t.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col gap-1.5 border-t border-[#2d2d2d] pt-3">
                      <label className="text-[10px] text-[#a0a0a0] uppercase font-bold tracking-wider">Animation Selection</label>
                      <select
                        value={kineticTypoAnimation}
                        onChange={(e) => setKineticTypoAnimation(e.target.value)}
                        className="bg-[#151515] text-white text-xs border border-[#3e3e3e] rounded p-2 focus:outline-none focus:border-teal-500 w-full"
                      >
                        <option value="random">AI / Random Animations</option>
                        <option value="zoom">Specific: Pop / Zoom</option>
                        <option value="bounce">Specific: Bounce</option>
                        <option value="slideUp">Specific: Slide Up</option>
                        <option value="slideDown">Specific: Slide Down</option>
                        <option value="slideLeft">Specific: Slide Left</option>
                        <option value="slideRight">Specific: Slide Right</option>
                        <option value="fadeIn">Specific: Fade In</option>
                        <option value="typewriter">Specific: Typewriter</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2.5 pt-2 border-t border-[#2d2d2d]">
                    <button
                      onClick={() => setShowKineticTypoModal(false)}
                      className="px-3.5 py-1.5 text-xs text-[#a0a0a0] hover:text-white transition-colors font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleGenerateKineticTypography}
                      className="px-4 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded text-xs font-semibold transition-colors"
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
              <div className="flex border-b border-[#3e3e3e] bg-[#222]">
                <button
                  onClick={() => { setTemplateSubTab('text'); setTemplateCategory('all'); }}
                  className={`flex-1 py-2 text-xs font-medium border-b-2 transition-colors ${
                    templateSubTab === 'text'
                      ? 'border-amber-500 text-amber-500 bg-[#2d2d2d]'
                      : 'border-transparent text-[#a0a0a0] hover:text-white hover:bg-[#252525]'
                  }`}
                >
                  Text Templates
                </button>
                <button
                  onClick={() => { setTemplateSubTab('video'); setTemplateCategory('all'); }}
                  className={`flex-1 py-2 text-xs font-medium border-b-2 transition-colors ${
                    templateSubTab === 'video'
                      ? 'border-amber-500 text-amber-500 bg-[#2d2d2d]'
                      : 'border-transparent text-[#a0a0a0] hover:text-white hover:bg-[#252525]'
                  }`}
                >
                  Video Templates
                </button>
                <button
                  onClick={() => setTemplateSubTab('project')}
                  className={`flex-1 py-2 text-xs font-medium border-b-2 transition-colors ${
                    templateSubTab === 'project'
                      ? 'border-amber-500 text-amber-500 bg-[#2d2d2d]'
                      : 'border-transparent text-[#a0a0a0] hover:text-white hover:bg-[#252525]'
                  }`}
                >
                  Project Layouts
                </button>
              </div>

              {templateSubTab !== 'project' ? (
                <div className="flex-1 overflow-y-auto flex flex-col">
                  {/* Category filter pills */}
                  <div className="flex gap-1 p-2 flex-wrap border-b border-[#3e3e3e] bg-[#1e1e1e]">
                    {categories.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => setTemplateCategory(cat.id)}
                        className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                          templateCategory === cat.id
                            ? 'bg-amber-500 text-black'
                            : 'bg-[#3e3e3e] text-[#a0a0a0] hover:text-white'
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-[#6a6a6a] px-3 py-1.5 font-medium uppercase tracking-wider text-amber-400/80">
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
                    className="w-full py-3 px-4 rounded border border-dashed border-amber-500/30 hover:border-amber-500 bg-amber-500/5 hover:bg-amber-500/10 text-amber-400 text-xs font-semibold flex items-center justify-center gap-2 transition-all"
                  >
                    <span>Save Current Timeline as Template</span>
                  </button>

                  <div className="flex flex-col gap-2">
                    {projectTemplates.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-center text-[#6a6a6a]">
                        <p className="text-xs font-medium">No Project Templates saved yet</p>
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
                            className="flex flex-col p-3 rounded border border-[#3e3e3e] bg-[#1e1e1e] hover:border-amber-500/30 transition-all group"
                          >
                            <div className="flex justify-between items-start gap-2">
                              <div className="min-w-0">
                                <h4 className="text-xs text-white font-semibold truncate">{tmpl.name}</h4>
                                {tmpl.description && (
                                  <p className="text-[10px] text-[#a0a0a0] mt-0.5 line-clamp-2 leading-relaxed">
                                    {tmpl.description}
                                  </p>
                                )}
                              </div>
                              <button
                                onClick={async () => {
                                  await deleteProjectTemplate(tmpl.id);
                                }}
                                className="p-1 hover:bg-[#2d2d2d] rounded text-[#a0a0a0] hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                                title="Delete Template"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <div className="flex justify-between items-center mt-3 pt-2.5 border-t border-[#2d2d2d]">
                              <div className="flex flex-col gap-0.5">
                                <span className="text-[8px] text-[#6a6a6a]">
                                  {dateStr}
                                </span>
                                <span className="text-[9px] text-[#a0a0a0] font-medium">
                                  {tmpl.tracks.length} track(s) · {tmpl.totalDuration.toFixed(1)}s
                                </span>
                              </div>

                              <button
                                onClick={() => setConfirmLoadTemplateId(tmpl.id)}
                                className="px-3 py-1 text-[10px] font-semibold text-black bg-amber-500 hover:bg-amber-400 rounded transition-colors"
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
            <div className="bg-gradient-to-br from-indigo-900/40 to-purple-900/20 border border-indigo-500/20 rounded-lg p-3 space-y-3">
              <div className="flex items-center gap-2 text-indigo-400">
                <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" />
                <span className="text-xs font-semibold uppercase tracking-wider">🤖 Auto Beat Sync</span>
              </div>
              <p className="text-[10px] text-[#a0a0a0] leading-tight">
                Automatically align video cuts & apply professional transitions synchronized to your audio track's beat markers.
              </p>

              <div className="space-y-2">
                {/* Audio Clip Selection */}
                <div>
                  <label className="text-[9px] uppercase tracking-wider text-[#707070] block mb-1">Select Audio Track (Beats Source)</label>
                  <select
                    value={syncAudioClip}
                    onChange={(e) => setSyncAudioClip(e.target.value)}
                    className="w-full bg-[#1e1e1e] border border-[#3e3e3e] text-xs text-[#d0d0d0] rounded p-1.5 focus:outline-none focus:border-indigo-500"
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
                  <label className="text-[9px] uppercase tracking-wider text-[#707070] block mb-1">Select Video Track to Sync</label>
                  <select
                    value={syncTargetTrack}
                    onChange={(e) => setSyncTargetTrack(e.target.value)}
                    className="w-full bg-[#1e1e1e] border border-[#3e3e3e] text-xs text-[#d0d0d0] rounded p-1.5 focus:outline-none focus:border-indigo-500"
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
                    <label className="text-[9px] uppercase tracking-wider text-[#707070] block mb-1">Interval (Beats)</label>
                    <select
                      value={syncEveryNBeats}
                      onChange={(e) => setSyncEveryNBeats(Number(e.target.value))}
                      className="w-full bg-[#1e1e1e] border border-[#3e3e3e] text-xs text-[#d0d0d0] rounded p-1.5 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="1">Every Beat (1)</option>
                      <option value="2">2 Beats</option>
                      <option value="4">4 Beats (1 Bar)</option>
                      <option value="8">8 Beats (2 Bars)</option>
                    </select>
                  </div>

                  {/* Transition Type */}
                  <div>
                    <label className="text-[9px] uppercase tracking-wider text-[#707070] block mb-1">Transition</label>
                    <select
                      value={syncTransitionType}
                      onChange={(e) => setSyncTransitionType(e.target.value)}
                      className="w-full bg-[#1e1e1e] border border-[#3e3e3e] text-xs text-[#d0d0d0] rounded p-1.5 focus:outline-none focus:border-indigo-500"
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
                    alert('Please select both an Audio clip and a Video track!');
                    return;
                  }
                  setIsSyncing(true);
                  setTimeout(() => {
                    autoSyncTrackToBeats(syncTargetTrack, syncAudioClip, syncEveryNBeats, syncTransitionType || undefined);
                    setIsSyncing(false);
                  }, 600);
                }}
                disabled={isSyncing || !syncTargetTrack || !syncAudioClip}
                className="w-full py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:from-gray-800 disabled:to-gray-800 text-xs font-semibold text-white rounded-md transition-all shadow-md active:scale-[0.98] flex items-center justify-center gap-1.5"
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

            <div className="h-px bg-[#3e3e3e]" />

            <p className="text-xs text-[#a0a0a0] mb-1">Drag transitions between clips on timeline (Hover to preview)</p>
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
                className={`w-full flex items-center justify-between px-2 py-1.5 rounded hover:bg-[#3a3a3a] transition-colors mb-1`}
              >
                <span className={`text-[10px] font-semibold uppercase tracking-wider ${color}`}>{label}</span>
                {openSection === id
                  ? <ChevronDown className="w-3 h-3 text-[#6a6a6a]" />
                  : <ChevronRight className="w-3 h-3 text-[#6a6a6a]" />}
              </button>
              {openSection === id && <div className="mb-3">{children}</div>}
            </div>
          );

          return (
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {/* ── Timeline FX ── */}
              <Section id="fx" label="Timeline FX" color="text-rose-400">
                <p className="text-[9px] text-[#6a6a6a] px-1 mb-1.5">Add FX Track first, then drag here</p>
                <div className="grid grid-cols-1 gap-0.5">
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
                        className="flex items-center gap-2.5 px-2 py-1.5 hover:bg-[#3a3a3a] rounded cursor-pointer transition-colors group"
                      >
                        <div className="w-7 h-7 rounded bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
                          <Icon className={`w-3.5 h-3.5 ${effect.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-xs text-white block leading-tight">{effect.name}</span>
                          <span className="text-[9px] text-[#6a6a6a]">{effect.desc}</span>
                        </div>
                        <span className="text-[8px] text-rose-400/50 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">FX</span>
                      </div>
                    );
                  })}
                </div>
              </Section>

              <div className="h-px bg-[#3e3e3e]" />

              {/* ── Color Presets ── */}
              <Section id="color" label="Color Presets" color="text-amber-400">
                <p className="text-[9px] text-[#6a6a6a] px-1 mb-1.5">Drag onto a video / image clip</p>
                <div className="grid grid-cols-1 gap-0.5">
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
                        className="flex items-center gap-2.5 px-2 py-1.5 hover:bg-[#3a3a3a] rounded cursor-pointer transition-colors group"
                      >
                        <div className="w-7 h-7 rounded bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                          <Icon className={`w-3.5 h-3.5 ${effect.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-xs text-white block leading-tight">{effect.name}</span>
                          <span className="text-[9px] text-[#6a6a6a]">{effect.desc}</span>
                        </div>
                        <span className="text-[8px] text-amber-400/50 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">CC</span>
                      </div>
                    );
                  })}
                </div>
              </Section>

              <div className="h-px bg-[#3e3e3e]" />

              {/* ── Particle Effects ── */}
              <Section id="particles" label="✦ Particle Effects" color="text-violet-400">
                <p className="text-[9px] text-[#6a6a6a] px-1 mb-1.5">Drag onto any video/image clip — click emitter on preview to reposition</p>
                <div className="grid grid-cols-1 gap-0.5">
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
                        className="flex items-center gap-2.5 px-2 py-1.5 hover:bg-[#3a3a3a] rounded cursor-pointer transition-colors group"
                      >
                        <div className={`w-7 h-7 rounded ${effect.bgColor} border flex items-center justify-center shrink-0`}>
                          <Icon className={`w-3.5 h-3.5 ${effect.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-xs text-white block leading-tight">{effect.name}</span>
                          <span className="text-[9px] text-[#6a6a6a]">{effect.desc}</span>
                        </div>
                        <span className="text-[8px] text-violet-400/60 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">✦</span>
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
        <div className="fixed inset-0 bg-black/60 z-[120] flex items-center justify-center">
          <div className="bg-[#2d2d2d] border border-[#3e3e3e] rounded-lg p-5 w-80 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-white uppercase tracking-wider">Save Project Template</h4>
              <button
                onClick={() => setShowSaveTemplateModal(false)}
                className="text-[#a0a0a0] hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="space-y-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-[#a0a0a0]">Template Name</label>
                <input
                  type="text"
                  placeholder="e.g. My Vlog Layout"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  className="bg-[#1e1e1e] border border-[#3e3e3e] rounded px-2 py-1.5 text-xs text-white placeholder-[#6a6a6a] focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-[#a0a0a0]">Description</label>
                <textarea
                  placeholder="What is this template for?"
                  value={templateDesc}
                  rows={2}
                  onChange={(e) => setTemplateDesc(e.target.value)}
                  className="bg-[#1e1e1e] border border-[#3e3e3e] rounded px-2 py-1.5 text-xs text-white placeholder-[#6a6a6a] focus:outline-none focus:border-amber-500 resize-none"
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
                className="flex-1 py-1.5 text-xs font-medium text-black bg-amber-500 hover:bg-amber-400 disabled:opacity-50 rounded transition-colors"
              >
                Save Template
              </button>
              <button
                onClick={() => setShowSaveTemplateModal(false)}
                className="flex-1 py-1.5 text-xs font-medium text-[#a0a0a0] hover:text-white bg-[#3e3e3e] hover:bg-[#4d4d4d] rounded transition-colors"
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
        <AIGeneratorModal onClose={() => setShowAIGeneratorModal(false)} />
      )}

      {/* AI SFX Designer Modal */}
      {showAiSfxModal && sfxGeneratedCues && (
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
      )}
    </div>
  );
}

export const TransitionCard = React.memo(function TransitionCard({ transition }: TransitionCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const animationRef = useRef<number | null>(null);
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
      if (isHovered) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    if (isHovered) {
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
  }, [isHovered, transition]);

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('application/procut-transition', transition.name);
        e.dataTransfer.effectAllowed = 'copy';
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="flex flex-col bg-[#1a1a1a] border border-[#3e3e3e] hover:border-purple-500 rounded overflow-hidden cursor-grab transition-all duration-150 relative group"
    >
      <div className="w-full aspect-video bg-black relative">
        <canvas
          ref={canvasRef}
          width={160}
          height={90}
          className="w-full h-full object-cover"
        />
        {!isHovered && (
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

  