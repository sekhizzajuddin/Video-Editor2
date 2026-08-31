import { useEditorStore } from '@/store/editorStore';
import type { TimelineClip } from '@/types';
import { scheduleSaveSnapshot } from '@/utils/snapshotScheduler';

interface SmartReframeSectionProps {
  selectedClip: TimelineClip;
  updateClip: (clipId: string, updates: any, options?: { ripple?: boolean }) => void;
}

export function SmartReframeSection({ selectedClip, updateClip }: SmartReframeSectionProps) {
  return (
    <div className="bg-[var(--theme-bg-card)] p-3.5 rounded-xl border border-cyan-500/30 mb-3 shadow-sm">
      <div className="flex items-center gap-2.5 mb-2.5">
        <div className="p-1.5 bg-cyan-500/10 text-cyan-500 rounded-lg">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 7V5a2 2 0 0 1 2-2h2"/>
            <path d="M17 3h2a2 2 0 0 1 2 2v2"/>
            <path d="M21 17v2a2 2 0 0 1-2 2h-2"/>
            <path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
            <rect width="10" height="14" x="7" y="5" rx="2"/>
          </svg>
        </div>
        <div>
          <h4 className="text-[11px] font-bold text-[var(--theme-text-primary)]">Smart Reframe</h4>
          <p className="text-[9px] text-[var(--theme-text-muted)]">Auto-track subject for 9:16</p>
        </div>
      </div>
      <button
        onClick={async () => {
          if (!selectedClip) return;
          const { generateSmartReframeKeyframes } = await import('@/utils/smartReframe');
          const aspect = useEditorStore.getState().aspectRatio;
          const newAnimations = generateSmartReframeKeyframes(selectedClip, aspect as any);
          updateClip(selectedClip.id, { animations: newAnimations });
          scheduleSaveSnapshot('Smart Reframe');
        }}
        className="w-full py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-blue-500/20"
      >
        Analyze & Track
      </button>
    </div>
  );
}