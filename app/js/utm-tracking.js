/**
 * CF-243: UTM Parameter Tracking — capture, persist, and pass UTM params end-to-end.
 */
(function () {
  'use strict';

  var UTM_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
  var STORAGE_KEY = 'cortex_utm_data';
  var SESSION_KEY = 'cortex_utm_session';

  /**
   * Capture UTM parameters from the current URL and persist them.
   * Called automatically on load; can also be called manually.
   * @returns {object|null} Captured UTM data or null if none found
   */
  function capture() {
    var params = parseURLParams(window.location.search);
    var utmData = extractUTM(params);

    if (!utmData) return null;

    utmData.landingPage = window.location.pathname;
    utmData.capturedAt = new Date().toISOString();
    utmData.referrer = document.referrer || '';

    persist(utmData);
    return utmData;
  }

  /**
   * Parse query string into key-value pairs.
   * @param {string} queryString
   * @returns {object}
   */
  function parseURLParams(queryString) {
    var result = {};
    if (!queryString || queryString.length < 2) return result;

    var pairs = queryString.substring(1).split('&');
    for (var i = 0; i < pairs.length; i++) {
      var parts = pairs[i].split('=');
      if (parts.length === 2) {
        result[decodeURIComponent(parts[0])] = decodeURIComponent(parts[1]);
      }
    }
    return result;
  }

  /**
   * Extract UTM parameters from parsed params.
   * @param {object} params
   * @returns {object|null}
   */
  function extractUTM(params) {
    var utmData = {};
    var hasAny = false;

    for (var i = 0; i < UTM_PARAMS.length; i++) {
      var key = UTM_PARAMS[i];
      if (params[key]) {
        utmData[key] = params[key];
        hasAny = true;
      }
    }

    return hasAny ? utmData : null;
  }

  /**
   * Persist UTM data to localStorage and sessionStorage.
   * localStorage keeps first-touch attribution; sessionStorage keeps last-touch.
   * @param {object} utmData
   */
  function persist(utmData) {
    try {
      // First-touch: only set if not already stored
      if (!localStorage.getItem(STORAGE_KEY)) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(utmData));
      }
      // Last-touch: always overwrite in session
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(utmData));
    } catch (_e) {
      // Storage unavailable (private browsing, quota exceeded)
    }
  }

  /**
   * Get first-touch UTM data.
   * @returns {object|null}
   */
  function getFirstTouch() {
    try {
      var data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : null;
    } catch (_e) {
      return null;
    }
  }

  /**
   * Get last-touch (current session) UTM data.
   * @returns {object|null}
   */
  function getLastTouch() {
    try {
      var data = sessionStorage.getItem(SESSION_KEY);
      return data ? JSON.parse(data) : null;
    } catch (_e) {
      return null;
    }
  }

  /**
   * Get UTM data to attach to a waitlist signup or analytics event.
   * Returns both first-touch and last-touch attribution.
   * @returns {object}
   */
  function getAttribution() {
    return {
      firstTouch: getFirstTouch(),
      lastTouch: getLastTouch()
    };
  }

  /**
   * Enrich a form data object or event payload with UTM attribution.
   * @param {object} payload - The existing payload to enrich
   * @returns {object} Enriched payload
   */
  function enrichPayload(payload) {
    var attribution = getAttribution();
    var enriched = Object.assign({}, payload);

    if (attribution.firstTouch) {
      enriched.utm_first_touch = attribution.firstTouch;
    }
    if (attribution.lastTouch) {
      enriched.utm_last_touch = attribution.lastTouch;
    }

    return enriched;
  }

  /**
   * Push UTM data to an analytics provider (e.g. GA4, Mixpanel).
   * @param {object} [analyticsProvider] - Object with a `track` or `sendEvent` method
   */
  function pushToAnalytics(analyticsProvider) {
    var attribution = getAttribution();
    var utmData = attribution.lastTouch || attribution.firstTouch;
    if (!utmData) return;

    // GA4 via gtag
    if (typeof window.gtag === 'function') {
      window.gtag('set', {
        campaign_source: utmData.utm_source || '',
        campaign_medium: utmData.utm_medium || '',
        campaign_name: utmData.utm_campaign || '',
        campaign_term: utmData.utm_term || '',
        campaign_content: utmData.utm_content || ''
      });
    }

    // Custom analytics provider
    if (analyticsProvider && typeof analyticsProvider.track === 'function') {
      analyticsProvider.track('utm_captured', utmData);
    }
  }

  /**
   * Clear all stored UTM data.
   */
  function clear() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(SESSION_KEY);
    } catch (_e) {
      // Ignore
    }
  }

  // Auto-capture on load
  capture();

  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.UTMTracking = {
    capture: capture,
    getFirstTouch: getFirstTouch,
    getLastTouch: getLastTouch,
    getAttribution: getAttribution,
    enrichPayload: enrichPayload,
    pushToAnalytics: pushToAnalytics,
    clear: clear
  };
})();
