/**
 * audioSeparation.ts
 *
 * Real-time vocal/BGM separation for the video editor.
 * Implements a phase-cancellation-based approach using the Web Audio API
 * for_preview, and provides FFmpeg command generation for export.
 *
 * Supported Modes:
 *   - removeVocals:  Keep background music, reduce/remove vocals
 *   - removeBgm:     Keep vocals, reduce/remove background music
 *   - separateBoth:  Attempt to isolate both (preview only)
 *
 * How Phase Cancellation Works for Vocal Removal:
 *   Vocals are typically mixed equally in the left and right channels (center-panned).
 *   By subtracting one channel from the other, the common center content (vocals)
 *   cancels out, leaving the side content (stereo instruments, reverb, etc.).
 *
 * How "Remove BGM / Keep Vocals" Works:
 *   This is the inverse. We use a mid/side matrix to extract the center channel
 *   (M = L + R, which contains vocals) and then apply some EQ to try to
 *   reduce non-vocal frequencies.
 */

import type { ClipAudioSettings } from '@/types';

export type SeparationMode = 'removeVocals' | 'removeBgm' | 'separateBoth';

export interface SeparationSettings {
  enabled: boolean;
  mode: SeparationMode;
  strength: number; // 0-100
  frequencyBands?: {
    low: number;    // 0-100, 0 = full remove, 100 = full keep
    mid: number;
    high: number;
  };
}

const defaultSettings: SeparationSettings = {
  enabled: false,
  mode: 'removeVocals',
  strength: 80,
  frequencyBands: { low: 100, mid: 100, high: 100 },
};

/**
 * Extract separation settings from ClipAudioSettings, with safe defaults.
 */
export function getSeparationSettings(
  audioSettings?: ClipAudioSettings
): SeparationSettings {
  if (!audioSettings || !audioSettings.vocalSeparation) {
    return defaultSettings;
  }
  return {
    ...defaultSettings,
    ...audioSettings.vocalSeparation,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Real-Time Web Audio API Processing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates an AudioWorkletNode for real-time vocal/BGM separation.
 * Falls back to ScriptProcessorNode if AudioWorklet is unavailable.
 *
 * @param audioCtx - The AudioContext to create nodes in
 * @param settings - The separation settings
 * @returns AudioNode that processes the audio in real-time
 */
export async function createSeparationNode(
  audioCtx: AudioContext,
  settings: SeparationSettings
): Promise<AudioNode> {
  // Try AudioWorklet first (modern browsers)
  if (audioCtx.audioWorklet) {
    try {
      const workletUrl = URL.createObjectURL(
        new Blob([SEPARATION_WORKLET_CODE], { type: 'application/javascript' })
      );
      await audioCtx.audioWorklet.addModule(workletUrl);
      URL.revokeObjectURL(workletUrl);

      const node = new AudioWorkletNode(audioCtx, 'vocal-separation-processor', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [2],
        channelCount: 2,
      });

      // Send initial settings
      updateSeparationParam(node, 'mode', settings.mode);
      updateSeparationParam(node, 'strength', settings.strength / 100);
      if (settings.frequencyBands) {
        updateSeparationParam(node, 'lowBand', settings.frequencyBands.low / 100);
        updateSeparationParam(node, 'midBand', settings.frequencyBands.mid / 100);
        updateSeparationParam(node, 'highBand', settings.frequencyBands.high / 100);
      }

      return node;
    } catch (e) {
      console.warn('AudioWorklet separation failed, falling back to ScriptProcessor:', e);
    }
  }

  // Fallback to ScriptProcessorNode for older browsers
  return createFallbackSeparationNode(audioCtx, settings);
}

/**
 * Updates a separation parameter on an AudioWorkletNode.
 */
export function updateSeparationParam(
  node: AudioWorkletNode,
  paramName: string,
  value: number | string
): void {
  if (!node || !node.parameters) return;
  const param = (node.parameters as any).get?.(paramName);
  if (param && typeof value === 'number') {
    param.setValueAtTime(value, node.context.currentTime);
  }
  // Also send message for non-automatable params
  node.port.postMessage({ type: 'setParam', name: paramName, value });
}

/**
 * Fallback ScriptProcessorNode for browsers without AudioWorklet support.
 */
function createFallbackSeparationNode(
  audioCtx: AudioContext,
  settings: SeparationSettings
): ScriptProcessorNode {
  const bufferSize = 4096;
  const node = audioCtx.createScriptProcessor(bufferSize, 2, 2);

  let mode = settings.mode;
  let strength = settings.strength / 100;
  let lowBand = (settings.frequencyBands?.low ?? 100) / 100;
  let midBand = (settings.frequencyBands?.mid ?? 100) / 100;
  let highBand = (settings.frequencyBands?.high ?? 100) / 100;

  node.onaudioprocess = (e) => {
    const inputL = e.inputBuffer.getChannelData(0);
    const inputR = e.inputBuffer.getChannelData(1);
    const outputL = e.outputBuffer.getChannelData(0);
    const outputR = e.outputBuffer.getChannelData(1);

    for (let i = 0; i < inputL.length; i++) {
      const l = inputL[i];
      const r = inputR[i];

      // Mid/Side decomposition
      const mid = (l + r) * 0.5;   // Center content (typically vocals)
      const side = (l - r) * 0.5;  // Side content (typically instruments)

      let outL, outR;

      if (mode === 'removeVocals') {
        // Keep side (instruments), reduce mid (vocals)
        const midAtten = 1.0 - strength; // Strength 0.8 -> midAtten 0.2
        outL = side + mid * midAtten * lowBand;
        outR = -side + mid * midAtten * lowBand;
      } else if (mode === 'removeBgm') {
        // Keep mid (vocals), reduce side (instruments)
        const sideAtten = 1.0 - strength;
        outL = mid + side * sideAtten * midBand;
        outR = mid - side * sideAtten * midBand;
      } else {
        // separateBoth: moderate separation for both
        const mix = 1.0 - strength * 0.5;
        outL = mid * strength + side * mix;
        outR = mid * strength - side * mix;
      }

      outputL[i] = outL;
      outputR[i] = outR;
    }
  };

  return node;
}

// ─────────────────────────────────────────────────────────────────────────────
// AudioWorklet Processor (as a string for dynamic loading)
// ─────────────────────────────────────────────────────────────────────────────

const SEPARATION_WORKLET_CODE = `
class VocalSeparationProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'mode', defaultValue: 0, minValue: 0, maxValue: 2 }, // 0=removeVocals, 1=removeBgm, 2=separateBoth
      { name: 'strength', defaultValue: 0.8, minValue: 0, maxValue: 1 },
      { name: 'lowBand', defaultValue: 1.0, minValue: 0, maxValue: 1 },
      { name: 'midBand', defaultValue: 1.0, minValue: 0, maxValue: 1 },
      { name: 'highBand', defaultValue: 1.0, minValue: 0, maxValue: 1 }
    ];
  }

  constructor() {
    super();
    this.mode = 0;
    this.strength = 0.8;
    this.lowBand = 1.0;
    this.midBand = 1.0;
    this.highBand = 1.0;

    this.port.onmessage = (e) => {
      if (e.data.type === 'setParam') {
        if (e.data.name === 'mode') {
          const modes = ['removeVocals', 'removeBgm', 'separateBoth'];
          this.mode = modes.indexOf(e.data.value);
          if (this.mode < 0) this.mode = 0;
        } else if (e.data.name === 'strength') {
          this.strength = e.data.value;
        } else if (e.data.name === 'lowBand') {
          this.lowBand = e.data.value;
        } else if (e.data.name === 'midBand') {
          this.midBand = e.data.value;
        } else if (e.data.name === 'highBand') {
          this.highBand = e.data.value;
        }
      }
    };
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || input.length < 2 || !output || output.length < 2) return true;

    const inputL = input[0];
    const inputR = input[1];
    const outputL = output[0];
    const outputR = output[1];

    const mode = this.mode;
    const strength = this.strength;
    const lowBand = this.lowBand;

    for (let i = 0; i < inputL.length; i++) {
      const l = inputL[i];
      const r = inputR[i];

      const mid = (l + r) * 0.5;
      const side = (l - r) * 0.5;

      let outL, outR;

      if (mode === 0) { // removeVocals
        const midAtten = 1.0 - strength;
        outL = side * 2.0 + mid * midAtten * lowBand;
        outR = -side * 2.0 + mid * midAtten * lowBand;
      } else if (mode === 1) { // removeBgm
        const sideAtten = 1.0 - strength;
        outL = mid + side * sideAtten * this.midBand;
        outR = mid - side * sideAtten * this.midBand;
      } else { // separateBoth
        const mix = 1.0 - strength * 0.5;
        outL = mid * strength + side * mix;
        outR = mid * strength - side * mix;
      }

      outputL[i] = outL;
      outputR[i] = outR;
    }

    return true;
  }
}

registerProcessor('vocal-separation-processor', VocalSeparationProcessor);
`;

// ─────────────────────────────────────────────────────────────────────────────
// FFmpeg Export Command Generation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates FFmpeg filter chain arguments for vocal/BGM separation.
 * This can be used during export to apply the separation permanently.
 *
 * @param settings - The separation settings
 * @returns Array of FFmpeg arguments to append to the command
 */
export function getFFmpegSeparationArgs(settings: SeparationSettings): string[] {
  if (!settings.enabled) return [];

  const args: string[] = [];
  const strength = settings.strength / 100;

  if (settings.mode === 'removeVocals') {
    // Phase-cancellation-based vocal removal
    // Convert to mid/side, attenuate mid, convert back to stereo
    // M = L + R (center, vocals), S = L - R (side, instruments)
    const midGain = 1.0 - strength;
    const g1 = 0.5 * (1 + midGain);
    const g2 = 0.5 * (1 - midGain);

    args.push(
      '-af',
      `pan=stereo|c0=${g1}*c0-${g2}*c1|c1=-${g2}*c0+${g1}*c1`
    );
  } else if (settings.mode === 'removeBgm') {
    // Keep center (vocals), reduce side (BGM)
    const sideAtten = 1.0 - strength;
    args.push(
      '-af',
      `pan=stereo|c0=0.5*c0+0.5*c1+${sideAtten}*0.5*c0-${sideAtten}*0.5*c1|c1=0.5*c0+0.5*c1-${sideAtten}*0.5*c0+${sideAtten}*0.5*c1`
    );
  } else {
    // separateBoth: Apply a creative separation effect
    args.push(
      '-af',
      `pan=stereo|c0=${strength}*c0+(1-${strength})*c1|c1=${strength}*c1+(1-${strength})*c0`
    );
  }

  return args;
}

/**
 * Generates FFmpeg filter_complex for per-band frequency control.
 */
export function getFFmpegBandSeparationArgs(settings: SeparationSettings): string[] {
  if (!settings.enabled || !settings.frequencyBands) return [];

  const { low, mid, high } = settings.frequencyBands;
  const lowGain = low / 100;
  const midGain = mid / 100;
  const highGain = high / 100;

  // Use crossover filters to split into bands, apply per-band gain, then recombine
  return [
    '-af',
    `crossover=f=200:order=4[low][midhigh];` +
    `[midhigh]crossover=f=3000:order=4[mid][high];` +
    `[low]volume=${lowGain}[low_mod];` +
    `[mid]volume=${midGain}[mid_mod];` +
    `[high]volume=${highGain}[high_mod];` +
    `[low_mod][mid_mod][high_mod]amix=inputs=3`
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility: Validate and sanitize separation settings
// ─────────────────────────────────────────────────────────────────────────────

export function sanitizeSeparationSettings(
  settings: Partial<SeparationSettings>
): SeparationSettings {
  return {
    enabled: settings.enabled ?? false,
    mode: settings.mode ?? 'removeVocals',
    strength: Math.max(0, Math.min(100, settings.strength ?? 80)),
    frequencyBands: {
      low: Math.max(0, Math.min(100, settings.frequencyBands?.low ?? 100)),
      mid: Math.max(0, Math.min(100, settings.frequencyBands?.mid ?? 100)),
      high: Math.max(0, Math.min(100, settings.frequencyBands?.high ?? 100)),
    },
  };
}
// ─────────────────────────────────────────────────────────────────────────────

export function getSeparationModeLabel(mode: SeparationMode): string {
  switch (mode) {
    case 'removeVocals': return 'Remove Vocals (Keep BGM)';
    case 'removeBgm': return 'Remove BGM (Keep Vocals)';
    case 'separateBoth': return 'Separate Both';
    default: return 'Unknown';
  }
}
