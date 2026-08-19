with open('src/components/properties/PropertiesPanel.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i in range(3010, 4603):
    line = lines[i]
    if "{/* " in line and ("Section" in line or "Smart" in line or "Master" in line or "Position" in line or "Scale" in line or "Rotation" in line or "Opacity" in line or "Flip" in line or "Perspective" in line or "Crop" in line or "Ken" in line or "Keying" in line or "Blend" in line):
        print(f"Line {i+1}: {line.strip()}")
