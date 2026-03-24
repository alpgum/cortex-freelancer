/**
 * [CF-049] Cortex Freelancer — Expense Tracker
 * Track business expenses with categories, receipts, and tax deduction flags.
 * Stored in localStorage.
 * Exposed on window.CortexFreelancer.expenseTracker
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_expenses';

  var CATEGORIES = ['software', 'hardware', 'office', 'travel', 'marketing', 'education', 'other'];

  /* ───────── localStorage helpers ───────── */

  function loadExpenses() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveExpenses(expenses) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
  }

  /* ───────── data layer ───────── */

  /**
   * Add an expense record.
   * @param {Object} data
   * @param {string} data.date - ISO date string (YYYY-MM-DD)
   * @param {string} data.category - One of: software, hardware, office, travel, marketing, education, other
   * @param {number} data.amount - Expense amount
   * @param {string} [data.description]
   * @param {boolean} [data.hasReceipt=false]
   * @param {boolean} [data.taxDeductible=false]
   * @returns {Object} The saved expense with generated id
   */
  function addExpense(data) {
    if (!data || !data.amount) throw new Error('amount is required');
    var expenses = loadExpenses();
    var category = (data.category || 'other').toLowerCase();
    if (CATEGORIES.indexOf(category) === -1) category = 'other';

    var entry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      date: data.date || new Date().toISOString().slice(0, 10),
      category: category,
      amount: Number(data.amount),
      description: data.description || '',
      hasReceipt: !!data.hasReceipt,
      taxDeductible: !!data.taxDeductible,
      createdAt: new Date().toISOString()
    };
    expenses.push(entry);
    saveExpenses(expenses);
    return entry;
  }

  /**
   * Get expenses with optional filters.
   * @param {Object} [filters]
   * @param {string} [filters.category]
   * @param {number} [filters.year]
   * @param {number} [filters.month] - 1-12
   * @param {boolean} [filters.taxDeductible]
   * @param {boolean} [filters.hasReceipt]
   * @param {string} [filters.startDate] - ISO date
   * @param {string} [filters.endDate] - ISO date
   * @returns {Array} Filtered expense records
   */
  function getExpenses(filters) {
    var expenses = loadExpenses();
    if (!filters) return expenses;

    return expenses.filter(function (e) {
      if (filters.category && e.category !== filters.category.toLowerCase()) return false;
      if (filters.year) {
        var d = new Date(e.date);
        if (d.getFullYear() !== filters.year) return false;
        if (filters.month && (d.getMonth() + 1) !== filters.month) return false;
      }
      if (filters.taxDeductible != null && e.taxDeductible !== filters.taxDeductible) return false;
      if (filters.hasReceipt != null && e.hasReceipt !== filters.hasReceipt) return false;
      if (filters.startDate && e.date < filters.startDate) return false;
      if (filters.endDate && e.date > filters.endDate) return false;
      return true;
    });
  }

  /**
   * Get expense summary for a given year.
   * @param {number} year
   * @returns {Object} {year, totalExpenses, byCategory, byMonth, count, avgExpense, withReceipts, withoutReceipts}
   */
  function getExpenseSummary(year) {
    var expenses = getExpenses({ year: year });
    var totalExpenses = 0;
    var byCategory = {};
    var byMonth = {};
    var withReceipts = 0;
    var months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    months.forEach(function (m) { byMonth[m] = 0; });
    CATEGORIES.forEach(function (c) { byCategory[c] = 0; });

    expenses.forEach(function (e) {
      totalExpenses += e.amount;
      byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
      var d = new Date(e.date);
      byMonth[months[d.getMonth()]] += e.amount;
      if (e.hasReceipt) withReceipts++;
    });

    return {
      year: year,
      totalExpenses: Math.round(totalExpenses * 100) / 100,
      byCategory: byCategory,
      byMonth: byMonth,
      count: expenses.length,
      avgExpense: expenses.length > 0 ? Math.round((totalExpenses / expenses.length) * 100) / 100 : 0,
      withReceipts: withReceipts,
      withoutReceipts: expenses.length - withReceipts
    };
  }

  /**
   * Get total tax-deductible expenses for a given year.
   * @param {number} year
   * @returns {Object} {year, total, count, byCategory}
   */
  function getDeductibleTotal(year) {
    var deductible = getExpenses({ year: year, taxDeductible: true });
    var total = 0;
    var byCategory = {};

    deductible.forEach(function (e) {
      total += e.amount;
      byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
    });

    return {
      year: year,
      total: Math.round(total * 100) / 100,
      count: deductible.length,
      byCategory: byCategory
    };
  }

  /* ───────── public API ───────── */

  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.expenseTracker = {
    addExpense: addExpense,
    getExpenses: getExpenses,
    getExpenseSummary: getExpenseSummary,
    getDeductibleTotal: getDeductibleTotal,
    CATEGORIES: CATEGORIES
  };

})();
