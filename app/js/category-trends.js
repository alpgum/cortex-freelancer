/**
 * [CF-023] Job Category Trend Analysis
 *
 * IIFE exposing window.CortexCategoryTrends
 * Shows which job categories are growing/shrinking in volume and avg budget
 * over the last 90 days. Uses hardcoded trend data (no API dependency).
 */
(function () {
  'use strict';

  // ─── Hardcoded 90-day trend data ────────────────────────────────
  // Each category has weekly snapshots (13 weeks ≈ 90 days).
  // volume = job postings that week, avgBudget = average $ per posting.

  var TREND_DATA = {
    'web-development': {
      label: 'Web Development',
      weeks: [
        { volume: 4200, avgBudget: 1800 },
        { volume: 4350, avgBudget: 1820 },
        { volume: 4100, avgBudget: 1790 },
        { volume: 4500, avgBudget: 1850 },
        { volume: 4600, avgBudget: 1900 },
        { volume: 4550, avgBudget: 1880 },
        { volume: 4700, avgBudget: 1920 },
        { volume: 4800, avgBudget: 1950 },
        { volume: 4650, avgBudget: 1910 },
        { volume: 4900, avgBudget: 1980 },
        { volume: 5100, avgBudget: 2020 },
        { volume: 5050, avgBudget: 2000 },
        { volume: 5200, avgBudget: 2050 }
      ]
    },
    'mobile-development': {
      label: 'Mobile Development',
      weeks: [
        { volume: 1800, avgBudget: 2200 },
        { volume: 1850, avgBudget: 2250 },
        { volume: 1900, avgBudget: 2300 },
        { volume: 1950, avgBudget: 2280 },
        { volume: 2000, avgBudget: 2350 },
        { volume: 2050, avgBudget: 2400 },
        { volume: 2100, avgBudget: 2380 },
        { volume: 2150, avgBudget: 2450 },
        { volume: 2200, avgBudget: 2500 },
        { volume: 2250, avgBudget: 2480 },
        { volume: 2300, avgBudget: 2550 },
        { volume: 2350, avgBudget: 2600 },
        { volume: 2400, avgBudget: 2650 }
      ]
    },
    'ai-ml': {
      label: 'AI / Machine Learning',
      weeks: [
        { volume: 1200, avgBudget: 3500 },
        { volume: 1350, avgBudget: 3600 },
        { volume: 1500, avgBudget: 3800 },
        { volume: 1600, avgBudget: 3900 },
        { volume: 1750, avgBudget: 4100 },
        { volume: 1900, avgBudget: 4200 },
        { volume: 2050, avgBudget: 4400 },
        { volume: 2200, avgBudget: 4500 },
        { volume: 2400, avgBudget: 4700 },
        { volume: 2550, avgBudget: 4800 },
        { volume: 2700, avgBudget: 5000 },
        { volume: 2900, avgBudget: 5200 },
        { volume: 3100, avgBudget: 5500 }
      ]
    },
    'design': {
      label: 'UI/UX Design',
      weeks: [
        { volume: 3200, avgBudget: 1200 },
        { volume: 3150, avgBudget: 1180 },
        { volume: 3100, avgBudget: 1190 },
        { volume: 3050, avgBudget: 1170 },
        { volume: 3000, avgBudget: 1160 },
        { volume: 2950, avgBudget: 1150 },
        { volume: 3100, avgBudget: 1200 },
        { volume: 3050, avgBudget: 1190 },
        { volume: 3000, avgBudget: 1180 },
        { volume: 2900, avgBudget: 1150 },
        { volume: 2850, avgBudget: 1140 },
        { volume: 2800, avgBudget: 1130 },
        { volume: 2750, avgBudget: 1120 }
      ]
    },
    'writing': {
      label: 'Content Writing',
      weeks: [
        { volume: 5500, avgBudget: 400 },
        { volume: 5300, avgBudget: 390 },
        { volume: 5100, avgBudget: 380 },
        { volume: 4900, avgBudget: 370 },
        { volume: 4700, avgBudget: 360 },
        { volume: 4600, avgBudget: 350 },
        { volume: 4400, avgBudget: 340 },
        { volume: 4200, avgBudget: 330 },
        { volume: 4100, avgBudget: 320 },
        { volume: 3900, avgBudget: 310 },
        { volume: 3800, avgBudget: 300 },
        { volume: 3700, avgBudget: 290 },
        { volume: 3600, avgBudget: 280 }
      ]
    },
    'data-science': {
      label: 'Data Science',
      weeks: [
        { volume: 1500, avgBudget: 2800 },
        { volume: 1550, avgBudget: 2850 },
        { volume: 1600, avgBudget: 2900 },
        { volume: 1620, avgBudget: 2920 },
        { volume: 1680, avgBudget: 2950 },
        { volume: 1700, avgBudget: 3000 },
        { volume: 1750, avgBudget: 3050 },
        { volume: 1800, avgBudget: 3100 },
        { volume: 1850, avgBudget: 3150 },
        { volume: 1900, avgBudget: 3200 },
        { volume: 1950, avgBudget: 3250 },
        { volume: 2000, avgBudget: 3300 },
        { volume: 2050, avgBudget: 3350 }
      ]
    },
    'devops': {
      label: 'DevOps / Cloud',
      weeks: [
        { volume: 900, avgBudget: 3000 },
        { volume: 950, avgBudget: 3050 },
        { volume: 1000, avgBudget: 3100 },
        { volume: 1050, avgBudget: 3150 },
        { volume: 1100, avgBudget: 3200 },
        { volume: 1080, avgBudget: 3180 },
        { volume: 1150, avgBudget: 3250 },
        { volume: 1200, avgBudget: 3300 },
        { volume: 1250, avgBudget: 3350 },
        { volume: 1300, avgBudget: 3400 },
        { volume: 1350, avgBudget: 3450 },
        { volume: 1400, avgBudget: 3500 },
        { volume: 1450, avgBudget: 3550 }
      ]
    },
    'blockchain': {
      label: 'Blockchain / Web3',
      weeks: [
        { volume: 800, avgBudget: 4000 },
        { volume: 750, avgBudget: 3900 },
        { volume: 700, avgBudget: 3800 },
        { volume: 680, avgBudget: 3700 },
        { volume: 650, avgBudget: 3600 },
        { volume: 620, avgBudget: 3500 },
        { volume: 600, avgBudget: 3400 },
        { volume: 580, avgBudget: 3300 },
        { volume: 560, avgBudget: 3200 },
        { volume: 540, avgBudget: 3100 },
        { volume: 520, avgBudget: 3000 },
        { volume: 500, avgBudget: 2900 },
        { volume: 480, avgBudget: 2800 }
      ]
    },
    'marketing': {
      label: 'Digital Marketing',
      weeks: [
        { volume: 2800, avgBudget: 800 },
        { volume: 2850, avgBudget: 810 },
        { volume: 2900, avgBudget: 820 },
        { volume: 2880, avgBudget: 815 },
        { volume: 2950, avgBudget: 830 },
        { volume: 3000, avgBudget: 840 },
        { volume: 3050, avgBudget: 850 },
        { volume: 3100, avgBudget: 860 },
        { volume: 3080, avgBudget: 855 },
        { volume: 3150, avgBudget: 870 },
        { volume: 3200, avgBudget: 880 },
        { volume: 3250, avgBudget: 890 },
        { volume: 3300, avgBudget: 900 }
      ]
    },
    'video': {
      label: 'Video Editing',
      weeks: [
        { volume: 1100, avgBudget: 600 },
        { volume: 1150, avgBudget: 620 },
        { volume: 1200, avgBudget: 640 },
        { volume: 1250, avgBudget: 660 },
        { volume: 1300, avgBudget: 680 },
        { volume: 1350, avgBudget: 700 },
        { volume: 1400, avgBudget: 720 },
        { volume: 1450, avgBudget: 740 },
        { volume: 1500, avgBudget: 760 },
        { volume: 1550, avgBudget: 780 },
        { volume: 1600, avgBudget: 800 },
        { volume: 1650, avgBudget: 820 },
        { volume: 1700, avgBudget: 840 }
      ]
    },
    'qa': {
      label: 'QA / Testing',
      weeks: [
        { volume: 700, avgBudget: 1500 },
        { volume: 710, avgBudget: 1510 },
        { volume: 720, avgBudget: 1520 },
        { volume: 715, avgBudget: 1515 },
        { volume: 730, avgBudget: 1530 },
        { volume: 725, avgBudget: 1525 },
        { volume: 740, avgBudget: 1540 },
        { volume: 735, avgBudget: 1535 },
        { volume: 750, avgBudget: 1550 },
        { volume: 745, avgBudget: 1545 },
        { volume: 760, avgBudget: 1560 },
        { volume: 755, avgBudget: 1555 },
        { volume: 770, avgBudget: 1570 }
      ]
    }
  };

  // ─── Analysis helpers ───────────────────────────────────────────

  function calcGrowth(weeks, key) {
    if (!weeks || weeks.length < 2) return 0;
    var first = weeks[0][key];
    var last = weeks[weeks.length - 1][key];
    if (first === 0) return 0;
    return Math.round(((last - first) / first) * 100);
  }

  function calcAvg(weeks, key) {
    if (!weeks || weeks.length === 0) return 0;
    var sum = 0;
    for (var i = 0; i < weeks.length; i++) sum += weeks[i][key];
    return Math.round(sum / weeks.length);
  }

  function getLatest(weeks, key) {
    if (!weeks || weeks.length === 0) return 0;
    return weeks[weeks.length - 1][key];
  }

  /**
   * Get trend analysis for all categories.
   * @returns {Object[]} Sorted by volume growth desc. Each entry:
   *   { id, label, volumeGrowth, budgetGrowth, currentVolume, currentBudget,
   *     avgVolume, avgBudget, trend ('growing'|'shrinking'|'stable') }
   */
  function getAllTrends() {
    var results = [];
    var keys = Object.keys(TREND_DATA);
    for (var i = 0; i < keys.length; i++) {
      var id = keys[i];
      var cat = TREND_DATA[id];
      var volumeGrowth = calcGrowth(cat.weeks, 'volume');
      var budgetGrowth = calcGrowth(cat.weeks, 'avgBudget');

      var trend;
      if (volumeGrowth > 5) trend = 'growing';
      else if (volumeGrowth < -5) trend = 'shrinking';
      else trend = 'stable';

      results.push({
        id: id,
        label: cat.label,
        volumeGrowth: volumeGrowth,
        budgetGrowth: budgetGrowth,
        currentVolume: getLatest(cat.weeks, 'volume'),
        currentBudget: getLatest(cat.weeks, 'avgBudget'),
        avgVolume: calcAvg(cat.weeks, 'volume'),
        avgBudget: calcAvg(cat.weeks, 'avgBudget'),
        trend: trend
      });
    }
    results.sort(function (a, b) { return b.volumeGrowth - a.volumeGrowth; });
    return results;
  }

  /**
   * Get trend for a single category.
   * @param {string} categoryId - e.g. 'web-development'
   * @returns {Object|null}
   */
  function getCategoryTrend(categoryId) {
    var all = getAllTrends();
    for (var i = 0; i < all.length; i++) {
      if (all[i].id === categoryId) return all[i];
    }
    return null;
  }

  /**
   * Get top growing categories.
   * @param {number} [limit=5]
   * @returns {Object[]}
   */
  function getGrowingCategories(limit) {
    return getAllTrends().filter(function (c) { return c.trend === 'growing'; }).slice(0, limit || 5);
  }

  /**
   * Get shrinking categories.
   * @param {number} [limit=5]
   * @returns {Object[]}
   */
  function getShrinkingCategories(limit) {
    var all = getAllTrends().filter(function (c) { return c.trend === 'shrinking'; });
    all.sort(function (a, b) { return a.volumeGrowth - b.volumeGrowth; });
    return all.slice(0, limit || 5);
  }

  /**
   * Get raw weekly data for a category (for charting).
   * @param {string} categoryId
   * @returns {Object[]|null} Array of { volume, avgBudget } per week
   */
  function getWeeklyData(categoryId) {
    var cat = TREND_DATA[categoryId];
    return cat ? cat.weeks.slice() : null;
  }

  /**
   * Calculate opportunity score for each category.
   * High budget growth + low competition (low volume) = high opportunity.
   * @returns {Object[]} Sorted by opportunity score desc.
   */
  function getOpportunityScores() {
    var trends = getAllTrends();
    var maxVolume = 0;
    for (var i = 0; i < trends.length; i++) {
      if (trends[i].currentVolume > maxVolume) maxVolume = trends[i].currentVolume;
    }

    return trends.map(function (t) {
      var budgetScore = Math.max(0, Math.min(100, t.budgetGrowth * 2));
      var volumeGrowthScore = Math.max(0, Math.min(100, t.volumeGrowth));
      var competitionScore = maxVolume > 0 ? (1 - t.currentVolume / maxVolume) * 100 : 50;
      var opportunity = Math.round(budgetScore * 0.4 + volumeGrowthScore * 0.3 + competitionScore * 0.3);

      return {
        id: t.id,
        label: t.label,
        opportunityScore: Math.max(0, Math.min(100, opportunity)),
        budgetGrowth: t.budgetGrowth,
        volumeGrowth: t.volumeGrowth,
        currentBudget: t.currentBudget,
        currentVolume: t.currentVolume,
        trend: t.trend
      };
    }).sort(function (a, b) { return b.opportunityScore - a.opportunityScore; });
  }

  /**
   * Calculate week-over-week momentum (last 4 weeks vs prior 4 weeks).
   * @param {string} categoryId
   * @returns {{volumeMomentum: number, budgetMomentum: number}|null}
   */
  function getMomentum(categoryId) {
    var cat = TREND_DATA[categoryId];
    if (!cat || cat.weeks.length < 8) return null;

    var weeks = cat.weeks;
    var len = weeks.length;
    var recentVol = 0, priorVol = 0, recentBud = 0, priorBud = 0;
    for (var i = 0; i < 4; i++) {
      recentVol += weeks[len - 1 - i].volume;
      priorVol += weeks[len - 5 - i].volume;
      recentBud += weeks[len - 1 - i].avgBudget;
      priorBud += weeks[len - 5 - i].avgBudget;
    }

    return {
      volumeMomentum: priorVol > 0 ? Math.round(((recentVol - priorVol) / priorVol) * 100) : 0,
      budgetMomentum: priorBud > 0 ? Math.round(((recentBud - priorBud) / priorBud) * 100) : 0
    };
  }

  // ─── Render ───────────────────────────────────────────────────

  function escHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function trendArrow(growth) {
    if (growth > 5) return '<span style="color:#00ff88;">&#9650; +' + growth + '%</span>';
    if (growth < -5) return '<span style="color:#ff4444;">&#9660; ' + growth + '%</span>';
    return '<span style="color:#888;">&#9644; ' + growth + '%</span>';
  }

  function sparkline(weeks, key, color) {
    if (!weeks || weeks.length < 2) return '';
    var vals = weeks.map(function (w) { return w[key]; });
    var min = Math.min.apply(null, vals);
    var max = Math.max.apply(null, vals);
    var range = max - min || 1;
    var w = 120, h = 32;
    var points = vals.map(function (v, i) {
      var x = (i / (vals.length - 1)) * w;
      var y = h - ((v - min) / range) * (h - 4) - 2;
      return x.toFixed(1) + ',' + y.toFixed(1);
    }).join(' ');

    return '<svg viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" style="display:block;">' +
      '<polyline points="' + points + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
      '</svg>';
  }

  /**
   * Render category trends dashboard into a DOM container.
   * @param {string|HTMLElement} container - CSS selector or DOM element
   * @param {object} [options]
   * @param {boolean} [options.showOpportunity] - Show opportunity scores (default true)
   * @param {number} [options.limit] - Max categories to show (default all)
   */
  function render(container, options) {
    if (typeof container === 'string') container = document.querySelector(container);
    if (!container) return;
    options = options || {};
    var showOpportunity = options.showOpportunity !== false;
    var limit = options.limit || 0;

    var trends = getAllTrends();
    var opportunities = showOpportunity ? getOpportunityScores() : [];
    if (limit > 0) trends = trends.slice(0, limit);

    var html = '<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#0a0a0a;color:#e0e0e0;border-radius:16px;overflow:hidden;border:1px solid #222;">';

    // Header
    html += '<div style="padding:20px 24px;background:linear-gradient(135deg,#0a1628,#0a0a2e);border-bottom:1px solid #222;">';
    html += '<h2 style="margin:0 0 4px;font-size:20px;font-weight:800;color:#fff;">Category Trend Analysis</h2>';
    html += '<p style="margin:0;font-size:13px;color:#666;">90-day volume &amp; budget trends across ' + trends.length + ' categories</p>';
    html += '</div>';

    // Summary bar
    var growing = trends.filter(function (t) { return t.trend === 'growing'; }).length;
    var shrinking = trends.filter(function (t) { return t.trend === 'shrinking'; }).length;
    var stable = trends.length - growing - shrinking;
    html += '<div style="display:flex;border-bottom:1px solid #222;">';
    html += '<div style="flex:1;padding:12px 16px;text-align:center;border-right:1px solid #1a1a1a;">' +
      '<div style="font-size:20px;font-weight:800;color:#00ff88;">' + growing + '</div>' +
      '<div style="font-size:11px;color:#666;text-transform:uppercase;">Growing</div></div>';
    html += '<div style="flex:1;padding:12px 16px;text-align:center;border-right:1px solid #1a1a1a;">' +
      '<div style="font-size:20px;font-weight:800;color:#888;">' + stable + '</div>' +
      '<div style="font-size:11px;color:#666;text-transform:uppercase;">Stable</div></div>';
    html += '<div style="flex:1;padding:12px 16px;text-align:center;">' +
      '<div style="font-size:20px;font-weight:800;color:#ff4444;">' + shrinking + '</div>' +
      '<div style="font-size:11px;color:#666;text-transform:uppercase;">Shrinking</div></div>';
    html += '</div>';

    // Category rows
    for (var i = 0; i < trends.length; i++) {
      var t = trends[i];
      var weeks = getWeeklyData(t.id);
      var momentum = getMomentum(t.id);
      var lineColor = t.trend === 'growing' ? '#00ff88' : t.trend === 'shrinking' ? '#ff4444' : '#888';

      html += '<div style="padding:16px 24px;border-bottom:1px solid #111;display:flex;align-items:center;gap:16px;flex-wrap:wrap;">';

      // Label + trend
      html += '<div style="flex:1;min-width:160px;">';
      html += '<div style="font-size:14px;font-weight:700;color:#fff;">' + escHtml(t.label) + '</div>';
      html += '<div style="font-size:12px;margin-top:2px;">Volume: ' + trendArrow(t.volumeGrowth) + ' &nbsp; Budget: ' + trendArrow(t.budgetGrowth) + '</div>';
      if (momentum) {
        var momColor = momentum.volumeMomentum > 0 ? '#00ff88' : momentum.volumeMomentum < 0 ? '#ff4444' : '#888';
        html += '<div style="font-size:11px;color:#555;margin-top:2px;">4-week momentum: <span style="color:' + momColor + ';">' +
          (momentum.volumeMomentum > 0 ? '+' : '') + momentum.volumeMomentum + '% vol</span></div>';
      }
      html += '</div>';

      // Sparkline
      html += '<div style="flex-shrink:0;">' + sparkline(weeks, 'volume', lineColor) + '</div>';

      // Stats
      html += '<div style="text-align:right;min-width:120px;">';
      html += '<div style="font-size:13px;color:#fff;font-weight:600;">' + t.currentVolume.toLocaleString() + ' jobs/wk</div>';
      html += '<div style="font-size:12px;color:#7c3aed;font-weight:600;">$' + t.currentBudget.toLocaleString() + ' avg</div>';
      html += '</div>';

      html += '</div>';
    }

    // Opportunity section
    if (showOpportunity && opportunities.length > 0) {
      html += '<div style="padding:16px 24px;border-top:1px solid #222;background:#0d0d1a;">';
      html += '<h3 style="margin:0 0 12px;font-size:15px;font-weight:700;color:#7c3aed;">Top Opportunities</h3>';
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;">';

      var topOpp = opportunities.slice(0, 5);
      for (var j = 0; j < topOpp.length; j++) {
        var o = topOpp[j];
        var barW = o.opportunityScore;
        html += '<div style="background:#111;border-radius:8px;padding:12px;border:1px solid #1a1a1a;">';
        html += '<div style="font-size:13px;font-weight:600;color:#fff;">' + escHtml(o.label) + '</div>';
        html += '<div style="font-size:22px;font-weight:800;color:#7c3aed;margin:4px 0;">' + o.opportunityScore + '</div>';
        html += '<div style="height:4px;background:#1a1a1a;border-radius:2px;overflow:hidden;">' +
          '<div style="height:100%;width:' + barW + '%;background:#7c3aed;border-radius:2px;"></div></div>';
        html += '<div style="font-size:11px;color:#666;margin-top:4px;">Budget ' + (o.budgetGrowth > 0 ? '+' : '') + o.budgetGrowth + '% &middot; Vol ' + (o.volumeGrowth > 0 ? '+' : '') + o.volumeGrowth + '%</div>';
        html += '</div>';
      }

      html += '</div></div>';
    }

    html += '</div>';
    container.innerHTML = html;
  }

  // ─── Public API ─────────────────────────────────────────────────

  window.CortexCategoryTrends = {
    getAllTrends: getAllTrends,
    getCategoryTrend: getCategoryTrend,
    getGrowingCategories: getGrowingCategories,
    getShrinkingCategories: getShrinkingCategories,
    getWeeklyData: getWeeklyData,
    getOpportunityScores: getOpportunityScores,
    getMomentum: getMomentum,
    render: render
  };

  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.CategoryTrends = {
    getAllTrends: getAllTrends,
    getCategoryTrend: getCategoryTrend,
    getGrowingCategories: getGrowingCategories,
    getShrinkingCategories: getShrinkingCategories,
    getWeeklyData: getWeeklyData,
    getOpportunityScores: getOpportunityScores,
    getMomentum: getMomentum,
    render: render,
    version: '1.1.0',
  };

})();
