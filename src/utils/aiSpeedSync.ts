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
): Promise<{ wavBlob: Blob | null; duration: number; hasAudio: boolean }> {
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
  const rawSpan = clip.speedFrameSourceEnd
    ? (clip.speedFrameSourceEnd - (clip.trimStart || 0))
    : (clip.duration * effectiveSpeed);
  const fallbackSpan = Math.max(0.1, rawSpan);

  if (!arrayBuffer) {
    return { wavBlob: null, duration: fallbackSpan, hasAudio: false };
  }

  const audioCtx = new AudioContext();
  try {
    const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    if (!decodedBuffer || decodedBuffer.numberOfChannels === 0 || decodedBuffer.length === 0) {
      return { wavBlob: null, duration: fallbackSpan, hasAudio: false };
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

    return { wavBlob, duration: actualSpan, hasAudio: true };
  } catch (decodeErr) {
    console.warn('[AiSpeedSync] Audio decode failed or media has no audio track:', decodeErr);
    return { wavBlob: null, duration: fallbackSpan, hasAudio: false };
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
): Promise<{ anchors: SyncAnchor[]; successfulModel: string; summary: string }> {
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
    prompt = `You are a world-class audio-visual synchronization and video speed-ramping editor.
I have provided two audio recordings:
- AUDIO 1 (First audio file): Original Video Clip Audio (Duration: ${videoDuration.toFixed(2)}s).
- AUDIO 2 (Second audio file): TTS Voiceover Audio to synchronize with (Duration: ${ttsDuration.toFixed(2)}s).

TASK:
1. Listen and compare both audio tracks.
2. Align matching speech sentences, key phrases, dialogue pauses, or rhythmic cadence between Audio 1 and Audio 2.
3. Generate 3 to 10 synchronized anchor points where sentence or phrase beginnings align.
4. For each anchor point:
   - "videoTime": timestamp in seconds from Audio 1 start (0.00 to ${videoDuration.toFixed(2)}).
   - "ttsTime": timestamp in seconds from Audio 2 start (0.00 to ${ttsDuration.toFixed(2)}).
   - "phrase": short description or transcribed words for this anchor point.
   - "targetSpeed": recommended video speed multiplier between this and the previous anchor (e.g. 0.7x to 1.8x).

RULES:
- Both "videoTime" and "ttsTime" MUST strictly increase chronologically.
- 0.05 <= videoTime <= ${(videoDuration - 0.05).toFixed(2)}
- 0.05 <= ttsTime <= ${(ttsDuration - 0.05).toFixed(2)}
- Return ONLY strict JSON in this format without markdown wrappers:
{
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
2. Detect major sentence starts, punchlines, and breathing/pauses.
3. Distribute 3 to 8 speed frame anchor points to create dynamic, cinematic speed ramping:
   - Slightly accelerate video through spoken pauses.
   - Settle at natural speed (0.9x - 1.2x) on key phrases and emphasis words.
4. For each anchor:
   - "videoTime": mapped source moment in seconds (0.00 to ${videoDuration.toFixed(2)}).
   - "ttsTime": spoken timestamp in TTS audio (0.00 to ${ttsDuration.toFixed(2)}).
   - "phrase": words spoken or event at this moment.
   - "targetSpeed": speed multiplier.

RULES:
- Timestamps must be strictly ascending.
- Return ONLY strict JSON in this format without markdown wrappers:
{
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
          targetSpeed: typeof a.targetSpeed === 'number' ? a.targetSpeed : 1.0,
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
          targetSpeed: videoDuration / ttsDuration,
        });
      }
    }

    return { anchors: sanitizedAnchors, successfulModel, summary };
  } catch (parseErr: any) {
    throw new Error(`Failed to parse AI speed sync response as JSON: ${parseErr.message}`);
  }
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
    throw new Error('Could not decode audio from the selected TTS clip.');
  }

  // 3. Gemini Multimodal Analysis
  onProgress?.(55, 'AI comparing audio timing & cadence (Gemini 3.5 Flash Preview)...');
  const { anchors, successfulModel, summary } = await runGeminiSpeedSync(
    videoAudio.wavBlob,
    ttsAudio.wavBlob,
    videoAudio.duration,
    ttsAudio.duration,
    options.targetModel
  );

  // 4. Calculate Speed Frames
  onProgress?.(85, 'Calculating Speed Frames & rate-stretching video...');
  const { speedFrames, newDuration, fixedSourceEnd, segments } = buildSpeedFramesFromAnchors(
    videoClip,
    ttsClip,
    anchors,
    videoMedia?.duration
  );

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
          volume: 0,
          pan: 0,
          fadeIn: 0,
          fadeOut: 0,
          bass: 0,
          treble: 0,
          pitch: 0,
          voiceFormant: 0,
          preservePitch: true,
          humanize: false,
          ...(videoClip.audioSettings || {}),
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
  };
}
