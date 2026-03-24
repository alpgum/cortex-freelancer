/**
 * CF-206: Apple Sign-in Provider
 * Configure Apple Sign-in with Firebase, add styled Apple button,
 * handle auth response, create/update user document.
 *
 * @namespace window.CortexFreelancer.AppleSignIn
 */
(function () {
  'use strict';

  // ─── State ─────────────────────────────────────────────

  var state = {
    loading: false,
    error: null
  };

  // ─── Helpers ───────────────────────────────────────────

  /**
   * Escape HTML special characters.
   * @param {string} str
   * @returns {string}
   */
  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str || ''));
    return div.innerHTML;
  }

  // ─── CSS ───────────────────────────────────────────────

  /**
   * Inject Apple Sign-in styles once.
   */
  function injectStyles() {
    if (document.getElementById('cortex-apple-signin-styles')) return;
    var style = document.createElement('style');
    style.id = 'cortex-apple-signin-styles';
    style.textContent =
      '.cortex-apple-signin-btn {' +
        'display: flex; align-items: center; justify-content: center; gap: 10px;' +
        'width: 100%; max-width: 400px; padding: 14px 20px;' +
        'background: #000; color: #fff; border: none; border-radius: 8px;' +
        'font-size: 15px; font-weight: 600; cursor: pointer;' +
        'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;' +
        'transition: background 0.2s;' +
      '}' +
      '.cortex-apple-signin-btn:hover { background: #1a1a1a; }' +
      '.cortex-apple-signin-btn:disabled {' +
        'background: #636e72; cursor: not-allowed;' +
      '}' +
      '.cortex-apple-signin-btn svg {' +
        'width: 18px; height: 18px; fill: #fff;' +
      '}' +
      '.cortex-apple-signin-error {' +
        'color: #d63031; font-size: 13px; margin-top: 8px;' +
        'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;' +
      '}';
    document.head.appendChild(style);
  }

  // ─── Apple Logo SVG ────────────────────────────────────

  var APPLE_LOGO_SVG =
    '<svg viewBox="0 0 17 20" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M12.15 0c.09.64-.18 1.3-.57 1.77-.4.47-1.04.83-1.67.78-.1-.63.22-1.3.58-1.72C10.9.38 11.58.05 12.15 0zm2.07 10.28c-.02-2.14 1.75-3.17 1.83-3.22-1-1.46-2.55-1.66-3.1-1.68-1.32-.13-2.57.77-3.24.77-.67 0-1.7-.76-2.8-.74-1.44.02-2.77.84-3.51 2.13-1.5 2.59-.38 6.43 1.07 8.54.72 1.03 1.57 2.19 2.69 2.15 1.08-.04 1.49-.69 2.79-.69 1.3 0 1.67.69 2.8.67 1.16-.02 1.89-1.05 2.6-2.09.82-1.2 1.16-2.36 1.18-2.42-.03-.01-2.26-.87-2.28-3.44l-.03.02z"/>' +
    '</svg>';

  // ─── Firebase Auth ─────────────────────────────────────

  /**
   * Create an Apple auth provider instance.
   * @returns {Object} Firebase OAuthProvider
   */
  function createAppleProvider() {
    if (typeof firebase === 'undefined' || !firebase.auth) {
      throw new Error('Firebase Auth is not available');
    }
    var provider = new firebase.auth.OAuthProvider('apple.com');
    provider.addScope('email');
    provider.addScope('name');
    return provider;
  }

  /**
   * Sign in with Apple via Firebase popup.
   * @returns {Promise} Resolves with Firebase user credential
   */
  function signInWithApple() {
    var provider = createAppleProvider();
    return firebase.auth().signInWithPopup(provider);
  }

  /**
   * Create or update user document in Firestore after Apple sign-in.
   * @param {Object} credential - Firebase UserCredential
   * @returns {Promise}
   */
  function createOrUpdateUserDoc(credential) {
    if (typeof firebase === 'undefined' || !firebase.firestore) {
      console.warn('[AppleSignIn] Firestore not available, skipping user doc');
      return Promise.resolve(null);
    }

    var user = credential.user;
    var db = firebase.firestore();
    var userRef = db.collection('users').doc(user.uid);

    return userRef.get().then(function (doc) {
      var profile = credential.additionalUserInfo || {};
      var isNew = profile.isNewUser;
      var appleProfile = profile.profile || {};

      var data = {
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || appleProfile.name || '',
        photoURL: user.photoURL || '',
        provider: 'apple.com',
        lastLoginAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      if (isNew || !doc.exists) {
        data.createdAt = new Date().toISOString();
        data.plan = 'free';
        return userRef.set(data).then(function () { return data; });
      }

      return userRef.update({
        lastLoginAt: data.lastLoginAt,
        updatedAt: data.updatedAt,
        provider: 'apple.com'
      }).then(function () { return data; });
    });
  }

  // ─── Button Rendering ──────────────────────────────────

  /**
   * Render the Apple Sign-in button into a container.
   * @param {string|HTMLElement} container
   * @param {Object} [options]
   * @param {string} [options.label='Sign in with Apple']
   * @param {Function} [options.onSuccess] - Called with user credential
   * @param {Function} [options.onError] - Called with error
   */
  function renderButton(container, options) {
    injectStyles();
    options = options || {};

    var el = typeof container === 'string' ? document.querySelector(container) : container;
    if (!el) {
      console.warn('[AppleSignIn] Container not found:', container);
      return;
    }

    var label = options.label || 'Sign in with Apple';
    var wrapper = document.createElement('div');
    wrapper.innerHTML =
      '<button class="cortex-apple-signin-btn" id="cortex-apple-signin-trigger">' +
        APPLE_LOGO_SVG +
        '<span>' + escapeHtml(label) + '</span>' +
      '</button>' +
      '<div class="cortex-apple-signin-error" id="cortex-apple-signin-error" style="display:none;"></div>';

    el.appendChild(wrapper);

    var btn = wrapper.querySelector('#cortex-apple-signin-trigger');
    var errorEl = wrapper.querySelector('#cortex-apple-signin-error');

    btn.addEventListener('click', function () {
      if (state.loading) return;
      state.loading = true;
      state.error = null;
      btn.disabled = true;
      btn.querySelector('span').textContent = 'Signing in...';
      errorEl.style.display = 'none';

      signInWithApple()
        .then(function (credential) {
          return createOrUpdateUserDoc(credential).then(function () {
            state.loading = false;
            btn.disabled = false;
            btn.querySelector('span').textContent = label;

            window.dispatchEvent(new CustomEvent('cortex:apple-signin-success', {
              detail: { user: credential.user }
            }));

            if (typeof options.onSuccess === 'function') {
              options.onSuccess(credential);
            }
          });
        })
        .catch(function (err) {
          state.loading = false;
          btn.disabled = false;
          btn.querySelector('span').textContent = label;

          // User cancelled popup - not an error
          if (err.code === 'auth/popup-closed-by-user') return;

          state.error = err.message || 'Apple Sign-in failed';
          errorEl.textContent = state.error;
          errorEl.style.display = 'block';

          window.dispatchEvent(new CustomEvent('cortex:apple-signin-error', {
            detail: { error: err.code || err.message }
          }));

          if (typeof options.onError === 'function') {
            options.onError(err);
          }
        });
    });
  }

  /**
   * Initialize the module.
   */
  function init() {
    injectStyles();
    console.log('[AppleSignIn] Module initialized');
  }

  // ─── Namespace Export ──────────────────────────────────

  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.AppleSignIn = {
    init: init,
    renderButton: renderButton,
    signInWithApple: signInWithApple,
    createOrUpdateUserDoc: createOrUpdateUserDoc
  };
})();
