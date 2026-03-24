/**
 * CF-099 — Service Worker: exclude API routes from caching
 * Ensures /api/* routes are never cached by service worker
 */
(function () {
  const ns = (window.CortexFreelancer = window.CortexFreelancer || {});

  const EXCLUDED_PATTERNS = [
    /^\/api\//,
    /^\/api$/,
    /\/api\/chat/,
    /\/api\/webhook/,
    /\/api\/stripe/,
    /\/api\/cron\//
  ];

  const EXCLUDED_DOMAINS = [
    'api.anthropic.com',
    'api.stripe.com',
    'firestore.googleapis.com',
    'identitytoolkit.googleapis.com',
    'securetoken.googleapis.com'
  ];

  function isApiRoute(url) {
    try {
      var parsed = new URL(url);
      // Check excluded domains
      if (EXCLUDED_DOMAINS.indexOf(parsed.hostname) !== -1) return true;
      // Check path patterns
      return EXCLUDED_PATTERNS.some(function (pattern) {
        return pattern.test(parsed.pathname);
      });
    } catch (e) {
      return false;
    }
  }

  function shouldCache(url) {
    return !isApiRoute(url);
  }

  /**
   * Middleware to wrap fetch handler — skip caching for API routes
   */
  function wrapFetchHandler(originalHandler) {
    return function (request) {
      if (isApiRoute(request.url)) {
        return fetch(request);
      }
      return originalHandler(request);
    };
  }

  /**
   * Clean any accidentally cached API responses
   */
  function purgeApiFromCaches() {
    return caches.keys().then(function (names) {
      return Promise.all(names.map(function (name) {
        return caches.open(name).then(function (cache) {
          return cache.keys().then(function (requests) {
            var deletions = requests
              .filter(function (req) { return isApiRoute(req.url); })
              .map(function (req) {
                console.info('[SWApiExclude] Purging cached API:', req.url);
                return cache.delete(req);
              });
            return Promise.all(deletions);
          });
        });
      }));
    });
  }

  ns.SWApiExclusion = {
    isApiRoute: isApiRoute,
    shouldCache: shouldCache,
    wrapFetchHandler: wrapFetchHandler,
    purgeApiFromCaches: purgeApiFromCaches,
    EXCLUDED_PATTERNS: EXCLUDED_PATTERNS,
    EXCLUDED_DOMAINS: EXCLUDED_DOMAINS
  };
})();
