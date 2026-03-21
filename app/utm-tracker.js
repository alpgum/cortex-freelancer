/* ===== UTM TRACKER — Capture & Persist UTM + Referrer ===== */
/* [234] Capture UTM params from URL, persist in localStorage */
/* [236] Capture document.referrer, categorize source */

(function() {
  'use strict';

  var STORAGE_KEY = 'cortex_utm';
  var REFERRER_KEY = 'cortex_referrer';

  // ── UTM CAPTURE [234] ──

  var UTM_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];

  function captureUTM() {
    var params = new URLSearchParams(window.location.search);
    var utm = {};
    var hasUTM = false;

    for (var i = 0; i < UTM_PARAMS.length; i++) {
      var val = params.get(UTM_PARAMS[i]);
      if (val) {
        utm[UTM_PARAMS[i]] = val;
        hasUTM = true;
      }
    }

    if (hasUTM) {
      utm.captured_at = new Date().toISOString();
      utm.landing_page = window.location.pathname;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(utm));
    }
  }

  function getUTM() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch (e) {
      return {};
    }
  }

  // ── REFERRER CAPTURE [236] ──

  var SOURCE_CATEGORIES = {
    search: ['google', 'bing', 'yahoo', 'duckduckgo', 'baidu', 'yandex'],
    social: ['facebook', 'twitter', 'linkedin', 'instagram', 'reddit', 'tiktok', 'youtube', 'pinterest'],
    email: ['mail.google', 'outlook', 'yahoo.com/mail'],
    paid: ['googleads', 'doubleclick', 'googlesyndication']
  };

  function categorizeReferrer(referrer) {
    if (!referrer) return 'direct';

    var hostname;
    try {
      hostname = new URL(referrer).hostname.toLowerCase();
    } catch (e) {
      return 'unknown';
    }

    // Same site
    if (hostname === window.location.hostname) return 'internal';

    for (var category in SOURCE_CATEGORIES) {
      var sources = SOURCE_CATEGORIES[category];
      for (var i = 0; i < sources.length; i++) {
        if (hostname.indexOf(sources[i]) !== -1) return category;
      }
    }

    return 'referral';
  }

  function captureReferrer() {
    var existing = localStorage.getItem(REFERRER_KEY);
    if (existing) return; // Only capture first referrer per session

    var referrer = document.referrer || '';
    var category = categorizeReferrer(referrer);

    var data = {
      referrer: referrer || 'direct',
      category: category,
      captured_at: new Date().toISOString(),
      landing_page: window.location.pathname
    };

    localStorage.setItem(REFERRER_KEY, JSON.stringify(data));
  }

  function getReferrer() {
    try {
      return JSON.parse(localStorage.getItem(REFERRER_KEY)) || {};
    } catch (e) {
      return {};
    }
  }

  // ── INIT ──

  captureUTM();
  captureReferrer();

  // ── PUBLIC API ──

  window.CortexUTM = {
    getUTM: getUTM,
    getReferrer: getReferrer,
    getAll: function() {
      return {
        utm: getUTM(),
        referrer: getReferrer()
      };
    },
    /** [344] Return flat object for waitlist/event payloads */
    getTrackingPayload: function() {
      var u = getUTM();
      var r = getReferrer();
      return {
        utm_source: u.utm_source || '',
        utm_medium: u.utm_medium || '',
        utm_campaign: u.utm_campaign || '',
        referrer_category: r.category || 'direct',
        landing_page: u.landing_page || r.landing_page || window.location.pathname
      };
    }
  };

})();
