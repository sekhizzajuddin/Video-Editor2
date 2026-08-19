import re
with open('src/mobile/components/MobilePropertiesSheet.tsx', 'r', encoding='utf8') as f:
    code = f.read()

code = code.replace("import { MotionEffectsPanel } from '@/components/properties/tabs/effects/MotionEffectsPanel';", "")
code = code.replace("{ id: 'motion', label: 'Motion Effects' },", "")

motion_jsx = r"{category === 'ai' && currentSubTab === 'motion' && <MotionEffectsPanel selectedClip={clip} />}"
code = code.replace(motion_jsx + "\n\n        ", "")

with open('src/mobile/components/MobilePropertiesSheet.tsx', 'w', encoding='utf8') as f:
    f.write(code)
