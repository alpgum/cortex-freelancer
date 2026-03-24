/**
 * [CF-166] Tool Autosave Global
 * Extend autosave functionality to work across all 25+ tools — saves form state
 * every 30 seconds to localStorage, restores on page load.
 * Exposed on window.CortexFreelancer.ToolAutosaveGlobal
 */
(function () {
  'use strict';

  var SAVE_INTERVAL = 30000; // 30 seconds
  var REGISTRY_KEY = 'cortex_autosave_registry';
  var PREFIX = 'cortex_autosave_';
  var MAX_AGE_DAYS = 30;
  var intervalId = null;
  var registeredContainers = {};
  var isDirty = false;

  // ── Storage helpers ──

  function getStorageKey(toolId) {
    return PREFIX + toolId.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  }

  function loadRegistry() {
    try { return JSON.parse(localStorage.getItem(REGISTRY_KEY)) || {}; }
    catch (e) { return {}; }
  }

  function saveRegistry(reg) {
    try { localStorage.setItem(REGISTRY_KEY, JSON.stringify(reg)); }
    catch (e) {}
  }

  function loadToolState(toolId) {
    try { return JSON.parse(localStorage.getItem(getStorageKey(toolId))) || null; }
    catch (e) { return null; }
  }

  function saveToolState(toolId, data) {
    try {
      data.__savedAt = Date.now();
      data.__toolId = toolId;
      localStorage.setItem(getStorageKey(toolId), JSON.stringify(data));

      var reg = loadRegistry();
      reg[toolId] = { lastSaved: Date.now(), fieldCount: Object.keys(data).length - 2 };
      saveRegistry(reg);
    } catch (e) { /* storage full */ }
  }

  // ── Field discovery ──

  function discoverFields(scope) {
    var root = scope || document;
    var els = root.querySelectorAll('input, textarea, select');
    var fields = [];
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.getAttribute('data-no-save') !== null) continue;
      if (el.type === 'hidden' || el.type === 'submit' || el.type === 'button') continue;
      if (el.type === 'password') continue;
      if (el.closest('[data-no-autosave]')) continue;
      // Must have id or name for reliable targeting
      if (!el.id && !el.name) continue;
      fields.push(el);
    }
    return fields;
  }

  function getFieldKey(el) {
    return el.id || el.name;
  }

  function getFieldValue(el) {
    if (el.type === 'checkbox') return el.checked;
    if (el.type === 'radio') return el.checked ? el.value : undefined;
    if (el.tagName === 'SELECT' && el.multiple) {
      var vals = [];
      for (var i = 0; i < el.options.length; i++) {
        if (el.options[i].selected) vals.push(el.options[i].value);
      }
      return vals;
    }
    return el.value || undefined;
  }

  function setFieldValue(el, value) {
    if (value === undefined || value === null) return;
    if (el.type === 'checkbox') {
      el.checked = !!value;
    } else if (el.type === 'radio') {
      el.checked = (el.value === value);
    } else if (el.tagName === 'SELECT' && el.multiple && Array.isArray(value)) {
      for (var i = 0; i < el.options.length; i++) {
        el.options[i].selected = value.indexOf(el.options[i].value) !== -1;
      }
    } else {
      el.value = value;
      // Trigger input event for UI components that listen
      try { el.dispatchEvent(new Event('input', { bubbles: true })); }
      catch (e) {}
    }
  }

  // ── Core autosave logic ──

  function captureState(toolId, scope) {
    var fields = discoverFields(scope);
    var data = {};
    var hasContent = false;
    for (var i = 0; i < fields.length; i++) {
      var el = fields[i];
      var key = getFieldKey(el);
      var val = getFieldValue(el);
      if (val !== undefined) {
        data[key] = val;
        if (val !== '' && val !== false) hasContent = true;
      }
    }
    return hasContent ? data : null;
  }

  function restoreState(toolId, scope) {
    var data = loadToolState(toolId);
    if (!data) return false;

    // Check age
    if (data.__savedAt && (Date.now() - data.__savedAt) > MAX_AGE_DAYS * 86400000) {
      localStorage.removeItem(getStorageKey(toolId));
      return false;
    }

    var fields = discoverFields(scope);
    var restored = 0;
    for (var i = 0; i < fields.length; i++) {
      var el = fields[i];
      var key = getFieldKey(el);
      if (key in data && key !== '__savedAt' && key !== '__toolId') {
        setFieldValue(el, data[key]);
        restored++;
      }
    }
    return restored > 0;
  }

  function performSave(toolId, scope) {
    var data = captureState(toolId, scope);
    if (data) {
      saveToolState(toolId, data);
      updateIndicator(toolId, Date.now());
      isDirty = false;
    }
  }

  // ── Indicator ──

  function createIndicator() {
    var indicator = document.getElementById('autosave-global-indicator');
    if (indicator) return indicator;
    indicator = document.createElement('div');
    indicator.id = 'autosave-global-indicator';
    indicator.style.cssText = 'position:fixed;bottom:12px;left:12px;background:rgba(17,17,24,.92);border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:.4rem .75rem;font-size:.7rem;color:#666;font-family:Inter,-apple-system,sans-serif;z-index:9998;display:none;backdrop-filter:blur(8px);transition:opacity .3s;cursor:pointer';
    indicator.title = 'Autosave active';
    document.body.appendChild(indicator);
    return indicator;
  }

  function updateIndicator(toolId, savedAt) {
    var indicator = createIndicator();
    var elapsed = Date.now() - savedAt;
    var text;
    if (elapsed < 10000) text = 'Saved just now';
    else if (elapsed < 60000) text = 'Saved ' + Math.round(elapsed / 1000) + 's ago';
    else if (elapsed < 3600000) text = 'Saved ' + Math.round(elapsed / 60000) + 'm ago';
    else text = 'Saved ' + Math.round(elapsed / 3600000) + 'h ago';

    indicator.textContent = text;
    indicator.style.display = 'block';

    if (elapsed < 2000) {
      indicator.style.color = '#00ff88';
      indicator.style.borderColor = 'rgba(0,255,136,.2)';
      setTimeout(function () {
        indicator.style.color = '#666';
        indicator.style.borderColor = 'rgba(255,255,255,.08)';
      }, 1500);
    }
  }

  // ── Tool detection ──

  function detectToolId() {
    // Priority 1: data-tool-name on body
    var bodyAttr = document.body.getAttribute('data-tool-name');
    if (bodyAttr) return bodyAttr;

    // Priority 2: data-tool-id on any container
    var toolEl = document.querySelector('[data-tool-id]');
    if (toolEl) return toolEl.getAttribute('data-tool-id');

    // Priority 3: extract from URL path
    var path = window.location.pathname;
    var match = path.match(/\/tools?\/([a-z0-9-]+)/i);
    if (match) return match[1];

    // Priority 4: page title
    var title = document.title.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase().slice(0, 40);
    if (title) return title;

    return null;
  }

  // ── Registration API ──

  function register(toolId, containerId) {
    if (!toolId) return;
    var scope = containerId ? document.getElementById(containerId) : document;
    registeredContainers[toolId] = { containerId: containerId, scope: scope };

    // Restore immediately
    var restored = restoreState(toolId, scope);
    if (restored) {
      var data = loadToolState(toolId);
      if (data && data.__savedAt) updateIndicator(toolId, data.__savedAt);
    }

    // Listen for changes
    var changeHandler = function () { isDirty = true; };
    (scope || document).addEventListener('input', changeHandler);
    (scope || document).addEventListener('change', changeHandler);
  }

  // ── Auto-init ──

  function autoInit() {
    var toolId = detectToolId();
    if (!toolId) return;

    register(toolId);

    // Periodic save
    if (intervalId) clearInterval(intervalId);
    intervalId = setInterval(function () {
      if (!isDirty) return;
      var entry = registeredContainers[toolId];
      performSave(toolId, entry ? entry.scope : document);
    }, SAVE_INTERVAL);

    // Save on page unload
    window.addEventListener('beforeunload', function () {
      if (isDirty) {
        var entry = registeredContainers[toolId];
        performSave(toolId, entry ? entry.scope : document);
      }
    });

    // Save on visibility change (tab switch)
    document.addEventListener('visibilitychange', function () {
      if (document.hidden && isDirty) {
        var entry = registeredContainers[toolId];
        performSave(toolId, entry ? entry.scope : document);
      }
    });
  }

  // ── Cleanup ──

  function cleanupOldSaves() {
    var reg = loadRegistry();
    var now = Date.now();
    var maxAge = MAX_AGE_DAYS * 86400000;
    var changed = false;

    Object.keys(reg).forEach(function (toolId) {
      if (reg[toolId].lastSaved && (now - reg[toolId].lastSaved) > maxAge) {
        localStorage.removeItem(getStorageKey(toolId));
        delete reg[toolId];
        changed = true;
      }
    });

    if (changed) saveRegistry(reg);
  }

  // ── Boot ──

  function boot() {
    cleanupOldSaves();
    autoInit();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  // ── Public API ──

  var ToolAutosaveGlobal = {
    init: boot,
    render: function (containerId) {
      // Render a management UI showing all autosaved tools
      if (!document.getElementById('tag-styles')) {
        var s = document.createElement('style');
        s.id = 'tag-styles';
        s.textContent = '\
          .tag-wrap{font-family:Inter,-apple-system,sans-serif;color:var(--text,#e0e0e0);max-width:800px;margin:0 auto;padding:1.5rem 1rem}\
          .tag-wrap h2{margin:0 0 .3rem;font-size:1.4rem;color:var(--text-bright,#fff)}\
          .tag-subtitle{color:var(--text-dim,#888);font-size:.85rem;margin-bottom:1.5rem}\
          .tag-card{background:var(--bg-card,#111);border:1px solid var(--border,#222);border-radius:var(--radius,12px);padding:1.2rem;margin-bottom:1rem}\
          .tag-item{display:flex;justify-content:space-between;align-items:center;padding:.55rem 0;border-bottom:1px solid var(--border,#222);font-size:.82rem}\
          .tag-item:last-child{border-bottom:none}\
          .tag-tool-name{font-weight:600;color:var(--text-bright,#fff);text-transform:capitalize}\
          .tag-meta{color:var(--text-dim,#888);font-size:.75rem}\
          .tag-btn{background:transparent;border:1px solid var(--border,#222);color:var(--text-dim,#888);padding:.25rem .55rem;border-radius:6px;cursor:pointer;font-size:.72rem}\
          .tag-btn:hover{border-color:var(--red,#ff4444);color:var(--red,#ff4444)}\
          .tag-btn-clear-all{background:var(--red,#ff4444);color:#fff;border:none;padding:.45rem .85rem;border-radius:var(--radius-sm,8px);cursor:pointer;font-size:.8rem;font-weight:600}\
          .tag-stat{display:inline-block;padding:.5rem 1rem;background:var(--bg,#0a0a0a);border-radius:var(--radius-sm,8px);margin:.25rem;text-align:center}\
          .tag-stat-num{font-size:1.3rem;font-weight:700;color:var(--orange,#ff8844)}\
          .tag-stat-label{font-size:.7rem;color:var(--text-dim,#888)}\
        ';
        document.head.appendChild(s);
      }

      var container = document.getElementById(containerId);
      if (!container) return;

      var reg = loadRegistry();
      var tools = Object.keys(reg);
      var totalFields = 0;
      tools.forEach(function (t) { totalFields += (reg[t].fieldCount || 0); });

      var html = '<div class="tag-wrap">';
      html += '<h2>Tool Autosave Manager</h2>';
      html += '<p class="tag-subtitle">Manage autosaved form data across all tools. Data is saved every 30 seconds.</p>';

      html += '<div style="text-align:center;margin-bottom:1.5rem">';
      html += '<div class="tag-stat"><div class="tag-stat-num">' + tools.length + '</div><div class="tag-stat-label">Tools Saved</div></div>';
      html += '<div class="tag-stat"><div class="tag-stat-num">' + totalFields + '</div><div class="tag-stat-label">Fields Tracked</div></div>';
      html += '<div class="tag-stat"><div class="tag-stat-num">' + SAVE_INTERVAL / 1000 + 's</div><div class="tag-stat-label">Save Interval</div></div>';
      html += '</div>';

      if (tools.length) {
        html += '<div class="tag-card"><h3 style="margin:0 0 .75rem;font-size:.95rem;color:var(--text-bright,#fff)">Saved Tools</h3>';
        tools.sort().forEach(function (toolId) {
          var info = reg[toolId];
          var age = info.lastSaved ? timeSince(info.lastSaved) : 'unknown';
          html += '<div class="tag-item"><div><span class="tag-tool-name">' + toolId.replace(/[-_]/g, ' ') + '</span>';
          html += '<div class="tag-meta">' + (info.fieldCount || 0) + ' fields &middot; saved ' + age + '</div></div>';
          html += '<button class="tag-btn tag-clear-tool" data-tool="' + toolId + '">Clear</button></div>';
        });
        html += '</div>';
        html += '<div style="text-align:right"><button class="tag-btn-clear-all" id="tag-clear-all">Clear All Saved Data</button></div>';
      } else {
        html += '<div class="tag-card" style="text-align:center;padding:2rem;color:var(--text-dim,#888)"><p>No autosaved data yet.</p><p style="font-size:.8rem">Use any tool and your form inputs will be automatically saved.</p></div>';
      }

      html += '</div>';
      container.innerHTML = html;

      // Events
      container.addEventListener('click', function (e) {
        if (e.target.classList.contains('tag-clear-tool')) {
          var tid = e.target.getAttribute('data-tool');
          if (confirm('Clear saved data for ' + tid + '?')) {
            clearTool(tid);
            ToolAutosaveGlobal.render(containerId);
          }
        }
        if (e.target.id === 'tag-clear-all') {
          if (confirm('Clear ALL autosaved data? This cannot be undone.')) {
            clearAll();
            ToolAutosaveGlobal.render(containerId);
          }
        }
      });
    },
    register: register,
    save: function (toolId) {
      var entry = registeredContainers[toolId];
      performSave(toolId, entry ? entry.scope : document);
    },
    restore: function (toolId) {
      var entry = registeredContainers[toolId];
      return restoreState(toolId, entry ? entry.scope : document);
    },
    clearTool: clearTool,
    clearAll: clearAll,
    getRegistry: loadRegistry
  };

  function clearTool(toolId) {
    localStorage.removeItem(getStorageKey(toolId));
    var reg = loadRegistry();
    delete reg[toolId];
    saveRegistry(reg);
  }

  function clearAll() {
    var reg = loadRegistry();
    Object.keys(reg).forEach(function (toolId) {
      localStorage.removeItem(getStorageKey(toolId));
    });
    localStorage.removeItem(REGISTRY_KEY);
  }

  function timeSince(ts) {
    var elapsed = Date.now() - ts;
    if (elapsed < 60000) return 'just now';
    if (elapsed < 3600000) return Math.round(elapsed / 60000) + 'm ago';
    if (elapsed < 86400000) return Math.round(elapsed / 3600000) + 'h ago';
    return Math.round(elapsed / 86400000) + 'd ago';
  }

  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.ToolAutosaveGlobal = ToolAutosaveGlobal;
})();
