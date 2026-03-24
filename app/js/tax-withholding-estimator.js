/**
 * [CF-056] Tax Withholding Estimator
 * Country-specific withholding calculations for NG, PK, DE, FR, IN, BR, PH, KE.
 * Exposed on window.CortexFreelancer.taxWithholdingEstimator
 */
(function () {
  'use strict';

  /**
   * Progressive tax brackets per country.
   * Each bracket: { min, max, rate }
   * Amounts in local currency equivalent (calculations assume USD input).
   * @type {Object<string, {name: string, currency: string, brackets: Array<{min: number, max: number, rate: number}>}>}
   */
  var COUNTRY_TAX_DATA = {
    NG: {
      name: 'Nigeria',
      currency: 'NGN',
      brackets: [
        { min: 0, max: 300000, rate: 0.07 },
        { min: 300000, max: 600000, rate: 0.11 },
        { min: 600000, max: 1100000, rate: 0.15 },
        { min: 1100000, max: 1600000, rate: 0.19 },
        { min: 1600000, max: 3200000, rate: 0.21 },
        { min: 3200000, max: Infinity, rate: 0.24 }
      ]
    },
    PK: {
      name: 'Pakistan',
      currency: 'PKR',
      brackets: [
        { min: 0, max: 600000, rate: 0.0 },
        { min: 600000, max: 1200000, rate: 0.05 },
        { min: 1200000, max: 2400000, rate: 0.10 },
        { min: 2400000, max: 3600000, rate: 0.15 },
        { min: 3600000, max: 6000000, rate: 0.20 },
        { min: 6000000, max: 12000000, rate: 0.25 },
        { min: 12000000, max: Infinity, rate: 0.30 }
      ]
    },
    DE: {
      name: 'Germany',
      currency: 'EUR',
      brackets: [
        { min: 0, max: 11604, rate: 0.0 },
        { min: 11604, max: 17005, rate: 0.14 },
        { min: 17005, max: 66760, rate: 0.24 },
        { min: 66760, max: 277826, rate: 0.42 },
        { min: 277826, max: Infinity, rate: 0.45 }
      ]
    },
    FR: {
      name: 'France',
      currency: 'EUR',
      brackets: [
        { min: 0, max: 11294, rate: 0.0 },
        { min: 11294, max: 28797, rate: 0.11 },
        { min: 28797, max: 82341, rate: 0.30 },
        { min: 82341, max: 177106, rate: 0.41 },
        { min: 177106, max: Infinity, rate: 0.45 }
      ]
    },
    IN: {
      name: 'India',
      currency: 'INR',
      brackets: [
        { min: 0, max: 300000, rate: 0.0 },
        { min: 300000, max: 700000, rate: 0.05 },
        { min: 700000, max: 1000000, rate: 0.10 },
        { min: 1000000, max: 1200000, rate: 0.15 },
        { min: 1200000, max: 1500000, rate: 0.20 },
        { min: 1500000, max: Infinity, rate: 0.30 }
      ]
    },
    BR: {
      name: 'Brazil',
      currency: 'BRL',
      brackets: [
        { min: 0, max: 26963.20, rate: 0.0 },
        { min: 26963.20, max: 33919.80, rate: 0.075 },
        { min: 33919.80, max: 45012.60, rate: 0.15 },
        { min: 45012.60, max: 55976.16, rate: 0.225 },
        { min: 55976.16, max: Infinity, rate: 0.275 }
      ]
    },
    PH: {
      name: 'Philippines',
      currency: 'PHP',
      brackets: [
        { min: 0, max: 250000, rate: 0.0 },
        { min: 250000, max: 400000, rate: 0.15 },
        { min: 400000, max: 800000, rate: 0.20 },
        { min: 800000, max: 2000000, rate: 0.25 },
        { min: 2000000, max: 8000000, rate: 0.30 },
        { min: 8000000, max: Infinity, rate: 0.35 }
      ]
    },
    KE: {
      name: 'Kenya',
      currency: 'KES',
      brackets: [
        { min: 0, max: 288000, rate: 0.10 },
        { min: 288000, max: 388000, rate: 0.25 },
        { min: 388000, max: 6000000, rate: 0.30 },
        { min: 6000000, max: 9600000, rate: 0.325 },
        { min: 9600000, max: Infinity, rate: 0.35 }
      ]
    }
  };

  /**
   * Calculate progressive tax for a given income and country brackets.
   * @param {number} income - Annual income in the country's local currency.
   * @param {Array<{min: number, max: number, rate: number}>} brackets
   * @returns {number} Total tax amount.
   */
  function calculateProgressiveTax(income, brackets) {
    var totalTax = 0;
    for (var i = 0; i < brackets.length; i++) {
      var bracket = brackets[i];
      if (income <= bracket.min) break;
      var taxableInBracket = Math.min(income, bracket.max === Infinity ? income : bracket.max) - bracket.min;
      totalTax += taxableInBracket * bracket.rate;
    }
    return Math.round(totalTax * 100) / 100;
  }

  /**
   * Estimate withholding for a given annual income (USD) and country.
   * @param {number} annualIncome - Annual income in USD.
   * @param {string} country - Two-letter country code (NG, PK, DE, FR, IN, BR, PH, KE).
   * @returns {{grossIncome: number, withholdingAmount: number, netIncome: number, effectiveRate: number, country: string, countryName: string, currency: string}|null}
   */
  function estimateWithholding(annualIncome, country) {
    var countryCode = (country || '').toUpperCase();
    var data = COUNTRY_TAX_DATA[countryCode];
    if (!data) {
      console.warn('[CF-056] Unknown country code:', country);
      return null;
    }

    var withholdingAmount = calculateProgressiveTax(annualIncome, data.brackets);
    var netIncome = Math.round((annualIncome - withholdingAmount) * 100) / 100;
    var effectiveRate = annualIncome > 0 ? Math.round((withholdingAmount / annualIncome) * 10000) / 10000 : 0;

    return {
      grossIncome: annualIncome,
      withholdingAmount: withholdingAmount,
      netIncome: netIncome,
      effectiveRate: effectiveRate,
      country: countryCode,
      countryName: data.name,
      currency: data.currency
    };
  }

  /**
   * Get a payment schedule for withholding across periods.
   * @param {number} annualIncome - Annual income in USD.
   * @param {string} country - Two-letter country code.
   * @param {'monthly'|'quarterly'|'annually'} frequency - Payment frequency.
   * @returns {{grossIncome: number, withholdingAmount: number, netIncome: number, effectiveRate: number, schedule: Array<{period: string, amount: number}>}|null}
   */
  function getWithholdingSchedule(annualIncome, country, frequency) {
    var base = estimateWithholding(annualIncome, country);
    if (!base) return null;

    var periods;
    var labels;
    var freq = (frequency || 'monthly').toLowerCase();

    if (freq === 'quarterly') {
      periods = 4;
      labels = ['Q1', 'Q2', 'Q3', 'Q4'];
    } else if (freq === 'annually') {
      periods = 1;
      labels = ['Annual'];
    } else {
      periods = 12;
      labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    }

    var perPeriod = Math.round((base.withholdingAmount / periods) * 100) / 100;
    var schedule = [];
    var distributed = 0;

    for (var i = 0; i < periods; i++) {
      var amount = (i === periods - 1)
        ? Math.round((base.withholdingAmount - distributed) * 100) / 100
        : perPeriod;
      schedule.push({ period: labels[i], amount: amount });
      distributed += amount;
    }

    return {
      grossIncome: base.grossIncome,
      withholdingAmount: base.withholdingAmount,
      netIncome: base.netIncome,
      effectiveRate: base.effectiveRate,
      country: base.country,
      countryName: base.countryName,
      currency: base.currency,
      frequency: freq,
      schedule: schedule
    };
  }

  /**
   * Get summary of all supported country tax rates.
   * @returns {Array<{code: string, name: string, currency: string, brackets: Array<{min: number, max: number, rate: number}>}>}
   */
  function getAllCountryRates() {
    var result = [];
    var codes = Object.keys(COUNTRY_TAX_DATA);
    for (var i = 0; i < codes.length; i++) {
      var code = codes[i];
      var data = COUNTRY_TAX_DATA[code];
      result.push({
        code: code,
        name: data.name,
        currency: data.currency,
        brackets: data.brackets.map(function (b) {
          return { min: b.min, max: b.max === Infinity ? null : b.max, rate: b.rate };
        })
      });
    }
    return result;
  }

  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.taxWithholdingEstimator = {
    estimateWithholding: estimateWithholding,
    getWithholdingSchedule: getWithholdingSchedule,
    getAllCountryRates: getAllCountryRates
  };
})();
