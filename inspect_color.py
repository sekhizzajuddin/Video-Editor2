with open('src/components/properties/PropertiesPanel.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i in range(4721, 5196):
    line = lines[i]
    if "{/* " in line and ("Section" in line or "Basic" in line or "Creative" in line or "Wheels" in line or "LUT" in line or "Curves" in line or "Transfer" in line or "Auto" in line):
        print(f"Line {i+1}: {line.strip()}")
