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
} from 'lucide-react';
import React from 'react';


import { useEditorStore } from '@/store/editorStore';
import { useState, useRef, useCallback } from 'react';
import type { MediaTab, MediaType, MediaItem } from '@/types';
import { probeFile } from '@/utils/mediaProbe';
import { saveFileToDB } from '@/utils/projectPersistence';
import { parseSRT } from '@/utils/srtParser';
import demoA from '../assets/transition_demo_a.webp';
import demoB from '../assets/transition_demo_b.webp';
import { useEffect } from 'react';
import { parseCubeLut } from '@/utils/lutParser';
import { detectBeats } from '@/utils/beatDetection';
import { TITLE_TEMPLATES, TEMPLATE_CATEGORIES } from '@/utils/titleTemplates';
import type { TemplateCategory } from '@/utils/titleTemplates';

const TRANSITIONS = [
  { name: 'Fade', color: 'from-amber-500/20 to-transparent', preview: 'Fade in/out between clips' },
  { name: 'Cross Dissolve', color: 'from-purple-500/20 to-transparent', preview: 'Smooth blend transition' },
  { name: 'Wipe Left', color: 'from-blue-500/20 to-transparent', preview: 'Horizontal wipe to left' },
  { name: 'Wipe Right', color: 'from-blue-500/20 to-transparent', preview: 'Horizontal wipe to right' },
  { name: 'Zoom In', color: 'from-cyan-500/20 to-transparent', preview: 'Zoom into next clip' },
  { name: 'Zoom Out', color: 'from-cyan-500/20 to-transparent', preview: 'Zoom out from clip' },
  { name: 'Slide Up', color: 'from-emerald-500/20 to-transparent', preview: 'Slide up transition' },
  { name: 'Slide Down', color: 'from-emerald-500/20 to-transparent', preview: 'Slide down transition' },
];

// Timeline FX — dragged to FX tracks. type field maps to PreviewCanvas fxType.
const FX_EFFECTS = [
  { name: 'VFX Breakdown',       icon: Clapperboard, color: 'text-purple-400',  type: 'vfx_breakdown',    desc: 'Cinematic before→after color wipe' },
  { name: 'B&W to Color',        icon: Sun,          color: 'text-cyan-400',    type: 'bw_to_color',      desc: 'Desaturate to vivid color reveal' },
  { name: 'Glitch',              icon: Tv2,          color: 'text-rose-400',    type: 'glitch',           desc: 'Digital corruption distortion' },
  { name: 'Old Film',            icon: Film,         color: 'text-amber-400',   type: 'old_film',         desc: 'Grain, flicker, sepia tone' },
  { name: 'VHS',                 icon: Radio,        color: 'text-green-400',   type: 'vhs',              desc: 'Retro VHS tape artifact' },
  { name: 'Cinematic Bars',      icon: Monitor,      color: 'text-[#a0a0a0]',   type: 'cinematic_bars',   desc: 'Black letterbox bars 2.39:1' },
  { name: 'Neon Glow',           icon: Flame,        color: 'text-pink-400',    type: 'neon_glow',        desc: 'Electric bloom / glow effect' },
  { name: 'RGB Split',           icon: ScanLine,     color: 'text-red-400',     type: 'rgb_split',        desc: 'Chromatic aberration prism' },
  { name: 'Pixelate',            icon: Hexagon,      color: 'text-indigo-400',  type: 'pixelate',         desc: 'Mosaic / pixel block effect' },
  { name: 'Mirror',              icon: FlipHorizontal, color: 'text-teal-400',  type: 'mirror',           desc: 'Horizontal mirror reflection' },
  { name: 'Zoom Blur',           icon: ZoomIn,       color: 'text-orange-400',  type: 'zoom_blur',        desc: 'Radial motion zoom blur' },
  { name: 'Lens Flare',          icon: Aperture,     color: 'text-yellow-400',  type: 'lens_flare',       desc: 'Cinematic lens flare burst' },
  { name: 'Night Vision',        icon: Eye,          color: 'text-lime-400',    type: 'night_vision',     desc: 'Green phosphor night-vision' },
  { name: 'Thermal',             icon: Focus,        color: 'text-orange-500',  type: 'thermal',          desc: 'Infrared thermal cam look' },
];

// Color Correction — dragged to a video/image clip to apply that preset
const COLOR_CORRECTION_EFFECTS = [
  { name: 'Brightness',    icon: Sun,      color: 'text-amber-400',  preset: { exposure: 30 },                          desc: 'Boost clip brightness' },
  { name: 'Contrast',      icon: Droplets, color: 'text-cyan-400',   preset: { contrast: 150 },                         desc: 'Increase contrast' },
  { name: 'Saturation',    icon: Waves,    color: 'text-purple-400', preset: { saturation: 160 },                       desc: 'Boost color saturation' },
  { name: 'Blur',          icon: Droplets, color: 'text-blue-400',   preset: { blur: 8 },                               desc: 'Soft focus / background blur' },
  { name: 'Vignette',      icon: Sun,      color: 'text-rose-400',   preset: { vignette: 60 },                          desc: 'Dark edge vignette' },
  { name: 'Warm Tone',     icon: Flame,    color: 'text-orange-400', preset: { temperature: 60, saturation: 120 },       desc: 'Warm golden look' },
  { name: 'Cool Tone',     icon: Zap,      color: 'text-blue-300',   preset: { temperature: -60, saturation: 110 },      desc: 'Cool blue look' },
  { name: 'Faded Film',    icon: Clapperboard, color: 'text-stone-400', preset: { fadedFilm: 60, saturation: 80 },     desc: 'Faded vintage film' },
];

// Particle Effects — dragged to a video/image/FX clip
export const PARTICLE_EFFECTS: Array<{
  name: string;
  type: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  desc: string;
  defaultSettings: Omit<import('@/types').ClipParticleSettings, 'type' | 'emitterX' | 'emitterY'>;
}> = [
  {
    name: 'Snow',       type: 'snow',      icon: CloudSnow,  color: 'text-sky-300',    bgColor: 'bg-sky-500/10 border-sky-500/20',
    desc: 'Gentle falling snowflakes',
    defaultSettings: { amount: 120, speed: 40,  intensity: 80, size: 100, gravity: 20,   wind: 5,   spread: 180, lifetime: 150, color: '#ffffff', colorVariance: 15, glow: false, turbulence: 20 },
  },
  {
    name: 'Rain',       type: 'rain',      icon: CloudRain,  color: 'text-blue-400',   bgColor: 'bg-blue-500/10 border-blue-500/20',
    desc: 'Heavy rainfall streaks',
    defaultSettings: { amount: 200, speed: 160, intensity: 70, size: 100, gravity: 100, wind: 15,  spread: 10,  lifetime: 60,  color: '#a0c8ff', colorVariance: 10, glow: false, turbulence: 5  },
  },
  {
    name: 'Fire',       type: 'fire',      icon: Flame,      color: 'text-orange-400', bgColor: 'bg-orange-500/10 border-orange-500/20',
    desc: 'Rising fire embers',
    defaultSettings: { amount: 80,  speed: 80,  intensity: 90, size: 130, gravity: -60, wind: 0,   spread: 60,  lifetime: 80,  color: '#ff6a00', colorVariance: 60, glow: true,  turbulence: 60 },
  },
  {
    name: 'Sparkles',   type: 'sparkles',  icon: Star,       color: 'text-yellow-300', bgColor: 'bg-yellow-500/10 border-yellow-500/20',
    desc: 'Glittering golden sparkles',
    defaultSettings: { amount: 60,  speed: 50,  intensity: 85, size: 80,  gravity: -10, wind: 0,   spread: 360, lifetime: 100, color: '#ffd700', colorVariance: 30, glow: true,  turbulence: 30 },
  },
  {
    name: 'Confetti',   type: 'confetti',  icon: Sparkles,   color: 'text-pink-400',   bgColor: 'bg-pink-500/10 border-pink-500/20',
    desc: 'Colorful party confetti',
    defaultSettings: { amount: 100, speed: 60,  intensity: 90, size: 100, gravity: 40,  wind: 10,  spread: 90,  lifetime: 200, color: 'auto',    colorVariance: 100, glow: false, turbulence: 40 },
  },
  {
    name: 'Smoke',      type: 'smoke',     icon: Wind,       color: 'text-gray-400',   bgColor: 'bg-gray-500/10 border-gray-500/20',
    desc: 'Wispy rising smoke',
    defaultSettings: { amount: 30,  speed: 25,  intensity: 60, size: 200, gravity: -30, wind: 8,   spread: 30,  lifetime: 200, color: '#888888', colorVariance: 20, glow: false, turbulence: 70 },
  },
  {
    name: 'Bubbles',    type: 'bubbles',   icon: Droplets,   color: 'text-cyan-400',   bgColor: 'bg-cyan-500/10 border-cyan-500/20',
    desc: 'Rising transparent bubbles',
    defaultSettings: { amount: 40,  speed: 30,  intensity: 70, size: 120, gravity: -40, wind: 5,   spread: 60,  lifetime: 180, color: '#80ffff', colorVariance: 20, glow: true,  turbulence: 15 },
  },
  {
    name: 'Leaves',     type: 'leaves',    icon: Leaf,       color: 'text-green-400',  bgColor: 'bg-green-500/10 border-green-500/20',
    desc: 'Autumn leaves falling',
    defaultSettings: { amount: 50,  speed: 35,  intensity: 80, size: 110, gravity: 30,  wind: 20,  spread: 45,  lifetime: 180, color: '#ff7b00', colorVariance: 70, glow: false, turbulence: 50 },
  },
  {
    name: 'Hearts',     type: 'hearts',    icon: Heart,      color: 'text-rose-400',   bgColor: 'bg-rose-500/10 border-rose-500/20',
    desc: 'Floating pink hearts',
    defaultSettings: { amount: 30,  speed: 25,  intensity: 85, size: 100, gravity: -20, wind: 5,   spread: 40,  lifetime: 200, color: '#ff4d88', colorVariance: 25, glow: true,  turbulence: 20 },
  },
  {
    name: 'Matrix',     type: 'matrix',    icon: Code2,      color: 'text-lime-400',   bgColor: 'bg-lime-500/10 border-lime-500/20',
    desc: 'Digital rain code columns',
    defaultSettings: { amount: 40,  speed: 80,  intensity: 90, size: 100, gravity: 80,  wind: 0,   spread: 0,   lifetime: 120, color: '#00ff41', colorVariance: 10, glow: true,  turbulence: 0  },
  },
];



const TEXT_TEMPLATES = [
  { name: 'Heading', style: 'text-4xl font-bold', settings: { fontSize: 48, bold: true } },
  { name: 'Subtitle', style: 'text-2xl font-medium', settings: { fontSize: 32, bold: false } },
  { name: 'Fancy', style: 'text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600', settings: { fontSize: 64, bold: true, color: '#ec4899' } },
];

export function MediaPanel() {
  const {
    mediaLibrary,
    activeMediaTab,
    setActiveMediaTab,
    addMedia,
    removeMedia,
    insertTextClip,
    addBeatMarkers,
    clearBeatMarkers,
    projectTemplates,
    saveProjectAsTemplate,
    deleteProjectTemplate,
    loadProjectTemplate,
  } = useEditorStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<string>('');
  
  // TTS State variables
  const [ttsText, setTtsText] = useState('');
  const [ttsLanguage, setTtsLanguage] = useState('en');
  const [ttsRate, setTtsRate] = useState(1);
  const [ttsPitch, setTtsPitch] = useState(1);
  const [ttsEngine, setTtsEngine] = useState<'standard' | 'neural'>('neural');
  const [ttsVoice, setTtsVoice] = useState('alloy');
  const [isGeneratingTTS, setIsGeneratingTTS] = useState(false);

  const [isDragOver, setIsDragOver] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [openSection, setOpenSection] = useState<'fx' | 'color' | 'particles'>('fx');
  const [previewItem, setPreviewItem] = useState<any | null>(null);
  const [templateCategory, setTemplateCategory] = useState<TemplateCategory>('all');
  const [detectingBeatId, setDetectingBeatId] = useState<string | null>(null);
  const [templateSubTab, setTemplateSubTab] = useState<'title' | 'project'>('title');
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDesc, setTemplateDesc] = useState('');
  const [confirmLoadTemplateId, setConfirmLoadTemplateId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lutInputRef = useRef<HTMLInputElement>(null);
  const srtInputRef = useRef<HTMLInputElement>(null);

  const tabs: { id: MediaTab; label: string; icon: typeof Film }[] = [
    { id: 'project', label: 'Project', icon: Folder },
    { id: 'text', label: 'Text', icon: Type },
    { id: 'audio', label: 'Audio', icon: Music },
    { id: 'templates', label: 'Templates', icon: Clapperboard },
    { id: 'transitions', label: 'Transitions', icon: Sparkles },
    { id: 'effects', label: 'Effects', icon: Waves },
  ];

  const filteredMedia = mediaLibrary.filter((m) =>
    m.type !== 'text' && m.type !== 'fx' &&
    m.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDragStart = (e: React.DragEvent, mediaId: string) => {
    e.dataTransfer.setData('application/procut-media', mediaId);
    e.dataTransfer.effectAllowed = 'copy';
  };

  // Real import with probing
  const importFiles = useCallback(async (files: FileList | File[]) => {
    setImporting(true);
    const fileArray = Array.from(files);

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      setImportProgress(`Importing ${file.name} (${i + 1}/${fileArray.length})...`);

      try {
        // Handle .cube LUT files specially
        if (file.name.toLowerCase().endsWith('.cube')) {
          const text = await file.text();
          const lutData = parseCubeLut(text);
          const lutId = Math.random().toString(36).substr(2, 9);
          addMedia({
            id: lutId,
            name: file.name.replace(/\.cube$/i, ''),
            type: 'lut',
            duration: 0,
            url: '',
            size: file.size,
            createdAt: Date.now(),
            lutData,
          });
        } else {
          const mediaItem = await probeFile(file);
          addMedia(mediaItem, file);
        }
      } catch (err) {
        console.error(`Failed to import ${file.name}:`, err);
      }
    }

    setImporting(false);
    setImportProgress('');
  }, [addMedia]);

  // Beat detection handler
  const handleDetectBeats = useCallback(async (media: MediaItem) => {
    if (!media.url || detectingBeatId) return;
    setDetectingBeatId(media.id);
    try {
      const result = await detectBeats(media.url);
      addBeatMarkers(media.id, result.beats);
      alert(`✅ Found ${result.beats.length} beats — ~${result.bpm} BPM (confidence: ${Math.round(result.confidence * 100)}%)\n\nBeat markers added to the timeline ruler.`);
    } catch (err) {
      console.error('Beat detection failed:', err);
      alert('Beat detection failed. Make sure the clip has valid audio.');
    } finally {
      setDetectingBeatId(null);
    }
  }, [addBeatMarkers, detectingBeatId]);

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
      
      // 1. Create a new text track
      store.addTrack('text');
      
      // 2. Retrieve the track
      const textTracks = store.tracks.filter(t => t.type === 'text');
      const targetTrack = textTracks[textTracks.length - 1];
      if (!targetTrack) return;

      // 3. Generate text clips in one batch
      const newClips = parsed.map((sub, idx) => {
        const mediaId = `sub_media_${idx}_${Math.random().toString(36).substr(2, 9)}`;
        store.addMedia({
          id: mediaId,
          name: `Subtitle ${idx + 1}`,
          type: 'text',
          duration: sub.duration,
          url: '',
          createdAt: Date.now(),
          textContent: sub.text,
        });

        const clipId = `sub_clip_${idx}_${Math.random().toString(36).substr(2, 9)}`;

        return {
          id: clipId,
          mediaId,
          trackId: targetTrack.id,
          startTime: sub.startTime,
          duration: sub.duration,
          trimStart: 0,
          trimEnd: 0,
          transform: { x: 0, y: 160, scale: 100, rotation: 0 }, 
          opacity: 1,
          speed: 1,
          effects: [],
          textSettings: {
            text: sub.text,
            fontFamily: 'Inter',
            fontSize: 22,
            color: '#ffffff',
            backgroundColor: 'rgba(0,0,0,0.5)',
            bold: false,
            italic: false,
            underline: false,
            shadow: true,
            shadowColor: '#000000',
            shadowBlur: 3,
            threeD: false,
            threeDDepth: 0,
            textAlign: 'center',
          }
        } as import('@/types').TimelineClip;
      });

      // 4. Update the tracks state and save to snapshot
      useEditorStore.setState(state => {
        const finalTracks = state.tracks.map(t => {
          if (t.id === targetTrack.id) {
            return {
              ...t,
              name: 'Subtitles',
              clips: newClips,
            };
          }
          return t;
        });
        return { tracks: finalTracks };
      });

      store.recalcTotalDuration();
      store.saveSnapshot();
      alert(`Imported ${parsed.length} subtitles onto a new 'Subtitles' track!`);
    };

    reader.readAsText(file);
    e.target.value = '';
  }, []);

  const relinkInputRef = useRef<HTMLInputElement>(null);

  const handleRelinkFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setImporting(true);
    setImportProgress('Re-linking project files...');

    const fileArray = Array.from(files);
    const missing = mediaLibrary.filter(
      (m) => m.type !== 'text' && m.type !== 'fx' && (m.url === 'PENDING_RESTORE' || !m.url)
    );

    let linkedCount = 0;

    for (const file of fileArray) {
      const match = missing.find((m) => m.name === file.name);
      if (match) {
        setImportProgress(`Linking ${file.name}...`);
        try {
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

    // Refresh state in editor store
    useEditorStore.getState().recalcTotalDuration();
    useEditorStore.getState().saveSnapshot();
    
    // Dispatch event to notify PreviewCanvas to redraw
    window.dispatchEvent(new CustomEvent('procut-frame-updated'));

    setImporting(false);
    setImportProgress('');
    alert(`Successfully re-linked ${linkedCount} files!`);
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
    removeMedia(id);
    setConfirmDeleteId(null);
  };

  const getMediaIcon = (type: MediaType) => {
    switch (type) {
      case 'video': return <Film className="w-5 h-5 text-blue-400" />;
      case 'audio': return <Music className="w-5 h-5 text-emerald-400" />;
      case 'image': return <Image className="w-5 h-5 text-amber-400" />;
      case 'text': return <Type className="w-5 h-5 text-purple-400" />;
      case 'fx': return <Sparkles className="w-5 h-5 text-rose-400" />;
      default: return <Film className="w-5 h-5 text-[#a0a0a0]" />;
    }
  };

  const getMediaColor = (type: MediaType) => {
    switch (type) {
      case 'video': return 'bg-blue-500/10 border-blue-500/20';
      case 'audio': return 'bg-emerald-500/10 border-emerald-500/20';
      case 'image': return 'bg-amber-500/10 border-amber-500/20';
      case 'text': return 'bg-purple-500/10 border-purple-500/20';
      case 'fx': return 'bg-rose-500/10 border-rose-500/20';
      default: return 'bg-[#3e3e3e]/20 border-[#3e3e3e]';
    }
  };

  const formatDuration = (s: number) => {
    if (!isFinite(s) || s < 0) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

  const previewTTS = async () => {
    if (!ttsText.trim()) return;
    
    if (ttsEngine === 'neural') {
      const puter = (window as any).puter;
      if (puter) {
        try {
          setIsGeneratingTTS(true);
          const audio = await puter.ai.txt2speech(ttsText, {
            provider: 'openai',
            model: 'tts-1',
            voice: ttsVoice
          });
          audio.play();
          setIsGeneratingTTS(false);
        } catch (err) {
          console.error('Puter TTS preview error:', err);
          alert('Failed to preview neural voice. Falling back to standard system voice.');
          setIsGeneratingTTS(false);
          // Fallback to standard
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(ttsText);
          utterance.lang = ttsLanguage;
          utterance.rate = ttsRate;
          utterance.pitch = ttsPitch;
          window.speechSynthesis.speak(utterance);
        }
      } else {
        // Fallback if Puter script is blocked/failed
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(ttsText);
        utterance.lang = ttsLanguage;
        utterance.rate = ttsRate;
        utterance.pitch = ttsPitch;
        window.speechSynthesis.speak(utterance);
      }
    } else {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(ttsText);
      utterance.lang = ttsLanguage;
      utterance.rate = ttsRate;
      utterance.pitch = ttsPitch;
      window.speechSynthesis.speak(utterance);
    }
  };

  const generateTTS = async () => {
    if (!ttsText.trim()) return;
    setIsGeneratingTTS(true);
    try {
      let blob: Blob;
      let mimeType = 'audio/mp3';
      
      if (ttsEngine === 'neural') {
        const puter = (window as any).puter;
        if (!puter) {
          throw new Error('Puter AI engine is not loaded. Make sure you have active internet connection.');
        }
        
        const audio = await puter.ai.txt2speech(ttsText, {
          provider: 'openai',
          model: 'tts-1',
          voice: ttsVoice
        });
        
        const response = await fetch(audio.src);
        if (!response.ok) throw new Error('Failed to fetch audio from neural source.');
        blob = await response.blob();
        mimeType = blob.type || 'audio/mp3';
      } else {
        const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${ttsLanguage}&client=tw-ob&q=${encodeURIComponent(ttsText)}`;
        const proxiedUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(ttsUrl)}`;
        
        const response = await fetch(proxiedUrl);
        if (!response.ok) throw new Error('Failed to generate audio from standard TTS proxy.');
        blob = await response.blob();
      }
      
      const audioUrl = URL.createObjectURL(blob);
      const mediaId = `tts_${Date.now()}`;
      const mediaItem = {
        id: mediaId,
        name: `${ttsEngine === 'neural' ? 'Neural' : 'TTS'}: ${ttsText.slice(0, 25)}...`,
        type: 'audio' as const,
        duration: 5,
        url: audioUrl,
        createdAt: Date.now(),
      };
      
      const audioEl = document.createElement('audio');
      audioEl.src = audioUrl;
      audioEl.addEventListener('loadedmetadata', async () => {
        const realDuration = audioEl.duration || 5;
        const peaks: number[] = [];
        for (let i = 0; i < 100; i++) {
          peaks.push(0.1 + Math.random() * 0.7);
        }
        
        const finalMediaItem = {
          ...mediaItem,
          duration: realDuration,
          waveformPeaks: peaks,
        };

        try {
          await useEditorStore.getState().addMedia(finalMediaItem, new File([blob], `tts_${mediaId}.mp3`, { type: mimeType }));
        } catch (err) {
          console.error('Failed to save TTS to DB:', err);
          useEditorStore.getState().addMedia(finalMediaItem);
        }
        
        setIsGeneratingTTS(false);
        setTtsText('');
        setActiveMediaTab('project');
      });
    } catch (err: any) {
      console.error('TTS Generation error:', err);
      alert(`Failed to generate TTS audio: ${err.message || 'Unknown error'}`);
      setIsGeneratingTTS(false);
    }
  };

  return (
    <div
      className="h-full flex flex-col bg-[#252525] border-r border-[#3e3e3e]"
      onDragOver={handleZoneDragOver}
      onDragLeave={handleZoneDragLeave}
      onDrop={handleZoneDrop}
    >
      {/* Tabs */}
      <div className="flex border-b border-[#3e3e3e]">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeMediaTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveMediaTab(tab.id)}
              className={`flex-1 py-2.5 text-[10px] font-medium uppercase tracking-wider flex flex-col items-center gap-1 transition-colors ${
                isActive
                  ? 'text-white border-b-2 border-amber-500 bg-[#2d2d2d]'
                  : 'text-[#a0a0a0] hover:text-white hover:bg-[#2d2d2d]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
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
          <div className="px-3 py-2 bg-amber-500/10 border-b border-amber-500/20 flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />
            <span className="text-[10px] text-amber-300 truncate">{importProgress}</span>
          </div>
        )}

        {activeMediaTab === 'project' && (
          <>
            {/* Search & View Controls */}
            <div className="p-2 border-b border-[#3e3e3e]">
              <div className="relative mb-2">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#a0a0a0]" />
                <input
                  type="text"
                  placeholder="Search media..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-[#1e1e1e] border border-[#3e3e3e] rounded text-xs text-white placeholder-[#a0a0a0] focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[#a0a0a0]">
                  {filteredMedia.length} items
                </span>
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
                    {previewItem.type === 'video' && (
                      <video
                        key={previewItem.id}
                        src={previewItem.url}
                        controls
                        className="w-full h-full object-contain"
                        autoPlay={false}
                      />
                    )}
                    {previewItem.type === 'audio' && (
                      <div className="p-3 w-full flex flex-col items-center justify-center">
                        <Music className="w-8 h-8 text-emerald-400 mb-2" />
                        <audio src={previewItem.url} controls className="w-full h-8" />
                      </div>
                    )}
                    {previewItem.type === 'image' && (
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
                <div className="flex gap-1.5 bg-[#141414] p-1 border border-[#3e3e3e] rounded-lg">
                  <button
                    type="button"
                    onClick={() => setTtsEngine('neural')}
                    className={`flex-1 py-1.5 text-xs rounded transition-all font-medium ${
                      ttsEngine === 'neural'
                        ? 'bg-amber-500 text-black font-semibold'
                        : 'text-[#a0a0a0] hover:text-white'
                    }`}
                  >
                    🔥 Neural (Ultra-Natural)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTtsEngine('standard')}
                    className={`flex-1 py-1.5 text-xs rounded transition-all font-medium ${
                      ttsEngine === 'standard'
                        ? 'bg-amber-500 text-black font-semibold'
                        : 'text-[#a0a0a0] hover:text-white'
                    }`}
                  >
                    Standard
                  </button>
                </div>
              </div>

              {ttsEngine === 'neural' ? (
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
          </div>
        )}

        {activeMediaTab === 'text' && (
          <div className="flex-1 overflow-y-auto p-2">
            <p className="text-xs text-[#a0a0a0] mb-3">Click to add text at playhead</p>
            <div className="flex flex-col gap-2">
              {TEXT_TEMPLATES.map((template) => (
                <div
                  key={template.name}
                  onClick={() => insertTextClip({ text: template.name, ...template.settings })}
                  className="p-4 bg-[#2d2d2d] hover:bg-[#3e3e3e] border border-[#3e3e3e] hover:border-[#5e5e5e] rounded cursor-pointer transition-all flex items-center justify-center text-center group"
                >
                  <span className={`${template.style} transition-transform group-hover:scale-105`}>
                    {template.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Templates Tab ── */}
        {activeMediaTab === 'templates' && (() => {
          const filtered = templateCategory === 'all'
            ? TITLE_TEMPLATES
            : TITLE_TEMPLATES.filter((t) => t.category === templateCategory);
          
          return (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Sub-Tab Selector */}
              <div className="flex border-b border-[#3e3e3e] bg-[#222]">
                <button
                  onClick={() => setTemplateSubTab('title')}
                  className={`flex-1 py-2 text-xs font-medium border-b-2 transition-colors ${
                    templateSubTab === 'title'
                      ? 'border-amber-500 text-amber-500 bg-[#2d2d2d]'
                      : 'border-transparent text-[#a0a0a0] hover:text-white hover:bg-[#252525]'
                  }`}
                >
                  Text / Titles
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

              {templateSubTab === 'title' ? (
                <div className="flex-1 overflow-y-auto flex flex-col">
                  {/* Category filter pills */}
                  <div className="flex gap-1 p-2 flex-wrap border-b border-[#3e3e3e] bg-[#1e1e1e]">
                    {TEMPLATE_CATEGORIES.map((cat) => (
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
                  <p className="text-[10px] text-[#6a6a6a] px-3 py-1.5">Drag onto a Text track to apply</p>
                  <div className="flex flex-col gap-1 p-2">
                    {filtered.map((tmpl) => (
                      <div
                        key={tmpl.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('application/procut-template', tmpl.id);
                          e.dataTransfer.effectAllowed = 'copy';
                        }}
                        className="flex items-center gap-2.5 p-2.5 rounded border border-[#3e3e3e] hover:border-amber-500/50 bg-[#1e1e1e] hover:bg-[#2a2a2a] cursor-grab transition-all group"
                      >
                        {/* Color accent dot */}
                        <div
                          className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center"
                          style={{ background: `${tmpl.accentColor}22`, border: `1px solid ${tmpl.accentColor}44` }}
                        >
                          <div className="w-3 h-3 rounded-full" style={{ background: tmpl.accentColor }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-white font-medium truncate">{tmpl.name}</p>
                          <p className="text-[9px] text-[#6a6a6a] truncate">{tmpl.description}</p>
                          <p className="text-[8px] mt-0.5" style={{ color: tmpl.accentColor + 'cc' }}>
                            {tmpl.defaultDuration}s · {tmpl.category}
                          </p>
                        </div>
                        <span className="text-[8px] text-amber-400/40 group-hover:text-amber-400/80 transition-colors shrink-0">DRAG</span>
                      </div>
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
          <div className="flex-1 overflow-y-auto p-2">
            <p className="text-xs text-[#a0a0a0] mb-3">Drag transitions between clips on timeline (Hover to preview)</p>
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
                        onMouseEnter={() => setHoveredItem(effect.name)}
                        onMouseLeave={() => setHoveredItem(null)}
                        className="flex items-center gap-2.5 px-2 py-1.5 hover:bg-[#3a3a3a] rounded cursor-grab transition-colors group"
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
                        onMouseEnter={() => setHoveredItem(effect.name)}
                        onMouseLeave={() => setHoveredItem(null)}
                        className="flex items-center gap-2.5 px-2 py-1.5 hover:bg-[#3a3a3a] rounded cursor-grab transition-colors group"
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
                        onMouseEnter={() => setHoveredItem(effect.name)}
                        onMouseLeave={() => setHoveredItem(null)}
                        className="flex items-center gap-2.5 px-2 py-1.5 hover:bg-[#3a3a3a] rounded cursor-grab transition-colors group"
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
    </div>
  );
}

interface TransitionCardProps {
  transition: {
    name: string;
    color: string;
    preview: string;
  };
}

function TransitionCard({ transition }: TransitionCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const animationRef = useRef<number | null>(null);

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
      const nameLower = transition.name.toLowerCase();

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
  }, [isHovered]);

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
}
