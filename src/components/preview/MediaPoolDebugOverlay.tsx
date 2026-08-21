// ─────────────────────────────────────────────────────────────────────────────
// [SHARED CORE] Used by BOTH the desktop editor (src/App.tsx → DesktopApp) and
// the mobile editor (src/mobile/App.tsx → MobileApp). There is NO separate mobile
// copy — edit ONCE here. LOGIC / ARCHITECTURE / BUGFIX changes automatically apply
// to both UIs. UI-only changes belong in the individual UI layer instead.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * MediaPoolDebugOverlay.tsx
 *
 * On-device diagnostics badge for the hidden media pool. Rendered only when
 * the app is opened with `?mediadebug=1` (or `#mediadebug`) in the URL.
 *
 * Motivation: Android-only media failures ("timeline clips don't render on the
 * preview canvas on a real phone but fine on PC") cannot be reproduced in the
 * desktop devtools, and remote debugging requires a cable. This badge surfaces
 * the exact per-element state — src assignment, readyState, videoWidth, media
 * errors — as on-screen text so a single phone screenshot contains the answer.
 */

import { useEffect, useState } from 'react';
import { getMediaPoolDebugSnapshot, MediaPoolDebugSnapshot } from '@/hooks/useMediaPlayback';

export function MediaPoolDebugOverlay() {
  const [snap, setSnap] = useState<MediaPoolDebugSnapshot | null>(null);

  useEffect(() => {
    const update = () => {
      try {
        setSnap(getMediaPoolDebugSnapshot());
      } catch {
        /* pool not initialised yet */
      }
    };
    update();
    const id = setInterval(update, 400);
    return () => clearInterval(id);
  }, []);

  if (!snap) return null;

  return (
    <div
      className="pointer-events-none absolute left-1 top-1 z-[120] max-h-[55%] w-[92%] overflow-y-auto rounded bg-black/85 p-1.5 font-mono text-[9px] leading-[1.35] text-lime-300"
      style={{ WebkitTextSizeAdjust: '100%' }}
    >
      <div className="text-amber-300">
        MEDIA-DBG t={snap.time}s playing={String(snap.playing)} scrub={String(snap.scrubbing)} pool=
        {snap.poolSize} vmap={snap.videoMapSize} android={String(snap.device.android)} coarse=
        {String(snap.device.coarse)} maxLoad={snap.device.maxLoadedVideos}
      </div>
      <div className={snap.registry.primaryControllerId === null ? 'text-red-400' : 'text-cyan-300'}>
        ctl primary={snap.registry.primaryControllerId === null ? 'NONE!' : snap.registry.primaryControllerId} active=
        [{snap.registry.activeControllers.join(',') || 'none'}]
      </div>
      {snap.entries.length === 0 && <div className="text-red-400">POOL EMPTY — no elements created</div>}
      {snap.entries.map((e) => (
        <div key={e.clipId} className={e.error || e.readyState === 0 ? 'text-red-400' : undefined}>
          {e.type === 'video' ? '🎬' : '🔊'} {e.clipId.slice(0, 12)} src={e.srcScheme}
          {e.srcLen > 0 ? `(${e.srcLen})` : '∅'} tag={String(e.tagged)} rs={e.readyState} vw=
          {e.videoWidth} t={e.currentTime} {e.paused ? '⏸' : '▶'}
          {e.muted ? ' 🔇' : ' 🔊'}
          {e.seeking ? ' seek…' : ''}
          {!e.inDOM ? ' NOT-IN-DOM' : ''}
          {e.computedOpacity !== null && e.computedOpacity !== '1' ? ` op=${e.computedOpacity}` : ''}
          {e.error ? ` ERR[${e.error}]` : ''}
        </div>
      ))}
    </div>
  );
}
