/**
 * [CF-032] Proposal Text Analyzer
 * Analyze proposal text for strength, uniqueness, keyword coverage,
 * readability, and actionability. Returns a 0-100 score with breakdown.
 *
 * window.CortexFreelancer.ProposalAnalyzer
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  /* ── Constants ─────────────────────────────────────────── */

  var IDEAL_WORD_RANGE = [150, 400];

  var POWER_WORDS = [
    'delivered', 'achieved', 'built', 'increased', 'reduced', 'optimized',
    'automated', 'designed', 'implemented', 'launched', 'scaled', 'solved',
    'improved', 'generated', 'managed', 'created', 'developed', 'streamlined',
    'collaborated', 'transformed', 'drove', 'exceeded', 'secured', 'led'
  ];

  var WEAK_PHRASES = [
    'i think i can', 'i believe i might', 'i could possibly',
    'i would try', 'maybe i can', 'hopefully', 'i guess',
    'not sure but', 'i will try my best', 'if you give me a chance',
    'dear sir/madam', 'to whom it may concern', 'i am writing to',
    'please find attached', 'kindly consider', 'i humbly request'
  ];

  var PERSONALIZATION_SIGNALS = [
    'your project', 'your team', 'your company', 'your requirements',
    'your description', 'you mentioned', 'i noticed', 'i saw that',
    'based on your', 'from your posting', 'specific to your',
    'for your needs', 'what you described'
  ];

  var CALL_TO_ACTION = [
    'let me know', 'happy to discuss', 'schedule a call',
    'available to start', 'ready to begin', 'would love to chat',
    'reach out', 'looking forward', 'let\'s connect', 'when can we',
    'free for a call', 'discuss further', 'next steps'
  ];

  var METRIC_PATTERNS = /\d+[%xX]|\$[\d,.]+|\d+\s*(users|clients|projects|hours|days|weeks|months|years|conversions|leads|revenue)/gi;

  /* ── Helpers ───────────────────────────────────────────── */

  function wordCount(text) {
    if (!text) return 0;
    return text.trim().split(/\s+/).filter(Boolean).length;
  }

  function sentenceCount(text) {
    if (!text) return 0;
    return text.split(/[.!?]+/).filter(function (s) { return s.trim().length > 0; }).length;
  }

  function countMatches(text, patterns) {
    var lower = text.toLowerCase();
    var found = [];
    for (var i = 0; i < patterns.length; i++) {
      if (lower.indexOf(patterns[i].toLowerCase()) !== -1) {
        found.push(patterns[i]);
      }
    }
    return found;
  }

  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  /* ── Factor Scorers (each 0-100) ───────────────────────── */

  /** Length score: penalize too short or too long */
  function scoreLength(text) {
    var wc = wordCount(text);
    if (wc >= IDEAL_WORD_RANGE[0] && wc <= IDEAL_WORD_RANGE[1]) return 100;
    if (wc < 50) return 10;
    if (wc < IDEAL_WORD_RANGE[0]) return Math.round(30 + (wc / IDEAL_WORD_RANGE[0]) * 70);
    if (wc > 600) return 40;
    if (wc > IDEAL_WORD_RANGE[1]) return Math.round(100 - ((wc - IDEAL_WORD_RANGE[1]) / 200) * 60);
    return 70;
  }

  /** Strength: power words, metrics, confident language */
  function scoreStrength(text) {
    var powerFound = countMatches(text, POWER_WORDS);
    var weakFound = countMatches(text, WEAK_PHRASES);
    var metrics = (text.match(METRIC_PATTERNS) || []).length;

    var score = 40;
    score += Math.min(powerFound.length * 8, 30);
    score += Math.min(metrics * 10, 20);
    score -= Math.min(weakFound.length * 12, 30);
    score += text.indexOf('?') !== -1 ? 5 : 0; // asking questions shows engagement

    return {
      score: clamp(score, 5, 100),
      powerWords: powerFound,
      weakPhrases: weakFound,
      metricsCount: metrics
    };
  }

  /** Uniqueness: penalize generic / template-like text */
  function scoreUniqueness(text) {
    var score = 60;
    var lower = text.toLowerCase();

    // Penalize common template openers
    var templateOpeners = [
      'dear hiring manager', 'i am a', 'i have', 'i am writing',
      'with over', 'i am an experienced', 'as a seasoned'
    ];
    var openerFound = 0;
    for (var i = 0; i < templateOpeners.length; i++) {
      if (lower.indexOf(templateOpeners[i]) === 0 || lower.indexOf('\n' + templateOpeners[i]) !== -1) {
        openerFound++;
      }
    }
    score -= openerFound * 10;

    // Reward personalization
    var personal = countMatches(text, PERSONALIZATION_SIGNALS);
    score += Math.min(personal.length * 8, 30);

    // Reward specific details (numbers, named technologies)
    var metrics = (text.match(METRIC_PATTERNS) || []).length;
    score += Math.min(metrics * 5, 15);

    return {
      score: clamp(score, 5, 100),
      personalization: personal,
      templatePenalty: openerFound
    };
  }

  /** Keyword coverage: how well proposal matches job description keywords */
  function scoreKeywordCoverage(proposalText, jobKeywords) {
    if (!jobKeywords || !jobKeywords.length) return { score: 50, matched: [], missing: [] };

    var lower = proposalText.toLowerCase();
    var matched = [];
    var missing = [];

    for (var i = 0; i < jobKeywords.length; i++) {
      var kw = jobKeywords[i].toLowerCase().trim();
      if (!kw) continue;
      if (lower.indexOf(kw) !== -1) {
        matched.push(jobKeywords[i]);
      } else {
        missing.push(jobKeywords[i]);
      }
    }

    var total = matched.length + missing.length;
    var coverage = total > 0 ? Math.round((matched.length / total) * 100) : 50;

    return { score: coverage, matched: matched, missing: missing };
  }

  /** Readability: sentence variety, paragraph breaks, not a wall of text */
  function scoreReadability(text) {
    var wc = wordCount(text);
    var sc = sentenceCount(text);
    if (wc === 0) return { score: 0, avgSentenceLength: 0 };

    var avgSentLen = sc > 0 ? Math.round(wc / sc) : wc;
    var paragraphs = text.split(/\n\s*\n/).filter(function (p) { return p.trim().length > 0; }).length;

    var score = 60;

    // Ideal avg sentence length: 12-20 words
    if (avgSentLen >= 12 && avgSentLen <= 20) score += 15;
    else if (avgSentLen > 30) score -= 15;
    else if (avgSentLen < 8) score -= 10;

    // Has paragraph breaks
    if (paragraphs >= 3) score += 15;
    else if (paragraphs >= 2) score += 8;
    else score -= 10;

    // Has bullet points or structured content
    if (/[-\u2022\u2023*]\s/.test(text) || /\d+[.)]\s/.test(text)) score += 10;

    return { score: clamp(score, 5, 100), avgSentenceLength: avgSentLen, paragraphs: paragraphs };
  }

  /** Call to action: does the proposal end with clear next steps? */
  function scoreCTA(text) {
    var ctaFound = countMatches(text, CALL_TO_ACTION);
    if (ctaFound.length >= 2) return { score: 100, found: ctaFound };
    if (ctaFound.length === 1) return { score: 70, found: ctaFound };
    return { score: 20, found: [] };
  }

  /* ── Main Analyzer ─────────────────────────────────────── */

  /**
   * Analyze a proposal text and return detailed scoring.
   * @param {string} proposalText - The proposal content
   * @param {Object} [options] - Analysis options
   * @param {string[]} [options.jobKeywords] - Keywords from the job description
   * @param {string} [options.jobDescription] - Full job description for auto-keyword extraction
   * @returns {Object} Analysis result with overall score and factor breakdown
   */
  function analyze(proposalText, options) {
    if (!proposalText || !proposalText.trim()) {
      return {
        overallScore: 0,
        grade: 'F',
        summary: 'No proposal text provided.',
        factors: {},
        suggestions: ['Write your proposal text to get analysis.']
      };
    }

    var opts = options || {};
    var text = proposalText.trim();

    // Auto-extract keywords from job description if not provided
    var keywords = opts.jobKeywords || [];
    if (!keywords.length && opts.jobDescription) {
      keywords = extractKeywords(opts.jobDescription);
    }

    // Run all scorers
    var lengthScore = scoreLength(text);
    var strength = scoreStrength(text);
    var uniqueness = scoreUniqueness(text);
    var keywordCov = scoreKeywordCoverage(text, keywords);
    var readability = scoreReadability(text);
    var cta = scoreCTA(text);

    // Weighted overall
    var overall = Math.round(
      lengthScore * 0.15 +
      strength.score * 0.25 +
      uniqueness.score * 0.20 +
      keywordCov.score * 0.15 +
      readability.score * 0.15 +
      cta.score * 0.10
    );

    var grade;
    if (overall >= 85) grade = 'A';
    else if (overall >= 70) grade = 'B';
    else if (overall >= 55) grade = 'C';
    else if (overall >= 40) grade = 'D';
    else grade = 'F';

    // Build suggestions
    var suggestions = buildSuggestions(text, {
      lengthScore: lengthScore,
      strength: strength,
      uniqueness: uniqueness,
      keywordCov: keywordCov,
      readability: readability,
      cta: cta
    });

    return {
      overallScore: overall,
      grade: grade,
      summary: getSummary(overall, grade),
      wordCount: wordCount(text),
      factors: {
        length: { score: lengthScore, weight: 0.15 },
        strength: { score: strength.score, weight: 0.25, powerWords: strength.powerWords, weakPhrases: strength.weakPhrases, metrics: strength.metricsCount },
        uniqueness: { score: uniqueness.score, weight: 0.20, personalization: uniqueness.personalization },
        keywordCoverage: { score: keywordCov.score, weight: 0.15, matched: keywordCov.matched, missing: keywordCov.missing },
        readability: { score: readability.score, weight: 0.15, avgSentenceLength: readability.avgSentenceLength, paragraphs: readability.paragraphs },
        callToAction: { score: cta.score, weight: 0.10, found: cta.found }
      },
      suggestions: suggestions
    };
  }

  function getSummary(score, grade) {
    if (score >= 85) return 'Excellent proposal! Strong, unique, and well-structured.';
    if (score >= 70) return 'Good proposal with room for minor improvements.';
    if (score >= 55) return 'Average proposal. Strengthen your language and add specifics.';
    if (score >= 40) return 'Below average. Needs more personalization and stronger evidence.';
    return 'Weak proposal. Consider rewriting with specific examples and results.';
  }

  function buildSuggestions(text, factors) {
    var suggestions = [];
    var wc = wordCount(text);

    if (wc < IDEAL_WORD_RANGE[0]) {
      suggestions.push('Your proposal is short (' + wc + ' words). Aim for ' + IDEAL_WORD_RANGE[0] + '-' + IDEAL_WORD_RANGE[1] + ' words.');
    } else if (wc > IDEAL_WORD_RANGE[1] + 100) {
      suggestions.push('Your proposal is long (' + wc + ' words). Consider trimming to under ' + IDEAL_WORD_RANGE[1] + ' words.');
    }

    if (factors.strength.weakPhrases.length > 0) {
      suggestions.push('Remove weak language: "' + factors.strength.weakPhrases.slice(0, 2).join('", "') + '". Use confident, direct statements instead.');
    }

    if (factors.strength.powerWords.length < 2) {
      suggestions.push('Add action verbs like "delivered", "built", "increased" to strengthen your proposal.');
    }

    if (factors.strength.metricsCount === 0) {
      suggestions.push('Include specific metrics or numbers (e.g., "increased conversion by 40%") to build credibility.');
    }

    if (factors.uniqueness.personalization.length === 0) {
      suggestions.push('Personalize by referencing the client\'s specific project or requirements.');
    }

    if (factors.keywordCov.missing.length > 0) {
      suggestions.push('Missing keywords from job description: ' + factors.keywordCov.missing.slice(0, 5).join(', '));
    }

    if (factors.readability.paragraphs < 3) {
      suggestions.push('Break your proposal into at least 3 paragraphs for better readability.');
    }

    if (factors.cta.found.length === 0) {
      suggestions.push('End with a clear call to action (e.g., "Happy to discuss on a quick call").');
    }

    return suggestions;
  }

  /** Extract keywords from a job description */
  function extractKeywords(jobDescription) {
    if (!jobDescription) return [];
    var stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
      'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'shall', 'can', 'for', 'and', 'but', 'or', 'nor',
      'not', 'so', 'yet', 'to', 'of', 'in', 'on', 'at', 'by', 'with', 'from',
      'up', 'about', 'into', 'through', 'during', 'before', 'after', 'above',
      'below', 'between', 'out', 'off', 'over', 'under', 'again', 'further',
      'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all',
      'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such',
      'no', 'only', 'own', 'same', 'than', 'too', 'very', 'just', 'because',
      'as', 'until', 'while', 'this', 'that', 'these', 'those', 'i', 'me', 'my',
      'we', 'our', 'you', 'your', 'he', 'she', 'it', 'they', 'them', 'what',
      'which', 'who', 'whom', 'if', 'also', 'need', 'looking', 'work', 'like',
      'get', 'make', 'use', 'want', 'know', 'good', 'new', 'well', 'way']);

    var words = jobDescription.toLowerCase().replace(/[^a-z0-9\s+#.]/g, ' ').split(/\s+/);
    var freq = {};
    for (var i = 0; i < words.length; i++) {
      var w = words[i].trim();
      if (w.length < 3 || stopWords.has(w)) continue;
      freq[w] = (freq[w] || 0) + 1;
    }

    return Object.keys(freq)
      .filter(function (k) { return freq[k] >= 1; })
      .sort(function (a, b) { return freq[b] - freq[a]; })
      .slice(0, 20);
  }

  /* ── Public API ────────────────────────────────────────── */

  window.CortexFreelancer.ProposalAnalyzer = {
    analyze: analyze,
    extractKeywords: extractKeywords,
    scoreLength: scoreLength,
    scoreStrength: scoreStrength,
    scoreUniqueness: scoreUniqueness,
    scoreKeywordCoverage: scoreKeywordCoverage,
    scoreReadability: scoreReadability,
    scoreCTA: scoreCTA,
    IDEAL_WORD_RANGE: IDEAL_WORD_RANGE
  };

})();
