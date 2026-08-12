/// <reference lib="webworker" />

export interface ExportWorkerConfig {
  fps: number;
  width: number;
  height: number;
  bitrate: number;
  format: 'mp4' | 'webm';
  filename: string;
  aspectRatio: string;
}

export interface AudioExportPayload {
  sampleRate: number;
  numberOfChannels: number;
  length: number;
  channels: Float32Array[];
}

import { FramePool } from './memory/FramePool';
import { FrameScheduler } from './FrameScheduler';
import { Compositor } from './Compositor';
import * as Mp4Muxer from 'mp4-muxer';

export type WorkerMessageType = 
  | { type: 'START_EXPORT'; payload: { timeline: any; config: ExportWorkerConfig; audioData?: AudioExportPayload | null } }
  | { type: 'CANCEL' };

let isExporting = false;
let isCancelled = false;

self.onmessage = async (event: MessageEvent<WorkerMessageType>) => {
  const message = event.data;

  switch (message.type) {
    case 'START_EXPORT':
      await handleExport(message.payload.timeline, message.payload.config, message.payload.audioData);
      break;
    case 'CANCEL':
      isCancelled = true;
      break;
  }
};

async function configureVideoEncoder(
  encoder: VideoEncoder,
  width: number,
  height: number,
  fps: number,
  bitrate: number
): Promise<void> {
  const candidateCodecs = [
    'avc1.4d002a', // Main Profile Level 4.2 (broadly supported)
    'avc1.42001f', // Baseline Profile Level 3.1
    'avc1.640028', // High Profile Level 4.0
    'avc1.42E01E', // Baseline
    'avc1.64001f', // High Profile Level 3.1
  ];

  // prefer-software FIRST: hardware encoders have OS-level inactivity timeouts
  // (QuotaExceededError: Codec reclaimed due to inactivity) when frames take too long.
  // Software encoders have no such timeout. We try hardware last as a bonus.
  const accelerationModes: ('prefer-software' | 'no-preference' | 'prefer-hardware')[] = [
    'prefer-software',
    'no-preference',
    'prefer-hardware',
  ];

  for (const accel of accelerationModes) {
    for (const codec of candidateCodecs) {
      const testConfig: VideoEncoderConfig = {
        codec,
        width,
        height,
        bitrate,
        framerate: fps,
        hardwareAcceleration: accel,
        avc: { format: 'avc' },
      };

      try {
        if (typeof VideoEncoder.isConfigSupported === 'function') {
          const support = await VideoEncoder.isConfigSupported(testConfig);
          if (support && support.supported) {
            encoder.configure(support.config || testConfig);
            return;
          }
        } else {
          encoder.configure(testConfig);
          return;
        }
      } catch {
        // try next candidate
      }
    }
  }

  // Fallback direct configuration if testing loop didn't catch
  encoder.configure({
    codec: 'avc1.42001f',
    width,
    height,
    bitrate,
    framerate: fps,
    avc: { format: 'avc' },
  });
}

async function handleExport(
  timeline: any,
  config: ExportWorkerConfig,
  audioData?: AudioExportPayload | null
) {
  console.log('[ExportWorker] STARTING v4 - Precise Coordinate Scaling', { width: config.width, height: config.height, fps: config.fps, aspect: config.aspectRatio });
  isExporting = true;
  isCancelled = false;

  let outputFileHandle: FileSystemFileHandle | null = null;
  let writable: FileSystemWritableFileStream | null = null;

  try {
    postMessage({ type: 'PHASE_CHANGE', payload: { phase: 'preparing' } });
    
    // Ensure dimensions are even numbers (multiples of 2) for H.264 video encoding
    const outputWidth = Math.floor(config.width / 2) * 2;
    const outputHeight = Math.floor(config.height / 2) * 2;

    // OPFS Initialization
    const root = await navigator.storage.getDirectory();
    const fileName = `${config.filename}.${config.format}`;
    outputFileHandle = await root.getFileHandle(fileName, { create: true });
    writable = await outputFileHandle.createWritable();

    // Frame Scheduler Initialization
    const framePool = new FramePool(30);
    const scheduler = new FrameScheduler(timeline, framePool);
    await scheduler.initializeDecoders();

    // Compositor Initialization
    const canvas = new OffscreenCanvas(outputWidth, outputHeight);
    const compositor = new Compositor(canvas, config.aspectRatio);

    // Calculate duration reliably
    let duration = timeline.duration || timeline.totalDuration || 0;
    if (!duration && timeline.tracks) {
      for (const track of timeline.tracks) {
        for (const clip of track.clips || []) {
          const end = (clip.startTime || 0) + (clip.duration || 0);
          if (end > duration) duration = end;
        }
      }
    }
    duration = Math.max(0.1, duration);
    const totalFrames = Math.max(1, Math.ceil(duration * config.fps));

    // Audio status & configuration check
    let hasAudio = false;
    let audioEncoder: AudioEncoder | null = null;

    if (audioData && audioData.channels && audioData.channels.length > 0 && audioData.length > 0) {
      const audioConfig: AudioEncoderConfig = {
        codec: 'mp4a.40.2', // AAC LC
        sampleRate: audioData.sampleRate || 48000,
        numberOfChannels: 2,
        bitrate: 128_000,
      };

      try {
        if (typeof AudioEncoder.isConfigSupported === 'function') {
          const support = await AudioEncoder.isConfigSupported(audioConfig);
          if (support && support.supported) {
            hasAudio = true;
          }
        } else {
          hasAudio = true;
        }
      } catch {
        hasAudio = false;
      }
    }

    // Muxer Initialization
    const muxerOptions: any = {
      target: new Mp4Muxer.FileSystemWritableFileStreamTarget(writable!),
      video: {
        codec: 'avc',
        width: outputWidth,
        height: outputHeight,
      },
      fastStart: false,
    };

    if (hasAudio) {
      muxerOptions.audio = {
        codec: 'aac',
        numberOfChannels: 2,
        sampleRate: audioData!.sampleRate || 48000,
      };
    }

    const muxer = new Mp4Muxer.Muxer(muxerOptions);

    // VideoEncoder Initialization
    const videoEncoder = new VideoEncoder({
      output: (chunk, meta) => {
        muxer.addVideoChunk(chunk, meta);
      },
      error: (e) => console.error('VideoEncoder error:', e),
    });

    await configureVideoEncoder(
      videoEncoder,
      outputWidth,
      outputHeight,
      config.fps,
      config.bitrate || 8_000_000
    );

    // AudioEncoder Initialization
    if (hasAudio) {
      audioEncoder = new AudioEncoder({
        output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
        error: (e) => console.error('AudioEncoder error:', e),
      });

      audioEncoder.configure({
        codec: 'mp4a.40.2', // AAC LC
        sampleRate: audioData!.sampleRate || 48000,
        numberOfChannels: 2,
        bitrate: 128_000,
      });
    }

    postMessage({ type: 'PHASE_CHANGE', payload: { phase: 'rendering' } });
    
    // Render video frames
    for (let i = 0; i < totalFrames; i++) {
      if (isCancelled) {
        throw new Error('Export cancelled');
      }
      
      const timestampSeconds = i / config.fps;
      const layers = await scheduler.getLayersAtTime(timestampSeconds);

      // Render frame with WebGL (or 2D fallback if context lost)
      await compositor.render(layers);
      
      // Capture the canvas and encode it
      const timestampMicroseconds = Math.round(i * (1_000_000 / config.fps));
      const vf = new VideoFrame(canvas, { timestamp: timestampMicroseconds });
      
      // Force a keyframe on the first frame and every 2 seconds
      const keyFrame = i === 0 || i % (config.fps * 2) === 0;
      videoEncoder.encode(vf, { keyFrame });
      
      vf.close();
      
      // Cleanup frames for this tick
      for (const layer of layers) {
        if (layer.frame) {
          layer.frame.close();
        }
      }

      // Periodically flush the encoder to prevent OS codec inactivity reclaim
      // (QuotaExceededError). Every 30 frames keeps the codec warm.
      if (i > 0 && i % 30 === 0) {
        await videoEncoder.flush();
      }

      const progress = ((i + 1) / totalFrames) * (hasAudio ? 70 : 90);
      
      if (i % 10 === 0 || i === totalFrames - 1) {
        postMessage({ 
          type: 'PROGRESS', 
          payload: { progress, currentFrame: i + 1, eta: 0 }, 
        });
      }
    }

    // Process Audio Encoding if audio is present
    if (hasAudio && audioEncoder && audioData) {
      postMessage({ type: 'PHASE_CHANGE', payload: { phase: 'encoding' } });
      
      const numFrames = 1024; // AAC strictly requires fixed 1024 frames per AudioData chunk
      const totalSamples = audioData.length;
      const ch0 = audioData.channels[0];
      const ch1 = audioData.channels[1] || ch0;
      const sampleRate = audioData.sampleRate || 48000;
      
      for (let offset = 0; offset < totalSamples; offset += numFrames) {
        const remaining = totalSamples - offset;
        const frameCount = Math.min(numFrames, remaining);
        
        // Zero-padded buffer to exactly 1024 samples per channel for AAC encoder compliance
        const planarData = new Float32Array(numFrames * 2);
        planarData.set(ch0.subarray(offset, offset + frameCount), 0);
        planarData.set(ch1.subarray(offset, offset + frameCount), numFrames);
        
        const timestampUs = Math.round((offset / sampleRate) * 1_000_000);
        
        const audioChunk = new AudioData({
          format: 'f32-planar',
          sampleRate: sampleRate,
          numberOfFrames: numFrames,
          numberOfChannels: 2,
          timestamp: timestampUs,
          data: planarData,
        });
        
        audioEncoder.encode(audioChunk);
        audioChunk.close();
      }
    }
    
    // Flush the encoders to finish writing all frames
    await Promise.all([
      videoEncoder.flush(),
      audioEncoder ? audioEncoder.flush() : Promise.resolve(),
    ]);
    
    videoEncoder.close();
    if (audioEncoder) audioEncoder.close();

    postMessage({ type: 'PHASE_CHANGE', payload: { phase: 'muxing' } });
    
    // Finalize MP4 Muxer
    muxer.finalize();

    // Finalize OPFS stream
    if (writable) {
      await writable.close();
      writable = null;
    }
    
    compositor.dispose();
    scheduler.dispose();
    framePool.clear();

    const file = await outputFileHandle.getFile();

    postMessage({ 
      type: 'COMPLETE', 
      payload: { fileSize: file.size, filename: fileName }, 
    });

  } catch (error: any) {
    postMessage({ 
      type: 'ERROR', 
      payload: { message: error.message }, 
    });
  } finally {
    isExporting = false;
    if (writable) {
      await writable.close().catch(() => {});
    }
  }
}
