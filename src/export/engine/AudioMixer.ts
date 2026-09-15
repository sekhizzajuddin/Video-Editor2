import { effectiveVocalFormant, effectiveVocalPitchSt } from '@/utils/vocalTone';
import { getRampedClipSourceSpan, getSpeedFrameSegments } from '@/utils/speedRamp';
import { pitchShiftBufferRegion } from '@/utils/audio/phaseVocoder';

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
      for (const track of timeline.tracks) {
        if (track.muted || track.isMuted) continue; // Skip muted tracks
        
        if (track.type === 'video' || track.type === 'audio') {
          for (const clip of track.clips) {
            const media = mediaMap.get(clip.mediaId);
            if ((media?.url || media?._fileBlob) && !clip.audioSettings?.muted) {
              // Store track volume on the clip temporarily for mixing
              audioClips.push({ ...clip, _url: media.url, _blob: media._audioBlob || media._fileBlob, _trackVolume: track.volume });
            }
          }
        }
      }

      if (audioClips.length === 0) {
        return null; // No audio to mix
      }

      const decodePromises = audioClips.map(async (clip) => {
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
              const segSource = ctx.createBufferSource();
              segSource.buffer = buffer as AudioBuffer;
              segSource.playbackRate.value = seg.speed;
              segSource.connect(vocalF1);

              const segTimelineStart = clipStart + seg.startOffset;
              const segSourceOffset = seg.sourceStart;
              const segSourceDuration = Math.max(0.001, seg.sourceEnd - seg.sourceStart);
              segSource.start(segTimelineStart, segSourceOffset, segSourceDuration);
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
            source.buffer = buffer as AudioBuffer;
            if (clip.speed) {
              source.playbackRate.value = clip.speed;
            }
            source.connect(vocalF1);

            const trimStart = clip.trimStart || 0;
            const playDuration = clip.duration 
              ? clip.duration * (clip.speed || 1) 
              : audioBuffer.duration;
            
            source.start(clip.startTime, trimStart, playDuration);
          }
        } catch (err) {
          console.error(`Failed to mix audio for clip ${clip.id}`, err);
        }
      });

      await Promise.all(decodePromises);

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
