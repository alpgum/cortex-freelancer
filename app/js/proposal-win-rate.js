/**
 * [CF-039] Proposal Win Rate Dashboard
 * Calculate and display win rate by category, budget range, and proposal
 * template used. Reads from proposal tracker and A/B testing storage.
 * Exposed on window.CortexFreelancer.proposalWinRate
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_proposal_outcomes';

  /* ── Storage Helpers ── */

  /**
   * Load outcomes from localStorage
   * @returns {Array}
   */
  function loadOutcomes() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  /**
   * Save outcomes to localStorage
   * @param {Array} outcomes
   */
  function saveOutcomes(outcomes) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(outcomes));
    } catch (e) {
      console.warn('[ProposalWinRate] Failed to save:', e);
    }
  }

  /* ── Data Entry ── */

  /**
   * Record a proposal outcome
   * @param {object} params
   * @param {string} params.jobId - Unique job identifier
   * @param {string} params.category - Job category (e.g. "Frontend / UI")
   * @param {number} params.budget - Job budget amount
   * @param {string} [params.templateId] - Template used for the proposal
   * @param {string} [params.templateName] - Human-readable template name
   * @param {string} params.outcome - 'won' | 'lost' | 'pending' | 'withdrawn'
   * @param {string} [params.date] - ISO date string, defaults to now
   * @param {string} [params.notes] - Optional notes
   * @returns {object} The recorded outcome
   */
  function recordOutcome(params) {
    if (!params || !params.jobId) {
      return { error: 'jobId is required' };
    }

    var entry = {
      id: 'pwr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      jobId: params.jobId,
      category: params.category || 'Other',
      budget: params.budget || 0,
      templateId: params.templateId || null,
      templateName: params.templateName || 'No template',
      outcome: params.outcome || 'pending',
      date: params.date || new Date().toISOString(),
      notes: params.notes || ''
    };

    var outcomes = loadOutcomes();

    // Replace existing entry for same jobId, or add new
    var found = false;
    for (var i = 0; i < outcomes.length; i++) {
      if (outcomes[i].jobId === entry.jobId) {
        outcomes[i] = entry;
        found = true;
        break;
      }
    }
    if (!found) {
      outcomes.push(entry);
    }

    saveOutcomes(outcomes);
    return entry;
  }

  /**
   * Update outcome status for an existing record
   * @param {string} jobId
   * @param {string} outcome - 'won' | 'lost' | 'pending' | 'withdrawn'
   * @returns {object|null}
   */
  function updateOutcome(jobId, outcome) {
    var outcomes = loadOutcomes();
    for (var i = 0; i < outcomes.length; i++) {
      if (outcomes[i].jobId === jobId) {
        outcomes[i].outcome = outcome;
        saveOutcomes(outcomes);
        return outcomes[i];
      }
    }
    return null;
  }

  /* ── Budget Range Helpers ── */

  /**
   * Classify budget into a range label
   * @param {number} budget
   * @returns {string}
   */
  function getBudgetRange(budget) {
    if (budget <= 0) return 'Not specified';
    if (budget < 500) return '$0–$499';
    if (budget < 1000) return '$500–$999';
    if (budget < 5000) return '$1K–$4.9K';
    if (budget < 10000) return '$5K–$9.9K';
    if (budget < 25000) return '$10K–$24.9K';
    return '$25K+';
  }

  /* ── Analytics ── */

  /**
   * Calculate overall win rate
   * @returns {{total: number, won: number, lost: number, pending: number, withdrawn: number, winRate: number}}
   */
  function getOverallStats() {
    var outcomes = loadOutcomes();
    var stats = { total: outcomes.length, won: 0, lost: 0, pending: 0, withdrawn: 0 };

    for (var i = 0; i < outcomes.length; i++) {
      var o = outcomes[i].outcome;
      if (stats[o] !== undefined) {
        stats[o]++;
      }
    }

    var decided = stats.won + stats.lost;
    stats.winRate = decided > 0 ? Math.round((stats.won / decided) * 1000) / 10 : 0;

    return stats;
  }

  /**
   * Calculate win rate grouped by category
   * @returns {Object.<string, {won: number, lost: number, total: number, winRate: number}>}
   */
  function getWinRateByCategory() {
    var outcomes = loadOutcomes();
    var groups = {};

    for (var i = 0; i < outcomes.length; i++) {
      var o = outcomes[i];
      if (o.outcome !== 'won' && o.outcome !== 'lost') continue;

      var cat = o.category || 'Other';
      if (!groups[cat]) {
        groups[cat] = { won: 0, lost: 0, total: 0, winRate: 0 };
      }
      groups[cat].total++;
      if (o.outcome === 'won') groups[cat].won++;
      else groups[cat].lost++;
    }

    var keys = Object.keys(groups);
    for (var j = 0; j < keys.length; j++) {
      var g = groups[keys[j]];
      g.winRate = g.total > 0 ? Math.round((g.won / g.total) * 1000) / 10 : 0;
    }

    return groups;
  }

  /**
   * Calculate win rate grouped by budget range
   * @returns {Object.<string, {won: number, lost: number, total: number, winRate: number}>}
   */
  function getWinRateByBudgetRange() {
    var outcomes = loadOutcomes();
    var groups = {};

    for (var i = 0; i < outcomes.length; i++) {
      var o = outcomes[i];
      if (o.outcome !== 'won' && o.outcome !== 'lost') continue;

      var range = getBudgetRange(o.budget);
      if (!groups[range]) {
        groups[range] = { won: 0, lost: 0, total: 0, winRate: 0 };
      }
      groups[range].total++;
      if (o.outcome === 'won') groups[range].won++;
      else groups[range].lost++;
    }

    var keys = Object.keys(groups);
    for (var j = 0; j < keys.length; j++) {
      var g = groups[keys[j]];
      g.winRate = g.total > 0 ? Math.round((g.won / g.total) * 1000) / 10 : 0;
    }

    return groups;
  }

  /**
   * Calculate win rate grouped by template used
   * @returns {Object.<string, {won: number, lost: number, total: number, winRate: number, templateId: string|null}>}
   */
  function getWinRateByTemplate() {
    var outcomes = loadOutcomes();
    var groups = {};

    for (var i = 0; i < outcomes.length; i++) {
      var o = outcomes[i];
      if (o.outcome !== 'won' && o.outcome !== 'lost') continue;

      var name = o.templateName || 'No template';
      if (!groups[name]) {
        groups[name] = { won: 0, lost: 0, total: 0, winRate: 0, templateId: o.templateId };
      }
      groups[name].total++;
      if (o.outcome === 'won') groups[name].won++;
      else groups[name].lost++;
    }

    var keys = Object.keys(groups);
    for (var j = 0; j < keys.length; j++) {
      var g = groups[keys[j]];
      g.winRate = g.total > 0 ? Math.round((g.won / g.total) * 1000) / 10 : 0;
    }

    return groups;
  }

  /**
   * Get win rate trends over time (monthly)
   * @param {number} [months=6] - Number of months to look back
   * @returns {Array<{month: string, won: number, lost: number, total: number, winRate: number}>}
   */
  function getMonthlyTrend(months) {
    months = months || 6;
    var outcomes = loadOutcomes();
    var buckets = {};

    // Initialize month buckets
    var now = new Date();
    for (var m = 0; m < months; m++) {
      var d = new Date(now.getFullYear(), now.getMonth() - m, 1);
      var key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      buckets[key] = { month: key, won: 0, lost: 0, total: 0, winRate: 0 };
    }

    for (var i = 0; i < outcomes.length; i++) {
      var o = outcomes[i];
      if (o.outcome !== 'won' && o.outcome !== 'lost') continue;

      var od = new Date(o.date);
      var oKey = od.getFullYear() + '-' + String(od.getMonth() + 1).padStart(2, '0');
      if (buckets[oKey]) {
        buckets[oKey].total++;
        if (o.outcome === 'won') buckets[oKey].won++;
        else buckets[oKey].lost++;
      }
    }

    var result = [];
    var keys = Object.keys(buckets).sort();
    for (var j = 0; j < keys.length; j++) {
      var b = buckets[keys[j]];
      b.winRate = b.total > 0 ? Math.round((b.won / b.total) * 1000) / 10 : 0;
      result.push(b);
    }

    return result;
  }

  /**
   * Get full dashboard data in a single call
   * @returns {object} Combined dashboard data
   */
  function getDashboard() {
    return {
      overall: getOverallStats(),
      byCategory: getWinRateByCategory(),
      byBudgetRange: getWinRateByBudgetRange(),
      byTemplate: getWinRateByTemplate(),
      monthlyTrend: getMonthlyTrend(6)
    };
  }

  /**
   * Get all recorded outcomes
   * @returns {Array}
   */
  function getOutcomes() {
    return loadOutcomes();
  }

  /**
   * Remove an outcome by jobId
   * @param {string} jobId
   * @returns {boolean}
   */
  function removeOutcome(jobId) {
    var outcomes = loadOutcomes();
    var filtered = [];
    var found = false;
    for (var i = 0; i < outcomes.length; i++) {
      if (outcomes[i].jobId === jobId) {
        found = true;
      } else {
        filtered.push(outcomes[i]);
      }
    }
    if (found) saveOutcomes(filtered);
    return found;
  }

  /**
   * Clear all outcomes
   */
  function clearOutcomes() {
    saveOutcomes([]);
  }

  /**
   * Initialize the module
   * @returns {object} Current dashboard state
   */
  function init() {
    return getDashboard();
  }

  /* ── Public API ── */
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.proposalWinRate = {
    init: init,
    recordOutcome: recordOutcome,
    updateOutcome: updateOutcome,
    getOverallStats: getOverallStats,
    getWinRateByCategory: getWinRateByCategory,
    getWinRateByBudgetRange: getWinRateByBudgetRange,
    getWinRateByTemplate: getWinRateByTemplate,
    getMonthlyTrend: getMonthlyTrend,
    getDashboard: getDashboard,
    getOutcomes: getOutcomes,
    removeOutcome: removeOutcome,
    clearOutcomes: clearOutcomes
  };
})();
