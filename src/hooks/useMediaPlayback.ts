/**
 * useMediaPlayback.ts
 *
 * Manages a pool of HTMLVideoElement and HTMLAudioElement instances for
 * real media playback, synced to the editor store's currentTime.
 *
 * Provides:
 *  - Pre-loaded media elements for active clips
 *  - Play/pause/seek synchronisation
 *  - Volume and mute control per-track
 *  - Frame-accurate scrubbing for video
 */

import { useEffect, useRef, useCallback } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { getMediaTimeForClip, getSpeedAtPosition } from '@/utils/speedRamp';
import { getAnimatedValue } from '@/utils/keyframes';

// Global master audio context for combining all tracks into a single MediaStream for Export
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
        
        // Master dynamics compressor/limiter
        masterCompressor = masterAudioCtx.createDynamicsCompressor();
        masterCompressor.threshold.value = -12; // dBFS
        masterCompressor.knee.value = 6;
        masterCompressor.ratio.value = 4;
        masterCompressor.attack.value = 0.003;
        masterCompressor.release.value = 0.25;
        
        // Master analyser for VU metering (stereo mix)
        masterAnalyser = masterAudioCtx.createAnalyser();
        masterAnalyser.fftSize = 64;
        
        // Channel splitter and L/R analysers for true stereo metering
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
        
        // Route master compressor output to master analyser, then to speakers and export
        masterCompressor.connect(masterAnalyser);
        masterAnalyser.connect(masterAudioCtx.destination);
        masterAnalyser.connect(masterAudioDestination);
        
        // Route to L/R splitter for metering
        masterAnalyser.connect(splitter);
        splitter.connect(masterAnalyserL, 0);
        splitter.connect(masterAnalyserR, 1);
      }
    }
  }
  return masterAudioCtx;
}

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
  trebleFilter?: BiquadFilterNode;
  pannerNode?: StereoPannerNode;
  gainNode?: GainNode;
  delayNode?: DelayNode;
  delayGain?: GainNode;
  feedbackInputGain?: GainNode;
  feedbackNode?: GainNode;
  separationGraph?: SeparationGraph;
  _fxConnected?: boolean;
}

/**
 * Hook that manages real playback of video/audio clips on the timeline.
 *
 * It creates a pool of hidden media elements, one per unique clip
 * currently placed on the timeline. During playback it syncs their
 * currentTime to the editor's currentTime and handles play/pause.
 *
 * Returns a Map of clipId → HTMLVideoElement for the preview canvas
 * to draw video frames from.
 */
export interface FrameCacheEntry {
  time: number;
  bitmap: ImageBitmap;
}

export interface MediaPlaybackResult {
  videoElements: Map<string, HTMLVideoElement>;
  frameCache: Map<string, FrameCacheEntry[]>;
}

export function useMediaPlayback(): MediaPlaybackResult {
  const poolRef = useRef<Map<string, MediaElement>>(new Map());
  const videoMapRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  // Frame cache: clipId → sorted array of {time, bitmap} for instant scrubbing
  const frameCacheRef = useRef<Map<string, FrameCacheEntry[]>>(new Map());
  const resultRef = useRef<MediaPlaybackResult>({ videoElements: new Map(), frameCache: new Map() });

  const tracks = useEditorStore((s) => s.tracks);
  const mediaLibrary = useEditorStore((s) => s.mediaLibrary);
  const isPlaying = useEditorStore((s) => s.isPlaying);
  const currentTime = useEditorStore((s) => s.currentTime);
  const volume = useEditorStore((s) => s.volume);
  const isMuted = useEditorStore((s) => s.isMuted);
  const playbackSpeed = useEditorStore((s) => s.playbackSpeed);
  const isExporting = useEditorStore((s) => s.isExporting);

  // Keep track of expected playback time to detect manual user seeks
  const lastTimeRef = useRef<number>(currentTime);
  const lastRealTimeRef = useRef<number>(performance.now());
  const wasPlayingRef = useRef<boolean>(isPlaying);
  const lastActiveClipIdsRef = useRef<Set<string>>(new Set());

  // Queue to hold pending seek requests for video elements during scrubbing/seeking
  const pendingSeeksRef = useRef<Map<string, number>>(new Map());

  // Trigger a custom event on window so PreviewCanvas can redraw immediately on async frame seek
  
  const triggerRedraw = useCallback(() => {
    window.dispatchEvent(new CustomEvent('procut-frame-updated'));
  }, []);
  const stableTriggerRedrawRef = useRef(triggerRedraw);
  stableTriggerRedrawRef.current = triggerRedraw;
  const stableTriggerRedraw = useCallback(() => stableTriggerRedrawRef.current(), []);

  const getMediaContainer = () => {
    let mediaContainer = document.getElementById('procut-media-pool');
    if (!mediaContainer) {
      mediaContainer = document.createElement('div');
      mediaContainer.id = 'procut-media-pool';
      mediaContainer.style.display = 'none';
      document.body.appendChild(mediaContainer);
    }
    return mediaContainer;
  };


  // Sync master stream to store once
  useEffect(() => {
    // ensure it's created
    getMasterAudioCtx();
    if (masterAudioDestination) {
      useEditorStore.getState().setMasterAudioStream(masterAudioDestination.stream);
    }
  }, []);

  // Build set of active clips
  const activeClips = useCallback(() => {
    const result: {
      clipId: string;
      mediaId: string;
      clipStart: number;
      clipDuration: number;
      trimStart: number;
      trackMuted: boolean;
      trackType: 'video' | 'audio';
      speed: number;
      speedRamp?: any[];
    }[] = [];

    const addedClipIds = new Set<string>();

    const addIfNew = (clip: any, track: any) => {
      if (addedClipIds.has(clip.id)) return;
      addedClipIds.add(clip.id);
      result.push({
        clipId: clip.id,
        mediaId: clip.mediaId,
        clipStart: clip.startTime,
        clipDuration: clip.duration,
        trimStart: clip.trimStart,
        trackMuted: track.muted,
        trackType: track.type,
        speed: clip.speed,
        speedRamp: clip.speedRamp,
      });
    };

    for (const track of tracks) {
      if (track.hidden) continue;
      
      const sortedClips = [...track.clips].sort((a, b) => a.startTime - b.startTime);

      for (let idx = 0; idx < sortedClips.length; idx++) {
        const clip = sortedClips[idx];

        // 1. Check normal active state
        const isNormallyActive =
          currentTime >= clip.startTime && currentTime < clip.startTime + clip.duration;
        if (isNormallyActive) {
          addIfNew(clip, track);
        }

        // 2. Check transition at this clip's start (if idx > 0)
        // A transition can be defined as transitionIn on this clip (incoming) OR transitionOut on prevClip (outgoing)
        if (idx > 0) {
          const prevClip = sortedClips[idx - 1];
          const gap = clip.startTime - (prevClip.startTime + prevClip.duration);
          // Pick the transition definition from whichever side has it
          const trans = (Math.abs(gap) < 0.1 && clip.transitionIn)
            ? clip.transitionIn
            : (Math.abs(gap) < 0.1 && prevClip.transitionOut)
              ? prevClip.transitionOut
              : null;

          if (trans) {
            const duration = trans.duration;
            const alignment = trans.params?.alignment || 'center';
            const boundary = clip.startTime;
            let leftSec = boundary - duration / 2;
            if (alignment === 'left') {
              leftSec = boundary;
            } else if (alignment === 'right') {
              leftSec = boundary - duration;
            }
            const rightSec = leftSec + duration;

            if (currentTime >= leftSec && currentTime < rightSec) {
              // Both clips are active in this transition zone
              addIfNew(prevClip, track);
              addIfNew(clip, track);
            }
          }
        }
      }

      // 3. Check active over layers
      for (const ol of track.overLayers || []) {
        if (ol.mediaId && currentTime >= ol.startTime && currentTime < ol.startTime + ol.duration) {
          addIfNew(ol, track);
        }
      }
    }
    return result;
  }, [tracks, currentTime]);

  // Ensure media elements exist for all timeline clips
  useEffect(() => {
    const neededClips = new Map<string, { mediaId: string; type: 'video' | 'audio' }>();
    for (const track of tracks) {
      for (const clip of track.clips) {
        const media = mediaLibrary.find((m) => m.id === clip.mediaId);
        if (media && media.url && (media.type === 'video' || media.type === 'audio')) {
          neededClips.set(clip.id, {
            mediaId: clip.mediaId,
            type: media.type,
          });
        }
      }
      for (const ol of track.overLayers || []) {
        if (ol.mediaId) {
          const media = mediaLibrary.find((m) => m.id === ol.mediaId);
          if (media && media.url && (media.type === 'video' || media.type === 'audio')) {
            neededClips.set(ol.id, {
              mediaId: ol.mediaId,
              type: media.type,
            });
          }
        }
      }
    }

    const pool = poolRef.current;
    const videoMap = videoMapRef.current;

    // Create missing elements or update sources if they changed (e.g. after re-linking)
    for (const [clipId, info] of neededClips) {
      const media = mediaLibrary.find((m) => m.id === info.mediaId);
      if (!media || !media.url) continue;

      const existing = pool.get(clipId);
      if (existing) {
        if (existing.type === 'audio') {
          const currentSrc = existing.el.src;
          const isPendingRestore = media.url === 'PENDING_RESTORE';
          const isUrlActuallyDifferent = currentSrc !== media.url && !currentSrc.endsWith(media.url);
          
          if (!isPendingRestore && isUrlActuallyDifferent) {
            existing.el.src = media.url;
            existing.el.load();
          } else if (isPendingRestore && !currentSrc.includes('PENDING_RESTORE')) {
            existing.el.src = media.url;
          }
        }
        continue;
      }

      if (info.type === 'video') {
        const el = document.createElement('video');
        el.preload = 'auto';
        el.muted = false; // Muted = false so we can hear video audio
        el.playsInline = true;
        el.crossOrigin = 'anonymous';
        // el.src is not set on creation — loaded dynamically based on proximity
        el.style.display = 'none';

        // Seeked handler that checks for subsequent pending seeks before triggering redraw
        const handleSeeked = () => {
          // Cache this decoded frame as ImageBitmap for instant scrubbing
          if (el.videoWidth > 0 && el.readyState >= 2) {
            createImageBitmap(el).then(bitmap => {
              if (!poolRef.current.has(clipId) && !pendingSeeksRef.current.has(clipId)) {
                bitmap.close();
                return;
              }
              let clipCache = frameCacheRef.current.get(clipId);
              if (!clipCache) {
                clipCache = [];
                frameCacheRef.current.set(clipId, clipCache);
              }
              const roundedTime = Math.round(el.currentTime * 30) / 30;
              const existingKf = clipCache.findIndex(f => Math.abs(f.time - roundedTime) < 0.015);
              if (existingKf >= 0) {
                clipCache[existingKf].bitmap.close();
                clipCache[existingKf] = { time: roundedTime, bitmap };
              } else {
                clipCache.push({ time: roundedTime, bitmap });
                clipCache.sort((a, b) => a.time - b.time);
              }
              // Evict oldest frames if cache too large (keep 120 frames per clip)
              while (clipCache.length > 120) {
                const removed = clipCache.shift();
                removed?.bitmap.close();
              }
            }).catch(() => {});
          }

          triggerRedraw();
          const pendingTime = pendingSeeksRef.current.get(clipId);
          if (pendingTime !== undefined) {
            pendingSeeksRef.current.delete(clipId);
            el.currentTime = pendingTime;
          }
        };

        (el as any)._handleSeeked = handleSeeked;

        el.addEventListener('seeked', handleSeeked);
        el.addEventListener('timeupdate', stableTriggerRedraw);
        el.addEventListener('canplay', stableTriggerRedraw);

        getMediaContainer().appendChild(el);
        // el.load() not called here — proximity preloader will manage it
        
        const entry: MediaElement = { el, clipId, mediaId: info.mediaId, type: 'video' };
        initAudioGraph(entry);
        pool.set(clipId, entry);
        videoMapRef.current.set(clipId, el);
      } else if (info.type === 'audio') {
        const el = document.createElement('audio');
        el.preload = 'auto';
        el.crossOrigin = 'anonymous';
        el.src = media.url;
        el.style.display = 'none';
        getMediaContainer().appendChild(el);
        el.load(); // Force the browser to start fetching the audio
        
        const entry: MediaElement = { el, clipId, mediaId: info.mediaId, type: 'audio' };
        initAudioGraph(entry);
        pool.set(clipId, entry);
      }
    }

    // Remove elements that are no longer on the timeline
    for (const [clipId, entry] of pool) {
      if (!neededClips.has(clipId)) {
        entry.el.pause();
        if (entry.type === 'video') {
          const el = entry.el as any;
          if (el._handleSeeked) {
            el.removeEventListener('seeked', el._handleSeeked);
          }
          el.removeEventListener('timeupdate', stableTriggerRedraw);
          el.removeEventListener('canplay', stableTriggerRedraw);
        }
        entry.el.src = '';
        if (entry.sourceNode) {
          try { entry.sourceNode.disconnect(); } catch (e) {}
        }
        entry.el.remove();
        pool.delete(clipId);
        videoMap.delete(clipId);
        frameCacheRef.current.delete(clipId);
        pendingSeeksRef.current.delete(clipId);
      }
    }
  }, [tracks, mediaLibrary, stableTriggerRedraw]);

  // Sync playback state — play / pause / seek
  useEffect(() => {
    const syncPlayback = async () => {
      const pool = poolRef.current;
      const clips = activeClips();
    const playingIds = new Set(clips.map((c) => c.clipId));

    const now = performance.now();
    const elapsedRealTime = (now - lastRealTimeRef.current) / 1000;
    const expectedPlaybackTime = lastTimeRef.current + elapsedRealTime * playbackSpeed;

    // Detect if playback has just started, or if the user performed a manual seek
    const playStarted = isPlaying && !wasPlayingRef.current;
    const userSeeked = Math.abs(currentTime - expectedPlaybackTime) > 0.15;
    const forceSeek = playStarted || userSeeked;

    lastTimeRef.current = currentTime;
    lastRealTimeRef.current = now;
    wasPlayingRef.current = isPlaying;

    for (const [clipId, entry] of pool) {
      const clip = clips.find((c) => c.clipId === clipId);
      const isActiveAndPlaying = !!clip && isPlaying;

      if (isActiveAndPlaying) {
        connectAudioNode(entry);
      } else {
        disconnectAudioNode(entry);
      }

      if (!clip || !isPlaying) {
        // Pause this element
        if (!entry.el.paused) {
          entry.el.pause();
        }
      } else {
        // Resume Audio Context if suspended (browser user interaction gesture unlock)
        if (entry.audioCtx && entry.audioCtx.state === 'suspended') {
          try {
            await entry.audioCtx.resume();
          } catch (err) {
            console.warn("Exception during audioCtx.resume:", err);
          }
        }

        // Calculate the media time corresponding to currentTime
        const mediaItem = mediaLibrary.find((m) => m.id === clip.mediaId);
        const maxDuration = mediaItem ? mediaItem.duration : 10000;
        const mediaTime = Math.max(0, Math.min(maxDuration, getMediaTimeForClip({
          id: clip.clipId,
          startTime: clip.clipStart,
          duration: clip.clipDuration,
          trimStart: clip.trimStart,
          speed: clip.speed,
          speedRamp: clip.speedRamp
        }, currentTime)));

        // Seek to the correct time if we just started, if the user seeked, if the clip just activated, or if we have high drift
        const currentMediaTime = entry.el.currentTime;
        const drift = Math.abs(currentMediaTime - mediaTime);
        const justActivated = !lastActiveClipIdsRef.current.has(clipId);
        const clipForceSeek = forceSeek || justActivated;

        const direction = useEditorStore.getState().playbackDirection ?? 1;
        const isReversing = direction < 0;

        // Relaxed drift limit (250ms) during normal playback to avoid stuttering/seeking loops.
        // During force-seeking (play start, user seek, first activation) or reverse playback, we use a tighter limit.
        const driftLimit = isReversing ? 0.02 : 0.25;

        if (clipForceSeek || drift > driftLimit) {
          const forceSeekThreshold = isReversing ? 0.02 : 0.05; // 50ms
          const threshold = clipForceSeek ? forceSeekThreshold : driftLimit;
          if (drift > threshold) {
            if (entry.el.seeking) {
              pendingSeeksRef.current.set(clipId, mediaTime);
            } else {
              entry.el.currentTime = mediaTime;
            }
          }
        }

        // Play if paused (only when playing forward)
        if (entry.el.paused && isPlaying && !isReversing) {
          entry.el.play().catch(() => { /* user interaction required — ignore */ });
        } else if (!entry.el.paused && (!isPlaying || isReversing)) {
          entry.el.pause();
        }
      }
    }

    // Pause and pre-seek inactive elements to their start position (trimStart or transition start) so they play instantly and seamlessly
    for (const [clipId, entry] of pool) {
      const isActive = playingIds.has(clipId);
      if (!isActive) {
        if (!entry.el.paused) {
          entry.el.pause();
        }
        
        // Find the clip in tracks to get its trimStart or transition entry start time
        let fullClip = null;
        for (const track of tracks) {
          const found = track.clips.find((c) => c.id === clipId) || (track.overLayers || []).find((c) => c.id === clipId);
          if (found) {
            fullClip = found;
            break;
          }
        }
        if (fullClip) {
          let targetTime = fullClip.trimStart;
          if ('transitionIn' in fullClip && (fullClip as any).transitionIn) {
            const transDur = (fullClip as any).transitionIn.duration;
            const alignment = (fullClip as any).transitionIn.params?.alignment || 'center';
            let offset = 0;
            if (alignment === 'center') {
              offset = transDur / 2;
            } else if (alignment === 'right') {
              offset = transDur;
            }
            
            const startTimelineTime = fullClip.startTime - offset;
            const mediaItem = mediaLibrary.find((m) => m.id === fullClip.mediaId);
            const maxDuration = mediaItem ? mediaItem.duration : 10000;
            
            targetTime = Math.max(0, Math.min(maxDuration, getMediaTimeForClip({
              id: fullClip.id,
              startTime: fullClip.startTime,
              duration: fullClip.duration,
              trimStart: fullClip.trimStart,
              speed: fullClip.speed,
              speedRamp: fullClip.speedRamp
            }, startTimelineTime)));
          }

          if (Math.abs(entry.el.currentTime - targetTime) > 0.1) {
            if (!entry.el.seeking) {
              entry.el.currentTime = targetTime;
            } else {
              pendingSeeksRef.current.set(clipId, targetTime);
            }
          }
        }
      }
    }

    // Update active clip IDs ref
    lastActiveClipIdsRef.current = playingIds;
    };
    syncPlayback();
  }, [isPlaying, currentTime, playbackSpeed, activeClips, mediaLibrary, tracks]);

  // Cleanup orphaned track analysers
  useEffect(() => {
    const activeTrackIds = new Set(tracks.map(t => t.id));
    for (const [trackId, analyser] of trackAnalysers.entries()) {
      if (!activeTrackIds.has(trackId)) {
        try { analyser.disconnect(); } catch (e) {}
        trackAnalysers.delete(trackId);
      }
    }
  }, [tracks]);

  // Reactively sync audio parameters (volume, EQ, pitch, etc.) for all clips in the pool
  useEffect(() => {
    const pool = poolRef.current;
    const clips = activeClips();
    const playingIds = new Set(clips.map((c) => c.clipId));

    for (const [clipId, entry] of pool) {
      // Find the clip in the tracks
      let fullClip = null;
      let targetTrack = null;
      for (const track of tracks) {
        const found = track.clips.find((c) => c.id === clipId) || (track.overLayers || []).find((c) => c.id === clipId);
        if (found) {
          fullClip = found;
          targetTrack = track;
          break;
        }
      }

      if (!fullClip) continue;

      const audioSettings = fullClip.audioSettings || {
        volume: 0,
        pan: 0,
        fadeIn: 0,
        fadeOut: 0,
        bass: 0,
        treble: 0,
        muted: false,
        preservePitch: true,
        pitch: 0,
        voiceFormant: 0,
        humanize: false,
      };

      // Evaluate animated volume and pan from keyframes
      const animatedVolume = getAnimatedValue(
        audioSettings.volume,
        currentTime,
        fullClip.startTime,
        fullClip.animations?.['audio.volume']
      );
      const animatedPan = getAnimatedValue(
        audioSettings.pan,
        currentTime,
        fullClip.startTime,
        fullClip.animations?.['audio.pan']
      );

      // Apply Speed Preserves Pitch
      const targetPreserve = audioSettings.preservePitch;
      if (entry.el.preservesPitch !== targetPreserve) {
        entry.el.preservesPitch = targetPreserve;
      }

      const ctxTime = entry.audioCtx?.currentTime || 0;
      const rampTime = 0.08;

      // Update Pitch Shifter parameters
      if (entry.pitchNode) {
        (entry.pitchNode as any).pitch = audioSettings.pitch;
        (entry.pitchNode as any).humanize = audioSettings.humanize;
      }

      // Update Separation Graph
      if (entry.separationGraph) {
        const sep = audioSettings.vocalSeparation || { enabled: false, mode: 'removeVocals' as const, strength: 80 };
        const graph = entry.separationGraph;
        const S = sep.strength / 100;

        if (sep.enabled) {
          const updateGain = (node: GainNode, val: number) => {
            if (Math.abs(node.gain.value - val) > 0.005) node.gain.setTargetAtTime(val, ctxTime, rampTime);
          };
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
            // Creative blend
            const mix = 1.0 - S * 0.5;
            updateGain(graph.lowGain, 1.0);
            updateGain(graph.highGain, 1.0);
            updateGain(graph.sideGain, mix);
            updateGain(graph.midOutputGain, S);
          }
        } else {
          const updateGain = (node: GainNode, val: number) => {
            if (Math.abs(node.gain.value - val) > 0.005) node.gain.setTargetAtTime(val, ctxTime, rampTime);
          };
          updateGain(graph.bypassGain, 1.0);
          updateGain(graph.lowGain, 0.0);
          updateGain(graph.highGain, 0.0);
          updateGain(graph.sideGain, 0.0);
          updateGain(graph.midOutputGain, 0.0);
        }
      }

      // Reactive FX Routing to bypass ScriptProcessorNodes (pitch) when not in use
      const needsFx = Math.abs(audioSettings.pitch) > 0.01 || audioSettings.humanize;
      if (needsFx && !entry._fxConnected && entry.sourceNode && entry.pitchNode && entry.separationGraph) {
        entry.sourceNode.disconnect();
        entry.sourceNode.connect(entry.pitchNode);
        entry.pitchNode.connect(entry.separationGraph.input);
        entry._fxConnected = true;
      } else if (!needsFx && entry._fxConnected && entry.sourceNode && entry.pitchNode && entry.separationGraph) {
        entry.sourceNode.disconnect();
        entry.pitchNode.disconnect();
        entry.sourceNode.connect(entry.separationGraph.input);
        entry._fxConnected = false;
      }

      // Update Vocal Filter (notch metallic resonance or manual formant)
      if (entry.vocalFilter) {
        const targetGain = audioSettings.humanize ? -5.0 : (audioSettings.voiceFormant || 0) * -0.05;
        if (Math.abs(entry.vocalFilter.gain.value - targetGain) > 0.1) entry.vocalFilter.gain.setTargetAtTime(targetGain, ctxTime, rampTime);
      }

      // Update Bass / Treble Equalizers and Denoise
      if (entry.denoiseFilter) {
        const denoiseVal = audioSettings.denoise ?? 0;
        // Denoise 0-100 reduces high frequencies above 4000Hz up to -30dB
        const denoiseGain = -(denoiseVal / 100) * 30;
        if (Math.abs(entry.denoiseFilter.gain.value - denoiseGain) > 0.1) entry.denoiseFilter.gain.setTargetAtTime(denoiseGain, ctxTime, rampTime);
      }
      if (entry.bassFilter) {
        const baseBass = (audioSettings.bass || 0) + (audioSettings.humanize ? 1.5 : 0);
        const targetBass = Math.max(-15, Math.min(15, baseBass));
        if (Math.abs(entry.bassFilter.gain.value - targetBass) > 0.1) entry.bassFilter.gain.setTargetAtTime(targetBass, ctxTime, rampTime);
      }
      if (entry.trebleFilter) {
        const baseTreble = (audioSettings.treble || 0) + (audioSettings.humanize ? 1.0 : 0);
        const targetTreble = Math.max(-15, Math.min(15, baseTreble));
        if (Math.abs(entry.trebleFilter.gain.value - targetTreble) > 0.1) entry.trebleFilter.gain.setTargetAtTime(targetTreble, ctxTime, rampTime);
      }

      // Update Stereo Panning combining clip panning and track-level panning
      if (entry.pannerNode) {
        const trackPan = targetTrack?.pan ?? 0;
        const combinedPan = (animatedPan / 100) + trackPan;
        const targetPan = Math.max(-1, Math.min(1, combinedPan));
        if (Math.abs(entry.pannerNode.pan.value - targetPan) > 0.01) entry.pannerNode.pan.setTargetAtTime(targetPan, ctxTime, rampTime);
      }

      // Update Room Ambience: open feedbackInputGain gate only when humanize is active.
      // This prevents ANY audio energy from entering the feedback loop during normal playback.
      if (entry.feedbackInputGain) {
        const targetInputGate = audioSettings.humanize ? 0.20 : 0.0;
        if (Math.abs(entry.feedbackInputGain.gain.value - targetInputGate) > 0.01)
          entry.feedbackInputGain.gain.setTargetAtTime(targetInputGate, ctxTime, rampTime);
      }
      if (entry.delayGain) {
        const targetDelay = audioSettings.humanize ? 0.20 : 0.0;
        if (Math.abs(entry.delayGain.gain.value - targetDelay) > 0.01) entry.delayGain.gain.setTargetAtTime(targetDelay, ctxTime, rampTime);
      }

      // Update volume & mute state supporting track Solo / Mute logic
      const anyTrackSoloed = tracks.some(t => t.solo);
      const isMutedTrack = targetTrack ? (anyTrackSoloed ? !targetTrack.solo : targetTrack.muted) : false;
      const isMutedGlobally = isMutedTrack || isMuted;
      const globalMuted = isMutedGlobally || audioSettings.muted || (fullClip as any).disabled;

      const clipElapsed = currentTime - fullClip.startTime;
      let fadeInMultiplier = 1;
      if (audioSettings.fadeIn > 0) {
        fadeInMultiplier = Math.min(1, Math.max(0, clipElapsed / audioSettings.fadeIn));
      }
      let fadeOutMultiplier = 1;
      if (audioSettings.fadeOut > 0) {
        const timeLeft = fullClip.duration - clipElapsed;
        fadeOutMultiplier = Math.min(1, Math.max(0, timeLeft / audioSettings.fadeOut));
      }

      // Calculate transition volume cross-fade multiplier
      let transitionVolumeMultiplier = 1;
      let isTransitionMuted = false;
      
      // Check if this clip is the incoming clip in a transition
      if ('transitionIn' in fullClip && (fullClip as any).transitionIn) {
        const transDur = (fullClip as any).transitionIn.duration;
        const alignment = (fullClip as any).transitionIn.params?.alignment || 'center';
        let leftSec = fullClip.startTime - transDur / 2;
        if (alignment === 'left') {
          leftSec = fullClip.startTime;
        } else if (alignment === 'right') {
          leftSec = fullClip.startTime - transDur;
        }
        const rightSec = leftSec + transDur;
        if (currentTime >= leftSec && currentTime < rightSec) {
          const t = (currentTime - leftSec) / transDur;
          
          // Check if split clip boundary transition (same mediaId and continuous media time) to prevent double play/echo
          let isSplitClipTransition = false;
          if (targetTrack) {
            const sortedClips = [...targetTrack.clips].sort((a, b) => a.startTime - b.startTime);
            const clipIdx = sortedClips.findIndex((c) => c.id === clipId);
            if (clipIdx > 0) {
              const prevClip = sortedClips[clipIdx - 1];
              if (prevClip.mediaId === fullClip.mediaId) {
                // Verify if the media times at the boundary are continuous (e.g. difference < 0.1s)
                const prevMediaTime = getMediaTimeForClip(prevClip, fullClip.startTime);
                const currMediaTime = getMediaTimeForClip(fullClip, fullClip.startTime);
                if (Math.abs(prevMediaTime - currMediaTime) < 0.1) {
                  isSplitClipTransition = true;
                  // Mute incoming clip until the split point (fullClip.startTime)
                  if (currentTime < fullClip.startTime) {
                    isTransitionMuted = true;
                  }
                }
              }
            }
          }
          
          if (!isSplitClipTransition) {
            // Incoming clip fades in for different media files
            transitionVolumeMultiplier = t;
          }
        }
      }
      
      // Check if this clip is the outgoing clip in a transition (by checking the next clip OR own transitionOut)
      if (targetTrack) {
        const sortedClips = [...targetTrack.clips].sort((a, b) => a.startTime - b.startTime);
        const clipIdx = sortedClips.findIndex((c) => c.id === clipId);
        if (clipIdx !== -1 && clipIdx < sortedClips.length - 1) {
          const nextClip = sortedClips[clipIdx + 1];
          // Use transitionIn from the next clip, or transitionOut from the current clip as fallback
          const activeTrans = nextClip.transitionIn || (fullClip as any).transitionOut || null;
          if (activeTrans) {
            const transDur = activeTrans.duration;
            const alignment = activeTrans.params?.alignment || 'center';
            // Both transitionIn on next and transitionOut on current use the boundary at nextClip.startTime
            const boundary = nextClip.startTime;
            let leftSec = boundary - transDur / 2;
            if (alignment === 'left') {
              leftSec = boundary;
            } else if (alignment === 'right') {
              leftSec = boundary - transDur;
            }
            const rightSec = leftSec + transDur;
            if (currentTime >= leftSec && currentTime < rightSec) {
              const t = (currentTime - leftSec) / transDur;
              
              // Check if split clip boundary transition (same mediaId and continuous media time) to prevent double play/echo
              let isSplitClipTransition = false;
              if (nextClip.mediaId === fullClip.mediaId) {
                // Verify if the media times at the boundary are continuous (e.g. difference < 0.1s)
                const prevMediaTime = getMediaTimeForClip(fullClip, nextClip.startTime);
                const currMediaTime = getMediaTimeForClip(nextClip, nextClip.startTime);
                if (Math.abs(prevMediaTime - currMediaTime) < 0.1) {
                  isSplitClipTransition = true;
                  // Mute outgoing clip from the split point (nextClip.startTime) onwards
                  if (currentTime >= nextClip.startTime) {
                    isTransitionMuted = true;
                  }
                }
              }
              
              if (!isSplitClipTransition) {
                // Outgoing clip fades out for different media files
                transitionVolumeMultiplier = 1 - t;
              }
            }
          }
        }
      }

      const linearGain = Math.pow(10, animatedVolume / 20);
      const trackVolume = targetTrack?.volume ?? 1;
      const finalVolume = (globalMuted || isTransitionMuted || !playingIds.has(clipId)) ? 0 : linearGain * volume * trackVolume * fadeInMultiplier * fadeOutMultiplier * transitionVolumeMultiplier;

      if (entry.gainNode) {
        if (Math.abs(entry.gainNode.gain.value - finalVolume) > 0.005) {
          entry.gainNode.gain.setTargetAtTime(finalVolume, ctxTime, rampTime);
        }
        // Force base element unmuted and full volume so output goes to Web Audio
        if (entry.el.volume !== 1) entry.el.volume = 1;
        if (entry.el.muted !== false) entry.el.muted = false;
      } else {
        // Fallback to HTML5 elements directly
        if (entry.el.muted !== globalMuted) {
          entry.el.muted = globalMuted;
        }
        if (entry.el.volume !== finalVolume) {
          entry.el.volume = finalVolume;
        }
      }

      // Sync playback rate ONLY if changed
      let effectiveSpeed = fullClip.speed;
      if (fullClip.speedRamp && fullClip.speedRamp.length >= 2) {
        const p = (currentTime - fullClip.startTime) / fullClip.duration;
        effectiveSpeed = getSpeedAtPosition(fullClip.speedRamp, p);
      }

      // Gentle sync catchup (PLL): if we are drifting but under the force-seek limit,
      // adjust playback speed slightly to catch up to the timeline seamlessly.
      const mediaItem = mediaLibrary.find((m) => m.id === fullClip.mediaId);
      const maxDuration = mediaItem ? mediaItem.duration : 10000;
      const mediaTime = Math.max(0, Math.min(maxDuration, getMediaTimeForClip({
        id: fullClip.id,
        startTime: fullClip.startTime,
        duration: fullClip.duration,
        trimStart: fullClip.trimStart,
        speed: fullClip.speed,
        speedRamp: fullClip.speedRamp
      }, currentTime)));

      const currentMediaTime = entry.el.currentTime;
      const rawDrift = currentMediaTime - mediaTime; // > 0 means video is ahead of timeline
      
      // Gentle sync catchup (PLL) logic removed to prevent video playback stuttering 
      // from constantly shifting HTML5 playbackRate.
      const targetSpeed = Math.max(0.1, playbackSpeed * effectiveSpeed);
      if (Math.abs(entry.el.playbackRate - targetSpeed) > 0.005) {
        entry.el.playbackRate = targetSpeed;
      }
    }
  }, [tracks, volume, isMuted, playbackSpeed, currentTime, isPlaying, mediaLibrary]);

  // On seek (when not playing), update video elements for frame display
  useEffect(() => {
    if (isPlaying) return;

    const pool = poolRef.current;
    const clips = activeClips();

    for (const clip of clips) {
      const entry = pool.get(clip.clipId);
      if (!entry || entry.type !== 'video') continue;

      const el = entry.el as HTMLVideoElement;
      const mediaItem = mediaLibrary.find((m) => m.id === clip.mediaId);
      const maxDuration = mediaItem ? mediaItem.duration : 10000;
      const mediaTime = Math.max(0, Math.min(maxDuration, getMediaTimeForClip({
        id: clip.clipId,
        startTime: clip.clipStart,
        duration: clip.clipDuration,
        trimStart: clip.trimStart,
        speed: clip.speed,
        speedRamp: clip.speedRamp
      }, currentTime)));

      if (el.seeking) {
        // Coalesce seeks: store the latest target time to seek to once the current seek finishes
        pendingSeeksRef.current.set(clip.clipId, mediaTime);
      } else {
        const drift = Math.abs(el.currentTime - mediaTime);
        if (drift > 0.03) {
          el.currentTime = mediaTime;
        }
      }
    }
  }, [currentTime, isPlaying, activeClips, mediaLibrary]);

  // Dynamically load/unload video sources based on proximity to currentTime to prevent decoder starvation
  useEffect(() => {
    const pool = poolRef.current;
    if (isExporting) {
      // During export, load all video elements to ensure frame-accurate rendering
      for (const [clipId, entry] of pool) {
        if (entry.type !== 'video') continue;
        const el = entry.el as HTMLVideoElement;
        const media = mediaLibrary.find((m) => m.id === entry.mediaId);
        if (!media || !media.url || media.url === 'PENDING_RESTORE') continue;
        const targetSrc = media.url;
        if (el.src !== targetSrc && !el.src.endsWith(targetSrc)) {
          el.src = targetSrc;
          el.load();
        }
      }
      return;
    }

    for (const [clipId, entry] of pool) {
      if (entry.type !== 'video') continue;
      const el = entry.el as HTMLVideoElement;
      
      // Find the clip to get its track and timing
      let clipTrack: any = null;
      let clipObj: any = null;
      for (const track of tracks) {
        const found = track.clips.find((c) => c.id === clipId) || (track.overLayers || []).find((c) => c.id === clipId);
        if (found) {
          clipTrack = track;
          clipObj = found;
          break;
        }
      }
      
      if (!clipObj || !clipTrack) continue;
      
      const media = mediaLibrary.find((m) => m.id === entry.mediaId);
      if (!media || !media.url) continue;
      
      const isPendingRestore = media.url === 'PENDING_RESTORE';
      // Load if within 8 seconds of playhead, otherwise unload
      const isNear = !clipTrack.hidden && currentTime >= clipObj.startTime - 8 && currentTime < clipObj.startTime + clipObj.duration + 8;
      
      if (isNear && !isPendingRestore) {
        const targetSrc = media.url;
        if (el.src !== targetSrc && !el.src.endsWith(targetSrc)) {
          el.src = targetSrc;
          el.load();
        }
      } else {
        if (el.src !== '') {
          el.removeAttribute('src');
          try {
            el.load(); // releases decoder and network resources
          } catch (e) {}
        }
      }
    }
  }, [currentTime, tracks, mediaLibrary, isExporting]);

  // Cleanup all on unmount
  useEffect(() => {
    return () => {
      const pool = poolRef.current;
      for (const [, entry] of pool) {
        entry.el.pause();
        if (entry.type === 'video') {
          const el = entry.el as any;
          if (el._handleSeeked) {
            el.removeEventListener('seeked', el._handleSeeked);
          }
          el.removeEventListener('timeupdate', stableTriggerRedraw);
          el.removeEventListener('canplay', stableTriggerRedraw);
        }
        entry.el.src = '';
        if (entry.sourceNode) {
          try { entry.sourceNode.disconnect(); } catch (e) {}
        }
        entry.el.remove();
      }
      pool.clear();
      videoMapRef.current.clear();
      pendingSeeksRef.current.clear();
    };
  }, [triggerRedraw]);

  resultRef.current.videoElements = videoMapRef.current;
  resultRef.current.frameCache = frameCacheRef.current;
  return resultRef.current;
}

// ---------------------------------------------------------------------------
// Helper: Cubic Hermite interpolation for artifact-free resampling
// ---------------------------------------------------------------------------
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
    
    // Connect track analyser to master output chain
    if (masterAnalyser) {
      analyser.connect(masterAnalyser);
    } else if (masterCompressor) {
      analyser.connect(masterCompressor);
    } else {
      analyser.connect(audioCtx.destination);
      if (masterAudioDestination) {
        analyser.connect(masterAudioDestination);
      }
    }
    trackAnalysers.set(trackId, analyser);
  }
  return analyser;
}

function connectAudioNode(entry: MediaElement) {
  if ((entry as any)._isGraphConnected) return;
  const audioCtx = getMasterAudioCtx();
  if (!audioCtx || !entry.gainNode) return;

  const track = useEditorStore.getState().tracks.find(
    (t) => t.clips.some((c) => c.id === entry.clipId) || (t.overLayers || []).some((c) => c.id === entry.clipId)
  );
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
      if (masterAudioDestination) {
        entry.gainNode.connect(masterAudioDestination);
      }
    }
    (entry as any)._isGraphConnected = true;
  } catch (err) {
    console.warn('[Audio] Failed to connect node:', err);
  }
}

function disconnectAudioNode(entry: MediaElement) {
  if (!(entry as any)._isGraphConnected) return;
  try {
    if (entry.gainNode) {
      entry.gainNode.disconnect();
    }
    (entry as any)._isGraphConnected = false;
  } catch (err) {
    console.warn('[Audio] Failed to disconnect node:', err);
  }
}

// ---------------------------------------------------------------------------
// Helper: initialize Web Audio graph for real-time panning, pitch, humanizer, and EQ
// ---------------------------------------------------------------------------
function initAudioGraph(entry: MediaElement) {
  const audioCtx = getMasterAudioCtx();
  if (!audioCtx) return;

  try {
    const sourceNode = audioCtx.createMediaElementSource(entry.el);

    // Look up the parent track of this clip
    const track = useEditorStore.getState().tracks.find(t => t.clips.some(c => c.id === entry.clipId) || (t.overLayers || []).some(c => c.id === entry.clipId));
    const trackAnalyser = track ? getOrCreateTrackAnalyser(track.id, audioCtx) : null;

    // 1. Overlap-Add Hann-windowed granular pitch shifter (Stereo)
    //    Uses two overlapping grains with 50% overlap and Hann windows
    //    for artifact-free, smooth pitch shifting.
    const bufferSize = 4096;
    const pitchNode = audioCtx.createScriptProcessor(bufferSize, 2, 2);
    (pitchNode as any).pitch = 0;
    (pitchNode as any).humanize = false;

    const grainSize = 1024; // Grain length in samples (reduced from 2048 for smooth vocal pitch)
    const overlap = grainSize / 2; // 50% overlap
    const bufferLen = 65536;
    const writeBufL = new Float32Array(bufferLen);
    const writeBufR = new Float32Array(bufferLen);
    let writePos = 0;
    let readPosA = 0; // Grain A read head
    let readPosB = overlap; // Grain B read head (offset by 50%)
    let grainCounterA = 0; // Sample counter within grain A
    let grainCounterB = overlap; // Sample counter within grain B

    // Precompute Hann window
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

      const sepEnabled = false;
      const sepMode = 'removeVocals';
      const sepStrength = 80;

      let jitter = 0;
      if (isHumanize) {
        // Subtle 5.5 Hz micro-vibrato simulating human throat variation
        const time = e.playbackTime || (Date.now() / 1000);
        jitter = Math.sin(time * 2 * Math.PI * 5.5) * 0.06;
      }

      const semitones = pitch + jitter;
      if (Math.abs(semitones) < 0.01) {
        // Pitch is neutral; just pass through (after separation if needed)
        if (!sepEnabled) {
          outputL.set(inputL);
          outputR.set(inputR);
          return;
        }
        // If separation enabled with no pitch shift, process only separation
        for (let i = 0; i < inputL.length; i++) {
          let l = inputL[i], r = inputR[i];
          const mid = (l + r) * 0.5;
          const side = (l - r) * 0.5;
          const strength = sepStrength / 100;
          if (sepMode === 'removeVocals') {
            const midAtten = 1.0 - strength;
            outputL[i] = side * 2.0 + mid * midAtten;
            outputR[i] = -side * 2.0 + mid * midAtten;
          } else if (sepMode === 'removeBgm') {
            const sideAtten = 1.0 - strength;
            outputL[i] = mid + side * sideAtten;
            outputR[i] = mid - side * sideAtten;
          } else {
            const mix = 1.0 - strength * 0.5;
            outputL[i] = mid * strength + side * mix;
            outputR[i] = mid * strength - side * mix;
          }
        }
        return;
      }

      const ratio = Math.pow(2, semitones / 12);

      for (let i = 0; i < inputL.length; i++) {
        // Write input into circular buffer
        writeBufL[writePos] = inputL[i];
        writeBufR[writePos] = inputR[i];

        // Grain A: windowed read with cubic interpolation
        const winA = hannWindow[grainCounterA % grainSize];
        const rA = readPosA;
        const iA0 = ((Math.floor(rA) - 1) + bufferLen) % bufferLen;
        const iA1 = Math.floor(rA) % bufferLen;
        const iA2 = (iA1 + 1) % bufferLen;
        const iA3 = (iA1 + 2) % bufferLen;
        const fA = rA - Math.floor(rA);
        // Cubic Hermite interpolation for smooth resampling
        const cubicL_A = cubicInterp(writeBufL[iA0], writeBufL[iA1], writeBufL[iA2], writeBufL[iA3], fA);
        const cubicR_A = cubicInterp(writeBufR[iA0], writeBufR[iA1], writeBufR[iA2], writeBufR[iA3], fA);

        // Grain B: windowed read with cubic interpolation
        const winB = hannWindow[grainCounterB % grainSize];
        const rB = readPosB;
        const iB0 = ((Math.floor(rB) - 1) + bufferLen) % bufferLen;
        const iB1 = Math.floor(rB) % bufferLen;
        const iB2 = (iB1 + 1) % bufferLen;
        const iB3 = (iB1 + 2) % bufferLen;
        const fB = rB - Math.floor(rB);
        const cubicL_B = cubicInterp(writeBufL[iB0], writeBufL[iB1], writeBufL[iB2], writeBufL[iB3], fB);
        const cubicR_B = cubicInterp(writeBufR[iB0], writeBufR[iB1], writeBufR[iB2], writeBufR[iB3], fB);

        // Overlap-add the two windowed grains
        let grainL = cubicL_A * winA + cubicL_B * winB;
        let grainR = cubicR_A * winA + cubicR_B * winB;

        // Apply vocal separation after pitch shifting
        if (sepEnabled) {
          const mid = (grainL + grainR) * 0.5;
          const side = (grainL - grainR) * 0.5;
          const strength = sepStrength / 100;
          if (sepMode === 'removeVocals') {
            const midAtten = 1.0 - strength;
            grainL = side * 2.0 + mid * midAtten;
            grainR = -side * 2.0 + mid * midAtten;
          } else if (sepMode === 'removeBgm') {
            const sideAtten = 1.0 - strength;
            grainL = mid + side * sideAtten;
            grainR = mid - side * sideAtten;
          } else {
            const mix = 1.0 - strength * 0.5;
            grainL = mid * strength + side * mix;
            grainR = mid * strength - side * mix;
          }
        }

        outputL[i] = grainL;
        outputR[i] = grainR;

        writePos = (writePos + 1) % bufferLen;
        readPosA = (readPosA + ratio + bufferLen) % bufferLen;
        readPosB = (readPosB + ratio + bufferLen) % bufferLen;
        grainCounterA++;
        grainCounterB++;

        // Reset grain A when it completes a cycle
        if (grainCounterA >= grainSize) {
          grainCounterA = 0;
          // Snap grain A read head near the write head to stay in sync
          // Add a tiny random jitter (up to ±4ms / 180 samples) to break up periodic phase cancellation
          const pseudoRandom = ((writePos * 1103515245 + 12345) % 2147483648) / 2147483648;
            const jitterSamples = Math.floor((pseudoRandom - 0.5) * 180);
          readPosA = (writePos - grainSize + jitterSamples + bufferLen) % bufferLen;
        }
        // Reset grain B when it completes a cycle
        if (grainCounterB >= grainSize) {
          grainCounterB = 0;
          // Add a tiny random jitter (up to ±4ms / 180 samples) to break up periodic phase cancellation
          const pseudoRandom = ((writePos * 1103515245 + 12345) % 2147483648) / 2147483648;
            const jitterSamples = Math.floor((pseudoRandom - 0.5) * 180);
          readPosB = (writePos - grainSize + jitterSamples + bufferLen) % bufferLen;
        }
      }
    };

    // 0.5. Vocal Filter
    const vocalFilter = audioCtx.createBiquadFilter();
    vocalFilter.type = 'peaking';
    vocalFilter.frequency.value = 1500;
    vocalFilter.Q.value = 1.0;
    vocalFilter.gain.value = 0;

    // 0.8. Denoise Filter (Highshelf to cut hiss)
    const denoiseFilter = audioCtx.createBiquadFilter();
    denoiseFilter.type = 'highshelf';
    denoiseFilter.frequency.value = 4000;
    denoiseFilter.gain.value = 0;

    // 1. Bass equalizer filter (lowshelf at 200 Hz)
    const bassFilter = audioCtx.createBiquadFilter();
    bassFilter.type = 'lowshelf';
    bassFilter.frequency.value = 200;
    bassFilter.gain.value = 0;

    // 4. Treble equalizer filter (highshelf at 3000 Hz)
    const trebleFilter = audioCtx.createBiquadFilter();
    trebleFilter.type = 'highshelf';
    trebleFilter.frequency.value = 3000;
    trebleFilter.gain.value = 0;

    // 5. Room Ambience feedback delay loop
    //    feedbackInputGain gates audio INTO the delay chain (0.0 = fully bypassed, no energy accumulation)
    const feedbackInputGain = audioCtx.createGain();
    feedbackInputGain.gain.value = 0.0; // Bypassed by default — NO audio enters delay chain

    const delayNode = audioCtx.createDelay(1.0);
    delayNode.delayTime.value = 0.022; // 22ms room reflection

    const delayGain = audioCtx.createGain();
    delayGain.gain.value = 0.0; // Output wet level (bypassed by default)

    const feedbackNode = audioCtx.createGain();
    feedbackNode.gain.value = 0.15; // 15% decay feedback

    // 6. Stereo Panner node
    const pannerNode = audioCtx.createStereoPanner ? audioCtx.createStereoPanner() : undefined;

    // 7. Volume Gain node
    const gainNode = audioCtx.createGain();

    // Node connections (Default routing bypasses heavy FX)
    const separationGraph = createSeparationGraph(audioCtx);
    sourceNode.connect(separationGraph.input);
    separationGraph.output.connect(vocalFilter);
    vocalFilter.connect(denoiseFilter);
    denoiseFilter.connect(bassFilter);
    bassFilter.connect(trebleFilter);

    // Room Ambience: treble → feedbackInputGain (GATE) → delayNode → delayGain → panner/gain
    // The feedback loop is fully isolated behind feedbackInputGain — zero energy enters when gate is 0
    trebleFilter.connect(feedbackInputGain);
    feedbackInputGain.connect(delayNode);
    delayNode.connect(delayGain);
    delayNode.connect(feedbackNode);
    feedbackNode.connect(delayNode); // feedback loop (safe — gated at entry)

    // Panning & output destination routing
    if (pannerNode) {
      trebleFilter.connect(pannerNode);
      delayGain.connect(pannerNode);
      pannerNode.connect(gainNode);
    } else {
      trebleFilter.connect(gainNode);
      delayGain.connect(gainNode);
    }

    // Direct connection removed - managed dynamically by connectAudioNode/disconnectAudioNode


    // Attach to element pool entry
    entry.audioCtx = audioCtx;
    entry.sourceNode = sourceNode;
    entry.pitchNode = pitchNode;
    entry.vocalFilter = vocalFilter;
    entry.denoiseFilter = denoiseFilter;
    entry.bassFilter = bassFilter;
    entry.trebleFilter = trebleFilter;
    entry.delayNode = delayNode;
    entry.delayGain = delayGain;
    entry.feedbackInputGain = feedbackInputGain;
    entry.feedbackNode = feedbackNode;
    entry.pannerNode = pannerNode;
    entry.gainNode = gainNode;
    entry.separationGraph = separationGraph;
    entry._fxConnected = false;
  } catch (err) {
    console.warn('Unable to initialize Web Audio routing (user gesture required):', err);
  }
}

// ---------------------------------------------------------------------------
// Helper: Native Multi-band Crossover Vocal / BGM Separator Graph
// ---------------------------------------------------------------------------
interface SeparationGraph {
  input: GainNode;
  output: GainNode;
  lowGain: GainNode;
  highGain: GainNode;
  midOutputGain: GainNode;
  sideGain: GainNode;
  bypassGain: GainNode;
}

function createSeparationGraph(audioCtx: AudioContext): SeparationGraph {
  const input = audioCtx.createGain();
  const output = audioCtx.createGain();
  const bypassGain = audioCtx.createGain();

  // Dry/Bypass Path (direct connect from input to output)
  input.connect(bypassGain);
  bypassGain.connect(output);

  // 1. Low band path (< 180 Hz) - preserves sub bass/drums
  const lowpass = audioCtx.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = 180;
  const lowGain = audioCtx.createGain();
  input.connect(lowpass);
  lowpass.connect(lowGain);
  lowGain.connect(output);

  // 2. High band path (> 6000 Hz) - preserves cymbals/air
  const highpass = audioCtx.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.value = 6000;
  const highGain = audioCtx.createGain();
  input.connect(highpass);
  highpass.connect(highGain);
  highGain.connect(output);

  // 3. Mid band path (180 Hz - 6000 Hz) - where vocals reside
  const midHP = audioCtx.createBiquadFilter();
  midHP.type = 'highpass';
  midHP.frequency.value = 180;
  const midLP = audioCtx.createBiquadFilter();
  midLP.type = 'lowpass';
  midLP.frequency.value = 6000;
  input.connect(midHP);
  midHP.connect(midLP);

  // 4. Mid/Side Splitter on Mid band
  const splitter = audioCtx.createChannelSplitter(2);
  midLP.connect(splitter);

  // Mid sum: (L + R) * 0.5 (mono vocals extraction)
  const midSum = audioCtx.createGain();
  midSum.gain.value = 0.5;
  splitter.connect(midSum, 0); // L
  splitter.connect(midSum, 1); // R

  const midOutputGain = audioCtx.createGain();
  const midMerger = audioCtx.createChannelMerger(2);
  midSum.connect(midMerger, 0, 0);
  midSum.connect(midMerger, 0, 1);
  midMerger.connect(midOutputGain);
  midOutputGain.connect(output);

  // Side Left: 0.5 * L - 0.5 * R (extract out-of-phase left instruments)
  const sideL_direct = audioCtx.createGain();
  sideL_direct.gain.value = 0.5;
  const sideL_inv = audioCtx.createGain();
  sideL_inv.gain.value = -0.5;
  const sideL_sum = audioCtx.createGain();
  splitter.connect(sideL_direct, 0); // L
  splitter.connect(sideL_inv, 1);    // R
  sideL_direct.connect(sideL_sum);
  sideL_inv.connect(sideL_sum);

  // Side Right: 0.5 * R - 0.5 * L (extract out-of-phase right instruments)
  const sideR_direct = audioCtx.createGain();
  sideR_direct.gain.value = 0.5;
  const sideR_inv = audioCtx.createGain();
  sideR_inv.gain.value = -0.5;
  const sideR_sum = audioCtx.createGain();
  splitter.connect(sideR_direct, 1); // R
  splitter.connect(sideR_inv, 0);    // L
  sideR_direct.connect(sideR_sum);
  sideR_inv.connect(sideR_sum);

  const sideMerger = audioCtx.createChannelMerger(2);
  sideL_sum.connect(sideMerger, 0, 0);
  sideR_sum.connect(sideMerger, 0, 1);

  const sideGain = audioCtx.createGain();
  sideMerger.connect(sideGain);
  sideGain.connect(output);

  // Initialize with bypass enabled (filters muted by default)
  bypassGain.gain.value = 1.0;
  lowGain.gain.value = 0.0;
  highGain.gain.value = 0.0;
  midOutputGain.gain.value = 0.0;
  sideGain.gain.value = 0.0;

  return {
    input,
    output,
    lowGain,
    highGain,
    midOutputGain,
    sideGain,
    bypassGain
  };
}
