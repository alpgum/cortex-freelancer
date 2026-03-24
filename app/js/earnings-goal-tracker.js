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

  /* ── Enhanced: Progress Bar Rendering ── */

  /**
   * Render a progress bar into a container element
   * @param {string} containerId - DOM element id
   * @param {string} period - 'monthly' | 'quarterly' | 'yearly'
   * @param {object} [options]
   * @param {string} [options.barColor] - Progress bar fill color
   * @param {string} [options.trackColor] - Background track color
   * @param {boolean} [options.showProjection] - Show projected endpoint
   */
  function renderProgressBar(containerId, period, options) {
    var container = document.getElementById(containerId);
    if (!container) {
      console.error('[EarningsGoalTracker] Container not found:', containerId);
      return;
    }

    var opts = options || {};
    var progress = getProgress(period);

    if (!progress.goalExists) {
      container.innerHTML = '<p style="color:#71717a;font-size:14px">No ' + period + ' goal set. Use setGoal() to create one.</p>';
      return;
    }

    var pct = Math.min(progress.percentage, 100);
    var projPct = progress.target > 0 ? Math.min(Math.round((progress.projectedTotal / progress.target) * 100), 150) : 0;
    var barColor = opts.barColor || (progress.onTrack ? '#22c55e' : '#ef4444');
    var trackColor = opts.trackColor || '#27272a';

    var html = '<div style="font-family:-apple-system,sans-serif;background:#18181b;border-radius:12px;padding:20px">';

    // Header
    var periodLabel = period.charAt(0).toUpperCase() + period.slice(1);
    html += '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:12px">';
    html += '<span style="color:#e4e4e7;font-weight:600;font-size:16px">' + periodLabel + ' Goal</span>';
    html += '<span style="color:' + barColor + ';font-weight:700;font-size:20px">' + pct + '%</span>';
    html += '</div>';

    // Progress bar
    html += '<div style="background:' + trackColor + ';border-radius:8px;height:24px;position:relative;overflow:hidden">';
    html += '<div style="background:' + barColor + ';height:100%;border-radius:8px;width:' + pct + '%;transition:width 0.5s ease"></div>';

    // Projection marker
    if (opts.showProjection !== false && projPct > 0 && projPct !== pct) {
      var markerPos = Math.min(projPct, 100);
      html += '<div style="position:absolute;top:0;left:' + markerPos + '%;width:2px;height:100%;background:#fbbf24;opacity:0.8" title="Projected: ' + projPct + '%"></div>';
    }
    html += '</div>';

    // Stats row
    html += '<div style="display:flex;justify-content:space-between;margin-top:12px;font-size:13px;color:#a1a1aa">';
    html += '<span>$' + Math.round(progress.current).toLocaleString() + ' / $' + Math.round(progress.target).toLocaleString() + '</span>';
    html += '<span>' + progress.daysRemaining + ' days left</span>';
    html += '</div>';

    // Pace indicator
    html += '<div style="display:flex;justify-content:space-between;margin-top:8px;font-size:12px;color:#71717a">';
    html += '<span>Daily pace: $' + progress.dailyRate + '/day</span>';
    if (progress.requiredDailyRate > 0) {
      html += '<span>Need: $' + progress.requiredDailyRate + '/day</span>';
    }
    html += '</div>';

    // Status badge
    var statusColor = progress.onTrack ? '#22c55e' : '#ef4444';
    var statusText = progress.onTrack ? 'On Track' : 'Behind Pace';
    html += '<div style="margin-top:12px">';
    html += '<span style="background:' + statusColor + '22;color:' + statusColor + ';padding:4px 10px;border-radius:12px;font-size:12px;font-weight:600">' + statusText + '</span>';
    html += '</div>';

    html += '</div>';
    container.innerHTML = html;
  }

  /**
   * Render all active goal progress bars
   * @param {string} containerId - DOM element id to render into
   */
  function renderAllGoals(containerId) {
    var container = document.getElementById(containerId);
    if (!container) {
      console.error('[EarningsGoalTracker] Container not found:', containerId);
      return;
    }

    var goals = load(GOALS_KEY);
    if (goals.length === 0) {
      container.innerHTML = '<p style="color:#71717a;font-size:14px">No goals set yet.</p>';
      return;
    }

    container.innerHTML = '';
    for (var i = 0; i < goals.length; i++) {
      var wrapper = document.createElement('div');
      wrapper.id = containerId + '_goal_' + i;
      wrapper.style.marginBottom = '16px';
      container.appendChild(wrapper);
      renderProgressBar(wrapper.id, goals[i].period, { showProjection: true });
    }
  }

  /* ── Enhanced: Milestone Alerts ── */

  /**
   * Check milestones and return alerts for crossed thresholds
   * @param {string} period - 'monthly' | 'quarterly' | 'yearly'
   * @returns {Array<{milestone: number, reached: boolean, message: string}>}
   */
  function checkMilestones(period) {
    var progress = getProgress(period);
    if (!progress.goalExists) return [];

    var milestones = [25, 50, 75, 90, 100];
    var alerts = [];

    for (var i = 0; i < milestones.length; i++) {
      var m = milestones[i];
      var reached = progress.percentage >= m;
      var message = '';

      if (m === 100 && reached) {
        message = 'Goal reached! You earned $' + Math.round(progress.current).toLocaleString() + ' this ' + period.replace('ly', '') + '.';
      } else if (reached) {
        message = m + '% milestone reached — $' + Math.round(progress.current).toLocaleString() + ' of $' + Math.round(progress.target).toLocaleString();
      } else {
        var needed = (progress.target * m / 100) - progress.current;
        message = '$' + Math.round(needed).toLocaleString() + ' more to reach ' + m + '%';
      }

      alerts.push({ milestone: m, reached: reached, message: message });
    }

    return alerts;
  }

  /* ── Enhanced: Streak Tracking ── */

  /**
   * Calculate earning streak — consecutive days/weeks with earnings
   * @returns {{currentStreak: number, longestStreak: number, unit: string, lastEarningDate: string|null}}
   */
  function getEarningStreak() {
    var earnings = loadEarnings();
    if (earnings.length === 0) {
      return { currentStreak: 0, longestStreak: 0, unit: 'days', lastEarningDate: null };
    }

    // Group by date
    var dates = {};
    for (var i = 0; i < earnings.length; i++) {
      var d = (earnings[i].date || earnings[i].createdAt || '').slice(0, 10);
      if (d) dates[d] = true;
    }

    var sortedDates = Object.keys(dates).sort();
    if (sortedDates.length === 0) {
      return { currentStreak: 0, longestStreak: 0, unit: 'days', lastEarningDate: null };
    }

    // Calculate weekly streaks (more practical than daily)
    var weeks = {};
    for (var j = 0; j < sortedDates.length; j++) {
      var dt = new Date(sortedDates[j]);
      var weekStart = new Date(dt);
      weekStart.setDate(dt.getDate() - dt.getDay());
      var wKey = weekStart.toISOString().slice(0, 10);
      weeks[wKey] = true;
    }

    var sortedWeeks = Object.keys(weeks).sort();
    var currentStreak = 1;
    var longestStreak = 1;
    var streak = 1;

    for (var k = 1; k < sortedWeeks.length; k++) {
      var prev = new Date(sortedWeeks[k - 1]);
      var curr = new Date(sortedWeeks[k]);
      var diff = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));

      if (diff <= 7) {
        streak++;
        if (streak > longestStreak) longestStreak = streak;
      } else {
        streak = 1;
      }
    }
    currentStreak = streak;

    return {
      currentStreak: currentStreak,
      longestStreak: longestStreak,
      unit: 'weeks',
      lastEarningDate: sortedDates[sortedDates.length - 1]
    };
  }

  /* ── Enhanced: Multi-Period Overview ── */

  /**
   * Get progress across all periods at once
   * @returns {{monthly: object, quarterly: object, yearly: object, streak: object, milestones: object}}
   */
  function getOverview() {
    return {
      monthly: getProgress('monthly'),
      quarterly: getProgress('quarterly'),
      yearly: getProgress('yearly'),
      streak: getEarningStreak(),
      milestones: {
        monthly: checkMilestones('monthly'),
        quarterly: checkMilestones('quarterly'),
        yearly: checkMilestones('yearly')
      }
    };
  }

  /**
   * Initialize the module
   * @param {string} [containerId] - Optional container to auto-render progress bars
   * @returns {object} Current overview
   */
  function init(containerId) {
    var overview = getOverview();
    if (containerId) {
      renderAllGoals(containerId);
    }
    return overview;
  }

  /* ── Public API ── */
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.earningsGoalTracker = {
    init: init,
    setGoal: setGoal,
    addEarning: addEarning,
    getProgress: getProgress,
    getProjection: getProjection,
    getGoals: getGoals,
    removeGoal: removeGoal,
    getEarnings: getEarnings,
    clearGoals: clearGoals,
    clearEarnings: clearEarnings,
    renderProgressBar: renderProgressBar,
    renderAllGoals: renderAllGoals,
    checkMilestones: checkMilestones,
    getEarningStreak: getEarningStreak,
    getOverview: getOverview
  };
})();
