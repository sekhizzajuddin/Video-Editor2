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

import { useEffect, useRef, useCallback, useState } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { getMediaTimeForClip, getSpeedAtPosition } from '@/utils/speedRamp';
import { getAnimatedValue } from '@/utils/keyframes';
import { resolveMediaFile } from '@/utils/mediaFileHandle';

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
  midFilter?: BiquadFilterNode;         // NEW: Mid-band EQ (peaking @ 1kHz)
  trebleFilter?: BiquadFilterNode;
  compressorNode?: DynamicsCompressorNode; // NEW: Per-clip compressor
  deEsserFilter?: BiquadFilterNode;     // NEW: De-Esser (peaking @ 7kHz, negative)
  warmthFilter?: BiquadFilterNode;      // NEW: Warmth (lowshelf @ 250Hz)
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
export interface MediaPlaybackResult {
  videoElements: Map<string, HTMLVideoElement>;
}

function findClipById(clipId: string) {
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

// Global singletons for media playback DOM elements and audio routing to prevent duplicate instances
const globalMediaPool = new Map<string, MediaElement>();
const globalVideoMap = new Map<string, HTMLVideoElement>();
const globalPlaybackResult: MediaPlaybackResult = { videoElements: globalVideoMap };

let primaryControllerId: number | null = null;
let nextControllerId = 1;

export function useMediaPlayback(isController: boolean = true): MediaPlaybackResult {
  const poolRef = useRef<Map<string, MediaElement>>(globalMediaPool);
  const videoMapRef = useRef<Map<string, HTMLVideoElement>>(globalVideoMap);
  const resultRef = useRef<MediaPlaybackResult>(globalPlaybackResult);

  const [instanceId] = useState(() => {
    const id = nextControllerId++;
    if (isController && primaryControllerId === null) {
      primaryControllerId = id;
    }
    return id;
  });

  const isPrimary = isController && (primaryControllerId === null || primaryControllerId === instanceId);
  if (isController && primaryControllerId === null) {
    primaryControllerId = instanceId;
  }

  const tracks = useEditorStore((s) => s.tracks);
  const mediaLibrary = useEditorStore((s) => s.mediaLibrary);
  const isPlaying = useEditorStore((s) => s.isPlaying);
  const currentTime = useEditorStore((s) => s.currentTime);
  const volume = useEditorStore((s) => s.volume);
  const isMuted = useEditorStore((s) => s.isMuted);
  const muteTimelineAudio = useEditorStore((s) => s.muteTimelineAudio);
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

  // Eagerly guarantee master audio context is initialized so masterAudioStream is never null during export (Issue 1)
  if (typeof window !== 'undefined') {
    getMasterAudioCtx();
    if (masterAudioDestination) {
      const store = useEditorStore.getState();
      if (!store.masterAudioStream && masterAudioDestination.stream) {
        store.setMasterAudioStream(masterAudioDestination.stream);
      }
    }
  }

  // Sync master stream to store once
  useEffect(() => {
    if (!isPrimary) return;
    // ensure it's created
    getMasterAudioCtx();
    if (masterAudioDestination) {
      useEditorStore.getState().setMasterAudioStream(masterAudioDestination.stream);
    }
  }, [isPrimary]);

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

    const addIfNew = (clip: any, track: any, overrideStartTime?: number) => {
      if (addedClipIds.has(clip.id)) return;
      addedClipIds.add(clip.id);
      result.push({
        clipId: clip.id,
        mediaId: clip.mediaId,
        clipStart: overrideStartTime !== undefined ? overrideStartTime : clip.startTime,
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

        // 3. PIP active clips
        const pipWindows = useEditorStore.getState().pipWindows || {};
        const clipPips = Object.values(pipWindows).filter(p => p.parentClipId === clip.id);
        for (const pip of clipPips) {
          const pipAbsStart = clip.startTime + pip.relativeStartTime;
          if (currentTime >= pipAbsStart && currentTime < pipAbsStart + pip.duration) {
            for (const pipTrack of pip.tracks) {
              for (const pipClip of pipTrack.clips) {
                const ptAbsStart = pipAbsStart + pipClip.startTime;
                if (currentTime >= ptAbsStart && currentTime < ptAbsStart + pipClip.duration) {
                  const mergedTrack = {
                    ...pipTrack,
                    muted: track.muted || pipTrack.muted || pipTrack.hidden
                  };
                  addIfNew(pipClip, mergedTrack, ptAbsStart);
                }
              }
            }
          }
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
    }
    return result;
  }, [tracks, currentTime]);

  // PERFORMANCE: Only create media elements for clips NEAR the playhead.
  // Video elements are kept within 5s window to avoid browser hardware decoder exhaustion (4-8 max).
  // Audio clips use 15s window since WebAudio is lightweight.
  const VIDEO_PROXIMITY_WINDOW = 5; // seconds
  const AUDIO_PROXIMITY_WINDOW = 15; // seconds
  const MAX_GLOBAL_FRAME_CACHE = 30; // max cached ImageBitmaps across ALL clips (was 120 per clip)
  const MAX_PER_CLIP_FRAME_CACHE = 8; // max cached frames per individual clip

  useEffect(() => {
    if (!isPrimary) return;
    const ct = useEditorStore.getState().currentTime;
    const neededClips = new Map<string, { mediaId: string; type: 'video' | 'audio' }>();
    for (const track of tracks) {
      for (const clip of track.clips) {
        if (track.hidden) continue;
        const media = mediaLibrary.find((m) => m.id === clip.mediaId);
        if (media && media.url && (media.type === 'video' || media.type === 'audio')) {
          const prox = media.type === 'video' ? VIDEO_PROXIMITY_WINDOW : AUDIO_PROXIMITY_WINDOW;
          const isNearPlayhead = (ct >= clip.startTime - prox && ct < clip.startTime + clip.duration + prox);
          if (isNearPlayhead) {
            neededClips.set(clip.id, {
              mediaId: clip.mediaId,
              type: media.type,
            });
          }
        }
      }
      // Collect nested PIP clips (only near playhead)
      const pipWindows = useEditorStore.getState().pipWindows || {};
      for (const clip of track.clips) {
        const clipPips = Object.values(pipWindows).filter(p => p.parentClipId === clip.id);
        for (const pip of clipPips) {
          for (const pipTrack of pip.tracks) {
            for (const pipClip of pipTrack.clips) {
              const media = mediaLibrary.find((m) => m.id === pipClip.mediaId);
              if (media && media.url && (media.type === 'video' || media.type === 'audio')) {
                const absStart = clip.startTime + pip.relativeStartTime + pipClip.startTime;
                const prox = media.type === 'video' ? VIDEO_PROXIMITY_WINDOW : AUDIO_PROXIMITY_WINDOW;
                const isNearPlayhead = (ct >= absStart - prox && ct < absStart + pipClip.duration + prox);
                if (isNearPlayhead) {
                  neededClips.set(pipClip.id, {
                    mediaId: pipClip.mediaId,
                    type: media.type,
                  });
                }
              }
            }
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
          triggerRedraw();
          const pendingTime = pendingSeeksRef.current.get(clipId);
          if (pendingTime !== undefined) {
            pendingSeeksRef.current.delete(clipId);
            // ALWAYS use exact currentTime assignment for pending seeks (not fastSeek).
            // fastSeek jumps to the nearest keyframe which can be seconds away,
            // causing extremely choppy scrubbing visuals.
            el.currentTime = pendingTime;
          }
        };

        (el as any)._handleSeeked = handleSeeked;

        el.addEventListener('seeked', handleSeeked);
        el.addEventListener('timeupdate', stableTriggerRedraw);
        el.addEventListener('canplay', stableTriggerRedraw);

        // requestVideoFrameCallback fires exactly when a NEW video frame is presented.
        // This is far more reliable than 'seeked' or 'timeupdate' for detecting decoded frames
        // during scrubbing, since it fires per-frame (not per-seek-completion).
        if ('requestVideoFrameCallback' in el) {
          const onVideoFrame = () => {
            if (!poolRef.current.has(clipId)) return; // element removed
            triggerRedraw();
            // Re-register for the next frame and store the handle for cleanup
            (el as any)._rvfcHandle = (el as any).requestVideoFrameCallback(onVideoFrame);
          };
          (el as any)._rvfcHandle = (el as any).requestVideoFrameCallback(onVideoFrame);

          // rAF fallback when tab regains focus or visibility changes (Audit Item #39)
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

        getMediaContainer().appendChild(el);
        // el.load() not called here — proximity preloader will manage it
        
        const entry: MediaElement = { el, clipId, mediaId: info.mediaId, type: 'video' };
        // PERFORMANCE FIX: Audio graph is now initialized LAZILY when the clip becomes active,
        // not eagerly on element creation. This prevents 240+ audio nodes from being created
        // for 12 clips that aren't even playing.
        pool.set(clipId, entry);
        videoMapRef.current.set(clipId, el);
      } else if (info.type === 'audio') {
        const el = document.createElement('audio');
        el.preload = 'auto';
        el.crossOrigin = 'anonymous';
        el.src = media.url;
        el.style.display = 'none';

        // Drain pending seeks when a seek finishes. If we don't do this, rapid loop jumps
        // (e.g. when a clip is selected and loops) will leave the audio element permanently out of sync.
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

        getMediaContainer().appendChild(el);
        el.load(); // Force the browser to start fetching the audio
        
        const entry: MediaElement = { el, clipId, mediaId: info.mediaId, type: 'audio' };
        // PERFORMANCE FIX: Audio graph deferred to when clip is active
        pool.set(clipId, entry);
      }
    }

    // Remove elements that are no longer needed (either removed from timeline or moved far from playhead)
    for (const [clipId, entry] of pool) {
      if (!neededClips.has(clipId)) {
        entry.el.pause();
        const el = entry.el as any;
        if (el._handleSeeked) {
          el.removeEventListener('seeked', el._handleSeeked);
        }
        
        if (entry.type === 'video') {
          el.removeEventListener('timeupdate', stableTriggerRedraw);
          el.removeEventListener('canplay', stableTriggerRedraw);
          // Cancel pending requestVideoFrameCallback to prevent leak
          if (el._rvfcHandle != null && 'cancelVideoFrameCallback' in el) {
            el.cancelVideoFrameCallback(el._rvfcHandle);
            el._rvfcHandle = null;
          }
          if (el._onVisibilityChange) {
            document.removeEventListener('visibilitychange', el._onVisibilityChange);
            el._onVisibilityChange = null;
          }
        }
        
        if (entry.separationGraph) {
          try { entry.separationGraph.input.disconnect(); } catch (e) {}
        }
        if (entry.pitchNode) {
          try { entry.pitchNode.disconnect(); } catch (e) {}
        }
        if (entry.gainNode) {
          try { entry.gainNode.disconnect(); } catch (e) {}
        }
        if (entry.sourceNode) { try { entry.sourceNode.disconnect(); } catch (e) {} }

        if (entry.feedbackNode) {
          try { entry.feedbackNode.disconnect(); } catch(e) {}
        }
        if (entry.delayNode) {
          try { entry.delayNode.disconnect(); } catch(e) {}
        }

        entry.el.src = '';
        entry.el.remove();
        pool.delete(clipId);
        videoMap.delete(clipId);
        pendingSeeksRef.current.delete(clipId);
      }
    }
  }, [tracks, mediaLibrary, currentTime, stableTriggerRedraw]);

  // Sync playback state — play / pause / seek
  const lastVideoSyncRef = useRef<number>(0);

  useEffect(() => {
    if (!isPrimary) return;
    const syncPlayback = async () => {
      const now = performance.now();
      const isScrubbing = useEditorStore.getState().isScrubbing;
      const syncInterval = isPlaying ? 33 : 0;
      if (now - lastVideoSyncRef.current < syncInterval) return;
      lastVideoSyncRef.current = now;

      const pool = poolRef.current;
      const clips = activeClips();

      const playingIds = new Set(clips.map((c) => c.clipId));

      const elapsedRealTime = (now - lastRealTimeRef.current) / 1000;
      const expectedPlaybackTime = lastTimeRef.current + elapsedRealTime * playbackSpeed;

      // Detect if playback has just started, or if the user performed a manual seek
      const playStarted = isPlaying && !wasPlayingRef.current;
      const userSeeked = !isPlaying || Math.abs(currentTime - expectedPlaybackTime) > 0.01;
      const forceSeek = playStarted || userSeeked;

      lastTimeRef.current = currentTime;
      lastRealTimeRef.current = now;
      wasPlayingRef.current = isPlaying;

      // During scrubbing, force-pause every media element so no audio bleeds through.
      // The visual frame still updates because the engine draws from currentTime
      // on each RAF tick — the HTMLMediaElement is only used for audio decoding.
      if (isScrubbing) {
        for (const [, entry] of pool) {
          if (!entry.el.paused) entry.el.pause();
        }
        return; // skip the rest of the sync loop while scrubbing
      }
  
      for (const [clipId, entry] of pool) {
        const clip = clips.find((c) => c.clipId === clipId);
        const isActiveAndPlaying = !!clip && isPlaying;
  
        if (isActiveAndPlaying) {
          // PERFORMANCE FIX: Lazily initialize audio graph on first activation
          if (!entry.sourceNode) {
            initAudioGraph(entry);
          }
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
            if (window.requestIdleCallback) {
              window.requestIdleCallback(() => {
                entry.audioCtx?.resume().catch(console.warn);
              });
            } else {
              setTimeout(() => {
                entry.audioCtx?.resume().catch(console.warn);
              }, 0);
            }
          }
        }
        
        if (!clip) continue;

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

        if (clipForceSeek) {
          // On play-start, loop wrap, user seek, or clip activation:
          // ALWAYS seek to exact mediaTime with near-zero threshold.
          // This eliminates the 150ms grace that caused audible desync on selected-clip loops.
          if (drift > 0.01) {
            entry.el.currentTime = mediaTime;
            pendingSeeksRef.current.delete(clipId);
          }
        } else {
          // Normal steady-state playback: only hard-seek if drift exceeds 150ms.
          // The PLL (playbackRate adjustment) handles sub-150ms drift smoothly.
          const driftLimit = isReversing ? 0.02 : 0.15;
          if (drift > driftLimit) {
            if (!entry.el.seeking) {
              entry.el.currentTime = mediaTime;
              pendingSeeksRef.current.delete(clipId);
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

    // Strictly pause inactive elements. Do NOT perform background seeks on inactive clips to prevent decoder congestion & desync on active clip playback.
    for (const [clipId, entry] of pool) {
      const isActive = playingIds.has(clipId);
      if (!isActive) {
        if (!entry.el.paused) {
          entry.el.pause();
        }
        pendingSeeksRef.current.delete(clipId);
      }
    }

    // Update active clip IDs ref
    lastActiveClipIdsRef.current = playingIds;
  };
  syncPlayback();
}, [isPlaying, currentTime, playbackSpeed, activeClips, mediaLibrary, tracks]);

  // Cleanup orphaned track analysers
  useEffect(() => {
    if (!isPrimary) return;
    const activeTrackIds = new Set(tracks.map(t => t.id));
    for (const [trackId, analyser] of trackAnalysers.entries()) {
      if (!activeTrackIds.has(trackId)) {
        try { analyser.disconnect(); } catch (e) {}
        trackAnalysers.delete(trackId);
      }
    }
  }, [tracks, isPrimary]);

  // Reactively sync audio parameters (volume, EQ, pitch, etc.) for all clips in the pool
  useEffect(() => {
    if (!isPrimary) return;
    const pool = poolRef.current;
    const clips = activeClips();
    const playingIds = new Set(clips.map((c) => c.clipId));

    
    const clipNodeMap = new Map();
    const state = useEditorStore.getState();
    for (const track of state.tracks) {
      for (const clip of track.clips) {
        clipNodeMap.set(clip.id, { clip, track, absStartTime: clip.startTime });
      }
    }
    const pipWindows = state.pipWindows || {};
    for (const track of state.tracks) {
      for (const clip of track.clips) {
        const clipPips = Object.values(pipWindows).filter(p => p.parentClipId === clip.id);
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

    for (const [clipId, entry] of pool) {
      if (!playingIds.has(clipId)) continue;
      // Find the clip in the tracks
      const foundNode = clipNodeMap.get(clipId);

      const fullClip = foundNode ? foundNode.clip : null;
      const targetTrack = foundNode ? foundNode.track : null;

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

      const clipStart = foundNode?.absStartTime ?? fullClip.startTime;
      // Evaluate animated volume and pan from keyframes
      const animatedVolume = getAnimatedValue(
        audioSettings.volume,
        currentTime,
        clipStart,
        fullClip.animations?.['audio.volume']
      );
      const animatedPan = getAnimatedValue(
        audioSettings.pan,
        currentTime,
        clipStart,
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

      // Reactive FX Routing: lazily create ScriptProcessorNode only when pitch/humanize is first needed.
      // For normal playback (pitch=0, humanize=false), NO ScriptProcessorNode is ever created.
      const needsFx = Math.abs(audioSettings.pitch) > 0.01 || audioSettings.humanize;
      const audioCtxForFx = entry.audioCtx;
      if (needsFx && audioCtxForFx) {
        // Lazily create the pitchNode if it doesn't exist yet
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
      if (entry.midFilter) {
        const targetMid = Math.max(-15, Math.min(15, audioSettings.mid ?? 0));
        if (Math.abs(entry.midFilter.gain.value - targetMid) > 0.1) entry.midFilter.gain.setTargetAtTime(targetMid, ctxTime, rampTime);
      }
      if (entry.trebleFilter) {
        const baseTreble = (audioSettings.treble || 0) + (audioSettings.humanize ? 1.0 : 0);
        const targetTreble = Math.max(-15, Math.min(15, baseTreble));
        if (Math.abs(entry.trebleFilter.gain.value - targetTreble) > 0.1) entry.trebleFilter.gain.setTargetAtTime(targetTreble, ctxTime, rampTime);
      }
      // Compression: 0% = ratio 1:1 (bypass), 100% = ratio 20:1 with threshold -24dB
      if (entry.compressorNode) {
        const comp = (audioSettings.compression ?? 0) / 100;
        const targetThreshold = comp > 0 ? -24 * comp : 0;
        const targetRatio = 1 + 19 * comp;
        if (Math.abs(entry.compressorNode.threshold.value - targetThreshold) > 0.5)
          entry.compressorNode.threshold.setTargetAtTime(targetThreshold, ctxTime, rampTime);
        if (Math.abs(entry.compressorNode.ratio.value - targetRatio) > 0.5)
          entry.compressorNode.ratio.setTargetAtTime(targetRatio, ctxTime, rampTime);
      }
      // De-Esser: 0% = 0dB, 100% = -18dB cut at 7kHz
      if (entry.deEsserFilter) {
        const targetDeEsserGain = -((audioSettings.deEsser ?? 0) / 100) * 18;
        if (Math.abs(entry.deEsserFilter.gain.value - targetDeEsserGain) > 0.1)
          entry.deEsserFilter.gain.setTargetAtTime(targetDeEsserGain, ctxTime, rampTime);
      }
      // Warmth: -100 = -6dB at 250Hz (thin), 0 = flat, +100 = +6dB at 250Hz (warm)
      if (entry.warmthFilter) {
        const targetWarmth = ((audioSettings.warmth ?? 0) / 100) * 6;
        if (Math.abs(entry.warmthFilter.gain.value - targetWarmth) > 0.1)
          entry.warmthFilter.gain.setTargetAtTime(targetWarmth, ctxTime, rampTime);
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
      const isMutedGlobally = isMutedTrack || isMuted || !!muteTimelineAudio;
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
      
      const isScrubbing = useEditorStore.getState().isScrubbing;
      const direction = useEditorStore.getState().playbackDirection ?? 1;
      const isReversing = direction < 0;

      let targetSpeed = Math.max(0.1, playbackSpeed * effectiveSpeed);

      // Gentle sync catchup (PLL) logic to keep native HTML5 media precisely aligned
      // with the global RAF timeline clock without hard-seeking.
      if (isPlaying && !isScrubbing && !isReversing) {
        if (Math.abs(rawDrift) > 0.15) {
          // Large drift (>150ms): hard-seek immediately. This is the safety net
          // for loop wraps and missed corrections from the throttled syncPlayback.
          if (!entry.el.seeking) {
            entry.el.currentTime = mediaTime;
          }
        } else if (Math.abs(rawDrift) > 0.02) {
          const MAX_ADJUSTMENT = 0.03; // Limit adjustment to 3% to prevent audible pitch shifting
          let adjustment = rawDrift * 0.3; // Proportional control
          if (Math.abs(adjustment) > MAX_ADJUSTMENT) {
            adjustment = Math.sign(adjustment) * MAX_ADJUSTMENT;
          }
          targetSpeed *= (1 - adjustment);
        }
      }

      if (Math.abs(entry.el.playbackRate - targetSpeed) > 0.005) {
        entry.el.playbackRate = targetSpeed;
      }
    }
  }, [tracks, volume, isMuted, muteTimelineAudio, playbackSpeed, currentTime, isPlaying, mediaLibrary]);

  // On seek (when not playing), update video elements for frame display
  useEffect(() => {
    if (!isPrimary || isPlaying) return;

    const pool = poolRef.current;
    const clips = activeClips();

    for (const clip of clips) {
      const entry = pool.get(clip.clipId);
      if (!entry) continue;

      const el = entry.el;
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
        if (drift > 0.005) {
          el.currentTime = mediaTime;
        }
      }
    }
  }, [currentTime, isPlaying, activeClips, mediaLibrary]);

  // DIRECT Zustand subscription for instant video element seeking during scrubbing (bypasses React render cycle)
  // This ensures video elements start seeking IMMEDIATELY when store state changes, without waiting for React re-render
  useEffect(() => {
    if (!isPrimary) return;
    // Removed artificial throttle – let the browser coalesce seeks naturally.
    // This ensures we respond to every critical currentTime update during scrubbing.
    const unsub = useEditorStore.subscribe((state) => {
      if (state.isPlaying) return;

      const newTime = state.currentTime;
      // No explicit time throttling – we rely on the browser's internal coalescing.

      const pool = poolRef.current;
      if (!pool || pool.size === 0) return;

      // Read fresh state directly from store to avoid stale closures
      const freshMediaLibrary = useEditorStore.getState().mediaLibrary;
      const freshTracks = useEditorStore.getState().tracks;

      // PERF: build mediaMap once per scrub tick — was O(N) per clip.
      const mediaMap = new Map<string, any>();
      for (let i = 0; i < freshMediaLibrary.length; i++) {
        mediaMap.set(freshMediaLibrary[i].id, freshMediaLibrary[i]);
      }

      // Build active clips from fresh tracks
      const clipsArr: Array<{ clipId: string; mediaId: string; clipStart: number; clipDuration: number; trimStart: number; speed: number; speedRamp?: any }> = [];
      for (const track of freshTracks) {
        if (track.hidden) continue;
        for (const clip of track.clips) {
          if (track.type === 'video' || track.type === 'audio' || (clip as any).type === 'video') {
            if (newTime >= clip.startTime && newTime < clip.startTime + clip.duration) {
              clipsArr.push({
                clipId: clip.id,
                mediaId: clip.mediaId,
                clipStart: clip.startTime,
                clipDuration: clip.duration,
                trimStart: (clip as any).trimStart ?? 0,
                speed: (clip as any).speed ?? 1,
                speedRamp: (clip as any).speedRamp,
              });
            }
          }
        }
      }

      for (const clip of clipsArr) {
        const entry = pool.get(clip.clipId);
        if (!entry || entry.type !== 'video') continue;

        const el = entry.el as HTMLVideoElement;
        // PERF: O(1) lookup via mediaMap built above.
        const mediaItem = mediaMap.get(clip.mediaId);
        const maxDuration = mediaItem ? mediaItem.duration : 10000;
        const mediaTime = Math.max(0, Math.min(maxDuration, getMediaTimeForClip({
          id: clip.clipId,
          startTime: clip.clipStart,
          duration: clip.clipDuration,
          trimStart: clip.trimStart,
          speed: clip.speed,
          speedRamp: clip.speedRamp
        }, newTime)));

        if (el.seeking) {
          pendingSeeksRef.current.set(clip.clipId, mediaTime);
        } else {
          const drift = Math.abs(el.currentTime - mediaTime);
if (true) {
            // Use exact currentTime for scrub seeking for frame-accuracy.
            el.currentTime = mediaTime;
            // Add a one-shot seeked listener to drain the pending seek queue immediately
            const onSeeked = () => {
              const pending = pendingSeeksRef.current.get(clip.clipId);
              if (pending !== undefined) {
                pendingSeeksRef.current.delete(clip.clipId);
                const d2 = Math.abs(el.currentTime - pending);
                el.currentTime = pending;
              }
            };
            el.addEventListener('seeked', onSeeked, { once: true });
          }
        }
      }
    });
    
    return unsub;
  }, []);

  // Dynamically load/unload video sources based on proximity to currentTime to prevent decoder starvation
  // PERFORMANCE FIX: Added MAX_LOADED_VIDEOS cap to prevent exceeding browser's hardware decoder limit
  const MAX_LOADED_VIDEOS = 4;

  useEffect(() => {
    if (!isPrimary) return;
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

    // Collect all video entries with their distance from playhead
    const videoEntries: { clipId: string; entry: MediaElement; dist: number; absStart: number; clipDuration: number; media: any; clipObj: any }[] = [];
    for (const [clipId, entry] of pool) {
      if (entry.type !== 'video') continue;
      
      const foundNode = findClipById(clipId);
      const clipTrack = foundNode ? foundNode.track : null;
      const clipObj = foundNode ? foundNode.clip : null;
      
      if (!clipObj || !clipTrack || clipTrack.hidden) continue;
      
      const media = mediaLibrary.find((m) => m.id === entry.mediaId);
      if (!media || !media.url || media.url === 'PENDING_RESTORE') continue;
      
      const absStart = foundNode ? foundNode.absStartTime : clipObj.startTime;
      const clipEnd = absStart + clipObj.duration;
      // Distance: 0 if playhead is inside clip, otherwise distance to nearest edge
      const dist = currentTime >= absStart && currentTime < clipEnd ? 0 : Math.min(Math.abs(currentTime - absStart), Math.abs(currentTime - clipEnd));
      
      videoEntries.push({ clipId, entry, dist, absStart, clipDuration: clipObj.duration, media, clipObj });
    }

    // Sort by distance (closest first) and only load the nearest MAX_LOADED_VIDEOS
    videoEntries.sort((a, b) => a.dist - b.dist);

    const getProximityWindow = (mediaItem: any) => {
      const height = mediaItem.height || 1080;
      if (height >= 2160) return 5;  // 4K: only 5 sec
      if (height >= 1080) return 10; // 1080p: 10 sec
      return 15; // 720p or lower: 15 sec
    };

    const loadedCount = { current: 0 };
    for (const ve of videoEntries) {
      const el = ve.entry.el as HTMLVideoElement;
      const isNear = ve.dist <= getProximityWindow(ve.media);
      const canLoad = loadedCount.current < MAX_LOADED_VIDEOS;

      if (isNear && canLoad) {
        const targetSrc = ve.media.url;

        // PENDING_RESTORE means the URL was cleared on project reload and
        // needs to be re-resolved from the persistent handle / IDB store.
        // For freshly imported media, media.url is a live blob: URL the
        // browser can range-request efficiently — we never want to slice
        // the file ourselves because MP4 containers need their moov atom.
        if (targetSrc === 'PENDING_RESTORE' || !targetSrc) {
          resolveMediaFile(ve.entry.mediaId)
            .then((file) => (file ? URL.createObjectURL(file) : null))
            .then((restoredUrl) => {
              if (!restoredUrl) return;
              if (el.src !== restoredUrl && !el.src.endsWith(restoredUrl)) {
                el.src = restoredUrl;
                el.load();
                // Persist the restored URL so subsequent renders skip this path
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
            .catch(() => {
              // Could not resolve — leave element unloaded
            });
        } else if (el.src !== targetSrc && !el.src.endsWith(targetSrc)) {
          // Live blob URL — assign directly. The browser issues range
          // requests internally and only fetches what the decoder needs,
          // so RAM stays bounded without our manual slicing.
          el.src = targetSrc;
          const pendingTime = pendingSeeksRef.current.get(ve.clipId);
          if (pendingTime !== undefined) {
            el.currentTime = pendingTime;
            pendingSeeksRef.current.delete(ve.clipId);
          }
          el.load();
        }
        loadedCount.current++;
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
      if (primaryControllerId === instanceId) {
        primaryControllerId = null;
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
          if (entry.separationGraph) {
            try { entry.separationGraph.input.disconnect(); } catch (e) {}
          }
          if (entry.pitchNode) {
            try { entry.pitchNode.disconnect(); } catch (e) {}
          }
          if (entry.gainNode) {
            try { entry.gainNode.disconnect(); } catch (e) {}
          }
          if (entry.sourceNode) { try { entry.sourceNode.disconnect(); } catch (e) {} }

          if (entry.feedbackNode) {
            try { entry.feedbackNode.disconnect(); } catch(e) {}
          }
          if (entry.delayNode) {
            try { entry.delayNode.disconnect(); } catch(e) {}
          }

          entry.el.src = '';
          entry.el.remove();
        }
        pool.clear();
        videoMapRef.current.clear();
        pendingSeeksRef.current.clear();
      }
    };
  }, [triggerRedraw, instanceId]);

  // S1.3 — Hard pause when tab hidden: fully pause all media elements and
  // cancel their requestVideoFrameCallback handles so the browser releases
  // decoders + audio decode threads. Restored on tab visible.
  useEffect(() => {
    if (!isPrimary) return;
    const onVisibility = () => {
      const pool = poolRef.current;
      if (document.hidden) {
        // Pause everything; cache current state so we can resume identically
        for (const [, entry] of pool) {
          if (!entry.el.paused) entry.el.pause();
          // Cancel requestVideoFrameCallback to release the decoder thread
          const el = entry.el as any;
          if (el._rvfcHandle != null && 'cancelVideoFrameCallback' in el) {
            try { el.cancelVideoFrameCallback(el._rvfcHandle); } catch {}
            el._rvfcHandle = null;
          }
        }
      } else {
        // Resume only the playhead's active elements; the proximity loader
        // will re-attach sources on the next tick.
        for (const [, entry] of pool) {
          if (entry.type === 'video') {
            const el = entry.el as any;
            if ('requestVideoFrameCallback' in el) {
              const onVideoFrame = () => {
                if (!poolRef.current.has(entry.clipId)) return;
                stableTriggerRedraw();
                el._rvfcHandle = (el as any).requestVideoFrameCallback(onVideoFrame);
              };
              el._rvfcHandle = (el as any).requestVideoFrameCallback(onVideoFrame);
            }
          }
        }
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [isPrimary, stableTriggerRedraw]);

  useEffect(() => {
    resultRef.current.videoElements = videoMapRef.current;
  }, [stableTriggerRedraw]);

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
// Helper: create pitch-shifter ScriptProcessorNode on demand (lazy, only when needed)
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Helper: initialize Web Audio graph for real-time panning, EQ, and routing
// NOTE: ScriptProcessorNode (pitchNode) is NOT created here — it is created
// lazily only when pitch != 0 or humanize is enabled (see reactive sync effect).
// ---------------------------------------------------------------------------
function initAudioGraph(entry: MediaElement) {
  const audioCtx = getMasterAudioCtx();
  if (!audioCtx) return;

  try {
    const sourceNode = audioCtx.createMediaElementSource(entry.el);

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

    // 4a. Mid equalizer filter (peaking at 1000 Hz — vocal presence)
    const midFilter = audioCtx.createBiquadFilter();
    midFilter.type = 'peaking';
    midFilter.frequency.value = 1000;
    midFilter.Q.value = 1.0;
    midFilter.gain.value = 0;

    // 4b. Per-clip Compressor (Dynamic Range)
    const compressorNode = audioCtx.createDynamicsCompressor();
    compressorNode.threshold.value = 0;   // 0 = fully bypassed (threshold at 0dB clips nothing)
    compressorNode.knee.value = 40;
    compressorNode.ratio.value = 1;       // ratio 1:1 = no compression
    compressorNode.attack.value = 0.003;
    compressorNode.release.value = 0.25;

    // 4c. De-Esser filter (peaking at 7000 Hz, negative gain reduces sibilance)
    const deEsserFilter = audioCtx.createBiquadFilter();
    deEsserFilter.type = 'peaking';
    deEsserFilter.frequency.value = 7000;
    deEsserFilter.Q.value = 2.0;
    deEsserFilter.gain.value = 0;

    // 4d. Warmth filter (lowshelf at 250 Hz — low-mid body)
    const warmthFilter = audioCtx.createBiquadFilter();
    warmthFilter.type = 'lowshelf';
    warmthFilter.frequency.value = 250;
    warmthFilter.gain.value = 0;

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
    bassFilter.connect(midFilter);
    midFilter.connect(trebleFilter);
    trebleFilter.connect(compressorNode);
    compressorNode.connect(deEsserFilter);
    deEsserFilter.connect(warmthFilter);

    // Room Ambience: warmth → feedbackInputGain (GATE) → delayNode → delayGain → panner/gain
    // The feedback loop is fully isolated behind feedbackInputGain — zero energy enters when gate is 0
    warmthFilter.connect(feedbackInputGain);
    feedbackInputGain.connect(delayNode);
    delayNode.connect(delayGain);
    delayNode.connect(feedbackNode);
    feedbackNode.connect(delayNode); // feedback loop (safe — gated at entry)

    // Panning & output destination routing
    if (pannerNode) {
      warmthFilter.connect(pannerNode);
      delayGain.connect(pannerNode);
      pannerNode.connect(gainNode);
    } else {
      warmthFilter.connect(gainNode);
      delayGain.connect(gainNode);
    }

    // Direct connection removed - managed dynamically by connectAudioNode/disconnectAudioNode


    // Attach to element pool entry
    entry.audioCtx = audioCtx;
    entry.sourceNode = sourceNode;
    // entry.pitchNode is intentionally NOT set here — created lazily when pitch/humanize is first needed
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

/**
 * Synchronous seek helper for WebCodecs and frame-accurate exports (Issue 4).
 * Ensures all video elements active at targetTime have finished seeking before returning.
 */
export async function synchronousSeek(targetTime: number): Promise<void> {
  const store = useEditorStore.getState();
  store.seek(targetTime);

  const tracks = store.tracks || [];
  const promises: Promise<void>[] = [];

  for (const track of tracks) {
    if (track.muted || track.hidden || track.type !== 'video') continue;
    for (const clip of (track.clips || [])) {
      if (targetTime >= clip.startTime && targetTime <= clip.startTime + clip.duration) {
        const v = globalVideoMap.get(clip.id);
        if (v && v.readyState >= 1) {
          const mediaTime = clip.trimStart + (targetTime - clip.startTime) * (clip.speed || 1);
          if (Math.abs(v.currentTime - mediaTime) > 0.01 || v.seeking) {
            promises.push(
              new Promise<void>((resolve) => {
                const handler = () => {
                  v.removeEventListener('seeked', handler);
                  resolve();
                };
                v.addEventListener('seeked', handler, { once: true });
                v.currentTime = mediaTime;
                setTimeout(resolve, 200); // hard timeout to prevent deadlocks
              })
            );
          }
        }
      }
    }
  }
  if (promises.length > 0) {
    await Promise.all(promises);
  }
}

/**
 * Safe cloned live audio stream getter for export pipelines (Issue 1).
 * Clones the master audio destination stream to avoid stale handle errors.
 */
export async function getLiveAudioStream(): Promise<MediaStream | null> {
  if (typeof window !== 'undefined') {
    getMasterAudioCtx();
  }
  const master = useEditorStore.getState().masterAudioStream || (masterAudioDestination ? masterAudioDestination.stream : null);
  if (!master || master.getAudioTracks().length === 0) {
    return null;
  }
  return master.clone();
}
