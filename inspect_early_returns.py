with open('src/components/properties/PropertiesPanel.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i in range(1100, 1550):
    line = lines[i]
    if "return (" in line or "if (" in line and ("selected" in line or "Clip" in line):
        print(f"Line {i+1}: {line.strip()}")
