import { ColorSlider } from './ColorSlider';

interface ContrastSectionProps {
  contrast: number;
  onChange: (val: number) => void;
  onReset: () => void;
}

export function ContrastSection({ contrast, onChange, onReset }: ContrastSectionProps) {
  return (
    <ColorSlider
      label="Contrast"
      value={contrast}
      min={0}
      max={200}
      onChange={onChange}
      onReset={onReset}
    />
  );
}