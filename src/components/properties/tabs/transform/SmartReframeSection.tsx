import { useEditorStore } from '@/store/editorStore';
import type { TimelineClip } from '@/types';
import { scheduleSaveSnapshot } from '@/utils/snapshotScheduler';

interface SmartReframeSectionProps {
  selectedClip: TimelineClip;
  updateClip: (clipId: string, updates: any, options?: { ripple?: boolean }) => void;
}

export function SmartReframeSection({ selectedClip, updateClip }: SmartReframeSectionProps) {
  return (
    <div className="bg-[#1e1e1e] p-3 rounded border border-cyan-500/30 mb-3 shadow-lg shadow-cyan-900/20">
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 bg-cyan-500/20 rounded">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 7V5a2 2 0 0 1 2-2h2"/>
            <path d="M17 3h2a2 2 0 0 1 2 2v2"/>
            <path d="M21 17v2a2 2 0 0 1-2 2h-2"/>
            <path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
            <rect width="10" height="14" x="7" y="5" rx="2"/>
          </svg>
        </div>
        <div>
          <h4 className="text-[11px] font-semibold text-white">Smart Reframe</h4>
          <p className="text-[9px] text-[#a0a0a0]">Auto-track subject for 9:16</p>
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
        className="w-full py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-medium transition-colors shadow-md shadow-cyan-950/50"
      >
        Analyze & Track
      </button>
    </div>
  );
}