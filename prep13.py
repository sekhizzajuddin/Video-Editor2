import re
with open('src/mobile/components/MobilePropertiesSheet.tsx', 'r', encoding='utf8') as f:
    mobile_code = f.read()

bad_line = r"\s*onReset=\{\(\) => updateClip\(clip.id, \{ colorFilters: \{ \.\.\.\(clip\.colorFilters \|\| \{\}\), temperature: 0 \} as any \}\)\} \/\>\}"
good_line = """
        {category === 'color' && currentSubTab === 'temp' && <TemperatureSection temperature={getPropVal(clip.colorFilters?.temperature ?? 0, 'color.temperature')} onChange={(v) => setPropVal('color.temperature', v, { colorFilters: { ...(clip.colorFilters || {}), temperature: v } as any })} onReset={() => updateClip(clip.id, { colorFilters: { ...(clip.colorFilters || {}), temperature: 0 } as any })} />}
"""
mobile_code = re.sub(bad_line, good_line, mobile_code)

with open('src/mobile/components/MobilePropertiesSheet.tsx', 'w', encoding='utf8') as f:
    f.write(mobile_code)
