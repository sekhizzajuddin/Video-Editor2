import re

with open('src/components/properties/PropertiesPanel.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Replace any broken className={`${isMobileView...
code = re.sub(
    r'className={`\$\{isMobileView[^`]*`(?:"|})',
    r'className={`${isMobileView ? "hidden" : ""} w-full flex items-center justify-between p-2.5 text-xs text-white`}',
    code
)

with open('src/components/properties/PropertiesPanel.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

print("Fixed broken template strings!")
