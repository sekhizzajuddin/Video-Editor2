import os

if os.path.exists('src/components/properties/PropertiesPanel.bak.tsx'):
    os.remove('src/components/properties/PropertiesPanel.bak.tsx')

with open('src/components/properties/PropertiesPanel.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Remove mobile_state_helpers from where it was
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

code = code.replace(helpers_str, "")

# Put helpers right after `const { ... } = useEditorStore(...);`
target_store_end = "clipboardData: s.clipboardData,\n  })));"

assert target_store_end in code, "target_store_end not found!"
code = code.replace(target_store_end, target_store_end + "\n" + helpers_str, 1)

with open('src/components/properties/PropertiesPanel.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

print("Moved helpers after useEditorStore and removed bak.tsx!")
