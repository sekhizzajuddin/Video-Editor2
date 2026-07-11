import { fetchWithKeyFailover, getLocalGeminiKey, getEnvGeminiKey } from './apiKeyManager';

export function getGeminiKey(): string {
  return getEnvGeminiKey() || getLocalGeminiKey();
}

export function getGroqKey(): string {
  return '';
}

// ─── Model constants ─────────────────────────────────────────────────────────
const GEMINI_VISION_MODEL = 'gemini-3.1-flash-lite';          // current stable GA model, good free tier
const GROQ_VISION_MODEL   = 'llama-4-scout-17b-16e-instruct'; // Llama 4 Scout (replaces deprecated llama-3.2-90b)
const GROQ_TEXT_MODEL     = 'llama-3.3-70b-versatile';        // Best Groq reasoning / text model

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

  const prompt = `You are a world-class professional film Sound Designer and Music Supervisor.

CONTEXT: You are looking at a chronological storyboard grid extracted from a ${segmentDuration.toFixed(1)}-second video clip.
- Grid layout: frames go LEFT-TO-RIGHT then TOP-TO-BOTTOM.
- Total frames in this grid: ${totalFrames}.
- Each frame represents exactly ${timePerFrame.toFixed(3)} seconds of video time.
- Use the yellow timestamps burned into each thumbnail corner to identify exact timing.

YOUR MISSION: Identify every moment that needs a sound effect (SFX) or background music (BGM).
Be specific, creative, and cinematically accurate. Consider:
• Physical actions visible (footsteps, door slams, claps, explosions, vehicles, tools)
• Ambient environment (indoor/outdoor, urban/nature, quiet/busy)
• Emotional tone of the scene (tense, calm, joyful, dramatic)
• Transitions or cuts that may need a musical sting or whoosh
• Any absence of sound that needs atmosphere fill

RULES:
1. ALL timestamps must be between 0 and ${segmentDuration.toFixed(2)} seconds.
2. BGM cues should span longer periods (3\u2013${segmentDuration.toFixed(0)}s) and describe mood/genre.
3. SFX cues should be short and precise (<3s) and match the exact visible action.
4. Search queries must be optimized for Freesound.org (2\u20135 descriptive keywords, no punctuation).
5. Include at least one BGM suggestion per segment if it is more than 3 seconds long.
6. Do NOT invent sound cues that don't match visible content.

Return ONLY this exact JSON format with no markdown wrapping:
{
  "cues": [
    {
      "start": <number 0 to ${segmentDuration.toFixed(2)}>,
      "end": <number 0 to ${segmentDuration.toFixed(2)}>,
      "query": "<freesound search keywords>",
      "type": "sfx" | "bgm",
      "reason": "<one sentence: what you saw and why this sound fits>"
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
        temperature: 0.4,
        maxOutputTokens: 2048
      }
    };
  } else {
    requestBody = {
      model: GROQ_VISION_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are a professional film Sound Designer. Analyze storyboard grids and return sound cue data as strict JSON only. No markdown, no commentary.'
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
          ]
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 2048
    };
  }

  const { controller, clear } = makeController(fps, segmentDuration);

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
      body: JSON.stringify(requestBody),
      signal: controller.signal
    },
    provider
  );

  clear();

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
    return cues as AICueResult[];
  } catch (e) {
    throw new Error(`Failed to parse ${provider.toUpperCase()} storyboard response as JSON. Raw: ${text.slice(0, 300)}`);
  }
}

/**
 * Refines a raw scene description into optimized Freesound.org search keywords using Groq LLaMA 3.3.
 */
export async function refineAudioQueryWithGroq(query: string): Promise<string> {
  const payload = {
    model: GROQ_TEXT_MODEL,
    messages: [
      {
        role: 'system',
        content: `You are an expert audio library search optimizer for Freesound.org.
Your ONLY job is to convert a sound description into the best 2-5 search keywords.
Rules:
- Return ONLY keywords separated by spaces. No punctuation. No explanation. No quotes. No extra text.
- Prioritize the most distinctive sonic characteristics.
- Order keywords from most to least specific.
- Examples:
  Input: "ocean waves crashing on sandy beach" → Output: waves ocean beach shore splash
  Input: "busy city traffic noise" → Output: city traffic urban cars busy
  Input: "dramatic orchestral tension music" → Output: orchestral tension dramatic strings epic`
      },
      {
        role: 'user',
        content: `Convert this sound description to Freesound.org search keywords:\n"${query}"`
      }
    ],
    temperature: 0.1,
    max_tokens: 50
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  const response = await fetchWithKeyFailover(
    (key) => 'https://api.groq.com/openai/v1/chat/completions',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    },
    'groq'
  );
  clearTimeout(timeoutId);

  if (!response.ok) {
    console.warn(`[Groq Query Refine] HTTP ${response.status}. Using original query as fallback.`);
    return query;
  }

  const resultData = await response.json();
  const refined = resultData?.choices?.[0]?.message?.content?.trim();
  if (!refined) return query;

  // Sanitize: strip quotes, markdown, newlines
  return refined
    .replace(/^["\u201c\u2018']/g, '')
    .replace(/["\u201d\u2019']$/g, '')
    .replace(/[`*_]/g, '')
    .replace(/[\r\n]+/g, ' ')
    .trim();
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
      response_format: { type: 'json_object' },
      temperature: 0.4,
      max_tokens: 1024
    };
  }

  const { controller, clear } = makeController(1, segmentDuration);

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
      body: JSON.stringify(requestBody),
      signal: controller.signal
    },
    provider
  );

  clear();

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

  const response = await fetchWithKeyFailover(
    (key) => `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_VISION_MODEL}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    },
    'gemini'
  );

  clear();

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
