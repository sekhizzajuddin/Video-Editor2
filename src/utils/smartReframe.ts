import { TimelineClip, ClipAnimations, PropertyKeyframe } from '@/types';

/**
 * Simulates a Smart Reframe (face tracking) algorithm.
 * Generates smooth panning keyframes across the X axis.
 */
export function generateSmartReframeKeyframes(
  clip: TimelineClip,
  targetAspectRatio: '16:9' | '9:16' | '1:1'
): ClipAnimations {
  const duration = clip.duration;
  
  const xKeyframes: PropertyKeyframe[] = [];
  
  const interval = 2;
  const numKeyframes = Math.ceil(duration / interval);
  
  let currentX = 0;
  
  for (let i = 0; i <= numKeyframes; i++) {
    const time = Math.min(i * interval, duration);
    
    // Simulate subject movement with smooth random walk
    const movement = (Math.random() - 0.5) * 150; 
    currentX = Math.max(-250, Math.min(250, currentX + movement));
    
    xKeyframes.push({
      time,
      value: currentX,
      easing: 'ease-in-out'
    });
  }

  // Ensure last keyframe reaches end
  if (xKeyframes[xKeyframes.length - 1].time < duration) {
    xKeyframes.push({
      time: duration,
      value: xKeyframes[xKeyframes.length - 1].value,
      easing: 'linear'
    });
  }

  return {
    ...clip.animations,
    'transform.x': xKeyframes
  };
}
