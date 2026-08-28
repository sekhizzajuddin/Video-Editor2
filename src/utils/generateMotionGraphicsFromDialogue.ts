import { fetchWithKeyFailover } from './apiKeyManager';
import { compileStoryboard, StoryboardChunk } from './storyboardCompiler';
import { MotionGraphicSpec, renderMotionGraphicToVideo } from './motionGraphicRenderer';
import { generateImageFromCloudflare } from './cloudflareClient';

const GEMINI_MODEL = 'gemini-3.5-flash-lite';

export interface GenerativeMotionOptions {
  provider: 'gemini' | 'groq';
  style: string; // 'documentary' | 'kurzgesagt' | 'mrbeast' | 'hormozi' | 'cyberpunk' | 'minimal' | 'custom'
  layout: string; // 'kinetic' | 'lower_third' | 'subtitle' | 'mixed'
  customPrompt?: string;
  targetDuration?: number; // for text-to-motion mode
  dialogueText?: string; // for text-to-motion mode (no clip)
  signal?: AbortSignal;
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
 * 4. Resolves optional Cloudflare AI image assets.
 * 5. Renders the complete motion graphic composition into an alpha-channel WebM video.
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
    const videoEl = document.createElement('video');
    try {
      videoEl.crossOrigin = 'anonymous';
      videoEl.muted = true;
      videoEl.playsInline = true;
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
    } finally {
      try {
        videoEl.removeAttribute('src');
        videoEl.load();
      } catch {}
    }
    onProgress('Frames extracted', 20);
  } else {
    onProgress('Preparing motion design', 20);
  }

  // 2. Build structured system prompt describing canvas components & HTML/CSS capabilities
  const promptText = buildAiMotionPrompt(dialogueText, targetDuration, options, storyboardChunks.length > 0);

  onProgress('AI Designing visual scenes', 40);

  // 3. Call AI API
  let rawJsonText = '';
  let transcribedText = dialogueText;

  if (provider === 'gemini') {
    const parts: any[] = [];
    if (storyboardChunks.length > 0) {
      for (const chunk of storyboardChunks) {
        parts.push({
          inlineData: {
            mimeType: 'image/jpeg',
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
        signal: options.signal,
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
        signal: options.signal,
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

  onProgress('Validating design specification', 55);

  // 4. Parse & sanitize JSON output
  const rawSpec = parseJsonSafely(rawJsonText);
  if (rawSpec.transcribedText && typeof rawSpec.transcribedText === 'string') {
    transcribedText = rawSpec.transcribedText;
  }

  // 5. Optional Cloudflare AI image generation if imageAssets are requested
  if (Array.isArray(rawSpec.imageAssets) && rawSpec.imageAssets.length > 0) {
    onProgress('Generating AI image assets (Cloudflare)', 60);
    try {
      const { useEditorStore } = await import('@/store/editorStore');
      const state = useEditorStore.getState();
      const accountId = state.cloudflareAccountId || (import.meta as any).env?.VITE_CLOUDFLARE_ACCOUNT_ID;
      const apiToken = state.cloudflareApiToken || (import.meta as any).env?.VITE_CLOUDFLARE_API_TOKEN;

      if (accountId && apiToken) {
        for (const asset of rawSpec.imageAssets) {
          if (asset.prompt && asset.id) {
            try {
              const imageUrl = await generateImageFromCloudflare(asset.prompt, accountId, apiToken);
              // Replace placeholder ID in HTML/CSS scenes
              if (Array.isArray(rawSpec.htmlCssScenes)) {
                for (const scene of rawSpec.htmlCssScenes) {
                  if (typeof scene.htmlCss === 'string') {
                    scene.htmlCss = scene.htmlCss.replaceAll(`{{IMAGE_${asset.id}}}`, imageUrl);
                    scene.htmlCss = scene.htmlCss.replaceAll(asset.id, imageUrl);
                  }
                }
              }
            } catch (cfErr) {
              console.warn('[generateMotionGraphicsFromDialogue] Cloudflare image generation warning:', cfErr);
            }
          }
        }
      }
    } catch (cfLoadErr) {
      console.warn('[generateMotionGraphicsFromDialogue] Cloudflare assets lookup error:', cfLoadErr);
    }
  }

  const spec = sanitizeMotionGraphicSpec(rawSpec, targetDuration);

  // 6. Render Motion Graphic Video
  onProgress('Rendering vector animation video', 70);

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
 * Builds the comprehensive prompt for AI visual storytelling and motion graphic generation.
 */
function buildAiMotionPrompt(
  dialogueText: string,
  duration: number,
  options: GenerativeMotionOptions,
  hasStoryboardImages: boolean
): string {
  return `You are an elite Motion Graphics & Visual Storytelling Director (like Vox, Johnny Harris, Kurzgesagt, Polymatter, and Magnates Media).
Your task is to transform dialogue/scripts into REAL VISUAL MOTION GRAPHICS with geometric vector shapes, progressive world construction, and kinetic typography.

TOTAL DURATION: ${duration.toFixed(1)} seconds
RESOLUTION: 1920x1080 (30 FPS)
STYLE: "${options.style}" (documentary, kurzgesagt, mrbeast, hormozi, cyberpunk, minimal)
LAYOUT: "${options.layout}"
${options.customPrompt ? `USER INSTRUCTIONS: "${options.customPrompt}"` : ''}
${dialogueText ? `DIALOGUE / SCRIPT: "${dialogueText}"` : ''}
${hasStoryboardImages ? 'NOTE: Scene video frames provided to align motion graphics with subject coordinates.' : ''}

══════════════════════════════════════════════════════════════════════════════════
CORE PRINCIPLE: WHAT IS REAL MOTION GRAPHICS?
══════════════════════════════════════════════════════════════════════════════════
Real motion graphics is NOT just subtitle text. It is VISUAL STORYTELLING:
1. Deconstruct the narrative into visual metaphors, physical environment, time period, and dynamic action.
2. Build the world using layered vector geometry:
   - Mountains, oceans, and landscapes GROW up from the bottom with multi-shaded polygons.
   - Years, dates, and historical anchors STAMP in with distressed vintage badges and kinetic lines.
   - Villages, huts, houses, and trees POP IN with spring bounce physics, roofs snapping on, chimney smoke particles drifting.
   - Data & metrics COUNT UP with animated bar charts or rolling number counters.
   - Directional arrows and focal circles POINT TO and REVEAL key narrative elements.

══════════════════════════════════════════════════════════════════════════════════
GOLD STANDARD EXAMPLE: "A village in 1970, Near the Himalaya"
══════════════════════════════════════════════════════════════════════════════════
For this script, a top-tier visual motion graphic produces:
- BEAT 1 (0.0s - 2.2s): Staggered Himalayan Mountain Peaks (<polygon>) rise up from the bottom (scaleY from 0 to 1 with elastic overshoot). Slate navy shadow slope + ice blue lit slope + white snowcaps.
- BEAT 2 (2.0s - 3.8s): "1970" in bold retro typography stamps in with an amber vintage badge and kinetic horizontal ruler lines.
- BEAT 3 (3.2s - ${duration.toFixed(1)}s): Village huts assemble with spring physics (wooden base boxes scale up, red/amber triangle roofs snap on top, pine trees pop up, chimney smoke wisps float upwards).

══════════════════════════════════════════════════════════════════════════════════
HOW TO CODE VECTOR SHAPES & ANIMATIONS IN "htmlCssScenes"
══════════════════════════════════════════════════════════════════════════════════
In "htmlCssScenes", provide self-contained HTML/CSS/SVG with CSS @keyframes.
Rules:
1. Wrap everything in a full-screen container with transparent background:
   <div style="position:relative; width:1920px; height:1080px; overflow:hidden; background:transparent;">
2. Use SVG <polygon>, <path>, <rect>, <circle> for crisp vector artwork with dimensional shading:
   - Mountains: <polygon points="400,1080 800,280 1200,1080" fill="#334155" />
   - Shadow slope: <polygon points="800,280 1000,700 800,1080 400,1080" fill="#1e293b" />
   - Snow cap: <polygon points="700,500 800,280 900,500 800,450" fill="#ffffff" />
   - Village huts: <rect x="850" y="820" width="120" height="90" fill="#78350f" rx="4" />
   - Roof: <polygon points="830,820 910,740 990,820" fill="#b45309" />
3. Use spring bounce & cubic-bezier easing keyframes:
   @keyframes growUp {
     0% { transform: scaleY(0); transform-origin: bottom; opacity: 0; }
     70% { transform: scaleY(1.05); transform-origin: bottom; opacity: 1; }
     100% { transform: scaleY(1); transform-origin: bottom; opacity: 1; }
   }
   @keyframes popSpring {
     0% { transform: scale(0); opacity: 0; }
     70% { transform: scale(1.12); opacity: 1; }
     100% { transform: scale(1); opacity: 1; }
   }
   @keyframes floatSmoke {
     0% { transform: translateY(0) scale(0.6); opacity: 0.8; }
     100% { transform: translateY(-80px) scale(1.4); opacity: 0; }
   }

══════════════════════════════════════════════════════════════════════════════════
AVAILABLE CANVAS 2D COMPONENTS (CAN BE COMBINED WITH HTML SCENES):
══════════════════════════════════════════════════════════════════════════════════
1. "KineticWord": { "text": string, "fontSize": 64-90, "color": "#ffe600", "animation": "spring"|"bounce"|"elastic"|"zoom"|"scaleFlip"|"glitch"|"slideUp", "position": { "x": 960, "y": 540 } }
2. "VoiceSyncHighlight": { "words": [{ "text": string, "start": number, "end": number }], "highlightColor": "#fbbf24", "textColor": "#fff", "fontSize": 48, "position": { "x": 960, "y": 840 } }
3. "MotionArrow": { "from": { "x": 400, "y": 600 }, "to": { "x": 900, "y": 400 }, "curve": -40, "color": "#38bdf8", "thickness": 6, "drawDuration": 0.6 }
4. "AnimatedBarChart": { "bars": [{ "label": "1970", "value": 45 }, { "label": "2024", "value": 180 }], "title": "Population Growth", "position": { "x": 960, "y": 500 }, "width": 600, "height": 360 }
5. "AnimatedLineGraph": { "points": [{ "x": 100, "y": 400 }, { "x": 500, "y": 200 }], "color": "#22c55e", "showDots": true, "showArea": true, "position": { "x": 960, "y": 500 } }
6. "AnimatedCounter": { "from": 0, "to": 1970, "prefix": "", "suffix": "", "fontSize": 84, "color": "#fbbf24", "position": { "x": 960, "y": 400 } }
7. "LowerThird": { "title": "Himalayan Foothills", "subtitle": "Circa 1970", "style": "modern", "position": { "x": 240, "y": 880 } }
8. "ParticleBurst": { "count": 28, "colors": ["#fbbf24", "#38bdf8", "#ffffff"], "maxRadius": 200, "position": { "x": 960, "y": 540 } }
9. "CircleHighlight": { "radius": 80, "color": "#f43f5e", "strokeWidth": 4, "pulseCount": 2, "position": { "x": 960, "y": 540 } }

══════════════════════════════════════════════════════════════════════════════════
OUTPUT FORMAT SPECIFICATION
══════════════════════════════════════════════════════════════════════════════════
Respond with ONLY a single valid JSON object (no markdown code blocks, no backticks, no comments):
{
  "transcribedText": string,
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
}`;
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

