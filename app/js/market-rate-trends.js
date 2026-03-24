/**
 * [CF-064] Market Rate Trend Tracker
 * Track hourly rate trends by category over time, show if rates rising/falling.
 * Mock data, render chart-ready arrays.
 *
 * Exposed on window.CortexFreelancer.marketRateTrends
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  // ─── Monthly Historical Rate Data (median hourly USD) ─────────────
  // 12 months of data: Apr 2025 → Mar 2026
  var MONTHS = [
    '2025-04','2025-05','2025-06','2025-07','2025-08','2025-09',
    '2025-10','2025-11','2025-12','2026-01','2026-02','2026-03'
  ];

  var RATE_HISTORY = {
    'Web Development':       [47,47,48,48,48,49,49,49,50,50,50,51],
    'Mobile Development':    [52,52,53,53,54,54,54,55,55,55,56,56],
    'React':                 [50,50,51,52,52,53,53,54,54,55,55,56],
    'Angular':               [52,52,51,51,51,51,50,50,50,50,49,49],
    'Vue.js':                [45,45,46,46,46,47,47,47,48,48,48,49],
    'Node.js':               [48,48,49,49,50,50,51,51,51,52,52,53],
    'Python':                [50,51,52,52,53,53,54,54,54,55,55,56],
    'Data Science':          [60,60,61,61,62,62,63,64,64,65,65,66],
    'Machine Learning':      [62,63,64,65,66,66,67,68,68,70,71,72],
    'AI/LLM':                [65,67,70,72,74,75,77,78,79,80,82,85],
    'UI/UX Design':          [48,48,48,49,49,49,49,50,50,50,50,51],
    'Graphic Design':        [40,40,40,40,40,40,40,40,40,40,40,40],
    'WordPress':             [38,38,37,37,37,36,36,36,36,35,35,34],
    'iOS Development':       [58,58,58,59,59,59,59,60,60,60,60,61],
    'Android Development':   [53,53,53,54,54,54,54,55,55,55,55,56],
    'DevOps':                [58,59,60,60,61,62,62,63,63,65,65,66],
    'Cloud Architecture':    [62,63,64,65,66,66,67,68,69,70,71,72],
    'Blockchain':            [82,81,80,79,78,78,77,76,76,75,74,73],
    'Cybersecurity':         [58,59,60,60,61,62,62,63,64,65,66,67],
    'QA Testing':            [34,34,34,35,35,35,35,35,35,35,35,36],
    'Technical Writing':     [38,38,39,39,39,39,40,40,40,40,40,41],
    'SEO':                   [38,38,38,38,38,38,38,38,38,38,38,38],
    'Digital Marketing':     [40,40,41,41,41,41,42,42,42,42,42,43],
    'Video Editing':         [34,34,35,35,36,36,36,37,37,38,38,39],
    'Copywriting':           [42,42,42,42,42,42,42,42,42,42,42,42],
    'Flutter':               [46,47,48,48,49,49,50,51,51,52,52,53],
    'Rust/Go':               [55,56,58,59,60,60,61,62,63,65,66,68],
    'Solidity':              [75,74,73,72,71,70,69,68,67,66,65,64],
    'Prompt Engineering':    [45,48,50,53,55,58,60,62,65,68,70,72],
    'Data Engineering':      [55,56,57,57,58,58,59,60,60,62,63,64]
  };

  // ─── Percentile bands (p25, p50, p75) multipliers ─────────────────
  var PERCENTILE_BANDS = { p25: 0.75, p50: 1.0, p75: 1.35 };

  // ─── Trend Calculation ────────────────────────────────────────────

  /**
   * Linear regression slope.
   */
  function _slope(values) {
    var n = values.length;
    if (n < 2) return 0;
    var sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    for (var i = 0; i < n; i++) {
      sumX += i; sumY += values[i]; sumXY += i * values[i]; sumXX += i * i;
    }
    return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  }

  /**
   * R-squared for trend consistency.
   */
  function _rSquared(values) {
    var n = values.length;
    if (n < 3) return 1;
    var mean = values.reduce(function (a, b) { return a + b; }, 0) / n;
    var slope = _slope(values);
    var intercept = mean - slope * (n - 1) / 2;
    var ssRes = 0, ssTot = 0;
    for (var i = 0; i < n; i++) {
      var predicted = intercept + slope * i;
      ssRes += Math.pow(values[i] - predicted, 2);
      ssTot += Math.pow(values[i] - mean, 2);
    }
    return ssTot === 0 ? 1 : 1 - ssRes / ssTot;
  }

  /**
   * Classify trend direction.
   */
  function _classifyTrend(changePercent, recentSlope) {
    if (changePercent > 8) return 'surging';
    if (changePercent > 3) return 'rising';
    if (changePercent > 0.5 && recentSlope > 0) return 'slightly_rising';
    if (changePercent < -8) return 'plummeting';
    if (changePercent < -3) return 'falling';
    if (changePercent < -0.5 && recentSlope < 0) return 'slightly_falling';
    return 'stable';
  }

  /**
   * Analyze trend for a category.
   */
  function _analyzeTrend(values) {
    if (!values || values.length < 2) {
      return { direction: 'unknown', changePercent: 0, velocity: 0, r2: 0, momentum: 'unknown' };
    }
    var first = values[0];
    var last = values[values.length - 1];
    var changePercent = first > 0 ? Math.round(((last - first) / first) * 1000) / 10 : 0;
    var velocity = Math.round(_slope(values) * 100) / 100;
    var r2 = Math.round(_rSquared(values) * 100) / 100;

    // Recent momentum (last 3 months vs prior 3)
    var recentSlope = values.length >= 6
      ? _slope(values.slice(-3)) - _slope(values.slice(-6, -3))
      : 0;
    var momentum = recentSlope > 0.3 ? 'accelerating' : recentSlope < -0.3 ? 'decelerating' : 'steady';
    var direction = _classifyTrend(changePercent, _slope(values.slice(-3)));

    return { direction: direction, changePercent: changePercent, velocity: velocity, r2: r2, momentum: momentum };
  }

  // ─── Chart-Ready Helpers ──────────────────────────────────────────

  /**
   * Get chart-ready time series for a category.
   * Returns { labels: string[], datasets: { p25: number[], median: number[], p75: number[] } }
   */
  function getChartData(category) {
    var hist = RATE_HISTORY[category];
    if (!hist) return null;
    return {
      labels: MONTHS.slice(),
      datasets: {
        p25: hist.map(function (v) { return Math.round(v * PERCENTILE_BANDS.p25); }),
        median: hist.slice(),
        p75: hist.map(function (v) { return Math.round(v * PERCENTILE_BANDS.p75); })
      }
    };
  }

  /**
   * Get multi-category comparison chart data.
   * Returns { labels: string[], series: { [category]: number[] } }
   */
  function getComparisonChartData(categories) {
    var series = {};
    (categories || []).forEach(function (c) {
      if (RATE_HISTORY[c]) series[c] = RATE_HISTORY[c].slice();
    });
    return { labels: MONTHS.slice(), series: series };
  }

  /**
   * Get sparkline-ready array (normalized 0-1) for a category.
   */
  function getSparkline(category) {
    var hist = RATE_HISTORY[category];
    if (!hist) return null;
    var min = Math.min.apply(null, hist);
    var max = Math.max.apply(null, hist);
    var range = max - min || 1;
    return hist.map(function (v) { return Math.round(((v - min) / range) * 100) / 100; });
  }

  // ─── Public API ───────────────────────────────────────────────────

  /**
   * Get full trend analysis for a single category.
   */
  function getRateTrend(category) {
    var hist = RATE_HISTORY[category];
    if (!hist) return null;
    var trend = _analyzeTrend(hist);
    return {
      category: category,
      currentRate: hist[hist.length - 1],
      previousRate: hist[hist.length - 2],
      monthOverMonth: hist.length >= 2
        ? Math.round(((hist[hist.length - 1] - hist[hist.length - 2]) / hist[hist.length - 2]) * 1000) / 10
        : 0,
      history: (function () { var o = {}; MONTHS.forEach(function (m, i) { o[m] = hist[i]; }); return o; })(),
      trend: trend
    };
  }

  /**
   * Get trends for all categories sorted by change percent descending.
   */
  function getAllTrends() {
    return Object.keys(RATE_HISTORY)
      .map(function (c) { return getRateTrend(c); })
      .sort(function (a, b) { return b.trend.changePercent - a.trend.changePercent; });
  }

  /**
   * Get only rising or falling categories.
   */
  function getHotCategories(direction) {
    direction = direction || 'rising';
    return getAllTrends().filter(function (t) {
      if (direction === 'rising') return t.trend.direction === 'rising' || t.trend.direction === 'surging';
      if (direction === 'falling') return t.trend.direction === 'falling' || t.trend.direction === 'plummeting';
      return t.trend.direction === direction;
    });
  }

  /**
   * Predict future rate using linear extrapolation.
   */
  function getPredictedRate(category, monthsAhead) {
    var hist = RATE_HISTORY[category];
    if (!hist) return null;
    monthsAhead = monthsAhead || 3;
    var slopePerMonth = _slope(hist);
    var predicted = Math.round((hist[hist.length - 1] + slopePerMonth * monthsAhead) * 100) / 100;
    var r2 = _rSquared(hist);
    var confidence = r2 > 0.9 ? 'high' : r2 > 0.7 ? 'medium' : 'low';

    return {
      category: category,
      currentRate: hist[hist.length - 1],
      predictedRate: Math.max(1, predicted),
      monthsAhead: monthsAhead,
      confidence: confidence,
      r2: Math.round(r2 * 100) / 100
    };
  }

  /**
   * Compare trends across categories side by side.
   */
  function getCategoryComparison(categories) {
    if (!categories || !categories.length) return [];
    return categories.map(function (c) { return getRateTrend(c); }).filter(Boolean);
  }

  /**
   * Determine where a user's rate sits relative to market.
   */
  function getUserRatePosition(category, userRate) {
    var trend = getRateTrend(category);
    if (!trend || !userRate) return null;
    var market = trend.currentRate;
    var diff = userRate - market;
    var pct = Math.round((diff / market) * 100);

    var percentile;
    if (pct >= 30) percentile = 'premium (top 10%)';
    else if (pct >= 10) percentile = 'above average (top 30%)';
    else if (pct >= -10) percentile = 'market rate (middle 40%)';
    else if (pct >= -25) percentile = 'below average (bottom 30%)';
    else percentile = 'budget tier (bottom 10%)';

    var recommendation;
    if (pct < -20 && (trend.trend.direction === 'rising' || trend.trend.direction === 'surging')) {
      recommendation = 'Market rates are rising fast. You are significantly below — raise your rate by $' + Math.abs(Math.round(diff * 0.5)) + '-' + Math.abs(Math.round(diff)) + '/hr over the next 2-3 months.';
    } else if (pct < -10) {
      recommendation = 'Below market rate. Increase by $' + Math.abs(Math.round(diff)) + '/hr to match peers.';
    } else if (pct > 25) {
      recommendation = 'Premium pricing. Ensure your profile, portfolio, and JSS justify the premium.';
    } else if (pct > 10 && (trend.trend.direction === 'falling' || trend.trend.direction === 'plummeting')) {
      recommendation = 'Above market in a declining category. Monitor win rate and consider diversifying.';
    } else {
      recommendation = 'Well-positioned at market rate. Focus on reviews and portfolio to justify future increases.';
    }

    return {
      category: category,
      userRate: userRate,
      marketRate: market,
      difference: diff,
      percentDiff: pct,
      percentile: percentile,
      recommendation: recommendation,
      trend: trend.trend
    };
  }

  /**
   * Generate rate change alert if significant movement detected.
   */
  function getRateAlerts(threshold) {
    threshold = threshold || 3;
    return getAllTrends().filter(function (t) {
      return Math.abs(t.monthOverMonth) >= threshold;
    }).map(function (t) {
      return {
        category: t.category,
        alert: t.monthOverMonth > 0 ? 'rate_increase' : 'rate_decrease',
        monthOverMonth: t.monthOverMonth,
        currentRate: t.currentRate,
        direction: t.trend.direction,
        message: t.category + ' rates ' + (t.monthOverMonth > 0 ? 'rose' : 'dropped') +
          ' ' + Math.abs(t.monthOverMonth) + '% this month ($' + t.currentRate + '/hr)'
      };
    });
  }

  /**
   * Get available categories.
   */
  function getCategories() {
    return Object.keys(RATE_HISTORY);
  }

  // ─── Expose ───────────────────────────────────────────────────────
  window.CortexFreelancer.marketRateTrends = {
    getRateTrend: getRateTrend,
    getAllTrends: getAllTrends,
    getHotCategories: getHotCategories,
    getPredictedRate: getPredictedRate,
    getCategoryComparison: getCategoryComparison,
    getUserRatePosition: getUserRatePosition,
    getRateAlerts: getRateAlerts,
    getCategories: getCategories,
    // Chart-ready
    getChartData: getChartData,
    getComparisonChartData: getComparisonChartData,
    getSparkline: getSparkline
  };
})();
