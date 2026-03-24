/**
 * [CF-050] Client Satisfaction Predictor
 * Based on job requirements, budget, and client history, predict likelihood
 * of positive outcome. Scores factors like spend history, rating patterns,
 * budget reasonableness, and scope clarity.
 * Exposed on window.CortexFreelancer.clientSatisfactionPredictor
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_satisfaction_predictions';

  /* ── Helpers ── */

  /**
   * Load predictions history from localStorage
   * @returns {Array} Array of past prediction records
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
   * Save predictions history to localStorage
   * @param {Array} history
   */
  function saveHistory(history) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch (e) {
      console.warn('[ClientSatisfactionPredictor] Failed to save:', e);
    }
  }

  /**
   * Clamp a value between min and max
   * @param {number} val
   * @param {number} min
   * @param {number} max
   * @returns {number}
   */
  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  /* ── Scoring Factors ── */

  /**
   * Score client spend history (0-25 points)
   * Higher total spend = more reliable client
   * @param {object} clientHistory
   * @returns {{score: number, detail: string}}
   */
  function scoreSpendHistory(clientHistory) {
    var totalSpent = clientHistory.totalSpent || 0;
    var score = 0;
    var detail = '';

    if (totalSpent >= 100000) {
      score = 25;
      detail = 'Excellent: client has spent $' + Math.round(totalSpent).toLocaleString() + ' on platform';
    } else if (totalSpent >= 50000) {
      score = 22;
      detail = 'Very good: client has significant platform investment ($' + Math.round(totalSpent).toLocaleString() + ')';
    } else if (totalSpent >= 10000) {
      score = 18;
      detail = 'Good: client has reasonable spend history ($' + Math.round(totalSpent).toLocaleString() + ')';
    } else if (totalSpent >= 1000) {
      score = 12;
      detail = 'Moderate: client has limited spend history ($' + Math.round(totalSpent).toLocaleString() + ')';
    } else if (totalSpent > 0) {
      score = 6;
      detail = 'Low: client is relatively new to the platform ($' + Math.round(totalSpent).toLocaleString() + ')';
    } else {
      score = 2;
      detail = 'No spend history: client may be brand new or unverified';
    }

    return { score: score, detail: detail };
  }

  /**
   * Score client rating patterns (0-25 points)
   * @param {object} clientHistory
   * @returns {{score: number, detail: string}}
   */
  function scoreRatingPatterns(clientHistory) {
    var avgRating = clientHistory.avgRating || 0;
    var hireRate = clientHistory.hireRate || 0;
    var disputeRate = clientHistory.disputeRate || 0;
    var score = 0;
    var detail = '';

    // Rating component (0-12)
    var ratingScore = 0;
    if (avgRating >= 4.8) {
      ratingScore = 12;
    } else if (avgRating >= 4.5) {
      ratingScore = 10;
    } else if (avgRating >= 4.0) {
      ratingScore = 7;
    } else if (avgRating >= 3.0) {
      ratingScore = 4;
    } else if (avgRating > 0) {
      ratingScore = 1;
    }

    // Hire rate component (0-8)
    var hireScore = 0;
    if (hireRate >= 0.8) {
      hireScore = 8;
    } else if (hireRate >= 0.5) {
      hireScore = 6;
    } else if (hireRate >= 0.3) {
      hireScore = 4;
    } else if (hireRate > 0) {
      hireScore = 2;
    }

    // Dispute penalty (0 to -5)
    var disputePenalty = 0;
    if (disputeRate > 0.2) {
      disputePenalty = -5;
    } else if (disputeRate > 0.1) {
      disputePenalty = -3;
    } else if (disputeRate > 0.05) {
      disputePenalty = -1;
    }

    score = clamp(ratingScore + hireScore + disputePenalty, 0, 25);

    var parts = [];
    parts.push('Avg rating: ' + (avgRating > 0 ? avgRating.toFixed(1) + '/5' : 'N/A'));
    parts.push('Hire rate: ' + (hireRate > 0 ? Math.round(hireRate * 100) + '%' : 'N/A'));
    if (disputeRate > 0.05) {
      parts.push('Dispute rate: ' + Math.round(disputeRate * 100) + '% (warning)');
    }
    detail = parts.join('; ');

    return { score: score, detail: detail };
  }

  /**
   * Score budget reasonableness (0-25 points)
   * Compares job budget to requirements complexity
   * @param {number} jobBudget
   * @param {string[]} jobRequirements
   * @param {number} complexityScore
   * @returns {{score: number, detail: string}}
   */
  function scoreBudgetReasonableness(jobBudget, jobRequirements, complexityScore) {
    var reqCount = (jobRequirements && jobRequirements.length) || 0;
    var complexity = complexityScore || 5;
    var score = 0;
    var detail = '';

    // Estimate minimum reasonable budget: ~$50 per requirement * complexity factor
    var estimatedMinBudget = reqCount * 50 * (complexity / 5);
    if (estimatedMinBudget < 100) estimatedMinBudget = 100;

    var ratio = jobBudget / estimatedMinBudget;

    if (ratio >= 2.0) {
      score = 25;
      detail = 'Budget is very generous relative to requirements (ratio: ' + ratio.toFixed(1) + 'x)';
    } else if (ratio >= 1.5) {
      score = 22;
      detail = 'Budget is comfortable for the scope (ratio: ' + ratio.toFixed(1) + 'x)';
    } else if (ratio >= 1.0) {
      score = 18;
      detail = 'Budget is adequate for requirements (ratio: ' + ratio.toFixed(1) + 'x)';
    } else if (ratio >= 0.7) {
      score = 12;
      detail = 'Budget is tight for the scope (ratio: ' + ratio.toFixed(1) + 'x). Negotiate or clarify scope';
    } else if (ratio >= 0.4) {
      score = 6;
      detail = 'Budget appears insufficient for requirements (ratio: ' + ratio.toFixed(1) + 'x). High risk of scope issues';
    } else {
      score = 2;
      detail = 'Budget is severely low for stated requirements. Very high risk';
    }

    return { score: score, detail: detail };
  }

  /**
   * Score scope clarity (0-25 points)
   * More detailed requirements = clearer scope = better outcome likelihood
   * @param {string[]} jobRequirements
   * @param {number} complexityScore
   * @returns {{score: number, detail: string}}
   */
  function scoreScopeClarity(jobRequirements, complexityScore) {
    var reqCount = (jobRequirements && jobRequirements.length) || 0;
    var complexity = complexityScore || 5;
    var score = 0;
    var detail = '';

    // Average character length per requirement
    var avgLength = 0;
    if (reqCount > 0) {
      var totalChars = 0;
      for (var i = 0; i < jobRequirements.length; i++) {
        totalChars += (jobRequirements[i] || '').length;
      }
      avgLength = totalChars / reqCount;
    }

    // More requirements with good detail = better clarity
    var reqScore = 0;
    if (reqCount >= 8) {
      reqScore = 12;
    } else if (reqCount >= 5) {
      reqScore = 10;
    } else if (reqCount >= 3) {
      reqScore = 7;
    } else if (reqCount >= 1) {
      reqScore = 4;
    } else {
      reqScore = 0;
    }

    // Detail score based on avg requirement length
    var detailScore = 0;
    if (avgLength >= 50) {
      detailScore = 8;
    } else if (avgLength >= 25) {
      detailScore = 6;
    } else if (avgLength >= 10) {
      detailScore = 3;
    } else {
      detailScore = 1;
    }

    // Complexity vs requirement count mismatch penalty
    var mismatchPenalty = 0;
    if (complexity >= 7 && reqCount < 3) {
      mismatchPenalty = -5;
    } else if (complexity >= 5 && reqCount < 2) {
      mismatchPenalty = -3;
    }

    score = clamp(reqScore + detailScore + mismatchPenalty, 0, 25);

    var parts = [];
    parts.push(reqCount + ' requirement(s) listed');
    if (avgLength >= 25) {
      parts.push('well-detailed descriptions');
    } else if (avgLength > 0) {
      parts.push('brief descriptions');
    }
    if (mismatchPenalty < 0) {
      parts.push('complexity/requirements mismatch');
    }
    detail = parts.join('; ');

    return { score: score, detail: detail };
  }

  /* ── Main Prediction ── */

  /**
   * Predict client satisfaction likelihood
   * @param {object} params
   * @param {object} params.clientHistory - { totalSpent, avgRating, hireRate, disputeRate }
   * @param {number} params.jobBudget - Budget for the job
   * @param {string[]} params.jobRequirements - Array of requirement strings
   * @param {number} params.complexityScore - 1-10 complexity rating
   * @returns {object} { score, riskLevel, factors, recommendation }
   */
  function predict(params) {
    var clientHistory = params.clientHistory || {};
    var jobBudget = params.jobBudget || 0;
    var jobRequirements = params.jobRequirements || [];
    var complexityScore = clamp(params.complexityScore || 5, 1, 10);

    var spendResult = scoreSpendHistory(clientHistory);
    var ratingResult = scoreRatingPatterns(clientHistory);
    var budgetResult = scoreBudgetReasonableness(jobBudget, jobRequirements, complexityScore);
    var scopeResult = scoreScopeClarity(jobRequirements, complexityScore);

    var totalScore = clamp(
      spendResult.score + ratingResult.score + budgetResult.score + scopeResult.score,
      0,
      100
    );

    var riskLevel = 'high';
    if (totalScore >= 70) {
      riskLevel = 'low';
    } else if (totalScore >= 40) {
      riskLevel = 'medium';
    }

    var factors = [
      { name: 'Client Spend History', impact: spendResult.score, detail: spendResult.detail },
      { name: 'Rating & Hire Patterns', impact: ratingResult.score, detail: ratingResult.detail },
      { name: 'Budget Reasonableness', impact: budgetResult.score, detail: budgetResult.detail },
      { name: 'Scope Clarity', impact: scopeResult.score, detail: scopeResult.detail }
    ];

    var recommendation = generateRecommendation(totalScore, riskLevel, factors);

    var result = {
      score: totalScore,
      riskLevel: riskLevel,
      factors: factors,
      recommendation: recommendation,
      timestamp: new Date().toISOString()
    };

    // Persist to history
    var history = loadHistory();
    history.push(result);
    // Keep last 100 predictions
    if (history.length > 100) {
      history = history.slice(history.length - 100);
    }
    saveHistory(history);

    return result;
  }

  /**
   * Generate a human-readable recommendation string
   * @param {number} score
   * @param {string} riskLevel
   * @param {Array} factors
   * @returns {string}
   */
  function generateRecommendation(score, riskLevel, factors) {
    if (riskLevel === 'low') {
      return 'This project looks promising. The client has solid history and the scope is well-defined. Proceed with confidence.';
    }

    // Find the weakest factor
    var weakest = factors[0];
    for (var i = 1; i < factors.length; i++) {
      if (factors[i].impact < weakest.impact) {
        weakest = factors[i];
      }
    }

    if (riskLevel === 'medium') {
      return 'Moderate risk detected. Weakest area: ' + weakest.name + '. Consider clarifying expectations before accepting. Set clear milestones and communication cadence.';
    }

    return 'High risk project. Primary concern: ' + weakest.name + '. Strongly recommend detailed scope documentation, milestone-based payments, and frequent check-ins if proceeding.';
  }

  /**
   * Get all stored prediction history
   * @returns {Array}
   */
  function getHistory() {
    return loadHistory();
  }

  /**
   * Clear all stored predictions
   */
  function clearHistory() {
    saveHistory([]);
  }

  /**
   * Get average prediction score across all history
   * @returns {{averageScore: number, totalPredictions: number, riskDistribution: object}}
   */
  function getStats() {
    var history = loadHistory();
    if (history.length === 0) {
      return { averageScore: 0, totalPredictions: 0, riskDistribution: { low: 0, medium: 0, high: 0 } };
    }

    var totalScore = 0;
    var dist = { low: 0, medium: 0, high: 0 };
    for (var i = 0; i < history.length; i++) {
      totalScore += history[i].score || 0;
      var rl = history[i].riskLevel || 'high';
      dist[rl] = (dist[rl] || 0) + 1;
    }

    return {
      averageScore: Math.round(totalScore / history.length),
      totalPredictions: history.length,
      riskDistribution: dist
    };
  }

  /* ── Enhanced: Freelancer Skill Match Scoring (0-15 bonus) ── */

  /**
   * Score how well freelancer skills match job requirements
   * @param {string[]} freelancerSkills - Freelancer's skill set
   * @param {string[]} jobRequirements - Job requirement strings
   * @returns {{score: number, matchedSkills: string[], missingSkills: string[], matchRate: number, detail: string}}
   */
  function scoreSkillMatch(freelancerSkills, jobRequirements) {
    if (!freelancerSkills || !freelancerSkills.length || !jobRequirements || !jobRequirements.length) {
      return { score: 0, matchedSkills: [], missingSkills: [], matchRate: 0, detail: 'Insufficient data for skill matching' };
    }

    var normalizedSkills = [];
    for (var i = 0; i < freelancerSkills.length; i++) {
      normalizedSkills.push(freelancerSkills[i].toLowerCase().trim());
    }

    var matched = [];
    var missing = [];
    var reqText = jobRequirements.join(' ').toLowerCase();

    for (var j = 0; j < normalizedSkills.length; j++) {
      if (reqText.indexOf(normalizedSkills[j]) !== -1) {
        matched.push(freelancerSkills[j]);
      }
    }

    // Check for requirement keywords not matched by any skill
    var keywords = reqText.split(/[\s,;]+/);
    var techTerms = [];
    for (var k = 0; k < keywords.length; k++) {
      var word = keywords[k].trim();
      if (word.length > 3 && normalizedSkills.indexOf(word) === -1) {
        var isCommon = ['with', 'that', 'this', 'from', 'have', 'will', 'need', 'must', 'should', 'experience', 'work', 'able', 'year', 'years'].indexOf(word) !== -1;
        if (!isCommon && techTerms.indexOf(word) === -1) {
          techTerms.push(word);
        }
      }
    }

    var matchRate = freelancerSkills.length > 0
      ? matched.length / freelancerSkills.length
      : 0;

    var score = 0;
    if (matchRate >= 0.7) score = 15;
    else if (matchRate >= 0.5) score = 12;
    else if (matchRate >= 0.3) score = 8;
    else if (matchRate > 0) score = 4;

    return {
      score: score,
      matchedSkills: matched,
      missingSkills: techTerms.slice(0, 10),
      matchRate: Math.round(matchRate * 100),
      detail: matched.length + ' of ' + freelancerSkills.length + ' skills match (' + Math.round(matchRate * 100) + '%)'
    };
  }

  /* ── Enhanced: Communication Pattern Scoring (0-10 bonus) ── */

  /**
   * Score client communication patterns
   * @param {object} commData
   * @param {number} [commData.avgResponseHours] - Client's average response time in hours
   * @param {number} [commData.messageCount] - Total messages in past projects
   * @param {boolean} [commData.hasDetailedBrief] - Whether the job post is detailed
   * @returns {{score: number, detail: string}}
   */
  function scoreCommunicationPattern(commData) {
    if (!commData) return { score: 0, detail: 'No communication data available' };

    var score = 0;
    var parts = [];

    // Response time component (0-4)
    var avgResp = commData.avgResponseHours;
    if (avgResp !== undefined && avgResp !== null) {
      if (avgResp <= 4) { score += 4; parts.push('Very responsive (avg ' + Math.round(avgResp) + 'h)'); }
      else if (avgResp <= 12) { score += 3; parts.push('Responsive (avg ' + Math.round(avgResp) + 'h)'); }
      else if (avgResp <= 24) { score += 2; parts.push('Moderate response time (' + Math.round(avgResp) + 'h)'); }
      else if (avgResp <= 72) { score += 1; parts.push('Slow to respond (' + Math.round(avgResp) + 'h avg)'); }
      else { parts.push('Very slow response time'); }
    }

    // Message engagement (0-3)
    var msgCount = commData.messageCount || 0;
    if (msgCount >= 20) { score += 3; parts.push('High engagement (' + msgCount + ' msgs)'); }
    else if (msgCount >= 10) { score += 2; parts.push('Good engagement'); }
    else if (msgCount > 0) { score += 1; parts.push('Limited message history'); }

    // Detailed brief (0-3)
    if (commData.hasDetailedBrief) { score += 3; parts.push('Detailed project brief'); }

    return {
      score: clamp(score, 0, 10),
      detail: parts.length > 0 ? parts.join('; ') : 'No communication signals'
    };
  }

  /* ── Enhanced: Timeline Feasibility Scoring (0-10 bonus) ── */

  /**
   * Score whether the project timeline is realistic
   * @param {object} timelineData
   * @param {number} [timelineData.daysAllowed] - Days given to complete
   * @param {number} [timelineData.estimatedDays] - Freelancer's estimated days needed
   * @param {boolean} [timelineData.hasMilestones] - Whether milestones are defined
   * @returns {{score: number, detail: string}}
   */
  function scoreTimelineFeasibility(timelineData) {
    if (!timelineData) return { score: 0, detail: 'No timeline data available' };

    var score = 0;
    var parts = [];

    var allowed = timelineData.daysAllowed || 0;
    var estimated = timelineData.estimatedDays || 0;

    if (allowed > 0 && estimated > 0) {
      var ratio = allowed / estimated;
      if (ratio >= 1.5) { score += 6; parts.push('Generous timeline (ratio: ' + ratio.toFixed(1) + 'x)'); }
      else if (ratio >= 1.0) { score += 4; parts.push('Adequate timeline'); }
      else if (ratio >= 0.7) { score += 2; parts.push('Tight timeline — may need scope adjustment'); }
      else { score += 0; parts.push('Timeline appears unrealistic'); }
    }

    if (timelineData.hasMilestones) {
      score += 4;
      parts.push('Milestones defined');
    }

    return {
      score: clamp(score, 0, 10),
      detail: parts.length > 0 ? parts.join('; ') : 'No timeline info'
    };
  }

  /* ── Enhanced Prediction ── */

  /**
   * Enhanced prediction with skill match, communication, and timeline factors
   * @param {object} params - Same as predict() plus optional enhanced fields
   * @param {string[]} [params.freelancerSkills] - Freelancer's skills for matching
   * @param {object} [params.communicationData] - {avgResponseHours, messageCount, hasDetailedBrief}
   * @param {object} [params.timelineData] - {daysAllowed, estimatedDays, hasMilestones}
   * @returns {object} Enhanced prediction with additional factors
   */
  function predictEnhanced(params) {
    var baseResult = predict(params);

    var skillResult = scoreSkillMatch(params.freelancerSkills, params.jobRequirements);
    var commResult = scoreCommunicationPattern(params.communicationData);
    var timelineResult = scoreTimelineFeasibility(params.timelineData);

    // Add bonus points (max 35 bonus on top of base 100)
    var bonusScore = skillResult.score + commResult.score + timelineResult.score;
    var enhancedScore = clamp(baseResult.score + bonusScore, 0, 100);

    // Recalculate risk level with enhanced score
    var riskLevel = 'high';
    if (enhancedScore >= 70) riskLevel = 'low';
    else if (enhancedScore >= 40) riskLevel = 'medium';

    var enhancedFactors = baseResult.factors.concat([
      { name: 'Skill Match', impact: skillResult.score, detail: skillResult.detail },
      { name: 'Communication Patterns', impact: commResult.score, detail: commResult.detail },
      { name: 'Timeline Feasibility', impact: timelineResult.score, detail: timelineResult.detail }
    ]);

    return {
      score: enhancedScore,
      baseScore: baseResult.score,
      bonusScore: bonusScore,
      riskLevel: riskLevel,
      factors: enhancedFactors,
      skillMatch: {
        matchedSkills: skillResult.matchedSkills,
        missingSkills: skillResult.missingSkills,
        matchRate: skillResult.matchRate
      },
      recommendation: generateRecommendation(enhancedScore, riskLevel, enhancedFactors),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Compare multiple job opportunities side by side
   * @param {Array<object>} jobs - Array of predict() param objects
   * @returns {Array<object>} Sorted by score (highest first)
   */
  function compareOpportunities(jobs) {
    if (!jobs || !jobs.length) return [];

    var results = [];
    for (var i = 0; i < jobs.length; i++) {
      var result = jobs[i].freelancerSkills ? predictEnhanced(jobs[i]) : predict(jobs[i]);
      result.jobIndex = i;
      result.label = jobs[i].label || 'Job ' + (i + 1);
      results.push(result);
    }

    results.sort(function (a, b) { return b.score - a.score; });
    return results;
  }

  /**
   * Initialize the module
   * @returns {object} Current stats
   */
  function init() {
    return getStats();
  }

  /* ── Public API ── */
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.clientSatisfactionPredictor = {
    init: init,
    predict: predict,
    predictEnhanced: predictEnhanced,
    compareOpportunities: compareOpportunities,
    scoreSkillMatch: scoreSkillMatch,
    scoreCommunicationPattern: scoreCommunicationPattern,
    scoreTimelineFeasibility: scoreTimelineFeasibility,
    getHistory: getHistory,
    clearHistory: clearHistory,
    getStats: getStats
  };
})();
