// the same change to the desktop file(s) below. SKIP if the update is UI-only.
// Desktop counterpart:
//   src/components/TopToolbar.tsx
// ─────────────────────────────────────────────────────────────────────────────

import { Undo2, Redo2, Share2, Ratio, Settings2 } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { useShallow } from 'zustand/react/shallow';

export function MobileTopBar() {
  const {
    projectName,
    aspectRatio,
    setAspectRatio,
    undo,
    redo,
    canUndo,
    canRedo,
    setShowExportModal,
    setShowSettingsModal,
  } = useEditorStore(
    useShallow((s) => ({
      projectName: s.projectName,
      aspectRatio: s.aspectRatio,
      setAspectRatio: s.setAspectRatio,
      undo: s.undo,
      redo: s.redo,
      canUndo: s.historyIndex > 0,
      canRedo: s.historyIndex < s.history.length - 1,
      setShowExportModal: s.setShowExportModal,
      setShowSettingsModal: s.setShowSettingsModal,
    }))
  );

  const ratios: Array<'16:9' | '9:16' | '1:1' | '4:3'> = ['16:9', '9:16', '1:1', '4:3'];
  const cycleRatio = () => {
    const idx = ratios.indexOf(aspectRatio);
    setAspectRatio(ratios[(idx + 1) % ratios.length]);
  };

  return (
    <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-white/10 bg-[#16161a] px-2">
      {/* Project title */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold leading-tight text-white">
          {projectName || 'Untitled'}
        </p>
        <p className="truncate text-[10px] text-white/40">ProCut Mobile</p>
      </div>

      <div className="flex items-center gap-1">
        {/* Aspect ratio */}
        <button
          onClick={cycleRatio}
          className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-[12px] font-medium text-white active:bg-white/10"
        >
          <Ratio className="h-3.5 w-3.5 text-amber-400" />
          {aspectRatio}
        </button>

        <button
          onClick={undo}
          disabled={!canUndo}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-white/80 active:bg-white/10 disabled:opacity-30"
        >
          <Undo2 className="h-[18px] w-[18px]" />
        </button>
        <button
          onClick={redo}
          disabled={!canRedo}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-white/80 active:bg-white/10 disabled:opacity-30"
        >
          <Redo2 className="h-[18px] w-[18px]" />
        </button>
        <button
          onClick={() => setShowExportModal(true)}
          className="flex h-8 items-center gap-1 rounded-lg bg-amber-500 px-2.5 text-[12px] font-bold text-black active:bg-amber-400"
        >
          <Share2 className="h-4 w-4" />
          Export
        </button>
        <button
          onClick={() => setShowSettingsModal(true)}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-white/70 active:bg-white/10"
        >
          <Settings2 className="h-[18px] w-[18px]" />
        </button>
      </div>
    </div>
  );
}
