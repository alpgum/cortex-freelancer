/**
 * CF-002: Upwork Profile Completeness Scoring Algorithm
 * Analyzes profile data and outputs a 0-100 score with category breakdown.
 */
(function () {
  'use strict';

  /** @type {{ category: string, maxScore: number, evaluate: function }[]} */
  const SCORING_RULES = [
    {
      category: 'Title',
      maxScore: 12,
      evaluate(p) {
        const title = (p.title || '').trim();
        if (!title) return { score: 0, tips: ['Add a professional title to your profile'] };
        const len = title.length;
        if (len >= 40 && len <= 70) return { score: 12, tips: [] };
        if (len >= 20) return { score: 8, tips: ['Aim for 40-70 characters in your title for best visibility'] };
        return { score: 4, tips: ['Your title is too short — add keywords and specialization'] };
      }
    },
    {
      category: 'Overview / Bio',
      maxScore: 20,
      evaluate(p) {
        const desc = (p.description || p.overview || '').trim();
        if (!desc) return { score: 0, tips: ['Write a compelling overview describing your expertise'] };
        const words = desc.split(/\s+/).filter(Boolean).length;
        const tips = [];
        let score = 0;
        if (words >= 150) score += 10;
        else if (words >= 80) { score += 6; tips.push('Expand your overview to 150+ words for better ranking'); }
        else { score += 3; tips.push('Your overview is very short — aim for at least 150 words'); }
        // Quality signals
        if (/\d+\+?\s*(years?|clients?|projects?|%)/i.test(desc)) score += 4;
        else tips.push('Quantify your achievements (e.g. "50+ projects", "8 years")');
        if (/let.s|contact|reach out|help you|your (business|project)/i.test(desc)) score += 3;
        else tips.push('Add a call-to-action inviting clients to reach out');
        if (/speciali[zs]|expert|focus/i.test(desc)) score += 3;
        else tips.push('Mention your specialization or area of expertise');
        return { score: Math.min(score, 20), tips };
      }
    },
    {
      category: 'Skills',
      maxScore: 12,
      evaluate(p) {
        const skills = Array.isArray(p.skills) ? p.skills : [];
        if (skills.length === 0) return { score: 0, tips: ['Add at least 5 skills to your profile'] };
        if (skills.length >= 10) return { score: 12, tips: [] };
        if (skills.length >= 5) return { score: 8, tips: ['Add more skills — profiles with 10+ skills rank higher'] };
        return { score: 4, tips: ['You have fewer than 5 skills — add more to improve discoverability'] };
      }
    },
    {
      category: 'Portfolio',
      maxScore: 12,
      evaluate(p) {
        const items = Array.isArray(p.portfolio) ? p.portfolio : [];
        if (items.length === 0) return { score: 0, tips: ['Add portfolio items to showcase your work'] };
        if (items.length >= 5) return { score: 12, tips: [] };
        if (items.length >= 2) return { score: 7, tips: ['Add more portfolio items — 5+ is ideal'] };
        return { score: 4, tips: ['Only 1 portfolio item — add more to build credibility'] };
      }
    },
    {
      category: 'Certifications',
      maxScore: 8,
      evaluate(p) {
        const certs = Array.isArray(p.certifications) ? p.certifications : [];
        if (certs.length === 0) return { score: 0, tips: ['Add certifications or skill tests to stand out'] };
        if (certs.length >= 3) return { score: 8, tips: [] };
        return { score: 5, tips: ['Add more certifications for extra credibility'] };
      }
    },
    {
      category: 'Hours Worked',
      maxScore: 10,
      evaluate(p) {
        const hours = parseFloat(p.totalHours) || 0;
        if (hours >= 1000) return { score: 10, tips: [] };
        if (hours >= 500) return { score: 7, tips: ['Keep building hours — 1000+ signals reliability'] };
        if (hours >= 100) return { score: 4, tips: ['Under 500 hours — take more hourly contracts to boost this'] };
        return { score: 1, tips: ['Very few logged hours — consider hourly contracts to build trust'] };
      }
    },
    {
      category: 'Job Success Score',
      maxScore: 14,
      evaluate(p) {
        const jss = parseFloat(p.jobSuccess) || 0;
        if (jss >= 90) return { score: 14, tips: [] };
        if (jss >= 80) return { score: 10, tips: ['Great JSS! Aim for 90%+ for Top Rated status'] };
        if (jss >= 60) return { score: 6, tips: ['Improve JSS by completing contracts cleanly and getting 5-star reviews'] };
        if (jss > 0) return { score: 3, tips: ['Low JSS — focus on client satisfaction and clean contract closures'] };
        return { score: 0, tips: ['No JSS yet — complete a few contracts to start building your score'] };
      }
    },
    {
      category: 'Hourly Rate',
      maxScore: 6,
      evaluate(p) {
        const rate = parseFloat(String(p.hourlyRate || '').replace(/[^0-9.]/g, '')) || 0;
        if (rate === 0) return { score: 0, tips: ['Set an hourly rate — profiles without rates get fewer invites'] };
        if (rate >= 15) return { score: 6, tips: [] };
        return { score: 3, tips: ['Very low rate may signal inexperience — consider raising it as you gain reviews'] };
      }
    },
    {
      category: 'Work History',
      maxScore: 6,
      evaluate(p) {
        const jobs = parseFloat(p.totalJobs) || 0;
        if (jobs >= 20) return { score: 6, tips: [] };
        if (jobs >= 5) return { score: 4, tips: ['More completed jobs = more trust — keep applying'] };
        if (jobs > 0) return { score: 2, tips: ['Few completed jobs — actively bid to build your history'] };
        return { score: 0, tips: ['No work history yet — start with smaller jobs to build momentum'] };
      }
    }
  ];

  /**
   * Calculate a completeness score for an Upwork profile.
   * @param {object} profileData - Profile data object (from upwork-profile-storage)
   * @returns {{ score: number, breakdown: Array<{ category: string, score: number, maxScore: number, tips: string[] }> }}
   */
  function calculateProfileScore(profileData) {
    const data = profileData || {};
    let totalScore = 0;
    const breakdown = [];

    for (const rule of SCORING_RULES) {
      const result = rule.evaluate(data);
      const capped = Math.min(result.score, rule.maxScore);
      totalScore += capped;
      breakdown.push({
        category: rule.category,
        score: capped,
        maxScore: rule.maxScore,
        tips: result.tips || []
      });
    }

    return {
      score: Math.min(Math.max(Math.round(totalScore), 0), 100),
      breakdown
    };
  }

  // Export to namespace
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.calculateProfileScore = calculateProfileScore;
})();
