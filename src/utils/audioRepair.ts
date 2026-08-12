/**
 * audioRepair.ts
 *
 * Reconstructs a mathematically perfect standard PCM WAV file from potentially corrupt
 * audio files (e.g. VBR, missing headers) by leveraging the Web Audio API's decodeAudioData
 * which extracts the pure uncompressed PCM waveform.
 */

export async function repairAudioFile(file: File): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer();
  
  // Use a temporary OfflineAudioContext just to parse the file
  const AudioContextClass = (window as any).OfflineAudioContext || (window as any).webkitOfflineAudioContext;
  if (!AudioContextClass) {
    throw new Error('OfflineAudioContext not supported in this browser.');
  }

  // Create a minimal offline context to decode the data
  // (We don't know the length or sample rate yet, we just use it for decoding)
  const tempCtx = new AudioContextClass(1, 1, 48000);
  const audioBuffer = await tempCtx.decodeAudioData(arrayBuffer);

  return audioBufferToWav(audioBuffer);
}

function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  
  let totalLength = 0;
  const channels = [];
  for (let i = 0; i < numChannels; i++) {
    const channelData = buffer.getChannelData(i);
    channels.push(channelData);
    totalLength += channelData.length;
  }

  const length = totalLength * (bitDepth / 8);
  const bufferArray = new ArrayBuffer(44 + length);
  const view = new DataView(bufferArray);

  // RIFF Chunk
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + length, true);
  writeString(view, 8, 'WAVE');

  // Format Chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // chunk size
  view.setUint16(20, format, true); // audio format (1 = PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true); // byte rate
  view.setUint16(32, numChannels * (bitDepth / 8), true); // block align
  view.setUint16(34, bitDepth, true);

  // Data Chunk
  writeString(view, 36, 'data');
  view.setUint32(40, length, true);

  // Write PCM samples
  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      let sample = channels[channel][i];
      // Hard clipping
      sample = Math.max(-1, Math.min(1, sample));
      // Convert to 16-bit PCM
      sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset, sample, true);
      offset += 2;
    }
  }

  return new Blob([view], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
