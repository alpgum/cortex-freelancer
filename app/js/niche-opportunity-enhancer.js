/**
 * [CF-063] Niche Opportunity Enhancer
 * Deeper opportunity analysis that enhances niche-finder.js.
 * Scores niches by demand growth, competition saturation, rate premium,
 * and entry difficulty.
 *
 * Reads from localStorage 'cortex_niche_analysis' for cached results.
 * Exposed on window.CortexFreelancer.nicheOpportunityEnhancer
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_niche_analysis';
  var CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

  // ─── Niche Benchmark Data ───────────────────────────────────────────
  // Each niche has metrics for scoring opportunity
  var NICHE_DATA = {
    'AI/LLM Integration':       { demandGrowth: 0.45, saturation: 0.20, ratePremium: 1.6, entryDifficulty: 0.7, avgMonthlyJobs: 5200, avgRate: 80 },
    'NLP/Conversational AI':    { demandGrowth: 0.30, saturation: 0.25, ratePremium: 1.5, entryDifficulty: 0.8, avgMonthlyJobs: 2100, avgRate: 75 },
    'RAG Applications':         { demandGrowth: 0.50, saturation: 0.15, ratePremium: 1.7, entryDifficulty: 0.75, avgMonthlyJobs: 1800, avgRate: 85 },
    'AI Agent Development':     { demandGrowth: 0.55, saturation: 0.12, ratePremium: 1.8, entryDifficulty: 0.8, avgMonthlyJobs: 1200, avgRate: 90 },
    'Data Engineering':         { demandGrowth: 0.20, saturation: 0.35, ratePremium: 1.3, entryDifficulty: 0.6, avgMonthlyJobs: 3000, avgRate: 68 },
    'DevOps/Platform Eng':      { demandGrowth: 0.14, saturation: 0.40, ratePremium: 1.3, entryDifficulty: 0.6, avgMonthlyJobs: 3600, avgRate: 65 },
    'Cybersecurity Consulting': { demandGrowth: 0.20, saturation: 0.30, ratePremium: 1.4, entryDifficulty: 0.7, avgMonthlyJobs: 2200, avgRate: 65 },
    'Rust/Go Systems':          { demandGrowth: 0.28, saturation: 0.18, ratePremium: 1.4, entryDifficulty: 0.7, avgMonthlyJobs: 1100, avgRate: 65 },
    'Flutter Cross-Platform':   { demandGrowth: 0.18, saturation: 0.35, ratePremium: 1.1, entryDifficulty: 0.4, avgMonthlyJobs: 2200, avgRate: 52 },
    'AR/VR Development':        { demandGrowth: 0.22, saturation: 0.22, ratePremium: 1.3, entryDifficulty: 0.7, avgMonthlyJobs: 900, avgRate: 65 },
    'Shopify Plus/Headless':    { demandGrowth: 0.10, saturation: 0.50, ratePremium: 1.0, entryDifficulty: 0.3, avgMonthlyJobs: 3200, avgRate: 45 },
    'Blockchain/Web3':          { demandGrowth: -0.10, saturation: 0.55, ratePremium: 1.5, entryDifficulty: 0.7, avgMonthlyJobs: 1500, avgRate: 75 },
    'Automation/RPA':           { demandGrowth: 0.15, saturation: 0.30, ratePremium: 1.1, entryDifficulty: 0.4, avgMonthlyJobs: 2400, avgRate: 50 },
    'Cloud Architecture':       { demandGrowth: 0.16, saturation: 0.35, ratePremium: 1.4, entryDifficulty: 0.65, avgMonthlyJobs: 2800, avgRate: 70 },
    'React Native':             { demandGrowth: 0.06, saturation: 0.55, ratePremium: 1.0, entryDifficulty: 0.4, avgMonthlyJobs: 2800, avgRate: 50 },
    'Technical Writing':        { demandGrowth: 0.05, saturation: 0.45, ratePremium: 0.8, entryDifficulty: 0.3, avgMonthlyJobs: 2400, avgRate: 40 },
    'UX Research':              { demandGrowth: 0.12, saturation: 0.35, ratePremium: 1.2, entryDifficulty: 0.5, avgMonthlyJobs: 1800, avgRate: 55 },
    'Video AI/Editing':         { demandGrowth: 0.25, saturation: 0.28, ratePremium: 1.1, entryDifficulty: 0.5, avgMonthlyJobs: 2000, avgRate: 42 },
    'No-Code/Low-Code':         { demandGrowth: 0.15, saturation: 0.40, ratePremium: 0.8, entryDifficulty: 0.2, avgMonthlyJobs: 3500, avgRate: 35 },
    'API Integration':          { demandGrowth: 0.10, saturation: 0.45, ratePremium: 1.0, entryDifficulty: 0.35, avgMonthlyJobs: 4200, avgRate: 48 }
  };

  // ─── Cache helpers ──────────────────────────────────────────────────

  /** @returns {Object|null} */
  function _loadCache() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (Date.now() - parsed.timestamp > CACHE_TTL_MS) return null;
      return parsed;
    } catch (e) { return null; }
  }

  /** @param {string} key @param {*} value */
  function _writeCache(key, value) {
    try {
      var cache = _loadCache() || { timestamp: Date.now(), results: {} };
      cache.results[key] = value;
      cache.timestamp = Date.now();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
    } catch (e) { /* silent */ }
  }

  /** @param {string} key @returns {*|null} */
  function _readCache(key) {
    var cache = _loadCache();
    if (!cache || !cache.results) return null;
    return cache.results[key] || null;
  }

  // ─── Scoring Logic ──────────────────────────────────────────────────

  /**
   * Compute composite opportunity score for a niche.
   * @param {Object} metrics - Niche benchmark metrics
   * @returns {number} 0-100 score
   */
  function _computeOpportunityScore(metrics) {
    // Weights: demand growth 30%, low saturation 25%, rate premium 25%, low entry difficulty 20%
    var growthScore = Math.max(0, Math.min(1, (metrics.demandGrowth + 0.1) / 0.65)) * 100;
    var saturationScore = (1 - metrics.saturation) * 100;
    var premiumScore = Math.min(1, (metrics.ratePremium - 0.7) / 1.1) * 100;
    var easeScore = (1 - metrics.entryDifficulty) * 100;

    return Math.round(
      growthScore * 0.30 +
      saturationScore * 0.25 +
      premiumScore * 0.25 +
      easeScore * 0.20
    );
  }

  /**
   * Estimate months to first client based on niche difficulty and demand.
   * @param {Object} metrics
   * @returns {number} estimated months
   */
  function _estimateTimeToFirstClient(metrics) {
    var base = 1; // minimum 1 month
    base += metrics.entryDifficulty * 4;
    base += metrics.saturation * 2;
    base -= Math.max(0, metrics.demandGrowth) * 3;
    return Math.max(1, Math.round(base * 10) / 10);
  }

  /**
   * Estimate monthly earning potential.
   * @param {Object} metrics
   * @returns {number} USD
   */
  function _estimateMonthlyPotential(metrics) {
    // Assume 120 billable hours/month at full utilization, scaled by demand
    var utilization = Math.min(0.8, 0.3 + (1 - metrics.saturation) * 0.5 + Math.max(0, metrics.demandGrowth) * 0.3);
    return Math.round(metrics.avgRate * 120 * utilization);
  }

  // ─── Public API ─────────────────────────────────────────────────────

  /**
   * Analyze opportunity for a specific niche, optionally against a user profile.
   * @param {string} niche - Niche name from NICHE_DATA
   * @param {{ skills?: string[], rate?: number, experience?: string }} [userProfile]
   * @returns {{ opportunityScore: number, monthlyPotential: number, entryDifficulty: string, timeToFirstClient: number, recommendedActions: string[] }|null}
   */
  function analyzeOpportunity(niche, userProfile) {
    var metrics = NICHE_DATA[niche];
    if (!metrics) return null;

    var cached = _readCache('opp_' + niche);
    if (cached && !userProfile) return cached;

    var score = _computeOpportunityScore(metrics);
    var monthly = _estimateMonthlyPotential(metrics);
    var ttfc = _estimateTimeToFirstClient(metrics);

    var diffLabel = metrics.entryDifficulty >= 0.7 ? 'high'
                  : metrics.entryDifficulty >= 0.4 ? 'medium'
                  : 'low';

    var actions = [];

    // Generate recommended actions
    if (metrics.entryDifficulty >= 0.6) {
      actions.push('Build 2-3 portfolio pieces or case studies before applying.');
    }
    if (metrics.demandGrowth > 0.15) {
      actions.push('Market is growing fast — enter now before competition catches up.');
    }
    if (metrics.saturation < 0.25) {
      actions.push('Low competition — position yourself as a specialist with targeted profile keywords.');
    }
    if (metrics.ratePremium > 1.3) {
      actions.push('High rate premium — avoid underpricing; clients expect to pay more here.');
    }
    if (metrics.saturation >= 0.5) {
      actions.push('Crowded niche — differentiate with a unique angle or sub-specialization.');
    }

    // User-specific actions
    if (userProfile) {
      var userSkills = (userProfile.skills || []).map(function (s) { return s.toLowerCase(); });
      var nicheWords = niche.toLowerCase().split(/[\s\/]+/);
      var hasRelevantSkill = nicheWords.some(function (w) {
        return userSkills.some(function (s) { return s.indexOf(w) !== -1; });
      });
      if (!hasRelevantSkill) {
        actions.push('Add relevant skills to your profile: study core technologies for this niche.');
        ttfc += 1; // extra time needed
      }
      if (userProfile.rate && userProfile.rate < metrics.avgRate * 0.7) {
        actions.push('Your rate is below market — raise it gradually to match niche expectations.');
      }
    }

    if (actions.length === 0) {
      actions.push('Solid opportunity — start applying to jobs in this niche.');
    }

    var result = {
      opportunityScore: score,
      monthlyPotential: monthly,
      entryDifficulty: diffLabel,
      timeToFirstClient: ttfc,
      recommendedActions: actions
    };

    _writeCache('opp_' + niche, result);
    return result;
  }

  /**
   * Get niches with the highest demand growth (emerging niches).
   * @param {number} [limit=5] - Max results
   * @returns {Array<{ niche: string, demandGrowth: number, opportunityScore: number }>}
   */
  function getEmergingNiches(limit) {
    limit = limit || 5;
    var niches = Object.keys(NICHE_DATA);
    var results = niches.map(function (n) {
      return {
        niche: n,
        demandGrowth: NICHE_DATA[n].demandGrowth,
        opportunityScore: _computeOpportunityScore(NICHE_DATA[n])
      };
    });
    results.sort(function (a, b) { return b.demandGrowth - a.demandGrowth; });
    return results.slice(0, limit);
  }

  /**
   * Get growth rate for a specific niche.
   * @param {string} niche
   * @returns {{ niche: string, growthRate: number, label: string }|null}
   */
  function getNicheGrowthRate(niche) {
    var metrics = NICHE_DATA[niche];
    if (!metrics) return null;
    var label = metrics.demandGrowth > 0.15 ? 'rapid growth'
              : metrics.demandGrowth > 0.05 ? 'moderate growth'
              : metrics.demandGrowth > -0.05 ? 'stable'
              : 'declining';
    return {
      niche: niche,
      growthRate: metrics.demandGrowth,
      label: label
    };
  }

  /**
   * Get entry barrier assessment for a niche.
   * @param {string} niche
   * @returns {{ niche: string, difficulty: number, label: string, requirements: string[] }|null}
   */
  function getEntryBarrier(niche) {
    var metrics = NICHE_DATA[niche];
    if (!metrics) return null;

    var label = metrics.entryDifficulty >= 0.7 ? 'high'
              : metrics.entryDifficulty >= 0.4 ? 'medium'
              : 'low';

    var requirements = [];
    if (metrics.entryDifficulty >= 0.7) {
      requirements.push('Advanced technical skills or certifications required.');
      requirements.push('Strong portfolio with relevant case studies.');
      requirements.push('Typically 3+ years of domain experience expected.');
    } else if (metrics.entryDifficulty >= 0.4) {
      requirements.push('Intermediate skills with demonstrable projects.');
      requirements.push('1-2 portfolio items in this domain.');
      requirements.push('Willingness to start at competitive rates.');
    } else {
      requirements.push('Basic skills sufficient to get started.');
      requirements.push('Can learn on the job with initial lower-rate projects.');
      requirements.push('Transferable skills from adjacent fields accepted.');
    }

    return {
      niche: niche,
      difficulty: metrics.entryDifficulty,
      label: label,
      requirements: requirements
    };
  }

  /**
   * Determine the best time to enter various niches based on growth velocity
   * and current saturation.
   * @returns {Array<{ niche: string, timing: string, reason: string, urgency: number }>}
   */
  function getBestTimeToEnter() {
    var niches = Object.keys(NICHE_DATA);
    var results = niches.map(function (n) {
      var m = NICHE_DATA[n];
      var urgency = 0; // 0-100, higher = enter sooner

      if (m.demandGrowth > 0.20 && m.saturation < 0.30) {
        urgency = 90;
        return { niche: n, timing: 'Now — window closing', reason: 'Rapid growth with low saturation. Early movers will dominate.', urgency: urgency };
      }
      if (m.demandGrowth > 0.10 && m.saturation < 0.40) {
        urgency = 70;
        return { niche: n, timing: 'Within 3 months', reason: 'Growing demand, moderate competition. Good entry window.', urgency: urgency };
      }
      if (m.demandGrowth > 0 && m.saturation < 0.50) {
        urgency = 50;
        return { niche: n, timing: 'Within 6 months', reason: 'Steady growth. Take time to build skills and portfolio.', urgency: urgency };
      }
      if (m.demandGrowth <= 0) {
        urgency = 10;
        return { niche: n, timing: 'Wait or skip', reason: 'Declining or flat demand. Consider alternatives first.', urgency: urgency };
      }
      urgency = 30;
      return { niche: n, timing: 'Low priority', reason: 'Saturated market. Only enter with strong differentiation.', urgency: urgency };
    });

    results.sort(function (a, b) { return b.urgency - a.urgency; });
    return results;
  }

  // ─── Expose ─────────────────────────────────────────────────────────
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.nicheOpportunityEnhancer = {
    analyzeOpportunity: analyzeOpportunity,
    getEmergingNiches: getEmergingNiches,
    getNicheGrowthRate: getNicheGrowthRate,
    getEntryBarrier: getEntryBarrier,
    getBestTimeToEnter: getBestTimeToEnter
  };
})();
