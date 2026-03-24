/**
 * CFX-045: Feature Flags Admin/Debug Panel
 *
 * Renders a toggleable debug panel for managing feature flags.
 * Accessible via Ctrl+Shift+F or programmatically.
 *
 * Usage:
 *   CortexFeatureFlagsAdmin.init();           // attach keyboard shortcut
 *   CortexFeatureFlagsAdmin.show();           // open panel
 *   CortexFeatureFlagsAdmin.render('myDiv');  // embed in container
 */
(function () {
  'use strict';

  var PANEL_ID = 'cfx-feature-flags-panel';
  var isVisible = false;

  /* ── Styles ───────────────────────────────────────────────────── */

  function injectStyles() {
    if (document.getElementById('cfx-ff-admin-styles')) return;
    var style = document.createElement('style');
    style.id = 'cfx-ff-admin-styles';
    style.textContent = [
      '#' + PANEL_ID + ' {',
      '  position: fixed; top: 0; right: 0; bottom: 0;',
      '  width: 380px; max-width: 90vw;',
      '  background: #1a1a2e; color: #e0e0e0;',
      '  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;',
      '  font-size: 13px; z-index: 99999;',
      '  box-shadow: -4px 0 24px rgba(0,0,0,0.4);',
      '  transform: translateX(100%);',
      '  transition: transform 0.25s ease;',
      '  display: flex; flex-direction: column;',
      '  overflow: hidden;',
      '}',
      '#' + PANEL_ID + '.cfx-ff-open { transform: translateX(0); }',
      '',
      '.cfx-ff-header {',
      '  padding: 16px 20px; background: #16213e;',
      '  border-bottom: 1px solid #0f3460;',
      '  display: flex; align-items: center; justify-content: space-between;',
      '}',
      '.cfx-ff-header h2 { margin: 0; font-size: 15px; font-weight: 600; color: #e94560; }',
      '.cfx-ff-close {',
      '  background: none; border: none; color: #888; cursor: pointer;',
      '  font-size: 20px; padding: 4px 8px; border-radius: 4px;',
      '}',
      '.cfx-ff-close:hover { background: rgba(255,255,255,0.1); color: #fff; }',
      '',
      '.cfx-ff-toolbar {',
      '  padding: 8px 20px; background: #16213e;',
      '  border-bottom: 1px solid #0f3460;',
      '  display: flex; gap: 8px; flex-wrap: wrap;',
      '}',
      '.cfx-ff-toolbar button {',
      '  padding: 4px 10px; font-size: 11px; border: 1px solid #0f3460;',
      '  background: #1a1a2e; color: #e0e0e0; border-radius: 6px;',
      '  cursor: pointer; white-space: nowrap;',
      '}',
      '.cfx-ff-toolbar button:hover { background: #0f3460; }',
      '.cfx-ff-toolbar button.active { background: #e94560; border-color: #e94560; color: #fff; }',
      '',
      '.cfx-ff-search {',
      '  padding: 8px 20px;',
      '  border-bottom: 1px solid #0f3460;',
      '}',
      '.cfx-ff-search input {',
      '  width: 100%; padding: 6px 10px; font-size: 12px;',
      '  background: #16213e; border: 1px solid #0f3460; color: #e0e0e0;',
      '  border-radius: 6px; outline: none; box-sizing: border-box;',
      '}',
      '.cfx-ff-search input:focus { border-color: #e94560; }',
      '',
      '.cfx-ff-body {',
      '  flex: 1; overflow-y: auto; padding: 12px 20px;',
      '}',
      '',
      '.cfx-ff-group-label {',
      '  font-size: 10px; text-transform: uppercase; letter-spacing: 1px;',
      '  color: #e94560; margin: 16px 0 8px; font-weight: 700;',
      '}',
      '.cfx-ff-group-label:first-child { margin-top: 0; }',
      '',
      '.cfx-ff-flag {',
      '  display: flex; align-items: center; gap: 10px;',
      '  padding: 10px 12px; margin-bottom: 6px;',
      '  background: #16213e; border-radius: 8px;',
      '  border: 1px solid transparent;',
      '  transition: border-color 0.15s;',
      '}',
      '.cfx-ff-flag:hover { border-color: #0f3460; }',
      '.cfx-ff-flag.overridden { border-color: #e94560; }',
      '',
      '.cfx-ff-flag-info { flex: 1; min-width: 0; }',
      '.cfx-ff-flag-name {',
      '  font-size: 12px; font-weight: 600; color: #fff;',
      '  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;',
      '}',
      '.cfx-ff-flag-desc { font-size: 11px; color: #888; margin-top: 2px; }',
      '',
      '.cfx-ff-flag-meta {',
      '  display: flex; align-items: center; gap: 6px;',
      '  font-size: 10px; color: #666; margin-top: 3px;',
      '}',
      '.cfx-ff-badge {',
      '  padding: 1px 5px; border-radius: 4px; font-size: 9px; font-weight: 600;',
      '}',
      '.cfx-ff-badge-override { background: #e94560; color: #fff; }',
      '.cfx-ff-badge-server { background: #0f3460; color: #53a8f8; }',
      '',
      '/* Toggle switch */',
      '.cfx-ff-toggle {',
      '  position: relative; width: 40px; height: 22px; flex-shrink: 0;',
      '}',
      '.cfx-ff-toggle input { opacity: 0; width: 0; height: 0; position: absolute; }',
      '.cfx-ff-toggle-track {',
      '  position: absolute; top: 0; left: 0; right: 0; bottom: 0;',
      '  background: #333; border-radius: 11px; cursor: pointer;',
      '  transition: background 0.2s;',
      '}',
      '.cfx-ff-toggle input:checked + .cfx-ff-toggle-track { background: #10b981; }',
      '.cfx-ff-toggle-thumb {',
      '  position: absolute; top: 2px; left: 2px;',
      '  width: 18px; height: 18px; background: #fff; border-radius: 50%;',
      '  transition: transform 0.2s;',
      '}',
      '.cfx-ff-toggle input:checked ~ .cfx-ff-toggle-thumb { transform: translateX(18px); }',
      '',
      '/* Rollout slider */',
      '.cfx-ff-rollout {',
      '  display: flex; align-items: center; gap: 6px;',
      '  margin-top: 4px;',
      '}',
      '.cfx-ff-rollout input[type=range] {',
      '  flex: 1; height: 4px; -webkit-appearance: none; appearance: none;',
      '  background: #333; border-radius: 2px; outline: none;',
      '}',
      '.cfx-ff-rollout input[type=range]::-webkit-slider-thumb {',
      '  -webkit-appearance: none; width: 14px; height: 14px;',
      '  background: #e94560; border-radius: 50%; cursor: pointer;',
      '}',
      '.cfx-ff-rollout span {',
      '  font-size: 10px; color: #888; min-width: 30px; text-align: right;',
      '}',
      '',
      '.cfx-ff-footer {',
      '  padding: 10px 20px; background: #16213e;',
      '  border-top: 1px solid #0f3460;',
      '  font-size: 10px; color: #666; text-align: center;',
      '}',
    ].join('\n');
    document.head.appendChild(style);
  }

  /* ── Panel Rendering ──────────────────────────────────────────── */

  var currentFilter = 'all';
  var searchQuery = '';

  function createPanel() {
    var existing = document.getElementById(PANEL_ID);
    if (existing) existing.remove();

    var panel = document.createElement('div');
    panel.id = PANEL_ID;

    panel.innerHTML = [
      '<div class="cfx-ff-header">',
      '  <h2>⚑ Feature Flags</h2>',
      '  <button class="cfx-ff-close" title="Close (Ctrl+Shift+F)">&times;</button>',
      '</div>',
      '<div class="cfx-ff-toolbar" id="cfx-ff-toolbar"></div>',
      '<div class="cfx-ff-search">',
      '  <input type="text" placeholder="Search flags…" id="cfx-ff-search-input">',
      '</div>',
      '<div class="cfx-ff-body" id="cfx-ff-body"></div>',
      '<div class="cfx-ff-footer">',
      '  CFX-045 Feature Flags · Device: <span id="cfx-ff-device-id"></span>',
      '</div>',
    ].join('\n');

    document.body.appendChild(panel);

    // Close button
    panel.querySelector('.cfx-ff-close').addEventListener('click', hide);

    // Search
    var searchInput = panel.querySelector('#cfx-ff-search-input');
    searchInput.addEventListener('input', function () {
      searchQuery = this.value.toLowerCase();
      renderFlagList();
    });

    // Render toolbar and flags
    renderToolbar();
    renderFlagList();

    // Device ID
    if (typeof CortexFeatureFlags !== 'undefined') {
      var devEl = panel.querySelector('#cfx-ff-device-id');
      if (devEl) devEl.textContent = CortexFeatureFlags.getDeviceId();
    }

    return panel;
  }

  function renderToolbar() {
    var toolbar = document.getElementById('cfx-ff-toolbar');
    if (!toolbar || typeof CortexFeatureFlags === 'undefined') return;

    var groups = CortexFeatureFlags.getGroups();
    var html = '<button class="' + (currentFilter === 'all' ? 'active' : '') + '" data-group="all">All</button>';
    for (var g in groups) {
      html += '<button class="' + (currentFilter === g ? 'active' : '') + '" data-group="' + g + '">' +
        g.charAt(0).toUpperCase() + g.slice(1) + ' (' + groups[g] + ')</button>';
    }
    html += '<button data-action="reset" style="margin-left:auto;border-color:#e94560;color:#e94560;">Reset All</button>';
    html += '<button data-action="refresh" title="Fetch from server">↻</button>';

    toolbar.innerHTML = html;

    toolbar.querySelectorAll('button[data-group]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        currentFilter = this.getAttribute('data-group');
        renderToolbar();
        renderFlagList();
      });
    });

    var resetBtn = toolbar.querySelector('[data-action="reset"]');
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        if (confirm('Reset all flag overrides to defaults?')) {
          CortexFeatureFlags.resetAll();
          renderFlagList();
        }
      });
    }

    var refreshBtn = toolbar.querySelector('[data-action="refresh"]');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', function () {
        CortexFeatureFlags.fetchServerFlags().then(function () {
          renderFlagList();
        });
      });
    }
  }

  function renderFlagList() {
    var body = document.getElementById('cfx-ff-body');
    if (!body || typeof CortexFeatureFlags === 'undefined') return;

    var allFlags = currentFilter === 'all'
      ? CortexFeatureFlags.getAllFlags()
      : CortexFeatureFlags.getFlagsByGroup(currentFilter);

    // Group and sort
    var grouped = {};
    for (var key in allFlags) {
      if (searchQuery && key.toLowerCase().indexOf(searchQuery) === -1 &&
        (allFlags[key].description || '').toLowerCase().indexOf(searchQuery) === -1) {
        continue;
      }
      var g = allFlags[key].group || 'default';
      if (!grouped[g]) grouped[g] = [];
      grouped[g].push({ key: key, data: allFlags[key] });
    }

    var html = '';
    var groupOrder = ['transport', 'ui', 'experimental', 'default'];
    var sortedGroups = Object.keys(grouped).sort(function (a, b) {
      return (groupOrder.indexOf(a) === -1 ? 99 : groupOrder.indexOf(a)) -
        (groupOrder.indexOf(b) === -1 ? 99 : groupOrder.indexOf(b));
    });

    for (var gi = 0; gi < sortedGroups.length; gi++) {
      var groupName = sortedGroups[gi];
      var items = grouped[groupName];

      html += '<div class="cfx-ff-group-label">' + groupName + '</div>';

      for (var fi = 0; fi < items.length; fi++) {
        var flag = items[fi];
        var k = flag.key;
        var d = flag.data;

        html += '<div class="cfx-ff-flag' + (d.hasOverride ? ' overridden' : '') + '">';
        html += '  <div class="cfx-ff-flag-info">';
        html += '    <div class="cfx-ff-flag-name">' + escHtml(k) + '</div>';
        html += '    <div class="cfx-ff-flag-desc">' + escHtml(d.description) + '</div>';
        html += '    <div class="cfx-ff-flag-meta">';
        if (d.hasOverride) html += '<span class="cfx-ff-badge cfx-ff-badge-override">override</span>';
        if (d.hasServerValue) html += '<span class="cfx-ff-badge cfx-ff-badge-server">server</span>';
        html += '      <span>bucket: ' + d.bucket + '</span>';
        html += '    </div>';

        // Rollout slider
        html += '    <div class="cfx-ff-rollout">';
        html += '      <input type="range" min="0" max="100" value="' + (d.rolloutPercent || 0) + '" data-flag="' + escAttr(k) + '" data-action="rollout">';
        html += '      <span>' + (d.rolloutPercent || 0) + '%</span>';
        html += '    </div>';

        html += '  </div>';

        // Toggle
        html += '  <label class="cfx-ff-toggle">';
        html += '    <input type="checkbox"' + (d.enabled ? ' checked' : '') + ' data-flag="' + escAttr(k) + '" data-action="toggle">';
        html += '    <div class="cfx-ff-toggle-track"></div>';
        html += '    <div class="cfx-ff-toggle-thumb"></div>';
        html += '  </label>';

        html += '</div>';
      }
    }

    if (!html) {
      html = '<div style="text-align:center;padding:40px;color:#666;">No flags match your filter.</div>';
    }

    body.innerHTML = html;

    // Bind toggle events
    body.querySelectorAll('[data-action="toggle"]').forEach(function (cb) {
      cb.addEventListener('change', function () {
        CortexFeatureFlags.setFlag(this.getAttribute('data-flag'), this.checked);
        // Re-render to update badges
        setTimeout(renderFlagList, 50);
      });
    });

    // Bind rollout sliders
    body.querySelectorAll('[data-action="rollout"]').forEach(function (slider) {
      slider.addEventListener('input', function () {
        var span = this.parentElement.querySelector('span');
        if (span) span.textContent = this.value + '%';
      });
      slider.addEventListener('change', function () {
        CortexFeatureFlags.setRollout(this.getAttribute('data-flag'), parseInt(this.value));
      });
    });
  }

  function escHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function escAttr(s) { return String(s).replace(/"/g, '&quot;'); }

  /* ── Show / Hide ──────────────────────────────────────────────── */

  function show() {
    injectStyles();
    var panel = document.getElementById(PANEL_ID) || createPanel();
    requestAnimationFrame(function () {
      panel.classList.add('cfx-ff-open');
    });
    isVisible = true;

    // Listen for flag changes
    if (typeof CortexFeatureFlags !== 'undefined') {
      CortexFeatureFlags.on('change', onFlagChange);
    }
  }

  function hide() {
    var panel = document.getElementById(PANEL_ID);
    if (panel) panel.classList.remove('cfx-ff-open');
    isVisible = false;
    if (typeof CortexFeatureFlags !== 'undefined') {
      CortexFeatureFlags.off('change', onFlagChange);
    }
  }

  function toggle() {
    isVisible ? hide() : show();
  }

  function onFlagChange() {
    if (isVisible) renderFlagList();
  }

  /* ── Embedded Render ──────────────────────────────────────────── */

  function render(containerId) {
    var container = document.getElementById(containerId);
    if (!container || typeof CortexFeatureFlags === 'undefined') return;

    injectStyles();
    currentFilter = 'all';
    searchQuery = '';

    container.innerHTML = [
      '<div style="background:#1a1a2e;border-radius:12px;overflow:hidden;border:1px solid #0f3460;">',
      '  <div class="cfx-ff-header">',
      '    <h2>⚑ Feature Flags</h2>',
      '  </div>',
      '  <div class="cfx-ff-toolbar" id="cfx-ff-toolbar-embed"></div>',
      '  <div class="cfx-ff-body" id="cfx-ff-body" style="max-height:500px;"></div>',
      '</div>',
    ].join('\n');

    // Reuse rendering with embedded IDs
    renderToolbar();
    renderFlagList();
  }

  /* ── Init ─────────────────────────────────────────────────────── */

  function init(opts) {
    opts = opts || {};

    // Keyboard shortcut: Ctrl+Shift+F
    document.addEventListener('keydown', function (e) {
      if (e.ctrlKey && e.shiftKey && e.key === 'F') {
        e.preventDefault();
        toggle();
      }
    });

    // Auto-show if URL has ?ff=1 or #feature-flags
    if (location.search.indexOf('ff=1') !== -1 || location.hash === '#feature-flags') {
      setTimeout(show, 500);
    }

    console.log('[feature-flags-admin] Initialized. Press Ctrl+Shift+F to toggle panel.');
  }

  /* ── Public API ───────────────────────────────────────────────── */

  window.CortexFeatureFlagsAdmin = {
    init: init,
    show: show,
    hide: hide,
    toggle: toggle,
    render: render,
    isVisible: function () { return isVisible; },
  };

})();
