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

  /* ── Render / Destroy ── */

  var _container = null;
  var CSS_INJECTED = false;

  function escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function _injectCSS() {
    if (CSS_INJECTED) return;
    CSS_INJECTED = true;
    var style = document.createElement('style');
    style.id = 'cf-csp-styles';
    style.textContent = [
      '.csp-panel{background:#0a0a0a;border:1px solid #1e1e1e;border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#e0e0e0;max-width:640px;overflow:hidden}',
      '.csp-header{padding:16px 20px;border-bottom:1px solid #1e1e1e;font-size:16px;font-weight:700}',
      '.csp-body{padding:16px 20px}',
      '.csp-form-row{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px}',
      '.csp-form-label{display:block;color:#888;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px}',
      '.csp-form-input{width:100%;padding:7px 10px;background:#111;border:1px solid #222;border-radius:6px;color:#e0e0e0;font-size:13px;outline:none;box-sizing:border-box}',
      '.csp-form-input:focus{border-color:#7c3aed}',
      '.csp-btn{background:#7c3aed;color:#fff;border:none;border-radius:8px;padding:8px 20px;font-size:13px;font-weight:600;cursor:pointer;width:100%;margin-top:10px}',
      '.csp-btn:hover{background:#6d28d9}',
      '.csp-btn-secondary{background:#1e1e1e;color:#ccc;border:1px solid #333;border-radius:8px;padding:6px 14px;font-size:12px;font-weight:600;cursor:pointer;margin-top:8px}',
      '.csp-btn-secondary:hover{background:#292929}',
      '.csp-btn-danger{background:#1e1e1e;color:#ef4444;border:1px solid #333;border-radius:8px;padding:6px 14px;font-size:12px;font-weight:600;cursor:pointer}',
      '.csp-btn-danger:hover{background:#292929}',
      '.csp-toggle-row{display:flex;align-items:center;gap:10px;margin:10px 0}',
      '.csp-toggle-label{color:#aaa;font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px}',
      '.csp-toggle-label input[type="checkbox"]{accent-color:#7c3aed;width:14px;height:14px}',
      '.csp-enhanced-fields{background:#111;border:1px solid #1e1e1e;border-radius:8px;padding:12px;margin:10px 0}',
      '.csp-enhanced-fields .csp-form-label{color:#7c3aed}',
      '.csp-compare-section{background:#111;border:1px solid #1e1e1e;border-radius:8px;padding:14px;margin:10px 0}',
      '.csp-compare-section .csp-form-label{color:#eab308}',
      '.csp-compare-table{width:100%;border-collapse:collapse;margin-top:12px;font-size:12px}',
      '.csp-compare-table th{text-align:left;padding:6px 8px;border-bottom:1px solid #222;color:#888;font-weight:600}',
      '.csp-compare-table td{padding:6px 8px;border-bottom:1px solid #111;color:#ccc}',
      '.csp-compare-table tr:hover td{background:#1a1a1a}',
      '.csp-score-ring{width:80px;height:80px;position:relative;margin:0 auto}',
      '.csp-score-ring svg{transform:rotate(-90deg)}',
      '.csp-score-value{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700}',
      '.csp-factor{padding:8px 0;border-bottom:1px solid #111}',
      '.csp-factor:last-child{border-bottom:none}',
      '.csp-factor-header{display:flex;justify-content:space-between;align-items:center;gap:10px}',
      '.csp-factor-name{color:#ccc;font-size:13px;font-weight:600}',
      '.csp-factor-detail{color:#888;font-size:12px;margin-top:2px}',
      '.csp-factor-score{color:#7c3aed;font-size:14px;font-weight:700;flex-shrink:0}',
      '.csp-bar-track{height:6px;background:#1a1a1a;border-radius:3px;margin-top:6px;overflow:hidden}',
      '.csp-bar-fill{height:100%;border-radius:3px;transition:width .3s ease}',
      '.csp-history-toggle{background:none;border:1px solid #222;color:#888;border-radius:6px;padding:6px 12px;font-size:12px;cursor:pointer;width:100%;text-align:left;margin-top:14px}',
      '.csp-history-toggle:hover{border-color:#333;color:#aaa}',
      '.csp-history-panel{background:#111;border:1px solid #1e1e1e;border-radius:8px;margin-top:8px;overflow:hidden}',
      '.csp-history-item{display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border-bottom:1px solid #1a1a1a;font-size:12px}',
      '.csp-history-item:last-child{border-bottom:none}',
      '.csp-history-score{font-weight:700;font-size:13px}',
      '.csp-history-risk{font-size:11px;font-weight:600;text-transform:uppercase}',
      '.csp-history-time{color:#555;font-size:11px}',
      '.csp-history-footer{padding:8px 12px;border-top:1px solid #1e1e1e;text-align:right}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function _scoreColor(score) {
    if (score >= 70) return '#22c55e';
    if (score >= 40) return '#eab308';
    return '#ef4444';
  }

  function _barColor(score, maxScore) {
    var pct = maxScore > 0 ? score / maxScore : 0;
    if (pct >= 0.7) return '#22c55e';
    if (pct >= 0.4) return '#eab308';
    return '#ef4444';
  }

  function _renderResult(result) {
    var color = _scoreColor(result.score);
    var circumference = 2 * Math.PI * 34;
    var offset = circumference - (result.score / 100) * circumference;

    var h = '<div style="text-align:center;margin:16px 0">';
    h += '<div class="csp-score-ring"><svg width="80" height="80" viewBox="0 0 80 80">';
    h += '<circle cx="40" cy="40" r="34" fill="none" stroke="#1a1a1a" stroke-width="6"/>';
    h += '<circle cx="40" cy="40" r="34" fill="none" stroke="' + color + '" stroke-width="6" stroke-dasharray="' + circumference + '" stroke-dashoffset="' + offset + '" stroke-linecap="round"/>';
    h += '</svg><div class="csp-score-value" style="color:' + color + '">' + result.score + '</div></div>';
    h += '<div style="font-size:12px;color:#888;margin-top:6px">Risk: <span style="color:' + color + ';font-weight:600">' + result.riskLevel.toUpperCase() + '</span></div>';
    h += '</div>';

    h += '<div style="color:#999;font-size:13px;margin-bottom:14px;line-height:1.5">' + escapeHtml(result.recommendation) + '</div>';

    h += '<div style="font-size:13px;font-weight:600;color:#ccc;margin-bottom:8px">Scoring Factors</div>';
    for (var i = 0; i < result.factors.length; i++) {
      var f = result.factors[i];
      var maxImpact = 25;
      var barPct = Math.round(clamp((f.impact / maxImpact) * 100, 0, 100));
      var bColor = _barColor(f.impact, maxImpact);
      h += '<div class="csp-factor">';
      h += '<div class="csp-factor-header"><div class="csp-factor-name">' + escapeHtml(f.name) + '</div>';
      h += '<div class="csp-factor-score">' + f.impact + '/25</div></div>';
      h += '<div class="csp-bar-track"><div class="csp-bar-fill" style="width:' + barPct + '%;background:' + bColor + '"></div></div>';
      h += '<div class="csp-factor-detail">' + escapeHtml(f.detail) + '</div>';
      h += '</div>';
    }
    return h;
  }

  function _renderComparisonTable(results) {
    if (!results || !results.length) return '<div style="color:#888;font-size:12px">No comparison data.</div>';

    var h = '<div style="font-size:13px;font-weight:600;color:#ccc;margin:16px 0 8px">Comparison Results</div>';
    h += '<table class="csp-compare-table"><thead><tr>';
    h += '<th>Job</th><th>Score</th><th>Risk</th><th>Spend</th><th>Rating</th><th>Budget</th><th>Scope</th>';
    h += '</tr></thead><tbody>';

    for (var i = 0; i < results.length; i++) {
      var r = results[i];
      var c = _scoreColor(r.score);
      h += '<tr>';
      h += '<td style="font-weight:600">' + escapeHtml(r.label) + '</td>';
      h += '<td><span class="csp-history-score" style="color:' + c + '">' + r.score + '</span></td>';
      h += '<td><span class="csp-history-risk" style="color:' + c + '">' + r.riskLevel.toUpperCase() + '</span></td>';
      for (var j = 0; j < 4 && j < r.factors.length; j++) {
        h += '<td>' + r.factors[j].impact + '/25</td>';
      }
      h += '</tr>';
    }
    h += '</tbody></table>';
    return h;
  }

  function _renderHistoryPanel(historyItems) {
    if (!historyItems || !historyItems.length) {
      return '<div style="padding:12px;color:#555;font-size:12px;text-align:center">No predictions yet.</div>';
    }

    var h = '';
    var show = historyItems.slice(-10).reverse();
    for (var i = 0; i < show.length; i++) {
      var item = show[i];
      var c = _scoreColor(item.score);
      var ts = item.timestamp ? new Date(item.timestamp).toLocaleString() : 'Unknown';
      h += '<div class="csp-history-item">';
      h += '<span class="csp-history-score" style="color:' + c + '">' + item.score + '</span>';
      h += '<span class="csp-history-risk" style="color:' + c + '">' + (item.riskLevel || 'N/A').toUpperCase() + '</span>';
      h += '<span class="csp-history-time">' + escapeHtml(ts) + '</span>';
      h += '</div>';
    }
    return h;
  }

  /**
   * Render the predictor UI into a container.
   * @param {HTMLElement|string} container
   */
  function render(container) {
    init();
    _injectCSS();
    var el = typeof container === 'string' ? document.querySelector(container) : container;
    if (!el) return;
    _container = el;

    var h = '<div class="csp-panel"><div class="csp-header">Client Satisfaction Predictor</div><div class="csp-body">';
    h += '<div class="csp-form-row">';
    h += '<div><label class="csp-form-label">Job Budget ($)</label><input type="number" class="csp-form-input" id="csp-budget" min="0" placeholder="500"></div>';
    h += '<div><label class="csp-form-label">Complexity (1-10)</label><input type="number" class="csp-form-input" id="csp-complexity" min="1" max="10" placeholder="5"></div>';
    h += '</div>';
    h += '<div class="csp-form-row">';
    h += '<div><label class="csp-form-label">Client Total Spent ($)</label><input type="number" class="csp-form-input" id="csp-spent" min="0" placeholder="10000"></div>';
    h += '<div><label class="csp-form-label">Client Avg Rating</label><input type="number" class="csp-form-input" id="csp-rating" min="0" max="5" step="0.1" placeholder="4.5"></div>';
    h += '</div>';
    h += '<div class="csp-form-row">';
    h += '<div><label class="csp-form-label">Hire Rate (0-1)</label><input type="number" class="csp-form-input" id="csp-hirerate" min="0" max="1" step="0.01" placeholder="0.6"></div>';
    h += '<div><label class="csp-form-label">Dispute Rate (0-1)</label><input type="number" class="csp-form-input" id="csp-dispute" min="0" max="1" step="0.01" placeholder="0.02"></div>';
    h += '</div>';
    h += '<div><label class="csp-form-label">Requirements (one per line)</label><textarea class="csp-form-input" id="csp-reqs" rows="3" placeholder="Build responsive landing page\nIntegrate Stripe payments\nDeploy to AWS" style="resize:vertical;font-family:inherit"></textarea></div>';
    h += '<button class="csp-btn" id="csp-predict-btn">Predict Satisfaction</button>';
    h += '<div id="csp-results" style="margin-top:16px"></div>';
    h += '</div></div>';

    el.innerHTML = h;

    el.querySelector('#csp-predict-btn').addEventListener('click', function () {
      var val = function (id) { var e = el.querySelector('#' + id); return e ? e.value.trim() : ''; };
      var num = function (id) { var v = parseFloat(val(id)); return isNaN(v) ? undefined : v; };
      var reqs = val('csp-reqs').split('\n').filter(function (l) { return l.trim().length > 0; });

      var result = predict({
        clientHistory: { totalSpent: num('csp-spent') || 0, avgRating: num('csp-rating') || 0, hireRate: num('csp-hirerate') || 0, disputeRate: num('csp-dispute') || 0 },
        jobBudget: num('csp-budget') || 0,
        jobRequirements: reqs,
        complexityScore: num('csp-complexity') || 5
      });

      el.querySelector('#csp-results').innerHTML = _renderResult(result);
    });
  }

  /** Tear down and clean up. */
  function destroy() {
    if (_container) { _container.innerHTML = ''; _container = null; }
    CSS_INJECTED = false;
    var styleEl = document.getElementById('cf-csp-styles');
    if (styleEl && styleEl.parentNode) styleEl.parentNode.removeChild(styleEl);
  }

  /* ── Public API ── */
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.ClientSatisfactionPredictor = {
    init: init,
    render: render,
    destroy: destroy,
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
