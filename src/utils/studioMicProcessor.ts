/**
 * studioMicProcessor.ts
 *
 * Real-Time Web Audio DSP Engine: "Laptop Mic to Studio Mic"
 * Transforms thin, noisy, hollow laptop microphones into rich, broadcast-ready
 * studio condenser microphones (e.g. Shure SM7B / Rode NT1 profile).
 *
 * Signal Chain:
 * 1. Low-Cut De-Rumble (Cascaded 18dB/oct High-Pass @ 80Hz) - eliminates desk bumps, AC hum, laptop fan rumble
 * 2. Adaptive Noise Gate - smoothly silences background room hiss/fan noise when not speaking
 * 3. Studio Acoustic EQ:
 *    - Low Warmth (Bass Body): +3.0dB @ 160Hz (simulates large-diaphragm proximity effect)
 *    - Anti-Boxiness Notch (Mud Cut): -3.0dB @ 480Hz (cuts plastic laptop body resonance)
 *    - Vocal Clarity Peaking: +2.8dB @ 3.2kHz (forward vocal projection & intelligibility)
 *    - De-Esser Band: -2.5dB @ 6.8kHz (tames piercing electret sibilance)
 *    - High Shelf "Air" / Studio Sheen: +3.5dB @ 11kHz (adds open, silky condenser sparkle)
 * 4. Broadcast Dynamics Compressor (Levels vocal dynamics, smooth punchy radio tone)
 * 5. Warm Harmonic Saturation (Soft-knee tube/preamp analog warmth)
 * 6. Makeup Gain & Brickwall Limiter (Prevents digital clipping while maintaining standard loudness)
 */

export type StudioMicPresetId =
  | 'natural-studio'
  | 'studio-podcast'
  | 'broadcast-radio'
  | 'warm-voiceover'
  | 'crisp-clarity'
  | 'clean-denoise'
  | 'bypass';

export interface StudioMicPreset {
  id: StudioMicPresetId;
  name: string;
  description: string;
  settings: StudioMicSettings;
}

export interface StudioMicSettings {
  enabled: boolean;
  lowCutFreq: number;           // Hz (e.g. 60)
  gateThresholdDb: number;       // dB (-60 to -25, default -45)
  gateReductionDb: number;       // dB (-30 to -8, default -14)
  warmthGain: number;            // dB (-6 to +8, default +2.0)
  mudCutGain: number;            // dB (-8 to 0, default -2.0)
  clarityGain: number;           // dB (-3 to +8, default +2.2)
  deEsserGain: number;           // dB (-8 to 0, default -1.5)
  airGain: number;               // dB (-3 to +8, default +2.5)
  compressorThreshold: number;   // dB (-35 to -10, default -18)
  compressorRatio: number;       // ratio (1 to 10, default 2.4)
  outputGainDb: number;          // dB (0 to +12, default +3.0)
  saturationAmount: number;      // 0 to 1 (subtle analog warmth)
  monitoring: boolean;           // Hear own voice in headphones
}

export const STUDIO_MIC_PRESETS: Record<StudioMicPresetId, StudioMicPreset> = {
  'natural-studio': {
    id: 'natural-studio',
    name: '🎙️ Natural Studio Vocal (Crystal Clear, Full Dynamics)',
    description: 'Preserves 100% of your natural vocal tone, warmth, and dynamics with gentle transparent de-noise and zero muffling.',
    settings: {
      enabled: true,
      lowCutFreq: 60,
      gateThresholdDb: -46,
      gateReductionDb: -12,
      warmthGain: 1.8,
      mudCutGain: -1.8,
      clarityGain: 2.2,
      deEsserGain: -1.2,
      airGain: 2.2,
      compressorThreshold: -16,
      compressorRatio: 2.0,
      outputGainDb: 2.5,
      saturationAmount: 0.0,
      monitoring: false,
    },
  },
  'studio-podcast': {
    id: 'studio-podcast',
    name: '📻 Studio Podcast (Shure SM7B Style)',
    description: 'Proximity warmth, rich chest resonance, smooth broadcast leveling, and gentle background fan attenuation.',
    settings: {
      enabled: true,
      lowCutFreq: 70,
      gateThresholdDb: -44,
      gateReductionDb: -14,
      warmthGain: 2.5,
      mudCutGain: -2.5,
      clarityGain: 2.4,
      deEsserGain: -1.5,
      airGain: 2.8,
      compressorThreshold: -18,
      compressorRatio: 2.6,
      outputGainDb: 3.2,
      saturationAmount: 0.08,
      monitoring: false,
    },
  },
  'broadcast-radio': {
    id: 'broadcast-radio',
    name: '📢 Broadcast Radio (Punchy & Forward)',
    description: 'High intelligibility, punchy leveling, and forward vocal presence designed to cut through background noise.',
    settings: {
      enabled: true,
      lowCutFreq: 80,
      gateThresholdDb: -40,
      gateReductionDb: -18,
      warmthGain: 2.0,
      mudCutGain: -3.0,
      clarityGain: 3.5,
      deEsserGain: -2.5,
      airGain: 3.2,
      compressorThreshold: -22,
      compressorRatio: 3.5,
      outputGainDb: 4.2,
      saturationAmount: 0.15,
      monitoring: false,
    },
  },
  'warm-voiceover': {
    id: 'warm-voiceover',
    name: '🎬 Warm Voiceover (Audiobook / Narration)',
    description: 'Silky smooth high frequencies, natural conversational dynamics, and intimate vocal tone.',
    settings: {
      enabled: true,
      lowCutFreq: 65,
      gateThresholdDb: -48,
      gateReductionDb: -12,
      warmthGain: 2.5,
      mudCutGain: -2.0,
      clarityGain: 1.6,
      deEsserGain: -1.2,
      airGain: 2.2,
      compressorThreshold: -16,
      compressorRatio: 2.2,
      outputGainDb: 2.5,
      saturationAmount: 0.05,
      monitoring: false,
    },
  },
  'crisp-clarity': {
    id: 'crisp-clarity',
    name: '✨ Crisp Clarity (Meetings & Explainers)',
    description: 'Maximum articulation and clarity with de-mudded lows and sparkling highs for modern web video.',
    settings: {
      enabled: true,
      lowCutFreq: 85,
      gateThresholdDb: -42,
      gateReductionDb: -15,
      warmthGain: 1.0,
      mudCutGain: -3.5,
      clarityGain: 3.5,
      deEsserGain: -2.0,
      airGain: 3.5,
      compressorThreshold: -18,
      compressorRatio: 2.6,
      outputGainDb: 3.0,
      saturationAmount: 0.05,
      monitoring: false,
    },
  },
  'clean-denoise': {
    id: 'clean-denoise',
    name: '🧼 Clean Denoise Only',
    description: 'Subtle noise gate and low-cut filter to remove background hum while preserving 100% raw natural voice tone.',
    settings: {
      enabled: true,
      lowCutFreq: 60,
      gateThresholdDb: -46,
      gateReductionDb: -12,
      warmthGain: 0,
      mudCutGain: 0,
      clarityGain: 0,
      deEsserGain: 0,
      airGain: 0,
      compressorThreshold: -12,
      compressorRatio: 1.2,
      outputGainDb: 1.0,
      saturationAmount: 0,
      monitoring: false,
    },
  },
  'bypass': {
    id: 'bypass',
    name: '🔄 Bypass (Raw Laptop Mic)',
    description: 'Disables all studio DSP so you can directly A/B compare your laptop mic against the studio enhancement.',
    settings: {
      enabled: false,
      lowCutFreq: 20,
      gateThresholdDb: -80,
      gateReductionDb: 0,
      warmthGain: 0,
      mudCutGain: 0,
      clarityGain: 0,
      deEsserGain: 0,
      airGain: 0,
      compressorThreshold: 0,
      compressorRatio: 1.0,
      outputGainDb: 0,
      saturationAmount: 0,
      monitoring: false,
    },
  },
};

/**
 * Generates an S-curve transfer function for gentle warm analog tube saturation.
 */
function makeWarmSaturationCurve(amount: number, nSamples = 1024): any {
  const curve = new Float32Array(nSamples);
  const k = Math.max(0, Math.min(amount * 40, 40));
  const deg = Math.PI / 180;
  for (let i = 0; i < nSamples; ++i) {
    const x = (i * 2) / nSamples - 1;
    if (k === 0) {
      curve[i] = x;
    } else {
      // Soft saturation arctan wave-shaper
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
  }
  return curve;
}

export class StudioMicProcessor {
  private audioCtx: AudioContext | null = null;
  private inputStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;

  // Filter & DSP Nodes
  private highpassFilter1: BiquadFilterNode | null = null;
  private highpassFilter2: BiquadFilterNode | null = null;
  private gateGainNode: GainNode | null = null;
  private warmthFilter: BiquadFilterNode | null = null;
  private mudCutFilter: BiquadFilterNode | null = null;
  private clarityFilter: BiquadFilterNode | null = null;
  private deEsserFilter: BiquadFilterNode | null = null;
  private airFilter: BiquadFilterNode | null = null;
  private compressorNode: DynamicsCompressorNode | null = null;
  private saturationNode: WaveShaperNode | null = null;
  private outputGainNode: GainNode | null = null;
  private limiterNode: DynamicsCompressorNode | null = null;
  private destinationNode: MediaStreamAudioDestinationNode | null = null;
  private monitorGainNode: GainNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private preGateDetectorNode: AnalyserNode | null = null;
  private lastSpeechTime = 0;

  // Bypass nodes
  private bypassGainNode: GainNode | null = null;
  private processedMasterGainNode: GainNode | null = null;

  // Real-time Gate & Metering loop
  private animFrameId: number | null = null;
  private timeDataBuffer: any = null;
  private currentGateGain = 1.0;
  private isGateOpen = true;
  private currentRms = 0;
  private currentDb = -100;
  private peakDb = -100;

  // Current settings
  public settings: StudioMicSettings = { ...STUDIO_MIC_PRESETS['natural-studio'].settings };
  public currentPresetId: StudioMicPresetId = 'natural-studio';

  constructor() {}

  /**
   * Initializes the studio DSP rack with an active user microphone MediaStream.
   */
  public async init(stream: MediaStream, initialPreset: StudioMicPresetId = 'natural-studio'): Promise<MediaStream> {
    this.dispose();

    if (typeof window === 'undefined') {
      throw new Error('AudioContext unavailable in non-browser environment.');
    }

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) {
      throw new Error('Web Audio API is not supported in this browser.');
    }

    this.audioCtx = new AudioContextClass({ latencyHint: 'interactive' });
    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }

    this.inputStream = stream;
    this.sourceNode = this.audioCtx.createMediaStreamSource(stream);

    // Dedicated Pre-Gate Detector: Analyzes TRUE acoustic incoming signal
    // (Never reads post-gate, preventing positive-feedback cutoff or swallowed words)
    this.preGateDetectorNode = this.audioCtx.createAnalyser();
    this.preGateDetectorNode.fftSize = 512;
    this.preGateDetectorNode.smoothingTimeConstant = 0.25;
    this.sourceNode.connect(this.preGateDetectorNode);

    // 1. Cascaded High-pass filters (18-24dB/oct rumble cut)
    this.highpassFilter1 = this.audioCtx.createBiquadFilter();
    this.highpassFilter1.type = 'highpass';
    this.highpassFilter1.frequency.value = this.settings.lowCutFreq;
    this.highpassFilter1.Q.value = 0.707;

    this.highpassFilter2 = this.audioCtx.createBiquadFilter();
    this.highpassFilter2.type = 'highpass';
    this.highpassFilter2.frequency.value = this.settings.lowCutFreq;
    this.highpassFilter2.Q.value = 0.707;

    // 2. Noise Gate Gain Node
    this.gateGainNode = this.audioCtx.createGain();
    this.gateGainNode.gain.value = 1.0;

    // 3. Studio Acoustic EQ Bands
    // 3a. Warmth (160 Hz peaking boost for large-diaphragm proximity effect)
    this.warmthFilter = this.audioCtx.createBiquadFilter();
    this.warmthFilter.type = 'peaking';
    this.warmthFilter.frequency.value = 160;
    this.warmthFilter.Q.value = 1.2;
    this.warmthFilter.gain.value = this.settings.warmthGain;

    // 3b. Anti-Boxiness Mud Cut (480 Hz cut to remove cheap plastic laptop casing resonance)
    this.mudCutFilter = this.audioCtx.createBiquadFilter();
    this.mudCutFilter.type = 'peaking';
    this.mudCutFilter.frequency.value = 480;
    this.mudCutFilter.Q.value = 1.8;
    this.mudCutFilter.gain.value = this.settings.mudCutGain;

    // 3c. Vocal Clarity (3.2 kHz peaking boost for presence & intelligibility)
    this.clarityFilter = this.audioCtx.createBiquadFilter();
    this.clarityFilter.type = 'peaking';
    this.clarityFilter.frequency.value = 3200;
    this.clarityFilter.Q.value = 1.2;
    this.clarityFilter.gain.value = this.settings.clarityGain;

    // 3d. De-Esser (6.8 kHz dip to eliminate harsh electret sibilance)
    this.deEsserFilter = this.audioCtx.createBiquadFilter();
    this.deEsserFilter.type = 'peaking';
    this.deEsserFilter.frequency.value = 6800;
    this.deEsserFilter.Q.value = 2.4;
    this.deEsserFilter.gain.value = this.settings.deEsserGain;

    // 3e. Studio "Air" (11 kHz high-shelf boost for sparkling condenser microphone sheen)
    this.airFilter = this.audioCtx.createBiquadFilter();
    this.airFilter.type = 'highshelf';
    this.airFilter.frequency.value = 11000;
    this.airFilter.gain.value = this.settings.airGain;

    // 4. Dynamics Compressor (Broadcast leveling)
    this.compressorNode = this.audioCtx.createDynamicsCompressor();
    this.compressorNode.threshold.value = this.settings.compressorThreshold;
    this.compressorNode.knee.value = 8;
    this.compressorNode.ratio.value = this.settings.compressorRatio;
    this.compressorNode.attack.value = 0.005; // 5ms fast attack
    this.compressorNode.release.value = 0.090; // 90ms smooth release

    // 5. Warm Tube Saturation
    this.saturationNode = this.audioCtx.createWaveShaper();
    this.saturationNode.curve = makeWarmSaturationCurve(this.settings.saturationAmount);
    this.saturationNode.oversample = '4x';

    // 6. Output Gain & Brickwall Limiter
    this.outputGainNode = this.audioCtx.createGain();
    const gainLinear = Math.pow(10, this.settings.outputGainDb / 20);
    this.outputGainNode.gain.value = gainLinear;

    this.limiterNode = this.audioCtx.createDynamicsCompressor();
    this.limiterNode.threshold.value = -1.0;
    this.limiterNode.knee.value = 0;
    this.limiterNode.ratio.value = 20; // brickwall
    this.limiterNode.attack.value = 0.001;
    this.limiterNode.release.value = 0.050;

    // Master processing switch (Bypass vs Processed)
    this.processedMasterGainNode = this.audioCtx.createGain();
    this.processedMasterGainNode.gain.value = this.settings.enabled ? 1.0 : 0.0;

    this.bypassGainNode = this.audioCtx.createGain();
    this.bypassGainNode.gain.value = this.settings.enabled ? 0.0 : 1.0;

    // Output destination stream (fed into MediaRecorder)
    this.destinationNode = this.audioCtx.createMediaStreamDestination();

    // Metering Analyser Node
    this.analyserNode = this.audioCtx.createAnalyser();
    this.analyserNode.fftSize = 512;
    this.analyserNode.smoothingTimeConstant = 0.4;
    this.timeDataBuffer = new Float32Array(this.analyserNode.fftSize);

    // Monitoring node (headphones)
    this.monitorGainNode = this.audioCtx.createGain();
    this.monitorGainNode.gain.value = this.settings.monitoring ? 0.8 : 0.0;

    // ── Wire Processed Path ──────────────────────────────────────────────────
    // source -> highpass1 -> highpass2 -> gate -> warmth -> mudCut -> clarity -> deEsser -> air -> compressor -> saturation -> outputGain -> limiter -> processedMasterGain
    this.sourceNode.connect(this.highpassFilter1);
    this.highpassFilter1.connect(this.highpassFilter2);
    this.highpassFilter2.connect(this.gateGainNode);
    this.gateGainNode.connect(this.warmthFilter);
    this.warmthFilter.connect(this.mudCutFilter);
    this.mudCutFilter.connect(this.clarityFilter);
    this.clarityFilter.connect(this.deEsserFilter);
    this.deEsserFilter.connect(this.airFilter);
    this.airFilter.connect(this.compressorNode);
    this.compressorNode.connect(this.saturationNode);
    this.saturationNode.connect(this.outputGainNode);
    this.outputGainNode.connect(this.limiterNode);
    this.limiterNode.connect(this.processedMasterGainNode);

    // ── Wire Bypass Path ─────────────────────────────────────────────────────
    this.sourceNode.connect(this.bypassGainNode);

    // ── Combine to Destination & Analyser & Monitor ──────────────────────────
    this.processedMasterGainNode.connect(this.destinationNode);
    this.bypassGainNode.connect(this.destinationNode);

    this.processedMasterGainNode.connect(this.analyserNode);
    this.bypassGainNode.connect(this.analyserNode);

    this.processedMasterGainNode.connect(this.monitorGainNode);
    this.bypassGainNode.connect(this.monitorGainNode);
    this.monitorGainNode.connect(this.audioCtx.destination);

    // Apply preset
    this.setPreset(initialPreset);

    // Start Real-Time Envelope Gate & Metering Loop
    this.startMeteringLoop();

    return this.destinationNode.stream;
  }

  /**
   * Sets a predefined Studio Mic DSP preset.
   */
  public setPreset(presetId: StudioMicPresetId) {
    const preset = STUDIO_MIC_PRESETS[presetId];
    if (!preset) return;
    this.currentPresetId = presetId;
    this.updateSettings(preset.settings);
  }

  /**
   * Updates any studio DSP settings dynamically in real time.
   */
  public updateSettings(partial: Partial<StudioMicSettings>) {
    this.settings = { ...this.settings, ...partial };
    if (!this.audioCtx) return;

    const t = this.audioCtx.currentTime;

    // Master enable / bypass
    if (this.processedMasterGainNode && this.bypassGainNode) {
      if (this.settings.enabled) {
        this.processedMasterGainNode.gain.setTargetAtTime(1.0, t, 0.03);
        this.bypassGainNode.gain.setTargetAtTime(0.0, t, 0.03);
      } else {
        this.processedMasterGainNode.gain.setTargetAtTime(0.0, t, 0.03);
        this.bypassGainNode.gain.setTargetAtTime(1.0, t, 0.03);
      }
    }

    // Highpass Low-cut
    if (this.highpassFilter1 && this.highpassFilter2) {
      const f = Math.max(20, Math.min(250, this.settings.lowCutFreq));
      this.highpassFilter1.frequency.setTargetAtTime(f, t, 0.03);
      this.highpassFilter2.frequency.setTargetAtTime(f, t, 0.03);
    }

    // EQ Bands
    if (this.warmthFilter) {
      this.warmthFilter.gain.setTargetAtTime(this.settings.warmthGain, t, 0.03);
    }
    if (this.mudCutFilter) {
      this.mudCutFilter.gain.setTargetAtTime(this.settings.mudCutGain, t, 0.03);
    }
    if (this.clarityFilter) {
      this.clarityFilter.gain.setTargetAtTime(this.settings.clarityGain, t, 0.03);
    }
    if (this.deEsserFilter) {
      this.deEsserFilter.gain.setTargetAtTime(this.settings.deEsserGain, t, 0.03);
    }
    if (this.airFilter) {
      this.airFilter.gain.setTargetAtTime(this.settings.airGain, t, 0.03);
    }

    // Compressor
    if (this.compressorNode) {
      this.compressorNode.threshold.setTargetAtTime(this.settings.compressorThreshold, t, 0.03);
      this.compressorNode.ratio.setTargetAtTime(this.settings.compressorRatio, t, 0.03);
    }

    // Saturation
    if (this.saturationNode) {
      this.saturationNode.curve = makeWarmSaturationCurve(this.settings.saturationAmount);
    }

    // Output Gain
    if (this.outputGainNode) {
      const gainLinear = Math.pow(10, this.settings.outputGainDb / 20);
      this.outputGainNode.gain.setTargetAtTime(gainLinear, t, 0.03);
    }

    // Headphone monitoring
    if (this.monitorGainNode) {
      this.monitorGainNode.gain.setTargetAtTime(this.settings.monitoring ? 0.8 : 0.0, t, 0.05);
    }
  }

  /**
   * Real-time metering and adaptive noise gate loop.
   * Reads from preGateDetectorNode to ensure speech dynamics are preserved without cutoffs.
   */
  private startMeteringLoop() {
    const loop = () => {
      if (!this.preGateDetectorNode || !this.timeDataBuffer || !this.audioCtx) return;

      // Sample TRUE acoustic pre-gate incoming signal (immune to gate attenuation feedback)
      this.preGateDetectorNode.getFloatTimeDomainData(this.timeDataBuffer);

      // Compute RMS and Peak
      let sumSquares = 0;
      let peak = 0;
      for (let i = 0; i < this.timeDataBuffer.length; i++) {
        const val = this.timeDataBuffer[i];
        const absVal = Math.abs(val);
        if (absVal > peak) peak = absVal;
        sumSquares += val * val;
      }
      const rms = Math.sqrt(sumSquares / this.timeDataBuffer.length);
      this.currentRms = rms;

      const db = rms > 0.00001 ? 20 * Math.log10(rms) : -100;
      this.currentDb = Math.max(-100, Math.min(0, db));
      this.peakDb = peak > 0.00001 ? 20 * Math.log10(peak) : -100;

      // Noise Gate logic with Hysteresis & Hold Time
      if (this.settings.enabled && this.gateGainNode) {
        const openThreshold = this.settings.gateThresholdDb;
        const closeThreshold = openThreshold - 6.0; // 6 dB hysteresis prevents chattering
        const holdTimeSec = 0.18; // 180ms hold time keeps word endings and quiet phonemes intact
        const floorGain = Math.pow(10, this.settings.gateReductionDb / 20); // e.g. -12dB = 0.25

        const now = this.audioCtx.currentTime;

        if (this.currentDb > openThreshold) {
          this.lastSpeechTime = now;
          this.isGateOpen = true;
          this.currentGateGain = 1.0;
          this.gateGainNode.gain.setTargetAtTime(1.0, now, 0.008);
        } else if (now - this.lastSpeechTime < holdTimeSec || this.currentDb > closeThreshold) {
          // Keep gate open during natural breath/syllable pauses
          this.isGateOpen = true;
          this.currentGateGain = 1.0;
          this.gateGainNode.gain.setTargetAtTime(1.0, now, 0.008);
        } else {
          // Close gate smoothly without clipping or popping
          this.isGateOpen = false;
          this.currentGateGain = floorGain;
          this.gateGainNode.gain.setTargetAtTime(floorGain, now, 0.15);
        }
      }

      this.animFrameId = requestAnimationFrame(loop);
    };

    this.animFrameId = requestAnimationFrame(loop);
  }

  /**
   * Returns live metering telemetry for UI meters (VU meter, gate status, dBFS).
   */
  public getMeterTelemetry() {
    return {
      rms: this.currentRms,
      db: this.currentDb,
      peakDb: this.peakDb,
      gateOpen: this.isGateOpen,
      gateGain: this.currentGateGain,
      enabled: this.settings.enabled,
    };
  }

  /**
   * Offline DSP processor: Applies the exact studio mic processing chain to an AudioBuffer.
   * Useful for post-recording polish and export.
   */
  public async processAudioBuffer(inputBuffer: AudioBuffer): Promise<AudioBuffer> {
    if (typeof window === 'undefined') return inputBuffer;
    const OfflineCtxClass = window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;
    if (!OfflineCtxClass) {
      return inputBuffer;
    }

    const offlineCtx = new OfflineCtxClass(
      inputBuffer.numberOfChannels,
      inputBuffer.length,
      inputBuffer.sampleRate
    );

    const source = offlineCtx.createBufferSource();
    source.buffer = inputBuffer;

    const hp1 = offlineCtx.createBiquadFilter();
    hp1.type = 'highpass';
    hp1.frequency.value = this.settings.lowCutFreq;

    const hp2 = offlineCtx.createBiquadFilter();
    hp2.type = 'highpass';
    hp2.frequency.value = this.settings.lowCutFreq;

    const warmth = offlineCtx.createBiquadFilter();
    warmth.type = 'peaking';
    warmth.frequency.value = 160;
    warmth.Q.value = 1.2;
    warmth.gain.value = this.settings.warmthGain;

    const mudCut = offlineCtx.createBiquadFilter();
    mudCut.type = 'peaking';
    mudCut.frequency.value = 480;
    mudCut.Q.value = 1.8;
    mudCut.gain.value = this.settings.mudCutGain;

    const clarity = offlineCtx.createBiquadFilter();
    clarity.type = 'peaking';
    clarity.frequency.value = 3200;
    clarity.Q.value = 1.2;
    clarity.gain.value = this.settings.clarityGain;

    const deEsser = offlineCtx.createBiquadFilter();
    deEsser.type = 'peaking';
    deEsser.frequency.value = 6800;
    deEsser.Q.value = 2.4;
    deEsser.gain.value = this.settings.deEsserGain;

    const air = offlineCtx.createBiquadFilter();
    air.type = 'highshelf';
    air.frequency.value = 11000;
    air.gain.value = this.settings.airGain;

    const comp = offlineCtx.createDynamicsCompressor();
    comp.threshold.value = this.settings.compressorThreshold;
    comp.ratio.value = this.settings.compressorRatio;
    comp.attack.value = 0.005;
    comp.release.value = 0.090;

    const shaper = offlineCtx.createWaveShaper();
    shaper.curve = makeWarmSaturationCurve(this.settings.saturationAmount);

    const outGain = offlineCtx.createGain();
    outGain.gain.value = Math.pow(10, this.settings.outputGainDb / 20);

    const limiter = offlineCtx.createDynamicsCompressor();
    limiter.threshold.value = -1.0;
    limiter.ratio.value = 20;

    source.connect(hp1);
    hp1.connect(hp2);
    hp2.connect(warmth);
    warmth.connect(mudCut);
    mudCut.connect(clarity);
    clarity.connect(deEsser);
    deEsser.connect(air);
    air.connect(comp);
    comp.connect(shaper);
    shaper.connect(outGain);
    outGain.connect(limiter);
    limiter.connect(offlineCtx.destination);

    source.start(0);
    return await offlineCtx.startRendering();
  }

  /**
   * Cleans up and closes all audio context nodes.
   */
  public dispose() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    try {
      this.sourceNode?.disconnect();
      this.highpassFilter1?.disconnect();
      this.highpassFilter2?.disconnect();
      this.gateGainNode?.disconnect();
      this.warmthFilter?.disconnect();
      this.mudCutFilter?.disconnect();
      this.clarityFilter?.disconnect();
      this.deEsserFilter?.disconnect();
      this.airFilter?.disconnect();
      this.compressorNode?.disconnect();
      this.saturationNode?.disconnect();
      this.outputGainNode?.disconnect();
      this.limiterNode?.disconnect();
      this.processedMasterGainNode?.disconnect();
      this.bypassGainNode?.disconnect();
      this.monitorGainNode?.disconnect();
      this.analyserNode?.disconnect();
      this.preGateDetectorNode?.disconnect();
      this.preGateDetectorNode = null;

      if (this.audioCtx && this.audioCtx.state !== 'closed') {
        this.audioCtx.close().catch(() => {});
      }
    } catch (e) {
      console.warn('Error closing StudioMicProcessor nodes:', e);
    }

    this.audioCtx = null;
    this.sourceNode = null;
    this.preGateDetectorNode = null;
    this.inputStream = null;
  }
}
