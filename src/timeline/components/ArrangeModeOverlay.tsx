// -----------------------------------------------------------------------------
// [MOBILE SYNC] Desktop feature — it has a MOBILE counterpart.
// Rule: if an update changes LOGIC, changes ARCHITECTURE, or FIXES A BUG, apply
// the same change to the mobile file(s) below. SKIP if the update is UI-only.
// Mobile counterpart:
//   src/mobile/components/MobileTimeline.tsx (uses this same component)
// -----------------------------------------------------------------------------

import React, 
      <div className="absolute bottom-4 left-4 z-[99999] bg-black/80 text-green-400 font-mono text-[10px] p-2 rounded pointer-events-none w-[350px] max-h-[300px] overflow-hidden flex flex-col-reverse opacity-90 border border-green-500/30">
        {DEBUG_LOGS.map((log, i) => <div key={i}>{log}</div>)}
      </div>

      {/* ── Top Header Toolbar ─────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-2.5 bg-[#161622] border-b border-white/10 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-400 font-bold text-xs shadow-sm">
            <LayoutGrid className="w-4 h-4" />
            <span>Arrange Mode</span>
          </div>
          <span className="hidden md:inline text-xs text-white/60">Drag cards to reorder • Gaps shown • Select to preview</span>
        </div>
        <div className="flex items-center gap-1.5 bg-black/50 px-2.5 py-1 rounded-lg border border-white/10">
          <SlidersHorizontal className="w-3.5 h-3.5 text-white/50 mr-1" />
          <span className="text-[10px] text-white/60 uppercase font-bold mr-1">SIZE:</span>
          {(['small', 'medium', 'large'] as ThumbSize[]).map((size) => (
            <button key={size} onClick={() => setThumbSize(size)}
              className={`px-3 py-0.5 rounded text-xs font-semibold capitalize transition-all ${
                thumbSize === size ? 'bg-amber-400 text-black shadow-sm' : 'text-white/70 hover:text-white hover:bg-white/10'
              }`}
            >{size}</button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleCancel} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white/70 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 active:scale-95 font-medium">
            <X className="w-3.5 h-3.5" /> Cancel
          </button>
          <button onClick={handleDone} className="flex items-center gap-1.5 px-4 py-1.5 text-xs text-black font-bold bg-amber-400 hover:bg-amber-300 rounded-lg shadow-md active:scale-95">
            <Check className="w-4 h-4" /> Done
          </button>
        </div>
      </div>

      {/* ── Main Track Lanes Container ─────────────────────────────────── */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden p-3.5 flex flex-col gap-3.5 bg-[#0c0c11] min-h-0"
        style={{ scrollbarWidth: 'thin' }}
        onClick={() => setSelectedClipId(null)}
      >
        {draftTracks.map((track) => (
          <LinearTrackRow key={track.id} track={track}
            sortedClips={sortedClipsPerTrack.get(track.id) ?? []}
            mediaMap={mediaMap} selectedClipId={selectedClipId} draggingClipId={draggingClipId}
            isOverThisTrack={hoverTrackId === track.id}
            insertSlotIndex={hoverTrackId === track.id ? insertSlotIndex : null}
            previewingClipId={previewingClipId} sizeConfig={sizeConfig}
            onCardPointerDown={onCardPointerDown}
            onSelectClip={(id) => {
              setSelectedClipId(id);
              const c = draftTracks.flatMap((t) => t.clips).find((cl) => cl.id === id);
              if (c) seek(c.startTime);
            }}
            onPreviewPlay={handlePreviewPlay} onPreviewStop={handlePreviewStop}
          />
        ))}
        {draftTracks.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center py-16 text-white/30 text-sm gap-2">
            <LayoutGrid className="w-8 h-8 opacity-30" />
            <span>No tracks found in timeline</span>
          </div>
        )}
      </div>

      {/* ── Floating Drag Proxy ─────────────────────────────────────────── */}
      {draggingClip && (
        <div
          className="fixed pointer-events-none z-[9999] rounded-lg shadow-2xl border-2 border-amber-400 bg-[#161622] rotate-2 scale-105 opacity-95 flex flex-col overflow-hidden"
          style={{
            left: dragPointerPos.x - sizeConfig.cardWidth / 2,
            top: dragPointerPos.y - sizeConfig.cardHeight / 2,
            width: sizeConfig.cardWidth,
            height: sizeConfig.cardHeight,
          }}
        >
          <div className="w-full bg-black/60 flex items-center justify-center overflow-hidden" style={{ height: sizeConfig.thumbHeight }}>
            {draggingMedia?.thumbnail ? (
              <img src={draggingMedia.thumbnail} alt="" className="w-full h-full object-cover" />
            ) : <Film className="w-6 h-6 text-amber-400" />}
          </div>
          <div className="p-1.5 bg-[#161622] flex flex-col justify-center border-t border-white/10">
            <span className={`font-bold text-white truncate ${sizeConfig.nameFontSize}`}>{draggingMedia?.name || 'Clip'}</span>
            <span className={`text-amber-400 font-mono font-semibold ${sizeConfig.durFontSize}`}>{draggingClip.duration.toFixed(1)}s</span>
          </div>
        </div>
      )}
    </div>
  );
}
