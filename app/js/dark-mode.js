/**
 * CF-284: Dark Mode
 * Complete dark theme with proper contrast ratios. Toggle mechanism,
 * system preference detection, localStorage persistence.
 *
 * @namespace window.CortexFreelancer.DarkMode
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  var STYLE_ID = 'cortex-dark-mode-styles';
  var STORAGE_KEY = 'ct-theme';
  var TRANSITION_MS = 200;

  var darkTokens = {
    '--ct-colors-neutral-0': '#111827',
    '--ct-colors-neutral-50': '#1f2937',
    '--ct-colors-neutral-100': '#374151',
    '--ct-colors-neutral-200': '#4b5563',
    '--ct-colors-neutral-300': '#6b7280',
    '--ct-colors-neutral-400': '#9ca3af',
    '--ct-colors-neutral-500': '#d1d5db',
    '--ct-colors-neutral-600': '#e5e7eb',
    '--ct-colors-neutral-700': '#f3f4f6',
    '--ct-colors-neutral-800': '#f9fafb',
    '--ct-colors-neutral-900': '#ffffff',
    '--ct-colors-neutral-950': '#ffffff',
    '--ct-colors-primary-50': '#1e1b4b',
    '--ct-colors-primary-100': '#312e81',
    '--ct-colors-primary-600': '#818cf8',
    '--ct-colors-primary-700': '#a5b4fc',
    '--ct-colors-semantic-success': '#4ade80',
    '--ct-colors-semantic-success-light': '#14532d',
    '--ct-colors-semantic-warning': '#fbbf24',
    '--ct-colors-semantic-warning-light': '#78350f',
    '--ct-colors-semantic-error': '#f87171',
    '--ct-colors-semantic-error-light': '#7f1d1d',
    '--ct-colors-semantic-info': '#60a5fa',
    '--ct-colors-semantic-info-light': '#1e3a5f',
    '--ct-shadows-xs': '0 1px 2px rgba(0,0,0,0.3)',
    '--ct-shadows-sm': '0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)',
    '--ct-shadows-md': '0 4px 6px -1px rgba(0,0,0,0.4), 0 2px 4px -1px rgba(0,0,0,0.3)',
    '--ct-shadows-lg': '0 10px 15px -3px rgba(0,0,0,0.4), 0 4px 6px -2px rgba(0,0,0,0.3)',
    '--ct-shadows-xl': '0 20px 25px -5px rgba(0,0,0,0.5), 0 10px 10px -5px rgba(0,0,0,0.3)'
  };

  function buildCSS() {
    var vars = Object.keys(darkTokens).map(function (k) {
      return '  ' + k + ': ' + darkTokens[k] + ';';
    });
    var css = '';
    css += '[data-theme="dark"] {\n' + vars.join('\n') + '\n}\n';
    css += '[data-theme="dark"] { color-scheme: dark; }\n';
    css += '.ct-theme-transition, .ct-theme-transition * { transition: background-color ' + TRANSITION_MS + 'ms ease, color ' + TRANSITION_MS + 'ms ease, border-color ' + TRANSITION_MS + 'ms ease !important; }\n';
    css += '.ct-theme-toggle{display:inline-flex;align-items:center;gap:0.5rem;padding:0.375rem 0.75rem;border:1px solid var(--ct-colors-neutral-300,#d1d5db);border-radius:var(--ct-radius-full,9999px);background:var(--ct-colors-neutral-0,#fff);cursor:pointer;font-size:0.8125rem;font-family:inherit;color:var(--ct-colors-neutral-700,#374151);transition:all 0.15s}\n';
    css += '.ct-theme-toggle:hover{background:var(--ct-colors-neutral-100,#f3f4f6)}\n';
    css += '.ct-theme-toggle__icon{font-size:1rem;line-height:1}\n';
    return css;
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = buildCSS();
    document.head.appendChild(style);
  }

  function getStoredTheme() {
    try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
  }

  function getSystemTheme() {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
    return 'light';
  }

  function getEffectiveTheme() {
    return getStoredTheme() || getSystemTheme();
  }

  function applyTheme(theme) {
    document.documentElement.classList.add('ct-theme-transition');
    document.documentElement.setAttribute('data-theme', theme);
    setTimeout(function () {
      document.documentElement.classList.remove('ct-theme-transition');
    }, TRANSITION_MS + 50);

    try { localStorage.setItem(STORAGE_KEY, theme); } catch (e) { /* noop */ }

    document.dispatchEvent(new CustomEvent('cf:theme:changed', { detail: { theme: theme } }));
  }

  function toggle() {
    var current = document.documentElement.getAttribute('data-theme') || getEffectiveTheme();
    applyTheme(current === 'dark' ? 'light' : 'dark');
  }

  function isDark() {
    return document.documentElement.getAttribute('data-theme') === 'dark';
  }

  function renderToggle() {
    return '<button class="ct-theme-toggle" onclick="CortexFreelancer.DarkMode.toggle()" aria-label="Toggle theme">' +
      '<span class="ct-theme-toggle__icon">' + (isDark() ? '\u2600\uFE0F' : '\uD83C\uDF19') + '</span>' +
      '<span>' + (isDark() ? 'Light' : 'Dark') + '</span></button>';
  }

  function renderThemePreview() {
    var html = '<div style="font-family:var(--ct-typography-font-family,sans-serif);padding:1.5rem">';
    html += '<h2 style="font-size:1.5rem;font-weight:700;margin-bottom:1rem">Dark Mode</h2>';
    html += '<div style="margin-bottom:1.5rem">' + renderToggle() + '</div>';

    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;max-width:600px">';

    // Light preview
    html += '<div style="background:#fff;color:#111827;border:1px solid #e5e7eb;border-radius:0.75rem;padding:1rem">';
    html += '<div style="font-weight:600;margin-bottom:0.5rem">Light Theme</div>';
    html += '<div style="font-size:0.875rem;color:#6b7280;margin-bottom:0.75rem">Default color scheme</div>';
    html += '<div style="display:flex;gap:0.25rem">';
    ['#4f46e5', '#22c55e', '#f97316', '#ef4444', '#3b82f6'].forEach(function (c) {
      html += '<div style="width:24px;height:24px;border-radius:50%;background:' + c + '"></div>';
    });
    html += '</div></div>';

    // Dark preview
    html += '<div style="background:#111827;color:#fff;border:1px solid #4b5563;border-radius:0.75rem;padding:1rem">';
    html += '<div style="font-weight:600;margin-bottom:0.5rem">Dark Theme</div>';
    html += '<div style="font-size:0.875rem;color:#d1d5db;margin-bottom:0.75rem">Reduced eye strain</div>';
    html += '<div style="display:flex;gap:0.25rem">';
    ['#818cf8', '#4ade80', '#fb923c', '#f87171', '#60a5fa'].forEach(function (c) {
      html += '<div style="width:24px;height:24px;border-radius:50%;background:' + c + '"></div>';
    });
    html += '</div></div>';

    html += '</div>';

    // Token list
    html += '<h3 style="font-size:1.125rem;font-weight:600;margin:1.5rem 0 0.75rem">Dark Token Overrides</h3>';
    html += '<div style="font-size:0.75rem;display:grid;grid-template-columns:1fr 1fr;gap:0.25rem 1rem;max-width:600px">';
    Object.keys(darkTokens).slice(0, 12).forEach(function (k) {
      html += '<div style="color:var(--ct-colors-neutral-500,#6b7280)">' + k + '</div>';
      html += '<div style="display:flex;align-items:center;gap:0.5rem"><span style="display:inline-block;width:12px;height:12px;border-radius:2px;background:' + darkTokens[k] + ';border:1px solid #d1d5db"></span>' + darkTokens[k] + '</div>';
    });
    html += '</div>';

    html += '</div>';
    return html;
  }

  // Initialize
  injectStyles();
  applyTheme(getEffectiveTheme());

  // Listen for system changes
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
      if (!getStoredTheme()) {
        applyTheme(e.matches ? 'dark' : 'light');
      }
    });
  }

  window.CortexFreelancer.DarkMode = {
    toggle: toggle,
    applyTheme: applyTheme,
    isDark: isDark,
    getEffectiveTheme: getEffectiveTheme,
    renderToggle: renderToggle,
    renderThemePreview: renderThemePreview
  };
})();
