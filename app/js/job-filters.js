/**
 * [CF-017] Job Search Filters — Budget, Client History, Posted Date
 * Advanced filters: min/max budget, client spend history, hours billed, post age.
 * Exposed as window.CortexFreelancer.JobFilters
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_job_filters_presets';

  var CLIENT_SPEND_TIERS = [
    { value: 0, label: 'Any' },
    { value: 1000, label: '$1K+' },
    { value: 5000, label: '$5K+' },
    { value: 10000, label: '$10K+' },
    { value: 50000, label: '$50K+' },
    { value: 100000, label: '$100K+' }
  ];

  var CLIENT_HIRES_TIERS = [
    { value: 0, label: 'Any' },
    { value: 1, label: '1+' },
    { value: 5, label: '5+' },
    { value: 10, label: '10+' },
    { value: 25, label: '25+' },
    { value: 50, label: '50+' }
  ];

  var HOURS_BILLED_TIERS = [
    { value: 0, label: 'Any' },
    { value: 100, label: '100+' },
    { value: 500, label: '500+' },
    { value: 1000, label: '1,000+' },
    { value: 5000, label: '5,000+' }
  ];

  var POST_AGE_OPTIONS = [
    { value: 0, label: 'Any Time' },
    { value: 1, label: 'Last Hour' },
    { value: 24, label: 'Last 24 Hours' },
    { value: 72, label: 'Last 3 Days' },
    { value: 168, label: 'Last 7 Days' },
    { value: 720, label: 'Last 30 Days' }
  ];

  var BUDGET_TYPE_OPTIONS = [
    { value: 'any', label: 'Any Type' },
    { value: 'hourly', label: 'Hourly' },
    { value: 'fixed', label: 'Fixed Price' }
  ];

  var DEFAULT_FILTERS = {
    budgetMin: 0,
    budgetMax: 0,
    budgetType: 'any',
    clientMinSpent: 0,
    clientMinHires: 0,
    clientMinHoursBilled: 0,
    clientMinRating: 0,
    paymentVerified: false,
    maxPostAgeHours: 0,
    maxProposals: 0,
    excludeNoRating: false
  };

  // ─── Mock Job Data ──────────────────────────────────────────────────
  var MOCK_JOBS = [
    { id: 'f001', title: 'Build a React Admin Dashboard', budgetType: 'fixed', budgetMin: 2000, budgetMax: 4000, clientSpent: 85000, clientHires: 34, clientHoursBilled: 4200, clientRating: 4.8, paymentVerified: true, proposals: 12, postedAt: Date.now() - 3600000, skills: ['React', 'TypeScript'] },
    { id: 'f002', title: 'Node.js REST API Development', budgetType: 'hourly', budgetMin: 40, budgetMax: 75, clientSpent: 120000, clientHires: 18, clientHoursBilled: 6500, clientRating: 4.9, paymentVerified: true, proposals: 8, postedAt: Date.now() - 7200000, skills: ['Node.js', 'Express'] },
    { id: 'f003', title: 'Fix WordPress Plugin Issues', budgetType: 'fixed', budgetMin: 50, budgetMax: 150, clientSpent: 300, clientHires: 1, clientHoursBilled: 10, clientRating: 0, paymentVerified: false, proposals: 42, postedAt: Date.now() - 259200000, skills: ['WordPress', 'PHP'] },
    { id: 'f004', title: 'Machine Learning Pipeline Setup', budgetType: 'hourly', budgetMin: 60, budgetMax: 100, clientSpent: 200000, clientHires: 42, clientHoursBilled: 12000, clientRating: 4.9, paymentVerified: true, proposals: 5, postedAt: Date.now() - 1800000, skills: ['Python', 'TensorFlow'] },
    { id: 'f005', title: 'Mobile App UI/UX Redesign', budgetType: 'fixed', budgetMin: 500, budgetMax: 1200, clientSpent: 15000, clientHires: 8, clientHoursBilled: 800, clientRating: 4.3, paymentVerified: true, proposals: 28, postedAt: Date.now() - 86400000, skills: ['Figma', 'UI/UX'] },
    { id: 'f006', title: 'Data Entry — Product Listings', budgetType: 'fixed', budgetMin: 30, budgetMax: 80, clientSpent: 100, clientHires: 0, clientHoursBilled: 0, clientRating: 0, paymentVerified: false, proposals: 65, postedAt: Date.now() - 604800000, skills: ['Data Entry', 'Excel'] },
    { id: 'f007', title: 'AWS Infrastructure Automation', budgetType: 'hourly', budgetMin: 55, budgetMax: 90, clientSpent: 95000, clientHires: 22, clientHoursBilled: 3500, clientRating: 4.6, paymentVerified: true, proposals: 9, postedAt: Date.now() - 10800000, skills: ['AWS', 'Terraform'] },
    { id: 'f008', title: 'Flutter Fitness App Development', budgetType: 'fixed', budgetMin: 5000, budgetMax: 10000, clientSpent: 150000, clientHires: 25, clientHoursBilled: 8000, clientRating: 4.8, paymentVerified: true, proposals: 20, postedAt: Date.now() - 43200000, skills: ['Flutter', 'Dart'] }
  ];

  // ─── State ──────────────────────────────────────────────────────────
  var state = {
    filters: Object.assign({}, DEFAULT_FILTERS),
    presets: {},
    filteredJobs: [],
    container: null
  };

  // ─── Filter Logic ───────────────────────────────────────────────────
  function applyFilters(jobs, filters) {
    return jobs.filter(function (job) {
      if (filters.budgetType !== 'any' && job.budgetType !== filters.budgetType) return false;
      if (filters.budgetMin && job.budgetMax < filters.budgetMin) return false;
      if (filters.budgetMax && job.budgetMin > filters.budgetMax) return false;
      if (filters.clientMinSpent && job.clientSpent < filters.clientMinSpent) return false;
      if (filters.clientMinHires && job.clientHires < filters.clientMinHires) return false;
      if (filters.clientMinHoursBilled && job.clientHoursBilled < filters.clientMinHoursBilled) return false;
      if (filters.clientMinRating && job.clientRating < filters.clientMinRating) return false;
      if (filters.paymentVerified && !job.paymentVerified) return false;
      if (filters.excludeNoRating && job.clientRating === 0) return false;
      if (filters.maxProposals && job.proposals > filters.maxProposals) return false;
      if (filters.maxPostAgeHours) {
        var ageHours = (Date.now() - job.postedAt) / 3600000;
        if (ageHours > filters.maxPostAgeHours) return false;
      }
      return true;
    });
  }

  // ─── Presets ────────────────────────────────────────────────────────
  function loadPresets() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }

  function savePresets(presets) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(presets)); } catch (e) { /* noop */ }
  }

  // ─── Helpers ────────────────────────────────────────────────────────
  function escapeHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function buildSelect(id, options, current) {
    return '<select id="' + id + '" style="padding:7px 10px;border-radius:6px;border:1px solid #333;background:#16213e;color:#e0e0e0;font-size:13px;">' +
      options.map(function (o) {
        return '<option value="' + o.value + '"' + (String(o.value) === String(current) ? ' selected' : '') + '>' + o.label + '</option>';
      }).join('') + '</select>';
  }

  function timeAgo(ts) {
    var diff = Date.now() - ts;
    var hrs = Math.floor(diff / 3600000);
    if (hrs < 1) return Math.floor(diff / 60000) + 'm ago';
    if (hrs < 24) return hrs + 'h ago';
    return Math.floor(hrs / 24) + 'd ago';
  }

  // ─── Render ─────────────────────────────────────────────────────────
  function render(containerId) {
    var container = typeof containerId === 'string'
      ? document.getElementById(containerId) || document.querySelector(containerId)
      : containerId;
    if (!container) return;
    state.container = container;
    state.presets = loadPresets();
    state.filteredJobs = applyFilters(MOCK_JOBS, state.filters);

    container.innerHTML = '';
    var wrap = document.createElement('div');
    wrap.style.cssText = 'font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#1a1a2e;color:#e0e0e0;border-radius:12px;padding:24px;max-width:900px;';

    wrap.innerHTML = buildUI();
    container.appendChild(wrap);
    bindEvents(wrap);
  }

  function buildUI() {
    var f = state.filters;
    var presetNames = Object.keys(state.presets);
    var activeCount = countActiveFilters(f);

    var html = '<h2 style="margin:0 0 20px;color:#00d4aa;font-size:22px;">Advanced Job Filters' +
      (activeCount > 0 ? ' <span style="background:#6c5ce7;color:#fff;padding:2px 8px;border-radius:10px;font-size:13px;">' + activeCount + ' active</span>' : '') +
      '</h2>';

    // Preset bar
    html += '<div style="display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap;align-items:center;">' +
      '<span style="font-size:13px;color:#888;">Presets:</span>' +
      '<button id="cf-jf-preset-quality" class="cf-jf-preset-btn" style="padding:6px 12px;border-radius:6px;border:1px solid #333;background:#16213e;color:#00d4aa;font-size:12px;cursor:pointer;">Quality Clients</button>' +
      '<button id="cf-jf-preset-fresh" class="cf-jf-preset-btn" style="padding:6px 12px;border-radius:6px;border:1px solid #333;background:#16213e;color:#00d4aa;font-size:12px;cursor:pointer;">Fresh Posts</button>' +
      '<button id="cf-jf-preset-highbudget" class="cf-jf-preset-btn" style="padding:6px 12px;border-radius:6px;border:1px solid #333;background:#16213e;color:#00d4aa;font-size:12px;cursor:pointer;">High Budget</button>' +
      presetNames.map(function (name) { return '<button class="cf-jf-preset-custom" data-name="' + escapeHtml(name) + '" style="padding:6px 12px;border-radius:6px;border:1px solid #6c5ce7;background:#16213e;color:#6c5ce7;font-size:12px;cursor:pointer;">' + escapeHtml(name) + '</button>'; }).join('') +
      '<button id="cf-jf-reset" style="padding:6px 12px;border-radius:6px;border:1px solid #e74c3c;background:transparent;color:#e74c3c;font-size:12px;cursor:pointer;margin-left:auto;">Reset All</button>' +
      '</div>';

    // Filter grid
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px;margin-bottom:20px;">';

    html += '<div><label style="font-size:12px;color:#888;display:block;margin-bottom:4px;">Budget Type</label>' + buildSelect('cf-jf-budgetType', BUDGET_TYPE_OPTIONS, f.budgetType) + '</div>';
    html += '<div><label style="font-size:12px;color:#888;display:block;margin-bottom:4px;">Min Budget ($)</label><input id="cf-jf-budgetMin" type="number" value="' + (f.budgetMin || '') + '" placeholder="0" style="width:100%;box-sizing:border-box;padding:7px 10px;border-radius:6px;border:1px solid #333;background:#16213e;color:#e0e0e0;font-size:13px;"></div>';
    html += '<div><label style="font-size:12px;color:#888;display:block;margin-bottom:4px;">Max Budget ($)</label><input id="cf-jf-budgetMax" type="number" value="' + (f.budgetMax || '') + '" placeholder="No limit" style="width:100%;box-sizing:border-box;padding:7px 10px;border-radius:6px;border:1px solid #333;background:#16213e;color:#e0e0e0;font-size:13px;"></div>';
    html += '<div><label style="font-size:12px;color:#888;display:block;margin-bottom:4px;">Client Total Spent</label>' + buildSelect('cf-jf-clientSpent', CLIENT_SPEND_TIERS, f.clientMinSpent) + '</div>';
    html += '<div><label style="font-size:12px;color:#888;display:block;margin-bottom:4px;">Client Hires</label>' + buildSelect('cf-jf-clientHires', CLIENT_HIRES_TIERS, f.clientMinHires) + '</div>';
    html += '<div><label style="font-size:12px;color:#888;display:block;margin-bottom:4px;">Hours Billed</label>' + buildSelect('cf-jf-hoursBilled', HOURS_BILLED_TIERS, f.clientMinHoursBilled) + '</div>';
    html += '<div><label style="font-size:12px;color:#888;display:block;margin-bottom:4px;">Min Client Rating</label><input id="cf-jf-rating" type="number" min="0" max="5" step="0.1" value="' + (f.clientMinRating || '') + '" placeholder="0-5" style="width:100%;box-sizing:border-box;padding:7px 10px;border-radius:6px;border:1px solid #333;background:#16213e;color:#e0e0e0;font-size:13px;"></div>';
    html += '<div><label style="font-size:12px;color:#888;display:block;margin-bottom:4px;">Posted Within</label>' + buildSelect('cf-jf-postAge', POST_AGE_OPTIONS, f.maxPostAgeHours) + '</div>';
    html += '<div><label style="font-size:12px;color:#888;display:block;margin-bottom:4px;">Max Proposals</label><input id="cf-jf-maxProposals" type="number" value="' + (f.maxProposals || '') + '" placeholder="No limit" style="width:100%;box-sizing:border-box;padding:7px 10px;border-radius:6px;border:1px solid #333;background:#16213e;color:#e0e0e0;font-size:13px;"></div>';

    html += '</div>';

    // Checkboxes
    html += '<div style="display:flex;gap:20px;margin-bottom:20px;flex-wrap:wrap;">';
    html += '<label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;"><input id="cf-jf-verified" type="checkbox"' + (f.paymentVerified ? ' checked' : '') + '> Payment Verified Only</label>';
    html += '<label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;"><input id="cf-jf-noRating" type="checkbox"' + (f.excludeNoRating ? ' checked' : '') + '> Exclude No-Rating Clients</label>';
    html += '</div>';

    // Apply + Save
    html += '<div style="display:flex;gap:10px;margin-bottom:24px;">' +
      '<button id="cf-jf-apply" style="padding:10px 28px;border-radius:8px;border:none;background:#00d4aa;color:#1a1a2e;font-weight:600;font-size:14px;cursor:pointer;">Apply Filters</button>' +
      '<button id="cf-jf-save" style="padding:10px 20px;border-radius:8px;border:1px solid #6c5ce7;background:transparent;color:#6c5ce7;font-size:14px;cursor:pointer;">Save as Preset</button>' +
      '</div>';

    // Results
    html += '<div style="border-top:1px solid #2d2d44;padding-top:16px;">';
    html += '<h3 style="margin:0 0 12px;font-size:16px;color:#ccc;">Filtered Results <span style="color:#888;font-weight:400;">(' + state.filteredJobs.length + ' of ' + MOCK_JOBS.length + ')</span></h3>';

    if (state.filteredJobs.length === 0) {
      html += '<div style="text-align:center;padding:30px;color:#666;">No jobs match your filter criteria. Try relaxing some filters.</div>';
    } else {
      html += '<table style="width:100%;border-collapse:collapse;font-size:13px;">' +
        '<thead><tr style="border-bottom:1px solid #2d2d44;color:#888;">' +
        '<th style="text-align:left;padding:8px 6px;">Job</th>' +
        '<th style="text-align:right;padding:8px 6px;">Budget</th>' +
        '<th style="text-align:right;padding:8px 6px;">Client Spent</th>' +
        '<th style="text-align:right;padding:8px 6px;">Hours</th>' +
        '<th style="text-align:center;padding:8px 6px;">Rating</th>' +
        '<th style="text-align:right;padding:8px 6px;">Proposals</th>' +
        '<th style="text-align:right;padding:8px 6px;">Posted</th>' +
        '</tr></thead><tbody>';

      state.filteredJobs.forEach(function (job) {
        var ratingColor = job.clientRating >= 4.5 ? '#00d4aa' : job.clientRating >= 4.0 ? '#fdcb6e' : job.clientRating > 0 ? '#e74c3c' : '#555';
        var budget = job.budgetType === 'hourly'
          ? '$' + job.budgetMin + '-$' + job.budgetMax + '/hr'
          : '$' + job.budgetMin.toLocaleString() + '-$' + job.budgetMax.toLocaleString();
        html += '<tr style="border-bottom:1px solid #1e1e38;">' +
          '<td style="padding:10px 6px;">' +
            '<div style="font-weight:500;color:#e0e0e0;">' + escapeHtml(job.title) + '</div>' +
            '<div style="font-size:11px;color:#666;margin-top:2px;">' + job.skills.join(', ') + '</div>' +
          '</td>' +
          '<td style="text-align:right;padding:10px 6px;color:#00d4aa;white-space:nowrap;">' + budget + '</td>' +
          '<td style="text-align:right;padding:10px 6px;">$' + (job.clientSpent / 1000).toFixed(0) + 'K</td>' +
          '<td style="text-align:right;padding:10px 6px;">' + job.clientHoursBilled.toLocaleString() + '</td>' +
          '<td style="text-align:center;padding:10px 6px;color:' + ratingColor + ';">' + (job.clientRating > 0 ? job.clientRating.toFixed(1) : '—') + '</td>' +
          '<td style="text-align:right;padding:10px 6px;">' + job.proposals + '</td>' +
          '<td style="text-align:right;padding:10px 6px;color:#888;white-space:nowrap;">' + timeAgo(job.postedAt) + '</td>' +
          '</tr>';
      });
      html += '</tbody></table>';
    }
    html += '</div>';
    return html;
  }

  function countActiveFilters(f) {
    var count = 0;
    if (f.budgetType !== 'any') count++;
    if (f.budgetMin) count++;
    if (f.budgetMax) count++;
    if (f.clientMinSpent) count++;
    if (f.clientMinHires) count++;
    if (f.clientMinHoursBilled) count++;
    if (f.clientMinRating) count++;
    if (f.paymentVerified) count++;
    if (f.excludeNoRating) count++;
    if (f.maxPostAgeHours) count++;
    if (f.maxProposals) count++;
    return count;
  }

  function readFiltersFromUI(wrap) {
    return {
      budgetType: wrap.querySelector('#cf-jf-budgetType').value,
      budgetMin: parseInt(wrap.querySelector('#cf-jf-budgetMin').value, 10) || 0,
      budgetMax: parseInt(wrap.querySelector('#cf-jf-budgetMax').value, 10) || 0,
      clientMinSpent: parseInt(wrap.querySelector('#cf-jf-clientSpent').value, 10) || 0,
      clientMinHires: parseInt(wrap.querySelector('#cf-jf-clientHires').value, 10) || 0,
      clientMinHoursBilled: parseInt(wrap.querySelector('#cf-jf-hoursBilled').value, 10) || 0,
      clientMinRating: parseFloat(wrap.querySelector('#cf-jf-rating').value) || 0,
      maxPostAgeHours: parseInt(wrap.querySelector('#cf-jf-postAge').value, 10) || 0,
      maxProposals: parseInt(wrap.querySelector('#cf-jf-maxProposals').value, 10) || 0,
      paymentVerified: wrap.querySelector('#cf-jf-verified').checked,
      excludeNoRating: wrap.querySelector('#cf-jf-noRating').checked
    };
  }

  function bindEvents(wrap) {
    wrap.querySelector('#cf-jf-apply').addEventListener('click', function () {
      state.filters = readFiltersFromUI(wrap);
      state.filteredJobs = applyFilters(MOCK_JOBS, state.filters);
      render(state.container);
    });

    wrap.querySelector('#cf-jf-reset').addEventListener('click', function () {
      state.filters = Object.assign({}, DEFAULT_FILTERS);
      state.filteredJobs = applyFilters(MOCK_JOBS, state.filters);
      render(state.container);
    });

    wrap.querySelector('#cf-jf-save').addEventListener('click', function () {
      var name = prompt('Enter preset name:');
      if (!name || !name.trim()) return;
      state.presets[name.trim()] = readFiltersFromUI(wrap);
      savePresets(state.presets);
      render(state.container);
    });

    // Built-in presets
    wrap.querySelector('#cf-jf-preset-quality').addEventListener('click', function () {
      state.filters = Object.assign({}, DEFAULT_FILTERS, { clientMinSpent: 10000, clientMinHires: 5, paymentVerified: true, excludeNoRating: true, clientMinRating: 4.0 });
      state.filteredJobs = applyFilters(MOCK_JOBS, state.filters);
      render(state.container);
    });
    wrap.querySelector('#cf-jf-preset-fresh').addEventListener('click', function () {
      state.filters = Object.assign({}, DEFAULT_FILTERS, { maxPostAgeHours: 24, maxProposals: 20 });
      state.filteredJobs = applyFilters(MOCK_JOBS, state.filters);
      render(state.container);
    });
    wrap.querySelector('#cf-jf-preset-highbudget').addEventListener('click', function () {
      state.filters = Object.assign({}, DEFAULT_FILTERS, { budgetMin: 1000, paymentVerified: true });
      state.filteredJobs = applyFilters(MOCK_JOBS, state.filters);
      render(state.container);
    });

    // Custom presets
    var customBtns = wrap.querySelectorAll('.cf-jf-preset-custom');
    for (var i = 0; i < customBtns.length; i++) {
      customBtns[i].addEventListener('click', function () {
        var name = this.getAttribute('data-name');
        if (state.presets[name]) {
          state.filters = Object.assign({}, DEFAULT_FILTERS, state.presets[name]);
          state.filteredJobs = applyFilters(MOCK_JOBS, state.filters);
          render(state.container);
        }
      });
    }
  }

  // ─── Public API ─────────────────────────────────────────────────────
  function init() {
    state.presets = loadPresets();
    state.filteredJobs = applyFilters(MOCK_JOBS, state.filters);
  }

  function destroy() {
    if (state.container) state.container.innerHTML = '';
    state.container = null;
  }

  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.JobFilters = {
    init: init,
    render: render,
    destroy: destroy,
    applyFilters: applyFilters,
    getFilters: function () { return Object.assign({}, state.filters); },
    setFilters: function (f) {
      state.filters = Object.assign({}, DEFAULT_FILTERS, f);
      state.filteredJobs = applyFilters(MOCK_JOBS, state.filters);
    }
  };
})();
