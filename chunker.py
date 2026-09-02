import re

with open('src/utils/kineticTypography.ts', 'r', encoding='utf-8') as f:
    lines = f.readlines()

prefix = lines[:38]
suffix = lines[277:]

new_block = """  const CHUNK_DURATION = 15;
  const numChunks = Math.ceil(clip.duration / CHUNK_DURATION);
  let allTypoResults: any[] = [];

  for (let i = 0; i < numChunks; i++) {
    const chunkStartRel = i * CHUNK_DURATION;
    const chunkDuration = Math.min(CHUNK_DURATION, clip.duration - chunkStartRel);
    const chunkTrimStart = clip.trimStart + chunkStartRel;

    onProgress(10 + Math.round((i / numChunks) * 75)); // Progress scales through loop

    const frames = await extractFramesFromVideo(media.url, 1, chunkTrimStart, chunkTrimStart + chunkDuration);
    const wavBlob = await extractClipAudio(media.url, chunkTrimStart, chunkDuration);
    let audioDataPart: string | null = null;
    
    if (wavBlob) {
      const base64Audio = await blobToBase64(wavBlob);
      audioDataPart = base64Audio.split(',')[1] || base64Audio;
    }

    let scriptInstruction = "";
    if (options.script === 'roman_urdu_hindi') {
      scriptInstruction = "Transcribe in Roman Urdu/Hindi (i.e. Urdu/Hindi written in English/Latin letters). Preserve the spoken language's rhythm and emphasis.";
    } else if (options.script === 'hindi') {
      scriptInstruction = "Transcribe in Hindi (Devanagari script). Ensure grammatically correct sentences.";
    } else if (options.script === 'spanish') {
      scriptInstruction = "Transcribe in Spanish. Capture emotion and rhythm.";
    } else {
      scriptInstruction = "Transcribe strictly in English. Preserve correct casing and punctuation.";
    }

    let activeCasing = options.casing || 'first_letter_caps';
    let casingInstruction = "Use natural casing (e.g., 'Hello world', 'I love it').";
    if (activeCasing === 'all_caps') casingInstruction = "OUTPUT ALL TEXT IN ALL CAPS (e.g. 'HELLO WORLD').";
    if (activeCasing === 'all_lowercase') casingInstruction = "output all text in lowercase (e.g. 'hello world').";
    if (activeCasing === 'first_letter_caps') casingInstruction = "Capitalize The First Letter Of Every Word (e.g. 'Hello World').";

    const customPromptText = options.customPrompt?.trim() || "";
    const customPromptInstruction = customPromptText 
      ? `\\n>>> USER CUSTOM INSTRUCTION (MANDATORY HIGHEST PRIORITY): <<<\\n"${customPromptText}"\\n>>> YOU MUST APPLY THIS CUSTOM INSTRUCTION ACROSS ALL GENERATED WORDS AND ANIMATIONS <<<\\n`
      : "";

    const userStyle = options.stylePreset || 'random';
    const userAnim = options.animation || 'random';

    const prompt = `You are a world-class Kinetic Typography Director.
I am providing audio and frames of a video chunk (Duration: ${chunkDuration.toFixed(2)} seconds).
${customPromptInstruction}
PRIMARY TASK: Generate a JSON array of text animation clips, STRICTLY WORD-BY-WORD.
- CRITICAL: You MUST generate EXACTLY ONE JSON object for EVERY SINGLE SPOKEN WORD in this chunk.
- DO NOT SKIP WORDS.

JSON Schema for EACH word object in the returned array:
- "text": string (the single spoken word)
- "start": number (start time in seconds, 0 - ${chunkDuration.toFixed(2)})
- "end": number (end time in seconds, 0 - ${chunkDuration.toFixed(2)})
- "fontSize": number (45 - 120)
- "fontFamily": string ('Anton', 'Oswald', 'Bebas Neue', 'Impact', 'Outfit', 'Inter', 'Montserrat', or 'Georgia')
- "color": string (vibrant hex color e.g. '#fbbf24')
- "backgroundColor": string (optional, e.g. 'transparent', '#000000', 'rgba(0,0,0,0.7)', '#ff0055')
- "backgroundStyle": string (optional, background shape ID: 'solid_pill', 'sharp_rect', 'slanted_rect', 'outline_box', 'marker_swipe', 'thick_brush', 'jagged_paint', 'splatter', 'spray_paint', 'hud_plate', 'cyber_bracket', 'neon_outline', 'glitch_box', 'action_burst', 'thought_cloud', 'speed_box', 'ribbon', 'torn_paper', 'ticket_stub', 'underline', 'double_underline', 'highlight', 'quote_bracket')
- "strokeColor": string (optional, e.g. '#000000', '#ffffff', '#ffff00')
- "strokeWidth": number (optional, 0, 1, 2, 3, or 4)
- "shadowColor": string (optional hex, e.g. '#000000')
- "rotation": number (optional degrees, e.g. -15 to 15, 0 for straight)
- "x": number (0 - 100, 50 is center, 20 is left, 80 is right)
- "y": number (0 - 100, 50 is center, 20 is top, 80 is bottom)
- "breakAfter": boolean (true if line break should follow this word)
- "animationIn": 'fadeIn' | 'zoom' | 'bounce' | 'typewriter' | 'slideUp' | 'slideDown' | 'slideLeft' | 'slideRight' | 'elastic' | 'splitReveal' | 'revealWipe' | 'rollUp' | 'scaleFlip' | 'zoomBlur' | 'glitch' | 'letterSpacing'
- "animationOut": 'fadeOut' | 'zoom' | 'slideUp' | 'slideDown' | 'slideLeft' | 'slideRight' | 'elastic' | 'splitReveal' | 'revealWipe' | 'rollUp' | 'scaleFlip' | 'zoomBlur' | 'glitch' | 'letterSpacing'
- "stylePreset": string (e.g. 'MrBeast Hype', 'Alex Hormozi Impact', 'Modern Shorts Pill', 'Neon Cyberpunk', 'Cyber Neon', 'Yellow Warning', 'Golden Glow', 'Bouncy Pop', 'Neon Pink Glow', 'Ruby Red', 'Vibrant Pink', 'Sunset Orange', 'Forest Emerald', 'Electric Indigo', 'Typewriter Green', 'Chunky Shadow', 'Glitch Cyber', 'Bubble Caption')

1. SCRIPT/LANGUAGE:
   ${scriptInstruction}
   ${casingInstruction}
2. POSITIONING & COORDINATES:
   - x: 0 - 100 screen percentage
   - y: 0 - 100 screen percentage
   ${customPromptText ? '- NOTE: Follow the USER CUSTOM INSTRUCTIONS above for target position (e.g. top/bottom/center).' : '- Stagger positions word-by-word (x: 35-65, y: 40-60) unless user custom instruction specifies otherwise.'}
3. VIBRANT COLORS: Use high contrast colors.
4. TIMING PRECISION: Keep start/end tight based on audio.
5. PREFERENCES: 
${userStyle !== 'random' ? `STYLE PRESET PREFERENCE: Lean towards "${userStyle}" style where possible.` : ''}
${userAnim !== 'random' ? `ANIMATION PREFERENCE: Prefer "${userAnim}" for animation where applicable.` : ''}

Output ONLY a valid JSON array, no markdown, no explanation:
[{"text":"Word","start":0.5,"end":0.85,"fontSize":98,"fontFamily":"Anton","color":"#fbbf24","x":50,"y":50,"breakAfter":false,"animationIn":"zoom","animationOut":"fadeOut","stylePreset":"Bouncy Pop"}]`;

    let resultJsonStr = '';

    if (provider === 'groq') {
      if (!wavBlob) {
        console.warn('[Kinetic Typography] Audio extraction failed for chunk; falling back.');
        resultJsonStr = JSON.stringify(generateFallbackTypography(chunkDuration, prompt));
      } else {
        const transcription = await transcribeAudioWithGroq(wavBlob);
        const wordTimestamps = transcription.words
          ? JSON.stringify(transcription.words, null, 2)
          : JSON.stringify(transcription.segments || transcription.text, null, 2);

        const groqSystemPrompt = `You are a world-class Kinetic Typography Director.
You have precise word-level timestamps from Whisper transcription. 
${customPromptInstruction}
Rules:
- Use the Whisper timestamps as the SOURCE OF TRUTH for word timing.
- CRITICAL: MUST generate EXACTLY ONE JSON object for EVERY SINGLE WORD present in transcription.
- Return ONLY a valid JSON array.
- STRICTLY RESPECT AND ENFORCE ANY USER CUSTOM INSTRUCTIONS.`;

        const groqUserPrompt = `${prompt}\n\n---\nWHISPER WORD TIMESTAMPS (use these for precise timing):\n${wordTimestamps}\n\n${customPromptText ? `REMINDER OF USER CUSTOM INSTRUCTION (strictly apply this):\n"${customPromptText}"\n\n` : ''}Generate the kinetic typography JSON array now:`;

        resultJsonStr = await analyzeReasoningWithGroq(groqUserPrompt, groqSystemPrompt);
      }
    } else {
      const contentsParts: any[] = [{ text: prompt }];

      if (customPromptText) {
        contentsParts.push({
          text: `CRITICAL USER CUSTOM INSTRUCTION (Strictly follow this): "${customPromptText}"`
        });
      }

      if (audioDataPart) {
        contentsParts.push({
          inlineData: { mimeType: 'audio/wav', data: audioDataPart }
        });
      }

      for (const frame of frames) {
        const b64 = frame.replace(/^data:image\/(png|jpeg|webp);base64,/, '');
        contentsParts.push({
          inlineData: { mimeType: 'image/jpeg', data: b64 }
        });
      }

      const requestBody: any = {
        systemInstruction: {
          parts: [{
            text: `You are a Kinetic Typography Director. Generate word-by-word JSON typography objects matching speech timing.\n${customPromptInstruction}`
          }]
        },
        contents: [{ parts: contentsParts }],
        generationConfig: {
          temperature: 0.3,
          responseMimeType: "application/json"
        }
      };

      const response = await fetchWithKeyFailover(
        (key) => `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        },
        'gemini'
      );

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini API Error: ${response.status} - ${errText}`);
      }

      const data = await response.json();
      resultJsonStr = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!resultJsonStr) {
        throw new Error('No valid response from Gemini for this chunk.');
      }
    }

    resultJsonStr = resultJsonStr.replace(/^```(json)?/, '').replace(/```$/, '').trim();
    let chunkResults = [];
    try {
      chunkResults = JSON.parse(resultJsonStr);
    } catch(e) {
      console.warn(`Failed to parse AI typography response for chunk ${i}: ${resultJsonStr}`);
      continue; // Skip this chunk and move to next instead of crashing whole process
    }

    // Offset chunk timestamps to absolute clip time
    for (const item of chunkResults) {
      if (item.start !== undefined) item.start += chunkStartRel;
      if (item.end !== undefined) item.end += chunkStartRel;
      allTypoResults.push(item);
    }
  }

"""

with open('src/utils/kineticTypography.ts', 'w', encoding='utf-8') as f:
    f.writelines(prefix)
    f.write(new_block + "\n")
    for sl in suffix:
        f.write(sl.replace('typoResults', 'allTypoResults'))

