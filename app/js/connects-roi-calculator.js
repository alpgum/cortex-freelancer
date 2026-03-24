/**
 * [CF-058] Connects ROI Calculator
 * Enhanced ROI calculations reading from localStorage 'cortex_connects_log'.
 * Exposed on window.CortexFreelancer.connectsROICalculator
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_connects_log';
  var COST_PER_CONNECT = 0.15;

  /**
   * Read the connects log from localStorage.
   * Expected format: Array of { date, jobTitle, category, connectsUsed, hired (bool), earned (number) }
   * @returns {Array<{date: string, jobTitle: string, category: string, connectsUsed: number, hired: boolean, earned: number}>}
   */
  function readLog() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.warn('[CF-058] Failed to read connects log:', e);
      return [];
    }
  }

  /**
   * Filter log entries within the last N days.
   * @param {Array} log
   * @param {number} days
   * @returns {Array}
   */
  function filterByDays(log, days) {
    if (!days || days <= 0) return log;
    var cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    var cutoffTime = cutoff.getTime();

    return log.filter(function (entry) {
      if (!entry.date) return false;
      return new Date(entry.date).getTime() >= cutoffTime;
    });
  }

  /**
   * Calculate ROI for connects spent over a given period.
   * ROI = (total earned from hired jobs) / (total connects x $0.15)
   * @param {number} [days=0] - Number of days to look back. 0 means all time.
   * @returns {{totalConnectsUsed: number, totalCost: number, totalEarned: number, totalApplications: number, hiredCount: number, roi: number, hireRate: number}}
   */
  function calculateROI(days) {
    var log = readLog();
    var entries = filterByDays(log, days || 0);

    var totalConnectsUsed = 0;
    var totalEarned = 0;
    var hiredCount = 0;

    for (var i = 0; i < entries.length; i++) {
      var entry = entries[i];
      totalConnectsUsed += (entry.connectsUsed || 0);
      if (entry.hired) {
        hiredCount++;
        totalEarned += (entry.earned || 0);
      }
    }

    var totalCost = Math.round(totalConnectsUsed * COST_PER_CONNECT * 100) / 100;
    var roi = totalCost > 0 ? Math.round((totalEarned / totalCost) * 100) / 100 : 0;
    var hireRate = entries.length > 0 ? Math.round((hiredCount / entries.length) * 10000) / 10000 : 0;

    return {
      totalConnectsUsed: totalConnectsUsed,
      totalCost: totalCost,
      totalEarned: Math.round(totalEarned * 100) / 100,
      totalApplications: entries.length,
      hiredCount: hiredCount,
      roi: roi,
      hireRate: hireRate
    };
  }

  /**
   * Calculate cost per hire (average connects cost per successful hire).
   * @returns {{costPerHire: number, totalHires: number, totalCostForHires: number}}
   */
  function getCostPerHire() {
    var log = readLog();
    var hiredEntries = log.filter(function (e) { return e.hired; });

    var totalConnectsForHires = 0;
    for (var i = 0; i < hiredEntries.length; i++) {
      totalConnectsForHires += (hiredEntries[i].connectsUsed || 0);
    }

    var totalCost = Math.round(totalConnectsForHires * COST_PER_CONNECT * 100) / 100;
    var costPerHire = hiredEntries.length > 0
      ? Math.round((totalCost / hiredEntries.length) * 100) / 100
      : 0;

    return {
      costPerHire: costPerHire,
      totalHires: hiredEntries.length,
      totalCostForHires: totalCost
    };
  }

  /**
   * Determine the optimal number of connects per job based on historical hire success.
   * @returns {{optimalConnects: number, avgConnectsHired: number, avgConnectsNotHired: number}}
   */
  function getOptimalConnectsPerJob() {
    var log = readLog();
    var hiredConnects = [];
    var notHiredConnects = [];

    for (var i = 0; i < log.length; i++) {
      var entry = log[i];
      var c = entry.connectsUsed || 0;
      if (entry.hired) {
        hiredConnects.push(c);
      } else {
        notHiredConnects.push(c);
      }
    }

    var avgHired = hiredConnects.length > 0
      ? Math.round(hiredConnects.reduce(function (a, b) { return a + b; }, 0) / hiredConnects.length)
      : 0;
    var avgNotHired = notHiredConnects.length > 0
      ? Math.round(notHiredConnects.reduce(function (a, b) { return a + b; }, 0) / notHiredConnects.length)
      : 0;

    return {
      optimalConnects: avgHired || 6,
      avgConnectsHired: avgHired,
      avgConnectsNotHired: avgNotHired
    };
  }

  /**
   * Get overall connects efficiency metrics.
   * @returns {{totalConnects: number, totalApplications: number, avgConnectsPerApp: number, connectsToHireRatio: number, estimatedMonthlySpend: number}}
   */
  function getConnectsEfficiency() {
    var log = readLog();
    var totalConnects = 0;
    var hiredCount = 0;

    for (var i = 0; i < log.length; i++) {
      totalConnects += (log[i].connectsUsed || 0);
      if (log[i].hired) hiredCount++;
    }

    var avgPerApp = log.length > 0
      ? Math.round((totalConnects / log.length) * 100) / 100
      : 0;
    var connectsToHire = hiredCount > 0
      ? Math.round(totalConnects / hiredCount)
      : 0;

    var last30 = filterByDays(log, 30);
    var last30Connects = 0;
    for (var j = 0; j < last30.length; j++) {
      last30Connects += (last30[j].connectsUsed || 0);
    }

    return {
      totalConnects: totalConnects,
      totalApplications: log.length,
      avgConnectsPerApp: avgPerApp,
      connectsToHireRatio: connectsToHire,
      estimatedMonthlySpend: Math.round(last30Connects * COST_PER_CONNECT * 100) / 100
    };
  }

  /**
   * Get hire rate per job category, sorted best to worst.
   * @returns {Array<{category: string, applications: number, hires: number, hireRate: number, totalEarned: number, avgConnects: number}>}
   */
  function getBestPerformingCategories() {
    var log = readLog();
    var categoryMap = {};

    for (var i = 0; i < log.length; i++) {
      var entry = log[i];
      var cat = entry.category || 'Uncategorized';
      if (!categoryMap[cat]) {
        categoryMap[cat] = { applications: 0, hires: 0, totalEarned: 0, totalConnects: 0 };
      }
      categoryMap[cat].applications++;
      categoryMap[cat].totalConnects += (entry.connectsUsed || 0);
      if (entry.hired) {
        categoryMap[cat].hires++;
        categoryMap[cat].totalEarned += (entry.earned || 0);
      }
    }

    var categories = Object.keys(categoryMap);
    var result = categories.map(function (cat) {
      var data = categoryMap[cat];
      return {
        category: cat,
        applications: data.applications,
        hires: data.hires,
        hireRate: data.applications > 0
          ? Math.round((data.hires / data.applications) * 10000) / 10000
          : 0,
        totalEarned: Math.round(data.totalEarned * 100) / 100,
        avgConnects: data.applications > 0
          ? Math.round(data.totalConnects / data.applications)
          : 0
      };
    });

    result.sort(function (a, b) { return b.hireRate - a.hireRate; });
    return result;
  }

  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.connectsROICalculator = {
    calculateROI: calculateROI,
    getCostPerHire: getCostPerHire,
    getOptimalConnectsPerJob: getOptimalConnectsPerJob,
    getConnectsEfficiency: getConnectsEfficiency,
    getBestPerformingCategories: getBestPerformingCategories
  };
})();
