// ─────────────────────────────────────────────────────────────────────────────
// [DESKTOP SYNC] Mobile feature — it has a DESKTOP counterpart.
// Rule: if an update changes LOGIC, changes ARCHITECTURE, or FIXES A BUG, apply
// the same change to the desktop file(s) below. SKIP if the update is UI-only.
// Desktop counterpart:
//   src/hooks/use-mobile.ts
//   src/App.tsx
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react';

export type DeviceType = 'mobile' | 'tablet' | 'desktop';

/**
 * Detects the current device class (mobile phone / tablet / desktop PC).
 *
 * This is the single "PC / Mobile / Tablet identifier" used by the App router to
 * decide whether to mount the desktop editor or the touch-first mobile editor.
 * Detection combines the user-agent, pointer coarseness and viewport width so a
 * resized desktop browser window or a phone in landscape still resolves correctly.
 */
export function detectDeviceType(): DeviceType {
  if (typeof window === 'undefined') return 'desktop';

  const ua = (navigator.userAgent || '').toLowerCase();
  const width = window.innerWidth;

  const coarsePointer =
    (navigator.maxTouchPoints ?? 0) > 1 ||
    (typeof window.matchMedia === 'function' &&
      window.matchMedia('(pointer: coarse)').matches);

  // Phones — explicit UA match wins regardless of viewport (covers landscape).
  const isPhoneUA = /mobi|iphone|ipod|android.*mobile|windows phone|blackberry|bb10|iemobile/.test(ua);
  // Tablets — explicit UA match, or a coarse-pointer device in the tablet band.
  const isTabletUA = /ipad|tablet|playbook|silk|android(?!.*mobile)/.test(ua);

  if (isPhoneUA) return 'mobile';
  if (isTabletUA) return 'tablet';

  if (width < 768) return 'mobile';
  if (width < 1024 && coarsePointer) return 'tablet';

  return 'desktop';
}

export function useDeviceType(): DeviceType {
  const [device, setDevice] = useState<DeviceType>(() => detectDeviceType());

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const update = () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => setDevice(detectDeviceType()), 100);
    };

    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      if (timeout) clearTimeout(timeout);
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  return device;
}
