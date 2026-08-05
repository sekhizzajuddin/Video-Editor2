import { fetchWithKeyFailover, getLocalGeminiKey, getEnvGeminiKey } from './apiKeyManager';

export function getGeminiKey(): string {
  return getEnvGeminiKey() || getLocalGeminiKey();
}

export function getGroqKey(): string {
  return '';
}

// ─── Model constants ─────────────────────────────────────────────────────────
const GEMINI_VISION_MODEL = 'gemini-3.5-flash-lite';          // current stable GA model, good free tier
const GROQ_VISION_MODEL   = 'meta-llama/llama-4-scout-17b-16e-instruct'; // Valid Groq vision model
const GROQ_TEXT_MODEL     = 'llama3-8b-8192';        // Best Groq reasoning / text model

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
      const providerName = provider === 'gemini' ? 'Gemini' : 'Groq';
      throw new Error(`${providerName} API error: ${response.status} - ${errorText}`);
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
      // Extract the first JSON object or array from possibly wrapped markdown
      const jsonMatch = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
      const jsonCandidate = jsonMatch ? jsonMatch[0] : text;
      const clean = jsonCandidate.replace(/^```(json)?/m, '').replace(/```$/m, '').trim();
      const parsed = JSON.parse(clean);
      const cues = Array.isArray(parsed) ? parsed : (parsed.cues ?? []);
      if (!Array.isArray(cues)) throw new Error('Response cues is not an array');

    // If no cues returned and segment is long enough, inject a default BGM cue
    if (cues.length === 0 && segmentDuration > 3) {
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
export async function refineAudioQueryWithGroq(query: string, type: 'sfx' | 'bgm' = 'sfx'): Promise<{ keywords: string; alternatives: string[] }> {
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
        content: `Convert this ${type === 'bgm' ? 'music/BGM' : 'sound effect/SFX'} description to Freesound.org search keywords:
"${query}"`
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

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq API error: ${response.status} - ${errorText}`);
  }

  const resultData = await response.json();
  const fallbackResult = { keywords: query, alternatives: [] as string[] };

  const refined = resultData?.choices?.[0]?.message?.content?.trim();
  if (!refined) return fallbackResult;


  if (refined.startsWith('{') || refined.startsWith('[')) {
    try {
      const clean = refined.replace(/^```(json)?/m, '').replace(/```$/m, '').trim();
      const parsed = JSON.parse(clean);
      return {
        keywords: parsed.keywords || query,
        alternatives: Array.isArray(parsed.alternatives) ? parsed.alternatives : []
      };
    } catch {
      return fallbackResult;
    }
  }
  return { keywords: refined || query, alternatives: [] };
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
      "start": "<number>",
      "end": "<number>",
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
      const providerName = provider === 'gemini' ? 'Gemini' : 'Groq';
      throw new Error(`${providerName} API error: ${response.status} - ${errorText}`);
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
  { "templateId": "lower_third_classic", "start": "<number>", "end": "<number>", "suggestedText": "<text>", "reason": "<reason>" }
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
      "start": "<number>",
      "end": "<number>",
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
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: `${systemPrompt}\n\nUser Prompt: ${prompt}` }] }]
    })
  });
  if (!response.ok) throw new Error("Failed to enhance prompt");
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

export interface AutoVideoScene {
  dialogueIndex: number;
  narration: string;
  startTime: number;
  endTime: number;
  duration: number;
  pexelsQuery: string | null;
  pexelsAlternates: string[] | null;
  pollinationsPrompt: string | null;
  pollinationsVariants: string[] | null;
  layeredPrompts?: { prompt: string; isGreenScreen: boolean }[];
  layeredVisuals?: { url: string; isGreenScreen: boolean; trackOffset: number }[];
  visualSource: 'pexels' | 'pollinations' | 'cloudflare' | 'map';
  mapAnimation: {
    type: 'route' | 'flyTo' | 'highlight';
    waypoints: { lat: number; lng: number; label?: string }[];
    zoom: number;
    style: 'standard' | 'satellite' | 'dark' | 'vintage';
  } | null;
  visualOptions?: { url: string; thumbnail?: string; type: 'video' | 'image'; source: string; duration?: number }[];
  selectedVisualUrl?: string;
  mediaStartTime?: number;
  mediaEndTime?: number;
}

export interface AutoVideoBlueprint {
  globalBackgroundPrompt?: string;
  scenes: AutoVideoScene[];
  globalSeed: number;
  characterDescription: string;
}

/**
 * Robust JSON repair & parser helper.
 * Handles markdown fences, unquoted object keys, single quotes, trailing commas,
 * and automatically repairs truncated JSON (unclosed strings, arrays, objects).
 */
export function parseAndRepairJson<T = any>(jsonString: string): T {
  if (!jsonString || typeof jsonString !== 'string') {
    throw new Error('Empty JSON string provided');
  }

  let cleaned = jsonString.trim();

  // Strip Markdown Code Fences (```json ... ``` or ``` ... ```)
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  // Try direct parse first
  try {
    return JSON.parse(cleaned);
  } catch (_) {
    // Proceed to repair
  }

  // 1. Fix unquoted keys, e.g. layeredPrompts: or dialogueIndex: -> "layeredPrompts":
  cleaned = cleaned.replace(/([{,]\s*)([a-zA-Z0-9_$]+)\s*:/g, '$1"$2":');

  // 2. Fix trailing commas before } or ]
  cleaned = cleaned.replace(/,\s*([\]}])/g, '$1');

  // 3. Fix single-quoted strings: 'foo' -> "foo"
  cleaned = cleaned.replace(/'([^'\\]*(\\.[^'\\]*)*)'/g, '"$1"');

  // Try parse after string fixes
  try {
    return JSON.parse(cleaned);
  } catch (_) {
    // Proceed to truncation repair
  }

  // 4. Handle truncated JSON (unclosed strings, arrays, objects)
  let inString = false;
  let quoteChar = '';
  const stack: string[] = [];

  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];
    const prevChar = i > 0 ? cleaned[i - 1] : '';

    if ((char === '"' || char === "'") && prevChar !== '\\') {
      if (!inString) {
        inString = true;
        quoteChar = char;
      } else if (char === quoteChar) {
        inString = false;
      }
    } else if (!inString) {
      if (char === '{' || char === '[') {
        stack.push(char === '{' ? '}' : ']');
      } else if (char === '}' || char === ']') {
        if (stack.length > 0 && stack[stack.length - 1] === char) {
          stack.pop();
        }
      }
    }
  }

  if (inString) {
    cleaned += '"';
  }

  // Strip any dangling commas or incomplete key/value at the end
  cleaned = cleaned.replace(/,\s*("[^"]*"?\s*:?\s*)?$/, '');

  // Close remaining unclosed brackets/braces in reverse order
  while (stack.length > 0) {
    cleaned += stack.pop();
  }

  // Final cleanup of trailing commas created by closing brackets
  cleaned = cleaned.replace(/,\s*([\]}])/g, '$1');

  try {
    return JSON.parse(cleaned);
  } catch (e: any) {
    console.error('[aiClient] JSON repair failed. Snippet:', jsonString.substring(0, 300));
    throw new Error(`Invalid response format from AI: ${e.message}`);
  }
}

export async function generateAutoVideoBlueprint(
  script: string, 
  wordTimestamps: { word: string; start: number; end: number }[], 
  totalDuration: number, 
  apiKey: string,
  customInstructions?: string,
  characterDescription?: string,
  visualStyle?: string
): Promise<AutoVideoBlueprint> {
  const model = "gemini-3.5-flash-lite"; 
  const wordTimestampsStr = JSON.stringify(wordTimestamps.slice(0, 100)); // Sample if too long
  const systemPrompt = `You are an expert video director, stock footage researcher, and AI image prompt engineer.
I am providing you with a script that has a total audio voiceover duration of ${totalDuration.toFixed(1)} seconds, along with word-level timestamps.
Your job is to break this script down into a sequence of consecutive video scenes to perfectly cover this duration.

RULES:
1. Divide the script into logical scenes (ideally 3 to 6 seconds each).
2. The sum of the "duration" for all scenes MUST equal exactly ${totalDuration.toFixed(1)} seconds.
3. For each scene, determine the best visualSource:
   - "map": ALWAYS use "map" if the narration explicitly mentions geographic travel, trade routes, locations, journeys, expeditions, or paths (e.g. traveling from A to B, focusing on a country/city map). NEVER use "pexels" or "cloudflare" for trade routes or map-like journeys.
   - "cloudflare": if Custom Instructions ask for a style that stock video won't have OR if it requires a very specific imaginary scene OR if it involves specific character dialogues requiring animation.
   - "pexels": for general live-action stock footage (people, nature, cities, technology).

4. For "pexels" scenes: Provide a primary 1-3 word search query and 2 alternatives.
5. For "cloudflare" scenes: Provide a highly detailed image prompt and 2 variants. (NOTE: Put these in the "pollinationsPrompt" and "pollinationsVariants" JSON fields). If the scene involves characters or elements that require animation (e.g. dialogue, character moving), ALSO provide "layeredPrompts" (up to 5 objects, all with isGreenScreen: true).
${visualStyle === 'vox_vintage' ? '6. CRITICAL FOR VOX VINTAGE STYLE: ALWAYS generate a SINGLE "globalBackgroundPrompt" (e.g. "vintage paper texture, old newspaper collage, halftone grid background") representing the overall theme. Then, for EVERY scene, use "cloudflare" and YOU MUST output the "layeredPrompts" JSON field containing an array of 1 to 5 foreground objects. These MUST be "vintage cutout illustration, halftone print style, solid #00FF00 green screen background" and have isGreenScreen set to true.' : ''}
${visualStyle === 'vox_realistic' ? '6. CRITICAL FOR VOX REALISTIC STYLE: ALWAYS generate a SINGLE "globalBackgroundPrompt" representing the overall realistic theme. Then, for EVERY scene, use "cloudflare" and YOU MUST output the "layeredPrompts" JSON field containing an array of 1 to 5 foreground characters. These MUST be realistic, highly detailed photography on a solid #00FF00 green screen background, and have isGreenScreen set to true.' : ''}
7. For "map" scenes: Provide the mapAnimation object with lat/lng waypoints.
8. ${customInstructions ? `CUSTOM INSTRUCTIONS: ${customInstructions}. You MUST strictly adhere to these instructions. Adjust visualSource and prompts accordingly.` : 'No custom instructions.'}
9. ${characterDescription ? `CHARACTER REFERENCE: The main character is described as "${characterDescription}". Use this in your image prompts.` : 'No character reference.'}

Return ONLY a valid JSON object.`;

  const payload = {
    contents: [{ role: "user", parts: [{ text: `${systemPrompt}\n\nScript: ${script}\n\nWord Timestamps (Sample): ${wordTimestampsStr}` }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          globalBackgroundPrompt: { type: "STRING" },
          scenes: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                dialogueIndex: { type: "INTEGER" },
                narration: { type: "STRING" },
                startTime: { type: "NUMBER" },
                endTime: { type: "NUMBER" },
                duration: { type: "NUMBER" },
                pexelsQuery: { type: "STRING" },
                pexelsAlternates: { type: "ARRAY", items: { type: "STRING" } },
                pollinationsPrompt: { type: "STRING" },
                pollinationsVariants: { type: "ARRAY", items: { type: "STRING" } },
                layeredPrompts: {
                  type: "ARRAY",
                  items: {
                    type: "OBJECT",
                    properties: {
                      prompt: { type: "STRING" },
                      isGreenScreen: { type: "BOOLEAN" }
                    },
                    required: ["prompt", "isGreenScreen"]
                  }
                },
                visualSource: { type: "STRING" },
                mapAnimation: {
                  type: "OBJECT",
                  properties: {
                    type: { type: "STRING" },
                    waypoints: {
                      type: "ARRAY",
                      items: {
                        type: "OBJECT",
                        properties: {
                          lat: { type: "NUMBER" },
                          lng: { type: "NUMBER" },
                          label: { type: "STRING" }
                        }
                      }
                    },
                    zoom: { type: "NUMBER" },
                    style: { type: "STRING" }
                  }
                }
              },
              required: ["dialogueIndex", "narration", "startTime", "endTime", "duration", "visualSource"]
            }
          },
          globalSeed: { type: "INTEGER" },
          characterDescription: { type: "STRING" }
        },
        required: ["scenes"]
      },
      temperature: 0.3,
      maxOutputTokens: 8192
    }
  };

  const response = await fetchWithKeyFailover(
    (key) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    },
    'gemini'
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to generate video blueprint: ${err}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';

  try {
    return parseAndRepairJson<AutoVideoBlueprint>(text);
  } catch (e: any) {
    console.error("Error parsing blueprint JSON:", text);
    throw new Error(`Invalid response from Gemini AI: ${e.message}`);
  }
}

export async function alignScriptToAudio(
  script: string, 
  wordTimestamps: { word: string; start: number; end: number }[], 
  apiKey: string
): Promise<{ text: string, words: { word: string; start: number; end: number }[] }> {
  // For now, if the user provides a script, we assume the Whisper transcription just needs punctuation from the script.
  // We can ask Gemini to apply punctuation to the transcript using the script as a reference.
  const systemPrompt = `You are a transcript editor.
I have a raw transcript with word-level timestamps (but no punctuation), and a reference script (which has correct punctuation).
Return the word timestamps array, but update the "word" field to include the correct punctuation from the reference script.

Return ONLY a JSON array, no markdown. Format:
[
  { "word": "Hello,", "start": 0.0, "end": 0.5 },
  { "word": "world.", "start": 0.6, "end": 1.0 }
]`;

  const wordTimestampsStr = JSON.stringify(wordTimestamps);
  
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: `${systemPrompt}\n\nReference Script: ${script}\n\nRaw Timestamps: ${wordTimestampsStr}` }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to align script`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '[]';
  try {
    const words = JSON.parse(text);
    const combinedText = words.map((w: any) => w.word).join(' ');
    return { text: combinedText, words };
  } catch (e) {
    return { text: script, words: wordTimestamps };
  }
}

export async function generateSourceAdaptivePrompt(
  narration: string,
  targetSource: 'pexels' | 'pollinations' | 'cloudflare' | 'map',
  apiKey: string,
  visualStyle?: string
): Promise<any> {
  const systemPrompt = `You are an expert AI content generator for video scenes.
Based on the narration, generate the required fields for the selected visual source: ${targetSource}.

RULES for ${targetSource}:
${targetSource === 'pexels' ? '- Return "query" (1-3 words) and "alternatives" (array of strings).' : ''}
${targetSource === 'pollinations' || targetSource === 'cloudflare' ? `- Return "prompt" (highly detailed image prompt) and "variants" (array of strings).\n${visualStyle === 'vox_vintage' ? 'CRITICAL FOR VOX VINTAGE STYLE: YOU MUST return "layeredPrompts" containing an array of 2 to 4 DISTINCT foreground objects based on the narration (e.g., people, items, symbols). DO NOT leave it empty! These MUST be "vintage cutout illustration, halftone print style, solid #00FF00 green screen background" and have isGreenScreen set to true.\n' : ''}${visualStyle === 'vox_realistic' ? 'CRITICAL FOR VOX REALISTIC STYLE: YOU MUST return "layeredPrompts" containing an array of 2 to 4 DISTINCT foreground characters/objects based on the narration. DO NOT leave it empty! These MUST be realistic, highly detailed photography, solid #00FF00 green screen background" and have isGreenScreen set to true.\n' : ''}- If character animation is needed or style is vox_vintage/vox_realistic, also return "layeredPrompts" (array of objects with "prompt" and "isGreenScreen" boolean).` : ''}
${targetSource === 'map' ? '- Return "mapAnimation" object with "type" (route/flyTo), "waypoints" (array of {lat, lng, label}), "zoom" (number), and "style" (standard/satellite/dark/vintage).' : ''}

Return ONLY a valid JSON object matching the requested schema, nothing else.`;

  const model = "gemini-3.5-flash-lite";

  const payload = {
    contents: [{ role: "user", parts: [{ text: `${systemPrompt}\n\nNarration: "${narration}"` }] }],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.3,
      responseSchema: {
        type: "OBJECT",
        properties: {
          query: { type: "STRING" },
          alternatives: { type: "ARRAY", items: { type: "STRING" } },
          prompt: { type: "STRING" },
          variants: { type: "ARRAY", items: { type: "STRING" } },
          layeredPrompts: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                prompt: { type: "STRING" },
                isGreenScreen: { type: "BOOLEAN" }
              }
            }
          },
          mapAnimation: {
            type: "OBJECT",
            properties: {
              type: { type: "STRING" },
              zoom: { type: "NUMBER" },
              style: { type: "STRING" },
              waypoints: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    lat: { type: "NUMBER" },
                    lng: { type: "NUMBER" },
                    label: { type: "STRING" }
                  }
                }
              }
            }
          }
        }
      }
    }
  };

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error('Failed to generate adaptive prompt');
  }

  const resultData = await response.json();
  const text = resultData.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  try {
    const clean = text.replace(/^```(json)?/m, '').replace(/```$/m, '').trim();
    return JSON.parse(clean);
  } catch (e) {
    return {};
  }
}

// ===================================================================
// V2 Types — Smart Vox-Style Blueprint (one continuous BG + PIP rows)
// ===================================================================

export interface AutoVideoPipItemV2 {
  prompt: string;
  resolvedUrl?: string;
}

export interface AutoVideoSceneV2 {
  narration: string;
  startTime: number;
  endTime: number;
  duration: number;
  selectedBackgroundIndex: number;
  pipItems: AutoVideoPipItemV2[];
}

export interface AutoVideoBlueprintV2 {
  storyTheme: string;
  globalBackgrounds: { prompt: string; resolvedUrl?: string }[];
  scenes: AutoVideoSceneV2[];
  characterDescription?: string;
}

/**
 * V2 Blueprint generator — one continuous background + per-dialogue PIP items (green screen).
 */
export async function generateAutoVideoBlueprintV2(
  script: string,
  wordTimestamps: { word: string; start: number; end: number }[],
  totalDuration: number,
  apiKey: string,
  customInstructions?: string,
  characterDescription?: string,
  visualStyle?: string
): Promise<AutoVideoBlueprintV2> {
  const model = 'gemini-3.5-flash-lite';
  const wordTimestampsStr = JSON.stringify(wordTimestamps.slice(0, 200));
  const isVoxVintage = visualStyle === 'vox_vintage';

  const bgStyleHint = isVoxVintage
    ? 'vintage newspaper collage, halftone texture, aged paper, old magazine — NO people, pure background texture'
    : 'cinematic documentary background, moody lighting, high detail, no foreground subjects, pure environment/setting';
  const pipStyleHint = isVoxVintage
    ? 'vintage cutout illustration, halftone print style, isolated object on solid pure #00FF00 green screen background, no text'
    : 'realistic photo, high quality, isolated subject on solid pure #00FF00 green screen background, clean edges';

  const systemPrompt = `You are an expert Vox-style documentary video director and AI image prompt engineer.

Script total audio duration: ${totalDuration.toFixed(1)} seconds. Word timestamps provided.

RETURN JSON with:
1. "storyTheme": One sentence — the overarching theme of the entire script.
2. "globalBackgrounds": Array of EXACTLY 2 objects {prompt}. Full-screen BACKDROP images only (no subjects). Style: ${bgStyleHint}
3. "scenes": One per 3–7 second segment summing to ${totalDuration.toFixed(1)}s total.
   Each scene: narration (exact words in that range), startTime, endTime, duration (3-7s), selectedBackgroundIndex (0 or 1), pipItems (2-4 objects {prompt}).
   pipItems = FOREGROUND content representing what the narration is about. Style: ${pipStyleHint}. NEVER backgrounds.

RULES:
- globalBackgrounds = backdrops only. No subjects.
- pipItems = foreground subjects only. No backgrounds.
- Every scene needs 2-4 pipItems.
- Vary selectedBackgroundIndex based on emotional tone.
- Durations must sum to exactly ${totalDuration.toFixed(1)}s.
${customInstructions ? `CUSTOM: ${customInstructions}` : ''}
${characterDescription ? `CHARACTER: ${characterDescription}` : ''}
Return ONLY valid JSON.`;

  const payload = {
    contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\nScript:\n${script}\n\nWord Timestamps:\n${wordTimestampsStr}` }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          storyTheme: { type: 'STRING' },
          characterDescription: { type: 'STRING' },
          globalBackgrounds: {
            type: 'ARRAY',
            items: { type: 'OBJECT', properties: { prompt: { type: 'STRING' } }, required: ['prompt'] }
          },
          scenes: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                narration: { type: 'STRING' },
                startTime: { type: 'NUMBER' },
                endTime: { type: 'NUMBER' },
                duration: { type: 'NUMBER' },
                selectedBackgroundIndex: { type: 'INTEGER' },
                pipItems: {
                  type: 'ARRAY',
                  items: { type: 'OBJECT', properties: { prompt: { type: 'STRING' } }, required: ['prompt'] }
                }
              },
              required: ['narration', 'startTime', 'endTime', 'duration', 'selectedBackgroundIndex', 'pipItems']
            }
          }
        },
        required: ['storyTheme', 'globalBackgrounds', 'scenes']
      },
      temperature: 0.3,
      maxOutputTokens: 8192
    }
  };

  const response = await fetchWithKeyFailover(
    (key) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) },
    'gemini'
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to generate V2 blueprint: ${err}`);
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';

  try {
    const parsed = parseAndRepairJson<AutoVideoBlueprintV2>(rawText);

    // Ensure 2 backgrounds
    if (!parsed.globalBackgrounds || parsed.globalBackgrounds.length < 2) {
      parsed.globalBackgrounds = [
        { prompt: parsed.globalBackgrounds?.[0]?.prompt || 'cinematic documentary background, high detail, moody lighting' },
        { prompt: isVoxVintage ? 'vintage newspaper collage, halftone dots, aged paper texture' : 'modern documentary set, soft bokeh, studio lighting' }
      ];
    }

    // Normalize scene durations so they sum to totalDuration
    const rawTotal = (parsed.scenes || []).reduce((a, s) => a + (s.duration || 5), 0);
    const scale = rawTotal > 0 ? totalDuration / rawTotal : 1;
    let elapsed = 0;
    parsed.scenes = (parsed.scenes || []).map((s) => {
      const dur = Math.min(7, Math.max(3, (s.duration || 5) * scale));
      const scene: AutoVideoSceneV2 = {
        ...s,
        startTime: elapsed,
        duration: parseFloat(dur.toFixed(2)),
        endTime: parseFloat((elapsed + dur).toFixed(2)),
        selectedBackgroundIndex: Math.max(0, Math.min(parsed.globalBackgrounds.length - 1, s.selectedBackgroundIndex ?? 0)),
        pipItems: (s.pipItems || []).slice(0, 4)
      };
      elapsed += dur;
      return scene;
    });

    return parsed;
  } catch (e: any) {
    console.error('V2 blueprint parse error:', rawText.substring(0, 500));
    throw new Error(`AI returned invalid V2 blueprint: ${e.message}`);
  }
}
