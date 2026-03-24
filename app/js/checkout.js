/**
 * [CF-172] Stripe Checkout Session Creation (Client-Side)
 * Wire up checkout flow: create Checkout sessions via /api/checkout with
 * correct price IDs and success/cancel URLs.
 * Exposed on window.CortexFreelancer.Checkout
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  var API_ENDPOINT = '/api/checkout';
  var VALID_PLANS = ['pro_monthly', 'pro_annual'];
  var isProcessing = false;

  function escHtml(str) {
    var d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  /**
   * Create a Stripe Checkout session and redirect.
   * @param {object} opts - { email: string, plan: 'pro_monthly'|'pro_annual', uid?: string }
   * @returns {Promise<{success: boolean, url?: string, error?: string}>}
   */
  function createSession(opts) {
    if (isProcessing) {
      return Promise.resolve({ success: false, error: 'Checkout already in progress' });
    }

    if (!opts || !opts.email || !opts.plan) {
      return Promise.resolve({ success: false, error: 'Email and plan are required' });
    }

    if (VALID_PLANS.indexOf(opts.plan) === -1) {
      return Promise.resolve({ success: false, error: 'Invalid plan. Use pro_monthly or pro_annual.' });
    }

    var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(opts.email.trim())) {
      return Promise.resolve({ success: false, error: 'Please enter a valid email address' });
    }

    isProcessing = true;

    var payload = {
      email: opts.email.trim(),
      plan: opts.plan
    };
    if (opts.uid) payload.uid = opts.uid;

    return fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(function (res) { return res.json(); })
    .then(function (data) {
      isProcessing = false;
      if (data.success && data.url) {
        window.location.href = data.url;
        return { success: true, url: data.url };
      }
      return { success: false, error: data.error || data.message || 'Checkout failed' };
    })
    .catch(function (err) {
      isProcessing = false;
      return { success: false, error: 'Network error — please try again' };
    });
  }

  /**
   * Verify a completed checkout session.
   * @param {string} sessionId - Stripe session ID from URL
   * @returns {Promise<{success: boolean, status?: string, email?: string}>}
   */
  function verifySession(sessionId) {
    if (!sessionId) return Promise.resolve({ success: false, error: 'No session ID' });

    return fetch(API_ENDPOINT + '?session_id=' + encodeURIComponent(sessionId))
      .then(function (res) { return res.json(); })
      .then(function (data) { return data; })
      .catch(function () {
        return { success: false, error: 'Failed to verify session' };
      });
  }

  /**
   * Bind checkout to a button element.
   * @param {HTMLElement|string} button - Button element or selector
   * @param {object} opts - { email, plan, uid, onError }
   */
  function bindButton(button, opts) {
    var el = typeof button === 'string' ? document.querySelector(button) : button;
    if (!el) return;

    el.addEventListener('click', function (e) {
      e.preventDefault();
      var btnText = el.textContent;
      el.disabled = true;
      el.textContent = 'Processing...';

      // Allow email to come from an input field if opts.emailSelector is set
      var email = opts.email;
      if (opts.emailSelector) {
        var input = document.querySelector(opts.emailSelector);
        if (input) email = input.value;
      }

      createSession({ email: email, plan: opts.plan, uid: opts.uid })
        .then(function (result) {
          if (!result.success) {
            el.disabled = false;
            el.textContent = btnText;
            if (typeof opts.onError === 'function') {
              opts.onError(result.error);
            }
          }
        });
    });
  }

  /**
   * Check if checkout is currently processing.
   */
  function isInProgress() {
    return isProcessing;
  }

  window.CortexFreelancer.Checkout = {
    createSession: createSession,
    verifySession: verifySession,
    bindButton: bindButton,
    isInProgress: isInProgress
  };
})();
