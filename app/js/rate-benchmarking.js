/**
 * [CF-012] Hourly Rate Benchmarking by Category and Region
 * Dataset of rate ranges per category/country, shows where user falls.
 * Exposed as window.CortexFreelancer.RateBenchmarking
 */
(function () {
  'use strict';

  // ─── Rate Dataset ────────────────────────────────────────────────────
  // Structure: category -> region -> { min, p25, median, p75, max, sampleSize }

  var RATE_DATA = {
    'Web Development': {
      'United States': { min: 35, p25: 60, median: 85, p75: 120, max: 200, sampleSize: 4200 },
      'United Kingdom': { min: 30, p25: 50, median: 75, p75: 110, max: 180, sampleSize: 1800 },
      'Canada': { min: 30, p25: 55, median: 75, p75: 105, max: 170, sampleSize: 1200 },
      'Germany': { min: 35, p25: 55, median: 80, p75: 115, max: 175, sampleSize: 1100 },
      'India': { min: 8, p25: 15, median: 25, p75: 45, max: 80, sampleSize: 5500 },
      'Ukraine': { min: 15, p25: 25, median: 40, p75: 60, max: 100, sampleSize: 2200 },
      'Philippines': { min: 5, p25: 12, median: 20, p75: 35, max: 60, sampleSize: 3100 },
      'Brazil': { min: 10, p25: 20, median: 35, p75: 55, max: 90, sampleSize: 1600 },
      'Australia': { min: 35, p25: 55, median: 80, p75: 115, max: 185, sampleSize: 900 },
      'Global': { min: 5, p25: 25, median: 50, p75: 85, max: 200, sampleSize: 24000 }
    },
    'Mobile Development': {
      'United States': { min: 40, p25: 65, median: 95, p75: 135, max: 220, sampleSize: 3200 },
      'United Kingdom': { min: 35, p25: 55, median: 80, p75: 120, max: 190, sampleSize: 1400 },
      'Canada': { min: 35, p25: 60, median: 80, p75: 115, max: 180, sampleSize: 900 },
      'Germany': { min: 40, p25: 60, median: 85, p75: 125, max: 185, sampleSize: 800 },
      'India': { min: 10, p25: 18, median: 30, p75: 50, max: 90, sampleSize: 4800 },
      'Ukraine': { min: 18, p25: 30, median: 45, p75: 65, max: 110, sampleSize: 1800 },
      'Philippines': { min: 8, p25: 15, median: 25, p75: 40, max: 70, sampleSize: 2400 },
      'Brazil': { min: 12, p25: 22, median: 40, p75: 60, max: 100, sampleSize: 1200 },
      'Australia': { min: 40, p25: 60, median: 85, p75: 125, max: 200, sampleSize: 700 },
      'Global': { min: 8, p25: 30, median: 55, p75: 95, max: 220, sampleSize: 18000 }
    },
    'UI/UX Design': {
      'United States': { min: 30, p25: 55, median: 80, p75: 115, max: 180, sampleSize: 2800 },
      'United Kingdom': { min: 25, p25: 45, median: 70, p75: 100, max: 160, sampleSize: 1200 },
      'Canada': { min: 28, p25: 50, median: 70, p75: 100, max: 155, sampleSize: 800 },
      'Germany': { min: 30, p25: 50, median: 75, p75: 105, max: 160, sampleSize: 700 },
      'India': { min: 5, p25: 12, median: 22, p75: 40, max: 70, sampleSize: 3800 },
      'Ukraine': { min: 12, p25: 22, median: 35, p75: 55, max: 90, sampleSize: 1500 },
      'Philippines': { min: 5, p25: 10, median: 18, p75: 30, max: 55, sampleSize: 2100 },
      'Brazil': { min: 8, p25: 18, median: 30, p75: 50, max: 80, sampleSize: 1100 },
      'Australia': { min: 30, p25: 50, median: 75, p75: 110, max: 170, sampleSize: 600 },
      'Global': { min: 5, p25: 22, median: 45, p75: 80, max: 180, sampleSize: 15000 }
    },
    'Data Science': {
      'United States': { min: 45, p25: 75, median: 110, p75: 155, max: 250, sampleSize: 2100 },
      'United Kingdom': { min: 40, p25: 65, median: 95, p75: 135, max: 210, sampleSize: 900 },
      'Canada': { min: 40, p25: 65, median: 90, p75: 130, max: 200, sampleSize: 600 },
      'Germany': { min: 45, p25: 65, median: 95, p75: 140, max: 210, sampleSize: 550 },
      'India': { min: 10, p25: 20, median: 35, p75: 60, max: 100, sampleSize: 3200 },
      'Ukraine': { min: 20, p25: 35, median: 55, p75: 80, max: 130, sampleSize: 1200 },
      'Philippines': { min: 8, p25: 15, median: 28, p75: 45, max: 75, sampleSize: 1400 },
      'Brazil': { min: 15, p25: 28, median: 45, p75: 70, max: 120, sampleSize: 800 },
      'Australia': { min: 45, p25: 70, median: 100, p75: 145, max: 230, sampleSize: 450 },
      'Global': { min: 8, p25: 30, median: 60, p75: 110, max: 250, sampleSize: 12000 }
    },
    'Copywriting': {
      'United States': { min: 20, p25: 40, median: 65, p75: 95, max: 150, sampleSize: 3500 },
      'United Kingdom': { min: 18, p25: 35, median: 55, p75: 80, max: 130, sampleSize: 1500 },
      'Canada': { min: 18, p25: 35, median: 55, p75: 80, max: 125, sampleSize: 1000 },
      'Germany': { min: 20, p25: 35, median: 55, p75: 85, max: 130, sampleSize: 600 },
      'India': { min: 3, p25: 8, median: 15, p75: 28, max: 50, sampleSize: 4200 },
      'Ukraine': { min: 8, p25: 15, median: 25, p75: 40, max: 70, sampleSize: 1300 },
      'Philippines': { min: 3, p25: 8, median: 15, p75: 25, max: 45, sampleSize: 2800 },
      'Brazil': { min: 5, p25: 12, median: 22, p75: 38, max: 65, sampleSize: 900 },
      'Australia': { min: 22, p25: 40, median: 60, p75: 90, max: 140, sampleSize: 500 },
      'Global': { min: 3, p25: 15, median: 35, p75: 65, max: 150, sampleSize: 17000 }
    },
    'Graphic Design': {
      'United States': { min: 20, p25: 40, median: 60, p75: 90, max: 145, sampleSize: 3000 },
      'United Kingdom': { min: 18, p25: 35, median: 55, p75: 80, max: 125, sampleSize: 1300 },
      'Canada': { min: 18, p25: 35, median: 55, p75: 78, max: 120, sampleSize: 850 },
      'Germany': { min: 20, p25: 38, median: 55, p75: 82, max: 125, sampleSize: 550 },
      'India': { min: 3, p25: 8, median: 15, p75: 25, max: 50, sampleSize: 4500 },
      'Ukraine': { min: 8, p25: 15, median: 25, p75: 40, max: 65, sampleSize: 1400 },
      'Philippines': { min: 3, p25: 7, median: 14, p75: 22, max: 40, sampleSize: 2600 },
      'Brazil': { min: 5, p25: 12, median: 20, p75: 35, max: 60, sampleSize: 1000 },
      'Australia': { min: 22, p25: 40, median: 58, p75: 85, max: 140, sampleSize: 450 },
      'Global': { min: 3, p25: 15, median: 32, p75: 60, max: 145, sampleSize: 16000 }
    }
  };

  var CATEGORIES = Object.keys(RATE_DATA);

  function getRegions(category) {
    return Object.keys(RATE_DATA[category] || RATE_DATA['Web Development']);
  }

  // ─── State ───────────────────────────────────────────────────────────

  var state = {
    container: null,
    category: 'Web Development',
    region: 'Global',
    userRate: 50
  };

  // ─── Styles ──────────────────────────────────────────────────────────

  var STYLES = '\
    .rb-root { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #1a1a2e; color: #e0e0e0; border-radius: 12px; padding: 24px; max-width: 800px; }\
    .rb-title { font-size: 20px; font-weight: 700; margin-bottom: 16px; color: #fff; }\
    .rb-controls { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 20px; align-items: flex-end; }\
    .rb-field { display: flex; flex-direction: column; gap: 4px; }\
    .rb-field label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #888; }\
    .rb-field select, .rb-field input { background: #16213e; border: 1px solid #2d2d44; border-radius: 6px; padding: 8px 12px; color: #e0e0e0; font-size: 14px; outline: none; }\
    .rb-field select:focus, .rb-field input:focus { border-color: #00d4aa; }\
    .rb-field input[type=number] { width: 100px; }\
    .rb-chart { background: #16213e; border-radius: 10px; padding: 20px; margin-bottom: 16px; border: 1px solid #2d2d44; }\
    .rb-distribution { position: relative; height: 60px; margin: 20px 0; }\
    .rb-dist-bar { position: absolute; top: 10px; height: 24px; border-radius: 4px; }\
    .rb-dist-label { position: absolute; top: 42px; font-size: 11px; color: #888; transform: translateX(-50%); white-space: nowrap; }\
    .rb-dist-marker { position: absolute; top: 0; width: 3px; height: 44px; background: #ff6b6b; border-radius: 2px; z-index: 2; }\
    .rb-dist-marker-label { position: absolute; top: -18px; font-size: 11px; color: #ff6b6b; font-weight: 700; transform: translateX(-50%); white-space: nowrap; }\
    .rb-percentile { text-align: center; font-size: 48px; font-weight: 800; margin: 20px 0 8px; }\
    .rb-percentile-sub { text-align: center; font-size: 14px; color: #888; margin-bottom: 20px; }\
    .rb-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 16px; }\
    .rb-stat { background: #1a1a2e; border-radius: 8px; padding: 12px; text-align: center; }\
    .rb-stat-value { font-size: 20px; font-weight: 700; color: #fff; }\
    .rb-stat-label { font-size: 11px; color: #888; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px; }\
    .rb-region-table { width: 100%; border-collapse: collapse; font-size: 13px; }\
    .rb-region-table th { text-align: left; padding: 10px 12px; color: #888; font-weight: 500; border-bottom: 1px solid #2d2d44; }\
    .rb-region-table td { padding: 10px 12px; border-bottom: 1px solid #1e1e36; }\
    .rb-region-table tr:hover td { background: #16213e; }\
    .rb-region-table tr.active td { background: #00d4aa15; color: #00d4aa; font-weight: 600; }\
    .rb-insight { padding: 12px 16px; background: #16213e; border-radius: 8px; border-left: 3px solid #6c5ce7; margin-bottom: 8px; font-size: 13px; line-height: 1.5; }\
  ';

  // ─── Computation ─────────────────────────────────────────────────────

  function computePercentile(rate, data) {
    if (rate <= data.min) return 0;
    if (rate >= data.max) return 100;

    var points = [
      { pct: 0, val: data.min },
      { pct: 25, val: data.p25 },
      { pct: 50, val: data.median },
      { pct: 75, val: data.p75 },
      { pct: 100, val: data.max }
    ];

    for (var i = 1; i < points.length; i++) {
      if (rate <= points[i].val) {
        var range = points[i].val - points[i - 1].val;
        var pos = range > 0 ? (rate - points[i - 1].val) / range : 0;
        return Math.round(points[i - 1].pct + pos * (points[i].pct - points[i - 1].pct));
      }
    }
    return 100;
  }

  function getPercentileColor(pct) {
    if (pct >= 75) return '#00d4aa';
    if (pct >= 50) return '#6c5ce7';
    if (pct >= 25) return '#fdcb6e';
    return '#ff6b6b';
  }

  function generateInsights(rate, data, category, region) {
    var pct = computePercentile(rate, data);
    var insights = [];

    if (pct < 25) {
      insights.push('Your rate of <strong>$' + rate + '/hr</strong> is in the bottom quartile for ' + category + ' in ' + region + '. Consider building your portfolio and collecting reviews to justify a rate increase.');
      insights.push('The median rate is <strong>$' + data.median + '/hr</strong> — you could target this as a near-term goal.');
    } else if (pct < 50) {
      insights.push('You\'re below the median of <strong>$' + data.median + '/hr</strong>. Specializing in a sub-niche or getting platform certifications could help you move up.');
    } else if (pct < 75) {
      insights.push('You\'re above the median — solid positioning. To reach the top quartile (<strong>$' + data.p75 + '+/hr</strong>), focus on case studies and premium client relationships.');
    } else {
      insights.push('You\'re in the <strong>top 25%</strong> of earners in this category/region. Consider further specialization or offering consulting packages to maximize revenue.');
    }

    if (region !== 'Global') {
      var globalData = RATE_DATA[category]['Global'];
      var globalPct = computePercentile(rate, globalData);
      if (Math.abs(globalPct - pct) > 15) {
        insights.push('Globally, you\'d be at the <strong>' + globalPct + 'th percentile</strong> (vs ' + pct + 'th in ' + region + '). ' +
          (globalPct < pct ? 'Your region has lower rate norms — consider targeting clients from higher-rate regions.' : 'Your rate is competitive even globally.'));
      }
    }

    return insights;
  }

  // ─── Render ──────────────────────────────────────────────────────────

  function render(containerId) {
    var container = typeof containerId === 'string'
      ? document.getElementById(containerId) || document.querySelector(containerId)
      : containerId;
    if (!container) return;
    state.container = container;

    var catData = RATE_DATA[state.category] || RATE_DATA['Web Development'];
    var data = catData[state.region] || catData['Global'];
    var pct = computePercentile(state.userRate, data);
    var pctColor = getPercentileColor(pct);
    var insights = generateInsights(state.userRate, data, state.category, state.region);
    var regions = getRegions(state.category);

    var style = document.createElement('style');
    style.textContent = STYLES;

    var html = '<div class="rb-root">';
    html += '<div class="rb-title">Rate Benchmarking</div>';

    // Controls
    html += '<div class="rb-controls">';
    html += '<div class="rb-field"><label>Category</label><select id="rb-cat">';
    CATEGORIES.forEach(function (c) {
      html += '<option value="' + c + '"' + (c === state.category ? ' selected' : '') + '>' + c + '</option>';
    });
    html += '</select></div>';
    html += '<div class="rb-field"><label>Region</label><select id="rb-region">';
    regions.forEach(function (r) {
      html += '<option value="' + r + '"' + (r === state.region ? ' selected' : '') + '>' + r + '</option>';
    });
    html += '</select></div>';
    html += '<div class="rb-field"><label>Your Rate ($/hr)</label><input type="number" id="rb-rate" value="' + state.userRate + '" min="1" max="500"></div>';
    html += '</div>';

    // Percentile display
    html += '<div class="rb-chart">';
    html += '<div class="rb-percentile" style="color:' + pctColor + '">' + pct + '<span style="font-size:24px">th</span></div>';
    html += '<div class="rb-percentile-sub">percentile in ' + state.category + ' — ' + state.region + '</div>';

    // Distribution bar
    var barWidth = 100;
    html += '<div class="rb-distribution" style="margin:24px 20px">';
    // Full range bar
    html += '<div class="rb-dist-bar" style="left:0;width:100%;background:#2d2d44"></div>';
    // IQR bar (P25-P75)
    var iqrLeft = ((data.p25 - data.min) / (data.max - data.min)) * barWidth;
    var iqrWidth = ((data.p75 - data.p25) / (data.max - data.min)) * barWidth;
    html += '<div class="rb-dist-bar" style="left:' + iqrLeft + '%;width:' + iqrWidth + '%;background:#6c5ce733"></div>';
    // Median marker
    var medianPos = ((data.median - data.min) / (data.max - data.min)) * barWidth;
    html += '<div style="position:absolute;top:10px;left:' + medianPos + '%;width:2px;height:24px;background:#6c5ce7;border-radius:1px"></div>';
    html += '<div class="rb-dist-label" style="left:' + medianPos + '%;color:#6c5ce7">Median $' + data.median + '</div>';
    // User marker
    var userPos = Math.max(0, Math.min(100, ((state.userRate - data.min) / (data.max - data.min)) * barWidth));
    html += '<div class="rb-dist-marker" style="left:' + userPos + '%"></div>';
    html += '<div class="rb-dist-marker-label" style="left:' + userPos + '%">You $' + state.userRate + '</div>';
    // Min/Max labels
    html += '<div class="rb-dist-label" style="left:0;transform:none">$' + data.min + '</div>';
    html += '<div class="rb-dist-label" style="left:100%;transform:translateX(-100%)">$' + data.max + '</div>';
    html += '</div>';

    // Stats row
    html += '<div class="rb-stats">';
    html += '<div class="rb-stat"><div class="rb-stat-value">$' + data.min + '</div><div class="rb-stat-label">Minimum</div></div>';
    html += '<div class="rb-stat"><div class="rb-stat-value">$' + data.p25 + '</div><div class="rb-stat-label">25th Pctile</div></div>';
    html += '<div class="rb-stat"><div class="rb-stat-value">$' + data.median + '</div><div class="rb-stat-label">Median</div></div>';
    html += '<div class="rb-stat"><div class="rb-stat-value">$' + data.p75 + '</div><div class="rb-stat-label">75th Pctile</div></div>';
    html += '<div class="rb-stat"><div class="rb-stat-value">$' + data.max + '</div><div class="rb-stat-label">Maximum</div></div>';
    html += '<div class="rb-stat"><div class="rb-stat-value">' + data.sampleSize.toLocaleString() + '</div><div class="rb-stat-label">Sample Size</div></div>';
    html += '</div>';
    html += '</div>';

    // Insights
    insights.forEach(function (insight) {
      html += '<div class="rb-insight">' + insight + '</div>';
    });

    // All regions table
    html += '<div class="rb-chart" style="margin-top:16px">';
    html += '<div style="font-size:15px;font-weight:600;margin-bottom:12px;color:#fff">' + state.category + ' — All Regions</div>';
    html += '<table class="rb-region-table">';
    html += '<tr><th>Region</th><th>Min</th><th>P25</th><th>Median</th><th>P75</th><th>Max</th><th>Your Pctile</th></tr>';
    regions.forEach(function (r) {
      var rd = catData[r];
      var rPct = computePercentile(state.userRate, rd);
      var isActive = r === state.region;
      html += '<tr class="' + (isActive ? 'active' : '') + '">';
      html += '<td>' + r + '</td>';
      html += '<td>$' + rd.min + '</td>';
      html += '<td>$' + rd.p25 + '</td>';
      html += '<td>$' + rd.median + '</td>';
      html += '<td>$' + rd.p75 + '</td>';
      html += '<td>$' + rd.max + '</td>';
      html += '<td style="color:' + getPercentileColor(rPct) + ';font-weight:600">' + rPct + 'th</td>';
      html += '</tr>';
    });
    html += '</table></div>';

    html += '</div>';

    container.innerHTML = '';
    container.appendChild(style);
    var div = document.createElement('div');
    div.innerHTML = html;
    container.appendChild(div);

    // Bind controls
    container.querySelector('#rb-cat').addEventListener('change', function (e) {
      state.category = e.target.value;
      var newRegions = getRegions(state.category);
      if (newRegions.indexOf(state.region) === -1) state.region = 'Global';
      render(containerId);
    });
    container.querySelector('#rb-region').addEventListener('change', function (e) {
      state.region = e.target.value;
      render(containerId);
    });
    container.querySelector('#rb-rate').addEventListener('input', function (e) {
      var val = parseInt(e.target.value, 10);
      if (val > 0) {
        state.userRate = val;
        render(containerId);
      }
    });
  }

  // ─── Public API ──────────────────────────────────────────────────────

  function init(opts) {
    opts = opts || {};
    state.category = opts.category || 'Web Development';
    state.region = opts.region || 'Global';
    state.userRate = opts.userRate || 50;
  }

  function destroy() {
    if (state.container) {
      state.container.innerHTML = '';
      state.container = null;
    }
  }

  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.RateBenchmarking = {
    init: init,
    render: render,
    destroy: destroy,
    setRate: function (rate) { state.userRate = rate; },
    setCategory: function (cat) { state.category = cat; },
    setRegion: function (region) { state.region = region; },
    getPercentile: function () {
      var catData = RATE_DATA[state.category] || RATE_DATA['Web Development'];
      var data = catData[state.region] || catData['Global'];
      return computePercentile(state.userRate, data);
    }
  };
})();
