/**
 * Cortex Freelancer — Magic Link Authentication
 * [CF-223] Firebase email link (passwordless) authentication. Sends a sign-in
 * link to the user's email, detects incoming links on page load, and completes
 * the sign-in flow.
 *
 * @namespace window.CortexFreelancer.MagicLinkAuth
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  var LOG_PREFIX = '[CF-223]';
  var STYLE_ID = 'cortex-magic-link-styles';
  var EMAIL_STORAGE_KEY = 'cortex_magic_link_email';
  var COOLDOWN_KEY = 'cortex_magic_link_cooldown';
  var COOLDOWN_MS = 60000; // 1 minute between sends

  var state = {
    initialized: false,
    sending: false,
    completing: false,
    lastError: null,
    listeners: []
  };

  // ── Helpers ─────────────────────────────────────────────────────────

  function log() {
    var args = [LOG_PREFIX].concat(Array.prototype.slice.call(arguments));
    console.log.apply(console, args);
  }

  function warn() {
    var args = [LOG_PREFIX].concat(Array.prototype.slice.call(arguments));
    console.warn.apply(console, args);
  }

  function getAuth() {
    if (typeof firebase !== 'undefined' && firebase.auth) {
      return firebase.auth();
    }
    return null;
  }

  function notify(event, data) {
    for (var i = 0; i < state.listeners.length; i++) {
      try { state.listeners[i]({ event: event, data: data }); } catch (e) { console.error(e); }
    }
  }

  // ── Style injection ─────────────────────────────────────────────────

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent =
      '.cf-magic-link-form {' +
        'max-width: 400px; margin: 0 auto; padding: 24px;' +
        'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;' +
      '}' +
      '.cf-magic-link-form label {' +
        'display: block; color: #ccc; font-size: 14px; margin-bottom: 6px;' +
      '}' +
      '.cf-magic-link-form input[type="email"] {' +
        'width: 100%; padding: 10px 14px; border: 1px solid #333; border-radius: 8px;' +
        'background: #1e1e2e; color: #e0e0e0; font-size: 15px; box-sizing: border-box;' +
        'outline: none; transition: border-color 0.2s;' +
      '}' +
      '.cf-magic-link-form input[type="email"]:focus {' +
        'border-color: #4ecca3;' +
      '}' +
      '.cf-magic-link-btn {' +
        'display: block; width: 100%; margin-top: 14px; padding: 12px;' +
        'border: none; border-radius: 8px; font-size: 15px; font-weight: 600;' +
        'cursor: pointer; transition: background 0.2s, opacity 0.2s;' +
        'background: linear-gradient(135deg, #4ecca3, #00d2ff); color: #1e1e2e;' +
      '}' +
      '.cf-magic-link-btn:hover { opacity: 0.9; }' +
      '.cf-magic-link-btn:disabled {' +
        'opacity: 0.5; cursor: not-allowed;' +
      '}' +
      '.cf-magic-link-msg {' +
        'margin-top: 12px; padding: 10px 14px; border-radius: 8px; font-size: 13px;' +
        'text-align: center; min-height: 20px;' +
      '}' +
      '.cf-magic-link-msg--success {' +
        'background: rgba(78,204,163,0.1); color: #4ecca3; border: 1px solid rgba(78,204,163,0.2);' +
      '}' +
      '.cf-magic-link-msg--error {' +
        'background: rgba(255,107,107,0.1); color: #ff6b6b; border: 1px solid rgba(255,107,107,0.2);' +
      '}' +
      '.cf-magic-link-msg--info {' +
        'background: rgba(0,210,255,0.1); color: #00d2ff; border: 1px solid rgba(0,210,255,0.2);' +
      '}';
    document.head.appendChild(s);
  }

  // ── Send magic link ─────────────────────────────────────────────────

  /**
   * Send a sign-in email link to the given address.
   *
   * @param {string} email
   * @param {Object} [options]
   * @param {string} [options.url]  The URL to redirect to after sign-in (defaults to current page)
   * @returns {Promise<void>}
   */
  function sendLink(email, options) {
    if (!email || typeof email !== 'string') {
      return Promise.reject(new Error('Valid email is required'));
    }

    email = email.trim().toLowerCase();

    // Cooldown check
    try {
      var lastSent = parseInt(localStorage.getItem(COOLDOWN_KEY) || '0', 10);
      if (Date.now() - lastSent < COOLDOWN_MS) {
        var remaining = Math.ceil((COOLDOWN_MS - (Date.now() - lastSent)) / 1000);
        return Promise.reject(new Error('Please wait ' + remaining + ' seconds before requesting another link'));
      }
    } catch (e) { /* ignore */ }

    var auth = getAuth();
    if (!auth) {
      return Promise.reject(new Error('Firebase Auth not available'));
    }

    var actionCodeSettings = {
      url: (options && options.url) || window.location.href,
      handleCodeInApp: true
    };

    state.sending = true;
    state.lastError = null;
    notify('sending', { email: email });

    return auth.sendSignInLinkToEmail(email, actionCodeSettings).then(function () {
      // Store email for completion on return
      try {
        localStorage.setItem(EMAIL_STORAGE_KEY, email);
        localStorage.setItem(COOLDOWN_KEY, String(Date.now()));
      } catch (e) { /* ignore */ }

      state.sending = false;
      log('Sign-in link sent to:', email);
      notify('sent', { email: email });
    }).catch(function (err) {
      state.sending = false;
      state.lastError = err.message || 'Failed to send link';
      warn('Send failed:', err);
      notify('error', { error: state.lastError });
      return Promise.reject(err);
    });
  }

  // ── Handle incoming link ────────────────────────────────────────────

  /**
   * Check if the current page URL is a sign-in link and complete auth.
   * Should be called on page load.
   *
   * @param {string} [url]  URL to check (defaults to window.location.href)
   * @returns {Promise<Object|null>}  Firebase user or null if not a sign-in link
   */
  function handleIncomingLink(url) {
    var auth = getAuth();
    if (!auth) {
      return Promise.resolve(null);
    }

    var linkUrl = url || window.location.href;

    if (!auth.isSignInWithEmailLink(linkUrl)) {
      return Promise.resolve(null);
    }

    log('Sign-in link detected.');
    state.completing = true;
    notify('completing', {});

    // Retrieve the stored email
    var email = null;
    try {
      email = localStorage.getItem(EMAIL_STORAGE_KEY);
    } catch (e) { /* ignore */ }

    if (!email) {
      // If the link is opened on a different device, prompt for email
      email = window.prompt('Please enter your email address to confirm sign-in:');
      if (!email) {
        state.completing = false;
        return Promise.reject(new Error('Email is required to complete sign-in'));
      }
    }

    return auth.signInWithEmailLink(email, linkUrl).then(function (result) {
      state.completing = false;

      // Clean up stored email
      try {
        localStorage.removeItem(EMAIL_STORAGE_KEY);
      } catch (e) { /* ignore */ }

      // Clean the URL to remove sign-in parameters
      if (window.history && window.history.replaceState) {
        var cleanUrl = window.location.origin + window.location.pathname;
        window.history.replaceState(null, '', cleanUrl);
      }

      log('Sign-in complete for:', email);
      notify('complete', { user: result.user });
      return result.user;
    }).catch(function (err) {
      state.completing = false;
      state.lastError = err.message || 'Sign-in failed';
      warn('Sign-in with link failed:', err);
      notify('error', { error: state.lastError });
      return Promise.reject(err);
    });
  }

  // ── UI rendering ────────────────────────────────────────────────────

  /**
   * Render a magic link sign-in form into a container element.
   *
   * @param {string|HTMLElement} container  CSS selector or DOM element
   * @param {Object} [options]
   * @param {string} [options.url]  Redirect URL after sign-in
   */
  function renderForm(container, options) {
    injectStyles();

    var el = typeof container === 'string' ? document.querySelector(container) : container;
    if (!el) {
      warn('Container not found:', container);
      return;
    }

    var formHtml =
      '<div class="cf-magic-link-form">' +
        '<label for="cf-magic-email">Email address</label>' +
        '<input type="email" id="cf-magic-email" placeholder="you@example.com" autocomplete="email" />' +
        '<button type="button" class="cf-magic-link-btn" id="cf-magic-send">Send Sign-In Link</button>' +
        '<div class="cf-magic-link-msg" id="cf-magic-msg" style="display:none;"></div>' +
      '</div>';

    el.innerHTML = formHtml;

    var emailInput = document.getElementById('cf-magic-email');
    var sendBtn = document.getElementById('cf-magic-send');
    var msgEl = document.getElementById('cf-magic-msg');

    function showMsg(text, type) {
      if (!msgEl) return;
      msgEl.textContent = text;
      msgEl.className = 'cf-magic-link-msg cf-magic-link-msg--' + type;
      msgEl.style.display = 'block';
    }

    sendBtn.addEventListener('click', function () {
      var email = emailInput.value.trim();
      if (!email) {
        showMsg('Please enter your email address.', 'error');
        return;
      }

      sendBtn.disabled = true;
      sendBtn.textContent = 'Sending...';
      msgEl.style.display = 'none';

      sendLink(email, options).then(function () {
        showMsg('Check your email! We sent a sign-in link to ' + email + '.', 'success');
        sendBtn.textContent = 'Link Sent';
      }).catch(function (err) {
        showMsg(err.message || 'Failed to send link. Please try again.', 'error');
        sendBtn.disabled = false;
        sendBtn.textContent = 'Send Sign-In Link';
      });
    });

    // Allow enter key to submit
    emailInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        sendBtn.click();
      }
    });
  }

  // ── Init / Destroy ──────────────────────────────────────────────────

  /**
   * Initialize magic link auth. Checks for incoming sign-in link on load.
   *
   * @param {Object} [options]
   * @param {boolean} [options.autoCheck=true]  Auto-check URL for sign-in link
   * @returns {Promise<Object|null>}  Signed-in user if link was completed
   */
  function init(options) {
    if (state.initialized) {
      log('Already initialized.');
      return Promise.resolve(null);
    }

    state.initialized = true;
    log('Initialized.');

    var autoCheck = !options || options.autoCheck !== false;

    if (autoCheck) {
      return handleIncomingLink().catch(function (err) {
        warn('Auto-check failed:', err);
        return null;
      });
    }

    return Promise.resolve(null);
  }

  /**
   * Subscribe to magic link auth events.
   * @param {Function} callback  Receives { event, data }
   * @returns {Function} unsubscribe
   */
  function onEvent(callback) {
    state.listeners.push(callback);
    return function () {
      var idx = state.listeners.indexOf(callback);
      if (idx !== -1) state.listeners.splice(idx, 1);
    };
  }

  /**
   * Tear down.
   */
  function destroy() {
    state.initialized = false;
    state.listeners = [];
    state.sending = false;
    state.completing = false;
    state.lastError = null;
    log('Destroyed.');
  }

  // ── Public API ──────────────────────────────────────────────────────

  window.CortexFreelancer.MagicLinkAuth = {
    init: init,
    destroy: destroy,
    sendLink: sendLink,
    handleIncomingLink: handleIncomingLink,
    renderForm: renderForm,
    onEvent: onEvent,
    isSending: function () { return state.sending; },
    isCompleting: function () { return state.completing; },
    getLastError: function () { return state.lastError; }
  };

  console.log('[CF] Magic link auth loaded');
})();
