import re

with open('src/mobile/components/MobilePropertiesSheet.tsx', 'r', encoding='utf8') as f:
    code = f.read()

start_marker = r"\{\{category === 'audio' && currentSubTab === 'voicetune'.*?^\s*\}\}"
end_marker = r"\{\{category === 'text' && isText && currentSubTab === 'shadow'.*?\}\}"
match = re.search(f'({start_marker})(.*?)({end_marker})', code, flags=re.DOTALL | re.MULTILINE)

if match:
    new_code = """
        {{category === 'audio' && currentSubTab === 'voicetune' && <AutoVoiceTuneSection selectedClipIds={{[clip.id]}} isAnalyzingVoice={{false}} handleAutoVoiceTune={{() => {{}}}} />}}
        {{category === 'audio' && currentSubTab === 'sounddesign' && <AISoundDesignerSection isAnalyzingAudio={{false}} audioAnalyzeProgress="" aiProvider="gemini" setAiProvider={{() => {{}}}} soundDesignFps={{30}} setSoundDesignFps={{() => {{}}}} freesoundApiKey="" setFreesoundApiKey={{() => {{}}}} handleAiSoundDesign={{() => {{}}}} />}}

        {{category === 'speed' && currentSubTab === 'speed' && <SpeedSliderSection speed={{clip.playbackRate ?? 1}} isRamped={{!!clip.speedRamp}} onSpeedChange={{(v) => updateClip(clip.id, {{ playbackRate: v }})}} onReset={{() => updateClip(clip.id, {{ playbackRate: 1 }})}} />}}
        {{category === 'speed' && currentSubTab === 'presets' && <PresetRampsSection isRamped={{!!clip.speedRamp}} onSpeedChange={{(v) => updateClip(clip.id, {{ playbackRate: v }})}} />}}
        {{category === 'speed' && currentSubTab === 'ramping' && <SpeedRampingSection selectedClip={{clip}} isRamped={{!!clip.speedRamp}} mediaLibrary={{mediaLibrary as any}} updateClip={{updateClip}} />}}

        {{category === 'mask' && currentSubTab === 'mask' && (
          <div className="space-y-4">
             <MaskEnableSection enabled={{clip.mask?.enabled ?? false}} onToggle={{() => updateClip(clip.id, {{ mask: {{ ...clip.mask!, enabled: !(clip.mask?.enabled ?? false) }} }})}} />
             {{clip.mask?.enabled && (
               <>
                 <MaskTypeSection maskType={{clip.mask.type ?? 'rectangle'}} onChange={{(v) => updateClip(clip.id, {{ mask: {{ ...clip.mask!, type: v as any }} }})}} />
                 <MaskInvertSection invert={{clip.mask.invert ?? false}} onToggle={{() => updateClip(clip.id, {{ mask: {{ ...clip.mask!, invert: !(clip.mask?.invert ?? false) }} }})}} />
                 <MaskParametersSection mask={{clip.mask}} onChange={{(prop, val) => updateClip(clip.id, {{ mask: {{ ...clip.mask!, [prop]: val }} }})}} />
               </>
             )}}
          </div>
        )}}
        {{category === 'mask' && currentSubTab === 'chroma' && <ChromaKeySection selectedClip={{clip}} />}}

        {{category === 'text' && isText && currentSubTab === 'content' && <TextContentSection text={{clip.textSettings?.text ?? ''}} onChange={{(v) => updateClip(clip.id, {{ textSettings: {{ ...clip.textSettings!, text: v }} }})}} />}}
        {{category === 'text' && isText && currentSubTab === 'font' && (
          <div className="space-y-4">
             <FontFamilySection fontFamily={{clip.textSettings?.fontFamily ?? 'Inter'}} onChange={{(v) => updateClip(clip.id, {{ textSettings: {{ ...clip.textSettings!, fontFamily: v }} }})}} />
             <FontSizeSection fontSize={{clip.textSettings?.fontSize ?? 40}} onChange={{(v) => updateClip(clip.id, {{ textSettings: {{ ...clip.textSettings!, fontSize: v }} }})}} />
          </div>
        )}}
        {{category === 'text' && isText && currentSubTab === 'style' && (
          <div className="space-y-4">
             <TextColorSection color={{clip.textSettings?.color ?? '#ffffff'}} onChange={{(v) => updateClip(clip.id, {{ textSettings: {{ ...clip.textSettings!, color: v }} }})}} />
             <TextStyleButtonsSection bold={{clip.textSettings?.bold ?? false}} italic={{clip.textSettings?.italic ?? false}} underline={{clip.textSettings?.underline ?? false}} onBoldToggle={{() => updateClip(clip.id, {{ textSettings: {{ ...clip.textSettings!, bold: !(clip.textSettings?.bold ?? false) }} }})}} onItalicToggle={{() => updateClip(clip.id, {{ textSettings: {{ ...clip.textSettings!, italic: !(clip.textSettings?.italic ?? false) }} }})}} onUnderlineToggle={{() => updateClip(clip.id, {{ textSettings: {{ ...clip.textSettings!, underline: !(clip.textSettings?.underline ?? false) }} }})}} />
             <TextStylePresetsSection textSettings={{clip.textSettings}} clipId={{clip.id}} updateClip={{updateClip}} />
          </div>
        )}}
        {{category === 'text' && isText && currentSubTab === 'shadow' && <TextShadowSection shadow={{clip.textSettings?.shadow ?? false}} onToggle={{() => updateClip(clip.id, {{ textSettings: {{ ...clip.textSettings!, shadow: !(clip.textSettings?.shadow ?? false) }} }})}} />}}
"""
    code = code[:match.start()] + new_code.strip() + code[match.end():]

with open('src/mobile/components/MobilePropertiesSheet.tsx', 'w', encoding='utf8') as f:
    f.write(code)

