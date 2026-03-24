/**
 * CF-248: Product Hunt Landing Page Variant
 * Special landing page builder for PH traffic with badge and PH-specific CTAs.
 */
(function () {
  'use strict';

  var PH_UTM_PARAMS = ['utm_source=producthunt', 'ref=producthunt'];

  var BADGE_CONFIG = {
    text: 'Featured on Product Hunt',
    imageAlt: 'Cortex Freelancer - Featured on Product Hunt',
    sizes: {
      small: { width: 200, height: 43 },
      large: { width: 250, height: 54 }
    }
  };

  var LANDING_SECTIONS = [
    {
      id: 'hero',
      type: 'hero',
      headline: 'The AI Toolkit Freelancers Are Talking About',
      subheadline: 'Join thousands of Upwork freelancers using Cortex to write better proposals, optimize their profiles, and earn more.',
      ctaText: 'Get Started Free — No Credit Card',
      ctaSecondary: 'See How It Works',
      showBadge: true
    },
    {
      id: 'social-proof',
      type: 'metrics',
      items: [
        { value: '10,000+', label: 'Freelancers using Cortex' },
        { value: '47%', label: 'Average proposal win rate increase' },
        { value: '2.3x', label: 'Faster proposal writing' },
        { value: '4.8/5', label: 'Average user rating' }
      ]
    },
    {
      id: 'features',
      type: 'feature-grid',
      headline: 'Everything you need to win on Upwork',
      features: [
        { icon: 'target', title: 'Profile Scoring', description: 'Get an instant score with actionable tips to improve your visibility.' },
        { icon: 'edit', title: 'AI Proposal Writer', description: 'Generate tailored proposals that match job requirements perfectly.' },
        { icon: 'chart', title: 'Earnings Analytics', description: 'Track your real hourly rate, revenue trends, and growth over time.' },
        { icon: 'search', title: 'Smart Job Matching', description: 'Find jobs that fit your skills and pay what you deserve.' },
        { icon: 'shield', title: 'Red Flag Detector', description: 'Spot problem clients before you waste connects on them.' },
        { icon: 'zap', title: 'Bio Rewriter', description: 'Transform your overview into a client-magnet with one click.' }
      ]
    },
    {
      id: 'ph-exclusive',
      type: 'offer',
      headline: 'Product Hunt Exclusive',
      description: 'As a thank you to the PH community, get 30% off your first 3 months of Pro.',
      ctaText: 'Claim Your PH Discount',
      couponCode: 'PRODUCTHUNT30',
      expiresInDays: 7
    },
    {
      id: 'testimonials',
      type: 'testimonials',
      items: [
        { quote: 'Cortex helped me double my Upwork earnings in 3 months.', author: 'Sarah K.', role: 'UX Designer', rating: 5 },
        { quote: 'The proposal generator alone saved me 10 hours a week.', author: 'Marcus T.', role: 'Full-Stack Developer', rating: 5 },
        { quote: 'Finally, a tool that actually understands how Upwork works.', author: 'Priya M.', role: 'Content Writer', rating: 5 }
      ]
    },
    {
      id: 'cta-bottom',
      type: 'cta',
      headline: 'Ready to level up your freelance career?',
      ctaText: 'Start Free Today',
      showBadge: true
    }
  ];

  /**
   * Detect if the current visitor came from Product Hunt.
   * @param {string} [url] - URL to check (defaults to window.location.href)
   * @returns {boolean}
   */
  function isPHVisitor(url) {
    var href = url || (typeof window !== 'undefined' && window.location ? window.location.href : '');
    var lower = href.toLowerCase();
    return PH_UTM_PARAMS.some(function (param) {
      return lower.indexOf(param) !== -1;
    });
  }

  /**
   * Get the landing page configuration.
   * @param {object} [options]
   * @param {boolean} [options.showExclusive] - Force show PH exclusive offer
   * @returns {object} Landing page data
   */
  function getPageConfig(options) {
    var opts = options || {};
    var sections = LANDING_SECTIONS.map(function (section) {
      return JSON.parse(JSON.stringify(section));
    });

    if (!opts.showExclusive && !isPHVisitor()) {
      sections = sections.filter(function (s) { return s.id !== 'ph-exclusive'; });
    }

    return {
      sections: sections,
      badge: BADGE_CONFIG,
      isPHTraffic: isPHVisitor(),
      theme: 'product-hunt'
    };
  }

  /**
   * Get the PH badge configuration.
   * @param {"small"|"large"} [size]
   * @returns {object}
   */
  function getBadge(size) {
    var s = size === 'large' ? 'large' : 'small';
    return {
      text: BADGE_CONFIG.text,
      alt: BADGE_CONFIG.imageAlt,
      width: BADGE_CONFIG.sizes[s].width,
      height: BADGE_CONFIG.sizes[s].height
    };
  }

  /**
   * Get PH-specific CTA configuration.
   * @param {string} [context] - Where the CTA is displayed
   * @returns {object}
   */
  function getCTA(context) {
    var ctx = context || 'default';
    var ctas = {
      hero: { text: 'Get Started Free — No Credit Card', style: 'primary', size: 'large' },
      sidebar: { text: 'Try It Free', style: 'primary', size: 'small' },
      offer: { text: 'Claim Your PH Discount', style: 'accent', size: 'large', coupon: 'PRODUCTHUNT30' },
      bottom: { text: 'Start Free Today', style: 'primary', size: 'large' },
      default: { text: 'Get Started Free', style: 'primary', size: 'medium' }
    };
    return ctas[ctx] || ctas['default'];
  }

  // Export to namespace
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.PHLandingPage = {
    isPHVisitor: isPHVisitor,
    getPageConfig: getPageConfig,
    getBadge: getBadge,
    getCTA: getCTA
  };
})();
