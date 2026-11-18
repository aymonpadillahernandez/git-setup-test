// Offline support: serve the app shell from cache, refresh it in the background.
// Bump VERSION whenever app files change so phones pick up the new build.

const VERSION = 'lift-v6';
const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'js/app.js',
  'js/charts.js',
  'js/data.js',
  'js/format.js',
  'js/icons.js',
  'js/onboarding.js',
  'js/picker.js',
  'js/stats.js',
  'js/store.js',
  'js/ui.js',
  'js/workout.js',
  'js/views/history.js',
  'js/views/progress.js',
  'js/views/routines.js',
  'js/views/settings.js',
  'js/views/today.js',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Stale-while-revalidate: instant from cache, then update the cache from the network.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const cached = await cache.match(request, { ignoreSearch: true });
      const network = fetch(request)
        .then((response) => {
          if (response.ok) cache.put(request, response.clone());
          return response;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
