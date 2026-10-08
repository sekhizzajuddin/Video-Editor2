import { describe, it, expect } from 'vitest';
import { WORKSPACE_PRESETS, getPresetLayout } from '@/utils/workspacePresets';

describe('CapCut Layout & Sub-Tabs Configuration', () => {
  it('has CapCut-proportioned extra-wide side panels in default Editing preset', () => {
    const editingPreset = WORKSPACE_PRESETS.find(p => p.id === 'Editing');
    expect(editingPreset).toBeDefined();
    expect(editingPreset!.leftWidth).toBeGreaterThanOrEqual(340);
    expect(editingPreset!.rightWidth).toBeGreaterThanOrEqual(360);
    expect(editingPreset!.timelineHeight).toBe(300);
  });

  it('provides extra-wide fallback layout for Editing', () => {
    const layout = getPresetLayout('Editing');
    expect(layout.leftWidth).toBe(350);
    expect(layout.rightWidth).toBe(380);
    expect(layout.timelineHeight).toBe(300);
  });
});
