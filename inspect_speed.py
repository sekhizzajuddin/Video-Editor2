with open('src/components/properties/PropertiesPanel.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i in range(5195, 5721):
    line = lines[i]
    if "{/* " in line and ("Speed" in line or "Ramping" in line or "Preset" in line or "Curve" in line or "Pitch" in line):
        print(f"Line {i+1}: {line.strip()}")
