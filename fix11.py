import re
with open('src/mobile/components/MobilePropertiesSheet.tsx', 'r', encoding='utf8') as f:
    code = f.read()

# Fix 1: currentTime
code = code.replace("updateClip: s.updateClip, currentTime: s.currentTime, currentTime,", "updateClip: s.updateClip, currentTime: s.currentTime,")

# Fix 2: Volume pan 0 duplicated volume
code = re.sub(
    r"volume: 0, pan: 0, \.\.\.\(clip\.audioSettings \|\| \{\}\)",
    r"pan: 0, ...(clip.audioSettings || {})",
    code
)

# Fix 3: Parameter 'm' implicitly has an 'any' type.
# return mediaLibrary.find((m) => m.id === clip.mediaId)?.type ?? null;
code = code.replace("mediaLibrary.find((m) =>", "mediaLibrary.find((m: any) =>")
code = code.replace("t.clips.find((m) =>", "t.clips.find((m: any) =>")

with open('src/mobile/components/MobilePropertiesSheet.tsx', 'w', encoding='utf8') as f:
    f.write(code)
