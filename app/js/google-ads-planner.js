/**
 * CF-254: Google Ads campaign targeting freelancer keywords
 * Keyword list, campaign structure, ad copy templates, budget calculator, ROI projector.
 */
(function () {
  'use strict';

  var KEYWORDS = [
    { keyword: 'upwork proposal generator', monthlySearches: 2400, cpc: 3.20, competition: 'medium' },
    { keyword: 'freelance rate calculator', monthlySearches: 1900, cpc: 2.80, competition: 'medium' },
    { keyword: 'upwork tool', monthlySearches: 3100, cpc: 4.50, competition: 'high' },
    { keyword: 'upwork assistant', monthlySearches: 1200, cpc: 3.60, competition: 'medium' },
    { keyword: 'freelance proposal template', monthlySearches: 5400, cpc: 1.90, competition: 'high' },
    { keyword: 'upwork profile optimizer', monthlySearches: 880, cpc: 3.10, competition: 'low' },
    { keyword: 'freelance invoice generator', monthlySearches: 2200, cpc: 2.40, competition: 'medium' },
    { keyword: 'upwork bid helper', monthlySearches: 720, cpc: 2.70, competition: 'low' },
    { keyword: 'ai freelance tools', monthlySearches: 1600, cpc: 4.00, competition: 'medium' },
    { keyword: 'upwork cover letter generator', monthlySearches: 3800, cpc: 2.50, competition: 'high' }
  ];

  var CAMPAIGNS = [
    {
      id: 'search-proposals',
      name: 'Search — Proposal Tools',
      type: 'search',
      keywords: ['upwork proposal generator', 'freelance proposal template', 'upwork cover letter generator', 'upwork bid helper'],
      dailyBudget: 50,
      targetLocations: ['US', 'UK', 'CA', 'AU']
    },
    {
      id: 'search-tools',
      name: 'Search — Freelance Tools',
      type: 'search',
      keywords: ['upwork tool', 'upwork assistant', 'ai freelance tools', 'upwork profile optimizer'],
      dailyBudget: 40,
      targetLocations: ['US', 'UK', 'CA', 'AU']
    },
    {
      id: 'search-calculators',
      name: 'Search — Calculators',
      type: 'search',
      keywords: ['freelance rate calculator', 'freelance invoice generator'],
      dailyBudget: 30,
      targetLocations: ['US', 'UK', 'CA', 'AU']
    }
  ];

  var AD_TEMPLATES = [
    {
      id: 'proposal-gen',
      campaign: 'search-proposals',
      headlines: [
        'AI Upwork Proposal Generator',
        'Win More Freelance Jobs',
        'Write Proposals in 30 Seconds'
      ],
      descriptions: [
        'Generate winning Upwork proposals with AI. Personalized, professional, proven to convert. Try free today.',
        'Stop spending hours on proposals. Cortex writes tailored cover letters that land interviews. Free trial.'
      ],
      finalUrl: 'https://cortexfreelancer.com/features/proposals',
      callToAction: 'Try Free'
    },
    {
      id: 'rate-calc',
      campaign: 'search-calculators',
      headlines: [
        'Freelance Rate Calculator',
        'Know Your True Hourly Rate',
        'Stop Under-Charging Clients'
      ],
      descriptions: [
        'Calculate your ideal freelance rate based on experience, market data, and expenses. Free tool by Cortex.',
        'Data-driven rate recommendations so you never leave money on the table. Used by 10,000+ freelancers.'
      ],
      finalUrl: 'https://cortexfreelancer.com/tools/rate-calculator',
      callToAction: 'Calculate Now'
    },
    {
      id: 'all-in-one',
      campaign: 'search-tools',
      headlines: [
        'AI-Powered Upwork Assistant',
        'All-In-One Freelance Toolkit',
        'Boost Your Freelance Income'
      ],
      descriptions: [
        'Proposals, invoices, rate calculator, client CRM — one tool for everything. AI-powered. Try Cortex free.',
        'The smart assistant built for Upwork freelancers. Save hours and win more jobs with AI automation.'
      ],
      finalUrl: 'https://cortexfreelancer.com',
      callToAction: 'Get Started Free'
    }
  ];

  function GoogleAdsPlanner() {}

  /* ---------- keyword list ---------- */

  GoogleAdsPlanner.prototype.getKeywords = function () {
    return KEYWORDS.slice();
  };

  GoogleAdsPlanner.prototype.getKeywordsByCompetition = function (level) {
    return KEYWORDS.filter(function (k) { return k.competition === level; });
  };

  /* ---------- campaign structure ---------- */

  GoogleAdsPlanner.prototype.getCampaigns = function () {
    return CAMPAIGNS.slice();
  };

  GoogleAdsPlanner.prototype.getCampaignById = function (id) {
    return CAMPAIGNS.find(function (c) { return c.id === id; }) || null;
  };

  /* ---------- ad copy templates ---------- */

  GoogleAdsPlanner.prototype.getAdTemplates = function (campaignId) {
    if (campaignId) {
      return AD_TEMPLATES.filter(function (t) { return t.campaign === campaignId; });
    }
    return AD_TEMPLATES.slice();
  };

  /* ---------- budget calculator ---------- */

  GoogleAdsPlanner.prototype.calculateBudget = function (opts) {
    var days = (opts && opts.days) || 30;
    var campaigns = (opts && opts.campaignIds)
      ? CAMPAIGNS.filter(function (c) { return opts.campaignIds.indexOf(c.id) !== -1; })
      : CAMPAIGNS;

    var dailyTotal = campaigns.reduce(function (sum, c) { return sum + c.dailyBudget; }, 0);
    var monthlyTotal = dailyTotal * days;

    var keywordPool = [];
    campaigns.forEach(function (c) {
      c.keywords.forEach(function (kw) {
        var match = KEYWORDS.find(function (k) { return k.keyword === kw; });
        if (match) keywordPool.push(match);
      });
    });

    var avgCpc = keywordPool.length > 0
      ? keywordPool.reduce(function (sum, k) { return sum + k.cpc; }, 0) / keywordPool.length
      : 0;

    var estimatedClicks = avgCpc > 0 ? Math.round(monthlyTotal / avgCpc) : 0;

    return {
      dailyBudget: dailyTotal,
      periodDays: days,
      totalBudget: monthlyTotal,
      averageCpc: Math.round(avgCpc * 100) / 100,
      estimatedClicks: estimatedClicks,
      campaigns: campaigns.map(function (c) { return { id: c.id, name: c.name, daily: c.dailyBudget }; })
    };
  };

  /* ---------- ROI projector ---------- */

  GoogleAdsPlanner.prototype.projectROI = function (opts) {
    var budget = this.calculateBudget(opts);
    var conversionRate = (opts && opts.conversionRate) || 0.03;
    var avgRevenuePerCustomer = (opts && opts.avgRevenue) || 29;
    var customerLifetimeMonths = (opts && opts.lifetimeMonths) || 8;

    var conversions = Math.round(budget.estimatedClicks * conversionRate);
    var revenueFirstMonth = conversions * avgRevenuePerCustomer;
    var lifetimeRevenue = conversions * avgRevenuePerCustomer * customerLifetimeMonths;
    var roiPercent = budget.totalBudget > 0
      ? Math.round(((lifetimeRevenue - budget.totalBudget) / budget.totalBudget) * 100)
      : 0;

    return {
      spend: budget.totalBudget,
      clicks: budget.estimatedClicks,
      conversionRate: conversionRate,
      conversions: conversions,
      costPerAcquisition: conversions > 0 ? Math.round(budget.totalBudget / conversions * 100) / 100 : 0,
      revenueFirstMonth: revenueFirstMonth,
      lifetimeRevenue: lifetimeRevenue,
      roiPercent: roiPercent,
      breakEvenMonth: revenueFirstMonth > 0 ? Math.ceil(budget.totalBudget / revenueFirstMonth) : null
    };
  };

  // Export to namespace
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.GoogleAdsPlanner = GoogleAdsPlanner;
})();
