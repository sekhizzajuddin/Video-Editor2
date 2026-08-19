with open('src/components/properties/PropertiesPanel.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

print(f"Total lines: {len(lines)}")
# Find where export function PropertiesPanel starts
for i, line in enumerate(lines):
    if "export function PropertiesPanel" in line:
        print(f"PropertiesPanel starts at line {i+1}")
    if "if (selectedTransition && selectedTransitionClip)" in line:
        print(f"selectedTransition check at line {i+1}")
    if "return (" in line and i > 2800 and i < 3000:
        print(f"Main return starts at line {i+1}")
