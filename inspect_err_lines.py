with open('src/components/properties/PropertiesPanel.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for line_num in [3206, 4165, 4786, 7661]:
    print(f"=== Line {line_num} ===")
    for i in range(max(0, line_num - 5), min(len(lines), line_num + 5)):
        print(f"{i+1}: {lines[i]}", end="")
