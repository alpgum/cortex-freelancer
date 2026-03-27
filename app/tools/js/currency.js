/* ============================================
   CORTEX FREELANCER — Multi-Currency Support
   Comprehensive currency conversion & management
   ============================================ */
(function () {
  'use strict';

  var STORAGE_KEY_RATES = 'cortex_exchange_rates';
  var STORAGE_KEY_PREF = 'cortex_preferred_currency';
  var SETTINGS_KEY = 'cortex_user_settings';
  var CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours
  var API_BASE = 'https://v6.exchangerate-api.com/v6';

  // ─── Currency Registry ─────────────────────────────────────────────

  var CURRENCIES = {
    USD: { code: 'USD', symbol: '$',   name: 'US Dollar',         locale: 'en-US', flag: '\uD83C\uDDFA\uD83C\uDDF8', decimals: 2 },
    EUR: { code: 'EUR', symbol: '\u20ac', name: 'Euro',           locale: 'de-DE', flag: '\uD83C\uDDEA\uD83C\uDDFA', decimals: 2 },
    GBP: { code: 'GBP', symbol: '\u00a3', name: 'British Pound',  locale: 'en-GB', flag: '\uD83C\uDDEC\uD83C\uDDE7', decimals: 2 },
    TRY: { code: 'TRY', symbol: '\u20ba', name: 'Turkish Lira',   locale: 'tr-TR', flag: '\uD83C\uDDF9\uD83C\uDDF7', decimals: 2 },
    EGP: { code: 'EGP', symbol: 'E\u00a3', name: 'Egyptian Pound', locale: 'ar-EG', flag: '\uD83C\uDDEA\uD83C\uDDEC', decimals: 2 },
    NGN: { code: 'NGN', symbol: '\u20a6', name: 'Nigerian Naira',  locale: 'en-NG', flag: '\uD83C\uDDF3\uD83C\uDDEC', decimals: 2 },
    PKR: { code: 'PKR', symbol: '\u20a8', name: 'Pakistani Rupee', locale: 'ur-PK', flag: '\uD83C\uDDF5\uD83C\uDDF0', decimals: 2 },
    INR: { code: 'INR', symbol: '\u20b9', name: 'Indian Rupee',    locale: 'en-IN', flag: '\uD83C\uDDEE\uD83C\uDDF3', decimals: 2 },
    BRL: { code: 'BRL', symbol: 'R$',  name: 'Brazilian Real',    locale: 'pt-BR', flag: '\uD83C\uDDE7\uD83C\uDDF7', decimals: 2 },
    PHP: { code: 'PHP', symbol: '\u20b1', name: 'Philippine Peso', locale: 'en-PH', flag: '\uD83C\uDDF5\uD83C\uDDED', decimals: 2 },
    JPY: { code: 'JPY', symbol: '\u00a5', name: 'Japanese Yen',    locale: 'ja-JP', flag: '\uD83C\uDDEF\uD83C\uDDF5', decimals: 0 },
    CAD: { code: 'CAD', symbol: 'C$',  name: 'Canadian Dollar',   locale: 'en-CA', flag: '\uD83C\uDDE8\uD83C\uDDE6', decimals: 2 },
    AUD: { code: 'AUD', symbol: 'A$',  name: 'Australian Dollar', locale: 'en-AU', flag: '\uD83C\uDDE6\uD83C\uDDFA', decimals: 2 },
    CHF: { code: 'CHF', symbol: 'Fr',  name: 'Swiss Franc',       locale: 'de-CH', flag: '\uD83C\uDDE8\uD83C\uDDED', decimals: 2 },
    KES: { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling',   locale: 'en-KE', flag: '\uD83C\uDDF0\uD83C\uDDEA', decimals: 2 },
    BDT: { code: 'BDT', symbol: '\u09f3', name: 'Bangladeshi Taka', locale: 'bn-BD', flag: '\uD83C\uDDE7\uD83C\uDDE9', decimals: 2 },
    CNY: { code: 'CNY', symbol: '\u00a5', name: 'Chinese Yuan',    locale: 'zh-CN', flag: '\uD83C\uDDE8\uD83C\uDDF3', decimals: 2 },
    AED: { code: 'AED', symbol: 'AED', name: 'UAE Dirham',         locale: 'ar-AE', flag: '\uD83C\uDDE6\uD83C\uDDEA', decimals: 2 },
    SAR: { code: 'SAR', symbol: 'SAR', name: 'Saudi Riyal',        locale: 'ar-SA', flag: '\uD83C\uDDF8\uD83C\uDDE6', decimals: 2 },
    ZAR: { code: 'ZAR', symbol: 'R',   name: 'South African Rand', locale: 'en-ZA', flag: '\uD83C\uDDFF\uD83C\uDDE6', decimals: 2 }
  };

  // Fallback rates (USD base) — used when API is unavailable
  var FALLBACK_RATES = {
    USD: 1, EUR: 0.92, GBP: 0.79, TRY: 38.5, EGP: 50.5,
    NGN: 1550, PKR: 278, INR: 84, BRL: 5.1, PHP: 56,
    JPY: 154, CAD: 1.37, AUD: 1.55, CHF: 0.88, KES: 129,
    BDT: 121, CNY: 7.25, AED: 3.67, SAR: 3.75, ZAR: 18.5
  };

  // Country-to-currency auto-detect mapping
  var COUNTRY_CURRENCY = {
    US: 'USD', GB: 'GBP', DE: 'EUR', FR: 'EUR', IT: 'EUR', ES: 'EUR',
    NL: 'EUR', BE: 'EUR', AT: 'EUR', PT: 'EUR', IE: 'EUR', FI: 'EUR',
    GR: 'EUR', TR: 'TRY', EG: 'EGP', NG: 'NGN', PK: 'PKR', IN: 'INR',
    BR: 'BRL', PH: 'PHP', JP: 'JPY', CA: 'CAD', AU: 'AUD', CH: 'CHF',
    KE: 'KES', BD: 'BDT', CN: 'CNY', AE: 'AED', SA: 'SAR', ZA: 'ZAR'
  };

  // ─── Internal State ────────────────────────────────────────────────

  var _rates = null;        // { base: 'USD', rates: {...}, timestamp: ... }
  var _fetching = null;     // in-flight promise
  var _cssInjected = false;

  // ─── Rate Fetching & Caching ───────────────────────────────────────

  function _loadCachedRates() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY_RATES);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (Date.now() - (data.timestamp || 0) < CACHE_TTL_MS) {
        _rates = data;
        return data;
      }
    } catch (e) { /* corrupt cache */ }
    return null;
  }

  function _saveCachedRates(rateData) {
    _rates = rateData;
    try {
      localStorage.setItem(STORAGE_KEY_RATES, JSON.stringify(rateData));
    } catch (e) { /* quota */ }
  }

  function _getFallbackRateData() {
    return {
      base: 'USD',
      rates: Object.assign({}, FALLBACK_RATES),
      timestamp: Date.now(),
      source: 'fallback'
    };
  }

  /**
   * Fetch live exchange rates from exchangerate-api.com (free tier, no key required).
   * Falls back to hardcoded rates on failure.
   * Returns a promise of { base, rates, timestamp, source }.
   */
  function fetchRates(forceRefresh) {
    // Return cache if still fresh
    if (!forceRefresh) {
      var cached = _rates || _loadCachedRates();
      if (cached) return Promise.resolve(cached);
    }

    // Deduplicate in-flight requests
    if (_fetching) return _fetching;

    _fetching = fetch(API_BASE + '/latest/USD')
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (json) {
        if (json.result !== 'success' || !json.conversion_rates) {
          throw new Error('Unexpected API response');
        }

        var rates = {};
        var codes = Object.keys(CURRENCIES);
        for (var i = 0; i < codes.length; i++) {
          var c = codes[i];
          rates[c] = json.conversion_rates[c] || FALLBACK_RATES[c] || 1;
        }

        var rateData = {
          base: 'USD',
          rates: rates,
          timestamp: Date.now(),
          source: 'api'
        };

        _saveCachedRates(rateData);
        _fetching = null;
        return rateData;
      })
      .catch(function (err) {
        console.warn('[Currency] API fetch failed, using fallback rates:', err.message);
        _fetching = null;
        var fb = _getFallbackRateData();
        _saveCachedRates(fb);
        return fb;
      });

    return _fetching;
  }

  /**
   * Get current rates synchronously (from cache/fallback). Never null.
   */
  function getRatesSync() {
    return _rates || _loadCachedRates() || _getFallbackRateData();
  }

  // ─── Conversion ────────────────────────────────────────────────────

  /**
   * Convert amount between currencies (synchronous, uses cached/fallback rates).
   * All amounts are stored in base currency (USD) internally.
   */
  function convert(amount, from, to, rateData) {
    from = (from || 'USD').toUpperCase();
    to = (to || 'USD').toUpperCase();
    if (from === to) return Number(amount);

    var rd = rateData || getRatesSync();
    var rates = rd.rates || rd;

    var fromRate = rates[from];
    var toRate = rates[to];
    if (!fromRate || !toRate) return Number(amount);

    // Convert through USD base
    var inUSD = Number(amount) / fromRate;
    return Math.round(inUSD * toRate * 100) / 100;
  }

  /**
   * Convert with fresh rates (async).
   */
  function convertAsync(amount, from, to) {
    return fetchRates().then(function (rd) {
      var result = convert(amount, from, to, rd);
      var fromRate = rd.rates[(from || 'USD').toUpperCase()] || 1;
      var toRate = rd.rates[(to || 'USD').toUpperCase()] || 1;
      return {
        original: { amount: Number(amount), currency: from },
        converted: { amount: result, currency: to },
        rate: toRate / fromRate,
        source: rd.source,
        timestamp: rd.timestamp
      };
    });
  }

  /**
   * Convert amount to base currency (USD) for internal storage.
   */
  function toBase(amount, fromCurrency) {
    return convert(amount, fromCurrency, 'USD');
  }

  /**
   * Convert from base currency (USD) to display currency.
   */
  function fromBase(amountUSD, toCurrency) {
    return convert(amountUSD, 'USD', toCurrency);
  }

  /**
   * Get the exchange rate between two currencies.
   */
  function getRate(from, to, rateData) {
    from = (from || 'USD').toUpperCase();
    to = (to || 'USD').toUpperCase();
    if (from === to) return 1;

    var rd = rateData || getRatesSync();
    var rates = rd.rates || rd;
    var fromRate = rates[from] || 1;
    var toRate = rates[to] || 1;
    return Math.round((toRate / fromRate) * 1000000) / 1000000;
  }

  // ─── Formatting ────────────────────────────────────────────────────

  /**
   * Format amount in a specific currency using Intl.NumberFormat.
   */
  function format(amount, currencyCode, opts) {
    var code = (currencyCode || 'USD').toUpperCase();
    var cur = CURRENCIES[code];
    var options = opts || {};

    if (!cur) return code + ' ' + Number(amount).toFixed(2);

    try {
      var nfOpts = {
        style: 'currency',
        currency: code,
        minimumFractionDigits: cur.decimals,
        maximumFractionDigits: cur.decimals
      };
      if (options.compact) nfOpts.notation = 'compact';
      return new Intl.NumberFormat(cur.locale, nfOpts).format(amount);
    } catch (e) {
      return cur.symbol + Number(amount).toFixed(cur.decimals);
    }
  }

  /**
   * Format amount in user's preferred currency (auto-converts from source).
   */
  function formatInPreferred(amount, sourceCurrency) {
    var pref = getPreferred();
    var source = (sourceCurrency || 'USD').toUpperCase();
    var converted = source === pref ? Number(amount) : convert(amount, source, pref);
    return format(converted, pref);
  }

  /**
   * Format exchange rate as a readable string.
   */
  function formatRate(rate, from, to) {
    return '1 ' + from + ' = ' + Number(rate).toFixed(4) + ' ' + to;
  }

  // ─── User Preference ──────────────────────────────────────────────

  /**
   * Get user's preferred currency from settings or localStorage.
   */
  function getPreferred() {
    // Check settings first
    try {
      var settingsRaw = localStorage.getItem(SETTINGS_KEY);
      if (settingsRaw) {
        var s = JSON.parse(settingsRaw);
        if (s.currency && CURRENCIES[s.currency]) return s.currency;
      }
    } catch (e) { /* ignore */ }

    // Fall back to dedicated key
    try {
      var stored = localStorage.getItem(STORAGE_KEY_PREF);
      if (stored && CURRENCIES[stored.toUpperCase()]) return stored.toUpperCase();
    } catch (e) { /* ignore */ }

    return 'USD';
  }

  /**
   * Set user's preferred currency. Syncs to both settings and dedicated key.
   */
  function setPreferred(code) {
    var upper = (code || 'USD').toUpperCase();
    if (!CURRENCIES[upper]) return false;

    try {
      localStorage.setItem(STORAGE_KEY_PREF, upper);

      // Also sync to settings object
      var settingsRaw = localStorage.getItem(SETTINGS_KEY);
      if (settingsRaw) {
        var s = JSON.parse(settingsRaw);
        s.currency = upper;
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
      }
    } catch (e) { /* quota */ }

    // Dispatch event so other tools can react
    try {
      window.dispatchEvent(new CustomEvent('cortex:currency-changed', {
        detail: { currency: upper }
      }));
    } catch (e) { /* old browsers */ }

    return true;
  }

  /**
   * Auto-detect currency from user's country (via timezone or navigator).
   */
  function detectCurrency() {
    try {
      var tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      var tzCountryMap = {
        'America/New_York': 'US', 'America/Chicago': 'US', 'America/Denver': 'US',
        'America/Los_Angeles': 'US', 'America/Sao_Paulo': 'BR',
        'Europe/London': 'GB', 'Europe/Istanbul': 'TR',
        'Europe/Berlin': 'DE', 'Europe/Paris': 'FR',
        'Asia/Kolkata': 'IN', 'Asia/Karachi': 'PK',
        'Asia/Tokyo': 'JP', 'Asia/Shanghai': 'CN',
        'Asia/Dubai': 'AE', 'Asia/Riyadh': 'SA',
        'Africa/Cairo': 'EG', 'Africa/Lagos': 'NG',
        'Africa/Nairobi': 'KE', 'Africa/Johannesburg': 'ZA',
        'Asia/Dhaka': 'BD', 'Asia/Manila': 'PH',
        'Australia/Sydney': 'AU', 'America/Toronto': 'CA',
        'Europe/Zurich': 'CH'
      };
      var country = tzCountryMap[tz];
      if (country && COUNTRY_CURRENCY[country]) return COUNTRY_CURRENCY[country];
    } catch (e) { /* ignore */ }

    // Fallback: navigator.language
    try {
      var lang = (navigator.language || '').split('-');
      if (lang.length > 1) {
        var cc = lang[1].toUpperCase();
        if (COUNTRY_CURRENCY[cc]) return COUNTRY_CURRENCY[cc];
      }
    } catch (e) { /* ignore */ }

    return 'USD';
  }

  // ─── Currency Info ─────────────────────────────────────────────────

  function getCurrencyInfo(code) {
    return CURRENCIES[(code || '').toUpperCase()] || null;
  }

  function getSupportedCodes() {
    return Object.keys(CURRENCIES);
  }

  function getSupportedList() {
    return Object.keys(CURRENCIES).map(function (c) {
      return Object.assign({}, CURRENCIES[c]);
    });
  }

  // ─── UI: Currency Selector Dropdown ────────────────────────────────

  /**
   * Render a currency selector <select> into a container.
   * Options: { selected, onChange, id, showFlag, showName, className }
   */
  function renderSelector(containerId, options) {
    var opts = options || {};
    var container = typeof containerId === 'string'
      ? document.getElementById(containerId) : containerId;
    if (!container) return null;

    _injectCSS();

    var selected = opts.selected || getPreferred();
    var id = opts.id || 'cortex-currency-select';
    var showFlag = opts.showFlag !== false;
    var showName = opts.showName !== false;

    var html = '<div class="ctx-cur-selector">';
    html += '<label class="ctx-cur-label" for="' + id + '">Currency</label>';
    html += '<select class="ctx-cur-select' + (opts.className ? ' ' + opts.className : '') + '" id="' + id + '">';

    var codes = getSupportedCodes();
    for (var i = 0; i < codes.length; i++) {
      var c = CURRENCIES[codes[i]];
      var sel = codes[i] === selected ? ' selected' : '';
      var label = (showFlag ? c.flag + ' ' : '') + c.symbol + ' ' + c.code;
      if (showName) label += ' \u2014 ' + c.name;
      html += '<option value="' + c.code + '"' + sel + '>' + label + '</option>';
    }

    html += '</select></div>';
    container.innerHTML = html;

    var selectEl = container.querySelector('#' + id);
    if (selectEl) {
      selectEl.addEventListener('change', function () {
        var val = selectEl.value;
        if (opts.updatePreference !== false) setPreferred(val);
        if (typeof opts.onChange === 'function') opts.onChange(val);
      });
    }

    return selectEl;
  }

  // ─── UI: Inline Converter Widget ───────────────────────────────────

  /**
   * Render a currency conversion widget.
   * Options: { amount, from, to, onConvert }
   */
  function renderConverter(containerId, options) {
    var opts = options || {};
    var container = typeof containerId === 'string'
      ? document.getElementById(containerId) : containerId;
    if (!container) return;

    _injectCSS();

    var fromCur = opts.from || 'USD';
    var toCur = opts.to || getPreferred();

    var optionsHtml = function (sel) {
      return getSupportedCodes().map(function (c) {
        var cur = CURRENCIES[c];
        var s = c === sel ? ' selected' : '';
        return '<option value="' + c + '"' + s + '>' + cur.flag + ' ' + c + '</option>';
      }).join('');
    };

    var html =
      '<div class="ctx-converter">' +
        '<div class="ctx-conv-header">Currency Converter</div>' +
        '<div class="ctx-conv-body">' +
          '<div class="ctx-conv-row">' +
            '<div class="ctx-conv-field">' +
              '<label class="ctx-conv-lbl">Amount</label>' +
              '<input class="ctx-conv-input" id="ctx-conv-amt" type="number" ' +
                'value="' + (opts.amount || 100) + '" min="0" step="0.01">' +
            '</div>' +
            '<div class="ctx-conv-field">' +
              '<label class="ctx-conv-lbl">From</label>' +
              '<select class="ctx-conv-sel" id="ctx-conv-from">' + optionsHtml(fromCur) + '</select>' +
            '</div>' +
            '<button class="ctx-conv-swap" id="ctx-conv-swap" title="Swap">\u21c4</button>' +
            '<div class="ctx-conv-field">' +
              '<label class="ctx-conv-lbl">To</label>' +
              '<select class="ctx-conv-sel" id="ctx-conv-to">' + optionsHtml(toCur) + '</select>' +
            '</div>' +
          '</div>' +
          '<div class="ctx-conv-result" id="ctx-conv-result">-</div>' +
          '<div class="ctx-conv-rate" id="ctx-conv-rate"></div>' +
        '</div>' +
      '</div>';

    container.innerHTML = html;

    function doConvert() {
      var amt = parseFloat(container.querySelector('#ctx-conv-amt').value) || 0;
      var f = container.querySelector('#ctx-conv-from').value;
      var t = container.querySelector('#ctx-conv-to').value;
      var resEl = container.querySelector('#ctx-conv-result');
      var rateEl = container.querySelector('#ctx-conv-rate');

      resEl.textContent = 'Converting...';
      rateEl.textContent = '';

      convertAsync(amt, f, t).then(function (r) {
        resEl.innerHTML =
          '<span class="ctx-conv-from-val">' + format(amt, f) + '</span>' +
          '<span class="ctx-conv-eq"> = </span>' +
          '<span class="ctx-conv-to-val">' + format(r.converted.amount, t) + '</span>';
        rateEl.textContent = formatRate(r.rate, f, t) +
          (r.source === 'api' ? '' : ' (offline rate)');
        if (typeof opts.onConvert === 'function') opts.onConvert(r);
      });
    }

    container.querySelector('#ctx-conv-amt').addEventListener('input', doConvert);
    container.querySelector('#ctx-conv-from').addEventListener('change', doConvert);
    container.querySelector('#ctx-conv-to').addEventListener('change', doConvert);
    container.querySelector('#ctx-conv-swap').addEventListener('click', function () {
      var fEl = container.querySelector('#ctx-conv-from');
      var tEl = container.querySelector('#ctx-conv-to');
      var tmp = fEl.value;
      fEl.value = tEl.value;
      tEl.value = tmp;
      doConvert();
    });

    doConvert();
  }

  // ─── UI: Multi-Currency Price Display ──────────────────────────────

  /**
   * Render an amount in multiple currencies (e.g., for invoices/proposals).
   * Options: { currencies: ['EUR','GBP','TRY'], showSource }
   */
  function renderMultiPrice(containerId, amount, sourceCurrency, options) {
    var opts = options || {};
    var container = typeof containerId === 'string'
      ? document.getElementById(containerId) : containerId;
    if (!container) return;

    _injectCSS();
    var source = (sourceCurrency || 'USD').toUpperCase();
    var targets = opts.currencies || getSupportedCodes().filter(function (c) { return c !== source; }).slice(0, 5);

    container.innerHTML = '<div class="ctx-multi-price"><div class="ctx-mp-loading">Loading rates...</div></div>';

    fetchRates().then(function (rd) {
      var html = '<div class="ctx-multi-price">';

      if (opts.showSource !== false) {
        html += '<div class="ctx-mp-source">' +
          '<div class="ctx-mp-main">' + format(amount, source) + '</div>' +
          '<div class="ctx-mp-label">' + (CURRENCIES[source] ? CURRENCIES[source].name : source) + '</div>' +
          '</div>';
      }

      html += '<div class="ctx-mp-grid">';
      for (var i = 0; i < targets.length; i++) {
        var t = targets[i];
        var converted = convert(amount, source, t, rd);
        var rate = getRate(source, t, rd);
        html += '<div class="ctx-mp-item">' +
          '<div class="ctx-mp-flag">' + (CURRENCIES[t] ? CURRENCIES[t].flag : '') + '</div>' +
          '<div class="ctx-mp-amt">' + format(converted, t) + '</div>' +
          '<div class="ctx-mp-rt">1 ' + source + ' = ' + rate.toFixed(2) + ' ' + t + '</div>' +
          '</div>';
      }
      html += '</div>';

      var ageStr = rd.timestamp ? new Date(rd.timestamp).toLocaleTimeString() : 'N/A';
      html += '<div class="ctx-mp-footer">Rates as of ' + ageStr +
        (rd.source === 'api' ? '' : ' (offline)') + '</div>';
      html += '</div>';

      container.innerHTML = html;
    });
  }

  // ─── CSS Injection ─────────────────────────────────────────────────

  function _injectCSS() {
    if (_cssInjected) return;
    _cssInjected = true;

    var css = [
      /* Selector */
      '.ctx-cur-selector{display:flex;flex-direction:column;gap:4px}',
      '.ctx-cur-label{font-size:11px;font-weight:600;color:var(--text3,#888);text-transform:uppercase;letter-spacing:.5px}',
      '.ctx-cur-select{background:var(--bg3,#1a1a22);border:1px solid var(--bg4,#333);border-radius:8px;padding:8px 12px;color:var(--text,#e0e0e0);font-size:14px;outline:none;cursor:pointer;appearance:none;-webkit-appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' fill=\'%23888\'%3E%3Cpath d=\'M6 8L1 3h10z\'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 10px center}',
      '.ctx-cur-select:focus{border-color:#7c3aed}',

      /* Converter */
      '.ctx-converter{background:var(--bg2,#111);border:1px solid var(--bg4,#222);border-radius:12px;overflow:hidden}',
      '.ctx-conv-header{padding:12px 18px;border-bottom:1px solid var(--bg4,#222);font-size:14px;font-weight:700;color:var(--text,#e0e0e0)}',
      '.ctx-conv-body{padding:16px 18px}',
      '.ctx-conv-row{display:flex;align-items:flex-end;gap:10px;flex-wrap:wrap;margin-bottom:14px}',
      '.ctx-conv-field{flex:1;min-width:90px}',
      '.ctx-conv-lbl{display:block;font-size:11px;font-weight:600;color:var(--text3,#888);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px}',
      '.ctx-conv-input,.ctx-conv-sel{width:100%;background:var(--bg3,#1a1a22);border:1px solid var(--bg4,#333);border-radius:6px;padding:8px 10px;color:var(--text,#e0e0e0);font-size:14px;outline:none;box-sizing:border-box}',
      '.ctx-conv-input:focus,.ctx-conv-sel:focus{border-color:#7c3aed}',
      '.ctx-conv-swap{background:var(--bg3,#222);border:1px solid var(--bg4,#333);border-radius:6px;padding:8px 12px;color:var(--text2,#aaa);font-size:16px;cursor:pointer;flex-shrink:0}',
      '.ctx-conv-swap:hover{color:var(--text,#fff);background:var(--bg4,#333)}',
      '.ctx-conv-result{text-align:center;padding:14px 0;font-size:16px}',
      '.ctx-conv-from-val{color:var(--text2,#888)}',
      '.ctx-conv-eq{color:var(--text3,#555);margin:0 10px}',
      '.ctx-conv-to-val{color:#22c55e;font-weight:700;font-size:18px}',
      '.ctx-conv-rate{text-align:center;font-size:12px;color:var(--text3,#666)}',

      /* Multi-price */
      '.ctx-multi-price{background:var(--bg2,#111);border:1px solid var(--bg4,#222);border-radius:12px;overflow:hidden}',
      '.ctx-mp-source{text-align:center;padding:16px;border-bottom:1px solid var(--bg4,#222)}',
      '.ctx-mp-main{font-size:26px;font-weight:700;color:var(--text,#e0e0e0)}',
      '.ctx-mp-label{font-size:12px;color:var(--text3,#666);margin-top:2px}',
      '.ctx-mp-loading{padding:20px;text-align:center;color:var(--text3,#888);font-size:13px}',
      '.ctx-mp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr))}',
      '.ctx-mp-item{text-align:center;padding:14px;border-right:1px solid var(--bg4,#222);border-bottom:1px solid var(--bg4,#222)}',
      '.ctx-mp-item:last-child{border-right:none}',
      '.ctx-mp-flag{font-size:20px;margin-bottom:4px}',
      '.ctx-mp-amt{font-size:16px;font-weight:600;color:#a78bfa}',
      '.ctx-mp-rt{font-size:10px;color:var(--text3,#666);margin-top:2px}',
      '.ctx-mp-footer{padding:8px 18px;font-size:11px;color:var(--text3,#555);text-align:center}'
    ].join('\n');

    var style = document.createElement('style');
    style.setAttribute('data-ctx', 'currency');
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ─── Init: Pre-load rates on script load ───────────────────────────

  _loadCachedRates();
  if (!_rates) {
    // Attempt background fetch
    try { fetchRates(); } catch (e) { /* ignore */ }
  }

  // ─── Public API ────────────────────────────────────────────────────

  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.Currency = {
    // Core
    convert: convert,
    convertAsync: convertAsync,
    toBase: toBase,
    fromBase: fromBase,
    getRate: getRate,
    fetchRates: fetchRates,
    getRatesSync: getRatesSync,

    // Formatting
    format: format,
    formatInPreferred: formatInPreferred,
    formatRate: formatRate,

    // Preferences
    getPreferred: getPreferred,
    setPreferred: setPreferred,
    detectCurrency: detectCurrency,

    // Info
    getCurrencyInfo: getCurrencyInfo,
    getSupportedCodes: getSupportedCodes,
    getSupportedList: getSupportedList,
    CURRENCIES: CURRENCIES,
    COUNTRY_CURRENCY: COUNTRY_CURRENCY,

    // UI
    renderSelector: renderSelector,
    renderConverter: renderConverter,
    renderMultiPrice: renderMultiPrice,

    version: '1.0.0'
  };

})();
