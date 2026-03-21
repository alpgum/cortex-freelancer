// [470] Enhanced service worker for offline tool usage
// Cache HTML, CSS, JS for offline capability
const CACHE_NAME = 'cortex-v4';
const OFFLINE_URL = '/offline.html';
const APP_SHELL = [
  '/',
  '/offline.html',
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
  '/app/tools/bio-generator.html',
  '/app/tools/meeting-notes.html',
  '/app/tools/sow-generator.html',
  '/app/tools/project-brief.html',
  '/app/tools/job-scanner.html',
  '/app/tools/time-tracker.html',
  '/app/tools/client-crm.html',
  '/app/tools/client-red-flags.html',
  '/app/tools/portfolio-review.html',
  '/app/tools/project-tracker.html',
  '/app/tools/tax-estimator.html',
  '/app/tools/income-dashboard.html',
  '/app/tools/availability.html',
  '/app/tools/job-digest.html',
  '/app/engine.js',
  '/app/keyboard-shortcuts.js',
  '/app/_includes/shortcuts.js',
  '/app/_includes/footer.js',
  '/app/_includes/share-feedback.js',
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
  // Navigation: network-first
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request).then(cached => cached || caches.match(OFFLINE_URL)))
    );
    return;
  }

  // Static assets: cache-first with network fallback
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.ok && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Return offline fallback for failed requests
        if (event.request.destination === 'document') {
          return caches.match(OFFLINE_URL);
        }
        return new Response('', { status: 408, statusText: 'Offline' });
      });
    })
  );
});

// Notify clients when back online
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
