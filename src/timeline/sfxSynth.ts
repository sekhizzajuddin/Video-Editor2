export function audioBufferToWav(buffer: AudioBuffer): Blob {
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

// ── Studio DSP Sound Helpers ──────────────────────────────────────────────────

/**
 * Generates natural pink noise (1/f spectral curve) with decorrelated left and
 * right channels. Unlike harsh white static, pink noise mimics real-world
 * acoustic air displacement, wind rush, and fluid dynamics.
 */
function createStereoPinkNoise(offlineCtx: OfflineAudioContext, duration: number, sampleRate: number): AudioBufferSourceNode {
  const bufferSize = Math.max(1, Math.floor(sampleRate * duration));
  const noiseBuffer = offlineCtx.createBuffer(2, bufferSize, sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const output = noiseBuffer.getChannelData(ch);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.14;
      b6 = white * 0.115926;
    }
  }
  const source = offlineCtx.createBufferSource();
  source.buffer = noiseBuffer;
  return source;
}

/**
 * Creates an analog-style soft-saturation curve [tanh(x)] to round off sharp
 * digital peaks, produce rich warm harmonics, and prevent clipping.
 */
function createSoftSaturator(offlineCtx: OfflineAudioContext): WaveShaperNode {
  const shaper = offlineCtx.createWaveShaper();
  const n_samples = 512;
  const curve = new Float32Array(n_samples);
  for (let i = 0; i < n_samples; ++i) {
    const x = (i * 2) / n_samples - 1;
    curve[i] = Math.tanh(x * 1.6) / Math.tanh(1.6);
  }
  shaper.curve = curve;
  shaper.oversample = '2x';
  return shaper;
}

/**
 * Generates a clean sub-bass transient punch (30Hz - 90Hz sweep) that gives
 * transitions tactile, cinematic weight in headphones and subwoofers.
 */
function addSubBassHit(
  offlineCtx: OfflineAudioContext,
  startFreq: number,
  endFreq: number,
  startTime: number,
  peakTime: number,
  duration: number,
  peakGain: number,
  dest: AudioNode
) {
  const osc = offlineCtx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(startFreq, startTime);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), startTime + duration);

  const gain = offlineCtx.createGain();
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.linearRampToValueAtTime(peakGain, startTime + peakTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  osc.connect(gain);
  gain.connect(dest);
  osc.start(startTime);
  osc.stop(startTime + duration);
}

/**
 * Synthesizes studio-grade procedural transition and interface sound effects
 * in true 2-channel stereo with multi-layered sub-bass, formant filtering,
 * decorrelated stereo noise, and soft-knee analog saturation.
 */
export function synthesizeProceduralSFX(category: string, duration: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    (async () => {
      const sampleRate = 44100;
      // High-definition 2-channel stereo context
      const offlineCtx = new OfflineAudioContext(2, Math.max(1, Math.floor(sampleRate * duration)), sampleRate);

      const saturator = createSoftSaturator(offlineCtx);
      saturator.connect(offlineCtx.destination);

      if (category === 'swoosh') {
        // ── Smooth Cinematic Whoosh ──────────────────────────────────────────
        // Layer 1: Sub-bass body sweep (55Hz -> 90Hz -> 38Hz)
        addSubBassHit(offlineCtx, 55, 38, 0, duration * 0.38, duration, 0.45, saturator);

        // Layer 2: Stereo pink noise swept through 2-stage resonant bandpass
        const noise = createStereoPinkNoise(offlineCtx, duration, sampleRate);
        const bp1 = offlineCtx.createBiquadFilter();
        bp1.type = 'bandpass';
        bp1.Q.setValueAtTime(2.8, 0);
        bp1.frequency.setValueAtTime(180, 0);
        bp1.frequency.exponentialRampToValueAtTime(2800, duration * 0.4);
        bp1.frequency.exponentialRampToValueAtTime(160, duration);

        const bp2 = offlineCtx.createBiquadFilter();
        bp2.type = 'bandpass';
        bp2.Q.setValueAtTime(1.8, 0);
        bp2.frequency.setValueAtTime(240, 0);
        bp2.frequency.exponentialRampToValueAtTime(3200, duration * 0.42);
        bp2.frequency.exponentialRampToValueAtTime(200, duration);

        const noiseGain = offlineCtx.createGain();
        noiseGain.gain.setValueAtTime(0.0001, 0);
        noiseGain.gain.linearRampToValueAtTime(0.85, duration * 0.38);
        noiseGain.gain.exponentialRampToValueAtTime(0.0001, duration);

        noise.connect(bp1);
        bp1.connect(bp2);
        bp2.connect(noiseGain);
        noiseGain.connect(saturator);
        noise.start(0);

      } else if (category === 'fast_whoosh') {
        // ── Snappy Whip-Pan Whoosh ───────────────────────────────────────────
        // Layer 1: Snappy sub thump (85Hz -> 42Hz)
        addSubBassHit(offlineCtx, 85, 42, 0, duration * 0.25, duration * 0.7, 0.4, saturator);

        // Layer 2: Fast stereo sweep
        const noise = createStereoPinkNoise(offlineCtx, duration, sampleRate);
        const bp = offlineCtx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.Q.setValueAtTime(4.2, 0);
        bp.frequency.setValueAtTime(320, 0);
        bp.frequency.exponentialRampToValueAtTime(4600, duration * 0.3);
        bp.frequency.exponentialRampToValueAtTime(220, duration);

        const airHigh = offlineCtx.createBiquadFilter();
        airHigh.type = 'highshelf';
        airHigh.frequency.setValueAtTime(4500, 0);
        airHigh.gain.setValueAtTime(4.0, 0);

        const gain = offlineCtx.createGain();
        gain.gain.setValueAtTime(0.0001, 0);
        gain.gain.linearRampToValueAtTime(0.9, duration * 0.28);
        gain.gain.exponentialRampToValueAtTime(0.0001, duration);

        noise.connect(bp);
        bp.connect(airHigh);
        airHigh.connect(gain);
        gain.connect(saturator);
        noise.start(0);

      } else if (category === 'deep_whoosh') {
        // ── Cinematic Low-End Braam Whoosh ───────────────────────────────────
        // Layer 1: Heavy sub sweep (42Hz -> 76Hz -> 30Hz)
        addSubBassHit(offlineCtx, 42, 30, 0, duration * 0.42, duration, 0.65, saturator);

        // Layer 2: Deep low-pass noise rumble
        const noise = createStereoPinkNoise(offlineCtx, duration, sampleRate);
        const lp = offlineCtx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.Q.setValueAtTime(3.2, 0);
        lp.frequency.setValueAtTime(80, 0);
        lp.frequency.exponentialRampToValueAtTime(700, duration * 0.42);
        lp.frequency.exponentialRampToValueAtTime(55, duration);

        const noiseGain = offlineCtx.createGain();
        noiseGain.gain.setValueAtTime(0.0001, 0);
        noiseGain.gain.linearRampToValueAtTime(0.65, duration * 0.4);
        noiseGain.gain.exponentialRampToValueAtTime(0.0001, duration);

        noise.connect(lp);
        lp.connect(noiseGain);
        noiseGain.connect(saturator);
        noise.start(0);

      } else if (category === 'impact') {
        // ── Cinematic Trailer Impact ─────────────────────────────────────────
        // Layer 1: Sub drop (120Hz -> 32Hz)
        addSubBassHit(offlineCtx, 120, 32, 0, 0.015, duration, 0.85, saturator);

        // Layer 2: Mid punch transient
        const punchOsc = offlineCtx.createOscillator();
        punchOsc.type = 'triangle';
        punchOsc.frequency.setValueAtTime(260, 0);
        punchOsc.frequency.exponentialRampToValueAtTime(60, 0.08);

        const punchGain = offlineCtx.createGain();
        punchGain.gain.setValueAtTime(0.6, 0);
        punchGain.gain.exponentialRampToValueAtTime(0.0001, 0.12);
        punchOsc.connect(punchGain);
        punchGain.connect(saturator);
        punchOsc.start(0);

        // Layer 3: Stereo acoustic room crack & rumble
        const noise = createStereoPinkNoise(offlineCtx, duration, sampleRate);
        const bp = offlineCtx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.Q.setValueAtTime(2.0, 0);
        bp.frequency.setValueAtTime(900, 0);
        bp.frequency.exponentialRampToValueAtTime(140, duration);

        const noiseGain = offlineCtx.createGain();
        noiseGain.gain.setValueAtTime(0.55, 0);
        noiseGain.gain.exponentialRampToValueAtTime(0.0001, duration * 0.6);

        noise.connect(bp);
        bp.connect(noiseGain);
        noiseGain.connect(saturator);
        noise.start(0);

      } else if (category === 'whip') {
        // ── Sharp Whip Snap ──────────────────────────────────────────────────
        // Layer 1: Low-end snap
        addSubBassHit(offlineCtx, 160, 48, 0, 0.01, duration * 0.4, 0.45, saturator);

        // Layer 2: High-velocity noise zip
        const noise = createStereoPinkNoise(offlineCtx, duration, sampleRate);
        const bp = offlineCtx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.Q.setValueAtTime(6.5, 0);
        bp.frequency.setValueAtTime(3600, 0);
        bp.frequency.exponentialRampToValueAtTime(180, duration);

        const gain = offlineCtx.createGain();
        gain.gain.setValueAtTime(0.85, 0);
        gain.gain.exponentialRampToValueAtTime(0.0001, duration);

        noise.connect(bp);
        bp.connect(gain);
        gain.connect(saturator);
        noise.start(0);

      } else if (category === 'riser') {
        // ── Tension Riser ───────────────────────────────────────────────────
        // Layer 1: Ascending dual oscillators (sawtooth + triangle)
        const sweepSaw = offlineCtx.createOscillator();
        sweepSaw.type = 'sawtooth';
        sweepSaw.frequency.setValueAtTime(70, 0);
        sweepSaw.frequency.exponentialRampToValueAtTime(780, duration * 0.92);

        const sweepTri = offlineCtx.createOscillator();
        sweepTri.type = 'triangle';
        sweepTri.frequency.setValueAtTime(70.5, 0);
        sweepTri.frequency.exponentialRampToValueAtTime(785, duration * 0.92);

        const sawFilter = offlineCtx.createBiquadFilter();
        sawFilter.type = 'lowpass';
        sawFilter.frequency.setValueAtTime(300, 0);
        sawFilter.frequency.exponentialRampToValueAtTime(1800, duration * 0.92);

        const oscGain = offlineCtx.createGain();
        oscGain.gain.setValueAtTime(0.0001, 0);
        oscGain.gain.exponentialRampToValueAtTime(0.35, duration * 0.92);
        oscGain.gain.setValueAtTime(0.0001, duration * 0.93);

        sweepSaw.connect(sawFilter);
        sweepTri.connect(sawFilter);
        sawFilter.connect(oscGain);
        oscGain.connect(saturator);
        sweepSaw.start(0);
        sweepTri.start(0);

        // Layer 2: Climbing noise riser with sharp cutoff at cut
        const noise = createStereoPinkNoise(offlineCtx, duration, sampleRate);
        const bp = offlineCtx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.Q.setValueAtTime(2.2, 0);
        bp.frequency.setValueAtTime(350, 0);
        bp.frequency.exponentialRampToValueAtTime(5400, duration * 0.92);

        const noiseGain = offlineCtx.createGain();
        noiseGain.gain.setValueAtTime(0.0001, 0);
        noiseGain.gain.exponentialRampToValueAtTime(0.65, duration * 0.92);
        noiseGain.gain.setValueAtTime(0.0001, duration * 0.93);

        noise.connect(bp);
        bp.connect(noiseGain);
        noiseGain.connect(saturator);
        noise.start(0);

      } else if (category === 'glitch') {
        // ── Cyber / Digital Glitch ──────────────────────────────────────────
        const burstCount = Math.max(6, Math.floor(duration * 20));
        for (let i = 0; i < burstCount; i++) {
          const bTime = (duration / burstCount) * i;
          const bDur = (duration / burstCount) * 0.75;
          const osc = offlineCtx.createOscillator();
          osc.type = i % 3 === 0 ? 'square' : i % 3 === 1 ? 'sawtooth' : 'sine';
          const f = 250 + ((i * 383) % 2400);
          osc.frequency.setValueAtTime(f, bTime);

          const gain = offlineCtx.createGain();
          gain.gain.setValueAtTime(0.28, bTime);
          gain.gain.exponentialRampToValueAtTime(0.0001, bTime + bDur);

          osc.connect(gain);
          gain.connect(saturator);
          osc.start(bTime);
          osc.stop(bTime + bDur);
        }

      } else if (category === 'flash') {
        // ── Luminous Sparkle Flash ──────────────────────────────────────────
        // Bright bell chord
        const freqs = [1046, 1318, 1568, 2093];
        freqs.forEach((f, idx) => {
          const osc = offlineCtx.createOscillator();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(f, 0);
          osc.frequency.exponentialRampToValueAtTime(f * 1.5, duration * 0.4);

          const g = offlineCtx.createGain();
          g.gain.setValueAtTime(0.0001, 0);
          g.gain.linearRampToValueAtTime(0.18 / (idx + 1), 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, duration * 0.8);

          osc.connect(g);
          g.connect(saturator);
          osc.start(0);
          osc.stop(duration);
        });

        // Air flare
        const noise = createStereoPinkNoise(offlineCtx, duration, sampleRate);
        const hp = offlineCtx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.setValueAtTime(4500, 0);
        const ng = offlineCtx.createGain();
        ng.gain.setValueAtTime(0.0001, 0);
        ng.gain.linearRampToValueAtTime(0.35, 0.03);
        ng.gain.exponentialRampToValueAtTime(0.0001, duration);

        noise.connect(hp);
        hp.connect(ng);
        ng.connect(saturator);
        noise.start(0);

      } else if (category === 'shutter') {
        // ── Authentic Mechanical DSLR Shutter ────────────────────────────────
        // Dual curtain click-clack with mechanical resonance
        const clicks = [0, 0.042];
        clicks.forEach((cTime, idx) => {
          const osc = offlineCtx.createOscillator();
          osc.type = 'sine';
          const f0 = idx === 0 ? 3200 : 2600;
          osc.frequency.setValueAtTime(f0, cTime);
          osc.frequency.exponentialRampToValueAtTime(180, cTime + 0.025);

          const g = offlineCtx.createGain();
          g.gain.setValueAtTime(0.65, cTime);
          g.gain.exponentialRampToValueAtTime(0.0001, cTime + 0.035);

          osc.connect(g);
          g.connect(saturator);
          osc.start(cTime);
          osc.stop(cTime + 0.04);
        });

        // Mechanical body thud
        addSubBassHit(offlineCtx, 140, 50, 0.03, 0.008, 0.06, 0.35, saturator);

      } else if (category === 'shimmer') {
        // ── Magical Harmonic Shimmer ─────────────────────────────────────────
        const partials = [880, 1174, 1320, 1760, 2640];
        partials.forEach((f0, pi) => {
          const osc = offlineCtx.createOscillator();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(f0, 0);
          osc.frequency.exponentialRampToValueAtTime(f0 * 1.6, duration);

          const og = offlineCtx.createGain();
          const amp = 0.2 / (pi + 1);
          og.gain.setValueAtTime(0.0001, 0);
          og.gain.linearRampToValueAtTime(amp, duration * (0.15 + pi * 0.08));
          og.gain.exponentialRampToValueAtTime(0.0001, duration);

          osc.connect(og);
          og.connect(saturator);
          osc.start(0);
          osc.stop(duration);
        });

        const noise = createStereoPinkNoise(offlineCtx, duration, sampleRate);
        const hp = offlineCtx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.setValueAtTime(6500, 0);
        hp.frequency.exponentialRampToValueAtTime(9500, duration);
        const ng = offlineCtx.createGain();
        ng.gain.setValueAtTime(0.0001, 0);
        ng.gain.linearRampToValueAtTime(0.18, duration * 0.4);
        ng.gain.exponentialRampToValueAtTime(0.0001, duration);
        noise.connect(hp);
        hp.connect(ng);
        ng.connect(saturator);
        noise.start(0);

      } else if (category === 'suck_reverse') {
        // ── Cinematic Reverse Vacuum Suck ────────────────────────────────────
        // Sub suction rising into the cut
        const subOsc = offlineCtx.createOscillator();
        subOsc.type = 'sine';
        subOsc.frequency.setValueAtTime(32, 0);
        subOsc.frequency.exponentialRampToValueAtTime(95, duration * 0.94);

        const subGain = offlineCtx.createGain();
        subGain.gain.setValueAtTime(0.0001, 0);
        subGain.gain.exponentialRampToValueAtTime(0.55, duration * 0.94);
        subGain.gain.setValueAtTime(0.0001, duration * 0.95);

        subOsc.connect(subGain);
        subGain.connect(saturator);
        subOsc.start(0);

        // Reverse air swell opening into the cut
        const noise = createStereoPinkNoise(offlineCtx, duration, sampleRate);
        const hp = offlineCtx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.setValueAtTime(5500, 0);
        hp.frequency.exponentialRampToValueAtTime(700, duration * 0.94);

        const noiseGain = offlineCtx.createGain();
        noiseGain.gain.setValueAtTime(0.0001, 0);
        noiseGain.gain.exponentialRampToValueAtTime(0.75, duration * 0.94);
        noiseGain.gain.setValueAtTime(0.0001, duration * 0.95);

        noise.connect(hp);
        hp.connect(noiseGain);
        noiseGain.connect(saturator);
        noise.start(0);

      } else if (category === 'camera_servo') {
        // ── Precision Cine-Servo Motor ───────────────────────────────────────
        const noise = createStereoPinkNoise(offlineCtx, duration, sampleRate);
        const bp = offlineCtx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.Q.setValueAtTime(8, 0);
        bp.frequency.setValueAtTime(1700, 0);
        bp.frequency.linearRampToValueAtTime(2400, duration * 0.5);
        bp.frequency.linearRampToValueAtTime(1300, duration);

        const gain = offlineCtx.createGain();
        gain.gain.setValueAtTime(0.0001, 0);
        gain.gain.exponentialRampToValueAtTime(0.25, 0.03);
        gain.gain.setValueAtTime(0.18, duration * 0.85);
        gain.gain.exponentialRampToValueAtTime(0.0001, duration);

        // Mechanical start/stop detents
        [0, Math.max(0.04, duration - 0.04)].forEach((t) => {
          const tick = offlineCtx.createOscillator();
          tick.type = 'square';
          tick.frequency.setValueAtTime(2200, t);
          const tg = offlineCtx.createGain();
          tg.gain.setValueAtTime(0.15, t);
          tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.025);
          tick.connect(tg);
          tg.connect(saturator);
          tick.start(t);
          tick.stop(t + 0.03);
        });

        noise.connect(bp);
        bp.connect(gain);
        gain.connect(saturator);
        noise.start(0);

      } else if (category === 'paper_sweep') {
        // ── Tactile Paper Fold / Turn ────────────────────────────────────────
        const noise = createStereoPinkNoise(offlineCtx, duration, sampleRate);
        const bp = offlineCtx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.Q.setValueAtTime(1.4, 0);
        bp.frequency.setValueAtTime(650, 0);
        bp.frequency.linearRampToValueAtTime(1700, duration * 0.8);

        const gain = offlineCtx.createGain();
        gain.gain.setValueAtTime(0.0001, 0);
        gain.gain.linearRampToValueAtTime(0.42, duration * 0.25);
        gain.gain.setValueAtTime(0.35, duration * 0.8);
        gain.gain.exponentialRampToValueAtTime(0.0001, duration);

        noise.connect(bp);
        bp.connect(gain);
        gain.connect(saturator);
        noise.start(0);

        // Soft landing tap
        addSubBassHit(offlineCtx, 120, 50, duration * 0.82, 0.015, duration * 0.18, 0.35, saturator);

      } else if (category === 'shatter_hit') {
        // ── Shatter / Glass Particle Burst ───────────────────────────────────
        const packets = Math.max(4, Math.round(duration * 16));
        for (let k = 0; k < packets; k++) {
          const t0 = (k / packets) * duration;
          const pOsc = offlineCtx.createOscillator();
          pOsc.type = 'sine';
          pOsc.frequency.setValueAtTime(1400 + (k * 787) % 3600, t0);

          const pg = offlineCtx.createGain();
          const env = Math.sin(Math.PI * (k / packets));
          pg.gain.setValueAtTime(0.0001, t0);
          pg.gain.linearRampToValueAtTime(0.12 + 0.25 * env, t0 + 0.008);
          pg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.03);

          pOsc.connect(pg);
          pg.connect(saturator);
          pOsc.start(t0);
          pOsc.stop(t0 + 0.035);
        }

        // Sub blast
        addSubBassHit(offlineCtx, 150, 42, duration * 0.35, 0.02, duration * 0.5, 0.65, saturator);

      } else if (category === 'pop') {
        const osc = offlineCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, 0);
        osc.frequency.exponentialRampToValueAtTime(90, Math.min(0.06, duration));

        const gain = offlineCtx.createGain();
        gain.gain.setValueAtTime(0.75, 0);
        gain.gain.exponentialRampToValueAtTime(0.0001, Math.min(0.08, duration));

        osc.connect(gain);
        gain.connect(saturator);
        osc.start(0);

      } else {
        // Fallback smooth stereo whoosh
        addSubBassHit(offlineCtx, 60, 40, 0, duration * 0.35, duration, 0.4, saturator);
        const noise = createStereoPinkNoise(offlineCtx, duration, sampleRate);
        const bp = offlineCtx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(1200, 0);
        bp.Q.setValueAtTime(1.2, 0);

        const gain = offlineCtx.createGain();
        gain.gain.setValueAtTime(0.0001, 0);
        gain.gain.linearRampToValueAtTime(0.6, duration * 0.3);
        gain.gain.exponentialRampToValueAtTime(0.0001, duration);

        noise.connect(bp);
        bp.connect(gain);
        gain.connect(saturator);
        noise.start(0);
      }

      const renderedBuffer = await offlineCtx.startRendering();
      const wavBlob = audioBufferToWav(renderedBuffer);
      resolve(wavBlob);
    })().catch(reject);
  });
}

// ── Preview & Playback Engine ─────────────────────────────────────────────────

// In-memory buffer cache: guarantees 0ms latency on repeated transition previews
const previewAudioBufferCache = new Map<string, AudioBuffer>();
let sharedPreviewAudioCtx: AudioContext | null = null;

function getSharedPreviewContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!sharedPreviewAudioCtx || sharedPreviewAudioCtx.state === 'closed') {
    sharedPreviewAudioCtx = new AudioContextClass();
  }
  if (sharedPreviewAudioCtx && sharedPreviewAudioCtx.state === 'suspended') {
    sharedPreviewAudioCtx.resume().catch(() => {});
  }
  return sharedPreviewAudioCtx;
}

/**
 * Play a transition sound preview directly through Web Audio with 0ms latency.
 * Supports procedural SFX categories as well as custom media URLs.
 */
export async function playTransitionSoundPreview(
  soundId: string,
  volume: number = 0.8,
  customAudioUrl?: string
): Promise<void> {
  if (!soundId || soundId === 'none') return;

  if (customAudioUrl || soundId.startsWith('media:')) {
    const url = customAudioUrl || soundId.replace(/^media:/, '');
    const audio = new Audio(url);
    audio.volume = Math.max(0, Math.min(1, volume));
    await audio.play().catch(() => {});
    return;
  }

  const ctx = getSharedPreviewContext();
  if (!ctx) return;

  const cacheKey = `${soundId}_v1`;
  let audioBuffer = previewAudioBufferCache.get(cacheKey);

  if (!audioBuffer) {
    const duration = 0.55;
    const blob = await synthesizeProceduralSFX(soundId, duration);
    const arrayBuffer = await blob.arrayBuffer();
    audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    previewAudioBufferCache.set(cacheKey, audioBuffer);
  }

  const source = ctx.createBufferSource();
  source.buffer = audioBuffer;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(Math.max(0, Math.min(1, volume)), ctx.currentTime);

  source.connect(gain);
  gain.connect(ctx.destination);

  source.start(0);
}

/**
 * Synthesizes a transition sound as a WAV Blob (e.g. for creating timeline audio clips).
 */
export async function synthesizeTransitionSoundWav(
  soundId: string,
  duration: number = 0.5
): Promise<Blob> {
  return synthesizeProceduralSFX(soundId, duration);
}
