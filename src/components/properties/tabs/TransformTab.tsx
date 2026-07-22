import type { Clip, ClipAnimations } from '@/types';
import {
  SmartReframeSection,
  KeyframesSection,
  PositionSection,
  ScaleSection,
  RotationSection,
  OpacitySection,
} from './transform';

interface TransformTabProps {
  selectedClip: Clip;
  selectedClipIds: string[];
  localTime: number;
  absoluteStartTime: number;
  animations: ClipAnimations;
  collapsedSections: Record<string, boolean>;
  toggleSection: (section: string) => void;
  getPropVal: (base: number, propKey: string) => number;
  setPropVal: (propKey: string, value: number, baseUpdateObj: any) => void;
  handleToggleMasterKeyframe: () => void;
  getMasterKeyframes: () => number[];
  deleteMasterKeyframe: (clipId: string, time: number) => void;
  updateClip: (clipId: string, updates: any, options?: { ripple?: boolean }) => void;
}

export function TransformTab(props: TransformTabProps) {
  const {
    selectedClip,
    localTime,
    absoluteStartTime,
    animations,
    collapsedSections,
    toggleSection,
    getPropVal,
    setPropVal,
    handleToggleMasterKeyframe,
    getMasterKeyframes,
    deleteMasterKeyframe,
    updateClip,
  } = props;

  const keyframeTimes = getMasterKeyframes();
  const hasMasterKeyframes = keyframeTimes.length > 0;
  const isOnKeyframe = keyframeTimes.some((t) => Math.abs(t - localTime) < 0.05);

  return (
    <div className="space-y-3">
      <SmartReframeSection selectedClip={selectedClip} updateClip={updateClip} />

      <KeyframesSection
        selectedClip={selectedClip}
        localTime={localTime}
        animations={animations}
        keyframeTimes={keyframeTimes}
        hasMasterKeyframes={hasMasterKeyframes}
        isOnKeyframe={isOnKeyframe}
        handleToggleMasterKeyframe={handleToggleMasterKeyframe}
        deleteMasterKeyframe={deleteMasterKeyframe}
      />

      <PositionSection
        selectedClip={selectedClip}
        localTime={localTime}
        absoluteStartTime={absoluteStartTime}
        animations={animations}
        collapsedSections={collapsedSections}
        toggleSection={toggleSection}
        getPropVal={getPropVal}
        setPropVal={setPropVal}
        updateClip={updateClip}
      />

      <ScaleSection
        selectedClip={selectedClip}
        localTime={localTime}
        absoluteStartTime={absoluteStartTime}
        animations={animations}
        collapsedSections={collapsedSections}
        toggleSection={toggleSection}
        getPropVal={getPropVal}
        setPropVal={setPropVal}
        updateClip={updateClip}
      />

      <RotationSection
        selectedClip={selectedClip}
        localTime={localTime}
        absoluteStartTime={absoluteStartTime}
        animations={animations}
        collapsedSections={collapsedSections}
        toggleSection={toggleSection}
        getPropVal={getPropVal}
        setPropVal={setPropVal}
        updateClip={updateClip}
      />

      <OpacitySection
        selectedClip={selectedClip}
        localTime={localTime}
        absoluteStartTime={absoluteStartTime}
        animations={animations}
        collapsedSections={collapsedSections}
        toggleSection={toggleSection}
        getPropVal={getPropVal}
        setPropVal={setPropVal}
        updateClip={updateClip}
      />
    </div>
  );
}