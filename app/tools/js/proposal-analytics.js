/**
 * [cf3-033] Proposal Win/Loss Analytics
 * Track proposal outcomes (sent, viewed, won, lost, no response).
 * Calculate win rate by project type, budget range, client industry,
 * proposal length. Identify patterns to improve future proposals.
 * Exposed on window.CortexProposalAnalytics
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_proposal_analytics';
  var SETTINGS_KEY = 'cortex_proposal_analytics_settings';

  /* ───────── Storage helpers ───────── */

  function load() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
    catch (e) { return []; }
  }

  function save(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function loadSettings() {
    try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); }
    catch (e) { return {}; }
  }

  function saveSettings(s) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  }

  /* ───────── Utilities ───────── */

  function uid() {
    return Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function fmt(n) {
    if (n == null || isNaN(n)) return '$0';
    if (n >= 1000000) return '$' + (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return '$' + (n / 1000).toFixed(1) + 'K';
    return '$' + Math.round(n).toLocaleString();
  }

  function pct(n) {
    return (Math.round(n * 10) / 10) + '%';
  }

  function showToast(msg) {
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(function () { t.classList.remove('show'); }, 2500);
  }

  var STATUSES = ['sent', 'viewed', 'won', 'lost', 'no_response'];

  var STATUS_LABELS = {
    sent: 'Sent',
    viewed: 'Viewed',
    won: 'Won',
    lost: 'Lost',
    no_response: 'No Response'
  };

  var STATUS_COLORS = {
    sent: '#44aaff',
    viewed: '#cc66ff',
    won: '#00ff88',
    lost: '#ff4444',
    no_response: '#888'
  };

  /* ───────── Budget range classification ───────── */

  var BUDGET_RANGES = [
    { label: 'Under $500', min: 0, max: 500 },
    { label: '$500–$1K', min: 500, max: 1000 },
    { label: '$1K–$2K', min: 1000, max: 2000 },
    { label: '$2K–$5K', min: 2000, max: 5000 },
    { label: '$5K–$10K', min: 5000, max: 10000 },
    { label: '$10K–$25K', min: 10000, max: 25000 },
    { label: '$25K+', min: 25000, max: Infinity }
  ];

  function getBudgetRange(budget) {
    budget = Number(budget) || 0;
    if (budget <= 0) return 'Not specified';
    for (var i = 0; i < BUDGET_RANGES.length; i++) {
      if (budget >= BUDGET_RANGES[i].min && budget < BUDGET_RANGES[i].max) {
        return BUDGET_RANGES[i].label;
      }
    }
    return '$25K+';
  }

  /* ───────── Proposal length classification ───────── */

  function getProposalLengthBucket(wordCount) {
    wordCount = Number(wordCount) || 0;
    if (wordCount <= 0) return 'Unknown';
    if (wordCount < 100) return 'Short (<100 words)';
    if (wordCount < 250) return 'Medium (100–250 words)';
    if (wordCount < 500) return 'Long (250–500 words)';
    return 'Very Long (500+ words)';
  }

  /* ───────── Data entry ───────── */

  function addProposal(params) {
    if (!params || !params.title) {
      showToast('Proposal title is required');
      return null;
    }

    var entry = {
      id: uid(),
      title: params.title,
      client: params.client || '',
      industry: params.industry || 'Other',
      projectType: params.projectType || 'Other',
      budget: Number(params.budget) || 0,
      proposalLength: Number(params.proposalLength) || 0,
      status: params.status || 'sent',
      dateSent: params.dateSent || new Date().toISOString().slice(0, 10),
      dateUpdated: new Date().toISOString(),
      responseTime: params.responseTime || null,
      notes: params.notes || ''
    };

    var entries = load();
    entries.push(entry);
    save(entries);
    return entry;
  }

  function updateStatus(id, status) {
    var entries = load();
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].id === id) {
        entries[i].status = status;
        entries[i].dateUpdated = new Date().toISOString();
        if (status === 'won' || status === 'lost' || status === 'no_response') {
          var sent = new Date(entries[i].dateSent);
          var now = new Date();
          entries[i].responseTime = Math.round((now - sent) / (1000 * 60 * 60 * 24));
        }
        save(entries);
        return entries[i];
      }
    }
    return null;
  }

  function deleteProposal(id) {
    var entries = load();
    var filtered = entries.filter(function (e) { return e.id !== id; });
    if (filtered.length < entries.length) {
      save(filtered);
      return true;
    }
    return false;
  }

  /* ───────── Analytics engine ───────── */

  function getOverallStats() {
    var entries = load();
    var stats = { total: entries.length, sent: 0, viewed: 0, won: 0, lost: 0, no_response: 0 };

    for (var i = 0; i < entries.length; i++) {
      var s = entries[i].status;
      if (stats[s] !== undefined) stats[s]++;
    }

    var decided = stats.won + stats.lost;
    stats.winRate = decided > 0 ? (stats.won / decided) * 100 : 0;
    stats.responseRate = stats.total > 0 ? ((stats.total - stats.no_response) / stats.total) * 100 : 0;
    stats.avgResponseDays = 0;

    var totalDays = 0;
    var dayCount = 0;
    for (var j = 0; j < entries.length; j++) {
      if (entries[j].responseTime != null && entries[j].responseTime > 0) {
        totalDays += entries[j].responseTime;
        dayCount++;
      }
    }
    stats.avgResponseDays = dayCount > 0 ? Math.round(totalDays / dayCount) : 0;

    return stats;
  }

  function groupBy(field, labelFn) {
    var entries = load();
    var groups = {};

    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      var key = labelFn ? labelFn(e[field]) : (e[field] || 'Other');

      if (!groups[key]) {
        groups[key] = { total: 0, won: 0, lost: 0, no_response: 0, sent: 0, viewed: 0, winRate: 0, avgBudget: 0, totalBudget: 0 };
      }
      groups[key].total++;
      groups[key].totalBudget += Number(e.budget) || 0;
      var s = e.status;
      if (groups[key][s] !== undefined) groups[key][s]++;
    }

    var keys = Object.keys(groups);
    for (var j = 0; j < keys.length; j++) {
      var g = groups[keys[j]];
      var decided = g.won + g.lost;
      g.winRate = decided > 0 ? (g.won / decided) * 100 : 0;
      g.avgBudget = g.total > 0 ? g.totalBudget / g.total : 0;
    }

    return groups;
  }

  function getWinRateByProjectType() {
    return groupBy('projectType');
  }

  function getWinRateByBudgetRange() {
    return groupBy('budget', getBudgetRange);
  }

  function getWinRateByIndustry() {
    return groupBy('industry');
  }

  function getWinRateByProposalLength() {
    return groupBy('proposalLength', getProposalLengthBucket);
  }

  function getMonthlyTrend(months) {
    months = months || 6;
    var entries = load();
    var buckets = {};

    var now = new Date();
    for (var m = 0; m < months; m++) {
      var d = new Date(now.getFullYear(), now.getMonth() - m, 1);
      var key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      buckets[key] = { month: key, total: 0, won: 0, lost: 0, no_response: 0, winRate: 0 };
    }

    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      var eMonth = (e.dateSent || '').slice(0, 7);
      if (buckets[eMonth]) {
        buckets[eMonth].total++;
        var s = e.status;
        if (buckets[eMonth][s] !== undefined) buckets[eMonth][s]++;
      }
    }

    var result = [];
    var keys = Object.keys(buckets).sort();
    for (var j = 0; j < keys.length; j++) {
      var b = buckets[keys[j]];
      var decided = b.won + b.lost;
      b.winRate = decided > 0 ? (b.won / decided) * 100 : 0;
      result.push(b);
    }
    return result;
  }

  /* ───────── Pattern detection ───────── */

  function detectPatterns() {
    var patterns = [];
    var entries = load();
    if (entries.length < 3) return patterns;

    // Budget range patterns
    var byBudget = getWinRateByBudgetRange();
    var budgetKeys = Object.keys(byBudget).filter(function (k) {
      return k !== 'Not specified' && (byBudget[k].won + byBudget[k].lost) >= 2;
    });
    budgetKeys.sort(function (a, b) { return byBudget[b].winRate - byBudget[a].winRate; });

    if (budgetKeys.length >= 2) {
      var best = budgetKeys[0];
      var worst = budgetKeys[budgetKeys.length - 1];
      if (byBudget[best].winRate - byBudget[worst].winRate > 15) {
        patterns.push({
          type: 'budget',
          severity: 'high',
          message: 'Proposals in the ' + best + ' range have ' + pct(byBudget[best].winRate) + ' win rate vs ' + pct(byBudget[worst].winRate) + ' for ' + worst,
          recommendation: 'Focus on ' + best + ' projects for higher conversion'
        });
      }
    }

    // Project type patterns
    var byType = getWinRateByProjectType();
    var typeKeys = Object.keys(byType).filter(function (k) {
      return k !== 'Other' && (byType[k].won + byType[k].lost) >= 2;
    });
    typeKeys.sort(function (a, b) { return byType[b].winRate - byType[a].winRate; });

    if (typeKeys.length >= 2) {
      var bestType = typeKeys[0];
      var worstType = typeKeys[typeKeys.length - 1];
      if (byType[bestType].winRate - byType[worstType].winRate > 15) {
        patterns.push({
          type: 'project_type',
          severity: 'high',
          message: bestType + ' proposals win at ' + pct(byType[bestType].winRate) + ' vs ' + pct(byType[worstType].winRate) + ' for ' + worstType,
          recommendation: 'Your ' + bestType + ' proposals are strongest — consider specializing'
        });
      }
    }

    // Industry patterns
    var byIndustry = getWinRateByIndustry();
    var indKeys = Object.keys(byIndustry).filter(function (k) {
      return k !== 'Other' && (byIndustry[k].won + byIndustry[k].lost) >= 2;
    });
    indKeys.sort(function (a, b) { return byIndustry[b].winRate - byIndustry[a].winRate; });

    if (indKeys.length >= 1 && byIndustry[indKeys[0]].winRate > 50) {
      patterns.push({
        type: 'industry',
        severity: 'medium',
        message: 'You win ' + pct(byIndustry[indKeys[0]].winRate) + ' of ' + indKeys[0] + ' proposals',
        recommendation: 'Target more ' + indKeys[0] + ' clients to boost overall win rate'
      });
    }

    // Proposal length patterns
    var byLength = getWinRateByProposalLength();
    var lenKeys = Object.keys(byLength).filter(function (k) {
      return k !== 'Unknown' && (byLength[k].won + byLength[k].lost) >= 2;
    });
    lenKeys.sort(function (a, b) { return byLength[b].winRate - byLength[a].winRate; });

    if (lenKeys.length >= 2) {
      var bestLen = lenKeys[0];
      if (byLength[bestLen].winRate > 40) {
        patterns.push({
          type: 'length',
          severity: 'medium',
          message: bestLen + ' proposals have the highest win rate at ' + pct(byLength[bestLen].winRate),
          recommendation: 'Aim for this word count range in future proposals'
        });
      }
    }

    // Response rate pattern
    var overall = getOverallStats();
    if (overall.no_response > 0 && overall.total >= 5) {
      var noRespRate = (overall.no_response / overall.total) * 100;
      if (noRespRate > 30) {
        patterns.push({
          type: 'response',
          severity: 'high',
          message: pct(noRespRate) + ' of proposals get no response (' + overall.no_response + '/' + overall.total + ')',
          recommendation: 'Consider adding follow-up reminders after 3–5 days'
        });
      }
    }

    // Win rate trend
    var trend = getMonthlyTrend(3);
    var recentDecided = trend.filter(function (m) { return (m.won + m.lost) > 0; });
    if (recentDecided.length >= 2) {
      var first = recentDecided[0].winRate;
      var last = recentDecided[recentDecided.length - 1].winRate;
      var diff = last - first;
      if (Math.abs(diff) > 10) {
        patterns.push({
          type: 'trend',
          severity: diff > 0 ? 'positive' : 'warning',
          message: 'Win rate ' + (diff > 0 ? 'improved' : 'declined') + ' by ' + pct(Math.abs(diff)) + ' over the last 3 months',
          recommendation: diff > 0 ? 'Keep doing what you\'re doing — your proposals are improving' : 'Review recent lost proposals for common feedback'
        });
      }
    }

    return patterns;
  }

  /* ───────── Rendering ───────── */

  var charts = {};
  var currentView = 'overview';
  var currentPeriod = 6;

  function destroyChart(name) {
    if (charts[name]) { charts[name].destroy(); charts[name] = null; }
  }

  function renderKPIs() {
    var stats = getOverallStats();
    var el = document.getElementById('pa-kpis');
    if (!el) return;

    el.innerHTML =
      '<div class="kpi-card" style="border-top-color: #cc66ff">' +
        '<div class="kpi-value">' + pct(stats.winRate) + '</div>' +
        '<div class="kpi-label">Win Rate</div>' +
        '<div class="kpi-sub">' + stats.won + ' won / ' + (stats.won + stats.lost) + ' decided</div>' +
      '</div>' +
      '<div class="kpi-card" style="border-top-color: #44aaff">' +
        '<div class="kpi-value">' + stats.total + '</div>' +
        '<div class="kpi-label">Total Proposals</div>' +
        '<div class="kpi-sub">' + STATUSES.map(function (s) { return stats[s] + ' ' + STATUS_LABELS[s].toLowerCase(); }).join(', ') + '</div>' +
      '</div>' +
      '<div class="kpi-card" style="border-top-color: #00ff88">' +
        '<div class="kpi-value">' + pct(stats.responseRate) + '</div>' +
        '<div class="kpi-label">Response Rate</div>' +
        '<div class="kpi-sub">' + stats.no_response + ' got no response</div>' +
      '</div>' +
      '<div class="kpi-card" style="border-top-color: #ffc800">' +
        '<div class="kpi-value">' + stats.avgResponseDays + 'd</div>' +
        '<div class="kpi-label">Avg Response Time</div>' +
        '<div class="kpi-sub">Days until outcome</div>' +
      '</div>';
  }

  function renderStatusChart() {
    var stats = getOverallStats();
    destroyChart('status');

    var canvas = document.getElementById('chart-pa-status');
    if (!canvas || stats.total === 0) return;

    charts.status = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: STATUSES.map(function (s) { return STATUS_LABELS[s]; }),
        datasets: [{
          data: STATUSES.map(function (s) { return stats[s]; }),
          backgroundColor: STATUSES.map(function (s) { return STATUS_COLORS[s]; }),
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: { position: 'bottom', labels: { color: '#ccc', padding: 12, font: { size: 11 } } }
        }
      }
    });
  }

  function renderTrendChart() {
    var trend = getMonthlyTrend(currentPeriod);
    destroyChart('trend');

    var canvas = document.getElementById('chart-pa-trend');
    if (!canvas || trend.length === 0) return;

    var monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var labels = trend.map(function (m) {
      var parts = m.month.split('-');
      return monthNames[parseInt(parts[1], 10) - 1] + ' ' + parts[0].slice(2);
    });

    charts.trend = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          { type: 'bar', label: 'Won', data: trend.map(function (m) { return m.won; }), backgroundColor: 'rgba(0,255,136,0.4)', borderColor: '#00ff88', borderWidth: 1, borderRadius: 4, order: 2 },
          { type: 'bar', label: 'Lost', data: trend.map(function (m) { return m.lost; }), backgroundColor: 'rgba(255,68,68,0.4)', borderColor: '#ff4444', borderWidth: 1, borderRadius: 4, order: 3 },
          { type: 'line', label: 'Win Rate %', data: trend.map(function (m) { return (m.won + m.lost) > 0 ? m.winRate : null; }), borderColor: '#cc66ff', backgroundColor: 'rgba(204,102,255,0.08)', fill: false, tension: 0.35, pointRadius: 4, borderWidth: 2, yAxisID: 'y1', spanGaps: true, order: 1 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'top', labels: { color: '#ccc', boxWidth: 14, padding: 16, font: { size: 11 } } },
          tooltip: { backgroundColor: 'rgba(17,17,24,.92)', padding: 10, cornerRadius: 8 }
        },
        scales: {
          y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { stepSize: 1, color: '#888' } },
          y1: { position: 'right', beginAtZero: true, max: 100, grid: { display: false }, ticks: { callback: function (v) { return v + '%'; }, color: '#888' } },
          x: { grid: { display: false }, ticks: { color: '#888' } }
        },
        animation: { duration: 600, easing: 'easeOutQuart' }
      }
    });
  }

  function renderBreakdownBars(containerId, groups, colorClass) {
    var el = document.getElementById(containerId);
    if (!el) return;

    var keys = Object.keys(groups);
    if (keys.length === 0) {
      el.innerHTML = '<div class="empty-msg">No data yet</div>';
      return;
    }

    keys.sort(function (a, b) { return groups[b].winRate - groups[a].winRate; });

    var html = '';
    for (var i = 0; i < keys.length; i++) {
      var g = groups[keys[i]];
      var decided = g.won + g.lost;
      var barWidth = Math.max(g.winRate, 2);
      var barColor = g.winRate >= 50 ? '#00ff88' : g.winRate >= 30 ? '#ffc800' : '#ff4444';

      html += '<div class="pa-bar-row">' +
        '<div class="pa-bar-header">' +
          '<span class="pa-bar-name">' + esc(keys[i]) + '</span>' +
          '<span class="pa-bar-rate" style="color:' + barColor + '">' + pct(g.winRate) + '</span>' +
        '</div>' +
        '<div class="pa-bar-track">' +
          '<div class="pa-bar-fill" style="width:' + barWidth + '%;background:' + barColor + '"></div>' +
        '</div>' +
        '<div class="pa-bar-meta">' + g.won + 'W / ' + g.lost + 'L' + (g.no_response ? ' / ' + g.no_response + ' NR' : '') + ' — ' + g.total + ' total' +
          (g.avgBudget > 0 ? ' — avg ' + fmt(g.avgBudget) : '') +
        '</div>' +
      '</div>';
    }
    el.innerHTML = html;
  }

  function renderBreakdowns() {
    renderBreakdownBars('pa-by-type', getWinRateByProjectType());
    renderBreakdownBars('pa-by-budget', getWinRateByBudgetRange());
    renderBreakdownBars('pa-by-industry', getWinRateByIndustry());
    renderBreakdownBars('pa-by-length', getWinRateByProposalLength());
  }

  function renderPatterns() {
    var el = document.getElementById('pa-patterns');
    if (!el) return;

    var patterns = detectPatterns();
    if (patterns.length === 0) {
      el.innerHTML = '<div class="empty-msg">Add more proposals to unlock pattern insights (minimum 3 with outcomes)</div>';
      return;
    }

    var severityIcons = { high: '\u26A0', medium: '\u2139', positive: '\u2713', warning: '\u25BC' };
    var severityColors = { high: '#ff4444', medium: '#ffc800', positive: '#00ff88', warning: '#ff8844' };

    var html = '';
    for (var i = 0; i < patterns.length; i++) {
      var p = patterns[i];
      var color = severityColors[p.severity] || '#888';
      html += '<div class="pa-pattern-card" style="border-left: 3px solid ' + color + '">' +
        '<div class="pa-pattern-icon" style="color:' + color + '">' + (severityIcons[p.severity] || '') + '</div>' +
        '<div class="pa-pattern-content">' +
          '<div class="pa-pattern-msg">' + esc(p.message) + '</div>' +
          '<div class="pa-pattern-rec">' + esc(p.recommendation) + '</div>' +
        '</div>' +
      '</div>';
    }
    el.innerHTML = html;
  }

  function renderProposalLog() {
    var entries = load();
    var el = document.getElementById('pa-log');
    if (!el) return;

    if (entries.length === 0) {
      el.innerHTML = '<div class="empty-msg">No proposals tracked yet. Add your first proposal above.</div>';
      return;
    }

    entries.sort(function (a, b) { return (b.dateSent || '').localeCompare(a.dateSent || ''); });

    var html = '<table class="log-table"><thead><tr>' +
      '<th>Title</th><th>Client</th><th>Type</th><th>Budget</th><th>Status</th><th>Date</th><th></th>' +
      '</tr></thead><tbody>';

    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      var statusColor = STATUS_COLORS[e.status] || '#888';
      html += '<tr>' +
        '<td>' + esc(e.title) + '</td>' +
        '<td>' + esc(e.client) + '</td>' +
        '<td>' + esc(e.projectType) + '</td>' +
        '<td>' + fmt(e.budget) + '</td>' +
        '<td><span style="color:' + statusColor + ';font-weight:600">' + esc(STATUS_LABELS[e.status] || e.status) + '</span>' +
          '<select class="pa-status-select" data-id="' + esc(e.id) + '" onchange="CortexProposalAnalytics.handleStatusChange(this)">' +
            STATUSES.map(function (s) {
              return '<option value="' + s + '"' + (s === e.status ? ' selected' : '') + '>' + STATUS_LABELS[s] + '</option>';
            }).join('') +
          '</select>' +
        '</td>' +
        '<td>' + esc(e.dateSent) + '</td>' +
        '<td><button class="delete-btn" onclick="CortexProposalAnalytics.deleteAndRender(\'' + esc(e.id) + '\')" title="Delete">&times;</button></td>' +
      '</tr>';
    }
    html += '</tbody></table>';
    el.innerHTML = html;
  }

  function render() {
    renderKPIs();
    renderStatusChart();
    renderTrendChart();
    renderBreakdowns();
    renderPatterns();
    renderProposalLog();
  }

  /* ───────── Form handling ───────── */

  function addFromForm() {
    var title = document.getElementById('pa-title');
    var client = document.getElementById('pa-client');
    var industry = document.getElementById('pa-industry');
    var projectType = document.getElementById('pa-project-type');
    var budget = document.getElementById('pa-budget');
    var length = document.getElementById('pa-length');
    var status = document.getElementById('pa-status');
    var date = document.getElementById('pa-date');

    if (!title || !title.value.trim()) {
      showToast('Enter a proposal title');
      return;
    }

    var entry = addProposal({
      title: title.value.trim(),
      client: client ? client.value.trim() : '',
      industry: industry ? industry.value : 'Other',
      projectType: projectType ? projectType.value : 'Other',
      budget: budget ? parseFloat(budget.value) : 0,
      proposalLength: length ? parseInt(length.value, 10) : 0,
      status: status ? status.value : 'sent',
      dateSent: date ? date.value : new Date().toISOString().slice(0, 10)
    });

    if (entry) {
      if (title) title.value = '';
      if (client) client.value = '';
      if (budget) budget.value = '';
      if (length) length.value = '';
      render();
      showToast('Proposal tracked: ' + entry.title);
    }
  }

  function handleStatusChange(select) {
    var id = select.getAttribute('data-id');
    var newStatus = select.value;
    updateStatus(id, newStatus);
    render();
    showToast('Status updated to ' + STATUS_LABELS[newStatus]);
  }

  function deleteAndRender(id) {
    deleteProposal(id);
    render();
    showToast('Proposal removed');
  }

  function clearAll() {
    if (!confirm('Delete all proposal analytics data? This cannot be undone.')) return;
    localStorage.removeItem(STORAGE_KEY);
    render();
    showToast('All proposal data cleared');
  }

  /* ───────── Import from existing proposal data ───────── */

  function importFromProposalOutcomes() {
    var existingKey = 'cortex_proposal_outcomes';
    try {
      var existing = JSON.parse(localStorage.getItem(existingKey) || '[]');
      if (existing.length === 0) {
        showToast('No existing proposal outcomes to import');
        return 0;
      }

      var statusMap = { won: 'won', lost: 'lost', pending: 'sent', withdrawn: 'no_response' };
      var imported = 0;
      var entries = load();
      var existingIds = {};
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].importedFrom) existingIds[entries[i].importedFrom] = true;
      }

      for (var j = 0; j < existing.length; j++) {
        var o = existing[j];
        if (existingIds[o.id || o.jobId]) continue;

        entries.push({
          id: uid(),
          importedFrom: o.id || o.jobId,
          title: o.jobId || 'Imported #' + (j + 1),
          client: '',
          industry: 'Other',
          projectType: o.category || 'Other',
          budget: Number(o.budget) || 0,
          proposalLength: 0,
          status: statusMap[o.outcome] || 'sent',
          dateSent: o.date ? o.date.slice(0, 10) : new Date().toISOString().slice(0, 10),
          dateUpdated: new Date().toISOString(),
          responseTime: null,
          notes: o.notes || 'Imported from proposal tracker'
        });
        imported++;
      }

      if (imported > 0) {
        save(entries);
        render();
      }
      showToast('Imported ' + imported + ' proposals');
      return imported;
    } catch (e) {
      showToast('Import failed');
      return 0;
    }
  }

  /* ───────── Period tabs ───────── */

  var periodTabs = document.getElementById('pa-period-tabs');
  if (periodTabs) {
    periodTabs.addEventListener('click', function (e) {
      var btn = e.target.closest('.period-btn');
      if (!btn) return;
      periodTabs.querySelectorAll('.period-btn').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      currentPeriod = parseInt(btn.dataset.months, 10) || 12;
      renderTrendChart();
    });
  }

  /* ───────── View tabs ───────── */

  var viewTabs = document.getElementById('pa-view-tabs');
  if (viewTabs) {
    viewTabs.addEventListener('click', function (e) {
      var tab = e.target.closest('.data-tab');
      if (!tab) return;
      viewTabs.querySelectorAll('.data-tab').forEach(function (t) { t.classList.remove('active'); });
      document.querySelectorAll('.pa-view-panel').forEach(function (p) { p.classList.remove('active'); });
      tab.classList.add('active');
      var panel = document.getElementById(tab.dataset.panel);
      if (panel) panel.classList.add('active');
    });
  }

  /* ───────── Init ───────── */

  var dateEl = document.getElementById('pa-date');
  if (dateEl) dateEl.value = new Date().toISOString().slice(0, 10);

  render();

  if (typeof dataLayer !== 'undefined') {
    dataLayer.push({ 'event': 'tool_used', 'tool_name': 'proposal-analytics' });
  }

  /* ───────── Public API ───────── */

  window.CortexProposalAnalytics = {
    addProposal: addProposal,
    updateStatus: updateStatus,
    deleteProposal: deleteProposal,
    getOverallStats: getOverallStats,
    getWinRateByProjectType: getWinRateByProjectType,
    getWinRateByBudgetRange: getWinRateByBudgetRange,
    getWinRateByIndustry: getWinRateByIndustry,
    getWinRateByProposalLength: getWinRateByProposalLength,
    getMonthlyTrend: getMonthlyTrend,
    detectPatterns: detectPatterns,
    importFromProposalOutcomes: importFromProposalOutcomes,
    addFromForm: addFromForm,
    handleStatusChange: handleStatusChange,
    deleteAndRender: deleteAndRender,
    clearAll: clearAll,
    render: render
  };
})();
