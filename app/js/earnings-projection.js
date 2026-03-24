/**
 * [CF-055] Earnings Projection
 * Use historical data to project next 3/6/12 month earnings with
 * confidence intervals. Linear regression on monthly data with
 * seasonal adjustment and optimistic/expected/conservative bands.
 * Reads from localStorage 'cortex_earnings'.
 * Exposed on window.CortexFreelancer.earningsProjection
 */
(function () {
  'use strict';

  var EARNINGS_KEY = 'cortex_earnings';

  /* ── Storage Helpers ── */

  /**
   * Load earnings data from localStorage
   * @returns {Array}
   */
  function loadEarnings() {
    try {
      var raw = localStorage.getItem(EARNINGS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  /* ── Statistical Helpers ── */

  /**
   * Bucket earnings into monthly totals
   * @param {Array} earnings
   * @returns {Array<{key: string, year: number, month: number, total: number}>}
   */
  function bucketByMonth(earnings) {
    var buckets = {};
    for (var i = 0; i < earnings.length; i++) {
      var e = earnings[i];
      var d = new Date(e.date || e.createdAt || e.endDate);
      if (isNaN(d.getTime())) continue;
      var key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      if (!buckets[key]) {
        buckets[key] = { key: key, year: d.getFullYear(), month: d.getMonth() + 1, total: 0 };
      }
      buckets[key].total += e.amount || e.earnings || 0;
    }

    // Convert to sorted array
    var keys = Object.keys(buckets).sort();
    var result = [];
    for (var j = 0; j < keys.length; j++) {
      result.push(buckets[keys[j]]);
    }
    return result;
  }

  /**
   * Simple linear regression: y = slope * x + intercept
   * @param {number[]} xs
   * @param {number[]} ys
   * @returns {{slope: number, intercept: number, r2: number}}
   */
  function linearRegression(xs, ys) {
    var n = xs.length;
    if (n < 2) {
      return { slope: 0, intercept: ys.length > 0 ? ys[0] : 0, r2: 0 };
    }

    var sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
    for (var i = 0; i < n; i++) {
      sumX += xs[i];
      sumY += ys[i];
      sumXY += xs[i] * ys[i];
      sumX2 += xs[i] * xs[i];
      sumY2 += ys[i] * ys[i];
    }

    var denominator = n * sumX2 - sumX * sumX;
    if (denominator === 0) {
      return { slope: 0, intercept: sumY / n, r2: 0 };
    }

    var slope = (n * sumXY - sumX * sumY) / denominator;
    var intercept = (sumY - slope * sumX) / n;

    // R-squared
    var meanY = sumY / n;
    var ssRes = 0, ssTot = 0;
    for (var j = 0; j < n; j++) {
      var predicted = slope * xs[j] + intercept;
      ssRes += (ys[j] - predicted) * (ys[j] - predicted);
      ssTot += (ys[j] - meanY) * (ys[j] - meanY);
    }
    var r2 = ssTot > 0 ? 1 - (ssRes / ssTot) : 0;

    return { slope: slope, intercept: intercept, r2: Math.max(0, r2) };
  }

  /**
   * Calculate standard deviation
   * @param {number[]} values
   * @returns {number}
   */
  function stdDev(values) {
    if (values.length < 2) return 0;
    var mean = 0;
    for (var i = 0; i < values.length; i++) mean += values[i];
    mean /= values.length;
    var sumSq = 0;
    for (var j = 0; j < values.length; j++) {
      sumSq += (values[j] - mean) * (values[j] - mean);
    }
    return Math.sqrt(sumSq / (values.length - 1));
  }

  /**
   * Get percentile value from sorted array
   * @param {number[]} sorted
   * @param {number} percentile - 0 to 1
   * @returns {number}
   */
  function percentile(sorted, p) {
    if (sorted.length === 0) return 0;
    if (sorted.length === 1) return sorted[0];
    var idx = p * (sorted.length - 1);
    var lo = Math.floor(idx);
    var hi = Math.ceil(idx);
    if (lo === hi) return sorted[lo];
    var frac = idx - lo;
    return sorted[lo] * (1 - frac) + sorted[hi] * frac;
  }

  /* ── Core Functions ── */

  /**
   * Project earnings for the next N months
   * @param {number} [months=3] - Number of months to project (3, 6, or 12)
   * @returns {object} Projection with confidence intervals
   */
  function projectEarnings(months) {
    months = months || 3;
    var earnings = loadEarnings();
    var monthly = bucketByMonth(earnings);

    if (monthly.length < 2) {
      return {
        months: months,
        hasData: false,
        message: 'Need at least 2 months of earnings data for projections.',
        projections: [],
        summary: null
      };
    }

    // Build regression inputs (x = sequential month index, y = monthly total)
    var xs = [];
    var ys = [];
    for (var i = 0; i < monthly.length; i++) {
      xs.push(i);
      ys.push(monthly[i].total);
    }

    var reg = linearRegression(xs, ys);
    var sd = stdDev(ys);
    var seasonalFactors = computeSeasonalFactors(monthly);

    // Sort monthly totals for percentile calculation
    var sortedTotals = ys.slice().sort(function (a, b) { return a - b; });

    // Generate projections
    var projections = [];
    var lastIndex = xs.length - 1;
    var now = new Date();
    var totalOptimistic = 0, totalExpected = 0, totalConservative = 0;

    for (var m = 1; m <= months; m++) {
      var futureX = lastIndex + m;
      var baseProjection = Math.max(0, reg.slope * futureX + reg.intercept);

      // Apply seasonal factor
      var futureDate = new Date(now.getFullYear(), now.getMonth() + m, 1);
      var futureMonth = futureDate.getMonth() + 1;
      var seasonal = seasonalFactors[futureMonth] || 1.0;
      var adjusted = baseProjection * seasonal;

      // Confidence intervals using standard deviation
      var optimistic = Math.round(Math.max(0, adjusted + 0.675 * sd));   // ~75th percentile
      var expected = Math.round(Math.max(0, adjusted));                    // median/expected
      var conservative = Math.round(Math.max(0, adjusted - 0.675 * sd)); // ~25th percentile

      totalOptimistic += optimistic;
      totalExpected += expected;
      totalConservative += conservative;

      projections.push({
        monthIndex: m,
        label: futureDate.toLocaleString('en-US', { month: 'short', year: 'numeric' }),
        month: futureMonth,
        year: futureDate.getFullYear(),
        optimistic: optimistic,
        expected: expected,
        conservative: conservative,
        seasonalFactor: Math.round(seasonal * 100) / 100
      });
    }

    return {
      months: months,
      hasData: true,
      dataPoints: monthly.length,
      regression: {
        slope: Math.round(reg.slope * 100) / 100,
        intercept: Math.round(reg.intercept * 100) / 100,
        r2: Math.round(reg.r2 * 1000) / 1000,
        trendDirection: reg.slope > 0 ? 'growing' : reg.slope < 0 ? 'declining' : 'flat'
      },
      projections: projections,
      summary: {
        totalOptimistic: totalOptimistic,
        totalExpected: totalExpected,
        totalConservative: totalConservative,
        monthlyAvgOptimistic: Math.round(totalOptimistic / months),
        monthlyAvgExpected: Math.round(totalExpected / months),
        monthlyAvgConservative: Math.round(totalConservative / months)
      }
    };
  }

  /**
   * Analyze earnings trends
   * @returns {object} Trend analysis
   */
  function getTrendAnalysis() {
    var earnings = loadEarnings();
    var monthly = bucketByMonth(earnings);

    if (monthly.length < 2) {
      return {
        hasData: false,
        message: 'Need at least 2 months of data for trend analysis.'
      };
    }

    var xs = [];
    var ys = [];
    for (var i = 0; i < monthly.length; i++) {
      xs.push(i);
      ys.push(monthly[i].total);
    }

    var reg = linearRegression(xs, ys);
    var sd = stdDev(ys);
    var mean = 0;
    for (var j = 0; j < ys.length; j++) mean += ys[j];
    mean /= ys.length;

    // Month-over-month changes
    var changes = [];
    for (var k = 1; k < monthly.length; k++) {
      var prev = monthly[k - 1].total;
      var curr = monthly[k].total;
      var pctChange = prev > 0 ? Math.round(((curr - prev) / prev) * 100) : 0;
      changes.push({
        from: monthly[k - 1].key,
        to: monthly[k].key,
        change: Math.round((curr - prev) * 100) / 100,
        percentChange: pctChange
      });
    }

    // Recent trend (last 3 months vs previous 3)
    var recentTrend = 'stable';
    if (monthly.length >= 6) {
      var recent3 = 0, prev3 = 0;
      for (var r = monthly.length - 3; r < monthly.length; r++) recent3 += monthly[r].total;
      for (var p = monthly.length - 6; p < monthly.length - 3; p++) prev3 += monthly[p].total;
      if (prev3 > 0) {
        var trendPct = ((recent3 - prev3) / prev3) * 100;
        if (trendPct > 10) recentTrend = 'accelerating';
        else if (trendPct > 0) recentTrend = 'growing';
        else if (trendPct > -10) recentTrend = 'slowing';
        else recentTrend = 'declining';
      }
    }

    // Best and worst months
    var best = monthly[0], worst = monthly[0];
    for (var b = 1; b < monthly.length; b++) {
      if (monthly[b].total > best.total) best = monthly[b];
      if (monthly[b].total < worst.total) worst = monthly[b];
    }

    return {
      hasData: true,
      dataPoints: monthly.length,
      monthlyAverage: Math.round(mean * 100) / 100,
      monthlyStdDev: Math.round(sd * 100) / 100,
      volatility: mean > 0 ? Math.round((sd / mean) * 100) : 0,
      overallTrend: reg.slope > 10 ? 'growing' : reg.slope < -10 ? 'declining' : 'stable',
      recentTrend: recentTrend,
      monthlyGrowthRate: mean > 0 ? Math.round((reg.slope / mean) * 10000) / 100 : 0,
      r2: Math.round(reg.r2 * 1000) / 1000,
      bestMonth: { key: best.key, total: Math.round(best.total * 100) / 100 },
      worstMonth: { key: worst.key, total: Math.round(worst.total * 100) / 100 },
      changes: changes,
      monthlyData: monthly.map(function (m) {
        return { key: m.key, total: Math.round(m.total * 100) / 100 };
      })
    };
  }

  /**
   * Compute seasonal factors from historical monthly data
   * Returns multipliers for each calendar month (1-12)
   * @param {Array} [monthlyData] - Pre-computed monthly buckets, or loads from storage
   * @returns {object} Seasonal factors keyed by month (1-12)
   */
  function computeSeasonalFactors(monthlyData) {
    var monthly = monthlyData || bucketByMonth(loadEarnings());

    // Default: no seasonal effect
    var factors = {};
    for (var m = 1; m <= 12; m++) factors[m] = 1.0;

    if (monthly.length < 6) return factors;

    // Calculate overall average
    var totalSum = 0;
    for (var i = 0; i < monthly.length; i++) totalSum += monthly[i].total;
    var overallAvg = totalSum / monthly.length;
    if (overallAvg === 0) return factors;

    // Average by calendar month
    var monthSums = {};
    var monthCounts = {};
    for (var j = 0; j < monthly.length; j++) {
      var cm = monthly[j].month;
      monthSums[cm] = (monthSums[cm] || 0) + monthly[j].total;
      monthCounts[cm] = (monthCounts[cm] || 0) + 1;
    }

    for (var k = 1; k <= 12; k++) {
      if (monthCounts[k] && monthCounts[k] > 0) {
        var monthAvg = monthSums[k] / monthCounts[k];
        // Clamp factor between 0.5 and 2.0 to avoid extreme swings
        factors[k] = Math.max(0.5, Math.min(2.0, monthAvg / overallAvg));
        factors[k] = Math.round(factors[k] * 100) / 100;
      }
    }

    return factors;
  }

  /**
   * Get seasonal factors (public wrapper)
   * @returns {object} Factors and analysis
   */
  function getSeasonalFactors() {
    var factors = computeSeasonalFactors();

    // Find strongest and weakest months
    var strongest = { month: 1, factor: 0 };
    var weakest = { month: 1, factor: Infinity };
    var monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    for (var m = 1; m <= 12; m++) {
      if (factors[m] > strongest.factor) {
        strongest = { month: m, factor: factors[m] };
      }
      if (factors[m] < weakest.factor) {
        weakest = { month: m, factor: factors[m] };
      }
    }

    // Build readable output
    var breakdown = [];
    for (var n = 1; n <= 12; n++) {
      breakdown.push({
        month: n,
        name: monthNames[n],
        factor: factors[n],
        label: factors[n] > 1.05 ? 'above average'
          : factors[n] < 0.95 ? 'below average'
            : 'average'
      });
    }

    return {
      factors: factors,
      breakdown: breakdown,
      strongestMonth: { name: monthNames[strongest.month], factor: strongest.factor },
      weakestMonth: { name: monthNames[weakest.month], factor: weakest.factor },
      hasSeasonality: strongest.factor - weakest.factor > 0.2
    };
  }

  /* ── Chart Rendering ── */

  /**
   * Render projection chart with confidence bands on a canvas.
   * Shows historical monthly data + projected months with
   * optimistic/expected/conservative bands.
   * @param {string} containerId - DOM element id
   * @param {number} [months=6] - Months to project
   */
  function renderProjectionChart(containerId, months) {
    var container = document.getElementById(containerId);
    if (!container) return;

    months = months || 6;
    var earnings = loadEarnings();
    var monthly = bucketByMonth(earnings);
    var projection = projectEarnings(months);

    if (!projection.hasData || monthly.length < 2) {
      container.innerHTML = '<p style="color:#71717a;text-align:center;font-family:-apple-system,sans-serif">Need at least 2 months of data for projection chart.</p>';
      return;
    }

    var width = container.offsetWidth || 700;
    var height = 320;
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

    // Combine historical + projected values for scale
    var allValues = monthly.map(function (m) { return m.total; });
    for (var p = 0; p < projection.projections.length; p++) {
      allValues.push(projection.projections[p].optimistic);
    }
    var max = Math.max.apply(null, allValues) || 1;
    var mag = Math.pow(10, Math.floor(Math.log10(max)));
    var niceMax = Math.ceil(max / mag) * mag || 1;

    var totalPoints = monthly.length + projection.projections.length;
    var stepX = chartW / Math.max(totalPoints - 1, 1);

    function toX(i) { return pad.left + i * stepX; }
    function toY(v) { return pad.top + chartH - (v / niceMax) * chartH; }

    // Background
    ctx.fillStyle = '#18181b';
    ctx.fillRect(0, 0, width, height);

    // Title
    ctx.fillStyle = '#e4e4e7';
    ctx.font = 'bold 14px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Earnings Projection (' + months + ' months)', width / 2, 24);

    // Y-axis grid
    ctx.font = '11px -apple-system, sans-serif';
    ctx.textAlign = 'right';
    for (var g = 0; g <= 5; g++) {
      var yVal = (niceMax / 5) * g;
      var y = toY(yVal);
      ctx.strokeStyle = '#27272a';
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(width - pad.right, y);
      ctx.stroke();
      ctx.fillStyle = '#71717a';
      var label = yVal >= 1000 ? '$' + (yVal / 1000).toFixed(1) + 'K' : '$' + Math.round(yVal);
      ctx.fillText(label, pad.left - 8, y + 4);
    }

    // Divider line between historical and projected
    var divX = toX(monthly.length - 0.5);
    ctx.strokeStyle = '#3f3f46';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(divX, pad.top);
    ctx.lineTo(divX, pad.top + chartH);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#71717a';
    ctx.font = '10px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Projected', divX + 40, pad.top + 14);

    // Confidence band (optimistic to conservative)
    var projStart = monthly.length;
    ctx.beginPath();
    // Upper band (optimistic)
    ctx.moveTo(toX(projStart), toY(projection.projections[0].optimistic));
    for (var o = 0; o < projection.projections.length; o++) {
      ctx.lineTo(toX(projStart + o), toY(projection.projections[o].optimistic));
    }
    // Lower band (conservative) — reversed
    for (var c = projection.projections.length - 1; c >= 0; c--) {
      ctx.lineTo(toX(projStart + c), toY(projection.projections[c].conservative));
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(99, 102, 241, 0.15)';
    ctx.fill();

    // Historical line
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (var h = 0; h < monthly.length; h++) {
      var hx = toX(h);
      var hy = toY(monthly[h].total);
      if (h === 0) ctx.moveTo(hx, hy);
      else ctx.lineTo(hx, hy);
    }
    ctx.stroke();

    // Historical dots
    for (var d = 0; d < monthly.length; d++) {
      ctx.beginPath();
      ctx.arc(toX(d), toY(monthly[d].total), 3, 0, 2 * Math.PI);
      ctx.fillStyle = '#6366f1';
      ctx.fill();
    }

    // Expected projection line
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 3]);
    ctx.beginPath();
    // Connect from last historical point
    ctx.moveTo(toX(monthly.length - 1), toY(monthly[monthly.length - 1].total));
    for (var e = 0; e < projection.projections.length; e++) {
      ctx.lineTo(toX(projStart + e), toY(projection.projections[e].expected));
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // X-axis labels
    ctx.font = '9px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#a1a1aa';
    for (var xl = 0; xl < monthly.length; xl++) {
      if (monthly.length <= 12 || xl % 2 === 0) {
        ctx.fillText(monthly[xl].key.slice(2), toX(xl), pad.top + chartH + 16);
      }
    }
    ctx.fillStyle = '#22c55e';
    for (var pl = 0; pl < projection.projections.length; pl++) {
      ctx.fillText(projection.projections[pl].label, toX(projStart + pl), pad.top + chartH + 16);
    }

    // Legend
    ctx.font = '10px -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#6366f1';
    ctx.fillRect(pad.left + 4, pad.top + 4, 10, 3);
    ctx.fillStyle = '#a1a1aa';
    ctx.fillText('Historical', pad.left + 18, pad.top + 10);
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(pad.left + 84, pad.top + 4, 10, 3);
    ctx.fillStyle = '#a1a1aa';
    ctx.fillText('Expected', pad.left + 98, pad.top + 10);
  }

  /**
   * Render a full projection dashboard with summary + chart.
   * @param {string} containerId - DOM element id
   * @param {number} [months=6]
   */
  function renderProjectionDashboard(containerId, months) {
    var container = document.getElementById(containerId);
    if (!container) return;

    months = months || 6;
    var projection = projectEarnings(months);
    var trend = getTrendAnalysis();

    if (!projection.hasData) {
      container.innerHTML = '<p style="color:#71717a;text-align:center;font-family:-apple-system,sans-serif">' + projection.message + '</p>';
      return;
    }

    var reg = projection.regression;
    var sum = projection.summary;
    var trendColor = reg.trendDirection === 'growing' ? '#22c55e' : reg.trendDirection === 'declining' ? '#ef4444' : '#f59e0b';

    var html = '<div style="font-family:-apple-system,sans-serif;color:#e4e4e7">';
    html += '<div style="margin-bottom:20px"><h2 style="margin:0;font-size:20px;font-weight:700;color:#f4f4f5">Earnings Projection</h2>';
    html += '<p style="margin:4px 0 0;font-size:13px;color:#71717a">' + months + '-month forecast with confidence intervals</p></div>';

    // Summary cards
    html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px">';
    html += '<div style="background:#18181b;border-radius:12px;padding:16px">';
    html += '<div style="font-size:12px;color:#71717a">Expected Total</div>';
    html += '<div style="font-size:20px;font-weight:700;color:#f4f4f5">$' + sum.totalExpected.toLocaleString() + '</div></div>';
    html += '<div style="background:#18181b;border-radius:12px;padding:16px">';
    html += '<div style="font-size:12px;color:#71717a">Monthly Avg</div>';
    html += '<div style="font-size:20px;font-weight:700;color:#f4f4f5">$' + sum.monthlyAvgExpected.toLocaleString() + '</div></div>';
    html += '<div style="background:#18181b;border-radius:12px;padding:16px">';
    html += '<div style="font-size:12px;color:#71717a">Trend</div>';
    html += '<div style="font-size:20px;font-weight:700;color:' + trendColor + '">' + reg.trendDirection.charAt(0).toUpperCase() + reg.trendDirection.slice(1) + '</div></div>';
    html += '<div style="background:#18181b;border-radius:12px;padding:16px">';
    html += '<div style="font-size:12px;color:#71717a">Confidence (R\u00B2)</div>';
    html += '<div style="font-size:20px;font-weight:700;color:#f4f4f5">' + (reg.r2 * 100).toFixed(1) + '%</div></div>';
    html += '</div>';

    // Chart container
    html += '<div id="' + containerId + '_chart"></div>';

    // Projection table
    html += '<div style="background:#18181b;border-radius:12px;padding:16px;margin-top:16px">';
    html += '<table style="width:100%;border-collapse:collapse;font-size:13px">';
    html += '<thead><tr style="border-bottom:1px solid #27272a">';
    html += '<th style="text-align:left;padding:8px;color:#71717a">Month</th>';
    html += '<th style="text-align:right;padding:8px;color:#71717a">Conservative</th>';
    html += '<th style="text-align:right;padding:8px;color:#71717a">Expected</th>';
    html += '<th style="text-align:right;padding:8px;color:#71717a">Optimistic</th>';
    html += '</tr></thead><tbody>';

    for (var i = 0; i < projection.projections.length; i++) {
      var pr = projection.projections[i];
      html += '<tr style="border-bottom:1px solid #1c1c1e">';
      html += '<td style="padding:8px;color:#d4d4d8">' + pr.label + '</td>';
      html += '<td style="padding:8px;text-align:right;color:#ef4444">$' + pr.conservative.toLocaleString() + '</td>';
      html += '<td style="padding:8px;text-align:right;color:#22c55e;font-weight:600">$' + pr.expected.toLocaleString() + '</td>';
      html += '<td style="padding:8px;text-align:right;color:#6366f1">$' + pr.optimistic.toLocaleString() + '</td>';
      html += '</tr>';
    }
    html += '</tbody></table></div>';
    html += '</div>';

    container.innerHTML = html;
    renderProjectionChart(containerId + '_chart', months);
  }

  /* ── Public API ── */
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.earningsProjection = {
    projectEarnings: projectEarnings,
    getTrendAnalysis: getTrendAnalysis,
    getSeasonalFactors: getSeasonalFactors,
    renderProjectionChart: renderProjectionChart,
    renderProjectionDashboard: renderProjectionDashboard
  };
})();
