import { effectiveVocalFormant, effectiveVocalPitchSt } from '@/utils/vocalTone';
import { getRampedClipSourceSpan, getSpeedFrameSegments } from '@/utils/speedRamp';
import { pitchShiftBufferRegion } from '@/utils/audio/phaseVocoder';
import { timeStretchAudioBuffer } from '@/utils/audio/wsola';
import { normalizeTransition, getTransitionWindow, type TransitionAlignment } from '@/utils/transitionEngine';
import { synthesizeTransitionSoundWav } from '@/timeline/sfxSynth';
import { getFileFromDB } from '@/utils/projectPersistence';

export class AudioMixer {
  private sampleRate = 48000;

  async mix(timeline: any, durationSeconds: number, startAt: number = 0): Promise<AudioBuffer | null> {
    try {
      const totalMixSeconds = startAt + durationSeconds;
      const length = Math.ceil(this.sampleRate * totalMixSeconds);
      
      // Some browsers enforce a minimum length for OfflineAudioContext
      if (length <= 0) return null;
      
      const ctx = new OfflineAudioContext(2, length, this.sampleRate);
      
      // Create a fast media lookup
      const mediaMap = new Map<string, any>();
      if (timeline.media) {
        for (const m of timeline.media) {
          mediaMap.set(m.id, m);
        }
      }

      // Iterate through all clips to find ones with audio
      const audioClips: any[] = [];
      const addClipWithAudio = (clip: any, track: any, trackVolume: number, absStartTime: number) => {
        const media = mediaMap.get(clip.mediaId);
        if ((media?.url || media?._fileBlob) && !clip.audioSettings?.muted) {
          audioClips.push({
            ...clip,
            startTime: absStartTime,
            _url: media.url,
            _blob: media._audioBlob || media._fileBlob,
            _trackVolume: trackVolume,
          });
        }
      };

      for (const track of timeline.tracks) {
        if (track.muted || track.isMuted) continue;
        if (track.type === 'video' || track.type === 'audio') {
          for (const clip of track.clips || []) {
            addClipWithAudio(clip, track, track.volume ?? 1, clip.startTime);
          }
        }
      }

      // Check PiP tracks if present
      if (timeline.pipWindows) {
        for (const pip of Object.values(timeline.pipWindows) as any[]) {
          const parentClip = (timeline.tracks || []).flatMap((t: any) => t.clips || []).find((c: any) => c.id === pip.parentClipId);
          const parentStart = parentClip ? parentClip.startTime : 0;
          for (const pipTrack of pip.tracks || []) {
            if (pipTrack.muted || pipTrack.hidden) continue;
            for (const pipClip of pipTrack.clips || []) {
              const absStart = parentStart + (pip.relativeStartTime || 0) + pipClip.startTime;
              addClipWithAudio(pipClip, pipTrack, pipTrack.volume ?? 1, absStart);
            }
          }
        }
      }

      // Collect transitions with sound effects on video tracks
      const transitionSounds: Array<{
        soundEffect: string;
        soundVolume: number;
        startTime: number;
        duration: number;
        customUrl?: string;
        customBlob?: Blob;
      }> = [];
      const processedTransitionCuts = new Set<string>();

      for (const track of timeline.tracks) {
        if (track.muted || track.isMuted || track.type !== 'video' || !track.clips || track.clips.length === 0) continue;
        const ordered = [...track.clips].sort((a: any, b: any) => a.startTime - b.startTime);

        for (let i = 0; i < ordered.length; i++) {
          const clip = ordered[i];
          if (clip.disabled) continue;

          // 1. Transition In
          if (clip.transitionIn && (clip.transitionIn.duration || 0) > 0) {
            const trans = clip.transitionIn;
            const norm = normalizeTransition(trans);
            if (norm.soundEffect && norm.soundEffect !== 'none') {
              const prev = i > 0 ? ordered[i - 1] : null;
              const alignment = (trans.params?.alignment || 'center') as TransitionAlignment;
              const win = getTransitionWindow(clip.startTime, trans.duration ?? 0.5, alignment, prev, clip);
              const cutKey = `${track.id || track.name}_${clip.startTime.toFixed(2)}`;

              if (win.duration > 0 && !processedTransitionCuts.has(cutKey)) {
                processedTransitionCuts.add(cutKey);

                let customUrl: string | undefined;
                let customBlob: Blob | undefined;
                if (norm.soundEffect.startsWith('media:')) {
                  const mediaId = norm.soundEffect.replace(/^media:/, '');
                  const mItem = mediaMap.get(mediaId);
                  if (mItem) {
                    customUrl = mItem.url;
                    customBlob = mItem._audioBlob || mItem._fileBlob;
                  }
                }

                transitionSounds.push({
                  soundEffect: norm.soundEffect,
                  soundVolume: norm.soundVolume,
                  startTime: win.start,
                  duration: win.duration,
                  customUrl,
                  customBlob,
                });
              }
            }
          }

          // 2. Transition Out (if cut is not already handled by adjacent clip's transitionIn)
          if (clip.transitionOut && (clip.transitionOut.duration || 0) > 0) {
            const trans = clip.transitionOut;
            const cutTime = clip.startTime + clip.duration;
            const cutKey = `${track.id || track.name}_${cutTime.toFixed(2)}`;
            const next = i + 1 < ordered.length ? ordered[i + 1] : null;
            const nextHasTransIn = next && Math.abs(next.startTime - cutTime) < 0.1 && next.transitionIn;

            if (!nextHasTransIn && !processedTransitionCuts.has(cutKey)) {
              const norm = normalizeTransition(trans);
              if (norm.soundEffect && norm.soundEffect !== 'none') {
                const alignment = (trans.params?.alignment || 'center') as TransitionAlignment;
                const win = getTransitionWindow(cutTime, trans.duration ?? 0.5, alignment, clip, next);

                if (win.duration > 0) {
                  processedTransitionCuts.add(cutKey);

                  let customUrl: string | undefined;
                  let customBlob: Blob | undefined;
                  if (norm.soundEffect.startsWith('media:')) {
                    const mediaId = norm.soundEffect.replace(/^media:/, '');
                    const mItem = mediaMap.get(mediaId);
                    if (mItem) {
                      customUrl = mItem.url;
                      customBlob = mItem._audioBlob || mItem._fileBlob;
                    }
                  }

                  transitionSounds.push({
                    soundEffect: norm.soundEffect,
                    soundVolume: norm.soundVolume,
                    startTime: win.start,
                    duration: win.duration,
                    customUrl,
                    customBlob,
                  });
                }
              }
            }
          }
        }
      }

      if (audioClips.length === 0 && transitionSounds.length === 0) {
        return null; // No audio to mix
      }

      for (const clip of audioClips) {
        // Yield to browser event loop between clips to keep UI responsive and prevent tab watchdog crash
        await new Promise((resolve) => setTimeout(resolve, 0));
        try {
          const arrayBuffer = clip._blob instanceof Blob
            ? await clip._blob.arrayBuffer()
            : await (await fetch(clip._url)).arrayBuffer();
          const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

          // Apply the effective vocal pitch (manual Pitch Shift + Vocal Tone +
          // auto vocal-match) with a phase vocoder — phase-coherent, so the
          // exported voice stays natural (no granular/resampling artifacts).
          // Only the clip's used source region is shifted; the region keeps
          // its length, so all trim/start math below stays valid.
          let buffer: import('@/utils/audio/phaseVocoder').AudioBufferLike = audioBuffer;
          const preservePitch = clip.audioSettings?.preservePitch !== false;
          const baseVocalPitchSt = effectiveVocalPitchSt(clip.audioSettings);

          const speedSegments = (clip.speedFrames && clip.speedFrames.length > 0)
            ? getSpeedFrameSegments(clip, audioBuffer.duration)
            : null;

          // Handle Volume (Convert dB to linear gain)
          let volume = 1; // Default 0 dB
          let totalDb = 0;
          
          if (clip._trackVolume !== undefined) {
             totalDb += clip._trackVolume;
          }
          if (clip.audioSettings?.volume !== undefined) {
             totalDb += clip.audioSettings.volume;
          }
          
          // Minimum floor to avoid -infinity issues
          volume = totalDb <= -40 ? 0 : Math.pow(10, totalDb / 20);
          const gainNode = ctx.createGain();
          const clipStart = Math.max(0, clip.startTime || 0);
          const clipDuration = Math.max(0.001, clip.duration || audioBuffer.duration);
          const fadeIn = Math.min(clipDuration, Math.max(0, clip.audioSettings?.fadeIn || 0));
          const fadeOut = Math.min(clipDuration, Math.max(0, clip.audioSettings?.fadeOut || 0));
          gainNode.gain.setValueAtTime(fadeIn > 0 ? 0 : volume, clipStart);
          if (fadeIn > 0) gainNode.gain.linearRampToValueAtTime(volume, clipStart + fadeIn);
          if (fadeOut > 0) {
            gainNode.gain.setValueAtTime(volume, Math.max(clipStart, clipStart + clipDuration - fadeOut));
            gainNode.gain.linearRampToValueAtTime(0, clipStart + clipDuration);
          }

          // Preserve clip pan and basic bass/treble edits in the final mix.
          const bass = ctx.createBiquadFilter();
          bass.type = 'lowshelf';
          bass.frequency.value = 200;
          bass.gain.value = clip.audioSettings?.bass || 0;
          const treble = ctx.createBiquadFilter();
          treble.type = 'highshelf';
          treble.frequency.value = 3000;
          treble.gain.value = clip.audioSettings?.treble || 0;
          const formantVal = effectiveVocalFormant(clip.audioSettings);
          const vocalF1 = ctx.createBiquadFilter();
          vocalF1.type = 'peaking';
          vocalF1.frequency.value = 500;
          vocalF1.Q.value = 1.2;
          vocalF1.gain.value = formantVal * -0.08;
          const vocal = ctx.createBiquadFilter();
          vocal.type = 'peaking';
          vocal.frequency.value = 1500;
          vocal.Q.value = 1.0;
          vocal.gain.value = formantVal * -0.12;
          const vocalF3 = ctx.createBiquadFilter();
          vocalF3.type = 'peaking';
          vocalF3.frequency.value = 2500;
          vocalF3.Q.value = 1.2;
          vocalF3.gain.value = formantVal * -0.06;
          const panner = typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : null;
          if (panner) panner.pan.value = Math.max(-1, Math.min(1, (clip.audioSettings?.pan || 0) / 100));

          vocalF1.connect(vocal);
          vocal.connect(vocalF3);
          vocalF3.connect(bass);
          bass.connect(treble);
          treble.connect(gainNode);
          if (panner) {
            gainNode.connect(panner);
            panner.connect(ctx.destination);
          } else {
            gainNode.connect(ctx.destination);
          }

          if (speedSegments && speedSegments.length > 0) {
            // Apply vocal pitch shift (if requested by user)
            if (Math.abs(baseVocalPitchSt) >= 0.01) {
              const shifted = pitchShiftBufferRegion(
                (ch, len, sr) => ctx.createBuffer(ch, len, sr),
                buffer,
                baseVocalPitchSt,
                clip.trimStart || 0,
                Math.min(audioBuffer.duration, (clip.trimStart || 0) + clip.duration)
              );
              if (shifted) buffer = shifted;
            }

            // Schedule a BufferSource for each speed segment
            for (const seg of speedSegments) {
              try {
                const segTimelineStart = clipStart + seg.startOffset;
                const segTimelineDur = Math.max(0.001, seg.endOffset - seg.startOffset);
                const segSourceOffset = seg.sourceStart;
                const segSourceDuration = Math.max(0.001, seg.sourceEnd - seg.sourceStart);

                // Skip segments with invalid source ranges
                if (segSourceOffset < 0 || segSourceOffset >= (buffer as AudioBuffer).duration) continue;
                const clampedSourceEnd = Math.min(seg.sourceEnd, (buffer as AudioBuffer).duration);
                const clampedSourceDur = Math.max(0.001, clampedSourceEnd - segSourceOffset);

                const segSource = ctx.createBufferSource();

                if (preservePitch && Math.abs(seg.speed - 1.0) > 0.01) {
                  // Pitch-preserved time-stretching via fast time-domain WSOLA
                  const stretched = timeStretchAudioBuffer(
                    (ch, len, sr) => ctx.createBuffer(ch, len, sr),
                    buffer,
                    seg.speed,
                    segSourceOffset,
                    segSourceOffset + clampedSourceDur
                  );
                  segSource.buffer = stretched as AudioBuffer;
                  segSource.playbackRate.value = 1.0;
                  segSource.connect(vocalF1);
                  // Clamp play duration to actual stretched buffer length to prevent
                  // BufferSourceNode.start() from throwing when floating-point rounding
                  // makes the stretched buffer slightly shorter than segTimelineDur
                  const maxDur = (stretched as AudioBuffer).duration;
                  segSource.start(segTimelineStart, 0, Math.min(segTimelineDur, maxDur));
                } else {
                  // Native resampling (alters pitch along with speed)
                  segSource.buffer = buffer as AudioBuffer;
                  segSource.playbackRate.value = seg.speed;
                  segSource.connect(vocalF1);
                  const bufDur = (buffer as AudioBuffer).duration;
                  const maxSafeDur = Math.max(0.001, bufDur - segSourceOffset - 0.0001);
                  const safeDur = Math.min(clampedSourceDur, maxSafeDur);
                  segSource.start(segTimelineStart, segSourceOffset, safeDur);
                }
              } catch (segErr) {
                console.warn(`AudioMixer: Failed to schedule speed segment ${seg.index}`, segErr);
              }
            }
          } else {
            // Static speed or single clip logic
            if (Math.abs(baseVocalPitchSt) >= 0.01) {
              const sourceDuration = audioBuffer.duration || 0;
              const span = getRampedClipSourceSpan(clip, sourceDuration);
              const startSec = clip.trimStart || 0;
              const endSec = Math.min(sourceDuration, startSec + Math.max(0, span));
              const shifted = pitchShiftBufferRegion(
                (ch, len, sr) => ctx.createBuffer(ch, len, sr),
                audioBuffer,
                baseVocalPitchSt,
                startSec,
                endSec
              );
              if (shifted) buffer = shifted;
            }

            const source = ctx.createBufferSource();
            const effectiveSpeed = clip.speed || 1.0;
            const trimStart = clip.trimStart || 0;
            const playDuration = clip.duration 
              ? clip.duration * effectiveSpeed 
              : audioBuffer.duration;

            if (preservePitch && Math.abs(effectiveSpeed - 1.0) > 0.01) {
              // Pitch-preserved time-stretching via fast time-domain WSOLA
              const clampedEnd = Math.min(trimStart + playDuration, (buffer as AudioBuffer).duration);
              const stretched = timeStretchAudioBuffer(
                (ch, len, sr) => ctx.createBuffer(ch, len, sr),
                buffer,
                effectiveSpeed,
                trimStart,
                clampedEnd
              );
              source.buffer = stretched as AudioBuffer;
              source.playbackRate.value = 1.0;
              source.connect(vocalF1);
              // Clamp to actual stretched buffer duration to prevent start() overflow
              const maxDur = (stretched as AudioBuffer).duration;
              const targetDur = clip.duration || (playDuration / effectiveSpeed);
              source.start(clip.startTime, 0, Math.min(targetDur, maxDur));
            } else {
              // Native resampling (alters pitch along with speed)
              source.buffer = buffer as AudioBuffer;
              source.playbackRate.value = effectiveSpeed;
              source.connect(vocalF1);
              source.start(clip.startTime, trimStart, playDuration);
            }
          }
        } catch (err) {
          console.error(`Failed to mix audio for clip ${clip.id}`, err);
        }
      }

      // Mix transition sound effects into the audio graph
      for (const ts of transitionSounds) {
        // Skip transition sounds outside the current export range
        if (ts.startTime + ts.duration <= startAt || ts.startTime >= totalMixSeconds) continue;

        await new Promise((resolve) => setTimeout(resolve, 0));
        try {
          let audioBuffer: AudioBuffer | null = null;
          if (ts.soundEffect.startsWith('media:')) {
            const mediaId = ts.soundEffect.replace(/^media:/, '');
            let blob = ts.customBlob;
            if (!blob) {
              try {
                blob = (await getFileFromDB(mediaId)) || undefined;
              } catch {}
            }
            if (blob) {
              const arrayBuffer = await blob.arrayBuffer();
              audioBuffer = await ctx.decodeAudioData(arrayBuffer);
            } else if (ts.customUrl) {
              const resp = await fetch(ts.customUrl);
              const arrayBuffer = await resp.arrayBuffer();
              audioBuffer = await ctx.decodeAudioData(arrayBuffer);
            }
          } else {
            const blob = await synthesizeTransitionSoundWav(ts.soundEffect, ts.duration);
            const arrayBuffer = await blob.arrayBuffer();
            audioBuffer = await ctx.decodeAudioData(arrayBuffer);
          }

          if (audioBuffer) {
            const source = ctx.createBufferSource();
            source.buffer = audioBuffer;
            const gainNode = ctx.createGain();
            const gain = Math.max(0, Math.min(1, ts.soundVolume));
            gainNode.gain.setValueAtTime(gain, ts.startTime);
            source.connect(gainNode);
            gainNode.connect(ctx.destination);
            source.start(ts.startTime, 0, Math.min(audioBuffer.duration, ts.duration));
          }
        } catch (err) {
          console.error(`Failed to mix transition sound ${ts.soundEffect}:`, err);
        }
      }

      // Start rendering the master mix
      const renderedBuffer = await ctx.startRendering();

      if (startAt > 0) {
        const startSample = Math.min(renderedBuffer.length, Math.round(startAt * this.sampleRate));
        const endSample = Math.min(renderedBuffer.length, Math.round(totalMixSeconds * this.sampleRate));
        const newLength = Math.max(1, endSample - startSample);
        const slicedBuffer = new AudioBuffer({
          numberOfChannels: renderedBuffer.numberOfChannels,
          length: newLength,
          sampleRate: this.sampleRate,
        });
        for (let ch = 0; ch < renderedBuffer.numberOfChannels; ch++) {
          const srcData = renderedBuffer.getChannelData(ch);
          const dstData = slicedBuffer.getChannelData(ch);
          dstData.set(srcData.subarray(startSample, endSample));
        }
        return slicedBuffer;
      }

      return renderedBuffer;
    } catch (err) {
      console.error('Audio mix failed:', err);
      return null;
    }
  }
}
