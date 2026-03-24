/**
 * [CF-017] Job Search Filters — Budget, Client History, Posted Date
 * Advanced filtering: min/max budget, client spend history, hours billed,
 * post age, hire rate, and payment verification.
 *
 * window.CortexFreelancer.JobFilters
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  // ─── Constants ──────────────────────────────────────────────────────
  var STORAGE_KEY = 'cortex_job_filters_saved';

  var CLIENT_SPENT_TIERS = [
    { value: 0, label: 'Any' },
    { value: 100, label: '$100+' },
    { value: 1000, label: '$1K+' },
    { value: 5000, label: '$5K+' },
    { value: 10000, label: '$10K+' },
    { value: 50000, label: '$50K+' },
    { value: 100000, label: '$100K+' }
  ];

  var HOURS_BILLED_TIERS = [
    { value: 0, label: 'Any' },
    { value: 10, label: '10+ hrs' },
    { value: 100, label: '100+ hrs' },
    { value: 500, label: '500+ hrs' },
    { value: 1000, label: '1000+ hrs' }
  ];

  var POST_AGE_OPTIONS = [
    { value: 0, label: 'Any time' },
    { value: 1, label: 'Last hour' },
    { value: 6, label: 'Last 6 hours' },
    { value: 24, label: 'Last 24 hours' },
    { value: 72, label: 'Last 3 days' },
    { value: 168, label: 'Last 7 days' },
    { value: 720, label: 'Last 30 days' }
  ];

  var HIRE_RATE_OPTIONS = [
    { value: 0, label: 'Any' },
    { value: 20, label: '20%+' },
    { value: 40, label: '40%+' },
    { value: 60, label: '60%+' },
    { value: 80, label: '80%+' }
  ];

  var DEFAULT_FILTER = {
    budgetMin: 0,
    budgetMax: 0,
    clientMinSpent: 0,
    clientMinHoursBilled: 0,
    maxPostAgeHours: 0,
    minHireRate: 0,
    paymentVerified: false,
    hasClientHistory: false
  };

  // ─── CSS ────────────────────────────────────────────────────────────
  var CSS_INJECTED = false;
  function injectCSS() {
    if (CSS_INJECTED) return;
    CSS_INJECTED = true;
    var style = document.createElement('style');
    style.textContent = [
      '.jf-panel{background:#111;border:1px solid #222;border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;overflow:hidden;margin-bottom:16px}',
      '.jf-header{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;cursor:pointer;user-select:none;background:#151515;border-bottom:1px solid #222}',
      '.jf-header:hover{background:#1a1a1a}',
      '.jf-title{color:#e0e0e0;font-size:15px;font-weight:700;display:flex;align-items:center;gap:8px}',
      '.jf-badge{background:#7c3aed;color:#fff;font-size:11px;font-weight:700;padding:2px 8px;border-radius:10px}',
      '.jf-badge.zero{background:#333;color:#666}',
      '.jf-chevron{color:#666;font-size:13px;transition:transform .2s}',
      '.jf-chevron.open{transform:rotate(180deg)}',
      '.jf-body{display:none;padding:16px 18px 14px}',
      '.jf-body.open{display:block}',
      '.jf-section{margin-bottom:16px}',
      '.jf-section-title{color:#a78bfa;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px}',
      '.jf-row{display:flex;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap}',
      '.jf-label{color:#888;font-size:12px;font-weight:600;min-width:100px}',
      '.jf-input{background:#1a1a1a;border:1px solid #333;color:#e0e0e0;border-radius:6px;padding:6px 10px;font-size:13px;outline:none;transition:border-color .2s}',
      '.jf-input:focus{border-color:#7c3aed}',
      '.jf-input[type="number"]{width:85px}',
      '.jf-select{background:#1a1a1a;border:1px solid #333;color:#e0e0e0;border-radius:6px;padding:6px 10px;font-size:13px;cursor:pointer;outline:none}',
      '.jf-select:focus{border-color:#7c3aed}',
      '.jf-checkbox{display:flex;align-items:center;gap:6px;cursor:pointer}',
      '.jf-checkbox input{accent-color:#7c3aed;width:16px;height:16px;cursor:pointer}',
      '.jf-checkbox span{color:#ccc;font-size:13px}',
      '.jf-dash{color:#444}',
      '.jf-sep{border:none;border-top:1px solid #222;margin:14px 0}',
      '.jf-actions{display:flex;gap:10px;flex-wrap:wrap}',
      '.jf-btn{border:none;border-radius:8px;padding:8px 16px;font-size:13px;font-weight:600;cursor:pointer;transition:all .2s}',
      '.jf-btn-primary{background:#7c3aed;color:#fff}',
      '.jf-btn-primary:hover{background:#6d28d9}',
      '.jf-btn-secondary{background:#222;color:#aaa;border:1px solid #333}',
      '.jf-btn-secondary:hover{background:#2a2a2a;color:#fff}',
      '.jf-results{padding:10px 18px;background:#0d0d0d;border-top:1px solid #222;color:#888;font-size:13px}',
      '.jf-results span{color:#7c3aed;font-weight:700}',
      '@media(max-width:600px){.jf-row{flex-direction:column;align-items:flex-start;gap:6px}.jf-label{min-width:auto}}'
    ].join('\n');
    document.head.appendChild(style);
  }

  // ─── Helpers ────────────────────────────────────────────────────────
  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
  }

  function parseMoney(val) {
    if (val == null) return 0;
    var s = String(val).replace(/[^0-9.kmKM]/g, '');
    var num = parseFloat(s);
    if (isNaN(num)) return 0;
    var raw = String(val).toLowerCase();
    if (raw.indexOf('m') !== -1) num *= 1000000;
    else if (raw.indexOf('k') !== -1) num *= 1000;
    return num;
  }

  function hoursSince(dateStr) {
    if (!dateStr) return Infinity;
    try {
      var d = new Date(dateStr);
      if (isNaN(d.getTime())) return Infinity;
      return (Date.now() - d.getTime()) / 3600000;
    } catch (e) {
      return Infinity;
    }
  }

  function getActiveCount(filters) {
    var count = 0;
    if (filters.budgetMin > 0) count++;
    if (filters.budgetMax > 0) count++;
    if (filters.clientMinSpent > 0) count++;
    if (filters.clientMinHoursBilled > 0) count++;
    if (filters.maxPostAgeHours > 0) count++;
    if (filters.minHireRate > 0) count++;
    if (filters.paymentVerified) count++;
    if (filters.hasClientHistory) count++;
    return count;
  }

  function buildSelect(id, options, selected) {
    var h = '<select id="' + id + '" class="jf-select">';
    for (var i = 0; i < options.length; i++) {
      var sel = String(options[i].value) === String(selected) ? ' selected' : '';
      h += '<option value="' + esc(String(options[i].value)) + '"' + sel + '>' + esc(options[i].label) + '</option>';
    }
    h += '</select>';
    return h;
  }

  // ─── Core Filter Logic ─────────────────────────────────────────────
  function filterJobs(jobs, filters) {
    if (!jobs || !jobs.length) return [];
    var f = {};
    for (var k in DEFAULT_FILTER) f[k] = DEFAULT_FILTER[k];
    if (filters) {
      for (var k2 in filters) {
        if (filters.hasOwnProperty(k2)) f[k2] = filters[k2];
      }
    }

    return jobs.filter(function (job) {
      var budget = parseMoney(job.budget);
      if (f.budgetMin > 0 && budget > 0 && budget < f.budgetMin) return false;
      if (f.budgetMax > 0 && budget > 0 && budget > f.budgetMax) return false;

      if (f.clientMinSpent > 0) {
        var spent = parseMoney(job.clientTotalSpent || job.clientSpent || job.totalSpent);
        if (spent < f.clientMinSpent) return false;
      }

      if (f.clientMinHoursBilled > 0) {
        var hours = parseFloat(job.clientHoursBilled || job.hoursBilled || 0);
        if (isNaN(hours) || hours < f.clientMinHoursBilled) return false;
      }

      if (f.maxPostAgeHours > 0) {
        var age = hoursSince(job.postedAt || job.createdAt || job.datePosted);
        if (age > f.maxPostAgeHours) return false;
      }

      if (f.minHireRate > 0) {
        var hireRate = parseFloat(job.clientHireRate || job.hireRate || 0);
        if (isNaN(hireRate) || hireRate < f.minHireRate) return false;
      }

      if (f.paymentVerified) {
        if (!job.paymentVerified && !job.clientPaymentVerified) return false;
      }

      if (f.hasClientHistory) {
        var hasHistory = parseMoney(job.clientTotalSpent || job.clientSpent) > 0 ||
          parseFloat(job.clientHoursBilled || job.hoursBilled || 0) > 0 ||
          parseFloat(job.clientHires || 0) > 0;
        if (!hasHistory) return false;
      }

      return true;
    });
  }

  // ─── Render ─────────────────────────────────────────────────────────
  function render(container, jobs, state) {
    injectCSS();

    var active = getActiveCount(state.filters);
    var filtered = filterJobs(jobs, state.filters);

    var h = '<div class="jf-panel">';

    h += '<div class="jf-header" data-jf="toggle">';
    h += '<span class="jf-title">⚙️ Advanced Filters <span class="jf-badge' + (active === 0 ? ' zero' : '') + '">' + active + '</span></span>';
    h += '<span class="jf-chevron' + (state.open ? ' open' : '') + '">▼</span>';
    h += '</div>';

    h += '<div class="jf-body' + (state.open ? ' open' : '') + '">';

    h += '<div class="jf-section">';
    h += '<div class="jf-section-title">Budget</div>';
    h += '<div class="jf-row">';
    h += '<span class="jf-label">Range ($)</span>';
    h += '<input type="number" class="jf-input" id="jf-budgetMin" placeholder="Min" min="0" value="' + (state.filters.budgetMin || '') + '">';
    h += '<span class="jf-dash">—</span>';
    h += '<input type="number" class="jf-input" id="jf-budgetMax" placeholder="Max" min="0" value="' + (state.filters.budgetMax || '') + '">';
    h += '</div></div>';

    h += '<div class="jf-section">';
    h += '<div class="jf-section-title">Client History</div>';
    h += '<div class="jf-row">';
    h += '<span class="jf-label">Min Spent</span>';
    h += buildSelect('jf-clientSpent', CLIENT_SPENT_TIERS, state.filters.clientMinSpent);
    h += '</div>';
    h += '<div class="jf-row">';
    h += '<span class="jf-label">Hours Billed</span>';
    h += buildSelect('jf-hoursBilled', HOURS_BILLED_TIERS, state.filters.clientMinHoursBilled);
    h += '</div>';
    h += '<div class="jf-row">';
    h += '<span class="jf-label">Hire Rate</span>';
    h += buildSelect('jf-hireRate', HIRE_RATE_OPTIONS, state.filters.minHireRate);
    h += '</div>';
    h += '<div class="jf-row">';
    h += '<label class="jf-checkbox"><input type="checkbox" id="jf-paymentVerified"' + (state.filters.paymentVerified ? ' checked' : '') + '><span>Payment verified only</span></label>';
    h += '</div>';
    h += '<div class="jf-row">';
    h += '<label class="jf-checkbox"><input type="checkbox" id="jf-hasHistory"' + (state.filters.hasClientHistory ? ' checked' : '') + '><span>Has prior hiring history</span></label>';
    h += '</div>';
    h += '</div>';

    h += '<div class="jf-section">';
    h += '<div class="jf-section-title">Post Age</div>';
    h += '<div class="jf-row">';
    h += '<span class="jf-label">Posted Within</span>';
    h += buildSelect('jf-postAge', POST_AGE_OPTIONS, state.filters.maxPostAgeHours);
    h += '</div></div>';

    h += '<hr class="jf-sep">';

    h += '<div class="jf-actions">';
    h += '<button class="jf-btn jf-btn-primary" data-jf="apply">Apply</button>';
    h += '<button class="jf-btn jf-btn-secondary" data-jf="clear">Clear All</button>';
    h += '<button class="jf-btn jf-btn-secondary" data-jf="save">Save Filters</button>';
    h += '<button class="jf-btn jf-btn-secondary" data-jf="load">Load Saved</button>';
    h += '</div>';

    h += '</div>';

    h += '<div class="jf-results">Showing <span>' + filtered.length + '</span> of <span>' + jobs.length + '</span> jobs</div>';

    h += '</div>';

    container.innerHTML = h;
    return filtered;
  }

  // ─── Init with UI ──────────────────────────────────────────────────
  function init(containerId, jobs, options) {
    var opts = options || {};
    var container = typeof containerId === 'string'
      ? document.getElementById(containerId) || document.querySelector(containerId)
      : containerId;
    if (!container) return null;

    var state = {
      open: !!opts.open,
      filters: JSON.parse(JSON.stringify(DEFAULT_FILTER))
    };

    if (opts.filters) {
      for (var k in opts.filters) {
        if (opts.filters.hasOwnProperty(k)) state.filters[k] = opts.filters[k];
      }
    }

    var currentJobs = jobs || [];
    var lastFiltered = [];

    function readForm() {
      var el = function (id) { return document.getElementById(id); };
      var v = function (id) { var e = el(id); return e ? e.value : ''; };
      state.filters.budgetMin = parseInt(v('jf-budgetMin'), 10) || 0;
      state.filters.budgetMax = parseInt(v('jf-budgetMax'), 10) || 0;
      state.filters.clientMinSpent = parseInt(v('jf-clientSpent'), 10) || 0;
      state.filters.clientMinHoursBilled = parseInt(v('jf-hoursBilled'), 10) || 0;
      state.filters.maxPostAgeHours = parseInt(v('jf-postAge'), 10) || 0;
      state.filters.minHireRate = parseInt(v('jf-hireRate'), 10) || 0;
      state.filters.paymentVerified = el('jf-paymentVerified') ? el('jf-paymentVerified').checked : false;
      state.filters.hasClientHistory = el('jf-hasHistory') ? el('jf-hasHistory').checked : false;
    }

    function update() {
      lastFiltered = render(container, currentJobs, state);
      bindEvents();
      if (opts.onChange) opts.onChange(lastFiltered);
      return lastFiltered;
    }

    function bindEvents() {
      var panel = container.querySelector('.jf-panel');
      if (!panel) return;

      var header = panel.querySelector('[data-jf="toggle"]');
      if (header) {
        header.addEventListener('click', function () {
          state.open = !state.open;
          update();
        });
      }

      var applyBtn = panel.querySelector('[data-jf="apply"]');
      if (applyBtn) {
        applyBtn.addEventListener('click', function () {
          readForm();
          update();
        });
      }

      var clearBtn = panel.querySelector('[data-jf="clear"]');
      if (clearBtn) {
        clearBtn.addEventListener('click', function () {
          state.filters = JSON.parse(JSON.stringify(DEFAULT_FILTER));
          update();
        });
      }

      var saveBtn = panel.querySelector('[data-jf="save"]');
      if (saveBtn) {
        saveBtn.addEventListener('click', function () {
          readForm();
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state.filters));
          } catch (e) { /* quota */ }
        });
      }

      var loadBtn = panel.querySelector('[data-jf="load"]');
      if (loadBtn) {
        loadBtn.addEventListener('click', function () {
          try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
              state.filters = JSON.parse(raw);
              update();
            }
          } catch (e) { /* ignore */ }
        });
      }
    }

    update();

    return {
      getFiltered: function () { return lastFiltered; },
      getFilters: function () { return JSON.parse(JSON.stringify(state.filters)); },
      setFilters: function (f) {
        for (var k in f) {
          if (f.hasOwnProperty(k)) state.filters[k] = f[k];
        }
        return update();
      },
      setJobs: function (newJobs) {
        currentJobs = newJobs || [];
        return update();
      },
      reset: function () {
        state.filters = JSON.parse(JSON.stringify(DEFAULT_FILTER));
        return update();
      },
      destroy: function () { container.innerHTML = ''; }
    };
  }

  // ─── Public API ────────────────────────────────────────────────────
  window.CortexFreelancer.JobFilters = {
    init: init,
    filterJobs: filterJobs,
    DEFAULT_FILTER: DEFAULT_FILTER,
    CLIENT_SPENT_TIERS: CLIENT_SPENT_TIERS,
    HOURS_BILLED_TIERS: HOURS_BILLED_TIERS,
    POST_AGE_OPTIONS: POST_AGE_OPTIONS,
    version: '1.0.0'
  };

})();
