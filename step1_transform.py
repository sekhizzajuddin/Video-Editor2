import re

with open('src/components/properties/PropertiesPanel.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Clean duplicate imports at the top
code = re.sub(r"import \{ PROPERTY_REGISTRY \} from '\./PropertyRegistry';\r?\n?", "", code)

# 2. Add MOBILE_SUB_TABS configuration right before `export function PropertiesPanel`
mobile_sub_tabs_code = """
const MOBILE_SUB_TABS: Record<string, Array<{ id: string; label: string }>> = {
  transform: [
    { id: 'scale', label: 'Scale' },
    { id: 'position', label: 'Position' },
    { id: 'rotation', label: 'Rotation' },
    { id: 'opacity', label: 'Opacity' },
    { id: 'flip', label: 'Flip' },
    { id: 'perspective', label: 'Warp' },
    { id: 'blendMode', label: 'Blend' },
    { id: 'crop', label: 'Crop' },
    { id: 'reframe', label: 'Smart Reframe' },
    { id: 'keyframes', label: 'Keyframes' },
    { id: 'kenBurns', label: 'Ken Burns' },
    { id: 'keying', label: 'Chroma / AI' },
  ],
  color: [
    { id: 'colorBasic', label: 'Basic' },
    { id: 'colorCreative', label: 'Creative' },
    { id: 'colorWheels', label: 'Color Wheels' },
    { id: 'lutGrade', label: 'LUT Grade' },
  ],
  audio: [
    { id: 'audioVolume', label: 'Volume & Pan' },
    { id: 'audioDucking', label: 'Auto Ducking' },
    { id: 'soundDesign', label: 'Sound Design' },
    { id: 'audioEQ', label: 'Equalizer' },
    { id: 'audioVocalTune', label: 'Voice Tune' },
    { id: 'audioFades', label: 'Fades' },
    { id: 'audioEnhancements', label: 'Enhance' },
    { id: 'aiVocalSeparation', label: 'Vocal Split' },
    { id: 'audioSpeedPitch', label: 'Speed Pitch' },
  ],
  speed: [
    { id: 'speed', label: 'Speed' },
    { id: 'presets', label: 'Presets' },
    { id: 'ramping', label: 'Ramping' },
  ],
  mask: [
    { id: 'enable', label: 'Mask Shape' },
    { id: 'params', label: 'Parameters' },
    { id: 'chroma', label: 'Chroma Key' },
  ],
  text: [
    { id: 'content', label: 'Text & Font' },
    { id: 'presets', label: 'Animation & Styles' },
  ],
  effects: [
    { id: 'kinetic', label: 'Kinetic Text' },
    { id: 'beatsync', label: 'Beat Sync' },
    { id: 'sfx', label: 'AI SFX' },
    { id: 'designer', label: 'Motion Graphics' },
    { id: 'keying', label: 'Eraser & Chroma' },
    { id: 'motion', label: 'Motion Effects' },
    { id: 'particles', label: 'Particles' },
  ],
  thumbnail: [
    { id: 'thumbnail', label: 'Thumbnail' },
  ],
  history: [
    { id: 'history', label: 'History' },
  ],
};
"""

code = code.replace("export function PropertiesPanel({ isMobileView, mobileCategory, onMobileClose }: PropertiesPanelProps = {}) {",
                    mobile_sub_tabs_code + "\nexport function PropertiesPanel({ isMobileView, mobileCategory, onMobileClose }: PropertiesPanelProps = {}) {")

# 3. Add mobile state and helper functions inside PropertiesPanel component
mobile_state_helpers = """
  const [mobileSubTab, setMobileSubTab] = useState<string>('');

  useEffect(() => {
    if (isMobileView && mobileCategory) {
      const normalized = mobileCategory === 'style' ? 'transform' : mobileCategory === 'ai' ? 'effects' : mobileCategory;
      setActivePropertiesTab(normalized as any);
    }
  }, [isMobileView, mobileCategory, setActivePropertiesTab]);

  const currentSubTabs = MOBILE_SUB_TABS[activePropertiesTab] || [];
  const effectiveSubTab = currentSubTabs.some(t => t.id === mobileSubTab)
    ? mobileSubTab
    : (currentSubTabs[0]?.id || '');

  const shouldShowSection = (sectionId: string) => {
    if (!isMobileView) return true;
    return effectiveSubTab === sectionId;
  };

  const isSectionOpen = (sectionId: string) => {
    if (isMobileView) return true;
    return !collapsedSections[sectionId];
  };
"""

target_pos = "const PropertiesPanel = " if "const PropertiesPanel = " in code else "export function PropertiesPanel"
code = re.sub(r"(export function PropertiesPanel[^{]*\{)", r"\1" + mobile_state_helpers, code, count=1)

with open('src/components/properties/PropertiesPanel.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

print("Step 1 completed successfully!")
