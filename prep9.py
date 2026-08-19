import re

with open('src/components/properties/PropertiesPanel.tsx', 'r', encoding='utf8') as f:
    panel_code = f.read()

flip_code = re.search(r"onClick=\{\(\) => toggleSection\('flip'\)\}.*?\{!collapsedSections\['flip'\] && \((.*?)\)\}", panel_code, flags=re.DOTALL).group(1).strip()
warp_code = re.search(r"onClick=\{\(\) => toggleSection\('perspective'\)\}.*?\{!collapsedSections\['perspective'\] && \((.*?)\)\}", panel_code, flags=re.DOTALL).group(1).strip()
crop_code = re.search(r"onClick=\{\(\) => toggleSection\('crop'\)\}.*?\{!collapsedSections\['crop'\] && \((.*?)\)\}", panel_code, flags=re.DOTALL).group(1).strip()

with open('src/mobile/components/MobilePropertiesSheet.tsx', 'r', encoding='utf8') as f:
    mobile_code = f.read()

# Fix subTabsMap
old_style_tabs = """style: [
      { id: 'scale', label: 'Scale' },
      { id: 'position', label: 'Position' },
      { id: 'rotation', label: 'Rotation' },
      { id: 'opacity', label: 'Opacity' },
      { id: 'blend', label: 'Blend' },
      { id: 'reframe', label: 'Smart Reframe' },
    ],"""
new_style_tabs = """style: [
      { id: 'keyframes', label: 'Keyframes' },
      { id: 'scale', label: 'Scale' },
      { id: 'position', label: 'Position' },
      { id: 'rotation', label: 'Rotation' },
      { id: 'opacity', label: 'Opacity' },
      { id: 'flip', label: 'Flip' },
      { id: 'perspective', label: 'Warp' },
      { id: 'blend', label: 'Blend' },
      { id: 'crop', label: 'Crop' },
      { id: 'reframe', label: 'Smart Reframe' },
    ],"""
mobile_code = mobile_code.replace(old_style_tabs, new_style_tabs)

# Add KeyframesSection import
mobile_code = mobile_code.replace("SmartReframeSection }", "SmartReframeSection, KeyframesSection }")

# Build the new render blocks
# Note: we need to replace setPropVal in crop_code because they use toast
# Also, KeyframesSection takes `selectedClip`, `animations`, `updateClip`
keyframes_render = "{category === 'style' && currentSubTab === 'keyframes' && <KeyframesSection selectedClip={clip} animations={animations} updateClip={updateClip} />}"
flip_render = f"{{category === 'style' && currentSubTab === 'flip' && ({flip_code})}}"
warp_render = f"{{category === 'style' && currentSubTab === 'perspective' && ({warp_code})}}"
crop_render = f"{{category === 'style' && currentSubTab === 'crop' && ({crop_code})}}"

# Find the end of the style blocks in mobile_code
insert_marker = r"\{category === 'style' && currentSubTab === 'blend'.*?^\s*\}\)"
match = re.search(insert_marker, mobile_code, flags=re.DOTALL | re.MULTILINE)
if match:
    full_new_blocks = f"{keyframes_render}\n        {flip_render}\n        {warp_render}\n        {crop_render}\n        {match.group(0)}"
    mobile_code = mobile_code[:match.start()] + full_new_blocks + mobile_code[match.end():]

with open('src/mobile/components/MobilePropertiesSheet.tsx', 'w', encoding='utf8') as f:
    f.write(mobile_code)

