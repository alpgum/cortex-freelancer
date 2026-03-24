/**
 * CF-055: Earnings Projection with Trend Analysis
 * Generate mock historical earnings, compute linear regression trends,
 * project next 3/6/12 month earnings with confidence intervals,
 * and render an interactive line chart with summary cards.
 *
 * @namespace window.CortexFreelancer.EarningsProjection
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_earnings_projection';

  // ─── Colour Palette ──────────────────────────────────

  var COLORS = {
    primary:        '#4F46E5',
    primaryLight:   'rgba(79, 70, 229, 0.12)',
    projected:      '#7C3AED',
    projectedLight: 'rgba(124, 58, 237, 0.10)',
    confidence:     'rgba(124, 58, 237, 0.08)',
    confidenceLine: 'rgba(124, 58, 237, 0.25)',
    optimistic:     '#10B981',
    pessimistic:    '#EF4444',
    gridLine:       '#E5E7EB',
    text:           '#1F2937',
    textMuted:      '#6B7280',
    cardBg:         '#FFFFFF',
    bg:             '#F9FAFB',
    border:         '#E5E7EB'
  };

  // ─── Mock Data Generation ────────────────────────────

  /**
   * Seed-based pseudo-random number generator for reproducible mock data.
   * @param {number} seed
   * @returns {function(): number} Returns values in [0, 1).
   */
  function seededRandom(seed) {
    var s = seed;
    return function () {
      s = (s * 16807 + 0) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  /**
   * Generate 18 months of mock historical earnings data.
   * Creates a realistic upward trend with seasonal variation and noise.
   * Uses a seeded PRNG so output is deterministic across reloads.
   * @returns {Array.<{month: string, date: Date, amount: number}>}
   */
  function generateMockHistory() {
    var data = [];
    var now = new Date();
    var baseAmount = 3200;
    var monthlyGrowth = 120;
    var months = 18;
    var rng = seededRandom(42);

    for (var i = months - 1; i >= 0; i--) {
      var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      var monthIndex = d.getMonth();

      // Seasonal factor: busier Q4 and Q1
      var seasonal = 1.0;
      if (monthIndex >= 9 && monthIndex <= 11) seasonal = 1.15; // Oct-Dec
      if (monthIndex === 0) seasonal = 1.10;                     // Jan
      if (monthIndex >= 5 && monthIndex <= 7) seasonal = 0.90;  // Jun-Aug

      // Growth + seasonal + noise
      var trend = baseAmount + monthlyGrowth * (months - 1 - i);
      var noise = (rng() - 0.5) * 800;
      var amount = Math.round(trend * seasonal + noise);
      if (amount < 500) amount = 500;

      data.push({
        month: formatMonthLabel(d),
        date: d,
        amount: amount
      });
    }

    return data;
  }

  /**
   * Format a date as "MMM YYYY".
   * @param {Date} d
   * @returns {string}
   */
  function formatMonthLabel(d) {
    var names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return names[d.getMonth()] + ' ' + d.getFullYear();
  }

  // ─── Linear Regression ───────────────────────────────

  /**
   * Compute simple linear regression: y = slope * x + intercept.
   * @param {Array.<number>} xs
   * @param {Array.<number>} ys
   * @returns {{slope: number, intercept: number, r2: number, stdError: number}}
   */
  function linearRegression(xs, ys) {
    var n = xs.length;
    if (n < 2) {
      return { slope: 0, intercept: ys.length > 0 ? ys[0] : 0, r2: 0, stdError: 0 };
    }

    var sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

    for (var i = 0; i < n; i++) {
      sumX  += xs[i];
      sumY  += ys[i];
      sumXY += xs[i] * ys[i];
      sumX2 += xs[i] * xs[i];
    }

    var denom = (n * sumX2 - sumX * sumX);
    var slope = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
    var intercept = (sumY - slope * sumX) / n;

    // R-squared
    var ssTot = 0, ssRes = 0;
    var meanY = sumY / n;
    for (var j = 0; j < n; j++) {
      var predicted = slope * xs[j] + intercept;
      ssRes += (ys[j] - predicted) * (ys[j] - predicted);
      ssTot += (ys[j] - meanY) * (ys[j] - meanY);
    }
    var r2 = ssTot !== 0 ? Math.max(0, 1 - ssRes / ssTot) : 0;

    // Standard error of the estimate
    var stdError = n > 2 ? Math.sqrt(ssRes / (n - 2)) : 0;

    return { slope: slope, intercept: intercept, r2: r2, stdError: stdError };
  }

  // ─── Projection Engine ───────────────────────────────

  /**
   * Project future earnings based on historical data.
   * @param {Array.<{month: string, date: Date, amount: number}>} history
   * @param {number} monthsAhead - Number of months to project
   * @returns {{projected: Array, regression: Object, totals: Object}}
   */
  function projectEarnings(history, monthsAhead) {
    var xs = [];
    var ys = [];
    for (var i = 0; i < history.length; i++) {
      xs.push(i);
      ys.push(history[i].amount);
    }

    var reg = linearRegression(xs, ys);
    var projected = [];
    var n = history.length;

    for (var m = 1; m <= monthsAhead; m++) {
      var x = n - 1 + m;
      var predicted = reg.slope * x + reg.intercept;
      if (predicted < 0) predicted = 0;

      // Confidence interval widens over time
      var confidenceMultiplier = 1.0 + (m - 1) * 0.15;
      var margin = reg.stdError * 1.96 * confidenceMultiplier;

      var lastDate = history[history.length - 1].date;
      var futureDate = new Date(lastDate.getFullYear(), lastDate.getMonth() + m, 1);

      projected.push({
        month: formatMonthLabel(futureDate),
        date: futureDate,
        predicted: Math.round(predicted),
        optimistic: Math.round(predicted + margin),
        pessimistic: Math.max(0, Math.round(predicted - margin))
      });
    }

    // Totals for 3, 6, 12 month horizons
    var totals = {};
    var horizons = [3, 6, 12];
    for (var h = 0; h < horizons.length; h++) {
      var horizon = horizons[h];
      var sumPredicted = 0, sumOpt = 0, sumPes = 0;
      var count = Math.min(horizon, projected.length);
      for (var k = 0; k < count; k++) {
        sumPredicted += projected[k].predicted;
        sumOpt       += projected[k].optimistic;
        sumPes       += projected[k].pessimistic;
      }
      totals[horizon] = {
        predicted:   sumPredicted,
        optimistic:  sumOpt,
        pessimistic: sumPes
      };
    }

    return { projected: projected, regression: reg, totals: totals };
  }

  // ─── Trend Analysis ──────────────────────────────────

  /**
   * Compute trend analysis from historical data.
   * @param {Array} history
   * @returns {Object}
   */
  function getTrendAnalysis(history) {
    if (!history || history.length < 2) {
      return { hasData: false, message: 'Need at least 2 months of data.' };
    }

    var xs = [];
    var ys = [];
    for (var i = 0; i < history.length; i++) {
      xs.push(i);
      ys.push(history[i].amount);
    }

    var reg = linearRegression(xs, ys);
    var mean = 0;
    for (var j = 0; j < ys.length; j++) mean += ys[j];
    mean /= ys.length;

    // Recent trend: last 3 vs previous 3
    var recentTrend = 'stable';
    if (history.length >= 6) {
      var recent3 = 0, prev3 = 0;
      for (var r = history.length - 3; r < history.length; r++) recent3 += history[r].amount;
      for (var p = history.length - 6; p < history.length - 3; p++) prev3 += history[p].amount;
      if (prev3 > 0) {
        var trendPct = ((recent3 - prev3) / prev3) * 100;
        if (trendPct > 10) recentTrend = 'accelerating';
        else if (trendPct > 0) recentTrend = 'growing';
        else if (trendPct > -10) recentTrend = 'slowing';
        else recentTrend = 'declining';
      }
    }

    return {
      hasData: true,
      dataPoints: history.length,
      monthlyAverage: Math.round(mean),
      overallTrend: reg.slope > 10 ? 'growing' : reg.slope < -10 ? 'declining' : 'stable',
      recentTrend: recentTrend,
      monthlyGrowthRate: mean > 0 ? Math.round((reg.slope / mean) * 10000) / 100 : 0,
      r2: Math.round(reg.r2 * 1000) / 1000
    };
  }

  // ─── Formatting Helpers ──────────────────────────────

  /**
   * Format a number as currency string.
   * @param {number} amount
   * @returns {string}
   */
  function formatCurrency(amount) {
    if (typeof amount !== 'number' || isNaN(amount)) return '$0';
    var parts = Math.abs(amount).toFixed(0).split('');
    var formatted = [];
    for (var i = parts.length - 1, c = 0; i >= 0; i--, c++) {
      if (c > 0 && c % 3 === 0) formatted.unshift(',');
      formatted.unshift(parts[i]);
    }
    return (amount < 0 ? '-$' : '$') + formatted.join('');
  }

  /**
   * Escape HTML entities.
   * @param {string} str
   * @returns {string}
   */
  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str || ''));
    return div.innerHTML;
  }

  // ─── Inline Styles ──────────────────────────────────

  /**
   * Inject scoped CSS styles into the document head.
   */
  function injectStyles() {
    if (document.getElementById('cf-earnings-projection-styles')) return;

    var css = [
      '.cf-ep-container {',
      '  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;',
      '  background: ' + COLORS.bg + ';',
      '  border-radius: 12px;',
      '  padding: 24px;',
      '  color: ' + COLORS.text + ';',
      '}',
      '.cf-ep-header {',
      '  display: flex;',
      '  align-items: center;',
      '  justify-content: space-between;',
      '  margin-bottom: 20px;',
      '  flex-wrap: wrap;',
      '  gap: 12px;',
      '}',
      '.cf-ep-title {',
      '  font-size: 20px;',
      '  font-weight: 700;',
      '  margin: 0;',
      '  color: ' + COLORS.text + ';',
      '}',
      '.cf-ep-subtitle {',
      '  font-size: 13px;',
      '  color: ' + COLORS.textMuted + ';',
      '  margin: 4px 0 0 0;',
      '}',
      '.cf-ep-cards {',
      '  display: grid;',
      '  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));',
      '  gap: 16px;',
      '  margin-bottom: 24px;',
      '}',
      '.cf-ep-card {',
      '  background: ' + COLORS.cardBg + ';',
      '  border: 1px solid ' + COLORS.border + ';',
      '  border-radius: 10px;',
      '  padding: 18px;',
      '  transition: box-shadow 0.2s ease;',
      '}',
      '.cf-ep-card:hover {',
      '  box-shadow: 0 4px 12px rgba(0,0,0,0.06);',
      '}',
      '.cf-ep-card-label {',
      '  font-size: 12px;',
      '  font-weight: 600;',
      '  text-transform: uppercase;',
      '  letter-spacing: 0.05em;',
      '  color: ' + COLORS.textMuted + ';',
      '  margin: 0 0 8px 0;',
      '}',
      '.cf-ep-card-value {',
      '  font-size: 24px;',
      '  font-weight: 700;',
      '  margin: 0 0 4px 0;',
      '  color: ' + COLORS.primary + ';',
      '}',
      '.cf-ep-card-range {',
      '  font-size: 12px;',
      '  color: ' + COLORS.textMuted + ';',
      '  margin: 0;',
      '}',
      '.cf-ep-card-range .optimistic { color: ' + COLORS.optimistic + '; font-weight: 600; }',
      '.cf-ep-card-range .pessimistic { color: ' + COLORS.pessimistic + '; font-weight: 600; }',
      '.cf-ep-chart-wrap {',
      '  background: ' + COLORS.cardBg + ';',
      '  border: 1px solid ' + COLORS.border + ';',
      '  border-radius: 10px;',
      '  padding: 20px;',
      '  overflow-x: auto;',
      '}',
      '.cf-ep-chart-title {',
      '  font-size: 14px;',
      '  font-weight: 600;',
      '  margin: 0 0 16px 0;',
      '  color: ' + COLORS.text + ';',
      '}',
      '.cf-ep-legend {',
      '  display: flex;',
      '  gap: 20px;',
      '  margin-top: 14px;',
      '  flex-wrap: wrap;',
      '}',
      '.cf-ep-legend-item {',
      '  display: flex;',
      '  align-items: center;',
      '  gap: 6px;',
      '  font-size: 12px;',
      '  color: ' + COLORS.textMuted + ';',
      '}',
      '.cf-ep-legend-swatch {',
      '  width: 14px;',
      '  height: 3px;',
      '  border-radius: 2px;',
      '}',
      '.cf-ep-legend-swatch--dashed {',
      '  background: repeating-linear-gradient(90deg, ' + COLORS.projected + ' 0, ' + COLORS.projected + ' 4px, transparent 4px, transparent 8px);',
      '}',
      '.cf-ep-regression-info {',
      '  margin-top: 16px;',
      '  padding: 12px 16px;',
      '  background: ' + COLORS.primaryLight + ';',
      '  border-radius: 8px;',
      '  font-size: 13px;',
      '  color: ' + COLORS.text + ';',
      '}',
      '.cf-ep-regression-info strong {',
      '  font-weight: 700;',
      '}',
      '.cf-ep-table-wrap {',
      '  margin-top: 16px;',
      '  overflow-x: auto;',
      '}',
      '.cf-ep-table {',
      '  width: 100%;',
      '  border-collapse: collapse;',
      '  font-size: 13px;',
      '}',
      '.cf-ep-table th {',
      '  text-align: left;',
      '  padding: 10px 12px;',
      '  font-weight: 600;',
      '  color: ' + COLORS.textMuted + ';',
      '  border-bottom: 2px solid ' + COLORS.border + ';',
      '  font-size: 11px;',
      '  text-transform: uppercase;',
      '  letter-spacing: 0.05em;',
      '}',
      '.cf-ep-table th:not(:first-child) { text-align: right; }',
      '.cf-ep-table td {',
      '  padding: 10px 12px;',
      '  border-bottom: 1px solid ' + COLORS.border + ';',
      '}',
      '.cf-ep-table td:not(:first-child) { text-align: right; font-variant-numeric: tabular-nums; }',
      '.cf-ep-table tr:last-child td { border-bottom: none; }',
      '.cf-ep-opt { color: ' + COLORS.optimistic + '; }',
      '.cf-ep-pes { color: ' + COLORS.pessimistic + '; }'
    ].join('\n');

    var style = document.createElement('style');
    style.id = 'cf-earnings-projection-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ─── SVG Chart Renderer ──────────────────────────────

  /**
   * Render the earnings projection chart as an inline SVG.
   * Draws historical data as a solid line, projected data as a dashed line,
   * and a shaded confidence band between optimistic and pessimistic bounds.
   * @param {Array} history
   * @param {Array} projected
   * @returns {string} HTML string containing the SVG element
   */
  function renderChart(history, projected) {
    var chartW = 780;
    var chartH = 320;
    var padTop = 30;
    var padBottom = 60;
    var padLeft = 65;
    var padRight = 30;
    var plotW = chartW - padLeft - padRight;
    var plotH = chartH - padTop - padBottom;

    // Combine all data points for axis calculation
    var allPoints = [];
    for (var i = 0; i < history.length; i++) {
      allPoints.push({
        label: history[i].month,
        value: history[i].amount,
        type: 'history'
      });
    }
    for (var j = 0; j < projected.length; j++) {
      allPoints.push({
        label: projected[j].month,
        value: projected[j].predicted,
        optimistic: projected[j].optimistic,
        pessimistic: projected[j].pessimistic,
        type: 'projected'
      });
    }

    var totalPoints = allPoints.length;

    // Compute value range across all series
    var allValues = [];
    for (var v = 0; v < allPoints.length; v++) {
      allValues.push(allPoints[v].value);
      if (allPoints[v].optimistic !== undefined) allValues.push(allPoints[v].optimistic);
      if (allPoints[v].pessimistic !== undefined) allValues.push(allPoints[v].pessimistic);
    }

    var maxVal = Math.max.apply(null, allValues);
    var minVal = Math.min.apply(null, allValues);
    var range = maxVal - minVal || 1;
    // Add 10% vertical padding
    maxVal = maxVal + range * 0.1;
    minVal = Math.max(0, minVal - range * 0.1);
    range = maxVal - minVal;

    function xPos(idx) {
      return padLeft + (idx / (totalPoints - 1)) * plotW;
    }

    function yPos(val) {
      return padTop + plotH - ((val - minVal) / range) * plotH;
    }

    var svg = [];
    svg.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + chartW + ' ' + chartH + '" style="width:100%;height:auto;max-width:' + chartW + 'px;" role="img" aria-label="Earnings projection line chart">');

    // Y-axis grid lines and labels
    var gridSteps = 5;
    for (var g = 0; g <= gridSteps; g++) {
      var gVal = minVal + (range / gridSteps) * g;
      var gy = yPos(gVal);
      svg.push('<line x1="' + padLeft + '" y1="' + gy + '" x2="' + (chartW - padRight) + '" y2="' + gy + '" stroke="' + COLORS.gridLine + '" stroke-width="1"/>');
      svg.push('<text x="' + (padLeft - 10) + '" y="' + (gy + 4) + '" text-anchor="end" font-size="11" fill="' + COLORS.textMuted + '" font-family="-apple-system,sans-serif">' + formatCurrency(Math.round(gVal)) + '</text>');
    }

    // Confidence band (filled polygon from last historical point through projected)
    var histLen = history.length;
    if (projected.length > 0) {
      var bandPath = 'M' + xPos(histLen - 1) + ',' + yPos(history[histLen - 1].amount);
      for (var b = 0; b < projected.length; b++) {
        bandPath += ' L' + xPos(histLen + b) + ',' + yPos(projected[b].optimistic);
      }
      for (var b2 = projected.length - 1; b2 >= 0; b2--) {
        bandPath += ' L' + xPos(histLen + b2) + ',' + yPos(projected[b2].pessimistic);
      }
      bandPath += ' L' + xPos(histLen - 1) + ',' + yPos(history[histLen - 1].amount) + ' Z';
      svg.push('<path d="' + bandPath + '" fill="' + COLORS.confidence + '" stroke="none"/>');

      // Optimistic bound (dashed, subtle)
      var optLine = 'M' + xPos(histLen - 1) + ',' + yPos(history[histLen - 1].amount);
      for (var o = 0; o < projected.length; o++) {
        optLine += ' L' + xPos(histLen + o) + ',' + yPos(projected[o].optimistic);
      }
      svg.push('<path d="' + optLine + '" fill="none" stroke="' + COLORS.confidenceLine + '" stroke-width="1.5" stroke-dasharray="4,4"/>');

      // Pessimistic bound (dashed, subtle)
      var pesLine = 'M' + xPos(histLen - 1) + ',' + yPos(history[histLen - 1].amount);
      for (var p = 0; p < projected.length; p++) {
        pesLine += ' L' + xPos(histLen + p) + ',' + yPos(projected[p].pessimistic);
      }
      svg.push('<path d="' + pesLine + '" fill="none" stroke="' + COLORS.confidenceLine + '" stroke-width="1.5" stroke-dasharray="4,4"/>');
    }

    // Historical line (solid)
    var histPath = '';
    for (var h = 0; h < histLen; h++) {
      var prefix = h === 0 ? 'M' : ' L';
      histPath += prefix + xPos(h) + ',' + yPos(history[h].amount);
    }
    svg.push('<path d="' + histPath + '" fill="none" stroke="' + COLORS.primary + '" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>');

    // Projected line (dashed) connected from last historical point
    if (projected.length > 0) {
      var projPath = 'M' + xPos(histLen - 1) + ',' + yPos(history[histLen - 1].amount);
      for (var pr = 0; pr < projected.length; pr++) {
        projPath += ' L' + xPos(histLen + pr) + ',' + yPos(projected[pr].predicted);
      }
      svg.push('<path d="' + projPath + '" fill="none" stroke="' + COLORS.projected + '" stroke-width="2.5" stroke-dasharray="8,5" stroke-linecap="round" stroke-linejoin="round"/>');
    }

    // Vertical divider between historical and projected zones
    if (projected.length > 0) {
      var divX = xPos(histLen - 1);
      svg.push('<line x1="' + divX + '" y1="' + padTop + '" x2="' + divX + '" y2="' + (chartH - padBottom) + '" stroke="' + COLORS.textMuted + '" stroke-width="1" stroke-dasharray="3,3" opacity="0.4"/>');
      svg.push('<text x="' + (divX + 6) + '" y="' + (padTop + 14) + '" font-size="10" fill="' + COLORS.textMuted + '" font-style="italic" font-family="-apple-system,sans-serif">Projected</text>');
      svg.push('<text x="' + (divX - 6) + '" y="' + (padTop + 14) + '" font-size="10" fill="' + COLORS.textMuted + '" text-anchor="end" font-style="italic" font-family="-apple-system,sans-serif">Historical</text>');
    }

    // Data point circles — historical
    for (var c = 0; c < histLen; c++) {
      svg.push('<circle cx="' + xPos(c) + '" cy="' + yPos(history[c].amount) + '" r="4" fill="' + COLORS.primary + '" stroke="#FFF" stroke-width="2"/>');
    }

    // Data point circles — projected
    for (var cp = 0; cp < projected.length; cp++) {
      svg.push('<circle cx="' + xPos(histLen + cp) + '" cy="' + yPos(projected[cp].predicted) + '" r="4" fill="' + COLORS.projected + '" stroke="#FFF" stroke-width="2"/>');
    }

    // X-axis labels (every Nth to avoid clutter)
    var labelInterval = totalPoints > 18 ? 4 : totalPoints > 12 ? 3 : totalPoints > 6 ? 2 : 1;
    for (var lbl = 0; lbl < totalPoints; lbl++) {
      if (lbl % labelInterval !== 0 && lbl !== totalPoints - 1 && lbl !== histLen - 1) continue;
      var lx = xPos(lbl);
      var labelText = allPoints[lbl].label;
      svg.push('<text x="' + lx + '" y="' + (chartH - padBottom + 20) + '" text-anchor="middle" font-size="10" fill="' + COLORS.textMuted + '" font-family="-apple-system,sans-serif" transform="rotate(-30,' + lx + ',' + (chartH - padBottom + 20) + ')">' + escapeHtml(labelText) + '</text>');
    }

    svg.push('</svg>');
    return svg.join('\n');
  }

  // ─── Summary Cards ───────────────────────────────────

  /**
   * Render summary projection cards for 3, 6, and 12 month horizons.
   * @param {Object} totals - Keyed by horizon (3, 6, 12)
   * @returns {string} HTML string
   */
  function renderCards(totals) {
    var horizons = [
      { key: 3,  label: 'Next 3 Months' },
      { key: 6,  label: 'Next 6 Months' },
      { key: 12, label: 'Next 12 Months' }
    ];

    var html = '<div class="cf-ep-cards">';
    for (var i = 0; i < horizons.length; i++) {
      var h = horizons[i];
      var t = totals[h.key];
      if (!t) continue;
      html += '<div class="cf-ep-card">';
      html += '<p class="cf-ep-card-label">' + escapeHtml(h.label) + '</p>';
      html += '<p class="cf-ep-card-value">' + formatCurrency(t.predicted) + '</p>';
      html += '<p class="cf-ep-card-range">';
      html += '<span class="pessimistic">' + formatCurrency(t.pessimistic) + '</span>';
      html += ' &ndash; ';
      html += '<span class="optimistic">' + formatCurrency(t.optimistic) + '</span>';
      html += '</p>';
      html += '</div>';
    }
    html += '</div>';
    return html;
  }

  // ─── Monthly Breakdown Table ─────────────────────────

  /**
   * Render a table showing per-month projected figures.
   * @param {Array} projected
   * @returns {string} HTML string
   */
  function renderProjectionTable(projected) {
    var html = '<div class="cf-ep-table-wrap">';
    html += '<table class="cf-ep-table">';
    html += '<thead><tr>';
    html += '<th>Month</th>';
    html += '<th>Pessimistic</th>';
    html += '<th>Expected</th>';
    html += '<th>Optimistic</th>';
    html += '</tr></thead><tbody>';

    for (var i = 0; i < projected.length; i++) {
      var p = projected[i];
      html += '<tr>';
      html += '<td>' + escapeHtml(p.month) + '</td>';
      html += '<td class="cf-ep-pes">' + formatCurrency(p.pessimistic) + '</td>';
      html += '<td style="font-weight:600">' + formatCurrency(p.predicted) + '</td>';
      html += '<td class="cf-ep-opt">' + formatCurrency(p.optimistic) + '</td>';
      html += '</tr>';
    }

    html += '</tbody></table></div>';
    return html;
  }

  // ─── Storage ─────────────────────────────────────────

  /**
   * Load historical earnings from localStorage.
   * @returns {Array|null}
   */
  function loadHistory() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      for (var i = 0; i < data.length; i++) {
        data[i].date = new Date(data[i].date);
      }
      return data;
    } catch (e) {
      console.warn('[EarningsProjection] Failed to load history:', e);
      return null;
    }
  }

  /**
   * Save historical earnings to localStorage.
   * @param {Array} history
   */
  function saveHistory(history) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch (e) {
      console.warn('[EarningsProjection] Failed to save history:', e);
    }
  }

  // ─── Main Render ─────────────────────────────────────

  /**
   * Initialize and render the full earnings projection dashboard
   * into the specified container element.
   * @param {string} containerId - DOM element ID to render into
   */
  function init(containerId) {
    injectStyles();

    var container = document.getElementById(containerId);
    if (!container) {
      console.error('[EarningsProjection] Container not found: #' + containerId);
      return;
    }

    // Load or generate mock historical data
    var history = loadHistory();
    if (!history || history.length === 0) {
      history = generateMockHistory();
      saveHistory(history);
    }

    // Run projection for 12 months (covers all three horizon cards)
    var result = projectEarnings(history, 12);
    var projected = result.projected;
    var totals = result.totals;
    var reg = result.regression;
    var trend = getTrendAnalysis(history);

    // Monthly trend direction
    var trendDir = reg.slope >= 0 ? 'upward' : 'downward';
    var trendAmount = formatCurrency(Math.abs(Math.round(reg.slope)));

    // Build complete HTML
    var html = [];
    html.push('<div class="cf-ep-container">');

    // Header
    html.push('<div class="cf-ep-header">');
    html.push('<div>');
    html.push('<h2 class="cf-ep-title">Earnings Projection</h2>');
    html.push('<p class="cf-ep-subtitle">Trend analysis based on ' + history.length + ' months of earnings data</p>');
    html.push('</div>');
    html.push('</div>');

    // Summary cards (3, 6, 12 month horizons)
    html.push(renderCards(totals));

    // Chart section
    html.push('<div class="cf-ep-chart-wrap">');
    html.push('<p class="cf-ep-chart-title">Historical &amp; Projected Earnings</p>');
    html.push(renderChart(history, projected));

    // Legend
    html.push('<div class="cf-ep-legend">');
    html.push('<div class="cf-ep-legend-item"><span class="cf-ep-legend-swatch" style="background:' + COLORS.primary + '"></span> Historical</div>');
    html.push('<div class="cf-ep-legend-item"><span class="cf-ep-legend-swatch cf-ep-legend-swatch--dashed"></span> Projected</div>');
    html.push('<div class="cf-ep-legend-item"><span class="cf-ep-legend-swatch" style="background:' + COLORS.confidence + ';height:10px;border:1px solid ' + COLORS.confidenceLine + '"></span> Confidence Band</div>');
    html.push('</div>');
    html.push('</div>');

    // Regression info bar
    html.push('<div class="cf-ep-regression-info">');
    html.push('<strong>Trend:</strong> ' + trendAmount + '/month ' + trendDir);
    html.push(' &middot; <strong>R&sup2;:</strong> ' + reg.r2.toFixed(3));
    html.push(' &middot; <strong>Std Error:</strong> ' + formatCurrency(Math.round(reg.stdError)));
    if (trend.hasData) {
      html.push(' &middot; <strong>Recent:</strong> ' + trend.recentTrend);
    }
    html.push('</div>');

    // Monthly breakdown table
    html.push(renderProjectionTable(projected));

    html.push('</div>');

    container.innerHTML = html.join('\n');

    console.log('[EarningsProjection] Module initialized in #' + containerId);
  }

  /**
   * Reset stored data so next init() regenerates mock history.
   */
  function reset() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      // Ignore
    }
  }

  // ─── Namespace Export ────────────────────────────────

  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.EarningsProjection = {
    init: init,
    reset: reset,
    generateMockHistory: generateMockHistory,
    projectEarnings: projectEarnings,
    linearRegression: linearRegression,
    getTrendAnalysis: getTrendAnalysis
  };
})();
