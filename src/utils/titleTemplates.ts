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
  category: 'lower-third' | 'title' | 'subtitle' | 'kinetic';
  description: string;
  accentColor: string;         // CSS color for preview card accent
  defaultDuration: number;     // seconds
  textSettings: ClipTextSettings;
  animations?: ClipAnimations;
}

// ── Template Definitions ──────────────────────────────────────────────────────

export const TITLE_TEMPLATES: TitleTemplate[] = [
  // ── Lower Thirds ──────────────────────────────────────────────────────────
  {
    id: 'lower_third_classic',
    name: 'Lower Third',
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

  // ── Cinematic Title ───────────────────────────────────────────────────────
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

  // ── Subtitle Bar ──────────────────────────────────────────────────────────
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

  // ── Kinetic Pop ───────────────────────────────────────────────────────────
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

  // ── News Ticker ───────────────────────────────────────────────────────────
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

  // ── Credits Roll ──────────────────────────────────────────────────────────
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
];

// ── Category Helpers ──────────────────────────────────────────────────────────

export const TEMPLATE_CATEGORIES = [
  { id: 'all',         label: 'All' },
  { id: 'lower-third', label: 'Lower Thirds' },
  { id: 'title',       label: 'Titles' },
  { id: 'subtitle',    label: 'Subtitles' },
  { id: 'kinetic',     label: 'Kinetic' },
] as const;

export type TemplateCategory = typeof TEMPLATE_CATEGORIES[number]['id'];
