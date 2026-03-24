/**
 * Cortex Freelancer — Proposal Length Optimizer [CF-035]
 *
 * Analyzes proposal length against category-specific ideal ranges.
 * Provides word/sentence/paragraph counts, readability metrics,
 * visual indicator data, and actionable suggestions.
 */
window.CortexFreelancer = window.CortexFreelancer || {};
window.CortexFreelancer.ProposalLengthOptimizer = (function () {
  'use strict';

  // ── Ideal word-count ranges by job category ──────────────────────────
  var CATEGORY_RANGES = {
    'Web Development':       { min: 150, max: 350 },
    'Mobile Development':    { min: 150, max: 350 },
    'Data Science':          { min: 200, max: 400 },
    'Machine Learning':      { min: 200, max: 400 },
    'Design':                { min: 100, max: 300 },
    'Graphic Design':        { min: 100, max: 300 },
    'UI/UX Design':          { min: 120, max: 320 },
    'Writing':               { min: 200, max: 400 },
    'Copywriting':           { min: 150, max: 350 },
    'Translation':           { min: 100, max: 250 },
    'Marketing':             { min: 150, max: 350 },
    'SEO':                   { min: 150, max: 300 },
    'Video Editing':         { min: 100, max: 250 },
    'Virtual Assistant':     { min: 100, max: 250 },
    'Accounting':            { min: 120, max: 300 },
    'Customer Service':      { min: 100, max: 250 },
    'default':               { min: 100, max: 500 }
  };

  // ── Text metrics ─────────────────────────────────────────────────────

  /**
   * Count words in text (splits on whitespace, ignores empty tokens).
   */
  function countWords(text) {
    if (!text || !text.trim()) return 0;
    return text.trim().split(/\s+/).length;
  }

  /**
   * Count sentences (naive split on .!? followed by space or end).
   */
  function countSentences(text) {
    if (!text || !text.trim()) return 0;
    var matches = text.trim().match(/[^.!?]*[.!?]+/g);
    return matches ? matches.length : (text.trim().length > 0 ? 1 : 0);
  }

  /**
   * Count paragraphs (blocks separated by one or more blank lines).
   */
  function countParagraphs(text) {
    if (!text || !text.trim()) return 0;
    return text.trim().split(/\n\s*\n/).filter(function (p) {
      return p.trim().length > 0;
    }).length || 1;
  }

  /**
   * Return all basic text metrics.
   */
  function getMetrics(text) {
    var words = countWords(text);
    var sentences = countSentences(text);
    var paragraphs = countParagraphs(text);
    var characters = text ? text.length : 0;
    var charactersNoSpaces = text ? text.replace(/\s/g, '').length : 0;
    var avgWordsPerSentence = sentences > 0 ? Math.round((words / sentences) * 10) / 10 : 0;

    return {
      words: words,
      sentences: sentences,
      paragraphs: paragraphs,
      characters: characters,
      charactersNoSpaces: charactersNoSpaces,
      avgWordsPerSentence: avgWordsPerSentence
    };
  }

  // ── Range helpers ────────────────────────────────────────────────────

  function getRangeForCategory(category) {
    if (category && CATEGORY_RANGES[category]) {
      return CATEGORY_RANGES[category];
    }
    return CATEGORY_RANGES['default'];
  }

  /**
   * Determine status relative to a range.
   * Returns { status, percentage, color }.
   *   status:     "too-short" | "optimal" | "too-long"
   *   percentage:  0-100 clamped progress through the range
   *   color:       "red" | "green" | "yellow"
   */
  function evaluateLength(wordCount, range) {
    if (wordCount < range.min) {
      var pct = range.min > 0 ? Math.round((wordCount / range.min) * 100) : 0;
      return { status: 'too-short', percentage: Math.min(pct, 100), color: 'red' };
    }
    if (wordCount > range.max) {
      // percentage shows how far past max (capped at 100 for bar display)
      var overPct = Math.round((wordCount / range.max) * 100);
      return { status: 'too-long', percentage: Math.min(overPct, 100), color: 'yellow' };
    }
    // Within range — percentage within the optimal band
    var span = range.max - range.min;
    var pos = wordCount - range.min;
    var optPct = span > 0 ? Math.round((pos / span) * 100) : 100;
    return { status: 'optimal', percentage: optPct, color: 'green' };
  }

  // ── Suggestions ──────────────────────────────────────────────────────

  function buildSuggestions(wordCount, range, metrics) {
    var suggestions = [];

    if (wordCount < range.min) {
      var deficit = range.min - wordCount;
      suggestions.push('Add approximately ' + deficit + ' more words to reach the minimum recommended length.');
      suggestions.push('Consider elaborating on your relevant experience or past results.');
      suggestions.push('Include a brief mention of your process or methodology.');
      suggestions.push('Add a sentence about why this project interests you.');
    }

    if (wordCount > range.max) {
      var excess = wordCount - range.max;
      suggestions.push('Trim approximately ' + excess + ' words to stay within the recommended length.');
      suggestions.push('Remove filler phrases like "I believe that", "In my opinion", "As you can see".');
      suggestions.push('Combine short sentences to reduce redundancy.');
      suggestions.push('Focus on your strongest 2–3 qualifications instead of listing everything.');
    }

    if (metrics.avgWordsPerSentence > 25) {
      suggestions.push('Your sentences average ' + metrics.avgWordsPerSentence + ' words — try breaking long sentences for readability.');
    }

    if (metrics.avgWordsPerSentence < 8 && metrics.sentences > 3) {
      suggestions.push('Your sentences are quite short (avg ' + metrics.avgWordsPerSentence + ' words). Combine some for a smoother read.');
    }

    if (metrics.paragraphs === 1 && wordCount > 150) {
      suggestions.push('Break your proposal into multiple paragraphs for better scannability.');
    }

    return suggestions;
  }

  // ── Public API ───────────────────────────────────────────────────────

  /**
   * Full analysis of a proposal's length.
   *
   * @param {string} text      - The proposal text.
   * @param {string} [category] - Job category (optional, defaults to generic range).
   * @returns {Object} Analysis result.
   */
  function analyze(text, category) {
    var range = getRangeForCategory(category);
    var metrics = getMetrics(text || '');
    var evaluation = evaluateLength(metrics.words, range);
    var suggestions = buildSuggestions(metrics.words, range, metrics);

    return {
      metrics: metrics,
      range: { min: range.min, max: range.max, category: category || 'default' },
      status: evaluation.status,
      indicator: {
        percentage: evaluation.percentage,
        color: evaluation.color
      },
      suggestions: suggestions
    };
  }

  /**
   * Quick check — returns just the status string.
   */
  function quickCheck(text, category) {
    var range = getRangeForCategory(category);
    return evaluateLength(countWords(text || ''), range).status;
  }

  /**
   * List all supported categories and their ranges.
   */
  function getCategories() {
    var out = {};
    for (var key in CATEGORY_RANGES) {
      if (CATEGORY_RANGES.hasOwnProperty(key) && key !== 'default') {
        out[key] = { min: CATEGORY_RANGES[key].min, max: CATEGORY_RANGES[key].max };
      }
    }
    return out;
  }

  /**
   * Set or override a category range.
   */
  function setCategoryRange(category, min, max) {
    if (!category || typeof min !== 'number' || typeof max !== 'number' || min < 0 || max <= min) {
      return { error: 'Invalid parameters. Provide category string and min < max >= 0.' };
    }
    CATEGORY_RANGES[category] = { min: min, max: max };
    return { success: true, category: category, min: min, max: max };
  }

  return {
    analyze: analyze,
    quickCheck: quickCheck,
    getMetrics: getMetrics,
    getCategories: getCategories,
    setCategoryRange: setCategoryRange
  };
})();
