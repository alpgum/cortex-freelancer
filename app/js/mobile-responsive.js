/**
 * CF-108: Fix mobile tool cards overlapping on small screens (<375px)
 * Adds responsive breakpoint for iPhone SE width, stacks cards vertically.
 */
(function () {
  'use strict';
  window.CortexFreelancer = window.CortexFreelancer || {};

  const MobileResponsive = {
    init() {
      this.injectStyles();
      this.observeResize();
    },

    injectStyles() {
      if (document.getElementById('cf-mobile-responsive')) return;
      const style = document.createElement('style');
      style.id = 'cf-mobile-responsive';
      style.textContent = `
        @media (max-width: 374px) {
          .tool-grid, .tools-grid, .card-grid, .dashboard-grid {
            grid-template-columns: 1fr !important;
            gap: 12px !important;
          }
          .tool-card, .card, .dashboard-card {
            min-width: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 12px !important;
            font-size: 14px !important;
          }
          .tool-card h3, .card h3 {
            font-size: 16px !important;
          }
          .tool-card p, .card p {
            font-size: 13px !important;
          }
          .hero-section h1 {
            font-size: 22px !important;
          }
          .hero-section p {
            font-size: 14px !important;
          }
          .container, .main-content {
            padding-left: 8px !important;
            padding-right: 8px !important;
          }
          .btn, button {
            padding: 10px 16px !important;
            font-size: 14px !important;
          }
          .nav-links {
            gap: 8px !important;
          }
          .pricing-card {
            min-width: 0 !important;
            width: 100% !important;
          }
          .pricing-grid {
            grid-template-columns: 1fr !important;
          }
          .stats-row, .metrics-row {
            flex-direction: column !important;
            gap: 8px !important;
          }
        }

        @media (max-width: 428px) {
          .tool-grid, .tools-grid {
            grid-template-columns: 1fr !important;
          }
          .two-col, .split-layout {
            grid-template-columns: 1fr !important;
            flex-direction: column !important;
          }
        }
      `;
      document.head.appendChild(style);
    },

    observeResize() {
      if (typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver(entries => {
        for (const entry of entries) {
          const width = entry.contentRect.width;
          document.body.classList.toggle('cf-narrow', width < 375);
          document.body.classList.toggle('cf-mobile', width < 428);
        }
      });
      observer.observe(document.documentElement);
    }
  };

  MobileResponsive.init();
  window.CortexFreelancer.MobileResponsive = MobileResponsive;
})();
