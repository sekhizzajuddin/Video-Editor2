/**
 * beatDetection.ts — Audio beat detection via Web Audio API.
 *
 * Uses RMS energy envelope analysis + adaptive peak picking to find
 * beat timestamps in an audio file. No external dependencies.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BeatDetectionResult {
  beats: number[];    // timestamps in seconds
  bpm: number;        // estimated BPM
  confidence: number; // 0-1 confidence score
}

// ── Core Detection ────────────────────────────────────────────────────────────

/**
 * Detect beats in an audio file given its blob URL.
 * Returns beat timestamps in seconds.
 */
let sharedDecodeCtx: AudioContext | OfflineAudioContext | null = null;

function getDecodeContext(): AudioContext | OfflineAudioContext {
  if (!sharedDecodeCtx) {
    if (typeof OfflineAudioContext !== 'undefined') {
      sharedDecodeCtx = new OfflineAudioContext(1, 1, 44100);
    } else {
      sharedDecodeCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }
  return sharedDecodeCtx;
}

export async function detectBeats(url: string): Promise<BeatDetectionResult> {
  const audioCtx = getDecodeContext();

  // Fetch and decode audio
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

  const sampleRate = audioBuffer.sampleRate;
  const channelData = audioBuffer.getChannelData(0);
  const duration = audioBuffer.duration;

  // Compute RMS energy in overlapping windows of ~20ms
  const windowSize = Math.round(sampleRate * 0.02);  // 20ms
  const hopSize    = Math.round(sampleRate * 0.01);  // 10ms hop (50% overlap)
  const energyFrames: number[] = [];

  for (let i = 0; i + windowSize <= channelData.length; i += hopSize) {
    let sum = 0;
    for (let j = i; j < i + windowSize; j++) {
      sum += channelData[j] * channelData[j];
    }
    energyFrames.push(Math.sqrt(sum / windowSize));
  }

  // Smooth the energy envelope with a simple moving average
  const smoothed = smoothArray(energyFrames, 5);

  // Adaptive peak picking: find local maxima that exceed local mean × threshold
  const windowFrames = Math.round(0.4 / 0.01); // 400ms context window
  const beats: number[] = [];

  for (let i = 1; i < smoothed.length - 1; i++) {
    const lo = Math.max(0, i - windowFrames);
    const hi = Math.min(smoothed.length, i + windowFrames);
    let localMean = 0;
    for (let j = lo; j < hi; j++) localMean += smoothed[j];
    localMean /= (hi - lo);

    const threshold = localMean * 1.4; // 40% above local mean

    // Is local maximum above threshold?
    if (
      smoothed[i] > threshold &&
      smoothed[i] > smoothed[i - 1] &&
      smoothed[i] >= smoothed[i + 1]
    ) {
      const timeSeconds = (i * hopSize) / sampleRate;
      // Enforce minimum inter-beat distance of 250ms (max 240 BPM)
      if (beats.length === 0 || timeSeconds - beats[beats.length - 1] >= 0.25) {
        beats.push(parseFloat(timeSeconds.toFixed(3)));
      }
    }
  }

  // Estimate BPM from median inter-beat interval
  let bpm = 0;
  let confidence = 0;
  if (beats.length >= 4) {
    const ibi: number[] = [];
    for (let i = 1; i < beats.length; i++) ibi.push(beats[i] - beats[i - 1]);
    ibi.sort((a, b) => a - b);
    const medianIbi = ibi[Math.floor(ibi.length / 2)];
    bpm = parseFloat((60 / medianIbi).toFixed(1));

    // Confidence: how consistent are the intervals?
    const mean = ibi.reduce((s, v) => s + v, 0) / ibi.length;
    const variance = ibi.reduce((s, v) => s + (v - mean) ** 2, 0) / ibi.length;
    const cv = Math.sqrt(variance) / mean; // coefficient of variation
    confidence = parseFloat(Math.max(0, Math.min(1, 1 - cv)).toFixed(2));
  }

  return { beats, bpm, confidence };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function smoothArray(arr: number[], radius: number): number[] {
  const out: number[] = new Array(arr.length);
  for (let i = 0; i < arr.length; i++) {
    let sum = 0, count = 0;
    for (let j = Math.max(0, i - radius); j <= Math.min(arr.length - 1, i + radius); j++) {
      sum += arr[j];
      count++;
    }
    out[i] = sum / count;
  }
  return out;
}
