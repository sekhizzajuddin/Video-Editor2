import { getGeminiKey } from './aiClient';
import { extractJsonFromLlmResponse } from './jsonHelper';
import { renderTimelineAudioToWav, blobToBase64, audioBufferToWav } from './autoCaptions';
import { useEditorStore } from '@/store/editorStore';
import { TimelineClip } from '@/types';

const uuidv4 = () => crypto.randomUUID();

export interface SyncWord {
  id: string;
  word: string;
  start: number;
  end: number;
}

export interface SyncWordPair {
  id: string;
  sourceWord: SyncWord;
  ttsWord?: SyncWord;
  confirmed: boolean;
}

// ─── AI API Wrapper ───────────────────────────────────────────────────────

async function callGemini(apiKey: string, prompt: string, base64AudioPart?: string): Promise<string> {
  const parts: any[] = [{ text: prompt }];
  if (base64AudioPart) {
    parts.push({ inlineData: { mimeType: 'audio/wav', data: base64AudioPart } });
  }

  const requestBody = {
    contents: [{ parts }],
    generationConfig: { temperature: 0.1, responseMimeType: "application/json" }
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

// ─── Rendering Helpers ────────────────────────────────────────────────────

export async function renderMediaItemToWav(mediaId: string): Promise<Blob> {
  const store = useEditorStore.getState();
  const media = store.mediaLibrary.find(m => m.id === mediaId);
  if (!media || !media.url) throw new Error("Media not found");

  const audioCtx = new AudioContext();
  const resp = await fetch(media.url);
  const arrayBuf = await resp.arrayBuffer();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuf);
  
  const offlineCtx = new OfflineAudioContext(1, audioBuffer.length, audioBuffer.sampleRate);
  const source = offlineCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(offlineCtx.destination);
  source.start();
  
  const renderedBuffer = await offlineCtx.startRendering();
  await audioCtx.close();
  return audioBufferToWav(renderedBuffer);
}

export async function extractAudioFromTracks(trackIds: string[], duration: number): Promise<Blob | null> {
  const store = useEditorStore.getState();
  const tracks = store.tracks.filter(t => trackIds.includes(t.id));
  return renderTimelineAudioToWav(tracks, duration, store.mediaLibrary, () => {});
}

// ─── Core Analysis Engines ────────────────────────────────────────────────

export async function analyzeSourceAudio(
  wavBlob: Blob, 
  language: string, 
  rawScript?: string
): Promise<SyncWord[]> {
  const apiKey = getGeminiKey();
  if (!apiKey) throw new Error('Gemini API Key missing.');

  const b64 = await blobToBase64(wavBlob);
  const dataPart = b64.split(',')[1] || b64;

  let prompt = `You are a professional audio analysis assistant. Extract precise word-by-word timestamps from this audio.
Language: ${language}
Return a JSON array of words:
[ { "word": "Hello", "start": 0.0, "end": 0.5 }, ... ]
Start and end must be floating point seconds.`;

  if (rawScript && rawScript.trim()) {
    prompt += `\n\nCRITICAL INSTRUCTION: You MUST strictly follow this exact Reference Script. Do not hallucinate words. Align these exact words to the audio.
REFERENCE SCRIPT:
${rawScript.trim()}`;
  }

  const jsonStr = await callGemini(apiKey, prompt, dataPart);
  const arr = JSON.parse(jsonStr);
  if (!Array.isArray(arr)) throw new Error("Invalid format from AI");

  return arr.map(w => ({
    id: uuidv4(),
    word: w.word,
    start: w.start,
    end: w.end
  }));
}

export async function analyzeTtsAudio(
  wavBlob: Blob,
  language: string,
  sourceWords: SyncWord[]
): Promise<SyncWord[]> {
  const apiKey = getGeminiKey();
  if (!apiKey) throw new Error('Gemini API Key missing.');

  const b64 = await blobToBase64(wavBlob);
  const dataPart = b64.split(',')[1] || b64;
  
  // Provide source words as reference so AI tries to match the same text.
  const referenceText = sourceWords.map(w => w.word).join(" ");

  const prompt = `You are an audio analysis assistant processing a TTS voiceover file.
Extract precise word-by-word timestamps. Use this reference text to guide spelling and content:
"${referenceText}"
Language: ${language}
Return a JSON array of words:
[ { "word": "Hello", "start": 0.0, "end": 0.5 }, ... ]`;

  const jsonStr = await callGemini(apiKey, prompt, dataPart);
  const arr = JSON.parse(jsonStr);
  if (!Array.isArray(arr)) throw new Error("Invalid format from AI");

  return arr.map(w => ({
    id: uuidv4(),
    word: w.word,
    start: w.start,
    end: w.end
  }));
}

import { pairWordsAlgorithm as advancedPairing } from './pairAlgorithm';

export function pairWordsAlgorithm(sourceWords: SyncWord[], ttsWords: SyncWord[]): SyncWordPair[] {
  return advancedPairing(sourceWords, ttsWords);
}

// ─── Micro Analysis Fallback ──────────────────────────────────────────────

export async function findMissingWordInGap(
  sourceWavBlob: Blob,
  ttsWavBlob: Blob,
  sourceStart: number,
  sourceEnd: number,
  ttsStart: number,
  ttsEnd: number,
  expectedWordHint: string
): Promise<{ sourceStart: number, sourceEnd: number, ttsStart: number, ttsEnd: number }> {
  const apiKey = getGeminiKey();
  if (!apiKey) throw new Error('Gemini API Key missing.');

  // Since we can't easily slice WAV blobs in pure JS without writing a parser, 
  // we'll send the whole files but restrict the prompt strictly to the time range.
  const sourceB64 = await blobToBase64(sourceWavBlob);
  const sourcePart = sourceB64.split(',')[1];
  
  const ttsB64 = await blobToBase64(ttsWavBlob);
  const ttsPart = ttsB64.split(',')[1];

  const sourcePrompt = `In the provided audio, look STRICTLY between timestamp ${sourceStart.toFixed(2)}s and ${sourceEnd.toFixed(2)}s.
Locate the exact start and end times of the word roughly matching "${expectedWordHint}".
Return ONLY JSON: { "start": 0.0, "end": 0.0 }`;

  const ttsPrompt = `In the provided TTS audio, look STRICTLY between timestamp ${ttsStart.toFixed(2)}s and ${ttsEnd.toFixed(2)}s.
Locate the exact start and end times of the word roughly matching "${expectedWordHint}".
Return ONLY JSON: { "start": 0.0, "end": 0.0 }`;

  const [sourceJson, ttsJson] = await Promise.all([
    callGemini(apiKey, sourcePrompt, sourcePart),
    callGemini(apiKey, ttsPrompt, ttsPart)
  ]);

  const sourceRes = JSON.parse(sourceJson);
  const ttsRes = JSON.parse(ttsJson);

  return {
    sourceStart: sourceRes.start,
    sourceEnd: sourceRes.end,
    ttsStart: ttsRes.start,
    ttsEnd: ttsRes.end
  };
}

// ─── Timeline Application ─────────────────────────────────────────────────

export function applyVoiceSyncToTimeline(
  targetTrackId: string,
  ttsMediaId: string,
  pairs: SyncWordPair[]
) {
  const store = useEditorStore.getState();
  const track = store.tracks.find(t => t.id === targetTrackId);
  if (!track) throw new Error("Target track not found.");

  const newClips: TimelineClip[] = [];

  for (const pair of pairs) {
    if (!pair.confirmed || !pair.ttsWord) continue;
    
    const sourceDuration = Math.max(0.05, pair.sourceWord.end - pair.sourceWord.start);
    const ttsDuration = Math.max(0.05, pair.ttsWord.end - pair.ttsWord.start);
    const requiredSpeed = ttsDuration / sourceDuration;

    newClips.push({
      id: uuidv4(),
      mediaId: ttsMediaId,
      trackId: targetTrackId,
      startTime: pair.sourceWord.start,
      duration: sourceDuration,
      trimStart: pair.ttsWord.start,
      trimEnd: 0, // In Web Editor, trimEnd is usually calculated dynamically, but setting to 0 is safe
      speed: requiredSpeed,
      opacity: 1,
      transform: { x: 0, y: 0, scale: 1, rotation: 0 },
      effects: [],
      audioSettings: {
        volume: 0, pan: 0, fadeIn: 0, fadeOut: 0, bass: 0, treble: 0, muted: false, pitch: 0, voiceFormant: 0, humanize: false,
        preservePitch: true
      }
    });
  }

  const updatedTracks = store.tracks.map(t =>
    t.id === targetTrackId ? { ...t, clips: [...t.clips, ...newClips] } : t
  );
  useEditorStore.setState({ tracks: updatedTracks });
}
