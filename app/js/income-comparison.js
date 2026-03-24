/**
 * [CF-156] Income Dashboard — Comparison with Previous Period
 * Shows month-over-month and year-over-year revenue comparison
 * with visual indicators and trend analysis.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_income_entries';
  var CSS_ID = 'cf-ic-styles';
  var _container = null;
  var _injected = false;

  /* ── Helpers ── */

  function esc(s) { return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function getEntries() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
    catch (e) { return []; }
  }

  function fmtCurrency(n) {
    if (n == null || isNaN(n)) return '$0';
    return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  function fmtPct(n) {
    if (n == null || isNaN(n) || !isFinite(n)) return '—';
    var sign = n > 0 ? '+' : '';
    return sign + n.toFixed(1) + '%';
  }

  function pctColor(n) {
    if (n == null || isNaN(n) || !isFinite(n)) return '#888';
    return n >= 0 ? '#22c55e' : '#ef4444';
  }

  function monthKey(d) {
    var date = typeof d === 'string' ? new Date(d + 'T00:00:00') : d;
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
  }

  function monthLabel(key) {
    var parts = key.split('-');
    var names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return names[parseInt(parts[1], 10) - 1] + ' ' + parts[0].slice(2);
  }

  /* ── Data Processing ── */

  function buildMonthlyTotals(entries) {
    var totals = {};
    entries.forEach(function (e) {
      if (!e.date || !e.amount) return;
      var key = e.date.substring(0, 7);
      totals[key] = (totals[key] || 0) + Number(e.amount);
    });
    return totals;
  }

  function getMonthKeys(year) {
    var keys = [];
    for (var m = 1; m <= 12; m++) {
      keys.push(year + '-' + String(m).padStart(2, '0'));
    }
    return keys;
  }

  function computeComparison() {
    var entries = getEntries();
    var totals = buildMonthlyTotals(entries);
    var now = new Date();
    var curYear = now.getFullYear();
    var curMonth = now.getMonth() + 1;

    // Month-over-month data for current year
    var mom = [];
    var curKeys = getMonthKeys(curYear);
    for (var i = 0; i < curKeys.length; i++) {
      var key = curKeys[i];
      var prevKey = i === 0
        ? (curYear - 1) + '-12'
        : curKeys[i - 1];
      var cur = totals[key] || 0;
      var prev = totals[prevKey] || 0;
      var change = prev > 0 ? ((cur - prev) / prev) * 100 : (cur > 0 ? 100 : 0);
      mom.push({ month: key, revenue: cur, prevRevenue: prev, change: change });
    }

    // Year-over-year: compare each month current year vs previous year
    var yoy = [];
    var prevKeys = getMonthKeys(curYear - 1);
    for (var j = 0; j < 12; j++) {
      var curRev = totals[curKeys[j]] || 0;
      var prevRev = totals[prevKeys[j]] || 0;
      var yoyChange = prevRev > 0 ? ((curRev - prevRev) / prevRev) * 100 : (curRev > 0 ? 100 : 0);
      yoy.push({ month: curKeys[j], curYear: curRev, prevYear: prevRev, change: yoyChange });
    }

    // Summary
    var curYearTotal = 0, prevYearTotal = 0;
    curKeys.forEach(function (k) { curYearTotal += (totals[k] || 0); });
    prevKeys.forEach(function (k) { prevYearTotal += (totals[k] || 0); });

    var curMonthKey = curKeys[curMonth - 1];
    var prevMonthKey = curMonth > 1 ? curKeys[curMonth - 2] : (curYear - 1) + '-12';
    var sameMonthLastYear = prevKeys[curMonth - 1];

    return {
      mom: mom,
      yoy: yoy,
      currentYear: curYear,
      summary: {
        thisMonth: totals[curMonthKey] || 0,
        lastMonth: totals[prevMonthKey] || 0,
        sameMonthLastYear: totals[sameMonthLastYear] || 0,
        ytd: curYearTotal,
        prevYtd: prevYearTotal,
        momChange: (totals[prevMonthKey] || 0) > 0
          ? (((totals[curMonthKey] || 0) - (totals[prevMonthKey] || 0)) / (totals[prevMonthKey] || 1)) * 100
          : ((totals[curMonthKey] || 0) > 0 ? 100 : 0),
        yoyChange: prevYearTotal > 0 ? ((curYearTotal - prevYearTotal) / prevYearTotal) * 100 : (curYearTotal > 0 ? 100 : 0),
        avgMonthly: curMonth > 0 ? curYearTotal / curMonth : 0,
        bestMonth: null,
        bestMonthRev: 0
      }
    };
  }

  /* ── CSS ── */

  function injectCSS() {
    if (_injected) return;
    _injected = true;
    var s = document.createElement('style');
    s.id = CSS_ID;
    s.textContent = [
      '.ic-panel{background:var(--bg-primary,#0a0a0a);border:1px solid var(--border,#1e1e1e);border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:var(--text-primary,#e0e0e0);overflow:hidden}',
      '.ic-header{padding:16px 20px;border-bottom:1px solid var(--border,#1e1e1e);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px}',
      '.ic-title{font-size:16px;font-weight:700}',
      '.ic-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;padding:16px 20px}',
      '.ic-card{background:var(--bg-secondary,#111);border:1px solid var(--border,#1e1e1e);border-radius:10px;padding:14px 16px}',
      '.ic-card-label{font-size:11px;color:var(--text-muted,#888);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px}',
      '.ic-card-value{font-size:20px;font-weight:700}',
      '.ic-card-sub{font-size:11px;margin-top:4px}',
      '.ic-section{padding:16px 20px;border-top:1px solid var(--border,#1e1e1e)}',
      '.ic-section-title{font-size:13px;font-weight:600;color:var(--text-secondary,#ccc);margin-bottom:12px}',
      '.ic-bar-row{display:flex;align-items:center;gap:10px;margin-bottom:8px;font-size:12px}',
      '.ic-bar-label{width:50px;text-align:right;color:var(--text-muted,#888);flex-shrink:0}',
      '.ic-bar-track{flex:1;height:24px;background:var(--bg-secondary,#111);border-radius:6px;position:relative;overflow:hidden;display:flex;align-items:center}',
      '.ic-bar-fill{height:100%;border-radius:6px;transition:width .3s}',
      '.ic-bar-val{position:absolute;right:8px;font-size:11px;font-weight:600;color:var(--text-primary,#e0e0e0)}',
      '.ic-bar-change{width:60px;text-align:right;font-weight:600;font-size:11px;flex-shrink:0}',
      '.ic-yoy-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px}',
      '.ic-yoy-cell{background:var(--bg-secondary,#111);border:1px solid var(--border,#1e1e1e);border-radius:8px;padding:10px;text-align:center}',
      '.ic-yoy-month{font-size:11px;color:var(--text-muted,#888);margin-bottom:4px}',
      '.ic-yoy-cur{font-size:14px;font-weight:700}',
      '.ic-yoy-prev{font-size:11px;color:var(--text-muted,#888);margin-top:2px}',
      '.ic-yoy-change{font-size:11px;font-weight:600;margin-top:4px}',
      '.ic-trend{display:flex;align-items:center;gap:6px;padding:12px 20px;background:var(--bg-secondary,#111);border-top:1px solid var(--border,#1e1e1e);font-size:13px}',
      '.ic-trend-icon{font-size:18px}',
      '@media(max-width:600px){.ic-cards{grid-template-columns:1fr 1fr}.ic-yoy-grid{grid-template-columns:repeat(3,1fr)}.ic-bar-label{width:35px}}'
    ].join('\n');
    document.head.appendChild(s);
  }

  /* ── Render ── */

  function render(container) {
    injectCSS();
    var el = typeof container === 'string' ? document.querySelector(container) : container;
    if (!el) return;
    _container = el;

    var data = computeComparison();
    var s = data.summary;
    var maxMoM = 0;
    data.mom.forEach(function (m) { if (m.revenue > maxMoM) maxMoM = m.revenue; });

    var h = '<div class="ic-panel">';

    // Header
    h += '<div class="ic-header"><span class="ic-title">Income Comparison</span>';
    h += '<span style="font-size:12px;color:var(--text-muted,#888)">' + data.currentYear + ' vs ' + (data.currentYear - 1) + '</span></div>';

    // Summary cards
    h += '<div class="ic-cards">';
    h += '<div class="ic-card"><div class="ic-card-label">This Month</div><div class="ic-card-value" style="color:#7c3aed">' + fmtCurrency(s.thisMonth) + '</div>';
    h += '<div class="ic-card-sub" style="color:' + pctColor(s.momChange) + '">' + fmtPct(s.momChange) + ' vs last month</div></div>';

    h += '<div class="ic-card"><div class="ic-card-label">Last Month</div><div class="ic-card-value">' + fmtCurrency(s.lastMonth) + '</div>';
    h += '<div class="ic-card-sub">Previous period</div></div>';

    h += '<div class="ic-card"><div class="ic-card-label">Same Month Last Year</div><div class="ic-card-value">' + fmtCurrency(s.sameMonthLastYear) + '</div>';
    var sameMonthChange = s.sameMonthLastYear > 0 ? ((s.thisMonth - s.sameMonthLastYear) / s.sameMonthLastYear) * 100 : (s.thisMonth > 0 ? 100 : 0);
    h += '<div class="ic-card-sub" style="color:' + pctColor(sameMonthChange) + '">' + fmtPct(sameMonthChange) + ' YoY</div></div>';

    h += '<div class="ic-card"><div class="ic-card-label">YTD Total</div><div class="ic-card-value" style="color:#22c55e">' + fmtCurrency(s.ytd) + '</div>';
    h += '<div class="ic-card-sub" style="color:' + pctColor(s.yoyChange) + '">' + fmtPct(s.yoyChange) + ' vs last year</div></div>';

    h += '<div class="ic-card"><div class="ic-card-label">Avg Monthly</div><div class="ic-card-value">' + fmtCurrency(s.avgMonthly) + '</div>';
    h += '<div class="ic-card-sub">This year</div></div>';

    h += '<div class="ic-card"><div class="ic-card-label">Prev Year Total</div><div class="ic-card-value">' + fmtCurrency(s.prevYtd) + '</div>';
    h += '<div class="ic-card-sub">' + (data.currentYear - 1) + '</div></div>';
    h += '</div>';

    // Month-over-Month chart
    h += '<div class="ic-section"><div class="ic-section-title">Month-over-Month Revenue</div>';
    data.mom.forEach(function (m) {
      var pct = maxMoM > 0 ? (m.revenue / maxMoM) * 100 : 0;
      var color = m.change >= 0 ? '#7c3aed' : '#6d28d9';
      h += '<div class="ic-bar-row">';
      h += '<div class="ic-bar-label">' + monthLabel(m.month) + '</div>';
      h += '<div class="ic-bar-track"><div class="ic-bar-fill" style="width:' + pct + '%;background:' + color + '"></div>';
      h += '<div class="ic-bar-val">' + fmtCurrency(m.revenue) + '</div></div>';
      h += '<div class="ic-bar-change" style="color:' + pctColor(m.change) + '">' + fmtPct(m.change) + '</div>';
      h += '</div>';
    });
    h += '</div>';

    // Year-over-Year grid
    h += '<div class="ic-section"><div class="ic-section-title">Year-over-Year Comparison</div>';
    h += '<div class="ic-yoy-grid">';
    data.yoy.forEach(function (m) {
      h += '<div class="ic-yoy-cell">';
      h += '<div class="ic-yoy-month">' + monthLabel(m.month) + '</div>';
      h += '<div class="ic-yoy-cur">' + fmtCurrency(m.curYear) + '</div>';
      h += '<div class="ic-yoy-prev">' + fmtCurrency(m.prevYear) + ' prev</div>';
      h += '<div class="ic-yoy-change" style="color:' + pctColor(m.change) + '">' + fmtPct(m.change) + '</div>';
      h += '</div>';
    });
    h += '</div></div>';

    // Trend summary
    var trend = s.yoyChange >= 10 ? 'Strong growth trend — revenue is up significantly year-over-year.'
      : s.yoyChange >= 0 ? 'Steady performance — revenue is stable or slightly up compared to last year.'
      : 'Revenue is down compared to last year. Consider diversifying income sources.';
    var trendIcon = s.yoyChange >= 10 ? '&#9650;' : s.yoyChange >= 0 ? '&#9654;' : '&#9660;';
    h += '<div class="ic-trend"><span class="ic-trend-icon" style="color:' + pctColor(s.yoyChange) + '">' + trendIcon + '</span>';
    h += '<span>' + trend + '</span></div>';

    h += '</div>';
    el.innerHTML = h;
  }

  function init(containerId) {
    var data = computeComparison();
    if (containerId) render(containerId);
    return data;
  }

  function destroy() {
    if (_container) { _container.innerHTML = ''; _container = null; }
    var s = document.getElementById(CSS_ID);
    if (s) s.parentNode.removeChild(s);
    _injected = false;
  }

  /* ── Public API ── */
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.IncomeComparison = {
    init: init,
    render: render,
    destroy: destroy,
    computeComparison: computeComparison
  };
})();
