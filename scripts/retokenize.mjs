// Retokenize hardcoded neutral-gray Tailwind arbitrary classes into semantic
// theme tokens (bg-card, text-muted-foreground, border-border, ...).
//
// Only NEUTRAL grays (R=G=B) are remapped. Tinted / brand colors are left
// untouched so accent chips, canvas fills and status colors keep working.
// The `src/mobile` subtree and test files are skipped to avoid touching the
// separate mobile design system.

import { readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve('src');

// ── Mapping tables ──────────────────────────────────────────────────────────
// key: the hex value (normalized lowercase, no leading #)
// value: replacement token (already a complete Tailwind class body, e.g. 'bg-card')

const bgMap = {
  // deepest → background
  '0a0a0a': 'bg-background', '0c0c0c': 'bg-background', '0d0d0d': 'bg-background',
  '0e0e0e': 'bg-background', '111': 'bg-background', '111111': 'bg-background',
  '121212': 'bg-background', '141414': 'bg-background', '1a1a1a': 'bg-background',
  // panels → card
  '151515': 'bg-card', '161616': 'bg-card', '171717': 'bg-card', '181818': 'bg-card',
  '191919': 'bg-card', '1b1b1b': 'bg-card', '1c1c1c': 'bg-card', '1e1e1e': 'bg-card',
  '222': 'bg-card', '232323': 'bg-card', '242424': 'bg-card',
  // secondary surfaces
  '252525': 'bg-secondary', '282828': 'bg-secondary', '292929': 'bg-secondary',
  '2a2a2a': 'bg-secondary', '2e2e2e': 'bg-secondary',
  // menus
  '2d2d2d': 'bg-popover',
  // hover / active
  '303030': 'bg-accent', '323232': 'bg-accent', '333': 'bg-accent', '333333': 'bg-accent',
  '353535': 'bg-accent', '3a3a3a': 'bg-accent', '3d3d3d': 'bg-accent', '3e3e3e': 'bg-accent',
  '404040': 'bg-accent', '444': 'bg-accent', '444444': 'bg-accent', '4a4a4a': 'bg-accent',
  '4d4d4d': 'bg-accent', '4e4e4e': 'bg-accent', '5e5e5e': 'bg-accent', '666': 'bg-accent',
};

const borderMap = {
  '1e1e1e': 'border-border', '222': 'border-border', '252525': 'border-border',
  '282828': 'border-border', '2a2a2a': 'border-border', '2c2c2c': 'border-border',
  '2d2d2d': 'border-border', '2e2e2e': 'border-border', '303030': 'border-border',
  '333': 'border-border', '333333': 'border-border', '383838': 'border-border',
  '3a3a3a': 'border-border', '3e3e3e': 'border-border', '404040': 'border-border',
  '444': 'border-border', '4a4a4a': 'border-border', '4d4d4d': 'border-border',
  '4e4e4e': 'border-border', '505050': 'border-border', '555': 'border-border',
  '5e5e5e': 'border-border', 'a0a0a0': 'border-border',
};

const textMap = {
  '5a5a5a': 'text-muted-foreground/60', '555': 'text-muted-foreground/60',
  '606060': 'text-muted-foreground/70', '666': 'text-muted-foreground/70',
  '666666': 'text-muted-foreground/70', '6a6a6a': 'text-muted-foreground/70',
  '707070': 'text-muted-foreground/70', '7a7a7a': 'text-muted-foreground/80',
  '808080': 'text-muted-foreground/80', '888': 'text-muted-foreground',
  '888888': 'text-muted-foreground', '8a8a8a': 'text-muted-foreground',
  '909090': 'text-muted-foreground', '9a9a9a': 'text-muted-foreground',
  'a0a0a0': 'text-muted-foreground', 'aaa': 'text-muted-foreground',
  'b0b0b0': 'text-muted-foreground', 'c0c0c0': 'text-foreground/70',
  'd0d0d0': 'text-foreground/80', 'e0e0e0': 'text-foreground/90',
  'f0f0f0': 'text-foreground',
};

const specialMap = {
  'divide-[#3e3e3e]': 'divide-border',
  'from-[#3e3e3e]': 'from-accent',
  'from-[#252525]': 'from-secondary',
  'from-[#1a1a1a]': 'from-background',
  'to-[#252525]': 'to-secondary',
  'via-[#3e3e3e]': 'via-accent',
};

function buildLookup() {
  const lookup = new Map(); // full class token `bg-[#1e1e1e]` -> replacement
  for (const [hex, token] of Object.entries(bgMap)) lookup.set(`bg-[#${hex}]`, token);
  for (const [hex, token] of Object.entries(borderMap)) lookup.set(`border-[#${hex}]`, token);
  for (const [hex, token] of Object.entries(textMap)) lookup.set(`text-[#${hex}]`, token);
  for (const [k, v] of Object.entries(specialMap)) lookup.set(k, v);
  return lookup;
}

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (name === 'mobile' || name === 'node_modules' || name === '.graphify') continue;
      out.push(...walk(p));
    } else if (/\.(tsx|ts)$/.test(name) && !/\.test\./.test(name) && !name.endsWith('.raw')) {
      out.push(p);
    }
  }
  return out;
}

const lookup = buildLookup();
let total = 0;

for (const file of walk(ROOT)) {
  let src = readFileSync(file, 'utf8');
  let changed = false;
  for (const [token, replacement] of lookup) {
    // case-insensitive hex matching (some files use uppercase like #1A1A1A)
    const re = new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const matches = src.match(re);
    if (matches) {
      src = src.replace(re, replacement);
      total += matches.length;
      changed = true;
    }
  }
  if (changed) writeFileSync(file, src, 'utf8');
}

console.log(`Retokenized ${total} class occurrences across ${ROOT}.`);
