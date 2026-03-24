// [CF-096→099] Enhanced service worker
// CF-096: Stale-while-revalidate for static assets
// CF-097: Cache versioning with auto-purge
// CF-098: Proper offline fallback
// CF-099: Exclude API routes from caching

var CACHE_VERSION = 5;
var CACHE_NAME = 'cortex-v' + CACHE_VERSION;
var OFFLINE_URL = '/offline.html';

var APP_SHELL = [
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

// [CF-099] Patterns to never cache
function isApiRoute(url) {
  var path = new URL(url).pathname;
  return path.startsWith('/api/') ||
         path.startsWith('/__/') ||
         url.includes('firestore.googleapis.com') ||
         url.includes('identitytoolkit.googleapis.com') ||
         url.includes('securetoken.googleapis.com') ||
         url.includes('googleapis.com/identitytoolkit') ||
         url.includes('google-analytics.com') ||
         url.includes('googletagmanager.com') ||
         url.includes('sentry.io') ||
         url.includes('stripe.com');
}

// ── Install: precache app shell ──
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(APP_SHELL);
    })
  );
  self.skipWaiting();
});

// ── Activate: purge old caches ── [CF-097]
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) {
          // Delete any cache that starts with 'cortex-' but isn't current version
          return k.startsWith('cortex-') && k !== CACHE_NAME;
        }).map(function (k) {
          return caches.delete(k);
        })
      );
    })
  );
  self.clients.claim();
});

// ── Fetch handler ──
self.addEventListener('fetch', function (event) {
  var request = event.request;

  // Only handle GET requests
  if (request.method !== 'GET') return;

  // [CF-099] Never cache API routes or external tracking/auth endpoints
  if (isApiRoute(request.url)) return;

  // [CF-098] Navigation: network-first with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(function (response) {
          // Cache successful navigation responses
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(request, clone);
          });
          return response;
        })
        .catch(function () {
          return caches.match(request).then(function (cached) {
            return cached || caches.match(OFFLINE_URL);
          });
        })
    );
    return;
  }

  // [CF-096] Static assets: stale-while-revalidate
  // Serve from cache immediately, then update cache in background
  event.respondWith(
    caches.match(request).then(function (cached) {
      var fetchPromise = fetch(request).then(function (response) {
        // Only cache successful GET responses
        if (response.ok) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(request, clone);
          });
        }
        return response;
      }).catch(function () {
        // Network failed — if we have no cached version, return offline stub
        if (!cached) {
          if (request.destination === 'document') {
            return caches.match(OFFLINE_URL);
          }
          return new Response('', { status: 408, statusText: 'Offline' });
        }
        // cached will be returned below
        return cached;
      });

      // Return cached version immediately if available, otherwise wait for network
      return cached || fetchPromise;
    })
  );
});

// ── [CF-100] Notify clients when a new version is waiting ──
self.addEventListener('message', function (event) {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
  if (event.data === 'getVersion') {
    event.ports[0].postMessage({ version: CACHE_VERSION });
  }
});
