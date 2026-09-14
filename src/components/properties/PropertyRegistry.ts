import {
  PositionSection,
  ScaleSection,
  RotationSection,
  OpacitySection,
  SmartReframeSection,
  KeyframesSection,
  FlipSection,
  WarpSection,
  CropSection,
  BlendSection,
} from './tabs/transform';

import {
  TemperatureSection,
  TintSection,
  ExposureSection,
  ContrastSection,
  SaturationSection,
  BlurSection,
  FadedFilmSection,
  VignetteSection,
  ColorGradeTransferSection,
} from './tabs/color';
import { CurvesEditor } from './tabs/color/CurvesEditor';

import {
  VolumeSection,
  PanSection,
  EQSection,
  AutoVoiceTuneSection,
  AutoDuckingSection,
  AISoundDesignerSection,
} from './tabs/audio';

import {
  SpeedSliderSection,
  DynamicStretchSection,
} from './tabs/speed';

import {
  MaskEnableSection,
  MaskTypeSection,
  MaskParametersSection,
  MaskInvertSection,
} from './tabs/mask';
import { ChromaKeySection } from './tabs/effects/ChromaKeySection';

import {
  TextContentSection,
  FontFamilySection,
  FontSizeSection,
  TextColorSection,
  TextShadowSection,
  TextStyleButtonsSection,
  TextStylePresetsSection,
} from './tabs/text';

import {
  KineticTypographySection,
  BeatSyncSection,
  AISFXSection,
} from './tabs/effects';
import { ObjectRemovalPanel } from './tabs/effects/ObjectRemovalPanel';

export const PROPERTY_REGISTRY: Record<string, any[]> = {
  style: [
    { id: 'keyframes', label: 'Keyframes', component: KeyframesSection },
    { id: 'scale', label: 'Scale', component: ScaleSection },
    { id: 'position', label: 'Position', component: PositionSection },
    { id: 'rotation', label: 'Rotation', component: RotationSection },
    { id: 'opacity', label: 'Opacity', component: OpacitySection },
    { id: 'flip', label: 'Flip', component: FlipSection },
    { id: 'perspective', label: 'Warp', component: WarpSection },
    { id: 'blend', label: 'Blend', component: BlendSection },
    { id: 'crop', label: 'Crop', component: CropSection },
    { id: 'reframe', label: 'Smart Reframe', component: SmartReframeSection },
  ],
  color: [
    { id: 'temp', label: 'Temp', component: TemperatureSection },
    { id: 'tint', label: 'Tint', component: TintSection },
    { id: 'exposure', label: 'Exposure', component: ExposureSection },
    { id: 'contrast', label: 'Contrast', component: ContrastSection },
    { id: 'saturation', label: 'Saturation', component: SaturationSection },
    { id: 'blur', label: 'Blur', component: BlurSection },
    { id: 'faded', label: 'Faded Film', component: FadedFilmSection },
    { id: 'vignette', label: 'Vignette', component: VignetteSection },
    { id: 'curves', label: 'Curves', component: CurvesEditor },
    { id: 'transfer', label: 'Color Transfer', component: ColorGradeTransferSection },
  ],
  audio: [
    { id: 'volume', label: 'Volume', component: VolumeSection },
    { id: 'pan', label: 'Pan', component: PanSection },
    { id: 'ducking', label: 'Auto Ducking', component: AutoDuckingSection },
    { id: 'eq', label: 'EQ', component: EQSection },
    { id: 'voicetune', label: 'Voice Tune', component: AutoVoiceTuneSection },
    { id: 'sounddesign', label: 'Sound Design', component: AISoundDesignerSection },
  ],
  speed: [
    { id: 'dynamicStretch', label: 'Dynamic Stretch', component: DynamicStretchSection },
    { id: 'speed', label: 'Constant Speed', component: SpeedSliderSection },
  ],
  mask: [
    { id: 'mask', label: 'Enable', component: MaskEnableSection },
    { id: 'type', label: 'Shape', component: MaskTypeSection },
    { id: 'params', label: 'Parameters', component: MaskParametersSection },
    { id: 'invert', label: 'Invert', component: MaskInvertSection },
    { id: 'chroma', label: 'Chroma Key', component: ChromaKeySection },
  ],
  text: [
    { id: 'content', label: 'Text', component: TextContentSection },
    { id: 'font', label: 'Font', component: FontFamilySection },
    { id: 'fontSize', label: 'Size', component: FontSizeSection },
    { id: 'color', label: 'Color', component: TextColorSection },
    { id: 'styleBtns', label: 'Style', component: TextStyleButtonsSection },
    { id: 'presets', label: 'Presets', component: TextStylePresetsSection },
    { id: 'shadow', label: 'Shadow', component: TextShadowSection },
  ],
  ai: [
    { id: 'kinetic', label: 'Kinetic', component: KineticTypographySection },
    { id: 'beatsync', label: 'Beat Sync', component: BeatSyncSection },
    { id: 'sfx', label: 'SFX', component: AISFXSection },
    { id: 'object_removal', label: 'Object Removal', component: ObjectRemovalPanel },
  ],
};
