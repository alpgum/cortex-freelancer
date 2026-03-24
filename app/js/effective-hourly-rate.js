/**
 * [CF-053] Effective Hourly Rate Calculator
 * Calculate true hourly rate including: proposal writing time, communication
 * overhead, revision time, admin tasks, and non-billable hours.
 * Exposed on window.CortexFreelancer.effectiveHourlyRate
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_effective_hourly_rate';

  /* ── Mock Data ── */

  function generateMockData() {
    var projects = [
      { name: 'React Dashboard Rebuild', client: 'Acme Corp', billedAmount: 4800, billedHours: 48,
        proposalHours: 2.5, commHours: 8, revisionHours: 6, adminHours: 3, researchHours: 4 },
      { name: 'API Integration Suite', client: 'TechFlow Inc', billedAmount: 7200, billedHours: 60,
        proposalHours: 3, commHours: 12, revisionHours: 10, adminHours: 4, researchHours: 6 },
      { name: 'Mobile App MVP', client: 'DataVerse', billedAmount: 12000, billedHours: 120,
        proposalHours: 4, commHours: 18, revisionHours: 14, adminHours: 6, researchHours: 8 },
      { name: 'E-commerce Platform', client: 'CloudNine Solutions', billedAmount: 5500, billedHours: 55,
        proposalHours: 2, commHours: 10, revisionHours: 8, adminHours: 3, researchHours: 5 },
      { name: 'Data Pipeline Optimization', client: 'NovaTech', billedAmount: 3600, billedHours: 30,
        proposalHours: 1.5, commHours: 5, revisionHours: 4, adminHours: 2, researchHours: 3 },
      { name: 'CRM System Overhaul', client: 'BlueShift Labs', billedAmount: 9000, billedHours: 90,
        proposalHours: 3.5, commHours: 14, revisionHours: 12, adminHours: 5, researchHours: 7 },
      { name: 'Analytics Dashboard', client: 'Meridian Digital', billedAmount: 6400, billedHours: 64,
        proposalHours: 2, commHours: 9, revisionHours: 7, adminHours: 3, researchHours: 4 },
      { name: 'DevOps Automation', client: 'Apex Systems', billedAmount: 8500, billedHours: 85,
        proposalHours: 3, commHours: 11, revisionHours: 9, adminHours: 4, researchHours: 6 }
    ];

    for (var i = 0; i < projects.length; i++) {
      var p = projects[i];
      p.totalHours = p.billedHours + p.proposalHours + p.commHours + p.revisionHours + p.adminHours + p.researchHours;
      p.billedRate = Math.round(p.billedAmount / p.billedHours);
      p.effectiveRate = Math.round(p.billedAmount / p.totalHours);
      p.efficiency = Math.round((p.billedHours / p.totalHours) * 100);
    }

    return projects;
  }

  /* ── Storage ── */

  /**
   * Load projects from localStorage, falling back to mock data on first use.
   * @returns {Array<Object>} Array of project objects with computed fields
   */
  function loadProjects() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore */ }
    var data = generateMockData();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return data;
  }

  /**
   * Persist the full projects array to localStorage.
   * @param {Array<Object>} projects - The projects to save
   */
  function saveProjects(projects) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
    } catch (e) { /* ignore quota errors */ }
  }

  /* ── Helpers ── */

  /**
   * Format a number as a dollar currency string (no decimals).
   * @param {number} n - The numeric value
   * @returns {string} Formatted currency string e.g. "$100"
   */
  function fmtCurrency(n) {
    return '$' + Math.round(n);
  }

  /**
   * Compute derived fields (totalHours, billedRate, effectiveRate, efficiency)
   * for a single project object. Mutates the object in place and returns it.
   * @param {Object} p - A project entry
   * @returns {Object} The same project with computed fields
   */
  function computeProjectFields(p) {
    p.totalHours = p.billedHours + p.proposalHours + p.commHours + p.revisionHours + p.adminHours + p.researchHours;
    p.billedRate = p.billedHours > 0 ? Math.round(p.billedAmount / p.billedHours) : 0;
    p.effectiveRate = p.totalHours > 0 ? Math.round(p.billedAmount / p.totalHours) : 0;
    p.efficiency = p.totalHours > 0 ? Math.round((p.billedHours / p.totalHours) * 100) : 0;
    return p;
  }

  /**
   * Sanitize a string for safe HTML insertion (prevent XSS).
   * @param {string} str - Raw user input
   * @returns {string} Escaped HTML-safe string
   */
  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  /* ── Analytics ── */

  /**
   * Compute aggregate overview metrics across all projects.
   * @param {Array<Object>} projects - Array of project objects
   * @returns {Object} Overview with billedRate, effectiveRate, efficiency, breakdown, etc.
   */
  function computeOverview(projects) {
    var totalBilled = 0, totalBilledHours = 0, totalAllHours = 0;
    var totalProposal = 0, totalComm = 0, totalRevision = 0, totalAdmin = 0, totalResearch = 0;

    for (var i = 0; i < projects.length; i++) {
      var p = projects[i];
      totalBilled += p.billedAmount;
      totalBilledHours += p.billedHours;
      totalAllHours += p.totalHours;
      totalProposal += p.proposalHours;
      totalComm += p.commHours;
      totalRevision += p.revisionHours;
      totalAdmin += p.adminHours;
      totalResearch += p.researchHours;
    }

    var nonBillable = totalAllHours - totalBilledHours;

    return {
      billedRate: totalBilledHours > 0 ? Math.round(totalBilled / totalBilledHours) : 0,
      effectiveRate: totalAllHours > 0 ? Math.round(totalBilled / totalAllHours) : 0,
      efficiency: totalAllHours > 0 ? Math.round((totalBilledHours / totalAllHours) * 100) : 0,
      totalBilled: totalBilled,
      totalBilledHours: totalBilledHours,
      totalAllHours: Math.round(totalAllHours),
      nonBillableHours: Math.round(nonBillable),
      rateLoss: totalBilledHours > 0 ? Math.round(totalBilled / totalBilledHours) - Math.round(totalBilled / totalAllHours) : 0,
      breakdown: {
        proposal: Math.round(totalProposal),
        communication: Math.round(totalComm),
        revision: Math.round(totalRevision),
        admin: Math.round(totalAdmin),
        research: Math.round(totalResearch)
      }
    };
  }

  /* ── Rendering ── */

  /**
   * Render the four overview metric cards (Billed Rate, Effective Rate, Rate Loss, Efficiency).
   * @param {Object} overview - Computed overview object from computeOverview()
   * @returns {string} HTML string for the overview cards grid
   */
  function renderOverviewCards(overview) {
    var cards = [
      { label: 'Billed Rate', value: fmtCurrency(overview.billedRate) + '/hr', sub: 'What you charge', color: '#6366f1' },
      { label: 'Effective Rate', value: fmtCurrency(overview.effectiveRate) + '/hr', sub: 'What you actually earn', color: '#10b981' },
      { label: 'Rate Loss', value: '-' + fmtCurrency(overview.rateLoss) + '/hr', sub: 'Hidden cost per hour', color: '#ef4444' },
      { label: 'Efficiency', value: overview.efficiency + '%', sub: overview.totalBilledHours + ' of ' + overview.totalAllHours + ' hrs billable', color: '#f59e0b' }
    ];

    var html = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:24px;">';
    for (var i = 0; i < cards.length; i++) {
      var c = cards[i];
      html += '<div style="background:#1e293b;border-radius:10px;padding:18px;border-top:3px solid ' + c.color + ';">'
        + '<div style="font-size:12px;color:#64748b;margin-bottom:6px;">' + c.label + '</div>'
        + '<div style="font-size:26px;font-weight:700;color:#f1f5f9;">' + c.value + '</div>'
        + '<div style="font-size:11px;color:#475569;margin-top:4px;">' + c.sub + '</div>'
        + '</div>';
    }
    html += '</div>';
    return html;
  }

  /**
   * Render horizontal bar breakdown of non-billable time categories.
   * @param {Object} overview - Computed overview object from computeOverview()
   * @returns {string} HTML string for the time breakdown panel
   */
  function renderTimeBreakdown(overview) {
    var categories = [
      { label: 'Proposal Writing', hours: overview.breakdown.proposal, color: '#8b5cf6' },
      { label: 'Communication', hours: overview.breakdown.communication, color: '#3b82f6' },
      { label: 'Revisions', hours: overview.breakdown.revision, color: '#f59e0b' },
      { label: 'Admin Tasks', hours: overview.breakdown.admin, color: '#ef4444' },
      { label: 'Research', hours: overview.breakdown.research, color: '#06b6d4' }
    ];

    var totalNonBillable = overview.nonBillableHours || 1;
    var html = '<div style="background:#1e293b;border-radius:10px;padding:20px;margin-bottom:24px;">';
    html += '<h3 style="margin:0 0 16px;font-size:14px;font-weight:600;color:#94a3b8;">NON-BILLABLE TIME BREAKDOWN</h3>';

    for (var i = 0; i < categories.length; i++) {
      var cat = categories[i];
      var pct = Math.round((cat.hours / totalNonBillable) * 100);
      html += '<div style="margin-bottom:12px;">'
        + '<div style="display:flex;justify-content:space-between;margin-bottom:4px;">'
        + '<span style="font-size:13px;color:#e2e8f0;">' + cat.label + '</span>'
        + '<span style="font-size:13px;color:#94a3b8;">' + cat.hours + ' hrs (' + pct + '%)</span>'
        + '</div>'
        + '<div style="height:8px;background:#0f172a;border-radius:4px;overflow:hidden;">'
        + '<div style="width:' + pct + '%;height:100%;background:' + cat.color + ';border-radius:4px;"></div>'
        + '</div></div>';
    }

    html += '</div>';
    return html;
  }

  /**
   * Render a DOM-based donut chart using CSS conic-gradient to visualize
   * overhead category proportions across all projects.
   * @param {Object} overview - Computed overview object from computeOverview()
   * @returns {string} HTML string for the overhead donut chart panel
   */
  function renderOverheadDonutChart(overview) {
    var categories = [
      { label: 'Proposal Writing', hours: overview.breakdown.proposal, color: '#8b5cf6' },
      { label: 'Communication', hours: overview.breakdown.communication, color: '#3b82f6' },
      { label: 'Revisions', hours: overview.breakdown.revision, color: '#f59e0b' },
      { label: 'Admin Tasks', hours: overview.breakdown.admin, color: '#ef4444' },
      { label: 'Research', hours: overview.breakdown.research, color: '#06b6d4' }
    ];

    var totalOverhead = 0;
    for (var i = 0; i < categories.length; i++) {
      totalOverhead += categories[i].hours;
    }
    if (totalOverhead === 0) totalOverhead = 1;

    /* Build the conic-gradient stops */
    var stops = [];
    var cumulative = 0;
    for (var j = 0; j < categories.length; j++) {
      var pct = (categories[j].hours / totalOverhead) * 100;
      var startDeg = Math.round(cumulative * 3.6);
      cumulative += pct;
      var endDeg = Math.round(cumulative * 3.6);
      stops.push(categories[j].color + ' ' + startDeg + 'deg ' + endDeg + 'deg');
    }
    var gradient = 'conic-gradient(' + stops.join(', ') + ')';

    var html = '<div style="background:#1e293b;border-radius:10px;padding:20px;margin-bottom:24px;">';
    html += '<h3 style="margin:0 0 16px;font-size:14px;font-weight:600;color:#94a3b8;">OVERHEAD BREAKDOWN CHART</h3>';
    html += '<div style="display:flex;align-items:center;gap:32px;flex-wrap:wrap;">';

    /* Donut ring */
    html += '<div style="position:relative;width:180px;height:180px;flex-shrink:0;">'
      + '<div style="width:180px;height:180px;border-radius:50%;background:' + gradient + ';"></div>'
      + '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);'
      + 'width:100px;height:100px;border-radius:50%;background:#1e293b;display:flex;flex-direction:column;'
      + 'align-items:center;justify-content:center;">'
      + '<div style="font-size:22px;font-weight:700;color:#f1f5f9;">' + Math.round(totalOverhead) + '</div>'
      + '<div style="font-size:11px;color:#64748b;">total hrs</div>'
      + '</div></div>';

    /* Legend */
    html += '<div style="display:flex;flex-direction:column;gap:8px;">';
    for (var k = 0; k < categories.length; k++) {
      var cat = categories[k];
      var catPct = Math.round((cat.hours / totalOverhead) * 100);
      html += '<div style="display:flex;align-items:center;gap:8px;">'
        + '<div style="width:12px;height:12px;border-radius:3px;background:' + cat.color + ';flex-shrink:0;"></div>'
        + '<span style="font-size:13px;color:#e2e8f0;">' + cat.label + '</span>'
        + '<span style="font-size:12px;color:#64748b;margin-left:auto;padding-left:12px;">' + cat.hours + ' hrs (' + catPct + '%)</span>'
        + '</div>';
    }
    html += '</div></div></div>';

    return html;
  }

  /**
   * Render a side-by-side bar chart comparing billed rate vs effective rate
   * for every project. Each project gets two horizontal bars.
   * @param {Array<Object>} projects - Array of project objects
   * @returns {string} HTML string for the comparison bar chart panel
   */
  function renderRateComparisonChart(projects) {
    var sorted = projects.slice().sort(function (a, b) { return b.billedRate - a.billedRate; });

    /* Find the maximum rate to scale bars */
    var maxRate = 0;
    for (var i = 0; i < sorted.length; i++) {
      if (sorted[i].billedRate > maxRate) maxRate = sorted[i].billedRate;
      if (sorted[i].effectiveRate > maxRate) maxRate = sorted[i].effectiveRate;
    }
    if (maxRate === 0) maxRate = 1;

    var html = '<div style="background:#1e293b;border-radius:10px;padding:20px;margin-bottom:24px;">';
    html += '<h3 style="margin:0 0 6px;font-size:14px;font-weight:600;color:#94a3b8;">BILLED vs EFFECTIVE RATE COMPARISON</h3>';
    html += '<div style="display:flex;gap:16px;margin-bottom:16px;">'
      + '<div style="display:flex;align-items:center;gap:6px;"><div style="width:12px;height:12px;border-radius:3px;background:#6366f1;"></div>'
      + '<span style="font-size:12px;color:#94a3b8;">Billed Rate</span></div>'
      + '<div style="display:flex;align-items:center;gap:6px;"><div style="width:12px;height:12px;border-radius:3px;background:#10b981;"></div>'
      + '<span style="font-size:12px;color:#94a3b8;">Effective Rate</span></div></div>';

    for (var j = 0; j < sorted.length; j++) {
      var p = sorted[j];
      var billedPct = Math.round((p.billedRate / maxRate) * 100);
      var effectivePct = Math.round((p.effectiveRate / maxRate) * 100);
      var lossPct = p.billedRate > 0 ? Math.round(((p.billedRate - p.effectiveRate) / p.billedRate) * 100) : 0;

      html += '<div style="margin-bottom:16px;">'
        + '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px;">'
        + '<span style="font-size:13px;color:#e2e8f0;font-weight:500;">' + escapeHtml(p.name) + '</span>'
        + '<span style="font-size:11px;color:#ef4444;">-' + lossPct + '% loss</span></div>';

      /* Billed rate bar */
      html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:3px;">'
        + '<div style="flex:1;height:14px;background:#0f172a;border-radius:4px;overflow:hidden;">'
        + '<div style="width:' + billedPct + '%;height:100%;background:#6366f1;border-radius:4px;'
        + 'transition:width 0.3s ease;"></div></div>'
        + '<span style="font-size:11px;color:#94a3b8;min-width:52px;text-align:right;">' + fmtCurrency(p.billedRate) + '/hr</span></div>';

      /* Effective rate bar */
      html += '<div style="display:flex;align-items:center;gap:8px;">'
        + '<div style="flex:1;height:14px;background:#0f172a;border-radius:4px;overflow:hidden;">'
        + '<div style="width:' + effectivePct + '%;height:100%;background:#10b981;border-radius:4px;'
        + 'transition:width 0.3s ease;"></div></div>'
        + '<span style="font-size:11px;color:#94a3b8;min-width:52px;text-align:right;">' + fmtCurrency(p.effectiveRate) + '/hr</span></div>';

      html += '</div>';
    }

    html += '</div>';
    return html;
  }

  /**
   * Render the project comparison data table sorted by effective rate.
   * @param {Array<Object>} projects - Array of project objects
   * @returns {string} HTML string for the project table
   */
  function renderProjectTable(projects) {
    var sorted = projects.slice().sort(function (a, b) { return b.effectiveRate - a.effectiveRate; });

    var html = '<div style="background:#1e293b;border-radius:10px;padding:20px;">';
    html += '<h3 style="margin:0 0 16px;font-size:14px;font-weight:600;color:#94a3b8;">PROJECT COMPARISON</h3>';
    html += '<div style="overflow-x:auto;">';
    html += '<table style="width:100%;border-collapse:collapse;font-size:13px;">';
    html += '<thead><tr style="border-bottom:1px solid #334155;">'
      + '<th style="text-align:left;padding:10px 8px;color:#64748b;font-weight:500;">Project</th>'
      + '<th style="text-align:right;padding:10px 8px;color:#64748b;font-weight:500;">Billed</th>'
      + '<th style="text-align:right;padding:10px 8px;color:#64748b;font-weight:500;">Billed Rate</th>'
      + '<th style="text-align:right;padding:10px 8px;color:#64748b;font-weight:500;">Effective Rate</th>'
      + '<th style="text-align:right;padding:10px 8px;color:#64748b;font-weight:500;">Efficiency</th>'
      + '<th style="text-align:right;padding:10px 8px;color:#64748b;font-weight:500;">Hidden Hours</th>'
      + '</tr></thead><tbody>';

    for (var i = 0; i < sorted.length; i++) {
      var p = sorted[i];
      var hidden = Math.round(p.totalHours - p.billedHours);
      var effColor = p.efficiency >= 75 ? '#10b981' : p.efficiency >= 60 ? '#f59e0b' : '#ef4444';

      html += '<tr style="border-bottom:1px solid #1e293b44;">'
        + '<td style="padding:10px 8px;"><div style="color:#e2e8f0;font-weight:500;">' + escapeHtml(p.name) + '</div>'
        + '<div style="color:#64748b;font-size:11px;">' + escapeHtml(p.client) + '</div></td>'
        + '<td style="padding:10px 8px;color:#f1f5f9;text-align:right;">$' + p.billedAmount.toLocaleString() + '</td>'
        + '<td style="padding:10px 8px;color:#94a3b8;text-align:right;">' + fmtCurrency(p.billedRate) + '/hr</td>'
        + '<td style="padding:10px 8px;color:' + effColor + ';text-align:right;font-weight:600;">' + fmtCurrency(p.effectiveRate) + '/hr</td>'
        + '<td style="padding:10px 8px;text-align:right;">'
        + '<span style="padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;background:' + effColor + '22;color:' + effColor + ';">'
        + p.efficiency + '%</span></td>'
        + '<td style="padding:10px 8px;color:#ef4444;text-align:right;">+' + hidden + ' hrs</td>'
        + '</tr>';
    }

    html += '</tbody></table></div></div>';
    return html;
  }

  /* ── Feature: Time Tracking Form ── */

  /**
   * Render an interactive form for adding new project entries.
   * The form collects all time-tracking fields, validates input, persists
   * to localStorage, and triggers a full re-render on submit.
   * @param {string} containerId - The DOM container ID used for re-rendering
   * @returns {string} HTML string for the time tracking form
   */
  function renderTimeTrackingForm(containerId) {
    var formId = 'ehr-add-project-form';
    var fields = [
      { id: 'ehr-f-name', label: 'Project Name', type: 'text', placeholder: 'e.g. Website Redesign', required: true },
      { id: 'ehr-f-client', label: 'Client', type: 'text', placeholder: 'e.g. Acme Corp', required: true },
      { id: 'ehr-f-billed-amount', label: 'Billed Amount ($)', type: 'number', placeholder: '0', step: '0.01', required: true },
      { id: 'ehr-f-billed-hours', label: 'Billed Hours', type: 'number', placeholder: '0', step: '0.5', required: true },
      { id: 'ehr-f-proposal-hours', label: 'Proposal Hours', type: 'number', placeholder: '0', step: '0.5', required: false },
      { id: 'ehr-f-comm-hours', label: 'Communication Hours', type: 'number', placeholder: '0', step: '0.5', required: false },
      { id: 'ehr-f-revision-hours', label: 'Revision Hours', type: 'number', placeholder: '0', step: '0.5', required: false },
      { id: 'ehr-f-admin-hours', label: 'Admin Hours', type: 'number', placeholder: '0', step: '0.5', required: false },
      { id: 'ehr-f-research-hours', label: 'Research Hours', type: 'number', placeholder: '0', step: '0.5', required: false }
    ];

    var inputStyle = 'width:100%;padding:8px 10px;border:1px solid #334155;border-radius:6px;'
      + 'background:#0f172a;color:#e2e8f0;font-size:13px;box-sizing:border-box;outline:none;';
    var labelStyle = 'display:block;font-size:12px;color:#94a3b8;margin-bottom:4px;font-weight:500;';

    var html = '<div style="background:#1e293b;border-radius:10px;padding:20px;margin-bottom:24px;">';
    html += '<h3 style="margin:0 0 16px;font-size:14px;font-weight:600;color:#94a3b8;">ADD NEW PROJECT</h3>';
    html += '<form id="' + formId + '" autocomplete="off">';
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;">';

    for (var i = 0; i < fields.length; i++) {
      var f = fields[i];
      html += '<div>'
        + '<label for="' + f.id + '" style="' + labelStyle + '">' + f.label + (f.required ? ' *' : '') + '</label>'
        + '<input id="' + f.id + '" type="' + f.type + '" placeholder="' + f.placeholder + '"'
        + (f.step ? ' step="' + f.step + '"' : '')
        + (f.required ? ' required' : '')
        + (f.type === 'number' ? ' min="0"' : '')
        + ' style="' + inputStyle + '" />'
        + '</div>';
    }

    html += '</div>';

    /* Error message area */
    html += '<div id="ehr-form-error" style="color:#ef4444;font-size:12px;margin-top:10px;display:none;"></div>';

    /* Submit button */
    html += '<div style="margin-top:16px;display:flex;gap:10px;">'
      + '<button type="submit" id="ehr-submit-btn" style="padding:9px 20px;border:none;border-radius:6px;'
      + 'background:#6366f1;color:#fff;font-size:13px;font-weight:600;cursor:pointer;'
      + 'transition:background 0.2s;">Add Project</button>'
      + '<button type="button" id="ehr-reset-btn" style="padding:9px 20px;border:1px solid #334155;border-radius:6px;'
      + 'background:transparent;color:#94a3b8;font-size:13px;font-weight:500;cursor:pointer;">Reset to Mock Data</button>'
      + '</div>';

    html += '</form></div>';

    return html;
  }

  /**
   * Attach event listeners to the time tracking form after it has been
   * rendered into the DOM. Handles submit validation and reset action.
   * @param {string} containerId - The DOM container ID used for re-rendering
   */
  function attachFormListeners(containerId) {
    var form = document.getElementById('ehr-add-project-form');
    if (!form) return;

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var errorEl = document.getElementById('ehr-form-error');

      var name = (document.getElementById('ehr-f-name').value || '').trim();
      var client = (document.getElementById('ehr-f-client').value || '').trim();
      var billedAmount = parseFloat(document.getElementById('ehr-f-billed-amount').value) || 0;
      var billedHours = parseFloat(document.getElementById('ehr-f-billed-hours').value) || 0;
      var proposalHours = parseFloat(document.getElementById('ehr-f-proposal-hours').value) || 0;
      var commHours = parseFloat(document.getElementById('ehr-f-comm-hours').value) || 0;
      var revisionHours = parseFloat(document.getElementById('ehr-f-revision-hours').value) || 0;
      var adminHours = parseFloat(document.getElementById('ehr-f-admin-hours').value) || 0;
      var researchHours = parseFloat(document.getElementById('ehr-f-research-hours').value) || 0;

      /* Validation */
      if (!name || !client) {
        if (errorEl) { errorEl.textContent = 'Project name and client are required.'; errorEl.style.display = 'block'; }
        return;
      }
      if (billedAmount <= 0 || billedHours <= 0) {
        if (errorEl) { errorEl.textContent = 'Billed amount and billed hours must be greater than zero.'; errorEl.style.display = 'block'; }
        return;
      }

      var project = computeProjectFields({
        name: name,
        client: client,
        billedAmount: billedAmount,
        billedHours: billedHours,
        proposalHours: proposalHours,
        commHours: commHours,
        revisionHours: revisionHours,
        adminHours: adminHours,
        researchHours: researchHours
      });

      var projects = loadProjects();
      projects.push(project);
      saveProjects(projects);

      /* Re-render the entire widget */
      render(containerId);
    });

    var resetBtn = document.getElementById('ehr-reset-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        localStorage.removeItem(STORAGE_KEY);
        render(containerId);
      });
    }
  }

  /* ── Feature: Export Summary ── */

  /**
   * Generate a CSV summary string for all projects including rates and hours.
   * @param {Array<Object>} projects - Array of project objects
   * @param {Object} overview - Computed overview from computeOverview()
   * @returns {string} CSV-formatted text
   */
  function generateCsvSummary(projects, overview) {
    var lines = [];
    lines.push('Project Name,Client,Billed Amount,Billed Hours,Total Hours,Billed Rate ($/hr),Effective Rate ($/hr),Efficiency (%),Proposal Hrs,Comm Hrs,Revision Hrs,Admin Hrs,Research Hrs');

    for (var i = 0; i < projects.length; i++) {
      var p = projects[i];
      lines.push(
        '"' + p.name.replace(/"/g, '""') + '",'
        + '"' + p.client.replace(/"/g, '""') + '",'
        + p.billedAmount + ','
        + p.billedHours + ','
        + p.totalHours + ','
        + p.billedRate + ','
        + p.effectiveRate + ','
        + p.efficiency + ','
        + p.proposalHours + ','
        + p.commHours + ','
        + p.revisionHours + ','
        + p.adminHours + ','
        + p.researchHours
      );
    }

    lines.push('');
    lines.push('SUMMARY');
    lines.push('Average Billed Rate ($/hr),' + overview.billedRate);
    lines.push('Average Effective Rate ($/hr),' + overview.effectiveRate);
    lines.push('Overall Efficiency (%),' + overview.efficiency);
    lines.push('Total Billed,' + overview.totalBilled);
    lines.push('Total Billed Hours,' + overview.totalBilledHours);
    lines.push('Total Hours (incl. overhead),' + overview.totalAllHours);
    lines.push('Non-Billable Hours,' + overview.nonBillableHours);
    lines.push('Rate Loss ($/hr),' + overview.rateLoss);

    return lines.join('\n');
  }

  /**
   * Trigger a browser file download of the given text content.
   * @param {string} content - The text content to download
   * @param {string} filename - The suggested filename
   * @param {string} mimeType - MIME type for the blob
   */
  function downloadFile(content, filename, mimeType) {
    var blob = new Blob([content], { type: mimeType });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }

  /**
   * Render the export summary button row.
   * @returns {string} HTML string for the export buttons section
   */
  function renderExportButtons() {
    var html = '<div style="background:#1e293b;border-radius:10px;padding:20px;margin-bottom:24px;">';
    html += '<h3 style="margin:0 0 12px;font-size:14px;font-weight:600;color:#94a3b8;">EXPORT DATA</h3>';
    html += '<p style="font-size:12px;color:#64748b;margin:0 0 14px;">Download a complete summary of all projects with rates, hours, and efficiency metrics.</p>';
    html += '<div style="display:flex;gap:10px;flex-wrap:wrap;">';

    html += '<button id="ehr-export-csv-btn" style="padding:9px 18px;border:none;border-radius:6px;'
      + 'background:#10b981;color:#fff;font-size:13px;font-weight:600;cursor:pointer;'
      + 'transition:background 0.2s;">Export as CSV</button>';

    html += '<button id="ehr-export-txt-btn" style="padding:9px 18px;border:1px solid #334155;border-radius:6px;'
      + 'background:transparent;color:#e2e8f0;font-size:13px;font-weight:500;cursor:pointer;'
      + 'transition:background 0.2s;">Export as Text</button>';

    html += '</div></div>';
    return html;
  }

  /**
   * Generate a human-readable plain text summary of all projects.
   * @param {Array<Object>} projects - Array of project objects
   * @param {Object} overview - Computed overview from computeOverview()
   * @returns {string} Formatted text summary
   */
  function generateTextSummary(projects, overview) {
    var lines = [];
    var sep = '='.repeat(72);
    lines.push(sep);
    lines.push('EFFECTIVE HOURLY RATE -- SUMMARY REPORT');
    lines.push('Generated: ' + new Date().toLocaleString());
    lines.push(sep);
    lines.push('');
    lines.push('OVERVIEW');
    lines.push('  Billed Rate:       ' + fmtCurrency(overview.billedRate) + '/hr');
    lines.push('  Effective Rate:    ' + fmtCurrency(overview.effectiveRate) + '/hr');
    lines.push('  Rate Loss:         -' + fmtCurrency(overview.rateLoss) + '/hr');
    lines.push('  Efficiency:        ' + overview.efficiency + '%');
    lines.push('  Total Billed:      $' + overview.totalBilled.toLocaleString());
    lines.push('  Total Hours:       ' + overview.totalAllHours + ' (' + overview.totalBilledHours + ' billable, ' + overview.nonBillableHours + ' overhead)');
    lines.push('');
    lines.push(sep);
    lines.push('PROJECT DETAILS');
    lines.push(sep);

    for (var i = 0; i < projects.length; i++) {
      var p = projects[i];
      lines.push('');
      lines.push('  ' + p.name + ' (' + p.client + ')');
      lines.push('    Billed: $' + p.billedAmount.toLocaleString() + ' | ' + p.billedHours + ' hrs billed | ' + p.totalHours + ' hrs total');
      lines.push('    Billed Rate: ' + fmtCurrency(p.billedRate) + '/hr | Effective: ' + fmtCurrency(p.effectiveRate) + '/hr | Efficiency: ' + p.efficiency + '%');
      lines.push('    Overhead: Proposal ' + p.proposalHours + 'h, Comm ' + p.commHours + 'h, Revisions ' + p.revisionHours + 'h, Admin ' + p.adminHours + 'h, Research ' + p.researchHours + 'h');
    }

    lines.push('');
    lines.push(sep);
    return lines.join('\n');
  }

  /**
   * Attach click handlers to the export CSV and export text buttons.
   * @param {Array<Object>} projects - Current projects array
   * @param {Object} overview - Current overview object
   */
  function attachExportListeners(projects, overview) {
    var csvBtn = document.getElementById('ehr-export-csv-btn');
    if (csvBtn) {
      csvBtn.addEventListener('click', function () {
        var csv = generateCsvSummary(projects, overview);
        downloadFile(csv, 'effective-hourly-rate-export.csv', 'text/csv;charset=utf-8;');
      });
    }

    var txtBtn = document.getElementById('ehr-export-txt-btn');
    if (txtBtn) {
      txtBtn.addEventListener('click', function () {
        var txt = generateTextSummary(projects, overview);
        downloadFile(txt, 'effective-hourly-rate-report.txt', 'text/plain;charset=utf-8;');
      });
    }
  }

  /* ── Main Render ── */

  /**
   * Full render pipeline: loads data, computes overview, builds all sections,
   * injects HTML, and attaches interactive event listeners.
   * @param {string} containerId - ID of the DOM container to render into
   * @returns {string} The complete rendered HTML
   */
  function render(containerId) {
    var projects = loadProjects();
    var overview = computeOverview(projects);

    var html = '<div style="background:#0f172a;color:#e2e8f0;padding:24px;border-radius:12px;font-family:system-ui,-apple-system,sans-serif;">';
    html += '<div style="margin-bottom:20px;">'
      + '<h2 style="margin:0;font-size:20px;font-weight:700;color:#f1f5f9;">Effective Hourly Rate Calculator</h2>'
      + '<p style="margin:4px 0 0;font-size:13px;color:#64748b;">Your true earnings after accounting for all non-billable work</p></div>';

    html += renderOverviewCards(overview);
    html += renderTimeBreakdown(overview);
    html += renderOverheadDonutChart(overview);
    html += renderRateComparisonChart(projects);
    html += renderProjectTable(projects);
    html += renderExportButtons();
    html += renderTimeTrackingForm(containerId);
    html += '</div>';

    var container = document.getElementById(containerId);
    if (container) {
      container.innerHTML = html;

      /* Attach interactive listeners after DOM insertion */
      attachFormListeners(containerId);
      attachExportListeners(projects, overview);
    }

    return html;
  }

  /**
   * Initialize the Effective Hourly Rate Calculator widget.
   * @param {string} [containerId='effective-hourly-rate'] - Target container ID
   * @returns {string} The rendered HTML
   */
  function init(containerId) {
    return render(containerId || 'effective-hourly-rate');
  }

  /* ── Export ── */
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.effectiveHourlyRate = {
    init: init,
    render: render,
    loadProjects: loadProjects,
    computeOverview: computeOverview,
    saveProjects: saveProjects,
    computeProjectFields: computeProjectFields,
    generateCsvSummary: generateCsvSummary,
    generateTextSummary: generateTextSummary,
    renderOverheadDonutChart: renderOverheadDonutChart,
    renderRateComparisonChart: renderRateComparisonChart,
    renderTimeTrackingForm: renderTimeTrackingForm,
    renderExportButtons: renderExportButtons
  };
})();
