/**
 * CF-282: UI Component Library
 * Reusable CSS classes for buttons, inputs, cards, and modals with consistent styling.
 * All components use design token CSS custom properties for theming.
 *
 * @namespace window.CortexFreelancer.UIComponentLibrary
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  var STYLE_ID = 'cortex-ui-component-library-styles';

  var CSS = [
    /* Buttons */
    '.ct-btn { display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem; padding: var(--ct-spacing-sm, 0.5rem) var(--ct-spacing-md, 1rem); border: none; border-radius: var(--ct-radius-md, 0.5rem); font-size: var(--ct-font-size-sm, 0.875rem); font-weight: 600; cursor: pointer; transition: background 0.15s ease, box-shadow 0.15s ease; font-family: inherit; line-height: 1.5; text-decoration: none; }',
    '.ct-btn:focus-visible { outline: 2px solid var(--ct-brand-primary, #6366f1); outline-offset: 2px; }',
    '.ct-btn:disabled { opacity: 0.5; cursor: not-allowed; pointer-events: none; }',
    '.ct-btn--primary { background: var(--ct-brand-primary, #6366f1); color: #fff; }',
    '.ct-btn--primary:hover { background: var(--ct-brand-primary-hover, #4f46e5); }',
    '.ct-btn--secondary { background: transparent; color: var(--ct-brand-neutral-dark, #1f2937); border: 1px solid var(--ct-brand-neutral-dark, #1f2937); }',
    '.ct-btn--secondary:hover { background: var(--ct-brand-primary-light, #e0e7ff); }',
    '.ct-btn--ghost { background: transparent; color: var(--ct-brand-primary, #6366f1); }',
    '.ct-btn--ghost:hover { background: var(--ct-brand-primary-light, #e0e7ff); }',
    '.ct-btn--danger { background: #ef4444; color: #fff; }',
    '.ct-btn--danger:hover { background: #dc2626; }',
    '.ct-btn--sm { padding: 0.25rem 0.75rem; font-size: 0.75rem; }',
    '.ct-btn--lg { padding: 0.75rem 1.5rem; font-size: var(--ct-font-size-base, 1rem); }',
    '.ct-btn--block { width: 100%; }',

    /* Inputs */
    '.ct-input { display: block; width: 100%; padding: var(--ct-spacing-sm, 0.5rem) 0.75rem; border: 1px solid #d1d5db; border-radius: var(--ct-radius-md, 0.5rem); font-size: var(--ct-font-size-sm, 0.875rem); font-family: inherit; background: #fff; color: var(--ct-brand-neutral-dark, #1f2937); transition: border-color 0.15s ease; box-sizing: border-box; }',
    '.ct-input:focus { outline: none; border-color: var(--ct-brand-primary, #6366f1); box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15); }',
    '.ct-input--error { border-color: #ef4444; }',
    '.ct-input--error:focus { box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.15); }',
    '.ct-input-group { display: flex; flex-direction: column; gap: 0.25rem; }',
    '.ct-input-label { font-size: var(--ct-font-size-sm, 0.875rem); font-weight: 500; color: var(--ct-brand-neutral-dark, #1f2937); }',
    '.ct-input-hint { font-size: 0.75rem; color: #6b7280; }',
    '.ct-input-error-msg { font-size: 0.75rem; color: #ef4444; }',
    '.ct-textarea { resize: vertical; min-height: 5rem; }',
    '.ct-select { appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 12 12\'%3E%3Cpath fill=\'%236b7280\' d=\'M6 8L1 3h10z\'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 0.75rem center; padding-right: 2rem; }',

    /* Cards */
    '.ct-card { background: #fff; border: 1px solid #e5e7eb; border-radius: var(--ct-radius-lg, 0.75rem); overflow: hidden; }',
    '.ct-card__header { padding: var(--ct-spacing-md, 1rem) 1.25rem; border-bottom: 1px solid #e5e7eb; font-weight: 600; }',
    '.ct-card__body { padding: var(--ct-spacing-md, 1rem) 1.25rem; }',
    '.ct-card__footer { padding: var(--ct-spacing-md, 1rem) 1.25rem; border-top: 1px solid #e5e7eb; display: flex; justify-content: flex-end; gap: var(--ct-spacing-sm, 0.5rem); }',
    '.ct-card--hoverable { transition: box-shadow 0.2s ease; cursor: pointer; }',
    '.ct-card--hoverable:hover { box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); }',
    '.ct-card--flat { border: none; box-shadow: none; }',

    /* Modals */
    '.ct-modal-overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center; z-index: 9999; opacity: 0; visibility: hidden; transition: opacity 0.2s ease, visibility 0.2s ease; }',
    '.ct-modal-overlay--active { opacity: 1; visibility: visible; }',
    '.ct-modal { background: #fff; border-radius: var(--ct-radius-lg, 0.75rem); width: 90%; max-width: 32rem; max-height: 85vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15); transform: translateY(1rem); transition: transform 0.2s ease; }',
    '.ct-modal-overlay--active .ct-modal { transform: translateY(0); }',
    '.ct-modal__header { padding: 1.25rem; border-bottom: 1px solid #e5e7eb; display: flex; align-items: center; justify-content: space-between; }',
    '.ct-modal__title { font-size: var(--ct-font-size-lg, 1.25rem); font-weight: 700; margin: 0; }',
    '.ct-modal__close { background: none; border: none; cursor: pointer; padding: 0.25rem; color: #6b7280; font-size: 1.25rem; line-height: 1; }',
    '.ct-modal__close:hover { color: var(--ct-brand-neutral-dark, #1f2937); }',
    '.ct-modal__body { padding: 1.25rem; }',
    '.ct-modal__footer { padding: 1.25rem; border-top: 1px solid #e5e7eb; display: flex; justify-content: flex-end; gap: var(--ct-spacing-sm, 0.5rem); }'
  ].join('\n');

  /**
   * Injects component library styles into the document head.
   * @returns {void}
   */
  function inject() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  /**
   * Removes injected component library styles.
   * @returns {void}
   */
  function destroy() {
    var el = document.getElementById(STYLE_ID);
    if (el) {
      el.parentNode.removeChild(el);
    }
  }

  /**
   * Creates a button HTML string.
   * @param {string} text - Button label
   * @param {Object} [opts] - Options
   * @param {string} [opts.variant='primary'] - primary|secondary|ghost|danger
   * @param {string} [opts.size=''] - sm|lg or empty for default
   * @param {boolean} [opts.disabled=false] - Disabled state
   * @param {boolean} [opts.block=false] - Full width
   * @param {string} [opts.type='button'] - HTML button type
   * @returns {string} HTML string
   */
  function button(text, opts) {
    opts = opts || {};
    var variant = opts.variant || 'primary';
    var classes = ['ct-btn', 'ct-btn--' + variant];
    if (opts.size) { classes.push('ct-btn--' + opts.size); }
    if (opts.block) { classes.push('ct-btn--block'); }
    var disabled = opts.disabled ? ' disabled' : '';
    var type = opts.type || 'button';
    return '<button class="' + classes.join(' ') + '" type="' + type + '"' + disabled + '>' + text + '</button>';
  }

  /**
   * Creates an input group HTML string.
   * @param {Object} opts - Options
   * @param {string} [opts.label] - Label text
   * @param {string} [opts.type='text'] - Input type
   * @param {string} [opts.placeholder=''] - Placeholder
   * @param {string} [opts.hint] - Hint text
   * @param {string} [opts.error] - Error message
   * @param {string} [opts.name=''] - Input name attribute
   * @returns {string} HTML string
   */
  function input(opts) {
    opts = opts || {};
    var type = opts.type || 'text';
    var inputClass = 'ct-input' + (opts.error ? ' ct-input--error' : '');
    var parts = ['<div class="ct-input-group">'];
    if (opts.label) {
      parts.push('<label class="ct-input-label">' + opts.label + '</label>');
    }
    parts.push('<input class="' + inputClass + '" type="' + type + '" placeholder="' + (opts.placeholder || '') + '" name="' + (opts.name || '') + '">');
    if (opts.hint && !opts.error) {
      parts.push('<span class="ct-input-hint">' + opts.hint + '</span>');
    }
    if (opts.error) {
      parts.push('<span class="ct-input-error-msg">' + opts.error + '</span>');
    }
    parts.push('</div>');
    return parts.join('');
  }

  /**
   * Creates a card HTML string.
   * @param {Object} opts - Options
   * @param {string} [opts.header] - Header text
   * @param {string} opts.body - Body content (HTML)
   * @param {string} [opts.footer] - Footer content (HTML)
   * @param {boolean} [opts.hoverable=false] - Hoverable style
   * @returns {string} HTML string
   */
  function card(opts) {
    opts = opts || {};
    var classes = ['ct-card'];
    if (opts.hoverable) { classes.push('ct-card--hoverable'); }
    var parts = ['<div class="' + classes.join(' ') + '">'];
    if (opts.header) {
      parts.push('<div class="ct-card__header">' + opts.header + '</div>');
    }
    parts.push('<div class="ct-card__body">' + (opts.body || '') + '</div>');
    if (opts.footer) {
      parts.push('<div class="ct-card__footer">' + opts.footer + '</div>');
    }
    parts.push('</div>');
    return parts.join('');
  }

  /**
   * Creates and shows a modal. Returns a controller with close().
   * @param {Object} opts - Options
   * @param {string} opts.title - Modal title
   * @param {string} opts.body - Body content (HTML)
   * @param {string} [opts.footer] - Footer content (HTML)
   * @param {Function} [opts.onClose] - Callback when modal closes
   * @returns {{ close: Function, element: HTMLElement }}
   */
  function modal(opts) {
    opts = opts || {};
    var overlay = document.createElement('div');
    overlay.className = 'ct-modal-overlay';
    overlay.innerHTML =
      '<div class="ct-modal">' +
        '<div class="ct-modal__header">' +
          '<h2 class="ct-modal__title">' + (opts.title || '') + '</h2>' +
          '<button class="ct-modal__close" aria-label="Close">&times;</button>' +
        '</div>' +
        '<div class="ct-modal__body">' + (opts.body || '') + '</div>' +
        (opts.footer ? '<div class="ct-modal__footer">' + opts.footer + '</div>' : '') +
      '</div>';

    function close() {
      overlay.classList.remove('ct-modal-overlay--active');
      setTimeout(function () {
        if (overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
        if (typeof opts.onClose === 'function') {
          opts.onClose();
        }
      }, 200);
    }

    overlay.querySelector('.ct-modal__close').addEventListener('click', close);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) { close(); }
    });

    document.body.appendChild(overlay);
    requestAnimationFrame(function () {
      overlay.classList.add('ct-modal-overlay--active');
    });

    return { close: close, element: overlay };
  }

  inject();

  window.CortexFreelancer.UIComponentLibrary = {
    inject: inject,
    destroy: destroy,
    button: button,
    input: input,
    card: card,
    modal: modal
  };
})();
