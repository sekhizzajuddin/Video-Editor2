import re

with open('src/components/properties/PropertiesPanel.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Let us update !selectedClip block
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

# Let us update Main Header / Tabs
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

# Close the desktop header ternary before `{/* Properties Content */}`
code = code.replace("{/* Properties Content */}", "</>\n      )}\n\n      {/* Properties Content */}")

with open('src/components/properties/PropertiesPanel.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

print("Step 2 completed successfully!")
