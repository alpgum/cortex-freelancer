/**
 * Cortex Freelancer — Loading State System
 * [CF-286] Skeleton screens, spinners, and progress indicators for async operations.
 *
 * Features:
 *   - Skeleton screen generator for cards, lists, tables, profiles
 *   - Configurable spinner component (size, color, label)
 *   - Determinate & indeterminate progress bars
 *   - Page transition overlay with fade animation
 *   - Inline loading placeholders for tool panels
 *   - Shimmer animation on skeleton elements
 *   - Auto-timeout with fallback message
 *   - Accessible ARIA live regions for screen readers
 *   - init()/render(containerId) interface
 */

(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  // ─── Constants ────────────────────────────────────────────────────

  var CSS_PREFIX = 'cf-loading';
  var DEFAULT_TIMEOUT_MS = 30000;
  var SHIMMER_DURATION = '1.5s';

  var SKELETON_TYPES = {
    card: { width: '100%', height: '180px', rows: 3 },
    list: { width: '100%', height: '48px', rows: 5 },
    table: { width: '100%', height: '40px', rows: 8, cols: 4 },
    profile: { avatar: true, rows: 2 },
    text: { width: '100%', height: '16px', rows: 4 },
    chart: { width: '100%', height: '240px', rows: 0 },
    toolbar: { width: '100%', height: '48px', rows: 0 }
  };

  var SPINNER_SIZES = { sm: 20, md: 36, lg: 56, xl: 80 };

  var _styleInjected = false;
  var _activeLoaders = {};
  var _loaderIdCounter = 0;

  // ─── Styles ───────────────────────────────────────────────────────

  function _injectStyles() {
    if (_styleInjected) return;
    _styleInjected = true;

    var css = [
      '@keyframes ' + CSS_PREFIX + '-shimmer {',
      '  0% { background-position: -400px 0; }',
      '  100% { background-position: 400px 0; }',
      '}',
      '@keyframes ' + CSS_PREFIX + '-spin {',
      '  0% { transform: rotate(0deg); }',
      '  100% { transform: rotate(360deg); }',
      '}',
      '@keyframes ' + CSS_PREFIX + '-progress-indeterminate {',
      '  0% { transform: translateX(-100%); }',
      '  100% { transform: translateX(400%); }',
      '}',
      '@keyframes ' + CSS_PREFIX + '-fade-in {',
      '  from { opacity: 0; } to { opacity: 1; }',
      '}',
      '@keyframes ' + CSS_PREFIX + '-fade-out {',
      '  from { opacity: 1; } to { opacity: 0; }',
      '}',
      '',
      '.' + CSS_PREFIX + '-skeleton {',
      '  background: linear-gradient(90deg, #e8e8e8 25%, #f5f5f5 50%, #e8e8e8 75%);',
      '  background-size: 800px 100%;',
      '  animation: ' + CSS_PREFIX + '-shimmer ' + SHIMMER_DURATION + ' infinite linear;',
      '  border-radius: 6px;',
      '}',
      '',
      '.' + CSS_PREFIX + '-skeleton-row {',
      '  height: 16px;',
      '  margin-bottom: 10px;',
      '  border-radius: 4px;',
      '}',
      '',
      '.' + CSS_PREFIX + '-skeleton-avatar {',
      '  width: 48px; height: 48px; border-radius: 50%;',
      '  margin-right: 12px; flex-shrink: 0;',
      '}',
      '',
      '.' + CSS_PREFIX + '-skeleton-card {',
      '  padding: 20px; border-radius: 10px;',
      '  border: 1px solid #eee; margin-bottom: 16px;',
      '}',
      '',
      '.' + CSS_PREFIX + '-skeleton-table-cell {',
      '  height: 14px; border-radius: 3px;',
      '  flex: 1; margin: 0 6px;',
      '}',
      '',
      '.' + CSS_PREFIX + '-skeleton-table-row {',
      '  display: flex; align-items: center;',
      '  padding: 12px 0; border-bottom: 1px solid #f0f0f0;',
      '}',
      '',
      '.' + CSS_PREFIX + '-spinner-wrap {',
      '  display: inline-flex; flex-direction: column;',
      '  align-items: center; gap: 10px;',
      '}',
      '',
      '.' + CSS_PREFIX + '-spinner {',
      '  border: 3px solid #e8e8e8;',
      '  border-top-color: #6c5ce7;',
      '  border-radius: 50%;',
      '  animation: ' + CSS_PREFIX + '-spin 0.7s linear infinite;',
      '}',
      '',
      '.' + CSS_PREFIX + '-spinner-label {',
      '  font-size: 13px; color: #666; font-family: inherit;',
      '}',
      '',
      '.' + CSS_PREFIX + '-progress-track {',
      '  width: 100%; height: 6px; background: #e8e8e8;',
      '  border-radius: 3px; overflow: hidden; position: relative;',
      '}',
      '',
      '.' + CSS_PREFIX + '-progress-bar {',
      '  height: 100%; background: #6c5ce7;',
      '  border-radius: 3px; transition: width 0.3s ease;',
      '}',
      '',
      '.' + CSS_PREFIX + '-progress-bar--indeterminate {',
      '  width: 30%; position: absolute;',
      '  animation: ' + CSS_PREFIX + '-progress-indeterminate 1.5s infinite ease-in-out;',
      '}',
      '',
      '.' + CSS_PREFIX + '-progress-label {',
      '  font-size: 12px; color: #888; margin-top: 6px; text-align: right;',
      '}',
      '',
      '.' + CSS_PREFIX + '-overlay {',
      '  position: fixed; inset: 0; z-index: 9990;',
      '  background: rgba(255,255,255,0.85);',
      '  display: flex; align-items: center; justify-content: center;',
      '  flex-direction: column; gap: 16px;',
      '  animation: ' + CSS_PREFIX + '-fade-in 0.2s ease;',
      '}',
      '',
      '.' + CSS_PREFIX + '-overlay--hiding {',
      '  animation: ' + CSS_PREFIX + '-fade-out 0.2s ease forwards;',
      '}',
      '',
      '.' + CSS_PREFIX + '-timeout-msg {',
      '  font-size: 13px; color: #e17055; margin-top: 8px;',
      '  animation: ' + CSS_PREFIX + '-fade-in 0.3s ease;',
      '}',
      '',
      '.' + CSS_PREFIX + '-inline {',
      '  display: flex; align-items: center; gap: 8px;',
      '  padding: 12px; color: #666; font-size: 13px;',
      '}'
    ].join('\n');

    var style = document.createElement('style');
    style.setAttribute('data-cf', 'loading-state-system');
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

  function _genId() {
    return CSS_PREFIX + '-' + (++_loaderIdCounter);
  }

  // ─── Skeleton Builder ─────────────────────────────────────────────

  /**
   * Create a skeleton screen element.
   * @param {string} type - One of: card, list, table, profile, text, chart, toolbar
   * @param {Object} [opts] - Override rows, cols, count (number of repeated groups)
   * @returns {HTMLElement}
   */
  function createSkeleton(type, opts) {
    _injectStyles();
    opts = opts || {};
    var cfg = SKELETON_TYPES[type] || SKELETON_TYPES.text;
    var rows = opts.rows != null ? opts.rows : cfg.rows;
    var count = opts.count || 1;
    var wrap = _el('div', '', { role: 'status', 'aria-label': 'Loading content' });
    var sr = _el('span', '', { style: 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)' });
    sr.textContent = 'Loading…';
    wrap.appendChild(sr);

    for (var c = 0; c < count; c++) {
      if (type === 'card') {
        var card = _el('div', CSS_PREFIX + '-skeleton-card');
        var header = _el('div', CSS_PREFIX + '-skeleton ' + CSS_PREFIX + '-skeleton-row',
          { style: 'width:60%;height:20px;margin-bottom:16px' });
        card.appendChild(header);
        for (var i = 0; i < rows; i++) {
          var row = _el('div', CSS_PREFIX + '-skeleton ' + CSS_PREFIX + '-skeleton-row',
            { style: 'width:' + (90 - i * 15) + '%' });
          card.appendChild(row);
        }
        wrap.appendChild(card);
      } else if (type === 'list') {
        for (var i = 0; i < rows; i++) {
          var li = _el('div', '', { style: 'display:flex;align-items:center;padding:10px 0;border-bottom:1px solid #f0f0f0' });
          var av = _el('div', CSS_PREFIX + '-skeleton ' + CSS_PREFIX + '-skeleton-avatar',
            { style: 'width:36px;height:36px' });
          var txt = _el('div', '', { style: 'flex:1' });
          var t1 = _el('div', CSS_PREFIX + '-skeleton ' + CSS_PREFIX + '-skeleton-row',
            { style: 'width:' + (50 + Math.random() * 30) + '%;height:14px;margin-bottom:6px' });
          var t2 = _el('div', CSS_PREFIX + '-skeleton ' + CSS_PREFIX + '-skeleton-row',
            { style: 'width:' + (30 + Math.random() * 20) + '%;height:12px;margin-bottom:0' });
          txt.appendChild(t1); txt.appendChild(t2);
          li.appendChild(av); li.appendChild(txt);
          wrap.appendChild(li);
        }
      } else if (type === 'table') {
        var cols = opts.cols || cfg.cols;
        for (var i = 0; i < rows; i++) {
          var tr = _el('div', CSS_PREFIX + '-skeleton-table-row');
          for (var j = 0; j < cols; j++) {
            var td = _el('div', CSS_PREFIX + '-skeleton ' + CSS_PREFIX + '-skeleton-table-cell');
            tr.appendChild(td);
          }
          wrap.appendChild(tr);
        }
      } else if (type === 'profile') {
        var pWrap = _el('div', '', { style: 'display:flex;align-items:flex-start;gap:12px' });
        pWrap.appendChild(_el('div', CSS_PREFIX + '-skeleton ' + CSS_PREFIX + '-skeleton-avatar'));
        var pText = _el('div', '', { style: 'flex:1' });
        pText.appendChild(_el('div', CSS_PREFIX + '-skeleton ' + CSS_PREFIX + '-skeleton-row',
          { style: 'width:40%;height:18px;margin-bottom:10px' }));
        pText.appendChild(_el('div', CSS_PREFIX + '-skeleton ' + CSS_PREFIX + '-skeleton-row',
          { style: 'width:65%;height:13px' }));
        pWrap.appendChild(pText);
        wrap.appendChild(pWrap);
      } else if (type === 'chart') {
        wrap.appendChild(_el('div', CSS_PREFIX + '-skeleton',
          { style: 'width:100%;height:' + cfg.height + ';border-radius:8px' }));
      } else if (type === 'toolbar') {
        var tb = _el('div', '', { style: 'display:flex;gap:12px;align-items:center' });
        for (var i = 0; i < 4; i++) {
          tb.appendChild(_el('div', CSS_PREFIX + '-skeleton',
            { style: 'width:' + (60 + Math.random() * 40) + 'px;height:32px;border-radius:6px' }));
        }
        wrap.appendChild(tb);
      } else {
        for (var i = 0; i < rows; i++) {
          wrap.appendChild(_el('div', CSS_PREFIX + '-skeleton ' + CSS_PREFIX + '-skeleton-row',
            { style: 'width:' + (70 + Math.random() * 30) + '%' }));
        }
      }
    }
    return wrap;
  }

  // ─── Spinner ──────────────────────────────────────────────────────

  /**
   * Create a spinner element.
   * @param {Object} [opts]
   * @param {string} [opts.size='md'] - sm|md|lg|xl
   * @param {string} [opts.color='#6c5ce7']
   * @param {string} [opts.label] - Optional label text below spinner
   * @returns {HTMLElement}
   */
  function createSpinner(opts) {
    _injectStyles();
    opts = opts || {};
    var size = SPINNER_SIZES[opts.size] || SPINNER_SIZES.md;
    var color = opts.color || '#6c5ce7';

    var wrap = _el('div', CSS_PREFIX + '-spinner-wrap', { role: 'status', 'aria-label': opts.label || 'Loading' });
    var ring = _el('div', CSS_PREFIX + '-spinner',
      { style: 'width:' + size + 'px;height:' + size + 'px;border-top-color:' + color });
    wrap.appendChild(ring);

    if (opts.label) {
      var lbl = _el('span', CSS_PREFIX + '-spinner-label');
      lbl.textContent = opts.label;
      wrap.appendChild(lbl);
    }

    var sr = _el('span', '', { style: 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)' });
    sr.textContent = opts.label || 'Loading…';
    wrap.appendChild(sr);

    return wrap;
  }

  // ─── Progress Bar ─────────────────────────────────────────────────

  /**
   * Create a progress bar.
   * @param {Object} [opts]
   * @param {number} [opts.value] - 0-100, omit for indeterminate
   * @param {string} [opts.color='#6c5ce7']
   * @param {boolean} [opts.showLabel=true]
   * @returns {{ el: HTMLElement, update: function(number): void }}
   */
  function createProgressBar(opts) {
    _injectStyles();
    opts = opts || {};
    var color = opts.color || '#6c5ce7';
    var indeterminate = opts.value == null;
    var showLabel = opts.showLabel !== false;

    var wrap = _el('div', '', { role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100' });
    var track = _el('div', CSS_PREFIX + '-progress-track');
    var bar = _el('div',
      CSS_PREFIX + '-progress-bar' + (indeterminate ? ' ' + CSS_PREFIX + '-progress-bar--indeterminate' : ''),
      { style: 'background:' + color + (!indeterminate ? ';width:' + (opts.value || 0) + '%' : '') });
    track.appendChild(bar);
    wrap.appendChild(track);

    var label = null;
    if (showLabel && !indeterminate) {
      label = _el('div', CSS_PREFIX + '-progress-label');
      label.textContent = (opts.value || 0) + '%';
      wrap.appendChild(label);
    }

    if (!indeterminate) {
      wrap.setAttribute('aria-valuenow', String(opts.value || 0));
    }

    return {
      el: wrap,
      update: function (val) {
        val = Math.max(0, Math.min(100, val));
        bar.style.width = val + '%';
        wrap.setAttribute('aria-valuenow', String(val));
        if (label) label.textContent = Math.round(val) + '%';
      }
    };
  }

  // ─── Page Transition Overlay ──────────────────────────────────────

  /**
   * Show a full-page loading overlay.
   * @param {Object} [opts]
   * @param {string} [opts.message='Loading…']
   * @param {number} [opts.timeoutMs=30000]
   * @param {string} [opts.timeoutMessage='This is taking longer than expected…']
   * @returns {{ id: string, hide: function(): void }}
   */
  function showOverlay(opts) {
    _injectStyles();
    opts = opts || {};
    var id = _genId();

    var overlay = _el('div', CSS_PREFIX + '-overlay', { 'data-loader-id': id });
    var spinner = createSpinner({ size: 'lg', label: opts.message || 'Loading…' });
    overlay.appendChild(spinner);
    document.body.appendChild(overlay);

    var timeoutTimer = setTimeout(function () {
      var msg = _el('div', CSS_PREFIX + '-timeout-msg');
      msg.textContent = opts.timeoutMessage || 'This is taking longer than expected…';
      overlay.appendChild(msg);
    }, opts.timeoutMs || DEFAULT_TIMEOUT_MS);

    var loader = {
      id: id,
      hide: function () {
        clearTimeout(timeoutTimer);
        overlay.classList.add(CSS_PREFIX + '-overlay--hiding');
        setTimeout(function () {
          if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        }, 200);
        delete _activeLoaders[id];
      }
    };

    _activeLoaders[id] = loader;
    return loader;
  }

  // ─── Inline Loading ───────────────────────────────────────────────

  /**
   * Create an inline loading indicator for tool panels.
   * @param {string} [message='Loading…']
   * @returns {HTMLElement}
   */
  function createInlineLoader(message) {
    _injectStyles();
    var wrap = _el('div', CSS_PREFIX + '-inline', { role: 'status' });
    var spinner = createSpinner({ size: 'sm' });
    wrap.appendChild(spinner);
    var txt = _el('span');
    txt.textContent = message || 'Loading…';
    wrap.appendChild(txt);
    return wrap;
  }

  // ─── Show/Hide Helpers ────────────────────────────────────────────

  /**
   * Replace a container's content with a loading skeleton while async work runs.
   * @param {string|HTMLElement} container - Selector or element
   * @param {string} skeletonType
   * @param {Object} [opts]
   * @returns {{ id: string, resolve: function(): void, el: HTMLElement }}
   */
  function showLoading(container, skeletonType, opts) {
    var el = typeof container === 'string' ? document.querySelector(container) : container;
    if (!el) return null;

    var id = _genId();
    var skeleton = createSkeleton(skeletonType || 'text', opts);
    skeleton.setAttribute('data-loader-id', id);

    var original = el.innerHTML;
    el.innerHTML = '';
    el.appendChild(skeleton);

    var loader = {
      id: id,
      el: skeleton,
      resolve: function () {
        el.innerHTML = original;
        delete _activeLoaders[id];
      }
    };

    _activeLoaders[id] = loader;
    return loader;
  }

  /**
   * Hide all active loaders.
   */
  function hideAll() {
    Object.keys(_activeLoaders).forEach(function (id) {
      var loader = _activeLoaders[id];
      if (loader.hide) loader.hide();
      else if (loader.resolve) loader.resolve();
    });
    _activeLoaders = {};
  }

  // ─── Public API ───────────────────────────────────────────────────

  window.CortexFreelancer.LoadingStateSystem = {
    createSkeleton: createSkeleton,
    createSpinner: createSpinner,
    createProgressBar: createProgressBar,
    showOverlay: showOverlay,
    createInlineLoader: createInlineLoader,
    showLoading: showLoading,
    hideAll: hideAll,
    SKELETON_TYPES: Object.keys(SKELETON_TYPES),
    SPINNER_SIZES: Object.keys(SPINNER_SIZES),

    /** @param {Object} [opts] */
    init: function (opts) {
      _injectStyles();
    },

    /**
     * Render a demo of all loading states into a container.
     * @param {string} containerId
     */
    render: function (containerId) {
      _injectStyles();
      var root = document.getElementById(containerId);
      if (!root) return;
      root.innerHTML = '';

      var h = _el('h2'); h.textContent = 'Loading State System';
      h.style.cssText = 'margin:0 0 20px;font-size:20px;color:#2d3436';
      root.appendChild(h);

      // Skeletons
      var secTitle = function (t) {
        var s = _el('h3'); s.textContent = t;
        s.style.cssText = 'margin:20px 0 10px;font-size:15px;color:#636e72';
        return s;
      };

      root.appendChild(secTitle('Card Skeleton'));
      root.appendChild(createSkeleton('card'));

      root.appendChild(secTitle('List Skeleton'));
      root.appendChild(createSkeleton('list', { rows: 3 }));

      root.appendChild(secTitle('Table Skeleton'));
      root.appendChild(createSkeleton('table', { rows: 4, cols: 4 }));

      root.appendChild(secTitle('Profile Skeleton'));
      root.appendChild(createSkeleton('profile'));

      // Spinners
      root.appendChild(secTitle('Spinners'));
      var spinRow = _el('div', '', { style: 'display:flex;gap:24px;align-items:flex-end;flex-wrap:wrap' });
      ['sm', 'md', 'lg', 'xl'].forEach(function (s) {
        spinRow.appendChild(createSpinner({ size: s, label: s.toUpperCase() }));
      });
      root.appendChild(spinRow);

      // Progress
      root.appendChild(secTitle('Progress Bars'));
      var p1 = createProgressBar({ value: 65 });
      root.appendChild(p1.el);

      var gap = _el('div', '', { style: 'height:12px' });
      root.appendChild(gap);

      var p2 = createProgressBar();
      root.appendChild(p2.el);

      // Inline
      root.appendChild(secTitle('Inline Loader'));
      root.appendChild(createInlineLoader('Fetching proposal data…'));
    }
  };

})();
