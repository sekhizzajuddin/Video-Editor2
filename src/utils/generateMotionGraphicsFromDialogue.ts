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
  let inlineAudioBase64: string | null = null;
  let inlineAudioMime: string | null = null;

  if (clipMediaUrl) {
    onProgress('Extracting video frames and audio', 10);
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
        (pct) => onProgress('Extracting video frames', Math.round(10 + pct * 5)),
        1
      );

      // Attempt to extract the blob directly as base64 for Gemini Audio Processing (if size is reasonable)
      if (provider === 'gemini') {
        onProgress('Preparing audio for Gemini', 18);
        try {
          const res = await fetch(clipMediaUrl);
          const blob = await res.blob();
          if (blob.size < 15 * 1024 * 1024) { // Max 15MB inline payload
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
    if (inlineAudioBase64 && inlineAudioMime) {
      parts.push({
        inlineData: {
          mimeType: inlineAudioMime,
          data: inlineAudioBase64,
        },
      });
      parts.push({ text: "Please transcribe the audio from the provided media file and use it as the dialogue for the motion graphics. Then output the JSON as instructed." });
    }
    
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
      const accountId = state.settings?.cloudflareAccountId || (import.meta as any).env?.VITE_CLOUDFLARE_ACCOUNT_ID;
      const apiToken = state.settings?.cloudflareApiToken || (import.meta as any).env?.VITE_CLOUDFLARE_API_TOKEN;

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

function buildAiMotionPrompt(
  dialogueText: string,
  duration: number,
  options: GenerativeMotionOptions,
  hasStoryboardImages: boolean
): string {
  return `You are an elite Motion Graphics & Visual Storytelling Director (like Vox, Kurzgesagt, Polymatter).
Your task is to transform dialogue/scripts into REAL VISUAL MOTION GRAPHICS with geometric vector shapes, progressive world construction, and kinetic typography.

TOTAL DURATION: ${duration.toFixed(1)} seconds
RESOLUTION: 1920x1080 (30 FPS)
STYLE: "${options.style}"
LAYOUT: "${options.layout}"
${options.customPrompt ? `USER INSTRUCTIONS: "${options.customPrompt}"` : ''}
${dialogueText ? `DIALOGUE / SCRIPT: "${dialogueText}"` : ''}
${hasStoryboardImages ? 'NOTE: Scene video frames provided to align motion graphics.' : ''}

══════════════════════════════════════════════════════════════════════════════════
CORE PRINCIPLE: WHAT IS REAL MOTION GRAPHICS?
══════════════════════════════════════════════════════════════════════════════════
Real motion graphics is NOT just subtitle text. It is VISUAL STORYTELLING:
1. Build the world using layered vector geometry.
   - Mountains, oceans, and landscapes GROW up from the bottom with multi-shaded polygons.
   - Years, dates, and historical anchors STAMP in with distressed vintage badges and kinetic lines.
   - Villages, huts, houses POP IN with spring bounce physics, roofs snapping on, chimney smoke.
2. DO NOT BE LAZY. Generate detailed, full-fledged visual scenes. Use dozens of SVG <polygon>, <path>, <rect>, <circle> for crisp vector artwork with dimensional shading.
3. Synchronize the animation timing with the dialogue and duration. Use complex, staggered CSS keyframe animations (spring bounce, cubic-bezier easing) to animate every single element entering the screen sequentially.

══════════════════════════════════════════════════════════════════════════════════
HOW TO CODE VECTOR SHAPES & ANIMATIONS IN "htmlCssScenes"
══════════════════════════════════════════════════════════════════════════════════
In "htmlCssScenes", provide self-contained HTML/CSS/SVG with CSS @keyframes.
Rules:
1. Wrap everything in a full-screen container:
   <div style="position:relative; width:1920px; height:1080px; overflow:hidden; background:transparent;">
2. ABSOLUTELY NO EXTERNAL ASSETS (CRITICAL SECURITY RULE):
   - NEVER use <img src="http...">
   - NEVER use <link rel="stylesheet">
   - NEVER use @import for fonts.
   - External assets will taint the canvas and crash the rendering engine. Use ONLY standard web-safe fonts (Arial, Impact, Courier New, Helvetica, sans-serif).
3. Use SVG <polygon>, <path>, <rect>, <circle> for crisp vector artwork, BUT YOU MUST WRAP THEM IN AN <svg> TAG!
   - Examples MUST be inside an svg:
   <svg width="1920" height="1080" viewBox="0 0 1920 1080" style="position:absolute; top:0; left:0;">
     <polygon points="400,1080 800,280 1200,1080" fill="#334155" />
     <rect x="850" y="820" width="120" height="90" fill="#78350f" rx="4" />
   </svg>
4. Use spring bounce & cubic-bezier easing keyframes:
   @keyframes growUp { 0% { transform: scaleY(0); transform-origin: bottom; opacity: 0; } 100% { transform: scaleY(1); transform-origin: bottom; opacity: 1; } }
   @keyframes popSpring { 0% { transform: scale(0); } 70% { transform: scale(1.12); } 100% { transform: scale(1); } }

══════════════════════════════════════════════════════════════════════════════════
AVAILABLE CANVAS 2D COMPONENTS (CAN BE COMBINED WITH HTML SCENES):
══════════════════════════════════════════════════════════════════════════════════
1. "KineticWord": { "text": string, "fontSize": 64-90, "color": "#ffe600", "animation": "spring"|"bounce", "position": { "x": 960, "y": 540 } }
2. "VoiceSyncHighlight": { "words": [{ "text": string, "start": number, "end": number }], "highlightColor": "#fbbf24" }
3. "MotionArrow": { "from": { "x": 400, "y": 600 }, "to": { "x": 900, "y": 400 } }
4. "AnimatedBarChart": { "bars": [{ "label": "1970", "value": 45 }, { "label": "2024", "value": 180 }] }
5. "AnimatedCounter": { "from": 0, "to": 1970, "position": { "x": 960, "y": 400 } }
6. "VectorShape": { "animation": "popSpring"|"growUp", "startTime": 0.5, "shapes": [ { "type": "polygon", "points": "400,1080 800,280 1200,1080", "fill": "#334155", "delay": 0.2 }, { "type": "rect", "x": 850, "y": 820, "width": 120, "height": 90, "fill": "#78350f" } ] }

OUTPUT FORMAT SPECIFICATION
Respond with ONLY a single valid JSON object (no markdown code blocks, no backticks, no comments):
{
  "transcribedText": string,
  "width": 1920,
  "height": 1080,
  "fps": 30,
  "duration": ${duration.toFixed(1)},
  "canvasElements": [
    {
      "component": "KineticWord" | "VoiceSyncHighlight" | "MotionArrow" | "AnimatedBarChart" | "AnimatedLineGraph" | "AnimatedCounter" | "LowerThird" | "TitleCard" | "ParticleBurst" | "CircleHighlight" | "VectorShape",
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

