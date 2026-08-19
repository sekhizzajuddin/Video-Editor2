import re

with open('src/mobile/components/MobilePropertiesSheet.tsx', 'r', encoding='utf8') as f:
    code = f.read()

# Replace speed block
old_speed_block = """        {category === 'speed' && currentSubTab === 'speed' && <SpeedSliderSection speed={clip.playbackRate ?? 1} isRamped={!!clip.speedRamp} onSpeedChange={(v) => updateClip(clip.id, { playbackRate: v })} onReset={() => updateClip(clip.id, { playbackRate: 1 })} />}
        {category === 'speed' && currentSubTab === 'presets' && <PresetRampsSection isRamped={!!clip.speedRamp} onSpeedChange={(v) => updateClip(clip.id, { playbackRate: v })} />}"""

new_speed_block = """        {category === 'speed' && currentSubTab === 'speed' && <SpeedSliderSection speed={clip.speed ?? 1} isRamped={!!clip.speedRamp} onSpeedChange={(v) => { const sourceDuration = clip.duration * (clip.speed ?? 1); updateClip(clip.id, { speed: v, duration: sourceDuration / v }, { ripple: true }); }} onReset={() => { const sourceDuration = clip.duration * (clip.speed ?? 1); updateClip(clip.id, { speed: 1, duration: sourceDuration }, { ripple: true }); }} />}
        {category === 'speed' && currentSubTab === 'presets' && <PresetRampsSection isRamped={!!clip.speedRamp} onSpeedChange={(v) => { const sourceDuration = clip.duration * (clip.speed ?? 1); updateClip(clip.id, { speed: v, duration: sourceDuration / v }, { ripple: true }); }} />}"""

code = code.replace(old_speed_block, new_speed_block)

with open('src/mobile/components/MobilePropertiesSheet.tsx', 'w', encoding='utf8') as f:
    f.write(code)

