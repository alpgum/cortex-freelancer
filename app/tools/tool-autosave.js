/**
 * Cortex Freelancer — Tool Auto-Save & Persistence [522]
 *
 * Drop-in script for any tool page. Automatically:
 * 1. Saves all input/textarea/select values to localStorage on change
 * 2. Restores saved values on page load
 * 3. Shows a "Last saved: X min ago" indicator
 *
 * Uses body[data-tool-name] as the storage key prefix.
 * Ignores inputs with [data-no-save] attribute.
 */
(function() {
  'use strict';

  var toolName = document.body.getAttribute('data-tool-name');
  if (!toolName) return;

  var SAVE_KEY = 'cortex_tool_' + toolName.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  var DEBOUNCE_MS = 800;
  var debounceTimer = null;

  // ── Gather saveable fields ──
  function getFields() {
    var els = document.querySelectorAll('input, textarea, select');
    var fields = [];
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.getAttribute('data-no-save') !== null) continue;
      if (el.type === 'hidden' || el.type === 'submit' || el.type === 'button') continue;
      if (!el.id && !el.name) continue;
      fields.push(el);
    }
    return fields;
  }

  function getFieldKey(el) {
    return el.id || el.name;
  }

  // ── Save state ──
  function saveState() {
    var data = {};
    var fields = getFields();
    for (var i = 0; i < fields.length; i++) {
      var el = fields[i];
      var key = getFieldKey(el);
      if (el.type === 'checkbox') {
        data[key] = el.checked;
      } else if (el.type === 'radio') {
        if (el.checked) data[key] = el.value;
      } else {
        if (el.value) data[key] = el.value;
      }
    }
    data.__savedAt = Date.now();
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch(e) { /* storage full */ }
    updateIndicator(data.__savedAt);
  }

  function debouncedSave() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(saveState, DEBOUNCE_MS);
  }

  // ── Restore state ──
  function restoreState() {
    var raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    var data;
    try { data = JSON.parse(raw); } catch(e) { return; }

    var fields = getFields();
    for (var i = 0; i < fields.length; i++) {
      var el = fields[i];
      var key = getFieldKey(el);
      if (!(key in data)) continue;

      if (el.type === 'checkbox') {
        el.checked = !!data[key];
      } else if (el.type === 'radio') {
        el.checked = (el.value === data[key]);
      } else {
        el.value = data[key];
        // Trigger input event for char counters etc.
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }

    if (data.__savedAt) {
      updateIndicator(data.__savedAt);
    }
  }

  // ── Last saved indicator ──
  function createIndicator() {
    var indicator = document.createElement('div');
    indicator.id = 'autosave-indicator';
    indicator.style.cssText = 'position:fixed;bottom:12px;left:12px;background:rgba(17,17,24,.9);border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:.4rem .75rem;font-size:.7rem;color:#666;font-family:Inter,-apple-system,sans-serif;z-index:9998;display:none;backdrop-filter:blur(8px);transition:opacity .3s';
    document.body.appendChild(indicator);
    return indicator;
  }

  function updateIndicator(savedAt) {
    var indicator = document.getElementById('autosave-indicator');
    if (!indicator) indicator = createIndicator();

    var elapsed = Date.now() - savedAt;
    var text;
    if (elapsed < 10000) {
      text = 'Saved just now';
    } else if (elapsed < 60000) {
      text = 'Last saved: ' + Math.round(elapsed / 1000) + 's ago';
    } else if (elapsed < 3600000) {
      text = 'Last saved: ' + Math.round(elapsed / 60000) + ' min ago';
    } else if (elapsed < 86400000) {
      text = 'Last saved: ' + Math.round(elapsed / 3600000) + 'h ago';
    } else {
      text = 'Last saved: ' + Math.round(elapsed / 86400000) + 'd ago';
    }

    indicator.textContent = text;
    indicator.style.display = 'block';

    // Flash green briefly on fresh save
    if (elapsed < 2000) {
      indicator.style.color = '#00ff88';
      indicator.style.borderColor = 'rgba(0,255,136,.2)';
      setTimeout(function() {
        indicator.style.color = '#666';
        indicator.style.borderColor = 'rgba(255,255,255,.08)';
      }, 1500);
    }
  }

  // Update relative time every 30s
  setInterval(function() {
    var raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    try {
      var data = JSON.parse(raw);
      if (data.__savedAt) updateIndicator(data.__savedAt);
    } catch(e) {}
  }, 30000);

  // ── Bind events ──
  function init() {
    restoreState();

    // Listen for changes on all fields
    document.addEventListener('input', function(e) {
      if (e.target.matches('input, textarea, select')) {
        debouncedSave();
      }
    });
    document.addEventListener('change', function(e) {
      if (e.target.matches('input, textarea, select')) {
        debouncedSave();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
