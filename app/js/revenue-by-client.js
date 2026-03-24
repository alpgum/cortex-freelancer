/**
 * CF-054: Revenue by Client Pie Chart
 * Visualize revenue distribution across clients with a donut chart,
 * flag over-dependency on any single client (>30% threshold), and
 * display a Herfindahl-Hirschman Index diversification score.
 *
 * @namespace window.CortexFreelancer.RevenueByClient
 */
(function () {
  'use strict';

  var DEPENDENCY_THRESHOLD = 0.30; // 30%

  var COLORS = [
    '#4F46E5', '#10B981', '#F59E0B', '#EF4444',
    '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'
  ];

  // ─── Mock Data ─────────────────────────────────────────

  var MOCK_CLIENTS = [
    { name: 'Acme Corp',         revenue: 18500 },
    { name: 'Globex Inc',        revenue: 12200 },
    { name: 'Initech',           revenue: 8750 },
    { name: 'Umbrella Ltd',      revenue: 6400 },
    { name: 'Stark Industries',  revenue: 4900 },
    { name: 'Wayne Enterprises', revenue: 3100 },
    { name: 'Cyberdyne Systems', revenue: 2150 }
  ];

  // ─── Styles ────────────────────────────────────────────

  var STYLES_ID = 'cortex-revenue-by-client-styles';

  function injectStyles() {
    if (document.getElementById(STYLES_ID)) return;
    var style = document.createElement('style');
    style.id = STYLES_ID;
    style.textContent =
      '.rbc-container {' +
        'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;' +
        'max-width: 620px;' +
        'background: #fff;' +
        'border: 1px solid #e5e7eb;' +
        'border-radius: 12px;' +
        'padding: 24px;' +
        'box-shadow: 0 1px 3px rgba(0,0,0,0.08);' +
      '}' +
      '.rbc-title {' +
        'font-size: 18px;' +
        'font-weight: 700;' +
        'color: #111827;' +
        'margin: 0 0 4px 0;' +
      '}' +
      '.rbc-subtitle {' +
        'font-size: 13px;' +
        'color: #6b7280;' +
        'margin: 0 0 20px 0;' +
      '}' +
      '.rbc-body {' +
        'display: flex;' +
        'gap: 24px;' +
        'align-items: flex-start;' +
      '}' +
      '.rbc-chart-wrap {' +
        'flex-shrink: 0;' +
        'position: relative;' +
        'width: 200px;' +
        'height: 200px;' +
      '}' +
      '.rbc-chart-wrap canvas {' +
        'width: 200px;' +
        'height: 200px;' +
      '}' +
      '.rbc-center-label {' +
        'position: absolute;' +
        'top: 50%; left: 50%;' +
        'transform: translate(-50%, -50%);' +
        'text-align: center;' +
        'pointer-events: none;' +
      '}' +
      '.rbc-center-amount {' +
        'font-size: 20px;' +
        'font-weight: 700;' +
        'color: #111827;' +
        'display: block;' +
      '}' +
      '.rbc-center-text {' +
        'font-size: 11px;' +
        'color: #6b7280;' +
      '}' +
      '.rbc-legend {' +
        'flex: 1;' +
        'min-width: 0;' +
      '}' +
      '.rbc-legend-item {' +
        'display: flex;' +
        'align-items: center;' +
        'padding: 6px 0;' +
        'border-bottom: 1px solid #f3f4f6;' +
        'font-size: 13px;' +
      '}' +
      '.rbc-legend-item:last-child { border-bottom: none; }' +
      '.rbc-legend-dot {' +
        'width: 10px; height: 10px;' +
        'border-radius: 50%;' +
        'flex-shrink: 0;' +
        'margin-right: 8px;' +
      '}' +
      '.rbc-legend-name {' +
        'flex: 1;' +
        'min-width: 0;' +
        'overflow: hidden;' +
        'text-overflow: ellipsis;' +
        'white-space: nowrap;' +
        'color: #374151;' +
      '}' +
      '.rbc-legend-val {' +
        'margin-left: 8px;' +
        'font-weight: 600;' +
        'color: #111827;' +
        'white-space: nowrap;' +
      '}' +
      '.rbc-legend-pct {' +
        'margin-left: 6px;' +
        'color: #6b7280;' +
        'font-size: 12px;' +
        'white-space: nowrap;' +
        'min-width: 42px;' +
        'text-align: right;' +
      '}' +
      '.rbc-legend-warn {' +
        'margin-left: 6px;' +
        'font-size: 10px;' +
        'font-weight: 600;' +
        'color: #dc2626;' +
        'background: #fef2f2;' +
        'border-radius: 8px;' +
        'padding: 1px 6px;' +
        'white-space: nowrap;' +
      '}' +
      '.rbc-warning {' +
        'margin-top: 16px;' +
        'padding: 10px 14px;' +
        'background: #FEF3C7;' +
        'border: 1px solid #F59E0B;' +
        'border-radius: 8px;' +
        'font-size: 13px;' +
        'color: #92400E;' +
        'line-height: 1.5;' +
      '}' +
      '.rbc-warning strong { color: #78350F; }' +
      '.rbc-score-card {' +
        'margin-top: 12px;' +
        'padding: 12px 14px;' +
        'border-radius: 8px;' +
        'font-size: 13px;' +
        'display: flex;' +
        'justify-content: space-between;' +
        'align-items: center;' +
      '}' +
      '.rbc-score-card.healthy  { background: #F0FDF4; border: 1px solid #BBF7D0; color: #166534; }' +
      '.rbc-score-card.moderate { background: #FFFBEB; border: 1px solid #FDE68A; color: #92400E; }' +
      '.rbc-score-card.at-risk  { background: #FEF2F2; border: 1px solid #FECACA; color: #991B1B; }' +
      '.rbc-score-label { font-weight: 500; }' +
      '.rbc-score-right { text-align: right; }' +
      '.rbc-score-val {' +
        'font-weight: 700;' +
        'font-size: 20px;' +
        'line-height: 1;' +
      '}' +
      '.rbc-score-tier {' +
        'font-size: 11px;' +
        'font-weight: 600;' +
        'margin-top: 2px;' +
      '}' +
      '.rbc-bar-track {' +
        'height: 6px;' +
        'background: rgba(0,0,0,0.08);' +
        'border-radius: 3px;' +
        'margin-top: 10px;' +
        'overflow: hidden;' +
      '}' +
      '.rbc-bar-fill {' +
        'height: 100%;' +
        'border-radius: 3px;' +
        'transition: width 0.4s ease;' +
      '}' +
      '@media (max-width: 540px) {' +
        '.rbc-body { flex-direction: column; align-items: center; }' +
        '.rbc-legend { width: 100%; }' +
      '}';
    document.head.appendChild(style);
  }

  // ─── Helpers ───────────────────────────────────────────

  /**
   * Format a dollar amount.
   * @param {number} amount
   * @returns {string}
   */
  function formatMoney(amount) {
    return '$' + amount.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
  }

  /**
   * Escape HTML special characters.
   * @param {string} str
   * @returns {string}
   */
  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str || ''));
    return div.innerHTML;
  }

  // ─── Diversification Score ─────────────────────────────

  /**
   * Calculate a diversification score (0-100) using the
   * Herfindahl-Hirschman Index (HHI). A perfectly even split across N
   * clients yields 100; a single client yields 0.
   *
   * @param {Array} clients - Array of { name, revenue }
   * @returns {number} Score 0-100
   */
  function calcDiversificationScore(clients) {
    var total = 0;
    var i;
    for (i = 0; i < clients.length; i++) total += clients[i].revenue;
    if (total === 0) return 0;

    var hhi = 0;
    for (i = 0; i < clients.length; i++) {
      var share = clients[i].revenue / total;
      hhi += share * share;
    }

    // HHI ranges from 1/N (perfect spread) to 1 (single client).
    var minHHI = 1 / clients.length;
    if (minHHI >= 1) return 0;
    var score = ((1 - hhi) / (1 - minHHI)) * 100;
    return Math.round(Math.max(0, Math.min(100, score)));
  }

  // ─── Canvas Drawing ────────────────────────────────────

  /**
   * Draw a donut chart on a canvas element.
   * @param {HTMLCanvasElement} canvas
   * @param {Array} slices - [{ value, color }]
   */
  function drawDonut(canvas, slices) {
    var dpr = window.devicePixelRatio || 1;
    var size = 200;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';

    var ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    var cx = size / 2;
    var cy = size / 2;
    var outerR = 92;
    var innerR = 56;

    var total = 0;
    var i;
    for (i = 0; i < slices.length; i++) total += slices[i].value;
    if (total === 0) return;

    var startAngle = -Math.PI / 2;
    for (i = 0; i < slices.length; i++) {
      var sliceAngle = (slices[i].value / total) * 2 * Math.PI;
      var endAngle = startAngle + sliceAngle;

      ctx.beginPath();
      ctx.arc(cx, cy, outerR, startAngle, endAngle);
      ctx.arc(cx, cy, innerR, endAngle, startAngle, true);
      ctx.closePath();
      ctx.fillStyle = slices[i].color;
      ctx.fill();

      // Thin white gap between slices
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();

      startAngle = endAngle;
    }
  }

  // ─── Render ────────────────────────────────────────────

  /**
   * Build and render the revenue-by-client widget into a container.
   * @param {string} containerId - DOM element ID to render into
   * @param {Array}  [data]      - Optional client data override
   */
  function init(containerId, data) {
    var container = document.getElementById(containerId);
    if (!container) {
      console.warn('[RevenueByClient] Container not found: #' + containerId);
      return;
    }

    injectStyles();

    var clients = (data || MOCK_CLIENTS).slice().sort(function (a, b) {
      return b.revenue - a.revenue;
    });

    var totalRevenue = 0;
    var i;
    for (i = 0; i < clients.length; i++) totalRevenue += clients[i].revenue;

    // Detect over-dependent clients
    var warnings = [];
    for (i = 0; i < clients.length; i++) {
      var share = totalRevenue > 0 ? clients[i].revenue / totalRevenue : 0;
      if (share > DEPENDENCY_THRESHOLD) {
        warnings.push({ name: clients[i].name, pct: (share * 100).toFixed(1) });
      }
    }

    var score = calcDiversificationScore(clients);
    var scoreTier = score >= 70 ? 'healthy' : score >= 40 ? 'moderate' : 'at-risk';
    var scoreLabel = score >= 70 ? 'Healthy' : score >= 40 ? 'Moderate' : 'At Risk';

    // Unique canvas id
    var canvasId = 'rbc-canvas-' + containerId;

    // ── Assemble HTML ──

    var html = '<div class="rbc-container">';
    html += '<h3 class="rbc-title">Revenue by Client</h3>';
    html += '<p class="rbc-subtitle">Earnings distribution and client dependency analysis</p>';

    html += '<div class="rbc-body">';

    // Donut chart
    html += '<div class="rbc-chart-wrap">' +
      '<canvas id="' + canvasId + '"></canvas>' +
      '<div class="rbc-center-label">' +
        '<span class="rbc-center-amount">' + formatMoney(totalRevenue) + '</span>' +
        '<span class="rbc-center-text">Total Revenue</span>' +
      '</div>' +
    '</div>';

    // Legend
    html += '<div class="rbc-legend">';
    for (i = 0; i < clients.length; i++) {
      var pct = totalRevenue > 0 ? (clients[i].revenue / totalRevenue * 100).toFixed(1) : '0.0';
      var color = COLORS[i % COLORS.length];
      var isDependent = totalRevenue > 0 && (clients[i].revenue / totalRevenue) > DEPENDENCY_THRESHOLD;

      html +=
        '<div class="rbc-legend-item">' +
          '<span class="rbc-legend-dot" style="background:' + color + '"></span>' +
          '<span class="rbc-legend-name">' + escapeHtml(clients[i].name) + '</span>' +
          '<span class="rbc-legend-val">' + formatMoney(clients[i].revenue) + '</span>' +
          '<span class="rbc-legend-pct">' + pct + '%</span>' +
          (isDependent ? '<span class="rbc-legend-warn">HIGH</span>' : '') +
        '</div>';
    }
    html += '</div>'; // legend
    html += '</div>'; // body

    // Dependency warning banner
    if (warnings.length > 0) {
      html += '<div class="rbc-warning">';
      html += '<strong>Dependency Warning:</strong> ';
      var parts = [];
      for (i = 0; i < warnings.length; i++) {
        parts.push(
          '<strong>' + escapeHtml(warnings[i].name) + '</strong> accounts for ' +
          warnings[i].pct + '% of revenue'
        );
      }
      html += parts.join('; ') + '. ';
      html += 'Consider diversifying your client base to reduce concentration risk.';
      html += '</div>';
    }

    // Diversification score card
    html +=
      '<div class="rbc-score-card ' + scoreTier + '">' +
        '<div class="rbc-score-label">Diversification Score</div>' +
        '<div class="rbc-score-right">' +
          '<div class="rbc-score-val">' + score + '<span style="font-size:13px;font-weight:500;">/100</span></div>' +
          '<div class="rbc-score-tier">' + scoreLabel + '</div>' +
        '</div>' +
      '</div>';

    // Score progress bar
    var barColor = scoreTier === 'healthy' ? '#16a34a' : scoreTier === 'moderate' ? '#d97706' : '#dc2626';
    html +=
      '<div class="rbc-bar-track">' +
        '<div class="rbc-bar-fill" style="width:' + score + '%;background:' + barColor + '"></div>' +
      '</div>';

    html += '</div>'; // rbc-container

    container.innerHTML = html;

    // ── Draw canvas after DOM insertion ──

    var slices = [];
    for (i = 0; i < clients.length; i++) {
      slices.push({ value: clients[i].revenue, color: COLORS[i % COLORS.length] });
    }

    var canvas = document.getElementById(canvasId);
    if (canvas) drawDonut(canvas, slices);
  }

  // ─── Namespace Export ──────────────────────────────────

  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.RevenueByClient = {
    init: init,
    calcDiversificationScore: calcDiversificationScore,
    DEPENDENCY_THRESHOLD: DEPENDENCY_THRESHOLD
  };
})();
