/**
 * CF-053: Effective Hourly Rate Calculator
 * Calculate true hourly rate including proposal writing time,
 * communication overhead, revision time, and admin hours.
 *
 * @namespace window.CortexFreelancer.EffectiveHourlyRate
 */
(function () {
  'use strict';

  var ns = (window.CortexFreelancer = window.CortexFreelancer || {});

  var STORAGE_KEY = 'cortex_effective_hourly_rate';

  // ─── Mock Data ────────────────────────────────────────

  var MOCK_DATA = {
    billedRate: 95,
    billableHours: 120,
    proposalHours: 18,
    communicationHours: 22,
    revisionHours: 14,
    adminHours: 10
  };

  // ─── Tips ─────────────────────────────────────────────

  var TIPS = [
    {
      title: 'Use proposal templates',
      text: 'Create reusable templates for common project types to cut proposal writing time by up to 60%.'
    },
    {
      title: 'Batch communication',
      text: 'Schedule 2-3 dedicated check-in windows per day instead of responding to messages as they arrive.'
    },
    {
      title: 'Define revision limits',
      text: 'Include a clear revision policy in your contracts (e.g. 2 rounds included) to avoid scope creep.'
    },
    {
      title: 'Automate admin tasks',
      text: 'Use invoicing tools and time trackers to reduce bookkeeping from hours to minutes each week.'
    },
    {
      title: 'Raise your billed rate',
      text: 'If your effective rate is below your target, a rate increase is often simpler than cutting overhead.'
    },
    {
      title: 'Track time honestly',
      text: 'Log all working time, including "quick" emails. Accurate data is the first step to improvement.'
    }
  ];

  // ─── Category Metadata ────────────────────────────────

  var CATEGORIES = [
    { key: 'billableHours',      label: 'Billable Work',   color: '#00b894' },
    { key: 'proposalHours',      label: 'Proposals',       color: '#6c5ce7' },
    { key: 'communicationHours', label: 'Communication',   color: '#0984e3' },
    { key: 'revisionHours',      label: 'Revisions',       color: '#e17055' },
    { key: 'adminHours',         label: 'Admin',           color: '#fdcb6e' }
  ];

  // ─── Storage ──────────────────────────────────────────

  /**
   * Load saved calculator data from localStorage.
   * @returns {Object|null}
   */
  function loadData() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.warn('[EffectiveHourlyRate] Failed to load data:', e);
      return null;
    }
  }

  /**
   * Save calculator data to localStorage.
   * @param {Object} data
   */
  function saveData(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('[EffectiveHourlyRate] Failed to save data:', e);
    }
  }

  // ─── Calculation ──────────────────────────────────────

  /**
   * Calculate effective hourly rate and breakdown.
   * @param {Object} data
   * @returns {Object} result
   */
  function calculate(data) {
    var billable = parseFloat(data.billableHours) || 0;
    var proposal = parseFloat(data.proposalHours) || 0;
    var communication = parseFloat(data.communicationHours) || 0;
    var revision = parseFloat(data.revisionHours) || 0;
    var admin = parseFloat(data.adminHours) || 0;
    var billedRate = parseFloat(data.billedRate) || 0;

    var totalEarnings = billedRate * billable;
    var totalHours = billable + proposal + communication + revision + admin;
    var effectiveRate = totalHours > 0 ? totalEarnings / totalHours : 0;
    var efficiency = totalHours > 0 ? (billable / totalHours) * 100 : 0;
    var rateDifference = billedRate - effectiveRate;
    var rateDropPercent = billedRate > 0 ? (rateDifference / billedRate) * 100 : 0;

    var breakdown = CATEGORIES.map(function (cat) {
      var hours = parseFloat(data[cat.key]) || 0;
      return {
        key: cat.key,
        label: cat.label,
        color: cat.color,
        hours: hours,
        percent: totalHours > 0 ? (hours / totalHours) * 100 : 0
      };
    });

    return {
      billedRate: billedRate,
      effectiveRate: effectiveRate,
      totalEarnings: totalEarnings,
      totalHours: totalHours,
      billableHours: billable,
      efficiency: efficiency,
      rateDifference: rateDifference,
      rateDropPercent: rateDropPercent,
      breakdown: breakdown
    };
  }

  // ─── Styles ───────────────────────────────────────────

  /**
   * Inject styles into the document once.
   */
  function injectStyles() {
    if (document.getElementById('cortex-ehr-styles')) return;
    var style = document.createElement('style');
    style.id = 'cortex-ehr-styles';
    style.textContent =
      '.ehr-container {' +
        'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;' +
        'max-width: 820px; margin: 0 auto; padding: 24px; color: #2d3436;' +
      '}' +
      '.ehr-header {' +
        'text-align: center; margin-bottom: 28px;' +
      '}' +
      '.ehr-header h2 {' +
        'font-size: 24px; font-weight: 700; margin: 0 0 6px 0; color: #2d3436;' +
      '}' +
      '.ehr-header p {' +
        'font-size: 14px; color: #636e72; margin: 0;' +
      '}' +
      '.ehr-grid {' +
        'display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 28px;' +
      '}' +
      '@media (max-width: 640px) {' +
        '.ehr-grid { grid-template-columns: 1fr; }' +
      '}' +
      '.ehr-card {' +
        'background: #fff; border: 1px solid #dfe6e9; border-radius: 12px;' +
        'padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.04);' +
      '}' +
      '.ehr-card h3 {' +
        'font-size: 15px; font-weight: 600; margin: 0 0 16px 0; color: #2d3436;' +
        'padding-bottom: 10px; border-bottom: 1px solid #f0f0f0;' +
      '}' +
      '.ehr-input-group {' +
        'margin-bottom: 14px;' +
      '}' +
      '.ehr-input-group:last-child { margin-bottom: 0; }' +
      '.ehr-input-group label {' +
        'display: block; font-size: 13px; font-weight: 500; color: #636e72;' +
        'margin-bottom: 5px;' +
      '}' +
      '.ehr-input-group input {' +
        'width: 100%; box-sizing: border-box; padding: 9px 12px;' +
        'border: 1px solid #dfe6e9; border-radius: 8px; font-size: 14px;' +
        'color: #2d3436; background: #fafafa; transition: border-color 0.2s;' +
      '}' +
      '.ehr-input-group input:focus {' +
        'outline: none; border-color: #6c5ce7; background: #fff;' +
      '}' +
      '.ehr-input-prefix {' +
        'position: relative;' +
      '}' +
      '.ehr-input-prefix span.ehr-addon {' +
        'position: absolute; left: 10px; top: 50%; transform: translateY(-50%);' +
        'font-size: 14px; color: #636e72; pointer-events: none;' +
      '}' +
      '.ehr-input-prefix input {' +
        'padding-left: 24px;' +
      '}' +
      '.ehr-input-suffix {' +
        'position: relative;' +
      '}' +
      '.ehr-input-suffix span.ehr-addon {' +
        'position: absolute; right: 10px; top: 50%; transform: translateY(-50%);' +
        'font-size: 12px; color: #b2bec3; pointer-events: none;' +
      '}' +
      /* ── Comparison cards ── */
      '.ehr-comparison {' +
        'display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-bottom: 28px;' +
      '}' +
      '@media (max-width: 640px) {' +
        '.ehr-comparison { grid-template-columns: 1fr; }' +
      '}' +
      '.ehr-stat {' +
        'background: #fff; border: 1px solid #dfe6e9; border-radius: 12px;' +
        'padding: 18px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.04);' +
      '}' +
      '.ehr-stat-label {' +
        'font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;' +
        'color: #636e72; font-weight: 600; margin-bottom: 6px;' +
      '}' +
      '.ehr-stat-value {' +
        'font-size: 28px; font-weight: 700;' +
      '}' +
      '.ehr-stat-sub {' +
        'font-size: 12px; color: #b2bec3; margin-top: 4px;' +
      '}' +
      '.ehr-rate-billed .ehr-stat-value { color: #00b894; }' +
      '.ehr-rate-effective .ehr-stat-value { color: #6c5ce7; }' +
      '.ehr-rate-drop .ehr-stat-value { color: #e17055; }' +
      /* ── Breakdown bar ── */
      '.ehr-breakdown-card {' +
        'background: #fff; border: 1px solid #dfe6e9; border-radius: 12px;' +
        'padding: 20px; margin-bottom: 28px; box-shadow: 0 2px 8px rgba(0,0,0,0.04);' +
      '}' +
      '.ehr-breakdown-card h3 {' +
        'font-size: 15px; font-weight: 600; margin: 0 0 16px 0; color: #2d3436;' +
        'padding-bottom: 10px; border-bottom: 1px solid #f0f0f0;' +
      '}' +
      '.ehr-bar-container {' +
        'display: flex; height: 32px; border-radius: 8px; overflow: hidden;' +
        'margin-bottom: 16px; background: #f0f0f0;' +
      '}' +
      '.ehr-bar-segment {' +
        'transition: width 0.4s ease;' +
      '}' +
      '.ehr-legend {' +
        'display: flex; flex-wrap: wrap; gap: 12px 20px;' +
      '}' +
      '.ehr-legend-item {' +
        'display: flex; align-items: center; gap: 7px; font-size: 13px; color: #2d3436;' +
      '}' +
      '.ehr-legend-dot {' +
        'width: 12px; height: 12px; border-radius: 3px; flex-shrink: 0;' +
      '}' +
      '.ehr-legend-hours {' +
        'color: #b2bec3; font-size: 12px;' +
      '}' +
      /* ── Efficiency meter ── */
      '.ehr-efficiency-wrap {' +
        'margin-top: 18px; padding-top: 16px; border-top: 1px solid #f0f0f0;' +
      '}' +
      '.ehr-efficiency-header {' +
        'display: flex; justify-content: space-between; align-items: center;' +
        'margin-bottom: 8px;' +
      '}' +
      '.ehr-efficiency-label {' +
        'font-size: 13px; font-weight: 500; color: #636e72;' +
      '}' +
      '.ehr-efficiency-value {' +
        'font-size: 14px; font-weight: 700;' +
      '}' +
      '.ehr-efficiency-track {' +
        'height: 10px; background: #f0f0f0; border-radius: 5px; overflow: hidden;' +
      '}' +
      '.ehr-efficiency-fill {' +
        'height: 100%; border-radius: 5px; transition: width 0.4s ease;' +
      '}' +
      /* ── Tips ── */
      '.ehr-tips-card {' +
        'background: #fff; border: 1px solid #dfe6e9; border-radius: 12px;' +
        'padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.04);' +
      '}' +
      '.ehr-tips-card h3 {' +
        'font-size: 15px; font-weight: 600; margin: 0 0 16px 0; color: #2d3436;' +
        'padding-bottom: 10px; border-bottom: 1px solid #f0f0f0;' +
      '}' +
      '.ehr-tip {' +
        'padding: 12px 14px; background: #f8f9fa; border-radius: 8px;' +
        'margin-bottom: 10px; border-left: 3px solid #6c5ce7;' +
      '}' +
      '.ehr-tip:last-child { margin-bottom: 0; }' +
      '.ehr-tip-title {' +
        'font-size: 13px; font-weight: 600; color: #2d3436; margin-bottom: 3px;' +
      '}' +
      '.ehr-tip-text {' +
        'font-size: 12px; color: #636e72; line-height: 1.5;' +
      '}' +
      /* ── Reset button ── */
      '.ehr-reset-btn {' +
        'display: inline-block; margin-top: 18px; padding: 8px 18px;' +
        'font-size: 13px; font-weight: 500; color: #636e72; background: #f0f0f0;' +
        'border: none; border-radius: 8px; cursor: pointer; transition: background 0.2s;' +
      '}' +
      '.ehr-reset-btn:hover { background: #dfe6e9; }';

    document.head.appendChild(style);
  }

  // ─── Rendering Helpers ────────────────────────────────

  /**
   * Escape HTML special characters.
   * @param {string} str
   * @returns {string}
   */
  function esc(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str || ''));
    return div.innerHTML;
  }

  /**
   * Format a dollar amount.
   * @param {number} val
   * @returns {string}
   */
  function fmtMoney(val) {
    return '$' + val.toFixed(2);
  }

  /**
   * Read current values from all rendered inputs.
   * @param {HTMLElement} container
   * @returns {Object}
   */
  function readForm(container) {
    var data = {};
    var inputs = container.querySelectorAll('input[data-field]');
    for (var i = 0; i < inputs.length; i++) {
      data[inputs[i].getAttribute('data-field')] = inputs[i].value;
    }
    return data;
  }

  /**
   * Return a colour representing billable efficiency.
   * @param {number} pct 0-100
   * @returns {string} CSS colour
   */
  function efficiencyColor(pct) {
    if (pct >= 75) return '#00b894';
    if (pct >= 55) return '#fdcb6e';
    return '#e17055';
  }

  // ─── HTML Builder ─────────────────────────────────────

  /**
   * Build the full HTML for the calculator UI.
   * @param {Object} result  - output of calculate()
   * @param {Object} data    - raw input values
   * @returns {string}
   */
  function buildHtml(result, data) {
    var html = '';

    // ── Header
    html += '<div class="ehr-header">';
    html += '<h2>Effective Hourly Rate Calculator</h2>';
    html += '<p>Discover your true hourly rate after accounting for all working time.</p>';
    html += '</div>';

    // ── Input Grid
    html += '<div class="ehr-grid">';

    // Left card – Earnings
    html += '<div class="ehr-card">';
    html += '<h3>Earnings</h3>';

    html += '<div class="ehr-input-group">';
    html += '<label>Billed Hourly Rate</label>';
    html += '<div class="ehr-input-prefix">';
    html += '<span class="ehr-addon">$</span>';
    html += '<input type="number" data-field="billedRate" min="0" step="1" value="' + esc(String(data.billedRate)) + '">';
    html += '</div></div>';

    html += '<div class="ehr-input-group">';
    html += '<label>Billable Hours (per month)</label>';
    html += '<div class="ehr-input-suffix">';
    html += '<input type="number" data-field="billableHours" min="0" step="0.5" value="' + esc(String(data.billableHours)) + '">';
    html += '<span class="ehr-addon">hrs</span>';
    html += '</div></div>';

    html += '</div>'; // end card

    // Right card – Overhead hours
    html += '<div class="ehr-card">';
    html += '<h3>Overhead Hours (per month)</h3>';

    html += '<div class="ehr-input-group">';
    html += '<label>Proposal Writing</label>';
    html += '<div class="ehr-input-suffix">';
    html += '<input type="number" data-field="proposalHours" min="0" step="0.5" value="' + esc(String(data.proposalHours)) + '">';
    html += '<span class="ehr-addon">hrs</span>';
    html += '</div></div>';

    html += '<div class="ehr-input-group">';
    html += '<label>Communication / Meetings</label>';
    html += '<div class="ehr-input-suffix">';
    html += '<input type="number" data-field="communicationHours" min="0" step="0.5" value="' + esc(String(data.communicationHours)) + '">';
    html += '<span class="ehr-addon">hrs</span>';
    html += '</div></div>';

    html += '<div class="ehr-input-group">';
    html += '<label>Revisions / Rework</label>';
    html += '<div class="ehr-input-suffix">';
    html += '<input type="number" data-field="revisionHours" min="0" step="0.5" value="' + esc(String(data.revisionHours)) + '">';
    html += '<span class="ehr-addon">hrs</span>';
    html += '</div></div>';

    html += '<div class="ehr-input-group">';
    html += '<label>Admin / Bookkeeping</label>';
    html += '<div class="ehr-input-suffix">';
    html += '<input type="number" data-field="adminHours" min="0" step="0.5" value="' + esc(String(data.adminHours)) + '">';
    html += '<span class="ehr-addon">hrs</span>';
    html += '</div></div>';

    html += '</div>'; // end card
    html += '</div>'; // end grid

    // ── Comparison Stats
    html += '<div class="ehr-comparison">';

    html += '<div class="ehr-stat ehr-rate-billed">';
    html += '<div class="ehr-stat-label">Billed Rate</div>';
    html += '<div class="ehr-stat-value">' + fmtMoney(result.billedRate) + '</div>';
    html += '<div class="ehr-stat-sub">per hour</div>';
    html += '</div>';

    html += '<div class="ehr-stat ehr-rate-effective">';
    html += '<div class="ehr-stat-label">Effective Rate</div>';
    html += '<div class="ehr-stat-value">' + fmtMoney(result.effectiveRate) + '</div>';
    html += '<div class="ehr-stat-sub">' + fmtMoney(result.totalEarnings) + ' / ' + result.totalHours.toFixed(1) + ' hrs</div>';
    html += '</div>';

    html += '<div class="ehr-stat ehr-rate-drop">';
    html += '<div class="ehr-stat-label">Rate Reduction</div>';
    html += '<div class="ehr-stat-value">-' + result.rateDropPercent.toFixed(1) + '%</div>';
    html += '<div class="ehr-stat-sub">-' + fmtMoney(result.rateDifference) + '/hr lost to overhead</div>';
    html += '</div>';

    html += '</div>'; // end comparison

    // ── Time Breakdown
    html += '<div class="ehr-breakdown-card">';
    html += '<h3>Time Breakdown</h3>';

    // Stacked bar
    html += '<div class="ehr-bar-container">';
    for (var b = 0; b < result.breakdown.length; b++) {
      var seg = result.breakdown[b];
      if (seg.hours <= 0) continue;
      html += '<div class="ehr-bar-segment" style="width:' + seg.percent.toFixed(2) +
              '%; background:' + seg.color + ';" title="' + esc(seg.label) + ': ' +
              seg.hours.toFixed(1) + ' hrs (' + seg.percent.toFixed(1) + '%)"></div>';
    }
    html += '</div>';

    // Legend
    html += '<div class="ehr-legend">';
    for (var l = 0; l < result.breakdown.length; l++) {
      var item = result.breakdown[l];
      html += '<div class="ehr-legend-item">';
      html += '<div class="ehr-legend-dot" style="background:' + item.color + ';"></div>';
      html += '<span>' + esc(item.label) + '</span>';
      html += '<span class="ehr-legend-hours">' + item.hours.toFixed(1) + 'h (' + item.percent.toFixed(1) + '%)</span>';
      html += '</div>';
    }
    html += '</div>';

    // Efficiency meter
    var effColor = efficiencyColor(result.efficiency);
    html += '<div class="ehr-efficiency-wrap">';
    html += '<div class="ehr-efficiency-header">';
    html += '<span class="ehr-efficiency-label">Billable Efficiency</span>';
    html += '<span class="ehr-efficiency-value" style="color:' + effColor + ';">' + result.efficiency.toFixed(1) + '%</span>';
    html += '</div>';
    html += '<div class="ehr-efficiency-track">';
    html += '<div class="ehr-efficiency-fill" style="width:' + Math.min(result.efficiency, 100).toFixed(2) + '%; background:' + effColor + ';"></div>';
    html += '</div>';
    html += '</div>';

    html += '</div>'; // end breakdown card

    // ── Tips
    html += '<div class="ehr-tips-card">';
    html += '<h3>Tips to Improve Your Effective Rate</h3>';
    for (var t = 0; t < TIPS.length; t++) {
      html += '<div class="ehr-tip">';
      html += '<div class="ehr-tip-title">' + esc(TIPS[t].title) + '</div>';
      html += '<div class="ehr-tip-text">' + esc(TIPS[t].text) + '</div>';
      html += '</div>';
    }
    html += '</div>';

    // Reset button
    html += '<div style="text-align:center;">';
    html += '<button class="ehr-reset-btn" data-action="reset">Reset to Demo Data</button>';
    html += '</div>';

    return html;
  }

  // ─── Render / Event Loop ──────────────────────────────

  /**
   * Render (or re-render) the calculator into a container element.
   * @param {HTMLElement} container
   * @param {Object} data - current input values
   */
  function render(container, data) {
    var result = calculate(data);

    // Preserve scroll position across re-renders
    var scrollY = window.scrollY;

    container.innerHTML = '<div class="ehr-container">' + buildHtml(result, data) + '</div>';

    // Debounce timer id shared across inputs
    var debounceTimer = null;

    // Bind live-update on every input
    var inputs = container.querySelectorAll('input[data-field]');
    for (var i = 0; i < inputs.length; i++) {
      inputs[i].addEventListener('input', function () {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(function () {
          var current = readForm(container);
          saveData(current);
          render(container, current);
        }, 250);
      });
    }

    // Bind reset button
    var resetBtn = container.querySelector('[data-action="reset"]');
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        saveData(MOCK_DATA);
        render(container, MOCK_DATA);
      });
    }

    // Restore scroll after DOM update
    window.scrollTo(0, scrollY);
  }

  // ─── Public init ──────────────────────────────────────

  /**
   * Initialise the Effective Hourly Rate calculator.
   * @param {string} containerId - DOM element ID to render into
   */
  function init(containerId) {
    var container = document.getElementById(containerId);
    if (!container) {
      console.error('[EffectiveHourlyRate] Container not found: #' + containerId);
      return;
    }

    injectStyles();

    var saved = loadData();
    var data = saved || MOCK_DATA;
    render(container, data);
  }

  // ─── Namespace Registration ───────────────────────────

  ns.EffectiveHourlyRate = {
    init: init,
    calculate: calculate,
    resetData: function () {
      saveData(MOCK_DATA);
    }
  };
})();
