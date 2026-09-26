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
          return {
            sceneType: parsed.sceneType || 'unknown',
            subjects: parsed.subjects || 'Unknown subjects',
            safeZones: parsed.safeZones || 'lower-third',
            palette: Array.isArray(parsed.palette) ? parsed.palette.slice(0, 5) : ['#ffffff'],
            composition: parsed.composition || 'Standard composition',
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

// ─── Phase 2: Co-Reasoning ───────────────────────────────────────────────────

function buildCoReasoningPrompt(
  audioBreakdown: AudioBreakdown | null,
  visualBreakdown: VisualBreakdown | null,
  customPrompt: string | undefined,
  duration: number
): string {
  const d = duration.toFixed(1);

  let audioSection = '';
  if (audioBreakdown) {
    audioSection = `AUDIO ANALYSIS:
- Transcript: "${audioBreakdown.transcript.slice(0, 500)}"
- Keywords: [${audioBreakdown.keywords.map(k => `"${k}"`).join(', ')}]
- Vocal Tone: ${audioBreakdown.tone}
- Speech Pace: ${audioBreakdown.pace}\n\n`;
  } else {
    audioSection = 'AUDIO ANALYSIS: Not available (clip has no speech or audio scan failed).\n\n';
  }

  let visualSection = '';
  if (visualBreakdown) {
    visualSection = `VISUAL ANALYSIS:
- Scene Type: ${visualBreakdown.sceneType}
- Subjects: ${visualBreakdown.subjects}
- Safe Zones for overlay: ${visualBreakdown.safeZones}
- Color Palette: [${visualBreakdown.palette.join(', ')}]
- Composition: ${visualBreakdown.composition}\n\n`;
  } else {
    visualSection = 'VISUAL ANALYSIS: Not available (frame extraction failed).\n\n';
  }

  return `You are an elite Motion Graphics Director creating a video overlay animation.

${audioSection}${visualSection}DURATION: ${d} seconds
${customPrompt ? `USER INSTRUCTIONS: "${customPrompt}"\n` : ''}
CREATE a self-contained HTML/CSS/SVG animation overlay that:
1. Visually JUSTIFIES the spoken dialogue through artwork (not just animated text)
2. Respects the safe zones — do NOT obscure the subject
3. Matches the emotional tone and pacing of the dialogue
4. Uses CSS @keyframes with animation-fill-mode: both and staggered animation-delay
5. Has a TRANSPARENT background (no full-frame backdrop)
6. Contains 8+ SVG shape elements (paths, circles, rects, polygons, lines)
7. Text budget: visible text must cover at most ~25% of the frame
8. Root wrapper: <div style="position:relative;width:1920px;height:1080px;overflow:hidden;background:transparent">
9. SVG artwork inside <svg width="1920" height="1080" viewBox="0 0 1920 1080" style="position:absolute;top:0;left:0;overflow:visible;">
10. NO external resources (no <img src="http">, no <link>, no @import, no web fonts)
11. Only web-safe fonts: Arial, Helvetica, Impact, "Courier New", Georgia
12. All animations must fit within ${d} seconds

SCENE-TYPE ART DIRECTION:
${visualBreakdown?.sceneType === 'explainer' ? '• Isometric assets, data callouts, animated charts, leader lines' : ''}
${visualBreakdown?.sceneType === 'tech' ? '• HUD panels, radar arcs, neon strokes (#22d3ee / #f0abfc), monospace labels' : ''}
${visualBreakdown?.sceneType === 'action' ? '• Impact flashes, speed lines, targeting brackets, screen shake indicators' : ''}
${visualBreakdown?.sceneType === 'interview' || visualBreakdown?.sceneType === 'monologue' ? '• Lower-third name badges, pull-quote callouts, subtle particle effects' : ''}
${visualBreakdown?.sceneType === 'cinematic' ? '• Letterbox bars, film grain, slow parallax, dramatic typography' : ''}
${visualBreakdown?.sceneType === 'comedy' ? '• Comic bursts, emoji-sized shapes, bouncy overshoots, confetti' : ''}
${visualBreakdown?.sceneType === 'tutorial' ? '• Step numbers, progress bars, highlight circles, pointer arrows' : ''}
${!visualBreakdown?.sceneType || visualBreakdown?.sceneType === 'vlog' ? '• Minimal Swiss typography, thin rules, elegant easing, one accent color' : ''}

Return ONLY a single valid JSON object (no markdown fences):
{
  "name": "Descriptive Effect Name — Scene Genre",
  "description": "Brief one-line description of the effect",
  "reasoning": "Why this specific animation style was chosen for this dialogue and visual scene",
  "htmlCss": "<div style=\\"position:relative;width:1920px;height:1080px;overflow:hidden;background:transparent\\">..."
}`;
}

async function callGroqReasoning(
  prompt: string,
  signal?: AbortSignal
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
            temperature: 0.4,
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
  signal?: AbortSignal
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
              temperature: 0.4,
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

export async function coReasonAndGenerate(
  audioBreakdown: AudioBreakdown | null,
  visualBreakdown: VisualBreakdown | null,
  customPrompt: string | undefined,
  duration: number,
  signal?: AbortSignal
): Promise<{ htmlCss: string; name: string; description: string; reasoning: string }> {
  const prompt = buildCoReasoningPrompt(audioBreakdown, visualBreakdown, customPrompt, duration);

  // Try Groq first (GPT-OSS 120B), fall back to Gemini
  let rawText: string;
  try {
    rawText = await callGroqReasoning(prompt, signal);
  } catch (groqErr: any) {
    if (groqErr?.name === 'AbortError') throw groqErr;
    console.warn('[customFxDirector] Groq reasoning failed, falling back to Gemini:', groqErr.message);
    rawText = await callGeminiReasoning(prompt, signal);
  }

  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

  const parsed = parseJsonSafely(rawText);
  let htmlCss = typeof parsed.htmlCss === 'string' ? parsed.htmlCss : '';

  // Sanitize the generated HTML
  htmlCss = sanitizeMotionSceneHtml(htmlCss);

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
  signal?: AbortSignal
): Promise<CustomFxGenerationResult> {
  const duration = clip.duration || 5;
  const report = (phase: CustomFxPhase, message: string, percent: number) => {
    onProgress?.({ phase, message, percent });
  };

  // Phase 1: Simultaneous multimodal scanning
  report('scanning', 'Starting multimodal scan...', 5);

  const audioPromise = scanAudio(clip, mediaUrl, mediaId, signal)
    .then((result) => {
      report('scanning', 'Audio transcription complete', 25);
      return result;
    });

  const visionPromise = scanVision(clip, mediaUrl, duration, signal)
    .then((result) => {
      report('scanning', 'Visual analysis complete', 25);
      return result;
    });

  const [audioSettled, visionSettled] = await Promise.allSettled([audioPromise, visionPromise]);

  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

  const audioBreakdown: AudioBreakdown | null =
    audioSettled.status === 'fulfilled' ? audioSettled.value : null;
  const visualBreakdown: VisualBreakdown | null =
    visionSettled.status === 'fulfilled' ? visionSettled.value : null;

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

  report('scanning', 'Multimodal scan complete', 40);

  // Phase 2: Co-reasoning
  report('reasoning', 'AI is designing your animation...', 50);
  let result = await coReasonAndGenerate(audioBreakdown, visualBreakdown, customPrompt, duration, signal);

  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

  // Validation: check scene quality using existing validator
  report('validating', 'Validating animation quality...', 65);
  const fakeSpec = {
    width: 1920, height: 1080, fps: 30, duration,
    canvasElements: [],
    htmlCssScenes: [{ enterAt: 0, exitAt: duration, description: result.description, htmlCss: result.htmlCss }],
  };
  const issues = validateSceneQuality(fakeSpec, 'mixed');

  if (issues.length > 0) {
    report('retrying', 'Refining design (adding vector artwork)...', 70);
    console.warn('[customFxDirector] Design rejected:', issues);

    try {
      const correctionPrompt = `Your previous animation design was REJECTED by the quality validator:

${issues.map(i => `• ${i}`).join('\n')}

Rewrite from scratch. NON-NEGOTIABLE:
1. At least 8 SVG shape elements (rect, circle, path, polygon, line, ellipse, polyline)
2. Text covers at most 25% of the frame — artwork is the CONTENT
3. Transparent background — no full-frame fill
4. Root: <div style="position:relative;width:1920px;height:1080px;overflow:hidden;background:transparent">
5. Duration: ${duration.toFixed(1)}s with staggered CSS animation-delay values

Return ONLY JSON: { "name": "...", "description": "...", "reasoning": "...", "htmlCss": "..." }`;

      let correctedText: string;
      try {
        correctedText = await callGroqReasoning(correctionPrompt, signal);
      } catch {
        correctedText = await callGeminiReasoning(correctionPrompt, signal);
      }

      const correctedParsed = parseJsonSafely(correctedText);
      const correctedHtml = sanitizeMotionSceneHtml(correctedParsed.htmlCss || '');

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
  const fullPrompt = buildCoReasoningPrompt(audioBreakdown, visualBreakdown, customPrompt, duration);

  return {
    htmlCss: result.htmlCss,
    name: result.name,
    description: result.description,
    reasoning: result.reasoning,
    prompt: fullPrompt,
    audioBreakdown,
    visualBreakdown,
    thumbnail,
  };
}
