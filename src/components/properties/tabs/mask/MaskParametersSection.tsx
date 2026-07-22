import { MaskSlider } from './MaskSlider';

interface MaskParametersSectionProps {
  mask: any;
  onChange: (prop: string, val: number) => void;
}

export function MaskParametersSection({ mask, onChange }: MaskParametersSectionProps) {
  return (
    <div className="space-y-3">
      <MaskSlider label="X Position" value={mask.x} min={0} max={100} unit="%" prop="x" onChange={onChange} />
      <MaskSlider label="Y Position" value={mask.y} min={0} max={100} unit="%" prop="y" onChange={onChange} />
      <MaskSlider label="Width" value={mask.width} min={0} max={100} unit="%" prop="width" onChange={onChange} />
      <MaskSlider label="Height" value={mask.height} min={0} max={100} unit="%" prop="height" onChange={onChange} />
      <MaskSlider label="Feather" value={mask.feather} min={0} max={100} unit="%" prop="feather" onChange={onChange} />
      <MaskSlider label="Rotation" value={mask.rotation} min={0} max={360} unit="°" prop="rotation" onChange={onChange} />
      <MaskSlider label="Roundness" value={mask.roundness} min={0} max={100} unit="%" prop="roundness" onChange={onChange} />
    </div>
  );
}