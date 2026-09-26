const CACHE = 'mpc-studio-v29-rai-defaults';
const SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./rai-factory.js",
  "./sequencer-core.js",
  "./sequencer-v2.js",
  "./mixer-core.js",
  "./fx-rack.js",
  "./audio-engine-v2.js",
  "./automation-core.js",
  "./automation.js",
  "./midi-core.js",
  "./midi.js",
  "./performance-v2.js",
  "./export-v2.js",
  "./sonilo-core.js",
  "./sonilo.js",
  "./vst-bridge.js",
  "./api-services.js",
  "./api-dj.js",
  "./api-dj.css",
  "./pwa.js",
  "./audio-tap.js",
  "./dj.js",
  "./dj.css",
  "./dj-pad-options.js",
  "./dj-sync.js",
  "./dj-live-layer.js",
  "./dj-recorder.js",
  "./dj-android-recorder.js",
  "./virtualdj.js",
  "./virtualdj.css",
  "./virtualdj-files.js",
  "./virtualdj-catalogs.js",
  "./supabase-config.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Never cache authenticated AI function traffic or temporary Sonilo media.
  if (url.pathname.includes('/functions/v1/sonilo-') || url.hostname.includes('sonilo')) return;

  if (url.origin !== self.location.origin) {
    if (url.hostname === 'upload.wikimedia.org') {
      event.respondWith(
        caches.match(request).then(cached =>
          fetch(request)
            .then(response => {
              if (response && response.ok) {
                const copy = response.clone();
                caches.open(CACHE).then(cache => cache.put(request, copy));
              }
              return response;
            })
            .catch(() => cached)
        )
      );
    }
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put('./index.html', copy));
          return response;
        })
        .catch(async () => await caches.match(request) || await caches.match('./index.html') || await caches.match('./'))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      const network = fetch(request)
        .then(response => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then(cache => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
