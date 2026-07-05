export interface StoryboardChunk {
  chunkIndex: number;
  startTime: number;
  duration: number;
  base64Image: string;
}

/**
 * Compiles a storyboard grid image (2400x540) for a given 10-second slice of video.
 */
async function compileGridForSegment(
  videoEl: HTMLVideoElement,
  segmentStart: number,
  segmentDuration: number
): Promise<string> {
  const numFrames = 10;
  const step = segmentDuration / numFrames;

  const canvas = document.createElement('canvas');
  canvas.width = 2400; // 5 columns * 480px
  canvas.height = 540; // 2 rows * 270px
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create 2D canvas context');

  // Clear background
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const frameWidth = 480;
  const frameHeight = 270;

  // Seek video and wait for seeked event
  const seekVideo = (time: number): Promise<void> => {
    return new Promise((resolve) => {
      const onSeeked = () => {
        videoEl.removeEventListener('seeked', onSeeked);
        resolve();
      };
      videoEl.addEventListener('seeked', onSeeked);
      videoEl.currentTime = time;
    });
  };

  // Draw 10 frames in a 5x2 grid
  for (let i = 0; i < numFrames; i++) {
    const targetTime = segmentStart + i * step;
    if (targetTime > videoEl.duration) break;

    await seekVideo(targetTime);

    const col = i % 5;
    const row = Math.floor(i / 5);
    const dx = col * frameWidth;
    const dy = row * frameHeight;

    // Draw frame
    ctx.drawImage(videoEl, 0, 0, videoEl.videoWidth || 854, videoEl.videoHeight || 480, dx, dy, frameWidth, frameHeight);

    // Draw a small timestamp indicator on each thumbnail
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(dx + 5, dy + 5, 55, 18);
    ctx.fillStyle = '#fbbf24';
    ctx.font = '10px sans-serif';
    ctx.fillText(`${targetTime.toFixed(1)}s`, dx + 10, dy + 17);
  }

  return canvas.toDataURL('image/jpeg', 0.85);
}

/**
 * Splits a clip into <=10s chunks, generates storyboard grids for each, and returns base64 images.
 */
export async function compileStoryboard(
  videoEl: HTMLVideoElement,
  startTime: number,
  duration: number,
  onProgress?: (progress: number) => void
): Promise<StoryboardChunk[]> {
  const chunkSize = 10; // seconds
  const numChunks = Math.ceil(duration / chunkSize);
  const chunks: StoryboardChunk[] = [];

  // Backup original video state
  const originalTime = videoEl.currentTime;
  const originalPaused = videoEl.paused;

  try {
    for (let i = 0; i < numChunks; i++) {
      const segmentStart = startTime + i * chunkSize;
      const segmentDuration = Math.min(chunkSize, duration - i * chunkSize);

      if (segmentStart >= videoEl.duration) break;

      const base64Image = await compileGridForSegment(videoEl, segmentStart, segmentDuration);

      chunks.push({
        chunkIndex: i,
        startTime: segmentStart,
        duration: segmentDuration,
        base64Image: base64Image.split(',')[1], // Strip data:image/jpeg;base64, prefix for APIs
      });

      if (onProgress) {
        onProgress((i + 1) / numChunks);
      }
    }
  } finally {
    // Restore video state
    videoEl.currentTime = originalTime;
    if (!originalPaused) {
      videoEl.play().catch(() => {});
    }
  }

  return chunks;
}
