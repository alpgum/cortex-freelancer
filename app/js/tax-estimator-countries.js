/**
 * [CF-056] Tax Withholding Estimator per Country
 * Extends the base tax estimator with country-specific tax brackets,
 * withholding schedules, social security contributions, and VAT/GST rates.
 * Supports 15+ countries with quarterly/monthly withholding calculations.
 * Exposed on window.CortexFreelancer.taxEstimatorCountries
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_tax_estimator_country';

  /**
   * Country tax data with brackets (rates as percentages),
   * social contributions, VAT/GST, and freelancer-specific rules.
   */
  var COUNTRY_TAX_DATA = {
    US: {
      name: 'United States',
      currency: 'USD',
      symbol: '$',
      selfEmploymentRate: 15.3,
      brackets: [
        { min: 0, max: 11600, rate: 10 },
        { min: 11600, max: 47150, rate: 12 },
        { min: 47150, max: 100525, rate: 22 },
        { min: 100525, max: 191950, rate: 24 },
        { min: 191950, max: 243725, rate: 32 },
        { min: 243725, max: 609350, rate: 35 },
        { min: 609350, max: Infinity, rate: 37 }
      ],
      standardDeduction: 14600,
      withholdingSchedule: 'quarterly',
      vatRate: 0,
      notes: 'Estimated quarterly payments due Apr 15, Jun 15, Sep 15, Jan 15.'
    },
    UK: {
      name: 'United Kingdom',
      currency: 'GBP',
      symbol: '\u00a3',
      selfEmploymentRate: 9,
      selfEmploymentUpperRate: 2,
      selfEmploymentThreshold: 12570,
      selfEmploymentUpperLimit: 50270,
      brackets: [
        { min: 0, max: 12570, rate: 0 },
        { min: 12570, max: 50270, rate: 20 },
        { min: 50270, max: 125140, rate: 40 },
        { min: 125140, max: Infinity, rate: 45 }
      ],
      standardDeduction: 1000,
      withholdingSchedule: 'biannual',
      vatRate: 20,
      vatThreshold: 90000,
      notes: 'Payment on account: two installments Jan 31 and Jul 31. VAT registration required above threshold.'
    },
    DE: {
      name: 'Germany',
      currency: 'EUR',
      symbol: '\u20ac',
      selfEmploymentRate: 18.6,
      brackets: [
        { min: 0, max: 11604, rate: 0 },
        { min: 11604, max: 17005, rate: 14 },
        { min: 17005, max: 66760, rate: 24 },
        { min: 66760, max: 277825, rate: 42 },
        { min: 277825, max: Infinity, rate: 45 }
      ],
      standardDeduction: 1230,
      withholdingSchedule: 'quarterly',
      vatRate: 19,
      vatThreshold: 22000,
      solidaritySurcharge: 5.5,
      notes: 'Solidarity surcharge of 5.5% on income tax. Kleinunternehmer exemption below VAT threshold.'
    },
    CA: {
      name: 'Canada',
      currency: 'CAD',
      symbol: 'C$',
      selfEmploymentRate: 11.9,
      brackets: [
        { min: 0, max: 55867, rate: 15 },
        { min: 55867, max: 111733, rate: 20.5 },
        { min: 111733, max: 154906, rate: 26 },
        { min: 154906, max: 220000, rate: 29 },
        { min: 220000, max: Infinity, rate: 33 }
      ],
      standardDeduction: 15705,
      withholdingSchedule: 'quarterly',
      vatRate: 5,
      vatThreshold: 30000,
      notes: 'CPP contributions required. GST/HST registration above $30K threshold.'
    },
    AU: {
      name: 'Australia',
      currency: 'AUD',
      symbol: 'A$',
      selfEmploymentRate: 0,
      brackets: [
        { min: 0, max: 18200, rate: 0 },
        { min: 18200, max: 45000, rate: 19 },
        { min: 45000, max: 120000, rate: 32.5 },
        { min: 120000, max: 180000, rate: 37 },
        { min: 180000, max: Infinity, rate: 45 }
      ],
      standardDeduction: 0,
      withholdingSchedule: 'quarterly',
      vatRate: 10,
      vatThreshold: 75000,
      medicareLevy: 2,
      notes: 'Medicare levy of 2% applies. GST registration required above $75K. BAS lodgement quarterly.'
    },
    NL: {
      name: 'Netherlands',
      currency: 'EUR',
      symbol: '\u20ac',
      selfEmploymentRate: 0,
      brackets: [
        { min: 0, max: 75518, rate: 36.93 },
        { min: 75518, max: Infinity, rate: 49.5 }
      ],
      standardDeduction: 5030,
      selfEmployedDeduction: 3750,
      withholdingSchedule: 'monthly',
      vatRate: 21,
      vatThreshold: 20000,
      notes: 'ZZP self-employed deduction applies. MKB profit exemption of 14% on remaining profit.'
    },
    FR: {
      name: 'France',
      currency: 'EUR',
      symbol: '\u20ac',
      selfEmploymentRate: 22,
      brackets: [
        { min: 0, max: 11294, rate: 0 },
        { min: 11294, max: 28797, rate: 11 },
        { min: 28797, max: 82341, rate: 30 },
        { min: 82341, max: 177106, rate: 41 },
        { min: 177106, max: Infinity, rate: 45 }
      ],
      standardDeduction: 0,
      businessExpenseRate: 34,
      withholdingSchedule: 'monthly',
      vatRate: 20,
      vatThreshold: 36800,
      notes: 'Micro-entrepreneur regime: 34% flat expense deduction for services. Cotisations sociales ~22%.'
    },
    IN: {
      name: 'India',
      currency: 'INR',
      symbol: '\u20b9',
      selfEmploymentRate: 0,
      brackets: [
        { min: 0, max: 300000, rate: 0 },
        { min: 300000, max: 700000, rate: 5 },
        { min: 700000, max: 1000000, rate: 10 },
        { min: 1000000, max: 1200000, rate: 15 },
        { min: 1200000, max: 1500000, rate: 20 },
        { min: 1500000, max: Infinity, rate: 30 }
      ],
      standardDeduction: 50000,
      withholdingSchedule: 'quarterly',
      vatRate: 18,
      cess: 4,
      notes: 'New tax regime. 4% health & education cess on total tax. Advance tax in 4 quarterly installments.'
    },
    TR: {
      name: 'Turkey',
      currency: 'TRY',
      symbol: '\u20ba',
      selfEmploymentRate: 0,
      sgkContribution: 34.5,
      brackets: [
        { min: 0, max: 110000, rate: 15 },
        { min: 110000, max: 230000, rate: 20 },
        { min: 230000, max: 580000, rate: 27 },
        { min: 580000, max: 3000000, rate: 35 },
        { min: 3000000, max: Infinity, rate: 40 }
      ],
      standardDeduction: 0,
      withholdingSchedule: 'quarterly',
      vatRate: 20,
      notes: 'SGK (social security) contributions handled separately. Geçici vergi (provisional tax) quarterly.'
    },
    EG: {
      name: 'Egypt',
      currency: 'EGP',
      symbol: 'E\u00a3',
      selfEmploymentRate: 0,
      brackets: [
        { min: 0, max: 40000, rate: 0 },
        { min: 40000, max: 55000, rate: 10 },
        { min: 55000, max: 70000, rate: 15 },
        { min: 70000, max: 200000, rate: 20 },
        { min: 200000, max: 400000, rate: 22.5 },
        { min: 400000, max: 1200000, rate: 25 },
        { min: 1200000, max: Infinity, rate: 27.5 }
      ],
      standardDeduction: 20000,
      withholdingSchedule: 'annual',
      vatRate: 14,
      notes: 'Personal exemption of EGP 20,000. Annual tax return due by March 31.'
    },
    BR: {
      name: 'Brazil',
      currency: 'BRL',
      symbol: 'R$',
      selfEmploymentRate: 20,
      brackets: [
        { min: 0, max: 26400, rate: 0 },
        { min: 26400, max: 33919, rate: 7.5 },
        { min: 33919, max: 45012, rate: 15 },
        { min: 45012, max: 55976, rate: 22.5 },
        { min: 55976, max: Infinity, rate: 27.5 }
      ],
      standardDeduction: 2112,
      withholdingSchedule: 'monthly',
      vatRate: 0,
      notes: 'Carnê-leão monthly tax. INSS contribution capped. Simples Nacional may apply for MEI.'
    },
    JP: {
      name: 'Japan',
      currency: 'JPY',
      symbol: '\u00a5',
      selfEmploymentRate: 0,
      nationalHealthInsurance: 10,
      brackets: [
        { min: 0, max: 1950000, rate: 5 },
        { min: 1950000, max: 3300000, rate: 10 },
        { min: 3300000, max: 6950000, rate: 20 },
        { min: 6950000, max: 9000000, rate: 23 },
        { min: 9000000, max: 18000000, rate: 33 },
        { min: 18000000, max: 40000000, rate: 40 },
        { min: 40000000, max: Infinity, rate: 45 }
      ],
      standardDeduction: 480000,
      withholdingSchedule: 'biannual',
      vatRate: 10,
      vatThreshold: 10000000,
      notes: 'Prefectural and municipal taxes ~10% additional. Consumption tax for revenue above ¥10M.'
    },
    NG: {
      name: 'Nigeria',
      currency: 'NGN',
      symbol: '\u20a6',
      selfEmploymentRate: 0,
      brackets: [
        { min: 0, max: 300000, rate: 7 },
        { min: 300000, max: 600000, rate: 11 },
        { min: 600000, max: 1100000, rate: 15 },
        { min: 1100000, max: 1600000, rate: 19 },
        { min: 1600000, max: 3200000, rate: 21 },
        { min: 3200000, max: Infinity, rate: 24 }
      ],
      standardDeduction: 200000,
      withholdingSchedule: 'annual',
      vatRate: 7.5,
      notes: 'Consolidated relief allowance: higher of NGN 200K or 1% of gross + 20% of gross.'
    },
    PK: {
      name: 'Pakistan',
      currency: 'PKR',
      symbol: 'Rs',
      selfEmploymentRate: 0,
      brackets: [
        { min: 0, max: 600000, rate: 0 },
        { min: 600000, max: 1200000, rate: 5 },
        { min: 1200000, max: 2400000, rate: 15 },
        { min: 2400000, max: 3600000, rate: 25 },
        { min: 3600000, max: 6000000, rate: 30 },
        { min: 6000000, max: Infinity, rate: 35 }
      ],
      standardDeduction: 0,
      withholdingSchedule: 'quarterly',
      vatRate: 18,
      notes: 'Advance tax in quarterly installments. Additional surcharges may apply for high earners.'
    },
    KE: {
      name: 'Kenya',
      currency: 'KES',
      symbol: 'KSh',
      selfEmploymentRate: 0,
      brackets: [
        { min: 0, max: 288000, rate: 10 },
        { min: 288000, max: 388000, rate: 25 },
        { min: 388000, max: 6000000, rate: 30 },
        { min: 6000000, max: 9600000, rate: 32.5 },
        { min: 9600000, max: Infinity, rate: 35 }
      ],
      standardDeduction: 28800,
      withholdingSchedule: 'monthly',
      vatRate: 16,
      vatThreshold: 5000000,
      notes: 'Personal relief of KSh 28,800/year. Instalment tax for estimated tax above KSh 40K.'
    }
  };

  /**
   * Calculate progressive income tax through brackets.
   * @param {number} taxableIncome
   * @param {Array} brackets - Each: { min, max, rate (percentage) }
   * @returns {{ total: number, details: Array }}
   */
  function calculateBracketTax(taxableIncome, brackets) {
    var total = 0;
    var details = [];

    for (var i = 0; i < brackets.length; i++) {
      var b = brackets[i];
      if (taxableIncome <= b.min) break;

      var taxableInBracket = Math.min(taxableIncome, b.max === Infinity ? taxableIncome : b.max) - b.min;
      var taxInBracket = taxableInBracket * (b.rate / 100);
      total += taxInBracket;

      details.push({
        bracketMin: b.min,
        bracketMax: b.max === Infinity ? null : b.max,
        rate: b.rate,
        taxableAmount: Math.round(taxableInBracket),
        tax: Math.round(taxInBracket * 100) / 100
      });
    }

    return { total: Math.round(total * 100) / 100, details: details };
  }

  /**
   * Calculate self-employment / social security tax for a country.
   * @param {number} grossIncome
   * @param {Object} country
   * @returns {{ amount: number, label: string }}
   */
  function calculateSelfEmploymentTax(grossIncome, country) {
    if (country.selfEmploymentRate > 0) {
      // Special UK NIC calculation
      if (country.selfEmploymentThreshold !== undefined) {
        var nicIncome = Math.max(grossIncome - country.selfEmploymentThreshold, 0);
        var upperLimit = country.selfEmploymentUpperLimit || Infinity;
        var lowerBand = Math.min(nicIncome, upperLimit - country.selfEmploymentThreshold);
        var upperBand = Math.max(nicIncome - lowerBand, 0);
        var nicTax = lowerBand * (country.selfEmploymentRate / 100);
        if (country.selfEmploymentUpperRate) {
          nicTax += upperBand * (country.selfEmploymentUpperRate / 100);
        }
        return { amount: Math.round(nicTax * 100) / 100, label: 'National Insurance (Class 4)' };
      }
      return {
        amount: Math.round(grossIncome * (country.selfEmploymentRate / 100) * 100) / 100,
        label: 'Self-Employment / Social Security'
      };
    }

    // Country-specific contributions
    if (country.sgkContribution) {
      return {
        amount: Math.round(grossIncome * (country.sgkContribution / 100) * 100) / 100,
        label: 'SGK Social Security'
      };
    }
    if (country.nationalHealthInsurance) {
      return {
        amount: Math.round(grossIncome * (country.nationalHealthInsurance / 100) * 100) / 100,
        label: 'National Health Insurance'
      };
    }

    return { amount: 0, label: '' };
  }

  /**
   * Full tax estimate for a freelancer in a given country.
   * @param {number} annualGrossIncome
   * @param {string} countryCode
   * @param {Object} [options]
   * @param {number} [options.businessExpenses=0]
   * @param {Array}  [options.additionalDeductions=[]]
   * @returns {Object} Detailed tax breakdown
   */
  function estimateWithholding(annualGrossIncome, countryCode, options) {
    var income = Number(annualGrossIncome) || 0;
    var code = (countryCode || 'US').toUpperCase();
    var opts = options || {};
    var businessExpenses = Number(opts.businessExpenses) || 0;
    var additionalDeductions = opts.additionalDeductions || [];

    var country = COUNTRY_TAX_DATA[code];
    if (!country) {
      return { error: 'Unsupported country: ' + code + '. Supported: ' + Object.keys(COUNTRY_TAX_DATA).join(', ') };
    }

    // Deductions
    var totalDeductions = country.standardDeduction + businessExpenses;
    if (country.selfEmployedDeduction) {
      totalDeductions += country.selfEmployedDeduction;
    }
    if (country.businessExpenseRate && businessExpenses === 0) {
      totalDeductions += income * (country.businessExpenseRate / 100);
    }
    for (var d = 0; d < additionalDeductions.length; d++) {
      totalDeductions += Number(additionalDeductions[d].amount) || 0;
    }

    var taxableIncome = Math.max(income - totalDeductions, 0);

    // Income tax
    var incomeTax = calculateBracketTax(taxableIncome, country.brackets);

    // Additional taxes
    var additionalTaxes = [];

    // Solidarity surcharge (Germany)
    if (country.solidaritySurcharge) {
      var soli = Math.round(incomeTax.total * (country.solidaritySurcharge / 100) * 100) / 100;
      additionalTaxes.push({ label: 'Solidarity Surcharge', rate: country.solidaritySurcharge, amount: soli });
    }

    // Medicare levy (Australia)
    if (country.medicareLevy) {
      var medicare = Math.round(taxableIncome * (country.medicareLevy / 100) * 100) / 100;
      additionalTaxes.push({ label: 'Medicare Levy', rate: country.medicareLevy, amount: medicare });
    }

    // Health & Education Cess (India)
    if (country.cess) {
      var cessAmount = Math.round(incomeTax.total * (country.cess / 100) * 100) / 100;
      additionalTaxes.push({ label: 'Health & Education Cess', rate: country.cess, amount: cessAmount });
    }

    // Self-employment / social security
    var seTax = calculateSelfEmploymentTax(income, country);

    // Totals
    var additionalTotal = 0;
    for (var a = 0; a < additionalTaxes.length; a++) {
      additionalTotal += additionalTaxes[a].amount;
    }

    var totalTax = incomeTax.total + seTax.amount + additionalTotal;
    var effectiveRate = income > 0 ? (totalTax / income) * 100 : 0;
    var netIncome = income - totalTax;

    // Withholding schedule
    var schedule = country.withholdingSchedule || 'quarterly';
    var periods;
    switch (schedule) {
      case 'monthly': periods = 12; break;
      case 'biannual': periods = 2; break;
      case 'annual': periods = 1; break;
      default: periods = 4; break;
    }
    var perPeriod = Math.round((totalTax / periods) * 100) / 100;

    // VAT estimate
    var vatApplies = country.vatRate > 0;
    var vatThresholdExceeded = !country.vatThreshold || income > country.vatThreshold;
    var estimatedVAT = vatApplies && vatThresholdExceeded
      ? Math.round(income * (country.vatRate / 100) * 100) / 100
      : 0;

    return {
      country: code,
      countryName: country.name,
      currency: country.currency,
      symbol: country.symbol,
      grossIncome: income,
      deductions: {
        standard: country.standardDeduction,
        business: businessExpenses || (country.businessExpenseRate ? Math.round(income * (country.businessExpenseRate / 100)) : 0),
        selfEmployed: country.selfEmployedDeduction || 0,
        additional: additionalDeductions,
        total: Math.round(totalDeductions)
      },
      taxableIncome: Math.round(taxableIncome),
      incomeTax: {
        total: incomeTax.total,
        brackets: incomeTax.details
      },
      selfEmploymentTax: {
        label: seTax.label,
        amount: seTax.amount,
        rate: country.selfEmploymentRate || country.sgkContribution || country.nationalHealthInsurance || 0
      },
      additionalTaxes: additionalTaxes,
      totalTax: Math.round(totalTax * 100) / 100,
      effectiveRate: Math.round(effectiveRate * 100) / 100,
      netIncome: Math.round(netIncome * 100) / 100,
      withholding: {
        schedule: schedule,
        periods: periods,
        perPeriod: perPeriod,
        monthly: Math.round((totalTax / 12) * 100) / 100,
        quarterly: Math.round((totalTax / 4) * 100) / 100,
        weekly: Math.round((totalTax / 52) * 100) / 100
      },
      vat: {
        rate: country.vatRate,
        threshold: country.vatThreshold || null,
        applies: vatApplies && vatThresholdExceeded,
        estimatedAmount: estimatedVAT
      },
      notes: country.notes || ''
    };
  }

  /**
   * Compare tax across multiple countries for the same income.
   * @param {number} income - Annual gross income in USD.
   * @param {string[]} [countries] - Country codes to compare. Defaults to all.
   * @returns {Array} Sorted by effective rate ascending.
   */
  function compareCountries(income, countries) {
    var codes = countries || Object.keys(COUNTRY_TAX_DATA);
    var results = [];

    for (var i = 0; i < codes.length; i++) {
      var est = estimateWithholding(income, codes[i]);
      if (!est.error) {
        results.push({
          country: est.country,
          countryName: est.countryName,
          currency: est.currency,
          symbol: est.symbol,
          totalTax: est.totalTax,
          effectiveRate: est.effectiveRate,
          netIncome: est.netIncome,
          withholdingSchedule: est.withholding.schedule,
          perPeriod: est.withholding.perPeriod,
          vatRate: est.vat.rate
        });
      }
    }

    results.sort(function (a, b) { return a.effectiveRate - b.effectiveRate; });
    return results;
  }

  /**
   * Get supported countries list.
   * @returns {Array<{code: string, name: string, currency: string}>}
   */
  function getSupportedCountries() {
    var codes = Object.keys(COUNTRY_TAX_DATA);
    return codes.map(function (code) {
      var c = COUNTRY_TAX_DATA[code];
      return { code: code, name: c.name, currency: c.currency, symbol: c.symbol };
    });
  }

  /**
   * Save user's country preference.
   * @param {string} countryCode
   */
  function setPreferredCountry(countryCode) {
    var code = (countryCode || '').toUpperCase();
    if (!COUNTRY_TAX_DATA[code]) return false;
    try {
      localStorage.setItem(STORAGE_KEY, code);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Get user's saved country preference.
   * @returns {string}
   */
  function getPreferredCountry() {
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      if (stored && COUNTRY_TAX_DATA[stored.toUpperCase()]) return stored.toUpperCase();
    } catch (e) { /* ignore */ }
    return 'US';
  }

  /**
   * Generate a withholding calendar for the year.
   * @param {number} totalTax
   * @param {string} countryCode
   * @returns {Array<{label: string, dueDate: string, amount: number}>}
   */
  function getWithholdingCalendar(totalTax, countryCode) {
    var country = COUNTRY_TAX_DATA[(countryCode || '').toUpperCase()];
    if (!country) return [];

    var year = new Date().getFullYear();
    var schedule = country.withholdingSchedule || 'quarterly';
    var calendar = [];

    if (schedule === 'quarterly') {
      var quarterlyAmount = Math.round((totalTax / 4) * 100) / 100;
      calendar.push({ label: 'Q1 Payment', dueDate: year + '-04-15', amount: quarterlyAmount });
      calendar.push({ label: 'Q2 Payment', dueDate: year + '-06-15', amount: quarterlyAmount });
      calendar.push({ label: 'Q3 Payment', dueDate: year + '-09-15', amount: quarterlyAmount });
      calendar.push({ label: 'Q4 Payment', dueDate: (year + 1) + '-01-15', amount: quarterlyAmount });
    } else if (schedule === 'monthly') {
      var monthlyAmount = Math.round((totalTax / 12) * 100) / 100;
      for (var m = 0; m < 12; m++) {
        var monthNum = String(m + 1).length === 1 ? '0' + (m + 1) : String(m + 1);
        calendar.push({
          label: 'Month ' + (m + 1) + ' Payment',
          dueDate: year + '-' + monthNum + '-15',
          amount: monthlyAmount
        });
      }
    } else if (schedule === 'biannual') {
      var biannualAmount = Math.round((totalTax / 2) * 100) / 100;
      calendar.push({ label: 'First Installment', dueDate: year + '-01-31', amount: biannualAmount });
      calendar.push({ label: 'Second Installment', dueDate: year + '-07-31', amount: biannualAmount });
    } else {
      calendar.push({ label: 'Annual Payment', dueDate: (year + 1) + '-03-31', amount: Math.round(totalTax * 100) / 100 });
    }

    return calendar;
  }

  /* ── Public API ── */

  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.taxEstimatorCountries = {
    estimateWithholding: estimateWithholding,
    compareCountries: compareCountries,
    getSupportedCountries: getSupportedCountries,
    getWithholdingCalendar: getWithholdingCalendar,
    setPreferredCountry: setPreferredCountry,
    getPreferredCountry: getPreferredCountry,
    COUNTRY_TAX_DATA: COUNTRY_TAX_DATA
  };
})();
