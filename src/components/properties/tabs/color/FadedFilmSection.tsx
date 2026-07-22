import { ColorSlider } from './ColorSlider';

interface FadedFilmSectionProps {
  fadedFilm: number;
  onChange: (val: number) => void;
  onReset: () => void;
}

export function FadedFilmSection({ fadedFilm, onChange, onReset }: FadedFilmSectionProps) {
  return (
    <ColorSlider
      label="Faded Film"
      value={fadedFilm}
      min={0}
      max={100}
      onChange={onChange}
      onReset={onReset}
    />
  );
}