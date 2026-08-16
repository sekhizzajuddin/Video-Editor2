/// <reference lib="webworker" />

export interface ExportWorkerConfig {
  fps: number;
  width: number;
  height: number;
  bitrate: number;
  format: 'mp4' | 'webm' | 'gif' | 'prores' | 'wav';
  filename: string;
  aspectRatio: string;
  outputFolder?: string;
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
  | { type: 'START_EXPORT'; payload: { timeline: any; config: ExportWorkerConfig; audioData?: AudioExportPayload | null; fileHandle?: FileSystemFileHandle | null } }
  | { type: 'CANCEL' };

let isExporting = false;
let isCancelled = false;

self.onmessage = async (event: MessageEvent<WorkerMessageType>) => {
  const message = event.data;

  switch (message.type) {
    case 'START_EXPORT':
      await handleExport(
        message.payload.timeline, 
        message.payload.config, 
        message.payload.audioData,
        message.payload.fileHandle
      );
      break;
    case 'CANCEL':
      isCancelled = true;
      break;
  }
};

/**
 * Resolve on the encoder's next `dequeue` event (fired whenever encodeQueueSize
 * drops), or after `timeoutMs` for engines that don't emit it.
 */
function waitForEncoderDrain(encoder: VideoEncoder, timeoutMs: number): Promise<void> {
  return new Promise<void>((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      encoder.removeEventListener('dequeue', done);
      resolve();
    };
    const timer = setTimeout(done, timeoutMs);
    encoder.addEventListener('dequeue', done);
  });
}

async function configureVideoEncoder(
  encoder: VideoEncoder,
  width: number,
  height: number,
  fps: number,
  bitrate: number,
  useAnnexB: boolean = false
): Promise<void> {
  const candidateCodecs = [
    'avc1.4d002a', // Main Profile Level 4.2
    'avc1.42001f', // Baseline Profile Level 3.1
    'avc1.640028', // High Profile Level 4.0
    'avc1.42E01E', // Baseline
    'avc1.64001f', // High Profile Level 3.1
  ];

  const avcFormat = useAnnexB ? 'annexb' : 'avc';

  const accelerationModes: ('prefer-hardware' | 'no-preference' | 'prefer-software')[] = [
    'prefer-hardware',
    'no-preference',
    'prefer-software',
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
        bitrateMode: 'constant',
        latencyMode: 'quality', // Critical: Prevents frame dropping during heavy encoding!
        avc: { format: avcFormat },
      };

      try {
        if (typeof VideoEncoder !== 'undefined' && typeof VideoEncoder.isConfigSupported === 'function') {
          const support = await VideoEncoder.isConfigSupported(testConfig);
          if (support && support.supported) {
            encoder.configure(support.config || testConfig);
            console.log(`[ExportWorker] Configured VideoEncoder with codec: ${codec}, accel: ${accel}, format: ${avcFormat}`);
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

  // Fallback direct configuration
  encoder.configure({
    codec: 'avc1.42001f',
    width,
    height,
    bitrate,
    framerate: fps,
    avc: { format: avcFormat },
  });
}

async function handleExport(
  timeline: any,
  config: ExportWorkerConfig,
  audioData?: AudioExportPayload | null,
  fileHandle?: FileSystemFileHandle | null
) {
  console.log('[ExportWorker] STARTING v9 - Standalone Browser & Runtime Export', { width: config.width, height: config.height, fps: config.fps, aspect: config.aspectRatio });
  isExporting = true;
  isCancelled = false;

  let outputFileHandle: FileSystemFileHandle | null = null;
  let writable: FileSystemWritableFileStream | null = null;

  try {
    postMessage({ type: 'PHASE_CHANGE', payload: { phase: 'preparing' } });
    
    // Ensure dimensions are even numbers (multiples of 2) for H.264 video encoding
    const outputWidth = Math.floor(config.width / 2) * 2;
    const outputHeight = Math.floor(config.height / 2) * 2;

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

    if (audioData && audioData.channels && audioData.channels.length > 0 && audioData.length > 0 && audioData.channels[0]) {
      const audioConfig: AudioEncoderConfig = {
        codec: 'mp4a.40.2', // AAC LC
        sampleRate: audioData.sampleRate || 48000,
        numberOfChannels: 2,
        bitrate: 128_000,
      };

      try {
        if (typeof AudioEncoder !== 'undefined' && typeof AudioEncoder.isConfigSupported === 'function') {
          const support = await AudioEncoder.isConfigSupported(audioConfig);
          if (support && support.supported) {
            hasAudio = true;
          }
        }
      } catch {
        hasAudio = false;
      }
    }

    let ws: WebSocket | null = null;
    let useLocalRuntime = false;

    // Try to connect to Hikmah Runtime (single WS attempt with short timeout)
    try {
      const testWs = new WebSocket('ws://127.0.0.1:12589');
      const isConnected = await new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => {
          try { testWs.close(); } catch {}
          resolve(false);
        }, 400);
        testWs.onopen = () => {
          clearTimeout(timer);
          resolve(true);
        };
        testWs.onerror = () => {
          clearTimeout(timer);
          resolve(false);
        };
      });

      if (isConnected) {
        ws = testWs;
        ws.send(JSON.stringify({
          action: 'START_FILE_EXPORT',
          filename: config.filename || 'Export',
          outputFolder: config.outputFolder || '',
          width: outputWidth,
          height: outputHeight,
          fps: config.fps,
          bitrate: config.bitrate || 12000000,
          format: config.format
        }));
        useLocalRuntime = true;
        console.log('[ExportWorker] Connected to Hikmah Local Runtime');
      }
    } catch (e) {
      console.warn('[ExportWorker] Hikmah Runtime connection fallback:', e);
    }

    // Direct Disk Writable / OPFS Initialization (ONLY if not using local runtime)
    let muxer: any = null;
    if (!useLocalRuntime) {
      if (fileHandle) {
        outputFileHandle = fileHandle;
      } else {
        const root = await navigator.storage.getDirectory();
        const fileName = `${config.filename}.${config.format}`;
        outputFileHandle = await root.getFileHandle(fileName, { create: true });
      }
      writable = await outputFileHandle.createWritable();

      const muxerOptions: any = {
        target: new Mp4Muxer.FileSystemWritableFileStreamTarget(writable),
        video: {
          codec: 'avc',
          width: outputWidth,
          height: outputHeight,
        },
        fastStart: 'in-memory',
      };

      if (hasAudio) {
        muxerOptions.audio = {
          codec: 'aac',
          numberOfChannels: 2,
          sampleRate: audioData!.sampleRate || 48000,
        };
      }
      muxer = new Mp4Muxer.Muxer(muxerOptions);
    }

    // Video Encoder
    const videoEncoder = new VideoEncoder({
      output: (chunk, meta) => {
        if (useLocalRuntime && ws && ws.readyState === WebSocket.OPEN) {
          const buffer = new ArrayBuffer(chunk.byteLength);
          chunk.copyTo(buffer);
          ws.send(buffer);
        } else if (muxer) {
          muxer.addVideoChunk(chunk, meta);
        }
      },
      error: e => {
        console.error('[ExportWorker] Video encoder error:', e);
        postMessage({ type: 'ERROR', payload: { message: `Video encoder failed: ${e.message}` } });
      }
    });

    // Configure video encoder using supported profile lookup
    await configureVideoEncoder(
      videoEncoder,
      outputWidth,
      outputHeight,
      config.fps,
      config.bitrate || 12000000,
      useLocalRuntime
    );

    // Audio Encoder
    if (hasAudio && !useLocalRuntime && typeof AudioEncoder !== 'undefined') {
      audioEncoder = new AudioEncoder({
        output: (chunk, meta) => muxer!.addAudioChunk(chunk, meta),
        error: e => console.error('[ExportWorker] Audio encoder error:', e)
      });
      audioEncoder.configure({
        codec: 'mp4a.40.2',
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
      // getFramePlanAtTime also resolves clip-to-clip transitions (layer blend +
      // any full-frame overlay) using the same engine the preview uses, so the
      // exported file matches what the user saw.
      const { layers, overlays } = await scheduler.getFramePlanAtTime(timestampSeconds);

      // Render frame with WebGL (or 2D fallback if context lost)
      await compositor.render(layers, overlays);
      
      // Capture the canvas and encode it
      const timestampMicroseconds = Math.round(i * (1_000_000 / config.fps));
      const durationMicroseconds = Math.round(1_000_000 / config.fps);
      const vf = new VideoFrame(canvas, { 
        timestamp: timestampMicroseconds,
        duration: durationMicroseconds,
      });
      
      // Wait if encoder queue is getting too large to prevent QuotaExceededError.
      // PERF: previously polled every 5ms; now driven by the encoder's `dequeue`
      // event so we resume the instant there is room instead of on the next tick.
      while (videoEncoder.encodeQueueSize > 12 && !isCancelled) {
        await waitForEncoderDrain(videoEncoder, 25);
      }

      // Force a keyframe on the first frame and every 2 seconds
      const keyFrame = i === 0 || i % (config.fps * 2) === 0;
      try {
        if (videoEncoder.state !== 'closed') {
          videoEncoder.encode(vf, { keyFrame });
        }
      } catch (e: any) {
        console.warn('[ExportWorker] Frame encode skipped:', e.message);
      }
      
      vf.close();
      
      // Cleanup frames for this tick
      for (const layer of layers) {
        if (layer.frame) {
          layer.frame.close();
        }
      }

      const progress = ((i + 1) / totalFrames) * (hasAudio ? 70 : 90);
      
      if (i % 5 === 0 || i === totalFrames - 1) {
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
    
    if (useLocalRuntime && ws) {
      ws.close();
      compositor.dispose();
      scheduler.dispose();
      framePool.clear();
      postMessage({ 
        type: 'COMPLETE', 
        payload: { fileSize: 0, filename: config.filename || 'Export', savedViaRuntime: true }, 
      });
      isExporting = false;
      return;
    }

    // Finalize MP4 Muxer
    if (muxer) {
      muxer.finalize();
    }

    // Finalize OPFS stream
    if (writable) {
      await writable.close();
      writable = null;
    }
    
    compositor.dispose();
    scheduler.dispose();
    framePool.clear();

    const finalFileName = outputFileHandle ? outputFileHandle.name : `${config.filename}.${config.format}`;
    let finalFileSize = 0;
    try {
      if (outputFileHandle) {
        const file = await outputFileHandle.getFile();
        finalFileSize = file.size;
      }
    } catch {}

    postMessage({ 
      type: 'COMPLETE', 
      payload: { 
        fileSize: finalFileSize, 
        filename: finalFileName, 
        savedDirectly: !!fileHandle 
      }, 
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
