/**
 * CF-109: Fix mobile keyboard pushing fixed bottom bar off screen
 * Uses visualViewport API to adjust bottom bar position.
 */
(function () {
  'use strict';
  window.CortexFreelancer = window.CortexFreelancer || {};

  function init() {
    if (!window.visualViewport) return;

    var bottomBar = document.querySelector('.bottom-bar, .fixed-bottom, [data-fixed-bottom]');
    if (!bottomBar) return;

    function adjustBottomBar() {
      var vv = window.visualViewport;
      var offset = window.innerHeight - vv.height - vv.offsetTop;
      if (offset > 50) {
        // Keyboard is visible
        bottomBar.style.transform = 'translateY(-' + offset + 'px)';
        bottomBar.style.transition = 'transform 0.15s ease-out';
      } else {
        bottomBar.style.transform = '';
      }
    }

    window.visualViewport.addEventListener('resize', adjustBottomBar);
    window.visualViewport.addEventListener('scroll', adjustBottomBar);
  }

  window.CortexFreelancer.KeyboardViewportFix = { init: init };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
