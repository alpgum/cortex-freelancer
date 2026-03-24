/**
 * CF-089 — Fix "Continue as Guest" button not setting localStorage flag
 * Ensures guest flag persists across sessions and all pages check it consistently
 */
(function () {
  const ns = (window.CortexFreelancer = window.CortexFreelancer || {});

  const GUEST_FLAG = 'cortex_guest_mode';
  const GUEST_EXPIRY_KEY = 'cortex_guest_expiry';
  const GUEST_TTL_DAYS = 30;
  const DASHBOARD_URL = '/app/dashboard.html';

  function setGuestMode() {
    try {
      localStorage.setItem(GUEST_FLAG, 'true');
      var expiry = Date.now() + GUEST_TTL_DAYS * 24 * 60 * 60 * 1000;
      localStorage.setItem(GUEST_EXPIRY_KEY, String(expiry));
    } catch (e) {
      console.error('[GuestMode] Storage error:', e);
    }
  }

  function clearGuestMode() {
    localStorage.removeItem(GUEST_FLAG);
    localStorage.removeItem(GUEST_EXPIRY_KEY);
  }

  function isGuestMode() {
    if (localStorage.getItem(GUEST_FLAG) !== 'true') return false;
    var expiry = parseInt(localStorage.getItem(GUEST_EXPIRY_KEY), 10);
    if (expiry && Date.now() > expiry) {
      clearGuestMode();
      return false;
    }
    return true;
  }

  function bindGuestButtons() {
    var selectors = [
      '#guest-btn',
      '#continue-guest',
      '.guest-mode-btn',
      '[data-action="guest-mode"]',
      'button[data-guest]',
      'a[data-guest]'
    ];

    selectors.forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (el) {
        if (el.dataset.guestBound) return;
        el.dataset.guestBound = 'true';
        el.addEventListener('click', function (e) {
          e.preventDefault();
          setGuestMode();
          window.location.href = DASHBOARD_URL;
        });
      });
    });
  }

  function init() {
    bindGuestButtons();
    // Re-bind after dynamic content loads
    var observer = new MutationObserver(function () { bindGuestButtons(); });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  ns.GuestModeFix = {
    init: init,
    setGuestMode: setGuestMode,
    clearGuestMode: clearGuestMode,
    isGuestMode: isGuestMode
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
