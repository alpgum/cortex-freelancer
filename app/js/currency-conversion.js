/**
 * [CF-057] Currency Conversion for Multi-Currency Earnings
 * Auto-convert earnings to user's local currency with historical
 * exchange rates, rate trends, and multi-currency portfolio view.
 * Exposed on window.CortexFreelancer.currencyConversion
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_currency_conversion';

  /* ── Exchange Rates (mock realistic rates) ── */

  var CURRENCIES = {
    USD: { name: 'US Dollar', symbol: '$', flag: '🇺🇸' },
    EUR: { name: 'Euro', symbol: '€', flag: '🇪🇺' },
    GBP: { name: 'British Pound', symbol: '£', flag: '🇬🇧' },
    CAD: { name: 'Canadian Dollar', symbol: 'C$', flag: '🇨🇦' },
    AUD: { name: 'Australian Dollar', symbol: 'A$', flag: '🇦🇺' },
    JPY: { name: 'Japanese Yen', symbol: '¥', flag: '🇯🇵' },
    CHF: { name: 'Swiss Franc', symbol: 'CHF', flag: '🇨🇭' },
    INR: { name: 'Indian Rupee', symbol: '₹', flag: '🇮🇳' },
    BRL: { name: 'Brazilian Real', symbol: 'R$', flag: '🇧🇷' },
    TRY: { name: 'Turkish Lira', symbol: '₺', flag: '🇹🇷' }
  };

  var BASE_RATES = {
    USD: 1, EUR: 0.92, GBP: 0.79, CAD: 1.36, AUD: 1.53,
    JPY: 149.50, CHF: 0.88, INR: 83.12, BRL: 4.97, TRY: 32.45
  };

  function generateHistoricalRates() {
    var history = {};
    var codes = Object.keys(BASE_RATES);

    for (var i = 0; i < codes.length; i++) {
      var code = codes[i];
      var baseRate = BASE_RATES[code];
      var monthly = [];

      for (var m = 11; m >= 0; m--) {
        var d = new Date();
        d.setMonth(d.getMonth() - m);
        var drift = (Math.random() - 0.5) * 0.08 * baseRate;
        var noise = (Math.random() - 0.5) * 0.02 * baseRate;
        monthly.push({
          month: d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          rate: Math.round((baseRate + drift + noise) * 10000) / 10000
        });
      }

      history[code] = monthly;
    }

    return history;
  }

  /* ── Mock Earnings Data ── */

  function generateMockEarnings() {
    return [
      { id: 'E001', client: 'Acme Corp', amount: 4800, currency: 'USD', date: '2026-03-10', project: 'Dashboard Rebuild' },
      { id: 'E002', client: 'EuroTech GmbH', amount: 3500, currency: 'EUR', date: '2026-03-05', project: 'API Integration' },
      { id: 'E003', client: 'London Digital', amount: 2800, currency: 'GBP', date: '2026-02-28', project: 'Mobile App' },
      { id: 'E004', client: 'MapleSoft Inc', amount: 6200, currency: 'CAD', date: '2026-02-20', project: 'CRM System' },
      { id: 'E005', client: 'Sydney Labs', amount: 5400, currency: 'AUD', date: '2026-02-15', project: 'Data Pipeline' },
      { id: 'E006', client: 'Tokyo Systems', amount: 680000, currency: 'JPY', date: '2026-02-10', project: 'UI Redesign' },
      { id: 'E007', client: 'Zurich Finance', amount: 4200, currency: 'CHF', date: '2026-01-25', project: 'Analytics' },
      { id: 'E008', client: 'Mumbai Tech', amount: 350000, currency: 'INR', date: '2026-01-18', project: 'Backend Refactor' },
      { id: 'E009', client: 'Sao Paulo Digital', amount: 18500, currency: 'BRL', date: '2026-01-10', project: 'E-commerce' },
      { id: 'E010', client: 'Istanbul Apps', amount: 145000, currency: 'TRY', date: '2025-12-20', project: 'Mobile Game' },
      { id: 'E011', client: 'Acme Corp', amount: 5200, currency: 'USD', date: '2025-12-15', project: 'Phase 2' },
      { id: 'E012', client: 'EuroTech GmbH', amount: 4100, currency: 'EUR', date: '2025-12-01', project: 'Maintenance' }
    ];
  }

  /* ── Storage ── */

  function loadData() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore */ }
    var data = {
      earnings: generateMockEarnings(),
      historicalRates: generateHistoricalRates(),
      localCurrency: 'USD'
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return data;
  }

  /* ── Conversion Logic ── */

  function convert(amount, fromCurrency, toCurrency) {
    if (fromCurrency === toCurrency) return amount;
    var fromRate = BASE_RATES[fromCurrency] || 1;
    var toRate = BASE_RATES[toCurrency] || 1;
    var inUSD = amount / fromRate;
    return inUSD * toRate;
  }

  function fmtAmount(amount, currencyCode) {
    var info = CURRENCIES[currencyCode] || { symbol: currencyCode };
    if (Math.abs(amount) >= 1000000) return info.symbol + (amount / 1000000).toFixed(1) + 'M';
    if (Math.abs(amount) >= 1000) return info.symbol + (amount / 1000).toFixed(1) + 'K';
    return info.symbol + Math.round(amount).toLocaleString();
  }

  /* ── Analytics ── */

  function computePortfolio(earnings, localCurrency) {
    var byCurrency = {};
    var totalLocal = 0;

    for (var i = 0; i < earnings.length; i++) {
      var e = earnings[i];
      var converted = convert(e.amount, e.currency, localCurrency);
      totalLocal += converted;

      if (!byCurrency[e.currency]) {
        byCurrency[e.currency] = { original: 0, converted: 0, count: 0 };
      }
      byCurrency[e.currency].original += e.amount;
      byCurrency[e.currency].converted += converted;
      byCurrency[e.currency].count++;
    }

    var currencyBreakdown = [];
    var codes = Object.keys(byCurrency);
    for (var j = 0; j < codes.length; j++) {
      var code = codes[j];
      var info = byCurrency[code];
      currencyBreakdown.push({
        currency: code,
        name: (CURRENCIES[code] || {}).name || code,
        symbol: (CURRENCIES[code] || {}).symbol || code,
        originalTotal: Math.round(info.original),
        convertedTotal: Math.round(info.converted),
        percentage: totalLocal > 0 ? (info.converted / totalLocal) * 100 : 0,
        transactions: info.count
      });
    }

    currencyBreakdown.sort(function (a, b) { return b.convertedTotal - a.convertedTotal; });

    return {
      totalLocal: Math.round(totalLocal),
      localCurrency: localCurrency,
      breakdown: currencyBreakdown,
      uniqueCurrencies: codes.length
    };
  }

  /* ── Rendering ── */

  var CHART_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6', '#f97316'];

  function renderCurrencySelector(selected) {
    var codes = Object.keys(CURRENCIES);
    var html = '<div style="margin-bottom:20px;">';
    html += '<label style="font-size:13px;color:#94a3b8;display:block;margin-bottom:6px;">Convert all earnings to:</label>';
    html += '<div style="display:flex;gap:6px;flex-wrap:wrap;">';

    for (var i = 0; i < codes.length; i++) {
      var code = codes[i];
      var active = code === selected;
      html += '<button data-local="' + code + '" style="padding:6px 12px;border-radius:6px;border:1px solid '
        + (active ? '#6366f1' : '#334155') + ';background:' + (active ? '#6366f1' : 'transparent')
        + ';color:' + (active ? '#fff' : '#94a3b8') + ';font-size:12px;cursor:pointer;">'
        + CURRENCIES[code].symbol + ' ' + code + '</button>';
    }

    html += '</div></div>';
    return html;
  }

  function renderPortfolioSummary(portfolio) {
    var sym = (CURRENCIES[portfolio.localCurrency] || {}).symbol || '$';
    var html = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin-bottom:24px;">';

    html += '<div style="background:#1e293b;border-radius:10px;padding:18px;border-top:3px solid #6366f1;">'
      + '<div style="font-size:12px;color:#64748b;">Total Earnings</div>'
      + '<div style="font-size:26px;font-weight:700;color:#f1f5f9;">' + fmtAmount(portfolio.totalLocal, portfolio.localCurrency) + '</div>'
      + '<div style="font-size:11px;color:#475569;">In ' + portfolio.localCurrency + '</div></div>';

    html += '<div style="background:#1e293b;border-radius:10px;padding:18px;border-top:3px solid #10b981;">'
      + '<div style="font-size:12px;color:#64748b;">Currencies Used</div>'
      + '<div style="font-size:26px;font-weight:700;color:#f1f5f9;">' + portfolio.uniqueCurrencies + '</div>'
      + '<div style="font-size:11px;color:#475569;">Active currencies</div></div>';

    var topPct = portfolio.breakdown.length > 0 ? portfolio.breakdown[0].percentage.toFixed(1) : '0';
    html += '<div style="background:#1e293b;border-radius:10px;padding:18px;border-top:3px solid #f59e0b;">'
      + '<div style="font-size:12px;color:#64748b;">Primary Currency</div>'
      + '<div style="font-size:26px;font-weight:700;color:#f1f5f9;">' + (portfolio.breakdown[0] ? portfolio.breakdown[0].currency : 'N/A') + '</div>'
      + '<div style="font-size:11px;color:#475569;">' + topPct + '% of earnings</div></div>';

    html += '<div style="background:#1e293b;border-radius:10px;padding:18px;border-top:3px solid #3b82f6;">'
      + '<div style="font-size:12px;color:#64748b;">Avg per Transaction</div>'
      + '<div style="font-size:26px;font-weight:700;color:#f1f5f9;">' + fmtAmount(portfolio.totalLocal / Math.max(1, portfolio.breakdown.reduce(function (a, b) { return a + b.transactions; }, 0)), portfolio.localCurrency) + '</div>'
      + '<div style="font-size:11px;color:#475569;">Across all currencies</div></div>';

    html += '</div>';
    return html;
  }

  function renderCurrencyDistribution(portfolio) {
    var html = '<div style="background:#1e293b;border-radius:10px;padding:20px;margin-bottom:24px;">';
    html += '<h3 style="margin:0 0 16px;font-size:14px;font-weight:600;color:#94a3b8;">CURRENCY DISTRIBUTION</h3>';

    for (var i = 0; i < portfolio.breakdown.length; i++) {
      var b = portfolio.breakdown[i];
      var color = CHART_COLORS[i % CHART_COLORS.length];
      html += '<div style="margin-bottom:14px;">'
        + '<div style="display:flex;justify-content:space-between;margin-bottom:4px;">'
        + '<span style="font-size:13px;color:#e2e8f0;font-weight:500;">'
        + b.symbol + ' ' + b.currency + ' <span style="color:#64748b;font-weight:400;">(' + b.name + ')</span></span>'
        + '<span style="font-size:13px;color:#94a3b8;">'
        + fmtAmount(b.convertedTotal, portfolio.localCurrency)
        + ' (' + b.percentage.toFixed(1) + '%)</span></div>'
        + '<div style="height:8px;background:#0f172a;border-radius:4px;overflow:hidden;">'
        + '<div style="width:' + b.percentage + '%;height:100%;background:' + color + ';border-radius:4px;"></div>'
        + '</div></div>';
    }

    html += '</div>';
    return html;
  }

  function renderExchangeRates(localCurrency) {
    var codes = Object.keys(BASE_RATES);
    var html = '<div style="background:#1e293b;border-radius:10px;padding:20px;margin-bottom:24px;">';
    html += '<h3 style="margin:0 0 12px;font-size:14px;font-weight:600;color:#94a3b8;">CURRENT EXCHANGE RATES</h3>';
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;">';

    for (var i = 0; i < codes.length; i++) {
      var code = codes[i];
      if (code === localCurrency) continue;
      var rate = convert(1, code, localCurrency);
      var info = CURRENCIES[code] || {};

      html += '<div style="padding:10px;background:#0f172a;border-radius:8px;">'
        + '<div style="font-size:11px;color:#64748b;">' + (info.symbol || code) + ' ' + code + '</div>'
        + '<div style="font-size:16px;font-weight:600;color:#f1f5f9;">'
        + (CURRENCIES[localCurrency] || {}).symbol + (rate < 1 ? rate.toFixed(4) : rate.toFixed(2)) + '</div>'
        + '<div style="font-size:10px;color:#475569;">1 ' + code + ' = ' + (CURRENCIES[localCurrency] || {}).symbol + (rate < 1 ? rate.toFixed(4) : rate.toFixed(2)) + '</div>'
        + '</div>';
    }

    html += '</div></div>';
    return html;
  }

  function renderEarningsTable(earnings, localCurrency) {
    var localSym = (CURRENCIES[localCurrency] || {}).symbol || '$';
    var html = '<div style="background:#1e293b;border-radius:10px;padding:20px;">';
    html += '<h3 style="margin:0 0 12px;font-size:14px;font-weight:600;color:#94a3b8;">EARNINGS TRANSACTIONS</h3>';
    html += '<div style="overflow-x:auto;">';
    html += '<table style="width:100%;border-collapse:collapse;font-size:13px;">';
    html += '<thead><tr style="border-bottom:1px solid #334155;">'
      + '<th style="text-align:left;padding:8px;color:#64748b;font-weight:500;">Date</th>'
      + '<th style="text-align:left;padding:8px;color:#64748b;font-weight:500;">Client</th>'
      + '<th style="text-align:left;padding:8px;color:#64748b;font-weight:500;">Project</th>'
      + '<th style="text-align:right;padding:8px;color:#64748b;font-weight:500;">Original</th>'
      + '<th style="text-align:center;padding:8px;color:#64748b;font-weight:500;">Currency</th>'
      + '<th style="text-align:right;padding:8px;color:#64748b;font-weight:500;">Converted (' + localCurrency + ')</th>'
      + '</tr></thead><tbody>';

    var sorted = earnings.slice().sort(function (a, b) { return new Date(b.date) - new Date(a.date); });

    for (var i = 0; i < sorted.length; i++) {
      var e = sorted[i];
      var converted = convert(e.amount, e.currency, localCurrency);
      var origSym = (CURRENCIES[e.currency] || {}).symbol || e.currency;

      html += '<tr style="border-bottom:1px solid #1e293b44;">'
        + '<td style="padding:8px;color:#94a3b8;">' + new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + '</td>'
        + '<td style="padding:8px;color:#e2e8f0;font-weight:500;">' + e.client + '</td>'
        + '<td style="padding:8px;color:#94a3b8;">' + e.project + '</td>'
        + '<td style="padding:8px;color:#f1f5f9;text-align:right;">' + origSym + e.amount.toLocaleString() + '</td>'
        + '<td style="padding:8px;text-align:center;">'
        + '<span style="padding:2px 8px;border-radius:10px;font-size:11px;background:#334155;color:#94a3b8;">' + e.currency + '</span></td>'
        + '<td style="padding:8px;color:#10b981;text-align:right;font-weight:600;">' + localSym + Math.round(converted).toLocaleString() + '</td>'
        + '</tr>';
    }

    html += '</tbody></table></div></div>';
    return html;
  }

  function render(containerId, localCurrency) {
    var data = loadData();
    localCurrency = localCurrency || data.localCurrency || 'USD';
    var portfolio = computePortfolio(data.earnings, localCurrency);

    var html = '<div style="background:#0f172a;color:#e2e8f0;padding:24px;border-radius:12px;font-family:system-ui,-apple-system,sans-serif;">';
    html += '<div style="margin-bottom:20px;">'
      + '<h2 style="margin:0;font-size:20px;font-weight:700;color:#f1f5f9;">Currency Conversion</h2>'
      + '<p style="margin:4px 0 0;font-size:13px;color:#64748b;">Multi-currency earnings with real-time conversion</p></div>';

    html += renderCurrencySelector(localCurrency);
    html += renderPortfolioSummary(portfolio);
    html += renderCurrencyDistribution(portfolio);
    html += renderExchangeRates(localCurrency);
    html += renderEarningsTable(data.earnings, localCurrency);
    html += '</div>';

    var container = document.getElementById(containerId);
    if (container) {
      container.innerHTML = html;

      var buttons = container.querySelectorAll('[data-local]');
      for (var i = 0; i < buttons.length; i++) {
        buttons[i].addEventListener('click', function () {
          render(containerId, this.getAttribute('data-local'));
        });
      }
    }

    return html;
  }

  function init(containerId) {
    return render(containerId || 'currency-conversion');
  }

  /* ── Export ── */
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.currencyConversion = {
    init: init,
    render: render,
    convert: convert,
    loadData: loadData,
    computePortfolio: computePortfolio,
    CURRENCIES: CURRENCIES,
    BASE_RATES: BASE_RATES
  };
})();
