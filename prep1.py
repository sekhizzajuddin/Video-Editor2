import re

with open('src/mobile/components/MobilePropertiesSheet.tsx', 'r', encoding='utf8') as f:
    code = f.read()

# Replace all imports for properties/tabs
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

# First, strip existing manual imports we added before to avoid duplicates
code = re.sub(r"import \{.*?\} from '@/components/properties/tabs/.*?';\n", "", code)
# Now add all the new ones right after lucide-react
code = code.replace("import { SlidersHorizontal", new_imports + "\nimport { SlidersHorizontal")

# Replace subTabsMap
old_subTabsMap = code[code.find("const subTabsMap: Record<string, { id: string; label: string }[]> = {"):code.find("};", code.find("const subTabsMap:")) + 2]
new_subTabsMap = """const subTabsMap: Record<string, { id: string; label: string }[]> = {
    style: [
      { id: 'scale', label: 'Scale' },
      { id: 'position', label: 'Position' },
      { id: 'rotation', label: 'Rotation' },
      { id: 'opacity', label: 'Opacity' },
      { id: 'blend', label: 'Blend' },
      { id: 'reframe', label: 'Smart Reframe' },
    ],
    color: [
      { id: 'temp', label: 'Temp' },
      { id: 'tint', label: 'Tint' },
      { id: 'exposure', label: 'Exposure' },
      { id: 'contrast', label: 'Contrast' },
      { id: 'saturation', label: 'Saturation' },
      { id: 'blur', label: 'Blur' },
      { id: 'faded', label: 'Faded Film' },
      { id: 'vignette', label: 'Vignette' },
      { id: 'curves', label: 'Curves' },
      { id: 'transfer', label: 'Color Transfer' },
    ],
    audio: [
      { id: 'volume', label: 'Volume' },
      { id: 'pan', label: 'Pan' },
      { id: 'ducking', label: 'Ducking' },
      { id: 'eq', label: 'EQ' },
      { id: 'voicetune', label: 'Voice Tune' },
      { id: 'sounddesign', label: 'Sound Design' },
    ],
    speed: [
      { id: 'speed', label: 'Speed' },
      { id: 'presets', label: 'Presets' },
      { id: 'ramping', label: 'Speed Ramp' },
    ],
    mask: [
      { id: 'mask', label: 'Mask' },
      { id: 'chroma', label: 'Chroma Key' },
    ],
    text: [
      { id: 'content', label: 'Text' },
      { id: 'font', label: 'Font' },
      { id: 'style', label: 'Style' },
      { id: 'shadow', label: 'Shadow' },
    ],
    ai: [
      { id: 'kinetic', label: 'Kinetic' },
      { id: 'beatsync', label: 'Beat Sync' },
      { id: 'sfx', label: 'SFX' },
      { id: 'eraser', label: 'Magic Eraser' },
      { id: 'object_removal', label: 'Object Removal' },
    ],
  };"""
code = code.replace(old_subTabsMap, new_subTabsMap)

with open('src/mobile/components/MobilePropertiesSheet.tsx', 'w', encoding='utf8') as f:
    f.write(code)

