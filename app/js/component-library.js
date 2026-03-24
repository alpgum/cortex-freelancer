/**
 * CF-282: Component Library
 * Reusable UI components: Button, Input, Card, Modal, Badge, Tooltip, Spinner.
 * Each returns HTML string.
 *
 * @namespace window.CortexFreelancer.ComponentLibrary
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  var STYLE_ID = 'cortex-component-library-styles';

  var CSS = '\n\
.ct-btn{display:inline-flex;align-items:center;gap:0.5rem;padding:0.5rem 1rem;border:none;border-radius:var(--ct-radius-md,0.5rem);font-size:0.875rem;font-weight:600;cursor:pointer;transition:all 0.15s ease;font-family:inherit;line-height:1.5}\
.ct-btn:focus-visible{outline:2px solid var(--ct-colors-primary-500,#6366f1);outline-offset:2px}\
.ct-btn--primary{background:var(--ct-colors-primary-600,#4f46e5);color:#fff}\
.ct-btn--primary:hover{background:var(--ct-colors-primary-700,#4338ca)}\
.ct-btn--secondary{background:var(--ct-colors-neutral-100,#f3f4f6);color:var(--ct-colors-neutral-800,#1f2937);border:1px solid var(--ct-colors-neutral-300,#d1d5db)}\
.ct-btn--secondary:hover{background:var(--ct-colors-neutral-200,#e5e7eb)}\
.ct-btn--ghost{background:transparent;color:var(--ct-colors-primary-600,#4f46e5)}\
.ct-btn--ghost:hover{background:var(--ct-colors-primary-50,#eef2ff)}\
.ct-btn--danger{background:var(--ct-colors-semantic-error,#ef4444);color:#fff}\
.ct-btn--danger:hover{background:#dc2626}\
.ct-btn--sm{padding:0.25rem 0.75rem;font-size:0.75rem}\
.ct-btn--lg{padding:0.75rem 1.5rem;font-size:1rem}\
.ct-btn:disabled{opacity:0.5;cursor:not-allowed}\
\
.ct-input{display:block;width:100%;padding:0.5rem 0.75rem;border:1px solid var(--ct-colors-neutral-300,#d1d5db);border-radius:var(--ct-radius-md,0.5rem);font-size:0.875rem;font-family:inherit;background:var(--ct-colors-neutral-0,#fff);color:var(--ct-colors-neutral-900,#111827);transition:border-color 0.15s}\
.ct-input:focus{outline:none;border-color:var(--ct-colors-primary-500,#6366f1);box-shadow:0 0 0 3px rgba(99,102,241,0.15)}\
.ct-input--error{border-color:var(--ct-colors-semantic-error,#ef4444)}\
.ct-input--error:focus{box-shadow:0 0 0 3px rgba(239,68,68,0.15)}\
.ct-input-group{display:flex;flex-direction:column;gap:0.25rem}\
.ct-input-label{font-size:0.875rem;font-weight:500;color:var(--ct-colors-neutral-700,#374151)}\
.ct-input-hint{font-size:0.75rem;color:var(--ct-colors-neutral-500,#6b7280)}\
.ct-input-error{font-size:0.75rem;color:var(--ct-colors-semantic-error,#ef4444)}\
\
.ct-card{background:var(--ct-colors-neutral-0,#fff);border:1px solid var(--ct-colors-neutral-200,#e5e7eb);border-radius:var(--ct-radius-lg,0.75rem);overflow:hidden}\
.ct-card__header{padding:1rem 1.25rem;border-bottom:1px solid var(--ct-colors-neutral-200,#e5e7eb);font-weight:600}\
.ct-card__body{padding:1.25rem}\
.ct-card__footer{padding:0.75rem 1.25rem;border-top:1px solid var(--ct-colors-neutral-200,#e5e7eb);background:var(--ct-colors-neutral-50,#f9fafb)}\
.ct-card--elevated{box-shadow:var(--ct-shadows-md,0 4px 6px -1px rgba(0,0,0,0.1))}\
\
.ct-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;opacity:0;transition:opacity 0.2s}\
.ct-modal-overlay--visible{opacity:1}\
.ct-modal{background:var(--ct-colors-neutral-0,#fff);border-radius:var(--ct-radius-xl,1rem);box-shadow:var(--ct-shadows-xl);width:90%;max-width:480px;max-height:85vh;overflow-y:auto;transform:scale(0.95);transition:transform 0.2s}\
.ct-modal-overlay--visible .ct-modal{transform:scale(1)}\
.ct-modal__header{display:flex;align-items:center;justify-content:space-between;padding:1rem 1.25rem;border-bottom:1px solid var(--ct-colors-neutral-200,#e5e7eb)}\
.ct-modal__title{font-size:1.125rem;font-weight:600;margin:0}\
.ct-modal__close{background:none;border:none;cursor:pointer;font-size:1.25rem;color:var(--ct-colors-neutral-400,#9ca3af);padding:0.25rem}\
.ct-modal__close:hover{color:var(--ct-colors-neutral-700,#374151)}\
.ct-modal__body{padding:1.25rem}\
.ct-modal__footer{padding:0.75rem 1.25rem;border-top:1px solid var(--ct-colors-neutral-200,#e5e7eb);display:flex;justify-content:flex-end;gap:0.5rem}\
\
.ct-badge{display:inline-flex;align-items:center;padding:0.125rem 0.625rem;border-radius:var(--ct-radius-full,9999px);font-size:0.75rem;font-weight:500;line-height:1.5}\
.ct-badge--default{background:var(--ct-colors-neutral-100,#f3f4f6);color:var(--ct-colors-neutral-700,#374151)}\
.ct-badge--primary{background:var(--ct-colors-primary-100,#e0e7ff);color:var(--ct-colors-primary-700,#4338ca)}\
.ct-badge--success{background:var(--ct-colors-semantic-success-light,#dcfce7);color:#15803d}\
.ct-badge--warning{background:var(--ct-colors-semantic-warning-light,#fef3c7);color:#92400e}\
.ct-badge--error{background:var(--ct-colors-semantic-error-light,#fee2e2);color:#b91c1c}\
\
.ct-tooltip-wrapper{position:relative;display:inline-block}\
.ct-tooltip{position:absolute;bottom:calc(100% + 6px);left:50%;transform:translateX(-50%);background:var(--ct-colors-neutral-800,#1f2937);color:#fff;padding:0.375rem 0.75rem;border-radius:var(--ct-radius-default,0.375rem);font-size:0.75rem;white-space:nowrap;pointer-events:none;opacity:0;transition:opacity 0.15s;z-index:50}\
.ct-tooltip::after{content:"";position:absolute;top:100%;left:50%;transform:translateX(-50%);border:5px solid transparent;border-top-color:var(--ct-colors-neutral-800,#1f2937)}\
.ct-tooltip-wrapper:hover .ct-tooltip{opacity:1}\
\
.ct-spinner{display:inline-block;border:3px solid var(--ct-colors-neutral-200,#e5e7eb);border-top-color:var(--ct-colors-primary-600,#4f46e5);border-radius:50%;animation:ct-spin 0.6s linear infinite}\
.ct-spinner--sm{width:16px;height:16px;border-width:2px}\
.ct-spinner--md{width:24px;height:24px}\
.ct-spinner--lg{width:40px;height:40px;border-width:4px}\
@keyframes ct-spin{to{transform:rotate(360deg)}}\
';

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function esc(str) {
    var el = document.createElement('span');
    el.textContent = str;
    return el.innerHTML;
  }

  function Button(opts) {
    opts = opts || {};
    var variant = opts.variant || 'primary';
    var size = opts.size ? ' ct-btn--' + opts.size : '';
    var disabled = opts.disabled ? ' disabled' : '';
    var cls = 'ct-btn ct-btn--' + variant + size;
    var attrs = opts.id ? ' id="' + esc(opts.id) + '"' : '';
    if (opts.onclick) attrs += ' onclick="' + esc(opts.onclick) + '"';
    return '<button class="' + cls + '"' + attrs + disabled + '>' + (opts.icon || '') + esc(opts.label || 'Button') + '</button>';
  }

  function Input(opts) {
    opts = opts || {};
    var type = opts.type || 'text';
    var errorCls = opts.error ? ' ct-input--error' : '';
    var html = '<div class="ct-input-group">';
    if (opts.label) html += '<label class="ct-input-label">' + esc(opts.label) + '</label>';
    if (type === 'textarea') {
      html += '<textarea class="ct-input' + errorCls + '" placeholder="' + esc(opts.placeholder || '') + '" rows="' + (opts.rows || 3) + '"></textarea>';
    } else if (type === 'select' && opts.options) {
      html += '<select class="ct-input' + errorCls + '">';
      opts.options.forEach(function (o) {
        html += '<option value="' + esc(o.value || o) + '">' + esc(o.label || o) + '</option>';
      });
      html += '</select>';
    } else {
      html += '<input class="ct-input' + errorCls + '" type="' + esc(type) + '" placeholder="' + esc(opts.placeholder || '') + '">';
    }
    if (opts.hint && !opts.error) html += '<span class="ct-input-hint">' + esc(opts.hint) + '</span>';
    if (opts.error) html += '<span class="ct-input-error">' + esc(opts.error) + '</span>';
    html += '</div>';
    return html;
  }

  function Card(opts) {
    opts = opts || {};
    var cls = 'ct-card' + (opts.elevated ? ' ct-card--elevated' : '');
    var html = '<div class="' + cls + '">';
    if (opts.header) html += '<div class="ct-card__header">' + opts.header + '</div>';
    html += '<div class="ct-card__body">' + (opts.body || '') + '</div>';
    if (opts.footer) html += '<div class="ct-card__footer">' + opts.footer + '</div>';
    html += '</div>';
    return html;
  }

  function Modal(opts) {
    opts = opts || {};
    var id = opts.id || 'ct-modal-' + Date.now();
    var html = '<div class="ct-modal-overlay" id="' + id + '-overlay">';
    html += '<div class="ct-modal">';
    html += '<div class="ct-modal__header">';
    html += '<h3 class="ct-modal__title">' + esc(opts.title || 'Modal') + '</h3>';
    html += '<button class="ct-modal__close" onclick="document.getElementById(\'' + id + '-overlay\').classList.remove(\'ct-modal-overlay--visible\')" aria-label="Close">&times;</button>';
    html += '</div>';
    html += '<div class="ct-modal__body">' + (opts.body || '') + '</div>';
    if (opts.footer) html += '<div class="ct-modal__footer">' + opts.footer + '</div>';
    html += '</div></div>';
    return html;
  }

  function Badge(opts) {
    opts = opts || {};
    var variant = opts.variant || 'default';
    return '<span class="ct-badge ct-badge--' + variant + '">' + esc(opts.label || 'Badge') + '</span>';
  }

  function Tooltip(opts) {
    opts = opts || {};
    return '<span class="ct-tooltip-wrapper">' + (opts.children || opts.label || '') +
      '<span class="ct-tooltip">' + esc(opts.text || 'Tooltip') + '</span></span>';
  }

  function Spinner(opts) {
    opts = opts || {};
    var size = opts.size || 'md';
    return '<span class="ct-spinner ct-spinner--' + size + '" role="status" aria-label="Loading"></span>';
  }

  function showModal(id) {
    var el = document.getElementById(id + '-overlay');
    if (el) el.classList.add('ct-modal-overlay--visible');
  }

  function renderComponentShowcase() {
    var html = '<div style="font-family:var(--ct-typography-font-family,sans-serif);padding:1.5rem;display:flex;flex-direction:column;gap:2rem">';

    // Buttons
    html += '<section><h3 style="font-weight:600;margin-bottom:0.75rem">Buttons</h3>';
    html += '<div style="display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center">';
    html += Button({ label: 'Primary', variant: 'primary' });
    html += Button({ label: 'Secondary', variant: 'secondary' });
    html += Button({ label: 'Ghost', variant: 'ghost' });
    html += Button({ label: 'Danger', variant: 'danger' });
    html += Button({ label: 'Small', variant: 'primary', size: 'sm' });
    html += Button({ label: 'Large', variant: 'primary', size: 'lg' });
    html += Button({ label: 'Disabled', variant: 'primary', disabled: true });
    html += '</div></section>';

    // Inputs
    html += '<section><h3 style="font-weight:600;margin-bottom:0.75rem">Inputs</h3>';
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:1rem">';
    html += Input({ label: 'Email', type: 'email', placeholder: 'you@example.com' });
    html += Input({ label: 'Password', type: 'password', placeholder: '********', hint: 'Min 8 characters' });
    html += Input({ label: 'With error', placeholder: 'Bad input', error: 'This field is required' });
    html += Input({ label: 'Select', type: 'select', options: ['Option A', 'Option B', 'Option C'] });
    html += '</div></section>';

    // Cards
    html += '<section><h3 style="font-weight:600;margin-bottom:0.75rem">Cards</h3>';
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:1rem">';
    html += Card({ header: 'Card Title', body: '<p style="margin:0;color:#6b7280">Card body content goes here.</p>', footer: Button({ label: 'Action', variant: 'primary', size: 'sm' }) });
    html += Card({ body: '<p style="margin:0"><strong>Elevated card</strong> with shadow.</p>', elevated: true });
    html += '</div></section>';

    // Badges
    html += '<section><h3 style="font-weight:600;margin-bottom:0.75rem">Badges</h3>';
    html += '<div style="display:flex;gap:0.5rem;flex-wrap:wrap">';
    ['default', 'primary', 'success', 'warning', 'error'].forEach(function (v) {
      html += Badge({ label: v.charAt(0).toUpperCase() + v.slice(1), variant: v });
    });
    html += '</div></section>';

    // Tooltip
    html += '<section><h3 style="font-weight:600;margin-bottom:0.75rem">Tooltip</h3>';
    html += Tooltip({ children: Button({ label: 'Hover me', variant: 'secondary' }), text: 'Hello from tooltip!' });
    html += '</section>';

    // Spinner
    html += '<section><h3 style="font-weight:600;margin-bottom:0.75rem">Spinners</h3>';
    html += '<div style="display:flex;gap:1rem;align-items:center">';
    html += Spinner({ size: 'sm' });
    html += Spinner({ size: 'md' });
    html += Spinner({ size: 'lg' });
    html += '</div></section>';

    html += '</div>';
    return html;
  }

  injectStyles();

  window.CortexFreelancer.ComponentLibrary = {
    Button: Button,
    Input: Input,
    Card: Card,
    Modal: Modal,
    Badge: Badge,
    Tooltip: Tooltip,
    Spinner: Spinner,
    showModal: showModal,
    renderComponentShowcase: renderComponentShowcase
  };
})();
