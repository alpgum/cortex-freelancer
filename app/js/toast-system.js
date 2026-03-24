/**
 * Cortex Freelancer — Toast Notification System
 * [CF-289] Reusable toast component with auto-dismiss and stacking.
 *
 * Features:
 *   - Four toast types: success (green), error (red), warning (yellow), info (blue)
 *   - Auto-dismiss with configurable duration
 *   - Manual dismiss via close button
 *   - Stacking with smooth slide animations
 *   - Position: top-right (configurable)
 *   - Maximum visible toasts with queue overflow
 *   - Progress bar for auto-dismiss countdown
 *   - Pause auto-dismiss on hover
 *   - Action button support (e.g., "Undo")
 *   - Accessible ARIA live region
 *   - init()/render(containerId) interface
 */

(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  // ─── Constants ────────────────────────────────────────────────────

  var CSS_PREFIX = 'cf-toast';
  var MAX_VISIBLE = 5;
  var DEFAULT_DURATION = 5000;

  var TYPES = {
    success: { color: '#00b894', bg: '#e6f9f3', icon: '✓', label: 'Success' },
    error: { color: '#d63031', bg: '#fde8e8', icon: '✕', label: 'Error' },
    warning: { color: '#e17055', bg: '#fef3e8', icon: '⚠', label: 'Warning' },
    info: { color: '#0984e3', bg: '#e8f4fd', icon: 'ℹ', label: 'Info' }
  };

  var POSITIONS = {
    'top-right': 'top:16px;right:16px',
    'top-left': 'top:16px;left:16px',
    'bottom-right': 'bottom:16px;right:16px',
    'bottom-left': 'bottom:16px;left:16px',
    'top-center': 'top:16px;left:50%;transform:translateX(-50%)',
    'bottom-center': 'bottom:16px;left:50%;transform:translateX(-50%)'
  };

  var _styleInjected = false;
  var _containerEl = null;
  var _toasts = [];
  var _queue = [];
  var _toastIdCounter = 0;
  var _position = 'top-right';

  // ─── Styles ───────────────────────────────────────────────────────

  function _injectStyles() {
    if (_styleInjected) return;
    _styleInjected = true;

    var css = [
      '@keyframes ' + CSS_PREFIX + '-slide-in {',
      '  from { opacity: 0; transform: translateX(100%); }',
      '  to { opacity: 1; transform: translateX(0); }',
      '}',
      '@keyframes ' + CSS_PREFIX + '-slide-out {',
      '  from { opacity: 1; transform: translateX(0); max-height: 200px; margin-bottom: 8px; }',
      '  to { opacity: 0; transform: translateX(100%); max-height: 0; margin-bottom: 0; }',
      '}',
      '',
      '.' + CSS_PREFIX + '-container {',
      '  position: fixed; z-index: 10000;',
      '  display: flex; flex-direction: column; gap: 0;',
      '  pointer-events: none; max-width: 400px; width: 100%;',
      '}',
      '',
      '.' + CSS_PREFIX + '-item {',
      '  display: flex; align-items: flex-start; gap: 10px;',
      '  padding: 14px 16px; border-radius: 10px;',
      '  box-shadow: 0 4px 16px rgba(0,0,0,0.1), 0 1px 3px rgba(0,0,0,0.06);',
      '  font-size: 13px; line-height: 1.4; position: relative;',
      '  pointer-events: auto; overflow: hidden; margin-bottom: 8px;',
      '  animation: ' + CSS_PREFIX + '-slide-in 0.3s ease;',
      '}',
      '',
      '.' + CSS_PREFIX + '-item--hiding {',
      '  animation: ' + CSS_PREFIX + '-slide-out 0.3s ease forwards;',
      '}',
      '',
      '.' + CSS_PREFIX + '-icon {',
      '  flex-shrink: 0; width: 22px; height: 22px;',
      '  border-radius: 50%; display: flex; align-items: center;',
      '  justify-content: center; font-size: 12px; font-weight: 700;',
      '  color: #fff;',
      '}',
      '',
      '.' + CSS_PREFIX + '-body { flex: 1; min-width: 0; }',
      '',
      '.' + CSS_PREFIX + '-title {',
      '  font-weight: 600; margin-bottom: 2px;',
      '}',
      '',
      '.' + CSS_PREFIX + '-message { color: #444; }',
      '',
      '.' + CSS_PREFIX + '-action {',
      '  background: none; border: none; cursor: pointer;',
      '  font-size: 12px; font-weight: 600; padding: 4px 8px;',
      '  border-radius: 4px; margin-top: 6px;',
      '  transition: background 0.15s;',
      '}',
      '.' + CSS_PREFIX + '-action:hover { background: rgba(0,0,0,0.05); }',
      '',
      '.' + CSS_PREFIX + '-close {',
      '  flex-shrink: 0; background: none; border: none;',
      '  cursor: pointer; font-size: 16px; color: #999;',
      '  padding: 0 2px; line-height: 1;',
      '}',
      '.' + CSS_PREFIX + '-close:hover { color: #555; }',
      '',
      '.' + CSS_PREFIX + '-progress {',
      '  position: absolute; bottom: 0; left: 0; height: 3px;',
      '  border-radius: 0 0 10px 10px; transition: width linear;',
      '}'
    ].join('\n');

    var style = document.createElement('style');
    style.setAttribute('data-cf', 'toast-system');
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ─── Helpers ──────────────────────────────────────────────────────

  function _el(tag, cls, attrs) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    if (attrs) {
      Object.keys(attrs).forEach(function (k) { el.setAttribute(k, attrs[k]); });
    }
    return el;
  }

  function _ensureContainer() {
    if (_containerEl && document.body.contains(_containerEl)) return;
    _containerEl = _el('div', CSS_PREFIX + '-container', {
      role: 'status',
      'aria-live': 'polite',
      'aria-relevant': 'additions',
      style: 'position:fixed;' + (POSITIONS[_position] || POSITIONS['top-right'])
    });
    document.body.appendChild(_containerEl);
  }

  function _processQueue() {
    while (_toasts.length < MAX_VISIBLE && _queue.length > 0) {
      var next = _queue.shift();
      _showToast(next);
    }
  }

  // ─── Toast Lifecycle ──────────────────────────────────────────────

  function _showToast(config) {
    _injectStyles();
    _ensureContainer();

    var id = ++_toastIdCounter;
    var type = TYPES[config.type] || TYPES.info;
    var duration = config.duration != null ? config.duration : DEFAULT_DURATION;

    var item = _el('div', CSS_PREFIX + '-item', {
      'data-toast-id': String(id),
      style: 'background:' + type.bg + ';border-left:3px solid ' + type.color
    });

    // Icon
    var icon = _el('span', CSS_PREFIX + '-icon', {
      'aria-hidden': 'true',
      style: 'background:' + type.color
    });
    icon.textContent = type.icon;
    item.appendChild(icon);

    // Body
    var body = _el('div', CSS_PREFIX + '-body');
    if (config.title) {
      var title = _el('div', CSS_PREFIX + '-title');
      title.textContent = config.title;
      title.style.color = type.color;
      body.appendChild(title);
    }
    var msg = _el('div', CSS_PREFIX + '-message');
    msg.textContent = config.message || '';
    body.appendChild(msg);

    // Action button
    if (config.actionText && config.onAction) {
      var action = _el('button', CSS_PREFIX + '-action', { type: 'button' });
      action.textContent = config.actionText;
      action.style.color = type.color;
      action.addEventListener('click', function () {
        config.onAction();
        _dismiss(id);
      });
      body.appendChild(action);
    }
    item.appendChild(body);

    // Close button
    var close = _el('button', CSS_PREFIX + '-close', {
      type: 'button', 'aria-label': 'Close notification'
    });
    close.textContent = '×';
    close.addEventListener('click', function () { _dismiss(id); });
    item.appendChild(close);

    // Progress bar
    var progressEl = null;
    if (duration > 0) {
      progressEl = _el('div', CSS_PREFIX + '-progress', {
        style: 'width:100%;background:' + type.color + ';opacity:0.3'
      });
      item.appendChild(progressEl);
    }

    _containerEl.appendChild(item);

    // Timer state
    var state = {
      id: id,
      el: item,
      config: config,
      timer: null,
      startTime: Date.now(),
      remaining: duration,
      progressEl: progressEl
    };
    _toasts.push(state);

    // Auto-dismiss
    if (duration > 0) {
      _startTimer(state);

      item.addEventListener('mouseenter', function () { _pauseTimer(state); });
      item.addEventListener('mouseleave', function () { _startTimer(state); });
    }

    return id;
  }

  function _startTimer(state) {
    if (state.remaining <= 0) return;
    state.startTime = Date.now();

    if (state.progressEl) {
      state.progressEl.style.transition = 'width ' + state.remaining + 'ms linear';
      // Force reflow for animation restart
      void state.progressEl.offsetWidth;
      state.progressEl.style.width = '0%';
    }

    state.timer = setTimeout(function () {
      _dismiss(state.id);
    }, state.remaining);
  }

  function _pauseTimer(state) {
    if (state.timer) {
      clearTimeout(state.timer);
      state.timer = null;
      var elapsed = Date.now() - state.startTime;
      state.remaining = Math.max(0, state.remaining - elapsed);

      if (state.progressEl) {
        var current = state.progressEl.getBoundingClientRect().width;
        var parent = state.progressEl.parentElement.getBoundingClientRect().width;
        var pct = parent > 0 ? (current / parent) * 100 : 0;
        state.progressEl.style.transition = 'none';
        state.progressEl.style.width = pct + '%';
      }
    }
  }

  function _dismiss(id) {
    var idx = -1;
    for (var i = 0; i < _toasts.length; i++) {
      if (_toasts[i].id === id) { idx = i; break; }
    }
    if (idx === -1) return;

    var state = _toasts[idx];
    if (state.timer) clearTimeout(state.timer);

    state.el.classList.add(CSS_PREFIX + '-item--hiding');
    setTimeout(function () {
      if (state.el.parentNode) state.el.parentNode.removeChild(state.el);
    }, 300);

    _toasts.splice(idx, 1);
    if (state.config.onClose) {
      try { state.config.onClose(); } catch (e) { /* noop */ }
    }

    _processQueue();
  }

  // ─── Public API ───────────────────────────────────────────────────

  /**
   * Show a toast notification.
   * @param {Object} opts
   * @param {string} opts.type - success|error|warning|info
   * @param {string} [opts.title] - Bold title text
   * @param {string} opts.message - Toast message
   * @param {number} [opts.duration=5000] - Auto-dismiss ms (0 = sticky)
   * @param {string} [opts.actionText] - Action button text
   * @param {Function} [opts.onAction] - Action button handler
   * @param {Function} [opts.onClose] - Called when toast is dismissed
   * @returns {number} Toast ID
   */
  function show(opts) {
    if (_toasts.length >= MAX_VISIBLE) {
      _queue.push(opts);
      return -1;
    }
    return _showToast(opts);
  }

  /** Shorthand: show success toast */
  function success(message, opts) {
    return show(Object.assign({ type: 'success', message: message }, opts || {}));
  }

  /** Shorthand: show error toast */
  function error(message, opts) {
    return show(Object.assign({ type: 'error', message: message, duration: 8000 }, opts || {}));
  }

  /** Shorthand: show warning toast */
  function warning(message, opts) {
    return show(Object.assign({ type: 'warning', message: message }, opts || {}));
  }

  /** Shorthand: show info toast */
  function info(message, opts) {
    return show(Object.assign({ type: 'info', message: message }, opts || {}));
  }

  /** Dismiss a specific toast by ID */
  function dismiss(id) { _dismiss(id); }

  /** Dismiss all visible toasts and clear the queue */
  function dismissAll() {
    _queue = [];
    _toasts.slice().forEach(function (t) { _dismiss(t.id); });
  }

  /**
   * Set toast position.
   * @param {string} pos - top-right|top-left|bottom-right|bottom-left|top-center|bottom-center
   */
  function setPosition(pos) {
    _position = pos;
    if (_containerEl) {
      _containerEl.style.cssText = 'position:fixed;' + (POSITIONS[pos] || POSITIONS['top-right']);
    }
  }

  window.CortexFreelancer.ToastSystem = {
    show: show,
    success: success,
    error: error,
    warning: warning,
    info: info,
    dismiss: dismiss,
    dismissAll: dismissAll,
    setPosition: setPosition,
    TYPES: Object.keys(TYPES),
    POSITIONS: Object.keys(POSITIONS),

    /** @param {Object} [opts] */
    init: function (opts) {
      _injectStyles();
      if (opts && opts.position) setPosition(opts.position);
    },

    /**
     * Render a demo panel with toast trigger buttons.
     * @param {string} containerId
     */
    render: function (containerId) {
      _injectStyles();
      var root = document.getElementById(containerId);
      if (!root) return;
      root.innerHTML = '';

      var h = _el('h2');
      h.textContent = 'Toast Notification System';
      h.style.cssText = 'margin:0 0 20px;font-size:20px;color:#2d3436';
      root.appendChild(h);

      var desc = _el('p');
      desc.textContent = 'Click buttons below to trigger toast notifications:';
      desc.style.cssText = 'margin:0 0 16px;font-size:14px;color:#636e72';
      root.appendChild(desc);

      var grid = _el('div', '', { style: 'display:flex;gap:12px;flex-wrap:wrap' });

      var demos = [
        { type: 'success', title: 'Saved!', msg: 'Your changes have been saved successfully.' },
        { type: 'error', title: 'Error', msg: 'Failed to submit proposal. Please try again.' },
        { type: 'warning', title: 'Warning', msg: 'Your session expires in 5 minutes.' },
        { type: 'info', title: 'Info', msg: 'New jobs matching your skills are available.' }
      ];

      demos.forEach(function (d) {
        var t = TYPES[d.type];
        var btn = _el('button', '', {
          type: 'button',
          style: 'padding:10px 20px;border-radius:8px;border:none;cursor:pointer;font-size:13px;font-weight:500;background:' + t.bg + ';color:' + t.color
        });
        btn.textContent = d.type.charAt(0).toUpperCase() + d.type.slice(1);
        btn.addEventListener('click', function () {
          show({ type: d.type, title: d.title, message: d.msg });
        });
        grid.appendChild(btn);
      });

      // With action
      var actionBtn = _el('button', '', {
        type: 'button',
        style: 'padding:10px 20px;border-radius:8px;border:1px solid #ddd;cursor:pointer;font-size:13px;background:#fff'
      });
      actionBtn.textContent = 'With Undo';
      actionBtn.addEventListener('click', function () {
        show({
          type: 'info',
          title: 'Deleted',
          message: 'Invoice #1042 has been deleted.',
          actionText: 'Undo',
          onAction: function () { success('Invoice restored.'); }
        });
      });
      grid.appendChild(actionBtn);

      // Dismiss all
      var clearBtn = _el('button', '', {
        type: 'button',
        style: 'padding:10px 20px;border-radius:8px;border:1px solid #ddd;cursor:pointer;font-size:13px;background:#fff'
      });
      clearBtn.textContent = 'Dismiss All';
      clearBtn.addEventListener('click', dismissAll);
      grid.appendChild(clearBtn);

      root.appendChild(grid);
    }
  };

})();
