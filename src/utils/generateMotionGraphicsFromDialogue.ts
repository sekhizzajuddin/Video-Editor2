import { fetchWithKeyFailover, getLocalGeminiKey, getEnvGeminiKey } from './apiKeyManager';
import { compileStoryboard, StoryboardChunk } from './storyboardCompiler';
import { MotionGraphicSpec, renderMotionGraphicToVideo } from './motionGraphicRenderer';

const GEMINI_MODEL = 'gemini-3.5-flash-lite';

export interface GenerativeMotionOptions {
  provider: 'gemini' | 'groq';
  style: string; // 'mrbeast' | 'hormozi' | 'cyberpunk' | 'minimal' | 'custom'
  layout: string; // 'kinetic' | 'lower_third' | 'subtitle' | 'mixed'
  customPrompt?: string;
  targetDuration?: number; // for text-to-motion mode
  dialogueText?: string; // for text-to-motion mode (no clip)
}

export interface GenerativeResult {
  spec: MotionGraphicSpec;
  transcribedText: string;
  webmBlob: Blob | null;
}

/**
 * Orchestrates end-to-end AI motion graphic generation:
 * 1. Extracts video frames/storyboards or processes raw dialogue text.
 * 2. Prompts Gemini / Groq with available canvas and HTML/CSS component capabilities.
 * 3. Validates and sanitizes the motion graphic specification.
 * 4. Renders the complete motion graphic composition into an alpha-channel WebM video.
 */
export async function generateMotionGraphicsFromDialogue(
  clipMediaUrl: string | null,
  clipDuration: number,
  options: GenerativeMotionOptions,
  onProgress: (step: string, pct: number) => void
): Promise<GenerativeResult> {
  const provider = options.provider || 'gemini';
  let targetDuration = options.targetDuration || clipDuration || 5;
  let dialogueText = options.dialogueText || '';
  let storyboardChunks: StoryboardChunk[] = [];

  // 1. Ingestion: Extract video storyboard frames or prepare dialogue text
  if (clipMediaUrl) {
    onProgress('Extracting video frames', 10);
    try {
      const videoEl = document.createElement('video');
      videoEl.crossOrigin = 'anonymous';
      videoEl.muted = true;
      videoEl.playsInline = true;
      videoEl.src = clipMediaUrl;

      await new Promise<void>((resolve) => {
        let done = false;
        const complete = () => {
          if (!done) {
            done = true;
            resolve();
          }
        };
        videoEl.onloadedmetadata = complete;
        videoEl.oncanplay = complete;
        setTimeout(complete, 3000);
      });

      const effectiveDuration = videoEl.duration && !isNaN(videoEl.duration) ? videoEl.duration : targetDuration;
      targetDuration = effectiveDuration;

      storyboardChunks = await compileStoryboard(
        videoEl,
        0,
        Math.min(effectiveDuration, 30),
        (pct) => onProgress('Extracting video frames', Math.round(10 + pct * 10)),
        1
      );
    } catch (err) {
      console.warn('[generateMotionGraphicsFromDialogue] Frame extraction warning:', err);
    }
    onProgress('Frames extracted', 20);
  } else {
    onProgress('Preparing motion design', 20);
  }

  // 2. Build structured system prompt describing canvas components & HTML/CSS capabilities
  const promptText = buildAiMotionPrompt(dialogueText, targetDuration, options, storyboardChunks.length > 0);

  onProgress('AI Designing motion graphics', 40);

  // 3. Call AI API
  let rawJsonText = '';
  let transcribedText = dialogueText;

  if (provider === 'gemini') {
    const parts: any[] = [];
    if (storyboardChunks.length > 0) {
      for (const chunk of storyboardChunks) {
        parts.push({
          inline_data: {
            mime_type: 'image/jpeg',
            data: chunk.base64Image,
          },
        });
      }
    }
    parts.push({ text: promptText });

    const response = await fetchWithKeyFailover(
      (key) => `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts }],
          generationConfig: {
            temperature: 0.3,
            responseMimeType: 'application/json',
          },
        }),
      },
      'gemini'
    );

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      throw new Error(`Gemini API call failed (${response.status}): ${errBody || response.statusText}`);
    }

    const data = await response.json();
    rawJsonText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } else {
    // Groq Provider Fallback
    const response = await fetchWithKeyFailover(
      () => `https://api.groq.com/openai/v1/chat/completions`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            {
              role: 'system',
              content: 'You are an elite motion graphics designer. You must return ONLY valid JSON adhering strictly to the MotionGraphicSpec schema.',
            },
            {
              role: 'user',
              content: promptText,
            },
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' },
        }),
      },
      'groq'
    );

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      throw new Error(`Groq API call failed (${response.status}): ${errBody || response.statusText}`);
    }

    const data = await response.json();
    rawJsonText = data.choices?.[0]?.message?.content || '';
  }

  onProgress('Validating design specification', 60);

  // 4. Parse & sanitize JSON output
  const rawSpec = parseJsonSafely(rawJsonText);
  if (rawSpec.transcribedText && typeof rawSpec.transcribedText === 'string') {
    transcribedText = rawSpec.transcribedText;
  }

  const spec = sanitizeMotionGraphicSpec(rawSpec, targetDuration);

  // 5. Render Motion Graphic Video
  onProgress('Rendering motion graphics video', 70);

  let webmBlob: Blob | null = null;
  try {
    webmBlob = await renderMotionGraphicToVideo(spec, (step, pct) => {
      onProgress(step, Math.round(70 + (pct / 100) * 28));
    });
  } catch (renderError) {
    console.error('[generateMotionGraphicsFromDialogue] Rendering error:', renderError);
    throw new Error(`Failed to render motion graphics to video: ${renderError instanceof Error ? renderError.message : String(renderError)}`);
  }

  onProgress('Complete', 100);

  return {
    spec,
    transcribedText: transcribedText || options.dialogueText || '',
    webmBlob,
  };
}

/**
 * Builds the comprehensive prompt for AI motion graphic generation.
 */
function buildAiMotionPrompt(
  dialogueText: string,
  duration: number,
  options: GenerativeMotionOptions,
  hasStoryboardImages: boolean
): string {
  return `You are an elite Hollywood & YouTube Motion Graphics Art Director and Technical Animator.
Generate a high-impact, professional Motion Graphic design specification for a ${duration.toFixed(1)} second video sequence at 1920x1080 resolution (30 FPS).

STYLE: "${options.style}" (e.g. mrbeast: explosive high energy, bold yellow/cyan/red accents, chunky strokes, elastic/bounce; hormozi: bold yellow/green badges, word-by-word voice sync highlight, high contrast stats; cyberpunk: neon cyan/magenta, glitch, tech HUD grids, glowing outlines; minimal: sleek clean typography, smooth cubic ease, elegant slate/gold/white).
LAYOUT: "${options.layout}" (kinetic, lower_third, subtitle, or mixed).
${options.customPrompt ? `CUSTOM INSTRUCTIONS: ${options.customPrompt}` : ''}
${dialogueText ? `DIALOGUE / SCRIPT: "${dialogueText}"` : ''}
${hasStoryboardImages ? 'NOTE: Visual video frames from the scene are provided as images to align motion graphics with visual subjects.' : ''}

AVAILABLE CANVAS 2D COMPONENTS:
1. "KineticWord": High impact animated typography.
   Config: {
     "text": string,
     "fontSize": number (e.g. 54-84),
     "fontFamily": string,
     "color": string (e.g. "#ffe600", "#ffffff"),
     "animation": "spring" | "bounce" | "elastic" | "zoom" | "zoomBlur" | "slideUp" | "slideDown" | "slideLeft" | "slideRight" | "scaleFlip" | "glitch" | "fadeIn",
     "stroke": { "color": string, "width": number },
     "shadow": { "color": string, "blur": number, "offsetX"?: number, "offsetY"?: number },
     "glow": { "color": string, "blur": number },
     "position": { "x": number, "y": number }
   }

2. "VoiceSyncHighlight": Dynamic word-by-word karaoke style text highlighter.
   Config: {
     "words": Array<{ "text": string, "start": number (seconds from element enterAt), "end": number (seconds from element enterAt) }>,
     "highlightColor": string,
     "textColor": string,
     "dimColor": string,
     "fontSize": number (e.g. 36-48),
     "position": { "x": number, "y": number }
   }

3. "MotionArrow": Dynamic animated bezier arrow pointing to key areas.
   Config: {
     "from": { "x": number, "y": number },
     "to": { "x": number, "y": number },
     "curve": number (e.g. -50 to 50),
     "color": string,
     "thickness": number,
     "headSize": number,
     "drawDuration": number,
     "glow": boolean
   }

4. "AnimatedBarChart": Animated comparative bar chart.
   Config: {
     "bars": Array<{ "label": string, "value": number, "color"?: string }>,
     "maxValue": number,
     "width": number,
     "height": number,
     "position": { "x": number, "y": number },
     "barColor": string,
     "textColor": string
   }

5. "AnimatedLineGraph": Animated upward/downward graph trend.
   Config: {
     "points": Array<{ "x": number, "y": number, "label"?: string }>,
     "width": number,
     "height": number,
     "color": string,
     "lineWidth": number,
     "showDots": boolean,
     "showArea": boolean,
     "position": { "x": number, "y": number }
   }

6. "AnimatedCounter": Rolling metric counter ($ or numbers).
   Config: {
     "from": number,
     "to": number,
     "prefix": string,
     "suffix": string,
     "decimals": number,
     "fontSize": number,
     "color": string,
     "position": { "x": number, "y": number }
   }

7. "LowerThird": Sleek lower third banner for names/titles/topics.
   Config: {
     "title": string,
     "subtitle"?: string,
     "titleColor"?: string,
     "subtitleColor"?: string,
     "accentColor"?: string,
     "bgColor"?: string,
     "style"?: "modern" | "minimal" | "bold" | "gradient",
     "position": { "x": number, "y": number }
   }

8. "TitleCard": Bold title presentation card.
   Config: {
     "title": string,
     "subtitle"?: string,
     "tag"?: string,
     "titleColor"?: string,
     "subtitleColor"?: string,
     "accentColor"?: string,
     "position": { "x": number, "y": number }
   }

9. "ParticleBurst": Particle celebration or impact explosion.
   Config: {
     "count": number,
     "colors": string[],
     "maxRadius": number,
     "speed": number,
     "position": { "x": number, "y": number }
   }

10. "CircleHighlight": Pulsing target ring around key screen point.
    Config: {
      "radius": number,
      "color": string,
      "strokeWidth": number,
      "pulseCount": number,
      "glow": boolean,
      "position": { "x": number, "y": number }
    }

HTML/CSS SCENES ("htmlCssScenes"):
You can also generate rich, standalone HTML/CSS/SVG scenes with CSS @keyframes.
- The htmlCss string should be a self-contained snippet with <style> tags and HTML elements.
- Always use transparent background or transparent wrappers unless a dark overlay is intended.
- Set animations to match the scene's duration (exitAt - enterAt).

OUTPUT FORMAT:
You MUST respond with a single valid JSON object adhering exactly to this TypeScript schema:
{
  "transcribedText": string (transcription of dialogue or refined script),
  "width": 1920,
  "height": 1080,
  "fps": 30,
  "duration": ${duration.toFixed(1)},
  "canvasElements": [
    {
      "component": "KineticWord" | "VoiceSyncHighlight" | "MotionArrow" | "AnimatedBarChart" | "AnimatedLineGraph" | "AnimatedCounter" | "LowerThird" | "TitleCard" | "ParticleBurst" | "CircleHighlight",
      "enterAt": number (0 to ${duration.toFixed(1)}),
      "exitAt": number (enterAt < exitAt <= ${duration.toFixed(1)}),
      "config": object,
      "position": { "x": number, "y": number }
    }
  ],
  "htmlCssScenes": [
    {
      "enterAt": number,
      "exitAt": number,
      "description": string,
      "htmlCss": string
    }
  ]
}

Ensure all elements have precise timing spanning 0 to ${duration.toFixed(1)}s. Do not output markdown fences or explanatory text outside the JSON.`;
}

/**
 * Strips markdown code blocks and safely parses JSON.
 */
function parseJsonSafely(raw: string): any {
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '').trim();
  }
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    // Attempt regex extraction of outermost JSON object
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        // Fallback below
      }
    }
    console.warn('[generateMotionGraphicsFromDialogue] JSON parse error, returning fallback:', err);
    return {};
  }
}

/**
 * Validates and clamps motion graphic timing, dimensions, and element specifications.
 */
function sanitizeMotionGraphicSpec(raw: any, targetDuration: number): MotionGraphicSpec {
  const duration = Math.max(0.5, Number(raw.duration) || targetDuration || 5);
  const width = 1920;
  const height = 1080;
  const fps = 30;

  const rawElements = Array.isArray(raw.canvasElements) ? raw.canvasElements : [];
  const canvasElements = rawElements.map((el: any) => {
    let enterAt = Math.max(0, Math.min(duration - 0.1, Number(el.enterAt) || 0));
    let exitAt = Math.max(enterAt + 0.2, Math.min(duration, Number(el.exitAt) || duration));
    if (exitAt <= enterAt) {
      exitAt = Math.min(duration, enterAt + 1.0);
    }
    const component = typeof el.component === 'string' && el.component ? el.component : 'KineticWord';
    const config = el.config && typeof el.config === 'object' ? el.config : {};
    const position = el.position && typeof el.position === 'object' && typeof el.position.x === 'number'
      ? { x: el.position.x, y: el.position.y ?? height / 2 }
      : undefined;

    return {
      component,
      enterAt: Number(enterAt.toFixed(2)),
      exitAt: Number(exitAt.toFixed(2)),
      config,
      position,
    };
  });

  const rawScenes = Array.isArray(raw.htmlCssScenes) ? raw.htmlCssScenes : [];
  const htmlCssScenes = rawScenes
    .map((s: any) => {
      let enterAt = Math.max(0, Math.min(duration - 0.1, Number(s.enterAt) || 0));
      let exitAt = Math.max(enterAt + 0.2, Math.min(duration, Number(s.exitAt) || duration));
      if (exitAt <= enterAt) {
        exitAt = Math.min(duration, enterAt + 1.0);
      }
      return {
        enterAt: Number(enterAt.toFixed(2)),
        exitAt: Number(exitAt.toFixed(2)),
        description: typeof s.description === 'string' ? s.description : 'HTML Scene',
        htmlCss: typeof s.htmlCss === 'string' ? s.htmlCss : '',
      };
    })
    .filter((s: any) => s.htmlCss.trim().length > 0);

  // If both are empty, construct an aesthetic fallback TitleCard so the output is never empty
  if (canvasElements.length === 0 && htmlCssScenes.length === 0) {
    canvasElements.push({
      component: 'TitleCard',
      enterAt: 0,
      exitAt: duration,
      config: {
        title: raw.transcribedText || 'Motion Graphics',
        subtitle: 'ProCut AI Generated',
        titleColor: '#ffe600',
        subtitleColor: '#ffffff',
        accentColor: '#00ffff',
      },
      position: { x: width / 2, y: height / 2 },
    });
  }

  return {
    width,
    height,
    fps,
    duration,
    canvasElements,
    htmlCssScenes,
  };
}
