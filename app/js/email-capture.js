/**
 * CF-246: Email Capture on Tool Pages — signup prompt after tool action,
 * captures email, stores to Firestore, triggers drip campaign.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_email_capture';
  var API_ENDPOINT = '/api/email-capture';
  var DRIP_ENDPOINT = '/api/drip-campaign';
  var PROMPT_DELAY_MS = 1500;

  /**
   * EmailCapture — shows signup prompt after a user completes a tool action.
   * @constructor
   * @param {object} [options]
   * @param {string} [options.containerId] - DOM element ID to inject prompt into
   * @param {number} [options.delay] - Delay in ms before showing prompt
   */
  function EmailCapture(options) {
    options = options || {};
    this.containerId = options.containerId || 'email-capture-container';
    this.delay = typeof options.delay === 'number' ? options.delay : PROMPT_DELAY_MS;
    this._dismissed = false;
  }

  /**
   * Check whether user has already subscribed.
   * @returns {boolean}
   */
  EmailCapture.prototype.isSubscribed = function () {
    try {
      var data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data).subscribed === true : false;
    } catch (_e) {
      return false;
    }
  };

  /**
   * Show the email capture prompt after a tool action completes.
   * @param {string} toolName - Name of the tool the user just used
   * @param {object} [resultData] - Optional result data from the tool action
   */
  EmailCapture.prototype.showAfterAction = function (toolName, resultData) {
    if (this.isSubscribed() || this._dismissed) return;

    var self = this;
    setTimeout(function () {
      if (self._dismissed) return;
      self._render(toolName, resultData);
    }, self.delay);
  };

  /**
   * Render the capture prompt into the DOM.
   * @param {string} toolName
   * @param {object} [resultData]
   * @private
   */
  EmailCapture.prototype._render = function (toolName, resultData) {
    var container = document.getElementById(this.containerId);
    if (!container) {
      container = document.createElement('div');
      container.id = this.containerId;
      document.body.appendChild(container);
    }

    var headline = 'Save your results \u2014 create a free account';
    var subtext = toolName
      ? 'You just used <strong>' + toolName + '</strong>. Sign up to save your results and unlock more tools.'
      : 'Sign up to save your results and unlock the full toolkit.';

    container.innerHTML =
      '<div class="email-capture">' +
        '<button class="email-capture__close" aria-label="Close">&times;</button>' +
        '<h3 class="email-capture__title">' + headline + '</h3>' +
        '<p class="email-capture__subtitle">' + subtext + '</p>' +
        '<form class="email-capture__form">' +
          '<input type="email" class="email-capture__input" placeholder="you@example.com" required>' +
          '<button type="submit" class="email-capture__btn btn btn--primary">Get Free Access</button>' +
        '</form>' +
        '<p class="email-capture__error" style="display:none"></p>' +
        '<p class="email-capture__success" style="display:none">Check your inbox! We sent you a link.</p>' +
        '<p class="email-capture__privacy">No spam. Unsubscribe anytime.</p>' +
      '</div>';

    var self = this;
    var form = container.querySelector('.email-capture__form');
    var closeBtn = container.querySelector('.email-capture__close');

    closeBtn.addEventListener('click', function () {
      self.dismiss();
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = form.querySelector('.email-capture__input').value.trim();
      if (!email) return;
      self.submit(email, toolName, resultData);
    });
  };

  /**
   * Submit captured email — store to Firestore and trigger drip campaign.
   * @param {string} email
   * @param {string} [toolName]
   * @param {object} [resultData]
   * @returns {Promise<object>}
   */
  EmailCapture.prototype.submit = async function (email, toolName, resultData) {
    var container = document.getElementById(this.containerId);
    var errorEl = container && container.querySelector('.email-capture__error');
    var successEl = container && container.querySelector('.email-capture__success');
    var formEl = container && container.querySelector('.email-capture__form');

    if (!this._validateEmail(email)) {
      if (errorEl) {
        errorEl.textContent = 'Please enter a valid email address.';
        errorEl.style.display = 'block';
      }
      return { success: false, reason: 'invalid_email' };
    }

    var payload = {
      email: email,
      source: 'tool_page',
      toolName: toolName || '',
      capturedAt: new Date().toISOString(),
      page: window.location.pathname
    };

    try {
      // Store to Firestore via API
      var res = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('API error');

      // Trigger drip campaign
      await this._triggerDrip(email, toolName);

      // Mark as subscribed locally
      this._markSubscribed(email);

      if (formEl) formEl.style.display = 'none';
      if (errorEl) errorEl.style.display = 'none';
      if (successEl) successEl.style.display = 'block';

      return { success: true };
    } catch (_err) {
      if (errorEl) {
        errorEl.textContent = 'Something went wrong. Please try again.';
        errorEl.style.display = 'block';
      }
      return { success: false, reason: 'api_error' };
    }
  };

  /**
   * Trigger drip campaign for new subscriber.
   * @param {string} email
   * @param {string} [toolName]
   * @returns {Promise<void>}
   * @private
   */
  EmailCapture.prototype._triggerDrip = async function (email, toolName) {
    try {
      await fetch(DRIP_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email,
          campaign: 'tool_signup',
          toolUsed: toolName || '',
          triggeredAt: new Date().toISOString()
        })
      });
    } catch (_e) {
      // Drip trigger is non-critical
    }
  };

  /**
   * Mark user as subscribed in localStorage.
   * @param {string} email
   * @private
   */
  EmailCapture.prototype._markSubscribed = function (email) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        subscribed: true,
        email: email,
        subscribedAt: new Date().toISOString()
      }));
    } catch (_e) {
      // Storage unavailable
    }
  };

  /**
   * Validate email format.
   * @param {string} email
   * @returns {boolean}
   * @private
   */
  EmailCapture.prototype._validateEmail = function (email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  /**
   * Dismiss the prompt.
   */
  EmailCapture.prototype.dismiss = function () {
    this._dismissed = true;
    var container = document.getElementById(this.containerId);
    if (container) container.innerHTML = '';
  };

  /**
   * Reset subscription state (for testing).
   */
  EmailCapture.prototype.reset = function () {
    this._dismissed = false;
    try { localStorage.removeItem(STORAGE_KEY); } catch (_e) {}
  };

  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.EmailCapture = EmailCapture;
})();
