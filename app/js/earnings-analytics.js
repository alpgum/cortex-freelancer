/**
 * [CF-046] Cortex Freelancer — Earnings Analytics with Charts
 * Data layer for earnings tracking + canvas-based bar chart.
 * Exposed on window.CortexFreelancer.EarningsAnalytics
 * Also preserves legacy window.CortexEarningsAnalytics for backward compat.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_earnings';

  /* ───────── localStorage helpers ───────── */

  /**
   * Load earnings array from localStorage
   * @returns {Array<Object>}
   */
  function loadEarnings() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  /**
   * Save earnings array to localStorage
   * @param {Array<Object>} earnings
   */
  function saveEarnings(earnings) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(earnings));
  }

  /* ───────── format helpers ───────── */

  function fmt(n, decimals) {
    if (n == null || isNaN(n)) return '—';
    decimals = decimals != null ? decimals : 0;
    if (n >= 1000000) return '$' + (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return '$' + (n / 1000).toFixed(1) + 'K';
    return '$' + Number(n).toFixed(decimals);
  }

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

  /* ───────── data layer (CF-046) ───────── */

  /**
   * Add an earning record
   * @param {Object} data - {date, amount, client, category, hours, description, type}
   * @returns {Object} the saved earning with generated id
   */
  function addEarning(data) {
    var earnings = loadEarnings();
    var record = {
      id: 'earn_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      date: data.date || new Date().toISOString().split('T')[0],
      amount: Number(data.amount) || 0,
      client: data.client || '',
      category: data.category || 'Other',
      hours: Number(data.hours) || 0,
      description: data.description || '',
      type: data.type || 'fixed',
      createdAt: new Date().toISOString(),
    };
    earnings.push(record);
    saveEarnings(earnings);
    return record;
  }

  /**
   * Get monthly revenue for a given year
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
        var key = months[d.getMonth()];
        result[key] += e.amount;
        result.total += e.amount;
      }
    });
    return result;
  }

  /**
   * Calculate year-over-year growth
   * @returns {Object} {currentYear, previousYear, currentTotal, previousTotal, growthPct}
   */
  function getYoYGrowth() {
    var now = new Date();
    var currentYear = now.getFullYear();
    var prev = getMonthlyRevenue(currentYear - 1);
    var curr = getMonthlyRevenue(currentYear);
    var growthPct = prev.total > 0 ? ((curr.total - prev.total) / prev.total) * 100 : null;
    return {
      currentYear: currentYear,
      previousYear: currentYear - 1,
      currentTotal: curr.total,
      previousTotal: prev.total,
      growthPct: growthPct,
    };
  }

  /**
   * Get earnings breakdown by category
   * @returns {Object} {category: totalAmount, ...}
   */
  function getCategoryBreakdown() {
    var earnings = loadEarnings();
    var breakdown = {};
    earnings.forEach(function (e) {
      var cat = e.category || 'Other';
      breakdown[cat] = (breakdown[cat] || 0) + e.amount;
    });
    return breakdown;
  }

  /**
   * Get top clients by total revenue
   * @param {number} [limit=5]
   * @returns {Array<{client, total, count}>}
   */
  function getTopClients(limit) {
    limit = limit || 5;
    var earnings = loadEarnings();
    var map = {};
    earnings.forEach(function (e) {
      if (!e.client) return;
      if (!map[e.client]) map[e.client] = { client: e.client, total: 0, count: 0 };
      map[e.client].total += e.amount;
      map[e.client].count++;
    });
    return Object.keys(map)
      .map(function (k) { return map[k]; })
      .sort(function (a, b) { return b.total - a.total; })
      .slice(0, limit);
  }

  /* ───────── canvas bar chart ───────── */

  /**
   * Render a canvas-based bar chart
   * @param {string} containerId - DOM element id
   * @param {Object} data - {labels: string[], values: number[], title?: string, color?: string}
   */
  function renderEarningsChart(containerId, data) {
    var container = document.getElementById(containerId);
    if (!container) return;

    var labels = data.labels || [];
    var values = data.values || [];
    if (!labels.length) return;

    var dpr = window.devicePixelRatio || 1;
    var width = container.offsetWidth || 600;
    var height = 300;
    var padding = { top: 40, right: 20, bottom: 50, left: 60 };

    var canvas = document.createElement('canvas');
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    container.innerHTML = '';
    container.appendChild(canvas);

    var ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    var chartW = width - padding.left - padding.right;
    var chartH = height - padding.top - padding.bottom;
    var maxVal = Math.max.apply(null, values) || 1;
    var barWidth = Math.max((chartW / labels.length) * 0.6, 4);
    var gap = (chartW / labels.length) - barWidth;
    var barColor = data.color || '#6366f1';

    // background
    ctx.fillStyle = '#18181b';
    ctx.fillRect(0, 0, width, height);

    // title
    if (data.title) {
      ctx.fillStyle = '#e4e4e7';
      ctx.font = 'bold 14px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(data.title, width / 2, 24);
    }

    // y-axis grid lines
    ctx.strokeStyle = '#3f3f46';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#a1a1aa';
    ctx.font = '11px -apple-system, sans-serif';
    ctx.textAlign = 'right';
    var gridLines = 5;
    for (var g = 0; g <= gridLines; g++) {
      var yVal = (maxVal / gridLines) * g;
      var yPos = padding.top + chartH - (chartH * (g / gridLines));
      ctx.beginPath();
      ctx.moveTo(padding.left, yPos);
      ctx.lineTo(width - padding.right, yPos);
      ctx.stroke();
      var label = yVal >= 1000 ? '$' + (yVal / 1000).toFixed(0) + 'K' : '$' + yVal.toFixed(0);
      ctx.fillText(label, padding.left - 6, yPos + 4);
    }

    // bars
    ctx.textAlign = 'center';
    for (var i = 0; i < labels.length; i++) {
      var x = padding.left + i * (barWidth + gap) + gap / 2;
      var barH = (values[i] / maxVal) * chartH;
      var y = padding.top + chartH - barH;

      // gradient bar
      var grad = ctx.createLinearGradient(x, y, x, y + barH);
      grad.addColorStop(0, '#818cf8');
      grad.addColorStop(1, barColor);
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, barWidth, barH);

      // value on top
      if (values[i] > 0) {
        ctx.fillStyle = '#d4d4d8';
        ctx.font = '10px -apple-system, sans-serif';
        ctx.fillText(fmt(values[i]), x + barWidth / 2, y - 4);
      }

      // x-axis label
      ctx.fillStyle = '#a1a1aa';
      ctx.font = '11px -apple-system, sans-serif';
      ctx.fillText(labels[i], x + barWidth / 2, padding.top + chartH + 18);
    }
  }

  /* ───────── profile-based compute (legacy) ───────── */

  function compute(data) {
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
      totalEarnings: totalEarnings,
      totalJobs: totalJobs,
      totalHours: totalHours,
      hourlyRate: hourlyRate,
      avgProject: avgProject,
      effectiveRate: effectiveRate,
      estMonthly: estMonthly,
      estYearly: estYearly,
      hourlyCount: hourlyCount,
      fixedCount: fixedCount,
      categories: catMap,
      topCategory: topCat,
      suggestedRate: suggestedRate,
      projectedYearly: projectedYearly,
      hasData: totalEarnings > 0 || totalJobs > 0,
      hasHistory: history.length > 0,
    };
  }

  /* ───────── styles ───────── */

  var CSS = [
    '.cea-root{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#e4e4e7;background:#18181b;border-radius:12px;padding:24px;max-width:720px}',
    '.cea-header{font-size:20px;font-weight:700;margin-bottom:20px}',
    '.cea-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:20px}',
    '.cea-card{background:#27272a;border-radius:10px;padding:16px;display:flex;flex-direction:column;gap:4px}',
    '.cea-card-label{font-size:12px;color:#a1a1aa;text-transform:uppercase;letter-spacing:.5px}',
    '.cea-card-value{font-size:22px;font-weight:700;color:#f4f4f5}',
    '.cea-card-sub{font-size:12px;color:#71717a}',
    '.cea-section{margin-bottom:20px}',
    '.cea-section-title{font-size:14px;font-weight:600;color:#a1a1aa;margin-bottom:10px}',
    '.cea-bar-row{display:flex;align-items:center;gap:8px;margin-bottom:6px}',
    '.cea-bar-label{width:110px;font-size:12px;color:#d4d4d8;text-align:right;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.cea-bar-track{flex:1;height:20px;background:#3f3f46;border-radius:4px;overflow:hidden}',
    '.cea-bar-fill{height:100%;border-radius:4px;background:linear-gradient(90deg,#6366f1,#818cf8);transition:width .4s ease}',
    '.cea-bar-val{width:60px;font-size:12px;color:#a1a1aa}',
    '.cea-insight{background:#27272a;border-left:3px solid #6366f1;border-radius:8px;padding:14px 16px;margin-bottom:10px;font-size:13px;line-height:1.5;color:#d4d4d8}',
    '.cea-insight strong{color:#f4f4f5}',
    '.cea-empty{text-align:center;padding:32px 16px;color:#71717a;font-size:14px}',
    '.cea-highlight{color:#818cf8;font-weight:600}',
    '.cea-compare-up{color:#34d399}',
    '.cea-compare-down{color:#f87171}',
  ].join('\n');

  function injectStyles() {
    if (document.getElementById('cea-styles')) return;
    var s = document.createElement('style');
    s.id = 'cea-styles';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  /* ───────── DOM rendering (legacy) ───────── */

  function h(tag, cls, html) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    if (html != null) el.innerHTML = html;
    return el;
  }

  function statCard(label, value, sub) {
    var card = h('div', 'cea-card');
    card.appendChild(h('span', 'cea-card-label', label));
    card.appendChild(h('span', 'cea-card-value', value));
    if (sub) card.appendChild(h('span', 'cea-card-sub', sub));
    return card;
  }

  function renderBarChartDOM(categories) {
    var keys = Object.keys(categories).sort(function (a, b) { return categories[b] - categories[a]; });
    if (!keys.length) return null;
    var max = categories[keys[0]] || 1;

    var section = h('div', 'cea-section');
    section.appendChild(h('div', 'cea-section-title', 'Earnings by Category'));

    keys.forEach(function (k) {
      var pct = Math.max((categories[k] / max) * 100, 2);
      var row = h('div', 'cea-bar-row');
      row.appendChild(h('span', 'cea-bar-label', k));
      var track = h('div', 'cea-bar-track');
      var fill = h('div', 'cea-bar-fill');
      fill.style.width = pct + '%';
      track.appendChild(fill);
      row.appendChild(track);
      row.appendChild(h('span', 'cea-bar-val', fmt(categories[k])));
      section.appendChild(row);
    });

    return section;
  }

  function renderEarningsAnalytics(profileData, container) {
    injectStyles();

    if (typeof container === 'string') {
      container = document.querySelector(container);
    }
    if (!container) {
      console.error('[CortexEarningsAnalytics] Container not found');
      return;
    }

    var root = h('div', 'cea-root');
    root.appendChild(h('div', 'cea-header', 'Earnings Insights'));

    var c = compute(profileData || {});

    if (!c.hasData) {
      root.appendChild(h('div', 'cea-empty', 'Not enough data to show earnings insights.<br>Complete some jobs to unlock analytics.'));
      container.appendChild(root);
      return;
    }

    var grid = h('div', 'cea-grid');
    grid.appendChild(statCard('Total Earned', fmt(c.totalEarnings), c.totalJobs + ' job' + (c.totalJobs !== 1 ? 's' : '')));
    grid.appendChild(statCard('Avg Project', c.avgProject != null ? fmt(c.avgProject) : '—'));
    grid.appendChild(statCard('Effective $/hr', c.effectiveRate != null ? fmt(c.effectiveRate, 2) : '—', c.totalHours ? c.totalHours.toLocaleString() + ' hrs tracked' : 'No hours data'));
    grid.appendChild(statCard('Est. Monthly', c.estMonthly != null ? fmt(c.estMonthly) : '—', c.estMonthly != null ? 'based on tenure' : 'Need memberSince'));
    root.appendChild(grid);

    if (c.hasHistory) {
      var chart = renderBarChartDOM(c.categories);
      if (chart) root.appendChild(chart);
    }

    if (c.estYearly != null) {
      var potentialHTML = '<strong>Earnings Potential</strong><br>';
      potentialHTML += 'At your current pace, you\'ll earn <span class="cea-highlight">' + fmt(c.estYearly) + '</span> this year.';
      if (c.suggestedRate && c.projectedYearly) {
        potentialHTML += ' Raising your rate to <span class="cea-highlight">' + fmt(c.suggestedRate) + '/hr</span> would project <span class="cea-highlight">' + fmt(c.projectedYearly) + '</span>.';
      }
      root.appendChild(h('div', 'cea-insight', potentialHTML));
    }

    if (c.effectiveRate != null && c.hourlyRate > 0) {
      var diff = c.effectiveRate - c.hourlyRate;
      var dir = diff >= 0 ? 'higher' : 'lower';
      var cls = diff >= 0 ? 'cea-compare-up' : 'cea-compare-down';
      var compHTML = 'Your effective rate (<strong>' + fmt(c.effectiveRate, 2) + '/hr</strong>) is ';
      compHTML += '<span class="' + cls + '">' + dir + '</span>';
      compHTML += ' than your listed rate (<strong>' + fmt(c.hourlyRate, 2) + '/hr</strong>)';
      if (Math.abs(diff) > 0.01) {
        compHTML += ' by ' + fmt(Math.abs(diff), 2);
      }
      root.appendChild(h('div', 'cea-insight', compHTML));
    }

    if (c.hasHistory && (c.hourlyCount + c.fixedCount) > 0) {
      var total = c.hourlyCount + c.fixedCount;
      var hPct = Math.round((c.hourlyCount / total) * 100);
      var fPct = 100 - hPct;
      var mixHTML = 'Job mix: <strong>' + hPct + '% hourly</strong> / <strong>' + fPct + '% fixed-price</strong>';
      if (c.topCategory) {
        mixHTML += ' · Top category: <span class="cea-highlight">' + c.topCategory + '</span>';
      }
      root.appendChild(h('div', 'cea-insight', mixHTML));
    }

    container.appendChild(root);
  }

  /* ───────── public API ───────── */

  var api = {
    addEarning: addEarning,
    getMonthlyRevenue: getMonthlyRevenue,
    getYoYGrowth: getYoYGrowth,
    getCategoryBreakdown: getCategoryBreakdown,
    getTopClients: getTopClients,
    renderEarningsChart: renderEarningsChart,
    render: renderEarningsAnalytics,
    compute: compute,
  };

  // Namespace on CortexFreelancer
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.EarningsAnalytics = api;

  // Legacy compat
  window.CortexEarningsAnalytics = api;

})();
