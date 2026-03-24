/**
 * CF-254: Google Ads campaign config targeting freelancer keywords
 * Campaign configuration, ad copy variants, budget allocation.
 */
(function () {
  'use strict';

  var CAMPAIGN_ID = 'cortex-freelancer-search-2026';

  var KEYWORD_GROUPS = {
    proposalTools: {
      label: 'Proposal Generation',
      keywords: [
        'upwork proposal generator',
        'upwork proposal writer',
        'freelance proposal template',
        'AI proposal generator freelance',
        'upwork cover letter tool'
      ],
      maxCpc: 2.50,
      budgetPct: 0.30
    },
    rateCalculator: {
      label: 'Rate Calculator',
      keywords: [
        'freelance rate calculator',
        'hourly rate calculator freelancer',
        'freelance pricing tool',
        'how much to charge freelancing',
        'freelancer income calculator'
      ],
      maxCpc: 1.80,
      budgetPct: 0.20
    },
    upworkTools: {
      label: 'Upwork Tools',
      keywords: [
        'upwork tool',
        'upwork helper tool',
        'upwork automation tool',
        'best tools for upwork freelancers',
        'upwork profile optimizer'
      ],
      maxCpc: 2.20,
      budgetPct: 0.25
    },
    generalFreelance: {
      label: 'General Freelance',
      keywords: [
        'freelance management tool',
        'freelancer productivity app',
        'freelance business software',
        'best freelance tools 2026'
      ],
      maxCpc: 1.50,
      budgetPct: 0.15
    },
    competitors: {
      label: 'Competitor Terms',
      keywords: [
        'freelancer map alternative',
        'better than upwork tools',
        'cortex freelancer review'
      ],
      maxCpc: 3.00,
      budgetPct: 0.10
    }
  };

  var AD_COPY_VARIANTS = [
    {
      id: 'v1-proposal',
      headline1: 'Win More Upwork Jobs',
      headline2: 'AI Proposal Generator',
      headline3: 'Free Trial — No Card Needed',
      description1: 'Generate winning proposals in seconds with AI. Tailored to each job post. Trusted by 10,000+ freelancers.',
      description2: 'Stop writing proposals from scratch. Let Cortex craft personalized, high-converting proposals for every Upwork job.',
      finalUrl: '/landing/proposal-generator',
      path1: 'proposals',
      path2: 'ai-writer'
    },
    {
      id: 'v2-rate',
      headline1: 'Know Your Worth',
      headline2: 'Freelance Rate Calculator',
      headline3: 'Data-Driven Pricing',
      description1: 'Calculate your ideal freelance rate based on skills, experience, and market data. Stop undercharging.',
      description2: 'Our rate calculator analyzes thousands of freelance contracts to help you price competitively and profitably.',
      finalUrl: '/landing/rate-calculator',
      path1: 'rates',
      path2: 'calculator'
    },
    {
      id: 'v3-allinone',
      headline1: 'Cortex for Freelancers',
      headline2: 'All-in-One Freelance Tool',
      headline3: 'Proposals, Rates & More',
      description1: 'Everything freelancers need in one platform: AI proposals, rate calculator, bio rewriter, and client management.',
      description2: 'Join thousands of freelancers earning more with Cortex. Smart tools that help you win clients and grow your business.',
      finalUrl: '/landing/all-in-one',
      path1: 'freelance',
      path2: 'tools'
    }
  ];

  var BUDGET_CONFIG = {
    dailyBudget: 50.00,
    currency: 'USD',
    biddingStrategy: 'TARGET_CPA',
    targetCpa: 12.00,
    networks: ['SEARCH'],
    locations: ['US', 'UK', 'CA', 'AU'],
    languages: ['en'],
    schedule: {
      days: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
      startHour: 8,
      endHour: 22,
      timezone: 'America/New_York'
    }
  };

  var NEGATIVE_KEYWORDS = [
    'free upwork',
    'upwork scam',
    'upwork down',
    'upwork login',
    'upwork sign up',
    'fiverr',
    'full time job',
    'employment'
  ];

  /**
   * Get the full campaign configuration.
   * @returns {object}
   */
  function getCampaignConfig() {
    return {
      campaignId: CAMPAIGN_ID,
      keywordGroups: KEYWORD_GROUPS,
      adCopyVariants: AD_COPY_VARIANTS,
      budget: BUDGET_CONFIG,
      negativeKeywords: NEGATIVE_KEYWORDS
    };
  }

  /**
   * Get all keywords flattened with their group metadata.
   * @returns {Array<{ keyword: string, group: string, maxCpc: number }>}
   */
  function getAllKeywords() {
    var result = [];
    var groups = Object.keys(KEYWORD_GROUPS);
    for (var i = 0; i < groups.length; i++) {
      var group = KEYWORD_GROUPS[groups[i]];
      for (var j = 0; j < group.keywords.length; j++) {
        result.push({
          keyword: group.keywords[j],
          group: group.label,
          maxCpc: group.maxCpc
        });
      }
    }
    return result;
  }

  /**
   * Get budget allocation breakdown.
   * @returns {Array<{ group: string, dailyAmount: number, monthlyEstimate: number, pct: number }>}
   */
  function getBudgetBreakdown() {
    var daily = BUDGET_CONFIG.dailyBudget;
    var groups = Object.keys(KEYWORD_GROUPS);
    return groups.map(function (key) {
      var group = KEYWORD_GROUPS[key];
      var amount = Math.round(daily * group.budgetPct * 100) / 100;
      return {
        group: group.label,
        dailyAmount: amount,
        monthlyEstimate: Math.round(amount * 30.4 * 100) / 100,
        pct: group.budgetPct
      };
    });
  }

  /**
   * Get ad copy variant by id.
   * @param {string} variantId
   * @returns {object|null}
   */
  function getAdVariant(variantId) {
    for (var i = 0; i < AD_COPY_VARIANTS.length; i++) {
      if (AD_COPY_VARIANTS[i].id === variantId) return AD_COPY_VARIANTS[i];
    }
    return null;
  }

  // Export to namespace
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.GoogleAdsConfig = {
    getCampaignConfig: getCampaignConfig,
    getAllKeywords: getAllKeywords,
    getBudgetBreakdown: getBudgetBreakdown,
    getAdVariant: getAdVariant
  };
})();
