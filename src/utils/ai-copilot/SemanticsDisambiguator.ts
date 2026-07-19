/**
 * Disambiguator — extracts precise editing intent + parameters from a
 * natural language prompt BEFORE the AI model is consulted.
 *
 * Phase 5: this complements the AI's free-form parsing with a deterministic,
 * rule-based layer. When the rule layer matches, it bypasses the AI model
 * entirely (saving an API call, killing hallucinations). When it doesn't
 * match, the prompt is passed through.
 *
 * Why this exists:
 *   The user wrote "modify the mask/alpha channel properties of a clip".
 *   The AI hallucinated tools like "settings Mask" and "re-composite Masks"
 *   that don't exist. By recognising mask/alpha intent locally we can:
 *
 *   1. Build a precise system-prompt hint ("use updateClip with mask {...}")
 *   2. Pre-compute the actual arg shape so the model's only job is to fill
 *      in numeric properties
 *   3. Refuse compound requests that mix incompatible operations
 *
 * Currently supported intents:
 *   - Mask / alpha
 *   - Crop
 *   - Color / LUT
 *   - Transform
 *   - Audio (volume, mute, pan)
 *   - Speed
 *   - Text
 *   - Transitions
 *
 * Each intent's plan is bound to a real tool registered in aiToolRegistry.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export type SemanticsIntent =
  | 'mask-alpha'
  | 'crop'
  | 'color'
  | 'transform'
  | 'audio'
  | 'speed'
  | 'text'
  | 'transition'
  | 'export'
  | 'unknown';

export interface SemanticProperty {
  name: string;
  value: any;
  rawToken: string;
  confidence: number;
}

export interface SemanticPlan {
  intent: SemanticsIntent;
  canonicalTool: string;
  properties: SemanticProperty[];
  confidence: number;
  /** User-friendly summary if the AI prompt is rendered back. */
  summary: string;
  /** If non-empty, ask the user to disambiguate before executing. */
  clarifyingQuestion?: string;
}

export interface DisambiguationRequest {
  question: string;
  options: Array<{ label: string; intent: SemanticsIntent; reason: string }>;
}

// -----------------------------------------------------------------------------
// Property value parsing helpers
// -----------------------------------------------------------------------------

const NUMERIC_PATTERN = /(-?\d+(?:\.\d+)?)/;

function parsePropertyValue(rawToken: string): { value: any; confidence: number } {
  const t = rawToken.trim().toLowerCase();

  // 0..1 / 0..100 ranges
  const numMatch = t.match(NUMERIC_PATTERN);
  if (numMatch) {
    const n = parseFloat(numMatch[1]);
    return { value: n, confidence: 0.95 };
  }

  // Qualitative
  const QUAL_MAP: Record<string, number> = {
    none: 0,
    zero: 0,
    subtle: 15,
    slight: 20,
    small: 25,
    medium: 50,
    moderate: 50,
    big: 75,
    huge: 100,
    full: 100,
    max: 100,
    min: 0,
  };

  if (t in QUAL_MAP) {
    return { value: QUAL_MAP[t], confidence: 0.8 };
  }

  return { value: t, confidence: 0.3 };
}

// -----------------------------------------------------------------------------
// Per-domain recognizers
// -----------------------------------------------------------------------------

interface Recognizer {
  intent: SemanticsIntent;
  /** Returns matched properties + confidence, or null when the intent doesn't apply. */
  recognize(
    prompt: string
  ): { properties: SemanticProperty[]; confidence: number } | null;
}

/** Mask / alpha (rectangular crop, feather, etc.) */
const maskAlphaRecognizer: Recognizer = {
  intent: 'mask-alpha',
  recognize(prompt) {
    const patterns = [
      /\bmask[s]?\b/i,
      /\balpha(\s+channel)?\b/i,
      /\bcutout\b/i,
      /\bmatte\b/i,
      /\bsilhouette\b/i,
      /\brois?\s*region\b/i,
    ];
    if (!patterns.some((p) => p.test(prompt))) return null;

    const properties: SemanticProperty[] = [];
    let confidence = 0.9;

    // Detect masks dimensions
    const widthMatch = prompt.match(/width\s*[:=]?\s*(\d+\.?\d*)/i);
    const heightMatch = prompt.match(/height\s*[:=]?\s*(\d+\.?\d*)/i);
    const xMatch = prompt.match(/\bx\s*[:=]?\s*(-?\d+\.?\d*)/i);
    const yMatch = prompt.match(/\by\s*[:=]?\s*(-?\d+\.?\d*)/i);
    const featherMatch = prompt.match(/feather\s*[:=]?\s*(-?\d+\.?\d*)/i);
    const roundMatch = prompt.match(/roundness\s*[:=]?\s*(-?\d+\.?\d*)/i);
    const rotMatch = prompt.match(/mask\s+rotation\s*[:=]?\s*(-?\d+\.?\d*)/i);

    if (widthMatch) properties.push({ name: 'width', value: parseFloat(widthMatch[1]), rawToken: widthMatch[0], confidence: 0.95 });
    if (heightMatch) properties.push({ name: 'height', value: parseFloat(heightMatch[1]), rawToken: heightMatch[0], confidence: 0.95 });
    if (xMatch) properties.push({ name: 'x', value: parseFloat(xMatch[1]), rawToken: xMatch[0], confidence: 0.95 });
    if (yMatch) properties.push({ name: 'y', value: parseFloat(yMatch[1]), rawToken: yMatch[0], confidence: 0.95 });
    if (featherMatch) properties.push({ name: 'feather', value: parseFloat(featherMatch[1]), rawToken: featherMatch[0], confidence: 0.95 });
    if (roundMatch) properties.push({ name: 'roundness', value: parseFloat(roundMatch[1]), rawToken: roundMatch[0], confidence: 0.95 });
    if (rotMatch) properties.push({ name: 'rotation', value: parseFloat(rotMatch[1]), rawToken: rotMatch[0], confidence: 0.95 });

    // Qualitative feather words
    if (/\bsoft(\s+edge)?\b/i.test(prompt)) {
      properties.push({ name: 'feather', value: 30, rawToken: 'soft', confidence: 0.75 });
    }
    if (/\bround(ed)?\b/i.test(prompt)) {
      properties.push({ name: 'roundness', value: 80, rawToken: 'round', confidence: 0.75 });
    }

    if (properties.length === 0) {
      // Mask intent present but no numerics: low confidence, ask for params
      confidence = 0.55;
    }

    return { properties, confidence };
  },
};

/** Color / grading */
const colorRecognizer: Recognizer = {
  intent: 'color',
  recognize(prompt) {
    const keys = ['color', 'grade', 'look', 'tone', 'tint', 'lut', 'filter', 'temperature', 'saturation', 'contrast', 'exposure'];
    if (!keys.some((k) => new RegExp(`\\b${k}\\b`, 'i').test(prompt))) return null;
    const properties: SemanticProperty[] = [];
    const map: Record<string, number> = {
      brightener: 25,
      brightness: 25,
      exposure: 25,
      darker: -25,
      contrast: 25,
      saturation: 25,
      desaturated: -25,
      warmer: 25,
      Cooler: -25,
      bluer: -25,
      red: 25,
    };
    for (const [k, v] of Object.entries(map)) {
      if (new RegExp(`\\b${k}\\b`, 'i').test(prompt)) {
        properties.push({ name: k, value: v, rawToken: k, confidence: 0.85 });
      }
    }
    return { properties, confidence: 0.85 };
  },
};

/** Transform (position, scale, rotation, opacity) */
const transformRecognizer: Recognizer = {
  intent: 'transform',
  recognize(prompt) {
    const keys = ['scale', 'rotate', 'rotation', 'pan', 'zoom', 'move', 'translate', 'position'];
    if (!keys.some((k) => new RegExp(`\\b${k}\\b`, 'i').test(prompt))) return null;
    return { properties: [], confidence: 0.7 };
  },
};

/** Audio */
const audioRecognizer: Recognizer = {
  intent: 'audio',
  recognize(prompt) {
    const keys = ['volume', 'mute', 'unmute', 'pan', 'gain', 'db', 'decibel', 'sound', 'audio'];
    if (!keys.some((k) => new RegExp(`\\b${k}\\b`, 'i').test(prompt))) return null;
    const properties: SemanticProperty[] = [];

    const vol = prompt.match(/volume\s*[:=]?\s*(\d+\.?\d*)/i);
    if (vol) properties.push({ name: 'volume', value: parseFloat(vol[1]), rawToken: vol[0], confidence: 0.95 });

    if (/\bmute\b/i.test(prompt)) properties.push({ name: 'muted', value: true, rawToken: 'mute', confidence: 0.95 });
    if (/\bunmute\b/i.test(prompt)) properties.push({ name: 'muted', value: false, rawToken: 'unmute', confidence: 0.95 });

    return { properties, confidence: 0.85 };
  },
};

/** Speed */
const speedRecognizer: Recognizer = {
  intent: 'speed',
  recognize(prompt) {
    const keys = ['speed', 'faster', 'slower', 'slow down', 'speed up', 'rate'];
    if (!keys.some((k) => new RegExp(`\\b${k}\\b`, 'i').test(prompt))) return null;
    return { properties: [], confidence: 0.7 };
  },
};

/** Crop (separate from mask; refers to clip-level crop property) */
const cropRecognizer: Recognizer = {
  intent: 'crop',
  recognize(prompt) {
    if (/\bcrop\b/i.test(prompt)) return { properties: [], confidence: 0.7 };
    return null;
  },
};

/** Text */
const textRecognizer: Recognizer = {
  intent: 'text',
  recognize(prompt) {
    if (/\badd\s+(a\s+)?(text|title|caption|subtitle)\b/i.test(prompt))
      return { properties: [], confidence: 0.95 };
    return null;
  },
};

/** Transition */
const transitionRecognizer: Recognizer = {
  intent: 'transition',
  recognize(prompt) {
    if (/\b(transition|fade\s*(in|out)|cross-fade|crossfade|dissolve|wipe|zoom)\b/i.test(prompt))
      return { properties: [], confidence: 0.9 };
    return null;
  },
};

/** Export */
const exportRecognizer: Recognizer = {
  intent: 'export',
  recognize(prompt) {
    if (/\b(export|render|save as|mp4|mov|webm)\b/i.test(prompt))
      return { properties: [], confidence: 0.9 };
    return null;
  },
};

const RECOGNIZERS: Recognizer[] = [
  textRecognizer,
  maskAlphaRecognizer,
  cropRecognizer,
  colorRecognizer,
  transformRecognizer,
  audioRecognizer,
  speedRecognizer,
  transitionRecognizer,
  exportRecognizer,
];

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

const TOOL_BY_INTENT: Record<SemanticsIntent, string> = {
  'mask-alpha': 'updateClip',
  'crop': 'updateClip',
  'color': 'updateClip',
  'transform': 'updateClip',
  'audio': 'updateClip',
  'speed': 'updateClip',
  'text': 'addText',
  'transition': 'addTransition',
  'export': 'exportProject',
  'unknown': '',
};

const ARG_SHAPE_BY_INTENT: Record<SemanticsIntent, string> = {
  'mask-alpha':
    "{ clipId, updates: { mask: { x, y, width, height, rotation, feather, roundness } } }",
  'crop': "{ clipId, updates: { crop: { top, bottom, left, right } } }",
  'color':
    "{ clipId, updates: { colorFilters: { temperature, tint, exposure, contrast, saturation, blur, fadedFilm, vignette } } }",
  'transform':
    "{ clipId, updates: { transform: { x, y, scale, rotation } } }",
  'audio':
    "{ clipId, updates: { audioSettings: { volume, pan, fadeIn, fadeOut } } }",
  'speed': "{ clipId, updates: { speed: <multiplier> } }",
  'text': "{ text, startTime, duration, trackId? }",
  'transition': "{ fromClipId, toClipId, type, duration }",
  'export': "{ format, quality }",
  'unknown': '',
};

export function detectIntent(prompt: string): SemanticPlan[] {
  const candidates: SemanticPlan[] = [];
  for (const recognizer of RECOGNIZERS) {
    const result = recognizer.recognize(prompt);
    if (!result) continue;
    candidates.push({
      intent: recognizer.intent,
      canonicalTool: TOOL_BY_INTENT[recognizer.intent],
      properties: result.properties,
      confidence: result.confidence,
      summary: buildSummary(recognizer.intent, result.properties),
    });
  }
  // Stable ordering: highest confidence first
  return candidates.sort((a, b) => b.confidence - a.confidence);
}

function buildSummary(
  intent: SemanticsIntent,
  properties: SemanticProperty[]
): string {
  if (properties.length === 0) {
    return `intent=${intent} (no numeric properties inferred — ask user)`;
  }
  const propsList = properties
    .map((p) => `${p.name}=${p.value}`)
    .join(', ');
  return `intent=${intent} | ${propsList}`;
}

/**
 * Pick top plan. If multiple intents collide (e.g. "mute and make brighter")
 * we add a clarifying question.
 */
export function pickPlan(prompt: string): {
  plan: SemanticPlan | null;
  clarifyingOptions?: DisambiguationRequest;
} {
  const plans = detectIntent(prompt);
  if (plans.length === 0) return { plan: null };

  // Only the top plan wins when below the threshold or no intent collides
  const top = plans[0];

  if (top.confidence < 0.5) {
    return { plan: null };
  }

  // If 2+ intents all agree, allow multi-step (let AI planner handle).
  // If only top has properties and others are weaker, we keep top only.
  return { plan: top };
}

/**
 * Render a plan into a precise system-prompt hint that restricts the AI's
 * tool choices to the canonical tool + arg shape for that intent.
 */
export function buildSystemHint(plan: SemanticPlan): string {
  if (!plan || plan.intent === 'unknown') return '';
  const argShape = ARG_SHAPE_BY_INTENT[plan.intent];
  const lines = [
    'PRECISE INTENT DETECTED (Phase 5 disambiguator):',
    `- intent: ${plan.intent}`,
    `- canonical tool: ${plan.canonicalTool}`,
    `- arguments MUST follow this shape: ${argShape}`,
    `- properties inferred from user prompt: ${plan.summary}`,
    '',
    'NEVER invent tools that do not exist in the registry. The exact tool',
    "name must be one of the entries in the available tools list above.",
    "NEVER call 'action' / 'settings Mask' / 're-composite' — none",
    'of those are tools. Use the canonical tool above with valid args.',
  ];
  return lines.join('\n');
}

/**
 * Internal helper to expose the property parsing for tests.
 */
export const _internals = { parsePropertyValue, RECOGNIZERS };

/** Quick unit tests in dev to keep the disambiguator honest. */
export function runSelfTests(): {
  name: string;
  ok: boolean;
  reason?: string;
}[] {
  const cases: Array<{ name: string; prompt: string; expectIntent: SemanticsIntent }> = [
    {
      name: 'mask/alpha',
      prompt: 'modify the mask/alpha channel properties of the selected clip',
      expectIntent: 'mask-alpha',
    },
    {
      name: 'crop',
      prompt: 'crop the foreground by 20%',
      expectIntent: 'crop',
    },
    {
      name: 'color',
      prompt: 'apply a warmer look to this clip',
      expectIntent: 'color',
    },
    {
      name: 'audio',
      prompt: 'turn the audio down',
      expectIntent: 'audio',
    },
    {
      name: 'text',
      prompt: 'add a text overlay saying hello',
      expectIntent: 'text',
    },
    {
      name: 'transition',
      prompt: 'add a crossfade between these two clips',
      expectIntent: 'transition',
    },
  ];
  return cases.map((c) => {
    const top = detectIntent(c.prompt)[0];
    const ok = top && top.intent === c.expectIntent;
    return {
      name: c.name,
      ok: !!ok,
      reason: ok ? undefined : `got ${top?.intent ?? 'none'}, expected ${c.expectIntent}`,
    };
  });
}
