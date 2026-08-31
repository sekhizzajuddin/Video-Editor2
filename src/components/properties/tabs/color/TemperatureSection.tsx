import { ColorSlider } from './ColorSlider';

interface TemperatureSectionProps {
  temperature: number;
  onChange: (val: number) => void;
  onReset: () => void;
}

export function TemperatureSection({ temperature, onChange, onReset }: TemperatureSectionProps) {
  return (
    <ColorSlider
      label="Temperature"
      value={temperature}
      min={-100}
      max={100}
      onChange={onChange}
      onReset={onReset}
      formatValue={(v) => v > 0 ? `+${v}` : `${v}`}
      gradient="bg-gradient-to-r from-blue-500 via-accent to-orange-500"
      title="Double-click to reset to 0"
    />
  );
}