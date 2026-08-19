// the same change to the desktop file(s) below. SKIP if the update is UI-only.
// Desktop counterpart:
//   src/components/ui/sheet.tsx
//   src/components/ui/drawer.tsx
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useState, useRef } from 'react';
import { X } from 'lucide-react';

export interface MobileBottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** Initial height */
  height?: number | string;
  children: React.ReactNode;
  /** Optional right-side header action (e.g. "Done"). */
  headerRight?: React.ReactNode;
}

export function MobileBottomSheet({
  open,
  onClose,
  title,
  height = '50%',
  children,
  headerRight,
}: MobileBottomSheetProps) {
  const [currentHeight, setCurrentHeight] = useState<number | string>(height);
  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Sync initial height on open
  useEffect(() => {
    if (open) {
      setCurrentHeight(height);
    }
  }, [open, height]);

  // Lock body scroll while a sheet is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    if (!sheetRef.current) return;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    dragRef.current = {
      startY: clientY,
      startHeight: sheetRef.current.getBoundingClientRect().height,
    };
  };

  const handleTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!dragRef.current) return;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    const deltaY = dragRef.current.startY - clientY;
    const newHeight = Math.max(100, Math.min(window.innerHeight * 0.9, dragRef.current.startHeight + deltaY));
    setCurrentHeight(newHeight);
  };

  const handleTouchEnd = () => {
    dragRef.current = null;
  };

  const heightStyle = typeof currentHeight === 'number' ? `${currentHeight}px` : currentHeight;

  return (
    <div className="absolute inset-0 z-[90] pointer-events-none">
      {/* Removed scrim to allow viewing/interacting with canvas */}
      <div
        ref={sheetRef}
        className="absolute inset-x-0 bottom-0 mobile-sheet-enter flex flex-col overflow-hidden rounded-t-2xl border-t border-white/10 bg-[#1b1b1f] shadow-[0_-8px_40px_rgba(0,0,0,0.6)] pointer-events-auto"
        style={{ height: heightStyle, maxHeight: '100dvh' }}
      >
        <div 
          className="mobile-grabber h-6 shrink-0 flex items-center justify-center cursor-ns-resize touch-none" 
          onMouseDown={handleTouchStart}
          onMouseMove={handleTouchMove}
          onMouseUp={handleTouchEnd}
          onMouseLeave={handleTouchEnd}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="w-10 h-1.5 rounded-full bg-white/20" />
        </div>
        {(title || headerRight) && (
          <div className="flex items-center justify-between px-4 pb-2 shrink-0 border-b border-white/5">
            <h2 className="text-[14px] font-semibold text-white">{title}</h2>
            {headerRight || (
              <button
                onClick={onClose}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white/70 hover:bg-white/20 active:scale-95 transition-all"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
        <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
      </div>
    </div>
  );
}
