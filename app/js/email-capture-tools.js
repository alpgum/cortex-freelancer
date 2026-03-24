/**
 * CF-246: Email Capture on Tool Pages
 * Shows email signup prompt after user completes a tool action.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_email_capture_dismissed';
  var DISPLAY_DELAY_MS = 1500;

  var DEFAULT_CONFIG = {
    heading: 'Save your results — create free account',
    subtext: 'Get unlimited access to all freelancer tools, saved history, and weekly insights.',
    ctaText: 'Create Free Account',
    dismissText: 'Maybe later',
    placeholder: 'you@example.com'
  };

  /**
   * Check if the capture prompt has been dismissed or user is already signed up.
   * @returns {boolean}
   */
  function isDismissed() {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch (_e) {
      return false;
    }
  }

  /**
   * Mark the capture prompt as dismissed.
   */
  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch (_e) {
      // Storage unavailable
    }
  }

  /**
   * Build the capture prompt DOM data.
   * @param {object} [options]
   * @param {string} [options.toolName] - Name of the tool the user just used
   * @param {string} [options.heading]
   * @param {string} [options.subtext]
   * @param {string} [options.ctaText]
   * @returns {object} Prompt configuration object
   */
  function buildPrompt(options) {
    var opts = options || {};
    var toolName = opts.toolName || 'this tool';

    return {
      heading: opts.heading || DEFAULT_CONFIG.heading,
      subtext: opts.subtext || DEFAULT_CONFIG.subtext,
      ctaText: opts.ctaText || DEFAULT_CONFIG.ctaText,
      dismissText: DEFAULT_CONFIG.dismissText,
      placeholder: DEFAULT_CONFIG.placeholder,
      toolName: toolName,
      timestamp: Date.now()
    };
  }

  /**
   * Validate an email address.
   * @param {string} email
   * @returns {boolean}
   */
  function validateEmail(email) {
    if (!email || typeof email !== 'string') return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  }

  /**
   * Trigger the email capture flow after a tool action completes.
   * @param {object} params
   * @param {string} params.toolName - Which tool triggered the capture
   * @param {string} [params.resultSummary] - Brief summary of what the user generated
   * @param {function} [params.onSubmit] - Callback when email is submitted
   * @param {function} [params.onDismiss] - Callback when prompt is dismissed
   * @returns {{ prompt: object, show: boolean }}
   */
  function triggerCapture(params) {
    var p = params || {};

    if (isDismissed()) {
      return { prompt: null, show: false };
    }

    var prompt = buildPrompt({ toolName: p.toolName });
    prompt.resultSummary = p.resultSummary || null;
    prompt.delayMs = DISPLAY_DELAY_MS;

    return {
      prompt: prompt,
      show: true,
      submit: function (email) {
        if (!validateEmail(email)) {
          return { success: false, error: 'Please enter a valid email address.' };
        }
        dismiss();
        if (typeof p.onSubmit === 'function') p.onSubmit(email.trim(), p.toolName);
        return { success: true, email: email.trim() };
      },
      dismiss: function () {
        dismiss();
        if (typeof p.onDismiss === 'function') p.onDismiss(p.toolName);
      }
    };
  }

  /**
   * Reset dismissed state (for testing or re-engagement).
   */
  function reset() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (_e) {
      // Storage unavailable
    }
  }

  // Export to namespace
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.EmailCaptureTools = {
    triggerCapture: triggerCapture,
    buildPrompt: buildPrompt,
    validateEmail: validateEmail,
    isDismissed: isDismissed,
    reset: reset
  };
})();
