import { useEditorStore } from '@/store/editorStore';
import type { TimelineClip, TimelineTrack, MediaItem, ClipTransform, ClipCrop, ClipMaskSettings } from '@/types';
import { toast } from 'sonner';

export type PresentationCategory =
  | 'all'
  | 'split'
  | 'pip'
  | 'keynote'
  | 'editorial'
  | 'shorts'
  | 'cinematic';

export interface PresentationGraphic {
  type: 'lower_third' | 'badge' | 'topic_pill' | 'split_divider' | 'chapter_card';
  text: string;
  subtext?: string;
  position?: { x: number; y: number };
  textSettings?: {
    fontFamily?: string;
    fontSize?: number;
    color?: string;
    backgroundColor?: string;
    bold?: boolean;
    textAlign?: 'left' | 'center' | 'right';
    animation?: {
      in: string;
      out: string;
      inDuration: number;
      outDuration: number;
    };
  };
  animations?: any;
}

export interface PresentationTemplate {
  id: string;
  name: string;
  category: PresentationCategory;
  categoryLabel: string;
  description: string;
  badge: '16:9' | '9:16' | 'Universal';
  accentColor: string;
  defaultDuration: number; // in seconds
  previewType:
    | 'split_50_50'
    | 'pip_bottom_right'
    | 'pip_circle'
    | 'editorial_70_30'
    | 'keynote_float'
    | 'podcast_dual'
    | 'shorts_vertical'
    | 'cinematic_cutaway'
    | 'minimalist_studio'
    | 'tech_review';
  // A-Roll configuration (Presenter / Talking Head)
  aRoll: {
    label: string;
    transform: ClipTransform;
    crop?: ClipCrop;
    mask?: ClipMaskSettings;
    animations?: any;
    colorFilters?: any;
    opacity?: number;
    enterExitAnimation?: any;
  };
  // B-Roll configuration (Showcase / Screen Demo / Slide)
  bRoll: {
    label: string;
    transform: ClipTransform;
    crop?: ClipCrop;
    mask?: ClipMaskSettings;
    animations?: any;
    colorFilters?: any;
    opacity?: number;
    enterExitAnimation?: any;
  };
  // Supporting motion typography & badges
  graphics?: PresentationGraphic[];
  audioSettings?: {
    aRollVolume?: number;
    bRollVolume?: number;
  };
}

/**
 * 10 Master-Crafted A-Roll & B-Roll Presentation Templates
 */
export const PRESENTATION_TEMPLATES: PresentationTemplate[] = [
  {
    id: 'split_keynote_50_50',
    name: 'Keynote Dual Stage (50/50)',
    category: 'split',
    categoryLabel: 'Split Screen',
    description: 'Side-by-side balanced split. A-Roll host on left with name badge; B-Roll showcase on right with subtle Ken Burns drift.',
    badge: '16:9',
    accentColor: '#3b82f6',
    defaultDuration: 7,
    previewType: 'split_50_50',
    aRoll: {
      label: 'Host Camera (Left)',
      transform: { x: -480, y: 0, scale: 96, rotation: 0 },
      crop: { top: 0, bottom: 0, left: 0, right: 0 },
      colorFilters: { contrast: 105, saturation: 104 },
    },
    bRoll: {
      label: 'Showcase Demo (Right)',
      transform: { x: 480, y: 0, scale: 96, rotation: 0 },
      animations: {
        'transform.scale': [
          { time: 0, value: 96, easing: 'easeOut' },
          { time: 7, value: 104 },
        ],
      },
    },
    graphics: [
      {
        type: 'badge',
        text: 'HOST SPEAKER',
        subtext: 'Executive Director',
        position: { x: -480, y: 380 },
        textSettings: {
          fontSize: 22,
          color: '#ffffff',
          backgroundColor: 'rgba(15, 23, 42, 0.85)',
          bold: true,
          textAlign: 'center',
          animation: { in: 'slideUp', out: 'fadeOut', inDuration: 0.5, outDuration: 0.4 },
        },
      },
      {
        type: 'topic_pill',
        text: 'PRODUCT REVEAL // LIVE DEMO',
        position: { x: 480, y: -420 },
        textSettings: {
          fontSize: 18,
          color: '#60a5fa',
          backgroundColor: 'rgba(30, 58, 138, 0.8)',
          bold: true,
          textAlign: 'center',
          animation: { in: 'fadeIn', out: 'fadeOut', inDuration: 0.4, outDuration: 0.4 },
        },
      },
    ],
  },

  {
    id: 'pip_executive_bottom_right',
    name: 'Executive PiP (Corner Cam)',
    category: 'pip',
    categoryLabel: 'Picture-in-Picture',
    description: 'Fullscreen B-Roll presentation slide or demo with sleek rounded A-Roll webcam in the bottom-right corner.',
    badge: '16:9',
    accentColor: '#f59e0b',
    defaultDuration: 8,
    previewType: 'pip_bottom_right',
    aRoll: {
      label: 'Floating Presenter (Bottom-Right)',
      transform: { x: 640, y: 320, scale: 32, rotation: 0 },
      mask: {
        enabled: true,
        type: 'rectangle',
        x: 50,
        y: 50,
        width: 100,
        height: 100,
        points: [],
        feather: 0,
        invert: false,
      },
      animations: {
        'transform.y': [
          { time: 0, value: 480, easing: 'easeOut' },
          { time: 0.6, value: 320 },
        ],
        opacity: [
          { time: 0, value: 0, easing: 'easeOut' },
          { time: 0.5, value: 1 },
        ],
      },
    },
    bRoll: {
      label: 'Main Presentation Screen',
      transform: { x: 0, y: 0, scale: 100, rotation: 0 },
    },
    graphics: [
      {
        type: 'badge',
        text: 'KEYNOTE PRESENTER',
        position: { x: 640, y: 470 },
        textSettings: {
          fontSize: 16,
          color: '#fef3c7',
          backgroundColor: 'rgba(120, 53, 15, 0.9)',
          bold: true,
          textAlign: 'center',
          animation: { in: 'slideUp', out: 'fadeOut', inDuration: 0.6, outDuration: 0.4 },
        },
      },
    ],
  },

  {
    id: 'pip_circle_facecam',
    name: 'Circle Facecam Glow',
    category: 'pip',
    categoryLabel: 'Picture-in-Picture',
    description: 'Circular webcam badge with neon cyan accent in the bottom-left corner over full-resolution screen recording.',
    badge: 'Universal',
    accentColor: '#06b6d4',
    defaultDuration: 6,
    previewType: 'pip_circle',
    aRoll: {
      label: 'Circular Facecam (Bottom-Left)',
      transform: { x: -660, y: 330, scale: 28, rotation: 0 },
      mask: {
        enabled: true,
        type: 'circle',
        x: 50,
        y: 50,
        width: 100,
        height: 100,
        points: [],
        feather: 2,
        invert: false,
      },
    },
    bRoll: {
      label: 'Fullscreen Screencast / Gameplay',
      transform: { x: 0, y: 0, scale: 100, rotation: 0 },
    },
    graphics: [
      {
        type: 'badge',
        text: '● LIVE COMMENTARY',
        position: { x: -660, y: 460 },
        textSettings: {
          fontSize: 15,
          color: '#22d3ee',
          backgroundColor: 'rgba(8, 51, 68, 0.9)',
          bold: true,
          textAlign: 'center',
          animation: { in: 'fadeIn', out: 'fadeOut', inDuration: 0.4, outDuration: 0.4 },
        },
      },
    ],
  },

  {
    id: 'editorial_vox_70_30',
    name: 'Vox Deep-Dive (70/30 Split)',
    category: 'editorial',
    categoryLabel: 'Editorial & Vox',
    description: 'Asymmetric 70% B-roll document showcase on left with 30% framed vertical A-roll host on right.',
    badge: '16:9',
    accentColor: '#e11d48',
    defaultDuration: 7,
    previewType: 'editorial_70_30',
    aRoll: {
      label: 'Host Commentary (Right 30%)',
      transform: { x: 620, y: 0, scale: 72, rotation: 0 },
      crop: { left: 16, right: 16, top: 0, bottom: 0 },
    },
    bRoll: {
      label: 'Archival Document / Map (Left 70%)',
      transform: { x: -260, y: 0, scale: 82, rotation: 0 },
      colorFilters: { vignette: 24, fadedFilm: 15 },
      animations: {
        'transform.scale': [
          { time: 0, value: 80, easing: 'linear' },
          { time: 7, value: 86 },
        ],
      },
    },
    graphics: [
      {
        type: 'chapter_card',
        text: 'CHAPTER 01 // EVIDENCE',
        subtext: 'Financial Ledger Analysis',
        position: { x: -260, y: -420 },
        textSettings: {
          fontSize: 20,
          color: '#ffffff',
          backgroundColor: 'rgba(225, 29, 72, 0.85)',
          bold: true,
          textAlign: 'center',
          animation: { in: 'slideDown', out: 'fadeOut', inDuration: 0.5, outDuration: 0.4 },
        },
      },
      {
        type: 'badge',
        text: 'INVESTIGATIVE JOURNALIST',
        position: { x: 620, y: 390 },
        textSettings: {
          fontSize: 16,
          color: '#ffffff',
          backgroundColor: 'rgba(15, 23, 42, 0.8)',
          bold: true,
          textAlign: 'center',
        },
      },
    ],
  },

  {
    id: 'keynote_floating_card',
    name: 'Apple Keynote (Floating Card)',
    category: 'keynote',
    categoryLabel: 'Keynote & Launch',
    description: 'Full-height presenter on left with floating rounded glass B-roll card gliding up smoothly on right.',
    badge: '16:9',
    accentColor: '#8b5cf6',
    defaultDuration: 8,
    previewType: 'keynote_float',
    aRoll: {
      label: 'Keynote Presenter (Left)',
      transform: { x: -440, y: 0, scale: 95, rotation: 0 },
    },
    bRoll: {
      label: 'Floating Product Card (Right)',
      transform: { x: 440, y: -10, scale: 72, rotation: 0 },
      animations: {
        'transform.y': [
          { time: 0, value: 160, easing: 'easeOut' },
          { time: 1.0, value: -10 },
          { time: 8, value: -25 },
        ],
        opacity: [
          { time: 0, value: 0, easing: 'easeOut' },
          { time: 0.8, value: 1 },
        ],
      },
    },
    graphics: [
      {
        type: 'lower_third',
        text: 'NEXT-GENERATION SILICON',
        subtext: 'Up to 3.5x Faster Neural Engine',
        position: { x: 440, y: -360 },
        textSettings: {
          fontSize: 24,
          color: '#ffffff',
          backgroundColor: 'rgba(109, 40, 217, 0.85)',
          bold: true,
          textAlign: 'center',
          animation: { in: 'slideDown', out: 'fadeOut', inDuration: 0.6, outDuration: 0.4 },
        },
      },
    ],
  },

  {
    id: 'podcast_dual_interview',
    name: 'Studio Podcast (Dual Dialogue)',
    category: 'split',
    categoryLabel: 'Podcast & Interview',
    description: 'Two balanced studio frames side-by-side: Host on left, Guest on right with active microphone glow.',
    badge: '16:9',
    accentColor: '#10b981',
    defaultDuration: 7,
    previewType: 'podcast_dual',
    aRoll: {
      label: 'Host Camera (Left)',
      transform: { x: -480, y: -15, scale: 90, rotation: 0 },
    },
    bRoll: {
      label: 'Guest Camera / Co-Host (Right)',
      transform: { x: 480, y: -15, scale: 90, rotation: 0 },
    },
    graphics: [
      {
        type: 'badge',
        text: '🎙️ HOST // STUDIO 1',
        position: { x: -480, y: 360 },
        textSettings: {
          fontSize: 18,
          color: '#a7f3d0',
          backgroundColor: 'rgba(6, 78, 59, 0.9)',
          bold: true,
          textAlign: 'center',
        },
      },
      {
        type: 'badge',
        text: '🎙️ SPECIAL GUEST',
        position: { x: 480, y: 360 },
        textSettings: {
          fontSize: 18,
          color: '#a7f3d0',
          backgroundColor: 'rgba(6, 78, 59, 0.9)',
          bold: true,
          textAlign: 'center',
        },
      },
      {
        type: 'topic_pill',
        text: 'EPISODE 42 • THE FUTURE OF AI CREATIVITY',
        position: { x: 0, y: -450 },
        textSettings: {
          fontSize: 20,
          color: '#ffffff',
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          bold: true,
          textAlign: 'center',
        },
      },
    ],
  },

  {
    id: 'shorts_vertical_stack',
    name: 'Vertical Viral Reel (9:16 Stack)',
    category: 'shorts',
    categoryLabel: 'Shorts & Reels',
    description: 'Optimized 9:16 vertical layout. Top half shows B-roll action/demo; bottom half shows talking head presenter.',
    badge: '9:16',
    accentColor: '#ec4899',
    defaultDuration: 6,
    previewType: 'shorts_vertical',
    bRoll: {
      label: 'Top Showcase (B-Roll)',
      transform: { x: 0, y: -460, scale: 96, rotation: 0 },
      animations: {
        'transform.scale': [
          { time: 0, value: 96, easing: 'linear' },
          { time: 6, value: 104 },
        ],
      },
    },
    aRoll: {
      label: 'Bottom Presenter (A-Roll)',
      transform: { x: 0, y: 460, scale: 96, rotation: 0 },
    },
    graphics: [
      {
        type: 'split_divider',
        text: '⚡ WAIT TILL THE END ⚡',
        position: { x: 0, y: 0 },
        textSettings: {
          fontSize: 24,
          color: '#ffffff',
          backgroundColor: 'rgba(219, 39, 119, 0.9)',
          bold: true,
          textAlign: 'center',
          animation: { in: 'zoom', out: 'fadeOut', inDuration: 0.3, outDuration: 0.3 },
        },
      },
    ],
  },

  {
    id: 'cinematic_l_cut_cutaway',
    name: 'Cinematic L-Cut Cutaway',
    category: 'cinematic',
    categoryLabel: 'Cinematic Cutaway',
    description: 'Centered 16:9 cinematic B-roll window with frosted ambient background, while A-roll audio continues.',
    badge: '16:9',
    accentColor: '#d97706',
    defaultDuration: 7,
    previewType: 'cinematic_cutaway',
    aRoll: {
      label: 'Speaker Audio / Base Track',
      transform: { x: 0, y: 0, scale: 100, rotation: 0 },
      opacity: 0.3,
      colorFilters: { blur: 15, vignette: 40 },
    },
    bRoll: {
      label: 'Centered Cinematic B-Roll',
      transform: { x: 0, y: -10, scale: 80, rotation: 0 },
      animations: {
        'transform.scale': [
          { time: 0, value: 76, easing: 'easeOut' },
          { time: 7, value: 84 },
        ],
        opacity: [
          { time: 0, value: 0, easing: 'easeOut' },
          { time: 0.7, value: 1 },
        ],
      },
    },
    graphics: [
      {
        type: 'lower_third',
        text: 'ON LOCATION: ICELANDIC HIGHLANDS',
        subtext: 'Shot on 35mm Anamorphic Cinema Lens',
        position: { x: 0, y: 360 },
        textSettings: {
          fontSize: 22,
          color: '#fef3c7',
          backgroundColor: 'rgba(20, 20, 24, 0.85)',
          bold: true,
          textAlign: 'center',
          animation: { in: 'slideUp', out: 'fadeOut', inDuration: 0.6, outDuration: 0.4 },
        },
      },
    ],
  },

  {
    id: 'minimalist_studio_frame',
    name: 'Minimal Studio (Framed Duo)',
    category: 'editorial',
    categoryLabel: 'Editorial & Vox',
    description: 'Sophisticated charcoal studio backdrop with dual framed cards, step badge indicator, and clean progress bar.',
    badge: '16:9',
    accentColor: '#6366f1',
    defaultDuration: 6,
    previewType: 'minimalist_studio',
    aRoll: {
      label: 'Instructor Host (Left)',
      transform: { x: -470, y: 10, scale: 88, rotation: 0 },
    },
    bRoll: {
      label: 'Architecture Diagram / Slide (Right)',
      transform: { x: 470, y: 10, scale: 88, rotation: 0 },
      animations: {
        'transform.scale': [
          { time: 0, value: 88, easing: 'easeOut' },
          { time: 6, value: 94 },
        ],
      },
    },
    graphics: [
      {
        type: 'chapter_card',
        text: 'STEP 01 • SYSTEM ARCHITECTURE',
        position: { x: 0, y: -440 },
        textSettings: {
          fontSize: 20,
          color: '#ffffff',
          backgroundColor: 'rgba(79, 70, 229, 0.9)',
          bold: true,
          textAlign: 'center',
        },
      },
    ],
  },

  {
    id: 'tech_review_breakdown',
    name: 'Tech Review Pro (Device Center)',
    category: 'keynote',
    categoryLabel: 'Tech Review & Specs',
    description: 'Dominant B-Roll product demonstration in the center with compact A-Roll facecam in the top-left.',
    badge: '16:9',
    accentColor: '#0ea5e9',
    defaultDuration: 8,
    previewType: 'tech_review',
    aRoll: {
      label: 'Reviewer Facecam (Top-Left)',
      transform: { x: -680, y: -340, scale: 28, rotation: 0 },
      mask: {
        enabled: true,
        type: 'rectangle',
        x: 50,
        y: 50,
        width: 100,
        height: 100,
        points: [],
        feather: 0,
        invert: false,
      },
    },
    bRoll: {
      label: 'Product Showcase / Benchmark (Center)',
      transform: { x: 80, y: 0, scale: 88, rotation: 0 },
      animations: {
        'transform.scale': [
          { time: 0, value: 85, easing: 'easeOut' },
          { time: 8, value: 93 },
        ],
      },
    },
    graphics: [
      {
        type: 'lower_third',
        text: 'BENCHMARK: 120 FPS ULTRA SETTINGS',
        subtext: '4K Thermal Dissipation & Power Efficiency',
        position: { x: 80, y: 400 },
        textSettings: {
          fontSize: 20,
          color: '#e0f2fe',
          backgroundColor: 'rgba(12, 74, 110, 0.9)',
          bold: true,
          textAlign: 'center',
          animation: { in: 'slideUp', out: 'fadeOut', inDuration: 0.5, outDuration: 0.4 },
        },
      },
    ],
  },
];

/**
 * Generate high-res aesthetic SVG data-URL for placeholder A-roll or B-roll clips
 */
export function generatePlaceholderSvg(
  type: 'a-roll' | 'b-roll',
  title: string,
  subtitle: string = '1080p Full HD Video Stream'
): string {
  const isA = type === 'a-roll';
  const accent = isA ? '#818cf8' : '#38bdf8';
  const bg1 = isA ? '#181822' : '#0f172a';
  const bg2 = isA ? '#2a2744' : '#1e293b';
  const badgeText = isA ? 'A-ROLL • TALKING HEAD' : 'B-ROLL • SHOWCASE FOOTAGE';
  const badgeBg = isA ? 'rgba(99, 102, 241, 0.25)' : 'rgba(14, 165, 233, 0.25)';
  const badgeBorder = isA ? '#818cf8' : '#38bdf8';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${bg1}"/>
      <stop offset="100%" stop-color="${bg2}"/>
    </linearGradient>
    <pattern id="gridPattern" width="60" height="60" patternUnits="userSpaceOnUse">
      <path d="M 60 0 L 0 0 0 60" fill="none" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="100%" height="100%" fill="url(#bgGrad)"/>
  <rect width="100%" height="100%" fill="url(#gridPattern)"/>
  <!-- Framing Border -->
  <rect x="50" y="50" width="1820" height="980" rx="20" fill="none" stroke="${accent}" stroke-opacity="0.25" stroke-width="2"/>
  
  <g transform="translate(960, 520)">
    <!-- Category Badge -->
    <rect x="-200" y="-140" width="400" height="46" rx="23" fill="${badgeBg}" stroke="${badgeBorder}" stroke-width="2"/>
    <text x="0" y="-110" fill="#ffffff" font-family="system-ui, -apple-system, sans-serif" font-size="20" font-weight="700" text-anchor="middle" letter-spacing="2">${badgeText}</text>
    
    <!-- Title -->
    <text x="0" y="0" fill="#ffffff" font-family="system-ui, -apple-system, sans-serif" font-size="60" font-weight="800" text-anchor="middle">${title}</text>
    
    <!-- Subtitle -->
    <text x="0" y="65" fill="#94a3b8" font-family="system-ui, -apple-system, sans-serif" font-size="26" font-weight="500" text-anchor="middle">${subtitle}</text>
  </g>
  
  <!-- Corner Tech Markers -->
  <path d="M 70 110 L 70 70 L 110 70" stroke="${accent}" stroke-width="4" fill="none"/>
  <path d="M 1850 110 L 1850 70 L 1810 70" stroke="${accent}" stroke-width="4" fill="none"/>
  <path d="M 70 970 L 70 1010 L 110 1010" stroke="${accent}" stroke-width="4" fill="none"/>
  <path d="M 1850 970 L 1850 1010 L 1810 1010" stroke="${accent}" stroke-width="4" fill="none"/>
</svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export interface ApplyPresentationOptions {
  template: PresentationTemplate;
  startTime?: number;
  aRollMediaId?: string;
  bRollMediaId?: string;
  speakerName?: string;
  topicTitle?: string;
}

/**
 * Apply or Insert an A-Roll & B-Roll presentation template into the timeline
 */
export function applyPresentationTemplate(options: ApplyPresentationOptions) {
  const state = useEditorStore.getState();
  const { template } = options;
  const insertTime = options.startTime ?? state.currentTime;

  // 1. Resolve or Create A-Roll media
  let resolvedARollId = options.aRollMediaId;
  if (!resolvedARollId) {
    const existingVideo = state.mediaLibrary.find((m) => m.type === 'video' || m.type === 'image');
    if (existingVideo) {
      resolvedARollId = existingVideo.id;
    } else {
      const phId = `media_aroll_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      const svgUrl = generatePlaceholderSvg(
        'a-roll',
        options.speakerName || 'Host Speaker (A-Roll)',
        'Primary Talking Head / Interview Stream'
      );
      state.addMedia({
        id: phId,
        name: `A-Roll: ${options.speakerName || 'Host Speaker'}`,
        type: 'image',
        duration: template.defaultDuration,
        url: svgUrl,
        createdAt: Date.now(),
        width: 1920,
        height: 1080,
      });
      resolvedARollId = phId;
    }
  }

  // 2. Resolve or Create B-Roll media
  let resolvedBRollId = options.bRollMediaId;
  if (!resolvedBRollId) {
    const videos = state.mediaLibrary.filter((m) => m.type === 'video' || m.type === 'image');
    if (videos.length >= 2 && videos[1].id !== resolvedARollId) {
      resolvedBRollId = videos[1].id;
    } else if (videos.length >= 1 && videos[0].id !== resolvedARollId) {
      resolvedBRollId = videos[0].id;
    } else {
      const phId = `media_broll_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      const svgUrl = generatePlaceholderSvg(
        'b-roll',
        options.topicTitle || 'Showcase Footage (B-Roll)',
        'Context Visual / Demo / Cutaway Stream'
      );
      state.addMedia({
        id: phId,
        name: `B-Roll: ${options.topicTitle || 'Showcase Demo'}`,
        type: 'image',
        duration: template.defaultDuration,
        url: svgUrl,
        createdAt: Date.now(),
        width: 1920,
        height: 1080,
      });
      resolvedBRollId = phId;
    }
  }

  // 3. Ensure multi-track video structure
  let currentTracks = state.tracks;
  let videoTracks = currentTracks.filter((t) => t.type === 'video');

  while (videoTracks.length < 2) {
    state.addTrack('video');
    currentTracks = useEditorStore.getState().tracks;
    videoTracks = currentTracks.filter((t) => t.type === 'video');
  }

  // Track 1 (Base): typically A-Roll or background
  const track1 = videoTracks[0];
  // Track 2 (Overlay/Split): typically B-Roll or floating cam
  const track2 = videoTracks[1];

  // Text Track for graphics/lower-thirds
  let textTrack = currentTracks.find((t) => t.type === 'text');
  if (!textTrack) {
    state.addTrack('text');
    currentTracks = useEditorStore.getState().tracks;
    textTrack = currentTracks.find((t) => t.type === 'text');
  }

  const duration = template.defaultDuration;

  // 4. Create A-Roll Clip
  const aClipId = `clip_aroll_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const aClip: TimelineClip = {
    id: aClipId,
    name: `A-Roll • ${template.aRoll.label}`,
    mediaId: resolvedARollId,
    trackId: track1.id,
    startTime: insertTime,
    duration,
    trimStart: 0,
    trimEnd: 0,
    transform: { ...template.aRoll.transform },
    crop: template.aRoll.crop ? { ...template.aRoll.crop } : undefined,
    mask: template.aRoll.mask ? { ...template.aRoll.mask } : undefined,
    animations: template.aRoll.animations
      ? JSON.parse(JSON.stringify(template.aRoll.animations))
      : undefined,
    colorFilters: template.aRoll.colorFilters
      ? { ...template.aRoll.colorFilters }
      : undefined,
    opacity: template.aRoll.opacity ?? 1,
    speed: 1,
    effects: [],
    zIndex: 1,
  };

  // 5. Create B-Roll Clip
  const bClipId = `clip_broll_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const bClip: TimelineClip = {
    id: bClipId,
    name: `B-Roll • ${template.bRoll.label}`,
    mediaId: resolvedBRollId,
    trackId: track2.id,
    startTime: insertTime,
    duration,
    trimStart: 0,
    trimEnd: 0,
    transform: { ...template.bRoll.transform },
    crop: template.bRoll.crop ? { ...template.bRoll.crop } : undefined,
    mask: template.bRoll.mask ? { ...template.bRoll.mask } : undefined,
    animations: template.bRoll.animations
      ? JSON.parse(JSON.stringify(template.bRoll.animations))
      : undefined,
    colorFilters: template.bRoll.colorFilters
      ? { ...template.bRoll.colorFilters }
      : undefined,
    opacity: template.bRoll.opacity ?? 1,
    speed: 1,
    effects: [],
    zIndex: 2,
  };

  state.addClip(aClip);
  state.addClip(bClip);

  // 6. Add Graphics / Lower Thirds if present
  if (template.graphics && textTrack) {
    template.graphics.forEach((g, idx) => {
      const gMediaId = `tmpl_g_media_${Date.now()}_${idx}`;
      const gClipId = `tmpl_g_clip_${Date.now()}_${idx}`;
      const textContent =
        g.type === 'badge'
          ? options.speakerName || g.text
          : options.topicTitle || g.text;

      state.addMedia({
        id: gMediaId,
        name: textContent,
        type: 'text',
        duration,
        url: '',
        createdAt: Date.now(),
      });

      const gClip: TimelineClip = {
        id: gClipId,
        name: `Graphic • ${textContent}`,
        mediaId: gMediaId,
        trackId: textTrack!.id,
        startTime: insertTime,
        duration,
        trimStart: 0,
        trimEnd: 0,
        transform: {
          x: g.position?.x ?? 0,
          y: g.position?.y ?? 0,
          scale: 100,
          rotation: 0,
        },
        opacity: 1,
        speed: 1,
        effects: [],
        textSettings: {
          text: textContent,
          fontFamily: g.textSettings?.fontFamily || 'Inter',
          fontSize: g.textSettings?.fontSize || 22,
          color: g.textSettings?.color || '#ffffff',
          backgroundColor: g.textSettings?.backgroundColor || 'rgba(15, 23, 42, 0.85)',
          bold: g.textSettings?.bold ?? true,
          textAlign: g.textSettings?.textAlign || 'center',
          animation: g.textSettings?.animation as any,
          italic: false,
          underline: false,
          shadow: true,
        },
        animations: g.animations ? JSON.parse(JSON.stringify(g.animations)) : undefined,
      } as any;

      state.addClip(gClip);
    });
  }

  state.selectClip(aClipId);
  state.saveSnapshot(`Apply ${template.name} Presentation Template`);
  toast.success(`Applied "${template.name}" presentation layout to timeline!`);
}

/**
 * Format selected timeline clips to match a presentation template
 */
export function formatClipsToPresentation(
  template: PresentationTemplate,
  aRollClipId: string,
  bRollClipId?: string
) {
  const state = useEditorStore.getState();

  // Format A-Roll clip
  state.updateClip(aRollClipId, {
    transform: { ...template.aRoll.transform },
    crop: template.aRoll.crop ? { ...template.aRoll.crop } : undefined,
    mask: template.aRoll.mask ? { ...template.aRoll.mask } : undefined,
    animations: template.aRoll.animations
      ? JSON.parse(JSON.stringify(template.aRoll.animations))
      : undefined,
  });

  // If a second clip is provided, format it as B-roll
  if (bRollClipId) {
    state.updateClip(bRollClipId, {
      transform: { ...template.bRoll.transform },
      crop: template.bRoll.crop ? { ...template.bRoll.crop } : undefined,
      mask: template.bRoll.mask ? { ...template.bRoll.mask } : undefined,
      animations: template.bRoll.animations
        ? JSON.parse(JSON.stringify(template.bRoll.animations))
        : undefined,
    });
  }

  state.saveSnapshot(`Format Clips as ${template.name}`);
  toast.success(`Formatted selected clips to "${template.name}" presentation layout!`);
}

/**
 * Render fluid interactive canvas simulation for each presentation template card
 */
export function renderPresentationCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  progress: number,
  template: PresentationTemplate
) {
  ctx.clearRect(0, 0, width, height);

  // Background
  ctx.fillStyle = '#0f1117';
  ctx.fillRect(0, 0, width, height);

  // Subtle grid
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.lineWidth = 1;
  const gridSize = 16;
  for (let x = 0; x < width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  const pType = template.previewType;
  const accent = template.accentColor;

  if (pType === 'split_50_50' || pType === 'podcast_dual' || pType === 'minimalist_studio') {
    const pad = 4;
    const halfW = (width - pad * 3) / 2;
    const cardH = height - pad * 2;

    // Left card (A-Roll)
    ctx.save();
    ctx.fillStyle = '#1e1b4b';
    ctx.strokeStyle = '#4338ca';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(pad, pad, halfW, cardH, 4);
    ctx.fill();
    ctx.stroke();

    // A-Roll avatar / speaker silhouette
    const aCx = pad + halfW / 2;
    const aCy = pad + cardH / 2 - 4;
    ctx.fillStyle = '#818cf8';
    ctx.beginPath();
    ctx.arc(aCx, aCy - 6, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(aCx, aCy + 10, 12, 7, 0, 0, Math.PI, false);
    ctx.fill();

    // Waveform indicator on A-roll
    const waveY = pad + cardH - 10;
    ctx.fillStyle = '#a5b4fc';
    const bars = 5;
    for (let i = 0; i < bars; i++) {
      const bh = 2 + Math.abs(Math.sin((progress * 8) + i)) * 6;
      ctx.fillRect(aCx - 10 + i * 5, waveY - bh / 2, 2.5, bh);
    }
    ctx.restore();

    // Right card (B-Roll)
    ctx.save();
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(pad * 2 + halfW, pad, halfW, cardH, 4);
    ctx.fill();
    ctx.stroke();

    // B-Roll presentation slide / mockup
    const bCx = pad * 2 + halfW + halfW / 2;
    const bCy = pad + cardH / 2;
    const bScale = 1 + (progress % 1) * 0.08;
    ctx.save();
    ctx.translate(bCx, bCy);
    ctx.scale(bScale, bScale);

    // Mini chart / diagram inside B-Roll
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-16, 6);
    ctx.lineTo(-8, -2);
    ctx.lineTo(2, 2);
    ctx.lineTo(12, -8);
    ctx.stroke();

    // B-roll tag
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(-16, -14, 18, 4);
    ctx.restore();

    // Center divider glow
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.moveTo(pad * 1.5 + halfW, pad + 2);
    ctx.lineTo(pad * 1.5 + halfW, height - pad - 2);
    ctx.stroke();
    ctx.restore();
  } else if (pType === 'pip_bottom_right' || pType === 'pip_circle') {
    // Fullscreen B-Roll
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(2, 2, width - 4, height - 4);

    // Presentation content lines
    ctx.fillStyle = '#475569';
    ctx.fillRect(10, 10, width * 0.45, 6);
    ctx.fillStyle = '#334155';
    ctx.fillRect(10, 20, width * 0.35, 4);
    ctx.fillRect(10, 28, width * 0.5, 4);

    // Floating A-Roll Cam
    if (pType === 'pip_bottom_right') {
      const pipW = width * 0.34;
      const pipH = height * 0.38;
      const pipX = width - pipW - 6;
      const pipY = height - pipH - 6 - Math.sin(progress * Math.PI * 2) * 2;

      // Glow / Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.beginPath();
      ctx.roundRect(pipX + 2, pipY + 2, pipW, pipH, 4);
      ctx.fill();

      // Card
      ctx.fillStyle = '#1e1b4b';
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(pipX, pipY, pipW, pipH, 4);
      ctx.fill();
      ctx.stroke();

      // Speaker avatar
      ctx.fillStyle = '#818cf8';
      ctx.beginPath();
      ctx.arc(pipX + pipW / 2, pipY + pipH / 2 - 3, 5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Circle Facecam
      const radius = height * 0.22;
      const cx = radius + 8;
      const cy = height - radius - 8;

      ctx.save();
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2;
      ctx.fillStyle = '#1e1b4b';
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Speaker icon
      ctx.fillStyle = '#22d3ee';
      ctx.beginPath();
      ctx.arc(cx, cy - 2, radius * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  } else if (pType === 'editorial_70_30') {
    // Left 70% B-Roll
    const splitX = width * 0.68;
    ctx.fillStyle = '#18181b';
    ctx.fillRect(2, 2, splitX - 3, height - 4);

    // Archival lines
    ctx.fillStyle = '#27272a';
    ctx.fillRect(8, 12, splitX - 20, 8);
    ctx.fillRect(8, 26, splitX - 30, 4);
    ctx.fillRect(8, 34, splitX - 24, 4);

    // Right 30% A-Roll
    ctx.fillStyle = '#2e1065';
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(splitX + 2, 2, width - splitX - 4, height - 4, 3);
    ctx.fill();
    ctx.stroke();

    const aX = splitX + (width - splitX) / 2;
    ctx.fillStyle = '#a855f7';
    ctx.beginPath();
    ctx.arc(aX, height / 2 - 4, 6, 0, Math.PI * 2);
    ctx.fill();
  } else if (pType === 'keynote_float') {
    // Presenter on Left
    ctx.fillStyle = '#312e81';
    ctx.beginPath();
    ctx.arc(width * 0.25, height * 0.35, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(width * 0.25, height * 0.7, 16, 12, 0, 0, Math.PI, false);
    ctx.fill();

    // Floating Card on Right
    const floatOffset = Math.sin(progress * Math.PI * 2) * 3;
    const cardW = width * 0.52;
    const cardH = height * 0.68;
    const cardX = width * 0.44;
    const cardY = height * 0.16 + floatOffset;

    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, 6);
    ctx.fill();
    ctx.stroke();

    // Slide content
    ctx.fillStyle = accent;
    ctx.fillRect(cardX + 8, cardY + 8, cardW * 0.5, 4);
    ctx.fillStyle = '#64748b';
    ctx.fillRect(cardX + 8, cardY + 16, cardW * 0.7, 3);
    ctx.restore();
  } else if (pType === 'shorts_vertical') {
    // Top 50% B-roll
    const midY = height / 2;
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(2, 2, width - 4, midY - 3);

    // Bottom 50% A-roll
    ctx.fillStyle = '#312e81';
    ctx.fillRect(2, midY + 1, width - 4, midY - 3);

    // Speaker avatar
    ctx.fillStyle = '#a5b4fc';
    ctx.beginPath();
    ctx.arc(width / 2, midY + midY / 2 - 2, 7, 0, Math.PI * 2);
    ctx.fill();

    // Divider accent pill
    ctx.fillStyle = accent;
    ctx.fillRect(width * 0.2, midY - 2, width * 0.6, 4);
  } else if (pType === 'cinematic_cutaway') {
    // Blurred backdrop
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, width, height);

    // Center framed B-Roll
    const cW = width * 0.78;
    const cH = height * 0.68;
    const cX = (width - cW) / 2;
    const cY = (height - cH) / 2;

    ctx.save();
    ctx.fillStyle = '#1f2937';
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(cX, cY, cW, cH, 4);
    ctx.fill();
    ctx.stroke();

    // Cinematic letterbox lines
    ctx.fillStyle = '#000000';
    ctx.fillRect(cX, cY, cW, 3);
    ctx.fillRect(cX, cY + cH - 3, cW, 3);
    ctx.restore();
  } else {
    // Tech Review / Generic Fallback
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(2, 2, width - 4, height - 4);

    // Center Device Mockup
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(width * 0.35, height * 0.2, width * 0.35, height * 0.6);

    // Mini Facecam Top Left
    ctx.fillStyle = '#312e81';
    ctx.strokeStyle = '#818cf8';
    ctx.lineWidth = 1;
    ctx.fillRect(6, 6, width * 0.25, height * 0.32);
    ctx.strokeRect(6, 6, width * 0.25, height * 0.32);
  }
}
