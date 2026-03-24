/**
 * CF-014: Auto-Detect Upwork Profile Red Flags
 * Scans profile data for issues that hurt visibility, trust, or conversion.
 */
(function () {
  'use strict';

  /**
   * Red flag detection rules.
   * Each returns null (no issue) or { flag, severity, suggestion }.
   * @type {Array<function(object): ?{ flag: string, severity: string, suggestion: string }>}
   */
  var RULES = [
    // Empty title
    function (p) {
      var title = (p.title || '').trim();
      if (!title) return { flag: 'Empty title', severity: 'critical', suggestion: 'Add a keyword-rich professional title — this is the #1 factor in Upwork search ranking' };
      if (title.length < 10) return { flag: 'Title too short', severity: 'warning', suggestion: 'Expand your title to 40-70 characters with relevant keywords' };
      return null;
    },

    // Short or missing overview
    function (p) {
      var desc = (p.description || p.overview || '').trim();
      if (!desc) return { flag: 'No overview/bio', severity: 'critical', suggestion: 'Write a compelling overview (150-300 words) highlighting your expertise and results' };
      if (desc.length < 100) return { flag: 'Overview too short', severity: 'warning', suggestion: 'Your overview is under 100 characters — expand it with achievements, skills, and a CTA' };
      return null;
    },

    // Empty portfolio
    function (p) {
      var portfolio = Array.isArray(p.portfolio) ? p.portfolio : [];
      if (portfolio.length === 0) return { flag: 'No portfolio items', severity: 'critical', suggestion: 'Add at least 3-5 portfolio pieces — clients heavily weigh visual proof of work' };
      return null;
    },

    // No certifications
    function (p) {
      var certs = Array.isArray(p.certifications) ? p.certifications : [];
      if (certs.length === 0) return { flag: 'No certifications', severity: 'info', suggestion: 'Take Upwork skill tests or add external certifications to boost credibility' };
      return null;
    },

    // Low hours
    function (p) {
      var hours = parseFloat(p.totalHours) || 0;
      if (hours < 100 && hours > 0) return { flag: 'Low hours worked (' + Math.round(hours) + 'h)', severity: 'warning', suggestion: 'Under 100 hours signals low experience — take hourly contracts to build this metric' };
      if (hours === 0) return { flag: 'No hours logged', severity: 'warning', suggestion: 'Log hours through Upwork\'s time tracker to build your profile metrics' };
      return null;
    },

    // No skills listed
    function (p) {
      var skills = Array.isArray(p.skills) ? p.skills : [];
      if (skills.length === 0) return { flag: 'No skills listed', severity: 'critical', suggestion: 'Add at least 5-10 relevant skills — Upwork uses these for search matching' };
      if (skills.length < 3) return { flag: 'Very few skills (' + skills.length + ')', severity: 'warning', suggestion: 'Add more skills to improve search discoverability — aim for 10+' };
      return null;
    },

    // No work history
    function (p) {
      var jobs = parseFloat(p.totalJobs) || 0;
      if (jobs === 0) return { flag: 'No completed jobs', severity: 'warning', suggestion: 'Complete your first few contracts to unlock reviews and JSS' };
      return null;
    },

    // Missing profile photo
    function (p) {
      if (!p.photo && !p.profilePhoto && !p.avatar) {
        return { flag: 'No profile photo', severity: 'warning', suggestion: 'Add a professional headshot — profiles with photos get 40% more invites' };
      }
      return null;
    },

    // Low JSS
    function (p) {
      var jss = parseFloat(p.jobSuccess) || 0;
      if (jss > 0 && jss < 70) return { flag: 'Low Job Success Score (' + jss + '%)', severity: 'critical', suggestion: 'Focus on client satisfaction, clean closures, and 5-star reviews to recover JSS' };
      if (jss >= 70 && jss < 80) return { flag: 'Below-average JSS (' + jss + '%)', severity: 'warning', suggestion: 'JSS under 80% limits invites — prioritize client communication and deliverable quality' };
      return null;
    },

    // No hourly rate
    function (p) {
      var rate = parseFloat(String(p.hourlyRate || '').replace(/[^0-9.]/g, '')) || 0;
      if (rate === 0) return { flag: 'No hourly rate set', severity: 'info', suggestion: 'Set a competitive hourly rate — profiles without rates appear less professional' };
      if (rate < 5) return { flag: 'Extremely low rate ($' + rate + '/hr)', severity: 'warning', suggestion: 'Very low rates can signal low quality to clients — consider raising it' };
      return null;
    },

    // Generic title keywords
    function (p) {
      var title = (p.title || '').toLowerCase();
      var generic = ['freelancer', 'available for hire', 'looking for work', 'hire me'];
      for (var i = 0; i < generic.length; i++) {
        if (title.includes(generic[i])) {
          return { flag: 'Generic title keyword: "' + generic[i] + '"', severity: 'info', suggestion: 'Replace generic phrases with specific skills and specializations' };
        }
      }
      return null;
    }
  ];

  /**
   * Detect red flags in an Upwork profile.
   * @param {object} profileData - Profile data object
   * @returns {Array<{ flag: string, severity: "critical"|"warning"|"info", suggestion: string }>}
   */
  function detectRedFlags(profileData) {
    var data = profileData || {};
    var flags = [];

    for (var i = 0; i < RULES.length; i++) {
      var result = RULES[i](data);
      if (result) flags.push(result);
    }

    // Sort by severity: critical > warning > info
    var order = { critical: 0, warning: 1, info: 2 };
    flags.sort(function (a, b) {
      return (order[a.severity] || 3) - (order[b.severity] || 3);
    });

    return flags;
  }

  // Export to namespace
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.detectRedFlags = detectRedFlags;
})();
