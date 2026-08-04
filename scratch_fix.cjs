const fs = require('fs');
const lines = fs.readFileSync('src/utils/aiClient.ts', 'utf8').split('\n');

// The file was corrupted around line 805. Let's slice before the corruption.
let newLines = lines.slice(0, 805);

const appendix = `
  const response = await fetchWithKeyFailover(
    (key) => {
      if (provider === 'groq') {
        requestHeaders['Authorization'] = \`Bearer \${key}\`;
        return 'https://api.groq.com/openai/v1/chat/completions';
      }
      return \`https://generativelanguage.googleapis.com/v1beta/models/\${GEMINI_VISION_MODEL}:generateContent?key=\${key}\`;
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
    throw new Error(\`[\${provider.toUpperCase()} API Error] \${response.status} - \${errorText}\`);
  }

  const data = await response.json();
  let text = '';
  if (provider === 'gemini') {
    text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } else {
    text = data.choices?.[0]?.message?.content || '';
  }

  try {
    const cleanedText = text.replace(/^\`\`\`(json)?/m, '').replace(/\`\`\`$/m, '').trim();
    const result = JSON.parse(cleanedText);
    return result.cues || [];
  } catch (e) {
    throw new Error(\`Failed to parse \${provider.toUpperCase()} response: \${text.substring(0, 200)}\`);
  }
}

export async function enhancePromptWithGemini(prompt: string, apiKey: string): Promise<string> {
  const systemPrompt = "You are an expert AI Video and Image prompt engineer. Enhance the following basic prompt into a highly detailed, cinematic, and professional prompt suitable for advanced AI video generators like Sora, Kling, or Midjourney. Focus on lighting, camera angles, atmosphere, and visual fidelity. Return ONLY the enhanced prompt string without any conversational filler or quotes.";
  const response = await fetch(\`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=\${apiKey}\`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: \`\${systemPrompt}\\n\\nUser Prompt: \${prompt}\` }] }]
    })
  });
  if (!response.ok) throw new Error("Failed to enhance prompt");
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

export interface VideoScenePlan {
  duration: number; // in seconds
  narration: string;
  searchQuery: string;
}

export async function generateVideoScenesFromScript(script: string, totalDuration: number, apiKey: string): Promise<VideoScenePlan[]> {
  const systemPrompt = \`You are an expert video director and stock footage researcher.
I am providing you with a script that has a total audio voiceover duration of \${totalDuration.toFixed(1)} seconds.
Your job is to break this script down into a sequence of consecutive video scenes to perfectly cover this duration.

RULES:
1. Divide the script into logical scenes. Each scene should ideally be between 3 to 6 seconds long.
2. The sum of the "duration" for all scenes MUST equal exactly \${totalDuration.toFixed(1)} seconds.
3. For each scene, provide a "searchQuery" which is a 1-3 word search term to find relevant free stock video on Pexels (e.g., "business meeting", "nature forest", "coding computer", "happy family"). Keep queries simple and generic for better search results.
4. Provide the exact "narration" chunk spoken during that scene for subtitles.

Return ONLY a JSON array, nothing else. Format:
[
  { "duration": 4.5, "narration": "Welcome to the future of video editing.", "searchQuery": "futuristic technology" },
  { "duration": 3.2, "narration": "Where everything is automated.", "searchQuery": "robot manufacturing" }
]\`;

  const response = await fetch(\`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=\${apiKey}\`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: \`\${systemPrompt}\\n\\nScript: \${script}\` }] }],
      generationConfig: {
        responseMimeType: "application/json"
      }
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(\`Failed to generate scenes: \${err}\`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '[]';
  try {
    const scenes: VideoScenePlan[] = JSON.parse(text);
    return scenes;
  } catch (e) {
    console.error("Error parsing scene plan JSON:", text);
    throw new Error("Invalid response from Gemini AI.");
  }
}
`;

fs.writeFileSync('src/utils/aiClient.ts', newLines.join('\\n') + appendix);
console.log('Fixed aiClient.ts');
