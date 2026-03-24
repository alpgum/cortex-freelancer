/**
 * CF-285: Theme System
 * Detects system color scheme via prefers-color-scheme media query,
 * applies matching theme, and allows manual override with localStorage persistence.
 *
 * @namespace window.CortexFreelancer.ThemeSystem
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  var STORAGE_KEY = 'ct-theme-preference';
  var ATTR = 'data-theme';
  var THEMES = { LIGHT: 'light', DARK: 'dark', SYSTEM: 'system' };
  var mediaQuery = null;
  var listeners = [];

  /**
   * Gets the system's preferred color scheme.
   * @returns {string} 'dark' or 'light'
   */
  function getSystemTheme() {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return THEMES.DARK;
    }
    return THEMES.LIGHT;
  }

  /**
   * Gets the user's stored preference.
   * @returns {string|null} 'light', 'dark', 'system', or null
   */
  function getStoredPreference() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return null;
    }
  }

  /**
   * Stores the user's theme preference.
   * @param {string} preference - 'light', 'dark', or 'system'
   * @returns {void}
   */
  function storePreference(preference) {
    try {
      localStorage.setItem(STORAGE_KEY, preference);
    } catch (e) {
      /* localStorage unavailable */
    }
  }

  /**
   * Resolves the effective theme from a preference value.
   * @param {string} preference - 'light', 'dark', or 'system'
   * @returns {string} 'light' or 'dark'
   */
  function resolveTheme(preference) {
    if (preference === THEMES.DARK || preference === THEMES.LIGHT) {
      return preference;
    }
    return getSystemTheme();
  }

  /**
   * Applies a theme to the document.
   * @param {string} theme - 'light' or 'dark'
   * @returns {void}
   */
  function applyTheme(theme) {
    document.documentElement.setAttribute(ATTR, theme);
    notifyListeners(theme);
  }

  /**
   * Notifies registered change listeners.
   * @param {string} theme - The active theme
   * @returns {void}
   */
  function notifyListeners(theme) {
    for (var i = 0; i < listeners.length; i++) {
      try {
        listeners[i](theme);
      } catch (e) {
        /* listener error */
      }
    }
  }

  /**
   * Handles system theme change events.
   * @param {MediaQueryListEvent} e - Media query change event
   * @returns {void}
   */
  function onSystemChange(e) {
    var stored = getStoredPreference();
    if (!stored || stored === THEMES.SYSTEM) {
      applyTheme(e.matches ? THEMES.DARK : THEMES.LIGHT);
    }
  }

  /**
   * Sets up the system theme detection listener.
   * @returns {void}
   */
  function watchSystem() {
    if (!window.matchMedia) {
      return;
    }
    mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', onSystemChange);
    } else if (mediaQuery.addListener) {
      mediaQuery.addListener(onSystemChange);
    }
  }

  /**
   * Removes the system theme detection listener.
   * @returns {void}
   */
  function unwatchSystem() {
    if (!mediaQuery) {
      return;
    }
    if (mediaQuery.removeEventListener) {
      mediaQuery.removeEventListener('change', onSystemChange);
    } else if (mediaQuery.removeListener) {
      mediaQuery.removeListener(onSystemChange);
    }
    mediaQuery = null;
  }

  /**
   * Sets the theme. Pass 'system' to follow OS preference.
   * @param {string} preference - 'light', 'dark', or 'system'
   * @returns {void}
   */
  function setTheme(preference) {
    if (preference !== THEMES.LIGHT && preference !== THEMES.DARK && preference !== THEMES.SYSTEM) {
      preference = THEMES.SYSTEM;
    }
    storePreference(preference);
    applyTheme(resolveTheme(preference));
  }

  /**
   * Toggles between light and dark. If currently following system, switches to
   * the opposite of whatever the system theme is.
   * @returns {string} The new active theme
   */
  function toggle() {
    var current = document.documentElement.getAttribute(ATTR) || THEMES.LIGHT;
    var next = current === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK;
    setTheme(next);
    return next;
  }

  /**
   * Returns the current active theme.
   * @returns {string} 'light' or 'dark'
   */
  function getTheme() {
    return document.documentElement.getAttribute(ATTR) || THEMES.LIGHT;
  }

  /**
   * Returns the current preference (may be 'system').
   * @returns {string} 'light', 'dark', or 'system'
   */
  function getPreference() {
    return getStoredPreference() || THEMES.SYSTEM;
  }

  /**
   * Registers a callback for theme changes.
   * @param {Function} fn - Callback receiving the active theme string
   * @returns {Function} Unsubscribe function
   */
  function onChange(fn) {
    if (typeof fn === 'function') {
      listeners.push(fn);
    }
    return function () {
      var idx = listeners.indexOf(fn);
      if (idx > -1) {
        listeners.splice(idx, 1);
      }
    };
  }

  /**
   * Initializes the theme system.
   * @returns {void}
   */
  function init() {
    var stored = getStoredPreference();
    var preference = stored || THEMES.SYSTEM;
    applyTheme(resolveTheme(preference));
    watchSystem();
  }

  /**
   * Tears down the theme system.
   * @returns {void}
   */
  function destroy() {
    unwatchSystem();
    listeners = [];
  }

  init();

  window.CortexFreelancer.ThemeSystem = {
    setTheme: setTheme,
    toggle: toggle,
    getTheme: getTheme,
    getPreference: getPreference,
    getSystemTheme: getSystemTheme,
    onChange: onChange,
    init: init,
    destroy: destroy,
    THEMES: THEMES
  };
})();
