import re
with open('src/mobile/components/MobilePropertiesSheet.tsx', 'r', encoding='utf8') as f:
    code = f.read()

bad_str = r"\{category === 'style' && currentSubTab === 'position' && <PositionSection selectedClip=\{clip\} localTime=\{localTime\} absoluteStartTime=\{absoluteStartTime\} animations=\{animations\} collapsedSections=\{\{\}\} toggleSection=\{\(\) => \{\}\} getPropVal=\{getPropVal\} setPropVal=\{setPropVal\} updateClip=\{updateClip\} /\} \/>\n\s*<Slider label=\"Position Y\" value=\{Math.round\(t.y\)\} min=\{-1000\} max=\{1000\} step=\{1\} onChange=\{\(v\) => setTransform\(\{ y: v \}\)\} \/>\n\s*</div>\n\s*\}"
good_str = r"{category === 'style' && currentSubTab === 'position' && <PositionSection selectedClip={clip} localTime={localTime} absoluteStartTime={absoluteStartTime} animations={animations} collapsedSections={{}} toggleSection={() => {}} getPropVal={getPropVal} setPropVal={setPropVal} updateClip={updateClip} />}"

code = re.sub(bad_str, good_str, code, flags=re.DOTALL)

with open('src/mobile/components/MobilePropertiesSheet.tsx', 'w', encoding='utf8') as f:
    f.write(code)
