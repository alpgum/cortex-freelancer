/**
 * [CF-040] Proposal Response Time Tracker
 * Measure time from proposal submission to client response.
 * Show averages by category, identify patterns in response times.
 * Exposed on window.CortexFreelancer.proposalResponseTime
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_proposal_response_times';

  /* ── Storage Helpers ── */

  /**
   * Load tracked proposals from localStorage
   * @returns {Array}
   */
  function loadEntries() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  /**
   * Save tracked proposals to localStorage
   * @param {Array} entries
   */
  function saveEntries(entries) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch (e) {
      console.warn('[ProposalResponseTime] Failed to save:', e);
    }
  }

  /* ── Time Calculation Helpers ── */

  /**
   * Calculate hours between two ISO date strings
   * @param {string} startISO
   * @param {string} endISO
   * @returns {number} Hours elapsed
   */
  function hoursBetween(startISO, endISO) {
    var start = new Date(startISO).getTime();
    var end = new Date(endISO).getTime();
    if (isNaN(start) || isNaN(end)) return 0;
    return Math.max(0, (end - start) / (1000 * 60 * 60));
  }

  /**
   * Format hours into a human-readable string
   * @param {number} hours
   * @returns {string}
   */
  function formatDuration(hours) {
    if (hours < 1) return Math.round(hours * 60) + ' min';
    if (hours < 24) return Math.round(hours * 10) / 10 + ' hrs';
    var days = Math.floor(hours / 24);
    var remaining = Math.round(hours % 24);
    return days + 'd ' + remaining + 'h';
  }

  /* ── Core Functions ── */

  /**
   * Record a proposal submission
   * @param {object} params
   * @param {string} params.jobId - Unique job identifier
   * @param {string} params.category - Job category
   * @param {number} [params.budget] - Job budget
   * @param {string} [params.submittedAt] - ISO date string, defaults to now
   * @param {string} [params.clientName] - Client name
   * @returns {object} The tracked entry
   */
  function trackSubmission(params) {
    if (!params || !params.jobId) {
      return { error: 'jobId is required' };
    }

    var entry = {
      id: 'prt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      jobId: params.jobId,
      category: params.category || 'Other',
      budget: params.budget || 0,
      clientName: params.clientName || '',
      submittedAt: params.submittedAt || new Date().toISOString(),
      respondedAt: null,
      responseHours: null,
      status: 'awaiting' // awaiting | responded | expired | withdrawn
    };

    var entries = loadEntries();

    // Replace if same jobId already tracked
    var found = false;
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].jobId === entry.jobId) {
        entries[i] = entry;
        found = true;
        break;
      }
    }
    if (!found) {
      entries.push(entry);
    }

    saveEntries(entries);
    return entry;
  }

  /**
   * Record a client response for a tracked proposal
   * @param {string} jobId
   * @param {string} [respondedAt] - ISO date string, defaults to now
   * @returns {object|null} Updated entry or null if not found
   */
  function recordResponse(jobId, respondedAt) {
    var entries = loadEntries();
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].jobId === jobId) {
        entries[i].respondedAt = respondedAt || new Date().toISOString();
        entries[i].responseHours = hoursBetween(entries[i].submittedAt, entries[i].respondedAt);
        entries[i].status = 'responded';
        saveEntries(entries);
        return entries[i];
      }
    }
    return null;
  }

  /**
   * Mark a proposal as expired (no response)
   * @param {string} jobId
   * @returns {object|null}
   */
  function markExpired(jobId) {
    var entries = loadEntries();
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].jobId === jobId) {
        entries[i].status = 'expired';
        saveEntries(entries);
        return entries[i];
      }
    }
    return null;
  }

  /**
   * Mark a proposal as withdrawn
   * @param {string} jobId
   * @returns {object|null}
   */
  function markWithdrawn(jobId) {
    var entries = loadEntries();
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].jobId === jobId) {
        entries[i].status = 'withdrawn';
        saveEntries(entries);
        return entries[i];
      }
    }
    return null;
  }

  /* ── Analytics ── */

  /**
   * Get entries that have response times recorded
   * @returns {Array}
   */
  function getRespondedEntries() {
    var entries = loadEntries();
    var responded = [];
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].status === 'responded' && entries[i].responseHours !== null) {
        responded.push(entries[i]);
      }
    }
    return responded;
  }

  /**
   * Calculate overall average response time
   * @returns {{avgHours: number, medianHours: number, minHours: number, maxHours: number, count: number, formatted: {avg: string, median: string, min: string, max: string}}}
   */
  function getOverallAverage() {
    var responded = getRespondedEntries();
    if (responded.length === 0) {
      return { avgHours: 0, medianHours: 0, minHours: 0, maxHours: 0, count: 0, formatted: { avg: 'N/A', median: 'N/A', min: 'N/A', max: 'N/A' } };
    }

    var hours = [];
    for (var i = 0; i < responded.length; i++) {
      hours.push(responded[i].responseHours);
    }
    hours.sort(function (a, b) { return a - b; });

    var sum = 0;
    for (var j = 0; j < hours.length; j++) {
      sum += hours[j];
    }

    var avg = sum / hours.length;
    var median = hours.length % 2 === 0
      ? (hours[hours.length / 2 - 1] + hours[hours.length / 2]) / 2
      : hours[Math.floor(hours.length / 2)];

    return {
      avgHours: Math.round(avg * 10) / 10,
      medianHours: Math.round(median * 10) / 10,
      minHours: Math.round(hours[0] * 10) / 10,
      maxHours: Math.round(hours[hours.length - 1] * 10) / 10,
      count: hours.length,
      formatted: {
        avg: formatDuration(avg),
        median: formatDuration(median),
        min: formatDuration(hours[0]),
        max: formatDuration(hours[hours.length - 1])
      }
    };
  }

  /**
   * Calculate average response time grouped by category
   * @returns {Object.<string, {avgHours: number, count: number, formatted: string}>}
   */
  function getAverageByCategory() {
    var responded = getRespondedEntries();
    var groups = {};

    for (var i = 0; i < responded.length; i++) {
      var cat = responded[i].category || 'Other';
      if (!groups[cat]) {
        groups[cat] = { totalHours: 0, count: 0 };
      }
      groups[cat].totalHours += responded[i].responseHours;
      groups[cat].count++;
    }

    var result = {};
    var keys = Object.keys(groups);
    for (var j = 0; j < keys.length; j++) {
      var g = groups[keys[j]];
      var avg = g.totalHours / g.count;
      result[keys[j]] = {
        avgHours: Math.round(avg * 10) / 10,
        count: g.count,
        formatted: formatDuration(avg)
      };
    }

    return result;
  }

  /**
   * Calculate average response time grouped by budget range
   * @returns {Object.<string, {avgHours: number, count: number, formatted: string}>}
   */
  function getAverageByBudgetRange() {
    var responded = getRespondedEntries();
    var groups = {};

    for (var i = 0; i < responded.length; i++) {
      var budget = responded[i].budget || 0;
      var range;
      if (budget <= 0) range = 'Not specified';
      else if (budget < 500) range = '$0–$499';
      else if (budget < 1000) range = '$500–$999';
      else if (budget < 5000) range = '$1K–$4.9K';
      else if (budget < 10000) range = '$5K–$9.9K';
      else range = '$10K+';

      if (!groups[range]) {
        groups[range] = { totalHours: 0, count: 0 };
      }
      groups[range].totalHours += responded[i].responseHours;
      groups[range].count++;
    }

    var result = {};
    var keys = Object.keys(groups);
    for (var j = 0; j < keys.length; j++) {
      var g = groups[keys[j]];
      var avg = g.totalHours / g.count;
      result[keys[j]] = {
        avgHours: Math.round(avg * 10) / 10,
        count: g.count,
        formatted: formatDuration(avg)
      };
    }

    return result;
  }

  /**
   * Get proposals still awaiting response with elapsed time
   * @returns {Array<{jobId: string, category: string, elapsedHours: number, formatted: string}>}
   */
  function getPending() {
    var entries = loadEntries();
    var now = new Date().toISOString();
    var pending = [];

    for (var i = 0; i < entries.length; i++) {
      if (entries[i].status === 'awaiting') {
        var elapsed = hoursBetween(entries[i].submittedAt, now);
        pending.push({
          jobId: entries[i].jobId,
          category: entries[i].category,
          clientName: entries[i].clientName,
          submittedAt: entries[i].submittedAt,
          elapsedHours: Math.round(elapsed * 10) / 10,
          formatted: formatDuration(elapsed)
        });
      }
    }

    // Sort by longest waiting first
    pending.sort(function (a, b) { return b.elapsedHours - a.elapsedHours; });
    return pending;
  }

  /**
   * Get response time distribution (histogram buckets)
   * @returns {Array<{label: string, count: number}>}
   */
  function getDistribution() {
    var buckets = [
      { label: '< 1 hour', min: 0, max: 1, count: 0 },
      { label: '1–6 hours', min: 1, max: 6, count: 0 },
      { label: '6–24 hours', min: 6, max: 24, count: 0 },
      { label: '1–3 days', min: 24, max: 72, count: 0 },
      { label: '3–7 days', min: 72, max: 168, count: 0 },
      { label: '7+ days', min: 168, max: Infinity, count: 0 }
    ];

    var responded = getRespondedEntries();
    for (var i = 0; i < responded.length; i++) {
      var h = responded[i].responseHours;
      for (var j = 0; j < buckets.length; j++) {
        if (h >= buckets[j].min && h < buckets[j].max) {
          buckets[j].count++;
          break;
        }
      }
    }

    var result = [];
    for (var k = 0; k < buckets.length; k++) {
      result.push({ label: buckets[k].label, count: buckets[k].count });
    }
    return result;
  }

  /**
   * Get full dashboard summary
   * @returns {object}
   */
  function getDashboard() {
    var entries = loadEntries();
    return {
      overall: getOverallAverage(),
      byCategory: getAverageByCategory(),
      byBudgetRange: getAverageByBudgetRange(),
      pending: getPending(),
      distribution: getDistribution(),
      totalTracked: entries.length
    };
  }

  /**
   * Get all tracked entries
   * @returns {Array}
   */
  function getEntries() {
    return loadEntries();
  }

  /**
   * Remove an entry by jobId
   * @param {string} jobId
   * @returns {boolean}
   */
  function removeEntry(jobId) {
    var entries = loadEntries();
    var filtered = [];
    var found = false;
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].jobId === jobId) {
        found = true;
      } else {
        filtered.push(entries[i]);
      }
    }
    if (found) saveEntries(filtered);
    return found;
  }

  /**
   * Clear all tracked entries
   */
  function clearEntries() {
    saveEntries([]);
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

  function _injectCSS() {
    if (CSS_INJECTED) return;
    CSS_INJECTED = true;
    var style = document.createElement('style');
    style.id = 'cf-prt-styles';
    style.textContent = [
      '.prt-dashboard{background:#111;border:1px solid #222;border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;overflow:hidden;margin-bottom:16px}',
      '.prt-header{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;background:#151515;border-bottom:1px solid #222}',
      '.prt-title{color:#e0e0e0;font-size:15px;font-weight:700;display:flex;align-items:center;gap:8px}',
      '.prt-badge{background:#7c3aed;color:#fff;font-size:11px;font-weight:700;padding:2px 8px;border-radius:10px}',
      '.prt-body{padding:18px}',
      '.prt-section{margin-bottom:22px}',
      '.prt-section:last-child{margin-bottom:0}',
      '.prt-section-title{color:#a78bfa;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px}',

      /* Stat cards row */
      '.prt-stats-row{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:22px}',
      '.prt-stat-card{background:#1a1a1a;border:1px solid #222;border-radius:10px;padding:14px 16px;text-align:center}',
      '.prt-stat-value{color:#e0e0e0;font-size:22px;font-weight:700;line-height:1.2}',
      '.prt-stat-label{color:#666;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.3px;margin-top:4px}',
      '.prt-stat-card.prt-stat-highlight .prt-stat-value{color:#a78bfa}',

      /* Horizontal bar charts */
      '.prt-bar-row{display:flex;align-items:center;margin-bottom:8px}',
      '.prt-bar-label{color:#aaa;font-size:12px;width:120px;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.prt-bar-track{flex:1;height:22px;background:#1a1a1a;border-radius:6px;overflow:hidden;position:relative;margin:0 10px}',
      '.prt-bar-fill{height:100%;background:linear-gradient(90deg,#7c3aed,#a78bfa);border-radius:6px;transition:width .4s ease;min-width:2px}',
      '.prt-bar-value{color:#888;font-size:12px;width:70px;text-align:right;flex-shrink:0}',
      '.prt-bar-count{color:#555;font-size:11px;margin-left:4px}',

      /* Pending list */
      '.prt-pending-item{display:flex;align-items:center;padding:10px 14px;background:#1a1a1a;border:1px solid #222;border-radius:8px;margin-bottom:6px}',
      '.prt-pending-info{flex:1;min-width:0}',
      '.prt-pending-job{color:#e0e0e0;font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.prt-pending-meta{color:#666;font-size:11px;margin-top:2px}',
      '.prt-pending-elapsed{color:#a78bfa;font-size:13px;font-weight:700;flex-shrink:0;margin-left:12px;min-width:60px;text-align:right}',
      '.prt-pending-progress{width:100%;height:4px;background:#222;border-radius:2px;margin-top:6px;overflow:hidden}',
      '.prt-pending-progress-fill{height:100%;border-radius:2px;transition:width .3s ease}',
      '.prt-pending-progress-fill.prt-green{background:#22c55e}',
      '.prt-pending-progress-fill.prt-yellow{background:#eab308}',
      '.prt-pending-progress-fill.prt-orange{background:#f97316}',
      '.prt-pending-progress-fill.prt-red{background:#ef4444}',

      /* Histogram */
      '.prt-hist-row{display:flex;align-items:flex-end;gap:6px;height:120px;padding-top:8px}',
      '.prt-hist-col{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%}',
      '.prt-hist-bar{width:100%;background:linear-gradient(180deg,#a78bfa,#7c3aed);border-radius:4px 4px 0 0;transition:height .4s ease;min-height:2px}',
      '.prt-hist-count{color:#aaa;font-size:11px;font-weight:600;margin-bottom:4px}',
      '.prt-hist-label{color:#666;font-size:10px;text-align:center;margin-top:6px;white-space:nowrap}',

      /* Empty state */
      '.prt-empty{padding:30px 20px;text-align:center;color:#555;font-size:13px}',

      /* Responsive */
      '@media(max-width:640px){.prt-stats-row{grid-template-columns:repeat(2,1fr)}.prt-bar-label{width:80px}}'
    ].join('\n');
    document.head.appendChild(style);
  }

  /* ── Render Helpers ── */

  function _escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function _renderStatCards(overall) {
    var cards = [
      { label: 'Average', value: overall.formatted.avg, highlight: true },
      { label: 'Median', value: overall.formatted.median, highlight: false },
      { label: 'Fastest', value: overall.formatted.min, highlight: false },
      { label: 'Slowest', value: overall.formatted.max, highlight: false }
    ];
    var h = '<div class="prt-stats-row">';
    for (var i = 0; i < cards.length; i++) {
      h += '<div class="prt-stat-card' + (cards[i].highlight ? ' prt-stat-highlight' : '') + '">';
      h += '<div class="prt-stat-value">' + _escapeHtml(cards[i].value) + '</div>';
      h += '<div class="prt-stat-label">' + _escapeHtml(cards[i].label) + '</div>';
      h += '</div>';
    }
    h += '</div>';
    return h;
  }

  function _renderHorizontalBars(data, sectionTitle) {
    var keys = Object.keys(data);
    if (keys.length === 0) {
      return '<div class="prt-section"><div class="prt-section-title">' + _escapeHtml(sectionTitle) + '</div><div class="prt-empty">No data yet</div></div>';
    }

    // Find max avgHours for scaling
    var maxVal = 0;
    for (var i = 0; i < keys.length; i++) {
      if (data[keys[i]].avgHours > maxVal) maxVal = data[keys[i]].avgHours;
    }
    if (maxVal === 0) maxVal = 1;

    // Sort by avgHours descending
    keys.sort(function (a, b) { return data[b].avgHours - data[a].avgHours; });

    var h = '<div class="prt-section"><div class="prt-section-title">' + _escapeHtml(sectionTitle) + '</div>';
    for (var j = 0; j < keys.length; j++) {
      var item = data[keys[j]];
      var pct = Math.round((item.avgHours / maxVal) * 100);
      h += '<div class="prt-bar-row">';
      h += '<span class="prt-bar-label" title="' + _escapeHtml(keys[j]) + '">' + _escapeHtml(keys[j]) + '</span>';
      h += '<div class="prt-bar-track"><div class="prt-bar-fill" style="width:' + pct + '%"></div></div>';
      h += '<span class="prt-bar-value">' + _escapeHtml(item.formatted) + '<span class="prt-bar-count">(' + item.count + ')</span></span>';
      h += '</div>';
    }
    h += '</div>';
    return h;
  }

  function _renderPending(pending) {
    var h = '<div class="prt-section"><div class="prt-section-title">Pending Proposals</div>';
    if (pending.length === 0) {
      h += '<div class="prt-empty">No pending proposals</div>';
      h += '</div>';
      return h;
    }

    // We consider 168 hours (7 days) as the "full" bar for progress
    var maxHours = 168;

    for (var i = 0; i < pending.length; i++) {
      var p = pending[i];
      var pct = Math.min(100, Math.round((p.elapsedHours / maxHours) * 100));
      var colorClass = 'prt-green';
      if (p.elapsedHours >= 120) colorClass = 'prt-red';
      else if (p.elapsedHours >= 72) colorClass = 'prt-orange';
      else if (p.elapsedHours >= 24) colorClass = 'prt-yellow';

      h += '<div class="prt-pending-item">';
      h += '<div class="prt-pending-info">';
      h += '<div class="prt-pending-job">' + _escapeHtml(p.clientName || p.jobId) + '</div>';
      h += '<div class="prt-pending-meta">' + _escapeHtml(p.category) + '</div>';
      h += '<div class="prt-pending-progress"><div class="prt-pending-progress-fill ' + colorClass + '" style="width:' + pct + '%"></div></div>';
      h += '</div>';
      h += '<span class="prt-pending-elapsed">' + _escapeHtml(p.formatted) + '</span>';
      h += '</div>';
    }

    h += '</div>';
    return h;
  }

  function _renderDistribution(distribution) {
    var h = '<div class="prt-section"><div class="prt-section-title">Response Time Distribution</div>';

    // Find max count for scaling
    var maxCount = 0;
    for (var i = 0; i < distribution.length; i++) {
      if (distribution[i].count > maxCount) maxCount = distribution[i].count;
    }

    if (maxCount === 0) {
      h += '<div class="prt-empty">No response data yet</div></div>';
      return h;
    }

    h += '<div class="prt-hist-row">';
    for (var j = 0; j < distribution.length; j++) {
      var d = distribution[j];
      var barPct = maxCount > 0 ? Math.round((d.count / maxCount) * 100) : 0;
      h += '<div class="prt-hist-col">';
      h += '<span class="prt-hist-count">' + d.count + '</span>';
      h += '<div class="prt-hist-bar" style="height:' + Math.max(2, barPct) + '%"></div>';
      h += '<span class="prt-hist-label">' + _escapeHtml(d.label) + '</span>';
      h += '</div>';
    }
    h += '</div></div>';
    return h;
  }

  /* ── Render / Destroy ── */

  var _containerEl = null;

  /**
   * Render the full response time dashboard into a DOM container.
   * @param {HTMLElement|string} container - DOM element or element ID
   */
  function render(container) {
    _injectCSS();
    var el = typeof container === 'string' ? document.getElementById(container) : container;
    if (!el) return;
    _containerEl = el;

    var dashboard = getDashboard();

    var h = '<div class="prt-dashboard">';

    // Header
    h += '<div class="prt-header">';
    h += '<span class="prt-title">Response Time Tracker <span class="prt-badge">' + dashboard.totalTracked + ' tracked</span></span>';
    h += '</div>';

    h += '<div class="prt-body">';

    // Overall stat cards
    if (dashboard.overall.count > 0) {
      h += _renderStatCards(dashboard.overall);
    } else {
      h += '<div class="prt-empty">No response data yet. Track proposals and record responses to see stats.</div>';
    }

    // Average by category
    h += _renderHorizontalBars(dashboard.byCategory, 'Average by Category');

    // Average by budget range
    h += _renderHorizontalBars(dashboard.byBudgetRange, 'Average by Budget Range');

    // Pending proposals
    h += _renderPending(dashboard.pending);

    // Distribution histogram
    h += _renderDistribution(dashboard.distribution);

    h += '</div></div>';

    el.innerHTML = h;
  }

  /**
   * Clean up the rendered dashboard and injected CSS.
   */
  function destroy() {
    if (_containerEl) {
      _containerEl.innerHTML = '';
      _containerEl = null;
    }
    CSS_INJECTED = false;
    var styleEl = document.getElementById('cf-prt-styles');
    if (styleEl && styleEl.parentNode) styleEl.parentNode.removeChild(styleEl);
  }

  /* ── Public API ── */
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.proposalResponseTime = {
    init: init,
    render: render,
    destroy: destroy,
    trackSubmission: trackSubmission,
    recordResponse: recordResponse,
    markExpired: markExpired,
    markWithdrawn: markWithdrawn,
    getOverallAverage: getOverallAverage,
    getAverageByCategory: getAverageByCategory,
    getAverageByBudgetRange: getAverageByBudgetRange,
    getPending: getPending,
    getDistribution: getDistribution,
    getDashboard: getDashboard,
    getEntries: getEntries,
    removeEntry: removeEntry,
    clearEntries: clearEntries
  };
})();
