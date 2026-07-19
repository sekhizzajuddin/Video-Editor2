/**
 * useRenderGuard — A safety net for React error #310 (Too many re-renders).
 *
 * Browser (minified) errors render as the cryptic string:
 *   "Minified React error #310"
 *
 * This hook detects runaway setState during render by counting renders per
 * millisecond and throwing an alert-state when it exceeds a threshold.
 *
 * Use only in development. In production React's invariant will throw.
 *
 * Phase 5 polish — not a fix for the underlying loop; just an instrument.
 */

import { useRef, useEffect } from 'react';

interface RenderGuardOptions {
  /** Component label for diagnostics. */
  label: string;
  /** Recursion window in milliseconds. Default: 1000. */
  windowMs?: number;
  /** Maximum renders in window before alert. Default: 25. */
  maxRenders?: number;
}

interface RenderGuardState {
  flagged: boolean;
}

const FLAGGED_STATE = new Set<string>();

/**
 * Drop this hook inside components you suspect of runaway renders.
 * When a runaway is detected, a console.warn fires once per label and a
 * `data-runaway` attribute is set on document.body so devtools can jump to it.
 */
export function useRenderGuard(options: RenderGuardOptions | string): void {
  const opts: RenderGuardOptions =
    typeof options === 'string' ? { label: options } : options;
  const label = opts.label;
  const windowMs = opts.windowMs ?? 1000;
  const maxRenders = opts.maxRenders ?? 25;
  const timestampsRef = useRef<number[]>([]);
  const triggeredRef = useRef(false);

  // Always-on tracker. We don't increment counter — we **let it accumulate** and
  // clear on a rolling window. If renders explode, this hook itself is harmless.
  if (typeof performance !== 'undefined') {
    const now = performance.now();
    const arr = timestampsRef.current;
    arr.push(now);
    while (arr.length && arr[0] < now - windowMs) arr.shift();

    if (!triggeredRef.current && arr.length > maxRenders) {
      triggeredRef.current = true;
      if (typeof console !== 'undefined') {
        console.error(
          `[useRenderGuard] "${label}" rendered ${arr.length} times in ${windowMs}ms. ` +
            `This typically indicates setState during render or unstable useEffect deps. ` +
            `Throttle updates or split state.`
        );
      }
      if (typeof document !== 'undefined' && !FLAGGED_STATE.has(label)) {
        FLAGGED_STATE.add(label);
        try {
          document.body.setAttribute('data-runaway', label);
        } catch {
          // ignore DOM errors in non-browser environments
        }
      }
    }

    if (triggeredRef.current && arr.length <= 2) {
      triggeredRef.current = false;
    }
  }

  // Cleanup tracked label so devtools flags clear after a few clean renders.
  useEffect(() => {
    return () => {
      if (typeof document !== 'undefined' && FLAGGED_STATE.has(label)) {
        const live = document.body.getAttribute('data-runaway') === label;
        if (live) {
          document.body.removeAttribute('data-runaway');
        }
        FLAGGED_STATE.delete(label);
      }
    };
  }, [label]);
}

export default useRenderGuard;
