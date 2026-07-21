import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Focus } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { FeatureProps } from './types';

export const PerspectiveWarpFeature = ({ clip }: FeatureProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const updateClip = useEditorStore((state) => state.updateClip);
  const transform = clip.transform || {};

  const handleToggle = (enabled: boolean) => {
    let updates: any = {
      transform: {
        ...transform,
        perspectivePin: enabled
      }
    };
    if (enabled && !transform.perspectiveCorners) {
      // Initialize default corners based on current center & scale if not exists
      const aX = transform.x || 0;
      const aY = transform.y || 0;
      const w = (clip as any).width || 854;
      const h = (clip as any).height || 480;
      const scale = (transform.scale || 100) / 100;
      const cx = 854 / 2 + aX;
      const cy = 480 / 2 + aY;
      const w2 = (w * scale) / 2;
      const h2 = (h * scale) / 2;
      updates.transform.perspectiveCorners = {
        x0: cx - w2, y0: cy - h2,
        x1: cx + w2, y1: cy - h2,
        x2: cx + w2, y2: cy + h2,
        x3: cx - w2, y3: cy + h2,
      };
    }
    updateClip(clip.id, updates);
    useEditorStore.getState().saveSnapshot();
  };

  const handleReset = () => {
    // Clear animations on corners if they exist
    const newAnimations = { ...(clip.animations || {}) };
    for (let i = 0; i < 4; i++) {
      delete newAnimations[`transform.perspectiveCorners.x${i}`];
      delete newAnimations[`transform.perspectiveCorners.y${i}`];
    }
    const aX = transform.x || 0;
    const aY = transform.y || 0;
    const w = (clip as any).width || 854;
    const h = (clip as any).height || 480;
    const scale = (transform.scale || 100) / 100;
    const cx = 854 / 2 + aX;
    const cy = 480 / 2 + aY;
    const w2 = (w * scale) / 2;
    const h2 = (h * scale) / 2;
    const defaultCorners = {
      x0: cx - w2, y0: cy - h2,
      x1: cx + w2, y1: cy - h2,
      x2: cx + w2, y2: cy + h2,
      x3: cx - w2, y3: cy + h2,
    };
    updateClip(clip.id, {
      animations: newAnimations,
      transform: {
        ...transform,
        perspectiveCorners: defaultCorners
      }
    });
    useEditorStore.getState().saveSnapshot();
  };

  return (
    <div className="bg-[#2d2d2d] rounded border border-[#3e3e3e] mt-3">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-2.5 text-xs text-white group"
      >
        <div className="flex items-center gap-1.5 font-medium">
          <Focus className="w-3.5 h-3.5 text-blue-400" />
          <span>Perspective Warp & Tracker</span>
        </div>
        {isExpanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-[#a0a0a0]" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-[#a0a0a0]" />
        )}
      </button>

      {isExpanded && (
        <div className="px-2.5 pb-2.5 space-y-3 pt-2">
          <label className="flex items-center gap-2 cursor-pointer mt-1">
            <input
              type="checkbox"
              checked={!!transform.perspectivePin}
              onChange={(e) => handleToggle(e.target.checked)}
              className="rounded border-[#3e3e3e] text-blue-500 bg-[#1e1e1e] focus:ring-0 focus:ring-offset-0"
            />
            <span className="text-xs text-white">Enable Corner Pinning</span>
          </label>

          {transform.perspectivePin && (
            <div className="pt-2 border-t border-[#3e3e3e] space-y-2">
              <p className="text-[10px] text-[#a0a0a0]">
                Drag the 4 corner handles on the preview screen to adjust the perspective warp.
              </p>
              <button
                onClick={handleReset}
                className="w-full py-1.5 text-[10px] font-semibold text-black bg-[#d0d0d0] hover:bg-white rounded transition-colors"
              >
                Reset Corners to Bounds
              </button>
              
              <div className="bg-[#1e1e1e] border border-[#3e3e3e]/50 rounded p-2 mt-2">
                <span className="text-[10px] text-blue-400 font-semibold block mb-1">Track Background Motion (Auto)</span>
                <p className="text-[9px] text-[#6a6a6a]">Select a background layer in the timeline to automatically pin and track these corners over time (AI Tracker required).</p>
                <button disabled className="mt-2 w-full py-1.5 text-[10px] font-semibold text-[#6a6a6a] bg-[#2a2a2a] rounded cursor-not-allowed border border-[#3e3e3e]">
                  Auto-Track (Coming Soon)
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
