import { SpeedRampEngine } from '../src/utils/speedRamp';

const clip = { duration: 8.0, trimStart: 0, trimEnd: 0 };
const maxDuration = 8.0;

const speedRamp = [
  { id: 'start', sourceTime: 0.0, speed: 1.0, easing: 'linear' },
  { id: 'kf1', sourceTime: 1.36, speed: 3.33, easing: 'cubic-in-out' },
  { id: 'kf2', sourceTime: 4.56, speed: 3.58, easing: 'cubic-in-out' },
  { id: 'kf3', sourceTime: 5.84, speed: 3.72, easing: 'cubic-in-out' },
  { id: 'end', sourceTime: 8.0, speed: 1.0, easing: 'linear' },
];

const tempEngine = new SpeedRampEngine(speedRamp as any);
const sourceEnd = maxDuration - clip.trimEnd;
const calculatedDuration = tempEngine.sourceToTimeline(sourceEnd) - tempEngine.sourceToTimeline(clip.trimStart);

console.log("Calculated duration:", calculatedDuration);
