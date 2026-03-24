/**
 * CF-103: Fix race condition in auth + data loading
 * Ensure Firestore data fetch waits for auth state to resolve.
 */
(function () {
  'use strict';
  window.CortexFreelancer = window.CortexFreelancer || {};

  var _authReady = null;
  var _resolveAuth = null;
  var _currentUser = null;

  // Create a promise that resolves once auth state is known
  _authReady = new Promise(function (resolve) {
    _resolveAuth = resolve;
  });

  function initAuthListener() {
    if (typeof firebase === 'undefined' || !firebase.auth) {
      console.warn('[AuthDataSync] Firebase auth not available');
      _resolveAuth(null);
      return;
    }

    firebase.auth().onAuthStateChanged(function (user) {
      _currentUser = user;
      _resolveAuth(user);
    });
  }

  /**
   * Wait for auth state before fetching data.
   * Usage: CortexFreelancer.AuthDataSync.whenReady().then(user => { ... })
   */
  function whenReady() {
    return _authReady;
  }

  /**
   * Fetch Firestore data only after auth is resolved.
   * @param {Function} fetchFn - receives (user) and should return a Promise
   */
  function fetchAfterAuth(fetchFn) {
    return _authReady.then(function (user) {
      if (!user) {
        console.warn('[AuthDataSync] No authenticated user');
        return null;
      }
      return fetchFn(user);
    });
  }

  function getCurrentUser() {
    return _currentUser;
  }

  window.CortexFreelancer.AuthDataSync = {
    init: initAuthListener,
    whenReady: whenReady,
    fetchAfterAuth: fetchAfterAuth,
    getCurrentUser: getCurrentUser
  };

  // Auto-init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAuthListener);
  } else {
    initAuthListener();
  }
})();
