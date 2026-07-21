/**
 * PropertyTabHeader.tsx
 * 
 * Top tab navigation bar component for Properties Panel.
 * Dynamically computes available tabs based on selected clip type (video, text, audio).
 */

import React, { Fragment } from 'react';
import {
  Sliders,
  Crop,
  Palette,
  FastForward,
  Volume2,
  Type,
  Wand2,
  History,
  Image as ImageIcon
} from 'lucide-react';
import { PropertiesTab } from './propertiesTypes';
import { TimelineClip } from '@/types';

interface PropertyTabHeaderProps {
  activeTab: PropertiesTab;
  setActiveTab: (tab: PropertiesTab) => void;
  selectedClip?: TimelineClip | null;
}

export function PropertyTabHeader({
  activeTab,
  setActiveTab,
  selectedClip
}: PropertyTabHeaderProps) {
  const baseTabs: { id: PropertiesTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [];

  if (selectedClip) {
    baseTabs.push({ id: 'transform', label: 'Transform', icon: Sliders });
    baseTabs.push({ id: 'mask', label: 'Mask', icon: Crop });
    baseTabs.push({ id: 'color', label: 'Color', icon: Palette });
    baseTabs.push({ id: 'speed', label: 'Speed', icon: FastForward });
    baseTabs.push({ id: 'audio', label: 'Audio', icon: Volume2 });

    if (selectedClip.textSettings || selectedClip.mediaId === 'text-placeholder' || selectedClip.id?.startsWith('clip_subtitle') || selectedClip.id?.startsWith('clip_typo')) {
      baseTabs.push({ id: 'text', label: 'Text', icon: Type });
    }

    baseTabs.push({ id: 'effects', label: 'FX', icon: Wand2 });
  }

  // Always append History & Thumbnail tabs
  baseTabs.push({ id: 'history', label: 'History', icon: History });
  baseTabs.push({ id: 'thumbnail', label: 'Thumbnail', icon: ImageIcon });

  return (
    <div className="flex overflow-x-auto border-b border-[#3e3e3e] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] px-1 bg-[#1a1a1a]/50 shrink-0 select-none">
      {baseTabs.map((tab, idx) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <Fragment key={tab.id}>
            {idx > 0 && <div className="w-px h-5 bg-[#3e3e3e] self-center shrink-0 mx-1" />}
            <button
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-2.5 px-3 text-[10px] font-medium uppercase tracking-wider flex flex-col items-center gap-1 transition-colors ${
                isActive
                  ? 'text-white border-b-2 border-amber-500 bg-[#2d2d2d]'
                  : 'text-[#a0a0a0] hover:text-white hover:bg-[#2d2d2d]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          </Fragment>
        );
      })}
    </div>
  );
}
