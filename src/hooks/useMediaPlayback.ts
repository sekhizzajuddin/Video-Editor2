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
        
        // Master Dynamics Compressor/Limiter to prevent clipping and balance track volume levels
        masterCompressor = masterAudioCtx.createDynamicsCompressor();
        masterCompressor.threshold.value = -12; // dBFS
        masterCompressor.knee.value = 6;
        masterCompressor.ratio.value = 4;
        masterCompressor.attack.value = 0.003;
        masterCompressor.release.value = 0.25;
        
        // Master analyser for VU metering
        masterAnalyser = masterAudioCtx.createAnalyser();
        masterAnalyser.fftSize = 64;
        if (typeof window !== 'undefined') {
          (window as any).procutMasterAnalyser = masterAnalyser;
        }
        
        // Route master compressor output to master analyser, then to speakers and export
        masterCompressor.connect(masterAnalyser);
        masterAnalyser.connect(masterAudioCtx.destination);
        masterAnalyser.connect(masterAudioDestination);
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
  bassFilter?: BiquadFilterNode;
  trebleFilter?: BiquadFilterNode;
  pannerNode?: StereoPannerNode;
  gainNode?: GainNode;
  delayNode?: DelayNode;
  delayGain?: GainNode;
  feedbackNode?: GainNode;
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
export function useMediaPlayback(): Map<string, HTMLVideoElement> {
  const poolRef = useRef<Map<string, MediaElement>>(new Map());
  const videoMapRef = useRef<Map<string, HTMLVideoElement>>(new Map());

  const tracks = useEditorStore((s) => s.tracks);
  const mediaLibrary = useEditorStore((s) => s.mediaLibrary);
  const isPlaying = useEditorStore((s) => s.isPlaying);
  const currentTime = useEditorStore((s) => s.currentTime);
  const volume = useEditorStore((s) => s.volume);
  const isMuted = useEditorStore((s) => s.isMuted);
  const playbackSpeed = useEditorStore((s) => s.playbackSpeed);

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
        if (idx > 0) {
          const prevClip = sortedClips[idx - 1];
          const gap = clip.startTime - (prevClip.startTime + prevClip.duration);
          if (Math.abs(gap) < 0.1 && clip.transitionIn) {
            const duration = clip.transitionIn.duration;
            const alignment = clip.transitionIn.params?.alignment || 'center';
            let leftSec = clip.startTime - duration / 2;
            if (alignment === 'left') {
              leftSec = clip.startTime;
            } else if (alignment === 'right') {
              leftSec = clip.startTime - duration;
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
    }

    const pool = poolRef.current;
    const videoMap = videoMapRef.current;

    // Create missing elements or update sources if they changed (e.g. after re-linking)
    for (const [clipId, info] of neededClips) {
      const media = mediaLibrary.find((m) => m.id === info.mediaId);
      if (!media || !media.url) continue;

      const existing = pool.get(clipId);
      if (existing) {
        const currentSrc = existing.el.src;
        const isPendingRestore = media.url === 'PENDING_RESTORE';
        const isUrlDifferent = !isPendingRestore && !currentSrc.includes(media.url);
        
        if (isUrlDifferent || (isPendingRestore && !currentSrc.includes('PENDING_RESTORE'))) {
          existing.el.src = media.url;
          if (existing.type === 'video') {
            existing.el.load();
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
        el.src = media.url;
        el.style.display = 'none';

        // Seeked handler that checks for subsequent pending seeks before triggering redraw
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

        document.body.appendChild(el);
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
        document.body.appendChild(el);
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
          el.removeEventListener('timeupdate', triggerRedraw);
          el.removeEventListener('canplay', triggerRedraw);
        }
        entry.el.src = '';
        if (entry.audioCtx) {
          entry.audioCtx.close().catch(() => {});
        }
        entry.el.remove();
        pool.delete(clipId);
        videoMap.delete(clipId);
        pendingSeeksRef.current.delete(clipId);
      }
    }
  }, [tracks, mediaLibrary, triggerRedraw]);

  // Sync playback state — play / pause / seek
  useEffect(() => {
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

      if (!clip || !isPlaying) {
        // Pause this element
        if (!entry.el.paused) {
          entry.el.pause();
        }
      } else {
        // Resume Audio Context if suspended (browser user interaction gesture unlock)
        if (entry.audioCtx && entry.audioCtx.state === 'suspended') {
          entry.audioCtx.resume().catch(() => {});
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
          const found = track.clips.find((c) => c.id === clipId);
          if (found) {
            fullClip = found;
            break;
          }
        }
        if (fullClip) {
          let targetTime = fullClip.trimStart;
          if (fullClip.transitionIn) {
            const transDur = fullClip.transitionIn.duration;
            const alignment = fullClip.transitionIn.params?.alignment || 'center';
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
  }, [isPlaying, currentTime, playbackSpeed, activeClips, mediaLibrary, tracks]);

  // Reactively sync audio parameters (volume, EQ, pitch, etc.) for all clips in the pool
  useEffect(() => {
    const pool = poolRef.current;
    for (const [clipId, entry] of pool) {
      // Find the clip in the tracks
      let fullClip = null;
      let targetTrack = null;
      for (const track of tracks) {
        const found = track.clips.find((c) => c.id === clipId);
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

      // Update Pitch Shifter parameters
      if (entry.pitchNode) {
        (entry.pitchNode as any).pitch = audioSettings.pitch;
        (entry.pitchNode as any).humanize = audioSettings.humanize;
      }

      // Smooth ramp time constant (seconds) — prevents pops/clicks on parameter changes
      const rampTime = 0.08;
      const ctxTime = entry.audioCtx?.currentTime || 0;

      // Update Vocal Filter (notch metallic resonance or manual formant)
      if (entry.vocalFilter) {
        const targetGain = audioSettings.humanize ? -5.0 : audioSettings.voiceFormant * -0.05;
        entry.vocalFilter.gain.setTargetAtTime(targetGain, ctxTime, rampTime);
      }

      // Update Bass / Treble Equalizers
      if (entry.bassFilter) {
        const baseBass = audioSettings.bass + (audioSettings.humanize ? 1.5 : 0);
        entry.bassFilter.gain.setTargetAtTime(Math.max(-15, Math.min(15, baseBass)), ctxTime, rampTime);
      }
      if (entry.trebleFilter) {
        const baseTreble = audioSettings.treble + (audioSettings.humanize ? 1.0 : 0);
        entry.trebleFilter.gain.setTargetAtTime(Math.max(-15, Math.min(15, baseTreble)), ctxTime, rampTime);
      }

      // Update Stereo Panning combining clip panning and track-level panning
      if (entry.pannerNode) {
        const trackPan = targetTrack?.pan ?? 0;
        const combinedPan = (animatedPan / 100) + trackPan;
        entry.pannerNode.pan.setTargetAtTime(Math.max(-1, Math.min(1, combinedPan)), ctxTime, rampTime);
      }

      // Update Room Ambience feedback wet volume
      if (entry.delayGain) {
        entry.delayGain.gain.setTargetAtTime(audioSettings.humanize ? 0.20 : 0.0, ctxTime, rampTime);
      }

      // Update volume & mute state supporting track Solo / Mute logic
      const anyTrackSoloed = tracks.some(t => t.solo);
      const isMutedTrack = targetTrack ? (anyTrackSoloed ? !targetTrack.solo : targetTrack.muted) : false;
      const isMutedGlobally = isMutedTrack || isMuted;
      const globalMuted = isMutedGlobally || audioSettings.muted;

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
      if (fullClip.transitionIn) {
        const transDur = fullClip.transitionIn.duration;
        const alignment = fullClip.transitionIn.params?.alignment || 'center';
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
      
      // Check if this clip is the outgoing clip in a transition (by checking the next clip)
      if (targetTrack) {
        const sortedClips = [...targetTrack.clips].sort((a, b) => a.startTime - b.startTime);
        const clipIdx = sortedClips.findIndex((c) => c.id === clipId);
        if (clipIdx !== -1 && clipIdx < sortedClips.length - 1) {
          const nextClip = sortedClips[clipIdx + 1];
          if (nextClip.transitionIn) {
            const transDur = nextClip.transitionIn.duration;
            const alignment = nextClip.transitionIn.params?.alignment || 'center';
            let leftSec = nextClip.startTime - transDur / 2;
            if (alignment === 'left') {
              leftSec = nextClip.startTime;
            } else if (alignment === 'right') {
              leftSec = nextClip.startTime - transDur;
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
      const finalVolume = (globalMuted || isTransitionMuted) ? 0 : linearGain * volume * trackVolume * fadeInMultiplier * fadeOutMultiplier * transitionVolumeMultiplier;

      if (entry.gainNode) {
        entry.gainNode.gain.setTargetAtTime(finalVolume, ctxTime, rampTime);
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
      
      let syncCatchup = 0;
      if (!entry.el.seeking && isPlaying) {
        if (Math.abs(rawDrift) > 0.02 && Math.abs(rawDrift) < 0.25) {
          // Speed up if behind (rawDrift < 0), slow down if ahead (rawDrift > 0)
          // 2.0 is the proportional gain. E.g., 100ms drift = 20% speed change
          syncCatchup = -rawDrift * 2.0; 
          syncCatchup = Math.max(-0.15, Math.min(0.15, syncCatchup)); // max +/- 15% correction
        }
      }

      const targetSpeed = Math.max(0.1, playbackSpeed * effectiveSpeed * (1 + syncCatchup));
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
          el.removeEventListener('timeupdate', triggerRedraw);
          el.removeEventListener('canplay', triggerRedraw);
        }
        entry.el.src = '';
        if (entry.audioCtx) {
          entry.audioCtx.close().catch(() => {});
        }
        entry.el.remove();
      }
      pool.clear();
      videoMapRef.current.clear();
      pendingSeeksRef.current.clear();
    };
  }, [triggerRedraw]);

  return videoMapRef.current;
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

// ---------------------------------------------------------------------------
// Helper: initialize Web Audio graph for real-time panning, pitch, humanizer, and EQ
// ---------------------------------------------------------------------------
function initAudioGraph(entry: MediaElement) {
  const audioCtx = getMasterAudioCtx();
  if (!audioCtx) return;

  try {
    const sourceNode = audioCtx.createMediaElementSource(entry.el);

    // Look up the parent track of this clip
    const track = useEditorStore.getState().tracks.find(t => t.clips.some(c => c.id === entry.clipId));
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

      let jitter = 0;
      if (isHumanize) {
        // Subtle 5.5 Hz micro-vibrato simulating human throat variation
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
        outputL[i] = cubicL_A * winA + cubicL_B * winB;
        outputR[i] = cubicR_A * winA + cubicR_B * winB;

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
          const jitterSamples = Math.floor((Math.random() - 0.5) * 180);
          readPosA = (writePos - grainSize + jitterSamples + bufferLen) % bufferLen;
        }
        // Reset grain B when it completes a cycle
        if (grainCounterB >= grainSize) {
          grainCounterB = 0;
          // Add a tiny random jitter (up to ±4ms / 180 samples) to break up periodic phase cancellation
          const jitterSamples = Math.floor((Math.random() - 0.5) * 180);
          readPosB = (writePos - grainSize + jitterSamples + bufferLen) % bufferLen;
        }
      }
    };

    // 2. Vocal peak notch filter (attenuate AI nasal peak around 1.5 kHz)
    const vocalFilter = audioCtx.createBiquadFilter();
    vocalFilter.type = 'peaking';
    vocalFilter.frequency.value = 1500;
    vocalFilter.Q.value = 1.0;
    vocalFilter.gain.value = 0;

    // 3. Bass equalizer filter (lowshelf at 200 Hz)
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
    const delayNode = audioCtx.createDelay(1.0);
    delayNode.delayTime.value = 0.022; // 22ms room reflection

    const delayGain = audioCtx.createGain();
    delayGain.gain.value = 0.0; // Bypassed by default

    const feedbackNode = audioCtx.createGain();
    feedbackNode.gain.value = 0.15; // 15% decay feedback

    // 6. Stereo Panner node
    const pannerNode = audioCtx.createStereoPanner ? audioCtx.createStereoPanner() : undefined;

    // 7. Volume Gain node
    const gainNode = audioCtx.createGain();

    // Node connections
    sourceNode.connect(pitchNode);
    pitchNode.connect(vocalFilter);
    vocalFilter.connect(bassFilter);
    bassFilter.connect(trebleFilter);

    // Split treble output into direct path and room ambience loop
    trebleFilter.connect(delayNode);
    delayNode.connect(delayGain);

    // Feedback loop
    delayNode.connect(feedbackNode);
    feedbackNode.connect(delayNode);

    // Panning & output destination routing
    if (pannerNode) {
      trebleFilter.connect(pannerNode);
      delayGain.connect(pannerNode);
      pannerNode.connect(gainNode);
    } else {
      trebleFilter.connect(gainNode);
      delayGain.connect(gainNode);
    }

    if (trackAnalyser) {
      gainNode.connect(trackAnalyser);
    } else if (masterAnalyser) {
      gainNode.connect(masterAnalyser);
    } else if (masterCompressor) {
      gainNode.connect(masterCompressor);
    } else {
      gainNode.connect(audioCtx.destination);
      if (masterAudioDestination) {
        gainNode.connect(masterAudioDestination);
      }
    }

    // Attach to element pool entry
    entry.audioCtx = audioCtx;
    entry.sourceNode = sourceNode;
    entry.pitchNode = pitchNode;
    entry.vocalFilter = vocalFilter;
    entry.bassFilter = bassFilter;
    entry.trebleFilter = trebleFilter;
    entry.delayNode = delayNode;
    entry.delayGain = delayGain;
    entry.feedbackNode = feedbackNode;
    entry.pannerNode = pannerNode;
    entry.gainNode = gainNode;
  } catch (err) {
    console.warn('Unable to initialize Web Audio routing (user gesture required):', err);
  }
}
