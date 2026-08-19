with open('src/components/properties/PropertiesPanel.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i in range(7675, len(lines)):
    print(f"{i+1}: {lines[i]}", end="")
