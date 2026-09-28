import { Muxer, ArrayBufferTarget } from 'webm-muxer';
import { EncoderBackend, EncoderBackendType, ExportOptions } from '../types';
import { streamCapturedFrames } from '../frameCapture';
import { streamAudioChunks } from '../audioChunks';

/**
 * Frame-by-frame WebM export backend using WebCodecs + webm-muxer.
 * Produces deterministic, frame-perfect output — no real-time capture issues.
 * Uses VP9 video + Opus audio codecs.
 */
export class WebMWebCodecsBackend implements EncoderBackend {
  readonly type: EncoderBackendType = 'webm-webcodecs';
  readonly name = 'WebCodecs WebM Encoder (VP9 + Opus)';
  private cancelled = false;

  cancel(): void {
    this.cancelled = true;
  }

  async isSupported(opts: ExportOptions): Promise<boolean> {
    // This backend handles WebM format with WebCodecs
    if (opts.format !== 'webm') {
      return false;
    }
    if (typeof window.VideoEncoder === 'undefined') {
      return false;
    }
    // Check VP9 support
    try {
      const res = await window.VideoEncoder.isConfigSupported({
        codec: 'vp09.00.10.08', // VP9 Profile 0, Level 1.0, 8-bit
        width: opts.width,
        height: opts.height,
        bitrate: opts.bitrate || 5_000_000,
        framerate: opts.fps,
      });
      return res.supported !== false;
    } catch {
      // Try VP8 as fallback
      try {
        const res = await window.VideoEncoder.isConfigSupported({
          codec: 'vp8',
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
  }

  private async selectVPCodec(width: number, height: number, bitrate: number, fps: number): Promise<string> {
    // Prefer VP9 for better compression, fall back to VP8
    try {
      const res = await window.VideoEncoder.isConfigSupported({
        codec: 'vp09.00.10.08',
        width, height, bitrate, framerate: fps,
      });
      if (res.supported !== false) return 'vp09.00.10.08';
    } catch { /* fall through */ }

    return 'vp8';
  }

  async export(opts: ExportOptions): Promise<Blob> {
    this.cancelled = false;
    if (!opts.canvas) {
      throw new Error('No target canvas provided for rendering.');
    }

    opts.setStatusMsg?.('Initializing WebCodecs VP9 video encoder...');
    const bitrate = opts.bitrate || 5_000_000;
    const codec = await this.selectVPCodec(opts.width, opts.height, bitrate, opts.fps);

    // Determine audio support
    const supportsAudio = typeof window.AudioEncoder !== 'undefined' && typeof window.OfflineAudioContext !== 'undefined';

    const muxer = new Muxer({
      target: new ArrayBufferTarget(),
      video: {
        codec: codec.startsWith('vp09') ? 'V_VP9' : 'V_VP8',
        width: opts.width,
        height: opts.height,
        frameRate: opts.fps,
      },
      audio: supportsAudio ? {
        codec: 'A_OPUS',
        numberOfChannels: 2,
        sampleRate: 48_000,
      } : undefined,
    });

    // 1. Encode Video Stream
    const videoEncoder = new window.VideoEncoder({
      output: (chunk: EncodedVideoChunk, meta?: EncodedVideoChunkMetadata) => {
        if (!this.cancelled) {
          muxer.addVideoChunk(chunk, meta as any);
        }
      },
      error: (e: any) => {
        console.error('[WebMWebCodecs] VideoEncoder error:', e);
        throw new Error(`VideoEncoder encoding failed: ${e.message || e}`);
      },
    });

    const isTransparent = opts.transparentBackground === true;

    videoEncoder.configure({
      codec,
      width: opts.width,
      height: opts.height,
      bitrate,
      framerate: opts.fps,
      latencyMode: 'quality',
      alpha: isTransparent ? 'keep' : 'discard',
    } as any);

    opts.onProgress({ stage: 'capturing', percentage: 0, message: 'Beginning frame-by-frame WebM rendering...' });

    let frameCount = 0;
    try {
      for await (const frame of streamCapturedFrames({
        canvas: opts.canvas,
        startAt: opts.startAt,
        endAt: opts.endAt,
        fps: opts.fps,
        alpha: isTransparent ? 'keep' : 'discard',
        onProgress: opts.onProgress,
        shouldCancel: () => this.cancelled,
      })) {
        if (this.cancelled) {
          frame.close();
          break;
        }
        const isKeyframe = frameCount % opts.fps === 0; // 1 second GOP
        videoEncoder.encode(frame, { keyFrame: isKeyframe });
        frame.close();
        frameCount++;
      }

      if (this.cancelled) {
        throw new Error('Export cancelled by user.');
      }

      opts.setStatusMsg?.('Flushing video encoder buffers...');
      await videoEncoder.flush();
    } finally {
      if (videoEncoder.state !== 'closed') videoEncoder.close();
    }

    // 2. Encode Audio Stream (Opus)
    if (supportsAudio && !this.cancelled) {
      opts.setStatusMsg?.('Encoding timeline audio to Opus...');
      opts.onProgress({ stage: 'encoding', percentage: 90, message: 'Encoding Opus audio...' });

      let audioEncoder: AudioEncoder | undefined;
      try {
        audioEncoder = new window.AudioEncoder({
          output: (chunk: EncodedAudioChunk, meta?: EncodedAudioChunkMetadata) => {
            if (!this.cancelled) {
              muxer.addAudioChunk(chunk, meta as any);
            }
          },
          error: (e: any) => {
            console.warn('[WebMWebCodecs] AudioEncoder warning:', e);
          },
        });

        audioEncoder.configure({
          codec: 'opus',
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
        console.warn('[WebMWebCodecs] Audio encoding failed, outputting video-only:', err);
        if (audioEncoder && audioEncoder.state !== 'closed') {
          audioEncoder.close();
        }
      }
    }

    opts.setStatusMsg?.('Finalizing WebM container...');
    opts.onProgress({ stage: 'muxing', percentage: 98, message: 'Muxing VP9/Opus WebM container...' });

    muxer.finalize();
    const { buffer } = muxer.target as ArrayBufferTarget;
    opts.onProgress({ stage: 'complete', percentage: 100, message: 'WebM export completed successfully!' });

    return new Blob([buffer], { type: 'video/webm' });
  }
}
