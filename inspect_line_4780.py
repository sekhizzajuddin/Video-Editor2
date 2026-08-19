with open('src/components/properties/PropertiesPanel.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i in range(4770, 4800):
    print(f"{i+1}: {lines[i]}", end="")
