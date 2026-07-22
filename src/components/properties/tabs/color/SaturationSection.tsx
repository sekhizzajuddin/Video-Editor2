import { ColorSlider } from './ColorSlider';

interface SaturationSectionProps {
  saturation: number;
  onChange: (val: number) => void;
  onReset: () => void;
}

export function SaturationSection({ saturation, onChange, onReset }: SaturationSectionProps) {
  return (
    <ColorSlider
      label="Saturation"
      value={saturation}
      min={0}
      max={200}
      onChange={onChange}
      onReset={onReset}
    />
  );
}