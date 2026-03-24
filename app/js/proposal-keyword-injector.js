/**
 * Cortex Freelancer — Proposal Keyword Injector [CF-037]
 *
 * Extracts important keywords from a job description, compares them against
 * proposal text, scores keyword coverage, and suggests where to place
 * missing keywords for better matching.
 */
window.CortexFreelancer = window.CortexFreelancer || {};
window.CortexFreelancer.ProposalKeywordInjector = (function () {
  'use strict';

  // ── Stop words (common English words to ignore) ──────────────────────
  var STOP_WORDS = new Set([
    'a','an','the','and','or','but','in','on','at','to','for','of','with',
    'by','from','is','are','was','were','be','been','being','have','has',
    'had','do','does','did','will','would','could','should','may','might',
    'shall','can','need','must','that','this','these','those','it','its',
    'i','me','my','we','our','you','your','he','she','they','them','their',
    'what','which','who','whom','where','when','how','not','no','nor',
    'if','then','than','so','as','up','out','about','into','over','after',
    'also','just','only','very','more','most','some','any','each','all',
    'both','few','many','such','own','same','other','new','one','two',
    'able','get','got','us','am','been','hi','hello','dear','please',
    'thank','thanks','looking','look','like','well','good','great','best',
    'work','working','project','job','experience','years','time'
  ]);

  // Technical terms get a weight boost
  var TECH_BOOST_PATTERNS = [
    /^[A-Z][a-zA-Z]*(?:\.js|\.py|\.ts)?$/,     // PascalCase / filenames
    /^[a-z]+[-_][a-z]+/,                          // kebab-case / snake_case
    /^(?:api|sdk|css|html|sql|aws|gcp|ci|cd)$/i,
    /^(?:react|vue|angular|node|django|flask|rails|spring|docker|kubernetes|graphql|rest|oauth)$/i
  ];

  // ── Tokenization ─────────────────────────────────────────────────────

  function tokenize(text) {
    if (!text) return [];
    return text
      .replace(/[^a-zA-Z0-9#+.\-_/]/g, ' ')
      .split(/\s+/)
      .filter(function (t) { return t.length > 1; });
  }

  function normalize(word) {
    return word.toLowerCase().replace(/[.\-_]/g, '');
  }

  function isStopWord(word) {
    return STOP_WORDS.has(normalize(word));
  }

  function isTechnicalTerm(word) {
    return TECH_BOOST_PATTERNS.some(function (rx) { return rx.test(word); });
  }

  // ── Extract keywords from job description ────────────────────────────

  /**
   * Extract and rank keywords from a job description.
   *
   * @param {string} jobDescription
   * @returns {Array<{ keyword: string, frequency: number, weight: number, isTechnical: boolean }>}
   */
  function extractKeywords(jobDescription) {
    var tokens = tokenize(jobDescription);
    var freq = {};
    var original = {}; // preserve original casing of first occurrence

    tokens.forEach(function (token) {
      if (isStopWord(token)) return;
      var key = normalize(token);
      if (key.length < 2) return;
      freq[key] = (freq[key] || 0) + 1;
      if (!original[key]) original[key] = token;
    });

    // Also extract 2-word phrases (bigrams)
    for (var i = 0; i < tokens.length - 1; i++) {
      if (isStopWord(tokens[i]) || isStopWord(tokens[i + 1])) continue;
      var bigram = normalize(tokens[i]) + ' ' + normalize(tokens[i + 1]);
      if (bigram.length < 5) continue;
      freq[bigram] = (freq[bigram] || 0) + 1;
      if (!original[bigram]) original[bigram] = tokens[i] + ' ' + tokens[i + 1];
    }

    var keywords = Object.keys(freq).map(function (key) {
      var tech = isTechnicalTerm(original[key]);
      var weight = freq[key] + (tech ? 3 : 0);
      return {
        keyword: original[key],
        normalized: key,
        frequency: freq[key],
        weight: weight,
        isTechnical: tech
      };
    });

    keywords.sort(function (a, b) { return b.weight - a.weight; });
    return keywords;
  }

  // ── Compare keywords against proposal ────────────────────────────────

  /**
   * Analyze which job-description keywords appear in the proposal.
   *
   * @param {string} jobDescription
   * @param {string} proposalText
   * @param {Object} [options]
   * @param {number} [options.maxKeywords=30] - Max keywords to consider.
   * @param {string[]} [options.customKeywords] - Extra keywords to include.
   * @param {string[]} [options.excludeKeywords] - Keywords to ignore.
   * @returns {Object} Analysis result.
   */
  function analyze(jobDescription, proposalText, options) {
    var opts = options || {};
    var maxKw = opts.maxKeywords || 30;

    var keywords = extractKeywords(jobDescription).slice(0, maxKw);

    // Apply custom additions
    if (opts.customKeywords && opts.customKeywords.length) {
      opts.customKeywords.forEach(function (kw) {
        var n = normalize(kw);
        var exists = keywords.some(function (k) { return k.normalized === n; });
        if (!exists) {
          keywords.push({
            keyword: kw,
            normalized: n,
            frequency: 0,
            weight: 2,
            isTechnical: isTechnicalTerm(kw)
          });
        }
      });
    }

    // Apply exclusions
    if (opts.excludeKeywords && opts.excludeKeywords.length) {
      var excludeSet = new Set(opts.excludeKeywords.map(normalize));
      keywords = keywords.filter(function (k) { return !excludeSet.has(k.normalized); });
    }

    var proposalLower = (proposalText || '').toLowerCase();
    var matched = [];
    var missing = [];

    keywords.forEach(function (kw) {
      if (proposalLower.indexOf(kw.normalized) !== -1) {
        matched.push(kw);
      } else {
        missing.push(kw);
      }
    });

    var totalWeight = keywords.reduce(function (s, k) { return s + k.weight; }, 0);
    var matchedWeight = matched.reduce(function (s, k) { return s + k.weight; }, 0);
    var score = totalWeight > 0 ? Math.round((matchedWeight / totalWeight) * 100) : 0;

    return {
      score: score,
      totalKeywords: keywords.length,
      matched: matched.map(function (k) { return k.keyword; }),
      missing: missing.map(function (k) { return k.keyword; }),
      keywords: keywords
    };
  }

  // ── Suggest placements for missing keywords ──────────────────────────

  /**
   * Suggest where to insert missing keywords in the proposal.
   *
   * @param {string} proposalText
   * @param {string[]} missingKeywords
   * @returns {Array<{ keyword: string, suggestion: string, section: string }>}
   */
  function suggestPlacements(proposalText, missingKeywords) {
    if (!missingKeywords || !missingKeywords.length) return [];

    var paragraphs = (proposalText || '').split(/\n\s*\n/).filter(function (p) { return p.trim(); });
    var hasTechnicalSection = paragraphs.some(function (p) {
      return /\b(approach|technical|deliver|implement|solution)\b/i.test(p);
    });

    return missingKeywords.map(function (kw) {
      var tech = isTechnicalTerm(kw);
      var section, suggestion;

      if (tech) {
        section = 'technical';
        suggestion = 'Mention "' + kw + '" in your technical approach or skills section.';
      } else {
        section = 'introduction';
        suggestion = 'Work "' + kw + '" into your opening or experience summary.';
      }

      if (!hasTechnicalSection && tech) {
        suggestion += ' Consider adding a brief technical approach paragraph.';
      }

      return { keyword: kw, suggestion: suggestion, section: section };
    });
  }

  /**
   * Generate an enriched version of the proposal by appending a skills line
   * for any missing technical keywords.
   *
   * @param {string} proposalText
   * @param {string[]} missingKeywords
   * @returns {string} Enriched proposal text.
   */
  function enrichProposal(proposalText, missingKeywords) {
    if (!missingKeywords || !missingKeywords.length) return proposalText;

    var techMissing = missingKeywords.filter(isTechnicalTerm);
    var otherMissing = missingKeywords.filter(function (k) { return !isTechnicalTerm(k); });

    var additions = [];
    if (techMissing.length) {
      additions.push('Relevant skills: ' + techMissing.join(', ') + '.');
    }
    if (otherMissing.length) {
      additions.push('I also bring expertise in ' + otherMissing.join(', ') + '.');
    }

    return (proposalText || '').trim() + '\n\n' + additions.join(' ');
  }

  // ── Public API ───────────────────────────────────────────────────────

  return {
    extractKeywords: extractKeywords,
    analyze: analyze,
    suggestPlacements: suggestPlacements,
    enrichProposal: enrichProposal
  };
})();
