/**
 * [CF-040] Client Red Flag Scoring System
 * Weighted scoring for client risk: low budget + high demands, payment disputes,
 * negative reviews, unrealistic expectations, communication problems.
 *
 * window.CortexFreelancer.ClientRedFlags
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  /* ── Flag Definitions with Weights ─────────────────────── */

  var FLAG_CATEGORIES = {
    budget: {
      label: 'Budget & Payment',
      weight: 0.25,
      flags: [
        { id: 'low_budget',           label: 'Budget far below market rate',     severity: 8, patterns: ['lowest bid', 'cheap', 'minimum budget', 'under $5', '$3/hr', '$2/hr', 'bargain'] },
        { id: 'no_payment_verified',   label: 'Payment method not verified',      severity: 7, check: 'paymentVerified' },
        { id: 'payment_dispute',       label: 'History of payment disputes',      severity: 9, patterns: ['dispute', 'withheld payment', 'refund', 'chargeback', 'didn\'t pay'] },
        { id: 'free_work',            label: 'Expects free work / test tasks',   severity: 8, patterns: ['free sample', 'free trial', 'unpaid test', 'prove yourself', 'test project', 'portfolio piece', 'exposure'] },
        { id: 'unclear_budget',       label: 'No budget specified',              severity: 4, check: 'noBudget' },
        { id: 'milestone_averse',     label: 'Refuses milestone payments',       severity: 6, patterns: ['no milestone', 'pay at end', 'lump sum only', 'after completion only'] }
      ]
    },
    demands: {
      label: 'Demands & Expectations',
      weight: 0.20,
      flags: [
        { id: 'unrealistic_deadline', label: 'Unrealistic deadline',             severity: 7, patterns: ['ASAP', 'urgent', 'need yesterday', 'start immediately', '24 hours', 'overnight', 'rush'] },
        { id: 'scope_creep',         label: 'Signs of scope creep',             severity: 7, patterns: ['and also', 'one more thing', 'while you\'re at it', 'add this too', 'extra features', 'unlimited revisions'] },
        { id: 'high_demands',        label: 'Excessive demands / micromanaging',severity: 6, patterns: ['hourly updates', 'daily reports', '24/7 available', 'on call', 'every detail', 'micromanag', 'constant check-in'] },
        { id: 'vague_scope',         label: 'Vague or undefined project scope', severity: 5, patterns: ['figure it out', 'you decide', 'not sure what I need', 'whatever works', 'TBD', 'we\'ll see', 'flexible scope'] },
        { id: 'all_in_one',          label: 'Expects multiple roles for one price', severity: 7, patterns: ['full stack', 'designer and developer', 'everything', 'all-in-one', 'wear many hats', 'multiple skills'] }
      ]
    },
    history: {
      label: 'Client History',
      weight: 0.25,
      flags: [
        { id: 'new_client',          label: 'New client with no history',       severity: 4, check: 'newClient' },
        { id: 'low_hire_rate',       label: 'Low hire rate (posts but rarely hires)', severity: 6, check: 'lowHireRate' },
        { id: 'low_rehire_rate',     label: 'No repeat freelancers',            severity: 5, check: 'lowRehireRate' },
        { id: 'low_rating',          label: 'Low rating from freelancers',      severity: 8, check: 'lowRating' },
        { id: 'many_active_jobs',    label: 'Too many active jobs (spread thin)', severity: 4, check: 'manyActiveJobs' },
        { id: 'short_projects',      label: 'Consistently very short projects', severity: 3, check: 'shortProjects' }
      ]
    },
    communication: {
      label: 'Communication',
      weight: 0.15,
      flags: [
        { id: 'ghosting',            label: 'History of ghosting freelancers',  severity: 8, patterns: ['disappeared', 'ghosted', 'went silent', 'no response', 'stopped responding', 'radio silence', 'MIA'] },
        { id: 'rude',                label: 'Rude or disrespectful communication', severity: 9, patterns: ['rude', 'condescending', 'dismissive', 'threatening', 'insulting', 'belittling', 'yelling'] },
        { id: 'bad_instructions',    label: 'Unclear or contradictory instructions', severity: 5, patterns: ['confusing', 'contradictory', 'kept changing', 'moving goalposts', 'unclear instructions'] },
        { id: 'slow_response',       label: 'Extremely slow to respond',       severity: 4, patterns: ['slow to respond', 'took weeks', 'waited forever', 'delayed feedback', 'no feedback'] }
      ]
    },
    reviews: {
      label: 'Freelancer Reviews',
      weight: 0.15,
      flags: [
        { id: 'negative_reviews',    label: 'Negative reviews from freelancers', severity: 8, patterns: ['worst client', 'avoid', 'terrible', 'nightmare', 'horrible experience', 'never again'] },
        { id: 'low_feedback_score',  label: 'Gives unfairly low ratings',       severity: 7, patterns: ['unfair rating', 'low rating', 'didn\'t deserve', 'rating manipulation'] },
        { id: 'early_termination',   label: 'Frequently ends contracts early',  severity: 6, patterns: ['ended early', 'terminated', 'cancelled project', 'closed contract'] },
        { id: 'revision_abuse',      label: 'Excessive revision requests',      severity: 6, patterns: ['endless revisions', 'too many revisions', 'revision hell', 'never satisfied', 'kept asking for changes'] }
      ]
    }
  };

  /* ── Pattern Matching ──────────────────────────────────── */

  function matchesPatterns(text, patterns) {
    if (!text || !patterns) return false;
    var lower = text.toLowerCase();
    for (var i = 0; i < patterns.length; i++) {
      if (lower.indexOf(patterns[i].toLowerCase()) !== -1) return true;
    }
    return false;
  }

  /* ── Check-based Flag Detection ────────────────────────── */

  function evaluateCheck(checkName, clientData) {
    switch (checkName) {
      case 'paymentVerified':
        return clientData.paymentVerified === false;
      case 'noBudget':
        return !clientData.budget && !clientData.hourlyRate;
      case 'newClient':
        return (!clientData.hireCount || parseInt(clientData.hireCount) === 0) &&
               (!clientData.totalSpent || clientData.totalSpent === '$0');
      case 'lowHireRate': {
        var jobs = parseInt(clientData.jobsPosted) || 0;
        var hires = parseInt(clientData.hireCount) || 0;
        return jobs > 5 && hires > 0 && (hires / jobs) < 0.2;
      }
      case 'lowRehireRate': {
        var rehire = parseFloat(clientData.rehireRate) || 0;
        var hireCount = parseInt(clientData.hireCount) || 0;
        return hireCount > 5 && rehire < 10;
      }
      case 'lowRating': {
        var rating = parseFloat(clientData.avgRating) || 0;
        return rating > 0 && rating < 3.5;
      }
      case 'manyActiveJobs':
        return (parseInt(clientData.activeJobs) || 0) > 10;
      case 'shortProjects': {
        var avgSize = parseFloat(clientData.avgProjectSize) || 0;
        return avgSize > 0 && avgSize < 50;
      }
      default:
        return false;
    }
  }

  /* ── Main Scoring Engine ───────────────────────────────── */

  /**
   * Analyze a client for red flags with weighted scoring.
   * @param {Object} clientData - Client data
   * @param {string} [clientData.totalSpent] - Total spend on platform
   * @param {number} [clientData.hireCount] - Total freelancers hired
   * @param {number} [clientData.avgRating] - Avg rating given to freelancers (0-5)
   * @param {boolean} [clientData.paymentVerified] - Payment verification status
   * @param {number} [clientData.rehireRate] - Rehire rate percentage (0-100)
   * @param {number} [clientData.jobsPosted] - Total jobs posted
   * @param {number} [clientData.activeJobs] - Currently active jobs
   * @param {string} [clientData.jobDescription] - Job post text
   * @param {string} [clientData.reviews] - Freelancer reviews text
   * @param {number} [clientData.budget] - Stated budget
   * @param {number} [clientData.avgProjectSize] - Average project value
   * @returns {Object} { riskScore, riskLevel, flags[], categorizedFlags, summary }
   */
  function analyze(clientData) {
    if (!clientData) {
      return { riskScore: 50, riskLevel: 'unknown', flags: [], categorizedFlags: {}, summary: 'No client data provided.' };
    }

    var allText = [
      clientData.jobDescription || '',
      clientData.reviews || '',
      clientData.description || '',
      clientData.notes || ''
    ].join(' ');

    var detectedFlags = [];
    var categorizedFlags = {};
    var categoryScores = {};

    for (var catKey in FLAG_CATEGORIES) {
      var category = FLAG_CATEGORIES[catKey];
      categorizedFlags[catKey] = [];
      var catMaxSeverity = 0;

      for (var i = 0; i < category.flags.length; i++) {
        var flag = category.flags[i];
        var triggered = false;

        // Check pattern-based flags
        if (flag.patterns && matchesPatterns(allText, flag.patterns)) {
          triggered = true;
        }

        // Check data-based flags
        if (flag.check && evaluateCheck(flag.check, clientData)) {
          triggered = true;
        }

        if (triggered) {
          var flagResult = {
            id: flag.id,
            label: flag.label,
            severity: flag.severity,
            category: catKey,
            categoryLabel: category.label
          };
          detectedFlags.push(flagResult);
          categorizedFlags[catKey].push(flagResult);
          if (flag.severity > catMaxSeverity) catMaxSeverity = flag.severity;
        }
      }

      // Category score: 0 (no flags) to 100 (max flags and severity)
      var maxPossibleSeverity = category.flags.reduce(function (sum, f) { return sum + f.severity; }, 0);
      var actualSeverity = categorizedFlags[catKey].reduce(function (sum, f) { return sum + f.severity; }, 0);
      categoryScores[catKey] = maxPossibleSeverity > 0
        ? Math.round((actualSeverity / maxPossibleSeverity) * 100)
        : 0;
    }

    // Weighted risk score (0-100)
    var riskScore = 0;
    for (var cat in categoryScores) {
      riskScore += categoryScores[cat] * (FLAG_CATEGORIES[cat].weight || 0.2);
    }
    riskScore = Math.round(Math.min(100, riskScore));

    // Risk level
    var riskLevel;
    if (riskScore >= 60) riskLevel = 'high';
    else if (riskScore >= 35) riskLevel = 'medium';
    else if (riskScore >= 15) riskLevel = 'low';
    else riskLevel = 'minimal';

    // Sort flags by severity desc
    detectedFlags.sort(function (a, b) { return b.severity - a.severity; });

    // Build summary
    var summary = buildSummary(riskLevel, riskScore, detectedFlags, categoryScores);

    return {
      riskScore: riskScore,
      riskLevel: riskLevel,
      flags: detectedFlags,
      flagCount: detectedFlags.length,
      categorizedFlags: categorizedFlags,
      categoryScores: categoryScores,
      summary: summary,
      recommendation: getRecommendation(riskLevel, detectedFlags)
    };
  }

  function buildSummary(riskLevel, score, flags, catScores) {
    if (flags.length === 0) return 'No red flags detected. Client appears safe.';

    var topFlags = flags.slice(0, 3).map(function (f) { return f.label; });
    var prefix;

    if (riskLevel === 'high') prefix = 'HIGH RISK (' + score + '/100): ';
    else if (riskLevel === 'medium') prefix = 'MODERATE RISK (' + score + '/100): ';
    else prefix = 'LOW RISK (' + score + '/100): ';

    return prefix + flags.length + ' red flag' + (flags.length > 1 ? 's' : '') +
      ' detected. Top concerns: ' + topFlags.join(', ') + '.';
  }

  function getRecommendation(riskLevel, flags) {
    if (riskLevel === 'high') {
      return {
        action: 'avoid',
        text: 'Consider skipping this client. If you proceed, use strict milestones and clear contracts.',
        milestones: true,
        escrow: true
      };
    }
    if (riskLevel === 'medium') {
      return {
        action: 'caution',
        text: 'Proceed with caution. Clarify expectations upfront and use milestone-based payments.',
        milestones: true,
        escrow: false
      };
    }
    if (riskLevel === 'low') {
      return {
        action: 'proceed',
        text: 'Minor concerns noted. Standard precautions should suffice.',
        milestones: false,
        escrow: false
      };
    }
    return {
      action: 'safe',
      text: 'No significant red flags. Safe to proceed.',
      milestones: false,
      escrow: false
    };
  }

  /**
   * Quick check: is a specific flag triggered?
   * @param {string} flagId - Flag identifier
   * @param {Object} clientData - Client data
   * @returns {boolean}
   */
  function hasFlag(flagId, clientData) {
    var result = analyze(clientData);
    for (var i = 0; i < result.flags.length; i++) {
      if (result.flags[i].id === flagId) return true;
    }
    return false;
  }

  /**
   * Get all available flag definitions grouped by category.
   * @returns {Object} Flag categories with definitions
   */
  function getFlagDefinitions() {
    return FLAG_CATEGORIES;
  }

  /* ── Public API ────────────────────────────────────────── */

  window.CortexFreelancer.ClientRedFlags = {
    analyze: analyze,
    hasFlag: hasFlag,
    getFlagDefinitions: getFlagDefinitions,
    FLAG_CATEGORIES: FLAG_CATEGORIES
  };

})();
