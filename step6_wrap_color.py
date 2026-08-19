import re

with open('src/components/properties/PropertiesPanel.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Color tab:
# colorBasic
code = code.replace(
    "{/* Basic Correction Section */}\n            <div className=\"bg-[#2d2d2d] rounded border border-[#3e3e3e]\">\n              <button\n                onClick={() => toggleSection('colorBasic')}",
    "{/* Basic Correction Section */}\n            {shouldShowSection('colorBasic') && (\n            <div className=\"bg-[#2d2d2d] rounded border border-[#3e3e3e]\">\n              <button\n                onClick={() => toggleSection('colorBasic')}"
)
code = code.replace(
    "</div>\n              )}\n            </div>\n\n            {/* Creative Section */}",
    "</div>\n              )}\n            </div>\n            )}\n\n            {/* Creative Section */}"
)

# colorCreative
code = code.replace(
    "{/* Creative Section */}\n            <div className=\"bg-[#2d2d2d] rounded border border-[#3e3e3e]\">\n              <button\n                onClick={() => toggleSection('colorCreative')}",
    "{/* Creative Section */}\n            {shouldShowSection('colorCreative') && (\n            <div className=\"bg-[#2d2d2d] rounded border border-[#3e3e3e]\">\n              <button\n                onClick={() => toggleSection('colorCreative')}"
)
code = code.replace(
    "</div>\n              )}\n            </div>\n\n            {/* 3-Way Color Wheels */}",
    "</div>\n              )}\n            </div>\n            )}\n\n            {/* 3-Way Color Wheels */}"
)

# colorWheels
code = code.replace(
    "{/* 3-Way Color Wheels */}\n            <div className=\"bg-[#2d2d2d] rounded border border-[#3e3e3e]\">\n              <button\n                onClick={() => toggleSection('colorWheels')}",
    "{/* 3-Way Color Wheels */}\n            {shouldShowSection('colorWheels') && (\n            <div className=\"bg-[#2d2d2d] rounded border border-[#3e3e3e]\">\n              <button\n                onClick={() => toggleSection('colorWheels')}"
)
code = code.replace(
    "</div>\n              )}\n            </div>\n\n            {/* LUT Color Grade */}",
    "</div>\n              )}\n            </div>\n            )}\n\n            {/* LUT Color Grade */}"
)

# lutGrade
code = code.replace(
    "{/* LUT Color Grade */}\n            <div className=\"bg-[#2d2d2d] rounded border border-[#3e3e3e]\">\n              <button\n                onClick={() => toggleSection('lutGrade')}",
    "{/* LUT Color Grade */}\n            {shouldShowSection('lutGrade') && (\n            <div className=\"bg-[#2d2d2d] rounded border border-[#3e3e3e]\">\n              <button\n                onClick={() => toggleSection('lutGrade')}"
)
code = code.replace(
    "</div>\n              )}\n            </div>\n          </div>\n        )}\n\n        {activePropertiesTab === 'speed' && (",
    "</div>\n              )}\n            </div>\n            )}\n          </div>\n        )}\n\n        {activePropertiesTab === 'speed' && ("
)

with open('src/components/properties/PropertiesPanel.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

print("Color sections wrapped successfully!")
