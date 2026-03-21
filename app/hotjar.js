/* ===== HOTJAR — Heatmaps & Session Recording ===== */
/* [237] Hotjar snippet, respects cookie consent */

(function() {
  'use strict';

  // [376] Load Hotjar ID from config/analytics.json or window override
  var HOTJAR_ID = window.__HOTJAR_ID || 0;
  var CONSENT_KEY = 'cortex_cookie_consent';

  if (!window.__HOTJAR_ID) {
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', '/config/analytics.json', false);
      xhr.send();
      if (xhr.status === 200) {
        var cfg = JSON.parse(xhr.responseText);
        if (cfg.hotjar && cfg.hotjar.site_id && cfg.hotjar.enabled) {
          HOTJAR_ID = cfg.hotjar.site_id;
        }
      }
    } catch (e) { /* use default */ }
  }

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
