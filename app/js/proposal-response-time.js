/**
 * [CF-040] Proposal Response Time Tracker
 * Measure time from proposal submission to client response.
 * Show averages by category, identify patterns in response times.
 * Exposed on window.CortexFreelancer.proposalResponseTime
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_proposal_response_times';

  /* ── Storage Helpers ── */

  /**
   * Load tracked proposals from localStorage
   * @returns {Array}
   */
  function loadEntries() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  /**
   * Save tracked proposals to localStorage
   * @param {Array} entries
   */
  function saveEntries(entries) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch (e) {
      console.warn('[ProposalResponseTime] Failed to save:', e);
    }
  }

  /* ── Time Calculation Helpers ── */

  /**
   * Calculate hours between two ISO date strings
   * @param {string} startISO
   * @param {string} endISO
   * @returns {number} Hours elapsed
   */
  function hoursBetween(startISO, endISO) {
    var start = new Date(startISO).getTime();
    var end = new Date(endISO).getTime();
    if (isNaN(start) || isNaN(end)) return 0;
    return Math.max(0, (end - start) / (1000 * 60 * 60));
  }

  /**
   * Format hours into a human-readable string
   * @param {number} hours
   * @returns {string}
   */
  function formatDuration(hours) {
    if (hours < 1) return Math.round(hours * 60) + ' min';
    if (hours < 24) return Math.round(hours * 10) / 10 + ' hrs';
    var days = Math.floor(hours / 24);
    var remaining = Math.round(hours % 24);
    return days + 'd ' + remaining + 'h';
  }

  /* ── Core Functions ── */

  /**
   * Record a proposal submission
   * @param {object} params
   * @param {string} params.jobId - Unique job identifier
   * @param {string} params.category - Job category
   * @param {number} [params.budget] - Job budget
   * @param {string} [params.submittedAt] - ISO date string, defaults to now
   * @param {string} [params.clientName] - Client name
   * @returns {object} The tracked entry
   */
  function trackSubmission(params) {
    if (!params || !params.jobId) {
      return { error: 'jobId is required' };
    }

    var entry = {
      id: 'prt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      jobId: params.jobId,
      category: params.category || 'Other',
      budget: params.budget || 0,
      clientName: params.clientName || '',
      submittedAt: params.submittedAt || new Date().toISOString(),
      respondedAt: null,
      responseHours: null,
      status: 'awaiting' // awaiting | responded | expired | withdrawn
    };

    var entries = loadEntries();

    // Replace if same jobId already tracked
    var found = false;
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].jobId === entry.jobId) {
        entries[i] = entry;
        found = true;
        break;
      }
    }
    if (!found) {
      entries.push(entry);
    }

    saveEntries(entries);
    return entry;
  }

  /**
   * Record a client response for a tracked proposal
   * @param {string} jobId
   * @param {string} [respondedAt] - ISO date string, defaults to now
   * @returns {object|null} Updated entry or null if not found
   */
  function recordResponse(jobId, respondedAt) {
    var entries = loadEntries();
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].jobId === jobId) {
        entries[i].respondedAt = respondedAt || new Date().toISOString();
        entries[i].responseHours = hoursBetween(entries[i].submittedAt, entries[i].respondedAt);
        entries[i].status = 'responded';
        saveEntries(entries);
        return entries[i];
      }
    }
    return null;
  }

  /**
   * Mark a proposal as expired (no response)
   * @param {string} jobId
   * @returns {object|null}
   */
  function markExpired(jobId) {
    var entries = loadEntries();
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].jobId === jobId) {
        entries[i].status = 'expired';
        saveEntries(entries);
        return entries[i];
      }
    }
    return null;
  }

  /**
   * Mark a proposal as withdrawn
   * @param {string} jobId
   * @returns {object|null}
   */
  function markWithdrawn(jobId) {
    var entries = loadEntries();
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].jobId === jobId) {
        entries[i].status = 'withdrawn';
        saveEntries(entries);
        return entries[i];
      }
    }
    return null;
  }

  /* ── Analytics ── */

  /**
   * Get entries that have response times recorded
   * @returns {Array}
   */
  function getRespondedEntries() {
    var entries = loadEntries();
    var responded = [];
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].status === 'responded' && entries[i].responseHours !== null) {
        responded.push(entries[i]);
      }
    }
    return responded;
  }

  /**
   * Calculate overall average response time
   * @returns {{avgHours: number, medianHours: number, minHours: number, maxHours: number, count: number, formatted: {avg: string, median: string, min: string, max: string}}}
   */
  function getOverallAverage() {
    var responded = getRespondedEntries();
    if (responded.length === 0) {
      return { avgHours: 0, medianHours: 0, minHours: 0, maxHours: 0, count: 0, formatted: { avg: 'N/A', median: 'N/A', min: 'N/A', max: 'N/A' } };
    }

    var hours = [];
    for (var i = 0; i < responded.length; i++) {
      hours.push(responded[i].responseHours);
    }
    hours.sort(function (a, b) { return a - b; });

    var sum = 0;
    for (var j = 0; j < hours.length; j++) {
      sum += hours[j];
    }

    var avg = sum / hours.length;
    var median = hours.length % 2 === 0
      ? (hours[hours.length / 2 - 1] + hours[hours.length / 2]) / 2
      : hours[Math.floor(hours.length / 2)];

    return {
      avgHours: Math.round(avg * 10) / 10,
      medianHours: Math.round(median * 10) / 10,
      minHours: Math.round(hours[0] * 10) / 10,
      maxHours: Math.round(hours[hours.length - 1] * 10) / 10,
      count: hours.length,
      formatted: {
        avg: formatDuration(avg),
        median: formatDuration(median),
        min: formatDuration(hours[0]),
        max: formatDuration(hours[hours.length - 1])
      }
    };
  }

  /**
   * Calculate average response time grouped by category
   * @returns {Object.<string, {avgHours: number, count: number, formatted: string}>}
   */
  function getAverageByCategory() {
    var responded = getRespondedEntries();
    var groups = {};

    for (var i = 0; i < responded.length; i++) {
      var cat = responded[i].category || 'Other';
      if (!groups[cat]) {
        groups[cat] = { totalHours: 0, count: 0 };
      }
      groups[cat].totalHours += responded[i].responseHours;
      groups[cat].count++;
    }

    var result = {};
    var keys = Object.keys(groups);
    for (var j = 0; j < keys.length; j++) {
      var g = groups[keys[j]];
      var avg = g.totalHours / g.count;
      result[keys[j]] = {
        avgHours: Math.round(avg * 10) / 10,
        count: g.count,
        formatted: formatDuration(avg)
      };
    }

    return result;
  }

  /**
   * Calculate average response time grouped by budget range
   * @returns {Object.<string, {avgHours: number, count: number, formatted: string}>}
   */
  function getAverageByBudgetRange() {
    var responded = getRespondedEntries();
    var groups = {};

    for (var i = 0; i < responded.length; i++) {
      var budget = responded[i].budget || 0;
      var range;
      if (budget <= 0) range = 'Not specified';
      else if (budget < 500) range = '$0–$499';
      else if (budget < 1000) range = '$500–$999';
      else if (budget < 5000) range = '$1K–$4.9K';
      else if (budget < 10000) range = '$5K–$9.9K';
      else range = '$10K+';

      if (!groups[range]) {
        groups[range] = { totalHours: 0, count: 0 };
      }
      groups[range].totalHours += responded[i].responseHours;
      groups[range].count++;
    }

    var result = {};
    var keys = Object.keys(groups);
    for (var j = 0; j < keys.length; j++) {
      var g = groups[keys[j]];
      var avg = g.totalHours / g.count;
      result[keys[j]] = {
        avgHours: Math.round(avg * 10) / 10,
        count: g.count,
        formatted: formatDuration(avg)
      };
    }

    return result;
  }

  /**
   * Get proposals still awaiting response with elapsed time
   * @returns {Array<{jobId: string, category: string, elapsedHours: number, formatted: string}>}
   */
  function getPending() {
    var entries = loadEntries();
    var now = new Date().toISOString();
    var pending = [];

    for (var i = 0; i < entries.length; i++) {
      if (entries[i].status === 'awaiting') {
        var elapsed = hoursBetween(entries[i].submittedAt, now);
        pending.push({
          jobId: entries[i].jobId,
          category: entries[i].category,
          clientName: entries[i].clientName,
          submittedAt: entries[i].submittedAt,
          elapsedHours: Math.round(elapsed * 10) / 10,
          formatted: formatDuration(elapsed)
        });
      }
    }

    // Sort by longest waiting first
    pending.sort(function (a, b) { return b.elapsedHours - a.elapsedHours; });
    return pending;
  }

  /**
   * Get response time distribution (histogram buckets)
   * @returns {Array<{label: string, count: number}>}
   */
  function getDistribution() {
    var buckets = [
      { label: '< 1 hour', min: 0, max: 1, count: 0 },
      { label: '1–6 hours', min: 1, max: 6, count: 0 },
      { label: '6–24 hours', min: 6, max: 24, count: 0 },
      { label: '1–3 days', min: 24, max: 72, count: 0 },
      { label: '3–7 days', min: 72, max: 168, count: 0 },
      { label: '7+ days', min: 168, max: Infinity, count: 0 }
    ];

    var responded = getRespondedEntries();
    for (var i = 0; i < responded.length; i++) {
      var h = responded[i].responseHours;
      for (var j = 0; j < buckets.length; j++) {
        if (h >= buckets[j].min && h < buckets[j].max) {
          buckets[j].count++;
          break;
        }
      }
    }

    var result = [];
    for (var k = 0; k < buckets.length; k++) {
      result.push({ label: buckets[k].label, count: buckets[k].count });
    }
    return result;
  }

  /**
   * Get full dashboard summary
   * @returns {object}
   */
  function getDashboard() {
    var entries = loadEntries();
    return {
      overall: getOverallAverage(),
      byCategory: getAverageByCategory(),
      byBudgetRange: getAverageByBudgetRange(),
      pending: getPending(),
      distribution: getDistribution(),
      totalTracked: entries.length
    };
  }

  /**
   * Get all tracked entries
   * @returns {Array}
   */
  function getEntries() {
    return loadEntries();
  }

  /**
   * Remove an entry by jobId
   * @param {string} jobId
   * @returns {boolean}
   */
  function removeEntry(jobId) {
    var entries = loadEntries();
    var filtered = [];
    var found = false;
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].jobId === jobId) {
        found = true;
      } else {
        filtered.push(entries[i]);
      }
    }
    if (found) saveEntries(filtered);
    return found;
  }

  /**
   * Clear all tracked entries
   */
  function clearEntries() {
    saveEntries([]);
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
  window.CortexFreelancer.proposalResponseTime = {
    init: init,
    trackSubmission: trackSubmission,
    recordResponse: recordResponse,
    markExpired: markExpired,
    markWithdrawn: markWithdrawn,
    getOverallAverage: getOverallAverage,
    getAverageByCategory: getAverageByCategory,
    getAverageByBudgetRange: getAverageByBudgetRange,
    getPending: getPending,
    getDistribution: getDistribution,
    getDashboard: getDashboard,
    getEntries: getEntries,
    removeEntry: removeEntry,
    clearEntries: clearEntries
  };
})();
