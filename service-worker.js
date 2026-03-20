const CACHE_NAME = 'cortex-v1';
const APP_SHELL = [
  '/',
  '/app/index.html',
  '/app/login.html',
  '/app/chat.html',
  '/app/share.html',
  '/app/tools/index.html',
  '/app/tools/proposal.html',
  '/app/tools/invoice.html',
  '/app/tools/contract-review.html',
  '/app/tools/scope-analyzer.html',
  '/app/tools/payment-checker.html',
  '/app/tools/email-writer.html',
  '/app/tools/fee-calculator.html',
  '/app/tools/rate-calculator.html',
  '/app/tools/templates.html',
  '/app/engine.js',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/favicon.ico'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
