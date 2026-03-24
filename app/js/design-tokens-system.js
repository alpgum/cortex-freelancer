/**
 * CF-281: Design Tokens System
 * Defines CSS custom properties for brand colors, typography, spacing, and border radius.
 * Injects tokens as :root custom properties for consistent theming across the app.
 *
 * @namespace window.CortexFreelancer.DesignTokensSystem
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  var STYLE_ID = 'cortex-design-tokens-system-styles';

  /**
   * @typedef {Object} DesignTokens
   * @property {Object} colors - Brand and semantic color palette
   * @property {Object} fontSizes - Typography scale
   * @property {Object} spacing - Spacing units
   * @property {Object} borderRadius - Border radius values
   */
  var tokens = {
    colors: {
      'brand-primary': '#6366f1',
      'brand-primary-hover': '#4f46e5',
      'brand-primary-light': '#e0e7ff',
      'brand-secondary': '#22c55e',
      'brand-secondary-hover': '#16a34a',
      'brand-accent': '#f97316',
      'brand-neutral-dark': '#1f2937',
      'brand-neutral-light': '#f9fafb'
    },
    fontSizes: {
      'font-size-sm': '0.875rem',
      'font-size-base': '1rem',
      'font-size-lg': '1.25rem',
      'font-size-xl': '1.5rem'
    },
    spacing: {
      'spacing-xs': '0.25rem',
      'spacing-sm': '0.5rem',
      'spacing-md': '1rem',
      'spacing-lg': '2rem'
    },
    borderRadius: {
      'radius-sm': '0.25rem',
      'radius-md': '0.5rem',
      'radius-lg': '0.75rem'
    }
  };

  /**
   * Flattens token groups into a single map of CSS custom property name to value.
   * @returns {Object.<string, string>} Map of --ct-{name} to value
   */
  function flattenTokens() {
    var flat = {};
    var groups = Object.keys(tokens);
    for (var g = 0; g < groups.length; g++) {
      var group = tokens[groups[g]];
      var keys = Object.keys(group);
      for (var k = 0; k < keys.length; k++) {
        flat['--ct-' + keys[k]] = group[keys[k]];
      }
    }
    return flat;
  }

  /**
   * Injects design tokens as CSS custom properties on :root.
   * @returns {void}
   */
  function inject() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    var flat = flattenTokens();
    var declarations = [];
    var names = Object.keys(flat);
    for (var i = 0; i < names.length; i++) {
      declarations.push('  ' + names[i] + ': ' + flat[names[i]] + ';');
    }

    var css = ':root {\n' + declarations.join('\n') + '\n}';
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  /**
   * Removes injected token styles.
   * @returns {void}
   */
  function destroy() {
    var el = document.getElementById(STYLE_ID);
    if (el) {
      el.parentNode.removeChild(el);
    }
  }

  /**
   * Returns the raw token definitions.
   * @returns {DesignTokens}
   */
  function getTokens() {
    return JSON.parse(JSON.stringify(tokens));
  }

  /**
   * Returns the resolved value of a specific token.
   * @param {string} name - Token name without --ct- prefix (e.g. 'brand-primary')
   * @returns {string|null} The token value or null if not found
   */
  function getToken(name) {
    var flat = flattenTokens();
    return flat['--ct-' + name] || null;
  }

  inject();

  window.CortexFreelancer.DesignTokensSystem = {
    inject: inject,
    destroy: destroy,
    getTokens: getTokens,
    getToken: getToken
  };
})();
