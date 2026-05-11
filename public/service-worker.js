// Kill-switch service worker. The previous compare build registered
// a workbox-generated SW at this URL that aggressively pre-cached the
// site. The current build ships no SW at all, but existing visitors
// still have that old one installed and would keep loading stale
// assets indefinitely.
//
// Browsers periodically fetch the SW script directly from the network
// (bypassing the existing SW) to check for updates. When this file is
// served in response to that check, the browser installs it as the
// new SW, replacing the old one. The new SW then unregisters itself
// and clears every cache, leaving the visitor in the same state as a
// brand-new user. After one round of this, future navigations skip
// the SW entirely.
//
// Keep this file in the deploy until you're confident every previous
// visitor has cycled through it. Removing it earlier just delays the
// cleanup (returns to a 404, which most browsers ignore).

self.addEventListener('install', () => {
  // Take over from the old SW without waiting for tabs to close.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // 1. Become the controller of every open tab so the next step
      //    affects them.
      await self.clients.claim();

      // 2. Wipe every cache the previous SW (or anything else)
      //    populated under this origin.
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));

      // 3. Self-destruct. Future page loads bypass the SW entirely.
      await self.registration.unregister();

      // 4. Reload every open tab so they pick up the fresh HTML and
      //    fresh assets immediately rather than after the user's next
      //    reload.
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach((client) => {
        if ('navigate' in client) client.navigate(client.url);
      });
    })()
  );
});

// No fetch handler — requests pass through to the network untouched
// for the brief window between this SW activating and unregistering.
