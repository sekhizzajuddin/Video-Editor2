import re

with open('src/mobile/components/MobilePropertiesSheet.tsx', 'r', encoding='utf8') as f:
    code = f.read()

# IMPORTS
imports = """
import { PositionSection } from '@/components/properties/tabs/transform/PositionSection';
import { ScaleSection } from '@/components/properties/tabs/transform/ScaleSection';
import { RotationSection } from '@/components/properties/tabs/transform/RotationSection';
import { OpacitySection } from '@/components/properties/tabs/transform/OpacitySection';
import { TemperatureSection, ExposureSection, ContrastSection, SaturationSection, BlurSection, VignetteSection } from '@/components/properties/tabs/color';
import { VolumeSection, PanSection } from '@/components/properties/tabs/audio';
import { getAnimatedValue } from '@/utils/keyframes';
"""

if 'PositionSection' not in code:
    code = code.replace("import { SmartReframeSection }", imports + "\nimport { SmartReframeSection }")

# LOGIC ADDITION
logic = """
  const absoluteStartTime = clip?.startTime ?? 0;
  const animations = clip?.animations || {};
  const localTime = currentTime - absoluteStartTime;

  const getPropVal = (base: number, propKey: string) => {
    return getAnimatedValue(base, currentTime, absoluteStartTime, animations[propKey]);
  };

  const setPropVal = (propKey: string, value: number, baseUpdateObj: any) => {
    updateClip(clip!.id, baseUpdateObj);
  };
"""

if 'const absoluteStartTime' not in code:
    code = code.replace("const [subTab, setSubTab] = useState<string>('');", "const [subTab, setSubTab] = useState<string>('');\n" + logic)

# RENDER REPLACEMENT
# style -> scale
code = re.sub(
    r"\{category === 'style' && currentSubTab === 'scale' && <Slider.*?\/>\}",
    r"{category === 'style' && currentSubTab === 'scale' && <ScaleSection selectedClip={clip} localTime={localTime} absoluteStartTime={absoluteStartTime} animations={animations} collapsedSections={{}} toggleSection={() => {}} getPropVal={getPropVal} setPropVal={setPropVal} updateClip={updateClip} />}",
    code
)

# style -> position
code = re.sub(
    r"\{category === 'style' && currentSubTab === 'position' && \([\s\S]*?\}\)\s*\}",
    r"{category === 'style' && currentSubTab === 'position' && <PositionSection selectedClip={clip} localTime={localTime} absoluteStartTime={absoluteStartTime} animations={animations} collapsedSections={{}} toggleSection={() => {}} getPropVal={getPropVal} setPropVal={setPropVal} updateClip={updateClip} />}",
    code
)

# style -> rotation
code = re.sub(
    r"\{category === 'style' && currentSubTab === 'rotation' && <Slider.*?\/>\}",
    r"{category === 'style' && currentSubTab === 'rotation' && <RotationSection selectedClip={clip} localTime={localTime} absoluteStartTime={absoluteStartTime} animations={animations} collapsedSections={{}} toggleSection={() => {}} getPropVal={getPropVal} setPropVal={setPropVal} updateClip={updateClip} />}",
    code
)

# style -> opacity
code = re.sub(
    r"\{category === 'style' && currentSubTab === 'opacity' && <Slider.*?\/>\}",
    r"{category === 'style' && currentSubTab === 'opacity' && <OpacitySection selectedClip={clip} localTime={localTime} absoluteStartTime={absoluteStartTime} animations={animations} collapsedSections={{}} toggleSection={() => {}} getPropVal={getPropVal} setPropVal={setPropVal} updateClip={updateClip} />}",
    code
)

# color -> temp
code = re.sub(
    r"\{category === 'color' && currentSubTab === 'temp' && <Slider.*?\/>\}",
    r"{category === 'color' && currentSubTab === 'temp' && <TemperatureSection temperature={getPropVal(clip.colorFilters?.temperature ?? 0, 'color.temperature')} onChange={(v) => setPropVal('color.temperature', v, { colorFilters: { ...(clip.colorFilters || {}), temperature: v } as any })} onReset={() => updateClip(clip.id, { colorFilters: { ...(clip.colorFilters || {}), temperature: 0 } as any })} />}",
    code
)

# color -> exposure
code = re.sub(
    r"\{category === 'color' && currentSubTab === 'exposure' && <Slider.*?\/>\}",
    r"{category === 'color' && currentSubTab === 'exposure' && <ExposureSection exposure={getPropVal(clip.colorFilters?.exposure ?? 0, 'color.exposure')} onChange={(v) => setPropVal('color.exposure', v, { colorFilters: { ...(clip.colorFilters || {}), exposure: v } as any })} onReset={() => updateClip(clip.id, { colorFilters: { ...(clip.colorFilters || {}), exposure: 0 } as any })} />}",
    code
)

# color -> contrast
code = re.sub(
    r"\{category === 'color' && currentSubTab === 'contrast' && <Slider.*?\/>\}",
    r"{category === 'color' && currentSubTab === 'contrast' && <ContrastSection contrast={getPropVal(clip.colorFilters?.contrast ?? 100, 'color.contrast')} onChange={(v) => setPropVal('color.contrast', v, { colorFilters: { ...(clip.colorFilters || {}), contrast: v } as any })} onReset={() => updateClip(clip.id, { colorFilters: { ...(clip.colorFilters || {}), contrast: 100 } as any })} />}",
    code
)

# color -> saturation
code = re.sub(
    r"\{category === 'color' && currentSubTab === 'saturation' && <Slider.*?\/>\}",
    r"{category === 'color' && currentSubTab === 'saturation' && <SaturationSection saturation={getPropVal(clip.colorFilters?.saturation ?? 100, 'color.saturation')} onChange={(v) => setPropVal('color.saturation', v, { colorFilters: { ...(clip.colorFilters || {}), saturation: v } as any })} onReset={() => updateClip(clip.id, { colorFilters: { ...(clip.colorFilters || {}), saturation: 100 } as any })} />}",
    code
)

# color -> blur
code = re.sub(
    r"\{category === 'color' && currentSubTab === 'blur' && <Slider.*?\/>\}",
    r"{category === 'color' && currentSubTab === 'blur' && <BlurSection blur={getPropVal(clip.colorFilters?.blur ?? 0, 'color.blur')} onChange={(v) => setPropVal('color.blur', v, { colorFilters: { ...(clip.colorFilters || {}), blur: v } as any })} onReset={() => updateClip(clip.id, { colorFilters: { ...(clip.colorFilters || {}), blur: 0 } as any })} />}",
    code
)

# color -> vignette
code = re.sub(
    r"\{category === 'color' && currentSubTab === 'vignette' && <Slider.*?\/>\}",
    r"{category === 'color' && currentSubTab === 'vignette' && <VignetteSection vignette={getPropVal(clip.colorFilters?.vignette ?? 0, 'color.vignette')} onChange={(v) => setPropVal('color.vignette', v, { colorFilters: { ...(clip.colorFilters || {}), vignette: v } as any })} onReset={() => updateClip(clip.id, { colorFilters: { ...(clip.colorFilters || {}), vignette: 0 } as any })} />}",
    code
)

# audio -> volume
code = re.sub(
    r"\{category === 'audio' && currentSubTab === 'volume' && <Slider.*?\/>\}",
    r"{category === 'audio' && currentSubTab === 'volume' && <VolumeSection volume={getPropVal(clip.audioSettings?.volume ?? 0, 'audio.volume')} onChange={(v) => setPropVal('audio.volume', v, { audioSettings: { volume: 0, pan: 0, ...(clip.audioSettings || {}), volume: v } as any })} onReset={() => updateClip(clip.id, { audioSettings: { volume: 0, pan: 0, ...(clip.audioSettings || {}), volume: 0 } as any })} />}",
    code
)

with open('src/mobile/components/MobilePropertiesSheet.tsx', 'w', encoding='utf8') as f:
    f.write(code)

