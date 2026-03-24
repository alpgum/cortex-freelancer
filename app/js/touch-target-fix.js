/**
 * CF-110: Fix touch targets too small on mobile (< 44px)
 * Audits and fixes buttons/links below WCAG 44x44px minimum.
 */
(function () {
  'use strict';
  window.CortexFreelancer = window.CortexFreelancer || {};

  var MIN_SIZE = 44;

  function init() {
    // Inject global CSS for minimum touch targets on mobile
    var style = document.createElement('style');
    style.textContent =
      '@media (pointer: coarse) {' +
        'button, a, [role="button"], input[type="submit"], input[type="button"], ' +
        'input[type="checkbox"], input[type="radio"], select, .clickable {' +
          'min-height: ' + MIN_SIZE + 'px !important;' +
          'min-width: ' + MIN_SIZE + 'px !important;' +
        '}' +
        'a { padding: 8px 4px !important; }' +
      '}';
    document.head.appendChild(style);
  }

  /**
   * Audit current page for small touch targets (for dev/debug).
   * Returns array of elements below minimum size.
   */
  function audit() {
    var interactives = document.querySelectorAll('button, a, [role="button"], input[type="submit"]');
    var issues = [];
    interactives.forEach(function (el) {
      var rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0 &&
          (rect.width < MIN_SIZE || rect.height < MIN_SIZE)) {
        issues.push({
          element: el,
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          text: (el.textContent || '').substring(0, 30).trim()
        });
      }
    });
    if (issues.length) {
      console.warn('[TouchTargetFix] ' + issues.length + ' elements below 44px:', issues);
    }
    return issues;
  }

  window.CortexFreelancer.TouchTargetFix = { init: init, audit: audit };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
