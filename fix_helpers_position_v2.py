with open('src/components/properties/PropertiesPanel.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Helper block to move
helpers_str = """  const [mobileSubTab, setMobileSubTab] = useState<string>('');

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

  const isSectionActive = (sectionId: string) => {
    if (!isMobileView) return true;
    return effectiveSubTab === sectionId;
  };

  const isSectionOpen = (sectionId: string) => {
    if (isMobileView) return true;
    return !collapsedSections[sectionId];
  };
"""

# Remove from top of PropertiesPanel
code = code.replace(
    "export function PropertiesPanel({ isMobileView, mobileCategory, onMobileClose }: PropertiesPanelProps = {}) {\n\n" + helpers_str,
    "export function PropertiesPanel({ isMobileView, mobileCategory, onMobileClose }: PropertiesPanelProps = {}) {\n"
)

# Insert after useShallow store block
target_store_end = "applyColorGradeToAll: s.applyColorGradeToAll,\n  })));"
assert target_store_end in code, "target_store_end not found!"
code = code.replace(target_store_end, target_store_end + "\n\n" + helpers_str, 1)

with open('src/components/properties/PropertiesPanel.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

print("Moved helpers after useShallow store block successfully!")
