/**
 * Utility to decode an audio Blob, detect silence gaps, and split it back into multiple Blobs.
 * This runs entirely client-side using the Web Audio API.
 */

// Converts an AudioBuffer back to a wav Blob
function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const bufferWav = new ArrayBuffer(length);
  const view = new DataView(bufferWav);
  const channels = [];
  let sample = 0;
  let offset = 0;
  let pos = 0;

  function setUint16(data: number) {
    view.setUint16(pos, data, true);
    pos += 2;
  }

  function setUint32(data: number) {
    view.setUint32(pos, data, true);
    pos += 4;
  }

  // RIFF
  setUint32(0x46464952);
  // file length - 8
  setUint32(length - 8);
  // WAVE
  setUint32(0x45564157);
  // fmt chunk
  setUint32(0x20746d66);
  // chunk length
  setUint32(16);
  // sample format
  setUint16(1);
  // channel count
  setUint16(numOfChan);
  // sample rate
  setUint32(buffer.sampleRate);
  // byte rate
  setUint32(buffer.sampleRate * numOfChan * 2);
  // block align
  setUint16(numOfChan * 2);
  // bits per sample
  setUint16(16);
  // data chunk
  setUint32(0x61746164);
  // chunk length
  setUint32(length - pos - 4);

  for (let i = 0; i < buffer.numberOfChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  while (pos < length) {
    for (let i = 0; i < numOfChan; i++) {
      sample = Math.max(-1, Math.min(1, channels[i][offset]));
      sample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(pos, sample, true);
      pos += 2;
    }
    offset++;
  }

  return new Blob([bufferWav], { type: 'audio/wav' });
}

/**
 * Splits an audio buffer at given boundaries.
 */
function extractBufferRegion(buffer: AudioBuffer, context: AudioContext, startSec: number, endSec: number): AudioBuffer {
  const startOffset = Math.floor(startSec * buffer.sampleRate);
  const endOffset = Math.min(Math.floor(endSec * buffer.sampleRate), buffer.length);
  const frameCount = endOffset - startOffset;

  const newBuffer = context.createBuffer(buffer.numberOfChannels, frameCount, buffer.sampleRate);
  
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    const newChannelData = newBuffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      newChannelData[i] = channelData[startOffset + i];
    }
  }

  return newBuffer;
}

/**
 * Splits a composite audio Blob into individual Blobs based on the requested cue durations,
 * scaling dynamically to match the actual duration of the generated audio buffer.
 */
export async function splitAudioByTime(
  audioBlob: Blob,
  cueDurations: number[]
): Promise<Blob[]> {
  if (cueDurations.length <= 1) {
    return [audioBlob];
  }

  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  
  try {
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    const actualDuration = audioBuffer.duration;
    
    // Calculate the requested intervals
    // Each cue has cueDurations[i] seconds. Between cues there is 1 second of silence.
    let requestedTotal = 0;
    const requestedIntervals: { start: number; end: number }[] = [];
    
    for (let i = 0; i < cueDurations.length; i++) {
      const dur = cueDurations[i];
      const start = requestedTotal;
      const end = start + dur;
      requestedIntervals.push({ start, end });
      requestedTotal = end + 1; // add 1s silence after this cue
    }
    
    // Subtract the last trailing silence we added
    requestedTotal -= 1;
    if (requestedTotal <= 0) requestedTotal = 1;

    // Scale factor to adjust to actual returned duration
    const scale = actualDuration / requestedTotal;
    
    const clips: Blob[] = [];
    
    for (let i = 0; i < cueDurations.length; i++) {
      const startSec = requestedIntervals[i].start * scale;
      const endSec = requestedIntervals[i].end * scale;
      
      const extractedBuffer = extractBufferRegion(audioBuffer, audioContext, startSec, endSec);
      const clipBlob = audioBufferToWavBlob(extractedBuffer);
      clips.push(clipBlob);
    }
    
    return clips;
  } finally {
    if (audioContext.state !== 'closed') {
      audioContext.close();
    }
  }
}

/**
 * Main function to split a single audio Blob containing multiple SFX separated by silence.
 * 
 * @param audioBlob The audio blob to split
 * @param expectedCount How many clips we expect to get
 * @returns Array of Blobs for each individual sound effect
 */
export async function splitAudioBySilence(audioBlob: Blob, expectedCount: number): Promise<Blob[]> {
  if (expectedCount <= 1) {
    return [audioBlob];
  }

  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  
  try {
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    const channelData = audioBuffer.getChannelData(0); 
    const sampleRate = audioBuffer.sampleRate;
    
    // Adaptive silence detection based on audio characteristics
    const rms = calculateRMS(channelData);
    const threshold = Math.max(0.01, rms * 0.1); // Dynamic threshold: 10% of RMS
    const minSilenceDurationSec = 0.2; // Reduced from 0.3
    const minSilenceSamples = minSilenceDurationSec * sampleRate;
    
    const splitPoints: number[] = [0];
    let silenceStart = -1;
    
    for (let i = 0; i < channelData.length; i++) {
      const amplitude = Math.abs(channelData[i]);
      
      if (amplitude < threshold) {
        if (silenceStart === -1) {
          silenceStart = i;
        }
      } else {
        if (silenceStart !== -1) {
          const silenceDuration = i - silenceStart;
          if (silenceDuration >= minSilenceSamples) {
            const splitSample = silenceStart + Math.floor(silenceDuration / 2);
            splitPoints.push(splitSample / sampleRate);
          }
          silenceStart = -1;
        }
      }
    }
    
    splitPoints.push(audioBuffer.duration);
    
    const clips: Blob[] = [];
    
    for (let i = 0; i < splitPoints.length - 1; i++) {
      if (clips.length >= expectedCount) break; // Don't exceed expected count
      
      const startSec = splitPoints[i];
      const endSec = splitPoints[i + 1];
      
      // Ignore extremely short clips (likely artifacts)
      if (endSec - startSec > 0.1) {
        const extractedBuffer = extractBufferRegion(audioBuffer, audioContext, startSec, endSec);
        const clipBlob = audioBufferToWavBlob(extractedBuffer);
        clips.push(clipBlob);
      }
    }
    
    // Fallback: if silence detection failed completely (e.g. background noise),
    // just split it into equal chunks based on expected count as a last resort
    if (clips.length === 0) {
      console.warn('Silence detection failed to find any clips. Falling back to equal duration splitting.');
      const chunkDuration = audioBuffer.duration / expectedCount;
      for (let i = 0; i < expectedCount; i++) {
        const startSec = i * chunkDuration;
        const endSec = (i + 1) * chunkDuration;
        const extractedBuffer = extractBufferRegion(audioBuffer, audioContext, startSec, endSec);
        clips.push(audioBufferToWavBlob(extractedBuffer));
      }
    }
    
    // If we have fewer clips than expected, duplicate the last one to fill the array 
    // (prevents UI crashes where array lengths don't match)
    while (clips.length < expectedCount && clips.length > 0) {
      clips.push(clips[clips.length - 1]);
    }

    return clips;
  } finally {
    if (audioContext.state !== 'closed') {
      audioContext.close();
    }
  }
}

/**
 * Calculate RMS (Root Mean Square) of audio signal
 * Used for adaptive threshold calculation
 */
function calculateRMS(channelData: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < channelData.length; i++) {
    sum += channelData[i] * channelData[i];
  }
  return Math.sqrt(sum / channelData.length);
}
