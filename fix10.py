import re
with open('src/mobile/components/MobilePropertiesSheet.tsx', 'r', encoding='utf8') as f:
    code = f.read()

code = code.replace("updateClip,", "updateClip, currentTime,")
code = code.replace("updateClip: s.updateClip,", "updateClip: s.updateClip, currentTime: s.currentTime,")

with open('src/mobile/components/MobilePropertiesSheet.tsx', 'w', encoding='utf8') as f:
    f.write(code)
