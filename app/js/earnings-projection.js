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

  /* ── Public API ── */
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.earningsProjection = {
    projectEarnings: projectEarnings,
    getTrendAnalysis: getTrendAnalysis,
    getSeasonalFactors: getSeasonalFactors
  };
})();
