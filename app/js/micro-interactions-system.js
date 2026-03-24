/**
 * @file Micro-Interactions System
 * @description Adds subtle hover animations, transitions, and micro-interactions
 *   to cards, buttons, links, and interactive elements for a polished UI feel.
 * @version 1.0.0
 * @task CF-297
 */

(function() {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  /**
   * @namespace MicroInteractions
   * @memberof window.CortexFreelancer
   * @description Manages micro-interactions including hover effects, ripples,
   *   focus rings, and entrance animations.
   */
  const MicroInteractions = {
    /** @type {boolean} Whether the system has been initialized */
    initialized: false,

    /** @type {HTMLStyleElement|null} Injected stylesheet */
    styleEl: null,

    /** @type {Object} Configuration */
    config: {
      /** @type {boolean} Respect prefers-reduced-motion */
      respectReducedMotion: true,
      /** @type {boolean} Enable ripple effect on buttons */
      enableRipple: true,
      /** @type {boolean} Enable card hover lift */
      enableCardLift: true,
      /** @type {boolean} Enable link underline animations */
      enableLinkAnimations: true,
      /** @type {boolean} Enable focus ring animations */
      enableFocusRing: true,
      /** @type {string} CSS timing function */
      easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
      /** @type {number} Base transition duration in ms */
      duration: 200
    },

    /**
     * Initialize the micro-interactions system.
     * @param {Object} [options] - Override default config
     * @returns {void}
     */
    init(options) {
      if (this.initialized) return;

      if (options) {
        Object.assign(this.config, options);
      }

      this._injectStyles();
      this._bindRipple();
      this._observeNewElements();
      this.initialized = true;
    },

    /**
     * Inject all CSS for micro-interactions.
     * @private
     */
    _injectStyles() {
      if (this.styleEl) return;

      var c = this.config;
      var dur = c.duration + 'ms';
      var ease = c.easing;

      var css = `
/* ===== Micro-Interactions System ===== */

/* Reduced motion override */
@media (prefers-reduced-motion: reduce) {
  .cf-mi-card, .cf-mi-btn, .cf-mi-link, .cf-mi-focus,
  [data-cf-hover] {
    transition: none !important;
    animation: none !important;
  }
  .cf-mi-btn .cf-ripple {
    display: none !important;
  }
}

/* ----- Card hover effects ----- */
.cf-mi-card,
[data-cf-hover="card"] {
  transition: transform ${dur} ${ease},
              box-shadow ${dur} ${ease};
  will-change: transform;
}

.cf-mi-card:hover,
[data-cf-hover="card"]:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1),
              0 4px 10px rgba(0, 0, 0, 0.06);
}

.cf-mi-card:active,
[data-cf-hover="card"]:active {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

/* ----- Button hover effects ----- */
.cf-mi-btn,
[data-cf-hover="button"] {
  position: relative;
  overflow: hidden;
  transition: transform ${dur} ${ease},
              box-shadow ${dur} ${ease},
              background-color ${dur} ${ease},
              border-color ${dur} ${ease};
  will-change: transform;
}

.cf-mi-btn:hover,
[data-cf-hover="button"]:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.cf-mi-btn:active,
[data-cf-hover="button"]:active {
  transform: translateY(0) scale(0.98);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
}

/* Ripple effect */
.cf-ripple {
  position: absolute;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.35);
  transform: scale(0);
  animation: cf-ripple-expand 500ms ${ease} forwards;
  pointer-events: none;
}

@keyframes cf-ripple-expand {
  to {
    transform: scale(4);
    opacity: 0;
  }
}

/* ----- Link hover effects ----- */
.cf-mi-link,
[data-cf-hover="link"] {
  position: relative;
  text-decoration: none;
  transition: color ${dur} ${ease};
}

.cf-mi-link::after,
[data-cf-hover="link"]::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 0;
  width: 0;
  height: 2px;
  background: currentColor;
  transition: width 300ms ${ease};
}

.cf-mi-link:hover::after,
[data-cf-hover="link"]:hover::after {
  width: 100%;
}

/* ----- Focus ring ----- */
.cf-mi-focus:focus-visible,
[data-cf-hover]:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(108, 92, 231, 0.4);
  transition: box-shadow 150ms ${ease};
}

/* ----- Icon hover spin ----- */
[data-cf-hover="icon"]:hover {
  animation: cf-icon-bounce 400ms ${ease};
}

@keyframes cf-icon-bounce {
  0% { transform: scale(1); }
  30% { transform: scale(1.2); }
  60% { transform: scale(0.95); }
  100% { transform: scale(1); }
}

/* ----- Badge pulse ----- */
[data-cf-hover="badge"] {
  transition: transform ${dur} ${ease};
}
[data-cf-hover="badge"]:hover {
  animation: cf-badge-pulse 600ms ${ease};
}

@keyframes cf-badge-pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.08); }
  100% { transform: scale(1); }
}

/* ----- Entrance animations ----- */
.cf-mi-fade-in {
  animation: cf-fade-in 400ms ${ease} both;
}

.cf-mi-slide-up {
  animation: cf-slide-up 400ms ${ease} both;
}

.cf-mi-scale-in {
  animation: cf-scale-in 300ms ${ease} both;
}

@keyframes cf-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes cf-slide-up {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes cf-scale-in {
  from { opacity: 0; transform: scale(0.92); }
  to { opacity: 1; transform: scale(1); }
}

/* Staggered entrance */
.cf-mi-stagger > * {
  animation: cf-slide-up 400ms ${ease} both;
}
.cf-mi-stagger > *:nth-child(1) { animation-delay: 0ms; }
.cf-mi-stagger > *:nth-child(2) { animation-delay: 60ms; }
.cf-mi-stagger > *:nth-child(3) { animation-delay: 120ms; }
.cf-mi-stagger > *:nth-child(4) { animation-delay: 180ms; }
.cf-mi-stagger > *:nth-child(5) { animation-delay: 240ms; }
.cf-mi-stagger > *:nth-child(6) { animation-delay: 300ms; }
.cf-mi-stagger > *:nth-child(7) { animation-delay: 360ms; }
.cf-mi-stagger > *:nth-child(8) { animation-delay: 420ms; }

/* ----- Toggle switch interaction ----- */
.cf-mi-toggle {
  transition: background-color ${dur} ${ease};
}
.cf-mi-toggle::after {
  transition: transform ${dur} ${ease};
}
`;

      this.styleEl = document.createElement('style');
      this.styleEl.id = 'cf-micro-interactions';
      this.styleEl.textContent = css;
      document.head.appendChild(this.styleEl);
    },

    /**
     * Bind ripple effect to buttons.
     * @private
     */
    _bindRipple() {
      if (!this.config.enableRipple) return;

      document.addEventListener('pointerdown', function(e) {
        var btn = e.target.closest('.cf-mi-btn, [data-cf-hover="button"]');
        if (!btn) return;

        if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

        var rect = btn.getBoundingClientRect();
        var size = Math.max(rect.width, rect.height);
        var ripple = document.createElement('span');
        ripple.className = 'cf-ripple';
        ripple.style.width = ripple.style.height = size + 'px';
        ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
        ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
        btn.appendChild(ripple);

        ripple.addEventListener('animationend', function() {
          ripple.remove();
        });
      });
    },

    /**
     * Observe DOM for newly added elements to auto-enhance.
     * @private
     */
    _observeNewElements() {
      if (typeof MutationObserver === 'undefined') return;

      var self = this;
      var observer = new MutationObserver(function(mutations) {
        for (var i = 0; i < mutations.length; i++) {
          var nodes = mutations[i].addedNodes;
          for (var j = 0; j < nodes.length; j++) {
            if (nodes[j].nodeType === 1 && nodes[j].hasAttribute('data-cf-hover')) {
              self._enhanceElement(nodes[j]);
            }
          }
        }
      });

      observer.observe(document.body || document.documentElement, {
        childList: true,
        subtree: true
      });
    },

    /**
     * Apply appropriate classes to an element based on its data-cf-hover value.
     * @param {HTMLElement} el
     * @private
     */
    _enhanceElement(el) {
      var type = el.getAttribute('data-cf-hover');
      if (type === 'card') el.classList.add('cf-mi-card');
      else if (type === 'button') el.classList.add('cf-mi-btn');
      else if (type === 'link') el.classList.add('cf-mi-link');
    },

    /**
     * Add a hover effect to a specific element programmatically.
     * @param {HTMLElement|string} el - Element or selector
     * @param {string} type - Effect type: card|button|link|icon|badge
     */
    addEffect(el, type) {
      var target = typeof el === 'string' ? document.querySelector(el) : el;
      if (!target) return;
      target.setAttribute('data-cf-hover', type);
      this._enhanceElement(target);
    },

    /**
     * Apply entrance animation to elements.
     * @param {HTMLElement|string} el - Element or selector
     * @param {string} [animation='slide-up'] - Animation: fade-in|slide-up|scale-in
     * @param {number} [delay=0] - Delay in ms
     */
    animateEntrance(el, animation, delay) {
      var target = typeof el === 'string' ? document.querySelector(el) : el;
      if (!target) return;
      var anim = animation || 'slide-up';
      if (delay) target.style.animationDelay = delay + 'ms';
      target.classList.add('cf-mi-' + anim);
    },

    /**
     * Apply staggered entrance animation to children of a container.
     * @param {HTMLElement|string} container - Container element or selector
     */
    stagger(container) {
      var target = typeof container === 'string' ? document.querySelector(container) : container;
      if (target) target.classList.add('cf-mi-stagger');
    },

    /**
     * Destroy the system and remove injected styles.
     */
    destroy() {
      if (this.styleEl) {
        this.styleEl.remove();
        this.styleEl = null;
      }
      this.initialized = false;
    }
  };

  window.CortexFreelancer.MicroInteractions = MicroInteractions;
})();
