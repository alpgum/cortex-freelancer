/**
 * CortexBudgetTracker — Project Budget Tracking System
 * [cf3-007] Track budgets, burn rate, projections, alerts
 * Depends on: CortexProjectManager (project-manager.js), CortexTimeEngine (time-engine.js)
 */
;(function (global) {
  'use strict';

  var ALERT_KEY = 'cortex_budget_alerts_dismissed';

  /* ── Helpers ──────────────────────────────────────────────── */
  function $(sel) { return document.querySelector(sel); }
  function $$(sel) { return document.querySelectorAll(sel); }
  function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  function getJSON(key, fallback) {
    try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch (e) { return fallback; }
  }
  function setJSON(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* noop */ }
  }

  /* ── Data Layer ──────────────────────────────────────────── */

  /**
   * Build budget snapshot for a single project
   * @param {Object} project - Project record from CortexProjectManager
   * @returns {Object} Budget snapshot
   */
  function buildSnapshot(project) {
    var budget = project.budget || 0;
    var rate = project.hourlyRate || 0;
    var hoursLogged = project.totalLogged || 0;
    var spent = hoursLogged * rate;
    var remaining = budget - spent;
    var pct = budget > 0 ? (spent / budget) * 100 : 0;

    // Burn rate: hours per day since project started
    var startDate = new Date(project.createdAt);
    var now = new Date();
    var daysElapsed = Math.max(1, Math.ceil((now - startDate) / (1000 * 60 * 60 * 24)));
    var hoursPerDay = hoursLogged / daysElapsed;
    var spendPerDay = hoursPerDay * rate;

    // Projection: will budget last until deadline?
    var deadline = project.deadline ? new Date(project.deadline) : null;
    var daysUntilDeadline = deadline ? Math.max(0, Math.ceil((deadline - now) / (1000 * 60 * 60 * 24))) : null;
    var projectedSpend = daysUntilDeadline !== null ? spent + (spendPerDay * daysUntilDeadline) : null;
    var willExceed = projectedSpend !== null && budget > 0 ? projectedSpend > budget : false;

    // Days until budget runs out at current burn rate
    var daysRemaining = spendPerDay > 0 && remaining > 0
      ? Math.floor(remaining / spendPerDay)
      : remaining <= 0 ? 0 : null;

    // Status: green/yellow/red
    var status = 'green';
    if (budget > 0) {
      if (pct >= 100) status = 'red';
      else if (pct >= 80) status = 'red';
      else if (pct >= 60) status = 'yellow';
    }

    return {
      id: project.id,
      name: project.name,
      clientName: project.clientName || '',
      projectStatus: project.status,
      budget: budget,
      rate: rate,
      hoursLogged: hoursLogged,
      spent: spent,
      remaining: remaining,
      pct: Math.min(pct, 100),
      rawPct: pct,
      status: status,
      hoursPerDay: hoursPerDay,
      spendPerDay: spendPerDay,
      deadline: deadline,
      daysUntilDeadline: daysUntilDeadline,
      projectedSpend: projectedSpend,
      willExceed: willExceed,
      daysRemaining: daysRemaining,
      alertThreshold: pct >= 80 && budget > 0
    };
  }

  /**
   * Get budget snapshots for all active projects with budgets
   * @param {Object} [opts]
   * @param {boolean} [opts.includeAll] - Include projects with no budget
   * @param {string} [opts.sortBy] - pct, remaining, name (default: pct desc)
   * @returns {Object[]}
   */
  function getSnapshots(opts) {
    opts = opts || {};
    var PM = global.CortexProjectManager;
    if (!PM) return [];

    var projects = PM.list({ sortBy: 'createdAt', sortDir: 'desc' });
    var snapshots = [];

    projects.forEach(function (p) {
      if (p.status === 'archived') return;
      if (!opts.includeAll && (!p.budget || p.budget <= 0)) return;
      snapshots.push(buildSnapshot(p));
    });

    var sortBy = opts.sortBy || 'pct';
    snapshots.sort(function (a, b) {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'remaining') return a.remaining - b.remaining;
      return b.rawPct - a.rawPct; // highest usage first
    });

    return snapshots;
  }

  /**
   * Get aggregate budget stats
   * @returns {Object}
   */
  function getAggregate() {
    var snapshots = getSnapshots();
    var totalBudget = 0;
    var totalSpent = 0;
    var totalHours = 0;
    var alerts = 0;
    var overBudget = 0;

    snapshots.forEach(function (s) {
      totalBudget += s.budget;
      totalSpent += s.spent;
      totalHours += s.hoursLogged;
      if (s.alertThreshold) alerts++;
      if (s.rawPct >= 100) overBudget++;
    });

    return {
      totalBudget: totalBudget,
      totalSpent: totalSpent,
      totalRemaining: totalBudget - totalSpent,
      totalHours: totalHours,
      projectCount: snapshots.length,
      alerts: alerts,
      overBudget: overBudget,
      avgUtilization: snapshots.length > 0
        ? Math.round(snapshots.reduce(function (sum, s) { return sum + s.rawPct; }, 0) / snapshots.length)
        : 0
    };
  }

  /* ── Alert Management ────────────────────────────────────── */

  function getDismissedAlerts() {
    return getJSON(ALERT_KEY, {});
  }

  function dismissAlert(projectId) {
    var dismissed = getDismissedAlerts();
    dismissed[projectId] = new Date().toISOString();
    setJSON(ALERT_KEY, dismissed);
  }

  function getActiveAlerts() {
    var snapshots = getSnapshots();
    var dismissed = getDismissedAlerts();

    return snapshots.filter(function (s) {
      if (!s.alertThreshold) return false;
      // Re-alert if dismissed more than 24h ago
      if (dismissed[s.id]) {
        var dismissedAt = new Date(dismissed[s.id]);
        var hoursSince = (new Date() - dismissedAt) / (1000 * 60 * 60);
        if (hoursSince < 24) return false;
      }
      return true;
    });
  }

  /* ── Rendering ───────────────────────────────────────────── */

  function formatCurrency(n) {
    if (n < 0) return '-$' + formatCurrency(-n).slice(1);
    if (n >= 1000) return '$' + (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return '$' + Math.round(n);
  }

  function formatHours(h) {
    return h < 1 ? Math.round(h * 60) + 'm' : h.toFixed(1).replace(/\.0$/, '') + 'h';
  }

  /**
   * Render the budget tracker widget into a container
   * @param {string} containerId - Target element ID
   */
  function renderWidget(containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;

    var snapshots = getSnapshots();
    var agg = getAggregate();

    if (snapshots.length === 0) {
      container.innerHTML =
        '<div class="budget-empty">' +
          '<div class="budget-empty-icon">💰</div>' +
          '<p>No projects with budgets yet</p>' +
          '<p class="budget-empty-sub">Add a budget to your projects to track spending</p>' +
        '</div>';
      return;
    }

    var html = '';

    // Summary bar
    html += '<div class="budget-summary">';
    html += '<div class="budget-summary-item"><div class="budget-summary-val" style="color:var(--blue)">' + formatCurrency(agg.totalBudget) + '</div><div class="budget-summary-label">Total Budget</div></div>';
    html += '<div class="budget-summary-item"><div class="budget-summary-val" style="color:var(--orange)">' + formatCurrency(agg.totalSpent) + '</div><div class="budget-summary-label">Total Spent</div></div>';
    html += '<div class="budget-summary-item"><div class="budget-summary-val" style="color:' + (agg.totalRemaining < 0 ? 'var(--red)' : 'var(--green)') + '">' + formatCurrency(agg.totalRemaining) + '</div><div class="budget-summary-label">Remaining</div></div>';
    if (agg.alerts > 0) {
      html += '<div class="budget-summary-item"><div class="budget-summary-val" style="color:var(--red)">' + agg.alerts + '</div><div class="budget-summary-label">Alerts</div></div>';
    }
    html += '</div>';

    // Project list
    html += '<div class="budget-list">';
    snapshots.forEach(function (s) {
      html += renderBudgetRow(s);
    });
    html += '</div>';

    container.innerHTML = html;

    // Bind dismiss buttons
    container.querySelectorAll('.budget-alert-dismiss').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var id = btn.dataset.id;
        dismissAlert(id);
        var alertEl = btn.closest('.budget-alert-banner');
        if (alertEl) alertEl.style.display = 'none';
      });
    });
  }

  function renderBudgetRow(s) {
    var barColor = s.status === 'red' ? 'var(--red)' :
                   s.status === 'yellow' ? 'var(--yellow)' : 'var(--green)';

    var html = '<div class="budget-row">';

    // Alert banner
    if (s.alertThreshold) {
      var dismissed = getDismissedAlerts();
      var isDismissed = dismissed[s.id] && (new Date() - new Date(dismissed[s.id])) / (1000 * 60 * 60) < 24;
      if (!isDismissed) {
        var alertMsg = s.rawPct >= 100
          ? 'Over budget by ' + formatCurrency(Math.abs(s.remaining))
          : Math.round(s.rawPct) + '% budget consumed';
        html += '<div class="budget-alert-banner">' +
          '<span class="budget-alert-icon">⚠️</span> ' +
          '<span class="budget-alert-msg">' + alertMsg + '</span>' +
          '<button class="budget-alert-dismiss" data-id="' + esc(s.id) + '" title="Dismiss">✕</button>' +
        '</div>';
      }
    }

    // Header
    html += '<div class="budget-row-header">';
    html += '<div class="budget-row-name">' + esc(s.name) + '</div>';
    if (s.clientName) {
      html += '<div class="budget-row-client">' + esc(s.clientName) + '</div>';
    }
    html += '</div>';

    // Progress bar
    html += '<div class="budget-progress">';
    html += '<div class="budget-progress-bar">';
    html += '<div class="budget-progress-fill" style="width:' + Math.min(s.pct, 100) + '%;background:' + barColor + '"></div>';
    html += '</div>';
    html += '<div class="budget-progress-label">' + Math.round(s.rawPct) + '%</div>';
    html += '</div>';

    // Metrics row
    html += '<div class="budget-row-metrics">';
    html += '<div class="budget-metric"><span class="budget-metric-label">Budget</span><span class="budget-metric-val">' + formatCurrency(s.budget) + '</span></div>';
    html += '<div class="budget-metric"><span class="budget-metric-label">Spent</span><span class="budget-metric-val" style="color:var(--orange)">' + formatCurrency(s.spent) + '</span></div>';
    html += '<div class="budget-metric"><span class="budget-metric-label">Remaining</span><span class="budget-metric-val" style="color:' + (s.remaining < 0 ? 'var(--red)' : 'var(--green)') + '">' + formatCurrency(s.remaining) + '</span></div>';
    html += '<div class="budget-metric"><span class="budget-metric-label">Hours</span><span class="budget-metric-val">' + formatHours(s.hoursLogged) + ' × $' + s.rate + '</span></div>';
    html += '</div>';

    // Burn rate & projection
    html += '<div class="budget-row-projection">';
    if (s.spendPerDay > 0) {
      html += '<span class="budget-burn">🔥 ' + formatCurrency(s.spendPerDay) + '/day burn rate</span>';
    }
    if (s.daysRemaining !== null && s.daysRemaining > 0) {
      html += '<span class="budget-runway">~' + s.daysRemaining + ' days of budget left</span>';
    } else if (s.remaining <= 0) {
      html += '<span class="budget-runway over">Budget exhausted</span>';
    }
    if (s.deadline && s.willExceed) {
      html += '<span class="budget-warning">⚠️ Projected to exceed budget before deadline</span>';
    } else if (s.deadline && !s.willExceed && s.spendPerDay > 0) {
      html += '<span class="budget-ok">✓ On track for deadline</span>';
    }
    html += '</div>';

    html += '</div>';
    return html;
  }

  /**
   * Render compact widget for dashboard
   * @param {string} containerId
   */
  function renderDashboardWidget(containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;

    var snapshots = getSnapshots();
    if (snapshots.length === 0) {
      container.innerHTML = '<div class="budget-empty"><div class="budget-empty-icon">💰</div><p>No budgets set</p></div>';
      return;
    }

    // Show top 3 + alerts count
    var alerts = getActiveAlerts();
    var html = '';

    if (alerts.length > 0) {
      html += '<div class="budget-dash-alert">⚠️ ' + alerts.length + ' project' + (alerts.length > 1 ? 's' : '') + ' at 80%+ budget</div>';
    }

    snapshots.slice(0, 4).forEach(function (s) {
      var barColor = s.status === 'red' ? 'var(--red)' :
                     s.status === 'yellow' ? 'var(--yellow)' : 'var(--green)';

      html += '<div class="budget-dash-row">';
      html += '<div class="budget-dash-info"><span class="budget-dash-name">' + esc(s.name) + '</span><span class="budget-dash-pct" style="color:' + barColor + '">' + Math.round(s.rawPct) + '%</span></div>';
      html += '<div class="budget-dash-bar"><div class="budget-dash-bar-fill" style="width:' + Math.min(s.pct, 100) + '%;background:' + barColor + '"></div></div>';
      html += '<div class="budget-dash-sub">' + formatCurrency(s.remaining) + ' left' + (s.willExceed ? ' · ⚠️ over by deadline' : '') + '</div>';
      html += '</div>';
    });

    if (snapshots.length > 4) {
      html += '<div class="budget-dash-more">+' + (snapshots.length - 4) + ' more</div>';
    }

    container.innerHTML = html;
  }

  /* ── CSS Injection ───────────────────────────────────────── */

  function injectStyles() {
    if (document.getElementById('budget-tracker-styles')) return;
    var style = document.createElement('style');
    style.id = 'budget-tracker-styles';
    style.textContent =
      /* Empty state */
      '.budget-empty{text-align:center;padding:2rem 1rem;color:var(--text2)}' +
      '.budget-empty-icon{font-size:2rem;margin-bottom:.5rem}' +
      '.budget-empty-sub{font-size:.8rem;color:var(--text3);margin-top:.25rem}' +

      /* Summary */
      '.budget-summary{display:flex;gap:1rem;padding:.75rem 0;border-bottom:1px solid var(--bg4);margin-bottom:.75rem;flex-wrap:wrap}' +
      '.budget-summary-item{flex:1;min-width:70px;text-align:center}' +
      '.budget-summary-val{font-size:1.1rem;font-weight:700}' +
      '.budget-summary-label{font-size:.7rem;color:var(--text3);margin-top:.15rem}' +

      /* Budget list */
      '.budget-list{display:flex;flex-direction:column;gap:.75rem}' +
      '.budget-row{background:var(--bg3);border-radius:var(--radius-sm);padding:.75rem;transition:border-color .2s;border:1px solid transparent}' +
      '.budget-row:hover{border-color:var(--bg4)}' +

      /* Alert banner */
      '.budget-alert-banner{display:flex;align-items:center;gap:.5rem;padding:.4rem .6rem;border-radius:6px;background:rgba(255,68,68,.12);color:var(--red);font-size:.78rem;margin-bottom:.5rem}' +
      '.budget-alert-icon{flex-shrink:0}' +
      '.budget-alert-msg{flex:1}' +
      '.budget-alert-dismiss{background:none;border:none;color:var(--text3);cursor:pointer;font-size:.7rem;padding:2px 4px;border-radius:4px;transition:color .2s}' +
      '.budget-alert-dismiss:hover{color:var(--text)}' +

      /* Row header */
      '.budget-row-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:.4rem}' +
      '.budget-row-name{font-weight:600;font-size:.9rem}' +
      '.budget-row-client{font-size:.75rem;color:var(--text3)}' +

      /* Progress bar */
      '.budget-progress{display:flex;align-items:center;gap:.5rem;margin-bottom:.4rem}' +
      '.budget-progress-bar{flex:1;height:8px;background:var(--bg4);border-radius:4px;overflow:hidden}' +
      '.budget-progress-fill{height:100%;border-radius:4px;transition:width .4s ease}' +
      '.budget-progress-label{font-size:.75rem;font-weight:600;min-width:2.5rem;text-align:right}' +

      /* Metrics row */
      '.budget-row-metrics{display:flex;gap:.75rem;flex-wrap:wrap;margin-bottom:.35rem}' +
      '.budget-metric{display:flex;flex-direction:column;gap:.1rem;min-width:60px}' +
      '.budget-metric-label{font-size:.65rem;color:var(--text3);text-transform:uppercase;letter-spacing:.03em}' +
      '.budget-metric-val{font-size:.8rem;font-weight:600}' +

      /* Projection row */
      '.budget-row-projection{display:flex;gap:.75rem;flex-wrap:wrap;font-size:.75rem;color:var(--text2)}' +
      '.budget-burn{color:var(--orange)}' +
      '.budget-runway{color:var(--blue)}' +
      '.budget-runway.over{color:var(--red)}' +
      '.budget-warning{color:var(--yellow)}' +
      '.budget-ok{color:var(--green)}' +

      /* Dashboard compact widget */
      '.budget-dash-alert{padding:.4rem .6rem;border-radius:6px;background:rgba(255,68,68,.1);color:var(--red);font-size:.78rem;margin-bottom:.5rem}' +
      '.budget-dash-row{padding:.4rem 0;border-bottom:1px solid var(--bg4)}' +
      '.budget-dash-row:last-child{border-bottom:none}' +
      '.budget-dash-info{display:flex;justify-content:space-between;align-items:center;margin-bottom:.25rem}' +
      '.budget-dash-name{font-size:.82rem;font-weight:500}' +
      '.budget-dash-pct{font-size:.78rem;font-weight:700}' +
      '.budget-dash-bar{height:5px;background:var(--bg4);border-radius:3px;overflow:hidden;margin-bottom:.2rem}' +
      '.budget-dash-bar-fill{height:100%;border-radius:3px;transition:width .4s ease}' +
      '.budget-dash-sub{font-size:.72rem;color:var(--text3)}' +
      '.budget-dash-more{text-align:center;font-size:.75rem;color:var(--text3);padding:.4rem 0}';

    document.head.appendChild(style);
  }

  /* ── Init ─────────────────────────────────────────────────── */

  function init() {
    injectStyles();

    // Render full widget if container exists
    if (document.getElementById('budget-tracker')) {
      renderWidget('budget-tracker');
    }

    // Render dashboard widget if container exists
    if (document.getElementById('budget-widget')) {
      renderDashboardWidget('budget-widget');
    }
  }

  /* ── Boot ─────────────────────────────────────────────────── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* ── Public API ──────────────────────────────────────────── */
  global.CortexBudgetTracker = {
    init: init,
    getSnapshots: getSnapshots,
    getAggregate: getAggregate,
    getActiveAlerts: getActiveAlerts,
    dismissAlert: dismissAlert,
    buildSnapshot: buildSnapshot,
    renderWidget: renderWidget,
    renderDashboardWidget: renderDashboardWidget
  };

})(typeof window !== 'undefined' ? window : globalThis);
