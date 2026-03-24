/**
 * [CF-048] Cortex Freelancer — Invoice Generator
 * Generates professional HTML invoices with print-to-PDF support.
 * Exposed on window.CortexFreelancer.invoiceGenerator
 */
(function () {
  'use strict';

  /**
   * Generate a unique invoice number.
   * @returns {string} e.g. "INV-2026-0324-A7K"
   */
  function generateInvoiceNumber() {
    var now = new Date();
    var y = now.getFullYear();
    var m = String(now.getMonth() + 1).padStart(2, '0');
    var d = String(now.getDate()).padStart(2, '0');
    var rand = Math.random().toString(36).slice(2, 5).toUpperCase();
    return 'INV-' + y + '-' + m + d + '-' + rand;
  }

  /**
   * Format currency amount.
   * @param {number} amount
   * @param {string} [currency='USD']
   * @returns {string}
   */
  function fmtCurrency(amount, currency) {
    currency = currency || 'USD';
    var symbols = { USD: '$', EUR: '\u20ac', GBP: '\u00a3', TRY: '\u20ba', EGP: 'E\u00a3' };
    var sym = symbols[currency] || currency + ' ';
    return sym + Number(amount).toFixed(2);
  }

  /**
   * Generate a professional HTML invoice.
   * @param {Object} data
   * @param {Object} data.freelancer - {name, email, address, phone?, taxId?}
   * @param {Object} data.client - {name, email, address, company?}
   * @param {Array}  data.items - [{description, hours, rate, amount?}]
   * @param {number} [data.taxRate=0] - Tax percentage (e.g. 18 for 18%)
   * @param {string} [data.currency='USD']
   * @param {string} [data.invoiceNumber] - Auto-generated if not provided
   * @param {string} [data.issueDate] - ISO date, defaults to today
   * @param {string} [data.dueDate] - ISO date, defaults to +30 days
   * @param {string} [data.paymentTerms] - e.g. "Net 30"
   * @param {string} [data.notes]
   * @returns {string} Complete HTML document string
   */
  function generateInvoice(data) {
    if (!data) throw new Error('Invoice data is required');
    var f = data.freelancer || {};
    var c = data.client || {};
    var items = Array.isArray(data.items) ? data.items : [];
    var currency = data.currency || 'USD';
    var taxRate = Number(data.taxRate) || 0;
    var invoiceNumber = data.invoiceNumber || generateInvoiceNumber();

    var now = new Date();
    var issueDate = data.issueDate || now.toISOString().slice(0, 10);
    var dueDate = data.dueDate;
    if (!dueDate) {
      var due = new Date(now);
      due.setDate(due.getDate() + 30);
      dueDate = due.toISOString().slice(0, 10);
    }
    var paymentTerms = data.paymentTerms || 'Net 30';

    // Calculate line items
    var subtotal = 0;
    var itemRows = items.map(function (item) {
      var hours = Number(item.hours) || 0;
      var rate = Number(item.rate) || 0;
      var amount = Number(item.amount) || (hours * rate);
      subtotal += amount;
      return '<tr>' +
        '<td style="padding:10px 12px;border-bottom:1px solid #e4e4e7">' + esc(item.description || '') + '</td>' +
        '<td style="padding:10px 12px;border-bottom:1px solid #e4e4e7;text-align:center">' + (hours || '—') + '</td>' +
        '<td style="padding:10px 12px;border-bottom:1px solid #e4e4e7;text-align:right">' + (rate ? fmtCurrency(rate, currency) : '—') + '</td>' +
        '<td style="padding:10px 12px;border-bottom:1px solid #e4e4e7;text-align:right">' + fmtCurrency(amount, currency) + '</td>' +
        '</tr>';
    }).join('');

    var taxAmount = subtotal * (taxRate / 100);
    var total = subtotal + taxAmount;

    function esc(s) {
      var div = typeof document !== 'undefined' ? document.createElement('div') : null;
      if (div) { div.textContent = s; return div.innerHTML; }
      return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function addr(obj) {
      var parts = [];
      if (obj.name) parts.push('<strong>' + esc(obj.name) + '</strong>');
      if (obj.company) parts.push(esc(obj.company));
      if (obj.address) parts.push(esc(obj.address));
      if (obj.email) parts.push(esc(obj.email));
      if (obj.phone) parts.push(esc(obj.phone));
      if (obj.taxId) parts.push('Tax ID: ' + esc(obj.taxId));
      return parts.join('<br>');
    }

    var html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Invoice ' + esc(invoiceNumber) + '</title>' +
      '<style>' +
      'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;margin:0;padding:0;color:#18181b;background:#fff}' +
      '.inv-wrap{max-width:800px;margin:0 auto;padding:40px}' +
      '.inv-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:40px}' +
      '.inv-title{font-size:32px;font-weight:800;color:#6366f1;margin:0}' +
      '.inv-meta{text-align:right;font-size:13px;color:#52525b;line-height:1.6}' +
      '.inv-parties{display:flex;justify-content:space-between;margin-bottom:32px;gap:40px}' +
      '.inv-party{flex:1;font-size:13px;line-height:1.7;color:#3f3f46}' +
      '.inv-party-label{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#a1a1aa;margin-bottom:4px}' +
      'table{width:100%;border-collapse:collapse;margin-bottom:24px}' +
      'th{background:#f4f4f5;padding:10px 12px;font-size:12px;text-transform:uppercase;letter-spacing:.5px;color:#52525b;text-align:left}' +
      'th:nth-child(2){text-align:center}th:nth-child(3),th:nth-child(4){text-align:right}' +
      '.inv-totals{display:flex;justify-content:flex-end;margin-bottom:32px}' +
      '.inv-totals-table{width:260px}' +
      '.inv-totals-row{display:flex;justify-content:space-between;padding:6px 0;font-size:14px;color:#3f3f46}' +
      '.inv-totals-row.total{border-top:2px solid #18181b;padding-top:10px;margin-top:6px;font-size:18px;font-weight:700;color:#18181b}' +
      '.inv-footer{border-top:1px solid #e4e4e7;padding-top:20px;font-size:12px;color:#71717a;line-height:1.6}' +
      '@media print{body{padding:0}.inv-wrap{padding:20px}@page{margin:15mm}}' +
      '</style></head><body>' +
      '<div class="inv-wrap">' +

      '<div class="inv-header">' +
      '<h1 class="inv-title">INVOICE</h1>' +
      '<div class="inv-meta">' +
      '<div><strong>' + esc(invoiceNumber) + '</strong></div>' +
      '<div>Issued: ' + esc(issueDate) + '</div>' +
      '<div>Due: ' + esc(dueDate) + '</div>' +
      '<div>Terms: ' + esc(paymentTerms) + '</div>' +
      '</div></div>' +

      '<div class="inv-parties">' +
      '<div class="inv-party"><div class="inv-party-label">From</div>' + addr(f) + '</div>' +
      '<div class="inv-party"><div class="inv-party-label">Bill To</div>' + addr(c) + '</div>' +
      '</div>' +

      '<table><thead><tr>' +
      '<th>Description</th><th>Hours</th><th>Rate</th><th>Amount</th>' +
      '</tr></thead><tbody>' + itemRows + '</tbody></table>' +

      '<div class="inv-totals"><div class="inv-totals-table">' +
      '<div class="inv-totals-row"><span>Subtotal</span><span>' + fmtCurrency(subtotal, currency) + '</span></div>' +
      (taxRate > 0 ? '<div class="inv-totals-row"><span>Tax (' + taxRate + '%)</span><span>' + fmtCurrency(taxAmount, currency) + '</span></div>' : '') +
      '<div class="inv-totals-row total"><span>Total</span><span>' + fmtCurrency(total, currency) + '</span></div>' +
      '</div></div>' +

      (data.notes ? '<div class="inv-footer"><strong>Notes:</strong><br>' + esc(data.notes) + '</div>' : '') +

      '</div></body></html>';

    return html;
  }

  /**
   * Open invoice HTML in a new window and trigger print (save as PDF).
   * @param {string} invoiceHTML - HTML string from generateInvoice()
   */
  function downloadInvoicePDF(invoiceHTML) {
    var printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to download invoice as PDF.');
      return;
    }
    printWindow.document.write(invoiceHTML);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(function () { printWindow.print(); }, 300);
  }

  /* ───────── public API ───────── */

  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.invoiceGenerator = {
    generateInvoice: generateInvoice,
    downloadInvoicePDF: downloadInvoicePDF,
    generateInvoiceNumber: generateInvoiceNumber
  };

})();
