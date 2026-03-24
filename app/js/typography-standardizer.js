/**
 * CF-283: Typography Standardizer
 * Applies consistent font family, sizes, and line heights across all pages.
 * Headings use Inter Bold; body text uses Inter Regular.
 * Loads Inter from Google Fonts if not already present.
 *
 * @namespace window.CortexFreelancer.TypographyStandardizer
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  var STYLE_ID = 'cortex-typography-standardizer-styles';
  var FONT_LINK_ID = 'cortex-inter-font-link';
  var FONT_URL = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap';

  /**
   * Typography scale definition.
   * @type {Object.<string, {size: string, lineHeight: string, weight: string, letterSpacing: string}>}
   */
  var scale = {
    h1: { size: '2.25rem', lineHeight: '1.2', weight: '700', letterSpacing: '-0.025em' },
    h2: { size: '1.875rem', lineHeight: '1.25', weight: '700', letterSpacing: '-0.02em' },
    h3: { size: '1.5rem', lineHeight: '1.3', weight: '700', letterSpacing: '-0.015em' },
    h4: { size: '1.25rem', lineHeight: '1.35', weight: '700', letterSpacing: '-0.01em' },
    h5: { size: '1.125rem', lineHeight: '1.4', weight: '600', letterSpacing: '0' },
    h6: { size: '1rem', lineHeight: '1.4', weight: '600', letterSpacing: '0' },
    body: { size: '1rem', lineHeight: '1.6', weight: '400', letterSpacing: '0' },
    small: { size: '0.875rem', lineHeight: '1.5', weight: '400', letterSpacing: '0' },
    caption: { size: '0.75rem', lineHeight: '1.4', weight: '400', letterSpacing: '0.02em' }
  };

  /**
   * Generates CSS rules from the typography scale.
   * @returns {string} CSS string
   */
  function buildCSS() {
    var rules = [];

    rules.push('body, input, textarea, select, button { font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: ' + scale.body.size + '; line-height: ' + scale.body.lineHeight + '; font-weight: ' + scale.body.weight + '; letter-spacing: ' + scale.body.letterSpacing + '; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }');

    var headings = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
    for (var i = 0; i < headings.length; i++) {
      var tag = headings[i];
      var s = scale[tag];
      rules.push(tag + ', .ct-' + tag + ' { font-family: "Inter", sans-serif; font-size: ' + s.size + '; line-height: ' + s.lineHeight + '; font-weight: ' + s.weight + '; letter-spacing: ' + s.letterSpacing + '; margin: 0 0 0.5em 0; }');
    }

    rules.push('small, .ct-small { font-size: ' + scale.small.size + '; line-height: ' + scale.small.lineHeight + '; }');
    rules.push('.ct-caption { font-size: ' + scale.caption.size + '; line-height: ' + scale.caption.lineHeight + '; letter-spacing: ' + scale.caption.letterSpacing + '; }');

    rules.push('p { margin: 0 0 1em 0; line-height: ' + scale.body.lineHeight + '; }');
    rules.push('a { color: var(--ct-brand-primary, #6366f1); text-decoration: none; }');
    rules.push('a:hover { text-decoration: underline; }');
    rules.push('strong, b { font-weight: 600; }');
    rules.push('code, pre { font-family: "JetBrains Mono", "Fira Code", monospace; font-size: 0.875em; }');

    return rules.join('\n');
  }

  /**
   * Loads the Inter font from Google Fonts if not already loaded.
   * @returns {void}
   */
  function loadFont() {
    if (document.getElementById(FONT_LINK_ID)) {
      return;
    }
    var link = document.createElement('link');
    link.id = FONT_LINK_ID;
    link.rel = 'stylesheet';
    link.href = FONT_URL;
    document.head.appendChild(link);
  }

  /**
   * Injects typography styles into the document.
   * @returns {void}
   */
  function inject() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }
    loadFont();
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = buildCSS();
    document.head.appendChild(style);
  }

  /**
   * Removes injected typography styles and font link.
   * @returns {void}
   */
  function destroy() {
    var el = document.getElementById(STYLE_ID);
    if (el) { el.parentNode.removeChild(el); }
    var font = document.getElementById(FONT_LINK_ID);
    if (font) { font.parentNode.removeChild(font); }
  }

  /**
   * Returns the typography scale definition.
   * @returns {Object} Scale object
   */
  function getScale() {
    return JSON.parse(JSON.stringify(scale));
  }

  inject();

  window.CortexFreelancer.TypographyStandardizer = {
    inject: inject,
    destroy: destroy,
    getScale: getScale
  };
})();
