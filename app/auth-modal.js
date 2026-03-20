// Cortex Freelancer — Auth Modal Component
// Include on every page: <link rel="stylesheet" href="/app/auth-modal.css">
//                        <script src="/app/auth-modal.js"></script>

(function () {
  'use strict';

  // ── Inject modal HTML ──
  function createModal() {
    if (document.getElementById('auth-modal-backdrop')) return;

    var el = document.createElement('div');
    el.id = 'auth-modal-backdrop';
    el.className = 'auth-modal-backdrop';
    el.innerHTML =
      '<div class="auth-modal">' +
        '<button class="auth-modal-close" aria-label="Close">&times;</button>' +
        '<div class="auth-modal-brand">C</div>' +
        '<h2>Welcome to Cortex</h2>' +
        '<p>Sign in to unlock your AI business manager — proposals, invoicing, scheduling &amp; more.</p>' +
        '<button class="auth-modal-google" id="auth-modal-google-btn">' +
          '<svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/></svg>' +
          'Continue with Google' +
        '</button>' +
        '<div class="auth-modal-divider">or</div>' +
        '<button class="auth-modal-skip" id="auth-modal-skip-btn">Continue as Guest</button>' +
        '<div class="auth-modal-footer">By continuing you agree to our <a href="/terms.html">Terms</a> &amp; <a href="/privacy.html">Privacy Policy</a>.</div>' +
      '</div>';

    document.body.appendChild(el);

    // ── Events ──
    // Close on backdrop click
    el.addEventListener('click', function (e) {
      if (e.target === el) closeAuthModal();
    });

    // Close on X
    el.querySelector('.auth-modal-close').addEventListener('click', closeAuthModal);

    // Google sign-in
    el.querySelector('#auth-modal-google-btn').addEventListener('click', function () {
      if (typeof window.cortexSignIn === 'function') {
        window.cortexSignIn().then(function (user) {
          if (user) closeAuthModal();
        });
      }
    });

    // Guest / skip
    el.querySelector('#auth-modal-skip-btn').addEventListener('click', closeAuthModal);

    // Close on Escape
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeAuthModal();
    });
  }

  // ── Open ──
  window.openAuthModal = function () {
    createModal();
    // Force reflow before adding class for transition
    var bd = document.getElementById('auth-modal-backdrop');
    void bd.offsetWidth;
    bd.classList.add('open');
    document.body.style.overflow = 'hidden';
  };

  // ── Close ──
  window.closeAuthModal = function () {
    var bd = document.getElementById('auth-modal-backdrop');
    if (!bd) return;
    bd.classList.remove('open');
    document.body.style.overflow = '';
  };

  // ── Patch existing Sign In buttons ──
  // The auth.js renders a "Sign In" button inside #cortex-auth.
  // We intercept clicks so the modal opens instead of the raw popup.
  function patchSignInButton() {
    var authArea = document.getElementById('cortex-auth');
    if (!authArea) return;

    authArea.addEventListener('click', function (e) {
      var btn = e.target.closest('.cortex-login-btn');
      if (btn) {
        e.preventDefault();
        e.stopPropagation();
        openAuthModal();
      }
    });
  }

  // ── Init ──
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', patchSignInButton);
  } else {
    patchSignInButton();
  }
})();
