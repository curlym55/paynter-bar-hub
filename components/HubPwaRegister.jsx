import { useEffect } from 'react';

/**
 * Registers the main Paynter Bar Hub service worker (scope: /).
 * Rendered from pages/_app.js. Client-only.
 * Separate from the roster app's PwaRegister (src/app/roster/PwaRegister.jsx,
 * scope: /roster) so the two PWAs never interfere with each other.
 */
export default function HubPwaRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    // Skip on local dev to avoid stale caches during development.
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
        .register('/sw-hub.js', { scope: '/' })
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
        .catch((err) => console.warn('Hub SW registration failed:', err));
    };

    window.addEventListener('load', register);
    return () => {
      window.removeEventListener('load', register);
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  return null;
}
