import re

with open('src/components/properties/PropertiesPanel.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Sections to wrap in transform:
# position
code = code.replace(
    "{/* Position */}\n              <div className=\"bg-[#2d2d2d] rounded border border-[#3e3e3e]\">\n                <button\n                  onClick={() => toggleSection('position')}",
    "{/* Position */}\n              {shouldShowSection('position') && (\n              <div className=\"bg-[#2d2d2d] rounded border border-[#3e3e3e]\">\n                <button\n                  onClick={() => toggleSection('position')}"
)
code = code.replace(
    "</div>\n                )}\n              </div>\n\n              {/* Scale */}",
    "</div>\n                )}\n              </div>\n              )}\n\n              {/* Scale */}"
)

# scale
code = code.replace(
    "{/* Scale */}\n              <div className=\"bg-[#2d2d2d] rounded border border-[#3e3e3e]\">\n                <button\n                  onClick={() => toggleSection('scale')}",
    "{/* Scale */}\n              {shouldShowSection('scale') && (\n              <div className=\"bg-[#2d2d2d] rounded border border-[#3e3e3e]\">\n                <button\n                  onClick={() => toggleSection('scale')}"
)
code = code.replace(
    "</div>\n                )}\n              </div>\n\n              {/* Rotation */}",
    "</div>\n                )}\n              </div>\n              )}\n\n              {/* Rotation */}"
)

# rotation
code = code.replace(
    "{/* Rotation */}\n              <div className=\"bg-[#2d2d2d] rounded border border-[#3e3e3e]\">\n                <button\n                  onClick={() => toggleSection('rotation')}",
    "{/* Rotation */}\n              {shouldShowSection('rotation') && (\n              <div className=\"bg-[#2d2d2d] rounded border border-[#3e3e3e]\">\n                <button\n                  onClick={() => toggleSection('rotation')}"
)
code = code.replace(
    "</div>\n                )}\n              </div>\n\n              {/* Opacity */}",
    "</div>\n                )}\n              </div>\n              )}\n\n              {/* Opacity */}"
)

# opacity
code = code.replace(
    "{/* Opacity */}\n              <div className=\"bg-[#2d2d2d] rounded border border-[#3e3e3e]\">\n                <button\n                  onClick={() => toggleSection('opacity')}",
    "{/* Opacity */}\n              {shouldShowSection('opacity') && (\n              <div className=\"bg-[#2d2d2d] rounded border border-[#3e3e3e]\">\n                <button\n                  onClick={() => toggleSection('opacity')}"
)
code = code.replace(
    "</div>\n                )}\n              </div>\n\n              {renderBlendModeSection()}",
    "</div>\n                )}\n              </div>\n              )}\n\n              {shouldShowSection('blendMode') && renderBlendModeSection()}"
)

# flip
code = code.replace(
    "<div className=\"bg-[#2d2d2d] rounded border border-[#3e3e3e]\">\n                <button\n                  onClick={() => toggleSection('flip')}",
    "{shouldShowSection('flip') && (\n              <div className=\"bg-[#2d2d2d] rounded border border-[#3e3e3e]\">\n                <button\n                  onClick={() => toggleSection('flip')}"
)
code = code.replace(
    "</div>\n                )}\n              </div>\n\n            {/* Perspective Warp & Motion Tracking */}",
    "</div>\n                )}\n              </div>\n              )}\n\n            {/* Perspective Warp & Motion Tracking */}"
)

# perspective
code = code.replace(
    "{/* Perspective Warp & Motion Tracking */}\n            <div className=\"bg-[#2d2d2d] rounded border border-[#3e3e3e]\">\n              <button\n                onClick={() => toggleSection('perspective')}",
    "{/* Perspective Warp & Motion Tracking */}\n            {shouldShowSection('perspective') && (\n            <div className=\"bg-[#2d2d2d] rounded border border-[#3e3e3e]\">\n              <button\n                onClick={() => toggleSection('perspective')}"
)
code = code.replace(
    "</div>\n              )}\n            </div>\n\n            {/* Crop */}",
    "</div>\n              )}\n            </div>\n            )}\n\n            {/* Crop */}"
)

# crop
code = code.replace(
    "{/* Crop */}\n            <div className=\"bg-[#2d2d2d] rounded border border-[#3e3e3e]\">\n              <button\n                onClick={() => toggleSection('crop')}",
    "{/* Crop */}\n            {shouldShowSection('crop') && (\n            <div className=\"bg-[#2d2d2d] rounded border border-[#3e3e3e]\">\n              <button\n                onClick={() => toggleSection('crop')}"
)
code = code.replace(
    "</div>\n              )}\n            </div>\n\n            {/* Ken Burns Effect",
    "</div>\n              )}\n            </div>\n            )}\n\n            {/* Ken Burns Effect"
)

# kenBurns
code = code.replace(
    "<div className=\"bg-[#2d2d2d] rounded border border-[#3e3e3e]\">\n                    <button\n                      onClick={() => toggleSection('kenBurns')}",
    "{shouldShowSection('kenBurns') && (\n                  <div className=\"bg-[#2d2d2d] rounded border border-[#3e3e3e]\">\n                    <button\n                      onClick={() => toggleSection('kenBurns')}"
)
code = code.replace(
    "</div>\n                  </div>\n                )}\n              </div>\n            )}\n\n            {renderKeyingAndAiSection()}",
    "</div>\n                  </div>\n                )}\n              </div>\n              )}\n            )}\n\n            {shouldShowSection('keying') && renderKeyingAndAiSection()}"
)

with open('src/components/properties/PropertiesPanel.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

print("Transform sections wrapped successfully!")
