/**
 * opticalFlowTracker.ts — Advanced Optical Flow Motion Tracking
 * 
 * Implements Pyramid Lucas-Kanade optical flow with forward-backward
 * consistency validation for high-accuracy motion tracking.
 * 
 * Key improvements over basic SSD tracking:
 * - Sub-pixel accuracy through iterative refinement
 * - Multi-scale pyramid handling for large motions
 * - Outlier rejection via bidirectional tracking error
 * - Adaptive feature point management
 * - Trajectory smoothing with Kalman filtering
 */

import { CornerPoints, TrackingPoint } from '@/types';
import { getFrameSize, getClipFramePlacement } from './frameSpace';
import { useEditorStore } from '@/store/editorStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FeaturePoint {
  x: number;
  y: number;
  id: number;
  confidence: number;
  age: number; // How many frames successfully tracked
  trackHistory: { x: number; y: number; frame: number }[];
}

export interface OpticalFlowTrackResult {
  time: number;
  position: TrackingPoint;
  scale: number;
  rotation: number;
  confidence: number;
  featurePoints: FeaturePoint[];
}

export interface OpticalFlowOptions {
  /** Pyramid levels for multi-scale tracking */
  pyramidLevels?: number;
  /** Window size for Lucas-Kanade */
  windowSize?: number;
  /** Max iterations for convergence */
  maxIterations?: number;
  /** Convergence threshold */
  epsilon?: number;
  /** Forward-backward error threshold (0-1) */
  fbThreshold?: number;
  /** Minimum feature point age before replacement */
  minFeatureAge?: number;
  /** How often to refresh feature points (frames) */
  refreshInterval?: number;
  /** Number of feature points to track */
  numFeatures?: number;
  /** Quality level for feature detection (0-1) */
  qualityLevel?: number;
  /** Minimum distance between features */
  minFeatureDistance?: number;
  /** Apply Kalman smoothing to trajectory */
  enableSmoothing?: boolean;
  /** Kalman process noise covariance */
  kalmanProcessNoise?: number;
  /** Kalman measurement noise covariance */
  kalmanMeasurementNoise?: number;
  onProgress?: (progress: number) => void;
  shouldCancel?: () => boolean;
  aspectRatio?: string;
  clipTransform?: { x?: number; y?: number; scale?: number } | null;
}

// ---------------------------------------------------------------------------
// Image Pyramid
// ---------------------------------------------------------------------------

interface ImagePyramid {
  levels: Uint8ClampedArray[];
  widths: number[];
  heights: number[];
}

function buildPyramid(
  imageData: Uint8ClampedArray,
  width: number,
  height: number,
  levels: number
): ImagePyramid {
  const pyramid: ImagePyramid = {
    levels: [imageData],
    widths: [width],
    heights: [height],
  };

  let currentWidth = width;
  let currentHeight = height;
  let currentData = imageData;

  for (let i = 1; i < levels; i++) {
    const nextWidth = Math.max(1, Math.floor(currentWidth / 2));
    const nextHeight = Math.max(1, Math.floor(currentHeight / 2));
    const nextData = new Uint8ClampedArray(nextWidth * nextHeight);

    // Simple box filter downsampling
    for (let y = 0; y < nextHeight; y++) {
      for (let x = 0; x < nextWidth; x++) {
        const srcX = x * 2;
        const srcY = y * 2;
        
        // Average 2x2 block
        let sum = 0;
        for (let dy = 0; dy < 2; dy++) {
          for (let dx = 0; dx < 2; dx++) {
            const sx = Math.min(currentWidth - 1, srcX + dx);
            const sy = Math.min(currentHeight - 1, srcY + dy);
            sum += currentData[(sy * currentWidth + sx) * 4];
          }
        }
        nextData[y * nextWidth + x] = sum / 4;
      }
    }

    pyramid.levels.push(nextData);
    pyramid.widths.push(nextWidth);
    pyramid.heights.push(nextHeight);

    currentWidth = nextWidth;
    currentHeight = nextHeight;
    currentData = nextData;
  }

  return pyramid;
}

// ---------------------------------------------------------------------------
// Feature Detection (Shi-Tomasi corner detection)
// ---------------------------------------------------------------------------

function detectFeatures(
  imageData: Uint8ClampedArray,
  width: number,
  height: number,
  numFeatures: number,
  qualityLevel: number,
  minDistance: number
): FeaturePoint[] {
  const totalPixels = width * height;
  
  // Compute gradient magnitude using Sobel operators
  const gradientMag = new Float32Array(totalPixels);
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      
      // Sobel X
      const gx = (
        -imageData[((y - 1) * width + (x - 1)) * 4] +
        imageData[((y - 1) * width + (x + 1)) * 4] +
        -2 * imageData[(y * width + (x - 1)) * 4] +
        2 * imageData[(y * width + (x + 1)) * 4] +
        -imageData[((y + 1) * width + (x - 1)) * 4] +
        imageData[((y + 1) * width + (x + 1)) * 4]
      ) / 8;
      
      // Sobel Y
      const gy = (
        -imageData[((y - 1) * width + (x - 1)) * 4] +
        -2 * imageData[((y - 1) * width + x) * 4] +
        -imageData[((y - 1) * width + (x + 1)) * 4] +
        imageData[((y + 1) * width + (x - 1)) * 4] +
        2 * imageData[((y + 1) * width + x) * 4] +
        imageData[((y + 1) * width + (x + 1)) * 4]
      ) / 8;
      
      gradientMag[i] = gx * gx + gy * gy;
    }
  }
  
  // Find local maxima above quality threshold
  const maxGradient = Math.max(...gradientMag);
  const threshold = maxGradient * qualityLevel;
  
  const candidates: Array<{ x: number; y: number; score: number }> = [];
  
  for (let y = minDistance; y < height - minDistance; y++) {
    for (let x = minDistance; x < width - minDistance; x++) {
      const i = y * width + x;
      if (gradientMag[i] < threshold) continue;
      
      // Check if local maximum
      let isMax = true;
      for (let dy = -minDistance; dy <= minDistance && isMax; dy++) {
        for (let dx = -minDistance; dx <= minDistance && isMax; dx++) {
          if (dx === 0 && dy === 0) continue;
          const ni = (y + dy) * width + (x + dx);
          if (gradientMag[ni] > gradientMag[i]) {
            isMax = false;
          }
        }
      }
      
      if (isMax) {
        candidates.push({ x, y, score: gradientMag[i] });
      }
    }
  }
  
  // Sort by score and take top features with minimum distance
  candidates.sort((a, b) => b.score - a.score);
  
  const features: FeaturePoint[] = [];
  for (const candidate of candidates) {
    if (features.length >= numFeatures) break;
    
    // Check minimum distance from existing features
    let tooClose = false;
    for (const existing of features) {
      const dist = Math.hypot(candidate.x - existing.x, candidate.y - existing.y);
      if (dist < minDistance) {
        tooClose = true;
        break;
      }
    }
    
    if (!tooClose) {
      features.push({
        x: candidate.x,
        y: candidate.y,
        id: Date.now() + features.length,
        confidence: 1.0,
        age: 0,
        trackHistory: [],
      });
    }
  }
  
  return features;
}

// ---------------------------------------------------------------------------
// Lucas-Kanade Optical Flow
// ---------------------------------------------------------------------------

function lucasKanadeStep(
  prevPyramid: ImagePyramid,
  currPyramid: ImagePyramid,
  pt: { x: number; y: number },
  windowSize: number,
  maxIterations: number,
  epsilon: number
): { x: number; y: number; converged: boolean } {
  const levels = prevPyramid.levels.length;
  let x = pt.x;
  let y = pt.y;
  
  // Coarse-to-fine tracking through pyramid levels
  for (let level = levels - 1; level >= 0; level--) {
    const width = prevPyramid.widths[level];
    const height = prevPyramid.heights[level];
    const prevData = prevPyramid.levels[level];
    const currData = currPyramid.levels[level];
    
    // Scale position to this level
    const scale = 1 / Math.pow(2, level);
    x *= scale;
    y *= scale;
    
    const halfWindow = Math.floor(windowSize / 2);
    
    // Iterate to refine position
    for (let iter = 0; iter < maxIterations; iter++) {
      const xf = Math.floor(x);
      const yf = Math.floor(y);
      
      if (xf < halfWindow || xf >= width - halfWindow ||
          yf < halfWindow || yf >= height - halfWindow) {
        break;
      }
      
      // Build system of equations: A * delta = b
      let Axx = 0, Axy = 0, Ayy = 0, bx = 0, by = 0;
      
      for (let wy = -halfWindow; wy <= halfWindow; wy++) {
        for (let wx = -halfWindow; wx <= halfWindow; wx++) {
          const px = xf + wx;
          const py = yf + wy;
          
          // Get intensity values
          const prevIdx = (py * width + px);
          const prevI = prevData[prevIdx];
          
          // Bilinear interpolation for current frame
          const cx = x + wx;
          const cy = y + wy;
          const cx0 = Math.floor(cx);
          const cy0 = Math.floor(cy);
          const fx = cx - cx0;
          const fy = cy - cy0;
          
          let currI = 0;
          if (cx0 >= 0 && cx0 < width - 1 && cy0 >= 0 && cy0 < height - 1) {
            const i00 = currData[cy0 * width + cx0];
            const i10 = currData[cy0 * width + cx0 + 1];
            const i01 = currData[(cy0 + 1) * width + cx0];
            const i11 = currData[(cy0 + 1) * width + cx0 + 1];
            currI = (1 - fx) * (1 - fy) * i00 +
                    fx * (1 - fy) * i10 +
                    (1 - fx) * fy * i01 +
                    fx * fy * i11;
          }
          
          const Ix = (
            (currData[cy0 * width + cx0 + 1] - currData[cy0 * width + cx0]) +
            (currData[(cy0 + 1) * width + cx0 + 1] - currData[(cy0 + 1) * width + cx0])
          ) / 2;
          
          const Iy = (
            (currData[(cy0 + 1) * width + cx0] - currData[cy0 * width + cx0]) +
            (currData[(cy0 + 1) * width + cx0 + 1] - currData[cy0 * width + cx0 + 1])
          ) / 2;
          
          const It = prevI - currI;
          
          Axx += Ix * Ix;
          Axy += Ix * Iy;
          Ayy += Iy * Iy;
          bx += Ix * It;
          by += Iy * It;
        }
      }
      
      // Solve 2x2 system: [Axx Axy; Axy Ayy] * [dx; dy] = [bx; by]
      const det = Axx * Ayy - Axy * Axy;
      if (Math.abs(det) < 1e-8) break;
      
      const dx = (Ayy * bx - Axy * by) / det;
      const dy = (Axy * bx - Axx * by) / det;
      
      x += dx;
      y += dy;
      
      if (Math.hypot(dx, dy) < epsilon) {
        break;
      }
    }
    
    // Scale back up for next level
    x /= scale;
    y /= scale;
  }
  
  return { x, y, converged: true };
}

// ---------------------------------------------------------------------------
// Forward-Backward Error Validation
// ---------------------------------------------------------------------------

function validateTracking(
  prevPyramid: ImagePyramid,
  currPyramid: ImagePyramid,
  prevPt: { x: number; y: number },
  currPt: { x: number; y: number },
  windowSize: number,
  maxIterations: number,
  epsilon: number,
  fbThreshold: number
): number {
  // Track backward from current to previous
  const backward = lucasKanadeStep(
    currPyramid,
    prevPyramid,
    currPt,
    windowSize,
    maxIterations,
    epsilon
  );
  
  // Forward-backward error
  const fbError = Math.hypot(
    backward.x - prevPt.x,
    backward.y - prevPt.y
  );
  
  // Normalize error (typical range 0-10 pixels)
  const normalizedError = Math.min(1, fbError / 10);
  
  return 1 - normalizedError; // Return confidence (1 = perfect)
}

// ---------------------------------------------------------------------------
// Kalman Filter for Trajectory Smoothing
// ---------------------------------------------------------------------------

class KalmanFilter2D {
  private x: number; // Position x
  private y: number; // Position y
  private vx: number; // Velocity x
  private vy: number; // Velocity y
  private P: number[][]; // State covariance
  private Q: number[][]; // Process noise
  private R: number; // Measurement noise
  
  constructor(
    initialX: number,
    initialY: number,
    processNoise: number = 0.01,
    measurementNoise: number = 0.1
  ) {
    this.x = initialX;
    this.y = initialY;
    this.vx = 0;
    this.vy = 0;
    
    // State covariance [pos_x, pos_y, vel_x, vel_y]
    this.P = [
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
    ];
    
    // Process noise covariance
    this.Q = [
      [processNoise, 0, 0, 0],
      [0, processNoise, 0, 0],
      [0, 0, processNoise, 0],
      [0, 0, 0, processNoise],
    ];
    
    this.R = measurementNoise;
  }
  
  predict(dt: number = 1): { x: number; y: number } {
    // State transition
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    
    // Predict covariance (simplified)
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        this.P[i][j] += this.Q[i][j];
      }
    }
    
    return { x: this.x, y: this.y };
  }
  
  update(measuredX: number, measuredY: number): { x: number; y: number } {
    // Kalman gain (simplified diagonal approximation)
    const Kx = this.P[0][0] / (this.P[0][0] + this.R);
    const Ky = this.P[1][1] / (this.P[1][1] + this.R);
    
    // Update state
    this.x += Kx * (measuredX - this.x);
    this.y += Ky * (measuredY - this.y);
    
    // Update velocity
    this.vx = (measuredX - this.x) * 0.1;
    this.vy = (measuredY - this.y) * 0.1;
    
    // Update covariance
    this.P[0][0] *= (1 - Kx);
    this.P[1][1] *= (1 - Ky);
    
    return { x: this.x, y: this.y };
  }
  
  reset(x: number, y: number) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.P = [
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
    ];
  }
}

// ---------------------------------------------------------------------------
// Main Tracking Function
// ---------------------------------------------------------------------------

export async function trackWithOpticalFlow(
  videoEl: HTMLVideoElement,
  startTime: number,
  duration: number,
  initialRegion: { x: number; y: number; width: number; height: number },
  options: OpticalFlowOptions = {}
): Promise<OpticalFlowTrackResult[]> {
  const opts: Required<Omit<OpticalFlowOptions, 'onProgress' | 'shouldCancel' | 'clipTransform' | 'aspectRatio'>> = {
    pyramidLevels: options.pyramidLevels ?? 3,
    windowSize: options.windowSize ?? 15,
    maxIterations: options.maxIterations ?? 30,
    epsilon: options.epsilon ?? 0.01,
    fbThreshold: options.fbThreshold ?? 0.5,
    minFeatureAge: options.minFeatureAge ?? 5,
    refreshInterval: options.refreshInterval ?? 15,
    numFeatures: options.numFeatures ?? 50,
    qualityLevel: options.qualityLevel ?? 0.01,
    minFeatureDistance: options.minFeatureDistance ?? 10,
    enableSmoothing: options.enableSmoothing ?? true,
    kalmanProcessNoise: options.kalmanProcessNoise ?? 0.01,
    kalmanMeasurementNoise: options.kalmanMeasurementNoise ?? 0.1,
  };

  const fps = 30; // Track at higher FPS for better accuracy
  const frameInterval = 1 / fps;
  const numSteps = Math.ceil(duration / frameInterval);

  // Setup canvas in FRAME space
  const store = useEditorStore.getState();
  const aspectRatio = options.aspectRatio || store.aspectRatio || '16:9';
  const { W, H } = getFrameSize(aspectRatio);

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not create 2D canvas context');

  const placement = getClipFramePlacement(
    videoEl.videoWidth || 1920,
    videoEl.videoHeight || 1080,
    W,
    H,
    options.clipTransform
  );

  const paintFrame = () => {
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(videoEl, placement.x, placement.y, placement.w, placement.h);
  };

  const seekVideo = (time: number): Promise<void> => {
    return new Promise((resolve) => {
      let resolved = false;
      const timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          videoEl.removeEventListener('seeked', onSeeked);
          paintFrame();
          resolve();
        }
      }, 500);

      const onSeeked = () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          videoEl.removeEventListener('seeked', onSeeked);
          paintFrame();
          resolve();
        }
      };

      if (Math.abs(videoEl.currentTime - time) < 0.001) {
        resolved = true;
        clearTimeout(timeoutId);
        paintFrame();
        resolve();
        return;
      }

      videoEl.addEventListener('seeked', onSeeked);
      videoEl.currentTime = time;
    });
  };

  const results: OpticalFlowTrackResult[] = [];
  
  // Initialize Kalman filter
  const kalman = opts.enableSmoothing
    ? new KalmanFilter2D(
        initialRegion.x + initialRegion.width / 2,
        initialRegion.y + initialRegion.height / 2,
        opts.kalmanProcessNoise,
        opts.kalmanMeasurementNoise
      )
    : null;

  // Initialize feature points in the region
  let features: FeaturePoint[] = [];
  
  // Seek to start and detect initial features
  await seekVideo(startTime);
  
  let firstFrame: ImageData;
  try {
    firstFrame = ctx.getImageData(0, 0, W, H);
  } catch {
    throw new Error('Cannot read frame data');
  }

  // Detect features within the initial region
  const regionCenter = {
    x: initialRegion.x + initialRegion.width / 2,
    y: initialRegion.y + initialRegion.height / 2,
  };
  
  features = detectFeatures(
    firstFrame.data,
    W,
    H,
    opts.numFeatures,
    opts.qualityLevel,
    opts.minFeatureDistance
  ).filter((f) => {
    // Keep features within or near the initial region
    const dx = f.x - regionCenter.x;
    const dy = f.y - regionCenter.y;
    return Math.abs(dx) < initialRegion.width && Math.abs(dy) < initialRegion.height;
  });

  // If not enough features in region, use all detected
  if (features.length < 10) {
    features = detectFeatures(
      firstFrame.data,
      W,
      H,
      opts.numFeatures,
      opts.qualityLevel,
      opts.minFeatureDistance
    );
  }

  let prevPyramid = buildPyramid(firstFrame.data, W, H, opts.pyramidLevels);
  let prevTime = 0;

  // Add initial result
  results.push({
    time: 0,
    position: { x: regionCenter.x, y: regionCenter.y },
    scale: 1,
    rotation: 0,
    confidence: 1.0,
    featurePoints: features,
  });

  // Track frame by frame
  for (let step = 1; step <= numSteps; step++) {
    if (options.shouldCancel?.()) break;

    const relativeTime = step * frameInterval;
    const targetTime = startTime + relativeTime;

    if (targetTime > videoEl.duration) break;

    await seekVideo(targetTime);

    let currFrame: ImageData;
    try {
      currFrame = ctx.getImageData(0, 0, W, H);
    } catch {
      break;
    }

    const currPyramid = buildPyramid(currFrame.data, W, H, opts.pyramidLevels);

    // Track each feature point
    const trackedFeatures: FeaturePoint[] = [];
    let totalConfidence = 0;
    let validCount = 0;

    for (const feature of features) {
      // Track forward
      const tracked = lucasKanadeStep(
        prevPyramid,
        currPyramid,
        { x: feature.x, y: feature.y },
        opts.windowSize,
        opts.maxIterations,
        opts.epsilon
      );

      // Validate with forward-backward check
      const confidence = validateTracking(
        prevPyramid,
        currPyramid,
        { x: feature.x, y: feature.y },
        tracked,
        opts.windowSize,
        opts.maxIterations,
        opts.epsilon,
        opts.fbThreshold
      );

      if (confidence >= opts.fbThreshold) {
        const newFeature: FeaturePoint = {
          ...feature,
          x: tracked.x,
          y: tracked.y,
          confidence,
          age: feature.age + 1,
          trackHistory: [
            ...feature.trackHistory,
            { x: tracked.x, y: tracked.y, frame: step },
          ].slice(-20), // Keep last 20 frames
        };
        trackedFeatures.push(newFeature);
        totalConfidence += confidence;
        validCount++;
      }
    }

    // Refresh old/lost features
    if (validCount < opts.numFeatures * 0.7 || step % opts.refreshInterval === 0) {
      const oldFeatures = trackedFeatures.filter((f) => f.age < opts.minFeatureAge);
      const needed = opts.numFeatures - trackedFeatures.length;
      
      if (needed > 0 && oldFeatures.length > 0) {
        const newFeatures = detectFeatures(
          currFrame.data,
          W,
          H,
          needed * 2,
          opts.qualityLevel,
          opts.minFeatureDistance
        ).slice(0, needed);
        
        trackedFeatures.push(...newFeatures.map((f) => ({
          ...f,
          age: 0,
          trackHistory: [{ x: f.x, y: f.y, frame: step }],
        })));
      }
    }

    features = trackedFeatures;

    // Compute region position from feature points
    if (features.length > 0) {
      let avgX = 0;
      let avgY = 0;
      let weightedSum = 0;

      for (const f of features) {
        avgX += f.x * f.confidence;
        avgY += f.y * f.confidence;
        weightedSum += f.confidence;
      }

      avgX /= weightedSum;
      avgY /= weightedSum;

      // Apply Kalman smoothing
      let finalX = avgX;
      let finalY = avgY;

      if (kalman) {
        kalman.predict();
        const smoothed = kalman.update(avgX, avgY);
        finalX = smoothed.x;
        finalY = smoothed.y;
      }

      // Estimate scale change from feature spread
      let scale = 1;
      if (features.length >= 2 && step > 1) {
        const prevSpread = computeFeatureSpread(features, step - 1);
        const currSpread = computeFeatureSpread(features, step);
        if (prevSpread > 0) {
          scale = Math.sqrt(currSpread / prevSpread);
          scale = Math.max(0.5, Math.min(2.0, scale)); // Clamp scale change
        }
      }

      // Estimate rotation from feature orientation
      let rotation = 0;
      if (features.length >= 2) {
        rotation = estimateRotation(features);
      }

      const avgConfidence = validCount > 0 ? totalConfidence / validCount : 0;

      results.push({
        time: relativeTime,
        position: { x: finalX, y: finalY },
        scale,
        rotation,
        confidence: avgConfidence,
        featurePoints: features,
      });
    } else {
      // No valid features - use prediction or hold last position
      const lastResult = results[results.length - 1];
      if (lastResult && kalman) {
        const predicted = kalman.predict();
        results.push({
          time: relativeTime,
          position: predicted,
          scale: lastResult.scale,
          rotation: lastResult.rotation,
          confidence: 0.1, // Low confidence
          featurePoints: [],
        });
      }
    }

    prevPyramid = currPyramid;
    prevTime = relativeTime;

    options.onProgress?.(step / numSteps);
  }

  return results;
}

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

function computeFeatureSpread(features: FeaturePoint[], frame: number): number {
  if (features.length < 2) return 0;

  const positions = features
    .map((f) => f.trackHistory.find((h) => h.frame === frame) || f)
    .filter((p) => p !== null);

  if (positions.length < 2) return 0;

  let sumDistSq = 0;
  let count = 0;

  const centroid = {
    x: positions.reduce((sum, p) => sum + p.x, 0) / positions.length,
    y: positions.reduce((sum, p) => sum + p.y, 0) / positions.length,
  };

  for (const p of positions) {
    const dx = p.x - centroid.x;
    const dy = p.y - centroid.y;
    sumDistSq += dx * dx + dy * dy;
    count++;
  }

  return count > 0 ? sumDistSq / count : 0;
}

function estimateRotation(features: FeaturePoint[]): number {
  if (features.length < 2) return 0;

  // Use PCA-like approach to estimate dominant orientation
  let sumXX = 0, sumXY = 0, sumYY = 0;
  const centroid = {
    x: features.reduce((sum, f) => sum + f.x, 0) / features.length,
    y: features.reduce((sum, f) => sum + f.y, 0) / features.length,
  };

  for (const f of features) {
    const dx = f.x - centroid.x;
    const dy = f.y - centroid.y;
    sumXX += dx * dx;
    sumXY += dx * dy;
    sumYY += dy * dy;
  }

  // Angle of principal component
  const angle = 0.5 * Math.atan2(2 * sumXY, sumXX - sumYY);
  return (angle * 180) / Math.PI; // Convert to degrees
}
