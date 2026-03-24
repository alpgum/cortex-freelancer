/**
 * CF-251: Viral Share Mechanism — Profile Score Cards
 * Generates shareable image card data: 'My Upwork Profile Score: 87/100 — powered by Cortex Freelancer'.
 */
(function () {
  'use strict';

  var CARD_DEFAULTS = {
    brandName: 'Cortex Freelancer',
    tagline: 'powered by Cortex Freelancer',
    shareUrl: 'https://cortexfreelancer.com/score',
    colors: {
      excellent: { bg: '#10B981', text: '#FFFFFF', label: 'Excellent' },
      good: { bg: '#3B82F6', text: '#FFFFFF', label: 'Good' },
      average: { bg: '#F59E0B', text: '#1F2937', label: 'Needs Work' },
      poor: { bg: '#EF4444', text: '#FFFFFF', label: 'Needs Attention' }
    },
    dimensions: { width: 1200, height: 630 }
  };

  /**
   * Determine score tier.
   * @param {number} score - 0 to 100
   * @returns {object}
   */
  function getScoreTier(score) {
    if (score >= 85) return CARD_DEFAULTS.colors.excellent;
    if (score >= 65) return CARD_DEFAULTS.colors.good;
    if (score >= 40) return CARD_DEFAULTS.colors.average;
    return CARD_DEFAULTS.colors.poor;
  }

  /**
   * Generate shareable card data for a profile score.
   * @param {object} params
   * @param {string} params.name - Freelancer display name
   * @param {number} params.score - Profile score (0-100)
   * @param {string} [params.title] - Professional title
   * @param {object} [params.breakdown] - Score breakdown by category
   * @returns {object} Card data for rendering
   */
  function generateCard(params) {
    var p = params || {};
    var score = Math.max(0, Math.min(100, Math.round(p.score || 0)));
    var tier = getScoreTier(score);

    var breakdown = p.breakdown || {};
    var categories = Object.keys(breakdown).map(function (key) {
      return { category: key, score: breakdown[key] };
    });

    return {
      headline: 'My Upwork Profile Score: ' + score + '/100',
      tagline: CARD_DEFAULTS.tagline,
      name: p.name || 'Freelancer',
      title: p.title || '',
      score: score,
      tier: tier,
      categories: categories,
      dimensions: CARD_DEFAULTS.dimensions,
      shareUrl: CARD_DEFAULTS.shareUrl
    };
  }

  /**
   * Generate share text for various platforms.
   * @param {number} score
   * @param {string} [name]
   * @returns {object} Platform-specific share text
   */
  function generateShareText(score, name) {
    var s = Math.round(score || 0);
    var displayName = name || 'I';
    var tier = getScoreTier(s);

    return {
      twitter: displayName + ' scored ' + s + '/100 on the Upwork Profile Score by @cortexfreelance! ' + tier.label + ' 🎯\n\nCheck your score → ' + CARD_DEFAULTS.shareUrl + '\n\n#upwork #freelancing',
      linkedin: 'Just checked my Upwork profile score with Cortex Freelancer — ' + s + '/100 (' + tier.label + ')!\n\nThe breakdown showed me exactly where to improve. If you freelance on Upwork, this is a must-try.\n\n→ ' + CARD_DEFAULTS.shareUrl,
      facebook: 'My Upwork Profile Score: ' + s + '/100 — ' + tier.label + '! 🎯\n\nFree tool by Cortex Freelancer → ' + CARD_DEFAULTS.shareUrl,
      clipboard: 'My Upwork Profile Score: ' + s + '/100 — ' + tier.label + '. Check yours at ' + CARD_DEFAULTS.shareUrl
    };
  }

  /**
   * Generate share URLs for each platform.
   * @param {number} score
   * @param {string} [name]
   * @returns {object} Platform share URLs
   */
  function generateShareUrls(score, name) {
    var texts = generateShareText(score, name);

    return {
      twitter: 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(texts.twitter),
      linkedin: 'https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(CARD_DEFAULTS.shareUrl),
      facebook: 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(CARD_DEFAULTS.shareUrl) + '&quote=' + encodeURIComponent(texts.facebook)
    };
  }

  /**
   * Generate OG meta tag data for a score card page.
   * @param {number} score
   * @param {string} [name]
   * @returns {object}
   */
  function generateOGMeta(score, name) {
    var s = Math.round(score || 0);
    var tier = getScoreTier(s);
    var displayName = name || 'A freelancer';

    return {
      title: displayName + '\'s Upwork Profile Score: ' + s + '/100',
      description: tier.label + '! Score your own Upwork profile for free with Cortex Freelancer.',
      url: CARD_DEFAULTS.shareUrl,
      type: 'website',
      image: CARD_DEFAULTS.shareUrl + '/card/' + s + '.png'
    };
  }

  // Export to namespace
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.ProfileScoreCards = {
    generateCard: generateCard,
    generateShareText: generateShareText,
    generateShareUrls: generateShareUrls,
    generateOGMeta: generateOGMeta,
    getScoreTier: getScoreTier
  };
})();
