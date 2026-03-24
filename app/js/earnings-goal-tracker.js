/**
 * [CF-052] Earnings Goal Tracker
 * Set monthly/quarterly/yearly income goals, show real-time progress
 * with projections based on current pace.
 * Exposed on window.CortexFreelancer.earningsGoalTracker
 */
(function () {
  'use strict';

  var GOALS_KEY = 'cortex_earnings_goals';
  var EARNINGS_KEY = 'cortex_earnings_entries';
  var FALLBACK_EARNINGS_KEY = 'cortex_earnings';

  /* ── Storage Helpers ── */

  /**
   * Load data from localStorage by key
   * @param {string} key
   * @returns {Array}
   */
  function load(key) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  /**
   * Save data to localStorage by key
   * @param {string} key
   * @param {*} data
   */
  function save(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.warn('[EarningsGoalTracker] Failed to save:', e);
    }
  }

  /**
   * Load all earnings entries, merging from both keys
   * @returns {Array}
   */
  function loadEarnings() {
    var entries = load(EARNINGS_KEY);
    if (entries.length === 0) {
      entries = load(FALLBACK_EARNINGS_KEY);
    }
    return entries;
  }

  /* ── Date Helpers ── */

  /**
   * Get the start and end date for a period
   * @param {string} period - 'monthly' | 'quarterly' | 'yearly'
   * @param {string} [startDate] - ISO date string for the period start
   * @returns {{start: Date, end: Date}}
   */
  function getPeriodBounds(period, startDate) {
    var start = startDate ? new Date(startDate) : new Date();
    var end;

    if (period === 'monthly') {
      start = new Date(start.getFullYear(), start.getMonth(), 1);
      end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (period === 'quarterly') {
      var qMonth = Math.floor(start.getMonth() / 3) * 3;
      start = new Date(start.getFullYear(), qMonth, 1);
      end = new Date(start.getFullYear(), qMonth + 3, 0, 23, 59, 59, 999);
    } else {
      // yearly
      start = new Date(start.getFullYear(), 0, 1);
      end = new Date(start.getFullYear(), 11, 31, 23, 59, 59, 999);
    }

    return { start: start, end: end };
  }

  /**
   * Check if a date falls within a period
   * @param {string} dateStr - ISO date string
   * @param {Date} start
   * @param {Date} end
   * @returns {boolean}
   */
  function isInPeriod(dateStr, start, end) {
    var d = new Date(dateStr);
    return d >= start && d <= end;
  }

  /**
   * Calculate days remaining in a period from now
   * @param {Date} end
   * @returns {number}
   */
  function daysRemaining(end) {
    var now = new Date();
    var diff = end.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  /**
   * Calculate days elapsed in a period from start to now
   * @param {Date} start
   * @returns {number}
   */
  function daysElapsed(start) {
    var now = new Date();
    var diff = now.getTime() - start.getTime();
    return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  /**
   * Total days in period
   * @param {Date} start
   * @param {Date} end
   * @returns {number}
   */
  function totalDays(start, end) {
    return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  }

  /* ── Core Functions ── */

  /**
   * Set or update an earnings goal
   * @param {object} params
   * @param {string} params.period - 'monthly' | 'quarterly' | 'yearly'
   * @param {number} params.amount - Target amount
   * @param {string} [params.startDate] - ISO date string, defaults to current period
   * @returns {object} The created/updated goal
   */
  function setGoal(params) {
    var period = params.period || 'monthly';
    var amount = params.amount || 0;
    var startDate = params.startDate || new Date().toISOString();

    var bounds = getPeriodBounds(period, startDate);
    var goal = {
      id: period + '_' + bounds.start.toISOString().slice(0, 10),
      period: period,
      amount: amount,
      startDate: bounds.start.toISOString(),
      endDate: bounds.end.toISOString(),
      createdAt: new Date().toISOString()
    };

    var goals = load(GOALS_KEY);

    // Replace existing goal for same period/start or add new
    var found = false;
    for (var i = 0; i < goals.length; i++) {
      if (goals[i].id === goal.id) {
        goals[i] = goal;
        found = true;
        break;
      }
    }
    if (!found) {
      goals.push(goal);
    }

    save(GOALS_KEY, goals);
    return goal;
  }

  /**
   * Add an earnings entry
   * @param {object} params
   * @param {number} params.amount - Earnings amount
   * @param {string} [params.date] - ISO date string, defaults to now
   * @param {string} [params.source] - Client or project name
   * @param {string} [params.notes] - Optional notes
   * @returns {object} The created entry
   */
  function addEarning(params) {
    var entry = {
      id: 'earn_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      amount: params.amount || 0,
      date: params.date || new Date().toISOString(),
      source: params.source || '',
      notes: params.notes || '',
      createdAt: new Date().toISOString()
    };

    var earnings = load(EARNINGS_KEY);
    earnings.push(entry);
    save(EARNINGS_KEY, earnings);

    return entry;
  }

  /**
   * Get progress toward a goal for a specific period
   * @param {string} period - 'monthly' | 'quarterly' | 'yearly'
   * @param {string} [startDate] - Optional start date, defaults to current period
   * @returns {object} Progress details
   */
  function getProgress(period, startDate) {
    var bounds = getPeriodBounds(period, startDate);
    var goalId = period + '_' + bounds.start.toISOString().slice(0, 10);

    // Find the goal
    var goals = load(GOALS_KEY);
    var goal = null;
    for (var i = 0; i < goals.length; i++) {
      if (goals[i].id === goalId) {
        goal = goals[i];
        break;
      }
    }

    var target = goal ? goal.amount : 0;

    // Sum earnings in period
    var earnings = loadEarnings();
    var current = 0;
    var entriesInPeriod = [];
    for (var j = 0; j < earnings.length; j++) {
      var entryDate = earnings[j].date || earnings[j].createdAt;
      if (isInPeriod(entryDate, bounds.start, bounds.end)) {
        current += earnings[j].amount || 0;
        entriesInPeriod.push(earnings[j]);
      }
    }

    var percentage = target > 0 ? Math.round((current / target) * 100) : 0;
    var remaining = daysRemaining(bounds.end);
    var elapsed = daysElapsed(bounds.start);
    var total = totalDays(bounds.start, bounds.end);

    // Project total based on current daily rate
    var dailyRate = current / elapsed;
    var projectedTotal = Math.round(dailyRate * total);
    var onTrack = target > 0 ? projectedTotal >= target : true;

    return {
      period: period,
      target: target,
      current: Math.round(current * 100) / 100,
      percentage: percentage,
      daysRemaining: remaining,
      daysElapsed: elapsed,
      totalDays: total,
      projectedTotal: projectedTotal,
      onTrack: onTrack,
      dailyRate: Math.round(dailyRate * 100) / 100,
      requiredDailyRate: remaining > 0 && target > current
        ? Math.round(((target - current) / remaining) * 100) / 100
        : 0,
      entries: entriesInPeriod,
      goalExists: goal !== null,
      periodStart: bounds.start.toISOString(),
      periodEnd: bounds.end.toISOString()
    };
  }

  /**
   * Get projection for a period based on current pace
   * @param {string} period - 'monthly' | 'quarterly' | 'yearly'
   * @returns {object} Projection with scenarios
   */
  function getProjection(period) {
    var progress = getProgress(period);
    var dailyRate = progress.dailyRate;
    var remaining = progress.daysRemaining;

    // Scenario projections
    var conservative = progress.current + Math.round(dailyRate * 0.8 * remaining);
    var expected = progress.current + Math.round(dailyRate * remaining);
    var optimistic = progress.current + Math.round(dailyRate * 1.2 * remaining);

    var gap = progress.target > 0 ? progress.target - progress.current : 0;
    var shortfall = progress.target > 0 ? Math.max(0, progress.target - expected) : 0;

    return {
      period: period,
      target: progress.target,
      current: progress.current,
      conservative: conservative,
      expected: expected,
      optimistic: optimistic,
      gap: Math.round(gap * 100) / 100,
      shortfall: Math.round(shortfall * 100) / 100,
      onTrack: progress.onTrack,
      dailyRate: dailyRate,
      requiredDailyRate: progress.requiredDailyRate,
      daysRemaining: remaining
    };
  }

  /**
   * Get all stored goals
   * @returns {Array}
   */
  function getGoals() {
    return load(GOALS_KEY);
  }

  /**
   * Remove a goal by id
   * @param {string} goalId
   * @returns {boolean} Whether goal was found and removed
   */
  function removeGoal(goalId) {
    var goals = load(GOALS_KEY);
    var filtered = [];
    var found = false;
    for (var i = 0; i < goals.length; i++) {
      if (goals[i].id === goalId) {
        found = true;
      } else {
        filtered.push(goals[i]);
      }
    }
    if (found) {
      save(GOALS_KEY, filtered);
    }
    return found;
  }

  /**
   * Get all earnings entries
   * @returns {Array}
   */
  function getEarnings() {
    return loadEarnings();
  }

  /**
   * Clear all goals
   */
  function clearGoals() {
    save(GOALS_KEY, []);
  }

  /**
   * Clear all earnings entries
   */
  function clearEarnings() {
    save(EARNINGS_KEY, []);
  }

  /* ── Public API ── */
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.earningsGoalTracker = {
    setGoal: setGoal,
    addEarning: addEarning,
    getProgress: getProgress,
    getProjection: getProjection,
    getGoals: getGoals,
    removeGoal: removeGoal,
    getEarnings: getEarnings,
    clearGoals: clearGoals,
    clearEarnings: clearEarnings
  };
})();
