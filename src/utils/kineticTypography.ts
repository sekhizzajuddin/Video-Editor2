import { TimelineClip, TimelineTrack, PipWindow } from '@/types';
import { useEditorStore } from '@/store/editorStore';
import { extractFramesFromVideo } from './frameExtractor';
import { TEXT_TEMPLATES } from './textTemplates';
import { transcribeAudioWithGroq, analyzeReasoningWithGroq } from './groqClient';
import { scheduleSaveSnapshot } from './snapshotScheduler';

import { fetchWithKeyFailover } from './apiKeyManager';

const uuidv4 = () => crypto.randomUUID();

export interface KineticTypographyOptions {
  script: string;
  englishCasing?: 'all_caps' | 'first_letter_caps' | 'none';
  casing?: 'all_caps' | 'first_letter_caps' | 'none';
  styleSelection?: string;
  animationSelection?: string;
  provider?: 'gemini' | 'groq';
  typoType?: 'word' | 'sentence' | 'hybrid';
  typoLayout?: 'row' | 'column';
  referenceScript?: string;
  customPrompt?: string;
  backgroundSelection?: string;
  pipBackgroundArea?: boolean;
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

  const CHUNK_DURATION = 15;
  const numChunks = Math.ceil(clip.duration / CHUNK_DURATION);
  let allTypoResults: any[] = [];

  let activeCasing = options.casing || 'first_letter_caps';
  const userStyle = options.styleSelection || 'random';
  const userAnim = options.animationSelection || 'random';


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

    activeCasing = options.casing || 'first_letter_caps';
    let casingInstruction = "Use natural casing (e.g., 'Hello world', 'I love it').";
    if (activeCasing === 'all_caps') casingInstruction = "OUTPUT ALL TEXT IN ALL CAPS (e.g. 'HELLO WORLD').";

    if (activeCasing === 'first_letter_caps') casingInstruction = "Capitalize The First Letter Of Every Word (e.g. 'Hello World').";

    const customPromptText = options.customPrompt?.trim() || "";
    const customPromptInstruction = customPromptText 
      ? `\n>>> USER CUSTOM INSTRUCTION (MANDATORY HIGHEST PRIORITY): <<<\n"${customPromptText}"\n>>> YOU MUST APPLY THIS CUSTOM INSTRUCTION ACROSS ALL GENERATED WORDS AND ANIMATIONS <<<\n`
      : "";




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
${options.pipBackgroundArea ? 'BACKGROUND PREFERENCE: DO NOT generate any backgroundColor or backgroundStyle for the individual words. It will be handled globally.' : (options.backgroundSelection && options.backgroundSelection !== 'random' && options.backgroundSelection !== 'none' ? `BACKGROUND PREFERENCE: You MUST use the "${options.backgroundSelection}" backgroundStyle for the words.` : (options.backgroundSelection === 'none' ? 'BACKGROUND PREFERENCE: DO NOT use any backgroundStyle.' : ''))}


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

        const groqUserPrompt = `${prompt}

---
WHISPER WORD TIMESTAMPS (use these for precise timing):
${wordTimestamps}

${customPromptText ? `REMINDER OF USER CUSTOM INSTRUCTION (strictly apply this):
"${customPromptText}"

` : ''}Generate the kinetic typography JSON array now:`;

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
            text: `You are a Kinetic Typography Director. Generate word-by-word JSON typography objects matching speech timing.
${customPromptInstruction}`
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


  const processedClips: any[] = [];
  
  for (const item of allTypoResults) {
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
      
      const fontSz = item.fontSize || (preset?.settings.fontSize ? Math.round(preset.settings.fontSize * 1.1) : 60);
      const fontFam = item.fontFamily || preset?.settings.fontFamily || 'Anton';
      const clr = item.color || preset?.settings.color || '#ffffff';
      const bgClr = item.backgroundColor || preset?.settings.backgroundColor || 'transparent';
      const bgStyle = item.backgroundStyle || preset?.settings.backgroundStyle;
      const strkClr = item.strokeColor || preset?.settings.strokeColor;
      const strkWidth = item.strokeWidth !== undefined ? item.strokeWidth : (preset?.settings.strokeWidth || (strkClr ? 2 : 0));
      const shdw = item.shadow !== undefined ? item.shadow : (preset?.settings.shadow !== undefined ? preset.settings.shadow : true);
      const shdwClr = item.shadowColor || preset?.settings.shadowColor || '#000000';
      const shdwBlur = item.shadowBlur !== undefined ? item.shadowBlur : (preset?.settings.shadowBlur || 10);
      const isBold = item.bold !== undefined ? item.bold : (preset?.settings.bold !== undefined ? preset.settings.bold : true);
      const isItalic = item.italic !== undefined ? item.italic : (preset?.settings.italic || false);
      const isUnderline = item.underline !== undefined ? item.underline : (preset?.settings.underline || false);
      const rotation = item.rotation || 0;

      const textSettings: any = {
        text: item.text,
        fontSize: fontSz,
        fontFamily: fontFam,
        color: clr,
        backgroundColor: bgClr,
        backgroundStyle: bgStyle,
        bold: isBold,
        italic: isItalic,
        underline: isUnderline,
        shadow: shdw,
        shadowColor: shdwClr,
        shadowBlur: shdwBlur,
        textAlign: 'center',
        animation: {
          in: item.animationIn === 'pop' ? 'zoom' : (item.animationIn || preset?.settings.animationPreset || 'slideUp'),
          out: item.animationOut || 'fadeOut',
          inDuration: 0.1,
          outDuration: 0.1
        }
      };

      if (strkClr) {
        textSettings.strokeColor = strkClr;
        textSettings.strokeWidth = strkWidth;
      }

      const posX = Math.round(((item.x !== undefined ? item.x : 50) - 50) * 8.54);
      const posY = Math.round(((item.y !== undefined ? item.y : 50) - 50) * 4.8);

      newClips.push({
        id: uuidv4(),
        mediaId: 'generator:kinetic',
        trackId: '',
        startTime: clip.startTime + item.start,
        duration: Math.max(0.1, item.end - item.start),
        trimStart: 0,
        trimEnd: Math.max(0.1, item.end - item.start),
        opacity: 1,
        transform: { x: posX, y: posY, scale: 100, rotation: rotation },
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
      const preset = TEXT_TEMPLATES.find(p => p.name.toLowerCase() === (firstW.stylePreset || '').toLowerCase());

      const avgX = grp.reduce((sum, w) => sum + (typeof w.x === 'number' ? w.x : (firstW.x ?? 50)), 0) / grp.length;
      const avgY = grp.reduce((sum, w) => sum + (typeof w.y === 'number' ? w.y : (firstW.y ?? 75)), 0) / grp.length;
      const posX = Math.round((avgX - 50) * 8.54);
      const posY = Math.round((avgY - 50) * 4.8);

      const fontSz = firstW.fontSize || 54;
      const fontFam = firstW.fontFamily || preset?.settings.fontFamily || 'Inter';
      const clr = firstW.color || preset?.settings.color || '#ffffff';
      const bgClr = firstW.backgroundColor || preset?.settings.backgroundColor || 'transparent';
      const bgStyle = firstW.backgroundStyle || preset?.settings.backgroundStyle;
      const strkClr = firstW.strokeColor || preset?.settings.strokeColor;
      const strkWidth = firstW.strokeWidth !== undefined ? firstW.strokeWidth : (preset?.settings.strokeWidth || (strkClr ? 2 : 0));
      const shdw = firstW.shadow !== undefined ? firstW.shadow : (preset?.settings.shadow !== undefined ? preset.settings.shadow : true);
      const shdwClr = firstW.shadowColor || preset?.settings.shadowColor || '#000000';
      const shdwBlur = firstW.shadowBlur !== undefined ? firstW.shadowBlur : (preset?.settings.shadowBlur || 10);
      const rotation = firstW.rotation || 0;

      const textSettings: any = {
        text: sentenceText,
        fontSize: fontSz,
        fontFamily: fontFam,
        color: clr,
        backgroundColor: bgClr,
        backgroundStyle: bgStyle,
        bold: firstW.bold !== undefined ? firstW.bold : true,
        italic: firstW.italic !== undefined ? firstW.italic : false,
        underline: firstW.underline !== undefined ? firstW.underline : false,
        shadow: shdw,
        shadowColor: shdwClr,
        shadowBlur: shdwBlur,
        textAlign: 'center',
        animation: {
          in: firstW.animationIn === 'pop' ? 'zoom' : (firstW.animationIn || 'slideUp'),
          out: firstW.animationOut || 'fadeOut',
          inDuration: 0.15,
          outDuration: 0.15
        }
      };

      if (strkClr) {
        textSettings.strokeColor = strkClr;
        textSettings.strokeWidth = strkWidth;
      }

      newClips.push({
        id: uuidv4(),
        mediaId: 'generator:kinetic-sentence',
        trackId: '',
        startTime: clip.startTime + sStart,
        duration: sDuration,
        trimStart: 0,
        trimEnd: sDuration,
        opacity: 1,
        transform: { x: posX, y: posY, scale: 100, rotation: rotation },
        speed: 1,
        effects: [],
        textSettings
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

      // Compute sentence container center position from AI word x,y positions
      const firstW = grp[0];
      const avgX = grp.reduce((sum, w) => sum + (typeof w.x === 'number' ? w.x : (firstW.x ?? 50)), 0) / grp.length;
      const avgY = grp.reduce((sum, w) => sum + (typeof w.y === 'number' ? w.y : (firstW.y ?? 50)), 0) / grp.length;
      const containerX = Math.round((avgX - 50) * 8.54);
      const containerY = Math.round((avgY - 50) * 4.8);

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
        transform: { x: containerX, y: containerY, scale: 100, rotation: 0 },
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
      const isColumn = options.typoLayout === 'column';
      const maxLineWidth = isColumn ? 420 : 860; // constrain width based on layout
      
      const totalChars = fullSentenceText.length;
      let baseFontSize = 54;
      if (isColumn) {
        baseFontSize = Math.min(68, Math.max(42, Math.floor(500 / Math.max(1, totalChars * 0.4))));
      } else {
        baseFontSize = Math.min(54, Math.max(36, Math.floor(760 / Math.max(1, totalChars * 0.52))));
      }
      
      const charWidth = baseFontSize * 0.65;
      const spaceWidth = baseFontSize * 0.4;
      const lineHeight = baseFontSize * 1.35;

      const lines: { word: any; width: number }[][] = [[]];
      let currentLineWidth = 0;

      grp.forEach((w) => {
        const prevWordInLine = lines[lines.length - 1].length > 0 ? lines[lines.length - 1][lines[lines.length - 1].length - 1].word : null;
        const wWidth = Math.round(w.text.length * charWidth);
        const aiBreak = prevWordInLine && prevWordInLine.breakAfter === true;
        const widthExceeded = currentLineWidth + spaceWidth + wWidth > maxLineWidth;
        
        if (lines[lines.length - 1].length > 0 && (widthExceeded || aiBreak)) {
          lines.push([]);
          currentLineWidth = 0;
        }
        lines[lines.length - 1].push({ word: w, width: wWidth });
        currentLineWidth += (lines[lines.length - 1].length === 1 ? 0 : spaceWidth) + wWidth;
      });

      const totalSentenceHeight = lines.length * lineHeight;
      const startY = -totalSentenceHeight / 2 + lineHeight / 2;


      // Record the authored line arrangement on the container so later resizes
      // reproduce it exactly instead of re-deriving it from word positions.
      (primaryClip as any).kineticLineStructure = lines.map((l) => l.length);

if (options.pipBackgroundArea) {
        if (!primaryClip.textSettings) primaryClip.textSettings = {} as any;
        primaryClip.textSettings!.text = lines.map(l => l.map(item => item.word.text).join(' ')).join('\n');
        primaryClip.textSettings!.fontSize = baseFontSize;
        primaryClip.textSettings!.color = 'transparent';
        primaryClip.textSettings!.backgroundColor = 'rgba(0,0,0,0.8)';
        primaryClip.textSettings!.backgroundStyle = (options.backgroundSelection && options.backgroundSelection !== 'none' && options.backgroundSelection !== 'random') ? options.backgroundSelection : 'solid_pill';
        primaryClip.textSettings!.fontFamily = grp[0].fontFamily || 'Inter';
      }


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
          const wordColor = word.color || preset?.settings.color || '#fbbf24';
          const wordFontFamily = word.fontFamily || preset?.settings.fontFamily || 'Inter';
          const wordFontSize = word.fontSize || baseFontSize;
          const wordBgColor = word.backgroundColor || preset?.settings.backgroundColor || 'transparent';
          const wordBgStyle = word.backgroundStyle || preset?.settings.backgroundStyle;
          const wordStrokeColor = word.strokeColor || preset?.settings.strokeColor;
          const wordStrokeWidth = word.strokeWidth !== undefined ? word.strokeWidth : (preset?.settings.strokeWidth || (wordStrokeColor ? 2 : 0));
          const wordShadow = word.shadow !== undefined ? word.shadow : (preset?.settings.shadow !== undefined ? preset.settings.shadow : true);
          const wordShadowColor = word.shadowColor || preset?.settings.shadowColor || '#000000';
          const wordShadowBlur = word.shadowBlur !== undefined ? word.shadowBlur : (preset?.settings.shadowBlur || 12);
          const wordBold = word.bold !== undefined ? word.bold : (preset?.settings.bold !== undefined ? preset.settings.bold : true);
          const wordItalic = word.italic !== undefined ? word.italic : (preset?.settings.italic || false);
          const wordUnderline = word.underline !== undefined ? word.underline : (preset?.settings.underline || false);
          const rotation = word.rotation || 0;

          const wordTextSettings: any = {
            text: word.text,
            fontSize: wordFontSize,
            fontFamily: wordFontFamily,
            color: wordColor,
            backgroundColor: wordBgColor,
            backgroundStyle: wordBgStyle,
            bold: wordBold,
            italic: wordItalic,
            underline: wordUnderline,
            shadow: wordShadow,
            shadowColor: wordShadowColor,
            shadowBlur: wordShadowBlur,
            textAlign: 'center',
            animation: {
              in: word.animationIn === 'pop' ? 'zoom' : (word.animationIn || 'bounce'),
              out: word.animationOut || 'fadeOut',
              inDuration: 0.1,
              outDuration: 0.1
            }
          };

          if (wordStrokeColor) {
            wordTextSettings.strokeColor = wordStrokeColor;
            wordTextSettings.strokeWidth = wordStrokeWidth;
          }

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
              rotation: rotation
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
            textSettings: wordTextSettings
          };

          const pTrackId = uuidv4();
          wordClip.trackId = pTrackId;

          const activeDuration = Math.max(0.1, word.end - word.start);

          if (activeDuration < wordDuration - 0.05) {
            wordClip.duration = activeDuration;
            wordClip.trimEnd = activeDuration;
            
            const inactiveClip: TimelineClip = JSON.parse(JSON.stringify(wordClip));
            inactiveClip.id = uuidv4();
            inactiveClip.startTime = wordRelStart + activeDuration;
            inactiveClip.duration = wordDuration - activeDuration;
            inactiveClip.trimEnd = inactiveClip.duration;
            if (inactiveClip.textSettings) {
              inactiveClip.textSettings.color = '#ffffff'; 
              if (inactiveClip.textSettings.backgroundColor && inactiveClip.textSettings.backgroundColor !== 'transparent') {
                 inactiveClip.textSettings.backgroundColor = 'rgba(0,0,0,0.5)';
              }
            }
            inactiveClip.animations = {}; 
            
            pipTracks.push({
              id: pTrackId,
              name: `Word (${word.text})`,
              type: 'text',
              clips: [wordClip, inactiveClip],
              locked: false,
              muted: false,
              hidden: false
            });
          } else {
            pipTracks.push({
              id: pTrackId,
              name: `Word (${word.text})`,
              type: 'text',
              clips: [wordClip],
              locked: false,
              muted: false,
              hidden: false
            });
          }
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
  scheduleSaveSnapshot('Generate Kinetic Typography');
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
