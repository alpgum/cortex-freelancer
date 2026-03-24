/**
 * [CF-029] Saved Search Templates v2.0.0
 * Let users save common search configs for one-click reuse.
 * CRUD operations with localStorage persistence.
 *
 * v2.0.0 enhancements:
 * - Sort templates (name, usage count, last used, created date)
 * - Pin/favorite templates (always appear at top)
 * - Quick filter pills (tag-based filtering)
 * - Template usage streak tracking
 * - Batch operations (select-all, batch delete/export)
 *
 * window.CortexFreelancer.SavedSearchTemplates
 */
(function () {
  'use strict';

  var CF = window.CortexFreelancer = window.CortexFreelancer || {};

  var STORAGE_KEY = 'cf_saved_search_templates';
  var STREAK_STORAGE_KEY = 'cf_sst_usage_streak';
  var MAX_TEMPLATES = 50;
  var EVENT_APPLY = 'cf:search-template-apply';
  var EVENT_CHANGE = 'cf:search-template-change';

  var _templates = [];
  var _initialized = false;
  var _currentSort = 'name-asc';
  var _activeTagFilter = null;
  var _selectedIds = {};

  // ─── Defaults ─────────────────────────────────────────────────────

  function getDefaultTemplates() {
    return [
      { id: _genId(), name: 'React $50+/hr US Clients', description: 'High-paying React jobs from US clients', filters: { keywords: 'React', minRate: 50, maxRate: 0, category: 'web-development', clientCountry: 'us', jobType: 'hourly', experienceLevel: 'expert', skills: ['React', 'JavaScript', 'TypeScript'], paymentVerified: true }, tags: ['frontend', 'high-pay', 'us'], isDefault: true, isPinned: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), usageCount: 0, lastUsedAt: null },
      { id: _genId(), name: 'WordPress Quick Jobs', description: 'Short-term WordPress fixes and customizations', filters: { keywords: 'WordPress', minRate: 0, maxRate: 0, minBudget: 100, maxBudget: 1000, category: 'web-development', jobType: 'fixed', experienceLevel: 'intermediate', skills: ['WordPress', 'PHP', 'CSS'], duration: 'short' }, tags: ['wordpress', 'quick', 'fixed-price'], isDefault: true, isPinned: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), usageCount: 0, lastUsedAt: null },
      { id: _genId(), name: 'Long-term Python Backend', description: 'Ongoing Python/Django backend development', filters: { keywords: 'Python Django', minRate: 40, category: 'web-development', jobType: 'hourly', experienceLevel: 'expert', skills: ['Python', 'Django', 'PostgreSQL'], duration: 'long', clientMinSpent: 10000 }, tags: ['python', 'backend', 'long-term'], isDefault: true, isPinned: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), usageCount: 0, lastUsedAt: null },
      { id: _genId(), name: 'Mobile App Development', description: 'React Native & Flutter mobile projects', filters: { keywords: 'mobile app React Native Flutter', minRate: 45, category: 'mobile-development', jobType: 'hourly', experienceLevel: 'intermediate', skills: ['React Native', 'Flutter', 'Mobile'] }, tags: ['mobile', 'app', 'cross-platform'], isDefault: true, isPinned: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), usageCount: 0, lastUsedAt: null },
      { id: _genId(), name: 'UI/UX Design $40+/hr', description: 'Mid-to-high range design projects', filters: { keywords: 'UI UX design Figma', minRate: 40, category: 'design', jobType: 'hourly', skills: ['Figma', 'UI Design', 'UX Design'], paymentVerified: true }, tags: ['design', 'figma', 'ux'], isDefault: true, isPinned: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), usageCount: 0, lastUsedAt: null },
      { id: _genId(), name: 'Data Science & ML', description: 'Data science, ML, and analytics projects', filters: { keywords: 'data science machine learning', minRate: 50, category: 'data-science', experienceLevel: 'expert', skills: ['Python', 'Machine Learning', 'TensorFlow'], clientMinSpent: 5000 }, tags: ['data', 'ml', 'analytics'], isDefault: true, isPinned: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), usageCount: 0, lastUsedAt: null }
    ];
  }

  // ─── Init ─────────────────────────────────────────────────────────

  function init() {
    if (_initialized) return;
    _initialized = true;
    _load();
  }

  function _load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        _templates = Array.isArray(parsed) ? parsed : [];
      } else {
        _templates = [];
      }
    } catch (e) {
      console.warn('[CF-029] Failed to load templates:', e);
      _templates = [];
    }
  }

  function _persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(_templates));
    } catch (e) {
      console.warn('[CF-029] Failed to save templates:', e);
    }
  }

  function _notifyChange() {
    _dispatch(EVENT_CHANGE, { templates: deepClone(_templates) });
  }

  function _dispatch(eventName, detail) {
    try {
      window.dispatchEvent(new CustomEvent(eventName, { detail: detail }));
    } catch (e) { /* IE fallback ignored */ }
  }

  function _genId() {
    return 'sst_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);
  }

  function deepClone(obj) {
    try { return JSON.parse(JSON.stringify(obj)); } catch (e) { return obj; }
  }

  function escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function toast(msg) {
    _dispatch('cf:toast', { message: msg });
  }

  // ─── CRUD ─────────────────────────────────────────────────────────

  function createTemplate(config) {
    if (!_initialized) init();
    if (!config || !config.name || !config.name.trim()) return null;
    if (_templates.length >= MAX_TEMPLATES) { toast('Maximum templates reached (' + MAX_TEMPLATES + ')'); return null; }

    var tpl = {
      id: _genId(),
      name: config.name.trim(),
      description: (config.description || '').trim(),
      filters: config.filters || {},
      tags: config.tags || [],
      isDefault: false,
      isPinned: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      usageCount: 0,
      lastUsedAt: null
    };

    _templates.push(tpl);
    _persist();
    _notifyChange();
    return deepClone(tpl);
  }

  function getTemplate(id) {
    if (!_initialized) init();
    for (var i = 0; i < _templates.length; i++) {
      if (_templates[i].id === id) return deepClone(_templates[i]);
    }
    return null;
  }

  function getAllTemplates() {
    if (!_initialized) init();
    return deepClone(_templates);
  }

  function updateTemplate(id, updates) {
    if (!_initialized) init();
    for (var i = 0; i < _templates.length; i++) {
      if (_templates[i].id === id) {
        if (updates.name !== undefined) _templates[i].name = updates.name.trim();
        if (updates.description !== undefined) _templates[i].description = updates.description.trim();
        if (updates.filters !== undefined) _templates[i].filters = updates.filters;
        if (updates.tags !== undefined) _templates[i].tags = updates.tags;
        if (updates.isPinned !== undefined) _templates[i].isPinned = updates.isPinned;
        _templates[i].updatedAt = new Date().toISOString();
        _persist();
        _notifyChange();
        return deepClone(_templates[i]);
      }
    }
    return null;
  }

  function deleteTemplate(id) {
    if (!_initialized) init();
    for (var i = 0; i < _templates.length; i++) {
      if (_templates[i].id === id) {
        _templates.splice(i, 1);
        _persist();
        _notifyChange();
        return true;
      }
    }
    return false;
  }

  function applyTemplate(id) {
    if (!_initialized) init();
    for (var i = 0; i < _templates.length; i++) {
      if (_templates[i].id === id) {
        _templates[i].usageCount = (_templates[i].usageCount || 0) + 1;
        _templates[i].lastUsedAt = new Date().toISOString();
        _persist();
        _updateStreak();
        _dispatch(EVENT_APPLY, { template: deepClone(_templates[i]), filters: deepClone(_templates[i].filters) });
        return deepClone(_templates[i]);
      }
    }
    return null;
  }

  function duplicateTemplate(id) {
    if (!_initialized) init();
    var original = getTemplate(id);
    if (!original) return null;
    original.name = original.name + ' (Copy)';
    return createTemplate(original);
  }

  // ─── Pin / Favorite ───────────────────────────────────────────────

  function togglePin(id) {
    if (!_initialized) init();
    for (var i = 0; i < _templates.length; i++) {
      if (_templates[i].id === id) {
        _templates[i].isPinned = !_templates[i].isPinned;
        _templates[i].updatedAt = new Date().toISOString();
        _persist();
        _notifyChange();
        return deepClone(_templates[i]);
      }
    }
    return null;
  }

  // ─── Sort ─────────────────────────────────────────────────────────

  function sortTemplates(templates, sortKey) {
    var sorted = templates.slice();
    sorted.sort(function (a, b) {
      // Pinned always on top
      var aPinned = a.isPinned ? 1 : 0;
      var bPinned = b.isPinned ? 1 : 0;
      if (aPinned !== bPinned) return bPinned - aPinned;

      switch (sortKey) {
        case 'name-asc':
          return (a.name || '').toLowerCase() < (b.name || '').toLowerCase() ? -1 : 1;
        case 'usage-desc':
          return (b.usageCount || 0) - (a.usageCount || 0);
        case 'last-used-desc':
          var aLast = a.lastUsedAt || '';
          var bLast = b.lastUsedAt || '';
          if (!aLast && !bLast) return 0;
          if (!aLast) return 1;
          if (!bLast) return -1;
          return bLast > aLast ? 1 : -1;
        case 'created-desc':
          var aCr = a.createdAt || '';
          var bCr = b.createdAt || '';
          return bCr > aCr ? 1 : (bCr < aCr ? -1 : 0);
        default:
          return 0;
      }
    });
    return sorted;
  }

  // ─── Quick Filter Pills (Tags) ────────────────────────────────────

  function _getCommonTags(templates, maxCount) {
    var tagCounts = {};
    for (var i = 0; i < templates.length; i++) {
      var tags = templates[i].tags || [];
      for (var j = 0; j < tags.length; j++) {
        var tag = tags[j].toLowerCase();
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      }
    }
    var tagList = [];
    for (var t in tagCounts) {
      if (tagCounts.hasOwnProperty(t)) {
        tagList.push({ tag: t, count: tagCounts[t] });
      }
    }
    tagList.sort(function (a, b) { return b.count - a.count; });
    return tagList.slice(0, maxCount || 8);
  }

  function filterByTag(templates, tag) {
    if (!tag) return templates;
    var lowerTag = tag.toLowerCase();
    return templates.filter(function (tpl) {
      var tags = tpl.tags || [];
      for (var i = 0; i < tags.length; i++) {
        if (tags[i].toLowerCase() === lowerTag) return true;
      }
      return false;
    });
  }

  // ─── Usage Streak ─────────────────────────────────────────────────

  function _getStreakData() {
    try {
      var raw = localStorage.getItem(STREAK_STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore */ }
    return { currentStreak: 0, lastUsedDate: null };
  }

  function _saveStreakData(data) {
    try {
      localStorage.setItem(STREAK_STORAGE_KEY, JSON.stringify(data));
    } catch (e) { /* ignore */ }
  }

  function _updateStreak() {
    var data = _getStreakData();
    var today = new Date().toISOString().split('T')[0];

    if (data.lastUsedDate === today) {
      // Already used today, streak unchanged
      return data;
    }

    var yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    if (data.lastUsedDate === yesterday) {
      // Consecutive day — increment streak
      data.currentStreak = (data.currentStreak || 0) + 1;
    } else if (!data.lastUsedDate) {
      // First ever use
      data.currentStreak = 1;
    } else {
      // Streak broken — reset to 1
      data.currentStreak = 1;
    }

    data.lastUsedDate = today;
    _saveStreakData(data);
    return data;
  }

  function getStreak() {
    var data = _getStreakData();
    var today = new Date().toISOString().split('T')[0];
    var yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    // If last used was not today or yesterday, streak is broken
    if (data.lastUsedDate !== today && data.lastUsedDate !== yesterday) {
      return 0;
    }
    return data.currentStreak || 0;
  }

  // ─── Batch Operations ─────────────────────────────────────────────

  function batchDelete(ids) {
    if (!_initialized) init();
    if (!ids || !ids.length) return 0;
    var deleted = 0;
    for (var i = _templates.length - 1; i >= 0; i--) {
      for (var j = 0; j < ids.length; j++) {
        if (_templates[i] && _templates[i].id === ids[j]) {
          _templates.splice(i, 1);
          deleted++;
          break;
        }
      }
    }
    if (deleted > 0) {
      _persist();
      _notifyChange();
      toast('Deleted ' + deleted + ' template(s)');
    }
    return deleted;
  }

  function batchExport(ids) {
    if (!_initialized) init();
    if (!ids || !ids.length) return '[]';
    var idMap = {};
    for (var j = 0; j < ids.length; j++) idMap[ids[j]] = true;
    var selected = _templates.filter(function (tpl) { return idMap[tpl.id]; });
    return JSON.stringify(selected, null, 2);
  }

  // ─── Import / Export ──────────────────────────────────────────────

  function exportTemplates() {
    if (!_initialized) init();
    return JSON.stringify(_templates, null, 2);
  }

  function importTemplates(json) {
    if (!_initialized) init();
    try {
      var data = typeof json === 'string' ? JSON.parse(json) : json;
      if (!Array.isArray(data)) return { imported: 0, errors: ['Invalid format'] };

      var imported = 0;
      for (var i = 0; i < data.length; i++) {
        if (_templates.length >= MAX_TEMPLATES) break;
        var tpl = data[i];
        if (!tpl.name) continue;
        tpl.id = _genId();
        tpl.isDefault = false;
        tpl.isPinned = tpl.isPinned || false;
        tpl.createdAt = new Date().toISOString();
        tpl.updatedAt = new Date().toISOString();
        _templates.push(tpl);
        imported++;
      }

      if (imported > 0) {
        _persist();
        _notifyChange();
        toast('Imported ' + imported + ' template(s)');
      }

      return { imported: imported, errors: [] };
    } catch (e) {
      toast('Import failed: invalid JSON');
      return { imported: 0, errors: [e.message] };
    }
  }

  // ─── Search ───────────────────────────────────────────────────────

  function searchTemplates(query) {
    if (!_initialized) init();
    if (!query || !query.trim()) return deepClone(_templates);

    var q = query.toLowerCase().trim();
    var terms = q.split(/\s+/);

    return _templates.filter(function (tpl) {
      var searchable = [tpl.name, tpl.description, tpl.filters.keywords, tpl.filters.category, tpl.filters.clientCountry]
        .concat(tpl.tags || []).concat(tpl.filters.skills || []).join(' ').toLowerCase();
      for (var i = 0; i < terms.length; i++) {
        if (searchable.indexOf(terms[i]) === -1) return false;
      }
      return true;
    }).map(function (tpl) { return deepClone(tpl); });
  }

  // ─── CSS ──────────────────────────────────────────────────────────

  var CSS_INJECTED = false;
  function _injectCSS() {
    if (CSS_INJECTED) return;
    CSS_INJECTED = true;
    var style = document.createElement('style');
    style.id = 'cf-sst-styles';
    style.textContent = [
      '.sst-panel{background:#111;border:1px solid #222;border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;overflow:hidden;margin-bottom:16px}',
      '.sst-header{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;background:#151515;border-bottom:1px solid #222}',
      '.sst-title{color:#e0e0e0;font-size:15px;font-weight:700;display:flex;align-items:center;gap:8px}',
      '.sst-badge{background:#7c3aed;color:#fff;font-size:11px;font-weight:700;padding:2px 8px;border-radius:10px}',
      '.sst-streak-badge{background:#f59e0b;color:#111;font-size:11px;font-weight:700;padding:2px 8px;border-radius:10px;margin-left:4px}',
      '.sst-btn{border:none;border-radius:8px;padding:7px 14px;font-size:12px;font-weight:600;cursor:pointer;transition:all .2s}',
      '.sst-btn-primary{background:#7c3aed;color:#fff}',
      '.sst-btn-primary:hover{background:#6d28d9}',
      '.sst-btn-secondary{background:#222;color:#aaa;border:1px solid #333}',
      '.sst-btn-secondary:hover{background:#2a2a2a;color:#fff}',
      '.sst-btn-danger{background:#dc2626;color:#fff}',
      '.sst-btn-danger:hover{background:#b91c1c}',
      '.sst-search-input{width:100%;padding:8px 12px;background:#1a1a1a;border:1px solid #333;border-radius:8px;color:#e0e0e0;font-size:13px;outline:none;box-sizing:border-box}',
      '.sst-search-input:focus{border-color:#7c3aed}',
      '.sst-sort-bar{display:flex;align-items:center;justify-content:space-between;padding:8px 18px;border-bottom:1px solid #222;background:#141414}',
      '.sst-sort-label{color:#666;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px}',
      '.sst-sort-select{background:#1a1a1a;border:1px solid #333;border-radius:6px;color:#aaa;font-size:12px;padding:4px 8px;cursor:pointer;outline:none}',
      '.sst-sort-select:focus{border-color:#7c3aed}',
      '.sst-tag-pills{display:flex;flex-wrap:wrap;gap:6px;padding:8px 18px;border-bottom:1px solid #222}',
      '.sst-pill{background:#1e1e2e;color:#a78bfa;font-size:11px;font-weight:600;padding:4px 10px;border-radius:12px;cursor:pointer;border:1px solid transparent;transition:all .15s}',
      '.sst-pill:hover{border-color:#7c3aed;background:#2a1e4e}',
      '.sst-pill.active{background:#7c3aed;color:#fff;border-color:#7c3aed}',
      '.sst-batch-bar{display:flex;align-items:center;gap:10px;padding:8px 18px;border-bottom:1px solid #222;background:#1a1520}',
      '.sst-batch-bar label{color:#aaa;font-size:12px;cursor:pointer;display:flex;align-items:center;gap:6px}',
      '.sst-batch-bar input[type="checkbox"]{accent-color:#7c3aed;cursor:pointer}',
      '.sst-batch-count{color:#888;font-size:11px}',
      '.sst-list{max-height:480px;overflow-y:auto;padding:8px 0}',
      '.sst-card{padding:12px 18px;border-bottom:1px solid #1a1a1a;transition:background .15s}',
      '.sst-card:hover{background:#1a1a1a}',
      '.sst-card.pinned{border-left:3px solid #f59e0b}',
      '.sst-card-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}',
      '.sst-card-name{color:#e0e0e0;font-size:14px;font-weight:600;flex:1;display:flex;align-items:center;gap:6px}',
      '.sst-card-select{margin-right:8px;accent-color:#7c3aed;cursor:pointer}',
      '.sst-card-actions{display:flex;gap:4px;flex-shrink:0;margin-left:10px}',
      '.sst-card-btn{background:none;border:1px solid #333;color:#888;font-size:11px;padding:4px 10px;border-radius:6px;cursor:pointer;transition:all .15s}',
      '.sst-card-btn:hover{color:#e0e0e0;border-color:#555}',
      '.sst-card-btn.apply{border-color:#7c3aed;color:#a78bfa}',
      '.sst-card-btn.apply:hover{background:#7c3aed;color:#fff}',
      '.sst-card-btn.delete:hover{color:#ff4444;border-color:#ff4444}',
      '.sst-card-btn.pin{color:#888;border-color:#333}',
      '.sst-card-btn.pin.active{color:#f59e0b;border-color:#f59e0b}',
      '.sst-card-btn.pin:hover{color:#f59e0b;border-color:#f59e0b}',
      '.sst-card-desc{color:#777;font-size:12px;margin-bottom:6px}',
      '.sst-card-filters{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:4px}',
      '.sst-tag{background:#1e1e2e;color:#a78bfa;font-size:10px;padding:2px 7px;border-radius:10px}',
      '.sst-card-meta{color:#555;font-size:11px}',
      '.sst-empty{padding:40px 20px;text-align:center;color:#555;font-size:13px}',
      '.sst-editor{background:#111;border:1px solid #222;border-radius:12px;overflow:hidden;margin-bottom:16px}',
      '.sst-editor-header{padding:14px 18px;background:#151515;border-bottom:1px solid #222;color:#e0e0e0;font-size:15px;font-weight:700}',
      '.sst-editor-body{padding:16px 18px}',
      '.sst-form-group{margin-bottom:14px}',
      '.sst-form-label{display:block;color:#888;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px}',
      '.sst-form-input{width:100%;padding:8px 12px;background:#1a1a1a;border:1px solid #333;border-radius:8px;color:#e0e0e0;font-size:13px;outline:none;box-sizing:border-box}',
      '.sst-form-input:focus{border-color:#7c3aed}',
      '.sst-form-select{width:100%;padding:8px 12px;background:#1a1a1a;border:1px solid #333;border-radius:8px;color:#e0e0e0;font-size:13px;cursor:pointer;outline:none;box-sizing:border-box}',
      '.sst-form-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}',
      '.sst-form-actions{display:flex;gap:10px;padding-top:10px;border-top:1px solid #222;margin-top:16px}'
    ].join('\n');
    document.head.appendChild(style);
  }

  // ─── Render: Template List ────────────────────────────────────────

  function renderTemplateList(containerId) {
    _injectCSS();
    var container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
    if (!container) return;
    if (!_initialized) init();

    var templates = _templates;
    var streakCount = getStreak();

    var h = '<div class="sst-panel">';

    // Header with streak
    h += '<div class="sst-header"><span class="sst-title">Saved Search Templates <span class="sst-badge">' + templates.length + '</span>';
    if (streakCount > 0) {
      h += '<span class="sst-streak-badge" title="Usage streak: ' + streakCount + ' day(s) in a row">' + streakCount + '-day streak</span>';
    }
    h += '</span>';
    h += '<div style="display:flex;gap:6px;">';
    h += '<button class="sst-btn sst-btn-secondary" data-sst-action="load-defaults">Load Defaults</button>';
    h += '<button class="sst-btn sst-btn-secondary" data-sst-action="export">Export</button>';
    h += '</div></div>';

    // Search bar
    h += '<div style="padding:10px 18px;border-bottom:1px solid #222;"><input type="text" class="sst-search-input" id="sst-search-input" placeholder="Search templates..."></div>';

    // Quick filter pills
    var commonTags = _getCommonTags(templates, 8);
    if (commonTags.length > 0) {
      h += '<div class="sst-tag-pills" id="sst-tag-pills">';
      h += '<span class="sst-pill' + (_activeTagFilter === null ? ' active' : '') + '" data-sst-tag-filter="">All</span>';
      for (var t = 0; t < commonTags.length; t++) {
        var isActive = _activeTagFilter === commonTags[t].tag;
        h += '<span class="sst-pill' + (isActive ? ' active' : '') + '" data-sst-tag-filter="' + escapeHtml(commonTags[t].tag) + '">' + escapeHtml(commonTags[t].tag) + ' (' + commonTags[t].count + ')</span>';
      }
      h += '</div>';
    }

    // Sort bar
    h += '<div class="sst-sort-bar">';
    h += '<span class="sst-sort-label">Sort by</span>';
    h += '<select class="sst-sort-select" id="sst-sort-select">';
    h += '<option value="name-asc"' + (_currentSort === 'name-asc' ? ' selected' : '') + '>Name (A-Z)</option>';
    h += '<option value="usage-desc"' + (_currentSort === 'usage-desc' ? ' selected' : '') + '>Most Used</option>';
    h += '<option value="last-used-desc"' + (_currentSort === 'last-used-desc' ? ' selected' : '') + '>Recently Used</option>';
    h += '<option value="created-desc"' + (_currentSort === 'created-desc' ? ' selected' : '') + '>Newest First</option>';
    h += '</select></div>';

    // Batch operations bar
    var selectedCount = _countSelected();
    h += '<div class="sst-batch-bar">';
    h += '<label><input type="checkbox" id="sst-select-all"' + (_isAllSelected(templates) ? ' checked' : '') + '> Select All</label>';
    h += '<span class="sst-batch-count">' + selectedCount + ' selected</span>';
    if (selectedCount > 0) {
      h += '<button class="sst-btn sst-btn-danger" data-sst-action="batch-delete" style="padding:4px 10px;font-size:11px;">Delete Selected</button>';
      h += '<button class="sst-btn sst-btn-secondary" data-sst-action="batch-export" style="padding:4px 10px;font-size:11px;">Export Selected</button>';
    }
    h += '</div>';

    // Template list
    h += '<div class="sst-list" id="sst-list">';

    // Apply tag filter, then sort
    var displayTemplates = templates;
    if (_activeTagFilter) {
      displayTemplates = filterByTag(templates, _activeTagFilter);
    }
    displayTemplates = sortTemplates(displayTemplates, _currentSort);

    if (displayTemplates.length === 0) {
      h += '<div class="sst-empty">No saved templates yet.<br><button class="sst-btn sst-btn-primary" data-sst-action="load-defaults" style="margin-top:12px;">Load Default Templates</button></div>';
    } else {
      for (var i = 0; i < displayTemplates.length; i++) h += _renderCard(displayTemplates[i]);
    }

    h += '</div></div>';
    container.innerHTML = h;
    _bindListEvents(container, containerId);
  }

  function _renderCard(tpl) {
    var badges = _buildFilterBadges(tpl.filters);
    var isPinned = tpl.isPinned;
    var isSelected = !!_selectedIds[tpl.id];
    var h = '<div class="sst-card' + (isPinned ? ' pinned' : '') + '" data-sst-id="' + tpl.id + '">';
    h += '<div class="sst-card-top">';
    h += '<input type="checkbox" class="sst-card-select" data-sst-select="' + tpl.id + '"' + (isSelected ? ' checked' : '') + '>';
    h += '<span class="sst-card-name">' + escapeHtml(tpl.name);
    if (isPinned) h += ' <span style="color:#f59e0b;font-size:12px;" title="Pinned">&#9733;</span>';
    h += '</span>';
    h += '<div class="sst-card-actions">';
    h += '<button class="sst-card-btn pin' + (isPinned ? ' active' : '') + '" data-sst-action="pin" data-sst-id="' + tpl.id + '" title="' + (isPinned ? 'Unpin' : 'Pin') + '">' + (isPinned ? '&#9733;' : '&#9734;') + '</button>';
    h += '<button class="sst-card-btn apply" data-sst-action="apply" data-sst-id="' + tpl.id + '">Apply</button>';
    h += '<button class="sst-card-btn" data-sst-action="duplicate" data-sst-id="' + tpl.id + '">Clone</button>';
    h += '<button class="sst-card-btn delete" data-sst-action="delete" data-sst-id="' + tpl.id + '">&times;</button>';
    h += '</div></div>';
    if (tpl.description) h += '<div class="sst-card-desc">' + escapeHtml(tpl.description) + '</div>';
    if (badges.length > 0) {
      h += '<div class="sst-card-filters">';
      for (var i = 0; i < badges.length; i++) h += '<span class="sst-tag">' + escapeHtml(badges[i]) + '</span>';
      h += '</div>';
    }
    var meta = [];
    if (tpl.usageCount > 0) meta.push('Used ' + tpl.usageCount + 'x');
    if (tpl.isDefault) meta.push('Default');
    if (tpl.isPinned) meta.push('Pinned');
    if (meta.length) h += '<div class="sst-card-meta">' + escapeHtml(meta.join(' · ')) + '</div>';
    h += '</div>';
    return h;
  }

  function _buildFilterBadges(filters) {
    var badges = [];
    if (filters.keywords) badges.push(filters.keywords.split(/\s+/).slice(0, 3).join(' '));
    if (filters.minRate) badges.push('$' + filters.minRate + '+/hr');
    if (filters.clientCountry) badges.push(filters.clientCountry.toUpperCase());
    if (filters.jobType) badges.push(filters.jobType);
    if (filters.experienceLevel) badges.push(filters.experienceLevel);
    if (filters.category) badges.push(filters.category.replace(/-/g, ' '));
    if (filters.paymentVerified) badges.push('verified');
    if (filters.skills && filters.skills.length) badges.push(filters.skills.length + ' skill(s)');
    return badges;
  }

  function _countSelected() {
    var count = 0;
    for (var id in _selectedIds) {
      if (_selectedIds.hasOwnProperty(id) && _selectedIds[id]) count++;
    }
    return count;
  }

  function _isAllSelected(templates) {
    if (templates.length === 0) return false;
    for (var i = 0; i < templates.length; i++) {
      if (!_selectedIds[templates[i].id]) return false;
    }
    return true;
  }

  function _getSelectedIds() {
    var ids = [];
    for (var id in _selectedIds) {
      if (_selectedIds.hasOwnProperty(id) && _selectedIds[id]) ids.push(id);
    }
    return ids;
  }

  function _bindListEvents(container, containerId) {
    var searchInput = container.querySelector('#sst-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', function () {
        var query = searchInput.value;
        var results = searchTemplates(query);
        if (_activeTagFilter) {
          results = filterByTag(results, _activeTagFilter);
        }
        results = sortTemplates(results, _currentSort);
        var listEl = container.querySelector('#sst-list');
        if (!listEl) return;
        if (results.length === 0) { listEl.innerHTML = '<div class="sst-empty">No templates match your search.</div>'; }
        else { var html = ''; for (var i = 0; i < results.length; i++) html += _renderCard(results[i]); listEl.innerHTML = html; }
      });
    }

    // Sort dropdown
    var sortSelect = container.querySelector('#sst-sort-select');
    if (sortSelect) {
      sortSelect.addEventListener('change', function () {
        _currentSort = sortSelect.value;
        renderTemplateList(containerId);
      });
    }

    // Select-all checkbox
    var selectAllCheckbox = container.querySelector('#sst-select-all');
    if (selectAllCheckbox) {
      selectAllCheckbox.addEventListener('change', function () {
        var checked = selectAllCheckbox.checked;
        for (var i = 0; i < _templates.length; i++) {
          _selectedIds[_templates[i].id] = checked;
        }
        renderTemplateList(containerId);
      });
    }

    container.addEventListener('click', function (e) {
      // Tag pill filter
      var pill = e.target.closest('[data-sst-tag-filter]');
      if (pill) {
        var tagValue = pill.getAttribute('data-sst-tag-filter');
        _activeTagFilter = tagValue || null;
        renderTemplateList(containerId);
        return;
      }

      var btn = e.target.closest('[data-sst-action]');
      if (!btn) return;
      var action = btn.getAttribute('data-sst-action');
      var id = btn.getAttribute('data-sst-id');

      if (action === 'apply' && id) applyTemplate(id);
      else if (action === 'pin' && id) { togglePin(id); renderTemplateList(containerId); }
      else if (action === 'duplicate' && id) { duplicateTemplate(id); renderTemplateList(containerId); }
      else if (action === 'delete' && id) { deleteTemplate(id); delete _selectedIds[id]; renderTemplateList(containerId); }
      else if (action === 'load-defaults') { _loadDefaults(); renderTemplateList(containerId); }
      else if (action === 'export') _handleExport();
      else if (action === 'batch-delete') { batchDelete(_getSelectedIds()); _selectedIds = {}; renderTemplateList(containerId); }
      else if (action === 'batch-export') _handleBatchExport();
    });

    // Individual card select checkboxes
    container.addEventListener('change', function (e) {
      var checkbox = e.target.closest('[data-sst-select]');
      if (!checkbox) return;
      var tid = checkbox.getAttribute('data-sst-select');
      _selectedIds[tid] = checkbox.checked;
      renderTemplateList(containerId);
    });
  }

  function _loadDefaults() {
    var defaults = getDefaultTemplates();
    var names = {};
    for (var i = 0; i < _templates.length; i++) names[_templates[i].name.toLowerCase()] = true;
    var added = 0;
    for (var j = 0; j < defaults.length; j++) {
      if (_templates.length >= MAX_TEMPLATES) break;
      if (!names[defaults[j].name.toLowerCase()]) { _templates.push(defaults[j]); added++; }
    }
    if (added > 0) { _persist(); _notifyChange(); toast('Added ' + added + ' default template(s)'); }
  }

  function _handleExport() {
    try {
      var blob = new Blob([exportTemplates()], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = 'cortex-search-templates.json';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      try { navigator.clipboard.writeText(exportTemplates()); } catch (e2) { /* ignore */ }
    }
  }

  function _handleBatchExport() {
    var ids = _getSelectedIds();
    if (!ids.length) return;
    try {
      var jsonStr = batchExport(ids);
      var blob = new Blob([jsonStr], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = 'cortex-search-templates-selected.json';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast('Exported ' + ids.length + ' template(s)');
    } catch (e) {
      try { navigator.clipboard.writeText(batchExport(ids)); } catch (e2) { /* ignore */ }
    }
  }

  // ─── Render: Template Editor ──────────────────────────────────────

  function renderTemplateEditor(containerId, templateId) {
    _injectCSS();
    var container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
    if (!container) return;
    if (!_initialized) init();

    var isEdit = false;
    var tpl = null;
    if (templateId) { tpl = getTemplate(templateId); if (tpl) isEdit = true; }

    var f = tpl ? tpl.filters : {};
    var h = '<div class="sst-editor">';
    h += '<div class="sst-editor-header">' + (isEdit ? 'Edit Template' : 'Create New Template') + '</div>';
    h += '<div class="sst-editor-body">';

    h += '<div class="sst-form-group"><label class="sst-form-label">Template Name</label>';
    h += '<input type="text" class="sst-form-input" id="sst-ed-name" placeholder="e.g., React $50+/hr US Clients" value="' + escapeHtml(tpl ? tpl.name : '') + '"></div>';

    h += '<div class="sst-form-group"><label class="sst-form-label">Description</label>';
    h += '<input type="text" class="sst-form-input" id="sst-ed-desc" placeholder="Brief description..." value="' + escapeHtml(tpl ? tpl.description : '') + '"></div>';

    h += '<div class="sst-form-group"><label class="sst-form-label">Keywords</label>';
    h += '<input type="text" class="sst-form-input" id="sst-ed-keywords" placeholder="e.g., React, Node.js" value="' + escapeHtml(f.keywords || '') + '"></div>';

    h += '<div class="sst-form-row">';
    h += '<div class="sst-form-group"><label class="sst-form-label">Min Rate ($/hr)</label><input type="number" class="sst-form-input" id="sst-ed-minRate" min="0" value="' + (f.minRate || '') + '"></div>';
    h += '<div class="sst-form-group"><label class="sst-form-label">Max Rate ($/hr)</label><input type="number" class="sst-form-input" id="sst-ed-maxRate" min="0" value="' + (f.maxRate || '') + '"></div>';
    h += '</div>';

    h += '<div class="sst-form-group"><label class="sst-form-label">Skills (comma-separated)</label>';
    h += '<input type="text" class="sst-form-input" id="sst-ed-skills" placeholder="e.g., React, TypeScript" value="' + escapeHtml((f.skills || []).join(', ')) + '"></div>';

    h += '<div class="sst-form-group"><label class="sst-form-label">Tags (comma-separated)</label>';
    h += '<input type="text" class="sst-form-input" id="sst-ed-tags" placeholder="e.g., frontend, high-pay" value="' + escapeHtml((tpl && tpl.tags ? tpl.tags : []).join(', ')) + '"></div>';

    h += '<div class="sst-form-actions">';
    if (isEdit) h += '<button class="sst-btn sst-btn-primary" data-sst-ed="save" data-id="' + templateId + '">Save Changes</button>';
    else h += '<button class="sst-btn sst-btn-primary" data-sst-ed="create">Create Template</button>';
    h += '<button class="sst-btn sst-btn-secondary" data-sst-ed="cancel">Cancel</button>';
    h += '</div></div></div>';

    container.innerHTML = h;

    container.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-sst-ed]');
      if (!btn) return;
      var action = btn.getAttribute('data-sst-ed');

      if (action === 'create' || action === 'save') {
        var formData = _readEditorForm();
        if (action === 'create') { var created = createTemplate(formData); if (created) { container.innerHTML = ''; _dispatch('cf:search-template-created', { template: created }); } }
        else { var updated = updateTemplate(btn.getAttribute('data-id'), formData); if (updated) { container.innerHTML = ''; _dispatch('cf:search-template-updated', { template: updated }); } }
      } else if (action === 'cancel') {
        container.innerHTML = '';
      }
    });
  }

  function _readEditorForm() {
    var val = function (id) { var e = document.getElementById(id); return e ? (e.value || '').trim() : ''; };
    var num = function (id) { return parseInt(val(id), 10) || 0; };
    var skillsRaw = val('sst-ed-skills');
    var skills = skillsRaw ? skillsRaw.split(',').map(function (s) { return s.trim(); }).filter(Boolean) : [];
    var tagsRaw = val('sst-ed-tags');
    var tags = tagsRaw ? tagsRaw.split(',').map(function (s) { return s.trim(); }).filter(Boolean) : [];

    return {
      name: val('sst-ed-name'),
      description: val('sst-ed-desc'),
      filters: { keywords: val('sst-ed-keywords'), minRate: num('sst-ed-minRate'), maxRate: num('sst-ed-maxRate'), skills: skills },
      tags: tags
    };
  }

  // ─── Public API ───────────────────────────────────────────────────

  /**
   * Render the saved search templates panel into a container.
   * @param {HTMLElement|string} container - DOM element or selector
   */
  function render(container) {
    init();
    var el = typeof container === 'string' ? document.querySelector(container) : container;
    if (!el) return;
    renderTemplateList(el);
  }

  /** Tear down and clean up event listeners. */
  function destroy() {
    _templates = [];
    _initialized = false;
    _selectedIds = {};
    _activeTagFilter = null;
    _currentSort = 'name-asc';
    CSS_INJECTED = false;
    var styleEl = document.getElementById('cf-sst-styles');
    if (styleEl && styleEl.parentNode) styleEl.parentNode.removeChild(styleEl);
  }

  CF.SavedSearchTemplates = {
    init: init,
    render: render,
    destroy: destroy,
    createTemplate: createTemplate,
    getTemplate: getTemplate,
    getAllTemplates: getAllTemplates,
    updateTemplate: updateTemplate,
    deleteTemplate: deleteTemplate,
    applyTemplate: applyTemplate,
    duplicateTemplate: duplicateTemplate,
    exportTemplates: exportTemplates,
    importTemplates: importTemplates,
    getDefaultTemplates: getDefaultTemplates,
    searchTemplates: searchTemplates,
    renderTemplateList: renderTemplateList,
    renderTemplateEditor: renderTemplateEditor,
    togglePin: togglePin,
    sortTemplates: sortTemplates,
    filterByTag: filterByTag,
    getStreak: getStreak,
    batchDelete: batchDelete,
    batchExport: batchExport,
    STORAGE_KEY: STORAGE_KEY,
    STREAK_STORAGE_KEY: STREAK_STORAGE_KEY,
    EVENT_APPLY: EVENT_APPLY,
    EVENT_CHANGE: EVENT_CHANGE,
    version: '2.0.0'
  };

})();
