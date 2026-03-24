/**
 * Cortex Freelancer — Proposal Tone Analyzer [CF-034]
 *
 * Analyzes proposal text across four tone dimensions: formality,
 * enthusiasm, confidence, and clarity. Returns 0-100 scores per
 * dimension, flags overly casual or stiff language, and provides
 * actionable feedback with specific text adjustments.
 */
window.CortexFreelancer = window.CortexFreelancer || {};
window.CortexFreelancer.ProposalToneAnalyzer = (function () {
  'use strict';

  // ── Word / phrase lists ──────────────────────────────────────────────

  var FORMAL_WORDS = [
    'regarding', 'hereby', 'pursuant', 'enclosed', 'accordingly',
    'furthermore', 'therefore', 'henceforth', 'whereas', 'notwithstanding',
    'aforementioned', 'herein', 'facilitate', 'commence', 'endeavor',
    'undertake', 'pertaining', 'shall', 'forthwith', 'deem',
    'subsequently', 'nevertheless', 'consequently', 'respectively'
  ];

  var CASUAL_WORDS = [
    'hey', 'awesome', 'cool', 'gonna', 'stuff', 'basically',
    'wanna', 'kinda', 'sorta', 'lol', 'btw', 'tbh', 'imho',
    'tons', 'super', 'guys', 'yeah', 'yep', 'nope', 'legit',
    'chill', 'vibe', 'dope', 'sick', 'lit', 'fyi', 'haha'
  ];

  var ENTHUSIASM_WORDS = [
    'excited', 'thrilled', 'passionate', 'love', 'eager', 'amazing',
    'fantastic', 'wonderful', 'incredible', 'delighted', 'inspired',
    'enjoy', 'energized', 'motivated', 'fascinated'
  ];

  var CONFIDENCE_WORDS = [
    'proven', 'expert', 'guarantee', 'ensure', 'deliver', 'achieve',
    'successfully', 'accomplished', 'proficient', 'skilled', 'capable',
    'confident', 'specialize', 'mastered', 'extensive', 'track record'
  ];

  var HEDGE_WORDS = [
    'maybe', 'perhaps', 'possibly', 'might', 'could', 'try',
    'hopefully', 'think', 'guess', 'suppose', 'somewhat', 'fairly',
    'probably', 'not sure', 'i believe'
  ];

  var PASSIVE_PATTERNS = [
    /\b(?:is|are|was|were|been|being)\s+\w+ed\b/gi
  ];

  // ── Helpers ──────────────────────────────────────────────────────────

  function getWords(text) {
    return (text || '').toLowerCase().match(/\b[a-z']+\b/g) || [];
  }

  function getSentences(text) {
    return (text || '').split(/[.!?]+/).filter(function (s) { return s.trim().length > 3; });
  }

  function countListMatches(words, list) {
    var count = 0;
    var found = [];
    words.forEach(function (w) {
      if (list.indexOf(w) !== -1) {
        count++;
        if (found.indexOf(w) === -1) found.push(w);
      }
    });
    return { count: count, found: found };
  }

  function countPhraseMatches(text, phrases) {
    var lower = (text || '').toLowerCase();
    var count = 0;
    var found = [];
    phrases.forEach(function (p) {
      if (lower.indexOf(p) !== -1) {
        count++;
        found.push(p);
      }
    });
    return { count: count, found: found };
  }

  function clamp(val) {
    return Math.max(0, Math.min(100, Math.round(val)));
  }

  // ── Dimension scorers ────────────────────────────────────────────────

  function scoreFormality(text, words) {
    var total = words.length || 1;
    var formal = countListMatches(words, FORMAL_WORDS);
    var casual = countListMatches(words, CASUAL_WORDS);

    var score = 50;
    score += (formal.count / total) * 500;
    score -= (casual.count / total) * 500;

    // Sentence length affects formality
    var sentences = getSentences(text);
    var avgLen = sentences.length > 0
      ? sentences.reduce(function (a, s) { return a + getWords(s).length; }, 0) / sentences.length
      : 12;
    if (avgLen > 20) score += 8;
    if (avgLen < 8) score -= 8;

    // Contractions reduce formality
    var contractions = (text.match(/\b\w+'\w+\b/g) || []).length;
    score -= (contractions / total) * 200;

    return {
      score: clamp(score),
      formalWords: formal.found,
      casualWords: casual.found
    };
  }

  function scoreEnthusiasm(text, words) {
    var total = words.length || 1;
    var matches = countListMatches(words, ENTHUSIASM_WORDS);

    var score = 30; // baseline low — enthusiasm must be shown
    score += (matches.count / total) * 800;

    // Exclamation marks boost enthusiasm
    var exclamations = (text.match(/!/g) || []).length;
    score += Math.min(exclamations * 8, 25);

    return {
      score: clamp(score),
      enthusiasmWords: matches.found
    };
  }

  function scoreConfidence(text, words) {
    var total = words.length || 1;
    var confident = countListMatches(words, CONFIDENCE_WORDS);
    var hedging = countListMatches(words, HEDGE_WORDS);
    var phrasesConf = countPhraseMatches(text, ['track record', 'i specialize', 'i have delivered']);

    var score = 50;
    score += (confident.count / total) * 600;
    score += phrasesConf.count * 8;
    score -= (hedging.count / total) * 600;

    return {
      score: clamp(score),
      confidenceWords: confident.found,
      hedgeWords: hedging.found
    };
  }

  function scoreClarity(text, words) {
    var sentences = getSentences(text);
    var total = words.length || 1;

    var score = 60; // baseline

    // Penalise very long sentences
    var avgLen = sentences.length > 0
      ? sentences.reduce(function (a, s) { return a + getWords(s).length; }, 0) / sentences.length
      : 12;
    if (avgLen > 25) score -= 15;
    else if (avgLen > 20) score -= 8;
    else if (avgLen < 15) score += 10;

    // Passive voice reduces clarity
    var passiveCount = 0;
    PASSIVE_PATTERNS.forEach(function (rx) {
      var m = text.match(rx);
      if (m) passiveCount += m.length;
    });
    score -= Math.min(passiveCount * 5, 20);

    // Very long paragraphs reduce clarity
    var paragraphs = text.split(/\n\s*\n/).filter(function (p) { return p.trim(); });
    var longParas = paragraphs.filter(function (p) { return getWords(p).length > 80; }).length;
    score -= longParas * 8;

    // Bullet points improve clarity
    var bullets = (text.match(/^\s*[-*•]\s/gm) || []).length;
    score += Math.min(bullets * 5, 15);

    return {
      score: clamp(score),
      avgSentenceLength: Math.round(avgLen * 10) / 10,
      passiveCount: passiveCount
    };
  }

  // ── Overall rating ───────────────────────────────────────────────────

  function overallRating(formality, enthusiasm, confidence, clarity) {
    // Weighted average — formality and clarity weighted higher for proposals
    var avg = (formality * 0.3 + enthusiasm * 0.2 + confidence * 0.25 + clarity * 0.25);
    var score = Math.round(avg);

    var label;
    if (score >= 75) label = 'Professional';
    else if (score >= 55) label = 'Balanced';
    else if (score >= 35) label = 'Casual';
    else label = 'Too Casual';

    return { score: score, label: label };
  }

  // ── Feedback generator ───────────────────────────────────────────────

  function buildFeedback(formality, enthusiasm, confidence, clarity) {
    var feedback = [];

    // Formality
    if (formality.score > 80) {
      feedback.push({ dimension: 'formality', type: 'warning', message: 'Language is very formal — consider a warmer, more conversational tone.', flaggedWords: formality.formalWords });
    } else if (formality.score < 35) {
      feedback.push({ dimension: 'formality', type: 'warning', message: 'Tone is too casual for most clients. Remove slang and tighten language.', flaggedWords: formality.casualWords });
    } else {
      feedback.push({ dimension: 'formality', type: 'ok', message: 'Formality level is appropriate for a professional proposal.' });
    }

    // Enthusiasm
    if (enthusiasm.score < 30) {
      feedback.push({ dimension: 'enthusiasm', type: 'suggestion', message: 'Show more interest — mention what excites you about the project.' });
    } else if (enthusiasm.score > 80) {
      feedback.push({ dimension: 'enthusiasm', type: 'warning', message: 'Enthusiasm may seem over the top. Dial it back slightly for credibility.' });
    } else {
      feedback.push({ dimension: 'enthusiasm', type: 'ok', message: 'Enthusiasm level strikes a good balance.' });
    }

    // Confidence
    if (confidence.score < 35) {
      feedback.push({ dimension: 'confidence', type: 'suggestion', message: 'Use stronger language. Replace hedging words (' + confidence.hedgeWords.join(', ') + ') with definitive statements.', flaggedWords: confidence.hedgeWords });
    } else if (confidence.score > 85) {
      feedback.push({ dimension: 'confidence', type: 'warning', message: 'May come across as overconfident. Balance claims with specific evidence.' });
    } else {
      feedback.push({ dimension: 'confidence', type: 'ok', message: 'Confidence level is solid.' });
    }

    // Clarity
    if (clarity.score < 40) {
      feedback.push({ dimension: 'clarity', type: 'suggestion', message: 'Improve readability: shorten sentences, break up long paragraphs, use bullet points.' });
    } else {
      feedback.push({ dimension: 'clarity', type: 'ok', message: 'Text is clear and easy to scan.' });
    }

    return feedback;
  }

  // ── Text adjustment suggestions ──────────────────────────────────────

  function suggestAdjustments(text, formality, confidence) {
    var adjustments = [];

    // Replace casual words
    formality.casualWords.forEach(function (w) {
      var replacements = {
        'hey': 'Hello', 'awesome': 'excellent', 'cool': 'great',
        'gonna': 'going to', 'wanna': 'want to', 'kinda': 'somewhat',
        'stuff': 'items', 'basically': '', 'super': 'very',
        'guys': 'team', 'yeah': 'yes', 'nope': 'no', 'legit': 'legitimate'
      };
      if (replacements[w] !== undefined) {
        adjustments.push({ type: 'replace', original: w, replacement: replacements[w] || '(remove)', reason: 'Too casual for a proposal' });
      }
    });

    // Replace hedge words
    confidence.hedgeWords.forEach(function (w) {
      var replacements = {
        'maybe': 'I recommend', 'perhaps': 'I suggest',
        'hopefully': 'I will ensure', 'think': 'am confident',
        'guess': 'expect', 'try': 'will'
      };
      if (replacements[w]) {
        adjustments.push({ type: 'replace', original: w, replacement: replacements[w], reason: 'Hedging reduces perceived confidence' });
      }
    });

    return adjustments;
  }

  // ── Public API ───────────────────────────────────────────────────────

  /**
   * Full tone analysis of a proposal.
   *
   * @param {string} text - Proposal text to analyse.
   * @returns {Object} Complete analysis with dimension scores, feedback, and adjustments.
   */
  function analyze(text) {
    if (!text || !text.trim()) {
      return {
        overall: { score: 0, label: 'N/A' },
        dimensions: {
          formality: { score: 0 },
          enthusiasm: { score: 0 },
          confidence: { score: 0 },
          clarity: { score: 0 }
        },
        feedback: [{ dimension: 'general', type: 'info', message: 'Enter proposal text to analyse tone.' }],
        adjustments: []
      };
    }

    var words = getWords(text);
    var formality = scoreFormality(text, words);
    var enthusiasm = scoreEnthusiasm(text, words);
    var confidence = scoreConfidence(text, words);
    var clarity = scoreClarity(text, words);
    var overall = overallRating(formality.score, enthusiasm.score, confidence.score, clarity.score);
    var feedback = buildFeedback(formality, enthusiasm, confidence, clarity);
    var adjustments = suggestAdjustments(text, formality, confidence);

    return {
      overall: overall,
      dimensions: {
        formality: formality,
        enthusiasm: enthusiasm,
        confidence: confidence,
        clarity: clarity
      },
      feedback: feedback,
      adjustments: adjustments
    };
  }

  /**
   * Quick score — returns just the overall score number.
   */
  function quickScore(text) {
    return analyze(text).overall.score;
  }

  return {
    analyze: analyze,
    quickScore: quickScore
  };
})();
