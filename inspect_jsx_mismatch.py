with open('src/components/properties/PropertiesPanel.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i in range(1540, 2095):
    line = lines[i]
    if "return" in line or "<div" in line or "</div" in line or "{" in line or "}" in line:
        if i < 1600 or i > 2050:
            print(f"Line {i+1}: {line.strip()}")
