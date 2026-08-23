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
import { useEditorStore } from '@/store/editorStore';
import { getMediaTimeForClip, getSpeedAtPosition } from '@/utils/speedRamp';
import { getAnimatedValue } from '@/utils/keyframes';
import { resolveMediaFile } from '@/utils/mediaFileHandle';
import { usePlaybackTime, useTimeBucket } from './usePlaybackTime';
import { getPlaybackTime } from '@/utils/playbackClock';
import { findActiveTransition, getTransitionAudioGains } from '@/utils/transitionEngine';
import { getMediaPoolContainer, attachInvisibleMediaElement } from '@/utils/mediaPoolContainer';

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
  audioCtx?: AudioContext;
  sourceNode?: MediaElementAudioSourceNode;
  pitchNode?: ScriptProcessorNode;
  vocalFilter?: BiquadFilterNode;
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
    cachedMaxLoadedVideos = isAndroidDevice() || isIOSDevice() ? 2 : 4;
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

type TaggedMediaElement = HTMLMediaElement & { _procutClipSrcTag?: string | null };

/**
 * Assign `el.src` for a clip only when it actually changed (tracked via an
 * element-level tag, NOT by comparing against the resolved `el.src` string).
 * Returns true when a new src was assigned — the caller should el.load().
 */
export function assignClipMediaSrc(
  el: TaggedMediaElement,
  clipId: string,
  url: string
): boolean {
  const src = mediaSrcFor(url, clipId);
  const tag = `${clipId}|${src}`;
  if (el._procutClipSrcTag === tag) return false;
  el._procutClipSrcTag = tag;
  el.src = src;
  return true;
}

/** Fully clears a pooled element's source AND its dedupe tag. */
export function clearClipMediaSrc(el: TaggedMediaElement): void {
  el._procutClipSrcTag = null;
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

  const grainSize = 1024;
  const overlap = grainSize / 2;
  const bufferLen = 65536;
  const writeBufL = new Float32Array(bufferLen);
  const writeBufR = new Float32Array(bufferLen);
  let writePos = 0;
  let readPosA = 0;
  let readPosB = overlap;
  let grainCounterA = 0;
  let grainCounterB = overlap;

  const hannWindow = new Float32Array(grainSize);
  for (let i = 0; i < grainSize; i++) {
    hannWindow[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / grainSize));
  }

  pitchNode.onaudioprocess = (e) => {
    const inputL = e.inputBuffer.getChannelData(0);
    const inputR = e.inputBuffer.getChannelData(1);
    const outputL = e.outputBuffer.getChannelData(0);
    const outputR = e.outputBuffer.getChannelData(1);

    const pitch = (pitchNode as any).pitch || 0;
    const isHumanize = (pitchNode as any).humanize || false;
    let jitter = 0;
    if (isHumanize) {
      const time = e.playbackTime || (Date.now() / 1000);
      jitter = Math.sin(time * 2 * Math.PI * 5.5) * 0.06;
    }

    const semitones = pitch + jitter;
    if (Math.abs(semitones) < 0.01) {
      outputL.set(inputL);
      outputR.set(inputR);
      return;
    }

    const ratio = Math.pow(2, semitones / 12);
    for (let i = 0; i < inputL.length; i++) {
      writeBufL[writePos] = inputL[i];
      writeBufR[writePos] = inputR[i];

      const winA = hannWindow[grainCounterA % grainSize];
      const rA = readPosA;
      const iA0 = ((Math.floor(rA) - 1) + bufferLen) % bufferLen;
      const iA1 = Math.floor(rA) % bufferLen;
      const iA2 = (iA1 + 1) % bufferLen;
      const iA3 = (iA1 + 2) % bufferLen;
      const fA = rA - Math.floor(rA);
      const cubicL_A = cubicInterp(writeBufL[iA0], writeBufL[iA1], writeBufL[iA2], writeBufL[iA3], fA);
      const cubicR_A = cubicInterp(writeBufR[iA0], writeBufR[iA1], writeBufR[iA2], writeBufR[iA3], fA);

      const winB = hannWindow[grainCounterB % grainSize];
      const rB = readPosB;
      const iB0 = ((Math.floor(rB) - 1) + bufferLen) % bufferLen;
      const iB1 = Math.floor(rB) % bufferLen;
      const iB2 = (iB1 + 1) % bufferLen;
      const iB3 = (iB1 + 2) % bufferLen;
      const fB = rB - Math.floor(rB);
      const cubicL_B = cubicInterp(writeBufL[iB0], writeBufL[iB1], writeBufL[iB2], writeBufL[iB3], fB);
      const cubicR_B = cubicInterp(writeBufR[iB0], writeBufR[iB1], writeBufR[iB2], writeBufR[iB3], fB);

      outputL[i] = cubicL_A * winA + cubicL_B * winB;
      outputR[i] = cubicR_A * winA + cubicR_B * winB;

      writePos = (writePos + 1) % bufferLen;
      readPosA = (readPosA + ratio + bufferLen) % bufferLen;
      readPosB = (readPosB + ratio + bufferLen) % bufferLen;
      grainCounterA++;
      grainCounterB++;

      if (grainCounterA >= grainSize) {
        grainCounterA = 0;
        const pseudoRandom = ((writePos * 1103515245 + 12345) % 2147483648) / 2147483648;
        const jitterSamples = Math.floor((pseudoRandom - 0.5) * 180);
        readPosA = (writePos - grainSize + jitterSamples + bufferLen) % bufferLen;
      }
      if (grainCounterB >= grainSize) {
        grainCounterB = 0;
        const pseudoRandom = ((writePos * 1103515245 + 12345) % 2147483648) / 2147483648;
        const jitterSamples = Math.floor((pseudoRandom - 0.5) * 180);
        readPosB = (writePos - grainSize + jitterSamples + bufferLen) % bufferLen;
      }
    }
  };
  return pitchNode;
}

function initAudioGraph(entry: MediaElement) {
  const audioCtx = getMasterAudioCtx();
  if (!audioCtx) return;
  try {
    const sourceNode = audioCtx.createMediaElementSource(entry.el);

    const vocalFilter = audioCtx.createBiquadFilter();
    vocalFilter.type = 'peaking';
    vocalFilter.frequency.value = 1500;
    vocalFilter.Q.value = 1.0;
    vocalFilter.gain.value = 0;

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
    separationGraph.output.connect(vocalFilter);
    vocalFilter.connect(denoiseFilter);
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

    if (pannerNode) {
      warmthFilter.connect(pannerNode);
      delayGain.connect(pannerNode);
      pannerNode.connect(gainNode);
    } else {
      warmthFilter.connect(gainNode);
      delayGain.connect(gainNode);
    }

    entry.audioCtx = audioCtx;
    entry.sourceNode = sourceNode;
    entry.vocalFilter = vocalFilter;
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

  // Throttled time for the reactive audio-parameter effect (see below). Exact values
  // are always read via useEditorStore.getState() inside the effect body.
  const audioParamTime = usePlaybackTime(10);

  const pendingSeeksRef = useRef<Map<string, number>>(new Map());
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
    const ct = getPlaybackTime();
    const result: ActiveClipInfo[] = [];
    const added = new Set<string>();
    const pipWindows = useEditorStore.getState().pipWindows || {};

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
        const clipPips = Object.values(pipWindows).filter((p: any) => p.parentClipId === clip.id);
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

      // Transitions: keep BOTH clips of an active transition alive so the
      // outgoing clip's video element continues decoding and its audio keeps
      // playing while it fades out. Delegated to the shared transition engine so
      // the window maths can never drift from what the renderer composites — a
      // mismatch here shows up as the outgoing clip freezing or going silent
      // partway through the blend.
      const activeTransition = findActiveTransition(track.clips, ct);
      if (activeTransition) {
        addIfNew(activeTransition.from, track, activeTransition.from.startTime);
        addIfNew(activeTransition.to, track, activeTransition.to.startTime);
      }
    }
    return result;
  }, []);

  // ---- Pool management (create/remove elements) ----
  const VIDEO_PROXIMITY_WINDOW = 5;
  const AUDIO_PROXIMITY_WINDOW = 15;
  const MAX_GLOBAL_FRAME_CACHE = 30;

  useEffect(() => {
    if (!isPrimary) return;
    const ct = getPlaybackTime();
    const neededClips = new Map<string, { mediaId: string; type: 'video' | 'audio' }>();
    const pipWindows = useEditorStore.getState().pipWindows || {};

    for (const track of sortedTracksRef.current) {
      if (track.hidden) continue;
      for (const clip of track.clips) {
        const media = mediaMapRef.current.get(clip.mediaId);
        if (media && media.url && (media.type === 'video' || media.type === 'audio')) {
          const prox = media.type === 'video' ? VIDEO_PROXIMITY_WINDOW : AUDIO_PROXIMITY_WINDOW;
          if (ct >= clip.startTime - prox && ct < clip.startTime + clip.duration + prox) {
            neededClips.set(clip.id, { mediaId: clip.mediaId, type: media.type });
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
                if (ct >= absStart - prox && ct < absStart + pipClip.duration + prox) {
                  neededClips.set(pipClip.id, { mediaId: pipClip.mediaId, type: pipMedia.type });
                }
              }
            }
          }
        }
      }
    }

    const pool = poolRef.current;
    const videoMap = videoMapRef.current;

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
            const el = document.createElement('video');
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

        const handleSeeked = () => {
          triggerRedraw();
          const pendingTime = pendingSeeksRef.current.get(clipId);
          if (pendingTime !== undefined) {
            pendingSeeksRef.current.delete(clipId);
            el.currentTime = pendingTime;
          }
        };
        (el as any)._handleSeeked = handleSeeked;
        el.addEventListener('seeked', handleSeeked);
        el.addEventListener('timeupdate', triggerRedraw);
        el.addEventListener('canplay', triggerRedraw);
        // Repaint as soon as the first decodable frame / metadata arrives so the
        // paused preview shows frame 0 without waiting for a seek.
        el.addEventListener('loadedmetadata', triggerRedraw);
        el.addEventListener('loadeddata', triggerRedraw);

        // ANDROID RECOVERY: a video load that errors or stalls (decoder
        // contention is common on phones) must not stay black forever — the
        // src loader only ever assigns src once, so without this retry the clip
        // would never render. Bounded, backoff-spaced, and only while the clip
        // is still needed.
        let mediaRetryCount = 0;
        const retryMediaLoad = () => {
          if (!poolRef.current.has(clipId)) return;
          if (!el.src || el.src === '') return;
          if (el.readyState >= 1) return;
          if (mediaRetryCount >= 3) return;
          mediaRetryCount++;
          const delay = 400 * mediaRetryCount;
          setTimeout(() => {
            if (!poolRef.current.has(clipId)) return;
            if (el.readyState >= 1) return;
            try { el.load(); } catch { /* element gone */ }
          }, delay);
        };
        (el as HTMLVideoElement & { _mediaRetryLoad?: () => void })._mediaRetryLoad = retryMediaLoad;
        el.addEventListener('error', retryMediaLoad);
        el.addEventListener('stalled', retryMediaLoad);

        if ('requestVideoFrameCallback' in el) {
          const onVideoFrame = () => {
            if (!poolRef.current.has(clipId)) return;
            triggerRedraw();
            (el as any)._rvfcHandle = (el as any).requestVideoFrameCallback(onVideoFrame);
          };
          (el as any)._rvfcHandle = (el as any).requestVideoFrameCallback(onVideoFrame);

          const onVisibilityChange = () => {
            if (!document.hidden && poolRef.current.has(clipId)) {
              requestAnimationFrame(() => {
                triggerRedraw();
                if ((el as any)._rvfcHandle != null && 'cancelVideoFrameCallback' in el) {
                  (el as any).cancelVideoFrameCallback((el as any)._rvfcHandle);
                }
                (el as any)._rvfcHandle = (el as any).requestVideoFrameCallback(onVideoFrame);
              });
            }
          };
          document.addEventListener('visibilitychange', onVisibilityChange);
          (el as any)._onVisibilityChange = onVisibilityChange;
        }

        // NOTE: element is already attached by attachInvisibleMediaElement() —
        // must stay inside the painted pool container or Android stops decoding.
        const entry: MediaElement = { el, clipId, mediaId: info.mediaId, type: 'video' };
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
          if (useEditorStore.getState().isPlaying) {
            pendingSeeksRef.current.delete(clipId);
            return;
          }
          const pendingTime = pendingSeeksRef.current.get(clipId);
          if (pendingTime !== undefined) {
            pendingSeeksRef.current.delete(clipId);
            el.currentTime = pendingTime;
          }
        };
        (el as any)._handleSeeked = handleSeeked;
        el.addEventListener('seeked', handleSeeked);
        getMediaPoolContainer().appendChild(el);
        el.load();

        const entry: MediaElement = { el, clipId, mediaId: info.mediaId, type: 'audio' };
        pool.set(clipId, entry);
      }
    }

    for (const [clipId, entry] of pool) {
      if (!neededClips.has(clipId)) {
        entry.el.pause();
        const el = entry.el as any;
        if (el._handleSeeked) el.removeEventListener('seeked', el._handleSeeked);
        if (entry.type === 'video') {
          el.removeEventListener('timeupdate', triggerRedraw);
          el.removeEventListener('canplay', triggerRedraw);
          el.removeEventListener('loadedmetadata', triggerRedraw);
          el.removeEventListener('loadeddata', triggerRedraw);
          if (el._mediaRetryLoad) {
            el.removeEventListener('error', el._mediaRetryLoad);
            el.removeEventListener('stalled', el._mediaRetryLoad);
            el._mediaRetryLoad = null;
          }
          if (el._rvfcHandle != null && 'cancelVideoFrameCallback' in el) {
            el.cancelVideoFrameCallback(el._rvfcHandle);
            el._rvfcHandle = null;
          }
          if (el._onVisibilityChange) {
            document.removeEventListener('visibilitychange', el._onVisibilityChange);
            el._onVisibilityChange = null;
          }
        }
        if (entry.separationGraph) { try { entry.separationGraph.input.disconnect(); } catch (e) {} }
        if (entry.pitchNode) { try { entry.pitchNode.disconnect(); } catch (e) {} }
        if (entry.gainNode) { try { entry.gainNode.disconnect(); } catch (e) {} }
        if (entry.sourceNode) { try { entry.sourceNode.disconnect(); } catch (e) {} }
        if (entry.feedbackNode) { try { entry.feedbackNode.disconnect(); } catch(e) {} }
        if (entry.delayNode) { try { entry.delayNode.disconnect(); } catch(e) {} }

        entry.el.src = '';
        entry.el.remove();
        pool.delete(clipId);
        videoMap.delete(clipId);
        pendingSeeksRef.current.delete(clipId);
      }
    }
  }, [tracks, mediaLibrary, ctBucket, triggerRedraw, isPrimary]);

  // ---- Proximity source loader ----
  useEffect(() => {
    if (!isPrimary) return;
    const pool = poolRef.current;
    if (isExporting) {
      for (const [clipId, entry] of pool) {
        if (entry.type !== 'video') continue;
        const el = entry.el as HTMLVideoElement;
        const media = mediaMapRef.current.get(entry.mediaId);
        if (!media || !media.url || media.url === 'PENDING_RESTORE') continue;
        const targetSrc = media.url;
        if (assignClipMediaSrc(el as TaggedMediaElement, clipId, targetSrc)) {
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

    let loadedCount = 0;
    for (const ve of videoEntries) {
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
        if (targetSrc === 'PENDING_RESTORE' || !targetSrc) {
          resolveMediaFile(ve.entry.mediaId)
            .then((file) => (file ? URL.createObjectURL(file) : null))
            .then((restoredUrl) => {
              if (!restoredUrl) return;
              if (assignClipMediaSrc(el as TaggedMediaElement, ve.clipId, restoredUrl)) {
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
          if (assignClipMediaSrc(el as TaggedMediaElement, ve.clipId, targetSrc)) {
            const pendingTime = pendingSeeksRef.current.get(ve.clipId);
            if (pendingTime !== undefined) {
              el.currentTime = pendingTime;
              pendingSeeksRef.current.delete(ve.clipId);
            }
            el.load();
          }
        }
        loadedCount++;
      } else {
        // ANDROID FIX: clear via the tag-aware helper so the dedupe state is
        // reset alongside the src (plain removeAttribute would leave the tag
        // claiming the src is still assigned).
        if (el.src !== '' || (el as TaggedMediaElement)._procutClipSrcTag) {
          clearClipMediaSrc(el as TaggedMediaElement);
        }
      }
    }
  }, [ctBucket, tracks, mediaLibrary, isExporting, isPrimary]);

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

    const syncLoop = () => {
      if (!isRunning) return;

      const now = performance.now();

      // MOBILE PERF: skip sync ticks on mobile to free main thread for rendering
      if (isMobileSyncThrottle && (now - lastSyncLoopTime) < MOBILE_SYNC_INTERVAL) {
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
      const ct = getPlaybackTime();
      const playing = store.isPlaying;
      const scrubbing = store.isScrubbing;
      const globalSpeed = store.playbackSpeed;
      const globalMuted = store.isMuted || !!store.muteTimelineAudio;
      const direction = store.playbackDirection ?? 1;
      const isReversing = direction < 0;

      const pool = poolRef.current;

      // PERF + BUG FIX: Cache active clips list with loop/seek-backward detection.
      // Bug: when playback loops (t=30 → t=0), nextClipBoundaryRef was still > 0, so
      // `ct >= nextClipBoundary` was false and stale end-of-timeline clips were returned.
      // Video elements saw their clipIds as still "active" (justActivated=false), skipping
      // the hard seek that would reset them to t=0. Result: frozen/lagging second playback.
      const storeTracks = store.tracks;
      const tracksChanged = storeTracks !== lastCachedStoreTracksRef.current;
      const timeWentBackward = ct < prevSyncCtRef.current - 0.5; // loop or seek-to-start
      prevSyncCtRef.current = ct;

      if (tracksChanged || ct >= nextClipBoundaryRef.current || timeWentBackward) {
        if (timeWentBackward) {
          // Reset boundary so next tick also recomputes (handles clips starting at t=0)
          nextClipBoundaryRef.current = 0;
          // Clear lastActiveClipIds so ALL clips at the new position are treated as
          // freshly activated, triggering hard seeks to their correct start positions.
          lastActiveClipIdsRef.current = new Set();
        }
        cachedActiveClipsRef.current = getActiveClips();
        lastCachedStoreTracksRef.current = storeTracks;

        if (!timeWentBackward) {
          // Compute next boundary: min(clip starts > ct, clip ends > ct)
          let nextBoundary = Infinity;
          for (const track of sortedTracksRef.current) {
            for (const clip of track.clips) {
              const clipEnd = clip.startTime + clip.duration;
              if (clip.startTime > ct && clip.startTime < nextBoundary) nextBoundary = clip.startTime;
              if (clipEnd > ct && clipEnd < nextBoundary) nextBoundary = clipEnd;
            }
          }
          nextClipBoundaryRef.current = nextBoundary;
        }
      }
      const clips = cachedActiveClipsRef.current;
      // PERF: Reuse a persistent Set instead of `new Set(clips.map(...))` every frame.
      // That pattern creates 2 heap objects (Array + Set) at 60fps = 7200 GC-eligible objects/min.
      const playingIds = playingIdsSetRef.current;
      playingIds.clear();
      for (const c of clips) playingIds.add(c.clipId);
      const mediaMap = mediaMapRef.current;

      // ---- 1. Scrubbing: pause everything ----
      if (scrubbing) {
        for (const [, entry] of pool) {
          if (!entry.el.paused) entry.el.pause();
        }
        lastActiveClipIdsRef.current = playingIds;
        rafIdRef.current = requestAnimationFrame(syncLoop);
        return;
      }

      // ---- 2. Sync each active element ----
      for (const clip of clips) {
        const entry = pool.get(clip.clipId);
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
        }, ct)));

        const el = entry.el;
        const currentMediaTime = el.currentTime;
        const rawDrift = currentMediaTime - mediaTime; // positive = ahead
        const justActivated = !lastActiveClipIdsRef.current.has(clip.clipId);

        // Lazy init audio graph
        if (entry.type === 'audio' && !entry.sourceNode) {
          initAudioGraph(entry);
        }
        if (playing && !entry._isGraphConnected && entry.gainNode) {
          connectAudioNode(entry);
        } else if (!playing && entry._isGraphConnected) {
          disconnectAudioNode(entry);
        }

        // ---- AUDIO SYNC STRATEGY (Gentle) ----
        if (entry.type === 'audio') {
          const AUDIO_HARD_SEEK_THRESHOLD = 0.5;   // 500ms
          const AUDIO_PLL_THRESHOLD = 0.10;        // 100ms
          const AUDIO_MAX_PLL_ADJUST = 0.005;      // 0.5%
          const AUDIO_PLL_P = 0.15;                // Proportional gain
          const AUDIO_PLL_I = 0.02;                // Integral gain

          if (playing && !isReversing) {
            // Immediate resume if suspended (no requestIdleCallback delay!)
            if (entry.audioCtx && entry.audioCtx.state === 'suspended') {
              entry.audioCtx.resume().catch(() => {});
            }

            if (justActivated || Math.abs(rawDrift) > AUDIO_HARD_SEEK_THRESHOLD) {
              // Hard seek only on activation or massive drift
              if (!el.seeking) {
                el.currentTime = mediaTime;
                pendingSeeksRef.current.delete(clip.clipId);
                accumulatedDriftAudio = 0; // Reset integral
              }
            } else if (Math.abs(rawDrift) > AUDIO_PLL_THRESHOLD) {
              // Gentle PLL: tiny playbackRate adjustments
              accumulatedDriftAudio += rawDrift * dt;
              let adjustment = (rawDrift * AUDIO_PLL_P) + (accumulatedDriftAudio * AUDIO_PLL_I);
              adjustment = Math.max(-AUDIO_MAX_PLL_ADJUST, Math.min(AUDIO_MAX_PLL_ADJUST, adjustment));
              const targetRate = Math.max(0.95, Math.min(1.05, globalSpeed * clip.speed * (1 - adjustment)));
              if (Math.abs(el.playbackRate - targetRate) > 0.001) {
                el.playbackRate = targetRate;
              }
            } else {
              // Within threshold: return to nominal speed
              accumulatedDriftAudio *= 0.9; // decay integral
              const nominalRate = globalSpeed * clip.speed;
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
          const VIDEO_HARD_SEEK_THRESHOLD = 0.45;  // 450ms (prevents false-alarm seeks during decode)
          const VIDEO_PLL_THRESHOLD = 0.025;       // 25ms
          const VIDEO_MAX_PLL_ADJUST = 0.10;       // 10% dynamic playback rate modulation

          if (playing && !isReversing) {
            if (justActivated || Math.abs(rawDrift) > VIDEO_HARD_SEEK_THRESHOLD) {
              if (!el.seeking) {
                el.currentTime = mediaTime;
                pendingSeeksRef.current.delete(clip.clipId);
              }
            } else if (Math.abs(rawDrift) > VIDEO_PLL_THRESHOLD) {
              // Smoothly modulate playback speed to catch up / slow down without stopping decoder
              let adjustment = rawDrift * 0.4;
              adjustment = Math.max(-VIDEO_MAX_PLL_ADJUST, Math.min(VIDEO_MAX_PLL_ADJUST, adjustment));
              const targetRate = Math.max(0.1, globalSpeed * clip.speed * (1 - adjustment));
              if (Math.abs(el.playbackRate - targetRate) > 0.005) {
                el.playbackRate = targetRate;
              }
            } else {
              const nominalRate = Math.max(0.1, globalSpeed * clip.speed);
              if (Math.abs(el.playbackRate - nominalRate) > 0.005) {
                el.playbackRate = nominalRate;
              }
            }

            if (el.paused) {
              el.play().catch(() => {});
            }
          } else {
            if (!el.paused) el.pause();
            // When paused: exact seek for frame display
            if (!el.seeking && Math.abs(rawDrift) > 0.005) {
              el.currentTime = mediaTime;
            }
          }
        }
      }

      // ---- 3. Pause inactive elements ----
      for (const [clipId, entry] of pool) {
        if (!playingIds.has(clipId)) {
          if (!entry.el.paused) entry.el.pause();
          pendingSeeksRef.current.delete(clipId);
        }
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
    if (!isPrimary) return;
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

      if (entry.el.preservesPitch !== audioSettings.preservePitch) {
        entry.el.preservesPitch = audioSettings.preservePitch;
      }

      const ctxTime = entry.audioCtx?.currentTime || 0;
      const rampTime = 0.08;

      // Pitch / Humanize
      if (entry.pitchNode) {
        (entry.pitchNode as any).pitch = audioSettings.pitch;
        (entry.pitchNode as any).humanize = audioSettings.humanize;
      }

      // Separation Graph
      if (entry.separationGraph) {
        const sep = audioSettings.vocalSeparation || { enabled: false, mode: 'removeVocals', strength: 80 };
        const graph = entry.separationGraph;
        const S = sep.strength / 100;
        const updateGain = (node: GainNode, val: number) => {
          if (Math.abs(node.gain.value - val) > 0.005) node.gain.setTargetAtTime(val, ctxTime, rampTime);
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

      // FX Routing (lazy pitch node)
      const needsFx = Math.abs(audioSettings.pitch) > 0.01 || audioSettings.humanize;
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

      // EQ & Filters
      if (entry.vocalFilter) {
        const targetGain = audioSettings.humanize ? -5.0 : (audioSettings.voiceFormant || 0) * -0.05;
        if (Math.abs(entry.vocalFilter.gain.value - targetGain) > 0.1)
          entry.vocalFilter.gain.setTargetAtTime(targetGain, ctxTime, rampTime);
      }
      if (entry.denoiseFilter) {
        const denoiseGain = -((audioSettings.denoise ?? 0) / 100) * 30;
        if (Math.abs(entry.denoiseFilter.gain.value - denoiseGain) > 0.1)
          entry.denoiseFilter.gain.setTargetAtTime(denoiseGain, ctxTime, rampTime);
      }
      if (entry.bassFilter) {
        const baseBass = (audioSettings.bass || 0) + (audioSettings.humanize ? 1.5 : 0);
        const targetBass = Math.max(-15, Math.min(15, baseBass));
        if (Math.abs(entry.bassFilter.gain.value - targetBass) > 0.1)
          entry.bassFilter.gain.setTargetAtTime(targetBass, ctxTime, rampTime);
      }
      if (entry.midFilter) {
        const targetMid = Math.max(-15, Math.min(15, audioSettings.mid ?? 0));
        if (Math.abs(entry.midFilter.gain.value - targetMid) > 0.1)
          entry.midFilter.gain.setTargetAtTime(targetMid, ctxTime, rampTime);
      }
      if (entry.trebleFilter) {
        const baseTreble = (audioSettings.treble || 0) + (audioSettings.humanize ? 1.0 : 0);
        const targetTreble = Math.max(-15, Math.min(15, baseTreble));
        if (Math.abs(entry.trebleFilter.gain.value - targetTreble) > 0.1)
          entry.trebleFilter.gain.setTargetAtTime(targetTreble, ctxTime, rampTime);
      }
      if (entry.compressorNode) {
        const comp = (audioSettings.compression ?? 0) / 100;
        const targetThreshold = comp > 0 ? -24 * comp : 0;
        const targetRatio = 1 + 19 * comp;
        if (Math.abs(entry.compressorNode.threshold.value - targetThreshold) > 0.5)
          entry.compressorNode.threshold.setTargetAtTime(targetThreshold, ctxTime, rampTime);
        if (Math.abs(entry.compressorNode.ratio.value - targetRatio) > 0.5)
          entry.compressorNode.ratio.setTargetAtTime(targetRatio, ctxTime, rampTime);
      }
      if (entry.deEsserFilter) {
        const targetDeEsserGain = -((audioSettings.deEsser ?? 0) / 100) * 18;
        if (Math.abs(entry.deEsserFilter.gain.value - targetDeEsserGain) > 0.1)
          entry.deEsserFilter.gain.setTargetAtTime(targetDeEsserGain, ctxTime, rampTime);
      }
      if (entry.warmthFilter) {
        const targetWarmth = ((audioSettings.warmth ?? 0) / 100) * 6;
        if (Math.abs(entry.warmthFilter.gain.value - targetWarmth) > 0.1)
          entry.warmthFilter.gain.setTargetAtTime(targetWarmth, ctxTime, rampTime);
      }

      // Panning
      if (entry.pannerNode) {
        const trackPan = targetTrack?.pan ?? 0;
        const combinedPan = (animatedPan / 100) + trackPan;
        const targetPan = Math.max(-1, Math.min(1, combinedPan));
        if (Math.abs(entry.pannerNode.pan.value - targetPan) > 0.01)
          entry.pannerNode.pan.setTargetAtTime(targetPan, ctxTime, rampTime);
      }

      // Room ambience gates
      if (entry.feedbackInputGain) {
        const targetInputGate = audioSettings.humanize ? 0.20 : 0.0;
        if (Math.abs(entry.feedbackInputGain.gain.value - targetInputGate) > 0.01)
          entry.feedbackInputGain.gain.setTargetAtTime(targetInputGate, ctxTime, rampTime);
      }
      if (entry.delayGain) {
        const targetDelay = audioSettings.humanize ? 0.20 : 0.0;
        if (Math.abs(entry.delayGain.gain.value - targetDelay) > 0.01)
          entry.delayGain.gain.setTargetAtTime(targetDelay, ctxTime, rampTime);
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
        if (active && (active.from.id === clipId || active.to.id === clipId)) {
          const isOutgoing = active.from.id === clipId;
          const other = isOutgoing ? active.to : active.from;

          // Special case: a transition placed on a SPLIT of one continuous source
          // (both sides share a mediaId and their media timelines are contiguous).
          // Cross-fading a source against itself causes comb filtering / flanging,
          // so we keep exactly one side audible and hard-mute the other.
          const sameSource = other.mediaId === fullClip.mediaId;
          let contiguous = false;
          if (sameSource) {
            const boundary = active.to.startTime;
            const fromMediaTime = getMediaTimeForClip(active.from, boundary);
            const toMediaTime = getMediaTimeForClip(active.to, boundary);
            contiguous = Math.abs(fromMediaTime - toMediaTime) < 0.1;
          }

          if (contiguous) {
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
        if (Math.abs(entry.gainNode.gain.value - finalVolume) > 0.005) {
          entry.gainNode.gain.setTargetAtTime(finalVolume, ctxTime, rampTime);
        }
        if (entry.el.volume !== 1) entry.el.volume = 1;
        const shouldUnmute = isPlaying && !globalMuted;
        if (entry.el.muted !== !shouldUnmute) entry.el.muted = !shouldUnmute;
      } else {
        const shouldUnmuteBase = isPlaying && !globalMuted;
        if (entry.el.muted !== !shouldUnmuteBase) entry.el.muted = !shouldUnmuteBase;
        if (entry.el.volume !== finalVolume) entry.el.volume = finalVolume;
      }
    }
    // PERF: keyed off `audioParamTime` (10 Hz) rather than raw `currentTime` (~33 Hz).
    // Fades, keyframed volume and transition ramps are all applied through
    // AudioParam.setTargetAtTime with an 80 ms time-constant, so a 100 ms update
    // cadence is inaudible while cutting this effect's cost by ~3×.
  }, [tracks, volume, isMuted, muteTimelineAudio, playbackSpeed, audioParamTime, isPlaying, mediaLibrary, isPrimary]);

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

  // ---- Zustand subscription for paused seek (scrubbing) ----
  useEffect(() => {
    if (!isPrimary) return;
    const unsub = useEditorStore.subscribe((state) => {
      if (state.isPlaying) return;
      const newTime = state.currentTime;
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
          if (!entry || entry.type !== 'video') continue;

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
          }, newTime)));

          if (el.seeking) {
            pendingSeeksRef.current.set(clip.id, mediaTime);
          } else {
            const drift = Math.abs(el.currentTime - mediaTime);
            if (drift > 0.02) {
              el.currentTime = mediaTime;
              const onSeeked = () => {
                const pending = pendingSeeksRef.current.get(clip.id);
                if (pending !== undefined) {
                  pendingSeeksRef.current.delete(clip.id);
                  if (Math.abs(el.currentTime - pending) > 0.005) {
                    el.currentTime = pending;
                  }
                }
              };
              el.addEventListener('seeked', onSeeked, { once: true });
            }
          }
        }
      }
    });
    return unsub;
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
          if (el._rvfcHandle != null && 'cancelVideoFrameCallback' in el) {
            try { el.cancelVideoFrameCallback(el._rvfcHandle); } catch {}
            el._rvfcHandle = null;
          }
        }
      } else {
        for (const [, entry] of pool) {
          if (entry.type === 'video') {
            const el = entry.el as any;
            if ('requestVideoFrameCallback' in el) {
              const onVideoFrame = () => {
                if (!poolRef.current.has(entry.clipId)) return;
                triggerRedraw();
                el._rvfcHandle = el.requestVideoFrameCallback(onVideoFrame);
              };
              el._rvfcHandle = el.requestVideoFrameCallback(onVideoFrame);
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
            if (el._handleSeeked) el.removeEventListener('seeked', el._handleSeeked);
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
            entry.el.src = '';
            entry.el.remove();
          }
          pool.clear();
          videoMapRef.current.clear();
          pendingSeeksRef.current.clear();
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

