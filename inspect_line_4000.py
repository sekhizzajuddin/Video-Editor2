with open('src/components/properties/PropertiesPanel.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i in range(4000, 4145):
    if "<div" in lines[i] or "</div" in lines[i] or "{/* " in lines[i]:
        print(f"{i+1}: {lines[i]}", end="")
