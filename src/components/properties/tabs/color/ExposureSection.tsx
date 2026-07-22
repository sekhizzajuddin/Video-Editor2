import { ColorSlider } from './ColorSlider';

interface ExposureSectionProps {
  exposure: number;
  onChange: (val: number) => void;
  onReset: () => void;
}

export function ExposureSection({ exposure, onChange, onReset }: ExposureSectionProps) {
  return (
    <ColorSlider
      label="Exposure"
      value={exposure}
      min={-100}
      max={100}
      onChange={onChange}
      onReset={onReset}
      formatValue={(v) => v > 0 ? `+${v}` : `${v}`}
    />
  );
}