import re
with open('src/mobile/components/MobilePropertiesSheet.tsx', 'r', encoding='utf8') as f:
    code = f.read()

bad_str = r"\{ \.\.\.\(clip\.audioSettings \|\| \{\}\), \[key\]: val \}"
good_str = "{ volume: 0, pan: 0, ...(clip.audioSettings || {}), [key]: val }"

code = re.sub(bad_str, good_str, code)
with open('src/mobile/components/MobilePropertiesSheet.tsx', 'w', encoding='utf8') as f:
    f.write(code)
