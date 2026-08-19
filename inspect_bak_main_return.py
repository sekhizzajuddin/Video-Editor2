with open('src/components/properties/PropertiesPanel.bak.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i in range(2885, 2940):
    print(f"{i+1}: {lines[i]}", end="")
