/**
 * CF-052: Earnings Goal Tracker with Progress Bar
 * Set monthly/quarterly/yearly income goals, view real-time progress
 * with projections, on-track / at-risk / behind indicators.
 *
 * @namespace window.CortexFreelancer.EarningsGoalTracker
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_earnings_goals';
  var STYLE_ID = 'egt-styles';

  // ─── Mock / Demo Data ──────────────────────────────────

  /**
   * Generate mock earnings entries for the current year.
   * Returns an array of { date, amount, description }.
   * @returns {Array<Object>}
   */
  function generateMockEarnings() {
    var now = new Date();
    var year = now.getFullYear();
    var month = now.getMonth();
    var day = now.getDate();
    var entries = [];

    var descriptions = [
      'Website redesign project',
      'Logo design',
      'API integration',
      'Content writing',
      'SEO audit',
      'Mobile app sprint',
      'Database migration',
      'UI/UX consultation',
      'E-commerce module',
      'Bug-fix retainer',
      'Landing page build',
      'Analytics dashboard'
    ];

    // Seed a simple deterministic-ish random from year so demo data
    // stays stable within a page session but varies per year.
    var seed = year * 1000 + 137;
    function rand() {
      seed = (seed * 16807 + 0) % 2147483647;
      return (seed - 1) / 2147483646;
    }

    // Fill completed months with realistic amounts
    for (var m = 0; m < month; m++) {
      var count = 3 + Math.floor(rand() * 4); // 3-6 entries per month
      for (var i = 0; i < count; i++) {
        var d = 1 + Math.floor(rand() * 28);
        entries.push({
          date: new Date(year, m, d).toISOString(),
          amount: 400 + Math.floor(rand() * 2600),
          description: descriptions[Math.floor(rand() * descriptions.length)]
        });
      }
    }

    // Current month: entries up to today
    var currentCount = 1 + Math.floor(rand() * 3);
    for (var j = 0; j < currentCount; j++) {
      var cd = 1 + Math.floor(rand() * Math.max(day - 1, 1));
      entries.push({
        date: new Date(year, month, cd).toISOString(),
        amount: 500 + Math.floor(rand() * 2500),
        description: descriptions[Math.floor(rand() * descriptions.length)]
      });
    }

    return entries;
  }

  // ─── Storage ───────────────────────────────────────────

  /**
   * Load stored goals object from localStorage.
   * @returns {Object|null}
   */
  function loadGoals() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.warn('[EarningsGoalTracker] Failed to load goals:', e);
      return null;
    }
  }

  /**
   * Save goals object to localStorage.
   * @param {Object} goals
   */
  function saveGoals(goals) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(goals));
    } catch (e) {
      console.warn('[EarningsGoalTracker] Failed to save goals:', e);
    }
  }

  /**
   * Get or create goals with sensible defaults.
   * @returns {{ monthly: number, quarterly: number, yearly: number }}
   */
  function getGoals() {
    var stored = loadGoals();
    if (stored && typeof stored.monthly === 'number') return stored;
    var defaults = { monthly: 5000, quarterly: 18000, yearly: 65000 };
    saveGoals(defaults);
    return defaults;
  }

  // ─── Calculation Helpers ───────────────────────────────

  /**
   * Sum earnings within a date range [start, end).
   * @param {Array} entries
   * @param {Date} start
   * @param {Date} end
   * @returns {number}
   */
  function sumRange(entries, start, end) {
    var total = 0;
    var s = start.getTime();
    var e = end.getTime();
    for (var i = 0; i < entries.length; i++) {
      var t = new Date(entries[i].date).getTime();
      if (t >= s && t < e) {
        total += entries[i].amount;
      }
    }
    return total;
  }

  /**
   * Calculate how far through a period we are (0-1).
   * @param {Date} start
   * @param {Date} end
   * @returns {number}
   */
  function periodProgress(start, end) {
    var now = Date.now();
    var s = start.getTime();
    var e = end.getTime();
    if (now >= e) return 1;
    if (now <= s) return 0;
    return (now - s) / (e - s);
  }

  /**
   * Return the start-of-current-quarter date.
   * @param {Date} now
   * @returns {Date}
   */
  function quarterStart(now) {
    var q = Math.floor(now.getMonth() / 3) * 3;
    return new Date(now.getFullYear(), q, 1);
  }

  /**
   * Return the start of the next quarter (exclusive end bound).
   * @param {Date} now
   * @returns {Date}
   */
  function quarterEnd(now) {
    var q = Math.floor(now.getMonth() / 3) * 3 + 3;
    return new Date(now.getFullYear(), q, 1);
  }

  /**
   * Compute statistics for a single goal period.
   * @param {Array} entries  - earnings entries
   * @param {number} goal    - target amount
   * @param {Date} periodStart
   * @param {Date} periodEnd
   * @param {string} label   - human-readable label
   * @returns {{ earned: number, goal: number, pct: number, projected: number, projPct: number, status: string, periodLabel: string, elapsed: number }}
   */
  function computePeriodStats(entries, goal, periodStart, periodEnd, label) {
    var earned = sumRange(entries, periodStart, periodEnd);
    var pct = goal > 0 ? Math.min(earned / goal, 1) : 0;
    var elapsed = periodProgress(periodStart, periodEnd);
    var projected = elapsed > 0 ? earned / elapsed : 0;
    var projPct = goal > 0 ? projected / goal : 0;

    var status;
    if (pct >= 1) {
      status = 'complete';
    } else if (projPct >= 0.95) {
      status = 'on-track';
    } else if (projPct >= 0.70) {
      status = 'at-risk';
    } else {
      status = 'behind';
    }

    return {
      earned: earned,
      goal: goal,
      pct: pct,
      projected: Math.round(projected),
      projPct: Math.min(projPct, 1),
      status: status,
      periodLabel: label,
      elapsed: elapsed
    };
  }

  // ─── Formatting ────────────────────────────────────────

  /**
   * Format a number as USD currency (no cents).
   * @param {number} n
   * @returns {string}
   */
  function fmtCurrency(n) {
    return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  /**
   * Format a 0-1 fraction as a percentage string.
   * @param {number} n
   * @returns {string}
   */
  function pctText(n) {
    return Math.round(n * 100) + '%';
  }

  // ─── Status Labels & Colors ────────────────────────────

  var STATUS_META = {
    'complete':  { label: 'Goal Met',  color: '#10b981', bg: '#ecfdf5', icon: '\u2714' },
    'on-track':  { label: 'On Track',  color: '#3b82f6', bg: '#eff6ff', icon: '\u2192' },
    'at-risk':   { label: 'At Risk',   color: '#f59e0b', bg: '#fffbeb', icon: '\u26A0' },
    'behind':    { label: 'Behind',    color: '#ef4444', bg: '#fef2f2', icon: '\u2193' }
  };

  // ─── Styles (injected once) ────────────────────────────

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var css = [
      '.egt-root { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; max-width: 720px; margin: 0 auto; color: #1e293b; }',
      '.egt-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }',
      '.egt-header h2 { margin: 0; font-size: 22px; font-weight: 700; }',
      '.egt-edit-btn { background: #3b82f6; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600; }',
      '.egt-edit-btn:hover { background: #2563eb; }',

      '.egt-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px 24px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }',
      '.egt-card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }',
      '.egt-period-label { font-size: 15px; font-weight: 600; color: #475569; }',
      '.egt-status-badge { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 600; padding: 3px 10px; border-radius: 999px; }',

      '.egt-amounts { display: flex; gap: 24px; margin-bottom: 14px; flex-wrap: wrap; }',
      '.egt-amount-block { display: flex; flex-direction: column; }',
      '.egt-amount-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; margin-bottom: 2px; }',
      '.egt-amount-value { font-size: 20px; font-weight: 700; }',

      '.egt-bar-wrapper { position: relative; height: 18px; background: #f1f5f9; border-radius: 999px; overflow: hidden; margin-bottom: 6px; }',
      '.egt-bar-fill { height: 100%; border-radius: 999px; transition: width 0.6s ease; }',
      '.egt-bar-projected { position: absolute; top: 0; height: 100%; border-right: 2px dashed rgba(0,0,0,0.25); transition: left 0.6s ease; }',
      '.egt-bar-label { display: flex; justify-content: space-between; font-size: 11px; color: #64748b; }',

      '.egt-projection { font-size: 12px; color: #64748b; margin-top: 6px; }',

      /* Modal */
      '.egt-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center; z-index: 10000; }',
      '.egt-modal { background: #fff; border-radius: 12px; padding: 28px 32px; width: 360px; max-width: 90vw; box-shadow: 0 8px 30px rgba(0,0,0,0.15); }',
      '.egt-modal h3 { margin: 0 0 18px; font-size: 18px; }',
      '.egt-modal label { display: block; font-size: 13px; font-weight: 600; color: #475569; margin-bottom: 4px; }',
      '.egt-modal input { width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 14px; margin-bottom: 14px; }',
      '.egt-modal-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 6px; }',
      '.egt-modal-actions button { padding: 8px 18px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; border: none; }',
      '.egt-btn-cancel { background: #f1f5f9; color: #475569; }',
      '.egt-btn-cancel:hover { background: #e2e8f0; }',
      '.egt-btn-save { background: #3b82f6; color: #fff; }',
      '.egt-btn-save:hover { background: #2563eb; }',

      /* Summary strip */
      '.egt-summary { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }',
      '.egt-summary-item { flex: 1; min-width: 140px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; text-align: center; }',
      '.egt-summary-item .egt-amount-label { margin-bottom: 4px; }',
      '.egt-summary-item .egt-amount-value { font-size: 22px; }'
    ].join('\n');

    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ─── Rendering ─────────────────────────────────────────

  var _containerId = null;
  var _earnings = null;

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
   * Build HTML for a single goal card.
   * @param {Object} stats - output of computePeriodStats
   * @returns {string}
   */
  function renderCard(stats) {
    var sm = STATUS_META[stats.status];
    var barColor = sm.color;
    var projLeft = Math.min(stats.projPct, 1) * 100;

    return (
      '<div class="egt-card">' +
        '<div class="egt-card-header">' +
          '<span class="egt-period-label">' + esc(stats.periodLabel) + '</span>' +
          '<span class="egt-status-badge" style="color:' + sm.color + ';background:' + sm.bg + ';">' +
            sm.icon + ' ' + sm.label +
          '</span>' +
        '</div>' +
        '<div class="egt-amounts">' +
          '<div class="egt-amount-block">' +
            '<span class="egt-amount-label">Earned</span>' +
            '<span class="egt-amount-value" style="color:' + sm.color + ';">' + fmtCurrency(stats.earned) + '</span>' +
          '</div>' +
          '<div class="egt-amount-block">' +
            '<span class="egt-amount-label">Goal</span>' +
            '<span class="egt-amount-value">' + fmtCurrency(stats.goal) + '</span>' +
          '</div>' +
          '<div class="egt-amount-block">' +
            '<span class="egt-amount-label">Projected</span>' +
            '<span class="egt-amount-value" style="color:#64748b;">' + fmtCurrency(stats.projected) + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="egt-bar-wrapper">' +
          '<div class="egt-bar-fill" style="width:' + (stats.pct * 100) + '%;background:' + barColor + ';opacity:0.85;"></div>' +
          (stats.pct < 1
            ? '<div class="egt-bar-projected" style="left:' + projLeft + '%;"></div>'
            : '') +
        '</div>' +
        '<div class="egt-bar-label">' +
          '<span>' + pctText(stats.pct) + ' earned</span>' +
          '<span>' + pctText(stats.elapsed) + ' of period elapsed</span>' +
        '</div>' +
        '<div class="egt-projection">' +
          (stats.status === 'complete'
            ? 'Congratulations &mdash; you have reached your ' + esc(stats.periodLabel.toLowerCase()) + '!'
            : 'At current pace you are projected to earn <strong>' + fmtCurrency(stats.projected) + '</strong> this period.') +
        '</div>' +
      '</div>'
    );
  }

  /**
   * Render the entire tracker into the container.
   */
  function render() {
    var container = document.getElementById(_containerId);
    if (!container) return;

    var now = new Date();
    var goals = getGoals();
    var earnings = _earnings;

    // Period boundaries
    var monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    var monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    var qStart     = quarterStart(now);
    var qEnd       = quarterEnd(now);
    var yearStart  = new Date(now.getFullYear(), 0, 1);
    var yearEnd    = new Date(now.getFullYear() + 1, 0, 1);

    var qNumber = Math.floor(now.getMonth() / 3) + 1;

    var periods = [
      computePeriodStats(earnings, goals.monthly,   monthStart, monthEnd, 'Monthly Goal'),
      computePeriodStats(earnings, goals.quarterly, qStart,     qEnd,     'Quarterly Goal (Q' + qNumber + ')'),
      computePeriodStats(earnings, goals.yearly,    yearStart,  yearEnd,  'Yearly Goal (' + now.getFullYear() + ')')
    ];

    // YTD earned (all entries from Jan 1 to now)
    var ytdEarned = sumRange(earnings, yearStart, new Date(now.getFullYear(), now.getMonth() + 1, 1));

    var html = '<div class="egt-root">';

    // Header
    html += '<div class="egt-header">';
    html += '<h2>Earnings Goal Tracker</h2>';
    html += '<button class="egt-edit-btn" id="egt-edit-goals-btn">Edit Goals</button>';
    html += '</div>';

    // Summary strip
    html += '<div class="egt-summary">';
    html += '<div class="egt-summary-item"><span class="egt-amount-label">YTD Earnings</span><span class="egt-amount-value">' + fmtCurrency(ytdEarned) + '</span></div>';
    html += '<div class="egt-summary-item"><span class="egt-amount-label">Monthly Goal</span><span class="egt-amount-value">' + fmtCurrency(goals.monthly) + '</span></div>';
    html += '<div class="egt-summary-item"><span class="egt-amount-label">Yearly Goal</span><span class="egt-amount-value">' + fmtCurrency(goals.yearly) + '</span></div>';
    html += '</div>';

    // Goal cards
    for (var i = 0; i < periods.length; i++) {
      html += renderCard(periods[i]);
    }

    html += '</div>';
    container.innerHTML = html;

    // Attach edit-goals handler
    var editBtn = document.getElementById('egt-edit-goals-btn');
    if (editBtn) {
      editBtn.addEventListener('click', function () {
        openGoalEditor();
      });
    }
  }

  // ─── Goal Editor Modal ─────────────────────────────────

  /**
   * Open the modal dialog for editing goals.
   */
  function openGoalEditor() {
    var goals = getGoals();

    var overlay = document.createElement('div');
    overlay.className = 'egt-overlay';
    overlay.innerHTML =
      '<div class="egt-modal">' +
        '<h3>Set Earnings Goals</h3>' +
        '<label for="egt-in-monthly">Monthly Goal ($)</label>' +
        '<input id="egt-in-monthly" type="number" min="0" step="100" value="' + goals.monthly + '">' +
        '<label for="egt-in-quarterly">Quarterly Goal ($)</label>' +
        '<input id="egt-in-quarterly" type="number" min="0" step="100" value="' + goals.quarterly + '">' +
        '<label for="egt-in-yearly">Yearly Goal ($)</label>' +
        '<input id="egt-in-yearly" type="number" min="0" step="100" value="' + goals.yearly + '">' +
        '<div class="egt-modal-actions">' +
          '<button class="egt-btn-cancel" id="egt-modal-cancel">Cancel</button>' +
          '<button class="egt-btn-save" id="egt-modal-save">Save</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);

    // Close on background click
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) {
        document.body.removeChild(overlay);
      }
    });

    document.getElementById('egt-modal-cancel').addEventListener('click', function () {
      document.body.removeChild(overlay);
    });

    document.getElementById('egt-modal-save').addEventListener('click', function () {
      var m = parseFloat(document.getElementById('egt-in-monthly').value) || 0;
      var q = parseFloat(document.getElementById('egt-in-quarterly').value) || 0;
      var y = parseFloat(document.getElementById('egt-in-yearly').value) || 0;
      saveGoals({ monthly: m, quarterly: q, yearly: y });
      document.body.removeChild(overlay);
      render();
    });
  }

  // ─── Public API ────────────────────────────────────────

  /**
   * Initialise the Earnings Goal Tracker.
   * Generates mock earnings data, injects styles, and renders into
   * the given container.
   * @param {string} containerId - DOM id of the container element.
   */
  function init(containerId) {
    injectStyles();
    _containerId = containerId;
    _earnings = generateMockEarnings();
    render();
    console.log('[EarningsGoalTracker] Initialized in #' + containerId);
  }

  /**
   * Programmatically set goals and re-render.
   * @param {{ monthly?: number, quarterly?: number, yearly?: number }} goals
   */
  function setGoals(goals) {
    var current = getGoals();
    if (typeof goals.monthly === 'number')    current.monthly = goals.monthly;
    if (typeof goals.quarterly === 'number')  current.quarterly = goals.quarterly;
    if (typeof goals.yearly === 'number')     current.yearly = goals.yearly;
    saveGoals(current);
    if (_containerId) render();
  }

  /**
   * Return computed stats for all three periods.
   * Useful for external integrations / dashboards.
   * @returns {Array<Object>}
   */
  function getStats() {
    var now = new Date();
    var goals = getGoals();
    var earnings = _earnings || generateMockEarnings();
    var monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    var monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    var qStart     = quarterStart(now);
    var qEnd       = quarterEnd(now);
    var yearStart  = new Date(now.getFullYear(), 0, 1);
    var yearEnd    = new Date(now.getFullYear() + 1, 0, 1);

    return [
      computePeriodStats(earnings, goals.monthly,   monthStart, monthEnd, 'Monthly'),
      computePeriodStats(earnings, goals.quarterly, qStart,     qEnd,     'Quarterly'),
      computePeriodStats(earnings, goals.yearly,    yearStart,  yearEnd,  'Yearly')
    ];
  }

  /**
   * Force a re-render (e.g. after external data changes).
   */
  function refresh() {
    if (_containerId) render();
  }

  // ─── Namespace Export ──────────────────────────────────

  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.EarningsGoalTracker = {
    init: init,
    setGoals: setGoals,
    getGoals: getGoals,
    getStats: getStats,
    refresh: refresh
  };
})();
