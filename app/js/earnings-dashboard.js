/**
 * [CF-051] Earnings Dashboard with Monthly/Yearly Breakdown
 * Charts for monthly revenue, YoY growth, and category breakdown.
 * Reads from shared localStorage earnings data. Provides canvas-based
 * chart rendering and comprehensive data aggregation.
 * Exposed on window.CortexFreelancer.earningsDashboard
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_earnings';
  var FALLBACK_KEY = 'cortex_earnings_entries';

  /* ── Storage Helpers ── */

  /**
   * Load earnings from localStorage, trying both keys
   * @returns {Array}
   */
  function loadEarnings() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      var entries = raw ? JSON.parse(raw) : [];
      if (entries.length === 0) {
        raw = localStorage.getItem(FALLBACK_KEY);
        entries = raw ? JSON.parse(raw) : [];
      }
      return entries;
    } catch (e) {
      return [];
    }
  }

  /* ── Formatting Helpers ── */

  /**
   * Format a number as currency
   * @param {number} n
   * @returns {string}
   */
  function fmtCurrency(n) {
    if (n == null || isNaN(n)) return '$0';
    if (n >= 1000000) return '$' + (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return '$' + (n / 1000).toFixed(1) + 'K';
    return '$' + Math.round(n);
  }

  /**
   * Format a percentage
   * @param {number} pct
   * @returns {string}
   */
  function fmtPct(pct) {
    if (pct == null || isNaN(pct)) return '0%';
    return (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%';
  }

  var MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  /* ── Data Aggregation ── */

  /**
   * Get monthly revenue for a given year
   * @param {number} year
   * @returns {{months: number[], labels: string[], total: number}}
   */
  function getMonthlyRevenue(year) {
    var earnings = loadEarnings();
    var months = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    var total = 0;

    for (var i = 0; i < earnings.length; i++) {
      var d = new Date(earnings[i].date || earnings[i].createdAt);
      if (d.getFullYear() === year) {
        var amt = earnings[i].amount || 0;
        months[d.getMonth()] += amt;
        total += amt;
      }
    }

    return { months: months, labels: MONTH_LABELS.slice(), total: total };
  }

  /**
   * Get all years that have earnings data
   * @returns {number[]}
   */
  function getAvailableYears() {
    var earnings = loadEarnings();
    var years = {};
    for (var i = 0; i < earnings.length; i++) {
      var d = new Date(earnings[i].date || earnings[i].createdAt);
      years[d.getFullYear()] = true;
    }
    return Object.keys(years).map(Number).sort();
  }

  /**
   * Calculate YoY growth between two years
   * @param {number} currentYear
   * @param {number} previousYear
   * @returns {{currentTotal: number, previousTotal: number, growthAbs: number, growthPct: number, monthlyComparison: Array}}
   */
  function getYoYGrowth(currentYear, previousYear) {
    var current = getMonthlyRevenue(currentYear);
    var previous = getMonthlyRevenue(previousYear);

    var growthAbs = current.total - previous.total;
    var growthPct = previous.total > 0
      ? (growthAbs / previous.total) * 100
      : (current.total > 0 ? 100 : 0);

    var monthlyComparison = [];
    for (var i = 0; i < 12; i++) {
      var diff = current.months[i] - previous.months[i];
      var pct = previous.months[i] > 0
        ? (diff / previous.months[i]) * 100
        : (current.months[i] > 0 ? 100 : 0);
      monthlyComparison.push({
        month: MONTH_LABELS[i],
        current: current.months[i],
        previous: previous.months[i],
        diff: diff,
        growthPct: Math.round(pct * 10) / 10
      });
    }

    return {
      currentTotal: current.total,
      previousTotal: previous.total,
      growthAbs: growthAbs,
      growthPct: Math.round(growthPct * 10) / 10,
      monthlyComparison: monthlyComparison
    };
  }

  /**
   * Get earnings breakdown by category
   * @param {number} [year] - Optional year filter
   * @returns {Array<{category: string, total: number, count: number, avgPerProject: number, pct: number}>}
   */
  function getCategoryBreakdown(year) {
    var earnings = loadEarnings();
    var cats = {};
    var grandTotal = 0;

    for (var i = 0; i < earnings.length; i++) {
      var e = earnings[i];
      if (year) {
        var d = new Date(e.date || e.createdAt);
        if (d.getFullYear() !== year) continue;
      }
      var cat = e.category || 'Other';
      if (!cats[cat]) cats[cat] = { category: cat, total: 0, count: 0 };
      cats[cat].total += e.amount || 0;
      cats[cat].count++;
      grandTotal += e.amount || 0;
    }

    var result = [];
    var keys = Object.keys(cats);
    for (var j = 0; j < keys.length; j++) {
      var c = cats[keys[j]];
      c.avgPerProject = c.count > 0 ? Math.round(c.total / c.count) : 0;
      c.pct = grandTotal > 0 ? Math.round((c.total / grandTotal) * 1000) / 10 : 0;
      result.push(c);
    }

    result.sort(function (a, b) { return b.total - a.total; });
    return result;
  }

  /**
   * Get a comprehensive summary for the dashboard
   * @returns {object}
   */
  function getSummary() {
    var now = new Date();
    var currentYear = now.getFullYear();
    var currentMonth = getMonthlyRevenue(currentYear);
    var previousYear = getMonthlyRevenue(currentYear - 1);

    var earnings = loadEarnings();
    var totalHours = 0;
    for (var i = 0; i < earnings.length; i++) {
      totalHours += earnings[i].hours || 0;
    }

    var thisMonthRevenue = currentMonth.months[now.getMonth()];
    var lastMonthRevenue = now.getMonth() > 0
      ? currentMonth.months[now.getMonth() - 1]
      : previousYear.months[11];

    var monthGrowth = lastMonthRevenue > 0
      ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
      : (thisMonthRevenue > 0 ? 100 : 0);

    return {
      thisMonthRevenue: thisMonthRevenue,
      lastMonthRevenue: lastMonthRevenue,
      monthOverMonthGrowth: Math.round(monthGrowth * 10) / 10,
      yearToDate: currentMonth.total,
      previousYearTotal: previousYear.total,
      totalAllTime: earnings.reduce(function (sum, e) { return sum + (e.amount || 0); }, 0),
      totalProjects: earnings.length,
      totalHours: totalHours,
      avgProjectValue: earnings.length > 0
        ? Math.round(earnings.reduce(function (sum, e) { return sum + (e.amount || 0); }, 0) / earnings.length)
        : 0,
      revenuePerHour: totalHours > 0
        ? Math.round(earnings.reduce(function (sum, e) { return sum + (e.amount || 0); }, 0) / totalHours)
        : 0
    };
  }

  /* ── Chart Rendering ── */

  /**
   * Render a bar chart on a canvas element
   * @param {string} containerId - DOM element id
   * @param {object} data - {labels: string[], values: number[], title?: string, color?: string}
   */
  function renderBarChart(containerId, data) {
    var container = document.getElementById(containerId);
    if (!container) {
      console.error('[EarningsDashboard] Container not found:', containerId);
      return;
    }
    if (!data || !data.labels || !data.values || !data.labels.length) {
      container.innerHTML = '<p style="color:#71717a;text-align:center">No data to display</p>';
      return;
    }

    var labels = data.labels;
    var values = data.values;
    var title = data.title || '';
    var barColor = data.color || '#22c55e';

    var width = container.offsetWidth || 600;
    var height = 300;
    var pad = { top: 40, right: 20, bottom: 50, left: 65 };

    var oldCanvas = container.querySelector('canvas');
    if (oldCanvas) container.removeChild(oldCanvas);

    var canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    container.appendChild(canvas);

    var ctx = canvas.getContext('2d');
    var chartW = width - pad.left - pad.right;
    var chartH = height - pad.top - pad.bottom;
    var max = Math.max.apply(null, values) || 1;
    var magnitude = Math.pow(10, Math.floor(Math.log10(max)));
    var niceMax = Math.ceil(max / magnitude) * magnitude || 1;
    var barW = Math.max(chartW / labels.length - 8, 10);
    var gap = (chartW - barW * labels.length) / (labels.length + 1);

    // Background
    ctx.fillStyle = '#18181b';
    ctx.fillRect(0, 0, width, height);

    // Title
    if (title) {
      ctx.fillStyle = '#e4e4e7';
      ctx.font = 'bold 14px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(title, width / 2, 24);
    }

    // Y-axis grid
    ctx.font = '11px -apple-system, sans-serif';
    ctx.textAlign = 'right';
    var gridLines = 5;
    for (var i = 0; i <= gridLines; i++) {
      var yVal = (niceMax / gridLines) * i;
      var y = pad.top + chartH - (yVal / niceMax) * chartH;
      ctx.strokeStyle = '#27272a';
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(width - pad.right, y);
      ctx.stroke();
      ctx.fillStyle = '#71717a';
      ctx.fillText(fmtCurrency(yVal), pad.left - 8, y + 4);
    }

    // Bars
    for (var j = 0; j < labels.length; j++) {
      var x = pad.left + gap + j * (barW + gap);
      var barH = (values[j] / niceMax) * chartH;
      var barY = pad.top + chartH - barH;

      var grad = ctx.createLinearGradient(x, barY, x, barY + barH);
      grad.addColorStop(0, barColor);
      grad.addColorStop(1, '#15803d');
      ctx.fillStyle = grad;

      var radius = Math.min(4, barW / 2);
      ctx.beginPath();
      ctx.moveTo(x + radius, barY);
      ctx.lineTo(x + barW - radius, barY);
      ctx.quadraticCurveTo(x + barW, barY, x + barW, barY + radius);
      ctx.lineTo(x + barW, barY + barH);
      ctx.lineTo(x, barY + barH);
      ctx.lineTo(x, barY + radius);
      ctx.quadraticCurveTo(x, barY, x + radius, barY);
      ctx.fill();

      // Value label
      ctx.fillStyle = '#a1a1aa';
      ctx.font = '10px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      if (values[j] > 0) {
        ctx.fillText(fmtCurrency(values[j]), x + barW / 2, barY - 6);
      }

      // X-axis label
      ctx.fillStyle = '#d4d4d8';
      ctx.font = '11px -apple-system, sans-serif';
      ctx.fillText(labels[j], x + barW / 2, pad.top + chartH + 18);
    }
  }

  /**
   * Render a YoY comparison chart (two bar series side by side)
   * @param {string} containerId
   * @param {number} currentYear
   * @param {number} previousYear
   */
  function renderYoYChart(containerId, currentYear, previousYear) {
    var container = document.getElementById(containerId);
    if (!container) {
      console.error('[EarningsDashboard] Container not found:', containerId);
      return;
    }

    var curr = getMonthlyRevenue(currentYear);
    var prev = getMonthlyRevenue(previousYear);

    var width = container.offsetWidth || 700;
    var height = 320;
    var pad = { top: 45, right: 20, bottom: 55, left: 65 };

    var oldCanvas = container.querySelector('canvas');
    if (oldCanvas) container.removeChild(oldCanvas);

    var canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    container.appendChild(canvas);

    var ctx = canvas.getContext('2d');
    var chartW = width - pad.left - pad.right;
    var chartH = height - pad.top - pad.bottom;

    var allVals = curr.months.concat(prev.months);
    var max = Math.max.apply(null, allVals) || 1;
    var magnitude = Math.pow(10, Math.floor(Math.log10(max)));
    var niceMax = Math.ceil(max / magnitude) * magnitude || 1;

    var groupW = chartW / 12;
    var barW = Math.max((groupW - 8) / 2, 6);

    // Background
    ctx.fillStyle = '#18181b';
    ctx.fillRect(0, 0, width, height);

    // Title
    ctx.fillStyle = '#e4e4e7';
    ctx.font = 'bold 14px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Year-over-Year: ' + previousYear + ' vs ' + currentYear, width / 2, 24);

    // Legend
    ctx.font = '11px -apple-system, sans-serif';
    ctx.fillStyle = '#71717a';
    ctx.fillRect(width / 2 - 100, 32, 10, 10);
    ctx.fillStyle = '#a1a1aa';
    ctx.textAlign = 'left';
    ctx.fillText(String(previousYear), width / 2 - 86, 41);
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(width / 2 + 10, 32, 10, 10);
    ctx.fillStyle = '#a1a1aa';
    ctx.fillText(String(currentYear), width / 2 + 24, 41);

    // Y-axis grid
    ctx.font = '11px -apple-system, sans-serif';
    ctx.textAlign = 'right';
    for (var i = 0; i <= 5; i++) {
      var yVal = (niceMax / 5) * i;
      var y = pad.top + chartH - (yVal / niceMax) * chartH;
      ctx.strokeStyle = '#27272a';
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(width - pad.right, y);
      ctx.stroke();
      ctx.fillStyle = '#71717a';
      ctx.fillText(fmtCurrency(yVal), pad.left - 8, y + 4);
    }

    // Bars
    for (var j = 0; j < 12; j++) {
      var groupX = pad.left + j * groupW + 4;

      // Previous year bar
      var prevH = (prev.months[j] / niceMax) * chartH;
      var prevY = pad.top + chartH - prevH;
      ctx.fillStyle = '#71717a';
      ctx.fillRect(groupX, prevY, barW, prevH);

      // Current year bar
      var currH = (curr.months[j] / niceMax) * chartH;
      var currY = pad.top + chartH - currH;
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(groupX + barW + 2, currY, barW, currH);

      // X-axis label
      ctx.fillStyle = '#d4d4d8';
      ctx.font = '11px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(MONTH_LABELS[j], groupX + barW + 1, pad.top + chartH + 18);
    }
  }

  /**
   * Render a category breakdown horizontal bar chart
   * @param {string} containerId
   * @param {number} [year]
   */
  function renderCategoryChart(containerId, year) {
    var container = document.getElementById(containerId);
    if (!container) {
      console.error('[EarningsDashboard] Container not found:', containerId);
      return;
    }

    var cats = getCategoryBreakdown(year);
    if (cats.length === 0) {
      container.innerHTML = '<p style="color:#71717a;text-align:center">No category data</p>';
      return;
    }

    var width = container.offsetWidth || 500;
    var rowHeight = 36;
    var height = Math.max(cats.length * rowHeight + 50, 100);
    var pad = { top: 35, right: 80, left: 140 };

    var oldCanvas = container.querySelector('canvas');
    if (oldCanvas) container.removeChild(oldCanvas);

    var canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    container.appendChild(canvas);

    var ctx = canvas.getContext('2d');
    var maxVal = cats[0].total || 1;
    var barArea = width - pad.left - pad.right;

    // Background
    ctx.fillStyle = '#18181b';
    ctx.fillRect(0, 0, width, height);

    // Title
    ctx.fillStyle = '#e4e4e7';
    ctx.font = 'bold 14px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Revenue by Category' + (year ? ' (' + year + ')' : ''), width / 2, 22);

    var colors = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#64748b'];

    for (var i = 0; i < cats.length; i++) {
      var y = pad.top + i * rowHeight;
      var barW = (cats[i].total / maxVal) * barArea;

      // Category label
      ctx.fillStyle = '#d4d4d8';
      ctx.font = '12px -apple-system, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(cats[i].category, pad.left - 10, y + 20);

      // Bar
      ctx.fillStyle = colors[i % colors.length];
      ctx.fillRect(pad.left, y + 8, barW, 20);

      // Value label
      ctx.fillStyle = '#a1a1aa';
      ctx.font = '11px -apple-system, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(fmtCurrency(cats[i].total) + ' (' + cats[i].pct + '%)', pad.left + barW + 6, y + 22);
    }
  }

  /**
   * Render all dashboard charts into container elements
   * @param {object} ids - {monthly: string, yoy: string, category: string}
   * @param {number} [year] - Defaults to current year
   */
  function renderDashboard(ids, year) {
    var now = new Date();
    year = year || now.getFullYear();

    if (ids.monthly) {
      var rev = getMonthlyRevenue(year);
      renderBarChart(ids.monthly, {
        labels: rev.labels,
        values: rev.months,
        title: 'Monthly Revenue — ' + year,
        color: '#22c55e'
      });
    }

    if (ids.yoy) {
      renderYoYChart(ids.yoy, year, year - 1);
    }

    if (ids.category) {
      renderCategoryChart(ids.category, year);
    }
  }

  /**
   * Get complete dashboard data
   * @param {number} [year]
   * @returns {object}
   */
  function getDashboardData(year) {
    var now = new Date();
    year = year || now.getFullYear();

    return {
      summary: getSummary(),
      monthlyRevenue: getMonthlyRevenue(year),
      yoyGrowth: getYoYGrowth(year, year - 1),
      categoryBreakdown: getCategoryBreakdown(year),
      availableYears: getAvailableYears()
    };
  }

  /**
   * Initialize the dashboard module
   * @param {object} [ids] - Optional container element IDs for auto-rendering
   * @param {number} [year] - Optional year to display
   * @returns {object} Dashboard data
   */
  function init(ids, year) {
    var data = getDashboardData(year);
    if (ids) {
      renderDashboard(ids, year);
    }
    return data;
  }

  /* ── Render / Destroy ── */

  var _container = null;
  var CSS_INJECTED = false;

  function escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function _injectCSS() {
    if (CSS_INJECTED) return;
    CSS_INJECTED = true;
    var style = document.createElement('style');
    style.id = 'cf-ed-styles';
    style.textContent = [
      '.ed-panel{background:#0a0a0a;border:1px solid #1e1e1e;border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#e0e0e0;overflow:hidden}',
      '.ed-header{padding:16px 20px;border-bottom:1px solid #1e1e1e;display:flex;align-items:center;justify-content:space-between}',
      '.ed-title{font-size:16px;font-weight:700}',
      '.ed-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;padding:16px 20px}',
      '.ed-card{background:#111;border:1px solid #1e1e1e;border-radius:10px;padding:14px 16px}',
      '.ed-card-label{font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px}',
      '.ed-card-value{font-size:20px;font-weight:700}',
      '.ed-card-sub{font-size:11px;color:#666;margin-top:4px}',
      '.ed-section{padding:16px 20px;border-top:1px solid #1e1e1e}',
      '.ed-section-title{font-size:13px;font-weight:600;color:#ccc;margin-bottom:12px}',
      '.ed-year-select{background:#111;border:1px solid #222;border-radius:6px;color:#e0e0e0;font-size:12px;padding:4px 8px;cursor:pointer;outline:none}',
      '.ed-empty{padding:40px 20px;text-align:center;color:#555;font-size:13px}'
    ].join('\n');
    document.head.appendChild(style);
  }

  /**
   * Render the full earnings dashboard into a container.
   * @param {HTMLElement|string} container
   */
  function render(container) {
    _injectCSS();
    var el = typeof container === 'string' ? document.querySelector(container) : container;
    if (!el) return;
    _container = el;

    var now = new Date();
    var year = now.getFullYear();
    var summary = getSummary();
    var years = getAvailableYears();

    var h = '<div class="ed-panel">';
    h += '<div class="ed-header"><span class="ed-title">Earnings Dashboard</span>';
    if (years.length > 0) {
      h += '<select class="ed-year-select" id="ed-year-select">';
      for (var y = years.length - 1; y >= 0; y--) {
        h += '<option value="' + years[y] + '"' + (years[y] === year ? ' selected' : '') + '>' + years[y] + '</option>';
      }
      h += '</select>';
    }
    h += '</div>';

    // Summary cards
    h += '<div class="ed-cards">';
    h += '<div class="ed-card"><div class="ed-card-label">This Month</div><div class="ed-card-value" style="color:#7c3aed">' + fmtCurrency(summary.thisMonthRevenue) + '</div>';
    h += '<div class="ed-card-sub">' + fmtPct(summary.monthOverMonthGrowth) + ' vs last month</div></div>';
    h += '<div class="ed-card"><div class="ed-card-label">Year to Date</div><div class="ed-card-value">' + fmtCurrency(summary.yearToDate) + '</div>';
    h += '<div class="ed-card-sub">' + summary.totalProjects + ' projects</div></div>';
    h += '<div class="ed-card"><div class="ed-card-label">Avg Project</div><div class="ed-card-value">' + fmtCurrency(summary.avgProjectValue) + '</div>';
    h += '<div class="ed-card-sub">' + fmtCurrency(summary.revenuePerHour) + '/hr</div></div>';
    h += '<div class="ed-card"><div class="ed-card-label">All Time</div><div class="ed-card-value" style="color:#22c55e">' + fmtCurrency(summary.totalAllTime) + '</div>';
    h += '<div class="ed-card-sub">' + Math.round(summary.totalHours) + ' hours</div></div>';
    h += '</div>';

    // Chart containers
    h += '<div class="ed-section"><div class="ed-section-title">Monthly Revenue</div><div id="ed-monthly-chart"></div></div>';
    h += '<div class="ed-section"><div class="ed-section-title">Year-over-Year Comparison</div><div id="ed-yoy-chart"></div></div>';
    h += '<div class="ed-section"><div class="ed-section-title">Revenue by Category</div><div id="ed-category-chart"></div></div>';
    h += '</div>';

    el.innerHTML = h;

    // Render charts
    var displayYear = years.indexOf(year) >= 0 ? year : (years.length > 0 ? years[years.length - 1] : year);
    renderDashboard({ monthly: 'ed-monthly-chart', yoy: 'ed-yoy-chart', category: 'ed-category-chart' }, displayYear);

    // Year selector
    var yearSelect = el.querySelector('#ed-year-select');
    if (yearSelect) {
      yearSelect.addEventListener('change', function () {
        var selectedYear = parseInt(yearSelect.value, 10);
        renderDashboard({ monthly: 'ed-monthly-chart', yoy: 'ed-yoy-chart', category: 'ed-category-chart' }, selectedYear);
      });
    }
  }

  /** Tear down and clean up. */
  function destroy() {
    if (_container) { _container.innerHTML = ''; _container = null; }
    CSS_INJECTED = false;
    var styleEl = document.getElementById('cf-ed-styles');
    if (styleEl && styleEl.parentNode) styleEl.parentNode.removeChild(styleEl);
  }

  /* ── Public API ── */
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.EarningsDashboard = {
    init: init,
    render: render,
    destroy: destroy,
    getMonthlyRevenue: getMonthlyRevenue,
    getYoYGrowth: getYoYGrowth,
    getCategoryBreakdown: getCategoryBreakdown,
    getSummary: getSummary,
    getAvailableYears: getAvailableYears,
    getDashboardData: getDashboardData,
    renderBarChart: renderBarChart,
    renderYoYChart: renderYoYChart,
    renderCategoryChart: renderCategoryChart,
    renderDashboard: renderDashboard
  };
})();
