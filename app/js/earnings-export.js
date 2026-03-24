/**
 * [CF-060] Earnings Export
 * Export earnings data to CSV and PDF (printable HTML).
 * Exposed on window.CortexFreelancer.earningsExport
 */
(function () {
  'use strict';

  /**
   * Escape a value for CSV output.
   * @param {*} value
   * @returns {string}
   */
  function escapeCSV(value) {
    var str = value == null ? '' : String(value);
    if (str.indexOf(',') !== -1 || str.indexOf('"') !== -1 || str.indexOf('\n') !== -1) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  /**
   * Trigger a file download via Blob.
   * @param {string} content - File content.
   * @param {string} filename - Download filename.
   * @param {string} mimeType - MIME type.
   */
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
    }, 100);
  }

  /**
   * Determine CSV column headers from an array of earnings objects.
   * @param {Array<Object>} earnings
   * @returns {string[]}
   */
  function getHeaders(earnings) {
    var headerSet = {};
    var orderedHeaders = [];

    var preferredOrder = ['date', 'client', 'project', 'title', 'description', 'amount', 'currency', 'category', 'status', 'platform'];

    for (var i = 0; i < earnings.length; i++) {
      var keys = Object.keys(earnings[i]);
      for (var j = 0; j < keys.length; j++) {
        if (!headerSet[keys[j]]) {
          headerSet[keys[j]] = true;
        }
      }
    }

    for (var p = 0; p < preferredOrder.length; p++) {
      if (headerSet[preferredOrder[p]]) {
        orderedHeaders.push(preferredOrder[p]);
        delete headerSet[preferredOrder[p]];
      }
    }

    var remaining = Object.keys(headerSet);
    remaining.sort();
    orderedHeaders = orderedHeaders.concat(remaining);

    return orderedHeaders;
  }

  /**
   * Export earnings data to a CSV file and trigger download.
   * @param {Array<Object>} earnings - Array of earnings objects.
   * @param {string} [filename='earnings-export.csv'] - Output filename.
   * @returns {{success: boolean, rowCount: number, filename: string}}
   */
  function exportToCSV(earnings, filename) {
    if (!Array.isArray(earnings) || earnings.length === 0) {
      console.warn('[CF-060] No earnings data to export.');
      return { success: false, rowCount: 0, filename: '' };
    }

    var fname = filename || 'earnings-export.csv';
    var headers = getHeaders(earnings);
    var rows = [headers.map(escapeCSV).join(',')];

    for (var i = 0; i < earnings.length; i++) {
      var row = [];
      for (var j = 0; j < headers.length; j++) {
        row.push(escapeCSV(earnings[i][headers[j]]));
      }
      rows.push(row.join(','));
    }

    var csvContent = rows.join('\n');
    downloadBlob(csvContent, fname, 'text/csv;charset=utf-8;');

    return { success: true, rowCount: earnings.length, filename: fname };
  }

  /**
   * Generate printable HTML for earnings and open a print dialog.
   * @param {Array<Object>} earnings - Array of earnings objects.
   * @param {string} [filename='earnings-report'] - Title for the report.
   * @returns {{success: boolean, rowCount: number, filename: string}}
   */
  function exportToPDF(earnings, filename) {
    if (!Array.isArray(earnings) || earnings.length === 0) {
      console.warn('[CF-060] No earnings data to export.');
      return { success: false, rowCount: 0, filename: '' };
    }

    var title = filename || 'earnings-report';
    var headers = getHeaders(earnings);

    var totalAmount = 0;
    for (var t = 0; t < earnings.length; t++) {
      if (typeof earnings[t].amount === 'number') {
        totalAmount += earnings[t].amount;
      }
    }

    var html = [
      '<!DOCTYPE html>',
      '<html><head><meta charset="utf-8">',
      '<title>' + title + '</title>',
      '<style>',
      '  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 40px; color: #1a1a1a; }',
      '  h1 { font-size: 22px; margin-bottom: 4px; }',
      '  .meta { color: #666; font-size: 13px; margin-bottom: 24px; }',
      '  table { width: 100%; border-collapse: collapse; font-size: 13px; }',
      '  th { background: #f5f5f5; text-align: left; padding: 8px 10px; border-bottom: 2px solid #ddd; font-weight: 600; }',
      '  td { padding: 6px 10px; border-bottom: 1px solid #eee; }',
      '  tr:nth-child(even) { background: #fafafa; }',
      '  .summary { margin-top: 20px; font-size: 14px; font-weight: 600; }',
      '  @media print { body { margin: 20px; } }',
      '</style>',
      '</head><body>',
      '<h1>' + title + '</h1>',
      '<div class="meta">Generated on ' + new Date().toLocaleDateString() + ' &middot; ' + earnings.length + ' records</div>',
      '<table><thead><tr>'
    ];

    for (var h = 0; h < headers.length; h++) {
      html.push('<th>' + headers[h].charAt(0).toUpperCase() + headers[h].slice(1) + '</th>');
    }
    html.push('</tr></thead><tbody>');

    for (var i = 0; i < earnings.length; i++) {
      html.push('<tr>');
      for (var j = 0; j < headers.length; j++) {
        var val = earnings[i][headers[j]];
        var display = val == null ? '' : String(val);
        if (headers[j] === 'amount' && typeof val === 'number') {
          display = val.toFixed(2);
        }
        html.push('<td>' + display + '</td>');
      }
      html.push('</tr>');
    }

    html.push('</tbody></table>');
    html.push('<div class="summary">Total: $' + totalAmount.toFixed(2) + '</div>');
    html.push('</body></html>');

    var printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html.join('\n'));
      printWindow.document.close();
      printWindow.focus();
      setTimeout(function () {
        printWindow.print();
      }, 500);
    } else {
      console.warn('[CF-060] Pop-up blocked. Please allow pop-ups to export PDF.');
      return { success: false, rowCount: earnings.length, filename: title };
    }

    return { success: true, rowCount: earnings.length, filename: title };
  }

  /**
   * Generate a summary report for a date range from localStorage earnings data.
   * Reads from 'cortex_earnings_log' if available; otherwise returns empty report structure.
   * @param {{start: string, end: string}} dateRange - ISO date strings.
   * @returns {{period: {start: string, end: string}, totalEarnings: number, transactionCount: number, avgPerTransaction: number, earnings: Array<Object>}}
   */
  function generateReport(dateRange) {
    var start = dateRange && dateRange.start ? new Date(dateRange.start) : null;
    var end = dateRange && dateRange.end ? new Date(dateRange.end) : null;

    var allEarnings = [];
    try {
      var raw = localStorage.getItem('cortex_earnings_log');
      if (raw) {
        var parsed = JSON.parse(raw);
        allEarnings = Array.isArray(parsed) ? parsed : [];
      }
    } catch (e) {
      console.warn('[CF-060] Failed to read earnings log:', e);
    }

    var filtered = allEarnings.filter(function (entry) {
      if (!entry.date) return false;
      var d = new Date(entry.date);
      if (start && d.getTime() < start.getTime()) return false;
      if (end && d.getTime() > end.getTime()) return false;
      return true;
    });

    var total = 0;
    for (var i = 0; i < filtered.length; i++) {
      total += (filtered[i].amount || 0);
    }

    return {
      period: {
        start: start ? start.toISOString().slice(0, 10) : 'all',
        end: end ? end.toISOString().slice(0, 10) : 'all'
      },
      totalEarnings: Math.round(total * 100) / 100,
      transactionCount: filtered.length,
      avgPerTransaction: filtered.length > 0 ? Math.round((total / filtered.length) * 100) / 100 : 0,
      earnings: filtered
    };
  }

  /**
   * Export earnings filtered by client.
   * @param {Array<Object>} earnings
   * @param {string} client - Client name to filter by.
   * @param {string} [format='csv'] - 'csv' or 'pdf'.
   * @returns {{success: boolean, rowCount: number, filename: string}}
   */
  function exportByClient(earnings, client, format) {
    if (!Array.isArray(earnings) || !client) {
      return { success: false, rowCount: 0, filename: '' };
    }

    var filtered = earnings.filter(function (e) {
      return e.client && e.client.toLowerCase().indexOf(client.toLowerCase()) !== -1;
    });

    var safeClient = client.replace(/[^a-zA-Z0-9_-]/g, '_');
    if (format === 'pdf') {
      return exportToPDF(filtered, 'earnings-' + safeClient);
    }
    return exportToCSV(filtered, 'earnings-' + safeClient + '.csv');
  }

  /**
   * Export earnings for a specific date range.
   * @param {Array<Object>} earnings
   * @param {string} startDate - ISO date string.
   * @param {string} endDate - ISO date string.
   * @param {string} [format='csv'] - 'csv' or 'pdf'.
   * @returns {{success: boolean, rowCount: number, filename: string}}
   */
  function exportByDateRange(earnings, startDate, endDate, format) {
    if (!Array.isArray(earnings)) {
      return { success: false, rowCount: 0, filename: '' };
    }

    var start = startDate ? new Date(startDate) : null;
    var end = endDate ? new Date(endDate) : null;

    var filtered = earnings.filter(function (e) {
      if (!e.date) return false;
      var d = new Date(e.date);
      if (start && d.getTime() < start.getTime()) return false;
      if (end && d.getTime() > end.getTime()) return false;
      return true;
    });

    var suffix = (startDate || 'all') + '_to_' + (endDate || 'all');
    if (format === 'pdf') {
      return exportToPDF(filtered, 'earnings-' + suffix);
    }
    return exportToCSV(filtered, 'earnings-' + suffix + '.csv');
  }

  /**
   * Generate category breakdown summary from earnings.
   * @param {Array<Object>} earnings
   * @returns {{categories: Array<{category: string, total: number, count: number, avgPerEntry: number}>, grandTotal: number}}
   */
  function getCategorySummary(earnings) {
    if (!Array.isArray(earnings) || earnings.length === 0) {
      return { categories: [], grandTotal: 0 };
    }

    var catMap = {};
    var grandTotal = 0;

    for (var i = 0; i < earnings.length; i++) {
      var cat = earnings[i].category || 'Uncategorized';
      var amount = Number(earnings[i].amount) || 0;
      grandTotal += amount;

      if (!catMap[cat]) {
        catMap[cat] = { total: 0, count: 0 };
      }
      catMap[cat].total += amount;
      catMap[cat].count++;
    }

    var categories = Object.keys(catMap).map(function (cat) {
      return {
        category: cat,
        total: Math.round(catMap[cat].total * 100) / 100,
        count: catMap[cat].count,
        avgPerEntry: catMap[cat].count > 0 ? Math.round((catMap[cat].total / catMap[cat].count) * 100) / 100 : 0
      };
    });

    categories.sort(function (a, b) { return b.total - a.total; });

    return {
      categories: categories,
      grandTotal: Math.round(grandTotal * 100) / 100
    };
  }

  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.earningsExport = {
    exportToCSV: exportToCSV,
    exportToPDF: exportToPDF,
    exportByClient: exportByClient,
    exportByDateRange: exportByDateRange,
    generateReport: generateReport,
    getCategorySummary: getCategorySummary
  };
})();
