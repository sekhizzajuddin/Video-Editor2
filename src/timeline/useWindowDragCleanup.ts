import { useRef, useEffect } from 'react';

/**
 * [P1 FIX — MEMORY LEAK GUARD]
 * Tracks window-drag listeners that are attached imperatively inside pointerdown
 * handlers (and removed only in the matching pointerup). If the component unmounts
 * mid-drag — clip deleted, overlay cancelled, view switched — pointerup never fires,
 * the listeners persist and keep firing on every subsequent pointermove anywhere.
 *
 * Usage inside a pointerdown handler:
 *   const cleanup = () => { window.removeEventListener(...); windowDragCleanupRef.current = null; };
 *   windowDragCleanupRef.current = cleanup;
 *   const onPointerUp = cleanup;
 *   window.addEventListener('pointerup', onPointerUp);
 *
 * The hook only needs to be mounted once per component that owns drag handlers.
 */
export function useWindowDragCleanup() {
  const cleanupRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, []);
  return cleanupRef;
}
