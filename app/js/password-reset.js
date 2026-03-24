/**
 * CF-204: Password Reset Flow
 * Forgot password page with email input, Firebase sendPasswordResetEmail(),
 * success/error states, custom styled form.
 *
 * @namespace window.CortexFreelancer.PasswordReset
 */
(function () {
  'use strict';

  // ─── State ─────────────────────────────────────────────

  var state = {
    loading: false,
    sent: false,
    error: null,
    email: ''
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

  /**
   * Validate email format.
   * @param {string} email
   * @returns {boolean}
   */
  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || '');
  }

  // ─── CSS ───────────────────────────────────────────────

  /**
   * Inject password reset styles once.
   */
  function injectStyles() {
    if (document.getElementById('cortex-password-reset-styles')) return;
    var style = document.createElement('style');
    style.id = 'cortex-password-reset-styles';
    style.textContent =
      '.cortex-pw-reset {' +
        'max-width: 440px; margin: 60px auto; padding: 40px;' +
        'background: #fff; border-radius: 12px;' +
        'box-shadow: 0 4px 24px rgba(0,0,0,0.08);' +
        'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;' +
        'color: #2d3436;' +
      '}' +
      '.cortex-pw-reset h2 {' +
        'margin: 0 0 8px; font-size: 24px; text-align: center;' +
      '}' +
      '.cortex-pw-reset .subtitle {' +
        'text-align: center; color: #636e72; font-size: 14px; margin-bottom: 28px;' +
      '}' +
      '.cortex-pw-reset label {' +
        'display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; color: #636e72;' +
      '}' +
      '.cortex-pw-reset input[type="email"] {' +
        'width: 100%; padding: 12px 14px; border: 1px solid #dfe6e9;' +
        'border-radius: 8px; font-size: 15px; box-sizing: border-box;' +
        'transition: border-color 0.2s;' +
      '}' +
      '.cortex-pw-reset input[type="email"]:focus {' +
        'border-color: #6c5ce7; outline: none; box-shadow: 0 0 0 3px rgba(108,92,231,0.12);' +
      '}' +
      '.cortex-pw-reset .btn-submit {' +
        'width: 100%; padding: 14px; margin-top: 20px; border: none;' +
        'border-radius: 8px; background: #6c5ce7; color: #fff;' +
        'font-size: 15px; font-weight: 600; cursor: pointer;' +
        'transition: background 0.2s;' +
      '}' +
      '.cortex-pw-reset .btn-submit:hover { background: #5b4bd5; }' +
      '.cortex-pw-reset .btn-submit:disabled {' +
        'background: #b2bec3; cursor: not-allowed;' +
      '}' +
      '.cortex-pw-reset .error-msg {' +
        'background: #fff5f5; color: #d63031; border: 1px solid #fab1a0;' +
        'border-radius: 8px; padding: 10px 14px; margin-top: 16px; font-size: 13px;' +
      '}' +
      '.cortex-pw-reset .success-box {' +
        'text-align: center; padding: 20px 0;' +
      '}' +
      '.cortex-pw-reset .success-box .icon {' +
        'font-size: 48px; margin-bottom: 12px;' +
      '}' +
      '.cortex-pw-reset .success-box h3 {' +
        'margin: 0 0 8px; font-size: 20px; color: #00b894;' +
      '}' +
      '.cortex-pw-reset .success-box p {' +
        'color: #636e72; font-size: 14px; margin: 0 0 20px;' +
      '}' +
      '.cortex-pw-reset .link-back {' +
        'display: inline-block; color: #6c5ce7; font-size: 13px;' +
        'text-decoration: none; margin-top: 16px; cursor: pointer;' +
      '}' +
      '.cortex-pw-reset .link-back:hover { text-decoration: underline; }';
    document.head.appendChild(style);
  }

  // ─── Firebase Integration ──────────────────────────────

  /**
   * Map Firebase error codes to user-friendly messages.
   * @param {string} code
   * @returns {string}
   */
  function mapFirebaseError(code) {
    var errors = {
      'auth/user-not-found': 'No account found with this email address.',
      'auth/invalid-email': 'Please enter a valid email address.',
      'auth/too-many-requests': 'Too many attempts. Please try again later.',
      'auth/network-request-failed': 'Network error. Please check your connection.'
    };
    return errors[code] || 'An error occurred. Please try again.';
  }

  /**
   * Send password reset email via Firebase Auth.
   * @param {string} email
   * @returns {Promise}
   */
  function sendResetEmail(email) {
    if (typeof firebase === 'undefined' || !firebase.auth) {
      return Promise.reject(new Error('Firebase Auth is not available'));
    }
    return firebase.auth().sendPasswordResetEmail(email);
  }

  // ─── Rendering ─────────────────────────────────────────

  var containerEl = null;

  /**
   * Render the password reset form or success state.
   */
  function render() {
    if (!containerEl) return;

    if (state.sent) {
      containerEl.innerHTML =
        '<div class="cortex-pw-reset">' +
          '<div class="success-box">' +
            '<div class="icon">&#9993;</div>' +
            '<h3>Check Your Email</h3>' +
            '<p>We sent a password reset link to<br><strong>' +
              escapeHtml(state.email) + '</strong></p>' +
            '<p style="font-size:13px;color:#b2bec3;">Didn\'t receive it? Check spam or try again.</p>' +
            '<a class="link-back" data-action="retry">Send again</a>' +
          '</div>' +
        '</div>';
      return;
    }

    containerEl.innerHTML =
      '<div class="cortex-pw-reset">' +
        '<h2>Reset Password</h2>' +
        '<p class="subtitle">Enter your email and we\'ll send a reset link.</p>' +
        '<form id="cortex-pw-reset-form">' +
          '<label for="cortex-pw-email">Email Address</label>' +
          '<input type="email" id="cortex-pw-email" placeholder="you@example.com" ' +
            'value="' + escapeHtml(state.email) + '" autocomplete="email" required>' +
          '<button type="submit" class="btn-submit"' +
            (state.loading ? ' disabled' : '') + '>' +
            (state.loading ? 'Sending...' : 'Send Reset Link') +
          '</button>' +
        '</form>' +
        (state.error ?
          '<div class="error-msg">' + escapeHtml(state.error) + '</div>' : '') +
        '<div style="text-align:center;">' +
          '<a class="link-back" data-action="back-to-login">Back to Login</a>' +
        '</div>' +
      '</div>';
  }

  /**
   * Handle form submission.
   * @param {Event} e
   */
  function handleSubmit(e) {
    e.preventDefault();
    var input = document.getElementById('cortex-pw-email');
    var email = input ? input.value.trim() : '';

    if (!isValidEmail(email)) {
      state.error = 'Please enter a valid email address.';
      render();
      return;
    }

    state.email = email;
    state.loading = true;
    state.error = null;
    render();

    sendResetEmail(email)
      .then(function () {
        state.loading = false;
        state.sent = true;
        render();
        window.dispatchEvent(new CustomEvent('cortex:password-reset-sent', {
          detail: { email: email }
        }));
      })
      .catch(function (err) {
        state.loading = false;
        state.error = mapFirebaseError(err.code || '');
        render();
        window.dispatchEvent(new CustomEvent('cortex:password-reset-error', {
          detail: { email: email, error: err.code }
        }));
      });
  }

  // ─── Event Delegation ──────────────────────────────────

  /**
   * Handle click events on the container.
   * @param {Event} e
   */
  function handleClick(e) {
    var action = e.target.getAttribute('data-action');
    if (action === 'retry') {
      state.sent = false;
      state.error = null;
      render();
    } else if (action === 'back-to-login') {
      window.dispatchEvent(new CustomEvent('cortex:navigate', {
        detail: { page: 'login' }
      }));
    }
  }

  /**
   * Mount the password reset form into a container.
   * @param {string|HTMLElement} container
   */
  function mount(container) {
    injectStyles();
    containerEl = typeof container === 'string' ? document.querySelector(container) : container;
    if (!containerEl) {
      console.warn('[PasswordReset] Container not found:', container);
      return;
    }

    // Reset state
    state.loading = false;
    state.sent = false;
    state.error = null;
    state.email = '';

    render();

    containerEl.addEventListener('submit', handleSubmit);
    containerEl.addEventListener('click', handleClick);
  }

  /**
   * Unmount and clean up event listeners.
   */
  function unmount() {
    if (containerEl) {
      containerEl.removeEventListener('submit', handleSubmit);
      containerEl.removeEventListener('click', handleClick);
      containerEl.innerHTML = '';
      containerEl = null;
    }
  }

  /**
   * Initialize the module.
   */
  function init() {
    injectStyles();
    console.log('[PasswordReset] Module initialized');
  }

  // ─── Namespace Export ──────────────────────────────────

  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.PasswordReset = {
    init: init,
    mount: mount,
    unmount: unmount
  };
})();
