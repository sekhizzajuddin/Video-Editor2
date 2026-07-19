/**
 * VocabularyCorrections — normalizes recognized misspellings, abbreviations,
 * and jargon. Three layers:
 *
 *   1. TOKEN_NORMALIZE: word-level edits (e.g. "modifl" -> "modify")
 *   2. PHRASE_NORMALIZE: multi-word rewrites (e.g. "make smaller" -> "trim")
 *   3. DOMAIN_TERMS: maps synonyms to canonical video-editing vocabulary so
 *      downstream prompts/tool args use precise, recognizable names.
 *
 * Why this exists:
 *   The AI generated "modifl the mask/alpha channel properties" and invented
 *   fake tool names like "settings Mask" / "re-composite Masks" - neither
 *   matches anything in the AI tool registry, and the user typed "modify"
 *   correctly. The model hallucinates when prompt phrasing is loose. So we
 *   normalize BEFORE the prompt reaches the model, and we restrict what the
 *   model is allowed to say about tools afterward.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface CorrectionStats {
  tokensFixed: number;
  phrasesFixed: number;
  unused: number[];
}

export interface VocabularySnapshot {
  normalizedInput: string;
  originalInput: string;
  correctionsApplied: CorrectionEntry[];
}

export interface CorrectionEntry {
  original: string;
  corrected: string;
  kind: 'typo' | 'phrase' | 'domain';
}

// -----------------------------------------------------------------------------
// 1) TOKEN NORMALIZE (word-level fixes)
// -----------------------------------------------------------------------------

interface TokenFix {
  patterns: RegExp[];
  replacement: string;
}

const TOKEN_FIXES: TokenFix[] = [
  {
    patterns: [
      /\bmodif[a-z]{0,3}\b/gi,
      /\bmodf[a-z]{0,3}\b/gi,
    ],
    replacement: 'modify',
  },
  {
    patterns: [/\bchanel\b/gi, /\bchanel?\b/gi, /\bchannl\b/gi, /\bchannel?\b/gi],
    replacement: 'channel',
  },
  {
    patterns: [/\bseting[s]?\b/gi, /\bsetng[s]?\b/gi, /\bsetting\b/gi],
    replacement: 'setting',
  },
  {
    patterns: [
      /\bmaske?t?\b/gi,
      /\bam?sk\b/gi,
      /\bmaskes\b/gi,
    ],
    replacement: 'mask',
  },
  {
    patterns: [
      /\balhpa\b/gi,
      /\bapha\b/gi,
      /\bal\s*h\s*pa\b/gi,
      /\bal[hp]ha\b/gi,
    ],
    replacement: 'alpha',
  },
  {
    patterns: [/\bcropp?\b/gi],
    replacement: 'crop',
  },
  {
    patterns: [/\bcomposit\ss?\b/gi, /\bcomposte?\b/gi, /\bre[\s-]?composit\b/gi, /\brecomposit\b/gi],
    replacement: 're-composite',
  },
  {
    patterns: [/\bquanit\w?\b/gi],
    replacement: 'quantity',
  },
  {
    patterns: [/qiuality/gi, /\bqualiy\b/gi, /\bqualtity\b/gi],
    replacement: 'quality',
  },
  {
    patterns: [/\bsounde?\b/gi],
    replacement: 'sound',
  },
  {
    patterns: [/\bcoulor\b/gi],
    replacement: 'color',
  },
  {
    patterns: [/\bsaturation\b/gi],
    replacement: 'saturation',
  },
  {
    patterns: [/\btriming\b/gi],
    replacement: 'trimming',
  },
];

// -----------------------------------------------------------------------------
// 2) PHRASE NORMALIZERS
// -----------------------------------------------------------------------------

const PHRASE_FIXES: ReadonlyArray<readonly [RegExp, string]> = [
  // Mask / alpha phrasing
  [
    /(change|edit|update|alter|adjust)\s+(the\s+)?(mask|alpha)(\s+of|\s+for)\s+(the\s+)?(clip|selection)/gi,
    'modify the mask and alpha properties of the selected clip',
  ],
  [
    /\b(mask|alpha)(\s+and\s+|\s+\/?\s+|\s*or\s*)(alpha|mask)\b/gi,
    'mask and alpha',
  ],

  // Make smaller / larger / brighter / darker
  [/\bmake (?:a |the )?(?:clip|video) (smaller|shorter|more compact)\b/gi, 'trim the clip duration'],
  [/\bmake (?:a |the )?(?:clip|video) (bigger|larger|longer)\b/gi, 'extend the clip duration'],
  [/\bmake (?:this |the |a |it )?(?:image|video|clip) (brighter|lighter)\b/gi, 'increase exposure by 25'],
  [/\bmake (?:this |the |a |it )?(?:image|video|clip) (darker)\b/gi, 'decrease exposure by 25'],
  [/\bmake it (brighter|lighter)\b/gi, 'increase exposure by 25'],
  [/\bmake it (darker)\b/gi, 'decrease exposure by 25'],

  // LUT / filter
  [/\b(apply|use|put) (a )?(cinematic|hollywood)\s+(look|grade|filter)\b/gi, 'apply a cinematic LUT'],
  [/\b(make|turn) (?:it )?(more blue|cooler)\b/gi, 'set temperature to -25'],
  [/\b(make|turn) (?:it )?(more red|warmer)\b/gi, 'set temperature to 25'],

  // Volume
  [/\b(turn (?:it |the volume )?up|raise (?:the )?volume|increase volume|louder)\b/gi, 'set volume to 80'],
  [/\b(turn (?:it |the volume )?down|lower (?:the )?volume|quieter)\b/gi, 'set volume to 20'],
  [/\bmute (?:the audio|the clip|the sound)\b/gi, 'mute the audio track'],
];

// -----------------------------------------------------------------------------
// 3) DOMAIN TERMS
// -----------------------------------------------------------------------------

export const DOMAIN_TERMS = {
  'mask / alpha': {
    canonical: 'mask',
    description:
      'Per-clip crop/silhouette used to define visibility; stored under clip.mask = { x, y, width, height, rotation, feather, roundness }. Use updateClip with args { updates: { mask: {...} } }.',
    relatedTerms: [
      'alpha channel',
      'opacity mask',
      'roi',
      'crop',
      'cutout',
      'silhouette',
      'feather',
      'matte',
    ],
  },
  'color / lut': {
    canonical: 'color',
    description:
      'Stored under colorFilters = { temperature, tint, exposure, contrast, saturation, blur, fadedFilm, vignette }.',
    relatedTerms: ['grade', 'look', 'tone', 'filter', 'LUT', 'cinematic', 'warm', 'cool'],
  },
  'transform': {
    canonical: 'transform',
    description:
      'Stored under transform = { x, y, scale, rotation, flipH, flipV, blendMode }.',
    relatedTerms: ['pan', 'zoom', 'move', 'scale', 'rotate'],
  },
  'keyframes': {
    canonical: 'keyframe',
    description:
      'Animation over time. Use addMasterKeyframe. Properties: transform, opacity, color, audio, mask.',
    relatedTerms: ['animate', 'motion', 'tween'],
  },
  'effects': {
    canonical: 'effect',
    description:
      'Apply clip-level effects via updateClip with effects[] payload.',
    relatedTerms: ['shader', 'overlay', 'particles', 'chroma'],
  },
  'transitions': {
    canonical: 'transition',
    description: 'Between two clips. addTransition(fromClipId, toClipId, type, duration).',
    relatedTerms: ['crossfade', 'dissolve', 'fade'],
  },
  'text / captions': {
    canonical: 'caption',
    description: 'addText(text, startTime, duration, trackId).',
    relatedTerms: ['subtitle', 'caption', 'title'],
  },
  'export': {
    canonical: 'export',
    description:
      'exportProject(format, quality). Confirm with user first.',
    relatedTerms: ['render', 'save as', 'mp4', 'mov', 'webm'],
  },
  'audio': {
    canonical: 'audio',
    description:
      'Per-clip audio settings: audioSettings.{volume, pan, fadeIn, fadeOut, bass, mid, treble, muted}.',
    relatedTerms: ['sound', 'volume', 'loudness', 'BGM', 'SFX', 'soundtrack', 'voiceover', 'voice over', 'voice-over'],
  },
  'selection': {
    canonical: 'selection',
    description:
      'Currently selected clip(s) in selectedClipIds. If empty, the system prompt asks for clarification.',
    relatedTerms: ['selected', 'picked', 'highlighted'],
  },
} as const;

export function getDomainVocabularyList(): string {
  return Object.entries(DOMAIN_TERMS)
    .map(([term, def]) => {
      const synonyms = def.relatedTerms.slice(0, 6).join(', ');
      return `- **${term}** (canonical: \`${def.canonical}\`): ${def.description}  Synonyms: ${synonyms}.`;
    })
    .join('\n');
}

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

/**
 * Normalize a string by replacing typos and phrases.
 * Returns the original string if nothing changed.
 */
export function normalizeVocabulary(input: string): string {
  let out = input;
  for (const fix of TOKEN_FIXES) {
    for (const pattern of fix.patterns) {
      out = out.replace(pattern, fix.replacement);
    }
  }
  for (const fix of PHRASE_FIXES) {
    out = out.replace(fix[0], fix[1]);
  }
  return out;
}

/**
 * Apply a fix and report what was changed. Used by buildVocabularySnapshot.
 */
function applyAndRecord(
  input: string,
  patterns: ReadonlyArray<RegExp>,
  replacement: string,
  correctionsApplied: CorrectionEntry[],
  kind: CorrectionEntry['kind'],
  iterateByPattern: boolean
): { result: string } {
  let working = input;
  for (const pattern of patterns) {
    const matches = working.match(pattern);
    if (matches && matches.length > 0) {
      for (const match of matches) {
        // Skip recording corrections that don't actually change anything.
        // `modify` -> `modify` should not pollute the corrections log.
        if (match.toLowerCase() === replacement.toLowerCase()) {
          working = working.replace(pattern, replacement);
          if (!iterateByPattern) break;
          continue;
        }
        correctionsApplied.push({
          original: match,
          corrected: replacement,
          kind,
        });
      }
      working = working.replace(pattern, replacement);
      if (!iterateByPattern) break;
    }
  }
  return { result: working };
}

/**
 * Build a snapshot of all corrections applied to `input`.
 */
export function buildVocabularySnapshot(input: string): VocabularySnapshot {
  const correctionsApplied: CorrectionEntry[] = [];
  let working = input;

  // Phrases first (longer matches)
  for (const [pattern, replacement] of PHRASE_FIXES) {
    const r = applyAndRecord(
      working,
      [pattern],
      replacement,
      correctionsApplied,
      'phrase',
      false
    );
    working = r.result;
  }

  // Tokens (shorter matches, multiple patterns each capture one form)
  for (const fix of TOKEN_FIXES) {
    const r = applyAndRecord(
      working,
      fix.patterns,
      fix.replacement,
      correctionsApplied,
      'typo',
      true
    );
    working = r.result;
  }

  return {
    normalizedInput: working,
    originalInput: input,
    correctionsApplied,
  };
}

/**
 * Build a hint string for the AI system prompt explaining the corrections.
 */
export function buildVocabularyHint(input: string): string {
  const snap = buildVocabularySnapshot(input);
  if (snap.correctionsApplied.length === 0) return '';

  const lines: string[] = [
    'USER VOCABULARY CORRECTIONS (already applied):',
    'Original user message: ' + JSON.stringify(snap.originalInput),
    'Normalized for model consumption: ' + JSON.stringify(snap.normalizedInput),
  ];
  for (const c of snap.correctionsApplied.slice(0, 8)) {
    lines.push(
      `- ${c.kind.toUpperCase()}: ${JSON.stringify(c.original)} -> ${JSON.stringify(c.corrected)}`
    );
  }
  return lines.join('\n');
}

// -----------------------------------------------------------------------------
// Self-tests
// -----------------------------------------------------------------------------

export function runSelfTests(): { name: string; ok: boolean; reason?: string }[] {
  const tests: Array<{
    name: string;
    input: string;
    expectedOutputs: string[];
  }> = [
    {
      name: 'typo: modifl -> modify',
      input: 'modifl the mask',
      expectedOutputs: ['modify the mask'],
    },
    {
      name: 'typo: alhpa -> alpha',
      input: 'set the alhpa of the clip',
      expectedOutputs: ['set the alpha of the clip'],
    },
    {
      name: 'phrase: change the mask of the clip',
      input: 'change the mask of the clip',
      expectedOutputs: ['modify the mask and alpha properties of the selected clip'],
    },
    {
      name: 'phrase: make brighter',
      input: 'make this clip brighter',
      expectedOutputs: ['increase exposure by 25'],
    },
    {
      name: 'phrase: turn it down',
      input: 'turn it down please',
      expectedOutputs: ['set volume to 20'],
    },
  ];

  return tests.map((t) => {
    const got = normalizeVocabulary(t.input);
    const ok = t.expectedOutputs.every((expected) => got.includes(expected));
    return { name: t.name, ok, reason: ok ? undefined : `got: "${got}"` };
  });
}
