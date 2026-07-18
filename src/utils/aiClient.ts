import { fetchWithKeyFailover, getLocalGeminiKey, getEnvGeminiKey } from './apiKeyManager';

export function getGeminiKey(): string {
  return getEnvGeminiKey() || getLocalGeminiKey();
}

export function getGroqKey(): string {
  return '';
}

// ─── Model constants ─────────────────────────────────────────────────────────
const GEMINI_VISION_MODEL = 'gemini-3.1-flash-lite';          // current stable GA model, good free tier
const GROQ_VISION_MODEL   = 'meta-llama/llama-4-scout-17b-16e-instruct'; // Valid Groq vision model
const GROQ_TEXT_MODEL     = 'openai/gpt-oss-20b';        // Best Groq reasoning / text model

/** Safely strip a data-URI prefix (e.g. "data:image/jpeg;base64,") from a base64 string. */
function stripDataUri(b64: string): string {
  const idx = b64.indexOf(',');
  return idx !== -1 ? b64.slice(idx + 1) : b64;
}

/** Build an AbortController whose timeout scales with fps and clip duration. */
function makeController(fps: number, durationSeconds: number): { controller: AbortController; clear: () => void } {
  const controller = new AbortController();
  const ms = Math.min(90_000, 30_000 + fps * durationSeconds * 800); // up to 90 s
  const id = setTimeout(() => controller.abort(), ms);
  return { controller, clear: () => clearTimeout(id) };
}

export interface AICueResult {
  start: number;
  end: number;
  query: string;
  type: 'sfx' | 'bgm';
  reason: string;
  alternatives?: string[];
  scene?: string;
}

/**
 * Analyzes a storyboard grid image with Gemini Flash Vision OR Groq LLaMA-4 Scout Vision.
 * Returns AI-generated audio cues with precise timestamps.
 */
export async function analyzeStoryboardWithGemini(
  base64ImageRaw: string,
  segmentDuration: number,
  provider: 'gemini' | 'groq' = 'gemini',
  fps: number = 1
): Promise<AICueResult[]> {
  const base64Image = stripDataUri(base64ImageRaw);
  const timePerFrame = 1 / fps;
  const totalFrames = Math.round(segmentDuration * fps);

  // Shared vision prompt — used by both Gemini and Groq
  const visionPrompt = `You are a Hollywood-level Sound Supervisor and Music Supervisor creating a full audio brief for a ${segmentDuration.toFixed(1)}-second video clip.

STORYBOARD: Chronological grid of ${totalFrames} frames. Frames go LEFT→RIGHT then TOP→BOTTOM. Each frame = ${timePerFrame.toFixed(3)} seconds. Yellow timestamps in corners show exact timing.

═══════════════════════════════════
YOUR JOB: Generate a COMPLETE audio design with BOTH BGM and SFX.
═══════════════════════════════════

MANDATORY RULES:
1. You MUST include at least 1 BGM cue that covers the majority of the clip (e.g., start=0, end=${segmentDuration.toFixed(1)}).
2. You MUST include SFX for every visible physical action (footsteps, impacts, doors, vehicles, crowds, water, fire, etc.).
3. You MUST add ambient atmosphere SFX if the scene has an identifiable environment (city, nature, room, street).
4. If the clip is longer than 5 seconds, include at least 3 cues total.
5. ALL timestamps must be between 0.0 and ${segmentDuration.toFixed(2)}.

BGM SEARCH QUERY RULES (for music):
- Use ONLY 1 or 2 generic genre/mood tags. Freesound will return 0 results if you use full sentences or too many words.
- Good examples: "cinematic", "ambient chill", "orchestral", "lofi", "upbeat funk"
- BAD examples: "dramatic background music for city", "epic orchestral tense"

SFX SEARCH QUERY RULES (for effects):
- Use ONLY 1 or 2 generic nouns for the physical sound.
- Good examples: "rain", "crowd", "door", "car engine", "footsteps"
- BAD examples: "heavy rain thunder storm urban", "loud door slam wooden"

SCENE ANALYSIS APPROACH:
1. What is the overall emotional tone? (tense, joyful, dramatic, calm, mysterious) → use for BGM
2. What environment is it? (urban, nature, indoor, outdoor, studio) → use for ambient SFX
3. What physical actions are visible? → use for specific SFX
4. Are there any cuts, transitions or emotional peaks that need a sting/impact?

Return ONLY this exact JSON (no markdown, no explanation):
{
  "cues": [
    {
      "start": <number 0–${segmentDuration.toFixed(2)}>,
      "end": <number 0–${segmentDuration.toFixed(2)}>,
      "query": "<Freesound.org search keywords>",
      "type": "sfx" | "bgm",
      "reason": "<one sentence: exactly what you saw and why this sound fits>"
    }
  ]
}`;

  // Groq-specific stronger system prompt
  const groqSystemPrompt = `You are a world-class Hollywood Sound Supervisor and Music Supervisor with 20+ years experience.
You analyze video storyboards and produce a COMPLETE audio brief including BOTH background music (BGM) and sound effects (SFX).

CRITICAL OUTPUT RULES:
- Return ONLY valid JSON in the exact format requested. No markdown. No explanation. No commentary.
- ALWAYS include at least 1 BGM cue with music genre keywords (e.g. "cinematic orchestral epic tension", "dark ambient electronic drone", "upbeat funk groove")
- ALWAYS include SFX for any visible actions, environments, or transitions
- BGM queries must be music-specific: include genre words like orchestral, electronic, hip-hop, ambient, jazz, rock, cinematic, lo-fi
- SFX queries must be action-specific: footsteps wood, rain heavy, crowd cheer, explosion debris, etc.
- If you return an empty cues array or omit BGM, you have FAILED your job`;

  const requestHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
  let requestBody: any = {};

  if (provider === 'gemini') {
    requestBody = {
      contents: [
        {
          parts: [
            { text: visionPrompt },
            { inlineData: { mimeType: 'image/jpeg', data: base64Image } }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.5,
        maxOutputTokens: 3000
      }
    };
  } else {
    requestBody = {
      model: GROQ_VISION_MODEL,
      messages: [
        {
          role: 'system',
          content: groqSystemPrompt
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: visionPrompt },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
          ]
        }
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'cues_schema',
          strict: false,
          schema: {
            type: 'object',
            properties: {
              cues: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    start: { type: 'number' },
                    end: { type: 'number' },
                    query: { type: 'string' },
                    type: { type: 'string' },
                    reason: { type: 'string' }
                  },
                  required: ['start', 'end', 'query', 'type', 'reason']
                }
              }
            },
            required: ['cues']
          }
        }
      },
      temperature: 0.4,
      max_tokens: 3000
    };
  }

  const { controller, clear } = makeController(fps, segmentDuration);

  let response;
  try {
    response = await fetchWithKeyFailover(
      (key) => {
        if (provider === 'groq') {
          requestHeaders['Authorization'] = `Bearer ${key}`;
          return 'https://api.groq.com/openai/v1/chat/completions';
        }
        return `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_VISION_MODEL}:generateContent?key=${key}`;
      },
      {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify(requestBody),
        signal: controller.signal
      },
      provider
    );
  } finally {
    clear();
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`[${provider.toUpperCase()} Vision] HTTP ${response.status}: ${errorText}`);
  }

  const resultData = await response.json();
  let text = '';
  if (provider === 'gemini') {
    text = resultData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } else {
    text = resultData?.choices?.[0]?.message?.content || '';
  }

  if (!text) {
    throw new Error(`${provider.toUpperCase()} Vision returned an empty response. The image may be too large or content was blocked.`);
  }

  try {
    const clean = text.replace(/^```(json)?/m, '').replace(/```$/m, '').trim();
    const parsed = JSON.parse(clean);
    const cues = Array.isArray(parsed) ? parsed : (parsed.cues ?? []);
    if (!Array.isArray(cues)) throw new Error('Response cues is not an array');

    // Ensure at least one BGM exists — inject a default if AI forgot
    const hasBgm = cues.some((c: any) => c.type === 'bgm');
    if (!hasBgm && segmentDuration > 3) {
      cues.unshift({
        start: 0,
        end: segmentDuration,
        query: 'cinematic ambient background atmospheric',
        type: 'bgm',
        reason: 'Background music layer auto-added to fill the full clip duration.'
      });
    }

    return cues as AICueResult[];
  } catch (e) {
    throw new Error(`Failed to parse ${provider.toUpperCase()} storyboard response as JSON. Raw: ${text.slice(0, 300)}`);
  }
}

export interface AudioQueryRefinement {
  keywords: string;
  alternatives: string[];
}

/**
 * Refines a raw scene description into optimized Freesound.org search keywords using Groq LLaMA 3.3.
 */
export async function refineAudioQueryWithGroq(query: string, type: 'sfx' | 'bgm' = 'sfx'): Promise<AudioQueryRefinement> {
  const payload = {
    model: GROQ_TEXT_MODEL,
    messages: [
      {
        role: 'system',
        content: `You are an expert audio library search optimizer for Freesound.org.
Your ONLY job is to convert a sound description into a primary query (1-3 words) and 3 alternative queries.

CRITICAL RULES FOR FREESOUND:
1. Freesound uses exact text matching. Using long specific phrases will return ZERO results.
2. You MUST use 1 to 3 broad, generic nouns/tags max per query (e.g., "city night", "rain").
3. NEVER use full sentences or highly descriptive adjectives.

${type === 'bgm' ? `MUSIC (BGM) KEYWORDS:
- Use 1 broad genre and optionally 1 mood (e.g. "orchestral dark", "ambient chill", "lofi").
- Must be musical instruments, melody, rhythm. NEVER ambient noise.` : `SFX KEYWORDS:
- Use 1 or 2 generic nouns for the physical sound.`}

Return ONLY valid JSON (no markdown):
{
  "keywords": "primary 1-3 words",
  "alternatives": ["alt1", "alt2", "alt3"]
}`
      },
      {
        role: 'user',
        content: `Convert this ${type === 'bgm' ? 'music/BGM' : 'sound effect/SFX'} description to Freesound.org search keywords:\n"${query}"`
      }
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'refinement_schema',
        strict: false,
        schema: {
          type: 'object',
          properties: {
            keywords: { type: 'string' },
            alternatives: { type: 'array', items: { type: 'string' } }
          },
          required: ['keywords', 'alternatives']
        }
      }
    },
    temperature: 0.1,
    max_tokens: 150
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  let response;
  try {
    response = await fetchWithKeyFailover(
      (key) => 'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      },
      'groq'
    );
  } finally {
    clearTimeout(timeoutId);
  }

  const fallback = { keywords: query, alternatives: [] };

  if (!response.ok) {
    console.warn(`[Groq Query Refine] HTTP ${response.status}. Using original query as fallback.`);
    return fallback;
  }

  const resultData = await response.json();
  const refined = resultData?.choices?.[0]?.message?.content?.trim();
  if (!refined) return fallback;

  try {
    const clean = refined.replace(/^```(json)?/m, '').replace(/```$/m, '').trim();
    const parsed = JSON.parse(clean);
    return {
      keywords: parsed.keywords || query,
      alternatives: parsed.alternatives || []
    };
  } catch (e) {
    return fallback;
  }
}

/**
 * DOUBLE AUTOMATION:
 * Sends an array of base64 audio mp3s to Gemini 1.5/3.1 Flash along with the video scene context.
 * Asks Gemini to listen to them and pick the most realistic one, and identify the exact trimOffset.
 */
export async function analyzeAudioWithGemini(
  base64Audios: string[],
  sceneContext: string,
  cueType: 'sfx' | 'bgm'
): Promise<{ selectedIndex: number; trimOffset: number; reason: string }> {
  const prompt = `You are a professional Sound Editor (Double Automation).
I have provided ${base64Audios.length} alternate audio clips for a video scene.
SCENE CONTEXT: "${sceneContext}" (Audio type needed: ${cueType.toUpperCase()})

Listen to all provided audio clips.
YOUR JOB:
1. Pick the ONE audio clip that sounds the most realistic and best fits the scene context.
2. Identify the exact timestamp (in seconds) where the primary action/music actually begins (skipping any dead air or silence at the start).

Return ONLY valid JSON (no markdown):
{
  "selectedIndex": <number 0 to ${base64Audios.length - 1}>,
  "trimOffset": <number in seconds (e.g. 0.5, 2.1)>,
  "reason": "<short explanation why this clip is best>"
}`;

  const audioParts = base64Audios.map((b64) => ({
    inlineData: { mimeType: 'audio/mp3', data: stripDataUri(b64) }
  }));

  const payload = {
    contents: [
      {
        parts: [
          { text: prompt },
          ...audioParts
        ]
      }
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1,
    }
  };

  const response = await fetchWithKeyFailover(
    (key) => `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_VISION_MODEL}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    },
    'gemini'
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`[Gemini Audio Analysis] HTTP ${response.status}: ${errorText}`);
  }

  const resultData = await response.json();
  const text = resultData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  if (!text) throw new Error('Empty response from Gemini Audio Analysis');

  const clean = text.replace(/^```(json)?/m, '').replace(/```$/m, '').trim();
  return JSON.parse(clean);
}

export interface AIMotionGraphicSuggestion {
  templateId: string;
  start: number;
  end: number;
  suggestedText: string;
  reason: string;
}

/**
 * Analyzes a storyboard grid image to suggest motion graphics overlays.
 * Supports both Gemini and Groq LLaMA-4 Scout vision providers.
 */
export async function analyzeMotionGraphicsWithGemini(
  base64ImageRaw: string,
  segmentDuration: number,
  provider: 'gemini' | 'groq' = 'gemini'
): Promise<AIMotionGraphicSuggestion[]> {
  const base64Image = stripDataUri(base64ImageRaw);

  const prompt = `You are a world-class professional video editor and motion graphics director.

CONTEXT: This is a chronological storyboard grid from a ${segmentDuration.toFixed(1)}-second video segment.
Frames go LEFT-TO-RIGHT then TOP-TO-BOTTOM. Use the yellow timestamps in each corner to identify timing.

YOUR MISSION: Suggest 2\u20134 perfectly timed motion graphics overlays to dramatically improve this video's production value.

AVAILABLE TEMPLATES (use ONLY these exact IDs):
- "kinetic_typewriter": Typewriter effect. Best for: narrative captions, subtitles, date/location cards.
- "kinetic_bounce": Bold bounce-in title. Best for: energetic announcements, action moments, product reveals.
- "lower_third_classic": Professional lower-third bar. Best for: introducing a person (name + role), location labels.
- "cinematic_title": Elegant slow-reveal title. Best for: scenic beauty shots, documentary intros, travel establishing shots.
- "subtitle_bar": Clean subtitle bar. Best for: translations, spoken dialogue subtitles, informational text.
- "kinetic_pop": Quick pop-art effect. Best for: humorous moments, viral-style emphasis.
- "subscribe_bell": Animated subscribe call-to-action. Best for: end screens, engagement moments.

RULES:
1. Timestamps must be between 0 and ${segmentDuration.toFixed(2)} seconds.
2. Each overlay duration should be 2.5\u20136 seconds.
3. suggestedText MUST be specific to the actual video content (real person's name, city, product, quote) \u2014 NOT generic placeholders like "Title Here".
4. Vary your template choices \u2014 do NOT suggest the same templateId twice.
5. Only suggest overlays that genuinely match the scene.

Return ONLY this JSON format, no markdown:
{
  "suggestions": [
    {
      "templateId": "<exact ID from list above>",
      "start": <number>,
      "end": <number>,
      "suggestedText": "<specific text for overlay>",
      "reason": "<one sentence: what you saw and why this template fits>"
    }
  ]
}`;

  const requestHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
  let requestBody: any = {};

  if (provider === 'gemini') {
    requestBody = {
      contents: [
        {
          parts: [
            { text: prompt },
            { inlineData: { mimeType: 'image/jpeg', data: base64Image } }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.5,
        maxOutputTokens: 1024
      }
    };
  } else {
    requestBody = {
      model: GROQ_VISION_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are a professional motion graphics director. Analyze video storyboards and suggest overlays as strict JSON only. No markdown, no commentary.'
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
          ]
        }
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'suggestions_schema',
          strict: false,
          schema: {
            type: 'object',
            properties: {
              suggestions: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    templateId: { type: 'string' },
                    start: { type: 'number' },
                    end: { type: 'number' },
                    suggestedText: { type: 'string' },
                    reason: { type: 'string' }
                  },
                  required: ['templateId', 'start', 'end', 'suggestedText', 'reason']
                }
              }
            },
            required: ['suggestions']
          }
        }
      },
      temperature: 0.4,
      max_tokens: 1024
    };
  }

  const { controller, clear } = makeController(1, segmentDuration);

  let response;
  try {
    response = await fetchWithKeyFailover(
      (key) => {
        if (provider === 'groq') {
          requestHeaders['Authorization'] = `Bearer ${key}`;
          return 'https://api.groq.com/openai/v1/chat/completions';
        }
        return `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_VISION_MODEL}:generateContent?key=${key}`;
      },
      {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify(requestBody),
        signal: controller.signal
      },
      provider
    );
  } finally {
    clear();
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`[${provider.toUpperCase()} Motion Graphics] HTTP ${response.status}: ${errorText}`);
  }

  const resultData = await response.json();
  let text = '';
  if (provider === 'gemini') {
    text = resultData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } else {
    text = resultData?.choices?.[0]?.message?.content || '';
  }

  if (!text) {
    throw new Error(`${provider.toUpperCase()} returned an empty motion graphics response.`);
  }

  const validIds = new Set(['kinetic_typewriter', 'kinetic_bounce', 'lower_third_classic', 'cinematic_title', 'subtitle_bar', 'kinetic_pop', 'subscribe_bell']);

  try {
    const clean = text.replace(/^```(json)?/m, '').replace(/```$/m, '').trim();
    const parsed = JSON.parse(clean);
    const suggestions = Array.isArray(parsed) ? parsed : (parsed.suggestions ?? []);
    if (!Array.isArray(suggestions)) throw new Error('suggestions is not an array');
    // Filter out any invalid templateIds the model may have hallucinated
    return suggestions.filter((s: any) => validIds.has(s.templateId)) as AIMotionGraphicSuggestion[];
  } catch (e) {
    throw new Error(`Failed to parse ${provider.toUpperCase()} motion graphics response. Raw: ${text.slice(0, 300)}`);
  }
}

/**
 * Analyzes extracted video frames with Gemini to suggest motion graphic overlays.
 * Uses fetchWithKeyFailover for robust API key management.
 */
export async function analyzeSceneForMotionGraphics(
  frames: string[],
  userPrompt: string
): Promise<AIMotionGraphicSuggestion[]> {
  const prompt = `You are a professional video editor and motion graphics designer.
Analyze these chronological video frames (extracted from a clip).
${userPrompt}

For each suggested motion graphic or lower-third overlay, determine:
1. Relative start time (seconds from clip start)
2. Relative end time (seconds from clip start, typically 3-5 seconds)
3. Suggested text / titles to display (be specific to actual content — real names, places, quotes)
4. Reason/justification based on what you actually see in the frames

Return ONLY a valid JSON array, no markdown:
[
  { "templateId": "lower_third_classic", "start": <number>, "end": <number>, "suggestedText": "<text>", "reason": "<reason>" }
]`;

  const inlineDataParts = frames.map((f) => ({
    inlineData: {
      mimeType: 'image/jpeg',
      data: stripDataUri(f),
    },
  }));

  const payload = {
    contents: [
      {
        parts: [
          { text: prompt },
          ...inlineDataParts,
        ],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.4,
      maxOutputTokens: 1024
    },
  };

  const { controller, clear } = makeController(1, 30);

  let response;
  try {
    response = await fetchWithKeyFailover(
      (key) => `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_VISION_MODEL}:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      },
      'gemini'
    );
  } finally {
    clear();
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`[Gemini Scene Analysis] HTTP ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  try {
    const cleanedText = text.replace(/^```(json)?/m, '').replace(/```$/m, '').trim();
    return JSON.parse(cleanedText) as AIMotionGraphicSuggestion[];
  } catch (e) {
    throw new Error(`Failed to parse Gemini scene analysis response: ${text.slice(0, 300)}`);
  }
}

import { ChunkAnalysisResult } from './canvasCapture';

/**
 * Analyzes a chunk of canvas frames and metadata for SFX generation.
 * Specifically generates descriptive prompts for HuggingFace AudioLDM.
 */
export async function analyzeCanvasChunkWithGemini(
  chunk: ChunkAnalysisResult,
  chunkDuration: number,
  provider: 'gemini' | 'groq' = 'gemini'
): Promise<AICueResult[]> {
  const apiKey = provider === 'gemini' ? getGeminiKey() : getGroqKey();
  if (!apiKey) {
    throw new Error(`${provider.toUpperCase()} API key is required. Please set it in Settings.`);
  }

  // We are creating a prompt for HuggingFace (AudioLDM).
  const systemPrompt = `You are an expert Foley Artist and Sound Designer.
Your job is to analyze ${chunk.frames.length} frames (representing a ${chunkDuration}s chunk at 5fps) along with timeline metadata, and generate precise Sound Effects (SFX).

RULES:
1. Generate SFX for visual actions, transitions, text appearance, and environments.
2. DO NOT GENERATE BGM (Background Music). ONLY SFX.
3. Keep the "query" extremely concise, clear, and under 45 characters. 
   - Formula: [Descriptor] + [Object/Material] + [Action/Sound-Type].
   - DO NOT use filler words like "a", "the", "sound of", "effect of", "textures".
   - Good: "heavy metallic door slamming"
   - Good: "futuristic digital glitch static"
   - Good: "soft cinematic whoosh"
4. Timestamps must be relative to the chunk (0 to ${chunkDuration}).
5. Only return the JSON. No markdown wrappers, no explanations.

METADATA (Timeline Events):
${chunk.metadata.map(m => `[${(m.time - chunk.metadata[0]?.time || 0).toFixed(2)}s] ${m.description}`).join('\n')}

Output format MUST exactly match this JSON schema:
{
  "cues": [
    {
      "start": <number>,
      "end": <number>,
      "query": "<descriptive prompt for text-to-audio model>",
      "type": "sfx",
      "scene": "<one sentence describing exactly what visual action or event is happening in the video at this time>",
      "reason": "<why this sound fits this scene>"
    }
  ]
}`;

  let requestBody: any = {};
  const requestHeaders: Record<string, string> = { 'Content-Type': 'application/json' };

  if (provider === 'gemini') {
    const frameParts = chunk.frames.map(frame => ({
      inlineData: {
        mimeType: 'image/jpeg',
        data: stripDataUri(frame)
      }
    }));
    requestBody = {
      contents: [
        {
          parts: [
            { text: systemPrompt },
            ...frameParts
          ]
        }
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.4,
        maxOutputTokens: 3000
      }
    };
  } else {
    // Groq LLaMA Scout Vision format
    const imageUrls = chunk.frames.map(frame => ({
      type: 'image_url',
      image_url: { url: `data:image/jpeg;base64,${stripDataUri(frame)}` }
    }));
    requestBody = {
      model: GROQ_VISION_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are an expert Foley Artist and Sound Designer. You return only valid JSON.'
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: systemPrompt },
            ...imageUrls
          ]
        }
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'canvas_cues_schema',
          strict: false,
          schema: {
            type: 'object',
            properties: {
              cues: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    start: { type: 'number' },
                    end: { type: 'number' },
                    query: { type: 'string' },
                    type: { type: 'string' },
                    scene: { type: 'string' },
                    reason: { type: 'string' }
                  },
                  required: ['start', 'end', 'query', 'type', 'scene', 'reason']
                }
              }
            },
            required: ['cues']
          }
        }
      },
      temperature: 0.4,
      max_tokens: 3000
    };
  }

  const response = await fetchWithKeyFailover(
    (key) => {
      if (provider === 'groq') {
        requestHeaders['Authorization'] = `Bearer ${key}`;
        return 'https://api.groq.com/openai/v1/chat/completions';
      }
      return `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_VISION_MODEL}:generateContent?key=${key}`;
    },
    {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify(requestBody)
    },
    provider
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`[${provider.toUpperCase()} API Error] ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  let text = '';
  if (provider === 'gemini') {
    text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } else {
    text = data.choices?.[0]?.message?.content || '';
  }

  try {
    const cleanedText = text.replace(/^```(json)?/m, '').replace(/```$/m, '').trim();
    const result = JSON.parse(cleanedText);
    return result.cues || [];
  } catch (e) {
    throw new Error(`Failed to parse ${provider.toUpperCase()} response: ${text.substring(0, 200)}`);
  }
}

export async function enhancePromptWithGemini(prompt: string, apiKey: string): Promise<string> {
  const systemPrompt = "You are an expert AI Video and Image prompt engineer. Enhance the following basic prompt into a highly detailed, cinematic, and professional prompt suitable for advanced AI video generators like Sora, Kling, or Midjourney. Focus on lighting, camera angles, atmosphere, and visual fidelity. Return ONLY the enhanced prompt string without any conversational filler or quotes.";
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: `${systemPrompt}\n\nUser Prompt: ${prompt}` }] }]
    })
  });
  if (!response.ok) throw new Error("Failed to enhance prompt");
  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}
