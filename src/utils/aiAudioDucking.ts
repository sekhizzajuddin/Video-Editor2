import { TimelineClip, TimelineTrack, MediaItem, PropertyKeyframe, SubtitleItem } from '@/types';
import { resolveMediaFile } from './mediaFileHandle';

export type VocalLevel = 'none' | 'low' | 'mid' | 'high';

export interface VocalSpectrumPoint {
  time: number;          // Global timeline seconds
  amplitude: number;     // Normalized combined vocal amplitude [0, 1]
  level: VocalLevel;     // 'none' | 'low' | 'mid' | 'high'
  rawVolume: number;     // Unsmoothed target BGM volume [0, 1]
}

export interface CombinedSpectrumResult {
  timelineStart: number;
  timelineEnd: number;
  stepSeconds: number;
  points: VocalSpectrumPoint[];
  vocalHighSeconds: number;
  vocalMidSeconds: number;
  vocalLowSeconds: number;
  silenceSeconds: number;
  totalVocalDuration: number;
}

export interface SpeechInterval {
  start: number; // Global timeline seconds
  end: number;   // Global timeline seconds
  sourceClipId?: string;
  sourceTrackId?: string;
}

export interface DuckingRegion {
  attackStart: number;  // Time when music starts to duck down
  duckStart: number;    // Time when music reaches full duck level
  duckEnd: number;      // Time when voice ends + hold duration
  releaseEnd: number;   // Time when music recovers back to 100%
}

export interface AutoDuckingConfig {
  duckAmountDb: number;     // Baseline dB reduction (default -18 dB)
  attackDuration: number;   // seconds (default 0.25s)
  holdDuration: number;     // seconds (default 0.30s)
  releaseDuration: number;  // seconds (default 0.45s)
  bridgeGap: number;        // seconds to bridge between words/sentences (default 0.8s)
  sensitivity: 'low' | 'normal' | 'high'; // VAD sensitivity
  highVocalDb?: number;     // dB for high vocal max (default -6 dB = 50% vol)
  midVocalDb?: number;      // dB for mid vocal (default -12 dB = ~25% vol)
  lowVocalDb?: number;      // dB for low vocal (default -26 dB = ~5% vol)
  onProgress?: (progress: number, status: string) => void;
}

export const DEFAULT_DUCKING_CONFIG: AutoDuckingConfig = {
  duckAmountDb: -18,
  attackDuration: 0.25,
  holdDuration: 0.30,
  releaseDuration: 0.45,
  bridgeGap: 0.8,
  sensitivity: 'normal',
  highVocalDb: -6.0,   // 50% volume
  midVocalDb: -12.0,   // ~25% volume
  lowVocalDb: -26.0,   // ~5% volume
};

// Memory cache for decoded audio buffers to prevent repeated decodes during ducking analysis
const audioBufferCache = new Map<string, AudioBuffer>();

/**
 * Retrieve ArrayBuffer from any available storage tier:
 * in-memory blobs, FileSystemFileHandle, IndexedDB disk cache, or fetch fallback.
 */
export async function getAudioArrayBuffer(media: MediaItem): Promise<ArrayBuffer | null> {
  try {
    const m = media as any;
    if (m._audioBlob instanceof Blob) {
      return await m._audioBlob.arrayBuffer();
    }
    if (m._fileBlob instanceof Blob) {
      return await m._fileBlob.arrayBuffer();
    }
    const file = await resolveMediaFile(media.id);
    if (file) {
      return await file.arrayBuffer();
    }
    if (media.url && typeof window !== 'undefined') {
      const resp = await fetch(media.url);
      return await resp.arrayBuffer();
    }
  } catch (err) {
    console.warn(`[AutoDucking] Could not load audio buffer for media ${media.id}:`, err);
  }
  return null;
}

/**
 * Maps combined vocal waveform amplitude to target BGM volume level according to user rules:
 * - Vocal High Max (amp >= 0.50): BGM Volume = 50% (0.50, or -6 dB)
 * - Vocal Mid (0.15 <= amp < 0.50): BGM Volume = ~25% (0.25, or -12 dB)
 * - Vocal Low (0.02 <= amp < 0.15): BGM Volume = ~5% (0.05, or -26 dB)
 * - Vocal Not Exist (amp < 0.02): BGM Volume = 100% (1.00, or 0 dB)
 */
export function getBgmVolumeForAmplitude(
  amp: number,
  config?: Partial<AutoDuckingConfig>,
  silenceThreshold: number = 0.02
): { level: VocalLevel; volume: number } {
  const duckDb = config?.duckAmountDb ?? -18;
  const highVol = 0.50; // 50%
  const midVol = Math.pow(10, duckDb / 20); // ~12.5% to 25% (tracks baseline duck e.g. -18 dB)
  const lowVol = 0.05;  // ~5% (-26 dB)

  if (amp < silenceThreshold) {
    return { level: 'none', volume: 1.0 }; // 100% volume
  }
  if (amp >= 0.50) {
    // Vocal High Max: 50%
    return { level: 'high', volume: highVol };
  }
  if (amp >= 0.15) {
    // Vocal Mid: ~25% / baseline duck
    return { level: 'mid', volume: midVol };
  }
  // Vocal Low: ~5% (de-amplified strongly so quiet voice is heard)
  return { level: 'low', volume: lowVol };
}

/**
 * Builds a combined vocal waveform spectrum across the timeline by analyzing
 * all vocal/speech tracks (e.g. Track 1, Track 2, dialogue, voiceovers).
 */
export async function buildCombinedVocalSpectrum(
  tracks: TimelineTrack[],
  mediaLibrary: MediaItem[],
  targetTrackId: string,
  subtitles: SubtitleItem[] = [],
  stepSeconds: number = 0.05, // 50ms time resolution
  config?: Partial<AutoDuckingConfig>
): Promise<CombinedSpectrumResult> {
  // 1. Identify all vocal tracks (non-target tracks, not muted)
  const vocalTracks = tracks.filter(
    (t) => t.id !== targetTrackId && !t.muted && !(t as any).isMuted
  );

  // 2. Collect all active clips from vocal tracks
  const vocalClips = vocalTracks
    .flatMap((t) => t.clips || [])
    .filter((c) => !c.disabled && !c.audioSettings?.muted);

  // 3. Find target BGM track clips to determine timeline boundaries
  const targetTrack = tracks.find((t) => t.id === targetTrackId);
  const bgmClips = (targetTrack?.clips || []).filter((c) => !c.disabled);

  if (bgmClips.length === 0 && vocalClips.length === 0) {
    return {
      timelineStart: 0,
      timelineEnd: 0,
      stepSeconds,
      points: [],
      vocalHighSeconds: 0,
      vocalMidSeconds: 0,
      vocalLowSeconds: 0,
      silenceSeconds: 0,
      totalVocalDuration: 0,
    };
  }

  const allClips = [...bgmClips, ...vocalClips];
  const timelineStart = Math.max(0, Math.min(...allClips.map((c) => c.startTime)));
  const timelineEnd = Math.max(...allClips.map((c) => c.startTime + c.duration));
  const totalSteps = Math.max(1, Math.ceil((timelineEnd - timelineStart) / stepSeconds));

  const points: VocalSpectrumPoint[] = new Array(totalSteps);
  let vocalHighSeconds = 0;
  let vocalMidSeconds = 0;
  let vocalLowSeconds = 0;
  let silenceSeconds = 0;

  for (let i = 0; i < totalSteps; i++) {
    const t = timelineStart + i * stepSeconds;

    // Find all vocal clips active at this timestamp
    let maxClipAmp = 0;
    for (const clip of vocalClips) {
      const clipStart = clip.startTime;
      const clipEnd = clip.startTime + clip.duration;
      if (t >= clipStart && t < clipEnd) {
        const media = mediaLibrary.find((m) => m.id === clip.mediaId);
        const clipElapsed = (t - clipStart) * (clip.speed || 1);
        const localSec = (clip.trimStart || 0) + clipElapsed;

        let amp = 0;
        if (media?.waveformPeaks && media.waveformPeaks.length > 0) {
          const totalDur = media.duration || clip.duration || 1;
          const peakIdx = Math.floor((localSec / totalDur) * media.waveformPeaks.length);
          amp = Math.abs(media.waveformPeaks[Math.max(0, Math.min(media.waveformPeaks.length - 1, peakIdx))] || 0);
        } else {
          // Check subtitles or word-level timestamps overlapping this time
          const hasSubtitle = subtitles.some((s) => t >= s.startTime && t <= s.endTime);
          const words = (clip as any).words || (media as any)?.words || (media as any)?.transcriptWords;
          const hasWord = Array.isArray(words) && words.some((w: any) => {
            const wStart = clipStart + (w.start - (clip.trimStart || 0));
            const wEnd = clipStart + (w.end - (clip.trimStart || 0));
            return t >= wStart && t <= wEnd;
          });

          if (hasSubtitle || hasWord) {
            amp = 0.35; // Standard conversational dialogue amplitude
          } else {
            amp = 0.25; // Default voice clip presence
          }
        }

        // Apply clip volume scaling (convert dB to linear gain)
        const clipVolumeDb = clip.audioSettings?.volume ?? 0;
        const clipGain = Math.pow(10, clipVolumeDb / 20);
        const effectiveAmp = Math.min(1.0, amp * clipGain);

        if (effectiveAmp > maxClipAmp) {
          maxClipAmp = effectiveAmp;
        }
      }
    }

    // Classify amplitude into user's 4-tier spectrum
    const { level, volume } = getBgmVolumeForAmplitude(maxClipAmp, config);

    if (level === 'high') vocalHighSeconds += stepSeconds;
    else if (level === 'mid') vocalMidSeconds += stepSeconds;
    else if (level === 'low') vocalLowSeconds += stepSeconds;
    else silenceSeconds += stepSeconds;

    points[i] = {
      time: Number(t.toFixed(3)),
      amplitude: Number(maxClipAmp.toFixed(3)),
      level,
      rawVolume: volume,
    };
  }

  return {
    timelineStart,
    timelineEnd,
    stepSeconds,
    points,
    vocalHighSeconds: Number(vocalHighSeconds.toFixed(2)),
    vocalMidSeconds: Number(vocalMidSeconds.toFixed(2)),
    vocalLowSeconds: Number(vocalLowSeconds.toFixed(2)),
    silenceSeconds: Number(silenceSeconds.toFixed(2)),
    totalVocalDuration: Number((vocalHighSeconds + vocalMidSeconds + vocalLowSeconds).toFixed(2)),
  };
}

/**
 * Applies lookahead attack, speech hold, and release swell smoothing across the volume array.
 * Uses smooth cosine S-curves so transitions never pop, click, or flutter.
 */
export function smoothVolumeEnvelope(
  rawVolumes: number[],
  attackSteps: number = 4,   // 200ms at 50ms steps
  holdSteps: number = 6,     // 300ms at 50ms steps
  releaseSteps: number = 8   // 400ms at 50ms steps
): number[] {
  const n = rawVolumes.length;
  if (n === 0) return [];
  const result = new Float32Array(rawVolumes);

  // 1. Hold: if volume is ducked (< 0.95), bridge over short breath/comma pauses <= holdSteps
  let duckVal = 1.0;
  let gapCount = 0;
  for (let i = 0; i < n; i++) {
    const v = rawVolumes[i];
    if (v < 0.95) {
      duckVal = v;
      gapCount = 0;
    } else {
      gapCount++;
      if (gapCount <= holdSteps && duckVal < 0.95) {
        result[i] = duckVal;
      } else {
        duckVal = 1.0;
      }
    }
  }

  // 2. Lookahead Attack: ramp down BEFORE vocal starts so initial syllables are never masked
  const afterHold = Float32Array.from(result);
  for (let i = 0; i < n; i++) {
    const target = afterHold[i];
    if (target < 0.95) {
      for (let k = 1; k <= attackSteps; k++) {
        const prevIdx = i - k;
        if (prevIdx < 0) break;
        const p = k / attackSteps;
        const cosineFactor = 0.5 * (1 + Math.cos(Math.PI * (1 - p)));
        const rampVol = target + (1.0 - target) * cosineFactor;
        if (rampVol < result[prevIdx]) {
          result[prevIdx] = rampVol;
        }
      }
    }
  }

  // 3. Release Swell: ramp smoothly back up to 1.0 when vocal completes
  const finalSmoothed = new Float32Array(result);
  let wasDucked = false;
  let duckExitVal = 1.0;
  let releaseProgress = releaseSteps;

  for (let i = 0; i < n; i++) {
    const cur = result[i];
    if (cur < 0.95) {
      wasDucked = true;
      duckExitVal = cur;
      releaseProgress = 0;
      finalSmoothed[i] = cur;
    } else if (wasDucked) {
      releaseProgress++;
      if (releaseProgress <= releaseSteps) {
        const t = releaseProgress / releaseSteps;
        const sCurve = 0.5 * (1 - Math.cos(Math.PI * t));
        finalSmoothed[i] = duckExitVal + (1.0 - duckExitVal) * sCurve;
      } else {
        wasDucked = false;
        finalSmoothed[i] = 1.0;
      }
    } else {
      finalSmoothed[i] = 1.0;
    }
  }

  return Array.from(finalSmoothed);
}

/**
 * Extracts and maps smoothed volume envelope points into clean, deduplicated
 * volume keyframes for a specific BGM clip.
 */
export function generateBgmDuckingKeyframesFromSpectrum(
  clip: TimelineClip,
  stepSeconds: number,
  smoothedVolumes: number[],
  timelineStart: number
): PropertyKeyframe[] {
  const clipStart = clip.startTime;
  const clipEnd = clip.startTime + clip.duration;
  const clipDuration = clip.duration;
  const baseDb = clip.audioSettings?.volume ?? 0;

  const startIdx = Math.max(0, Math.floor((clipStart - timelineStart) / stepSeconds));
  const endIdx = Math.min(smoothedVolumes.length, Math.ceil((clipEnd - timelineStart) / stepSeconds));

  const rawPoints: Array<{ time: number; value: number; easing: string }> = [];

  // Anchor at clip start
  const firstVol = smoothedVolumes[startIdx] ?? 1.0;
  const firstDb = baseDb + (firstVol >= 0.99 ? 0 : 20 * Math.log10(Math.max(0.01, firstVol)));
  rawPoints.push({ time: 0, value: Number(firstDb.toFixed(1)), easing: 'easeInOut' });

  let lastValue = firstDb;
  for (let idx = startIdx; idx < endIdx; idx++) {
    const globalT = timelineStart + idx * stepSeconds;
    const localT = Math.max(0, Math.min(clipDuration, globalT - clipStart));
    const vol = smoothedVolumes[idx] ?? 1.0;
    const db = baseDb + (vol >= 0.99 ? 0 : 20 * Math.log10(Math.max(0.01, vol)));

    if (Math.abs(db - lastValue) >= 0.4) {
      rawPoints.push({
        time: Number(localT.toFixed(3)),
        value: Number(db.toFixed(1)),
        easing: 'easeInOut',
      });
      lastValue = db;
    }
  }

  // Anchor at clip end
  const lastVol = smoothedVolumes[Math.min(smoothedVolumes.length - 1, endIdx)] ?? 1.0;
  const lastDb = baseDb + (lastVol >= 0.99 ? 0 : 20 * Math.log10(Math.max(0.01, lastVol)));
  rawPoints.push({
    time: Number(clipDuration.toFixed(3)),
    value: Number(lastDb.toFixed(1)),
    easing: 'linear',
  });

  // Deduplicate points closer than 20ms
  const deduped: PropertyKeyframe[] = [];
  for (const pt of rawPoints) {
    if (deduped.length === 0) {
      deduped.push({ time: pt.time, value: pt.value, easing: pt.easing as any });
    } else {
      const prev = deduped[deduped.length - 1];
      if (Math.abs(pt.time - prev.time) < 0.02) {
        prev.value = pt.value;
      } else {
        deduped.push({ time: pt.time, value: pt.value, easing: pt.easing as any });
      }
    }
  }

  // Ensure first keyframe at time 0 and last at clipDuration
  if (deduped.length === 0 || deduped[0].time > 0) {
    deduped.unshift({ time: 0, value: firstDb, easing: 'easeInOut' });
  }
  if (deduped[deduped.length - 1].time < clipDuration) {
    deduped.push({ time: Number(clipDuration.toFixed(3)), value: lastDb, easing: 'linear' });
  }

  return deduped;
}

/**
 * Fast Acoustic Voice Activity Detection (VAD) via OfflineAudioContext DSP.
 * Filters audio to human speech spectrum (300Hz-3400Hz) and computes adaptive RMS envelope.
 */
export async function detectSpeechViaAcousticVad(
  audioBuffer: AudioBuffer,
  clip: TimelineClip,
  sensitivity: 'low' | 'normal' | 'high' = 'normal'
): Promise<SpeechInterval[]> {
  const clipStart = clip.startTime;
  const clipDuration = clip.duration;
  const trimStart = Math.max(0, clip.trimStart || 0);
  const audioDuration = audioBuffer.duration || 1;
  if (trimStart >= audioDuration) return [];
  const safeClipDur = Math.min(clipDuration, Math.max(0.05, audioDuration - trimStart));

  const targetSampleRate = 16000;
  const sampleLength = Math.max(1, Math.floor(safeClipDur * targetSampleRate));

  const offlineCtx = new (window.OfflineAudioContext || (window as any).webkitOfflineAudioContext)(
    1,
    sampleLength,
    targetSampleRate
  );

  const source = offlineCtx.createBufferSource();
  source.buffer = audioBuffer;

  const bandpass = offlineCtx.createBiquadFilter();
  bandpass.type = 'bandpass';
  bandpass.frequency.value = 1500;
  bandpass.Q.value = 0.7;

  source.connect(bandpass);
  bandpass.connect(offlineCtx.destination);
  source.start(0, trimStart, safeClipDur);

  const renderedBuffer = await offlineCtx.startRendering();
  const channelData = renderedBuffer.getChannelData(0);

  const frameSize = Math.floor(targetSampleRate * 0.05); // 50ms
  const numFrames = Math.floor(channelData.length / frameSize);
  if (numFrames === 0) return [];

  const frameEnergies = new Float32Array(numFrames);
  for (let i = 0; i < numFrames; i++) {
    const startIdx = i * frameSize;
    let sum = 0;
    for (let j = 0; j < frameSize; j++) {
      const s = channelData[startIdx + j];
      sum += s * s;
    }
    frameEnergies[i] = Math.sqrt(sum / frameSize);
  }

  const sorted = Float32Array.from(frameEnergies).sort();
  const noiseFloor = sorted[Math.floor(sorted.length * 0.15)] || 0.005;

  let multiplier = 2.8;
  let minFloor = 0.015;
  if (sensitivity === 'high') {
    multiplier = 2.0;
    minFloor = 0.008;
  } else if (sensitivity === 'low') {
    multiplier = 4.0;
    minFloor = 0.025;
  }
  const speechThreshold = Math.max(minFloor, noiseFloor * multiplier);

  const minFrames = Math.ceil(0.12 / 0.05); // 120ms
  const intervals: SpeechInterval[] = [];
  let burstStartFrame: number | null = null;

  for (let i = 0; i < numFrames; i++) {
    const isSpeech = frameEnergies[i] >= speechThreshold;
    if (isSpeech && burstStartFrame === null) {
      burstStartFrame = i;
    } else if (!isSpeech && burstStartFrame !== null) {
      const burstDurationFrames = i - burstStartFrame;
      if (burstDurationFrames >= minFrames) {
        const localStart = burstStartFrame * 0.05;
        const localEnd = i * 0.05;
        intervals.push({
          start: clipStart + Math.max(0, localStart),
          end: clipStart + Math.min(clipDuration, localEnd),
          sourceClipId: clip.id,
        });
      }
      burstStartFrame = null;
    }
  }

  if (burstStartFrame !== null) {
    const burstDurationFrames = numFrames - burstStartFrame;
    if (burstDurationFrames >= minFrames) {
      const localStart = burstStartFrame * 0.05;
      const localEnd = numFrames * 0.05;
      intervals.push({
        start: clipStart + Math.max(0, localStart),
        end: clipStart + Math.min(clipDuration, localEnd),
        sourceClipId: clip.id,
      });
    }
  }

  return intervals;
}

/**
 * Scan speech/vocal intervals from a clip:
 * 1. Checks subtitles / captions / word timestamps first
 * 2. Uses fast OfflineAudioContext bandpass VAD if audio is present
 * 3. Falls back to waveform peaks envelope
 */
export async function scanClipVocalIntervals(
  clip: TimelineClip,
  media: MediaItem | undefined,
  subtitles: SubtitleItem[] = [],
  sensitivity: 'low' | 'normal' | 'high' = 'normal'
): Promise<SpeechInterval[]> {
  if (clip.disabled || clip.audioSettings?.muted) return [];
  const clipStart = clip.startTime;
  const clipEnd = clip.startTime + clip.duration;

  // 1. Subtitles / Captions
  const matchingSubtitles = subtitles.filter(
    (s) => s.startTime < clipEnd && s.endTime > clipStart
  );
  if (matchingSubtitles.length > 0) {
    return matchingSubtitles.map((s) => ({
      start: Math.max(clipStart, s.startTime),
      end: Math.min(clipEnd, s.endTime),
      sourceClipId: clip.id,
    }));
  }

  // Word-level timestamps
  const words = (clip as any).words || (media as any)?.words || (media as any)?.transcriptWords;
  if (Array.isArray(words) && words.length > 0) {
    const trimStart = clip.trimStart || 0;
    const wordIntervals: SpeechInterval[] = [];
    for (const w of words) {
      if (typeof w.start === 'number' && typeof w.end === 'number') {
        const tStart = clipStart + (w.start - trimStart);
        const tEnd = clipStart + (w.end - trimStart);
        if (tEnd > clipStart && tStart < clipEnd) {
          wordIntervals.push({
            start: Math.max(clipStart, tStart),
            end: Math.min(clipEnd, tEnd),
            sourceClipId: clip.id,
          });
        }
      }
    }
    if (wordIntervals.length > 0) return wordIntervals;
  }

  // 2. Acoustic VAD
  if (media) {
    try {
      let audioBuffer = audioBufferCache.get(media.id);
      if (!audioBuffer) {
        const arrayBuffer = await getAudioArrayBuffer(media);
        if (arrayBuffer && typeof window !== 'undefined') {
          const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
          audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
          audioCtx.close();
          if (audioBuffer) audioBufferCache.set(media.id, audioBuffer);
        }
      }

      if (audioBuffer) {
        const vadIntervals = await detectSpeechViaAcousticVad(audioBuffer, clip, sensitivity);
        if (vadIntervals.length > 0) return vadIntervals;
      }
    } catch (vadErr) {
      console.warn(`[AutoDucking] VAD analysis failed for clip ${clip.id}, trying fallback:`, vadErr);
    }

    // 3. Fallback: waveform peaks envelope
    if (media.waveformPeaks && media.waveformPeaks.length > 0) {
      const peaks = media.waveformPeaks;
      const totalMediaDur = media.duration || clip.duration;
      const trimStart = clip.trimStart || 0;
      const trimEnd = trimStart + clip.duration;

      const pStartIdx = Math.floor((trimStart / totalMediaDur) * peaks.length);
      const pEndIdx = Math.floor((trimEnd / totalMediaDur) * peaks.length);
      const clipPeaks = peaks.slice(pStartIdx, pEndIdx);

      const threshold = sensitivity === 'high' ? 0.08 : sensitivity === 'low' ? 0.22 : 0.14;
      const peakIntervals: SpeechInterval[] = [];
      let inBurst = false;
      let burstStart = 0;

      for (let i = 0; i < clipPeaks.length; i++) {
        const val = Math.abs(clipPeaks[i]);
        const t = clipStart + (i / clipPeaks.length) * clip.duration;
        if (val >= threshold && !inBurst) {
          inBurst = true;
          burstStart = t;
        } else if (val < threshold && inBurst) {
          inBurst = false;
          if (t - burstStart >= 0.12) {
            peakIntervals.push({ start: burstStart, end: t, sourceClipId: clip.id });
          }
        }
      }
      if (inBurst && clipEnd - burstStart >= 0.12) {
        peakIntervals.push({ start: burstStart, end: clipEnd, sourceClipId: clip.id });
      }
      if (peakIntervals.length > 0) return peakIntervals;
    }
  }

  return [];
}

/**
 * Bridges micro-pauses (e.g. breaths or spaces between words up to bridgeGap seconds)
 * and merges overlapping speech intervals into clean continuous vocal sections.
 */
export function bridgeAndMergeSpeechIntervals(
  intervals: SpeechInterval[],
  bridgeGap: number = 0.8
): SpeechInterval[] {
  if (intervals.length === 0) return [];

  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged: SpeechInterval[] = [];
  let current: SpeechInterval = { ...sorted[0] };

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];
    if (next.start <= current.end + bridgeGap) {
      current.end = Math.max(current.end, next.end);
    } else {
      merged.push(current);
      current = { ...next };
    }
  }
  merged.push(current);

  return merged;
}

/**
 * Calculates ducking regions with smooth attack pre-roll and release recovery.
 */
export function calculateDuckingRegions(
  speechIntervals: SpeechInterval[],
  config: AutoDuckingConfig
): DuckingRegion[] {
  if (speechIntervals.length === 0) return [];

  const rawRegions: DuckingRegion[] = speechIntervals.map((s) => {
    const attackStart = Math.max(0, s.start - config.attackDuration);
    const duckStart = s.start;
    const duckEnd = s.end + config.holdDuration;
    const releaseEnd = duckEnd + config.releaseDuration;
    return { attackStart, duckStart, duckEnd, releaseEnd };
  });

  const merged: DuckingRegion[] = [];
  let cur = { ...rawRegions[0] };

  for (let i = 1; i < rawRegions.length; i++) {
    const next = rawRegions[i];
    if (next.attackStart <= cur.releaseEnd) {
      cur.duckEnd = Math.max(cur.duckEnd, next.duckEnd);
      cur.releaseEnd = Math.max(cur.releaseEnd, next.releaseEnd);
    } else {
      merged.push(cur);
      cur = { ...next };
    }
  }
  merged.push(cur);

  return merged;
}

/**
 * Generates frame-accurate volume keyframes for a target BGM clip based on ducking regions.
 */
export function generateClipDuckingKeyframes(
  clip: TimelineClip,
  duckingRegions: DuckingRegion[],
  config: AutoDuckingConfig
): PropertyKeyframe[] {
  const clipStart = clip.startTime;
  const clipEnd = clip.startTime + clip.duration;
  const clipDuration = clip.duration;

  const baseVolume = clip.audioSettings?.volume ?? 0;
  const duckVolume = baseVolume + config.duckAmountDb;

  const relevant = duckingRegions.filter(
    (r) => r.releaseEnd > clipStart && r.attackStart < clipEnd
  );

  if (relevant.length === 0) {
    return [
      { time: 0, value: baseVolume, easing: 'linear' },
      { time: clipDuration, value: baseVolume, easing: 'linear' },
    ];
  }

  const rawPoints: Array<{ time: number; value: number; easing: string }> = [];

  const firstRegion = relevant[0];
  if (firstRegion.attackStart > clipStart) {
    rawPoints.push({ time: 0, value: baseVolume, easing: 'linear' });
  }

  for (const r of relevant) {
    const tAttStart = Math.max(0, Math.min(clipDuration, r.attackStart - clipStart));
    const tDuckStart = Math.max(0, Math.min(clipDuration, r.duckStart - clipStart));
    const tDuckEnd = Math.max(0, Math.min(clipDuration, r.duckEnd - clipStart));
    const tRelEnd = Math.max(0, Math.min(clipDuration, r.releaseEnd - clipStart));

    if (r.attackStart <= clipStart && r.duckEnd > clipStart) {
      rawPoints.push({ time: 0, value: duckVolume, easing: 'linear' });
    } else {
      rawPoints.push({ time: tAttStart, value: baseVolume, easing: 'easeInOut' });
      rawPoints.push({ time: tDuckStart, value: duckVolume, easing: 'linear' });
    }

    if (r.releaseEnd >= clipEnd) {
      if (r.duckEnd < clipEnd) {
        rawPoints.push({ time: tDuckEnd, value: duckVolume, easing: 'easeInOut' });
        rawPoints.push({ time: clipDuration, value: baseVolume, easing: 'linear' });
      } else {
        rawPoints.push({ time: clipDuration, value: duckVolume, easing: 'linear' });
      }
    } else {
      rawPoints.push({ time: tDuckEnd, value: duckVolume, easing: 'easeInOut' });
      rawPoints.push({ time: tRelEnd, value: baseVolume, easing: 'linear' });
    }
  }

  const lastRegion = relevant[relevant.length - 1];
  if (lastRegion.releaseEnd < clipEnd) {
    rawPoints.push({ time: clipDuration, value: baseVolume, easing: 'linear' });
  }

  rawPoints.sort((a, b) => a.time - b.time);
  const deduped: PropertyKeyframe[] = [];

  for (let i = 0; i < rawPoints.length; i++) {
    const pt = rawPoints[i];
    const easing = pt.easing as PropertyKeyframe['easing'];
    if (deduped.length === 0) {
      deduped.push({ time: Number(pt.time.toFixed(3)), value: Number(pt.value.toFixed(1)), easing });
    } else {
      const prev = deduped[deduped.length - 1];
      if (Math.abs(pt.time - prev.time) < 0.015) {
        if (pt.value < prev.value) {
          prev.value = Number(pt.value.toFixed(1));
          prev.easing = easing;
        }
      } else {
        deduped.push({ time: Number(pt.time.toFixed(3)), value: Number(pt.value.toFixed(1)), easing });
      }
    }
  }

  if (deduped.length === 0 || deduped[0].time > 0) {
    deduped.unshift({ time: 0, value: baseVolume, easing: 'linear' });
  }
  if (deduped[deduped.length - 1].time < clipDuration) {
    deduped.push({ time: Number(clipDuration.toFixed(3)), value: baseVolume, easing: 'linear' });
  }

  return deduped;
}

export interface AutoDuckingResult {
  success: boolean;
  targetTrackId: string;
  duckedClipsCount: number;
  speechIntervalsCount: number;
  totalSpeechDuration: number;
  keyframesByClipId: Record<string, PropertyKeyframe[]>;
  vocalHighDuration?: number;
  vocalMidDuration?: number;
  vocalLowDuration?: number;
}

/**
 * Core AI Audio Ducking Engine:
 * Combines all vocal tracks (e.g. Track 1 & 2) into a unified waveform spectrum,
 * analyzes High Max / Mid / Low / Silence positions, and applies smooth de-amplification
 * to the target BGM track (Track 3).
 */
export async function applyAutoDuckingToTrack(
  targetTrackId: string,
  tracks: TimelineTrack[],
  mediaLibrary: MediaItem[],
  subtitles: SubtitleItem[] = [],
  options: Partial<AutoDuckingConfig> = {}
): Promise<AutoDuckingResult> {
  const config: AutoDuckingConfig = { ...DEFAULT_DUCKING_CONFIG, ...options };
  const targetTrack = tracks.find((t) => t.id === targetTrackId);
  if (!targetTrack || !targetTrack.clips || targetTrack.clips.length === 0) {
    return {
      success: false,
      targetTrackId,
      duckedClipsCount: 0,
      speechIntervalsCount: 0,
      totalSpeechDuration: 0,
      keyframesByClipId: {},
    };
  }

  config.onProgress?.(15, 'Combining vocal tracks (Track 1 & 2) into waveform spectrum...');
  await new Promise((r) => setTimeout(r, 0));

  // 1. Build combined vocal waveform spectrum across all dialogue/vocal tracks
  const spectrumResult = await buildCombinedVocalSpectrum(
    tracks,
    mediaLibrary,
    targetTrackId,
    subtitles,
    0.05, // 50ms time slices
    config
  );

  config.onProgress?.(50, 'Analyzing waveform spectrum levels (High Max, Mid, Low, Silence)...');
  await new Promise((r) => setTimeout(r, 0));

  const rawVolumes = spectrumResult.points.map((p) => p.rawVolume);
  const hasVocalPresence = spectrumResult.totalVocalDuration > 0.05;

  // Fallback check: if spectrum has no waveform peaks loaded, try scanClipVocalIntervals
  if (!hasVocalPresence) {
    const vocalClips = tracks
      .filter((t) => t.id !== targetTrackId && !t.muted && !(t as any).isMuted)
      .flatMap((t) => t.clips || [])
      .filter((c) => !c.disabled && !c.audioSettings?.muted);

    const fallbackIntervals: SpeechInterval[] = [];
    for (const clip of vocalClips) {
      const media = mediaLibrary.find((m) => m.id === clip.mediaId);
      const intervals = await scanClipVocalIntervals(clip, media, subtitles, config.sensitivity);
      fallbackIntervals.push(...intervals);
    }

    if (fallbackIntervals.length > 0) {
      const merged = bridgeAndMergeSpeechIntervals(fallbackIntervals, config.bridgeGap);
      const duckingRegions = calculateDuckingRegions(merged, config);
      const keyframesByClipId: Record<string, PropertyKeyframe[]> = {};

      for (const bgmClip of targetTrack.clips) {
        if (bgmClip.disabled) continue;
        keyframesByClipId[bgmClip.id] = generateClipDuckingKeyframes(bgmClip, duckingRegions, config);
      }

      config.onProgress?.(100, 'Auto ducking complete!');
      let totalDur = 0;
      for (const s of merged) totalDur += s.end - s.start;

      return {
        success: true,
        targetTrackId,
        duckedClipsCount: Object.keys(keyframesByClipId).length,
        speechIntervalsCount: merged.length,
        totalSpeechDuration: Number(totalDur.toFixed(2)),
        keyframesByClipId,
      };
    }

    return {
      success: false,
      targetTrackId,
      duckedClipsCount: 0,
      speechIntervalsCount: 0,
      totalSpeechDuration: 0,
      keyframesByClipId: {},
    };
  }

  config.onProgress?.(75, 'Applying smooth attack, hold & release S-curve transitions...');
  await new Promise((r) => setTimeout(r, 0));

  // 2. Smooth volume envelope using attack (200ms = 4 steps), hold (300ms = 6 steps), release (400ms = 8 steps)
  const attackSteps = Math.max(1, Math.round(config.attackDuration / 0.05));
  const holdSteps = Math.max(1, Math.round(config.holdDuration / 0.05));
  const releaseSteps = Math.max(1, Math.round(config.releaseDuration / 0.05));

  const smoothedVolumes = smoothVolumeEnvelope(rawVolumes, attackSteps, holdSteps, releaseSteps);

  config.onProgress?.(90, 'Generating de-amplified volume keyframes on BGM track...');
  await new Promise((r) => setTimeout(r, 0));

  // 3. Generate keyframes for each clip on the target BGM track
  const keyframesByClipId: Record<string, PropertyKeyframe[]> = {};
  for (const bgmClip of targetTrack.clips) {
    if (bgmClip.disabled) continue;
    const kfs = generateBgmDuckingKeyframesFromSpectrum(
      bgmClip,
      spectrumResult.stepSeconds,
      smoothedVolumes,
      spectrumResult.timelineStart
    );
    keyframesByClipId[bgmClip.id] = kfs;
  }

  config.onProgress?.(100, 'AI Audio Ducking Complete!');

  return {
    success: true,
    targetTrackId,
    duckedClipsCount: Object.keys(keyframesByClipId).length,
    speechIntervalsCount: Math.round(spectrumResult.totalVocalDuration / 1.5) || 1,
    totalSpeechDuration: spectrumResult.totalVocalDuration,
    vocalHighDuration: spectrumResult.vocalHighSeconds,
    vocalMidDuration: spectrumResult.vocalMidSeconds,
    vocalLowDuration: spectrumResult.vocalLowSeconds,
    keyframesByClipId,
  };
}

/**
 * Legacy compatibility wrapper.
 */
export async function analyzeAndDuckAudio(
  targetClip: TimelineClip,
  allClips: TimelineClip[],
  mediaLibrary: MediaItem[],
  duckAmount: number = 0.3,
  onProgress?: (progress: number) => void
): Promise<PropertyKeyframe[] | null> {
  const duckDb = 20 * Math.log10(Math.max(0.01, duckAmount));
  const config: AutoDuckingConfig = {
    ...DEFAULT_DUCKING_CONFIG,
    duckAmountDb: Number(duckDb.toFixed(1)),
    onProgress: (p) => onProgress?.(p),
  };

  const otherClips = allClips.filter(
    (c) => c.id !== targetClip.id && !c.disabled && !c.audioSettings?.muted
  );

  const speechIntervals: SpeechInterval[] = [];
  for (let i = 0; i < otherClips.length; i++) {
    const c = otherClips[i];
    const media = mediaLibrary.find((m) => m.id === c.mediaId);
    const intervals = await scanClipVocalIntervals(c, media, [], config.sensitivity);
    speechIntervals.push(...intervals);
  }

  if (speechIntervals.length === 0) return null;

  const merged = bridgeAndMergeSpeechIntervals(speechIntervals, config.bridgeGap);
  const duckingRegions = calculateDuckingRegions(merged, config);
  const keyframes = generateClipDuckingKeyframes(targetClip, duckingRegions, config);

  return keyframes.length > 0 ? keyframes : null;
}
