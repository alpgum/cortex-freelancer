/* ===== CORTEX ANALYTICS — GA4 + Custom Events + Funnel ===== */
/* [231] GA4 setup with cookie consent */
/* [232] Custom events: tool_used, upgrade_clicked, checkout_started, checkout_completed */
/* [233] Engagement events: scroll_depth, time_on_page, share_clicked, copy_result */
/* [235] Conversion funnel: visit → signup → first_tool_use → repeat_tool_use → upgrade_clicked → checkout_started → checkout_completed → pro_tool_use */

(function() {
  'use strict';

  var MEASUREMENT_ID = window.__GA_MEASUREMENT_ID || 'G-XXXXXXXXXX';
  var CONSENT_KEY = 'cortex_cookie_consent';

  // ── GA4 CONDITIONAL LOADING [231] ──

  function hasConsent() {
    return localStorage.getItem(CONSENT_KEY) === 'accepted';
  }

  function loadGA4() {
    if (document.querySelector('script[src*="googletagmanager.com/gtag/js"]')) return;
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + MEASUREMENT_ID;
    document.head.appendChild(s);

    window.dataLayer = window.dataLayer || [];
    window.gtag = function() { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', MEASUREMENT_ID, { send_page_view: true });
  }

  function ensureGtag() {
    if (typeof window.gtag !== 'function') {
      window.dataLayer = window.dataLayer || [];
      window.gtag = function() { window.dataLayer.push(arguments); };
    }
  }

  if (hasConsent()) {
    loadGA4();
  } else {
    ensureGtag();
  }

  // Re-check on consent change
  window.addEventListener('storage', function(e) {
    if (e.key === CONSENT_KEY && e.newValue === 'accepted') {
      loadGA4();
    }
  });

  // ── SAFE EVENT HELPER ──

  function track(eventName, params) {
    ensureGtag();
    if (hasConsent()) {
      window.gtag('event', eventName, params || {});
    }
  }

  // ── CUSTOM EVENTS [232] ──

  window.CortexAnalytics = {
    trackToolUsed: function(toolName, opts) {
      track('tool_used', Object.assign({ tool_name: toolName }, opts || {}));
    },
    trackUpgradeClicked: function(source) {
      track('upgrade_clicked', { source_page: source || window.location.pathname });
    },
    trackCheckoutStarted: function(plan) {
      track('checkout_started', { plan: plan || 'pro' });
    },
    trackCheckoutCompleted: function(plan, value) {
      track('checkout_completed', { plan: plan || 'pro', value: value || 0, currency: 'USD' });
    },

    // ── ENGAGEMENT EVENTS [233] ──

    trackShareClicked: function(method, contentId) {
      track('share_clicked', { method: method, content_id: contentId });
    },
    trackCopyResult: function(toolName) {
      track('copy_result', { tool_name: toolName });
    },

    // ── FUNNEL EVENTS [235] ──

    trackVisit: function() {
      track('funnel_visit', { page: window.location.pathname });
    },
    trackSignup: function(method) {
      track('funnel_signup', { method: method || 'email' });
    },
    trackFirstToolUse: function(toolName) {
      track('funnel_first_tool_use', { tool_name: toolName });
    },
    trackRepeatToolUse: function(toolName, count) {
      track('funnel_repeat_tool_use', { tool_name: toolName, use_count: count });
    },
    trackProToolUse: function(toolName) {
      track('funnel_pro_tool_use', { tool_name: toolName });
    },

    // Generic track
    track: track
  };

  // ── SCROLL DEPTH [233] ──

  var scrollMilestones = [25, 50, 75, 100];
  var firedMilestones = {};

  function onScroll() {
    var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    var docHeight = document.documentElement.scrollHeight - window.innerHeight;
    if (docHeight <= 0) return;
    var pct = Math.round((scrollTop / docHeight) * 100);

    for (var i = 0; i < scrollMilestones.length; i++) {
      var m = scrollMilestones[i];
      if (pct >= m && !firedMilestones[m]) {
        firedMilestones[m] = true;
        track('scroll_depth', { depth_pct: m, page: window.location.pathname });
      }
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });

  // ── TIME ON PAGE [233] ──

  var pageStart = Date.now();
  var timeMilestones = [30, 60, 120, 300]; // seconds
  var firedTime = {};

  var timeInterval = setInterval(function() {
    var elapsed = Math.floor((Date.now() - pageStart) / 1000);
    for (var i = 0; i < timeMilestones.length; i++) {
      var t = timeMilestones[i];
      if (elapsed >= t && !firedTime[t]) {
        firedTime[t] = true;
        track('time_on_page', { seconds: t, page: window.location.pathname });
      }
    }
    if (elapsed >= 300) clearInterval(timeInterval);
  }, 5000);

  // ── AUTO-TRACK VISIT [235] ──

  track('funnel_visit', { page: window.location.pathname });

})();
