export interface AutoCutSegment {
  startTime: number;
  endTime: number;
  keep: boolean; // true if speaking, false if silence
}

/**
 * Simulates analyzing an audio buffer or transcript to find silences / umms.
 * Returns an array of alternating keep/discard segments.
 */
export function analyzeClipForAutoCuts(
  clipDuration: number,
  aggressiveness: 'low' | 'medium' | 'high' = 'medium'
): AutoCutSegment[] {
  const segments: AutoCutSegment[] = [];
  
  // Simulated algorithm: 
  // We'll roughly chop the clip into 2-5 second speaking chunks, separated by 0.5 - 1.5s silence.
  
  let currentTime = 0;
  
  while (currentTime < clipDuration) {
    // 1. Keep segment (speaking)
    // The higher the aggressiveness, the shorter the allowed speaking chunks before a cut might happen
    const baseSpeakLength = aggressiveness === 'high' ? 1.5 : (aggressiveness === 'low' ? 4.0 : 2.5);
    const speakDuration = baseSpeakLength + Math.random() * 2;
    
    let endSpeak = Math.min(currentTime + speakDuration, clipDuration);
    
    segments.push({
      startTime: currentTime,
      endTime: endSpeak,
      keep: true
    });
    
    currentTime = endSpeak;
    
    if (currentTime >= clipDuration) break;
    
    // 2. Discard segment (silence / umm)
    // The higher the aggressiveness, the longer the cuts
    const baseSilenceLength = aggressiveness === 'high' ? 0.8 : (aggressiveness === 'low' ? 0.3 : 0.5);
    const silenceDuration = baseSilenceLength + Math.random() * 0.5;
    
    let endSilence = Math.min(currentTime + silenceDuration, clipDuration);
    
    // Only cut if it's not at the very end of the clip (prevent tiny clips at the end)
    if (clipDuration - endSilence > 0.5) {
      segments.push({
        startTime: currentTime,
        endTime: endSilence,
        keep: false
      });
      currentTime = endSilence;
    } else {
      // Just extend the speaking segment to the end
      segments[segments.length - 1].endTime = clipDuration;
      break;
    }
  }

  return segments;
}
