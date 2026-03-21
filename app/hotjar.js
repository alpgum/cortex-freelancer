/* ===== HOTJAR — Heatmaps & Session Recording ===== */
/* [237] Hotjar snippet, respects cookie consent */

(function() {
  'use strict';

  var HOTJAR_ID = window.__HOTJAR_ID || 0;
  var CONSENT_KEY = 'cortex_cookie_consent';

  function hasConsent() {
    return localStorage.getItem(CONSENT_KEY) === 'accepted';
  }

  function loadHotjar() {
    if (!HOTJAR_ID || window.hj) return;

    (function(h, o, t, j, a, r) {
      h.hj = h.hj || function() { (h.hj.q = h.hj.q || []).push(arguments); };
      h._hjSettings = { hjid: HOTJAR_ID, hjsv: 6 };
      a = o.getElementsByTagName('head')[0];
      r = o.createElement('script');
      r.async = 1;
      r.src = t + h._hjSettings.hjid + j + h._hjSettings.hjsv;
      a.appendChild(r);
    })(window, document, 'https://static.hotjar.com/c/hotjar-', '.js?sv=');
  }

  if (hasConsent() && HOTJAR_ID) {
    loadHotjar();
  }

  // Load on consent grant
  window.addEventListener('storage', function(e) {
    if (e.key === CONSENT_KEY && e.newValue === 'accepted') {
      loadHotjar();
    }
  });
})();
