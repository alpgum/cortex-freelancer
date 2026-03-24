/**
 * CF-096 — Service Worker: stale-while-revalidate strategy
 * Replaces cache-first with stale-while-revalidate for HTML/JS files
 */
(function () {
  const ns = (window.CortexFreelancer = window.CortexFreelancer || {});

  const CACHE_NAME = 'cortex-swr-v1';
  const SWR_EXTENSIONS = ['.html', '.js', '.css'];
  const CACHE_FIRST_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff2'];
  const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

  function shouldUseSWR(url) {
    var pathname = new URL(url).pathname;
    return SWR_EXTENSIONS.some(function (ext) { return pathname.endsWith(ext); });
  }

  function shouldCacheFirst(url) {
    var pathname = new URL(url).pathname;
    return CACHE_FIRST_EXTENSIONS.some(function (ext) { return pathname.endsWith(ext); });
  }

  function isExpired(response) {
    var dateHeader = response.headers.get('date');
    if (!dateHeader) return false;
    var age = Date.now() - new Date(dateHeader).getTime();
    return age > MAX_AGE_MS;
  }

  /**
   * Stale-while-revalidate: return cache immediately, fetch in background
   */
  function staleWhileRevalidate(request) {
    return caches.open(CACHE_NAME).then(function (cache) {
      return cache.match(request).then(function (cached) {
        var fetchPromise = fetch(request).then(function (response) {
          if (response.ok) {
            cache.put(request, response.clone());
          }
          return response;
        }).catch(function () {
          return cached; // network fail, return stale
        });

        return cached || fetchPromise;
      });
    });
  }

  /**
   * Cache-first: return cache if available, else fetch and cache
   */
  function cacheFirst(request) {
    return caches.open(CACHE_NAME).then(function (cache) {
      return cache.match(request).then(function (cached) {
        if (cached && !isExpired(cached)) return cached;
        return fetch(request).then(function (response) {
          if (response.ok) cache.put(request, response.clone());
          return response;
        }).catch(function () {
          return cached; // fallback to stale cache
        });
      });
    });
  }

  /**
   * Network-only: no caching (for API calls)
   */
  function networkOnly(request) {
    return fetch(request);
  }

  function getStrategy(url) {
    if (shouldUseSWR(url)) return 'swr';
    if (shouldCacheFirst(url)) return 'cache-first';
    return 'network-only';
  }

  function handleFetch(request) {
    var strategy = getStrategy(request.url);
    switch (strategy) {
      case 'swr': return staleWhileRevalidate(request);
      case 'cache-first': return cacheFirst(request);
      default: return networkOnly(request);
    }
  }

  ns.SWStrategy = {
    CACHE_NAME: CACHE_NAME,
    staleWhileRevalidate: staleWhileRevalidate,
    cacheFirst: cacheFirst,
    networkOnly: networkOnly,
    getStrategy: getStrategy,
    handleFetch: handleFetch,
    shouldUseSWR: shouldUseSWR
  };
})();
