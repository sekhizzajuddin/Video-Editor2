import re
with open('src/mobile/components/MobilePropertiesSheet.tsx', 'r', encoding='utf8') as f:
    code = f.read()

# Fix currentTime
bad_store = "const updateClip = useEditorStore((state) => state.updateClip);"
good_store = """
  const updateClip = useEditorStore((state) => state.updateClip);
  const currentTime = useEditorStore((state) => state.currentTime);
"""
if 'const currentTime = useEditorStore' not in code:
    code = code.replace(bad_store, good_store)

# Fix duplicated volume property
bad_vol = r"volume: 0, pan: 0, \.\.\.\(clip\.audioSettings \|\| \{\}\), volume: v"
good_vol = r"pan: 0, ...(clip.audioSettings || {}), volume: v"
code = re.sub(bad_vol, good_vol, code)

bad_vol2 = r"volume: 0, pan: 0, \.\.\.\(clip\.audioSettings \|\| \{\}\), volume: 0"
good_vol2 = r"pan: 0, ...(clip.audioSettings || {}), volume: 0"
code = re.sub(bad_vol2, good_vol2, code)

with open('src/mobile/components/MobilePropertiesSheet.tsx', 'w', encoding='utf8') as f:
    f.write(code)
