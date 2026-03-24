/**
 * CF-088 — Fix login page showing briefly before guest redirect
 * Adds loading state to prevent flash of login page when guest mode auto-redirects
 */
(function () {
  const ns = (window.CortexFreelancer = window.CortexFreelancer || {});

  const GUEST_FLAG = 'cortex_guest_mode';
  const AUTH_STATE_KEY = 'cortex_auth_state';
  const REDIRECT_TARGET = '/app/dashboard.html';
  const MAX_WAIT_MS = 3000;

  function isLoginPage() {
    var path = window.location.pathname;
    return path.includes('/login') || path.includes('/signup');
  }

  function shouldRedirect() {
    return (
      localStorage.getItem(GUEST_FLAG) === 'true' ||
      localStorage.getItem(AUTH_STATE_KEY) === 'authenticated'
    );
  }

  function showLoadingOverlay() {
    var overlay = document.createElement('div');
    overlay.id = 'login-loading-overlay';
    overlay.style.cssText =
      'position:fixed;top:0;left:0;width:100%;height:100%;background:#0f172a;' +
      'display:flex;align-items:center;justify-content:center;z-index:99999;';
    overlay.innerHTML =
      '<div style="text-align:center;color:#94a3b8;">' +
      '<div style="width:40px;height:40px;border:3px solid #334155;border-top-color:#6366f1;' +
      'border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 12px;"></div>' +
      '<p>Loading…</p></div>' +
      '<style>@keyframes spin{to{transform:rotate(360deg)}}</style>';
    document.body.insertBefore(overlay, document.body.firstChild);
    return overlay;
  }

  function removeOverlay(overlay) {
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
  }

  function init() {
    if (!isLoginPage()) return;

    if (shouldRedirect()) {
      var overlay = showLoadingOverlay();
      // Redirect immediately for guests
      if (localStorage.getItem(GUEST_FLAG) === 'true') {
        window.location.replace(REDIRECT_TARGET);
        return;
      }
      // For authenticated users, wait briefly for Firebase to confirm
      var timeout = setTimeout(function () {
        removeOverlay(overlay);
      }, MAX_WAIT_MS);

      if (typeof firebase !== 'undefined' && firebase.auth) {
        firebase.auth().onAuthStateChanged(function (user) {
          clearTimeout(timeout);
          if (user) {
            window.location.replace(REDIRECT_TARGET);
          } else {
            removeOverlay(overlay);
          }
        });
      }
    }
  }

  ns.LoginFlashFix = {
    init: init,
    isLoginPage: isLoginPage,
    shouldRedirect: shouldRedirect
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
