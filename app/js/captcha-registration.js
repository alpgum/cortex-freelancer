/**
 * CF-222: CAPTCHA Registration — hCaptcha Integration for Signup Form
 * Renders hCaptcha widget on the registration form, captures and validates
 * the CAPTCHA response token before allowing form submission.
 *
 * @namespace window.CortexFreelancer.CaptchaRegistration
 */
(function () {
  'use strict';

  var STYLE_ID = 'cortex-captcha-registration-styles';
  var HCAPTCHA_SCRIPT_ID = 'cortex-hcaptcha-script';
  var HCAPTCHA_API_URL = 'https://js.hcaptcha.com/1/api.js';
  var DEFAULT_SITE_KEY = '';
  var ERROR_DISPLAY_DURATION = 5000;

  var state = {
    siteKey: DEFAULT_SITE_KEY,
    widgetId: null,
    token: null,
    containerId: null,
    formSelector: null,
    initialized: false,
    scriptLoaded: false,
    rendering: false,
    errorMessage: null
  };

  // ─── Helpers ───────────────────────────────────────────

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str || ''));
    return div.innerHTML;
  }

  function getContainer() {
    if (!state.containerId) return null;
    return document.getElementById(state.containerId);
  }

  function getForm() {
    if (!state.formSelector) return null;
    return document.querySelector(state.formSelector);
  }

  function getErrorElement() {
    var container = getContainer();
    if (!container) return null;
    return container.querySelector('.captcha-error-message');
  }

  // ─── CSS ───────────────────────────────────────────────

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent =
      '.captcha-registration-wrapper {' +
        'margin: 16px 0; display: flex; flex-direction: column; align-items: center;' +
      '}' +
      '.captcha-registration-wrapper .captcha-widget-container {' +
        'min-height: 78px; display: flex; align-items: center; justify-content: center;' +
      '}' +
      '.captcha-error-message {' +
        'color: #e74c3c; font-size: 13px; margin-top: 8px; text-align: center;' +
        'padding: 6px 12px; border-radius: 4px; background: rgba(231,76,60,0.08);' +
        'border: 1px solid rgba(231,76,60,0.2); display: none; max-width: 320px;' +
        'animation: captcha-error-fade-in 0.25s ease;' +
      '}' +
      '.captcha-error-message.visible {' +
        'display: block;' +
      '}' +
      '.captcha-loading-placeholder {' +
        'color: #888; font-size: 13px; padding: 20px 0; text-align: center;' +
      '}' +
      '@keyframes captcha-error-fade-in {' +
        'from { opacity: 0; transform: translateY(-4px); }' +
        'to { opacity: 1; transform: translateY(0); }' +
      '}';
    document.head.appendChild(s);
  }

  function removeStyles() {
    var s = document.getElementById(STYLE_ID);
    if (s && s.parentNode) s.parentNode.removeChild(s);
  }

  // ─── hCaptcha Script Loader ────────────────────────────

  function loadHCaptchaScript(callback) {
    if (state.scriptLoaded || window.hcaptcha) {
      state.scriptLoaded = true;
      if (typeof callback === 'function') callback();
      return;
    }

    if (document.getElementById(HCAPTCHA_SCRIPT_ID)) {
      // Script tag exists but may still be loading — poll for readiness
      waitForHCaptcha(callback);
      return;
    }

    var script = document.createElement('script');
    script.id = HCAPTCHA_SCRIPT_ID;
    script.src = HCAPTCHA_API_URL + '?render=explicit&onload=_cortexHCaptchaReady';
    script.async = true;
    script.defer = true;

    window._cortexHCaptchaReady = function () {
      state.scriptLoaded = true;
      delete window._cortexHCaptchaReady;
      if (typeof callback === 'function') callback();
    };

    script.onerror = function () {
      console.error('[CaptchaRegistration] Failed to load hCaptcha script');
      showError('Failed to load CAPTCHA service. Please refresh and try again.');
    };

    document.head.appendChild(script);
  }

  function waitForHCaptcha(callback, attempts) {
    attempts = attempts || 0;
    if (window.hcaptcha) {
      state.scriptLoaded = true;
      if (typeof callback === 'function') callback();
      return;
    }
    if (attempts > 50) {
      console.error('[CaptchaRegistration] Timed out waiting for hCaptcha');
      showError('CAPTCHA service timed out. Please refresh and try again.');
      return;
    }
    setTimeout(function () {
      waitForHCaptcha(callback, attempts + 1);
    }, 200);
  }

  // ─── hCaptcha Callbacks ────────────────────────────────

  function onSuccess(token) {
    state.token = token;
    state.errorMessage = null;
    hideError();
    console.log('[CaptchaRegistration] CAPTCHA verified successfully');
  }

  function onExpire() {
    state.token = null;
    console.log('[CaptchaRegistration] CAPTCHA token expired');
    showError('CAPTCHA expired. Please complete it again.');
  }

  function onError(err) {
    state.token = null;
    console.error('[CaptchaRegistration] CAPTCHA error:', err);
    showError('CAPTCHA encountered an error. Please try again.');
  }

  // ─── Error Display ─────────────────────────────────────

  function showError(message) {
    state.errorMessage = message;
    var el = getErrorElement();
    if (!el) return;
    el.textContent = message;
    el.classList.add('visible');
  }

  function hideError() {
    state.errorMessage = null;
    var el = getErrorElement();
    if (!el) return;
    el.textContent = '';
    el.classList.remove('visible');
  }

  // ─── Validation ────────────────────────────────────────

  /**
   * Validate that a CAPTCHA token exists.
   * @returns {boolean} true if valid, false otherwise (also shows error)
   */
  function validate() {
    if (state.token && state.token.length > 0) {
      hideError();
      return true;
    }
    showError('Please complete the CAPTCHA verification to continue.');
    return false;
  }

  // ─── Form Submission Interception ──────────────────────

  function handleFormSubmit(e) {
    if (!validate()) {
      e.preventDefault();
      e.stopImmediatePropagation();
      return false;
    }

    // Inject token into form as a hidden field
    var form = getForm();
    if (form) {
      var existing = form.querySelector('input[name="h-captcha-response"]');
      if (!existing) {
        var input = document.createElement('input');
        input.type = 'hidden';
        input.name = 'h-captcha-response';
        input.value = state.token;
        form.appendChild(input);
      } else {
        existing.value = state.token;
      }
    }

    return true;
  }

  function attachFormListener() {
    var form = getForm();
    if (!form) return;
    form.removeEventListener('submit', handleFormSubmit, true);
    form.addEventListener('submit', handleFormSubmit, true);
  }

  function detachFormListener() {
    var form = getForm();
    if (!form) return;
    form.removeEventListener('submit', handleFormSubmit, true);
  }

  // ─── Widget Rendering ──────────────────────────────────

  function buildWidgetMarkup() {
    return (
      '<div class="captcha-registration-wrapper">' +
        '<div class="captcha-widget-container" id="captcha-widget-target"></div>' +
        '<div class="captcha-error-message" role="alert" aria-live="polite"></div>' +
      '</div>'
    );
  }

  /**
   * Render the hCaptcha widget into the container element.
   * @param {Object} [options]
   * @param {string} [options.containerId] - ID of the container element for the widget
   * @param {string} [options.formSelector] - CSS selector for the signup form
   * @param {string} [options.siteKey] - hCaptcha site key
   * @param {string} [options.size] - Widget size: 'normal' | 'compact' (default: 'normal')
   * @param {string} [options.theme] - Widget theme: 'light' | 'dark' (default: 'light')
   */
  function render(options) {
    options = options || {};

    if (options.siteKey) state.siteKey = options.siteKey;
    if (options.containerId) state.containerId = options.containerId;
    if (options.formSelector) state.formSelector = options.formSelector;

    if (!state.siteKey) {
      console.error('[CaptchaRegistration] No site key configured. Call init() with a siteKey.');
      return;
    }

    var container = getContainer();
    if (!container) {
      console.error('[CaptchaRegistration] Container element not found: #' + state.containerId);
      return;
    }

    if (state.rendering) return;
    state.rendering = true;

    // Insert wrapper markup
    container.innerHTML = buildWidgetMarkup();
    var widgetTarget = container.querySelector('#captcha-widget-target');

    loadHCaptchaScript(function () {
      if (!window.hcaptcha) {
        console.error('[CaptchaRegistration] hCaptcha API not available');
        state.rendering = false;
        return;
      }

      try {
        state.widgetId = window.hcaptcha.render(widgetTarget, {
          sitekey: state.siteKey,
          size: options.size || 'normal',
          theme: options.theme || 'light',
          callback: onSuccess,
          'expired-callback': onExpire,
          'error-callback': onError
        });

        attachFormListener();
        state.rendering = false;
        console.log('[CaptchaRegistration] Widget rendered (widgetId: ' + state.widgetId + ')');
      } catch (err) {
        state.rendering = false;
        console.error('[CaptchaRegistration] Failed to render widget:', err);
        showError('Failed to render CAPTCHA. Please refresh and try again.');
      }
    });
  }

  // ─── Public Methods ────────────────────────────────────

  /**
   * Get the current CAPTCHA response token.
   * @returns {string|null}
   */
  function getToken() {
    // Attempt to get the latest token from the hCaptcha widget directly
    if (window.hcaptcha && state.widgetId !== null) {
      try {
        var liveToken = window.hcaptcha.getResponse(state.widgetId);
        if (liveToken) state.token = liveToken;
      } catch (e) {
        // Fall through to cached token
      }
    }
    return state.token;
  }

  /**
   * Reset the CAPTCHA widget so the user must solve it again.
   */
  function reset() {
    state.token = null;
    hideError();

    if (window.hcaptcha && state.widgetId !== null) {
      try {
        window.hcaptcha.reset(state.widgetId);
        console.log('[CaptchaRegistration] Widget reset');
      } catch (err) {
        console.error('[CaptchaRegistration] Failed to reset widget:', err);
      }
    }
  }

  /**
   * Check whether the CAPTCHA has been completed.
   * @returns {boolean}
   */
  function isComplete() {
    return !!(getToken());
  }

  // ─── Init / Destroy ────────────────────────────────────

  /**
   * Initialize the CAPTCHA registration module.
   * @param {Object} config
   * @param {string} config.siteKey - hCaptcha site key (required)
   * @param {string} config.containerId - ID of the DOM element to render into (required)
   * @param {string} [config.formSelector] - CSS selector for the registration form
   * @param {string} [config.size] - Widget size: 'normal' | 'compact'
   * @param {string} [config.theme] - Widget theme: 'light' | 'dark'
   * @param {boolean} [config.autoRender] - Render widget immediately (default: true)
   */
  function init(config) {
    config = config || {};

    if (!config.siteKey) {
      console.error('[CaptchaRegistration] init() requires a siteKey');
      return;
    }

    if (!config.containerId) {
      console.error('[CaptchaRegistration] init() requires a containerId');
      return;
    }

    state.siteKey = config.siteKey;
    state.containerId = config.containerId;
    state.formSelector = config.formSelector || null;
    state.token = null;
    state.widgetId = null;
    state.errorMessage = null;

    injectStyles();
    state.initialized = true;

    var autoRender = config.autoRender !== false;
    if (autoRender) {
      render({
        size: config.size,
        theme: config.theme
      });
    }

    console.log('[CaptchaRegistration] Module initialized (siteKey: ' + state.siteKey.substring(0, 8) + '...)');
  }

  /**
   * Tear down the widget and clean up all DOM elements and listeners.
   */
  function destroy() {
    detachFormListener();

    if (window.hcaptcha && state.widgetId !== null) {
      try {
        window.hcaptcha.remove(state.widgetId);
      } catch (e) {
        // Widget may already be removed from the DOM
      }
    }

    var container = getContainer();
    if (container) {
      container.innerHTML = '';
    }

    removeStyles();

    state.widgetId = null;
    state.token = null;
    state.initialized = false;
    state.rendering = false;
    state.errorMessage = null;

    console.log('[CaptchaRegistration] Module destroyed');
  }

  // ─── Namespace Export ──────────────────────────────────

  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.CaptchaRegistration = {
    init: init,
    render: render,
    reset: reset,
    validate: validate,
    getToken: getToken,
    isComplete: isComplete,
    destroy: destroy
  };
})();
