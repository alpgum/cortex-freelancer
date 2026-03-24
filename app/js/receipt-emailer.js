/**
 * [CF-193] Payment Receipt Email via SendGrid
 * Client-side logic to trigger receipt email request after successful payment.
 * Format receipt data for the API endpoint that sends via SendGrid.
 * Exposed as window.CortexFreelancer.ReceiptEmailer
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  var API_ENDPOINT = '/api/receipt/send';
  var STORAGE_KEY = 'cortex_receipt_history';

  /* ══════════════════════════════════════════════
   * HELPERS
   * ══════════════════════════════════════════════ */
  function loadHistory() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch (_) { return []; }
  }

  function saveHistory(history) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(history)); } catch (_) {}
  }

  function escHtml(str) {
    var d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  function formatCurrency(cents, currency) {
    currency = (currency || 'USD').toUpperCase();
    var symbols = { USD: '$', EUR: '€', GBP: '£' };
    var symbol = symbols[currency] || currency + ' ';
    return symbol + (cents / 100).toFixed(2);
  }

  function generateReceiptNumber() {
    var ts = Date.now().toString(36).toUpperCase();
    var rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return 'RCT-' + ts + '-' + rand;
  }

  /* ══════════════════════════════════════════════
   * RECEIPT DATA FORMATTER
   * ══════════════════════════════════════════════ */
  function formatReceiptData(payment) {
    if (!payment || !payment.email) {
      return { valid: false, error: 'Missing email address' };
    }
    if (!payment.amount_cents || payment.amount_cents <= 0) {
      return { valid: false, error: 'Invalid payment amount' };
    }

    var currency = payment.currency || 'USD';
    var subtotal = payment.amount_cents;
    var tax = payment.tax_cents || 0;
    var total = subtotal + tax;

    var receiptData = {
      receipt_number: payment.receipt_number || generateReceiptNumber(),
      to_email: payment.email,
      to_name: payment.customer_name || '',
      date: payment.date || new Date().toISOString(),
      payment_method: payment.payment_method || 'card',
      card_last4: payment.card_last4 || '****',
      card_brand: payment.card_brand || '',

      line_items: [{
        description: payment.plan_name || 'Cortex Freelancer Pro',
        period: payment.billing_period || '',
        amount: formatCurrency(subtotal, currency)
      }],

      subtotal: formatCurrency(subtotal, currency),
      tax_label: payment.tax_label || (tax > 0 ? 'Tax' : ''),
      tax_amount: tax > 0 ? formatCurrency(tax, currency) : '',
      total: formatCurrency(total, currency),
      currency: currency,

      stripe_payment_id: payment.stripe_payment_id || '',
      stripe_invoice_id: payment.stripe_invoice_id || '',

      company: {
        name: 'Cortex Freelancer',
        address: payment.company_address || '',
        vat_number: payment.company_vat || ''
      },

      customer: {
        name: payment.customer_name || '',
        address: payment.customer_address || '',
        vat_number: payment.customer_vat || ''
      }
    };

    return { valid: true, data: receiptData };
  }

  /* ══════════════════════════════════════════════
   * SEND RECEIPT
   * ══════════════════════════════════════════════ */
  function sendReceipt(payment) {
    var formatted = formatReceiptData(payment);
    if (!formatted.valid) {
      return Promise.resolve({ success: false, error: formatted.error });
    }

    return fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formatted.data)
    })
    .then(function (res) {
      if (!res.ok) throw new Error('Receipt send failed: ' + res.status);
      return res.json();
    })
    .then(function (data) {
      var history = loadHistory();
      history.push({
        receipt_number: formatted.data.receipt_number,
        email: formatted.data.to_email,
        total: formatted.data.total,
        sent_at: new Date().toISOString(),
        message_id: data.message_id || null
      });
      // Keep last 50 receipts
      if (history.length > 50) history = history.slice(-50);
      saveHistory(history);

      return { success: true, receipt_number: formatted.data.receipt_number, data: data };
    })
    .catch(function (err) {
      return { success: false, error: err.message };
    });
  }

  /* ══════════════════════════════════════════════
   * POST-CHECKOUT HOOK
   * ══════════════════════════════════════════════ */
  function onCheckoutSuccess(sessionData) {
    if (!sessionData) return Promise.resolve({ success: false, error: 'No session data' });

    var payment = {
      email: sessionData.customer_email,
      customer_name: sessionData.customer_name || '',
      amount_cents: sessionData.amount_total || 0,
      tax_cents: sessionData.total_details && sessionData.total_details.amount_tax ? sessionData.total_details.amount_tax : 0,
      currency: sessionData.currency || 'USD',
      plan_name: sessionData.plan_name || 'Cortex Freelancer Pro',
      billing_period: sessionData.billing_period || '',
      stripe_payment_id: sessionData.payment_intent || '',
      stripe_invoice_id: sessionData.invoice || '',
      card_last4: sessionData.card_last4 || '',
      card_brand: sessionData.card_brand || '',
      payment_method: 'card',
      tax_label: sessionData.tax_label || '',
      customer_address: sessionData.customer_address || '',
      customer_vat: sessionData.customer_vat || ''
    };

    return sendReceipt(payment);
  }

  /* ══════════════════════════════════════════════
   * RECEIPT PREVIEW (for UI)
   * ══════════════════════════════════════════════ */
  function renderReceiptPreview(container, payment) {
    var formatted = formatReceiptData(payment);
    if (!formatted.valid) {
      container.innerHTML = '<p class="cf-error">' + escHtml(formatted.error) + '</p>';
      return;
    }
    var d = formatted.data;

    var html = '<div class="cf-receipt-preview">';
    html += '<div class="cf-receipt-header">';
    html += '<h3>Payment Receipt</h3>';
    html += '<span class="cf-receipt-number">' + escHtml(d.receipt_number) + '</span>';
    html += '</div>';
    html += '<div class="cf-receipt-date">' + escHtml(new Date(d.date).toLocaleDateString()) + '</div>';

    html += '<table class="cf-receipt-table">';
    html += '<thead><tr><th>Description</th><th>Amount</th></tr></thead><tbody>';
    d.line_items.forEach(function (item) {
      html += '<tr><td>' + escHtml(item.description);
      if (item.period) html += ' <small>(' + escHtml(item.period) + ')</small>';
      html += '</td><td>' + escHtml(item.amount) + '</td></tr>';
    });
    html += '</tbody></table>';

    html += '<div class="cf-receipt-totals">';
    html += '<div class="cf-receipt-line"><span>Subtotal</span><span>' + escHtml(d.subtotal) + '</span></div>';
    if (d.tax_amount) {
      html += '<div class="cf-receipt-line"><span>' + escHtml(d.tax_label) + '</span><span>' + escHtml(d.tax_amount) + '</span></div>';
    }
    html += '<div class="cf-receipt-line cf-receipt-total"><span>Total</span><span>' + escHtml(d.total) + '</span></div>';
    html += '</div>';

    html += '<div class="cf-receipt-payment">';
    html += '<span>Paid via ' + escHtml(d.card_brand) + ' ending ' + escHtml(d.card_last4) + '</span>';
    html += '</div>';
    html += '</div>';

    container.innerHTML = html;
  }

  /* ══════════════════════════════════════════════
   * PUBLIC API
   * ══════════════════════════════════════════════ */
  window.CortexFreelancer.ReceiptEmailer = {
    formatReceiptData: formatReceiptData,
    sendReceipt: sendReceipt,
    onCheckoutSuccess: onCheckoutSuccess,
    renderReceiptPreview: renderReceiptPreview,
    getHistory: loadHistory,
    generateReceiptNumber: generateReceiptNumber
  };
})();
