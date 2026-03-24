/**
 * CF-098 — Service Worker: fix offline fallback page
 * Serves proper offline.html when network is unavailable
 */
(function () {
  const ns = (window.CortexFreelancer = window.CortexFreelancer || {});

  const OFFLINE_PAGE = '/offline.html';
  const OFFLINE_CACHE = 'cortex-offline-v1';

  /**
   * Pre-cache the offline page during SW install
   */
  function precacheOfflinePage() {
    return caches.open(OFFLINE_CACHE).then(function (cache) {
      return cache.add(OFFLINE_PAGE).catch(function (err) {
        console.warn('[SWOffline] Failed to precache offline page:', err);
      });
    });
  }

  /**
   * Serve offline fallback for navigation requests that fail
   */
  function getOfflineFallback() {
    return caches.open(OFFLINE_CACHE).then(function (cache) {
      return cache.match(OFFLINE_PAGE);
    }).then(function (response) {
      return response || new Response(
        '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Offline</title>' +
        '<meta name="viewport" content="width=device-width,initial-scale=1">' +
        '<style>body{font-family:system-ui;display:flex;align-items:center;justify-content:center;' +
        'min-height:100vh;margin:0;background:#0f172a;color:#94a3b8;text-align:center}' +
        '.box{max-width:400px;padding:2rem}h1{color:#e2e8f0;font-size:1.5rem}' +
        'button{margin-top:1rem;padding:.5rem 1.5rem;background:#6366f1;color:#fff;' +
        'border:none;border-radius:6px;cursor:pointer;font-size:1rem}</style></head>' +
        '<body><div class="box"><h1>You\'re Offline</h1>' +
        '<p>It looks like you\'ve lost your internet connection. Some features may not be available.</p>' +
        '<button onclick="window.location.reload()">Try Again</button></div></body></html>',
        { headers: { 'Content-Type': 'text/html' } }
      );
    });
  }

  /**
   * Check if a request is a navigation (HTML page) request
   */
  function isNavigationRequest(request) {
    return request.mode === 'navigate' ||
      (request.method === 'GET' && request.headers.get('accept').includes('text/html'));
  }

  /**
   * Detect online/offline status and show banner
   */
  function initOfflineDetection() {
    function showBanner(online) {
      var existing = document.getElementById('offline-banner');
      if (existing) existing.remove();

      if (online) return;

      var banner = document.createElement('div');
      banner.id = 'offline-banner';
      banner.style.cssText =
        'position:fixed;top:0;left:0;right:0;background:#b45309;color:#fff;' +
        'text-align:center;padding:8px;font-size:14px;z-index:99999;';
      banner.textContent = 'You are offline. Some features may not work.';
      document.body.appendChild(banner);
    }

    window.addEventListener('online', function () { showBanner(true); });
    window.addEventListener('offline', function () { showBanner(false); });

    if (!navigator.onLine) showBanner(false);
  }

  ns.SWOfflineFallback = {
    OFFLINE_PAGE: OFFLINE_PAGE,
    precacheOfflinePage: precacheOfflinePage,
    getOfflineFallback: getOfflineFallback,
    isNavigationRequest: isNavigationRequest,
    initOfflineDetection: initOfflineDetection
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initOfflineDetection);
  } else {
    initOfflineDetection();
  }
})();
