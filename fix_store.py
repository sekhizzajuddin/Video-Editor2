import re

with open('src/mobile/components/MobilePropertiesSheet.tsx', 'r', encoding='utf8') as f:
    code = f.read()

code = code.replace(
    "const state = useEditorStore();\n  const clipResult = targetId ? findClipDeep(state, targetId) : null;",
    "const clipResult = targetId ? findClipDeep(useEditorStore.getState(), targetId) : null;"
)

with open('src/mobile/components/MobilePropertiesSheet.tsx', 'w', encoding='utf8') as f:
    f.write(code)

