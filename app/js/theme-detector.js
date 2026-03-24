/**
 * CF-285: System Theme Detection
 * Detect prefers-color-scheme, manual override, localStorage sync,
 * smooth transition on toggle. Fire cf:theme:changed events.
 *
 * @namespace window.CortexFreelancer.ThemeDetector
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  var STORAGE_KEY = 'ct-theme';
  var listeners = [];

  function getSystemPreference() {
    if (!window.matchMedia) return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function getStoredPreference() {
    try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
  }

  function getActiveTheme() {
    return document.documentElement.getAttribute('data-theme') || getStoredPreference() || getSystemPreference();
  }

  function isManualOverride() {
    return getStoredPreference() !== null;
  }

  function clearOverride() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* noop */ }
    var systemTheme = getSystemPreference();
    applyTheme(systemTheme, false);
  }

  function applyTheme(theme, store) {
    var prev = getActiveTheme();
    document.documentElement.classList.add('ct-theme-transition');
    document.documentElement.setAttribute('data-theme', theme);

    setTimeout(function () {
      document.documentElement.classList.remove('ct-theme-transition');
    }, 250);

    if (store !== false) {
      try { localStorage.setItem(STORAGE_KEY, theme); } catch (e) { /* noop */ }
    }

    if (prev !== theme) {
      var event = new CustomEvent('cf:theme:changed', {
        detail: { theme: theme, previous: prev, source: store === false ? 'system' : 'manual' }
      });
      document.dispatchEvent(event);
      listeners.forEach(function (fn) { fn({ theme: theme, previous: prev }); });
    }
  }

  function toggle() {
    applyTheme(getActiveTheme() === 'dark' ? 'light' : 'dark');
  }

  function onChange(fn) {
    if (typeof fn === 'function') listeners.push(fn);
    return function unsubscribe() {
      listeners = listeners.filter(function (l) { return l !== fn; });
    };
  }

  // Cross-tab sync
  try {
    window.addEventListener('storage', function (e) {
      if (e.key === STORAGE_KEY && e.newValue) {
        document.documentElement.setAttribute('data-theme', e.newValue);
        document.dispatchEvent(new CustomEvent('cf:theme:changed', {
          detail: { theme: e.newValue, source: 'tab-sync' }
        }));
      }
    });
  } catch (e) { /* noop */ }

  // System preference change
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
      if (!getStoredPreference()) {
        applyTheme(e.matches ? 'dark' : 'light', false);
      }
    });
  }

  window.CortexFreelancer.ThemeDetector = {
    getSystemPreference: getSystemPreference,
    getStoredPreference: getStoredPreference,
    getActiveTheme: getActiveTheme,
    isManualOverride: isManualOverride,
    clearOverride: clearOverride,
    applyTheme: applyTheme,
    toggle: toggle,
    onChange: onChange
  };
})();
