import re
with open('src/mobile/components/MobilePropertiesSheet.tsx', 'r', encoding='utf8') as f:
    code = f.read()

# ADD REFRAME
style_reframe = r"{category === 'style' && currentSubTab === 'reframe' && <SmartReframeSection selectedClip={clip} updateClip={updateClip} />}"
code = code.replace("{category === 'style' && currentSubTab === 'blend' && (", style_reframe + "\n        {category === 'style' && currentSubTab === 'blend' && (")

# ADD DUCKING
audio_ducking = r"{category === 'audio' && currentSubTab === 'ducking' && <AutoDuckingSection selectedClip={clip} handleAudioChange={(key, val) => updateClip(clip.id, { audioSettings: { ...(clip.audioSettings || {}), [key]: val } })} />}"
code = code.replace("{category === 'audio' && currentSubTab === 'fade' && (", audio_ducking + "\n        {category === 'audio' && currentSubTab === 'fade' && (")

# ADD SPEED RAMPING
speed_ramping = r"{category === 'speed' && currentSubTab === 'ramping' && <SpeedRampingSection selectedClip={clip} isRamped={!!clip.speedRamp} mediaLibrary={mediaLibrary} updateClip={updateClip} />}"
code = code.replace("{category === 'mask' && currentSubTab === 'mask' && (", speed_ramping + "\n\n        {category === 'mask' && currentSubTab === 'mask' && (")

# ADD CHROMA KEY
mask_chroma = r"{category === 'mask' && currentSubTab === 'chroma' && <ChromaKeySection selectedClip={clip} />}"
code = code.replace("{category === 'mask' && currentSubTab === 'feather' && clip.mask?.enabled && (", mask_chroma + "\n        {category === 'mask' && currentSubTab === 'feather' && clip.mask?.enabled && (")

# ADD OBJECT REMOVAL
ai_obj_removal = r"{category === 'ai' && currentSubTab === 'object_removal' && <ObjectRemovalPanel selectedClip={clip} />}"
code = code.replace("{category === 'ai' && clip.fxSettings && (", ai_obj_removal + "\n\n        {category === 'ai' && clip.fxSettings && (")

with open('src/mobile/components/MobilePropertiesSheet.tsx', 'w', encoding='utf8') as f:
    f.write(code)
