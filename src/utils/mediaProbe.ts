/**
 * mediaProbe.ts — Browser-native media metadata extraction.
 *
 * Uses HTMLVideoElement / HTMLAudioElement / HTMLImageElement + Web Audio API
 * to extract real duration, dimensions, thumbnails, and waveform peaks from
 * imported files — no FFmpeg or server needed.
 */

import type { MediaItem, MediaType } from '@/types';

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
      } catch (e) {}
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
  video.preload = 'auto';
  video.muted = true;

  // Wait for metadata
  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error('Failed to load video'));
    video.src = objectUrl;
  });

  const duration = video.duration;
  const width = video.videoWidth;
  const height = video.videoHeight;

  // Capture a thumbnail at 1s (or 0 for very short clips)
  const thumbTime = Math.min(1, duration * 0.1);
  const thumbnail = await captureVideoFrame(video, thumbTime, 320);

  // Extract frame strip for timeline (8-16 evenly spaced frames)
  const frameCount = Math.min(16, Math.max(6, Math.floor(duration * 2)));
  const frameStrip: string[] = [];
  for (let i = 0; i < frameCount; i++) {
    const t = (i / (frameCount - 1)) * (duration - 0.1);
    const frame = await captureVideoFrame(video, t, 120);
    frameStrip.push(frame);
  }

  // Try to extract audio waveform from the video
  let waveformPeaks: number[] | undefined;
  try {
    waveformPeaks = await extractWaveformFromUrl(objectUrl);
  } catch {
    // Video may have no audio track — that's fine
  }

  video.src = '';
  video.load();

  return {
    duration,
    width,
    height,
    thumbnail,
    frameStrip,
    waveformPeaks,
    frameRate: 30, // Browser can't easily detect — default 30fps
  };
}

// ── Audio probe ──────────────────────────────────────────────────────────────

/**
 * Extract normalised waveform peaks from a URL using Web Audio API.
 * Returns an array of ~200 peaks normalised to [0..1].
 */
export async function extractWaveformFromUrl(
  url: string,
  targetPeaks = 200
): Promise<number[]> {
  const audioCtx = new AudioContext();
  try {
    const arrayBuffer = await blobUrlToArrayBuffer(url);
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

    const rawData = audioBuffer.getChannelData(0); // mono or left channel
    const samplesPerPeak = Math.floor(rawData.length / targetPeaks);
    const peaks: number[] = [];

    for (let i = 0; i < targetPeaks; i++) {
      const start = i * samplesPerPeak;
      const end = start + samplesPerPeak;
      let max = 0;
      for (let j = start; j < end && j < rawData.length; j++) {
        const abs = Math.abs(rawData[j]);
        if (abs > max) max = abs;
      }
      peaks.push(max);
    }

    // Normalise to [0..1]
    const maxPeak = Math.max(...peaks, 0.001);
    return peaks.map((p) => p / maxPeak);
  } finally {
    await audioCtx.close();
  }
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
  };
}
