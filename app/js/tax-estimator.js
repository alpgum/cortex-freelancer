/**
 * [CF-047] Cortex Freelancer — Tax Estimation Engine
 * Estimates quarterly taxes for freelancers in US, UK, TR, EG.
 * Includes self-employment tax, income tax brackets, deductions.
 * Exposed on window.CortexFreelancer.taxEstimator
 */
(function () {
  'use strict';

  /**
   * Tax brackets by country (2025/2026 approximate rates).
   * Each bracket: { min, max, rate }
   */
  var TAX_TABLES = {
    US: {
      currency: 'USD',
      selfEmploymentRate: 0.1530, // 15.3% (SS 12.4% + Medicare 2.9%)
      selfEmploymentDeduction: 0.5, // deduct 50% of SE tax
      standardDeduction: 14600,
      brackets: [
        { min: 0, max: 11600, rate: 0.10 },
        { min: 11600, max: 47150, rate: 0.12 },
        { min: 47150, max: 100525, rate: 0.22 },
        { min: 100525, max: 191950, rate: 0.24 },
        { min: 191950, max: 243725, rate: 0.32 },
        { min: 243725, max: 609350, rate: 0.35 },
        { min: 609350, max: Infinity, rate: 0.37 }
      ]
    },
    UK: {
      currency: 'GBP',
      selfEmploymentRate: 0.09, // Class 4 NIC 9%
      selfEmploymentThreshold: 12570,
      selfEmploymentUpperLimit: 50270,
      selfEmploymentUpperRate: 0.02,
      personalAllowance: 12570,
      brackets: [
        { min: 0, max: 37700, rate: 0.20 },
        { min: 37700, max: 125140, rate: 0.40 },
        { min: 125140, max: Infinity, rate: 0.45 }
      ]
    },
    TR: {
      currency: 'TRY',
      selfEmploymentRate: 0, // handled via SGK separately
      brackets: [
        { min: 0, max: 110000, rate: 0.15 },
        { min: 110000, max: 230000, rate: 0.20 },
        { min: 230000, max: 580000, rate: 0.27 },
        { min: 580000, max: 3000000, rate: 0.35 },
        { min: 3000000, max: Infinity, rate: 0.40 }
      ]
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
        { min: 1200000, max: Infinity, rate: 0.275 }
      ]
    }
  };

  /**
   * Calculate tax through progressive brackets.
   * @param {number} taxableIncome
   * @param {Array} brackets
   * @returns {Array} [{type, rate, amount, bracketMin, bracketMax}]
   */
  function calcBrackets(taxableIncome, brackets) {
    var breakdown = [];
    var remaining = taxableIncome;

    for (var i = 0; i < brackets.length; i++) {
      var b = brackets[i];
      var bracketSize = b.max - b.min;
      var taxable = Math.min(remaining, bracketSize);
      if (taxable <= 0) break;

      breakdown.push({
        type: 'Income Tax (' + (b.rate * 100).toFixed(0) + '%)',
        rate: b.rate,
        amount: Math.round(taxable * b.rate * 100) / 100,
        bracketMin: b.min,
        bracketMax: b.max === Infinity ? null : b.max
      });
      remaining -= taxable;
    }
    return breakdown;
  }

  /**
   * Estimate tax for a freelancer.
   * @param {number} annualIncome - Gross annual income
   * @param {string} country - 'US', 'UK', 'TR', or 'EG'
   * @param {Array} [deductions=[]] - Array of {name, amount} deduction objects
   * @returns {Object} Full tax breakdown
   */
  function estimateTax(annualIncome, country, deductions) {
    annualIncome = Number(annualIncome) || 0;
    country = (country || 'US').toUpperCase();
    deductions = Array.isArray(deductions) ? deductions : [];

    var table = TAX_TABLES[country];
    if (!table) throw new Error('Unsupported country: ' + country + '. Use US, UK, TR, or EG.');

    var totalDeductions = 0;
    deductions.forEach(function (d) { totalDeductions += Number(d.amount) || 0; });

    var taxBreakdown = [];
    var selfEmploymentTax = 0;
    var selfEmploymentDeduction = 0;

    // Self-employment tax
    if (country === 'US') {
      selfEmploymentTax = annualIncome * table.selfEmploymentRate;
      selfEmploymentDeduction = selfEmploymentTax * table.selfEmploymentDeduction;
      taxBreakdown.push({
        type: 'Self-Employment Tax (15.3%)',
        rate: table.selfEmploymentRate,
        amount: Math.round(selfEmploymentTax * 100) / 100
      });
      totalDeductions += table.standardDeduction + selfEmploymentDeduction;
    } else if (country === 'UK') {
      // Class 4 NIC
      var nicIncome = Math.max(annualIncome - table.selfEmploymentThreshold, 0);
      var lowerBand = Math.min(nicIncome, table.selfEmploymentUpperLimit - table.selfEmploymentThreshold);
      var upperBand = Math.max(nicIncome - lowerBand, 0);
      selfEmploymentTax = lowerBand * table.selfEmploymentRate + upperBand * table.selfEmploymentUpperRate;
      if (selfEmploymentTax > 0) {
        taxBreakdown.push({
          type: 'Class 4 NIC',
          rate: table.selfEmploymentRate,
          amount: Math.round(selfEmploymentTax * 100) / 100
        });
      }
      totalDeductions += table.personalAllowance;
    }

    var taxableIncome = Math.max(annualIncome - totalDeductions, 0);
    var brackets = calcBrackets(taxableIncome, table.brackets);
    taxBreakdown = taxBreakdown.concat(brackets);

    var totalTax = 0;
    taxBreakdown.forEach(function (t) { totalTax += t.amount; });

    var netIncome = annualIncome - totalTax;
    var effectiveRate = annualIncome > 0 ? (totalTax / annualIncome) * 100 : 0;

    return {
      grossIncome: annualIncome,
      country: country,
      currency: table.currency,
      deductions: totalDeductions,
      taxableIncome: taxableIncome,
      taxBreakdown: taxBreakdown,
      totalTax: Math.round(totalTax * 100) / 100,
      netIncome: Math.round(netIncome * 100) / 100,
      effectiveRate: Math.round(effectiveRate * 100) / 100,
      quarterlyPayment: Math.round((totalTax / 4) * 100) / 100
    };
  }

  /* ───────── public API ───────── */

  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.taxEstimator = {
    estimateTax: estimateTax,
    supportedCountries: Object.keys(TAX_TABLES)
  };

})();
