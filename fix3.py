import re
with open('src/mobile/components/MobilePropertiesSheet.tsx', 'r', encoding='utf8') as f:
    code = f.read()

bad_str = "  };\n{ id: 'text', label: 'Text' },\n      { id: 'font', label: 'Font Size' },\n      { id: 'color', label: 'Color' },\n    ],\n    ai: [\n      { id: 'kinetic', label: 'Kinetic' },\n      { id: 'beatsync', label: 'Beat Sync' },\n      { id: 'sfx', label: 'SFX' },\n      { id: 'eraser', label: 'Magic Eraser' },\n    ]\n  };"
bad_str = r"\};\{ id: 'text', label: 'Text' \},.*?    \]\n  \};"

code = re.sub(bad_str, "};", code, flags=re.DOTALL)
with open('src/mobile/components/MobilePropertiesSheet.tsx', 'w', encoding='utf8') as f:
    f.write(code)
