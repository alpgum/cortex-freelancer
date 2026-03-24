/**
 * CF-297: Micro-Interactions
 * Hover effects, button press feedback, card lift, smooth transitions, entrance animations.
 *
 * @namespace window.CortexFreelancer.MicroInteractions
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  var STYLE_ID = 'cortex-micro-interactions-styles';
  var _initialized = false;

  var CSS = '\
/* Reduced motion preference */\
@media(prefers-reduced-motion:reduce){\
  .ct-mi-hover,.ct-mi-press,.ct-mi-lift,.ct-mi-entrance,.ct-mi-fade-in,.ct-mi-slide-up,.ct-mi-scale-in{animation:none!important;transition:none!important;transform:none!important}\
}\
\
/* Button press feedback */\
.ct-mi-press{transition:transform 0.1s ease,box-shadow 0.1s ease}\
.ct-mi-press:active{transform:scale(0.96)}\
\
/* Card lift on hover */\
.ct-mi-lift{transition:transform 0.2s ease,box-shadow 0.2s ease}\
.ct-mi-lift:hover{transform:translateY(-4px);box-shadow:0 8px 24px rgba(0,0,0,0.1)}\
\
/* Subtle hover scale */\
.ct-mi-hover{transition:transform 0.2s ease}\
.ct-mi-hover:hover{transform:scale(1.02)}\
\
/* Ripple effect container */\
.ct-mi-ripple{position:relative;overflow:hidden}\
.ct-mi-ripple-circle{position:absolute;border-radius:50%;background:rgba(255,255,255,0.35);transform:scale(0);animation:ct-mi-ripple-expand 0.5s ease-out forwards;pointer-events:none}\
@keyframes ct-mi-ripple-expand{to{transform:scale(4);opacity:0}}\
\
/* Entrance animations */\
@keyframes ct-mi-fadeIn{from{opacity:0}to{opacity:1}}\
@keyframes ct-mi-slideUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}\
@keyframes ct-mi-scaleIn{from{opacity:0;transform:scale(0.9)}to{opacity:1;transform:scale(1)}}\
\
.ct-mi-fade-in{animation:ct-mi-fadeIn 0.3s ease both}\
.ct-mi-slide-up{animation:ct-mi-slideUp 0.4s ease both}\
.ct-mi-scale-in{animation:ct-mi-scaleIn 0.3s ease both}\
\
/* Staggered entrance */\
.ct-mi-stagger>*{opacity:0;animation:ct-mi-slideUp 0.4s ease both}\
.ct-mi-stagger>*:nth-child(1){animation-delay:0s}\
.ct-mi-stagger>*:nth-child(2){animation-delay:0.05s}\
.ct-mi-stagger>*:nth-child(3){animation-delay:0.1s}\
.ct-mi-stagger>*:nth-child(4){animation-delay:0.15s}\
.ct-mi-stagger>*:nth-child(5){animation-delay:0.2s}\
.ct-mi-stagger>*:nth-child(6){animation-delay:0.25s}\
.ct-mi-stagger>*:nth-child(7){animation-delay:0.3s}\
.ct-mi-stagger>*:nth-child(8){animation-delay:0.35s}\
\
/* Smooth expand/collapse */\
.ct-mi-collapse{overflow:hidden;transition:max-height 0.3s ease,opacity 0.3s ease}\
\
/* Focus ring animation */\
.ct-mi-focus:focus-visible{outline:2px solid var(--ct-colors-primary-600,#4f46e5);outline-offset:2px;transition:outline-offset 0.15s ease}\
.ct-mi-focus:focus-visible:active{outline-offset:0px}\
';

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function addRipple(e) {
    var el = e.currentTarget;
    var rect = el.getBoundingClientRect();
    var size = Math.max(rect.width, rect.height);
    var circle = document.createElement('span');
    circle.className = 'ct-mi-ripple-circle';
    circle.style.width = circle.style.height = size + 'px';
    circle.style.left = (e.clientX - rect.left - size / 2) + 'px';
    circle.style.top = (e.clientY - rect.top - size / 2) + 'px';
    el.appendChild(circle);
    circle.addEventListener('animationend', function () { circle.remove(); });
  }

  function applyAutoClasses() {
    // Auto-apply to common selectors
    document.querySelectorAll('button, .cf-btn, [role="button"]').forEach(function (el) {
      if (!el.classList.contains('ct-mi-press')) el.classList.add('ct-mi-press');
    });

    document.querySelectorAll('.cf-card, [class*="card"]').forEach(function (el) {
      if (!el.classList.contains('ct-mi-lift')) el.classList.add('ct-mi-lift');
    });
  }

  function observeEntrances() {
    if (!('IntersectionObserver' in window)) return;

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('ct-mi-slide-up');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('[data-mi-entrance]').forEach(function (el) {
      observer.observe(el);
    });
  }

  function initMicroInteractions(opts) {
    if (_initialized) return;
    _initialized = true;
    opts = opts || {};

    injectStyles();

    if (opts.autoApply !== false) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applyAutoClasses);
      } else {
        applyAutoClasses();
      }
    }

    // Ripple on buttons with data-mi-ripple
    document.addEventListener('click', function (e) {
      var target = e.target.closest('.ct-mi-ripple, [data-mi-ripple]');
      if (target) addRipple(e);
    });

    observeEntrances();
  }

  window.CortexFreelancer.MicroInteractions = {
    initMicroInteractions: initMicroInteractions,
    addRipple: addRipple,
    applyAutoClasses: applyAutoClasses,
    classes: {
      press: 'ct-mi-press',
      lift: 'ct-mi-lift',
      hover: 'ct-mi-hover',
      ripple: 'ct-mi-ripple',
      fadeIn: 'ct-mi-fade-in',
      slideUp: 'ct-mi-slide-up',
      scaleIn: 'ct-mi-scale-in',
      stagger: 'ct-mi-stagger',
      focus: 'ct-mi-focus'
    }
  };
})();
