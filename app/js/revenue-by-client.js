/**
 * [CF-054] Revenue by Client Pie Chart
 * Visualize revenue distribution across clients, flag over-dependency
 * on any single client (>30% threshold). SVG donut chart with
 * Herfindahl-Hirschman Index diversification scoring.
 * Exposed on window.CortexFreelancer.revenueByClient
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_revenue_by_client';
  var DEPENDENCY_THRESHOLD = 30;

  var COLORS = [
    '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6',
    '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6', '#f97316',
    '#84cc16', '#a855f7'
  ];

  /* ── Mock Data ── */

  function generateMockData() {
    return [
      { client: 'Acme Corp', revenue: 28500, projects: 6, invoices: 12 },
      { client: 'TechFlow Inc', revenue: 18200, projects: 4, invoices: 8 },
      { client: 'DataVerse', revenue: 14800, projects: 3, invoices: 6 },
      { client: 'CloudNine Solutions', revenue: 9600, projects: 2, invoices: 5 },
      { client: 'NovaTech', revenue: 7400, projects: 2, invoices: 4 },
      { client: 'BlueShift Labs', revenue: 6200, projects: 1, invoices: 3 },
      { client: 'Meridian Digital', revenue: 5100, projects: 2, invoices: 4 },
      { client: 'Apex Systems', revenue: 3800, projects: 1, invoices: 2 },
      { client: 'VectorWave', revenue: 2900, projects: 1, invoices: 2 },
      { client: 'Stratos AI', revenue: 1500, projects: 1, invoices: 1 }
    ];
  }

  /* ── Storage ── */

  function loadData() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore */ }
    var data = generateMockData();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return data;
  }

  /* ── Helpers ── */

  function fmtCurrency(n) {
    if (n >= 1000) return '$' + (n / 1000).toFixed(1) + 'K';
    return '$' + Math.round(n);
  }

  /* ── Analytics ── */

  function computeDistribution(clients) {
    var total = 0;
    for (var i = 0; i < clients.length; i++) total += clients[i].revenue;

    var sorted = clients.slice().sort(function (a, b) { return b.revenue - a.revenue; });
    var results = [];

    for (var j = 0; j < sorted.length; j++) {
      var c = sorted[j];
      var pct = total > 0 ? (c.revenue / total) * 100 : 0;
      results.push({
        client: c.client,
        revenue: c.revenue,
        projects: c.projects,
        invoices: c.invoices,
        percentage: pct,
        isOverDependent: pct >= DEPENDENCY_THRESHOLD,
        color: COLORS[j % COLORS.length]
      });
    }

    return { clients: results, totalRevenue: total };
  }

  /* ── SVG Pie Chart ── */

  function renderPieChart(distribution) {
    var size = 260;
    var cx = size / 2;
    var cy = size / 2;
    var radius = 100;
    var innerRadius = 60;

    var html = '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '">';

    var startAngle = -Math.PI / 2;
    for (var i = 0; i < distribution.clients.length; i++) {
      var item = distribution.clients[i];
      var sliceAngle = (item.percentage / 100) * 2 * Math.PI;
      var endAngle = startAngle + sliceAngle;

      var x1 = cx + radius * Math.cos(startAngle);
      var y1 = cy + radius * Math.sin(startAngle);
      var x2 = cx + radius * Math.cos(endAngle);
      var y2 = cy + radius * Math.sin(endAngle);
      var ix1 = cx + innerRadius * Math.cos(endAngle);
      var iy1 = cy + innerRadius * Math.sin(endAngle);
      var ix2 = cx + innerRadius * Math.cos(startAngle);
      var iy2 = cy + innerRadius * Math.sin(startAngle);
      var largeArc = sliceAngle > Math.PI ? 1 : 0;

      var d = 'M ' + x1 + ' ' + y1
        + ' A ' + radius + ' ' + radius + ' 0 ' + largeArc + ' 1 ' + x2 + ' ' + y2
        + ' L ' + ix1 + ' ' + iy1
        + ' A ' + innerRadius + ' ' + innerRadius + ' 0 ' + largeArc + ' 0 ' + ix2 + ' ' + iy2
        + ' Z';

      html += '<path d="' + d + '" fill="' + item.color + '" opacity="0.85">'
        + '<title>' + item.client + ': ' + item.percentage.toFixed(1) + '%</title></path>';

      startAngle = endAngle;
    }

    html += '<text x="' + cx + '" y="' + (cy - 8) + '" text-anchor="middle" fill="#f1f5f9" font-size="18" font-weight="700">'
      + fmtCurrency(distribution.totalRevenue) + '</text>';
    html += '<text x="' + cx + '" y="' + (cy + 12) + '" text-anchor="middle" fill="#64748b" font-size="11">Total Revenue</text>';
    html += '</svg>';

    return html;
  }

  /* ── Rendering ── */

  function renderDependencyAlerts(distribution) {
    var alerts = distribution.clients.filter(function (c) { return c.isOverDependent; });
    if (alerts.length === 0) return '';

    var html = '<div style="background:#7f1d1d33;border:1px solid #7f1d1d;border-radius:10px;padding:16px;margin-bottom:24px;">';
    html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">'
      + '<span style="font-size:16px;">&#9888;</span>'
      + '<span style="font-size:14px;font-weight:600;color:#fca5a5;">Client Dependency Warning</span></div>';

    for (var i = 0; i < alerts.length; i++) {
      html += '<div style="font-size:13px;color:#fca5a5;margin-bottom:4px;">'
        + '<strong>' + alerts[i].client + '</strong> accounts for '
        + alerts[i].percentage.toFixed(1) + '% of your revenue. '
        + 'Consider diversifying to reduce risk.</div>';
    }

    html += '</div>';
    return html;
  }

  function renderLegendTable(distribution) {
    var html = '<div style="background:#1e293b;border-radius:10px;padding:20px;">';
    html += '<table style="width:100%;border-collapse:collapse;font-size:13px;">';
    html += '<thead><tr style="border-bottom:1px solid #334155;">'
      + '<th style="text-align:left;padding:8px;color:#64748b;font-weight:500;">Client</th>'
      + '<th style="text-align:right;padding:8px;color:#64748b;font-weight:500;">Revenue</th>'
      + '<th style="text-align:right;padding:8px;color:#64748b;font-weight:500;">Share</th>'
      + '<th style="text-align:right;padding:8px;color:#64748b;font-weight:500;">Projects</th>'
      + '<th style="text-align:right;padding:8px;color:#64748b;font-weight:500;">Invoices</th>'
      + '</tr></thead><tbody>';

    for (var i = 0; i < distribution.clients.length; i++) {
      var c = distribution.clients[i];
      html += '<tr style="border-bottom:1px solid #1e293b44;">'
        + '<td style="padding:8px;"><div style="display:flex;align-items:center;gap:8px;">'
        + '<span style="width:10px;height:10px;border-radius:3px;background:' + c.color + ';flex-shrink:0;"></span>'
        + '<span style="color:#e2e8f0;font-weight:500;">' + c.client + '</span>'
        + (c.isOverDependent ? ' <span style="padding:1px 6px;border-radius:8px;font-size:10px;background:#ef444422;color:#ef4444;font-weight:600;">HIGH</span>' : '')
        + '</div></td>'
        + '<td style="padding:8px;color:#f1f5f9;text-align:right;font-weight:600;">$' + c.revenue.toLocaleString() + '</td>'
        + '<td style="padding:8px;text-align:right;">'
        + '<span style="color:' + (c.isOverDependent ? '#ef4444' : '#94a3b8') + ';font-weight:' + (c.isOverDependent ? '600' : '400') + ';">'
        + c.percentage.toFixed(1) + '%</span></td>'
        + '<td style="padding:8px;color:#94a3b8;text-align:right;">' + c.projects + '</td>'
        + '<td style="padding:8px;color:#94a3b8;text-align:right;">' + c.invoices + '</td>'
        + '</tr>';
    }

    html += '</tbody></table></div>';
    return html;
  }

  function renderDiversificationScore(distribution) {
    var hhi = 0;
    for (var i = 0; i < distribution.clients.length; i++) {
      var share = distribution.clients[i].percentage / 100;
      hhi += share * share;
    }
    var score = Math.round((1 - hhi) * 100);
    var scoreColor = score >= 70 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';
    var scoreLabel = score >= 70 ? 'Healthy' : score >= 50 ? 'Moderate Risk' : 'High Risk';

    var html = '<div style="background:#1e293b;border-radius:10px;padding:20px;margin-bottom:24px;">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
    html += '<div><h3 style="margin:0;font-size:14px;font-weight:600;color:#94a3b8;">DIVERSIFICATION SCORE</h3>'
      + '<p style="margin:4px 0 0;font-size:12px;color:#64748b;">Based on Herfindahl-Hirschman Index</p></div>';
    html += '<div style="text-align:right;">'
      + '<div style="font-size:32px;font-weight:700;color:' + scoreColor + ';">' + score + '</div>'
      + '<div style="font-size:12px;color:' + scoreColor + ';font-weight:600;">' + scoreLabel + '</div></div>';
    html += '</div>';
    html += '<div style="height:6px;background:#0f172a;border-radius:3px;margin-top:12px;overflow:hidden;">'
      + '<div style="width:' + score + '%;height:100%;background:' + scoreColor + ';border-radius:3px;"></div></div>';
    html += '</div>';
    return html;
  }

  function render(containerId) {
    var data = loadData();
    var distribution = computeDistribution(data);

    var html = '<div style="background:#0f172a;color:#e2e8f0;padding:24px;border-radius:12px;font-family:system-ui,-apple-system,sans-serif;">';
    html += '<div style="margin-bottom:20px;">'
      + '<h2 style="margin:0;font-size:20px;font-weight:700;color:#f1f5f9;">Revenue by Client</h2>'
      + '<p style="margin:4px 0 0;font-size:13px;color:#64748b;">Revenue distribution and client dependency analysis</p></div>';

    html += renderDependencyAlerts(distribution);
    html += renderDiversificationScore(distribution);

    html += '<div style="display:grid;grid-template-columns:280px 1fr;gap:24px;margin-bottom:24px;align-items:start;">';
    html += '<div style="background:#1e293b;border-radius:10px;padding:20px;display:flex;justify-content:center;">'
      + renderPieChart(distribution) + '</div>';
    html += '<div>';

    var top3 = distribution.clients.slice(0, 3);
    var top3Rev = 0;
    for (var i = 0; i < top3.length; i++) top3Rev += top3[i].revenue;
    var top3Pct = ((top3Rev / distribution.totalRevenue) * 100).toFixed(1);

    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">';
    html += '<div style="background:#1e293b;border-radius:10px;padding:16px;">'
      + '<div style="font-size:12px;color:#64748b;">Total Clients</div>'
      + '<div style="font-size:24px;font-weight:700;color:#f1f5f9;">' + distribution.clients.length + '</div></div>';
    html += '<div style="background:#1e293b;border-radius:10px;padding:16px;">'
      + '<div style="font-size:12px;color:#64748b;">Top 3 Concentration</div>'
      + '<div style="font-size:24px;font-weight:700;color:' + (parseFloat(top3Pct) > 70 ? '#f59e0b' : '#10b981') + ';">' + top3Pct + '%</div></div>';
    html += '<div style="background:#1e293b;border-radius:10px;padding:16px;">'
      + '<div style="font-size:12px;color:#64748b;">Avg per Client</div>'
      + '<div style="font-size:24px;font-weight:700;color:#f1f5f9;">' + fmtCurrency(distribution.totalRevenue / distribution.clients.length) + '</div></div>';
    html += '<div style="background:#1e293b;border-radius:10px;padding:16px;">'
      + '<div style="font-size:12px;color:#64748b;">Total Revenue</div>'
      + '<div style="font-size:24px;font-weight:700;color:#f1f5f9;">' + fmtCurrency(distribution.totalRevenue) + '</div></div>';
    html += '</div></div></div>';

    html += renderLegendTable(distribution);
    html += '</div>';

    var container = document.getElementById(containerId);
    if (container) container.innerHTML = html;
    return html;
  }

  function init(containerId) {
    return render(containerId || 'revenue-by-client');
  }

  /* ── Export ── */
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.revenueByClient = {
    init: init,
    render: render,
    loadData: loadData,
    computeDistribution: computeDistribution
  };
})();
