/**
 * Utility to decode an audio Blob, detect silence gaps, and split it back into multiple Blobs.
 * This runs entirely client-side using the Web Audio API.
 */

// Converts an AudioBuffer back to a wav Blob
function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const bufferArray = new ArrayBuffer(length);
  const view = new DataView(bufferArray);
  const channels = [];
  let sample;
  let offset = 0;
  let pos = 0;

  // write WAVE header
  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8); // file length - 8
  setUint32(0x45564157); // "WAVE"
  setUint32(0x20746d66); // "fmt " chunk
  setUint32(16); // length = 16
  setUint16(1); // PCM (uncompressed)
  setUint16(numOfChan);
  setUint32(buffer.sampleRate);
  setUint32(buffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
  setUint16(numOfChan * 2); // block-align
  setUint16(16); // 16-bit
  setUint32(0x61746164); // "data" - chunk
  setUint32(length - pos - 4); // chunk length

  for (let i = 0; i < buffer.numberOfChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  while (offset < buffer.length) {
    for (let i = 0; i < numOfChan; i++) {
      sample = Math.max(-1, Math.min(1, channels[i][offset])); // clamp
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0; // scale to 16-bit signed int
      view.setInt16(pos, sample, true); // write 16-bit sample
      pos += 2;
    }
    offset++; // next source sample
  }

  function setUint16(data: number) {
    view.setUint16(pos, data, true);
    pos += 2;
  }

  function setUint32(data: number) {
    view.setUint32(pos, data, true);
    pos += 4;
  }

  return new Blob([bufferArray], { type: 'audio/wav' });
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
 * Main function to split a single audio Blob containing multiple SFX separated by silence.
 * 
 * @param audioBlob The downloaded audio blob from ElevenLabs
 * @param expectedCount How many clips we expect to get out of it
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
    
    // Convert to mono for easier volume analysis
    const channelData = audioBuffer.getChannelData(0); 
    const sampleRate = audioBuffer.sampleRate;
    
    // Configuration for silence detection
    const minSilenceDurationSec = 0.3; // minimum duration to be considered a split point
    const minSilenceSamples = minSilenceDurationSec * sampleRate;
    const threshold = 0.02; // amplitude threshold for silence (0.0 to 1.0)
    
    const splitPoints: number[] = [0]; // Always start at 0
    let silenceStart = -1;
    
    // Pass 1: Find silences
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
            // Found a valid silence gap. The split point is the middle of the silence
            const splitSample = silenceStart + Math.floor(silenceDuration / 2);
            splitPoints.push(splitSample / sampleRate);
          }
          silenceStart = -1;
        }
      }
    }
    
    splitPoints.push(audioBuffer.duration); // Always end at the end
    
    // Pass 2: If we didn't find exactly the expected count, adjust threshold dynamically
    // (A more advanced implementation would re-run with different thresholds, 
    // but for now, if we found *at least* the expected count, we just take the first N clips)
    
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
