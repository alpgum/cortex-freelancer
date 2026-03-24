/**
 * Cortex Freelancer — Cover Letter vs Proposal Separator [CF-036]
 *
 * Splits a proposal into a cover-letter section (personal touch, greeting,
 * enthusiasm) and a technical-approach section (skills, methodology, timeline).
 * Supports auto-detection, manual adjustment, independent editing, merging,
 * section templates, and validation.
 */
window.CortexFreelancer = window.CortexFreelancer || {};
window.CortexFreelancer.CoverLetterSeparator = (function () {
  'use strict';

  var STORAGE_KEY = 'cortex_cover_letter_sections';

  // ── Section detection patterns ───────────────────────────────────────

  var TECHNICAL_TRIGGERS = [
    /\b(technical approach|my approach|methodology|how i would|here(?:'|')?s how|my plan|project plan)\b/i,
    /\b(deliverables|milestones|timeline|phases?|step\s*\d|stack|tools? i(?:'|')?ll use)\b/i,
    /\b(implementation|architecture|tech stack|solution overview)\b/i
  ];

  var COVER_LETTER_SIGNALS = [
    /\b(hi|hello|dear|greetings)\b/i,
    /\b(excited|thrilled|passionate|love|interest(?:ed|ing))\b/i,
    /\b(i(?:'|')?m a|my name is|about me|i have \d+ years)\b/i,
    /\b(thank you|thanks for|looking forward)\b/i
  ];

  // ── Templates ────────────────────────────────────────────────────────

  var TEMPLATES = {
    coverLetter: {
      greeting: 'Hi [Client Name],',
      body: [
        'I came across your project and am excited about the opportunity to contribute.',
        'With [X] years of experience in [relevant field], I have a strong track record of delivering [type of work].',
        'What drew me to this project is [specific reason].'
      ].join('\n\n'),
      closing: 'I would love to discuss how I can help bring your vision to life.'
    },
    technical: {
      header: 'Technical Approach',
      body: [
        '**Understanding:** [Restate the problem in your own words]',
        '',
        '**Proposed Solution:**',
        '1. [Phase 1 description]',
        '2. [Phase 2 description]',
        '3. [Phase 3 description]',
        '',
        '**Timeline:** [Estimated duration]',
        '',
        '**Deliverables:**',
        '- [Deliverable 1]',
        '- [Deliverable 2]'
      ].join('\n')
    }
  };

  // ── Helpers ──────────────────────────────────────────────────────────

  function loadStore() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch (e) {
      return {};
    }
  }

  function saveStore(store) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }

  /**
   * Score a paragraph for how "technical" it reads.
   */
  function technicalScore(paragraph) {
    var score = 0;
    TECHNICAL_TRIGGERS.forEach(function (rx) {
      if (rx.test(paragraph)) score += 2;
    });
    // Bullet / numbered lists boost technical score
    if (/^\s*[-*•]\s/m.test(paragraph)) score += 1;
    if (/^\s*\d+[.)]\s/m.test(paragraph)) score += 1;
    return score;
  }

  function coverLetterScore(paragraph) {
    var score = 0;
    COVER_LETTER_SIGNALS.forEach(function (rx) {
      if (rx.test(paragraph)) score += 2;
    });
    return score;
  }

  // ── Core: auto-detect split point ────────────────────────────────────

  /**
   * Auto-split proposal text into cover letter and technical sections.
   *
   * Strategy: walk paragraphs top-down. Once cumulative technical score
   * exceeds cover-letter score, the remaining text is technical.
   *
   * @param {string} text - Full proposal text.
   * @returns {{ coverLetter: string, technical: string, splitIndex: number }}
   */
  function autoSplit(text) {
    if (!text || !text.trim()) {
      return { coverLetter: '', technical: '', splitIndex: -1 };
    }

    var paragraphs = text.split(/\n\s*\n/).filter(function (p) { return p.trim().length > 0; });

    if (paragraphs.length <= 1) {
      return { coverLetter: text.trim(), technical: '', splitIndex: -1 };
    }

    var bestSplit = -1;
    var bestDelta = -Infinity;

    for (var i = 1; i < paragraphs.length; i++) {
      var techSum = 0;
      var coverSum = 0;

      // Before split = cover letter
      for (var c = 0; c < i; c++) coverSum += coverLetterScore(paragraphs[c]);
      // After split = technical
      for (var t = i; t < paragraphs.length; t++) techSum += technicalScore(paragraphs[t]);

      var delta = techSum + coverSum;
      if (delta > bestDelta) {
        bestDelta = delta;
        bestSplit = i;
      }
    }

    if (bestSplit <= 0) bestSplit = Math.ceil(paragraphs.length / 2);

    var coverParagraphs = paragraphs.slice(0, bestSplit);
    var techParagraphs = paragraphs.slice(bestSplit);

    return {
      coverLetter: coverParagraphs.join('\n\n'),
      technical: techParagraphs.join('\n\n'),
      splitIndex: bestSplit
    };
  }

  /**
   * Manually split at a specific paragraph index.
   */
  function manualSplit(text, splitAtParagraph) {
    var paragraphs = (text || '').split(/\n\s*\n/).filter(function (p) { return p.trim().length > 0; });
    var idx = Math.max(0, Math.min(splitAtParagraph, paragraphs.length));
    return {
      coverLetter: paragraphs.slice(0, idx).join('\n\n'),
      technical: paragraphs.slice(idx).join('\n\n'),
      splitIndex: idx
    };
  }

  // ── Merge ────────────────────────────────────────────────────────────

  /**
   * Merge cover letter and technical sections into a single proposal.
   *
   * @param {string} coverLetter
   * @param {string} technical
   * @param {Object} [options]
   * @param {string} [options.separator] - Text between sections (default: blank line).
   * @param {string} [options.transition] - Transition sentence inserted between sections.
   * @returns {string} Merged proposal.
   */
  function merge(coverLetter, technical, options) {
    var opts = options || {};
    var parts = [];
    if (coverLetter && coverLetter.trim()) parts.push(coverLetter.trim());
    if (opts.transition) parts.push(opts.transition);
    if (technical && technical.trim()) parts.push(technical.trim());
    var sep = opts.separator !== undefined ? opts.separator : '\n\n';
    return parts.join(sep);
  }

  // ── Validation ───────────────────────────────────────────────────────

  function validateCoverLetter(text) {
    var issues = [];
    if (!text || !text.trim()) {
      issues.push('Cover letter section is empty.');
      return { valid: false, issues: issues };
    }
    var hasGreeting = /\b(hi|hello|dear|greetings)\b/i.test(text);
    if (!hasGreeting) issues.push('Consider adding a greeting (e.g., "Hi [Client Name]").');

    var hasPersonalTouch = /\b(I|my|me)\b/i.test(text);
    if (!hasPersonalTouch) issues.push('Add a personal touch — mention your background or enthusiasm.');

    return { valid: issues.length === 0, issues: issues };
  }

  function validateTechnical(text) {
    var issues = [];
    if (!text || !text.trim()) {
      issues.push('Technical approach section is empty.');
      return { valid: false, issues: issues };
    }
    var hasSpecifics = /\b(step|phase|deliver|timeline|milestone|approach|implement)\b/i.test(text);
    if (!hasSpecifics) issues.push('Include specifics such as steps, deliverables, or a timeline.');

    var hasList = /^\s*[-*•\d]/m.test(text);
    if (!hasList) issues.push('Consider using a bulleted or numbered list for clarity.');

    return { valid: issues.length === 0, issues: issues };
  }

  // ── Persistence ──────────────────────────────────────────────────────

  function saveSections(proposalId, coverLetter, technical) {
    var store = loadStore();
    store[proposalId] = {
      coverLetter: coverLetter,
      technical: technical,
      updatedAt: new Date().toISOString()
    };
    saveStore(store);
    return store[proposalId];
  }

  function loadSections(proposalId) {
    var store = loadStore();
    return store[proposalId] || null;
  }

  function deleteSections(proposalId) {
    var store = loadStore();
    if (!store[proposalId]) return false;
    delete store[proposalId];
    saveStore(store);
    return true;
  }

  // ── Public API ───────────────────────────────────────────────────────

  return {
    autoSplit: autoSplit,
    manualSplit: manualSplit,
    merge: merge,
    validateCoverLetter: validateCoverLetter,
    validateTechnical: validateTechnical,
    saveSections: saveSections,
    loadSections: loadSections,
    deleteSections: deleteSections,
    getTemplates: function () {
      return JSON.parse(JSON.stringify(TEMPLATES));
    }
  };
})();
