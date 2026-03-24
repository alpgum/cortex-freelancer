/**
 * [CF-201] Cortex Freelancer — Email/Password Auth (Firebase)
 * Registration/login UI components for email/password authentication.
 * Exposed on window.CortexFreelancer.EmailAuth
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_auth_user';

  function getFirebaseAuth() {
    if (typeof firebase !== 'undefined' && firebase.auth) return firebase.auth();
    return null;
  }

  function getCurrentUser() {
    var auth = getFirebaseAuth();
    if (auth && auth.currentUser) return auth.currentUser;
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function register(email, password) {
    var auth = getFirebaseAuth();
    if (!auth) return Promise.reject(new Error('Firebase Auth not initialized'));
    return auth.createUserWithEmailAndPassword(email, password).then(function (cred) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ uid: cred.user.uid, email: cred.user.email }));
      document.dispatchEvent(new CustomEvent('cortex:auth:register', { detail: { user: cred.user } }));
      return cred.user;
    });
  }

  function login(email, password) {
    var auth = getFirebaseAuth();
    if (!auth) return Promise.reject(new Error('Firebase Auth not initialized'));
    return auth.signInWithEmailAndPassword(email, password).then(function (cred) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ uid: cred.user.uid, email: cred.user.email }));
      document.dispatchEvent(new CustomEvent('cortex:auth:login', { detail: { user: cred.user } }));
      return cred.user;
    });
  }

  function logout() {
    var auth = getFirebaseAuth();
    localStorage.removeItem(STORAGE_KEY);
    document.dispatchEvent(new CustomEvent('cortex:auth:logout'));
    if (auth) return auth.signOut();
    return Promise.resolve();
  }

  function resetPassword(email) {
    var auth = getFirebaseAuth();
    if (!auth) return Promise.reject(new Error('Firebase Auth not initialized'));
    return auth.sendPasswordResetEmail(email);
  }

  function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function validatePassword(password) {
    var issues = [];
    if (password.length < 8) issues.push('At least 8 characters');
    if (!/[A-Z]/.test(password)) issues.push('One uppercase letter');
    if (!/[a-z]/.test(password)) issues.push('One lowercase letter');
    if (!/[0-9]/.test(password)) issues.push('One number');
    return { valid: issues.length === 0, issues: issues };
  }

  function renderAuthUI(containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;

    var mode = 'login'; // 'login', 'register', 'reset'

    function inputStyle() {
      return 'width:100%;padding:0.65rem 0.75rem;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);font-size:0.95rem;outline:none;';
    }

    function draw() {
      var title = mode === 'login' ? 'Sign In' : mode === 'register' ? 'Create Account' : 'Reset Password';
      var btnLabel = mode === 'login' ? 'Sign In' : mode === 'register' ? 'Create Account' : 'Send Reset Link';

      var passwordFields = mode !== 'reset' ?
        '<label style="color:var(--text-dim);font-size:0.85rem;display:block;">' +
          'Password' +
          '<input id="auth-password" type="password" placeholder="' + (mode === 'register' ? 'Min 8 chars, uppercase, lowercase, number' : 'Your password') + '" style="' + inputStyle() + 'margin-top:0.25rem;">' +
        '</label>' : '';

      var confirmField = mode === 'register' ?
        '<label style="color:var(--text-dim);font-size:0.85rem;display:block;">' +
          'Confirm Password' +
          '<input id="auth-confirm" type="password" placeholder="Confirm password" style="' + inputStyle() + 'margin-top:0.25rem;">' +
        '</label>' : '';

      var links = '';
      if (mode === 'login') {
        links = '<div style="display:flex;justify-content:space-between;font-size:0.85rem;">' +
          '<a href="#" id="auth-to-register" style="color:var(--green);text-decoration:none;">Create account</a>' +
          '<a href="#" id="auth-to-reset" style="color:var(--text-dim);text-decoration:none;">Forgot password?</a>' +
        '</div>';
      } else if (mode === 'register') {
        links = '<div style="font-size:0.85rem;">' +
          '<a href="#" id="auth-to-login" style="color:var(--green);text-decoration:none;">Already have an account? Sign in</a>' +
        '</div>';
      } else {
        links = '<div style="font-size:0.85rem;">' +
          '<a href="#" id="auth-to-login" style="color:var(--green);text-decoration:none;">Back to sign in</a>' +
        '</div>';
      }

      container.innerHTML =
        '<div style="max-width:400px;margin:0 auto;padding:2rem;">' +
          '<h2 style="color:var(--text-bright);text-align:center;margin-bottom:1.5rem;">' + title + '</h2>' +
          '<div style="display:flex;flex-direction:column;gap:1rem;">' +
            '<label style="color:var(--text-dim);font-size:0.85rem;display:block;">' +
              'Email' +
              '<input id="auth-email" type="email" placeholder="you@example.com" style="' + inputStyle() + 'margin-top:0.25rem;">' +
            '</label>' +
            passwordFields +
            confirmField +
            '<div id="auth-error" style="display:none;color:#ff5555;font-size:0.85rem;padding:0.5rem;background:#330000;border-radius:var(--radius-sm);"></div>' +
            '<div id="auth-success" style="display:none;color:var(--green);font-size:0.85rem;padding:0.5rem;background:#003300;border-radius:var(--radius-sm);"></div>' +
            '<button id="auth-submit" style="width:100%;padding:0.75rem;background:var(--green);color:var(--bg);border:none;border-radius:var(--radius-sm);font-weight:700;font-size:1rem;cursor:pointer;">' + btnLabel + '</button>' +
            links +
          '</div>' +
        '</div>';

      // Navigation
      var toReg = document.getElementById('auth-to-register');
      var toLogin = document.getElementById('auth-to-login');
      var toReset = document.getElementById('auth-to-reset');
      if (toReg) toReg.addEventListener('click', function (e) { e.preventDefault(); mode = 'register'; draw(); });
      if (toLogin) toLogin.addEventListener('click', function (e) { e.preventDefault(); mode = 'login'; draw(); });
      if (toReset) toReset.addEventListener('click', function (e) { e.preventDefault(); mode = 'reset'; draw(); });

      // Submit
      document.getElementById('auth-submit').addEventListener('click', handleSubmit);
      container.querySelectorAll('input').forEach(function (input) {
        input.addEventListener('keydown', function (e) { if (e.key === 'Enter') handleSubmit(); });
      });
    }

    function showError(msg) {
      var el = document.getElementById('auth-error');
      el.textContent = msg;
      el.style.display = 'block';
      var s = document.getElementById('auth-success');
      if (s) s.style.display = 'none';
    }

    function showSuccess(msg) {
      var el = document.getElementById('auth-success');
      el.textContent = msg;
      el.style.display = 'block';
      var e = document.getElementById('auth-error');
      if (e) e.style.display = 'none';
    }

    function handleSubmit() {
      var email = document.getElementById('auth-email').value.trim();
      var errorEl = document.getElementById('auth-error');
      errorEl.style.display = 'none';

      if (!validateEmail(email)) { showError('Please enter a valid email address.'); return; }

      if (mode === 'reset') {
        resetPassword(email).then(function () {
          showSuccess('Password reset email sent! Check your inbox.');
        }).catch(function (err) { showError(err.message); });
        return;
      }

      var password = document.getElementById('auth-password').value;

      if (mode === 'register') {
        var validation = validatePassword(password);
        if (!validation.valid) { showError('Password requirements: ' + validation.issues.join(', ')); return; }
        var confirm = document.getElementById('auth-confirm').value;
        if (password !== confirm) { showError('Passwords do not match.'); return; }
        register(email, password).then(function () {
          showSuccess('Account created! Welcome to Cortex Freelancer.');
        }).catch(function (err) { showError(err.message); });
      } else {
        login(email, password).then(function () {
          showSuccess('Signed in successfully!');
        }).catch(function (err) { showError(err.message); });
      }
    }

    draw();
  }

  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.EmailAuth = {
    init: function () { console.log('[CF-201] EmailAuth ready'); },
    register: register,
    login: login,
    logout: logout,
    resetPassword: resetPassword,
    getCurrentUser: getCurrentUser,
    renderAuthUI: renderAuthUI
  };
})();
