import { fetchWithKeyFailover } from './apiKeyManager';
import { compileStoryboard, StoryboardChunk } from './storyboardCompiler';
import {
  MotionGraphicSpec,
  MotionGraphicVideo,
  renderMotionGraphicToVideo,
} from './motionGraphicRenderer';
import { generateImageFromCloudflare } from './cloudflareClient';
import { sanitizeMotionSceneHtml, probeCaptureCapabilities } from './cssSceneRasterizer';

/**
 * Model candidates, tried in order. A 404 (model not available on this key /
 * region) falls through to the next one instead of failing the whole generate
 * step — previously a single bad model id killed the entire pipeline.
 */
const GEMINI_MODEL_CANDIDATES = [
  'gemini-3.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
];

const GROQ_MODEL_CANDIDATES = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];

export interface GenerativeMotionOptions {
  provider: 'gemini' | 'groq';
  style: string; // 'vox' | 'documentary' | 'kurzgesagt' | 'mrbeast' | 'hormozi' | 'cyberpunk' | 'minimal' | 'editorial' | 'mixed'
  layout: string; // 'kinetic' | 'lower_third' | 'subtitle' | 'mixed'
  customPrompt?: string;
  targetDuration?: number; // for text-to-motion mode
  dialogueText?: string; // for text-to-motion mode (no clip)
  signal?: AbortSignal;
  /** Strip opaque full-frame backdrops so the overlay composites on video. */
  transparent?: boolean;
}

export interface GenerativeResult {
  spec: MotionGraphicSpec;
  transcribedText: string;
  video: MotionGraphicVideo | null;
  /** Validator notes from the design pass (empty when the first pass passed). */
  designNotes: string[];
}

/**
 * Per-style art direction. Without this the model defaults to the easiest thing
 * it knows — big animated words — instead of building an actual scene.
 */
const STYLE_ART_DIRECTION: Record<string, string> = {
  vox: `VOX EXPLAINER — True 3D Isometric HTML5 Game Style
  • CRITICAL REQUIREMENT: YOU MUST WRAP THE ENTIRE SCENE IN AN ISOMETRIC GROUP. 
    You must output: <g class="isometric-world">
    And in CSS: .isometric-world { transform: rotateX(60deg) rotateZ(-45deg); transform-style: preserve-3d; transform-origin: center center; }
  • ALL objects (buildings, cars, trees, mountains) MUST be constructed as 3D blocks using 3 polygons (top, left face, right face) with 3 different brightness shades (e.g., top=lightest, left=mid, right=dark).
  • DO NOT DRAW FLAT 2D OBJECTS. A house is not a flat rectangle; it is a 3D rectangular prism.
  • Build a miniature 3D city/world grid. Use <path> for thick roads.
  • Do not be lazy. You must build a FULLY DESIGNED, PROFESSIONAL-GRADE SCENE with recognizable 3D objects.
  • Data is physical: values become 3D towers, stacked cubes, floating spheres.
  • Annotation layer: 2px leader lines, floating labels (these must NOT be inside the isometric group so they face the camera).
  • Depth: Use Z-translation (transform: translateZ) for floating objects or heights.`,

  documentary: `DOCUMENTARY (Vox / Johnny Harris) — map-first vector journalism
• Lead with a MAP or a MAP-LIKE DIAGRAM: coastline/country outlines as <path>, city dots,
  route lines that draw themselves, region fills that pop in one by one.
• Then build the subject on top: terrain, buildings, simple flat people, vehicles.
• Data becomes objects: bars as towers, populations as dot clusters, change as growing paths.
• Annotation layer: leader lines, pill labels, underlines, circled focus areas.
• Palette: cool neutrals + one hot accent (#f97316 or #fbbf24) for the thing being pointed at.
• Camera: slow pan/zoom achieved by transforming the world group, never by moving text.`,

  kurzgesagt: `KURZGESAGT — bright isometric vector diorama
• Isometric/2.5D: everything sits on a rhombus ground plate; objects are extruded
  (top face + two side faces in 3 shades of the same hue).
• Saturated palette, thick rounded strokes, soft outer glow on the hero object.
• Tiny detailed characters (head + body + limbs as separate shapes).
• Circular motifs: orbits, rings, radial bursts behind the hero object.
• Everything is chunky and readable at a glance; fill the frame with objects, not words.`,

  mrbeast: `MRBEAST HYPE — bold pop
• Huge outlined headline text (thick stroke + hard drop shadow) but it sits ON TOP of
  a busy background of comic bursts, starbursts, confetti shards and chunky 3D-ish blocks.
• Primary red/yellow/white/black. Extreme scale overshoot, screen shake on impacts.
• Every beat gets a physical object: a stack of cash, a rocket, a trophy, a bar that slams up.`,

  hormozi: `ALEX HORMUZI — offer/snapping badges
• Dark slate base + lime/amber accent. Value props snap in as thick rounded badges with
  a hard shadow offset; numbers count up inside pill containers.
• Chunky arrows slam in pointing at the number that matters; a progress bar fills.
• Everything snaps with a fast overshoot (0.25-0.35s) and a tiny bounce.`,

  cyberpunk: `NEON CYBERPUNK HUD
• Perspective grid floor, horizon glow, scanlines, corner brackets, monospace labels.
• Neon strokes (#22d3ee / #f0abfc / #a3e635) with glow via feGaussianBlur or a blurred duplicate shape.
• Data as HUD panels: bar graphs, radar arcs, streaming ticker rows, glitch-offset duplicates.`,

  minimal: `MINIMAL / SWISS — restrained vector typography
• Very few elements, huge negative space, one accent colour.
• Thin rules, small circles and simple geometric marks that underline the words.
• Slow, elegant easing (cubic-bezier(.16,1,.3,1)); nothing bounces.`,

  editorial: `VINTAGE NEWSPAPER / PAPER CUTOUT
• Torn-paper shapes, halftone dot pattern (SVG <pattern>), ink-black serif headlines,
  aged cream paper scraps rotated a few degrees, red stamp circle, crop marks.
• Photos are simulated as duotone rects with a halftone overlay, never real images.`,

  mixed: `MIXED — you choose the strongest vector style for the dialogue, but it MUST still be
a built scene (objects, map, diagram or data made physical), not just animated words.`,
};

/** How many SVG shape elements a scene must contain before we accept it. */
function minimumShapeCount(style: string): number {
  if (style === 'vox' || style === 'kurzgesagt' || style === 'documentary') return 12;
  if (style === 'minimal') return 5;
  if (style === 'mrbeast' || style === 'hormozi') return 8;
  return 8;
}

const SHAPE_TAGS = /<(polygon|path|rect|circle|ellipse|line|polyline|use)\b/gi;

function countSvgShapes(html: string): number {
  if (!html) return 0;
  const matches = html.match(SHAPE_TAGS);
  return matches ? matches.length : 0;
}

/**
 * Rejects "typography-only" designs. The model's default is animated words, which
 * is exactly what users don't want when they pick a Vox/Kurzgesagt style — so we
 * score the result and send it back with a correction instead of shipping it.
 */
export function validateSceneQuality(spec: MotionGraphicSpec, style: string): string[] {
  const issues: string[] = [];

  if (spec.htmlCssScenes.length === 0) {
    issues.push(
      'No htmlCssScenes were produced at all — the result is typography only. Every scene must be built from SVG vector artwork.'
    );
  }

  const minimum = minimumShapeCount(style);
  spec.htmlCssScenes.forEach((scene, index) => {
    const shapes = countSvgShapes(scene.htmlCss);
    if (shapes < minimum) {
      issues.push(
        `Scene ${index + 1} ("${scene.description || 'untitled'}") contains only ${shapes} SVG shape elements, ` +
          `but a "${style}" scene needs at least ${minimum}. Add real artwork: <polygon>, <path>, <rect>, ` +
          `<circle>, <ellipse>, <line> arranged into recognisable objects (terrain, buildings, people, ` +
          `maps, charts) — not more text.`
      );
    }
  });

  return issues;
}

/**
 * Orchestrates end-to-end AI motion graphic generation:
 * 1. Extracts video frames/storyboards or processes raw dialogue text.
 * 2. Prompts Gemini / Groq with the art direction for the chosen style.
 * 3. Validates the design (vector density) and retries once with a correction.
 * 4. Sanitizes the motion graphic specification.
 * 5. Resolves optional Cloudflare AI image assets.
 * 6. Renders the composition into a WebM overlay (real alpha, or a keyed plate).
 */
export async function generateMotionGraphicsFromDialogue(
  clipMediaUrl: string | null,
  clipDuration: number,
  options: GenerativeMotionOptions,
  onProgress: (step: string, pct: number) => void
): Promise<GenerativeResult> {
  const provider = options.provider || 'gemini';
  let targetDuration = options.targetDuration || clipDuration || 5;
  const dialogueText = options.dialogueText || '';
  let storyboardChunks: StoryboardChunk[] = [];

  // 1. Ingestion: Extract video storyboard frames or prepare dialogue text
  let inlineAudioBase64: string | null = null;
  let inlineAudioMime: string | null = null;

  if (clipMediaUrl) {
    onProgress('Extracting video frames and audio', 10);
    const videoEl = document.createElement('video');
    try {
      videoEl.crossOrigin = 'anonymous';
      videoEl.muted = true;
      videoEl.playsInline = true;
      videoEl.preload = 'auto';
      videoEl.src = clipMediaUrl;

      await new Promise<void>((resolve) => {
        if (videoEl.readyState >= 1) {
          resolve();
          return;
        }
        let done = false;
        const complete = () => {
          if (!done) {
            done = true;
            resolve();
          }
        };
        videoEl.onloadedmetadata = complete;
        videoEl.oncanplay = complete;
        videoEl.onerror = complete;
        setTimeout(complete, 3000);
      });

      const effectiveDuration =
        videoEl.duration && !isNaN(videoEl.duration) && isFinite(videoEl.duration)
          ? videoEl.duration
          : targetDuration;
      targetDuration = effectiveDuration;

      storyboardChunks = await compileStoryboard(
        videoEl,
        0,
        Math.min(effectiveDuration, 30),
        (pct) => onProgress('Extracting video frames', Math.round(10 + pct * 5)),
        1
      );

      if (provider === 'gemini') {
        onProgress('Preparing audio for Gemini', 18);
        try {
          const res = await fetch(clipMediaUrl);
          const blob = await res.blob();
          if (blob.size < 15 * 1024 * 1024) {
            const buffer = await blob.arrayBuffer();
            const bytes = new Uint8Array(buffer);
            let binary = '';
            for (let i = 0; i < bytes.byteLength; i += 8192) {
              binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 8192)));
            }
            inlineAudioBase64 = btoa(binary);
            inlineAudioMime = blob.type || 'video/mp4';
          }
        } catch (e) {
          console.warn('[generateMotionGraphicsFromDialogue] Audio extraction failed:', e);
        }
      }
    } catch (err) {
      console.warn('[generateMotionGraphicsFromDialogue] Frame extraction warning:', err);
    } finally {
      try {
        videoEl.removeAttribute('src');
        videoEl.load();
      } catch {
        /* ignore */
      }
    }
    onProgress('Frames extracted', 20);
  } else {
    onProgress('Preparing motion design', 20);
  }

  // 2. Design pass (with one automatic correction loop)
  onProgress('AI Designing visual scenes', 40);

  const style = options.style || 'mixed';

  // Some engines (Safari and friends) cannot rasterize HTML inside an SVG image
  // at all, so an htmlCssScenes design renders as a completely empty overlay —
  // the "purple screen" failure. Ask the model for a canvas-only design instead
  // of shipping markup we know we cannot draw.
  let canRasterizeHtml = true;
  try {
    // BYPASS PROBE: Chromium sometimes fails this probe falsely.
    // We already fixed the CORS tainting by using base64 data URIs.
    const caps = await probeCaptureCapabilities();
    canRasterizeHtml = true; // FORCE true so AI always generates HTML/CSS
    console.log('[generateMotionGraphicsFromDialogue] Probe result:', caps, 'Forcing canRasterizeHtml=true');
  } catch {
    canRasterizeHtml = true;
  }

  const basePrompt = buildAiMotionPrompt(
    dialogueText,
    targetDuration,
    options,
    storyboardChunks.length > 0,
    canRasterizeHtml
  );

  const designParts: any[] = [];
  if (inlineAudioBase64 && inlineAudioMime && provider === 'gemini') {
    designParts.push({ inlineData: { mimeType: inlineAudioMime, data: inlineAudioBase64 } });
    designParts.push({
      text: 'Please transcribe the audio from the provided media file and use it as the dialogue for the motion graphics. Then output the JSON as instructed.',
    });
  }
  if (provider === 'gemini') {
    for (const chunk of storyboardChunks) {
      designParts.push({ inlineData: { mimeType: 'image/jpeg', data: chunk.base64Image } });
    }
  }

  let rawSpec = await requestDesign(provider, [...designParts, { text: basePrompt }], options.signal);
  let spec = sanitizeMotionGraphicSpec(rawSpec, targetDuration, canRasterizeHtml);
  let issues = validateSceneQuality(spec, style);

  if (issues.length > 0) {
    onProgress('Refining design (adding vector artwork)', 52);
    console.warn('[generateMotionGraphicsFromDialogue] Design rejected:', issues);
    try {
      const corrected = await requestDesign(
        provider,
        [...designParts, { text: buildCorrectionPrompt(issues, style, targetDuration, dialogueText, options.transparent !== false) }],
        options.signal
      );
      const correctedSpec = sanitizeMotionGraphicSpec(corrected, targetDuration, canRasterizeHtml);
      const correctedIssues = validateSceneQuality(correctedSpec, style);
      if (correctedIssues.length < issues.length) {
        rawSpec = corrected;
        spec = correctedSpec;
        issues = correctedIssues;
      }
    } catch (err) {
      console.warn('[generateMotionGraphicsFromDialogue] Correction pass failed:', err);
    }
  }

  onProgress('Validating design specification', 55);

  let transcribedText = dialogueText;
  if (typeof rawSpec?.transcribedText === 'string' && rawSpec.transcribedText.trim()) {
    transcribedText = rawSpec.transcribedText;
  }

  // 3. Optional Cloudflare AI image generation if imageAssets are requested
  if (Array.isArray(rawSpec?.imageAssets) && rawSpec.imageAssets.length > 0) {
    onProgress('Generating AI image assets (Cloudflare)', 60);
    try {
      const { useEditorStore } = await import('@/store/editorStore');
      const state = useEditorStore.getState();
      const accountId =
        state.settings?.cloudflareAccountId ||
        (import.meta as any).env?.VITE_CLOUDFLARE_ACCOUNT_ID;
      const apiToken =
        state.settings?.cloudflareApiToken ||
        (import.meta as any).env?.VITE_CLOUDFLARE_API_TOKEN;

      if (accountId && apiToken) {
        for (const asset of rawSpec.imageAssets) {
          if (asset.prompt && asset.id) {
            try {
              const imageUrl = await generateImageFromCloudflare(asset.prompt, accountId, apiToken);
              if (Array.isArray(rawSpec.htmlCssScenes)) {
                for (const scene of rawSpec.htmlCssScenes) {
                  if (typeof scene.htmlCss === 'string') {
                    scene.htmlCss = scene.htmlCss.split(`{{IMAGE_${asset.id}}}`).join(imageUrl);
                    scene.htmlCss = scene.htmlCss.split(asset.id).join(imageUrl);
                  }
                }
              }
            } catch (cfErr) {
              console.warn(
                '[generateMotionGraphicsFromDialogue] Cloudflare image generation warning:',
                cfErr
              );
            }
          }
        }
      }
    } catch (cfLoadErr) {
      console.warn('[generateMotionGraphicsFromDialogue] Cloudflare assets lookup error:', cfLoadErr);
    }
  }

  // Re-sanitize so Cloudflare substitutions are cleaned too.
  spec = sanitizeMotionGraphicSpec(rawSpec, targetDuration, canRasterizeHtml);

  // 4. Render the motion graphic overlay video
  onProgress('Rendering vector animation video', 70);

  let video: MotionGraphicVideo | null = null;
  try {
    video = await renderMotionGraphicToVideo(
      spec,
      (step, pct) => {
        onProgress(step, Math.round(70 + (pct / 100) * 28));
      },
      {
        transparent: options.transparent !== false,
        signal: options.signal,
      }
    );
  } catch (renderError: any) {
    if (renderError?.name === 'AbortError') throw renderError;
    console.error('[generateMotionGraphicsFromDialogue] Rendering error:', renderError);
    throw new Error(
      `Failed to render motion graphics to video: ${
        renderError instanceof Error ? renderError.message : String(renderError)
      }`
    );
  }

  onProgress('Complete', 100);

  return {
    spec,
    transcribedText: transcribedText || options.dialogueText || '',
    video,
    designNotes: issues,
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Provider calls
 * ────────────────────────────────────────────────────────────────────────── */

interface DesignPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

/** Runs one design request against the chosen provider and returns parsed JSON. */
async function requestDesign(
  provider: 'gemini' | 'groq',
  parts: DesignPart[],
  signal?: AbortSignal
): Promise<any> {
  const promptText = parts
    .filter((p) => typeof p.text === 'string')
    .map((p) => p.text as string)
    .join('\n\n');

  const raw = provider === 'gemini'
    ? await callGeminiWithFallback(parts, signal)
    : await callGroqWithFallback(promptText, signal);

  return parseJsonSafely(raw);
}

function isModelUnavailable(status: number, body: string): boolean {
  if (status === 404) return true;
  return /is not found|not supported for generateContent|model.*not found|unsupported model/i.test(
    body || ''
  );
}

async function callGeminiWithFallback(parts: any[], signal?: AbortSignal): Promise<string> {
  let lastError = '';

  for (const model of GEMINI_MODEL_CANDIDATES) {
    const response = await fetchWithKeyFailover(
      (key) =>
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal,
        body: JSON.stringify({
          contents: [{ role: 'user', parts }],
          generationConfig: {
            temperature: 0.4,
            responseMimeType: 'application/json',
            // Rich vector scenes are token hungry. The default output cap used to
            // truncate the JSON mid-scene, which made every response unparseable.
            maxOutputTokens: 65536,
          },
        }),
      },
      'gemini'
    );

    if (response.ok) {
      const data = await response.json();
      const candidate = data?.candidates?.[0];
      if (candidate?.finishReason === 'MAX_TOKENS') {
        lastError = 'AI response was truncated before it could finish the scene code.';
        continue;
      }
      const textParts: string[] = (candidate?.content?.parts || [])
        .map((p: any) => (typeof p?.text === 'string' ? p.text : ''))
        .filter(Boolean);
      const text = textParts.join('\n');
      if (text.trim()) return text;
      lastError = 'AI returned an empty response.';
      continue;
    }

    const errBody = await response.text().catch(() => '');
    if (isModelUnavailable(response.status, errBody)) {
      lastError = `Model ${model} unavailable (${response.status}).`;
      continue;
    }
    throw new Error(`Gemini API call failed (${response.status}): ${errBody || response.statusText}`);
  }

  throw new Error(lastError || 'Gemini API call failed for every available model.');
}

async function callGroqWithFallback(promptText: string, signal?: AbortSignal): Promise<string> {
  let lastError = '';

  for (const model of GROQ_MODEL_CANDIDATES) {
    const response = await fetchWithKeyFailover(
      () => `https://api.groq.com/openai/v1/chat/completions`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal,
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content:
                'You are an elite motion graphics designer. You must return ONLY valid JSON adhering strictly to the MotionGraphicSpec schema.',
            },
            { role: 'user', content: promptText },
          ],
          temperature: 0.4,
          max_tokens: 32768,
          response_format: { type: 'json_object' },
        }),
      },
      'groq'
    );

    if (response.ok) {
      const data = await response.json();
      const finishReason = data?.choices?.[0]?.finish_reason;
      const text: string = data?.choices?.[0]?.message?.content || '';
      if (text.trim() && finishReason !== 'length') return text;
      lastError = 'AI response was truncated before it could finish the scene code.';
      continue;
    }

    const errBody = await response.text().catch(() => '');
    if (isModelUnavailable(response.status, errBody)) {
      lastError = `Model ${model} unavailable (${response.status}).`;
      continue;
    }
    throw new Error(`Groq API call failed (${response.status}): ${errBody || response.statusText}`);
  }

  throw new Error(lastError || 'Groq API call failed for every available model.');
}

/* ────────────────────────────────────────────────────────────────────────────
 * Prompts
 * ────────────────────────────────────────────────────────────────────────── */

/** A tiny but complete example of the density we expect (18 shapes, no backdrop). */
const EXAMPLE_SCENE = `<div style="position:relative;width:1920px;height:1080px;overflow:hidden;background:transparent;font-family:Arial,Helvetica,sans-serif;">
  <svg width="1920" height="1080" viewBox="0 0 1920 1080" style="position:absolute;top:0;left:0;overflow:visible;">
    <polygon class="hill" points="0,1080 420,640 900,1080" fill="#1e293b"/>
    <polygon class="hill" points="760,1080 1240,520 1740,1080" fill="#334155"/>
    <polygon class="hill" points="1500,1080 1920,700 1920,1080" fill="#0f172a"/>
    <rect class="road" x="0" y="960" width="1920" height="46" fill="#475569"/>
    <rect class="tower" x="360" y="700" width="60" height="260" fill="#facc15"/>
    <rect class="tower" x="470" y="780" width="60" height="180" fill="#fbbf24"/>
    <rect class="tower" x="580" y="840" width="60" height="120" fill="#f59e0b"/>
    <polygon class="house" points="1100,960 1160,880 1220,960" fill="#b45309"/>
    <rect class="house" x="1100" y="960" width="120" height="70" fill="#78350f"/>
    <rect class="house" x="1140" y="990" width="34" height="40" fill="#fde68a"/>
    <circle class="dot" cx="1300" cy="500" r="18" fill="#38bdf8"/>
    <circle class="dot" cx="1400" cy="470" r="18" fill="#38bdf8"/>
    <circle class="dot" cx="1500" cy="430" r="18" fill="#38bdf8"/>
    <circle class="dot" cx="1600" cy="380" r="18" fill="#38bdf8"/>
    <path class="route" d="M1300 500 C1420 380 1560 340 1720 250" stroke="#f97316" stroke-width="8" fill="none"/>
    <circle class="marker" cx="1720" cy="250" r="26" fill="#f97316"/>
    <line class="leader" x1="1720" y1="250" x2="1560" y2="150" stroke="#f8fafc" stroke-width="4"/>
    <ellipse class="shadow" cx="1160" cy="1040" rx="90" ry="18" fill="#020617"/>
  </svg>
  <div class="label">GROWTH 2010 → 2024</div>
  <style>
    @keyframes growUp { from { transform: scaleY(0); opacity: 0 } to { transform: scaleY(1); opacity: 1 } }
    @keyframes popSpring { 0% { transform: scale(0); opacity: 0 } 70% { transform: scale(1.12); opacity: 1 } 100% { transform: scale(1); opacity: 1 } }
    .hill   { transform-origin: center bottom; animation: growUp .8s cubic-bezier(.2,.9,.3,1) both; }
    .hill:nth-of-type(2) { animation-delay: .12s }
    .hill:nth-of-type(3) { animation-delay: .24s }
    .road   { transform-origin: left center; animation: growUp .6s ease-out .3s both; }
    .tower  { transform-origin: center bottom; animation: growUp .55s cubic-bezier(.2,.9,.3,1) both; }
    .tower:nth-of-type(2) { animation-delay: .5s }
    .tower:nth-of-type(3) { animation-delay: .62s }
    .house  { transform-origin: center bottom; animation: popSpring .6s cubic-bezier(.2,1.5,.4,1) .8s both; }
    .dot    { transform-origin: center; animation: popSpring .45s cubic-bezier(.2,1.5,.4,1) both; }
    .dot:nth-of-type(2) { animation-delay: 1.0s } .dot:nth-of-type(3) { animation-delay: 1.1s } .dot:nth-of-type(4) { animation-delay: 1.2s }
    .route  { animation: growUp .7s ease-out 1.3s both; }
    .marker { transform-origin: center; animation: popSpring .5s cubic-bezier(.2,1.6,.4,1) 1.7s both; }
    .leader { animation: growUp .3s ease-out 1.9s both; }
    .shadow { transform-origin: center; animation: popSpring .6s ease-out .9s both; }
    .label  { position:absolute; left:1200px; top:120px; background:rgba(15,23,42,.78); color:#fbbf24;
              border:3px solid #fbbf24; border-radius:8px; padding:8px 18px; font-size:32px; font-weight:800;
              animation: popSpring .5s cubic-bezier(.2,1.4,.4,1) 2.0s both; }
  </style>
</div>`;

function buildAiMotionPrompt(
  dialogueText: string,
  duration: number,
  options: GenerativeMotionOptions,
  hasStoryboardImages: boolean,
  canRasterizeHtml = true
): string {
  const d = duration.toFixed(1);
  const style = options.style || 'mixed';
  const art = STYLE_ART_DIRECTION[style] || STYLE_ART_DIRECTION.mixed;
  const minimum = minimumShapeCount(style);

  return `You are an elite Motion Graphics Director. You build WORLDS OUT OF VECTOR SHAPES that explain the dialogue — you are not a subtitle generator.

TOTAL DURATION: ${d} seconds
STAGE: 1920x1080 (30 FPS)
STYLE KEY: "${style}"
LAYOUT: "${options.layout}"
${options.customPrompt ? `USER INSTRUCTIONS: "${options.customPrompt}"` : ''}
${dialogueText ? `DIALOGUE / SCRIPT: "${dialogueText}"` : ''}
${hasStoryboardImages ? 'NOTE: Video frames are provided so the graphics can match the footage.' : ''}

═══════════════════════════════════════════════════════════════════════════════
RULE #0 — ARTWORK FIRST, TEXT SECOND (THIS IS WHAT "VOX STYLE" MEANS)
═══════════════════════════════════════════════════════════════════════════════
A Vox/Kurzgesagt piece is a SCENE YOU CAN LOOK AT, not words flying around.
Your job per scene:
  1. Decide what OBJECT/WORLD represents this beat (a coastline, a city, a market,
     a server rack, a human body, a chart made physical…).
  2. Draw it with ${minimum}+ SVG shape elements: <polygon>, <path>, <rect>, <circle>, <ellipse>, <line>.
  3. Animate those shapes entering in a staggered sequence.
  4. ONLY THEN add a short label/caption if the dialogue needs one.
TEXT BUDGET: visible text must cover at most ~25% of the frame. A scene made only of
animated words is a FAILURE and will be rejected by the validator.

ART DIRECTION FOR THIS JOB:
${art}

═══════════════════════════════════════════════════════════════════════════════
RULE #1 — THE OUTPUT MUST BE TRANSPARENT (NON-NEGOTIABLE)
═══════════════════════════════════════════════════════════════════════════════
The finished video is placed ON TOP of the user's footage.
  • NEVER paint a full-screen background: no <div style="width:1920px;height:1080px;background:#0b1020">,
    no <rect width="1920" height="1080" fill="#...">, no full-frame gradients, no body background.
  • For contrast behind text use a semi-transparent pill sized to the TEXT only.
  • Vignettes/scrims covering more than ~70% of the frame are forbidden.

${canRasterizeHtml ? `═══════════════════════════════════════════════════════════════════════════════
HOW TO CODE htmlCssScenes (THE PRIMARY OUTPUT)
═══════════════════════════════════════════════════════════════════════════════
Self-contained HTML/CSS/SVG with CSS @keyframes. Rules:
1. Root wrapper: <div style="position:relative;width:1920px;height:1080px;overflow:hidden;background:${options.transparent !== false ? 'transparent' : '#0f172a'}">
2. NO external assets: no <img src="http...">, no <link>, no @import, no web fonts.
   Only web-safe fonts (Arial, Helvetica, Impact, "Courier New", Georgia).
3. Artwork MUST live inside ONE <svg width="1920" height="1080" viewBox="0 0 1920 1080"
   style="position:absolute;top:0;left:0;overflow:visible;"> … </svg>
4. Animate transform/opacity with cubic-bezier springs. Always set "transform-origin"
   (e.g. "center bottom" for things that grow up from the ground).
5. Every animated element needs "animation-fill-mode: both" so it is invisible before
   its delay and stays visible after it finishes.
6. Scene timing: "enterAt"/"exitAt" are seconds. Scene-local CSS time starts at enterAt,
   so an element that should appear 1.5s into the scene gets "animation-delay: 1.5s".
7. Use 2-5 scenes for a ${d}s clip; together they must cover 0 → ${d}.
8. Keep each scene under ~9000 characters of HTML/CSS.

REFERENCE SCENE (note: ${countSvgShapes(EXAMPLE_SCENE)} shapes, transparent, staggered):
${EXAMPLE_SCENE}

═══════════════════════════════════════════════════════════════════════════════
OPTIONAL SUPPORTING LAYER — canvasElements
═══════════════════════════════════════════════════════════════════════════════
These are simple canvas overlays. They are a GARNISH, never the meal — if you use them,
you must STILL deliver full htmlCssScenes vector artwork.
  • "KineticWord" · "VoiceSyncHighlight" · "MotionArrow" · "AnimatedBarChart"
  • "AnimatedLineGraph" · "AnimatedCounter" · "LowerThird" · "TitleCard"
  • "ParticleBurst" · "CircleHighlight" · "VectorShape"

` : `}

═══════════════════════════════════════════════════════════════════════════════
THIS BROWSER CANNOT RASTERIZE HTML/CSS SCENES (verified at runtime).
═══════════════════════════════════════════════════════════════════════════════
Anything you put in htmlCssScenes would render as a completely EMPTY overlay, so
leave htmlCssScenes as an empty array and build the ENTIRE animation out of
canvasElements, composing several components per beat:
  • "VectorShape" — flat vector artwork (circle / rect / polygon / line). Use MANY
    of them to build a simplified map, skyline, chart or scene.
  • "AnimatedBarChart" / "AnimatedLineGraph" / "AnimatedCounter" — data made visible
  • "KineticWord" / "LowerThird" / "TitleCard" — the caption layer (keep it small)
  • "MotionArrow" / "CircleHighlight" / "ParticleBurst" — emphasis and annotation
Give every element explicit enterAt/exitAt so the composition moves across the full
${d} seconds, and stagger them so it reads as an animation rather than a slideshow.
These components are now the MEAL, not a garnish.

`}
OUTPUT: ONLY a single valid JSON object (no markdown fences, no backticks, no comments):
{
  "transcribedText": string,
  "width": 1920,
  "height": 1080,
  "fps": 30,
  "duration": ${d},
  "canvasElements": [
    { "component": "…", "enterAt": number (0 to ${d}), "exitAt": number,
      "config": object, "position": { "x": number, "y": number } }
  ],
  "htmlCssScenes": ${canRasterizeHtml ? `[
    { "enterAt": number, "exitAt": number, "description": string, "htmlCss": string }
  ]` : '[]'}
}`;
}

/** Second-pass prompt used when the validator rejected the first design. */
function buildCorrectionPrompt(
  issues: string[],
  style: string,
  duration: number,
  dialogueText: string,
  transparent: boolean
): string {
  const d = duration.toFixed(1);
  const minimum = minimumShapeCount(style);
  const art = STYLE_ART_DIRECTION[style] || STYLE_ART_DIRECTION.mixed;

  return `Your previous design was REJECTED by the motion graphics validator:

${issues.map((issue) => `• ${issue}`).join('\n')}

You produced animated TYPOGRAPHY. The user asked for a "${style}" VECTOR SCENE and got words.
Rewrite the JSON from scratch and fix every issue above.

NON-NEGOTIABLE FOR THIS RETRY (all ${d}s of it):
1. Every scene is a drawn world inside <svg viewBox="0 0 1920 1080"> with ${minimum}+ shape
   elements (polygon/path/rect/circle/ellipse/line). No scene may be text-only.
2. Text is a caption, not the content: at most ~25% of the frame. STRICT UI PLACEMENT: ANY text elements MUST have x between 200 and 1720, and y between 200 and 880 to prevent being cut off at the edges of the screen! STRICT UI PLACEMENT: ANY text elements MUST have x between 200 and 1720, and y between 200 and 880 to prevent being cut off at the edges of the screen!
${transparent !== false ? '3. The stage stays TRANSPARENT — no full-frame background of any kind.' : '3. You MUST paint a solid full-frame background (e.g. <rect width=\"1920\" height=\"1080\" fill=\"#1e293b\">).'}
4. Keep the same duration (${d}s) and the same dialogue${dialogueText ? `: "${dialogueText}"` : ''}.
5. Stagger the entrances (spring/grow-up easings, "animation-fill-mode: both").

ART DIRECTION:
${art}

REFERENCE DENSITY (${countSvgShapes(EXAMPLE_SCENE)} shapes):
${EXAMPLE_SCENE}

Return ONLY the corrected JSON object.`;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Parsing + sanitising
 * ────────────────────────────────────────────────────────────────────────── */

/** Strips markdown code blocks and safely parses JSON. */
export function parseJsonSafely(raw: string): any {
  let cleaned = (raw || '').trim();
  if (!cleaned) return {};

  if (cleaned.startsWith('```')) {
    cleaned = cleaned
      .replace(/^```[a-zA-Z]*\s*\n?/, '')
      .replace(/\n?\s*```$/, '')
      .trim();
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    /* fall through to salvage */
  }

  // Salvage the outermost JSON object (Gemini sometimes wraps/prefaces output).
  const start = cleaned.indexOf('{');
  if (start !== -1) {
    const end = cleaned.lastIndexOf('}');
    const candidate = end > start ? cleaned.slice(start, end + 1) : cleaned.slice(start);
    try {
      return JSON.parse(candidate);
    } catch {
      // Truncated JSON: close dangling strings/objects so a partially streamed
      // scene can still be recovered instead of throwing the whole response away.
      try {
        return JSON.parse(repairTruncatedJson(candidate));
      } catch {
        /* fall through */
      }
    }
  }

  console.warn('[generateMotionGraphicsFromDialogue] JSON parse error, returning fallback.');
  return {};
}

/**
 * Best-effort repair of a JSON document cut off mid-string/mid-scene.
 * Returns something parseable or the input unchanged.
 */
function repairTruncatedJson(input: string): string {
  let out = input;

  // Drop the trailing incomplete object: keep everything up to the last
  // completed `…"},` member so the salvage stays valid JSON.
  const lastCompleteMember = out.lastIndexOf('"},');
  if (lastCompleteMember !== -1) {
    out = out.slice(0, lastCompleteMember + 2);
  }

  // Walk the document tracking strings so escaped quotes are not miscounted,
  // then close whatever is still open.
  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  for (const ch of out) {
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{' || ch === '[') stack.push(ch);
    else if (ch === '}' || ch === ']') stack.pop();
  }

  if (inString) out += '"';
  // Never leave a dangling comma before a closing brace.
  out = out.replace(/,\s*$/, '');
  for (let i = stack.length - 1; i >= 0; i--) {
    out += stack[i] === '{' ? '}' : ']';
  }

  return out;
}

/**
 * Validates and clamps motion graphic timing, dimensions and element specs, and
 * sanitises every HTML scene so it cannot taint or crash the rasterizer.
 */
export function sanitizeMotionGraphicSpec(
  raw: any,
  targetDuration: number,
  canRasterizeHtml = true
): MotionGraphicSpec {
  const duration = Math.max(0.5, Number(raw?.duration) || targetDuration || 5);
  const width = 1920;
  const height = 1080;
  const fps = 30;

  const rawElements = Array.isArray(raw?.canvasElements) ? raw.canvasElements : [];
  const canvasElements = rawElements.map((el: any) => {
    const enterAt = clamp(Number(el?.enterAt) || 0, 0, Math.max(0, duration - 0.1));
    let exitAt = clamp(Number(el?.exitAt) || duration, 0, duration);
    if (exitAt <= enterAt) exitAt = Math.min(duration, enterAt + 1.0);

    const component =
      typeof el?.component === 'string' && el.component ? el.component : 'KineticWord';
    const config = el?.config && typeof el.config === 'object' ? el.config : {};
    const position =
      el?.position && typeof el.position === 'object' && typeof el.position.x === 'number'
        ? { x: el.position.x, y: Number(el.position.y) || height / 2 }
        : undefined;

    return {
      component,
      enterAt: round2(enterAt),
      exitAt: round2(exitAt),
      config,
      position,
    };
  });

  const rawScenes = Array.isArray(raw?.htmlCssScenes) ? raw.htmlCssScenes : [];
  const htmlCssScenes = rawScenes
    .map((s: any) => {
      const enterAt = clamp(Number(s?.enterAt) || 0, 0, Math.max(0, duration - 0.1));
      let exitAt = clamp(Number(s?.exitAt) || duration, 0, duration);
      if (exitAt <= enterAt) exitAt = Math.min(duration, enterAt + 1.0);

      return {
        enterAt: round2(enterAt),
        exitAt: round2(exitAt),
        description: typeof s?.description === 'string' ? s.description : 'HTML Scene',
        htmlCss: sanitizeMotionSceneHtml(typeof s?.htmlCss === 'string' ? s.htmlCss : ''),
      };
    })
    .filter((s: any) => s.htmlCss.trim().length > 0)
    .sort((a: any, b: any) => a.enterAt - b.enterAt);

  // On engines that cannot rasterize HTML scenes, keeping them would hide the
  // fact that nothing will ever be drawn (and would suppress the empty-result
  // fallback). Drop them so the canvas composition carries the design.
  const scenes = canRasterizeHtml ? htmlCssScenes : [];

  // Scenes must tile the whole clip. The AI routinely returns windows that stop
  // early (or start late), and every uncovered second renders as bare key-colour
  // plate — which is exactly what "a purple screen with no animation" looks like
  // once the overlay is on the timeline. Each scene now holds its finished frame
  // from its own start until the next scene takes over, and the last one runs to
  // the end of the clip.
  if (scenes.length > 0) {
    scenes[0].enterAt = 0;
    for (let i = 0; i < scenes.length - 1; i++) {
      const next = scenes[i + 1].enterAt;
      if (scenes[i].exitAt < next) scenes[i].exitAt = next;
    }
    scenes[scenes.length - 1].exitAt = round2(duration);
  }

  // Never ship an empty composition. A design with no drawable scene (and only a
  // token canvas element or two) renders as a bare key-colour rectangle, so add
  // a TitleCard built from the dialogue — something on screen beats nothing.
  if (scenes.length === 0 && canvasElements.length <= 2) {
    canvasElements.push({
      component: 'TitleCard',
      enterAt: 0,
      exitAt: round2(duration),
      config: {
        title: raw?.transcribedText || 'Motion Graphics',
        subtitle: 'ProCut AI Generated',
        titleColor: '#ffe600',
        subtitleColor: '#ffffff',
        accentColor: '#00ffff',
      },
      
    });
  }

  return { width, height, fps, duration, canvasElements, htmlCssScenes: scenes };
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function round2(value: number): number {
  return Number(value.toFixed(2));
}
