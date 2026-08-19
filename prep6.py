import re

with open('src/mobile/components/MobilePropertiesSheet.tsx', 'r', encoding='utf8') as f:
    code = f.read()

def replace_block(pattern, replacement):
    global code
    if not re.search(pattern, code):
        print(f"FAILED TO MATCH: {pattern[:50]}")
    code = re.sub(pattern, replacement, code, count=1)

# AutoVoiceTuneSection
replace_block(
    r"\{category === 'audio' && currentSubTab === 'voicetune' && <AutoVoiceTuneSection .*?/>\}",
    r"{category === 'audio' && currentSubTab === 'voicetune' && <AutoVoiceTuneSection selectedClipIds={[clip.id]} isAnalyzingVoice={false} handleAutoVoiceTune={() => {}} />}"
)

# AISoundDesignerSection
replace_block(
    r"\{category === 'audio' && currentSubTab === 'sounddesign' && <AISoundDesignerSection .*?/>\}",
    r"{category === 'audio' && currentSubTab === 'sounddesign' && <AISoundDesignerSection isAnalyzingAudio={false} audioAnalyzeProgress=\"\" aiProvider=\"gemini\" setAiProvider={() => {}} soundDesignFps={30} setSoundDesignFps={() => {}} freesoundApiKey=\"\" setFreesoundApiKey={() => {}} handleAiSoundDesign={() => {}} />}"
)

# SpeedSliderSection
replace_block(
    r"\{category === 'speed' && currentSubTab === 'speed' && <SpeedSliderSection .*?/>\}",
    r"{category === 'speed' && currentSubTab === 'speed' && <SpeedSliderSection speed={clip.playbackRate ?? 1} isRamped={!!clip.speedRamp} onSpeedChange={(v) => updateClip(clip.id, { playbackRate: v })} onReset={() => updateClip(clip.id, { playbackRate: 1 })} />}"
)

# PresetRampsSection
replace_block(
    r"\{category === 'speed' && currentSubTab === 'presets' && <PresetRampsSection .*?/>\}",
    r"{category === 'speed' && currentSubTab === 'presets' && <PresetRampsSection isRamped={!!clip.speedRamp} onSpeedChange={(v) => updateClip(clip.id, { playbackRate: v })} />}"
)

# SpeedRampingSection
replace_block(
    r"\{category === 'speed' && currentSubTab === 'ramping' && <SpeedRampingSection .*?/>\}",
    r"{category === 'speed' && currentSubTab === 'ramping' && <SpeedRampingSection selectedClip={clip} isRamped={!!clip.speedRamp} mediaLibrary={mediaLibrary as any} updateClip={updateClip} />}"
)

# Mask
replace_block(
    r"\{category === 'mask' && currentSubTab === 'mask' && \(\s*<div className=\"space-y-4\">\s*<MaskEnableSection .*?/>\s*\{clip\.mask\?\.enabled && \(\s*<>\s*<MaskTypeSection .*?/>\s*<MaskInvertSection .*?/>\s*<MaskParametersSection .*?/>\s*</>\s*\)\}\s*</div>\s*\)\}",
    r"""{category === 'mask' && currentSubTab === 'mask' && (
          <div className="space-y-4">
             <MaskEnableSection enabled={clip.mask?.enabled ?? false} onToggle={() => updateClip(clip.id, { mask: { ...clip.mask!, enabled: !(clip.mask?.enabled ?? false) } })} />
             {clip.mask?.enabled && (
               <>
                 <MaskTypeSection maskType={clip.mask.type ?? 'rectangle'} onChange={(v) => updateClip(clip.id, { mask: { ...clip.mask!, type: v as any } })} />
                 <MaskInvertSection invert={clip.mask.invert ?? false} onToggle={() => updateClip(clip.id, { mask: { ...clip.mask!, invert: !(clip.mask?.invert ?? false) } })} />
                 <MaskParametersSection mask={clip.mask} onChange={(prop, val) => updateClip(clip.id, { mask: { ...clip.mask!, [prop]: val } })} />
               </>
             )}
          </div>
        )}"""
)

# TextContentSection
replace_block(
    r"\{category === 'text' && isText && currentSubTab === 'content' && <TextContentSection .*?/>\}",
    r"{category === 'text' && isText && currentSubTab === 'content' && <TextContentSection text={clip.textSettings?.text ?? ''} onChange={(v) => updateClip(clip.id, { textSettings: { ...clip.textSettings!, text: v } })} />}"
)

# Font Sections
replace_block(
    r"\{category === 'text' && isText && currentSubTab === 'font' && \(\s*<div className=\"space-y-4\">\s*<FontFamilySection .*?/>\s*<FontSizeSection .*?/>\s*</div>\s*\)\}",
    r"""{category === 'text' && isText && currentSubTab === 'font' && (
          <div className="space-y-4">
             <FontFamilySection fontFamily={clip.textSettings?.fontFamily ?? 'Inter'} onChange={(v) => updateClip(clip.id, { textSettings: { ...clip.textSettings!, fontFamily: v } })} />
             <FontSizeSection fontSize={clip.textSettings?.fontSize ?? 40} onChange={(v) => updateClip(clip.id, { textSettings: { ...clip.textSettings!, fontSize: v } })} />
          </div>
        )}"""
)

# Style Sections
replace_block(
    r"\{category === 'text' && isText && currentSubTab === 'style' && \(\s*<div className=\"space-y-4\">\s*<TextColorSection .*?/>\s*<TextStyleButtonsSection .*?/>\s*<TextStylePresetsSection .*?/>\s*</div>\s*\)\}",
    r"""{category === 'text' && isText && currentSubTab === 'style' && (
          <div className="space-y-4">
             <TextColorSection color={clip.textSettings?.color ?? '#ffffff'} onChange={(v) => updateClip(clip.id, { textSettings: { ...clip.textSettings!, color: v } })} />
             <TextStyleButtonsSection bold={clip.textSettings?.bold ?? false} italic={clip.textSettings?.italic ?? false} underline={clip.textSettings?.underline ?? false} onBoldToggle={() => updateClip(clip.id, { textSettings: { ...clip.textSettings!, bold: !(clip.textSettings?.bold ?? false) } })} onItalicToggle={() => updateClip(clip.id, { textSettings: { ...clip.textSettings!, italic: !(clip.textSettings?.italic ?? false) } })} onUnderlineToggle={() => updateClip(clip.id, { textSettings: { ...clip.textSettings!, underline: !(clip.textSettings?.underline ?? false) } })} />
             <TextStylePresetsSection textSettings={clip.textSettings} clipId={clip.id} updateClip={updateClip} />
          </div>
        )}"""
)

# TextShadowSection
replace_block(
    r"\{category === 'text' && isText && currentSubTab === 'shadow' && <TextShadowSection .*?/>\}",
    r"{category === 'text' && isText && currentSubTab === 'shadow' && <TextShadowSection shadow={clip.textSettings?.shadow ?? false} onToggle={() => updateClip(clip.id, { textSettings: { ...clip.textSettings!, shadow: !(clip.textSettings?.shadow ?? false) } })} />}"
)

# Fix duplicate getAnimatedValue imports
code = re.sub(r"import\s*\{\s*getAnimatedValue\s*\}\s*from\s*'@/utils/keyframes';\n", "", code)
code = "import { getAnimatedValue } from '@/utils/keyframes';\n" + code

with open('src/mobile/components/MobilePropertiesSheet.tsx', 'w', encoding='utf8') as f:
    f.write(code)

