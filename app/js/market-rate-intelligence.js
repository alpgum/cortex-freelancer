/**
 * CF3-004: Market Rate Intelligence Module
 * Regional analysis, competitor benchmarking, cost-of-living adjustments,
 * demand-based pricing recommendations, and Turkish market deep-dive.
 *
 * Exposed on window.CortexFreelancer.MarketRateIntelligence
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  // ── Regional Market Data (Q1 2026) ──────────────────────────────────

  var REGIONAL_MARKETS = {
    turkey: {
      label: 'Turkey',
      currency: 'TRY',
      usdRate: 36.5,
      cities: {
        istanbul: { label: 'Istanbul', multiplier: 1.15, talent: 'dense', techHub: true },
        ankara:   { label: 'Ankara',   multiplier: 1.0,  talent: 'moderate', techHub: true },
        izmir:    { label: 'Izmir',    multiplier: 0.92, talent: 'moderate', techHub: false },
        antalya:  { label: 'Antalya',  multiplier: 0.85, talent: 'low', techHub: false },
        bursa:    { label: 'Bursa',    multiplier: 0.88, talent: 'low', techHub: false }
      },
      colIndex: 0.28,
      avgFreelancerRate: 28,
      topSkills: ['web-development', 'mobile-development', 'design', 'game-dev'],
      platformShare: { upwork: 0.45, freelancer: 0.15, fiverr: 0.20, direct: 0.15, toptal: 0.05 },
      marketNotes: [
        'Strong tech talent pool, especially in Istanbul and Ankara',
        'TRY depreciation makes Turkish freelancers very competitive globally',
        'Growing demand for React, Node.js, and mobile development',
        'Enterprise clients from EU/US increasingly sourcing from Turkey',
        'Game development and 3D modeling sectors growing rapidly'
      ],
      demandTrends: {
        'web-development':    { trend: 'rising',  change: 12, note: 'EU clients driving demand' },
        'mobile-development': { trend: 'rising',  change: 15, note: 'Flutter and React Native hot' },
        'design':             { trend: 'stable',  change: 4,  note: 'Competitive market' },
        'data-science':       { trend: 'surging', change: 22, note: 'AI boom creating demand' },
        'devops':             { trend: 'rising',  change: 14, note: 'Cloud migration projects' },
        'game-dev':           { trend: 'surging', change: 25, note: 'Turkish gaming industry booming' },
        'cybersecurity':      { trend: 'rising',  change: 18, note: 'Compliance requirements growing' },
        'blockchain':         { trend: 'stable',  change: 5,  note: 'Niche but well-paid' }
      },
      competitorLandscape: {
        totalFreelancers: 85000,
        avgProfileScore: 72,
        topEarnerThreshold: 55,
        saturationLevel: 'moderate',
        avgProposalsPerJob: 28,
        winRateAvg: 0.08
      }
    },
    egypt: {
      label: 'Egypt',
      currency: 'EGP',
      usdRate: 50.5,
      cities: {
        cairo:      { label: 'Cairo',      multiplier: 1.12, talent: 'dense', techHub: true },
        alexandria: { label: 'Alexandria', multiplier: 0.95, talent: 'moderate', techHub: false },
        giza:       { label: 'Giza',       multiplier: 1.05, talent: 'moderate', techHub: false }
      },
      colIndex: 0.22,
      avgFreelancerRate: 20,
      topSkills: ['web-development', 'mobile-development', 'writing', 'design'],
      platformShare: { upwork: 0.50, freelancer: 0.20, fiverr: 0.15, direct: 0.10, toptal: 0.05 },
      marketNotes: [
        'Large English-speaking talent pool',
        'EGP devaluation creating pricing advantage',
        'Strong in content writing and translation',
        'Growing mobile development community'
      ],
      demandTrends: {
        'web-development':    { trend: 'rising',  change: 10, note: 'MENA market expanding' },
        'mobile-development': { trend: 'rising',  change: 12, note: 'Startup ecosystem growing' },
        'writing':            { trend: 'stable',  change: 2,  note: 'AI impact on content market' },
        'design':             { trend: 'rising',  change: 8,  note: 'UX demand increasing' }
      },
      competitorLandscape: {
        totalFreelancers: 65000,
        avgProfileScore: 68,
        topEarnerThreshold: 40,
        saturationLevel: 'high',
        avgProposalsPerJob: 35,
        winRateAvg: 0.06
      }
    },
    pakistan: {
      label: 'Pakistan',
      currency: 'PKR',
      usdRate: 280,
      cities: {
        lahore:    { label: 'Lahore',    multiplier: 1.10, talent: 'dense', techHub: true },
        karachi:   { label: 'Karachi',   multiplier: 1.08, talent: 'dense', techHub: true },
        islamabad: { label: 'Islamabad', multiplier: 1.15, talent: 'moderate', techHub: true }
      },
      colIndex: 0.18,
      avgFreelancerRate: 16,
      topSkills: ['web-development', 'mobile-development', 'writing', 'seo'],
      platformShare: { upwork: 0.55, freelancer: 0.20, fiverr: 0.15, direct: 0.05, toptal: 0.05 },
      marketNotes: [
        'One of the fastest-growing freelance markets globally',
        'Strong WordPress and PHP community',
        'Competitive pricing attracts volume clients',
        'Government IT initiatives driving skill development'
      ],
      demandTrends: {
        'web-development':    { trend: 'rising', change: 8,  note: 'WordPress and Laravel dominant' },
        'mobile-development': { trend: 'rising', change: 11, note: 'React Native growing fast' },
        'seo':                { trend: 'stable', change: 3,  note: 'Steady demand' },
        'data-science':       { trend: 'rising', change: 15, note: 'New talent entering market' }
      },
      competitorLandscape: {
        totalFreelancers: 120000,
        avgProfileScore: 65,
        topEarnerThreshold: 35,
        saturationLevel: 'very-high',
        avgProposalsPerJob: 45,
        winRateAvg: 0.05
      }
    },
    india: {
      label: 'India',
      currency: 'INR',
      usdRate: 84,
      cities: {
        bangalore: { label: 'Bangalore', multiplier: 1.20, talent: 'dense', techHub: true },
        mumbai:    { label: 'Mumbai',    multiplier: 1.15, talent: 'dense', techHub: true },
        delhi:     { label: 'Delhi/NCR', multiplier: 1.10, talent: 'dense', techHub: true },
        hyderabad: { label: 'Hyderabad', multiplier: 1.08, talent: 'dense', techHub: true },
        pune:      { label: 'Pune',      multiplier: 1.05, talent: 'moderate', techHub: true }
      },
      colIndex: 0.24,
      avgFreelancerRate: 22,
      topSkills: ['web-development', 'mobile-development', 'data-science', 'devops'],
      platformShare: { upwork: 0.40, freelancer: 0.15, fiverr: 0.10, direct: 0.25, toptal: 0.10 },
      marketNotes: [
        'Largest freelance talent pool globally',
        'Deep expertise in enterprise technologies',
        'Strong IT services background creates experienced freelancers',
        'Bangalore and Hyderabad command premium rates'
      ],
      demandTrends: {
        'web-development':    { trend: 'stable', change: 5,  note: 'Mature market' },
        'data-science':       { trend: 'surging', change: 20, note: 'AI talent in high demand' },
        'devops':             { trend: 'rising', change: 14, note: 'Cloud-native projects' },
        'mobile-development': { trend: 'rising', change: 10, note: 'Cross-platform demand' }
      },
      competitorLandscape: {
        totalFreelancers: 500000,
        avgProfileScore: 70,
        topEarnerThreshold: 45,
        saturationLevel: 'very-high',
        avgProposalsPerJob: 50,
        winRateAvg: 0.04
      }
    },
    nigeria: {
      label: 'Nigeria',
      currency: 'NGN',
      usdRate: 1550,
      cities: {
        lagos: { label: 'Lagos', multiplier: 1.15, talent: 'dense', techHub: true },
        abuja: { label: 'Abuja', multiplier: 1.0,  talent: 'moderate', techHub: false }
      },
      colIndex: 0.25,
      avgFreelancerRate: 19,
      topSkills: ['web-development', 'writing', 'design', 'marketing'],
      platformShare: { upwork: 0.45, freelancer: 0.15, fiverr: 0.25, direct: 0.10, toptal: 0.05 },
      marketNotes: [
        'Rapidly growing tech ecosystem ("Silicon Lagoon")',
        'Strong English-language content creation',
        'Fintech sector driving developer demand',
        'Youth-driven talent pool with growing skills'
      ],
      demandTrends: {
        'web-development':    { trend: 'rising', change: 14, note: 'Fintech and startup boom' },
        'mobile-development': { trend: 'rising', change: 12, note: 'Mobile-first market' },
        'writing':            { trend: 'stable', change: 3,  note: 'Steady content demand' },
        'blockchain':         { trend: 'rising', change: 16, note: 'Crypto adoption high' }
      },
      competitorLandscape: {
        totalFreelancers: 45000,
        avgProfileScore: 66,
        topEarnerThreshold: 38,
        saturationLevel: 'moderate',
        avgProposalsPerJob: 30,
        winRateAvg: 0.07
      }
    }
  };

  // Fallback for countries not in deep-dive
  var GENERIC_MARKETS = {
    philippines: { label: 'Philippines', colIndex: 0.26, avgRate: 18, saturation: 'high' },
    bangladesh:  { label: 'Bangladesh',  colIndex: 0.19, avgRate: 13, saturation: 'high' },
    brazil:      { label: 'Brazil',      colIndex: 0.35, avgRate: 32, saturation: 'moderate' },
    vietnam:     { label: 'Vietnam',     colIndex: 0.26, avgRate: 20, saturation: 'moderate' },
    indonesia:   { label: 'Indonesia',   colIndex: 0.25, avgRate: 18, saturation: 'moderate' },
    mexico:      { label: 'Mexico',      colIndex: 0.32, avgRate: 30, saturation: 'moderate' },
    ukraine:     { label: 'Ukraine',     colIndex: 0.27, avgRate: 32, saturation: 'moderate' },
    kenya:       { label: 'Kenya',       colIndex: 0.27, avgRate: 17, saturation: 'low' },
    us:          { label: 'United States', colIndex: 1.0,  avgRate: 90, saturation: 'low' },
    uk:          { label: 'United Kingdom', colIndex: 0.82, avgRate: 75, saturation: 'low' },
    de:          { label: 'Germany',     colIndex: 0.72, avgRate: 68, saturation: 'low' },
    eu:          { label: 'Europe (other)', colIndex: 0.65, avgRate: 58, saturation: 'moderate' }
  };

  // ── Cost of Living Deep Dive ────────────────────────────────────────

  var COL_DETAILS = {
    turkey: {
      rent1br: { istanbul: 450, ankara: 280, izmir: 250, usd: true },
      meal:    { avg: 4.5, restaurant: 12 },
      internet: 18,
      coworking: 120,
      healthcare: 'public + private affordable',
      taxRate: 0.20,
      socialSecurity: 0.145,
      effectiveTakeHome: 0.72,
      monthlyMinimum: 800,
      comfortableThreshold: 1800,
      premiumLifestyle: 3500,
      notes: 'TRY volatility means USD-earning freelancers benefit significantly. Istanbul has higher costs but better networking. Co-working spaces are affordable and growing.'
    },
    egypt: {
      rent1br: { cairo: 250, alexandria: 150, usd: true },
      meal: { avg: 2.5, restaurant: 8 },
      internet: 12,
      coworking: 80,
      healthcare: 'public + affordable private',
      taxRate: 0.15,
      socialSecurity: 0.11,
      effectiveTakeHome: 0.78,
      monthlyMinimum: 500,
      comfortableThreshold: 1200,
      premiumLifestyle: 2500,
      notes: 'Very low cost of living makes even moderate USD rates comfortable. Cairo has a growing startup scene with networking opportunities.'
    },
    pakistan: {
      rent1br: { lahore: 180, karachi: 200, islamabad: 220, usd: true },
      meal: { avg: 2, restaurant: 6 },
      internet: 10,
      coworking: 60,
      healthcare: 'private recommended',
      taxRate: 0.15,
      socialSecurity: 0.06,
      effectiveTakeHome: 0.80,
      monthlyMinimum: 400,
      comfortableThreshold: 1000,
      premiumLifestyle: 2200,
      notes: 'Extremely affordable living. Government freelancing initiatives provide tax benefits. IT exports have special tax exemptions in some zones.'
    },
    india: {
      rent1br: { bangalore: 350, mumbai: 400, delhi: 300, usd: true },
      meal: { avg: 3, restaurant: 8 },
      internet: 8,
      coworking: 80,
      healthcare: 'private recommended',
      taxRate: 0.20,
      socialSecurity: 0.12,
      effectiveTakeHome: 0.72,
      monthlyMinimum: 600,
      comfortableThreshold: 1500,
      premiumLifestyle: 3000,
      notes: 'Tier-1 cities have higher costs but better client access. Remote work from Tier-2 cities offers better value. Strong co-working culture.'
    },
    nigeria: {
      rent1br: { lagos: 350, abuja: 250, usd: true },
      meal: { avg: 3, restaurant: 10 },
      internet: 25,
      coworking: 100,
      healthcare: 'private recommended',
      taxRate: 0.15,
      socialSecurity: 0.08,
      effectiveTakeHome: 0.80,
      monthlyMinimum: 600,
      comfortableThreshold: 1400,
      premiumLifestyle: 3000,
      notes: 'Internet costs are higher than peers. Lagos is expensive by African standards. Power/internet reliability can be a challenge — budget for backup.'
    }
  };

  // ── Competitor Analysis Engine ──────────────────────────────────────

  function analyzeCompetition(country, skill) {
    var market = REGIONAL_MARKETS[country];
    if (!market) return _genericCompetition(country, skill);

    var landscape = market.competitorLandscape;
    var demandInfo = market.demandTrends[skill] || { trend: 'stable', change: 0, note: '' };

    // Estimate skill-specific freelancer count (rough distribution)
    var skillDistribution = {
      'web-development': 0.25, 'mobile-development': 0.12, 'design': 0.10,
      'writing': 0.08, 'data-science': 0.06, 'devops': 0.06,
      'marketing': 0.07, 'seo': 0.05, 'cybersecurity': 0.03,
      'blockchain': 0.02, 'game-dev': 0.03, 'qa': 0.04
    };
    var skillShare = skillDistribution[skill] || 0.05;
    var competitorsInSkill = Math.round(landscape.totalFreelancers * skillShare);

    // Competition intensity
    var intensity;
    var proposalsPerJob = landscape.avgProposalsPerJob;
    if (demandInfo.trend === 'surging') proposalsPerJob = Math.round(proposalsPerJob * 0.7);
    else if (demandInfo.trend === 'rising') proposalsPerJob = Math.round(proposalsPerJob * 0.85);
    else if (demandInfo.trend === 'declining') proposalsPerJob = Math.round(proposalsPerJob * 1.3);

    if (proposalsPerJob > 40) intensity = 'extreme';
    else if (proposalsPerJob > 30) intensity = 'high';
    else if (proposalsPerJob > 20) intensity = 'moderate';
    else intensity = 'low';

    // Estimated win rate adjustment
    var baseWinRate = landscape.winRateAvg;
    var adjustedWinRate = baseWinRate;
    if (demandInfo.trend === 'surging') adjustedWinRate *= 1.5;
    else if (demandInfo.trend === 'rising') adjustedWinRate *= 1.25;

    // Differentiation strategies
    var strategies = [];
    if (intensity === 'extreme' || intensity === 'high') {
      strategies.push('Specialize in a niche within ' + _skillLabel(skill) + ' to reduce direct competition');
      strategies.push('Target clients in US/UK/EU who value quality over price');
      strategies.push('Build case studies and portfolio pieces that demonstrate measurable results');
    }
    if (demandInfo.trend === 'surging' || demandInfo.trend === 'rising') {
      strategies.push('Demand is ' + demandInfo.trend + ' — position for premium pricing');
      strategies.push('Upskill in trending sub-specialties to capture emerging opportunities');
    }
    if (landscape.saturationLevel === 'very-high') {
      strategies.push('Consider platforms with lower competition (Toptal, direct outreach)');
      strategies.push('Invest in profile optimization — top 10% of profiles win 60% of jobs');
    }
    strategies.push('Maintain 90%+ Job Success Score — clients filter by JSS first');

    return {
      country: country,
      countryLabel: market.label,
      skill: skill,
      skillLabel: _skillLabel(skill),
      totalFreelancers: landscape.totalFreelancers,
      competitorsInSkill: competitorsInSkill,
      avgProposalsPerJob: proposalsPerJob,
      intensity: intensity,
      saturationLevel: landscape.saturationLevel,
      avgProfileScore: landscape.avgProfileScore,
      topEarnerThreshold: landscape.topEarnerThreshold,
      winRate: Math.round(adjustedWinRate * 1000) / 10,
      demandTrend: demandInfo.trend,
      demandChange: demandInfo.change,
      demandNote: demandInfo.note,
      strategies: strategies,
      platformBreakdown: market.platformShare
    };
  }

  function _genericCompetition(country, skill) {
    var info = GENERIC_MARKETS[country] || { label: country, saturation: 'moderate' };
    var base = info.saturation === 'high' ? 35 : info.saturation === 'low' ? 15 : 25;
    return {
      country: country,
      countryLabel: info.label,
      skill: skill,
      skillLabel: _skillLabel(skill),
      totalFreelancers: null,
      competitorsInSkill: null,
      avgProposalsPerJob: base,
      intensity: base > 30 ? 'high' : base > 20 ? 'moderate' : 'low',
      saturationLevel: info.saturation,
      avgProfileScore: null,
      topEarnerThreshold: null,
      winRate: null,
      demandTrend: 'stable',
      demandChange: 0,
      demandNote: '',
      strategies: ['Focus on building a strong portfolio and client reviews', 'Target clients from higher-paying markets'],
      platformBreakdown: null
    };
  }

  // ── Regional Rate Intelligence ──────────────────────────────────────

  function getRegionalIntelligence(country, skill, experience, currentRate) {
    var market = REGIONAL_MARKETS[country];
    var col = COL_DETAILS[country];
    var competition = analyzeCompetition(country, skill);

    // Base rate from benchmarks (use global BENCHMARKS if available)
    var benchmarks = _getBenchmark(skill, country);
    var expTier = experience <= 2 ? 'junior' : experience <= 5 ? 'mid' : experience <= 8 ? 'senior' : 'expert';

    // Calculate recommended rate with regional adjustments
    var baseRate = benchmarks.median || 30;
    var cityRates = null;

    if (market && market.cities) {
      cityRates = {};
      var cities = market.cities;
      for (var city in cities) {
        if (!cities.hasOwnProperty(city)) continue;
        cityRates[city] = {
          label: cities[city].label,
          rate: Math.round(baseRate * cities[city].multiplier),
          techHub: cities[city].techHub,
          talentDensity: cities[city].talent
        };
      }
    }

    // Demand-adjusted rate
    var demandAdj = 1.0;
    if (market && market.demandTrends[skill]) {
      var dt = market.demandTrends[skill];
      if (dt.trend === 'surging') demandAdj = 1.12;
      else if (dt.trend === 'rising') demandAdj = 1.06;
      else if (dt.trend === 'declining') demandAdj = 0.92;
    }
    var demandAdjustedRate = Math.round(baseRate * demandAdj);

    // COL-adjusted purchasing power
    var purchasingPower = null;
    if (col) {
      var monthlyIncome = baseRate * 120; // ~120 billable hours/month realistic
      purchasingPower = {
        monthlyUSD: monthlyIncome,
        monthlyLocal: Math.round(monthlyIncome * (market ? market.usdRate : 1)),
        afterTax: Math.round(monthlyIncome * col.effectiveTakeHome),
        meetsComfortable: monthlyIncome * col.effectiveTakeHome >= col.comfortableThreshold,
        meetsPremium: monthlyIncome * col.effectiveTakeHome >= col.premiumLifestyle,
        comfortableRateNeeded: Math.round(col.comfortableThreshold / (col.effectiveTakeHome * 120) * 100) / 100,
        premiumRateNeeded: Math.round(col.premiumLifestyle / (col.effectiveTakeHome * 120) * 100) / 100
      };
    }

    // Rate positioning
    var positioning = null;
    if (currentRate > 0) {
      var diff = currentRate - baseRate;
      var diffPct = Math.round((diff / baseRate) * 100);
      var label;
      if (diffPct < -20) label = 'significantly-below';
      else if (diffPct < -5) label = 'below';
      else if (diffPct <= 10) label = 'at-market';
      else if (diffPct <= 25) label = 'above';
      else label = 'premium';

      positioning = {
        currentRate: currentRate,
        marketRate: baseRate,
        difference: diff,
        diffPercent: diffPct,
        label: label,
        recommendation: _getPositioningAdvice(label, currentRate, baseRate, demandAdjustedRate, competition)
      };
    }

    return {
      country: country,
      countryLabel: market ? market.label : (GENERIC_MARKETS[country] ? GENERIC_MARKETS[country].label : country),
      skill: skill,
      skillLabel: _skillLabel(skill),
      experience: experience,
      expTier: expTier,
      benchmarks: benchmarks,
      baseRate: baseRate,
      demandAdjustedRate: demandAdjustedRate,
      demandAdjustment: demandAdj,
      cityRates: cityRates,
      purchasingPower: purchasingPower,
      competition: competition,
      positioning: positioning,
      colDetails: col || null,
      marketNotes: market ? market.marketNotes : [],
      topSkills: market ? market.topSkills : []
    };
  }

  // ── Turkish Market Deep Dive ────────────────────────────────────────

  function getTurkeyDeepDive(skill, experience) {
    var market = REGIONAL_MARKETS.turkey;
    var col = COL_DETAILS.turkey;
    var competition = analyzeCompetition('turkey', skill);
    var benchmarks = _getBenchmark(skill, 'turkey');
    var baseRate = benchmarks.median || 28;

    // TRY impact analysis
    var tryImpact = {
      currentRate: market.usdRate,
      yearAgoRate: 32.5,
      depreciationPct: Math.round(((market.usdRate - 32.5) / 32.5) * 100),
      monthlyInTRY: Math.round(baseRate * 120 * market.usdRate),
      advantage: 'TRY depreciation of ~' + Math.round(((market.usdRate - 32.5) / 32.5) * 100) + '% YoY makes Turkish freelancers increasingly competitive for international clients while maintaining strong local purchasing power.'
    };

    // City comparison
    var cityComparison = [];
    for (var city in market.cities) {
      if (!market.cities.hasOwnProperty(city)) continue;
      var c = market.cities[city];
      var cityRate = Math.round(baseRate * c.multiplier);
      var rent = col.rent1br[city] || 300;
      cityComparison.push({
        city: c.label,
        rate: cityRate,
        monthlyIncome: cityRate * 120,
        rent: rent,
        netAfterRent: Math.round(cityRate * 120 * col.effectiveTakeHome - rent),
        techHub: c.techHub,
        talent: c.talent,
        recommended: c.techHub && c.multiplier >= 1.0
      });
    }
    cityComparison.sort(function (a, b) { return b.netAfterRent - a.netAfterRent; });

    // Sector opportunities
    var sectors = [
      { name: 'EU Tech Clients', growth: 'high', avgRate: Math.round(baseRate * 1.3), note: 'German and Dutch companies increasingly hire Turkish devs' },
      { name: 'Turkish Startups', growth: 'high', avgRate: Math.round(baseRate * 0.85), note: 'Lower rates but steady pipeline, good for portfolio building' },
      { name: 'US Remote Teams', growth: 'medium', avgRate: Math.round(baseRate * 1.5), note: 'Timezone overlap with US East Coast is a selling point' },
      { name: 'Gaming Industry', growth: 'very-high', avgRate: Math.round(baseRate * 1.2), note: 'Peak Games, Dream Games driving local demand' },
      { name: 'E-commerce', growth: 'high', avgRate: Math.round(baseRate * 0.95), note: 'Trendyol, Hepsiburada ecosystem creating opportunities' }
    ];

    return {
      market: market,
      col: col,
      competition: competition,
      benchmarks: benchmarks,
      baseRate: baseRate,
      tryImpact: tryImpact,
      cityComparison: cityComparison,
      sectors: sectors,
      platformStrategy: {
        recommended: 'upwork',
        breakdown: market.platformShare,
        tips: [
          'Upwork dominates — optimize your profile for Upwork search first',
          'Rising Talent badge achievable within 60 days with consistent quality',
          'Toptal acceptance is competitive but yields 2-3x higher rates',
          'Direct client outreach via LinkedIn can bypass platform fees entirely',
          'Fiverr works well for productized services (logo design, landing pages)'
        ]
      }
    };
  }

  // ── Render: Market Intelligence Panel ───────────────────────────────

  function renderIntelligencePanel(containerId, options) {
    var container = document.getElementById(containerId);
    if (!container) return;

    var opts = options || {};
    var country = opts.country || 'turkey';
    var skill = opts.skill || 'web-development';
    var experience = opts.experience || 4;
    var currentRate = opts.currentRate || 0;

    var intel = getRegionalIntelligence(country, skill, experience, currentRate);
    var comp = intel.competition;

    var h = '';

    // ── Competition Overview ──
    h += '<div class="mri-card">';
    h += '<div class="mri-card-title">Competition Analysis</div>';
    h += '<div class="mri-comp-grid">';

    var intColor = comp.intensity === 'extreme' ? '#ef4444' : comp.intensity === 'high' ? '#f59e0b' : comp.intensity === 'moderate' ? '#3b82f6' : '#22c55e';
    h += '<div class="mri-comp-item"><div class="mri-comp-label">Competition</div><div class="mri-comp-value" style="color:' + intColor + '">' + _capitalize(comp.intensity) + '</div></div>';
    h += '<div class="mri-comp-item"><div class="mri-comp-label">Avg Proposals/Job</div><div class="mri-comp-value">' + comp.avgProposalsPerJob + '</div></div>';

    if (comp.winRate) {
      h += '<div class="mri-comp-item"><div class="mri-comp-label">Est. Win Rate</div><div class="mri-comp-value">' + comp.winRate + '%</div></div>';
    }

    var trendColor = comp.demandTrend === 'surging' ? '#22c55e' : comp.demandTrend === 'rising' ? '#3b82f6' : comp.demandTrend === 'declining' ? '#ef4444' : '#94a3b8';
    var trendIcon = comp.demandTrend === 'surging' || comp.demandTrend === 'rising' ? '\u2191' : comp.demandTrend === 'declining' ? '\u2193' : '\u2192';
    h += '<div class="mri-comp-item"><div class="mri-comp-label">Demand Trend</div><div class="mri-comp-value" style="color:' + trendColor + '">' + trendIcon + ' ' + _capitalize(comp.demandTrend) + (comp.demandChange ? ' (+' + comp.demandChange + '%)' : '') + '</div></div>';

    if (comp.competitorsInSkill) {
      h += '<div class="mri-comp-item"><div class="mri-comp-label">Freelancers in ' + comp.skillLabel + '</div><div class="mri-comp-value">~' + _formatNum(comp.competitorsInSkill) + '</div></div>';
    }
    if (comp.topEarnerThreshold) {
      h += '<div class="mri-comp-item"><div class="mri-comp-label">Top Earner Rate</div><div class="mri-comp-value" style="color:var(--green)">$' + comp.topEarnerThreshold + '+/hr</div></div>';
    }
    h += '</div>';

    if (comp.demandNote) {
      h += '<div class="mri-note">' + _escHtml(comp.demandNote) + '</div>';
    }
    h += '</div>';

    // ── City-Level Rates (if available) ──
    if (intel.cityRates) {
      h += '<div class="mri-card">';
      h += '<div class="mri-card-title">Rate by City</div>';
      h += '<div class="mri-city-list">';
      for (var city in intel.cityRates) {
        if (!intel.cityRates.hasOwnProperty(city)) continue;
        var cr = intel.cityRates[city];
        h += '<div class="mri-city-row">';
        h += '<span class="mri-city-name">' + _escHtml(cr.label) + (cr.techHub ? ' <span class="mri-tech-badge">Tech Hub</span>' : '') + '</span>';
        h += '<span class="mri-city-rate">$' + cr.rate + '/hr</span>';
        h += '</div>';
      }
      h += '</div></div>';
    }

    // ── Purchasing Power ──
    if (intel.purchasingPower) {
      var pp = intel.purchasingPower;
      h += '<div class="mri-card">';
      h += '<div class="mri-card-title">Purchasing Power at $' + intel.baseRate + '/hr</div>';
      h += '<div class="mri-pp-grid">';
      h += '<div class="mri-pp-item"><div class="mri-pp-label">Monthly (120h)</div><div class="mri-pp-value">$' + _formatNum(pp.monthlyUSD) + '</div></div>';
      h += '<div class="mri-pp-item"><div class="mri-pp-label">After Tax</div><div class="mri-pp-value">$' + _formatNum(pp.afterTax) + '</div></div>';
      h += '<div class="mri-pp-item"><div class="mri-pp-label">Comfortable</div><div class="mri-pp-value" style="color:' + (pp.meetsComfortable ? 'var(--green)' : '#f59e0b') + '">' + (pp.meetsComfortable ? 'Yes' : 'Need $' + pp.comfortableRateNeeded + '/hr') + '</div></div>';
      h += '<div class="mri-pp-item"><div class="mri-pp-label">Premium</div><div class="mri-pp-value" style="color:' + (pp.meetsPremium ? 'var(--green)' : '#94a3b8') + '">' + (pp.meetsPremium ? 'Yes' : 'Need $' + pp.premiumRateNeeded + '/hr') + '</div></div>';
      h += '</div></div>';
    }

    // ── Differentiation Strategies ──
    if (comp.strategies && comp.strategies.length) {
      h += '<div class="mri-card">';
      h += '<div class="mri-card-title">How to Stand Out</div>';
      h += '<div class="mri-strategies">';
      for (var s = 0; s < comp.strategies.length && s < 5; s++) {
        h += '<div class="mri-strategy-item">' + _escHtml(comp.strategies[s]) + '</div>';
      }
      h += '</div></div>';
    }

    // ── Rate Positioning (if user has a rate) ──
    if (intel.positioning) {
      var pos = intel.positioning;
      var posColor = pos.label === 'premium' || pos.label === 'above' ? 'var(--green)' : pos.label === 'at-market' ? '#3b82f6' : '#f59e0b';
      h += '<div class="mri-card">';
      h += '<div class="mri-card-title">Your Rate Position</div>';
      h += '<div class="mri-position-row">';
      h += '<span style="color:' + posColor + ';font-weight:700;font-size:1.1rem">' + (pos.diffPercent >= 0 ? '+' : '') + pos.diffPercent + '% vs market</span>';
      h += '<span style="color:var(--text3)">' + _capitalize(pos.label.replace(/-/g, ' ')) + '</span>';
      h += '</div>';
      h += '<div class="mri-position-advice">' + _escHtml(pos.recommendation) + '</div>';
      h += '</div>';
    }

    // ── Market Notes ──
    if (intel.marketNotes && intel.marketNotes.length) {
      h += '<div class="mri-card">';
      h += '<div class="mri-card-title">' + _escHtml(intel.countryLabel) + ' Market Insights</div>';
      h += '<div class="mri-notes">';
      for (var n = 0; n < intel.marketNotes.length; n++) {
        h += '<div class="mri-note-item">' + _escHtml(intel.marketNotes[n]) + '</div>';
      }
      h += '</div></div>';
    }

    container.innerHTML = h;
  }

  // ── Helpers ─────────────────────────────────────────────────────────

  function _getBenchmark(skill, country) {
    // Try to use global BENCHMARKS from the rate calculator page
    if (window.BENCHMARKS && window.BENCHMARKS[skill] && window.BENCHMARKS[skill][country]) {
      var rate = window.BENCHMARKS[skill][country];
      return { low: Math.round(rate * 0.6), median: rate, high: Math.round(rate * 1.35), p90: Math.round(rate * 1.8) };
    }
    // Fallback to our own data
    var market = REGIONAL_MARKETS[country];
    var avgRate = market ? market.avgFreelancerRate : (GENERIC_MARKETS[country] ? GENERIC_MARKETS[country].avgRate : 30);
    return { low: Math.round(avgRate * 0.6), median: avgRate, high: Math.round(avgRate * 1.35), p90: Math.round(avgRate * 1.8) };
  }

  function _getPositioningAdvice(label, current, market, demandAdj, comp) {
    switch (label) {
      case 'significantly-below':
        return 'Your rate is well below market. You could raise to $' + market + '/hr without losing competitiveness. Start with 15-20% increases on new clients and A/B test pricing.';
      case 'below':
        return 'Slight room to increase. Target $' + market + '/hr on your next client. Competition is ' + comp.intensity + ', but demand is ' + comp.demandTrend + ' — the market supports higher rates.';
      case 'at-market':
        return 'Competitive positioning. To move above market, specialize in high-demand niches or target clients from higher-paying regions. Demand-adjusted rate: $' + demandAdj + '/hr.';
      case 'above':
        return 'Strong rate. Maintain this by keeping your profile updated, collecting reviews, and demonstrating results. Consider value-based pricing for premium projects.';
      case 'premium':
        return 'Premium pricing. Ensure your profile, portfolio, and reviews justify this. Target enterprise clients and agencies who expect to pay for quality and reliability.';
      default:
        return 'Monitor market trends and adjust your rate as demand changes.';
    }
  }

  function _skillLabel(skill) {
    var labels = {
      'web-development': 'Web Development', 'mobile-development': 'Mobile Development',
      'design': 'UI/UX Design', 'graphic-design': 'Graphic Design', 'writing': 'Content Writing',
      'data-science': 'Data Science', 'devops': 'DevOps', 'cybersecurity': 'Cybersecurity',
      'marketing': 'Digital Marketing', 'seo': 'SEO', 'social-media': 'Social Media',
      'video': 'Video Editing', '3d-modeling': '3D Modeling', 'game-dev': 'Game Development',
      'product-management': 'Product Management', 'ecommerce': 'E-Commerce',
      'translation': 'Translation', 'blockchain': 'Blockchain', 'ar-vr': 'AR/VR', 'qa': 'QA/Testing'
    };
    return labels[skill] || skill;
  }

  function _capitalize(str) { return str ? str.charAt(0).toUpperCase() + str.slice(1) : ''; }
  function _formatNum(n) { return Math.round(n).toLocaleString('en-US'); }
  function _escHtml(str) {
    var d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  // ── Public API ──────────────────────────────────────────────────────

  window.CortexFreelancer.MarketRateIntelligence = {
    getRegionalIntelligence: getRegionalIntelligence,
    getTurkeyDeepDive: getTurkeyDeepDive,
    analyzeCompetition: analyzeCompetition,
    renderIntelligencePanel: renderIntelligencePanel,
    REGIONAL_MARKETS: REGIONAL_MARKETS,
    COL_DETAILS: COL_DETAILS,
    version: '1.0.0'
  };

})();
