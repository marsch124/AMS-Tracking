const CACHE_NAME = 'ams-tracking-v42';

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
