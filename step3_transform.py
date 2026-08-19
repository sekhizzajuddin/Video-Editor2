import re

with open('src/components/properties/PropertiesPanel.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Helper to wrap an accordion block:
# Pattern:
# <div className="bg-[#2d2d2d] rounded border border-[#3e3e3e]...">
#   <button onClick={() => toggleSection('SECTION')}>
#     ...
#   </button>
#   {!collapsedSections['SECTION'] && (
#     CONTENT
#   )}
# </div>

def wrap_accordion(code, section_id, button_pattern_str):
    # Find the button and replace the accordion header with !isMobileView check and collapse check with isSectionOpen
    pass

# Transform tab sections:
# 1. Smart Reframe
code = code.replace(
    "{/* Smart Reframe AI */}\n              <div className=\"bg-[#1e1e1e] p-3 rounded border border-cyan-500/30",
    "{/* Smart Reframe AI */}\n              {shouldShowSection('reframe') && (\n              <div className=\"bg-[#1e1e1e] p-3 rounded border border-cyan-500/30"
)
code = code.replace(
    "Analyze & Track\n                </button>\n              </div>\n\n              {/* Master Keyframes */}",
    "Analyze & Track\n                </button>\n              </div>\n              )}\n\n              {/* Master Keyframes */}"
)

# 2. Master Keyframes
code = code.replace(
    "{/* Master Keyframes */}\n              <div className=\"bg-[#2d2d2d] rounded border border-[#3e3e3e] p-2.5\">",
    "{/* Master Keyframes */}\n              {shouldShowSection('keyframes') && (\n              <div className=\"bg-[#2d2d2d] rounded border border-[#3e3e3e] p-2.5\">"
)
code = code.replace(
    "</div>\n                )}\n              </div>\n\n              {/* Position */}",
    "</div>\n                )}\n              </div>\n              )}\n\n              {/* Position */}"
)

with open('src/components/properties/PropertiesPanel.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

print("Step 3 partial completed successfully!")
