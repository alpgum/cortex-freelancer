/**
 * CF-085: Firebase Auth Redirect Handler for Vercel
 *
 * Deploy-ready auth handler for Firebase redirect flow.
 * Handles the /auth/callback route for OAuth redirects,
 * processes the auth result, and manages session state.
 *
 * Usage:
 *   CortexFreelancer.firebaseAuth.init(firebaseConfig)
 *   CortexFreelancer.firebaseAuth.handleCallback()
 *   CortexFreelancer.firebaseAuth.signIn(provider)
 *   CortexFreelancer.firebaseAuth.signOut()
 */
window.CortexFreelancer = window.CortexFreelancer || {};

(function () {
  'use strict';

  var AUTH_CALLBACK_PATH = '/auth/callback';
  var SESSION_KEY = 'cf_auth_session';
  var PENDING_KEY = 'cf_auth_pending';
  var REDIRECT_KEY = 'cf_auth_redirect_to';

  var state = {
    initialized: false,
    user: null,
    loading: true,
    error: null,
    listeners: []
  };

  // ── Helpers ──────────────────────────────────────────────────────────

  function notify() {
    for (var i = 0; i < state.listeners.length; i++) {
      try { state.listeners[i](state); } catch (e) { console.error(e); }
    }
  }

  function saveSession(user) {
    if (!user) {
      sessionStorage.removeItem(SESSION_KEY);
      return;
    }
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        providerId: user.providerData && user.providerData[0]
          ? user.providerData[0].providerId : null,
        ts: Date.now()
      }));
    } catch (e) {
      console.warn('[FirebaseAuth] Failed to save session:', e);
    }
  }

  function getStoredSession() {
    try {
      var raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function isCallbackPage() {
    return window.location.pathname === AUTH_CALLBACK_PATH ||
           window.location.pathname === AUTH_CALLBACK_PATH + '/' ||
           window.location.hash.indexOf('auth/callback') !== -1;
  }

  function getFirebase() {
    // Support both modular and compat Firebase SDKs
    if (typeof firebase !== 'undefined') return firebase;
    if (window.firebase) return window.firebase;
    return null;
  }

  function getAuth() {
    var fb = getFirebase();
    if (!fb) return null;
    if (fb.auth && typeof fb.auth === 'function') return fb.auth();
    return null;
  }

  // ── Init ─────────────────────────────────────────────────────────────

  /**
   * Initialize Firebase auth handler.
   * @param {Object} [config] Firebase config (if not already initialized)
   */
  function init(config) {
    var fb = getFirebase();

    if (!fb) {
      console.error('[FirebaseAuth] Firebase SDK not found. Load it before this script.');
      state.error = 'Firebase SDK not loaded';
      state.loading = false;
      notify();
      return;
    }

    // Initialize Firebase app if config provided and not already initialized
    if (config) {
      try {
        if (!fb.apps || fb.apps.length === 0) {
          fb.initializeApp(config);
        }
      } catch (e) {
        if (e.code !== 'app/duplicate-app') {
          console.error('[FirebaseAuth] Init error:', e);
        }
      }
    }

    var auth = getAuth();
    if (!auth) {
      state.error = 'Could not get Firebase auth instance';
      state.loading = false;
      notify();
      return;
    }

    state.initialized = true;

    // Listen for auth state changes
    auth.onAuthStateChanged(function (user) {
      state.user = user;
      state.loading = false;
      saveSession(user);
      notify();

      if (user) {
        console.log('[FirebaseAuth] User signed in:', user.email);
      } else {
        console.log('[FirebaseAuth] No user signed in');
      }
    });

    // Auto-handle callback if on the callback page
    if (isCallbackPage()) {
      handleCallback();
    }

    // Check for pending redirect result on any page load
    if (sessionStorage.getItem(PENDING_KEY)) {
      handleRedirectResult();
    }

    console.log('[FirebaseAuth] Initialized');
  }

  // ── Sign In ──────────────────────────────────────────────────────────

  /**
   * Start sign-in with redirect.
   * @param {string} [providerName='google']  'google', 'github', 'facebook', 'twitter'
   * @param {string} [redirectTo]  URL to redirect to after auth (default: current page)
   */
  function signIn(providerName, redirectTo) {
    var fb = getFirebase();
    var auth = getAuth();

    if (!auth) {
      console.error('[FirebaseAuth] Not initialized');
      return Promise.reject(new Error('Not initialized'));
    }

    providerName = (providerName || 'google').toLowerCase();

    var provider;
    switch (providerName) {
      case 'google':
        provider = new fb.auth.GoogleAuthProvider();
        provider.addScope('email');
        provider.addScope('profile');
        break;
      case 'github':
        provider = new fb.auth.GithubAuthProvider();
        break;
      case 'facebook':
        provider = new fb.auth.FacebookAuthProvider();
        break;
      case 'twitter':
        provider = new fb.auth.TwitterAuthProvider();
        break;
      default:
        return Promise.reject(new Error('Unknown provider: ' + providerName));
    }

    // Store redirect target
    sessionStorage.setItem(REDIRECT_KEY, redirectTo || window.location.href);
    sessionStorage.setItem(PENDING_KEY, '1');

    console.log('[FirebaseAuth] Starting redirect sign-in with', providerName);
    return auth.signInWithRedirect(provider);
  }

  // ── Handle Callback ──────────────────────────────────────────────────

  /**
   * Handle the /auth/callback redirect result.
   * Called automatically when on the callback page.
   */
  function handleCallback() {
    console.log('[FirebaseAuth] Handling auth callback...');
    return handleRedirectResult();
  }

  /**
   * Process the redirect result from Firebase.
   */
  function handleRedirectResult() {
    var auth = getAuth();
    if (!auth) {
      state.error = 'Auth not initialized';
      state.loading = false;
      notify();
      return Promise.reject(new Error('Auth not initialized'));
    }

    state.loading = true;
    notify();

    return auth.getRedirectResult()
      .then(function (result) {
        sessionStorage.removeItem(PENDING_KEY);

        if (result && result.user) {
          state.user = result.user;
          state.error = null;
          saveSession(result.user);

          console.log('[FirebaseAuth] Redirect auth successful:', result.user.email);

          // Redirect to stored target
          var redirectTo = sessionStorage.getItem(REDIRECT_KEY);
          sessionStorage.removeItem(REDIRECT_KEY);

          if (redirectTo && redirectTo !== window.location.href) {
            console.log('[FirebaseAuth] Redirecting to:', redirectTo);
            window.location.href = redirectTo;
            return result;
          }

          // If on callback page, redirect to home
          if (isCallbackPage()) {
            window.location.href = '/';
            return result;
          }
        } else {
          console.log('[FirebaseAuth] No redirect result (may be initial page load)');
        }

        state.loading = false;
        notify();
        return result;
      })
      .catch(function (error) {
        sessionStorage.removeItem(PENDING_KEY);
        state.error = error;
        state.loading = false;
        notify();

        console.error('[FirebaseAuth] Redirect auth error:', error.code, error.message);

        // Handle specific errors
        if (error.code === 'auth/account-exists-with-different-credential') {
          console.warn('[FirebaseAuth] Account exists with different provider. ' +
            'Try signing in with the original provider.');
        }

        return Promise.reject(error);
      });
  }

  // ── Sign Out ─────────────────────────────────────────────────────────

  function signOut() {
    var auth = getAuth();
    if (!auth) return Promise.reject(new Error('Not initialized'));

    return auth.signOut().then(function () {
      state.user = null;
      saveSession(null);
      notify();
      console.log('[FirebaseAuth] Signed out');
    });
  }

  // ── API ──────────────────────────────────────────────────────────────

  /**
   * Subscribe to auth state changes.
   * @param {Function} callback  Receives { user, loading, error }
   * @returns {Function} unsubscribe
   */
  function onAuthChange(callback) {
    state.listeners.push(callback);
    // Immediate callback with current state
    try { callback(state); } catch (e) { /* ignore */ }
    return function () {
      var idx = state.listeners.indexOf(callback);
      if (idx !== -1) state.listeners.splice(idx, 1);
    };
  }

  function getUser() {
    return state.user;
  }

  function isAuthenticated() {
    return !!state.user;
  }

  function isLoading() {
    return state.loading;
  }

  function getError() {
    return state.error;
  }

  /**
   * Get the ID token for API calls.
   * @returns {Promise<string|null>}
   */
  function getIdToken() {
    if (!state.user) return Promise.resolve(null);
    return state.user.getIdToken();
  }

  // ── Vercel Route Handler ─────────────────────────────────────────────
  /**
   * For Vercel deployments, add this to vercel.json rewrites:
   *
   * {
   *   "rewrites": [
   *     { "source": "/auth/callback", "destination": "/index.html" }
   *   ]
   * }
   *
   * This ensures the SPA handles the callback route.
   * The Firebase SDK will pick up the OAuth response from URL params.
   */

  // ── Export ────────────────────────────────────────────────────────────

  window.CortexFreelancer.firebaseAuth = {
    init: init,
    signIn: signIn,
    signOut: signOut,
    handleCallback: handleCallback,
    onAuthChange: onAuthChange,
    getUser: getUser,
    isAuthenticated: isAuthenticated,
    isLoading: isLoading,
    getError: getError,
    getIdToken: getIdToken,
    AUTH_CALLBACK_PATH: AUTH_CALLBACK_PATH
  };

  console.log('[CF] Firebase auth handler loaded');
})();
