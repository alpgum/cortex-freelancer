/**
 * [CF-013] Profile Timeline Visualization
 * Interactive canvas-based chart showing earnings, jobs, and rating over time.
 * Exposed as window.CortexFreelancer.ProfileTimeline
 */
(function () {
  'use strict';

  var COLORS = {
    earnings: '#00d4aa',
    jobs: '#6c5ce7',
    rating: '#fdcb6e',
    grid: '#2d2d44',
    axis: '#888',
    bg: '#1a1a2e',
    label: '#ccc',
    tooltip: '#16213e'
  };

  var PADDING = { top: 40, right: 30, bottom: 55, left: 65 };

  // ─── Mock Data ───────────────────────────────────────────────────────

  var MOCK_DATA = [
    { date: '2024-01', earnings: 1200, jobs: 2, rating: 4.2 },
    { date: '2024-02', earnings: 1800, jobs: 3, rating: 4.3 },
    { date: '2024-03', earnings: 2400, jobs: 2, rating: 4.4 },
    { date: '2024-04', earnings: 1600, jobs: 1, rating: 4.4 },
    { date: '2024-05', earnings: 3200, jobs: 4, rating: 4.5 },
    { date: '2024-06', earnings: 4100, jobs: 3, rating: 4.5 },
    { date: '2024-07', earnings: 3800, jobs: 3, rating: 4.6 },
    { date: '2024-08', earnings: 5200, jobs: 5, rating: 4.6 },
    { date: '2024-09', earnings: 4800, jobs: 4, rating: 4.7 },
    { date: '2024-10', earnings: 6100, jobs: 5, rating: 4.7 },
    { date: '2024-11', earnings: 5500, jobs: 4, rating: 4.8 },
    { date: '2024-12', earnings: 7200, jobs: 6, rating: 4.8 },
    { date: '2025-01', earnings: 6800, jobs: 5, rating: 4.8 },
    { date: '2025-02', earnings: 8100, jobs: 7, rating: 4.9 },
    { date: '2025-03', earnings: 7400, jobs: 5, rating: 4.9 },
    { date: '2025-04', earnings: 9200, jobs: 8, rating: 4.9 },
    { date: '2025-05', earnings: 8600, jobs: 6, rating: 4.9 },
    { date: '2025-06', earnings: 10500, jobs: 9, rating: 5.0 },
    { date: '2025-07', earnings: 9800, jobs: 7, rating: 5.0 },
    { date: '2025-08', earnings: 11200, jobs: 8, rating: 5.0 },
    { date: '2025-09', earnings: 10100, jobs: 7, rating: 5.0 },
    { date: '2025-10', earnings: 12400, jobs: 9, rating: 5.0 },
    { date: '2025-11', earnings: 11800, jobs: 8, rating: 5.0 },
    { date: '2025-12', earnings: 13500, jobs: 10, rating: 5.0 }
  ];

  // ─── State ───────────────────────────────────────────────────────────

  var state = {
    container: null,
    data: null,
    opts: {},
    series: { earnings: true, jobs: true, rating: true },
    hoverIdx: -1,
    canvas: null,
    ctx: null,
    tooltip: null,
    wrap: null,
    animFrame: null
  };

  // ─── Styles ──────────────────────────────────────────────────────────

  var STYLES = '\
    .pt-root { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #1a1a2e; border-radius: 12px; padding: 20px; max-width: 860px; }\
    .pt-title { font-size: 20px; font-weight: 700; margin-bottom: 4px; color: #fff; }\
    .pt-subtitle { font-size: 13px; color: #888; margin-bottom: 16px; }\
    .pt-controls { display: flex; gap: 12px; margin-bottom: 12px; align-items: center; flex-wrap: wrap; }\
    .pt-toggle { display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 13px; color: #ccc; user-select: none; }\
    .pt-toggle input { display: none; }\
    .pt-toggle-dot { width: 14px; height: 14px; border-radius: 3px; border: 2px solid #888; transition: all 0.2s; }\
    .pt-toggle input:checked + .pt-toggle-dot { border-color: currentColor; background: currentColor; }\
    .pt-canvas-wrap { position: relative; background: #16213e; border-radius: 10px; padding: 12px; border: 1px solid #2d2d44; }\
    .pt-tooltip { position: absolute; display: none; background: #1a1a2e; border: 1px solid #2d2d44; border-radius: 8px; padding: 10px 14px; font-size: 12px; color: #e0e0e0; pointer-events: none; white-space: nowrap; z-index: 10; box-shadow: 0 4px 16px rgba(0,0,0,0.4); }\
    .pt-summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-top: 16px; }\
    .pt-summary-card { background: #16213e; border-radius: 8px; padding: 14px; border: 1px solid #2d2d44; text-align: center; }\
    .pt-summary-value { font-size: 22px; font-weight: 700; color: #fff; }\
    .pt-summary-label { font-size: 11px; color: #888; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px; }\
    .pt-summary-change { font-size: 12px; margin-top: 4px; font-weight: 600; }\
  ';

  // ─── Drawing ─────────────────────────────────────────────────────────

  function draw() {
    var ctx = state.ctx;
    var canvas = state.canvas;
    if (!ctx || !canvas) return;

    var data = state.data;
    var W = state.opts.width || 800;
    var H = state.opts.height || 320;
    var dpr = window.devicePixelRatio || 1;

    ctx.clearRect(0, 0, W, H);

    if (!data || data.length === 0) return;

    var sorted = data.slice().sort(function (a, b) { return a.date.localeCompare(b.date); });
    var n = sorted.length;

    var earningsArr = sorted.map(function (d) { return d.earnings || 0; });
    var jobsArr = sorted.map(function (d) { return d.jobs || 0; });
    var ratingArr = sorted.map(function (d) { return d.rating || 0; });

    var maxEarnings = Math.max.apply(null, earningsArr) || 1;
    var maxJobs = Math.max.apply(null, jobsArr) || 1;
    var maxRating = 5;

    var plotW = W - PADDING.left - PADDING.right;
    var plotH = H - PADDING.top - PADDING.bottom;

    function xPos(i) { return PADDING.left + (n > 1 ? (i / (n - 1)) * plotW : plotW / 2); }
    function yEarnings(v) { return PADDING.top + plotH - (v / maxEarnings) * plotH; }
    function yJobs(v) { return PADDING.top + plotH - (v / maxJobs) * plotH; }
    function yRating(v) { return PADDING.top + plotH - (v / maxRating) * plotH; }

    // Grid lines
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 0.5;
    for (var g = 0; g <= 5; g++) {
      var gy = PADDING.top + (g / 5) * plotH;
      ctx.beginPath();
      ctx.moveTo(PADDING.left, gy);
      ctx.lineTo(W - PADDING.right, gy);
      ctx.stroke();
    }

    // Axes
    ctx.strokeStyle = COLORS.axis;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PADDING.left, PADDING.top);
    ctx.lineTo(PADDING.left, H - PADDING.bottom);
    ctx.lineTo(W - PADDING.right, H - PADDING.bottom);
    ctx.stroke();

    // X-axis labels
    ctx.fillStyle = COLORS.axis;
    ctx.font = '11px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    var labelInterval = Math.max(1, Math.floor(n / 8));
    for (var li = 0; li < n; li += labelInterval) {
      ctx.fillText(formatDateLabel(sorted[li].date), xPos(li), H - PADDING.bottom + 18);
    }
    if ((n - 1) % labelInterval !== 0 && n > 1) {
      ctx.fillText(formatDateLabel(sorted[n - 1].date), xPos(n - 1), H - PADDING.bottom + 18);
    }

    // Y-axis labels (earnings)
    if (state.series.earnings) {
      ctx.fillStyle = COLORS.earnings;
      ctx.textAlign = 'right';
      ctx.font = '10px -apple-system, sans-serif';
      for (var yi = 0; yi <= 5; yi++) {
        var val = Math.round((maxEarnings / 5) * (5 - yi));
        ctx.fillText(formatCurrency(val), PADDING.left - 8, PADDING.top + (yi / 5) * plotH + 4);
      }
    }

    // Draw area fills
    if (state.series.earnings) drawArea(ctx, n, earningsArr, xPos, yEarnings, COLORS.earnings, plotH);
    if (state.series.jobs) drawArea(ctx, n, jobsArr, xPos, yJobs, COLORS.jobs, plotH);

    // Draw lines
    if (state.series.earnings) drawLine(ctx, n, earningsArr, xPos, yEarnings, COLORS.earnings, 2.5);
    if (state.series.jobs) drawLine(ctx, n, jobsArr, xPos, yJobs, COLORS.jobs, 2);
    if (state.series.rating) drawLine(ctx, n, ratingArr, xPos, yRating, COLORS.rating, 2);

    // Draw dots
    if (state.series.earnings) drawDots(ctx, n, earningsArr, xPos, yEarnings, COLORS.earnings);
    if (state.series.jobs) drawDots(ctx, n, jobsArr, xPos, yJobs, COLORS.jobs);
    if (state.series.rating) drawDots(ctx, n, ratingArr, xPos, yRating, COLORS.rating);

    // Hover crosshair
    if (state.hoverIdx >= 0 && state.hoverIdx < n) {
      var hx = xPos(state.hoverIdx);
      ctx.strokeStyle = '#ffffff22';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(hx, PADDING.top);
      ctx.lineTo(hx, H - PADDING.bottom);
      ctx.stroke();
      ctx.setLineDash([]);

      // Highlight dots
      if (state.series.earnings) drawHighlightDot(ctx, hx, yEarnings(earningsArr[state.hoverIdx]), COLORS.earnings);
      if (state.series.jobs) drawHighlightDot(ctx, hx, yJobs(jobsArr[state.hoverIdx]), COLORS.jobs);
      if (state.series.rating) drawHighlightDot(ctx, hx, yRating(ratingArr[state.hoverIdx]), COLORS.rating);

      // Tooltip
      if (state.tooltip) {
        var d = sorted[state.hoverIdx];
        var lines = ['<strong>' + formatDateLabel(d.date) + '</strong>'];
        if (state.series.earnings && d.earnings != null) lines.push('<span style="color:' + COLORS.earnings + '">Earnings:</span> ' + formatCurrency(d.earnings));
        if (state.series.jobs && d.jobs != null) lines.push('<span style="color:' + COLORS.jobs + '">Jobs:</span> ' + d.jobs);
        if (state.series.rating && d.rating != null) lines.push('<span style="color:' + COLORS.rating + '">Rating:</span> ' + d.rating.toFixed(1) + '/5');
        state.tooltip.innerHTML = lines.join('<br>');
        state.tooltip.style.display = 'block';
        var tLeft = Math.min(hx + 16, W - 160);
        state.tooltip.style.left = tLeft + 'px';
        state.tooltip.style.top = '30px';
      }
    } else if (state.tooltip) {
      state.tooltip.style.display = 'none';
    }
  }

  function drawLine(ctx, n, values, xFn, yFn, color, width) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (var i = 0; i < n; i++) {
      var x = xFn(i);
      var y = yFn(values[i]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  function drawArea(ctx, n, values, xFn, yFn, color, plotH) {
    ctx.fillStyle = color + '12';
    ctx.beginPath();
    ctx.moveTo(xFn(0), PADDING.top + plotH);
    for (var i = 0; i < n; i++) {
      ctx.lineTo(xFn(i), yFn(values[i]));
    }
    ctx.lineTo(xFn(n - 1), PADDING.top + plotH);
    ctx.closePath();
    ctx.fill();
  }

  function drawDots(ctx, n, values, xFn, yFn, color) {
    for (var i = 0; i < n; i++) {
      ctx.beginPath();
      ctx.arc(xFn(i), yFn(values[i]), 3, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = '#16213e';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  function drawHighlightDot(ctx, x, y, color) {
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fillStyle = color + '44';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  function formatDateLabel(dateStr) {
    var parts = dateStr.split('-');
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[parseInt(parts[1], 10) - 1] + ' \'' + parts[0].slice(2);
  }

  function formatCurrency(val) {
    if (val >= 1000000) return '$' + (val / 1000000).toFixed(1) + 'M';
    if (val >= 1000) return '$' + (val / 1000).toFixed(val >= 10000 ? 0 : 1) + 'k';
    return '$' + val;
  }

  // ─── Summary Stats ───────────────────────────────────────────────────

  function computeSummary(data) {
    if (!data || data.length === 0) return null;
    var sorted = data.slice().sort(function (a, b) { return a.date.localeCompare(b.date); });
    var totalEarnings = sorted.reduce(function (s, d) { return s + (d.earnings || 0); }, 0);
    var totalJobs = sorted.reduce(function (s, d) { return s + (d.jobs || 0); }, 0);
    var latestRating = sorted[sorted.length - 1].rating || 0;
    var avgMonthly = totalEarnings / sorted.length;

    // Growth: compare last 3 months avg to first 3 months avg
    var first3 = sorted.slice(0, Math.min(3, sorted.length));
    var last3 = sorted.slice(Math.max(0, sorted.length - 3));
    var avgFirst = first3.reduce(function (s, d) { return s + (d.earnings || 0); }, 0) / first3.length;
    var avgLast = last3.reduce(function (s, d) { return s + (d.earnings || 0); }, 0) / last3.length;
    var growthPct = avgFirst > 0 ? Math.round(((avgLast - avgFirst) / avgFirst) * 100) : 0;

    return {
      totalEarnings: totalEarnings,
      totalJobs: totalJobs,
      latestRating: latestRating,
      avgMonthly: Math.round(avgMonthly),
      growthPct: growthPct,
      months: sorted.length
    };
  }

  // ─── Render ──────────────────────────────────────────────────────────

  function render(containerId) {
    var container = typeof containerId === 'string'
      ? document.getElementById(containerId) || document.querySelector(containerId)
      : containerId;
    if (!container) return;
    state.container = container;

    var data = state.data || MOCK_DATA;
    state.data = data;
    var W = state.opts.width || 800;
    var H = state.opts.height || 320;
    var dpr = window.devicePixelRatio || 1;
    var summary = computeSummary(data);

    var style = document.createElement('style');
    style.textContent = STYLES;
    container.innerHTML = '';
    container.appendChild(style);

    var root = document.createElement('div');
    root.className = 'pt-root';
    container.appendChild(root);

    // Title
    var titleDiv = document.createElement('div');
    titleDiv.innerHTML = '<div class="pt-title">Profile Timeline</div><div class="pt-subtitle">Earnings, jobs completed, and rating over time</div>';
    root.appendChild(titleDiv);

    // Toggle controls
    var controls = document.createElement('div');
    controls.className = 'pt-controls';
    var seriesConfig = [
      { key: 'earnings', label: 'Earnings', color: COLORS.earnings },
      { key: 'jobs', label: 'Jobs', color: COLORS.jobs },
      { key: 'rating', label: 'Rating', color: COLORS.rating }
    ];
    seriesConfig.forEach(function (s) {
      var toggle = document.createElement('label');
      toggle.className = 'pt-toggle';
      toggle.style.color = s.color;
      toggle.innerHTML = '<input type="checkbox"' + (state.series[s.key] ? ' checked' : '') + ' data-series="' + s.key + '"><div class="pt-toggle-dot" style="color:' + s.color + '"></div>' + s.label;
      controls.appendChild(toggle);
    });
    root.appendChild(controls);

    // Canvas wrapper
    var wrap = document.createElement('div');
    wrap.className = 'pt-canvas-wrap';
    root.appendChild(wrap);
    state.wrap = wrap;

    var canvas = document.createElement('canvas');
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    canvas.style.display = 'block';
    wrap.appendChild(canvas);
    state.canvas = canvas;

    var ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    state.ctx = ctx;

    // Tooltip
    var tooltip = document.createElement('div');
    tooltip.className = 'pt-tooltip';
    wrap.appendChild(tooltip);
    state.tooltip = tooltip;

    // Draw initial
    draw();

    // Summary cards
    if (summary) {
      var sumDiv = document.createElement('div');
      sumDiv.className = 'pt-summary';
      var growthColor = summary.growthPct >= 0 ? '#00d4aa' : '#ff6b6b';
      var growthSign = summary.growthPct >= 0 ? '+' : '';
      sumDiv.innerHTML =
        '<div class="pt-summary-card"><div class="pt-summary-value">' + formatCurrency(summary.totalEarnings) + '</div><div class="pt-summary-label">Total Earnings</div><div class="pt-summary-change" style="color:' + growthColor + '">' + growthSign + summary.growthPct + '% growth</div></div>' +
        '<div class="pt-summary-card"><div class="pt-summary-value">' + summary.totalJobs + '</div><div class="pt-summary-label">Jobs Completed</div></div>' +
        '<div class="pt-summary-card"><div class="pt-summary-value">' + summary.latestRating.toFixed(1) + '</div><div class="pt-summary-label">Current Rating</div></div>' +
        '<div class="pt-summary-card"><div class="pt-summary-value">' + formatCurrency(summary.avgMonthly) + '</div><div class="pt-summary-label">Avg Monthly</div></div>';
      root.appendChild(sumDiv);
    }

    // Events
    canvas.addEventListener('mousemove', function (e) {
      var rect = canvas.getBoundingClientRect();
      var mx = e.clientX - rect.left;
      var sorted = data.slice().sort(function (a, b) { return a.date.localeCompare(b.date); });
      var n = sorted.length;
      var plotW = W - PADDING.left - PADDING.right;

      var closestIdx = -1;
      var closestDist = Infinity;
      for (var i = 0; i < n; i++) {
        var px = PADDING.left + (n > 1 ? (i / (n - 1)) * plotW : plotW / 2);
        var dist = Math.abs(mx - px);
        if (dist < closestDist) {
          closestDist = dist;
          closestIdx = i;
        }
      }
      state.hoverIdx = closestDist < 25 ? closestIdx : -1;
      draw();
    });

    canvas.addEventListener('mouseleave', function () {
      state.hoverIdx = -1;
      draw();
    });

    // Toggle bindings
    controls.querySelectorAll('input[data-series]').forEach(function (cb) {
      cb.addEventListener('change', function () {
        state.series[cb.getAttribute('data-series')] = cb.checked;
        draw();
      });
    });
  }

  // ─── Public API ──────────────────────────────────────────────────────

  function init(opts) {
    opts = opts || {};
    state.data = opts.data || MOCK_DATA;
    state.opts = {
      width: opts.width || 800,
      height: opts.height || 320
    };
    state.series = {
      earnings: opts.showEarnings !== false,
      jobs: opts.showJobs !== false,
      rating: opts.showRating !== false
    };
    state.hoverIdx = -1;
  }

  function destroy() {
    if (state.container) {
      state.container.innerHTML = '';
      state.container = null;
    }
    state.canvas = null;
    state.ctx = null;
    state.tooltip = null;
  }

  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.ProfileTimeline = {
    init: init,
    render: render,
    destroy: destroy,
    setData: function (data) { state.data = data; },
    toggleSeries: function (key, on) { state.series[key] = on; draw(); }
  };
})();
