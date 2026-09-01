import { useEditorStore } from '@/store/editorStore';
import { getGeminiKey } from './aiClient';
import { renderTimelineAudioToWav, blobToBase64 } from './autoCaptions';
import { TimelineClip } from '@/types';
import { extractJsonFromLlmResponse } from './jsonHelper';

const uuidv4 = () => crypto.randomUUID();

// ─── Helpers ──────────────────────────────────────────────────────────────

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
}

function textSimilarity(a: string, b: string): number {
  const wordsA = normalizeText(a).split(' ').filter(Boolean);
  const wordsB = normalizeText(b).split(' ').filter(Boolean);
  if (wordsA.length === 0 && wordsB.length === 0) return 1;
  if (wordsA.length === 0 || wordsB.length === 0) return 0;
  const setB = new Set(wordsB);
  const overlap = wordsA.filter(w => setB.has(w)).length;
  return overlap / Math.max(wordsA.length, wordsB.length);
}

async function callGemini(apiKey: string, parts: any[], temperature = 0.1): Promise<string> {
  const requestBody = {
    contents: [{ parts }],
    generationConfig: { temperature, responseMimeType: "application/json" }
  };

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API Error: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  const resultStr = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!resultStr) throw new Error('No valid response from Gemini.');
  
  return extractJsonFromLlmResponse(resultStr);
}

// ─── Types ────────────────────────────────────────────────────────────────

interface TtsSentence {
  sentenceId: string;
  text: string;
  start: number;
  end: number;
  words: { word: string; start: number; end: number }[];
}

interface SyncCorrection {
  sentenceId: string;
  newTtsStart?: number;
  newTtsEnd?: number;
  issue?: string;
}

// ─── Main Export ──────────────────────────────────────────────────────────

export async function syncAiVoiceToSubtitles(
  targetTrackId: string,
  language: string,
  onProgress: (p: number, phase?: string) => void,
  referenceScript?: string
): Promise<void> {
  const store = useEditorStore.getState();
  const apiKey = getGeminiKey();

  if (!apiKey) throw new Error('Gemini API Key is missing.');

  const targetTrack = store.tracks.find(t => t.id === targetTrackId);
  if (!targetTrack || targetTrack.clips.length === 0) throw new Error('Selected track is empty or not found.');

  const originalSubtitles = store.subtitles;
  if (originalSubtitles.length === 0) throw new Error('No subtitles found. Generate Auto-Captions first.');

  const totalDuration = store.totalDuration || 10;

  // ─── Phase 1: Transcribe TTS Audio ─────────────────────────────────
  onProgress(5, 'Extracting audio...');

  const wavBlob = await renderTimelineAudioToWav([targetTrack], totalDuration, store.mediaLibrary, (p) => {
    onProgress(5 + p * 0.2, 'Extracting audio...');
  });
  if (!wavBlob) throw new Error('Failed to extract audio from the selected track.');

  const base64Audio = await blobToBase64(wavBlob);
  const dataPart = base64Audio.split(',')[1] || base64Audio;

  onProgress(30, 'Transcribing TTS audio...');

  const sentenceReference = originalSubtitles.map((sub, i) => ({
    sentenceId: sub.sentenceId || `S${i + 1}`,
    text: sub.text
  }));

  const phase1Prompt = `You are a professional audio transcription and alignment assistant.
I have provided an audio track containing a TTS (text-to-speech) voiceover.

The voiceover was generated from the following script sentences. Your job is to listen to the audio and find EXACTLY where each sentence starts and ends in the audio, plus word-level timestamps.

SENTENCE REFERENCE (in order):
${JSON.stringify(sentenceReference, null, 2)}

IMPORTANT RULES:
- Match each sentence from the reference to its spoken location in the audio.
- Use the same sentenceId values from the reference.
- If a sentence is not found in the audio, still include it with start=0 and end=0.
- Provide precise word-level timestamps for each sentence.
- The audio language is "${language}".

Return ONLY a JSON array of sentence objects:
[
  {
    "sentenceId": "S1",
    "text": "The sentence text",
    "start": 0.0,
    "end": 3.5,
    "words": [
      { "word": "The", "start": 0.0, "end": 0.3 }
    ]
  }
]

Start and end are floating point seconds. Do not include markdown.`;

  const phase1Result = await callGemini(apiKey, [
    { text: phase1Prompt },
    { inlineData: { mimeType: 'audio/wav', data: dataPart } }
  ]);

  const ttsSentences: TtsSentence[] = JSON.parse(phase1Result);
  if (!Array.isArray(ttsSentences)) throw new Error('Phase 1 failed: Invalid TTS transcription.');

  onProgress(55, 'Aligning sentences (Smart Split)...');

  // ─── Phase 2: Sentence-Level Slicing & Alignment ───────────────────

  const ttsMap = new Map<string, TtsSentence>();
  for (const ts of ttsSentences) {
    ttsMap.set(ts.sentenceId, ts);
  }

  const sourceClip = targetTrack.clips[0];
  const newClips: TimelineClip[] = [];

  // SMART SPLIT LOGIC: Group contiguous sentences that share the same pacing.
  let currentBlock: {
    firstSubStart: number;
    firstTtsStart: number;
    lastTtsEnd: number;
    sentences: { sub: any, tts: TtsSentence }[];
  } | null = null;

  const flushBlock = () => {
    if (!currentBlock) return;
    
    // Natural duration of this TTS block
    const ttsDuration = Math.max(0.05, currentBlock.lastTtsEnd - currentBlock.firstTtsStart);
    
    const newClip: TimelineClip = {
      ...sourceClip,
      id: uuidv4(),
      startTime: currentBlock.firstSubStart,
      duration: ttsDuration, // Play at natural speed!
      trimStart: currentBlock.firstTtsStart,
      speed: 1.0, // DO NOT stretch the audio
      audioSettings: {
        volume: 0, pan: 0, fadeIn: 0, fadeOut: 0, bass: 0, treble: 0, muted: false, pitch: 0, voiceFormant: 0, humanize: false,
        ...(sourceClip.audioSettings || {}),
        preservePitch: true
      } as any
    };
    newClips.push(newClip);
    currentBlock = null;
  };

  const MAX_SYNC_DRIFT = 0.5; // seconds (if TTS drifts by more than 500ms from subtitles, we split)

  for (let i = 0; i < originalSubtitles.length; i++) {
    const sub = originalSubtitles[i];
    const subSentenceId = sub.sentenceId || `S${i + 1}`;

    let matched = ttsMap.get(subSentenceId);
    if (!matched) {
      let bestScore = 0;
      for (const ts of ttsSentences) {
        const score = textSimilarity(sub.text, ts.text);
        if (score > bestScore) {
          bestScore = score;
          matched = ts;
        }
      }
      if (bestScore < 0.3) matched = undefined;
    }

    if (!matched || (matched.start === 0 && matched.end === 0)) {
      continue; // Skip silently if not found
    }

    if (!currentBlock) {
      // Start a new block
      currentBlock = {
        firstSubStart: sub.startTime,
        firstTtsStart: matched.start,
        lastTtsEnd: matched.end,
        sentences: [{ sub, tts: matched }]
      };
    } else {
      // Check if we should append to current block or split
      const subGap = sub.startTime - currentBlock.firstSubStart;
      const ttsGap = matched.start - currentBlock.firstTtsStart;
      const drift = Math.abs(subGap - ttsGap);

      if (drift > MAX_SYNC_DRIFT) {
        // Significant pacing drift -> SPLIT the audio here
        flushBlock();
        currentBlock = {
          firstSubStart: sub.startTime,
          firstTtsStart: matched.start,
          lastTtsEnd: matched.end,
          sentences: [{ sub, tts: matched }]
        };
      } else {
        // Pacing matches nicely -> APPEND to block
        currentBlock.lastTtsEnd = matched.end;
        currentBlock.sentences.push({ sub, tts: matched });
      }
    }
  }
  
  // Flush final block
  flushBlock();

  if (newClips.length === 0) throw new Error('No sentences could be matched between subtitles and TTS audio.');

  // Apply initial placement
  const updatedTracks = store.tracks.map(t =>
    t.id === targetTrackId ? { ...t, clips: newClips } : t
  );
  useEditorStore.setState({ tracks: updatedTracks });

  onProgress(75, 'Verifying sync...');

  // ─── Phase 3: AI Verification Pass ─────────────────────────────────
  const alignmentSummary = newClips.map((clip, i) => {
    return {
      clipIndex: i,
      ttsStart: clip.trimStart,
      ttsDuration: clip.duration,
      timelineStart: clip.startTime
    };
  });

  const phase3Prompt = `You are an audio-sync verification assistant.
I have aligned TTS audio clips to subtitle timestamps. Below is the alignment summary.

ALIGNMENT:
${JSON.stringify(alignmentSummary, null, 2)}

Please verify each alignment. Check if no two clips overlap on the timeline.
If everything looks correct, return: { "status": "ok", "corrections": [] }
If any clips overlap, return: { "status": "needs_correction", "corrections": [ { "clipIndex": 1, "newTimelineStart": 5.2 } ] }
Return ONLY valid JSON.`;

  try {
    const phase3Result = await callGemini(apiKey, [{ text: phase3Prompt }]);
    const verification = JSON.parse(phase3Result);

    if (verification.status === 'needs_correction' && Array.isArray(verification.corrections)) {
      const corrections = verification.corrections;
      if (corrections.length > 0) {
        onProgress(85, `Applying ${corrections.length} overlap corrections...`);
        const correctedClips = [...newClips];
        for (const fix of corrections) {
          if (fix.clipIndex !== undefined && fix.newTimelineStart !== undefined && correctedClips[fix.clipIndex]) {
            correctedClips[fix.clipIndex] = { ...correctedClips[fix.clipIndex], startTime: fix.newTimelineStart };
          }
        }
        const finalTracks = useEditorStore.getState().tracks.map(t =>
          t.id === targetTrackId ? { ...t, clips: correctedClips } : t
        );
        useEditorStore.setState({ tracks: finalTracks });
      }
    }
  } catch (verifyErr) {
    console.warn('Phase 3 verification failed (non-critical):', verifyErr);
  }

  onProgress(100, 'Sync complete!');
}
