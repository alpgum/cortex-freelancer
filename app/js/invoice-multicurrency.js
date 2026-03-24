/**
 * [CF-124] Invoice Creator — Multi-Currency Support with Conversion
 * Support USD, EUR, GBP, TRY with live exchange rate conversion.
 * Exposed on window.CortexFreelancer.InvoiceMultiCurrency
 */
(function () {
  'use strict';

  var CF = window.CortexFreelancer = window.CortexFreelancer || {};

  var STORAGE_KEY_RATES = 'cf_exchange_rates';
  var STORAGE_KEY_PREFS = 'cf_currency_prefs';
  var CSS_INJECTED = false;
  var RATE_CACHE_HOURS = 4;

  var CURRENCIES = {
    USD: { code: 'USD', symbol: '$', name: 'US Dollar', locale: 'en-US', flag: 'US' },
    EUR: { code: 'EUR', symbol: '\u20ac', name: 'Euro', locale: 'de-DE', flag: 'EU' },
    GBP: { code: 'GBP', symbol: '\u00a3', name: 'British Pound', locale: 'en-GB', flag: 'GB' },
    TRY: { code: 'TRY', symbol: '\u20ba', name: 'Turkish Lira', locale: 'tr-TR', flag: 'TR' }
  };

  // Fallback exchange rates (vs USD) — updated manually as a safety net
  var FALLBACK_RATES = {
    USD: 1,
    EUR: 0.92,
    GBP: 0.79,
    TRY: 32.50
  };

  var _config = {
    baseCurrency: 'USD',
    exchangeRateAPI: 'https://api.exchangerate-data.com/v1/latest',
    apiKey: null
  };

  var _cachedRates = null;
  var _cacheTimestamp = null;

  // ─── Init ─────────────────────────────────────────────────────────

  function init(config) {
    if (!config) return;
    if (config.baseCurrency && CURRENCIES[config.baseCurrency]) _config.baseCurrency = config.baseCurrency;
    if (config.exchangeRateAPI) _config.exchangeRateAPI = config.exchangeRateAPI;
    if (config.apiKey) _config.apiKey = config.apiKey;
    _loadCachedRates();
    _loadPrefs();
  }

  function _loadCachedRates() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY_RATES);
      if (raw) {
        var data = JSON.parse(raw);
        var age = (Date.now() - (data.timestamp || 0)) / (1000 * 60 * 60);
        if (age < RATE_CACHE_HOURS) {
          _cachedRates = data.rates;
          _cacheTimestamp = data.timestamp;
        }
      }
    } catch (e) { /* ignore */ }
  }

  function _saveCachedRates(rates) {
    _cachedRates = rates;
    _cacheTimestamp = Date.now();
    try {
      localStorage.setItem(STORAGE_KEY_RATES, JSON.stringify({
        rates: rates,
        timestamp: _cacheTimestamp
      }));
    } catch (e) { /* ignore */ }
  }

  function _loadPrefs() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY_PREFS);
      if (raw) {
        var prefs = JSON.parse(raw);
        if (prefs.baseCurrency && CURRENCIES[prefs.baseCurrency]) _config.baseCurrency = prefs.baseCurrency;
      }
    } catch (e) { /* ignore */ }
  }

  function _savePrefs() {
    try {
      localStorage.setItem(STORAGE_KEY_PREFS, JSON.stringify({ baseCurrency: _config.baseCurrency }));
    } catch (e) { /* ignore */ }
  }

  // ─── Exchange Rates ───────────────────────────────────────────────

  function getExchangeRates(baseCurrency) {
    var base = baseCurrency || _config.baseCurrency;

    // Return cached if fresh
    if (_cachedRates && _cacheTimestamp) {
      var age = (Date.now() - _cacheTimestamp) / (1000 * 60 * 60);
      if (age < RATE_CACHE_HOURS) {
        return Promise.resolve(_normalizeRates(_cachedRates, base));
      }
    }

    return _fetchRates(base).catch(function () {
      return _normalizeRates(FALLBACK_RATES, base);
    });
  }

  function _fetchRates(base) {
    var url = _config.exchangeRateAPI + '?base=' + base;
    if (_config.apiKey) url += '&apikey=' + _config.apiKey;

    return fetch(url)
      .then(function (res) {
        if (!res.ok) throw new Error('Exchange rate API failed: ' + res.status);
        return res.json();
      })
      .then(function (data) {
        var rates = data.rates || data.conversion_rates || {};
        // Ensure we have all currencies
        var normalizedRates = {};
        for (var code in CURRENCIES) {
          if (CURRENCIES.hasOwnProperty(code)) {
            normalizedRates[code] = rates[code] || FALLBACK_RATES[code] || 1;
          }
        }
        _saveCachedRates(normalizedRates);
        return _normalizeRates(normalizedRates, base);
      });
  }

  function _normalizeRates(rates, base) {
    // Convert all rates relative to the specified base currency
    var baseRate = rates[base] || 1;
    var normalized = {};
    for (var code in CURRENCIES) {
      if (CURRENCIES.hasOwnProperty(code)) {
        normalized[code] = (rates[code] || 1) / baseRate;
      }
    }
    return {
      base: base,
      rates: normalized,
      timestamp: _cacheTimestamp || Date.now(),
      source: _cachedRates ? 'cache' : 'fallback'
    };
  }

  // ─── Conversion ───────────────────────────────────────────────────

  function convert(amount, fromCurrency, toCurrency, rates) {
    if (fromCurrency === toCurrency) return Number(amount);
    if (!rates) {
      // Use fallback rates synchronously
      var fromRate = FALLBACK_RATES[fromCurrency] || 1;
      var toRate = FALLBACK_RATES[toCurrency] || 1;
      return Math.round(Number(amount) / fromRate * toRate * 100) / 100;
    }

    var rateMap = rates.rates || rates;
    var from = rateMap[fromCurrency] || 1;
    var to = rateMap[toCurrency] || 1;

    // Convert through base
    var inBase = Number(amount) / from;
    return Math.round(inBase * to * 100) / 100;
  }

  function convertAsync(amount, fromCurrency, toCurrency) {
    return getExchangeRates(fromCurrency).then(function (rateData) {
      return {
        original: { amount: Number(amount), currency: fromCurrency },
        converted: { amount: convert(amount, fromCurrency, toCurrency, rateData), currency: toCurrency },
        rate: rateData.rates[toCurrency],
        rateSource: rateData.source,
        timestamp: rateData.timestamp
      };
    });
  }

  // ─── Formatting ───────────────────────────────────────────────────

  function formatCurrency(amount, currencyCode) {
    var cur = CURRENCIES[currencyCode];
    if (!cur) return currencyCode + ' ' + Number(amount).toFixed(2);

    try {
      return new Intl.NumberFormat(cur.locale, {
        style: 'currency',
        currency: cur.code,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(amount);
    } catch (e) {
      return cur.symbol + Number(amount).toFixed(2);
    }
  }

  function formatRate(rate, fromCurrency, toCurrency) {
    return '1 ' + fromCurrency + ' = ' + Number(rate).toFixed(4) + ' ' + toCurrency;
  }

  // ─── Invoice Conversion ───────────────────────────────────────────

  function convertInvoice(invoiceData, targetCurrency) {
    return getExchangeRates(invoiceData.currency || 'USD').then(function (rateData) {
      var from = invoiceData.currency || 'USD';
      var converted = JSON.parse(JSON.stringify(invoiceData));

      converted.originalCurrency = from;
      converted.originalItems = JSON.parse(JSON.stringify(invoiceData.items));
      converted.currency = targetCurrency;
      converted.exchangeRate = rateData.rates[targetCurrency];
      converted.rateTimestamp = rateData.timestamp;

      // Convert each item
      for (var i = 0; i < converted.items.length; i++) {
        var item = converted.items[i];
        if (item.rate) item.rate = convert(item.rate, from, targetCurrency, rateData);
        if (item.amount) item.amount = convert(item.amount, from, targetCurrency, rateData);
      }

      return converted;
    });
  }

  // ─── Render: Currency Selector ────────────────────────────────────

  function renderCurrencySelector(containerId, options) {
    _injectCSS();
    var opts = options || {};
    var container = document.getElementById(containerId);
    if (!container) return;

    var current = opts.currentCurrency || _config.baseCurrency;
    var onSelect = opts.onSelect || function () {};

    var h = '<div class="imc-selector">';
    h += '<div class="imc-selector-label">Currency</div>';
    h += '<div class="imc-currency-options">';

    for (var code in CURRENCIES) {
      if (!CURRENCIES.hasOwnProperty(code)) continue;
      var cur = CURRENCIES[code];
      var active = code === current ? ' imc-cur-active' : '';
      h += '<button class="imc-cur-btn' + active + '" data-currency="' + code + '">';
      h += '<span class="imc-cur-symbol">' + cur.symbol + '</span>';
      h += '<span class="imc-cur-code">' + code + '</span>';
      h += '</button>';
    }

    h += '</div></div>';
    container.innerHTML = h;

    var btns = container.querySelectorAll('.imc-cur-btn');
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', function () {
        var currency = this.getAttribute('data-currency');
        for (var j = 0; j < btns.length; j++) btns[j].classList.remove('imc-cur-active');
        this.classList.add('imc-cur-active');
        _config.baseCurrency = currency;
        _savePrefs();
        onSelect(currency);
      });
    }
  }

  // ─── Render: Conversion Widget ────────────────────────────────────

  function renderConversionWidget(containerId, options) {
    _injectCSS();
    var opts = options || {};
    var container = document.getElementById(containerId);
    if (!container) return;

    var h = '<div class="imc-widget">';
    h += '<div class="imc-widget-header">Currency Converter</div>';
    h += '<div class="imc-widget-body">';

    // Amount input
    h += '<div class="imc-widget-row">';
    h += '<div class="imc-widget-field"><label class="imc-widget-label">Amount</label>';
    h += '<input class="imc-widget-input" id="imc-w-amount" type="number" value="' + (opts.amount || 100) + '" min="0" step="0.01"></div>';

    // From currency
    h += '<div class="imc-widget-field"><label class="imc-widget-label">From</label>';
    h += '<select class="imc-widget-select" id="imc-w-from">';
    for (var c1 in CURRENCIES) {
      if (!CURRENCIES.hasOwnProperty(c1)) continue;
      var sel1 = c1 === (opts.fromCurrency || 'USD') ? ' selected' : '';
      h += '<option value="' + c1 + '"' + sel1 + '>' + CURRENCIES[c1].symbol + ' ' + c1 + '</option>';
    }
    h += '</select></div>';

    // Swap button
    h += '<button class="imc-btn imc-btn-swap" id="imc-w-swap" title="Swap currencies">&harr;</button>';

    // To currency
    h += '<div class="imc-widget-field"><label class="imc-widget-label">To</label>';
    h += '<select class="imc-widget-select" id="imc-w-to">';
    for (var c2 in CURRENCIES) {
      if (!CURRENCIES.hasOwnProperty(c2)) continue;
      var sel2 = c2 === (opts.toCurrency || 'EUR') ? ' selected' : '';
      h += '<option value="' + c2 + '"' + sel2 + '>' + CURRENCIES[c2].symbol + ' ' + c2 + '</option>';
    }
    h += '</select></div>';
    h += '</div>';

    // Result
    h += '<div class="imc-widget-result" id="imc-w-result"></div>';
    h += '<div class="imc-widget-rate" id="imc-w-rate"></div>';

    h += '</div></div>';
    container.innerHTML = h;

    function doConvert() {
      var amount = parseFloat(container.querySelector('#imc-w-amount').value) || 0;
      var from = container.querySelector('#imc-w-from').value;
      var to = container.querySelector('#imc-w-to').value;
      var resultEl = container.querySelector('#imc-w-result');
      var rateEl = container.querySelector('#imc-w-rate');

      resultEl.textContent = 'Converting...';
      rateEl.textContent = '';

      convertAsync(amount, from, to).then(function (result) {
        resultEl.innerHTML = '<span class="imc-result-from">' + formatCurrency(amount, from) + '</span>' +
          '<span class="imc-result-arrow">=</span>' +
          '<span class="imc-result-to">' + formatCurrency(result.converted.amount, to) + '</span>';
        rateEl.textContent = formatRate(result.rate, from, to);
      });
    }

    container.querySelector('#imc-w-amount').addEventListener('input', doConvert);
    container.querySelector('#imc-w-from').addEventListener('change', doConvert);
    container.querySelector('#imc-w-to').addEventListener('change', doConvert);

    container.querySelector('#imc-w-swap').addEventListener('click', function () {
      var from = container.querySelector('#imc-w-from');
      var to = container.querySelector('#imc-w-to');
      var temp = from.value;
      from.value = to.value;
      to.value = temp;
      doConvert();
    });

    doConvert();
  }

  // ─── Render: Multi-Currency Invoice Preview ───────────────────────

  function renderMultiCurrencyPreview(containerId, invoiceData, options) {
    _injectCSS();
    var opts = options || {};
    var container = document.getElementById(containerId);
    if (!container) return;

    var sourceCurrency = invoiceData.currency || 'USD';
    var targetCurrencies = Object.keys(CURRENCIES).filter(function (c) { return c !== sourceCurrency; });

    container.innerHTML = '<div class="imc-preview"><div class="imc-preview-loading">Loading exchange rates...</div></div>';

    getExchangeRates(sourceCurrency).then(function (rateData) {
      var subtotal = 0;
      for (var i = 0; i < (invoiceData.items || []).length; i++) {
        var item = invoiceData.items[i];
        subtotal += Number(item.amount) || (Number(item.hours || 0) * Number(item.rate || 0));
      }
      var tax = subtotal * (Number(invoiceData.taxRate) || 0) / 100;
      var total = subtotal + tax;

      var h = '<div class="imc-preview">';
      h += '<div class="imc-preview-header">Multi-Currency View</div>';
      h += '<div class="imc-preview-source">';
      h += '<div class="imc-preview-amount-main">' + formatCurrency(total, sourceCurrency) + '</div>';
      h += '<div class="imc-preview-label">Invoice Total (' + sourceCurrency + ')</div>';
      h += '</div>';

      h += '<div class="imc-preview-conversions">';
      for (var j = 0; j < targetCurrencies.length; j++) {
        var target = targetCurrencies[j];
        var converted = convert(total, sourceCurrency, target, rateData);
        h += '<div class="imc-preview-conversion">';
        h += '<div class="imc-preview-amount">' + formatCurrency(converted, target) + '</div>';
        h += '<div class="imc-preview-rate">' + formatRate(rateData.rates[target], sourceCurrency, target) + '</div>';
        h += '</div>';
      }
      h += '</div>';

      // Timestamp
      var rateAge = rateData.timestamp ? new Date(rateData.timestamp).toLocaleString() : 'N/A';
      h += '<div class="imc-preview-footer">Rates as of ' + rateAge + ' (source: ' + rateData.source + ')</div>';
      h += '</div>';

      container.innerHTML = h;
    });
  }

  // ─── Utilities ────────────────────────────────────────────────────

  function getSupportedCurrencies() {
    return JSON.parse(JSON.stringify(CURRENCIES));
  }

  function setBaseCurrency(code) {
    if (CURRENCIES[code]) {
      _config.baseCurrency = code;
      _savePrefs();
    }
  }

  function getBaseCurrency() {
    return _config.baseCurrency;
  }

  // ─── CSS ──────────────────────────────────────────────────────────

  function _injectCSS() {
    if (CSS_INJECTED) return;
    CSS_INJECTED = true;
    var style = document.createElement('style');
    style.textContent = [
      '.imc-selector{background:#111;border:1px solid #222;border-radius:10px;padding:14px 18px}',
      '.imc-selector-label{font-size:12px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px}',
      '.imc-currency-options{display:flex;gap:8px;flex-wrap:wrap}',
      '.imc-cur-btn{display:flex;align-items:center;gap:6px;background:#1a1a1a;border:1px solid #333;border-radius:8px;padding:8px 14px;color:#aaa;font-size:13px;cursor:pointer;transition:all .2s}',
      '.imc-cur-btn:hover{background:#222;color:#fff;border-color:#555}',
      '.imc-cur-active{background:#7c3aed20;color:#a78bfa;border-color:#7c3aed}',
      '.imc-cur-symbol{font-weight:700;font-size:15px}',
      '.imc-cur-code{font-size:12px;color:#888}',
      '.imc-cur-active .imc-cur-code{color:#a78bfa}',
      '.imc-widget{background:#111;border:1px solid #222;border-radius:12px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}',
      '.imc-widget-header{padding:12px 18px;border-bottom:1px solid #222;background:#151515;font-size:14px;font-weight:700;color:#e0e0e0}',
      '.imc-widget-body{padding:16px 18px}',
      '.imc-widget-row{display:flex;align-items:flex-end;gap:10px;flex-wrap:wrap;margin-bottom:14px}',
      '.imc-widget-field{flex:1;min-width:100px}',
      '.imc-widget-label{display:block;font-size:11px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px}',
      '.imc-widget-input,.imc-widget-select{width:100%;background:#1a1a1a;border:1px solid #333;border-radius:6px;padding:8px 10px;color:#e0e0e0;font-size:14px;outline:none;box-sizing:border-box}',
      '.imc-widget-input:focus,.imc-widget-select:focus{border-color:#7c3aed}',
      '.imc-btn-swap{background:#222;border:1px solid #333;border-radius:6px;padding:8px 12px;color:#aaa;font-size:16px;cursor:pointer;flex-shrink:0;margin-bottom:0}',
      '.imc-btn-swap:hover{color:#fff;background:#333}',
      '.imc-widget-result{text-align:center;padding:14px 0;font-size:16px}',
      '.imc-result-from{color:#888}',
      '.imc-result-arrow{color:#555;margin:0 10px}',
      '.imc-result-to{color:#22c55e;font-weight:700;font-size:18px}',
      '.imc-widget-rate{text-align:center;font-size:12px;color:#666}',
      '.imc-preview{background:#111;border:1px solid #222;border-radius:12px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}',
      '.imc-preview-header{padding:12px 18px;border-bottom:1px solid #222;background:#151515;font-size:14px;font-weight:700;color:#e0e0e0}',
      '.imc-preview-loading{padding:20px;text-align:center;color:#888;font-size:13px}',
      '.imc-preview-source{text-align:center;padding:18px;border-bottom:1px solid #222}',
      '.imc-preview-amount-main{font-size:28px;font-weight:700;color:#e0e0e0}',
      '.imc-preview-label{font-size:12px;color:#666;margin-top:4px}',
      '.imc-preview-conversions{display:flex;flex-wrap:wrap}',
      '.imc-preview-conversion{flex:1;min-width:120px;text-align:center;padding:14px;border-right:1px solid #222;border-bottom:1px solid #222}',
      '.imc-preview-conversion:last-child{border-right:none}',
      '.imc-preview-amount{font-size:18px;font-weight:600;color:#a78bfa}',
      '.imc-preview-rate{font-size:11px;color:#666;margin-top:4px}',
      '.imc-preview-footer{padding:8px 18px;font-size:11px;color:#555;text-align:center}'
    ].join('\n');
    document.head.appendChild(style);
  }

  // ─── Public API ───────────────────────────────────────────────────

  CF.InvoiceMultiCurrency = {
    init: init,
    getExchangeRates: getExchangeRates,
    convert: convert,
    convertAsync: convertAsync,
    convertInvoice: convertInvoice,
    formatCurrency: formatCurrency,
    formatRate: formatRate,
    renderCurrencySelector: renderCurrencySelector,
    renderConversionWidget: renderConversionWidget,
    renderMultiCurrencyPreview: renderMultiCurrencyPreview,
    getSupportedCurrencies: getSupportedCurrencies,
    setBaseCurrency: setBaseCurrency,
    getBaseCurrency: getBaseCurrency,
    CURRENCIES: CURRENCIES,
    version: '1.0.0'
  };

})();
