import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { PipWindow, PipWindowStyle, ClipEnterExitAnimation } from '@/types';
import { ENTER_EXIT_PRESETS } from '@/utils/clipEnterExitEngine';

interface PipTabProps {
  pipWindow: PipWindow;
  pipId: string;
  onStyleChange: (updates: Partial<PipWindowStyle>) => void;
  onEnterExitChange: (updates: Partial<ClipEnterExitAnimation>) => void;
}

const DEFAULT_STYLE: PipWindowStyle = {
  outlineEnabled: false,
  outlineColor: '#ffffff',
  outlineWidth: 3,
  outlineRadius: 8,
  outlineOpacity: 100,
  backgroundEnabled: false,
  backgroundColor: '#000000',
  backgroundOpacity: 50,
  backgroundBlur: 0,
  backgroundPadding: 8,
  shadowEnabled: false,
  shadowColor: '#000000',
  shadowBlur: 10,
  shadowOffsetX: 4,
  shadowOffsetY: 4,
};

const EASING_OPTIONS = [
  { value: 'linear', label: 'Linear' },
  { value: 'easeIn', label: 'Ease In' },
  { value: 'easeOut', label: 'Ease Out' },
  { value: 'easeInOut', label: 'Ease In Out' },
  { value: 'easeOutBack', label: 'Overshoot' },
  { value: 'easeOutElastic', label: 'Elastic' },
  { value: 'easeOutBounce', label: 'Bounce' },
];

export default function PipTab({ pipWindow, pipId, onStyleChange, onEnterExitChange }: PipTabProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    settings: false,
    outline: false,
    background: false,
    shadow: false,
    animation: false,
  });

  const toggleSection = (section: string) => {
    setCollapsed(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const style = { ...DEFAULT_STYLE, ...pipWindow.style };
  const anim = pipWindow.enterExitAnimation || {
    enterType: 'none',
    exitType: 'none',
    enterDuration: 0.5,
    exitDuration: 0.5,
    enterEasing: 'easeOut',
    exitEasing: 'easeOut',
  };

  const SectionHeader = ({ id, title }: { id: string, title: string }) => {
    const isCollapsed = collapsed[id];
    return (
      <div 
        className="flex items-center gap-2 cursor-pointer select-none mb-3"
        onClick={() => toggleSection(id)}
      >
        {isCollapsed ? <ChevronRight size={14} className="text-[var(--theme-text-muted)]" /> : <ChevronDown size={14} className="text-[var(--theme-text-muted)]" />}
        <h3 className="text-xs font-bold text-[var(--theme-text-primary)] uppercase tracking-wider">{title}</h3>
      </div>
    );
  };

  const renderToggle = (label: string, checked: boolean, onChange: (val: boolean) => void) => (
    <div className="flex items-center justify-between">
      <span className="text-xs text-[var(--theme-text-muted)]">{label}</span>
      <input 
        type="checkbox" 
        className="accent-blue-500 w-4 h-4 cursor-pointer"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </div>
  );

  const renderSlider = (label: string, value: number, min: number, max: number, step: number = 1, onChange: (val: number) => void) => (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between items-center">
        <span className="text-xs text-[var(--theme-text-muted)]">{label}</span>
        <span className="text-xs text-[var(--theme-text-primary)] w-8 text-right">{value}</span>
      </div>
      <input 
        type="range" 
        min={min} 
        max={max} 
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1 bg-[var(--theme-bg-subpanel)] rounded-lg appearance-none cursor-pointer accent-blue-500"
      />
    </div>
  );

  const renderColor = (label: string, color: string, onChange: (val: string) => void) => (
    <div className="flex items-center justify-between">
      <span className="text-xs text-[var(--theme-text-muted)]">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-xs text-[var(--theme-text-primary)] uppercase">{color}</span>
        <input 
          type="color" 
          value={color}
          onChange={(e) => onChange(e.target.value)}
          className="w-6 h-6 rounded border border-[var(--theme-border)] bg-transparent cursor-pointer p-0"
        />
      </div>
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6">
      {/* 1. PIP Window Settings */}
      <div>
        <SectionHeader id="settings" title="PIP Window Settings" />
        {!collapsed.settings && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-[var(--theme-text-muted)]">X Position (%)</span>
                <input 
                  type="number" 
                  value={pipWindow.x ?? 50} 
                  onChange={(e) => {/* Usually handled outside, but read-only here or we can just leave it as UI mockup if store action isn't provided. */}}
                  className="bg-[var(--theme-bg-subpanel)] text-xs text-[var(--theme-text-primary)] px-2 py-1 rounded border border-[var(--theme-border)]"
                  readOnly
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-[var(--theme-text-muted)]">Y Position (%)</span>
                <input 
                  type="number" 
                  value={pipWindow.y ?? 50} 
                  readOnly
                  className="bg-[var(--theme-bg-subpanel)] text-xs text-[var(--theme-text-primary)] px-2 py-1 rounded border border-[var(--theme-border)]"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-[var(--theme-text-muted)]">Width (%)</span>
                <input 
                  type="number" 
                  value={pipWindow.width ?? 30} 
                  readOnly
                  className="bg-[var(--theme-bg-subpanel)] text-xs text-[var(--theme-text-primary)] px-2 py-1 rounded border border-[var(--theme-border)]"
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-[var(--theme-text-muted)]">Height (%)</span>
                <input 
                  type="number" 
                  value={pipWindow.height ?? 30} 
                  readOnly
                  className="bg-[var(--theme-bg-subpanel)] text-xs text-[var(--theme-text-primary)] px-2 py-1 rounded border border-[var(--theme-border)]"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-[var(--theme-text-muted)]">Z-Index</span>
              <input 
                type="number" 
                value={pipWindow.zIndex ?? 1} 
                readOnly
                className="bg-[var(--theme-bg-subpanel)] text-xs text-[var(--theme-text-primary)] px-2 py-1 rounded border border-[var(--theme-border)] w-1/2"
              />
            </div>
            <p className="text-[10px] text-[var(--theme-text-muted)] italic">Note: Use canvas to drag and resize PIP window.</p>
          </div>
        )}
      </div>

      <div className="h-px bg-white/10" />

      {/* 2. Outline */}
      <div>
        <SectionHeader id="outline" title="Outline" />
        {!collapsed.outline && (
          <div className="flex flex-col gap-4">
            {renderToggle("Enable", style.outlineEnabled, (val) => onStyleChange({ outlineEnabled: val }))}
            {style.outlineEnabled && (
              <>
                {renderColor("Color", style.outlineColor, (val) => onStyleChange({ outlineColor: val }))}
                {renderSlider("Width", style.outlineWidth, 1, 20, 1, (val) => onStyleChange({ outlineWidth: val }))}
                {renderSlider("Radius", style.outlineRadius, 0, 50, 1, (val) => onStyleChange({ outlineRadius: val }))}
                {renderSlider("Opacity", style.outlineOpacity, 0, 100, 1, (val) => onStyleChange({ outlineOpacity: val }))}
              </>
            )}
          </div>
        )}
      </div>

      <div className="h-px bg-white/10" />

      {/* 3. Background */}
      <div>
        <SectionHeader id="background" title="Background" />
        {!collapsed.background && (
          <div className="flex flex-col gap-4">
            {renderToggle("Enable", style.backgroundEnabled, (val) => onStyleChange({ backgroundEnabled: val }))}
            {style.backgroundEnabled && (
              <>
                {renderColor("Color", style.backgroundColor, (val) => onStyleChange({ backgroundColor: val }))}
                {renderSlider("Opacity", style.backgroundOpacity, 0, 100, 1, (val) => onStyleChange({ backgroundOpacity: val }))}
                {renderSlider("Blur", style.backgroundBlur, 0, 20, 1, (val) => onStyleChange({ backgroundBlur: val }))}
                {renderSlider("Padding", style.backgroundPadding, 0, 50, 1, (val) => onStyleChange({ backgroundPadding: val }))}
              </>
            )}
          </div>
        )}
      </div>

      <div className="h-px bg-white/10" />

      {/* 4. Shadow */}
      <div>
        <SectionHeader id="shadow" title="Shadow" />
        {!collapsed.shadow && (
          <div className="flex flex-col gap-4">
            {renderToggle("Enable", style.shadowEnabled, (val) => onStyleChange({ shadowEnabled: val }))}
            {style.shadowEnabled && (
              <>
                {renderColor("Color", style.shadowColor, (val) => onStyleChange({ shadowColor: val }))}
                {renderSlider("Blur", style.shadowBlur, 0, 30, 1, (val) => onStyleChange({ shadowBlur: val }))}
                {renderSlider("Offset X", style.shadowOffsetX, -20, 20, 1, (val) => onStyleChange({ shadowOffsetX: val }))}
                {renderSlider("Offset Y", style.shadowOffsetY, -20, 20, 1, (val) => onStyleChange({ shadowOffsetY: val }))}
              </>
            )}
          </div>
        )}
      </div>

      <div className="h-px bg-white/10" />

      {/* 5. Animation */}
      <div>
        <SectionHeader id="animation" title="Enter/Exit Animation" />
        {!collapsed.animation && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-[var(--theme-text-muted)]">Enter Type</span>
              <select 
                value={anim.enterType}
                onChange={(e) => onEnterExitChange({ enterType: e.target.value as any })}
                className="bg-[var(--theme-bg-subpanel)] text-xs text-[var(--theme-text-primary)] px-2 py-1.5 rounded border border-[var(--theme-border)] w-full outline-none"
              >
                {ENTER_EXIT_PRESETS.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>

            {anim.enterType !== 'none' && (
              <>
                {renderSlider("Enter Duration (s)", anim.enterDuration, 0.1, 3, 0.1, (val) => onEnterExitChange({ enterDuration: val }))}
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-[var(--theme-text-muted)]">Enter Easing</span>
                  <select 
                    value={anim.enterEasing}
                    onChange={(e) => onEnterExitChange({ enterEasing: e.target.value })}
                    className="bg-[var(--theme-bg-subpanel)] text-xs text-[var(--theme-text-primary)] px-2 py-1.5 rounded border border-[var(--theme-border)] w-full outline-none"
                  >
                    {EASING_OPTIONS.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            <div className="h-px bg-white/5 my-1" />

            <div className="flex flex-col gap-1">
              <span className="text-xs text-[var(--theme-text-muted)]">Exit Type</span>
              <select 
                value={anim.exitType}
                onChange={(e) => onEnterExitChange({ exitType: e.target.value as any })}
                className="bg-[var(--theme-bg-subpanel)] text-xs text-[var(--theme-text-primary)] px-2 py-1.5 rounded border border-[var(--theme-border)] w-full outline-none"
              >
                {ENTER_EXIT_PRESETS.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>

            {anim.exitType !== 'none' && (
              <>
                {renderSlider("Exit Duration (s)", anim.exitDuration, 0.1, 3, 0.1, (val) => onEnterExitChange({ exitDuration: val }))}
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-[var(--theme-text-muted)]">Exit Easing</span>
                  <select 
                    value={anim.exitEasing}
                    onChange={(e) => onEnterExitChange({ exitEasing: e.target.value })}
                    className="bg-[var(--theme-bg-subpanel)] text-xs text-[var(--theme-text-primary)] px-2 py-1.5 rounded border border-[var(--theme-border)] w-full outline-none"
                  >
                    {EASING_OPTIONS.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </div>
        )}
      </div>

    </div>
  );
}

export { PipTab };
