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

# Replace "import { toast } from 'sonner';" with "import { toast } from 'sonner';\nconst trackingResults: any[] = [];" to prevent undefined trackingResults from crashing warp
mobile_code = mobile_code.replace("import { toast } from 'sonner';", "import { toast } from 'sonner';\nconst trackingResults: any[] = [];")

insert_marker = r"\{category === 'style' && currentSubTab === 'blend'"
match = re.search(insert_marker, mobile_code)

if match:
    full_new_blocks = f"{keyframes_render}\n        {flip_render}\n        {warp_render}\n        {crop_render}\n        "
    mobile_code = mobile_code[:match.start()] + full_new_blocks + mobile_code[match.start():]
else:
    print("MATCH STILL FAILED")

with open('src/mobile/components/MobilePropertiesSheet.tsx', 'w', encoding='utf8') as f:
    f.write(mobile_code)

