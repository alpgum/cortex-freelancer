/**
 * Cortex Freelancer — Subscription Verification Middleware
 * [CF-175] Checks Firestore for active Pro subscription before allowing access.
 *
 * Features:
 *   - Middleware pattern for gating Pro features
 *   - Checks SubscriptionStore for active status
 *   - Configurable fallback behavior (redirect, modal, callback)
 *   - Caches verification result per session
 *   - Grace period support for recently expired subscriptions
 *   - init() interface
 */

(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  // ─── Constants ────────────────────────────────────────────────────

  var CACHE_KEY = 'cf_sub_verified';
  var CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
  var GRACE_PERIOD_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

  var DENY_ACTIONS = {
    MODAL: 'modal',
    REDIRECT: 'redirect',
    CALLBACK: 'callback',
    SILENT: 'silent'
  };

  // ─── State ────────────────────────────────────────────────────────

  var state = {
    cache: null,
    cacheTime: 0,
    onDeny: DENY_ACTIONS.MODAL,
    denyCallback: null,
    redirectUrl: '/pricing',
    gracePeriod: true
  };

  // ─── Helpers ──────────────────────────────────────────────────────

  function getStore() {
    return window.CortexFreelancer.SubscriptionStore || null;
  }

  function getUpgradeModal() {
    return window.CortexFreelancer.UpgradeModal || null;
  }

  function isCacheValid() {
    return state.cache !== null && (Date.now() - state.cacheTime) < CACHE_TTL_MS;
  }

  function setCacheResult(result) {
    state.cache = result;
    state.cacheTime = Date.now();
  }

  function checkGracePeriod(sub) {
    if (!state.gracePeriod || !sub || !sub.period_end) return false;
    var endDate = new Date(sub.period_end).getTime();
    return Date.now() < endDate + GRACE_PERIOD_MS;
  }

  // ─── Verification Logic ───────────────────────────────────────────

  function verifyPro() {
    if (isCacheValid()) {
      return Promise.resolve(state.cache);
    }

    var store = getStore();
    if (!store) {
      setCacheResult(false);
      return Promise.resolve(false);
    }

    if (store.isPro()) {
      setCacheResult(true);
      return Promise.resolve(true);
    }

    // Check grace period
    var sub = store.getSubscription();
    if (sub && sub.plan === 'pro' && checkGracePeriod(sub)) {
      setCacheResult(true);
      return Promise.resolve(true);
    }

    setCacheResult(false);
    return Promise.resolve(false);
  }

  function handleDenied(featureName) {
    switch (state.onDeny) {
      case DENY_ACTIONS.MODAL:
        var modal = getUpgradeModal();
        if (modal && modal.show) {
          modal.show({ feature: featureName });
        }
        break;

      case DENY_ACTIONS.REDIRECT:
        window.location.href = state.redirectUrl;
        break;

      case DENY_ACTIONS.CALLBACK:
        if (typeof state.denyCallback === 'function') {
          state.denyCallback(featureName);
        }
        break;

      case DENY_ACTIONS.SILENT:
        break;
    }
  }

  // ─── Middleware ────────────────────────────────────────────────────

  function requirePro(featureName, onAllowed, onDenied) {
    return verifyPro().then(function (allowed) {
      if (allowed) {
        if (typeof onAllowed === 'function') onAllowed();
        return true;
      }
      if (typeof onDenied === 'function') {
        onDenied(featureName);
      } else {
        handleDenied(featureName);
      }
      return false;
    });
  }

  function guard(featureName) {
    return function (action) {
      return requirePro(featureName, action);
    };
  }

  function wrapAction(featureName, actionFn) {
    return function () {
      var args = arguments;
      var self = this;
      return requirePro(featureName, function () {
        actionFn.apply(self, args);
      });
    };
  }

  function guardElement(el, featureName) {
    if (!el) return;

    var originalClick = el.onclick;
    el.onclick = function (e) {
      e.preventDefault();
      e.stopPropagation();
      requirePro(featureName, function () {
        if (typeof originalClick === 'function') {
          originalClick.call(el, e);
        }
      });
    };

    el.setAttribute('data-pro-gated', featureName);
  }

  // ─── Public API ───────────────────────────────────────────────────

  var VerifySubscription = {
    DENY_ACTIONS: DENY_ACTIONS,

    init: function (opts) {
      opts = opts || {};
      if (opts.onDeny) state.onDeny = opts.onDeny;
      if (opts.denyCallback) state.denyCallback = opts.denyCallback;
      if (opts.redirectUrl) state.redirectUrl = opts.redirectUrl;
      if (opts.gracePeriod !== undefined) state.gracePeriod = opts.gracePeriod;
      if (opts.cacheTtl) CACHE_TTL_MS = opts.cacheTtl;

      // Listen for subscription changes to invalidate cache
      var store = getStore();
      if (store && store.on) {
        store.on('change', function () {
          state.cache = null;
          state.cacheTime = 0;
        });
      }
    },

    verify: verifyPro,
    requirePro: requirePro,
    guard: guard,
    wrapAction: wrapAction,
    guardElement: guardElement,

    clearCache: function () {
      state.cache = null;
      state.cacheTime = 0;
    },

    isVerified: function () {
      return isCacheValid() && state.cache === true;
    }
  };

  window.CortexFreelancer.VerifySubscription = VerifySubscription;
})();
