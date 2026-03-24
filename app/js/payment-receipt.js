/**
 * CF-193: Payment Receipt Email
 * Generate formatted HTML receipt after successful payment with
 * invoice details, plan info, amount, date, and download link.
 *
 * @namespace window.CortexFreelancer.PaymentReceipt
 */
(function () {
  'use strict';

  // ─── Helpers ───────────────────────────────────────────

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

  /**
   * Format a currency amount.
   * @param {number} amount - Amount in minor units (cents)
   * @param {string} [currency='USD']
   * @returns {string}
   */
  function formatCurrency(amount, currency) {
    currency = currency || 'USD';
    var value = (amount / 100).toFixed(2);
    var symbols = { USD: '$', EUR: '\u20AC', GBP: '\u00A3' };
    var symbol = symbols[currency.toUpperCase()] || currency + ' ';
    return symbol + value;
  }

  /**
   * Format a date to a readable string.
   * @param {string|number|Date} date
   * @returns {string}
   */
  function formatDate(date) {
    var d = new Date(date);
    if (isNaN(d.getTime())) return 'N/A';
    return d.toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  }

  /**
   * Generate a unique receipt ID.
   * @returns {string}
   */
  function generateReceiptId() {
    return 'RCT-' + Date.now().toString(36).toUpperCase() + '-' +
      Math.random().toString(36).substr(2, 5).toUpperCase();
  }

  // ─── Receipt Generation ────────────────────────────────

  /**
   * Build receipt data from payment info.
   * @param {Object} payment
   * @param {string} payment.invoiceId - Invoice/transaction identifier
   * @param {string} payment.customerName - Customer full name
   * @param {string} payment.customerEmail - Customer email
   * @param {string} payment.planName - Subscription plan name
   * @param {number} payment.amount - Amount in cents
   * @param {string} [payment.currency='USD']
   * @param {string|Date} [payment.date] - Payment date (defaults to now)
   * @param {number} [payment.taxAmount=0] - Tax in cents
   * @param {string} [payment.taxLabel='Tax']
   * @param {string} [payment.billingPeriod] - e.g. 'Mar 2026 - Apr 2026'
   * @returns {Object} Structured receipt data
   */
  function buildReceipt(payment) {
    if (!payment || !payment.invoiceId || !payment.amount) {
      throw new Error('[PaymentReceipt] Missing required payment fields: invoiceId, amount');
    }
    var receiptId = generateReceiptId();
    var subtotal = payment.amount;
    var tax = payment.taxAmount || 0;
    var total = subtotal + tax;

    return {
      receiptId: receiptId,
      invoiceId: payment.invoiceId,
      customerName: payment.customerName || 'Customer',
      customerEmail: payment.customerEmail || '',
      planName: payment.planName || 'Cortex Freelancer',
      subtotal: subtotal,
      taxAmount: tax,
      taxLabel: payment.taxLabel || 'Tax',
      total: total,
      currency: payment.currency || 'USD',
      date: payment.date ? new Date(payment.date) : new Date(),
      billingPeriod: payment.billingPeriod || ''
    };
  }

  /**
   * Generate formatted HTML receipt string.
   * @param {Object} receipt - Receipt data from buildReceipt()
   * @returns {string} HTML string
   */
  function generateHtml(receipt) {
    var cur = receipt.currency;
    var html =
      '<!DOCTYPE html>' +
      '<html lang="en"><head><meta charset="UTF-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>Payment Receipt - ' + escapeHtml(receipt.receiptId) + '</title>' +
      '<style>' +
        'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; ' +
          'margin: 0; padding: 40px 20px; background: #f5f6fa; color: #2d3436; }' +
        '.receipt { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 12px; ' +
          'box-shadow: 0 2px 16px rgba(0,0,0,0.08); overflow: hidden; }' +
        '.receipt-header { background: #6c5ce7; color: #fff; padding: 32px; text-align: center; }' +
        '.receipt-header h1 { margin: 0; font-size: 24px; }' +
        '.receipt-header p { margin: 8px 0 0; opacity: 0.85; font-size: 14px; }' +
        '.receipt-body { padding: 32px; }' +
        '.receipt-row { display: flex; justify-content: space-between; padding: 10px 0; ' +
          'border-bottom: 1px solid #f0f0f0; font-size: 14px; }' +
        '.receipt-row:last-child { border-bottom: none; }' +
        '.receipt-row .label { color: #636e72; }' +
        '.receipt-row .value { font-weight: 600; }' +
        '.receipt-total { display: flex; justify-content: space-between; padding: 16px 0; ' +
          'margin-top: 12px; border-top: 2px solid #6c5ce7; font-size: 18px; font-weight: 700; }' +
        '.receipt-total .value { color: #6c5ce7; }' +
        '.receipt-footer { padding: 24px 32px; background: #f8f9fa; text-align: center; font-size: 12px; color: #b2bec3; }' +
        '.download-btn { display: inline-block; margin-top: 20px; padding: 12px 28px; ' +
          'background: #6c5ce7; color: #fff; text-decoration: none; border-radius: 8px; ' +
          'font-weight: 600; font-size: 14px; }' +
      '</style></head><body>' +
      '<div class="receipt">' +
        '<div class="receipt-header">' +
          '<h1>Payment Receipt</h1>' +
          '<p>' + escapeHtml(formatDate(receipt.date)) + '</p>' +
        '</div>' +
        '<div class="receipt-body">' +
          '<div class="receipt-row">' +
            '<span class="label">Receipt #</span>' +
            '<span class="value">' + escapeHtml(receipt.receiptId) + '</span>' +
          '</div>' +
          '<div class="receipt-row">' +
            '<span class="label">Invoice #</span>' +
            '<span class="value">' + escapeHtml(receipt.invoiceId) + '</span>' +
          '</div>' +
          '<div class="receipt-row">' +
            '<span class="label">Customer</span>' +
            '<span class="value">' + escapeHtml(receipt.customerName) + '</span>' +
          '</div>' +
          '<div class="receipt-row">' +
            '<span class="label">Email</span>' +
            '<span class="value">' + escapeHtml(receipt.customerEmail) + '</span>' +
          '</div>' +
          '<div class="receipt-row">' +
            '<span class="label">Plan</span>' +
            '<span class="value">' + escapeHtml(receipt.planName) + '</span>' +
          '</div>' +
          (receipt.billingPeriod ?
            '<div class="receipt-row">' +
              '<span class="label">Billing Period</span>' +
              '<span class="value">' + escapeHtml(receipt.billingPeriod) + '</span>' +
            '</div>' : '') +
          '<div class="receipt-row">' +
            '<span class="label">Subtotal</span>' +
            '<span class="value">' + formatCurrency(receipt.subtotal, cur) + '</span>' +
          '</div>' +
          (receipt.taxAmount > 0 ?
            '<div class="receipt-row">' +
              '<span class="label">' + escapeHtml(receipt.taxLabel) + '</span>' +
              '<span class="value">' + formatCurrency(receipt.taxAmount, cur) + '</span>' +
            '</div>' : '') +
          '<div class="receipt-total">' +
            '<span class="label">Total</span>' +
            '<span class="value">' + formatCurrency(receipt.total, cur) + '</span>' +
          '</div>' +
          '<div style="text-align:center;">' +
            '<a class="download-btn" href="#" id="cortex-receipt-download">Download PDF</a>' +
          '</div>' +
        '</div>' +
        '<div class="receipt-footer">' +
          '<p>Cortex Freelancer &mdash; Thank you for your payment.</p>' +
          '<p>If you have questions, contact support@cortexfreelancer.com</p>' +
        '</div>' +
      '</div></body></html>';

    return html;
  }

  /**
   * Render the receipt into a target container element.
   * @param {Object} payment - Payment data
   * @param {string|HTMLElement} container - CSS selector or element
   */
  function renderReceipt(payment, container) {
    var receipt = buildReceipt(payment);
    var html = generateHtml(receipt);
    var el = typeof container === 'string' ? document.querySelector(container) : container;
    if (!el) {
      console.warn('[PaymentReceipt] Container not found:', container);
      return;
    }

    // Render inside an iframe for style isolation
    var iframe = document.createElement('iframe');
    iframe.style.width = '100%';
    iframe.style.minHeight = '700px';
    iframe.style.border = 'none';
    iframe.style.borderRadius = '12px';
    el.innerHTML = '';
    el.appendChild(iframe);

    var doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();

    // Wire up download link
    var downloadBtn = doc.getElementById('cortex-receipt-download');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', function (e) {
        e.preventDefault();
        downloadReceiptBlob(html, receipt.receiptId);
      });
    }

    window.dispatchEvent(new CustomEvent('cortex:receipt-rendered', {
      detail: { receiptId: receipt.receiptId, invoiceId: receipt.invoiceId }
    }));
  }

  /**
   * Trigger a download of the receipt as an HTML file.
   * @param {string} html
   * @param {string} receiptId
   */
  function downloadReceiptBlob(html, receiptId) {
    try {
      var blob = new Blob([html], { type: 'text/html' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'receipt-' + receiptId + '.html';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.warn('[PaymentReceipt] Download failed:', e);
    }
  }

  /**
   * Initialize the module.
   */
  function init() {
    console.log('[PaymentReceipt] Module initialized');
  }

  // ─── Namespace Export ──────────────────────────────────

  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.PaymentReceipt = {
    init: init,
    buildReceipt: buildReceipt,
    generateHtml: generateHtml,
    renderReceipt: renderReceipt,
    formatCurrency: formatCurrency
  };
})();
