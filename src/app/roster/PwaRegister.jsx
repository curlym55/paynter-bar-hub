'use client';

import { useEffect } from 'react';

/**
 * Registers the Paynter Bar Roster service worker (scope: /roster).
 * Rendered from src/app/roster/layout.js. Client-only.
 */
export default function PwaRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    // Skip on local dev to avoid stale caches on port 3001.
    if (window.location.hostname === 'localhost') return;

    let reloading = false;
    const onControllerChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    const register = () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/roster' })
        .then((registration) => {
          registration.addEventListener('updatefound', () => {
            const installing = registration.installing;
            if (!installing) return;
            installing.addEventListener('statechange', () => {
              if (
                installing.state === 'installed' &&
                navigator.serviceWorker.controller
              ) {
                installing.postMessage('SKIP_WAITING');
              }
            });
          });
        })
        .catch((err) => console.warn('SW registration failed:', err));
    };

    window.addEventListener('load', register);
    return () => {
      window.removeEventListener('load', register);
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  return null;
}
