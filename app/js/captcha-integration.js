/**
 * Cortex Freelancer — CAPTCHA Integration
 * [CF-222] Integrate hCaptcha on the signup form. Renders widget, validates
 * token before form submission, handles expiry and error states.
 *
 * @namespace window.CortexFreelancer.CaptchaIntegration
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  var LOG_PREFIX = '[CF-222]';
  var STYLE_ID = 'cortex-captcha-integration-styles';
  var HCAPTCHA_SCRIPT_ID = 'cortex-hcaptcha-api';
  var HCAPTCHA_API_URL = 'https://js.hcaptcha.com/1/api.js';
  var TOKEN_EXPIRY_MS = 120000; // hCaptcha tokens expire after ~2 min

  var state = {
    siteKey: '',
    widgetId: null,
    token: null,
    tokenTimestamp: 0,
    containerId: null,
    formEl: null,
    initialized: false,
    scriptLoaded: false,
    onVerify: null,
    onExpire: null,
    onError: null
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

  // ── Style injection ─────────────────────────────────────────────────

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent =
      '.cf-captcha-wrapper {' +
        'margin: 16px 0; display: flex; flex-direction: column; align-items: center;' +
      '}' +
      '.cf-captcha-error {' +
        'color: #ff6b6b; font-size: 13px; margin-top: 8px; text-align: center;' +
        'min-height: 20px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;' +
      '}' +
      '.cf-captcha-loading {' +
        'color: #888; font-size: 13px; padding: 20px; text-align: center;' +
      '}';
    document.head.appendChild(s);
  }

  // ── hCaptcha script loader ──────────────────────────────────────────

  function loadHCaptchaScript() {
    return new Promise(function (resolve, reject) {
      if (typeof hcaptcha !== 'undefined') {
        state.scriptLoaded = true;
        resolve();
        return;
      }

      if (document.getElementById(HCAPTCHA_SCRIPT_ID)) {
        // Script tag exists but not loaded yet — wait for it
        var check = setInterval(function () {
          if (typeof hcaptcha !== 'undefined') {
            clearInterval(check);
            state.scriptLoaded = true;
            resolve();
          }
        }, 100);
        setTimeout(function () {
          clearInterval(check);
          reject(new Error('hCaptcha script load timeout'));
        }, 10000);
        return;
      }

      var script = document.createElement('script');
      script.id = HCAPTCHA_SCRIPT_ID;
      script.src = HCAPTCHA_API_URL + '?render=explicit';
      script.async = true;
      script.defer = true;

      script.onload = function () {
        state.scriptLoaded = true;
        log('hCaptcha script loaded.');
        resolve();
      };

      script.onerror = function () {
        reject(new Error('Failed to load hCaptcha script'));
      };

      document.head.appendChild(script);
    });
  }

  // ── Widget rendering ────────────────────────────────────────────────

  function renderWidget(containerId) {
    if (!state.scriptLoaded || typeof hcaptcha === 'undefined') {
      warn('hCaptcha not loaded yet.');
      return null;
    }

    var container = document.getElementById(containerId);
    if (!container) {
      warn('Container not found:', containerId);
      return null;
    }

    // Clear any existing content
    container.innerHTML = '';

    var widgetDiv = document.createElement('div');
    container.appendChild(widgetDiv);

    state.widgetId = hcaptcha.render(widgetDiv, {
      sitekey: state.siteKey,
      callback: onCaptchaVerified,
      'expired-callback': onCaptchaExpired,
      'error-callback': onCaptchaError,
      theme: 'dark',
      size: 'normal'
    });

    state.containerId = containerId;
    log('Widget rendered, id:', state.widgetId);
    return state.widgetId;
  }

  // ── Callbacks ───────────────────────────────────────────────────────

  function onCaptchaVerified(token) {
    state.token = token;
    state.tokenTimestamp = Date.now();
    clearError();
    log('Verified.');

    if (typeof state.onVerify === 'function') {
      state.onVerify(token);
    }
  }

  function onCaptchaExpired() {
    state.token = null;
    state.tokenTimestamp = 0;
    showError('CAPTCHA expired. Please solve it again.');
    log('Token expired.');

    if (typeof state.onExpire === 'function') {
      state.onExpire();
    }
  }

  function onCaptchaError(err) {
    state.token = null;
    state.tokenTimestamp = 0;
    showError('CAPTCHA error. Please try again.');
    warn('Error:', err);

    if (typeof state.onError === 'function') {
      state.onError(err);
    }
  }

  // ── Error display ───────────────────────────────────────────────────

  function showError(msg) {
    var container = state.containerId ? document.getElementById(state.containerId) : null;
    if (!container) return;

    var errEl = container.querySelector('.cf-captcha-error');
    if (!errEl) {
      errEl = document.createElement('div');
      errEl.className = 'cf-captcha-error';
      container.appendChild(errEl);
    }
    errEl.textContent = msg;
  }

  function clearError() {
    var container = state.containerId ? document.getElementById(state.containerId) : null;
    if (!container) return;
    var errEl = container.querySelector('.cf-captcha-error');
    if (errEl) errEl.textContent = '';
  }

  // ── Token management ────────────────────────────────────────────────

  /**
   * Get the current CAPTCHA token, or null if expired/missing.
   * @returns {string|null}
   */
  function getToken() {
    if (!state.token) return null;
    if (Date.now() - state.tokenTimestamp > TOKEN_EXPIRY_MS) {
      state.token = null;
      state.tokenTimestamp = 0;
      return null;
    }
    return state.token;
  }

  /**
   * Check whether the CAPTCHA has been solved and the token is still valid.
   * @returns {boolean}
   */
  function isVerified() {
    return getToken() !== null;
  }

  /**
   * Reset the widget so the user can solve it again.
   */
  function reset() {
    state.token = null;
    state.tokenTimestamp = 0;
    clearError();
    if (state.widgetId !== null && typeof hcaptcha !== 'undefined') {
      hcaptcha.reset(state.widgetId);
    }
  }

  // ── Form integration ────────────────────────────────────────────────

  /**
   * Attach to a signup form — intercepts submit and blocks if CAPTCHA
   * isn't solved.
   *
   * @param {string} formSelector  CSS selector for the form
   */
  function attachToForm(formSelector) {
    var form = document.querySelector(formSelector);
    if (!form) {
      warn('Form not found:', formSelector);
      return;
    }

    state.formEl = form;

    form.addEventListener('submit', function (e) {
      if (!isVerified()) {
        e.preventDefault();
        e.stopImmediatePropagation();
        showError('Please complete the CAPTCHA before submitting.');
        log('Form submit blocked — no valid token.');
        return false;
      }
    });

    log('Attached to form:', formSelector);
  }

  // ── Init / Destroy ──────────────────────────────────────────────────

  /**
   * Initialize hCaptcha integration.
   *
   * @param {Object} options
   * @param {string} options.siteKey       hCaptcha site key
   * @param {string} options.containerId   DOM element ID to render widget in
   * @param {string} [options.formSelector] CSS selector for signup form
   * @param {Function} [options.onVerify]  Called with token on success
   * @param {Function} [options.onExpire]  Called when token expires
   * @param {Function} [options.onError]   Called on CAPTCHA error
   * @returns {Promise<void>}
   */
  function init(options) {
    if (state.initialized) {
      log('Already initialized.');
      return Promise.resolve();
    }

    if (!options || !options.siteKey) {
      return Promise.reject(new Error('siteKey is required'));
    }

    state.siteKey = options.siteKey;
    state.onVerify = options.onVerify || null;
    state.onExpire = options.onExpire || null;
    state.onError = options.onError || null;

    injectStyles();

    // Show loading state
    var container = document.getElementById(options.containerId);
    if (container) {
      container.innerHTML = '<div class="cf-captcha-loading">Loading CAPTCHA...</div>';
    }

    return loadHCaptchaScript().then(function () {
      renderWidget(options.containerId);

      if (options.formSelector) {
        attachToForm(options.formSelector);
      }

      state.initialized = true;
      log('Initialized.');
    }).catch(function (err) {
      warn('Init failed:', err);
      if (container) {
        container.innerHTML = '<div class="cf-captcha-error">Failed to load CAPTCHA. Please refresh the page.</div>';
      }
      return Promise.reject(err);
    });
  }

  /**
   * Tear down — remove widget and clean up.
   */
  function destroy() {
    if (state.widgetId !== null && typeof hcaptcha !== 'undefined') {
      try { hcaptcha.remove(state.widgetId); } catch (e) { /* ignore */ }
    }
    state.widgetId = null;
    state.token = null;
    state.tokenTimestamp = 0;
    state.formEl = null;
    state.initialized = false;
    state.onVerify = null;
    state.onExpire = null;
    state.onError = null;
    log('Destroyed.');
  }

  // ── Public API ──────────────────────────────────────────────────────

  window.CortexFreelancer.CaptchaIntegration = {
    init: init,
    destroy: destroy,
    getToken: getToken,
    isVerified: isVerified,
    reset: reset,
    renderWidget: renderWidget,
    attachToForm: attachToForm
  };

  console.log('[CF] CAPTCHA integration loaded');
})();
