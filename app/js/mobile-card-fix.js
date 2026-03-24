/**
 * CF-108: Fix mobile tool cards overlapping on small screens (<375px)
 * Injects responsive CSS for iPhone SE and similar narrow viewports.
 */
(function () {
  'use strict';
  window.CortexFreelancer = window.CortexFreelancer || {};

  function init() {
    var style = document.createElement('style');
    style.textContent =
      '@media (max-width: 374px) {' +
        '.tool-card, .tools-grid > *, .card-grid > * {' +
          'width: 100% !important;' +
          'min-width: 0 !important;' +
          'margin-left: 0 !important;' +
          'margin-right: 0 !important;' +
          'flex: 0 0 100% !important;' +
        '}' +
        '.tools-grid, .card-grid {' +
          'display: flex !important;' +
          'flex-direction: column !important;' +
          'gap: 12px !important;' +
          'padding: 0 8px !important;' +
        '}' +
        '.tool-card h3, .card-grid h3 { font-size: 16px !important; }' +
        '.tool-card p, .card-grid p { font-size: 13px !important; }' +
      '}';
    document.head.appendChild(style);
  }

  window.CortexFreelancer.MobileCardFix = { init: init };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
