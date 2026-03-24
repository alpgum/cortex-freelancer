/**
 * [CF-057] Currency Converter
 * Convert earnings to user's local currency with exchange rates
 * and historical rate lookup for past transactions.
 * Exposed on window.CortexFreelancer.currencyConverter
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_preferred_currency';
  var HISTORY_STORAGE_KEY = 'cortex_exchange_rate_history';

  /**
   * Current exchange rates with USD as base currency.
   * @type {Object<string, number>}
   */
  var BASE_RATES = {
    USD: 1,
    EUR: 0.92,
    GBP: 0.79,
    TRY: 38.5,
    EGP: 50.5,
    NGN: 1550,
    PKR: 278,
    INR: 84,
    BRL: 5.1,
    PHP: 56,
    KES: 129,
    JPY: 154,
    CAD: 1.37,
    AUD: 1.55,
    CHF: 0.88
  };

  /**
   * Historical monthly rates (USD base) for the past 12 months.
   * Stored as { 'YYYY-MM': { EUR: rate, GBP: rate, ... } }
   */
  var HISTORICAL_RATES = (function () {
    var history = {};
    var codes = Object.keys(BASE_RATES);
    var now = new Date();

    for (var m = 0; m < 12; m++) {
      var d = new Date(now.getFullYear(), now.getMonth() - m, 1);
      var key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      var monthRates = {};
      for (var i = 0; i < codes.length; i++) {
        var code = codes[i];
        // Simulate slight monthly drift from current rate
        var drift = 1 + (Math.sin(m * 0.5 + i) * 0.03);
        monthRates[code] = Math.round(BASE_RATES[code] * drift * 10000) / 10000;
      }
      monthRates.USD = 1;
      history[key] = monthRates;
    }
    return history;
  })();

  /**
   * Convert an amount from one currency to another.
   * @param {number} amount - The amount to convert.
   * @param {string} from - Source currency code (e.g. 'USD').
   * @param {string} to - Target currency code (e.g. 'EUR').
   * @returns {{amount: number, from: string, to: string, result: number, rate: number}|null}
   */
  function convert(amount, from, to) {
    var fromCode = (from || '').toUpperCase();
    var toCode = (to || '').toUpperCase();

    if (!BASE_RATES[fromCode]) {
      console.warn('[CF-057] Unknown source currency:', from);
      return null;
    }
    if (!BASE_RATES[toCode]) {
      console.warn('[CF-057] Unknown target currency:', to);
      return null;
    }

    var amountInUSD = amount / BASE_RATES[fromCode];
    var result = amountInUSD * BASE_RATES[toCode];
    var rate = BASE_RATES[toCode] / BASE_RATES[fromCode];

    return {
      amount: amount,
      from: fromCode,
      to: toCode,
      result: Math.round(result * 100) / 100,
      rate: Math.round(rate * 1000000) / 1000000
    };
  }

  /**
   * Set the user's preferred currency in localStorage.
   * @param {string} code - Currency code (e.g. 'EUR').
   * @returns {boolean} True if valid and saved.
   */
  function setPreferredCurrency(code) {
    var upper = (code || '').toUpperCase();
    if (!BASE_RATES[upper]) {
      console.warn('[CF-057] Cannot set unknown currency:', code);
      return false;
    }
    try {
      localStorage.setItem(STORAGE_KEY, upper);
    } catch (e) {
      console.warn('[CF-057] localStorage write failed:', e);
      return false;
    }
    return true;
  }

  /**
   * Get the user's preferred currency from localStorage.
   * @returns {string} Currency code, defaults to 'USD'.
   */
  function getPreferredCurrency() {
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      if (stored && BASE_RATES[stored.toUpperCase()]) {
        return stored.toUpperCase();
      }
    } catch (e) {
      console.warn('[CF-057] localStorage read failed:', e);
    }
    return 'USD';
  }

  /**
   * Convert an array of earnings objects to the user's preferred currency.
   * Each earnings object must have at least { amount, currency }.
   * @param {Array<{amount: number, currency: string, [key: string]: *}>} earnings
   * @returns {Array<{original: {amount: number, currency: string}, converted: {amount: number, currency: string, rate: number}, [key: string]: *}>}
   */
  function convertEarnings(earnings) {
    var preferred = getPreferredCurrency();
    if (!Array.isArray(earnings)) return [];

    return earnings.map(function (entry) {
      var sourceCurrency = (entry.currency || 'USD').toUpperCase();
      var conversion = convert(entry.amount, sourceCurrency, preferred);

      return {
        original: { amount: entry.amount, currency: sourceCurrency },
        converted: {
          amount: conversion ? conversion.result : entry.amount,
          currency: preferred,
          rate: conversion ? conversion.rate : 1
        },
        label: entry.label || '',
        date: entry.date || null
      };
    });
  }

  /**
   * Get all supported currency codes.
   * @returns {string[]}
   */
  function getSupportedCurrencies() {
    return Object.keys(BASE_RATES);
  }

  /**
   * Convert using historical rate for a specific month.
   * Falls back to current rate if no historical data available.
   * @param {number} amount
   * @param {string} from - Source currency code.
   * @param {string} to - Target currency code.
   * @param {string} date - ISO date string (YYYY-MM-DD or YYYY-MM).
   * @returns {{amount: number, from: string, to: string, result: number, rate: number, historical: boolean}|null}
   */
  function convertHistorical(amount, from, to, date) {
    var fromCode = (from || '').toUpperCase();
    var toCode = (to || '').toUpperCase();

    if (!BASE_RATES[fromCode] || !BASE_RATES[toCode]) {
      console.warn('[CF-057] Unknown currency in historical conversion');
      return null;
    }

    var monthKey = (date || '').substring(0, 7);
    var rates = HISTORICAL_RATES[monthKey];

    if (rates && rates[fromCode] !== undefined && rates[toCode] !== undefined) {
      var amountInUSD = amount / rates[fromCode];
      var result = amountInUSD * rates[toCode];
      var rate = rates[toCode] / rates[fromCode];
      return {
        amount: amount,
        from: fromCode,
        to: toCode,
        result: Math.round(result * 100) / 100,
        rate: Math.round(rate * 1000000) / 1000000,
        historical: true,
        month: monthKey
      };
    }

    // Fallback to current rates
    var current = convert(amount, from, to);
    if (current) current.historical = false;
    return current;
  }

  /**
   * Get rate trend for a currency pair over available months.
   * @param {string} from
   * @param {string} to
   * @returns {Array<{month: string, rate: number}>}
   */
  function getRateTrend(from, to) {
    var fromCode = (from || 'USD').toUpperCase();
    var toCode = (to || 'EUR').toUpperCase();
    var months = Object.keys(HISTORICAL_RATES).sort();
    var trend = [];

    for (var i = 0; i < months.length; i++) {
      var rates = HISTORICAL_RATES[months[i]];
      if (rates[fromCode] !== undefined && rates[toCode] !== undefined) {
        trend.push({
          month: months[i],
          rate: Math.round((rates[toCode] / rates[fromCode]) * 1000000) / 1000000
        });
      }
    }

    return trend;
  }

  /**
   * Convert earnings using historical rates matching each entry's date.
   * @param {Array<{amount: number, currency: string, date: string}>} earnings
   * @returns {Array}
   */
  function convertEarningsHistorical(earnings) {
    var preferred = getPreferredCurrency();
    if (!Array.isArray(earnings)) return [];

    return earnings.map(function (entry) {
      var sourceCurrency = (entry.currency || 'USD').toUpperCase();
      var conversion = convertHistorical(entry.amount, sourceCurrency, preferred, entry.date);

      return {
        original: { amount: entry.amount, currency: sourceCurrency },
        converted: {
          amount: conversion ? conversion.result : entry.amount,
          currency: preferred,
          rate: conversion ? conversion.rate : 1,
          historical: conversion ? conversion.historical : false
        },
        label: entry.label || '',
        date: entry.date || null
      };
    });
  }

  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.currencyConverter = {
    convert: convert,
    convertHistorical: convertHistorical,
    getRateTrend: getRateTrend,
    setPreferredCurrency: setPreferredCurrency,
    getPreferredCurrency: getPreferredCurrency,
    convertEarnings: convertEarnings,
    convertEarningsHistorical: convertEarningsHistorical,
    getSupportedCurrencies: getSupportedCurrencies,
    HISTORICAL_RATES: HISTORICAL_RATES
  };
})();
