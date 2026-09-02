import { useEditorStore } from '@/store/editorStore';
import { getGeminiKey } from './aiClient';
import { renderTimelineAudioToWav, blobToBase64 } from './autoCaptions';
import { TimelineClip, SubtitleItem } from '@/types';
import { extractJsonFromLlmResponse } from './jsonHelper';

const uuidv4 = () => crypto.randomUUID();

function cleanWord(w: string): string {
  return w.replace(/[،۔؟.,!]/g, "").trim().toLowerCase();
}

interface WordToken {
  word: string;
  raw: string;
  start: number;
  end: number;
}

function extractWordList(items: { words?: { word: string; start: number; end: number }[] }[]): WordToken[] {
  const list: WordToken[] = [];
  for (const item of items) {
    if (!item.words) continue;
    for (const w of item.words) {
      const cw = cleanWord(w.word);
      if (cw) {
        list.push({ word: cw, raw: w.word, start: w.start, end: w.end });
      }
    }
  }
  return list;
}

interface MatchBlock {
  aIndex: number;
  bIndex: number;
  length: number;
}

function getMatchingBlocks(a: string[], b: string[]): MatchBlock[] {
  function findLongestMatch(aStart: number, aEnd: number, bStart: number, bEnd: number) {
    let maxLen = 0;
    let bestA = aStart;
    let bestB = bStart;

    for (let i = aStart; i < aEnd; i++) {
      for (let j = bStart; j < bEnd; j++) {
        if (a[i] === b[j]) {
          let k = 1;
          while (i + k < aEnd && j + k < bEnd && a[i + k] === b[j + k]) {
            k++;
          }
          if (k > maxLen) {
            maxLen = k;
            bestA = i;
            bestB = j;
          }
        }
      }
    }
    return { bestA, bestB, maxLen };
  }

  const blocks: MatchBlock[] = [];
  function recurse(aStart: number, aEnd: number, bStart: number, bEnd: number) {
    const { bestA, bestB, maxLen } = findLongestMatch(aStart, aEnd, bStart, bEnd);
    if (maxLen > 0) {
      recurse(aStart, bestA, bStart, bestB);
      blocks.push({ aIndex: bestA, bIndex: bestB, length: maxLen });
      recurse(bestA + maxLen, aEnd, bestB + maxLen, bEnd);
    }
  }

  recurse(0, a.length, 0, b.length);
  return blocks.sort((x, y) => x.aIndex - y.aIndex);
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

interface TtsSentence {
  sentenceId: string;
  text: string;
  start: number;
  end: number;
  words: { word: string; start: number; end: number }[];
}

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

  onProgress(30, 'Transcribing TTS audio for word-level timestamps...');

  const sentenceReference = originalSubtitles.map((sub, i) => ({
    sentenceId: sub.sentenceId || `S${i + 1}`,
    text: sub.text
  }));

  const phase1Prompt = `You are a professional audio transcription and alignment assistant.
I have provided an audio track containing a TTS (text-to-speech) voiceover.

The voiceover was generated from the following script sentences. Your job is to listen to the audio and find EXACTLY where each sentence starts and ends in the audio, plus precise word-level timestamps.

SENTENCE REFERENCE (in order):
${JSON.stringify(sentenceReference, null, 2)}

IMPORTANT RULES:
- Match each sentence from the reference to its spoken location in the audio.
- Use the same sentenceId values from the reference.
- If a sentence is not found in the audio, still include it with start=0 and end=0.
- Provide PRECISE word-level timestamps for each sentence. We need every single word aligned.
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

Start and end are floating point seconds.`;

  const phase1Result = await callGemini(apiKey, [
    { text: phase1Prompt },
    { inlineData: { mimeType: 'audio/wav', data: dataPart } }
  ]);

  const ttsSentences: TtsSentence[] = JSON.parse(phase1Result);
  if (!Array.isArray(ttsSentences)) throw new Error('Phase 1 failed: Invalid TTS transcription.');

  onProgress(55, 'Aligning words (Continuous Anchor Engine)...');

  // ─── Phase 2: Word-Level Sequence Matching (Continuous Anchor Alignment) ───

  const wordsOrg = extractWordList(originalSubtitles);
  const wordsTts = extractWordList(ttsSentences);

  const tokensOrg = wordsOrg.map(w => w.word);
  const tokensTts = wordsTts.map(w => w.word);

  const blocks = getMatchingBlocks(tokensOrg, tokensTts);

  const anchors: { o_start: number; o_end: number; t_start: number; t_end: number; text: string }[] = [];
  for (const b of blocks) {
    if (b.length > 0) {
      const o_s = wordsOrg[b.aIndex].start;
      const o_e = wordsOrg[b.aIndex + b.length - 1].end;
      const t_s = wordsTts[b.bIndex].start;
      const t_e = wordsTts[b.bIndex + b.length - 1].end;
      anchors.push({
        o_start: o_s,
        o_end: o_e,
        t_start: t_s,
        t_end: t_e,
        text: tokensTts.slice(b.bIndex, b.bIndex + b.length).join(" ")
      });
    }
  }

  if (anchors.length === 0) {
    throw new Error('No matching words found between TTS audio and original subtitles. Make sure the TTS matches the script!');
  }

  // Generate continuous chunks
  const ttsTotalDur = Math.max(...ttsSentences.map(s => s.end));
  const orgTotalDur = Math.max(...originalSubtitles.map(s => s.endTime));

  const chunks: { t_start: number; t_end: number; o_start: number; o_end: number }[] = [];
  let curr_t = 0.0;
  let curr_o = 0.0;

  for (const a of anchors) {
    if (a.t_start > curr_t) {
      chunks.push({
        t_start: curr_t, t_end: a.t_start,
        o_start: curr_o, o_end: a.o_start
      });
    }
    chunks.push({
      t_start: a.t_start, t_end: a.t_end,
      o_start: a.o_start, o_end: a.o_end
    });
    curr_t = a.t_end;
    curr_o = a.o_end;
  }

  if (curr_t < ttsTotalDur) {
    chunks.push({
      t_start: curr_t, t_end: ttsTotalDur,
      o_start: curr_o, o_end: Math.max(orgTotalDur, curr_o + (ttsTotalDur - curr_t))
    });
  }

  // Merge extremely short chunks to prevent timeline clutter
  const mergedChunks: typeof chunks = [];
  let current: typeof chunks[0] | null = null;

  for (const c of chunks) {
    c.o_end = Math.max(c.o_start + 0.01, c.o_end);
    c.t_end = Math.max(c.t_start + 0.01, c.t_end);

    if (!current) {
      current = { ...c };
    } else {
      const t_dur = current.t_end - current.t_start;
      if (t_dur < 1.0) { // Merge if less than 1.0 sec to keep timeline clean
        current.t_end = c.t_end;
        current.o_end = c.o_end;
      } else {
        mergedChunks.push(current);
        current = { ...c };
      }
    }
  }
  if (current) mergedChunks.push(current);

  const sourceClip = targetTrack.clips[0];
  const newClips: TimelineClip[] = [];

  let write_cursor = 0; // Timeline time cursor

  for (const c of mergedChunks) {
    const t_s = c.t_start;
    const t_e = c.t_end;
    const o_s = c.o_start;
    const o_e = c.o_end;

    // Adjust target org duration based on cursor to avoid drifting
    const expected_o_start = write_cursor > 0 ? write_cursor : o_s;
    
    let t_dur = t_e - t_s;
    let o_dur = o_e - expected_o_start;
    if (o_dur < 0.05) o_dur = 0.05;

    let speed = t_dur / o_dur;
    
    // Soft clamp speed limits (0.6x to 1.6x) just like the IDE script
    if (speed < 0.6) {
      speed = 0.6;
      o_dur = t_dur / speed;
    } else if (speed > 1.6) {
      speed = 1.6;
      o_dur = t_dur / speed;
    }

    if (t_dur <= 0) continue;

    newClips.push({
      ...sourceClip,
      id: uuidv4(),
      startTime: expected_o_start,
      duration: o_dur,
      trimStart: t_s + sourceClip.trimStart, // Offset by original source trim
      speed: speed,
      audioSettings: {
        volume: 0, pan: 0, fadeIn: 0, fadeOut: 0, bass: 0, treble: 0, muted: false, pitch: 0, voiceFormant: 0, humanize: false,
        ...(sourceClip.audioSettings || {}),
        preservePitch: true
      } as any
    });

    write_cursor = expected_o_start + o_dur;
  }

  // Apply to timeline
  const updatedTracks = store.tracks.map(t =>
    t.id === targetTrackId ? { ...t, clips: newClips } : t
  );
  useEditorStore.setState({ tracks: updatedTracks });

  onProgress(100, 'Continuous Sync complete!');
}
