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
      responseMimeType: 'application/json'
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

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
  if (cleanedText.startsWith('```')) {
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
        role: 'user',
        content: prompt
      }
    ],
    temperature: 0.1
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${groqKey}`
    },
    body: JSON.stringify(payload)
  });

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
