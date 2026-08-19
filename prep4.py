import re

with open('src/mobile/components/MobilePropertiesSheet.tsx', 'r', encoding='utf8') as f:
    code = f.read()

new_imports = """
import { PositionSection, ScaleSection, RotationSection, OpacitySection, SmartReframeSection } from '@/components/properties/tabs/transform';
import { TemperatureSection, TintSection, ExposureSection, ContrastSection, SaturationSection, BlurSection, FadedFilmSection, VignetteSection, ColorGradeTransferSection } from '@/components/properties/tabs/color';
import { CurvesEditor } from '@/components/properties/tabs/color/CurvesEditor';
import { VolumeSection, PanSection, EQSection, AutoVoiceTuneSection, AutoDuckingSection, AISoundDesignerSection } from '@/components/properties/tabs/audio';
import { SpeedSliderSection, PresetRampsSection, SpeedRampingSection } from '@/components/properties/tabs/speed';
import { MaskTypeSection, MaskParametersSection, MaskEnableSection, MaskInvertSection } from '@/components/properties/tabs/mask';
import { ChromaKeySection } from '@/components/properties/tabs/effects/ChromaKeySection';
import { ObjectRemovalPanel } from '@/components/properties/tabs/effects/ObjectRemovalPanel';
import { KineticTypographySection, BeatSyncSection, AISFXSection } from '@/components/properties/tabs/effects';
import { TextContentSection, FontFamilySection, FontSizeSection, TextColorSection, TextShadowSection, TextStyleButtonsSection, TextStylePresetsSection } from '@/components/properties/tabs/text';
import { getAnimatedValue } from '@/utils/keyframes';
"""

code = code.replace("import { useEditorStore, findClipDeep } from '@/store/editorStore';", new_imports + "\nimport { useEditorStore, findClipDeep } from '@/store/editorStore';")

with open('src/mobile/components/MobilePropertiesSheet.tsx', 'w', encoding='utf8') as f:
    f.write(code)

