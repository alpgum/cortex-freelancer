/**
 * CF-233: Scroll-Triggered Animations on Landing Page
 * Subtle fade-in/slide-up animations using IntersectionObserver
 * as sections enter viewport. Configurable thresholds and delays.
 *
 * @namespace window.CortexFreelancer.ScrollAnimations
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  var STYLE_ID = 'cortex-scroll-animations-styles';

  var DEFAULTS = {
    selector: '[data-animate]',
    threshold: 0.15,
    rootMargin: '0px 0px -40px 0px',
    baseDelay: 0,
    stagger: 100,
    duration: 600,
    once: true
  };

  var state = {
    observer: null,
    options: {},
    initialized: false
  };

  // ─── Styles ────────────────────────────────────────────

  function injectStyles(duration) {
    if (document.getElementById(STYLE_ID)) return;
    var dur = (duration / 1000) + 's';
    var css = [
      '[data-animate] {',
      '  opacity: 0;',
      '  transition: opacity ' + dur + ' ease, transform ' + dur + ' ease;',
      '}',
      '[data-animate="fade-in"] { opacity: 0; }',
      '[data-animate="slide-up"] { opacity: 0; transform: translateY(30px); }',
      '[data-animate="slide-left"] { opacity: 0; transform: translateX(-30px); }',
      '[data-animate="slide-right"] { opacity: 0; transform: translateX(30px); }',
      '[data-animate="scale-in"] { opacity: 0; transform: scale(0.9); }',
      '[data-animate].animated {',
      '  opacity: 1 !important;',
      '  transform: none !important;',
      '}',
      '@media (prefers-reduced-motion: reduce) {',
      '  [data-animate] { transition: none !important; opacity: 1 !important; transform: none !important; }',
      '}'
    ].join('\n');
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ─── Observer ──────────────────────────────────────────

  function createObserver(opts) {
    if (!('IntersectionObserver' in window)) {
      // Fallback: show everything
      var elements = document.querySelectorAll(opts.selector);
      for (var i = 0; i < elements.length; i++) {
        elements[i].classList.add('animated');
      }
      return null;
    }

    return new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;

        var el = entry.target;
        var delay = parseInt(el.getAttribute('data-animate-delay') || '0', 10);
        var index = parseInt(el.getAttribute('data-animate-index') || '0', 10);
        var totalDelay = opts.baseDelay + delay + (index * opts.stagger);

        if (totalDelay > 0) {
          setTimeout(function () {
            el.classList.add('animated');
          }, totalDelay);
        } else {
          el.classList.add('animated');
        }

        if (opts.once && state.observer) {
          state.observer.unobserve(el);
        }
      });
    }, {
      threshold: opts.threshold,
      rootMargin: opts.rootMargin
    });
  }

  function observeElements(opts) {
    if (!state.observer) return;
    var elements = document.querySelectorAll(opts.selector);
    for (var i = 0; i < elements.length; i++) {
      elements[i].setAttribute('data-animate-index', i);
      state.observer.observe(elements[i]);
    }
  }

  // ─── Public API ────────────────────────────────────────

  function init(options) {
    if (state.initialized) destroy();
    state.options = {};
    for (var key in DEFAULTS) {
      state.options[key] = (options && options[key] !== undefined) ? options[key] : DEFAULTS[key];
    }
    injectStyles(state.options.duration);
    state.observer = createObserver(state.options);
    observeElements(state.options);
    state.initialized = true;
  }

  function refresh() {
    if (!state.initialized) return;
    observeElements(state.options);
  }

  function destroy() {
    if (state.observer) {
      state.observer.disconnect();
      state.observer = null;
    }
    state.initialized = false;
    var style = document.getElementById(STYLE_ID);
    if (style && style.parentNode) style.parentNode.removeChild(style);
  }

  window.CortexFreelancer.ScrollAnimations = {
    init: init,
    refresh: refresh,
    destroy: destroy,
    DEFAULTS: DEFAULTS
  };
})();
