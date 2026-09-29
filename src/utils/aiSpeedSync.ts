import { TimelineClip, SpeedFrame } from '@/types';
import { useEditorStore, findClipInTracks } from '@/store/editorStore';
import { getGeminiKey } from './aiClient';
import { audioBufferToWav } from './autoCaptions';
import { extractJsonFromLlmResponse } from './jsonHelper';
import { calculateSpeedFramesRamp, getSpeedFrameSegments, SpeedFrameSegment } from './speedRamp';
import { getFileFromDB } from '@/utils/projectPersistence';
import { getPreferredGroqKey, hasAnyGroqKey } from './ai-copilot/groqChat';
import { globalRateLimiter } from './ai-copilot/RateLimiter';

export async function blobToBase64(blob: Blob): Promise<string> {
  if (typeof FileReader !== 'undefined') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = typeof btoa !== 'undefined' ? btoa(binary) : '';
  return `data:${blob.type || 'application/octet-stream'};base64,${base64}`;
}

export const GEMINI_SPEED_SYNC_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.5-flash-preview',
  'gemini-3.1-flash-lite',
  'gemini-3.8-flash',
  'gemini-2.5-flash',
] as const;

export type GeminiSpeedSyncModel = typeof GEMINI_SPEED_SYNC_MODELS[number];

export const GROQ_WHISPER_MODELS = [
  'whisper-large-v3-turbo',
  'whisper-large-v3',
] as const;

export type GroqWhisperModel = typeof GROQ_WHISPER_MODELS[number];

export const GROQ_REASONING_MODELS = [
  'openai/gpt-oss-120b',
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
] as const;

export type GroqReasoningModel = typeof GROQ_REASONING_MODELS[number];

export type SpeedSyncProvider = 'auto' | 'groq' | 'gemini';

export interface SyncAnchor {
  videoTime: number;  // offset in seconds from video clip trimmed start
  ttsTime: number;    // offset in seconds from TTS clip trimmed start
  phrase?: string;
  targetSpeed?: number;
  /** True when this anchor came from a matched word pair (word-level mode). */
  matched?: boolean;
  /** True when this anchor is a trailing-hold frame (TTS wording fuller than video). */
  stretch?: boolean;
}

export interface SyncWordTiming {
  word: string;
  time: number; // seconds from the respective audio slice start (word start)
  endTime?: number; // seconds from the respective audio slice start (word end)
}

/**
 * AI-reported verdict about the two provided audios. Drives the
 * wrong-audio-clip validation before any speed frames are applied:
 * - ttsHasSpeech === false  → the user selected a music/silent clip instead of TTS.
 * - sameContent === true    → the user selected the original clip's own audio
 *                             instead of a separate TTS voiceover.
 * - videoHasSpeech === false is NOT an error — the video may be a silent
 *   AI-generated clip; the sync falls back to TTS-cadence pacing.
 */
export interface SpeedSyncVerdict {
  ttsHasSpeech: boolean;
  videoHasSpeech: boolean;
  sameContent: boolean;
  ttsTranscript?: string;
  videoTranscript?: string;
  reason?: string;
}

export interface SpeedSyncSentence {
  text: string;
  startTime: number;
  endTime: number;
}

export interface TtsExtraSentenceDetection {
  hasMoreSentences: boolean;
  matchingCutoffTime: number; // in seconds from TTS audio slice start
  matchingSentenceCount?: number;
  totalTtsSentences?: number;
  reason?: string;
}

export interface AiSpeedSyncOptions {
  alignStartTime?: boolean;      // Align video start with TTS start (default true)
  muteOriginalAudio?: boolean;   // Mute original video audio so TTS is isolated (default true)
  provider?: SpeedSyncProvider;  // 'auto' | 'groq' | 'gemini' (default 'auto')
  targetModel?: GeminiSpeedSyncModel; // Preferred starting Gemini model
  groqWhisperModel?: GroqWhisperModel; // Preferred Groq Whisper model
  groqReasoningModel?: GroqReasoningModel; // Preferred Groq Reasoning model
}

export interface AiSpeedSyncResult {
  videoClipId: string;
  ttsClipId: string;
  anchors: SyncAnchor[];
  speedFrames: SpeedFrame[];
  segments: SpeedFrameSegment[];
  newDuration: number;
  successfulModel: string;
  summary?: string;
  /** How the anchors were derived: 'word-level' (matched word pairs) or 'ai-anchors' (cadence fallback). */
  alignmentMode?: 'word-level' | 'ai-anchors';
  verdict?: SpeedSyncVerdict;
  /** Number of anchors that stretch/hold the video across extra TTS words. */
  stretchFrameCount?: number;
  /** Whether TTS had extra sentences and was split at the matching point. */
  ttsSplitApplied?: boolean;
  /** Split point in seconds relative to TTS clip start. */
  ttsSplitPoint?: number;
  /** ID of the trailing TTS clip preserved on the timeline. */
  ttsRemainingClipId?: string;
  matchingSentenceCount?: number;
  totalTtsSentences?: number;
  splitReason?: string;
}

/**
 * Extracts a downsampled 16kHz mono WAV audio slice corresponding strictly to
 * the clip's used source range [trimStart, trimStart + sourceSpan].
 */
export async function extractClipAudioToWav(
  clip: TimelineClip,
  mediaUrl: string,
  mediaId?: string,
  sampleRate: number = 16000
): Promise<{ wavBlob: Blob | null; duration: number; hasAudio: boolean; rmsEnergy: number }> {
  let arrayBuffer: ArrayBuffer | null = null;

  // 1. Try fetching live URL
  if (mediaUrl && mediaUrl !== 'PENDING_RESTORE') {
    try {
      const resp = await fetch(mediaUrl);
      if (resp.ok) {
        arrayBuffer = await resp.arrayBuffer();
      }
    } catch {
      // Fetch failed, try IDB fallback below
    }
  }

  // 2. Try IDB store if fetch failed
  if (!arrayBuffer && mediaId) {
    try {
      const fileBlob = await getFileFromDB(mediaId);
      if (fileBlob) {
        arrayBuffer = await fileBlob.arrayBuffer();
        if (typeof window !== 'undefined') {
          const state = useEditorStore.getState();
          const mediaItem = state.mediaLibrary.find(m => m.id === mediaId);
          if (mediaItem) {
            try {
              const freshUrl = URL.createObjectURL(fileBlob);
              state.updateMediaMetadata(mediaId, { url: freshUrl });
            } catch {}
          }
        }
      }
    } catch {}
  }

  const effectiveSpeed = clip.speed || 1.0;
  const rawSpan = clip.speedFrameSourceEnd !== undefined
    ? (clip.speedFrameSourceEnd - (clip.trimStart || 0))
    : (clip.duration * effectiveSpeed);
  const fallbackSpan = Math.max(0.1, rawSpan);

  if (!arrayBuffer) {
    return { wavBlob: null, duration: fallbackSpan, hasAudio: false, rmsEnergy: 0 };
  }

  const audioCtx = new AudioContext();
  try {
    const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    if (!decodedBuffer || decodedBuffer.numberOfChannels === 0 || decodedBuffer.length === 0) {
      return { wavBlob: null, duration: fallbackSpan, hasAudio: false, rmsEnergy: 0 };
    }

    const trimStart = Math.max(0, clip.trimStart || 0);
    const sourceEnd = Math.min(decodedBuffer.duration, trimStart + fallbackSpan);
    const actualSpan = Math.max(0.1, sourceEnd - trimStart);

    // Render into an OfflineAudioContext at 16kHz mono to minimize payload size
    const offlineCtx = new OfflineAudioContext(1, Math.ceil(sampleRate * actualSpan), sampleRate);
    const sourceNode = offlineCtx.createBufferSource();
    sourceNode.buffer = decodedBuffer;
    sourceNode.connect(offlineCtx.destination);
    sourceNode.start(0, trimStart, actualSpan);

    const rendered = await offlineCtx.startRendering();
    const wavBlob = audioBufferToWav(rendered);

    // RMS energy of the rendered slice — drives the local "silent clip"
    // validation before the AI call (music/silence selected by mistake).
    const data = rendered.getChannelData(0);
    let sumSquares = 0;
    for (let i = 0; i < data.length; i++) sumSquares += data[i] * data[i];
    const rmsEnergy = Math.sqrt(sumSquares / Math.max(1, data.length));

    // Ensure media library has waveform peaks for the ENTIRE media duration so waveforms never disappear
    if (mediaId && typeof window !== 'undefined') {
      try {
        const state = useEditorStore.getState();
        const mediaItem = state.mediaLibrary.find(m => m.id === mediaId);
        if (mediaItem && (!mediaItem.waveformPeaks || !mediaItem.waveformPeaks.some(p => p > 0.005))) {
          const fullAudioData = decodedBuffer.getChannelData(0);
          const targetPeaks = 400;
          const step = Math.max(1, Math.floor(fullAudioData.length / targetPeaks));
          const freshPeaks: number[] = new Array(targetPeaks);
          for (let pIdx = 0; pIdx < targetPeaks; pIdx++) {
            const startP = pIdx * step;
            const endP = Math.min(startP + step, fullAudioData.length);
            let mPeak = 0;
            for (let k = startP; k < endP; k++) {
              const val = Math.abs(fullAudioData[k]);
              if (val > mPeak) mPeak = val;
            }
            freshPeaks[pIdx] = Number(mPeak.toFixed(4));
          }
          state.setMediaWaveformPeaks(mediaId, freshPeaks);
          state.updateMediaMetadata(mediaId, {
            duration: decodedBuffer.duration,
            waveformPeaks: freshPeaks,
          });
        }
      } catch {}
    }

    return { wavBlob, duration: actualSpan, hasAudio: true, rmsEnergy };
  } catch (decodeErr) {
    console.warn('[AiSpeedSync] Audio decode failed or media has no audio track:', decodeErr);
    return { wavBlob: null, duration: fallbackSpan, hasAudio: false, rmsEnergy: 0 };
  } finally {
    await audioCtx.close().catch(() => {});
  }
}

/**
 * Calls Gemini with fallback cascade:
 * 1. gemini-3.5-flash-preview / gemini-3.5-flash-lite
 * 2. gemini-3.1-flash-lite
 * 3. gemini-3.8-flash
 * 4. gemini-2.5-flash (safety)
 */
export async function runGeminiSpeedSync(
  videoAudioBlob: Blob | null,
  ttsAudioBlob: Blob,
  videoDuration: number,
  ttsDuration: number,
  preferredModel?: GeminiSpeedSyncModel
): Promise<{
  anchors: SyncAnchor[];
  successfulModel: string;
  summary: string;
  verdict?: SpeedSyncVerdict;
  videoWords?: SyncWordTiming[];
  ttsWords?: SyncWordTiming[];
  videoSentences?: SpeedSyncSentence[];
  ttsSentences?: SpeedSyncSentence[];
  ttsHasMoreSentences?: boolean;
  matchingCutoffTtsTime?: number;
}> {
  const apiKey = getGeminiKey();
  if (!apiKey) {
    throw new Error('Gemini API Key is missing. Please configure it in Settings or set VITE_GEMINI_API_KEY.');
  }

  const ttsBase64 = await blobToBase64(ttsAudioBlob);
  const ttsDataPart = ttsBase64.split(',')[1] || ttsBase64;

  let videoDataPart: string | null = null;
  if (videoAudioBlob) {
    const videoBase64 = await blobToBase64(videoAudioBlob);
    videoDataPart = videoBase64.split(',')[1] || videoBase64;
  }

  const hasBothAudio = Boolean(videoDataPart);

  let prompt = '';
  const parts: any[] = [];

  if (hasBothAudio) {
    prompt = `You are a world-class audio synchronization and video speed-ramping editor.
I have provided two audio recordings:
- AUDIO 1 (First audio file): Original Video Clip Audio (Duration: ${videoDuration.toFixed(2)}s).
- AUDIO 2 (Second audio file): TTS Voiceover Audio to synchronize with (Duration: ${ttsDuration.toFixed(2)}s).

TASK — mark the timing of every word in BOTH audios and analyze sentence structure:
1. Listen to AUDIO 1 and transcribe the spoken words with precise START timestamps as "videoWords": [{ "word": "...", "time": seconds }]. The "time" value MUST be the exact moment the speaker begins uttering the word (onset), NOT the center or end of the word.
2. Listen to AUDIO 2 and transcribe the spoken words with precise START timestamps as "ttsWords": [{ "word": "...", "time": seconds }]. The "time" value MUST be the exact moment the speaker begins uttering the word (onset), NOT the center or end of the word.
3. Report sentence analysis and comparison:
   - "videoSentences": list of spoken sentences in AUDIO 1: [{ "text": "...", "startTime": seconds, "endTime": seconds }].
   - "ttsSentences": list of spoken sentences in AUDIO 2: [{ "text": "...", "startTime": seconds, "endTime": seconds }].
   - "ttsHasMoreSentences": true if AUDIO 2 (TTS) contains more sentences or additional dialogue beyond what is spoken in AUDIO 1 (Video).
   - "matchingCutoffTtsTime": if ttsHasMoreSentences is true, the timestamp in seconds in AUDIO 2 where the matching video dialogue ends (immediately after the last sentence matching AUDIO 1, before the next sentence begins in AUDIO 2).
4. Report a verdict about the two audios:
   - "ttsHasSpeech": true only if AUDIO 2 contains spoken speech (false if it is music, noise, or silence).
   - "videoHasSpeech": true only if AUDIO 1 contains spoken speech (false is fine — the video may be a silent AI-generated clip).
   - "sameContent": true ONLY if AUDIO 2 is the exact identical acoustic audio recording file as AUDIO 1 (same human voice and acoustics). If AUDIO 2 is a separate synthesized TTS voiceover speaking the same or similar script, set "sameContent" to false because synchronizing video to a matching TTS script is the primary intended function.
   - "reason": short explanation of the verdict.
5. Also return 3 to 10 anchor points where sentence or phrase beginnings align, as a fallback:
   - "videoTime": seconds from AUDIO 1 start (0.00 to ${videoDuration.toFixed(2)}).
   - "ttsTime": seconds from AUDIO 2 start (0.00 to ${ttsDuration.toFixed(2)}).
   - "phrase": short description or transcribed words for this anchor.
   - "targetSpeed": recommended video speed multiplier between this and the previous anchor (e.g. 0.7x to 1.8x).
6. IMPORTANT: the word timestamps will be matched programmatically — report ACCURATE word-level timestamps, not invented ones.

RULES:
- Word "time" values and anchor timestamps MUST be in seconds and within each audio's duration.
- Return ONLY strict JSON in this format without markdown wrappers:
{
  "verdict": { "ttsHasSpeech": true, "videoHasSpeech": true, "sameContent": false, "reason": "TTS is a separate voiceover" },
  "videoWords": [ { "word": "hello", "time": 0.8 } ],
  "ttsWords": [ { "word": "hello", "time": 1.1 } ],
  "videoSentences": [ { "text": "Hello world.", "startTime": 0.8, "endTime": 1.9 } ],
  "ttsSentences": [ { "text": "Hello world.", "startTime": 1.1, "endTime": 2.2 } ],
  "ttsHasMoreSentences": false,
  "summary": "<1-2 sentence overview of pacing adjustment>",
  "anchors": [
    { "videoTime": 0.8, "ttsTime": 1.1, "phrase": "Intro sentence", "targetSpeed": 1.2 }
  ]
}`;
    parts.push(
      { text: prompt },
      { inlineData: { mimeType: 'audio/wav', data: videoDataPart! } },
      { inlineData: { mimeType: 'audio/wav', data: ttsDataPart } }
    );
  } else {
    // Video has no audio — analyze TTS cadence and distribute natural speed ramping
    prompt = `You are a professional video speed-ramping and pacing editor.
The user wants to sync a video clip (${videoDuration.toFixed(2)}s) with a TTS voiceover (${ttsDuration.toFixed(2)}s).
The video clip has no audio track, so we must pace the video to match the spoken rhythm and sentence structure of the TTS audio provided.

TASK:
1. Listen to the TTS voiceover audio (${ttsDuration.toFixed(2)}s).
2. Mark the timing of every spoken word as "ttsWords": [{ "word": "...", "time": seconds }].
3. Report a verdict: "verdict": { "ttsHasSpeech": true/false, "videoHasSpeech": false, "sameContent": false, "reason": "..." }.
   - "ttsHasSpeech" is false if the TTS audio is music, noise, or silence (the user may have selected the wrong clip).
4. Detect major sentence starts, punchlines, and breathing/pauses.
5. Distribute 3 to 8 speed frame anchor points to create dynamic, cinematic speed ramping:
   - Slightly accelerate video through spoken pauses.
   - Settle at natural speed (0.9x - 1.2x) on key phrases and emphasis words.
6. For each anchor:
   - "videoTime": mapped source moment in seconds (0.00 to ${videoDuration.toFixed(2)}).
   - "ttsTime": spoken timestamp in TTS audio (0.00 to ${ttsDuration.toFixed(2)}).
   - "phrase": words spoken or event at this moment.
   - "targetSpeed": speed multiplier.

RULES:
- Timestamps must be strictly ascending.
- Return ONLY strict JSON in this format without markdown wrappers:
{
  "verdict": { "ttsHasSpeech": true, "videoHasSpeech": false, "sameContent": false, "reason": "..." },
  "ttsWords": [ { "word": "hello", "time": 0.5 } ],
  "summary": "<overview of pacing curve>",
  "anchors": [
    { "videoTime": 1.0, "ttsTime": 1.2, "phrase": "First phrase", "targetSpeed": 1.1 }
  ]
}`;
    parts.push(
      { text: prompt },
      { inlineData: { mimeType: 'audio/wav', data: ttsDataPart } }
    );
  }

  const requestBody = {
    contents: [{ parts }],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json',
    },
  };

  // Build cascade list, prioritizing preferredModel if given
  const modelOrder: string[] = preferredModel
    ? [preferredModel, ...GEMINI_SPEED_SYNC_MODELS.filter(m => m !== preferredModel)]
    : [...GEMINI_SPEED_SYNC_MODELS];

  let lastError: Error | null = null;
  let successfulModel = '';
  let responseText = '';

  for (const model of modelOrder) {
    try {
      console.log(`[AiSpeedSync] Attempting analysis with model: ${model}...`);
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!resp.ok) {
        const errBody = await resp.text();
        console.warn(`[AiSpeedSync] Model ${model} returned HTTP ${resp.status}:`, errBody.slice(0, 160));
        lastError = new Error(`${model} (${resp.status}): ${errBody.slice(0, 120)}`);
        continue;
      }

      const data = await resp.json();
      const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!content) {
        lastError = new Error(`${model} returned empty content.`);
        continue;
      }

      responseText = extractJsonFromLlmResponse(content);
      successfulModel = model;
      console.log(`[AiSpeedSync] Successfully analyzed with ${model}`);
      break;
    } catch (err: any) {
      console.warn(`[AiSpeedSync] Error with model ${model}:`, err);
      lastError = err;
    }
  }

  if (!responseText) {
    throw new Error(`AI analysis failed on all Gemini models. Last error: ${lastError?.message || 'Unknown error'}`);
  }

  try {
    const parsed = JSON.parse(responseText);
    const rawAnchors = Array.isArray(parsed) ? parsed : (parsed.anchors || []);
    const summary = parsed.summary || 'Synchronized video playback speed with TTS voiceover.';

    // Parse the AI verdict (wrong-audio-clip detection) — tolerate responses
    // without one (older format / plain anchor arrays).
    let verdict: SpeedSyncVerdict | undefined;
    const rawVerdict = !Array.isArray(parsed) ? parsed.verdict : undefined;
    if (rawVerdict && typeof rawVerdict === 'object') {
      verdict = {
        ttsHasSpeech: rawVerdict.ttsHasSpeech !== false,
        videoHasSpeech: rawVerdict.videoHasSpeech !== false,
        sameContent: rawVerdict.sameContent === true,
        ttsTranscript: typeof rawVerdict.ttsTranscript === 'string' ? rawVerdict.ttsTranscript : undefined,
        videoTranscript: typeof rawVerdict.videoTranscript === 'string' ? rawVerdict.videoTranscript : undefined,
        reason: typeof rawVerdict.reason === 'string' ? rawVerdict.reason : undefined,
      };
    }

    // Sanitize word timings (cap length to bound payload, finite + in-bounds).
    const sanitizeWords = (raw: unknown, duration: number): SyncWordTiming[] | undefined => {
      if (!Array.isArray(raw) || raw.length === 0) return undefined;
      const words: SyncWordTiming[] = [];
      for (const w of raw.slice(0, 600)) {
        const time = typeof w?.time === 'number' ? w.time : Number(w?.time);
        const word = typeof w?.word === 'string' ? w.word : '';
        if (!Number.isFinite(time) || !word) continue;
        if (time < -0.05 || time > duration + 0.5) continue;
        words.push({ word, time: Number(time.toFixed(3)) });
      }
      return words.length > 0 ? words : undefined;
    };
    const videoWords = sanitizeWords(parsed.videoWords, videoDuration);
    const ttsWords = sanitizeWords(parsed.ttsWords, ttsDuration);

    // Sanitize sentence breakdowns if returned by AI
    const sanitizeSentences = (raw: unknown, duration: number): SpeedSyncSentence[] | undefined => {
      if (!Array.isArray(raw) || raw.length === 0) return undefined;
      const list: SpeedSyncSentence[] = [];
      for (const s of raw.slice(0, 100)) {
        const text = typeof s?.text === 'string' ? s.text.trim() : '';
        const startTime = typeof s?.startTime === 'number' ? s.startTime : Number(s?.startTime);
        const endTime = typeof s?.endTime === 'number' ? s.endTime : Number(s?.endTime);
        if (!text || !Number.isFinite(startTime) || !Number.isFinite(endTime)) continue;
        if (startTime < -0.05 || endTime > duration + 1.0 || endTime <= startTime) continue;
        list.push({
          text,
          startTime: Number(Math.max(0, startTime).toFixed(3)),
          endTime: Number(Math.min(duration, endTime).toFixed(3)),
        });
      }
      return list.length > 0 ? list : undefined;
    };
    const videoSentences = sanitizeSentences(parsed.videoSentences, videoDuration);
    const ttsSentences = sanitizeSentences(parsed.ttsSentences, ttsDuration);
    const ttsHasMoreSentences = parsed.ttsHasMoreSentences === true;
    const matchingCutoffTtsTime = typeof parsed.matchingCutoffTtsTime === 'number' && Number.isFinite(parsed.matchingCutoffTtsTime)
      ? Number(parsed.matchingCutoffTtsTime.toFixed(3))
      : undefined;

    // Sanitize and validate anchors
    const sanitizedAnchors: SyncAnchor[] = [];
    let prevVideo = 0;
    let prevTts = 0;

    for (const a of rawAnchors) {
      const vTime = typeof a.videoTime === 'number' ? a.videoTime : Number(a.videoTime);
      const tTime = typeof a.ttsTime === 'number' ? a.ttsTime : Number(a.ttsTime);

      if (!Number.isFinite(vTime) || !Number.isFinite(tTime)) continue;

      // Must be within bounds and strictly chronological
      if (vTime > prevVideo + 0.05 && tTime > prevTts + 0.05 && vTime < videoDuration && tTime < ttsDuration) {
        sanitizedAnchors.push({
          videoTime: Number(vTime.toFixed(3)),
          ttsTime: Number(tTime.toFixed(3)),
          phrase: a.phrase || '',
          // Clamp the AI's targetSpeed to a sane preview range (the raw value
          // is only a hint; real speeds emerge from frame geometry).
          targetSpeed: typeof a.targetSpeed === 'number' ? Math.min(4, Math.max(0.25, a.targetSpeed)) : 1.0,
        });
        prevVideo = vTime;
        prevTts = tTime;
      }
    }

    // If AI returned fewer than 2 valid anchors, generate safe fallback anchors evenly
    if (sanitizedAnchors.length === 0) {
      const stepCount = 3;
      for (let i = 1; i <= stepCount; i++) {
        sanitizedAnchors.push({
          videoTime: Number(((videoDuration * i) / (stepCount + 1)).toFixed(3)),
          ttsTime: Number(((ttsDuration * i) / (stepCount + 1)).toFixed(3)),
          phrase: `Anchor ${i}`,
          targetSpeed: Math.min(4, Math.max(0.25, videoDuration / ttsDuration)),
        });
      }
    }

    return {
      anchors: sanitizedAnchors,
      successfulModel,
      summary,
      verdict,
      videoWords,
      ttsWords,
      videoSentences,
      ttsSentences,
      ttsHasMoreSentences,
      matchingCutoffTtsTime,
    };
  } catch (parseErr: any) {
    throw new Error(`Failed to parse AI speed sync response as JSON: ${parseErr.message}`);
  }
}

/**
 * Transcribes an audio blob using Groq's official Whisper endpoint
 * (whisper-large-v3-turbo / whisper-large-v3) with word-level timestamps
 * (response_format: 'verbose_json', timestamp_granularities: ['word', 'segment']).
 *
 * Returns exact acoustic word boundaries accurate to ~10-20ms.
 */
export async function transcribeWithGroqWhisper(
  audioBlob: Blob,
  preferredModel?: GroqWhisperModel
): Promise<{
  text: string;
  words: SyncWordTiming[];
  sentences: SpeedSyncSentence[];
  duration: number;
  model: string;
}> {
  const { key: apiKey } = getPreferredGroqKey();
  if (!apiKey) {
    throw new Error('Groq API Key is missing. Please configure it in Settings or set VITE_GROQ_API_KEY.');
  }

  const modelOrder: GroqWhisperModel[] = preferredModel
    ? [preferredModel, ...GROQ_WHISPER_MODELS.filter(m => m !== preferredModel)]
    : [...GROQ_WHISPER_MODELS];

  let lastError: Error | null = null;

  for (const model of modelOrder) {
    try {
      console.log(`[AiSpeedSync] Transcribing audio with Groq Whisper model: ${model}...`);
      await globalRateLimiter.waitForSlot();
      if (globalRateLimiter.isInCooldown()) {
        await globalRateLimiter.waitForSlot();
      }
      globalRateLimiter.recordCall();

      const form = new FormData();
      form.append('file', audioBlob, 'audio.wav');
      form.append('model', model);
      form.append('response_format', 'verbose_json');
      form.append('timestamp_granularities[]', 'word');
      form.append('timestamp_granularities[]', 'segment');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.status === 429) {
        globalRateLimiter.startCooldown('groq_429_whisper');
        lastError = new Error(`Groq Whisper model ${model} rate limited (429)`);
        console.warn(`[AiSpeedSync] Groq Whisper model ${model} rate limited (429)`);
        continue;
      }

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        lastError = new Error(`Groq Whisper ${model} returned HTTP ${res.status}: ${errText.slice(0, 160)}`);
        console.warn(`[AiSpeedSync] Groq Whisper model ${model} failed (${res.status}):`, errText.slice(0, 160));
        continue;
      }

      const data = await res.json();
      const words: SyncWordTiming[] = (data?.words || []).map((w: any) => ({
        word: (w.word || '').trim(),
        time: Number((typeof w.start === 'number' ? w.start : 0).toFixed(3)),
        endTime: Number((typeof w.end === 'number' ? w.end : (typeof w.start === 'number' ? w.start + 0.3 : 0.3)).toFixed(3)),
      })).filter((w: SyncWordTiming) => w.word.length > 0 && Number.isFinite(w.time));

      const sentences: SpeedSyncSentence[] = (data?.segments || []).map((s: any) => ({
        text: (s.text || '').trim(),
        startTime: Number((typeof s.start === 'number' ? s.start : 0).toFixed(3)),
        endTime: Number((typeof s.end === 'number' ? s.end : 0).toFixed(3)),
      })).filter((s: SpeedSyncSentence) => s.text.length > 0);

      console.log(`[AiSpeedSync] Successfully transcribed with Groq Whisper (${model}): ${words.length} words, ${sentences.length} segments`);

      return {
        text: (data?.text || '').trim(),
        words,
        sentences,
        duration: typeof data?.duration === 'number' ? data.duration : 0,
        model,
      };
    } catch (err: any) {
      console.warn(`[AiSpeedSync] Groq Whisper error with model ${model}:`, err);
      lastError = err;
    }
  }

  throw lastError ?? new Error('Groq Whisper transcription failed on all models.');
}

/**
 * Runs AI Speed Sync analysis using Groq Whisper for acoustic word-level
 * timestamps and Groq reasoning (openai/gpt-oss-120b) for dialogue alignment.
 */
export async function runGroqSpeedSync(
  videoAudioBlob: Blob | null,
  ttsAudioBlob: Blob,
  videoDuration: number,
  ttsDuration: number,
  preferredWhisperModel?: GroqWhisperModel,
  preferredReasoningModel?: GroqReasoningModel
): Promise<{
  anchors: SyncAnchor[];
  successfulModel: string;
  summary: string;
  verdict?: SpeedSyncVerdict;
  videoWords?: SyncWordTiming[];
  ttsWords?: SyncWordTiming[];
  videoSentences?: SpeedSyncSentence[];
  ttsSentences?: SpeedSyncSentence[];
  ttsHasMoreSentences?: boolean;
  matchingCutoffTtsTime?: number;
}> {
  const { key: apiKey } = getPreferredGroqKey();
  if (!apiKey) {
    throw new Error('Groq API Key is missing. Please configure it in Settings or set VITE_GROQ_API_KEY.');
  }

  // 1. If video has audio, transcribe video audio with Groq Whisper FIRST
  let videoWords: SyncWordTiming[] | undefined;
  let videoSentences: SpeedSyncSentence[] | undefined;
  let videoText = '';
  let successfulWhisperModel: string | undefined = preferredWhisperModel;

  if (videoAudioBlob) {
    try {
      console.log('[AiSpeedSync] Transcribing Video audio with Groq Whisper...');
      const videoWhisper = await transcribeWithGroqWhisper(videoAudioBlob, preferredWhisperModel);
      videoWords = videoWhisper.words;
      videoSentences = videoWhisper.sentences;
      videoText = videoWhisper.text;
      successfulWhisperModel = videoWhisper.model;
    } catch (vErr) {
      console.warn('[AiSpeedSync] Video audio Whisper transcription failed or video has no clear speech:', vErr);
      videoWords = [];
      videoSentences = [];
    }
  }

  // 2. Transcribe TTS audio with Groq Whisper SECOND
  console.log('[AiSpeedSync] Transcribing TTS audio with Groq Whisper...');
  const ttsWhisper = await transcribeWithGroqWhisper(ttsAudioBlob, preferredWhisperModel);
  const ttsWords = ttsWhisper.words;
  const ttsSentences = ttsWhisper.sentences;
  if (videoAudioBlob) {
    successfulWhisperModel = `${successfulWhisperModel} / ${ttsWhisper.model}`;
  } else {
    successfulWhisperModel = ttsWhisper.model;
  }

  const hasVideoSpeech = Boolean(videoWords && videoWords.length > 0);
  const hasTtsSpeech = ttsWords.length > 0;

  if (!hasTtsSpeech) {
    return {
      anchors: [],
      successfulModel: `Groq Whisper (${successfulWhisperModel})`,
      summary: 'TTS audio contains no recognizable speech.',
      verdict: {
        ttsHasSpeech: false,
        videoHasSpeech: hasVideoSpeech,
        sameContent: false,
        reason: 'Groq Whisper detected no speech in the TTS audio file.',
      },
      videoWords,
      ttsWords,
      videoSentences,
      ttsSentences,
      ttsHasMoreSentences: false,
    };
  }

  // 3. Reasoning with Groq LLM (openai/gpt-oss-120b -> llama-3.3-70b-versatile -> llama-3.1-8b-instant)
  const reasoningOrder: GroqReasoningModel[] = preferredReasoningModel
    ? [preferredReasoningModel, ...GROQ_REASONING_MODELS.filter(m => m !== preferredReasoningModel)]
    : [...GROQ_REASONING_MODELS];

  let verdict: SpeedSyncVerdict = {
    ttsHasSpeech: true,
    videoHasSpeech: hasVideoSpeech,
    sameContent: false,
    reason: 'TTS voiceover with Whisper acoustic word alignment.',
  };
  let ttsHasMoreSentences = false;
  let matchingCutoffTtsTime: number | undefined;
  let summary = 'Synchronized video playback speed with TTS voiceover using Groq Whisper.';
  let successfulReasoningModel = '';
  let rawAnchors: SyncAnchor[] = [];

  let systemPrompt = '';
  let userPrompt = '';

  if (hasVideoSpeech) {
    systemPrompt = `You are a world-class audio-visual synchronization and dialogue alignment specialist.
You are given the exact Whisper-transcribed words and sentence segments of:
1. Video Audio (${videoDuration.toFixed(2)}s)
2. TTS Voiceover Audio (${ttsDuration.toFixed(2)}s)

Your task:
1. Compare the sentences between Video and TTS.
2. Determine if TTS has extra sentences or additional dialogue beyond what is spoken in the Video clip (e.g. video dialogue ends after sentence N, but TTS continues speaking more sentences).
3. If TTS has extra sentences, specify the exact cutoff timestamp in seconds in the TTS audio (matchingCutoffTtsTime) where the matching video dialogue ends, right before the next unmatched sentence begins.
4. Verdict:
   - sameContent: false (if TTS is a synthesized voiceover, even reading the same script, set false so speed sync can proceed). Set true ONLY if it is the exact identical acoustic recording file.
   - ttsHasSpeech: true
   - videoHasSpeech: true
   - reason: concise explanation.
5. Provide a short summary of the pacing differences.
6. Provide 3 to 8 fallback anchors: [{ "videoTime": seconds, "ttsTime": seconds, "phrase": "...", "targetSpeed": number }].

Return ONLY strict JSON matching this structure:
{
  "verdict": { "ttsHasSpeech": true, "videoHasSpeech": true, "sameContent": false, "reason": "..." },
  "ttsHasMoreSentences": boolean,
  "matchingCutoffTtsTime": number,
  "summary": "...",
  "anchors": [ { "videoTime": 1.0, "ttsTime": 1.2, "phrase": "...", "targetSpeed": 1.0 } ]
}`;

    userPrompt = `VIDEO AUDIO:
- Duration: ${videoDuration.toFixed(2)}s
- Transcript: "${videoText}"
- Sentences: ${JSON.stringify(videoSentences)}

TTS AUDIO:
- Duration: ${ttsDuration.toFixed(2)}s
- Transcript: "${ttsWhisper.text}"
- Sentences: ${JSON.stringify(ttsSentences)}`;
  } else {
    // Video has no speech — analyze TTS cadence and distribute natural speed ramping
    systemPrompt = `You are a professional video speed-ramping and pacing editor.
The user wants to sync a video clip (${videoDuration.toFixed(2)}s) with a TTS voiceover (${ttsDuration.toFixed(2)}s).
The video clip has no dialogue, so we must pace the video to match the spoken rhythm and sentence structure of the TTS audio provided.

TASK:
1. Analyze the TTS cadence, sentence pauses, and punchlines from these exact Whisper-transcribed words and segments.
2. Distribute 3 to 8 speed frame anchor points to create dynamic, cinematic speed ramping:
   - Slightly accelerate video through spoken pauses.
   - Settle at natural speed (0.9x - 1.2x) on key phrases and emphasis words.
3. For each anchor:
   - "videoTime": mapped source moment in seconds (0.00 to ${videoDuration.toFixed(2)}).
   - "ttsTime": spoken timestamp in TTS audio (0.00 to ${ttsDuration.toFixed(2)}).
   - "phrase": words spoken or event at this moment.
   - "targetSpeed": speed multiplier.

Return ONLY strict JSON matching this structure:
{
  "verdict": { "ttsHasSpeech": true, "videoHasSpeech": false, "sameContent": false, "reason": "..." },
  "summary": "...",
  "anchors": [ { "videoTime": 1.0, "ttsTime": 1.2, "phrase": "...", "targetSpeed": 1.1 } ]
}`;

    userPrompt = `TTS AUDIO (${ttsDuration.toFixed(2)}s):
- Transcript: "${ttsWhisper.text}"
- Sentences: ${JSON.stringify(ttsSentences)}`;
  }

  for (const model of reasoningOrder) {
    try {
      console.log(`[AiSpeedSync] Running Groq reasoning with model: ${model}...`);
      await globalRateLimiter.waitForSlot();
      if (globalRateLimiter.isInCooldown()) {
        await globalRateLimiter.waitForSlot();
      }
      globalRateLimiter.recordCall();

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 35000);

      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.2,
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.status === 429) {
        globalRateLimiter.startCooldown('groq_429_chat');
        console.warn(`[AiSpeedSync] Groq reasoning model ${model} rate limited (429)`);
        continue;
      }

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        console.warn(`[AiSpeedSync] Groq reasoning model ${model} failed (${res.status}):`, errText.slice(0, 160));
        continue;
      }

      const chatData = await res.json();
      const content = chatData?.choices?.[0]?.message?.content;
      if (!content) continue;

      const parsed = JSON.parse(extractJsonFromLlmResponse(content));
      if (parsed.verdict) verdict = parsed.verdict;
      if (typeof parsed.ttsHasMoreSentences === 'boolean') ttsHasMoreSentences = parsed.ttsHasMoreSentences;
      if (typeof parsed.matchingCutoffTtsTime === 'number') matchingCutoffTtsTime = parsed.matchingCutoffTtsTime;
      if (parsed.summary) summary = parsed.summary;
      if (Array.isArray(parsed.anchors)) rawAnchors = parsed.anchors;

      successfulReasoningModel = model;
      console.log(`[AiSpeedSync] Successfully analyzed with Groq model: ${model}`);
      break;
    } catch (rErr) {
      console.warn(`[AiSpeedSync] Groq reasoning failed with model ${model}:`, rErr);
    }
  }

  // Sanitize fallback anchors
  const sanitizedAnchors: SyncAnchor[] = [];
  let prevVideo = -1;
  let prevTts = -1;
  for (const a of rawAnchors) {
    const vTime = Number(a.videoTime);
    const tTime = Number(a.ttsTime);
    if (!Number.isFinite(vTime) || !Number.isFinite(tTime)) continue;
    if (vTime > prevVideo + 0.05 && tTime > prevTts + 0.05 && vTime < videoDuration && tTime < ttsDuration) {
      sanitizedAnchors.push({
        videoTime: Number(vTime.toFixed(3)),
        ttsTime: Number(tTime.toFixed(3)),
        phrase: a.phrase || '',
        targetSpeed: typeof a.targetSpeed === 'number' ? Math.min(4, Math.max(0.25, a.targetSpeed)) : 1.0,
      });
      prevVideo = vTime;
      prevTts = tTime;
    }
  }

  if (sanitizedAnchors.length === 0) {
    const stepCount = 3;
    for (let i = 1; i <= stepCount; i++) {
      sanitizedAnchors.push({
        videoTime: Number(((videoDuration * i) / (stepCount + 1)).toFixed(3)),
        ttsTime: Number(((ttsDuration * i) / (stepCount + 1)).toFixed(3)),
        phrase: `Anchor ${i}`,
        targetSpeed: Math.min(4, Math.max(0.25, videoDuration / ttsDuration)),
      });
    }
  }

  const modelLabel = successfulReasoningModel
    ? `Groq Whisper (${successfulWhisperModel}) + ${successfulReasoningModel}`
    : `Groq Whisper (${successfulWhisperModel})`;

  return {
    anchors: sanitizedAnchors,
    successfulModel: modelLabel,
    summary,
    verdict,
    videoWords,
    ttsWords,
    videoSentences,
    ttsSentences,
    ttsHasMoreSentences,
    matchingCutoffTtsTime,
  };
}

/**
 * Deterministic word-level alignment: matches TTS word timings against video
 * word timings and builds anchors — the alignment MATH is done here, not left
 * to the model (the AI only marks word timings in both audios).
 *
 * Handles every wording mismatch case:
 * - Equal wording: 1:1 word pairs → anchors at each matched word.
 * - TTS has EXTRA words (TTS wording fuller than the video, e.g. the AI video
 *   skips filler the TTS speaks): unmatched TTS words are covered by linear
 *   interpolation through the surrounding matched anchors — the video content
 *   between them is stretched/compressed to fit, and a trailing-hold anchor
 *   keeps the video near its last matched position instead of compressing its
 *   remaining content fast.
 * - Video has EXTRA words (video speaks more than the TTS): unmatched video
 *   words are simply consumed faster — the interpolation through matched
 *   anchors compresses them.
 * - No word matches at all: returns [] → caller falls back to the AI's
 *   cadence anchors.
 */
/**
 * Fuzzy word matching to handle minor transcription discrepancies, contractions, and plural endings.
 */
function wordsMatch(w1: string, w2: string): boolean {
  if (w1 === w2) return true;
  if (!w1 || !w2) return false;
  const minLen = Math.min(w1.length, w2.length);
  if (minLen >= 4 && (w1.startsWith(w2.slice(0, minLen - 1)) || w2.startsWith(w1.slice(0, minLen - 1)))) {
    return true;
  }
  if (w1.length >= 5 && w2.length >= 5 && Math.abs(w1.length - w2.length) <= 1) {
    let diff = 0;
    const len = Math.min(w1.length, w2.length);
    for (let i = 0; i < len; i++) {
      if (w1[i] !== w2[i]) diff++;
      if (diff > 1) break;
    }
    if (diff <= 1) return true;
  }
  return false;
}

/**
 * Deterministic word-level alignment: matches TTS word timings against video
 * word timings and builds anchors — the alignment MATH is done here, not left
 * to the model (the AI only marks word timings in both audios).
 *
 * Handles every wording mismatch case:
 * - Equal wording: 1:1 word pairs → anchors at each matched word.
 * - TTS has EXTRA words (TTS wording fuller than the video, e.g. the AI video
 *   skips filler the TTS speaks): unmatched TTS words are covered by linear
 *   interpolation through the surrounding matched anchors — the video content
 *   between them is stretched/compressed to fit, and a trailing-hold anchor
 *   keeps the video near its last matched position instead of compressing its
 *   remaining content fast.
 * - Video has EXTRA words (video speaks more than the TTS): unmatched video
 *   words are simply consumed faster — the interpolation through matched
 *   anchors compresses them.
 * - No word matches at all: returns [] → caller falls back to the AI's
 *   cadence anchors.
 */
export function buildAnchorsFromWordTimings(
  videoWords: SyncWordTiming[],
  ttsWords: SyncWordTiming[],
  videoDuration: number,
  ttsDuration: number
): SyncAnchor[] {
  const normalize = (w: string) =>
    (w || '').toLowerCase().replace(/[.,!?،۔؟;:\"'`\-–—()\[\]{}]/g, '').trim();

  const vWords = videoWords.filter((w) => Number.isFinite(w.time) && normalize(w.word).length > 0);
  const tWords = ttsWords.filter((w) => Number.isFinite(w.time) && normalize(w.word).length > 0);
  if (vWords.length === 0 || tWords.length === 0) return [];

  const rawAnchors: SyncAnchor[] = [];
  let vi = 0;          // video word cursor — strictly monotone forward
  let lastTts = -1;
  let lastVideo = -1;  // BUG 7 FIX: track video time monotonicity
  let matchedAny = false;
  let consecutiveMisses = 0; // BUG 2 FIX: track consecutive failures

  for (let ti = 0; ti < tWords.length; ti++) {
    const tWord = tWords[ti];
    const tNorm = normalize(tWord.word);

    // BUG 2 FIX: expanded lookahead from 3 to 8 words — handles larger video
    // intro/filler phrases (e.g. "Hey guys welcome back today..." where TTS
    // starts at "today" = 4 words deep) that the old ±3 window could never reach.
    let matchIdx = -1;
    for (let look = 0; look <= 8; look++) {
      const cand = vWords[vi + look];
      if (!cand) break;
      if (wordsMatch(normalize(cand.word), tNorm)) { matchIdx = vi + look; break; }
    }

    if (matchIdx >= 0) {
      const vWord = vWords[matchIdx];
      // BUG 7 FIX: enforce BOTH video and TTS time monotonicity
      if (tWord.time > lastTts + 0.05 && vWord.time > lastVideo + 0.03 && vWord.time < videoDuration - 0.05) {
        rawAnchors.push({
          videoTime: Number(vWord.time.toFixed(3)),
          ttsTime: Number(tWord.time.toFixed(3)),
          phrase: tWord.word,
          matched: true,
        });
        lastTts = tWord.time;
        lastVideo = vWord.time;
        matchedAny = true;
      }
      vi = matchIdx + 1;
      consecutiveMisses = 0;
    } else {
      consecutiveMisses++;
      // BUG 2 FIX: skip-ahead mechanism — when 5+ consecutive TTS words fail
      // to match, the video cursor may be stuck behind a long filler phrase.
      // Advance vi by 1 to try scanning from the next video word position.
      if (consecutiveMisses >= 5 && vi < vWords.length - 1) {
        vi++;
        consecutiveMisses = 0;
      }
    }
    // Unmatched TTS word (extra / filler): intentionally skipped — the linear
    // interpolation through the surrounding matched anchors stretches the
    // video's content across it, so its delivery timing still matches.
  }

  if (!matchedAny) return [];

  // BUG 6 FIX (Reverted): User specifically requested word-by-word delivery timing.
  // Instead of merging anchors into phrase-level anchors, we pass through all matched
  // word-level anchors to achieve exact per-word alignment.
  const anchors: SyncAnchor[] = rawAnchors;

  // Trailing hold — "TTS wording is better than video clip": when the TTS
  // keeps speaking after the video's last matched word, advance smoothly rather
  // than freezing.
  const lastAnchor = anchors[anchors.length - 1];
  const trailing = ttsDuration - 0.05 - lastAnchor.ttsTime;
  if (trailing > 0.15) {
    const remainingSpan = Math.max(0, videoDuration - 0.05 - lastAnchor.videoTime);
    const holdAdvance = Math.min(remainingSpan, trailing * 0.85);
    anchors.push({
      videoTime: Number((lastAnchor.videoTime + holdAdvance).toFixed(3)),
      ttsTime: Number((ttsDuration - 0.05).toFixed(3)),
      phrase: 'Hold for trailing TTS',
      stretch: true,
    });
  }

  return anchors;
}

/**
 * Detects whether the TTS voiceover contains more sentences/dialogue than the
 * video clip, and if so, computes the exact cutoff time (in seconds from TTS
 * start) where the video's matching dialogue ends.
 *
 * Combines:
 * 1. Explicit sentence breakdown (ttsSentences.length > videoSentences.length)
 * 2. Explicit AI flag & cutoff (ttsHasMoreSentences, matchingCutoffTtsTime)
 * 3. Word-level alignment analysis with trailing word counts, sentence boundary
 *    punctuation (. ! ?), and audio duration gap.
 */
export function detectTtsExtraSentences(params: {
  videoWords?: SyncWordTiming[];
  ttsWords?: SyncWordTiming[];
  videoSentences?: SpeedSyncSentence[];
  ttsSentences?: SpeedSyncSentence[];
  geminiHasMoreSentences?: boolean;
  geminiMatchingCutoffTime?: number;
  videoDuration: number;
  ttsDuration: number;
}): TtsExtraSentenceDetection {
  const {
    videoWords,
    ttsWords,
    videoSentences,
    ttsSentences,
    geminiHasMoreSentences,
    geminiMatchingCutoffTime,
    videoDuration,
    ttsDuration,
  } = params;

  const normalize = (w: string) =>
    (w || '').toLowerCase().replace(/[.,!?،۔؟;:"'`\-–—()[\]{}]/g, '').trim();

  // 1. TIER 1 (PRIMARY): Word-level Acoustic Alignment
  // Words are ground-truth dialogue timings from Whisper.
  if (videoWords && ttsWords && videoWords.length > 0 && ttsWords.length > 0) {
    const vWords = videoWords.filter((w) => Number.isFinite(w.time) && normalize(w.word).length > 0);
    const tWords = ttsWords.filter((w) => Number.isFinite(w.time) && normalize(w.word).length > 0);

    if (vWords.length >= 2 && tWords.length >= 2) {
      let vi = 0;
      let lastMatchedTi = -1;
      let matchCount = 0;

      for (let ti = 0; ti < tWords.length; ti++) {
        const tNorm = normalize(tWords[ti].word);
        let matchIdx = -1;
        for (let look = 0; look <= 10; look++) {
          const cand = vWords[vi + look];
          if (!cand) break;
          if (wordsMatch(normalize(cand.word), tNorm)) {
            matchIdx = vi + look;
            break;
          }
        }
        if (matchIdx >= 0) {
          lastMatchedTi = ti;
          vi = matchIdx + 1;
          matchCount++;
        }
      }

      // Check if TTS has trailing words after the last match
      if (matchCount >= 2 && lastMatchedTi >= 0 && lastMatchedTi < tWords.length - 1) {
        const remainingTtsWords = tWords.slice(lastMatchedTi + 1);
        const lastWord = tWords[lastMatchedTi];
        const lastWordEnd = (lastWord.endTime && lastWord.endTime > lastWord.time)
          ? lastWord.endTime
          : (lastWord.time + 0.25);
        const nextWord = remainingTtsWords[0];
        const nextWordStart = nextWord.time;
        const remainingDuration = ttsDuration - lastWordEnd;

        // User requested: Apply exact split where its last match to the Video Clip
        if (remainingTtsWords.length >= 1 && remainingDuration >= 0.20) {
          let cutoff = nextWordStart > lastWordEnd
            ? (lastWordEnd + nextWordStart) / 2
            : (lastWordEnd + 0.05);

          // If AI reasoning provided a cutoff in the pause between last matched word and next word, use it
          if (
            typeof geminiMatchingCutoffTime === 'number' &&
            geminiMatchingCutoffTime >= lastWord.time &&
            geminiMatchingCutoffTime <= (nextWordStart + 0.1)
          ) {
            cutoff = geminiMatchingCutoffTime;
          } else if (ttsSentences && ttsSentences.length >= 2) {
            const sentMatch = ttsSentences.find(s => (lastWord.time >= s.startTime && lastWord.time <= s.endTime) || Math.abs(s.endTime - lastWordEnd) < 0.4);
            const sentIdx = sentMatch ? ttsSentences.indexOf(sentMatch) : -1;
            if (sentIdx >= 0 && sentIdx < ttsSentences.length - 1) {
              const currentSent = ttsSentences[sentIdx];
              const nextSent = ttsSentences[sentIdx + 1];
              if (nextSent.startTime > currentSent.endTime) {
                cutoff = (currentSent.endTime + nextSent.startTime) / 2;
              }
            }
          }

          cutoff = Math.max(0.15, Math.min(ttsDuration - 0.15, cutoff));

          if (cutoff > 0.15 && cutoff < ttsDuration - 0.15) {
            return {
              hasMoreSentences: true,
              matchingCutoffTime: Number(cutoff.toFixed(3)),
              matchingSentenceCount: 1,
              totalTtsSentences: 2,
              reason: `Exact split at word "${lastWord.word}" (${cutoff.toFixed(2)}s). TTS has ${remainingTtsWords.length} extra spoken words after video dialogue ends.`,
            };
          }
        }
      }
    }
  }

  // 2. TIER 2: Explicit sentence segments (when words list is omitted or has no matches)
  if (videoSentences && ttsSentences && videoSentences.length > 0 && ttsSentences.length > videoSentences.length) {
    const matchedSentencesCount = videoSentences.length;
    const lastMatchedTtsSentence = ttsSentences[matchedSentencesCount - 1];
    const nextTtsSentence = ttsSentences[matchedSentencesCount];

    if (lastMatchedTtsSentence && nextTtsSentence) {
      // Place the split in the pause between sentences
      const pauseMidpoint = (lastMatchedTtsSentence.endTime + nextTtsSentence.startTime) / 2;
      const cutoff = Math.max(lastMatchedTtsSentence.endTime + 0.05, Math.min(nextTtsSentence.startTime - 0.05, pauseMidpoint));
      if (cutoff > 0.25 && cutoff < ttsDuration - 0.25) {
        return {
          hasMoreSentences: true,
          matchingCutoffTime: Number(cutoff.toFixed(3)),
          matchingSentenceCount: matchedSentencesCount,
          totalTtsSentences: ttsSentences.length,
          reason: `TTS has ${ttsSentences.length} sentences; video clip only contains ${matchedSentencesCount} sentence${matchedSentencesCount > 1 ? 's' : ''}.`,
        };
      }
    }
  }

  // 3. TIER 3: Explicit AI flag and cutoff timestamp
  if (
    geminiHasMoreSentences === true &&
    typeof geminiMatchingCutoffTime === 'number' &&
    geminiMatchingCutoffTime > 0.3 &&
    geminiMatchingCutoffTime < ttsDuration - 0.25
  ) {
    return {
      hasMoreSentences: true,
      matchingCutoffTime: Number(geminiMatchingCutoffTime.toFixed(3)),
      reason: 'AI detected that TTS continues with additional sentences beyond the video clip dialogue.',
    };
  }

  return { hasMoreSentences: false, matchingCutoffTime: 0 };
}

/**
 * Constructs clean, clamped SpeedFrame objects from the AI anchors.
 */
export function buildSpeedFramesFromAnchors(
  videoClip: TimelineClip,
  ttsClip: TimelineClip,
  anchors: SyncAnchor[],
  sourceDuration?: number
): {
  speedFrames: SpeedFrame[];
  newDuration: number;
  fixedSourceEnd: number;
  segments: SpeedFrameSegment[];
} {
  const trimStart = Math.max(0, videoClip.trimStart || 0);
  const effectiveSpeed = videoClip.speed || 1.0;
  const currentSpan = videoClip.speedFrameSourceEnd
    ? (videoClip.speedFrameSourceEnd - trimStart)
    : (videoClip.duration * effectiveSpeed);
  let fixedSourceEnd = videoClip.speedFrameSourceEnd ?? (trimStart + currentSpan);

  const newDuration = Math.max(0.2, ttsClip.duration);

  // Convert each anchor into a SpeedFrame
  const validFrames: SpeedFrame[] = [];
  let lastOffset = -0.15;
  let lastSource = trimStart - 0.05;

  const MIN_SPEED_FRAME_INTERVAL = 0.15; // 150ms minimum spacing between speed frames
  const MIN_SEGMENT_SPEED = 0.35;        // safe minimum playback rate for decoder
  const MAX_SEGMENT_SPEED = 2.5;         // safe maximum playback rate for decoder

  for (let i = 0; i < anchors.length; i++) {
    const anchor = anchors[i];
    const offset = Math.max(0.05, Math.min(newDuration - 0.05, anchor.ttsTime));
    const rawSrc = Math.max(trimStart + 0.02, Math.min(fixedSourceEnd - 0.02, trimStart + anchor.videoTime));

    // Monotonicity check: reject non-chronological or backwards video anchors
    if (rawSrc <= lastSource + 0.01) {
      continue;
    }

    let src = rawSrc;

    if (validFrames.length === 0) {
      if (offset >= 0.05) {
        validFrames.push({
          id: `sf_ai_${i + 1}_${Math.random().toString(36).substring(2, 7)}`,
          timelineOffset: Number(offset.toFixed(4)),
          sourceTime: Number(src.toFixed(4)),
        });
        lastOffset = offset;
        lastSource = src;
      }
    } else if (offset >= lastOffset + MIN_SPEED_FRAME_INTERVAL) {
      const deltaT = offset - lastOffset;
      // Clamp implied segment speed so hardware decoders never thrash or stall
      const minSrc = lastSource + deltaT * MIN_SEGMENT_SPEED;
      const maxSrc = lastSource + deltaT * MAX_SEGMENT_SPEED;
      src = Math.max(minSrc, Math.min(maxSrc, src));
      src = Math.max(trimStart + 0.02, Math.min(fixedSourceEnd - 0.02, src));

      if (src > lastSource + 0.01) {
        validFrames.push({
          id: `sf_ai_${i + 1}_${Math.random().toString(36).substring(2, 7)}`,
          timelineOffset: Number(offset.toFixed(4)),
          sourceTime: Number(src.toFixed(4)),
        });
        lastOffset = offset;
        lastSource = src;
      }
    }
  }

  // Trailing segment handling: ensure natural pacing rather than a slow crawl or freeze
  const hasStretchAnchor = anchors.some(a => a.stretch);
  if (hasStretchAnchor && validFrames.length > 0) {
    const lastFrame = validFrames[validFrames.length - 1];
    const remainingTime = Math.max(0.05, newDuration - lastFrame.timelineOffset);
    const remainingSource = Math.max(0, fixedSourceEnd - lastFrame.sourceTime);
    // Natural pacing: advance source at normal video speed (~0.85x - 1.0x) rather than freezing at 0.01x
    const naturalAdvance = Math.min(remainingSource, remainingTime * effectiveSpeed);
    const stretchSourceEnd = lastFrame.sourceTime + Math.max(0.15, naturalAdvance);
    if (stretchSourceEnd < fixedSourceEnd) {
      fixedSourceEnd = stretchSourceEnd;
    }
  }

  const tempClip = {
    ...videoClip,
    duration: newDuration,
    speedFrames: validFrames,
    speedFrameSourceEnd: fixedSourceEnd,
  };

  const segments = getSpeedFrameSegments(tempClip, sourceDuration);

  return {
    speedFrames: validFrames,
    newDuration,
    fixedSourceEnd,
    segments,
  };
}

/**
 * High-level orchestration function that syncs a video clip to a TTS audio clip.
 */
export async function syncVideoClipWithTts(
  videoClipId: string,
  ttsClipId: string,
  options: AiSpeedSyncOptions = {},
  onProgress?: (progress: number, message: string) => void,
  _extractAudio = extractClipAudioToWav,
  _runGemini = runGeminiSpeedSync,
  _runGroq = runGroqSpeedSync
): Promise<AiSpeedSyncResult> {
  const store = useEditorStore.getState();
  const foundVideo = findClipInTracks(store.tracks, videoClipId, store.pipWindows);
  const foundTts = findClipInTracks(store.tracks, ttsClipId, store.pipWindows);

  if (!foundVideo) throw new Error('Selected Video Clip was not found on the timeline.');
  if (!foundTts) throw new Error('Selected TTS Audio Clip was not found on the timeline.');

  const videoClip = foundVideo;
  const ttsClip = foundTts;

  const videoMedia = store.mediaLibrary.find(m => m.id === videoClip.mediaId);
  const ttsMedia = store.mediaLibrary.find(m => m.id === ttsClip.mediaId);

  if (!ttsMedia?.url) {
    throw new Error('TTS Audio Clip does not have valid audio media.');
  }

  // ── Wrong-audio-clip validation (pre-flight, before any AI work) ──────────
  // The user may select the video's own media as the "TTS voiceover" — syncing
  // a clip against itself produces garbage. Reject immediately.
  if (ttsClip.mediaId === videoClip.mediaId) {
    throw new Error('The TTS clip is the same media as the video clip. Select a separate TTS voiceover audio clip.');
  }
  if (ttsClip.id === videoClip.id) {
    throw new Error('Please select different clips for video and TTS audio.');
  }
  if (ttsClip.linkedClipId === videoClip.id || videoClip.linkedClipId === ttsClip.id) {
    throw new Error('The selected audio clip is the unlinked original audio from this video clip. Please select a separate TTS voiceover clip.');
  }

  // 1. Extract Video Audio
  onProgress?.(10, 'Scanning Video Clip audio...');
  const videoAudio = await _extractAudio(
    videoClip,
    videoMedia?.url || '',
    videoMedia?.id
  );

  // 2. Extract TTS Audio
  onProgress?.(30, 'Scanning TTS Voiceover audio...');
  const ttsAudio = await _extractAudio(
    ttsClip,
    ttsMedia.url,
    ttsMedia.id
  );

  if (!ttsAudio.wavBlob) {
    throw new Error('Could not decode audio from the selected TTS clip. It may be a music file without a decodable audio track — select a valid TTS voiceover clip.');
  }

  // Local silence check — a silent TTS clip (wrong selection) cannot anchor
  // anything. RMS threshold is conservative: real speech at 16kHz mono is
  // typically > 0.02; near-silence is < 0.005.
  if (ttsAudio.hasAudio && ttsAudio.rmsEnergy < 0.005) {
    throw new Error('The selected TTS clip audio is silent. Please select a valid TTS voiceover clip with speech.');
  }

  // 3. AI Analysis & Word Timing
  // Provider resolution:
  // - If provider is 'groq': use Groq Whisper + reasoning (throw if Groq fails)
  // - If provider is 'gemini': use Gemini Multimodal
  // - If provider is 'auto' (default): try Groq if Groq key exists, else Gemini. If Groq fails, fall back to Gemini.
  const provider = options.provider || 'auto';
  const shouldTryGroq = (provider === 'groq' || provider === 'auto') && hasAnyGroqKey();

  let analysis: {
    anchors: SyncAnchor[];
    successfulModel: string;
    summary: string;
    verdict?: SpeedSyncVerdict;
    videoWords?: SyncWordTiming[];
    ttsWords?: SyncWordTiming[];
    videoSentences?: SpeedSyncSentence[];
    ttsSentences?: SpeedSyncSentence[];
    ttsHasMoreSentences?: boolean;
    matchingCutoffTtsTime?: number;
  };

  if (shouldTryGroq) {
    try {
      onProgress?.(50, 'Transcribing with Groq Whisper & analyzing word timing...');
      analysis = await _runGroq(
        videoAudio.wavBlob,
        ttsAudio.wavBlob,
        videoAudio.duration,
        ttsAudio.duration,
        options.groqWhisperModel,
        options.groqReasoningModel
      );
    } catch (groqErr) {
      console.warn('[AiSpeedSync] Groq Whisper/reasoning failed:', groqErr);
      if (provider === 'groq') {
        throw groqErr;
      }
      onProgress?.(55, 'Groq unavailable, falling back to Gemini Multimodal...');
      analysis = await _runGemini(
        videoAudio.wavBlob,
        ttsAudio.wavBlob,
        videoAudio.duration,
        ttsAudio.duration,
        options.targetModel
      );
    }
  } else {
    onProgress?.(55, 'AI marking word timings in video & TTS audio...');
    analysis = await _runGemini(
      videoAudio.wavBlob,
      ttsAudio.wavBlob,
      videoAudio.duration,
      ttsAudio.duration,
      options.targetModel
    );
  }

  const { anchors: aiAnchors, successfulModel, summary, verdict } = analysis;

  // ── Wrong-audio-clip validation (AI verdict) ──────────────────────────────
  if (verdict) {
    if (verdict.ttsHasSpeech === false) {
      throw new Error('AI detected that the selected TTS clip does not contain speech (music/noise/silence). Please select a valid TTS voiceover clip.');
    }
    if (verdict.sameContent === true) {
      // Differentiate between an identical duplicate audio file vs. a separate TTS voiceover reading the same script.
      // If duration differs or word timestamps have shifted, it is a valid separate voiceover with different pacing!
      const durationDiff = Math.abs(videoAudio.duration - ttsAudio.duration);
      const hasWordTimings = Boolean(
        analysis.videoWords && analysis.ttsWords &&
        analysis.videoWords.length > 0 && analysis.ttsWords.length > 0
      );

      let wordsIdenticalTiming = false;
      if (hasWordTimings && analysis.videoWords!.length === analysis.ttsWords!.length) {
        wordsIdenticalTiming = analysis.videoWords!.every((vw, i) => {
          const tw = analysis.ttsWords![i];
          return Math.abs(vw.time - tw.time) < 0.04;
        });
      }

      // Only reject if it is genuinely the identical recording at identical speed (zero pacing difference)
      if (durationDiff < 0.05 && wordsIdenticalTiming) {
        throw new Error('AI detected that the selected audio is the original clip\'s own audio, not a separate TTS voiceover. Please select the TTS clip.');
      } else {
        console.log('[AiSpeedSync] Note: AI reported sameContent=true (matching dialogue script), but pacing differences confirm it is a separate TTS voiceover. Proceeding with sync.');
      }
    }
    // videoHasSpeech === false is NOT an error — silent AI-generated video is
    // expected; the cadence/word mapping still works via TTS timings.
  }

  // ── Sentence Matching Detection: split TTS if it has more sentences ─────
  const ttsExtraInfo = detectTtsExtraSentences({
    videoWords: analysis.videoWords,
    ttsWords: analysis.ttsWords,
    videoSentences: analysis.videoSentences,
    ttsSentences: analysis.ttsSentences,
    geminiHasMoreSentences: analysis.ttsHasMoreSentences,
    geminiMatchingCutoffTime: analysis.matchingCutoffTtsTime,
    videoDuration: videoAudio.duration,
    ttsDuration: ttsAudio.duration,
  });

  let activeTtsClip = ttsClip;
  let ttsSplitApplied = false;
  let ttsSplitPoint: number | undefined;
  let ttsRemainingClipId: string | undefined;

  if (
    ttsExtraInfo.hasMoreSentences &&
    ttsExtraInfo.matchingCutoffTime > 0.25 &&
    ttsExtraInfo.matchingCutoffTime < ttsClip.duration - 0.2
  ) {
    const matchingCutoff = ttsExtraInfo.matchingCutoffTime;
    onProgress?.(70, `Splitting TTS at matching point (${matchingCutoff.toFixed(2)}s)...`);
    console.log(`[AiSpeedSync] TTS has more sentences than video clip. Splitting TTS at ${matchingCutoff}s...`);

    const splitTimelineTime = ttsClip.startTime + matchingCutoff;
    const splitResult = store.splitClip(ttsClip.id, splitTimelineTime, false);

    ttsSplitApplied = true;
    ttsSplitPoint = matchingCutoff;
    ttsRemainingClipId = splitResult?.rightId || ttsClip.id;

    // Retrieve the left clip (matching portion of TTS)
    const currentTracks = useEditorStore.getState().tracks;
    const leftClipId = splitResult?.leftId;
    const foundLeftClip = leftClipId ? findClipInTracks(currentTracks, leftClipId, store.pipWindows) : null;

    activeTtsClip = foundLeftClip || {
      ...ttsClip,
      duration: matchingCutoff,
    };
  }

  // ── Anchor derivation: prefer word-level matching, fall back to cadence ───
  let anchors = aiAnchors;
  let alignmentMode: 'word-level' | 'ai-anchors' = 'ai-anchors';

  const effectiveTtsDuration = ttsSplitApplied && ttsSplitPoint ? ttsSplitPoint : ttsAudio.duration;
  const effectiveTtsWords = (ttsSplitApplied && ttsSplitPoint && analysis.ttsWords)
    ? analysis.ttsWords.filter(w => w.time <= ttsSplitPoint + 0.05)
    : analysis.ttsWords;

  if (analysis.videoWords && effectiveTtsWords &&
      analysis.videoWords.length > 0 && effectiveTtsWords.length > 0) {
    const wordAnchors = buildAnchorsFromWordTimings(
      analysis.videoWords,
      effectiveTtsWords,
      videoAudio.duration,
      effectiveTtsDuration
    );
    if (wordAnchors.length >= 2) {
      anchors = wordAnchors;
      alignmentMode = 'word-level';
    }
  }

  // If TTS was split, ensure anchors do not exceed matching cutoff or contain trailing stretch
  if (ttsSplitApplied && ttsSplitPoint) {
    anchors = anchors.filter(a => !a.stretch && a.ttsTime < ttsSplitPoint! - 0.02);
    if (anchors.length === 0) {
      anchors = [
        {
          videoTime: Number((videoAudio.duration * 0.5).toFixed(3)),
          ttsTime: Number((ttsSplitPoint * 0.5).toFixed(3)),
          phrase: 'Matching pace',
          targetSpeed: Math.min(4, Math.max(0.25, videoAudio.duration / ttsSplitPoint)),
        },
      ];
    }
  }

  // 4. Calculate Speed Frames
  onProgress?.(85, 'Calculating Speed Frames & rate-stretching video...');
  const { speedFrames, newDuration, fixedSourceEnd, segments } = buildSpeedFramesFromAnchors(
    videoClip,
    activeTtsClip,
    anchors,
    videoMedia?.duration
  );
  const stretchFrameCount = anchors.filter((a) => a.stretch).length;

  // 5. Apply to Clip in Store
  const alignStart = options.alignStartTime !== false;
  const muteOriginal = options.muteOriginalAudio !== false;

  const updatedClip: TimelineClip = {
    ...videoClip,
    startTime: alignStart ? activeTtsClip.startTime : videoClip.startTime,
    duration: newDuration,
    // Reset base speed to 1.0 — speed frames now control per-segment playback
    // rate. A stale clip.speed (e.g. 2.0 from user edits) would corrupt
    // getClipSourceEnd fallback calculations.
    speed: 1.0,
    speedFrames,
    speedFrameSourceEnd: fixedSourceEnd,
    audioSettings: muteOriginal
      ? {
          // BUG FIX: the user's existing settings are spread FIRST and the
          // explicit mute/zeros AFTER — the old order (volume: 0 before the
          // spread) let a pre-existing custom volume survive "mute original
          // audio", so the TTS was not isolated.
          ...(videoClip.audioSettings || {}),
          pan: 0,
          fadeIn: 0,
          fadeOut: 0,
          bass: 0,
          treble: 0,
          pitch: 0,
          voiceFormant: 0,
          preservePitch: true,
          humanize: false,
          volume: 0,
          muted: true,
        }
      : videoClip.audioSettings,
  };
  updatedClip.speedRamp = calculateSpeedFramesRamp(updatedClip, videoMedia?.duration);

  // Update in store
  store.updateClip(videoClip.id, updatedClip);
  store.selectClip(videoClip.id);
  store.recalcTotalDuration();
  store.saveSnapshot(
    ttsSplitApplied
      ? 'AI Speed Sync (Split TTS & Applied Speed Frames)'
      : 'AI Speed Sync with TTS'
  );

  onProgress?.(100, `Done! Synced with ${successfulModel}`);

  return {
    videoClipId,
    ttsClipId,
    anchors,
    speedFrames,
    segments,
    newDuration,
    successfulModel,
    summary,
    alignmentMode,
    verdict,
    stretchFrameCount,
    ttsSplitApplied,
    ttsSplitPoint,
    ttsRemainingClipId,
    matchingSentenceCount: ttsExtraInfo.matchingSentenceCount,
    totalTtsSentences: ttsExtraInfo.totalTtsSentences,
    splitReason: ttsExtraInfo.reason,
  };
}
