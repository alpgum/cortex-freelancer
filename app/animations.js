// ===== PAGE ANIMATIONS — Cortex Freelancer =====
// IntersectionObserver-based scroll reveal animations.
// Auto-applies to common page elements. Respects prefers-reduced-motion.

(function () {
  'use strict';

  // ── Bail if user prefers reduced motion ──
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  // ── Load animations CSS ──
  if (!document.getElementById('cortex-animations-css')) {
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/app/animations.css';
    link.id = 'cortex-animations-css';
    document.head.appendChild(link);
  }

  // ── Auto-tag elements for animation ──
  function tagElements() {
    // Cards and panels — scale-in
    var cards = document.querySelectorAll(
      '.panel, .quick-action, .saved-card, .tool-card, .template-card, ' +
      '.activity-item, .ob-rec-card'
    );
    for (var i = 0; i < cards.length; i++) {
      if (!cards[i].classList.contains('anim-scale-in')) {
        cards[i].classList.add('anim-scale-in');
      }
    }

    // Sections — fade-in-up
    var sections = document.querySelectorAll(
      '.dash-section, .page-header, .input-section, .output-section, ' +
      '.section-card, .result-card, .share-bar, .pro-status-card, ' +
      '.subscription-card, .dash-greeting, .main-wrap > *, .main-layout > *, ' +
      '.invoice-layout, .proposal-form, .ratecalc-form'
    );
    for (var j = 0; j < sections.length; j++) {
      if (!sections[j].classList.contains('anim-fade-up') &&
          !sections[j].classList.contains('anim-scale-in')) {
        sections[j].classList.add('anim-fade-up');
      }
    }

    // Buttons — lift on hover
    var buttons = document.querySelectorAll(
      '.btn, .btn-analyze, .btn-analyze-manual, .btn-signup, .btn-pro-start, ' +
      '.pro-status-btn, .nav-cta, .btn-share, .btn-sm'
    );
    for (var k = 0; k < buttons.length; k++) {
      if (!buttons[k].classList.contains('anim-lift')) {
        buttons[k].classList.add('anim-lift');
      }
    }
  }

  // ── IntersectionObserver for scroll reveal ──
  function initObserver() {
    if (!('IntersectionObserver' in window)) {
      // Fallback: show everything
      var all = document.querySelectorAll('.anim-fade-up, .anim-scale-in, .anim-slide-left, .anim-slide-right');
      for (var i = 0; i < all.length; i++) {
        all[i].classList.add('anim-visible');
      }
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) {
          entries[i].target.classList.add('anim-visible');
          observer.unobserve(entries[i].target);
        }
      }
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -40px 0px'
    });

    var targets = document.querySelectorAll(
      '.anim-fade-up, .anim-scale-in, .anim-slide-left, .anim-slide-right'
    );
    for (var j = 0; j < targets.length; j++) {
      observer.observe(targets[j]);
    }
  }

  // ── Initialize ──
  function init() {
    tagElements();
    // Small delay to ensure CSS is loaded and elements are painted
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        initObserver();
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
