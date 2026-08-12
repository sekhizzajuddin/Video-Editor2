import type { TimelineClip } from '@/types';

export class AudioMixer {
  private sampleRate = 48000;

  async mix(timeline: any, durationSeconds: number): Promise<AudioBuffer | null> {
    try {
      const length = Math.ceil(this.sampleRate * durationSeconds);
      
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
            if (media?.url && !clip.audioSettings?.muted) { 
              // Store track volume on the clip temporarily for mixing
              audioClips.push({ ...clip, _url: media.url, _trackVolume: track.volume });
            }
          }
        }
      }

      if (audioClips.length === 0) {
        return null; // No audio to mix
      }

      const decodePromises = audioClips.map(async (clip) => {
        try {
          const response = await fetch(clip._url);
          const arrayBuffer = await response.arrayBuffer();
          const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
          
          const source = ctx.createBufferSource();
          source.buffer = audioBuffer;
          
          // Handle Speed changes
          if (clip.speed) {
            source.playbackRate.value = clip.speed;
          }

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
          gainNode.gain.value = volume;
          
          source.connect(gainNode);
          gainNode.connect(ctx.destination);
          
          // start(when, offset, duration)
          // offset is the time in the source buffer
          const trimStart = clip.trimStart || 0;
          
          // clip.duration is in timeline context time. The start() duration parameter 
          // specifies how much of the source buffer to consume.
          const playDuration = clip.duration 
            ? clip.duration * (clip.speed || 1) 
            : audioBuffer.duration;
          
          source.start(clip.startTime, trimStart, playDuration);
        } catch (err) {
          console.error(`Failed to mix audio for clip ${clip.id}`, err);
        }
      });

      await Promise.all(decodePromises);

      // Start rendering the master mix
      const renderedBuffer = await ctx.startRendering();
      return renderedBuffer;
    } catch (err) {
      console.error('Audio mix failed:', err);
      return null;
    }
  }
}
