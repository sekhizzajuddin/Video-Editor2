// ─────────────────────────────────────────────────────────────────────────────
// [DESKTOP SYNC] Mobile feature — it has a DESKTOP counterpart.
// Rule: if an update changes LOGIC, changes ARCHITECTURE, or FIXES A BUG, apply
// the same change to the desktop file(s) below. SKIP if the update is UI-only.
// Desktop counterpart:
//   src/components/ui/sheet.tsx
//   src/components/ui/drawer.tsx
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect } from 'react';

export interface MobileBottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** Sheet height — a number is pixels, a string is a raw CSS height. */
  height?: number | string;
  children: React.ReactNode;
  /** Optional right-side header action (e.g. "Done"). */
  headerRight?: React.ReactNode;
}

/**
 * CapCut/KineMaster-style bottom sheet. Renders above a dimmed scrim and slides
 * up from the bottom edge of the screen. Tapping the scrim closes it.
 */
export function MobileBottomSheet({
  open,
  onClose,
  title,
  height = '78%',
  children,
  headerRight,
}: MobileBottomSheetProps) {
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

  const heightStyle =
    typeof height === 'number' ? `${height}px` : height;

  return (
    <div className="absolute inset-0 z-[90]">
      <div
        className="absolute inset-0 bg-black/60 mobile-fade-enter"
        onClick={onClose}
      />
      <div
        className="absolute inset-x-0 bottom-0 mobile-sheet-enter flex flex-col overflow-hidden rounded-t-2xl border-t border-white/10 bg-[#1b1b1f] shadow-[0_-8px_40px_rgba(0,0,0,0.6)]"
        style={{ height: heightStyle, maxHeight: '100dvh' }}
      >
        <div className="mobile-grabber h-4 shrink-0" onClick={onClose} />
        {(title || headerRight) && (
          <div className="flex items-center justify-between px-4 pb-2 shrink-0">
            <h2 className="text-[15px] font-bold text-white">{title}</h2>
            {headerRight}
          </div>
        )}
        <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
      </div>
    </div>
  );
}
