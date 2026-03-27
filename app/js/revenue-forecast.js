/**
 * [cf3-030] Revenue Forecasting — Next 3 Months
 * Predicts revenue from active projects, pipeline, and recurring clients.
 * Renders projected-vs-actual chart and scenario modeling.
 * IIFE exposing window.CortexRevenueForecast
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_revenue_forecast';

  /* ── Helpers ── */

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
      out.push({
        month: d.getMonth() + 1,
        year: d.getFullYear(),
        label: d.toLocaleString('en-US', { month: 'short', year: 'numeric' }),
        shortLabel: d.toLocaleString('en-US', { month: 'short' })
      });
    }
    return out;
  }

  function getPastMonths(count) {
    var now = new Date(), out = [];
    for (var i = count; i >= 1; i--) {
      var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      out.push({
        month: d.getMonth() + 1,
        year: d.getFullYear(),
        label: d.toLocaleString('en-US', { month: 'short', year: 'numeric' }),
        shortLabel: d.toLocaleString('en-US', { month: 'short' })
      });
    }
    return out;
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function loadData() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
    catch (e) { return {}; }
  }

  function saveData(d) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch (e) { /* quota */ }
  }

  /* ── Mock / Demo Data ── */

  function generateDemoData() {
    return {
      activeProjects: [
        { name: 'E-commerce Redesign', totalBudget: 8000, earned: 5200, monthsLeft: 2, hourlyRate: 75 },
        { name: 'Mobile App MVP', totalBudget: 12000, earned: 3000, monthsLeft: 3, hourlyRate: 85 },
        { name: 'API Integration', totalBudget: 4500, earned: 1500, monthsLeft: 1, hourlyRate: 80 }
      ],
      pipeline: [
        { name: 'SaaS Dashboard', proposedAmount: 15000, stage: 'proposal_sent', winProbability: 0.35 },
        { name: 'Brand Identity', proposedAmount: 6000, stage: 'interview', winProbability: 0.60 },
        { name: 'WordPress Migration', proposedAmount: 3500, stage: 'shortlisted', winProbability: 0.75 }
      ],
      recurringClients: [
        { name: 'TechCorp', monthlyRetainer: 2500, reliability: 0.95 },
        { name: 'StartupXYZ', monthlyRetainer: 1200, reliability: 0.80 }
      ],
      actuals: getPastMonths(3).map(function (m, i) {
        return { label: m.label, amount: [6800, 7400, 8100][i] };
      }),
      hourlyRate: 80,
      weeklyHours: 35
    };
  }

  /* ── Revenue Streams Calculation ── */

  function calcActiveProjectRevenue(projects, months) {
    var perMonth = [0, 0, 0];
    (projects || []).forEach(function (p) {
      var remaining = Math.max(0, (p.totalBudget || 0) - (p.earned || 0));
      var mLeft = Math.max(1, p.monthsLeft || 1);
      var perMo = remaining / mLeft;
      for (var i = 0; i < 3; i++) {
        if (i < mLeft) perMonth[i] += perMo;
      }
    });
    return perMonth;
  }

  function calcPipelineRevenue(pipeline) {
    var total = 0;
    (pipeline || []).forEach(function (p) {
      var prob = clamp(p.winProbability || 0.3, 0, 1);
      total += (p.proposedAmount || 0) * prob;
    });
    // Spread weighted pipeline across 3 months (ramp: 10%, 40%, 50%)
    return [total * 0.10, total * 0.40, total * 0.50];
  }

  function calcRecurringRevenue(clients) {
    var monthly = 0;
    (clients || []).forEach(function (c) {
      var reliability = clamp(c.reliability || 0.9, 0, 1);
      monthly += (c.monthlyRetainer || 0) * reliability;
    });
    return [monthly, monthly, monthly];
  }

  /* ── Core Forecast ── */

  function forecast(data) {
    var d = data || generateDemoData();
    var months = getNextMonths(3);

    var activeRev = calcActiveProjectRevenue(d.activeProjects, months);
    var pipelineRev = calcPipelineRevenue(d.pipeline);
    var recurringRev = calcRecurringRevenue(d.recurringClients);

    var projected = months.map(function (m, i) {
      var active = Math.round(activeRev[i]);
      var pipe = Math.round(pipelineRev[i]);
      var recurring = Math.round(recurringRev[i]);
      var total = active + pipe + recurring;
      return {
        label: m.label,
        shortLabel: m.shortLabel,
        active: active,
        pipeline: pipe,
        recurring: recurring,
        total: total
      };
    });

    var totalProjected = projected.reduce(function (s, m) { return s + m.total; }, 0);

    // Scenario modeling
    var scenarios = buildScenarios(d, projected);

    return {
      projected: projected,
      totalProjected: totalProjected,
      actuals: d.actuals || [],
      streams: {
        active: activeRev.reduce(function (s, v) { return s + v; }, 0),
        pipeline: pipelineRev.reduce(function (s, v) { return s + v; }, 0),
        recurring: recurringRev.reduce(function (s, v) { return s + v; }, 0)
      },
      scenarios: scenarios,
      hourlyRate: d.hourlyRate || 0,
      weeklyHours: d.weeklyHours || 0
    };
  }

  /* ── Scenario Modeling ── */

  function buildScenarios(data, baseProjected) {
    var baseTotal = baseProjected.reduce(function (s, m) { return s + m.total; }, 0);
    var rate = data.hourlyRate || 0;
    var hours = data.weeklyHours || 0;

    var scenarios = [];

    // Scenario 1: Raise rates 10%
    if (rate > 0) {
      var rateBoost = 0.10;
      var newRate = Math.round(rate * (1 + rateBoost));
      // Active projects are fixed-price, but future hourly work increases
      var hourlyPortion = hours > 0 ? (rate * hours * 4 * 3) : baseTotal * 0.6;
      var rateGain = Math.round(hourlyPortion * rateBoost);
      scenarios.push({
        id: 'rate_10',
        label: 'Raise rates 10%',
        description: '$' + rate + '/hr → $' + newRate + '/hr',
        newTotal: baseTotal + rateGain,
        delta: rateGain,
        deltaPct: baseTotal > 0 ? Math.round((rateGain / baseTotal) * 100) : 0,
        icon: '💰'
      });
    }

    // Scenario 2: Add 5 hours/week
    if (rate > 0) {
      var extraHours = 5;
      var extraRevenue = Math.round(rate * extraHours * 4 * 3); // 4 weeks × 3 months
      scenarios.push({
        id: 'hours_5',
        label: 'Add 5 hrs/week',
        description: hours + 'h → ' + (hours + extraHours) + 'h weekly',
        newTotal: baseTotal + extraRevenue,
        delta: extraRevenue,
        deltaPct: baseTotal > 0 ? Math.round((extraRevenue / baseTotal) * 100) : 0,
        icon: '⏱️'
      });
    }

    // Scenario 3: Win all pipeline deals
    var pipelineTotal = 0;
    var pipelineWeighted = 0;
    (data.pipeline || []).forEach(function (p) {
      pipelineTotal += p.proposedAmount || 0;
      pipelineWeighted += (p.proposedAmount || 0) * (p.winProbability || 0.3);
    });
    if (pipelineTotal > 0) {
      var pipelineUpside = Math.round(pipelineTotal - pipelineWeighted);
      scenarios.push({
        id: 'win_all',
        label: 'Win all pipeline',
        description: (data.pipeline || []).length + ' deals at 100% close',
        newTotal: baseTotal + pipelineUpside,
        delta: pipelineUpside,
        deltaPct: baseTotal > 0 ? Math.round((pipelineUpside / baseTotal) * 100) : 0,
        icon: '🎯'
      });
    }

    // Scenario 4: Add new recurring client
    var avgRetainer = 0;
    var rc = data.recurringClients || [];
    if (rc.length > 0) {
      rc.forEach(function (c) { avgRetainer += c.monthlyRetainer || 0; });
      avgRetainer = Math.round(avgRetainer / rc.length);
    } else {
      avgRetainer = 2000;
    }
    var newRecurring = avgRetainer * 3;
    scenarios.push({
      id: 'new_client',
      label: 'Add recurring client',
      description: '+' + fmtFull(avgRetainer) + '/mo retainer',
      newTotal: baseTotal + newRecurring,
      delta: newRecurring,
      deltaPct: baseTotal > 0 ? Math.round((newRecurring / baseTotal) * 100) : 0,
      icon: '🤝'
    });

    return scenarios;
  }

  /* ── Chart Renderer (Canvas) ── */

  function renderChart(canvas, actuals, projected) {
    var ctx = canvas.getContext('2d');
    var dpr = window.devicePixelRatio || 1;
    var w = canvas.parentElement.offsetWidth || 600;
    var h = 240;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.scale(dpr, dpr);

    var allValues = actuals.map(function (a) { return a.amount; })
      .concat(projected.map(function (p) { return p.total; }));
    var maxVal = Math.max.apply(null, allValues) * 1.15;
    var minVal = 0;

    var totalBars = actuals.length + projected.length;
    var padding = { top: 20, right: 20, bottom: 40, left: 50 };
    var chartW = w - padding.left - padding.right;
    var chartH = h - padding.top - padding.bottom;
    var barW = Math.min(40, (chartW / totalBars) * 0.6);
    var gap = (chartW - barW * totalBars) / (totalBars + 1);

    // Background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    var gridCount = 4;
    for (var g = 0; g <= gridCount; g++) {
      var gy = padding.top + (chartH / gridCount) * g;
      ctx.beginPath();
      ctx.moveTo(padding.left, gy);
      ctx.lineTo(w - padding.right, gy);
      ctx.stroke();

      // Y-axis labels
      var yVal = maxVal - (maxVal / gridCount) * g;
      ctx.fillStyle = '#64748b';
      ctx.font = '10px -apple-system, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(fmt(yVal), padding.left - 8, gy + 4);
    }

    // Bars
    var allBars = [];
    actuals.forEach(function (a) { allBars.push({ label: a.label, value: a.amount, type: 'actual' }); });
    projected.forEach(function (p) { allBars.push({ label: p.shortLabel, value: p.total, type: 'projected' }); });

    allBars.forEach(function (b, i) {
      var x = padding.left + gap + i * (barW + gap);
      var barH = ((b.value - minVal) / (maxVal - minVal)) * chartH;
      var y = padding.top + chartH - barH;

      // Bar fill
      if (b.type === 'actual') {
        ctx.fillStyle = '#8b5cf6';
      } else {
        // Projected: gradient pattern
        var grad = ctx.createLinearGradient(x, y, x, y + barH);
        grad.addColorStop(0, '#06b6d4');
        grad.addColorStop(1, '#0891b2');
        ctx.fillStyle = grad;
      }

      // Rounded top
      var r = Math.min(4, barW / 2);
      ctx.beginPath();
      ctx.moveTo(x, y + barH);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.lineTo(x + barW - r, y);
      ctx.quadraticCurveTo(x + barW, y, x + barW, y + r);
      ctx.lineTo(x + barW, y + barH);
      ctx.closePath();
      ctx.fill();

      // Value on top
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '10px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(fmt(b.value), x + barW / 2, y - 6);

      // X-axis label
      ctx.fillStyle = b.type === 'actual' ? '#94a3b8' : '#67e8f9';
      ctx.font = '10px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(b.label, x + barW / 2, h - padding.bottom + 16);
    });

    // Divider line between actual and projected
    if (actuals.length > 0 && projected.length > 0) {
      var divX = padding.left + gap + actuals.length * (barW + gap) - gap / 2;
      ctx.strokeStyle = '#475569';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(divX, padding.top);
      ctx.lineTo(divX, h - padding.bottom);
      ctx.stroke();
      ctx.setLineDash([]);

      // Labels
      ctx.fillStyle = '#94a3b8';
      ctx.font = '9px -apple-system, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('Actual', divX - 6, padding.top + 12);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#67e8f9';
      ctx.fillText('Projected', divX + 6, padding.top + 12);
    }
  }

  /* ── Stream Breakdown Mini Chart ── */

  function renderStreamBar(canvas, streams) {
    var ctx = canvas.getContext('2d');
    var dpr = window.devicePixelRatio || 1;
    var w = canvas.parentElement.offsetWidth || 300;
    var h = 32;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.scale(dpr, dpr);

    var total = streams.active + streams.pipeline + streams.recurring;
    if (total === 0) return;

    var colors = ['#8b5cf6', '#f59e0b', '#10b981'];
    var values = [streams.active, streams.pipeline, streams.recurring];
    var x = 0;
    var r = 6;

    values.forEach(function (v, i) {
      var segW = (v / total) * w;
      if (segW < 1) return;
      ctx.fillStyle = colors[i];
      if (i === 0) {
        // First segment: rounded left
        ctx.beginPath();
        ctx.moveTo(x + r, 0);
        ctx.lineTo(x + segW, 0);
        ctx.lineTo(x + segW, h);
        ctx.lineTo(x + r, h);
        ctx.quadraticCurveTo(x, h, x, h - r);
        ctx.lineTo(x, r);
        ctx.quadraticCurveTo(x, 0, x + r, 0);
        ctx.fill();
      } else if (i === values.length - 1 || (i < values.length - 1 && values[i + 1] === 0)) {
        // Last visible segment: rounded right
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + segW - r, 0);
        ctx.quadraticCurveTo(x + segW, 0, x + segW, r);
        ctx.lineTo(x + segW, h - r);
        ctx.quadraticCurveTo(x + segW, h, x + segW - r, h);
        ctx.lineTo(x, h);
        ctx.fill();
      } else {
        ctx.fillRect(x, 0, segW, h);
      }
      x += segW;
    });
  }

  /* ── Full Renderer ── */

  function renderRevenueForecast(profileData, container) {
    var el = typeof container === 'string' ? document.querySelector(container) : container;
    if (!el) return;

    var data = profileData || loadData();
    var hasData = (data.activeProjects && data.activeProjects.length > 0) ||
                  (data.pipeline && data.pipeline.length > 0) ||
                  (data.recurringClients && data.recurringClients.length > 0);

    if (!hasData) {
      // Use demo data for showcase
      data = generateDemoData();
    }

    var result = forecast(data);
    el.innerHTML = buildHTML(result);

    // Render canvas charts after DOM insertion
    requestAnimationFrame(function () {
      var mainCanvas = el.querySelector('#rf-main-chart');
      if (mainCanvas) renderChart(mainCanvas, result.actuals, result.projected);

      var streamCanvas = el.querySelector('#rf-stream-bar');
      if (streamCanvas) renderStreamBar(streamCanvas, result.streams);

      // Wire up scenario toggles
      wireScenarios(el, result);
    });
  }

  /* ── HTML Builder ── */

  function buildHTML(data) {
    var html = '<div class="rf-container">';
    html += '<style>' + getStyles() + '</style>';

    // Header
    html += '<div class="rf-header-row">';
    html += '<h2 class="rf-header">Revenue Forecast</h2>';
    html += '<span class="rf-badge">Next 3 Months</span>';
    html += '</div>';

    // Top stats
    html += '<div class="rf-stats">';
    html += statCard('Projected Total', fmtFull(data.totalProjected), '#06b6d4');
    var avgMonthly = Math.round(data.totalProjected / 3);
    html += statCard('Avg / Month', fmtFull(avgMonthly), '#8b5cf6');
    var streamCount = (data.streams.active > 0 ? 1 : 0) + (data.streams.pipeline > 0 ? 1 : 0) + (data.streams.recurring > 0 ? 1 : 0);
    html += statCard('Revenue Streams', streamCount + ' active', '#10b981');
    html += '</div>';

    // Revenue streams breakdown
    html += '<div class="rf-section-title">Revenue Streams</div>';
    html += '<div class="rf-streams-canvas-wrap"><canvas id="rf-stream-bar"></canvas></div>';
    html += '<div class="rf-stream-legend">';
    html += streamLegend('Active Projects', data.streams.active, '#8b5cf6');
    html += streamLegend('Pipeline (weighted)', data.streams.pipeline, '#f59e0b');
    html += streamLegend('Recurring Clients', data.streams.recurring, '#10b981');
    html += '</div>';

    // Projected vs Actual chart
    html += '<div class="rf-section-title">Projected vs Actual</div>';
    html += '<div class="rf-chart-wrap"><canvas id="rf-main-chart"></canvas></div>';

    // Monthly breakdown table
    html += '<div class="rf-section-title">Monthly Breakdown</div>';
    html += '<div class="rf-table-wrap"><table class="rf-table">';
    html += '<thead><tr><th>Month</th><th>Active</th><th>Pipeline</th><th>Recurring</th><th>Total</th></tr></thead>';
    html += '<tbody>';
    data.projected.forEach(function (m) {
      html += '<tr>';
      html += '<td class="rf-month-cell">' + m.label + '</td>';
      html += '<td class="rf-col-active">' + fmt(m.active) + '</td>';
      html += '<td class="rf-col-pipe">' + fmt(m.pipeline) + '</td>';
      html += '<td class="rf-col-recur">' + fmt(m.recurring) + '</td>';
      html += '<td class="rf-col-total">' + fmt(m.total) + '</td>';
      html += '</tr>';
    });
    html += '</tbody></table></div>';

    // Scenario modeling
    html += '<div class="rf-section-title">Scenario Modeling</div>';
    html += '<div class="rf-scenarios" id="rf-scenarios">';
    data.scenarios.forEach(function (s) {
      html += scenarioCard(s, data.totalProjected);
    });
    html += '</div>';

    // Insight
    var bestScenario = data.scenarios.reduce(function (best, s) {
      return s.delta > best.delta ? s : best;
    }, { delta: 0, label: '' });

    if (bestScenario.delta > 0) {
      html += '<div class="rf-insight">';
      html += '<div class="rf-insight-icon">💡</div>';
      html += '<div class="rf-insight-body">';
      html += '<div class="rf-insight-title">Biggest Growth Lever</div>';
      html += '<p>"' + bestScenario.label + '" adds ' + fmtFull(bestScenario.delta) + ' (+' + bestScenario.deltaPct + '%) over 3 months.</p>';
      html += '</div></div>';
    }

    html += '</div>';
    return html;
  }

  function statCard(label, value, color) {
    return '<div class="rf-stat">' +
      '<div class="rf-stat-value" style="color:' + color + '">' + value + '</div>' +
      '<div class="rf-stat-label">' + label + '</div>' +
    '</div>';
  }

  function streamLegend(label, value, color) {
    var total = value;
    return '<div class="rf-stream-item">' +
      '<span class="rf-stream-dot" style="background:' + color + '"></span>' +
      '<span class="rf-stream-name">' + label + '</span>' +
      '<span class="rf-stream-val">' + fmtFull(Math.round(total)) + '</span>' +
    '</div>';
  }

  function scenarioCard(s, baseTotal) {
    var sign = s.delta >= 0 ? '+' : '';
    return '<div class="rf-scenario" data-scenario="' + s.id + '">' +
      '<div class="rf-scenario-top">' +
        '<span class="rf-scenario-icon">' + s.icon + '</span>' +
        '<span class="rf-scenario-label">' + s.label + '</span>' +
      '</div>' +
      '<div class="rf-scenario-desc">' + s.description + '</div>' +
      '<div class="rf-scenario-nums">' +
        '<div class="rf-scenario-new">' + fmtFull(s.newTotal) + '</div>' +
        '<div class="rf-scenario-delta ' + (s.delta >= 0 ? 'rf-positive' : 'rf-negative') + '">' +
          sign + fmtFull(s.delta) + ' (' + sign + s.deltaPct + '%)' +
        '</div>' +
      '</div>' +
      '<div class="rf-scenario-bar-track">' +
        '<div class="rf-scenario-bar-base" style="width:100%"></div>' +
        '<div class="rf-scenario-bar-delta" style="width:' + Math.min(100, Math.round((s.newTotal / (baseTotal * 1.5)) * 100)) + '%"></div>' +
      '</div>' +
    '</div>';
  }

  /* ── Scenario Interaction ── */

  function wireScenarios(el, result) {
    var cards = el.querySelectorAll('.rf-scenario');
    cards.forEach(function (card) {
      card.addEventListener('click', function () {
        var isActive = card.classList.contains('rf-scenario-active');
        // Remove all active
        cards.forEach(function (c) { c.classList.remove('rf-scenario-active'); });
        if (!isActive) {
          card.classList.add('rf-scenario-active');
        }
      });
    });
  }

  /* ── Styles ── */

  function getStyles() {
    return '' +
    '.rf-container{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#e2e8f0;max-width:720px}' +
    '.rf-header-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}' +
    '.rf-header{font-size:1.25rem;font-weight:700;margin:0;color:#f1f5f9}' +
    '.rf-badge{font-size:.7rem;font-weight:600;color:#06b6d4;background:rgba(6,182,212,.12);padding:4px 10px;border-radius:20px}' +
    '.rf-section-title{font-size:.8rem;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:#94a3b8;margin:20px 0 10px}' +

    /* Stats */
    '.rf-stats{display:flex;gap:10px;margin-bottom:8px}' +
    '.rf-stat{flex:1;background:#1e293b;border-radius:10px;padding:14px;text-align:center}' +
    '.rf-stat-value{font-size:1.2rem;font-weight:700}' +
    '.rf-stat-label{font-size:.7rem;color:#94a3b8;margin-top:4px}' +

    /* Stream bar */
    '.rf-streams-canvas-wrap{margin-bottom:10px}' +
    '.rf-stream-legend{display:flex;gap:16px;flex-wrap:wrap}' +
    '.rf-stream-item{display:flex;align-items:center;gap:6px;font-size:.78rem}' +
    '.rf-stream-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}' +
    '.rf-stream-name{color:#94a3b8}' +
    '.rf-stream-val{color:#e2e8f0;font-weight:600}' +

    /* Chart */
    '.rf-chart-wrap{background:#0f172a;border-radius:10px;padding:8px;overflow:hidden}' +
    '.rf-chart-wrap canvas{display:block;width:100%}' +

    /* Table */
    '.rf-table-wrap{overflow-x:auto}' +
    '.rf-table{width:100%;border-collapse:collapse;font-size:.82rem}' +
    '.rf-table th,.rf-table td{padding:8px 10px;text-align:right;border-bottom:1px solid #1e293b}' +
    '.rf-table th{color:#64748b;font-weight:600;font-size:.72rem;text-transform:uppercase}' +
    '.rf-table td:first-child,.rf-table th:first-child{text-align:left}' +
    '.rf-month-cell{font-weight:600;color:#f1f5f9}' +
    '.rf-col-active{color:#8b5cf6}' +
    '.rf-col-pipe{color:#f59e0b}' +
    '.rf-col-recur{color:#10b981}' +
    '.rf-col-total{color:#06b6d4;font-weight:700}' +

    /* Scenarios */
    '.rf-scenarios{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px}' +
    '.rf-scenario{background:#1e293b;border-radius:10px;padding:14px;cursor:pointer;border:1px solid transparent;transition:border-color .2s,transform .15s}' +
    '.rf-scenario:hover{border-color:#334155;transform:translateY(-1px)}' +
    '.rf-scenario-active{border-color:#06b6d4;background:#0f2a3b}' +
    '.rf-scenario-top{display:flex;align-items:center;gap:6px;margin-bottom:4px}' +
    '.rf-scenario-icon{font-size:1rem}' +
    '.rf-scenario-label{font-size:.78rem;font-weight:600;color:#f1f5f9}' +
    '.rf-scenario-desc{font-size:.68rem;color:#64748b;margin-bottom:8px}' +
    '.rf-scenario-nums{margin-bottom:6px}' +
    '.rf-scenario-new{font-size:1rem;font-weight:700;color:#e2e8f0}' +
    '.rf-scenario-delta{font-size:.72rem;font-weight:600}' +
    '.rf-positive{color:#10b981}' +
    '.rf-negative{color:#ef4444}' +
    '.rf-scenario-bar-track{height:4px;background:#0f172a;border-radius:2px;overflow:hidden;position:relative}' +
    '.rf-scenario-bar-base{position:absolute;height:100%;background:#334155;border-radius:2px}' +
    '.rf-scenario-bar-delta{position:absolute;height:100%;background:#06b6d4;border-radius:2px;transition:width .4s ease}' +
    '.rf-scenario-active .rf-scenario-bar-delta{background:#10b981}' +

    /* Insight */
    '.rf-insight{display:flex;gap:12px;align-items:flex-start;background:#1e293b;border-radius:10px;padding:14px;margin-top:20px;border-left:3px solid #06b6d4}' +
    '.rf-insight-icon{font-size:1.3rem;flex-shrink:0}' +
    '.rf-insight-title{font-weight:700;font-size:.85rem;color:#06b6d4;margin-bottom:4px}' +
    '.rf-insight-body p{margin:0;font-size:.8rem;color:#cbd5e1;line-height:1.5}' +

    /* Responsive */
    '@media(max-width:480px){' +
      '.rf-stats{flex-direction:column}' +
      '.rf-scenarios{grid-template-columns:1fr}' +
      '.rf-stream-legend{flex-direction:column;gap:6px}' +
    '}' +
    '';
  }

  /* ── Export ── */

  window.CortexRevenueForecast = {
    forecast: forecast,
    renderRevenueForecast: renderRevenueForecast,
    generateDemoData: generateDemoData
  };

})();
