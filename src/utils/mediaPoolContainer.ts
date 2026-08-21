// ─────────────────────────────────────────────────────────────────────────────
// [SHARED CORE] Used by BOTH the desktop editor (src/App.tsx → DesktopApp) and
// the mobile editor (src/mobile/App.tsx → MobileApp). There is NO separate mobile
// copy — edit ONCE here. LOGIC / ARCHITECTURE / BUGFIX changes automatically apply
// to both UIs. UI-only changes belong in the individual UI layer instead.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * mediaPoolContainer.ts
 *
 * Shared, always-painted host element for every "invisible" media element the
 * app creates — the useMediaPlayback pool and the import-time probe/thumbnail
 * capture elements.
 *
 * ANDROID RENDERING FIX: Chrome on Android only produces/decodes frames for
 * media elements that participate in compositing. An element with
 * `opacity: 0`, zero layout size, or one fully clipped away is treated as
 * unpainted, so its frames are never surfaced — `drawImage(video)` then paints
 * nothing and seek/thumbnail captures come back black. Desktop Chrome has no
 * such optimization, which is why the very same code renders fine on PC
 * (including dev-tools "responsive mode", which still runs the desktop media
 * stack) but failed on real Android phones.
 *
 * The fix is the standard "painted but invisible" pattern: a 2×2px,
 * pointer-inert, opacity-0.01 container pinned inside the viewport. It is
 * visually invisible (≤0.25/255 luminance shift) yet composited, so Android
 * keeps every pooled video decoding and canvas read-back works.
 */
export function getMediaPoolContainer(): HTMLDivElement {
  let mediaContainer = document.getElementById('procut-media-pool') as HTMLDivElement | null;
  if (!mediaContainer) {
    mediaContainer = document.createElement('div');
    mediaContainer.id = 'procut-media-pool';
    mediaContainer.setAttribute('aria-hidden', 'true');
    const s = mediaContainer.style;
    s.position = 'fixed';
    s.top = '0';
    s.left = '0';
    s.width = '2px';
    s.height = '2px';
    s.overflow = 'hidden';
    // 0.01 ≈ invisible but still painted — never set this back to 0:
    // that is exactly what breaks video compositing on Android.
    s.opacity = '0.01';
    s.pointerEvents = 'none';
    s.zIndex = '2147483647';
    document.body.appendChild(mediaContainer);
  }
  return mediaContainer;
}

/**
 * Style a transient media element the same way pooled elements are styled, so
 * import-time probes/frame captures also decode on Android. Returns the
 * element for chaining. Caller is responsible for `.remove()`-ing it.
 */
export function attachInvisibleMediaElement<T extends HTMLMediaElement>(el: T): T {
  const s = el.style;
  s.position = 'absolute';
  s.opacity = '0.01'; // see container note — 0 is NOT composited on Android
  s.pointerEvents = 'none';
  s.width = '2px';
  s.height = '2px';
  getMediaPoolContainer().appendChild(el);
  return el;
}
