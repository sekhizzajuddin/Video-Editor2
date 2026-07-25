import { TimelineClip, TimelineTrack, PipWindow } from '@/types';
import { useEditorStore } from '@/store/editorStore';
import { extractFramesFromVideo } from './frameExtractor';
import { TEXT_TEMPLATES } from './textTemplates';
import { transcribeAudioWithGroq, analyzeReasoningWithGroq } from './groqClient';

const uuidv4 = () => crypto.randomUUID();

export interface KineticTypographyOptions {
  script: string;
  englishCasing?: 'all_caps' | 'first_letter_caps' | 'none';
  casing?: 'all_caps' | 'first_letter_caps' | 'none';
  styleSelection?: string;
  animationSelection?: string;
  provider?: 'gemini' | 'groq';
  typoType?: 'word' | 'sentence' | 'hybrid';
  referenceScript?: string;
}

export async function generateKineticTypography(
  clip: TimelineClip,
  trackId: string,
  options: KineticTypographyOptions,
  onProgress: (p: number) => void
): Promise<void> {
  const store = useEditorStore.getState();
  const provider = options.provider || 'gemini';

  const media = store.mediaLibrary.find(m => m.id === clip.mediaId);
  if (!media || !media.url || media.url === 'PENDING_RESTORE') {
    throw new Error('Media not available for analysis');
  }

  onProgress(10);

  // 1. Extract visual frames for the clip's duration
  const frames = await extractFramesFromVideo(media.url, 1, clip.trimStart, clip.trimStart + clip.duration);
  onProgress(30);

  // 2. Extract audio for the clip
  const wavBlob = await extractClipAudio(media.url, clip.trimStart, clip.duration);
  let audioDataPart: string | null = null;
  
  if (wavBlob) {
    const base64Audio = await blobToBase64(wavBlob);
    audioDataPart = base64Audio.split(',')[1] || base64Audio;
  }
  
  onProgress(50);

  // Translate script code to readable instruction
  let scriptInstruction = "";
  if (options.script === 'roman_urdu_hindi') {
    scriptInstruction = "Transcribe in Roman Urdu/Hindi (i.e. Urdu/Hindi written in English/Latin letters, e.g. 'aur all loving hai', 'kya baat hai'). Preserve the spoken language's rhythm and emphasis.";
  } else if (options.script === 'hindi') {
    scriptInstruction = "Transcribe in Devanagari Hindi script (e.g. 'और ऑल लविंग है', 'क्या बात है'). Preserve emphasis and spoken rhythm.";
  } else if (options.script === 'english') {
    scriptInstruction = "Transcribe in English. Preserve natural spoken rhythms and contractions (e.g., don't, I'm, we're).";
  } else {
    scriptInstruction = `Translate and transcribe the spoken words into the ${options.script.toUpperCase()} script/language. Preserve emphasis and rhythm.`;
  }

  // Casing requirement
  const activeCasing = options.casing || options.englishCasing || 'none';
  let casingInstruction = "";
  if (options.script === 'english' || options.script === 'roman_urdu_hindi') {
    if (activeCasing === 'all_caps') {
      casingInstruction = "Convert ALL words to strictly UPPERCASE (e.g. 'HELLO', 'WORLD', 'AAJ', 'MERA').";
    } else if (activeCasing === 'first_letter_caps') {
      casingInstruction = "Capitalize ONLY the first letter of each word (e.g. 'Hello', 'World', 'Aaj', 'Mera').";
    }
  }

  const userStyle = options.styleSelection || 'random';
  const userAnim = options.animationSelection || 'random';
  const refScriptInstruction = options.referenceScript
    ? `\n\nUSER-PROVIDED GROUND-TRUTH REFERENCE SCRIPT:\n"${options.referenceScript}"\n\nCRITICAL INSTRUCTION FOR GROUND-TRUTH REFERENCE SCRIPT:\n- The user has provided the exact ground-truth script spoken in the video/audio.\n- You MUST use the exact words, spelling, and order from this reference script for the "text" properties of the generated typography objects.\n- Align each word from the reference script to its corresponding spoken audio timestamp.\n- This corrects any phonetic transcription errors from automated speech recognition.`
    : '';

  // ─── Shared high-quality prompt for typography generation ──────────────────
  const prompt = `You are a world-class Kinetic Typography Director and Motion Graphics Designer.
I am providing audio and visual frames of a video clip (Duration: ${clip.duration.toFixed(2)} seconds).

PRIMARY TASK: Generate a JSON array of text animation clips, STRICTLY WORD-BY-WORD.
- CRITICAL: You MUST generate EXACTLY ONE JSON object for EVERY SINGLE SPOKEN WORD.
- Do NOT skip any words. Do NOT group multiple words into one object. Missing words will break the video sync.
- Every word must have a precise, short duration matching the real audio timing.

SCRIPT & LANGUAGE:
- ${scriptInstruction}
${casingInstruction ? `- ${casingInstruction}` : ''}${refScriptInstruction}

DESIGNING AN EMOTIONALLY EXPRESSIVE TYPOGRAPHY FLOW (CRITICAL RULES):
1. SEMANTIC WEIGHT: Identify KEY emotional/emphatic words (nouns, verbs like 'NEVER', 'EXPLODE', 'LOVE', 'ROKNA').
   - Key words: fontSize 85–120, bold vibrant color, dramatic animation (bounce, zoom, slideUp).
   - Filler words (is, a, the, to, and, aur, ki, ka): fontSize 45–60, muted/white color, simple fadeIn.
2. KINETIC DRIFT: Stagger positions word-by-word so they POP in different screen locations.
   - x: between 30 and 70 (center screen, vary left/right)
   - y: between 35 and 65 (vary upper/lower)
   - Never place two consecutive words at the same x,y position.
3. VIBRANT COLORS: Use high-contrast palette:
   - Key words: '#fbbf24' yellow, '#22d3ee' cyan, '#f43f5e' rose-pink, '#a855f7' purple, '#22c55e' emerald.
   - Filler words: '#ffffff' white or '#94a3b8' slate gray.
4. TIMING PRECISION:
   - Each word's start/end should be tight (0.05–0.4s max for normal speech; 0.4–0.8s for slow/dramatic speech).
   - Do not leave gaps between words unless there is a genuine silence in audio.
5. FONT HIERARCHY:
   - Key words: 'Anton', 'Bebas Neue', 'Impact', 'Oswald'.
   - Filler words: 'Inter', 'Outfit', 'Montserrat'.

${userStyle !== 'random' ? `STYLE PRESET PREFERENCE: Lean towards "${userStyle}" style where possible.` : ''}
${userAnim !== 'random' ? `ANIMATION PREFERENCE: Prefer "${userAnim}" for animation where applicable.` : ''}

For each word, define:
- "text": The single spoken word.
- "start": Start time (seconds, 0–${clip.duration.toFixed(2)}).
- "end": End time (seconds, 0–${clip.duration.toFixed(2)}).
- "fontSize": 45–120.
- "fontFamily": 'Anton', 'Oswald', 'Bebas Neue', 'Impact', 'Outfit', 'Inter', 'Montserrat', or 'Georgia'.
- "color": A vibrant hex color string.
- "x": X position (30–70, as percentage of screen width).
- "y": Y position (35–65, as percentage of screen height).
- "animationIn": Choose from:
  Basic: 'fadeIn', 'zoom', 'bounce', 'typewriter', 'slideUp', 'slideDown', 'slideLeft', 'slideRight'
  Cinematic (prefer these for KEY words): 'elastic' (spring pop - best for hype/energy words), 'splitReveal' (cinematic title reveal - best for dramatic statements), 'revealWipe' (curtain wipe - best for reveals/announcements), 'rollUp' (film credit roll - best for lists/credits), 'scaleFlip' (dramatic snap - best for shocking words), 'zoomBlur' (blockbuster zoom - best for openers/big moments), 'glitch' (cyber jitter - best for tech/error/intensity words), 'letterSpacing' (expand in - best for brand names/titles)
- "animationOut": Choose from:
  Basic: 'fadeOut', 'zoom', 'slideUp', 'slideDown', 'slideLeft', 'slideRight'
  Cinematic: 'elastic', 'splitReveal', 'revealWipe', 'rollUp', 'scaleFlip', 'zoomBlur', 'glitch', 'letterSpacing'
- "stylePreset": Choose from: 'MrBeast Hype', 'Alex Hormozi Impact', 'Modern Shorts Pill', 'Neon Cyberpunk', 'Cyber Neon', 'Yellow Warning', 'Golden Glow', 'Bouncy Pop', 'Neon Pink Glow', 'Ruby Red', 'Vibrant Pink', 'Sunset Orange', 'Forest Emerald', 'Electric Indigo', 'Typewriter Green', 'Chunky Shadow', 'Glitch Cyber', 'Bubble Caption'.

Output ONLY a valid JSON array, no markdown, no explanation:
[{"text":"Wow","start":0.5,"end":0.85,"fontSize":98,"fontFamily":"Anton","color":"#fbbf24","x":52,"y":48,"animationIn":"zoom","animationOut":"fadeOut","stylePreset":"Bouncy Pop"}]`;

  let resultJsonStr = '';

  if (provider === 'groq') {
    // Groq path: Use Whisper for precise word-level timestamps, then feed to LLaMA 3.3 for layout
    if (!wavBlob) {
      console.warn('[Kinetic Typography] Audio extraction failed. Groq path requires audio; falling back to basic timestamp estimation.');
      // Generate evenly-spaced timestamps as a fallback instead of crashing
      resultJsonStr = JSON.stringify(generateFallbackTypography(clip.duration, prompt));
    } else {
      const transcription = await transcribeAudioWithGroq(wavBlob);
      onProgress(65);

      const wordTimestamps = transcription.words
        ? JSON.stringify(transcription.words, null, 2)
        : JSON.stringify(transcription.segments || transcription.text, null, 2);

      const groqSystemPrompt = `You are a world-class Kinetic Typography Director.
You have precise word-level timestamps from Whisper transcription. Your job is to create stunning, emotionally expressive typography animations.
Rules:
- Use the Whisper timestamps as the SOURCE OF TRUTH for word timing.
- CRITICAL: You MUST generate EXACTLY ONE JSON object for EVERY SINGLE WORD present in the Whisper transcription. Do NOT skip any words. Do NOT group words. Missing words will break the video sync.
- Return ONLY a valid JSON array of word typography objects.
- Each object MUST have all required fields: text, start, end, fontSize, fontFamily, color, x, y, animationIn, animationOut, stylePreset.
- Do NOT include any text, explanation, or markdown outside the JSON array.

ANIMATION SELECTION GUIDE (pick cinematically for each word's emotional weight):
  Basic IN:  fadeIn, zoom, bounce, typewriter, slideUp, slideDown, slideLeft, slideRight
  Cinematic IN (PREFER for KEY/EMOTIONAL words):
    elastic      = spring overshoot pop (hype, energy, excitement words)
    splitReveal  = cinematic title scale-reveal (dramatic statements, main subjects)
    revealWipe   = curtain wipe left-to-right (announcements, reveals)
    rollUp       = hard film-credit roll from below (list items, credits)
    scaleFlip    = dramatic Y-snap pop (shock, surprise words)
    zoomBlur     = blockbuster zoom slam (openers, powerful verbs)
    glitch       = cyber XY jitter (tech, error, intensity, danger words)
    letterSpacing= letters expand from compressed (brand names, titles)
  OUT: fadeOut, zoom, slideUp/Down/Left/Right, elastic, splitReveal, revealWipe, rollUp, scaleFlip, zoomBlur, glitch, letterSpacing`;

      const groqUserPrompt = `${prompt}\n\n---\nWHISPER WORD TIMESTAMPS (use these for precise timing):\n${wordTimestamps}\n\nGenerate the kinetic typography JSON array now:`;

      resultJsonStr = await analyzeReasoningWithGroq(groqUserPrompt, groqSystemPrompt);
    }
    onProgress(85);
  } else {
    // Gemini path
    const { getLocalGeminiKey, getEnvGeminiKey } = await import('./apiKeyManager');
    const gKey = getLocalGeminiKey() || getEnvGeminiKey();
    if (!gKey) throw new Error('Gemini API Key is missing.');

    const contentsParts: any[] = [{ text: prompt }];

    // Add audio if extracted
    if (audioDataPart) {
      contentsParts.push({
        inlineData: { mimeType: 'audio/wav', data: audioDataPart }
      });
    }

    // Add frames
    for (const frame of frames) {
      const b64 = frame.replace(/^data:image\/(png|jpeg|webp);base64,/, '');
      contentsParts.push({
        inlineData: { mimeType: 'image/jpeg', data: b64 }
      });
    }

    const requestBody = {
      contents: [{ parts: contentsParts }],
      generationConfig: {
        temperature: 0.3,
        responseMimeType: "application/json"
      }
    };

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${gKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API Error: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    onProgress(85);

    resultJsonStr = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!resultJsonStr) {
      throw new Error('No valid response from Gemini.');
    }
  }

  resultJsonStr = resultJsonStr.replace(/^```(json)?/, '').replace(/```$/, '').trim();
  let typoResults = [];
  try {
    typoResults = JSON.parse(resultJsonStr);
  } catch(e) {
    throw new Error(`Failed to parse AI typography response: ${resultJsonStr}`);
  }

  // Post-processing of text to guarantee casing constraints and word-by-word split
  const processedClips: any[] = [];
  
  for (const item of typoResults) {
    const rawText = (item.text || '').trim();
    if (!rawText) continue;

    const words = rawText.split(/\s+/);
    const durationPerWord = (item.end - item.start) / Math.max(1, words.length);

    words.forEach((w: string, idx: number) => {
      let wordText = w;
      if (options.script === 'english' || options.script === 'roman_urdu_hindi') {
        if (activeCasing === 'all_caps') {
          wordText = wordText.toUpperCase();
        } else if (activeCasing === 'first_letter_caps') {
          wordText = wordText.charAt(0).toUpperCase() + wordText.slice(1).toLowerCase();
        }
      }

      // Override with user choices if specified
      const finalStyle = userStyle !== 'random' ? userStyle : (item.stylePreset || 'Bubble Caption');
      const finalAnimIn = userAnim !== 'random' ? userAnim : (item.animationIn || 'slideUp');

processedClips.push({
        ...item,
        text: wordText,
        stylePreset: finalStyle,
        animationIn: finalAnimIn,
        start: item.start + (idx * durationPerWord),
        end: item.start + ((idx + 1) * durationPerWord)
      });
    });
  }

  // 4. Generate clips according to selected typography mode (word, sentence, or hybrid)
  const typoMode = options.typoType || 'hybrid';
  const newClips: TimelineClip[] = [];
  const newPipWindowsMap: Record<string, PipWindow> = {};

  if (typoMode === 'word') {
    // ── Mode 1: Word by Word ───────────────────────────────────
    processedClips.forEach((item: any) => {
      const preset = TEXT_TEMPLATES.find(p => p.name.toLowerCase() === (item.stylePreset || '').toLowerCase());
      const fontSz = item.fontSize || 60;
      const fontFam = item.fontFamily || 'Anton';
      const clr = item.color || '#ffffff';

      const textSettings: any = {
        text: item.text,
        fontSize: preset ? (preset.settings.fontSize ? Math.round(preset.settings.fontSize * 0.9) : fontSz) : fontSz,
        fontFamily: preset?.settings.fontFamily || fontFam,
        color: preset?.settings.color || clr,
        backgroundColor: preset?.settings.backgroundColor || 'transparent',
        bold: preset ? (preset.settings.bold !== undefined ? preset.settings.bold : true) : true,
        italic: preset ? (preset.settings.italic || false) : false,
        underline: preset ? (preset.settings.underline || false) : false,
        shadow: preset ? (preset.settings.shadow !== undefined ? preset.settings.shadow : true) : true,
        shadowColor: preset?.settings.shadowColor || '#000000',
        shadowBlur: 10,
        textAlign: 'center',
        animation: {
          in: item.animationIn === 'pop' ? 'zoom' : (item.animationIn || 'slideUp'),
          out: item.animationOut || 'fadeOut',
          inDuration: 0.1,
          outDuration: 0.1
        }
      };

      if (preset?.settings.strokeColor) {
        textSettings.strokeColor = preset.settings.strokeColor;
        textSettings.strokeWidth = preset.settings.strokeWidth || 2;
      }

      newClips.push({
        id: uuidv4(),
        mediaId: 'generator:kinetic',
        trackId: '',
        startTime: clip.startTime + item.start,
        duration: Math.max(0.1, item.end - item.start),
        trimStart: 0,
        trimEnd: Math.max(0.1, item.end - item.start),
        opacity: 1,
        transform: { x: Math.round((item.x - 50) * 8.54), y: Math.round((item.y - 50) * 4.8), scale: 100, rotation: 0 },
        speed: 1,
        effects: [],
        textSettings
      });
    });
  } else if (typoMode === 'sentence') {
    // ── Mode 2: Sentence by Sentence ───────────────────────────
    const sentenceGroups: any[][] = [];
    let currentGrp: any[] = [];

    processedClips.forEach((w: any, idx: number) => {
      currentGrp.push(w);
      const endsPunct = /[.?!;:]$/.test(w.text);
      const nextW = processedClips[idx + 1];
      const pause = nextW ? (nextW.start - w.end) > 0.4 : true;
      const maxW = currentGrp.length >= 7;

      if (endsPunct || pause || maxW || idx === processedClips.length - 1) {
        sentenceGroups.push([...currentGrp]);
        currentGrp = [];
      }
    });

    sentenceGroups.forEach((grp) => {
      if (grp.length === 0) return;
      const sentenceText = grp.map(w => w.text).join(' ');
      const sStart = grp[0].start;
      const sEnd = grp[grp.length - 1].end;
      const sDuration = Math.max(0.2, sEnd - sStart);
      const firstW = grp[0];

      newClips.push({
        id: uuidv4(),
        mediaId: 'generator:kinetic-sentence',
        trackId: '',
        startTime: clip.startTime + sStart,
        duration: sDuration,
        trimStart: 0,
        trimEnd: sDuration,
        opacity: 1,
        transform: { x: 0, y: 0, scale: 100, rotation: 0 },
        speed: 1,
        effects: [],
        textSettings: {
          text: sentenceText,
          fontSize: 54,
          fontFamily: firstW.fontFamily || 'Inter',
          color: firstW.color || '#ffffff',
          backgroundColor: 'transparent',
          bold: true,
          italic: false,
          underline: false,
          shadow: true,
          shadowColor: '#000000',
          shadowBlur: 10,
          textAlign: 'center',
          animation: {
            in: firstW.animationIn || 'slideUp',
            out: 'fadeOut',
            inDuration: 0.15,
            outDuration: 0.15
          }
        }
      });
    });
  } else {
    // ── Mode 3: Hybrid (Complete Sentence via PiP Multi-Tracks) ──
    const sentenceGroups: any[][] = [];
    let currentGrp: any[] = [];

    processedClips.forEach((w: any, idx: number) => {
      currentGrp.push(w);
      const endsPunct = /[.?!;:]$/.test(w.text);
      const nextW = processedClips[idx + 1];
      const pause = nextW ? (nextW.start - w.end) > 0.4 : true;
      const maxW = currentGrp.length >= 8;

      if (endsPunct || pause || maxW || idx === processedClips.length - 1) {
        sentenceGroups.push([...currentGrp]);
        currentGrp = [];
      }
    });

    sentenceGroups.forEach((grp) => {
      if (grp.length === 0) return;
      const fullSentenceText = grp.map(w => w.text).join(' ');
      const sStart = grp[0].start;
      const sEnd = grp[grp.length - 1].end;
      const sDuration = Math.max(0.2, sEnd - sStart);

      const primaryClipId = uuidv4();
      const pipId = uuidv4();

      // Main timeline primary text container clip for this sentence
      const primaryClip: TimelineClip = {
        id: primaryClipId,
        mediaId: 'generator:kinetic-hybrid-sentence',
        trackId: '',
        startTime: clip.startTime + sStart,
        duration: sDuration,
        trimStart: 0,
        trimEnd: sDuration,
        opacity: 1,
        transform: { x: 0, y: 0, scale: 100, rotation: 0 },
        speed: 1,
        effects: [],
        pipWindowIds: [pipId],
        textSettings: {
          text: fullSentenceText,
          fontSize: 1,
          fontFamily: 'Inter',
          color: 'transparent',
          backgroundColor: 'transparent',
          bold: false,
          italic: false,
          underline: false,
          shadow: false,
          textAlign: 'center'
        }
      };
      newClips.push(primaryClip);

      // Create PiP window with multi-tracks for words
      const pipTracks: TimelineTrack[] = [];
      const newPip: PipWindow = {
        id: pipId,
        parentClipId: primaryClipId,
        relativeStartTime: 0,
        tracks: pipTracks,
        duration: sDuration,
        zIndex: Object.keys(store.pipWindows || {}).length + Object.keys(newPipWindowsMap).length + 1
      };

      // Smart Non-Overlapping Layout Calculation for Sentence Words
      const totalChars = fullSentenceText.length;
      const fontSize = Math.min(54, Math.max(36, Math.floor(680 / Math.max(1, totalChars * 0.52))));
      const charWidth = fontSize * 0.52;
      const spaceWidth = fontSize * 0.35;
      const lineHeight = fontSize * 1.35;
      const maxLineWidth = 720; // max line width inside canvas

      const lines: { word: any; width: number }[][] = [[]];
      let currentLineWidth = 0;

      grp.forEach((w) => {
        const wWidth = Math.round(w.text.length * charWidth);
        if (lines[lines.length - 1].length > 0 && currentLineWidth + spaceWidth + wWidth > maxLineWidth) {
          lines.push([]);
          currentLineWidth = 0;
        }
        lines[lines.length - 1].push({ word: w, width: wWidth });
        currentLineWidth += (lines[lines.length - 1].length === 1 ? 0 : spaceWidth) + wWidth;
      });

      const totalSentenceHeight = lines.length * lineHeight;
      const startY = -totalSentenceHeight / 2 + lineHeight / 2;

      lines.forEach((line, lineIdx) => {
        const lineW = line.reduce((sum, item) => sum + item.width, 0) + (line.length - 1) * spaceWidth;
        let currentX = -lineW / 2;
        const lineY = Math.round(startY + lineIdx * lineHeight);

        line.forEach(({ word, width }) => {
          const posX = Math.round(currentX + width / 2);
          const posY = lineY;
          currentX += width + spaceWidth;

          const wordRelStart = Math.max(0, word.start - sStart);
          // CRITICAL: End time inside PiP equals sentence duration (so words remain visible until sentence ends)
          const wordDuration = Math.max(0.1, sDuration - wordRelStart);

          const preset = TEXT_TEMPLATES.find(p => p.name.toLowerCase() === (word.stylePreset || '').toLowerCase());
          const wordColor = preset?.settings.color || word.color || '#fbbf24';

          const wordClip: TimelineClip = {
            id: uuidv4(),
            mediaId: 'generator:kinetic-word',
            trackId: '',
            startTime: wordRelStart,
            duration: wordDuration,
            trimStart: 0,
            trimEnd: wordDuration,
            opacity: 1,
            transform: {
              x: posX,
              y: posY,
              scale: 100,
              rotation: 0
            },
            speed: 1,
            effects: [],
            animations: {
              'transform.scale': [
                { time: 0, value: 135, easing: 'easeOut' },
                { time: 0.12, value: 100, easing: 'easeOut' }
              ],
              'opacity': [
                { time: 0, value: 0, easing: 'linear' },
                { time: 0.06, value: 1, easing: 'linear' }
              ]
            },
            textSettings: {
              text: word.text,
              fontSize: fontSize,
              fontFamily: preset?.settings.fontFamily || word.fontFamily || 'Inter',
              color: wordColor,
              backgroundColor: 'transparent',
              bold: true,
              italic: false,
              underline: false,
              shadow: true,
              shadowColor: '#000000',
              shadowBlur: 12,
              textAlign: 'center',
              animation: {
                in: word.animationIn || 'bounce',
                out: 'fadeOut',
                inDuration: 0.1,
                outDuration: 0.1
              }
            }
          };

          const pTrackId = uuidv4();
          wordClip.trackId = pTrackId;
          pipTracks.push({
            id: pTrackId,
            name: `Word (${word.text})`,
            type: 'text',
            clips: [wordClip],
            locked: false,
            muted: false,
            hidden: false
          });
        });
      });

      newPipWindowsMap[pipId] = newPip;
    });
  }

  // Find or create a text track on the main timeline
  let textTrack = store.tracks.find(t => t.type === 'text' && !t.hidden);
  let newTracks = [...store.tracks];

  if (textTrack) {
    const updatedTrack = {
      ...textTrack,
      clips: [...textTrack.clips, ...newClips.map(c => ({...c, trackId: textTrack!.id}))]
    };
    newTracks = newTracks.map(t => t.id === textTrack!.id ? updatedTrack : t);
  } else {
    const newTrackId = uuidv4();
    const newTrack = {
      id: newTrackId,
      name: 'Kinetic Typography',
      type: 'text' as const,
      locked: false,
      muted: false,
      hidden: false,
      clips: newClips.map(c => ({...c, trackId: newTrackId})),
    };
    newTracks.push(newTrack);
  }

  const updatedPipWindows = {
    ...(store.pipWindows || {}),
    ...newPipWindowsMap
  };

  useEditorStore.setState({ tracks: newTracks, pipWindows: updatedPipWindows });
  onProgress(100);
}

/**
 * Generates evenly-spaced placeholder word entries as a fallback when audio is unavailable.
 */
function generateFallbackTypography(duration: number, _prompt: string): any[] {
  // Estimate ~3 words per second for a typical speaker
  const estimatedWords = Math.max(3, Math.round(duration * 2.5));
  const wordDuration = duration / estimatedWords;
  const placeholderStyles = ['Bouncy Pop', 'Cyber Neon', 'Yellow Warning', 'Golden Glow', 'Bubble Caption'];
  const animations = ['zoom', 'slideUp', 'bounce', 'fadeIn', 'slideRight'];
  const colors = ['#fbbf24', '#22d3ee', '#f43f5e', '#a855f7', '#22c55e'];
  const fonts = ['Anton', 'Bebas Neue', 'Impact', 'Inter', 'Outfit'];

  return Array.from({ length: estimatedWords }, (_, i) => ({
    text: '...',
    start: i * wordDuration,
    end: (i + 1) * wordDuration,
    fontSize: 70,
    fontFamily: fonts[i % fonts.length],
    color: colors[i % colors.length],
    x: 35 + (i % 5) * 8,
    y: 45 + (i % 3) * 8,
    animationIn: animations[i % animations.length],
    animationOut: 'fadeOut',
    stylePreset: placeholderStyles[i % placeholderStyles.length]
  }));
}

async function extractClipAudio(mediaUrl: string, trimStart: number, duration: number): Promise<Blob | null> {
  try {
    const audioCtx = new AudioContext();
    const resp = await fetch(mediaUrl);
    const arrayBuf = await resp.arrayBuffer();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuf);

    const SAMPLE_RATE = 16000;
    const offlineCtx = new OfflineAudioContext(1, SAMPLE_RATE * duration, SAMPLE_RATE);

    const source = offlineCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineCtx.destination);
    source.start(0, trimStart, duration);

    const renderedBuffer = await offlineCtx.startRendering();
    audioCtx.close();
    
    return audioBufferToWav(renderedBuffer);
  } catch (e) {
    console.warn('Could not extract audio for clip, returning null', e);
    return null;
  }
}

function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const bufferArray = new ArrayBuffer(length);
  const view = new DataView(bufferArray);
  const channels = [];
  let offset = 0;
  let pos = 0;

  function setUint16(data: number) { view.setUint16(pos, data, true); pos += 2; }
  function setUint32(data: number) { view.setUint32(pos, data, true); pos += 4; }

  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8); // file length - 8
  setUint32(0x45564157); // "WAVE"

  setUint32(0x20746d66); // "fmt " chunk
  setUint32(16);         // length = 16
  setUint16(1);          // PCM (uncompressed)
  setUint16(numOfChan);
  setUint32(buffer.sampleRate);
  setUint32(buffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
  setUint16(numOfChan * 2);                      // block-align
  setUint16(16);                                 // 16-bit

  setUint32(0x61746164); // "data" - chunk
  setUint32(length - pos - 4); // chunk length

  for (let i = 0; i < buffer.numberOfChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  while (pos < length) {
    for (let i = 0; i < numOfChan; i++) {
      let sample = Math.max(-1, Math.min(1, channels[i][offset]));
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
      view.setInt16(pos, sample, true);
      pos += 2;
    }
    offset++;
  }

  return new Blob([bufferArray], { type: 'audio/wav' });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
