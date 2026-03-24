/**
 * [CF-194] Stripe Tax Collection for EU/UK VAT
 * Detect customer location, show tax line item, calculate totals with
 * tax included. Configure VAT collection UI.
 * Exposed as window.CortexFreelancer.TaxCollection
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  var STORAGE_KEY = 'cortex_tax_settings';
  var GEO_API = '/api/geo/detect';

  /* ══════════════════════════════════════════════
   * EU/UK VAT RATES (2024-2026 standard rates)
   * ══════════════════════════════════════════════ */
  var VAT_RATES = {
    AT: { rate: 0.20, name: 'Austria',        prefix: 'ATU' },
    BE: { rate: 0.21, name: 'Belgium',        prefix: 'BE0' },
    BG: { rate: 0.20, name: 'Bulgaria',       prefix: 'BG'  },
    HR: { rate: 0.25, name: 'Croatia',        prefix: 'HR'  },
    CY: { rate: 0.19, name: 'Cyprus',         prefix: 'CY'  },
    CZ: { rate: 0.21, name: 'Czech Republic', prefix: 'CZ'  },
    DK: { rate: 0.25, name: 'Denmark',        prefix: 'DK'  },
    EE: { rate: 0.22, name: 'Estonia',        prefix: 'EE'  },
    FI: { rate: 0.255,name: 'Finland',        prefix: 'FI'  },
    FR: { rate: 0.20, name: 'France',         prefix: 'FR'  },
    DE: { rate: 0.19, name: 'Germany',        prefix: 'DE'  },
    GR: { rate: 0.24, name: 'Greece',         prefix: 'EL'  },
    HU: { rate: 0.27, name: 'Hungary',        prefix: 'HU'  },
    IE: { rate: 0.23, name: 'Ireland',        prefix: 'IE'  },
    IT: { rate: 0.22, name: 'Italy',          prefix: 'IT'  },
    LV: { rate: 0.21, name: 'Latvia',         prefix: 'LV'  },
    LT: { rate: 0.21, name: 'Lithuania',      prefix: 'LT'  },
    LU: { rate: 0.17, name: 'Luxembourg',     prefix: 'LU'  },
    MT: { rate: 0.18, name: 'Malta',          prefix: 'MT'  },
    NL: { rate: 0.21, name: 'Netherlands',    prefix: 'NL'  },
    PL: { rate: 0.23, name: 'Poland',         prefix: 'PL'  },
    PT: { rate: 0.23, name: 'Portugal',       prefix: 'PT'  },
    RO: { rate: 0.19, name: 'Romania',        prefix: 'RO'  },
    SK: { rate: 0.23, name: 'Slovakia',       prefix: 'SK'  },
    SI: { rate: 0.22, name: 'Slovenia',       prefix: 'SI'  },
    ES: { rate: 0.21, name: 'Spain',          prefix: 'ES'  },
    SE: { rate: 0.25, name: 'Sweden',         prefix: 'SE'  },
    GB: { rate: 0.20, name: 'United Kingdom', prefix: 'GB'  }
  };

  /* ══════════════════════════════════════════════
   * HELPERS
   * ══════════════════════════════════════════════ */
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

  function loadSettings() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch (_) { return {}; }
  }

  function saveSettings(s) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch (_) {}
  }

  /* ══════════════════════════════════════════════
   * LOCATION DETECTION
   * ══════════════════════════════════════════════ */
  function detectCustomerLocation() {
    // Try cached location first
    var cached = loadSettings();
    if (cached.country_code && cached.detected_at) {
      var age = Date.now() - new Date(cached.detected_at).getTime();
      if (age < 24 * 60 * 60 * 1000) { // 24h cache
        return Promise.resolve({ country: cached.country_code, cached: true });
      }
    }

    return fetch(GEO_API)
      .then(function (res) {
        if (!res.ok) throw new Error('Geo detection failed');
        return res.json();
      })
      .then(function (data) {
        var code = (data.country_code || '').toUpperCase();
        saveSettings(Object.assign({}, cached, {
          country_code: code,
          detected_at: new Date().toISOString()
        }));
        return { country: code, cached: false };
      })
      .catch(function () {
        return { country: null, cached: false };
      });
  }

  /* ══════════════════════════════════════════════
   * VAT VALIDATION (format check)
   * ══════════════════════════════════════════════ */
  function validateVATFormat(vatNumber) {
    if (!vatNumber || typeof vatNumber !== 'string') return { valid: false, error: 'VAT number required' };

    var cleaned = vatNumber.replace(/[\s.-]/g, '').toUpperCase();
    var countryCode = cleaned.substring(0, 2);

    if (!VAT_RATES[countryCode]) {
      return { valid: false, error: 'Unknown country prefix: ' + countryCode };
    }

    // Basic format: 2-letter country code + 8-12 alphanumeric chars
    if (!/^[A-Z]{2}[0-9A-Z]{8,12}$/.test(cleaned)) {
      return { valid: false, error: 'Invalid VAT number format' };
    }

    return { valid: true, country: countryCode, cleaned: cleaned };
  }

  function verifyVATNumber(vatNumber) {
    var format = validateVATFormat(vatNumber);
    if (!format.valid) return Promise.resolve(format);

    return fetch('/api/vat/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vat_number: format.cleaned })
    })
    .then(function (res) { return res.json(); })
    .then(function (data) {
      return {
        valid: data.valid === true,
        country: format.country,
        company_name: data.company_name || '',
        address: data.address || '',
        error: data.valid ? null : 'VAT number not recognized'
      };
    })
    .catch(function () {
      // Fallback: accept format-valid numbers
      return { valid: true, country: format.country, verified: false };
    });
  }

  /* ══════════════════════════════════════════════
   * TAX CALCULATION
   * ══════════════════════════════════════════════ */
  function calculateTax(opts) {
    var subtotalCents = opts.subtotal_cents || 0;
    var countryCode = (opts.country || '').toUpperCase();
    var hasValidVAT = opts.has_valid_vat || false;
    var sellerCountry = (opts.seller_country || '').toUpperCase();
    var currency = opts.currency || 'USD';

    var result = {
      subtotal_cents: subtotalCents,
      tax_cents: 0,
      total_cents: subtotalCents,
      tax_rate: 0,
      tax_label: '',
      country: countryCode,
      reverse_charge: false,
      currency: currency
    };

    var vatInfo = VAT_RATES[countryCode];
    if (!vatInfo) {
      // Non-EU/UK: no VAT
      result.tax_label = 'No tax';
      return result;
    }

    // B2B reverse charge: valid VAT + different EU country
    if (hasValidVAT && countryCode !== sellerCountry && sellerCountry) {
      result.tax_label = 'VAT (reverse charge)';
      result.reverse_charge = true;
      return result;
    }

    // Apply VAT
    result.tax_rate = vatInfo.rate;
    result.tax_cents = Math.round(subtotalCents * vatInfo.rate);
    result.total_cents = subtotalCents + result.tax_cents;
    result.tax_label = 'VAT (' + (vatInfo.rate * 100).toFixed(1) + '%) — ' + vatInfo.name;

    return result;
  }

  /* ══════════════════════════════════════════════
   * TAX LINE ITEM UI
   * ══════════════════════════════════════════════ */
  function renderTaxSummary(container, taxResult) {
    if (!taxResult) return;

    var currency = taxResult.currency || 'USD';
    var html = '<div class="cf-tax-summary">';

    html += '<div class="cf-tax-line"><span>Subtotal</span>';
    html += '<span>' + formatCurrency(taxResult.subtotal_cents, currency) + '</span></div>';

    if (taxResult.tax_cents > 0) {
      html += '<div class="cf-tax-line cf-tax-vat">';
      html += '<span>' + escHtml(taxResult.tax_label) + '</span>';
      html += '<span>' + formatCurrency(taxResult.tax_cents, currency) + '</span></div>';
    } else if (taxResult.reverse_charge) {
      html += '<div class="cf-tax-line cf-tax-reverse">';
      html += '<span>' + escHtml(taxResult.tax_label) + '</span>';
      html += '<span>' + formatCurrency(0, currency) + '</span></div>';
    }

    html += '<div class="cf-tax-line cf-tax-total"><span>Total</span>';
    html += '<span>' + formatCurrency(taxResult.total_cents, currency) + '</span></div>';

    html += '</div>';
    container.innerHTML = html;
  }

  /* ══════════════════════════════════════════════
   * VAT INPUT FIELD
   * ══════════════════════════════════════════════ */
  function renderVATInput(container, opts) {
    opts = opts || {};
    var onValidated = opts.onValidated || function () {};

    var html = '<div class="cf-vat-input-group">';
    html += '<label for="cf-vat-number">VAT Number <small>(optional, for business customers)</small></label>';
    html += '<div class="cf-vat-row">';
    html += '<input type="text" id="cf-vat-number" class="cf-input" placeholder="e.g. DE123456789" />';
    html += '<button class="cf-btn cf-btn-secondary" id="cf-vat-verify">Verify</button>';
    html += '</div>';
    html += '<div id="cf-vat-status" class="cf-vat-status"></div>';
    html += '</div>';

    container.innerHTML = html;

    var input = document.getElementById('cf-vat-number');
    var verifyBtn = document.getElementById('cf-vat-verify');
    var statusEl = document.getElementById('cf-vat-status');

    if (verifyBtn && input) {
      verifyBtn.addEventListener('click', function () {
        var val = input.value.trim();
        if (!val) {
          statusEl.innerHTML = '';
          onValidated({ has_valid_vat: false, vat_number: '' });
          return;
        }

        statusEl.innerHTML = '<span class="cf-vat-checking">Verifying…</span>';
        verifyBtn.disabled = true;

        verifyVATNumber(val).then(function (result) {
          verifyBtn.disabled = false;
          if (result.valid) {
            statusEl.innerHTML = '<span class="cf-vat-valid">✓ Valid VAT number' +
              (result.company_name ? ' — ' + escHtml(result.company_name) : '') + '</span>';
            onValidated({ has_valid_vat: true, vat_number: val, country: result.country });
          } else {
            statusEl.innerHTML = '<span class="cf-vat-invalid">✕ ' + escHtml(result.error || 'Invalid') + '</span>';
            onValidated({ has_valid_vat: false, vat_number: val });
          }
        });
      });
    }
  }

  /* ══════════════════════════════════════════════
   * PUBLIC API
   * ══════════════════════════════════════════════ */
  window.CortexFreelancer.TaxCollection = {
    VAT_RATES: VAT_RATES,
    detectCustomerLocation: detectCustomerLocation,
    validateVATFormat: validateVATFormat,
    verifyVATNumber: verifyVATNumber,
    calculateTax: calculateTax,
    renderTaxSummary: renderTaxSummary,
    renderVATInput: renderVATInput
  };
})();
