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

  // Queue to hold pending seek requests for video elements during scrubbing/seeking
  const pendingSeeksRef = useRef<Map<string, number>>(new Map());

  // Trigger a custom event on window so PreviewCanvas can redraw immediately on async frame seek
  const triggerRedraw = useCallback(() => {
    window.dispatchEvent(new CustomEvent('procut-frame-updated'));
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
        if (media && media.url) {
          neededClips.set(clip.id, {
            mediaId: clip.mediaId,
            type: media.type === 'video' ? 'video' : 'audio',
          });
        }
      }
    }

    const pool = poolRef.current;
    const videoMap = videoMapRef.current;

    // Create missing elements
    for (const [clipId, info] of neededClips) {
      if (pool.has(clipId)) continue;

      const media = mediaLibrary.find((m) => m.id === info.mediaId);
      if (!media || !media.url) continue;

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

  // Sync playback state — play / pause / seek / volume / speed
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
        const mediaTime = Math.max(0, Math.min(maxDuration, (currentTime - clip.clipStart) * clip.speed + clip.trimStart));

        // Fetch advanced audio settings
        const targetTrack = tracks.find((t) => t.clips.some((c) => c.id === clipId));
        const fullClip = targetTrack?.clips.find((c) => c.id === clipId);
        const audioSettings = fullClip?.audioSettings || {
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

        // Update Vocal Filter (notch metallic resonance or manual formant)
        if (entry.vocalFilter) {
          if (audioSettings.humanize) {
            entry.vocalFilter.gain.value = -5.0;
          } else {
            entry.vocalFilter.gain.value = audioSettings.voiceFormant * -0.05;
          }
        }

        // Update Bass / Treble Equalizers
        if (entry.bassFilter) {
          const baseBass = audioSettings.bass + (audioSettings.humanize ? 1.5 : 0);
          entry.bassFilter.gain.value = Math.max(-15, Math.min(15, baseBass));
        }
        if (entry.trebleFilter) {
          const baseTreble = audioSettings.treble + (audioSettings.humanize ? 1.0 : 0);
          entry.trebleFilter.gain.value = Math.max(-15, Math.min(15, baseTreble));
        }

        // Update Stereo Panning
        if (entry.pannerNode) {
          entry.pannerNode.pan.value = Math.max(-1, Math.min(1, audioSettings.pan / 100));
        }

        // Update Room Ambience feedback wet volume
        if (entry.delayGain) {
          entry.delayGain.gain.value = audioSettings.humanize ? 0.20 : 0.0;
        }

        // Update volume & mute state
        const isMutedTrack = clip.trackMuted || isMuted;
        const globalMuted = isMutedTrack || audioSettings.muted;

        const clipElapsed = currentTime - clip.clipStart;
        let fadeInMultiplier = 1;
        if (audioSettings.fadeIn > 0) {
          fadeInMultiplier = Math.min(1, Math.max(0, clipElapsed / audioSettings.fadeIn));
        }
        let fadeOutMultiplier = 1;
        if (audioSettings.fadeOut > 0) {
          const timeLeft = clip.clipDuration - clipElapsed;
          fadeOutMultiplier = Math.min(1, Math.max(0, timeLeft / audioSettings.fadeOut));
        }

        const linearGain = Math.pow(10, audioSettings.volume / 20);
        const finalVolume = globalMuted ? 0 : linearGain * volume * fadeInMultiplier * fadeOutMultiplier;

        if (entry.gainNode) {
          entry.gainNode.gain.value = finalVolume;
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
        const targetSpeed = playbackSpeed * clip.speed;
        if (entry.el.playbackRate !== targetSpeed) {
          entry.el.playbackRate = targetSpeed;
        }

        // Seek to the correct time if we just started, if the user seeked, or if we have high drift
        const currentMediaTime = entry.el.currentTime;
        const drift = Math.abs(currentMediaTime - mediaTime);

        if (forceSeek || drift > 0.35) {
          if (entry.el.seeking) {
            pendingSeeksRef.current.set(clipId, mediaTime);
          } else {
            entry.el.currentTime = mediaTime;
          }
        }

        // Play if paused
        if (entry.el.paused && isPlaying) {
          entry.el.play().catch(() => { /* user interaction required — ignore */ });
        }
      }
    }

    // Pause elements that aren't active
    for (const [clipId, entry] of pool) {
      if (!playingIds.has(clipId) && !entry.el.paused) {
        entry.el.pause();
      }
    }
  }, [isPlaying, currentTime, volume, isMuted, playbackSpeed, activeClips, mediaLibrary]);

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
      const mediaTime = Math.max(0, Math.min(maxDuration, (currentTime - clip.clipStart) * clip.speed + clip.trimStart));

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
// Helper: initialize Web Audio graph for real-time panning, pitch, humanizer, and EQ
// ---------------------------------------------------------------------------
function initAudioGraph(entry: MediaElement) {
  const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) return;

  try {
    const audioCtx = new AudioContextClass() as AudioContext;
    const sourceNode = audioCtx.createMediaElementSource(entry.el);

    // 1. Granular resampling pitch shifter node (Stereo)
    const bufferSize = 4096;
    const pitchNode = audioCtx.createScriptProcessor(bufferSize, 2, 2);
    (pitchNode as any).pitch = 0;
    (pitchNode as any).humanize = false;

    const bufferLen = 65536;
    const writeBufL = new Float32Array(bufferLen);
    const writeBufR = new Float32Array(bufferLen);
    let writePos = 0;
    let readPos = 0;

    pitchNode.onaudioprocess = (e) => {
      const inputL = e.inputBuffer.getChannelData(0);
      const inputR = e.inputBuffer.getChannelData(1);
      const outputL = e.outputBuffer.getChannelData(0);
      const outputR = e.outputBuffer.getChannelData(1);

      const pitch = (pitchNode as any).pitch || 0;
      const isHumanize = (pitchNode as any).humanize || false;

      let jitter = 0;
      if (isHumanize) {
        // Subtle 5.5 Hz micro-vibrato (jitter) simulating human throat variation
        const time = e.playbackTime || (Date.now() / 1000);
        jitter = Math.sin(time * 2 * Math.PI * 5.5) * 0.08;
      }

      const semitones = pitch + jitter;
      if (semitones === 0) {
        outputL.set(inputL);
        outputR.set(inputR);
        return;
      }

      const ratio = Math.pow(2, semitones / 12);

      for (let i = 0; i < inputL.length; i++) {
        writeBufL[writePos] = inputL[i];
        writeBufR[writePos] = inputR[i];

        const readInt = Math.floor(readPos);
        const nextInt = (readInt + 1) % bufferLen;
        const frac = readPos - readInt;

        // Linear interpolation resampler
        outputL[i] = writeBufL[readInt] * (1 - frac) + writeBufL[nextInt] * frac;
        outputR[i] = writeBufR[readInt] * (1 - frac) + writeBufR[nextInt] * frac;

        writePos = (writePos + 1) % bufferLen;
        readPos = (readPos + ratio) % bufferLen;

        // Drift protection
        const diff = (writePos - readPos + bufferLen) % bufferLen;
        if (diff > bufferSize * 4) {
          readPos = (writePos - bufferSize * 2 + bufferLen) % bufferLen;
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

    gainNode.connect(audioCtx.destination);

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
