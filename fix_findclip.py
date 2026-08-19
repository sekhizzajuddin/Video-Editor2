import re

with open('src/mobile/components/MobilePropertiesSheet.tsx', 'r', encoding='utf8') as f:
    code = f.read()

code = code.replace(
    "const clipResult = targetId ? findClipDeep(tracks, targetId, pipWindows) : null;",
    "const state = useEditorStore();\n  const clipResult = targetId ? findClipDeep(state, targetId) : null;"
)

with open('src/mobile/components/MobilePropertiesSheet.tsx', 'w', encoding='utf8') as f:
    f.write(code)

with open('src/mobile/App.tsx', 'r', encoding='utf8') as f:
    app_code = f.read()
    
app_code = app_code.replace(
    "initialTab={activePropertiesTab}",
    "category={activePropertiesTab as any}"
)

with open('src/mobile/App.tsx', 'w', encoding='utf8') as f:
    f.write(app_code)

