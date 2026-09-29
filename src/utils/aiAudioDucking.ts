import { TimelineClip, TimelineTrack, MediaItem, PropertyKeyframe, SubtitleItem } from '@/types';
import { resolveMediaFile } from './mediaFileHandle';

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
  duckAmountDb: number;     // e.g. -18 dB (default)
  attackDuration: number;   // seconds (default 0.35s)
  holdDuration: number;     // seconds (default 0.35s)
  releaseDuration: number;  // seconds (default 0.6s)
  bridgeGap: number;        // seconds to bridge between words/sentences (default 0.8s)
  sensitivity: 'low' | 'normal' | 'high'; // VAD sensitivity
  onProgress?: (progress: number, status: string) => void;
}

export const DEFAULT_DUCKING_CONFIG: AutoDuckingConfig = {
  duckAmountDb: -18,
  attackDuration: 0.35,
  holdDuration: 0.35,
  releaseDuration: 0.6,
  bridgeGap: 0.8,
  sensitivity: 'normal',
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
  const trimStart = clip.trimStart || 0;
  const trimEnd = trimStart + clipDuration;

  // Resample/render speech bandpass (300 Hz - 3400 Hz) using OfflineAudioContext
  const targetSampleRate = 16000; // 16kHz is ideal for speech analysis and extremely fast
  const sampleLength = Math.max(1, Math.floor(clipDuration * targetSampleRate));
  
  const offlineCtx = new (window.OfflineAudioContext || (window as any).webkitOfflineAudioContext)(
    1,
    sampleLength,
    targetSampleRate
  );

  const source = offlineCtx.createBufferSource();
  source.buffer = audioBuffer;

  // Bandpass filter to isolate vocal formant frequencies and reject low rumble / high hiss
  const bandpass = offlineCtx.createBiquadFilter();
  bandpass.type = 'bandpass';
  bandpass.frequency.value = 1500;
  bandpass.Q.value = 0.7; // Quality factor to cover ~300Hz to 3400Hz

  source.connect(bandpass);
  bandpass.connect(offlineCtx.destination);

  // Start source at trim offset
  source.start(0, trimStart, clipDuration);

  const renderedBuffer = await offlineCtx.startRendering();
  const channelData = renderedBuffer.getChannelData(0);

  // Compute RMS energy in 50ms frames (800 samples at 16kHz)
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

  // Estimate ambient noise floor (15th percentile of frame energies)
  const sorted = Float32Array.from(frameEnergies).sort();
  const noiseFloor = sorted[Math.floor(sorted.length * 0.15)] || 0.005;

  // Threshold based on sensitivity preset
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

  // Group active frames into speech bursts (minimum 120ms to reject clicks/pops)
  const minFrames = Math.ceil(0.12 / 0.05); // at least 120ms
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

  // Handle burst extending to end of clip
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
 * 1. Checks subtitles / captions / word timestamps first (instantaneous & 100% accurate)
 * 2. Uses fast OfflineAudioContext bandpass VAD if audio is present
 * 3. Falls back to waveform peaks envelope if audio context decoding is unavailable
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

  // 1. Check Subtitles / Captions overlapping this clip
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

  // Check word-level timestamps in media or clip
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

  // 2. Acoustic Voice Activity Detection (VAD) via Offline DSP
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

  // Sort by start timestamp
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged: SpeechInterval[] = [];
  let current: SpeechInterval = { ...sorted[0] };

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];
    // If next speech interval starts within bridgeGap of current interval end: merge
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

  // Merge contiguous / overlapping ducking regions
  const merged: DuckingRegion[] = [];
  let cur = { ...rawRegions[0] };

  for (let i = 1; i < rawRegions.length; i++) {
    const next = rawRegions[i];
    // If next attack starts before or at current release end, merge
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

  // Base volume in dB (default 0 dB)
  const baseVolume = clip.audioSettings?.volume ?? 0;
  // Ducked volume in dB (e.g. 0 + (-18) = -18 dB)
  const duckVolume = baseVolume + config.duckAmountDb;

  // Filter ducking regions that intersect with this clip
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

  // Anchor at clip start
  const firstRegion = relevant[0];
  if (firstRegion.attackStart > clipStart) {
    rawPoints.push({ time: 0, value: baseVolume, easing: 'linear' });
  }

  for (const r of relevant) {
    // 1. Attack ramp start (normal volume)
    const tAttStart = Math.max(0, Math.min(clipDuration, r.attackStart - clipStart));
    // 2. Duck reached (speech starts)
    const tDuckStart = Math.max(0, Math.min(clipDuration, r.duckStart - clipStart));
    // 3. Duck ends (speech stops + hold)
    const tDuckEnd = Math.max(0, Math.min(clipDuration, r.duckEnd - clipStart));
    // 4. Release ramp end (normal volume restored)
    const tRelEnd = Math.max(0, Math.min(clipDuration, r.releaseEnd - clipStart));

    // If clip started already inside the ducked speech block:
    if (r.attackStart <= clipStart && r.duckEnd > clipStart) {
      rawPoints.push({ time: 0, value: duckVolume, easing: 'linear' });
    } else {
      rawPoints.push({ time: tAttStart, value: baseVolume, easing: 'easeOut' });
      rawPoints.push({ time: tDuckStart, value: duckVolume, easing: 'linear' });
    }

    // If clip ends before speech finishes:
    if (r.releaseEnd >= clipEnd) {
      if (r.duckEnd < clipEnd) {
        rawPoints.push({ time: tDuckEnd, value: duckVolume, easing: 'easeIn' });
        rawPoints.push({ time: clipDuration, value: baseVolume, easing: 'linear' });
      } else {
        rawPoints.push({ time: clipDuration, value: duckVolume, easing: 'linear' });
      }
    } else {
      rawPoints.push({ time: tDuckEnd, value: duckVolume, easing: 'easeIn' });
      rawPoints.push({ time: tRelEnd, value: baseVolume, easing: 'linear' });
    }
  }

  // Anchor at clip end if not already anchored
  const lastRegion = relevant[relevant.length - 1];
  if (lastRegion.releaseEnd < clipEnd) {
    rawPoints.push({ time: clipDuration, value: baseVolume, easing: 'linear' });
  }

  // Sort and deduplicate keyframes by timestamp (keep closest distinct points >= 10ms)
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
        // Overwrite if same timestamp with lower volume (duck priority)
        if (pt.value < prev.value) {
          prev.value = Number(pt.value.toFixed(1));
          prev.easing = easing;
        }
      } else {
        deduped.push({ time: Number(pt.time.toFixed(3)), value: Number(pt.value.toFixed(1)), easing });
      }
    }
  }

  // Ensure first keyframe is at time 0
  if (deduped.length === 0 || deduped[0].time > 0) {
    deduped.unshift({ time: 0, value: baseVolume, easing: 'linear' });
  }
  // Ensure last keyframe is at clipDuration
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
}

/**
 * Core One-Click Engine:
 * Scans all vocal clips across non-BGM tracks and applies volume keyframes to the selected BGM track.
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

  // 1. Collect all vocal clips from all other tracks (non-target tracks that are not muted/disabled)
  const vocalClips: TimelineClip[] = [];
  for (const track of tracks) {
    if (track.id === targetTrackId || track.muted || (track as any).isMuted) continue;
    for (const clip of track.clips || []) {
      if (clip.disabled || clip.audioSettings?.muted) continue;
      vocalClips.push(clip);
    }
  }

  config.onProgress?.(10, 'Scanning vocal tracks and dialogue...');

  // 2. Scan vocal intervals across all speech clips
  const allSpeechIntervals: SpeechInterval[] = [];
  for (let i = 0; i < vocalClips.length; i++) {
    const clip = vocalClips[i];
    const media = mediaLibrary.find((m) => m.id === clip.mediaId);
    
    // Yield to browser event loop to prevent UI freezing
    await new Promise((r) => setTimeout(r, 0));

    const intervals = await scanClipVocalIntervals(clip, media, subtitles, config.sensitivity);
    allSpeechIntervals.push(...intervals);

    const scanPercent = 10 + Math.round(((i + 1) / Math.max(1, vocalClips.length)) * 50);
    config.onProgress?.(scanPercent, `Analyzing vocal clip ${i + 1} of ${vocalClips.length}...`);
  }

  config.onProgress?.(65, 'Bridging speech pauses and computing ducking envelope...');

  // 3. Bridge short pauses and merge overlapping speech blocks
  const mergedSpeech = bridgeAndMergeSpeechIntervals(allSpeechIntervals, config.bridgeGap);

  let totalSpeechDuration = 0;
  for (const s of mergedSpeech) {
    totalSpeechDuration += s.end - s.start;
  }

  config.onProgress?.(80, 'Generating smooth volume keyframes for BGM clips...');

  // 4. Calculate ducking curves
  const duckingRegions = calculateDuckingRegions(mergedSpeech, config);

  // 5. Generate keyframes for each clip on the target BGM track
  const keyframesByClipId: Record<string, PropertyKeyframe[]> = {};
  for (const bgmClip of targetTrack.clips) {
    if (bgmClip.disabled) continue;
    const kfs = generateClipDuckingKeyframes(bgmClip, duckingRegions, config);
    keyframesByClipId[bgmClip.id] = kfs;
  }

  config.onProgress?.(100, 'Auto ducking complete!');

  return {
    success: true,
    targetTrackId,
    duckedClipsCount: Object.keys(keyframesByClipId).length,
    speechIntervalsCount: mergedSpeech.length,
    totalSpeechDuration: Number(totalSpeechDuration.toFixed(2)),
    keyframesByClipId,
  };
}

/**
 * Legacy compatibility wrapper:
 * Maintains backwards compatibility for any existing calls to analyzeAndDuckAudio.
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
