/**
 * [CF-055] Earnings Projection with Trend Analysis
 * Use historical data to project next 3/6/12 month earnings with
 * confidence intervals and trend visualization.
 * Exposed on window.CortexFreelancer.earningsProjectionTrends
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_earnings_projections';
  var MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  /* ── Mock Data ── */

  function generateHistoricalData() {
    var months = [];
    var now = new Date();
    var base = 6000;

    for (var i = 23; i >= 0; i--) {
      var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      var seasonal = Math.sin((d.getMonth() / 12) * Math.PI * 2) * 800;
      var trend = (24 - i) * 120;
      var noise = (Math.random() - 0.5) * 1500;
      var revenue = Math.max(2000, Math.round(base + seasonal + trend + noise));

      months.push({
        year: d.getFullYear(),
        month: d.getMonth(),
        label: MONTH_LABELS[d.getMonth()] + ' ' + d.getFullYear(),
        revenue: revenue,
        projects: Math.floor(Math.random() * 4) + 1,
        clients: Math.floor(Math.random() * 3) + 1
      });
    }

    return months;
  }

  /* ── Storage ── */

  function loadData() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore */ }
    var data = generateHistoricalData();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return data;
  }

  /* ── Helpers ── */

  function fmtCurrency(n) {
    if (n >= 1000000) return '$' + (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return '$' + (n / 1000).toFixed(1) + 'K';
    return '$' + Math.round(n);
  }

  /* ── Trend Analysis ── */

  function linearRegression(data) {
    var n = data.length;
    var sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

    for (var i = 0; i < n; i++) {
      sumX += i;
      sumY += data[i].revenue;
      sumXY += i * data[i].revenue;
      sumX2 += i * i;
    }

    var slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    var intercept = (sumY - slope * sumX) / n;

    var residuals = [];
    for (var j = 0; j < n; j++) {
      var predicted = intercept + slope * j;
      residuals.push(data[j].revenue - predicted);
    }

    var sumResidSq = 0;
    for (var k = 0; k < residuals.length; k++) {
      sumResidSq += residuals[k] * residuals[k];
    }
    var stdError = Math.sqrt(sumResidSq / (n - 2));

    return { slope: slope, intercept: intercept, stdError: stdError };
  }

  function generateProjections(historical, months) {
    var reg = linearRegression(historical);
    var n = historical.length;
    var now = new Date();
    var projections = [];

    for (var i = 1; i <= months; i++) {
      var x = n + i - 1;
      var predicted = reg.intercept + reg.slope * x;
      var confidence = reg.stdError * 1.96 * Math.sqrt(1 + 1 / n + Math.pow(x - (n - 1) / 2, 2) / (n * n / 12));

      var futureDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
      projections.push({
        label: MONTH_LABELS[futureDate.getMonth()] + ' ' + futureDate.getFullYear(),
        predicted: Math.max(0, Math.round(predicted)),
        upper: Math.round(predicted + confidence),
        lower: Math.max(0, Math.round(predicted - confidence)),
        confidence: confidence,
        monthsOut: i
      });
    }

    return { projections: projections, trend: reg };
  }

  /* ── SVG Chart ── */

  function renderTrendChart(historical, projections) {
    var allValues = [];
    for (var i = 0; i < historical.length; i++) allValues.push(historical[i].revenue);
    for (var j = 0; j < projections.length; j++) {
      allValues.push(projections[j].upper);
      allValues.push(projections[j].lower);
    }

    var maxVal = Math.max.apply(null, allValues) * 1.1;
    var minVal = Math.min.apply(null, allValues) * 0.8;
    var range = maxVal - minVal || 1;

    var width = 800;
    var height = 280;
    var padL = 60, padR = 20, padT = 20, padB = 40;
    var chartW = width - padL - padR;
    var chartH = height - padT - padB;
    var totalPoints = historical.length + projections.length;
    var stepX = chartW / (totalPoints - 1);

    function xPos(idx) { return padL + idx * stepX; }
    function yPos(val) { return padT + chartH - ((val - minVal) / range) * chartH; }

    var svg = '<svg width="100%" viewBox="0 0 ' + width + ' ' + height + '" style="max-width:100%;">';

    // grid lines
    for (var g = 0; g <= 4; g++) {
      var gy = padT + (g / 4) * chartH;
      var gVal = maxVal - (g / 4) * range;
      svg += '<line x1="' + padL + '" y1="' + gy + '" x2="' + (width - padR) + '" y2="' + gy
        + '" stroke="#1e293b" stroke-width="1"/>';
      svg += '<text x="' + (padL - 8) + '" y="' + (gy + 4) + '" text-anchor="end" fill="#64748b" font-size="10">'
        + fmtCurrency(gVal) + '</text>';
    }

    // confidence band
    if (projections.length > 0) {
      var bandPath = 'M ' + xPos(historical.length) + ' ' + yPos(projections[0].upper);
      for (var b = 0; b < projections.length; b++) {
        bandPath += ' L ' + xPos(historical.length + b) + ' ' + yPos(projections[b].upper);
      }
      for (var b2 = projections.length - 1; b2 >= 0; b2--) {
        bandPath += ' L ' + xPos(historical.length + b2) + ' ' + yPos(projections[b2].lower);
      }
      bandPath += ' Z';
      svg += '<path d="' + bandPath + '" fill="#6366f1" opacity="0.15"/>';
    }

    // historical line
    var histPath = '';
    for (var h = 0; h < historical.length; h++) {
      histPath += (h === 0 ? 'M ' : ' L ') + xPos(h) + ' ' + yPos(historical[h].revenue);
    }
    svg += '<path d="' + histPath + '" fill="none" stroke="#10b981" stroke-width="2.5"/>';

    // projection line
    if (projections.length > 0) {
      var projPath = 'M ' + xPos(historical.length - 1) + ' ' + yPos(historical[historical.length - 1].revenue);
      for (var p = 0; p < projections.length; p++) {
        projPath += ' L ' + xPos(historical.length + p) + ' ' + yPos(projections[p].predicted);
      }
      svg += '<path d="' + projPath + '" fill="none" stroke="#6366f1" stroke-width="2.5" stroke-dasharray="6,4"/>';
    }

    // divider line
    var divX = xPos(historical.length - 0.5);
    svg += '<line x1="' + divX + '" y1="' + padT + '" x2="' + divX + '" y2="' + (height - padB)
      + '" stroke="#475569" stroke-width="1" stroke-dasharray="4,4"/>';
    svg += '<text x="' + divX + '" y="' + (height - 5) + '" text-anchor="middle" fill="#94a3b8" font-size="10">Today</text>';

    // x-axis labels (every 3 months)
    for (var xl = 0; xl < totalPoints; xl += 3) {
      var label = xl < historical.length ? historical[xl].label : projections[xl - historical.length].label;
      svg += '<text x="' + xPos(xl) + '" y="' + (height - padB + 18) + '" text-anchor="middle" fill="#64748b" font-size="9">'
        + label + '</text>';
    }

    // dots on historical
    for (var dot = 0; dot < historical.length; dot++) {
      svg += '<circle cx="' + xPos(dot) + '" cy="' + yPos(historical[dot].revenue)
        + '" r="3" fill="#10b981" opacity="0.7"/>';
    }

    svg += '</svg>';
    return svg;
  }

  /* ── Rendering ── */

  function renderProjectionCards(projections3, projections6, projections12) {
    function sumProjected(arr) {
      var s = 0;
      for (var i = 0; i < arr.length; i++) s += arr[i].predicted;
      return s;
    }
    function sumRange(arr) {
      var lo = 0, hi = 0;
      for (var i = 0; i < arr.length; i++) { lo += arr[i].lower; hi += arr[i].upper; }
      return { lower: lo, upper: hi };
    }

    var periods = [
      { label: '3-Month Projection', data: projections3, color: '#3b82f6' },
      { label: '6-Month Projection', data: projections6, color: '#8b5cf6' },
      { label: '12-Month Projection', data: projections12, color: '#6366f1' }
    ];

    var html = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-bottom:24px;">';
    for (var i = 0; i < periods.length; i++) {
      var p = periods[i];
      var total = sumProjected(p.data);
      var range = sumRange(p.data);
      html += '<div style="background:#1e293b;border-radius:10px;padding:18px;border-top:3px solid ' + p.color + ';">'
        + '<div style="font-size:12px;color:#64748b;margin-bottom:6px;">' + p.label + '</div>'
        + '<div style="font-size:26px;font-weight:700;color:#f1f5f9;">' + fmtCurrency(total) + '</div>'
        + '<div style="font-size:11px;color:#475569;margin-top:4px;">Range: ' + fmtCurrency(range.lower) + ' – ' + fmtCurrency(range.upper) + '</div>'
        + '<div style="font-size:11px;color:#475569;">Avg/mo: ' + fmtCurrency(total / p.data.length) + '</div>'
        + '</div>';
    }
    html += '</div>';
    return html;
  }

  function renderTrendStats(historical, trend) {
    var recent6 = historical.slice(-6);
    var prev6 = historical.slice(-12, -6);
    var recentAvg = 0, prevAvg = 0;
    for (var i = 0; i < recent6.length; i++) recentAvg += recent6[i].revenue;
    for (var j = 0; j < prev6.length; j++) prevAvg += prev6[j].revenue;
    recentAvg = recentAvg / (recent6.length || 1);
    prevAvg = prevAvg / (prev6.length || 1);
    var growth = prevAvg > 0 ? ((recentAvg - prevAvg) / prevAvg * 100).toFixed(1) : '0';
    var trendDir = trend.slope > 0 ? 'Upward' : trend.slope < 0 ? 'Downward' : 'Flat';
    var trendColor = trend.slope > 0 ? '#10b981' : trend.slope < 0 ? '#ef4444' : '#f59e0b';

    var html = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:24px;">';
    html += '<div style="background:#1e293b;border-radius:10px;padding:16px;">'
      + '<div style="font-size:12px;color:#64748b;">Monthly Trend</div>'
      + '<div style="font-size:20px;font-weight:700;color:' + trendColor + ';">' + trendDir + '</div>'
      + '<div style="font-size:11px;color:#475569;">' + (trend.slope > 0 ? '+' : '') + fmtCurrency(trend.slope) + '/mo</div></div>';
    html += '<div style="background:#1e293b;border-radius:10px;padding:16px;">'
      + '<div style="font-size:12px;color:#64748b;">6-Month Growth</div>'
      + '<div style="font-size:20px;font-weight:700;color:' + (parseFloat(growth) >= 0 ? '#10b981' : '#ef4444') + ';">'
      + (parseFloat(growth) >= 0 ? '+' : '') + growth + '%</div>'
      + '<div style="font-size:11px;color:#475569;">vs previous 6 months</div></div>';
    html += '<div style="background:#1e293b;border-radius:10px;padding:16px;">'
      + '<div style="font-size:12px;color:#64748b;">Recent Avg</div>'
      + '<div style="font-size:20px;font-weight:700;color:#f1f5f9;">' + fmtCurrency(recentAvg) + '/mo</div>'
      + '<div style="font-size:11px;color:#475569;">Last 6 months</div></div>';
    html += '<div style="background:#1e293b;border-radius:10px;padding:16px;">'
      + '<div style="font-size:12px;color:#64748b;">Forecast Uncertainty</div>'
      + '<div style="font-size:20px;font-weight:700;color:#f59e0b;">±' + fmtCurrency(trend.stdError) + '</div>'
      + '<div style="font-size:11px;color:#475569;">Standard error</div></div>';
    html += '</div>';
    return html;
  }

  function renderMonthlyTable(projections) {
    var html = '<div style="background:#1e293b;border-radius:10px;padding:20px;">';
    html += '<h3 style="margin:0 0 12px;font-size:14px;font-weight:600;color:#94a3b8;">MONTHLY PROJECTION DETAILS</h3>';
    html += '<table style="width:100%;border-collapse:collapse;font-size:13px;">';
    html += '<thead><tr style="border-bottom:1px solid #334155;">'
      + '<th style="text-align:left;padding:8px;color:#64748b;font-weight:500;">Month</th>'
      + '<th style="text-align:right;padding:8px;color:#64748b;font-weight:500;">Projected</th>'
      + '<th style="text-align:right;padding:8px;color:#64748b;font-weight:500;">Low Estimate</th>'
      + '<th style="text-align:right;padding:8px;color:#64748b;font-weight:500;">High Estimate</th>'
      + '<th style="text-align:right;padding:8px;color:#64748b;font-weight:500;">Confidence Range</th>'
      + '</tr></thead><tbody>';

    for (var i = 0; i < projections.length; i++) {
      var p = projections[i];
      html += '<tr style="border-bottom:1px solid #1e293b44;">'
        + '<td style="padding:8px;color:#e2e8f0;font-weight:500;">' + p.label + '</td>'
        + '<td style="padding:8px;color:#6366f1;text-align:right;font-weight:600;">' + fmtCurrency(p.predicted) + '</td>'
        + '<td style="padding:8px;color:#64748b;text-align:right;">' + fmtCurrency(p.lower) + '</td>'
        + '<td style="padding:8px;color:#64748b;text-align:right;">' + fmtCurrency(p.upper) + '</td>'
        + '<td style="padding:8px;color:#94a3b8;text-align:right;">±' + fmtCurrency(p.confidence) + '</td>'
        + '</tr>';
    }

    html += '</tbody></table></div>';
    return html;
  }

  function render(containerId) {
    var historical = loadData();
    var proj3 = generateProjections(historical, 3);
    var proj6 = generateProjections(historical, 6);
    var proj12 = generateProjections(historical, 12);

    var html = '<div style="background:#0f172a;color:#e2e8f0;padding:24px;border-radius:12px;font-family:system-ui,-apple-system,sans-serif;">';
    html += '<div style="margin-bottom:20px;">'
      + '<h2 style="margin:0;font-size:20px;font-weight:700;color:#f1f5f9;">Earnings Projection & Trends</h2>'
      + '<p style="margin:4px 0 0;font-size:13px;color:#64748b;">Historical analysis with 95% confidence interval projections</p></div>';

    html += renderTrendStats(historical, proj12.trend);
    html += renderProjectionCards(proj3.projections, proj6.projections, proj12.projections);

    html += '<div style="background:#1e293b;border-radius:10px;padding:20px;margin-bottom:24px;">'
      + '<h3 style="margin:0 0 12px;font-size:14px;font-weight:600;color:#94a3b8;">EARNINGS TREND & FORECAST</h3>'
      + '<div style="display:flex;gap:16px;margin-bottom:12px;font-size:12px;">'
      + '<span style="display:flex;align-items:center;gap:4px;color:#94a3b8;">'
      + '<span style="width:20px;height:2px;background:#10b981;"></span> Historical</span>'
      + '<span style="display:flex;align-items:center;gap:4px;color:#94a3b8;">'
      + '<span style="width:20px;height:2px;background:#6366f1;border-top:1px dashed #6366f1;"></span> Projected</span>'
      + '<span style="display:flex;align-items:center;gap:4px;color:#94a3b8;">'
      + '<span style="width:14px;height:8px;background:#6366f122;border-radius:2px;"></span> 95% CI</span></div>'
      + renderTrendChart(historical, proj12.projections) + '</div>';

    html += renderMonthlyTable(proj12.projections);
    html += '</div>';

    var container = document.getElementById(containerId);
    if (container) container.innerHTML = html;
    return html;
  }

  function init(containerId) {
    return render(containerId || 'earnings-projection-trends');
  }

  /* ── Export ── */
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.earningsProjectionTrends = {
    init: init,
    render: render,
    loadData: loadData,
    generateProjections: generateProjections
  };
})();
