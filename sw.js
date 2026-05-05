// AL Sports Service Worker — v4
// Strategy: cache-first for static assets, network-first for API/Supabase calls

const CACHE_NAME = 'al-sports-v6';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo.png',
  'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow+Condensed:wght@400;600;700&family=Barlow:wght@300;400;500&display=swap'
];

// Install — pre-cache core assets
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // Don't fail install if some assets are unreachable
      });
    })
  );
});

// Activate — clear old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys
        .filter(k => k !== CACHE_NAME)
        .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch — smart routing
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Always go to network for:
  // - Supabase API calls (real-time data must be fresh)
  // - Backend API calls (predictions, chat, scores)
  // - External APIs (api-sports, etc.)
  const isApi = url.hostname.includes('supabase.co') ||
    url.hostname.includes('onrender.com') ||
    url.hostname.includes('api-sports') ||
    url.hostname.includes('football.api-sports') ||
    url.hostname.includes('allorigins') ||
    url.hostname.includes('corsproxy') ||
    url.hostname.includes('rss');

  if (isApi || request.method !== 'GET') {
    event.respondWith(
      fetch(request).catch(() => new Response('{"error":"offline"}', {
        headers: { 'Content-Type': 'application/json' }
      }))
    );
    return;
  }

  // For Google Fonts — stale-while-revalidate (fast + fresh)
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        cache.match(request).then(cached => {
          const fetched = fetch(request).then(response => {
            cache.put(request, response.clone());
            return response;
          });
          return cached || fetched;
        })
      )
    );
    return;
  }

  // For local HTML/JS/CSS/images — cache-first with network fallback
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response && response.status === 200 && response.type !== 'opaque') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      }).catch(() => {
        // Offline fallback: if navigating to a page, return cached index.html
        if (request.destination === 'document') {
          return caches.match('/index.html');
        }
      });
    })
  );
});

// Listen for skip-waiting message from new SW
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});
