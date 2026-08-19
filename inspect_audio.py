with open('src/components/properties/PropertiesPanel.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i in range(5720, 6477):
    line = lines[i]
    if "{/* " in line and ("Audio" in line or "Volume" in line or "Ducking" in line or "EQ" in line or "Equalizer" in line or "Vocal" in line or "Fade" in line or "Enhance" in line or "Sound" in line):
        print(f"Line {i+1}: {line.strip()}")
