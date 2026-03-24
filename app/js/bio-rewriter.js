/**
 * CF-004: Upwork Overview/Bio AI Rewriter with Tone Selector
 * Calls /api/rewrite-bio for AI rewrite; falls back to local rule-based rewrite.
 */
(function () {
  'use strict';

  const API_ENDPOINT = '/api/rewrite-bio';
  const REQUEST_TIMEOUT_MS = 30000;

  /**
   * Rewrite a freelancer bio using the AI endpoint.
   * Falls back to local rule-based rewrite if the API is unavailable.
   *
   * @param {object} params
   * @param {string} params.bio - Current bio/overview text
   * @param {"professional"|"friendly"|"bold"} params.tone - Desired tone
   * @param {string[]} [params.skills] - List of skills to emphasize
   * @returns {Promise<{ rewritten: string, tone: string, source: "ai"|"rules", changes: string[] }>}
   */
  async function rewriteBio(params) {
    const { bio, tone, skills } = params || {};

    if (!bio || !bio.trim()) {
      return { rewritten: '', tone: tone || 'professional', source: 'rules', changes: ['No bio provided'] };
    }

    // Try API first
    try {
      const controller = new AbortController();
      const timer = setTimeout(function () { controller.abort(); }, REQUEST_TIMEOUT_MS);

      const res = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bio: bio, tone: tone || 'professional', skills: skills || [] }),
        signal: controller.signal
      });

      clearTimeout(timer);

      if (res.ok) {
        var data = await res.json();
        if (data.rewritten) return data;
      }
    } catch (_err) {
      // Fall through to rule-based
    }

    // Rule-based fallback
    return ruleBasedRewrite(bio, tone || 'professional', skills || []);
  }

  /** Tone-specific templates */
  const TONE_CONFIG = {
    professional: {
      opening: 'With extensive experience in {skills}, I deliver high-quality results that drive measurable business outcomes.',
      connector: 'My expertise spans',
      closing: 'I welcome the opportunity to discuss how I can contribute to your project\'s success.',
      adjectives: ['seasoned', 'meticulous', 'strategic', 'results-oriented']
    },
    friendly: {
      opening: 'Hey there! I\'m passionate about {skills} and love helping clients bring their ideas to life.',
      connector: 'I\'m skilled in',
      closing: 'Let\'s chat about your project — I\'d love to hear what you\'re working on!',
      adjectives: ['enthusiastic', 'collaborative', 'creative', 'approachable']
    },
    bold: {
      opening: 'I don\'t just do {skills} — I transform businesses with it.',
      connector: 'I dominate in',
      closing: 'Ready to level up? Let\'s make it happen. Message me now.',
      adjectives: ['unstoppable', 'elite', 'top-tier', 'game-changing']
    }
  };

  /**
   * Rule-based bio rewrite when the API is unavailable.
   * @param {string} bio
   * @param {string} tone
   * @param {string[]} skills
   * @returns {{ rewritten: string, tone: string, source: "rules", changes: string[] }}
   */
  function ruleBasedRewrite(bio, tone, skills) {
    var config = TONE_CONFIG[tone] || TONE_CONFIG.professional;
    var changes = [];
    var sentences = bio.split(/(?<=[.!?])\s+/).filter(function (s) { return s.trim().length > 5; });
    var parts = [];

    // Opening
    var skillsText = skills.length > 0 ? skills.slice(0, 3).join(', ') : 'my field';
    parts.push(config.opening.replace('{skills}', skillsText));
    changes.push('Added ' + tone + '-tone opening hook');

    // Keep and enhance core sentences from the original bio
    var kept = sentences.filter(function (s) {
      var lower = s.toLowerCase();
      // Skip filler sentences
      return !(/^(i am|i\'m|my name|hello|hi |hey |welcome)/i.test(lower));
    }).slice(0, 4);

    if (kept.length > 0) {
      parts.push('\n\n' + kept.join(' '));
      changes.push('Preserved ' + kept.length + ' core sentences from original');
    }

    // Skills showcase
    if (skills.length > 0) {
      parts.push('\n\n' + config.connector + ' ' + skills.join(', ') + '.');
      changes.push('Highlighted skills with tone-appropriate framing');
    }

    // Value prop
    var adj = config.adjectives;
    parts.push('\n\nI bring a ' + adj[0] + ', ' + adj[1] + ' approach to every engagement — ensuring ' + adj[2] + ' solutions that exceed expectations.');
    changes.push('Added value proposition');

    // Closing CTA
    parts.push('\n\n' + config.closing);
    changes.push('Added call-to-action');

    return {
      rewritten: parts.join(''),
      tone: tone,
      source: 'rules',
      changes: changes
    };
  }

  // Export to namespace
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.BioRewriter = {
    rewriteBio: rewriteBio
  };
})();
