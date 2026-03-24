/**
 * [CF-202] Email/Password Registration Flow
 * Registration form with email validation, password strength meter,
 * confirm password match, and inline validation feedback.
 * Exposed on window.CortexFreelancer.RegistrationForm
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  var FORM_ID = 'cf-registration-form';

  // ── Validation Rules ──────────────────────────────────────────────────

  var EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  var PASSWORD_RULES = [
    { id: 'length', label: 'At least 8 characters', test: function (p) { return p.length >= 8; } },
    { id: 'uppercase', label: 'One uppercase letter', test: function (p) { return /[A-Z]/.test(p); } },
    { id: 'lowercase', label: 'One lowercase letter', test: function (p) { return /[a-z]/.test(p); } },
    { id: 'number', label: 'One number', test: function (p) { return /\d/.test(p); } }
  ];

  function validateEmail(email) {
    if (!email) return { valid: false, message: 'Email is required' };
    if (!EMAIL_REGEX.test(email)) return { valid: false, message: 'Enter a valid email address' };
    return { valid: true, message: '' };
  }

  function validatePassword(password) {
    var results = PASSWORD_RULES.map(function (rule) {
      return { id: rule.id, label: rule.label, passed: rule.test(password || '') };
    });
    var allPassed = results.every(function (r) { return r.passed; });
    return { valid: allPassed, rules: results };
  }

  function getPasswordStrength(password) {
    if (!password) return { score: 0, label: '', color: '#e5e7eb' };
    var v = validatePassword(password);
    var passed = v.rules.filter(function (r) { return r.passed; }).length;
    var levels = [
      { min: 0, label: 'Weak', color: '#ef4444' },
      { min: 1, label: 'Weak', color: '#ef4444' },
      { min: 2, label: 'Fair', color: '#f59e0b' },
      { min: 3, label: 'Good', color: '#22c55e' },
      { min: 4, label: 'Strong', color: '#059669' }
    ];
    return { score: passed, total: 4, label: levels[passed].label, color: levels[passed].color };
  }

  function validateConfirmPassword(password, confirm) {
    if (!confirm) return { valid: false, message: 'Please confirm your password' };
    if (password !== confirm) return { valid: false, message: 'Passwords do not match' };
    return { valid: true, message: '' };
  }

  function validateName(name) {
    if (!name || !name.trim()) return { valid: false, message: 'Name is required' };
    if (name.trim().length < 2) return { valid: false, message: 'Name must be at least 2 characters' };
    return { valid: true, message: '' };
  }

  // ── Styles ────────────────────────────────────────────────────────────

  var STYLES = {
    form: 'max-width:400px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,sans-serif;',
    heading: 'font-size:24px;font-weight:700;color:#111;margin:0 0 4px;text-align:center;',
    subheading: 'font-size:14px;color:#6b7280;margin:0 0 24px;text-align:center;',
    fieldGroup: 'margin-bottom:16px;',
    label: 'display:block;font-size:13px;font-weight:500;color:#374151;margin-bottom:4px;',
    input: 'width:100%;padding:10px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;outline:none;transition:border-color 0.2s;box-sizing:border-box;',
    inputError: 'border-color:#ef4444;',
    inputValid: 'border-color:#22c55e;',
    errorMsg: 'font-size:12px;color:#ef4444;margin-top:4px;min-height:16px;',
    successMsg: 'font-size:12px;color:#22c55e;margin-top:4px;',
    button: 'width:100%;padding:12px;border:none;border-radius:8px;background:#6366f1;color:#fff;font-size:15px;font-weight:600;cursor:pointer;transition:background 0.2s;',
    buttonDisabled: 'opacity:0.5;cursor:not-allowed;',
    strengthBar: 'height:4px;border-radius:2px;transition:width 0.3s,background 0.3s;',
    strengthTrack: 'width:100%;height:4px;background:#e5e7eb;border-radius:2px;margin-top:6px;overflow:hidden;',
    ruleList: 'list-style:none;padding:0;margin:6px 0 0;',
    ruleItem: 'font-size:11px;padding:1px 0;display:flex;align-items:center;gap:4px;',
    link: 'color:#6366f1;text-decoration:none;font-size:13px;',
    divider: 'text-align:center;color:#9ca3af;font-size:13px;margin:16px 0;'
  };

  // ── Form Renderer ─────────────────────────────────────────────────────

  function renderForm(containerId, options) {
    var container = document.getElementById(containerId);
    if (!container) {
      console.error('[RegistrationForm] Container not found:', containerId);
      return;
    }

    options = options || {};
    var onSubmit = options.onSubmit || function () {};
    var onSignInClick = options.onSignInClick || null;

    // Build form HTML
    var html = '<div style="' + STYLES.form + '">';
    html += '<h2 style="' + STYLES.heading + '">Create your account</h2>';
    html += '<p style="' + STYLES.subheading + '">Start your free trial — no credit card required.</p>';
    html += '<form id="' + FORM_ID + '" novalidate>';

    // Name field
    html += '<div style="' + STYLES.fieldGroup + '">';
    html += '<label style="' + STYLES.label + '" for="cf-reg-name">Full Name</label>';
    html += '<input id="cf-reg-name" type="text" placeholder="Jane Doe" autocomplete="name" style="' + STYLES.input + '">';
    html += '<div id="cf-reg-name-error" style="' + STYLES.errorMsg + '"></div></div>';

    // Email field
    html += '<div style="' + STYLES.fieldGroup + '">';
    html += '<label style="' + STYLES.label + '" for="cf-reg-email">Email</label>';
    html += '<input id="cf-reg-email" type="email" placeholder="jane@example.com" autocomplete="email" style="' + STYLES.input + '">';
    html += '<div id="cf-reg-email-error" style="' + STYLES.errorMsg + '"></div></div>';

    // Password field
    html += '<div style="' + STYLES.fieldGroup + '">';
    html += '<label style="' + STYLES.label + '" for="cf-reg-password">Password</label>';
    html += '<input id="cf-reg-password" type="password" placeholder="8+ characters" autocomplete="new-password" style="' + STYLES.input + '">';
    html += '<div style="' + STYLES.strengthTrack + '"><div id="cf-reg-strength-bar" style="' + STYLES.strengthBar + 'width:0;background:#e5e7eb;"></div></div>';
    html += '<div id="cf-reg-strength-label" style="font-size:11px;color:#9ca3af;margin-top:2px;"></div>';
    html += '<ul id="cf-reg-password-rules" style="' + STYLES.ruleList + '"></ul></div>';

    // Confirm password
    html += '<div style="' + STYLES.fieldGroup + '">';
    html += '<label style="' + STYLES.label + '" for="cf-reg-confirm">Confirm Password</label>';
    html += '<input id="cf-reg-confirm" type="password" placeholder="Re-enter password" autocomplete="new-password" style="' + STYLES.input + '">';
    html += '<div id="cf-reg-confirm-error" style="' + STYLES.errorMsg + '"></div></div>';

    // Submit button
    html += '<button id="cf-reg-submit" type="submit" style="' + STYLES.button + '">Create Account</button>';

    // Server error area
    html += '<div id="cf-reg-server-error" style="' + STYLES.errorMsg + 'text-align:center;margin-top:12px;"></div>';

    // Sign in link
    html += '<div style="' + STYLES.divider + '">Already have an account? ';
    html += '<a id="cf-reg-signin-link" href="#" style="' + STYLES.link + '">Sign in</a></div>';

    html += '</form></div>';

    container.innerHTML = html;

    // ── Attach Events ────────────────────────────────────────────────

    var nameInput = document.getElementById('cf-reg-name');
    var emailInput = document.getElementById('cf-reg-email');
    var passInput = document.getElementById('cf-reg-password');
    var confirmInput = document.getElementById('cf-reg-confirm');
    var submitBtn = document.getElementById('cf-reg-submit');
    var form = document.getElementById(FORM_ID);

    // Inline validation on blur
    nameInput.addEventListener('blur', function () {
      var v = validateName(nameInput.value);
      showFieldState('cf-reg-name', 'cf-reg-name-error', v);
    });

    emailInput.addEventListener('blur', function () {
      var v = validateEmail(emailInput.value);
      showFieldState('cf-reg-email', 'cf-reg-email-error', v);
    });

    passInput.addEventListener('input', function () {
      updatePasswordStrength(passInput.value);
      // Re-validate confirm if filled
      if (confirmInput.value) {
        var v = validateConfirmPassword(passInput.value, confirmInput.value);
        showFieldState('cf-reg-confirm', 'cf-reg-confirm-error', v);
      }
    });

    passInput.addEventListener('blur', function () {
      updatePasswordStrength(passInput.value);
    });

    confirmInput.addEventListener('blur', function () {
      var v = validateConfirmPassword(passInput.value, confirmInput.value);
      showFieldState('cf-reg-confirm', 'cf-reg-confirm-error', v);
    });

    // Sign in link
    var signInLink = document.getElementById('cf-reg-signin-link');
    if (signInLink && onSignInClick) {
      signInLink.addEventListener('click', function (e) {
        e.preventDefault();
        onSignInClick();
      });
    }

    // Form submit
    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var nameVal = validateName(nameInput.value);
      var emailVal = validateEmail(emailInput.value);
      var passVal = validatePassword(passInput.value);
      var confirmVal = validateConfirmPassword(passInput.value, confirmInput.value);

      showFieldState('cf-reg-name', 'cf-reg-name-error', nameVal);
      showFieldState('cf-reg-email', 'cf-reg-email-error', emailVal);
      showFieldState('cf-reg-confirm', 'cf-reg-confirm-error', confirmVal);

      if (!passVal.valid) {
        passInput.style.borderColor = '#ef4444';
      }

      if (!nameVal.valid || !emailVal.valid || !passVal.valid || !confirmVal.valid) {
        return;
      }

      // Disable button
      submitBtn.disabled = true;
      submitBtn.textContent = 'Creating account…';
      submitBtn.style.opacity = '0.5';
      var serverError = document.getElementById('cf-reg-server-error');
      serverError.textContent = '';

      var result = onSubmit({
        name: nameInput.value.trim(),
        email: emailInput.value.trim(),
        password: passInput.value
      });

      // Handle promise if returned
      if (result && typeof result.then === 'function') {
        result.then(function () {
          submitBtn.textContent = 'Account created!';
        }).catch(function (err) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Create Account';
          submitBtn.style.opacity = '1';
          serverError.textContent = err.message || 'Registration failed. Please try again.';
        });
      }
    });
  }

  // ── UI Helpers ────────────────────────────────────────────────────────

  function showFieldState(inputId, errorId, validation) {
    var input = document.getElementById(inputId);
    var errorEl = document.getElementById(errorId);
    if (!input || !errorEl) return;

    if (validation.valid) {
      input.style.borderColor = '#22c55e';
      errorEl.textContent = '';
    } else {
      input.style.borderColor = '#ef4444';
      errorEl.textContent = validation.message;
    }
  }

  function updatePasswordStrength(password) {
    var strength = getPasswordStrength(password);
    var bar = document.getElementById('cf-reg-strength-bar');
    var label = document.getElementById('cf-reg-strength-label');
    var rulesList = document.getElementById('cf-reg-password-rules');

    if (bar) {
      var widthPct = password ? (strength.score / strength.total * 100) : 0;
      bar.style.width = widthPct + '%';
      bar.style.background = strength.color;
    }

    if (label) {
      label.textContent = password ? strength.label : '';
      label.style.color = strength.color;
    }

    if (rulesList) {
      var v = validatePassword(password);
      var html = '';
      v.rules.forEach(function (rule) {
        var icon = rule.passed ? '✓' : '○';
        var color = rule.passed ? '#22c55e' : '#9ca3af';
        html += '<li style="' + STYLES.ruleItem + 'color:' + color + ';">';
        html += '<span>' + icon + '</span> ' + rule.label + '</li>';
      });
      rulesList.innerHTML = html;
    }
  }

  // ── Public API ────────────────────────────────────────────────────────

  window.CortexFreelancer.RegistrationForm = {
    renderForm: renderForm,
    validateEmail: validateEmail,
    validatePassword: validatePassword,
    validateConfirmPassword: validateConfirmPassword,
    validateName: validateName,
    getPasswordStrength: getPasswordStrength
  };
})();
