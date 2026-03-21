/* ===== A/B TESTING FRAMEWORK ===== */
/* [238] getVariant(testName, variants), consistent per user, track in GA4 */
/* [239] Hero A/B test */
/* [240] CTA button A/B test (3 variants) */

(function() {
  'use strict';

  var STORAGE_KEY = 'cortex_ab_tests';

  function getStoredVariants() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch (e) {
      return {};
    }
  }

  function saveVariants(variants) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(variants));
  }

  /**
   * Get a consistent variant for a test.
   * @param {string} testName - Unique test identifier
   * @param {string[]} variants - Array of variant names
   * @returns {string} The assigned variant
   */
  function getVariant(testName, variants) {
    if (!variants || variants.length === 0) return null;

    var stored = getStoredVariants();

    // Return stored variant if still valid
    if (stored[testName] && variants.indexOf(stored[testName]) !== -1) {
      return stored[testName];
    }

    // Assign new variant using simple hash
    var hash = 0;
    var seed = testName + (navigator.userAgent || '') + (screen.width || '');
    for (var i = 0; i < seed.length; i++) {
      hash = ((hash << 5) - hash) + seed.charCodeAt(i);
      hash = hash & hash;
    }
    var idx = Math.abs(hash) % variants.length;
    var variant = variants[idx];

    stored[testName] = variant;
    saveVariants(stored);

    // Track assignment in GA4
    if (typeof window.gtag === 'function') {
      window.gtag('event', 'ab_test_assignment', {
        test_name: testName,
        variant: variant
      });
    }

    return variant;
  }

  // ── PUBLIC API ──

  window.CortexAB = {
    getVariant: getVariant,
    getAllVariants: getStoredVariants
  };

})();
