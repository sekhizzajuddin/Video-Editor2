// Convert `text-white` → `text-foreground` so text follows the theme.
//
// `text-white` is KEPT on colored/literal-dark backgrounds (buttons, gradient
// pills, black overlays) where white stays correct in both themes. It is
// converted everywhere else — i.e. on semantic neutral surfaces (bg-card,
// bg-accent, bg-secondary, ...) which flip to light in the light theme.
//
// Skips the mobile subtree, tests, and .raw files.

import { readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve('src');

// Line contains a background that stays white-on-visible in both themes.
const KEEP_WHITE =
  /(bg|from|to|via)-(amber|purple|blue|red|green|indigo|emerald|rose|orange|violet|cyan|teal|sky|pink|lime|yellow|fuchsia|black|zinc|neutral|gray|slate|stone)|bg-\[#/;

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

let converted = 0;
let kept = 0;

for (const file of walk(ROOT)) {
  const lines = readFileSync(file, 'utf8').split('\n');
  let changed = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.includes('text-white')) continue;
    if (KEEP_WHITE.test(line)) {
      kept += (line.match(/text-white/g) || []).length;
      continue;
    }
    const count = (line.match(/text-white/g) || []).length;
    lines[i] = line.replace(/text-white/g, 'text-foreground');
    converted += count;
    changed = true;
  }
  if (changed) writeFileSync(file, lines.join('\n'), 'utf8');
}

console.log(`Converted ${converted} text-white → text-foreground, kept ${kept} on colored/dark backgrounds.`);
