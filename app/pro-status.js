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

  // ── Subscription Expiry / Grace Period ──
  var GRACE_DAYS = 30;
  var EXPIRED_BANNER_KEY = 'cortex_expired_banner_dismissed';

  /**
   * Check if user is in the grace period (expired but within 30 days).
   * Returns { expired: boolean, graceActive: boolean, daysLeft: number }
   */
  window.checkSubscriptionGrace = async function(uid) {
    var result = { expired: false, graceActive: false, daysLeft: 0 };
    if (!uid) return result;

    var db = window._cortexFirestore;
    if (!db) return result;

    try {
      var doc = await db.collection('users').doc(uid).get();
      if (!doc.exists) return result;

      var data = doc.data();
      if (!data.proExpiresAt) return result;

      var expiry = data.proExpiresAt.toDate ? data.proExpiresAt.toDate() : new Date(data.proExpiresAt);
      var now = new Date();

      if (expiry >= now) return result; // still active

      result.expired = true;
      var daysSinceExpiry = Math.floor((now - expiry) / (1000 * 60 * 60 * 24));
      var daysLeft = GRACE_DAYS - daysSinceExpiry;

      if (daysLeft > 0) {
        result.graceActive = true;
        result.daysLeft = daysLeft;
      }
    } catch (e) {
      console.error('Grace period check error:', e);
    }

    return result;
  };

  /**
   * Show the "Subscription ended" banner if applicable.
   * Call after auth is ready: showExpiredBanner(uid)
   */
  window.showExpiredBanner = async function(uid) {
    if (!uid) return;

    var grace = await window.checkSubscriptionGrace(uid);
    if (!grace.expired) return;

    // Don't re-show if dismissed this session
    if (sessionStorage.getItem(EXPIRED_BANNER_KEY)) return;

    var banner = document.createElement('div');
    banner.id = 'expired-banner';
    banner.style.cssText = 'position:fixed;top:56px;left:0;right:0;z-index:999;background:linear-gradient(135deg,#ff4466,#cc2244);color:#fff;padding:.75rem 2rem;display:flex;align-items:center;justify-content:center;gap:1rem;font-size:.9rem;font-weight:600;flex-wrap:wrap';

    var msg;
    if (grace.graceActive) {
      msg = 'Your subscription has ended. Your data is read-only for ' + grace.daysLeft + ' more day' + (grace.daysLeft !== 1 ? 's' : '') + '.';
    } else {
      msg = 'Your subscription has ended. Resubscribe to regain full access.';
    }

    banner.innerHTML =
      '<span>' + msg + '</span>' +
      '<a href="/pricing" style="background:#fff;color:#cc2244;padding:.4rem 1rem;border-radius:100px;font-weight:700;font-size:.8rem;text-decoration:none;white-space:nowrap">Resubscribe &rarr;</a>' +
      '<button onclick="dismissExpiredBanner()" style="background:none;border:none;color:rgba(255,255,255,.7);font-size:1.1rem;cursor:pointer;padding:0 .25rem">&times;</button>';

    document.body.appendChild(banner);
  };

  window.dismissExpiredBanner = function() {
    var banner = document.getElementById('expired-banner');
    if (banner) banner.remove();
    sessionStorage.setItem(EXPIRED_BANNER_KEY, '1');
  };

})();
