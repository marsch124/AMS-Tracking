const CACHE_NAME = 'ams-tracking-v5';

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

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(urlsToCache).catch((error) => {
                console.error('Cache addAll error:', error);
                return cache.addAll(urlsToCache.filter((url) => {
                    return url !== '/AMS-Tracking/';
                }));
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

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    // Network-first for page navigations so app updates (with fresh ?v=
    // asset links) are picked up; cached copy is the offline fallback.
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    if (response && response.status === 200) {
                        const responseClone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, responseClone);
                        });
                    }
                    return response;
                })
                .catch(() =>
                    caches.match(event.request).then((r) =>
                        r || caches.match('/AMS-Tracking/index.html')))
        );
        return;
    }

    event.respondWith(
        caches.match(event.request).then((response) => {
            if (response) return response;

            return fetch(event.request)
                .then((response) => {
                    if (response && response.status === 200) {
                        const responseClone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, responseClone);
                        });
                    }
                    return response;
                })
                .catch(() => caches.match('/AMS-Tracking/index.html'));
        })
    );
});

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
