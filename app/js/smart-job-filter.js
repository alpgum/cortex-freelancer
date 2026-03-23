/**
 * [UW-019] Smart Job Filter — Advanced multi-criteria filtering
 * Goes beyond keyword search with budget, skill match, client quality,
 * project length, recency, timezone, safety, and negative keywords.
 * Integrates with CortexJobMatcher.renderJobMatches.
 * Exposed as window.CortexSmartFilter
 */
(function () {
  'use strict';

  // ─── Constants ──────────────────────────────────────────────────────
  var STORAGE_KEY = 'cortex_smart_filter_presets';

  var BUDGET_TYPES = [
    { value: 'any', label: 'Any' },
    { value: 'hourly', label: 'Hourly' },
    { value: 'fixed', label: 'Fixed' },
  ];

  var CLIENT_SPENT_OPTIONS = [
    { value: 0, label: 'Any' },
    { value: 1000, label: '$1K+' },
    { value: 10000, label: '$10K+' },
    { value: 100000, label: '$100K+' },
  ];

  var PROJECT_LENGTHS = [
    { value: '', label: 'Any' },
    { value: 'less_than_week', label: '< 1 week' },
    { value: '1_4_weeks', label: '1-4 weeks' },
    { value: '1_3_months', label: '1-3 months' },
    { value: '3_6_months', label: '3-6 months' },
    { value: '6_plus_months', label: '6+ months' },
  ];

  var POSTED_WITHIN = [
    { value: 0, label: 'Any time' },
    { value: 1, label: '24 hours' },
    { value: 3, label: '3 days' },
    { value: 7, label: '7 days' },
    { value: 30, label: '30 days' },
  ];

  var TIMEZONES = [
    { value: '', label: 'Any' },
    { value: 'americas', label: 'Americas' },
    { value: 'europe', label: 'Europe' },
    { value: 'asia', label: 'Asia' },
    { value: 'africa', label: 'Africa' },
  ];

  var DEFAULT_FILTERS = {
    budgetMin: 0,
    budgetMax: 0,
    budgetType: 'any',
    skillMatchMin: 0,
    clientHasHireHistory: false,
    clientMinSpent: 0,
    projectLength: '',
    postedWithinDays: 0,
    timezone: '',
    excludeRisky: false,
    keywordsExclude: '',
  };

  var BUILT_IN_PRESETS = {
    'Quick Wins': {
      budgetMin: 0,
      budgetMax: 500,
      budgetType: 'fixed',
      skillMatchMin: 70,
      clientHasHireHistory: false,
      clientMinSpent: 0,
      projectLength: '',
      postedWithinDays: 1,
      timezone: '',
      excludeRisky: false,
      keywordsExclude: '',
    },
    'High Value': {
      budgetMin: 5000,
      budgetMax: 0,
      budgetType: 'any',
      skillMatchMin: 0,
      clientHasHireHistory: true,
      clientMinSpent: 1000,
      projectLength: '',
      postedWithinDays: 0,
      timezone: '',
      excludeRisky: false,
      keywordsExclude: '',
    },
    'Safe Bets': {
      budgetMin: 0,
      budgetMax: 0,
      budgetType: 'any',
      skillMatchMin: 0,
      clientHasHireHistory: true,
      clientMinSpent: 0,
      projectLength: '',
      postedWithinDays: 0,
      timezone: '',
      excludeRisky: true,
      keywordsExclude: '',
    },
  };

  // ─── CSS ────────────────────────────────────────────────────────────
  var CSS_INJECTED = false;
  function injectCSS() {
    if (CSS_INJECTED) return;
    CSS_INJECTED = true;
    var style = document.createElement('style');
    style.textContent = [
      '.sf-panel{background:#111;border:1px solid #222;border-radius:12px;margin-bottom:20px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}',
      '.sf-header{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;cursor:pointer;user-select:none;background:#151515;border-bottom:1px solid #222}',
      '.sf-header:hover{background:#1a1a1a}',
      '.sf-header-left{display:flex;align-items:center;gap:10px}',
      '.sf-header-title{color:#e0e0e0;font-size:15px;font-weight:700}',
      '.sf-badge{background:#7c3aed;color:#fff;font-size:11px;font-weight:700;padding:2px 8px;border-radius:10px;min-width:18px;text-align:center}',
      '.sf-badge.zero{background:#333;color:#666}',
      '.sf-chevron{color:#666;font-size:13px;transition:transform .2s}',
      '.sf-chevron.open{transform:rotate(180deg)}',
      '.sf-body{display:none;padding:16px 18px 14px}',
      '.sf-body.open{display:block}',
      '.sf-row{display:flex;align-items:center;gap:12px;margin-bottom:12px;flex-wrap:wrap}',
      '.sf-label{color:#888;font-size:12px;font-weight:600;min-width:110px;text-transform:uppercase;letter-spacing:.5px}',
      '.sf-control{display:flex;align-items:center;gap:8px;flex:1;flex-wrap:wrap}',
      '.sf-input,.sf-select{background:#1a1a1a;border:1px solid #333;color:#e0e0e0;border-radius:6px;padding:6px 10px;font-size:13px;outline:none;transition:border-color .2s}',
      '.sf-input:focus,.sf-select:focus{border-color:#7c3aed}',
      '.sf-input[type="number"]{width:80px}',
      '.sf-input[type="range"]{width:120px;accent-color:#7c3aed;padding:0;border:none;background:transparent}',
      '.sf-select{min-width:100px;cursor:pointer}',
      '.sf-checkbox-wrap{display:flex;align-items:center;gap:6px;cursor:pointer}',
      '.sf-checkbox-wrap input[type="checkbox"]{accent-color:#7c3aed;width:16px;height:16px;cursor:pointer}',
      '.sf-checkbox-label{color:#ccc;font-size:13px}',
      '.sf-range-val{color:#7c3aed;font-size:12px;font-weight:700;min-width:28px;text-align:center}',
      '.sf-sep{border:none;border-top:1px solid #222;margin:14px 0}',
      '.sf-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:4px}',
      '.sf-btn{border:none;border-radius:8px;padding:8px 16px;font-size:13px;font-weight:600;cursor:pointer;transition:all .2s}',
      '.sf-btn-primary{background:#7c3aed;color:#fff}',
      '.sf-btn-primary:hover{background:#6d28d9}',
      '.sf-btn-secondary{background:#222;color:#aaa;border:1px solid #333}',
      '.sf-btn-secondary:hover{background:#2a2a2a;color:#fff}',
      '.sf-btn-ghost{background:transparent;color:#666;padding:8px 10px}',
      '.sf-btn-ghost:hover{color:#e0e0e0}',
      '.sf-preset-area{display:flex;align-items:center;gap:8px;margin-left:auto}',
      '.sf-results-bar{display:flex;align-items:center;justify-content:space-between;padding:10px 18px;background:#0d0d0d;border-top:1px solid #222;color:#888;font-size:13px}',
      '.sf-results-count span{color:#7c3aed;font-weight:700}',
      '.sf-kw-input{flex:1;min-width:160px;max-width:300px}',
      '.sf-dash{color:#444;font-size:13px}',
      '@media(max-width:600px){.sf-row{flex-direction:column;align-items:flex-start;gap:6px}.sf-label{min-width:auto}.sf-actions{flex-direction:column;align-items:stretch}.sf-preset-area{margin-left:0;margin-top:6px}}',
    ].join('\n');
    document.head.appendChild(style);
  }

  // ─── Helpers ────────────────────────────────────────────────────────
  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
  }

  function parseBudgetNumber(budgetStr) {
    if (!budgetStr) return null;
    var s = String(budgetStr).replace(/[^0-9.]/g, '');
    var n = parseFloat(s);
    return isNaN(n) ? null : n;
  }

  function detectBudgetType(job) {
    var b = String(job.budget || job.budgetType || '').toLowerCase();
    if (b.indexOf('hour') !== -1 || b.indexOf('/hr') !== -1) return 'hourly';
    if (b.indexOf('fixed') !== -1) return 'fixed';
    // Try from job fields
    if (job.type) {
      var t = String(job.type).toLowerCase();
      if (t.indexOf('hour') !== -1) return 'hourly';
      if (t.indexOf('fixed') !== -1) return 'fixed';
    }
    return 'unknown';
  }

  function daysSince(dateStr) {
    if (!dateStr) return null;
    try {
      var d = new Date(dateStr);
      if (isNaN(d.getTime())) return null;
      return (Date.now() - d.getTime()) / 86400000;
    } catch (e) {
      return null;
    }
  }

  function calcSkillMatch(jobSkills, userSkills) {
    if (!jobSkills || !jobSkills.length || !userSkills || !userSkills.length) return 100; // no data = pass
    var jobSet = jobSkills.map(function (s) { return String(s).toLowerCase().trim(); });
    var userSet = userSkills.map(function (s) { return String(s).toLowerCase().trim(); });
    var overlap = 0;
    for (var i = 0; i < jobSet.length; i++) {
      if (userSet.indexOf(jobSet[i]) !== -1) overlap++;
    }
    return Math.round((overlap / jobSet.length) * 100);
  }

  function detectTimezone(job) {
    var text = String(job.timezone || job.country || job.location || job.description || '').toLowerCase();
    if (/\b(us|usa|united states|canada|brazil|mexico|americas|est|pst|cst|mst)\b/.test(text)) return 'americas';
    if (/\b(europe|uk|germany|france|spain|italy|netherlands|poland|gmt|cet|eet)\b/.test(text)) return 'europe';
    if (/\b(asia|india|china|japan|korea|singapore|philippines|ist|jst|kst)\b/.test(text)) return 'asia';
    if (/\b(africa|nigeria|kenya|south africa|egypt|morocco|cat|eat|wat)\b/.test(text)) return 'africa';
    return '';
  }

  function normalizeProjectLength(job) {
    var raw = String(job.projectLength || job.duration || '').toLowerCase();
    if (/less\s+than\s+(a\s+)?week|<\s*1\s*w|few\s+days/.test(raw)) return 'less_than_week';
    if (/1[\s-]*(to|-)?\s*4\s*week|couple\s+weeks|2[\s-]*4\s*week/.test(raw)) return '1_4_weeks';
    if (/1[\s-]*(to|-)?\s*3\s*month/.test(raw)) return '1_3_months';
    if (/3[\s-]*(to|-)?\s*6\s*month/.test(raw)) return '3_6_months';
    if (/6\+?\s*month|more\s+than\s+6|ongoing|long[\s-]*term/.test(raw)) return '6_plus_months';
    return '';
  }

  function getClientSpent(job) {
    var spent = job.clientTotalSpent || job.clientSpent || job.totalSpent || 0;
    if (typeof spent === 'string') {
      spent = parseFloat(spent.replace(/[^0-9.]/g, ''));
      if (isNaN(spent)) spent = 0;
      // Handle "K" and "M" suffixes
      var raw = String(job.clientTotalSpent || job.clientSpent || '');
      if (/k/i.test(raw)) spent *= 1000;
      if (/m/i.test(raw)) spent *= 1000000;
    }
    return spent;
  }

  function getActiveFilterCount(filters) {
    var count = 0;
    if (filters.budgetMin > 0) count++;
    if (filters.budgetMax > 0) count++;
    if (filters.budgetType !== 'any') count++;
    if (filters.skillMatchMin > 0) count++;
    if (filters.clientHasHireHistory) count++;
    if (filters.clientMinSpent > 0) count++;
    if (filters.projectLength) count++;
    if (filters.postedWithinDays > 0) count++;
    if (filters.timezone) count++;
    if (filters.excludeRisky) count++;
    if (filters.keywordsExclude && filters.keywordsExclude.trim()) count++;
    return count;
  }

  // ─── Preset storage ─────────────────────────────────────────────────
  function loadCustomPresets() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function saveCustomPresets(presets) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
    } catch (e) { /* ignore quota */ }
  }

  function getAllPresets() {
    var custom = loadCustomPresets();
    var all = {};
    // Built-in first
    for (var k in BUILT_IN_PRESETS) all[k] = BUILT_IN_PRESETS[k];
    for (var k2 in custom) all[k2] = custom[k2];
    return all;
  }

  // ─── Core filter logic ──────────────────────────────────────────────
  function applyFilters(jobs, filters, userProfile) {
    var userSkills = (userProfile && userProfile.skills) || [];
    var excludeWords = [];
    if (filters.keywordsExclude && filters.keywordsExclude.trim()) {
      excludeWords = filters.keywordsExclude.split(',').map(function (w) {
        return w.trim().toLowerCase();
      }).filter(Boolean);
    }

    return jobs.filter(function (job) {
      // Budget range
      var budgetNum = parseBudgetNumber(job.budget);

      if (filters.budgetMin > 0 && budgetNum !== null && budgetNum < filters.budgetMin) return false;
      if (filters.budgetMax > 0 && budgetNum !== null && budgetNum > filters.budgetMax) return false;

      // Budget type
      if (filters.budgetType !== 'any') {
        var jbt = detectBudgetType(job);
        if (jbt !== 'unknown' && jbt !== filters.budgetType) return false;
      }

      // Skill match
      if (filters.skillMatchMin > 0) {
        var jobSkills = job.skills || job.requiredSkills || [];
        var matchPct = job.matchScore || calcSkillMatch(jobSkills, userSkills);
        if (matchPct < filters.skillMatchMin) return false;
      }

      // Client hire history
      if (filters.clientHasHireHistory) {
        var hasHistory = job.clientHireHistory || job.clientHires || job.hireRate;
        if (!hasHistory) return false;
      }

      // Client min spent
      if (filters.clientMinSpent > 0) {
        var spent = getClientSpent(job);
        if (spent < filters.clientMinSpent) return false;
      }

      // Project length
      if (filters.projectLength) {
        var jpl = normalizeProjectLength(job);
        if (jpl && jpl !== filters.projectLength) return false;
      }

      // Posted within
      if (filters.postedWithinDays > 0) {
        var days = daysSince(job.postedAt || job.createdAt || job.datePosted);
        if (days !== null && days > filters.postedWithinDays) return false;
      }

      // Timezone
      if (filters.timezone) {
        var jtz = detectTimezone(job);
        if (jtz && jtz !== filters.timezone) return false;
      }

      // Exclude risky (use CortexRedFlagDetector if available)
      if (filters.excludeRisky) {
        if (window.CortexRedFlagDetector && typeof window.CortexRedFlagDetector.analyze === 'function') {
          var analysis = window.CortexRedFlagDetector.analyze(job);
          if (analysis && analysis.safetyScore !== undefined && analysis.safetyScore < 70) return false;
          if (analysis && analysis.verdict === 'danger') return false;
        }
      }

      // Keywords exclude
      if (excludeWords.length > 0) {
        var searchText = String(job.title || '') + ' ' + String(job.description || '');
        searchText = searchText.toLowerCase();
        for (var i = 0; i < excludeWords.length; i++) {
          if (searchText.indexOf(excludeWords[i]) !== -1) return false;
        }
      }

      return true;
    });
  }

  // ─── Build select HTML ──────────────────────────────────────────────
  function buildSelect(id, options, selected) {
    var h = '<select id="' + id + '" class="sf-select">';
    for (var i = 0; i < options.length; i++) {
      var sel = String(options[i].value) === String(selected) ? ' selected' : '';
      h += '<option value="' + esc(String(options[i].value)) + '"' + sel + '>' + esc(options[i].label) + '</option>';
    }
    h += '</select>';
    return h;
  }

  // ─── Render filter panel ────────────────────────────────────────────
  function renderSmartFilter(jobs, userProfile, container) {
    injectCSS();

    if (typeof container === 'string') {
      container = document.querySelector(container);
    }
    if (!container) return jobs;

    var currentFilters = JSON.parse(JSON.stringify(DEFAULT_FILTERS));
    var isOpen = false;
    var panelId = 'sf-panel-' + Date.now();

    function render() {
      var activeCount = getActiveFilterCount(currentFilters);
      var filtered = applyFilters(jobs, currentFilters, userProfile);

      var h = '<div class="sf-panel" id="' + panelId + '">';

      // Header
      h += '<div class="sf-header" data-sf="toggle">';
      h += '<div class="sf-header-left">';
      h += '<span class="sf-header-title">🔍 Smart Filters</span>';
      h += '<span class="sf-badge' + (activeCount === 0 ? ' zero' : '') + '">' + activeCount + '</span>';
      h += '</div>';
      h += '<span class="sf-chevron' + (isOpen ? ' open' : '') + '">▼</span>';
      h += '</div>';

      // Body
      h += '<div class="sf-body' + (isOpen ? ' open' : '') + '">';

      // Budget range
      h += '<div class="sf-row">';
      h += '<span class="sf-label">Budget Range</span>';
      h += '<div class="sf-control">';
      h += '<input type="number" class="sf-input" id="sf-budgetMin" placeholder="Min $" min="0" value="' + (currentFilters.budgetMin || '') + '">';
      h += '<span class="sf-dash">—</span>';
      h += '<input type="number" class="sf-input" id="sf-budgetMax" placeholder="Max $" min="0" value="' + (currentFilters.budgetMax || '') + '">';
      h += '</div></div>';

      // Budget type
      h += '<div class="sf-row">';
      h += '<span class="sf-label">Budget Type</span>';
      h += '<div class="sf-control">' + buildSelect('sf-budgetType', BUDGET_TYPES, currentFilters.budgetType) + '</div>';
      h += '</div>';

      // Skill match
      h += '<div class="sf-row">';
      h += '<span class="sf-label">Min Skill Match</span>';
      h += '<div class="sf-control">';
      h += '<input type="range" class="sf-input" id="sf-skillMatch" min="0" max="100" step="5" value="' + currentFilters.skillMatchMin + '">';
      h += '<span class="sf-range-val" id="sf-skillMatchVal">' + currentFilters.skillMatchMin + '%</span>';
      h += '</div></div>';

      // Client quality
      h += '<div class="sf-row">';
      h += '<span class="sf-label">Client Quality</span>';
      h += '<div class="sf-control">';
      h += '<label class="sf-checkbox-wrap"><input type="checkbox" id="sf-hireHistory"' + (currentFilters.clientHasHireHistory ? ' checked' : '') + '><span class="sf-checkbox-label">Has hire history</span></label>';
      h += buildSelect('sf-clientSpent', CLIENT_SPENT_OPTIONS, currentFilters.clientMinSpent);
      h += '</div></div>';

      // Project length
      h += '<div class="sf-row">';
      h += '<span class="sf-label">Project Length</span>';
      h += '<div class="sf-control">' + buildSelect('sf-projectLength', PROJECT_LENGTHS, currentFilters.projectLength) + '</div>';
      h += '</div>';

      // Posted within
      h += '<div class="sf-row">';
      h += '<span class="sf-label">Posted Within</span>';
      h += '<div class="sf-control">' + buildSelect('sf-postedWithin', POSTED_WITHIN, currentFilters.postedWithinDays) + '</div>';
      h += '</div>';

      // Timezone
      h += '<div class="sf-row">';
      h += '<span class="sf-label">Timezone</span>';
      h += '<div class="sf-control">' + buildSelect('sf-timezone', TIMEZONES, currentFilters.timezone) + '</div>';
      h += '</div>';

      // Safety
      h += '<div class="sf-row">';
      h += '<span class="sf-label">Safety</span>';
      h += '<div class="sf-control">';
      h += '<label class="sf-checkbox-wrap"><input type="checkbox" id="sf-excludeRisky"' + (currentFilters.excludeRisky ? ' checked' : '') + '><span class="sf-checkbox-label">Exclude risky jobs (safety &lt; 70)</span></label>';
      h += '</div></div>';

      // Keywords exclude
      h += '<div class="sf-row">';
      h += '<span class="sf-label">Exclude Keywords</span>';
      h += '<div class="sf-control">';
      h += '<input type="text" class="sf-input sf-kw-input" id="sf-kwExclude" placeholder="word1, word2, ..." value="' + esc(currentFilters.keywordsExclude) + '">';
      h += '</div></div>';

      h += '<hr class="sf-sep">';

      // Actions row
      h += '<div class="sf-actions">';
      h += '<button class="sf-btn sf-btn-primary" data-sf="apply">Apply Filters</button>';
      h += '<button class="sf-btn sf-btn-secondary" data-sf="clear">Clear All</button>';
      h += '<div class="sf-preset-area">';
      var presets = getAllPresets();
      var presetKeys = Object.keys(presets);
      h += '<select id="sf-presetSelect" class="sf-select"><option value="">— Presets —</option>';
      for (var p = 0; p < presetKeys.length; p++) {
        h += '<option value="' + esc(presetKeys[p]) + '">' + esc(presetKeys[p]) + '</option>';
      }
      h += '</select>';
      h += '<button class="sf-btn sf-btn-ghost" data-sf="loadPreset">Load</button>';
      h += '<button class="sf-btn sf-btn-ghost" data-sf="savePreset">💾 Save</button>';
      h += '</div>';
      h += '</div>';

      h += '</div>'; // sf-body

      // Results bar
      h += '<div class="sf-results-bar">';
      h += '<span class="sf-results-count">Showing <span>' + filtered.length + '</span> of <span>' + jobs.length + '</span> jobs</span>';
      if (activeCount > 0) {
        h += '<button class="sf-btn sf-btn-ghost" data-sf="reset">✕ Reset</button>';
      }
      h += '</div>';

      h += '</div>'; // sf-panel

      container.innerHTML = h;
      bindEvents();

      return filtered;
    }

    var lastFiltered = [];

    function readFiltersFromDOM() {
      var el = function (id) { return document.getElementById(id); };
      var v = function (id) { var e = el(id); return e ? e.value : ''; };

      currentFilters.budgetMin = parseInt(v('sf-budgetMin'), 10) || 0;
      currentFilters.budgetMax = parseInt(v('sf-budgetMax'), 10) || 0;
      currentFilters.budgetType = v('sf-budgetType') || 'any';
      currentFilters.skillMatchMin = parseInt(v('sf-skillMatch'), 10) || 0;
      currentFilters.clientHasHireHistory = el('sf-hireHistory') ? el('sf-hireHistory').checked : false;
      currentFilters.clientMinSpent = parseInt(v('sf-clientSpent'), 10) || 0;
      currentFilters.projectLength = v('sf-projectLength') || '';
      currentFilters.postedWithinDays = parseInt(v('sf-postedWithin'), 10) || 0;
      currentFilters.timezone = v('sf-timezone') || '';
      currentFilters.excludeRisky = el('sf-excludeRisky') ? el('sf-excludeRisky').checked : false;
      currentFilters.keywordsExclude = v('sf-kwExclude') || '';
    }

    function bindEvents() {
      var panel = document.getElementById(panelId);
      if (!panel) return;

      // Toggle
      var header = panel.querySelector('[data-sf="toggle"]');
      if (header) {
        header.addEventListener('click', function () {
          isOpen = !isOpen;
          lastFiltered = render();
        });
      }

      // Skill match slider live update
      var slider = document.getElementById('sf-skillMatch');
      var sliderVal = document.getElementById('sf-skillMatchVal');
      if (slider && sliderVal) {
        slider.addEventListener('input', function () {
          sliderVal.textContent = slider.value + '%';
        });
      }

      // Apply
      var applyBtn = panel.querySelector('[data-sf="apply"]');
      if (applyBtn) {
        applyBtn.addEventListener('click', function () {
          readFiltersFromDOM();
          lastFiltered = render();
          // Notify CortexJobMatcher if available
          if (window.CortexJobMatcher && typeof window.CortexJobMatcher.renderJobMatches === 'function') {
            var matchContainer = document.querySelector('.jm-grid,.jm-container,[data-job-matches]');
            if (matchContainer) {
              window.CortexJobMatcher.renderJobMatches(lastFiltered, userProfile, matchContainer);
            }
          }
        });
      }

      // Clear
      var clearBtn = panel.querySelector('[data-sf="clear"]');
      if (clearBtn) {
        clearBtn.addEventListener('click', function () {
          currentFilters = JSON.parse(JSON.stringify(DEFAULT_FILTERS));
          lastFiltered = render();
        });
      }

      // Reset
      var resetBtn = panel.querySelector('[data-sf="reset"]');
      if (resetBtn) {
        resetBtn.addEventListener('click', function () {
          currentFilters = JSON.parse(JSON.stringify(DEFAULT_FILTERS));
          lastFiltered = render();
          if (window.CortexJobMatcher && typeof window.CortexJobMatcher.renderJobMatches === 'function') {
            var matchContainer = document.querySelector('.jm-grid,.jm-container,[data-job-matches]');
            if (matchContainer) {
              window.CortexJobMatcher.renderJobMatches(jobs, userProfile, matchContainer);
            }
          }
        });
      }

      // Load preset
      var loadBtn = panel.querySelector('[data-sf="loadPreset"]');
      if (loadBtn) {
        loadBtn.addEventListener('click', function () {
          var sel = document.getElementById('sf-presetSelect');
          if (!sel || !sel.value) return;
          var presets = getAllPresets();
          var preset = presets[sel.value];
          if (preset) {
            currentFilters = JSON.parse(JSON.stringify(DEFAULT_FILTERS));
            for (var k in preset) {
              if (preset.hasOwnProperty(k)) currentFilters[k] = preset[k];
            }
            lastFiltered = render();
          }
        });
      }

      // Save preset
      var saveBtn = panel.querySelector('[data-sf="savePreset"]');
      if (saveBtn) {
        saveBtn.addEventListener('click', function () {
          readFiltersFromDOM();
          var name = prompt('Preset name:');
          if (!name || !name.trim()) return;
          name = name.trim();
          var custom = loadCustomPresets();
          custom[name] = JSON.parse(JSON.stringify(currentFilters));
          saveCustomPresets(custom);
          lastFiltered = render();
        });
      }
    }

    // Initial render
    lastFiltered = render();
    return lastFiltered;
  }

  // ─── Standalone filter function (no UI) ─────────────────────────────
  function filterJobs(jobs, filters, userProfile) {
    var merged = JSON.parse(JSON.stringify(DEFAULT_FILTERS));
    if (filters) {
      for (var k in filters) {
        if (filters.hasOwnProperty(k)) merged[k] = filters[k];
      }
    }
    return applyFilters(jobs, merged, userProfile);
  }

  // ─── Public API ─────────────────────────────────────────────────────
  window.CortexSmartFilter = {
    renderSmartFilter: renderSmartFilter,
    filterJobs: filterJobs,
    getPresets: getAllPresets,
    DEFAULT_FILTERS: DEFAULT_FILTERS,
    BUILT_IN_PRESETS: BUILT_IN_PRESETS,
  };

})();
