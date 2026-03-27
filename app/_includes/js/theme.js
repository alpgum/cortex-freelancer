// ===== THEME TOGGLE — Cortex Freelancer =====
// System-aware dark/light toggle with localStorage persistence.
// Default: dark. Respects prefers-color-scheme on first visit.
// Injects sun/moon toggle into whichever nav variant is present.

(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_theme';

  // ── Determine initial theme ──
  function getInitialTheme() {
    var stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      return 'light';
    }
    return 'dark'; // default
  }

  // ── Apply theme immediately (before paint) ──
  var currentTheme = getInitialTheme();
  if (currentTheme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }

  // ── SVG icons ──
  var sunSVG = '<svg class="icon-sun" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">' +
    '<circle cx="12" cy="12" r="5"/>' +
    '<g stroke="currentColor" stroke-width="2" stroke-linecap="round">' +
    '<line x1="12" y1="1" x2="12" y2="3"/>' +
    '<line x1="12" y1="21" x2="12" y2="23"/>' +
    '<line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>' +
    '<line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>' +
    '<line x1="1" y1="12" x2="3" y2="12"/>' +
    '<line x1="21" y1="12" x2="23" y2="12"/>' +
    '<line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>' +
    '<line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>' +
    '</g></svg>';

  var moonSVG = '<svg class="icon-moon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';

  // ── Toggle handler ──
  function toggleTheme() {
    var isLight = document.documentElement.getAttribute('data-theme') === 'light';
    var newTheme = isLight ? 'dark' : 'light';

    document.documentElement.classList.add('theme-transitioning');

    if (newTheme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }

    localStorage.setItem(STORAGE_KEY, newTheme);
    currentTheme = newTheme;

    // Dispatch event for other components
    try {
      window.dispatchEvent(new CustomEvent('cf:theme:changed', { detail: { theme: newTheme } }));
    } catch (_) { /* IE fallback — ignore */ }

    setTimeout(function () {
      document.documentElement.classList.remove('theme-transitioning');
    }, 350);
  }

  // ── Build toggle button ──
  function createToggleButton() {
    var btn = document.createElement('button');
    btn.className = 'theme-toggle';
    btn.setAttribute('aria-label', 'Toggle dark/light mode');
    btn.setAttribute('title', 'Toggle theme');
    btn.innerHTML = sunSVG + moonSVG;
    btn.addEventListener('click', toggleTheme);
    return btn;
  }

  // ── Inject into nav ──
  function injectToggle() {
    // Already injected?
    if (document.querySelector('.theme-toggle')) return;

    var btn = createToggleButton();

    // Nav selectors in priority order (newest → oldest)
    var targets = [
      // Universal nav (cx-nav)
      { nav: '.cx-nav .cx-nav-actions', before: '#cortex-auth' },
      { nav: '.cx-nav .cx-nav-actions', before: null },
      // Global nav (gnav)
      { nav: '.gnav .gnav-actions', before: '.gnav-avatar' },
      { nav: '.gnav .gnav-actions', before: null },
      // Site nav
      { nav: '.site-nav .nav-links', before: '.nav-auth' },
      { nav: '.site-nav .nav-links', before: null },
      // Dashboard nav
      { nav: '.dash-nav .nav-links', before: '#cortex-auth' },
      { nav: '.dash-nav .nav-links', before: null },
      // Generic tool page nav
      { nav: 'nav .nav-links', before: '.nav-cta' },
      { nav: 'nav .nav-links', before: null },
      // Fallback: any nav with children
      { nav: 'nav', before: null }
    ];

    for (var i = 0; i < targets.length; i++) {
      var container = document.querySelector(targets[i].nav);
      if (!container) continue;

      if (targets[i].before) {
        var ref = container.querySelector(targets[i].before);
        if (ref) {
          container.insertBefore(btn, ref);
          return;
        }
      } else {
        container.appendChild(btn);
        return;
      }
    }
  }

  // ── Listen for OS theme changes ──
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: light)');
    function onSystemChange(e) {
      // Only follow OS if user hasn't explicitly set a preference
      if (!localStorage.getItem(STORAGE_KEY)) {
        document.documentElement.classList.add('theme-transitioning');
        if (e.matches) {
          document.documentElement.setAttribute('data-theme', 'light');
        } else {
          document.documentElement.removeAttribute('data-theme');
        }
        setTimeout(function () {
          document.documentElement.classList.remove('theme-transitioning');
        }, 350);
      }
    }
    try {
      mq.addEventListener('change', onSystemChange);
    } catch (_) {
      mq.addListener(onSystemChange); // Safari < 14
    }
  }

  // ── Inject when DOM is ready ──
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(injectToggle, 100); // Wait for nav.js to build nav
    });
  } else {
    setTimeout(injectToggle, 100);
  }

  // ── Re-inject if nav rebuilds (SPA navigation) ──
  if (window.MutationObserver) {
    var observer = new MutationObserver(function () {
      if (!document.querySelector('.theme-toggle')) {
        injectToggle();
      }
    });
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    } else {
      document.addEventListener('DOMContentLoaded', function () {
        observer.observe(document.body, { childList: true, subtree: true });
      });
    }
  }
})();
