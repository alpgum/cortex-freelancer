// Cortex Freelancer — Tool Usage Limits
// Free users: 3 uses/day per tool. Pro users: unlimited.
// Reads/writes usage counts via Firestore, localStorage fallback.

(function() {
  'use strict';

  var FREE_DAILY_LIMIT = 3;
  var STORAGE_KEY = 'cortex_usage_counts';

  // Get today's date string (YYYY-MM-DD) for daily reset
  function todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  // ── localStorage helpers ──
  function getLocalCounts() {
    try {
      var data = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (data && data.date === todayKey()) return data.counts;
    } catch (e) { /* ignore */ }
    return {};
  }

  function setLocalCounts(counts) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      date: todayKey(),
      counts: counts
    }));
  }

  /**
   * Check if a user can use a tool today.
   * @param {string} uid - Firebase user ID (null for anonymous)
   * @param {string} toolName - Tool identifier (e.g. "rate-analyzer")
   * @returns {Promise<{allowed: boolean, remaining: number, limit: number}>}
   */
  window.checkUsageLimit = async function(uid, toolName) {
    var isPro = false;
    if (uid && window.checkProStatus) {
      isPro = await window.checkProStatus(uid);
    } else if (window.cortexIsPro) {
      isPro = window.cortexIsPro();
    }

    if (isPro) {
      return { allowed: true, remaining: Infinity, limit: Infinity };
    }

    var count = await _getCount(uid, toolName);
    var remaining = Math.max(0, FREE_DAILY_LIMIT - count);

    return {
      allowed: remaining > 0,
      remaining: remaining,
      limit: FREE_DAILY_LIMIT
    };
  };

  /**
   * Increment usage count after a tool is used.
   * @param {string} uid - Firebase user ID (null for anonymous)
   * @param {string} toolName - Tool identifier
   * @returns {Promise<void>}
   */
  window.incrementUsage = async function(uid, toolName) {
    var db = window._cortexFirestore;
    var today = todayKey();

    // Always update localStorage
    var counts = getLocalCounts();
    counts[toolName] = (counts[toolName] || 0) + 1;
    setLocalCounts(counts);

    // Update Firestore if available
    if (db && uid) {
      try {
        var fieldPath = 'toolUsage.' + toolName + '_' + today;
        var update = {};
        update[fieldPath] = firebase.firestore.FieldValue.increment(1);
        await db.collection('users').doc(uid).update(update);
      } catch (err) {
        console.error('Usage increment error:', err);
      }
    }
  };

  // ── Read current count ──
  async function _getCount(uid, toolName) {
    var db = window._cortexFirestore;
    var today = todayKey();

    if (db && uid) {
      try {
        var doc = await db.collection('users').doc(uid).get();
        if (doc.exists) {
          var data = doc.data();
          var usage = data.toolUsage || {};
          return usage[toolName + '_' + today] || 0;
        }
      } catch (err) {
        console.error('Usage read error:', err);
      }
    }

    // Fallback to localStorage
    var counts = getLocalCounts();
    return counts[toolName] || 0;
  }

})();
