/**
 * customFxDirector.ts
 * ──────────────────────────────────────────────────────────────────────────
 * Multimodal AI Custom FX Maker engine.
 *
 * Orchestrates simultaneous audio (Groq Whisper) and visual (Gemini Vision)
 * scanning of a video clip, then co-reasons with Groq GPT-OSS 120B + Gemini
 * to generate scene-justified HTML/CSS/SVG animation overlays.
 *
 * Reuses existing infrastructure:
 * - extractClipAudioToWav + transcribeWithGroqWhisper from aiSpeedSync.ts
 * - compileStoryboard from storyboardCompiler.ts
 * - fetchWithKeyFailover from apiKeyManager.ts
 * - sanitizeMotionSceneHtml from cssSceneRasterizer.ts
 * - validateSceneQuality + parseJsonSafely from generateMotionGraphicsFromDialogue.ts
 * - createSceneStage + captureSceneFrame from cssSceneRasterizer.ts
 */

import type { TimelineClip, CustomFxItem } from '@/types';
import { extractClipAudioToWav, transcribeWithGroqWhisper, blobToBase64 } from './aiSpeedSync';
import { compileStoryboard, type StoryboardChunk } from './storyboardCompiler';
import { fetchWithKeyFailover } from './apiKeyManager';
import { sanitizeMotionSceneHtml, createSceneStage, captureSceneFrame, destroySceneStage } from './cssSceneRasterizer';
import { validateSceneQuality, parseJsonSafely } from './generateMotionGraphicsFromDialogue';
import { getFileFromDB } from './projectPersistence';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AudioBreakdown {
  transcript: string;
  keywords: string[];
  tone: string;
  pace: string;
}

export interface VisualBreakdown {
  sceneType: string;
  subjects: string;
  safeZones: string;
  palette: string[];
  composition: string;
  frameSnapshot?: string; // Base64 data URL of the first extracted keyframe
}

export interface ClipScanCacheEntry {
  audioBreakdown: AudioBreakdown | null;
  visualBreakdown: VisualBreakdown | null;
  timestamp: number;
}

export interface GenerateCustomFxOptions {
  customPrompt?: string;
  cachedScan?: {
    audioBreakdown: AudioBreakdown | null;
    visualBreakdown: VisualBreakdown | null;
  };
  isRegenerate?: boolean;
  iteration?: number;
  previousReasoning?: string;
  onProgress?: (progress: CustomFxProgress) => void;
  signal?: AbortSignal;
}

// ─── In-Memory Clip Scan Cache ───────────────────────────────────────────────

const _clipScanCache = new Map<string, ClipScanCacheEntry>();

export function getClipScanCacheKey(clip: TimelineClip): string {
  return `${clip.id}_${clip.mediaId || ''}_${(clip.trimStart || 0).toFixed(2)}_${(clip.duration || 0).toFixed(2)}`;
}

export function getClipScanCache(clip: TimelineClip): ClipScanCacheEntry | undefined {
  return _clipScanCache.get(getClipScanCacheKey(clip));
}

export function setClipScanCache(
  clip: TimelineClip,
  entry: { audioBreakdown: AudioBreakdown | null; visualBreakdown: VisualBreakdown | null }
): void {
  _clipScanCache.set(getClipScanCacheKey(clip), {
    ...entry,
    timestamp: Date.now(),
  });
}

export function clearClipScanCache(clipId?: string): void {
  if (clipId) {
    for (const key of _clipScanCache.keys()) {
      if (key.startsWith(clipId)) _clipScanCache.delete(key);
    }
  } else {
    _clipScanCache.clear();
  }
}

export interface CustomFxGenerationResult {
  htmlCss: string;
  name: string;
  description: string;
  reasoning: string;
  prompt: string;
  audioBreakdown: AudioBreakdown | null;
  visualBreakdown: VisualBreakdown | null;
  thumbnail?: string;
  videoFrameSnapshot?: string;
}

export type CustomFxPhase =
  | 'idle'
  | 'scanning-audio'
  | 'scanning-vision'
  | 'scanning'
  | 'reasoning'
  | 'validating'
  | 'retrying'
  | 'generating-thumbnail'
  | 'done'
  | 'error';

export interface CustomFxProgress {
  phase: CustomFxPhase;
  message: string;
  percent: number;
}

// ─── Gemini model cascade ────────────────────────────────────────────────────

const GEMINI_VISION_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.8-flash',
  'gemini-2.5-flash',
];

const GEMINI_REASONING_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.8-flash',
  'gemini-2.5-flash',
];

// ─── Groq model cascade (for co-reasoning) ───────────────────────────────────

const GROQ_REASONING_MODELS = [
  'openai/gpt-oss-120b',
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
];

function isModelUnavailable(status: number, body: string): boolean {
  if (status === 404 || status === 503 || status === 429) return true;
  return /is not found|not supported|model.*not found|unsupported model|high demand|temporarily overloaded|service unavailable|resource exhausted/i.test(body || '');
}

// ─── Phase 1a: Audio Agent ───────────────────────────────────────────────────

export async function scanAudio(
  clip: TimelineClip,
  mediaUrl: string,
  mediaId: string | undefined,
  signal?: AbortSignal
): Promise<AudioBreakdown> {
  // Extract audio
  const { wavBlob, hasAudio } = await extractClipAudioToWav(clip, mediaUrl, mediaId);
  if (!wavBlob || !hasAudio) {
    throw new Error('Clip has no audible audio track');
  }
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

  // Transcribe with Groq Whisper
  const result = await transcribeWithGroqWhisper(wavBlob);
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

  if (!result.text || result.text.trim().length === 0) {
    throw new Error('No speech detected in audio');
  }

  // Derive keywords (top 5 most frequent non-stopword words)
  const stopwords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'shall', 'can', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'and', 'but', 'or', 'not', 'no', 'so', 'if', 'than', 'too', 'very', 'just', 'that', 'this', 'it', 'its', 'i', 'you', 'he', 'she', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'our', 'their', 'what', 'which', 'who', 'when', 'where', 'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'some', 'any', 'about', 'up', 'out', 'then', 'there', 'here']);
  const wordFreq = new Map<string, number>();
  result.text.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).forEach(w => {
    if (w.length > 2 && !stopwords.has(w)) {
      wordFreq.set(w, (wordFreq.get(w) || 0) + 1);
    }
  });
  const keywords = [...wordFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([w]) => w);

  // Estimate pace from word count and duration
  const wordCount = result.words.length;
  const duration = result.duration || clip.duration || 5;
  const wpm = (wordCount / duration) * 60;
  const pace = wpm > 160 ? 'fast' : wpm > 100 ? 'moderate' : 'slow';

  // Rough tone detection from word sentiment
  const energyWords = ['amazing', 'incredible', 'exciting', 'wow', 'crazy', 'insane', 'epic', 'huge', 'massive', 'explosive', 'powerful', 'intense'];
  const calmWords = ['gentle', 'quiet', 'peaceful', 'calm', 'soft', 'slow', 'steady', 'smooth', 'relaxing'];
  const dramaticWords = ['critical', 'danger', 'crisis', 'threat', 'warning', 'devastating', 'catastrophic', 'collapse', 'destroy', 'fatal'];
  const lower = result.text.toLowerCase();
  const hasEnergy = energyWords.some(w => lower.includes(w));
  const hasCalm = calmWords.some(w => lower.includes(w));
  const hasDramatic = dramaticWords.some(w => lower.includes(w));
  const tone = hasDramatic ? 'dramatic' : hasEnergy ? 'energetic' : hasCalm ? 'calm' : 'neutral';

  return { transcript: result.text, keywords, tone, pace };
}

// ─── Phase 1b: Visual Agent ──────────────────────────────────────────────────

export async function scanVision(
  clip: TimelineClip,
  mediaUrl: string,
  duration: number,
  signal?: AbortSignal
): Promise<VisualBreakdown> {
  // Capture keyframes using compileStoryboard
  const videoEl = document.createElement('video');
  let storyboardChunks: StoryboardChunk[] = [];

  try {
    videoEl.crossOrigin = 'anonymous';
    videoEl.muted = true;
    videoEl.playsInline = true;
    videoEl.preload = 'auto';
    videoEl.src = mediaUrl;

    await new Promise<void>((resolve) => {
      if (videoEl.readyState >= 1) { resolve(); return; }
      let done = false;
      const complete = () => { if (!done) { done = true; resolve(); } };
      videoEl.onloadedmetadata = complete;
      videoEl.oncanplay = complete;
      videoEl.onerror = complete;
      setTimeout(complete, 4000);
    });

    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    const trimStart = clip.trimStart || 0;
    const effectiveDuration = Math.min(duration, 15); // Cap at 15s for frame extraction
    storyboardChunks = await compileStoryboard(
      videoEl, trimStart, effectiveDuration, () => {}, 1
    );
  } finally {
    try { videoEl.removeAttribute('src'); videoEl.load(); } catch { /* ignore */ }
  }

  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

  if (storyboardChunks.length === 0) {
    throw new Error('Could not extract any frames from clip');
  }

  // Send frames to Gemini Vision for analysis
  const visionPrompt = `You are a visual scene analyzer for a video editing application.
Analyze these video keyframes and return a JSON object with:
1. "sceneType": one of "explainer", "tech", "action", "interview", "monologue", "cinematic", "comedy", "tutorial", "vlog", "nature", "product"
2. "subjects": brief description of main subjects/people/objects visible
3. "safeZones": where an overlay animation can be placed WITHOUT obscuring the subject. One of: "left-third", "right-third", "lower-third", "upper-third", "full-frame", "corners-only", "perimeter"
4. "palette": array of 3-5 dominant hex colors from the frames
5. "composition": brief description of the visual layout ("centered talking head", "wide landscape", "split screen", etc.)

Return ONLY strict JSON, no markdown:
{"sceneType":"...","subjects":"...","safeZones":"...","palette":["#..."],"composition":"..."}`;

  const parts: any[] = [{ text: visionPrompt }];
  for (const chunk of storyboardChunks.slice(0, 3)) {
    parts.push({ inlineData: { mimeType: 'image/jpeg', data: chunk.base64Image } });
  }

  let lastError = '';
  for (const model of GEMINI_VISION_MODELS) {
    try {
      const response = await fetchWithKeyFailover(
        (key) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal,
          body: JSON.stringify({
            contents: [{ role: 'user', parts }],
            generationConfig: {
              temperature: 0.3,
              responseMimeType: 'application/json',
              maxOutputTokens: 2048,
            },
          }),
        },
        'gemini'
      );

      if (response.ok) {
        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (text.trim()) {
          const parsed = parseJsonSafely(text);
          const frameSnapshot = storyboardChunks[0]?.base64Image
            ? `data:image/jpeg;base64,${storyboardChunks[0].base64Image}`
            : undefined;
          return {
            sceneType: parsed.sceneType || 'unknown',
            subjects: parsed.subjects || 'Unknown subjects',
            safeZones: parsed.safeZones || 'lower-third',
            palette: Array.isArray(parsed.palette) ? parsed.palette.slice(0, 5) : ['#ffffff'],
            composition: parsed.composition || 'Standard composition',
            frameSnapshot,
          };
        }
      }

      const errBody = await response.text().catch(() => '');
      if (isModelUnavailable(response.status, errBody)) {
        lastError = `Vision model ${model} unavailable (${response.status})`;
        continue;
      }
      lastError = `Gemini Vision ${model} error: ${response.status}`;
    } catch (err: any) {
      if (err?.name === 'AbortError') throw err;
      lastError = err?.message || 'Vision analysis failed';
    }
  }

  throw new Error(lastError || 'Gemini Vision analysis failed on all models');
}

// ─── Transparency Enforcement ───────────────────────────────────────────────

/**
 * Ensures the generated motion graphic is strictly transparent and runs over the video
 * without obscuring it with full-frame opaque backgrounds or dark canvas fills.
 */
export function enforceHtmlTransparency(html: string): string {
  if (!html || typeof document === 'undefined') return html;

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const root = doc.body.firstElementChild as HTMLElement | null;
    if (!root) return html;

    // 1. Root container MUST be transparent
    root.style.setProperty('background', 'transparent', 'important');
    root.style.setProperty('background-color', 'transparent', 'important');

    // 2. Neutralize any full-frame opaque elements
    const allElements = root.querySelectorAll('*');
    for (const el of Array.from(allElements)) {
      const tagName = el.tagName.toLowerCase();

      // SVG rects that cover full frame
      if (tagName === 'rect') {
        const w = (el.getAttribute('width') || '').trim();
        const h = (el.getAttribute('height') || '').trim();
        const fill = (el.getAttribute('fill') || '').trim().toLowerCase();
        const isFullW = w === '100%' || w === '1920' || parseFloat(w) >= 1900;
        const isFullH = h === '100%' || h === '1080' || parseFloat(h) >= 1060;

        if (isFullW && isFullH) {
          const isOpaqueSolid = fill && fill !== 'none' && fill !== 'transparent' && !fill.startsWith('url(');
          const opacity = parseFloat(el.getAttribute('opacity') || '1');
          if (isOpaqueSolid && opacity > 0.8) {
            el.remove();
          }
        }
      }

      // Full frame divs with dark/solid background
      if (tagName === 'div') {
        const htmlEl = el as HTMLElement;
        const style = htmlEl.getAttribute('style') || '';
        const bgMatch = style.match(/background(?:-color)?:\s*([^;]+)/i);
        if (bgMatch) {
          const bgVal = bgMatch[1].trim().toLowerCase();
          const hasFullW = style.includes('width: 100%') || style.includes('width:100%') || style.includes('width: 1920') || style.includes('width:1920') || style.includes('inset: 0') || style.includes('inset:0');
          const hasFullH = style.includes('height: 100%') || style.includes('height:100%') || style.includes('height: 1080') || style.includes('height:1080') || style.includes('inset: 0') || style.includes('inset:0');

          if (hasFullW && hasFullH) {
            const isDarkOrOpaque =
              bgVal.startsWith('#0') || bgVal.startsWith('#1') || bgVal === 'black' ||
              bgVal.startsWith('rgb(0') || bgVal.startsWith('rgb(1') || bgVal.startsWith('rgba(0,0,0,1') ||
              bgVal.startsWith('rgba(15,23,42,1') || bgVal.startsWith('rgba(10,10,10,1');
            if (isDarkOrOpaque) {
              htmlEl.style.setProperty('background', 'transparent', 'important');
              htmlEl.style.setProperty('background-color', 'transparent', 'important');
            }
          }
        }
      }
    }

    return doc.body.innerHTML;
  } catch (err) {
    console.warn('[customFxDirector] enforceHtmlTransparency error:', err);
    return html;
  }
}

// ─── Phase 2: Co-Reasoning ───────────────────────────────────────────────────

function buildCoReasoningPrompt(
  audioBreakdown: AudioBreakdown | null,
  visualBreakdown: VisualBreakdown | null,
  customPrompt: string | undefined,
  duration: number,
  options?: {
    isRegenerate?: boolean;
    iteration?: number;
    previousReasoning?: string;
  }
): string {
  const d = duration.toFixed(1);
  const isRegen = !!options?.isRegenerate;
  const iteration = options?.iteration ?? (isRegen ? 2 : 1);

  let audioSection = '';
  if (audioBreakdown) {
    audioSection = `AUDIO ANALYSIS (Spoken Dialogue & Tone):
- Transcript: "${audioBreakdown.transcript.slice(0, 600)}"
- Keywords: [${audioBreakdown.keywords.map(k => `"${k}"`).join(', ')}]
- Vocal Tone: ${audioBreakdown.tone}
- Speech Pace: ${audioBreakdown.pace}\n\n`;
  } else {
    audioSection = 'AUDIO ANALYSIS: Not available (clip has no speech or audio scan failed).\n\n';
  }

  let visualSection = '';
  if (visualBreakdown) {
    visualSection = `VISUAL ANALYSIS (Video Composition & Framing):
- Scene Type: ${visualBreakdown.sceneType}
- Main Subjects: ${visualBreakdown.subjects}
- Safe Zones (MUST place artwork here): ${visualBreakdown.safeZones}
- Extracted Palette: [${visualBreakdown.palette.join(', ')}]
- Framing / Composition: ${visualBreakdown.composition}\n\n`;
  } else {
    visualSection = 'VISUAL ANALYSIS: Not available (frame extraction failed).\n\n';
  }

  let deepThinkingSection = '';
  if (isRegen) {
    deepThinkingSection = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 DEEP THINKING & ITERATIVE DIVERGENCE PASS (Attempt #${iteration}):
The user has requested a RE-GENERATION to produce a FRESH, HIGHER-FIDELITY, and DEEPER motion graphic.
1. DIVERGE CREATIVELY: Do NOT repeat a basic design or simple text box. Explore a distinctive visual metaphor.
2. SUBTEXT JUSTIFICATION: Think deeply about what is being communicated in the dialogue ("${audioBreakdown?.transcript ? audioBreakdown.transcript.slice(0, 150) : ''}"). Translate abstract concepts into concrete animated symbols.
3. ELEVATE ARTISTRY: Create multi-layered SVG compositions: interlocking geometric strokes, radial/linear gradients, subtle pulsing glow rings, glowing dropshadows (filter: drop-shadow(0 0 12px ...)), and smooth multi-stage CSS keyframes.
4. AMBIENT CONTINUITY: Include gentle floating, orbiting, or breathing loops (@keyframes) so the overlay remains visually captivating throughout the entire ${d}s clip.
${options?.previousReasoning ? `5. PREVIOUS ATTEMPT REASONING was: "${options.previousReasoning.slice(0, 200)}...". DIVERGE from this approach into something bolder and cleaner.` : ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  }

  return `You are an elite Motion Graphics Art Director designing a transparent animation overlay that runs OVER raw video footage in a professional video editor.

${audioSection}${visualSection}${deepThinkingSection}CLIP DURATION: ${d} seconds
${customPrompt ? `USER SPECIAL INSTRUCTIONS: "${customPrompt}"\n` : ''}
CORE MANDATES — TRANSPARENT OVERLAY OVER LIVE VIDEO:
1. 100% TRANSPARENT CANVAS: The video footage plays underneath this animation! The root container MUST have background: transparent; and NO full-frame opaque rectangles or backdrops (#000, #111, black) are allowed.
2. RESPECT SAFE ZONES: Keep the central action / speaker's face unobstructed. Position overlay graphics inside the detected safe zones (${visualBreakdown?.safeZones || 'lower-third or side thirds'}).
3. VISUALLY JUSTIFY THE DIALOGUE: The animation must tell the same story as the words spoken. Don't just show animated text — illustrate the idea with vector shapes, indicators, icons, charts, or HUD graphics.
4. GLASSMORPHIC & ACCENTED PANELS: If text or badges are grouped, use semi-transparent glassmorphic cards: background: rgba(15, 23, 42, 0.65); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.18); border-radius: 16px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.37);
5. VECTOR ARTWORK REQUIREMENT: Include at least 8-12 SVG shape elements (paths, circles, rects, polylines, polygons) inside an <svg viewBox="0 0 1920 1080"> container.
6. TIMING & MOTION:
   - Entrance: 0s to 0.7s (smooth ease-out, e.g. transform: translateY(30px) scale(0.95); opacity: 0 -> translateY(0) scale(1); opacity: 1).
   - Active / Loop: 0.7s to ${(duration - 0.5).toFixed(1)}s (subtle floating, pulsing glow, rotating radar arcs, or glowing light sweeps).
   - Exit: Optional graceful fade or sustained hold until clip end with animation-fill-mode: both.

SUGGESTED OVERLAY ARCHETYPES (Pick the one that best suits this specific scene & dialogue):
• Kinetic Concept Callout: Floating badge in safe zone illustrating the spoken topic with custom vector icon, glowing accent border, and key phrase.
• Holographic HUD / Tech Scanner: Corner frame brackets [ + ], glowing circular reticle with rotating tick marks, telemetry counters, cyan/magenta glowing strokes.
• Visual Explainer & Infographic: Animated metric counter, progress ring, rising graph with gradient fill, or leader line pointing to focal points.
• Dynamic Lower-Third & Floating Badges: Sleek animated lower-third banner with glowing accent line, geometric badge icon, and smooth staggered text reveal.
• Energy Aura / Accent Particle Bursts: Floating geometric sparkles, acoustic energy pulses, or ambient glow sweeps along edges.
• Alert / Impact / Highlight Tag: Pulsing caution/highlight badge with diagonal accents or glowing shield, directing focus to critical statements.

ROOT WRAPPER SPECIFICATION:
<div style="position:relative;width:1920px;height:1080px;overflow:hidden;background:transparent;">
  <style>
    /* CSS @keyframes animations using cubic-bezier easing */
  </style>
  <svg width="1920" height="1080" viewBox="0 0 1920 1080" style="position:absolute;top:0;left:0;width:100%;height:100%;overflow:visible;pointer-events:none;">
    <!-- SVG Vector Artwork & Shapes -->
  </svg>
  <!-- HTML Glassmorphic Badges, Callouts, or Typography (if any) -->
</div>

RESTRICTIONS:
- No external HTTP resources (no <img src="http">, no @import, no web fonts).
- Use web-safe fonts: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, or Impact.
- Return ONLY a single valid JSON object (no markdown fences):
{
  "name": "Descriptive Overlay Name — Genre",
  "description": "One-line description of the transparent motion graphic",
  "reasoning": "Detailed visual reasoning: how this graphic aligns with the dialogue subtext and fits the scene framing without obstructing subjects",
  "htmlCss": "<div style=\\"position:relative;width:1920px;height:1080px;overflow:hidden;background:transparent;\\">...</div>"
}`;
}

async function callGroqReasoning(
  prompt: string,
  signal?: AbortSignal,
  temperature = 0.4
): Promise<string> {
  let lastError = '';
  for (const model of GROQ_REASONING_MODELS) {
    try {
      const response = await fetchWithKeyFailover(
        () => 'https://api.groq.com/openai/v1/chat/completions',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal,
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: 'You are an elite motion graphics designer. Return ONLY valid JSON.' },
              { role: 'user', content: prompt },
            ],
            temperature,
            max_tokens: 32768,
            response_format: { type: 'json_object' },
          }),
        },
        'groq'
      );

      if (response.ok) {
        const data = await response.json();
        const text = data?.choices?.[0]?.message?.content || '';
        const finishReason = data?.choices?.[0]?.finish_reason;
        if (text.trim() && finishReason !== 'length') return text;
        lastError = 'Response was truncated';
        continue;
      }

      const errBody = await response.text().catch(() => '');
      if (isModelUnavailable(response.status, errBody)) {
        lastError = `Groq model ${model} unavailable (${response.status})`;
        continue;
      }
      lastError = `Groq ${model} error: ${response.status}`;
    } catch (err: any) {
      if (err?.name === 'AbortError') throw err;
      lastError = err?.message || 'Groq reasoning failed';
    }
  }
  throw new Error(lastError || 'Groq reasoning failed on all models');
}

async function callGeminiReasoning(
  prompt: string,
  signal?: AbortSignal,
  temperature = 0.4
): Promise<string> {
  let lastError = '';
  for (const model of GEMINI_REASONING_MODELS) {
    try {
      const response = await fetchWithKeyFailover(
        (key) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal,
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
              temperature,
              responseMimeType: 'application/json',
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
          lastError = 'Response was truncated';
          continue;
        }
        const text = (candidate?.content?.parts || []).map((p: any) => p?.text || '').filter(Boolean).join('\n');
        if (text.trim()) return text;
        lastError = 'Empty response';
        continue;
      }

      const errBody = await response.text().catch(() => '');
      if (isModelUnavailable(response.status, errBody)) {
        lastError = `Gemini model ${model} unavailable (${response.status})`;
        continue;
      }
      lastError = `Gemini ${model} error: ${response.status}`;
    } catch (err: any) {
      if (err?.name === 'AbortError') throw err;
      lastError = err?.message || 'Gemini reasoning failed';
    }
  }
  throw new Error(lastError || 'Gemini reasoning failed on all models');
}

/**
 * Strips residual escaped quotes from LLM-generated HTML.
 * LLMs often return JSON where the htmlCss value has double-escaped quotes:
 *   width=\\\"1920\\\" -> after JSON.parse -> width=\"1920\"
 * The browser needs clean: width="1920"
 */
function stripEscapedQuotes(html: string): string {
  if (!html) return html;
  // Replace literal backslash-quote sequences with just quotes
  // Handle multiple levels of escaping: \\" -> \" -> "
  let result = html;
  // Keep replacing until stable (handles triple+ escaping)
  let prev = '';
  let iterations = 0;
  while (result !== prev && iterations < 5) {
    prev = result;
    result = result.replace(/\\"/g, '"');
    iterations++;
  }
  return result;
}

export async function coReasonAndGenerate(
  audioBreakdown: AudioBreakdown | null,
  visualBreakdown: VisualBreakdown | null,
  customPrompt: string | undefined,
  duration: number,
  signal?: AbortSignal,
  options?: {
    isRegenerate?: boolean;
    iteration?: number;
    previousReasoning?: string;
  }
): Promise<{ htmlCss: string; name: string; description: string; reasoning: string }> {
  const isRegen = !!options?.isRegenerate;
  const temp = isRegen ? 0.65 : 0.4;
  const prompt = buildCoReasoningPrompt(audioBreakdown, visualBreakdown, customPrompt, duration, options);

  // Try Groq first (GPT-OSS 120B), fall back to Gemini
  let rawText: string;
  try {
    rawText = await callGroqReasoning(prompt, signal, temp);
  } catch (groqErr: any) {
    if (groqErr?.name === 'AbortError') throw groqErr;
    console.warn('[customFxDirector] Groq reasoning failed, falling back to Gemini:', groqErr.message);
    rawText = await callGeminiReasoning(prompt, signal, temp);
  }

  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

  const parsed = parseJsonSafely(rawText);
  let htmlCss = typeof parsed.htmlCss === 'string' ? parsed.htmlCss : '';

  // Strip residual escaped quotes from LLM output before any DOM parsing
  htmlCss = stripEscapedQuotes(htmlCss);

  // Sanitize the generated HTML and enforce strict transparency
  htmlCss = sanitizeMotionSceneHtml(htmlCss);
  htmlCss = enforceHtmlTransparency(htmlCss);

  if (!htmlCss.trim()) {
    throw new Error('AI generated empty animation code');
  }

  return {
    htmlCss,
    name: parsed.name || 'Custom AI Effect',
    description: parsed.description || 'AI-generated animation overlay',
    reasoning: parsed.reasoning || 'Generated based on audio and visual analysis',
  };
}

// ─── Phase 3: Thumbnail Generation ───────────────────────────────────────────

export async function generateThumbnail(
  htmlCss: string,
  duration: number
): Promise<string | undefined> {
  try {
    const stage = createSceneStage(htmlCss, { width: 320, height: 180, transparent: true });
    if (!stage) return undefined;

    try {
      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 180;
      const seekTime = Math.min(duration * 0.5, duration - 0.1);
      const ok = await captureSceneFrame(stage, canvas, seekTime, stage.hasAnimations ? 'css' : 'static');
      if (!ok) return undefined;

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.7)
      );
      if (!blob) return undefined;
      return await blobToBase64(blob);
    } finally {
      destroySceneStage(stage);
    }
  } catch (err) {
    console.warn('[customFxDirector] Thumbnail generation failed:', err);
    return undefined;
  }
}

// ─── Full Orchestrator ───────────────────────────────────────────────────────

export async function generateCustomFx(
  clip: TimelineClip,
  mediaUrl: string,
  mediaId: string | undefined,
  customPrompt?: string,
  onProgress?: (progress: CustomFxProgress) => void,
  signal?: AbortSignal,
  options?: GenerateCustomFxOptions
): Promise<CustomFxGenerationResult> {
  const duration = clip.duration || 5;
  const report = (phase: CustomFxPhase, message: string, percent: number) => {
    onProgress?.({ phase, message, percent });
  };

  // Phase 1: Check in-memory scan cache or options
  const cachedScan = options?.cachedScan || getClipScanCache(clip);
  let audioBreakdown: AudioBreakdown | null = null;
  let visualBreakdown: VisualBreakdown | null = null;

  if (cachedScan && (cachedScan.audioBreakdown || cachedScan.visualBreakdown)) {
    // REUSE CACHED SCAN - ZERO RE-SCAN OVERHEAD
    audioBreakdown = cachedScan.audioBreakdown;
    visualBreakdown = cachedScan.visualBreakdown;
    const msg = options?.isRegenerate
      ? `⚡ Reusing analyzed scene data • AI thinking deeper (Pass #${options.iteration || 2})...`
      : '⚡ Reusing analyzed scene data • Designing motion graphics...';
    report('reasoning', msg, 40);
  } else {
    // Simultaneous multimodal scanning (only on first scan for this clip)
    report('scanning', 'Starting multimodal scan (Groq Whisper + Gemini Vision)...', 5);

    const audioPromise = scanAudio(clip, mediaUrl, mediaId, signal)
      .then((result) => {
        report('scanning', 'Audio transcription complete', 25);
        return result;
      });

    const visionPromise = scanVision(clip, mediaUrl, duration, signal)
      .then((result) => {
        report('scanning', 'Visual scene analysis complete', 25);
        return result;
      });

    const [audioSettled, visionSettled] = await Promise.allSettled([audioPromise, visionPromise]);

    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    audioBreakdown = audioSettled.status === 'fulfilled' ? audioSettled.value : null;
    visualBreakdown = visionSettled.status === 'fulfilled' ? visionSettled.value : null;

    if (audioSettled.status === 'rejected') {
      console.warn('[customFxDirector] Audio scan failed:', audioSettled.reason);
    }
    if (visionSettled.status === 'rejected') {
      console.warn('[customFxDirector] Vision scan failed:', visionSettled.reason);
    }

    // At least one agent must succeed (or user provides custom prompt)
    if (!audioBreakdown && !visualBreakdown && !customPrompt) {
      throw new Error('Both audio and visual analysis failed. Please provide a custom prompt or check your API keys.');
    }

    // Store in cache for instantaneous re-generation
    setClipScanCache(clip, { audioBreakdown, visualBreakdown });
    report('scanning', 'Multimodal scan complete & cached', 40);
  }

  // Phase 2: Co-reasoning with Deep Thinking
  const reasoningMsg = options?.isRegenerate
    ? 'AI is thinking deeper to craft a new motion graphic...'
    : 'AI is designing your transparent animation...';
  report('reasoning', reasoningMsg, 50);

  let result = await coReasonAndGenerate(audioBreakdown, visualBreakdown, customPrompt, duration, signal, options);

  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

  // Validation: check scene quality using existing validator
  report('validating', 'Validating animation quality & transparency...', 65);
  const fakeSpec = {
    width: 1920, height: 1080, fps: 30, duration,
    canvasElements: [],
    htmlCssScenes: [{ enterAt: 0, exitAt: duration, description: result.description, htmlCss: result.htmlCss }],
  };
  const issues = validateSceneQuality(fakeSpec, 'mixed');

  if (issues.length > 0) {
    report('retrying', 'Refining design (elevating vector artwork)...', 70);
    console.warn('[customFxDirector] Design rejected:', issues);

    try {
      const correctionPrompt = `Your previous animation design was REJECTED by the quality validator:

${issues.map(i => `• ${i}`).join('\n')}

Rewrite from scratch. NON-NEGOTIABLE:
1. At least 8-12 SVG shape elements (rect, circle, path, polygon, line, ellipse, polyline)
2. Text covers at most 25% of the frame — artwork is the CONTENT
3. 100% TRANSPARENT background — no full-frame dark/opaque fills (#000, black, #111)
4. Root: <div style="position:relative;width:1920px;height:1080px;overflow:hidden;background:transparent;">
5. Duration: ${duration.toFixed(1)}s with staggered CSS animation-delay values

Return ONLY JSON: { "name": "...", "description": "...", "reasoning": "...", "htmlCss": "..." }`;

      let correctedText: string;
      try {
        correctedText = await callGroqReasoning(correctionPrompt, signal, 0.5);
      } catch {
        correctedText = await callGeminiReasoning(correctionPrompt, signal, 0.5);
      }

      const correctedParsed = parseJsonSafely(correctedText);
      let correctedHtml = sanitizeMotionSceneHtml(stripEscapedQuotes(correctedParsed.htmlCss || ''));
      correctedHtml = enforceHtmlTransparency(correctedHtml);

      if (correctedHtml.trim()) {
        const correctedSpec = {
          ...fakeSpec,
          htmlCssScenes: [{ enterAt: 0, exitAt: duration, description: correctedParsed.description || '', htmlCss: correctedHtml }],
        };
        const correctedIssues = validateSceneQuality(correctedSpec, 'mixed');
        if (correctedIssues.length < issues.length) {
          result = {
            htmlCss: correctedHtml,
            name: correctedParsed.name || result.name,
            description: correctedParsed.description || result.description,
            reasoning: correctedParsed.reasoning || result.reasoning,
          };
        }
      }
    } catch (retryErr: any) {
      if (retryErr?.name === 'AbortError') throw retryErr;
      console.warn('[customFxDirector] Correction pass failed:', retryErr);
    }
  }

  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

  // Phase 3: Thumbnail
  report('generating-thumbnail', 'Generating preview thumbnail...', 85);
  const thumbnail = await generateThumbnail(result.htmlCss, duration);

  report('done', 'Custom FX generated successfully!', 100);

  // Build the full prompt that was used (so user can edit and re-generate)
  const fullPrompt = buildCoReasoningPrompt(audioBreakdown, visualBreakdown, customPrompt, duration, options);

  return {
    htmlCss: result.htmlCss,
    name: result.name,
    description: result.description,
    reasoning: result.reasoning,
    prompt: fullPrompt,
    audioBreakdown,
    visualBreakdown,
    thumbnail,
    videoFrameSnapshot: visualBreakdown?.frameSnapshot,
  };
}
