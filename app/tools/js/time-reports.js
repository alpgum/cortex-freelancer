/**
 * Cortex Freelancer — Time Reports v1.0
 *
 * Weekly/monthly time reports with charts, client-ready timesheet,
 * CSV export, PDF print, and summary statistics.
 *
 * Depends on: time-engine.js (CortexTimeEngine)
 */
;(function () {
  'use strict';

  var TE = CortexTimeEngine;

  /* ======== Helpers ======== */
  function $(id) { return document.getElementById(id); }
  function qs(sel) { return document.querySelector(sel); }
  function qsa(sel) { return document.querySelectorAll(sel); }

  function fmt(n, d) { return Number(n || 0).toFixed(d === undefined ? 1 : d); }
  function fmtMoney(n) { return '$' + Number(n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function fmtHours(h) { return fmt(h) + 'h'; }

  function todayStr() { return new Date().toISOString().split('T')[0]; }

  function dateLabel(ds) {
    var d = new Date(ds + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  function dayShort(ds) {
    var d = new Date(ds + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short' });
  }

  function toast(msg) {
    var t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(function () { t.classList.remove('show'); }, 2500);
  }

  /* ======== State ======== */
  var state = {
    period: 'week',
    project: '',
    client: '',
    from: '',
    to: ''
  };

  /* ======== Period date ranges ======== */
  function getPeriodRange() {
    var now = new Date();
    var from, to;

    if (state.period === 'week') {
      var d = new Date(now);
      d.setDate(d.getDate() - d.getDay());
      from = d.toISOString().split('T')[0];
      to = todayStr();
    } else if (state.period === 'lastweek') {
      var d = new Date(now);
      d.setDate(d.getDate() - d.getDay() - 7);
      from = d.toISOString().split('T')[0];
      d.setDate(d.getDate() + 6);
      to = d.toISOString().split('T')[0];
    } else if (state.period === 'month') {
      from = now.toISOString().split('T')[0].substring(0, 7) + '-01';
      to = todayStr();
    } else {
      from = state.from || todayStr();
      to = state.to || todayStr();
    }

    return { from: from, to: to };
  }

  function getFilteredEntries() {
    var range = getPeriodRange();
    var entries = TE.getEntries().filter(function (e) {
      if (e.date < range.from || e.date > range.to) return false;
      if (state.project && e.project !== state.project) return false;
      if (state.client && e.client !== state.client) return false;
      return true;
    });
    // Sort by date descending, then by start time descending
    entries.sort(function (a, b) {
      if (a.date !== b.date) return a.date > b.date ? -1 : 1;
      return (b.startTime || '').localeCompare(a.startTime || '');
    });
    return entries;
  }

  /* ======== Aggregate ======== */
  function aggregate(entries) {
    var rate = TE.getRate();
    var totalH = 0, billableH = 0, nonBillableH = 0;
    var byProject = {}, byClient = {}, byDate = {};
    var uniqueProjects = {}, uniqueClients = {};
    var uniqueDays = {};

    entries.forEach(function (e) {
      var h = e.hours || 0;
      totalH += h;
      if (e.billable === false) {
        nonBillableH += h;
      } else {
        billableH += h;
      }

      var proj = e.project || 'Untitled';
      var cli = e.client || 'No Client';
      byProject[proj] = (byProject[proj] || 0) + h;
      byClient[cli] = (byClient[cli] || 0) + h;
      byDate[e.date] = (byDate[e.date] || 0) + h;
      uniqueProjects[proj] = true;
      uniqueClients[cli] = true;
      uniqueDays[e.date] = true;
    });

    var dayCount = Object.keys(uniqueDays).length || 1;

    return {
      totalHours: totalH,
      billableHours: billableH,
      nonBillableHours: nonBillableH,
      totalBillable: billableH * rate,
      entryCount: entries.length,
      avgPerDay: totalH / dayCount,
      dayCount: dayCount,
      projectCount: Object.keys(uniqueProjects).length,
      clientCount: Object.keys(uniqueClients).length,
      byProject: byProject,
      byClient: byClient,
      byDate: byDate,
      rate: rate
    };
  }

  /* ======== Populate Filters ======== */
  function populateFilters() {
    var projects = TE.getProjects();
    var clients = TE.getClients();
    var pSel = $('filter-project');
    var cSel = $('filter-client');

    pSel.innerHTML = '<option value="">All Projects</option>';
    projects.forEach(function (p) {
      var opt = document.createElement('option');
      opt.value = p; opt.textContent = p;
      if (p === state.project) opt.selected = true;
      pSel.appendChild(opt);
    });

    cSel.innerHTML = '<option value="">All Clients</option>';
    clients.forEach(function (c) {
      var opt = document.createElement('option');
      opt.value = c; opt.textContent = c;
      if (c === state.client) opt.selected = true;
      cSel.appendChild(opt);
    });
  }

  /* ======== Render Stats ======== */
  function renderStats(agg) {
    $('st-hours').textContent = fmtHours(agg.totalHours);
    $('st-billable').textContent = fmtMoney(agg.totalBillable);
    $('st-entries').textContent = agg.entryCount;
    $('st-avg').textContent = fmtHours(agg.avgPerDay);
  }

  /* ======== Daily Activity Chart ======== */
  function renderDailyChart(agg) {
    var range = getPeriodRange();
    var from = new Date(range.from + 'T00:00:00');
    var to = new Date(range.to + 'T00:00:00');
    var days = [];
    var d = new Date(from);
    while (d <= to) {
      days.push(d.toISOString().split('T')[0]);
      d.setDate(d.getDate() + 1);
    }
    // Limit to 31 days max for readability
    if (days.length > 31) days = days.slice(days.length - 31);

    var maxH = 0;
    days.forEach(function (ds) {
      var h = agg.byDate[ds] || 0;
      if (h > maxH) maxH = h;
    });

    var today = todayStr();
    var container = $('daily-chart');
    container.innerHTML = '';

    days.forEach(function (ds) {
      var h = agg.byDate[ds] || 0;
      var pct = maxH > 0 ? (h / maxH * 100) : 0;
      var isToday = ds === today;

      var col = document.createElement('div');
      col.className = 'daily-col' + (isToday ? ' today' : '');

      var track = document.createElement('div');
      track.className = 'daily-track';

      var fill = document.createElement('div');
      fill.className = 'daily-fill billable';
      fill.style.height = pct + '%';
      track.appendChild(fill);

      var hrs = document.createElement('div');
      hrs.className = 'daily-hrs';
      hrs.textContent = h > 0 ? fmt(h) : '';

      var day = document.createElement('div');
      day.className = 'daily-day';
      day.textContent = dayShort(ds);

      col.appendChild(hrs);
      col.appendChild(track);
      col.appendChild(day);
      container.appendChild(col);
    });
  }

  /* ======== Bar Chart (Projects / Clients) ======== */
  function renderBarChart(containerId, data, cssClass) {
    var container = $(containerId);
    container.innerHTML = '';

    var items = Object.keys(data).map(function (k) {
      return { label: k, value: data[k] };
    }).sort(function (a, b) { return b.value - a.value; });

    if (items.length === 0) {
      container.innerHTML = '<div class="empty-msg">No data</div>';
      return;
    }

    var max = items[0].value || 1;
    var rate = TE.getRate();

    items.slice(0, 8).forEach(function (item) {
      var pct = (item.value / max * 100);
      var row = document.createElement('div');
      row.className = 'report-row';

      row.innerHTML =
        '<div class="report-label">' + escHtml(item.label) + '</div>' +
        '<div class="report-bar-wrap"><div class="report-bar ' + cssClass + '" style="width:' + pct + '%"></div></div>' +
        '<div class="report-value">' + fmtHours(item.value) + (rate ? ' / ' + fmtMoney(item.value * rate) : '') + '</div>' +
        '<div class="report-pct">' + Math.round(pct) + '%</div>';

      container.appendChild(row);
    });
  }

  function escHtml(s) {
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  /* ======== Billable Donut ======== */
  function renderDonut(agg) {
    var container = $('billable-chart');
    var b = agg.billableHours;
    var nb = agg.nonBillableHours;
    var total = b + nb;

    if (total === 0) {
      container.innerHTML = '<div class="empty-msg">No data</div>';
      return;
    }

    var bPct = b / total;
    var nbPct = nb / total;
    var r = 50, cx = 60, cy = 60;
    var circumference = 2 * Math.PI * r;

    // SVG donut with two arcs
    var bLen = circumference * bPct;
    var nbLen = circumference * nbPct;

    var svg = '<svg class="donut-svg" viewBox="0 0 120 120">' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="var(--bg4)" stroke-width="12"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="var(--green)" stroke-width="12" ' +
        'stroke-dasharray="' + bLen + ' ' + circumference + '" ' +
        'stroke-dashoffset="0" transform="rotate(-90 ' + cx + ' ' + cy + ')" stroke-linecap="round"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="var(--orange)" stroke-width="12" opacity="0.7" ' +
        'stroke-dasharray="' + nbLen + ' ' + circumference + '" ' +
        'stroke-dashoffset="-' + bLen + '" transform="rotate(-90 ' + cx + ' ' + cy + ')" stroke-linecap="round"/>' +
      '<text x="' + cx + '" y="' + (cy - 2) + '" text-anchor="middle" class="donut-center-text">' + fmtHours(total) + '</text>' +
      '<text x="' + cx + '" y="' + (cy + 10) + '" text-anchor="middle" class="donut-center-sub">TOTAL</text>' +
      '</svg>';

    var legend = '<div class="donut-legend">' +
      '<div class="donut-legend-item"><div class="donut-legend-dot" style="background:var(--green)"></div>Billable' +
        '<span class="donut-legend-val">' + fmtHours(b) + ' (' + Math.round(bPct * 100) + '%)</span></div>' +
      '<div class="donut-legend-item"><div class="donut-legend-dot" style="background:var(--orange)"></div>Non-billable' +
        '<span class="donut-legend-val">' + fmtHours(nb) + ' (' + Math.round(nbPct * 100) + '%)</span></div>' +
      (agg.rate ? '<div class="donut-legend-item" style="margin-top:.5rem;padding-top:.5rem;border-top:1px solid rgba(255,255,255,.06)">' +
        '<div class="donut-legend-dot" style="background:transparent"></div>Billable Amount' +
        '<span class="donut-legend-val" style="color:var(--green)">' + fmtMoney(agg.totalBillable) + '</span></div>' : '') +
      '</div>';

    container.innerHTML = svg + legend;
  }

  /* ======== Timesheet Table ======== */
  function renderTimesheet(entries, agg) {
    var tbody = $('ts-body');
    var tfoot = $('ts-foot');
    var empty = $('ts-empty');
    var rate = agg.rate;

    tbody.innerHTML = '';
    tfoot.innerHTML = '';

    if (entries.length === 0) {
      empty.style.display = '';
      return;
    }
    empty.style.display = 'none';

    // Group by date
    var grouped = {};
    entries.forEach(function (e) {
      if (!grouped[e.date]) grouped[e.date] = [];
      grouped[e.date].push(e);
    });

    var dates = Object.keys(grouped).sort().reverse();
    var totalH = 0, totalAmt = 0;

    dates.forEach(function (dt) {
      // Date group header
      var dayH = 0;
      grouped[dt].forEach(function (e) { dayH += (e.hours || 0); });
      var dayAmt = dayH * rate;
      totalH += dayH;
      totalAmt += dayAmt;

      var gr = document.createElement('tr');
      gr.className = 'date-group';
      gr.innerHTML = '<td colspan="4">' + dateLabel(dt) + '</td>' +
        '<td class="right" colspan="2">' + fmtHours(dayH) +
        (rate ? ' &mdash; ' + fmtMoney(dayAmt) : '') + '</td>';
      tbody.appendChild(gr);

      // Entries
      grouped[dt].forEach(function (e) {
        var h = e.hours || 0;
        var amt = h * rate;
        var isBillable = e.billable !== false;
        var tr = document.createElement('tr');
        tr.innerHTML =
          '<td>' + (e.startTime || '') + (e.endTime ? ' – ' + e.endTime : '') + '</td>' +
          '<td><span class="ts-project">' + escHtml(e.project || 'Untitled') + '</span>' +
            (e.client ? ' <span class="ts-client">' + escHtml(e.client) + '</span>' : '') +
            ' <span class="' + (isBillable ? 'ts-billable' : 'ts-nonbillable') + '">' + (isBillable ? 'billable' : 'non-billable') + '</span></td>' +
          '<td>' + escHtml(e.desc || '—') + '</td>' +
          '<td class="right">' + fmt(h, 2) + '</td>' +
          '<td class="right">' + (rate ? fmtMoney(rate) + '/hr' : '—') + '</td>' +
          '<td class="right">' + (rate ? fmtMoney(amt) : '—') + '</td>';
        tbody.appendChild(tr);
      });
    });

    // Footer totals
    tfoot.innerHTML =
      '<tr><td colspan="3">Total</td>' +
      '<td class="right">' + fmt(totalH, 2) + 'h</td>' +
      '<td></td>' +
      '<td class="right">' + (rate ? fmtMoney(totalAmt) : '—') + '</td></tr>';
  }

  /* ======== Detailed Summary ======== */
  function renderSummary(agg) {
    var grid = $('summary-grid');
    var rate = agg.rate;

    var cards = [
      { label: 'Total Hours', val: fmtHours(agg.totalHours), cls: '' },
      { label: 'Billable Hours', val: fmtHours(agg.billableHours), cls: 'green' },
      { label: 'Non-billable Hours', val: fmtHours(agg.nonBillableHours), cls: '' },
      { label: 'Total Billable', val: fmtMoney(agg.totalBillable), cls: 'green' },
      { label: 'Avg Hours / Day', val: fmtHours(agg.avgPerDay), cls: 'blue' },
      { label: 'Working Days', val: agg.dayCount, cls: 'blue' },
      { label: 'Projects', val: agg.projectCount, cls: '' },
      { label: 'Clients', val: agg.clientCount, cls: '' },
      { label: 'Time Entries', val: agg.entryCount, cls: '' },
      { label: 'Hourly Rate', val: rate ? fmtMoney(rate) + '/hr' : 'Not set', cls: '' },
      { label: 'Billable Ratio', val: agg.totalHours > 0 ? Math.round(agg.billableHours / agg.totalHours * 100) + '%' : '—', cls: 'green' },
      { label: 'Avg Hours / Entry', val: agg.entryCount > 0 ? fmtHours(agg.totalHours / agg.entryCount) : '—', cls: '' }
    ];

    grid.innerHTML = '';
    cards.forEach(function (c) {
      var card = document.createElement('div');
      card.className = 'summary-card';
      card.innerHTML =
        '<div class="summary-card-label">' + c.label + '</div>' +
        '<div class="summary-card-val' + (c.cls ? ' ' + c.cls : '') + '">' + c.val + '</div>';
      grid.appendChild(card);
    });
  }

  /* ======== Print Header ======== */
  function updatePrintHeader() {
    var range = getPeriodRange();
    var labels = { week: 'Weekly', lastweek: 'Last Week', month: 'Monthly', custom: 'Custom Period' };
    $('print-title').textContent = (labels[state.period] || 'Time') + ' Report';
    var sub = dateLabel(range.from) + ' — ' + dateLabel(range.to);
    if (state.project) sub += ' | Project: ' + state.project;
    if (state.client) sub += ' | Client: ' + state.client;
    $('print-subtitle').textContent = sub;
  }

  /* ======== Master Render ======== */
  function renderAll() {
    var entries = getFilteredEntries();
    var agg = aggregate(entries);

    renderStats(agg);
    renderDailyChart(agg);
    renderBarChart('project-chart', agg.byProject, 'project');
    renderBarChart('client-chart', agg.byClient, 'client');
    renderDonut(agg);
    renderTimesheet(entries, agg);
    renderSummary(agg);
    updatePrintHeader();
  }

  /* ======== CSV Export ======== */
  function generateCSV(entries) {
    var rate = TE.getRate();
    var lines = ['Date,Day,Project,Client,Description,Start,End,Hours,Billable,Rate,Amount'];
    entries.forEach(function (e) {
      var h = e.hours || 0;
      var isBillable = e.billable !== false;
      var amt = isBillable ? (h * rate) : 0;
      var d = new Date(e.date + 'T00:00:00');
      var dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
      lines.push(
        '"' + e.date + '",' +
        '"' + dayName + '",' +
        '"' + (e.project || '').replace(/"/g, '""') + '",' +
        '"' + (e.client || '').replace(/"/g, '""') + '",' +
        '"' + (e.desc || '').replace(/"/g, '""') + '",' +
        '"' + (e.startTime || '') + '",' +
        '"' + (e.endTime || '') + '",' +
        h.toFixed(2) + ',' +
        (isBillable ? 'Yes' : 'No') + ',' +
        rate.toFixed(2) + ',' +
        amt.toFixed(2)
      );
    });

    // Summary rows
    var totalH = 0, totalAmt = 0;
    entries.forEach(function (e) {
      var h = e.hours || 0;
      totalH += h;
      if (e.billable !== false) totalAmt += h * rate;
    });
    lines.push('');
    lines.push('"TOTAL","","","","","","","' + totalH.toFixed(2) + '","","","' + totalAmt.toFixed(2) + '"');

    return lines.join('\n');
  }

  function downloadCSV() {
    var entries = getFilteredEntries();
    if (entries.length === 0) { toast('No entries to export'); return; }
    var csv = generateCSV(entries);
    var range = getPeriodRange();
    var filename = 'timesheet_' + range.from + '_to_' + range.to + '.csv';
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
    toast('CSV downloaded: ' + filename);
  }

  function copyCSV() {
    var entries = getFilteredEntries();
    if (entries.length === 0) { toast('No entries to copy'); return; }
    var csv = generateCSV(entries);
    navigator.clipboard.writeText(csv).then(function () {
      toast('Copied to clipboard');
    }).catch(function () {
      // Fallback
      var ta = document.createElement('textarea');
      ta.value = csv;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      toast('Copied to clipboard');
    });
  }

  function printPDF() {
    window.print();
  }

  /* ======== Event Bindings ======== */
  // Period tabs
  qsa('.period-tab').forEach(function (btn) {
    btn.addEventListener('click', function () {
      qsa('.period-tab').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      state.period = btn.getAttribute('data-period');
      $('custom-range').classList.toggle('show', state.period === 'custom');
      if (state.period !== 'custom') renderAll();
    });
  });

  // Custom range
  $('apply-custom').addEventListener('click', function () {
    state.from = $('date-from').value;
    state.to = $('date-to').value;
    if (state.from && state.to) renderAll();
  });

  // Filters
  $('filter-project').addEventListener('change', function () {
    state.project = this.value;
    renderAll();
  });
  $('filter-client').addEventListener('change', function () {
    state.client = this.value;
    renderAll();
  });

  // Export
  $('export-csv').addEventListener('click', downloadCSV);
  $('export-pdf').addEventListener('click', printPDF);
  $('copy-csv').addEventListener('click', copyCSV);

  /* ======== Init ======== */
  // Set default date range for custom
  var range = getPeriodRange();
  $('date-from').value = range.from;
  $('date-to').value = range.to;

  populateFilters();
  renderAll();

  try { dataLayer.push({ 'event': 'tool_used', 'tool_name': 'time-reports' }); } catch (e) {}

})();
