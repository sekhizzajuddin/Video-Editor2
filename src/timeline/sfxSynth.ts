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

export function synthesizeProceduralSFX(category: string, duration: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    (async () => {
      const sampleRate = 44100;
      const offlineCtx = new OfflineAudioContext(1, sampleRate * duration, sampleRate);

      if (category === 'explosion') {
        const bufferSize = sampleRate * duration;
        const noiseBuffer = offlineCtx.createBuffer(1, bufferSize, sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          output[i] = Math.random() * 2 - 1;
        }
        const noiseSource = offlineCtx.createBufferSource();
        noiseSource.buffer = noiseBuffer;

        const filter = offlineCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, 0);
        filter.frequency.exponentialRampToValueAtTime(10, duration);

        const gain = offlineCtx.createGain();
        gain.gain.setValueAtTime(1.0, 0);
        gain.gain.exponentialRampToValueAtTime(0.01, duration);

        noiseSource.connect(filter);
        filter.connect(gain);
        gain.connect(offlineCtx.destination);
        noiseSource.start(0);
      } else if (category === 'laser') {
        const osc = offlineCtx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(1800, 0);
        osc.frequency.exponentialRampToValueAtTime(80, duration);

        const gain = offlineCtx.createGain();
        gain.gain.setValueAtTime(0.8, 0);
        gain.gain.exponentialRampToValueAtTime(0.01, duration);

        osc.connect(gain);
        gain.connect(offlineCtx.destination);
        osc.start(0);
      } else if (category === 'swoosh') {
        const bufferSize = sampleRate * duration;
        const noiseBuffer = offlineCtx.createBuffer(1, bufferSize, sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          output[i] = Math.random() * 2 - 1;
        }
        const noiseSource = offlineCtx.createBufferSource();
        noiseSource.buffer = noiseBuffer;

        const filter = offlineCtx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.Q.setValueAtTime(5, 0);
        filter.frequency.setValueAtTime(100, 0);
        filter.frequency.exponentialRampToValueAtTime(1200, duration * 0.4);
        filter.frequency.exponentialRampToValueAtTime(100, duration);

        const gain = offlineCtx.createGain();
        gain.gain.setValueAtTime(0.01, 0);
        gain.gain.linearRampToValueAtTime(0.8, duration * 0.4);
        gain.gain.exponentialRampToValueAtTime(0.01, duration);

        noiseSource.connect(filter);
        filter.connect(gain);
        gain.connect(offlineCtx.destination);
        noiseSource.start(0);
      } else if (category === 'jump') {
        const osc = offlineCtx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(150, 0);
        osc.frequency.exponentialRampToValueAtTime(800, duration);

        const gain = offlineCtx.createGain();
        gain.gain.setValueAtTime(0.6, 0);
        gain.gain.exponentialRampToValueAtTime(0.01, duration);

        osc.connect(gain);
        gain.connect(offlineCtx.destination);
        osc.start(0);
      } else if (category === 'bubble') {
        const osc = offlineCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(100, 0);
        osc.frequency.exponentialRampToValueAtTime(1200, duration * 0.7);
        osc.frequency.exponentialRampToValueAtTime(80, duration);

        const gain = offlineCtx.createGain();
        gain.gain.setValueAtTime(0.01, 0);
        gain.gain.linearRampToValueAtTime(0.7, duration * 0.2);
        gain.gain.exponentialRampToValueAtTime(0.01, duration);

        osc.connect(gain);
        gain.connect(offlineCtx.destination);
        osc.start(0);
      } else if (category === 'alarm') {
        const osc = offlineCtx.createOscillator();
        osc.type = 'square';
        const pulseCount = Math.max(1, Math.floor(duration * 4));
        for (let i = 0; i < pulseCount; i++) {
          const time = (duration / pulseCount) * i;
          osc.frequency.setValueAtTime(900, time);
          osc.frequency.setValueAtTime(700, time + (duration / pulseCount) * 0.5);
        }

        const gain = offlineCtx.createGain();
        gain.gain.setValueAtTime(0.5, 0);
        for (let i = 0; i < pulseCount; i++) {
          const time = (duration / pulseCount) * i;
          const interval = duration / pulseCount;
          gain.gain.setValueAtTime(0.5, time);
          gain.gain.setValueAtTime(0.5, time + interval * 0.7);
          gain.gain.linearRampToValueAtTime(0.01, time + interval * 0.95);
        }

        osc.connect(gain);
        gain.connect(offlineCtx.destination);
        osc.start(0);
      } else if (category === 'click') {
        const osc = offlineCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(3000, 0);
        osc.frequency.exponentialRampToValueAtTime(400, duration);

        const gain = offlineCtx.createGain();
        gain.gain.setValueAtTime(0.8, 0);
        gain.gain.exponentialRampToValueAtTime(0.001, duration);

        osc.connect(gain);
        gain.connect(offlineCtx.destination);
        osc.start(0);
      } else if (category === 'ambient') {
        const bufferSize = sampleRate * duration;
        const noiseBuffer = offlineCtx.createBuffer(1, bufferSize, sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          output[i] = Math.random() * 2 - 1;
        }
        const noiseSource = offlineCtx.createBufferSource();
        noiseSource.buffer = noiseBuffer;

        const filter = offlineCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.Q.setValueAtTime(1, 0);
        filter.frequency.setValueAtTime(300, 0);

        const modCount = 10;
        for (let i = 0; i < modCount; i++) {
          const time = (duration / modCount) * i;
          const targetFreq = 150 + Math.random() * 250;
          filter.frequency.linearRampToValueAtTime(targetFreq, time + (duration / modCount) * 0.5);
        }

        const gain = offlineCtx.createGain();
        gain.gain.setValueAtTime(0.3, 0);

        noiseSource.connect(filter);
        filter.connect(gain);
        gain.connect(offlineCtx.destination);
        noiseSource.start(0);
      } else if (category === 'waves') {
        const bufferSize = sampleRate * duration;
        const noiseBuffer = offlineCtx.createBuffer(1, bufferSize, sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          output[i] = Math.random() * 2 - 1;
        }
        const noiseSource = offlineCtx.createBufferSource();
        noiseSource.buffer = noiseBuffer;

        const filter = offlineCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.Q.setValueAtTime(1, 0);

        const wavePeriod = 4.0;
        for (let time = 0; time < duration; time += 0.05) {
          const cycle = (time / wavePeriod) * 2 * Math.PI;
          const mod = Math.sin(cycle);
          const targetFreq = 200 + (mod + 1) * 300;
          filter.frequency.linearRampToValueAtTime(targetFreq, time);
        }

        const gain = offlineCtx.createGain();
        gain.gain.setValueAtTime(0.05, 0);
        for (let time = 0; time < duration; time += 0.05) {
          const cycle = (time / wavePeriod) * 2 * Math.PI;
          const mod = Math.sin(cycle);
          const targetGain = 0.05 + (mod + 1) * 0.25;
          gain.gain.linearRampToValueAtTime(targetGain, time);
        }
        gain.gain.setValueAtTime(gain.gain.value, duration - 0.2);
        gain.gain.exponentialRampToValueAtTime(0.001, duration);

        noiseSource.connect(filter);
        filter.connect(gain);
        gain.connect(offlineCtx.destination);
        noiseSource.start(0);
      } else if (category === 'flying') {
        const osc1 = offlineCtx.createOscillator();
        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(80, 0);

        const osc2 = offlineCtx.createOscillator();
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(120, 0);

        const bufferSize = sampleRate * duration;
        const noiseBuffer = offlineCtx.createBuffer(1, bufferSize, sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          output[i] = Math.random() * 2 - 1;
        }
        const noiseSource = offlineCtx.createBufferSource();
        noiseSource.buffer = noiseBuffer;

        const filter = offlineCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(150, 0);

        const noiseGain = offlineCtx.createGain();
        noiseGain.gain.setValueAtTime(0.1, 0);

        const lfo = offlineCtx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.setValueAtTime(6, 0);

        const lfoGain = offlineCtx.createGain();
        lfoGain.gain.setValueAtTime(5, 0);

        lfo.connect(lfoGain);
        lfoGain.connect(osc1.frequency);
        lfoGain.connect(osc2.frequency);

        const gain = offlineCtx.createGain();
        gain.gain.setValueAtTime(0.4, 0);
        gain.gain.setValueAtTime(0.4, duration - 0.1);
        gain.gain.linearRampToValueAtTime(0.001, duration);

        osc1.connect(gain);
        osc2.connect(gain);

        noiseSource.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(offlineCtx.destination);

        gain.connect(offlineCtx.destination);

        osc1.start(0);
        osc2.start(0);
        lfo.start(0);
        noiseSource.start(0);
      } else if (category === 'magic') {
        const chimeCount = Math.max(3, Math.floor(duration * 6));
        for (let i = 0; i < chimeCount; i++) {
          const noteTime = (duration / chimeCount) * i;
          const osc = offlineCtx.createOscillator();
          osc.type = 'sine';

          const baseFreq = 800 + i * 150;
          osc.frequency.setValueAtTime(baseFreq, noteTime);
          osc.frequency.linearRampToValueAtTime(baseFreq * 1.5, noteTime + 0.15);

          const gain = offlineCtx.createGain();
          gain.gain.setValueAtTime(0.001, noteTime);
          gain.gain.linearRampToValueAtTime(0.2, noteTime + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.25);

          osc.connect(gain);
          gain.connect(offlineCtx.destination);
          osc.start(noteTime);
          osc.stop(noteTime + 0.26);
        }
      } else if (category === 'punch') {
        const osc = offlineCtx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(220, 0);
        osc.frequency.exponentialRampToValueAtTime(40, 0.08);

        const popOsc = offlineCtx.createOscillator();
        popOsc.type = 'sine';
        popOsc.frequency.setValueAtTime(800, 0);
        popOsc.frequency.exponentialRampToValueAtTime(100, 0.02);

        const thudGain = offlineCtx.createGain();
        thudGain.gain.setValueAtTime(0.8, 0);
        thudGain.gain.exponentialRampToValueAtTime(0.01, 0.15);

        const popGain = offlineCtx.createGain();
        popGain.gain.setValueAtTime(0.5, 0);
        popGain.gain.exponentialRampToValueAtTime(0.001, 0.03);

        osc.connect(thudGain);
        thudGain.connect(offlineCtx.destination);
        popOsc.connect(popGain);
        popGain.connect(offlineCtx.destination);

        osc.start(0);
        popOsc.start(0);
      } else if (category === 'footsteps') {
        const stepCount = Math.max(1, Math.floor(duration * 2.5));
        for (let i = 0; i < stepCount; i++) {
          const stepTime = (duration / stepCount) * i;
          const osc = offlineCtx.createOscillator();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(100, stepTime);
          osc.frequency.exponentialRampToValueAtTime(40, stepTime + 0.06);

          const filter = offlineCtx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(200, stepTime);

          const gain = offlineCtx.createGain();
          gain.gain.setValueAtTime(0.001, stepTime);
          gain.gain.linearRampToValueAtTime(0.6, stepTime + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.001, stepTime + 0.08);

          osc.connect(filter);
          filter.connect(gain);
          gain.connect(offlineCtx.destination);

          osc.start(stepTime);
          osc.stop(stepTime + 0.09);
        }
      } else if (category === 'gunshot') {
        const bufferSize = sampleRate * 0.1;
        const noiseBuffer = offlineCtx.createBuffer(1, bufferSize, sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          output[i] = Math.random() * 2 - 1;
        }
        const noiseSource = offlineCtx.createBufferSource();
        noiseSource.buffer = noiseBuffer;

        const noiseFilter = offlineCtx.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.setValueAtTime(1000, 0);

        const noiseGain = offlineCtx.createGain();
        noiseGain.gain.setValueAtTime(0.5, 0);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, 0.08);

        noiseSource.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(offlineCtx.destination);
        noiseSource.start(0);

        const osc = offlineCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(180, 0);
        osc.frequency.exponentialRampToValueAtTime(50, 0.15);

        const gain = offlineCtx.createGain();
        gain.gain.setValueAtTime(1.0, 0);
        gain.gain.exponentialRampToValueAtTime(0.001, duration);

        osc.connect(gain);
        gain.connect(offlineCtx.destination);
        osc.start(0);
      } else if (category === 'spark') {
        const crackleCount = Math.max(10, Math.floor(duration * 40));
        for (let i = 0; i < crackleCount; i++) {
          const crackleTime = Math.random() * duration;
          const osc = offlineCtx.createOscillator();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(5000 + Math.random() * 4000, crackleTime);

          const gain = offlineCtx.createGain();
          gain.gain.setValueAtTime(0.001, crackleTime);
          gain.gain.linearRampToValueAtTime(0.3, crackleTime + 0.002);
          gain.gain.exponentialRampToValueAtTime(0.001, crackleTime + 0.015);

          osc.connect(gain);
          gain.connect(offlineCtx.destination);
          osc.start(crackleTime);
          osc.stop(crackleTime + 0.02);
        }
      }

      const renderedBuffer = await offlineCtx.startRendering();
      const wavBlob = audioBufferToWav(renderedBuffer);
      resolve(wavBlob);
    })().catch(reject);
  });
}
