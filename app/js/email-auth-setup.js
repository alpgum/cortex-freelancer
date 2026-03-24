/**
 * [CF-201] Email/Password Auth Setup Module
 * Firebase auth provider initialization and auth state management.
 * Integrates with existing firebase-auth-handler.js.
 * Exposed on window.CortexFreelancer.EmailAuthSetup
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  var SESSION_KEY = 'cf_email_auth_session';

  var state = {
    initialized: false,
    user: null,
    loading: true,
    error: null,
    listeners: [],
    unsubscribeAuth: null
  };

  // ── Helpers ───────────────────────────────────────────────────────────

  function getFirebase() {
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

  function notify() {
    var snapshot = {
      user: state.user,
      loading: state.loading,
      error: state.error,
      initialized: state.initialized
    };
    for (var i = 0; i < state.listeners.length; i++) {
      try { state.listeners[i](snapshot); } catch (e) { console.error(e); }
    }
  }

  function saveSession(user) {
    if (!user) {
      try { localStorage.removeItem(SESSION_KEY); } catch (e) { /* */ }
      return;
    }
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        emailVerified: user.emailVerified,
        ts: Date.now()
      }));
    } catch (e) { /* ignore */ }
  }

  function getStoredSession() {
    try {
      var raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  // ── Auth State Listener ───────────────────────────────────────────────

  function setupAuthListener() {
    var auth = getAuth();
    if (!auth) {
      console.warn('[EmailAuthSetup] Firebase Auth not available');
      state.loading = false;
      notify();
      return;
    }

    state.unsubscribeAuth = auth.onAuthStateChanged(function (user) {
      state.user = user ? {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        emailVerified: user.emailVerified,
        photoURL: user.photoURL,
        providerData: user.providerData,
        metadata: {
          creationTime: user.metadata.creationTime,
          lastSignInTime: user.metadata.lastSignInTime
        }
      } : null;
      state.loading = false;
      state.error = null;
      saveSession(state.user);
      notify();
    });
  }

  // ── Email/Password Configuration ──────────────────────────────────────

  function enableEmailPasswordProvider(firebaseConfig) {
    var fb = getFirebase();
    if (!fb) {
      throw new Error('[EmailAuthSetup] Firebase SDK not loaded. Include firebase-app.js and firebase-auth.js.');
    }

    // Initialize Firebase app if not already done
    if (!fb.apps || fb.apps.length === 0) {
      if (!firebaseConfig) {
        throw new Error('[EmailAuthSetup] Firebase config required for initialization.');
      }
      fb.initializeApp(firebaseConfig);
    }

    // Email/password provider is built-in; no extra enable step needed.
    // This function ensures Firebase is ready for email auth.
    console.info('[EmailAuthSetup] Email/Password provider ready');
  }

  // ── Auth Actions ──────────────────────────────────────────────────────

  function signIn(email, password) {
    var auth = getAuth();
    if (!auth) return Promise.reject(new Error('Firebase Auth not available'));

    state.loading = true;
    state.error = null;
    notify();

    return auth.signInWithEmailAndPassword(email, password)
      .then(function (result) {
        state.loading = false;
        notify();
        return result;
      })
      .catch(function (err) {
        state.loading = false;
        state.error = mapAuthError(err);
        notify();
        throw err;
      });
  }

  function signUp(email, password, displayName) {
    var auth = getAuth();
    if (!auth) return Promise.reject(new Error('Firebase Auth not available'));

    state.loading = true;
    state.error = null;
    notify();

    return auth.createUserWithEmailAndPassword(email, password)
      .then(function (result) {
        // Set display name if provided
        if (displayName && result.user) {
          return result.user.updateProfile({ displayName: displayName }).then(function () {
            return result;
          });
        }
        return result;
      })
      .then(function (result) {
        state.loading = false;
        notify();
        return result;
      })
      .catch(function (err) {
        state.loading = false;
        state.error = mapAuthError(err);
        notify();
        throw err;
      });
  }

  function signOut() {
    var auth = getAuth();
    if (!auth) return Promise.reject(new Error('Firebase Auth not available'));

    return auth.signOut().then(function () {
      state.user = null;
      saveSession(null);
      notify();
    });
  }

  function resetPassword(email) {
    var auth = getAuth();
    if (!auth) return Promise.reject(new Error('Firebase Auth not available'));

    return auth.sendPasswordResetEmail(email);
  }

  function updatePassword(newPassword) {
    var auth = getAuth();
    if (!auth || !auth.currentUser) {
      return Promise.reject(new Error('Not authenticated'));
    }
    return auth.currentUser.updatePassword(newPassword);
  }

  // ── Error Mapping ─────────────────────────────────────────────────────

  function mapAuthError(err) {
    var code = err.code || '';
    var messages = {
      'auth/user-not-found': 'No account found with this email.',
      'auth/wrong-password': 'Incorrect password.',
      'auth/email-already-in-use': 'An account with this email already exists.',
      'auth/weak-password': 'Password is too weak. Use at least 8 characters.',
      'auth/invalid-email': 'Invalid email address.',
      'auth/too-many-requests': 'Too many attempts. Please try again later.',
      'auth/user-disabled': 'This account has been disabled.',
      'auth/network-request-failed': 'Network error. Check your connection.'
    };
    return {
      code: code,
      message: messages[code] || err.message || 'An authentication error occurred.'
    };
  }

  // ── State Accessors ───────────────────────────────────────────────────

  function getUser() { return state.user; }
  function isAuthenticated() { return !!state.user; }
  function isLoading() { return state.loading; }
  function getError() { return state.error; }
  function clearError() { state.error = null; notify(); }

  function onAuthChange(fn) {
    if (typeof fn === 'function') state.listeners.push(fn);
    // Immediately fire with current state
    if (state.initialized) {
      try { fn({ user: state.user, loading: state.loading, error: state.error, initialized: true }); }
      catch (e) { /* ignore */ }
    }
    return function unsubscribe() {
      state.listeners = state.listeners.filter(function (l) { return l !== fn; });
    };
  }

  // ── Init ──────────────────────────────────────────────────────────────

  function init(firebaseConfig) {
    if (state.initialized) return;

    enableEmailPasswordProvider(firebaseConfig);
    setupAuthListener();
    state.initialized = true;
    console.info('[EmailAuthSetup] Initialized');
  }

  function destroy() {
    if (state.unsubscribeAuth) state.unsubscribeAuth();
    state.listeners = [];
    state.initialized = false;
  }

  // ── Public API ────────────────────────────────────────────────────────

  window.CortexFreelancer.EmailAuthSetup = {
    init: init,
    destroy: destroy,
    signIn: signIn,
    signUp: signUp,
    signOut: signOut,
    resetPassword: resetPassword,
    updatePassword: updatePassword,
    getUser: getUser,
    isAuthenticated: isAuthenticated,
    isLoading: isLoading,
    getError: getError,
    clearError: clearError,
    onAuthChange: onAuthChange,
    getStoredSession: getStoredSession
  };
})();
