/**
 * [CF-064] Market Rate Trend Tracker
 * Track hourly rate trends by category over time, show if rates are rising or falling.
 * Uses localStorage for historical data persistence.
 *
 * Exposed on window.CortexFreelancer.MarketRateTrends
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  /* ── Constants ── */
  var STORAGE_KEY = 'cortex_market_rate_trends';
  var MAX_HISTORY_DAYS = 365;
  var TREND_WINDOW_DAYS = 30;

  /* ── Default Categories with Baseline Rates ── */
  var DEFAULT_CATEGORIES = {
    'web-development':      { label: 'Web Development',      baseRate: 65, volatility: 0.08 },
    'mobile-development':   { label: 'Mobile Development',   baseRate: 75, volatility: 0.10 },
    'ui-ux-design':         { label: 'UI/UX Design',         baseRate: 55, volatility: 0.06 },
    'data-science':         { label: 'Data Science',         baseRate: 85, volatility: 0.12 },
    'devops':               { label: 'DevOps',               baseRate: 80, volatility: 0.07 },
    'copywriting':          { label: 'Copywriting',          baseRate: 40, volatility: 0.05 },
    'graphic-design':       { label: 'Graphic Design',       baseRate: 45, volatility: 0.06 },
    'video-editing':        { label: 'Video Editing',        baseRate: 50, volatility: 0.08 },
    'virtual-assistant':    { label: 'Virtual Assistant',    baseRate: 25, volatility: 0.04 },
    'blockchain':           { label: 'Blockchain',           baseRate: 95, volatility: 0.15 },
    'ai-ml':                { label: 'AI / Machine Learning', baseRate: 100, volatility: 0.14 },
    'project-management':   { label: 'Project Management',  baseRate: 60, volatility: 0.05 },
    'seo':                  { label: 'SEO',                  baseRate: 45, volatility: 0.07 },
    'content-writing':      { label: 'Content Writing',      baseRate: 35, volatility: 0.06 },
    'cybersecurity':        { label: 'Cybersecurity',        baseRate: 90, volatility: 0.09 }
  };

  /* ── Storage Helpers ── */

  function loadData() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch (e) { return {}; }
  }

  function saveData(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) { /* quota exceeded — silently fail */ }
  }

  function dateKey(d) {
    var dt = d || new Date();
    return dt.getFullYear() + '-' +
      String(dt.getMonth() + 1).padStart(2, '0') + '-' +
      String(dt.getDate()).padStart(2, '0');
  }

  function daysAgo(n) {
    var d = new Date();
    d.setDate(d.getDate() - n);
    return d;
  }

  /* ── Data Recording ── */

  function recordRate(category, rate, source) {
    var data = loadData();
    var key = dateKey();
    if (!data[category]) data[category] = {};
    if (!data[category][key]) data[category][key] = { rates: [], sources: [] };
    data[category][key].rates.push(Number(rate));
    if (source) data[category][key].sources.push(source);
    // Prune old entries
    pruneHistory(data, category);
    saveData(data);
  }

  function recordBulkRates(category, rates) {
    var data = loadData();
    var key = dateKey();
    if (!data[category]) data[category] = {};
    if (!data[category][key]) data[category][key] = { rates: [], sources: [] };
    rates.forEach(function (r) {
      data[category][key].rates.push(Number(r.rate || r));
      if (r.source) data[category][key].sources.push(r.source);
    });
    pruneHistory(data, category);
    saveData(data);
  }

  function pruneHistory(data, category) {
    var cutoff = dateKey(daysAgo(MAX_HISTORY_DAYS));
    var catData = data[category];
    if (!catData) return;
    Object.keys(catData).forEach(function (dk) {
      if (dk < cutoff) delete catData[dk];
    });
  }

  /* ── Trend Analysis ── */

  function getTimeSeries(category, days) {
    var data = loadData();
    var catData = data[category] || {};
    days = days || TREND_WINDOW_DAYS;
    var series = [];
    for (var i = days - 1; i >= 0; i--) {
      var dk = dateKey(daysAgo(i));
      var entry = catData[dk];
      if (entry && entry.rates.length > 0) {
        var avg = entry.rates.reduce(function (a, b) { return a + b; }, 0) / entry.rates.length;
        series.push({ date: dk, avgRate: Math.round(avg * 100) / 100, sampleSize: entry.rates.length });
      }
    }
    return series;
  }

  function analyzeTrend(category, days) {
    var series = getTimeSeries(category, days || TREND_WINDOW_DAYS);
    var catInfo = DEFAULT_CATEGORIES[category] || { label: category, baseRate: 50, volatility: 0.08 };

    if (series.length < 2) {
      return {
        category: category,
        label: catInfo.label,
        direction: 'insufficient-data',
        changePercent: 0,
        changeAbsolute: 0,
        currentRate: series.length > 0 ? series[series.length - 1].avgRate : catInfo.baseRate,
        previousRate: catInfo.baseRate,
        dataPoints: series.length,
        trend: 'neutral',
        confidence: 'low',
        series: series,
        summary: 'Not enough data to determine trend. Record more rates.'
      };
    }

    // Split into first half and second half for comparison
    var mid = Math.floor(series.length / 2);
    var firstHalf = series.slice(0, mid);
    var secondHalf = series.slice(mid);

    var firstAvg = firstHalf.reduce(function (s, p) { return s + p.avgRate; }, 0) / firstHalf.length;
    var secondAvg = secondHalf.reduce(function (s, p) { return s + p.avgRate; }, 0) / secondHalf.length;

    var changeAbsolute = Math.round((secondAvg - firstAvg) * 100) / 100;
    var changePercent = firstAvg > 0 ? Math.round((changeAbsolute / firstAvg) * 10000) / 100 : 0;
    var currentRate = series[series.length - 1].avgRate;

    // Linear regression for slope
    var slope = linearRegressionSlope(series.map(function (p) { return p.avgRate; }));

    // Determine trend
    var trend, direction;
    if (Math.abs(changePercent) < 2) {
      trend = 'stable';
      direction = 'flat';
    } else if (changePercent > 0) {
      trend = changePercent > 8 ? 'surging' : 'rising';
      direction = 'up';
    } else {
      trend = changePercent < -8 ? 'declining' : 'dipping';
      direction = 'down';
    }

    // Confidence based on data density
    var totalSamples = series.reduce(function (s, p) { return s + p.sampleSize; }, 0);
    var confidence;
    if (totalSamples >= 50 && series.length >= 14) confidence = 'high';
    else if (totalSamples >= 20 && series.length >= 7) confidence = 'medium';
    else confidence = 'low';

    // Projected rate (7-day forecast based on slope)
    var projectedRate = Math.round((currentRate + slope * 7) * 100) / 100;

    var emoji = direction === 'up' ? '📈' : direction === 'down' ? '📉' : '➡️';

    return {
      category: category,
      label: catInfo.label,
      direction: direction,
      trend: trend,
      changePercent: changePercent,
      changeAbsolute: changeAbsolute,
      currentRate: currentRate,
      previousRate: Math.round(firstAvg * 100) / 100,
      projectedRate: projectedRate,
      slope: Math.round(slope * 1000) / 1000,
      dataPoints: series.length,
      totalSamples: totalSamples,
      confidence: confidence,
      series: series,
      emoji: emoji,
      summary: emoji + ' ' + catInfo.label + ' rates are ' + trend + ' (' +
        (changePercent >= 0 ? '+' : '') + changePercent + '%). ' +
        'Current avg: $' + currentRate + '/hr. ' +
        (confidence !== 'low' ? 'Projected: $' + projectedRate + '/hr in 7 days.' : 'Need more data for forecast.')
    };
  }

  function linearRegressionSlope(values) {
    var n = values.length;
    if (n < 2) return 0;
    var sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    for (var i = 0; i < n; i++) {
      sumX += i;
      sumY += values[i];
      sumXY += i * values[i];
      sumXX += i * i;
    }
    var denom = n * sumXX - sumX * sumX;
    return denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
  }

  /* ── Multi-Category Dashboard ── */

  function analyzeAllCategories(days) {
    var data = loadData();
    var results = [];
    var categories = Object.keys(data);

    // Add tracked categories
    categories.forEach(function (cat) {
      results.push(analyzeTrend(cat, days));
    });

    // Sort by absolute change
    results.sort(function (a, b) { return Math.abs(b.changePercent) - Math.abs(a.changePercent); });
    return results;
  }

  function getMarketSnapshot() {
    var all = analyzeAllCategories();
    var rising = all.filter(function (r) { return r.direction === 'up'; });
    var falling = all.filter(function (r) { return r.direction === 'down'; });
    var stable = all.filter(function (r) { return r.direction === 'flat'; });
    var hottest = rising.length > 0 ? rising[0] : null;
    var coldest = falling.length > 0 ? falling[0] : null;

    return {
      totalCategories: all.length,
      rising: rising,
      falling: falling,
      stable: stable,
      hottest: hottest,
      coldest: coldest,
      categories: all,
      generatedAt: new Date().toISOString()
    };
  }

  /* ── Seed Demo Data ── */

  function seedDemoData(category, days) {
    var catInfo = DEFAULT_CATEGORIES[category] || { baseRate: 50, volatility: 0.08 };
    var data = loadData();
    if (!data[category]) data[category] = {};
    days = days || 60;

    var rate = catInfo.baseRate;
    var trendDir = Math.random() > 0.5 ? 1 : -1;
    var trendStrength = 0.001 + Math.random() * 0.003;

    for (var i = days; i >= 0; i--) {
      var dk = dateKey(daysAgo(i));
      // Simulate realistic rate movement
      var dailyChange = (Math.random() - 0.48) * catInfo.volatility * catInfo.baseRate * 0.1;
      dailyChange += trendDir * trendStrength * catInfo.baseRate;
      rate = Math.max(catInfo.baseRate * 0.6, Math.min(catInfo.baseRate * 1.6, rate + dailyChange));

      var sampleCount = Math.floor(3 + Math.random() * 12);
      var rates = [];
      for (var j = 0; j < sampleCount; j++) {
        var noise = (Math.random() - 0.5) * catInfo.baseRate * 0.3;
        rates.push(Math.round((rate + noise) * 100) / 100);
      }
      data[category][dk] = { rates: rates, sources: ['demo'] };
    }
    saveData(data);
  }

  /* ── Rate Comparison ── */

  function compareToMarket(category, userRate) {
    var analysis = analyzeTrend(category);
    var diff = userRate - analysis.currentRate;
    var diffPercent = analysis.currentRate > 0 ? Math.round((diff / analysis.currentRate) * 10000) / 100 : 0;

    var position;
    if (diffPercent > 20) position = 'well-above';
    else if (diffPercent > 5) position = 'above';
    else if (diffPercent > -5) position = 'at-market';
    else if (diffPercent > -20) position = 'below';
    else position = 'well-below';

    var recommendation;
    if (position === 'well-below' && analysis.direction === 'up') {
      recommendation = 'Your rate is significantly below a rising market. Consider increasing your rate by $' + Math.abs(Math.round(diff)) + '/hr.';
    } else if (position === 'below' && analysis.direction === 'up') {
      recommendation = 'Market rates are climbing. Good time to raise your rate closer to $' + Math.round(analysis.currentRate) + '/hr.';
    } else if (position === 'above' && analysis.direction === 'down') {
      recommendation = 'Market rates are declining. You may face more price-sensitive clients. Highlight value to justify premium.';
    } else if (position === 'at-market') {
      recommendation = 'Your rate is competitive with the market. ' + (analysis.direction === 'up' ? 'Consider a gradual increase as rates rise.' : 'Maintain current pricing.');
    } else if (position === 'well-above') {
      recommendation = 'Premium rate. Ensure your profile and portfolio justify the premium. Focus on high-budget clients.';
    } else {
      recommendation = 'Monitor trends and adjust as needed.';
    }

    return {
      userRate: userRate,
      marketRate: analysis.currentRate,
      difference: diff,
      differencePercent: diffPercent,
      position: position,
      marketTrend: analysis.trend,
      recommendation: recommendation,
      analysis: analysis
    };
  }

  /* ── Render ── */

  function render(containerId, options) {
    options = options || {};
    var container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
    if (!container) return;

    var categories = options.categories || Object.keys(loadData());
    if (categories.length === 0 && options.seedDemo) {
      // Seed demo data for a few categories
      ['web-development', 'mobile-development', 'ui-ux-design', 'data-science', 'ai-ml'].forEach(function (c) {
        seedDemoData(c, 60);
      });
      categories = ['web-development', 'mobile-development', 'ui-ux-design', 'data-science', 'ai-ml'];
    }

    var snapshot = getMarketSnapshot();

    var html = '';
    html += '<div style="background:#1a1a2e;border:1px solid #2a2a4a;border-radius:16px;padding:24px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;color:#e2e8f0;">';

    // Header
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">';
    html += '<div>';
    html += '<h2 style="margin:0;font-size:20px;font-weight:700;color:#f1f5f9;">📊 Market Rate Trends</h2>';
    html += '<p style="margin:4px 0 0;font-size:13px;color:#64748b;">Tracking ' + snapshot.totalCategories + ' categories</p>';
    html += '</div>';
    html += '<div style="display:flex;gap:8px;">';
    if (snapshot.rising.length > 0) html += '<span style="background:rgba(74,222,128,0.12);color:#4ade80;padding:4px 10px;border-radius:6px;font-size:12px;font-weight:600;">📈 ' + snapshot.rising.length + ' Rising</span>';
    if (snapshot.falling.length > 0) html += '<span style="background:rgba(248,113,113,0.12);color:#f87171;padding:4px 10px;border-radius:6px;font-size:12px;font-weight:600;">📉 ' + snapshot.falling.length + ' Falling</span>';
    if (snapshot.stable.length > 0) html += '<span style="background:rgba(148,163,184,0.12);color:#94a3b8;padding:4px 10px;border-radius:6px;font-size:12px;font-weight:600;">➡️ ' + snapshot.stable.length + ' Stable</span>';
    html += '</div></div>';

    // Category cards
    if (snapshot.categories.length === 0) {
      html += '<div style="text-align:center;padding:40px;color:#64748b;">';
      html += '<p style="font-size:48px;margin:0;">📊</p>';
      html += '<p style="font-size:16px;margin:8px 0;">No rate data yet</p>';
      html += '<p style="font-size:13px;">Start tracking by recording rates from job postings.</p>';
      html += '</div>';
    } else {
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px;">';
      snapshot.categories.forEach(function (cat) {
        html += renderCategoryCard(cat);
      });
      html += '</div>';
    }

    html += '</div>';
    container.innerHTML = html;
  }

  function renderCategoryCard(analysis) {
    var dirColor = analysis.direction === 'up' ? '#4ade80' : analysis.direction === 'down' ? '#f87171' : '#94a3b8';
    var dirBg = analysis.direction === 'up' ? 'rgba(74,222,128,0.08)' : analysis.direction === 'down' ? 'rgba(248,113,113,0.08)' : 'rgba(148,163,184,0.06)';

    var html = '';
    html += '<div style="background:#16213e;border:1px solid #2a2a4a;border-radius:12px;padding:16px;transition:border-color 0.2s;" onmouseover="this.style.borderColor=\'' + dirColor + '44\'" onmouseout="this.style.borderColor=\'#2a2a4a\'">';

    // Title row
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">';
    html += '<span style="font-size:14px;font-weight:600;color:#f1f5f9;">' + escHtml(analysis.label) + '</span>';
    html += '<span style="font-size:12px;font-weight:600;color:' + dirColor + ';background:' + dirBg + ';padding:3px 8px;border-radius:4px;">';
    html += analysis.emoji + ' ' + (analysis.changePercent >= 0 ? '+' : '') + analysis.changePercent + '%</span>';
    html += '</div>';

    // Current rate
    html += '<div style="font-size:28px;font-weight:700;color:#f1f5f9;margin-bottom:4px;">$' + analysis.currentRate + '<span style="font-size:14px;color:#64748b;font-weight:400;">/hr</span></div>';

    // Trend label
    html += '<div style="font-size:12px;color:' + dirColor + ';margin-bottom:12px;text-transform:capitalize;">' + analysis.trend + '</div>';

    // Mini sparkline
    if (analysis.series.length >= 3) {
      html += renderSparkline(analysis.series, dirColor);
    }

    // Confidence & data
    html += '<div style="display:flex;justify-content:space-between;margin-top:8px;font-size:11px;color:#64748b;">';
    html += '<span>' + analysis.dataPoints + ' data points</span>';
    var confColor = analysis.confidence === 'high' ? '#4ade80' : analysis.confidence === 'medium' ? '#facc15' : '#94a3b8';
    html += '<span style="color:' + confColor + ';">' + analysis.confidence + ' confidence</span>';
    html += '</div>';

    // Projected rate
    if (analysis.confidence !== 'low' && analysis.projectedRate) {
      html += '<div style="margin-top:8px;padding:8px;background:rgba(99,102,241,0.08);border-radius:6px;font-size:12px;color:#a5b4fc;">';
      html += '🔮 7-day forecast: $' + analysis.projectedRate + '/hr';
      html += '</div>';
    }

    html += '</div>';
    return html;
  }

  function renderSparkline(series, color) {
    var width = 260;
    var height = 40;
    var values = series.map(function (p) { return p.avgRate; });
    var min = Math.min.apply(null, values);
    var max = Math.max.apply(null, values);
    var range = max - min || 1;

    var points = values.map(function (v, i) {
      var x = (i / (values.length - 1)) * width;
      var y = height - ((v - min) / range) * (height - 4) - 2;
      return x.toFixed(1) + ',' + y.toFixed(1);
    });

    var html = '<svg width="' + width + '" height="' + height + '" style="display:block;margin:0 auto;">';
    html += '<polyline points="' + points.join(' ') + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />';
    // Filled area
    html += '<polygon points="0,' + height + ' ' + points.join(' ') + ' ' + width + ',' + height + '" fill="' + color + '" opacity="0.08" />';
    html += '</svg>';
    return html;
  }

  function escHtml(str) {
    var d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  /* ── Init ── */

  function init(options) {
    options = options || {};
    // Auto-seed if requested
    if (options.seedDemo) {
      var cats = options.categories || Object.keys(DEFAULT_CATEGORIES).slice(0, 5);
      cats.forEach(function (c) {
        var existing = getTimeSeries(c, 7);
        if (existing.length === 0) seedDemoData(c, options.seedDays || 60);
      });
    }
  }

  /* ── Public API ── */

  window.CortexFreelancer.MarketRateTrends = {
    init: init,
    render: render,
    recordRate: recordRate,
    recordBulkRates: recordBulkRates,
    analyzeTrend: analyzeTrend,
    analyzeAllCategories: analyzeAllCategories,
    getMarketSnapshot: getMarketSnapshot,
    getTimeSeries: getTimeSeries,
    compareToMarket: compareToMarket,
    seedDemoData: seedDemoData,
    DEFAULT_CATEGORIES: DEFAULT_CATEGORIES
  };

})();
