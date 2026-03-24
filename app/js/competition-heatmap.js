/**
 * [CF-061] Competition Heatmap
 * Show which Upwork categories are oversaturated vs underserved
 * using job-to-freelancer ratios.
 *
 * Exposed on window.CortexFreelancer.competitionHeatmap
 */
(function () {
  'use strict';

  // ─── Static Benchmark Data (25+ categories) ────────────────────────
  // avgJobs: estimated monthly job postings
  // avgFreelancers: active freelancers in category
  // avgRate: median hourly rate (USD)
  // growthTrend: YoY demand change as decimal (-0.1 = -10%, 0.15 = +15%)
  var CATEGORY_BENCHMARKS = {
    'Web Development':        { avgJobs: 12400, avgFreelancers: 38000, avgRate: 50, growthTrend: 0.05 },
    'Mobile Development':     { avgJobs: 6800,  avgFreelancers: 18000, avgRate: 55, growthTrend: 0.08 },
    'React':                  { avgJobs: 5600,  avgFreelancers: 14000, avgRate: 55, growthTrend: 0.12 },
    'Angular':                { avgJobs: 2200,  avgFreelancers: 8500,  avgRate: 50, growthTrend: -0.05 },
    'Vue.js':                 { avgJobs: 1800,  avgFreelancers: 5200,  avgRate: 48, growthTrend: 0.06 },
    'Node.js':                { avgJobs: 4800,  avgFreelancers: 12000, avgRate: 52, growthTrend: 0.10 },
    'Python':                 { avgJobs: 8200,  avgFreelancers: 22000, avgRate: 55, growthTrend: 0.15 },
    'Data Science':           { avgJobs: 4500,  avgFreelancers: 8000,  avgRate: 65, growthTrend: 0.18 },
    'Machine Learning':       { avgJobs: 3800,  avgFreelancers: 5500,  avgRate: 70, growthTrend: 0.25 },
    'AI/LLM':                 { avgJobs: 5200,  avgFreelancers: 3800,  avgRate: 80, growthTrend: 0.45 },
    'UI/UX Design':           { avgJobs: 7200,  avgFreelancers: 21000, avgRate: 50, growthTrend: 0.07 },
    'Graphic Design':         { avgJobs: 9500,  avgFreelancers: 35000, avgRate: 40, growthTrend: -0.02 },
    'WordPress':              { avgJobs: 6200,  avgFreelancers: 28000, avgRate: 35, growthTrend: -0.08 },
    'iOS Development':        { avgJobs: 3200,  avgFreelancers: 9500,  avgRate: 60, growthTrend: 0.04 },
    'Android Development':    { avgJobs: 3500,  avgFreelancers: 12000, avgRate: 55, growthTrend: 0.03 },
    'DevOps':                 { avgJobs: 3600,  avgFreelancers: 6000,  avgRate: 65, growthTrend: 0.14 },
    'Cloud Architecture':     { avgJobs: 2800,  avgFreelancers: 4200,  avgRate: 70, growthTrend: 0.16 },
    'Blockchain':             { avgJobs: 1500,  avgFreelancers: 4800,  avgRate: 75, growthTrend: -0.12 },
    'Cybersecurity':          { avgJobs: 2200,  avgFreelancers: 3200,  avgRate: 65, growthTrend: 0.20 },
    'QA Testing':             { avgJobs: 3800,  avgFreelancers: 11000, avgRate: 35, growthTrend: 0.02 },
    'Technical Writing':      { avgJobs: 2400,  avgFreelancers: 6500,  avgRate: 40, growthTrend: 0.05 },
    'SEO':                    { avgJobs: 5500,  avgFreelancers: 18000, avgRate: 38, growthTrend: 0.01 },
    'Digital Marketing':      { avgJobs: 7000,  avgFreelancers: 22000, avgRate: 42, growthTrend: 0.06 },
    'Video Editing':          { avgJobs: 4800,  avgFreelancers: 14000, avgRate: 38, growthTrend: 0.10 },
    'Copywriting':            { avgJobs: 5200,  avgFreelancers: 16000, avgRate: 42, growthTrend: 0.03 },
    'Project Management':     { avgJobs: 2600,  avgFreelancers: 7500,  avgRate: 50, growthTrend: 0.04 },
    'Flutter':                { avgJobs: 2200,  avgFreelancers: 4500,  avgRate: 52, growthTrend: 0.18 },
    'Unity/Game Dev':         { avgJobs: 1400,  avgFreelancers: 5200,  avgRate: 50, growthTrend: 0.06 },
    'AR/VR':                  { avgJobs: 900,   avgFreelancers: 1800,  avgRate: 65, growthTrend: 0.22 },
    'Shopify':                { avgJobs: 3200,  avgFreelancers: 9000,  avgRate: 40, growthTrend: 0.08 },
    '3D Modeling':            { avgJobs: 1200,  avgFreelancers: 4000,  avgRate: 45, growthTrend: 0.10 },
    'Data Engineering':       { avgJobs: 3000,  avgFreelancers: 4500,  avgRate: 68, growthTrend: 0.20 },
    'NLP':                    { avgJobs: 2100,  avgFreelancers: 2800,  avgRate: 75, growthTrend: 0.30 },
    'Automation/RPA':         { avgJobs: 2400,  avgFreelancers: 3500,  avgRate: 50, growthTrend: 0.15 },
    'Rust/Go':                { avgJobs: 1100,  avgFreelancers: 1600,  avgRate: 65, growthTrend: 0.28 }
  };

  // ─── Density thresholds ─────────────────────────────────────────────
  var OVERSATURATED_THRESHOLD = 35;  // density score below this
  var UNDERSERVED_THRESHOLD   = 65;  // density score above this

  /**
   * Compute raw job-to-freelancer ratio for a category.
   * @param {string} category
   * @returns {number} ratio (higher = more opportunity)
   */
  function _rawRatio(category) {
    var b = CATEGORY_BENCHMARKS[category];
    if (!b || b.avgFreelancers === 0) return 0;
    return b.avgJobs / b.avgFreelancers;
  }

  /**
   * Normalize a ratio to a 0-100 density score.
   * Uses min/max across all categories for normalization.
   * @returns {{ min: number, max: number }}
   */
  function _ratioRange() {
    var keys = Object.keys(CATEGORY_BENCHMARKS);
    var ratios = keys.map(function (k) { return _rawRatio(k); });
    return {
      min: Math.min.apply(null, ratios),
      max: Math.max.apply(null, ratios)
    };
  }

  /**
   * Normalize a raw ratio to 0-100 score.
   * @param {number} ratio
   * @returns {number}
   */
  function _normalize(ratio) {
    var range = _ratioRange();
    if (range.max === range.min) return 50;
    return Math.round(((ratio - range.min) / (range.max - range.min)) * 100);
  }

  /**
   * Get density score for a single category (0-100).
   * Higher = more jobs per freelancer (underserved / opportunity).
   * Lower = oversaturated.
   * @param {string} category
   * @returns {{ category: string, densityScore: number, ratio: number, label: string, benchmark: Object }|null}
   */
  function getCategoryDensity(category) {
    var b = CATEGORY_BENCHMARKS[category];
    if (!b) return null;
    var ratio = _rawRatio(category);
    var score = _normalize(ratio);
    var label = score >= UNDERSERVED_THRESHOLD ? 'underserved'
              : score <= OVERSATURATED_THRESHOLD ? 'oversaturated'
              : 'balanced';
    return {
      category: category,
      densityScore: score,
      ratio: Math.round(ratio * 1000) / 1000,
      label: label,
      benchmark: b
    };
  }

  /**
   * Get full heatmap data for all categories, sorted by density score descending.
   * @returns {Array<Object>}
   */
  function getHeatmapData() {
    var keys = Object.keys(CATEGORY_BENCHMARKS);
    var results = keys.map(function (k) { return getCategoryDensity(k); });
    results.sort(function (a, b) { return b.densityScore - a.densityScore; });
    return results;
  }

  /**
   * Get categories where demand outstrips supply.
   * @returns {Array<Object>}
   */
  function getUnderservedCategories() {
    return getHeatmapData().filter(function (d) {
      return d.densityScore >= UNDERSERVED_THRESHOLD;
    });
  }

  /**
   * Get categories where freelancer supply exceeds demand.
   * @returns {Array<Object>}
   */
  function getOversaturatedCategories() {
    return getHeatmapData().filter(function (d) {
      return d.densityScore <= OVERSATURATED_THRESHOLD;
    });
  }

  /**
   * Given a user's skill list, find the best opportunities.
   * Returns skills sorted by opportunity (density + growth).
   * @param {string[]} userSkills - Array of skill/category names
   * @returns {Array<{ category: string, densityScore: number, growthTrend: number, opportunityScore: number, recommendation: string }>}
   */
  function getUserOpportunities(userSkills) {
    if (!userSkills || !userSkills.length) return [];

    var results = [];
    userSkills.forEach(function (skill) {
      var density = getCategoryDensity(skill);
      if (!density) return;

      var growth = density.benchmark.growthTrend;
      // Opportunity = weighted combo of density and growth
      var opportunityScore = Math.round(density.densityScore * 0.6 + (growth * 100) * 0.4);
      opportunityScore = Math.max(0, Math.min(100, opportunityScore));

      var recommendation;
      if (opportunityScore >= 70) {
        recommendation = 'Strong opportunity — high demand, low competition. Prioritize this skill.';
      } else if (opportunityScore >= 50) {
        recommendation = 'Moderate opportunity — good balance of demand and competition.';
      } else if (opportunityScore >= 30) {
        recommendation = 'Competitive market — differentiate with niche expertise or portfolio.';
      } else {
        recommendation = 'Oversaturated — consider specializing or pivoting to adjacent skills.';
      }

      results.push({
        category: skill,
        densityScore: density.densityScore,
        growthTrend: growth,
        opportunityScore: opportunityScore,
        recommendation: recommendation
      });
    });

    results.sort(function (a, b) { return b.opportunityScore - a.opportunityScore; });
    return results;
  }

  // ─── Expose ─────────────────────────────────────────────────────────
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.competitionHeatmap = {
    getHeatmapData: getHeatmapData,
    getCategoryDensity: getCategoryDensity,
    getUnderservedCategories: getUnderservedCategories,
    getOversaturatedCategories: getOversaturatedCategories,
    getUserOpportunities: getUserOpportunities
  };
})();
