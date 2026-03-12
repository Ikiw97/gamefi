// Zico Rush – Service Worker v1.0
const CACHE_NAME = 'zico-rush-v1';

const PRECACHE_URLS = [
  './',
  './index.html',
  './game.html',
  './leaderboard.html',
  './profile.html',
  './css/style.css',
  './js/supabase.js',
  './js/wallet.js',
  './js/onboarding.js',
  './manifest.json',
  './assets/sprites/coin.png',
  './assets/sprites/1.png',
  './assets/sprites/2.png',
  './assets/sprites/3.png',
  './assets/sprites/card1.png',
  './assets/sprites/cardwallet.png',
  './assets/sprites/cardreff.png',
  './assets/sprites/connect.png',
  './assets/sprites/play.png',
  './assets/sprites/box2.png',
  './assets/sprites/wall1.png',
  './assets/sprites/char.gif',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png'
];

// Install – precache core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    }).then(() => self.skipWaiting())
  );
});

// Activate – clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch – cache first for static, network first for API
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Network-first for external APIs (Supabase, CDNs, etc.)
  if (url.origin !== location.origin) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Clone and cache CDN resources
          if (response.ok && (url.href.includes('fonts.googleapis') || url.href.includes('fonts.gstatic') || url.href.includes('cdnjs') || url.href.includes('unpkg'))) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-first for local assets
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
