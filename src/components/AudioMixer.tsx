import React, { useEffect, useRef, useState } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { Volume2, VolumeX, Music, Film, Radio, Sliders } from 'lucide-react';
import type { TimelineTrack } from '@/types';

export function AudioMixer() {
  const {
    tracks,
    volume: masterVolume,
    isMuted: isMasterMuted,
    setVolume: setMasterVolume,
    toggleMute: toggleMasterMute,
    setTrackVolume,
    setTrackPan,
    toggleTrackSolo,
    toggleTrackMute,
  } = useEditorStore();

  // (activePanTrack state removed — M14 fix: it was declared but never used)

  // Audio tracks and video tracks with audio
  const audioCapableTracks = tracks.filter(t => t.type === 'audio' || t.type === 'video');

  return (
    <div className="h-full w-full bg-[#1e1e1e] flex flex-col overflow-hidden select-none">
      {/* Mixer Header */}
      <div className="h-8 shrink-0 bg-[#252525] border-b border-[#3e3e3e] flex items-center px-4 justify-between">
        <div className="flex items-center gap-1.5 text-[#a0a0a0]">
          <Sliders className="w-3.5 h-3.5 text-amber-500" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-white">Audio Mixer</span>
        </div>
        <div className="text-[10px] text-[#6a6a6a]">
          Double-click Pan slider to reset to center (C)
        </div>
      </div>

      {/* Mixer Board */}
      <div className="flex-1 flex overflow-x-auto p-4 gap-4 bg-[#1a1a1a] scrollbar-thin">
        {/* Track Channels */}
        {audioCapableTracks.map((track) => (
          <ChannelStrip
            key={track.id}
            track={track}
            onVolumeChange={(val) => setTrackVolume(track.id, val)}
            onPanChange={(val) => setTrackPan(track.id, val)}
            onMuteToggle={() => toggleTrackMute(track.id)}
            onSoloToggle={() => toggleTrackSolo(track.id)}
          />
        ))}

        {/* Master Channel Strip Separator */}
        <div className="w-px self-stretch bg-[#3e3e3e] my-1" />

        {/* Master Channel Strip */}
        <MasterChannelStrip
          volume={masterVolume}
          isMuted={isMasterMuted}
          onVolumeChange={setMasterVolume}
          onMuteToggle={toggleMasterMute}
        />
      </div>
    </div>
  );
}

// ─── Individual Track Channel Strip ──────────────────────────────────────────

interface ChannelStripProps {
  track: TimelineTrack;
  onVolumeChange: (val: number) => void;
  onPanChange: (val: number) => void;
  onMuteToggle: () => void;
  onSoloToggle: () => void;
}

function ChannelStrip({ track, onVolumeChange, onPanChange, onMuteToggle, onSoloToggle }: ChannelStripProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const levelRef = useRef<number>(0);
  const peakRef = useRef<number>(0);
  const peakHoldTimeRef = useRef<number>(0);

  const volume = track.volume ?? 1;
  const pan = track.pan ?? 0;
  const isMuted = track.muted || false;
  const isSolo = track.solo || false;

  // Real-time VU meter canvas draw loop — FIX M13: stop rAF when not visible
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isVisible = !document.hidden;

    const handleVisibilityChange = () => {
      isVisible = !document.hidden;
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // IntersectionObserver: pause loop when canvas is off-screen
    const observer = new IntersectionObserver((entries) => {
      isVisible = entries[0]?.isIntersecting && !document.hidden;
    }, { threshold: 0 });
    observer.observe(canvas);

    const drawMeter = () => {
      if (!isVisible) {
        animationRef.current = requestAnimationFrame(drawMeter);
        return;
      }

      const analysers = (window as any).procutTrackAnalysers;
      const analyser = analysers?.get(track.id);

      let peakVal = 0;

      if (analyser) {
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteTimeDomainData(dataArray);

        // Find the maximum absolute value from center (128)
        let maxVal = 0;
        for (let i = 0; i < bufferLength; i++) {
          const val = Math.abs(dataArray[i] - 128) / 128;
          if (val > maxVal) maxVal = val;
        }
        peakVal = maxVal;
      }

      // Smooth levels
      let level = levelRef.current;
      if (peakVal > level) {
        level = peakVal;
      } else {
        level = level * 0.85 + peakVal * 0.15; // smooth decay
      }
      levelRef.current = level;

      // Peak hold logic
      let peak = peakRef.current;
      if (level > peak) {
        peak = level;
        peakHoldTimeRef.current = 30; // hold for 30 frames
      } else {
        if (peakHoldTimeRef.current > 0) {
          peakHoldTimeRef.current -= 1;
        } else {
          peak = peak * 0.96; // decay peak line
        }
      }
      peakRef.current = peak;

      // Convert to logarithmic Decibel scale (dBFS: -60 dB to 0 dB)
      let db = -60;
      if (level > 0.001) {
        db = 20 * Math.log10(level);
      }
      const normalizedLevel = Math.max(0, Math.min(1, (db + 60) / 60));

      let peakDb = -60;
      if (peak > 0.001) {
        peakDb = 20 * Math.log10(peak);
      }
      const normalizedPeak = Math.max(0, Math.min(1, (peakDb + 60) / 60));

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Background strip
      ctx.fillStyle = '#1e1e1e';
      ctx.fillRect(0, 0, w, h);

      // Render levels inside fader limits
      const fillHeight = Math.min(h, normalizedLevel * h);
      if (fillHeight > 0) {
        const grad = ctx.createLinearGradient(0, h, 0, 0);
        grad.addColorStop(0, '#10b981'); // green
        grad.addColorStop(0.7, '#10b981');
        grad.addColorStop(0.85, '#f59e0b'); // yellow
        grad.addColorStop(0.95, '#ef4444'); // red

        ctx.fillStyle = grad;
        ctx.fillRect(0, h - fillHeight, w, fillHeight);
      }

      // Render Peak Hold line
      const peakY = h - (normalizedPeak * h);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, Math.max(0, peakY - 1), w, 2);

      animationRef.current = requestAnimationFrame(drawMeter);
    };

    animationRef.current = requestAnimationFrame(drawMeter);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      observer.disconnect();
    };
  }, [track.id]);

  const formatPanLabel = (val: number) => {
    if (Math.abs(val) < 0.05) return 'C';
    return val < 0 ? `L${Math.abs(Math.round(val * 100))}` : `R${Math.round(val * 100)}`;
  };

  return (
    <div className="w-20 flex flex-col items-center select-none bg-[#232323] border border-[#2d2d2d] rounded py-2 shrink-0">
      {/* Pan slider */}
      <div className="w-full px-2 flex flex-col items-center gap-0.5 mb-2">
        <span className="text-[9px] text-[#a0a0a0] uppercase tracking-wide">Pan</span>
        <span className="text-[10px] font-mono text-amber-500 font-semibold">
          {formatPanLabel(pan)}
        </span>
        <input
          type="range"
          min={-1}
          max={1}
          step={0.05}
          value={pan}
          onDoubleClick={() => onPanChange(0)}
          onChange={(e) => onPanChange(Number(e.target.value))}
          className="w-full h-1 bg-[#3e3e3e] rounded appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-2 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
          title="Drag to adjust stereo panning. Double click to center."
        />
      </div>

      {/* Mute & Solo */}
      <div className="flex gap-1 mb-3">
        {/* Solo */}
        <button
          onClick={onSoloToggle}
          className={`w-6 h-5 rounded text-[10px] font-bold border transition-colors flex items-center justify-center ${
            isSolo
              ? 'bg-amber-500/20 border-amber-500 text-amber-400'
              : 'bg-[#1a1a1a] border-[#3e3e3e] text-[#6a6a6a] hover:text-[#a0a0a0]'
          }`}
          title="Solo Track"
        >
          S
        </button>
        {/* Mute */}
        <button
          onClick={onMuteToggle}
          className={`w-6 h-5 rounded text-[10px] font-bold border transition-colors flex items-center justify-center ${
            isMuted
              ? 'bg-red-500/20 border-red-500 text-red-400'
              : 'bg-[#1a1a1a] border-[#3e3e3e] text-[#6a6a6a] hover:text-[#a0a0a0]'
          }`}
          title="Mute Track"
        >
          M
        </button>
      </div>

      {/* Fader & VU Meter side-by-side */}
      <div className="flex h-36 gap-2.5 items-stretch relative">
        {/* VU Meter Canvas */}
        <canvas
          ref={canvasRef}
          width={8}
          height={144}
          className="w-2 rounded bg-black border border-[#1e1e1e]"
        />

        {/* Fader Input — FIX H13: disable fader when muted so drag doesn't change volume invisibly */}
        <div className="relative w-4 flex flex-col justify-center items-center">
          <input
            type="range"
            min={0}
            max={1.0}
            step={0.01}
            value={isMuted ? 0 : volume}
            disabled={isMuted}
            onChange={(e) => !isMuted && onVolumeChange(Number(e.target.value))}
            style={{ writingMode: 'bt-lr', WebkitAppearance: 'slider-vertical' } as any}
            className={`h-36 w-4 bg-[#1e1e1e] border border-[#2d2d2d] rounded appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-black [&::-webkit-slider-thumb]:rounded-sm ${
              isMuted ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
            }`}
          />
        </div>
      </div>

      {/* Value */}
      <div className="text-[10px] font-mono text-[#a0a0a0] mt-2 mb-1">
        {volume <= 0.001 ? '-∞ dB' : `${(20 * Math.log10(volume)).toFixed(1)} dB`}
      </div>

      {/* Track Label */}
      <div className="w-full border-t border-[#2d2d2d] pt-1.5 px-1.5 flex items-center justify-center gap-1">
        {track.type === 'video' ? (
          <Film className="w-3 h-3 text-blue-400 shrink-0" />
        ) : (
          <Music className="w-3 h-3 text-emerald-400 shrink-0" />
        )}
        <span className="text-[10px] font-semibold text-white truncate max-w-full">
          {track.name}
        </span>
      </div>
    </div>
  );
}

// ─── Master Channel Strip ──────────────────────────────────────────────────

interface MasterChannelStripProps {
  volume: number;
  isMuted: boolean;
  onVolumeChange: (val: number) => void;
  onMuteToggle: () => void;
}

function MasterChannelStrip({ volume, isMuted, onVolumeChange, onMuteToggle }: MasterChannelStripProps) {
  const levelLRef = useRef<number>(0);
  const levelRRef = useRef<number>(0);
  const peakLRef = useRef<number>(0);
  const peakRRef = useRef<number>(0);
  const peakHoldTimeLRef = useRef<number>(0);
  const peakHoldTimeRRef = useRef<number>(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  // Real-time VU meter canvas draw loop for Master
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const drawMeter = () => {
      const analyserL = (window as any).procutMasterAnalyserL;
      const analyserR = (window as any).procutMasterAnalyserR;

      let peakValL = 0;
      let peakValR = 0;

      if (analyserL) {
        const bufferLength = analyserL.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyserL.getByteTimeDomainData(dataArray);
        let maxVal = 0;
        for (let i = 0; i < bufferLength; i++) {
          const val = Math.abs(dataArray[i] - 128) / 128;
          if (val > maxVal) maxVal = val;
        }
        peakValL = maxVal;
      }

      if (analyserR) {
        const bufferLength = analyserR.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyserR.getByteTimeDomainData(dataArray);
        let maxVal = 0;
        for (let i = 0; i < bufferLength; i++) {
          const val = Math.abs(dataArray[i] - 128) / 128;
          if (val > maxVal) maxVal = val;
        }
        peakValR = maxVal;
      }

      // Smooth levels L
      let levelL = levelLRef.current;
      if (peakValL > levelL) {
        levelL = peakValL;
      } else {
        levelL = levelL * 0.85 + peakValL * 0.15;
      }
      levelLRef.current = levelL;

      // Peak hold L
      let peakL = peakLRef.current;
      if (levelL > peakL) {
        peakL = levelL;
        peakHoldTimeLRef.current = 30;
      } else {
        if (peakHoldTimeLRef.current > 0) {
          peakHoldTimeLRef.current -= 1;
        } else {
          peakL = peakL * 0.96;
        }
      }
      peakLRef.current = peakL;

      // Smooth levels R
      let levelR = levelRRef.current;
      if (peakValR > levelR) {
        levelR = peakValR;
      } else {
        levelR = levelR * 0.85 + peakValR * 0.15;
      }
      levelRRef.current = levelR;

      // Peak hold R
      let peakR = peakRRef.current;
      if (levelR > peakR) {
        peakR = levelR;
        peakHoldTimeRRef.current = 30;
      } else {
        if (peakHoldTimeRRef.current > 0) {
          peakHoldTimeRRef.current -= 1;
        } else {
          peakR = peakR * 0.96;
        }
      }
      peakRRef.current = peakR;

      // Convert L & R to decibels and normalize to [0, 1]
      const toDb = (val: number) => {
        if (val <= 0.001) return -60;
        return 20 * Math.log10(val);
      };
      const norm = (dbVal: number) => Math.max(0, Math.min(1, (dbVal + 60) / 60));

      const normLevelL = norm(toDb(levelL));
      const normLevelR = norm(toDb(levelR));
      const normPeakL  = norm(toDb(peakL));
      const normPeakR  = norm(toDb(peakR));

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Background strip
      ctx.fillStyle = '#1e1e1e';
      ctx.fillRect(0, 0, w, h);

      const grad = ctx.createLinearGradient(0, h, 0, 0);
      grad.addColorStop(0, '#10b981');
      grad.addColorStop(0.7, '#10b981');
      grad.addColorStop(0.85, '#f59e0b');
      grad.addColorStop(0.95, '#ef4444');
      ctx.fillStyle = grad;

      // Render L channel
      const fillHeightL = Math.min(h, normLevelL * h);
      if (fillHeightL > 0) {
        ctx.fillRect(0, h - fillHeightL, w / 2 - 1, fillHeightL);
      }

      // Render R channel
      const fillHeightR = Math.min(h, normLevelR * h);
      if (fillHeightR > 0) {
        ctx.fillRect(w / 2 + 1, h - fillHeightR, w / 2 - 1, fillHeightR);
      }

      // Render L/R Peak Hold lines
      ctx.fillStyle = '#ffffff';
      const peakYL = h - (normPeakL * h);
      ctx.fillRect(0, Math.max(0, peakYL - 1), w / 2 - 1, 2);
      const peakYR = h - (normPeakR * h);
      ctx.fillRect(w / 2 + 1, Math.max(0, peakYR - 1), w / 2 - 1, 2);

      animationRef.current = requestAnimationFrame(drawMeter);
    };

    animationRef.current = requestAnimationFrame(drawMeter);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  return (
    <div className="w-24 flex flex-col items-center select-none bg-[#292929] border border-amber-500/20 rounded py-2 shrink-0 shadow-lg">
      <div className="w-full px-2 flex flex-col items-center gap-0.5 mb-2">
        <span className="text-[9px] text-[#a0a0a0] uppercase tracking-wide">Output</span>
        <span className="text-[10px] font-mono text-red-500 font-semibold">LR</span>
      </div>

      {/* Mute */}
      <div className="mb-3">
        <button
          onClick={onMuteToggle}
          className={`w-14 h-5 rounded text-[10px] font-bold border transition-colors flex items-center justify-center gap-1 ${
            isMuted
              ? 'bg-red-500/20 border-red-500 text-red-400'
              : 'bg-[#1a1a1a] border-[#3e3e3e] text-[#6a6a6a] hover:text-[#a0a0a0]'
          }`}
          title="Mute Master Output"
        >
          {isMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
          MUTE
        </button>
      </div>

      {/* Fader & VU Meter side-by-side */}
      <div className="flex h-36 gap-2.5 items-stretch relative">
        {/* VU Meter Canvas (wider for dual LR channels) */}
        <canvas
          ref={canvasRef}
          width={16}
          height={144}
          className="w-4 rounded bg-black border border-[#1e1e1e]"
        />

        {/* Fader Input */}
        <div className="relative w-4 flex flex-col justify-center items-center">
          <input
            type="range"
            min={0}
            max={1.0}
            step={0.01}
            value={isMuted ? 0 : volume}
            onChange={(e) => onVolumeChange(Number(e.target.value))}
            style={{ writingMode: 'bt-lr', WebkitAppearance: 'slider-vertical' } as any}
            className="h-36 w-4 bg-[#1e1e1e] border border-[#2d2d2d] rounded cursor-pointer appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-black [&::-webkit-slider-thumb]:rounded-sm"
          />
        </div>
      </div>

      {/* Value */}
      <div className="text-[10px] font-mono text-amber-400 mt-2 mb-1 font-semibold">
        {isMuted || volume <= 0.001 ? '-∞ dB' : `${(20 * Math.log10(volume)).toFixed(1)} dB`}
      </div>

      {/* Track Label */}
      <div className="w-full border-t border-[#3e3e3e] pt-1.5 px-1.5 flex items-center justify-center gap-1">
        <Radio className="w-3.5 h-3.5 text-amber-500 shrink-0 animate-pulse" />
        <span className="text-[10px] font-bold text-white uppercase tracking-wider">
          MASTER
        </span>
      </div>
    </div>
  );
}
