/**
 * CF-111: Fix horizontal scroll on mobile landing page
 * Finds and fixes elements causing overflow-x on 320-428px viewports.
 */
(function () {
  'use strict';
  window.CortexFreelancer = window.CortexFreelancer || {};

  function init() {
    var style = document.createElement('style');
    style.textContent =
      '@media (max-width: 428px) {' +
        'html, body { overflow-x: hidden !important; }' +
        'img, video, iframe, table, pre, code {' +
          'max-width: 100% !important;' +
          'overflow-x: auto !important;' +
        '}' +
        '.hero, .hero-section, .landing-hero {' +
          'max-width: 100vw !important;' +
          'overflow: hidden !important;' +
        '}' +
        '.container, .wrapper, .content, main, section {' +
          'max-width: 100% !important;' +
          'padding-left: max(16px, env(safe-area-inset-left)) !important;' +
          'padding-right: max(16px, env(safe-area-inset-right)) !important;' +
          'box-sizing: border-box !important;' +
        '}' +
      '}';
    document.head.appendChild(style);
  }

  /**
   * Debug: find elements causing horizontal overflow.
   */
  function findOverflows() {
    var docWidth = document.documentElement.offsetWidth;
    var issues = [];
    document.querySelectorAll('*').forEach(function (el) {
      if (el.offsetWidth > docWidth) {
        issues.push({
          element: el,
          tagName: el.tagName,
          className: el.className,
          width: el.offsetWidth,
          overflow: el.offsetWidth - docWidth
        });
      }
    });
    if (issues.length) {
      console.warn('[MobileOverflowFix] ' + issues.length + ' overflowing elements:', issues);
    }
    return issues;
  }

  window.CortexFreelancer.MobileOverflowFix = { init: init, findOverflows: findOverflows };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
