/**
 * CF-109: Fix mobile keyboard pushing fixed bottom bar off screen
 * Uses visualViewport API to adjust bottom bar position when keyboard is visible.
 */
(function () {
  'use strict';
  window.CortexFreelancer = window.CortexFreelancer || {};

  const MobileKeyboardFix = {
    init() {
      if (!window.visualViewport) return;
      this.bottomBars = [];
      this.bindViewport();
    },

    bindViewport() {
      const vv = window.visualViewport;
      const update = () => {
        const bottomOffset = window.innerHeight - vv.height - vv.offsetTop;
        const keyboardVisible = bottomOffset > 100;

        this.getBottomBars().forEach(bar => {
          if (keyboardVisible) {
            bar.style.position = 'absolute';
            bar.style.bottom = 'auto';
            bar.style.top = (vv.offsetTop + vv.height - bar.offsetHeight) + 'px';
          } else {
            bar.style.position = '';
            bar.style.bottom = '';
            bar.style.top = '';
          }
        });

        document.body.classList.toggle('cf-keyboard-open', keyboardVisible);
      };

      vv.addEventListener('resize', update);
      vv.addEventListener('scroll', update);
    },

    getBottomBars() {
      return document.querySelectorAll(
        '.bottom-bar, .chat-input-bar, .fixed-bottom, [data-fixed-bottom]'
      );
    }
  };

  MobileKeyboardFix.init();
  window.CortexFreelancer.MobileKeyboardFix = MobileKeyboardFix;
})();
