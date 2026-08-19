import re

with open('src/mobile/components/MobilePropertiesSheet.tsx', 'r', encoding='utf8') as f:
    code = f.read()

# 1. Grab everything up to the render block start
start_marker = r'<div className="mobile-no-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-3 space-y-4">'
end_marker = r'</div>\s*</div>\s*\);\s*\}'
match = re.search(f'({start_marker})(.*?)(?={end_marker})', code, flags=re.DOTALL)
if match:
    existing_render = match.group(2)
    eraser_block = re.search(r"\{category === 'ai' && currentSubTab === 'eraser'.*?^\s*\}\)", existing_render, flags=re.DOTALL | re.MULTILINE)
    fx_block = re.search(r"\{category === 'ai' && clip.fxSettings.*?^\s*\}\)", existing_render, flags=re.DOTALL | re.MULTILINE)
    blend_block = re.search(r"\{category === 'style' && currentSubTab === 'blend'.*?^\s*\}\)", existing_render, flags=re.DOTALL | re.MULTILINE)
    
    eraser = eraser_block.group(0) if eraser_block else ""
    fx = fx_block.group(0) if fx_block else ""
    blend = blend_block.group(0) if blend_block else ""

    new_render = f"""
        {{category === 'ai' && currentSubTab === 'kinetic' && <KineticTypographySection selectedClip={{clip}} />}}
        {{category === 'ai' && currentSubTab === 'beatsync' && <BeatSyncSection selectedClip={{clip}} />}}
        {{category === 'ai' && currentSubTab === 'sfx' && <AISFXSection selectedClip={{clip}} />}}
        {eraser}
        {{category === 'ai' && currentSubTab === 'object_removal' && <ObjectRemovalPanel selectedClip={{clip}} />}}
        {fx}

        {{category === 'style' && currentSubTab === 'scale' && <ScaleSection selectedClip={{clip}} localTime={{localTime}} absoluteStartTime={{absoluteStartTime}} animations={{animations}} collapsedSections={{{{\}}}} toggleSection={{() => {{}}}} getPropVal={{getPropVal}} setPropVal={{setPropVal}} updateClip={{updateClip}} />}}
        {{category === 'style' && currentSubTab === 'position' && <PositionSection selectedClip={{clip}} localTime={{localTime}} absoluteStartTime={{absoluteStartTime}} animations={{animations}} collapsedSections={{{{\}}}} toggleSection={{() => {{}}}} getPropVal={{getPropVal}} setPropVal={{setPropVal}} updateClip={{updateClip}} />}}
        {{category === 'style' && currentSubTab === 'rotation' && <RotationSection selectedClip={{clip}} localTime={{localTime}} absoluteStartTime={{absoluteStartTime}} animations={{animations}} collapsedSections={{{{\}}}} toggleSection={{() => {{}}}} getPropVal={{getPropVal}} setPropVal={{setPropVal}} updateClip={{updateClip}} />}}
        {{category === 'style' && currentSubTab === 'opacity' && <OpacitySection selectedClip={{clip}} localTime={{localTime}} absoluteStartTime={{absoluteStartTime}} animations={{animations}} collapsedSections={{{{\}}}} toggleSection={{() => {{}}}} getPropVal={{getPropVal}} setPropVal={{setPropVal}} updateClip={{updateClip}} />}}
        {{category === 'style' && currentSubTab === 'reframe' && <SmartReframeSection selectedClip={{clip}} updateClip={{updateClip}} />}}
        {blend}

        {{category === 'color' && currentSubTab === 'temp' && <TemperatureSection temperature={{getPropVal(clip.colorFilters?.temperature ?? 0, 'color.temperature')}} onChange={{(v) => setPropVal('color.temperature', v, {{ colorFilters: {{ ...(clip.colorFilters || {{}}), temperature: v }} as any }})}} onReset={{() => updateClip(clip.id, {{ colorFilters: {{ ...(clip.colorFilters || {{}}), temperature: 0 }} as any }})}} />}}
        {{category === 'color' && currentSubTab === 'tint' && <TintSection tint={{getPropVal(clip.colorFilters?.tint ?? 0, 'color.tint')}} onChange={{(v) => setPropVal('color.tint', v, {{ colorFilters: {{ ...(clip.colorFilters || {{}}), tint: v }} as any }})}} onReset={{() => updateClip(clip.id, {{ colorFilters: {{ ...(clip.colorFilters || {{}}), tint: 0 }} as any }})}} />}}
        {{category === 'color' && currentSubTab === 'exposure' && <ExposureSection exposure={{getPropVal(clip.colorFilters?.exposure ?? 0, 'color.exposure')}} onChange={{(v) => setPropVal('color.exposure', v, {{ colorFilters: {{ ...(clip.colorFilters || {{}}), exposure: v }} as any }})}} onReset={{() => updateClip(clip.id, {{ colorFilters: {{ ...(clip.colorFilters || {{}}), exposure: 0 }} as any }})}} />}}
        {{category === 'color' && currentSubTab === 'contrast' && <ContrastSection contrast={{getPropVal(clip.colorFilters?.contrast ?? 100, 'color.contrast')}} onChange={{(v) => setPropVal('color.contrast', v, {{ colorFilters: {{ ...(clip.colorFilters || {{}}), contrast: v }} as any }})}} onReset={{() => updateClip(clip.id, {{ colorFilters: {{ ...(clip.colorFilters || {{}}), contrast: 100 }} as any }})}} />}}
        {{category === 'color' && currentSubTab === 'saturation' && <SaturationSection saturation={{getPropVal(clip.colorFilters?.saturation ?? 100, 'color.saturation')}} onChange={{(v) => setPropVal('color.saturation', v, {{ colorFilters: {{ ...(clip.colorFilters || {{}}), saturation: v }} as any }})}} onReset={{() => updateClip(clip.id, {{ colorFilters: {{ ...(clip.colorFilters || {{}}), saturation: 100 }} as any }})}} />}}
        {{category === 'color' && currentSubTab === 'blur' && <BlurSection blur={{getPropVal(clip.colorFilters?.blur ?? 0, 'color.blur')}} onChange={{(v) => setPropVal('color.blur', v, {{ colorFilters: {{ ...(clip.colorFilters || {{}}), blur: v }} as any }})}} onReset={{() => updateClip(clip.id, {{ colorFilters: {{ ...(clip.colorFilters || {{}}), blur: 0 }} as any }})}} />}}
        {{category === 'color' && currentSubTab === 'faded' && <FadedFilmSection fadedFilm={{getPropVal(clip.colorFilters?.fadedFilm ?? 0, 'color.fadedFilm')}} onChange={{(v) => setPropVal('color.fadedFilm', v, {{ colorFilters: {{ ...(clip.colorFilters || {{}}), fadedFilm: v }} as any }})}} onReset={{() => updateClip(clip.id, {{ colorFilters: {{ ...(clip.colorFilters || {{}}), fadedFilm: 0 }} as any }})}} />}}
        {{category === 'color' && currentSubTab === 'vignette' && <VignetteSection vignette={{getPropVal(clip.colorFilters?.vignette ?? 0, 'color.vignette')}} onChange={{(v) => setPropVal('color.vignette', v, {{ colorFilters: {{ ...(clip.colorFilters || {{}}), vignette: v }} as any }})}} onReset={{() => updateClip(clip.id, {{ colorFilters: {{ ...(clip.colorFilters || {{}}), vignette: 0 }} as any }})}} />}}
        {{category === 'color' && currentSubTab === 'curves' && <CurvesEditor curves={{clip.colorFilters?.curves || {{}}}} onChange={{(curves) => updateClip(clip.id, {{ colorFilters: {{ ...(clip.colorFilters || {{}}), curves }} as any }})}} />}}
        {{category === 'color' && currentSubTab === 'transfer' && <ColorGradeTransferSection selectedClip={{clip}} selectedClipIds={{[clip.id]}} />}}

        {{category === 'audio' && currentSubTab === 'volume' && <VolumeSection volume={{getPropVal(clip.audioSettings?.volume ?? 0, 'audio.volume')}} onChange={{(v) => setPropVal('audio.volume', v, {{ audioSettings: {{ pan: 0, ...(clip.audioSettings || {{}}), volume: v }} as any }})}} onReset={{() => updateClip(clip.id, {{ audioSettings: {{ pan: 0, ...(clip.audioSettings || {{}}), volume: 0 }} as any }})}} />}}
        {{category === 'audio' && currentSubTab === 'pan' && <PanSection pan={{getPropVal(clip.audioSettings?.pan ?? 0, 'audio.pan')}} onChange={{(v) => setPropVal('audio.pan', v, {{ audioSettings: {{ volume: 0, ...(clip.audioSettings || {{}}), pan: v }} as any }})}} onReset={{() => updateClip(clip.id, {{ audioSettings: {{ volume: 0, ...(clip.audioSettings || {{}}), pan: 0 }} as any }})}} />}}
        {{category === 'audio' && currentSubTab === 'ducking' && <AutoDuckingSection selectedClip={{clip}} handleAudioChange={{(key, val) => updateClip(clip.id, {{ audioSettings: {{ ...(clip.audioSettings || {{}}), [key]: val }} as any }})}} />}}
        {{category === 'audio' && currentSubTab === 'eq' && <EQSection bass={{clip.audioSettings?.bass || 0}} mid={{clip.audioSettings?.mid || 0}} treble={{clip.audioSettings?.treble || 0}} onBassChange={{(val) => updateClip(clip.id, {{ audioSettings: {{ ...(clip.audioSettings || {{}}), bass: val }} as any }})}} onMidChange={{(val) => updateClip(clip.id, {{ audioSettings: {{ ...(clip.audioSettings || {{}}), mid: val }} as any }})}} onTrebleChange={{(val) => updateClip(clip.id, {{ audioSettings: {{ ...(clip.audioSettings || {{}}), treble: val }} as any }})}} />}}
        {{category === 'audio' && currentSubTab === 'voicetune' && <AutoVoiceTuneSection selectedClip={{clip}} isAnalyzingVoice={{false}} handleAutoVoiceTune={{() => {{}}}} handleAudioChange={{(key, val) => updateClip(clip.id, {{ audioSettings: {{ ...(clip.audioSettings || {{}}), [key]: val }} as any }})}} handleAudioReset={{(key) => updateClip(clip.id, {{ audioSettings: {{ ...(clip.audioSettings || {{}}), [key]: undefined }} as any }})}} />}}
        {{category === 'audio' && currentSubTab === 'sounddesign' && <AISoundDesignerSection selectedClip={{clip}} aiProvider="gemini" setAiProvider={{() => {{}}}} soundDesignFps={{30}} setSoundDesignFps={{() => {{}}}} handleAiSoundDesign={{() => {{}}}} isAnalyzingAudio={{false}} audioAnalyzeProgress="" freesoundApiKey="" setFreesoundApiKey={{() => {{}}}} handleAudioChange={{(key, val) => updateClip(clip.id, {{ audioSettings: {{ ...(clip.audioSettings || {{}}), [key]: val }} as any }})}} handleAudioReset={{(key) => updateClip(clip.id, {{ audioSettings: {{ ...(clip.audioSettings || {{}}), [key]: undefined }} as any }})}} />}}

        {{category === 'speed' && currentSubTab === 'speed' && <SpeedSliderSection selectedClip={{clip}} />}}
        {{category === 'speed' && currentSubTab === 'presets' && <PresetRampsSection selectedClip={{clip}} />}}
        {{category === 'speed' && currentSubTab === 'ramping' && <SpeedRampingSection selectedClip={{clip}} />}}

        {{category === 'mask' && currentSubTab === 'mask' && (
          <div className="space-y-4">
             <MaskEnableSection selectedClip={{clip}} />
             {{clip.mask?.enabled && (
               <>
                 <MaskTypeSection selectedClip={{clip}} />
                 <MaskInvertSection selectedClip={{clip}} />
                 <MaskParametersSection selectedClip={{clip}} />
               </>
             )}}
          </div>
        )}}
        {{category === 'mask' && currentSubTab === 'chroma' && <ChromaKeySection selectedClip={{clip}} />}}

        {{category === 'text' && isText && currentSubTab === 'content' && <TextContentSection selectedClip={{clip}} updateClip={{updateClip}} />}}
        {{category === 'text' && isText && currentSubTab === 'font' && (
          <div className="space-y-4">
             <FontFamilySection selectedClip={{clip}} updateClip={{updateClip}} />
             <FontSizeSection selectedClip={{clip}} updateClip={{updateClip}} />
          </div>
        )}}
        {{category === 'text' && isText && currentSubTab === 'style' && (
          <div className="space-y-4">
             <TextColorSection selectedClip={{clip}} updateClip={{updateClip}} />
             <TextStyleButtonsSection selectedClip={{clip}} updateClip={{updateClip}} />
             <TextStylePresetsSection selectedClip={{clip}} updateClip={{updateClip}} />
          </div>
        )}}
        {{category === 'text' && isText && currentSubTab === 'shadow' && <TextShadowSection selectedClip={{clip}} updateClip={{updateClip}} />}}
"""
    code = code[:match.start(2)] + "\n" + new_render + "\n      " + code[match.end(2):]

with open('src/mobile/components/MobilePropertiesSheet.tsx', 'w', encoding='utf8') as f:
    f.write(code)

