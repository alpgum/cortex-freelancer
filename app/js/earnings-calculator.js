/**
 * [UW-018] Earnings Calculator & Tax Estimator
 * Interactive calculator showing projected earnings with taxes and fees.
 * Exposed as window.CortexEarningsCalculator
 */
(function () {
  'use strict';

  /* ── Tax rates by country (effective) ── */
  const TAX_RATES = {
    TR: { label: '🇹🇷 Turkey', rate: 0.20 },
    EG: { label: '🇪🇬 Egypt', rate: 0.15 },
    NG: { label: '🇳🇬 Nigeria', rate: 0.10 },
    PK: { label: '🇵🇰 Pakistan', rate: 0.15 },
    US: { label: '🇺🇸 United States', rate: 0.25 },
    UK: { label: '🇬🇧 United Kingdom', rate: 0.20 },
    DE: { label: '🇩🇪 Germany', rate: 0.30 },
  };

  const UPWORK_FEE_RATE = 0.10;

  /* ── Styles (dark theme, inline) ── */
  const STYLES = `
    .ec-root {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #1a1a2e;
      color: #e0e0e0;
      border-radius: 12px;
      padding: 28px 24px;
      max-width: 640px;
      margin: 0 auto;
    }
    .ec-root * { box-sizing: border-box; }
    .ec-header {
      font-size: 22px;
      font-weight: 700;
      margin: 0 0 20px;
      color: #fff;
    }

    /* Slider groups */
    .ec-slider-group { margin-bottom: 16px; }
    .ec-slider-label {
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      color: #aaa;
      margin-bottom: 4px;
    }
    .ec-slider-value {
      color: #4ecca3;
      font-weight: 600;
    }
    .ec-slider {
      -webkit-appearance: none;
      appearance: none;
      width: 100%;
      height: 6px;
      border-radius: 3px;
      background: #2d2d44;
      outline: none;
    }
    .ec-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 18px; height: 18px;
      border-radius: 50%;
      background: #4ecca3;
      cursor: pointer;
      border: 2px solid #1a1a2e;
    }
    .ec-slider::-moz-range-thumb {
      width: 18px; height: 18px;
      border-radius: 50%;
      background: #4ecca3;
      cursor: pointer;
      border: 2px solid #1a1a2e;
    }

    /* Country selector */
    .ec-country-row {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 20px;
    }
    .ec-country-label {
      font-size: 13px;
      color: #aaa;
    }
    .ec-country-select {
      background: #2d2d44;
      color: #e0e0e0;
      border: 1px solid #3d3d5c;
      border-radius: 6px;
      padding: 6px 10px;
      font-size: 14px;
      cursor: pointer;
      outline: none;
    }
    .ec-country-select:focus { border-color: #4ecca3; }

    /* Results table */
    .ec-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    .ec-table td {
      padding: 8px 0;
      font-size: 14px;
      border-bottom: 1px solid #2d2d44;
    }
    .ec-table td:last-child {
      text-align: right;
      font-variant-numeric: tabular-nums;
      font-weight: 600;
    }
    .ec-table tr.ec-highlight td {
      color: #4ecca3;
      font-size: 16px;
      font-weight: 700;
      border-bottom: none;
      padding-top: 12px;
    }
    .ec-table tr.ec-deduction td { color: #e05555; }
    .ec-table tr.ec-subtotal td { color: #ddd; font-weight: 600; }

    /* Comparison */
    .ec-comparison {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 18px;
    }
    .ec-comp-card {
      background: #2d2d44;
      border-radius: 8px;
      padding: 14px;
      text-align: center;
    }
    .ec-comp-card.ec-recommended {
      border: 1px solid #4ecca3;
      background: #1e2f3a;
    }
    .ec-comp-title {
      font-size: 12px;
      color: #888;
      margin-bottom: 6px;
    }
    .ec-comp-amount {
      font-size: 20px;
      font-weight: 700;
    }
    .ec-comp-amount.ec-green { color: #4ecca3; }
    .ec-comp-sub {
      font-size: 11px;
      color: #666;
      margin-top: 4px;
    }

    /* Insight */
    .ec-insight {
      background: #2d2d44;
      border-left: 3px solid #f0c040;
      border-radius: 0 8px 8px 0;
      padding: 12px 14px;
      font-size: 13px;
      color: #ccc;
    }
    .ec-insight strong { color: #f0c040; }
  `;

  /* ── Helpers ── */
  function fmt(n) {
    return '$' + Math.round(n).toLocaleString('en-US');
  }

  function calculate(rate, hours, weeks, countryCode) {
    const gross = rate * hours * weeks;
    const upworkFee = gross * UPWORK_FEE_RATE;
    const afterUpwork = gross - upworkFee;
    const taxRate = (TAX_RATES[countryCode] || TAX_RATES.US).rate;
    const tax = afterUpwork * taxRate;
    const net = afterUpwork - tax;
    const monthly = net / 12;
    return { gross, upworkFee, afterUpwork, taxRate, tax, net, monthly };
  }

  /* ── Renderer ── */
  function renderEarningsCalculator(profileData, container) {
    if (typeof container === 'string') {
      container = document.querySelector(container);
    }
    if (!container) {
      console.error('[EarningsCalculator] Container not found');
      return;
    }

    const defaultRate = (profileData && profileData.hourlyRate) || 25;
    const recommendedRate = (profileData && profileData.recommendedRate) || 35;
    const currentRate = (profileData && profileData.currentRate) || 15;
    const defaultCountry = (profileData && profileData.country) || 'TR';

    // Inject styles once
    if (!document.getElementById('ec-styles')) {
      const styleEl = document.createElement('style');
      styleEl.id = 'ec-styles';
      styleEl.textContent = STYLES;
      document.head.appendChild(styleEl);
    }

    const root = document.createElement('div');
    root.className = 'ec-root';
    container.appendChild(root);

    root.innerHTML = `
      <h2 class="ec-header">🧮 Earnings Calculator</h2>

      <div class="ec-slider-group">
        <div class="ec-slider-label">
          <span>Hourly Rate</span>
          <span class="ec-slider-value" id="ec-rate-val">$${defaultRate}/hr</span>
        </div>
        <input type="range" class="ec-slider" id="ec-rate" min="5" max="200" value="${defaultRate}" step="1">
      </div>

      <div class="ec-slider-group">
        <div class="ec-slider-label">
          <span>Hours per Week</span>
          <span class="ec-slider-value" id="ec-hours-val">30 hrs</span>
        </div>
        <input type="range" class="ec-slider" id="ec-hours" min="5" max="60" value="30" step="1">
      </div>

      <div class="ec-slider-group">
        <div class="ec-slider-label">
          <span>Weeks per Year</span>
          <span class="ec-slider-value" id="ec-weeks-val">48 wks</span>
        </div>
        <input type="range" class="ec-slider" id="ec-weeks" min="40" max="52" value="48" step="1">
      </div>

      <div class="ec-country-row">
        <span class="ec-country-label">Tax Region</span>
        <select class="ec-country-select" id="ec-country">
          ${Object.entries(TAX_RATES)
            .map(([code, { label }]) =>
              `<option value="${code}"${code === defaultCountry ? ' selected' : ''}>${label}</option>`
            )
            .join('')}
        </select>
      </div>

      <table class="ec-table" id="ec-results"></table>

      <div class="ec-comparison" id="ec-comparison"></div>

      <div class="ec-insight" id="ec-insight"></div>
    `;

    const els = {
      rate: root.querySelector('#ec-rate'),
      hours: root.querySelector('#ec-hours'),
      weeks: root.querySelector('#ec-weeks'),
      country: root.querySelector('#ec-country'),
      rateVal: root.querySelector('#ec-rate-val'),
      hoursVal: root.querySelector('#ec-hours-val'),
      weeksVal: root.querySelector('#ec-weeks-val'),
      results: root.querySelector('#ec-results'),
      comparison: root.querySelector('#ec-comparison'),
      insight: root.querySelector('#ec-insight'),
    };

    function update() {
      const rate = +els.rate.value;
      const hours = +els.hours.value;
      const weeks = +els.weeks.value;
      const country = els.country.value;

      els.rateVal.textContent = `$${rate}/hr`;
      els.hoursVal.textContent = `${hours} hrs`;
      els.weeksVal.textContent = `${weeks} wks`;

      const r = calculate(rate, hours, weeks, country);
      const taxLabel = TAX_RATES[country].label;
      const taxPct = Math.round(r.taxRate * 100);

      els.results.innerHTML = `
        <tr>
          <td>💰 Gross Annual</td>
          <td>${fmt(r.gross)}</td>
        </tr>
        <tr class="ec-deduction">
          <td>📉 Upwork Fee (10%)</td>
          <td>-${fmt(r.upworkFee)}</td>
        </tr>
        <tr class="ec-subtotal">
          <td>After Upwork</td>
          <td>${fmt(r.afterUpwork)}</td>
        </tr>
        <tr class="ec-deduction">
          <td>🏛️ Tax — ${taxLabel} (${taxPct}%)</td>
          <td>-${fmt(r.tax)}</td>
        </tr>
        <tr class="ec-highlight">
          <td>✅ Net Take-Home</td>
          <td>${fmt(r.net)}/yr</td>
        </tr>
        <tr class="ec-highlight">
          <td>📅 Monthly Net</td>
          <td>${fmt(r.monthly)}/mo</td>
        </tr>
      `;

      // Comparison: current vs recommended
      const cur = calculate(currentRate, hours, weeks, country);
      const rec = calculate(recommendedRate, hours, weeks, country);

      els.comparison.innerHTML = `
        <div class="ec-comp-card">
          <div class="ec-comp-title">Current Rate ($${currentRate}/hr)</div>
          <div class="ec-comp-amount">${fmt(cur.net)}<span class="ec-comp-sub">/yr</span></div>
          <div class="ec-comp-sub">${fmt(cur.monthly)}/mo</div>
        </div>
        <div class="ec-comp-card ec-recommended">
          <div class="ec-comp-title">Recommended ($${recommendedRate}/hr)</div>
          <div class="ec-comp-amount ec-green">${fmt(rec.net)}<span class="ec-comp-sub">/yr</span></div>
          <div class="ec-comp-sub">${fmt(rec.monthly)}/mo</div>
        </div>
      `;

      // Insight: +5 hours/week
      const extra = calculate(rate, hours + 5, weeks, country);
      const diff = extra.net - r.net;
      els.insight.innerHTML = `<strong>💡 Insight:</strong> Working 5 more hours/week adds <strong>${fmt(diff)}/year</strong> to your income`;
    }

    ['input', 'change'].forEach(function (evt) {
      els.rate.addEventListener(evt, update);
      els.hours.addEventListener(evt, update);
      els.weeks.addEventListener(evt, update);
      els.country.addEventListener(evt, update);
    });

    update();

    return { update, calculate, root };
  }

  /* ── Public API ── */
  window.CortexEarningsCalculator = {
    render: renderEarningsCalculator,
    calculate: calculate,
    TAX_RATES: TAX_RATES,
    UPWORK_FEE_RATE: UPWORK_FEE_RATE,
  };
})();
