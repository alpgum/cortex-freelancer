/**
 * [CF-198] Stripe Test Mode Toggle for Development
 * Environment-based Stripe key switching (test/live).
 * Shows test mode indicator banner when in test mode.
 * Integrates with existing StripeConfig.
 * Exposed on window.CortexFreelancer.StripeTestToggle
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  // ── Key Configuration ────────────────────────────────────────────────

  var KEYS = {
    test: {
      publishable: 'pk_test_REPLACE_WITH_YOUR_TEST_KEY',
      label: 'Test Mode'
    },
    live: {
      publishable: 'pk_live_REPLACE_WITH_YOUR_LIVE_KEY',
      label: 'Live Mode'
    }
  };

  var STORAGE_KEY = 'cf_stripe_mode';
  var BANNER_ID = 'cf-stripe-test-banner';

  // ── State ────────────────────────────────────────────────────────────

  var state = {
    mode: null, // 'test' or 'live'
    listeners: []
  };

  // ── Environment Detection ────────────────────────────────────────────

  function detectEnvironment() {
    var host = window.location.hostname;
    // Auto-detect: localhost / staging → test, production → live
    if (host === 'localhost' || host === '127.0.0.1' || host.indexOf('.local') !== -1) {
      return 'test';
    }
    if (host.indexOf('staging') !== -1 || host.indexOf('preview') !== -1 || host.indexOf('dev') !== -1) {
      return 'test';
    }
    return 'live';
  }

  function getStoredMode() {
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'test' || stored === 'live') return stored;
    } catch (e) { /* ignore */ }
    return null;
  }

  function storeMode(mode) {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch (e) { /* ignore */ }
  }

  // ── Mode Management ──────────────────────────────────────────────────

  function resolveMode() {
    // Priority: manual override > URL param > environment detection
    var stored = getStoredMode();
    if (stored) return stored;

    var params = new URLSearchParams(window.location.search);
    var paramMode = params.get('stripe_mode');
    if (paramMode === 'test' || paramMode === 'live') return paramMode;

    return detectEnvironment();
  }

  function getMode() {
    return state.mode;
  }

  function isTestMode() {
    return state.mode === 'test';
  }

  function getPublishableKey() {
    return KEYS[state.mode].publishable;
  }

  function setMode(mode) {
    if (mode !== 'test' && mode !== 'live') {
      console.error('[StripeTestToggle] Invalid mode:', mode);
      return;
    }
    state.mode = mode;
    storeMode(mode);
    updateBanner();
    notifyListeners();
    console.info('[StripeTestToggle] Switched to', KEYS[mode].label);
  }

  function toggle() {
    setMode(state.mode === 'test' ? 'live' : 'test');
  }

  // ── Listeners ────────────────────────────────────────────────────────

  function onModeChange(fn) {
    if (typeof fn === 'function') state.listeners.push(fn);
    return function unsubscribe() {
      state.listeners = state.listeners.filter(function (l) { return l !== fn; });
    };
  }

  function notifyListeners() {
    for (var i = 0; i < state.listeners.length; i++) {
      try { state.listeners[i](state.mode); } catch (e) { console.error(e); }
    }
  }

  // ── Test Mode Banner ─────────────────────────────────────────────────

  function createBanner() {
    var existing = document.getElementById(BANNER_ID);
    if (existing) return existing;

    var banner = document.createElement('div');
    banner.id = BANNER_ID;
    banner.style.cssText = [
      'position:fixed', 'top:0', 'left:0', 'right:0', 'z-index:99999',
      'background:#f59e0b', 'color:#000', 'text-align:center',
      'padding:6px 16px', 'font-family:-apple-system,BlinkMacSystemFont,sans-serif',
      'font-size:13px', 'font-weight:600', 'letter-spacing:0.02em',
      'display:flex', 'align-items:center', 'justify-content:center', 'gap:12px'
    ].join(';');

    var label = document.createElement('span');
    label.textContent = '⚠ STRIPE TEST MODE — No real charges will be made';

    var btn = document.createElement('button');
    btn.textContent = 'Switch to Live';
    btn.style.cssText = [
      'background:#000', 'color:#f59e0b', 'border:none', 'border-radius:4px',
      'padding:3px 10px', 'font-size:12px', 'font-weight:600', 'cursor:pointer'
    ].join(';');
    btn.addEventListener('click', function () {
      if (confirm('Switch to Live mode? Real charges will apply.')) {
        setMode('live');
      }
    });

    var dismiss = document.createElement('button');
    dismiss.textContent = '✕';
    dismiss.style.cssText = [
      'background:none', 'border:none', 'color:#000', 'font-size:16px',
      'cursor:pointer', 'padding:0 4px', 'opacity:0.6'
    ].join(';');
    dismiss.addEventListener('click', function () {
      banner.style.display = 'none';
    });

    banner.appendChild(label);
    banner.appendChild(btn);
    banner.appendChild(dismiss);

    return banner;
  }

  function updateBanner() {
    var banner = document.getElementById(BANNER_ID);
    if (state.mode === 'test') {
      if (!banner) {
        banner = createBanner();
        if (document.body) {
          document.body.appendChild(banner);
          document.body.style.paddingTop = '36px';
        }
      }
      banner.style.display = 'flex';
    } else {
      if (banner) {
        banner.style.display = 'none';
        document.body.style.paddingTop = '';
      }
    }
  }

  // ── Init ──────────────────────────────────────────────────────────────

  function init(opts) {
    opts = opts || {};
    if (opts.testKey) KEYS.test.publishable = opts.testKey;
    if (opts.liveKey) KEYS.live.publishable = opts.liveKey;

    state.mode = resolveMode();
    console.info('[StripeTestToggle] Initialized in', KEYS[state.mode].label,
      '(' + (getStoredMode() ? 'stored' : 'auto-detected') + ')');

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', updateBanner);
    } else {
      updateBanner();
    }
  }

  // ── Public API ────────────────────────────────────────────────────────

  window.CortexFreelancer.StripeTestToggle = {
    init: init,
    getMode: getMode,
    setMode: setMode,
    toggle: toggle,
    isTestMode: isTestMode,
    getPublishableKey: getPublishableKey,
    onModeChange: onModeChange
  };
})();
