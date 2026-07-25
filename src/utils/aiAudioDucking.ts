import { TimelineClip, MediaItem, PropertyKeyframe } from '@/types';
import { aiVocalSeparator } from './aiVocalSeparator';

export async function analyzeAndDuckAudio(
  targetClip: TimelineClip,
  allClips: TimelineClip[],
  mediaLibrary: MediaItem[],
  duckAmount: number = 0.3, // Drop to 30% volume
  onProgress?: (progress: number) => void
): Promise<PropertyKeyframe[] | null> {
  const overlappingClips = allClips.filter(clip => {
    if (clip.id === targetClip.id) return false; // Skip self
    if (clip.disabled || (clip.audioSettings && clip.audioSettings.muted)) return false; // Skip muted
    
    // Check overlap
    const targetEnd = targetClip.startTime + targetClip.duration;
    const clipEnd = clip.startTime + clip.duration;
    return (clip.startTime < targetEnd && clipEnd > targetClip.startTime);
  });

  if (overlappingClips.length === 0) {
    return null; // Nothing to duck against
  }

  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  
  // Aggregate all vocal activity across all overlapping clips
  // We'll create a boolean map or array representing "isVocalActive" at 0.1s intervals
  const resolution = 0.1; // 100ms
  const totalDuration = targetClip.duration;
  const numSteps = Math.ceil(totalDuration / resolution);
  const vocalActivity = new Float32Array(numSteps);

  for (let i = 0; i < overlappingClips.length; i++) {
    const clip = overlappingClips[i];
    const media = mediaLibrary.find(m => m.id === clip.mediaId);
    if (!media || !media.url) continue;

    if (onProgress) {
      onProgress((i / overlappingClips.length) * 100);
    }

    try {
      // 1. Fetch and decode audio
      const response = await fetch(media.url);
      const arrayBuffer = await response.arrayBuffer();
      const decodedAudio = await audioCtx.decodeAudioData(arrayBuffer);

      // 2. Separate vocals
      const { vocals } = await aiVocalSeparator.separateAudioBuffer(decodedAudio, (p) => {
        if (onProgress) onProgress((i / overlappingClips.length) * 100 + (p * 100 / overlappingClips.length));
      });

      // 3. Analyze vocals RMS
      const channelData = vocals.getChannelData(0);
      const sampleRate = vocals.sampleRate;
      
      // Map vocal activity onto the targetClip's timeline
      const overlapStart = Math.max(targetClip.startTime, clip.startTime);
      const overlapEnd = Math.min(targetClip.startTime + targetClip.duration, clip.startTime + clip.duration);

      for (let t = overlapStart; t < overlapEnd; t += resolution) {
        // Calculate where we are in the source clip's time
        const sourceTime = (t - clip.startTime) + (clip.trimStart || 0);
        
        // Extract a window of audio samples
        const sampleStart = Math.floor(sourceTime * sampleRate);
        const sampleEnd = Math.floor((sourceTime + resolution) * sampleRate);
        
        let sum = 0;
        let count = 0;
        for (let s = sampleStart; s < sampleEnd && s < channelData.length; s++) {
          sum += channelData[s] * channelData[s];
          count++;
        }
        
        const rms = count > 0 ? Math.sqrt(sum / count) : 0;
        
        // Define a threshold for "vocal presence" (e.g. 0.02 RMS)
        if (rms > 0.02) {
          const targetRelativeTime = t - targetClip.startTime;
          const stepIdx = Math.floor(targetRelativeTime / resolution);
          if (stepIdx >= 0 && stepIdx < numSteps) {
            vocalActivity[stepIdx] = Math.max(vocalActivity[stepIdx], rms);
          }
        }
      }
    } catch (err) {
      console.error("Failed to analyze clip for ducking:", clip.id, err);
    }
  }

  audioCtx.close();

  // 4. Generate Keyframes
  // Smooth out the vocal activity (debounce) so it doesn't flutter
  const keyframes: PropertyKeyframe[] = [];
  let isDucking = false;
  
  // Base volume is the clip's current audioSettings.volume
  const baseVolume = targetClip.audioSettings?.volume ?? 0; // in dB
  
  // Calculate ducked dB volume. Linear 0.3 = approx -10dB.
  // We'll just map linear duckAmount to dB roughly.
  // 20 * log10(0.3) = -10.45 dB.
  const duckDbOffset = 20 * Math.log10(Math.max(0.01, duckAmount));
  const targetDuckVolume = baseVolume + duckDbOffset;

  // Add initial keyframe at 0s
  keyframes.push({ time: 0, value: baseVolume, easing: 'easeOut' });

  for (let i = 0; i < numSteps; i++) {
    const time = i * resolution;
    const isActive = vocalActivity[i] > 0;

    if (isActive && !isDucking) {
      // Start ducking (ramp down over 0.2s)
      isDucking = true;
      keyframes.push({ time: Math.max(0, time - 0.2), value: baseVolume, easing: 'easeOut' });
      keyframes.push({ time: time, value: targetDuckVolume, easing: 'linear' });
    } else if (!isActive && isDucking) {
      // Stop ducking if the next 1 second is also clear
      let willStayClear = true;
      for (let j = 1; j <= 10; j++) {
        if (i + j < numSteps && vocalActivity[i + j] > 0) {
          willStayClear = false;
          break;
        }
      }
      
      if (willStayClear) {
        isDucking = false;
        keyframes.push({ time: time, value: targetDuckVolume, easing: 'easeIn' });
        keyframes.push({ time: Math.min(totalDuration, time + 0.5), value: baseVolume, easing: 'linear' });
      }
    }
  }

  // Ensure last keyframe stays at whatever state we are in
  const lastTime = keyframes[keyframes.length - 1].time;
  if (lastTime < totalDuration) {
    keyframes.push({ time: totalDuration, value: isDucking ? targetDuckVolume : baseVolume, easing: 'linear' });
  }

  return keyframes;
}
