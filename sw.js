const CACHE_NAME = 'ams-tracking-v66';

const urlsToCache = [
    '/AMS-Tracking/',
    '/AMS-Tracking/index.html',
    '/AMS-Tracking/css/style.css',
    '/AMS-Tracking/js/app.js',
    '/AMS-Tracking/js/icons.js',
    '/AMS-Tracking/manifest.json',
    '/AMS-Tracking/icons/icon-192.png',
    '/AMS-Tracking/icons/icon-512.png',
    '/AMS-Tracking/icons/icon-512-maskable.png',
    '/AMS-Tracking/icons/apple-touch-icon.png',
    '/AMS-Tracking/icons/favicon-64.png'
];

/* cache: 'reload' bypasses the HTTP cache (GitHub Pages caches for 10
   minutes), so a fresh install can never fill the versioned cache with
   files from the PREVIOUS deploy — that mismatch broke the 2 Sep update. */
const freshRequests = (urls) => urls.map((u) => new Request(u, { cache: 'reload' }));

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(freshRequests(urlsToCache)).catch((error) => {
                console.error('Cache addAll error:', error);
                return cache.addAll(freshRequests(urlsToCache.filter((url) => {
                    return url !== '/AMS-Tracking/';
                })));
            });
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    // Only manage this app's caches — the parent AMS Instructions
                    // app registers its own service worker with a different scope.
                    if (cacheName.startsWith('ams-tracking-') && cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                    return Promise.resolve();
                })
            );
        })
    );
    self.clients.claim();
});

const NAV_TIMEOUT = 2000; // ms a launch may wait on the network before the cached app shows

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    // Version probes must always reach the network and never be cached
    if (new URL(event.request.url).searchParams.has('vercheck')) {
        event.respondWith(fetch(event.request));
        return;
    }

    // Navigations: network-first so updates arrive, but capped at NAV_TIMEOUT —
    // on a slow connection the cached app appears at once and the network
    // response only refreshes the cache for the next launch.
    if (event.request.mode === 'navigate') {
        event.respondWith((async () => {
            const cached = await caches.match(event.request, { ignoreSearch: true }) ||
                await caches.match('/AMS-Tracking/index.html');
            const network = fetch(event.request.url, { cache: 'no-cache' }).then((response) => {
                if (response && response.status === 200) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                }
                return response;
            });
            try {
                const response = cached
                    ? await Promise.race([
                        network.catch(() => null),
                        new Promise((resolve) => setTimeout(() => resolve(null), NAV_TIMEOUT))
                    ])
                    : await network;
                if (response && response.status === 200) return response;
                if (cached) return cached;
                return response || Response.error();
            } catch (e) {
                if (cached) return cached;
                throw e;
            }
        })());
        return;
    }

    // Assets: cache-first. Entries live in a per-version cache that is rebuilt
    // on every update, so ignoring the ?v= query is safe — and it means CSS,
    // JS, and icons load instantly from disk instead of hitting the network
    // on every launch. A failed asset fails honestly: it is NEVER answered
    // with index.html (that once painted the whole app white).
    event.respondWith(
        caches.match(event.request, { ignoreSearch: true }).then((response) => {
            if (response) return response;
            return fetch(event.request).then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                    const clone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                }
                return networkResponse;
            });
        })
    );
});

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

/* ---------- v1.44: the daily reminder ----------
   reminder-worker/ sends ONE Web Push a day at the time chosen in Settings.
   The text is composed HERE, from a summary the page writes into the Cache
   API on every save — so the notification can name the habits still open
   without the server ever knowing a habit's name. Safari insists that every
   push shows a notification, so there is always something to show. */
const SUMMARY_URL = self.location.origin + '/AMS-Tracking/__summary';

function localDateKey(d) {
    const p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

async function reminderText(payload) {
    let body = (payload && payload.body) || 'Time to fill in your tracked items.';
    try {
        const cache = await caches.open('amsTrackingState');
        const res = await cache.match(SUMMARY_URL);
        const s = res ? await res.json() : null;
        if (s && s.date === localDateKey(new Date())) {
            if (s.total > 0 && s.open.length === 0) body = 'Everything is ticked off for today.';
            else if (s.open.length === 1) body = 'Still open: ' + s.open[0];
            else if (s.open.length > 1) body = s.open.length + ' still open: ' + s.open.join(', ');
        }
    } catch (e) { /* no summary — the plain text will do */ }
    return body;
}

self.addEventListener('push', (event) => {
    let payload = null;
    try { payload = event.data ? event.data.json() : null; } catch (e) { payload = null; }
    event.waitUntil((async () => {
        const body = await reminderText(payload);
        await self.registration.showNotification((payload && payload.title) || 'AMS Tracking', {
            body,
            tag: 'ams-tracking-reminder',
            data: { url: self.registration.scope }
        });
    })());
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const target = (event.notification.data && event.notification.data.url) || self.registration.scope;
    event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
        const open = list.find((c) => c.url.startsWith(self.registration.scope));
        if (open) return open.focus();
        return self.clients.openWindow(target);
    }));
});
