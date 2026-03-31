'use client';

import { useEffect } from 'react';

export default function LegacyApp() {
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // Import only on the client after #app exists.
        await import('../src/legacy/main.js');
      } catch (e) {
        if (!cancelled) {
          // If legacy boot fails, surface it for debugging.
          // eslint-disable-next-line no-console
          console.error('Legacy app failed to boot:', e);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return <div id="app" />;
}

