with open('src/components/properties/PropertiesPanel.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Fix line 3206:
code = code.replace(
    'className={`bg-[#1e1e1e] p-3 rounded border border-cyan-500/30 ${!isSectionActive(\'reframe\') ? \'hidden\' : \'\'}`} mb-3 shadow-lg shadow-cyan-900/20">',
    'className={`bg-[#1e1e1e] p-3 rounded border border-cyan-500/30 mb-3 shadow-lg shadow-cyan-900/20 ${!isSectionActive(\'reframe\') ? \'hidden\' : \'\'}`}>'
)

with open('src/components/properties/PropertiesPanel.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

print("Fixed line 3206!")
