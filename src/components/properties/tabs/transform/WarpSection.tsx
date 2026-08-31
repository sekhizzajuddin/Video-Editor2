import React from 'react';
import type { TimelineClip } from '@/types';

interface WarpSectionProps {
  clip: TimelineClip;
  updateClip: (id: string, updates: any) => void;
}

export function WarpSection({ clip, updateClip }: WarpSectionProps) {
  return (
    <div className="space-y-4">
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={!!clip.transform.perspectivePin}
          onChange={(e) => {
            const enabled = e.target.checked;
            let updates: any = { transform: { ...clip.transform, perspectivePin: enabled } };
            if (enabled && !clip.transform.perspectiveCorners) {
              const aX = clip.transform.x;
              const aY = clip.transform.y;
              const baseW = 200;
              const baseH = 200;
              updates.transform.perspectiveCorners = {
                x0: 427 + aX - baseW / 2, y0: 240 + aY - baseH / 2,
                x1: 427 + aX + baseW / 2, y1: 240 + aY - baseH / 2,
                x2: 427 + aX + baseW / 2, y2: 240 + aY + baseH / 2,
                x3: 427 + aX - baseW / 2, y3: 240 + aY + baseH / 2
              };
            }
            updateClip(clip.id, updates);
          }}
          className="w-5 h-5 rounded border-border text-amber-500 bg-card"
        />
        <span className="text-sm font-medium text-foreground">Enable Corner Pinning</span>
      </label>
      {clip.transform.perspectivePin && (
        <div className="pt-3 border-t border-border">
          <p className="text-xs text-muted-foreground mb-3">Drag the 4 corner handles on the preview screen to adjust.</p>
          <button
            onClick={() => {
              const newAnimations = { ...(clip.animations || {}) };
              for (let i = 0; i < 4; i++) {
                delete newAnimations[`transform.perspectiveCorners.x${i}`];
                delete newAnimations[`transform.perspectiveCorners.y${i}`];
              }
              const aX = clip.transform.x;
              const aY = clip.transform.y;
              const baseW = 200;
              const baseH = 200;
              updateClip(clip.id, {
                transform: {
                  ...clip.transform,
                  perspectiveCorners: {
                    x0: 427 + aX - baseW / 2, y0: 240 + aY - baseH / 2,
                    x1: 427 + aX + baseW / 2, y1: 240 + aY - baseH / 2,
                    x2: 427 + aX + baseW / 2, y2: 240 + aY + baseH / 2,
                    x3: 427 + aX - baseW / 2, y3: 240 + aY + baseH / 2
                  }
                },
                animations: newAnimations
              });
            }}
            className="w-full py-2 text-xs font-medium text-amber-500 border border-amber-500/30 rounded-lg hover:bg-amber-500/10"
          >
            Reset Corners
          </button>
        </div>
      )}
    </div>
  );
}
