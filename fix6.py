import re
with open('src/mobile/components/MobilePropertiesSheet.tsx', 'r', encoding='utf8') as f:
    code = f.read()

code = code.replace("<ColorGradeTransferSection selectedClip={clip} />", "<ColorGradeTransferSection selectedClip={clip} selectedClipIds={[clip.id]} />")

with open('src/mobile/components/MobilePropertiesSheet.tsx', 'w', encoding='utf8') as f:
    f.write(code)
