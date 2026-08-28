import { fetchWithKeyFailover } from './apiKeyManager';
import { compileStoryboard, StoryboardChunk } from './storyboardCompiler';
import {
  MotionGraphicSpec,
  MotionGraphicVideo,
  renderMotionGraphicToVideo,
} from './motionGraphicRenderer';
import { generateImageFromCloudflare } from './cloudflareClient';
import { sanitizeMotionSceneHtml } from './cssSceneRasterizer';

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
  style: string; // 'documentary' | 'kurzgesagt' | 'mrbeast' | 'hormozi' | 'cyberpunk' | 'minimal' | 'custom'
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
}

/**
 * Orchestrates end-to-end AI motion graphic generation:
 * 1. Extracts video frames/storyboards or processes raw dialogue text.
 * 2. Prompts Gemini / Groq with available canvas and HTML/CSS component capabilities.
 * 3. Validates and sanitizes the motion graphic specification.
 * 4. Resolves optional Cloudflare AI image assets.
 * 5. Renders the complete motion graphic composition into a WebM overlay
 *    (real alpha channel when the browser supports VP9 alpha, otherwise a
 *    chroma-keyable plate).
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

      // Attempt to extract the blob directly as base64 for Gemini Audio Processing
      if (provider === 'gemini') {
        onProgress('Preparing audio for Gemini', 18);
        try {
          const res = await fetch(clipMediaUrl);
          const blob = await res.blob();
          if (blob.size < 15 * 1024 * 1024) {
            // Max 15MB inline payload
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

  // 2. Build structured system prompt
  const promptText = buildAiMotionPrompt(
    dialogueText,
    targetDuration,
    options,
    storyboardChunks.length > 0
  );

  onProgress('AI Designing visual scenes', 40);

  // 3. Call AI API
  let rawJsonText = '';
  let transcribedText = dialogueText;

  if (provider === 'gemini') {
    const parts: any[] = [];
    if (inlineAudioBase64 && inlineAudioMime) {
      parts.push({ inlineData: { mimeType: inlineAudioMime, data: inlineAudioBase64 } });
      parts.push({
        text: 'Please transcribe the audio from the provided media file and use it as the dialogue for the motion graphics. Then output the JSON as instructed.',
      });
    }

    if (storyboardChunks.length > 0) {
      for (const chunk of storyboardChunks) {
        parts.push({ inlineData: { mimeType: 'image/jpeg', data: chunk.base64Image } });
      }
    }
    parts.push({ text: promptText });

    rawJsonText = await callGeminiWithFallback(parts, options.signal);
  } else {
    rawJsonText = await callGroqWithFallback(promptText, options.signal);
  }

  onProgress('Validating design specification', 55);

  // 4. Parse & sanitize JSON output
  const rawSpec = parseJsonSafely(rawJsonText);
  if (typeof rawSpec.transcribedText === 'string' && rawSpec.transcribedText.trim()) {
    transcribedText = rawSpec.transcribedText;
  }

  // 5. Optional Cloudflare AI image generation if imageAssets are requested
  if (Array.isArray(rawSpec.imageAssets) && rawSpec.imageAssets.length > 0) {
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

  const spec = sanitizeMotionGraphicSpec(rawSpec, targetDuration);

  if (!dialogueText && !transcribedText && spec.canvasElements.length > 0) {
    // Nothing to show and nothing said — surface a helpful message instead of an
    // empty overlay that silently does nothing on the timeline.
    console.warn('[generateMotionGraphicsFromDialogue] AI returned no dialogue and no scenes.');
  }

  // 6. Render the motion graphic overlay video
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
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Provider calls
 * ────────────────────────────────────────────────────────────────────────── */

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
            temperature: 0.35,
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
          temperature: 0.35,
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
 * Prompt
 * ────────────────────────────────────────────────────────────────────────── */

function buildAiMotionPrompt(
  dialogueText: string,
  duration: number,
  options: GenerativeMotionOptions,
  hasStoryboardImages: boolean
): string {
  const d = duration.toFixed(1);
  return `You are an elite Motion Graphics & Visual Storytelling Director (Vox, Kurzgesagt, Polymatter).
Transform the dialogue into REAL VISUAL MOTION GRAPHICS: layered vector geometry, progressive world construction and kinetic typography.

TOTAL DURATION: ${d} seconds
STAGE: 1920x1080 (30 FPS)
STYLE: "${options.style}"
LAYOUT: "${options.layout}"
${options.customPrompt ? `USER INSTRUCTIONS: "${options.customPrompt}"` : ''}
${dialogueText ? `DIALOGUE / SCRIPT: "${dialogueText}"` : ''}
${hasStoryboardImages ? 'NOTE: Video frames are provided so the graphics can match the footage.' : ''}

═══════════════════════════════════════════════════════════════════════════════
RULE #0 — THE OUTPUT MUST BE TRANSPARENT (NON-NEGOTIABLE)
═══════════════════════════════════════════════════════════════════════════════
The finished video is placed ON TOP of the user's footage as an overlay.
Therefore:
  • NEVER paint a full-screen background. No <div style="width:1920px;height:1080px;background:#0b1020">,
    no <rect width="1920" height="1080" fill="#...">, no full-frame gradients, no body background colour.
  • The stage is transparent. Only the artwork, shapes, strokes and text may be painted.
  • Dark solid backdrops are FORBIDDEN. If you need contrast behind text, use a
    semi-transparent pill (rgba(0,0,0,0.55)) sized to the TEXT only, never to the frame.
  • Vignettes, scrims and colour-washes that cover more than ~70% of the frame are FORBIDDEN.

═══════════════════════════════════════════════════════════════════════════════
WHAT REAL MOTION GRAPHICS LOOKS LIKE
═══════════════════════════════════════════════════════════════════════════════
Not just subtitles — VISUAL STORYTELLING:
1. Build the world with layered vector geometry (SVG inside an <svg> tag).
   • Mountains, oceans, landscapes GROW up from the bottom with multi-shaded polygons.
   • Years/dates STAMP in with distressed badges and kinetic lines.
   • Villages, houses, icons POP IN with spring bounce physics.
2. Dozens of <polygon>, <path>, <rect>, <circle> with dimensional shading.
3. Stagger every element with its own "animation-delay" so the scene assembles
   piece by piece in sync with the dialogue.

═══════════════════════════════════════════════════════════════════════════════
HOW TO CODE htmlCssScenes
═══════════════════════════════════════════════════════════════════════════════
Self-contained HTML/CSS/SVG with CSS @keyframes. Rules:
1. Root wrapper: <div style="position:relative;width:1920px;height:1080px;overflow:hidden;background:transparent;">
2. ABSOLUTELY NO EXTERNAL ASSETS (they break rendering):
   • no <img src="http...">, no <link>, no @import, no web fonts.
   • Use only web-safe fonts: Arial, Helvetica, Impact, "Courier New", Georgia, sans-serif.
   • Inline artwork must be SVG — never reference files.
3. SVG artwork MUST be wrapped in <svg width="1920" height="1080" viewBox="0 0 1920 1080" style="position:absolute;top:0;left:0;overflow:visible;">
   <svg ...><polygon points="400,1080 800,280 1200,1080" fill="#334155"/><rect x="850" y="820" width="120" height="90" rx="4" fill="#78350f"/></svg>
4. Prefer transform/opacity animations; use cubic-bezier springs:
   @keyframes popSpring { 0% { transform: scale(0); opacity: 0 } 70% { transform: scale(1.12); opacity: 1 } 100% { transform: scale(1); opacity: 1 } }
   @keyframes growUp { 0% { transform: scaleY(0); opacity: 0 } 100% { transform: scaleY(1); opacity: 1 } }
   Always set "transform-origin" explicitly (e.g. "bottom center" for growUp).
5. Every animated element needs "animation-fill-mode: both" so it is invisible
   before its delay and stays visible after it finishes.
6. Scene timing: "enterAt"/"exitAt" are seconds. Scene-local CSS time starts at
   enterAt, so an element meant to appear 1.5s into the scene gets
   "animation-delay: 1.5s".
7. Keep each scene under ~9000 characters of HTML/CSS. Use 2-5 scenes for a ${d}s
   clip and make the union of scenes cover 0 → ${d}.

═══════════════════════════════════════════════════════════════════════════════
CANVAS 2D COMPONENTS (OPTIONAL, COMBINE WITH HTML SCENES)
═══════════════════════════════════════════════════════════════════════════════
1. "KineticWord": { "text": string, "fontSize": 64-90, "color": "#ffe600", "animation": "spring"|"bounce", "position": { "x": 960, "y": 540 } }
2. "VoiceSyncHighlight": { "words": [{ "text": string, "start": number, "end": number }], "highlightColor": "#fbbf24" }
3. "MotionArrow": { "from": { "x": 400, "y": 600 }, "to": { "x": 900, "y": 400 } }
4. "AnimatedBarChart": { "bars": [{ "label": "1970", "value": 45 }, { "label": "2024", "value": 180 }] }
5. "AnimatedCounter": { "from": 0, "to": 1970, "position": { "x": 960, "y": 400 } }
6. "VectorShape": { "animation": "popSpring"|"growUp", "startTime": 0.5, "shapes": [ { "type": "polygon", "points": "400,1080 800,280 1200,1080", "fill": "#334155", "delay": 0.2 } ] }

OUTPUT: ONLY a single valid JSON object (no markdown fences, no backticks, no comments):
{
  "transcribedText": string,
  "width": 1920,
  "height": 1080,
  "fps": 30,
  "duration": ${d},
  "canvasElements": [
    { "component": "KineticWord" | "VoiceSyncHighlight" | "MotionArrow" | "AnimatedBarChart" | "AnimatedLineGraph" | "AnimatedCounter" | "LowerThird" | "TitleCard" | "ParticleBurst" | "CircleHighlight" | "VectorShape",
      "enterAt": number (0 to ${d}),
      "exitAt": number (enterAt < exitAt <= ${d}),
      "config": object,
      "position": { "x": number, "y": number } }
  ],
  "htmlCssScenes": [
    { "enterAt": number, "exitAt": number, "description": string, "htmlCss": string }
  ]
}`;
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
export function sanitizeMotionGraphicSpec(raw: any, targetDuration: number): MotionGraphicSpec {
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

  // Never ship an empty composition: fall back to a TitleCard built from the
  // dialogue so the overlay is visible instead of silently blank.
  if (canvasElements.length === 0 && htmlCssScenes.length === 0) {
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
      position: { x: width / 2, y: height / 2 },
    });
  }

  return { width, height, fps, duration, canvasElements, htmlCssScenes };
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function round2(value: number): number {
  return Number(value.toFixed(2));
}
