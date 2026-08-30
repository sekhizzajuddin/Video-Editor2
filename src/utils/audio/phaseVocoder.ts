// ─────────────────────────────────────────────────────────────────────────────
// PHASE VOCODER PITCH SHIFT (offline, pure)
// -----------------------------------------------------------------------------
// High-quality duration-preserving pitch shift used by the EXPORT audio mix
// (and the vocal-tone / auto-match system). Based on the classic Bernsee
// phase-vocoder pitch shifter:
//
//   • Analysis: windowed FFT frames; per-bin instantaneous frequency is
//     estimated from the phase advance between frames (phase unwrapping
//     against the bin's expected advance).
//   • Shift: output bin k takes the MAGNITUDE of input bin k/ratio and the
//     instantaneous frequency of that bin scaled by `ratio`.
//   • Synthesis: phases are accumulated per bin (never copied raw), so the
//     output stays phase-coherent — a shifted sine stays a clean sine. This
//     is what distinguishes a vocoder from granular/resampling shifters
//     (which phase-scramble and sound robotic/chorusy on sustained tones).
//
// The live preview deliberately keeps its existing granular node (zero
// latency, no regression risk); the export uses this vocoder, so the final
// video's vocal tone is clean and unified.
// ─────────────────────────────────────────────────────────────────────────────

const FFT_SIZE = 2048;
const HOP = FFT_SIZE / 4; // 75% overlap

/** In-place iterative radix-2 complex FFT (forward). */
function fft(re: Float32Array, im: Float32Array): void {
  const n = re.length;
  if (n === 0 || (n & (n - 1)) !== 0) return;

  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i]; re[i] = re[j]; re[j] = t;
      t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }

  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wRe = Math.cos(ang);
    const wIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let curRe = 1;
      let curIm = 0;
      const half = len >> 1;
      for (let j = 0; j < half; j++) {
        const uRe = re[i + j];
        const uIm = im[i + j];
        const vRe = re[i + j + half] * curRe - im[i + j + half] * curIm;
        const vIm = re[i + j + half] * curIm + im[i + j + half] * curRe;
        re[i + j] = uRe + vRe;
        im[i + j] = uIm + vIm;
        re[i + j + half] = uRe - vRe;
        im[i + j + half] = uIm - vIm;
        const nextRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = nextRe;
      }
    }
  }
}

function princArg(x: number): number {
  while (x > Math.PI) x -= 2 * Math.PI;
  while (x < -Math.PI) x += 2 * Math.PI;
  return x;
}

/**
 * Shifts the pitch of `input` by `semitones` while preserving its duration
 * (output length === input length). 0 semitones returns a copy. Inputs
 * shorter than one FFT frame are returned unchanged (nothing meaningful to
 * shift).
 */
export function pitchShiftChannel(input: Float32Array, semitones: number): Float32Array {
  const n = input.length;
  if (n === 0) return new Float32Array(0);
  if (Math.abs(semitones) < 0.01) return input.slice();
  if (n < FFT_SIZE) return input.slice();

  const ratio = Math.pow(2, semitones / 12);
  const half = FFT_SIZE / 2;
  const out = new Float32Array(n);

  const win = new Float32Array(FFT_SIZE);
  for (let i = 0; i < FFT_SIZE; i++) {
    // Symmetric Hann; 4 frames overlap per sample at 75% overlap and the sum
    // of the 4 overlapping windows is 1.5 → scale by 2/3 for flat OLA.
    win[i] = (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (FFT_SIZE - 1))) * (2 / 3);
  }

  const bufRe = new Float32Array(FFT_SIZE);
  const bufIm = new Float32Array(FFT_SIZE);
  const mag = new Float32Array(half + 1);
  const phase = new Float32Array(half + 1);
  const lastPhase = new Float32Array(half + 1);
  const instFreq = new Float32Array(half + 1); // radians per sample
  const sumPhase = new Float32Array(half + 1);

  const omega = (2 * Math.PI * HOP) / FFT_SIZE;

  for (let start = 0; start + FFT_SIZE <= n; start += HOP) {
    // ── analysis ──
    for (let i = 0; i < FFT_SIZE; i++) {
      bufRe[i] = input[start + i] * win[i];
      bufIm[i] = 0;
    }
    fft(bufRe, bufIm);

    for (let k = 0; k <= half; k++) {
      mag[k] = Math.hypot(bufRe[k], bufIm[k]);
      phase[k] = Math.atan2(bufIm[k], bufRe[k]);
      // Unwrap the phase advance against the bin's expected advance to get the
      // instantaneous frequency of the partial occupying this bin.
      const advance = princArg(phase[k] - lastPhase[k] - k * omega) / HOP;
      instFreq[k] = k * ((2 * Math.PI) / FFT_SIZE) + advance;
      lastPhase[k] = phase[k];
    }

    // ── pitch shift: bin k ← bin k/ratio, frequency scaled by ratio ──
    for (let k = 0; k <= half; k++) {
      const src = k / ratio;
      if (src > half) {
        bufRe[k] = 0;
        bufIm[k] = 0;
        continue;
      }
      const i0 = Math.floor(src);
      const frac = src - i0;
      const i1 = Math.min(half, i0 + 1);
      const m = mag[i0] + (mag[i1] - mag[i0]) * frac;
      const f = instFreq[i0] + (instFreq[i1] - instFreq[i0]) * frac;
      sumPhase[k] += f * ratio * HOP;
      bufRe[k] = m * Math.cos(sumPhase[k]);
      bufIm[k] = m * Math.sin(sumPhase[k]);
    }
    // Hermitian symmetry for the negative frequencies.
    for (let k = 1; k < half; k++) {
      bufRe[FFT_SIZE - k] = bufRe[k];
      bufIm[FFT_SIZE - k] = -bufIm[k];
    }
    bufRe[half] = 0; // Nyquist bin must be real; enforce symmetric value
    bufIm[half] = 0;

    // ── inverse FFT (via conjugate trick) ──
    for (let i = 0; i < FFT_SIZE; i++) bufIm[i] = -bufIm[i];
    fft(bufRe, bufIm);
    const inv = 1 / FFT_SIZE;
    for (let i = 0; i < FFT_SIZE; i++) {
      const idx = start + i;
      if (idx < n) out[idx] += bufRe[i] * inv;
    }
  }

  return out;
}

export interface AudioBufferLike {
  numberOfChannels: number;
  length: number;
  sampleRate: number;
  duration: number;
  getChannelData(channel: number): Float32Array;
}

export type AudioBufferFactory = (channels: number, length: number, sampleRate: number) => AudioBufferLike;

/**
 * Returns a copy of `buffer` whose [startSec, endSec) region has been pitch
 * shifted by `semitones` (region length preserved, so timeline offsets stay
 * valid). Returns null when there is nothing to do. `factory` creates the
 * output buffer (injectable so node tests don't need Web Audio).
 */
export function pitchShiftBufferRegion(
  factory: AudioBufferFactory,
  buffer: AudioBufferLike,
  semitones: number,
  startSec = 0,
  endSec = buffer.duration
): AudioBufferLike | null {
  if (Math.abs(semitones) < 0.01) return null;
  const start = Math.max(0, Math.floor(startSec * buffer.sampleRate));
  const end = Math.min(buffer.length, Math.ceil(endSec * buffer.sampleRate));
  if (end - start < FFT_SIZE) return null; // too short to shift meaningfully

  const out = factory(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const src = buffer.getChannelData(ch);
    const dst = out.getChannelData(ch);
    dst.set(src); // untouched region stays identical
    const shifted = pitchShiftChannel(src.subarray(start, end), semitones);
    dst.set(shifted, start); // shifted region has the same length
  }
  return out;
}
