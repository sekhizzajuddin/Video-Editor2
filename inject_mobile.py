import re

with open('src/components/properties/PropertiesPanel.tsx', 'r', encoding='utf8') as f:
    code = f.read()

# 1. Update signature
old_sig = "export function PropertiesPanel() {"
new_sig = """export interface PropertiesPanelProps {
  isMobileView?: boolean;
  mobileCategory?: string;
  onMobileClose?: () => void;
}

export function PropertiesPanel({ isMobileView, mobileCategory, onMobileClose }: PropertiesPanelProps = {}) {"""
code = code.replace(old_sig, new_sig)

# 2. Add currentSubTab state just after useEditorStore hook
state_hook = "const { activePropertiesTab } = useEditorStore(useShallow(state => ({"
new_state = "const [currentSubTab, setCurrentSubTab] = useState<string>('');\n  " + state_hook
code = code.replace(state_hook, new_state)

# 3. Add PROPERTY_REGISTRY import
code = "import { PROPERTY_REGISTRY } from './PropertyRegistry';\n" + code

# 4. Insert the mobile return block at the very end of the function, right BEFORE the final return statement.
# Wait, the Desktop return statement is at the bottom. We can just add `if (isMobileView) { return ( ... ) }` right before it!

desktop_return_idx = code.rfind("  return (\n    <div className=\"flex flex-col h-full bg-[#1e1e1e] border-l border-[#3e3e3e] w-80 shrink-0\">")

if desktop_return_idx == -1:
    desktop_return_idx = code.rfind("  return (\n    <div className=\"flex flex-col h-full bg-[#1e1e1e] border-l")

if desktop_return_idx == -1:
    print("Could not find desktop return block")
else:
    mobile_return = """
  if (isMobileView && mobileCategory) {
    const tabs = PROPERTY_REGISTRY[mobileCategory] || [];
    
    // Auto-select first tab
    if (tabs.length > 0 && !tabs.find(t => t.id === currentSubTab)) {
      setCurrentSubTab(tabs[0].id);
    }
    
    const ActiveComponent = tabs.find(t => t.id === currentSubTab)?.component;
    
    const commonProps = {
      clip: selectedClip,
      selectedClip,
      updateClip,
      localTime: currentTime - (selectedClip?.startTime || 0),
      absoluteStartTime: selectedClip?.startTime || 0,
      animations: selectedClip?.animations || {},
      collapsedSections: collapsedSections,
      toggleSection: toggleSection,
      getPropVal: getPropVal,
      setPropVal: setPropVal,
      
      // Speed helpers
      speed: selectedClip?.speed || 1,
      isRamped: !!selectedClip?.speedRamp,
      onSpeedChange: (v: number) => {
         if (!selectedClip) return;
         const sourceDuration = selectedClip.duration * (selectedClip.speed ?? 1); 
         updateClip(selectedClip.id, { speed: v, duration: sourceDuration / v }, { ripple: true });
      },
      onReset: () => {
         if (!selectedClip) return;
         const sourceDuration = selectedClip.duration * (selectedClip.speed ?? 1); 
         updateClip(selectedClip.id, { speed: 1, duration: sourceDuration }, { ripple: true });
      },
      
      // Text helpers
      text: selectedClip?.textSettings?.text ?? '',
      fontFamily: selectedClip?.textSettings?.fontFamily ?? 'Inter',
      fontSize: selectedClip?.textSettings?.fontSize ?? 40,
      color: selectedClip?.textSettings?.color ?? '#ffffff',
      shadow: selectedClip?.textSettings?.shadow ?? false,
      bold: selectedClip?.textSettings?.bold ?? false,
      italic: selectedClip?.textSettings?.italic ?? false,
      underline: selectedClip?.textSettings?.underline ?? false,
      onChange: (v: any) => {
         if (!selectedClip) return;
         if (currentSubTab === 'content') updateClip(selectedClip.id, { textSettings: { ...selectedClip.textSettings!, text: v } });
         else if (currentSubTab === 'font') updateClip(selectedClip.id, { textSettings: { ...selectedClip.textSettings!, fontFamily: v } });
         else if (currentSubTab === 'fontSize') updateClip(selectedClip.id, { textSettings: { ...selectedClip.textSettings!, fontSize: v } });
         else if (currentSubTab === 'color') updateClip(selectedClip.id, { textSettings: { ...selectedClip.textSettings!, color: v } });
      },
      onToggle: () => {
        if (selectedClip) updateClip(selectedClip.id, { textSettings: { ...selectedClip.textSettings!, shadow: !(selectedClip.textSettings?.shadow ?? false) } });
      },
      onBoldToggle: () => { if (selectedClip) updateClip(selectedClip.id, { textSettings: { ...selectedClip.textSettings!, bold: !(selectedClip.textSettings?.bold ?? false) } }) },
      onItalicToggle: () => { if (selectedClip) updateClip(selectedClip.id, { textSettings: { ...selectedClip.textSettings!, italic: !(selectedClip.textSettings?.italic ?? false) } }) },
      onUnderlineToggle: () => { if (selectedClip) updateClip(selectedClip.id, { textSettings: { ...selectedClip.textSettings!, underline: !(selectedClip.textSettings?.underline ?? false) } }) },
      textSettings: selectedClip?.textSettings,
      clipId: selectedClip?.id,
      
      // Mask
      enabled: selectedClip?.mask?.enabled ?? false,
      type: selectedClip?.mask?.type ?? 'none',
      invert: selectedClip?.mask?.invert ?? false,
      feather: selectedClip?.mask?.feather ?? 0,
      roundness: selectedClip?.mask?.roundness ?? 0,
      
      // Color
      temperature: selectedClip?.colorFilters?.temperature ?? 0,
      tint: selectedClip?.colorFilters?.tint ?? 0,
      exposure: selectedClip?.colorFilters?.exposure ?? 0,
      contrast: selectedClip?.colorFilters?.contrast ?? 100,
      saturation: selectedClip?.colorFilters?.saturation ?? 100,
      blur: selectedClip?.colorFilters?.blur ?? 0,
      fadedFilm: selectedClip?.colorFilters?.fadedFilm ?? 0,
      vignette: selectedClip?.colorFilters?.vignette ?? 0,
      curves: selectedClip?.colorFilters?.curves || {},
      selectedClipIds: [selectedClip?.id],
      
      // Audio
      volume: selectedClip?.audioSettings?.volume ?? 0,
      pan: selectedClip?.audioSettings?.pan ?? 0,
      bass: selectedClip?.audioSettings?.bass ?? 0,
      mid: selectedClip?.audioSettings?.mid ?? 0,
      treble: selectedClip?.audioSettings?.treble ?? 0,
      onBassChange: (v: number) => { if (selectedClip) updateClip(selectedClip.id, { audioSettings: { ...selectedClip.audioSettings, bass: v } as any }) },
      onMidChange: (v: number) => { if (selectedClip) updateClip(selectedClip.id, { audioSettings: { ...selectedClip.audioSettings, mid: v } as any }) },
      onTrebleChange: (v: number) => { if (selectedClip) updateClip(selectedClip.id, { audioSettings: { ...selectedClip.audioSettings, treble: v } as any }) },
      handleAudioChange: (key: string, val: any) => { if (selectedClip) updateClip(selectedClip.id, { audioSettings: { ...selectedClip.audioSettings, [key]: val } as any }) },
    };

    return (
      <div className="fixed inset-x-0 bottom-0 z-50 flex h-[60vh] flex-col rounded-t-2xl bg-[#121215] shadow-2xl transition-transform duration-300">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h3 className="text-sm font-semibold capitalize text-white">{mobileCategory}</h3>
          <button
            onClick={onMobileClose}
            className="rounded-full bg-white/5 p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Sub Tabs */}
        <div className="border-b border-white/5 overflow-x-auto no-scrollbar touch-pan-x">
          <div className="flex px-2 py-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setCurrentSubTab(tab.id)}
                className={`flex-shrink-0 whitespace-nowrap px-4 py-1.5 text-xs font-medium rounded-full transition-colors ${
                  currentSubTab === tab.id
                    ? 'bg-amber-500 text-black shadow-sm'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="mobile-no-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {ActiveComponent && selectedClip && <ActiveComponent {...commonProps} />}
          {!selectedClip && (
            <div className="flex h-full items-center justify-center text-[#a0a0a0] text-sm">
              Please select a clip to edit properties.
            </div>
          )}
        </div>
      </div>
    );
  }

"""
    code = code[:desktop_return_idx] + mobile_return + code[desktop_return_idx:]

with open('src/components/properties/PropertiesPanel.tsx', 'w', encoding='utf8') as f:
    f.write(code)

print("Injected mobile view successfully")
