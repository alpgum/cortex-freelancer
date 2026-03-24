/**
 * CF-086 / CF-205: Google Sign-In Fix + Custom OAuth Handler
 *
 * Custom OAuth callback handler that works without Firebase Hosting
 * __/auth/handler. Implements popup-based Google sign-in flow with
 * redirect fallback and full diagnostics.
 *
 * Root causes addressed:
 * 1. Missing persistence setting (should be LOCAL for redirects)
 * 2. Cross-origin iframe blocking
 * 3. Browser storage partitioning (Safari, Firefox)
 * 4. signInWithRedirect not storing state correctly
 * 5. Vercel/SPA routing losing the auth response
 * 6. Firebase Hosting __/auth/handler not available (CF-205)
 *
 * Usage:
 *   CortexFreelancer.googleSignInFix.init(firebaseConfig)
 *   CortexFreelancer.googleSignInFix.signIn()
 *   CortexFreelancer.googleSignInFix.signInManual()   // CF-205 manual OAuth
 *   CortexFreelancer.googleSignInFix.diagnose()
 *
 * @namespace window.CortexFreelancer.googleSignInFix
 */
window.CortexFreelancer = window.CortexFreelancer || {};

(function () {
  'use strict';

  var REDIRECT_ATTEMPT_KEY = 'cf_google_redirect_attempt';
  var MAX_REDIRECT_ATTEMPTS = 2;
  var DIAG_KEY = 'cf_google_diag';
  var AUTH_USER_KEY = 'cortex_user';

  // CF-205: Manual OAuth popup constants
  var POPUP_WIDTH = 500;
  var POPUP_HEIGHT = 600;
  var POPUP_POLL_INTERVAL = 200;
  var POPUP_TIMEOUT = 120000;

  var config = {
    preferPopup: false,        // Force popup mode
    popupFallback: true,       // Fall back to popup after redirect fails
    maxRedirectAttempts: MAX_REDIRECT_ATTEMPTS,
    onSuccess: null,
    onError: null,
    // CF-205 additions
    clientId: null,            // Google OAuth client ID for manual flow
    scopes: 'email profile',
    redirectUri: null          // Override for OAuth redirect URI
  };

  var manualPopup = null;
  var manualPollTimer = null;

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

    // CF-205: Check if Firebase Hosting auth handler is available
    if (typeof firebase !== 'undefined' && firebase.auth) {
      var authDomain = firebase.app().options.authDomain || '';
      if (authDomain && authDomain.indexOf('firebaseapp.com') === -1) {
        issues.push('Custom authDomain — __/auth/handler may not be available. Manual OAuth recommended.');
      }
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
    console.log('Manual OAuth configured:', !!config.clientId);

    if (issues.length === 0) {
      console.log('No issues detected');
    } else {
      console.warn('Found', issues.length, 'potential issue(s):');
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
      inIframe: window !== window.top,
      manualOAuthConfigured: !!config.clientId
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

  function storeUser(user) {
    try {
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    } catch (e) {
      // ignore
    }
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
          console.log('[GoogleSignInFix] Redirect result recovered:', result.user.email);
          resetRedirectAttempts();
          if (config.onSuccess) config.onSuccess(result);
        } else if (getRedirectAttempts() > 0) {
          // We expected a result but got null — this is the bug
          console.warn('[GoogleSignInFix] getRedirectResult() returned null after redirect');
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

    // CF-205: Auto-handle callback if on the callback page
    handleCallback();

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
      // CF-205: If Firebase not available, try manual OAuth
      if (config.clientId) {
        console.log('[GoogleSignInFix] Firebase unavailable, using manual OAuth');
        return signInManual();
      }
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
      // CF-205: Fall through to manual OAuth
      if (config.clientId) {
        return signInManual();
      }
      return Promise.reject(new Error('Firebase auth not initialized'));
    }

    console.log('[GoogleSignInFix] Using popup sign-in');

    return auth.signInWithPopup(provider)
      .then(function (result) {
        console.log('[GoogleSignInFix] Popup sign-in successful:', result.user.email);
        resetRedirectAttempts();
        var userData = {
          uid: result.user.uid,
          email: result.user.email,
          displayName: result.user.displayName,
          photoURL: result.user.photoURL,
          provider: 'google.com',
          token: result.credential ? result.credential.idToken : null,
          signedInAt: Date.now()
        };
        storeUser(userData);
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

        // CF-205: Last resort — try manual OAuth if Firebase popup also fails
        if (config.clientId && error.code !== 'auth/popup-closed-by-user') {
          console.log('[GoogleSignInFix] Firebase popup failed, trying manual OAuth...');
          return signInManual();
        }

        if (config.onError) config.onError(error);
        return Promise.reject(error);
      });
  }

  // ── CF-205: Manual OAuth Flow (No Firebase Hosting Required) ─────────

  function generateState() {
    var arr = new Uint8Array(16);
    if (window.crypto && window.crypto.getRandomValues) {
      window.crypto.getRandomValues(arr);
    } else {
      for (var i = 0; i < 16; i++) arr[i] = Math.floor(Math.random() * 256);
    }
    return Array.from(arr, function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  }

  function getManualRedirectUri() {
    if (config.redirectUri) return config.redirectUri;
    return window.location.origin + '/auth/callback';
  }

  function openManualPopup(url) {
    var left = (screen.width - POPUP_WIDTH) / 2;
    var top = (screen.height - POPUP_HEIGHT) / 2;
    var features =
      'width=' + POPUP_WIDTH +
      ',height=' + POPUP_HEIGHT +
      ',left=' + left +
      ',top=' + top +
      ',menubar=no,toolbar=no,status=no,scrollbars=yes';
    return window.open(url, 'GoogleSignIn', features);
  }

  function cleanupManualPopup() {
    if (manualPollTimer) {
      clearInterval(manualPollTimer);
      manualPollTimer = null;
    }
    manualPopup = null;
  }

  function parseHashParams(hash) {
    var params = {};
    hash.split('&').forEach(function (pair) {
      var parts = pair.split('=');
      if (parts.length === 2) {
        params[decodeURIComponent(parts[0])] = decodeURIComponent(parts[1]);
      }
    });
    return params;
  }

  function fetchGoogleProfile(accessToken) {
    return fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: 'Bearer ' + accessToken }
    }).then(function (res) {
      if (!res.ok) throw new Error('Failed to fetch Google profile');
      return res.json();
    });
  }

  /**
   * CF-205: Sign in using manual OAuth popup — no Firebase Hosting required.
   * Works by opening Google's OAuth consent screen directly and polling for
   * the redirect with the access token.
   * @returns {Promise<Object>}
   */
  function signInManual() {
    return new Promise(function (resolve, reject) {
      if (!config.clientId) {
        return reject(new Error('Google Client ID not configured. Call configure({ clientId }) first.'));
      }

      var state = generateState();
      sessionStorage.setItem('cf_google_auth_state', state);

      var authUrl =
        'https://accounts.google.com/o/oauth2/v2/auth' +
        '?client_id=' + encodeURIComponent(config.clientId) +
        '&redirect_uri=' + encodeURIComponent(getManualRedirectUri()) +
        '&response_type=token' +
        '&scope=' + encodeURIComponent(config.scopes) +
        '&state=' + encodeURIComponent(state) +
        '&prompt=select_account';

      manualPopup = openManualPopup(authUrl);

      if (!manualPopup || manualPopup.closed) {
        return reject(new Error('Popup blocked. Please allow popups for this site.'));
      }

      var startTime = Date.now();

      manualPollTimer = setInterval(function () {
        try {
          if (!manualPopup || manualPopup.closed) {
            cleanupManualPopup();
            return reject(new Error('Sign-in cancelled by user.'));
          }

          if (Date.now() - startTime > POPUP_TIMEOUT) {
            manualPopup.close();
            cleanupManualPopup();
            return reject(new Error('Sign-in timed out.'));
          }

          var popupUrl = '';
          try {
            popupUrl = manualPopup.location.href;
          } catch (e) {
            return; // cross-origin, keep polling
          }

          if (popupUrl.indexOf(getManualRedirectUri()) === 0) {
            var hash = manualPopup.location.hash.substring(1);
            manualPopup.close();
            cleanupManualPopup();

            var params = parseHashParams(hash);

            if (params.error) {
              return reject(new Error('Google auth error: ' + params.error));
            }

            if (params.state !== state) {
              return reject(new Error('State mismatch — possible CSRF.'));
            }

            if (params.access_token) {
              fetchGoogleProfile(params.access_token).then(function (profile) {
                var userData = {
                  uid: profile.sub || profile.id,
                  email: profile.email,
                  displayName: profile.name,
                  photoURL: profile.picture,
                  provider: 'google.com',
                  token: params.access_token,
                  signedInAt: Date.now()
                };
                storeUser(userData);
                resetRedirectAttempts();
                if (config.onSuccess) config.onSuccess({ user: userData });
                resolve(userData);
              }).catch(reject);
            } else {
              reject(new Error('No access token in response.'));
            }
          }
        } catch (e) {
          // keep polling on cross-origin errors
        }
      }, POPUP_POLL_INTERVAL);
    });
  }

  /**
   * CF-205: Handle auth callback on redirect page.
   * If the current page is /auth/callback, display a message and let
   * the parent popup poll pick up the token from the URL hash.
   */
  function handleCallback() {
    if (window.location.pathname.indexOf('/auth/callback') === -1) return;

    var hash = window.location.hash.substring(1);
    if (hash) {
      document.body.innerHTML =
        '<div style="display:flex;align-items:center;justify-content:center;height:100vh;' +
        'font-family:-apple-system,sans-serif;color:#333;">' +
        '<p>Signing you in...</p></div>';
    }
  }

  /**
   * Configure the fix module.
   * @param {Object} opts
   * @param {boolean} [opts.preferPopup]
   * @param {boolean} [opts.popupFallback]
   * @param {number}  [opts.maxRedirectAttempts]
   * @param {Function} [opts.onSuccess]
   * @param {Function} [opts.onError]
   * @param {string} [opts.clientId]       - CF-205: Google OAuth Client ID
   * @param {string} [opts.scopes]         - CF-205: OAuth scopes
   * @param {string} [opts.redirectUri]    - CF-205: Custom redirect URI
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
    signInManual: signInManual,      // CF-205
    handleCallback: handleCallback,   // CF-205
    diagnose: diagnose,
    configure: configure,
    resetAttempts: resetRedirectAttempts,
    cancelManual: function () {       // CF-205
      if (manualPopup && !manualPopup.closed) {
        manualPopup.close();
      }
      cleanupManualPopup();
    }
  };

  console.log('[CF] Google Sign-In fix loaded (CF-086/CF-205)');
})();
