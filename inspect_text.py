with open('src/components/properties/PropertiesPanel.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i in range(6476, 6904):
    line = lines[i]
    if "{/* " in line:
        print(f"Line {i+1}: {line.strip()}")
