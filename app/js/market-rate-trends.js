/**
 * [CF-064] Market Rate Trends
 * Track hourly rate trends by Upwork category over time.
 * Show if rates are rising, falling, or stable with quarterly data.
 *
 * Exposed on window.CortexFreelancer.marketRateTrends
 */
(function () {
  'use strict';

  // ─── Historical Rate Data (median hourly USD by quarter) ────────────
  // Q1 2025 through Q1 2026 (5 quarters of data)
  var RATE_HISTORY = {
    'Web Development':       { 'Q1_2025': 47, 'Q2_2025': 48, 'Q3_2025': 48, 'Q4_2025': 49, 'Q1_2026': 50 },
    'Mobile Development':    { 'Q1_2025': 52, 'Q2_2025': 53, 'Q3_2025': 54, 'Q4_2025': 54, 'Q1_2026': 55 },
    'React':                 { 'Q1_2025': 50, 'Q2_2025': 51, 'Q3_2025': 52, 'Q4_2025': 54, 'Q1_2026': 55 },
    'Angular':               { 'Q1_2025': 52, 'Q2_2025': 51, 'Q3_2025': 51, 'Q4_2025': 50, 'Q1_2026': 50 },
    'Vue.js':                { 'Q1_2025': 45, 'Q2_2025': 46, 'Q3_2025': 46, 'Q4_2025': 47, 'Q1_2026': 48 },
    'Node.js':               { 'Q1_2025': 48, 'Q2_2025': 49, 'Q3_2025': 50, 'Q4_2025': 51, 'Q1_2026': 52 },
    'Python':                { 'Q1_2025': 50, 'Q2_2025': 52, 'Q3_2025': 53, 'Q4_2025': 54, 'Q1_2026': 55 },
    'Data Science':          { 'Q1_2025': 60, 'Q2_2025': 61, 'Q3_2025': 62, 'Q4_2025': 64, 'Q1_2026': 65 },
    'Machine Learning':      { 'Q1_2025': 62, 'Q2_2025': 64, 'Q3_2025': 66, 'Q4_2025': 68, 'Q1_2026': 70 },
    'AI/LLM':                { 'Q1_2025': 65, 'Q2_2025': 70, 'Q3_2025': 74, 'Q4_2025': 78, 'Q1_2026': 80 },
    'UI/UX Design':          { 'Q1_2025': 48, 'Q2_2025': 48, 'Q3_2025': 49, 'Q4_2025': 49, 'Q1_2026': 50 },
    'Graphic Design':        { 'Q1_2025': 40, 'Q2_2025': 40, 'Q3_2025': 40, 'Q4_2025': 40, 'Q1_2026': 40 },
    'WordPress':             { 'Q1_2025': 38, 'Q2_2025': 37, 'Q3_2025': 36, 'Q4_2025': 36, 'Q1_2026': 35 },
    'iOS Development':       { 'Q1_2025': 58, 'Q2_2025': 58, 'Q3_2025': 59, 'Q4_2025': 59, 'Q1_2026': 60 },
    'Android Development':   { 'Q1_2025': 53, 'Q2_2025': 53, 'Q3_2025': 54, 'Q4_2025': 54, 'Q1_2026': 55 },
    'DevOps':                { 'Q1_2025': 58, 'Q2_2025': 60, 'Q3_2025': 62, 'Q4_2025': 63, 'Q1_2026': 65 },
    'Cloud Architecture':    { 'Q1_2025': 62, 'Q2_2025': 64, 'Q3_2025': 66, 'Q4_2025': 68, 'Q1_2026': 70 },
    'Blockchain':            { 'Q1_2025': 82, 'Q2_2025': 80, 'Q3_2025': 78, 'Q4_2025': 76, 'Q1_2026': 75 },
    'Cybersecurity':         { 'Q1_2025': 58, 'Q2_2025': 60, 'Q3_2025': 62, 'Q4_2025': 63, 'Q1_2026': 65 },
    'QA Testing':            { 'Q1_2025': 34, 'Q2_2025': 34, 'Q3_2025': 35, 'Q4_2025': 35, 'Q1_2026': 35 },
    'Technical Writing':     { 'Q1_2025': 38, 'Q2_2025': 39, 'Q3_2025': 39, 'Q4_2025': 40, 'Q1_2026': 40 },
    'SEO':                   { 'Q1_2025': 38, 'Q2_2025': 38, 'Q3_2025': 38, 'Q4_2025': 38, 'Q1_2026': 38 },
    'Digital Marketing':     { 'Q1_2025': 40, 'Q2_2025': 41, 'Q3_2025': 41, 'Q4_2025': 42, 'Q1_2026': 42 },
    'Video Editing':         { 'Q1_2025': 34, 'Q2_2025': 35, 'Q3_2025': 36, 'Q4_2025': 37, 'Q1_2026': 38 },
    'Copywriting':           { 'Q1_2025': 42, 'Q2_2025': 42, 'Q3_2025': 42, 'Q4_2025': 42, 'Q1_2026': 42 },
    'Flutter':               { 'Q1_2025': 46, 'Q2_2025': 48, 'Q3_2025': 49, 'Q4_2025': 51, 'Q1_2026': 52 },
    'Rust/Go':               { 'Q1_2025': 55, 'Q2_2025': 58, 'Q3_2025': 60, 'Q4_2025': 62, 'Q1_2026': 65 }
  };

  var QUARTERS = ['Q1_2025', 'Q2_2025', 'Q3_2025', 'Q4_2025', 'Q1_2026'];

  // ─── Trend Helpers ──────────────────────────────────────────────────

  /**
   * Calculate linear regression slope from quarterly data.
   * @param {number[]} values
   * @returns {number} slope per quarter
   */
  function _slope(values) {
    var n = values.length;
    if (n < 2) return 0;
    var sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    for (var i = 0; i < n; i++) {
      sumX += i;
      sumY += values[i];
      sumXY += i * values[i];
      sumXX += i * i;
    }
    return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  }

  /**
   * Analyze trend for a set of rate values.
   * @param {number[]} values
   * @returns {{ direction: string, changePercent: number, velocity: number }}
   */
  function _analyzeTrend(values) {
    if (!values || values.length < 2) {
      return { direction: 'unknown', changePercent: 0, velocity: 0 };
    }
    var first = values[0];
    var last = values[values.length - 1];
    var changePercent = first > 0 ? Math.round(((last - first) / first) * 1000) / 10 : 0;
    var velocity = Math.round(_slope(values) * 100) / 100; // rate change per quarter

    var direction;
    if (changePercent > 3) direction = 'rising';
    else if (changePercent < -3) direction = 'falling';
    else direction = 'stable';

    return {
      direction: direction,
      changePercent: changePercent,
      velocity: velocity
    };
  }

  // ─── Public API ─────────────────────────────────────────────────────

  /**
   * Get rate trend for a single category.
   * @param {string} category
   * @returns {{ category: string, currentRate: number, history: Object, trend: { direction: string, changePercent: number, velocity: number } }|null}
   */
  function getRateTrend(category) {
    var hist = RATE_HISTORY[category];
    if (!hist) return null;

    var values = QUARTERS.map(function (q) { return hist[q]; });
    var trend = _analyzeTrend(values);

    return {
      category: category,
      currentRate: values[values.length - 1],
      history: hist,
      trend: trend
    };
  }

  /**
   * Get trends for all categories, sorted by change percent descending.
   * @returns {Array<Object>}
   */
  function getAllTrends() {
    var categories = Object.keys(RATE_HISTORY);
    var results = categories.map(function (c) { return getRateTrend(c); });
    results.sort(function (a, b) { return b.trend.changePercent - a.trend.changePercent; });
    return results;
  }

  /**
   * Predict future rate for a category using linear extrapolation.
   * @param {string} category
   * @param {number} monthsAhead - How many months into the future
   * @returns {{ category: string, currentRate: number, predictedRate: number, monthsAhead: number, confidence: string }|null}
   */
  function getPredictedRate(category, monthsAhead) {
    var hist = RATE_HISTORY[category];
    if (!hist) return null;

    monthsAhead = monthsAhead || 3;
    var values = QUARTERS.map(function (q) { return hist[q]; });
    var slopePerQuarter = _slope(values);
    var quartersAhead = monthsAhead / 3;
    var predicted = Math.round((values[values.length - 1] + slopePerQuarter * quartersAhead) * 100) / 100;

    // Confidence based on consistency of trend
    var diffs = [];
    for (var i = 1; i < values.length; i++) {
      diffs.push(values[i] - values[i - 1]);
    }
    var avgDiff = diffs.reduce(function (a, b) { return a + b; }, 0) / diffs.length;
    var variance = diffs.reduce(function (sum, d) { return sum + Math.pow(d - avgDiff, 2); }, 0) / diffs.length;
    var confidence = variance < 1 ? 'high' : variance < 4 ? 'medium' : 'low';

    return {
      category: category,
      currentRate: values[values.length - 1],
      predictedRate: Math.max(1, predicted),
      monthsAhead: monthsAhead,
      confidence: confidence
    };
  }

  /**
   * Compare trends across multiple categories side by side.
   * @param {string[]} categories
   * @returns {Array<Object>}
   */
  function getCategoryComparison(categories) {
    if (!categories || !categories.length) return [];
    return categories
      .map(function (c) { return getRateTrend(c); })
      .filter(function (r) { return r !== null; });
  }

  /**
   * Determine where a user's rate sits relative to the market trend.
   * @param {string} category
   * @param {number} userRate - User's hourly rate in USD
   * @returns {{ category: string, userRate: number, marketRate: number, difference: number, percentile: string, recommendation: string }|null}
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
    if (pct < -20 && trend.trend.direction === 'rising') {
      recommendation = 'Market rates are rising. You are significantly below market — consider gradual rate increases.';
    } else if (pct < -10) {
      recommendation = 'Below market rate. Increase your rate by $' + Math.abs(Math.round(diff)) + '/hr to match peers.';
    } else if (pct > 25) {
      recommendation = 'Premium pricing. Ensure your profile, portfolio, and JSS justify the premium.';
    } else if (pct > 10 && trend.trend.direction === 'falling') {
      recommendation = 'Above market in a declining category. Monitor client response and be flexible.';
    } else {
      recommendation = 'Well-positioned at market rate. Focus on quality and reviews to justify increases.';
    }

    return {
      category: category,
      userRate: userRate,
      marketRate: market,
      difference: diff,
      percentile: percentile,
      recommendation: recommendation
    };
  }

  // ─── Expose ─────────────────────────────────────────────────────────
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.marketRateTrends = {
    getRateTrend: getRateTrend,
    getAllTrends: getAllTrends,
    getPredictedRate: getPredictedRate,
    getCategoryComparison: getCategoryComparison,
    getUserRatePosition: getUserRatePosition
  };
})();
