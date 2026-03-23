/**
 * [UX-009] Revenue Forecasting — Next 3 Months
 * IIFE exposing window.CortexRevenueForecast
 */
(function () {
  'use strict';

  /* ── Helpers ── */

  const SEASONAL = { 1: -0.10, 2: -0.10, 3: -0.10, 4: 0.05, 5: 0.05, 6: 0.05, 7: 0.10, 8: 0.10, 9: 0.10, 10: -0.05, 11: -0.05, 12: -0.05 };

  function monthsBetween(dateA, dateB) {
    var a = new Date(dateA), b = new Date(dateB);
    return Math.max(1, (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()));
  }

  function fmt(n) {
    if (n >= 1000) return '$' + (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return '$' + Math.round(n).toLocaleString('en-US');
  }

  function fmtFull(n) {
    return '$' + Math.round(n).toLocaleString('en-US');
  }

  function getNextMonths(count) {
    var now = new Date(), out = [];
    for (var i = 1; i <= count; i++) {
      var d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      out.push({ month: d.getMonth() + 1, year: d.getFullYear(), label: d.toLocaleString('en-US', { month: 'short', year: 'numeric' }) });
    }
    return out;
  }

  function computeTrend(workHistory) {
    if (!workHistory || workHistory.length < 2) return 1.0;

    // Sort by date descending
    var sorted = workHistory.slice().sort(function (a, b) { return new Date(b.date || b.endDate || 0) - new Date(a.date || a.endDate || 0); });

    // Bucket into months
    var buckets = {};
    sorted.forEach(function (item) {
      var d = new Date(item.date || item.endDate);
      if (isNaN(d.getTime())) return;
      var key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      buckets[key] = (buckets[key] || 0) + (item.earnings || item.amount || 0);
    });

    var keys = Object.keys(buckets).sort().reverse();
    if (keys.length < 4) return 1.0;

    var recent3 = 0, prev3 = 0;
    for (var i = 0; i < Math.min(3, keys.length); i++) recent3 += buckets[keys[i]];
    for (var j = 3; j < Math.min(6, keys.length); j++) prev3 += buckets[keys[j]];

    if (prev3 === 0) return 1.0;
    var ratio = recent3 / prev3;
    // Clamp trend between 0.5 and 2.0 to avoid wild swings
    return Math.max(0.5, Math.min(2.0, ratio));
  }

  /* ── Core Forecast ── */

  function forecast(profileData) {
    var p = profileData || {};
    var hourlyRate = p.hourlyRate || 0;
    var totalEarnings = p.totalEarnings || 0;
    var memberSince = p.memberSince;
    var workHistory = p.workHistory || [];

    var now = new Date();
    var monthsActive = memberSince ? monthsBetween(memberSince, now) : 1;
    var monthlyAvg = totalEarnings / monthsActive;
    var trend = computeTrend(workHistory);

    var nextMonths = getNextMonths(3);
    var months = nextMonths.map(function (m) {
      var seasonal = 1 + (SEASONAL[m.month] || 0);
      var base = monthlyAvg * trend * seasonal;
      var rateIncrease = hourlyRate > 0 ? base * 1.20 : base;
      return {
        month: m.label,
        conservative: Math.round(base * 0.8),
        base: Math.round(base),
        optimistic: Math.round(base * 1.2),
        rateIncrease: Math.round(rateIncrease)
      };
    });

    // Annual projection: avg monthly × 12
    var avgBase = months.reduce(function (s, m) { return s + m.base; }, 0) / months.length;
    var annualProjection = {
      conservative: Math.round(avgBase * 0.8 * 12),
      base: Math.round(avgBase * 12),
      optimistic: Math.round(avgBase * 1.2 * 12)
    };

    var rateAnnual = hourlyRate > 0 ? Math.round(avgBase * 1.2 * 12) : annualProjection.base;
    var insight = 'At current pace you\'ll earn ' + fmtFull(annualProjection.base) + ' this year.';
    if (hourlyRate > 0) {
      insight += ' Raising rate by 20% projects ' + fmtFull(rateAnnual) + '.';
    }

    return {
      monthlyAvg: Math.round(monthlyAvg),
      trend: Math.round(trend * 100) / 100,
      months: months,
      annualProjection: annualProjection,
      insight: insight
    };
  }

  /* ── Renderer ── */

  function renderRevenueForecast(profileData, container) {
    var el = typeof container === 'string' ? document.querySelector(container) : container;
    if (!el) return;

    var p = profileData || {};
    var hasData = (p.totalEarnings && p.totalEarnings > 0) || (p.workHistory && p.workHistory.length > 0);

    if (!hasData) {
      el.innerHTML = renderEmptyState();
      return;
    }

    var data = forecast(profileData);
    el.innerHTML = renderFull(data);
  }

  function renderEmptyState() {
    return '<div class="rf-container">' +
      '<h2 class="rf-header">📈 Revenue Forecast</h2>' +
      '<div class="rf-empty">' +
        '<div class="rf-empty-icon">📊</div>' +
        '<p class="rf-empty-title">Not enough data</p>' +
        '<p class="rf-empty-sub">Complete a few jobs so we can project your earnings.</p>' +
      '</div>' +
    '</div>';
  }

  function renderFull(data) {
    var html = '<div class="rf-container">';
    html += '<style>' + getStyles() + '</style>';
    html += '<h2 class="rf-header">📈 Revenue Forecast</h2>';

    // Stats row
    html += '<div class="rf-stats">';
    html += statCard('Monthly Avg', fmtFull(data.monthlyAvg), '#8b5cf6');
    html += statCard('Trend', (data.trend >= 1 ? '↑' : '↓') + ' ' + Math.round(Math.abs(data.trend - 1) * 100) + '%', data.trend >= 1 ? '#10b981' : '#ef4444');
    html += '</div>';

    // 3-month projection table
    html += '<div class="rf-section-title">3-Month Projection</div>';
    html += '<div class="rf-table-wrap"><table class="rf-table">';
    html += '<thead><tr><th>Month</th><th class="rf-cons">Conservative</th><th class="rf-base">Base</th><th class="rf-opti">Optimistic</th><th class="rf-rate">Rate +20%</th></tr></thead>';
    html += '<tbody>';
    data.months.forEach(function (m) {
      html += '<tr>';
      html += '<td class="rf-month-cell">' + m.month + '</td>';
      html += '<td class="rf-cons">' + fmt(m.conservative) + '</td>';
      html += '<td class="rf-base">' + fmt(m.base) + '</td>';
      html += '<td class="rf-opti">' + fmt(m.optimistic) + '</td>';
      html += '<td class="rf-rate">' + fmt(m.rateIncrease) + '</td>';
      html += '</tr>';
    });
    html += '</tbody></table></div>';

    // Bar chart
    html += '<div class="rf-section-title">Visual Comparison</div>';
    html += '<div class="rf-chart">';
    var maxVal = 0;
    data.months.forEach(function (m) { maxVal = Math.max(maxVal, m.optimistic, m.rateIncrease); });
    data.months.forEach(function (m) {
      html += '<div class="rf-chart-group">';
      html += '<div class="rf-chart-label">' + m.month + '</div>';
      html += '<div class="rf-bars">';
      html += bar(m.conservative, maxVal, '#f59e0b', 'Cons');
      html += bar(m.base, maxVal, '#8b5cf6', 'Base');
      html += bar(m.optimistic, maxVal, '#10b981', 'Opti');
      html += bar(m.rateIncrease, maxVal, '#06b6d4', '+20%');
      html += '</div></div>';
    });
    html += '</div>';

    // Annual projections
    html += '<div class="rf-section-title">Annual Projection</div>';
    html += '<div class="rf-annual">';
    html += annualCard('Conservative', fmtFull(data.annualProjection.conservative), '#f59e0b');
    html += annualCard('Base', fmtFull(data.annualProjection.base), '#8b5cf6');
    html += annualCard('Optimistic', fmtFull(data.annualProjection.optimistic), '#10b981');
    html += '</div>';

    // Insight
    html += '<div class="rf-insight">';
    html += '<div class="rf-insight-icon">💡</div>';
    html += '<div class="rf-insight-body">';
    html += '<div class="rf-insight-title">Growth Lever</div>';
    html += '<p>' + data.insight + '</p>';
    html += '</div></div>';

    html += '</div>';
    return html;
  }

  function statCard(label, value, color) {
    return '<div class="rf-stat">' +
      '<div class="rf-stat-value" style="color:' + color + '">' + value + '</div>' +
      '<div class="rf-stat-label">' + label + '</div>' +
    '</div>';
  }

  function bar(value, max, color, label) {
    var pct = max > 0 ? Math.round((value / max) * 100) : 0;
    return '<div class="rf-bar-row">' +
      '<span class="rf-bar-label">' + label + '</span>' +
      '<div class="rf-bar-track"><div class="rf-bar-fill" style="width:' + pct + '%;background:' + color + '"></div></div>' +
      '<span class="rf-bar-val">' + fmt(value) + '</span>' +
    '</div>';
  }

  function annualCard(label, value, color) {
    return '<div class="rf-annual-card" style="border-color:' + color + '">' +
      '<div class="rf-annual-val" style="color:' + color + '">' + value + '</div>' +
      '<div class="rf-annual-label">' + label + '</div>' +
    '</div>';
  }

  /* ── Styles ── */

  function getStyles() {
    return '' +
    '.rf-container{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#e2e8f0;max-width:680px}' +
    '.rf-header{font-size:1.25rem;font-weight:700;margin:0 0 16px;color:#f1f5f9}' +
    '.rf-section-title{font-size:.8rem;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:#94a3b8;margin:20px 0 10px}' +
    '.rf-stats{display:flex;gap:12px;margin-bottom:8px}' +
    '.rf-stat{flex:1;background:#1e293b;border-radius:10px;padding:14px;text-align:center}' +
    '.rf-stat-value{font-size:1.3rem;font-weight:700}' +
    '.rf-stat-label{font-size:.75rem;color:#94a3b8;margin-top:4px}' +
    '.rf-table-wrap{overflow-x:auto}' +
    '.rf-table{width:100%;border-collapse:collapse;font-size:.85rem}' +
    '.rf-table th,.rf-table td{padding:8px 10px;text-align:right;border-bottom:1px solid #1e293b}' +
    '.rf-table th{color:#64748b;font-weight:600;font-size:.75rem;text-transform:uppercase}' +
    '.rf-table td:first-child,.rf-table th:first-child{text-align:left}' +
    '.rf-month-cell{font-weight:600;color:#f1f5f9}' +
    '.rf-cons{color:#f59e0b}' +
    '.rf-base{color:#8b5cf6}' +
    '.rf-opti{color:#10b981}' +
    '.rf-rate{color:#06b6d4}' +
    '.rf-chart{display:flex;flex-direction:column;gap:16px}' +
    '.rf-chart-group{background:#1e293b;border-radius:10px;padding:12px 14px}' +
    '.rf-chart-label{font-size:.8rem;font-weight:600;margin-bottom:8px;color:#f1f5f9}' +
    '.rf-bars{display:flex;flex-direction:column;gap:6px}' +
    '.rf-bar-row{display:flex;align-items:center;gap:8px}' +
    '.rf-bar-label{font-size:.7rem;color:#94a3b8;width:32px;text-align:right;flex-shrink:0}' +
    '.rf-bar-track{flex:1;height:14px;background:#0f172a;border-radius:7px;overflow:hidden}' +
    '.rf-bar-fill{height:100%;border-radius:7px;transition:width .4s ease}' +
    '.rf-bar-val{font-size:.7rem;color:#cbd5e1;width:44px;text-align:right;flex-shrink:0}' +
    '.rf-annual{display:flex;gap:10px}' +
    '.rf-annual-card{flex:1;background:#1e293b;border-radius:10px;padding:14px;text-align:center;border-top:3px solid}' +
    '.rf-annual-val{font-size:1.1rem;font-weight:700}' +
    '.rf-annual-label{font-size:.7rem;color:#94a3b8;margin-top:4px}' +
    '.rf-insight{display:flex;gap:12px;align-items:flex-start;background:#1e293b;border-radius:10px;padding:14px;margin-top:20px;border-left:3px solid #f59e0b}' +
    '.rf-insight-icon{font-size:1.3rem;flex-shrink:0}' +
    '.rf-insight-title{font-weight:700;font-size:.85rem;color:#f59e0b;margin-bottom:4px}' +
    '.rf-insight-body p{margin:0;font-size:.8rem;color:#cbd5e1;line-height:1.5}' +
    '.rf-empty{text-align:center;padding:40px 20px;background:#1e293b;border-radius:12px}' +
    '.rf-empty-icon{font-size:2.5rem;margin-bottom:12px}' +
    '.rf-empty-title{font-size:1rem;font-weight:600;color:#f1f5f9;margin:0 0 6px}' +
    '.rf-empty-sub{font-size:.8rem;color:#64748b;margin:0}' +
    '';
  }

  /* ── Export ── */

  window.CortexRevenueForecast = {
    forecast: forecast,
    renderRevenueForecast: renderRevenueForecast
  };

})();
