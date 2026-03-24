/**
 * [CF-053] Effective Rate Calculator
 * Calculate true hourly rate including proposal writing time, communication
 * overhead, revision time, and admin hours. Track history across projects.
 * Exposed on window.CortexFreelancer.effectiveRateCalculator
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_effective_rates';

  /* ── Storage Helpers ── */

  /**
   * Load rate history from localStorage
   * @returns {Array}
   */
  function loadHistory() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  /**
   * Save rate history to localStorage
   * @param {Array} history
   */
  function saveHistory(history) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch (e) {
      console.warn('[EffectiveRateCalculator] Failed to save:', e);
    }
  }

  /* ── Core Calculation ── */

  /**
   * Calculate effective hourly rate for a project
   * @param {object} params
   * @param {number} params.projectAmount - Total payment received
   * @param {number} params.billedHours - Hours billed to client
   * @param {number} [params.proposalHours=0] - Hours spent writing proposal
   * @param {number} [params.communicationHours=0] - Hours on calls, messages, emails
   * @param {number} [params.revisionHours=0] - Hours on revisions/rework
   * @param {number} [params.adminHours=0] - Hours on invoicing, contracts, etc.
   * @param {string} [params.projectName] - Optional project name
   * @param {string} [params.clientName] - Optional client name
   * @param {boolean} [params.save=true] - Whether to persist to history
   * @returns {object} Rate breakdown and recommendations
   */
  function calculate(params) {
    var projectAmount = params.projectAmount || 0;
    var billedHours = params.billedHours || 0;
    var proposalHours = params.proposalHours || 0;
    var communicationHours = params.communicationHours || 0;
    var revisionHours = params.revisionHours || 0;
    var adminHours = params.adminHours || 0;
    var shouldSave = params.save !== false;

    var totalOverheadHours = proposalHours + communicationHours + revisionHours + adminHours;
    var totalHours = billedHours + totalOverheadHours;

    var billedRate = billedHours > 0 ? projectAmount / billedHours : 0;
    var effectiveRate = totalHours > 0 ? projectAmount / totalHours : 0;
    var overheadPercentage = totalHours > 0
      ? Math.round((totalOverheadHours / totalHours) * 100)
      : 0;

    var breakdownByActivity = [
      {
        activity: 'Billed Work',
        hours: billedHours,
        percentage: totalHours > 0 ? Math.round((billedHours / totalHours) * 100) : 0,
        costEquivalent: billedHours > 0 ? Math.round(billedHours * effectiveRate * 100) / 100 : 0
      },
      {
        activity: 'Proposal Writing',
        hours: proposalHours,
        percentage: totalHours > 0 ? Math.round((proposalHours / totalHours) * 100) : 0,
        costEquivalent: Math.round(proposalHours * effectiveRate * 100) / 100
      },
      {
        activity: 'Communication',
        hours: communicationHours,
        percentage: totalHours > 0 ? Math.round((communicationHours / totalHours) * 100) : 0,
        costEquivalent: Math.round(communicationHours * effectiveRate * 100) / 100
      },
      {
        activity: 'Revisions',
        hours: revisionHours,
        percentage: totalHours > 0 ? Math.round((revisionHours / totalHours) * 100) : 0,
        costEquivalent: Math.round(revisionHours * effectiveRate * 100) / 100
      },
      {
        activity: 'Admin',
        hours: adminHours,
        percentage: totalHours > 0 ? Math.round((adminHours / totalHours) * 100) : 0,
        costEquivalent: Math.round(adminHours * effectiveRate * 100) / 100
      }
    ];

    var recommendations = generateRecommendations(
      billedRate, effectiveRate, overheadPercentage, breakdownByActivity
    );

    var result = {
      projectAmount: projectAmount,
      billedHours: billedHours,
      totalHours: Math.round(totalHours * 100) / 100,
      overheadHours: Math.round(totalOverheadHours * 100) / 100,
      billedRate: Math.round(billedRate * 100) / 100,
      effectiveRate: Math.round(effectiveRate * 100) / 100,
      overheadPercentage: overheadPercentage,
      rateDifference: Math.round((billedRate - effectiveRate) * 100) / 100,
      breakdownByActivity: breakdownByActivity,
      recommendations: recommendations,
      projectName: params.projectName || '',
      clientName: params.clientName || '',
      timestamp: new Date().toISOString()
    };

    if (shouldSave) {
      var history = loadHistory();
      history.push(result);
      // Keep last 200 entries
      if (history.length > 200) {
        history = history.slice(history.length - 200);
      }
      saveHistory(history);
    }

    return result;
  }

  /**
   * Generate recommendations based on the rate analysis
   * @param {number} billedRate
   * @param {number} effectiveRate
   * @param {number} overheadPct
   * @param {Array} breakdown
   * @returns {string[]}
   */
  function generateRecommendations(billedRate, effectiveRate, overheadPct, breakdown) {
    var recs = [];

    if (overheadPct > 40) {
      recs.push('Your overhead is ' + overheadPct + '% of total time. Aim for under 30% by streamlining processes.');
    } else if (overheadPct > 25) {
      recs.push('Overhead is moderate at ' + overheadPct + '%. Look for areas to optimize.');
    } else {
      recs.push('Good job keeping overhead low at ' + overheadPct + '%.');
    }

    // Find the largest overhead category
    var maxOverhead = { activity: '', hours: 0 };
    for (var i = 1; i < breakdown.length; i++) { // skip index 0 (billed work)
      if (breakdown[i].hours > maxOverhead.hours) {
        maxOverhead = breakdown[i];
      }
    }

    if (maxOverhead.activity === 'Proposal Writing' && maxOverhead.percentage > 15) {
      recs.push('Proposal writing takes ' + maxOverhead.percentage + '% of project time. Use templates and pre-written snippets to speed up.');
    }

    if (maxOverhead.activity === 'Revisions' && maxOverhead.percentage > 15) {
      recs.push('Revisions consume ' + maxOverhead.percentage + '% of time. Clarify requirements upfront and get written approval at milestones.');
    }

    if (maxOverhead.activity === 'Communication' && maxOverhead.percentage > 15) {
      recs.push('Communication overhead is ' + maxOverhead.percentage + '%. Consider batching communications and setting scheduled check-in times.');
    }

    if (maxOverhead.activity === 'Admin' && maxOverhead.percentage > 10) {
      recs.push('Admin tasks take ' + maxOverhead.percentage + '%. Automate invoicing and use contract templates.');
    }

    var rateDropPct = billedRate > 0 ? Math.round(((billedRate - effectiveRate) / billedRate) * 100) : 0;
    if (rateDropPct > 30) {
      recs.push('Your effective rate is ' + rateDropPct + '% lower than billed rate. Consider raising your quoted rate by at least ' + Math.round(rateDropPct / 2) + '% to compensate.');
    } else if (rateDropPct > 15) {
      recs.push('Your effective rate drops ' + rateDropPct + '% from billed. Factor overhead into future quotes.');
    }

    return recs;
  }

  /**
   * Get averages across all tracked projects
   * @returns {object} Aggregated averages
   */
  function getAverages() {
    var history = loadHistory();
    if (history.length === 0) {
      return {
        totalProjects: 0,
        avgBilledRate: 0,
        avgEffectiveRate: 0,
        avgOverheadPercentage: 0,
        avgBreakdown: {
          proposalPct: 0,
          communicationPct: 0,
          revisionPct: 0,
          adminPct: 0
        },
        totalRevenue: 0,
        totalHours: 0
      };
    }

    var sumBilledRate = 0;
    var sumEffectiveRate = 0;
    var sumOverhead = 0;
    var sumProposalPct = 0;
    var sumCommPct = 0;
    var sumRevisionPct = 0;
    var sumAdminPct = 0;
    var totalRevenue = 0;
    var totalHours = 0;

    for (var i = 0; i < history.length; i++) {
      var h = history[i];
      sumBilledRate += h.billedRate || 0;
      sumEffectiveRate += h.effectiveRate || 0;
      sumOverhead += h.overheadPercentage || 0;
      totalRevenue += h.projectAmount || 0;
      totalHours += h.totalHours || 0;

      var bd = h.breakdownByActivity || [];
      for (var j = 0; j < bd.length; j++) {
        if (bd[j].activity === 'Proposal Writing') sumProposalPct += bd[j].percentage || 0;
        if (bd[j].activity === 'Communication') sumCommPct += bd[j].percentage || 0;
        if (bd[j].activity === 'Revisions') sumRevisionPct += bd[j].percentage || 0;
        if (bd[j].activity === 'Admin') sumAdminPct += bd[j].percentage || 0;
      }
    }

    var n = history.length;
    return {
      totalProjects: n,
      avgBilledRate: Math.round((sumBilledRate / n) * 100) / 100,
      avgEffectiveRate: Math.round((sumEffectiveRate / n) * 100) / 100,
      avgOverheadPercentage: Math.round(sumOverhead / n),
      avgBreakdown: {
        proposalPct: Math.round(sumProposalPct / n),
        communicationPct: Math.round(sumCommPct / n),
        revisionPct: Math.round(sumRevisionPct / n),
        adminPct: Math.round(sumAdminPct / n)
      },
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalHours: Math.round(totalHours * 100) / 100
    };
  }

  /**
   * Get full calculation history
   * @returns {Array}
   */
  function getHistory() {
    return loadHistory();
  }

  /**
   * Clear all stored rate history
   */
  function clearHistory() {
    saveHistory([]);
  }

  /* ── Public API ── */
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.effectiveRateCalculator = {
    calculate: calculate,
    getAverages: getAverages,
    getHistory: getHistory,
    clearHistory: clearHistory
  };
})();
