/**
 * CF-239: Page Speed Optimizer Module
 *
 * Lazy load images, defer non-critical scripts, preconnect to external domains,
 * implement resource hints, and measure/log performance metrics.
 */
window.CortexFreelancer = window.CortexFreelancer || {};

(function () {
  'use strict';

  var PRECONNECT_DOMAINS = [
    'https://fonts.googleapis.com',
    'https://fonts.gstatic.com',
    'https://js.stripe.com',
    'https://apis.google.com',
    'https://www.googletagmanager.com',
    'https://firebaseinstallations.googleapis.com'
  ];

  var PREFETCH_ROUTES = [
    '/tools',
    '/pricing'
  ];

  var metrics = {};

  // ── Resource Hints ──────────────────────────────────────────────────

  function addLink(rel, href, attrs) {
    if (document.querySelector('link[rel="' + rel + '"][href="' + href + '"]')) return;
    var link = document.createElement('link');
    link.rel = rel;
    link.href = href;
    if (attrs) {
      Object.keys(attrs).forEach(function (k) { link.setAttribute(k, attrs[k]); });
    }
    document.head.appendChild(link);
  }

  function setupPreconnects() {
    PRECONNECT_DOMAINS.forEach(function (domain) {
      addLink('preconnect', domain, { crossorigin: '' });
      addLink('dns-prefetch', domain);
    });
  }

  function setupPrefetch() {
    PREFETCH_ROUTES.forEach(function (route) {
      addLink('prefetch', route);
    });
  }

  // ── Lazy Load Images ────────────────────────────────────────────────

  var observer = null;

  function setupLazyImages() {
    // Use native lazy loading where supported
    var images = document.querySelectorAll('img[data-src]');
    if (!images.length) return;

    if ('loading' in HTMLImageElement.prototype) {
      images.forEach(function (img) {
        img.src = img.dataset.src;
        if (img.dataset.srcset) img.srcset = img.dataset.srcset;
        img.loading = 'lazy';
        img.removeAttribute('data-src');
        img.removeAttribute('data-srcset');
      });
      return;
    }

    // Fallback: IntersectionObserver
    if (!('IntersectionObserver' in window)) {
      // Final fallback: load all immediately
      images.forEach(function (img) {
        img.src = img.dataset.src;
        if (img.dataset.srcset) img.srcset = img.dataset.srcset;
      });
      return;
    }

    observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var img = entry.target;
        img.src = img.dataset.src;
        if (img.dataset.srcset) img.srcset = img.dataset.srcset;
        img.removeAttribute('data-src');
        img.removeAttribute('data-srcset');
        observer.unobserve(img);
      });
    }, { rootMargin: '200px 0px' });

    images.forEach(function (img) { observer.observe(img); });
  }

  // ── Script Deferral ─────────────────────────────────────────────────

  /**
   * Load a script after the page is interactive.
   * @param {string} src - Script URL
   * @param {Object} [opts] - { async, defer, onload }
   * @returns {Promise}
   */
  function deferScript(src, opts) {
    opts = opts || {};
    return new Promise(function (resolve, reject) {
      function load() {
        if (document.querySelector('script[src="' + src + '"]')) {
          resolve();
          return;
        }
        var script = document.createElement('script');
        script.src = src;
        script.async = opts.async !== false;
        if (opts.defer) script.defer = true;
        script.onload = function () {
          if (opts.onload) opts.onload();
          resolve();
        };
        script.onerror = reject;
        document.body.appendChild(script);
      }

      if (document.readyState === 'complete') {
        load();
      } else {
        window.addEventListener('load', load);
      }
    });
  }

  /**
   * Defer all scripts marked with data-defer attribute.
   */
  function processDeferredScripts() {
    var scripts = document.querySelectorAll('script[data-defer-src]');
    scripts.forEach(function (el) {
      deferScript(el.dataset.deferSrc);
      el.remove();
    });
  }

  // ── Critical CSS Inlining ───────────────────────────────────────────

  /**
   * Load a stylesheet asynchronously (non-render-blocking).
   * @param {string} href - CSS URL
   */
  function loadStylesheetAsync(href) {
    var link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'style';
    link.href = href;
    link.onload = function () {
      link.rel = 'stylesheet';
    };
    document.head.appendChild(link);

    // Fallback for browsers that don't support preload
    var noscript = document.createElement('noscript');
    noscript.innerHTML = '<link rel="stylesheet" href="' + href + '">';
    document.head.appendChild(noscript);
  }

  // ── Performance Metrics ─────────────────────────────────────────────

  function measurePerformance() {
    if (!window.performance || !window.performance.timing) return;

    // Wait for load to complete
    function collect() {
      var t = window.performance.timing;
      metrics.dnsLookup = t.domainLookupEnd - t.domainLookupStart;
      metrics.tcpConnect = t.connectEnd - t.connectStart;
      metrics.ttfb = t.responseStart - t.requestStart;
      metrics.domContentLoaded = t.domContentLoadedEventEnd - t.navigationStart;
      metrics.fullLoad = t.loadEventEnd - t.navigationStart;
      metrics.domInteractive = t.domInteractive - t.navigationStart;

      // Core Web Vitals via PerformanceObserver (where available)
      collectWebVitals();

      console.log('[PageSpeedOptimizer] Performance metrics:', metrics);
    }

    if (document.readyState === 'complete') {
      setTimeout(collect, 0);
    } else {
      window.addEventListener('load', function () { setTimeout(collect, 0); });
    }
  }

  function collectWebVitals() {
    if (!('PerformanceObserver' in window)) return;

    // Largest Contentful Paint
    try {
      new PerformanceObserver(function (list) {
        var entries = list.getEntries();
        if (entries.length) {
          metrics.lcp = Math.round(entries[entries.length - 1].startTime);
          console.log('[PageSpeedOptimizer] LCP:', metrics.lcp + 'ms');
        }
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    } catch (e) { /* unsupported */ }

    // First Input Delay
    try {
      new PerformanceObserver(function (list) {
        var entries = list.getEntries();
        if (entries.length) {
          metrics.fid = Math.round(entries[0].processingStart - entries[0].startTime);
          console.log('[PageSpeedOptimizer] FID:', metrics.fid + 'ms');
        }
      }).observe({ type: 'first-input', buffered: true });
    } catch (e) { /* unsupported */ }

    // Cumulative Layout Shift
    try {
      var clsValue = 0;
      new PerformanceObserver(function (list) {
        list.getEntries().forEach(function (entry) {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
          }
        });
        metrics.cls = Math.round(clsValue * 1000) / 1000;
      }).observe({ type: 'layout-shift', buffered: true });
    } catch (e) { /* unsupported */ }
  }

  // ── Initialization ──────────────────────────────────────────────────

  /**
   * Initialize all page speed optimizations.
   * @param {Object} [options]
   * @param {boolean} [options.lazyImages=true]
   * @param {boolean} [options.preconnect=true]
   * @param {boolean} [options.prefetch=true]
   * @param {boolean} [options.deferScripts=true]
   * @param {boolean} [options.measurePerf=true]
   * @param {string[]} [options.extraPreconnects]
   */
  function init(options) {
    options = Object.assign({
      lazyImages: true,
      preconnect: true,
      prefetch: true,
      deferScripts: true,
      measurePerf: true
    }, options || {});

    if (options.extraPreconnects) {
      options.extraPreconnects.forEach(function (d) {
        if (PRECONNECT_DOMAINS.indexOf(d) === -1) PRECONNECT_DOMAINS.push(d);
      });
    }

    if (options.preconnect) setupPreconnects();
    if (options.prefetch) setupPrefetch();
    if (options.lazyImages) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupLazyImages);
      } else {
        setupLazyImages();
      }
    }
    if (options.deferScripts) processDeferredScripts();
    if (options.measurePerf) measurePerformance();
  }

  // ── Public API ──────────────────────────────────────────────────────
  window.CortexFreelancer.PageSpeedOptimizer = {
    init: init,
    deferScript: deferScript,
    loadStylesheetAsync: loadStylesheetAsync,
    setupLazyImages: setupLazyImages,
    getMetrics: function () { return Object.assign({}, metrics); },
    destroy: function () {
      if (observer) { observer.disconnect(); observer = null; }
    }
  };
})();
