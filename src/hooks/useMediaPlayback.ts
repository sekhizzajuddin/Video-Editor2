/**
 * useMediaPlayback.ts (Refactored)
 *
 * Fixes applied:
 * 1. Single rAF sync loop — no more fighting useEffects
 * 2. Audio vs Video differentiated sync strategy
 * 3. Removed `if (true)` forced seek storm
 * 4. Audio: hard-seek threshold 500ms, PLL max 0.5%, threshold 100ms
 * 5. Video: hard-seek threshold 100ms, PLL max 3%, threshold 20ms
 * 6. Web Audio latency compensation for video rendering
 * 7. Cached sorted tracks (O(N²) sort removed)
 * 8. Immediate audioCtx.resume() on play start
 * 9. PIP absStartTime consistently used everywhere
 * 10. Speed ramp respected in synchronousSeek
 */

import { useEffect, useRef, useCallback, useState, useSyncExternalStore } from 'react';

const setAudioParam = (param: AudioParam, target: number, ctxTime: number, rampTime: number = 0.08, threshold: number = 0.005) => {
  const currentTarget = (param as any)._procutTarget;
  if (currentTarget === undefined || Math.abs(currentTarget - target) > threshold) {
    (param as any)._procutTarget = target;
    param.setTargetAtTime(target, ctxTime, rampTime);
  }
};

import { useEditorStore } from '@/store/editorStore';
import { getMediaTimeForClip, getSpeedForClipAtTime, getClipSourceEnd } from '@/utils/speedRamp';
import { effectiveVocalFormant, effectiveVocalPitchSt } from '@/utils/vocalTone';
import { getAnimatedValue } from '@/utils/keyframes';
import { generateReverbImpulse } from '@/utils/reverbDsp';
import { resolveMediaFile } from '@/utils/mediaFileHandle';
import { usePlaybackTime, useTimeBucket } from './usePlaybackTime';
import { getPlaybackTime, subscribePlaybackTime, getTrimPreviewTime, getEffectivePreviewTime, subscribeTrimPreviewTime, setIsPlayingClock } from '@/utils/playbackClock';
import { findActiveTransition, getTransitionAudioGains, getTransitionWindow, normalizeTransition } from '@/utils/transitionEngine';
import { playTransitionSoundPreview } from '@/timeline/sfxSynth';
import { getMediaPoolContainer, attachInvisibleMediaElement } from '@/utils/mediaPoolContainer';
import { isPreviewSuspendedForExport, subscribePreviewSuspension } from '@/utils/previewSuspension';
import { playbackDiagnostics } from '@/utils/playbackDiagnostics';

// ---------------------------------------------------------------------------
// Global Master Audio Context
// ---------------------------------------------------------------------------
let masterAudioCtx: AudioContext | null = null;
let masterCompressor: DynamicsCompressorNode | null = null;
let masterAudioDestination: MediaStreamAudioDestinationNode | null = null;
const trackAnalysers = new Map<string, AnalyserNode>();
let masterAnalyser: AnalyserNode | null = null;

if (typeof window !== 'undefined') {
  (window as any).procutTrackAnalysers = trackAnalysers;
}

/**
 * Strict teardown of HTMLVideoElement / HTMLAudioElement.
 * Calling removeAttribute('src') and load() forces Chromium to immediately
 * release the hardware video decoder, Direct3D11 context, and uncompressed frame buffers.
 */
function releaseMediaElement(el: HTMLVideoElement | HTMLAudioElement) {
  try {
    const elAny = el as any;
    if (elAny._onVisibilityChange) {
      document.removeEventListener('visibilitychange', elAny._onVisibilityChange);
      delete elAny._onVisibilityChange;
    }
    el.pause();
    el.removeAttribute('src');
    el.load();
  } catch (_e) {
    // ignore
  }
  try {
    el.remove();
  } catch (_e) {
    // ignore
  }
}

function getMasterAudioCtx() {
  if (!masterAudioCtx) {
    const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      masterAudioCtx = new AudioContextClass();
      if (masterAudioCtx) {
        masterAudioDestination = masterAudioCtx.createMediaStreamDestination();

        masterCompressor = masterAudioCtx.createDynamicsCompressor();
        masterCompressor.threshold.value = -12;
        masterCompressor.knee.value = 6;
        masterCompressor.ratio.value = 4;
        masterCompressor.attack.value = 0.003;
        masterCompressor.release.value = 0.25;

        masterAnalyser = masterAudioCtx.createAnalyser();
        masterAnalyser.fftSize = 64;

        const splitter = masterAudioCtx.createChannelSplitter(2);
        const masterAnalyserL = masterAudioCtx.createAnalyser();
        masterAnalyserL.fftSize = 64;
        const masterAnalyserR = masterAudioCtx.createAnalyser();
        masterAnalyserR.fftSize = 64;

        if (typeof window !== 'undefined') {
          (window as any).procutMasterAnalyser = masterAnalyser;
          (window as any).procutMasterAnalyserL = masterAnalyserL;
          (window as any).procutMasterAnalyserR = masterAnalyserR;
        }

        masterCompressor.connect(masterAnalyser);
        masterAnalyser.connect(masterAudioCtx.destination);
        masterAnalyser.connect(masterAudioDestination);
        masterAnalyser.connect(splitter);
        splitter.connect(masterAnalyserL, 0);
        splitter.connect(masterAnalyserR, 1);
      }
    }
  }
  return masterAudioCtx;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface MediaElement {
  el: HTMLVideoElement | HTMLAudioElement;
  clipId: string;
  mediaId: string;
  type: 'video' | 'audio';
  // Per-clip listener refs. These live on the ENTRY (not on the element) so
  // that several clips sharing one <video> element can each bind/remove their
  // own listeners without clobbering each other's refs.
  _handleSeeked?: () => void;
  _mediaRetryLoad?: () => void;
  _rvfcHandle?: number | null;
  _rvfcRegistered?: boolean;
  _onVisibilityChange?: () => void;
  // Shared-element bookkeeping: the registry key of the <video> element this
  // entry uses, and the clip's time range (used to refuse sharing when two
  // clips of one split chain are made to overlap).
  _shareKey?: string;
  _shareStart?: number;
  _shareEnd?: number;
  _migrated?: boolean;
  audioCtx?: AudioContext;
  sourceNode?: MediaElementAudioSourceNode;
  pitchNode?: ScriptProcessorNode;
  vocalFilter?: BiquadFilterNode;
  vocalFilterF1?: BiquadFilterNode; // F1 formant ~500Hz
  vocalFilterF3?: BiquadFilterNode; // F3 formant ~2500Hz
  denoiseFilter?: BiquadFilterNode;
  bassFilter?: BiquadFilterNode;
  midFilter?: BiquadFilterNode;
  trebleFilter?: BiquadFilterNode;
  compressorNode?: DynamicsCompressorNode;
  deEsserFilter?: BiquadFilterNode;
  warmthFilter?: BiquadFilterNode;
  pannerNode?: StereoPannerNode;
  gainNode?: GainNode;
  delayNode?: DelayNode;
  delayGain?: GainNode;
  feedbackInputGain?: GainNode;
  feedbackNode?: GainNode;
  reverbDryGain?: GainNode;
  reverbWetGain?: GainNode;
  convolverNode?: ConvolverNode;
  reverbPreFilter?: BiquadFilterNode;
  _lastReverbKey?: string;
  separationGraph?: SeparationGraph;
  _fxConnected?: boolean;
  _isGraphConnected?: boolean;
}

export interface MediaPlaybackResult {
  videoElements: Map<string, HTMLVideoElement>;
}

interface SeparationGraph {
  input: GainNode;
  output: GainNode;
  lowGain: GainNode;
  highGain: GainNode;
  midOutputGain: GainNode;
  sideGain: GainNode;
  bypassGain: GainNode;
}

interface ActiveClipInfo {
  clipId: string;
  mediaId: string;
  clipStart: number;
  clipDuration: number;
  trimStart: number;
  trackMuted: boolean;
  trackType: 'video' | 'audio';
  speed: number;
  speedRamp?: any[];
  speedFrames?: any[];
  speedFrameSourceEnd?: number;
  isReversed?: boolean;
  freezeFrame?: number;
  absStartTime: number;
  trackId: string;
  trackVolume: number;
  trackPan: number;
  trackSolo: boolean;
  clip: any;
}

// ---------------------------------------------------------------------------
// Globals
// ---------------------------------------------------------------------------
const globalMediaPool = new Map<string, MediaElement>();
const globalVideoMap = new Map<string, HTMLVideoElement>();
const globalPlaybackResult: MediaPlaybackResult = { videoElements: globalVideoMap };

// ─────────────────────────────────────────────────────────────────────────────
// Shared <video> elements per media FILE (not per clip).
//
// Splitting a clip into many segments produces many clip entries that all
// reference the SAME media URL. Previously every segment got its own <video>
// element and the proximity loader rotated the (small) decoder budget between
// them: each split-boundary crossing cleared one element's src and el.load()'d
// the next segment's element — a full decode restart — so heavily-split clips
// stuttered / showed stale or black frames in the preview canvas. Sharing one
// element per mediaId (refcounted) turns every boundary crossing into a cheap
// seek on the SAME element: the decoder never restarts.
// ─────────────────────────────────────────────────────────────────────────────
const mediaVideoEls = new Map<string, HTMLVideoElement>();
const mediaVideoRefCount = new Map<string, number>();

let primaryControllerId: number | null = null;
let nextControllerId = 1;
const activeControllers = new Set<number>();
// Listener set used to push "primary changed" notifications to all mounted
// hook instances (React concurrent-safe).
const controllerListeners = new Set<() => void>();

function notifyControllerChange(): void {
  for (const l of controllerListeners) {
    try {
      l();
    } catch {
      /* a broken listener must never break controller registration */
    }
  }
}

function registerControllerInstance(id: number): void {
  activeControllers.add(id);
  if (primaryControllerId === null || !activeControllers.has(primaryControllerId)) {
    primaryControllerId = id;
  }
  notifyControllerChange();
}

function unregisterControllerInstance(id: number): void {
  activeControllers.delete(id);
  if (primaryControllerId === id) {
    // Deterministic: the lowest surviving id becomes primary.
    primaryControllerId =
      activeControllers.size > 0 ? Math.min(...activeControllers) : null;
  }
  notifyControllerChange();
}

// ---------------------------------------------------------------------------
// Mobile / Android support helpers
// ---------------------------------------------------------------------------
/**
 * True on phones and tablets (any coarse-pointer / multi-touch device).
 * Used to scale media-pool behaviour for the constrained mobile media stack.
 */
export function isCoarsePointerDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  return (
    (navigator.maxTouchPoints ?? 0) > 1 ||
    (typeof window.matchMedia === 'function' &&
      window.matchMedia('(pointer: coarse)').matches)
  );
}

export function isAndroidDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /android/i.test(navigator.userAgent || '');
}

export function isIOSDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

export function isMobileDevice(): boolean {
  return isAndroidDevice() || isIOSDevice() || isCoarsePointerDevice();
}

/**
 * How many pooled <video> elements may hold a src at once.
 *
 * ANDROID FIX: phones expose only a handful of hardware video decoder
 * instances; elements beyond that budget stay stuck at readyState 0 and can
 * never be drawn (black preview). Two sources cover an A/V pair or a single
 * transition on a phone; desktop GPUs get four for dense multi-track stacks.
 *
 * Deliberately keyed off the mobile OS (Android/iOS), NOT coarse pointers:
 * Windows touchscreen laptops report maxTouchPoints > 0 but have full desktop
 * decoder budgets and must not be downgraded. Resolved once per session.
 */
let cachedMaxLoadedVideos: number | null = null;
export function getMaxLoadedVideos(): number {
  if (cachedMaxLoadedVideos === null) {
    cachedMaxLoadedVideos = isAndroidDevice() || isIOSDevice() ? 4 : 8;
  }
  return cachedMaxLoadedVideos;
}

// ---------------------------------------------------------------------------
// Media-source URL helpers
// ---------------------------------------------------------------------------
/**
 * ANDROID FIX: Chrome/WebView on real Android devices mishandles media
 * element srcs carrying a `#fragment` when the URL uses the `blob:`/`data:`
 * scheme — the load can stall or fail outright (fragments are only meaningful
 * as media-fragments for remote resources; on local blob URLs they break the
 * fetch on Android builds), while desktop Chrome resolves them identically.
 * This is exactly why imported clips rendered their timeline thumbnails on
 * Android (the import probe uses the raw blob URL) yet the pooled preview
 * video never became drawable — it was assigned `blobUrl + '#clip=<id>'`.
 * Local schemes now get the RAW URL; per-clip uniqueness for the src-dedupe
 * check is tracked on the element itself instead of inside the URL.
 */
export function mediaSrcFor(url: string, clipId: string): string {
  if (url.startsWith('blob:') || url.startsWith('data:')) return url;
  return url.includes('#') ? `${url}&clip=${clipId}` : `${url}#clip=${clipId}`;
}

type TaggedMediaElement = HTMLMediaElement & {
  _procutClipSrcTag?: string | null;
  _procutClipSrcBaseUrl?: string | null;
};

/**
 * Assign `el.src` for a clip only when it actually changed (tracked via an
 * element-level tag, NOT by comparing against the resolved `el.src` string).
 * Returns true when a new src was assigned — the caller should el.load().
 *
 * POST-SPLIT DECODER FIX: the tag embeds the clip's shareKey, which CHANGES the
 * moment a clip is first split (mediaId::clip:<id> → mediaId::<groupId>). Comparing
 * the full tag forced el.src reassignment + el.load() — a full decoder teardown,
 * reload and re-seek on every first split of a clip (paused preview went stale
 * until re-decode; playing preview froze via the buffering detector). When the
 * element is already decoding the SAME source URL, keep the live src and just
 * re-stamp the tag — the split boundary then costs a cheap seek at most.
 */
export function assignClipMediaSrc(
  el: TaggedMediaElement,
  clipId: string,
  url: string
): boolean {
  const src = mediaSrcFor(url, clipId);
  const tag = `${clipId}|${src}`;
  if (el._procutClipSrcTag === tag) return false;
  // Same source file already decoding (split shareKey change): don't restart
  // the decoder — only the tag is updated. (`el.src` keeps its old fragment,
  // which for remote URLs is cache-busting noise only.)
  if (el._procutClipSrcBaseUrl === url && el.getAttribute('src')) {
    el._procutClipSrcTag = tag;
    return false;
  }
  el._procutClipSrcTag = tag;
  el._procutClipSrcBaseUrl = url;
  el.src = src;
  return true;
}

/** Fully clears a pooled element's source AND its dedupe tag. */
export function clearClipMediaSrc(el: TaggedMediaElement): void {
  el._procutClipSrcTag = null;
  el._procutClipSrcBaseUrl = null;
  el.removeAttribute('src');
  try { el.load(); } catch { /* already detached */ }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function findClipById(clipId: string): { clip: any; track: any; absStartTime: number } | null {
  const state = useEditorStore.getState();
  const tracks = state.tracks;
  const pipWindows = state.pipWindows || {};
  for (const track of tracks) {
    const found = track.clips.find((c) => c.id === clipId);
    if (found) return { clip: found, track, absStartTime: found.startTime };
    for (const clip of track.clips) {
      const clipPips = Object.values(pipWindows).filter(p => p.parentClipId === clip.id);
      for (const pip of clipPips) {
        for (const pipTrack of pip.tracks) {
          const pipClip = pipTrack.clips.find(c => c.id === clipId);
          if (pipClip) {
            const absStartTime = clip.startTime + pip.relativeStartTime + pipClip.startTime;
            const mergedTrack = {
              ...pipTrack,
              muted: track.muted || pipTrack.muted || pipTrack.hidden
            };
            return { clip: pipClip, track: mergedTrack, absStartTime };
          }
        }
      }
    }
  }
  return null;
}

function cubicInterp(y0: number, y1: number, y2: number, y3: number, t: number): number {
  const a = -0.5 * y0 + 1.5 * y1 - 1.5 * y2 + 0.5 * y3;
  const b = y0 - 2.5 * y1 + 2.0 * y2 - 0.5 * y3;
  const c = -0.5 * y0 + 0.5 * y2;
  const d = y1;
  return ((a * t + b) * t + c) * t + d;
}

function getOrCreateTrackAnalyser(trackId: string, audioCtx: AudioContext): AnalyserNode {
  let analyser = trackAnalysers.get(trackId);
  if (!analyser) {
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 64;
    if (masterAnalyser) {
      analyser.connect(masterAnalyser);
    } else if (masterCompressor) {
      analyser.connect(masterCompressor);
    } else {
      analyser.connect(audioCtx.destination);
      if (masterAudioDestination) analyser.connect(masterAudioDestination);
    }
    trackAnalysers.set(trackId, analyser);
  }
  return analyser;
}

function connectAudioNode(entry: MediaElement) {
  if (entry._isGraphConnected) return;
  const audioCtx = getMasterAudioCtx();
  if (!audioCtx || !entry.gainNode) return;
  const foundNode = findClipById(entry.clipId);
  const track = foundNode ? foundNode.track : null;
  const trackAnalyser = track ? getOrCreateTrackAnalyser(track.id, audioCtx) : null;
  try {
    if (trackAnalyser) {
      entry.gainNode.connect(trackAnalyser);
    } else if (masterAnalyser) {
      entry.gainNode.connect(masterAnalyser);
    } else if (masterCompressor) {
      entry.gainNode.connect(masterCompressor);
    } else {
      entry.gainNode.connect(audioCtx.destination);
      if (masterAudioDestination) entry.gainNode.connect(masterAudioDestination);
    }
    entry._isGraphConnected = true;
  } catch (err) {
    console.warn('[Audio] Failed to connect node:', err);
  }
}

function disconnectAudioNode(entry: MediaElement) {
  if (!entry._isGraphConnected) return;
  try {
    if (entry.gainNode) entry.gainNode.disconnect();
    entry._isGraphConnected = false;
  } catch (err) {
    console.warn('[Audio] Failed to disconnect node:', err);
  }
}

// ---------------------------------------------------------------------------
// Audio Graph Builders
// ---------------------------------------------------------------------------
function createSeparationGraph(audioCtx: AudioContext): SeparationGraph {
  const input = audioCtx.createGain();
  const output = audioCtx.createGain();
  const bypassGain = audioCtx.createGain();
  input.connect(bypassGain);
  bypassGain.connect(output);

  const lowpass = audioCtx.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = 180;
  const lowGain = audioCtx.createGain();
  input.connect(lowpass);
  lowpass.connect(lowGain);
  lowGain.connect(output);

  const highpass = audioCtx.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.value = 6000;
  const highGain = audioCtx.createGain();
  input.connect(highpass);
  highpass.connect(highGain);
  highGain.connect(output);

  const midHP = audioCtx.createBiquadFilter();
  midHP.type = 'highpass';
  midHP.frequency.value = 180;
  const midLP = audioCtx.createBiquadFilter();
  midLP.type = 'lowpass';
  midLP.frequency.value = 6000;
  input.connect(midHP);
  midHP.connect(midLP);

  const splitter = audioCtx.createChannelSplitter(2);
  midLP.connect(splitter);

  const midSum = audioCtx.createGain();
  midSum.gain.value = 0.5;
  splitter.connect(midSum, 0);
  splitter.connect(midSum, 1);

  const midOutputGain = audioCtx.createGain();
  const midMerger = audioCtx.createChannelMerger(2);
  midSum.connect(midMerger, 0, 0);
  midSum.connect(midMerger, 0, 1);
  midMerger.connect(midOutputGain);
  midOutputGain.connect(output);

  const sideL_direct = audioCtx.createGain();
  sideL_direct.gain.value = 0.5;
  const sideL_inv = audioCtx.createGain();
  sideL_inv.gain.value = -0.5;
  const sideL_sum = audioCtx.createGain();
  splitter.connect(sideL_direct, 0);
  splitter.connect(sideL_inv, 1);
  sideL_direct.connect(sideL_sum);
  sideL_inv.connect(sideL_sum);

  const sideR_direct = audioCtx.createGain();
  sideR_direct.gain.value = 0.5;
  const sideR_inv = audioCtx.createGain();
  sideR_inv.gain.value = -0.5;
  const sideR_sum = audioCtx.createGain();
  splitter.connect(sideR_direct, 1);
  splitter.connect(sideR_inv, 0);
  sideR_direct.connect(sideR_sum);
  sideR_inv.connect(sideR_sum);

  const sideMerger = audioCtx.createChannelMerger(2);
  sideL_sum.connect(sideMerger, 0, 0);
  sideR_sum.connect(sideMerger, 0, 1);

  const sideGain = audioCtx.createGain();
  sideMerger.connect(sideGain);
  sideGain.connect(output);

  bypassGain.gain.value = 1.0;
  lowGain.gain.value = 0.0;
  highGain.gain.value = 0.0;
  midOutputGain.gain.value = 0.0;
  sideGain.gain.value = 0.0;

  return { input, output, lowGain, highGain, midOutputGain, sideGain, bypassGain };
}

function createPitchNode(audioCtx: AudioContext): ScriptProcessorNode {
  const bufferSize = 4096;
  const pitchNode = audioCtx.createScriptProcessor(bufferSize, 2, 2);
  (pitchNode as any).pitch = 0;
  (pitchNode as any).humanize = false;

  // ── Phase Vocoder Pitch Shift ──────────────────────────────────────────
  // Replaces the old granular time-stretcher with a proper Bernsee-style
  // phase vocoder that maintains phase coherence. This eliminates the
  // robotic / chorusy artifacts that plagued the granular approach.
  // Algorithm matches phaseVocoder.ts (used by export) so preview = export.
  const FFT_N = 2048;
  const HOP = FFT_N / 4; // 75% overlap — 4 grains summing to unity
  const HALF = FFT_N / 2;
  const omega = (2 * Math.PI * HOP) / FFT_N; // expected phase advance per bin per hop

  // Hann window scaled for 75% overlap-add (4 overlapping windows sum to 1.5)
  const win = new Float32Array(FFT_N);
  for (let i = 0; i < FFT_N; i++) {
    win[i] = (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (FFT_N - 1))) * (2 / 3);
  }

  // Per-channel state
  function makeChannelState() {
    return {
      inBuf: new Float32Array(FFT_N * 4),   // circular input buffer
      outBuf: new Float32Array(FFT_N * 4),   // overlap-add output buffer
      inPos: 0,
      outReadPos: 0,
      outWritePos: 0,
      lastPhase: new Float32Array(HALF + 1),
      sumPhase: new Float32Array(HALF + 1),
      hopAccum: 0, // fractional hop accumulator
    };
  }
  const stateL = makeChannelState();
  const stateR = makeChannelState();

  // Inline radix-2 FFT (same as phaseVocoder.ts)
  function fftInPlace(re: Float32Array, im: Float32Array): void {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) {
        let t = re[i]; re[i] = re[j]; re[j] = t;
        t = im[i]; im[i] = im[j]; im[j] = t;
      }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = (-2 * Math.PI) / len;
      const wRe = Math.cos(ang);
      const wIm = Math.sin(ang);
      for (let i = 0; i < n; i += len) {
        let curRe = 1, curIm = 0;
        const half = len >> 1;
        for (let j = 0; j < half; j++) {
          const uRe = re[i + j], uIm = im[i + j];
          const vRe = re[i + j + half] * curRe - im[i + j + half] * curIm;
          const vIm = re[i + j + half] * curIm + im[i + j + half] * curRe;
          re[i + j] = uRe + vRe;   im[i + j] = uIm + vIm;
          re[i + j + half] = uRe - vRe; im[i + j + half] = uIm - vIm;
          const nextRe = curRe * wRe - curIm * wIm;
          curIm = curRe * wIm + curIm * wRe;
          curRe = nextRe;
        }
      }
    }
  }

  function princArg(x: number): number {
    while (x > Math.PI) x -= 2 * Math.PI;
    while (x < -Math.PI) x += 2 * Math.PI;
    return x;
  }

  // Shared FFT scratch buffers (allocated once, reused every hop)
  const fftRe = new Float32Array(FFT_N);
  const fftIm = new Float32Array(FFT_N);
  const mag = new Float32Array(HALF + 1);
  const instFreq = new Float32Array(HALF + 1);
  const phase = new Float32Array(HALF + 1);

  function processHop(
    st: ReturnType<typeof makeChannelState>,
    ratio: number,
    inputSamples: Float32Array,
    inputOffset: number
  ): void {
    const inBuf = st.inBuf;
    const inLen = inBuf.length;

    // Write HOP new input samples into the circular buffer
    for (let i = 0; i < HOP; i++) {
      inBuf[(st.inPos + i) % inLen] = inputSamples[inputOffset + i];
    }

    // ── Analysis: window FFT_N samples ending at inPos + HOP ──
    const frameStart = ((st.inPos + HOP - FFT_N) + inLen * 2) % inLen;
    for (let i = 0; i < FFT_N; i++) {
      fftRe[i] = inBuf[(frameStart + i) % inLen] * win[i];
      fftIm[i] = 0;
    }
    fftInPlace(fftRe, fftIm);

    // Extract magnitude + instantaneous frequency via phase unwrapping
    for (let k = 0; k <= HALF; k++) {
      mag[k] = Math.hypot(fftRe[k], fftIm[k]);
      phase[k] = Math.atan2(fftIm[k], fftRe[k]);
      const advance = princArg(phase[k] - st.lastPhase[k] - k * omega) / HOP;
      instFreq[k] = k * ((2 * Math.PI) / FFT_N) + advance;
      st.lastPhase[k] = phase[k];
    }

    // ── Pitch shift: bin k ← bin k/ratio ──
    for (let k = 0; k <= HALF; k++) {
      const src = k / ratio;
      if (src > HALF) { fftRe[k] = 0; fftIm[k] = 0; continue; }
      const i0 = Math.floor(src);
      const frac = src - i0;
      const i1 = Math.min(HALF, i0 + 1);
      const m = mag[i0] + (mag[i1] - mag[i0]) * frac;
      const f = instFreq[i0] + (instFreq[i1] - instFreq[i0]) * frac;
      st.sumPhase[k] += f * ratio * HOP;
      fftRe[k] = m * Math.cos(st.sumPhase[k]);
      fftIm[k] = m * Math.sin(st.sumPhase[k]);
    }
    // Hermitian symmetry
    for (let k = 1; k < HALF; k++) {
      fftRe[FFT_N - k] = fftRe[k];
      fftIm[FFT_N - k] = -fftIm[k];
    }
    fftRe[HALF] = 0; fftIm[HALF] = 0;

    // ── Inverse FFT via conjugate trick ──
    for (let i = 0; i < FFT_N; i++) fftIm[i] = -fftIm[i];
    fftInPlace(fftRe, fftIm);
    const inv = 1 / FFT_N;

    // ── Overlap-add into output buffer ──
    const outLen = st.outBuf.length;
    for (let i = 0; i < FFT_N; i++) {
      st.outBuf[(st.outWritePos + i) % outLen] += fftRe[i] * inv;
    }

    st.inPos = (st.inPos + HOP) % inLen;
    st.outWritePos = (st.outWritePos + HOP) % outLen;
  }

  pitchNode.onaudioprocess = (e) => {
    const inputL = e.inputBuffer.getChannelData(0);
    const inputR = e.inputBuffer.getChannelData(1);
    const outputL = e.outputBuffer.getChannelData(0);
    const outputR = e.outputBuffer.getChannelData(1);

    const pitchSt = (pitchNode as any).pitch || 0;
    const isHumanize = (pitchNode as any).humanize || false;
    let jitter = 0;
    if (isHumanize) {
      const time = e.playbackTime || (Date.now() / 1000);
      jitter = Math.sin(time * 2 * Math.PI * 5.5) * 0.06;
    }

    const semitones = pitchSt + jitter;
    if (Math.abs(semitones) < 0.01) {
      outputL.set(inputL);
      outputR.set(inputR);
      return;
    }

    const ratio = Math.pow(2, semitones / 12);
    const samplesPerBlock = inputL.length;

    // Process in HOP-sized chunks
    for (let offset = 0; offset + HOP <= samplesPerBlock; offset += HOP) {
      processHop(stateL, ratio, inputL, offset);
      processHop(stateR, ratio, inputR, offset);
    }

    // Read HOP * (samplesPerBlock/HOP) output samples
    const outLen = stateL.outBuf.length;
    for (let i = 0; i < samplesPerBlock; i++) {
      const posL = (stateL.outReadPos + i) % outLen;
      const posR = (stateR.outReadPos + i) % outLen;
      outputL[i] = stateL.outBuf[posL];
      outputR[i] = stateR.outBuf[posR];
      // Clear after reading for next overlap-add cycle
      stateL.outBuf[posL] = 0;
      stateR.outBuf[posR] = 0;
    }
    stateL.outReadPos = (stateL.outReadPos + samplesPerBlock) % outLen;
    stateR.outReadPos = (stateR.outReadPos + samplesPerBlock) % outLen;
  };
  return pitchNode;
}

function initAudioGraph(entry: MediaElement) {
  const audioCtx = getMasterAudioCtx();
  if (!audioCtx) return;
  try {
    const sourceNode = audioCtx.createMediaElementSource(entry.el);

    const vocalFilterF1 = audioCtx.createBiquadFilter();
    vocalFilterF1.type = 'peaking';
    vocalFilterF1.frequency.value = 500;  // F1 formant — vowel openness
    vocalFilterF1.Q.value = 1.2;
    vocalFilterF1.gain.value = 0;

    const vocalFilter = audioCtx.createBiquadFilter();
    vocalFilter.type = 'peaking';
    vocalFilter.frequency.value = 1500;   // F2 formant — vowel frontness
    vocalFilter.Q.value = 1.0;
    vocalFilter.gain.value = 0;

    const vocalFilterF3 = audioCtx.createBiquadFilter();
    vocalFilterF3.type = 'peaking';
    vocalFilterF3.frequency.value = 2500; // F3 formant — vocal timbre
    vocalFilterF3.Q.value = 1.2;
    vocalFilterF3.gain.value = 0;

    const denoiseFilter = audioCtx.createBiquadFilter();
    denoiseFilter.type = 'highshelf';
    denoiseFilter.frequency.value = 4000;
    denoiseFilter.gain.value = 0;

    const bassFilter = audioCtx.createBiquadFilter();
    bassFilter.type = 'lowshelf';
    bassFilter.frequency.value = 200;
    bassFilter.gain.value = 0;

    const trebleFilter = audioCtx.createBiquadFilter();
    trebleFilter.type = 'highshelf';
    trebleFilter.frequency.value = 3000;
    trebleFilter.gain.value = 0;

    const midFilter = audioCtx.createBiquadFilter();
    midFilter.type = 'peaking';
    midFilter.frequency.value = 1000;
    midFilter.Q.value = 1.0;
    midFilter.gain.value = 0;

    const compressorNode = audioCtx.createDynamicsCompressor();
    compressorNode.threshold.value = 0;
    compressorNode.knee.value = 40;
    compressorNode.ratio.value = 1;
    compressorNode.attack.value = 0.003;
    compressorNode.release.value = 0.25;

    const deEsserFilter = audioCtx.createBiquadFilter();
    deEsserFilter.type = 'peaking';
    deEsserFilter.frequency.value = 7000;
    deEsserFilter.Q.value = 2.0;
    deEsserFilter.gain.value = 0;

    const warmthFilter = audioCtx.createBiquadFilter();
    warmthFilter.type = 'lowshelf';
    warmthFilter.frequency.value = 250;
    warmthFilter.gain.value = 0;

    const feedbackInputGain = audioCtx.createGain();
    feedbackInputGain.gain.value = 0.0;

    const delayNode = audioCtx.createDelay(1.0);
    delayNode.delayTime.value = 0.022;

    const delayGain = audioCtx.createGain();
    delayGain.gain.value = 0.0;

    const feedbackNode = audioCtx.createGain();
    feedbackNode.gain.value = 0.15;

    const pannerNode = audioCtx.createStereoPanner ? audioCtx.createStereoPanner() : undefined;
    const gainNode = audioCtx.createGain();

    const separationGraph = createSeparationGraph(audioCtx);
    sourceNode.connect(separationGraph.input);
    separationGraph.output.connect(vocalFilterF1);
    vocalFilterF1.connect(vocalFilter);
    vocalFilter.connect(vocalFilterF3);
    vocalFilterF3.connect(denoiseFilter);
    denoiseFilter.connect(bassFilter);
    bassFilter.connect(midFilter);
    midFilter.connect(trebleFilter);
    trebleFilter.connect(compressorNode);
    compressorNode.connect(deEsserFilter);
    deEsserFilter.connect(warmthFilter);

    warmthFilter.connect(feedbackInputGain);
    feedbackInputGain.connect(delayNode);
    delayNode.connect(delayGain);
    delayNode.connect(feedbackNode);
    feedbackNode.connect(delayNode);

    // Reverb & Acoustic Environment DSP Path
    const reverbDryGain = audioCtx.createGain();
    reverbDryGain.gain.value = 1.0;

    const reverbWetGain = audioCtx.createGain();
    reverbWetGain.gain.value = 0.0;

    const convolverNode = audioCtx.createConvolver();
    const reverbPreFilter = audioCtx.createBiquadFilter();
    reverbPreFilter.type = 'allpass';

    warmthFilter.connect(reverbDryGain);
    warmthFilter.connect(reverbPreFilter);
    reverbPreFilter.connect(convolverNode);
    convolverNode.connect(reverbWetGain);

    if (pannerNode) {
      reverbDryGain.connect(pannerNode);
      reverbWetGain.connect(pannerNode);
      delayGain.connect(pannerNode);
      pannerNode.connect(gainNode);
    } else {
      reverbDryGain.connect(gainNode);
      reverbWetGain.connect(gainNode);
      delayGain.connect(gainNode);
    }

    entry.reverbDryGain = reverbDryGain;
    entry.reverbWetGain = reverbWetGain;
    entry.convolverNode = convolverNode;
    entry.reverbPreFilter = reverbPreFilter;

    entry.audioCtx = audioCtx;
    entry.sourceNode = sourceNode;
    entry.vocalFilter = vocalFilter;
    entry.vocalFilterF1 = vocalFilterF1;
    entry.vocalFilterF3 = vocalFilterF3;
    entry.denoiseFilter = denoiseFilter;
    entry.bassFilter = bassFilter;
    entry.midFilter = midFilter;
    entry.trebleFilter = trebleFilter;
    entry.compressorNode = compressorNode;
    entry.deEsserFilter = deEsserFilter;
    entry.warmthFilter = warmthFilter;
    entry.delayNode = delayNode;
    entry.delayGain = delayGain;
    entry.feedbackInputGain = feedbackInputGain;
    entry.feedbackNode = feedbackNode;
    entry.pannerNode = pannerNode;
    entry.gainNode = gainNode;
    entry.separationGraph = separationGraph;
    entry._fxConnected = false;
  } catch (err) {
    console.warn('Unable to initialize Web Audio routing:', err);
  }
}

// ---------------------------------------------------------------------------
// Main Hook
// ---------------------------------------------------------------------------
export function useMediaPlayback(isController: boolean = true): MediaPlaybackResult {
  const poolRef = useRef<Map<string, MediaElement>>(globalMediaPool);
  const videoMapRef = useRef<Map<string, HTMLVideoElement>>(globalVideoMap);
  const resultRef = useRef<MediaPlaybackResult>(globalPlaybackResult);

  const [instanceId] = useState(() => nextControllerId++);

  // CONCURRENT-MODE FIX (root cause of "Android shows POOL EMPTY / black
  // preview"): controller registration used to happen here as a RENDER-phase
  // side effect (mutating module-level sets inside the component body). Under
  // React 18 concurrent rendering a pass can be discarded without committing —
  // exactly what happens around the MOBILE app's React.lazy/<Suspense> boundary
  // wrapping the PreviewCanvas (desktop mounts it eagerly, which is why PC —
  // including responsive emulation — never reproduced this). A discarded pass
  // still incremented nextControllerId and add()'ed a phantom instance into
  // activeControllers, potentially claiming primaryControllerId — after which
  // the real committed instance computed isPrimary=false FOREVER, every pooled
  // effect early-returned, and no <video>/<audio> element was ever created.
  //
  // Registration now happens in an effect (committed instances only), and
  // primacy is read through useSyncExternalStore — the canonical API for
  // external stores — so every mounted instance re-evaluates primacy whenever
  // the registry changes (first-registration, primary unmount, etc.).
  const isPrimary = useSyncExternalStore(
    (onChange) => {
      if (!isController) return () => {};
      controllerListeners.add(onChange);
      return () => {
        controllerListeners.delete(onChange);
      };
    },
    () => isController && primaryControllerId === instanceId,
    () => false
  );

  useEffect(() => {
    if (!isController) return;
    registerControllerInstance(instanceId);
    return () => {
      unregisterControllerInstance(instanceId);
    };
  }, [isController, instanceId]);

  const tracks = useEditorStore((s) => s.tracks);
  const mediaLibrary = useEditorStore((s) => s.mediaLibrary);
  const isPlaying = useEditorStore((s) => s.isPlaying);
  const volume = useEditorStore((s) => s.volume);
  const isMuted = useEditorStore((s) => s.isMuted);
  const muteTimelineAudio = useEditorStore((s) => s.muteTimelineAudio);
  const playbackSpeed = useEditorStore((s) => s.playbackSpeed);
  const isExporting = useEditorStore((s) => s.isExporting);
  const previewSuspended = useSyncExternalStore(subscribePreviewSuspension, isPreviewSuspendedForExport, () => false);

  // PERF (playback stutter fix): this hook is mounted by BOTH PreviewCanvasContainer
  // and PropertiesPanel. Previously it selected `s.currentTime` directly, so every
  // one of the ~33 store writes per second the playback loop performs re-rendered
  // both of those very large component trees (PropertiesPanel alone is ~7k lines).
  // That React work competes with canvas compositing on the same main thread and is
  // the primary cause of the intermittent lag when several tracks are loaded.
  //
  // Pool residency and proximity loading only need a coarse position, so we
  // subscribe to a quantised bucket instead: 1 s steps while playing, 0.25 s steps
  // while paused/scrubbing — identical semantics to the previous `ctBucket`, but it
  // only triggers a render when the bucket actually changes (~1×/s instead of 33×/s).
  const ctBucket = useTimeBucket(1, 0.25);

  // Fast jump / seek trigger for immediate pool residency and proximity preloading
  const [seekRevision, setSeekRevision] = useState(0);
  useEffect(() => {
    let lastTime = getPlaybackTime();
    const unsub = subscribePlaybackTime((t) => {
      if (Math.abs(t - lastTime) > 0.3) {
        setSeekRevision((r) => r + 1);
      }
      lastTime = t;
    });
    const unsubTrim = subscribeTrimPreviewTime(() => {
      setSeekRevision((r) => r + 1);
    });
    const onFrameUpdate = () => setSeekRevision((r) => r + 1);
    window.addEventListener('procut-frame-updated', onFrameUpdate);
    return () => {
      unsub();
      unsubTrim();
      window.removeEventListener('procut-frame-updated', onFrameUpdate);
    };
  }, []);

  // Throttled time for the reactive audio-parameter effect (see below). Exact values
  // are always read via useEditorStore.getState() inside the effect body.
  const audioParamTime = usePlaybackTime(25);

  const pendingSeeksRef = useRef<Map<string, number>>(new Map());
  const seekStartTimeRef = useRef<Map<string, number>>(new Map());
  const lastActiveClipIdsRef = useRef<Set<string>>(new Set());
  const sortedTracksRef = useRef<any[]>([]);
  const mediaMapRef = useRef<Map<string, any>>(new Map());
  const rafIdRef = useRef<number | null>(null);
  const lastSyncTimeRef = useRef<number>(0);
  // PERF: Cache getActiveClips() result — only recompute on track change or clip boundary crossing.
  const cachedActiveClipsRef = useRef<ActiveClipInfo[]>([]);
  const nextClipBoundaryRef = useRef<number>(0); // recompute when ct crosses this
  const lastCachedStoreTracksRef = useRef<any>(null);
  // BUG FIX: Track previous ct to detect time-went-backward (loop/seek to start).
  // Without this, after looping from t=30→t=0, the cache still served clips from t=30
  // because 0 < nextClipBoundaryRef (e.g. 5s), so no recompute fired.
  const prevSyncCtRef = useRef<number>(-1);
  // PERF: Persistent Set reused every frame to avoid 2 heap allocations/frame (Array + Set).
  const playingIdsSetRef = useRef<Set<string>>(new Set());
  // PERF (multi-split fix): the last boundary we pre-rolled a decoder for, so
  // the warm-up seek runs once per split crossing instead of every sync tick.
  const preRolledBoundaryRef = useRef<number | null>(null);
  const triggeredTransitionsRef = useRef<Set<string>>(new Set());
  const prevPlayingRef = useRef<boolean>(false);

  // Worker export uses independent decoders. A paused <video> still owns a
  // decoder and decoded surfaces, so pause() alone is not sufficient after a
  // Speed Frame drag. Unload each shared element exactly once and clear any
  // queued edit-time seeks BEFORE the export worker opens its own media.
  useEffect(() => {
    if (!isPrimary) return;
    const onSuspensionChange = () => {
      pendingSeeksRef.current.clear();
      seekStartTimeRef.current.clear();
      lastActiveClipIdsRef.current.clear();
      nextClipBoundaryRef.current = 0;
      prevSyncCtRef.current = -1;
      if (!isPreviewSuspendedForExport()) return;

      const unloaded = new Set<HTMLMediaElement>();
      for (const entry of poolRef.current.values()) {
        disconnectAudioNode(entry);
        if (unloaded.has(entry.el)) continue;
        unloaded.add(entry.el);
        entry.el.pause();
        clearClipMediaSrc(entry.el as TaggedMediaElement);
      }
    };
    const unsubscribe = subscribePreviewSuspension(onSuspensionChange);
    if (isPreviewSuspendedForExport()) onSuspensionChange();
    return unsubscribe;
  }, [isPrimary]);

  // ---- Cache sorted tracks & media map ----
  useEffect(() => {
    const sorted = tracks.map(t => ({
      ...t,
      clips: [...t.clips].sort((a: any, b: any) => a.startTime - b.startTime)
    }));
    sortedTracksRef.current = sorted;

    const map = new Map<string, any>();
    for (const m of mediaLibrary) map.set(m.id, m);
    mediaMapRef.current = map;
  }, [tracks, mediaLibrary]);

  const triggerRedraw = useCallback(() => {
    window.dispatchEvent(new CustomEvent('procut-frame-updated'));
  }, []);

  // ANDROID RENDERING FIX: the pool container (and every video inside it) must
  // NOT be fully invisible — Chrome on Android never composites opacity:0 /
  // zero-size media elements, so their decoded frames never reach drawImage()
  // (black preview on real phones only; desktop, incl. responsive-mode
  // emulation, is unaffected). getMediaPoolContainer implements the standard
  // "painted but invisible" 2×2px / opacity-0.01 pattern; it is module-level
  // and idempotent. See utils/mediaPoolContainer.ts.

  // ---- Eager master audio context init ----
  if (typeof window !== 'undefined') {
    getMasterAudioCtx();
    if (masterAudioDestination) {
      const store = useEditorStore.getState();
      if (!store.masterAudioStream && masterAudioDestination.stream) {
        store.setMasterAudioStream(masterAudioDestination.stream);
      }
    }
  }

  useEffect(() => {
    if (!isPrimary) return;
    getMasterAudioCtx();
    if (masterAudioDestination) {
      useEditorStore.getState().setMasterAudioStream(masterAudioDestination.stream);
    }
  }, [isPrimary]);

  // ---- Build active clips (with PIP & transitions) ----
  const getActiveClips = useCallback((): ActiveClipInfo[] => {
    // Exact playhead — this decides clip activation/deactivation, so a stale value
    // here delays hard-seeks at clip boundaries and shows the wrong frame.
    // When trimming, use the trim preview position to evaluate active clips.
    const ct = getEffectivePreviewTime();
    const result: ActiveClipInfo[] = [];
    const added = new Set<string>();
    const pipWindows = useEditorStore.getState().pipWindows || {};

    // SPEED FRAME FIX: precompute parentClipId → pips once per call. The old
    // `Object.values(pipWindows).filter(...)` ran PER CLIP — O(clips × pips) —
    // and getActiveClips re-runs on EVERY boundary crossing, which happens at
    // every speed-frame boundary: on a long split clip with speed frames each
    // crossing paid thousands of object visits, compounding the preview stall.
    const pipsByParent = new Map<string, any[]>();
    for (const p of Object.values(pipWindows)) {
      const parent = (p as any).parentClipId;
      if (!parent) continue;
      const arr = pipsByParent.get(parent);
      if (arr) arr.push(p);
      else pipsByParent.set(parent, [p]);
    }

    const addIfNew = (clip: any, track: any, absStartTime: number) => {
      if (added.has(clip.id)) return;
      added.add(clip.id);
      result.push({
        clipId: clip.id,
        mediaId: clip.mediaId,
        clipStart: absStartTime,
        clipDuration: clip.duration,
        trimStart: clip.trimStart ?? 0,
        trackMuted: track.muted,
        trackType: track.type,
        speed: clip.speed ?? 1,
        speedRamp: clip.speedRamp,
        speedFrames: clip.speedFrames,
        speedFrameSourceEnd: clip.speedFrameSourceEnd,
        isReversed: clip.isReversed,
        freezeFrame: clip.freezeFrame,
        absStartTime,
        trackId: track.id,
        trackVolume: track.volume ?? 1,
        trackPan: track.pan ?? 0,
        trackSolo: track.solo ?? false,
        clip,
      });
    };

    for (const track of sortedTracksRef.current) {
      if (track.hidden) continue;
      for (let idx = 0; idx < track.clips.length; idx++) {
        const clip = track.clips[idx];
        const isActive = ct >= clip.startTime && ct < clip.startTime + clip.duration;
        if (isActive) addIfNew(clip, track, clip.startTime);

        // PIP
        const clipPips = pipsByParent.get(clip.id);
        if (clipPips) {
          for (const pip of clipPips) {
            const pipAbsStart = clip.startTime + pip.relativeStartTime;
            if (ct >= pipAbsStart && ct < pipAbsStart + pip.duration) {
              for (const pipTrack of pip.tracks) {
                for (const pipClip of pipTrack.clips) {
                  const ptAbsStart = pipAbsStart + pipClip.startTime;
                  if (ct >= ptAbsStart && ct < ptAbsStart + pipClip.duration) {
                    const mergedTrack = { ...pipTrack, muted: track.muted || pipTrack.muted || pipTrack.hidden };
                    addIfNew(pipClip, mergedTrack, ptAbsStart);
                  }
                }
              }
            }
          }
        }

      }

      // Transitions: keep BOTH clips of an active transition alive so the
      // outgoing clip's video element continues decoding and its audio keeps
      // playing while it fades out. Delegated to the shared transition engine so
      // the window maths can never drift from what the renderer composites — a
      // mismatch here shows up as the outgoing clip freezing or going silent
      // partway through the blend.
      const activeTransition = findActiveTransition(track.clips, ct);
      if (activeTransition) {
        if (activeTransition.from) addIfNew(activeTransition.from, track, activeTransition.from.startTime);
        if (activeTransition.to) addIfNew(activeTransition.to, track, activeTransition.to.startTime);
      }
    }
    return result;
  }, []);

  // ---- Pool management (create/remove elements) ----
  const VIDEO_PROXIMITY_WINDOW = 2.5;
  const AUDIO_PROXIMITY_WINDOW = 15;
  const MAX_GLOBAL_FRAME_CACHE = 30;

  useEffect(() => {
    if (!isPrimary || isPreviewSuspendedForExport()) return;
    const ct = getPlaybackTime();
    const trimCt = getTrimPreviewTime();
    const neededClips = new Map<string, { mediaId: string; type: 'video' | 'audio'; shareKey: string; start: number; end: number }>();
    const pipWindows = useEditorStore.getState().pipWindows || {};

    // Synchronize sortedTracksRef directly from tracks so newly added tracks or split clips are reflected immediately
    sortedTracksRef.current = (tracks || []).map((t: any) => ({
      ...t,
      clips: [...(t.clips || [])].sort((a: any, b: any) => a.startTime - b.startTime),
    }));

    for (const track of sortedTracksRef.current) {
      if (track.hidden) continue;
      for (const clip of track.clips) {
        const media = mediaMapRef.current.get(clip.mediaId);
        if (media && media.url && (media.type === 'video' || media.type === 'audio')) {
          const prox = media.type === 'video' ? VIDEO_PROXIMITY_WINDOW : AUDIO_PROXIMITY_WINDOW;
          const isNearPrimary = ct >= clip.startTime - prox && ct < clip.startTime + clip.duration + prox;
          const isNearTrim = trimCt !== null && trimCt >= clip.startTime - prox && trimCt < clip.startTime + clip.duration + prox;
          if (isNearPrimary || isNearTrim) {
                        neededClips.set(clip.id, {
              mediaId: clip.mediaId,
              type: media.type,
              // Track-based element sharing: All clips of the same media on the SAME track
              // share one <video> element because only one clip per track can be active at any instant.
              // Different tracks (e.g. V1 A-roll and V2 B-roll) each get their own dedicated element.
              shareKey: `${clip.mediaId}::track:${track.id}::slot:0`,
              start: clip.startTime,
              end: clip.startTime + clip.duration,
            });
          }
        }
        const clipPips = Object.values(pipWindows).filter((p: any) => p.parentClipId === clip.id);
        for (const pip of clipPips) {
          for (const pipTrack of pip.tracks) {
            for (const pipClip of pipTrack.clips) {
              const pipMedia = mediaMapRef.current.get(pipClip.mediaId);
              if (pipMedia && pipMedia.url && (pipMedia.type === 'video' || pipMedia.type === 'audio')) {
                const absStart = clip.startTime + pip.relativeStartTime + pipClip.startTime;
                const prox = pipMedia.type === 'video' ? VIDEO_PROXIMITY_WINDOW : AUDIO_PROXIMITY_WINDOW;
                const isNearPrimaryPip = ct >= absStart - prox && ct < absStart + pipClip.duration + prox;
                const isNearTrimPip = trimCt !== null && trimCt >= absStart - prox && trimCt < absStart + pipClip.duration + prox;
                if (isNearPrimaryPip || isNearTrimPip) {
                  neededClips.set(pipClip.id, {
                    mediaId: pipClip.mediaId,
                    type: pipMedia.type,
                    // PiP clips never share elements — a PiP window can be open
                    // while the parent clip is also on screen.
                    shareKey: `${pipClip.mediaId}::clip:${pipClip.id}`,
                    start: absStart,
                    end: absStart + pipClip.duration,
                  });
                }
              }
            }
          }
        }
      }
    }

    // ── SEQUENTIAL SPLIT GROUP SHARING ────────────────────────────────
    // Split segments of the same source media share a single <video> element
    // across contiguous cuts without transitions. If segments have a timeline gap,
    // a media source discontinuity, an active transition, or overlap, they MUST
    // receive dedicated elements so pre-roll and independent rendering work cleanly.
    {
      const splitGroups = new Map<string, { clipId: string; start: number; end: number; clip: any }[]>();
      for (const [clipId, info] of neededClips) {
        if (!info.shareKey.includes('::clip:')) {
          let group = splitGroups.get(info.shareKey);
          if (!group) { group = []; splitGroups.set(info.shareKey, group); }
          let foundClip: any;
          for (const t of sortedTracksRef.current) {
            foundClip = t.clips.find((c: any) => c.id === clipId);
            if (foundClip) break;
          }
          if (foundClip) {
            group.push({ clipId, start: info.start, end: info.end, clip: foundClip });
          }
        }
      }
      for (const [, members] of splitGroups) {
        if (members.length < 2) continue;
        members.sort((a, b) => a.start - b.start);

        let currentChain = [members[0]];
        const chains: typeof members[] = [];

        for (let i = 1; i < members.length; i++) {
          const prev = members[i - 1];
          const curr = members[i];
          const hasOverlap = curr.start < prev.end - 0.001;
          const isAdjacent = Math.abs(curr.start - prev.end) < 0.05;
          const isContiguous = Math.abs(curr.clip.trimStart - getClipSourceEnd(prev.clip)) < 0.05;
          const hasTransition = Boolean(prev.clip.transitionOut || curr.clip.transitionIn);

          if (!hasOverlap && isAdjacent && isContiguous && !hasTransition) {
            currentChain.push(curr);
          } else {
            chains.push(currentChain);
            currentChain = [curr];
          }
        }
        chains.push(currentChain);

                chains.forEach((chain, chainIdx) => {
          // PING-PONG DUAL BUFFER: Alternate contiguous chains between slot:0 and slot:1.
          // This gives non-contiguous cuts and edits a dedicated idle element for 1.5s pre-roll
          // while strictly bounding the decoder count to max 2 elements per track.
          const slot = chainIdx % 2;
          for (const m of chain) {
            const info = neededClips.get(m.clipId);
            if (info) {
              const trackId = m.clip.trackId || (m as any).trackId || 'v';
              info.shareKey = `${info.mediaId}::track:${trackId}::slot:${slot}`;
            }
          }
        });
      }
    }

    // ── HARD DECODER POOL CEILING (MAX 4 VIDEO ELEMENTS) ─────────────
    // Chromium has a hard cap of 16 hardware video decoders across the whole browser.
    // Capping our pool strictly to 4 video elements guarantees we never exhaust hardware
    // decoders or crash the GPU process on multi-split/transition/speed-frame timelines.
    const MAX_VIDEO_ELEMENTS = isAndroidDevice() || isIOSDevice() ? 4 : 8;
    {
      const videoKeyDistances = new Map<string, number>();
      for (const [, info] of neededClips) {
        if (info.type !== 'video') continue;
        const isUnderPlayhead = ct >= info.start - 0.05 && ct <= info.end + 0.05;
        const dist = isUnderPlayhead ? 0 : Math.abs(ct - info.start);
        const curr = videoKeyDistances.get(info.shareKey);
        if (curr === undefined || dist < curr) {
          videoKeyDistances.set(info.shareKey, dist);
        }
      }
      if (videoKeyDistances.size > MAX_VIDEO_ELEMENTS) {
        const sorted = Array.from(videoKeyDistances.entries()).sort((a, b) => a[1] - b[1]);
        const allowedKeys = new Set(sorted.slice(0, MAX_VIDEO_ELEMENTS).map((e) => e[0]));
        for (const [clipId, info] of Array.from(neededClips.entries())) {
          if (info.type === 'video' && !allowedKeys.has(info.shareKey)) {
            neededClips.delete(clipId);
          }
        }
      }
    }

    const pool = poolRef.current;
    const videoMap = videoMapRef.current;

    // ── PRE-PASS: RECONCILE EXISTING POOL ENTRIES ────────────────────
    // If a clip already in the pool had its shareKey change (e.g. it was split
    // and received a splitGroupId, or a gap was created and it became dedicated),
    // migrate its video element in mediaVideoEls and update its stored shareKey
    // BEFORE allocating new elements. Also ensure videoMap is populated.
    for (const [clipId, info] of neededClips) {
      const existing = pool.get(clipId);
      if (existing && existing.type === 'video') {
        const oldKey = existing._shareKey;
        const newKey = info.shareKey;
        if (oldKey && oldKey !== newKey) {
          const el = existing.el as HTMLVideoElement;
          const oldCount = mediaVideoRefCount.get(oldKey) ?? 1;
          if (oldCount <= 1) {
            mediaVideoRefCount.delete(oldKey);
            mediaVideoEls.delete(oldKey);
          } else {
            mediaVideoRefCount.set(oldKey, oldCount - 1);
          }
          if (!mediaVideoEls.has(newKey)) {
            mediaVideoEls.set(newKey, el);
          }
          mediaVideoRefCount.set(newKey, (mediaVideoRefCount.get(newKey) ?? 0) + 1);
          existing._shareKey = newKey;
        }
        existing._shareStart = info.start;
        existing._shareEnd = info.end;
        videoMap.set(clipId, existing.el as HTMLVideoElement);
      }
    }

    for (const [clipId, info] of neededClips) {
      const media = mediaMapRef.current.get(info.mediaId);
      if (!media || !media.url) continue;
      const existing = pool.get(clipId);
      if (existing) {
        if (existing.type === 'audio' && media.url !== 'PENDING_RESTORE') {
          if (assignClipMediaSrc(existing.el as TaggedMediaElement, clipId, media.url)) {
            existing.el.load();
          }
        }
        continue;
      }

          if (info.type === 'video') {
            // ── SHARED ELEMENT: one <video> per SPLIT CHAIN ────────────────
            // Split segments of one original clip reference the same media and
            // never overlap in time. Reuse a single element per split chain so
            // crossing a split boundary is a cheap seek on the SAME element
            // instead of tearing down one element's src and el.load()'ing a
            // fresh decoder on the next segment (which stuttered the preview
            // on heavily-split clips). Refcounted: the element is destroyed
            // only when the last referencing clip leaves the pool.
            // Duplicates / same media on two tracks get their own element
            // (shareKey contains the clip id) so overlapping instances of the
            // same file never fight over one element's currentTime.
            let key = info.shareKey;
            // If the user manually moved a split segment to OVERLAP a sibling,
            // sharing would break both — detect the overlap and give this clip
            // a dedicated element.
            if (!key.includes('::clip:')) {
              for (const [, e] of pool) {
                if (e.type !== 'video' || e._shareKey !== key) continue;
                if (info.start < (e._shareEnd ?? 0) - 0.001 && info.end > (e._shareStart ?? 0) + 0.001) {
                  key = `${info.shareKey}::clip:${clipId}`;
                  break;
                }
              }
            }
            let el = mediaVideoEls.get(key) || null;
            // Sibling lookup: if mediaVideoEls doesn't have an element under key yet,
            // check if any existing video entry in pool matches info.mediaId with the
            // same split group or share key, and reuse its ready element immediately.
            if (!el && !key.includes('::clip:')) {
              for (const [, e] of pool) {
                if (e.type === 'video' && e.mediaId === info.mediaId && e.el && (e.el as HTMLVideoElement).readyState >= 1) {
                  if (e._shareKey === key) {
                    el = e.el as HTMLVideoElement;
                    mediaVideoEls.set(key, el);
                    break;
                  }
                }
              }
            }
            // FIX 1 (Graceful ShareKey Transition): When a split chain breaks
            // (clip moved/gapped), the clip gets a dedicated shareKey (::clip:).
            // Instead of creating a brand new <video> element (destroying the old
            // decoder → 200-800ms black frame), reuse any ready element from the
            // SAME mediaId that is being evicted from the pool in this reconcile
            // pass. The element already has the correct src loaded — only a cheap
            // seek is needed, NOT a full decoder restart.
            if (!el) {
              for (const [evictId, e] of pool) {
                if (e.type !== 'video' || e.mediaId !== info.mediaId) continue;
                if (neededClips.has(evictId)) continue; // still needed by another clip
                const evEl = e.el as HTMLVideoElement;
                if (evEl.readyState >= 1) {
                  el = evEl;
                  // Migrate the element to the new key
                  const oldKey = e._shareKey ?? e.mediaId;
                  const oldRc = mediaVideoRefCount.get(oldKey) ?? 1;
                  if (oldRc <= 1) {
                    mediaVideoRefCount.delete(oldKey);
                    mediaVideoEls.delete(oldKey);
                  } else {
                    mediaVideoRefCount.set(oldKey, oldRc - 1);
                  }
                  e._shareKey = key;
                  e._migrated = true;
                  mediaVideoEls.set(key, el);
                  break;
                }
              }
            }
            const elIsNew = !el;
            if (!el) {
              el = document.createElement('video');
              el.preload = 'auto';
              el.muted = true; // MUST be true initially for iOS Safari to preload metadata
              el.playsInline = true;
            
              if (media.url.startsWith('blob:') || media.url.startsWith('data:')) {
                el.removeAttribute('crossOrigin');
              } else {
                el.crossOrigin = 'anonymous';
              }
              // ANDROID RENDERING FIX: styles the element "painted but invisible"
              // and appends it to the shared composited pool container. opacity 0
              // would make Chrome-Android treat the video as unpainted → decoder
              // frames never reach drawImage() → black preview on phones only.
              attachInvisibleMediaElement(el);
              // Hidden pool videos must never hijack Android's PiP / Cast UI.
              if ('disablePictureInPicture' in el) el.disablePictureInPicture = true;
              if ('disableRemotePlayback' in el) el.disableRemotePlayback = true;
              mediaVideoEls.set(key, el);
            }
            mediaVideoRefCount.set(key, (mediaVideoRefCount.get(key) ?? 0) + 1);

        const handleSeeked = () => {
          seekStartTimeRef.current.delete(clipId);
          if (isPreviewSuspendedForExport() || useEditorStore.getState().isPlaying) {
            pendingSeeksRef.current.delete(clipId);
            return;
          }
          triggerRedraw();
          const pendingTime = pendingSeeksRef.current.get(clipId);
          pendingSeeksRef.current.delete(clipId);
          // Reassigning the same currentTime starts another native seek. A
          // queued target often already matches after a drag has settled.
          if (pendingTime !== undefined && Math.abs(el!.currentTime - pendingTime) > 0.005) {
            el!.currentTime = pendingTime;
            seekStartTimeRef.current.set(clipId, performance.now());
          }
        };
        const entry: MediaElement = { el, clipId, mediaId: info.mediaId, type: 'video' };
        entry._shareKey = key;
        entry._shareStart = info.start;
        entry._shareEnd = info.end;
        entry._handleSeeked = handleSeeked;
        el.addEventListener('seeked', handleSeeked);
        if (elIsNew) {
          el.addEventListener('timeupdate', triggerRedraw);
          el.addEventListener('canplay', triggerRedraw);
          // Repaint as soon as the first decodable frame / metadata arrives so the
          // paused preview shows frame 0 without waiting for a seek.
          el.addEventListener('loadedmetadata', triggerRedraw);
          el.addEventListener('loadeddata', triggerRedraw);
        }

        // ANDROID RECOVERY: a video load that errors or stalls (decoder
        // contention is common on phones) must not stay black forever — the
        // src loader only ever assigns src once, so without this retry the clip
        // would never render. Bounded, backoff-spaced, and only while the clip
        // is still needed.
        let mediaRetryCount = 0;
        const retryMediaLoad = () => {
          if (isPreviewSuspendedForExport() || !poolRef.current.has(clipId)) return;
          if (!el || !el.src || el.src === '') return;
          if (el.readyState >= 1) return;
          if (mediaRetryCount >= 3) return;
          mediaRetryCount++;
          const delay = 400 * mediaRetryCount;
          setTimeout(() => {
            if (isPreviewSuspendedForExport() || !poolRef.current.has(clipId)) return;
            if (el && el.readyState >= 1) return;
            try { el.load(); } catch { /* element gone */ }
          }, delay);
        };
        entry._mediaRetryLoad = retryMediaLoad;
        el.addEventListener('error', retryMediaLoad);
        el.addEventListener('stalled', retryMediaLoad);

        // rvfc + visibility are just repaint triggers (the preview RAF loop
        // already repaints every frame while playing), so register them only
        // for the FIRST clip on a shared element — duplicates would fight over
        // the single _rvfcHandle slot.
        if (elIsNew && 'requestVideoFrameCallback' in el) {
          const onVideoFrame = () => {
            if (!poolRef.current.has(clipId)) return;
            triggerRedraw();
            entry._rvfcHandle = (el as any).requestVideoFrameCallback(onVideoFrame) as number;
          };
          entry._rvfcRegistered = true;
          entry._rvfcHandle = (el as any).requestVideoFrameCallback(onVideoFrame) as number;

          const onVisibilityChange = () => {
            if (!document.hidden && poolRef.current.has(clipId)) {
              requestAnimationFrame(() => {
                triggerRedraw();
                if (entry._rvfcHandle != null && 'cancelVideoFrameCallback' in el) {
                  (el as any).cancelVideoFrameCallback(entry._rvfcHandle);
                }
                entry._rvfcHandle = (el as any).requestVideoFrameCallback(onVideoFrame) as number;
              });
            }
          };
          entry._onVisibilityChange = onVisibilityChange;
          (el as any)._onVisibilityChange = onVisibilityChange;
          document.addEventListener('visibilitychange', onVisibilityChange);
        }

        // NOTE: element is already attached by attachInvisibleMediaElement() —
        // must stay inside the painted pool container or Android stops decoding.
        pool.set(clipId, entry);
        videoMap.set(clipId, el);
        } else {
          const el = document.createElement('audio');
          el.preload = 'auto';
          
          if (media.url.startsWith('blob:') || media.url.startsWith('data:')) {
            el.removeAttribute('crossOrigin');
          } else {
            el.crossOrigin = 'anonymous';
          }
          // ANDROID FIX: raw URL for blob:/data: (fragment on a blob src stalls
          // media loads on real Android devices). Dedupe is via element tag.
          assignClipMediaSrc(el as TaggedMediaElement, clipId, media.url);
          el.style.position = 'absolute';
          el.style.opacity = '0.01';
          el.style.pointerEvents = 'none';

        const handleSeeked = () => {
          if (isPreviewSuspendedForExport() || useEditorStore.getState().isPlaying) {
            pendingSeeksRef.current.delete(clipId);
            return;
          }
          const pendingTime = pendingSeeksRef.current.get(clipId);
          pendingSeeksRef.current.delete(clipId);
          if (pendingTime !== undefined && Math.abs(el.currentTime - pendingTime) > 0.005) {
            el.currentTime = pendingTime;
          }
        };
        const entry: MediaElement = { el, clipId, mediaId: info.mediaId, type: 'audio' };
        entry._handleSeeked = handleSeeked;
        el.addEventListener('seeked', handleSeeked);
        getMediaPoolContainer().appendChild(el);
        el.load();

        pool.set(clipId, entry);
      }
    }

    for (const [clipId, entry] of pool) {
      if (!neededClips.has(clipId)) {
        if (!entry._migrated) {
          entry.el.pause();
        }
        const el = entry.el as any;
        if (entry._handleSeeked) el.removeEventListener('seeked', entry._handleSeeked);
        if (entry._mediaRetryLoad) {
          el.removeEventListener('error', entry._mediaRetryLoad);
          el.removeEventListener('stalled', entry._mediaRetryLoad);
        }
        if (entry.separationGraph) { try { entry.separationGraph.input.disconnect(); } catch (e) {} }
        if (entry.pitchNode) { try { entry.pitchNode.disconnect(); } catch (e) {} }
        if (entry.gainNode) { try { entry.gainNode.disconnect(); } catch (e) {} }
        if (entry.sourceNode) { try { entry.sourceNode.disconnect(); } catch (e) {} }
        if (entry.feedbackNode) { try { entry.feedbackNode.disconnect(); } catch(e) {} }
        if (entry.delayNode) { try { entry.delayNode.disconnect(); } catch(e) {} }

        if (entry._migrated) {
          pool.delete(clipId);
          videoMap.delete(clipId);
          pendingSeeksRef.current.delete(clipId);
          seekStartTimeRef.current.delete(clipId);
          continue;
        }

        if (entry.type === 'video') {
          // Shared element: only tear the element down when the LAST clip
          // referencing this split chain leaves the pool. The repaint
          // listeners (timeupdate/canplay/rvfc/visibility) are SHARED on the
          // element — removing them when a sibling segment is evicted would
          // silently strip them from the segments that remain, so they are
          // removed here at teardown only. Per-entry listeners (seeked,
          // media-retry) were removed above.
          const remaining = (mediaVideoRefCount.get(entry._shareKey ?? entry.mediaId) ?? 1) - 1;
          if (remaining <= 0) {
            mediaVideoRefCount.delete(entry._shareKey ?? entry.mediaId);
            mediaVideoEls.delete(entry._shareKey ?? entry.mediaId);
            el.removeEventListener('timeupdate', triggerRedraw);
            el.removeEventListener('canplay', triggerRedraw);
            el.removeEventListener('loadedmetadata', triggerRedraw);
            el.removeEventListener('loadeddata', triggerRedraw);
            if (entry._rvfcHandle != null && 'cancelVideoFrameCallback' in el) {
              try { el.cancelVideoFrameCallback(entry._rvfcHandle); } catch { /* element gone */ }
            }
            if (el._onVisibilityChange) {
              document.removeEventListener('visibilitychange', el._onVisibilityChange);
              delete el._onVisibilityChange;
            } else if (entry._onVisibilityChange) {
              document.removeEventListener('visibilitychange', entry._onVisibilityChange);
            }
            releaseMediaElement(el);
          } else {
            mediaVideoRefCount.set(entry._shareKey ?? entry.mediaId, remaining);
          }
        } else {
          releaseMediaElement(entry.el);
        }
        pool.delete(clipId);
        videoMap.delete(clipId);
        pendingSeeksRef.current.delete(clipId);
        seekStartTimeRef.current.delete(clipId);
      }
    }
  }, [tracks, mediaLibrary, ctBucket, seekRevision, triggerRedraw, isPrimary, previewSuspended]);

  // ---- Proximity source loader ----
  useEffect(() => {
    if (!isPrimary || isPreviewSuspendedForExport()) return;
    const pool = poolRef.current;
    if (isExporting) {
      for (const [clipId, entry] of pool) {
        if (entry.type !== 'video') continue;
        const el = entry.el as HTMLVideoElement;
        const media = mediaMapRef.current.get(entry.mediaId);
        if (!media || !media.url || media.url === 'PENDING_RESTORE') continue;
        const targetSrc = media.url;
        // Element-level tag: the element is shared by every clip of this split
        // chain, so a clip-level tag would reassign the src and restart the
        // decoder for each segment during export.
        if (assignClipMediaSrc(el as TaggedMediaElement, `media:${entry._shareKey ?? entry.mediaId}`, targetSrc)) {
          const pendingTime = pendingSeeksRef.current.get(clipId);
          if (pendingTime !== undefined) {
            el.currentTime = pendingTime;
            pendingSeeksRef.current.delete(clipId);
          }
          el.load();
        }
      }
      return;
    }

    // Read the exact playhead position once. (The effect itself is scheduled off
    // the coarse `ctBucket`, so we must not rely on a stale rendered value here.)
    const nowTime = useEditorStore.getState().currentTime;
    // ANDROID FIX: device-scaled decoder budget (2 on phones, 4 on desktop) —
    // module-level getter, stable across renders. See getMaxLoadedVideos().
    const maxLoadedVideos = getMaxLoadedVideos();

    // Priority-based video src loading (nearest clips get loaded first)
    const videoEntries: Array<{
      clipId: string;
      entry: MediaElement;
      dist: number;
      absStart: number;
      clipDuration: number;
      media: any;
      clipObj: any;
    }> = [];

    for (const [clipId, entry] of pool) {
      if (entry.type !== 'video') continue;
      const foundNode = findClipById(clipId);
      const clipObj = foundNode ? foundNode.clip : null;
      if (!clipObj) continue;
      const media = mediaMapRef.current.get(entry.mediaId);
      if (!media || !media.url || media.url === 'PENDING_RESTORE') continue;
      const absStart = foundNode ? foundNode.absStartTime : clipObj.startTime;
      const clipEnd = absStart + clipObj.duration;
      const dist = nowTime >= absStart && nowTime < clipEnd
        ? 0
        : Math.min(Math.abs(nowTime - absStart), Math.abs(nowTime - clipEnd));
      videoEntries.push({ clipId, entry, dist, absStart, clipDuration: clipObj.duration, media, clipObj });
    }

    videoEntries.sort((a, b) => a.dist - b.dist);
    const getProximityWindow = (mediaItem: any) => {
      const height = mediaItem.height || 1080;
      if (height >= 2160) return 5;
      if (height >= 1080) return 10;
      return 15;
    };

    // ── DEDUPE BY SHARED ELEMENT KEY ───────────────────────────────────────
    // Split segments share one <video> element, so they must also share ONE
    // decoder slot. Keep the NEAREST clip per element key as the representative
    // that owns src assignment; the other segments of the same chain are
    // skipped entirely (their element already has the media's src, and the
    // sync loop simply seeks it across segment boundaries). This is what stops
    // repeated splits from rotating el.load() decode restarts as the playhead
    // crosses each split point. Distinct element keys (duplicates, other
    // tracks) each get their own slot.
    const mediaToEntry = new Map<string, typeof videoEntries[0]>();
    for (const ve of videoEntries) {
      const key = ve.entry._shareKey ?? ve.entry.mediaId;
      const existing = mediaToEntry.get(key);
      if (!existing || ve.dist < existing.dist) mediaToEntry.set(key, ve);
    }
    const repEntries = [...mediaToEntry.values()].sort((a, b) => a.dist - b.dist);

    let loadedCount = 0;
    for (const ve of repEntries) {
      const el = ve.entry.el as HTMLVideoElement;
      const isNear = ve.dist <= getProximityWindow(ve.media);
      // ACTIVE-CLIP PRIORITY: the clip currently under the playhead must always
      // receive a src, even when the (already mobile-reduced) decoder budget is
      // exhausted by neighbours. Otherwise overlapping multi-track clips render
      // black — much easier to hit on a phone where the budget is just 2.
      const isActiveClip = nowTime >= ve.absStart && nowTime < ve.absStart + ve.clipDuration;
      const canLoad = isActiveClip || loadedCount < maxLoadedVideos;

      if (isNear && canLoad) {
        const targetSrc = ve.media.url;
        // Element-level src tag: every clip sharing this element dedupes
        // against the same tag, so crossing a split boundary never reassigns
        // the src (which would restart the decoder via el.load()).
        const srcKey = `media:${ve.entry._shareKey ?? ve.entry.mediaId}`;
        if (targetSrc === 'PENDING_RESTORE' || !targetSrc) {
          resolveMediaFile(ve.entry.mediaId)
            .then((file) => (file ? URL.createObjectURL(file) : null))
            .then((restoredUrl) => {
              if (!restoredUrl) return;
              if (isPreviewSuspendedForExport() || !pool.has(ve.clipId)) {
                URL.revokeObjectURL(restoredUrl);
                return;
              }
              if (assignClipMediaSrc(el as TaggedMediaElement, srcKey, restoredUrl)) {
                el.load();
                useEditorStore.setState((state) => ({
                  mediaLibrary: state.mediaLibrary.map((m) =>
                    m.id === ve.entry.mediaId ? { ...m, url: restoredUrl } : m,
                  ),
                }));
                const pendingTime = pendingSeeksRef.current.get(ve.clipId);
                if (pendingTime !== undefined) {
                  el.currentTime = pendingTime;
                  pendingSeeksRef.current.delete(ve.clipId);
                }
              }
            })
            .catch(() => {});
        } else {
          if (assignClipMediaSrc(el as TaggedMediaElement, srcKey, targetSrc)) {
            const pendingTime = pendingSeeksRef.current.get(ve.clipId);
            if (pendingTime !== undefined) {
              el.currentTime = pendingTime;
              pendingSeeksRef.current.delete(ve.clipId);
            }
            el.load();
          }
        }
        loadedCount++;
      } else if (!isNear && !isActiveClip) {
        // The media is far from the playhead: free its decoder. (Near-but-
        // unloaded media deliberately KEEPS whatever src it already has —
        // clearing would kill the src for every clip of that media and force a
        // full reload the moment the playhead returns.)
        if (el.src !== '' || (el as TaggedMediaElement)._procutClipSrcTag) {
          clearClipMediaSrc(el as TaggedMediaElement);
        }
      }
    }
  }, [ctBucket, seekRevision, tracks, mediaLibrary, isExporting, isPrimary, previewSuspended]);

  // ============================================================
  // SINGLE RAF SYNC LOOP — The Heart of the Fix
  // ============================================================
  useEffect(() => {
    if (!isPrimary) return;

    let isRunning = true;
    let lastRafTime = performance.now();
    let accumulatedDriftAudio = 0; // Integral term for audio PID
    // MOBILE PERF: throttle media sync to 15Hz on mobile. The PLL drift
    // adjustments modulate playbackRate by at most 10% — they don't need
    // 60-120Hz precision. Running at native refresh rate wastes main thread
    // time on expensive video element DOM property accesses (el.currentTime,
    // el.playbackRate) which stall the rendering pipeline on mobile.
    const isMobileSyncThrottle = isMobileDevice();
    const MOBILE_SYNC_INTERVAL = 1000 / 15; // ~67ms
    let lastSyncLoopTime = 0;
    // SPEED FRAME FIX: consecutive-buffering-tick counter (hysteresis for the
    // isBuffering flag — see the buffering detection section below).
    // Declared outside syncLoop so it accurately accumulates across RAF ticks.
    let bufferingTickCount = 0;

    const syncLoop = () => {
      if (!isRunning) return;
      if (isPreviewSuspendedForExport()) {
        lastRafTime = performance.now();
        rafIdRef.current = requestAnimationFrame(syncLoop);
        return;
      }

      const now = performance.now();

      // MOBILE PERF: skip sync ticks on mobile to free main thread for rendering.
      // BUT: reversed/frozen clips need frame-by-frame seeks every tick — skip throttle if any are active.
      const hasReversedOrFrozen = cachedActiveClipsRef.current.some((c: any) => c.isReversed || c.freezeFrame !== undefined);
      if (isMobileSyncThrottle && !hasReversedOrFrozen && (now - lastSyncLoopTime) < MOBILE_SYNC_INTERVAL) {
        rafIdRef.current = requestAnimationFrame(syncLoop);
        return;
      }
      lastSyncLoopTime = now;

      const dt = (now - lastRafTime) / 1000;
      lastRafTime = now;

      const store = useEditorStore.getState();
      // CRITICAL (stutter fix): read the playhead from the React-free clock, not
      // from the store. The store's `currentTime` is only refreshed ~10x/second
      // during playback, so it is a staircase signal. Every drift measurement taken
      // against it carried up to ~100ms of quantisation error — far above the 25ms
      // video PLL threshold — so the controller constantly "corrected" drift that
      // did not exist, modulating playbackRate and, past the hard-seek threshold,
      // issuing spurious seeks that flush the decode pipeline. The clock is updated
      // every animation frame with the exact position, so drift is now real.
      // During trim preview, getEffectivePreviewTime() returns the trim edge position.
      const ct = getEffectivePreviewTime();
      const playing = store.isPlaying;
      const justStartedPlaying = playing && !prevPlayingRef.current;
      prevPlayingRef.current = playing;
      const scrubbing = store.isScrubbing;
      const globalSpeed = store.playbackSpeed;
      const globalMuted = store.isMuted || !!store.muteTimelineAudio;
      const direction = store.playbackDirection ?? 1;
      const isReversing = direction < 0;

      const pool = poolRef.current;
      setIsPlayingClock(playing);

      // PERF: lazy per-tick split-group index — built ONCE per sync tick, and
      // only when a clip's own pool entry is missing (the common path never
      // pays for it). Replaces the full pool scan per clip per tick in the
      // scrub/playback fallbacks. shareKey format is `${mediaId}::${groupId}`,
      // so the group id is the part after '::'.
      let splitGroupIdx: Map<string, MediaElement> | null = null;
      const getSplitGroupEntry = (splitGroupId?: string): MediaElement | null => {
        if (!splitGroupId) return null;
        if (!splitGroupIdx) {
          splitGroupIdx = new Map();
          for (const [, e] of pool) {
            if (e.type !== 'video' || !e.el) continue;
            // CRITICAL GUARD: Never share an element that is actively playing another clip in this frame!
            if (playingIds.has(e.clipId)) continue;
            if (e._shareKey) {
              const part = e._shareKey.split('::')[1] || '';
              const cleanGid = part.replace(/^split:/, '').replace(/_\d+$/, '');
              if (cleanGid && !splitGroupIdx.has(cleanGid)) splitGroupIdx.set(cleanGid, e);
              if (part && !splitGroupIdx.has(part)) splitGroupIdx.set(part, e);
            }
          }
        }
        return splitGroupIdx.get(splitGroupId) ?? null;
      };

      // PERF + BUG FIX: Cache active clips list with loop/seek-backward detection.
      // Bug: when playback loops (t=30 → t=0), nextClipBoundaryRef was still > 0, so
      // `ct >= nextClipBoundary` was false and stale end-of-timeline clips were returned.
      // Video elements saw their clipIds as still "active" (justActivated=false), skipping
      // the hard seek that would reset them to t=0. Result: frozen/lagging second playback.
      const storeTracks = store.tracks;
      const tracksChanged = storeTracks !== lastCachedStoreTracksRef.current;
      // Universal jump detection: backward jump, forward jump > 0.25s, or scrub jump
      const isJump = prevSyncCtRef.current >= 0 && (
        Math.abs(ct - prevSyncCtRef.current) > (playing ? (Math.max(0.1, globalSpeed) * dt + 0.25) : 0.03)
      );
      const crossedBoundary = ct >= nextClipBoundaryRef.current || (nextClipBoundaryRef.current !== Infinity && ct < prevSyncCtRef.current);
      prevSyncCtRef.current = ct;

      if (tracksChanged || crossedBoundary || isJump || justStartedPlaying) {
        if (tracksChanged) {
          sortedTracksRef.current = storeTracks.map((t: any) => ({
            ...t,
            clips: [...t.clips].sort((a: any, b: any) => a.startTime - b.startTime)
          }));
        }
        if (isJump || tracksChanged || justStartedPlaying) {
          // Reset boundary so active clips and next boundary are fully re-evaluated at the new jump position / after edits / on play
          nextClipBoundaryRef.current = 0;
          // Clear lastActiveClipIds so ALL clips at the new position are treated as freshly activated,
          // which forces hard seeks to their exact target frame and resets accumulated drift
          lastActiveClipIdsRef.current = new Set();
          triggeredTransitionsRef.current.clear();
          preRolledBoundaryRef.current = null;
          if (justStartedPlaying) {
            playbackDiagnostics.recordEvent('state', `Playback started at ${ct.toFixed(2)}s`);
          } else if (isJump) {
            playbackDiagnostics.recordEvent('seek', `Seek jump detected to ${ct.toFixed(2)}s`);
          }
        } else if (crossedBoundary) {
          playbackDiagnostics.recordEvent('boundary', `Timeline boundary crossed at ${ct.toFixed(2)}s`);
        }
        cachedActiveClipsRef.current = getActiveClips();
        lastCachedStoreTracksRef.current = storeTracks;

        // Compute next boundary: min(clip starts > ct, clip ends > ct, speed frame transitions > ct)
        let nextBoundary = Infinity;
        for (const track of sortedTracksRef.current) {
          for (let i = 0; i < track.clips.length; i++) {
            const clip = track.clips[i];
            const clipEnd = clip.startTime + clip.duration;
            if (clip.startTime > ct && clip.startTime < nextBoundary) nextBoundary = clip.startTime;
            if (clipEnd > ct && clipEnd < nextBoundary) nextBoundary = clipEnd;

            // Include speed frame boundaries so PLL updates speeds dynamically
            if (clip.speedFrames && clip.speedFrames.length > 0) {
              for (const sf of clip.speedFrames) {
                const sfTime = clip.startTime + sf.timelineOffset;
                if (sfTime > ct && sfTime < nextBoundary) nextBoundary = sfTime;
              }
            }

            // Also account for transition boundaries, otherwise the incoming clip
            // isn't activated until its precise startTime, causing a hard-seek stall
            // midway through the transition visual blend.
            if (i > 0) {
              const prevClip = track.clips[i - 1];
              const transition = clip.transitionIn || prevClip.transitionOut;
              if (transition && transition.duration > 0) {
                const alignment = transition.params?.alignment || 'center';
                const win = getTransitionWindow(clip.startTime, transition.duration, alignment, prevClip, clip);
                if (win.start > ct && win.start < nextBoundary) nextBoundary = win.start;
                if (win.end > ct && win.end < nextBoundary) nextBoundary = win.end;
              }
            }
          }
        }
        nextClipBoundaryRef.current = nextBoundary;
      }

      // PERF (multi-split fix): pre-roll the INCOMING segment's decoder ~0.2s
      // before a split boundary. When playback crosses a boundary, the next
      // segment activates and issues a hard seek (decode restart from the
      // nearest keyframe) — with many short segments that's a restart per
      // boundary, and the buffering detector below then freezes the playhead
      // each time. Seeking the incoming element to its start media time early
      // lets the first frame decode before the boundary, so activation finds
      // drift < 0.05 and skips the hard seek entirely.
      // Only DEDICATED (own-element) segments are pre-rolled: if the incoming
      // segment shares the currently-active element (contiguous chain), seeking
      // it early would move the visible picture. Guarded per boundary so the
      // warm-up runs once per crossing.
      if (playing && !scrubbing) {
        const boundary = nextClipBoundaryRef.current;
        const lookahead = boundary - ct;
        if (Number.isFinite(boundary) && lookahead > 0 && lookahead <= 1.5) {
          if (preRolledBoundaryRef.current !== boundary) {
            preRolledBoundaryRef.current = boundary;
            const activePoolEntries = new Set<any>();
            for (const c of cachedActiveClipsRef.current) {
              const e = pool.get(c.clipId);
              if (e && e.el) activePoolEntries.add(e.el);
            }

            for (const track of sortedTracksRef.current) {
              if (track.hidden || track.type !== 'video') continue;
              for (let i = 0; i < track.clips.length; i++) {
                const tc = track.clips[i];
                let isIncomingTransition = false;
                if (i > 0) {
                  const prevClip = track.clips[i - 1];
                  const transition = tc.transitionIn || prevClip.transitionOut;
                  if (transition && transition.duration > 0) {
                    const alignment = transition.params?.alignment || 'center';
                    const win = getTransitionWindow(tc.startTime, transition.duration, alignment, prevClip, tc);
                    if (Math.abs(win.start - boundary) <= 0.005) {
                      isIncomingTransition = true;
                    }
                  }
                }
                if (!isIncomingTransition && Math.abs(tc.startTime - boundary) > 0.005) continue;

                // Find element for incoming clip
                let entry = pool.get(tc.id);
                if (!entry) {
                  const tKey0 = `${tc.mediaId}::track:${track.id}::slot:0`;
                  const tKey1 = `${tc.mediaId}::track:${track.id}::slot:1`;
                  const matchedEl = mediaVideoEls.get(tKey0) || mediaVideoEls.get(tKey1) || mediaVideoEls.get(`${tc.mediaId}::track:${track.id}`);
                  if (matchedEl) {
                    entry = { el: matchedEl, clipId: tc.id, mediaId: tc.mediaId, type: 'video' };
                    pool.set(tc.id, entry);
                    videoMapRef.current.set(tc.id, matchedEl);
                  }
                }
                if (!entry || entry.type !== 'video' || !entry.el) continue;

                const el = entry.el as HTMLVideoElement;
                // CRITICAL: NEVER seek an element that is currently rendering the visible frame for an active clip!
                if (activePoolEntries.has(el)) continue;
                // If element is already in an in-flight seek, do not disturb it
                if (el.seeking) continue;

                const mediaItem = mediaMapRef.current.get(tc.mediaId) || useEditorStore.getState().mediaLibrary.find(m => m.id === tc.mediaId);
                const maxDuration = mediaItem ? mediaItem.duration : 10000;
                const targetPreRollTime = isIncomingTransition ? tc.startTime : boundary;
                const mediaTime = Math.max(0, Math.min(maxDuration, getMediaTimeForClip(
                  {
                    id: tc.id,
                    startTime: tc.startTime,
                    duration: tc.duration,
                    trimStart: tc.trimStart,
                    speed: tc.speed,
                    speedRamp: tc.speedRamp,
                    speedFrames: tc.speedFrames,
                    speedFrameSourceEnd: tc.speedFrameSourceEnd,
                    isReversed: tc.isReversed,
                    freezeFrame: tc.freezeFrame,
                  },
                  targetPreRollTime
                )));

                if (Math.abs(el.currentTime - mediaTime) > 0.03) {
                  el.currentTime = mediaTime;
                  pendingSeeksRef.current.set(tc.id, mediaTime);
                  seekStartTimeRef.current.set(tc.id, performance.now());
                  (el as any)._seekStartTime = performance.now();
                }
                break;
              }
            }
          }
        } else if (lookahead <= 0 || lookahead > 0.5) {
          preRolledBoundaryRef.current = null;
        }
      }
      const clips = cachedActiveClipsRef.current;
      // PERF: Reuse a persistent Set instead of `new Set(clips.map(...))` every frame.
      // That pattern creates 2 heap objects (Array + Set) at 60fps = 7200 GC-eligible objects/min.
      const playingIds = playingIdsSetRef.current;
      playingIds.clear();
      for (const c of clips) playingIds.add(c.clipId);
      const mediaMap = mediaMapRef.current;

      // ---- 1. Scrubbing: pause everything, but keep ACTIVE video elements
      // following the scrub position so the preview updates in REAL TIME.
      // (Previously we only paused here and returned — the video elements were
      // never seeked until the drag ended, so the canvas kept drawing the
      // pre-scrub frame the whole drag and only repainted after release.) ----
      if (scrubbing) {
        for (const [, entry] of pool) {
          if (!entry.el.paused) entry.el.pause();
        }
        // During trim, ct is already getEffectivePreviewTime() (amber playhead position)
        const scrubTime = ct;
        for (const clip of clips) {
        let entry = pool.get(clip.clipId);
        if (!entry) {
          entry = getSplitGroupEntry(clip.clip?.splitGroupId) ?? undefined;
        }
        if (!entry || entry.type !== 'video') continue;
        const mediaItem = mediaMap.get(clip.mediaId);
        const maxDuration = mediaItem ? mediaItem.duration : 10000;
        const mediaTime = Math.max(0, Math.min(maxDuration, getMediaTimeForClip({
            id: clip.clipId,
            startTime: clip.absStartTime,
            duration: clip.clipDuration,
            trimStart: clip.trimStart,
            speed: clip.speed,
            speedRamp: clip.speedRamp,
            speedFrames: clip.speedFrames,
            speedFrameSourceEnd: clip.speedFrameSourceEnd,
            isReversed: clip.isReversed,
            freezeFrame: clip.freezeFrame,
          }, scrubTime)));
          const el = entry.el;
          // Don't fight an in-flight seek — the element's 'seeked' listener
          // triggers a canvas repaint the moment the new frame decodes.
          // PERF: fastSeek snaps to the nearest keyframe without exact-frame
          // decode — 2-10x faster per scrub tick. Scrub tolerates imprecision
          // (the scrub-end finalize path re-seeks exactly + full-quality
          // redraw), so intermediate ticks don't need exact frames.
          if (!el.seeking && Math.abs(el.currentTime - mediaTime) > 0.03) {
            if (typeof (el as HTMLVideoElement).fastSeek === 'function') {
              (el as HTMLVideoElement).fastSeek(mediaTime);
            } else {
              el.currentTime = mediaTime;
            }
          } else if (el.seeking) {
            pendingSeeksRef.current.set(clip.clipId, mediaTime);
          }
        }
        lastActiveClipIdsRef.current = playingIds;
        rafIdRef.current = requestAnimationFrame(syncLoop);
        return;
      }

      // ---- 2. Sync each active element ----
      for (const clip of clips) {
        let entry = pool.get(clip.clipId);
        // IMMEDIATE TRACK-ELEMENT HEALING:
        // Check if an existing element for this track/slot is already in mediaVideoEls
        if (!entry) {
          const tKey0 = `${clip.mediaId}::track:${clip.trackId}::slot:0`;
          const tKey1 = `${clip.mediaId}::track:${clip.trackId}::slot:1`;
          const tKeyDirect = `${clip.mediaId}::track:${clip.trackId}`;
          const existingEl = mediaVideoEls.get(tKey0) || mediaVideoEls.get(tKey1) || mediaVideoEls.get(tKeyDirect);
          if (existingEl) {
            entry = { el: existingEl, clipId: clip.clipId, mediaId: clip.mediaId, type: clip.trackType };
            pool.set(clip.clipId, entry);
            if (clip.trackType === 'video') {
              videoMapRef.current.set(clip.clipId, existingEl);
            }
          }
        }
        // PERF (multi-split fix): the fallback matches elements of the same split
        // group, or the same mediaId if no dedicated element is allocated.
        if (!entry) {
          entry = getSplitGroupEntry(clip.clip?.splitGroupId) ?? undefined;
        }
        // VIDEO FALLBACK: match any existing video element sharing this mediaId
        if (!entry && (clip.trackType === 'video' || (clip.clip as any)?.type === 'video')) {
          for (const [, e] of pool) {
            // CRITICAL GUARD: Never steal an element that is actively playing another clip in this frame!
            if (playingIds.has(e.clipId) && e.clipId !== clip.clipId) continue;
            if (e.type === 'video' && e.mediaId === clip.mediaId && e.el) {
              entry = e;
              // Self-heal: register this entry under clip.clipId so pool and videoMap have it immediately
              pool.set(clip.clipId, { ...e, clipId: clip.clipId });
              videoMapRef.current.set(clip.clipId, e.el as HTMLVideoElement);
              break;
            }
          }
        }
        // AUDIO SPLIT FALLBACK: match any existing audio element sharing this mediaId
        if (!entry && (clip.trackType === 'audio' || (clip.clip as any)?.type === 'audio')) {
          for (const [, e] of pool) {
            // CRITICAL GUARD: Never steal an element that is actively playing another clip in this frame!
            if (playingIds.has(e.clipId) && e.clipId !== clip.clipId) continue;
            if (e.type === 'audio' && e.mediaId === clip.mediaId && e.el) {
              entry = e;
              pool.set(clip.clipId, { ...e, clipId: clip.clipId });
              break;
            }
          }
        }
        if (!entry) continue;

        const mediaItem = mediaMap.get(clip.mediaId);
        const maxDuration = mediaItem ? mediaItem.duration : 10000;

        const mediaTime = Math.max(0, Math.min(maxDuration, getMediaTimeForClip({
          id: clip.clipId,
          startTime: clip.absStartTime,
          duration: clip.clipDuration,
          trimStart: clip.trimStart,
          speed: clip.speed,
          speedRamp: clip.speedRamp,
          speedFrames: clip.speedFrames,
          speedFrameSourceEnd: clip.speedFrameSourceEnd,
          isReversed: clip.isReversed,
          freezeFrame: clip.freezeFrame,
        }, ct)));

        const el = entry.el;
        const currentMediaTime = el.currentTime;
        const rawDrift = currentMediaTime - mediaTime; // positive = ahead
        const justActivated = !lastActiveClipIdsRef.current.has(clip.clipId);

        // Speed-ramp-aware: use current segment speed for playbackRate
        const hasSpeedFrames = clip.speedFrames && clip.speedFrames.length > 0;
        const currentSegmentSpeed = (hasSpeedFrames || (clip.speedRamp && clip.speedRamp.length >= 2))
          ? getSpeedForClipAtTime({
              id: clip.clipId,
              startTime: clip.absStartTime,
              duration: clip.clipDuration,
              trimStart: clip.trimStart,
              speed: clip.speed,
              speedRamp: clip.speedRamp,
              speedFrames: clip.speedFrames,
              speedFrameSourceEnd: clip.speedFrameSourceEnd,
              isReversed: clip.isReversed,
              freezeFrame: clip.freezeFrame,
            }, ct)
          : clip.speed;

        // Lazy init audio graph
        if ((entry.type === 'audio' || entry.type === 'video') && !entry.sourceNode) {
          const el = entry.el as any;
          if (el._procutSharedAudioGraph) {
            Object.assign(entry, el._procutSharedAudioGraph);
          } else {
            initAudioGraph(entry);
            if (entry.sourceNode) {
              el._procutSharedAudioGraph = {
                audioCtx: entry.audioCtx,
                feedbackInputGain: entry.feedbackInputGain,
                feedbackNode: entry.feedbackNode,
                pannerNode: entry.pannerNode,
                gainNode: entry.gainNode,
                separationGraph: entry.separationGraph,
                sourceNode: entry.sourceNode,
                vocalFilter: entry.vocalFilter,
                vocalFilterF1: entry.vocalFilterF1,
                vocalFilterF3: entry.vocalFilterF3,
                pitchNode: entry.pitchNode,
                compressorNode: entry.compressorNode,
                denoiseFilter: entry.denoiseFilter,
                bassFilter: entry.bassFilter,
                midFilter: entry.midFilter,
                trebleFilter: entry.trebleFilter,
                deEsserFilter: entry.deEsserFilter,
                warmthFilter: entry.warmthFilter,
                delayNode: entry.delayNode,
                delayGain: entry.delayGain,
              };
            }
          }
        }
        if (playing && !entry._isGraphConnected && entry.gainNode) {
          connectAudioNode(entry);
        } else if (!playing && entry._isGraphConnected) {
          disconnectAudioNode(entry);
        }

        // ---- AUDIO SYNC STRATEGY (Gentle) ----
        if (entry.type === 'audio') {
          // SPEED FRAME FIX: scale thresholds by the current segment speed —
          // rawDrift is in MEDIA seconds but the perceptual error is in
          // TIMELINE seconds (at 10x speed, 500ms of media drift is only 50ms
          // of timeline error). The old fixed thresholds made the audio sync
          // hard-seek repeatedly on ramped timelines.
          const audioSpeedScale = Math.max(1, currentSegmentSpeed);
          const AUDIO_HARD_SEEK_THRESHOLD = Math.max(0.5, 0.75 * audioSpeedScale);   // 500ms at 1x
          const AUDIO_PLL_THRESHOLD = Math.max(0.10, 0.15 * audioSpeedScale);        // 100ms at 1x
          const AUDIO_MAX_PLL_ADJUST = 0.005;      // 0.5%
          const AUDIO_PLL_P = 0.15;                // Proportional gain
          const AUDIO_PLL_I = 0.02;                // Integral gain

          if (playing && !isReversing && !store.isBuffering) {
            // Immediate resume if suspended (no requestIdleCallback delay!)
            if (entry.audioCtx && entry.audioCtx.state === 'suspended') {
              entry.audioCtx.resume().catch(() => {});
            }

            if (justActivated || Math.abs(rawDrift) > AUDIO_HARD_SEEK_THRESHOLD) {
              // Hard seek only on activation or massive drift — but skip if
              // the element is already at the target (e.g. from a scrub seek)
              if (!el.seeking && Math.abs(rawDrift) > 0.05) {
                el.currentTime = mediaTime;
                pendingSeeksRef.current.delete(clip.clipId);
                accumulatedDriftAudio = 0; // Reset integral
              }
            } else if (Math.abs(rawDrift) > AUDIO_PLL_THRESHOLD) {
              // Gentle PLL: playbackRate adjustments (wider range when speed-ramped)
              accumulatedDriftAudio += rawDrift * dt;
              const isRamped = (clip.speedRamp && clip.speedRamp.length >= 2) || ((clip.clip as any)?.speedFrames && (clip.clip as any).speedFrames.length > 0);
              const maxAdjust = isRamped ? 0.35 : AUDIO_MAX_PLL_ADJUST;
              let adjustment = (rawDrift * AUDIO_PLL_P) + (accumulatedDriftAudio * AUDIO_PLL_I);
              adjustment = Math.max(-maxAdjust, Math.min(maxAdjust, adjustment));
              const nominalRate = globalSpeed * currentSegmentSpeed;
              const targetRate = Math.max(0.05, nominalRate * (1 - adjustment));
              if (Math.abs(el.playbackRate - targetRate) > 0.001) {
                el.playbackRate = targetRate;
              }
            } else {
              // Within threshold: return to nominal speed
              accumulatedDriftAudio *= 0.9; // decay integral
              const nominalRate = globalSpeed * currentSegmentSpeed;
              if (Math.abs(el.playbackRate - nominalRate) > 0.001) {
                el.playbackRate = nominalRate;
              }
            }

            if (el.paused) {
              el.play().catch(() => {});
            }
          } else {
            if (!el.paused) el.pause();
            if (!isReversing && Math.abs(rawDrift) > 0.02 && !el.seeking) {
              el.currentTime = mediaTime;
            }
          }
        }

        // ---- VIDEO SYNC STRATEGY (Smooth PLL without seek-storm stutter) ----
        else if (entry.type === 'video') {
          const isRamped = (clip.speedRamp && clip.speedRamp.length >= 2) || ((clip.clip as any)?.speedFrames && (clip.clip as any).speedFrames.length > 0);
          const hasSpeedFramesOnly = hasSpeedFrames && (!clip.speedRamp || clip.speedRamp.length < 2);
          // SPEED FRAME FIX: drift thresholds must scale with the CURRENT segment
          // speed. rawDrift is in MEDIA seconds but the perceptual error is in
          // TIMELINE seconds: at 10x speed, 1.2s of media drift is only 120ms of
          // timeline error — yet the old fixed 1.2s threshold made the PLL fight
          // it with ±35% rate modulation (visible speed jitter) and hard-seek
          // whenever a fast segment outpaced the decoder (browsers cap
          // playbackRate), producing repeated decode restarts + buffering
          // freezes on ramped timelines. Scaling by segment speed keeps the
          // same timeline-time tolerance at every ramp speed.
          //
          // BUG 5 FIX: Speed-frame clips (from AI Speed Sync) need MUCH tighter
          // thresholds than regular speed ramps. Word-level lip-sync requires
          // ≤50ms accuracy, but the old 0.75×speedScale threshold allowed up to
          // 1.5s drift at 2x speed — far too wide.
          const speedScale = Math.max(1, currentSegmentSpeed);
          const VIDEO_HARD_SEEK_THRESHOLD = hasSpeedFramesOnly
            ? Math.max(0.35, 0.40 * speedScale)
            : (isRamped ? Math.max(0.65, 0.90 * speedScale) : Math.max(0.85, 1.20 * speedScale));
          const VIDEO_PLL_THRESHOLD = hasSpeedFramesOnly
            ? Math.max(0.02, 0.03 * speedScale)
            : Math.max(0.025, 0.05 * speedScale);
          const VIDEO_MAX_PLL_ADJUST = isRamped ? 0.35 : 0.15;       // Dynamic playback rate modulation

          // REVERSE / FREEZE FRAME: browsers can't play <video> backward, so we
          // keep the element paused and manually seek each sync tick.
          if (clip.isReversed || clip.freezeFrame !== undefined) {
            if (!el.paused) el.pause();
            // Seek to target time if we're more than one frame (~16ms) off.
            // PERF: fastSeek (keyframe-snap) keeps per-tick reverse scrubbing
            // cheap; exactness isn't needed mid-reverse.
            if (!el.seeking && Math.abs(el.currentTime - mediaTime) > 0.016) {
              if (typeof (el as HTMLVideoElement).fastSeek === 'function') {
                (el as HTMLVideoElement).fastSeek(mediaTime);
              } else {
                el.currentTime = mediaTime;
              }
              seekStartTimeRef.current.set(clip.clipId, performance.now());
            }
          } else if (playing && !isReversing) {
            // Immediate resume if suspended (ensures video internal audio plays via Web Audio)
            if (entry.audioCtx && entry.audioCtx.state === 'suspended') {
              entry.audioCtx.resume().catch(() => {});
            }

                        if (el.seeking) {
              // Decoder is actively in-flight seeking a keyframe.
              // CRITICAL: NEVER mutate el.playbackRate or call el.play() while el.seeking === true.
              // In Chromium, modifying playbackRate or issuing play() while seeking interrupts
              // the hardware decoder pipeline, keeping seeking=true and readyState=1 indefinitely.
              const seekStart = (el as any)._seekStartTime || seekStartTimeRef.current.get(clip.clipId);
              if (seekStart && (performance.now() - seekStart > 800)) {
                // If the element has been stalled in seek for > 800ms, retry keyframe snap without play()
                if (typeof (el as any).fastSeek === 'function') {
                  (el as any).fastSeek(mediaTime);
                }
                (el as any)._seekStartTime = performance.now();
                seekStartTimeRef.current.set(clip.clipId, performance.now());
              }
            } else if (justActivated || Math.abs(rawDrift) > VIDEO_HARD_SEEK_THRESHOLD) {
              // Skip the hard seek if the element is ALREADY at (or very near)
              // the target — e.g. after a scrub-seek that positioned it, then
              // playback resumed and the clip re-activated. Issuing a redundant
              // seek cancels the in-flight decode and restarts it from scratch,
              // which is the #1 cause of the stutter storm on ruler-click jumps.
              //
              // FIX 2 (Split Boundary Smooth Activation): When a clip activates
              // at a split boundary and the element is SHARED with the previous
              // segment (same <video> DOM node), the element's currentTime is
              // already at (or very near) the correct position — it just played
              // up to the boundary. Issuing a hard seek here would cancel the
              // in-flight decode, trigger el.seeking=true, and trip the
              // buffering detector — causing a playback freeze at every cut.
              // Allow the PLL to handle drift < 0.15s smoothly instead.
              const isSharedElement = justActivated && playingIds.size > 0 && (() => {
                for (const prevId of lastActiveClipIdsRef.current) {
                  const prevEntry = pool.get(prevId);
                  if (prevEntry && prevEntry.el === el) return true;
                }
                return false;
              })();
                            const isAlreadyRolling = !el.paused && Math.abs(rawDrift) < VIDEO_HARD_SEEK_THRESHOLD;
              const isNearTarget = Math.abs(rawDrift) < 0.15;
              if (justActivated && (isAlreadyRolling || isNearTarget)) {
                // Crossing a cut seamlessly: already rolling or pre-rolled to target frame!
                // Do NOT issue a hard seek! Let PLL handle micro-drift (< 0.15s).
              } else {
                const effectiveThreshold = isSharedElement ? 0.35 : 0.15;
                if (Math.abs(rawDrift) > effectiveThreshold) {
                  el.currentTime = mediaTime;
                  pendingSeeksRef.current.delete(clip.clipId);
                  seekStartTimeRef.current.set(clip.clipId, performance.now());
                  (el as any)._seekStartTime = performance.now();
                }
              }
            } else if (Math.abs(rawDrift) > VIDEO_PLL_THRESHOLD) {
              // Smoothly modulate playback speed to catch up / slow down without stopping decoder
              let adjustment = rawDrift * 0.4;
              adjustment = Math.max(-VIDEO_MAX_PLL_ADJUST, Math.min(VIDEO_MAX_PLL_ADJUST, adjustment));
              const targetRate = Math.max(0.05, globalSpeed * currentSegmentSpeed * (1 - adjustment));
              if (Math.abs(el.playbackRate - targetRate) > 0.005) {
                el.playbackRate = targetRate;
              }
            } else {
              const nominalRate = Math.max(0.05, globalSpeed * currentSegmentSpeed);
              if (Math.abs(el.playbackRate - nominalRate) > 0.005) {
                el.playbackRate = nominalRate;
              }
            }

            if (!el.seeking && el.paused) {
              el.play().catch(() => {});
            }
          } else {
            if (!el.paused) el.pause();
            // When paused: exact seek for frame display
            if (!el.seeking && Math.abs(rawDrift) > 0.005) {
              el.currentTime = mediaTime;
              seekStartTimeRef.current.set(clip.clipId, performance.now());
            }
          }
        }
      }

      // ---- 2b. Buffering detection: freeze playhead when video decoders aren't ready ----
      // Check if any active VIDEO element is still seeking or has insufficient decoded
      // data. When buffering is detected, the tick loop in PreviewCanvasContainer freezes
      // the clock advance so the playhead doesn't race ahead of the decoders.
      // SPEED FRAME FIX: 2-tick hysteresis before raising the flag. isBuffering
      // lives in the container's useShallow bundle, so every flip re-renders the
      // whole container — during ramped playback the PLL-corrected seeks made it
      // flip-flicker every other tick (render storm competing with the decoders).
      // Two consecutive ticks (~33ms) filters transient seeks while the clock
      // advances at most one frame ahead — imperceptible.
      if (playing && !scrubbing) {
        let anyBuffering = false;
        const nowMs = performance.now();

        // MULTI-TRACK BUFFERING DECOUPLING:
        // Build a census of active video tracks and decoders.
        // If at least one active video track is rendering smoothly (readyState >= 2 and not seeking),
        // we DO NOT stall the master playhead just because a secondary track (V2/V3 overlay/PiP)
        // is decoding its initial keyframe.
        let healthyVideoCount = 0;
        let stalledVideoCount = 0;
        let primaryTrackStalled = false;

        const primaryVideoTrack = sortedTracksRef.current.find((t: any) => t.type === 'video' && !t.hidden);
        const primaryTrackId = primaryVideoTrack?.id;

        for (const clip of clips) {
          const entry = pool.get(clip.clipId);
          if (!entry || entry.type !== 'video') continue;
          // Reversed/freeze-frame clips are manually seeked each tick — they don't
          // buffer in the traditional sense, so skip them.
          if (clip.isReversed || clip.freezeFrame !== undefined) continue;
          const el = entry.el as HTMLVideoElement;

          // If this element is shared with another active clip (split sibling),
          // it's still decoding frames — don't treat it as buffering.
          let isSharedWithActive = false;
          for (const ac of clips) {
            if (ac.clipId === clip.clipId) continue;
            const ae = pool.get(ac.clipId);
            if (ae && ae.el === el) { isSharedWithActive = true; break; }
          }

          // Transition smoothing: If this clip is the incoming clip in an active transition
          // and the outgoing clip is healthy (playing smoothly), do not stall the playback clock.
          let isCoveredByTransition = false;
          if (!isSharedWithActive) {
            for (const track of sortedTracksRef.current) {
              if (track.type !== 'video') continue;
              const trans = findActiveTransition(track.clips, ct);
              if (trans && trans.to?.id === clip.clipId && trans.from) {
                const fromEntry = pool.get(trans.from.id);
                if (fromEntry && fromEntry.el && fromEntry.el.readyState >= 2 && !fromEntry.el.seeking) {
                  isCoveredByTransition = true;
                  break;
                }
              }
            }
          }

          if (isSharedWithActive || isCoveredByTransition) {
            healthyVideoCount++;
            continue;
          }

          // Zombie seek check: if element has been seeking for > 400ms without firing seeked,
          // suppress buffering for it so it cannot deadlock playback
          const seekStart = (el as any)._seekStartTime || seekStartTimeRef.current.get(clip.clipId);
          const isZombieSeek = el.seeking && seekStart !== undefined && (nowMs - seekStart > 400);

          if (!isZombieSeek && (el.seeking || (el.readyState < 2 && el.src !== ''))) {
            stalledVideoCount++;
            if (clip.trackId === primaryTrackId) {
              primaryTrackStalled = true;
            }
          } else {
            healthyVideoCount++;
          }
        }

        // Whole-timeline buffering is ONLY declared when:
        // 1. ALL active video tracks are stalled (zero healthy clips available to display), OR
        // 2. The primary base track (V1) is stalled AND there are no other healthy video tracks.
        if (stalledVideoCount > 0) {
          if (healthyVideoCount === 0 || (primaryTrackStalled && healthyVideoCount <= 0)) {
            anyBuffering = true;
          }
        }

        const wasBuffering = store.isBuffering;
        if (anyBuffering) {
          bufferingTickCount++;
          // Hysteresis (~330ms at 60fps): 20 consecutive ticks filter out transient seeking
          // without freezing playback or flashing spinners during normal keyframe decodes.
          if (!wasBuffering && bufferingTickCount >= 20) {
            // Local timeline playback: never freeze playhead or display spinner for local media seeks
            // store.setIsBuffering(true);
            playbackDiagnostics.recordIncident(
              'BUFFERING_STARTED',
              `Video decoder seeking or waiting for data over 20 consecutive frames at timeline ${ct.toFixed(2)}s`,
              { bufferingTickCount, currentTime: ct }
            );
          } else if (wasBuffering && bufferingTickCount === 120) {
            playbackDiagnostics.recordIncident(
              'SUSTAINED_BUFFERING',
              `Playback struggling / stalled for > 2 seconds waiting for video decoder at timeline ${ct.toFixed(2)}s`,
              { bufferingTickCount, currentTime: ct }
            );
          }
        } else {
          bufferingTickCount = 0;
          if (wasBuffering) {
            store.setIsBuffering(false);
            playbackDiagnostics.recordEvent('buffer', `Buffering resolved at ${ct.toFixed(2)}s`);
          }
        }
      } else if (store.isBuffering) {
        // Clear buffering when paused or scrubbing
        bufferingTickCount = 0;
        store.setIsBuffering(false);
      }

      // ---- 3. Pause inactive elements ----
      // SHARED ELEMENTS: several clip entries can reference the same <video>
      // (split segments of one media). An entry may leave the active set while
      // another clip on the SAME element is still active — never pause the
      // shared element in that case, or the still-playing segment would freeze
      // for the rest of the tick.
      // During transient buffering, do NOT pause video elements — the clock is already
      // frozen in PreviewCanvasContainer. Keeping elements unpaused lets their decoders
      // complete seeking and pre-buffering at full speed without interrupting pipeline.
      if (!playing) {
        for (const [, entry] of pool) {
          if (entry.el && !entry.el.paused) {
            try { entry.el.pause(); } catch {}
          }
        }
      } else {
        const playingEls = new Set<HTMLMediaElement>();
        for (const id of playingIds) {
          const e = pool.get(id);
          if (e) playingEls.add(e.el);
        }
        for (const [clipId, entry] of pool) {
          if (!playingIds.has(clipId)) {
            if (!playingEls.has(entry.el) && !entry.el.paused) entry.el.pause();
            pendingSeeksRef.current.delete(clipId);
          }
        }
      }

      // ── Transition Sound Playback ──────────────────────────────────────────
      if (playing && !scrubbing && !globalMuted) {
        for (const track of sortedTracksRef.current) {
          if (track.type === 'video' && !track.muted) {
            const active = findActiveTransition(track.clips, ct);
            if (active && active.transition) {
              const trans = active.transition;
              const norm = normalizeTransition(trans);
              if (norm.soundEffect && norm.soundEffect !== 'none') {
                const transKey = `${active.from?.id}_${active.to?.id}_${active.windowStart.toFixed(2)}`;
                if (!triggeredTransitionsRef.current.has(transKey)) {
                  if (ct >= active.windowStart && ct < active.windowEnd) {
                    triggeredTransitionsRef.current.add(transKey);
                    let customUrl: string | undefined;
                    if (norm.soundEffect.startsWith('media:')) {
                      const mId = norm.soundEffect.replace(/^media:/, '');
                      const mItem = mediaMap.get(mId);
                      if (mItem?.url) customUrl = mItem.url;
                    }
                    playTransitionSoundPreview(norm.soundEffect, norm.soundVolume, customUrl);
                  }
                }
              }
            }
          }
        }
      } else if (!playing) {
        triggeredTransitionsRef.current.clear();
      }

      lastActiveClipIdsRef.current = playingIds;
      rafIdRef.current = requestAnimationFrame(syncLoop);
    };

    rafIdRef.current = requestAnimationFrame(syncLoop);
    return () => {
      isRunning = false;
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, [isPrimary, getActiveClips]);

  // ============================================================
  // REACTIVE AUDIO PARAMETERS (Volume, EQ, FX, etc.)
  // Runs on parameter changes, NOT on every currentTime tick
  // ============================================================
  useEffect(() => {
    if (!isPrimary || isPreviewSuspendedForExport()) return;
    const pool = poolRef.current;
    const clips = getActiveClips();
    const playingIds = new Set(clips.map(c => c.clipId));
    const anyTrackSoloed = sortedTracksRef.current.some((t: any) => t.solo);

    // Build clip lookup map once
    const clipNodeMap = new Map<string, { clip: any; track: any; absStartTime: number }>();
    for (const track of sortedTracksRef.current) {
      for (const clip of track.clips) clipNodeMap.set(clip.id, { clip, track, absStartTime: clip.startTime });
      const pipWindows = useEditorStore.getState().pipWindows || {};
      for (const clip of track.clips) {
        const clipPips = Object.values(pipWindows).filter((p: any) => p.parentClipId === clip.id);
        for (const pip of clipPips) {
          for (const pipTrack of pip.tracks) {
            for (const pipClip of pipTrack.clips) {
              const absStartTime = clip.startTime + pip.relativeStartTime + pipClip.startTime;
              const mergedTrack = { ...pipTrack, muted: track.muted || pipTrack.muted || pipTrack.hidden };
              clipNodeMap.set(pipClip.id, { clip: pipClip, track: mergedTrack, absStartTime });
            }
          }
        }
      }
    }

    const ct = getPlaybackTime();

    for (const [clipId, entry] of pool) {
      if (!playingIds.has(clipId)) continue;
      const foundNode = clipNodeMap.get(clipId);
      if (!foundNode) continue;
      const { clip: fullClip, track: targetTrack, absStartTime } = foundNode;

      const audioSettings = fullClip.audioSettings || {
        volume: 0, pan: 0, fadeIn: 0, fadeOut: 0, bass: 0, treble: 0,
        muted: false, preservePitch: true, pitch: 0, voiceFormant: 0, humanize: false,
      };

      const clipStart = absStartTime;
      const animatedVolume = getAnimatedValue(audioSettings.volume, ct, clipStart, fullClip.animations?.['audio.volume']);
      const animatedPan = getAnimatedValue(audioSettings.pan, ct, clipStart, fullClip.animations?.['audio.pan']);

      const shouldPreserve = audioSettings.preservePitch !== false;
      if (entry.el.preservesPitch !== shouldPreserve) {
        entry.el.preservesPitch = shouldPreserve;
      }
      if ('webkitPreservesPitch' in entry.el && (entry.el as any).webkitPreservesPitch !== shouldPreserve) {
        (entry.el as any).webkitPreservesPitch = shouldPreserve;
      }
      if ('mozPreservesPitch' in entry.el && (entry.el as any).mozPreservesPitch !== shouldPreserve) {
        (entry.el as any).mozPreservesPitch = shouldPreserve;
      }

      const ctxTime = entry.audioCtx?.currentTime || 0;
      const hasVolumeAnim = Boolean(fullClip.animations?.['audio.volume']?.length);
      const rampTime = hasVolumeAnim ? 0.04 : 0.08;

      // Total vocal pitch: manual Pitch Shift + Vocal Tone + auto vocal-match
      // correction (see src/utils/vocalTone.ts).
      const totalPitchSt = effectiveVocalPitchSt(audioSettings);

      // Pitch / Humanize
      if (entry.pitchNode) {
        (entry.pitchNode as any).pitch = totalPitchSt;
        (entry.pitchNode as any).humanize = audioSettings.humanize;
      }

      // Separation Graph
      if (entry.separationGraph) {
        const sep = audioSettings.vocalSeparation || { enabled: false, mode: 'removeVocals', strength: 80 };
        const graph = entry.separationGraph;
        const S = sep.strength / 100;
        const updateGain = (node: GainNode, val: number) => {
          setAudioParam(node.gain, val, ctxTime, rampTime, 0.005);
        };

        if (sep.enabled) {
          updateGain(graph.bypassGain, 0.0);
          if (sep.mode === 'removeVocals') {
            updateGain(graph.lowGain, 1.0);
            updateGain(graph.highGain, 1.0);
            updateGain(graph.sideGain, 1.0);
            updateGain(graph.midOutputGain, 1.0 - S);
          } else if (sep.mode === 'removeBgm') {
            updateGain(graph.lowGain, 1.0 - S);
            updateGain(graph.highGain, 1.0 - S);
            updateGain(graph.sideGain, 1.0 - S);
            updateGain(graph.midOutputGain, 1.0);
          } else {
            const mix = 1.0 - S * 0.5;
            updateGain(graph.lowGain, 1.0);
            updateGain(graph.highGain, 1.0);
            updateGain(graph.sideGain, mix);
            updateGain(graph.midOutputGain, S);
          }
        } else {
          updateGain(graph.bypassGain, 1.0);
          updateGain(graph.lowGain, 0.0);
          updateGain(graph.highGain, 0.0);
          updateGain(graph.sideGain, 0.0);
          updateGain(graph.midOutputGain, 0.0);
        }
      }

      // FX Routing (lazy pitch node). The total pitch includes the manual
      // Pitch Shift + Vocal Tone + auto vocal-match correction, so the FX
      // graph engages whenever ANY of them is non-zero.
      const needsFx = Math.abs(totalPitchSt) > 0.01 || audioSettings.humanize;
      const audioCtxForFx = entry.audioCtx;
      if (needsFx && audioCtxForFx) {
        if (!entry.pitchNode) {
          const newPitchNode = createPitchNode(audioCtxForFx);
          entry.pitchNode = newPitchNode;
        }
        if (!entry._fxConnected && entry.sourceNode && entry.separationGraph) {
          entry.sourceNode.disconnect();
          entry.sourceNode.connect(entry.pitchNode);
          entry.pitchNode.connect(entry.separationGraph.input);
          entry._fxConnected = true;
        }
      } else if (!needsFx && entry._fxConnected && entry.sourceNode && entry.pitchNode && entry.separationGraph) {
        entry.sourceNode.disconnect();
        entry.pitchNode.disconnect();
        entry.sourceNode.connect(entry.separationGraph.input);
        entry._fxConnected = false;
      }

      // EQ & Filters — Multi-band formant compensation
      // When auto-match shifts pitch, the spectral envelope shifts too (chipmunk
      // effect). We compensate across three formant bands (F1/F2/F3) to preserve
      // the speaker's vocal character. Gain is 4x stronger than the old single-
      // band approach and distributed across the vocal frequency range.
      if (entry.vocalFilter) {
        const formantVal = effectiveVocalFormant(audioSettings);
        const baseGain = audioSettings.humanize ? -5.0 : formantVal * -0.12;
        // F2 (1500 Hz) gets the primary compensation
        setAudioParam(entry.vocalFilter.gain, baseGain, ctxTime, rampTime, 0.1);
      }
      if (entry.vocalFilterF1) {
        const formantVal = effectiveVocalFormant(audioSettings);
        const f1Gain = audioSettings.humanize ? -3.0 : formantVal * -0.08;
        setAudioParam(entry.vocalFilterF1.gain, f1Gain, ctxTime, rampTime, 0.1);
      }
      if (entry.vocalFilterF3) {
        const formantVal = effectiveVocalFormant(audioSettings);
        const f3Gain = audioSettings.humanize ? -2.5 : formantVal * -0.06;
        setAudioParam(entry.vocalFilterF3.gain, f3Gain, ctxTime, rampTime, 0.1);
      }
      if (entry.denoiseFilter) {
        const denoiseGain = -((audioSettings.denoise ?? 0) / 100) * 30;
        setAudioParam(entry.denoiseFilter.gain, denoiseGain, ctxTime, rampTime, 0.1);
      }
      if (entry.bassFilter) {
        const baseBass = (audioSettings.bass || 0) + (audioSettings.humanize ? 1.5 : 0);
        const targetBass = Math.max(-15, Math.min(15, baseBass));
        setAudioParam(entry.bassFilter.gain, targetBass, ctxTime, rampTime, 0.1);
      }
      if (entry.midFilter) {
        const targetMid = Math.max(-15, Math.min(15, audioSettings.mid ?? 0));
        setAudioParam(entry.midFilter.gain, targetMid, ctxTime, rampTime, 0.1);
      }
      if (entry.trebleFilter) {
        const baseTreble = (audioSettings.treble || 0) + (audioSettings.humanize ? 1.0 : 0);
        const targetTreble = Math.max(-15, Math.min(15, baseTreble));
        setAudioParam(entry.trebleFilter.gain, targetTreble, ctxTime, rampTime, 0.1);
      }
      if (entry.compressorNode) {
        const comp = (audioSettings.compression ?? 0) / 100;
        const targetThreshold = comp > 0 ? -24 * comp : 0;
        const targetRatio = 1 + 19 * comp;
        setAudioParam(entry.compressorNode.threshold, targetThreshold, ctxTime, rampTime, 0.5);
        setAudioParam(entry.compressorNode.ratio, targetRatio, ctxTime, rampTime, 0.5);
      }
      if (entry.deEsserFilter) {
        const targetDeEsserGain = -((audioSettings.deEsser ?? 0) / 100) * 18;
        setAudioParam(entry.deEsserFilter.gain, targetDeEsserGain, ctxTime, rampTime, 0.1);
      }
      if (entry.warmthFilter) {
        const targetWarmth = ((audioSettings.warmth ?? 0) / 100) * 6;
        setAudioParam(entry.warmthFilter.gain, targetWarmth, ctxTime, rampTime, 0.1);
      }

      // Panning
      if (entry.pannerNode) {
        const trackPan = targetTrack?.pan ?? 0;
        const combinedPan = (animatedPan / 100) + trackPan;
        const targetPan = Math.max(-1, Math.min(1, combinedPan));
        setAudioParam(entry.pannerNode.pan, targetPan, ctxTime, rampTime, 0.01);
      }

      // Room ambience gates
      if (entry.feedbackInputGain) {
        const targetInputGate = audioSettings.humanize ? 0.20 : 0.0;
        setAudioParam(entry.feedbackInputGain.gain, targetInputGate, ctxTime, rampTime, 0.01);
      }
      if (entry.delayGain) {
        const targetDelay = audioSettings.humanize ? 0.20 : 0.0;
        setAudioParam(entry.delayGain.gain, targetDelay, ctxTime, rampTime, 0.01);
      }

      // Reverb & Acoustic Environment DSP Control
      const reverb = audioSettings.reverb;
      const isReverbActive = Boolean(reverb?.enabled && (reverb.mix ?? 0) > 0);
      if (entry.reverbDryGain && entry.reverbWetGain) {
        const wetFrac = isReverbActive ? Math.max(0, Math.min(1, (reverb?.mix ?? 0) / 100)) : 0;
        // Equal-power crossfade curve: cos(w * pi/2) for dry, sin(w * pi/2) for wet
        const targetDry = isReverbActive ? Math.cos(wetFrac * Math.PI * 0.5) : 1.0;
        const targetWet = isReverbActive ? Math.sin(wetFrac * Math.PI * 0.5) : 0.0;
        setAudioParam(entry.reverbDryGain.gain, targetDry, ctxTime, rampTime, 0.01);
        setAudioParam(entry.reverbWetGain.gain, targetWet, ctxTime, rampTime, 0.01);

        if (isReverbActive && entry.convolverNode && entry.audioCtx) {
          const decay = reverb?.decay ?? 1.5;
          const damping = reverb?.damping ?? 40;
          const preDelay = reverb?.preDelay ?? 20;
          const roomSize = reverb?.roomSize ?? 50;
          const qKey = `${Math.round(decay * 10)}_${Math.round(damping / 5)}_${Math.round(preDelay / 5)}_${Math.round(roomSize / 10)}`;

          if (entry._lastReverbKey !== qKey) {
            entry._lastReverbKey = qKey;
            try {
              const impulseBuf = generateReverbImpulse(entry.audioCtx, decay, damping, preDelay, roomSize);
              entry.convolverNode.buffer = impulseBuf;
            } catch (err) {
              console.warn('[useMediaPlayback] Failed to set reverb buffer:', err);
            }
          }
        }

        if (entry.reverbPreFilter) {
          if (reverb?.preset === 'telephone') {
            entry.reverbPreFilter.type = 'bandpass';
            entry.reverbPreFilter.frequency.value = 1500;
            entry.reverbPreFilter.Q.value = 1.0;
          } else {
            entry.reverbPreFilter.type = 'allpass';
          }
        }
      }

      // Volume & Mute & Fades & Transitions
      const isMutedTrack = targetTrack ? (anyTrackSoloed ? !targetTrack.solo : targetTrack.muted) : false;
      const isMutedGlobally = isMutedTrack || isMuted || !!muteTimelineAudio;
      const globalMuted = isMutedGlobally || audioSettings.muted || fullClip.disabled;

      const clipElapsed = ct - fullClip.startTime;
      let fadeInMultiplier = 1;
      if (audioSettings.fadeIn > 0) fadeInMultiplier = Math.min(1, Math.max(0, clipElapsed / audioSettings.fadeIn));
      let fadeOutMultiplier = 1;
      if (audioSettings.fadeOut > 0) {
        const timeLeft = fullClip.duration - clipElapsed;
        fadeOutMultiplier = Math.min(1, Math.max(0, timeLeft / audioSettings.fadeOut));
      }

      // ── Transition audio cross-fade ──────────────────────────────────────
      // Delegated to the shared transition engine so the window maths matches the
      // renderer exactly, and using an EQUAL-POWER curve rather than the previous
      // linear ramp. Two linearly cross-faded uncorrelated sources lose ~3dB at
      // the midpoint, which is audible as a dip right at the cut.
      let transitionVolumeMultiplier = 1;
      let isTransitionMuted = false;

      const transTrack = targetTrack
        ? sortedTracksRef.current.find((t: any) => t.id === targetTrack.id)
        : null;

      if (transTrack) {
        const active = findActiveTransition(transTrack.clips, ct);
        if (active && ((active.from && active.from.id === clipId) || (active.to && active.to.id === clipId))) {
          const isOutgoing = active.from?.id === clipId;
          const other = isOutgoing ? active.to : active.from;

          // Special case: a transition placed on a SPLIT of one continuous source
          // (both sides share a mediaId and their media timelines are contiguous).
          // Cross-fading a source against itself causes comb filtering / flanging,
          // so we keep exactly one side audible and hard-mute the other.
          const sameSource = other && other.mediaId === fullClip.mediaId;
          let contiguous = false;
          if (sameSource && active.from && active.to) {
            const boundary = active.to.startTime;
            const fromMediaTime = getMediaTimeForClip(active.from, boundary);
            const toMediaTime = getMediaTimeForClip(active.to, boundary);
            contiguous = Math.abs(fromMediaTime - toMediaTime) < 0.1;
          }

          if (contiguous && active.to) {
            // Play whichever side owns the current time; mute the other.
            isTransitionMuted = isOutgoing ? ct >= active.to.startTime : ct < active.to.startTime;
          } else {
            const gains = getTransitionAudioGains(active.progress);
            transitionVolumeMultiplier = isOutgoing ? gains.fromGain : gains.toGain;
          }
        }
      }

      const linearGain = Math.pow(10, animatedVolume / 20);
      const trackVolume = targetTrack?.volume ?? 1;
      const finalVolume = (globalMuted || isTransitionMuted || !playingIds.has(clipId))
        ? 0
        : linearGain * volume * trackVolume * fadeInMultiplier * fadeOutMultiplier * transitionVolumeMultiplier;

      if (entry.gainNode) {
        setAudioParam(entry.gainNode.gain, finalVolume, ctxTime, rampTime, 0.005);
        if (entry.el.volume !== 1) entry.el.volume = 1;
        const shouldUnmute = isPlaying && !globalMuted;
        if (entry.el.muted !== !shouldUnmute) entry.el.muted = !shouldUnmute;
      } else {
        const shouldUnmuteBase = isPlaying && !globalMuted;
        if (entry.el.muted !== !shouldUnmuteBase) entry.el.muted = !shouldUnmuteBase;
        // HTMLMediaElement.volume only accepts [0, 1]; assigning anything else
        // throws IndexSizeError. The dB boost (linearGain > 1) is fine through
        // a GainNode but must be clamped on the raw element. Compare against
        // the clamped value so we don't rewrite it every tick.
        const elVolume = Number.isFinite(finalVolume) ? Math.max(0, Math.min(1, finalVolume)) : 1;
        if (entry.el.volume !== elVolume) entry.el.volume = elVolume;
      }
    }
    // PERF: keyed off `audioParamTime` (25 Hz) rather than raw `currentTime` (~33 Hz).
    // Fades, keyframed volume and transition ramps are applied through AudioParam.setTargetAtTime
    // (40ms time-constant for keyframed volume animations, 80ms for static fades) for instant, click-free response.
  }, [tracks, volume, isMuted, muteTimelineAudio, playbackSpeed, audioParamTime, isPlaying, mediaLibrary, isPrimary, previewSuspended]);

  // ---- Cleanup orphaned analysers ----
  useEffect(() => {
    if (!isPrimary) return;
    const activeTrackIds = new Set(sortedTracksRef.current.map((t: any) => t.id));
    for (const [trackId, analyser] of trackAnalysers.entries()) {
      if (!activeTrackIds.has(trackId)) {
        try { analyser.disconnect(); } catch (e) {}
        trackAnalysers.delete(trackId);
      }
    }
  }, [tracks, isPrimary]);

  // ---- Immediate pause sweep on isPlaying -> false transition ----
  useEffect(() => {
    if (!isPrimary) return;
    const unsub = useEditorStore.subscribe((state, previous) => {
      if (previous.isPlaying && !state.isPlaying) {
        const pool = poolRef.current;
        if (pool) {
          for (const [, entry] of pool) {
            if (entry.el && !entry.el.paused) {
              try { entry.el.pause(); } catch {}
            }
          }
        }
        const container = getMediaPoolContainer();
        if (container) {
          const els = container.querySelectorAll('audio, video');
          els.forEach((el) => {
            const m = el as HTMLMediaElement;
            if (!m.paused) {
              try { m.pause(); } catch {}
            }
          });
        }
      }
    });
    return unsub;
  }, [isPrimary]);

  // ---- Zustand subscription for paused seek (scrubbing) ----
  useEffect(() => {
    if (!isPrimary) return;
    // FIX 3 (Deferred Paused-Seek): track the latest RAF id for cleanup.
    let pausedSeekRafId: number | null = null;
    const unsub = useEditorStore.subscribe((state, previous) => {
      if (state.isPlaying || isPreviewSuspendedForExport()) return;
      // History, export UI and autosave notifications are not seek requests.
      // During a Speed Frame drag the trim clock is authoritative, just as it
      // is in the RAF loop; reading store.currentTime here fights that loop.
      if (state.currentTime === previous.currentTime && state.tracks === previous.tracks &&
          state.mediaLibrary === previous.mediaLibrary && state.pipWindows === previous.pipWindows &&
          state.isPlaying === previous.isPlaying) return;

      // FIX 3 (Deferred Paused-Seek with Pool-Ready Guard): Defer the seek
      // via requestAnimationFrame so it fires AFTER React's pool reconciliation
      // effect has committed. When a clip is moved while paused, this subscriber
      // fires synchronously during the store update — BEFORE the pool effect
      // allocates elements for the new clip positions. pool.get(clip.id) would
      // return undefined for the moved clip, silently skipping it and leaving
      // the preview showing a stale or black frame. Deferring by one frame
      // ensures the pool has reconciled.
      if (pausedSeekRafId !== null) cancelAnimationFrame(pausedSeekRafId);
      pausedSeekRafId = requestAnimationFrame(() => {
        pausedSeekRafId = null;
        if (useEditorStore.getState().isPlaying) return;
        const newTime = getEffectivePreviewTime();
        const pool = poolRef.current;
        if (!pool || pool.size === 0) return;

        const freshTracks = useEditorStore.getState().tracks;
        const freshMediaLibrary = useEditorStore.getState().mediaLibrary;
        const mediaMap = new Map<string, any>();
        for (const m of freshMediaLibrary) mediaMap.set(m.id, m);

        for (const track of freshTracks) {
          if (track.hidden) continue;
          for (const clip of track.clips) {
            const isVideo = track.type === 'video' || (clip as any).type === 'video';
            if (!isVideo) continue;
            if (newTime < clip.startTime || newTime >= clip.startTime + clip.duration) continue;

            const entry = pool.get(clip.id);
            if (!entry || entry.type !== 'video') {
              // Pool hasn't allocated an element yet — queue the seek target
              // so the pool effect's seeked handler will drain it when ready.
              const mediaItem = mediaMap.get(clip.mediaId);
              const maxDuration = mediaItem ? mediaItem.duration : 10000;
              const mediaTime = Math.max(0, Math.min(maxDuration, getMediaTimeForClip({
                id: clip.id,
                startTime: clip.startTime,
                duration: clip.duration,
                trimStart: (clip as any).trimStart ?? 0,
                speed: (clip as any).speed ?? 1,
                speedRamp: (clip as any).speedRamp,
                speedFrames: (clip as any).speedFrames,
                speedFrameSourceEnd: (clip as any).speedFrameSourceEnd,
                isReversed: (clip as any).isReversed,
                freezeFrame: (clip as any).freezeFrame,
              }, newTime)));
              pendingSeeksRef.current.set(clip.id, mediaTime);
              continue;
            }

            const el = entry.el as HTMLVideoElement;
            const mediaItem = mediaMap.get(clip.mediaId);
            const maxDuration = mediaItem ? mediaItem.duration : 10000;
            const mediaTime = Math.max(0, Math.min(maxDuration, getMediaTimeForClip({
              id: clip.id,
              startTime: clip.startTime,
              duration: clip.duration,
              trimStart: (clip as any).trimStart ?? 0,
              speed: (clip as any).speed ?? 1,
              speedRamp: (clip as any).speedRamp,
              speedFrames: (clip as any).speedFrames,
              speedFrameSourceEnd: (clip as any).speedFrameSourceEnd,
              isReversed: (clip as any).isReversed,
              freezeFrame: (clip as any).freezeFrame,
            }, newTime)));

            if (el.seeking) {
              pendingSeeksRef.current.set(clip.id, mediaTime);
            } else {
              const drift = Math.abs(el.currentTime - mediaTime);
              if (drift > 0.02) {
                // The entry's single permanent seeked handler drains the latest
                // pending target. Do not accumulate a new listener per edit.
                el.currentTime = mediaTime;
              }
            }
          }
        }
      });
    });
    return () => {
      unsub();
      if (pausedSeekRafId !== null) cancelAnimationFrame(pausedSeekRafId);
    };
  }, [isPrimary]);

  // ---- Visibility handling ----
  useEffect(() => {
    if (!isPrimary) return;
    const onVisibility = () => {
      const pool = poolRef.current;
      if (document.hidden) {
        for (const [, entry] of pool) {
          if (!entry.el.paused) entry.el.pause();
          const el = entry.el as any;
          if (entry._rvfcHandle != null && 'cancelVideoFrameCallback' in el) {
            try { el.cancelVideoFrameCallback(entry._rvfcHandle); } catch {}
            entry._rvfcHandle = null;
          }
        }
      } else {
        // Restart rvfc only for entries that registered it at creation (the
        // first clip on each shared element) — restarting for every entry
        // would stack duplicate callbacks on the same element.
        for (const [, entry] of pool) {
          if (entry.type === 'video' && entry._rvfcRegistered) {
            const el = entry.el as any;
            if ('requestVideoFrameCallback' in el) {
              const onVideoFrame = () => {
                if (!poolRef.current.has(entry.clipId)) return;
                triggerRedraw();
                entry._rvfcHandle = el.requestVideoFrameCallback(onVideoFrame);
              };
              entry._rvfcHandle = el.requestVideoFrameCallback(onVideoFrame);
            }
          }
        }
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [isPrimary, triggerRedraw]);

  // ---- Unmount cleanup ----
  // Registration/primacy bookkeeping (removing this instance from
  // activeControllers and promoting the next controller) is handled by the
  // registration effect's cleanup, which runs FIRST on unmount because it is
  // declared earlier. This effect only tears down the shared media pool when
  // no controllers remain anywhere in the app.
  useEffect(() => {
    return () => {
      if (isController) {
        // ONLY tear down the media pool if NO active controllers exist in the whole app!
        if (activeControllers.size === 0) {
          const pool = poolRef.current;
          for (const [, entry] of pool) {
            entry.el.pause();
            const el = entry.el as any;
            if (entry._handleSeeked) el.removeEventListener('seeked', entry._handleSeeked);
            if (entry.type === 'video') {
              el.removeEventListener('timeupdate', triggerRedraw);
              el.removeEventListener('canplay', triggerRedraw);
            }
            if (entry.separationGraph) { try { entry.separationGraph.input.disconnect(); } catch (e) {} }
            if (entry.pitchNode) { try { entry.pitchNode.disconnect(); } catch (e) {} }
            if (entry.gainNode) { try { entry.gainNode.disconnect(); } catch (e) {} }
            if (entry.sourceNode) { try { entry.sourceNode.disconnect(); } catch (e) {} }
            if (entry.feedbackNode) { try { entry.feedbackNode.disconnect(); } catch(e) {} }
            if (entry.delayNode) { try { entry.delayNode.disconnect(); } catch(e) {} }
            releaseMediaElement(el);
          }
          pool.clear();
          videoMapRef.current.clear();
          pendingSeeksRef.current.clear();
          mediaVideoEls.clear();
          mediaVideoRefCount.clear();
        }
      }
    };
  }, [triggerRedraw, instanceId, isController]);

  useEffect(() => {
    resultRef.current.videoElements = videoMapRef.current;
  }, [triggerRedraw]);

  return resultRef.current;
}

// ---------------------------------------------------------------------------
// synchronousSeek (Export helper)
// ---------------------------------------------------------------------------
export async function synchronousSeek(targetTime: number): Promise<void> {
  const store = useEditorStore.getState();
  store.seek(targetTime);
  const tracks = store.tracks || [];
  const promises: Promise<void>[] = [];

  for (const track of tracks) {
    if (track.hidden || track.type !== 'video') continue;
    for (const clip of (track.clips || [])) {
      if (targetTime >= clip.startTime && targetTime <= clip.startTime + clip.duration) {
        const v = globalVideoMap.get(clip.id);
        if (v && v.readyState >= 1) {
          const mediaTime = getMediaTimeForClip(clip, targetTime);
          if (Math.abs(v.currentTime - mediaTime) > 0.01 || v.seeking) {
            promises.push(
              new Promise<void>((resolve) => {
                const handler = () => {
                  v.removeEventListener('seeked', handler);
                  resolve();
                };
                v.addEventListener('seeked', handler, { once: true });
                v.currentTime = mediaTime;
                setTimeout(resolve, 200);
              })
            );
          }
        }
      }
    }
  }
  if (promises.length > 0) await Promise.all(promises);
}

// ---------------------------------------------------------------------------
// On-device media pool diagnostics (Android remote debugging)
// ---------------------------------------------------------------------------
export interface MediaPoolDebugEntry {
  clipId: string;
  type: 'video' | 'audio';
  srcScheme: string;
  srcLen: number;
  tagged: boolean;
  srcSet: boolean;
  readyState: number;
  videoWidth: number;
  videoHeight: number;
  paused: boolean;
  muted: boolean;
  seeking: boolean;
  currentTime: number;
  networkState: number;
  error: string | null;
  computedOpacity: string | null;
  inDOM: boolean;
}

export interface MediaPoolDebugSnapshot {
  device: { android: boolean; ios: boolean; coarse: boolean; maxLoadedVideos: number };
  /** Controller registry: if primary is null/-1 or active is empty, the pool
   * never starts — that was the root cause of the mobile "POOL EMPTY" state. */
  registry: { primaryControllerId: number | null; activeControllers: number[] };
  playing: boolean;
  scrubbing: boolean;
  time: number;
  poolSize: number;
  videoMapSize: number;
  entries: MediaPoolDebugEntry[];
}

/**
 * Snapshot of every pooled media element — designed to answer "why is the
 * canvas black on this phone?" from a single screenshot when opened with
 * `?mediadebug=1` (see MediaPoolDebugOverlay).
 */
export function getMediaPoolDebugSnapshot(): MediaPoolDebugSnapshot {
  const s = useEditorStore.getState();
  const entries: MediaPoolDebugEntry[] = [];
  for (const [clipId, entry] of globalMediaPool) {
    const el = entry.el;
    const err = el.error;
    const src = el.getAttribute('src') || '';
    entries.push({
      clipId,
      type: entry.type,
      srcScheme: src ? src.slice(0, src.indexOf(':') + 1) : '(none)',
      srcLen: src.length,
      tagged: !!(el as TaggedMediaElement)._procutClipSrcTag,
      srcSet: !!el.src,
      readyState: el.readyState,
      videoWidth: (el as HTMLVideoElement).videoWidth || 0,
      videoHeight: (el as HTMLVideoElement).videoHeight || 0,
      paused: el.paused,
      muted: el.muted,
      seeking: el.seeking,
      currentTime: +el.currentTime.toFixed(2),
      networkState: el.networkState,
      error: err ? `code=${err.code} ${err.message || ''}`.trim() : null,
      computedOpacity: (el as HTMLVideoElement).ownerDocument
        ? getComputedStyle(el).opacity
        : null,
      inDOM: document.contains(el),
    });
  }
  return {
    device: {
      android: isAndroidDevice(),
      ios: isIOSDevice(),
      coarse: isCoarsePointerDevice(),
      maxLoadedVideos: getMaxLoadedVideos(),
    },
    registry: {
      primaryControllerId,
      activeControllers: [...activeControllers],
    },
    playing: s.isPlaying,
    scrubbing: s.isScrubbing,
    time: +getPlaybackTime().toFixed(2),
    poolSize: globalMediaPool.size,
    videoMapSize: globalVideoMap.size,
    entries,
  };
}

export interface PlaybackDecoderDetail {
  clipId: string;
  mediaId: string;
  type: 'video' | 'audio';
  shareKey?: string;
  readyState: number;
  readyStateText: string;
  seeking: boolean;
  paused: boolean;
  currentTime: number;
  playbackRate: number;
  networkState: number;
  networkStateText: string;
  videoWidth: number;
  videoHeight: number;
  bufferedRanges: { start: number; end: number }[];
  error: string | null;
  inDOM: boolean;
  hasAudioGraph: boolean;
}

export function getPlaybackDecodersDetail(): PlaybackDecoderDetail[] {
  const READY_STATE_NAMES = ['HAVE_NOTHING', 'HAVE_METADATA', 'HAVE_CURRENT_DATA', 'HAVE_FUTURE_DATA', 'HAVE_ENOUGH_DATA'];
  const NETWORK_STATE_NAMES = ['NETWORK_EMPTY', 'NETWORK_IDLE', 'NETWORK_LOADING', 'NETWORK_NO_SOURCE'];
  const result: PlaybackDecoderDetail[] = [];
  for (const [clipId, entry] of globalMediaPool) {
    const el = entry.el;
    const ranges: { start: number; end: number }[] = [];
    try {
      if (el && el.buffered) {
        for (let i = 0; i < el.buffered.length; i++) {
          ranges.push({
            start: +el.buffered.start(i).toFixed(3),
            end: +el.buffered.end(i).toFixed(3),
          });
        }
      }
    } catch {
      /* ignore */
    }

    result.push({
      clipId,
      mediaId: entry.mediaId,
      type: entry.type,
      shareKey: entry._shareKey,
      readyState: el ? el.readyState : 0,
      readyStateText: el ? (READY_STATE_NAMES[el.readyState] || `UNKNOWN(${el.readyState})`) : 'NO_ELEMENT',
      seeking: el ? el.seeking : false,
      paused: el ? el.paused : true,
      currentTime: el ? +el.currentTime.toFixed(3) : 0,
      playbackRate: el ? el.playbackRate : 1,
      networkState: el ? el.networkState : 0,
      networkStateText: el ? (NETWORK_STATE_NAMES[el.networkState] || `UNKNOWN(${el.networkState})`) : 'NO_ELEMENT',
      videoWidth: (el as HTMLVideoElement)?.videoWidth || 0,
      videoHeight: (el as HTMLVideoElement)?.videoHeight || 0,
      bufferedRanges: ranges,
      error: el?.error ? `code=${el.error.code} ${el.error.message || ''}`.trim() : null,
      inDOM: el ? document.contains(el) : false,
      hasAudioGraph: !!entry._isGraphConnected,
    });
  }
  return result;
}

playbackDiagnostics.registerDecodersDetailProvider(getPlaybackDecodersDetail);

// ---------------------------------------------------------------------------
// getLiveAudioStream
// ---------------------------------------------------------------------------
export async function getLiveAudioStream(): Promise<MediaStream | null> {
  if (typeof window !== 'undefined') getMasterAudioCtx();
  const master = useEditorStore.getState().masterAudioStream || (masterAudioDestination ? masterAudioDestination.stream : null);
  if (!master || master.getAudioTracks().length === 0) return null;
  return master.clone();
}

/**
 * Gesture-bound media unlock for mobile browsers.
 *
 * Despite the legacy name this now covers Android as well as iOS. Mobile Chrome
 * requires (a) a user gesture before any audible play(), (b) a gesture to wake
 * the hardware decoder pipeline for freshly created <video> elements, and
 * (c) a gesture to resume a suspended AudioContext. MobileApp / the transport
 * Play button call this synchronously inside the tap handler. On desktop it is
 * a no-op, preserving existing PC behaviour exactly.
 */
export function unlockiOSVideoPlay() {
  if (!isMobileDevice()) return;
  try {
    const ctx = getMasterAudioCtx();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    for (const el of globalVideoMap.values()) {
      if (el.paused) {
        const prevMuted = el.muted;
        el.muted = true; // muted play() is gesture-safe on Android + iOS
        const p = el.play();
        if (p !== undefined) {
          p.then(() => {
            el.pause();
            el.muted = prevMuted;
          }).catch(() => {
            el.muted = prevMuted;
          });
        } else {
          el.muted = prevMuted;
        }
      }
    }
  } catch {
    // Never let an unlock attempt break the UI gesture that triggered it.
  }
}

/** Clearer alias for new call sites. Same generalized unlock. */
export const unlockMobileMediaPlayback = unlockiOSVideoPlay;

