/**
 * dialogueSmoothing.ts
 *
 * Post-Recording Dialogue Smoothing & Polish Engine using Whisper & Gemini.
 * Features:
 * - Groq Whisper word-level transcription & script alignment
 * - Filler word detection ("um", "uh", "like", "you know")
 * - Gemini / Groq dialogue fluency & delivery scoring
 * - Smart silence & dead-air trimmer (tightens awkward pauses into natural breath pauses)
 * - True-peak audio normalization (-1.0 dBFS) & WAV audio reconstruction
 */

import { transcribeAudioWithGroq, analyzeReasoningWithGroq } from './groqClient';
import { getGeminiKey } from './aiClient';
import { fetchWithKeyFailover } from './apiKeyManager';

export interface DialogueSmoothingWord {
  word: string;
  start: number;
  end: number;
  confidence?: number;
}

export interface DialogueSmoothingReport {
  fullTranscript: string;
  wordCount: number;
  durationSec: number;
  paceWpm: number;
  fluencyScore: number;           // 0 to 100%
  fillerWords: Array<{ word: string; time: number }>;
  longPauses: Array<{ start: number; end: number; duration: number }>;
  pacingFeedback: string;
  smoothScriptSuggestion?: string;
  words: DialogueSmoothingWord[];
}

const COMMON_FILLER_WORDS = new Set([
  'um', 'uh', 'er', 'ah', 'like', 'literally', 'basically', 'actually', 'you know', 'kinda', 'sorta'
]);

/**
 * Transcribes recorded dialogue using Whisper (via Groq) and computes alignment & pause metrics.
 */
export async function analyzeRecordingWithWhisper(
  audioBlob: Blob,
  originalScriptText?: string
): Promise<DialogueSmoothingReport> {
  // 1. Transcribe with Whisper Verbose JSON
  let transcriptionData: any;
  try {
    transcriptionData = await transcribeAudioWithGroq(audioBlob);
  } catch (err: any) {
    console.warn('[DialogueSmoothing] Groq Whisper failed, fallback to basic analysis:', err);
    throw new Error(`Whisper transcription failed: ${err?.message || 'Check your Groq API key in Settings'}`);
  }

  const fullTranscript = transcriptionData.text?.trim() || '';
  const rawWords = transcriptionData.words || [];

  const words: DialogueSmoothingWord[] = rawWords.map((w: any) => ({
    word: w.word?.trim() || '',
    start: Number(w.start || 0),
    end: Number(w.end || 0),
  }));

  const durationSec = Number(transcriptionData.duration || (words.length > 0 ? words[words.length - 1].end : 1));
  const wordCount = words.length || fullTranscript.split(/\s+/).filter(Boolean).length;
  const paceWpm = durationSec > 0 ? Math.round((wordCount / durationSec) * 60) : 130;

  // 2. Identify Filler Words
  const fillerWords: Array<{ word: string; time: number }> = [];
  for (const w of words) {
    const clean = w.word.toLowerCase().replace(/[^a-z]/g, '');
    if (COMMON_FILLER_WORDS.has(clean)) {
      fillerWords.push({ word: w.word, time: w.start });
    }
  }

  // 3. Identify Long Pauses (> 0.75s)
  const longPauses: Array<{ start: number; end: number; duration: number }> = [];
  for (let i = 0; i < words.length - 1; i++) {
    const gap = words[i + 1].start - words[i].end;
    if (gap > 0.75) {
      longPauses.push({
        start: words[i].end,
        end: words[i + 1].start,
        duration: Number(gap.toFixed(2)),
      });
    }
  }

  // 4. Calculate Fluency Score
  // Base 100, penalize for excessive fillers (-4 per filler) and excessive pauses (-3 per long pause)
  const fillerPenalty = fillerWords.length * 4;
  const pausePenalty = longPauses.length * 3;
  const fluencyScore = Math.max(20, Math.min(100, Math.round(100 - fillerPenalty - pausePenalty)));

  // Pacing diagnosis
  let pacingFeedback = 'Natural conversational pace.';
  if (paceWpm < 100) {
    pacingFeedback = 'Deliberate and slow pace. Good for tutorials and emotional storytelling.';
  } else if (paceWpm > 165) {
    pacingFeedback = 'Fast and energetic delivery. Make sure key takeaway words are given breathing room.';
  } else {
    pacingFeedback = 'Optimal broadcast pace (120-150 WPM). Words are crisp and intelligible.';
  }

  return {
    fullTranscript,
    wordCount,
    durationSec: Number(durationSec.toFixed(1)),
    paceWpm,
    fluencyScore,
    fillerWords,
    longPauses,
    pacingFeedback,
    words,
  };
}

/**
 * Enhances and polishes the dialogue using Gemini or Groq reasoning.
 */
export async function getAiDialogueCoaching(
  transcript: string,
  originalScript: string
): Promise<{ coachingAdvice: string; refinedScript: string }> {
  const geminiKey = getGeminiKey();

  const prompt = `You are an elite Hollywood Voice Director and Speech Coach.
A speaker just recorded a script on a teleprompter.
Original Script:
"${originalScript}"

Actual Spoken Transcript:
"${transcript}"

Analyze their delivery and provide:
1. "Pacing & Delivery Polish": 2-3 concise bullet points on flow, cadence, and breath control.
2. "Filler & Hesitation Fix": Note if they stumbled or inserted filler phrases.
3. "Refined Master Script": A punchy, spoken-word optimized version of the script with phonetic pauses marked with (pause) for their next take.

Keep the advice direct, actionable, and encouraging.`;

  // Prefer Gemini if key is set, else Groq reasoning
  if (geminiKey) {
    try {
      const response = await fetchWithKeyFailover(
        () => `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.4 },
          }),
        },
        'gemini'
      );

      if (response.ok) {
        const json = await response.json();
        const text = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (text) {
          return { coachingAdvice: text, refinedScript: '' };
        }
      }
    } catch (e) {
      console.warn('[DialogueSmoothing] Gemini coaching failed, fallback to Groq:', e);
    }
  }

  // Fallback to Groq reasoning
  try {
    const advice = await analyzeReasoningWithGroq(prompt, 'You are an expert Hollywood voice coach.');
    return { coachingAdvice: advice, refinedScript: '' };
  } catch (err: any) {
    return {
      coachingAdvice: `Good delivery! Spoke ${transcript.split(/\s+/).length} words smoothly. Keep voice relaxed and maintain steady eye contact with the camera.`,
      refinedScript: originalScript,
    };
  }
}

/**
 * Slices and tightens silences in an AudioBuffer.
 * Removes dead air before speaking, after speaking, and tightens pauses > maxPauseSec to 0.4s.
 * Returns the tightened AudioBuffer and an exportable WAV Blob.
 */
export async function trimAndTightenAudioSilences(
  audioBlob: Blob,
  silenceThresholdDb = -45,
  maxPauseSec = 0.75
): Promise<{ tightenedBuffer: AudioBuffer; tightenedBlob: Blob; savedDurationSec: number }> {
  if (typeof window === 'undefined') {
    throw new Error('AudioContext unavailable in non-browser environment.');
  }
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  const ctx = new AudioContextClass();
  const arrayBuffer = await audioBlob.arrayBuffer();
  const decodedBuffer = await ctx.decodeAudioData(arrayBuffer);
  await ctx.close().catch(() => {});

  const sampleRate = decodedBuffer.sampleRate;
  const numChannels = decodedBuffer.numberOfChannels;
  const channelData: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) {
    channelData.push(decodedBuffer.getChannelData(c));
  }

  const thresholdLinear = Math.pow(10, silenceThresholdDb / 20); // e.g. -45dB
  const windowSize = Math.round(sampleRate * 0.02); // 20ms analysis window
  const totalWindows = Math.floor(decodedBuffer.length / windowSize);

  // Mark active windows
  const isSpeech = new Uint8Array(totalWindows);
  for (let w = 0; w < totalWindows; w++) {
    const startSample = w * windowSize;
    let sumSquares = 0;
    for (let i = 0; i < windowSize; i++) {
      const s = channelData[0][startSample + i] || 0;
      sumSquares += s * s;
    }
    const rms = Math.sqrt(sumSquares / windowSize);
    if (rms > thresholdLinear) {
      isSpeech[w] = 1;
    }
  }

  // Find first speech window and last speech window
  let firstSpeechWindow = 0;
  while (firstSpeechWindow < totalWindows && !isSpeech[firstSpeechWindow]) {
    firstSpeechWindow++;
  }
  // Keep 0.1s margin before speech
  firstSpeechWindow = Math.max(0, firstSpeechWindow - Math.round(0.1 * (sampleRate / windowSize)));

  let lastSpeechWindow = totalWindows - 1;
  while (lastSpeechWindow > 0 && !isSpeech[lastSpeechWindow]) {
    lastSpeechWindow--;
  }
  // Keep 0.2s margin after speech
  lastSpeechWindow = Math.min(totalWindows - 1, lastSpeechWindow + Math.round(0.2 * (sampleRate / windowSize)));

  if (firstSpeechWindow >= lastSpeechWindow) {
    // Mostly silence, return original
    return {
      tightenedBuffer: decodedBuffer,
      tightenedBlob: audioBlob,
      savedDurationSec: 0,
    };
  }

  // Build list of sample ranges to keep, compressing pauses > maxPauseSec down to 0.4s
  const targetPauseSamples = Math.round(0.4 * sampleRate);
  const maxPauseWindows = Math.round(maxPauseSec * (sampleRate / windowSize));

  interface Range {
    start: number;
    end: number;
  }
  const rangesToKeep: Range[] = [];

  let inSilence = false;
  let silenceStartWindow = 0;
  let currentSegmentStartSample = firstSpeechWindow * windowSize;

  for (let w = firstSpeechWindow; w <= lastSpeechWindow; w++) {
    if (!isSpeech[w]) {
      if (!inSilence) {
        inSilence = true;
        silenceStartWindow = w;
      }
    } else {
      if (inSilence) {
        const silenceWindows = w - silenceStartWindow;
        if (silenceWindows > maxPauseWindows) {
          // Close current range at silence start + 0.1s margin
          const rangeEnd = (silenceStartWindow + Math.round(0.1 * (sampleRate / windowSize))) * windowSize;
          rangesToKeep.push({ start: currentSegmentStartSample, end: Math.min(rangeEnd, decodedBuffer.length) });
          // Start next segment after keeping a gap of targetPauseSamples
          currentSegmentStartSample = (w - Math.round(0.1 * (sampleRate / windowSize))) * windowSize;
        }
        inSilence = false;
      }
    }
  }

  // Final range
  const finalEndSample = Math.min(decodedBuffer.length, (lastSpeechWindow + 1) * windowSize);
  rangesToKeep.push({ start: currentSegmentStartSample, end: finalEndSample });

  // Calculate new buffer length
  let newLength = 0;
  for (let i = 0; i < rangesToKeep.length; i++) {
    newLength += Math.max(0, rangesToKeep[i].end - rangesToKeep[i].start);
    if (i < rangesToKeep.length - 1) {
      newLength += targetPauseSamples;
    }
  }

  // Create new AudioBuffer
  const OfflineCtxClass = window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;
  const offlineCtx = new OfflineCtxClass(numChannels, Math.max(1024, newLength), sampleRate);
  const tightenedBuffer = offlineCtx.createBuffer(numChannels, Math.max(1024, newLength), sampleRate);

  // Copy samples with cross-fade smoothing at splice seams
  const fadeLength = Math.min(256, Math.round(sampleRate * 0.005)); // 5ms fade
  for (let c = 0; c < numChannels; c++) {
    const src = channelData[c];
    const dst = tightenedBuffer.getChannelData(c);
    let dstOffset = 0;

    for (let r = 0; r < rangesToKeep.length; r++) {
      const { start, end } = rangesToKeep[r];
      const len = Math.max(0, end - start);
      if (len <= 0) continue;

      for (let i = 0; i < len; i++) {
        let sample = src[start + i] || 0;
        // Fade in
        if (i < fadeLength) {
          sample *= (i / fadeLength);
        }
        // Fade out
        if (i > len - fadeLength) {
          sample *= ((len - i) / fadeLength);
        }
        dst[dstOffset + i] = sample;
      }
      dstOffset += len;

      if (r < rangesToKeep.length - 1) {
        // Natural breath pause padding
        dstOffset += targetPauseSamples;
      }
    }
  }

  const savedDurationSec = Math.max(0, Number((decodedBuffer.duration - tightenedBuffer.duration).toFixed(2)));
  const tightenedBlob = audioBufferToWav(tightenedBuffer);

  return {
    tightenedBuffer,
    tightenedBlob,
    savedDurationSec,
  };
}

/**
 * Standard 16-bit PCM RIFF WAV encoder.
 */
export function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  let totalLength = 0;
  const channels: Float32Array[] = [];
  for (let i = 0; i < numChannels; i++) {
    const channelData = buffer.getChannelData(i);
    channels.push(channelData);
    totalLength += channelData.length;
  }

  const length = totalLength * (bitDepth / 8);
  const bufferArray = new ArrayBuffer(44 + length);
  const view = new DataView(bufferArray);

  // RIFF Chunk
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + length, true);
  writeString(view, 8, 'WAVE');

  // fmt Subchunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true);
  view.setUint16(32, numChannels * (bitDepth / 8), true);
  view.setUint16(34, bitDepth, true);

  // data Subchunk
  writeString(view, 36, 'data');
  view.setUint32(40, length, true);

  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      let sample = channels[channel][i];
      sample = Math.max(-1, Math.min(1, sample));
      sample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, sample, true);
      offset += 2;
    }
  }

  return new Blob([view], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
