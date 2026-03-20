// Cortex Freelancer — Pro Status Checker
// Reads isPro from Firestore users/{uid}, caches in localStorage as fallback

(function() {
  'use strict';

  var PRO_CACHE_KEY = 'cortex_pro_status';
  var PRO_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Check Pro status for a given uid.
   * Reads from Firestore, caches in localStorage.
   * Returns a Promise<boolean>.
   */
  window.checkProStatus = async function(uid) {
    if (!uid) return false;

    // Check localStorage cache first
    try {
      var cached = JSON.parse(localStorage.getItem(PRO_CACHE_KEY));
      if (cached && cached.uid === uid && (Date.now() - cached.ts) < PRO_CACHE_TTL) {
        return cached.isPro;
      }
    } catch (e) { /* ignore */ }

    // Read from Firestore
    var db = window._cortexFirestore;
    if (!db) return _fallbackProCheck(uid);

    try {
      var doc = await db.collection('users').doc(uid).get();
      if (doc.exists) {
        var data = doc.data();
        var isPro = data.isPro === true;

        // Check expiry
        if (isPro && data.proExpiresAt) {
          var expiry = data.proExpiresAt.toDate ? data.proExpiresAt.toDate() : new Date(data.proExpiresAt);
          if (expiry < new Date()) {
            isPro = false;
          }
        }

        // Cache result
        localStorage.setItem(PRO_CACHE_KEY, JSON.stringify({
          uid: uid,
          isPro: isPro,
          ts: Date.now()
        }));

        // Keep legacy keys in sync
        localStorage.setItem('cortex_pro', isPro ? 'true' : 'false');
        if (isPro) localStorage.setItem('cortex_pro_uid', uid);

        return isPro;
      }
    } catch (err) {
      console.error('Pro status check error:', err);
    }

    return _fallbackProCheck(uid);
  };

  // Fallback: read from localStorage when Firestore is unavailable
  function _fallbackProCheck(uid) {
    if (localStorage.getItem('cortex_pro') === 'true') {
      var storedUid = localStorage.getItem('cortex_pro_uid');
      return !storedUid || storedUid === uid;
    }
    return false;
  }

})();
