import { TimelineClip } from '@/types';

export interface FeatureProps {
  clip: TimelineClip;
  localTime?: number;
  isKfActive?: (propKey: string) => boolean;
  addKf?: (propKey: string, val: number) => void;
  remKf?: (propKey: string) => void;
  getPropVal?: (baseVal: number | undefined, propKey: string) => number;
}
