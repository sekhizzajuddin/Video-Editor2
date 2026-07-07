import React from 'react';
import {
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Trash2,
  Tag,
  Type,
  Bookmark,
  ZoomIn,
  ZoomOut,
  Scissors,
  Music,
  Film,
  GripVertical,
  Image,
  X,
  Sparkles,
  Plus,
  ArrowLeftRight,
  Link,
  Unlink2,
  Edit,
  Layers,
  Pin,
  Mic,
  Zap,
  Loader2,
  Magnet,
  Volume2,
  VolumeX,
  ArrowUpToLine,
  ArrowDownToLine,
  ArrowUp,
  ArrowDown,
  Copy,
  Palette,
  Box,
} from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { TimelineClip, TimelineTrack, MediaItem, EditorState, OverLayerClip } from '@/types';
import { formatSimpleTime } from '@/utils/time';
import { TITLE_TEMPLATES } from '@/utils/titleTemplates';
import { toast } from 'sonner';

// ─── Web Audio SFX Helper Functions ───────────────────────────────────────────

function audioBufferToWav(buffer: AudioBuffer): Blob {
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

function synthesizeProceduralSFX(category: string, duration: number): Promise<Blob> {
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
      popGain.gain.setValueAtTime(0.6, 0);
      popGain.gain.exponentialRampToValueAtTime(0.01, 0.03);

      const noiseBuffer = offlineCtx.createBuffer(1, sampleRate * 0.1, sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < noiseBuffer.length; i++) {
        output[i] = Math.random() * 2 - 1;
      }
      const noiseSource = offlineCtx.createBufferSource();
      noiseSource.buffer = noiseBuffer;

      const filter = offlineCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(120, 0);

      const noiseGain = offlineCtx.createGain();
      noiseGain.gain.setValueAtTime(0.6, 0);
      noiseGain.gain.exponentialRampToValueAtTime(0.01, 0.12);

      osc.connect(thudGain);
      thudGain.connect(offlineCtx.destination);

      popOsc.connect(popGain);
      popGain.connect(offlineCtx.destination);

      noiseSource.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(offlineCtx.destination);

      osc.start(0);
      popOsc.start(0);
      noiseSource.start(0);
    } else if (category === 'footsteps') {
      const stepCount = Math.max(1, Math.floor(duration * 2));
      for (let i = 0; i < stepCount; i++) {
        const stepTime = (duration / stepCount) * i;

        const noiseBuffer = offlineCtx.createBuffer(1, sampleRate * 0.15, sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let j = 0; j < noiseBuffer.length; j++) {
          output[j] = Math.random() * 2 - 1;
        }
        const noiseSource = offlineCtx.createBufferSource();
        noiseSource.buffer = noiseBuffer;

        const filter = offlineCtx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(300, stepTime);
        filter.Q.setValueAtTime(3, stepTime);

        const gain = offlineCtx.createGain();
        gain.gain.setValueAtTime(0.001, stepTime);
        gain.gain.linearRampToValueAtTime(0.4, stepTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, stepTime + 0.12);

        noiseSource.connect(filter);
        filter.connect(gain);
        gain.connect(offlineCtx.destination);

        noiseSource.start(stepTime);
      }
    } else if (category === 'gunshot') {
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
      filter.frequency.setValueAtTime(2000, 0);
      filter.frequency.exponentialRampToValueAtTime(100, 0.1);

      const gain = offlineCtx.createGain();
      gain.gain.setValueAtTime(1.0, 0);
      gain.gain.exponentialRampToValueAtTime(0.001, duration * 0.8);

      noiseSource.connect(filter);
      filter.connect(gain);
      gain.connect(offlineCtx.destination);
      noiseSource.start(0);
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

async function handlePuterError(err: any, taskName: string): Promise<void> {
  console.error(`${taskName} failed:`, err);
  const isCreditsErr = String(err.message || err).toLowerCase().includes('credit') ||
                       String(err.message || err).toLowerCase().includes('balance');
  if (isCreditsErr) {
    const puter = (window as any).puter;
    if (puter) {
      const confirmSignIn = window.confirm(
        `${taskName} failed due to Insufficient Credits on Puter.\n\n` +
        "Puter AI offers a generous free tier for registered accounts. Would you like to log in to (or sign up for) Puter for free to get your personal free credits?"
      );
      if (confirmSignIn) {
        try {
          await puter.auth.signIn();
          alert("Successfully logged in! Please try your request again.");
        } catch (authErr) {
          console.error('Puter auth failed:', authErr);
        }
      }
    } else {
      alert(`${taskName} failed: ${err.message || 'Unknown error'}`);
    }
  } else {
    alert(`${taskName} failed: ${err.message || 'Unknown error'}`);
  }
}

function parseTransliteratedResponse(responseText: string): any[] | null {
  if (!responseText || typeof responseText !== 'string') return null;

  // Step 1: Strip markdown code fences (```json ... ``` or ``` ... ```)
  let cleaned = responseText
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  // Step 2: Try parsing the entire cleaned text as JSON
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed;
  } catch (_) {}

  // Step 3: Find JSON array using greedy bracket matching from first '[' 
  const startIdx = cleaned.indexOf('[');
  if (startIdx !== -1) {
    let depth = 0;
    let endIdx = -1;
    for (let i = startIdx; i < cleaned.length; i++) {
      if (cleaned[i] === '[') depth++;
      else if (cleaned[i] === ']') {
        depth--;
        if (depth === 0) { endIdx = i; break; }
      }
    }
    if (endIdx !== -1) {
      try {
        const extracted = cleaned.slice(startIdx, endIdx + 1);
        const parsed = JSON.parse(extracted);
        if (Array.isArray(parsed)) return parsed;
      } catch (_) {}
    }
  }

  return null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_TRACK_HEIGHT = 56;
const THIN_TRACK_HEIGHT = 32;
const OVER_LAYER_ROW_HEIGHT = 36;

export const getTrackHeight = (
  track: TimelineTrack,
  hoveredRegion: EditorState['hoveredOverLayerRegion'] | null,
  pinnedTrackId: string | null = null
) => {
  const base = track.type === 'text' || track.type === 'fx' ? THIN_TRACK_HEIGHT : DEFAULT_TRACK_HEIGHT;
  const isOpen = pinnedTrackId === track.id || (hoveredRegion && hoveredRegion.trackId === track.id);
  if (!isOpen) return base;

  // Find active over-layers overlapping the hovered region
  const region = hoveredRegion || { trackId: track.id, startTime: 0, endTime: Infinity };
  const activeCount = (track.overLayers || []).filter((ol) => {
    return ol.startTime < region.endTime && ol.startTime + ol.duration > region.startTime;
  }).length;

  return base + activeCount * OVER_LAYER_ROW_HEIGHT;
};

export const getTrackTop = (
  tracks: TimelineTrack[],
  index: number,
  hoveredRegion: EditorState['hoveredOverLayerRegion'] | null,
  pinnedTrackId: string | null = null
) => {
  let top = 0;
  for (let i = 0; i < index; i++) top += getTrackHeight(tracks[i], hoveredRegion, pinnedTrackId);
  return top;
};

export const getTrackAtY = (
  tracks: TimelineTrack[],
  y: number,
  hoveredRegion: EditorState['hoveredOverLayerRegion'] | null,
  pinnedTrackId: string | null = null
) => {
  let currentY = 0;
  for (let i = 0; i < tracks.length; i++) {
    const h = getTrackHeight(tracks[i], hoveredRegion, pinnedTrackId);
    if (y >= currentY && y < currentY + h) return i;
    currentY += h;
  }
  return tracks.length - 1;
};
const MIN_CLIP_WIDTH = 16;
const SNAP_THRESHOLD_PX = 8;
const TRACK_HEADER_WIDTH = 128;
const RULER_HEIGHT = 28;
const FPS = 30;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCentisecondTime(time: number): string {
  if (isNaN(time) || time < 0) time = 0;
  const totalCentis = Math.round(time * 100);
  const mins = Math.floor(totalCentis / 6000);
  const secs = Math.floor((totalCentis % 6000) / 100);
  const centis = totalCentis % 100;

  const secsStr = mins > 0 ? secs.toString().padStart(2, '0') : secs.toString();
  const centisStr = centis.toString().padStart(2, '0');

  if (mins > 0) {
    return `${mins}:${secsStr}:${centisStr}`;
  }
  return `${secsStr}:${centisStr}`;
}

function formatDetailedTooltipTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) seconds = 0;
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);

  const secsStr = mins > 0 ? secs.toString().padStart(2, '0') : secs.toString();
  const msStr = ms.toString().padStart(3, '0');

  if (mins > 0) {
    return `${mins}:${secsStr}.${msStr}`;
  }
  return `${secsStr}.${msStr}s`;
}


function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

/** Seeded PRNG for deterministic procedural content keyed by string. */
function seededRandom(seed: string): () => number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash = hash & hash;
  }
  return () => {
    hash = (hash * 16807 + 0) % 2147483647;
    return (hash % 10001) / 10001;
  };
}

/** Fallback waveform when no real peaks are available. */
function generateFallbackWaveform(clipId: string, barCount: number): number[] {
  const peaks: number[] = [];
  const rng = seededRandom(clipId);
  for (let i = 0; i < barCount; i++) {
    peaks.push(0.2 + rng() * 0.8);
  }
  return peaks;
}

/** Check overlap on a track, optionally excluding one clip. */
function checkOverlapAt(
  track: TimelineTrack,
  startTime: number,
  duration: number,
  excludeClipId: string,
): boolean {
  const endTime = startTime + duration;
  return track.clips.some((clip) => {
    if (clip.id === excludeClipId) return false;
    const clipEnd = clip.startTime + clip.duration;
    return startTime < clipEnd && endTime > clip.startTime;
  });
}

/** Clip‑type colour palette. */
const CLIP_COLORS: Record<string, { bg: string; border: string; text: string; hover: string }> = {
  video: { bg: 'bg-blue-600/70', border: 'border-blue-500/50', text: 'text-blue-100', hover: 'hover:border-blue-400' },
  audio: { bg: 'bg-emerald-600/70', border: 'border-emerald-500/50', text: 'text-emerald-100', hover: 'hover:border-emerald-400' },
  image: { bg: 'bg-amber-600/70', border: 'border-amber-500/50', text: 'text-amber-100', hover: 'hover:border-amber-400' },
  text:  { bg: 'bg-purple-600/70', border: 'border-purple-500/50', text: 'text-purple-100', hover: 'hover:border-purple-400' },
  fx:    { bg: 'bg-rose-600/70',   border: 'border-rose-500/50',   text: 'text-rose-100',   hover: 'hover:border-rose-400' },
};

// ─── Sub‑components ──────────────────────────────────────────────────────────

/**
 * Renders real frame‑strip thumbnails stretched across the clip width.
 * Falls back to coloured procedural blocks when no frameStrip is available.
 */
function FrameStripOverlay({
  media,
  clipId,
  width,
  height,
}: {
  media: MediaItem | null;
  clipId: string;
  width: number;
  height: number;
}) {
  const frameStrip = media?.frameStrip;

  if (frameStrip && frameStrip.length > 0) {
    // Real frame thumbnails – stretch evenly across clip
    const frameWidth = width / frameStrip.length;
    return (
      <div className="absolute inset-0 flex overflow-hidden pointer-events-none">
        {frameStrip.map((src, i) => (
          <img
            key={i}
            src={src}
            alt=""
            draggable={false}
            className="h-full object-cover shrink-0 border-r border-white/5"
            style={{ width: `${frameWidth}px` }}
          />
        ))}
      </div>
    );
  }

  // Procedural fallback
  const count = Math.max(Math.floor(width / 28), 2);
  const rng = seededRandom(clipId + '_frames');
  const blocks: number[] = [];
  for (let i = 0; i < count; i++) blocks.push(rng());
  const blockW = width / count;

  return (
    <div className="absolute inset-0 flex overflow-hidden pointer-events-none">
      {blocks.map((intensity, i) => (
        <div
          key={i}
          className="h-full border-r border-white/5"
          style={{
            width: `${blockW}px`,
            backgroundColor: `rgba(59, 130, 246, ${0.1 + intensity * 0.3})`,
          }}
        />
      ))}
    </div>
  );
}

/**
 * Renders audio waveform bars from real peaks or fallback data.
 * @param small – If true renders a compact waveform row (for audio beneath video).
 */
function WaveformOverlay({
  media,
  clipId,
  width,
  height,
  small,
}: {
  media: MediaItem | null;
  clipId: string;
  width: number;
  height: number;
  small?: boolean;
}) {
  const barSpacing = small ? 2 : 3;
  const barCount = Math.max(Math.floor(width / barSpacing), 4);

  let peaks: number[];
  if (media?.waveformPeaks && media.waveformPeaks.length > 0) {
    // Resample real peaks to fit bar count
    const src = media.waveformPeaks;
    peaks = [];
    for (let i = 0; i < barCount; i++) {
      const srcIdx = (i / barCount) * src.length;
      const lo = Math.floor(srcIdx);
      const hi = Math.min(lo + 1, src.length - 1);
      const frac = srcIdx - lo;
      peaks.push(src[lo] * (1 - frac) + src[hi] * frac);
    }
  } else {
    peaks = generateFallbackWaveform(clipId, barCount);
  }

  const barColor = small ? 'bg-emerald-300/50' : 'bg-white/40';

  return (
    <div
      className="absolute inset-x-0 bottom-0 flex items-end px-0.5 pointer-events-none gap-px"
      style={{ height: `${height}px` }}
    >
      {peaks.map((peak, i) => (
        <div
          key={i}
          className={`flex-1 ${barColor} rounded-sm`}
          style={{
            height: `${Math.max(4, peak * 100)}%`,
            minHeight: '2px',
          }}
        />
      ))}
    </div>
  );
}

// ─── Transitions Sub-Component ────────────────────────────────────────────────

interface TransitionTargetProps {
  position?: 'in' | 'out';
  clipId: string;
  trackId: string;
  left: number;
  width: number;
  hasTransition: boolean;
  transitionName?: string;
  isSelected: boolean;
  zoomLevel: number;
}

function TransitionPreviewTooltipCanvas({ transitionName }: { transitionName: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;

    let animationId: number;
    const startRef = { current: null as number | null };
    const duration = 1500; // 1.5s loop duration

    const draw = (t: number) => {
      ctx.clearRect(0, 0, W, H);
      const nameLower = transitionName.toLowerCase();

      const drawBlock = (color: string, opacity: number, scaleMultiplier: number = 1, tx: number = 0, ty: number = 0) => {
        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.translate(W / 2 + tx, H / 2 + ty);
        ctx.scale(scaleMultiplier, scaleMultiplier);
        
        ctx.fillStyle = color;
        ctx.fillRect(-W / 2, -H / 2, W, H);
        ctx.restore();
      };

      const colorA = '#ef4444'; // Red
      const colorB = '#3b82f6'; // Blue

      if (nameLower.includes('dissolve')) {
        drawBlock(colorA, 1 - t);
        drawBlock(colorB, t);
      } else if (nameLower.includes('fade')) {
        if (t < 0.5) {
          drawBlock(colorA, 1 - t * 2);
        } else {
          drawBlock(colorB, (t - 0.5) * 2);
        }
      } else if (nameLower.includes('wipe')) {
        if (nameLower.includes('left')) {
          drawBlock(colorA, 1);
          ctx.save();
          ctx.beginPath();
          ctx.rect(W * (1 - t), 0, W * t, H);
          ctx.clip();
          drawBlock(colorB, 1);
          ctx.restore();
        } else {
          drawBlock(colorA, 1);
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, 0, W * t, H);
          ctx.clip();
          drawBlock(colorB, 1);
          ctx.restore();
        }
      } else if (nameLower.includes('slide')) {
        if (nameLower.includes('up')) {
          drawBlock(colorA, 1, 1, 0, -H * t);
          drawBlock(colorB, 1, 1, 0, H * (1 - t));
        } else if (nameLower.includes('down')) {
          drawBlock(colorA, 1, 1, 0, H * t);
          drawBlock(colorB, 1, 1, 0, -H * (1 - t));
        } else {
          drawBlock(colorA, 1, 1, -W * t, 0);
          drawBlock(colorB, 1, 1, W * (1 - t), 0);
        }
      } else if (nameLower.includes('zoom')) {
        if (nameLower.includes('out')) {
          drawBlock(colorB, 1);
          drawBlock(colorA, 1 - t, 1 - t);
        } else {
          drawBlock(colorA, 1 - t);
          drawBlock(colorB, t, t);
        }
      } else {
        drawBlock(colorA, 1 - t);
        drawBlock(colorB, t);
      }
    };

    const animate = (timestamp: number) => {
      if (!startRef.current) startRef.current = timestamp;
      const elapsed = timestamp - startRef.current;
      const progress = (elapsed % duration) / duration;
      draw(progress);
      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, [transitionName]);

  return (
    <canvas
      ref={canvasRef}
      width={120}
      height={68}
      className="rounded border border-purple-500/30 bg-[#0c0c0c]"
    />
  );
}

function TransitionTarget({
  clipId,
  trackId,
  position,
  left,
  width,
  hasTransition,
  transitionName,
  isSelected,
  zoomLevel,
}: TransitionTargetProps) {
  const { selectTransition, updateTransition, removeTrack,
    reorderTrack, } = useEditorStore();
  const [isDragOver, setIsDragOver] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const handleDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/procut-transition')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      setIsDragOver(true);
    }
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const name = e.dataTransfer.getData('application/procut-transition');
    if (!name) return;

    let type: 'dissolve' | 'wipe' | 'zoom' | 'slide' = 'dissolve';
    if (name.toLowerCase().includes('wipe')) type = 'wipe';
    else if (name.toLowerCase().includes('zoom')) type = 'zoom';
    else if (name.toLowerCase().includes('slide')) type = 'slide';

    const newTransition = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      type,
      duration: 1.0,
      params: { alignment: 'center' },
    };

    if (position === 'in') {
      useEditorStore.getState().updateClip(clipId, { transitionIn: newTransition });
    } else {
      useEditorStore.getState().updateClip(clipId, { transitionOut: newTransition });
    }
    useEditorStore.getState().saveSnapshot();
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    selectTransition(clipId);
  };

  if (hasTransition) {
    let TransitionIcon = Sparkles;
    const nameLower = (transitionName || '').toLowerCase();
    if (nameLower.includes('wipe')) {
      TransitionIcon = ArrowLeftRight;
    } else if (nameLower.includes('slide')) {
      TransitionIcon = GripVertical;
    } else if (nameLower.includes('zoom')) {
      TransitionIcon = ZoomIn;
    }

    return (
      <div
        className={`absolute top-2 bottom-2 rounded-sm z-30 flex items-center justify-center cursor-pointer text-white border transition-all group/trans ${
          isSelected
            ? 'bg-purple-600 border-purple-300 ring-1 ring-purple-300 shadow-lg'
            : 'bg-purple-700/80 border-purple-600 hover:bg-purple-600 hover:border-purple-500'
        }`}
        style={{ left: `${left}px`, width: `${width}px` }}
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onMouseEnter={() => setIsHovered(true)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setMousePos({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
          });
        }}
        onMouseLeave={() => setIsHovered(false)}
      >
        <TransitionIcon className={`w-3.5 h-3.5 text-purple-200 group-hover/trans:scale-110 transition-transform ${isHovered ? 'animate-pulse' : ''}`} />

        {/* Hover preview tooltip with animation */}
        {isHovered && transitionName && (
          <div
            className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-[#1a1a1a]/95 border border-purple-500 rounded p-1.5 shadow-2xl z-50 flex flex-col items-center gap-1.5 pointer-events-none animate-in fade-in zoom-in-95 duration-100"
            style={{ minWidth: '130px' }}
          >
            <span className="text-[9px] text-white font-semibold capitalize whitespace-nowrap">
              {transitionName}
            </span>
            <TransitionPreviewTooltipCanvas transitionName={transitionName} />
          </div>
        )}

        {/* Cursor tracking label tooltip */}
        {isHovered && transitionName && (
          <div
            className="absolute pointer-events-none bg-black/95 text-[9px] text-purple-200 px-1.5 py-0.5 rounded shadow-lg border border-purple-500/30 z-[100] whitespace-nowrap"
            style={{
              top: `${mousePos.y + 15}px`,
              left: `${mousePos.x + 15}px`,
            }}
          >
            {transitionName}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="absolute top-0 bottom-0 z-30 flex flex-col items-center justify-center pointer-events-auto group cursor-pointer"
      style={{
        left: `${left + width / 2 - 12}px`, // centered exactly at the cut line (width is 24px)
        width: '24px',
      }}
    >
      <div className={`w-0.5 flex-1 border-l border-dashed transition-colors ${
        isDragOver ? 'border-purple-400' : 'border-purple-500/40 group-hover:border-purple-500/70'
      }`} />
      
      <div className={`w-5 h-5 rounded-full border flex items-center justify-center shadow-md transition-all ${
        isDragOver
          ? 'bg-purple-600 border-purple-300 text-white scale-125'
          : 'bg-[#252525] border-purple-500/60 text-purple-400 hover:text-white hover:scale-110 hover:border-purple-500'
      }`}>
        <Plus className="w-3.5 h-3.5" />
      </div>
      
      <div className={`w-0.5 flex-1 border-l border-dashed transition-colors ${
        isDragOver ? 'border-purple-400' : 'border-purple-500/40 group-hover:border-purple-500/70'
      }`} />
    </div>
  );
}

// ─── Playhead Sub-components to prevent Timeline re-rendering ──────────────────

function RulerPlayhead({ zoomLevel }: { zoomLevel: number }) {
  const currentTime = useEditorStore((state) => state.currentTime);
  return (
    <div
      className="absolute top-0 h-full z-10 pointer-events-none"
      style={{ left: `${currentTime * zoomLevel}px` }}
    >
      <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-red-500 -translate-x-1/2" />
    </div>
  );
}

function WorkspacePlayhead({ zoomLevel }: { zoomLevel: number }) {
  const currentTime = useEditorStore((state) => state.currentTime);
  return (
    <div
      className="absolute top-0 bottom-0 z-30 pointer-events-none"
      style={{ left: `${currentTime * zoomLevel}px` }}
    >
      <div className="w-px h-full bg-red-500" />
      <div className="absolute top-0 -translate-x-1/2 w-3 h-3 bg-red-500 rounded-full -translate-y-px" />
    </div>
  );
}

function FloatingScrubTooltip({
  zoomLevel,
  scrollLeft,
  isScrubbing,
}: {
  zoomLevel: number;
  scrollLeft: number;
  isScrubbing: boolean;
}) {
  const currentTime = useEditorStore((state) => state.currentTime);
  if (!isScrubbing) return null;
  return (
    <div
      className="absolute z-50 bg-[#141414]/95 text-amber-400 text-[10px] font-bold px-2 py-1 rounded border border-[#3e3e3e] shadow-2xl pointer-events-none -translate-x-1/2 flex items-center gap-1.5"
      style={{
        left: `${currentTime * zoomLevel - scrollLeft}px`,
        top: `${RULER_HEIGHT + 6}px`,
      }}
    >
      {/* Tooltip caret */}
      <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-[#141414] border-t border-l border-[#3e3e3e] rotate-45" />
      <span className="relative z-10 tabular-nums">
        {formatDetailedTooltipTime(currentTime)}
      </span>
    </div>
  );
}

function PlaybackAutoScroller({
  zoomLevel,
  totalDuration,
  trackContainerRef,
  setScrollLeftThrottled,
}: {
  zoomLevel: number;
  totalDuration: number;
  trackContainerRef: React.RefObject<HTMLDivElement | null>;
  setScrollLeftThrottled: (scrollLeft: number) => void;
}) {
  const currentTime = useEditorStore((state) => state.currentTime);
  const isPlaying = useEditorStore((state) => state.isPlaying);

  useEffect(() => {
    if (!isPlaying) return;
    const container = trackContainerRef.current;
    if (!container) return;

    const visibleWidth = container.clientWidth;
    const totalMediaWidth = totalDuration * zoomLevel;
    if (totalMediaWidth <= visibleWidth) return;

    const playheadX = currentTime * zoomLevel;
    const thresholdX = container.scrollLeft + visibleWidth * 0.6;

    if (playheadX > thresholdX) {
      const targetScroll = playheadX - visibleWidth * 0.6;
      container.scrollLeft = targetScroll;
      setScrollLeftThrottled(targetScroll);
    } else if (playheadX < container.scrollLeft) {
      const targetScroll = Math.max(0, playheadX - visibleWidth * 0.1);
      container.scrollLeft = targetScroll;
      setScrollLeftThrottled(targetScroll);
    }
  }, [currentTime, isPlaying, zoomLevel, totalDuration, trackContainerRef, setScrollLeftThrottled]);

  return null;
}

// ─── Main component ──────────────────────────────────────────────────────────

export function Timeline() {
  const {
    tracks,
    isPlaying,
    zoomLevel,
    scrollLeft,
    selectedClipId,
    selectedClipIds,
    selectedOverLayerId,
    mediaLibrary,
    hoveredOverLayerRegion,
    activeTool,
    selectedTrackId,
    draggingClipId,
    totalDuration,
    isRecordingVoiceover,
    recordingTrackId,
    startVoiceoverRecordingState,
    stopVoiceoverRecordingState,
    play,
    pause,
    selectClip,
    selectClips,
    selectTrack,
    seek,
    splitClip,
    moveClip,
    moveClips,
    resolveOverlaps,
    zoomIn,
    zoomOut,
    toggleTrackLock,
    toggleTrackMute,
    addTrack,
    removeTrack,
    updateClip,
    setDragPreview,
    showTransitionLayer,
    selectedTransitionClipId,
    setShowTransitionLayer,
    selectTransition,
    selectedKeyframeLines,
    toggleKeyframeLineSelection,
    addClip,
    reorderTrack,
    unlinkAudio,
    breakLinkConnection,
    inPoint,
    outPoint,
    markers,
    addMarker,
    updateMarker,
    removeMarker,
    beatMarkers,
    addOverLayer,
    removeOverLayer,
    updateOverLayer,
    moveOverLayer,
    reorderOverLayer,
    selectOverLayer,
    setHoveredOverLayerRegion,
    pinnedOverLayerTrackId,
    setPinnedOverLayerTrackId,
    settings,
    updateSettings,
    timelineStack,
    exitCompoundClip,
    enterCompoundClip,
  } = useEditorStore();

  // ── Refs & local state ──────────────────────────────────────────────────

  const timelineRef = useRef<HTMLDivElement>(null);
  const trackContainerRef = useRef<HTMLDivElement>(null);
  const trackHeadersRef = useRef<HTMLDivElement>(null);
  const rulerContainerRef = useRef<HTMLDivElement>(null);
  const scrubRafIdRef = useRef<number | null>(null);
  const handleMouseMoveRef = useRef<any>(null);
  const handleMouseUpRef = useRef<any>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingStartPlayheadRef = useRef<number>(0);
  const recordingStartTimeMsRef = useRef<number>(0);

  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleVoiceoverRecordingToggle = useCallback(async (trackId: string) => {
    const isRecordingThis = isRecordingVoiceover && recordingTrackId === trackId;

    if (isRecordingVoiceover && !isRecordingThis) {
      return;
    }

    if (!isRecordingVoiceover) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioStreamRef.current = stream;
        audioChunksRef.current = [];

        let mimeType = 'audio/webm';
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
          mimeType = 'audio/ogg;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        }

        const recorder = new MediaRecorder(stream, { mimeType });
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            audioChunksRef.current.push(e.data);
          }
        };

        recorder.onstop = async () => {
          const blob = new Blob(audioChunksRef.current, { type: mimeType });
          const elapsed = (Date.now() - recordingStartTimeMsRef.current) / 1000;
          const finalDuration = Math.max(0.5, elapsed);

          const audioUrl = URL.createObjectURL(blob);
          const mediaId = `recorded_voiceover_${Date.now()}`;

          const peaks: number[] = [];
          for (let i = 0; i < 100; i++) {
            peaks.push(0.1 + Math.random() * 0.7);
          }

          try {
            await useEditorStore.getState().addMedia({
              id: mediaId,
              name: `Voiceover Recording`,
              type: 'audio',
              duration: finalDuration,
              url: audioUrl,
              createdAt: Date.now(),
              waveformPeaks: peaks,
            }, new File([blob], `voiceover_${mediaId}.webm`, { type: mimeType }));
          } catch (err) {
            console.error('Failed to add voiceover media item:', err);
            useEditorStore.getState().addMedia({
              id: mediaId,
              name: `Voiceover Recording`,
              type: 'audio',
              duration: finalDuration,
              url: audioUrl,
              createdAt: Date.now(),
              waveformPeaks: peaks,
            });
          }

          const clipId = `clip_recorded_${Math.random().toString(36).substr(2, 9)}`;
          const newClip = {
            id: clipId,
            mediaId,
            trackId,
            startTime: recordingStartPlayheadRef.current,
            duration: finalDuration,
            trimStart: 0,
            trimEnd: 0,
            transform: { x: 0, y: 0, scale: 100, rotation: 0 },
            opacity: 1,
            speed: 1,
            effects: [],
          };

          addClip(newClip);

          if (audioStreamRef.current) {
            audioStreamRef.current.getTracks().forEach((t) => t.stop());
            audioStreamRef.current = null;
          }

          stopVoiceoverRecordingState();
          useEditorStore.getState().saveSnapshot('Record Voiceover');
        };

        setRecordingSeconds(0);
        recordingTimerRef.current = setInterval(() => {
          setRecordingSeconds((s) => s + 1);
        }, 1000);

        recorder.start();
        recordingStartPlayheadRef.current = useEditorStore.getState().currentTime;
        recordingStartTimeMsRef.current = Date.now();
        startVoiceoverRecordingState(trackId);
        play();
      } catch (err) {
        console.error('Microphone access denied or voiceover recording failed:', err);
        alert('Failed to access microphone. Please check your system/browser permissions.');
      }
    } else {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      pause();

      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  }, [
    isRecordingVoiceover,
    recordingTrackId,
    startVoiceoverRecordingState,
    stopVoiceoverRecordingState,
    play,
    pause,
    addClip
  ]);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const [isTranscribing, setIsTranscribing] = useState(false);

  // AI SFX Generator States
  const [sfxModalClipId, setSfxModalClipId] = useState<string | null>(null);
  const [sfxCategory, setSfxCategory] = useState<string>('explosion');
  const [sfxDuration, setSfxDuration] = useState<number>(1.0);
  const [sfxName, setSfxName] = useState<string>('Sound Effect');
  const [isAnalyzingSfx, setIsAnalyzingSfx] = useState<boolean>(false);
  const [isSynthesizingSfx, setIsSynthesizingSfx] = useState<boolean>(false);

  // AI SFX Auto-Cue / Scene Alignment States
  const [sfxAutoCueClipId, setSfxAutoCueClipId] = useState<string | null>(null);
  const [sfxUserDescription, setSfxUserDescription] = useState<string>('');
  const [sfxAutoCueMode, setSfxAutoCueMode] = useState<'visual' | 'ai_script'>('visual');
  const [isAnalyzingAutoCue, setIsAnalyzingAutoCue] = useState<boolean>(false);
  const [autoCueProgress, setAutoCueProgress] = useState<number>(0);

  const handleOpenSfxGenerator = useCallback(async (clipId: string) => {
    let targetClip: TimelineClip | null = null;
    for (const track of tracks) {
      const found = track.clips.find(c => c.id === clipId);
      if (found) {
        targetClip = found;
        break;
      }
    }
    if (!targetClip) return;

    const mediaItem = mediaLibrary.find(m => m.id === targetClip!.mediaId);
    const clipName = mediaItem ? mediaItem.name : 'Unknown Clip';
    const clipType = mediaItem ? mediaItem.type : 'video';

    setSfxModalClipId(clipId);
    setSfxCategory('explosion');
    setSfxName(`SFX: ${clipName.slice(0, 20)}`);
    setSfxDuration(1.0);
    setIsAnalyzingSfx(true);

    try {
      const puter = (window as any).puter;
      if (puter) {
        const responseText = await puter.ai.chat(
          `Analyze this video/audio clip:
Name: "${clipName}"
Type: "${clipType}"
Duration: ${targetClip.duration} seconds

We need to generate a sound effect (SFX) that matches this clip. Select the best match from these synthesized categories:
- 'explosion' (for blasts, crashes, booms, heavy hits)
- 'laser' (for zaps, laser shots, futuristic beams)
- 'swoosh' (for passes, fast movements, transitions, wind sweeps)
- 'jump' (for retro jumps, pops, upward sweeps, power-ups)
- 'bubble' (for water pops, liquid sounds, cute clicks)
- 'alarm' (for beeps, warning sirens, electronic alerts)
- 'click' (for UI buttons, ticks, small impacts)
- 'ambient' (for background wind, hums, static noise, room tone)
- 'waves' (for sea/ocean waves, flowing water, wind rustle)
- 'flying' (for flying drones, engine hums, fast flight swooshes)
- 'magic' (for sparkles, chimes, magical spells, fairy dust)
- 'punch' (for punches, slap hits, thuds, body blows)
- 'footsteps' (for walking steps, running, movement sounds)
- 'gunshot' (for gun blast, crack, explosion sound)
- 'spark' (for electrical sparks, lightning crackles, short circuits)

Also suggest a descriptive name for the sound effect (e.g. "Space Laser Zap", "Distant Explosion", "Fast Whoosh").
NOTE: If the clip name contains only numbers or random characters (e.g., "12345.mp4", "VID_2026.mp4", "unnamed.png") or is not descriptive, please choose 'swoosh' as the category and suggest "Transition Swoosh" as the name.

Return your response ONLY as a JSON object with these two fields:
{
  "category": "category_name",
  "name": "Sound Name"
}`
        );

        const jsonMatch = responseText.match(/\{[\s\S]*?\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.category) setSfxCategory(parsed.category);
          if (parsed.name) setSfxName(parsed.name);
        }
      }
    } catch (err) {
      console.error('Failed to analyze clip for SFX:', err);
    } finally {
      setIsAnalyzingSfx(false);
    }
  }, [tracks, mediaLibrary]);

  const handleGenerateSFX = useCallback(async () => {
    if (!sfxModalClipId) return;

    let targetClip: TimelineClip | null = null;
    for (const track of tracks) {
      const found = track.clips.find(c => c.id === sfxModalClipId);
      if (found) {
        targetClip = found;
        break;
      }
    }
    if (!targetClip) return;

    setIsSynthesizingSfx(true);
    try {
      const blob = await synthesizeProceduralSFX(sfxCategory, sfxDuration);
      const audioUrl = URL.createObjectURL(blob);

      const mediaId = `sfx_${Date.now()}`;
      const newMediaItem = {
        id: mediaId,
        name: sfxName,
        type: 'audio' as const,
        duration: sfxDuration,
        url: audioUrl,
        createdAt: Date.now()
      };

      const peaks: number[] = [];
      for (let i = 0; i < 100; i++) {
        peaks.push(0.1 + Math.random() * 0.7);
      }

      const finalMediaItem = {
        ...newMediaItem,
        waveformPeaks: peaks
      };

      try {
        await useEditorStore.getState().addMedia(finalMediaItem, new File([blob], `${mediaId}.wav`, { type: 'audio/wav' }));
      } catch (err) {
        console.error('Failed to save SFX to IndexedDB:', err);
        useEditorStore.getState().addMedia(finalMediaItem);
      }

      let audioTrack = tracks.find(t => t.type === 'audio');
      if (!audioTrack) {
        useEditorStore.getState().addTrack('audio');
        const updatedTracks = useEditorStore.getState().tracks;
        audioTrack = updatedTracks.find(t => t.type === 'audio') || updatedTracks[updatedTracks.length - 1];
      }

      const newAudioClip = {
        id: `clip_sfx_${Math.random().toString(36).substr(2, 9)}`,
        mediaId: mediaId,
        trackId: audioTrack.id,
        startTime: targetClip.startTime,
        duration: sfxDuration,
        trimStart: 0,
        trimEnd: 0,
        transform: { x: 0, y: 0, scale: 100, rotation: 0 },
        opacity: 1,
        speed: 1,
        effects: []
      };

      useEditorStore.getState().startTransaction();
      addClip(newAudioClip as any);
      useEditorStore.getState().endTransaction();
      useEditorStore.getState().saveSnapshot('AI Sound Effect Generation');

      setSfxModalClipId(null);
    } catch (err: any) {
      await handlePuterError(err, 'AI Sound Effect');
    } finally {
      setIsSynthesizingSfx(false);
    }
  }, [sfxModalClipId, sfxCategory, sfxDuration, sfxName, tracks, addClip]);

  const handleAuditionSFX = useCallback(async () => {
    try {
      const blob = await synthesizeProceduralSFX(sfxCategory, sfxDuration);
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);
      audio.play();
    } catch (err) {
      console.error('Failed to audition SFX:', err);
    }
  }, [sfxCategory, sfxDuration]);

  const handleAutoCueSFX = useCallback(async () => {
    if (!sfxAutoCueClipId) return;

    let targetClip: TimelineClip | null = null;
    for (const track of tracks) {
      const found = track.clips.find(c => c.id === sfxAutoCueClipId);
      if (found) {
        targetClip = found;
        break;
      }
    }
    if (!targetClip) return;

    const mediaItem = mediaLibrary.find(m => m.id === targetClip!.mediaId);
    if (!mediaItem || !mediaItem.url) {
      alert('Media source file not found.');
      return;
    }

    setIsAnalyzingAutoCue(true);
    setAutoCueProgress(0);

    try {
      let cuePoints: { time: number; duration: number; category: string; name: string }[] = [];

      if (sfxAutoCueMode === 'visual') {
        const video = document.createElement('video');
        video.src = mediaItem.url;
        video.crossOrigin = 'anonymous';
        video.muted = true;
        video.playsInline = true;

        await new Promise((resolve, reject) => {
          video.onloadedmetadata = resolve;
          video.onerror = () => reject(new Error('Failed to load video metadata for visual analysis.'));
        });

        const clipDur = targetClip.duration;
        const scanFps = 4;
        const step = 1 / scanFps;
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 18;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        if (!ctx) throw new Error('Failed to create offscreen canvas context.');

        let prevFrameData: Uint8ClampedArray | null = null;
        const motionDiffs: { time: number; diff: number }[] = [];

        for (let time = 0; time < clipDur; time += step) {
          video.currentTime = time;
          await new Promise((resolve) => {
            video.onseeked = resolve;
          });

          ctx.drawImage(video, 0, 0, 32, 18);
          const frameData = ctx.getImageData(0, 0, 32, 18).data;

          if (prevFrameData) {
            let sumDiff = 0;
            for (let i = 0; i < frameData.length; i += 4) {
              sumDiff += Math.abs(frameData[i] - prevFrameData[i]) +
                         Math.abs(frameData[i+1] - prevFrameData[i+1]) +
                         Math.abs(frameData[i+2] - prevFrameData[i+2]);
            }
            const avgDiff = sumDiff / (32 * 18 * 3);
            motionDiffs.push({ time, diff: avgDiff });
          }

          prevFrameData = frameData;
          setAutoCueProgress(Math.floor((time / clipDur) * 90));
        }

        if (motionDiffs.length > 0) {
          const diffValues = motionDiffs.map(m => m.diff);
          const mean = diffValues.reduce((a, b) => a + b, 0) / diffValues.length;
          const stdDev = Math.sqrt(diffValues.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) / diffValues.length);
          const threshold = mean + 2.0 * stdDev;

          for (let i = 1; i < motionDiffs.length - 1; i++) {
            const current = motionDiffs[i];
            const prev = motionDiffs[i - 1];
            const next = motionDiffs[i + 1];

            if (current.diff > threshold && current.diff > prev.diff && current.diff > next.diff) {
              const isHugeSpike = current.diff > (mean + 3.5 * stdDev);
              const category = isHugeSpike ? 'explosion' : 'swoosh';
              const sfxName = isHugeSpike ? 'Action Peak Hit' : 'Motion Swoosh';

              cuePoints.push({
                time: current.time,
                duration: isHugeSpike ? 1.5 : 0.6,
                category,
                name: sfxName
              });

              i += Math.floor(0.75 * scanFps);
            }
          }
        }
      } else {
        const puter = (window as any).puter;
        if (!puter) {
          throw new Error('Puter AI engine is not loaded. Please connect to the internet.');
        }

        setAutoCueProgress(40);
        const responseText = await puter.ai.chat(
          `We have a video clip named "${mediaItem.name}" of duration ${targetClip.duration} seconds.
The user describes the action: "${sfxUserDescription}".

We need to generate matching sound effects (SFX) that fit the video timeline.
Choose ONLY from these categories: 'explosion', 'laser', 'swoosh', 'jump', 'bubble', 'alarm', 'click', 'ambient', 'waves', 'flying', 'magic', 'punch', 'footsteps', 'gunshot', 'spark'.

Return a list of sound effects to place, with their start time (relative to the video start, between 0 and ${targetClip.duration} seconds) and duration.
Return your response ONLY as a JSON array of objects:
[
  {
    "time": 1.2,
    "duration": 0.8,
    "category": "category_name",
    "name": "Sound Name"
  }
]`
        );
        setAutoCueProgress(80);

        const jsonMatch = responseText.match(/\[[\s\S]*?\]/);
        if (jsonMatch) {
          cuePoints = JSON.parse(jsonMatch[0]);
        }
      }

      if (cuePoints.length === 0) {
        throw new Error('No action points or cues detected. Try describing the action more explicitly.');
      }

      let audioTrack = tracks.find(t => t.type === 'audio');
      if (!audioTrack) {
        useEditorStore.getState().addTrack('audio');
        const updatedTracks = useEditorStore.getState().tracks;
        audioTrack = updatedTracks.find(t => t.type === 'audio') || updatedTracks[updatedTracks.length - 1];
      }

      useEditorStore.getState().startTransaction();

      for (let i = 0; i < cuePoints.length; i++) {
        const cue = cuePoints[i];
        const category = cue.category || 'swoosh';
        const duration = Math.max(0.1, Number(cue.duration) || 1.0);
        const timeOffset = Number(cue.time) || 0;
        const name = cue.name || 'AI SFX';

        const blob = await synthesizeProceduralSFX(category, duration);
        const audioUrl = URL.createObjectURL(blob);

        const mediaId = `sfx_autocue_${Date.now()}_${i}`;
        const newMediaItem = {
          id: mediaId,
          name: name,
          type: 'audio' as const,
          duration: duration,
          url: audioUrl,
          createdAt: Date.now()
        };

        const peaks: number[] = [];
        for (let p = 0; p < 100; p++) {
          peaks.push(0.1 + Math.random() * 0.7);
        }

        const finalMediaItem = {
          ...newMediaItem,
          waveformPeaks: peaks
        };

        try {
          await useEditorStore.getState().addMedia(finalMediaItem, new File([blob], `${mediaId}.wav`, { type: 'audio/wav' }));
        } catch (err) {
          useEditorStore.getState().addMedia(finalMediaItem);
        }

        const newAudioClip = {
          id: `clip_sfx_cue_${Math.random().toString(36).substr(2, 9)}`,
          mediaId: mediaId,
          trackId: audioTrack.id,
          startTime: targetClip.startTime + timeOffset,
          duration: duration,
          trimStart: 0,
          trimEnd: 0,
          transform: { x: 0, y: 0, scale: 100, rotation: 0 },
          opacity: 1,
          speed: 1,
          effects: []
        };

        addClip(newAudioClip as any);
      }

      useEditorStore.getState().endTransaction();
      useEditorStore.getState().saveSnapshot('AI Sound Effects Auto-Cue');

      setSfxAutoCueClipId(null);
      setSfxUserDescription('');
      alert(`Successfully generated and auto-placed ${cuePoints.length} sound effects!`);
    } catch (err: any) {
      await handlePuterError(err, 'Auto-Cue Sound Effects');
    } finally {
      setIsAnalyzingAutoCue(false);
      setAutoCueProgress(0);
    }
  }, [sfxAutoCueClipId, sfxAutoCueMode, sfxUserDescription, tracks, mediaLibrary, addClip]);

  const handleGenerateSubtitles = useCallback(async (clipId: string, mode: 'standard' | 'dynamic') => {
    let targetClip: TimelineClip | null = null;
    let targetTrack: TimelineTrack | null = null;
    const liveTracks = useEditorStore.getState().tracks;
    for (const track of liveTracks) {
      const found = track.clips.find(c => c.id === clipId);
      if (found) {
        targetClip = found;
        targetTrack = track;
        break;
      }
    }

    if (!targetClip) return;

    const mediaItem = mediaLibrary.find(m => m.id === targetClip!.mediaId);
    if (!mediaItem || !mediaItem.url) {
      alert('Media source file not found.');
      return;
    }

    setIsTranscribing(true);

    try {
      const response = await fetch(mediaItem.url);
      if (!response.ok) throw new Error('Failed to retrieve clip media blob.');
      const blob = await response.blob();

      const file = new File([blob], 'audio.mp3', { type: blob.type || 'audio/mp3' });

      const puter = (window as any).puter;
      if (!puter) {
        throw new Error('Puter AI engine is not loaded. Make sure you are connected to the internet.');
      }

      const result = await puter.ai.speech2txt({
        audio: file,
        provider: 'openai',
        model: 'whisper-1',
        response_format: 'verbose_json',
        timestamp_granularities: ['word']
      });

      if (!result || !result.words || result.words.length === 0) {
        throw new Error('No words detected in this clip. Ensure the clip has clear audible speech.');
      }

      // Detect and Transliterate Non-Latin (Urdu/Hindi) script to Hinglish
      const hasNonLatin = result.words.some((w: any) => /[\u0600-\u06FF\u0900-\u097F]/.test(w.word));
      if (hasNonLatin) {
        try {
          const wordsToTransliterate = result.words.map((w: any, idx: number) => ({ idx, word: w.word }));
          const chunkSize = 60;
          for (let c = 0; c < wordsToTransliterate.length; c += chunkSize) {
            const chunk = wordsToTransliterate.slice(c, c + chunkSize);
            const translitPrompt2 = `You are a transliteration engine. Convert the following Urdu/Hindi words to Hinglish (Roman/Latin script). Return ONLY a raw JSON array, no markdown, no explanation.

Input: ${JSON.stringify(chunk)}

Rules:
- Output ONLY: [{"idx":0,"word":"roman_word"},...]
- Same length as input (${chunk.length} items)
- Transliterate sound, don't translate meaning (بہت → bahut, نہیں → nahi, کیا → kya, হ্যাঁ → haan)
- Keep numbers/punctuation unchanged
- Use lowercase Latin letters only`;

            const rawResponse = await puter.ai.chat(translitPrompt2);
            console.log('Transliteration raw response type:', typeof rawResponse, rawResponse);
            
            // puter.ai.chat may return a string or an object with message.content
            let responseText = '';
            if (typeof rawResponse === 'string') {
              responseText = rawResponse;
            } else if (rawResponse?.message?.content) {
              responseText = String(rawResponse.message.content);
            } else if (rawResponse?.content) {
              responseText = String(rawResponse.content);
            } else if (rawResponse?.text) {
              responseText = String(rawResponse.text);
            } else {
              responseText = String(rawResponse);
            }
            
            console.log('Transliteration text to parse:', responseText);
            const parsedWords = parseTransliteratedResponse(responseText);
            if (parsedWords && Array.isArray(parsedWords)) {
              for (const item of parsedWords) {
                if (item && typeof item === 'object' && 'idx' in item && 'word' in item) {
                  if (result.words[item.idx]) {
                    result.words[item.idx].word = String(item.word);
                  }
                }
              }
            }
            // If parsedWords is null/invalid, we just keep the original words (don't throw)
          }
        } catch (translitErr) {
          console.error('Failed to transliterate to Hinglish:', translitErr);
          // Continue with original words if transliteration fails
        }
      }

      let textTrack = useEditorStore.getState().tracks.find(t => t.type === 'text');
      if (!textTrack) {
        useEditorStore.getState().addTrack('text');
        const freshTracks = useEditorStore.getState().tracks;
        textTrack = freshTracks.find(t => t.type === 'text') || freshTracks.find(t => t.type === 'video');
        if (!textTrack) {
          throw new Error('No text or video track is available to place subtitles.');
        }
      }

      useEditorStore.getState().startTransaction();

      const clipStart = targetClip.startTime;

      if (mode === 'standard') {
        const maxCharLimit = 36;
        const maxTimeLimit = 2.5;
        const maxWordsLimit = 5;

        let currentGroup: any[] = [];
        const subtitleGroups: any[] = [];

        for (const w of result.words) {
          const groupText = currentGroup.map(item => item.word).join(' ');
          const currentGroupDuration = currentGroup.length > 0 ? (w.end - currentGroup[0].start) : 0;

          const exceedsChars = (groupText.length + w.word.length) > maxCharLimit;
          const exceedsTime = currentGroupDuration > maxTimeLimit;
          const exceedsWords = currentGroup.length >= maxWordsLimit;
          const hasBigGap = currentGroup.length > 0 && (w.start - currentGroup[currentGroup.length - 1].end) > 1.2;

          if (currentGroup.length > 0 && (exceedsChars || exceedsTime || exceedsWords || hasBigGap)) {
            subtitleGroups.push([...currentGroup]);
            currentGroup = [];
          }
          currentGroup.push(w);
        }
        if (currentGroup.length > 0) {
          subtitleGroups.push(currentGroup);
        }

        for (const group of subtitleGroups) {
          const firstWord = group[0];
          const lastWord = group[group.length - 1];
          const phraseText = group.map((w: any) => w.word).join(' ');

          const phraseStart = clipStart + firstWord.start;
          const phraseDur = Math.max(0.4, lastWord.end - firstWord.start);

          const newSubClip = {
            id: `clip_subtitle_${Math.random().toString(36).substr(2, 9)}`,
            mediaId: 'text-placeholder',
            trackId: textTrack.id,
            startTime: phraseStart,
            duration: phraseDur,
            trimStart: 0,
            trimEnd: 0,
            transform: { x: 0, y: 140, scale: 100, rotation: 0 },
            opacity: 1,
            speed: 1,
            effects: [],
            textSettings: {
              text: phraseText,
              fontSize: 26,
              fontFamily: 'Inter',
              color: '#ffffff',
              strokeWidth: 4,
              strokeColor: '#000000',
              bold: true,
              shadow: true,
              textAlign: 'center' as CanvasTextAlign,
              animation: {
                in: 'fadeIn',
                out: 'fadeOut',
                inDuration: 0.15,
                outDuration: 0.15
              }
            }
          };

          addClip(newSubClip as any);
        }
      } else {
        const colors = ['#ffffff', '#fbbf24', '#22c55e', '#22d3ee', '#f43f5e', '#a855f7'];
        const animations = ['zoom', 'bounce', 'slideUp'];

        for (let i = 0; i < result.words.length; i++) {
          const w = result.words[i];
          const wordText = w.word.trim();
          if (!wordText) continue;

          const wordStart = clipStart + w.start;
          // Typography should be snappy. The API word boundaries often include trailing breath/silence.
          // Cap the duration to a maximum of 0.45 seconds per word so the text doesn't stick around.
          let wordDur = w.end - w.start;
          if (wordDur > 0.45) wordDur = 0.45;
          else wordDur = Math.max(0.1, wordDur * 0.75);

          const color = colors[i % colors.length];
          const animIn = animations[i % animations.length];

          const staggerX = Math.floor(Math.random() * 30) - 15;
          const staggerY = 120 + Math.floor(Math.random() * 20) - 10;
          const rotation = Math.floor(Math.random() * 10) - 5;

          const newTypoClip = {
            id: `clip_typo_${Math.random().toString(36).substr(2, 9)}`,
            mediaId: 'text-placeholder',
            trackId: textTrack.id,
            startTime: wordStart,
            duration: wordDur,
            trimStart: 0,
            trimEnd: 0,
            transform: { x: staggerX, y: staggerY, scale: 100, rotation },
            opacity: 1,
            speed: 1,
            effects: [],
            textSettings: {
              text: wordText.toUpperCase(),
              fontSize: 42,
              fontFamily: 'Impact',
              color: color,
              strokeWidth: 5,
              strokeColor: '#000000',
              bold: true,
              shadow: true,
              textAlign: 'center' as CanvasTextAlign,
              animation: {
                in: animIn,
                out: 'fadeOut',
                inDuration: 0.08,
                outDuration: 0.08
              }
            }
          };

          addClip(newTypoClip as any);
        }
      }

      useEditorStore.getState().endTransaction();
      useEditorStore.getState().saveSnapshot(mode === 'standard' ? 'Auto-Generate Captions' : 'Generate Dynamic Typography');
    } catch (err: any) {
      await handlePuterError(err, 'AI Auto-Captioning');
    } finally {
      setIsTranscribing(false);
    }
  }, [tracks, mediaLibrary, addClip]);

  const [dragState, setDragState] = useState<{
    clipId: string;
    startX: number;
    startY: number;
    originalStartTime: number;
    originalScrollLeft: number;
    trackId: string;
    trackType: string;
    draggedClips?: {
      id: string;
      originalStartTime: number;
      trackId: string;
    }[];
  } | null>(null);

  const scrollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    return () => {
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
        scrollIntervalRef.current = null;
      }
    };
  }, []);
  const dragMouseXRef = useRef<number | null>(null);
  const dragMouseYRef = useRef<number | null>(null);

  const [resizeState, setResizeState] = useState<{
    clipId: string;
    edge: 'left' |'right';
    startX: number;
    originalDuration: number;
    originalTrimStart: number;
    originalTrimEnd: number;
    originalStartTime: number;
    originalSpeed: number;
    siblingClip?: {
      id: string;
      originalTrimStart: number;
      originalTrimEnd: number;
      originalDuration: number;
      originalStartTime: number;
      speed: number;
    };
    rippleClips?: {
      id: string;
      originalStartTime: number;
    }[];
  } | null>(null);

  const [dragOverLayerState, setDragOverLayerState] = useState<{
    overLayerId: string;
    startX: number;
    startY: number;
    originalStartTime: number;
    trackId: string;
  } | null>(null);

  const [resizeOverLayerState, setResizeOverLayerState] = useState<{
    overLayerId: string;
    edge: 'left' |'right';
    startX: number;
    originalDuration: number;
    originalStartTime: number;
  } | null>(null);

  const [snapLine, setSnapLine] = useState<number | null>(null);
  const [hoveredTrackId, setHoveredTrackId] = useState<string | null>(null);
  const [dropPreview, setDropPreview] = useState<{
    time: number;
    duration: number;
    trackIdx: number;
  } | null>(null);

  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubTime, setScrubTime] = useState<number | null>(null);
  const [scrubMouseX, setScrubMouseX] = useState<number>(0);

  const [hoverCutClipId, setHoverCutClipId] = useState<string | null>(null);
  const [hoverCutX, setHoverCutX] = useState<number | null>(null);

  // Transaction tracking to prevent unbalanced start/end calls
  const transactionActiveRef = useRef(false);

  const startTransactionSafe = useCallback(() => {
    if (!transactionActiveRef.current) {
      useEditorStore.getState().startTransaction();
      transactionActiveRef.current = true;
    }
  }, []);

  const endTransactionSafe = useCallback(() => {
    if (transactionActiveRef.current) {
      useEditorStore.getState().endTransaction();
      transactionActiveRef.current = false;
    }
  }, []);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number; y: number; clipId: string; trackType: string; mediaType: string; isOverLayer?: boolean; trackId?: string;
  } | null>(null);

  const [markerContextMenu, setMarkerContextMenu] = useState<{
    x: number; y: number; markerId: string;
  } | null>(null);

  // Close context menu on click-away
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener('mousedown', close, { once: true });
    return () => window.removeEventListener('mousedown', close);
  }, [contextMenu]);

  useEffect(() => {
    if (!markerContextMenu) return;
    const close = () => setMarkerContextMenu(null);
    window.addEventListener('mousedown', close, { once: true });
    return () => window.removeEventListener('mousedown', close);
  }, [markerContextMenu]);

  // Throttle ref — setScrollLeft in the store is expensive; only push at ~30fps max
  const scrollStoreThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setScrollLeftThrottled = useCallback((value: number) => {
    if (scrollStoreThrottleRef.current) return;
    scrollStoreThrottleRef.current = setTimeout(() => {
      useEditorStore.getState().setScrollLeft(value);
      scrollStoreThrottleRef.current = null;
    }, 33); // ~30fps
  }, []);

  // ── Scroll sync ─────────────────────────────────────────────────────────

  const handleScroll = useCallback(() => {
    if (trackContainerRef.current) {
      const target = trackContainerRef.current;
      // Sync ruler immediately via DOM
      if (rulerContainerRef.current && rulerContainerRef.current.scrollLeft !== target.scrollLeft) {
        rulerContainerRef.current.scrollLeft = target.scrollLeft;
      }
      // Throttle store updates; DOM position updates immediately
      setScrollLeftThrottled(target.scrollLeft);
      // Sync vertical scroll to headers
      if (trackHeadersRef.current && trackHeadersRef.current.scrollTop !== target.scrollTop) {
        trackHeadersRef.current.scrollTop = target.scrollTop;
      }
    }
  }, [setScrollLeftThrottled]);

  const handleHeadersScroll = useCallback(() => {
    if (trackHeadersRef.current && trackContainerRef.current) {
      const target = trackHeadersRef.current;
      if (trackContainerRef.current.scrollTop !== target.scrollTop) {
        trackContainerRef.current.scrollTop = target.scrollTop;
      }
    }
  }, []);

  // Ensure ruler and track containers sync if store's scrollLeft changes externally (e.g. zooming, auto-scroll)
  useEffect(() => {
    if (rulerContainerRef.current && rulerContainerRef.current.scrollLeft !== scrollLeft) {
      rulerContainerRef.current.scrollLeft = scrollLeft;
    }
    if (trackContainerRef.current && trackContainerRef.current.scrollLeft !== scrollLeft) {
      trackContainerRef.current.scrollLeft = scrollLeft;
    }
  }, [scrollLeft]);

  // (Auto-scroll timeline during playback has been extracted to PlaybackAutoScroller sub-component)

  // ── Media lookup ────────────────────────────────────────────────────────

  const getMedia = useCallback((clip: TimelineClip): MediaItem | null => {
    return mediaLibrary.find((m) => m.id === clip.mediaId) ?? null;
  }, [mediaLibrary]);

  const getMediaSafe = useCallback(
    (clip: TimelineClip) => {
      return getMedia(clip) ?? ({ name: 'Unknown', type: 'video' as const, duration: 30, url: '' } as MediaItem);
    },
    [getMedia],
  );

  // ── Track from mouse Y ─────────────────────────────────────────────────

    const getTrackFromMouseY = useCallback(
    (clientY: number): TimelineTrack | null => {
      const container = trackContainerRef.current;
      if (!container) return null;
      const rect = container.getBoundingClientRect();
      const relY = clientY - rect.top + container.scrollTop;
      const idx = getTrackAtY(tracks, relY, hoveredOverLayerRegion, pinnedOverLayerTrackId);
      return idx >= 0 && idx < tracks.length ? tracks[idx] : null;
    },
    [tracks, hoveredOverLayerRegion, pinnedOverLayerTrackId],
  );

  // ── Snap helper (clip edges + playhead) ─────────────────────────────────

  const computeSnap = useCallback(
    (rawTime: number, movingClipId: string, movingDuration: number) => {
      if (!settings.snapEnabled) {
        return { snappedTime: rawTime, snapPos: null };
      }
      const threshold = SNAP_THRESHOLD_PX / zoomLevel;

      // Collect snap targets: all other clip edges + the playhead
      const targets: number[] = [useEditorStore.getState().currentTime]; // ★ snap to playhead
      for (const track of tracks) {
        for (const clip of track.clips) {
          if (clip.id === movingClipId) continue;
          targets.push(clip.startTime);
          targets.push(clip.startTime + clip.duration);
        }
        if (track.overLayers) {
          for (const ol of track.overLayers) {
            if (ol.id === movingClipId) continue;
            targets.push(ol.startTime);
            targets.push(ol.startTime + ol.duration);
          }
        }
      }

      // Test both the leading and trailing edges of the moving clip
      const edges = [rawTime, rawTime + movingDuration];

      let bestDelta = Infinity;
      let snappedTime = rawTime;
      let snapPos: number | null = null;

      for (const edge of edges) {
        for (const target of targets) {
          const delta = Math.abs(edge - target);
          if (delta < threshold && delta < bestDelta) {
            bestDelta = delta;
            // Offset so that the appropriate edge aligns with the target
            snappedTime = rawTime + (target - edge);
            snapPos = target * zoomLevel;
          }
        }
      }

      return { snappedTime: Math.max(0, snappedTime), snapPos };
    },
    [zoomLevel, tracks, settings.snapEnabled],
  );

  const updateDragPosition = useCallback((clientX: number, clientY: number, currScrollLeft: number) => {
    if (!dragState || !dragState.draggedClips || dragState.draggedClips.length === 0) return;

    const dx = (clientX - dragState.startX) + (currScrollLeft - dragState.originalScrollLeft);
    const dt = dx / zoomLevel;
    let newTime = Math.max(0, dragState.originalStartTime + dt);

    const hoverTrack = getTrackFromMouseY(clientY);
    const targetTrackId =
      hoverTrack && hoverTrack.type === dragState.trackType ? hoverTrack.id : dragState.trackId;

    const movingClip = tracks.flatMap((t) => t.clips).find((c) => c.id === dragState.clipId);
    const movingDuration = movingClip?.duration ?? 0;

    const { snappedTime, snapPos } = computeSnap(newTime, dragState.clipId, movingDuration);
    newTime = snappedTime;
    setSnapLine(snapPos);

    const finalDt = newTime - dragState.originalStartTime;

    if (dragState.draggedClips.length > 1) {
      setDragPreview(0, null);

      const sourceTrackIdx = tracks.findIndex((t) => t.id === dragState.trackId);
      const targetTrackIdx = tracks.findIndex((t) => t.id === targetTrackId);
      const trackDelta = targetTrackIdx - sourceTrackIdx;

      const updates = dragState.draggedClips.map((c) => {
        const clipNewTime = Math.max(0, c.originalStartTime + finalDt);
        
        const clipTrackIdx = tracks.findIndex((t) => t.id === c.trackId);
        const newTrackIdx = clipTrackIdx + trackDelta;
        const originalTrack = tracks.find((t) => t.id === c.trackId);
        const targetTrack = tracks[newTrackIdx];

        const targetTrackIdForClip =
          targetTrack && originalTrack && targetTrack.type === originalTrack.type
            ? targetTrack.id
            : c.trackId;

        return {
          clipId: c.id,
          newStartTime: clipNewTime,
          newTrackId: targetTrackIdForClip,
        };
      });

      // Filter out duplicate clip updates to prevent ghost clips
      const seen = new Set<string>();
      const uniqueUpdates = updates.filter((u) => {
        if (seen.has(u.clipId)) return false;
        seen.add(u.clipId);
        return true;
      });

      moveClips(uniqueUpdates);
    } else if (dragState.draggedClips.length === 1) {
      setDragPreview(newTime, targetTrackId);
      moveClip(dragState.clipId, newTime, targetTrackId);
    }
  }, [dragState, tracks, zoomLevel, getTrackFromMouseY, computeSnap, moveClips, moveClip, setDragPreview]);

  const updateDragPositionRef = useRef(updateDragPosition);
  useEffect(() => {
    updateDragPositionRef.current = updateDragPosition;
  }, [updateDragPosition]);

  // Auto-scroll loop when dragging
  useEffect(() => {
    if (!dragState) {
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
        scrollIntervalRef.current = null;
      }
      dragMouseXRef.current = null;
      dragMouseYRef.current = null;
      return;
    }

    const checkScroll = () => {
      const container = trackContainerRef.current;
      if (!container || dragMouseXRef.current === null || dragMouseYRef.current === null) return;

      const rect = container.getBoundingClientRect();
      const mouseX = dragMouseXRef.current;
      const mouseY = dragMouseYRef.current;

      const scrollSpeed = 8; // pixels per tick
      const edgeThreshold = 40; // distance from edge in pixels
      let scrolled = false;
      let nextScrollLeft = container.scrollLeft;

      if (mouseX > rect.right - edgeThreshold) {
        nextScrollLeft = Math.min(
          container.scrollWidth - container.clientWidth,
          container.scrollLeft + scrollSpeed
        );
        if (nextScrollLeft !== container.scrollLeft) {
          container.scrollLeft = nextScrollLeft;
          scrolled = true;
        }
      } else if (mouseX < rect.left + edgeThreshold) {
        nextScrollLeft = Math.max(0, container.scrollLeft - scrollSpeed);
        if (nextScrollLeft !== container.scrollLeft) {
          container.scrollLeft = nextScrollLeft;
          scrolled = true;
        }
      }

      if (scrolled) {
        updateDragPositionRef.current(mouseX, mouseY, nextScrollLeft);
      }
    };

    scrollIntervalRef.current = setInterval(checkScroll, 16);

    return () => {
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
        scrollIntervalRef.current = null;
      }
    };
  }, [dragState]);

  // ── Timeline / ruler click (scrub) ──────────────────────────────────────

  const handleTimelineClick = useCallback(
    (e: React.MouseEvent) => {
      if (activeTool === 'split') return;
      // Clicked timeline background -> deselect everything
      const hasSelection = selectedClipId !== null || 
                          selectedClipIds.length > 0 || 
                          selectedTransitionClipId !== null || 
                          selectedTrackId !== null;
      selectClip(null);
      selectTransition(null);
      selectTrack(null);
      if (hasSelection) {
        toast.info("Deselected all clips. Press Ctrl+Z to undo edits.", { duration: 2000 });
      }

      const rect = trackContainerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const scroll = trackContainerRef.current?.scrollLeft || 0;
      const x = e.clientX - rect.left + scroll;
      seek(Math.max(0, x / zoomLevel));
    },
    [activeTool, zoomLevel, seek, selectClip, selectTransition, selectTrack, selectedClipId, selectedClipIds, selectedTransitionClipId, selectedTrackId],
  );

  const handleRulerMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      setIsScrubbing(true);

      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = e.clientX - rect.left + scrollLeft;
      const time = Math.max(0, x / zoomLevel);
      
      setScrubTime(time);
      setScrubMouseX(e.clientX);
      seek(time);

      e.preventDefault();
      e.stopPropagation();
    },
    [scrollLeft, zoomLevel, seek],
  );

  // ── Split helper ────────────────────────────────────────────────────────

  const handleSplit = useCallback(
    (clipId: string) => {
      splitClip(clipId, useEditorStore.getState().currentTime);
    },
    [splitClip],
  );

  // ── Clip drag / resize mousedown ────────────────────────────────────────

  const startResize = useCallback(
    (e: React.MouseEvent, clip: TimelineClip, edge: 'left' | 'right') => {
      e.stopPropagation();
      e.preventDefault();
      const track = tracks.find((t) => t.id === clip.trackId);
      if (track?.locked) return;
      
      useEditorStore.getState().startTransaction();

      let rippleClips: { id: string; originalStartTime: number }[] = [];
      if ((activeTool === 'ripple' || activeTool === 'rateStretch') && track) {
        rippleClips = track.clips
          .filter((c) => c.id !== clip.id && c.startTime >= clip.startTime)
          .map((c) => ({ id: c.id, originalStartTime: c.startTime }));
      }

      let sibling: any = undefined;
      if (clip.splitGroupId && track) {
        const siblingClips = track.clips
          .filter((c) => c.id !== clip.id && c.splitGroupId === clip.splitGroupId)
          .sort((a, b) => a.trimStart - b.trimStart);
        if (edge === 'left') {
          const prev = siblingClips.reverse().find((c) => c.trimStart + c.duration <= clip.trimStart + 0.001);
          if (prev) {
            sibling = {
              id: prev.id,
              originalTrimStart: prev.trimStart,
              originalTrimEnd: prev.trimEnd,
              originalDuration: prev.duration,
              originalStartTime: prev.startTime,
              speed: prev.speed,
            };
          }
        } else {
          const next = siblingClips.find((c) => c.trimStart >= clip.trimStart + clip.duration - 0.001);
          if (next) {
            sibling = {
              id: next.id,
              originalTrimStart: next.trimStart,
              originalTrimEnd: next.trimEnd,
              originalDuration: next.duration,
              originalStartTime: next.startTime,
              speed: next.speed,
            };
          }
        }
      }

      setResizeState({
        clipId: clip.id,
        edge,
        startX: e.clientX,
        originalDuration: clip.duration,
        originalTrimStart: clip.trimStart,
        originalTrimEnd: clip.trimEnd,
        originalStartTime: clip.startTime,
        originalSpeed: clip.speed,
        siblingClip: sibling,
        rippleClips,
      });
    },
    [tracks, activeTool],
  );

  // ── Clip drag / resize mousedown ────────────────────────────────────────

  const handleClipMouseDown = useCallback(
    (e: React.MouseEvent, clip: TimelineClip) => {
      if (e.button !== 0) return;
      const track = tracks.find((t) => t.id === clip.trackId);
      if (track?.locked) return;

      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const relX = e.clientX - rect.left;

      // Left resize handle
      if (relX < 6) {
        startTransactionSafe();
        startResize(e, clip, 'left');
        return;
      }

      // Right resize handle
      if (relX > rect.width - 6) {
        startTransactionSafe();
        startResize(e, clip, 'right');
        return;
      }

      // Track Select Forward Tool
      if (activeTool === 'trackSelect') {
        const clickTime = clip.startTime + relX / zoomLevel;
        let matchingIds: string[] = [];
        if (e.shiftKey) {
          if (track) {
            matchingIds = track.clips
              .filter((c) => c.startTime >= clickTime)
              .map((c) => c.id);
          }
        } else {
          matchingIds = tracks
            .flatMap((t) => t.clips)
            .filter((c) => c.startTime >= clickTime)
            .map((c) => c.id);
        }

        selectClips(matchingIds);

        const draggedClips = matchingIds.map((id) => {
          const c = tracks.flatMap((t) => t.clips).find((x) => x.id === id);
          return { id, originalStartTime: c?.startTime || 0, trackId: c?.trackId || '' };
        });

        setDragState({
          clipId: clip.id,
          startX: e.clientX,
          startY: e.clientY,
          originalStartTime: clip.startTime,
          originalScrollLeft: scrollLeft,
          trackId: clip.trackId,
          trackType: track?.type || 'video',
          draggedClips,
        });

        e.stopPropagation();
        return;
      }

      // Track Select Backward Tool
      if (activeTool === 'trackSelectBackward') {
        const clickTime = clip.startTime + relX / zoomLevel;
        let matchingIds: string[] = [];
        if (e.shiftKey) {
          if (track) {
            matchingIds = track.clips
              .filter((c) => c.startTime <= clickTime)
              .map((c) => c.id);
          }
        } else {
          matchingIds = tracks
            .flatMap((t) => t.clips)
            .filter((c) => c.startTime <= clickTime)
            .map((c) => c.id);
        }

        selectClips(matchingIds);

        const draggedClips = matchingIds.map((id) => {
          const c = tracks.flatMap((t) => t.clips).find((x) => x.id === id);
          return { id, originalStartTime: c?.startTime || 0, trackId: c?.trackId || '' };
        });

        setDragState({
          clipId: clip.id,
          startX: e.clientX,
          startY: e.clientY,
          originalStartTime: clip.startTime,
          originalScrollLeft: scrollLeft,
          trackId: clip.trackId,
          trackType: track?.type || 'video',
          draggedClips,
        });

        e.stopPropagation();
        return;
      }

      // Split tool
      if (activeTool === 'split') {
        const clickTime = clip.startTime + relX / zoomLevel;
        splitClip(clip.id, clickTime);
        return;
      }

      // Normal drag (Select tool or default)
      let currentSelectedIds = selectedClipIds;
      if (e.ctrlKey || e.metaKey) {
        const isAlreadySel = selectedClipIds.includes(clip.id);
        currentSelectedIds = isAlreadySel
          ? selectedClipIds.filter((id) => id !== clip.id)
          : [...selectedClipIds, clip.id];
        selectClips(currentSelectedIds);
      } else {
        const isAlreadySelected = selectedClipIds.includes(clip.id);
        if (!isAlreadySelected) {
          selectClip(clip.id);
          currentSelectedIds = [clip.id];
        }
      }

      // Populate draggedClips from the final list of selected IDs (only if clicked clip is selected)
      let draggedClips: { id: string; originalStartTime: number; trackId: string }[] = [];
      if (currentSelectedIds.includes(clip.id)) {
        draggedClips = currentSelectedIds.map((id) => {
          const c = tracks.flatMap((t) => t.clips).find((x) => x.id === id);
          return { id, originalStartTime: c?.startTime || 0, trackId: c?.trackId || '' };
        });
      }

      startTransactionSafe();
      setDragState({
        clipId: clip.id,
        startX: e.clientX,
        startY: e.clientY,
        originalStartTime: clip.startTime,
        originalScrollLeft: scrollLeft,
        trackId: clip.trackId,
        trackType: track?.type || 'video',
        draggedClips,
      });

      e.stopPropagation();
    },
    [tracks, activeTool, splitClip, zoomLevel, selectClip, selectClips, selectedClipIds, scrollLeft],
  );

  // ── Global mouse move / up for drag & resize ───────────────────────────

  const handleMouseMove = (e: MouseEvent) => {
    // ─ Playhead scrubbing ──────────────────────────────────────────
    if (isScrubbing) {
      if (scrubRafIdRef.current !== null) {
        cancelAnimationFrame(scrubRafIdRef.current);
      }
      const clientX = e.clientX;
      scrubRafIdRef.current = requestAnimationFrame(() => {
        scrubRafIdRef.current = null;
        const rect = trackContainerRef.current?.getBoundingClientRect();
        if (rect) {
          const x = clientX - rect.left + scrollLeft;
          const time = Math.max(0, x / zoomLevel);
          seek(time);
          setScrubTime(time);
          setScrubMouseX(clientX);
        }
      });
    }

    // ─ Clip drag ────────────────────────────────────────────────────
    if (dragState && dragState.draggedClips && dragState.draggedClips.length > 0) {
      dragMouseXRef.current = e.clientX;
      dragMouseYRef.current = e.clientY;
      updateDragPosition(e.clientX, e.clientY, scrollLeft);
    }

    // ─ Over Layer drag ──────────────────────────────────────────────
    if (dragOverLayerState) {
      if (!(window as any).__olDragRaf) {
        (window as any).__olDragRaf = requestAnimationFrame(() => {
          const dx = e.clientX - dragOverLayerState.startX;
          const dt = dx / zoomLevel;
          let newStartTime = Math.max(0, dragOverLayerState.originalStartTime + dt);
          
          // Apply snapping
          const track = tracks.find((t) => t.id === dragOverLayerState.trackId);
          const ol = track?.overLayers?.find(o => o.id === dragOverLayerState.overLayerId);
          if (ol) {
            const { snappedTime, snapPos } = computeSnap(newStartTime, ol.id, ol.duration);
            newStartTime = snappedTime;
            setSnapLine(snapPos);
          }
          
          moveOverLayer(dragOverLayerState.overLayerId, newStartTime);

          // Vertical row swapping reordering
          const trackEl = document.querySelector(`[data-track-id="${dragOverLayerState.trackId}"]`);
          if (track && track.overLayers && trackEl && hoveredOverLayerRegion) {
            const trackRect = trackEl.getBoundingClientRect();
            const relY = e.clientY - trackRect.top - DEFAULT_TRACK_HEIGHT;
            const targetRowIdx = Math.max(0, Math.floor(relY / OVER_LAYER_ROW_HEIGHT));
            reorderOverLayer(dragOverLayerState.overLayerId, targetRowIdx);
          }
          (window as any).__olDragRaf = null;
        });
      }
    }

    // ─ Over Layer resize ────────────────────────────────────────────
    if (resizeOverLayerState) {
      const dx = e.clientX - resizeOverLayerState.startX;
      const dt = dx / zoomLevel;
      
      const track = tracks.find((t) => (t.overLayers || []).some((ol) => ol.id === resizeOverLayerState.overLayerId));
      const ol = track?.overLayers.find((ol) => ol.id === resizeOverLayerState.overLayerId);
      if (ol) {
        if (resizeOverLayerState.edge === 'right') {
          const newDuration = Math.max(0.1, resizeOverLayerState.originalDuration + dt);
          updateOverLayer(ol.id, { duration: newDuration });
        } else {
          const newStartTime = Math.max(0, resizeOverLayerState.originalStartTime + dt);
          const delta = newStartTime - resizeOverLayerState.originalStartTime;
          const newDuration = Math.max(0.1, resizeOverLayerState.originalDuration - delta);
          if (newDuration > 0.1) {
            updateOverLayer(ol.id, { startTime: newStartTime, duration: newDuration });
          }
        }
      }
    }

    // ─ Clip resize ──────────────────────────────────────────────────
    if (resizeState) {
      const dx = e.clientX - resizeState.startX;
      const dt = dx / zoomLevel;
      const clip = tracks.flatMap((t) => t.clips).find((c) => c.id === resizeState.clipId);
      if (!clip) return;

      const media = getMediaSafe(clip);
      const sourceDuration = media.duration || 30;

      if (activeTool === 'rateStretch') {
        const originalSpeed = resizeState.originalSpeed || 1.0;
        const sourceContentDuration = resizeState.originalDuration * originalSpeed;

        if (resizeState.edge === 'right') {
          const newDuration = Math.max(0.1, resizeState.originalDuration + dt);
          const newSpeed = sourceContentDuration / newDuration;
          const clampedSpeed = Math.min(20, Math.max(0.1, newSpeed));
          const clampedDuration = sourceContentDuration / clampedSpeed;
          const delta = clampedDuration - resizeState.originalDuration;

          updateClip(resizeState.clipId, {
            duration: clampedDuration,
            speed: clampedSpeed,
            trimStart: resizeState.originalTrimStart,
            trimEnd: resizeState.originalTrimEnd,
          });

          if (resizeState.rippleClips) {
            resizeState.rippleClips.forEach((c) => {
              updateClip(c.id, {
                startTime: c.originalStartTime + delta,
              });
            });
          }
        } else {
          const shrink = -dt;
          const newDuration = Math.max(0.1, resizeState.originalDuration + shrink);
          const newSpeed = sourceContentDuration / newDuration;
          const clampedSpeed = Math.min(20, Math.max(0.1, newSpeed));
          let clampedDuration = sourceContentDuration / clampedSpeed;
          let shift = resizeState.originalDuration - clampedDuration;
          shift = Math.max(-resizeState.originalStartTime, shift);
          clampedDuration = resizeState.originalDuration - shift;
          const finalSpeed = Math.min(20, Math.max(0.1, sourceContentDuration / clampedDuration));

          updateClip(resizeState.clipId, {
            startTime: resizeState.originalStartTime + shift,
            duration: clampedDuration,
            speed: finalSpeed,
            trimStart: resizeState.originalTrimStart,
            trimEnd: resizeState.originalTrimEnd,
          });

          if (resizeState.rippleClips) {
            resizeState.rippleClips.forEach((c) => {
              updateClip(c.id, {
                startTime: c.originalStartTime + shift,
              });
            });
          }
        }
        return;
      }

      if (activeTool === 'ripple') {
        if (resizeState.edge === 'right') {
          const newDuration = Math.max(0.1, resizeState.originalDuration + dt);
          const maxDuration = (sourceDuration - clip.trimStart) / clip.speed;
          const clamped = Math.min(newDuration, maxDuration);
          const delta = clamped - resizeState.originalDuration;

          const newTrimEnd = resizeState.originalTrimEnd + (resizeState.originalDuration - clamped) * clip.speed;
          updateClip(resizeState.clipId, {
            duration: clamped,
            trimEnd: Math.max(0, newTrimEnd),
          });

          if (resizeState.rippleClips) {
            resizeState.rippleClips.forEach((c) => {
              updateClip(c.id, {
                startTime: c.originalStartTime + delta,
              });
            });
          }
        } else {
          const shrink = -dt;
          const newDuration = Math.max(0.1, resizeState.originalDuration + shrink);
          const maxDuration = (sourceDuration - clip.trimEnd) / clip.speed;
          let clamped = Math.min(newDuration, maxDuration);
          let shift = resizeState.originalDuration - clamped;
          shift = Math.max(-resizeState.originalStartTime, shift);
          clamped = resizeState.originalDuration - shift;

          updateClip(resizeState.clipId, {
            startTime: resizeState.originalStartTime + shift,
            duration: clamped,
            trimStart: Math.max(0, resizeState.originalTrimStart + shift * clip.speed),
          });

          if (resizeState.rippleClips) {
            resizeState.rippleClips.forEach((c) => {
              updateClip(c.id, {
                startTime: c.originalStartTime + shift,
              });
            });
          }
        }
        return;
      }

      if (resizeState.edge === 'right') {
        let newDuration = Math.max(0.1, resizeState.originalDuration + dt);
        const maxDuration = (sourceDuration - clip.trimStart) / clip.speed;
        let clamped = Math.min(newDuration, maxDuration);

        if (resizeState.siblingClip) {
          const sib = resizeState.siblingClip;
          const newAEnd = clip.trimStart + clamped * clip.speed;
          if (newAEnd > sib.originalTrimStart) {
            let deltaSource = newAEnd - sib.originalTrimStart;
            let delta = deltaSource / sib.speed;
            
            // Clamp so sibling duration doesn't shrink below 0.1s
            const maxDelta = sib.originalDuration - 0.1;
            if (delta > maxDelta) {
              delta = Math.max(0, maxDelta);
              deltaSource = delta * sib.speed;
              clamped = (sib.originalTrimStart + deltaSource - clip.trimStart) / clip.speed;
            }

            // Update sibling boundary in tandem
            updateClip(sib.id, {
              trimStart: sib.originalTrimStart + deltaSource,
              duration: sib.originalDuration - delta,
              startTime: sib.originalStartTime + delta,
            });
          } else {
            // Restore sibling state if user dragged back
            updateClip(sib.id, {
              trimStart: sib.originalTrimStart,
              duration: sib.originalDuration,
              startTime: sib.originalStartTime,
            });
          }
        }

        const newTrimEnd = resizeState.originalTrimEnd + (resizeState.originalDuration - clamped) * clip.speed;
        updateClip(resizeState.clipId, {
          duration: clamped,
          trimEnd: Math.max(0, newTrimEnd),
        });
      } else {
        const shrink = -dt;
        const newDuration = Math.max(0.1, resizeState.originalDuration + shrink);
        const maxDuration = (sourceDuration - clip.trimEnd) / clip.speed;
        let clamped = Math.min(newDuration, maxDuration);
        let shift = resizeState.originalDuration - clamped;

        if (resizeState.siblingClip) {
          const sib = resizeState.siblingClip;
          const newBStart = resizeState.originalTrimStart + shift * clip.speed;
          if (newBStart < sib.originalTrimStart + sib.originalDuration * sib.speed) {
            let deltaSource = (sib.originalTrimStart + sib.originalDuration * sib.speed) - newBStart;
            let delta = deltaSource / sib.speed;
            
            // Clamp so sibling duration doesn't shrink below 0.1s
            const maxDelta = sib.originalDuration - 0.1;
            if (delta > maxDelta) {
              delta = Math.max(0, maxDelta);
              deltaSource = delta * sib.speed;
              const allowedNewBStart = sib.originalTrimStart + sib.originalDuration * sib.speed - deltaSource;
              shift = (allowedNewBStart - resizeState.originalTrimStart) / clip.speed;
              clamped = resizeState.originalDuration - shift;
            }

            // Update sibling boundary in tandem
            updateClip(sib.id, {
              trimEnd: sib.originalTrimEnd + deltaSource,
              duration: sib.originalDuration - delta,
            });
          } else {
            // Restore sibling state if user dragged back
            updateClip(sib.id, {
              trimEnd: sib.originalTrimEnd,
              duration: sib.originalDuration,
            });
          }
        }

        updateClip(resizeState.clipId, {
          startTime: resizeState.originalStartTime + shift,
          duration: clamped,
          trimStart: Math.max(0, resizeState.originalTrimStart + shift * clip.speed),
        });
      }
    }
  };

  const handleMouseUp = () => {
    if (scrubRafIdRef.current !== null) {
      cancelAnimationFrame(scrubRafIdRef.current);
      scrubRafIdRef.current = null;
    }
    if (isScrubbing) {
      setIsScrubbing(false);
      setScrubTime(null);
    }
    if (dragState) {
      const draggedIds = dragState.draggedClips?.map((c) => c.id) || [];
      if (draggedIds.length > 0) {
        useEditorStore.getState().resolveOverlaps(draggedIds);
      }
      setDragState(null);
      setSnapLine(null);
      setDropPreview(null);
      endTransactionSafe(); // commit final snapshot
    }
    if (resizeState) {
      setResizeState(null);
      endTransactionSafe(); // commit final snapshot
    }
    if (dragOverLayerState) {
      if ((window as any).__olDragRaf) {
        cancelAnimationFrame((window as any).__olDragRaf);
        (window as any).__olDragRaf = null;
      }
      setSnapLine(null);
      setDragOverLayerState(null);
      endTransactionSafe(); // commit final snapshot
    }
    if (resizeOverLayerState) {
      setResizeOverLayerState(null);
      endTransactionSafe(); // commit final snapshot
    }
  };

  handleMouseMoveRef.current = handleMouseMove;
  handleMouseUpRef.current = handleMouseUp;

  const isDragging = dragState !== null || resizeState !== null || isScrubbing || dragOverLayerState !== null || resizeOverLayerState !== null;

  useEffect(() => {
    if (!isDragging) return;

    const onMouseMove = (e: MouseEvent) => {
      handleMouseMoveRef.current?.(e);
    };
    const onMouseUp = () => {
      handleMouseUpRef.current?.();
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDragging]);

  // ── Drop from media panel ───────────────────────────────────────────────

  const handleDrop = useCallback(
    (e: React.DragEvent, trackId: string) => {
      e.preventDefault();
      const track = useEditorStore.getState().tracks.find((t) => t.id === trackId);
      if (!track) return;

      // ── Transition drop → apply to video/image clip at drop position ──
      const transitionName = e.dataTransfer.getData('application/procut-transition');
      if (transitionName && track && track.type === 'video') {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const x = e.clientX - rect.left;
        const dropTime = x / zoomLevel;
        // Find the clip at the drop position
        const hitClip = track.clips.find(
          (c) => dropTime >= c.startTime && dropTime < c.startTime + c.duration
        );
        if (hitClip) {
          const type = transitionName.toLowerCase().includes('dissolve') ? 'dissolve'
                     : transitionName.toLowerCase().includes('wipe') ? 'wipe'
                     : transitionName.toLowerCase().includes('zoom') ? 'zoom'
                     : transitionName.toLowerCase().includes('slide') ? 'slide'
                     : 'dissolve';
          useEditorStore.getState().updateClip(hitClip.id, {
            transitionIn: {
              id: Math.random().toString(36).substr(2, 9),
              name: transitionName,
              type: type as any,
              duration: 1.0,
              params: {},
            },
          });
          useEditorStore.getState().saveSnapshot();
        }
        setHoveredTrackId(null);
        setDropPreview(null);
        return;
      }

      // ── Color Correction Preset drop → apply to video/image clip/overlayer at drop position ──
      const colorPresetRaw = e.dataTransfer.getData('application/procut-color-preset');
      if (colorPresetRaw && track && (track.type === 'video' || track.type === 'audio')) {
        try {
          const preset = JSON.parse(colorPresetRaw) as Record<string, number>;
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          const dropTime = x / zoomLevel;
          
          const baseHeight = DEFAULT_TRACK_HEIGHT;
          const isOverLayerArea = y > baseHeight;
          let targetOl: OverLayerClip | null = null;
          if (isOverLayerArea && hoveredOverLayerRegion && hoveredOverLayerRegion.trackId === trackId) {
            const activeOverLayers = (track.overLayers || []).filter((ol) => {
              return ol.startTime < hoveredOverLayerRegion.endTime && ol.startTime + ol.duration > hoveredOverLayerRegion.startTime;
            });
            const rowIdx = Math.floor((y - baseHeight) / OVER_LAYER_ROW_HEIGHT);
            targetOl = activeOverLayers[rowIdx] || null;
          }

          if (targetOl) {
            const existing = targetOl.colorFilters ?? {
              temperature: 0, tint: 0, exposure: 0, contrast: 100,
              saturation: 100, blur: 0, fadedFilm: 0, vignette: 0,
            };
            useEditorStore.getState().updateOverLayer(targetOl.id, {
              colorFilters: { ...existing, ...preset },
            });
            useEditorStore.getState().saveSnapshot();
          } else {
            const hitClip = track.clips.find(
              (c) => dropTime >= c.startTime && dropTime < c.startTime + c.duration
            );
            if (hitClip) {
              const existing = hitClip.colorFilters ?? {
                temperature: 0, tint: 0, exposure: 0, contrast: 100,
                saturation: 100, blur: 0, fadedFilm: 0, vignette: 0,
              };
              useEditorStore.getState().updateClip(hitClip.id, {
                colorFilters: { ...existing, ...preset },
              });
              useEditorStore.getState().saveSnapshot();
            }
          }
        } catch { /* ignore parse errors */ }
        setHoveredTrackId(null);
        setDropPreview(null);
        return;
      }

      // ── Particle effect drop → apply to video/image clip/overlayer at drop position ──
      const particleType = e.dataTransfer.getData('application/procut-particle');
      if (particleType && track && (track.type === 'video')) {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const dropTime = x / zoomLevel;

        const baseHeight = DEFAULT_TRACK_HEIGHT;
        const isOverLayerArea = y > baseHeight;
        let targetOl: OverLayerClip | null = null;
        if (isOverLayerArea && hoveredOverLayerRegion && hoveredOverLayerRegion.trackId === trackId) {
          const activeOverLayers = (track.overLayers || []).filter((ol) => {
            return ol.startTime < hoveredOverLayerRegion.endTime && ol.startTime + ol.duration > hoveredOverLayerRegion.startTime;
          });
          const rowIdx = Math.floor((y - baseHeight) / OVER_LAYER_ROW_HEIGHT);
          targetOl = activeOverLayers[rowIdx] || null;
        }

        const PARTICLE_DEFAULTS: Record<string, Omit<import('@/types').ClipParticleSettings, 'type'|'emitterX'|'emitterY'>> = {
          snow:      { amount: 120, speed: 40,  intensity: 80, size: 100, gravity: 20,  wind: 5,  spread: 180, lifetime: 150, color: '#ffffff', colorVariance: 15, glow: false, turbulence: 20 },
          rain:      { amount: 200, speed: 160, intensity: 70, size: 100, gravity: 100, wind: 15, spread: 10,  lifetime: 60,  color: '#a0c8ff', colorVariance: 10, glow: false, turbulence: 5  },
          fire:      { amount: 80,  speed: 80,  intensity: 90, size: 130, gravity: -60, wind: 0,  spread: 60,  lifetime: 80,  color: '#ff6a00', colorVariance: 60, glow: true,  turbulence: 60 },
          sparkles:  { amount: 60,  speed: 50,  intensity: 85, size: 80,  gravity: -10, wind: 0,  spread: 360, lifetime: 100, color: '#ffd700', colorVariance: 30, glow: true,  turbulence: 30 },
          confetti:  { amount: 100, speed: 60,  intensity: 90, size: 100, gravity: 40,  wind: 10, spread: 90,  lifetime: 200, color: 'auto',    colorVariance: 100, glow: false, turbulence: 40 },
          smoke:     { amount: 30,  speed: 25,  intensity: 60, size: 200, gravity: -30, wind: 8,  spread: 30,  lifetime: 200, color: '#888888', colorVariance: 20, glow: false, turbulence: 70 },
          bubbles:   { amount: 40,  speed: 30,  intensity: 70, size: 120, gravity: -40, wind: 5,  spread: 60,  lifetime: 180, color: '#80ffff', colorVariance: 20, glow: true,  turbulence: 15 },
          leaves:    { amount: 50,  speed: 35,  intensity: 80, size: 110, gravity: 30,  wind: 20, spread: 45,  lifetime: 180, color: '#ff7b00', colorVariance: 70, glow: false, turbulence: 50 },
          hearts:    { amount: 30,  speed: 25,  intensity: 85, size: 100, gravity: -20, wind: 5,  spread: 40,  lifetime: 200, color: '#ff4d88', colorVariance: 25, glow: true,  turbulence: 20 },
          matrix:    { amount: 40,  speed: 80,  intensity: 90, size: 100, gravity: 80,  wind: 0,  spread: 0,   lifetime: 120, color: '#00ff41', colorVariance: 10, glow: true,  turbulence: 0  },
        };
        const defaults = PARTICLE_DEFAULTS[particleType] ?? PARTICLE_DEFAULTS.sparkles;

        if (targetOl) {
          useEditorStore.getState().updateOverLayer(targetOl.id, {
            particleSettings: {
              type: particleType as import('@/types').ParticleEffectType,
              emitterX: 50,
              emitterY: 100,
              ...defaults,
            },
          });
          useEditorStore.getState().selectOverLayer(targetOl.id);
          useEditorStore.getState().saveSnapshot();
        } else {
          const hitClip = track.clips.find(
            (c) => dropTime >= c.startTime && dropTime < c.startTime + c.duration
          );
          if (hitClip) {
            useEditorStore.getState().updateClip(hitClip.id, {
              particleSettings: {
                type: particleType as import('@/types').ParticleEffectType,
                emitterX: 50,
                emitterY: 100,
                ...defaults,
              },
            });
            useEditorStore.getState().selectClip(hitClip.id);
            useEditorStore.getState().saveSnapshot();
          }
        }
        setHoveredTrackId(null);
        setDropPreview(null);
        return;
      }

      // ── Animated Title Template drop → create text clip on text track ──
      const templateId = e.dataTransfer.getData('application/procut-template');
      if (templateId) {
        const tmpl = TITLE_TEMPLATES.find((t) => t.id === templateId);
        if (tmpl && track) {
          // If the dropped track is not text, find or create a text track
          let targetTrack = track;
          if (track.type !== 'text') {
            const existingTextTrack = useEditorStore.getState().tracks.find((t) => t.type === 'text');
            if (existingTextTrack) {
              targetTrack = existingTextTrack;
            } else {
              useEditorStore.getState().addTrack('text');
              targetTrack = useEditorStore.getState().tracks.find((t) => t.type === 'text') || track;
            }
          }
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          const x = e.clientX - rect.left;
          const startTime = Math.max(0, (x + scrollLeft) / zoomLevel);
          const mediaId = `tmpl_media_${Math.random().toString(36).substr(2, 9)}`;
          const clipId  = `tmpl_clip_${Math.random().toString(36).substr(2, 9)}`;
          useEditorStore.getState().addMedia({
            id: mediaId,
            name: tmpl.name,
            type: 'text',
            duration: tmpl.defaultDuration,
            url: '',
            createdAt: Date.now(),
          });
          useEditorStore.getState().addClip({
            id: clipId,
            mediaId,
            trackId: targetTrack.id,
            startTime,
            duration: tmpl.defaultDuration,
            trimStart: 0,
            trimEnd: 0,
            transform: { x: 0, y: 0, scale: 100, rotation: 0 },
            opacity: 1,
            speed: 1,
            effects: [],
            textSettings: { ...tmpl.textSettings },
            animations: tmpl.animations ? { ...tmpl.animations } : undefined,
          } as any);
          useEditorStore.getState().selectClip(clipId);
          useEditorStore.getState().saveSnapshot();
        }
        setHoveredTrackId(null);
        setDropPreview(null);
        return;
      }

      const effectName = e.dataTransfer.getData('application/procut-effect');
      if (effectName && track?.type === 'fx') {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const x = e.clientX - rect.left;
        const startTime = Math.max(0, x / zoomLevel);

        // Map display names → canonical fxType keys used by PreviewCanvas
        const FX_TYPE_MAP: Record<string, string> = {
          'VFX Breakdown':     'vfx_breakdown',
          'B&W to Color':      'bw_to_color',
          'Glitch':            'glitch',
          'Old Film':          'old_film',
          'VHS':               'vhs',
          'Cinematic Bars':    'cinematic_bars',
          'Neon Glow':         'neon_glow',
          'RGB Split':         'rgb_split',
          'Pixelate':          'pixelate',
          'Mirror':            'mirror',
          'Zoom Blur':         'zoom_blur',
          'Lens Flare':        'lens_flare',
          'Night Vision':      'night_vision',
          'Thermal':           'thermal',
        };
        const fxType = FX_TYPE_MAP[effectName] ?? effectName.toLowerCase().replace(/[^a-z0-9]/g, '_');
        const fxMediaId = generateId();
        useEditorStore.getState().addMedia({
          id: fxMediaId,
          name: effectName,
          type: 'fx',
          duration: 5,
          url: '',
          createdAt: Date.now(),
          fxType,
        });
        const fxClip: TimelineClip = {
          id: generateId(),
          mediaId: fxMediaId,
          trackId,
          startTime,
          duration: 5,
          trimStart: 0,
          trimEnd: 0,
          transform: { x: 0, y: 0, scale: 100, rotation: 0 },
          opacity: 1,
          speed: 1,
          effects: [],
          fxSettings: {
            type: fxType as any,
            intensity: 100,
          },
        };
        useEditorStore.getState().addClip(fxClip);
        setHoveredTrackId(null);
        setDropPreview(null);
        return;
      }

      const mediaId = e.dataTransfer.getData('application/procut-media');
      if (!mediaId) return;

      const media = useEditorStore.getState().mediaLibrary.find((m) => m.id === mediaId);
      if (!media) return;

      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const startTime = Math.max(0, (x + scrollLeft) / zoomLevel);

      const baseHeight = track.type === 'text' || track.type === 'fx' ? THIN_TRACK_HEIGHT : DEFAULT_TRACK_HEIGHT;
      const isOverLayerArea = y > baseHeight;

      if (isOverLayerArea && hoveredOverLayerRegion && hoveredOverLayerRegion.trackId === trackId) {
        const activeOverLayers = (track.overLayers || []).filter((ol) => {
          return ol.startTime < hoveredOverLayerRegion.endTime && ol.startTime + ol.duration > hoveredOverLayerRegion.startTime;
        });
        
        const rowIdx = Math.floor((y - baseHeight) / OVER_LAYER_ROW_HEIGHT);
        const targetOl = activeOverLayers[rowIdx];
        
        if (targetOl) {
          // Verify media type compatibility
          let compatible = false;
          if (track.type === 'video' && (media.type === 'video' || media.type === 'image')) compatible = true;
          if (track.type === 'audio' && media.type === 'audio') compatible = true;
          if (track.type === 'text' && media.type === 'text') compatible = true;
          if (track.type === 'fx' && media.type === 'fx') compatible = true;
          
          if (compatible) {
            useEditorStore.getState().updateOverLayer(targetOl.id, {
              mediaId,
              duration: media.type === 'image' ? 5 : Math.min(10, media.duration),
              audioSettings: media.type === 'audio' || media.type === 'video' ? {
                volume: 0,
                pan: 0,
                fadeIn: 0,
                fadeOut: 0,
                bass: 0,
                treble: 0,
                muted: false,
                preservePitch: true,
                pitch: 0,
                voiceFormant: 0,
                humanize: false,
              } : undefined,
            });
            useEditorStore.getState().saveSnapshot();
          }
          setHoveredTrackId(null);
          setDropPreview(null);
          return;
        }
      }

      const newClip: TimelineClip = {
        id: generateId(),
        mediaId,
        trackId,
        startTime,
        duration: media.type === 'image' ? 5 : Math.min(10, media.duration),
        trimStart: 0,
        trimEnd: 0,
        transform: { x: 0, y: 0, scale: 100, rotation: 0 },
        opacity: 1,
        speed: 1,
        effects: [],
      };

      useEditorStore.getState().addClip(newClip);
      setHoveredTrackId(null);
      setDropPreview(null);
    },
    [zoomLevel, scrollLeft, hoveredOverLayerRegion],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, trackId: string) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';

      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = e.clientX - rect.left;
      const trackIdx = tracks.findIndex((t) => t.id === trackId);

      // Accept media, FX effect, color preset, and template drops
      const hasMedia = e.dataTransfer.types.includes('application/procut-media');
      const hasEffect = e.dataTransfer.types.includes('application/procut-effect');
      const hasColorPreset = e.dataTransfer.types.includes('application/procut-color-preset');
      const hasParticle = e.dataTransfer.types.includes('application/procut-particle');
      const hasTransition = e.dataTransfer.types.includes('application/procut-transition');
      const hasTemplate = e.dataTransfer.types.includes('application/procut-template');
      if ((hasMedia || hasEffect || hasColorPreset || hasParticle || hasTransition || hasTemplate) && trackIdx >= 0) {
        const approxDuration = (hasColorPreset || hasParticle || hasTransition) ? 0 : 5;
        setDropPreview({ time: x / zoomLevel, duration: approxDuration, trackIdx });
        setHoveredTrackId(trackId);

        // Auto-expand over-layer region during drag-over if matching
        const track = tracks[trackIdx];
        if (track && (track.overLayers || []).length > 0) {
          const time = (x + scrollLeft) / zoomLevel;
          const matchingOl = track.overLayers.find((ol) => {
            return time >= ol.startTime && time < ol.startTime + ol.duration;
          });
          if (matchingOl) {
            setHoveredOverLayerRegion({
              trackId,
              startTime: matchingOl.startTime,
              endTime: matchingOl.startTime + matchingOl.duration,
            });
          } else if (hoveredOverLayerRegion && hoveredOverLayerRegion.trackId === trackId) {
            setHoveredOverLayerRegion(null);
          }
        }
      }
    },
    [tracks, zoomLevel, scrollLeft],
  );

  // ── Native Wheel Events (Gestures) ──────────────────────────────────────

  useEffect(() => {
    const el = trackContainerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        // Pinch-to-zoom
        e.preventDefault();
        const store = useEditorStore.getState();
        const currentZoom = store.zoomLevel;
        const zoomDelta = e.deltaY > 0 ? -10 : 10;
        const newZoom = Math.min(Math.max(currentZoom + zoomDelta, 20), 400);

        const rect = el.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        
        // Calculate the exact time under the mouse cursor right now
        const timeUnderCursor = (store.scrollLeft + mouseX) / currentZoom;
        
        // Calculate the new scrollLeft so that timeUnderCursor stays at mouseX
        const newScrollLeft = Math.max(0, timeUnderCursor * newZoom - mouseX);

        store.setZoomLevel(newZoom);
        store.setScrollLeft(newScrollLeft);
      } else {
        // Two-finger pan / normal wheel scroll
        // Native horizontal/vertical scroll works for most trackpads,
        // but if holding shift or trackpad horizontal dragging occurs, it natively scrolls.
        // We do not preventDefault here to allow native smooth scrolling horizontally.
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  // ── Ruler markers ───────────────────────────────────────────────────────

  const sortedMarkers = useMemo(() => [...markers].sort((a, b) => a.time - b.time), [markers]);

  const rulerData = useMemo(() => {
    const markers: { time: number; label: string; type: 'major' | 'medium' | 'minor' }[] = [];

    let majorInterval = 1.0;
    let mediumInterval = 0.5;
    let minorInterval = 0.1;
    let labelMedium = true;

    if (zoomLevel >= 250) {
      majorInterval = 0.5;
      mediumInterval = 0.1;
      minorInterval = 0.02;
      labelMedium = true;
    } else if (zoomLevel >= 150) {
      majorInterval = 1.0;
      mediumInterval = 0.5;
      minorInterval = 0.1;
      labelMedium = true;
    } else if (zoomLevel >= 80) {
      majorInterval = 2.0;
      mediumInterval = 1.0;
      minorInterval = 0.2;
      labelMedium = true;
    } else if (zoomLevel >= 40) {
      majorInterval = 5.0;
      mediumInterval = 2.5;
      minorInterval = 0.5;
      labelMedium = true;
    } else if (zoomLevel >= 20) {
      majorInterval = 10.0;
      mediumInterval = 5.0;
      minorInterval = 1.0;
      labelMedium = false;
    } else {
      majorInterval = 30.0;
      mediumInterval = 10.0;
      minorInterval = 2.0;
      labelMedium = false;
    }

    const maxTime = totalDuration + 30;

    const minorCentis = Math.round(minorInterval * 100);
    const mediumCentis = Math.round(mediumInterval * 100);
    const majorCentis = Math.round(majorInterval * 100);
    const maxCentis = Math.round(maxTime * 100);

    for (let c = 0; c <= maxCentis; c += minorCentis) {
      const time = c / 100;
      let type: 'major' | 'medium' | 'minor' = 'minor';
      let label = '';

      if (c % majorCentis === 0) {
        type = 'major';
        label = formatCentisecondTime(time);
      } else if (c % mediumCentis === 0) {
        type = 'medium';
        if (labelMedium) {
          label = formatCentisecondTime(time);
        }
      } else {
        type = 'minor';
      }

      markers.push({ time, label, type });
    }

    return markers;
  }, [zoomLevel, totalDuration]);

  // ── Total pixel width of the timeline ───────────────────────────────────

  const timelineWidth = (totalDuration + 30) * zoomLevel;

  // ════════════════════════════════════════════════════════════════════════
  // ── RENDER ──────────────────────────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════════════

  return (
    <>
    <div className="h-full flex flex-col bg-[#1e1e1e] border-t border-[#3e3e3e]" ref={timelineRef}>
      {/* ── Toolbar ──────────────────────────────────────────────────── */}
      <div className="h-8 flex items-center px-2 bg-[#252525] border-b border-[#3e3e3e] shrink-0 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {/* Zoom */}
        <div className="flex items-center gap-1">
          <button
            onClick={zoomOut}
            title="Zoom Out"
            aria-label="Zoom Out"
            className="p-1 text-[#a0a0a0] hover:text-white hover:bg-[#3e3e3e] rounded transition-colors"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] text-[#a0a0a0] w-12 text-center tabular-nums">
            {zoomLevel}px/s
          </span>
          <button
            onClick={zoomIn}
            title="Zoom In"
            aria-label="Zoom In"
            className="p-1 text-[#a0a0a0] hover:text-white hover:bg-[#3e3e3e] rounded transition-colors"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="w-px h-4 bg-[#3e3e3e] mx-2" />

        {/* Add tracks */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => addTrack('video')}
            className="px-2 py-0.5 text-[10px] text-[#a0a0a0] hover:text-white hover:bg-[#3e3e3e] rounded flex items-center gap-1 transition-colors"
          >
            <Film className="w-3 h-3" /> + Video
          </button>
          <button
            onClick={() => addTrack('audio')}
            className="px-2 py-0.5 text-[10px] text-[#a0a0a0] hover:text-white hover:bg-[#3e3e3e] rounded flex items-center gap-1 transition-colors"
          >
            <Music className="w-3 h-3" /> + Audio
          </button>
          <button
            onClick={() => addTrack('text')}
            className="px-2 py-0.5 text-[10px] text-[#a0a0a0] hover:text-white hover:bg-[#3e3e3e] rounded flex items-center gap-1 transition-colors"
          >
            <Plus className="w-3 h-3" /> + Text
          </button>
          <button
            onClick={() => addTrack('fx')}
            className="px-2 py-0.5 text-[10px] text-rose-400/80 hover:text-rose-300 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 rounded flex items-center gap-1 transition-colors"
            title="Add FX Track — drag effects from the Effects panel onto it"
          >
            <Sparkles className="w-3 h-3" /> + FX
          </button>
        </div>

        <div className="w-px h-4 bg-[#3e3e3e] mx-2" />

        {/* Transition Toggle */}
        <button
          onClick={() => setShowTransitionLayer(!showTransitionLayer)}
          title={showTransitionLayer ? "Hide Transition Layer" : "Show Transition Layer"}
          className={`px-2 py-0.5 text-[10px] rounded flex items-center gap-1 transition-colors ${
            showTransitionLayer
              ? 'bg-purple-600/30 text-purple-300 border border-purple-500/30 font-semibold'
              : 'text-[#a0a0a0] hover:text-white hover:bg-[#3e3e3e]'
          }`}
        >
          <Sparkles className="w-3 h-3" /> Transitions
        </button>

        {/* Snapping Toggle */}
        <button
          onClick={() => updateSettings({ snapEnabled: !settings.snapEnabled })}
          title={settings.snapEnabled ? "Disable Snapping (N)" : "Enable Snapping (N)"}
          className={`px-2 py-0.5 text-[10px] rounded flex items-center gap-1 transition-colors ${
            settings.snapEnabled
              ? 'bg-yellow-600/30 text-yellow-300 border border-yellow-500/30 font-semibold'
              : 'text-[#a0a0a0] hover:text-white hover:bg-[#3e3e3e]'
          }`}
        >
          <Magnet className="w-3 h-3" /> Snapping
        </button>

        <div className="flex-1" />

        {/* Tool indicator */}
        {activeTool === 'split' && (
          <span className="text-[10px] text-amber-400 px-2 py-0.5 bg-amber-500/10 rounded">
            Click a clip to split at playhead
          </span>
        )}
      </div>

      {/* ── Main body ────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {/* ── Track headers ──────────────────────────────────────────── */}
        <div
          className="bg-[#252525] border-r border-[#3e3e3e] flex flex-col overflow-hidden shrink-0"
          style={{ width: TRACK_HEADER_WIDTH }}
        >
          {/* Ruler spacer */}
          <div className="bg-[#2d2d2d] border-b border-[#3e3e3e] shrink-0" style={{ height: RULER_HEIGHT }} />

          {/* Headers */}
          <div
            ref={trackHeadersRef}
            className="flex-1 overflow-y-auto"
            style={{ scrollbarWidth: 'none' }}
            onScroll={handleHeadersScroll}
          >
            {tracks.map((track) => (
              <div
                key={track.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/x-track-reorder', track.id);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragOver={(e) => {
                  if (e.dataTransfer.types.includes('application/x-track-reorder')) {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                  }
                }}
                onDrop={(e) => {
                  const sourceId = e.dataTransfer.getData('application/x-track-reorder');
                  if (sourceId && sourceId !== track.id) {
                    const newIndex = tracks.findIndex(t => t.id === track.id);
                    reorderTrack(sourceId, newIndex);
                  }
                }}
                className={`flex items-center px-2 border-b border-[#3e3e3e] ${
                  selectedTrackId === track.id ? 'bg-[#3e3e3e]' : ''
                }`}
                style={{ height: getTrackHeight(track, hoveredOverLayerRegion, pinnedOverLayerTrackId) }}
                onClick={() => selectTrack(track.id)}
              >
                <div className="flex items-center gap-1 flex-1 min-w-0">
                  <GripVertical className="w-3 h-3 text-[#a0a0a0] shrink-0 cursor-grab" />
                  <span className="text-[11px] text-white font-medium truncate">{track.name}</span>
                  {(() => {
                    const linkedFxTrack = tracks.find(t => t.type === 'fx' && t.linkedTrackId === track.id);
                    if (linkedFxTrack) {
                      return (
                        <span className="ml-1.5 px-1 py-0.5 bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-[3px] text-[8px] font-semibold uppercase tracking-wider scale-90" title={`Affected by FX track ${linkedFxTrack.name}`}>
                          FX Active
                        </span>
                      );
                    }
                    return null;
                  })()}
                  {track.type === 'fx' && track.linkedTrackId && (
                    <div className="flex items-center gap-0.5 ml-1 text-amber-400 opacity-80" title={`Linked to ${tracks.find(t => t.id === track.linkedTrackId)?.name}`}>
                      <Link className="w-3 h-3" />
                      <span className="text-[9px]">{tracks.find(t => t.id === track.linkedTrackId)?.name}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  {(track.overLayers || []).length > 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (pinnedOverLayerTrackId === track.id) {
                          setPinnedOverLayerTrackId(null);
                        } else {
                          setPinnedOverLayerTrackId(track.id);
                        }
                      }}
                      title={pinnedOverLayerTrackId === track.id ? 'Unpin Over Layers' : 'Pin Over Layers Open'}
                      className={`p-0.5 rounded transition-colors ${
                        pinnedOverLayerTrackId === track.id ? 'text-cyan-400' : 'text-[#a0a0a0] hover:text-white'
                      }`}
                    >
                      <Pin className="w-3 h-3" style={{ transform: pinnedOverLayerTrackId === track.id ? 'none' : 'rotate(45deg)' }} />
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleTrackLock(track.id);
                    }}
                    title={track.locked ? 'Unlock' : 'Lock'}
                    className={`p-0.5 rounded transition-colors ${
                      track.locked ? 'text-amber-400' : 'text-[#a0a0a0] hover:text-white'
                    }`}
                  >
                    {track.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                  </button>
                  {track.type === 'audio' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleVoiceoverRecordingToggle(track.id);
                      }}
                      title={isRecordingVoiceover && recordingTrackId === track.id ? 'Stop Voiceover Recording' : 'Record Voiceover'}
                      className={`p-0.5 rounded transition-all ${
                        isRecordingVoiceover && recordingTrackId === track.id
                          ? 'bg-red-600 text-white animate-pulse shadow-lg shadow-red-600/35 scale-110'
                          : 'text-[#a0a0a0] hover:text-red-400'
                      }`}
                    >
                      <Mic className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (track.type === 'audio') {
                        toggleTrackMute(track.id);
                      } else {
                        useEditorStore.getState().toggleTrackHidden(track.id);
                      }
                    }}
                    title={track.type === 'audio' ? (track.muted ? 'Unmute Track' : 'Mute Track') : (track.hidden ? 'Show Track' : 'Hide Track')}
                    className={`p-0.5 rounded transition-colors ${
                      (track.type === 'audio' ? track.muted : track.hidden) ? 'text-red-400' : 'text-[#a0a0a0] hover:text-white'
                    }`}
                  >
                    {track.type === 'audio' ? (
                      track.muted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />
                    ) : (
                      track.hidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />
                    )}
                  </button>
                  {tracks.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeTrack(track.id);
                      }}
                      title="Remove track"
                      className="p-0.5 text-[#a0a0a0] hover:text-red-400 rounded transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden relative">
          {/* Floating Scrub Tooltip */}
          <FloatingScrubTooltip
            zoomLevel={zoomLevel}
            scrollLeft={scrollLeft}
            isScrubbing={isScrubbing}
          />

          {/* ── Ruler ──────────────────────────────────────────────── */}
          <div
            ref={rulerContainerRef}
            className="bg-[#2d2d2d] border-b border-[#3e3e3e] relative overflow-hidden shrink-0 cursor-pointer select-none"
            style={{ height: RULER_HEIGHT }}
            onMouseDown={handleRulerMouseDown}
          >
            <div
              className="absolute top-0 left-0 h-full"
              style={{ width: `${timelineWidth}px` }}
            >
              {/* In-point flag (green triangle) */}
              {inPoint !== null && (
                <div
                  className="absolute top-0 w-3 h-4 pointer-events-none z-20"
                  style={{ left: `${inPoint * zoomLevel}px`, transform: 'translateX(-50%)' }}
                >
                  <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-emerald-500" />
                </div>
              )}

              {/* Out-point flag (red triangle) */}
              {outPoint !== null && (
                <div
                  className="absolute top-0 w-3 h-4 pointer-events-none z-20"
                  style={{ left: `${outPoint * zoomLevel}px`, transform: 'translateX(-50%)' }}
                >
                  <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-red-500" />
                </div>
              )}

              {/* Timeline Markers */}
              {sortedMarkers.map((marker) => {
                const markerX = marker.time * zoomLevel;
                return (
                  <div
                    key={marker.id}
                    className="absolute top-0 w-3 h-4 cursor-pointer z-30 group"
                    style={{ left: `${markerX}px`, transform: 'translateX(-50%)' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      seek(marker.time);
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setMarkerContextMenu({
                        x: e.clientX,
                        y: e.clientY,
                        markerId: marker.id,
                      });
                    }}
                    title={marker.name}
                  >
                    {/* Diamond shape */}
                    <div 
                      className={`${marker.type === 'sponsor' ? 'w-3 h-3' : marker.type === 'chapter' ? 'w-2 h-4 rounded-sm' : 'w-2.5 h-2.5 rotate-45'} border border-white/40 shadow-sm mt-0.5 mx-auto transition-transform group-hover:scale-110`}
                      style={{ backgroundColor: marker.color }}
                    />
                    {marker.type === 'sponsor' && (
                      <div className="absolute top-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-[8px] font-bold text-green-400 bg-black/60 px-1 rounded shadow pointer-events-none">SPONSOR</div>
                    )}
                    {marker.type === 'chapter' && (
                      <div className="absolute top-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-[8px] font-bold text-blue-400 bg-black/60 px-1 rounded shadow pointer-events-none">CHAPTER</div>
                    )}
                    {/* Tooltip on hover */}
                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 bg-[#141414] border border-[#3e3e3e] px-1.5 py-0.5 rounded text-[8px] text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-md">
                      {marker.name}
                    </div>
                  </div>
                );
              })}

              {/* Beat Markers — yellow diamonds on ruler */}
              {beatMarkers.map((bm, i) => {
                const bx = bm.time * zoomLevel;
                return (
                  <div
                    key={`beat-${bm.clipId}-${i}`}
                    className="absolute top-0 w-2 h-2 z-20 pointer-events-none"
                    style={{ left: `${bx}px`, transform: 'translateX(-50%) rotate(45deg) translateY(3px)' }}
                  >
                    <div className="w-full h-full bg-yellow-400/80 border border-yellow-300/60" />
                  </div>
                );
              })}

              {rulerData.map((m, i) => {
                let tickHeight = '14px';
                let tickColor = 'bg-[#a0a0a0]';
                if (m.type === 'medium') {
                  tickHeight = '10.5px';
                  tickColor = 'bg-[#888888]';
                } else if (m.type === 'minor') {
                  tickHeight = '7px';
                  tickColor = 'bg-[#555555]';
                }

                return (
                  <div
                    key={i}
                    className="absolute top-0 h-full flex flex-col items-start pointer-events-none"
                    style={{ left: `${m.time * zoomLevel}px` }}
                  >
                    <div
                      className={`w-px ${tickColor}`}
                      style={{ height: tickHeight }}
                    />
                    {m.label && (
                      <span className="text-[9px] text-[#a0a0a0] pl-0.5 mt-0.5 whitespace-nowrap tabular-nums">
                        {m.label}
                      </span>
                    )}
                  </div>
                );
              })}

              {/* Playhead on ruler */}
              <RulerPlayhead zoomLevel={zoomLevel} />
            </div>
          </div>

          {/* ── Tracks container ───────────────────────────────────── */}
          <div
            ref={trackContainerRef}
            className="flex-1 overflow-auto relative timeline-track-workspace"
            onClick={handleTimelineClick}
            onScroll={handleScroll}
          >
            <div className="relative" style={{ width: `${timelineWidth}px`, minHeight: '100%' }}>
              {/* Grid lines aligned with ruler markers */}
              {rulerData
                .filter((m) => m.type === 'major')
                .map((m, i) => (
                  <div
                    key={`g-${i}`}
                    className="absolute top-0 bottom-0 w-px bg-[#3e3e3e]/30 pointer-events-none"
                    style={{ left: `${m.time * zoomLevel}px` }}
                  />
                ))}

              {/* In-point vertical dashed line */}
              {inPoint !== null && (
                <div
                  className="absolute top-0 bottom-0 w-px border-l border-dashed border-emerald-500/50 pointer-events-none z-20"
                  style={{ left: `${inPoint * zoomLevel}px` }}
                />
              )}

              {/* Out-point vertical dashed line */}
              {outPoint !== null && (
                <div
                  className="absolute top-0 bottom-0 w-px border-l border-dashed border-red-500/50 pointer-events-none z-20"
                  style={{ left: `${outPoint * zoomLevel}px` }}
                />
              )}

              {/* Work area shading between In and Out points */}
              {inPoint !== null && outPoint !== null && (
                <div
                  className="absolute top-0 bottom-0 pointer-events-none bg-indigo-500/5 border-l border-r border-indigo-500/20"
                  style={{
                    left: `${inPoint * zoomLevel}px`,
                    width: `${(outPoint - inPoint) * zoomLevel}px`
                  }}
                />
              )}

              {/* Marker vertical guide lines */}
              {sortedMarkers.map((marker, i) => {
                // If it's a sponsor or chapter marker, render a colored block until the next marker
                let nextTime = totalDuration;
                if (marker.type === 'sponsor' || marker.type === 'chapter') {
                  const nextMarker = sortedMarkers.slice(i+1).find(m => m.time > marker.time);
                  if (nextMarker) nextTime = nextMarker.time;
                }
                const isSegment = marker.type === 'sponsor' || marker.type === 'chapter';

                return (
                  <React.Fragment key={`ml-${marker.id}`}>
                    <div
                      className={`absolute top-0 bottom-0 pointer-events-none z-10 opacity-35 ${isSegment ? 'border-l-2 border-solid' : 'w-px border-l border-dashed'}`}
                      style={{
                        left: `${marker.time * zoomLevel}px`,
                        borderColor: marker.color
                      }}
                    />
                    {isSegment && (
                      <div 
                        className="absolute top-0 bottom-0 pointer-events-none z-0 opacity-5"
                        style={{
                          left: `${marker.time * zoomLevel}px`,
                          width: `${(nextTime - marker.time) * zoomLevel}px`,
                          backgroundColor: marker.color
                        }}
                      />
                    )}
                  </React.Fragment>
                );
              })}

              {/* ── Tracks ─────────────────────────────────────────── */}
              {tracks.map((track) => {
                if (track.hidden) return null;
                return (
                <div
                  key={track.id}
                  data-track-id={track.id}
                  className={`relative border-b border-[#3e3e3e] transition-colors ${
                    hoveredTrackId === track.id ? 'bg-[#3e3e3e]/30' : ''
                  }`}
              style={{ height: getTrackHeight(track, hoveredOverLayerRegion, pinnedOverLayerTrackId) }}
                  onDragOver={(e) => handleDragOver(e, track.id)}
                  onDrop={(e) => handleDrop(e, track.id)}
                  onDragEnter={() => setHoveredTrackId(track.id)}
                  onDragLeave={() => {
                    setHoveredTrackId(null);
                    setDropPreview(null);
                    setHoveredOverLayerRegion(null);
                  }}
                  onMouseMove={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const mouseX = e.clientX - rect.left;
                    const hoverTime = (scrollLeft + mouseX) / zoomLevel;
                    
                    const hoveredOl = (track.overLayers || []).find(
                      (ol) => hoverTime >= ol.startTime && hoverTime < ol.startTime + ol.duration
                    );
                    
                    if (hoveredOl) {
                      setHoveredOverLayerRegion({
                        trackId: track.id,
                        startTime: hoveredOl.startTime,
                        endTime: hoveredOl.startTime + hoveredOl.duration,
                      });
                    } else if (hoveredOverLayerRegion && hoveredOverLayerRegion.trackId === track.id) {
                      const inTimeRange = hoverTime >= hoveredOverLayerRegion.startTime && hoverTime < hoveredOverLayerRegion.endTime;
                      if (!inTimeRange) {
                        setHoveredOverLayerRegion(null);
                      }
                    }
                  }}
                  onMouseLeave={() => {
                    setHoveredTrackId(null);
                    setDropPreview(null);
                    setHoveredOverLayerRegion(null);
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    selectTrack(track.id);
                    selectClip(null);
                    selectTransition(null);
                    // Clicking main track unpins over-layers
                    setPinnedOverLayerTrackId(null);
                    selectOverLayer(null);
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    selectTrack(track.id);
                    selectClip(null);
                    selectTransition(null);
                    selectOverLayer(null);
                    setContextMenu({
                      x: e.clientX,
                      y: e.clientY,
                      clipId: '',
                      trackType: track.type,
                      mediaType: track.type === 'video' ? 'video' : track.type === 'audio' ? 'audio' : 'text',
                      trackId: track.id,
                    });
                  }}
                >
                  {/* Faint track type label */}
                  <div className="absolute left-1 top-1 text-[8px] text-[#a0a0a0] opacity-30 uppercase select-none">
                    {track.type}
                  </div>

                  {/* ── Clips ──────────────────────────────────────── */}
                  {track.clips.map((clip) => {
                    const media = getMediaSafe(clip);
                    const colors = track.type === 'audio' ? CLIP_COLORS.audio : (CLIP_COLORS[media.type] || CLIP_COLORS.video);
                    const isSelected = selectedClipIds.includes(clip.id);
                    const width = Math.max(clip.duration * zoomLevel, MIN_CLIP_WIDTH);
                    const left = clip.startTime * zoomLevel;
                    const isDragging = draggingClipId === clip.id;
                    const clipHeight = (track.type === 'text' || track.type === 'fx' ? THIN_TRACK_HEIGHT : DEFAULT_TRACK_HEIGHT) - 8;
                    const isVideoWithAudio =
                      media.type === 'video' && media.waveformPeaks && media.waveformPeaks.length > 0;
                    const mainVisualHeight = isVideoWithAudio ? clipHeight - 12 : clipHeight;

                      const clipAnims = clip.animations?.['transform.x'] || [];
                      const keyframeTimes = clipAnims.map((k: any) => k.time).sort((a: any, b: any) => a - b);
                      const overlappingOls = (track.overLayers || []).filter((ol) => {
                        const olEnd = ol.startTime + ol.duration;
                        const clipEnd = clip.startTime + clip.duration;
                        return ol.startTime < clipEnd && olEnd > clip.startTime;
                      });
                      const hasOverLayerOverlap = overlappingOls.length > 0;

                      return (
                        <div
                          key={clip.id}
                          className={`absolute top-1 rounded cursor-pointer group select-none ${colors.bg} border ${
                            hasOverLayerOverlap ? 'border-cyan-400 border-b-2 border-dashed shadow-[0_0_6px_rgba(34,211,238,0.6)] z-10' : colors.border
                          } ${colors.hover} transition-all duration-75 ${
                            isSelected
                              ? activeTool === 'rateStretch'
                                ? 'ring-2 ring-purple-500 shadow-lg z-20 rate-stretch-active'
                                : 'ring-2 ring-white shadow-lg z-20'
                              : 'hover:brightness-110'
                          } ${track.locked ? 'opacity-50' : ''} ${isDragging ? 'opacity-80 brightness-125' : ''}`}
                          style={{ left: `${left}px`, width: `${width}px`, height: clipHeight }}
                          onMouseDown={(e) => handleClipMouseDown(e, clip)}
                          onMouseMove={(e) => {
                            if (activeTool === 'split') {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setHoverCutX(e.clientX - rect.left);
                            setHoverCutClipId(clip.id);
                          }
                        }}
                        onMouseLeave={() => {
                          if (activeTool === 'split') {
                            setHoverCutX(null);
                            setHoverCutClipId(null);
                          }
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (e.ctrlKey || e.metaKey) return;
                          selectClip(clip.id);
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          if (media.type === 'compound') {
                            enterCompoundClip(clip.id);
                          }
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          selectClip(clip.id);
                          setContextMenu({
                            x: e.clientX,
                            y: e.clientY,
                            clipId: clip.id,
                            trackType: track.type,
                            mediaType: track.type === 'audio' ? 'audio' : media.type,
                            trackId: track.id,
                          });
                        }}
                      >

                        {/* ── Transition In Badge ────────────────────── */}
                        {clip.transitionIn && (
                          <div
                            className={`absolute left-0 top-0 bottom-0 bg-purple-600/70 border-r border-purple-400/80 hover:bg-purple-500 hover:border-purple-300 transition-colors z-30 cursor-pointer flex items-center justify-center overflow-hidden ${
                              selectedTransitionClipId === clip.id ? 'ring-2 ring-white bg-purple-500' : ''
                            }`}
                            style={{
                              width: `${Math.min(width, clip.transitionIn.duration * zoomLevel)}px`,
                            }}
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              selectTransition(clip.id);
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                            }}
                            title={`${clip.transitionIn.name} Transition (Click to edit)`}
                          >
                            <span className="text-[8px] text-white font-semibold rotate-90 whitespace-nowrap opacity-80 pointer-events-none">
                              {clip.transitionIn.name}
                            </span>
                          </div>
                        )}

                        {/* ── Visual content layer ──────────────────── */}
                        <div className="absolute inset-0 overflow-hidden rounded pointer-events-none">
                          {(track.type === 'audio' || media.type === 'audio') ? (
                            <WaveformOverlay
                              media={media}
                              clipId={clip.id}
                              width={width}
                              height={clipHeight}
                            />
                          ) : (
                            <>
                              {media.type === 'video' && (
                                <div style={{ height: mainVisualHeight }} className="relative">
                                  <FrameStripOverlay
                                    media={media}
                                    clipId={clip.id}
                                    width={width}
                                    height={mainVisualHeight}
                                  />
                                </div>
                              )}

                              {media.type === 'image' && (
                                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                                  {media.thumbnail ? (
                                    <img
                                      src={media.thumbnail}
                                      alt=""
                                      draggable={false}
                                      className="w-full h-full object-cover opacity-60"
                                    />
                                  ) : (
                                    <div className="w-full h-full bg-amber-700/30" />
                                  )}
                                </div>
                              )}

                              {/* Audio waveform bar beneath video frame strip */}
                              {isVideoWithAudio && (
                                <div
                                  className="relative overflow-hidden border-t border-blue-400/20"
                                  style={{ height: 12 }}
                                >
                                  <WaveformOverlay
                                    media={media}
                                    clipId={clip.id}
                                    width={width}
                                    height={12}
                                    small
                                  />
                                </div>
                              )}
                            </>
                          )}
                        </div>

                        {/* ── Master Keyframes ────────────────────────── */}
                        {keyframeTimes.length > 0 && (
                          <div className="absolute top-0 left-0 right-0 h-0 z-40 pointer-events-none">
                            {/* Connecting Lines */}
                            {keyframeTimes.length > 1 && keyframeTimes.slice(0, -1).map((t: any, i: number) => {
                              const kf = clipAnims.find((k: any) => Math.abs(k.time - t) < 0.05);
                              if (kf?.holdNext) return null;
                              
                              const nextT = keyframeTimes[i + 1];
                              const width = (nextT - t) * zoomLevel;
                              
                              const isSelected = selectedKeyframeLines.some((l: any) => l.clipId === clip.id && l.time === t);
                              
                              return (
                                <div
                                  key={`line-${t}`}
                                  className={`absolute h-[2px] -top-[1px] pointer-events-auto cursor-pointer hover:h-[4px] hover:-top-[2px] transition-all ${isSelected ? 'bg-white h-[4px] -top-[2px] z-10 shadow-[0_0_8px_rgba(255,255,255,0.8)]' : 'bg-red-500/80 hover:bg-red-400'}`}
                                  title="Click to select connection"
                                  style={{
                                    left: `${t * zoomLevel}px`,
                                    width: `${width}px`
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleKeyframeLineSelection(clip.id, t, e.ctrlKey || e.metaKey);
                                  }}
                                />
                              );
                            })}
                            
                            {/* Keyframe Points */}
                            {keyframeTimes.map((t: any, i: number) => {
                              const kf = clipAnims.find((k: any) => Math.abs(k.time - t) < 0.05);
                              const prevKf = i > 0 ? clipAnims.find((k: any) => Math.abs(k.time - keyframeTimes[i - 1]) < 0.05) : null;
                              const isStartEnd = i === 0 || i === keyframeTimes.length - 1 || kf?.holdNext || prevKf?.holdNext;
                              return (
                                <div
                                  key={t}
                                  onMouseDown={(e) => {
                                    e.stopPropagation();
                                    const startX = e.clientX;
                                    let currentTimeMark = t;
                                    const onMouseMove = (moveEvent: MouseEvent) => {
                                      const deltaX = moveEvent.clientX - startX;
                                      let newTime = t + deltaX / zoomLevel;
                                      newTime = Math.max(0, Math.min(newTime, clip.duration));
                                      if (Math.abs(newTime - currentTimeMark) > 0.01) {
                                        useEditorStore.getState().moveMasterKeyframe(clip.id, currentTimeMark, newTime);
                                        currentTimeMark = newTime;
                                      }
                                    };
                                    const onMouseUp = () => {
                                      window.removeEventListener('mousemove', onMouseMove);
                                      window.removeEventListener('mouseup', onMouseUp);
                                      useEditorStore.getState().saveSnapshot();
                                    };
                                    window.addEventListener('mousemove', onMouseMove);
                                    window.addEventListener('mouseup', onMouseUp);
                                  }}
                                  className="absolute w-4 h-4 -top-2 -ml-2 pointer-events-auto cursor-ew-resize flex items-center justify-center group"
                                  style={{ left: `${t * zoomLevel}px` }}
                                >
                                  {isStartEnd ? (
                                    <div className="w-2.5 h-2.5 rotate-45 bg-amber-500 border border-white group-hover:bg-amber-400 group-hover:scale-125 transition-transform shadow" />
                                  ) : (
                                    <div className="w-[3px] h-3 bg-amber-500 border border-white group-hover:bg-amber-400 group-hover:scale-125 transition-transform shadow" />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* ── Resize handles ────────────────────────── */}
                        {!track.locked && (
                          <>
                            <div
                              onMouseDown={(e) => startResize(e, clip, 'left')}
                              className={`absolute left-0 top-0 bottom-0 w-2.5 cursor-w-resize z-20 transition-colors hover:bg-amber-500/80`}
                              title="Drag to trim start"
                            />
                            <div
                              onMouseDown={(e) => startResize(e, clip, 'right')}
                              className={`absolute right-0 top-0 bottom-0 w-2.5 cursor-e-resize z-20 transition-colors hover:bg-amber-500/80`}
                              title="Drag to trim end"
                            />
                          </>
                        )}

                        {/* ── Clip label overlay ────────────────────── */}
                        <div className="absolute inset-0 flex flex-col px-1.5 py-0.5 overflow-hidden z-10 pointer-events-none">
                          {/* Header */}
                          <div className="flex items-center gap-1 min-w-0">
                            {media.type === 'video' && <Film className="w-2.5 h-2.5 shrink-0 opacity-70" />}
                            {media.type === 'audio' && <Music className="w-2.5 h-2.5 shrink-0 opacity-70" />}
                            {media.type === 'image' && <Image className="w-2.5 h-2.5 shrink-0 opacity-70" />}
                            {media.type === 'text' && <span className="text-[8px] shrink-0 opacity-70">T</span>}
                            {media.type === 'fx' && <Sparkles className="w-2.5 h-2.5 shrink-0 opacity-70" />}
                            <span
                              className={`text-[9px] font-medium drop-shadow-sm ${colors.text} ${media.type === 'text' ? 'animate-text-slide' : 'truncate'}`}
                              style={media.type === 'text' ? { '--marquee-width': `${width}px` } as any : undefined}
                              title={media.type === 'text' && (clip as any).textSettings?.text ? (clip as any).textSettings.text : media.name}
                            >
                              {media.type === 'text' && (clip as any).textSettings?.text
                                ? (clip as any).textSettings.text
                                : media.name}
                            </span>
                          </div>

                          {/* Duration badge */}
                          <div className="absolute bottom-0.5 right-1 text-[8px] text-white/50 tabular-nums">
                            {clip.duration.toFixed(1)}s
                          </div>
                        </div>

                        {/* ── Razor preview cut line ────────────────── */}
                        {activeTool === 'split' && hoverCutClipId === clip.id && hoverCutX !== null && (
                          <div
                            className="absolute top-0 bottom-0 w-0 border-l-2 border-dashed border-red-500 z-30 pointer-events-none shadow"
                            style={{
                              left: `${hoverCutX}px`,
                              outline: '1px dashed white',
                              outlineOffset: '-1.5px',
                            }}
                          />
                        )}


                        {/* ── Overlap warning ────────────────────────── */}
                        {checkOverlapAt(track, clip.startTime, clip.duration, clip.id) && (
                          <div
                            className="absolute top-0 left-0 w-full h-1 bg-red-500/80 animate-pulse"
                            title="Overlap detected"
                          />
                        )}
                      </div>
                    );
                  })}

                  {/* Dotted border indicators at the bottom of the parent track when collapsed */}
                  {!(pinnedOverLayerTrackId === track.id || (hoveredOverLayerRegion && hoveredOverLayerRegion.trackId === track.id)) && (track.overLayers || []).map((ol) => {
                    const left = ol.startTime * zoomLevel;
                    const width = ol.duration * zoomLevel;
                    const baseHeight = track.type === 'text' || track.type === 'fx' ? THIN_TRACK_HEIGHT : DEFAULT_TRACK_HEIGHT;
                    return (
                      <div
                        key={`dotted-${ol.id}`}
                        className="absolute h-[2px] border-b-2 border-dotted border-cyan-400/80 pointer-events-none"
                        style={{
                          top: `${baseHeight - 2}px`,
                          left: `${left}px`,
                          width: `${width}px`,
                          zIndex: 45,
                        }}
                      />
                    );
                  })}

                  {/* ── Over Layers ─────────────────────────────────── */}
                  {(pinnedOverLayerTrackId === track.id || (hoveredOverLayerRegion && hoveredOverLayerRegion.trackId === track.id)) && (() => {
                    const region = hoveredOverLayerRegion || { trackId: track.id, startTime: 0, endTime: Infinity };
                    const activeOverLayers = (track.overLayers || []).filter((ol) => {
                      return ol.startTime < region.endTime && ol.startTime + ol.duration > region.startTime;
                    });
                    
                    return activeOverLayers.map((ol, index) => {
                      const width = Math.max(ol.duration * zoomLevel, MIN_CLIP_WIDTH);
                      const left = ol.startTime * zoomLevel;
                      const isSelected = selectedOverLayerId === ol.id;
                      const isDragging = dragOverLayerState?.overLayerId === ol.id;
                      
                      // Row offset (starts below base track height)
                      const topOffset = (track.type === 'text' || track.type === 'fx' ? THIN_TRACK_HEIGHT : DEFAULT_TRACK_HEIGHT) + index * OVER_LAYER_ROW_HEIGHT + 2;
                      
                      // Media lookup
                      const media = mediaLibrary.find((m) => m.id === ol.mediaId);
                      const bgClass = track.type === 'audio' 
                        ? 'bg-emerald-600/70 border-emerald-500/80 hover:bg-emerald-500/80' 
                        : (media?.type === 'image' 
                          ? 'bg-amber-600/70 border-amber-500/80 hover:bg-amber-400/80' 
                          : 'bg-blue-600/70 border-blue-500/80 hover:bg-blue-400/80');
                      
                      return (
                        <div
                          key={ol.id}
                          className={`absolute rounded cursor-pointer group select-none ${bgClass} border overflow-hidden transition-all duration-75 flex items-center justify-between px-2 ${
                            isSelected ? 'ring-2 ring-white shadow-lg z-20' : ''
                          } ${isDragging ? 'opacity-80 brightness-125' : ''}`}
                          style={{
                            left: `${left}px`,
                            width: `${width}px`,
                            top: `${topOffset}px`,
                            height: `${OVER_LAYER_ROW_HEIGHT - 4}px`,
                          }}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            if (ol.mediaId) {
                               const olMedia = useEditorStore.getState().mediaLibrary.find(m => m.id === ol.mediaId);
                               if (olMedia && olMedia.type === 'compound') {
                                 enterCompoundClip(ol.id);
                               }
                            }
                          }}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            if (e.button !== 0) return;
                            
                            const rect = e.currentTarget.getBoundingClientRect();
                            const relX = e.clientX - rect.left;
                            
                            // Left resize handle
                            if (relX < 6) {
                              useEditorStore.getState().startTransaction();
                              setResizeOverLayerState({
                                overLayerId: ol.id,
                                edge: 'left',
                                startX: e.clientX,
                                originalDuration: ol.duration,
                                originalStartTime: ol.startTime,
                              });
                              return;
                            }
                            
                            // Right resize handle
                            if (relX > rect.width - 6) {
                              useEditorStore.getState().startTransaction();
                              setResizeOverLayerState({
                                overLayerId: ol.id,
                                edge: 'right',
                                startX: e.clientX,
                                originalDuration: ol.duration,
                                originalStartTime: ol.startTime,
                              });
                              return;
                            }
                            
                            // Select
                            selectOverLayer(ol.id);
                            selectClip(null);
                            
                            // Drag
                            useEditorStore.getState().startTransaction();
                            setDragOverLayerState({
                              overLayerId: ol.id,
                              startX: e.clientX,
                              startY: e.clientY,
                              originalStartTime: ol.startTime,
                              trackId: track.id,
                            });
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            selectOverLayer(ol.id);
                            selectClip(null);
                            // Pin this track's over-layers open so they don't collapse
                            setPinnedOverLayerTrackId(track.id);
                          }}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            selectOverLayer(ol.id);
                            selectClip(null);
                            setContextMenu({
                              x: e.clientX,
                              y: e.clientY,
                              clipId: ol.id,
                              trackType: track.type,
                              mediaType: media?.type || (track.type === 'audio' ? 'audio' : 'video'),
                              isOverLayer: true,
                              trackId: track.id,
                            });
                          }}
                        >
                          {media && (media.type === 'video' || media.type === 'image') && media.thumbnail && (
                            <img 
                              src={media.thumbnail} 
                              alt="" 
                              className="absolute inset-0 w-full h-full object-cover opacity-40 pointer-events-none" 
                            />
                          )}
                          <div className="relative z-10 flex items-center gap-1.5 min-w-0 select-none pointer-events-none">
                            {track.type === 'audio' ? (
                              <Music className="w-3 h-3 text-emerald-300 drop-shadow-md" />
                            ) : media?.type === 'image' ? (
                              <Image className="w-3 h-3 text-amber-300 drop-shadow-md" />
                            ) : track.type === 'text' ? (
                              <Type className="w-3 h-3 text-purple-300 drop-shadow-md" />
                            ) : (
                              <Film className="w-3 h-3 text-blue-300 drop-shadow-md" />
                            )}
                            <span 
                              className={`text-[10px] text-white font-medium drop-shadow-md ${track.type === 'text' ? 'animate-text-slide' : 'truncate'}`}
                              style={track.type === 'text' ? { '--marquee-width': `${width}px` } as any : undefined}
                              title={media ? media.name : (track.type === 'text' ? 'Text OverLayer' : '(Empty Over Layer)')}
                            >
                              {media ? media.name : (track.type === 'text' ? 'Text OverLayer' : '(Empty Over Layer)')}
                            </span>
                          </div>
                          
                          <span className="text-[9px] text-white/50 select-none pointer-events-none">
                            {ol.duration.toFixed(1)}s
                          </span>

                          {/* Resize handles visual */}
                          {!track.locked && (
                            <>
                              <div className="absolute left-0 top-0 bottom-0 w-1 cursor-w-resize group-hover:bg-amber-400/40" />
                              <div className="absolute right-0 top-0 bottom-0 w-1 cursor-e-resize group-hover:bg-amber-400/40" />
                            </>
                          )}
                        </div>
                      );
                    });
                  })()}

                  {/* ── Transitions Layer ───────────────────────────── */}
                  {showTransitionLayer && !track.locked && (() => {
                    const sortedClips = [...track.clips].sort((a, b) => a.startTime - b.startTime);
                    return sortedClips.map((clip, idx) => {
                      if (idx === 0) return null;
                      const prevClip = sortedClips[idx - 1];
                      const gap = clip.startTime - (prevClip.startTime + prevClip.duration);
                      
                      if (Math.abs(gap) < 0.1) {
                        const intersectionTime = clip.startTime;
                        const hasTransition = !!clip.transitionIn;
                        
                        const transition = clip.transitionIn;
                        const duration = transition?.duration ?? 1.0;
                        const alignment = transition?.params?.alignment as 'center' | 'left' | 'right' || 'center';
                        
                        const widthSec = hasTransition ? duration : 0.4;
                        const widthPx = Math.max(16, widthSec * zoomLevel);
                        
                        let leftSec = intersectionTime - widthSec / 2;
                        if (alignment === 'left') {
                          leftSec = intersectionTime;
                        } else if (alignment === 'right') {
                          leftSec = intersectionTime - widthSec;
                        }
                        const leftPx = leftSec * zoomLevel;
                        
                        const isSelected = selectedTransitionClipId === clip.id;
                        
                        return (
                          <TransitionTarget
                            key={`trans-${clip.id}`}
                            clipId={clip.id}
                            trackId={track.id}
                            left={leftPx}
                            width={widthPx}
                            hasTransition={hasTransition}
                            transitionName={transition?.name}
                            isSelected={isSelected}
                            zoomLevel={zoomLevel}
                          />
                        );
                      }
                      return null;
                    });
                  })()}
                </div>
              );
            })}

              {/* ── Drop preview ──────────────────────────────────────── */}
              {dropPreview && hoveredTrackId && (
                <div
                  className="absolute border-2 border-amber-500/50 border-dashed rounded pointer-events-none z-40 bg-amber-500/5"
                  style={{
                    top: `${getTrackTop(tracks, dropPreview.trackIdx, hoveredOverLayerRegion, pinnedOverLayerTrackId) + 4}px`,
                    left: `${dropPreview.time * zoomLevel}px`,
                    width: `${dropPreview.duration * zoomLevel}px`,
                    height: (tracks[dropPreview.trackIdx]?.type === 'text' || tracks[dropPreview.trackIdx]?.type === 'fx' ? THIN_TRACK_HEIGHT : DEFAULT_TRACK_HEIGHT) - 8,
                  }}
                />
              )}

              {/* Full‑track hover outline */}
              {hoveredTrackId && !dropPreview && (
                <div
                  className="absolute left-0 right-0 border-2 border-amber-500/30 border-dashed pointer-events-none z-40"
                  style={{
                    top: `${getTrackTop(tracks, tracks.findIndex((t) => t.id === hoveredTrackId), hoveredOverLayerRegion, pinnedOverLayerTrackId)}px`,
                    height: getTrackHeight(tracks.find((t) => t.id === hoveredTrackId)!, hoveredOverLayerRegion, pinnedOverLayerTrackId),
                  }}
                />
              )}

              {/* ── Snap line ──────────────────────────────────────────── */}
              {snapLine !== null && (
                <div
                  className="absolute top-0 bottom-0 w-[1.5px] bg-amber-400 z-50 pointer-events-none shadow-[0_0_8px_rgba(251,191,36,0.8)]"
                  style={{ left: `${snapLine}px` }}
                />
              )}

              {/* ── Playhead ───────────────────────────────────────────── */}
              <WorkspacePlayhead zoomLevel={zoomLevel} />

              {/* ── Playback Auto-Scroller ─────────────────────────────── */}
              <PlaybackAutoScroller
                zoomLevel={zoomLevel}
                totalDuration={totalDuration}
                trackContainerRef={trackContainerRef}
                setScrollLeftThrottled={setScrollLeftThrottled}
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* ── Right-click Context Menu ──────────────────────────────────── */}
    {contextMenu && (
      <div
        className="fixed z-[200] bg-[#2d2d2d] border border-[#4e4e4e] rounded-lg shadow-2xl py-1 min-w-[180px] max-h-[80vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
        style={{ left: contextMenu.x, top: contextMenu.y }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {contextMenu.isOverLayer ? (
          <>
            <button
              className="w-full text-left px-3 py-2 text-xs text-white hover:bg-[#3e3e3e] flex items-center gap-2 transition-colors border-b border-[#3e3e3e]"
              onClick={() => {
                splitClip(contextMenu.clipId, useEditorStore.getState().currentTime);
                setContextMenu(null);
              }}
            >
              <Scissors className="w-3.5 h-3.5 text-amber-500" />
              Split at Playhead
            </button>
            <button
              className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-[#3e3e3e] flex items-center gap-2 transition-colors"
              onClick={() => {
                removeOverLayer(contextMenu.clipId);
                selectOverLayer(null);
                setContextMenu(null);
              }}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete Over Layer
            </button>
          </>
        ) : (
          <>
            {/* Add Over Layer — always available for any track when right clicking background or clip */}
            {contextMenu.trackId && (
              <button
                className="w-full text-left px-3 py-2 text-xs text-white hover:bg-[#3e3e3e] flex items-center gap-2 transition-colors border-b border-[#3e3e3e]"
                onClick={() => {
                  addOverLayer(contextMenu.trackId!);
                  setContextMenu(null);
                }}
              >
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                Add Over Layer
              </button>
            )}

            {contextMenu.clipId && (
              <>
                {(() => {
                  const clip = tracks.flatMap(t => [...t.clips, ...t.overLayers]).find(c => c.id === contextMenu.clipId);
                  if (!clip) return null;
                  return (
                    <>
                      <button
                        className="w-full text-left px-3 py-2 text-xs text-white hover:bg-[#3e3e3e] flex items-center gap-2 transition-colors border-b border-[#3e3e3e] pb-2"
                        onClick={() => {
                          useEditorStore.getState().updateClip(clip.id, { disabled: !clip.disabled });
                          setContextMenu(null);
                        }}
                      >
                        {clip.disabled ? <Eye className="w-3.5 h-3.5 text-green-400" /> : <EyeOff className="w-3.5 h-3.5 text-red-400" />}
                        {clip.disabled ? 'Enable Clip' : 'Disable Clip'}
                      </button>
                      {(contextMenu.mediaType === 'video' || contextMenu.mediaType === 'audio') && (
                        <button
                          className="w-full text-left px-3 py-2 text-xs text-white hover:bg-[#3e3e3e] flex items-center gap-2 transition-colors border-b border-[#3e3e3e] pb-2"
                          onClick={() => {
                            useEditorStore.getState().updateClip(clip.id, {
                              audioSettings: { ...(clip.audioSettings || { volume: 0, pan: 0, fadeIn: 0, fadeOut: 0, bass: 0, treble: 0, preservePitch: true, pitch: 0, voiceFormant: 0, humanize: false }), muted: !clip.audioSettings?.muted }
                            });
                            setContextMenu(null);
                          }}
                        >
                          {clip.audioSettings?.muted ? <Volume2 className="w-3.5 h-3.5 text-green-400" /> : <VolumeX className="w-3.5 h-3.5 text-red-400" />}
                          {clip.audioSettings?.muted ? 'Unmute Audio' : 'Mute Audio'}
                        </button>
                      )}
                    </>
                  );
                })()}
                {/* AI Transcription Options */}
                {(contextMenu.mediaType === 'video' || contextMenu.mediaType === 'audio') && (
                  <>
                    <button
                      className="w-full text-left px-3 py-2 text-xs text-white hover:bg-[#3e3e3e] flex items-center gap-2 transition-colors"
                      onClick={() => {
                        handleGenerateSubtitles(contextMenu.clipId, 'standard');
                        setContextMenu(null);
                      }}
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      Generate Subtitles / Captions
                    </button>
                    <button
                      className="w-full text-left px-3 py-2 text-xs text-white hover:bg-[#3e3e3e] flex items-center gap-2 transition-colors border-b border-[#3e3e3e] pb-2"
                      onClick={() => {
                        handleGenerateSubtitles(contextMenu.clipId, 'dynamic');
                        setContextMenu(null);
                      }}
                    >
                      <Zap className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
                      Generate Dynamic Typography
                    </button>
                    <button
                      className="w-full text-left px-3 py-2 text-xs text-white hover:bg-[#3e3e3e] flex items-center gap-2 transition-colors"
                      onClick={() => {
                        handleOpenSfxGenerator(contextMenu.clipId);
                        setContextMenu(null);
                      }}
                    >
                      <Music className="w-3.5 h-3.5 text-cyan-400" />
                      AI Generate Sound Effect (SFX)
                    </button>
                    <button
                      className="w-full text-left px-3 py-2 text-xs text-white hover:bg-[#3e3e3e] flex items-center gap-2 transition-colors border-b border-[#3e3e3e] pb-2"
                      onClick={() => {
                        setSfxAutoCueClipId(contextMenu.clipId);
                        setSfxUserDescription('');
                        setSfxAutoCueMode('visual');
                        setContextMenu(null);
                      }}
                    >
                      <Sparkles className="w-3.5 h-3.5 text-pink-400" />
                      AI Auto-Cue Sound Effects
                    </button>
                  </>
                )}

                {/* Unlink Audio — only for video clips that are not already unlinked */}
                {contextMenu.mediaType === 'video' && !tracks.flatMap(t => t.clips).find(c => c.id === contextMenu.clipId)?.linkedClipId && (
                  <button
                    className="w-full text-left px-3 py-2 text-xs text-white hover:bg-[#3e3e3e] flex items-center gap-2 transition-colors"
                    onClick={() => {
                      unlinkAudio(contextMenu.clipId);
                      setContextMenu(null);
                    }}
                  >
                    <Unlink2 className="w-3.5 h-3.5 text-emerald-400" />
                    Extract Audio
                  </button>
                )}
                {/* Break Link Connection */}
                {tracks.flatMap(t => t.clips).find(c => c.id === contextMenu.clipId)?.linkedClipId && (
                  <button
                    className="w-full text-left px-3 py-2 text-xs text-white hover:bg-[#3e3e3e] flex items-center gap-2 transition-colors"
                    onClick={() => {
                      breakLinkConnection(contextMenu.clipId);
                      setContextMenu(null);
                    }}
                  >
                    <Unlink2 className="w-3.5 h-3.5 text-red-400" />
                    Break Link Connection
                  </button>
                )}
                <button
                  className="w-full text-left px-3 py-2 text-xs text-white hover:bg-[#3e3e3e] flex items-center gap-2 transition-colors"
                  onClick={() => {
                    splitClip(contextMenu.clipId, useEditorStore.getState().currentTime);
                    setContextMenu(null);
                  }}
                >
                  <Scissors className="w-3.5 h-3.5 text-amber-400" />
                  Split at Playhead
                </button>
                <div className="h-px bg-[#3e3e3e] my-1" />
                <button
                  className="w-full text-left px-3 py-2 text-xs text-white hover:bg-[#3e3e3e] flex items-center gap-2 transition-colors"
                  onClick={() => {
                    useEditorStore.getState().copyClip('clip');
                    setContextMenu(null);
                  }}
                >
                  <Copy className="w-3.5 h-3.5 text-blue-400" />
                  Copy Clip (Base)
                </button>
                <button
                  className="w-full text-left px-3 py-2 text-xs text-white hover:bg-[#3e3e3e] flex items-center gap-2 transition-colors"
                  onClick={() => {
                    useEditorStore.getState().copyClip('style');
                    setContextMenu(null);
                  }}
                >
                  <Palette className="w-3.5 h-3.5 text-purple-400" />
                  Copy Style
                </button>
                <button
                  className="w-full text-left px-3 py-2 text-xs text-white hover:bg-[#3e3e3e] flex items-center gap-2 transition-colors"
                  onClick={() => {
                    useEditorStore.getState().copyClip('whole');
                    setContextMenu(null);
                  }}
                >
                  <Box className="w-3.5 h-3.5 text-amber-400" />
                  Copy (Whole)
                </button>
                <div className="h-px bg-[#3e3e3e] my-1" />
                <button
                  className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-[#3e3e3e] flex items-center gap-2 transition-colors"
                  onClick={() => {
                    useEditorStore.getState().removeClip(contextMenu.clipId);
                    setContextMenu(null);
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Clip
                </button>
              </>
            )}
          </>
        )}
      </div>
    )}

    {/* ── Marker Context Menu ────────────────────────────────────────── */}
    {markerContextMenu && (() => {
      const marker = markers.find(m => m.id === markerContextMenu.markerId);
      if (!marker) return null;
    
  const handleZIndexChange = (clipId: string, isOverLayer: boolean, action: 'front' | 'back' | 'forward' | 'backward', trackId?: string) => {
    const clip = isOverLayer 
      ? tracks.flatMap(t => t.overLayers || []).find(c => c.id === clipId)
      : tracks.flatMap(t => t.clips).find(c => c.id === clipId);
    
    if (!clip) return;
    const currentZ = clip.zIndex || 0;
    
    let newZ = currentZ;
    if (action === 'forward') newZ = currentZ + 1;
    else if (action === 'backward') newZ = currentZ - 1;
    else if (action === 'front') newZ = 9999;
    else if (action === 'back') newZ = -9999;

    if (isOverLayer) {
      updateOverLayer(clipId, { zIndex: newZ });
    } else {
      updateClip(clipId, { zIndex: newZ });
    }
    setContextMenu(null);
  };

  return (
        <div
          className="fixed z-[200] bg-[#2d2d2d] border border-[#4e4e4e] rounded-lg shadow-2xl py-2 min-w-[200px] text-white max-h-[80vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
          style={{ left: markerContextMenu.x, top: markerContextMenu.y }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="px-3 pb-2 text-[10px] text-[#a0a0a0] font-semibold border-b border-[#3e3e3e] mb-1.5 uppercase tracking-wider">
            Edit Marker
          </div>
          {/* Rename Option */}
          <button
            className="w-full text-left px-3 py-1.5 text-xs text-white hover:bg-[#3e3e3e] flex items-center gap-2 transition-colors"
            onClick={() => {
              const newName = prompt('Rename marker:', marker.name);
              if (newName !== null) {
                updateMarker(marker.id, { name: newName });
              }
              setMarkerContextMenu(null);
            }}
          >
            <Edit className="w-3.5 h-3.5 text-amber-400" />
            Rename Marker
          </button>
          
          {/* Color Selection */}
          <div className="px-3 py-1 text-[10px] text-[#a0a0a0] mt-1.5">Color</div>
          <div className="grid grid-cols-6 gap-1 px-3 py-1.5">
            {['#fbbf24', '#3b82f6', '#22c55e', '#ef4444', '#8b5cf6', '#ffffff'].map((color) => (
              <button
                key={color}
                onClick={() => {
                  updateMarker(marker.id, { color });
                  setMarkerContextMenu(null);
                }}
                className={`w-5 h-5 rounded-full border transition-all ${
                  marker.color === color ? 'border-white scale-110 shadow-md' : 'border-transparent hover:border-white/50'
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
                    </div>

          {/* Type Selection */}
          <div className="px-3 py-1 text-[10px] text-[#a0a0a0] mt-1">Marker Type</div>
          <div className="px-1.5 pb-1.5 space-y-0.5">
            <button
              className={`w-full text-left px-2 py-1 text-xs rounded flex items-center gap-2 transition-colors ${marker.type === 'standard' || !marker.type ? 'bg-amber-500/20 text-amber-400' : 'text-white hover:bg-[#3e3e3e]'}`}
              onClick={() => { updateMarker(marker.id, { type: 'standard' }); setMarkerContextMenu(null); }}
            >
              <Bookmark className="w-3 h-3" /> Standard
            </button>
            <button
              className={`w-full text-left px-2 py-1 text-xs rounded flex items-center gap-2 transition-colors ${marker.type === 'sponsor' ? 'bg-green-500/20 text-green-400' : 'text-white hover:bg-[#3e3e3e]'}`}
              onClick={() => { updateMarker(marker.id, { type: 'sponsor', color: '#22c55e' }); setMarkerContextMenu(null); }}
            >
              <Tag className="w-3 h-3" /> Sponsor Segment
            </button>
            <button
              className={`w-full text-left px-2 py-1 text-xs rounded flex items-center gap-2 transition-colors ${marker.type === 'chapter' ? 'bg-blue-500/20 text-blue-400' : 'text-white hover:bg-[#3e3e3e]'}`}
              onClick={() => { updateMarker(marker.id, { type: 'chapter', color: '#3b82f6' }); setMarkerContextMenu(null); }}
            >
              <Layers className="w-3 h-3" /> Chapter Marker
            </button>
          </div>

          <div className="h-px bg-[#3e3e3e] my-1.5" />
          <button
            className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-[#3e3e3e] flex items-center gap-2 transition-colors"
            onClick={() => {
              removeMarker(marker.id);
              setMarkerContextMenu(null);
            }}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete Marker
          </button>
        </div>
      );
    })()}

    {/* Floating Voiceover Recording Timer Banner */}
    {isRecordingVoiceover && (
      <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[300] bg-red-950/95 border border-red-500/30 text-white px-4 py-2 rounded-full shadow-2xl flex items-center gap-3 animate-pulse">
        <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-ping" />
        <span className="text-xs font-semibold uppercase tracking-wider text-red-200">
          Recording Voiceover
        </span>
        <span className="text-xs font-mono font-bold text-red-100 bg-red-900/60 border border-red-500/20 px-2 py-0.5 rounded-full">
          {Math.floor(recordingSeconds / 60).toString().padStart(2, '0')}:
          {(recordingSeconds % 60).toString().padStart(2, '0')}s
        </span>
        <button
          onClick={() => {
            const track = tracks.find(t => t.id === recordingTrackId);
            if (track) handleVoiceoverRecordingToggle(track.id);
          }}
          className="text-[10px] text-red-300 hover:text-white bg-red-900/40 hover:bg-red-800 border border-red-500/25 px-2.5 py-1 rounded-full transition-colors ml-1 uppercase font-semibold"
        >
          Done
        </button>
      </div>
    )}

    {/* Floating AI Transcribing Loader Toast */}
    {isTranscribing && (
      <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[300] bg-[#1e1e1e]/95 border border-amber-500/30 text-white px-5 py-3 rounded-full shadow-2xl flex items-center gap-3">
        <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
        <span className="text-xs font-semibold uppercase tracking-wider text-amber-200">
          AI Transcribing Clip Audio...
        </span>
        <span className="text-[10px] text-[#8a8a8a] bg-[#141414] border border-[#3e3e3e] px-2 py-0.5 rounded-full">
          This may take a few seconds
        </span>
      </div>
    )}

    {/* AI Sound Effects Generator Modal */}
    {sfxModalClipId && (
      <div className="fixed inset-0 bg-black/80 z-[500] flex items-center justify-center p-4 backdrop-blur-sm">
        <div className="w-full max-w-md bg-[#1e1e1e] border border-[#3e3e3e] rounded-xl shadow-2xl overflow-hidden flex flex-col">
          {/* Header */}
          <div className="p-4 bg-[#252525] border-b border-[#3e3e3e] flex justify-between items-center">
            <h3 className="text-sm font-semibold text-cyan-400 flex items-center gap-2">
              <Music className="w-4 h-4" />
              AI Sound Effects (SFX) Generator
            </h3>
            <button
              onClick={() => setSfxModalClipId(null)}
              className="text-[#a0a0a0] hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 space-y-4">
            {/* AI Suggestion Banner */}
            <div className="p-3 bg-[#141414] border border-[#3e3e3e] rounded-lg">
              {isAnalyzingSfx ? (
                <div className="flex items-center gap-2 text-xs text-[#a0a0a0]">
                  <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
                  <span>AI is analyzing clip tags and choosing a matching sound...</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-cyan-300">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>AI recommends category: <strong className="text-white uppercase">{sfxCategory}</strong></span>
                </div>
              )}
            </div>

            {/* Sound Name */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-[#8a8a8a] uppercase tracking-wider font-semibold">Sound Name</label>
              <input
                type="text"
                value={sfxName}
                onChange={(e) => setSfxName(e.target.value)}
                placeholder="Name of the sound effect"
                className="w-full bg-[#141414] text-white text-xs border border-[#3e3e3e] rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Category Dropdown */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-[#8a8a8a] uppercase tracking-wider font-semibold">SFX Category / Profile</label>
              <select
                value={sfxCategory}
                onChange={(e) => setSfxCategory(e.target.value)}
                className="w-full bg-[#141414] text-white text-xs border border-[#3e3e3e] rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500 cursor-pointer"
              >
                <option value="explosion">💥 Explosion (Crash, Boom, Hit)</option>
                <option value="laser">⚡ Laser (Zap, Ray Gun, Shot)</option>
                <option value="swoosh">💨 Swoosh (Wind Sweep, Whoosh, Pass)</option>
                <option value="jump">🦘 Retro Jump (Upward Sweep, Pop)</option>
                <option value="bubble">🫧 Bubble Pop (Liquid, Cute Click)</option>
                <option value="alarm">🚨 Alarm (Siren, Siren Alert, Beep)</option>
                <option value="click">🖱️ Click (UI Tick, Small Snap)</option>
                <option value="ambient">🌬️ Ambient (Wind Hum, Static, Room Tone)</option>
                <option value="waves">🌊 Ocean Waves (Water Flow, Deep Hum)</option>
                <option value="flying">✈️ Flying Drone (Engine Buzz, Flight Whoosh)</option>
                <option value="magic">✨ Magic Chimes (Sparkles, Fairy Dust)</option>
                <option value="punch">🤛 Punch / Hit (Impact Thud, Slap)</option>
                <option value="footsteps">👣 Footsteps (Walking, Gravel Steps)</option>
                <option value="gunshot">🔫 Gunshot Blast (Pistol Crack, Rifle Shot)</option>
                <option value="spark">⚡ Electrical Spark (Lightning Crackle)</option>
              </select>
            </div>

            {/* Duration Slider */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-[10px] text-[#8a8a8a] uppercase tracking-wider font-semibold">
                <span>Sound Duration</span>
                <span className="font-mono text-cyan-400">{sfxDuration.toFixed(1)}s</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="5.0"
                step="0.1"
                value={sfxDuration}
                onChange={(e) => setSfxDuration(Number(e.target.value))}
                className="w-full accent-cyan-400"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="p-4 bg-[#252525] border-t border-[#3e3e3e] flex gap-2 justify-end">
            <button
              onClick={() => setSfxModalClipId(null)}
              className="px-4 py-2 text-xs text-[#a0a0a0] hover:text-white transition-colors"
            >
              Cancel
            </button>

            <button
              onClick={handleAuditionSFX}
              className="px-4 py-2 text-xs border border-[#4e4e4e] hover:border-cyan-500/50 hover:bg-cyan-500/10 text-cyan-400 font-medium rounded-lg transition-all"
            >
              🔊 Audition Sound
            </button>

            <button
              onClick={handleGenerateSFX}
              disabled={isSynthesizingSfx || isAnalyzingSfx}
              className="px-4 py-2 text-xs bg-cyan-500 hover:bg-cyan-600 text-black font-semibold rounded-lg flex items-center gap-1.5 disabled:opacity-45 disabled:pointer-events-none transition-all shadow-lg hover:shadow-cyan-500/10"
            >
              {isSynthesizingSfx ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Synthesizing...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  Generate & Add
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* AI Sound Effects Auto-Cue Modal */}
    {sfxAutoCueClipId && (
      <div className="fixed inset-0 bg-black/80 z-[500] flex items-center justify-center p-4 backdrop-blur-sm">
        <div className="w-full max-w-md bg-[#1e1e1e] border border-[#3e3e3e] rounded-xl shadow-2xl overflow-hidden flex flex-col">
          {/* Header */}
          <div className="p-4 bg-[#252525] border-b border-[#3e3e3e] flex justify-between items-center">
            <h3 className="text-sm font-semibold text-pink-400 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-pink-400 font-semibold" />
              AI Sound Effects Auto-Cue Panel
            </h3>
            <button
              onClick={() => {
                if (!isAnalyzingAutoCue) setSfxAutoCueClipId(null);
              }}
              className="text-[#a0a0a0] hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Selector Tabs */}
          <div className="flex bg-[#141414] border-b border-[#3e3e3e] p-1">
            <button
              type="button"
              disabled={isAnalyzingAutoCue}
              onClick={() => setSfxAutoCueMode('visual')}
              className={`flex-1 py-2 text-xs rounded transition-all font-medium flex items-center justify-center gap-1.5 ${
                sfxAutoCueMode === 'visual'
                  ? 'bg-[#252525] text-white font-semibold shadow-inner border border-[#3e3e3e]'
                  : 'text-[#a0a0a0] hover:text-white disabled:opacity-50'
              }`}
            >
              👁️ Visual Motion Scan
            </button>
            <button
              type="button"
              disabled={isAnalyzingAutoCue}
              onClick={() => setSfxAutoCueMode('ai_script')}
              className={`flex-1 py-2 text-xs rounded transition-all font-medium flex items-center justify-center gap-1.5 ${
                sfxAutoCueMode === 'ai_script'
                  ? 'bg-[#252525] text-white font-semibold shadow-inner border border-[#3e3e3e]'
                  : 'text-[#a0a0a0] hover:text-white disabled:opacity-50'
              }`}
            >
              📝 AI Script Planner
            </button>
          </div>

          <div className="p-4 space-y-4">
            {isAnalyzingAutoCue ? (
              <div className="py-8 flex flex-col items-center justify-center space-y-4">
                <Loader2 className="w-8 h-8 text-pink-400 animate-spin" />
                <div className="text-center">
                  <p className="text-xs font-semibold text-white">
                    {sfxAutoCueMode === 'visual' ? 'Scanning Video Pixels...' : 'AI Planning Sound Cue Points...'}
                  </p>
                  <p className="text-[10px] text-[#8a8a8a] mt-1">This will automatically synthesize and place sounds.</p>
                </div>
                <div className="w-full max-w-xs bg-[#141414] h-2 rounded-full overflow-hidden border border-[#3e3e3e] mt-2">
                  <div
                    className="bg-pink-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${autoCueProgress}%` }}
                  />
                </div>
                <span className="text-[10px] font-mono text-pink-400 font-semibold">{autoCueProgress}% done</span>
              </div>
            ) : (
              <>
                {sfxAutoCueMode === 'visual' ? (
                  <div className="space-y-3">
                    <p className="text-xs text-[#a0a0a0] leading-relaxed">
                      This option scans the actual video track frames locally (in the browser). It detects **visual motion peaks, cuts, flashes, and transitions** and automatically generates and places swooshes and hits.
                    </p>
                    <div className="p-3 bg-pink-950/20 border border-pink-500/20 rounded-lg text-[10px] text-pink-300/90 leading-relaxed">
                      💡 <strong>Note:</strong> Perfect for fast-paced videos, gaming montages, transition-heavy shorts, or action edits! Runs completely offline in seconds.
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-[#a0a0a0] leading-relaxed">
                      Write a brief description of the action cue sequence happening in this video clip, and the AI will formulate precise timestamped sound cues for the timeline.
                    </p>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] text-[#8a8a8a] uppercase tracking-wider font-semibold">Video Action Script</label>
                      <textarea
                        value={sfxUserDescription}
                        onChange={(e) => setSfxUserDescription(e.target.value)}
                        placeholder="e.g., A player runs on grass, jumps, shoots a futuristic gun, and hits a target which explodes..."
                        className="w-full h-24 bg-[#141414] text-white text-xs border border-[#3e3e3e] rounded-lg p-2.5 resize-none focus:outline-none focus:border-pink-500 placeholder-[#5a5a5a] scrollbar-thin"
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Action Buttons */}
          <div className="p-4 bg-[#252525] border-t border-[#3e3e3e] flex gap-2 justify-end">
            <button
              disabled={isAnalyzingAutoCue}
              onClick={() => setSfxAutoCueClipId(null)}
              className="px-4 py-2 text-xs text-[#a0a0a0] hover:text-white transition-colors disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              onClick={handleAutoCueSFX}
              disabled={isAnalyzingAutoCue || (sfxAutoCueMode === 'ai_script' && !sfxUserDescription.trim())}
              className="px-5 py-2 text-xs bg-pink-500 hover:bg-pink-600 text-white font-semibold rounded-lg flex items-center gap-1.5 disabled:opacity-45 disabled:pointer-events-none transition-all shadow-lg hover:shadow-pink-500/10"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Run AI Auto-Cue
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
