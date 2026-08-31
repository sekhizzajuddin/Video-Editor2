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
    <div className="bg-[var(--theme-bg-card)] rounded-xl border border-[var(--theme-border)] p-3.5 shadow-sm">
      <div className="flex items-center justify-between mb-2.5">
        <h4 className="text-[11px] font-bold text-[var(--theme-text-primary)]">Active Effects ({activeEffects.length})</h4>
        {activeEffects.length > 0 && (
          <button
            onClick={handleClearAll}
            className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline font-bold transition-colors"
          >
            Clear All
          </button>
        )}
      </div>
      {activeEffects.length > 0 ? (
        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
          {activeEffects.map((item) => (
            <div key={item.id} className="flex items-center justify-between bg-[var(--theme-bg-subpanel)] px-3 py-2 rounded-lg border border-[var(--theme-border)]">
              <span className="text-[11px] text-[var(--theme-text-primary)] font-medium capitalize truncate max-w-[180px]">{item.name}</span>
              <button
                onClick={item.onRemove}
                className="text-rose-500 hover:text-rose-400 text-[10px] font-bold transition-colors shrink-0 ml-2"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-6 border border-dashed border-[var(--theme-border)] rounded-xl bg-[var(--theme-bg-subpanel)]/50">
          <Sparkles className="w-6 h-6 text-[var(--theme-text-muted)] mb-2 opacity-50" />
          <p className="text-[11px] text-[var(--theme-text-muted)] text-center font-medium">
            No active effects applied to this clip
          </p>
          <p className="text-[9px] text-[var(--theme-text-muted)] text-center mt-1 opacity-75">
            Add chroma key, object removal, or color filters below
          </p>
        </div>
      )}
    </div>
  );
}