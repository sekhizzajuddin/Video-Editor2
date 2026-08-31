import { ColorSlider } from './ColorSlider';

interface TintSectionProps {
  tint: number;
  onChange: (val: number) => void;
  onReset: () => void;
}

export function TintSection({ tint, onChange, onReset }: TintSectionProps) {
  return (
    <ColorSlider
      label="Tint"
      value={tint}
      min={-100}
      max={100}
      onChange={onChange}
      onReset={onReset}
      formatValue={(v) => v > 0 ? `+${v}` : `${v}`}
      gradient="bg-gradient-to-r from-green-500 via-accent to-purple-500"
    />
  );
}