/**
 * CF-215: Social Login Buttons Styling Consistency
 * Unified Google, Apple, Email login buttons with consistent sizing,
 * spacing, brand colors, hover states. Renders login form.
 *
 * @namespace window.CortexFreelancer.SocialLoginUI
 */
(function () {
  'use strict';

  var STYLE_ID = 'cortex-social-login-styles';
  var CONTAINER_ID = 'cortex-social-login';

  var state = {
    loading: null, // 'google' | 'apple' | 'email' | null
    error: null,
    showEmailForm: false,
    emailValue: '',
    passwordValue: ''
  };

  // ─── Helpers ───────────────────────────────────────────

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str || ''));
    return div.innerHTML;
  }

  // ─── CSS ───────────────────────────────────────────────

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent =
      '.social-login-container {' +
        'display: flex; flex-direction: column; align-items: center;' +
        'gap: 12px; max-width: 400px; margin: 0 auto; padding: 32px 24px;' +
        'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;' +
      '}' +
      '.social-login-container h2 {' +
        'font-size: 22px; font-weight: 700; color: #e0e0e0; margin: 0 0 8px; text-align: center;' +
      '}' +
      '.social-login-container .subtitle {' +
        'font-size: 14px; color: #888; margin: 0 0 16px; text-align: center;' +
      '}' +
      /* Shared button base */
      '.social-login-btn {' +
        'display: flex; align-items: center; justify-content: center; gap: 10px;' +
        'width: 100%; padding: 14px 20px; border: none; border-radius: 8px;' +
        'font-size: 15px; font-weight: 600; cursor: pointer;' +
        'transition: background 0.2s, box-shadow 0.2s, transform 0.1s;' +
        'font-family: inherit; position: relative;' +
      '}' +
      '.social-login-btn:active { transform: scale(0.98); }' +
      '.social-login-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }' +
      '.social-login-btn svg { width: 20px; height: 20px; flex-shrink: 0; }' +
      /* Google */
      '.social-login-btn.google {' +
        'background: #fff; color: #3c4043; border: 1px solid #dadce0;' +
      '}' +
      '.social-login-btn.google:hover:not(:disabled) {' +
        'background: #f8f9fa; box-shadow: 0 1px 3px rgba(0,0,0,0.1);' +
      '}' +
      /* Apple */
      '.social-login-btn.apple {' +
        'background: #000; color: #fff;' +
      '}' +
      '.social-login-btn.apple:hover:not(:disabled) {' +
        'background: #1a1a1a; box-shadow: 0 1px 3px rgba(0,0,0,0.3);' +
      '}' +
      '.social-login-btn.apple svg { fill: #fff; }' +
      /* Email */
      '.social-login-btn.email {' +
        'background: #1e1e2e; color: #e0e0e0; border: 1px solid #2d2d44;' +
      '}' +
      '.social-login-btn.email:hover:not(:disabled) {' +
        'background: #2d2d44; border-color: #00ff88;' +
      '}' +
      '.social-login-btn.email svg { fill: #00ff88; }' +
      /* Divider */
      '.social-login-divider {' +
        'display: flex; align-items: center; gap: 12px; width: 100%;' +
        'color: #636e72; font-size: 13px; margin: 4px 0;' +
      '}' +
      '.social-login-divider::before, .social-login-divider::after {' +
        'content: ""; flex: 1; height: 1px; background: #2d2d44;' +
      '}' +
      /* Email form */
      '.social-login-email-form {' +
        'width: 100%; display: flex; flex-direction: column; gap: 10px;' +
      '}' +
      '.social-login-email-form input {' +
        'width: 100%; padding: 12px 14px; background: #1e1e2e;' +
        'border: 1px solid #2d2d44; border-radius: 8px; color: #e0e0e0;' +
        'font-size: 15px; font-family: inherit; box-sizing: border-box;' +
      '}' +
      '.social-login-email-form input:focus {' +
        'outline: none; border-color: #00ff88;' +
      '}' +
      '.social-login-email-form input::placeholder { color: #636e72; }' +
      '.social-login-submit {' +
        'width: 100%; padding: 14px; background: #00ff88; color: #0a0a0a;' +
        'border: none; border-radius: 8px; font-size: 15px; font-weight: 700;' +
        'cursor: pointer; font-family: inherit; transition: background 0.2s;' +
      '}' +
      '.social-login-submit:hover:not(:disabled) { background: #00e67a; }' +
      '.social-login-submit:disabled { opacity: 0.6; cursor: not-allowed; }' +
      '.social-login-error {' +
        'color: #d63031; font-size: 13px; text-align: center; margin-top: 4px;' +
      '}' +
      '.social-login-spinner {' +
        'width: 16px; height: 16px; border: 2px solid transparent;' +
        'border-top-color: currentColor; border-radius: 50%;' +
        'animation: social-spin 0.6s linear infinite; display: inline-block;' +
      '}' +
      '@keyframes social-spin { to { transform: rotate(360deg); } }';
    document.head.appendChild(s);
  }

  // ─── SVG Icons ─────────────────────────────────────────

  var icons = {
    google: '<svg viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>',
    apple: '<svg viewBox="0 0 24 24"><path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>',
    email: '<svg viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>'
  };

  // ─── Render ────────────────────────────────────────────

  function spinnerHtml() {
    return '<span class="social-login-spinner"></span>';
  }

  function render() {
    var container = document.getElementById(CONTAINER_ID);
    if (!container) return;

    var html = '<div class="social-login-container">' +
      '<h2>Welcome to Cortex</h2>' +
      '<p class="subtitle">Sign in to manage your freelance business</p>' +

      // Google button
      '<button class="social-login-btn google" id="social-google" ' + (state.loading ? 'disabled' : '') + '>' +
        (state.loading === 'google' ? spinnerHtml() : icons.google) +
        '<span>Continue with Google</span>' +
      '</button>' +

      // Apple button
      '<button class="social-login-btn apple" id="social-apple" ' + (state.loading ? 'disabled' : '') + '>' +
        (state.loading === 'apple' ? spinnerHtml() : icons.apple) +
        '<span>Continue with Apple</span>' +
      '</button>' +

      '<div class="social-login-divider">or</div>';

    if (state.showEmailForm) {
      html +=
        '<div class="social-login-email-form">' +
          '<input type="email" id="social-email-input" placeholder="Email address" value="' + escapeHtml(state.emailValue) + '">' +
          '<input type="password" id="social-password-input" placeholder="Password" value="">' +
          '<button class="social-login-submit" id="social-email-submit" ' + (state.loading ? 'disabled' : '') + '>' +
            (state.loading === 'email' ? spinnerHtml() + ' Signing in…' : 'Sign in with Email') +
          '</button>' +
        '</div>';
    } else {
      html +=
        '<button class="social-login-btn email" id="social-email" ' + (state.loading ? 'disabled' : '') + '>' +
          icons.email +
          '<span>Continue with Email</span>' +
        '</button>';
    }

    if (state.error) {
      html += '<div class="social-login-error">' + escapeHtml(state.error) + '</div>';
    }

    html += '</div>';
    container.innerHTML = html;
    bindEvents(container);
  }

  // ─── Events ────────────────────────────────────────────

  function bindEvents(container) {
    var googleBtn = container.querySelector('#social-google');
    if (googleBtn) {
      googleBtn.addEventListener('click', function () {
        handleSocialLogin('google');
      });
    }

    var appleBtn = container.querySelector('#social-apple');
    if (appleBtn) {
      appleBtn.addEventListener('click', function () {
        handleSocialLogin('apple');
      });
    }

    var emailBtn = container.querySelector('#social-email');
    if (emailBtn) {
      emailBtn.addEventListener('click', function () {
        state.showEmailForm = true;
        state.error = null;
        render();
        var input = document.getElementById('social-email-input');
        if (input) input.focus();
      });
    }

    var emailSubmit = container.querySelector('#social-email-submit');
    if (emailSubmit) {
      emailSubmit.addEventListener('click', handleEmailSubmit);
    }

    var emailInput = container.querySelector('#social-email-input');
    if (emailInput) {
      emailInput.addEventListener('input', function (e) { state.emailValue = e.target.value; });
    }

    var passwordInput = container.querySelector('#social-password-input');
    if (passwordInput) {
      passwordInput.addEventListener('input', function (e) { state.passwordValue = e.target.value; });
      passwordInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') handleEmailSubmit();
      });
    }
  }

  function handleSocialLogin(provider) {
    state.loading = provider;
    state.error = null;
    render();

    var ns = window.CortexFreelancer || {};
    if (provider === 'google' && ns.Auth && typeof ns.Auth.signInWithGoogle === 'function') {
      ns.Auth.signInWithGoogle().then(onLoginSuccess).catch(onLoginError);
    } else if (provider === 'apple' && ns.AppleSignIn && typeof ns.AppleSignIn.signIn === 'function') {
      ns.AppleSignIn.signIn().then(onLoginSuccess).catch(onLoginError);
    } else {
      // Simulated for development
      setTimeout(function () { onLoginSuccess({ provider: provider }); }, 1200);
    }
  }

  function handleEmailSubmit() {
    if (!state.emailValue) {
      state.error = 'Please enter your email address.';
      render();
      return;
    }
    state.loading = 'email';
    state.error = null;
    render();

    var ns = window.CortexFreelancer || {};
    if (ns.Auth && typeof ns.Auth.signInWithEmail === 'function') {
      ns.Auth.signInWithEmail(state.emailValue, state.passwordValue).then(onLoginSuccess).catch(onLoginError);
    } else {
      setTimeout(function () { onLoginSuccess({ provider: 'email', email: state.emailValue }); }, 1000);
    }
  }

  function onLoginSuccess(result) {
    state.loading = null;
    state.error = null;
    render();
    // Notify via AuthTabSync if available
    var ns = window.CortexFreelancer || {};
    if (ns.AuthTabSync && typeof ns.AuthTabSync.broadcastLogin === 'function') {
      ns.AuthTabSync.broadcastLogin(result);
    }
  }

  function onLoginError(err) {
    state.loading = null;
    state.error = (err && err.message) || 'Login failed. Please try again.';
    render();
  }

  // ─── Init / Destroy ────────────────────────────────────

  function init(containerId) {
    injectStyles();
    var target = containerId || CONTAINER_ID;
    var container = document.getElementById(target);
    if (!container) {
      container = document.createElement('div');
      container.id = target;
      document.body.appendChild(container);
    }
    render();
    console.log('[SocialLoginUI] Module initialized');
  }

  function destroy() {
    var container = document.getElementById(CONTAINER_ID);
    if (container) container.innerHTML = '';
    state.loading = null;
    state.error = null;
    state.showEmailForm = false;
    state.emailValue = '';
    state.passwordValue = '';
  }

  // ─── Namespace Export ──────────────────────────────────

  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.SocialLoginUI = {
    init: init,
    destroy: destroy,
    render: render
  };
})();
