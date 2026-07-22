import type { Clip } from '@/types';
import {
  MaskEnableSection,
  MaskTypeSection,
  MaskParametersSection,
  MaskInvertSection,
} from './mask';

interface MaskTabProps {
  selectedClip: Clip;
  updateClip: (clipId: string, updates: any) => void;
}

export function MaskTab({ selectedClip, updateClip }: MaskTabProps) {
  const mask = selectedClip.mask || { enabled: false, type: 'rectangle', x: 50, y: 50, width: 50, height: 50, points: [], feather: 0, invert: false, rotation: 0, roundness: 0, matteSourceClipId: '' };
  
  const updateMask = (updates: any) => {
    updateClip(selectedClip.id, { mask: { ...mask, ...updates } });
  };

  const handleMaskParamChange = (prop: string, val: number) => {
    updateMask({ [prop]: val });
  };

  return (
    <div className="space-y-4">
      <MaskEnableSection
        enabled={mask.enabled}
        onToggle={() => updateMask({ enabled: !mask.enabled })}
      />

      {mask.enabled && (
        <>
          <MaskTypeSection
            maskType={mask.type}
            onChange={(val) => updateMask({ type: val })}
          />

          <MaskParametersSection
            mask={mask}
            onChange={handleMaskParamChange}
          />

          <MaskInvertSection
            invert={mask.invert}
            onToggle={() => updateMask({ invert: !mask.invert })}
          />
        </>
      )}
    </div>
  );
}