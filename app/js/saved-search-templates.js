/**
 * [CF-029] Saved Search Templates
 * Let users save common search configs for one-click reuse.
 * CRUD operations with localStorage persistence.
 *
 * window.CortexFreelancer.SavedSearchTemplates
 */
(function () {
  'use strict';

  var CF = window.CortexFreelancer = window.CortexFreelancer || {};

  var STORAGE_KEY = 'cf_saved_search_templates';
  var MAX_TEMPLATES = 50;
  var EVENT_APPLY = 'cf:search-template-apply';
  var EVENT_CHANGE = 'cf:search-template-change';

  var _templates = [];
  var _initialized = false;

  // ─── Defaults ─────────────────────────────────────────────────────

  function getDefaultTemplates() {
    return [
      { id: _genId(), name: 'React $50+/hr US Clients', description: 'High-paying React jobs from US clients', filters: { keywords: 'React', minRate: 50, maxRate: 0, category: 'web-development', clientCountry: 'us', jobType: 'hourly', experienceLevel: 'expert', skills: ['React', 'JavaScript', 'TypeScript'], paymentVerified: true }, tags: ['frontend', 'high-pay', 'us'], isDefault: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), usageCount: 0, lastUsedAt: null },
      { id: _genId(), name: 'WordPress Quick Jobs', description: 'Short-term WordPress fixes and customizations', filters: { keywords: 'WordPress', minRate: 0, maxRate: 0, minBudget: 100, maxBudget: 1000, category: 'web-development', jobType: 'fixed', experienceLevel: 'intermediate', skills: ['WordPress', 'PHP', 'CSS'], duration: 'short' }, tags: ['wordpress', 'quick', 'fixed-price'], isDefault: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), usageCount: 0, lastUsedAt: null },
      { id: _genId(), name: 'Long-term Python Backend', description: 'Ongoing Python/Django backend development', filters: { keywords: 'Python Django', minRate: 40, category: 'web-development', jobType: 'hourly', experienceLevel: 'expert', skills: ['Python', 'Django', 'PostgreSQL'], duration: 'long', clientMinSpent: 10000 }, tags: ['python', 'backend', 'long-term'], isDefault: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), usageCount: 0, lastUsedAt: null },
      { id: _genId(), name: 'Mobile App Development', description: 'React Native & Flutter mobile projects', filters: { keywords: 'mobile app React Native Flutter', minRate: 45, category: 'mobile-development', jobType: 'hourly', experienceLevel: 'intermediate', skills: ['React Native', 'Flutter', 'Mobile'] }, tags: ['mobile', 'app', 'cross-platform'], isDefault: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), usageCount: 0, lastUsedAt: null },
      { id: _genId(), name: 'UI/UX Design $40+/hr', description: 'Mid-to-high range design projects', filters: { keywords: 'UI UX design Figma', minRate: 40, category: 'design', jobType: 'hourly', skills: ['Figma', 'UI Design', 'UX Design'], paymentVerified: true }, tags: ['design', 'figma', 'ux'], isDefault: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), usageCount: 0, lastUsedAt: null },
      { id: _genId(), name: 'Data Science & ML', description: 'Data science, ML, and analytics projects', filters: { keywords: 'data science machine learning', minRate: 50, category: 'data-science', experienceLevel: 'expert', skills: ['Python', 'Machine Learning', 'TensorFlow'], clientMinSpent: 5000 }, tags: ['data', 'ml', 'analytics'], isDefault: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), usageCount: 0, lastUsedAt: null }
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
      '.sst-btn{border:none;border-radius:8px;padding:7px 14px;font-size:12px;font-weight:600;cursor:pointer;transition:all .2s}',
      '.sst-btn-primary{background:#7c3aed;color:#fff}',
      '.sst-btn-primary:hover{background:#6d28d9}',
      '.sst-btn-secondary{background:#222;color:#aaa;border:1px solid #333}',
      '.sst-btn-secondary:hover{background:#2a2a2a;color:#fff}',
      '.sst-search-input{width:100%;padding:8px 12px;background:#1a1a1a;border:1px solid #333;border-radius:8px;color:#e0e0e0;font-size:13px;outline:none;box-sizing:border-box}',
      '.sst-search-input:focus{border-color:#7c3aed}',
      '.sst-list{max-height:480px;overflow-y:auto;padding:8px 0}',
      '.sst-card{padding:12px 18px;border-bottom:1px solid #1a1a1a;transition:background .15s}',
      '.sst-card:hover{background:#1a1a1a}',
      '.sst-card-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}',
      '.sst-card-name{color:#e0e0e0;font-size:14px;font-weight:600;flex:1}',
      '.sst-card-actions{display:flex;gap:4px;flex-shrink:0;margin-left:10px}',
      '.sst-card-btn{background:none;border:1px solid #333;color:#888;font-size:11px;padding:4px 10px;border-radius:6px;cursor:pointer;transition:all .15s}',
      '.sst-card-btn:hover{color:#e0e0e0;border-color:#555}',
      '.sst-card-btn.apply{border-color:#7c3aed;color:#a78bfa}',
      '.sst-card-btn.apply:hover{background:#7c3aed;color:#fff}',
      '.sst-card-btn.delete:hover{color:#ff4444;border-color:#ff4444}',
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
    var h = '<div class="sst-panel">';
    h += '<div class="sst-header"><span class="sst-title">Saved Search Templates <span class="sst-badge">' + templates.length + '</span></span>';
    h += '<div style="display:flex;gap:6px;">';
    h += '<button class="sst-btn sst-btn-secondary" data-sst-action="load-defaults">Load Defaults</button>';
    h += '<button class="sst-btn sst-btn-secondary" data-sst-action="export">Export</button>';
    h += '</div></div>';

    h += '<div style="padding:10px 18px;border-bottom:1px solid #222;"><input type="text" class="sst-search-input" id="sst-search-input" placeholder="Search templates..."></div>';
    h += '<div class="sst-list" id="sst-list">';

    if (templates.length === 0) {
      h += '<div class="sst-empty">No saved templates yet.<br><button class="sst-btn sst-btn-primary" data-sst-action="load-defaults" style="margin-top:12px;">Load Default Templates</button></div>';
    } else {
      for (var i = 0; i < templates.length; i++) h += _renderCard(templates[i]);
    }

    h += '</div></div>';
    container.innerHTML = h;
    _bindListEvents(container, containerId);
  }

  function _renderCard(tpl) {
    var badges = _buildFilterBadges(tpl.filters);
    var h = '<div class="sst-card" data-sst-id="' + tpl.id + '">';
    h += '<div class="sst-card-top">';
    h += '<span class="sst-card-name">' + escapeHtml(tpl.name) + '</span>';
    h += '<div class="sst-card-actions">';
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

  function _bindListEvents(container, containerId) {
    var searchInput = container.querySelector('#sst-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', function () {
        var results = searchTemplates(searchInput.value);
        var listEl = container.querySelector('#sst-list');
        if (!listEl) return;
        if (results.length === 0) { listEl.innerHTML = '<div class="sst-empty">No templates match your search.</div>'; }
        else { var html = ''; for (var i = 0; i < results.length; i++) html += _renderCard(results[i]); listEl.innerHTML = html; }
      });
    }

    container.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-sst-action]');
      if (!btn) return;
      var action = btn.getAttribute('data-sst-action');
      var id = btn.getAttribute('data-sst-id');

      if (action === 'apply' && id) applyTemplate(id);
      else if (action === 'duplicate' && id) { duplicateTemplate(id); renderTemplateList(containerId); }
      else if (action === 'delete' && id) { deleteTemplate(id); renderTemplateList(containerId); }
      else if (action === 'load-defaults') { _loadDefaults(); renderTemplateList(containerId); }
      else if (action === 'export') _handleExport();
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
    STORAGE_KEY: STORAGE_KEY,
    EVENT_APPLY: EVENT_APPLY,
    EVENT_CHANGE: EVENT_CHANGE,
    version: '1.0.0'
  };

})();
