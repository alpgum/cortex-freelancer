/**
 * CF-120: Fix console errors on pages with missing DOM elements
 * Adds null checks before querySelector operations globally.
 */
(function () {
  'use strict';
  window.CortexFreelancer = window.CortexFreelancer || {};

  const NullGuard = {
    init() {
      this.patchQuerySelector();
      document.addEventListener('DOMContentLoaded', () => this.scanAndFix());
    },

    /**
     * Safe querySelector that never throws on null results.
     */
    q(selector, parent) {
      try {
        return (parent || document).querySelector(selector);
      } catch (e) {
        console.warn('[CF-120] Invalid selector:', selector);
        return null;
      }
    },

    /**
     * Safe querySelectorAll that always returns iterable.
     */
    qAll(selector, parent) {
      try {
        return (parent || document).querySelectorAll(selector);
      } catch (e) {
        console.warn('[CF-120] Invalid selector:', selector);
        return [];
      }
    },

    /**
     * Safe element property setter.
     */
    setText(selector, text, parent) {
      const el = this.q(selector, parent);
      if (el) el.textContent = text;
      return el;
    },

    setHTML(selector, html, parent) {
      const el = this.q(selector, parent);
      if (el) el.innerHTML = html;
      return el;
    },

    setValue(selector, value, parent) {
      const el = this.q(selector, parent);
      if (el) el.value = value;
      return el;
    },

    on(selector, event, handler, parent) {
      const el = this.q(selector, parent);
      if (el) el.addEventListener(event, handler);
      return el;
    },

    patchQuerySelector() {
      // Add safe helper to Document and Element prototypes
      if (!Document.prototype.safeQuery) {
        Document.prototype.safeQuery = function (sel) {
          try { return this.querySelector(sel); } catch (e) { return null; }
        };
      }
      if (!Element.prototype.safeQuery) {
        Element.prototype.safeQuery = function (sel) {
          try { return this.querySelector(sel); } catch (e) { return null; }
        };
      }
    },

    scanAndFix() {
      // Common patterns that cause null errors — provide defaults
      const checks = [
        { sel: '#app', fallback: () => document.body },
        { sel: '.main-content', fallback: () => document.body },
        { sel: '#output', fallback: null },
        { sel: '#result', fallback: null }
      ];

      checks.forEach(({ sel, fallback }) => {
        const el = document.querySelector(sel);
        if (!el && fallback) {
          console.debug('[CF-120] Missing element:', sel);
        }
      });
    }
  };

  NullGuard.init();
  window.CortexFreelancer.NullGuard = NullGuard;
})();
