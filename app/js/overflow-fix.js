/**
 * CF-111: Fix horizontal scroll on mobile landing page
 * Finds and fixes elements causing overflow-x on viewport widths 320-428px.
 */
(function () {
  'use strict';
  window.CortexFreelancer = window.CortexFreelancer || {};

  const OverflowFix = {
    init() {
      this.injectStyles();
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.audit());
      } else {
        this.audit();
      }
    },

    injectStyles() {
      if (document.getElementById('cf-overflow-fix')) return;
      const style = document.createElement('style');
      style.id = 'cf-overflow-fix';
      style.textContent = `
        html, body {
          overflow-x: hidden;
          max-width: 100vw;
        }
        img, video, iframe, canvas, svg {
          max-width: 100%;
          height: auto;
        }
        pre, code {
          overflow-x: auto;
          max-width: 100%;
          word-break: break-word;
        }
        table {
          display: block;
          overflow-x: auto;
          max-width: 100%;
        }
        .container, .wrapper, .main-content, section {
          max-width: 100vw;
          overflow-x: hidden;
        }
      `;
      document.head.appendChild(style);
    },

    audit() {
      const docWidth = document.documentElement.clientWidth;
      document.querySelectorAll('*').forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.right > docWidth + 5 || rect.left < -5) {
          const computed = window.getComputedStyle(el);
          if (computed.position === 'fixed' || computed.position === 'absolute') return;
          el.style.maxWidth = '100%';
          el.style.overflowX = 'hidden';
          el.style.boxSizing = 'border-box';
        }
      });
    }
  };

  OverflowFix.init();
  window.CortexFreelancer.OverflowFix = OverflowFix;
})();
