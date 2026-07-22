import { ColorSlider } from './ColorSlider';

interface BlurSectionProps {
  blur: number;
  onChange: (val: number) => void;
  onReset: () => void;
}

export function BlurSection({ blur, onChange, onReset }: BlurSectionProps) {
  return (
    <ColorSlider
      label="Blur"
      value={blur}
      min={0}
      max={100}
      onChange={onChange}
      onReset={onReset}
    />
  );
}