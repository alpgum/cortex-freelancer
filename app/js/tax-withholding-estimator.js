/**
 * [CF-056] Tax Withholding Estimator per Country
 * Country-specific tax brackets and withholding calculations for freelancers.
 * Supports US, UK, Germany, Canada, Australia, Netherlands and more.
 * Interactive UI with country selector, income input, bracket details.
 * Exposed on window.CortexFreelancer.taxWithholdingEstimator
 */
(function () {
  'use strict';

  /* ── Tax Brackets by Country ── */

  var TAX_DATA = {
    US: {
      name: 'United States',
      currency: 'USD',
      symbol: '$',
      selfEmploymentTax: 15.3,
      brackets: [
        { min: 0, max: 11600, rate: 10 },
        { min: 11600, max: 47150, rate: 12 },
        { min: 47150, max: 100525, rate: 22 },
        { min: 100525, max: 191950, rate: 24 },
        { min: 191950, max: 243725, rate: 32 },
        { min: 243725, max: 609350, rate: 35 },
        { min: 609350, max: Infinity, rate: 37 }
      ],
      deductions: { standard: 14600, businessExpense: 0.20 }
    },
    UK: {
      name: 'United Kingdom',
      currency: 'GBP',
      symbol: '\u00a3',
      selfEmploymentTax: 9,
      brackets: [
        { min: 0, max: 12570, rate: 0 },
        { min: 12570, max: 50270, rate: 20 },
        { min: 50270, max: 125140, rate: 40 },
        { min: 125140, max: Infinity, rate: 45 }
      ],
      deductions: { standard: 1000, businessExpense: 0.15 }
    },
    DE: {
      name: 'Germany',
      currency: 'EUR',
      symbol: '\u20ac',
      selfEmploymentTax: 18.6,
      brackets: [
        { min: 0, max: 11604, rate: 0 },
        { min: 11604, max: 17005, rate: 14 },
        { min: 17005, max: 66760, rate: 24 },
        { min: 66760, max: 277825, rate: 42 },
        { min: 277825, max: Infinity, rate: 45 }
      ],
      deductions: { standard: 1230, businessExpense: 0.18 }
    },
    CA: {
      name: 'Canada',
      currency: 'CAD',
      symbol: 'C$',
      selfEmploymentTax: 11.9,
      brackets: [
        { min: 0, max: 55867, rate: 15 },
        { min: 55867, max: 111733, rate: 20.5 },
        { min: 111733, max: 154906, rate: 26 },
        { min: 154906, max: 220000, rate: 29 },
        { min: 220000, max: Infinity, rate: 33 }
      ],
      deductions: { standard: 15705, businessExpense: 0.17 }
    },
    AU: {
      name: 'Australia',
      currency: 'AUD',
      symbol: 'A$',
      selfEmploymentTax: 0,
      brackets: [
        { min: 0, max: 18200, rate: 0 },
        { min: 18200, max: 45000, rate: 19 },
        { min: 45000, max: 120000, rate: 32.5 },
        { min: 120000, max: 180000, rate: 37 },
        { min: 180000, max: Infinity, rate: 45 }
      ],
      deductions: { standard: 0, businessExpense: 0.15 }
    },
    NL: {
      name: 'Netherlands',
      currency: 'EUR',
      symbol: '\u20ac',
      selfEmploymentTax: 0,
      brackets: [
        { min: 0, max: 75518, rate: 36.93 },
        { min: 75518, max: Infinity, rate: 49.5 }
      ],
      deductions: { standard: 5030, businessExpense: 0.16 }
    },
    FR: {
      name: 'France',
      currency: 'EUR',
      symbol: '\u20ac',
      selfEmploymentTax: 22,
      brackets: [
        { min: 0, max: 11294, rate: 0 },
        { min: 11294, max: 28797, rate: 11 },
        { min: 28797, max: 82341, rate: 30 },
        { min: 82341, max: 177106, rate: 41 },
        { min: 177106, max: Infinity, rate: 45 }
      ],
      deductions: { standard: 0, businessExpense: 0.34 }
    },
    IN: {
      name: 'India',
      currency: 'INR',
      symbol: '\u20b9',
      selfEmploymentTax: 0,
      brackets: [
        { min: 0, max: 300000, rate: 0 },
        { min: 300000, max: 700000, rate: 5 },
        { min: 700000, max: 1000000, rate: 10 },
        { min: 1000000, max: 1200000, rate: 15 },
        { min: 1200000, max: 1500000, rate: 20 },
        { min: 1500000, max: Infinity, rate: 30 }
      ],
      deductions: { standard: 50000, businessExpense: 0.10 }
    }
  };

  /* ── Tax Calculation ── */

  function calculateTax(income, countryCode) {
    var country = TAX_DATA[countryCode];
    if (!country) return null;

    var businessExpenses = income * country.deductions.businessExpense;
    var taxableIncome = Math.max(0, income - country.deductions.standard - businessExpenses);
    var totalIncomeTax = 0;
    var bracketDetails = [];

    for (var i = 0; i < country.brackets.length; i++) {
      var bracket = country.brackets[i];
      if (taxableIncome <= bracket.min) break;

      var taxableInBracket = Math.min(taxableIncome, bracket.max) - bracket.min;
      var taxInBracket = taxableInBracket * (bracket.rate / 100);
      totalIncomeTax += taxInBracket;

      bracketDetails.push({
        range: country.symbol + bracket.min.toLocaleString() + ' \u2013 '
          + (bracket.max === Infinity ? '+' : country.symbol + bracket.max.toLocaleString()),
        rate: bracket.rate,
        taxable: Math.round(taxableInBracket),
        tax: Math.round(taxInBracket)
      });
    }

    var selfEmploymentTax = income * (country.selfEmploymentTax / 100);
    var totalTax = totalIncomeTax + selfEmploymentTax;
    var effectiveRate = income > 0 ? (totalTax / income) * 100 : 0;
    var takeHome = income - totalTax;
    var monthlyWithholding = totalTax / 12;
    var quarterlyPayment = totalTax / 4;

    return {
      grossIncome: income,
      businessExpenses: Math.round(businessExpenses),
      standardDeduction: country.deductions.standard,
      taxableIncome: Math.round(taxableIncome),
      incomeTax: Math.round(totalIncomeTax),
      selfEmploymentTax: Math.round(selfEmploymentTax),
      totalTax: Math.round(totalTax),
      effectiveRate: effectiveRate.toFixed(1),
      takeHome: Math.round(takeHome),
      monthlyWithholding: Math.round(monthlyWithholding),
      quarterlyPayment: Math.round(quarterlyPayment),
      brackets: bracketDetails,
      country: country
    };
  }

  /* ── Rendering ── */

  function renderCountrySelector(selectedCountry) {
    var html = '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px;">';
    var codes = Object.keys(TAX_DATA);
    for (var i = 0; i < codes.length; i++) {
      var code = codes[i];
      var active = code === selectedCountry;
      html += '<button data-country="' + code + '" style="padding:8px 16px;border-radius:8px;border:1px solid '
        + (active ? '#6366f1' : '#334155') + ';background:' + (active ? '#6366f1' : 'transparent')
        + ';color:' + (active ? '#fff' : '#94a3b8') + ';font-size:13px;cursor:pointer;font-weight:' + (active ? '600' : '400') + ';">'
        + TAX_DATA[code].name + '</button>';
    }
    html += '</div>';
    return html;
  }

  function renderIncomeInput(income) {
    return '<div style="margin-bottom:20px;">'
      + '<label style="font-size:13px;color:#94a3b8;display:block;margin-bottom:6px;">Annual Gross Income</label>'
      + '<input type="number" id="tax-income-input" value="' + income + '" '
      + 'style="width:200px;padding:10px 14px;border-radius:8px;border:1px solid #334155;background:#1e293b;color:#f1f5f9;'
      + 'font-size:16px;font-weight:600;outline:none;" />'
      + '</div>';
  }

  function renderSummaryCards(result) {
    var sym = result.country.symbol;
    var cards = [
      { label: 'Total Tax', value: sym + result.totalTax.toLocaleString(), sub: 'Effective rate: ' + result.effectiveRate + '%', color: '#ef4444' },
      { label: 'Take Home', value: sym + result.takeHome.toLocaleString(), sub: sym + Math.round(result.takeHome / 12).toLocaleString() + '/month', color: '#10b981' },
      { label: 'Monthly Withholding', value: sym + result.monthlyWithholding.toLocaleString(), sub: 'Set aside each month', color: '#f59e0b' },
      { label: 'Quarterly Payment', value: sym + result.quarterlyPayment.toLocaleString(), sub: 'Estimated quarterly tax', color: '#3b82f6' }
    ];

    var html = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:24px;">';
    for (var i = 0; i < cards.length; i++) {
      var c = cards[i];
      html += '<div style="background:#1e293b;border-radius:10px;padding:18px;border-left:3px solid ' + c.color + ';">'
        + '<div style="font-size:12px;color:#64748b;margin-bottom:6px;">' + c.label + '</div>'
        + '<div style="font-size:22px;font-weight:700;color:#f1f5f9;">' + c.value + '</div>'
        + '<div style="font-size:11px;color:#475569;margin-top:4px;">' + c.sub + '</div>'
        + '</div>';
    }
    html += '</div>';
    return html;
  }

  function renderBreakdownBar(result) {
    var gross = result.grossIncome || 1;
    var segments = [
      { label: 'Take Home', value: result.takeHome, color: '#10b981' },
      { label: 'Income Tax', value: result.incomeTax, color: '#ef4444' },
      { label: 'Self-Employment Tax', value: result.selfEmploymentTax, color: '#f59e0b' }
    ];

    var html = '<div style="background:#1e293b;border-radius:10px;padding:20px;margin-bottom:24px;">';
    html += '<h3 style="margin:0 0 12px;font-size:14px;font-weight:600;color:#94a3b8;">INCOME BREAKDOWN</h3>';
    html += '<div style="display:flex;height:32px;border-radius:8px;overflow:hidden;">';

    for (var i = 0; i < segments.length; i++) {
      var s = segments[i];
      var pct = (s.value / gross) * 100;
      if (pct > 0) {
        html += '<div style="width:' + pct + '%;background:' + s.color + ';display:flex;align-items:center;justify-content:center;'
          + 'font-size:11px;font-weight:600;color:#fff;" title="' + s.label + '">'
          + (pct > 10 ? pct.toFixed(0) + '%' : '') + '</div>';
      }
    }

    html += '</div>';
    html += '<div style="display:flex;gap:16px;margin-top:8px;">';
    for (var j = 0; j < segments.length; j++) {
      var seg = segments[j];
      html += '<span style="display:flex;align-items:center;gap:4px;font-size:12px;color:#94a3b8;">'
        + '<span style="width:8px;height:8px;border-radius:50%;background:' + seg.color + ';"></span>'
        + seg.label + '</span>';
    }
    html += '</div></div>';
    return html;
  }

  function renderBracketTable(result) {
    var sym = result.country.symbol;
    var html = '<div style="background:#1e293b;border-radius:10px;padding:20px;margin-bottom:24px;">';
    html += '<h3 style="margin:0 0 12px;font-size:14px;font-weight:600;color:#94a3b8;">TAX BRACKET DETAILS</h3>';
    html += '<table style="width:100%;border-collapse:collapse;font-size:13px;">';
    html += '<thead><tr style="border-bottom:1px solid #334155;">'
      + '<th style="text-align:left;padding:8px;color:#64748b;font-weight:500;">Bracket</th>'
      + '<th style="text-align:right;padding:8px;color:#64748b;font-weight:500;">Rate</th>'
      + '<th style="text-align:right;padding:8px;color:#64748b;font-weight:500;">Taxable Amount</th>'
      + '<th style="text-align:right;padding:8px;color:#64748b;font-weight:500;">Tax</th>'
      + '</tr></thead><tbody>';

    for (var i = 0; i < result.brackets.length; i++) {
      var b = result.brackets[i];
      html += '<tr style="border-bottom:1px solid #1e293b44;">'
        + '<td style="padding:8px;color:#e2e8f0;">' + b.range + '</td>'
        + '<td style="padding:8px;color:#94a3b8;text-align:right;">' + b.rate + '%</td>'
        + '<td style="padding:8px;color:#94a3b8;text-align:right;">' + sym + b.taxable.toLocaleString() + '</td>'
        + '<td style="padding:8px;color:#ef4444;text-align:right;font-weight:600;">' + sym + b.tax.toLocaleString() + '</td>'
        + '</tr>';
    }

    if (result.selfEmploymentTax > 0) {
      html += '<tr style="border-top:1px solid #334155;">'
        + '<td style="padding:8px;color:#e2e8f0;">Self-Employment Tax</td>'
        + '<td style="padding:8px;color:#94a3b8;text-align:right;">' + result.country.selfEmploymentTax + '%</td>'
        + '<td style="padding:8px;color:#94a3b8;text-align:right;">' + sym + result.grossIncome.toLocaleString() + '</td>'
        + '<td style="padding:8px;color:#f59e0b;text-align:right;font-weight:600;">' + sym + result.selfEmploymentTax.toLocaleString() + '</td>'
        + '</tr>';
    }

    html += '</tbody></table></div>';
    return html;
  }

  function renderDeductions(result) {
    var sym = result.country.symbol;
    var html = '<div style="background:#1e293b;border-radius:10px;padding:20px;">';
    html += '<h3 style="margin:0 0 12px;font-size:14px;font-weight:600;color:#94a3b8;">DEDUCTIONS APPLIED</h3>';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">';
    html += '<div style="padding:12px;background:#0f172a;border-radius:8px;">'
      + '<div style="font-size:11px;color:#64748b;">Standard Deduction</div>'
      + '<div style="font-size:18px;font-weight:600;color:#f1f5f9;">' + sym + result.standardDeduction.toLocaleString() + '</div></div>';
    html += '<div style="padding:12px;background:#0f172a;border-radius:8px;">'
      + '<div style="font-size:11px;color:#64748b;">Business Expenses (est.)</div>'
      + '<div style="font-size:18px;font-weight:600;color:#f1f5f9;">' + sym + result.businessExpenses.toLocaleString() + '</div></div>';
    html += '<div style="padding:12px;background:#0f172a;border-radius:8px;">'
      + '<div style="font-size:11px;color:#64748b;">Taxable Income</div>'
      + '<div style="font-size:18px;font-weight:600;color:#f1f5f9;">' + sym + result.taxableIncome.toLocaleString() + '</div></div>';
    html += '</div></div>';
    return html;
  }

  function render(containerId, countryCode, income) {
    countryCode = countryCode || 'US';
    income = income || 85000;
    var result = calculateTax(income, countryCode);

    var html = '<div style="background:#0f172a;color:#e2e8f0;padding:24px;border-radius:12px;font-family:system-ui,-apple-system,sans-serif;">';
    html += '<div style="margin-bottom:20px;">'
      + '<h2 style="margin:0;font-size:20px;font-weight:700;color:#f1f5f9;">Tax Withholding Estimator</h2>'
      + '<p style="margin:4px 0 0;font-size:13px;color:#64748b;">Country-specific tax calculations for freelancers</p></div>';

    html += renderCountrySelector(countryCode);
    html += renderIncomeInput(income);
    html += renderSummaryCards(result);
    html += renderBreakdownBar(result);
    html += renderBracketTable(result);
    html += renderDeductions(result);
    html += '</div>';

    var container = document.getElementById(containerId);
    if (container) {
      container.innerHTML = html;

      var buttons = container.querySelectorAll('[data-country]');
      for (var i = 0; i < buttons.length; i++) {
        buttons[i].addEventListener('click', function () {
          var input = document.getElementById('tax-income-input');
          var currentIncome = input ? parseFloat(input.value) || 85000 : 85000;
          render(containerId, this.getAttribute('data-country'), currentIncome);
        });
      }

      var incomeInput = document.getElementById('tax-income-input');
      if (incomeInput) {
        var debounceTimer;
        incomeInput.addEventListener('input', function () {
          clearTimeout(debounceTimer);
          var val = parseFloat(this.value) || 0;
          debounceTimer = setTimeout(function () {
            render(containerId, countryCode, val);
          }, 500);
        });
      }
    }

    return html;
  }

  function init(containerId) {
    return render(containerId || 'tax-withholding-estimator', 'US', 85000);
  }

  /* ── Export ── */
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.taxWithholdingEstimator = {
    init: init,
    render: render,
    calculateTax: calculateTax,
    TAX_DATA: TAX_DATA
  };
})();
