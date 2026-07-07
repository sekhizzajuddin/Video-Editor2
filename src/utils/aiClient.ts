export interface AICueResult {
  start: number;
  end: number;
  query: string;
  type: 'sfx' | 'bgm';
  reason: string;
}

/**
 * Analyzes a storyboard grid image with Gemini 2.0 Flash Vision.
 */
export async function analyzeStoryboardWithGemini(
  base64Image: string,
  segmentDuration: number,
  geminiKey: string
): Promise<AICueResult[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiKey}`;

  const prompt = `You are a professional film sound designer.
This image is a chronological storyboard grid of a video clip segment (columns left-to-right, rows top-to-bottom, total duration ${segmentDuration} seconds). Each thumbnail represents a second of time.

Analyze the visual scenes, actions, movements, and scenery.
Identify necessary sound effects (SFX) and background music (BGM).
For each sound cue, determine:
1. Relative start time (seconds, between 0 and ${segmentDuration})
2. Relative end time (seconds, between 0 and ${segmentDuration})
3. Search query/keyword (e.g. 'ocean waves crashing', 'seagulls crying', 'quiet peaceful forest ambience')
4. Type ('sfx' or 'bgm')
5. Contextual justification (what visual element triggered this)

Return strictly as a JSON array matching this schema:
[
  { "start": number, "end": number, "query": string, "type": "sfx"|"bgm", "reason": string }
]`;

  const payload = {
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Image
            }
          }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            start: { type: 'NUMBER', description: 'Start time of the sound cue in seconds relative to the chunk' },
            end: { type: 'NUMBER', description: 'End time of the sound cue in seconds relative to the chunk' },
            query: { type: 'STRING', description: 'Search query or keyword for sound search' },
            type: { type: 'STRING', enum: ['sfx', 'bgm'], description: 'Type of the sound cue: sfx or bgm' },
            reason: { type: 'STRING', description: 'Contextual reason or description of the visual trigger' }
          },
          required: ['start', 'end', 'query', 'type', 'reason']
        }
      }
    }
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload),
    signal: controller.signal
  });
  clearTimeout(timeoutId);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  const resultData = await response.json();
  const text = resultData?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Gemini API returned an empty or invalid response.');
  }

  let cleanedText = text.trim();
  
  // Strip any leading/trailing conversational text or markdown elements
  const startIdx = cleanedText.indexOf('[');
  const endIdx = cleanedText.lastIndexOf(']');
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    cleanedText = cleanedText.substring(startIdx, endIdx + 1);
  } else if (cleanedText.startsWith('```')) {
    const firstNewline = cleanedText.indexOf('\n');
    if (firstNewline !== -1) {
      cleanedText = cleanedText.substring(firstNewline + 1);
    }
    if (cleanedText.endsWith('```')) {
      cleanedText = cleanedText.substring(0, cleanedText.length - 3);
    }
    cleanedText = cleanedText.trim();
  }

  try {
    return JSON.parse(cleanedText) as AICueResult[];
  } catch (e) {
    throw new Error(`Failed to parse Gemini response as JSON: ${cleanedText}`);
  }
}

/**
 * Refines a raw scene description into optimized search tags/keywords for Freesound search using Groq.
 */
export async function refineAudioQueryWithGroq(
  query: string,
  groqKey: string
): Promise<string> {
  const url = 'https://api.groq.com/openai/v1/chat/completions';

  const prompt = `You are a search query optimizer for audio assets.
Given this sound design description: "${query}", return 3-5 optimized tags/keywords for searching sound effects on Freesound.org.
For example, "ocean waves crashing on sand" should become "waves ocean seashore water splash".
Return ONLY the optimized keywords separated by spaces. Do NOT include any explanations, markdown, or headers.`;

  const payload = {
    model: 'llama3-8b-8192',
    messages: [
      {
        role: 'system',
        content: 'You are a search query optimizer. Return ONLY the requested tags/keywords separated by space. Do not write any conversational text, explanations, or quotes.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: 0.1
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${groqKey}`
    },
    body: JSON.stringify(payload),
    signal: controller.signal
  });
  clearTimeout(timeoutId);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq API error: ${response.status} - ${errorText}`);
  }

  const resultData = await response.json();
  const refined = resultData?.choices?.[0]?.message?.content;
  if (!refined) {
    return query; // fallback to original query if empty
  }

  let cleanRefined = refined.trim().replace(/^["']|["']$/g, '');
  return cleanRefined.replace(/[\r\n]+/g, ' ');
}

export interface AIMotionGraphicSuggestion {
  templateId: string;
  start: number;
  end: number;
  suggestedText: string;
  reason: string;
}

/**
 * Analyzes a storyboard grid image with Gemini 2.0 Flash Vision to suggest matching motion graphics overlays.
 */
export async function analyzeMotionGraphicsWithGemini(
  base64Image: string,
  segmentDuration: number,
  geminiKey: string
): Promise<AIMotionGraphicSuggestion[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiKey}`;

  const prompt = `You are a professional video editor and motion graphics designer.
This image is a chronological storyboard grid of a video clip segment (columns left-to-right, rows top-to-bottom, total duration ${segmentDuration} seconds). Each thumbnail represents a second of time.

Analyze the visual scenes, action, transitions, and subjects.
Recommend 3-4 motion graphics, animated title overlays, or lower-thirds that would improve the production value of this segment.
Choose from these template IDs:
- 'kinetic_typewriter': Best for narrative typewriter text, subtitles, or location/date card.
- 'kinetic_bounce': Best for loud, energetic bounce-in titles, action emphasis, or big call-outs.
- 'lower_third_classic': Best for introducing a person (name/role) or labelling a specific subject on screen.
- 'cinematic_title': Best for slow, elegant, cinematic title cards, landscape intros, or quiet scenic titles.
- 'subtitle_bar': Best for clean subtitles or informational banners at the bottom of the screen.
- 'kinetic_pop': Best for pop-art titles, funny emphasis, or quick pop-ups.
- 'subscribe_bell': Best for social media subscribe/bell animated alerts at appropriate times.

For each suggestion, determine:
1. The most appropriate templateId (must be one of the IDs listed above)
2. Start time (seconds, between 0 and ${segmentDuration})
3. End time (seconds, between 0 and ${segmentDuration}, usually 3-5 seconds duration)
4. Suggested text (custom text to render in the template matching the scene contents, e.g., name/title of a speaking person, name of a city/scenery, or social call-to-action)
5. Contextual justification (why this template and text fit this specific second of video)

Return strictly as a JSON array matching this schema:
[
  { "templateId": string, "start": number, "end": number, "suggestedText": string, "reason": string }
]`;

  const payload = {
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Image
            }
          }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            templateId: { type: 'STRING', enum: ['kinetic_typewriter', 'kinetic_bounce', 'lower_third_classic', 'cinematic_title', 'subtitle_bar', 'kinetic_pop', 'subscribe_bell'], description: 'ID of the title template to use' },
            start: { type: 'NUMBER', description: 'Start time of the graphic overlay in seconds' },
            end: { type: 'NUMBER', description: 'End time of the graphic overlay in seconds' },
            suggestedText: { type: 'STRING', description: 'Custom text contextually matching the video frames' },
            reason: { type: 'STRING', description: 'Justification for adding this graphic here' }
          },
          required: ['templateId', 'start', 'end', 'suggestedText', 'reason']
        }
      }
    }
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload),
    signal: controller.signal
  });
  clearTimeout(timeoutId);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  const resultData = await response.json();
  const text = resultData?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Gemini API returned an empty or invalid response.');
  }

  let cleanedText = text.trim();
  const startIdx = cleanedText.indexOf('[');
  const endIdx = cleanedText.lastIndexOf(']');
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    cleanedText = cleanedText.substring(startIdx, endIdx + 1);
  }

  try {
    return JSON.parse(cleanedText) as AIMotionGraphicSuggestion[];
  } catch (e) {
    throw new Error(`Failed to parse Gemini motion graphics response: ${cleanedText}`);
  }
}
