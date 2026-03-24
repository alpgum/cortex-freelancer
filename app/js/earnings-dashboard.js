/**
 * CF-051: Earnings Dashboard with Monthly/Yearly Breakdown
 * Renders a full earnings dashboard with bar charts, YoY growth,
 * category breakdown, and summary statistics using mock data.
 * Pure vanilla JS — no external dependencies.
 *
 * @namespace window.CortexFreelancer.EarningsDashboard
 */
(function () {
  'use strict';

  // ─── Constants ─────────────────────────────────────────

  var MONTHS = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  var MONTH_FULL = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  var CATEGORIES = [
    { key: 'webdev',     label: 'Web Development', color: '#4f8cff', weight: 0.40 },
    { key: 'design',     label: 'Design',          color: '#ff6b8a', weight: 0.25 },
    { key: 'consulting', label: 'Consulting',      color: '#36c98e', weight: 0.20 },
    { key: 'writing',    label: 'Writing',          color: '#ffb347', weight: 0.15 }
  ];

  var YEARS = [2024, 2025, 2026];

  var COLORS = {
    primary:    '#4f8cff',
    secondary:  '#6c63ff',
    positive:   '#36c98e',
    negative:   '#ff5252',
    neutral:    '#a0a8c0',
    cardBg:     '#1e2235',
    panelBg:    '#161929',
    text:       '#e8ecf4',
    textDim:    '#8a92a8',
    border:     '#2a2f45',
    rowAlt:     '#1a1e32'
  };

  // ─── Seeded Random ─────────────────────────────────────

  /**
   * Simple seeded pseudo-random number generator (mulberry32).
   * @param {number} seed
   * @returns {function(): number} Returns 0-1 float per call.
   */
  function seededRandom(seed) {
    return function () {
      seed |= 0;
      seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ─── Mock Data Generation ──────────────────────────────

  /**
   * Generate deterministic mock earnings data for all years.
   * @returns {Object} { monthly: { year: [ {month,total,categories} ] }, categories: {} }
   */
  function generateMockData() {
    var rng = seededRandom(42);
    var monthly = {};
    var categoryTotals = {};
    var i, j, k;

    for (i = 0; i < CATEGORIES.length; i++) {
      categoryTotals[CATEGORIES[i].key] = 0;
    }

    for (i = 0; i < YEARS.length; i++) {
      var year = YEARS[i];
      monthly[year] = [];

      // Current year may be partial
      var monthCount = 12;
      if (year === 2026) {
        monthCount = 3; // Up to March 2026
      }

      // Base monthly earning grows each year
      var baseEarning = 4000 + i * 1200;

      for (j = 0; j < monthCount; j++) {
        // Seasonal variation: higher in Q1 and Q4
        var seasonal = 1.0;
        if (j <= 1 || j >= 10) seasonal = 1.15;
        if (j >= 5 && j <= 7) seasonal = 0.85; // summer dip

        var noise = 0.7 + rng() * 0.6; // 0.7 to 1.3
        var total = Math.round(baseEarning * seasonal * noise);

        // Split into categories
        var cats = {};
        var remaining = total;
        for (k = 0; k < CATEGORIES.length; k++) {
          var cat = CATEGORIES[k];
          var share;
          if (k === CATEGORIES.length - 1) {
            share = remaining;
          } else {
            var catNoise = 0.8 + rng() * 0.4;
            share = Math.round(total * cat.weight * catNoise);
            if (share > remaining) share = remaining;
          }
          cats[cat.key] = share;
          categoryTotals[cat.key] += share;
          remaining -= share;
        }

        monthly[year].push({
          month: j,
          monthLabel: MONTHS[j],
          year: year,
          total: total,
          categories: cats
        });
      }
    }

    return {
      monthly: monthly,
      categories: categoryTotals,
      years: YEARS
    };
  }

  // ─── Computation Helpers ───────────────────────────────

  /**
   * Compute summary statistics across all data.
   * @param {Object} data - Generated mock data
   * @returns {Object}
   */
  function computeSummaryStats(data) {
    var allMonths = [];
    var yearTotals = {};

    for (var i = 0; i < YEARS.length; i++) {
      var year = YEARS[i];
      yearTotals[year] = 0;
      var months = data.monthly[year];
      for (var j = 0; j < months.length; j++) {
        allMonths.push(months[j]);
        yearTotals[year] += months[j].total;
      }
    }

    var grandTotal = 0;
    var bestMonth = allMonths[0];
    for (var k = 0; k < allMonths.length; k++) {
      grandTotal += allMonths[k].total;
      if (allMonths[k].total > bestMonth.total) {
        bestMonth = allMonths[k];
      }
    }

    var avgMonthly = allMonths.length > 0 ? Math.round(grandTotal / allMonths.length) : 0;

    return {
      grandTotal: grandTotal,
      avgMonthly: avgMonthly,
      bestMonth: bestMonth,
      yearTotals: yearTotals,
      totalMonths: allMonths.length
    };
  }

  /**
   * Compute YoY growth for months present in both years.
   * @param {Object} data
   * @param {number} yearA - Earlier year
   * @param {number} yearB - Later year
   * @returns {Array}
   */
  function computeYoY(data, yearA, yearB) {
    var mA = data.monthly[yearA] || [];
    var mB = data.monthly[yearB] || [];
    var len = Math.min(mA.length, mB.length);
    var results = [];
    for (var i = 0; i < len; i++) {
      var growth = mA[i].total > 0
        ? ((mB[i].total - mA[i].total) / mA[i].total) * 100
        : 0;
      results.push({
        month: i,
        monthLabel: MONTHS[i],
        valA: mA[i].total,
        valB: mB[i].total,
        growth: Math.round(growth * 10) / 10
      });
    }
    return results;
  }

  // ─── Formatting ────────────────────────────────────────

  function formatCurrency(amount) {
    if (amount >= 1000) {
      return '$' + amount.toLocaleString('en-US');
    }
    return '$' + amount;
  }

  function formatCurrencyShort(amount) {
    if (amount >= 1000000) {
      return '$' + (amount / 1000000).toFixed(1) + 'M';
    }
    if (amount >= 1000) {
      return '$' + (amount / 1000).toFixed(1) + 'k';
    }
    return '$' + amount;
  }

  // ─── Styles ────────────────────────────────────────────

  function injectStyles() {
    if (document.getElementById('cf-earnings-dashboard-styles')) return;

    var css = [
      '.cf-ed { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: ' + COLORS.text + '; background: ' + COLORS.panelBg + '; border-radius: 12px; padding: 28px; max-width: 1100px; margin: 0 auto; }',
      '.cf-ed *, .cf-ed *::before, .cf-ed *::after { box-sizing: border-box; }',
      '.cf-ed-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 12px; }',
      '.cf-ed-title { font-size: 22px; font-weight: 700; margin: 0; }',
      '.cf-ed-subtitle { font-size: 13px; color: ' + COLORS.textDim + '; margin: 4px 0 0; }',
      '.cf-ed-year-tabs { display: flex; gap: 6px; }',
      '.cf-ed-year-tab { background: ' + COLORS.cardBg + '; border: 1px solid ' + COLORS.border + '; color: ' + COLORS.textDim + '; padding: 6px 16px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600; transition: all 0.15s ease; }',
      '.cf-ed-year-tab:hover { border-color: ' + COLORS.primary + '; color: ' + COLORS.text + '; }',
      '.cf-ed-year-tab.active { background: ' + COLORS.primary + '; border-color: ' + COLORS.primary + '; color: #fff; }',

      /* Summary cards */
      '.cf-ed-summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }',
      '.cf-ed-card { background: ' + COLORS.cardBg + '; border: 1px solid ' + COLORS.border + '; border-radius: 10px; padding: 18px 20px; }',
      '.cf-ed-card-label { font-size: 12px; color: ' + COLORS.textDim + '; text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 6px; }',
      '.cf-ed-card-value { font-size: 26px; font-weight: 700; line-height: 1.2; }',
      '.cf-ed-card-sub { font-size: 12px; color: ' + COLORS.textDim + '; margin-top: 4px; }',

      /* Chart section */
      '.cf-ed-section { background: ' + COLORS.cardBg + '; border: 1px solid ' + COLORS.border + '; border-radius: 10px; padding: 20px; margin-bottom: 20px; }',
      '.cf-ed-section-title { font-size: 15px; font-weight: 600; margin: 0 0 16px; }',

      /* Bar chart */
      '.cf-ed-bar-chart { display: flex; align-items: flex-end; gap: 6px; height: 220px; padding-top: 10px; }',
      '.cf-ed-bar-col { flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; justify-content: flex-end; position: relative; }',
      '.cf-ed-bar { width: 100%; max-width: 48px; border-radius: 4px 4px 0 0; transition: height 0.4s ease, background 0.2s; cursor: pointer; position: relative; min-height: 2px; }',
      '.cf-ed-bar:hover { filter: brightness(1.2); }',
      '.cf-ed-bar-label { font-size: 11px; color: ' + COLORS.textDim + '; margin-top: 8px; white-space: nowrap; }',
      '.cf-ed-bar-value { font-size: 10px; color: ' + COLORS.textDim + '; margin-bottom: 4px; white-space: nowrap; }',

      /* Tooltip */
      '.cf-ed-tooltip { position: absolute; background: #2a2f45; border: 1px solid ' + COLORS.border + '; color: ' + COLORS.text + '; padding: 10px 14px; border-radius: 8px; font-size: 12px; pointer-events: none; z-index: 100; white-space: nowrap; box-shadow: 0 4px 16px rgba(0,0,0,0.4); display: none; bottom: 100%; left: 50%; transform: translateX(-50%); margin-bottom: 8px; }',
      '.cf-ed-tooltip::after { content: ""; position: absolute; top: 100%; left: 50%; transform: translateX(-50%); border: 6px solid transparent; border-top-color: #2a2f45; }',

      /* YoY comparison */
      '.cf-ed-yoy-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }',
      '.cf-ed-yoy-item { background: ' + COLORS.panelBg + '; border: 1px solid ' + COLORS.border + '; border-radius: 8px; padding: 14px; }',
      '.cf-ed-yoy-month { font-size: 13px; font-weight: 600; margin-bottom: 8px; }',
      '.cf-ed-yoy-row { display: flex; justify-content: space-between; font-size: 12px; color: ' + COLORS.textDim + '; margin-bottom: 4px; }',
      '.cf-ed-yoy-growth { font-size: 16px; font-weight: 700; margin-top: 6px; }',
      '.cf-ed-yoy-growth.positive { color: ' + COLORS.positive + '; }',
      '.cf-ed-yoy-growth.negative { color: ' + COLORS.negative + '; }',
      '.cf-ed-yoy-bar-track { height: 6px; background: ' + COLORS.panelBg + '; border-radius: 3px; margin-top: 8px; overflow: hidden; display: flex; }',
      '.cf-ed-yoy-bar-a { height: 100%; border-radius: 3px 0 0 3px; }',
      '.cf-ed-yoy-bar-b { height: 100%; border-radius: 0 3px 3px 0; }',

      /* Category breakdown */
      '.cf-ed-cat-container { display: flex; gap: 24px; flex-wrap: wrap; align-items: center; }',
      '.cf-ed-cat-ring { position: relative; width: 180px; height: 180px; flex-shrink: 0; }',
      '.cf-ed-cat-ring canvas { width: 180px; height: 180px; }',
      '.cf-ed-cat-center { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; }',
      '.cf-ed-cat-center-val { font-size: 18px; font-weight: 700; }',
      '.cf-ed-cat-center-lbl { font-size: 11px; color: ' + COLORS.textDim + '; }',
      '.cf-ed-cat-legend { flex: 1; min-width: 200px; }',
      '.cf-ed-cat-item { display: flex; align-items: center; padding: 10px 0; border-bottom: 1px solid ' + COLORS.border + '; }',
      '.cf-ed-cat-item:last-child { border-bottom: none; }',
      '.cf-ed-cat-dot { width: 10px; height: 10px; border-radius: 50%; margin-right: 12px; flex-shrink: 0; }',
      '.cf-ed-cat-info { flex: 1; }',
      '.cf-ed-cat-name { font-size: 13px; font-weight: 600; }',
      '.cf-ed-cat-pct { font-size: 11px; color: ' + COLORS.textDim + '; }',
      '.cf-ed-cat-amount { font-size: 14px; font-weight: 600; text-align: right; }',

      /* Table */
      '.cf-ed-table-wrap { overflow-x: auto; }',
      '.cf-ed-table { width: 100%; border-collapse: collapse; font-size: 13px; }',
      '.cf-ed-table th { text-align: left; padding: 10px 12px; border-bottom: 2px solid ' + COLORS.border + '; color: ' + COLORS.textDim + '; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }',
      '.cf-ed-table td { padding: 10px 12px; border-bottom: 1px solid ' + COLORS.border + '; }',
      '.cf-ed-table tr:nth-child(even) td { background: ' + COLORS.rowAlt + '; }',
      '.cf-ed-table .cf-ed-pos { color: ' + COLORS.positive + '; }',
      '.cf-ed-table .cf-ed-neg { color: ' + COLORS.negative + '; }',

      /* Responsive */
      '@media (max-width: 640px) {',
      '  .cf-ed { padding: 16px; }',
      '  .cf-ed-bar-chart { height: 160px; gap: 3px; }',
      '  .cf-ed-bar-value { display: none; }',
      '  .cf-ed-cat-container { flex-direction: column; align-items: flex-start; }',
      '  .cf-ed-header { flex-direction: column; align-items: flex-start; }',
      '}'
    ].join('\n');

    var style = document.createElement('style');
    style.id = 'cf-earnings-dashboard-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ─── DOM Helpers ───────────────────────────────────────

  /**
   * Create a DOM element with attributes and children.
   * @param {string} tag
   * @param {Object} [attrs]
   * @param {Array|string} [children]
   * @returns {HTMLElement}
   */
  function h(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      for (var key in attrs) {
        if (!attrs.hasOwnProperty(key)) continue;
        if (key === 'className') {
          node.className = attrs[key];
        } else if (key === 'textContent') {
          node.textContent = attrs[key];
        } else if (key === 'innerHTML') {
          node.innerHTML = attrs[key];
        } else if (key.indexOf('on') === 0) {
          node.addEventListener(key.slice(2).toLowerCase(), attrs[key]);
        } else {
          node.setAttribute(key, attrs[key]);
        }
      }
    }
    if (children) {
      if (!Array.isArray(children)) children = [children];
      for (var i = 0; i < children.length; i++) {
        if (typeof children[i] === 'string') {
          node.appendChild(document.createTextNode(children[i]));
        } else if (children[i]) {
          node.appendChild(children[i]);
        }
      }
    }
    return node;
  }

  // ─── Render: Summary Cards ─────────────────────────────

  /**
   * Build the four summary stat cards for the selected year.
   * @param {Object} stats
   * @param {number} selectedYear
   * @param {Object} data
   * @returns {HTMLElement}
   */
  function renderSummaryCards(stats, selectedYear, data) {
    var yearTotal = stats.yearTotals[selectedYear] || 0;
    var monthsInYear = (data.monthly[selectedYear] || []).length;
    var yearAvg = monthsInYear > 0 ? Math.round(yearTotal / monthsInYear) : 0;

    // Find best month for selected year
    var yearMonths = data.monthly[selectedYear] || [];
    var bestInYear = yearMonths.length > 0 ? yearMonths[0] : null;
    for (var i = 1; i < yearMonths.length; i++) {
      if (yearMonths[i].total > bestInYear.total) bestInYear = yearMonths[i];
    }

    // YoY total growth (compare same number of months)
    var prevYear = selectedYear - 1;
    var prevTotal = stats.yearTotals[prevYear];
    var yoyLabel = '';
    if (prevTotal && prevTotal > 0) {
      var prevMonths = (data.monthly[prevYear] || []).slice(0, monthsInYear);
      var prevPartial = 0;
      for (var p = 0; p < prevMonths.length; p++) prevPartial += prevMonths[p].total;
      if (prevPartial > 0) {
        var yoyPct = ((yearTotal - prevPartial) / prevPartial) * 100;
        var sign = yoyPct >= 0 ? '+' : '';
        var clr = yoyPct >= 0 ? COLORS.positive : COLORS.negative;
        yoyLabel = '<span style="color:' + clr + '">' + sign + yoyPct.toFixed(1) + '% vs ' + prevYear + '</span>';
      }
    }

    var cards = [
      { label: selectedYear + ' Earnings', value: formatCurrency(yearTotal), sub: yoyLabel || (monthsInYear + ' months') },
      { label: 'Monthly Average', value: formatCurrency(yearAvg), sub: monthsInYear + ' months in ' + selectedYear },
      { label: 'Best Month (' + selectedYear + ')', value: bestInYear ? formatCurrency(bestInYear.total) : 'N/A', sub: bestInYear ? MONTH_FULL[bestInYear.month] + ' ' + selectedYear : '' },
      { label: 'All-Time Total', value: formatCurrency(stats.grandTotal), sub: stats.totalMonths + ' months tracked' }
    ];

    var grid = h('div', { className: 'cf-ed-summary' });
    for (var c = 0; c < cards.length; c++) {
      var card = h('div', { className: 'cf-ed-card' }, [
        h('div', { className: 'cf-ed-card-label', textContent: cards[c].label }),
        h('div', { className: 'cf-ed-card-value', textContent: cards[c].value }),
        h('div', { className: 'cf-ed-card-sub', innerHTML: cards[c].sub })
      ]);
      grid.appendChild(card);
    }
    return grid;
  }

  // ─── Render: Monthly Bar Chart ─────────────────────────

  /**
   * Build the DOM-based monthly revenue bar chart.
   * @param {Object} data
   * @param {number} selectedYear
   * @returns {HTMLElement}
   */
  function renderBarChart(data, selectedYear) {
    var months = data.monthly[selectedYear] || [];
    if (months.length === 0) {
      return h('div', { className: 'cf-ed-section' }, [
        h('div', { className: 'cf-ed-section-title', textContent: 'Monthly Revenue' }),
        h('p', { textContent: 'No data for ' + selectedYear, style: 'color:' + COLORS.textDim })
      ]);
    }

    var maxVal = 0;
    for (var i = 0; i < months.length; i++) {
      if (months[i].total > maxVal) maxVal = months[i].total;
    }
    if (maxVal === 0) maxVal = 1;

    var chartContainer = h('div', { className: 'cf-ed-bar-chart' });

    for (var j = 0; j < months.length; j++) {
      var m = months[j];
      var pct = (m.total / maxVal) * 100;
      var barHeight = Math.max(pct, 1);

      // Build tooltip content
      var tooltip = h('div', { className: 'cf-ed-tooltip' });
      var tooltipLines = [
        '<strong>' + MONTH_FULL[m.month] + ' ' + m.year + '</strong>',
        'Total: ' + formatCurrency(m.total)
      ];
      for (var k = 0; k < CATEGORIES.length; k++) {
        var cat = CATEGORIES[k];
        var catVal = m.categories[cat.key] || 0;
        tooltipLines.push(
          '<span style="color:' + cat.color + '">\u25CF</span> ' +
          cat.label + ': ' + formatCurrency(catVal)
        );
      }
      tooltip.innerHTML = tooltipLines.join('<br>');

      var bar = h('div', {
        className: 'cf-ed-bar',
        style: 'height:' + barHeight + '%;background:' + COLORS.primary + ';'
      });

      // Hover events via closure
      (function (barEl, tooltipEl) {
        barEl.addEventListener('mouseenter', function () { tooltipEl.style.display = 'block'; });
        barEl.addEventListener('mouseleave', function () { tooltipEl.style.display = 'none'; });
      })(bar, tooltip);

      var col = h('div', { className: 'cf-ed-bar-col', style: 'position:relative;' }, [
        h('div', { className: 'cf-ed-bar-value', textContent: formatCurrencyShort(m.total) }),
        bar,
        tooltip,
        h('div', { className: 'cf-ed-bar-label', textContent: m.monthLabel })
      ]);

      chartContainer.appendChild(col);
    }

    return h('div', { className: 'cf-ed-section' }, [
      h('div', { className: 'cf-ed-section-title', textContent: 'Monthly Revenue \u2014 ' + selectedYear }),
      chartContainer
    ]);
  }

  // ─── Render: YoY Growth ────────────────────────────────

  /**
   * Build the year-over-year growth comparison panel.
   * @param {Object} data
   * @param {number} selectedYear
   * @returns {HTMLElement}
   */
  function renderYoYGrowth(data, selectedYear) {
    var prevYear = selectedYear - 1;
    if (!data.monthly[prevYear] || data.monthly[prevYear].length === 0) {
      return h('div', { className: 'cf-ed-section' }, [
        h('div', { className: 'cf-ed-section-title', textContent: 'Year-over-Year Growth' }),
        h('p', { textContent: 'No prior year data available for comparison.', style: 'color:' + COLORS.textDim + ';font-size:13px;' })
      ]);
    }

    var yoy = computeYoY(data, prevYear, selectedYear);
    var grid = h('div', { className: 'cf-ed-yoy-grid' });

    for (var i = 0; i < yoy.length; i++) {
      var item = yoy[i];
      var growthClass = item.growth >= 0 ? 'positive' : 'negative';
      var arrow = item.growth >= 0 ? '\u25B2' : '\u25BC';
      var maxBar = Math.max(item.valA, item.valB, 1);

      // Build comparison bar
      var track = h('div', { className: 'cf-ed-yoy-bar-track' });
      track.appendChild(h('div', {
        className: 'cf-ed-yoy-bar-a',
        style: 'width:' + ((item.valA / maxBar) * 50) + '%;background:' + COLORS.neutral + ';'
      }));
      track.appendChild(h('div', {
        className: 'cf-ed-yoy-bar-b',
        style: 'width:' + ((item.valB / maxBar) * 50) + '%;background:' + COLORS.primary + ';'
      }));

      var card = h('div', { className: 'cf-ed-yoy-item' }, [
        h('div', { className: 'cf-ed-yoy-month', textContent: MONTH_FULL[item.month] }),
        h('div', { className: 'cf-ed-yoy-row' }, [
          h('span', { textContent: prevYear + ': ' + formatCurrency(item.valA) }),
          h('span', { textContent: selectedYear + ': ' + formatCurrency(item.valB) })
        ]),
        h('div', {
          className: 'cf-ed-yoy-growth ' + growthClass,
          textContent: arrow + ' ' + (item.growth >= 0 ? '+' : '') + item.growth + '%'
        }),
        track
      ]);
      grid.appendChild(card);
    }

    // Overall summary row
    var totalA = 0, totalB = 0;
    for (var s = 0; s < yoy.length; s++) {
      totalA += yoy[s].valA;
      totalB += yoy[s].valB;
    }
    var overallGrowth = totalA > 0 ? ((totalB - totalA) / totalA) * 100 : 0;
    overallGrowth = Math.round(overallGrowth * 10) / 10;
    var overallClass = overallGrowth >= 0 ? 'positive' : 'negative';
    var overallArrow = overallGrowth >= 0 ? '\u25B2' : '\u25BC';

    var summaryRow = h('div', {
      style: 'display:flex;justify-content:space-between;align-items:center;margin-top:16px;padding:14px 16px;background:' + COLORS.panelBg + ';border:1px solid ' + COLORS.border + ';border-radius:8px;flex-wrap:wrap;gap:8px;'
    }, [
      h('span', { style: 'font-size:13px;font-weight:600;', textContent: 'Overall (' + yoy.length + '-month comparison)' }),
      h('span', {
        className: 'cf-ed-yoy-growth ' + overallClass,
        style: 'margin-top:0;',
        textContent: overallArrow + ' ' + (overallGrowth >= 0 ? '+' : '') + overallGrowth + '%  (' + formatCurrency(totalA) + ' \u2192 ' + formatCurrency(totalB) + ')'
      })
    ]);

    return h('div', { className: 'cf-ed-section' }, [
      h('div', { className: 'cf-ed-section-title', textContent: 'Year-over-Year Growth: ' + prevYear + ' vs ' + selectedYear }),
      grid,
      summaryRow
    ]);
  }

  // ─── Render: Category Breakdown (Canvas donut) ─────────

  /**
   * Build the category breakdown panel with a canvas donut chart and legend.
   * @param {Object} data
   * @param {number} selectedYear
   * @returns {HTMLElement}
   */
  function renderCategoryBreakdown(data, selectedYear) {
    var months = data.monthly[selectedYear] || [];
    var catTotals = {};
    var grandTotal = 0;
    var i, j;

    for (i = 0; i < CATEGORIES.length; i++) {
      catTotals[CATEGORIES[i].key] = 0;
    }
    for (i = 0; i < months.length; i++) {
      for (j = 0; j < CATEGORIES.length; j++) {
        var key = CATEGORIES[j].key;
        var val = months[i].categories[key] || 0;
        catTotals[key] += val;
        grandTotal += val;
      }
    }

    // Donut chart via canvas
    var canvasSize = 180;
    var dpr = window.devicePixelRatio || 1;
    var canvas = document.createElement('canvas');
    canvas.width = canvasSize * dpr;
    canvas.height = canvasSize * dpr;
    canvas.style.width = canvasSize + 'px';
    canvas.style.height = canvasSize + 'px';

    // Draw the donut after appending to DOM (deferred so canvas has layout)
    function drawDonut() {
      var ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, canvasSize, canvasSize);

      var cx = canvasSize / 2;
      var cy = canvasSize / 2;
      var outerR = 80;
      var innerR = 52;
      var startAngle = -Math.PI / 2;

      if (grandTotal === 0) {
        ctx.beginPath();
        ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
        ctx.arc(cx, cy, innerR, Math.PI * 2, 0, true);
        ctx.fillStyle = COLORS.border;
        ctx.fill();
        return;
      }

      for (var di = 0; di < CATEGORIES.length; di++) {
        var cat = CATEGORIES[di];
        var fraction = catTotals[cat.key] / grandTotal;
        var sweep = fraction * Math.PI * 2;
        var endAngle = startAngle + sweep;

        ctx.beginPath();
        ctx.arc(cx, cy, outerR, startAngle, endAngle);
        ctx.arc(cx, cy, innerR, endAngle, startAngle, true);
        ctx.closePath();
        ctx.fillStyle = cat.color;
        ctx.fill();

        // Small gap between segments
        ctx.beginPath();
        ctx.arc(cx, cy, outerR, endAngle - 0.01, endAngle + 0.01);
        ctx.arc(cx, cy, innerR, endAngle + 0.01, endAngle - 0.01, true);
        ctx.fillStyle = COLORS.cardBg;
        ctx.fill();

        startAngle = endAngle;
      }
    }

    // Schedule draw after element is in DOM
    setTimeout(drawDonut, 0);

    var ringWrap = h('div', { className: 'cf-ed-cat-ring' }, [
      canvas,
      h('div', { className: 'cf-ed-cat-center' }, [
        h('div', { className: 'cf-ed-cat-center-val', textContent: formatCurrencyShort(grandTotal) }),
        h('div', { className: 'cf-ed-cat-center-lbl', textContent: selectedYear + ' Total' })
      ])
    ]);

    // Legend
    var legend = h('div', { className: 'cf-ed-cat-legend' });
    for (i = 0; i < CATEGORIES.length; i++) {
      var c = CATEGORIES[i];
      var amt = catTotals[c.key];
      var pctVal = grandTotal > 0 ? ((amt / grandTotal) * 100).toFixed(1) : '0.0';

      legend.appendChild(
        h('div', { className: 'cf-ed-cat-item' }, [
          h('div', { className: 'cf-ed-cat-dot', style: 'background:' + c.color + ';' }),
          h('div', { className: 'cf-ed-cat-info' }, [
            h('div', { className: 'cf-ed-cat-name', textContent: c.label }),
            h('div', { className: 'cf-ed-cat-pct', textContent: pctVal + '% of total' })
          ]),
          h('div', { className: 'cf-ed-cat-amount', textContent: formatCurrency(amt) })
        ])
      );
    }

    return h('div', { className: 'cf-ed-section' }, [
      h('div', { className: 'cf-ed-section-title', textContent: 'Category Breakdown \u2014 ' + selectedYear }),
      h('div', { className: 'cf-ed-cat-container' }, [ringWrap, legend])
    ]);
  }

  // ─── Render: Monthly Detail Table ──────────────────────

  /**
   * Build the monthly detail table with per-category columns.
   * @param {Object} data
   * @param {number} selectedYear
   * @returns {HTMLElement|null}
   */
  function renderMonthlyTable(data, selectedYear) {
    var months = data.monthly[selectedYear] || [];
    if (months.length === 0) return null;

    var table = h('table', { className: 'cf-ed-table' });

    // Header
    var headRow = h('tr');
    var headers = ['Month', 'Total'];
    for (var hi = 0; hi < CATEGORIES.length; hi++) {
      headers.push(CATEGORIES[hi].label);
    }
    headers.push('vs Prev');
    for (var hj = 0; hj < headers.length; hj++) {
      headRow.appendChild(h('th', { textContent: headers[hj] }));
    }
    var thead = h('thead');
    thead.appendChild(headRow);
    table.appendChild(thead);

    // Body
    var tbody = h('tbody');
    for (var i = 0; i < months.length; i++) {
      var m = months[i];
      var row = h('tr');
      row.appendChild(h('td', { style: 'font-weight:600;', textContent: MONTH_FULL[m.month] }));
      row.appendChild(h('td', { style: 'font-weight:600;', textContent: formatCurrency(m.total) }));

      for (var c = 0; c < CATEGORIES.length; c++) {
        row.appendChild(h('td', { textContent: formatCurrency(m.categories[CATEGORIES[c].key] || 0) }));
      }

      // vs prev month
      var vsPrev = '';
      var vsCls = '';
      if (i > 0) {
        var diff = m.total - months[i - 1].total;
        var diffPct = months[i - 1].total > 0 ? ((diff / months[i - 1].total) * 100).toFixed(1) : '0';
        vsCls = diff >= 0 ? 'cf-ed-pos' : 'cf-ed-neg';
        vsPrev = (diff >= 0 ? '+' : '') + diffPct + '%';
      } else {
        vsPrev = '\u2014';
      }
      row.appendChild(h('td', { className: vsCls, textContent: vsPrev }));

      tbody.appendChild(row);
    }

    // Footer totals row
    var footRow = h('tr');
    var yearTotal = 0;
    var catSums = {};
    for (var fi = 0; fi < CATEGORIES.length; fi++) catSums[CATEGORIES[fi].key] = 0;
    for (var fj = 0; fj < months.length; fj++) {
      yearTotal += months[fj].total;
      for (var fk = 0; fk < CATEGORIES.length; fk++) {
        catSums[CATEGORIES[fk].key] += (months[fj].categories[CATEGORIES[fk].key] || 0);
      }
    }
    footRow.appendChild(h('td', { style: 'font-weight:700;', textContent: 'Total' }));
    footRow.appendChild(h('td', { style: 'font-weight:700;', textContent: formatCurrency(yearTotal) }));
    for (var fl = 0; fl < CATEGORIES.length; fl++) {
      footRow.appendChild(h('td', { style: 'font-weight:600;', textContent: formatCurrency(catSums[CATEGORIES[fl].key]) }));
    }
    footRow.appendChild(h('td', { textContent: '' }));
    var tfoot = h('tfoot');
    tfoot.appendChild(footRow);
    table.appendChild(tbody);
    table.appendChild(tfoot);

    return h('div', { className: 'cf-ed-section' }, [
      h('div', { className: 'cf-ed-section-title', textContent: 'Monthly Detail \u2014 ' + selectedYear }),
      h('div', { className: 'cf-ed-table-wrap' }, [table])
    ]);
  }

  // ─── Main Render ───────────────────────────────────────

  /**
   * Render the full dashboard into a container element.
   * @param {HTMLElement} container
   * @param {Object} data
   * @param {number} selectedYear
   */
  function render(container, data, selectedYear) {
    container.innerHTML = '';
    var stats = computeSummaryStats(data);

    var root = h('div', { className: 'cf-ed' });

    // Header with year tabs
    var headerLeft = h('div', {}, [
      h('h2', { className: 'cf-ed-title', textContent: 'Earnings Dashboard' }),
      h('p', { className: 'cf-ed-subtitle', textContent: 'Track your freelance income across projects and categories' })
    ]);

    var yearTabs = h('div', { className: 'cf-ed-year-tabs' });
    for (var y = 0; y < YEARS.length; y++) {
      (function (yr) {
        var cls = 'cf-ed-year-tab' + (yr === selectedYear ? ' active' : '');
        var tab = h('button', {
          className: cls,
          textContent: String(yr),
          onClick: function () {
            render(container, data, yr);
          }
        });
        yearTabs.appendChild(tab);
      })(YEARS[y]);
    }

    var header = h('div', { className: 'cf-ed-header' }, [headerLeft, yearTabs]);
    root.appendChild(header);

    // Summary cards
    root.appendChild(renderSummaryCards(stats, selectedYear, data));

    // Monthly bar chart
    root.appendChild(renderBarChart(data, selectedYear));

    // YoY growth
    root.appendChild(renderYoYGrowth(data, selectedYear));

    // Category breakdown
    root.appendChild(renderCategoryBreakdown(data, selectedYear));

    // Monthly detail table
    var table = renderMonthlyTable(data, selectedYear);
    if (table) root.appendChild(table);

    container.appendChild(root);
  }

  // ─── Public API ────────────────────────────────────────

  /**
   * Initialize the Earnings Dashboard.
   * @param {string} containerId - ID of the DOM element to render into.
   * @returns {Object|null} Dashboard controller with refresh/destroy methods.
   */
  function init(containerId) {
    injectStyles();

    var container = document.getElementById(containerId);
    if (!container) {
      console.error('[EarningsDashboard] Container not found: #' + containerId);
      return null;
    }

    var data = generateMockData();
    var currentYear = YEARS[YEARS.length - 1]; // default to latest year

    render(container, data, currentYear);

    return {
      /** Re-render with optionally a different year. */
      refresh: function (year) {
        year = year || currentYear;
        if (data.monthly[year]) currentYear = year;
        render(container, data, currentYear);
      },
      /** Remove the dashboard from the DOM. */
      destroy: function () {
        container.innerHTML = '';
        var styleEl = document.getElementById('cf-earnings-dashboard-styles');
        if (styleEl) styleEl.parentNode.removeChild(styleEl);
      },
      /** Get the generated mock data. */
      getData: function () {
        return data;
      },
      /** Get computed summary stats. */
      getStats: function () {
        return computeSummaryStats(data);
      }
    };
  }

  // ─── Namespace Registration ────────────────────────────

  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.EarningsDashboard = {
    init: init
  };

})();
