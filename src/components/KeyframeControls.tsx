import React, { useRef, useState, useCallback } from 'react';
import { PropertyKeyframe } from '@/types';
import { useEditorStore, findClipDeep } from '@/store/editorStore';
import { BezierEditorModal } from './BezierEditorModal';

interface KeyframeControlProps {
  propertyKey: string; // e.g., "transform.x"
  value: number;
  keyframes: PropertyKeyframe[];
  currentTime: number; // local clip time
  clipId: string;
  onAddKeyframe: (time: number, value: number) => void;
  onRemoveKeyframe: (time: number) => void;
  onUpdateEasing: (time: number, easing: PropertyKeyframe['easing']) => void;
  onJumpToNext: () => void;
  onJumpToPrev: () => void;
}

export const KeyframeControl: React.FC<KeyframeControlProps> = ({
  propertyKey,
  keyframes,
  currentTime,
  value,
  clipId,
  onAddKeyframe,
  onRemoveKeyframe,
  onUpdateEasing,
  onJumpToNext,
  onJumpToPrev
}) => {
  const [showBezierEditor, setShowBezierEditor] = useState(false);

  // Check if there's a keyframe at current time (within 0.05s tolerance)
  const keyframeIndex = keyframes.findIndex(
    k => Math.abs(k.time - currentTime) < 0.05
  );
  const hasKeyframe = keyframeIndex !== -1;
  const keyframe = hasKeyframe ? keyframes[keyframeIndex] : null;

  // Find next/prev keyframe
  const nextKf = keyframes.find(k => k.time > currentTime + 0.05);
  const prevKf = [...keyframes].reverse().find(k => k.time < currentTime - 0.05);

  const clip = useEditorStore(useCallback(state => {
    const found = findClipDeep(state, clipId);
    return found?.clip;
  }, [clipId]));

  const handleUpdateBezier = useCallback((time: number, newBezier: PropertyKeyframe['bezier']) => {
    if (!clip) return;
    const animations = clip.animations || {};
    const trackKf = animations[propertyKey] || [];
    const newKf = trackKf.map(k => 
      Math.abs(k.time - time) < 0.03 
        ? { ...k, easing: 'bezier' as const, bezier: newBezier } 
        : k
    );
    useEditorStore.getState().updateClip(clipId, {
      animations: { ...animations, [propertyKey]: newKf }
    });
  }, [clip, clipId, propertyKey]);

  return (
    <div className="flex items-center gap-1.5 ml-2">
      {/* Jump to previous */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onJumpToPrev();
        }}
        disabled={!prevKf}
        className="p-0.5 rounded hover:bg-[#3e3e3e] disabled:opacity-20 disabled:cursor-not-allowed transition-colors text-white"
        title="Previous keyframe"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      {/* Keyframe diamond toggle */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (hasKeyframe) {
            onRemoveKeyframe(keyframe!.time);
          } else {
            onAddKeyframe(currentTime, value);
          }
        }}
        className={`relative p-0.5 rounded transition-all ${
          hasKeyframe 
            ? 'text-amber-400 hover:text-amber-300' 
            : 'text-[#555] hover:text-[#888]'
        }`}
        title={hasKeyframe ? 'Remove keyframe' : 'Add keyframe'}
      >
        <svg 
          width="12" 
          height="12" 
          viewBox="0 0 24 24" 
          fill={hasKeyframe ? "currentColor" : "none"} 
          stroke="currentColor" 
          strokeWidth="2"
          style={{ 
            transform: keyframe?.easing === 'hold' ? 'rotate(45deg)' : 'none',
            transition: 'transform 0.15s'
          }}
        >
          <polygon points="12 2 22 12 12 22 2 12 12 2" />
        </svg>
        
        {/* Easing indicator dot */}
        {hasKeyframe && keyframe?.easing === 'bezier' && (
          <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-cyan-400 rounded-full" />
        )}
      </button>

      {/* Jump to next */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onJumpToNext();
        }}
        disabled={!nextKf}
        className="p-0.5 rounded hover:bg-[#3e3e3e] disabled:opacity-20 disabled:cursor-not-allowed transition-colors text-white"
        title="Next keyframe"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>

      {/* Easing dropdown */}
      {hasKeyframe && (
        <div className="flex items-center gap-1">
          <select
            value={keyframe?.easing || 'linear'}
            onChange={(e) => {
              e.stopPropagation();
              const newEasing = e.target.value as PropertyKeyframe['easing'];
              if (newEasing === 'bezier') {
                setShowBezierEditor(true);
              } else {
                onUpdateEasing(keyframe!.time, newEasing);
              }
            }}
            className="bg-[#1e1e1e] border border-[#3e3e3e] text-[9px] text-[#a0a0a0] hover:text-white rounded px-1 outline-none cursor-pointer w-16"
            title="Easing type"
          >
            <option value="linear">Linear</option>
            <option value="easeIn">Ease In</option>
            <option value="easeOut">Ease Out</option>
            <option value="easeInOut">Ease InOut</option>
            <option value="bezier">Bezier</option>
            <option value="hold">Hold</option>
          </select>

          {/* Edit Bezier icon trigger button */}
          {keyframe?.easing === 'bezier' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowBezierEditor(true);
              }}
              className="p-1 rounded bg-[#2a2a2a] hover:bg-[#3e3e3e] text-cyan-400 hover:text-cyan-300 transition-colors"
              title="Edit Bezier Curve"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
            </button>
          )}
        </div>
      )}

      {showBezierEditor && keyframe && (
        <BezierEditorModal
          isOpen={showBezierEditor}
          initialValue={keyframe.bezier || { x: 0.5, y: 0, inX: 0.5, inY: 1 }}
          onClose={() => setShowBezierEditor(false)}
          onApply={(newBezier) => {
            onUpdateEasing(keyframe.time, 'bezier');
            handleUpdateBezier(keyframe.time, newBezier);
          }}
        />
      )}
    </div>
  );
};

interface KeyframeMiniTimelineProps {
  keyframes: PropertyKeyframe[];
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  onSelectKeyframe?: (index: number) => void;
  selectedIndex?: number;
}

export const KeyframeMiniTimeline: React.FC<KeyframeMiniTimelineProps> = ({
  keyframes,
  currentTime,
  duration,
  onSeek,
  onSelectKeyframe,
  selectedIndex
}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  const timeToX = useCallback((time: number) => {
    return (time / duration) * 100;
  }, [duration]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (e.clientX - rect.left) / rect.width;
    onSeek(Math.max(0, Math.min(duration, x * duration)));
  }, [duration, onSeek]);

  if (keyframes.length === 0) return null;

  return (
    <div 
      className="w-full h-5 bg-[#141414] rounded border border-[#2a2a2a] my-1 relative overflow-hidden cursor-pointer" 
      onClick={handleClick}
    >
      <svg ref={svgRef} className="w-full h-full" preserveAspectRatio="none">
        {/* Value curve visualization */}
        <polyline
          fill="none"
          stroke="#2d3748"
          strokeWidth="1.5"
          points={keyframes.map((kf) => {
            const x = timeToX(kf.time);
            return `${x},10`;
          }).join(' ')}
        />

        {/* Keyframe diamonds */}
        {keyframes.map((kf, i) => {
          const x = timeToX(kf.time);
          const isSelected = i === selectedIndex;
          const isNearPlayhead = Math.abs(kf.time - currentTime) < 0.05;

          return (
            <g 
              key={i}
              transform={`translate(${x}%, 10)`}
              onClick={(e) => {
                e.stopPropagation();
                if (onSelectKeyframe) onSelectKeyframe(i);
              }}
              className="cursor-pointer"
            >
              <polygon
                points="0,-3.5 3.5,0 0,3.5 -3.5,0"
                fill={isSelected ? '#f59e0b' : isNearPlayhead ? '#60a5fa' : '#718096'}
                stroke={isSelected ? '#fbbf24' : 'none'}
                strokeWidth={isSelected ? 1.5 : 0}
                transform={kf.easing === 'hold' ? 'rotate(45)' : ''}
              />
              {/* Bezier indicator dot */}
              {kf.easing === 'bezier' && (
                <circle cy={-5} r={1} fill="#22d3ee" />
              )}
            </g>
          );
        })}

        {/* Playhead marker line */}
        <line
          x1={`${timeToX(currentTime)}%`}
          y1={0}
          x2={`${timeToX(currentTime)}%`}
          y2={20}
          stroke="#f56565"
          strokeWidth={1}
        />
      </svg>
    </div>
  );
};
