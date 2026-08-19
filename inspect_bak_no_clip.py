with open('src/components/properties/PropertiesPanel.bak.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i in range(1455, 1545):
    print(f"{i+1}: {lines[i]}", end="")
