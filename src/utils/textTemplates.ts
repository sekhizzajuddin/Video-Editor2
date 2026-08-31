// ─────────────────────────────────────────────────────────────────────────────
// [SHARED CORE] Used by BOTH the desktop editor (src/App.tsx → DesktopApp) and
// the mobile editor (src/mobile/App.tsx → MobileApp). There is NO separate mobile
// copy — edit ONCE here. LOGIC / ARCHITECTURE / BUGFIX changes automatically apply
// to both UIs. UI-only changes belong in the individual UI layer instead.
// ─────────────────────────────────────────────────────────────────────────────

import type { ClipTextAnimation } from '@/types';

export interface TextTemplatePreset {
  name: string;
  style: string;
  settings: {
    fontSize: number;
    color: string;
    backgroundColor?: string;
    backgroundStyle?: string;
    fontFamily: string;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    shadow?: boolean;
    shadowColor?: string;
    shadowBlur?: number;
    strokeColor?: string;
    strokeWidth?: number;
    animationPreset?: string;
  };
}

/**
 * Map a legacy `animationPreset` string to the rich `ClipTextAnimation` object
 * that both the preview (CanvasRenderingEngine) and the export (Compositor)
 * actually read.
 *
 * The style presets previously wrote only `animationPreset`, which nothing ever
 * consumed — so "Typewriter Green" / "Bouncy Pop" applied zero animation. These
 * presets now animate (and export) correctly via the `animation` field.
 */
export function presetToTextAnimation(preset?: string): ClipTextAnimation | undefined {
  switch (preset) {
    case 'typewriter':
      return { in: 'typewriter', out: 'none', inDuration: 0.6, outDuration: 0.3 };
    case 'bounce':
      return { in: 'bounce', out: 'none', inDuration: 0.6, outDuration: 0.3 };
    default:
      return undefined;
  }
}

/**
 * Returns a spreadable `{ animation }` patch ONLY when the preset maps to an
 * animation. This lets style-preset handlers apply the animation without wiping
 * a pre-existing `textSettings.animation` when the chosen preset has none.
 */
export function presetToTextAnimationPatch(preset?: string): { animation?: ClipTextAnimation } {
  const anim = presetToTextAnimation(preset);
  return anim ? { animation: anim } : {};
}

export const TEXT_TEMPLATES: TextTemplatePreset[] = [
  // ── Headings & Subtitles (1-6) ──
  { name: 'Heading Large', style: 'text-3xl font-bold text-white', settings: { fontSize: 56, bold: true, fontFamily: 'Inter', color: '#ffffff' } },
  { name: 'Heading Medium', style: 'text-2xl font-bold text-white', settings: { fontSize: 40, bold: true, fontFamily: 'Inter', color: '#ffffff' } },
  { name: 'Subtitle Large', style: 'text-xl font-medium text-gray-300', settings: { fontSize: 32, bold: false, fontFamily: 'Inter', color: '#cbd5e1' } },
  { name: 'Subtitle Small', style: 'text-lg font-normal text-gray-400', settings: { fontSize: 24, bold: false, fontFamily: 'Inter', color: '#94a3b8' } },
  { name: 'Body Text', style: 'text-sm font-normal text-white', settings: { fontSize: 18, bold: false, fontFamily: 'Inter', color: '#ffffff' } },
  { name: 'Caption', style: 'text-xs text-gray-400 italic', settings: { fontSize: 14, italic: true, fontFamily: 'Inter', color: '#94a3b8' } },

  // ── Vibrant Colors (7-16) ──
  { name: 'Vibrant Pink', style: 'text-2xl font-extrabold text-pink-500', settings: { fontSize: 40, bold: true, color: '#ec4899', fontFamily: 'Inter' } },
  { name: 'Sunset Orange', style: 'text-2xl font-extrabold text-orange-500', settings: { fontSize: 40, bold: true, color: '#f97316', fontFamily: 'Inter' } },
  { name: 'Cyber Neon', style: 'text-2xl font-extrabold text-cyan-400 drop-shadow-[0_2px_8px_rgba(34,211,238,0.5)]', settings: { fontSize: 40, bold: true, color: '#22d3ee', shadow: true, shadowColor: '#22d3ee', shadowBlur: 10, fontFamily: 'Oswald' } },
  { name: 'Forest Emerald', style: 'text-2xl font-extrabold text-emerald-400', settings: { fontSize: 40, bold: true, color: '#34d399', fontFamily: 'Inter' } },
  { name: 'Royal Gold', style: 'text-2xl font-serif text-[#d4af37]', settings: { fontSize: 40, bold: false, color: '#d4af37', fontFamily: 'Times New Roman' } },
  { name: 'Electric Indigo', style: 'text-2xl font-extrabold text-indigo-400', settings: { fontSize: 40, bold: true, color: '#818cf8', fontFamily: 'Inter' } },
  { name: 'Hot Rose', style: 'text-2xl font-bold text-rose-500', settings: { fontSize: 40, bold: true, color: '#f43f5e', fontFamily: 'Inter' } },
  { name: 'Lemon Lime', style: 'text-2xl font-bold text-lime-400', settings: { fontSize: 40, bold: true, color: '#a3e635', fontFamily: 'Inter' } },
  { name: 'Ruby Red', style: 'text-2xl font-bold text-red-500', settings: { fontSize: 40, bold: true, color: '#ef4444', fontFamily: 'Inter' } },
  { name: 'Violet Glow', style: 'text-2xl font-bold text-violet-400 drop-shadow-[0_2px_8px_rgba(167,139,250,0.5)]', settings: { fontSize: 40, bold: true, color: '#a78bfa', shadow: true, shadowColor: '#a78bfa', shadowBlur: 10, fontFamily: 'Inter' } },

  // ── Backgrounds & Labels (17-26) ──
  { name: 'Dark Label', style: 'px-2 py-0.5 bg-black text-white text-sm rounded', settings: { fontSize: 24, color: '#ffffff', backgroundColor: '#000000', fontFamily: 'Inter' } },
  { name: 'Red Banner', style: 'px-3 py-1 bg-red-600 text-white font-bold rounded text-sm', settings: { fontSize: 24, bold: true, color: '#ffffff', backgroundColor: '#dc2626', fontFamily: 'Inter' } },
  { name: 'Blue Ribbon', style: 'px-3 py-0.5 bg-blue-600 text-white text-sm rounded-full', settings: { fontSize: 24, color: '#ffffff', backgroundColor: '#2563eb', fontFamily: 'Inter' } },
  { name: 'Yellow Warning', style: 'px-2 py-0.5 bg-yellow-500 text-black font-extrabold rounded text-sm', settings: { fontSize: 24, bold: true, color: '#000000', backgroundColor: '#eab308', fontFamily: 'Inter' } },
  { name: 'Green Success', style: 'px-2 py-0.5 bg-green-500 text-white font-bold rounded text-sm', settings: { fontSize: 24, bold: true, color: '#ffffff', backgroundColor: '#22c55e', fontFamily: 'Inter' } },
  { name: 'Semi-Trans Black', style: 'px-2 py-0.5 bg-black/60 text-white rounded text-sm', settings: { fontSize: 24, color: '#ffffff', backgroundColor: 'rgba(0,0,0,0.6)', fontFamily: 'Inter' } },
  { name: 'White Box', style: 'px-2 py-0.5 bg-white text-black font-bold rounded text-sm', settings: { fontSize: 24, bold: true, color: '#000000', backgroundColor: '#ffffff', fontFamily: 'Inter' } },
  { name: 'Purple Badge', style: 'px-2 py-0.5 bg-purple-600 text-white font-bold rounded-full text-sm', settings: { fontSize: 24, bold: true, color: '#ffffff', backgroundColor: '#9333ea', fontFamily: 'Inter' } },
  { name: 'Orange Tag', style: 'px-2 py-0.5 bg-orange-500 text-white font-bold rounded text-sm', settings: { fontSize: 24, bold: true, color: '#ffffff', backgroundColor: '#f97316', fontFamily: 'Inter' } },
  { name: 'Teal Bordered', style: 'px-2 py-0.5 border border-teal-400 text-teal-400 rounded bg-[#1e1e1e] text-sm', settings: { fontSize: 24, color: '#2dd4bf', backgroundColor: '#1e1e1e', strokeColor: '#2dd4bf', strokeWidth: 1, fontFamily: 'Inter' } },

  // ── Shadows & Outlines (27-34) ──
  { name: 'Deep Drop Shadow', style: 'text-xl font-bold text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)]', settings: { fontSize: 32, bold: true, color: '#ffffff', shadow: true, shadowColor: '#000000', shadowBlur: 12, fontFamily: 'Inter' } },
  { name: 'Neon Pink Glow', style: 'text-xl font-bold text-pink-500 drop-shadow-[0_4px_10px_rgba(244,63,94,0.8)]', settings: { fontSize: 32, bold: true, color: '#ec4899', shadow: true, shadowColor: '#f43f5e', shadowBlur: 10, fontFamily: 'Inter' } },
  { name: 'Cyan Glow', style: 'text-xl font-bold text-cyan-400 drop-shadow-[0_4px_10px_rgba(6,182,212,0.8)]', settings: { fontSize: 32, bold: true, color: '#22d3ee', shadow: true, shadowColor: '#06b6d4', shadowBlur: 10, fontFamily: 'Inter' } },
  { name: 'Golden Glow', style: 'text-xl font-bold text-[#d4af37] drop-shadow-[0_4px_10px_rgba(212,175,55,0.8)]', settings: { fontSize: 32, bold: true, color: '#d4af37', shadow: true, shadowColor: '#d4af37', shadowBlur: 10, fontFamily: 'Inter' } },
  { name: 'White Outline', style: 'text-xl font-black text-white stroke-black stroke-[0.5px]', settings: { fontSize: 32, bold: true, color: '#ffffff', strokeColor: '#000000', strokeWidth: 2, fontFamily: 'Inter' } },
  { name: 'Outline Yellow', style: 'text-xl font-black text-yellow-400 stroke-black stroke-[0.5px]', settings: { fontSize: 32, bold: true, color: '#facc15', strokeColor: '#000000', strokeWidth: 2, fontFamily: 'Inter' } },
  { name: 'Ghost White', style: 'text-lg font-bold text-white/40 border border-white/20 px-2 py-0.5 bg-transparent', settings: { fontSize: 24, bold: true, color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter' } },
  { name: 'Chunky Shadow', style: 'text-xl font-extrabold text-white [text-shadow:2px_2px_0_#000]', settings: { fontSize: 32, bold: true, color: '#ffffff', shadow: true, shadowColor: '#000000', shadowBlur: 1, fontFamily: 'Inter' } },

  // ── Presets & Fonts (35-40) ──
  { name: 'Typewriter Green', style: 'text-lg font-mono text-green-400', settings: { fontSize: 28, color: '#4ade80', fontFamily: 'Courier New', animationPreset: 'typewriter' } },
  { name: 'Vintage Serif', style: 'text-xl font-serif text-amber-100 italic', settings: { fontSize: 32, italic: true, color: '#fef3c7', fontFamily: 'Georgia' } },
  { name: 'Bouncy Pop', style: 'text-2xl font-extrabold text-amber-400 scale-105', settings: { fontSize: 40, bold: true, color: '#fbbf24', fontFamily: 'Inter', animationPreset: 'bounce' } },
  { name: 'Cinematic Intro', style: 'text-2xl tracking-widest font-light text-slate-100 uppercase', settings: { fontSize: 36, color: '#f1f5f9', fontFamily: 'Montserrat' } },
  { name: 'Retro VHS Play', style: 'text-base font-mono text-cyan-300 drop-shadow-[1px_1px_0_#e11d48]', settings: { fontSize: 24, color: '#67e8f9', shadow: true, shadowColor: '#be185d', shadowBlur: 1, fontFamily: 'Courier New' } },
  { name: 'Terminal Prompt', style: 'text-base font-mono text-green-300', settings: { fontSize: 24, color: '#86efac', fontFamily: 'Courier New' } },

  // ── Social Media & Viral Captions (41-54) ──
  { name: 'YouTube Subscribe', style: 'px-2 py-0.5 bg-red-600 text-white font-bold rounded-lg text-[10px] uppercase', settings: { fontSize: 24, bold: true, color: '#ffffff', backgroundColor: '#dc2626', fontFamily: 'Roboto', animationPreset: 'subscribe' } },
  { name: 'Instagram Follow', style: 'px-2 py-0.5 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 text-white font-bold rounded-lg text-[10px]', settings: { fontSize: 22, bold: true, color: '#ffffff', backgroundColor: '#ec4899', fontFamily: 'Inter' } },
  { name: 'TikTok Handle', style: 'px-2 py-0.5 bg-black text-white font-bold border border-cyan-400 rounded-lg text-[10px]', settings: { fontSize: 22, bold: true, color: '#ffffff', backgroundColor: '#000000', strokeColor: '#22d3ee', strokeWidth: 1, fontFamily: 'Oswald' } },
  { name: 'Twitch Live', style: 'px-2 py-0.5 bg-[#9146ff] text-white font-bold uppercase rounded-lg text-[10px]', settings: { fontSize: 22, bold: true, color: '#ffffff', backgroundColor: '#9146ff', fontFamily: 'Inter' } },
  { name: 'Facebook Like', style: 'px-2 py-0.5 bg-[#1877f2] text-white font-bold rounded-lg text-[10px]', settings: { fontSize: 22, bold: true, color: '#ffffff', backgroundColor: '#1877f2', fontFamily: 'Inter' } },
  { name: 'LinkedIn Connect', style: 'px-2 py-0.5 bg-[#0a66c2] text-white font-bold rounded-lg text-[10px]', settings: { fontSize: 22, bold: true, color: '#ffffff', backgroundColor: '#0a66c2', fontFamily: 'Inter' } },
  { name: 'Meme Text Bottom', style: 'text-xl font-extrabold text-white uppercase stroke-black stroke-[0.5px]', settings: { fontSize: 32, bold: true, color: '#ffffff', strokeColor: '#000000', strokeWidth: 2, fontFamily: 'Impact' } },
  { name: 'Comic Style', style: 'text-xl font-extrabold text-yellow-300 italic drop-shadow-[1px_1px_0_#000]', settings: { fontSize: 32, bold: true, color: '#fde047', italic: true, shadow: true, shadowColor: '#000000', shadowBlur: 1, fontFamily: 'Inter' } },
  { name: 'Glitch Cyber', style: 'text-xl font-black text-cyan-300 tracking-wide', settings: { fontSize: 32, bold: true, color: '#67e8f9', fontFamily: 'Oswald' } },
  { name: 'Bubble Caption', style: 'px-2 py-0.5 bg-[#f8fafc] text-[#0f172a] rounded-lg border border-[#cbd5e1] text-[10px]', settings: { fontSize: 22, color: '#0f172a', backgroundColor: '#f8fafc', fontFamily: 'Inter' } },

  // ── Pro Viral Kinetic Typography Presets (45-48) ──
  { name: 'MrBeast Hype', style: 'text-2xl font-black text-yellow-400 stroke-black stroke-[2px]', settings: { fontSize: 44, bold: true, color: '#facc15', strokeColor: '#000000', strokeWidth: 3, shadow: true, shadowColor: '#000000', shadowBlur: 10, fontFamily: 'Anton' } },
  { name: 'Alex Hormozi Impact', style: 'px-3 py-1 bg-black text-cyan-400 font-extrabold text-2xl uppercase rounded', settings: { fontSize: 42, bold: true, color: '#00f0ff', backgroundColor: '#000000', strokeColor: '#000000', strokeWidth: 2, fontFamily: 'Impact' } },
  { name: 'Modern Shorts Pill', style: 'px-3 py-1 bg-slate-900/90 text-white font-bold text-xl rounded-xl border border-sky-400/50', settings: { fontSize: 36, bold: true, color: '#ffffff', backgroundColor: 'rgba(15, 23, 42, 0.88)', strokeColor: '#38bdf8', strokeWidth: 1, fontFamily: 'Outfit' } },
  { name: 'Neon Cyberpunk', style: 'text-2xl font-black text-rose-500 drop-shadow-[0_0_15px_rgba(244,63,94,0.9)]', settings: { fontSize: 42, bold: true, color: '#f43f5e', shadow: true, shadowColor: '#f43f5e', shadowBlur: 16, strokeColor: '#ffffff', strokeWidth: 1, fontFamily: 'Oswald' } }
];
