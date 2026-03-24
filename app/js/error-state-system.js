/**
 * Cortex Freelancer — Error State System
 * [CF-288] Error UI components: inline errors, toast notifications, full-page error with retry.
 *
 * Features:
 *   - Inline error messages with icon and dismiss
 *   - Full-page error state with illustration, message, and retry button
 *   - Error boundary wrapper for async operations
 *   - Error severity levels: info, warning, error, critical
 *   - Auto-report hook for error tracking integration
 *   - Recovery action buttons (retry, go back, contact support)
 *   - Accessible ARIA roles and live regions
 *   - init()/render(containerId) interface
 */

(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  // ─── Constants ────────────────────────────────────────────────────

  var CSS_PREFIX = 'cf-error';
  var _styleInjected = false;
  var _errorLog = [];
  var _onErrorCallback = null;

  var SEVERITY = {
    info: { color: '#0984e3', bg: '#e8f4fd', icon: 'ℹ', label: 'Info' },
    warning: { color: '#e17055', bg: '#fef3e8', icon: '⚠', label: 'Warning' },
    error: { color: '#d63031', bg: '#fde8e8', icon: '✕', label: 'Error' },
    critical: { color: '#c0392b', bg: '#f9d6d6', icon: '⛔', label: 'Critical Error' }
  };

  var ERROR_ILLUSTRATION = [
    '<svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">',
    '<circle cx="60" cy="60" r="44" fill="#fde8e8" stroke="#d63031" stroke-width="2" opacity="0.6"/>',
    '<line x1="44" y1="44" x2="76" y2="76" stroke="#d63031" stroke-width="3" stroke-linecap="round"/>',
    '<line x1="76" y1="44" x2="44" y2="76" stroke="#d63031" stroke-width="3" stroke-linecap="round"/>',
    '</svg>'
  ].join('');

  var NETWORK_ILLUSTRATION = [
    '<svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">',
    '<path d="M30 60a30 30 0 0160 0" stroke="#d63031" stroke-width="2.5" fill="none" opacity="0.5"/>',
    '<path d="M42 72a16 16 0 0136 0" stroke="#d63031" stroke-width="2.5" fill="none" opacity="0.5"/>',
    '<circle cx="60" cy="88" r="4" fill="#d63031" opacity="0.5"/>',
    '<line x1="30" y1="30" x2="90" y2="90" stroke="#d63031" stroke-width="2.5" stroke-linecap="round"/>',
    '</svg>'
  ].join('');

  // ─── Styles ───────────────────────────────────────────────────────

  function _injectStyles() {
    if (_styleInjected) return;
    _styleInjected = true;

    var css = [
      '.' + CSS_PREFIX + '-inline {',
      '  display: flex; align-items: flex-start; gap: 10px;',
      '  padding: 12px 16px; border-radius: 8px; margin: 8px 0;',
      '  font-size: 13px; line-height: 1.5; position: relative;',
      '}',
      '',
      '.' + CSS_PREFIX + '-inline-icon {',
      '  flex-shrink: 0; font-size: 16px; line-height: 1.3;',
      '}',
      '',
      '.' + CSS_PREFIX + '-inline-content { flex: 1; }',
      '',
      '.' + CSS_PREFIX + '-inline-title {',
      '  font-weight: 600; margin-bottom: 2px;',
      '}',
      '',
      '.' + CSS_PREFIX + '-inline-dismiss {',
      '  position: absolute; top: 8px; right: 10px;',
      '  background: none; border: none; cursor: pointer;',
      '  font-size: 16px; color: inherit; opacity: 0.5;',
      '  padding: 2px 6px; border-radius: 4px;',
      '}',
      '.' + CSS_PREFIX + '-inline-dismiss:hover { opacity: 0.8; }',
      '',
      '.' + CSS_PREFIX + '-full-page {',
      '  display: flex; flex-direction: column; align-items: center;',
      '  justify-content: center; text-align: center;',
      '  padding: 60px 24px; max-width: 480px; margin: 0 auto;',
      '}',
      '',
      '.' + CSS_PREFIX + '-illustration {',
      '  width: 120px; height: 120px; margin-bottom: 24px;',
      '}',
      '.' + CSS_PREFIX + '-illustration svg { width: 100%; height: 100%; }',
      '',
      '.' + CSS_PREFIX + '-title {',
      '  font-size: 20px; font-weight: 600; color: #2d3436;',
      '  margin: 0 0 8px;',
      '}',
      '',
      '.' + CSS_PREFIX + '-message {',
      '  font-size: 14px; color: #636e72; line-height: 1.5;',
      '  margin: 0 0 24px;',
      '}',
      '',
      '.' + CSS_PREFIX + '-code {',
      '  font-family: monospace; font-size: 12px; color: #888;',
      '  background: #f8f8f8; padding: 8px 14px; border-radius: 6px;',
      '  margin-bottom: 24px; max-width: 100%; overflow-x: auto;',
      '}',
      '',
      '.' + CSS_PREFIX + '-actions {',
      '  display: flex; gap: 12px; flex-wrap: wrap; justify-content: center;',
      '}',
      '',
      '.' + CSS_PREFIX + '-btn {',
      '  padding: 10px 24px; border-radius: 8px; font-size: 14px;',
      '  font-weight: 500; cursor: pointer; border: none;',
      '  transition: background 0.2s, transform 0.1s;',
      '}',
      '.' + CSS_PREFIX + '-btn:active { transform: scale(0.97); }',
      '.' + CSS_PREFIX + '-btn:focus-visible {',
      '  outline: 2px solid #6c5ce7; outline-offset: 2px;',
      '}',
      '',
      '.' + CSS_PREFIX + '-btn--primary {',
      '  background: #6c5ce7; color: #fff;',
      '}',
      '.' + CSS_PREFIX + '-btn--primary:hover { background: #5a4bd1; }',
      '',
      '.' + CSS_PREFIX + '-btn--secondary {',
      '  background: #f0f0f0; color: #2d3436;',
      '}',
      '.' + CSS_PREFIX + '-btn--secondary:hover { background: #e4e4e4; }',
      '',
      '.' + CSS_PREFIX + '-details-toggle {',
      '  font-size: 12px; color: #888; cursor: pointer;',
      '  background: none; border: none; margin-top: 16px;',
      '  text-decoration: underline;',
      '}',
      '',
      '.' + CSS_PREFIX + '-details {',
      '  font-family: monospace; font-size: 11px; color: #888;',
      '  background: #f8f8f8; padding: 12px; border-radius: 6px;',
      '  margin-top: 8px; text-align: left; max-height: 200px;',
      '  overflow-y: auto; white-space: pre-wrap; word-break: break-all;',
      '  display: none;',
      '}',
      '.' + CSS_PREFIX + '-details--visible { display: block; }'
    ].join('\n');

    var style = document.createElement('style');
    style.setAttribute('data-cf', 'error-state-system');
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

  function _logError(entry) {
    entry.timestamp = new Date().toISOString();
    _errorLog.push(entry);
    if (_errorLog.length > 100) _errorLog.shift();
    if (_onErrorCallback) {
      try { _onErrorCallback(entry); } catch (e) { /* noop */ }
    }
  }

  // ─── Inline Error ─────────────────────────────────────────────────

  /**
   * Create an inline error message element.
   * @param {Object} opts
   * @param {string} [opts.severity='error'] - info|warning|error|critical
   * @param {string} [opts.title] - Optional bold title
   * @param {string} opts.message - Error message text
   * @param {boolean} [opts.dismissible=true]
   * @param {Function} [opts.onDismiss]
   * @returns {HTMLElement}
   */
  function createInline(opts) {
    _injectStyles();
    opts = opts || {};
    var sev = SEVERITY[opts.severity] || SEVERITY.error;

    var wrap = _el('div', CSS_PREFIX + '-inline', {
      role: 'alert',
      style: 'background:' + sev.bg + ';color:' + sev.color + ';border-left:3px solid ' + sev.color
    });

    var icon = _el('span', CSS_PREFIX + '-inline-icon', { 'aria-hidden': 'true' });
    icon.textContent = sev.icon;
    wrap.appendChild(icon);

    var content = _el('div', CSS_PREFIX + '-inline-content');
    if (opts.title) {
      var title = _el('div', CSS_PREFIX + '-inline-title');
      title.textContent = opts.title;
      content.appendChild(title);
    }
    var msg = _el('div');
    msg.textContent = opts.message || 'An error occurred.';
    content.appendChild(msg);
    wrap.appendChild(content);

    if (opts.dismissible !== false) {
      var dismiss = _el('button', CSS_PREFIX + '-inline-dismiss', {
        type: 'button', 'aria-label': 'Dismiss', title: 'Dismiss'
      });
      dismiss.textContent = '×';
      dismiss.addEventListener('click', function () {
        wrap.style.opacity = '0';
        wrap.style.transition = 'opacity 0.2s';
        setTimeout(function () {
          if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
          if (opts.onDismiss) opts.onDismiss();
        }, 200);
      });
      wrap.appendChild(dismiss);
    }

    _logError({ type: 'inline', severity: opts.severity || 'error', message: opts.message });
    return wrap;
  }

  // ─── Full-Page Error ──────────────────────────────────────────────

  /**
   * Create a full-page error state element.
   * @param {Object} opts
   * @param {string} [opts.title='Something went wrong']
   * @param {string} [opts.message]
   * @param {string} [opts.errorCode] - Technical error code
   * @param {string} [opts.details] - Stack trace or detailed info
   * @param {string} [opts.illustration] - 'error'|'network' or custom SVG
   * @param {Array<{label:string, action:Function, primary:boolean}>} [opts.actions]
   * @returns {HTMLElement}
   */
  function createFullPage(opts) {
    _injectStyles();
    opts = opts || {};

    var container = _el('div', CSS_PREFIX + '-full-page', { role: 'alert' });

    // Illustration
    var illWrap = _el('div', CSS_PREFIX + '-illustration', { 'aria-hidden': 'true' });
    var illSvg = opts.illustration === 'network' ? NETWORK_ILLUSTRATION :
      (opts.illustration && opts.illustration.indexOf('<svg') === 0) ? opts.illustration : ERROR_ILLUSTRATION;
    illWrap.innerHTML = illSvg;
    container.appendChild(illWrap);

    // Title
    var title = _el('h2', CSS_PREFIX + '-title');
    title.textContent = opts.title || 'Something went wrong';
    container.appendChild(title);

    // Message
    var msg = _el('p', CSS_PREFIX + '-message');
    msg.textContent = opts.message || 'An unexpected error occurred. Please try again.';
    container.appendChild(msg);

    // Error code
    if (opts.errorCode) {
      var code = _el('div', CSS_PREFIX + '-code');
      code.textContent = 'Error: ' + opts.errorCode;
      container.appendChild(code);
    }

    // Actions
    var actions = opts.actions || [
      { label: 'Try Again', action: function () { window.location.reload(); }, primary: true },
      { label: 'Go Back', action: function () { window.history.back(); }, primary: false }
    ];

    var actWrap = _el('div', CSS_PREFIX + '-actions');
    actions.forEach(function (act) {
      var btn = _el('button', CSS_PREFIX + '-btn ' + CSS_PREFIX + '-btn--' + (act.primary ? 'primary' : 'secondary'),
        { type: 'button' });
      btn.textContent = act.label;
      btn.addEventListener('click', act.action);
      actWrap.appendChild(btn);
    });
    container.appendChild(actWrap);

    // Details toggle
    if (opts.details) {
      var toggle = _el('button', CSS_PREFIX + '-details-toggle', { type: 'button' });
      toggle.textContent = 'Show technical details';
      var details = _el('div', CSS_PREFIX + '-details');
      details.textContent = opts.details;
      toggle.addEventListener('click', function () {
        var visible = details.classList.toggle(CSS_PREFIX + '-details--visible');
        toggle.textContent = visible ? 'Hide technical details' : 'Show technical details';
      });
      container.appendChild(toggle);
      container.appendChild(details);
    }

    _logError({ type: 'full-page', title: opts.title, message: opts.message, errorCode: opts.errorCode });
    return container;
  }

  // ─── Error Boundary ───────────────────────────────────────────────

  /**
   * Wrap an async operation with error UI fallback.
   * @param {string|HTMLElement} container - Where to show error on failure
   * @param {Function} asyncFn - Async function to execute
   * @param {Object} [opts] - Options for error display
   * @returns {Promise<*>}
   */
  function withErrorBoundary(container, asyncFn, opts) {
    opts = opts || {};
    var el = typeof container === 'string' ? document.querySelector(container) : container;

    return Promise.resolve().then(function () {
      return asyncFn();
    }).catch(function (err) {
      if (!el) throw err;

      var errEl = createFullPage({
        title: opts.title || 'Failed to load',
        message: err.message || 'An unexpected error occurred.',
        errorCode: err.code || err.status || null,
        details: err.stack || null,
        illustration: (err.message && err.message.toLowerCase().indexOf('network') >= 0) ? 'network' : 'error',
        actions: [
          {
            label: 'Retry',
            primary: true,
            action: function () {
              el.innerHTML = '';
              withErrorBoundary(el, asyncFn, opts);
            }
          },
          { label: 'Go Back', primary: false, action: function () { window.history.back(); } }
        ]
      });

      el.innerHTML = '';
      el.appendChild(errEl);
    });
  }

  /**
   * Show an inline error inside a container.
   * @param {string|HTMLElement} container
   * @param {Object} opts - Same as createInline()
   * @returns {HTMLElement}
   */
  function showInline(container, opts) {
    var el = typeof container === 'string' ? document.querySelector(container) : container;
    if (!el) return null;
    var err = createInline(opts);
    el.prepend ? el.prepend(err) : el.insertBefore(err, el.firstChild);
    return err;
  }

  // ─── Public API ───────────────────────────────────────────────────

  window.CortexFreelancer.ErrorStateSystem = {
    createInline: createInline,
    createFullPage: createFullPage,
    showInline: showInline,
    withErrorBoundary: withErrorBoundary,
    SEVERITIES: Object.keys(SEVERITY),

    /**
     * Register a callback for error tracking.
     * @param {Function} cb - Called with error entry object
     */
    onError: function (cb) { _onErrorCallback = cb; },

    /** @returns {Array} Recent error log entries */
    getErrorLog: function () { return _errorLog.slice(); },

    /** @param {Object} [opts] */
    init: function (opts) {
      _injectStyles();
    },

    /**
     * Render a demo of all error states.
     * @param {string} containerId
     */
    render: function (containerId) {
      _injectStyles();
      var root = document.getElementById(containerId);
      if (!root) return;
      root.innerHTML = '';

      var h = _el('h2');
      h.textContent = 'Error State System';
      h.style.cssText = 'margin:0 0 20px;font-size:20px;color:#2d3436';
      root.appendChild(h);

      var secTitle = function (t) {
        var s = _el('h3'); s.textContent = t;
        s.style.cssText = 'margin:20px 0 10px;font-size:15px;color:#636e72';
        return s;
      };

      // Inline errors
      root.appendChild(secTitle('Inline Errors'));
      Object.keys(SEVERITY).forEach(function (sev) {
        root.appendChild(createInline({
          severity: sev,
          title: SEVERITY[sev].label,
          message: 'This is a sample ' + sev + ' message for demonstration purposes.'
        }));
      });

      // Full page error
      root.appendChild(secTitle('Full Page Error'));
      var demo = _el('div', '', {
        style: 'border:1px solid #eee;border-radius:10px;overflow:hidden;margin-bottom:16px'
      });
      demo.appendChild(createFullPage({
        title: 'Something went wrong',
        message: 'We couldn\'t load your project data. Please try again.',
        errorCode: 'ERR_FETCH_PROJECTS_500',
        details: 'TypeError: Failed to fetch\n  at ProjectService.loadAll (project-service.js:42)\n  at Dashboard.init (dashboard.js:15)'
      }));
      root.appendChild(demo);

      // Network error
      root.appendChild(secTitle('Network Error'));
      var netDemo = _el('div', '', {
        style: 'border:1px solid #eee;border-radius:10px;overflow:hidden'
      });
      netDemo.appendChild(createFullPage({
        title: 'Connection lost',
        message: 'Unable to reach the server. Check your internet connection.',
        illustration: 'network',
        actions: [
          { label: 'Retry Connection', primary: true, action: function () {} },
          { label: 'Work Offline', primary: false, action: function () {} }
        ]
      }));
      root.appendChild(netDemo);
    }
  };

})();
