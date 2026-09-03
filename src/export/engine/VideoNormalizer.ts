/**
 * VideoNormalizer (main thread)
 *
 * The export worker demuxes video with MP4Box, which only understands ISO-BMFF
 * (MP4/MOV). Anything else — the editor's own "Screen Record.webm" captures,
 * imported WebM/MKV/OGG files — failed to demux, so the worker composited
 * nothing and the export came out as solid black frames while the audio mix
 * (decodeAudioData handles WebM fine) still played. That is the reported
 * "export is blank black, only audio" failure for screen recordings.
 *
 * Before the timeline is handed to the worker, this module sniffs each video
 * media file and, when it is not an MP4/MOV, transcodes it to H.264 MP4 using
 * an HTMLVideoElement (any container the browser can play) + WebCodecs +
 * mp4-muxer. The resulting object URL replaces the media URL in the serialized
 * timeline only — the project itself is untouched.
 */
import * as Mp4Muxer from 'mp4-muxer';
import { Input, ALL_FORMATS, BlobSource } from 'mediabunny';
import { h264CodecCandidates } from '../quality';

import { attachInvisibleMediaElement } from '@/utils/mediaPoolContainer';
interface NormalizeResult {
  url: string;        // original or transcoded URL
  transcoded: boolean;
  warning?: string;   // set when the media could not be made exportable
}

// Cache normalized blobs so several clips of the same media transcode once.
const normalizedCache = new Map<string, Promise<NormalizeResult>>();

export function clearNormalizedCache(): void {
  for (const [, promise] of normalizedCache) {
    promise.then(result => {
      if (result.url) URL.revokeObjectURL(result.url);
    }).catch(() => {});
  }
  normalizedCache.clear();
}

export interface VideoInspection {
  codec: string | null;
  isoBmff: boolean;
  needsNormalization: boolean;
}

export function needsVideoNormalization(isoBmff: boolean, _codec: string | null): boolean {
  // Mediabunny can demux ISO-BMFF HEVC directly. HEVC is intentionally not
  // normalized here: the export worker selects Chrome's hardware decoder for
  // HEVC while using software decoding for AVC/VP8/VP9. This hybrid path avoids
  // the very slow frame-by-frame HEVC-to-H.264 preparation pass.
  return !isoBmff;
}

/** Inspect both the container and its primary video codec. MP4 does not imply
 * H.264: iPhone/camera MP4 and MOV files commonly contain HEVC/H.265. */
export async function inspectVideoBlob(blob: Blob): Promise<VideoInspection> {
  const head = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
  const isoBmff = isIsoBmff(head);
  let input: any = null;
  try {
    input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
    const track = await input.getPrimaryVideoTrack();
    const codec = track ? await track.getCodec() : null;
    return {
      codec,
      isoBmff,
      needsNormalization: needsVideoNormalization(isoBmff, codec),
    };
  } catch {
    return { codec: null, isoBmff, needsNormalization: needsVideoNormalization(isoBmff, null) };
  } finally {
    try { input?.dispose?.(); } catch {}
  }
}

/** ISO-BMFF sniff: bytes 4..8 must be 'ftyp'. */
export function isIsoBmff(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 12 &&
    bytes[4] === 0x66 && // f
    bytes[5] === 0x74 && // t
    bytes[6] === 0x79 && // y
    bytes[7] === 0x70    // p
  );
}

export function normalizeVideoForExport(url: string, name?: string): Promise<NormalizeResult> {
  let pending = normalizedCache.get(url);
  if (!pending) {
    pending = fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`fetch failed (${response.status})`);
        return response.blob();
      })
      .then((blob) => doNormalizeBlob(blob, name))
      .catch((error): NormalizeResult => ({
        url,
        transcoded: false,
        warning: `"${name || 'video'}" could not be converted for export (${error?.message || error}).`,
      }));
    normalizedCache.set(url, pending);
  }
  return pending;
}

/** Normalize a resolved media blob, including HEVC inside an MP4/MOV container. */
export function normalizeVideoBlobForExport(
  blob: Blob,
  cacheKey: string,
  name?: string,
  onStatus?: (message: string) => void,
): Promise<NormalizeResult> {
  let pending = normalizedCache.get(cacheKey);
  if (!pending) {
    pending = doNormalizeBlob(blob, name, onStatus).catch((error): NormalizeResult => ({
      url: URL.createObjectURL(blob),
      transcoded: false,
      warning: `"${name || 'video'}" could not be converted for export (${error?.message || error}). It may be missing from the output.`,
    }));
    normalizedCache.set(cacheKey, pending);
  }
  return pending;
}

async function doNormalizeBlob(blob: Blob, name?: string, onStatus?: (message: string) => void): Promise<NormalizeResult> {
  const inspection = await inspectVideoBlob(blob);
  const sourceUrl = URL.createObjectURL(blob);
  if (!inspection.needsNormalization) return { url: sourceUrl, transcoded: false };

  if (typeof VideoEncoder === 'undefined') throw new Error('WebCodecs unavailable for conversion');

  const reason = inspection.codec === 'hevc' ? 'HEVC/H.265' : 'a non-MP4 container';
  const status = `Preparing "${name || 'video'}": converting ${reason} to export-safe H.264…`;
  console.log(`[VideoNormalizer] ${status}`);
  onStatus?.(status);
  try {
    const outUrl = await transcodeToMp4(blob);
    URL.revokeObjectURL(sourceUrl);
    return { url: outUrl, transcoded: true };
  } catch (error) {
    URL.revokeObjectURL(sourceUrl);
    throw error;
  }
}

/**
 * Decode via HTMLVideoElement seeks (frame-accurate enough at 30fps and works
 * for every container/codec the browser can play), encode via WebCodecs,
 * mux into MP4.
 */
async function transcodeToMp4(blob: Blob): Promise<string> {
  const srcUrl = URL.createObjectURL(blob);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  // ANDROID FIX: detached/invisible video elements are never composited on
  // Chrome-Android, so seeks + drawImage() below would capture black frames.
  // Attach to the shared "painted but invisible" pool container instead.
  attachInvisibleMediaElement(video);
  video.src = srcUrl;

  try {
    await once(video, 'loadedmetadata', 15000);

    // WebM screen captures often report Infinity until seeked to the end.
    if (!Number.isFinite(video.duration)) {
      video.currentTime = Number.MAX_SAFE_INTEGER;
      await once(video, 'seeked', 15000).catch(() => {});
      video.currentTime = 0;
      await once(video, 'seeked', 15000).catch(() => {});
    }

    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    if (!(duration > 0)) throw new Error('could not determine video duration');

    const width = Math.floor((video.videoWidth || 1280) / 2) * 2;
    const height = Math.floor((video.videoHeight || 720) / 2) * 2;
    const fps = 30;
    const totalFrames = Math.max(1, Math.ceil(duration * fps));

    const muxer = new Mp4Muxer.Muxer({
      target: new Mp4Muxer.ArrayBufferTarget(),
      video: { codec: 'avc', width, height },
      fastStart: 'in-memory',
    });

    let encoderError: Error | null = null;
    const encoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error: (e) => { encoderError = e as unknown as Error; },
    });

    const config = await pickEncoderConfig(width, height, fps);
    encoder.configure(config);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2d context unavailable');

    for (let i = 0; i < totalFrames; i++) {
      if (encoderError) throw encoderError;
      const t = Math.min(duration - 0.001, i / fps);
      video.currentTime = t;
      await once(video, 'seeked', 10000);
      ctx.drawImage(video, 0, 0, width, height);
      const vf = new VideoFrame(canvas, {
        timestamp: Math.round((i * 1_000_000) / fps),
        duration: Math.round(1_000_000 / fps),
      });
      encoder.encode(vf, { keyFrame: i % (fps * 2) === 0 });
      vf.close();
      // Keep the encoder queue bounded.
      while (encoder.encodeQueueSize > 8) {
        await new Promise((r) => setTimeout(r, 10));
      }
    }

    await encoder.flush();
    encoder.close();
    muxer.finalize();

    const mp4Blob = new Blob([(muxer.target as Mp4Muxer.ArrayBufferTarget).buffer], { type: 'video/mp4' });
    return URL.createObjectURL(mp4Blob);
  } finally {
    video.src = '';
    video.load();
    video.remove();
    URL.revokeObjectURL(srcUrl);
  }
}

async function pickEncoderConfig(width: number, height: number, fps: number): Promise<VideoEncoderConfig> {
  const bitrate = Math.min(20_000_000, Math.max(4_000_000, width * height * 6));
  for (const codec of h264CodecCandidates(width, height, fps)) {
    const cfg: VideoEncoderConfig = {
      codec,
      width,
      height,
      bitrate,
      framerate: fps,
      hardwareAcceleration: 'prefer-hardware',
      latencyMode: 'quality',
      bitrateMode: 'variable',
      avc: { format: 'avc' },
    };
    try {
      const support = await VideoEncoder.isConfigSupported(cfg);
      if (support?.supported) return cfg;
    } catch { /* try next */ }
  }
  throw new Error(`H.264 encoding is unavailable at ${width}x${height}`);
}

function once(target: EventTarget, event: string, timeoutMs: number): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`timeout waiting for ${event}`));
    }, timeoutMs);
    const onEvent = () => { cleanup(); resolve(); };
    const onError = () => { cleanup(); reject(new Error(`media error during ${event}`)); };
    const cleanup = () => {
      clearTimeout(timer);
      target.removeEventListener(event, onEvent);
      target.removeEventListener('error', onError);
    };
    target.addEventListener(event, onEvent);
    target.addEventListener('error', onError);
  });
}
