/**
 * CF-294 Responsive Breakpoint System
 * Defines breakpoints (mobile < 640px, tablet 640-1024px, desktop > 1024px),
 * fluid typography, and viewport-aware utilities.
 */
(function() {
  const ns = (window.CortexFreelancer = window.CortexFreelancer || {});

  /**
   * @typedef {Object} Breakpoint
   * @property {string} name
   * @property {number} minWidth - Minimum width in px (inclusive)
   * @property {number} maxWidth - Maximum width in px (inclusive, Infinity for no upper bound)
   */

  /** @type {Object<string, Breakpoint>} */
  const BREAKPOINTS = {
    mobile:  { name: 'mobile',  minWidth: 0,    maxWidth: 639  },
    tablet:  { name: 'tablet',  minWidth: 640,  maxWidth: 1024 },
    desktop: { name: 'desktop', minWidth: 1025, maxWidth: Infinity }
  };

  /**
   * Fluid typography scale.
   * Each entry maps a role to min/max font sizes that scale between mobile and desktop.
   * @type {Object<string, {min: number, max: number, lineHeight: number}>}
   */
  const TYPOGRAPHY_SCALE = {
    h1:      { min: 28, max: 48, lineHeight: 1.15 },
    h2:      { min: 24, max: 36, lineHeight: 1.2 },
    h3:      { min: 20, max: 28, lineHeight: 1.25 },
    h4:      { min: 18, max: 24, lineHeight: 1.3 },
    body:    { min: 14, max: 16, lineHeight: 1.5 },
    bodyLg:  { min: 16, max: 18, lineHeight: 1.5 },
    small:   { min: 12, max: 14, lineHeight: 1.4 },
    caption: { min: 11, max: 12, lineHeight: 1.4 }
  };

  /** @type {string|null} */
  var currentBreakpoint = null;

  /** @type {Array<function(string, string): void>} */
  var listeners = [];

  /** @type {HTMLStyleElement|null} */
  var styleEl = null;

  /**
   * Get the current breakpoint name based on window width.
   * @param {number} [width] - Override width for testing
   * @returns {string}
   */
  function getBreakpoint(width) {
    var w = width !== undefined ? width : window.innerWidth;
    if (w <= BREAKPOINTS.mobile.maxWidth) return 'mobile';
    if (w <= BREAKPOINTS.tablet.maxWidth) return 'tablet';
    return 'desktop';
  }

  /**
   * Generate a CSS clamp() value for fluid typography.
   * @param {number} minPx - Minimum font size in px
   * @param {number} maxPx - Maximum font size in px
   * @param {number} [minVw=640] - Viewport width where min size applies
   * @param {number} [maxVw=1440] - Viewport width where max size applies
   * @returns {string} CSS clamp() expression
   */
  function fluidSize(minPx, maxPx, minVw, maxVw) {
    minVw = minVw || 640;
    maxVw = maxVw || 1440;
    var slope = (maxPx - minPx) / (maxVw - minVw);
    var intercept = minPx - slope * minVw;
    var preferred = intercept.toFixed(2) + 'px + ' + (slope * 100).toFixed(4) + 'vw';
    return 'clamp(' + minPx + 'px, ' + preferred + ', ' + maxPx + 'px)';
  }

  /**
   * Generate and inject fluid typography CSS custom properties and utility classes.
   */
  function injectStyles() {
    if (styleEl && document.head.contains(styleEl)) return;

    var css = ':root {\n';
    Object.keys(TYPOGRAPHY_SCALE).forEach(function(key) {
      var scale = TYPOGRAPHY_SCALE[key];
      css += '  --cf-font-' + key + ': ' + fluidSize(scale.min, scale.max) + ';\n';
      css += '  --cf-lh-' + key + ': ' + scale.lineHeight + ';\n';
    });

    // Spacing scale that adapts to viewport
    css += '  --cf-space-xs: clamp(4px, 0.5vw, 8px);\n';
    css += '  --cf-space-sm: clamp(8px, 1vw, 12px);\n';
    css += '  --cf-space-md: clamp(12px, 2vw, 24px);\n';
    css += '  --cf-space-lg: clamp(24px, 3vw, 48px);\n';
    css += '  --cf-space-xl: clamp(48px, 5vw, 80px);\n';

    // Container max-widths
    css += '  --cf-container-sm: 640px;\n';
    css += '  --cf-container-md: 1024px;\n';
    css += '  --cf-container-lg: 1280px;\n';
    css += '  --cf-container-xl: 1440px;\n';
    css += '}\n\n';

    // Typography utility classes
    Object.keys(TYPOGRAPHY_SCALE).forEach(function(key) {
      var scale = TYPOGRAPHY_SCALE[key];
      css += '.cf-text-' + key + ' {\n';
      css += '  font-size: var(--cf-font-' + key + ');\n';
      css += '  line-height: var(--cf-lh-' + key + ');\n';
      css += '}\n';
    });

    // Responsive container
    css += '.cf-container {\n';
    css += '  width: 100%;\n';
    css += '  margin-left: auto;\n';
    css += '  margin-right: auto;\n';
    css += '  padding-left: var(--cf-space-md);\n';
    css += '  padding-right: var(--cf-space-md);\n';
    css += '}\n';
    css += '@media (min-width: 640px) { .cf-container { max-width: var(--cf-container-sm); } }\n';
    css += '@media (min-width: 1025px) { .cf-container { max-width: var(--cf-container-md); } }\n';
    css += '@media (min-width: 1280px) { .cf-container { max-width: var(--cf-container-lg); } }\n';

    // Responsive visibility helpers
    css += '.cf-hide-mobile { }\n';
    css += '.cf-hide-tablet { }\n';
    css += '.cf-hide-desktop { }\n';
    css += '@media (max-width: 639px) { .cf-hide-mobile { display: none !important; } }\n';
    css += '@media (min-width: 640px) and (max-width: 1024px) { .cf-hide-tablet { display: none !important; } }\n';
    css += '@media (min-width: 1025px) { .cf-hide-desktop { display: none !important; } }\n';

    styleEl = document.createElement('style');
    styleEl.id = 'cf-responsive-system';
    styleEl.textContent = css;
    document.head.appendChild(styleEl);
  }

  /**
   * Check breakpoint and fire listeners on change.
   */
  function checkBreakpoint() {
    var bp = getBreakpoint();
    if (bp !== currentBreakpoint) {
      var prev = currentBreakpoint;
      currentBreakpoint = bp;
      document.documentElement.setAttribute('data-cf-breakpoint', bp);
      listeners.forEach(function(fn) {
        try { fn(bp, prev); } catch (e) { console.error('[ResponsiveSystem] Listener error:', e); }
      });
    }
  }

  /**
   * Register a breakpoint change listener.
   * @param {function(string, string): void} fn - Callback receiving (newBreakpoint, oldBreakpoint)
   * @returns {function(): void} Unsubscribe function
   */
  function onChange(fn) {
    listeners.push(fn);
    return function() {
      listeners = listeners.filter(function(l) { return l !== fn; });
    };
  }

  /**
   * Check if current viewport matches a breakpoint.
   * @param {string} breakpointName
   * @returns {boolean}
   */
  function matches(breakpointName) {
    return getBreakpoint() === breakpointName;
  }

  /**
   * Get a media query string for a breakpoint.
   * @param {string} breakpointName
   * @returns {string}
   */
  function mediaQuery(breakpointName) {
    var bp = BREAKPOINTS[breakpointName];
    if (!bp) return '';
    var parts = [];
    if (bp.minWidth > 0) parts.push('(min-width: ' + bp.minWidth + 'px)');
    if (bp.maxWidth < Infinity) parts.push('(max-width: ' + bp.maxWidth + 'px)');
    return parts.join(' and ');
  }

  /**
   * Initialize the responsive system.
   * Injects styles, sets initial breakpoint, and starts listening for resize.
   */
  function init() {
    injectStyles();
    currentBreakpoint = getBreakpoint();
    document.documentElement.setAttribute('data-cf-breakpoint', currentBreakpoint);
    window.addEventListener('resize', checkBreakpoint);
  }

  /**
   * Clean up: remove styles, listeners, and resize handler.
   */
  function destroy() {
    window.removeEventListener('resize', checkBreakpoint);
    listeners = [];
    if (styleEl && styleEl.parentNode) {
      styleEl.parentNode.removeChild(styleEl);
      styleEl = null;
    }
    document.documentElement.removeAttribute('data-cf-breakpoint');
    currentBreakpoint = null;
  }

  ns.ResponsiveSystem = {
    BREAKPOINTS: BREAKPOINTS,
    TYPOGRAPHY_SCALE: TYPOGRAPHY_SCALE,
    getBreakpoint: getBreakpoint,
    fluidSize: fluidSize,
    matches: matches,
    mediaQuery: mediaQuery,
    onChange: onChange,
    init: init,
    destroy: destroy
  };
})();
