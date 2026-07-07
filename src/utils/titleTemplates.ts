/**
 * titleTemplates.ts — Pre-built animated title card / lower-third templates.
 *
 * Each template produces a complete TimelineClip payload (textSettings + animations)
 * ready to be added to a text track. Templates are data-driven — no code changes
 * needed to add new ones.
 */

import type { ClipTextSettings, ClipAnimations } from '@/types';

export interface TitleTemplate {
  id: string;
  name: string;
  category: 'lower-third' | 'title' | 'subtitle' | 'kinetic' | 'social';
  description: string;
  accentColor: string;         // CSS color for preview card accent
  defaultDuration: number;     // seconds
  textSettings: ClipTextSettings;
  animations?: ClipAnimations;
  animationPreset?: 'subscribe' | 'typewriter' | 'bounce';
}

// ── Template Definitions ──────────────────────────────────────────────────────

export const TITLE_TEMPLATES: TitleTemplate[] = [
  // ── Existing Core Templates (1-10) ───────────────────────────────────────────
  {
    id: 'kinetic_typewriter',
    name: 'Typewriter',
    category: 'kinetic',
    description: 'Types out text letter by letter',
    accentColor: '#34d399',
    defaultDuration: 5,
    textSettings: {
      text: 'Typewriter Effect...',
      fontSize: 80,
      fontFamily: 'Courier New',
      color: '#ffffff',
      textAlign: 'center',
      bold: true,
      backgroundColor: 'transparent',
      italic: false,
      underline: false,
      shadow: false,
      threeD: false,
      animationPreset: 'typewriter'
    },
    animations: {},
  },
  {
    id: 'kinetic_bounce',
    name: 'Scale Bounce',
    category: 'kinetic',
    description: 'Bounces in dynamically',
    accentColor: '#fbbf24',
    defaultDuration: 3,
    textSettings: {
      text: 'BOUNCE!',
      fontSize: 120,
      fontFamily: 'Inter',
      color: '#fbbf24',
      textAlign: 'center',
      bold: true,
      shadow: true,
      backgroundColor: 'transparent',
      italic: false,
      underline: false,
      threeD: false,
      animationPreset: 'bounce'
    },
    animations: {},
  },
  {
    id: 'lower_third_classic',
    name: 'Classic Lower Third',
    category: 'lower-third',
    description: 'Slides up from below, holds, slides out',
    accentColor: '#3b82f6',
    defaultDuration: 4,
    textSettings: {
      text: 'John Doe\nTitle / Role',
      fontFamily: 'Inter',
      fontSize: 32,
      color: '#ffffff',
      backgroundColor: 'rgba(0,0,0,0.75)',
      bold: true,
      italic: false,
      underline: false,
      shadow: false,
      shadowColor: '#000000',
      shadowBlur: 4,
      threeD: false,
      threeDDepth: 4,
      textAlign: 'left',
      animation: {
        in: 'slideUp',
        out: 'slideDown',
        inDuration: 0.4,
        outDuration: 0.4,
      },
    },
    animations: {
      'transform.y': [
        { time: 0, value: 150, easing: 'ease-out' },
        { time: 0.4, value: 100, easing: 'linear' },
        { time: 3.6, value: 100, easing: 'ease-in' },
        { time: 4, value: 150 },
      ],
      opacity: [
        { time: 0, value: 0, easing: 'ease-out' },
        { time: 0.3, value: 1, easing: 'linear' },
        { time: 3.7, value: 1, easing: 'ease-in' },
        { time: 4, value: 0 },
      ],
    },
  },
  {
    id: 'cinematic_title',
    name: 'Cinematic Title',
    category: 'title',
    description: 'Fade-in with subtle scale, large bold centred',
    accentColor: '#f59e0b',
    defaultDuration: 5,
    textSettings: {
      text: 'TITLE CARD',
      fontFamily: 'Montserrat',
      fontSize: 72,
      color: '#ffffff',
      backgroundColor: 'transparent',
      bold: true,
      italic: false,
      underline: false,
      shadow: true,
      shadowColor: '#000000',
      shadowBlur: 20,
      threeD: false,
      threeDDepth: 4,
      textAlign: 'center',
      strokeColor: 'rgba(255,255,255,0.2)',
      strokeWidth: 1,
      animation: {
        in: 'fadeIn',
        out: 'fadeOut',
        inDuration: 0.8,
        outDuration: 0.8,
      },
    },
    animations: {
      opacity: [
        { time: 0, value: 0, easing: 'ease-out' },
        { time: 0.8, value: 1, easing: 'linear' },
        { time: 4.2, value: 1, easing: 'ease-in' },
        { time: 5, value: 0 },
      ],
      'transform.scale': [
        { time: 0, value: 90, easing: 'ease-out' },
        { time: 0.8, value: 100 },
      ],
    },
  },
  {
    id: 'subtitle_bar',
    name: 'Subtitle Bar',
    category: 'subtitle',
    description: 'Semi-transparent bottom bar with clean caption text',
    accentColor: '#10b981',
    defaultDuration: 3,
    textSettings: {
      text: 'Subtitle text goes here',
      fontFamily: 'Open Sans',
      fontSize: 28,
      color: '#ffffff',
      backgroundColor: 'rgba(0,0,0,0.6)',
      bold: false,
      italic: false,
      underline: false,
      shadow: false,
      shadowColor: '#000000',
      shadowBlur: 0,
      threeD: false,
      threeDDepth: 4,
      textAlign: 'center',
      animationPreset: 'subscribe',
      animation: {
        in: 'fadeIn',
        out: 'fadeOut',
        inDuration: 0.2,
        outDuration: 0.2,
      },
    },
    animations: {
      opacity: [
        { time: 0, value: 0, easing: 'ease-out' },
        { time: 0.2, value: 1, easing: 'linear' },
        { time: 2.8, value: 1, easing: 'ease-in' },
        { time: 3, value: 0 },
      ],
    },
  },
  {
    id: 'kinetic_pop',
    name: 'Kinetic Pop',
    category: 'kinetic',
    description: 'Bouncy scale + opacity punch-in',
    accentColor: '#ec4899',
    defaultDuration: 2.5,
    textSettings: {
      text: 'WOW!',
      fontFamily: 'Bebas Neue',
      fontSize: 96,
      color: '#ffffff',
      backgroundColor: 'transparent',
      bold: false,
      italic: false,
      underline: false,
      shadow: true,
      shadowColor: '#ec4899',
      shadowBlur: 24,
      threeD: false,
      threeDDepth: 4,
      textAlign: 'center',
      animation: {
        in: 'zoom',
        out: 'fadeOut',
        inDuration: 0.3,
        outDuration: 0.4,
      },
    },
    animations: {
      'transform.scale': [
        { time: 0,    value: 0,   easing: 'ease-out' },
        { time: 0.15, value: 125, easing: 'ease-in'  },
        { time: 0.3,  value: 100, easing: 'linear'   },
        { time: 2.1,  value: 100, easing: 'ease-in'  },
        { time: 2.5,  value: 80                       },
      ],
      opacity: [
        { time: 0,   value: 0, easing: 'ease-out' },
        { time: 0.1, value: 1, easing: 'linear'   },
        { time: 2.1, value: 1, easing: 'ease-in'  },
        { time: 2.5, value: 0                      },
      ],
    },
  },
  {
    id: 'news_ticker',
    name: 'News Ticker',
    category: 'lower-third',
    description: 'Horizontal scroll from right to left',
    accentColor: '#ef4444',
    defaultDuration: 6,
    textSettings: {
      text: 'BREAKING NEWS  ●  Latest updates on the story',
      fontFamily: 'Oswald',
      fontSize: 24,
      color: '#ffffff',
      backgroundColor: 'rgba(220,38,38,0.95)',
      bold: false,
      italic: false,
      underline: false,
      shadow: false,
      shadowColor: '#000000',
      shadowBlur: 0,
      threeD: false,
      threeDDepth: 4,
      textAlign: 'left',
      animation: {
        in: 'slideRight',
        out: 'slideLeft',
        inDuration: 0.5,
        outDuration: 0.5,
      },
    },
    animations: {
      'transform.x': [
        { time: 0, value: 500,  easing: 'linear' },
        { time: 6, value: -500, easing: 'linear' },
      ],
      opacity: [
        { time: 0, value: 1 },
      ],
    },
  },
  {
    id: 'credits_roll',
    name: 'Credits Roll',
    category: 'title',
    description: 'Slow upward scroll for end credits',
    accentColor: '#8b5cf6',
    defaultDuration: 8,
    textSettings: {
      text: 'Director\nJane Smith\n\nProducer\nJohn Doe\n\nMusic\nOriginal Soundtrack',
      fontFamily: 'Lato',
      fontSize: 28,
      color: '#e2e8f0',
      backgroundColor: 'transparent',
      bold: false,
      italic: false,
      underline: false,
      shadow: false,
      shadowColor: '#000000',
      shadowBlur: 0,
      threeD: false,
      threeDDepth: 4,
      textAlign: 'center',
      animation: {
        in: 'fadeIn',
        out: 'fadeOut',
        inDuration: 1,
        outDuration: 1,
      },
    },
    animations: {
      'transform.y': [
        { time: 0, value: 300,  easing: 'linear' },
        { time: 8, value: -300, easing: 'linear' },
      ],
      opacity: [
        { time: 0, value: 0, easing: 'ease-out' },
        { time: 1, value: 1, easing: 'linear'   },
        { time: 7, value: 1, easing: 'ease-in'  },
        { time: 8, value: 0 },
      ],
    },
  },
  {
    id: 'subscribe_bell',
    name: 'Subscribe & Bell',
    category: 'social',
    description: 'YouTube subscribe animation with bell',
    accentColor: '#ff0000',
    defaultDuration: 5,
    textSettings: {
      text: 'SUBSCRIBE  🔔',
      fontFamily: 'Roboto',
      fontSize: 48,
      color: '#ffffff',
      backgroundColor: '#ff0000',
      bold: true,
      italic: false,
      underline: false,
      shadow: true,
      shadowColor: 'rgba(0,0,0,0.5)',
      shadowBlur: 10,
      threeD: false,
      textAlign: 'center',
      animation: {
        in: 'slideUp',
        out: 'slideDown',
        inDuration: 0.5,
        outDuration: 0.5,
      },
    },
    animations: {
      'transform.y': [
        { time: 0, value: 200, easing: 'ease-out' },
        { time: 0.5, value: 0, easing: 'linear' },
        { time: 4.5, value: 0, easing: 'ease-in' },
        { time: 5, value: 200 },
      ],
      'transform.scale': [
        { time: 0.5, value: 100 },
        { time: 2.5, value: 100, easing: 'ease-out' },
        { time: 2.6, value: 110, easing: 'ease-in' },
        { time: 2.7, value: 100 },
      ],
    },
  },
  {
    id: 'progress_bar',
    name: 'Progress Bar',
    category: 'social',
    description: 'Thin progress bar at bottom of screen',
    accentColor: '#ff0000',
    defaultDuration: 10,
    textSettings: {
      text: ' ',
      fontFamily: 'Arial',
      fontSize: 8,
      color: 'transparent',
      backgroundColor: '#ff0000',
      bold: false,
      italic: false,
      underline: false,
      shadow: false,
      threeD: false,
      textAlign: 'center',
    },
    animations: {
      'transform.x': [
        { time: 0, value: -854, easing: 'linear' },
        { time: 10, value: 0, easing: 'linear' },
      ],
      'transform.y': [
        { time: 0, value: 235 },
      ],
      'transform.scale': [
        { time: 0, value: 100 },
      ]
    },
  },

  // ── Animated Titles (11-22) ───────────────────────────────────────────────────
  {
    id: 'title_modern_bold',
    name: 'Modern Bold',
    category: 'title',
    description: 'Impactful title card with yellow bar',
    accentColor: '#fbbf24',
    defaultDuration: 4.5,
    textSettings: {
      text: 'MODERN CAPTION',
      fontFamily: 'Impact',
      fontSize: 64,
      color: '#ffffff',
      backgroundColor: 'rgba(251,191,36,0.9)',
      bold: true,
      italic: false,
      underline: false,
      shadow: true,
      textAlign: 'center',
      animation: { in: 'slideRight', out: 'fadeOut', inDuration: 0.4, outDuration: 0.4 }
    },
    animations: {
      opacity: [
        { time: 0, value: 0 },
        { time: 0.4, value: 1 },
        { time: 4.1, value: 1 },
        { time: 4.5, value: 0 }
      ]
    }
  },
  {
    id: 'title_minimalist',
    name: 'Minimalist spaced',
    category: 'title',
    description: 'Ultra thin, clean and modern spacing',
    accentColor: '#38bdf8',
    defaultDuration: 4,
    textSettings: {
      text: 'M I N I M A L I S T',
      fontFamily: 'Inter',
      fontSize: 48,
      color: '#f8fafc',
      backgroundColor: 'transparent',
      bold: false,
      italic: false,
      underline: false,
      shadow: false,
      textAlign: 'center',
      animation: { in: 'fadeIn', out: 'fadeOut', inDuration: 0.6, outDuration: 0.6 }
    }
  },
  {
    id: 'title_elegant_gold',
    name: 'Elegant Gold',
    category: 'title',
    description: 'Golden serif font for high-end cinematic looks',
    accentColor: '#d4af37',
    defaultDuration: 5,
    textSettings: {
      text: 'GOLDEN MEMORIES',
      fontFamily: 'Times New Roman',
      fontSize: 56,
      color: '#d4af37',
      backgroundColor: 'transparent',
      bold: false,
      italic: true,
      underline: false,
      shadow: true,
      shadowColor: 'rgba(0,0,0,0.8)',
      shadowBlur: 15,
      textAlign: 'center'
    }
  },
  {
    id: 'title_retro_vhs',
    name: 'Retro VHS',
    category: 'title',
    description: 'Vintage 80s tape glitch card',
    accentColor: '#a855f7',
    defaultDuration: 4,
    textSettings: {
      text: 'PLAY  ▶  00:00:24',
      fontFamily: 'Courier New',
      fontSize: 40,
      color: '#22d3ee',
      backgroundColor: 'transparent',
      bold: true,
      italic: false,
      underline: false,
      shadow: true,
      shadowColor: '#ec4899',
      shadowBlur: 8,
      textAlign: 'left'
    }
  },
  {
    id: 'title_glitch_cyber',
    name: 'Glitch Cyberpunk',
    category: 'title',
    description: 'Neon cyan offset cyber title',
    accentColor: '#06b6d4',
    defaultDuration: 3.5,
    textSettings: {
      text: 'CYBERPUNK // 2026',
      fontFamily: 'Oswald',
      fontSize: 60,
      color: '#06b6d4',
      backgroundColor: 'transparent',
      bold: true,
      italic: false,
      underline: false,
      shadow: true,
      shadowColor: '#ef4444',
      shadowBlur: 16,
      textAlign: 'center'
    }
  },
  {
    id: 'title_double_line',
    name: 'Double Line',
    category: 'title',
    description: 'Title and subtitle dual line split',
    accentColor: '#6366f1',
    defaultDuration: 5,
    textSettings: {
      text: 'CHAPTER ONE\nThe Journey Begins',
      fontFamily: 'Montserrat',
      fontSize: 36,
      color: '#ffffff',
      backgroundColor: 'transparent',
      bold: true,
      italic: false,
      underline: false,
      shadow: true,
      textAlign: 'center'
    }
  },
  {
    id: 'title_chapter',
    name: 'Chapter Indicator',
    category: 'title',
    description: 'Compact banner for video chapters',
    accentColor: '#10b981',
    defaultDuration: 3,
    textSettings: {
      text: 'PART 01 : ARRIVAL',
      fontFamily: 'Inter',
      fontSize: 24,
      color: '#10b981',
      backgroundColor: 'rgba(0,0,0,0.85)',
      bold: true,
      italic: false,
      underline: false,
      shadow: false,
      textAlign: 'center'
    }
  },
  {
    id: 'title_vertical',
    name: 'Left Vertical Margin',
    category: 'title',
    description: 'Vertical title aligned to left edge',
    accentColor: '#3b82f6',
    defaultDuration: 6,
    textSettings: {
      text: 'JOURNAL',
      fontFamily: 'Oswald',
      fontSize: 54,
      color: '#ffffff',
      backgroundColor: 'transparent',
      bold: true,
      italic: false,
      underline: false,
      shadow: false,
      textAlign: 'left'
    },
    animations: {
      'transform.x': [
        { time: 0, value: -250 }
      ]
    }
  },
  {
    id: 'title_sidebar',
    name: 'Sidebar Text Panel',
    category: 'title',
    description: 'Dark backdrop panel covering right third',
    accentColor: '#27272a',
    defaultDuration: 6,
    textSettings: {
      text: 'KEY DATA\n\n- Scale: 100%\n- Speed: 1.0x\n- FPS: 60',
      fontFamily: 'Courier New',
      fontSize: 28,
      color: '#38bdf8',
      backgroundColor: 'rgba(24,24,27,0.92)',
      bold: false,
      italic: false,
      underline: false,
      shadow: false,
      textAlign: 'left'
    },
    animations: {
      'transform.x': [
        { time: 0, value: 200 }
      ]
    }
  },
  {
    id: 'title_cinematic_zoom',
    name: 'Cinematic Slow Zoom',
    category: 'title',
    description: 'Title slowly scaling down over time',
    accentColor: '#d97706',
    defaultDuration: 7,
    textSettings: {
      text: 'SCENIC DISCOVERY',
      fontFamily: 'Georgia',
      fontSize: 60,
      color: '#fef3c7',
      backgroundColor: 'transparent',
      bold: false,
      italic: true,
      underline: false,
      shadow: true,
      textAlign: 'center'
    },
    animations: {
      'transform.scale': [
        { time: 0, value: 120, easing: 'linear' },
        { time: 7, value: 100 }
      ]
    }
  },
  {
    id: 'title_bottom_right',
    name: 'Bottom Right Tag',
    category: 'title',
    description: 'Small overlay tag in bottom right corner',
    accentColor: '#475569',
    defaultDuration: 4,
    textSettings: {
      text: 'Recorded in 4K',
      fontFamily: 'Inter',
      fontSize: 18,
      color: '#94a3b8',
      backgroundColor: 'rgba(30,41,59,0.7)',
      bold: false,
      italic: false,
      underline: false,
      shadow: false,
      textAlign: 'right'
    },
    animations: {
      'transform.x': [
        { time: 0, value: 250 }
      ],
      'transform.y': [
        { time: 0, value: 200 }
      ]
    }
  },
  {
    id: 'title_big_reveal',
    name: 'Big Reveal Banner',
    category: 'title',
    description: 'Full-width center banner transition',
    accentColor: '#f43f5e',
    defaultDuration: 3.5,
    textSettings: {
      text: 'STRIKING REVEAL',
      fontFamily: 'Bebas Neue',
      fontSize: 84,
      color: '#ffffff',
      backgroundColor: '#f43f5e',
      bold: true,
      italic: false,
      underline: false,
      shadow: true,
      textAlign: 'center'
    }
  },

  // ── Lower Thirds (23-32) ─────────────────────────────────────────────────────
  {
    id: 'lower_third_tech',
    name: 'Tech Style Pill',
    category: 'lower-third',
    description: 'Cyberpunk green terminal name card',
    accentColor: '#22c55e',
    defaultDuration: 4.5,
    textSettings: {
      text: '[ SYSTEM ANALYST ]\nSYS_OP: ROOT',
      fontFamily: 'Courier New',
      fontSize: 24,
      color: '#22c55e',
      backgroundColor: 'rgba(0,10,0,0.85)',
      bold: true,
      italic: false,
      underline: false,
      shadow: false,
      textAlign: 'left'
    },
    animations: {
      'transform.y': [{ time: 0, value: 160 }, { time: 0.4, value: 120 }, { time: 4.1, value: 120 }, { time: 4.5, value: 160 }],
      'transform.x': [{ time: 0, value: -120 }]
    }
  },
  {
    id: 'lower_third_minimal',
    name: 'Minimal Name',
    category: 'lower-third',
    description: 'Clean borderless double-line details',
    accentColor: '#f1f5f9',
    defaultDuration: 4,
    textSettings: {
      text: 'Jane Doe  |  Creative Lead',
      fontFamily: 'Inter',
      fontSize: 26,
      color: '#ffffff',
      backgroundColor: 'transparent',
      bold: true,
      italic: false,
      underline: false,
      shadow: true,
      textAlign: 'left'
    },
    animations: {
      'transform.y': [{ time: 0, value: 160 }, { time: 0.4, value: 130 }, { time: 3.6, value: 130 }, { time: 4, value: 160 }]
    }
  },
  {
    id: 'lower_third_pill',
    name: 'Rounded Pill Tag',
    category: 'lower-third',
    description: 'Fully rounded colorful banner',
    accentColor: '#a855f7',
    defaultDuration: 3.5,
    textSettings: {
      text: 'PRODUCER VIBES',
      fontFamily: 'Montserrat',
      fontSize: 20,
      color: '#ffffff',
      backgroundColor: '#a855f7',
      bold: true,
      italic: false,
      underline: false,
      shadow: false,
      textAlign: 'center'
    },
    animations: {
      'transform.y': [{ time: 0, value: 180 }, { time: 0.3, value: 140 }, { time: 3.2, value: 140 }, { time: 3.5, value: 180 }]
    }
  },
  {
    id: 'lower_third_corporate',
    name: 'Corporate Clean',
    category: 'lower-third',
    description: 'Double block dark blue name card',
    accentColor: '#1d4ed8',
    defaultDuration: 5,
    textSettings: {
      text: 'ROBERT SMITH\nChief Operations Officer',
      fontFamily: 'Inter',
      fontSize: 28,
      color: '#ffffff',
      backgroundColor: 'rgba(29,78,216,0.9)',
      bold: true,
      italic: false,
      underline: false,
      shadow: false,
      textAlign: 'left'
    },
    animations: {
      'transform.y': [{ time: 0, value: 170 }, { time: 0.4, value: 110 }, { time: 4.6, value: 110 }, { time: 5, value: 170 }]
    }
  },
  {
    id: 'lower_third_accent_border',
    name: 'Accent Border Line',
    category: 'lower-third',
    description: 'Line border clean name card',
    accentColor: '#f97316',
    defaultDuration: 4.5,
    textSettings: {
      text: 'Alexander Wright\nLead Architect',
      fontFamily: 'Inter',
      fontSize: 26,
      color: '#f97316',
      backgroundColor: 'rgba(0,0,0,0.8)',
      bold: true,
      italic: false,
      underline: false,
      shadow: false,
      textAlign: 'left'
    },
    animations: {
      'transform.y': [{ time: 0, value: 150 }, { time: 0.4, value: 110 }, { time: 4.1, value: 110 }, { time: 4.5, value: 150 }]
    }
  },
  {
    id: 'lower_third_social_single',
    name: 'Social Handle Single',
    category: 'lower-third',
    description: 'Clean username profile card',
    accentColor: '#3b82f6',
    defaultDuration: 4,
    textSettings: {
      text: '👤  @username_here',
      fontFamily: 'Inter',
      fontSize: 24,
      color: '#ffffff',
      backgroundColor: 'rgba(59,130,246,0.85)',
      bold: true,
      italic: false,
      underline: false,
      shadow: false,
      textAlign: 'center'
    },
    animations: {
      'transform.y': [{ time: 0, value: 180 }, { time: 0.3, value: 140 }, { time: 3.7, value: 140 }, { time: 4, value: 180 }]
    }
  },
  {
    id: 'lower_third_gaming',
    name: 'Gaming Red Tag',
    category: 'lower-third',
    description: 'Loud gaming alias name tag',
    accentColor: '#dc2626',
    defaultDuration: 3.5,
    textSettings: {
      text: '🎮  NIGHTSHADE_GG',
      fontFamily: 'Impact',
      fontSize: 30,
      color: '#ffffff',
      backgroundColor: '#dc2626',
      bold: false,
      italic: false,
      underline: false,
      shadow: true,
      shadowColor: '#000000',
      textAlign: 'center'
    },
    animations: {
      'transform.y': [{ time: 0, value: 160 }, { time: 0.3, value: 120 }, { time: 3.2, value: 120 }, { time: 3.5, value: 160 }]
    }
  },
  {
    id: 'lower_third_interview',
    name: 'Interview Double Box',
    category: 'lower-third',
    description: 'Large interview label name plate',
    accentColor: '#eab308',
    defaultDuration: 5,
    textSettings: {
      text: 'GUEST SPEAKER\nDr. Linda Mercer',
      fontFamily: 'Montserrat',
      fontSize: 28,
      color: '#ffffff',
      backgroundColor: '#eab308',
      bold: true,
      italic: false,
      underline: false,
      shadow: true,
      textAlign: 'left'
    },
    animations: {
      'transform.y': [{ time: 0, value: 180 }, { time: 0.4, value: 110 }, { time: 4.6, value: 110 }, { time: 5, value: 180 }]
    }
  },
  {
    id: 'lower_third_badge',
    name: 'Badge Corner Label',
    category: 'lower-third',
    description: 'Compact name badge for bottom left',
    accentColor: '#ec4899',
    defaultDuration: 4,
    textSettings: {
      text: 'ON STAGE',
      fontFamily: 'Inter',
      fontSize: 18,
      color: '#ffffff',
      backgroundColor: '#ec4899',
      bold: true,
      italic: false,
      underline: false,
      shadow: false,
      textAlign: 'center'
    },
    animations: {
      'transform.y': [{ time: 0, value: 180 }, { time: 0.3, value: 140 }, { time: 3.7, value: 140 }, { time: 4, value: 180 }]
    }
  },
  {
    id: 'lower_third_two_column',
    name: 'Two Column Plate',
    category: 'lower-third',
    description: 'Horizontal block corporate lower-third',
    accentColor: '#1e293b',
    defaultDuration: 4.5,
    textSettings: {
      text: 'MARKETING TEAM  ●  DIRECTOR',
      fontFamily: 'Inter',
      fontSize: 22,
      color: '#ffffff',
      backgroundColor: '#1e293b',
      bold: true,
      italic: false,
      underline: false,
      shadow: false,
      textAlign: 'center'
    },
    animations: {
      'transform.y': [{ time: 0, value: 170 }, { time: 0.4, value: 130 }, { time: 4.1, value: 130 }, { time: 4.5, value: 170 }]
    }
  },

  // ── Subtitles (33-42) ────────────────────────────────────────────────────────
  {
    id: 'subtitle_karaoke',
    name: 'Karaoke Style',
    category: 'subtitle',
    description: 'Glowing karaoke accent text',
    accentColor: '#fbbf24',
    defaultDuration: 3.5,
    textSettings: {
      text: '♪ Singing the lyrics aloud ♪',
      fontFamily: 'Inter',
      fontSize: 28,
      color: '#fbbf24',
      backgroundColor: 'rgba(0,0,0,0.5)',
      bold: true,
      italic: true,
      underline: false,
      shadow: true,
      textAlign: 'center'
    }
  },
  {
    id: 'subtitle_yellow',
    name: 'Transcribed Yellow',
    category: 'subtitle',
    description: 'Classic high contrast yellow font box',
    accentColor: '#eab308',
    defaultDuration: 3,
    textSettings: {
      text: 'This is what I am talking about!',
      fontFamily: 'Oswald',
      fontSize: 32,
      color: '#eab308',
      backgroundColor: 'rgba(0,0,0,0.85)',
      bold: true,
      italic: false,
      underline: false,
      shadow: false,
      textAlign: 'center'
    }
  },
  {
    id: 'subtitle_bubble',
    name: 'Speech Bubble',
    category: 'subtitle',
    description: 'White text in a rounded white-ish bubble',
    accentColor: '#e2e8f0',
    defaultDuration: 3.5,
    textSettings: {
      text: '💬 "Hello, is anyone there?"',
      fontFamily: 'Open Sans',
      fontSize: 28,
      color: '#0f172a',
      backgroundColor: '#f8fafc',
      bold: false,
      italic: true,
      underline: false,
      shadow: false,
      textAlign: 'center'
    }
  },
  {
    id: 'subtitle_top',
    name: 'Top aligned banner',
    category: 'subtitle',
    description: 'Subtitle card rendered at top of canvas',
    accentColor: '#3b82f6',
    defaultDuration: 4,
    textSettings: {
      text: 'NARRATIVE INSTRUCTION CARD',
      fontFamily: 'Inter',
      fontSize: 24,
      color: '#ffffff',
      backgroundColor: 'rgba(15,23,42,0.9)',
      bold: true,
      italic: false,
      underline: false,
      shadow: false,
      textAlign: 'center'
    },
    animations: {
      'transform.y': [
        { time: 0, value: -180 }
      ]
    }
  },
  {
    id: 'subtitle_outline',
    name: 'Outline Minimal',
    category: 'subtitle',
    description: 'Border stroke black outlines only',
    accentColor: '#000000',
    defaultDuration: 3,
    textSettings: {
      text: 'HIGH CONTRAST BORDER TEXT',
      fontFamily: 'Inter',
      fontSize: 30,
      color: '#ffffff',
      backgroundColor: 'transparent',
      bold: true,
      italic: false,
      underline: false,
      shadow: true,
      shadowColor: '#000000',
      shadowBlur: 10,
      textAlign: 'center'
    }
  },
  {
    id: 'subtitle_caps',
    name: 'All Caps Impact',
    category: 'subtitle',
    description: 'Loud bold meme-style captions',
    accentColor: '#ffffff',
    defaultDuration: 2.5,
    textSettings: {
      text: 'THE AUDACITY OF THIS SCENE',
      fontFamily: 'Impact',
      fontSize: 36,
      color: '#ffffff',
      backgroundColor: 'transparent',
      bold: true,
      italic: false,
      underline: false,
      shadow: true,
      shadowColor: '#000000',
      shadowBlur: 8,
      textAlign: 'center'
    }
  },
  {
    id: 'subtitle_glow',
    name: 'Neon Glow Captions',
    category: 'subtitle',
    description: 'Glowing neon caption text',
    accentColor: '#ec4899',
    defaultDuration: 3.5,
    textSettings: {
      text: 'Cyber ambient sounds echoing...',
      fontFamily: 'Inter',
      fontSize: 28,
      color: '#ffffff',
      backgroundColor: 'transparent',
      bold: true,
      italic: false,
      underline: false,
      shadow: true,
      shadowColor: '#ec4899',
      shadowBlur: 18,
      textAlign: 'center'
    }
  },
  {
    id: 'subtitle_box',
    name: 'Solid Dark Box',
    category: 'subtitle',
    description: 'Full solid box background subtitles',
    accentColor: '#1e293b',
    defaultDuration: 3,
    textSettings: {
      text: 'Sound of engines accelerating',
      fontFamily: 'Inter',
      fontSize: 26,
      color: '#ffffff',
      backgroundColor: '#0f172a',
      bold: false,
      italic: false,
      underline: false,
      shadow: false,
      textAlign: 'center'
    }
  },
  {
    id: 'subtitle_italics',
    name: 'Narrative Italics',
    category: 'subtitle',
    description: 'Clean italic narrative translations',
    accentColor: '#e2e8f0',
    defaultDuration: 4,
    textSettings: {
      text: '(whispering) I think we are safe now...',
      fontFamily: 'Georgia',
      fontSize: 28,
      color: '#cbd5e1',
      backgroundColor: 'transparent',
      bold: false,
      italic: true,
      underline: false,
      shadow: true,
      textAlign: 'center'
    }
  },
  {
    id: 'subtitle_split',
    name: 'Two Line Split',
    category: 'subtitle',
    description: 'Clean double decker subtitles',
    accentColor: '#f8fafc',
    defaultDuration: 4,
    textSettings: {
      text: 'First line of the dialogue goes here\nFollowed by the second line response',
      fontFamily: 'Inter',
      fontSize: 26,
      color: '#ffffff',
      backgroundColor: 'rgba(0,0,0,0.5)',
      bold: false,
      italic: false,
      underline: false,
      shadow: false,
      textAlign: 'center'
    }
  },

  // ── Kinetic & Transitions (43-52) ───────────────────────────────────────────
  {
    id: 'kinetic_slide_left',
    name: 'Slide In Left',
    category: 'kinetic',
    description: 'Text slides in rapidly from left edge',
    accentColor: '#3b82f6',
    defaultDuration: 3,
    textSettings: {
      text: 'SLIDE LEFT',
      fontFamily: 'Oswald',
      fontSize: 80,
      color: '#ffffff',
      backgroundColor: '#3b82f6',
      bold: true,
      italic: false,
      underline: false,
      shadow: false,
      textAlign: 'center'
    },
    animations: {
      'transform.x': [
        { time: 0, value: -600, easing: 'ease-out' },
        { time: 0.35, value: 0, easing: 'linear' },
        { time: 2.65, value: 0, easing: 'ease-in' },
        { time: 3.0, value: -600 }
      ]
    }
  },
  {
    id: 'kinetic_slide_right',
    name: 'Slide In Right',
    category: 'kinetic',
    description: 'Text slides in rapidly from right edge',
    accentColor: '#ec4899',
    defaultDuration: 3,
    textSettings: {
      text: 'SLIDE RIGHT',
      fontFamily: 'Oswald',
      fontSize: 80,
      color: '#ffffff',
      backgroundColor: '#ec4899',
      bold: true,
      italic: false,
      underline: false,
      shadow: false,
      textAlign: 'center'
    },
    animations: {
      'transform.x': [
        { time: 0, value: 600, easing: 'ease-out' },
        { time: 0.35, value: 0, easing: 'linear' },
        { time: 2.65, value: 0, easing: 'ease-in' },
        { time: 3.0, value: 600 }
      ]
    }
  },
  {
    id: 'kinetic_rotation',
    name: 'Spin Pop Intro',
    category: 'kinetic',
    description: 'Title rotates 360 degrees while expanding',
    accentColor: '#10b981',
    defaultDuration: 3.5,
    textSettings: {
      text: 'SPIN POP!',
      fontFamily: 'Impact',
      fontSize: 90,
      color: '#10b981',
      backgroundColor: 'transparent',
      bold: true,
      italic: false,
      underline: false,
      shadow: true,
      textAlign: 'center'
    },
    animations: {
      'transform.rotation': [
        { time: 0, value: -180, easing: 'ease-out' },
        { time: 0.5, value: 0 }
      ],
      'transform.scale': [
        { time: 0, value: 0, easing: 'ease-out' },
        { time: 0.5, value: 100 }
      ]
    }
  },
  {
    id: 'kinetic_zoom_flash',
    name: 'Zoom Flash Card',
    category: 'kinetic',
    description: 'Zoom in with bright stroke outline flash',
    accentColor: '#fbbf24',
    defaultDuration: 2.5,
    textSettings: {
      text: 'FLASH!',
      fontFamily: 'Bebas Neue',
      fontSize: 100,
      color: '#ffffff',
      backgroundColor: 'transparent',
      bold: true,
      italic: false,
      underline: false,
      shadow: true,
      shadowColor: '#fbbf24',
      shadowBlur: 20,
      textAlign: 'center'
    },
    animations: {
      'transform.scale': [
        { time: 0, value: 20, easing: 'ease-out' },
        { time: 0.3, value: 100, easing: 'linear' },
        { time: 2.2, value: 100, easing: 'ease-in' },
        { time: 2.5, value: 250 }
      ],
      opacity: [
        { time: 0, value: 0 },
        { time: 0.25, value: 1 },
        { time: 2.2, value: 1 },
        { time: 2.5, value: 0 }
      ]
    }
  },
  {
    id: 'kinetic_elastic',
    name: 'Elastic Pop Spring',
    category: 'kinetic',
    description: 'Elastic overshooting bounce intro',
    accentColor: '#f97316',
    defaultDuration: 3,
    textSettings: {
      text: 'BOING!',
      fontFamily: 'Inter',
      fontSize: 110,
      color: '#f97316',
      backgroundColor: 'transparent',
      bold: true,
      italic: false,
      underline: false,
      shadow: true,
      textAlign: 'center'
    },
    animations: {
      'transform.scale': [
        { time: 0, value: 0, easing: 'ease-out' },
        { time: 0.25, value: 130, easing: 'ease-in' },
        { time: 0.45, value: 90, easing: 'linear' },
        { time: 0.6, value: 105 },
        { time: 0.7, value: 100 }
      ]
    }
  },
  {
    id: 'kinetic_glitch_shake',
    name: 'Glitch Shake',
    category: 'kinetic',
    description: 'Flickering and shaking text animation',
    accentColor: '#dc2626',
    defaultDuration: 2,
    textSettings: {
      text: 'ERROR 404',
      fontFamily: 'Courier New',
      fontSize: 72,
      color: '#f87171',
      backgroundColor: 'transparent',
      bold: true,
      italic: false,
      underline: false,
      shadow: true,
      shadowColor: '#ef4444',
      shadowBlur: 14,
      textAlign: 'center'
    },
    animations: {
      'transform.x': [
        { time: 0, value: 0 },
        { time: 0.1, value: 10 },
        { time: 0.2, value: -12 },
        { time: 0.3, value: 8 },
        { time: 0.4, value: -6 },
        { time: 0.5, value: 0 }
      ]
    }
  },
  {
    id: 'social_instagram',
    name: 'Instagram Follow',
    category: 'social',
    description: 'Instagram handle card slide in',
    accentColor: '#ec4899',
    defaultDuration: 4.5,
    textSettings: {
      text: '📸  Follow on Instagram  ●  @handle',
      fontFamily: 'Inter',
      fontSize: 24,
      color: '#ffffff',
      backgroundColor: 'rgba(236,72,153,0.9)',
      bold: true,
      italic: false,
      underline: false,
      shadow: false,
      textAlign: 'center'
    },
    animations: {
      'transform.y': [{ time: 0, value: 200 }, { time: 0.4, value: 130 }, { time: 4.1, value: 130 }, { time: 4.5, value: 200 }]
    }
  },
  {
    id: 'social_tiktok',
    name: 'TikTok Tag',
    category: 'social',
    description: 'TikTok badge slide card',
    accentColor: '#000000',
    defaultDuration: 4.5,
    textSettings: {
      text: '🎵  TikTok  ●  @creator_tag',
      fontFamily: 'Oswald',
      fontSize: 24,
      color: '#ffffff',
      backgroundColor: '#000000',
      bold: true,
      italic: false,
      underline: false,
      shadow: true,
      shadowColor: '#00f2fe',
      shadowBlur: 10,
      textAlign: 'center'
    },
    animations: {
      'transform.y': [{ time: 0, value: 200 }, { time: 0.4, value: 130 }, { time: 4.1, value: 130 }, { time: 4.5, value: 200 }]
    }
  },
  {
    id: 'social_twitter',
    name: 'Twitter Tweet Box',
    category: 'social',
    description: 'Twitter post mock layout card',
    accentColor: '#1d9bf0',
    defaultDuration: 5,
    textSettings: {
      text: '🐦  @profile_name\n"This video editor is absolutely amazing!"',
      fontFamily: 'Inter',
      fontSize: 22,
      color: '#ffffff',
      backgroundColor: 'rgba(21,32,43,0.95)',
      bold: false,
      italic: false,
      underline: false,
      shadow: false,
      textAlign: 'left'
    },
    animations: {
      'transform.y': [{ time: 0, value: 200 }, { time: 0.5, value: 110 }, { time: 4.5, value: 110 }, { time: 5, value: 200 }]
    }
  },
  {
    id: 'social_twitch',
    name: 'Twitch Subscribe',
    category: 'social',
    description: 'Twitch purple follow trigger card',
    accentColor: '#9146ff',
    defaultDuration: 4.5,
    textSettings: {
      text: '👾  LIVE ON TWITCH  ●  Follow Now!',
      fontFamily: 'Montserrat',
      fontSize: 24,
      color: '#ffffff',
      backgroundColor: '#9146ff',
      bold: true,
      italic: false,
      underline: false,
      shadow: false,
      textAlign: 'center'
    },
    animations: {
      'transform.y': [{ time: 0, value: 200 }, { time: 0.4, value: 130 }, { time: 4.1, value: 130 }, { time: 4.5, value: 200 }]
    }
  },
  {
    id: 'social_facebook',
    name: 'Facebook Share',
    category: 'social',
    description: 'Facebook share call to action banner',
    accentColor: '#1877f2',
    defaultDuration: 4,
    textSettings: {
      text: '👍  LIKE & SHARE THIS VIDEO ON FACEBOOK',
      fontFamily: 'Inter',
      fontSize: 22,
      color: '#ffffff',
      backgroundColor: '#1877f2',
      bold: true,
      italic: false,
      underline: false,
      shadow: false,
      textAlign: 'center'
    },
    animations: {
      'transform.y': [{ time: 0, value: 200 }, { time: 0.4, value: 130 }, { time: 3.6, value: 130 }, { time: 4, value: 200 }]
    }
  },
  {
    id: 'social_linkedin',
    name: 'LinkedIn Connect',
    category: 'social',
    description: 'LinkedIn connect professional handle card',
    accentColor: '#0a66c2',
    defaultDuration: 4.5,
    textSettings: {
      text: '💼  Let\'s Connect on LinkedIn  ●  /in/profile',
      fontFamily: 'Inter',
      fontSize: 24,
      color: '#ffffff',
      backgroundColor: '#0a66c2',
      bold: true,
      italic: false,
      underline: false,
      shadow: false,
      textAlign: 'center'
    },
    animations: {
      'transform.y': [{ time: 0, value: 200 }, { time: 0.4, value: 130 }, { time: 4.1, value: 130 }, { time: 4.5, value: 200 }]
    }
  }
];

// ── Category Helpers ──────────────────────────────────────────────────────────

export const TEMPLATE_CATEGORIES = [
  { id: 'all',         label: 'All' },
  { id: 'lower-third', label: 'Lower Thirds' },
  { id: 'title',       label: 'Titles' },
  { id: 'subtitle',    label: 'Subtitles' },
  { id: 'kinetic',     label: 'Kinetic' },
  { id: 'social',      label: 'Social Media' },
] as const;

export type TemplateCategory = typeof TEMPLATE_CATEGORIES[number]['id'];
