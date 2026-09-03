import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import { EncoderBackend, EncoderBackendType, ExportOptions } from '../types';
import { streamCapturedFrames } from '../frameCapture';
import { streamAudioChunks } from '../audioChunks';
import { h264CodecCandidates } from '../quality';

export class WebCodecsBackend implements EncoderBackend {
  readonly type: EncoderBackendType = 'webcodecs';
  readonly name = 'WebCodecs Hardware GPU Encoder';
  private cancelled = false;

  cancel(): void {
    this.cancelled = true;
  }

  async isSupported(opts: ExportOptions): Promise<boolean> {
    if (!opts.useHardwareEncoder || opts.format !== 'mp4') {
      return false;
    }
    if (typeof window.VideoEncoder === 'undefined') {
      return false;
    }
    try {
      const codec = await this.getSupportedCodec(opts.width, opts.height, opts.bitrate || 5_000_000, opts.fps);
      const res = await window.VideoEncoder.isConfigSupported({
        codec,
        width: opts.width,
        height: opts.height,
        bitrate: opts.bitrate || 5_000_000,
        framerate: opts.fps,
      });
      return res.supported !== false;
    } catch {
      return false;
    }
  }

  private async getSupportedCodec(width: number, height: number, bitrate: number, fps: number): Promise<string> {
    const candidates = h264CodecCandidates(width, height, fps);

    for (const codec of candidates) {
      try {
        const res = await window.VideoEncoder.isConfigSupported({
          codec,
          width,
          height,
          bitrate,
          framerate: fps,
        });
        if (res.supported) {
          return codec;
        }
      } catch {
        // try next candidate
      }
    }
    throw new Error(`H.264 is not supported at ${width}x${height} ${fps}fps`);
  }

  async export(opts: ExportOptions): Promise<Blob> {
    this.cancelled = false;
    if (!opts.canvas) {
      throw new Error('No target canvas provided for rendering.');
    }

    const bitrate = opts.bitrate || 5_000_000;
    opts.setStatusMsg?.('Initializing hardware GPU H.264 video encoder...');
    const codec = await this.getSupportedCodec(opts.width, opts.height, bitrate, opts.fps);

    // Determine if AudioEncoder is supported in this browser
    const supportsAudio = typeof window.AudioEncoder !== 'undefined' && typeof window.OfflineAudioContext !== 'undefined';
    
    const muxer = new Muxer({
      target: new ArrayBufferTarget(),
      video: {
        codec: 'avc',
        width: opts.width,
        height: opts.height,
        frameRate: opts.fps,
      },
      audio: supportsAudio ? {
        codec: 'aac',
        numberOfChannels: 2,
        sampleRate: 48_000,
      } : undefined,
      fastStart: 'in-memory',
    });

    // 1. Encode Video Stream
    const videoEncoder = new window.VideoEncoder({
      output: (chunk, meta) => {
        if (!this.cancelled) {
          muxer.addVideoChunk(chunk, meta as any);
        }
      },
      error: (e: any) => {
        console.error('[WebCodecs] VideoEncoder error:', e);
        throw new Error(`VideoEncoder hardware encoding failed: ${e.message || e}`);
      },
    });

    videoEncoder.configure({
      codec,
      width: opts.width,
      height: opts.height,
      bitrate,
      framerate: opts.fps,
      latencyMode: 'quality',
      bitrateMode: 'variable',
      hardwareAcceleration: 'prefer-hardware',
      avc: { format: 'avc' },
    });

    opts.onProgress({ stage: 'capturing', percentage: 0, message: 'Beginning synchronous hardware frame rendering...' });

    let frameCount = 0;
    for await (const frame of streamCapturedFrames({
      canvas: opts.canvas,
      startAt: opts.startAt,
      endAt: opts.endAt,
      fps: opts.fps,
      onProgress: opts.onProgress,
      shouldCancel: () => this.cancelled,
    })) {
      if (this.cancelled) {
        frame.close();
        break;
      }
      const isKeyframe = frameCount % opts.fps === 0; // 1 second GOP size
      videoEncoder.encode(frame, { keyFrame: isKeyframe });
      frame.close(); // Immediate memory release to prevent GPU buffer exhaustion
      frameCount++;
    }

    if (this.cancelled) {
      if (videoEncoder.state !== 'closed') videoEncoder.close();
      throw new Error('Export cancelled by user.');
    }

    opts.setStatusMsg?.('Flushing GPU video buffers...');
    await videoEncoder.flush();
    if (videoEncoder.state !== 'closed') {
      videoEncoder.close();
    }

    // 2. Encode Audio Stream (if available & supported)
    if (supportsAudio && !this.cancelled) {
      opts.setStatusMsg?.('Extracting and mixing timeline audio to AAC...');
      opts.onProgress({ stage: 'encoding', percentage: 90, message: 'Encoding timeline AAC audio...' });

      let audioEncoder: AudioEncoder | undefined;
      try {
        audioEncoder = new window.AudioEncoder({
          output: (chunk, meta) => {
            if (!this.cancelled) {
              muxer.addAudioChunk(chunk, meta as any);
            }
          },
          error: (e: any) => {
            console.warn('[WebCodecs] AudioEncoder warning:', e);
          },
        });

        audioEncoder.configure({
          codec: 'mp4a.40.2',
          numberOfChannels: 2,
          sampleRate: 48_000,
          bitrate: 128_000,
        });

        for await (const audioChunk of streamAudioChunks({
          startAt: opts.startAt,
          endAt: opts.endAt,
          sampleRate: 48_000,
        })) {
          if (this.cancelled) {
            audioChunk.close();
            break;
          }
          audioEncoder.encode(audioChunk);
          audioChunk.close();
        }

        if (audioEncoder.state !== 'closed') {
          await audioEncoder.flush();
          audioEncoder.close();
        }
      } catch (err) {
        console.warn('[WebCodecs] Audio encoding failed or empty, outputting video track only:', err);
        if (audioEncoder && audioEncoder.state !== 'closed') {
          audioEncoder.close();
        }
      }
    }

    opts.setStatusMsg?.('Finalizing MP4 container atom structure...');
    opts.onProgress({ stage: 'muxing', percentage: 98, message: 'Muxing H.264/AAC MP4 container...' });

    muxer.finalize();
    const { buffer } = muxer.target as ArrayBufferTarget;
    opts.onProgress({ stage: 'complete', percentage: 100, message: 'Export completed successfully!' });

    return new Blob([buffer], { type: 'video/mp4' });
  }
}
