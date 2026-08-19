import re

with open('src/components/properties/PropertiesPanel.tsx', 'r', encoding='utf8') as f:
    panel_code = f.read()

flip_code = re.search(r"onClick=\{\(\) => toggleSection\('flip'\)\}.*?\{!collapsedSections\['flip'\] && \((.*?)\)\}", panel_code, flags=re.DOTALL).group(1).strip()
warp_code = re.search(r"onClick=\{\(\) => toggleSection\('perspective'\)\}.*?\{!collapsedSections\['perspective'\] && \((.*?)\)\}", panel_code, flags=re.DOTALL).group(1).strip()
crop_code = re.search(r"onClick=\{\(\) => toggleSection\('crop'\)\}.*?\{!collapsedSections\['crop'\] && \((.*?)\)\}", panel_code, flags=re.DOTALL).group(1).strip()

with open('src/mobile/components/MobilePropertiesSheet.tsx', 'r', encoding='utf8') as f:
    mobile_code = f.read()

keyframes_render = "{category === 'style' && currentSubTab === 'keyframes' && <KeyframesSection selectedClip={clip} animations={animations} updateClip={updateClip} />}"
flip_render = f"{{category === 'style' && currentSubTab === 'flip' && ({flip_code})}}"
warp_render = f"{{category === 'style' && currentSubTab === 'perspective' && ({warp_code})}}"
crop_render = f"{{category === 'style' && currentSubTab === 'crop' && ({crop_code})}}"

full_new_blocks = f"""
          {keyframes_render}
          {flip_render}
          {warp_render}
          {crop_render}
"""

# Replace toast import
mobile_code = mobile_code.replace("import { toast } from 'sonner';", "import { toast } from 'sonner';\nconst trackingResults: any[] = [];")

target = "{category === 'style' && currentSubTab === 'reframe' && <SmartReframeSection selectedClip={clip} updateClip={updateClip} />}"
mobile_code = mobile_code.replace(target, target + "\n" + full_new_blocks)

with open('src/mobile/components/MobilePropertiesSheet.tsx', 'w', encoding='utf8') as f:
    f.write(mobile_code)

