/**
 * CF-194: Stripe Tax Collection
 * Handle EU/UK VAT calculation based on customer location,
 * display tax breakdown in checkout, store tax info.
 *
 * @namespace window.CortexFreelancer.StripeTax
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_stripe_tax';

  // ─── EU/UK VAT Rates (%) ──────────────────────────────

  /**
   * Standard VAT rates by country code (ISO 3166-1 alpha-2).
   * @type {Object.<string, number>}
   */
  var VAT_RATES = {
    AT: 20, BE: 21, BG: 20, HR: 25, CY: 19,
    CZ: 21, DK: 25, EE: 22, FI: 24, FR: 20,
    DE: 19, GR: 24, HU: 27, IE: 23, IT: 22,
    LV: 21, LT: 21, LU: 17, MT: 18, NL: 21,
    PL: 23, PT: 23, RO: 19, SK: 20, SI: 22,
    ES: 21, SE: 25, GB: 20
  };

  // ─── Storage ───────────────────────────────────────────

  /**
   * Load stored tax records.
   * @returns {Array}
   */
  function loadTaxRecords() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.warn('[StripeTax] Failed to load tax records:', e);
      return [];
    }
  }

  /**
   * Save tax records to localStorage.
   * @param {Array} records
   */
  function saveTaxRecords(records) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    } catch (e) {
      console.warn('[StripeTax] Failed to save tax records:', e);
    }
  }

  // ─── Tax Calculation ───────────────────────────────────

  /**
   * Determine if a country is in the EU or UK.
   * @param {string} countryCode
   * @returns {boolean}
   */
  function isTaxableRegion(countryCode) {
    return VAT_RATES.hasOwnProperty((countryCode || '').toUpperCase());
  }

  /**
   * Get the VAT rate for a country.
   * @param {string} countryCode
   * @returns {number} Rate as percentage, or 0
   */
  function getVatRate(countryCode) {
    return VAT_RATES[(countryCode || '').toUpperCase()] || 0;
  }

  /**
   * Calculate tax breakdown for a purchase.
   * @param {Object} params
   * @param {number} params.subtotal - Amount in cents before tax
   * @param {string} params.countryCode - Customer country code
   * @param {string} [params.vatNumber] - If valid, reverse charge applies (B2B)
   * @param {string} [params.currency='EUR']
   * @returns {Object} Tax breakdown
   */
  function calculateTax(params) {
    if (!params || typeof params.subtotal !== 'number') {
      throw new Error('[StripeTax] subtotal is required and must be a number');
    }

    var country = (params.countryCode || '').toUpperCase();
    var rate = getVatRate(country);
    var isReverseCharge = !!(params.vatNumber && params.vatNumber.trim() && country !== 'XX');
    var taxable = isTaxableRegion(country);

    // B2B reverse charge: no tax collected
    if (isReverseCharge && taxable) {
      return {
        subtotal: params.subtotal,
        taxRate: rate,
        taxAmount: 0,
        total: params.subtotal,
        countryCode: country,
        currency: params.currency || 'EUR',
        reverseCharge: true,
        taxLabel: 'VAT (reverse charge)',
        vatNumber: params.vatNumber.trim()
      };
    }

    var taxAmount = taxable ? Math.round(params.subtotal * rate / 100) : 0;

    return {
      subtotal: params.subtotal,
      taxRate: taxable ? rate : 0,
      taxAmount: taxAmount,
      total: params.subtotal + taxAmount,
      countryCode: country,
      currency: params.currency || 'EUR',
      reverseCharge: false,
      taxLabel: taxable ? 'VAT (' + rate + '%)' : 'No tax',
      vatNumber: params.vatNumber || ''
    };
  }

  // ─── Store Tax Info ────────────────────────────────────

  /**
   * Store a tax record after successful payment.
   * @param {Object} taxBreakdown - Result from calculateTax()
   * @param {string} invoiceId
   * @returns {Object} The stored record
   */
  function storeTaxRecord(taxBreakdown, invoiceId) {
    var record = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 6),
      invoiceId: invoiceId || '',
      timestamp: new Date().toISOString(),
      subtotal: taxBreakdown.subtotal,
      taxRate: taxBreakdown.taxRate,
      taxAmount: taxBreakdown.taxAmount,
      total: taxBreakdown.total,
      countryCode: taxBreakdown.countryCode,
      currency: taxBreakdown.currency,
      reverseCharge: taxBreakdown.reverseCharge,
      vatNumber: taxBreakdown.vatNumber || ''
    };

    var records = loadTaxRecords();
    records.push(record);
    saveTaxRecords(records);

    window.dispatchEvent(new CustomEvent('cortex:tax-recorded', { detail: record }));
    return record;
  }

  // ─── Checkout UI ───────────────────────────────────────

  /**
   * Inject tax-related CSS once.
   */
  function injectStyles() {
    if (document.getElementById('cortex-stripe-tax-styles')) return;
    var style = document.createElement('style');
    style.id = 'cortex-stripe-tax-styles';
    style.textContent =
      '.cortex-tax-breakdown {' +
        'background: #f8f9fa; border-radius: 8px; padding: 16px 20px;' +
        'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;' +
        'font-size: 14px; color: #2d3436; margin: 16px 0;' +
      '}' +
      '.cortex-tax-row {' +
        'display: flex; justify-content: space-between; padding: 6px 0;' +
      '}' +
      '.cortex-tax-row.total {' +
        'border-top: 2px solid #dfe6e9; margin-top: 8px; padding-top: 12px;' +
        'font-weight: 700; font-size: 16px;' +
      '}' +
      '.cortex-tax-row .label { color: #636e72; }' +
      '.cortex-tax-reverse { font-size: 12px; color: #6c5ce7; font-style: italic; margin-top: 4px; }' +
      '.cortex-vat-input {' +
        'display: flex; gap: 8px; align-items: center; margin-bottom: 12px;' +
      '}' +
      '.cortex-vat-input input {' +
        'flex: 1; padding: 8px 12px; border: 1px solid #dfe6e9; border-radius: 6px;' +
        'font-size: 14px;' +
      '}' +
      '.cortex-vat-input input:focus { border-color: #6c5ce7; outline: none; }';
    document.head.appendChild(style);
  }

  /**
   * Format cents to display currency.
   * @param {number} cents
   * @param {string} currency
   * @returns {string}
   */
  function formatAmount(cents, currency) {
    var symbols = { USD: '$', EUR: '\u20AC', GBP: '\u00A3' };
    var sym = symbols[(currency || 'EUR').toUpperCase()] || currency + ' ';
    return sym + (cents / 100).toFixed(2);
  }

  /**
   * Render tax breakdown into a container.
   * @param {Object} taxBreakdown - Result from calculateTax()
   * @param {string|HTMLElement} container
   */
  function renderTaxBreakdown(taxBreakdown, container) {
    var el = typeof container === 'string' ? document.querySelector(container) : container;
    if (!el) {
      console.warn('[StripeTax] Container not found:', container);
      return;
    }

    injectStyles();

    var cur = taxBreakdown.currency;
    var html =
      '<div class="cortex-tax-breakdown">' +
        '<div class="cortex-tax-row">' +
          '<span class="label">Subtotal</span>' +
          '<span>' + formatAmount(taxBreakdown.subtotal, cur) + '</span>' +
        '</div>' +
        '<div class="cortex-tax-row">' +
          '<span class="label">' + escapeHtml(taxBreakdown.taxLabel) + '</span>' +
          '<span>' + formatAmount(taxBreakdown.taxAmount, cur) + '</span>' +
        '</div>' +
        (taxBreakdown.reverseCharge ?
          '<div class="cortex-tax-reverse">Reverse charge applies &mdash; VAT not collected</div>' : '') +
        '<div class="cortex-tax-row total">' +
          '<span>Total</span>' +
          '<span>' + formatAmount(taxBreakdown.total, cur) + '</span>' +
        '</div>' +
      '</div>';

    el.innerHTML = html;
  }

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
   * Initialize the module.
   */
  function init() {
    injectStyles();
    console.log('[StripeTax] Module initialized');
  }

  // ─── Namespace Export ──────────────────────────────────

  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.StripeTax = {
    init: init,
    VAT_RATES: VAT_RATES,
    isTaxableRegion: isTaxableRegion,
    getVatRate: getVatRate,
    calculateTax: calculateTax,
    storeTaxRecord: storeTaxRecord,
    renderTaxBreakdown: renderTaxBreakdown,
    getTaxRecords: loadTaxRecords
  };
})();
