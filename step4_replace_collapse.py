import re

with open('src/components/properties/PropertiesPanel.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Replace all !collapsedSections['xxx'] with isSectionOpen('xxx')
code = re.sub(r"!collapsedSections\['([^']+)'\]", r"isSectionOpen('\1')", code)

with open('src/components/properties/PropertiesPanel.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

print("Replaced all !collapsedSections with isSectionOpen!")
