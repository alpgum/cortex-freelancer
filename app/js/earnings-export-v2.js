/**
 * [CF-060] Earnings Export to CSV/PDF (v2)
 * Export buttons for earnings dashboard — CSV downloads and
 * formatted PDF-style printable reports.
 * Exposed on window.CortexFreelancer.earningsExportV2
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  var STORAGE_KEY = 'cortex_earnings';
  var FALLBACK_KEY = 'cortex_earnings_entries';
  var EXPORT_HISTORY_KEY = 'cortex_export_history';
  var MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  var MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  /* ── State ── */

  var state = {
    earnings: [],
    filtered: [],
    dateFrom: '',
    dateTo: '',
    includeCategories: true,
    groupByMonth: false,
    exportHistory: []
  };

  /* ── Mock Data ── */

  function generateMockData() {
    var clients = [
      'Meridian Labs', 'Apex Digital', 'Starline Media', 'Northpoint SaaS',
      'Clearwave Studios', 'Redwood Analytics', 'Blueshift AI', 'Cobalt UX'
    ];
    var projects = [
      'Website Redesign', 'Mobile App v3', 'Dashboard MVP', 'API Integration',
      'Brand Identity', 'SEO Audit', 'E-commerce Platform', 'Data Pipeline',
      'Landing Page', 'Admin Portal', 'Analytics Module', 'Payment Gateway',
      'User Onboarding', 'Notification System', 'Reporting Engine', 'CRM Plugin'
    ];
    var categories = ['Development', 'Design', 'Consulting', 'Maintenance', 'Strategy', 'Content'];
    var statuses = ['paid', 'pending', 'invoiced', 'overdue'];

    var entries = [];
    var now = new Date();
    for (var m = 0; m < 14; m++) {
      var monthDate = new Date(now.getFullYear(), now.getMonth() - m, 1);
      var numEntries = 3 + Math.floor(Math.random() * 4);
      for (var e = 0; e < numEntries; e++) {
        var day = 1 + Math.floor(Math.random() * 27);
        var d = new Date(monthDate.getFullYear(), monthDate.getMonth(), day);
        var clientIdx = Math.floor(Math.random() * clients.length);
        var projIdx = Math.floor(Math.random() * projects.length);
        var catIdx = Math.floor(Math.random() * categories.length);
        var statusIdx = m < 2 ? Math.floor(Math.random() * statuses.length) : 0;
        var amount = 500 + Math.floor(Math.random() * 4500);
        amount = Math.round(amount / 50) * 50;

        entries.push({
          date: d.toISOString().split('T')[0],
          client: clients[clientIdx],
          project: projects[projIdx],
          category: categories[catIdx],
          amount: amount,
          status: statuses[statusIdx]
        });
      }
    }

    entries.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
    return entries;
  }

  /* ── Storage ── */

  function loadEarnings() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      var entries = raw ? JSON.parse(raw) : [];
      if (entries.length === 0) {
        raw = localStorage.getItem(FALLBACK_KEY);
        entries = raw ? JSON.parse(raw) : [];
      }
      return entries;
    } catch (e) {
      return [];
    }
  }

  function loadExportHistory() {
    try {
      var raw = localStorage.getItem(EXPORT_HISTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveExportHistory(history) {
    try {
      localStorage.setItem(EXPORT_HISTORY_KEY, JSON.stringify(history.slice(0, 20)));
    } catch (e) { /* quota */ }
  }

  function recordExport(format, recordCount, totalAmount) {
    var entry = {
      id: 'exp_' + Date.now(),
      format: format,
      recordCount: recordCount,
      totalAmount: totalAmount,
      dateFrom: state.dateFrom || 'all',
      dateTo: state.dateTo || 'all',
      exportedAt: new Date().toISOString()
    };
    state.exportHistory.unshift(entry);
    saveExportHistory(state.exportHistory);
  }

  /* ── Data Helpers ── */

  function getEarningsData() {
    var earnings = loadEarnings();
    if (!earnings || earnings.length === 0) {
      earnings = generateMockData();
    }
    return earnings;
  }

  function filterByDateRange(entries, from, to) {
    if (!from && !to) return entries.slice();
    var result = [];
    for (var i = 0; i < entries.length; i++) {
      var d = entries[i].date || '';
      if (from && d < from) continue;
      if (to && d > to) continue;
      result.push(entries[i]);
    }
    return result;
  }

  function formatForExport(entries, options) {
    var opts = options || {};
    var rows = [];
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      var row = {
        Date: e.date || '',
        Client: e.client || '',
        Project: e.project || '',
        Category: opts.includeCategories !== false ? (e.category || '') : undefined,
        Amount: typeof e.amount === 'number' ? e.amount.toFixed(2) : (e.amount || '0.00'),
        Status: e.status || ''
      };
      if (row.Category === undefined) delete row.Category;
      rows.push(row);
    }

    if (opts.groupByMonth) {
      rows.sort(function (a, b) { return a.Date < b.Date ? -1 : a.Date > b.Date ? 1 : 0; });
    }

    return rows;
  }

  /* ── Formatting Utilities ── */

  function fmtCurrency(n) {
    if (n == null || isNaN(n)) return '$0.00';
    return '$' + Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function fmtDate(isoStr) {
    if (!isoStr) return '—';
    var parts = isoStr.split('T')[0].split('-');
    if (parts.length < 3) return isoStr;
    return MONTH_SHORT[parseInt(parts[1], 10) - 1] + ' ' + parseInt(parts[2], 10) + ', ' + parts[0];
  }

  function escapeCSV(value) {
    var str = value == null ? '' : String(value);
    if (str.indexOf(',') !== -1 || str.indexOf('"') !== -1 || str.indexOf('\n') !== -1) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str || ''));
    return div.innerHTML;
  }

  /* ── Download Helper ── */

  function downloadBlob(content, filename, mimeType) {
    var blob = new Blob([content], { type: mimeType });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 150);
  }

  /* ── CSV Export ── */

  function exportCSV() {
    var entries = filterByDateRange(state.earnings, state.dateFrom, state.dateTo);
    var rows = formatForExport(entries, {
      includeCategories: state.includeCategories,
      groupByMonth: state.groupByMonth
    });

    if (rows.length === 0) {
      alert('No earnings records to export for the selected date range.');
      return;
    }

    var headers = Object.keys(rows[0]);
    var lines = [headers.map(escapeCSV).join(',')];

    for (var i = 0; i < rows.length; i++) {
      var vals = [];
      for (var h = 0; h < headers.length; h++) {
        vals.push(escapeCSV(rows[i][headers[h]]));
      }
      lines.push(vals.join(','));
    }

    var csv = lines.join('\r\n');
    var dateSuffix = new Date().toISOString().split('T')[0];
    var filename = 'earnings-export-' + dateSuffix + '.csv';
    downloadBlob(csv, filename, 'text/csv;charset=utf-8;');

    var total = 0;
    for (var t = 0; t < entries.length; t++) {
      total += parseFloat(entries[t].amount) || 0;
    }
    recordExport('CSV', rows.length, total);
    reRender();
  }

  /* ── PDF Export (Print-Friendly HTML) ── */

  function exportPDF() {
    var entries = filterByDateRange(state.earnings, state.dateFrom, state.dateTo);
    var rows = formatForExport(entries, {
      includeCategories: state.includeCategories,
      groupByMonth: state.groupByMonth
    });

    if (rows.length === 0) {
      alert('No earnings records to export for the selected date range.');
      return;
    }

    /* Summary stats */
    var totalAmount = 0;
    var categoryTotals = {};
    var monthlyTotals = {};
    for (var i = 0; i < entries.length; i++) {
      var amt = parseFloat(entries[i].amount) || 0;
      totalAmount += amt;

      var cat = entries[i].category || 'Uncategorized';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + amt;

      var monthKey = (entries[i].date || '').substring(0, 7);
      if (monthKey) {
        monthlyTotals[monthKey] = (monthlyTotals[monthKey] || 0) + amt;
      }
    }

    var avgPerRecord = entries.length > 0 ? totalAmount / entries.length : 0;
    var monthKeys = Object.keys(monthlyTotals).sort();
    var dateRange = entries.length > 0
      ? (entries[entries.length - 1].date || 'N/A') + ' to ' + (entries[0].date || 'N/A')
      : 'N/A';

    /* Build HTML */
    var html = [];
    html.push('<!DOCTYPE html><html><head><meta charset="utf-8">');
    html.push('<title>Earnings Report</title>');
    html.push('<style>');
    html.push('* { box-sizing: border-box; margin: 0; padding: 0; }');
    html.push('body { font-family: "Segoe UI", Arial, Helvetica, sans-serif; color: #1a1a2e; padding: 40px; line-height: 1.5; }');
    html.push('.header { border-bottom: 3px solid #4361ee; padding-bottom: 16px; margin-bottom: 24px; }');
    html.push('.header h1 { font-size: 24px; color: #4361ee; margin-bottom: 4px; }');
    html.push('.header .subtitle { font-size: 13px; color: #64748b; }');
    html.push('.summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 32px; }');
    html.push('.summary-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; text-align: center; }');
    html.push('.summary-card .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; }');
    html.push('.summary-card .value { font-size: 22px; font-weight: 700; color: #1a1a2e; margin-top: 4px; }');
    html.push('h2 { font-size: 16px; color: #334155; margin: 24px 0 12px; padding-bottom: 6px; border-bottom: 1px solid #e2e8f0; }');
    html.push('table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px; }');
    html.push('th { background: #4361ee; color: #fff; padding: 10px 12px; text-align: left; font-weight: 600; }');
    html.push('td { padding: 8px 12px; border-bottom: 1px solid #e2e8f0; }');
    html.push('tr:nth-child(even) td { background: #f8fafc; }');
    html.push('.amount { text-align: right; font-variant-numeric: tabular-nums; }');
    html.push('.status-paid { color: #059669; font-weight: 600; }');
    html.push('.status-pending { color: #d97706; }');
    html.push('.status-invoiced { color: #4361ee; }');
    html.push('.status-overdue { color: #dc2626; font-weight: 600; }');
    html.push('.footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center; }');
    html.push('@media print {');
    html.push('  body { padding: 20px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }');
    html.push('  .summary-grid { grid-template-columns: repeat(4, 1fr); }');
    html.push('  table { page-break-inside: auto; }');
    html.push('  tr { page-break-inside: avoid; }');
    html.push('  .no-print { display: none; }');
    html.push('}');
    html.push('</style></head><body>');

    /* Header */
    html.push('<div class="header">');
    html.push('<h1>Earnings Report</h1>');
    html.push('<div class="subtitle">Period: ' + escapeHtml(dateRange) + ' &nbsp;|&nbsp; Generated: ' + new Date().toLocaleDateString() + '</div>');
    html.push('</div>');

    /* Summary cards */
    html.push('<div class="summary-grid">');
    html.push('<div class="summary-card"><div class="label">Total Earnings</div><div class="value">' + fmtCurrency(totalAmount) + '</div></div>');
    html.push('<div class="summary-card"><div class="label">Records</div><div class="value">' + entries.length + '</div></div>');
    html.push('<div class="summary-card"><div class="label">Avg per Record</div><div class="value">' + fmtCurrency(avgPerRecord) + '</div></div>');
    html.push('<div class="summary-card"><div class="label">Months Covered</div><div class="value">' + monthKeys.length + '</div></div>');
    html.push('</div>');

    /* Monthly breakdown */
    html.push('<h2>Monthly Breakdown</h2>');
    html.push('<table><thead><tr><th>Month</th><th class="amount">Amount</th><th class="amount">Records</th></tr></thead><tbody>');
    for (var mi = monthKeys.length - 1; mi >= 0; mi--) {
      var mk = monthKeys[mi];
      var parts = mk.split('-');
      var monthLabel = MONTH_NAMES[parseInt(parts[1], 10) - 1] + ' ' + parts[0];
      var monthCount = 0;
      for (var mc = 0; mc < entries.length; mc++) {
        if ((entries[mc].date || '').indexOf(mk) === 0) monthCount++;
      }
      html.push('<tr><td>' + escapeHtml(monthLabel) + '</td><td class="amount">' + fmtCurrency(monthlyTotals[mk]) + '</td><td class="amount">' + monthCount + '</td></tr>');
    }
    html.push('</tbody></table>');

    /* Category breakdown */
    if (state.includeCategories) {
      var catKeys = Object.keys(categoryTotals).sort(function (a, b) { return categoryTotals[b] - categoryTotals[a]; });
      html.push('<h2>Category Breakdown</h2>');
      html.push('<table><thead><tr><th>Category</th><th class="amount">Amount</th><th class="amount">% of Total</th></tr></thead><tbody>');
      for (var ci = 0; ci < catKeys.length; ci++) {
        var pct = totalAmount > 0 ? ((categoryTotals[catKeys[ci]] / totalAmount) * 100).toFixed(1) : '0.0';
        html.push('<tr><td>' + escapeHtml(catKeys[ci]) + '</td><td class="amount">' + fmtCurrency(categoryTotals[catKeys[ci]]) + '</td><td class="amount">' + pct + '%</td></tr>');
      }
      html.push('</tbody></table>');
    }

    /* Detail table */
    html.push('<h2>All Records</h2>');
    var headers = Object.keys(rows[0]);
    html.push('<table><thead><tr>');
    for (var hi = 0; hi < headers.length; hi++) {
      var cls = headers[hi] === 'Amount' ? ' class="amount"' : '';
      html.push('<th' + cls + '>' + escapeHtml(headers[hi]) + '</th>');
    }
    html.push('</tr></thead><tbody>');
    for (var ri = 0; ri < rows.length; ri++) {
      html.push('<tr>');
      for (var rh = 0; rh < headers.length; rh++) {
        var val = rows[ri][headers[rh]] || '';
        var tdCls = '';
        if (headers[rh] === 'Amount') {
          tdCls = ' class="amount"';
          val = fmtCurrency(parseFloat(val) || 0);
        } else if (headers[rh] === 'Status') {
          tdCls = ' class="status-' + String(val).toLowerCase() + '"';
        }
        html.push('<td' + tdCls + '>' + escapeHtml(String(val)) + '</td>');
      }
      html.push('</tr>');
    }
    html.push('</tbody></table>');

    /* Footer */
    html.push('<div class="footer">Cortex Freelancer &mdash; Earnings Report &mdash; ' + new Date().toISOString() + '</div>');

    /* Print button (hidden on print) */
    html.push('<div class="no-print" style="text-align:center;margin-top:24px;">');
    html.push('<button onclick="window.print()" style="padding:10px 28px;background:#4361ee;color:#fff;border:none;border-radius:6px;font-size:14px;cursor:pointer;">Print / Save as PDF</button>');
    html.push('</div>');

    html.push('</body></html>');

    var win = window.open('', '_blank');
    if (win) {
      win.document.write(html.join('\n'));
      win.document.close();
    } else {
      alert('Pop-up blocked. Please allow pop-ups for this site and try again.');
    }

    recordExport('PDF', rows.length, totalAmount);
    reRender();
  }

  /* ── Re-render Helper ── */

  function reRender() {
    var container = document.getElementById('cortex-earnings-export-v2');
    if (container) {
      container.innerHTML = render();
      bindEvents();
    }
  }

  /* ── Event Binding ── */

  function bindEvents() {
    var csvBtn = document.getElementById('cex2-btn-csv');
    var pdfBtn = document.getElementById('cex2-btn-pdf');
    var dateFromInput = document.getElementById('cex2-date-from');
    var dateToInput = document.getElementById('cex2-date-to');
    var catCheckbox = document.getElementById('cex2-opt-categories');
    var groupCheckbox = document.getElementById('cex2-opt-group');

    if (csvBtn) {
      csvBtn.onclick = function () { exportCSV(); };
    }
    if (pdfBtn) {
      pdfBtn.onclick = function () { exportPDF(); };
    }
    if (dateFromInput) {
      dateFromInput.value = state.dateFrom;
      dateFromInput.onchange = function () {
        state.dateFrom = this.value;
        updatePreview();
      };
    }
    if (dateToInput) {
      dateToInput.value = state.dateTo;
      dateToInput.onchange = function () {
        state.dateTo = this.value;
        updatePreview();
      };
    }
    if (catCheckbox) {
      catCheckbox.checked = state.includeCategories;
      catCheckbox.onchange = function () {
        state.includeCategories = this.checked;
      };
    }
    if (groupCheckbox) {
      groupCheckbox.checked = state.groupByMonth;
      groupCheckbox.onchange = function () {
        state.groupByMonth = this.checked;
      };
    }
  }

  function updatePreview() {
    var filtered = filterByDateRange(state.earnings, state.dateFrom, state.dateTo);
    var total = 0;
    for (var i = 0; i < filtered.length; i++) {
      total += parseFloat(filtered[i].amount) || 0;
    }
    var countEl = document.getElementById('cex2-preview-count');
    var rangeEl = document.getElementById('cex2-preview-range');
    var totalEl = document.getElementById('cex2-preview-total');
    if (countEl) countEl.textContent = filtered.length + ' records';
    if (rangeEl) {
      var rangeText = (state.dateFrom || 'earliest') + ' to ' + (state.dateTo || 'latest');
      rangeEl.textContent = rangeText;
    }
    if (totalEl) totalEl.textContent = fmtCurrency(total);
  }

  /* ── Render ── */

  function render() {
    var earnings = state.earnings;
    var filtered = filterByDateRange(earnings, state.dateFrom, state.dateTo);
    var total = 0;
    for (var i = 0; i < filtered.length; i++) {
      total += parseFloat(filtered[i].amount) || 0;
    }
    var rangeText = (state.dateFrom || 'earliest') + ' to ' + (state.dateTo || 'latest');
    var history = state.exportHistory;

    var h = '';

    /* Container */
    h += '<div style="font-family:\'Segoe UI\',system-ui,-apple-system,sans-serif;color:#1a1a2e;max-width:860px;margin:0 auto;">';

    /* Header */
    h += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;">';
    h += '<div>';
    h += '<h2 style="margin:0;font-size:22px;font-weight:700;color:#1a1a2e;">Earnings Export</h2>';
    h += '<p style="margin:4px 0 0;font-size:13px;color:#64748b;">Export your earnings data to CSV or PDF format</p>';
    h += '</div>';
    h += '<div style="background:#4361ee;color:#fff;padding:6px 14px;border-radius:20px;font-size:12px;font-weight:600;">' + earnings.length + ' total records</div>';
    h += '</div>';

    /* Date Range Filters */
    h += '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-bottom:20px;box-shadow:0 1px 3px rgba(0,0,0,0.06);">';
    h += '<div style="font-size:14px;font-weight:600;color:#334155;margin-bottom:14px;">';
    h += '<span style="margin-right:6px;">&#128197;</span>Date Range Filter</div>';
    h += '<div style="display:flex;gap:16px;flex-wrap:wrap;align-items:center;">';
    h += '<div style="flex:1;min-width:180px;">';
    h += '<label style="display:block;font-size:12px;font-weight:500;color:#64748b;margin-bottom:4px;">From</label>';
    h += '<input type="date" id="cex2-date-from" value="' + escapeHtml(state.dateFrom) + '" style="width:100%;padding:8px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;color:#1a1a2e;outline:none;background:#f9fafb;" />';
    h += '</div>';
    h += '<div style="flex:1;min-width:180px;">';
    h += '<label style="display:block;font-size:12px;font-weight:500;color:#64748b;margin-bottom:4px;">To</label>';
    h += '<input type="date" id="cex2-date-to" value="' + escapeHtml(state.dateTo) + '" style="width:100%;padding:8px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;color:#1a1a2e;outline:none;background:#f9fafb;" />';
    h += '</div>';
    h += '</div>';
    h += '</div>';

    /* Export Preview */
    h += '<div style="background:#f0f4ff;border:1px solid #c7d2fe;border-radius:12px;padding:20px;margin-bottom:20px;">';
    h += '<div style="font-size:14px;font-weight:600;color:#4361ee;margin-bottom:14px;">';
    h += '<span style="margin-right:6px;">&#128203;</span>Export Preview</div>';
    h += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;">';
    h += '<div style="text-align:center;">';
    h += '<div style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#6b7280;">Records</div>';
    h += '<div id="cex2-preview-count" style="font-size:20px;font-weight:700;color:#1a1a2e;margin-top:2px;">' + filtered.length + ' records</div>';
    h += '</div>';
    h += '<div style="text-align:center;">';
    h += '<div style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#6b7280;">Date Range</div>';
    h += '<div id="cex2-preview-range" style="font-size:14px;font-weight:600;color:#1a1a2e;margin-top:4px;">' + escapeHtml(rangeText) + '</div>';
    h += '</div>';
    h += '<div style="text-align:center;">';
    h += '<div style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#6b7280;">Total Amount</div>';
    h += '<div id="cex2-preview-total" style="font-size:20px;font-weight:700;color:#059669;margin-top:2px;">' + fmtCurrency(total) + '</div>';
    h += '</div>';
    h += '</div>';
    h += '</div>';

    /* Format Options */
    h += '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-bottom:20px;box-shadow:0 1px 3px rgba(0,0,0,0.06);">';
    h += '<div style="font-size:14px;font-weight:600;color:#334155;margin-bottom:14px;">';
    h += '<span style="margin-right:6px;">&#9881;</span>Format Options</div>';
    h += '<div style="display:flex;gap:24px;flex-wrap:wrap;">';
    h += '<label style="display:flex;align-items:center;gap:8px;font-size:14px;color:#374151;cursor:pointer;">';
    h += '<input type="checkbox" id="cex2-opt-categories"' + (state.includeCategories ? ' checked' : '') + ' style="width:16px;height:16px;accent-color:#4361ee;" />';
    h += 'Include categories</label>';
    h += '<label style="display:flex;align-items:center;gap:8px;font-size:14px;color:#374151;cursor:pointer;">';
    h += '<input type="checkbox" id="cex2-opt-group"' + (state.groupByMonth ? ' checked' : '') + ' style="width:16px;height:16px;accent-color:#4361ee;" />';
    h += 'Group by month</label>';
    h += '</div>';
    h += '</div>';

    /* Export Buttons */
    h += '<div style="display:flex;gap:16px;margin-bottom:28px;">';
    h += '<button id="cex2-btn-csv" style="flex:1;display:flex;align-items:center;justify-content:center;gap:10px;padding:14px 20px;background:linear-gradient(135deg,#059669,#047857);color:#fff;border:none;border-radius:10px;font-size:15px;font-weight:600;cursor:pointer;box-shadow:0 2px 8px rgba(5,150,105,0.3);transition:transform 0.15s,box-shadow 0.15s;">';
    h += '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>';
    h += 'Export CSV</button>';
    h += '<button id="cex2-btn-pdf" style="flex:1;display:flex;align-items:center;justify-content:center;gap:10px;padding:14px 20px;background:linear-gradient(135deg,#4361ee,#3730a3);color:#fff;border:none;border-radius:10px;font-size:15px;font-weight:600;cursor:pointer;box-shadow:0 2px 8px rgba(67,97,238,0.3);transition:transform 0.15s,box-shadow 0.15s;">';
    h += '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 18 15 15"/></svg>';
    h += 'Export PDF</button>';
    h += '</div>';

    /* Recent Export History */
    h += '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:20px;box-shadow:0 1px 3px rgba(0,0,0,0.06);">';
    h += '<div style="font-size:14px;font-weight:600;color:#334155;margin-bottom:14px;">';
    h += '<span style="margin-right:6px;">&#128337;</span>Recent Export History</div>';

    if (history.length === 0) {
      h += '<div style="text-align:center;padding:20px;color:#94a3b8;font-size:14px;">No exports yet. Use the buttons above to export your earnings data.</div>';
    } else {
      h += '<div style="overflow-x:auto;">';
      h += '<table style="width:100%;border-collapse:collapse;font-size:13px;">';
      h += '<thead><tr>';
      h += '<th style="text-align:left;padding:8px 12px;border-bottom:2px solid #e2e8f0;color:#64748b;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Date</th>';
      h += '<th style="text-align:left;padding:8px 12px;border-bottom:2px solid #e2e8f0;color:#64748b;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Format</th>';
      h += '<th style="text-align:right;padding:8px 12px;border-bottom:2px solid #e2e8f0;color:#64748b;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Records</th>';
      h += '<th style="text-align:right;padding:8px 12px;border-bottom:2px solid #e2e8f0;color:#64748b;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Total</th>';
      h += '<th style="text-align:left;padding:8px 12px;border-bottom:2px solid #e2e8f0;color:#64748b;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Range</th>';
      h += '</tr></thead><tbody>';

      var showCount = Math.min(history.length, 10);
      for (var hi = 0; hi < showCount; hi++) {
        var he = history[hi];
        var bgColor = hi % 2 === 0 ? '#fff' : '#f9fafb';
        var formatBadge = he.format === 'CSV'
          ? '<span style="background:#d1fae5;color:#065f46;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;">CSV</span>'
          : '<span style="background:#e0e7ff;color:#3730a3;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;">PDF</span>';
        h += '<tr style="background:' + bgColor + ';">';
        h += '<td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;">' + fmtDate(he.exportedAt) + '</td>';
        h += '<td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;">' + formatBadge + '</td>';
        h += '<td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:right;font-variant-numeric:tabular-nums;">' + (he.recordCount || 0) + '</td>';
        h += '<td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:600;color:#059669;">' + fmtCurrency(he.totalAmount || 0) + '</td>';
        h += '<td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#64748b;">' + escapeHtml(he.dateFrom + ' — ' + he.dateTo) + '</td>';
        h += '</tr>';
      }
      h += '</tbody></table></div>';
    }
    h += '</div>';

    h += '</div>'; /* end container */

    return h;
  }

  /* ── Init ── */

  function init() {
    state.earnings = getEarningsData();
    state.exportHistory = loadExportHistory();

    var container = document.getElementById('cortex-earnings-export-v2');
    if (container) {
      container.innerHTML = render();
      bindEvents();
    }
  }

  /* ── Public API ── */

  window.CortexFreelancer.earningsExportV2 = {
    init: init,
    render: render,
    exportCSV: exportCSV,
    exportPDF: exportPDF,
    getEarningsData: getEarningsData,
    formatForExport: formatForExport
  };

})();
