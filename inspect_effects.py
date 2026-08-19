with open('src/components/properties/PropertiesPanel.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i in range(6903, 7325):
    line = lines[i]
    if "{/* " in line:
        try:
            print(f"Line {i+1}: {line.strip().encode('ascii', 'ignore').decode('ascii')}")
        except Exception:
            pass
