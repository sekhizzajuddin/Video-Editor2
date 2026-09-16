/**
 * mediaProbe.ts — Browser-native media metadata extraction.
 *
 * Uses HTMLVideoElement / HTMLAudioElement / HTMLImageElement + Web Audio API
 * to extract real duration, dimensions, thumbnails, and waveform peaks from
 * imported files — no FFmpeg or server needed.
 */

import type { MediaItem, MediaType } from '@/types';
import { attachInvisibleMediaElement } from '@/utils/mediaPoolContainer'
import { assessProbedVideo } from '@/utils/videoCodecSupport';
import { inspectVideoBlob } from '@/export/engine/VideoNormalizer';

// ── helpers ──────────────────────────────────────────────────────────────────

const generateId = () => Math.random().toString(36).substr(2, 9);

function blobUrlToArrayBuffer(url: string): Promise<ArrayBuffer> {
  return fetch(url).then((r) => r.arrayBuffer());
}

// ── Video probe ──────────────────────────────────────────────────────────────

/**
 * Extract a single thumbnail frame from a video at the given seek time.
 * Returns a data URL of the captured frame.
 */
function captureVideoFrame(
  video: HTMLVideoElement,
  seekTime: number,
  maxWidth = 320
): Promise<string> {
  return new Promise((resolve) => {
    let resolved = false;
    video.currentTime = seekTime;

    const finish = () => {
      if (resolved) return;
      resolved = true;
      video.removeEventListener('seeked', onSeeked);
      clearTimeout(timeoutId);

      const canvas = document.createElement('canvas');
      const aspect = (video.videoWidth || 320) / (video.videoHeight || 180);
      canvas.width = Math.min(maxWidth, video.videoWidth || 320);
      canvas.height = canvas.width / aspect;
      const ctx = canvas.getContext('2d')!;
      try {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      } catch (_) {}
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };

    const onSeeked = () => {
      finish();
    };

    const timeoutId = setTimeout(() => {
      finish();
    }, 1000);

    video.addEventListener('seeked', onSeeked);
  });
}

/**
 * Probe a video file. Returns a partial MediaItem with real metadata.
 */
export async function probeVideo(
  file: File,
  objectUrl: string
): Promise<Partial<MediaItem>> {
  const video = document.createElement('video');
  video.crossOrigin = 'anonymous';
  video.preload = 'auto';
  video.muted = true;
  video.playsInline = true;
  // ANDROID FIX: an unattached / fully invisible video element is not
  // composited on Chrome-Android, so decodes (and thus the thumbnail
  // drawImage below) can return black frames or stall on real phones.
  // Attach it to the shared "painted but invisible" pool container instead.
  attachInvisibleMediaElement(video);

  try {
  // Wait for metadata
  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error('Failed to load video'));
    video.src = objectUrl;
  });

  const duration = video.duration;
  const width = video.videoWidth;
  const height = video.videoHeight;

  // 0x0 after `loadedmetadata` means the browser read the container but could
  // not describe — let alone decode — the video track: an unsupported codec
  // (typically HEVC/H.265 on desktop Chrome/Firefox). Everything else about the
  // element looks healthy (duration, readyState, a currentTime that advances),
  // so without this check the clip imports as a silently black layer that also
  // fails later during export. Name the codec so the warning is actionable.
  let decodeIssue: string | undefined;
  let decodeCodec: string | null | undefined;
  if (width === 0 || height === 0) {
    let codec: string | null = null;
    let hasVideoTrack: boolean | undefined;
    try {
      const inspection = await inspectVideoBlob(file);
      codec = inspection.codec;
      hasVideoTrack = inspection.hasVideoTrack;
    } catch {
      // Inspector is best-effort: a generic message is still better than none.
    }
    const verdict = assessProbedVideo({ width, height, codec, hasVideoTrack });
    if (!verdict.supported) {
      decodeIssue = verdict.issue;
      decodeCodec = verdict.codec ?? codec;
    }
  }

  // Capture a thumbnail at 1s (or 0 for very short clips)
  const thumbTime = Math.min(1, duration * 0.1);
  const thumbnail = await captureVideoFrame(video, thumbTime, 320);

  // Lazy frame strip — extracted on demand by the timeline component when the
  // clip is first visible. Import time stays fast and memory stays low.
  // The timeline calls `generateFrameStripOnDemand()` which decodes the video
  // via the existing media pool.
  const frameStrip: string[] | undefined = undefined;

  // Try to extract audio waveform from the video
  let waveformPeaks: number[] | undefined;
  try {
    waveformPeaks = await extractWaveformFromUrl(objectUrl);
  } catch {
    // Video may have no audio track — that's fine
  }

  video.src = '';
  video.load();
  video.remove();

  return {
    duration,
    width,
    height,
    thumbnail,
    frameStrip,
    waveformPeaks,
    frameRate: 30, // Browser can't easily detect — default 30fps
    decodeIssue,
    decodeCodec,
  };
  } finally {
    // Guarantee the transient probe element leaves the shared container.
    video.remove();
  }
}

// ── Audio probe ──────────────────────────────────────────────────────────────

/**
 * Extract high-density normalised waveform peaks from an audio URL using Web Audio API.
 * Uses 100 samples per second of audio (10ms resolution) so dialogue pauses,
 * speech start/end boundaries, and transients are precisely captured.
 */
export async function extractWaveformFromUrl(
  url: string,
  targetPeaks?: number
): Promise<number[]> {
  const tmpCtx = new AudioContext();
  let audioBuffer: AudioBuffer;
  try {
    const arrayBuffer = await blobUrlToArrayBuffer(url);
    audioBuffer = await tmpCtx.decodeAudioData(arrayBuffer);
  } finally {
    await tmpCtx.close();
  }

  const rawData = audioBuffer.getChannelData(0);
  const duration = audioBuffer.duration || 1;

  // 100 samples per second (10ms time slices) for ultra-accurate dialogue tracking
  const actualTargetPeaks = targetPeaks ?? Math.min(12000, Math.max(2000, Math.floor(duration * 100)));
  const samplesPerPeak = Math.max(1, Math.floor(rawData.length / actualTargetPeaks));
  const rawPeaks: number[] = [];

  for (let i = 0; i < actualTargetPeaks; i++) {
    const start = i * samplesPerPeak;
    const end = Math.min(start + samplesPerPeak, rawData.length);
    let max = 0;
    for (let j = start; j < end; j++) {
      const abs = Math.abs(rawData[j]);
      if (abs > max) max = abs;
    }
    rawPeaks.push(max);
  }

  const maxPeak = Math.max(...rawPeaks, 0.0001);

  // Apply noise-floor thresholding (< 0.02 -> 0) so background room hiss or quiet gaps
  // between spoken dialogue words collapse cleanly to 0, making word boundaries crisp.
  return rawPeaks.map((p) => {
    const norm = p / maxPeak;
    if (norm < 0.025) return 0;
    // Mild contrast curve to make speech bursts pop relative to ambient noise
    return Math.min(1, Math.pow((norm - 0.02) / 0.98, 1.15));
  });
}

/**
 * Probe an audio file. Returns a partial MediaItem with real metadata.
 */
export async function probeAudio(
  file: File,
  objectUrl: string
): Promise<Partial<MediaItem>> {
  const audio = document.createElement('audio');
  audio.preload = 'auto';

  // Wait for metadata
  await new Promise<void>((resolve, reject) => {
    audio.onloadedmetadata = () => resolve();
    audio.onerror = () => reject(new Error('Failed to load audio'));
    audio.src = objectUrl;
  });

  const duration = audio.duration;

  // Extract waveform peaks
  let waveformPeaks: number[] = [];
  try {
    waveformPeaks = await extractWaveformFromUrl(objectUrl);
  } catch {
    // Fallback — generate empty peaks
    waveformPeaks = Array.from({ length: 200 }, () => Math.random() * 0.3 + 0.1);
  }

  audio.src = '';
  audio.load();

  return {
    duration,
    waveformPeaks,
  };
}

// ── Image probe ──────────────────────────────────────────────────────────────

/**
 * Probe an image file. Returns a partial MediaItem with real metadata.
 */
export async function probeImage(
  file: File,
  objectUrl: string
): Promise<Partial<MediaItem>> {
  const img = document.createElement('img');
  img.crossOrigin = 'anonymous';

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = objectUrl;
  });

  // Create a smaller thumbnail
  const canvas = document.createElement('canvas');
  const maxWidth = 320;
  const aspect = img.naturalWidth / (img.naturalHeight || 1);
  canvas.width = Math.min(maxWidth, img.naturalWidth);
  canvas.height = canvas.width / aspect;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const thumbnail = canvas.toDataURL('image/jpeg', 0.8);

  return {
    duration: 5, // Default 5s for images on timeline
    width: img.naturalWidth,
    height: img.naturalHeight,
    thumbnail,
  };
}

// ── Unified probe entry ──────────────────────────────────────────────────────

/**
 * Determine media type from a File object.
 */
export function detectMediaType(file: File): MediaType {
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  return 'image';
}

/**
 * Lazily generate a frame strip from a video URL.
 * Called by the timeline when a clip first becomes visible, so import stays
 * fast and the per-clip memory footprint stays small (one ~120-byte JPEG per
 * frame instead of one decoded frame buffer).
 */
export async function generateFrameStripOnDemand(
  url: string,
  duration: number,
  count = 8,
  maxWidth = 120
): Promise<string[]> {
  const video = document.createElement('video');
  video.crossOrigin = 'anonymous';
  video.preload = 'auto';
  video.muted = true;
  video.playsInline = true;
  // ANDROID FIX: keep element composited while decoding — see
  // utils/mediaPoolContainer.ts. Unattached videos can capture black frames
  // on Chrome-Android.
  attachInvisibleMediaElement(video);

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error('Failed to load video for frame strip'));
    video.src = url;
  });

  const strip: string[] = [];
  try {
    for (let i = 0; i < count; i++) {
      const t = (i / Math.max(1, count - 1)) * Math.max(0, duration - 0.1);
      strip.push(await captureVideoFrame(video, t, maxWidth));
    }
  } finally {
    video.src = '';
    video.load();
    video.remove();
  }
  return strip;
}

/**
 * Full probe: create a MediaItem from a File with all real metadata.
 */
export async function probeFile(file: File): Promise<MediaItem> {
  const objectUrl = URL.createObjectURL(file);
  const type = detectMediaType(file);

  let metadata: Partial<MediaItem> = {};

  try {
    if (type === 'video') {
      metadata = await probeVideo(file, objectUrl);
    } else if (type === 'audio') {
      metadata = await probeAudio(file, objectUrl);
    } else {
      metadata = await probeImage(file, objectUrl);
    }
  } catch (err) {
    console.warn('Media probe failed, using defaults:', err);
    metadata = {
      duration: type === 'image' ? 5 : 30,
    };
  }

  return {
    id: generateId(),
    name: file.name,
    type,
    duration: metadata.duration ?? (type === 'image' ? 5 : 30),
    url: objectUrl,
    size: file.size,
    createdAt: Date.now(),
    thumbnail: metadata.thumbnail,
    waveformPeaks: metadata.waveformPeaks,
    frameRate: metadata.frameRate ?? 30,
    width: metadata.width,
    height: metadata.height,
    frameStrip: metadata.frameStrip,
    // Carried through deliberately: without these the UI cannot tell the user
    // that the file imported but will never render (see utils/videoCodecSupport).
    decodeIssue: metadata.decodeIssue,
    decodeCodec: metadata.decodeCodec,
  };
}
