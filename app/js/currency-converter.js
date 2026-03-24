/**
 * [CF-057] Currency Converter
 * Convert earnings to user's local currency with static exchange rates.
 * Exposed on window.CortexFreelancer.currencyConverter
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_preferred_currency';

  /**
   * Static exchange rates with USD as base currency.
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
    AUD: 1.55
  };

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

  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.currencyConverter = {
    convert: convert,
    setPreferredCurrency: setPreferredCurrency,
    getPreferredCurrency: getPreferredCurrency,
    convertEarnings: convertEarnings,
    getSupportedCurrencies: getSupportedCurrencies
  };
})();
