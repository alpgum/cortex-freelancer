/* ===== [251] WEB VITALS — Track LCP, FID, CLS and report to GA4 ===== */
(function() {
  'use strict';

  var reported = {};

  function sendToGA4(name, value, rating) {
    if (reported[name]) return;
    reported[name] = true;

    if (typeof window.gtag === 'function') {
      window.gtag('event', name, {
        value: Math.round(name === 'CLS' ? value * 1000 : value),
        event_category: 'Web Vitals',
        event_label: rating || getVitalRating(name, value),
        non_interaction: true
      });
    }

    // Also push to dataLayer for GTM
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: 'web_vitals',
      web_vital_name: name,
      web_vital_value: value,
      web_vital_rating: rating || getVitalRating(name, value)
    });
  }

  function getVitalRating(name, value) {
    var thresholds = {
      LCP: [2500, 4000],
      FID: [100, 300],
      CLS: [0.1, 0.25],
      INP: [200, 500],
      TTFB: [800, 1800]
    };
    var t = thresholds[name];
    if (!t) return 'unknown';
    if (value <= t[0]) return 'good';
    if (value <= t[1]) return 'needs-improvement';
    return 'poor';
  }

  // ── LCP (Largest Contentful Paint) ──
  if (typeof PerformanceObserver !== 'undefined') {
    try {
      var lcpObserver = new PerformanceObserver(function(list) {
        var entries = list.getEntries();
        var lastEntry = entries[entries.length - 1];
        if (lastEntry) sendToGA4('LCP', lastEntry.startTime);
      });
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch (e) { /* not supported */ }

    // ── FID (First Input Delay) ──
    try {
      var fidObserver = new PerformanceObserver(function(list) {
        var entries = list.getEntries();
        if (entries.length > 0) {
          sendToGA4('FID', entries[0].processingStart - entries[0].startTime);
        }
      });
      fidObserver.observe({ type: 'first-input', buffered: true });
    } catch (e) { /* not supported */ }

    // ── CLS (Cumulative Layout Shift) ──
    try {
      var clsValue = 0;
      var clsEntries = [];
      var sessionValue = 0;
      var sessionEntries = [];

      var clsObserver = new PerformanceObserver(function(list) {
        list.getEntries().forEach(function(entry) {
          if (!entry.hadRecentInput) {
            var firstEntry = sessionEntries[0];
            var lastEntry = sessionEntries[sessionEntries.length - 1];

            if (sessionValue && entry.startTime - lastEntry.startTime < 1000 && entry.startTime - firstEntry.startTime < 5000) {
              sessionValue += entry.value;
              sessionEntries.push(entry);
            } else {
              sessionValue = entry.value;
              sessionEntries = [entry];
            }

            if (sessionValue > clsValue) {
              clsValue = sessionValue;
              clsEntries = sessionEntries.slice();
            }
          }
        });
      });
      clsObserver.observe({ type: 'layout-shift', buffered: true });

      // Report CLS when page is hidden
      document.addEventListener('visibilitychange', function() {
        if (document.visibilityState === 'hidden' && clsValue > 0) {
          sendToGA4('CLS', clsValue);
        }
      });
    } catch (e) { /* not supported */ }

    // ── INP (Interaction to Next Paint) ──
    try {
      var maxINP = 0;
      var inpObserver = new PerformanceObserver(function(list) {
        list.getEntries().forEach(function(entry) {
          var duration = entry.duration;
          if (duration > maxINP) maxINP = duration;
        });
      });
      inpObserver.observe({ type: 'event', buffered: true });

      document.addEventListener('visibilitychange', function() {
        if (document.visibilityState === 'hidden' && maxINP > 0) {
          sendToGA4('INP', maxINP);
        }
      });
    } catch (e) { /* not supported */ }
  }

  // ── TTFB (Time to First Byte) ──
  try {
    var nav = performance.getEntriesByType('navigation');
    if (nav.length > 0) {
      sendToGA4('TTFB', nav[0].responseStart);
    }
  } catch (e) { /* not supported */ }
})();
