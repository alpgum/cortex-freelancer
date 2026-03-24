/**
 * CF-107: Fix mobile hamburger menu not closing on navigation
 * Adds click handler to close mobile nav when a link is tapped.
 */
(function () {
  'use strict';
  window.CortexFreelancer = window.CortexFreelancer || {};

  function init() {
    var nav = document.querySelector('.mobile-nav, .nav-menu, #mobile-menu');
    var toggle = document.querySelector('.hamburger, .nav-toggle, #menu-toggle');
    if (!nav) return;

    // Close menu when any nav link is clicked
    nav.addEventListener('click', function (e) {
      var link = e.target.closest('a');
      if (!link) return;

      nav.classList.remove('open', 'active', 'show', 'is-open');
      if (toggle) {
        toggle.classList.remove('open', 'active', 'is-open');
        toggle.setAttribute('aria-expanded', 'false');
      }
      document.body.classList.remove('menu-open', 'nav-open');
    });

    // Close menu when clicking outside
    document.addEventListener('click', function (e) {
      if (!nav.classList.contains('open') && !nav.classList.contains('active') &&
          !nav.classList.contains('show') && !nav.classList.contains('is-open')) return;
      if (nav.contains(e.target) || (toggle && toggle.contains(e.target))) return;

      nav.classList.remove('open', 'active', 'show', 'is-open');
      if (toggle) {
        toggle.classList.remove('open', 'active', 'is-open');
        toggle.setAttribute('aria-expanded', 'false');
      }
      document.body.classList.remove('menu-open', 'nav-open');
    });
  }

  window.CortexFreelancer.MobileNavFix = { init: init };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
