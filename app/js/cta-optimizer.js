/**
 * CF-229: CTA Button Copy and Placement Optimizer
 * A/B tests CTA variations: 'Start Free' vs 'Try Free Tools' vs 'Boost Your Upwork Profile'.
 * Tracks clicks and conversions per variant.
 *
 * @namespace window.CortexFreelancer.CTAOptimizer
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  var STORAGE_KEY = 'cf_cta_variant';
  var METRICS_KEY = 'cf_cta_metrics';

  var VARIANTS = [
    { id: 'start_free', text: 'Start Free' },
    { id: 'try_free_tools', text: 'Try Free Tools' },
    { id: 'boost_profile', text: 'Boost Your Upwork Profile' }
  ];

  var state = {
    variant: null,
    initialized: false
  };

  // ─── Helpers ───────────────────────────────────────────

  function pickVariant() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        for (var i = 0; i < VARIANTS.length; i++) {
          if (VARIANTS[i].id === saved) return VARIANTS[i];
        }
      }
    } catch (e) { /* noop */ }
    var chosen = VARIANTS[Math.floor(Math.random() * VARIANTS.length)];
    try {
      localStorage.setItem(STORAGE_KEY, chosen.id);
    } catch (e) { /* noop */ }
    return chosen;
  }

  function getMetrics() {
    try {
      return JSON.parse(localStorage.getItem(METRICS_KEY) || '{}');
    } catch (e) {
      return {};
    }
  }

  function saveMetrics(metrics) {
    try {
      localStorage.setItem(METRICS_KEY, JSON.stringify(metrics));
    } catch (e) { /* noop */ }
  }

  function recordEvent(variantId, eventType) {
    var metrics = getMetrics();
    if (!metrics[variantId]) {
      metrics[variantId] = { impressions: 0, clicks: 0, conversions: 0 };
    }
    metrics[variantId][eventType] = (metrics[variantId][eventType] || 0) + 1;
    saveMetrics(metrics);
    return metrics[variantId];
  }

  // ─── CTA Application ──────────────────────────────────

  function applyCTA(variant) {
    var buttons = document.querySelectorAll('[data-cta="primary"]');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].textContent = variant.text;
      buttons[i].setAttribute('data-cta-variant', variant.id);
    }
    recordEvent(variant.id, 'impressions');
  }

  function handleClick(e) {
    var btn = e.target.closest('[data-cta-variant]');
    if (!btn) return;
    var variantId = btn.getAttribute('data-cta-variant');
    if (variantId) {
      recordEvent(variantId, 'clicks');
    }
  }

  // ─── Public API ────────────────────────────────────────

  function init() {
    if (state.initialized) return;
    state.initialized = true;
    state.variant = pickVariant();
    applyCTA(state.variant);
    document.addEventListener('click', handleClick);
  }

  function trackConversion() {
    if (state.variant) {
      recordEvent(state.variant.id, 'conversions');
    }
  }

  function getReport() {
    var metrics = getMetrics();
    var report = [];
    for (var i = 0; i < VARIANTS.length; i++) {
      var v = VARIANTS[i];
      var m = metrics[v.id] || { impressions: 0, clicks: 0, conversions: 0 };
      var ctr = m.impressions > 0 ? ((m.clicks / m.impressions) * 100).toFixed(1) : '0.0';
      var cvr = m.clicks > 0 ? ((m.conversions / m.clicks) * 100).toFixed(1) : '0.0';
      report.push({
        id: v.id,
        text: v.text,
        impressions: m.impressions,
        clicks: m.clicks,
        conversions: m.conversions,
        ctr: ctr + '%',
        conversionRate: cvr + '%'
      });
    }
    return report;
  }

  function getCurrentVariant() {
    return state.variant;
  }

  function resetMetrics() {
    try { localStorage.removeItem(METRICS_KEY); } catch (e) { /* noop */ }
  }

  window.CortexFreelancer.CTAOptimizer = {
    init: init,
    trackConversion: trackConversion,
    getReport: getReport,
    getCurrentVariant: getCurrentVariant,
    resetMetrics: resetMetrics,
    VARIANTS: VARIANTS
  };
})();
