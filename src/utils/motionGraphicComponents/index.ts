import { VoiceSyncHighlight } from './VoiceSyncHighlight';
import { KineticWord } from './KineticWord';
import { MotionArrow } from './MotionArrow';
import { AnimatedBarChart } from './AnimatedBarChart';
import { AnimatedLineGraph } from './AnimatedLineGraph';
import { AnimatedCounter } from './AnimatedCounter';
import { LowerThird } from './LowerThird';
import { TitleCard } from './TitleCard';
import { ParticleBurst } from './ParticleBurst';
import { CircleHighlight } from './CircleHighlight';
import { VectorShape } from './VectorShape';

export type ComponentDrawFn = (
  ctx: CanvasRenderingContext2D,
  config: any,
  localTime: number,
  totalDuration: number,
  canvasW: number,
  canvasH: number
) => void;

export const COMPONENT_REGISTRY: Record<string, ComponentDrawFn> = {
  // PascalCase
  VoiceSyncHighlight,
  KineticWord,
  MotionArrow,
  AnimatedBarChart,
  AnimatedLineGraph,
  AnimatedCounter,
  LowerThird,
  TitleCard,
  ParticleBurst,
  CircleHighlight,
  VectorShape,

  // camelCase
  voiceSyncHighlight: VoiceSyncHighlight,
  kineticWord: KineticWord,
  motionArrow: MotionArrow,
  animatedBarChart: AnimatedBarChart,
  animatedLineGraph: AnimatedLineGraph,
  animatedCounter: AnimatedCounter,
  lowerThird: LowerThird,
  titleCard: TitleCard,
  particleBurst: ParticleBurst,
  circleHighlight: CircleHighlight,
  vectorShape: VectorShape,

  // kebab-case
  'voice-sync-highlight': VoiceSyncHighlight,
  'kinetic-word': KineticWord,
  'motion-arrow': MotionArrow,
  'animated-bar-chart': AnimatedBarChart,
  'animated-line-graph': AnimatedLineGraph,
  'animated-counter': AnimatedCounter,
  'lower-third': LowerThird,
  'title-card': TitleCard,
  'particle-burst': ParticleBurst,
  'circle-highlight': CircleHighlight,
  'vector-shape': VectorShape,
};

/**
 * Draws a registered motion graphic component by name.
 */
export function drawComponent(
  name: string,
  ctx: CanvasRenderingContext2D,
  config: any,
  localTime: number,
  totalDuration: number,
  canvasW: number,
  canvasH: number
): boolean {
  const drawFn = COMPONENT_REGISTRY[name];
  if (drawFn) {
    drawFn(ctx, config, localTime, totalDuration, canvasW, canvasH);
    return true;
  }
  return false;
}

// Re-export individual components
export {
  VoiceSyncHighlight,
  KineticWord,
  MotionArrow,
  AnimatedBarChart,
  AnimatedLineGraph,
  AnimatedCounter,
  LowerThird,
  TitleCard,
  ParticleBurst,
  CircleHighlight,
};
