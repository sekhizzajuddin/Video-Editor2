/**
 * PropertyThumbnailHistoryTab.tsx
 * 
 * Thumbnail Designer & History inspector tab for Properties Panel.
 * Manages YouTube Thumbnail capturing, safe zones toggle, quick branding text/logo import,
 * and Undo/Redo Action History stack navigation.
 */

import React from 'react';
import {
  Image as ImageIcon,
  Sparkles,
  Type
} from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { PropertiesTab } from '../propertiesTypes';

interface PropertyThumbnailHistoryTabProps {
  activeTab: PropertiesTab;
}

export function PropertyThumbnailHistoryTab({ activeTab }: PropertyThumbnailHistoryTabProps) {
  const { history, historyIndex, jumpToHistoryIndex } = useEditorStore();

  if (activeTab === 'thumbnail') {
    return (
      <div className="flex-1 flex flex-col p-4 gap-4 overflow-y-auto text-xs select-none">
        <div className="bg-[#2d2d2d] rounded border border-[#3e3e3e] p-3 flex flex-col gap-3">
          <h3 className="text-xs font-semibold text-white flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-amber-500" />
            Thumbnail Designer
          </h3>
          <p className="text-[10px] text-[#a0a0a0] leading-relaxed">
            Add text, stickers, and shapes to the timeline to design your thumbnail. Click the button below to capture the current frame as an image.
          </p>
          
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-white flex-1 cursor-pointer select-none">
              Show YouTube Safe Zones
            </label>
            <button
              onClick={() => {
                const current = useEditorStore.getState().settings.showSafeZones;
                useEditorStore.getState().updateSettings({ showSafeZones: !current });
              }}
              className={`w-8 h-4 rounded-full transition-colors relative ${
                useEditorStore.getState().settings.showSafeZones ? 'bg-amber-500' : 'bg-[#1e1e1e] border border-[#3e3e3e]'
              }`}
            >
              <div className={`w-3 h-3 rounded-full bg-white absolute top-[1px] transition-all ${
                useEditorStore.getState().settings.showSafeZones ? 'left-[17px]' : 'left-[1px]'
              }`} />
            </button>
          </div>

          <button
            onClick={() => {
              const canvas = document.querySelector('#preview-canvas') as HTMLCanvasElement;
              if (!canvas) {
                alert("Preview canvas not found!");
                return;
              }
              const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
              const link = document.createElement('a');
              link.download = 'thumbnail.jpg';
              link.href = dataUrl;
              link.click();
            }}
            className="mt-2 w-full py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded text-xs font-semibold shadow-lg shadow-orange-900/20 transition-all flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            Capture High-Res Thumbnail
          </button>
        </div>
        
        <div className="bg-[#2d2d2d] rounded border border-[#3e3e3e] p-3 flex flex-col gap-3">
          <h3 className="text-xs font-semibold text-white">Quick Branding</h3>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                useEditorStore.getState().insertTextClip({ text: 'BRAND NAME', fontSize: 40 });
              }}
              className="py-2 bg-[#1e1e1e] hover:bg-[#3e3e3e] border border-[#3e3e3e] text-white rounded text-[10px] transition-colors flex flex-col items-center gap-1"
            >
              <Type className="w-4 h-4 text-blue-400" />
              Add Bold Text
            </button>
            <button
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.onchange = (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (file) {
                    useEditorStore.getState().addMedia({
                      id: Math.random().toString(36).substr(2, 9),
                      name: file.name,
                      type: 'image',
                      url: URL.createObjectURL(file),
                      duration: 5,
                      createdAt: Date.now(),
                    });
                  }
                };
                input.click();
              }}
              className="py-2 bg-[#1e1e1e] hover:bg-[#3e3e3e] border border-[#3e3e3e] text-white rounded text-[10px] transition-colors flex flex-col items-center gap-1"
            >
              <ImageIcon className="w-4 h-4 text-green-400" />
              Import Logo
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (activeTab === 'history') {
    return (
      <div className="flex-1 flex flex-col overflow-hidden h-full text-xs select-none">
        {/* Header */}
        <div className="p-3 border-b border-[#3e3e3e] flex items-center justify-between shrink-0 bg-[#1e1e1e]/30">
          <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">Undo/Redo History</span>
          <span className="text-[9px] text-[#8a8a8a] bg-[#1e1e1e] border border-[#3e3e3e] rounded px-1.5 py-0.5 font-mono">
            {history.length} Actions
          </span>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5 scrollbar-thin">
          {history.map((snap, idx) => {
            const isActive = idx === historyIndex;
            const isFuture = idx > historyIndex;
            return (
              <button
                key={idx}
                onClick={() => jumpToHistoryIndex(idx)}
                className={`w-full flex items-center gap-3 p-2 rounded text-left transition-all border ${
                  isActive
                    ? 'bg-amber-500/10 border-amber-500 text-amber-400 font-medium shadow-md shadow-amber-500/5'
                    : isFuture
                    ? 'bg-[#1e1e1e]/40 border-transparent text-[#a0a0a0]/40 hover:text-white hover:bg-[#2d2d2d]'
                    : 'bg-[#1e1e1e]/60 border-transparent text-[#a0a0a0] hover:text-white hover:bg-[#2d2d2d]'
                }`}
              >
                {/* Visual Line Node */}
                <div className="relative flex items-center justify-center shrink-0 w-4">
                  {idx < history.length - 1 && (
                    <div className={`absolute top-4 bottom-[-24px] w-[2px] ${
                      isFuture ? 'bg-[#3e3e3e]/40' : 'bg-amber-500/30'
                    }`} />
                  )}
                  <div className={`w-2.5 h-2.5 rounded-full border-2 ${
                    isActive
                      ? 'bg-amber-400 border-amber-400 ring-4 ring-amber-500/20 scale-110'
                      : isFuture
                      ? 'bg-transparent border-[#3e3e3e]'
                      : 'bg-amber-500/40 border-amber-500/80'
                  }`} />
                </div>

                <div className="flex-1 min-w-0">
                  <span className="text-xs truncate block">{snap.label || 'Action'}</span>
                  <span className="text-[9px] opacity-60 block mt-0.5 font-mono">
                    {idx === 0 ? 'Base State' : `Step ${idx}`}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return null;
}
