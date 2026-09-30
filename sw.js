// ================================================================
// SERVICE WORKER — BetaFPV Web Sim
// Cache offline dla assetów + Three.js z CDN
// ================================================================

const CACHE_NAME = 'betafpv-sim-v1';
const CACHE_VERSION = 1;

// ─── Assety do cache'owania przy instalacji ───
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/main.js',
  '/calibration.js',
  '/favicon.ico',
  '/manifest.json',
  '/img/icon-192.png',
  '/img/icon-512.png',
  '/img/preview.png',
  // Three.js z CDN — cache'owane przy pierwszym użyciu
  'https://unpkg.com/three@0.160.0/build/three.module.js'
];

// ================================================================
// INSTALL — precache assetów
// ================================================================
self.addEventListener('install', (event) => {
  console.log('🔧 SW: install');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 SW: precache assetów');
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => self.skipWaiting())
      .catch((err) => {
        console.warn('⚠️ SW: precache częściowo nieudany:', err);
      })
  );
});

// ================================================================
// ACTIVATE — usuń stare cache
// ================================================================
self.addEventListener('activate', (event) => {
  console.log('✅ SW: activate');
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => {
            console.log('🗑️ SW: usuwam stary cache:', key);
            return caches.delete(key);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// ================================================================
// FETCH — strategia cache-first dla assetów
// ================================================================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // ─── Pomijamy WebHID i inne API systemowe ───
  if (url.protocol === 'chrome-extension:' || url.protocol === 'moz-extension:') {
    return;
  }

  // ─── Nie cache'ujemy requestów innych niż GET ───
  if (request.method !== 'GET') {
    return;
  }

  // ─── Strategia: cache-first, fallback do sieci ───
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(request).then((response) => {
        // Cache'ujemy tylko udane odpowiedzi
        if (!response || response.status !== 200 || response.type === 'error') {
          return response;
        }

        // Nie cache'ujemy requestów do API zewnętrznych (poza Three.js)
        const isThreeJS = url.hostname === 'unpkg.com';
        const isLocal = url.origin === self.location.origin;

        if (isThreeJS || isLocal) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }

        return response;
      }).catch(() => {
        // Offline fallback — jeśli to nawigacja, zwróć index.html
        if (request.mode === 'navigate') {
          return caches.match('/index.html');
        }
        // Dla innych — pusty response
        return new Response('Offline', { status: 503 });
      });
    })
  );
});

// ================================================================
// MESSAGE — komunikacja z apką (np. update)
// ================================================================
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});