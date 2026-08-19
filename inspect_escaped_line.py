with open('src/components/properties/PropertiesPanel.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i in range(5735, 5745):
    print(f"{i+1}: {repr(lines[i])}")
