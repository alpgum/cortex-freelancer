/**
 * CF-087 — Fix auth state persistence across page navigations
 * Ensures onAuthStateChanged fires correctly in multi-page app
 */
(function () {
  const ns = (window.CortexFreelancer = window.CortexFreelancer || {});

  const AUTH_STATE_KEY = 'cortex_auth_state';
  const AUTH_UID_KEY = 'cortex_auth_uid';
  const AUTH_READY_EVENT = 'cortex:auth-ready';

  let _currentUser = null;
  let _authReady = false;
  const _listeners = [];

  function persistAuthState(user) {
    if (user) {
      localStorage.setItem(AUTH_STATE_KEY, 'authenticated');
      localStorage.setItem(AUTH_UID_KEY, user.uid);
    } else {
      localStorage.removeItem(AUTH_STATE_KEY);
      localStorage.removeItem(AUTH_UID_KEY);
    }
  }

  function getCachedAuthState() {
    return {
      isAuthenticated: localStorage.getItem(AUTH_STATE_KEY) === 'authenticated',
      uid: localStorage.getItem(AUTH_UID_KEY)
    };
  }

  function notifyListeners(user) {
    _listeners.forEach(function (fn) {
      try { fn(user); } catch (e) { console.error('[AuthState] Listener error:', e); }
    });
    window.dispatchEvent(new CustomEvent(AUTH_READY_EVENT, { detail: { user: user } }));
  }

  function init() {
    if (typeof firebase === 'undefined' || !firebase.auth) {
      console.warn('[AuthState] Firebase auth not available');
      return;
    }

    // Set persistence to LOCAL so it survives page navigations
    firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(function (err) {
      console.error('[AuthState] setPersistence error:', err);
    });

    firebase.auth().onAuthStateChanged(function (user) {
      _currentUser = user;
      _authReady = true;
      persistAuthState(user);
      notifyListeners(user);
    });
  }

  ns.AuthStatePersistence = {
    init: init,
    getCurrentUser: function () { return _currentUser; },
    isReady: function () { return _authReady; },
    getCachedState: getCachedAuthState,
    onAuthReady: function (fn) {
      if (_authReady) { fn(_currentUser); }
      else { _listeners.push(fn); }
    },
    waitForAuth: function () {
      if (_authReady) return Promise.resolve(_currentUser);
      return new Promise(function (resolve) {
        _listeners.push(resolve);
      });
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
