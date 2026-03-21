// ===== THEME TOGGLE — Cortex Freelancer =====
// Dark/light mode toggle with localStorage persistence.
// Respects prefers-color-scheme on first visit.
// Injects sun/moon toggle into nav.

(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_theme';

  // ── Determine initial theme ──
  function getInitialTheme() {
    var stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
    // Respect OS preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      return 'light';
    }
    return 'dark';
  }

  // ── Apply theme immediately (before paint) ──
  var currentTheme = getInitialTheme();
  if (currentTheme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }

  // ── Build and inject toggle button ──
  function injectToggle() {
    // SVG icons
    var sunSVG = '<svg class="icon-sun" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="5"/><g stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></g></svg>';
    var moonSVG = '<svg class="icon-moon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';

    var btn = document.createElement('button');
    btn.className = 'theme-toggle';
    btn.setAttribute('aria-label', 'Toggle dark/light mode');
    btn.setAttribute('title', 'Toggle dark/light mode');
    btn.innerHTML = sunSVG + moonSVG;

    btn.addEventListener('click', function () {
      var isLight = document.documentElement.getAttribute('data-theme') === 'light';
      var newTheme = isLight ? 'dark' : 'light';

      // Add transition class
      document.documentElement.classList.add('theme-transitioning');

      if (newTheme === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
      } else {
        document.documentElement.removeAttribute('data-theme');
      }

      localStorage.setItem(STORAGE_KEY, newTheme);
      currentTheme = newTheme;

      // Remove transition class after animation
      setTimeout(function () {
        document.documentElement.classList.remove('theme-transitioning');
      }, 350);
    });

    // Try to inject into shared nav (nav.js)
    var sharedNav = document.querySelector('.site-nav .nav-links');
    if (sharedNav) {
      var authDiv = sharedNav.querySelector('.nav-auth');
      if (authDiv) {
        sharedNav.insertBefore(btn, authDiv);
      } else {
        sharedNav.appendChild(btn);
      }
      return;
    }

    // Try to inject into dashboard nav
    var dashNav = document.querySelector('.dash-nav .nav-links');
    if (dashNav) {
      var authDiv2 = dashNav.querySelector('#cortex-auth');
      if (authDiv2) {
        dashNav.insertBefore(btn, authDiv2);
      } else {
        dashNav.appendChild(btn);
      }
      return;
    }

    // Try to inject into tool page nav
    var toolNav = document.querySelector('nav .nav-links');
    if (toolNav) {
      var cta = toolNav.querySelector('.nav-cta');
      if (cta) {
        toolNav.insertBefore(btn, cta);
      } else {
        toolNav.appendChild(btn);
      }
      return;
    }
  }

  // ── Listen for OS theme changes ──
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: light)');
    try {
      mq.addEventListener('change', function (e) {
        // Only follow OS if user hasn't explicitly set a preference
        if (!localStorage.getItem(STORAGE_KEY)) {
          if (e.matches) {
            document.documentElement.setAttribute('data-theme', 'light');
          } else {
            document.documentElement.removeAttribute('data-theme');
          }
        }
      });
    } catch (_) {
      // Safari < 14 fallback
      mq.addListener(function (e) {
        if (!localStorage.getItem(STORAGE_KEY)) {
          if (e.matches) {
            document.documentElement.setAttribute('data-theme', 'light');
          } else {
            document.documentElement.removeAttribute('data-theme');
          }
        }
      });
    }
  }

  // ── Inject when DOM is ready ──
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      // Delay slightly to ensure nav.js has built the nav
      setTimeout(injectToggle, 100);
    });
  } else {
    setTimeout(injectToggle, 100);
  }
})();
