/// <reference lib="webworker" />

export interface ExportWorkerConfig {
  fps: number;
  width: number;
  height: number;
  bitrate: number;
  format: 'mp4' | 'webm';
  filename: string;
}

import { FramePool } from './memory/FramePool';
import { FrameScheduler } from './FrameScheduler';
import { Compositor } from './Compositor';
import { AudioMixer } from './AudioMixer';
import * as Mp4Muxer from 'mp4-muxer';

export type WorkerMessageType = 
  | { type: 'START_EXPORT'; payload: { timeline: any; config: ExportWorkerConfig } }
  | { type: 'CANCEL' };

let isExporting = false;
let isCancelled = false;

self.onmessage = async (event: MessageEvent<WorkerMessageType>) => {
  const message = event.data;

  switch (message.type) {
    case 'START_EXPORT':
      await handleExport(message.payload.timeline, message.payload.config);
      break;
    case 'CANCEL':
      isCancelled = true;
      break;
  }
};

async function handleExport(timeline: any, config: ExportWorkerConfig) {
  isExporting = true;
  isCancelled = false;

  let outputFileHandle: FileSystemFileHandle | null = null;
  let writable: FileSystemWritableFileStream | null = null;

  try {
    postMessage({ type: 'PHASE_CHANGE', payload: { phase: 'preparing' } });
    
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
    const canvas = new OffscreenCanvas(config.width, config.height);
    const compositor = new Compositor(canvas);

    // Muxer and VideoEncoder Initialization
    const muxer = new Mp4Muxer.Muxer({
      target: new Mp4Muxer.FileSystemWritableFileStreamTarget(writable!),
      video: {
        codec: 'avc',
        width: config.width,
        height: config.height
      },
      audio: {
        codec: 'aac',
        numberOfChannels: 2,
        sampleRate: 48000
      },
      fastStart: false
    });

    const videoEncoder = new VideoEncoder({
      output: (chunk, meta) => {
        if (meta) {
          // WebCodecs on some browsers outputs null for colorSpace or decoderConfig
          // which crashes mp4-muxer's internal checks. We sanitize it here.
          if (meta.decoderConfig === null) {
            delete (meta as any).decoderConfig;
          } else if (meta.decoderConfig && meta.decoderConfig.colorSpace === null) {
            delete (meta.decoderConfig as any).colorSpace;
          }
        }
        muxer.addVideoChunk(chunk, meta);
      },
      error: (e) => console.error('VideoEncoder error:', e)
    });

    const audioEncoder = new AudioEncoder({
      output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
      error: (e) => console.error('AudioEncoder error:', e)
    });

    videoEncoder.configure({
      codec: 'avc1.640028', // High Profile, Level 4.0
      width: config.width,
      height: config.height,
      hardwareAcceleration: 'prefer-hardware',
      bitrate: 8_000_000, // 8 Mbps
      framerate: config.fps,
    });

    audioEncoder.configure({
      codec: 'mp4a.40.2', // AAC LC
      sampleRate: 48000,
      numberOfChannels: 2,
      bitrate: 128_000
    });

    const totalFrames = Math.ceil(timeline.duration * config.fps);

    postMessage({ type: 'PHASE_CHANGE', payload: { phase: 'rendering' } });
    
    for (let i = 0; i < totalFrames; i++) {
      if (isCancelled) {
        throw new Error('Export cancelled');
      }
      
      const timestampSeconds = i / config.fps;
      const layers = await scheduler.getLayersAtTime(timestampSeconds);

      // Render frame with WebGL
      await compositor.render(layers);
      
      // Capture the canvas and encode it
      const timestampMicroseconds = Math.round(i * (1_000_000 / config.fps));
      const vf = new VideoFrame(canvas, { timestamp: timestampMicroseconds });
      
      // Force a keyframe every 2 seconds
      const keyFrame = i % (config.fps * 2) === 0;
      videoEncoder.encode(vf, { keyFrame });
      
      vf.close();
      
      // Cleanup frames for this tick
      for (const layer of layers) {
        if (layer.frame) {
          layer.frame.close();
        }
      }

      const progress = ((i + 1) / totalFrames) * 100;
      
      if (i % 10 === 0 || i === totalFrames - 1) {
        postMessage({ 
          type: 'PROGRESS', 
          payload: { progress, currentFrame: i + 1, eta: 0 } 
        });
      }
    }

    postMessage({ type: 'PHASE_CHANGE', payload: { phase: 'encoding' } });
    
    // Process Audio
    const audioMixer = new AudioMixer();
    const masterAudioBuffer = await audioMixer.mix(timeline, timeline.duration);
    
    if (masterAudioBuffer) {
      const numFrames = 1024; // AAC typical chunk size
      const totalSamples = masterAudioBuffer.length;
      const ch0 = masterAudioBuffer.getChannelData(0);
      const ch1 = masterAudioBuffer.numberOfChannels > 1 ? masterAudioBuffer.getChannelData(1) : ch0;
      
      for (let offset = 0; offset < totalSamples; offset += numFrames) {
        const frameCount = Math.min(numFrames, totalSamples - offset);
        
        const planarData = new Float32Array(frameCount * 2);
        planarData.set(ch0.subarray(offset, offset + frameCount), 0);
        planarData.set(ch1.subarray(offset, offset + frameCount), frameCount);
        
        const timestampUs = Math.round((offset / 48000) * 1_000_000);
        
        const audioData = new AudioData({
          format: 'f32-planar',
          sampleRate: 48000,
          numberOfFrames: frameCount,
          numberOfChannels: 2,
          timestamp: timestampUs,
          data: planarData
        });
        
        audioEncoder.encode(audioData);
        audioData.close();
      }
    }
    
    // Flush the encoders to finish writing all frames
    await Promise.all([
      videoEncoder.flush(),
      masterAudioBuffer ? audioEncoder.flush() : Promise.resolve()
    ]);
    
    videoEncoder.close();
    audioEncoder.close();

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
      payload: { fileSize: file.size, filename: fileName } 
    });

  } catch (error: any) {
    postMessage({ 
      type: 'ERROR', 
      payload: { message: error.message } 
    });
  } finally {
    isExporting = false;
    if (writable) {
      await writable.close().catch(() => {});
    }
  }
}
