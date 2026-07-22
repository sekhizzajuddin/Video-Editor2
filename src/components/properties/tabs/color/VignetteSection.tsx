import { ColorSlider } from './ColorSlider';

interface VignetteSectionProps {
  vignette: number;
  onChange: (val: number) => void;
  onReset: () => void;
}

export function VignetteSection({ vignette, onChange, onReset }: VignetteSectionProps) {
  return (
    <ColorSlider
      label="Vignette"
      value={vignette}
      min={0}
      max={100}
      onChange={onChange}
      onReset={onReset}
    />
  );
}