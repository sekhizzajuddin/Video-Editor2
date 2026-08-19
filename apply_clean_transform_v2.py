import re

with open('src/components/properties/PropertiesPanel.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Clean duplicate imports at top
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
  ],
  text: [
    { id: 'content', label: 'Text & Font' },
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

target_fn_header = "export function PropertiesPanel({ isMobileView, mobileCategory, onMobileClose }: PropertiesPanelProps = {}) {"

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

  const isSectionActive = (sectionId: string) => {
    if (!isMobileView) return true;
    return effectiveSubTab === sectionId;
  };

  const isSectionOpen = (sectionId: string) => {
    if (isMobileView) return true;
    return !collapsedSections[sectionId];
  };
"""

code = code.replace(target_fn_header, mobile_sub_tabs_code + "\n" + target_fn_header + "\n" + mobile_state_helpers)

# 4. Replace !collapsedSections with isSectionOpen
code = re.sub(r"!collapsedSections\['([^']+)'\]", r"isSectionOpen('\1')", code)

# 5. Update !selectedClip early return
not_selected_clip_pattern = r"if \(!selectedClip\) \{\s*return \(\s*<div className=\"h-full flex flex-col bg-\[#252525\] border-l border-\[#3e3e3e\]\">"

not_selected_clip_replacement = """if (!selectedClip) {
    if (isMobileView) {
      return (
        <div className="h-full flex flex-col bg-[#121215] text-white">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 shrink-0">
            <h3 className="text-sm font-semibold capitalize text-white">
              {tabs.find(t => t.id === activePropertiesTab)?.label || mobileCategory || 'Properties'}
            </h3>
            {onMobileClose && (
              <button
                onClick={onMobileClose}
                className="rounded-full bg-white/5 p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {activePropertiesTab === 'history' ? (
            <div className="flex-1 overflow-y-auto p-4 space-y-2 mobile-no-scrollbar">
              {history.map((snap, idx) => {
                const isActive = idx === historyIndex;
                return (
                  <button
                    key={idx}
                    onClick={() => jumpToHistoryIndex(idx)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all border ${
                      isActive
                        ? 'bg-amber-500/10 border-amber-500 text-amber-400 font-medium'
                        : 'bg-white/5 border-transparent text-white/70 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <span className="text-xs truncate block text-white font-medium">{snap.label || 'Action'}</span>
                      <span className="text-[10px] text-white/40 block mt-0.5 font-mono">
                        {idx === 0 ? 'Base State' : `Step ${idx}`}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <Move3D className="w-10 h-10 text-white/20 mb-3" />
              <p className="text-sm font-medium text-white/80">No clip selected</p>
              <p className="text-xs text-white/40 mt-1">Tap a clip on the timeline to edit its properties</p>
            </div>
          )}
        </div>
      );
    }
    return (
      <div className="h-full flex flex-col bg-[#252525] border-l border-[#3e3e3e]">"""

code = re.sub(not_selected_clip_pattern, not_selected_clip_replacement, code, count=1)

# 6. Update Main Return Header
main_header_pattern = r"return \(\s*<div className=\"h-full flex flex-col bg-\[#252525\] border-l border-\[#3e3e3e\]\">\s*\{/\* Tabs \*/\}\s*<div className=\"flex overflow-x-auto border-b border-\[#3e3e3e\]"

main_header_replacement = """return (
    <div className={`h-full flex flex-col ${isMobileView ? 'bg-[#121215] text-white' : 'bg-[#252525] border-l border-[#3e3e3e]'}`}>
      {isMobileView ? (
        <>
          {/* Mobile Header */}
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 shrink-0 bg-[#121215]">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold capitalize text-white">
                {tabs.find(t => t.id === activePropertiesTab)?.label || activePropertiesTab}
              </span>
              {selectedClip && (
                <span className="text-[11px] text-white/40 truncate max-w-[150px]">
                  ({selectedClip.name || selectedTrack?.name || 'Clip'})
                </span>
              )}
            </div>
            {onMobileClose && (
              <button
                onClick={onMobileClose}
                className="rounded-full bg-white/5 p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Mobile Sub-Tabs Horizontal Pill Rail */}
          {currentSubTabs.length > 1 && (
            <div className="border-b border-white/10 overflow-x-auto no-scrollbar touch-pan-x bg-[#17171c] shrink-0">
              <div className="flex px-3 py-2 gap-1.5">
                {currentSubTabs.map((st) => (
                  <button
                    key={st.id}
                    onClick={() => setMobileSubTab(st.id)}
                    className={`flex-shrink-0 whitespace-nowrap px-3.5 py-1.5 text-xs font-medium rounded-full transition-colors ${
                      effectiveSubTab === st.id
                        ? 'bg-amber-500 text-black font-semibold shadow-sm'
                        : 'text-white/70 hover:text-white bg-white/5 active:bg-white/10'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          {/* Tabs */}
          <div className=\"flex overflow-x-auto border-b border-[#3e3e3e]"""

code = re.sub(main_header_pattern, main_header_replacement, code, count=1)
code = code.replace("{/* Properties Content */}", "</>\n      )}\n\n      {/* Properties Content */}")

# 7. Add isSectionActive to section cards:
# Transform:
code = code.replace(
    "{/* Smart Reframe AI */}\n              <div className=\"bg-[#1e1e1e] p-3 rounded border border-cyan-500/30",
    "{/* Smart Reframe AI */}\n              <div className={`bg-[#1e1e1e] p-3 rounded border border-cyan-500/30 ${!isSectionActive('reframe') ? 'hidden' : ''}`}"
)
code = code.replace(
    "{/* Master Keyframes */}\n              <div className=\"bg-[#2d2d2d] rounded border border-[#3e3e3e] p-2.5\">",
    "{/* Master Keyframes */}\n              <div className={`bg-[#2d2d2d] rounded border border-[#3e3e3e] p-2.5 ${!isSectionActive('keyframes') ? 'hidden' : ''}`}>\n"
)
code = code.replace(
    "{/* Position */}\n              <div className=\"bg-[#2d2d2d] rounded border border-[#3e3e3e]\">\n                <button\n                  onClick={() => toggleSection('position')}",
    "{/* Position */}\n              <div className={`bg-[#2d2d2d] rounded border border-[#3e3e3e] ${!isSectionActive('position') ? 'hidden' : ''}`}>\n                <button\n                  onClick={() => toggleSection('position')}"
)
code = code.replace(
    "{/* Scale */}\n              <div className=\"bg-[#2d2d2d] rounded border border-[#3e3e3e]\">\n                <button\n                  onClick={() => toggleSection('scale')}",
    "{/* Scale */}\n              <div className={`bg-[#2d2d2d] rounded border border-[#3e3e3e] ${!isSectionActive('scale') ? 'hidden' : ''}`}>\n                <button\n                  onClick={() => toggleSection('scale')}"
)
code = code.replace(
    "{/* Rotation */}\n              <div className=\"bg-[#2d2d2d] rounded border border-[#3e3e3e]\">\n                <button\n                  onClick={() => toggleSection('rotation')}",
    "{/* Rotation */}\n              <div className={`bg-[#2d2d2d] rounded border border-[#3e3e3e] ${!isSectionActive('rotation') ? 'hidden' : ''}`}>\n                <button\n                  onClick={() => toggleSection('rotation')}"
)
code = code.replace(
    "{/* Opacity */}\n              <div className=\"bg-[#2d2d2d] rounded border border-[#3e3e3e]\">\n                <button\n                  onClick={() => toggleSection('opacity')}",
    "{/* Opacity */}\n              <div className={`bg-[#2d2d2d] rounded border border-[#3e3e3e] ${!isSectionActive('opacity') ? 'hidden' : ''}`}>\n                <button\n                  onClick={() => toggleSection('opacity')}"
)
code = code.replace(
    "{/* Blend Mode */}\n            <div className=\"bg-[#2d2d2d] rounded border border-[#3e3e3e]\">\n              <button\n                onClick={() => toggleSection('blendMode')}",
    "{/* Blend Mode */}\n            <div className={`bg-[#2d2d2d] rounded border border-[#3e3e3e] ${!isSectionActive('blendMode') ? 'hidden' : ''}`}>\n              <button\n                onClick={() => toggleSection('blendMode')}"
)
code = code.replace(
    "<div className=\"bg-[#2d2d2d] rounded border border-[#3e3e3e]\">\n                <button\n                  onClick={() => toggleSection('flip')}",
    "<div className={`bg-[#2d2d2d] rounded border border-[#3e3e3e] ${!isSectionActive('flip') ? 'hidden' : ''}`}>\n                <button\n                  onClick={() => toggleSection('flip')}"
)
code = code.replace(
    "{/* Perspective Warp & Motion Tracking */}\n            <div className=\"bg-[#2d2d2d] rounded border border-[#3e3e3e]\">\n              <button\n                onClick={() => toggleSection('perspective')}",
    "{/* Perspective Warp & Motion Tracking */}\n            <div className={`bg-[#2d2d2d] rounded border border-[#3e3e3e] ${!isSectionActive('perspective') ? 'hidden' : ''}`}>\n              <button\n                onClick={() => toggleSection('perspective')}"
)
code = code.replace(
    "{/* Crop */}\n            <div className=\"bg-[#2d2d2d] rounded border border-[#3e3e3e]\">\n              <button\n                onClick={() => toggleSection('crop')}",
    "{/* Crop */}\n            <div className={`bg-[#2d2d2d] rounded border border-[#3e3e3e] ${!isSectionActive('crop') ? 'hidden' : ''}`}>\n              <button\n                onClick={() => toggleSection('crop')}"
)
code = code.replace(
    "<div className=\"bg-[#2d2d2d] rounded border border-[#3e3e3e]\">\n                    <button\n                      onClick={() => toggleSection('kenBurns')}",
    "<div className={`bg-[#2d2d2d] rounded border border-[#3e3e3e] ${!isSectionActive('kenBurns') ? 'hidden' : ''}`}>\n                    <button\n                      onClick={() => toggleSection('kenBurns')}"
)
code = code.replace(
    "const renderKeyingAndAiSection = () => (\n    <div className=\"space-y-3\">",
    "const renderKeyingAndAiSection = () => (\n    <div className={`space-y-3 ${!isSectionActive('keying') ? 'hidden' : ''}`}>\n"
)

# Color:
code = code.replace(
    "{/* Basic Correction Section */}\n            <div className=\"bg-[#2d2d2d] rounded border border-[#3e3e3e]\">\n              <button\n                onClick={() => toggleSection('colorBasic')}",
    "{/* Basic Correction Section */}\n            <div className={`bg-[#2d2d2d] rounded border border-[#3e3e3e] ${!isSectionActive('colorBasic') ? 'hidden' : ''}`}>\n              <button\n                onClick={() => toggleSection('colorBasic')}"
)
code = code.replace(
    "{/* Creative Section */}\n            <div className=\"bg-[#2d2d2d] rounded border border-[#3e3e3e]\">\n              <button\n                onClick={() => toggleSection('colorCreative')}",
    "{/* Creative Section */}\n            <div className={`bg-[#2d2d2d] rounded border border-[#3e3e3e] ${!isSectionActive('colorCreative') ? 'hidden' : ''}`}>\n              <button\n                onClick={() => toggleSection('colorCreative')}"
)
code = code.replace(
    "{/* 3-Way Color Wheels */}\n            <div className=\"bg-[#2d2d2d] rounded border border-[#3e3e3e]\">\n              <button\n                onClick={() => toggleSection('colorWheels')}",
    "{/* 3-Way Color Wheels */}\n            <div className={`bg-[#2d2d2d] rounded border border-[#3e3e3e] ${!isSectionActive('colorWheels') ? 'hidden' : ''}`}>\n              <button\n                onClick={() => toggleSection('colorWheels')}"
)
code = code.replace(
    "{/* LUT Color Grade */}\n            <div className=\"bg-[#2d2d2d] rounded border border-[#3e3e3e]\">\n              <button\n                onClick={() => toggleSection('lutGrade')}",
    "{/* LUT Color Grade */}\n            <div className={`bg-[#2d2d2d] rounded border border-[#3e3e3e] ${!isSectionActive('lutGrade') ? 'hidden' : ''}`}>\n              <button\n                onClick={() => toggleSection('lutGrade')}"
)

# Audio:
code = code.replace(
    "{/* AI Auto Audio Ducking */}\n            <div className=\"bg-[#1e1e1e] p-3 rounded border border-purple-500/30 mb-3 shadow-lg shadow-purple-900/20\">",
    "{/* AI Auto Audio Ducking */}\n            <div className={`bg-[#1e1e1e] p-3 rounded border border-purple-500/30 mb-3 shadow-lg shadow-purple-900/20 ${!isSectionActive('audioDucking') ? 'hidden' : ''}`}>\n"
)
code = code.replace(
    "{/* AI Sound Designer */}\n            <div className=\"bg-[#1e1e1e] p-3 rounded border border-indigo-500/30 mb-3 shadow-lg shadow-indigo-900/20\">",
    "{/* AI Sound Designer */}\n            <div className={`bg-[#1e1e1e] p-3 rounded border border-indigo-500/30 mb-3 shadow-lg shadow-indigo-900/20 ${!isSectionActive('soundDesign') ? 'hidden' : ''}`}>\n"
)
code = code.replace(
    "{/* Clip Volume & Pan */}\n            <div className=\"bg-[#2d2d2d] rounded border border-[#3e3e3e]\">\n              <button\n                onClick={() => toggleSection('audioVolume')}",
    "{/* Clip Volume & Pan */}\n            <div className={`bg-[#2d2d2d] rounded border border-[#3e3e3e] ${!isSectionActive('audioVolume') ? 'hidden' : ''}`}>\n              <button\n                onClick={() => toggleSection('audioVolume')}"
)
code = code.replace(
    "{/* Vocal Tune & Character */}\n            <div className=\"bg-[#2d2d2d] rounded border border-[#3e3e3e]\">\n              <button\n                onClick={() => toggleSection('audioVocalTune')}",
    "{/* Vocal Tune & Character */}\n            <div className={`bg-[#2d2d2d] rounded border border-[#3e3e3e] ${!isSectionActive('audioVocalTune') ? 'hidden' : ''}`}>\n              <button\n                onClick={() => toggleSection('audioVocalTune')}"
)
code = code.replace(
    "{/* Audio Fades */}\n            <div className=\"bg-[#2d2d2d] rounded border border-[#3e3e3e]\">\n              <button\n                onClick={() => toggleSection('audioFades')}",
    "{/* Audio Fades */}\n            <div className={`bg-[#2d2d2d] rounded border border-[#3e3e3e] ${!isSectionActive('audioFades') ? 'hidden' : ''}`}>\n              <button\n                onClick={() => toggleSection('audioFades')}"
)
code = code.replace(
    "{/* AI Audio Enhancements */}\n            <div className=\"bg-[#2d2d2d] rounded border border-[#3e3e3e]\">\n              <button\n                onClick={() => toggleSection('audioEnhancements')}",
    "{/* AI Audio Enhancements */}\n            <div className={`bg-[#2d2d2d] rounded border border-[#3e3e3e] ${!isSectionActive('audioEnhancements') ? 'hidden' : ''}`}>\n              <button\n                onClick={() => toggleSection('audioEnhancements')}"
)
code = code.replace(
    "{/* Equalizer (EQ) */}\n            <div className=\"bg-[#2d2d2d] rounded border border-[#3e3e3e]\">\n              <button\n                onClick={() => toggleSection('audioEQ')}",
    "{/* Equalizer (EQ) */}\n            <div className={`bg-[#2d2d2d] rounded border border-[#3e3e3e] ${!isSectionActive('audioEQ') ? 'hidden' : ''}`}>\n              <button\n                onClick={() => toggleSection('audioEQ')}"
)
code = code.replace(
    "{/* AI Vocal / BGM Separation */}\n            <div className=\"bg-[#2d2d2d] rounded border border-[#3e3e3e]\">\n              <button\n                onClick={() => toggleSection('aiVocalSeparation')}",
    "{/* AI Vocal / BGM Separation */}\n            <div className={`bg-[#2d2d2d] rounded border border-[#3e3e3e] ${!isSectionActive('aiVocalSeparation') ? 'hidden' : ''}`}>\n              <button\n                onClick={() => toggleSection('aiVocalSeparation')}"
)
code = code.replace(
    "{/* Speed Pitch Settings */}\n            <div className=\"bg-[#2d2d2d] rounded border border-[#3e3e3e]\">\n              <button\n                onClick={() => toggleSection('audioSpeedPitch')}",
    "{/* Speed Pitch Settings */}\n            <div className={`bg-[#2d2d2d] rounded border border-[#3e3e3e] ${!isSectionActive('audioSpeedPitch') ? 'hidden' : ''}`}>\n              <button\n                onClick={() => toggleSection('audioSpeedPitch')}"
)

# Speed:
code = code.replace(
    "{/* Speed range input */}\n          <div className=\"bg-[#2d2d2d] rounded border border-[#3e3e3e] p-2.5\">",
    "{/* Speed range input */}\n          <div className={`bg-[#2d2d2d] rounded border border-[#3e3e3e] p-2.5 ${!isSectionActive('speed') ? 'hidden' : ''}`}>\n"
)
code = code.replace(
    "{/* Speed Ramping Toggle & Editor */}\n          <div className=\"bg-[#2d2d2d] rounded border border-[#3e3e3e] p-2.5\">",
    "{/* Speed Ramping Toggle & Editor */}\n          <div className={`bg-[#2d2d2d] rounded border border-[#3e3e3e] p-2.5 ${(!isSectionActive('ramping') && !isSectionActive('presets')) ? 'hidden' : ''}`}>\n"
)

# Effects / AI:
code = code.replace(
    "{/* AI Kinetic Typography */}\n            <KineticTypographySection selectedClip={selectedClip} />",
    "{/* AI Kinetic Typography */}\n            <div className={!isSectionActive('kinetic') ? 'hidden' : ''}><KineticTypographySection selectedClip={selectedClip} /></div>"
)
code = code.replace(
    "{/* Auto Beat Sync & Rhythm Detection */}\n            <BeatSyncSection selectedClip={selectedClip} />",
    "{/* Auto Beat Sync & Rhythm Detection */}\n            <div className={!isSectionActive('beatsync') ? 'hidden' : ''}><BeatSyncSection selectedClip={selectedClip} /></div>"
)
code = code.replace(
    "{/* AI Sound Designer & SFX Generator */}\n            <AISFXSection selectedClip={selectedClip} />",
    "{/* AI Sound Designer & SFX Generator */}\n            <div className={!isSectionActive('sfx') ? 'hidden' : ''}><AISFXSection selectedClip={selectedClip} /></div>"
)
code = code.replace(
    "{/* AI Text & Motion Graphics */}\n            <AIMotionGraphicsSection selectedClip={selectedClip} />",
    "{/* AI Text & Motion Graphics */}\n            <div className={!isSectionActive('designer') ? 'hidden' : ''}><AIMotionGraphicsSection selectedClip={selectedClip} /></div>"
)
code = code.replace(
    "<ObjectRemovalPanel selectedClip={selectedClip} />",
    "<div className={!isSectionActive('motion') ? 'hidden' : ''}><ObjectRemovalPanel selectedClip={selectedClip} /></div>"
)
code = code.replace(
    "<MotionEffectsPanel selectedClip={selectedClip} videoElements={videoElements} />",
    "<div className={!isSectionActive('motion') ? 'hidden' : ''}><MotionEffectsPanel selectedClip={selectedClip} videoElements={videoElements} /></div>"
)

with open('src/components/properties/PropertiesPanel.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

print("Applied perfect transformation!")
