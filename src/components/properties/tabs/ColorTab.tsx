import type { TimelineClip } from '@/types';
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
  ColorGradeTransferSection,
} from './color';

interface ColorTabProps {
  selectedClip: TimelineClip;
  selectedClipIds?: string[];
  TimelineClipFilters: any;
  collapsedSections: Record<string, boolean>;
  toggleSection: (section: string) => void;
  getPropVal: (base: number, propKey: string) => number;
  handleFilterChange: (key: string, val: number) => void;
  handleFilterReset: (key: string) => void;
}

export function ColorTab({
  selectedClip,
  selectedClipIds = [],
  TimelineClipFilters,
  collapsedSections,
  toggleSection,
  getPropVal,
  handleFilterChange,
  handleFilterReset,
}: ColorTabProps) {
  return (
    <div className="space-y-3">
      <ColorGradeTransferSection
        selectedClip={selectedClip}
        selectedClipIds={selectedClipIds}
      />

      <ColorSectionContainer
        title="Basic Correction"
        sectionKey="colorBasic"
        collapsedSections={collapsedSections}
        toggleSection={toggleSection}
      >
        <TemperatureSection
          temperature={getPropVal(TimelineClipFilters.temperature, 'color.temperature')}
          onChange={(val) => handleFilterChange('temperature', val)}
          onReset={() => handleFilterReset('temperature')}
        />
        <TintSection
          tint={getPropVal(TimelineClipFilters.tint, 'color.tint')}
          onChange={(val) => handleFilterChange('tint', val)}
          onReset={() => handleFilterReset('tint')}
        />
        <ExposureSection
          exposure={getPropVal(TimelineClipFilters.exposure, 'color.exposure')}
          onChange={(val) => handleFilterChange('exposure', val)}
          onReset={() => handleFilterReset('exposure')}
        />
        <ContrastSection
          contrast={getPropVal(TimelineClipFilters.contrast, 'color.contrast')}
          onChange={(val) => handleFilterChange('contrast', val)}
          onReset={() => handleFilterReset('contrast')}
        />
        <SaturationSection
          saturation={getPropVal(TimelineClipFilters.saturation, 'color.saturation')}
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
          blur={getPropVal(TimelineClipFilters.blur, 'color.blur')}
          onChange={(val) => handleFilterChange('blur', val)}
          onReset={() => handleFilterReset('blur')}
        />
        <FadedFilmSection
          fadedFilm={getPropVal(TimelineClipFilters.fadedFilm, 'color.fadedFilm')}
          onChange={(val) => handleFilterChange('fadedFilm', val)}
          onReset={() => handleFilterReset('fadedFilm')}
        />
        <VignetteSection
          vignette={getPropVal(TimelineClipFilters.vignette, 'color.vignette')}
          onChange={(val) => handleFilterChange('vignette', val)}
          onReset={() => handleFilterReset('vignette')}
        />
      </ColorSectionContainer>
    </div>
  );
}
