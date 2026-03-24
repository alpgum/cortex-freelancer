/**
 * CF-248: Product Hunt Landing Page Variant — special landing page for PH traffic
 * with badge, PH-specific copy, upvote CTA, and special offer for PH visitors.
 */
(function () {
  'use strict';

  var PH_PARAM = 'ref';
  var PH_VALUE = 'producthunt';
  var STORAGE_KEY = 'cortex_ph_visitor';
  var PH_POST_URL = 'https://www.producthunt.com/posts/cortex-freelancer';
  var SPECIAL_OFFER_CODE = 'PHLAUNCH2024';
  var OFFER_DISCOUNT = 30;

  /**
   * Detect if current visitor came from Product Hunt.
   * @returns {boolean}
   */
  function isPHVisitor() {
    var params = new URLSearchParams(window.location.search);
    if (params.get(PH_PARAM) === PH_VALUE || params.get('utm_source') === 'producthunt') {
      _markPHVisitor();
      return true;
    }
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch (_e) { return false; }
  }

  /**
   * Mark visitor as coming from Product Hunt.
   * @private
   */
  function _markPHVisitor() {
    try { localStorage.setItem(STORAGE_KEY, 'true'); } catch (_e) {}
  }

  /**
   * Render the "Featured on Product Hunt" badge.
   * @param {object} [options]
   * @param {string} [options.theme] - 'light' or 'dark'
   * @returns {string}
   */
  function renderBadge(options) {
    options = options || {};
    var theme = options.theme === 'dark' ? 'ph-badge--dark' : 'ph-badge--light';
    return '<a href="' + PH_POST_URL + '" target="_blank" rel="noopener" class="ph-badge ' + theme + '">' +
      '<span class="ph-badge__icon">\ud83d\ude80</span>' +
      '<span class="ph-badge__text">' +
        '<span class="ph-badge__featured">FEATURED ON</span>' +
        '<span class="ph-badge__ph">Product Hunt</span>' +
      '</span>' +
    '</a>';
  }

  /**
   * Render the full PH landing page variant.
   * @param {object} [options]
   * @param {string} [options.containerId]
   * @returns {string}
   */
  function renderLandingPage(options) {
    options = options || {};

    return '<div class="ph-landing">' +
      '<header class="ph-landing__header">' +
        renderBadge({ theme: 'light' }) +
      '</header>' +

      '<section class="ph-landing__hero">' +
        '<h1 class="ph-landing__title">Welcome, Product Hunters! \ud83c\udf89</h1>' +
        '<p class="ph-landing__subtitle">' +
          'Cortex Freelancer is the AI-powered toolkit that helps Upwork freelancers ' +
          'optimize profiles, write winning proposals, and charge what they\'re worth.' +
        '</p>' +
        '<div class="ph-landing__cta-group">' +
          '<a href="' + PH_POST_URL + '" target="_blank" rel="noopener" class="btn btn--primary ph-landing__upvote-btn">' +
            '\u2b06\ufe0f Support us on Product Hunt' +
          '</a>' +
          '<a href="#tools" class="btn btn--secondary ph-landing__try-btn">Try Free Tools</a>' +
        '</div>' +
      '</section>' +

      '<section class="ph-landing__offer">' +
        '<div class="ph-landing__offer-card">' +
          '<h2 class="ph-landing__offer-title">\ud83c\udf81 Exclusive Product Hunt Offer</h2>' +
          '<p class="ph-landing__offer-desc">' +
            'As a Product Hunt visitor, get <strong>' + OFFER_DISCOUNT + '% off</strong> your first 3 months of Pro.' +
          '</p>' +
          '<div class="ph-landing__offer-code">' +
            '<span class="ph-landing__code-label">Use code:</span> ' +
            '<code class="ph-landing__code">' + SPECIAL_OFFER_CODE + '</code>' +
          '</div>' +
          '<a href="/pricing?code=' + SPECIAL_OFFER_CODE + '" class="btn btn--primary">Claim Your Discount</a>' +
        '</div>' +
      '</section>' +

      '<section class="ph-landing__features">' +
        '<h2>What you get with Cortex Freelancer</h2>' +
        '<div class="ph-landing__grid">' +
          _featureCard('Profile Analyzer', 'AI scores your Upwork profile and gives you a step-by-step improvement plan.') +
          _featureCard('Proposal Generator', 'Generate tailored, winning proposals in seconds — not hours.') +
          _featureCard('Rate Calculator', 'Find the optimal rate for your skills based on real market data.') +
          _featureCard('Bid Strategy', 'Know which jobs to bid on and how to stand out from the competition.') +
        '</div>' +
      '</section>' +

      '<section class="ph-landing__social-proof">' +
        '<h2>Trusted by Upwork freelancers</h2>' +
        '<div class="ph-landing__stats">' +
          _statBlock('10,000+', 'Profiles analyzed') +
          _statBlock('+23pts', 'Avg. score improvement') +
          _statBlock('4.8/5', 'User rating') +
        '</div>' +
      '</section>' +

      '<footer class="ph-landing__footer">' +
        renderBadge({ theme: 'dark' }) +
        '<p class="ph-landing__footer-text">Made with \u2764\ufe0f for the freelancer community</p>' +
      '</footer>' +
    '</div>';
  }

  /**
   * @private
   */
  function _featureCard(title, desc) {
    return '<div class="ph-landing__feature">' +
      '<h3 class="ph-landing__feature-title">' + title + '</h3>' +
      '<p class="ph-landing__feature-desc">' + desc + '</p>' +
    '</div>';
  }

  /**
   * @private
   */
  function _statBlock(value, label) {
    return '<div class="ph-landing__stat">' +
      '<span class="ph-landing__stat-value">' + value + '</span>' +
      '<span class="ph-landing__stat-label">' + label + '</span>' +
    '</div>';
  }

  /**
   * Inject the PH landing page into a container if user is a PH visitor.
   * @param {string} containerId
   * @returns {boolean} true if injected
   */
  function injectIfPHVisitor(containerId) {
    if (!isPHVisitor()) return false;
    var el = document.getElementById(containerId);
    if (!el) return false;
    el.innerHTML = renderLandingPage();
    return true;
  }

  /**
   * Get the special offer details.
   * @returns {object}
   */
  function getSpecialOffer() {
    return {
      code: SPECIAL_OFFER_CODE,
      discount: OFFER_DISCOUNT,
      description: OFFER_DISCOUNT + '% off first 3 months of Pro',
      url: '/pricing?code=' + SPECIAL_OFFER_CODE
    };
  }

  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.PHLanding = {
    isPHVisitor: isPHVisitor,
    renderBadge: renderBadge,
    renderLandingPage: renderLandingPage,
    injectIfPHVisitor: injectIfPHVisitor,
    getSpecialOffer: getSpecialOffer
  };
})();
