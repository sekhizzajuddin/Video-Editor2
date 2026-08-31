import type { TimelineClip } from '@/types';
import { useEditorStore } from '@/store/editorStore';
import React, { useState, useEffect, useRef } from 'react';
import { KeyframeIcon } from '../../KeyframeIcon';

interface ChromaKeySectionProps {
  selectedClip: TimelineClip;
}

const PRESETS = [
  { label: 'Green', hex: '#00ff00' },
  { label: 'Blue', hex: '#0000ff' },
  { label: 'Red', hex: '#ff0000' },
];

const EyedropperIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m2 22 1-1h3l9-9"/>
    <path d="M3 21v-3l9-9"/>
    <path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z"/>
  </svg>
);

export function ChromaKeySection({ selectedClip }: ChromaKeySectionProps) {
  const updateClip = useEditorStore((state) => state.updateClip);
  const saveSnapshot = useEditorStore((state) => state.saveSnapshot);
  const currentTime = useEditorStore((state) => state.currentTime);

  const chromaKey = selectedClip.chromaKey || {
    enabled: false,
    color: '#00ff00',
    threshold: 40,
    softness: 20,
    spillSuppression: 50,
    edgeFeather: 0,
  };

  const update = (patch: Partial<NonNullable<TimelineClip['chromaKey']>>) => {
    updateClip(selectedClip.id, {
      chromaKey: {
        ...chromaKey,
        ...patch,
      },
    });
    saveSnapshot();
  };

  const [isSampling, setIsSampling] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const activateEyedropper = async () => {
    if ('EyeDropper' in window) {
      const dropper = new (window as any).EyeDropper();
      abortControllerRef.current = new AbortController();
      setIsSampling(true);
      try {
        const result = await dropper.open({ signal: abortControllerRef.current.signal });
        handleColorChange(result.sRGBHex);
      } catch (e) {
        // user cancelled
      } finally {
        setIsSampling(false);
      }
    }
  };

  const [customSwatches, setCustomSwatches] = useState<string[]>([]);
  
  useEffect(() => {
    try {
      const stored = localStorage.getItem('procut.chromaKey.swatches');
      if (stored) {
        setCustomSwatches(JSON.parse(stored));
      }
    } catch (e) {}
  }, []);

  const handleColorChange = (hex: string) => {
    update({ color: hex });
    if (!PRESETS.find(p => p.hex.toLowerCase() === hex.toLowerCase())) {
      setCustomSwatches(prev => {
        const next = [hex, ...prev.filter(c => c !== hex)].slice(0, 3);
        localStorage.setItem('procut.chromaKey.swatches', JSON.stringify(next));
        return next;
      });
    }
  };

  type ChromaKeyframeProperty = 'threshold' | 'softness' | 'spillSuppression' | 'edgeFeather';

  const isKeyframed = (property: ChromaKeyframeProperty) => {
    return !!chromaKey.keyframes?.[property];
  };

  const toggleKeyframe = (property: ChromaKeyframeProperty) => {
    const currentKeyframes = chromaKey.keyframes || {};
    if (currentKeyframes[property]) {
      const newKeyframes = { ...currentKeyframes };
      delete newKeyframes[property];
      update({ keyframes: newKeyframes });
    } else {
      update({
        keyframes: {
          ...currentKeyframes,
          [property]: [{ time: currentTime, value: chromaKey[property as keyof typeof chromaKey] as number }]
        }
      });
    }
  };

  return (
    <div className="bg-[var(--theme-bg-card)] rounded-xl border border-[var(--theme-border)] p-3.5 shadow-sm">
      <h4 className="text-[11px] font-bold text-[var(--theme-text-primary)] mb-3">Chroma Key (Green Screen)</h4>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-[var(--theme-text-muted)] font-medium">Enabled</span>
          <button
            onClick={() => update({ enabled: !chromaKey.enabled })}
            className={`w-8 h-4 rounded-full transition-colors relative ${chromaKey.enabled ? 'bg-emerald-500' : 'bg-[var(--theme-bg-subpanel)] border border-[var(--theme-border)]'}`}
          >
            <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform shadow-sm ${chromaKey.enabled ? 'left-[17px]' : 'left-[1px]'}`} />
          </button>
        </div>
        
        {chromaKey.enabled && (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[var(--theme-text-muted)] font-medium">Key Color:</span>
                <div className="flex items-center space-x-2">
                  {typeof window !== 'undefined' && 'EyeDropper' in window && (
                    <button
                      onClick={activateEyedropper}
                      className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${isSampling ? 'bg-emerald-500/20 text-emerald-500' : 'bg-[var(--theme-bg-subpanel)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)] hover:bg-black/5 dark:hover:bg-white/5 border border-[var(--theme-border)]'}`}
                      title="Pick color from screen"
                    >
                      <EyedropperIcon />
                    </button>
                  )}
                  <input
                    type="color"
                    value={chromaKey.color || '#00ff00'}
                    onChange={(e) => handleColorChange(e.target.value)}
                    className="w-8 h-6 rounded cursor-pointer bg-transparent border border-[var(--theme-border)]"
                  />
                </div>
              </div>
              <div className="flex space-x-1.5">
                {PRESETS.map(p => (
                  <button
                    key={p.label}
                    onClick={() => handleColorChange(p.hex)}
                    className="w-6 h-4 rounded border border-[var(--theme-border)] hover:scale-105 transition-all shadow-sm"
                    style={{ backgroundColor: p.hex }}
                    title={p.label}
                  />
                ))}
                {customSwatches.length > 0 && <div className="w-[1px] h-4 bg-[var(--theme-border)] mx-1" />}
                {customSwatches.map((hex, i) => (
                  <button
                    key={`custom-${i}`}
                    onClick={() => handleColorChange(hex)}
                    className="w-6 h-4 rounded border border-[var(--theme-border)] hover:scale-105 transition-all shadow-sm"
                    style={{ backgroundColor: hex }}
                    title="Custom color"
                  />
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center text-[10px] text-[var(--theme-text-muted)]">
                <div className="flex items-center space-x-2">
                  <span className="font-medium">Threshold</span>
                  <KeyframeIcon
                    active={isKeyframed('threshold')}
                    onClick={() => toggleKeyframe('threshold')}
                  />
                </div>
                <span className="font-mono font-medium text-[var(--theme-text-primary)]">{chromaKey.threshold || 40}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={chromaKey.threshold || 40}
                onChange={(e) => update({ threshold: Number(e.target.value) })}
                className="w-full accent-emerald-500 bg-[var(--theme-border)] h-1 rounded-full cursor-pointer"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center text-[10px] text-[var(--theme-text-muted)]">
                <div className="flex items-center space-x-2">
                  <span className="font-medium">Edge Softness</span>
                  <KeyframeIcon
                    active={isKeyframed('softness')}
                    onClick={() => toggleKeyframe('softness')}
                  />
                </div>
                <span className="font-mono font-medium text-[var(--theme-text-primary)]">{chromaKey.softness || 20}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={chromaKey.softness || 20}
                onChange={(e) => update({ softness: Number(e.target.value) })}
                className="w-full accent-emerald-500 bg-[var(--theme-border)] h-1 rounded-full cursor-pointer"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center text-[10px] text-[var(--theme-text-muted)]">
                <div className="flex items-center space-x-2">
                  <span className="font-medium">Spill Suppression</span>
                  <KeyframeIcon
                    active={isKeyframed('spillSuppression')}
                    onClick={() => toggleKeyframe('spillSuppression')}
                  />
                </div>
                <span className="font-mono font-medium text-[var(--theme-text-primary)]">{chromaKey.spillSuppression ?? 50}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={chromaKey.spillSuppression ?? 50}
                onChange={(e) => update({ spillSuppression: Number(e.target.value) })}
                className="w-full accent-emerald-500 bg-[var(--theme-border)] h-1 rounded-full cursor-pointer"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center text-[10px] text-[var(--theme-text-muted)]">
                <div className="flex items-center space-x-2">
                  <span title="0 px = sharp edges, 20 px = heavy feather" className="font-medium">Edge Feather</span>
                  <KeyframeIcon
                    active={isKeyframed('edgeFeather')}
                    onClick={() => toggleKeyframe('edgeFeather')}
                  />
                </div>
                <span className="font-mono font-medium text-[var(--theme-text-primary)]">{chromaKey.edgeFeather ?? 0}px</span>
              </div>
              <input
                type="range"
                min="0"
                max="20"
                step="1"
                value={chromaKey.edgeFeather ?? 0}
                onChange={(e) => update({ edgeFeather: Number(e.target.value) })}
                className="w-full accent-emerald-500 bg-[var(--theme-border)] h-1 rounded-full cursor-pointer"
                title="0 px = sharp edges, 20 px = heavy feather"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}