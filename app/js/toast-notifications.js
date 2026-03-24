/**
 * CF-289: Toast Notification System
 * Reusable toast: success/error/warning/info variants with colors, icon,
 * auto-dismiss, stack positioning (top-right), max 5 visible, manual dismiss.
 *
 * @namespace window.CortexFreelancer.Toast
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  var STYLE_ID = 'cortex-toast-styles';
  var CONTAINER_ID = 'cortex-toast-container';
  var MAX_VISIBLE = 5;
  var DEFAULT_DURATION = 5000;

  var VARIANTS = {
    success: { bg: '#00B894', icon: '&#10003;', label: 'Success' },
    error:   { bg: '#FF7675', icon: '&#10007;', label: 'Error' },
    warning: { bg: '#FDCB6E', icon: '&#9888;',  label: 'Warning', color: '#2D3436' },
    info:    { bg: '#6C5CE7', icon: '&#8505;',  label: 'Info' }
  };

  var toasts = [];
  var counter = 0;

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '#' + CONTAINER_ID + '{position:fixed;top:16px;right:16px;z-index:999999;display:flex;flex-direction:column;gap:8px;pointer-events:none;max-width:400px;width:100%;}',
      '.cortex-toast{display:flex;align-items:center;gap:10px;padding:12px 16px;border-radius:8px;color:#fff;font-family:Inter,system-ui,sans-serif;font-size:14px;line-height:1.4;box-shadow:0 4px 12px rgba(0,0,0,.15);pointer-events:auto;animation:cortex-toast-in .3s ease forwards;position:relative;min-width:280px;}',
      '.cortex-toast.cortex-toast-out{animation:cortex-toast-out .25s ease forwards;}',
      '.cortex-toast-icon{font-size:18px;flex-shrink:0;width:24px;text-align:center;}',
      '.cortex-toast-msg{flex:1;}',
      '.cortex-toast-close{background:none;border:none;color:inherit;font-size:18px;cursor:pointer;padding:0 0 0 8px;opacity:.7;line-height:1;}',
      '.cortex-toast-close:hover{opacity:1;}',
      '@keyframes cortex-toast-in{from{opacity:0;transform:translateX(100%);}to{opacity:1;transform:translateX(0);}}',
      '@keyframes cortex-toast-out{from{opacity:1;transform:translateX(0);}to{opacity:0;transform:translateX(100%);}}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function getContainer() {
    var el = document.getElementById(CONTAINER_ID);
    if (!el) {
      el = document.createElement('div');
      el.id = CONTAINER_ID;
      el.setAttribute('aria-live', 'polite');
      el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    return el;
  }

  function removeToast(id) {
    var idx = -1;
    for (var i = 0; i < toasts.length; i++) {
      if (toasts[i].id === id) { idx = i; break; }
    }
    if (idx === -1) return;
    var entry = toasts[idx];
    if (entry.timer) clearTimeout(entry.timer);
    entry.el.classList.add('cortex-toast-out');
    setTimeout(function () {
      if (entry.el.parentNode) entry.el.parentNode.removeChild(entry.el);
    }, 260);
    toasts.splice(idx, 1);
  }

  function enforceMax() {
    while (toasts.length > MAX_VISIBLE) {
      removeToast(toasts[0].id);
    }
  }

  function showToast(message, type, options) {
    injectStyles();
    var container = getContainer();
    type = type || 'info';
    options = options || {};
    var variant = VARIANTS[type] || VARIANTS.info;
    var duration = options.duration !== undefined ? options.duration : DEFAULT_DURATION;

    var id = 'toast-' + (++counter);
    var el = document.createElement('div');
    el.className = 'cortex-toast';
    el.style.backgroundColor = variant.bg;
    if (variant.color) el.style.color = variant.color;
    el.setAttribute('role', 'alert');
    el.innerHTML =
      '<span class="cortex-toast-icon">' + variant.icon + '</span>' +
      '<span class="cortex-toast-msg">' + message + '</span>' +
      '<button class="cortex-toast-close" aria-label="Dismiss">&times;</button>';

    el.querySelector('.cortex-toast-close').addEventListener('click', function () {
      removeToast(id);
    });

    container.appendChild(el);

    var entry = { id: id, el: el, timer: null };
    if (duration > 0) {
      entry.timer = setTimeout(function () { removeToast(id); }, duration);
    }
    toasts.push(entry);
    enforceMax();

    return id;
  }

  function dismissAll() {
    var ids = toasts.map(function (t) { return t.id; });
    ids.forEach(function (id) { removeToast(id); });
  }

  window.CortexFreelancer.Toast = {
    show: showToast,
    success: function (msg, opts) { return showToast(msg, 'success', opts); },
    error:   function (msg, opts) { return showToast(msg, 'error', opts); },
    warning: function (msg, opts) { return showToast(msg, 'warning', opts); },
    info:    function (msg, opts) { return showToast(msg, 'info', opts); },
    dismiss: removeToast,
    dismissAll: dismissAll
  };

  // Global convenience
  window.CortexFreelancer.showToast = showToast;
})();
