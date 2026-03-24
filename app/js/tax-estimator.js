/**
 * [CF-047] Cortex Freelancer — Tax Estimation Engine
 * Estimate quarterly taxes for freelancers in US, UK, TR, EG.
 * Exposed on window.CortexFreelancer.TaxEstimator
 */
(function () {
  'use strict';

  /* ───────── tax brackets by country (2025/2026 approx) ───────── */

  var TAX_CONFIG = {
    US: {
      currency: 'USD',
      selfEmploymentRate: 0.1530, // 15.3% SE tax (Social Security 12.4% + Medicare 2.9%)
      seTaxableLimit: 168600,     // SS wage base 2025
      brackets: [
        { min: 0, max: 11600, rate: 0.10 },
        { min: 11600, max: 47150, rate: 0.12 },
        { min: 47150, max: 100525, rate: 0.22 },
        { min: 100525, max: 191950, rate: 0.24 },
        { min: 191950, max: 243725, rate: 0.32 },
        { min: 243725, max: 609350, rate: 0.35 },
        { min: 609350, max: Infinity, rate: 0.37 },
      ],
      standardDeduction: 14600,
    },
    UK: {
      currency: 'GBP',
      selfEmploymentRate: 0.06,  // Class 4 NIC 6% on profits 12,570–50,270
      niLower: 12570,
      niUpper: 50270,
      niRateUpper: 0.02,         // 2% above upper
      brackets: [
        { min: 0, max: 12570, rate: 0 },       // personal allowance
        { min: 12570, max: 50270, rate: 0.20 },
        { min: 50270, max: 125140, rate: 0.40 },
        { min: 125140, max: Infinity, rate: 0.45 },
      ],
      standardDeduction: 0, // personal allowance built into brackets
    },
    TR: {
      currency: 'TRY',
      selfEmploymentRate: 0,     // handled via Bagkur separately
      brackets: [
        { min: 0, max: 110000, rate: 0.15 },
        { min: 110000, max: 230000, rate: 0.20 },
        { min: 230000, max: 580000, rate: 0.27 },
        { min: 580000, max: 3000000, rate: 0.35 },
        { min: 3000000, max: Infinity, rate: 0.40 },
      ],
      standardDeduction: 0,
    },
    EG: {
      currency: 'EGP',
      selfEmploymentRate: 0,
      brackets: [
        { min: 0, max: 40000, rate: 0 },
        { min: 40000, max: 55000, rate: 0.10 },
        { min: 55000, max: 70000, rate: 0.15 },
        { min: 70000, max: 200000, rate: 0.20 },
        { min: 200000, max: 400000, rate: 0.225 },
        { min: 400000, max: 1200000, rate: 0.25 },
        { min: 1200000, max: Infinity, rate: 0.275 },
      ],
      standardDeduction: 0,
    },
  };

  /**
   * Calculate progressive income tax from brackets
   * @param {number} taxableIncome
   * @param {Array<{min,max,rate}>} brackets
   * @returns {{total: number, breakdown: Array<{bracket, rate, amount}>}}
   */
  function calcBracketTax(taxableIncome, brackets) {
    var total = 0;
    var breakdown = [];
    for (var i = 0; i < brackets.length; i++) {
      var b = brackets[i];
      if (taxableIncome <= b.min) break;
      var taxable = Math.min(taxableIncome, b.max) - b.min;
      var amount = taxable * b.rate;
      total += amount;
      if (amount > 0) {
        breakdown.push({
          bracket: b.min + '–' + (b.max === Infinity ? '+' : b.max),
          rate: b.rate,
          amount: Math.round(amount * 100) / 100,
        });
      }
    }
    return { total: Math.round(total * 100) / 100, breakdown: breakdown };
  }

  /**
   * Calculate self-employment tax
   * @param {number} income
   * @param {Object} config
   * @returns {{type: string, rate: number, amount: number}}
   */
  function calcSETax(income, config) {
    if (config.selfEmploymentRate <= 0) return null;

    var amount;
    if (config.seTaxableLimit) {
      // US: SE tax on 92.35% of net, capped at wage base for SS portion
      var seBase = income * 0.9235;
      var ssAmount = Math.min(seBase, config.seTaxableLimit) * 0.124;
      var mcAmount = seBase * 0.029;
      amount = ssAmount + mcAmount;
    } else if (config.niLower != null) {
      // UK: Class 4 NIC
      var niBase = Math.max(income - config.niLower, 0);
      var niLower = Math.min(niBase, config.niUpper - config.niLower);
      var niUpper = Math.max(income - config.niUpper, 0);
      amount = niLower * config.selfEmploymentRate + niUpper * (config.niRateUpper || 0.02);
    } else {
      amount = income * config.selfEmploymentRate;
    }

    return {
      type: 'Self-Employment Tax',
      rate: config.selfEmploymentRate,
      amount: Math.round(amount * 100) / 100,
    };
  }

  /**
   * Estimate tax for a freelancer
   * @param {number} annualIncome - gross annual income
   * @param {string} country - US, UK, TR, EG
   * @param {Array<{name: string, amount: number}>} [deductions=[]] - itemized deductions
   * @returns {Object} tax estimation result
   */
  function estimateTax(annualIncome, country, deductions) {
    country = (country || 'US').toUpperCase();
    deductions = deductions || [];
    annualIncome = Number(annualIncome) || 0;

    var config = TAX_CONFIG[country];
    if (!config) {
      return { error: 'Unsupported country: ' + country + '. Supported: US, UK, TR, EG' };
    }

    var totalDeductions = config.standardDeduction || 0;
    deductions.forEach(function (d) {
      totalDeductions += Number(d.amount) || 0;
    });

    var taxableIncome = Math.max(annualIncome - totalDeductions, 0);
    var taxResult = calcBracketTax(taxableIncome, config.brackets);
    var taxBreakdown = taxResult.breakdown.map(function (b) {
      return { type: 'Income Tax (' + b.bracket + ')', rate: b.rate, amount: b.amount };
    });

    var seTax = calcSETax(annualIncome, config);
    if (seTax) {
      taxBreakdown.unshift(seTax);
    }

    var totalTax = taxResult.total + (seTax ? seTax.amount : 0);
    var netIncome = annualIncome - totalTax;
    var effectiveRate = annualIncome > 0 ? totalTax / annualIncome : 0;

    return {
      grossIncome: annualIncome,
      deductions: totalDeductions,
      taxableIncome: taxableIncome,
      taxBreakdown: taxBreakdown,
      totalTax: Math.round(totalTax * 100) / 100,
      netIncome: Math.round(netIncome * 100) / 100,
      effectiveRate: Math.round(effectiveRate * 10000) / 10000,
      quarterlyPayment: Math.round((totalTax / 4) * 100) / 100,
      currency: config.currency,
      country: country,
    };
  }

  /* ───────── public API ───────── */

  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.TaxEstimator = {
    estimateTax: estimateTax,
    supportedCountries: Object.keys(TAX_CONFIG),
  };

})();
