/**
 * CF-105 + CF-106: Fix 404 on direct URL navigation & bookmark loading
 * Ensures relative paths for JS/CSS work regardless of URL depth.
 */
(function () {
  'use strict';
  window.CortexFreelancer = window.CortexFreelancer || {};

  function getBasePath() {
    // Detect app base from a known script tag or meta tag
    var meta = document.querySelector('meta[name="app-base"]');
    if (meta) return meta.getAttribute('content');

    // Infer from current script location
    var scripts = document.getElementsByTagName('script');
    for (var i = 0; i < scripts.length; i++) {
      var src = scripts[i].getAttribute('src') || '';
      var idx = src.indexOf('/app/js/');
      if (idx !== -1) {
        return src.substring(0, idx + 5); // includes '/app/'
      }
    }
    return '/app/';
  }

  function resolveAsset(relativePath) {
    var base = getBasePath();
    if (relativePath.startsWith('/')) return relativePath;
    return base + relativePath.replace(/^\.\//, '');
  }

  /**
   * Fix any elements with broken relative src/href on page load.
   */
  function fixBrokenPaths() {
    var base = getBasePath();
    document.querySelectorAll('link[rel="stylesheet"][href^="./"]').forEach(function (el) {
      el.href = resolveAsset(el.getAttribute('href'));
    });
    document.querySelectorAll('script[src^="./"]').forEach(function (el) {
      // Can't change script src after load, but log for debugging
      console.debug('[PathResolver] Script with relative path:', el.src);
    });
  }

  window.CortexFreelancer.PathResolver = {
    getBasePath: getBasePath,
    resolveAsset: resolveAsset,
    fixBrokenPaths: fixBrokenPaths
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fixBrokenPaths);
  } else {
    fixBrokenPaths();
  }
})();
