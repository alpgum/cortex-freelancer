/**
 * CF-112: Fix dark mode color inconsistencies across tools
 * Audits and patches missing CSS variables and hardcoded colors.
 */
(function () {
  'use strict';
  window.CortexFreelancer = window.CortexFreelancer || {};

  function init() {
    var style = document.createElement('style');
    style.textContent =
      '@media (prefers-color-scheme: dark) {' +
        ':root {' +
          '--bg-primary: #1a1a2e;' +
          '--bg-secondary: #16213e;' +
          '--bg-card: #1e2a45;' +
          '--text-primary: #e0e0e0;' +
          '--text-secondary: #a0a0b0;' +
          '--border-color: #2a3a55;' +
          '--input-bg: #1e2a45;' +
          '--input-border: #3a4a65;' +
          '--accent: #4fc3f7;' +
          '--accent-hover: #29b6f6;' +
          '--success: #66bb6a;' +
          '--warning: #ffa726;' +
          '--error: #ef5350;' +
        '}' +
        'body { background: var(--bg-primary) !important; color: var(--text-primary) !important; }' +
        '.card, .tool-card, .panel, .modal, .dialog, [class*="card"] {' +
          'background: var(--bg-card) !important;' +
          'border-color: var(--border-color) !important;' +
          'color: var(--text-primary) !important;' +
        '}' +
        'input, textarea, select {' +
          'background: var(--input-bg) !important;' +
          'border-color: var(--input-border) !important;' +
          'color: var(--text-primary) !important;' +
        '}' +
        'h1, h2, h3, h4, h5, h6 { color: var(--text-primary) !important; }' +
        'p, span, label, li { color: var(--text-secondary) !important; }' +
        'a { color: var(--accent) !important; }' +
        'a:hover { color: var(--accent-hover) !important; }' +
        '.badge, .tag, .chip {' +
          'background: var(--bg-secondary) !important;' +
          'color: var(--text-primary) !important;' +
          'border-color: var(--border-color) !important;' +
        '}' +
        'hr { border-color: var(--border-color) !important; }' +
        'table, th, td { border-color: var(--border-color) !important; }' +
        'th { background: var(--bg-secondary) !important; }' +
        'td { background: var(--bg-card) !important; }' +
        '::placeholder { color: var(--text-secondary) !important; opacity: 0.7 !important; }' +
      '}' +
      '[data-theme="dark"] {' +
        'background: var(--bg-primary, #1a1a2e) !important;' +
        'color: var(--text-primary, #e0e0e0) !important;' +
      '}';
    document.head.appendChild(style);
  }

  window.CortexFreelancer.DarkModeFix = { init: init };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
