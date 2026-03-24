/**
 * CF-290: Keyboard Navigation System
 * Tab order, visible focus indicators, Enter/Space activation,
 * arrow keys in menus, Escape to close modals, focus-trap helper.
 *
 * @namespace window.CortexFreelancer.KeyboardNav
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  var STYLE_ID = 'cortex-keyboard-nav-styles';
  var FOCUSABLE = 'a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"]),[role="button"],[role="link"],[role="menuitem"]';
  var activeTrap = null;
  var previousFocus = null;
  var initialized = false;

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = [
      'body.using-keyboard *:focus{outline:2px solid #6C5CE7;outline-offset:2px;border-radius:2px;}',
      'body:not(.using-keyboard) *:focus{outline:none;}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function handleKeyboardDetection(e) {
    if (e.key === 'Tab') {
      document.body.classList.add('using-keyboard');
    }
  }

  function handleMouseDetection() {
    document.body.classList.remove('using-keyboard');
  }

  function handleCustomButtonActivation(e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var target = e.target;
    if (target.getAttribute('role') === 'button' ||
        (target.hasAttribute('tabindex') && target.tagName !== 'INPUT' &&
         target.tagName !== 'BUTTON' && target.tagName !== 'A' &&
         target.tagName !== 'SELECT' && target.tagName !== 'TEXTAREA')) {
      e.preventDefault();
      target.click();
    }
  }

  function handleMenuArrowKeys(e) {
    var target = e.target;
    var menu = target.closest('[role="menu"],[role="menubar"]');
    if (!menu) return;

    var items = Array.prototype.slice.call(
      menu.querySelectorAll('[role="menuitem"]:not([disabled])')
    );
    if (items.length === 0) return;

    var idx = items.indexOf(target);
    if (idx === -1) return;

    var isVertical = menu.getAttribute('role') === 'menu';
    var nextKey = isVertical ? 'ArrowDown' : 'ArrowRight';
    var prevKey = isVertical ? 'ArrowUp' : 'ArrowLeft';

    if (e.key === nextKey) {
      e.preventDefault();
      items[(idx + 1) % items.length].focus();
    } else if (e.key === prevKey) {
      e.preventDefault();
      items[(idx - 1 + items.length) % items.length].focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      items[0].focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      items[items.length - 1].focus();
    }
  }

  function handleEscapeClose(e) {
    if (e.key !== 'Escape') return;

    if (activeTrap) {
      releaseFocus();
      return;
    }

    var modals = document.querySelectorAll('[role="dialog"],.modal,.cortex-modal');
    for (var i = modals.length - 1; i >= 0; i--) {
      var modal = modals[i];
      if (modal.offsetParent !== null || getComputedStyle(modal).display !== 'none') {
        modal.style.display = 'none';
        modal.setAttribute('aria-hidden', 'true');
        modal.dispatchEvent(new CustomEvent('modal-close', { bubbles: true }));
        return;
      }
    }
  }

  function getFocusableElements(container) {
    return Array.prototype.slice.call(container.querySelectorAll(FOCUSABLE))
      .filter(function (el) {
        return !el.disabled && el.offsetParent !== null;
      });
  }

  function trapFocus(element) {
    previousFocus = document.activeElement;
    activeTrap = element;

    var focusable = getFocusableElements(element);
    if (focusable.length > 0) focusable[0].focus();

    element._trapHandler = function (e) {
      if (e.key !== 'Tab') return;
      var els = getFocusableElements(element);
      if (els.length === 0) { e.preventDefault(); return; }
      var first = els[0];
      var last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    element.addEventListener('keydown', element._trapHandler);
  }

  function releaseFocus() {
    if (!activeTrap) return;
    if (activeTrap._trapHandler) {
      activeTrap.removeEventListener('keydown', activeTrap._trapHandler);
      delete activeTrap._trapHandler;
    }
    activeTrap = null;
    if (previousFocus && previousFocus.focus) previousFocus.focus();
    previousFocus = null;
  }

  function initKeyboardNav() {
    if (initialized) return;
    initialized = true;
    injectStyles();
    document.addEventListener('keydown', handleKeyboardDetection);
    document.addEventListener('mousedown', handleMouseDetection);
    document.addEventListener('keydown', handleCustomButtonActivation);
    document.addEventListener('keydown', handleMenuArrowKeys);
    document.addEventListener('keydown', handleEscapeClose);
  }

  window.CortexFreelancer.KeyboardNav = {
    init: initKeyboardNav,
    trapFocus: trapFocus,
    releaseFocus: releaseFocus,
    getFocusableElements: getFocusableElements
  };

  window.CortexFreelancer.initKeyboardNav = initKeyboardNav;
})();
