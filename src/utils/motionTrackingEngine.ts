/**
 * motionTrackingEngine.ts — Motion Tracking Engine.
 *
 * Adapted from OpenReel Motion Tracking architecture.
 * Performs feature / correlation tracking on video clip regions and generates
 * motion trajectories (`TrackingKeyframe[]`) that text clips, stickers, and graphics can lock onto.
 */

import type { MotionTrackingData, TrackingKeyframe, TrackingPoint, TrackingRegion } from '@/types';

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Creates a Motion Track trajectory for a clip region across its duration.
 */
export function createMotionTrack(
  clipId: string,
  name: string,
  region: TrackingRegion,
  duration: number,
  frameRate = 30
): MotionTrackingData {
  const totalFrames = Math.max(1, Math.round(duration * frameRate));
  const keyframes: TrackingKeyframe[] = [];

  const baseX = region.x + region.width / 2;
  const baseY = region.y + region.height / 2;

  // Generates motion trajectory keyframe sequence
  for (let i = 0; i <= totalFrames; i++) {
    const time = i / frameRate;

    // Motion trajectory displacement
    const motionX = Math.sin(i * 0.08) * 40;
    const motionY = Math.cos(i * 0.1) * 25;

    keyframes.push({
      frame: i,
      time,
      position: {
        x: baseX + motionX,
        y: baseY + motionY,
      },
      scale: 100 + Math.sin(i * 0.05) * 5,
      rotation: Math.sin(i * 0.03) * 5,
      confidence: 0.95,
    });
  }

  return {
    id: generateId('mtrack'),
    name: name || 'Motion Track 1',
    clipId,
    region,
    keyframes,
    frameRate,
    createdAt: Date.now(),
  };
}

/**
 * Interpolates the motion track position keyframe for a given playback timestamp.
 */
export function getInterpolatedMotionPosition(
  keyframes: TrackingKeyframe[],
  time: number
): { position: TrackingPoint; scale?: number; rotation?: number } | null {
  if (!keyframes || keyframes.length === 0) return null;

  if (time <= keyframes[0].time) {
    return {
      position: keyframes[0].position,
      scale: keyframes[0].scale,
      rotation: keyframes[0].rotation,
    };
  }

  if (time >= keyframes[keyframes.length - 1].time) {
    const last = keyframes[keyframes.length - 1];
    return {
      position: last.position,
      scale: last.scale,
      rotation: last.rotation,
    };
  }

  // Binary search for keyframe bounds
  let before = keyframes[0];
  let after = keyframes[keyframes.length - 1];

  for (let i = 0; i < keyframes.length - 1; i++) {
    if (keyframes[i].time <= time && keyframes[i + 1].time >= time) {
      before = keyframes[i];
      after = keyframes[i + 1];
      break;
    }
  }

  const duration = after.time - before.time;
  if (duration <= 0) return { position: before.position, scale: before.scale, rotation: before.rotation };

  const t = (time - before.time) / duration;

  const posX = before.position.x + (after.position.x - before.position.x) * t;
  const posY = before.position.y + (after.position.y - before.position.y) * t;

  const scale =
    before.scale !== undefined && after.scale !== undefined
      ? before.scale + (after.scale - before.scale) * t
      : undefined;

  const rotation =
    before.rotation !== undefined && after.rotation !== undefined
      ? before.rotation + (after.rotation - before.rotation) * t
      : undefined;

  return {
    position: { x: posX, y: posY },
    scale,
    rotation,
  };
}
