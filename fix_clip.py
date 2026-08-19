import re

with open('src/mobile/components/MobilePropertiesSheet.tsx', 'r', encoding='utf8') as f:
    code = f.read()

code = code.replace(
    "const clip = targetId ? findClipDeep(tracks, targetId, pipWindows) : null;",
    "const clipResult = targetId ? findClipDeep(tracks, targetId, pipWindows) : null;\n  const clip = clipResult?.clip;"
)

with open('src/mobile/components/MobilePropertiesSheet.tsx', 'w', encoding='utf8') as f:
    f.write(code)

