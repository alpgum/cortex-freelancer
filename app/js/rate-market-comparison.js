/**
 * [CF-125] Rate Calculator — Market Comparison Visualization
 * Show user's rate on a bell curve against market rates for their category.
 * Exposed on window.CortexFreelancer.RateMarketComparison
 */
(function () {
  'use strict';

  var CF = window.CortexFreelancer = window.CortexFreelancer || {};

  var CSS_INJECTED = false;

  // Market rate data by category and tier (USD/hr)
  var MARKET_DATA = {
    'web-development': {
      label: 'Web Development',
      junior: { low: 15, p25: 22, median: 30, p75: 40, high: 55, sampleSize: 8500 },
      mid: { low: 30, p25: 40, median: 55, p75: 70, high: 90, sampleSize: 12000 },
      senior: { low: 50, p25: 65, median: 85, p75: 110, high: 150, sampleSize: 6500 }
    },
    'mobile-development': {
      label: 'Mobile Development',
      junior: { low: 18, p25: 25, median: 35, p75: 45, high: 60, sampleSize: 5200 },
      mid: { low: 35, p25: 48, median: 60, p75: 80, high: 100, sampleSize: 7800 },
      senior: { low: 55, p25: 72, median: 95, p75: 120, high: 165, sampleSize: 4200 }
    },
    'design': {
      label: 'UI/UX Design',
      junior: { low: 12, p25: 18, median: 25, p75: 35, high: 45, sampleSize: 6100 },
      mid: { low: 25, p25: 35, median: 50, p75: 65, high: 85, sampleSize: 9200 },
      senior: { low: 45, p25: 60, median: 80, p75: 100, high: 140, sampleSize: 4800 }
    },
    'data-science': {
      label: 'Data Science / ML',
      junior: { low: 20, p25: 30, median: 40, p75: 55, high: 70, sampleSize: 4100 },
      mid: { low: 40, p25: 55, median: 75, p75: 95, high: 120, sampleSize: 6500 },
      senior: { low: 65, p25: 85, median: 110, p75: 140, high: 200, sampleSize: 3200 }
    },
    'devops': {
      label: 'DevOps / Cloud',
      junior: { low: 20, p25: 28, median: 38, p75: 50, high: 65, sampleSize: 3800 },
      mid: { low: 38, p25: 50, median: 65, p75: 85, high: 110, sampleSize: 5900 },
      senior: { low: 60, p25: 78, median: 100, p75: 130, high: 175, sampleSize: 3100 }
    },
    'writing': {
      label: 'Content / Technical Writing',
      junior: { low: 10, p25: 15, median: 22, p75: 30, high: 40, sampleSize: 5500 },
      mid: { low: 22, p25: 30, median: 42, p75: 55, high: 70, sampleSize: 7200 },
      senior: { low: 40, p25: 52, median: 65, p75: 85, high: 120, sampleSize: 3500 }
    },
    'marketing': {
      label: 'Digital Marketing',
      junior: { low: 12, p25: 18, median: 25, p75: 35, high: 50, sampleSize: 4800 },
      mid: { low: 25, p25: 35, median: 50, p75: 65, high: 85, sampleSize: 6900 },
      senior: { low: 45, p25: 60, median: 78, p75: 100, high: 140, sampleSize: 3400 }
    }
  };

  // ─── Bell Curve Calculation ───────────────────────────────────────

  function _normalDistribution(x, mean, stdDev) {
    var exp = -0.5 * Math.pow((x - mean) / stdDev, 2);
    return (1 / (stdDev * Math.sqrt(2 * Math.PI))) * Math.pow(Math.E, exp);
  }

  function _estimateStdDev(data) {
    // Estimate standard deviation from percentile data
    // p25 is approx mean - 0.675 * stddev, p75 is approx mean + 0.675 * stddev
    return (data.p75 - data.p25) / (2 * 0.6745);
  }

  function generateBellCurvePoints(marketData, numPoints) {
    var points = numPoints || 100;
    var mean = marketData.median;
    var stdDev = _estimateStdDev(marketData);
    var minX = Math.max(0, mean - 3.5 * stdDev);
    var maxX = mean + 3.5 * stdDev;
    var step = (maxX - minX) / points;
    var result = [];

    for (var i = 0; i <= points; i++) {
      var x = minX + i * step;
      var y = _normalDistribution(x, mean, stdDev);
      result.push({ rate: Math.round(x * 100) / 100, density: y });
    }

    return { points: result, mean: mean, stdDev: stdDev, min: minX, max: maxX };
  }

  // ─── Percentile Calculation ───────────────────────────────────────

  function calculatePercentile(rate, marketData) {
    var mean = marketData.median;
    var stdDev = _estimateStdDev(marketData);

    // Use error function approximation for normal CDF
    var z = (rate - mean) / stdDev;
    var percentile = _normalCDF(z) * 100;
    return Math.max(1, Math.min(99, Math.round(percentile)));
  }

  function _normalCDF(z) {
    // Abramowitz and Stegun approximation
    var a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429;
    var p = 0.3275911;
    var sign = z < 0 ? -1 : 1;
    z = Math.abs(z) / Math.sqrt(2);
    var t = 1 / (1 + p * z);
    var y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-z * z);
    return 0.5 * (1 + sign * y);
  }

  // ─── Analysis ─────────────────────────────────────────────────────

  function analyzeRatePosition(rate, category, tier) {
    var catData = MARKET_DATA[category];
    if (!catData) catData = MARKET_DATA['web-development'];
    var tierData = catData[tier] || catData.mid;

    var percentile = calculatePercentile(rate, tierData);
    var curve = generateBellCurvePoints(tierData);

    var position;
    if (percentile <= 10) position = { label: 'Well Below Market', color: '#ef4444', advice: 'Your rate is significantly below market. Consider raising it — clients may perceive low rates as a quality signal.' };
    else if (percentile <= 25) position = { label: 'Below Average', color: '#f59e0b', advice: 'There is room to increase your rate. Focus on building portfolio and reviews to justify a raise.' };
    else if (percentile <= 50) position = { label: 'Average', color: '#eab308', advice: 'You are in the middle of the market. Specialization and niche expertise can push you higher.' };
    else if (percentile <= 75) position = { label: 'Above Average', color: '#22c55e', advice: 'Strong positioning. Maintain quality and client satisfaction to sustain this rate.' };
    else if (percentile <= 90) position = { label: 'Premium', color: '#10b981', advice: 'You are in the top tier. Ensure your portfolio and reviews support this premium positioning.' };
    else position = { label: 'Top Earner', color: '#06b6d4', advice: 'Elite positioning. Consider productized services or consulting engagements for maximum value.' };

    return {
      rate: rate,
      category: { key: category, label: catData.label },
      tier: tier,
      percentile: percentile,
      position: position,
      marketData: tierData,
      bellCurve: curve,
      benchmarks: {
        p25: tierData.p25,
        median: tierData.median,
        p75: tierData.p75,
        yourRate: rate
      },
      potentialIncrease: percentile < 75 ? Math.round(tierData.p75 - rate) : 0,
      sampleSize: tierData.sampleSize
    };
  }

  // ─── SVG Bell Curve Renderer ──────────────────────────────────────

  function _renderBellCurveSVG(analysis, width, height) {
    var w = width || 560;
    var h = height || 220;
    var padding = { top: 20, right: 30, bottom: 40, left: 10 };
    var chartW = w - padding.left - padding.right;
    var chartH = h - padding.top - padding.bottom;

    var curve = analysis.bellCurve;
    var points = curve.points;
    var maxDensity = 0;
    for (var i = 0; i < points.length; i++) {
      if (points[i].density > maxDensity) maxDensity = points[i].density;
    }

    function xScale(rate) { return padding.left + ((rate - curve.min) / (curve.max - curve.min)) * chartW; }
    function yScale(density) { return padding.top + chartH - (density / maxDensity) * chartH; }

    // Build SVG path for the curve
    var pathD = 'M ' + xScale(points[0].rate) + ',' + yScale(points[0].density);
    for (var j = 1; j < points.length; j++) {
      pathD += ' L ' + xScale(points[j].rate) + ',' + yScale(points[j].density);
    }

    // Fill area
    var areaD = pathD + ' L ' + xScale(points[points.length - 1].rate) + ',' + (padding.top + chartH) +
      ' L ' + xScale(points[0].rate) + ',' + (padding.top + chartH) + ' Z';

    var userX = xScale(analysis.rate);
    var medianX = xScale(analysis.marketData.median);
    var p25X = xScale(analysis.marketData.p25);
    var p75X = xScale(analysis.marketData.p75);

    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h + '" style="width:100%;height:auto;">';

    // Gradient fill
    svg += '<defs><linearGradient id="bellGrad" x1="0" x2="0" y1="0" y2="1">';
    svg += '<stop offset="0%" stop-color="#7c3aed" stop-opacity="0.3"/>';
    svg += '<stop offset="100%" stop-color="#7c3aed" stop-opacity="0.02"/>';
    svg += '</linearGradient></defs>';

    // Area fill
    svg += '<path d="' + areaD + '" fill="url(#bellGrad)"/>';

    // Curve line
    svg += '<path d="' + pathD + '" fill="none" stroke="#7c3aed" stroke-width="2.5" stroke-linecap="round"/>';

    // Percentile markers
    svg += _svgMarkerLine(p25X, padding.top, padding.top + chartH, '#555', '25th', analysis.marketData.p25);
    svg += _svgMarkerLine(medianX, padding.top, padding.top + chartH, '#888', 'Median', analysis.marketData.median);
    svg += _svgMarkerLine(p75X, padding.top, padding.top + chartH, '#555', '75th', analysis.marketData.p75);

    // User rate marker (prominent)
    svg += '<line x1="' + userX + '" y1="' + padding.top + '" x2="' + userX + '" y2="' + (padding.top + chartH) + '" stroke="' + analysis.position.color + '" stroke-width="2.5" stroke-dasharray="6,3"/>';
    svg += '<circle cx="' + userX + '" cy="' + yScale(_normalDistribution(analysis.rate, curve.mean, curve.stdDev)) + '" r="6" fill="' + analysis.position.color + '" stroke="#111" stroke-width="2"/>';
    svg += '<text x="' + userX + '" y="' + (padding.top - 6) + '" text-anchor="middle" fill="' + analysis.position.color + '" font-size="11" font-weight="700">You: $' + analysis.rate + '</text>';

    // X-axis labels
    var labelRates = [curve.min, analysis.marketData.p25, analysis.marketData.median, analysis.marketData.p75, curve.max];
    for (var k = 0; k < labelRates.length; k++) {
      var lx = xScale(labelRates[k]);
      svg += '<text x="' + lx + '" y="' + (h - 5) + '" text-anchor="middle" fill="#666" font-size="10">$' + Math.round(labelRates[k]) + '</text>';
    }

    svg += '</svg>';
    return svg;
  }

  function _svgMarkerLine(x, y1, y2, color, label, rate) {
    var svg = '<line x1="' + x + '" y1="' + y1 + '" x2="' + x + '" y2="' + y2 + '" stroke="' + color + '" stroke-width="1" stroke-dasharray="3,3"/>';
    svg += '<text x="' + x + '" y="' + (y2 + 14) + '" text-anchor="middle" fill="' + color + '" font-size="9">' + label + '</text>';
    return svg;
  }

  // ─── Render: Full Comparison View ─────────────────────────────────

  function renderMarketComparison(containerId, options) {
    _injectCSS();
    var opts = options || {};
    var container = document.getElementById(containerId);
    if (!container) return;

    var rate = opts.rate || 50;
    var category = opts.category || 'web-development';
    var tier = opts.tier || 'mid';

    var analysis = analyzeRatePosition(rate, category, tier);

    var h = '<div class="rmc-panel">';

    // Header
    h += '<div class="rmc-header">';
    h += '<div class="rmc-header-left">';
    h += '<h3 class="rmc-title">Market Rate Comparison</h3>';
    h += '<div class="rmc-subtitle">' + _escapeHtml(analysis.category.label) + ' &middot; ' + tier.charAt(0).toUpperCase() + tier.slice(1) + ' Level</div>';
    h += '</div>';
    h += '<div class="rmc-percentile-badge" style="background:' + analysis.position.color + '20;color:' + analysis.position.color + '">';
    h += analysis.percentile + 'th percentile';
    h += '</div></div>';

    // Bell curve
    h += '<div class="rmc-chart">';
    h += _renderBellCurveSVG(analysis);
    h += '</div>';

    // Position card
    h += '<div class="rmc-position" style="border-left:3px solid ' + analysis.position.color + '">';
    h += '<div class="rmc-position-label" style="color:' + analysis.position.color + '">' + analysis.position.label + '</div>';
    h += '<div class="rmc-position-advice">' + analysis.position.advice + '</div>';
    h += '</div>';

    // Benchmarks
    h += '<div class="rmc-benchmarks">';
    h += _renderBenchmarkBar('25th Percentile', analysis.marketData.p25, rate, analysis);
    h += _renderBenchmarkBar('Median (50th)', analysis.marketData.median, rate, analysis);
    h += _renderBenchmarkBar('75th Percentile', analysis.marketData.p75, rate, analysis);
    h += _renderBenchmarkBar('Your Rate', rate, rate, analysis, true);
    h += '</div>';

    // Stats
    h += '<div class="rmc-stats">';
    h += '<div class="rmc-stat"><div class="rmc-stat-value">$' + analysis.marketData.p25 + '-$' + analysis.marketData.p75 + '</div><div class="rmc-stat-label">Typical Range</div></div>';
    h += '<div class="rmc-stat"><div class="rmc-stat-value">' + analysis.sampleSize.toLocaleString() + '</div><div class="rmc-stat-label">Freelancers Surveyed</div></div>';
    if (analysis.potentialIncrease > 0) {
      h += '<div class="rmc-stat"><div class="rmc-stat-value" style="color:#22c55e">+$' + analysis.potentialIncrease + '/hr</div><div class="rmc-stat-label">Potential Increase to 75th</div></div>';
    }
    h += '</div>';

    // Category selector
    h += '<div class="rmc-selector">';
    h += '<div class="rmc-selector-label">Compare Different Category</div>';
    h += '<div class="rmc-selector-options">';
    for (var cat in MARKET_DATA) {
      if (!MARKET_DATA.hasOwnProperty(cat)) continue;
      var active = cat === category ? ' rmc-opt-active' : '';
      h += '<button class="rmc-opt-btn' + active + '" data-category="' + cat + '">' + MARKET_DATA[cat].label + '</button>';
    }
    h += '</div>';

    // Tier selector
    h += '<div class="rmc-selector-label" style="margin-top:10px">Experience Level</div>';
    h += '<div class="rmc-selector-options">';
    var tiers = ['junior', 'mid', 'senior'];
    for (var t = 0; t < tiers.length; t++) {
      var tActive = tiers[t] === tier ? ' rmc-opt-active' : '';
      h += '<button class="rmc-opt-btn rmc-tier-btn' + tActive + '" data-tier="' + tiers[t] + '">' + tiers[t].charAt(0).toUpperCase() + tiers[t].slice(1) + '</button>';
    }
    h += '</div></div>';

    h += '</div>';
    container.innerHTML = h;

    // Bind category/tier switches
    var catBtns = container.querySelectorAll('[data-category]');
    var tierBtns = container.querySelectorAll('[data-tier]');
    var currentCategory = category;
    var currentTier = tier;

    for (var ci = 0; ci < catBtns.length; ci++) {
      catBtns[ci].addEventListener('click', function () {
        currentCategory = this.getAttribute('data-category');
        renderMarketComparison(containerId, { rate: rate, category: currentCategory, tier: currentTier });
      });
    }
    for (var ti = 0; ti < tierBtns.length; ti++) {
      tierBtns[ti].addEventListener('click', function () {
        currentTier = this.getAttribute('data-tier');
        renderMarketComparison(containerId, { rate: rate, category: currentCategory, tier: currentTier });
      });
    }
  }

  function _renderBenchmarkBar(label, value, userRate, analysis, isUser) {
    var maxRate = analysis.marketData.high * 1.1;
    var pct = Math.min(100, (value / maxRate) * 100);
    var color = isUser ? analysis.position.color : '#555';

    var h = '<div class="rmc-benchmark">';
    h += '<div class="rmc-benchmark-header"><span class="rmc-benchmark-label">' + label + '</span><span class="rmc-benchmark-value" style="color:' + (isUser ? analysis.position.color : '#ccc') + '">$' + value + '/hr</span></div>';
    h += '<div class="rmc-benchmark-bar"><div class="rmc-benchmark-fill" style="width:' + pct.toFixed(1) + '%;background:' + color + '"></div></div>';
    h += '</div>';
    return h;
  }

  // ─── Utilities ────────────────────────────────────────────────────

  function getCategories() {
    var cats = [];
    for (var key in MARKET_DATA) {
      if (MARKET_DATA.hasOwnProperty(key)) {
        cats.push({ key: key, label: MARKET_DATA[key].label });
      }
    }
    return cats;
  }

  function getMarketData(category, tier) {
    var catData = MARKET_DATA[category];
    if (!catData) return null;
    if (tier) return catData[tier] || null;
    return catData;
  }

  function _escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ─── CSS ──────────────────────────────────────────────────────────

  function _injectCSS() {
    if (CSS_INJECTED) return;
    CSS_INJECTED = true;
    var style = document.createElement('style');
    style.textContent = [
      '.rmc-panel{background:#111;border:1px solid #222;border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;overflow:hidden}',
      '.rmc-header{display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid #222;background:#151515}',
      '.rmc-title{margin:0;color:#e0e0e0;font-size:17px;font-weight:700}',
      '.rmc-subtitle{color:#666;font-size:12px;margin-top:2px}',
      '.rmc-percentile-badge{padding:4px 12px;border-radius:12px;font-size:12px;font-weight:700}',
      '.rmc-chart{padding:16px 18px;border-bottom:1px solid #222}',
      '.rmc-position{background:#1a1a1a;margin:12px;border-radius:8px;padding:14px}',
      '.rmc-position-label{font-size:14px;font-weight:700;margin-bottom:4px}',
      '.rmc-position-advice{font-size:13px;color:#999;line-height:1.5}',
      '.rmc-benchmarks{padding:12px 18px;border-bottom:1px solid #222}',
      '.rmc-benchmark{margin-bottom:10px}',
      '.rmc-benchmark-header{display:flex;justify-content:space-between;margin-bottom:4px}',
      '.rmc-benchmark-label{font-size:12px;color:#888}',
      '.rmc-benchmark-value{font-size:12px;font-weight:600}',
      '.rmc-benchmark-bar{height:6px;background:#1a1a1a;border-radius:3px;overflow:hidden}',
      '.rmc-benchmark-fill{height:100%;border-radius:3px;transition:width .4s ease}',
      '.rmc-stats{display:flex;gap:16px;padding:14px 18px;border-bottom:1px solid #222;flex-wrap:wrap}',
      '.rmc-stat{flex:1;min-width:100px;text-align:center}',
      '.rmc-stat-value{font-size:16px;font-weight:700;color:#e0e0e0}',
      '.rmc-stat-label{font-size:11px;color:#666;margin-top:2px}',
      '.rmc-selector{padding:14px 18px}',
      '.rmc-selector-label{font-size:11px;font-weight:600;color:#666;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px}',
      '.rmc-selector-options{display:flex;gap:6px;flex-wrap:wrap}',
      '.rmc-opt-btn{background:#1a1a1a;border:1px solid #333;border-radius:6px;padding:6px 12px;color:#aaa;font-size:11px;font-weight:500;cursor:pointer;transition:all .2s}',
      '.rmc-opt-btn:hover{background:#222;color:#fff}',
      '.rmc-opt-active{background:#7c3aed20;color:#a78bfa;border-color:#7c3aed}'
    ].join('\n');
    document.head.appendChild(style);
  }

  // ─── Public API ───────────────────────────────────────────────────

  CF.RateMarketComparison = {
    analyzeRatePosition: analyzeRatePosition,
    calculatePercentile: calculatePercentile,
    generateBellCurvePoints: generateBellCurvePoints,
    renderMarketComparison: renderMarketComparison,
    getCategories: getCategories,
    getMarketData: getMarketData,
    MARKET_DATA: MARKET_DATA,
    version: '1.0.0'
  };

})();
