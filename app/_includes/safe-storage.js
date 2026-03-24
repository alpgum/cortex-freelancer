/**
 * [CF-102] Safe localStorage wrapper — handles quota exceeded on Safari
 * Checks available space before writes and prunes old data when near 5MB limit.
 */
(function () {
  'use strict';

  var MAX_BYTES = 4.5 * 1024 * 1024; // 4.5MB threshold (leave buffer under 5MB)

  // Estimate current localStorage usage in bytes
  function estimateUsage() {
    var total = 0;
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        total += key.length + (localStorage.getItem(key) || '').length;
      }
    } catch (e) { /* ignore */ }
    return total * 2; // UTF-16 = 2 bytes per char
  }

  // Keys safe to prune when running low on space, ordered by priority (first = prune first)
  var PRUNABLE_KEYS = [
    'cortex_analyses',
    'cortex_bid_history',
    'cortex_feedback_data',
    'cf_badge_milestones',
    'cf_badge_progress',
    'cortex_bid_strategy_config',
    'cortex_last_touch'
  ];

  // Prune old data to free space
  function pruneIfNeeded() {
    var usage = estimateUsage();
    if (usage < MAX_BYTES) return true;

    for (var i = 0; i < PRUNABLE_KEYS.length; i++) {
      var key = PRUNABLE_KEYS[i];
      var val = localStorage.getItem(key);
      if (!val) continue;

      // Try to trim array-type data to half its size
      try {
        var parsed = JSON.parse(val);
        if (Array.isArray(parsed) && parsed.length > 2) {
          var half = parsed.slice(Math.floor(parsed.length / 2));
          localStorage.setItem(key, JSON.stringify(half));
        } else {
          localStorage.removeItem(key);
        }
      } catch (e) {
        localStorage.removeItem(key);
      }

      usage = estimateUsage();
      if (usage < MAX_BYTES) return true;
    }

    return usage < MAX_BYTES;
  }

  // Safe setItem with quota handling
  function safeSetItem(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (e) {
      // QuotaExceededError
      if (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014) {
        // Try to free space and retry
        if (pruneIfNeeded()) {
          try {
            localStorage.setItem(key, value);
            return true;
          } catch (e2) {
            return false;
          }
        }
        return false;
      }
      return false;
    }
  }

  // Safe getItem
  function safeGetItem(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  // Safe removeItem
  function safeRemoveItem(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) { /* ignore */ }
  }

  // Expose globally
  window.CortexStorage = {
    get: safeGetItem,
    set: safeSetItem,
    remove: safeRemoveItem,
    estimateUsage: estimateUsage,
    pruneIfNeeded: pruneIfNeeded
  };

  // [CF-102] Monkey-patch localStorage.setItem to catch quota errors globally
  var _origSetItem = localStorage.setItem.bind(localStorage);
  try {
    Object.defineProperty(localStorage, 'setItem', {
      value: function (key, value) {
        try {
          _origSetItem(key, value);
        } catch (e) {
          if (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014) {
            console.warn('[CortexStorage] Quota exceeded, pruning old data...');
            pruneIfNeeded();
            try { _origSetItem(key, value); } catch (e2) {
              console.warn('[CortexStorage] Still over quota after pruning, key:', key);
            }
          }
        }
      },
      writable: true,
      configurable: true
    });
  } catch (e) {
    // Some environments don't allow redefining localStorage methods
  }

})();
