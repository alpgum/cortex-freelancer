/**
 * Cortex Freelancer — Client-Side Pro Feature Gating
 * [CF-176] Checks subscription on page load, shows upgrade prompts for Pro-only features.
 *
 * Features:
 *   - Auto-scans DOM for [data-pro-feature] elements on load
 *   - Disables/locks Pro features for Free users
 *   - Adds visual lock badges to gated elements
 *   - Shows upgrade prompt on click
 *   - Unlocks all features when Pro is active
 *   - Listens for subscription changes in real-time
 *   - init()/render(containerId) interface
 */

(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  // ─── Constants ────────────────────────────────────────────────────

  var ATTR_FEATURE = 'data-pro-feature';
  var CLASS_LOCKED = 'cf-pro-locked';
  var CLASS_BADGE = 'cf-pro-badge';
  var CLASS_UNLOCKED = 'cf-pro-unlocked';

  // ─── State ────────────────────────────────────────────────────────

  var state = {
    isPro: false,
    gatedElements: [],
    initialized: false
  };

  // ─── Helpers ──────────────────────────────────────────────────────

  function getStore() {
    return window.CortexFreelancer.SubscriptionStore || null;
  }

  function getMatrix() {
    return window.CortexFreelancer.PlanMatrix || null;
  }

  function getModal() {
    return window.CortexFreelancer.UpgradeModal || null;
  }

  function injectStyles() {
    if (document.getElementById('cf-feature-gate-styles')) return;
    var style = document.createElement('style');
    style.id = 'cf-feature-gate-styles';
    style.textContent = [
      '.' + CLASS_LOCKED + ' {',
      '  position: relative;',
      '  opacity: 0.6;',
      '  pointer-events: auto;',
      '  cursor: pointer;',
      '  user-select: none;',
      '}',
      '.' + CLASS_LOCKED + '::after {',
      '  content: "";',
      '  position: absolute;',
      '  top: 0; left: 0; right: 0; bottom: 0;',
      '  background: rgba(0,0,0,0.03);',
      '  border-radius: inherit;',
      '}',
      '.' + CLASS_BADGE + ' {',
      '  display: inline-flex;',
      '  align-items: center;',
      '  gap: 4px;',
      '  padding: 2px 8px;',
      '  font-size: 11px;',
      '  font-weight: 600;',
      '  color: #7c3aed;',
      '  background: #ede9fe;',
      '  border-radius: 9999px;',
      '  position: absolute;',
      '  top: 8px;',
      '  right: 8px;',
      '  z-index: 10;',
      '}',
      '.' + CLASS_UNLOCKED + ' {',
      '  opacity: 1;',
      '  pointer-events: auto;',
      '}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function createBadge() {
    var badge = document.createElement('span');
    badge.className = CLASS_BADGE;
    badge.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg> PRO';
    return badge;
  }

  // ─── Gating Logic ────────────────────────────────────────────────

  function scanAndGate() {
    var elements = document.querySelectorAll('[' + ATTR_FEATURE + ']');
    state.gatedElements = [];

    for (var i = 0; i < elements.length; i++) {
      var el = elements[i];
      var featureName = el.getAttribute(ATTR_FEATURE);
      state.gatedElements.push({ el: el, feature: featureName });

      if (state.isPro) {
        unlockElement(el);
      } else {
        lockElement(el, featureName);
      }
    }
  }

  function lockElement(el, featureName) {
    el.classList.add(CLASS_LOCKED);
    el.classList.remove(CLASS_UNLOCKED);

    // Ensure position relative for badge placement
    var pos = window.getComputedStyle(el).position;
    if (pos === 'static') el.style.position = 'relative';

    // Add badge if not already present
    if (!el.querySelector('.' + CLASS_BADGE)) {
      el.appendChild(createBadge());
    }

    // Intercept clicks
    if (!el._cfGateHandler) {
      el._cfGateHandler = function (e) {
        if (state.isPro) return;
        e.preventDefault();
        e.stopPropagation();
        showUpgradePrompt(featureName);
      };
      el.addEventListener('click', el._cfGateHandler, true);
    }
  }

  function unlockElement(el) {
    el.classList.remove(CLASS_LOCKED);
    el.classList.add(CLASS_UNLOCKED);

    var badge = el.querySelector('.' + CLASS_BADGE);
    if (badge) badge.remove();

    if (el._cfGateHandler) {
      el.removeEventListener('click', el._cfGateHandler, true);
      el._cfGateHandler = null;
    }
  }

  function showUpgradePrompt(featureName) {
    var modal = getModal();
    if (modal && modal.show) {
      modal.show({ feature: featureName });
      return;
    }
    // Fallback
    alert('Upgrade to Pro to access ' + (featureName || 'this feature') + '.');
  }

  function refreshGating() {
    var store = getStore();
    state.isPro = store ? store.isPro() : false;
    scanAndGate();
  }

  // ─── Feature Check API ───────────────────────────────────────────

  function canAccess(featureId) {
    if (state.isPro) return true;
    var matrix = getMatrix();
    if (matrix && matrix.isFreeTier) {
      return matrix.isFreeTier(featureId);
    }
    return false;
  }

  function gateAction(featureId, action) {
    if (canAccess(featureId)) {
      if (typeof action === 'function') action();
      return true;
    }
    showUpgradePrompt(featureId);
    return false;
  }

  // ─── Render ───────────────────────────────────────────────────────

  function render(containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;

    var html = [
      '<div style="padding:16px; background:#faf5ff; border:1px solid #e9d5ff; border-radius:12px;">',
      '  <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">',
      '    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.27 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z"/></svg>',
      '    <h3 style="margin:0; font-size:16px; color:#4c1d95;">Feature Gating</h3>',
      '  </div>',
      '  <p style="margin:0 0 8px; font-size:13px; color:#6b7280;">',
      '    Status: <strong style="color:' + (state.isPro ? '#059669' : '#7c3aed') + '">',
      state.isPro ? 'Pro — All features unlocked' : 'Free — Some features locked',
      '    </strong>',
      '  </p>',
      '  <p style="margin:0; font-size:12px; color:#9ca3af;">',
      '    Gated elements: ' + state.gatedElements.length,
      '  </p>',
      '</div>'
    ].join('\n');

    container.innerHTML = html;
  }

  // ─── Public API ───────────────────────────────────────────────────

  var FeatureGate = {
    init: function (opts) {
      opts = opts || {};
      injectStyles();

      var store = getStore();
      state.isPro = store ? store.isPro() : false;

      // Auto-scan on load
      if (document.readyState === 'complete') {
        scanAndGate();
      } else {
        window.addEventListener('load', scanAndGate);
      }

      // Listen for subscription changes
      if (store && store.on) {
        store.on('change', function () {
          refreshGating();
        });
      }

      state.initialized = true;
    },

    render: render,
    refresh: refreshGating,
    canAccess: canAccess,
    gateAction: gateAction,
    scanAndGate: scanAndGate,

    isPro: function () { return state.isPro; }
  };

  window.CortexFreelancer.FeatureGate = FeatureGate;
})();
