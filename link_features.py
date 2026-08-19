import re
with open('src/mobile/components/MobilePropertiesSheet.tsx', 'r', encoding='utf8') as f:
    code = f.read()

# ADD IMPORTS
imports = """
import { CurvesEditor } from '@/components/properties/tabs/color/CurvesEditor';
import { ColorGradeTransferSection } from '@/components/properties/tabs/color/ColorGradeTransferSection';
import { EQSection } from '@/components/properties/tabs/audio/EQSection';
import { MotionEffectsPanel } from '@/components/properties/tabs/effects/MotionEffectsPanel';
"""
if 'CurvesEditor' not in code:
    code = code.replace("import { SpeedRampingSection }", imports + "\nimport { SpeedRampingSection }")

# UPDATE SUBTABSMAP
sub_tabs = code[code.find("const subTabsMap: Record<string, { id: string; label: string }[]> = {"):code.find("};", code.find("const subTabsMap:")) + 2]
new_sub_tabs = sub_tabs
if "{ id: 'curves', label: 'Curves' }" not in new_sub_tabs:
    new_sub_tabs = new_sub_tabs.replace("{ id: 'vignette', label: 'Vignette' },", "{ id: 'vignette', label: 'Vignette' },\n      { id: 'curves', label: 'Curves' },\n      { id: 'transfer', label: 'Color Transfer' },")
    new_sub_tabs = new_sub_tabs.replace("{ id: 'pitch', label: 'Pitch' },", "{ id: 'pitch', label: 'Pitch' },\n      { id: 'eq', label: 'EQ' },")
    new_sub_tabs = new_sub_tabs.replace("{ id: 'object_removal', label: 'Object Removal' },", "{ id: 'object_removal', label: 'Object Removal' },\n      { id: 'motion', label: 'Motion Effects' },")
    code = code.replace(sub_tabs, new_sub_tabs)

# ADD JSX BLOCKS
if 'CurvesEditor curves=' not in code:
    # Color curves
    curves_jsx = r"{category === 'color' && currentSubTab === 'curves' && <CurvesEditor curves={clip.colorFilters?.curves || {}} onChange={(curves) => updateClip(clip.id, { colorFilters: { ...(clip.colorFilters || {}), curves } as any })} />}"
    code = code.replace("{category === 'color' && currentSubTab === 'vignette' && (", curves_jsx + "\n\n        {category === 'color' && currentSubTab === 'vignette' && (")
    
    # Color transfer
    transfer_jsx = r"{category === 'color' && currentSubTab === 'transfer' && <ColorGradeTransferSection selectedClip={clip} />}"
    code = code.replace("{category === 'color' && currentSubTab === 'vignette' && (", transfer_jsx + "\n\n        {category === 'color' && currentSubTab === 'vignette' && (")

    # Audio EQ
    eq_jsx = r"{category === 'audio' && currentSubTab === 'eq' && <EQSection bass={clip.audioSettings?.bass || 0} mid={clip.audioSettings?.mid || 0} treble={clip.audioSettings?.treble || 0} onBassChange={(val) => updateClip(clip.id, { audioSettings: { ...(clip.audioSettings || {}), bass: val } as any })} onMidChange={(val) => updateClip(clip.id, { audioSettings: { ...(clip.audioSettings || {}), mid: val } as any })} onTrebleChange={(val) => updateClip(clip.id, { audioSettings: { ...(clip.audioSettings || {}), treble: val } as any })} />}"
    code = code.replace("{category === 'audio' && currentSubTab === 'options' && (", eq_jsx + "\n\n        {category === 'audio' && currentSubTab === 'options' && (")

    # Motion Effects
    motion_jsx = r"{category === 'ai' && currentSubTab === 'motion' && <MotionEffectsPanel selectedClip={clip} />}"
    code = code.replace("{category === 'ai' && clip.fxSettings && (", motion_jsx + "\n\n        {category === 'ai' && clip.fxSettings && (")

with open('src/mobile/components/MobilePropertiesSheet.tsx', 'w', encoding='utf8') as f:
    f.write(code)
