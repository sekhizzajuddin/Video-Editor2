import { TimelineClip, SpeedFrame } from '@/types';
import { useEditorStore, findClipInTracks } from '@/store/editorStore';
import { getGeminiKey } from './aiClient';
import { audioBufferToWav } from './autoCaptions';
import { extractJsonFromLlmResponse } from './jsonHelper';
import { calculateSpeedFramesRamp, getSpeedFrameSegments, SpeedFrameSegment } from './speedRamp';
import { getFileFromDB } from '@/utils/projectPersistence';

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
  'gemini-3.5-flash-preview',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3.8-flash',
  'gemini-2.5-flash',
] as const;

export type GeminiSpeedSyncModel = typeof GEMINI_SPEED_SYNC_MODELS[number];

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
  time: number; // seconds from the respective audio slice start
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

export interface AiSpeedSyncOptions {
  alignStartTime?: boolean;      // Align video start with TTS start (default true)
  muteOriginalAudio?: boolean;   // Mute original video audio so TTS is isolated (default true)
  targetModel?: GeminiSpeedSyncModel; // Preferred starting model
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

TASK — mark the timing of every word in BOTH audios:
1. Listen to AUDIO 1 and transcribe the spoken words with precise timestamps as "videoWords": [{ "word": "...", "time": seconds }].
2. Listen to AUDIO 2 and transcribe the spoken words with precise timestamps as "ttsWords": [{ "word": "...", "time": seconds }].
3. Report a verdict about the two audios:
   - "ttsHasSpeech": true only if AUDIO 2 contains spoken speech (false if it is music, noise, or silence).
   - "videoHasSpeech": true only if AUDIO 1 contains spoken speech (false is fine — the video may be a silent AI-generated clip).
   - "sameContent": true if AUDIO 2 is the SAME spoken content as AUDIO 1 (this means the user selected the original clip's own audio by mistake instead of a separate TTS voiceover).
   - "reason": short explanation of the verdict.
4. Also return 3 to 10 anchor points where sentence or phrase beginnings align, as a fallback:
   - "videoTime": seconds from AUDIO 1 start (0.00 to ${videoDuration.toFixed(2)}).
   - "ttsTime": seconds from AUDIO 2 start (0.00 to ${ttsDuration.toFixed(2)}).
   - "phrase": short description or transcribed words for this anchor.
   - "targetSpeed": recommended video speed multiplier between this and the previous anchor (e.g. 0.7x to 1.8x).
5. IMPORTANT: the word timestamps will be matched programmatically — report ACCURATE word-level timestamps, not invented ones.

RULES:
- Word "time" values and anchor timestamps MUST be in seconds and within each audio's duration.
- Return ONLY strict JSON in this format without markdown wrappers:
{
  "verdict": { "ttsHasSpeech": true, "videoHasSpeech": true, "sameContent": false, "reason": "TTS is a separate voiceover" },
  "videoWords": [ { "word": "hello", "time": 0.8 } ],
  "ttsWords": [ { "word": "hello", "time": 1.1 } ],
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

    return { anchors: sanitizedAnchors, successfulModel, summary, verdict, videoWords, ttsWords };
  } catch (parseErr: any) {
    throw new Error(`Failed to parse AI speed sync response as JSON: ${parseErr.message}`);
  }
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
    (w || '').toLowerCase().replace(/[.,!?،۔؟;:"'`\-–—()[\]{}]/g, '').trim();

  const vWords = videoWords.filter((w) => Number.isFinite(w.time) && normalize(w.word).length > 0);
  const tWords = ttsWords.filter((w) => Number.isFinite(w.time) && normalize(w.word).length > 0);
  if (vWords.length === 0 || tWords.length === 0) return [];

  const anchors: SyncAnchor[] = [];
  let vi = 0;          // video word cursor — strictly monotone forward
  let lastTts = -1;
  let matchedAny = false;

  for (let ti = 0; ti < tWords.length; ti++) {
    const tWord = tWords[ti];
    const tNorm = normalize(tWord.word);

    // ±3-word lookahead match (handles small transcription shifts without
    // breaking monotonicity — same strategy as the improved pair algorithm).
    let matchIdx = -1;
    for (let look = 0; look <= 3; look++) {
      const cand = vWords[vi + look];
      if (!cand) break;
      if (normalize(cand.word) === tNorm) { matchIdx = vi + look; break; }
    }

    if (matchIdx >= 0) {
      const vWord = vWords[matchIdx];
      if (tWord.time > lastTts + 0.05 && vWord.time < videoDuration - 0.05) {
        anchors.push({
          videoTime: Number(vWord.time.toFixed(3)),
          ttsTime: Number(tWord.time.toFixed(3)),
          phrase: tWord.word,
          matched: true,
        });
        lastTts = tWord.time;
        matchedAny = true;
      }
      vi = matchIdx + 1;
    }
    // Unmatched TTS word (extra / filler): intentionally skipped — the linear
    // interpolation through the surrounding matched anchors stretches the
    // video's content across it, so its delivery timing still matches.
  }

  if (!matchedAny) return [];

  // Trailing hold — "TTS wording is better than video clip": when the TTS
  // keeps speaking after the video's last matched word, HOLD the video near
  // that position (slow creep through a little of its remaining content)
  // instead of compressing all remaining content fast at the end. The clip-end
  // boundary alone would map the whole remaining source span across the
  // trailing TTS duration and rush it.
  const lastAnchor = anchors[anchors.length - 1];
  const trailing = ttsDuration - 0.05 - lastAnchor.ttsTime;
  if (trailing > 0.15) {
    const remainingSpan = Math.max(0, videoDuration - 0.05 - lastAnchor.videoTime);
    const holdAdvance = Math.min(remainingSpan, trailing * 0.15);
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
  const fixedSourceEnd = videoClip.speedFrameSourceEnd ?? (trimStart + currentSpan);

  const newDuration = Math.max(0.2, ttsClip.duration);

  // Convert each anchor into a SpeedFrame
  const validFrames: SpeedFrame[] = [];
  let lastOffset = 0;
  let lastSource = trimStart;

  for (let i = 0; i < anchors.length; i++) {
    const anchor = anchors[i];
    const offset = Math.max(0.05, Math.min(newDuration - 0.05, anchor.ttsTime));
    const src = Math.max(trimStart + 0.02, Math.min(fixedSourceEnd - 0.02, trimStart + anchor.videoTime));

    if (offset > lastOffset + 0.05 && src > lastSource + 0.01) {
      validFrames.push({
        id: `sf_ai_${i + 1}_${Math.random().toString(36).substring(2, 7)}`,
        timelineOffset: Number(offset.toFixed(4)),
        sourceTime: Number(src.toFixed(4)),
      });
      lastOffset = offset;
      lastSource = src;
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
  onProgress?: (progress: number, message: string) => void
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

  // 1. Extract Video Audio
  onProgress?.(10, 'Scanning Video Clip audio...');
  const videoAudio = await extractClipAudioToWav(
    videoClip,
    videoMedia?.url || '',
    videoMedia?.id
  );

  // 2. Extract TTS Audio
  onProgress?.(30, 'Scanning TTS Voiceover audio...');
  const ttsAudio = await extractClipAudioToWav(
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

  // 3. Gemini Multimodal Analysis — marks word timings in BOTH audios
  onProgress?.(55, 'AI marking word timings in video & TTS audio...');
  const analysis = await runGeminiSpeedSync(
    videoAudio.wavBlob,
    ttsAudio.wavBlob,
    videoAudio.duration,
    ttsAudio.duration,
    options.targetModel
  );
  const { anchors: aiAnchors, successfulModel, summary, verdict } = analysis;

  // ── Wrong-audio-clip validation (AI verdict) ──────────────────────────────
  if (verdict) {
    if (verdict.ttsHasSpeech === false) {
      throw new Error('AI detected that the selected TTS clip does not contain speech (music/noise/silence). Please select a valid TTS voiceover clip.');
    }
    if (verdict.sameContent === true) {
      throw new Error('AI detected that the selected audio is the original clip\'s own audio, not a separate TTS voiceover. Please select the TTS clip.');
    }
    // videoHasSpeech === false is NOT an error — silent AI-generated video is
    // expected; the cadence/word mapping still works via TTS timings.
  }

  // ── Anchor derivation: prefer word-level matching, fall back to cadence ───
  let anchors = aiAnchors;
  let alignmentMode: 'word-level' | 'ai-anchors' = 'ai-anchors';
  if (analysis.videoWords && analysis.ttsWords &&
      analysis.videoWords.length > 0 && analysis.ttsWords.length > 0) {
    const wordAnchors = buildAnchorsFromWordTimings(
      analysis.videoWords,
      analysis.ttsWords,
      videoAudio.duration,
      ttsAudio.duration
    );
    if (wordAnchors.length >= 2) {
      anchors = wordAnchors;
      alignmentMode = 'word-level';
    }
  }

  // 4. Calculate Speed Frames
  onProgress?.(85, 'Calculating Speed Frames & rate-stretching video...');
  const { speedFrames, newDuration, fixedSourceEnd, segments } = buildSpeedFramesFromAnchors(
    videoClip,
    ttsClip,
    anchors,
    videoMedia?.duration
  );
  const stretchFrameCount = anchors.filter((a) => a.stretch).length;

  // 5. Apply to Clip in Store
  const alignStart = options.alignStartTime !== false;
  const muteOriginal = options.muteOriginalAudio !== false;

  const updatedClip: TimelineClip = {
    ...videoClip,
    startTime: alignStart ? ttsClip.startTime : videoClip.startTime,
    duration: newDuration,
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
  store.saveSnapshot('AI Speed Sync with TTS');

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
  };
}
