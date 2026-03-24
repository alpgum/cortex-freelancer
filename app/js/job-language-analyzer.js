/**
 * [CF-028] Job Posting Language Analyzer
 *
 * IIFE exposing window.CortexJobLanguageAnalyzer
 * Detects job post quality, urgency signals, and budget negotiability hints
 * from the text of a job posting. Pure client-side text analysis.
 */
(function () {
  'use strict';

  // ─── Signal dictionaries ────────────────────────────────────────

  var URGENCY_SIGNALS = [
    { pattern: /\basap\b/i, weight: 3, label: 'ASAP mentioned' },
    { pattern: /\burgent(ly)?\b/i, weight: 3, label: 'Urgent' },
    { pattern: /\bimmediately?\b/i, weight: 3, label: 'Immediate start' },
    { pattern: /\bright away\b/i, weight: 2, label: 'Right away' },
    { pattern: /\btoday\b/i, weight: 2, label: 'Today deadline' },
    { pattern: /\btomorrow\b/i, weight: 2, label: 'Tomorrow deadline' },
    { pattern: /\bthis week\b/i, weight: 2, label: 'This week deadline' },
    { pattern: /\bdeadline\b/i, weight: 1, label: 'Has deadline' },
    { pattern: /\btime.?sensitive\b/i, weight: 2, label: 'Time-sensitive' },
    { pattern: /\brush\b/i, weight: 2, label: 'Rush job' },
    { pattern: /need(ed)?\s+(someone|a developer|a designer|help)/i, weight: 1, label: 'Active need' }
  ];

  var NEGOTIABILITY_SIGNALS = [
    { pattern: /budget\s*(is\s*)?(flexible|negotiable|open)/i, weight: 3, label: 'Budget flexible', direction: 'negotiable' },
    { pattern: /\bnegotiable\b/i, weight: 3, label: 'Negotiable mentioned', direction: 'negotiable' },
    { pattern: /open\s+to\s+(discuss|negotiate|offers)/i, weight: 2, label: 'Open to discussion', direction: 'negotiable' },
    { pattern: /pay\s*(well|competitive|above)/i, weight: 2, label: 'Competitive pay', direction: 'negotiable' },
    { pattern: /\bfixed\s*budget\b/i, weight: 2, label: 'Fixed budget', direction: 'firm' },
    { pattern: /\bfirm\s*(on\s*)?(price|budget|rate)\b/i, weight: 3, label: 'Firm price', direction: 'firm' },
    { pattern: /\bmax(imum)?\s*budget\b/i, weight: 1, label: 'Max budget stated', direction: 'firm' },
    { pattern: /\bcheap(est|ly)?\b/i, weight: 2, label: 'Looking for cheap', direction: 'firm' },
    { pattern: /\blowest\s*(bid|price|rate)\b/i, weight: 3, label: 'Wants lowest bid', direction: 'firm' },
    { pattern: /willing\s+to\s+pay\s+(more|extra|premium)/i, weight: 2, label: 'Willing to pay more', direction: 'negotiable' }
  ];

  var QUALITY_POSITIVE = [
    { pattern: /\bmilestone/i, weight: 2, label: 'Uses milestones' },
    { pattern: /\bclear\s+(scope|requirements|deliverables)\b/i, weight: 2, label: 'Clear scope' },
    { pattern: /\bdetailed\b/i, weight: 1, label: 'Detailed description' },
    { pattern: /\blong[\s-]?term\b/i, weight: 2, label: 'Long-term potential' },
    { pattern: /\bongoing\b/i, weight: 1, label: 'Ongoing work' },
    { pattern: /\bexperience(d)?\s+(with|in|required)\b/i, weight: 1, label: 'Seeks experience' },
    { pattern: /\bportfolio\b/i, weight: 1, label: 'Asks for portfolio' },
    { pattern: /\bnda\b/i, weight: 1, label: 'NDA (professional)' },
    { pattern: /\bcontract\b/i, weight: 1, label: 'Mentions contract' }
  ];

  var QUALITY_NEGATIVE = [
    { pattern: /\bcopy\s*(and|&)?\s*paste\b/i, weight: -2, label: 'Copy-paste template' },
    { pattern: /\bdo\s+everything\b/i, weight: -2, label: 'Vague scope' },
    { pattern: /\bguru\b/i, weight: -1, label: 'Uses "guru" (vague)' },
    { pattern: /\bsimple\s+(project|task|job)\b/i, weight: -1, label: '"Simple" (often understated)' },
    { pattern: /\beasy\s+(project|task|job|work)\b/i, weight: -1, label: '"Easy" (may undervalue)' },
    { pattern: /\bquick\s+(project|task|job|fix)\b/i, weight: -1, label: '"Quick" (may undervalue)' },
    { pattern: /no\s+(budget|money|pay)/i, weight: -3, label: 'No budget' },
    { pattern: /\bfree\b.*\b(work|trial|test)\b/i, weight: -3, label: 'Expects free work' },
    { pattern: /\btest\s+project\b/i, weight: -1, label: 'Test project (may not pay)' },
    { pattern: /\bunpaid\b/i, weight: -3, label: 'Unpaid work' }
  ];

  // ─── Analysis engine ────────────────────────────────────────────

  function _matchSignals(text, signals) {
    var matches = [];
    for (var i = 0; i < signals.length; i++) {
      if (signals[i].pattern.test(text)) {
        matches.push(signals[i]);
      }
    }
    return matches;
  }

  function _wordCount(text) {
    return (text.match(/\b\w+\b/g) || []).length;
  }

  function _sentenceCount(text) {
    return (text.match(/[.!?]+/g) || []).length || 1;
  }

  /**
   * Analyze a job posting text.
   * @param {string} text - The full job posting text
   * @returns {Object} Analysis result with quality, urgency, negotiability scores and signals
   */
  function analyze(text) {
    if (!text || typeof text !== 'string') {
      return {
        quality: { score: 0, level: 'unknown', signals: [] },
        urgency: { score: 0, level: 'none', signals: [] },
        negotiability: { score: 0, direction: 'unknown', signals: [] },
        readability: { wordCount: 0, sentenceCount: 0, avgWordsPerSentence: 0 }
      };
    }

    var trimmed = text.trim();

    // Urgency
    var urgencyMatches = _matchSignals(trimmed, URGENCY_SIGNALS);
    var urgencyScore = urgencyMatches.reduce(function (s, m) { return s + m.weight; }, 0);
    urgencyScore = Math.min(10, urgencyScore);
    var urgencyLevel;
    if (urgencyScore >= 5) urgencyLevel = 'high';
    else if (urgencyScore >= 2) urgencyLevel = 'medium';
    else urgencyLevel = 'none';

    // Negotiability
    var negMatches = _matchSignals(trimmed, NEGOTIABILITY_SIGNALS);
    var negScore = 0;
    var firmCount = 0;
    var flexCount = 0;
    negMatches.forEach(function (m) {
      if (m.direction === 'negotiable') { negScore += m.weight; flexCount++; }
      else { negScore -= m.weight; firmCount++; }
    });
    var negDirection;
    if (flexCount > firmCount) negDirection = 'negotiable';
    else if (firmCount > flexCount) negDirection = 'firm';
    else negDirection = 'unknown';

    // Quality
    var posMatches = _matchSignals(trimmed, QUALITY_POSITIVE);
    var negQualMatches = _matchSignals(trimmed, QUALITY_NEGATIVE);
    var qualityScore = 50; // baseline
    posMatches.forEach(function (m) { qualityScore += m.weight * 5; });
    negQualMatches.forEach(function (m) { qualityScore += m.weight * 5; }); // negative weights

    // Length bonus/penalty
    var wc = _wordCount(trimmed);
    if (wc >= 150) qualityScore += 10;
    else if (wc >= 80) qualityScore += 5;
    else if (wc < 30) qualityScore -= 15;

    qualityScore = Math.max(0, Math.min(100, qualityScore));

    var qualityLevel;
    if (qualityScore >= 70) qualityLevel = 'good';
    else if (qualityScore >= 40) qualityLevel = 'average';
    else qualityLevel = 'poor';

    // Readability
    var sc = _sentenceCount(trimmed);
    var avgWps = sc > 0 ? Math.round(wc / sc) : wc;

    return {
      quality: {
        score: qualityScore,
        level: qualityLevel,
        signals: posMatches.concat(negQualMatches).map(function (m) { return m.label; })
      },
      urgency: {
        score: urgencyScore,
        level: urgencyLevel,
        signals: urgencyMatches.map(function (m) { return m.label; })
      },
      negotiability: {
        score: Math.abs(negScore),
        direction: negDirection,
        signals: negMatches.map(function (m) { return m.label; })
      },
      readability: {
        wordCount: wc,
        sentenceCount: sc,
        avgWordsPerSentence: avgWps
      }
    };
  }

  // ─── Public API ─────────────────────────────────────────────────

  window.CortexJobLanguageAnalyzer = {
    analyze: analyze
  };

  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.JobLanguageAnalyzer = {
    analyze: analyze,
    version: '1.0.0',
  };

})();
