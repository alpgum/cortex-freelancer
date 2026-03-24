/**
 * CF-256: Comparison pages — Cortex vs competitors
 * Comparison page data generators, feature matrix, pricing comparison.
 */
(function () {
  'use strict';

  var COMPETITORS = {
    freelancerMap: {
      id: 'freelancer-map',
      name: 'Freelancer Map',
      slug: 'cortex-vs-freelancer-map',
      tagline: 'See why freelancers are switching from Freelancer Map to Cortex.'
    },
    upworkBuiltIn: {
      id: 'upwork-built-in',
      name: 'Upwork Built-in Tools',
      slug: 'cortex-vs-upwork-built-in-tools',
      tagline: 'Go beyond Upwork\'s basic tools with Cortex\'s AI-powered suite.'
    }
  };

  var FEATURES = [
    { key: 'ai_proposals', label: 'AI Proposal Generator', category: 'Proposals' },
    { key: 'bio_rewriter', label: 'AI Bio/Profile Rewriter', category: 'Profile' },
    { key: 'rate_calculator', label: 'Smart Rate Calculator', category: 'Pricing' },
    { key: 'client_crm', label: 'Client CRM', category: 'Management' },
    { key: 'invoice_gen', label: 'Invoice Generation', category: 'Billing' },
    { key: 'analytics', label: 'Earnings Analytics', category: 'Analytics' },
    { key: 'time_tracking', label: 'Time Tracking', category: 'Management' },
    { key: 'contract_templates', label: 'Contract Templates', category: 'Legal' },
    { key: 'multi_platform', label: 'Multi-Platform Support', category: 'Integration' },
    { key: 'community', label: 'Community Features', category: 'Social' }
  ];

  var FEATURE_MATRIX = {
    cortex: {
      ai_proposals: true,
      bio_rewriter: true,
      rate_calculator: true,
      client_crm: true,
      invoice_gen: true,
      analytics: true,
      time_tracking: true,
      contract_templates: true,
      multi_platform: true,
      community: true
    },
    freelancerMap: {
      ai_proposals: false,
      bio_rewriter: false,
      rate_calculator: true,
      client_crm: true,
      invoice_gen: true,
      analytics: true,
      time_tracking: false,
      contract_templates: false,
      multi_platform: true,
      community: false
    },
    upworkBuiltIn: {
      ai_proposals: false,
      bio_rewriter: false,
      rate_calculator: false,
      client_crm: false,
      invoice_gen: true,
      analytics: true,
      time_tracking: true,
      contract_templates: true,
      multi_platform: false,
      community: false
    }
  };

  var PRICING = {
    cortex: {
      free: { price: 0, label: 'Free', features: ['5 AI proposals/mo', 'Basic rate calculator', 'Community access'] },
      pro: { price: 19, label: 'Pro', features: ['Unlimited AI proposals', 'Full analytics', 'Client CRM', 'Priority support'] },
      business: { price: 49, label: 'Business', features: ['Everything in Pro', 'Team collaboration', 'Custom branding', 'API access'] }
    },
    freelancerMap: {
      free: { price: 0, label: 'Free', features: ['Basic profile listing', 'Limited search'] },
      premium: { price: 29, label: 'Premium', features: ['Enhanced profile', 'Analytics', 'CRM basics'] }
    },
    upworkBuiltIn: {
      free: { price: 0, label: 'Included', features: ['Basic time tracking', 'Invoicing', 'Messaging'] },
      plus: { price: 14.99, label: 'Freelancer Plus', features: ['More connects', 'Profile insights', 'Invisible mode'] }
    }
  };

  /**
   * Get comparison page data for a specific competitor.
   * @param {string} competitorId - 'freelancerMap' or 'upworkBuiltIn'
   * @returns {object|null}
   */
  function getComparisonPage(competitorId) {
    var competitor = COMPETITORS[competitorId];
    if (!competitor) return null;

    var matrix = buildFeatureMatrix(competitorId);
    var pricing = buildPricingComparison(competitorId);

    return {
      slug: competitor.slug,
      title: competitor.name + ' vs Cortex Freelancer',
      tagline: competitor.tagline,
      featureMatrix: matrix,
      pricing: pricing,
      meta: {
        title: 'Cortex vs ' + competitor.name + ' — Feature Comparison',
        description: 'Compare Cortex Freelancer with ' + competitor.name + '. See features, pricing, and why freelancers choose Cortex.',
        canonical: '/compare/' + competitor.slug
      },
      cta: {
        text: 'Try Cortex Free',
        url: '/signup?ref=compare-' + competitor.id
      }
    };
  }

  /**
   * Build a feature matrix comparing Cortex with a competitor.
   * @param {string} competitorId
   * @returns {Array<{ feature: string, category: string, cortex: boolean, competitor: boolean }>}
   */
  function buildFeatureMatrix(competitorId) {
    var compFeatures = FEATURE_MATRIX[competitorId] || {};
    var cortexFeatures = FEATURE_MATRIX.cortex;

    return FEATURES.map(function (f) {
      return {
        feature: f.label,
        category: f.category,
        cortex: !!cortexFeatures[f.key],
        competitor: !!compFeatures[f.key]
      };
    });
  }

  /**
   * Build pricing comparison data.
   * @param {string} competitorId
   * @returns {{ cortex: object, competitor: object, savingsNote: string }}
   */
  function buildPricingComparison(competitorId) {
    var cortexPricing = PRICING.cortex;
    var compPricing = PRICING[competitorId] || {};
    var competitor = COMPETITORS[competitorId];

    return {
      cortex: cortexPricing,
      competitor: { name: competitor ? competitor.name : competitorId, plans: compPricing },
      savingsNote: 'Cortex Pro includes more features at a competitive price.'
    };
  }

  /**
   * Get all available comparison page slugs for sitemap/routing.
   * @returns {Array<{ slug: string, title: string }>}
   */
  function getAllComparisons() {
    return Object.keys(COMPETITORS).map(function (key) {
      return {
        slug: COMPETITORS[key].slug,
        title: 'Cortex vs ' + COMPETITORS[key].name
      };
    });
  }

  /**
   * Get Cortex advantage summary against a competitor.
   * @param {string} competitorId
   * @returns {{ advantages: string[], totalFeatures: number, cortexCount: number, competitorCount: number }}
   */
  function getAdvantages(competitorId) {
    var matrix = buildFeatureMatrix(competitorId);
    var advantages = [];
    var cortexCount = 0;
    var competitorCount = 0;

    matrix.forEach(function (row) {
      if (row.cortex) cortexCount++;
      if (row.competitor) competitorCount++;
      if (row.cortex && !row.competitor) {
        advantages.push(row.feature);
      }
    });

    return {
      advantages: advantages,
      totalFeatures: matrix.length,
      cortexCount: cortexCount,
      competitorCount: competitorCount
    };
  }

  // Export to namespace
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.ComparisonPages = {
    getComparisonPage: getComparisonPage,
    buildFeatureMatrix: buildFeatureMatrix,
    buildPricingComparison: buildPricingComparison,
    getAllComparisons: getAllComparisons,
    getAdvantages: getAdvantages
  };
})();
