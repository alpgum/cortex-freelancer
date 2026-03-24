/**
 * [CF-039] Proposal Win Rate Dashboard
 * Calculate and display win rate by category, budget range, and proposal
 * template used. Reads from proposal tracker and A/B testing storage.
 * Exposed on window.CortexFreelancer.proposalWinRate
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_proposal_outcomes';

  /* ── Storage Helpers ── */

  /**
   * Load outcomes from localStorage
   * @returns {Array}
   */
  function loadOutcomes() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  /**
   * Save outcomes to localStorage
   * @param {Array} outcomes
   */
  function saveOutcomes(outcomes) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(outcomes));
    } catch (e) {
      console.warn('[ProposalWinRate] Failed to save:', e);
    }
  }

  /* ── Data Entry ── */

  /**
   * Record a proposal outcome
   * @param {object} params
   * @param {string} params.jobId - Unique job identifier
   * @param {string} params.category - Job category (e.g. "Frontend / UI")
   * @param {number} params.budget - Job budget amount
   * @param {string} [params.templateId] - Template used for the proposal
   * @param {string} [params.templateName] - Human-readable template name
   * @param {string} params.outcome - 'won' | 'lost' | 'pending' | 'withdrawn'
   * @param {string} [params.date] - ISO date string, defaults to now
   * @param {string} [params.notes] - Optional notes
   * @returns {object} The recorded outcome
   */
  function recordOutcome(params) {
    if (!params || !params.jobId) {
      return { error: 'jobId is required' };
    }

    var entry = {
      id: 'pwr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      jobId: params.jobId,
      category: params.category || 'Other',
      budget: params.budget || 0,
      templateId: params.templateId || null,
      templateName: params.templateName || 'No template',
      outcome: params.outcome || 'pending',
      date: params.date || new Date().toISOString(),
      notes: params.notes || ''
    };

    var outcomes = loadOutcomes();

    // Replace existing entry for same jobId, or add new
    var found = false;
    for (var i = 0; i < outcomes.length; i++) {
      if (outcomes[i].jobId === entry.jobId) {
        outcomes[i] = entry;
        found = true;
        break;
      }
    }
    if (!found) {
      outcomes.push(entry);
    }

    saveOutcomes(outcomes);
    return entry;
  }

  /**
   * Update outcome status for an existing record
   * @param {string} jobId
   * @param {string} outcome - 'won' | 'lost' | 'pending' | 'withdrawn'
   * @returns {object|null}
   */
  function updateOutcome(jobId, outcome) {
    var outcomes = loadOutcomes();
    for (var i = 0; i < outcomes.length; i++) {
      if (outcomes[i].jobId === jobId) {
        outcomes[i].outcome = outcome;
        saveOutcomes(outcomes);
        return outcomes[i];
      }
    }
    return null;
  }

  /* ── Budget Range Helpers ── */

  /**
   * Classify budget into a range label
   * @param {number} budget
   * @returns {string}
   */
  function getBudgetRange(budget) {
    if (budget <= 0) return 'Not specified';
    if (budget < 500) return '$0–$499';
    if (budget < 1000) return '$500–$999';
    if (budget < 5000) return '$1K–$4.9K';
    if (budget < 10000) return '$5K–$9.9K';
    if (budget < 25000) return '$10K–$24.9K';
    return '$25K+';
  }

  /* ── Analytics ── */

  /**
   * Calculate overall win rate
   * @returns {{total: number, won: number, lost: number, pending: number, withdrawn: number, winRate: number}}
   */
  function getOverallStats() {
    var outcomes = loadOutcomes();
    var stats = { total: outcomes.length, won: 0, lost: 0, pending: 0, withdrawn: 0 };

    for (var i = 0; i < outcomes.length; i++) {
      var o = outcomes[i].outcome;
      if (stats[o] !== undefined) {
        stats[o]++;
      }
    }

    var decided = stats.won + stats.lost;
    stats.winRate = decided > 0 ? Math.round((stats.won / decided) * 1000) / 10 : 0;

    return stats;
  }

  /**
   * Calculate win rate grouped by category
   * @returns {Object.<string, {won: number, lost: number, total: number, winRate: number}>}
   */
  function getWinRateByCategory() {
    var outcomes = loadOutcomes();
    var groups = {};

    for (var i = 0; i < outcomes.length; i++) {
      var o = outcomes[i];
      if (o.outcome !== 'won' && o.outcome !== 'lost') continue;

      var cat = o.category || 'Other';
      if (!groups[cat]) {
        groups[cat] = { won: 0, lost: 0, total: 0, winRate: 0 };
      }
      groups[cat].total++;
      if (o.outcome === 'won') groups[cat].won++;
      else groups[cat].lost++;
    }

    var keys = Object.keys(groups);
    for (var j = 0; j < keys.length; j++) {
      var g = groups[keys[j]];
      g.winRate = g.total > 0 ? Math.round((g.won / g.total) * 1000) / 10 : 0;
    }

    return groups;
  }

  /**
   * Calculate win rate grouped by budget range
   * @returns {Object.<string, {won: number, lost: number, total: number, winRate: number}>}
   */
  function getWinRateByBudgetRange() {
    var outcomes = loadOutcomes();
    var groups = {};

    for (var i = 0; i < outcomes.length; i++) {
      var o = outcomes[i];
      if (o.outcome !== 'won' && o.outcome !== 'lost') continue;

      var range = getBudgetRange(o.budget);
      if (!groups[range]) {
        groups[range] = { won: 0, lost: 0, total: 0, winRate: 0 };
      }
      groups[range].total++;
      if (o.outcome === 'won') groups[range].won++;
      else groups[range].lost++;
    }

    var keys = Object.keys(groups);
    for (var j = 0; j < keys.length; j++) {
      var g = groups[keys[j]];
      g.winRate = g.total > 0 ? Math.round((g.won / g.total) * 1000) / 10 : 0;
    }

    return groups;
  }

  /**
   * Calculate win rate grouped by template used
   * @returns {Object.<string, {won: number, lost: number, total: number, winRate: number, templateId: string|null}>}
   */
  function getWinRateByTemplate() {
    var outcomes = loadOutcomes();
    var groups = {};

    for (var i = 0; i < outcomes.length; i++) {
      var o = outcomes[i];
      if (o.outcome !== 'won' && o.outcome !== 'lost') continue;

      var name = o.templateName || 'No template';
      if (!groups[name]) {
        groups[name] = { won: 0, lost: 0, total: 0, winRate: 0, templateId: o.templateId };
      }
      groups[name].total++;
      if (o.outcome === 'won') groups[name].won++;
      else groups[name].lost++;
    }

    var keys = Object.keys(groups);
    for (var j = 0; j < keys.length; j++) {
      var g = groups[keys[j]];
      g.winRate = g.total > 0 ? Math.round((g.won / g.total) * 1000) / 10 : 0;
    }

    return groups;
  }

  /**
   * Get win rate trends over time (monthly)
   * @param {number} [months=6] - Number of months to look back
   * @returns {Array<{month: string, won: number, lost: number, total: number, winRate: number}>}
   */
  function getMonthlyTrend(months) {
    months = months || 6;
    var outcomes = loadOutcomes();
    var buckets = {};

    // Initialize month buckets
    var now = new Date();
    for (var m = 0; m < months; m++) {
      var d = new Date(now.getFullYear(), now.getMonth() - m, 1);
      var key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      buckets[key] = { month: key, won: 0, lost: 0, total: 0, winRate: 0 };
    }

    for (var i = 0; i < outcomes.length; i++) {
      var o = outcomes[i];
      if (o.outcome !== 'won' && o.outcome !== 'lost') continue;

      var od = new Date(o.date);
      var oKey = od.getFullYear() + '-' + String(od.getMonth() + 1).padStart(2, '0');
      if (buckets[oKey]) {
        buckets[oKey].total++;
        if (o.outcome === 'won') buckets[oKey].won++;
        else buckets[oKey].lost++;
      }
    }

    var result = [];
    var keys = Object.keys(buckets).sort();
    for (var j = 0; j < keys.length; j++) {
      var b = buckets[keys[j]];
      b.winRate = b.total > 0 ? Math.round((b.won / b.total) * 1000) / 10 : 0;
      result.push(b);
    }

    return result;
  }

  /**
   * Get full dashboard data in a single call
   * @returns {object} Combined dashboard data
   */
  function getDashboard() {
    return {
      overall: getOverallStats(),
      byCategory: getWinRateByCategory(),
      byBudgetRange: getWinRateByBudgetRange(),
      byTemplate: getWinRateByTemplate(),
      monthlyTrend: getMonthlyTrend(6)
    };
  }

  /**
   * Get all recorded outcomes
   * @returns {Array}
   */
  function getOutcomes() {
    return loadOutcomes();
  }

  /**
   * Remove an outcome by jobId
   * @param {string} jobId
   * @returns {boolean}
   */
  function removeOutcome(jobId) {
    var outcomes = loadOutcomes();
    var filtered = [];
    var found = false;
    for (var i = 0; i < outcomes.length; i++) {
      if (outcomes[i].jobId === jobId) {
        found = true;
      } else {
        filtered.push(outcomes[i]);
      }
    }
    if (found) saveOutcomes(filtered);
    return found;
  }

  /**
   * Clear all outcomes
   */
  function clearOutcomes() {
    saveOutcomes([]);
  }

  /**
   * Initialize the module
   * @returns {object} Current dashboard state
   */
  function init() {
    return getDashboard();
  }

  /* ── CSS Injection ── */

  var CSS_INJECTED = false;
  var _styleEl = null;
  var _containerRef = null;

  function _escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function _injectCSS() {
    if (CSS_INJECTED) return;
    CSS_INJECTED = true;
    _styleEl = document.createElement('style');
    _styleEl.setAttribute('data-pwr-styles', '1');
    _styleEl.textContent = [
      '.pwr-dashboard{background:#111;border:1px solid #222;border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;overflow:hidden;color:#e0e0e0}',
      '.pwr-header{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid #222;background:#151515}',
      '.pwr-title{font-size:16px;font-weight:700;color:#e0e0e0}',
      '.pwr-badge{background:#7c3aed;color:#fff;font-size:11px;font-weight:700;padding:3px 10px;border-radius:10px}',
      '.pwr-section{padding:20px;border-bottom:1px solid #222}',
      '.pwr-section:last-child{border-bottom:none}',
      '.pwr-section-title{font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#a78bfa;margin-bottom:14px}',

      /* Overall stats - big numbers */
      '.pwr-stats-row{display:flex;gap:12px;flex-wrap:wrap}',
      '.pwr-stat-card{flex:1;min-width:120px;background:#0d0d0d;border:1px solid #222;border-radius:10px;padding:16px;text-align:center}',
      '.pwr-stat-value{font-size:32px;font-weight:800;color:#e0e0e0;line-height:1.1}',
      '.pwr-stat-value.pwr-accent{color:#a78bfa}',
      '.pwr-stat-value.pwr-green{color:#22c55e}',
      '.pwr-stat-value.pwr-red{color:#ef4444}',
      '.pwr-stat-value.pwr-yellow{color:#f59e0b}',
      '.pwr-stat-label{font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#666;margin-top:6px}',

      /* Horizontal bar chart rows */
      '.pwr-bar-row{margin-bottom:10px}',
      '.pwr-bar-label{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px}',
      '.pwr-bar-name{font-size:13px;color:#ccc;font-weight:500}',
      '.pwr-bar-value{font-size:12px;color:#a78bfa;font-weight:700}',
      '.pwr-bar-track{width:100%;height:8px;background:#1a1a1a;border-radius:4px;overflow:hidden}',
      '.pwr-bar-fill{height:100%;border-radius:4px;transition:width .4s ease}',
      '.pwr-bar-fill.pwr-fill-purple{background:linear-gradient(90deg,#7c3aed,#a78bfa)}',
      '.pwr-bar-fill.pwr-fill-green{background:linear-gradient(90deg,#16a34a,#22c55e)}',
      '.pwr-bar-fill.pwr-fill-blue{background:linear-gradient(90deg,#2563eb,#3b82f6)}',
      '.pwr-bar-meta{font-size:11px;color:#555;margin-top:2px}',

      /* Monthly trend chart */
      '.pwr-trend-chart{display:flex;align-items:flex-end;gap:8px;height:140px;padding:10px 0}',
      '.pwr-trend-col{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%}',
      '.pwr-trend-bar-wrap{width:100%;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;flex:1}',
      '.pwr-trend-bar{width:70%;max-width:48px;border-radius:4px 4px 0 0;transition:height .4s ease;min-height:2px;position:relative}',
      '.pwr-trend-bar.pwr-trend-won{background:linear-gradient(180deg,#a78bfa,#7c3aed)}',
      '.pwr-trend-bar.pwr-trend-lost{background:#2a2a2a;border-radius:0 0 4px 4px;margin-top:2px}',
      '.pwr-trend-rate{font-size:11px;font-weight:700;color:#a78bfa;margin-bottom:4px}',
      '.pwr-trend-label{font-size:10px;color:#555;margin-top:6px;text-align:center}',
      '.pwr-trend-count{font-size:10px;color:#666;margin-top:2px}',

      /* Empty state */
      '.pwr-empty{text-align:center;padding:40px 20px;color:#555;font-size:14px}',
      '.pwr-empty-icon{font-size:32px;margin-bottom:10px;opacity:.5}'
    ].join('\n');
    document.head.appendChild(_styleEl);
  }

  /* ── Render Helpers ── */

  function _renderOverallStats(stats) {
    var h = '<div class="pwr-section">';
    h += '<div class="pwr-section-title">Overall Win Rate</div>';
    h += '<div class="pwr-stats-row">';
    h += '<div class="pwr-stat-card"><div class="pwr-stat-value pwr-accent">' + stats.winRate + '%</div><div class="pwr-stat-label">Win Rate</div></div>';
    h += '<div class="pwr-stat-card"><div class="pwr-stat-value">' + stats.total + '</div><div class="pwr-stat-label">Total Proposals</div></div>';
    h += '<div class="pwr-stat-card"><div class="pwr-stat-value pwr-green">' + stats.won + '</div><div class="pwr-stat-label">Won</div></div>';
    h += '<div class="pwr-stat-card"><div class="pwr-stat-value pwr-red">' + stats.lost + '</div><div class="pwr-stat-label">Lost</div></div>';
    h += '<div class="pwr-stat-card"><div class="pwr-stat-value pwr-yellow">' + stats.pending + '</div><div class="pwr-stat-label">Pending</div></div>';
    h += '</div></div>';
    return h;
  }

  function _renderBarChart(title, groups, fillClass) {
    var keys = Object.keys(groups);
    if (keys.length === 0) {
      return '<div class="pwr-section"><div class="pwr-section-title">' + _escapeHtml(title) + '</div><div class="pwr-empty">No data yet</div></div>';
    }

    // Sort by win rate descending
    keys.sort(function (a, b) { return groups[b].winRate - groups[a].winRate; });

    var h = '<div class="pwr-section">';
    h += '<div class="pwr-section-title">' + _escapeHtml(title) + '</div>';

    for (var i = 0; i < keys.length; i++) {
      var g = groups[keys[i]];
      h += '<div class="pwr-bar-row">';
      h += '<div class="pwr-bar-label"><span class="pwr-bar-name">' + _escapeHtml(keys[i]) + '</span>';
      h += '<span class="pwr-bar-value">' + g.winRate + '%</span></div>';
      h += '<div class="pwr-bar-track"><div class="pwr-bar-fill ' + fillClass + '" style="width:' + Math.max(g.winRate, 1) + '%"></div></div>';
      h += '<div class="pwr-bar-meta">' + g.won + ' won / ' + g.lost + ' lost (' + g.total + ' total)</div>';
      h += '</div>';
    }

    h += '</div>';
    return h;
  }

  function _renderMonthlyTrend(trend) {
    if (!trend || trend.length === 0) {
      return '<div class="pwr-section"><div class="pwr-section-title">Monthly Trend</div><div class="pwr-empty">No data yet</div></div>';
    }

    // Find max total for scaling bars
    var maxTotal = 1;
    for (var i = 0; i < trend.length; i++) {
      if (trend[i].total > maxTotal) maxTotal = trend[i].total;
    }

    var h = '<div class="pwr-section">';
    h += '<div class="pwr-section-title">Monthly Trend</div>';
    h += '<div class="pwr-trend-chart">';

    for (var j = 0; j < trend.length; j++) {
      var m = trend[j];
      var wonHeight = maxTotal > 0 ? Math.round((m.won / maxTotal) * 100) : 0;
      var lostHeight = maxTotal > 0 ? Math.round((m.lost / maxTotal) * 100) : 0;
      // Ensure minimum visible height if there is data
      if (m.won > 0 && wonHeight < 4) wonHeight = 4;
      if (m.lost > 0 && lostHeight < 4) lostHeight = 4;

      // Format month label: "2026-03" -> "Mar"
      var monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      var parts = m.month.split('-');
      var monthLabel = monthNames[parseInt(parts[1], 10) - 1] || m.month;

      h += '<div class="pwr-trend-col">';
      if (m.total > 0) {
        h += '<div class="pwr-trend-rate">' + m.winRate + '%</div>';
      }
      h += '<div class="pwr-trend-bar-wrap">';
      h += '<div class="pwr-trend-bar pwr-trend-won" style="height:' + wonHeight + 'px"></div>';
      h += '<div class="pwr-trend-bar pwr-trend-lost" style="height:' + lostHeight + 'px"></div>';
      h += '</div>';
      h += '<div class="pwr-trend-label">' + monthLabel + '</div>';
      if (m.total > 0) {
        h += '<div class="pwr-trend-count">' + m.total + '</div>';
      }
      h += '</div>';
    }

    h += '</div></div>';
    return h;
  }

  /* ── Render / Destroy ── */

  /**
   * Render the full win rate dashboard into a DOM element
   * @param {string|HTMLElement} container - DOM element or element ID
   */
  function render(container) {
    _injectCSS();

    // Resolve container
    if (typeof container === 'string') {
      container = document.getElementById(container);
    }
    if (!container) {
      console.warn('[ProposalWinRate] render: container not found');
      return;
    }
    _containerRef = container;

    var data = getDashboard();

    var h = '<div class="pwr-dashboard">';

    // Header
    h += '<div class="pwr-header">';
    h += '<span class="pwr-title">Proposal Win Rate Dashboard</span>';
    var decided = data.overall.won + data.overall.lost;
    h += '<span class="pwr-badge">' + decided + ' decided</span>';
    h += '</div>';

    if (data.overall.total === 0) {
      h += '<div class="pwr-empty"><div class="pwr-empty-icon">&#x1f4ca;</div>No proposal outcomes recorded yet.<br>Use <code>recordOutcome()</code> to start tracking.</div>';
      h += '</div>';
      container.innerHTML = h;
      return;
    }

    // Overall stats
    h += _renderOverallStats(data.overall);

    // Win rate by category
    h += _renderBarChart('Win Rate by Category', data.byCategory, 'pwr-fill-purple');

    // Win rate by budget range
    h += _renderBarChart('Win Rate by Budget Range', data.byBudgetRange, 'pwr-fill-blue');

    // Win rate by template
    h += _renderBarChart('Win Rate by Template Used', data.byTemplate, 'pwr-fill-green');

    // Monthly trend
    h += _renderMonthlyTrend(data.monthlyTrend);

    h += '</div>';
    container.innerHTML = h;
  }

  /**
   * Destroy the rendered dashboard and clean up
   */
  function destroy() {
    if (_containerRef) {
      _containerRef.innerHTML = '';
      _containerRef = null;
    }
    if (_styleEl && _styleEl.parentNode) {
      _styleEl.parentNode.removeChild(_styleEl);
      _styleEl = null;
    }
    CSS_INJECTED = false;
  }

  /* ── Public API ── */
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.proposalWinRate = {
    init: init,
    recordOutcome: recordOutcome,
    updateOutcome: updateOutcome,
    getOverallStats: getOverallStats,
    getWinRateByCategory: getWinRateByCategory,
    getWinRateByBudgetRange: getWinRateByBudgetRange,
    getWinRateByTemplate: getWinRateByTemplate,
    getMonthlyTrend: getMonthlyTrend,
    getDashboard: getDashboard,
    getOutcomes: getOutcomes,
    removeOutcome: removeOutcome,
    clearOutcomes: clearOutcomes,
    render: render,
    destroy: destroy
  };
})();
