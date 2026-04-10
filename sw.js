/* Silent Step — Service Worker v1 */
const CACHE_NAME = 'silent-step-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap'
];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(STATIC_ASSETS.filter(function (url) {
        return !url.startsWith('https://fonts');
      }));
    })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (k) { return k !== CACHE_NAME; })
          .map(function (k) { return caches.delete(k); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  /* Only handle same-origin GET requests and Google Fonts */
  var url = e.request.url;
  if (e.request.method !== 'GET') return;

  /* Skip Nominatim reverse-geocode calls — always need fresh data.
     Match by hostname to prevent substring-injection bypasses. */
  try {
    var reqHostname = new URL(url).hostname;
    if (reqHostname === 'nominatim.openstreetmap.org') return;
  } catch (_) { return; }

  e.respondWith(
    caches.match(e.request).then(function (cached) {
      var networkFetch = fetch(e.request).then(function (response) {
        if (response && response.status === 200 && response.type !== 'opaque') {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(e.request, clone);
          });
        }
        return response;
      }).catch(function () { return null; });

      /* Cache-first for navigation; network-first otherwise */
      if (e.request.mode === 'navigate') {
        return networkFetch
          .then(function (r) { return r || cached || new Response('Offline', { status: 503 }); })
          .catch(function () { return cached || new Response('Offline', { status: 503 }); });
      }
      return cached || networkFetch.then(function (r) { return r || new Response('', { status: 503 }); });
    })
  );
});
