/**
 * CF-097 — Service Worker: cache versioning with auto-purge
 * On activation, deletes all caches except current version
 */
(function () {
  const ns = (window.CortexFreelancer = window.CortexFreelancer || {});

  const CACHE_VERSION = 4;
  const CACHE_PREFIX = 'cortex-';
  const CURRENT_CACHES = [
    'cortex-swr-v' + CACHE_VERSION,
    'cortex-static-v' + CACHE_VERSION,
    'cortex-api-v' + CACHE_VERSION
  ];

  function getCurrentVersion() {
    return CACHE_VERSION;
  }

  function getCacheNames() {
    return CURRENT_CACHES.slice();
  }

  function isCurrentCache(name) {
    return CURRENT_CACHES.indexOf(name) !== -1;
  }

  /**
   * Purge all old caches that don't match current version
   */
  function purgeOldCaches() {
    return caches.keys().then(function (cacheNames) {
      var deletions = cacheNames
        .filter(function (name) {
          return name.startsWith(CACHE_PREFIX) && !isCurrentCache(name);
        })
        .map(function (name) {
          console.info('[SWCache] Purging old cache:', name);
          return caches.delete(name);
        });
      return Promise.all(deletions);
    }).then(function (results) {
      if (results.length > 0) {
        console.info('[SWCache] Purged', results.length, 'old caches');
      }
      return results.length;
    });
  }

  /**
   * Get cache storage usage stats
   */
  function getStorageStats() {
    if (!navigator.storage || !navigator.storage.estimate) {
      return Promise.resolve({ usage: 0, quota: 0, percent: 0 });
    }
    return navigator.storage.estimate().then(function (est) {
      return {
        usage: est.usage || 0,
        quota: est.quota || 0,
        percent: est.quota ? Math.round((est.usage / est.quota) * 100) : 0
      };
    });
  }

  /**
   * Force clear all cortex caches
   */
  function clearAllCaches() {
    return caches.keys().then(function (names) {
      return Promise.all(
        names.filter(function (n) { return n.startsWith(CACHE_PREFIX); })
          .map(function (n) { return caches.delete(n); })
      );
    });
  }

  ns.SWCacheVersioning = {
    CACHE_VERSION: CACHE_VERSION,
    getCurrentVersion: getCurrentVersion,
    getCacheNames: getCacheNames,
    isCurrentCache: isCurrentCache,
    purgeOldCaches: purgeOldCaches,
    getStorageStats: getStorageStats,
    clearAllCaches: clearAllCaches
  };
})();
