import { useEffect, useState } from 'react';

/**
 * Mobile-only hook — reports whether the browser currently has network access.
 * No desktop counterpart: the desktop editor intentionally shows no offline
 * banner (the service worker still makes it work offline; this is purely a
 * mobile UX affordance).
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState<boolean>(
    () => typeof navigator === 'undefined' || navigator.onLine,
  );

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return online;
}
