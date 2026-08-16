import type { TimelineClip } from '@/types';
import { useEditorStore } from '@/store/editorStore';
import { Sparkles } from 'lucide-react';
import { cleanupClipBackgroundState } from '@/utils/aiBackground';

interface EffectsListSectionProps {
  selectedClip: TimelineClip;
}

interface ActiveEffectItem {
  id: string;
  name: string;
  onRemove: () => void;
}

export function EffectsListSection({ selectedClip }: EffectsListSectionProps) {
  const updateClip = useEditorStore((state) => state.updateClip);

  const activeEffects: ActiveEffectItem[] = [];

  // 1. Chroma Key
  if (selectedClip.chromaKey?.enabled) {
    activeEffects.push({
      id: 'chroma-key',
      name: 'Chroma Key (Green Screen)',
      onRemove: () => {
        updateClip(selectedClip.id, {
          chromaKey: { ...selectedClip.chromaKey!, enabled: false }
        });
      }
    });
  }

  // 1b. Motion-tracked region effects
  (selectedClip.motionEffects ?? []).forEach((me: any, i: number) => {
    if (!me?.enabled) return;
    activeEffects.push({
      id: `motion-fx-${i}`,
      name: `Motion: ${me.type} (region ${i + 1})`,
      onRemove: () => {
        const next = (selectedClip.motionEffects ?? []).filter((_: any, j: number) => j !== i);
        updateClip(selectedClip.id, { motionEffects: next } as any);
      },
    });
  });

  // 2. Luma Key
  if (selectedClip.lumaKey?.enabled) {
    activeEffects.push({
      id: 'luma-key',
      name: 'Luma Key (Luminance)',
      onRemove: () => {
        updateClip(selectedClip.id, {
          lumaKey: { ...selectedClip.lumaKey!, enabled: false }
        });
      }
    });
  }

  // 3. AI Background Removal
  if (selectedClip.aiBackground?.enabled) {
    activeEffects.push({
      id: 'ai-background',
      name: 'AI Background Removal',
      onRemove: () => {
        updateClip(selectedClip.id, {
          aiBackground: { ...selectedClip.aiBackground!, enabled: false }
        });
        cleanupClipBackgroundState(selectedClip.id);
      }
    });
  }

  // 4. AI Object Removal / Inpainting
  if (selectedClip.objectRemoval?.enabled) {
    activeEffects.push({
      id: 'object-removal',
      name: `AI Object Removal (${selectedClip.objectRemoval.mode.replace(/_/g, ' ')})`,
      onRemove: () => {
        updateClip(selectedClip.id, {
          objectRemoval: { ...selectedClip.objectRemoval!, enabled: false }
        });
      }
    });
  }

  // 5. Visual FX (Action / Stylize)
  if (selectedClip.fxSettings && selectedClip.fxSettings.type !== 'none') {
    activeEffects.push({
      id: 'fx-settings',
      name: `Visual FX (${selectedClip.fxSettings.type.replace(/_/g, ' ')})`,
      onRemove: () => {
        updateClip(selectedClip.id, {
          fxSettings: undefined
        });
      }
    });
  }

  // 6. Legacy array effects
  if (selectedClip.effects && selectedClip.effects.length > 0) {
    selectedClip.effects.forEach((eff: any, idx: number) => {
      activeEffects.push({
        id: `legacy-eff-${idx}`,
        name: eff.name || `Custom Effect #${idx + 1}`,
        onRemove: () => {
          const updated = (selectedClip.effects || []).filter((_: any, i: number) => i !== idx);
          updateClip(selectedClip.id, { effects: updated });
        }
      });
    });
  }

  const handleClearAll = () => {
    if (selectedClip.aiBackground?.enabled) {
      cleanupClipBackgroundState(selectedClip.id);
    }
    updateClip(selectedClip.id, {
      ...(selectedClip.chromaKey ? { chromaKey: { ...selectedClip.chromaKey, enabled: false } } : {}),
      ...(selectedClip.lumaKey ? { lumaKey: { ...selectedClip.lumaKey, enabled: false } } : {}),
      ...(selectedClip.aiBackground ? { aiBackground: { ...selectedClip.aiBackground, enabled: false } } : {}),
      ...(selectedClip.objectRemoval ? { objectRemoval: { ...selectedClip.objectRemoval, enabled: false } } : {}),
      fxSettings: undefined,
      effects: []
    });
  };

  return (
    <div className="bg-[#2d2d2d] rounded border border-[#3e3e3e] p-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-[11px] font-semibold text-white">Active Effects ({activeEffects.length})</h4>
        {activeEffects.length > 0 && (
          <button
            onClick={handleClearAll}
            className="text-[10px] text-amber-400 hover:text-amber-300 font-medium transition-colors"
          >
            Clear All
          </button>
        )}
      </div>
      {activeEffects.length > 0 ? (
        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
          {activeEffects.map((item) => (
            <div key={item.id} className="flex items-center justify-between bg-[#1e1e1e] px-2.5 py-1.5 rounded border border-[#3e3e3e]/60">
              <span className="text-[11px] text-[#e0e0e0] capitalize truncate max-w-[180px]">{item.name}</span>
              <button
                onClick={item.onRemove}
                className="text-red-400 hover:text-red-300 text-[10px] font-semibold transition-colors shrink-0 ml-2"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-6 border border-dashed border-[#3e3e3e] rounded bg-gradient-to-b from-[#1a1a1a]/40 to-transparent">
          <Sparkles className="w-6 h-6 text-[#3a3a3a] mb-2" />
          <p className="text-[11px] text-[#808080] text-center">
            No active effects applied to this clip
          </p>
          <p className="text-[9px] text-[#5a5a5a] text-center mt-1">
            Add chroma key, object removal, or color filters below
          </p>
        </div>
      )}
    </div>
  );
}