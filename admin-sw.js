// admin-sw.js — AL Sports Admin Service Worker
const CACHE = 'al-admin-v1';
self.addEventListener('install', e => {
    e.waitUntil(caches.open(CACHE).then(c => c.addAll([
        '/al-sports/admin.html',
        '/al-sports/admin-logo.png'
    ]).catch(() => {})));
    self.skipWaiting();
});
self.addEventListener('activate', e => {
    e.waitUntil(caches.keys().then(keys =>
        Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ));
    self.clients.claim();
});
self.addEventListener('fetch', e => {
    // Always network-first for admin — never serve stale admin pages
    if (e.request.url.includes('supabase') || e.request.method !== 'GET') return;
    e.respondWith(
        fetch(e.request).catch(() => caches.match(e.request))
    );
});
