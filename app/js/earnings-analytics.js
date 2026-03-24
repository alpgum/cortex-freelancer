/**
 * [CF-046] Cortex Freelancer — Earnings Analytics with Charts
 * Data layer for monthly revenue tracking, YoY growth, category breakdown,
 * top clients, avg project value, revenue per hour.
 * Includes canvas-based bar chart renderer.
 * Exposed on window.CortexFreelancer.earningsAnalytics
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_earnings';

  /* ───────── localStorage helpers ───────── */

  function loadEarnings() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveEarnings(earnings) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(earnings));
  }

  /* ───────── formatting ───────── */

  function fmt(n, decimals) {
    if (n == null || isNaN(n)) return '—';
    decimals = decimals != null ? decimals : 0;
    if (n >= 1000000) return '$' + (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return '$' + (n / 1000).toFixed(1) + 'K';
    return '$' + Number(n).toFixed(decimals);
  }

  /* ───────── data layer ───────── */

  /**
   * Add an earning record.
   * @param {Object} data - {date, amount, client, category, hours, description}
   * @returns {Object} The saved earning with generated id
   */
  function addEarning(data) {
    if (!data || !data.amount) throw new Error('amount is required');
    var earnings = loadEarnings();
    var entry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      date: data.date || new Date().toISOString().slice(0, 10),
      amount: Number(data.amount),
      client: data.client || 'Unknown',
      category: data.category || 'Other',
      hours: data.hours ? Number(data.hours) : 0,
      description: data.description || '',
      createdAt: new Date().toISOString()
    };
    earnings.push(entry);
    saveEarnings(earnings);
    return entry;
  }

  /**
   * Get monthly revenue for a given year.
   * @param {number} year
   * @returns {Object} {jan:0, feb:0, ..., dec:0, total:0}
   */
  function getMonthlyRevenue(year) {
    var months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    var result = {};
    months.forEach(function (m) { result[m] = 0; });
    result.total = 0;

    var earnings = loadEarnings();
    earnings.forEach(function (e) {
      var d = new Date(e.date);
      if (d.getFullYear() === year) {
        result[months[d.getMonth()]] += e.amount;
        result.total += e.amount;
      }
    });
    return result;
  }

  /**
   * Calculate year-over-year growth.
   * @returns {Object} {currentYear, previousYear, currentTotal, previousTotal, growthPct, growthAbs}
   */
  function getYoYGrowth() {
    var now = new Date();
    var currentYear = now.getFullYear();
    var previousYear = currentYear - 1;
    var current = getMonthlyRevenue(currentYear);
    var previous = getMonthlyRevenue(previousYear);
    var growthAbs = current.total - previous.total;
    var growthPct = previous.total > 0 ? (growthAbs / previous.total) * 100 : (current.total > 0 ? 100 : 0);

    return {
      currentYear: currentYear,
      previousYear: previousYear,
      currentTotal: current.total,
      previousTotal: previous.total,
      growthPct: Math.round(growthPct * 100) / 100,
      growthAbs: growthAbs
    };
  }

  /**
   * Get earnings breakdown by category.
   * @returns {Object} {categoryName: {total, count, avgPerProject}}
   */
  function getCategoryBreakdown() {
    var earnings = loadEarnings();
    var cats = {};
    earnings.forEach(function (e) {
      var cat = e.category || 'Other';
      if (!cats[cat]) cats[cat] = { total: 0, count: 0 };
      cats[cat].total += e.amount;
      cats[cat].count += 1;
    });
    Object.keys(cats).forEach(function (k) {
      cats[k].avgPerProject = cats[k].count > 0 ? cats[k].total / cats[k].count : 0;
    });
    return cats;
  }

  /**
   * Get top clients by revenue.
   * @param {number} [limit=5]
   * @returns {Array} [{client, total, count, avgProject}]
   */
  function getTopClients(limit) {
    limit = limit || 5;
    var earnings = loadEarnings();
    var clients = {};
    earnings.forEach(function (e) {
      var name = e.client || 'Unknown';
      if (!clients[name]) clients[name] = { client: name, total: 0, count: 0, hours: 0 };
      clients[name].total += e.amount;
      clients[name].count += 1;
      clients[name].hours += e.hours || 0;
    });
    return Object.keys(clients)
      .map(function (k) {
        var c = clients[k];
        c.avgProject = c.count > 0 ? c.total / c.count : 0;
        c.revenuePerHour = c.hours > 0 ? c.total / c.hours : null;
        return c;
      })
      .sort(function (a, b) { return b.total - a.total; })
      .slice(0, limit);
  }

  /**
   * Get average project value and revenue per hour across all earnings.
   * @returns {Object} {avgProjectValue, revenuePerHour, totalRevenue, totalHours, totalProjects}
   */
  function getSummary() {
    var earnings = loadEarnings();
    var totalRevenue = 0;
    var totalHours = 0;
    earnings.forEach(function (e) {
      totalRevenue += e.amount;
      totalHours += e.hours || 0;
    });
    return {
      avgProjectValue: earnings.length > 0 ? totalRevenue / earnings.length : 0,
      revenuePerHour: totalHours > 0 ? totalRevenue / totalHours : null,
      totalRevenue: totalRevenue,
      totalHours: totalHours,
      totalProjects: earnings.length
    };
  }

  /* ───────── canvas bar chart ───────── */

  /**
   * Render a bar chart on a canvas element.
   * @param {string} containerId - DOM element id to render into
   * @param {Object} data - {labels: string[], values: number[], title?: string, color?: string}
   */
  function renderEarningsChart(containerId, data) {
    var container = document.getElementById(containerId);
    if (!container) {
      console.error('[EarningsAnalytics] Container not found: ' + containerId);
      return;
    }
    if (!data || !data.labels || !data.values || !data.labels.length) {
      container.innerHTML = '<p style="color:#71717a;text-align:center">No data to chart</p>';
      return;
    }

    var labels = data.labels;
    var values = data.values;
    var title = data.title || '';
    var barColor = data.color || '#6366f1';

    var width = container.offsetWidth || 600;
    var height = 300;
    var padding = { top: 40, right: 20, bottom: 50, left: 60 };

    // remove old canvas if present
    var oldCanvas = container.querySelector('canvas');
    if (oldCanvas) container.removeChild(oldCanvas);

    var canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    container.appendChild(canvas);

    var ctx = canvas.getContext('2d');
    var chartW = width - padding.left - padding.right;
    var chartH = height - padding.top - padding.bottom;
    var max = Math.max.apply(null, values) || 1;
    // round up max to nice number
    var magnitude = Math.pow(10, Math.floor(Math.log10(max)));
    var niceMax = Math.ceil(max / magnitude) * magnitude || 1;
    var barW = Math.max(chartW / labels.length - 8, 10);
    var gap = (chartW - barW * labels.length) / (labels.length + 1);

    // background
    ctx.fillStyle = '#18181b';
    ctx.fillRect(0, 0, width, height);

    // title
    if (title) {
      ctx.fillStyle = '#e4e4e7';
      ctx.font = 'bold 14px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(title, width / 2, 24);
    }

    // y-axis grid lines & labels
    ctx.font = '11px -apple-system, sans-serif';
    ctx.textAlign = 'right';
    var gridLines = 5;
    for (var i = 0; i <= gridLines; i++) {
      var yVal = (niceMax / gridLines) * i;
      var y = padding.top + chartH - (yVal / niceMax) * chartH;
      ctx.strokeStyle = '#27272a';
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
      ctx.fillStyle = '#71717a';
      ctx.fillText(fmt(yVal), padding.left - 8, y + 4);
    }

    // bars
    for (var j = 0; j < labels.length; j++) {
      var x = padding.left + gap + j * (barW + gap);
      var barH = (values[j] / niceMax) * chartH;
      var barY = padding.top + chartH - barH;

      // gradient bar
      var grad = ctx.createLinearGradient(x, barY, x, barY + barH);
      grad.addColorStop(0, barColor);
      grad.addColorStop(1, '#4f46e5');
      ctx.fillStyle = grad;

      // rounded top
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

      // value on top
      ctx.fillStyle = '#a1a1aa';
      ctx.font = '10px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      if (values[j] > 0) {
        ctx.fillText(fmt(values[j]), x + barW / 2, barY - 6);
      }

      // x-axis label
      ctx.fillStyle = '#d4d4d8';
      ctx.font = '11px -apple-system, sans-serif';
      ctx.fillText(labels[j], x + barW / 2, padding.top + chartH + 18);
    }
  }

  /* ───────── YoY comparison chart ───────── */

  /**
   * Render a YoY comparison bar chart (current vs previous year, side by side).
   * @param {string} containerId - DOM element id
   */
  function renderYoYChart(containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;

    var now = new Date();
    var currentYear = now.getFullYear();
    var current = getMonthlyRevenue(currentYear);
    var previous = getMonthlyRevenue(currentYear - 1);
    var months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    var labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    var width = container.offsetWidth || 600;
    var height = 300;
    var padding = { top: 40, right: 20, bottom: 50, left: 60 };

    var oldCanvas = container.querySelector('canvas');
    if (oldCanvas) container.removeChild(oldCanvas);

    var canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    container.appendChild(canvas);

    var ctx = canvas.getContext('2d');
    var chartW = width - padding.left - padding.right;
    var chartH = height - padding.top - padding.bottom;

    var max = 0;
    for (var i = 0; i < months.length; i++) {
      max = Math.max(max, current[months[i]], previous[months[i]]);
    }
    var magnitude = Math.pow(10, Math.floor(Math.log10(max || 1)));
    var niceMax = Math.ceil((max || 1) / magnitude) * magnitude || 1;

    var groupW = chartW / 12;
    var barW = Math.max((groupW - 10) / 2, 6);
    var gap = (groupW - barW * 2) / 2;

    // background
    ctx.fillStyle = '#18181b';
    ctx.fillRect(0, 0, width, height);

    // title
    ctx.fillStyle = '#e4e4e7';
    ctx.font = 'bold 14px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Year-over-Year Comparison', width / 2, 24);

    // y-axis grid
    ctx.font = '11px -apple-system, sans-serif';
    ctx.textAlign = 'right';
    for (var g = 0; g <= 5; g++) {
      var yVal = (niceMax / 5) * g;
      var y = padding.top + chartH - (yVal / niceMax) * chartH;
      ctx.strokeStyle = '#27272a';
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
      ctx.fillStyle = '#71717a';
      ctx.fillText(fmt(yVal), padding.left - 8, y + 4);
    }

    // bars
    for (var j = 0; j < 12; j++) {
      var x0 = padding.left + j * groupW + gap;

      // previous year bar
      var prevH = (previous[months[j]] / niceMax) * chartH;
      ctx.fillStyle = '#3f3f46';
      ctx.fillRect(x0, padding.top + chartH - prevH, barW, prevH);

      // current year bar
      var curH = (current[months[j]] / niceMax) * chartH;
      var grad = ctx.createLinearGradient(0, padding.top + chartH - curH, 0, padding.top + chartH);
      grad.addColorStop(0, '#6366f1');
      grad.addColorStop(1, '#4f46e5');
      ctx.fillStyle = grad;
      ctx.fillRect(x0 + barW + 2, padding.top + chartH - curH, barW, curH);

      // x-axis label
      ctx.fillStyle = '#d4d4d8';
      ctx.font = '10px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(labels[j], x0 + barW + 1, padding.top + chartH + 16);
    }

    // legend
    ctx.font = '11px -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#3f3f46';
    ctx.fillRect(width - 180, 10, 12, 12);
    ctx.fillStyle = '#a1a1aa';
    ctx.fillText(String(currentYear - 1), width - 164, 20);
    ctx.fillStyle = '#6366f1';
    ctx.fillRect(width - 100, 10, 12, 12);
    ctx.fillStyle = '#a1a1aa';
    ctx.fillText(String(currentYear), width - 84, 20);
  }

  /* ───────── category breakdown chart ───────── */

  /**
   * Render horizontal bar chart for category breakdown.
   * @param {string} containerId - DOM element id
   */
  function renderCategoryChart(containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;

    var cats = getCategoryBreakdown();
    var entries = Object.keys(cats).map(function (k) {
      return { name: k, total: cats[k].total, count: cats[k].count };
    }).sort(function (a, b) { return b.total - a.total; });

    if (entries.length === 0) {
      container.innerHTML = '<p style="color:#71717a;text-align:center">No category data</p>';
      return;
    }

    var colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#06b6d4', '#ec4899'];
    var max = entries[0].total || 1;
    var total = 0;
    for (var i = 0; i < entries.length; i++) total += entries[i].total;

    var html = '<div style="font-family:-apple-system,sans-serif;background:#18181b;border-radius:12px;padding:20px">';
    html += '<div style="font-weight:700;font-size:14px;color:#e4e4e7;margin-bottom:16px">Revenue by Category</div>';

    for (var j = 0; j < entries.length; j++) {
      var e = entries[j];
      var pct = total > 0 ? ((e.total / total) * 100).toFixed(1) : '0';
      var barPct = ((e.total / max) * 100).toFixed(1);
      var color = colors[j % colors.length];

      html += '<div style="margin-bottom:12px">';
      html += '<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">';
      html += '<span style="color:#d4d4d8">' + e.name + ' <span style="color:#71717a">(' + e.count + ' projects)</span></span>';
      html += '<span style="color:#a1a1aa;font-weight:600">' + fmt(e.total) + ' · ' + pct + '%</span>';
      html += '</div>';
      html += '<div style="background:#27272a;border-radius:4px;height:8px;overflow:hidden">';
      html += '<div style="background:' + color + ';height:100%;width:' + barPct + '%;border-radius:4px;transition:width 0.3s ease"></div>';
      html += '</div></div>';
    }

    html += '</div>';
    container.innerHTML = html;
  }

  /* ───────── dashboard renderer ───────── */

  /**
   * Render the complete earnings dashboard with summary cards, charts.
   * @param {string} containerId - DOM element id to render the dashboard into
   * @param {object} [options] - {year?: number}
   */
  function renderDashboard(containerId, options) {
    var container = document.getElementById(containerId);
    if (!container) {
      console.error('[EarningsAnalytics] Container not found: ' + containerId);
      return;
    }

    var opts = options || {};
    var year = opts.year || new Date().getFullYear();
    var summary = getSummary();
    var yoy = getYoYGrowth();
    var monthly = getMonthlyRevenue(year);
    var months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

    var growthColor = yoy.growthPct >= 0 ? '#22c55e' : '#ef4444';
    var growthArrow = yoy.growthPct >= 0 ? '&#9650;' : '&#9660;';

    var html = '<div style="font-family:-apple-system,sans-serif;color:#e4e4e7">';

    // Header
    html += '<div style="margin-bottom:24px">';
    html += '<h2 style="margin:0;font-size:22px;font-weight:700;color:#f4f4f5">Earnings Dashboard</h2>';
    html += '<p style="margin:4px 0 0;font-size:13px;color:#71717a">' + year + ' Overview</p>';
    html += '</div>';

    // Summary cards
    html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px">';

    var cards = [
      { label: 'Total Revenue', value: fmt(summary.totalRevenue), sub: summary.totalProjects + ' projects' },
      { label: 'Avg Project', value: fmt(summary.avgProjectValue), sub: summary.revenuePerHour != null ? fmt(summary.revenuePerHour, 2) + '/hr' : '—' },
      { label: 'YoY Growth', value: (yoy.growthPct >= 0 ? '+' : '') + yoy.growthPct + '%', sub: growthArrow + ' ' + fmt(Math.abs(yoy.growthAbs)), color: growthColor },
      { label: 'This Year', value: fmt(monthly.total), sub: fmt(monthly.total / 12) + '/mo avg' }
    ];

    for (var c = 0; c < cards.length; c++) {
      var card = cards[c];
      html += '<div style="background:#18181b;border-radius:12px;padding:16px">';
      html += '<div style="font-size:12px;color:#71717a;margin-bottom:4px">' + card.label + '</div>';
      html += '<div style="font-size:22px;font-weight:700;color:' + (card.color || '#f4f4f5') + '">' + card.value + '</div>';
      html += '<div style="font-size:11px;color:#52525b;margin-top:2px">' + card.sub + '</div>';
      html += '</div>';
    }
    html += '</div>';

    // Chart containers
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">';
    html += '<div id="' + containerId + '_monthly"></div>';
    html += '<div id="' + containerId + '_yoy"></div>';
    html += '</div>';
    html += '<div id="' + containerId + '_cats"></div>';

    html += '</div>';
    container.innerHTML = html;

    // Render charts into sub-containers
    var labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var values = months.map(function (m) { return monthly[m]; });

    renderEarningsChart(containerId + '_monthly', {
      labels: labels, values: values,
      title: 'Monthly Revenue ' + year, color: '#6366f1'
    });
    renderYoYChart(containerId + '_yoy');
    renderCategoryChart(containerId + '_cats');
  }

  /* ───────── legacy UI rendering (preserved from UW-003) ───────── */

  function monthsSince(dateStr) {
    if (!dateStr) return null;
    var d = new Date(dateStr);
    if (isNaN(d)) return null;
    var now = new Date();
    var months = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
    return Math.max(months, 1);
  }

  function categorize(title) {
    if (!title) return 'Other';
    var t = title.toLowerCase();
    var cats = [
      [/\b(react|angular|vue|next|nuxt|frontend|front.end|html|css|tailwind|ui\/ux|figma)\b/, 'Frontend / UI'],
      [/\b(node|express|django|flask|laravel|rails|backend|back.end|api|rest|graphql|server)\b/, 'Backend / API'],
      [/\b(full.?stack|mern|mean|lamp)\b/, 'Full-Stack'],
      [/\b(mobile|ios|android|react.native|flutter|swift|kotlin)\b/, 'Mobile'],
      [/\b(data|machine.learning|ml|ai|nlp|deep.learning|tensor|python|analytics|scraping)\b/, 'Data / AI'],
      [/\b(devops|aws|gcp|azure|cloud|docker|k8s|kubernetes|ci.?cd|infra)\b/, 'DevOps / Cloud'],
      [/\b(design|graphic|logo|brand|illustration|photoshop|illustrator)\b/, 'Design'],
      [/\b(wordpress|shopify|wix|cms|seo|content|writing|copy)\b/, 'Content / CMS'],
      [/\b(blockchain|web3|solidity|smart.contract|crypto|nft)\b/, 'Blockchain'],
    ];
    for (var i = 0; i < cats.length; i++) {
      if (cats[i][0].test(t)) return cats[i][1];
    }
    return 'Other';
  }

  function computeProfile(data) {
    var totalEarnings = Number(data.totalEarnings) || 0;
    var totalJobs = Number(data.totalJobs) || 0;
    var totalHours = Number(data.totalHours) || 0;
    var hourlyRate = Number(data.hourlyRate) || 0;
    var history = Array.isArray(data.workHistory) ? data.workHistory : [];

    var avgProject = totalJobs > 0 ? totalEarnings / totalJobs : null;
    var effectiveRate = totalHours > 0 ? totalEarnings / totalHours : null;
    var months = monthsSince(data.memberSince);
    var estMonthly = months ? totalEarnings / months : null;
    var estYearly = estMonthly != null ? estMonthly * 12 : null;

    var hourlyCount = 0;
    var fixedCount = 0;
    history.forEach(function (j) {
      if (j.type === 'hourly' || j.type === 'Hourly') hourlyCount++;
      else fixedCount++;
    });

    var catMap = {};
    history.forEach(function (j) {
      var cat = categorize(j.title || j.name || '');
      var earned = Number(j.earnings || j.amount || j.totalEarned || 0);
      catMap[cat] = (catMap[cat] || 0) + earned;
    });

    var topCat = null;
    var topVal = 0;
    Object.keys(catMap).forEach(function (k) {
      if (catMap[k] > topVal) { topVal = catMap[k]; topCat = k; }
    });

    var suggestedRate = effectiveRate != null ? Math.ceil(effectiveRate * 1.2) : null;
    var projectedYearly = suggestedRate && totalHours && months
      ? (totalHours / months) * 12 * suggestedRate
      : null;

    return {
      totalEarnings: totalEarnings, totalJobs: totalJobs, totalHours: totalHours,
      hourlyRate: hourlyRate, avgProject: avgProject, effectiveRate: effectiveRate,
      estMonthly: estMonthly, estYearly: estYearly, hourlyCount: hourlyCount,
      fixedCount: fixedCount, categories: catMap, topCategory: topCat,
      suggestedRate: suggestedRate, projectedYearly: projectedYearly,
      hasData: totalEarnings > 0 || totalJobs > 0, hasHistory: history.length > 0
    };
  }

  /* ───────── public API ───────── */

  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.earningsAnalytics = {
    addEarning: addEarning,
    getMonthlyRevenue: getMonthlyRevenue,
    getYoYGrowth: getYoYGrowth,
    getCategoryBreakdown: getCategoryBreakdown,
    getTopClients: getTopClients,
    getSummary: getSummary,
    renderEarningsChart: renderEarningsChart,
    renderYoYChart: renderYoYChart,
    renderCategoryChart: renderCategoryChart,
    renderDashboard: renderDashboard
  };

  // backward compat
  window.CortexEarningsAnalytics = {
    render: function () { console.warn('[CortexEarningsAnalytics] Legacy render — use CortexFreelancer.earningsAnalytics'); },
    compute: computeProfile
  };

})();
