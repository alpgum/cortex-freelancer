/**
 * CF-002: Upwork Profile Completeness Scoring
 * Analyzes title, overview, skills, portfolio, certifications, hours, JSS.
 * Outputs 0-100 score with per-field breakdown.
 * @namespace window.CortexFreelancer.ProfileCompleteness
 */
(function () {
  'use strict';

  /**
   * Scoring rules — each field has a weight, max score, and evaluator.
   * Total max across all fields = 100.
   * @type {Array<{ field: string, maxScore: number, evaluate: function(object): { score: number, tips: string[] } }>}
   */
  var FIELDS = [
    {
      field: 'title',
      maxScore: 12,
      evaluate: function (p) {
        var title = (p.title || '').trim();
        if (!title) return { score: 0, tips: ['Add a professional title to your profile'] };
        var len = title.length;
        if (len >= 40 && len <= 70) return { score: 12, tips: [] };
        if (len >= 20) return { score: 8, tips: ['Aim for 40-70 characters in your title for best search visibility'] };
        return { score: 4, tips: ['Title is too short — include your specialty and key skills'] };
      }
    },
    {
      field: 'overview',
      maxScore: 20,
      evaluate: function (p) {
        var text = (p.overview || p.description || p.bio || '').trim();
        if (!text) return { score: 0, tips: ['Write a compelling overview describing your expertise and value'] };
        var words = text.split(/\s+/).filter(Boolean).length;
        var tips = [];
        var score = 0;

        // Length scoring
        if (words >= 150) { score += 10; }
        else if (words >= 80) { score += 6; tips.push('Expand overview to 150+ words for better ranking'); }
        else { score += 3; tips.push('Overview is too short — aim for at least 150 words'); }

        // Quality signals
        if (/\d+\+?\s*(years?|clients?|projects?|%)/i.test(text)) { score += 4; }
        else { tips.push('Quantify achievements (e.g. "50+ projects", "8 years")'); }

        if (/let.s|contact|reach out|help you|your (business|project|team)/i.test(text)) { score += 3; }
        else { tips.push('Add a call-to-action inviting clients to reach out'); }

        if (/speciali[zs]|expert|focus|niche/i.test(text)) { score += 3; }
        else { tips.push('Mention your specialization or area of focus'); }

        return { score: Math.min(score, 20), tips: tips };
      }
    },
    {
      field: 'skills',
      maxScore: 12,
      evaluate: function (p) {
        var skills = Array.isArray(p.skills) ? p.skills : [];
        var count = skills.length;
        if (count === 0) return { score: 0, tips: ['Add at least 5 relevant skills to your profile'] };
        if (count >= 10) return { score: 12, tips: [] };
        if (count >= 5) return { score: 8, tips: ['Add more skills — profiles with 10+ skills rank higher in search'] };
        return { score: 4, tips: ['Only ' + count + ' skill(s) — add more to improve discoverability'] };
      }
    },
    {
      field: 'portfolio',
      maxScore: 12,
      evaluate: function (p) {
        var items = Array.isArray(p.portfolio) ? p.portfolio : [];
        var count = items.length;
        if (count === 0) return { score: 0, tips: ['Add portfolio items to showcase your best work'] };
        if (count >= 5) return { score: 12, tips: [] };
        if (count >= 2) return { score: 7, tips: ['Add more portfolio items — 5+ is ideal for credibility'] };
        return { score: 4, tips: ['Only 1 portfolio item — add at least 4 more'] };
      }
    },
    {
      field: 'certifications',
      maxScore: 8,
      evaluate: function (p) {
        var certs = Array.isArray(p.certifications) ? p.certifications : [];
        if (certs.length === 0) return { score: 0, tips: ['Add certifications or Upwork skill tests to stand out'] };
        if (certs.length >= 3) return { score: 8, tips: [] };
        return { score: 5, tips: ['Add more certifications — 3+ shows strong commitment to your craft'] };
      }
    },
    {
      field: 'hoursWorked',
      maxScore: 10,
      evaluate: function (p) {
        var hours = parseFloat(p.totalHours || p.hoursWorked) || 0;
        if (hours >= 1000) return { score: 10, tips: [] };
        if (hours >= 500) return { score: 7, tips: ['Keep building hours — 1000+ signals reliability to clients'] };
        if (hours >= 100) return { score: 4, tips: ['Under 500 hours — take more hourly contracts to boost this metric'] };
        return { score: 1, tips: ['Very few logged hours — hourly contracts help build trust signals'] };
      }
    },
    {
      field: 'jobSuccessScore',
      maxScore: 14,
      evaluate: function (p) {
        var jss = parseFloat(p.jobSuccess || p.jss || p.jobSuccessScore) || 0;
        if (jss >= 90) return { score: 14, tips: [] };
        if (jss >= 80) return { score: 10, tips: ['Great JSS! Push for 90%+ to unlock Top Rated badge'] };
        if (jss >= 60) return { score: 6, tips: ['Improve JSS with clean contract closures and 5-star reviews'] };
        if (jss > 0) return { score: 3, tips: ['Low JSS — focus on client satisfaction and communication'] };
        return { score: 0, tips: ['No JSS yet — complete a few contracts to start building your score'] };
      }
    },
    {
      field: 'hourlyRate',
      maxScore: 6,
      evaluate: function (p) {
        var rate = parseFloat(String(p.hourlyRate || '').replace(/[^0-9.]/g, '')) || 0;
        if (rate === 0) return { score: 0, tips: ['Set an hourly rate — profiles without rates get fewer invitations'] };
        if (rate >= 15) return { score: 6, tips: [] };
        return { score: 3, tips: ['Very low rate may signal inexperience — raise it as you gain reviews'] };
      }
    },
    {
      field: 'workHistory',
      maxScore: 6,
      evaluate: function (p) {
        var jobs = parseFloat(p.totalJobs || p.completedJobs) || 0;
        if (jobs >= 20) return { score: 6, tips: [] };
        if (jobs >= 5) return { score: 4, tips: ['More completed jobs = more trust — keep applying'] };
        if (jobs > 0) return { score: 2, tips: ['Few completed jobs — actively bid to build work history'] };
        return { score: 0, tips: ['No work history — start with smaller jobs to gain momentum'] };
      }
    }
  ];

  /**
   * Calculate a completeness score for an Upwork profile.
   *
   * @param {object} profileData - Profile data object
   * @param {string} [profileData.title] - Profile title
   * @param {string} [profileData.overview] - Profile overview/bio
   * @param {string[]} [profileData.skills] - Skill tags
   * @param {object[]} [profileData.portfolio] - Portfolio items
   * @param {object[]} [profileData.certifications] - Certifications
   * @param {number|string} [profileData.totalHours] - Total hours worked
   * @param {number|string} [profileData.jobSuccess] - Job Success Score (0-100)
   * @param {number|string} [profileData.hourlyRate] - Hourly rate
   * @param {number|string} [profileData.totalJobs] - Total completed jobs
   * @returns {{ score: number, grade: string, breakdown: Array<{ field: string, score: number, maxScore: number, percentage: number, tips: string[] }> }}
   */
  function calculateScore(profileData) {
    var data = profileData || {};
    var totalScore = 0;
    var breakdown = [];

    for (var i = 0; i < FIELDS.length; i++) {
      var rule = FIELDS[i];
      var result = rule.evaluate(data);
      var capped = Math.min(result.score, rule.maxScore);
      totalScore += capped;
      breakdown.push({
        field: rule.field,
        score: capped,
        maxScore: rule.maxScore,
        percentage: rule.maxScore > 0 ? Math.round((capped / rule.maxScore) * 100) : 0,
        tips: result.tips || []
      });
    }

    var finalScore = Math.min(Math.max(Math.round(totalScore), 0), 100);

    return {
      score: finalScore,
      grade: scoreToGrade(finalScore),
      breakdown: breakdown
    };
  }

  /**
   * Convert a numeric score to a letter grade.
   * @param {number} score
   * @returns {string}
   */
  function scoreToGrade(score) {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 65) return 'C';
    if (score >= 50) return 'D';
    return 'F';
  }

  /**
   * Get all tips sorted by impact (fields with lowest completion first).
   * @param {object} profileData
   * @returns {string[]}
   */
  function getTopTips(profileData) {
    var result = calculateScore(profileData);
    return result.breakdown
      .sort(function (a, b) { return a.percentage - b.percentage; })
      .reduce(function (acc, item) { return acc.concat(item.tips); }, []);
  }

  // Export to namespace
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.ProfileCompleteness = {
    calculateScore: calculateScore,
    getTopTips: getTopTips
  };
})();
