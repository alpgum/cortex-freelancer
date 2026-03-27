/**
 * Cortex Freelancer — Analytics Dashboard
 * Tracks monthly revenue, utilization rate, proposal win rate,
 * client acquisition, and avg project value with MoM trend charts.
 * Exposed on window.CortexAnalytics
 */
(function () {
  'use strict';

  var KEYS = {
    revenue: 'cortex_analytics_revenue',
    hours: 'cortex_analytics_hours',
    proposals: 'cortex_analytics_proposals',
    clients: 'cortex_analytics_clients',
    projects: 'cortex_analytics_projects'
  };

  var charts = {};
  var currentMonths = 12;

  /* ───────── Storage helpers ───────── */

  function load(key) {
    try { return JSON.parse(localStorage.getItem(key) || '[]'); }
    catch (e) { return []; }
  }

  function save(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
  }

  /* ───────── Utilities ───────── */

  function fmt(n) {
    if (n == null || isNaN(n)) return '$0';
    if (n >= 1000000) return '$' + (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return '$' + (n / 1000).toFixed(1) + 'K';
    return '$' + Math.round(n).toLocaleString();
  }

  function pct(n) {
    if (n == null || isNaN(n)) return '0%';
    return Math.round(n) + '%';
  }

  function esc(s) {
    return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function currentMonth() {
    return new Date().toISOString().slice(0, 7);
  }

  function prevMonth(ym) {
    var parts = ym.split('-');
    var y = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10) - 1;
    if (m < 1) { m = 12; y--; }
    return y + '-' + (m < 10 ? '0' : '') + m;
  }

  function monthLabel(ym) {
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var parts = ym.split('-');
    return months[parseInt(parts[1], 10) - 1] + ' ' + parts[0].slice(2);
  }

  function getMonthRange(numMonths) {
    var now = new Date();
    var result = [];
    var count = numMonths || 120; // 0 = all → show up to 10 years
    for (var i = count - 1; i >= 0; i--) {
      var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      result.push(d.toISOString().slice(0, 7));
    }
    return result;
  }

  function aggregateByMonth(entries, field) {
    var map = {};
    entries.forEach(function (e) {
      if (!map[e.month]) map[e.month] = 0;
      map[e.month] += Number(e[field]) || 0;
    });
    return map;
  }

  function sumForMonth(entries, month, field) {
    var total = 0;
    entries.forEach(function (e) {
      if (e.month === month) total += Number(e[field]) || 0;
    });
    return total;
  }

  function showToast(msg) {
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(function () { t.classList.remove('show'); }, 2500);
  }

  function toggleEmpty(id, show) {
    var el = document.getElementById(id);
    if (el) el.style.display = show ? 'block' : 'none';
  }

  /* ───────── Delta calculation ───────── */

  function calcDelta(current, previous) {
    if (previous === 0 && current === 0) return { text: '— vs last month', cls: 'flat' };
    if (previous === 0) return { text: '+' + Math.round(current) + ' vs last month', cls: 'up' };
    var change = ((current - previous) / previous) * 100;
    var arrow = change > 0 ? '\u25B2' : change < 0 ? '\u25BC' : '';
    var sign = change > 0 ? '+' : '';
    var cls = change > 0 ? 'up' : change < 0 ? 'down' : 'flat';
    return { text: arrow + ' ' + sign + Math.round(change) + '% vs last month', cls: cls };
  }

  /* ───────── Chart defaults ───────── */

  var chartTheme = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { position: 'top', labels: { boxWidth: 14, padding: 16, font: { size: 11 } } },
      tooltip: {
        backgroundColor: 'rgba(17,17,24,.92)',
        titleFont: { weight: '600' },
        padding: 10,
        cornerRadius: 8
      }
    },
    scales: {
      y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.06)' } },
      x: { grid: { display: false } }
    },
    animation: { duration: 600, easing: 'easeOutQuart' }
  };

  function destroyChart(name) {
    if (charts[name]) { charts[name].destroy(); charts[name] = null; }
  }

  /* ───────── KPI update ───────── */

  function updateKPIs() {
    var cm = currentMonth();
    var pm = prevMonth(cm);

    // Revenue
    var revEntries = load(KEYS.revenue);
    var revCur = sumForMonth(revEntries, cm, 'amount');
    var revPrev = sumForMonth(revEntries, pm, 'amount');
    document.getElementById('kpi-revenue').textContent = fmt(revCur);
    var revDelta = calcDelta(revCur, revPrev);
    var revDeltaEl = document.getElementById('kpi-revenue-delta');
    revDeltaEl.textContent = revDelta.text;
    revDeltaEl.className = 'kpi-delta ' + revDelta.cls;
    document.getElementById('kpi-revenue-sub').textContent = fmt(revPrev) + ' last month';

    // Utilization
    var hrsEntries = load(KEYS.hours);
    var billCur = sumForMonth(hrsEntries, cm, 'billable');
    var availCur = sumForMonth(hrsEntries, cm, 'available');
    var utilCur = availCur > 0 ? (billCur / availCur) * 100 : 0;
    var billPrev = sumForMonth(hrsEntries, pm, 'billable');
    var availPrev = sumForMonth(hrsEntries, pm, 'available');
    var utilPrev = availPrev > 0 ? (billPrev / availPrev) * 100 : 0;
    document.getElementById('kpi-utilization').textContent = pct(utilCur);
    var utilDelta = calcDelta(utilCur, utilPrev);
    var utilDeltaEl = document.getElementById('kpi-utilization-delta');
    utilDeltaEl.textContent = utilDelta.text;
    utilDeltaEl.className = 'kpi-delta ' + utilDelta.cls;
    document.getElementById('kpi-utilization-sub').textContent = Math.round(billCur) + 'h / ' + Math.round(availCur) + 'h this month';

    // Avg Project Value
    var projEntries = load(KEYS.projects);
    var projValCur = sumForMonth(projEntries, cm, 'value');
    var projCntCur = sumForMonth(projEntries, cm, 'count');
    var avgCur = projCntCur > 0 ? projValCur / projCntCur : 0;
    var projValPrev = sumForMonth(projEntries, pm, 'value');
    var projCntPrev = sumForMonth(projEntries, pm, 'count');
    var avgPrev = projCntPrev > 0 ? projValPrev / projCntPrev : 0;
    document.getElementById('kpi-project-val').textContent = fmt(avgCur);
    var pvDelta = calcDelta(avgCur, avgPrev);
    var pvDeltaEl = document.getElementById('kpi-project-val-delta');
    pvDeltaEl.textContent = pvDelta.text;
    pvDeltaEl.className = 'kpi-delta ' + pvDelta.cls;
    document.getElementById('kpi-project-val-sub').textContent = projCntCur + ' project' + (projCntCur !== 1 ? 's' : '') + ' this month';

    // Client Acquisition
    var cliEntries = load(KEYS.clients);
    var cliCur = sumForMonth(cliEntries, cm, 'count');
    var cliPrev = sumForMonth(cliEntries, pm, 'count');
    document.getElementById('kpi-acquisition').textContent = Math.round(cliCur);
    var cliDelta = calcDelta(cliCur, cliPrev);
    var cliDeltaEl = document.getElementById('kpi-acquisition-delta');
    cliDeltaEl.textContent = cliDelta.text;
    cliDeltaEl.className = 'kpi-delta ' + cliDelta.cls;
    document.getElementById('kpi-acquisition-sub').textContent = Math.round(cliPrev) + ' last month';

    // Proposal Win Rate
    var propEntries = load(KEYS.proposals);
    var sentCur = sumForMonth(propEntries, cm, 'sent');
    var accCur = sumForMonth(propEntries, cm, 'accepted');
    var wrCur = sentCur > 0 ? (accCur / sentCur) * 100 : 0;
    var sentPrev = sumForMonth(propEntries, pm, 'sent');
    var accPrev = sumForMonth(propEntries, pm, 'accepted');
    var wrPrev = sentPrev > 0 ? (accPrev / sentPrev) * 100 : 0;
    document.getElementById('kpi-win-rate').textContent = pct(wrCur);
    var wrDelta = calcDelta(wrCur, wrPrev);
    var wrDeltaEl = document.getElementById('kpi-win-rate-delta');
    wrDeltaEl.textContent = wrDelta.text;
    wrDeltaEl.className = 'kpi-delta ' + wrDelta.cls;
    document.getElementById('kpi-win-rate-sub').textContent = accCur + ' / ' + sentCur + ' proposals this month';
  }

  /* ───────── Chart rendering ───────── */

  function renderCharts() {
    var range = getMonthRange(currentMonths);
    var labels = range.map(monthLabel);

    var revEntries = load(KEYS.revenue);
    var hrsEntries = load(KEYS.hours);
    var propEntries = load(KEYS.proposals);
    var cliEntries = load(KEYS.clients);
    var projEntries = load(KEYS.projects);

    var revMap = aggregateByMonth(revEntries, 'amount');
    var hasRevenue = Object.keys(revMap).length > 0;

    // Revenue trend (bar + running avg line)
    destroyChart('revenue');
    toggleEmpty('empty-revenue', !hasRevenue);
    if (hasRevenue) {
      var revValues = range.map(function (m) { return revMap[m] || 0; });
      var runAvg = [];
      var cumSum = 0;
      var counted = 0;
      for (var i = 0; i < revValues.length; i++) {
        cumSum += revValues[i];
        if (revValues[i] > 0) counted++;
        runAvg.push(counted > 0 ? Math.round(cumSum / counted) : 0);
      }
      charts.revenue = new Chart(document.getElementById('chart-revenue'), {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [
            { type: 'bar', label: 'Revenue', data: revValues, backgroundColor: 'rgba(255,136,68,0.35)', borderColor: '#ff8844', borderWidth: 1, borderRadius: 4, order: 2 },
            { type: 'line', label: 'Running Avg', data: runAvg, borderColor: '#00ff88', backgroundColor: 'rgba(0,255,136,0.08)', fill: true, tension: 0.35, pointRadius: 3, borderWidth: 2, borderDash: [6, 3], order: 1 }
          ]
        },
        options: Object.assign({}, chartTheme, {
          plugins: Object.assign({}, chartTheme.plugins, {
            tooltip: Object.assign({}, chartTheme.plugins.tooltip, {
              callbacks: { label: function (ctx) { return ctx.dataset.label + ': $' + Number(ctx.raw).toLocaleString(); } }
            })
          }),
          scales: Object.assign({}, chartTheme.scales, {
            y: Object.assign({}, chartTheme.scales.y, { ticks: { callback: function (v) { return '$' + v.toLocaleString(); } } })
          })
        })
      });
    }

    // Utilization rate (line chart)
    var utilValues = range.map(function (m) {
      var b = 0, a = 0;
      hrsEntries.forEach(function (e) { if (e.month === m) { b += e.billable; a += e.available; } });
      return a > 0 ? Math.round((b / a) * 100) : null;
    });
    var hasUtil = utilValues.some(function (v) { return v !== null; });
    destroyChart('utilization');
    toggleEmpty('empty-utilization', !hasUtil);
    if (hasUtil) {
      charts.utilization = new Chart(document.getElementById('chart-utilization'), {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            label: 'Utilization %', data: utilValues, borderColor: '#00ff88', backgroundColor: 'rgba(0,255,136,0.08)',
            fill: true, tension: 0.35, pointBackgroundColor: '#00ff88', pointRadius: 4, borderWidth: 2, spanGaps: true
          }]
        },
        options: Object.assign({}, chartTheme, {
          scales: Object.assign({}, chartTheme.scales, {
            y: Object.assign({}, chartTheme.scales.y, { max: 100, ticks: { callback: function (v) { return v + '%'; } } })
          })
        })
      });
    }

    // Win rate (line chart)
    var wrValues = range.map(function (m) {
      var s = 0, a = 0;
      propEntries.forEach(function (e) { if (e.month === m) { s += e.sent; a += e.accepted; } });
      return s > 0 ? Math.round((a / s) * 100) : null;
    });
    var hasWR = wrValues.some(function (v) { return v !== null; });
    destroyChart('winrate');
    toggleEmpty('empty-winrate', !hasWR);
    if (hasWR) {
      charts.winrate = new Chart(document.getElementById('chart-winrate'), {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            label: 'Win Rate %', data: wrValues, borderColor: '#cc66ff', backgroundColor: 'rgba(204,102,255,0.08)',
            fill: true, tension: 0.35, pointBackgroundColor: '#cc66ff', pointRadius: 4, borderWidth: 2, spanGaps: true
          }]
        },
        options: Object.assign({}, chartTheme, {
          scales: Object.assign({}, chartTheme.scales, {
            y: Object.assign({}, chartTheme.scales.y, { max: 100, ticks: { callback: function (v) { return v + '%'; } } })
          })
        })
      });
    }

    // Client acquisition (bar chart)
    var cliMap = aggregateByMonth(cliEntries, 'count');
    var hasCli = Object.keys(cliMap).length > 0;
    var cliValues = range.map(function (m) { return cliMap[m] || 0; });
    destroyChart('acquisition');
    toggleEmpty('empty-acquisition', !hasCli);
    if (hasCli) {
      charts.acquisition = new Chart(document.getElementById('chart-acquisition'), {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [{
            label: 'New Clients', data: cliValues, backgroundColor: 'rgba(255,200,0,0.35)', borderColor: '#ffc800',
            borderWidth: 1, borderRadius: 4
          }]
        },
        options: Object.assign({}, chartTheme, {
          scales: Object.assign({}, chartTheme.scales, {
            y: Object.assign({}, chartTheme.scales.y, { ticks: { stepSize: 1 } })
          })
        })
      });
    }

    // Avg project value (bar chart)
    var projAvgValues = range.map(function (m) {
      var v = 0, c = 0;
      projEntries.forEach(function (e) { if (e.month === m) { v += e.value; c += e.count; } });
      return c > 0 ? Math.round(v / c) : 0;
    });
    var hasProj = projAvgValues.some(function (v) { return v > 0; });
    destroyChart('projectVal');
    toggleEmpty('empty-project-val', !hasProj);
    if (hasProj) {
      charts.projectVal = new Chart(document.getElementById('chart-project-val'), {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [{
            label: 'Avg Value', data: projAvgValues, backgroundColor: 'rgba(68,170,255,0.35)', borderColor: '#44aaff',
            borderWidth: 1, borderRadius: 4
          }]
        },
        options: Object.assign({}, chartTheme, {
          plugins: Object.assign({}, chartTheme.plugins, {
            tooltip: Object.assign({}, chartTheme.plugins.tooltip, {
              callbacks: { label: function (ctx) { return 'Avg: $' + Number(ctx.raw).toLocaleString(); } }
            })
          }),
          scales: Object.assign({}, chartTheme.scales, {
            y: Object.assign({}, chartTheme.scales.y, { ticks: { callback: function (v) { return '$' + v.toLocaleString(); } } })
          })
        })
      });
    }
  }

  /* ───────── Data log ───────── */

  function renderLog() {
    var all = [];
    load(KEYS.revenue).forEach(function (e) { all.push({ type: 'Revenue', month: e.month, detail: fmt(e.amount) + (e.client ? ' — ' + esc(e.client) : ''), id: e.id, key: KEYS.revenue }); });
    load(KEYS.hours).forEach(function (e) { all.push({ type: 'Hours', month: e.month, detail: e.billable + 'h / ' + e.available + 'h', id: e.id, key: KEYS.hours }); });
    load(KEYS.proposals).forEach(function (e) { all.push({ type: 'Proposals', month: e.month, detail: e.accepted + ' / ' + e.sent + ' accepted', id: e.id, key: KEYS.proposals }); });
    load(KEYS.clients).forEach(function (e) { all.push({ type: 'Clients', month: e.month, detail: e.count + ' new', id: e.id, key: KEYS.clients }); });
    load(KEYS.projects).forEach(function (e) { all.push({ type: 'Projects', month: e.month, detail: e.count + ' completed — ' + fmt(e.value), id: e.id, key: KEYS.projects }); });

    all.sort(function (a, b) { return b.month.localeCompare(a.month); });

    var container = document.getElementById('data-log');
    if (!all.length) {
      container.innerHTML = '<div class="empty-msg">No data yet. Start adding entries above.</div>';
      return;
    }

    var html = '<table class="log-table"><thead><tr><th>Type</th><th>Month</th><th>Detail</th><th></th></tr></thead><tbody>';
    all.forEach(function (row) {
      html += '<tr><td>' + row.type + '</td><td>' + row.month + '</td><td>' + row.detail + '</td>' +
        '<td><button class="delete-btn" onclick="CortexAnalytics.deleteEntry(\'' + row.key + '\',\'' + row.id + '\')" title="Delete">&times;</button></td></tr>';
    });
    html += '</tbody></table>';
    container.innerHTML = html;
  }

  /* ───────── Period label ───────── */

  function updatePeriodLabel() {
    var range = getMonthRange(currentMonths);
    var el = document.getElementById('period-label');
    el.textContent = monthLabel(range[0]) + ' \u2013 ' + monthLabel(range[range.length - 1]);
  }

  /* ───────── Full render ───────── */

  function render() {
    updateKPIs();
    renderCharts();
    renderLog();
    updatePeriodLabel();
  }

  /* ───────── Data entry handlers ───────── */

  function addRevenue() {
    var month = document.getElementById('rev-month').value;
    var amount = parseFloat(document.getElementById('rev-amount').value);
    var client = document.getElementById('rev-client').value.trim();
    if (!month || !amount || amount <= 0) { showToast('Enter month and amount'); return; }
    var entries = load(KEYS.revenue);
    entries.push({ id: Date.now().toString(36), month: month, amount: amount, client: client });
    save(KEYS.revenue, entries);
    document.getElementById('rev-amount').value = '';
    document.getElementById('rev-client').value = '';
    render();
    showToast('Revenue added: $' + amount.toLocaleString());
  }

  function addHours() {
    var month = document.getElementById('hrs-month').value;
    var billable = parseFloat(document.getElementById('hrs-billable').value);
    var available = parseFloat(document.getElementById('hrs-available').value);
    if (!month || isNaN(billable) || isNaN(available) || available <= 0) { showToast('Enter month, billable and available hours'); return; }
    var entries = load(KEYS.hours);
    entries.push({ id: Date.now().toString(36), month: month, billable: billable, available: available });
    save(KEYS.hours, entries);
    document.getElementById('hrs-billable').value = '';
    document.getElementById('hrs-available').value = '';
    render();
    showToast('Hours logged: ' + billable + 'h / ' + available + 'h');
  }

  function addProposals() {
    var month = document.getElementById('prop-month').value;
    var sent = parseInt(document.getElementById('prop-sent').value, 10);
    var accepted = parseInt(document.getElementById('prop-accepted').value, 10);
    if (!month || isNaN(sent) || sent <= 0) { showToast('Enter month and proposals sent'); return; }
    if (isNaN(accepted)) accepted = 0;
    var entries = load(KEYS.proposals);
    entries.push({ id: Date.now().toString(36), month: month, sent: sent, accepted: accepted });
    save(KEYS.proposals, entries);
    document.getElementById('prop-sent').value = '';
    document.getElementById('prop-accepted').value = '';
    render();
    showToast('Proposals added: ' + accepted + '/' + sent + ' accepted');
  }

  function addClients() {
    var month = document.getElementById('client-month').value;
    var count = parseInt(document.getElementById('client-count').value, 10);
    if (!month || isNaN(count) || count <= 0) { showToast('Enter month and client count'); return; }
    var entries = load(KEYS.clients);
    entries.push({ id: Date.now().toString(36), month: month, count: count });
    save(KEYS.clients, entries);
    document.getElementById('client-count').value = '';
    render();
    showToast(count + ' new client' + (count !== 1 ? 's' : '') + ' added');
  }

  function addProjects() {
    var month = document.getElementById('proj-month').value;
    var count = parseInt(document.getElementById('proj-count').value, 10);
    var value = parseFloat(document.getElementById('proj-value').value);
    if (!month || isNaN(count) || count <= 0 || isNaN(value) || value <= 0) { showToast('Enter month, project count, and total value'); return; }
    var entries = load(KEYS.projects);
    entries.push({ id: Date.now().toString(36), month: month, count: count, value: value });
    save(KEYS.projects, entries);
    document.getElementById('proj-count').value = '';
    document.getElementById('proj-value').value = '';
    render();
    showToast(count + ' project' + (count !== 1 ? 's' : '') + ' added ($' + value.toLocaleString() + ')');
  }

  function deleteEntry(key, id) {
    var entries = load(key).filter(function (e) { return e.id !== id; });
    save(key, entries);
    render();
    showToast('Entry deleted');
  }

  function clearAll() {
    if (!confirm('Delete all analytics data? This cannot be undone.')) return;
    Object.keys(KEYS).forEach(function (k) { localStorage.removeItem(KEYS[k]); });
    render();
    showToast('All data cleared');
  }

  /* ───────── Period tabs ───────── */

  document.getElementById('period-tabs').addEventListener('click', function (e) {
    var btn = e.target.closest('.period-btn');
    if (!btn) return;
    document.querySelectorAll('.period-btn').forEach(function (b) { b.classList.remove('active'); });
    btn.classList.add('active');
    currentMonths = parseInt(btn.dataset.months, 10) || 120;
    renderCharts();
    updatePeriodLabel();
  });

  /* ───────── Data entry tabs ───────── */

  document.querySelector('.data-tabs').addEventListener('click', function (e) {
    var tab = e.target.closest('.data-tab');
    if (!tab) return;
    document.querySelectorAll('.data-tab').forEach(function (t) { t.classList.remove('active'); });
    document.querySelectorAll('.data-panel').forEach(function (p) { p.classList.remove('active'); });
    tab.classList.add('active');
    var panel = document.getElementById(tab.dataset.panel);
    if (panel) panel.classList.add('active');
  });

  /* ───────── Init ───────── */

  // Set default month inputs to current month
  var cm = currentMonth();
  ['rev-month', 'hrs-month', 'prop-month', 'client-month', 'proj-month'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.value = cm;
  });

  render();
  if (typeof dataLayer !== 'undefined') dataLayer.push({ 'event': 'tool_used', 'tool_name': 'analytics-dashboard' });

  /* ───────── Public API ───────── */

  window.CortexAnalytics = {
    addRevenue: addRevenue,
    addHours: addHours,
    addProposals: addProposals,
    addClients: addClients,
    addProjects: addProjects,
    deleteEntry: deleteEntry,
    clearAll: clearAll,
    render: render
  };
})();
