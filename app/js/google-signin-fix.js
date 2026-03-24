/**
 * CF-086: Google Sign-In Redirect Fix
 *
 * Debug helper and fix for the common issue where
 * getRedirectResult() returns null after Google Sign-In redirect.
 *
 * Root causes addressed:
 * 1. Missing persistence setting (should be LOCAL for redirects)
 * 2. Cross-origin iframe blocking
 * 3. Browser storage partitioning (Safari, Firefox)
 * 4. signInWithRedirect not storing state correctly
 * 5. Vercel/SPA routing losing the auth response
 *
 * Implements popup fallback when redirect consistently fails.
 *
 * Usage:
 *   CortexFreelancer.googleSignInFix.init(firebaseConfig)
 *   CortexFreelancer.googleSignInFix.signIn()
 *   CortexFreelancer.googleSignInFix.diagnose()
 */
window.CortexFreelancer = window.CortexFreelancer || {};

(function () {
  'use strict';

  var REDIRECT_ATTEMPT_KEY = 'cf_google_redirect_attempt';
  var MAX_REDIRECT_ATTEMPTS = 2;
  var DIAG_KEY = 'cf_google_diag';

  var config = {
    preferPopup: false,        // Force popup mode
    popupFallback: true,       // Fall back to popup after redirect fails
    maxRedirectAttempts: MAX_REDIRECT_ATTEMPTS,
    onSuccess: null,
    onError: null
  };

  // ── Diagnostics ──────────────────────────────────────────────────────

  function detectIssues() {
    var issues = [];

    // Check if third-party cookies are blocked
    try {
      document.cookie = 'cf_test=1; SameSite=None; Secure';
      if (document.cookie.indexOf('cf_test') === -1) {
        issues.push('Third-party cookies may be blocked');
      }
      document.cookie = 'cf_test=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    } catch (e) {
      issues.push('Cookie access error: ' + e.message);
    }

    // Check storage
    try {
      localStorage.setItem('cf_test', '1');
      localStorage.removeItem('cf_test');
    } catch (e) {
      issues.push('localStorage not available: ' + e.message);
    }

    try {
      sessionStorage.setItem('cf_test', '1');
      sessionStorage.removeItem('cf_test');
    } catch (e) {
      issues.push('sessionStorage not available: ' + e.message);
    }

    // Check IndexedDB (Firebase uses this for persistence)
    if (!window.indexedDB) {
      issues.push('IndexedDB not available — Firebase auth persistence may fail');
    }

    // Safari ITP detection
    var isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    if (isSafari) {
      issues.push('Safari detected — ITP may block redirect auth storage');
    }

    // Private/incognito detection
    if (navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then(function (est) {
        if (est.quota && est.quota < 120000000) {
          issues.push('Possible incognito/private mode (low storage quota)');
        }
      });
    }

    // iframe detection
    if (window !== window.top) {
      issues.push('Running inside an iframe — redirect auth will likely fail');
    }

    // Firebase SDK check
    if (typeof firebase === 'undefined') {
      issues.push('Firebase SDK not loaded');
    }

    // Protocol check
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
      issues.push('Not on HTTPS — Firebase auth requires HTTPS in production');
    }

    return issues;
  }

  /**
   * Run full diagnostics and log to console.
   */
  function diagnose() {
    var issues = detectIssues();

    console.group('[GoogleSignInFix] Diagnostics');
    console.log('URL:', window.location.href);
    console.log('Protocol:', window.location.protocol);
    console.log('User Agent:', navigator.userAgent);
    console.log('Cookies enabled:', navigator.cookieEnabled);
    console.log('In iframe:', window !== window.top);

    if (issues.length === 0) {
      console.log('✅ No issues detected');
    } else {
      console.warn('⚠️ Found', issues.length, 'potential issue(s):');
      issues.forEach(function (issue, i) {
        console.warn('  ' + (i + 1) + '. ' + issue);
      });
    }

    // Check redirect attempt state
    var attempts = getRedirectAttempts();
    console.log('Redirect attempts:', attempts);

    // Check Firebase auth state
    try {
      var fb = window.firebase;
      if (fb && fb.auth) {
        var auth = fb.auth();
        console.log('Firebase auth currentUser:', auth.currentUser ? auth.currentUser.email : 'null');
      }
    } catch (e) {
      console.warn('Could not check Firebase auth state:', e.message);
    }

    console.groupEnd();

    return {
      issues: issues,
      attempts: getRedirectAttempts(),
      url: window.location.href,
      cookiesEnabled: navigator.cookieEnabled,
      inIframe: window !== window.top
    };
  }

  // ── Redirect Attempt Tracking ────────────────────────────────────────

  function getRedirectAttempts() {
    try {
      return parseInt(sessionStorage.getItem(REDIRECT_ATTEMPT_KEY) || '0', 10);
    } catch (e) { return 0; }
  }

  function incrementRedirectAttempts() {
    try {
      var count = getRedirectAttempts() + 1;
      sessionStorage.setItem(REDIRECT_ATTEMPT_KEY, String(count));
      return count;
    } catch (e) { return 1; }
  }

  function resetRedirectAttempts() {
    try { sessionStorage.removeItem(REDIRECT_ATTEMPT_KEY); } catch (e) { /* */ }
  }

  // ── Auth Methods ─────────────────────────────────────────────────────

  function getAuth() {
    var fb = window.firebase;
    if (fb && fb.auth && typeof fb.auth === 'function') return fb.auth();
    return null;
  }

  function getGoogleProvider() {
    var fb = window.firebase;
    if (!fb || !fb.auth) return null;
    var provider = new fb.auth.GoogleAuthProvider();
    provider.addScope('email');
    provider.addScope('profile');
    // Force account selection to avoid stale sessions
    provider.setCustomParameters({ prompt: 'select_account' });
    return provider;
  }

  /**
   * Initialize with proper persistence and attempt redirect result recovery.
   */
  function init(firebaseConfig) {
    var fb = window.firebase;
    if (!fb) {
      console.error('[GoogleSignInFix] Firebase SDK not found');
      return;
    }

    // Init app if needed
    if (firebaseConfig && (!fb.apps || fb.apps.length === 0)) {
      try { fb.initializeApp(firebaseConfig); } catch (e) {
        if (e.code !== 'app/duplicate-app') console.error(e);
      }
    }

    var auth = getAuth();
    if (!auth) return;

    // FIX 1: Set persistence to LOCAL (survives redirects)
    auth.setPersistence(fb.auth.Auth.Persistence.LOCAL)
      .then(function () {
        console.log('[GoogleSignInFix] Persistence set to LOCAL');
      })
      .catch(function (err) {
        console.warn('[GoogleSignInFix] Could not set persistence:', err);
      });

    // FIX 2: Attempt to recover redirect result on every page load
    auth.getRedirectResult()
      .then(function (result) {
        if (result && result.user) {
          console.log('[GoogleSignInFix] ✅ Redirect result recovered:', result.user.email);
          resetRedirectAttempts();
          if (config.onSuccess) config.onSuccess(result);
        } else if (getRedirectAttempts() > 0) {
          // We expected a result but got null — this is the bug
          console.warn('[GoogleSignInFix] ⚠️ getRedirectResult() returned null after redirect');
          var attempts = getRedirectAttempts();

          if (attempts >= config.maxRedirectAttempts && config.popupFallback) {
            console.log('[GoogleSignInFix] Redirect failed', attempts,
              'times. Trying popup fallback...');
            resetRedirectAttempts();
            signInWithPopup();
          }
        }
      })
      .catch(function (error) {
        console.error('[GoogleSignInFix] getRedirectResult error:', error);
        resetRedirectAttempts();

        if (error.code === 'auth/web-storage-unsupported' ||
            error.code === 'auth/operation-not-supported-in-this-environment') {
          console.log('[GoogleSignInFix] Web storage issue — forcing popup mode');
          config.preferPopup = true;
        }

        if (config.onError) config.onError(error);
      });

    console.log('[GoogleSignInFix] Initialized');
  }

  /**
   * Sign in — uses redirect by default, popup as fallback.
   */
  function signIn(options) {
    options = options || {};
    var auth = getAuth();
    var provider = getGoogleProvider();

    if (!auth || !provider) {
      return Promise.reject(new Error('Firebase auth not initialized'));
    }

    // Use popup if preferred or redirect has failed too many times
    if (config.preferPopup || options.forcePopup) {
      return signInWithPopup();
    }

    // FIX 3: Track redirect attempts
    var attempts = incrementRedirectAttempts();
    console.log('[GoogleSignInFix] Starting redirect sign-in (attempt', attempts + ')');

    return auth.signInWithRedirect(provider);
  }

  /**
   * Popup fallback for when redirect fails.
   */
  function signInWithPopup() {
    var auth = getAuth();
    var provider = getGoogleProvider();

    if (!auth || !provider) {
      return Promise.reject(new Error('Firebase auth not initialized'));
    }

    console.log('[GoogleSignInFix] Using popup sign-in');

    return auth.signInWithPopup(provider)
      .then(function (result) {
        console.log('[GoogleSignInFix] ✅ Popup sign-in successful:', result.user.email);
        resetRedirectAttempts();
        if (config.onSuccess) config.onSuccess(result);
        return result;
      })
      .catch(function (error) {
        console.error('[GoogleSignInFix] Popup sign-in error:', error.code, error.message);

        if (error.code === 'auth/popup-blocked') {
          console.warn('[GoogleSignInFix] Popup was blocked. User needs to allow popups.');
        }
        if (error.code === 'auth/popup-closed-by-user') {
          console.log('[GoogleSignInFix] User closed the popup');
        }

        if (config.onError) config.onError(error);
        return Promise.reject(error);
      });
  }

  /**
   * Configure the fix module.
   * @param {Object} opts
   * @param {boolean} [opts.preferPopup]
   * @param {boolean} [opts.popupFallback]
   * @param {number}  [opts.maxRedirectAttempts]
   * @param {Function} [opts.onSuccess]
   * @param {Function} [opts.onError]
   */
  function configure(opts) {
    for (var k in opts) {
      if (opts.hasOwnProperty(k) && config.hasOwnProperty(k)) {
        config[k] = opts[k];
      }
    }
    return config;
  }

  // ── Export ────────────────────────────────────────────────────────────

  window.CortexFreelancer.googleSignInFix = {
    init: init,
    signIn: signIn,
    signInWithPopup: signInWithPopup,
    diagnose: diagnose,
    configure: configure,
    resetAttempts: resetRedirectAttempts
  };

  console.log('[CF] Google Sign-In fix loaded');
})();
