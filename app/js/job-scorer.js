/**
 * [CF-019] Job Quality Scoring Algorithm
 * Scores jobs 1-10 based on budget, client history, description quality,
 * competition level, and payment verification.
 * Exposed as window.CortexFreelancer.JobScorer
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  /* ───────── Default market rates (USD/hr) by broad category ───────── */

  var DEFAULT_MARKET_RATES = {
    'web dev':        60,
    'mobile':         70,
    'design':         50,
    'writing':        40,
    'marketing':      50,
    'data science':   80,
    'devops':         75,
    'qa':             45,
    'pm':             65,
    'consulting':     95,
  };

  /* ───────── Helpers ───────── */

  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  function wordCount(text) {
    if (!text) return 0;
    return text.trim().split(/\s+/).filter(Boolean).length;
  }

  /** Estimate market rate — use RateBenchmark if available, else defaults */
  function getMarketRate(category, country) {
    if (window.CortexFreelancer && window.CortexFreelancer.RateBenchmark) {
      var bm = window.CortexFreelancer.RateBenchmark.getRateBenchmark(category, country);
      if (bm) return bm.median;
    }
    var key = (category || '').toLowerCase();
    return DEFAULT_MARKET_RATES[key] || 50;
  }

  /* ───────── Factor scorers (each returns 1-10) ───────── */

  /**
   * Budget/rate factor: how does the offered rate compare to market?
   * @param {object} job
   * @param {number} marketRate
   * @returns {{score: number, reasoning: string}}
   */
  function scoreBudget(job, marketRate) {
    var budget = parseFloat(job.budget) || 0;
    var budgetType = (job.budgetType || 'hourly').toLowerCase();
    var effectiveRate;

    if (budgetType === 'hourly') {
      effectiveRate = budget;
    } else {
      // For fixed: estimate hours from description length as rough proxy
      var hours = Math.max(1, wordCount(job.description) / 20);
      effectiveRate = budget / hours;
    }

    if (effectiveRate <= 0) {
      return { score: 3, reasoning: 'No budget specified — could be negotiable or low quality' };
    }

    var ratio = effectiveRate / marketRate;

    if (ratio >= 1.5) return { score: 10, reasoning: 'Budget is ' + Math.round(ratio * 100) + '% of market rate — excellent pay' };
    if (ratio >= 1.2) return { score: 9, reasoning: 'Budget is above market rate — strong opportunity' };
    if (ratio >= 1.0) return { score: 8, reasoning: 'Budget matches market rate' };
    if (ratio >= 0.8) return { score: 6, reasoning: 'Budget is slightly below market rate' };
    if (ratio >= 0.5) return { score: 4, reasoning: 'Budget is significantly below market — ' + Math.round(ratio * 100) + '% of typical rate' };
    return { score: 2, reasoning: 'Budget is far below market rate — likely low-quality client' };
  }

  /**
   * Client history factor: total spent + hire rate signal trustworthiness.
   * @param {object} job
   * @returns {{score: number, reasoning: string}}
   */
  function scoreClientHistory(job) {
    var totalSpent = parseFloat(job.clientTotalSpent) || 0;
    var hireRate = parseFloat(job.clientHireRate) || 0; // 0-100
    var hireCount = parseInt(job.clientHireCount, 10) || 0;

    var spendScore;
    if (totalSpent >= 100000) spendScore = 10;
    else if (totalSpent >= 50000) spendScore = 9;
    else if (totalSpent >= 10000) spendScore = 7;
    else if (totalSpent >= 1000) spendScore = 5;
    else if (totalSpent > 0) spendScore = 3;
    else spendScore = 2;

    var hireRateScore;
    if (hireRate >= 80) hireRateScore = 10;
    else if (hireRate >= 60) hireRateScore = 7;
    else if (hireRate >= 40) hireRateScore = 5;
    else if (hireRate > 0) hireRateScore = 3;
    else hireRateScore = 4; // unknown

    var combined = Math.round((spendScore * 0.6) + (hireRateScore * 0.4));

    var parts = [];
    if (totalSpent > 0) parts.push('$' + totalSpent.toLocaleString() + ' total spent');
    if (hireRate > 0) parts.push(hireRate + '% hire rate');
    if (hireCount > 0) parts.push(hireCount + ' hires');
    if (parts.length === 0) parts.push('New client with no history');

    return { score: clamp(combined, 1, 10), reasoning: parts.join(', ') };
  }

  /**
   * Description quality factor: length, clarity, structure.
   * @param {object} job
   * @returns {{score: number, reasoning: string}}
   */
  function scoreDescription(job) {
    var desc = (job.description || '').trim();
    var words = wordCount(desc);

    if (words === 0) return { score: 1, reasoning: 'No description provided' };
    if (words < 30) return { score: 3, reasoning: 'Very brief description (' + words + ' words) — unclear scope' };

    var score = 5;
    var reasons = [];

    // Length bonus
    if (words >= 200) { score += 2; reasons.push('detailed description'); }
    else if (words >= 100) { score += 1; reasons.push('adequate length'); }

    // Structure indicators
    var hasDeliverables = /\b(deliverable|milestone|requirement|specification|feature)\b/i.test(desc);
    var hasTimeline = /\b(deadline|timeline|week|month|day|sprint|phase)\b/i.test(desc);
    var hasBullets = /(?:^|\n)\s*[-•*]\s/m.test(desc);

    if (hasDeliverables) { score += 1; reasons.push('clear deliverables'); }
    if (hasTimeline) { score += 1; reasons.push('timeline mentioned'); }
    if (hasBullets) { score += 1; reasons.push('structured formatting'); }

    // Penalty: ALL CAPS
    var letters = desc.replace(/[^a-zA-Z]/g, '');
    if (letters.length > 20 && letters === letters.toUpperCase()) {
      score -= 2;
      reasons.push('ALL CAPS — unprofessional');
    }

    return { score: clamp(score, 1, 10), reasoning: reasons.join(', ') || words + ' words' };
  }

  /**
   * Competition level factor: fewer proposals = better opportunity.
   * @param {object} job
   * @returns {{score: number, reasoning: string}}
   */
  function scoreCompetition(job) {
    var proposals = parseInt(job.proposalCount, 10);
    if (isNaN(proposals)) {
      return { score: 5, reasoning: 'Proposal count unknown' };
    }

    if (proposals <= 5) return { score: 10, reasoning: proposals + ' proposals — low competition, great timing' };
    if (proposals <= 10) return { score: 8, reasoning: proposals + ' proposals — moderate competition' };
    if (proposals <= 20) return { score: 6, reasoning: proposals + ' proposals — competitive' };
    if (proposals <= 35) return { score: 4, reasoning: proposals + ' proposals — crowded, need strong differentiator' };
    return { score: 2, reasoning: proposals + ' proposals — highly saturated, consider skipping' };
  }

  /**
   * Payment verification factor.
   * @param {object} job
   * @returns {{score: number, reasoning: string}}
   */
  function scorePaymentVerified(job) {
    if (job.paymentVerified === true || job.paymentVerified === 'true') {
      return { score: 10, reasoning: 'Payment method verified — lower risk' };
    }
    if (job.paymentVerified === false || job.paymentVerified === 'false') {
      return { score: 3, reasoning: 'Payment NOT verified — higher risk of non-payment' };
    }
    return { score: 5, reasoning: 'Payment verification status unknown' };
  }

  /* ───────── Main scorer ───────── */

  /** Factor weights (must sum to 1) */
  var WEIGHTS = {
    budget:          0.30,
    clientHistory:   0.25,
    description:     0.20,
    competition:     0.15,
    paymentVerified: 0.10,
  };

  /**
   * Score a job listing 1-10.
   * @param {object} jobData
   * @param {object} [jobData.budget] - Offered rate or fixed price
   * @param {string} [jobData.budgetType] - "hourly" or "fixed"
   * @param {string} [jobData.category] - Job category for market rate lookup
   * @param {string} [jobData.country] - Client/market country
   * @param {number} [jobData.clientTotalSpent] - Client's total platform spend
   * @param {number} [jobData.clientHireRate] - Client's hire rate percentage
   * @param {number} [jobData.clientHireCount] - Number of past hires
   * @param {string} [jobData.description] - Job description text
   * @param {number} [jobData.proposalCount] - Number of proposals submitted
   * @param {boolean} [jobData.paymentVerified] - Whether payment is verified
   * @returns {{score: number, factors: Array<{name: string, score: number, weight: number, reasoning: string}>}}
   */
  function scoreJob(jobData) {
    if (!jobData) return { score: 5, factors: [] };

    var marketRate = getMarketRate(jobData.category, jobData.country);

    var factors = [
      { name: 'Budget vs Market Rate', weight: WEIGHTS.budget, ...scoreBudget(jobData, marketRate) },
      { name: 'Client History',        weight: WEIGHTS.clientHistory, ...scoreClientHistory(jobData) },
      { name: 'Description Quality',   weight: WEIGHTS.description, ...scoreDescription(jobData) },
      { name: 'Competition Level',     weight: WEIGHTS.competition, ...scoreCompetition(jobData) },
      { name: 'Payment Verified',      weight: WEIGHTS.paymentVerified, ...scorePaymentVerified(jobData) },
    ];

    // Weighted average
    var weighted = 0;
    for (var i = 0; i < factors.length; i++) {
      weighted += factors[i].score * factors[i].weight;
    }

    var finalScore = clamp(Math.round(weighted), 1, 10);

    return { score: finalScore, factors: factors };
  }

  /* ───────── Public API ───────── */

  window.CortexFreelancer.JobScorer = {
    scoreJob: scoreJob,
    version: '1.0.0',
  };
})();
