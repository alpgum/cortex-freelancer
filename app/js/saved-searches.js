/**
 * [CF-029] Saved Search Templates
 *
 * IIFE exposing window.CortexSavedSearches
 * Persists search configurations to localStorage for quick re-use.
 * Dark theme, max 10 saved searches.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_saved_searches';
  var MAX_SEARCHES = 10;

  // ─── Helpers ──────────────────────────────────────────────────────
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function escapeHtml(str) {
    var d = document.createElement('div');
    d.appendChild(document.createTextNode(str || ''));
    return d.innerHTML;
  }

  function toast(msg) {
    if (window.toast) { window.toast(msg); return; }
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(function () { t.classList.remove('show'); }, 2500);
  }

  // ─── Data layer ───────────────────────────────────────────────────
  function _load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var data = JSON.parse(raw);
      return Array.isArray(data) ? data : [];
    } catch (e) {
      return [];
    }
  }

  function _save(entries) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch (e) {
      console.warn('[CF-029] localStorage write failed:', e);
    }
  }

  /** Get all saved searches */
  function getSavedSearches() {
    return _load();
  }

  /** Check if a search with identical filters already exists */
  function _isDuplicate(config, entries) {
    var filterKeys = ['keywords', 'category', 'minBudget', 'maxBudget', 'clientSpend', 'country'];
    for (var i = 0; i < entries.length; i++) {
      var match = true;
      for (var k = 0; k < filterKeys.length; k++) {
        var key = filterKeys[k];
        if ((config[key] || '') !== (entries[i][key] || '')) {
          match = false;
          break;
        }
      }
      if (match) return entries[i];
    }
    return null;
  }

  /** Save a search config with a name. Returns the new entry. */
  function saveSearch(config) {
    if (!config || !config.name) return null;
    var entries = _load();

    // Duplicate detection
    var dup = _isDuplicate(config, entries);
    if (dup) {
      toast('Duplicate: a search with identical filters already exists ("' + dup.name + '")');
      return null;
    }

    // Enforce max
    if (entries.length >= MAX_SEARCHES) {
      toast('Max ' + MAX_SEARCHES + ' saved searches. Delete one first.');
      return null;
    }

    var entry = {
      id: uid(),
      name: (config.name || '').trim().slice(0, 60),
      keywords: config.keywords || '',
      category: config.category || '',
      minBudget: config.minBudget || '',
      maxBudget: config.maxBudget || '',
      clientSpend: config.clientSpend || '',
      country: config.country || '',
      createdAt: new Date().toISOString()
    };

    entries.unshift(entry);
    _save(entries);
    return entry;
  }

  /** Delete a saved search by id */
  function deleteSearch(id) {
    var entries = _load();
    var filtered = entries.filter(function (e) { return e.id !== id; });
    _save(filtered);
  }

  // ─── Reorder ─────────────────────────────────────────────────────
  /** Move a saved search up in the list by id */
  function moveUp(id) {
    var entries = _load();
    for (var i = 1; i < entries.length; i++) {
      if (entries[i].id === id) {
        var tmp = entries[i - 1];
        entries[i - 1] = entries[i];
        entries[i] = tmp;
        _save(entries);
        return true;
      }
    }
    return false;
  }

  /** Move a saved search down in the list by id */
  function moveDown(id) {
    var entries = _load();
    for (var i = 0; i < entries.length - 1; i++) {
      if (entries[i].id === id) {
        var tmp = entries[i + 1];
        entries[i + 1] = entries[i];
        entries[i] = tmp;
        _save(entries);
        return true;
      }
    }
    return false;
  }

  // ─── Export / Import ────────────────────────────────────────────
  /** Export all saved searches as a JSON string */
  function exportSearches() {
    var entries = _load();
    return JSON.stringify(entries, null, 2);
  }

  /** Import searches from a JSON string, merging with existing (skips duplicates by id) */
  function importSearches(jsonStr) {
    if (!jsonStr) { toast('Nothing to import'); return 0; }
    var imported;
    try {
      imported = JSON.parse(jsonStr);
    } catch (e) {
      toast('Import failed: invalid JSON');
      return 0;
    }
    if (!Array.isArray(imported)) {
      toast('Import failed: expected an array');
      return 0;
    }
    var entries = _load();
    var existingIds = {};
    for (var i = 0; i < entries.length; i++) { existingIds[entries[i].id] = true; }

    var added = 0;
    for (var j = 0; j < imported.length; j++) {
      var item = imported[j];
      if (!item || !item.id || !item.name) continue;
      if (existingIds[item.id]) continue;
      if (entries.length >= MAX_SEARCHES) {
        toast('Max ' + MAX_SEARCHES + ' reached. Imported ' + added + ' of ' + imported.length + '.');
        break;
      }
      entries.push(item);
      existingIds[item.id] = true;
      added++;
    }
    _save(entries);
    toast('Imported ' + added + ' search' + (added !== 1 ? 'es' : ''));
    return added;
  }

  // ─── Rename ─────────────────────────────────────────────────────
  /** Rename a saved search by id */
  function renameSearch(id, newName) {
    if (!newName || !newName.trim()) { toast('Name cannot be empty'); return false; }
    var entries = _load();
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].id === id) {
        entries[i].name = newName.trim().slice(0, 60);
        _save(entries);
        toast('Renamed to: ' + entries[i].name);
        return true;
      }
    }
    toast('Search not found');
    return false;
  }

  /** Apply saved search: fill form fields with saved config */
  function applySearch(id) {
    var entries = _load();
    var entry = null;
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].id === id) { entry = entries[i]; break; }
    }
    if (!entry) return;

    // Fill known form fields
    _setVal('ss-keywords', entry.keywords);
    _setVal('ss-category', entry.category);
    _setVal('ss-min-budget', entry.minBudget);
    _setVal('ss-max-budget', entry.maxBudget);
    _setVal('ss-client-spend', entry.clientSpend);
    _setVal('ss-country', entry.country);

    // Also try to fill the main landing form fields if they exist
    if (entry.category) _setVal('skill-select', entry.category);
    if (entry.country) _setVal('country-select', entry.country);
    if (entry.minBudget) _setVal('rate-input', entry.minBudget);

    toast('Applied: ' + entry.name);
  }

  function _setVal(id, val) {
    var el = document.getElementById(id);
    if (el && val !== undefined && val !== null && val !== '') {
      el.value = val;
      // Trigger change event for any listeners
      try { el.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
      try { el.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
    }
  }

  // ─── Badge builder ────────────────────────────────────────────────
  function buildBadge(entry) {
    var parts = [];
    if (entry.keywords) parts.push(entry.keywords.split(/\s+/).slice(0, 2).join(' '));
    if (entry.minBudget) parts.push('$' + entry.minBudget + '+/hr');
    if (entry.country) {
      var c = entry.country.toUpperCase().slice(0, 3);
      parts.push(c);
    }
    if (entry.category) {
      var cat = entry.category.replace(/-/g, ' ');
      cat = cat.charAt(0).toUpperCase() + cat.slice(1);
      if (!entry.keywords) parts.unshift(cat);
    }
    return parts.length > 0 ? parts.join(' · ') : 'Search';
  }

  // ─── Read current form values ─────────────────────────────────────
  function _readCurrentSearch() {
    return {
      keywords: _getVal('ss-keywords') || '',
      category: _getVal('ss-category') || _getVal('skill-select') || '',
      minBudget: _getVal('ss-min-budget') || _getVal('rate-input') || '',
      maxBudget: _getVal('ss-max-budget') || '',
      clientSpend: _getVal('ss-client-spend') || '',
      country: _getVal('ss-country') || _getVal('country-select') || ''
    };
  }

  function _getVal(id) {
    var el = document.getElementById(id);
    return el ? (el.value || '').trim() : '';
  }

  // ─── Inject styles ────────────────────────────────────────────────
  function _injectStyles() {
    if (document.getElementById('ss-styles')) return;
    var style = document.createElement('style');
    style.id = 'ss-styles';
    style.textContent = [
      '.ss-wrap{position:relative;margin-bottom:1rem}',
      '.ss-toggle{display:inline-flex;align-items:center;gap:6px;padding:0.5rem 1rem;background:var(--bg-card,#111);border:1px solid var(--border,#222);border-radius:100px;color:var(--text,#e0e0e0);font-size:0.82rem;font-weight:600;cursor:pointer;transition:border-color 0.2s,color 0.2s}',
      '.ss-toggle:hover{border-color:var(--green,#00ff88);color:var(--green,#00ff88)}',
      '.ss-toggle .ss-count{background:rgba(0,255,136,0.12);color:var(--green,#00ff88);font-size:0.7rem;padding:1px 7px;border-radius:100px;font-weight:700;margin-left:4px}',
      '.ss-dropdown{display:none;position:absolute;top:calc(100% + 6px);left:0;z-index:100;min-width:340px;max-width:420px;background:var(--bg-card,#111);border:1px solid var(--border,#222);border-radius:var(--radius,12px);box-shadow:0 8px 32px rgba(0,0,0,0.5);overflow:hidden}',
      '.ss-dropdown.open{display:block}',
      '.ss-dropdown-header{padding:0.75rem 1rem;border-bottom:1px solid var(--border,#222);font-weight:700;font-size:0.85rem;color:var(--text-bright,#fff);display:flex;align-items:center;justify-content:space-between}',
      '.ss-list{max-height:260px;overflow-y:auto;padding:0.35rem 0}',
      '.ss-item{display:flex;align-items:center;gap:0.5rem;padding:0.55rem 1rem;cursor:pointer;transition:background 0.15s}',
      '.ss-item:hover{background:rgba(255,255,255,0.04)}',
      '.ss-item-name{flex:1;font-size:0.82rem;font-weight:600;color:var(--text-bright,#fff);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.ss-item-badge{font-size:0.7rem;color:var(--text-dim,#888);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:160px}',
      '.ss-item-del{flex-shrink:0;width:22px;height:22px;display:grid;place-items:center;border:none;background:none;color:var(--text-dim,#888);font-size:0.85rem;cursor:pointer;border-radius:4px;transition:color 0.15s,background 0.15s}',
      '.ss-item-del:hover{color:#ff4444;background:rgba(255,68,68,0.1)}',
      '.ss-empty{padding:1.2rem 1rem;text-align:center;font-size:0.8rem;color:var(--text-dim,#888)}',
      '.ss-save-row{display:flex;gap:0.4rem;padding:0.6rem 0.75rem;border-top:1px solid var(--border,#222);background:rgba(255,255,255,0.02)}',
      '.ss-save-input{flex:1;padding:0.45rem 0.7rem;border:1px solid var(--border,#222);border-radius:var(--radius-sm,8px);background:var(--bg,#0a0a0a);color:var(--text,#e0e0e0);font-size:0.8rem;outline:none}',
      '.ss-save-input:focus{border-color:var(--green,#00ff88)}',
      '.ss-save-input::placeholder{color:var(--text-dim,#888)}',
      '.ss-save-btn{padding:0.45rem 0.9rem;border:none;border-radius:var(--radius-sm,8px);background:var(--green,#00ff88);color:var(--bg,#0a0a0a);font-size:0.78rem;font-weight:700;cursor:pointer;white-space:nowrap;transition:opacity 0.2s}',
      '.ss-save-btn:hover{opacity:0.85}',
      '.ss-save-btn:disabled{opacity:0.4;cursor:not-allowed}',
      /* Search form fields inside dropdown */
      '.ss-fields{padding:0.5rem 0.75rem 0.25rem;display:grid;grid-template-columns:1fr 1fr;gap:0.4rem}',
      '.ss-field{display:flex;flex-direction:column;gap:2px}',
      '.ss-field label{font-size:0.65rem;color:var(--text-dim,#888);text-transform:uppercase;letter-spacing:0.5px}',
      '.ss-field input,.ss-field select{padding:0.35rem 0.5rem;border:1px solid var(--border,#222);border-radius:6px;background:var(--bg,#0a0a0a);color:var(--text,#e0e0e0);font-size:0.78rem;outline:none}',
      '.ss-field input:focus,.ss-field select:focus{border-color:var(--green,#00ff88)}',
      '.ss-field-full{grid-column:1/-1}',
      '.ss-item-reorder{display:flex;flex-direction:column;gap:1px;flex-shrink:0;margin-right:4px}',
      '.ss-item-reorder button{display:block;border:none;background:none;color:var(--text-dim,#888);font-size:0.6rem;line-height:1;cursor:pointer;padding:1px 3px;border-radius:3px;transition:color 0.15s,background 0.15s}',
      '.ss-item-reorder button:hover{color:var(--green,#00ff88);background:rgba(0,255,136,0.1)}',
      '.ss-item-badge.ss-badge-clickable{cursor:pointer;padding:2px 6px;border-radius:4px;transition:background 0.15s,color 0.15s}',
      '.ss-item-badge.ss-badge-clickable:hover{background:rgba(0,255,136,0.1);color:var(--green,#00ff88)}',
      '.ss-header-actions{display:flex;gap:4px}',
      '.ss-header-actions button{border:none;background:rgba(255,255,255,0.06);color:var(--text-dim,#888);font-size:0.65rem;padding:3px 8px;border-radius:4px;cursor:pointer;font-weight:600;transition:color 0.15s,background 0.15s}',
      '.ss-header-actions button:hover{color:var(--green,#00ff88);background:rgba(0,255,136,0.1)}',
      '@media(max-width:500px){.ss-dropdown{min-width:0;left:-10px;right:-10px;width:auto}.ss-fields{grid-template-columns:1fr}}'
    ].join('\n');
    document.head.appendChild(style);
  }

  // ─── Render ───────────────────────────────────────────────────────
  var _container = null;
  var _dropdownOpen = false;

  function renderSavedSearches(container) {
    if (!container) return;
    _container = container;
    _injectStyles();

    var entries = _load();
    var countBadge = entries.length > 0
      ? '<span class="ss-count">' + entries.length + '</span>'
      : '';

    var html = '<div class="ss-wrap">';

    // Toggle button
    html += '<button class="ss-toggle" id="ss-toggle-btn" type="button">';
    html += '🔖 Saved Searches' + countBadge;
    html += '</button>';

    // Dropdown
    html += '<div class="ss-dropdown' + (_dropdownOpen ? ' open' : '') + '" id="ss-dropdown">';
    html += '<div class="ss-dropdown-header"><span>🔖 Saved Searches</span>';
    html += '<div class="ss-header-actions">';
    html += '<button id="ss-export-btn" type="button" title="Export searches">Export</button>';
    html += '<button id="ss-import-btn" type="button" title="Import searches">Import</button>';
    html += '<span style="font-size:0.7rem;color:var(--text-dim);padding:3px 0">' + entries.length + '/' + MAX_SEARCHES + '</span>';
    html += '</div></div>';
    html += '<input type="file" id="ss-import-file" accept=".json,application/json" style="display:none">';

    // Search fields
    html += '<div class="ss-fields">';
    html += '<div class="ss-field ss-field-full"><label>Keywords</label><input type="text" id="ss-keywords" placeholder="e.g. React, Python, WordPress"></div>';
    html += '<div class="ss-field"><label>Category</label><select id="ss-category">';
    html += '<option value="">Any</option>';
    html += '<option value="web-development">Web Dev</option>';
    html += '<option value="mobile-development">Mobile Dev</option>';
    html += '<option value="design">UI/UX Design</option>';
    html += '<option value="writing">Content Writing</option>';
    html += '<option value="data-science">Data Science / AI</option>';
    html += '<option value="devops">DevOps / Cloud</option>';
    html += '<option value="marketing">Digital Marketing</option>';
    html += '<option value="video">Video Editing</option>';
    html += '<option value="blockchain">Blockchain / Web3</option>';
    html += '<option value="qa">QA / Testing</option>';
    html += '</select></div>';
    html += '<div class="ss-field"><label>Country</label><select id="ss-country">';
    html += '<option value="">Any</option>';
    html += '<option value="us">US</option><option value="uk">UK</option><option value="eu">Europe</option>';
    html += '<option value="turkey">Turkey</option><option value="india">India</option><option value="pakistan">Pakistan</option>';
    html += '<option value="philippines">Philippines</option><option value="brazil">Brazil</option>';
    html += '<option value="egypt">Egypt</option><option value="nigeria">Nigeria</option>';
    html += '<option value="ukraine">Ukraine</option><option value="kenya">Kenya</option><option value="mexico">Mexico</option>';
    html += '</select></div>';
    html += '<div class="ss-field"><label>Min $/hr</label><input type="number" id="ss-min-budget" placeholder="e.g. 25" min="0"></div>';
    html += '<div class="ss-field"><label>Max $/hr</label><input type="number" id="ss-max-budget" placeholder="e.g. 100" min="0"></div>';
    html += '<div class="ss-field"><label>Client Spend ($)</label><input type="number" id="ss-client-spend" placeholder="e.g. 1000" min="0"></div>';
    html += '</div>';

    // Save row
    html += '<div class="ss-save-row">';
    html += '<input type="text" class="ss-save-input" id="ss-save-name" placeholder="Name this search…" maxlength="60">';
    html += '<button class="ss-save-btn" id="ss-save-btn" type="button">Save</button>';
    html += '</div>';

    // List
    html += '<div class="ss-list" id="ss-list">';
    if (entries.length === 0) {
      html += '<div class="ss-empty">No saved searches yet.<br>Fill in filters above and save.</div>';
    } else {
      entries.forEach(function (entry) {
        html += _renderItem(entry);
      });
    }
    html += '</div>';

    html += '</div>'; // .ss-dropdown
    html += '</div>'; // .ss-wrap

    container.innerHTML = html;

    // Bind events
    _bindEvents();
  }

  function _renderItem(entry) {
    var badge = escapeHtml(buildBadge(entry));
    var h = '<div class="ss-item" data-id="' + entry.id + '">';
    h += '<span class="ss-item-reorder">';
    h += '<button data-move-up="' + entry.id + '" title="Move up" type="button">&#9650;</button>';
    h += '<button data-move-down="' + entry.id + '" title="Move down" type="button">&#9660;</button>';
    h += '</span>';
    h += '<span class="ss-item-name">' + escapeHtml(entry.name) + '</span>';
    h += '<span class="ss-item-badge ss-badge-clickable" data-apply="' + entry.id + '" title="Click to apply">' + badge + '</span>';
    h += '<button class="ss-item-del" data-del="' + entry.id + '" title="Delete" type="button">&times;</button>';
    h += '</div>';
    return h;
  }

  function _bindEvents() {
    var toggleBtn = document.getElementById('ss-toggle-btn');
    var dropdown = document.getElementById('ss-dropdown');
    var saveBtn = document.getElementById('ss-save-btn');
    var nameInput = document.getElementById('ss-save-name');

    if (toggleBtn && dropdown) {
      toggleBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        _dropdownOpen = !_dropdownOpen;
        dropdown.classList.toggle('open', _dropdownOpen);
      });
    }

    // Close on outside click
    document.addEventListener('click', function (e) {
      if (!dropdown) return;
      var wrap = dropdown.parentElement;
      if (wrap && !wrap.contains(e.target)) {
        _dropdownOpen = false;
        dropdown.classList.remove('open');
      }
    });

    // Save button
    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        var name = nameInput ? nameInput.value.trim() : '';
        if (!name) {
          nameInput && nameInput.focus();
          toast('Enter a name for this search');
          return;
        }
        var config = _readCurrentSearch();
        config.name = name;
        var entry = saveSearch(config);
        if (entry) {
          toast('Saved: ' + entry.name);
          renderSavedSearches(_container);
          // Re-open dropdown
          _dropdownOpen = true;
          var dd = document.getElementById('ss-dropdown');
          if (dd) dd.classList.add('open');
        }
      });
    }

    // Enter key in name input
    if (nameInput) {
      nameInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          saveBtn && saveBtn.click();
        }
      });
    }

    // Export button
    var exportBtn = document.getElementById('ss-export-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        var json = exportSearches();
        var blob = new Blob([json], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'cortex-saved-searches.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast('Searches exported');
      });
    }

    // Import button
    var importBtn = document.getElementById('ss-import-btn');
    var importFile = document.getElementById('ss-import-file');
    if (importBtn && importFile) {
      importBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        importFile.click();
      });
      importFile.addEventListener('change', function () {
        var file = importFile.files && importFile.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function (ev) {
          importSearches(ev.target.result);
          renderSavedSearches(_container);
          _dropdownOpen = true;
          var dd = document.getElementById('ss-dropdown');
          if (dd) dd.classList.add('open');
        };
        reader.readAsText(file);
      });
    }

    // Click to apply / delete / reorder via delegation
    var list = document.getElementById('ss-list');
    if (list) {
      list.addEventListener('click', function (e) {
        // Delete button
        var delBtn = e.target.closest('[data-del]');
        if (delBtn) {
          e.stopPropagation();
          var delId = delBtn.getAttribute('data-del');
          deleteSearch(delId);
          toast('Search deleted');
          renderSavedSearches(_container);
          _dropdownOpen = true;
          var dd = document.getElementById('ss-dropdown');
          if (dd) dd.classList.add('open');
          return;
        }
        // Move up
        var upBtn = e.target.closest('[data-move-up]');
        if (upBtn) {
          e.stopPropagation();
          moveUp(upBtn.getAttribute('data-move-up'));
          renderSavedSearches(_container);
          _dropdownOpen = true;
          var dd3 = document.getElementById('ss-dropdown');
          if (dd3) dd3.classList.add('open');
          return;
        }
        // Move down
        var downBtn = e.target.closest('[data-move-down]');
        if (downBtn) {
          e.stopPropagation();
          moveDown(downBtn.getAttribute('data-move-down'));
          renderSavedSearches(_container);
          _dropdownOpen = true;
          var dd4 = document.getElementById('ss-dropdown');
          if (dd4) dd4.classList.add('open');
          return;
        }
        // Badge click to apply
        var badgeEl = e.target.closest('[data-apply]');
        if (badgeEl) {
          e.stopPropagation();
          applySearch(badgeEl.getAttribute('data-apply'));
          _dropdownOpen = false;
          var dd5 = document.getElementById('ss-dropdown');
          if (dd5) dd5.classList.remove('open');
          return;
        }
        // Click item to apply
        var item = e.target.closest('.ss-item');
        if (item) {
          var applyId = item.getAttribute('data-id');
          applySearch(applyId);
          _dropdownOpen = false;
          var dd2 = document.getElementById('ss-dropdown');
          if (dd2) dd2.classList.remove('open');
        }
      });
    }
  }

  // ─── Public API ───────────────────────────────────────────────────
  window.CortexSavedSearches = {
    saveSearch: saveSearch,
    deleteSearch: deleteSearch,
    getSavedSearches: getSavedSearches,
    applySearch: applySearch,
    renderSavedSearches: renderSavedSearches,
    moveUp: moveUp,
    moveDown: moveDown,
    exportSearches: exportSearches,
    importSearches: importSearches,
    renameSearch: renameSearch
  };

  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.SavedSearches = {
    saveSearch: saveSearch,
    deleteSearch: deleteSearch,
    getSavedSearches: getSavedSearches,
    applySearch: applySearch,
    renderSavedSearches: renderSavedSearches,
    moveUp: moveUp,
    moveDown: moveDown,
    exportSearches: exportSearches,
    importSearches: importSearches,
    renameSearch: renameSearch,
    version: '1.1.0',
  };

})();
