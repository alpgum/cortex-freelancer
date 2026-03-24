/**
 * CF-223: Magic Link Login — Passwordless Firebase Email Link Authentication
 *
 * Sends a sign-in link to the user's email, handles the redirect when
 * the link is clicked, and completes sign-in via Firebase email link auth.
 *
 * States: idle, sending, sent, completing, success, error
 *
 * @namespace window.CortexFreelancer.MagicLinkLogin
 *
 * Usage:
 *   CortexFreelancer.MagicLinkLogin.init({ containerId: 'magic-link-root' })
 *   CortexFreelancer.MagicLinkLogin.sendLink('user@example.com')
 *   CortexFreelancer.MagicLinkLogin.completeSignIn()
 */
window.CortexFreelancer = window.CortexFreelancer || {};

(function () {
  'use strict';

  var STYLE_ID = 'cortex-magic-link-styles';
  var EMAIL_STORAGE_KEY = 'cortex_magic_link_email';
  var LOG_PREFIX = '[MagicLink]';

  // ─── State ────────────────────────────────────────────────────────────

  var state = {
    status: 'idle',   // idle | sending | sent | completing | success | error
    email: '',
    error: null,
    user: null
  };

  var config = {
    containerId: 'magic-link-root',
    actionCodeSettings: {
      url: window.location.origin + '/app/login.html',
      handleCodeInApp: true
    },
    onSuccess: null,       // function(user) — called after successful sign-in
    onError: null,         // function(error) — called on error
    redirectAfterLogin: null  // URL to navigate to after login
  };

  var listeners = [];

  // ─── Helpers ──────────────────────────────────────────────────────────

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str || ''));
    return div.innerHTML;
  }

  function notify() {
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](state); } catch (e) { console.error(LOG_PREFIX, e); }
    }
  }

  function setState(patch) {
    for (var key in patch) {
      if (patch.hasOwnProperty(key)) {
        state[key] = patch[key];
      }
    }
    notify();
    renderUI();
  }

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

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function storeEmail(email) {
    try {
      localStorage.setItem(EMAIL_STORAGE_KEY, email);
    } catch (e) {
      console.warn(LOG_PREFIX, 'Could not store email in localStorage:', e);
    }
  }

  function getStoredEmail() {
    try {
      return localStorage.getItem(EMAIL_STORAGE_KEY) || '';
    } catch (e) {
      return '';
    }
  }

  function clearStoredEmail() {
    try {
      localStorage.removeItem(EMAIL_STORAGE_KEY);
    } catch (e) { /* ignore */ }
  }

  // ─── Core Logic ───────────────────────────────────────────────────────

  /**
   * Send a magic link email to the given address.
   * @param {string} email
   * @returns {Promise<void>}
   */
  function sendLink(email) {
    if (!email || !isValidEmail(email)) {
      setState({ status: 'error', error: 'Please enter a valid email address.' });
      return Promise.reject(new Error('Invalid email'));
    }

    var auth = getAuth();
    if (!auth) {
      setState({ status: 'error', error: 'Firebase is not initialized. Please reload the page.' });
      return Promise.reject(new Error('Firebase not available'));
    }

    setState({ status: 'sending', email: email, error: null });

    var settings = {
      url: config.actionCodeSettings.url,
      handleCodeInApp: config.actionCodeSettings.handleCodeInApp !== false
    };

    // Optional fields — only include if explicitly configured
    if (config.actionCodeSettings.iOS) {
      settings.iOS = config.actionCodeSettings.iOS;
    }
    if (config.actionCodeSettings.android) {
      settings.android = config.actionCodeSettings.android;
    }
    if (config.actionCodeSettings.dynamicLinkDomain) {
      settings.dynamicLinkDomain = config.actionCodeSettings.dynamicLinkDomain;
    }

    console.log(LOG_PREFIX, 'Sending magic link to', email);

    return auth.sendSignInLinkToEmail(email, settings)
      .then(function () {
        storeEmail(email);
        setState({ status: 'sent' });
        console.log(LOG_PREFIX, 'Magic link sent successfully');
      })
      .catch(function (err) {
        console.error(LOG_PREFIX, 'Send failed:', err);
        var message = mapFirebaseError(err);
        setState({ status: 'error', error: message });
        if (typeof config.onError === 'function') {
          config.onError(err);
        }
        throw err;
      });
  }

  /**
   * Check if the current URL is a sign-in link and complete authentication.
   * Should be called on page load.
   * @param {string} [url] URL to check (defaults to window.location.href)
   * @returns {Promise<Object|null>} Resolves with user or null
   */
  function completeSignIn(url) {
    var auth = getAuth();
    if (!auth) {
      console.warn(LOG_PREFIX, 'Firebase not available for sign-in completion');
      return Promise.resolve(null);
    }

    var href = url || window.location.href;

    if (!auth.isSignInWithEmailLink(href)) {
      return Promise.resolve(null);
    }

    console.log(LOG_PREFIX, 'Detected magic link, completing sign-in');
    setState({ status: 'completing', error: null });

    var email = getStoredEmail();

    if (!email) {
      // User opened the link on a different device/browser
      setState({ status: 'completing' });
      renderUI();
      return promptForEmail()
        .then(function (enteredEmail) {
          return finishSignIn(auth, enteredEmail, href);
        })
        .catch(function (err) {
          setState({ status: 'error', error: 'Sign-in was cancelled.' });
          return null;
        });
    }

    return finishSignIn(auth, email, href);
  }

  /**
   * Final step: call signInWithEmailLink.
   */
  function finishSignIn(auth, email, href) {
    return auth.signInWithEmailLink(email, href)
      .then(function (result) {
        clearStoredEmail();
        var user = result.user || result;
        setState({ status: 'success', user: user, email: email });
        console.log(LOG_PREFIX, 'Sign-in successful:', user.email);

        if (typeof config.onSuccess === 'function') {
          config.onSuccess(user);
        }

        if (config.redirectAfterLogin) {
          window.location.href = config.redirectAfterLogin;
        }

        return user;
      })
      .catch(function (err) {
        console.error(LOG_PREFIX, 'Sign-in completion failed:', err);
        var message = mapFirebaseError(err);
        setState({ status: 'error', error: message });
        if (typeof config.onError === 'function') {
          config.onError(err);
        }
        return null;
      });
  }

  /**
   * Prompt the user for their email when localStorage doesn't have it
   * (e.g. opened link on different device).
   * @returns {Promise<string>}
   */
  function promptForEmail() {
    return new Promise(function (resolve, reject) {
      var container = document.getElementById(config.containerId);
      if (!container) {
        // Fallback to browser prompt
        var email = window.prompt('Please enter the email address you used to request the magic link:');
        if (email && isValidEmail(email)) {
          resolve(email);
        } else {
          reject(new Error('No email provided'));
        }
        return;
      }

      // Render an inline email prompt
      state._emailPromiseResolve = resolve;
      state._emailPromiseReject = reject;
      renderEmailPrompt(container);
    });
  }

  /**
   * Map Firebase error codes to user-friendly messages.
   */
  function mapFirebaseError(err) {
    var code = err.code || '';
    switch (code) {
      case 'auth/invalid-email':
        return 'The email address is not valid.';
      case 'auth/missing-email':
        return 'Please provide an email address.';
      case 'auth/invalid-action-code':
        return 'This magic link has expired or already been used. Please request a new one.';
      case 'auth/expired-action-code':
        return 'This magic link has expired. Please request a new one.';
      case 'auth/user-disabled':
        return 'This account has been disabled. Please contact support.';
      case 'auth/too-many-requests':
        return 'Too many attempts. Please wait a moment and try again.';
      case 'auth/network-request-failed':
        return 'Network error. Please check your connection and try again.';
      case 'auth/unauthorized-continue-uri':
        return 'Configuration error. Please contact support.';
      default:
        return err.message || 'An unexpected error occurred. Please try again.';
    }
  }

  // ─── CSS ──────────────────────────────────────────────────────────────

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent =
      '.ml-container {' +
        'max-width: 420px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;' +
      '}' +

      '.ml-card {' +
        'background: #1e1e2e; border-radius: 12px; padding: 28px;' +
        'border: 1px solid #2d2d44; box-shadow: 0 4px 24px rgba(0,0,0,0.3);' +
      '}' +

      '.ml-title {' +
        'color: #e0e0e0; font-size: 20px; font-weight: 700; margin: 0 0 6px; text-align: center;' +
      '}' +

      '.ml-subtitle {' +
        'color: #888; font-size: 14px; margin: 0 0 24px; text-align: center;' +
      '}' +

      '.ml-form { display: flex; flex-direction: column; gap: 12px; }' +

      '.ml-input {' +
        'width: 100%; padding: 12px 14px; font-size: 15px;' +
        'background: #16162a; border: 1px solid #2d2d44; border-radius: 8px;' +
        'color: #e0e0e0; outline: none; transition: border-color 0.2s;' +
        'box-sizing: border-box;' +
      '}' +
      '.ml-input:focus { border-color: #6c5ce7; }' +
      '.ml-input::placeholder { color: #555; }' +
      '.ml-input:disabled { opacity: 0.5; cursor: not-allowed; }' +

      '.ml-btn {' +
        'width: 100%; padding: 12px; font-size: 15px; font-weight: 600;' +
        'border: none; border-radius: 8px; cursor: pointer;' +
        'transition: background 0.2s, opacity 0.2s; color: #fff;' +
        'background: #6c5ce7;' +
      '}' +
      '.ml-btn:hover:not(:disabled) { background: #5a4bd1; }' +
      '.ml-btn:disabled { opacity: 0.5; cursor: not-allowed; }' +

      '.ml-btn-secondary {' +
        'background: transparent; border: 1px solid #2d2d44; color: #b2bec3;' +
      '}' +
      '.ml-btn-secondary:hover:not(:disabled) { background: #2d2d44; }' +

      '.ml-status {' +
        'text-align: center; padding: 16px 0;' +
      '}' +

      '.ml-status-icon {' +
        'font-size: 40px; margin-bottom: 12px;' +
      '}' +

      '.ml-status-title {' +
        'color: #e0e0e0; font-size: 17px; font-weight: 600; margin: 0 0 6px;' +
      '}' +

      '.ml-status-text {' +
        'color: #888; font-size: 14px; line-height: 1.5; margin: 0 0 16px;' +
      '}' +

      '.ml-error {' +
        'background: rgba(255,71,87,0.08); border: 1px solid rgba(255,71,87,0.2);' +
        'border-radius: 8px; padding: 10px 14px; margin-bottom: 12px;' +
        'color: #ff4757; font-size: 13px; text-align: left;' +
      '}' +

      '.ml-spinner {' +
        'display: inline-block; width: 20px; height: 20px;' +
        'border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff;' +
        'border-radius: 50%; animation: ml-spin 0.6s linear infinite;' +
        'vertical-align: middle; margin-right: 8px;' +
      '}' +
      '@keyframes ml-spin { to { transform: rotate(360deg); } }' +

      '.ml-success-check {' +
        'display: inline-block; width: 48px; height: 48px; border-radius: 50%;' +
        'background: rgba(0,255,136,0.1); color: #00ff88; font-size: 24px;' +
        'line-height: 48px; text-align: center; margin-bottom: 12px;' +
      '}' +

      '.ml-email-highlight {' +
        'color: #6c5ce7; font-weight: 600;' +
      '}' +

      '.ml-divider {' +
        'display: flex; align-items: center; gap: 12px; margin: 16px 0; color: #555; font-size: 12px;' +
      '}' +
      '.ml-divider::before, .ml-divider::after {' +
        'content: ""; flex: 1; height: 1px; background: #2d2d44;' +
      '}';

    document.head.appendChild(s);
  }

  // ─── UI Rendering ─────────────────────────────────────────────────────

  function renderUI() {
    var container = document.getElementById(config.containerId);
    if (!container) return;

    injectStyles();

    switch (state.status) {
      case 'idle':
        renderEmailForm(container);
        break;
      case 'sending':
        renderSending(container);
        break;
      case 'sent':
        renderSent(container);
        break;
      case 'completing':
        renderCompleting(container);
        break;
      case 'success':
        renderSuccess(container);
        break;
      case 'error':
        renderError(container);
        break;
      default:
        renderEmailForm(container);
    }
  }

  function renderEmailForm(container) {
    container.innerHTML =
      '<div class="ml-container"><div class="ml-card">' +
        '<h2 class="ml-title">Sign in with Magic Link</h2>' +
        '<p class="ml-subtitle">We\'ll send a sign-in link to your email — no password needed.</p>' +
        '<div class="ml-form">' +
          (state.error
            ? '<div class="ml-error">' + escapeHtml(state.error) + '</div>'
            : '') +
          '<input class="ml-input" id="ml-email-input" type="email" ' +
            'placeholder="you@example.com" autocomplete="email" ' +
            'value="' + escapeHtml(state.email) + '">' +
          '<button class="ml-btn" id="ml-send-btn">Send Magic Link</button>' +
        '</div>' +
      '</div></div>';

    var input = document.getElementById('ml-email-input');
    var btn = document.getElementById('ml-send-btn');

    if (btn) {
      btn.addEventListener('click', function () {
        var email = input ? input.value.trim() : '';
        sendLink(email);
      });
    }

    if (input) {
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          var email = input.value.trim();
          sendLink(email);
        }
      });
      input.focus();
    }
  }

  function renderSending(container) {
    container.innerHTML =
      '<div class="ml-container"><div class="ml-card">' +
        '<div class="ml-status">' +
          '<div class="ml-status-icon"><span class="ml-spinner"></span></div>' +
          '<p class="ml-status-title">Sending magic link...</p>' +
          '<p class="ml-status-text">Sending to <span class="ml-email-highlight">' +
            escapeHtml(state.email) + '</span></p>' +
        '</div>' +
      '</div></div>';
  }

  function renderSent(container) {
    container.innerHTML =
      '<div class="ml-container"><div class="ml-card">' +
        '<div class="ml-status">' +
          '<div class="ml-success-check">&#9993;</div>' +
          '<p class="ml-status-title">Check your inbox</p>' +
          '<p class="ml-status-text">' +
            'We sent a magic link to<br>' +
            '<span class="ml-email-highlight">' + escapeHtml(state.email) + '</span><br>' +
            'Click the link in the email to sign in. It may take a minute to arrive.' +
          '</p>' +
          '<button class="ml-btn ml-btn-secondary" id="ml-resend-btn">Send again</button>' +
          '<div class="ml-divider">or</div>' +
          '<button class="ml-btn ml-btn-secondary" id="ml-change-email-btn">Use a different email</button>' +
        '</div>' +
      '</div></div>';

    var resendBtn = document.getElementById('ml-resend-btn');
    if (resendBtn) {
      resendBtn.addEventListener('click', function () {
        sendLink(state.email);
      });
    }

    var changeBtn = document.getElementById('ml-change-email-btn');
    if (changeBtn) {
      changeBtn.addEventListener('click', function () {
        setState({ status: 'idle', email: '', error: null });
      });
    }
  }

  function renderCompleting(container) {
    container.innerHTML =
      '<div class="ml-container"><div class="ml-card">' +
        '<div class="ml-status">' +
          '<div class="ml-status-icon"><span class="ml-spinner"></span></div>' +
          '<p class="ml-status-title">Completing sign-in...</p>' +
          '<p class="ml-status-text">Please wait while we verify your magic link.</p>' +
        '</div>' +
      '</div></div>';
  }

  function renderSuccess(container) {
    var displayName = '';
    if (state.user) {
      displayName = state.user.displayName || state.user.email || state.email;
    }

    container.innerHTML =
      '<div class="ml-container"><div class="ml-card">' +
        '<div class="ml-status">' +
          '<div class="ml-success-check">&#10003;</div>' +
          '<p class="ml-status-title">Signed in successfully</p>' +
          '<p class="ml-status-text">Welcome back, <span class="ml-email-highlight">' +
            escapeHtml(displayName) + '</span></p>' +
        '</div>' +
      '</div></div>';
  }

  function renderError(container) {
    container.innerHTML =
      '<div class="ml-container"><div class="ml-card">' +
        '<div class="ml-status">' +
          '<div class="ml-error">' + escapeHtml(state.error) + '</div>' +
          '<button class="ml-btn" id="ml-retry-btn">Try Again</button>' +
        '</div>' +
      '</div></div>';

    var retryBtn = document.getElementById('ml-retry-btn');
    if (retryBtn) {
      retryBtn.addEventListener('click', function () {
        setState({ status: 'idle', error: null });
      });
    }
  }

  /**
   * Render an email prompt for cross-device link completion.
   */
  function renderEmailPrompt(container) {
    injectStyles();

    container.innerHTML =
      '<div class="ml-container"><div class="ml-card">' +
        '<h2 class="ml-title">Confirm your email</h2>' +
        '<p class="ml-subtitle">' +
          'It looks like you opened the magic link on a different device or browser. ' +
          'Please enter the email address you used to request it.' +
        '</p>' +
        '<div class="ml-form">' +
          '<input class="ml-input" id="ml-confirm-email-input" type="email" ' +
            'placeholder="you@example.com" autocomplete="email">' +
          '<button class="ml-btn" id="ml-confirm-email-btn">Continue</button>' +
          '<button class="ml-btn ml-btn-secondary" id="ml-cancel-email-btn">Cancel</button>' +
        '</div>' +
      '</div></div>';

    var input = document.getElementById('ml-confirm-email-input');
    var confirmBtn = document.getElementById('ml-confirm-email-btn');
    var cancelBtn = document.getElementById('ml-cancel-email-btn');

    function handleConfirm() {
      var email = input ? input.value.trim() : '';
      if (!isValidEmail(email)) {
        // Show inline error
        var form = container.querySelector('.ml-form');
        var existing = form.querySelector('.ml-error');
        if (existing) existing.remove();
        var errDiv = document.createElement('div');
        errDiv.className = 'ml-error';
        errDiv.textContent = 'Please enter a valid email address.';
        form.insertBefore(errDiv, form.firstChild);
        return;
      }
      if (state._emailPromiseResolve) {
        state._emailPromiseResolve(email);
        state._emailPromiseResolve = null;
        state._emailPromiseReject = null;
      }
    }

    if (confirmBtn) {
      confirmBtn.addEventListener('click', handleConfirm);
    }

    if (input) {
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleConfirm();
        }
      });
      input.focus();
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', function () {
        if (state._emailPromiseReject) {
          state._emailPromiseReject(new Error('Cancelled'));
          state._emailPromiseResolve = null;
          state._emailPromiseReject = null;
        }
      });
    }
  }

  // ─── Public API ───────────────────────────────────────────────────────

  /**
   * Initialize the magic link login module.
   * @param {Object} [options]
   * @param {string} [options.containerId] DOM element id for UI rendering
   * @param {Object} [options.actionCodeSettings] Firebase actionCodeSettings override
   * @param {Function} [options.onSuccess] Callback after successful sign-in
   * @param {Function} [options.onError] Callback on error
   * @param {string} [options.redirectAfterLogin] URL to navigate to after login
   */
  function init(options) {
    options = options || {};

    if (options.containerId) {
      config.containerId = options.containerId;
    }
    if (options.actionCodeSettings) {
      for (var key in options.actionCodeSettings) {
        if (options.actionCodeSettings.hasOwnProperty(key)) {
          config.actionCodeSettings[key] = options.actionCodeSettings[key];
        }
      }
    }
    if (typeof options.onSuccess === 'function') {
      config.onSuccess = options.onSuccess;
    }
    if (typeof options.onError === 'function') {
      config.onError = options.onError;
    }
    if (options.redirectAfterLogin) {
      config.redirectAfterLogin = options.redirectAfterLogin;
    }

    var fb = getFirebase();
    if (!fb) {
      console.error(LOG_PREFIX, 'Firebase SDK not found. Load it before this script.');
      return;
    }

    // Check if the current page is a magic link redirect
    completeSignIn();

    // Render the initial UI if a container exists
    renderUI();

    console.log(LOG_PREFIX, 'Initialized');
  }

  /**
   * Subscribe to state changes.
   * @param {Function} fn Callback receiving current state
   * @returns {Function} Unsubscribe function
   */
  function onStateChange(fn) {
    if (typeof fn !== 'function') return function () {};
    listeners.push(fn);
    return function () {
      var idx = listeners.indexOf(fn);
      if (idx !== -1) listeners.splice(idx, 1);
    };
  }

  /**
   * Get the current state.
   * @returns {Object}
   */
  function getState() {
    return {
      status: state.status,
      email: state.email,
      error: state.error,
      user: state.user
    };
  }

  /**
   * Reset back to initial idle state.
   */
  function reset() {
    setState({ status: 'idle', email: '', error: null, user: null });
  }

  /**
   * Check whether a given URL is a Firebase sign-in email link.
   * @param {string} [url]
   * @returns {boolean}
   */
  function isSignInLink(url) {
    var auth = getAuth();
    if (!auth) return false;
    return auth.isSignInWithEmailLink(url || window.location.href);
  }

  // ─── Expose ───────────────────────────────────────────────────────────

  window.CortexFreelancer.MagicLinkLogin = {
    init: init,
    sendLink: sendLink,
    completeSignIn: completeSignIn,
    isSignInLink: isSignInLink,
    onStateChange: onStateChange,
    getState: getState,
    reset: reset,
    renderUI: renderUI
  };
})();
