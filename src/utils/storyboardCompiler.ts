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

  // Seek video and wait for seeked event, with a 1000ms safeguard timeout
  const seekVideo = (time: number): Promise<void> => {
    return new Promise((resolve) => {
      if (Math.abs(videoEl.currentTime - time) < 0.01) {
        resolve();
        return;
      }
      let resolved = false;
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          videoEl.removeEventListener('seeked', onSeeked);
          resolve();
        }
      }, 1000);
      const onSeeked = () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          videoEl.removeEventListener('seeked', onSeeked);
          resolve();
        }
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
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(dx + 10, dy + 10, 75, 24);
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(`${targetTime.toFixed(1)}s`, dx + 18, dy + 27);
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

  // Optimization: Clone video to prevent flickering and playback disruption in the main UI
  const cloneVideo = document.createElement('video');
  cloneVideo.crossOrigin = 'anonymous';
  cloneVideo.muted = true;
  cloneVideo.playsInline = true;
  
  // Wait for the clone to load data before seeking
  const loadPromise = new Promise<void>((resolve) => {
    if (cloneVideo.readyState >= 2) {
      resolve();
      return;
    }
    let resolved = false;
    const onReady = () => {
      if (!resolved) {
        resolved = true;
        resolve();
      }
    };
    cloneVideo.onloadedmetadata = onReady;
    cloneVideo.onloadeddata = onReady;
    cloneVideo.oncanplay = onReady;
    // Fallback safeguard timeout in case events don't fire
    setTimeout(onReady, 2000);
  });

  // Use currentSrc if available, otherwise src
  cloneVideo.src = videoEl.currentSrc || videoEl.src;
  cloneVideo.load(); // Force loading algorithm execution
  
  await loadPromise;

  try {
    for (let i = 0; i < numChunks; i++) {
      const segmentStart = startTime + i * chunkSize;
      const segmentDuration = Math.min(chunkSize, duration - i * chunkSize);

      // Use the original video's duration as a safe fallback if clone duration is missing
      const safeDuration = isNaN(cloneVideo.duration) ? videoEl.duration : cloneVideo.duration;
      if (segmentStart >= safeDuration) break;

      const base64Image = await compileGridForSegment(cloneVideo, segmentStart, segmentDuration);

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
    // Release clone video memory
    cloneVideo.removeAttribute('src');
    cloneVideo.load();
  }

  return chunks;
}
