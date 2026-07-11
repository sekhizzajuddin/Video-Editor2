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
- Include genre + mood + tempo keywords
- Good examples: "cinematic epic orchestral tense" / "dark electronic ambient drone" / "upbeat hip hop energetic" / "lofi chill study calm" / "suspense thriller strings building"
- BAD examples: "music" / "background" / "sound" (too vague — will return nothing)

SFX SEARCH QUERY RULES (for effects):
- Use 2–4 specific descriptive words for the exact sound
- Good examples: "heavy rain thunder storm" / "crowd cheering stadium" / "door slam wooden" / "car engine rev"
- BAD: "noise" / "effect" / "audio"

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
      response_format: { type: 'json_object' },
      temperature: 0.4,
      max_tokens: 3000
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

/**
 * Refines a raw scene description into optimized Freesound.org search keywords using Groq LLaMA 3.3.
 */
export async function refineAudioQueryWithGroq(query: string, type: 'sfx' | 'bgm' = 'sfx'): Promise<string> {
  const payload = {
    model: GROQ_TEXT_MODEL,
    messages: [
      {
        role: 'system',
        content: `You are an expert audio library search optimizer for Freesound.org.
Your ONLY job is to convert a sound description into the best 2-5 Freesound.org search keywords.

RULES:
- Return ONLY keywords separated by spaces. No punctuation. No explanation. No quotes. No extra text.
- Prioritize the most distinctive sonic characteristics.
- Order keywords from most to least specific.

${type === 'bgm' ? `MUSIC (BGM) KEYWORDS — must include musical genre/style/mood terms:
- Include at least one genre word: orchestral, electronic, ambient, hip-hop, jazz, rock, folk, cinematic, lofi, synthwave, trap
- Include at least one mood word: dramatic, upbeat, calm, tense, dark, energetic, emotional, mysterious, epic, chill
- Examples:
  Input: "dramatic background music for a city montage" → Output: cinematic orchestral dramatic urban epic
  Input: "calm relaxing background" → Output: ambient lofi calm relaxing atmospheric
  Input: "intense action scene music" → Output: epic orchestral intense action cinematic` : `SFX KEYWORDS — must describe the specific sound action:
- Examples:
  Input: "ocean waves crashing on sandy beach" → Output: waves ocean beach shore splash
  Input: "busy city traffic noise" → Output: city traffic urban cars busy
  Input: "door slam" → Output: door slam wooden thud close`}`,
      },
      {
        role: 'user',
        content: `Convert this ${type === 'bgm' ? 'music/BGM' : 'sound effect/SFX'} description to Freesound.org search keywords:\n"${query}"`
      }
    ],
    temperature: 0.1,
    max_tokens: 60
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
