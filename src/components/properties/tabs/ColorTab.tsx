import type { Clip } from '@/types';
import {
  ColorSectionContainer,
  TemperatureSection,
  TintSection,
  ExposureSection,
  ContrastSection,
  SaturationSection,
  BlurSection,
  FadedFilmSection,
  VignetteSection,
} from './color';

interface ColorTabProps {
  selectedClip: Clip;
  clipFilters: any;
  collapsedSections: Record<string, boolean>;
  toggleSection: (section: string) => void;
  getPropVal: (base: number, propKey: string) => number;
  handleFilterChange: (key: string, val: number) => void;
  handleFilterReset: (key: string) => void;
}

export function ColorTab({
  clipFilters,
  collapsedSections,
  toggleSection,
  getPropVal,
  handleFilterChange,
  handleFilterReset,
}: ColorTabProps) {
  return (
    <div className="space-y-3">
      <ColorSectionContainer
        title="Basic Correction"
        sectionKey="colorBasic"
        collapsedSections={collapsedSections}
        toggleSection={toggleSection}
      >
        <TemperatureSection
          temperature={getPropVal(clipFilters.temperature, 'color.temperature')}
          onChange={(val) => handleFilterChange('temperature', val)}
          onReset={() => handleFilterReset('temperature')}
        />
        <TintSection
          tint={getPropVal(clipFilters.tint, 'color.tint')}
          onChange={(val) => handleFilterChange('tint', val)}
          onReset={() => handleFilterReset('tint')}
        />
        <ExposureSection
          exposure={getPropVal(clipFilters.exposure, 'color.exposure')}
          onChange={(val) => handleFilterChange('exposure', val)}
          onReset={() => handleFilterReset('exposure')}
        />
        <ContrastSection
          contrast={getPropVal(clipFilters.contrast, 'color.contrast')}
          onChange={(val) => handleFilterChange('contrast', val)}
          onReset={() => handleFilterReset('contrast')}
        />
        <SaturationSection
          saturation={getPropVal(clipFilters.saturation, 'color.saturation')}
          onChange={(val) => handleFilterChange('saturation', val)}
          onReset={() => handleFilterReset('saturation')}
        />
      </ColorSectionContainer>

      <ColorSectionContainer
        title="Creative"
        sectionKey="colorCreative"
        collapsedSections={collapsedSections}
        toggleSection={toggleSection}
      >
        <BlurSection
          blur={getPropVal(clipFilters.blur, 'color.blur')}
          onChange={(val) => handleFilterChange('blur', val)}
          onReset={() => handleFilterReset('blur')}
        />
        <FadedFilmSection
          fadedFilm={getPropVal(clipFilters.fadedFilm, 'color.fadedFilm')}
          onChange={(val) => handleFilterChange('fadedFilm', val)}
          onReset={() => handleFilterReset('fadedFilm')}
        />
        <VignetteSection
          vignette={getPropVal(clipFilters.vignette, 'color.vignette')}
          onChange={(val) => handleFilterChange('vignette', val)}
          onReset={() => handleFilterReset('vignette')}
        />
      </ColorSectionContainer>
    </div>
  );
}