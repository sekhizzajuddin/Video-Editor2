import React from 'react';
import { Film, Sun, Tv2, Radio, Monitor, Flame, ScanLine, Hexagon, FlipHorizontal, ZoomIn, Aperture, Eye, Focus, Grid3X3, Droplets, CloudSnow, CloudRain, Star, Sparkles, Wind, Leaf, Heart, Code2, Clapperboard, Zap } from 'lucide-react';

export const TRANSITIONS = [
  { name: 'Fade', color: 'from-amber-500/20 to-transparent', preview: 'Fade in/out between clips' },
  { name: 'Cross Dissolve', color: 'from-purple-500/20 to-transparent', preview: 'Smooth blend transition' },
  { name: 'Wipe Left', color: 'from-blue-500/20 to-transparent', preview: 'Horizontal wipe to left' },
  { name: 'Wipe Right', color: 'from-blue-500/20 to-transparent', preview: 'Horizontal wipe to right' },
  { name: 'Zoom In', color: 'from-cyan-500/20 to-transparent', preview: 'Zoom into next clip' },
  { name: 'Zoom Out', color: 'from-cyan-500/20 to-transparent', preview: 'Zoom out from clip' },
  { name: 'Slide Up', color: 'from-emerald-500/20 to-transparent', preview: 'Slide up transition' },
  { name: 'Slide Down', color: 'from-emerald-500/20 to-transparent', preview: 'Slide down transition' },
  { name: 'Slow Fade', color: 'from-amber-600/20 to-transparent', preview: 'Cinematic slow fade to/from black' },
  { name: 'Cinematic Dissolve', color: 'from-fuchsia-500/20 to-transparent', preview: 'Ultra-smooth professional dissolve' },
  { name: 'Glitch Dissolve', color: 'from-pink-500/20 to-transparent', preview: 'Stylized digital bleed dissolve' },
  { name: 'Wipe Left Smooth', color: 'from-sky-500/20 to-transparent', preview: 'Feathered edge wipe to left' },
  { name: 'Wipe Right Smooth', color: 'from-sky-500/20 to-transparent', preview: 'Feathered edge wipe to right' },
  { name: 'Slide Left Push', color: 'from-teal-500/20 to-transparent', preview: 'Push next clip in from right to left' },
  { name: 'Slide Right Push', color: 'from-teal-500/20 to-transparent', preview: 'Push next clip in from left to right' },
  { name: 'Slide Up Push', color: 'from-lime-500/20 to-transparent', preview: 'Push next clip in from bottom to top' },
  { name: 'Slide Down Push', color: 'from-lime-500/20 to-transparent', preview: 'Push next clip in from top to bottom' },
  { name: 'Zoom Out Spin', color: 'from-rose-500/20 to-transparent', preview: 'Classic spinning zoom transition' },
  { name: 'Camera Shake', color: 'from-red-500/20 to-transparent', preview: 'Drill/Hip-Hop vibration drop' },
  { name: 'Flash Cut', color: 'from-yellow-400/20 to-transparent', preview: 'White flash transition strobe' },
  { name: 'Zoom Rush', color: 'from-orange-500/20 to-transparent', preview: 'Exponential zoom in transition' },
  { name: 'RGB Glitch', color: 'from-cyan-500/20 to-transparent', preview: 'Digital glitch color splitting' },
  { name: 'Light Leak', color: 'from-rose-400/20 to-transparent', preview: 'Warm bloom light leak fade' },
  { name: 'Whip Pan', color: 'from-indigo-500/20 to-transparent', preview: 'Whip pan camera motion sweep' },
  { name: 'Pixelate', color: 'from-violet-500/20 to-transparent', preview: 'Retro game pixelation blockiness' },
  { name: 'Kaleidoscope', color: 'from-teal-500/20 to-transparent', preview: 'Mirror segments transition' },
];

export const FX_EFFECTS = [
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
  { name: 'Posterize',          icon: Grid3X3,      color: 'text-amber-400',   type: 'posterize',        desc: 'Retro color reduction look' },
  { name: 'Dreamy Blur',        icon: Droplets,     color: 'text-fuchsia-400', type: 'dreamy_blur',      desc: 'Dreamy bloom soft-focus glow' },
  { name: 'Fisheye Lens',       icon: Aperture,     color: 'text-cyan-400',    type: 'fisheye',          desc: 'Action camera wide-angle bulge' },
  { name: 'Vignette Burn',      icon: Focus,        color: 'text-stone-400',   type: 'vignette_burn',    desc: 'Heavy dark cinematic border shadow' },
  { name: 'Retro GameBoy',      icon: Code2,        color: 'text-emerald-500', type: 'gameboy',          desc: '8-bit monochrome screen green lookup' },
];

export const COLOR_CORRECTION_EFFECTS = [
  { name: 'Brightness',    icon: Sun,      color: 'text-amber-400',  preset: { exposure: 30 },                          desc: 'Boost clip brightness' },
  { name: 'Contrast',      icon: Droplets, color: 'text-cyan-400',   preset: { contrast: 150 },                         desc: 'Increase contrast' },
  { name: 'Saturation',    icon: Waves,    color: 'text-purple-400', preset: { saturation: 160 },                       desc: 'Boost color saturation' },
  { name: 'Blur',          icon: Droplets, color: 'text-blue-400',   preset: { blur: 8 },                               desc: 'Soft focus / background blur' },
  { name: 'Vignette',      icon: Sun,      color: 'text-rose-400',   preset: { vignette: 60 },                          desc: 'Dark edge vignette' },
  { name: 'Warm Tone',     icon: Flame,    color: 'text-orange-400', preset: { temperature: 60, saturation: 120 },       desc: 'Warm golden look' },
  { name: 'Cool Tone',     icon: Zap,      color: 'text-blue-300',   preset: { temperature: -60, saturation: 110 },      desc: 'Cool blue look' },
  { name: 'Faded Film',    icon: Clapperboard, color: 'text-stone-400', preset: { fadedFilm: 60, saturation: 80 },     desc: 'Faded vintage film' },
];

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

