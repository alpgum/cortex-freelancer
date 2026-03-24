/**
 * CF-054: Revenue by Client Pie Chart
 * Visualize revenue distribution across clients using SVG pie chart.
 * Flags over-dependency when a single client accounts for >50% of revenue.
 *
 * @namespace window.CortexFreelancer.RevenueClientPie
 */
(function () {
  'use strict';

  var ns = (window.CortexFreelancer = window.CortexFreelancer || {});

  var STORAGE_KEY = 'cortex_revenue_client_pie';

  // ─── Mock Data ────────────────────────────────────────

  var MOCK_CLIENTS = [
    { name: 'Acme Corp',        revenue: 18500, color: '#6366f1' },
    { name: 'TechStart Inc',    revenue: 12200, color: '#10b981' },
    { name: 'Global Media',     revenue: 8700,  color: '#f59e0b' },
    { name: 'DataFlow Labs',    revenue: 5400,  color: '#ef4444' },
    { name: 'Summit Partners',  revenue: 3800,  color: '#8b5cf6' },
    { name: 'Freelance Direct', revenue: 2100,  color: '#06b6d4' },
    { name: 'Other',            revenue: 1300,  color: '#94a3b8' }
  ];

  var DEPENDENCY_THRESHOLD = 50; // percent

  // ─── Storage ──────────────────────────────────────────

  function loadData() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function saveData(data) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
    catch (e) {}
  }

  // ─── Calculation ──────────────────────────────────────

  function analyzeRevenue(clients) {
    var total = 0;
    for (var i = 0; i < clients.length; i++) {
      total += parseFloat(clients[i].revenue) || 0;
    }

    var sorted = clients.slice().sort(function (a, b) { return b.revenue - a.revenue; });
    var analyzed = [];
    var warnings = [];

    for (var j = 0; j < sorted.length; j++) {
      var c = sorted[j];
      var rev = parseFloat(c.revenue) || 0;
      var pct = total > 0 ? (rev / total) * 100 : 0;
      analyzed.push({
        name: c.name,
        revenue: rev,
        color: c.color || '#94a3b8',
        percent: pct
      });
      if (pct > DEPENDENCY_THRESHOLD) {
        warnings.push({
          client: c.name,
          percent: pct,
          message: c.name + ' accounts for ' + pct.toFixed(1) + '% of revenue — high dependency risk!'
        });
      }
    }

    return {
      clients: analyzed,
      total: total,
      warnings: warnings,
      topClient: analyzed.length > 0 ? analyzed[0] : null,
      clientCount: analyzed.filter(function (c) { return c.revenue > 0; }).length
    };
  }

  // ─── SVG Pie Chart ────────────────────────────────────

  function renderPieChart(clients, size) {
    var cx = size / 2;
    var cy = size / 2;
    var radius = size / 2 - 10;
    var innerRadius = radius * 0.55; // donut chart

    var svg = [];
    svg.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + size + ' ' + size +
             '" style="width:100%;max-width:' + size + 'px;height:auto;" role="img" aria-label="Revenue distribution pie chart">');

    var total = 0;
    for (var i = 0; i < clients.length; i++) total += clients[i].revenue;
    if (total === 0) {
      svg.push('<text x="' + cx + '" y="' + cy + '" text-anchor="middle" font-size="14" fill="#94a3b8">No data</text>');
      svg.push('</svg>');
      return svg.join('');
    }

    var startAngle = -Math.PI / 2;
    for (var j = 0; j < clients.length; j++) {
      var c = clients[j];
      if (c.revenue <= 0) continue;
      var sliceAngle = (c.revenue / total) * Math.PI * 2;
      var endAngle = startAngle + sliceAngle;
      var largeArc = sliceAngle > Math.PI ? 1 : 0;

      var x1 = cx + radius * Math.cos(startAngle);
      var y1 = cy + radius * Math.sin(startAngle);
      var x2 = cx + radius * Math.cos(endAngle);
      var y2 = cy + radius * Math.sin(endAngle);
      var ix1 = cx + innerRadius * Math.cos(startAngle);
      var iy1 = cy + innerRadius * Math.sin(startAngle);
      var ix2 = cx + innerRadius * Math.cos(endAngle);
      var iy2 = cy + innerRadius * Math.sin(endAngle);

      var path = 'M' + x1.toFixed(2) + ',' + y1.toFixed(2) +
                 ' A' + radius + ',' + radius + ' 0 ' + largeArc + ',1 ' + x2.toFixed(2) + ',' + y2.toFixed(2) +
                 ' L' + ix2.toFixed(2) + ',' + iy2.toFixed(2) +
                 ' A' + innerRadius + ',' + innerRadius + ' 0 ' + largeArc + ',0 ' + ix1.toFixed(2) + ',' + iy1.toFixed(2) +
                 ' Z';

      svg.push('<path d="' + path + '" fill="' + c.color + '" stroke="#fff" stroke-width="2">');
      svg.push('<title>' + esc(c.name) + ': $' + c.revenue.toLocaleString() + ' (' + c.percent.toFixed(1) + '%)</title>');
      svg.push('</path>');

      startAngle = endAngle;
    }

    // Center text
    svg.push('<text x="' + cx + '" y="' + (cy - 8) + '" text-anchor="middle" font-size="12" font-weight="600" fill="#6b7280" font-family="-apple-system,sans-serif">Total</text>');
    svg.push('<text x="' + cx + '" y="' + (cy + 14) + '" text-anchor="middle" font-size="20" font-weight="700" fill="#1f2937" font-family="-apple-system,sans-serif">$' + formatNum(total) + '</text>');

    svg.push('</svg>');
    return svg.join('');
  }

  // ─── Helpers ──────────────────────────────────────────

  function esc(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str || ''));
    return div.innerHTML;
  }

  function formatNum(n) {
    var parts = Math.abs(n).toFixed(0).split('');
    var out = [];
    for (var i = parts.length - 1, c = 0; i >= 0; i--, c++) {
      if (c > 0 && c % 3 === 0) out.unshift(',');
      out.unshift(parts[i]);
    }
    return (n < 0 ? '-' : '') + out.join('');
  }

  // ─── Styles ───────────────────────────────────────────

  function injectStyles() {
    if (document.getElementById('cf-rcp-styles')) return;
    var style = document.createElement('style');
    style.id = 'cf-rcp-styles';
    style.textContent = [
      '.rcp-container { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 820px; margin: 0 auto; padding: 24px; color: #1f2937; }',
      '.rcp-header { text-align: center; margin-bottom: 24px; }',
      '.rcp-header h2 { font-size: 22px; font-weight: 700; margin: 0 0 6px 0; }',
      '.rcp-header p { font-size: 14px; color: #6b7280; margin: 0; }',
      '.rcp-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }',
      '@media (max-width: 640px) { .rcp-layout { grid-template-columns: 1fr; } }',
      '.rcp-chart-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); display: flex; align-items: center; justify-content: center; }',
      '.rcp-legend-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }',
      '.rcp-legend-card h3 { font-size: 15px; font-weight: 600; margin: 0 0 14px 0; padding-bottom: 10px; border-bottom: 1px solid #f0f0f0; }',
      '.rcp-legend-item { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid #f8f8f8; }',
      '.rcp-legend-item:last-child { border-bottom: none; }',
      '.rcp-legend-dot { width: 14px; height: 14px; border-radius: 4px; flex-shrink: 0; }',
      '.rcp-legend-name { flex: 1; font-size: 14px; font-weight: 500; }',
      '.rcp-legend-val { font-size: 13px; color: #6b7280; text-align: right; }',
      '.rcp-legend-pct { font-size: 12px; font-weight: 600; min-width: 48px; text-align: right; }',
      '.rcp-warning { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 10px; padding: 14px 18px; margin-bottom: 24px; display: flex; gap: 10px; align-items: flex-start; }',
      '.rcp-warning-icon { font-size: 20px; flex-shrink: 0; }',
      '.rcp-warning-text { font-size: 13px; color: #92400e; line-height: 1.5; }',
      '.rcp-warning-text strong { font-weight: 700; }',
      '.rcp-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 14px; margin-bottom: 24px; }',
      '.rcp-stat { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px; text-align: center; }',
      '.rcp-stat-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; font-weight: 600; margin-bottom: 6px; }',
      '.rcp-stat-value { font-size: 22px; font-weight: 700; color: #4f46e5; }',
      '.rcp-form-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }',
      '.rcp-form-card h3 { font-size: 15px; font-weight: 600; margin: 0 0 14px 0; padding-bottom: 10px; border-bottom: 1px solid #f0f0f0; }',
      '.rcp-form-row { display: grid; grid-template-columns: 1fr 120px 40px; gap: 8px; align-items: center; margin-bottom: 8px; }',
      '.rcp-form-row input { padding: 7px 10px; border: 1px solid #e5e7eb; border-radius: 6px; font-size: 13px; }',
      '.rcp-form-row input:focus { outline: none; border-color: #6366f1; }',
      '.rcp-remove-btn { background: none; border: none; color: #ef4444; cursor: pointer; font-size: 18px; padding: 0; line-height: 1; }',
      '.rcp-remove-btn:hover { opacity: 0.7; }',
      '.rcp-add-btn { display: inline-block; margin-top: 8px; padding: 6px 16px; font-size: 13px; font-weight: 500; color: #4f46e5; background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 6px; cursor: pointer; }',
      '.rcp-add-btn:hover { background: #e0e7ff; }',
      '.rcp-reset-btn { display: inline-block; margin-left: 8px; padding: 6px 16px; font-size: 13px; font-weight: 500; color: #6b7280; background: #f3f4f6; border: none; border-radius: 6px; cursor: pointer; }',
      '.rcp-reset-btn:hover { background: #e5e7eb; }'
    ].join('\n');
    document.head.appendChild(style);
  }

  // ─── Default Colors ───────────────────────────────────

  var PALETTE = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#94a3b8'];

  // ─── Render ───────────────────────────────────────────

  function render(container, clients) {
    var analysis = analyzeRevenue(clients);
    var html = '';

    html += '<div class="rcp-container">';

    // Header
    html += '<div class="rcp-header">';
    html += '<h2>Revenue by Client</h2>';
    html += '<p>Visualize your revenue distribution and identify client dependency risks.</p>';
    html += '</div>';

    // Warnings
    for (var w = 0; w < analysis.warnings.length; w++) {
      var warn = analysis.warnings[w];
      html += '<div class="rcp-warning">';
      html += '<div class="rcp-warning-icon">&#9888;</div>';
      html += '<div class="rcp-warning-text"><strong>Client Dependency Alert:</strong> ' + esc(warn.message) +
              ' Consider diversifying your client base to reduce risk.</div>';
      html += '</div>';
    }

    // Stats row
    html += '<div class="rcp-stats">';
    html += '<div class="rcp-stat"><div class="rcp-stat-label">Total Revenue</div><div class="rcp-stat-value">$' + formatNum(analysis.total) + '</div></div>';
    html += '<div class="rcp-stat"><div class="rcp-stat-label">Active Clients</div><div class="rcp-stat-value">' + analysis.clientCount + '</div></div>';
    if (analysis.topClient) {
      html += '<div class="rcp-stat"><div class="rcp-stat-label">Top Client Share</div><div class="rcp-stat-value" style="color:' + (analysis.topClient.percent > DEPENDENCY_THRESHOLD ? '#ef4444' : '#10b981') + '">' + analysis.topClient.percent.toFixed(1) + '%</div></div>';
    }
    html += '</div>';

    // Chart + Legend layout
    html += '<div class="rcp-layout">';

    // Pie chart
    html += '<div class="rcp-chart-card">';
    html += renderPieChart(analysis.clients, 280);
    html += '</div>';

    // Legend
    html += '<div class="rcp-legend-card">';
    html += '<h3>Client Breakdown</h3>';
    for (var i = 0; i < analysis.clients.length; i++) {
      var c = analysis.clients[i];
      if (c.revenue <= 0) continue;
      html += '<div class="rcp-legend-item">';
      html += '<div class="rcp-legend-dot" style="background:' + c.color + '"></div>';
      html += '<span class="rcp-legend-name">' + esc(c.name) + '</span>';
      html += '<span class="rcp-legend-val">$' + formatNum(c.revenue) + '</span>';
      html += '<span class="rcp-legend-pct" style="color:' + (c.percent > DEPENDENCY_THRESHOLD ? '#ef4444' : '#1f2937') + '">' + c.percent.toFixed(1) + '%</span>';
      html += '</div>';
    }
    html += '</div>';

    html += '</div>'; // end layout

    // Editable form
    html += '<div class="rcp-form-card">';
    html += '<h3>Edit Client Data</h3>';
    for (var f = 0; f < clients.length; f++) {
      html += '<div class="rcp-form-row">';
      html += '<input type="text" data-idx="' + f + '" data-field="name" value="' + esc(clients[f].name) + '" placeholder="Client name">';
      html += '<input type="number" data-idx="' + f + '" data-field="revenue" value="' + (clients[f].revenue || 0) + '" min="0" placeholder="Revenue">';
      html += '<button class="rcp-remove-btn" data-remove="' + f + '" type="button">&times;</button>';
      html += '</div>';
    }
    html += '<button class="rcp-add-btn" data-action="add" type="button">+ Add Client</button>';
    html += '<button class="rcp-reset-btn" data-action="reset" type="button">Reset Demo</button>';
    html += '</div>';

    html += '</div>'; // end container

    container.innerHTML = html;

    // Event binding
    var debounce = null;
    container.addEventListener('input', function (e) {
      var inp = e.target;
      if (!inp.hasAttribute('data-idx')) return;
      var idx = parseInt(inp.getAttribute('data-idx'), 10);
      var field = inp.getAttribute('data-field');
      if (field === 'name') clients[idx].name = inp.value;
      if (field === 'revenue') clients[idx].revenue = parseFloat(inp.value) || 0;
      clearTimeout(debounce);
      debounce = setTimeout(function () {
        saveData(clients);
        render(container, clients);
      }, 400);
    });

    container.addEventListener('click', function (e) {
      if (e.target.hasAttribute('data-remove')) {
        var ri = parseInt(e.target.getAttribute('data-remove'), 10);
        clients.splice(ri, 1);
        saveData(clients);
        render(container, clients);
        return;
      }
      if (e.target.getAttribute('data-action') === 'add') {
        clients.push({ name: 'New Client', revenue: 0, color: PALETTE[clients.length % PALETTE.length] });
        saveData(clients);
        render(container, clients);
        return;
      }
      if (e.target.getAttribute('data-action') === 'reset') {
        saveData(MOCK_CLIENTS);
        render(container, MOCK_CLIENTS.slice());
      }
    });
  }

  // ─── Public Init ──────────────────────────────────────

  function init(containerId) {
    var container = document.getElementById(containerId);
    if (!container) {
      console.error('[RevenueClientPie] Container not found: #' + containerId);
      return;
    }
    injectStyles();

    var saved = loadData();
    var clients = saved || MOCK_CLIENTS.slice();
    render(container, clients);
  }

  // ─── Namespace Registration ───────────────────────────

  ns.RevenueClientPie = {
    init: init,
    analyzeRevenue: analyzeRevenue,
    DEPENDENCY_THRESHOLD: DEPENDENCY_THRESHOLD
  };
})();
