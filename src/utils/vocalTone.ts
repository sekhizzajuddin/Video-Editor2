// ─────────────────────────────────────────────────────────────────────────────
// VOCAL TONE SYSTEM (pure, unit-testable)
// -----------------------------------------------------------------------------
// Manual "Vocal Tone" control: -100 (girl/lady tone) … 0 (original) … +100
// (boy/man tone). Tone drives BOTH pitch (semitones) and formant (the same
// -100..100 scale as voiceFormant) so gender shifts sound natural instead of
// chipmunk-like.
//
// Automatic matching: estimate each clip's vocal fundamental frequency (F0)
// with an autocorrelation pitch detector, then compute the per-clip semitone
// correction needed so every clip's voice matches the reference (first) clip.
// The correction is stored SEPARATELY (vocalMatchShift/vocalMatchEnabled) and
// is layered ON TOP of the user's manual pitch/tone/formant — per-clip manual
// settings are never overwritten, yet the audible result is unified.
//
// Anti-robotic measures:
//  - The pitch shift itself is granular (duration-preserving) — see
//    src/utils/audio/granularPitch.ts — the same algorithm as the live preview.
//  - Auto-match pitch shifts are compensated by a formant EQ in the OPPOSITE
//    direction, so a voice raised to match the reference keeps its original
//    speaker character instead of sounding like a chipmunk.
// ─────────────────────────────────────────────────────────────────────────────

import { getRampedClipSourceSpan } from './speedRamp';
import type { SpeedRampKeyframe } from '@/types';

export const TONE_MIN = -100;
export const TONE_MAX = 100;
/** Hard ceiling for the combined (pitch + tone + auto-match) semitone shift. */
export const MAX_VOCAL_PITCH_ST = 14;
/** Sanity ceiling for a single auto-match correction. Kept low (3st) because
 *  larger pitch shifts always sound unnatural/robotic regardless of algorithm.
 *  The remainder is compensated via spectral EQ matching instead. */
export const MAX_MATCH_SHIFT_ST = 3;

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

// ── Manual tone → pitch / formant mapping ───────────────────────────────────

/**
 * -100 → -5 semitones (deeper / masculine), +100 → +5 semitones (higher /
 * feminine). Kept moderate so the granular shifter stays in its natural
 * sounding range (extreme ratios are what make voices sound robotic).
 */
export function toneToSemitones(tone: number): number {
  return round2(clamp(tone, TONE_MIN, TONE_MAX) * 0.05);
}

/**
 * Tone drives the same formant scale as voiceFormant (same sign): negative =
 * brighter (feminine direction), positive = darker (masculine direction).
 */
export function toneToFormant(tone: number): number {
  return clamp(tone, TONE_MIN, TONE_MAX);
}

export interface VocalToneSettings {
  pitch?: number;
  tone?: number;
  voiceFormant?: number;
  vocalMatchEnabled?: boolean;
  vocalMatchShift?: number;
}

function autoMatchShiftOf(settings: VocalToneSettings | undefined): number {
  const s = settings?.vocalMatchShift;
  if (settings?.vocalMatchEnabled && typeof s === 'number' && Number.isFinite(s)) {
    return s;
  }
  return 0;
}

/**
 * Total semitone shift applied to a clip: manual pitch + tone + auto-match
 * correction. Clamped to ±MAX_VOCAL_PITCH_ST.
 */
export function effectiveVocalPitchSt(settings: VocalToneSettings | undefined): number {
  const pitch = settings?.pitch ?? 0;
  const tone = settings?.tone ?? 0;
  const auto = autoMatchShiftOf(settings);
  return round2(clamp(pitch + toneToSemitones(tone) + auto, -MAX_VOCAL_PITCH_ST, MAX_VOCAL_PITCH_ST));
}

/**
 * Total formant value applied to a clip (same scale as voiceFormant):
 * manual formant + tone formant + auto-match compensation.
 *
 * The compensation term counters the formant shift the granular pitch shifter
 * introduces when it changes pitch: raising pitch also raises the spectral
 * envelope (chipmunk effect), so we darken by `shift * 8` formant units; the
 * reverse for lowering pitch.
 */
export function effectiveVocalFormant(settings: VocalToneSettings | undefined): number {
  const base = (settings?.voiceFormant ?? 0) + toneToFormant(settings?.tone ?? 0);
  const comp = autoMatchShiftOf(settings) * 8;
  return round2(clamp(base + comp, TONE_MIN, TONE_MAX));
}

// ── Vocal fundamental-frequency (F0) estimation ─────────────────────────────

/**
 * Estimates the dominant vocal fundamental frequency (Hz) of a mono signal
 * using frame-based normalized autocorrelation with median aggregation.
 * Returns null when the signal looks unvoiced/silent (or the clip is too
 * short to analyse).
 *
 * @param mono       mono PCM samples in [-1, 1]
 * @param sampleRate sample rate of `mono`
 */
export function estimateVocalF0(mono: Float32Array, sampleRate: number): number | null {
  if (!mono || mono.length < 1024 || !(sampleRate > 0)) return null;

  // Decimate to ≈8 kHz: F0 range 60–420 Hz needs only ~4 kHz of bandwidth and
  // the correlation loop becomes ~10x cheaper.
  const targetSr = 8000;
  const step = Math.max(1, Math.round(sampleRate / targetSr));
  const n = Math.floor(mono.length / step);
  if (n < 256) return null;
  const raw = new Float32Array(n);
  for (let i = 0; i < n; i++) raw[i] = mono[i * step];
  const sr = sampleRate / step;

  // ── Bandpass pre-filter (200–3500 Hz) ──────────────────────────────────
  // Rejects bass instruments, sub-bass, and high-frequency noise/cymbal
  // artifacts that otherwise dominate the autocorrelation in AI-generated
  // video clips where voice is mixed with music/SFX.
  const data = new Float32Array(n);
  // Simple 2nd-order high-pass at 200 Hz (reject bass instruments)
  const hpFreq = 200;
  const hpOmega = 2 * Math.PI * hpFreq / sr;
  const hpAlpha = Math.sin(hpOmega) / (2 * 0.707);
  const hpA0 = 1 + hpAlpha;
  const hpB0 = ((1 + Math.cos(hpOmega)) / 2) / hpA0;
  const hpB1 = -(1 + Math.cos(hpOmega)) / hpA0;
  const hpB2 = hpB0;
  const hpA1 = (-2 * Math.cos(hpOmega)) / hpA0;
  const hpA2 = (1 - hpAlpha) / hpA0;

  // Simple 2nd-order low-pass at 3500 Hz (reject cymbals/noise)
  const lpFreq = 3500;
  const lpOmega = 2 * Math.PI * lpFreq / sr;
  const lpAlpha = Math.sin(lpOmega) / (2 * 0.707);
  const lpA0 = 1 + lpAlpha;
  const lpB0 = ((1 - Math.cos(lpOmega)) / 2) / lpA0;
  const lpB1 = (1 - Math.cos(lpOmega)) / lpA0;
  const lpB2 = lpB0;
  const lpA1 = (-2 * Math.cos(lpOmega)) / lpA0;
  const lpA2 = (1 - lpAlpha) / lpA0;

  // Apply high-pass
  let hp_x1 = 0, hp_x2 = 0, hp_y1 = 0, hp_y2 = 0;
  const hpOut = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = raw[i];
    const y = hpB0 * x + hpB1 * hp_x1 + hpB2 * hp_x2 - hpA1 * hp_y1 - hpA2 * hp_y2;
    hpOut[i] = y;
    hp_x2 = hp_x1; hp_x1 = x;
    hp_y2 = hp_y1; hp_y1 = y;
  }
  // Apply low-pass
  let lp_x1 = 0, lp_x2 = 0, lp_y1 = 0, lp_y2 = 0;
  for (let i = 0; i < n; i++) {
    const x = hpOut[i];
    const y = lpB0 * x + lpB1 * lp_x1 + lpB2 * lp_x2 - lpA1 * lp_y1 - lpA2 * lp_y2;
    data[i] = y;
    lp_x2 = lp_x1; lp_x1 = x;
    lp_y2 = lp_y1; lp_y1 = y;
  }

  const minF0 = 60;
  const maxF0 = 500;
  const minLag = Math.max(1, Math.floor(sr / maxF0));
  const maxLag = Math.ceil(sr / minF0);
  const frameLen = Math.min(data.length, Math.round(sr * 0.04)); // 40 ms
  if (frameLen < minLag + 4) return null;
  const hop = Math.max(1, Math.floor(frameLen / 2));

  // Spread a bounded number of frames over the whole clip (large clips would
  // otherwise take seconds to analyse; 1200 frames is plenty for a median).
  const maxFrames = 1200;
  const stride = Math.max(hop, Math.floor((data.length - frameLen) / maxFrames));

  const corrAt = (start: number, mean: number, energy: number, lag: number): number => {
    if (lag < 1 || lag >= frameLen) return 0;
    let num = 0;
    let denB = 0;
    const end = frameLen - lag;
    for (let i = 0; i < end; i++) {
      const a = data[start + i] - mean;
      const b = data[start + i + lag] - mean;
      num += a * b;
      denB += b * b;
    }
    const den = Math.sqrt(energy * denB);
    return den > 1e-9 ? num / den : 0;
  };

  const f0s: number[] = [];
  for (let start = 0; start + frameLen <= data.length; start += stride) {
    let mean = 0;
    for (let i = 0; i < frameLen; i++) mean += data[start + i];
    mean /= frameLen;

    let energy = 0;
    for (let i = 0; i < frameLen; i++) {
      const v = data[start + i] - mean;
      energy += v * v;
    }
    const rms = Math.sqrt(energy / frameLen);
    if (rms < 0.005) continue; // silence gate (~ -46 dBFS)

    let bestLag = -1;
    let bestR = 0;
    for (let lag = minLag; lag <= maxLag; lag++) {
      const r = corrAt(start, mean, energy, lag);
      if (r > bestR) {
        bestR = r;
        bestLag = lag;
      }
    }
    // Higher confidence threshold (0.50 vs old 0.35) rejects music-dominated
    // frames where the autocorrelation peak is from instruments, not voice.
    if (bestLag >= minLag && bestR > 0.50) {
      // Parabolic refinement for sub-sample lag accuracy.
      const r0 = corrAt(start, mean, energy, bestLag - 1);
      const r2 = corrAt(start, mean, energy, bestLag + 1);
      const denom = r0 - 2 * bestR + r2;
      let refined = bestLag;
      if (Math.abs(denom) > 1e-9) refined = bestLag + (0.5 * (r0 - r2)) / denom;
      if (refined > 0) f0s.push(sr / refined);
    }
  }

  if (f0s.length === 0) return null;
  const analyzed = Math.floor((data.length - frameLen) / stride) + 1;
  if (f0s.length < Math.max(4, analyzed * 0.1)) return null; // too little voiced content
  f0s.sort((a, b) => a - b);
  return round2(f0s[Math.floor(f0s.length / 2)]);
}

/**
 * Semitone correction that makes a clip with `clipF0` match a reference at
 * `referenceF0`: 12·log2(ref/clip). Positive → raise the clip, negative →
 * lower it. Returns null for invalid inputs.
 */
export function computeMatchShiftSemitones(referenceF0: number, clipF0: number): number | null {
  if (!(referenceF0 > 0) || !(clipF0 > 0)) return null;
  const st = 12 * Math.log2(referenceF0 / clipF0);
  if (!Number.isFinite(st)) return null;
  return round2(clamp(st, -MAX_MATCH_SHIFT_ST, MAX_MATCH_SHIFT_ST));
}

// ── Clip-level analysis / matching ──────────────────────────────────────────

export interface DecodedAudioLike {
  numberOfChannels: number;
  length: number;
  sampleRate: number;
  duration: number;
  getChannelData(channel: number): Float32Array;
}

export interface VocalClipLike {
  id: string;
  mediaId: string;
  startTime: number;
  trimStart: number;
  duration: number;
  speed?: number;
  speedRamp?: SpeedRampKeyframe[];
}

export interface VocalMediaLike {
  id: string;
  url?: string;
  _fileBlob?: Blob | File | null;
  _audioBlob?: Blob | File | null;
  duration?: number;
}

export type VocalDecodeFn = (url: string | undefined, blob: Blob | File | null | undefined) => Promise<DecodedAudioLike | null>;

export interface VocalMatchResult {
  clipId: string;
  /** Detected vocal fundamental frequency in Hz (null when undetectable). */
  f0: number | null;
  /** Correction needed to match the reference clip (null when not computable). */
  shiftSemitones: number | null;
  /** Unclamped raw semitone difference (before MAX_MATCH_SHIFT_ST cap). */
  rawShiftSemitones: number | null;
  /** Recommended EQ adjustments to compensate what pitch shift can't fix. */
  eqAdjustments?: {
    bass: number;       // -15 to 15
    mid: number;        // -15 to 15
    treble: number;     // -15 to 15
    warmth: number;     // -100 to 100
    compression: number; // 0 to 100
  };
  status: 'reference' | 'matched' | 'no-audio' | 'no-voice' | 'error';
}

/**
 * Analyzes the spectral energy distribution of a mono signal and returns
 * normalized band energies (bass, mid, treble, presence).
 */
export function analyzeSpectralProfile(
  mono: Float32Array,
  sampleRate: number
): { bass: number; mid: number; treble: number; presence: number; rms: number } | null {
  if (!mono || mono.length < 2048) return null;

  // Simple band energy analysis using overlapping frames
  const frameLen = 2048;
  const hop = 1024;
  let bassE = 0, midE = 0, trebleE = 0, presenceE = 0, totalE = 0;
  let frames = 0;

  for (let start = 0; start + frameLen <= mono.length; start += hop) {
    // Compute power spectrum via DFT energy in bands
    // Bass: 80-300 Hz, Mid: 300-2000 Hz, Treble: 2000-6000 Hz, Presence: 1000-4000 Hz
    const bassLow = Math.floor(80 * frameLen / sampleRate);
    const bassHigh = Math.floor(300 * frameLen / sampleRate);
    const midLow = bassHigh;
    const midHigh = Math.floor(2000 * frameLen / sampleRate);
    const trebLow = midHigh;
    const trebHigh = Math.min(Math.floor(6000 * frameLen / sampleRate), frameLen / 2);
    const presLow = Math.floor(1000 * frameLen / sampleRate);
    const presHigh = Math.min(Math.floor(4000 * frameLen / sampleRate), frameLen / 2);

    // Use simple energy-in-band via time-domain bandpass approximation
    // (cheaper than full FFT, good enough for coarse spectral matching)
    for (let i = 0; i < frameLen; i++) {
      const v = mono[start + i];
      totalE += v * v;
    }

    // Approximate band energies via autocorrelation at band-center lags
    // Bass center ~150Hz, Mid center ~800Hz, Treble center ~4000Hz
    const bassLag = Math.round(sampleRate / 150);
    const midLag = Math.round(sampleRate / 800);
    const trebLag = Math.round(sampleRate / 4000);
    const presLag = Math.round(sampleRate / 2000);

    let bCorr = 0, mCorr = 0, tCorr = 0, pCorr = 0;
    const segLen = Math.min(frameLen, 1024);
    for (let i = 0; i < segLen; i++) {
      const v = mono[start + i];
      if (i + bassLag < frameLen) bCorr += v * mono[start + i + bassLag];
      if (i + midLag < frameLen) mCorr += v * mono[start + i + midLag];
      if (i + trebLag < frameLen) tCorr += v * mono[start + i + trebLag];
      if (i + presLag < frameLen) pCorr += v * mono[start + i + presLag];
    }
    bassE += Math.max(0, bCorr);
    midE += Math.max(0, mCorr);
    trebleE += Math.max(0, tCorr);
    presenceE += Math.max(0, pCorr);
    frames++;
  }

  if (frames === 0 || totalE < 1e-10) return null;
  const rms = Math.sqrt(totalE / (frames * frameLen));
  const norm = bassE + midE + trebleE + 1e-10;
  return {
    bass: bassE / norm,
    mid: midE / norm,
    treble: trebleE / norm,
    presence: presenceE / (norm + 1e-10),
    rms,
  };
}

/**
 * Computes EQ adjustments to make a clip's spectral profile closer to the
 * reference's profile. Returns conservative adjustments that won't distort.
 */
export function computeEqAdjustments(
  refProfile: ReturnType<typeof analyzeSpectralProfile>,
  clipProfile: ReturnType<typeof analyzeSpectralProfile>,
  rawShiftDiff: number // how many semitones couldn't be covered by pitch shift
): { bass: number; mid: number; treble: number; warmth: number; compression: number } {
  const defaults = { bass: 0, mid: 0, treble: 0, warmth: 0, compression: 0 };
  if (!refProfile || !clipProfile) return defaults;

  // Spectral difference → EQ adjustments (scaled conservatively)
  const bassDiff = (refProfile.bass - clipProfile.bass) * 30; // ±15 dB range
  const midDiff = (refProfile.mid - clipProfile.mid) * 20;
  const trebleDiff = (refProfile.treble - clipProfile.treble) * 20;

  // Warmth: if the reference is warmer (more bass relative to treble), add warmth
  const refWarmth = refProfile.bass / (refProfile.treble + 1e-10);
  const clipWarmth = clipProfile.bass / (clipProfile.treble + 1e-10);
  const warmthDiff = clamp((refWarmth - clipWarmth) * 30, -50, 50);

  // Add compression to unify dynamics (more compression for larger voice differences)
  const compressionBase = Math.min(60, Math.abs(rawShiftDiff) * 10);

  // RMS loudness matching → additional gain compensation via compression
  const rmsRatio = refProfile.rms / (clipProfile.rms + 1e-10);
  const rmsComp = rmsRatio > 1.5 || rmsRatio < 0.67 ? 20 : 0;

  return {
    bass: round2(clamp(bassDiff, -10, 10)),
    mid: round2(clamp(midDiff, -8, 8)),
    treble: round2(clamp(trebleDiff, -10, 10)),
    warmth: round2(clamp(warmthDiff, -50, 50)),
    compression: round2(clamp(compressionBase + rmsComp, 0, 60)),
  };
}

// Shared decode context (decodeAudioData works even while suspended, so the
// autoplay policy is irrelevant here).
let sharedDecodeCtx: AudioContext | null = null;
function getDecodeCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!sharedDecodeCtx) {
      const Ctor = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
        || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      sharedDecodeCtx = new Ctor();
    }
    return sharedDecodeCtx;
  } catch {
    return null;
  }
}

export const defaultVocalDecode: VocalDecodeFn = async (url, blob) => {
  const ctx = getDecodeCtx();
  if (!ctx) return null;
  let arrayBuffer: ArrayBuffer | null = null;
  if (blob instanceof Blob) {
    arrayBuffer = await blob.arrayBuffer();
  } else if (url) {
    const res = await fetch(url);
    if (!res.ok) return null;
    arrayBuffer = await res.arrayBuffer();
  }
  if (!arrayBuffer) return null;
  try {
    return await ctx.decodeAudioData(arrayBuffer.slice(0));
  } catch {
    return null;
  }
};

/** Extracts the mono downmix of buffer[startSec, endSec) — the clip's used window. */
export function extractMonoWindow(
  buffer: DecodedAudioLike,
  startSec: number,
  endSec: number
): Float32Array {
  const sr = buffer.sampleRate;
  const s = Math.max(0, Math.floor(startSec * sr));
  const e = Math.min(buffer.length, Math.ceil(endSec * sr));
  if (e - s < 32) return new Float32Array(0);
  const ch0 = buffer.getChannelData(0);
  if (buffer.numberOfChannels <= 1) return ch0.slice(s, e);
  const ch1 = buffer.getChannelData(1);
  const out = new Float32Array(e - s);
  for (let i = 0; i < out.length; i++) out[i] = (ch0[s + i] + ch1[s + i]) * 0.5;
  return out;
}

/**
 * Analyses every clip (sorted by startTime — the first one is the reference),
 * estimates each clip's vocal F0 and computes the semitone correction that
 * makes it match the reference. Nothing is written to the store here; the
 * caller applies the results (per-clip manual settings stay untouched).
 *
 * `decode` is injectable for tests; it defaults to fetch + decodeAudioData.
 */
export async function analyzeClipsForVocalMatch(
  clips: VocalClipLike[],
  mediaMap: VocalMediaLike[],
  decode: VocalDecodeFn = defaultVocalDecode
): Promise<VocalMatchResult[]> {
  const byId = new Map(mediaMap.map((m) => [m.id, m]));
  const sorted = [...clips].sort((a, b) => a.startTime - b.startTime);
  const results: VocalMatchResult[] = [];
  const spectralProfiles: (ReturnType<typeof analyzeSpectralProfile>)[] = [];

  for (const clip of sorted) {
    const media = byId.get(clip.mediaId);
    if (!media || (!media.url && !media._fileBlob && !media._audioBlob)) {
      results.push({ clipId: clip.id, f0: null, shiftSemitones: null, rawShiftSemitones: null, status: 'no-audio' });
      spectralProfiles.push(null);
      continue;
    }
    let buffer: DecodedAudioLike | null = null;
    try {
      buffer = await decode(media.url, media._audioBlob || media._fileBlob);
    } catch {
      buffer = null;
    }
    if (!buffer) {
      results.push({ clipId: clip.id, f0: null, shiftSemitones: null, rawShiftSemitones: null, status: 'error' });
      spectralProfiles.push(null);
      continue;
    }
    const sourceDuration = media.duration ?? buffer.duration;
    const span = getRampedClipSourceSpan(
      { id: clip.id, trimStart: clip.trimStart, duration: clip.duration, speed: clip.speed ?? 1, speedRamp: clip.speedRamp },
      sourceDuration
    );
    const startSec = clip.trimStart ?? 0;
    const endSec = Math.min(sourceDuration, startSec + span);
    const window = extractMonoWindow(buffer, startSec, endSec);
    const f0 = estimateVocalF0(window, buffer.sampleRate);
    const spectral = analyzeSpectralProfile(window, buffer.sampleRate);
    results.push({ clipId: clip.id, f0, shiftSemitones: null, rawShiftSemitones: null, status: f0 !== null ? 'matched' : 'no-voice' });
    spectralProfiles.push(spectral);
  }

  const refIdx = results.findIndex((r) => r.f0 !== null);
  if (refIdx < 0) return results; // no voiced content anywhere → nothing to match
  const reference = results[refIdx];
  const refProfile = spectralProfiles[refIdx];

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.f0 === null) continue;
    // Compute raw (unclamped) shift
    const rawSt = computeMatchShiftSemitones(reference.f0 as number, r.f0);
    r.rawShiftSemitones = rawSt;
    // Clamped shift (MAX_MATCH_SHIFT_ST = 3) for the actual pitch adjustment
    r.shiftSemitones = rawSt !== null ? round2(clamp(rawSt, -MAX_MATCH_SHIFT_ST, MAX_MATCH_SHIFT_ST)) : null;
    r.status = r.clipId === reference.clipId ? 'reference' : 'matched';

    // Compute EQ adjustments to compensate what pitch can't fix
    if (r.clipId !== reference.clipId && rawSt !== null) {
      const uncoveredSt = (rawSt ?? 0) - (r.shiftSemitones ?? 0);
      r.eqAdjustments = computeEqAdjustments(refProfile, spectralProfiles[i], uncoveredSt);
    }
  }
  return results;
}
