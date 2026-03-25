/**
 * [CFX-070] Portfolio Improvement Analyzer
 * Comprehensive portfolio analysis: strength scoring, skill gap detection,
 * project diversity analysis, market alignment, competitive positioning,
 * and actionable improvement recommendations.
 *
 * window.CortexFreelancer.PortfolioImprovementAnalyzer
 */
(function () {
  'use strict';

  var CF = window.CortexFreelancer = window.CortexFreelancer || {};

  var STORAGE_KEY = 'cf_portfolio_improvement';
  var CSS_INJECTED = false;

  // ─── Market Data & Benchmarks ────────────────────────────────

  var MARKET_CATEGORIES = {
    'web-development': {
      label: 'Web Development',
      demandTrend: 'stable',
      avgRate: 65,
      topSkills: ['React', 'Next.js', 'TypeScript', 'Node.js', 'Vue.js', 'Tailwind CSS', 'GraphQL', 'PostgreSQL'],
      emergingSkills: ['Astro', 'HTMX', 'Bun', 'Deno', 'Edge Functions'],
      saturation: 0.78
    },
    'mobile-development': {
      label: 'Mobile Development',
      demandTrend: 'growing',
      avgRate: 75,
      topSkills: ['React Native', 'Flutter', 'Swift', 'Kotlin', 'iOS', 'Android', 'Firebase'],
      emergingSkills: ['Kotlin Multiplatform', 'Jetpack Compose', 'SwiftUI', 'Capacitor'],
      saturation: 0.62
    },
    'data-science': {
      label: 'Data Science & ML',
      demandTrend: 'growing',
      avgRate: 85,
      topSkills: ['Python', 'TensorFlow', 'PyTorch', 'SQL', 'Pandas', 'scikit-learn', 'NLP', 'Computer Vision'],
      emergingSkills: ['LLM Fine-tuning', 'RAG Systems', 'MLOps', 'Vector Databases', 'LangChain'],
      saturation: 0.55
    },
    'design': {
      label: 'UI/UX Design',
      demandTrend: 'stable',
      avgRate: 60,
      topSkills: ['Figma', 'UI Design', 'UX Research', 'Prototyping', 'Design Systems', 'Wireframing'],
      emergingSkills: ['AI-assisted Design', 'Motion Design', 'Spatial UI', 'Design Tokens'],
      saturation: 0.72
    },
    'devops': {
      label: 'DevOps & Cloud',
      demandTrend: 'growing',
      avgRate: 90,
      topSkills: ['AWS', 'Docker', 'Kubernetes', 'Terraform', 'CI/CD', 'Linux', 'GCP', 'Azure'],
      emergingSkills: ['Platform Engineering', 'GitOps', 'FinOps', 'Serverless', 'IaC'],
      saturation: 0.48
    },
    'blockchain': {
      label: 'Blockchain & Web3',
      demandTrend: 'declining',
      avgRate: 95,
      topSkills: ['Solidity', 'Ethereum', 'Smart Contracts', 'Web3.js', 'DeFi', 'Rust'],
      emergingSkills: ['ZK Proofs', 'Account Abstraction', 'Layer 2', 'Move Language'],
      saturation: 0.38
    },
    'ai-automation': {
      label: 'AI & Automation',
      demandTrend: 'surging',
      avgRate: 100,
      topSkills: ['ChatGPT API', 'LLM Integration', 'Python', 'Prompt Engineering', 'Automation', 'n8n', 'Zapier'],
      emergingSkills: ['AI Agents', 'MCP', 'Function Calling', 'Multi-modal AI', 'Agentic Workflows'],
      saturation: 0.32
    },
    'content-writing': {
      label: 'Content & Copywriting',
      demandTrend: 'declining',
      avgRate: 40,
      topSkills: ['SEO Writing', 'Blog Posts', 'Copywriting', 'Technical Writing', 'Content Strategy'],
      emergingSkills: ['AI-assisted Writing', 'Video Scripts', 'UX Writing', 'Product Copy'],
      saturation: 0.85
    }
  };

  var PROJECT_TYPES = [
    'full-stack', 'frontend', 'backend', 'api', 'mobile-app', 'landing-page',
    'e-commerce', 'dashboard', 'data-pipeline', 'automation', 'plugin',
    'saas', 'redesign', 'migration', 'integration', 'consulting'
  ];

  var INDUSTRY_SECTORS = [
    'fintech', 'healthcare', 'education', 'e-commerce', 'saas', 'media',
    'real-estate', 'logistics', 'gaming', 'non-profit', 'government', 'startup'
  ];

  // ─── Storage Layer ───────────────────────────────────────────

  function getData() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : _defaultData();
    } catch (e) { return _defaultData(); }
  }

  function saveData(data) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) { /* ignore */ }
  }

  function _defaultData() {
    return {
      portfolio: {
        items: [],
        skills: [],
        categories: [],
        yearsExperience: 0,
        targetRate: 0,
        targetCategories: []
      },
      analyses: [],
      lastAnalyzedAt: null
    };
  }

  // ─── Portfolio Item Management ───────────────────────────────

  function addPortfolioItem(item) {
    var data = getData();
    var entry = {
      id: 'pi_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 4),
      addedAt: new Date().toISOString(),
      title: (item.title || '').substring(0, 200),
      description: (item.description || '').substring(0, 2000),
      skills: Array.isArray(item.skills) ? item.skills.slice(0, 20) : [],
      projectType: item.projectType || 'other',
      industry: item.industry || 'other',
      clientType: item.clientType || 'unknown', // startup, enterprise, agency, individual
      duration: item.duration || null, // weeks
      budget: item.budget || null,
      outcome: item.outcome || '', // measurable results
      imageCount: item.imageCount || 0,
      hasLiveDemo: item.hasLiveDemo || false,
      hasTestimonial: item.hasTestimonial || false,
      isPublic: item.isPublic !== false,
      completedAt: item.completedAt || null
    };
    data.portfolio.items.unshift(entry);
    if (data.portfolio.items.length > 50) data.portfolio.items = data.portfolio.items.slice(0, 50);
    saveData(data);
    return entry;
  }

  function removePortfolioItem(itemId) {
    var data = getData();
    data.portfolio.items = data.portfolio.items.filter(function (i) { return i.id !== itemId; });
    saveData(data);
  }

  function updateProfile(profile) {
    var data = getData();
    if (profile.skills) data.portfolio.skills = profile.skills.slice(0, 30);
    if (profile.categories) data.portfolio.categories = profile.categories;
    if (profile.targetCategories) data.portfolio.targetCategories = profile.targetCategories;
    if (profile.yearsExperience !== undefined) data.portfolio.yearsExperience = profile.yearsExperience;
    if (profile.targetRate !== undefined) data.portfolio.targetRate = profile.targetRate;
    saveData(data);
    return data.portfolio;
  }

  // ─── Core Analysis Engine ────────────────────────────────────

  function runFullAnalysis() {
    var data = getData();
    var portfolio = data.portfolio;
    var items = portfolio.items;

    var analysis = {
      id: 'an_' + Date.now().toString(36),
      timestamp: new Date().toISOString(),
      portfolioStrength: _analyzeStrength(items, portfolio),
      skillGaps: _analyzeSkillGaps(portfolio),
      projectDiversity: _analyzeDiversity(items),
      marketAlignment: _analyzeMarketAlignment(portfolio),
      competitivePosition: _analyzeCompetitivePosition(portfolio, items),
      recommendations: [],
      overallScore: 0
    };

    // Compute overall score (weighted average)
    analysis.overallScore = Math.round(
      analysis.portfolioStrength.score * 0.25 +
      (100 - analysis.skillGaps.gapSeverity) * 0.20 +
      analysis.projectDiversity.score * 0.20 +
      analysis.marketAlignment.score * 0.20 +
      analysis.competitivePosition.score * 0.15
    );

    // Generate unified recommendations
    analysis.recommendations = _generateRecommendations(analysis, portfolio);

    // Save analysis
    data.analyses.unshift(analysis);
    if (data.analyses.length > 20) data.analyses = data.analyses.slice(0, 20);
    data.lastAnalyzedAt = analysis.timestamp;
    saveData(data);

    return analysis;
  }

  // ─── Portfolio Strength Analysis ─────────────────────────────

  function _analyzeStrength(items, portfolio) {
    var result = {
      score: 0,
      itemCount: items.length,
      metrics: {},
      issues: [],
      strengths: []
    };

    if (items.length === 0) {
      result.issues.push('Portfolio is empty — add projects to get a meaningful analysis');
      return result;
    }

    var scores = {};

    // 1. Quantity (15 pts)
    if (items.length >= 8) scores.quantity = 15;
    else if (items.length >= 5) scores.quantity = 12;
    else if (items.length >= 3) scores.quantity = 8;
    else scores.quantity = items.length * 2;

    // 2. Description quality (20 pts)
    var descScores = items.map(function (item) {
      var words = (item.description || '').trim().split(/\s+/).filter(Boolean).length;
      var hasMetrics = /\d+%|\$[\d,]+|\d+x|increased|reduced|improved|saved/i.test(item.description);
      var score = 0;
      if (words >= 100) score += 6;
      else if (words >= 50) score += 4;
      else if (words >= 20) score += 2;
      if (hasMetrics) score += 4;
      return Math.min(10, score);
    });
    scores.descriptionQuality = Math.round(descScores.reduce(function (a, b) { return a + b; }, 0) / items.length * 2);

    // 3. Visual assets (15 pts)
    var withImages = items.filter(function (i) { return i.imageCount > 0; }).length;
    var withDemos = items.filter(function (i) { return i.hasLiveDemo; }).length;
    scores.visuals = Math.round((withImages / items.length) * 10 + (withDemos / items.length) * 5);

    // 4. Social proof (15 pts)
    var withTestimonials = items.filter(function (i) { return i.hasTestimonial; }).length;
    var withOutcomes = items.filter(function (i) { return i.outcome && i.outcome.length > 10; }).length;
    scores.socialProof = Math.round((withTestimonials / items.length) * 8 + (withOutcomes / items.length) * 7);

    // 5. Recency (10 pts)
    var now = Date.now();
    var recentCount = items.filter(function (i) {
      if (!i.completedAt) return false;
      var age = now - new Date(i.completedAt).getTime();
      return age < 365 * 24 * 60 * 60 * 1000; // within 1 year
    }).length;
    scores.recency = items[0] && items[0].completedAt ? Math.min(10, Math.round((recentCount / Math.max(items.length, 1)) * 10)) : 5;

    // 6. Skills coverage (15 pts)
    var allSkills = {};
    items.forEach(function (i) { (i.skills || []).forEach(function (s) { allSkills[s.toLowerCase()] = true; }); });
    var uniqueSkillCount = Object.keys(allSkills).length;
    scores.skillsCoverage = Math.min(15, Math.round(uniqueSkillCount * 1.5));

    // 7. Completeness (10 pts)
    var completenessScores = items.map(function (item) {
      var filled = 0;
      if (item.title) filled++;
      if (item.description && item.description.length > 20) filled++;
      if (item.skills && item.skills.length > 0) filled++;
      if (item.projectType && item.projectType !== 'other') filled++;
      if (item.industry && item.industry !== 'other') filled++;
      if (item.imageCount > 0) filled++;
      if (item.outcome) filled++;
      return filled / 7;
    });
    scores.completeness = Math.round(completenessScores.reduce(function (a, b) { return a + b; }, 0) / items.length * 10);

    // Aggregate
    result.metrics = scores;
    result.score = 0;
    for (var key in scores) result.score += scores[key];
    result.score = Math.min(100, result.score);

    // Generate issues and strengths
    if (scores.quantity < 8) result.issues.push('Too few portfolio items — aim for 5-8 projects');
    if (scores.descriptionQuality < 10) result.issues.push('Descriptions lack detail or measurable outcomes');
    if (scores.visuals < 8) result.issues.push('Most projects missing screenshots or live demos');
    if (scores.socialProof < 8) result.issues.push('Weak social proof — add testimonials and quantified results');
    if (scores.recency < 5) result.issues.push('Portfolio appears outdated — add recent work');
    if (scores.completeness < 6) result.issues.push('Many items have incomplete information');

    if (scores.quantity >= 12) result.strengths.push('Good number of portfolio items');
    if (scores.descriptionQuality >= 15) result.strengths.push('Strong, detailed project descriptions');
    if (scores.visuals >= 12) result.strengths.push('Excellent visual documentation');
    if (scores.socialProof >= 12) result.strengths.push('Solid client testimonials and results');
    if (scores.skillsCoverage >= 12) result.strengths.push('Diverse skill demonstration');

    return result;
  }

  // ─── Skill Gap Analysis ──────────────────────────────────────

  function _analyzeSkillGaps(portfolio) {
    var result = {
      gapSeverity: 0, // 0 = no gaps, 100 = critical gaps
      currentSkills: portfolio.skills || [],
      gaps: [],
      emergingOpportunities: [],
      overrepresented: [],
      recommendations: []
    };

    var targetCats = portfolio.targetCategories && portfolio.targetCategories.length
      ? portfolio.targetCategories
      : portfolio.categories;

    if (!targetCats || targetCats.length === 0) {
      result.gapSeverity = 50;
      result.gaps.push({ skill: 'Category selection', priority: 'high', reason: 'No target categories set — cannot analyze skill gaps' });
      return result;
    }

    var currentSkillsLower = (portfolio.skills || []).map(function (s) { return s.toLowerCase(); });
    var portfolioSkillsLower = {};
    (portfolio.items || []).forEach(function (item) {
      (item.skills || []).forEach(function (s) { portfolioSkillsLower[s.toLowerCase()] = true; });
    });

    var requiredSkills = {};
    var emergingSkills = {};
    var totalRequired = 0;

    targetCats.forEach(function (catKey) {
      var cat = MARKET_CATEGORIES[catKey];
      if (!cat) return;
      (cat.topSkills || []).forEach(function (s) {
        requiredSkills[s.toLowerCase()] = { name: s, category: cat.label, priority: 'high' };
        totalRequired++;
      });
      (cat.emergingSkills || []).forEach(function (s) {
        emergingSkills[s.toLowerCase()] = { name: s, category: cat.label };
      });
    });

    // Find gaps
    var gapCount = 0;
    for (var skillKey in requiredSkills) {
      if (currentSkillsLower.indexOf(skillKey) === -1 && !portfolioSkillsLower[skillKey]) {
        gapCount++;
        var info = requiredSkills[skillKey];
        result.gaps.push({
          skill: info.name,
          category: info.category,
          priority: 'high',
          reason: 'In-demand skill for ' + info.category + ' not in your profile'
        });
      }
    }

    // Emerging skills opportunities
    for (var eKey in emergingSkills) {
      if (currentSkillsLower.indexOf(eKey) === -1) {
        result.emergingOpportunities.push({
          skill: emergingSkills[eKey].name,
          category: emergingSkills[eKey].category,
          reason: 'Emerging skill with growing demand and low competition'
        });
      }
    }

    // Over-represented skills (in profile but not market-relevant)
    currentSkillsLower.forEach(function (sk) {
      if (!requiredSkills[sk] && !emergingSkills[sk]) {
        result.overrepresented.push(sk);
      }
    });

    // Calculate severity
    if (totalRequired > 0) {
      result.gapSeverity = Math.min(100, Math.round((gapCount / totalRequired) * 100));
    }

    // Sort gaps by priority
    result.gaps.sort(function (a, b) {
      var prio = { critical: 0, high: 1, medium: 2, low: 3 };
      return (prio[a.priority] || 3) - (prio[b.priority] || 3);
    });

    // Limit
    result.gaps = result.gaps.slice(0, 15);
    result.emergingOpportunities = result.emergingOpportunities.slice(0, 8);

    return result;
  }

  // ─── Project Diversity Analysis ──────────────────────────────

  function _analyzeDiversity(items) {
    var result = {
      score: 0,
      metrics: {},
      issues: [],
      strengths: []
    };

    if (items.length === 0) {
      result.issues.push('No items to analyze diversity');
      return result;
    }

    // 1. Project type diversity (30 pts)
    var typeDistribution = {};
    items.forEach(function (i) {
      var t = i.projectType || 'other';
      typeDistribution[t] = (typeDistribution[t] || 0) + 1;
    });
    var uniqueTypes = Object.keys(typeDistribution).length;
    var typeScore = Math.min(30, uniqueTypes * 6);

    // Check for over-concentration
    var maxTypePercent = 0;
    for (var t in typeDistribution) {
      var pct = typeDistribution[t] / items.length;
      if (pct > maxTypePercent) maxTypePercent = pct;
    }
    if (maxTypePercent > 0.6) {
      typeScore = Math.round(typeScore * 0.7);
      result.issues.push('Over 60% of projects are the same type — diversify to show range');
    }

    // 2. Industry diversity (25 pts)
    var industryDistribution = {};
    items.forEach(function (i) {
      var ind = i.industry || 'other';
      industryDistribution[ind] = (industryDistribution[ind] || 0) + 1;
    });
    var uniqueIndustries = Object.keys(industryDistribution).length;
    var industryScore = Math.min(25, uniqueIndustries * 5);

    // 3. Client type diversity (20 pts)
    var clientTypes = {};
    items.forEach(function (i) {
      var ct = i.clientType || 'unknown';
      clientTypes[ct] = (clientTypes[ct] || 0) + 1;
    });
    var uniqueClientTypes = Object.keys(clientTypes).filter(function (k) { return k !== 'unknown'; }).length;
    var clientScore = Math.min(20, uniqueClientTypes * 7);

    // 4. Budget range diversity (15 pts)
    var budgets = items.filter(function (i) { return i.budget > 0; }).map(function (i) { return i.budget; });
    var budgetScore = 0;
    if (budgets.length >= 2) {
      var minB = Math.min.apply(null, budgets);
      var maxB = Math.max.apply(null, budgets);
      var range = maxB - minB;
      if (range > 5000) budgetScore = 15;
      else if (range > 2000) budgetScore = 10;
      else if (range > 500) budgetScore = 5;
    }

    // 5. Skill breadth across projects (10 pts)
    var skillSets = items.map(function (i) { return (i.skills || []).map(function (s) { return s.toLowerCase(); }); });
    var allUniqueSkills = {};
    skillSets.forEach(function (ss) { ss.forEach(function (s) { allUniqueSkills[s] = true; }); });
    var skillBreadth = Math.min(10, Object.keys(allUniqueSkills).length);

    result.metrics = {
      typeDistribution: typeDistribution,
      industryDistribution: industryDistribution,
      clientTypes: clientTypes,
      uniqueTypes: uniqueTypes,
      uniqueIndustries: uniqueIndustries,
      uniqueClientTypes: uniqueClientTypes,
      budgetRange: budgets.length >= 2 ? { min: Math.min.apply(null, budgets), max: Math.max.apply(null, budgets) } : null
    };

    result.score = Math.min(100, typeScore + industryScore + clientScore + budgetScore + skillBreadth);

    // Strengths and issues
    if (uniqueTypes >= 4) result.strengths.push('Good variety of project types');
    if (uniqueIndustries >= 3) result.strengths.push('Experience across multiple industries');
    if (uniqueClientTypes >= 3) result.strengths.push('Worked with diverse client types');

    if (uniqueTypes <= 2) result.issues.push('Limited project types — consider adding different kinds of work');
    if (uniqueIndustries <= 1) result.issues.push('All projects in one industry — broaden your industry experience');

    return result;
  }

  // ─── Market Alignment Analysis ───────────────────────────────

  function _analyzeMarketAlignment(portfolio) {
    var result = {
      score: 0,
      alignedCategories: [],
      misalignments: [],
      rateAnalysis: null,
      trendInsights: [],
      saturationWarnings: []
    };

    var targetCats = portfolio.targetCategories && portfolio.targetCategories.length
      ? portfolio.targetCategories
      : portfolio.categories;

    if (!targetCats || targetCats.length === 0) {
      result.misalignments.push('No target market categories selected');
      result.score = 20;
      return result;
    }

    var currentSkillsLower = (portfolio.skills || []).map(function (s) { return s.toLowerCase(); });
    var totalAlignment = 0;

    targetCats.forEach(function (catKey) {
      var cat = MARKET_CATEGORIES[catKey];
      if (!cat) return;

      // Skill match percentage
      var matchCount = 0;
      cat.topSkills.forEach(function (s) {
        if (currentSkillsLower.indexOf(s.toLowerCase()) !== -1) matchCount++;
      });
      var matchPct = cat.topSkills.length > 0 ? matchCount / cat.topSkills.length : 0;
      totalAlignment += matchPct;

      result.alignedCategories.push({
        key: catKey,
        label: cat.label,
        matchPercent: Math.round(matchPct * 100),
        matchedSkills: matchCount,
        totalRequired: cat.topSkills.length,
        demandTrend: cat.demandTrend,
        saturation: cat.saturation
      });

      // Trend insights
      if (cat.demandTrend === 'surging') {
        result.trendInsights.push(cat.label + ' demand is surging — great market to target');
      } else if (cat.demandTrend === 'declining') {
        result.trendInsights.push(cat.label + ' demand is declining — consider diversifying');
      }

      // Saturation warnings
      if (cat.saturation > 0.75) {
        result.saturationWarnings.push(cat.label + ' is highly saturated (' + Math.round(cat.saturation * 100) + '%) — differentiation is critical');
      }
    });

    // Rate analysis
    if (portfolio.targetRate > 0) {
      var avgMarketRate = 0;
      var catCount = 0;
      targetCats.forEach(function (catKey) {
        var cat = MARKET_CATEGORIES[catKey];
        if (cat) { avgMarketRate += cat.avgRate; catCount++; }
      });
      if (catCount > 0) {
        avgMarketRate = Math.round(avgMarketRate / catCount);
        var rateDiff = portfolio.targetRate - avgMarketRate;
        result.rateAnalysis = {
          targetRate: portfolio.targetRate,
          marketAverage: avgMarketRate,
          difference: rateDiff,
          position: rateDiff > 20 ? 'premium' : rateDiff > 0 ? 'above-average' : rateDiff > -15 ? 'competitive' : 'below-market'
        };
      }
    }

    // Calculate score
    var alignmentAvg = targetCats.length > 0 ? totalAlignment / targetCats.length : 0;
    result.score = Math.min(100, Math.round(alignmentAvg * 80 + 20)); // 20 base for having targets set

    return result;
  }

  // ─── Competitive Positioning Analysis ────────────────────────

  function _analyzeCompetitivePosition(portfolio, items) {
    var result = {
      score: 0,
      differentiators: [],
      weaknesses: [],
      positioningAdvice: [],
      nichePotential: [],
      competitiveEdge: 'unknown'
    };

    var skills = portfolio.skills || [];
    var targetCats = portfolio.targetCategories || portfolio.categories || [];

    // Differentiators
    if (portfolio.yearsExperience >= 5) {
      result.differentiators.push({ factor: 'Experience', detail: portfolio.yearsExperience + ' years — positions you as a senior expert' });
    }

    var testimonialsCount = items.filter(function (i) { return i.hasTestimonial; }).length;
    if (testimonialsCount >= 3) {
      result.differentiators.push({ factor: 'Social Proof', detail: testimonialsCount + ' client testimonials build strong trust' });
    }

    var liveDemos = items.filter(function (i) { return i.hasLiveDemo; }).length;
    if (liveDemos >= 2) {
      result.differentiators.push({ factor: 'Live Demos', detail: liveDemos + ' live demos showcase real working products' });
    }

    var hasOutcomes = items.filter(function (i) { return i.outcome && /\d/.test(i.outcome); }).length;
    if (hasOutcomes >= 2) {
      result.differentiators.push({ factor: 'Quantified Results', detail: hasOutcomes + ' projects with measurable outcomes' });
    }

    // Weaknesses
    if (portfolio.yearsExperience < 2) {
      result.weaknesses.push({ factor: 'Experience', detail: 'Less than 2 years — focus on quality over quantity in portfolio' });
    }

    if (items.length < 3) {
      result.weaknesses.push({ factor: 'Portfolio Size', detail: 'Fewer than 3 items limits client confidence' });
    }

    if (testimonialsCount === 0) {
      result.weaknesses.push({ factor: 'No Testimonials', detail: 'Missing social proof — request reviews from past clients' });
    }

    if (liveDemos === 0) {
      result.weaknesses.push({ factor: 'No Live Demos', detail: 'No live projects to showcase — deploy sample work' });
    }

    // Niche potential analysis
    var skillCombos = _findSkillCombinations(skills);
    skillCombos.forEach(function (combo) {
      result.nichePotential.push({
        niche: combo.niche,
        skills: combo.skills,
        potential: combo.potential,
        reason: combo.reason
      });
    });

    // Positioning advice
    if (portfolio.yearsExperience >= 5 && hasOutcomes >= 2) {
      result.positioningAdvice.push('Position as a results-driven specialist — lead with outcomes');
      result.competitiveEdge = 'specialist';
    } else if (skills.length > 10) {
      result.positioningAdvice.push('Wide skill set detected — consider narrowing focus to 2-3 specialties');
      result.competitiveEdge = 'generalist';
    } else if (portfolio.yearsExperience < 2) {
      result.positioningAdvice.push('Lead with project quality and enthusiasm — build a focused niche portfolio');
      result.competitiveEdge = 'emerging';
    } else {
      result.positioningAdvice.push('Build authority through case studies and consistent delivery');
      result.competitiveEdge = 'growing';
    }

    // Rate positioning advice
    targetCats.forEach(function (catKey) {
      var cat = MARKET_CATEGORIES[catKey];
      if (!cat) return;
      if (cat.saturation < 0.5) {
        result.positioningAdvice.push(cat.label + ' has low saturation — great opportunity to establish yourself');
      }
      if (cat.demandTrend === 'surging') {
        result.positioningAdvice.push('Capitalize on surging ' + cat.label + ' demand with targeted portfolio items');
      }
    });

    // Score
    var diffScore = Math.min(40, result.differentiators.length * 10);
    var weakPenalty = Math.min(30, result.weaknesses.length * 10);
    var nicheBonus = Math.min(20, result.nichePotential.length * 5);
    var baseScore = 40;
    result.score = Math.min(100, Math.max(10, baseScore + diffScore - weakPenalty + nicheBonus));

    return result;
  }

  function _findSkillCombinations(skills) {
    var combos = [];
    var skillsLower = skills.map(function (s) { return s.toLowerCase(); });

    var nicheMap = [
      { niche: 'AI-Powered Web Apps', skills: ['react', 'python', 'openai'], potential: 'high', reason: 'Hot intersection of AI and web development' },
      { niche: 'FinTech Development', skills: ['react', 'node.js', 'postgresql'], potential: 'high', reason: 'Growing demand in financial services' },
      { niche: 'Mobile + Backend', skills: ['react native', 'node.js', 'firebase'], potential: 'medium', reason: 'Full-stack mobile capabilities' },
      { niche: 'Data Dashboard Specialist', skills: ['react', 'python', 'd3.js'], potential: 'medium', reason: 'Niche demand for data visualization' },
      { niche: 'E-commerce Expert', skills: ['shopify', 'react', 'stripe'], potential: 'high', reason: 'Steady e-commerce platform demand' },
      { niche: 'DevOps Automation', skills: ['docker', 'kubernetes', 'terraform'], potential: 'high', reason: 'Enterprise DevOps talent shortage' },
      { niche: 'AI Automation Specialist', skills: ['python', 'langchain', 'automation'], potential: 'very-high', reason: 'Fastest growing freelance niche in 2026' }
    ];

    nicheMap.forEach(function (n) {
      var matchCount = 0;
      n.skills.forEach(function (s) {
        if (skillsLower.indexOf(s) !== -1) matchCount++;
      });
      if (matchCount >= 2) {
        combos.push(n);
      }
    });

    return combos;
  }

  // ─── Recommendation Engine ───────────────────────────────────

  function _generateRecommendations(analysis, portfolio) {
    var recs = [];

    // Priority 1: Critical issues
    if (analysis.portfolioStrength.itemCount === 0) {
      recs.push({ priority: 'critical', category: 'portfolio', action: 'Add your first portfolio item', detail: 'Start with your strongest project — include description, screenshots, and skills used.', impact: 'high' });
      return recs; // Nothing else to analyze
    }

    // Portfolio strength recommendations
    analysis.portfolioStrength.issues.forEach(function (issue) {
      recs.push({ priority: 'high', category: 'strength', action: 'Fix: ' + issue, detail: _getFixDetail(issue), impact: 'high' });
    });

    // Skill gap recommendations
    var topGaps = analysis.skillGaps.gaps.slice(0, 5);
    if (topGaps.length > 0) {
      recs.push({
        priority: 'high',
        category: 'skills',
        action: 'Address top skill gaps',
        detail: 'Missing in-demand skills: ' + topGaps.map(function (g) { return g.skill; }).join(', ') + '. Add projects demonstrating these skills or invest in upskilling.',
        impact: 'high'
      });
    }

    // Emerging skills opportunities
    var topEmerging = analysis.skillGaps.emergingOpportunities.slice(0, 3);
    if (topEmerging.length > 0) {
      recs.push({
        priority: 'medium',
        category: 'skills',
        action: 'Invest in emerging skills',
        detail: 'Early adoption opportunities: ' + topEmerging.map(function (e) { return e.skill; }).join(', ') + '. Low competition, growing demand.',
        impact: 'medium'
      });
    }

    // Diversity recommendations
    if (analysis.projectDiversity.score < 50) {
      recs.push({ priority: 'medium', category: 'diversity', action: 'Diversify your portfolio', detail: 'Add projects from different industries, types, or client sizes to show versatility.', impact: 'medium' });
    }

    // Market alignment
    analysis.marketAlignment.alignedCategories.forEach(function (cat) {
      if (cat.matchPercent < 40) {
        recs.push({
          priority: 'high',
          category: 'market',
          action: 'Improve ' + cat.label + ' alignment (' + cat.matchPercent + '% match)',
          detail: 'Your skills cover only ' + cat.matchedSkills + '/' + cat.totalRequired + ' required skills for ' + cat.label + '. Add projects or skills to close the gap.',
          impact: 'high'
        });
      }
    });

    // Rate positioning
    if (analysis.marketAlignment.rateAnalysis) {
      var ra = analysis.marketAlignment.rateAnalysis;
      if (ra.position === 'below-market') {
        recs.push({ priority: 'medium', category: 'pricing', action: 'Your rate is below market average', detail: 'Market average: $' + ra.marketAverage + '/hr. Your target: $' + ra.targetRate + '/hr. Strengthen portfolio to justify higher rates.', impact: 'medium' });
      } else if (ra.position === 'premium') {
        recs.push({ priority: 'low', category: 'pricing', action: 'Premium pricing requires premium proof', detail: 'At $' + ra.targetRate + '/hr (market avg: $' + ra.marketAverage + '), ensure portfolio shows enterprise-grade results and testimonials.', impact: 'medium' });
      }
    }

    // Competitive positioning
    analysis.competitivePosition.weaknesses.forEach(function (w) {
      recs.push({ priority: 'medium', category: 'competitive', action: 'Address: ' + w.factor, detail: w.detail, impact: 'medium' });
    });

    // Niche recommendations
    if (analysis.competitivePosition.nichePotential.length > 0) {
      var topNiche = analysis.competitivePosition.nichePotential[0];
      recs.push({
        priority: 'low',
        category: 'positioning',
        action: 'Consider niche: ' + topNiche.niche,
        detail: topNiche.reason + '. You already have: ' + topNiche.skills.join(', '),
        impact: 'medium'
      });
    }

    // Sort by priority
    var prioOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    recs.sort(function (a, b) { return (prioOrder[a.priority] || 3) - (prioOrder[b.priority] || 3); });

    return recs.slice(0, 15);
  }

  function _getFixDetail(issue) {
    var fixes = {
      'Too few portfolio items': 'Add 5-8 diverse projects. Include personal projects, open source contributions, or case studies if client work is limited.',
      'Descriptions lack detail or measurable outcomes': 'Rewrite descriptions using the format: Challenge → Approach → Results. Include specific metrics like "reduced load time by 40%".',
      'Most projects missing screenshots or live demos': 'Add 2-3 high-quality screenshots per project. Deploy demos to Vercel/Netlify for live previews.',
      'Weak social proof': 'Request testimonials from past clients. Add quantified outcomes to every project description.',
      'Portfolio appears outdated': 'Add your most recent projects. Update existing items with current technologies.',
      'Many items have incomplete information': 'Fill in all fields: title, description, skills, project type, industry, and outcomes.'
    };
    for (var key in fixes) {
      if (issue.indexOf(key.substring(0, 20)) !== -1) return fixes[key];
    }
    return 'Review and improve this aspect of your portfolio.';
  }

  // ─── CSS Injection ───────────────────────────────────────────

  function _injectCSS() {
    if (CSS_INJECTED) return;
    CSS_INJECTED = true;
    var style = document.createElement('style');
    style.textContent = [
      '.pia-panel { background: var(--bg-card, #111); border: 1px solid var(--border, #222); border-radius: var(--radius, 12px); padding: 1.5rem; margin-bottom: 1rem; }',
      '.pia-header { font-size: 1.3rem; font-weight: 800; color: var(--text-bright, #fff); margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem; }',
      '.pia-subheader { font-size: 1rem; font-weight: 700; color: var(--text-bright, #fff); margin: 1rem 0 0.5rem; }',
      '.pia-score-ring { width: 120px; height: 120px; margin: 0 auto 1rem; position: relative; }',
      '.pia-score-ring svg { transform: rotate(-90deg); }',
      '.pia-score-label { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 1.8rem; font-weight: 800; }',
      '.pia-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.75rem; margin: 0.75rem 0; }',
      '.pia-stat { text-align: center; padding: 0.75rem; background: var(--bg, #0a0a0a); border: 1px solid var(--border, #222); border-radius: var(--radius-sm, 8px); }',
      '.pia-stat-value { font-size: 1.4rem; font-weight: 800; }',
      '.pia-stat-label { font-size: 0.7rem; color: var(--text-dim, #888); margin-top: 0.2rem; text-transform: uppercase; letter-spacing: 0.5px; }',
      '.pia-bar { height: 8px; background: rgba(255,255,255,0.06); border-radius: 4px; overflow: hidden; margin: 0.3rem 0; }',
      '.pia-bar-fill { height: 100%; border-radius: 4px; transition: width 0.6s ease; }',
      '.pia-list { list-style: none; padding: 0; margin: 0.5rem 0; }',
      '.pia-list li { padding: 0.5rem 0; border-bottom: 1px solid rgba(255,255,255,0.04); font-size: 0.85rem; color: var(--text, #e0e0e0); display: flex; align-items: flex-start; gap: 0.5rem; }',
      '.pia-list li:last-child { border-bottom: none; }',
      '.pia-badge { display: inline-block; font-size: 0.65rem; font-weight: 700; padding: 0.15rem 0.5rem; border-radius: 100px; text-transform: uppercase; letter-spacing: 0.5px; }',
      '.pia-badge-critical { background: rgba(255,60,60,0.15); color: #ff3c3c; border: 1px solid rgba(255,60,60,0.3); }',
      '.pia-badge-high { background: rgba(255,136,68,0.15); color: #ff8844; border: 1px solid rgba(255,136,68,0.3); }',
      '.pia-badge-medium { background: rgba(255,200,50,0.15); color: #ffc832; border: 1px solid rgba(255,200,50,0.3); }',
      '.pia-badge-low { background: rgba(0,255,136,0.15); color: #00ff88; border: 1px solid rgba(0,255,136,0.3); }',
      '.pia-rec-card { background: var(--bg, #0a0a0a); border: 1px solid var(--border, #222); border-radius: var(--radius-sm, 8px); padding: 0.75rem; margin-bottom: 0.5rem; }',
      '.pia-rec-action { font-weight: 700; color: var(--text-bright, #fff); font-size: 0.85rem; }',
      '.pia-rec-detail { font-size: 0.8rem; color: var(--text-dim, #888); margin-top: 0.25rem; line-height: 1.4; }',
      '.pia-rec-meta { display: flex; gap: 0.5rem; margin-top: 0.4rem; align-items: center; }',
      '.pia-tag { display: inline-block; font-size: 0.65rem; padding: 0.1rem 0.4rem; border-radius: 4px; background: rgba(255,255,255,0.05); color: var(--text-dim, #888); border: 1px solid rgba(255,255,255,0.06); }',
      '.pia-tag-match { background: rgba(0,255,136,0.1); color: #00ff88; border-color: rgba(0,255,136,0.2); }',
      '.pia-tag-gap { background: rgba(255,136,68,0.1); color: #ff8844; border-color: rgba(255,136,68,0.2); }',
      '.pia-section { margin-top: 1rem; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.06); }',
      '.pia-trend-badge { display: inline-flex; align-items: center; gap: 3px; font-size: 0.65rem; font-weight: 600; padding: 0.15rem 0.5rem; border-radius: 100px; }',
      '.pia-trend-surging { background: rgba(0,255,136,0.15); color: #00ff88; }',
      '.pia-trend-growing { background: rgba(0,200,255,0.15); color: #00c8ff; }',
      '.pia-trend-stable { background: rgba(255,255,255,0.08); color: var(--text-dim, #888); }',
      '.pia-trend-declining { background: rgba(255,60,60,0.12); color: #ff6060; }',
      '.pia-tabs { display: flex; gap: 0.25rem; margin-bottom: 1rem; border-bottom: 1px solid var(--border, #222); padding-bottom: 0.5rem; flex-wrap: wrap; }',
      '.pia-tab { padding: 0.4rem 0.8rem; font-size: 0.8rem; font-weight: 600; border: none; background: none; color: var(--text-dim, #888); cursor: pointer; border-radius: var(--radius-sm, 8px); transition: all 0.2s; }',
      '.pia-tab:hover { color: var(--text, #e0e0e0); background: rgba(255,255,255,0.04); }',
      '.pia-tab.active { color: var(--green, #00ff88); background: rgba(0,255,136,0.08); }',
      '.pia-tab-content { display: none; }',
      '.pia-tab-content.active { display: block; }',
      '.pia-empty { text-align: center; padding: 2rem; color: var(--text-dim, #888); }',
      '.pia-empty-icon { font-size: 2rem; margin-bottom: 0.5rem; }',
      '.pia-btn { padding: 0.5rem 1rem; font-size: 0.8rem; font-weight: 600; border: 1px solid var(--border, #222); border-radius: var(--radius-sm, 8px); background: var(--bg-card, #111); color: var(--text, #e0e0e0); cursor: pointer; transition: all 0.2s; }',
      '.pia-btn:hover { border-color: var(--green, #00ff88); color: var(--green, #00ff88); }',
      '.pia-btn-primary { background: var(--green, #00ff88); color: var(--bg, #0a0a0a); border-color: var(--green, #00ff88); }',
      '.pia-btn-primary:hover { opacity: 0.9; }',
      '.pia-strength-row { display: flex; align-items: center; gap: 0.75rem; margin: 0.4rem 0; }',
      '.pia-strength-label { font-size: 0.75rem; color: var(--text-dim, #888); width: 120px; flex-shrink: 0; }',
      '.pia-strength-bar { flex: 1; }',
      '.pia-strength-val { font-size: 0.75rem; font-weight: 700; width: 32px; text-align: right; }',
      '@media (max-width: 600px) { .pia-grid { grid-template-columns: 1fr; } .pia-tabs { gap: 0.15rem; } .pia-tab { padding: 0.3rem 0.5rem; font-size: 0.7rem; } }'
    ].join('\n');
    document.head.appendChild(style);
  }

  // ─── Rendering ───────────────────────────────────────────────

  function _scoreColor(score) {
    if (score >= 80) return '#00ff88';
    if (score >= 60) return '#00c8ff';
    if (score >= 40) return '#ffc832';
    if (score >= 20) return '#ff8844';
    return '#ff3c3c';
  }

  function _trendIcon(trend) {
    var icons = { surging: '&#9650;&#9650;', growing: '&#9650;', stable: '&#9644;', declining: '&#9660;' };
    return icons[trend] || '&#9644;';
  }

  function _scoreRing(score, size) {
    size = size || 120;
    var r = (size - 12) / 2;
    var circ = 2 * Math.PI * r;
    var offset = circ - (score / 100) * circ;
    var color = _scoreColor(score);
    return '<div class="pia-score-ring" style="width:' + size + 'px;height:' + size + 'px">' +
      '<svg width="' + size + '" height="' + size + '">' +
      '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="6"/>' +
      '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="6" stroke-linecap="round" stroke-dasharray="' + circ + '" stroke-dashoffset="' + offset + '"/>' +
      '</svg>' +
      '<div class="pia-score-label" style="color:' + color + '">' + score + '</div></div>';
  }

  function _bar(value, max, color) {
    var pct = max > 0 ? Math.min(100, Math.round(value / max * 100)) : 0;
    return '<div class="pia-bar"><div class="pia-bar-fill" style="width:' + pct + '%;background:' + (color || _scoreColor(pct)) + '"></div></div>';
  }

  function renderDashboard(containerId) {
    _injectCSS();
    var container = document.getElementById(containerId);
    if (!container) return;

    var data = getData();
    var analysis = data.analyses.length > 0 ? data.analyses[0] : null;

    var h = '<div class="pia-panel">';
    h += '<div class="pia-header">Portfolio Improvement Analyzer</div>';

    // Tabs
    h += '<div class="pia-tabs">';
    h += '<button class="pia-tab active" data-pia-tab="overview" onclick="CortexFreelancer.PortfolioImprovementAnalyzer._switchTab(\'overview\')">Overview</button>';
    h += '<button class="pia-tab" data-pia-tab="strength" onclick="CortexFreelancer.PortfolioImprovementAnalyzer._switchTab(\'strength\')">Strength</button>';
    h += '<button class="pia-tab" data-pia-tab="skills" onclick="CortexFreelancer.PortfolioImprovementAnalyzer._switchTab(\'skills\')">Skill Gaps</button>';
    h += '<button class="pia-tab" data-pia-tab="diversity" onclick="CortexFreelancer.PortfolioImprovementAnalyzer._switchTab(\'diversity\')">Diversity</button>';
    h += '<button class="pia-tab" data-pia-tab="market" onclick="CortexFreelancer.PortfolioImprovementAnalyzer._switchTab(\'market\')">Market Fit</button>';
    h += '<button class="pia-tab" data-pia-tab="compete" onclick="CortexFreelancer.PortfolioImprovementAnalyzer._switchTab(\'compete\')">Positioning</button>';
    h += '<button class="pia-tab" data-pia-tab="actions" onclick="CortexFreelancer.PortfolioImprovementAnalyzer._switchTab(\'actions\')">Actions</button>';
    h += '</div>';

    if (!analysis) {
      h += _renderEmptyState();
    } else {
      h += _renderOverviewTab(analysis);
      h += _renderStrengthTab(analysis.portfolioStrength);
      h += _renderSkillsTab(analysis.skillGaps);
      h += _renderDiversityTab(analysis.projectDiversity);
      h += _renderMarketTab(analysis.marketAlignment);
      h += _renderCompeteTab(analysis.competitivePosition);
      h += _renderActionsTab(analysis.recommendations);
    }

    h += '<div style="margin-top:1rem;text-align:center">';
    h += '<button class="pia-btn pia-btn-primary" onclick="CortexFreelancer.PortfolioImprovementAnalyzer._runAndRefresh(\'' + containerId + '\')">Run Full Analysis</button>';
    h += '</div>';
    h += '</div>';

    container.innerHTML = h;
  }

  function _renderEmptyState() {
    return '<div class="pia-empty">' +
      '<div class="pia-empty-icon">&#128202;</div>' +
      '<p>No analysis yet. Add portfolio items and run an analysis to get started.</p>' +
      '<p style="font-size:0.8rem;margin-top:0.5rem">Set your skills, target categories, and target rate for the best results.</p>' +
      '</div>';
  }

  function _renderOverviewTab(analysis) {
    var h = '<div class="pia-tab-content active" data-pia-panel="overview">';
    h += _scoreRing(analysis.overallScore, 140);
    h += '<div style="text-align:center;margin-bottom:1rem"><span style="font-size:0.8rem;color:var(--text-dim)">Overall Portfolio Score</span></div>';

    // Sub-scores grid
    h += '<div class="pia-grid">';
    h += _statCard('Strength', analysis.portfolioStrength.score, _scoreColor(analysis.portfolioStrength.score));
    h += _statCard('Skill Coverage', Math.max(0, 100 - analysis.skillGaps.gapSeverity), _scoreColor(100 - analysis.skillGaps.gapSeverity));
    h += _statCard('Diversity', analysis.projectDiversity.score, _scoreColor(analysis.projectDiversity.score));
    h += _statCard('Market Fit', analysis.marketAlignment.score, _scoreColor(analysis.marketAlignment.score));
    h += _statCard('Competitive', analysis.competitivePosition.score, _scoreColor(analysis.competitivePosition.score));
    h += '</div>';

    // Top 3 recommendations
    if (analysis.recommendations.length > 0) {
      h += '<div class="pia-subheader">Top Priorities</div>';
      analysis.recommendations.slice(0, 3).forEach(function (rec) {
        h += '<div class="pia-rec-card">';
        h += '<div class="pia-rec-action">' + _escHtml(rec.action) + '</div>';
        h += '<div class="pia-rec-detail">' + _escHtml(rec.detail) + '</div>';
        h += '<div class="pia-rec-meta"><span class="pia-badge pia-badge-' + rec.priority + '">' + rec.priority + '</span>';
        h += '<span class="pia-tag">' + rec.category + '</span></div>';
        h += '</div>';
      });
    }

    h += '</div>';
    return h;
  }

  function _renderStrengthTab(strength) {
    var h = '<div class="pia-tab-content" data-pia-panel="strength">';
    h += '<div class="pia-subheader">Portfolio Strength: ' + strength.score + '/100</div>';
    h += _bar(strength.score, 100);

    // Breakdown
    if (strength.metrics) {
      var labels = {
        quantity: { label: 'Item Count', max: 15 },
        descriptionQuality: { label: 'Descriptions', max: 20 },
        visuals: { label: 'Visual Assets', max: 15 },
        socialProof: { label: 'Social Proof', max: 15 },
        recency: { label: 'Recency', max: 10 },
        skillsCoverage: { label: 'Skills Coverage', max: 15 },
        completeness: { label: 'Completeness', max: 10 }
      };
      h += '<div style="margin-top:1rem">';
      for (var key in labels) {
        if (strength.metrics[key] !== undefined) {
          var info = labels[key];
          var val = strength.metrics[key];
          h += '<div class="pia-strength-row">';
          h += '<span class="pia-strength-label">' + info.label + '</span>';
          h += '<div class="pia-strength-bar">' + _bar(val, info.max) + '</div>';
          h += '<span class="pia-strength-val" style="color:' + _scoreColor(val / info.max * 100) + '">' + val + '/' + info.max + '</span>';
          h += '</div>';
        }
      }
      h += '</div>';
    }

    // Strengths and issues
    if (strength.strengths.length > 0) {
      h += '<div class="pia-subheader" style="color:#00ff88">Strengths</div><ul class="pia-list">';
      strength.strengths.forEach(function (s) { h += '<li>&#10003; ' + _escHtml(s) + '</li>'; });
      h += '</ul>';
    }
    if (strength.issues.length > 0) {
      h += '<div class="pia-subheader" style="color:#ff8844">Issues</div><ul class="pia-list">';
      strength.issues.forEach(function (s) { h += '<li>&#9888; ' + _escHtml(s) + '</li>'; });
      h += '</ul>';
    }

    h += '</div>';
    return h;
  }

  function _renderSkillsTab(skillGaps) {
    var h = '<div class="pia-tab-content" data-pia-panel="skills">';
    h += '<div class="pia-subheader">Skill Gap Severity: ' + skillGaps.gapSeverity + '%</div>';
    h += _bar(100 - skillGaps.gapSeverity, 100);

    if (skillGaps.gaps.length > 0) {
      h += '<div class="pia-subheader">Missing In-Demand Skills</div><ul class="pia-list">';
      skillGaps.gaps.forEach(function (g) {
        h += '<li><span class="pia-tag pia-tag-gap">' + _escHtml(g.skill) + '</span> <span style="color:var(--text-dim)">' + _escHtml(g.reason) + '</span></li>';
      });
      h += '</ul>';
    }

    if (skillGaps.emergingOpportunities.length > 0) {
      h += '<div class="pia-subheader" style="color:#00c8ff">Emerging Skill Opportunities</div><ul class="pia-list">';
      skillGaps.emergingOpportunities.forEach(function (e) {
        h += '<li><span class="pia-tag pia-tag-match">' + _escHtml(e.skill) + '</span> <span style="color:var(--text-dim)">' + _escHtml(e.reason) + '</span></li>';
      });
      h += '</ul>';
    }

    if (skillGaps.currentSkills.length > 0) {
      h += '<div class="pia-subheader">Your Current Skills</div><div style="display:flex;flex-wrap:wrap;gap:0.3rem">';
      skillGaps.currentSkills.forEach(function (s) {
        var isGap = false;
        skillGaps.gaps.forEach(function (g) { if (g.skill.toLowerCase() === s.toLowerCase()) isGap = true; });
        h += '<span class="pia-tag ' + (isGap ? '' : 'pia-tag-match') + '">' + _escHtml(s) + '</span>';
      });
      h += '</div>';
    }

    h += '</div>';
    return h;
  }

  function _renderDiversityTab(diversity) {
    var h = '<div class="pia-tab-content" data-pia-panel="diversity">';
    h += '<div class="pia-subheader">Project Diversity: ' + diversity.score + '/100</div>';
    h += _bar(diversity.score, 100);

    if (diversity.metrics.typeDistribution) {
      h += '<div class="pia-subheader">Project Types</div>';
      for (var t in diversity.metrics.typeDistribution) {
        var count = diversity.metrics.typeDistribution[t];
        h += '<div class="pia-strength-row">';
        h += '<span class="pia-strength-label">' + _escHtml(t) + '</span>';
        h += '<div class="pia-strength-bar">' + _bar(count, Math.max(5, diversity.metrics.uniqueTypes + 2), '#00c8ff') + '</div>';
        h += '<span class="pia-strength-val">' + count + '</span>';
        h += '</div>';
      }
    }

    if (diversity.metrics.industryDistribution) {
      h += '<div class="pia-subheader">Industries</div>';
      for (var ind in diversity.metrics.industryDistribution) {
        var cnt = diversity.metrics.industryDistribution[ind];
        h += '<div class="pia-strength-row">';
        h += '<span class="pia-strength-label">' + _escHtml(ind) + '</span>';
        h += '<div class="pia-strength-bar">' + _bar(cnt, Math.max(5, diversity.metrics.uniqueIndustries + 2), '#ffc832') + '</div>';
        h += '<span class="pia-strength-val">' + cnt + '</span>';
        h += '</div>';
      }
    }

    // Strengths and issues
    if (diversity.strengths.length > 0) {
      h += '<div class="pia-subheader" style="color:#00ff88">Strengths</div><ul class="pia-list">';
      diversity.strengths.forEach(function (s) { h += '<li>&#10003; ' + _escHtml(s) + '</li>'; });
      h += '</ul>';
    }
    if (diversity.issues.length > 0) {
      h += '<div class="pia-subheader" style="color:#ff8844">Issues</div><ul class="pia-list">';
      diversity.issues.forEach(function (s) { h += '<li>&#9888; ' + _escHtml(s) + '</li>'; });
      h += '</ul>';
    }

    h += '</div>';
    return h;
  }

  function _renderMarketTab(market) {
    var h = '<div class="pia-tab-content" data-pia-panel="market">';
    h += '<div class="pia-subheader">Market Alignment: ' + market.score + '/100</div>';
    h += _bar(market.score, 100);

    // Category alignment
    if (market.alignedCategories.length > 0) {
      h += '<div class="pia-subheader">Category Alignment</div>';
      market.alignedCategories.forEach(function (cat) {
        h += '<div class="pia-rec-card">';
        h += '<div style="display:flex;justify-content:space-between;align-items:center">';
        h += '<span class="pia-rec-action">' + _escHtml(cat.label) + '</span>';
        h += '<span class="pia-trend-badge pia-trend-' + cat.demandTrend + '">' + _trendIcon(cat.demandTrend) + ' ' + cat.demandTrend + '</span>';
        h += '</div>';
        h += '<div style="margin:0.4rem 0">' + _bar(cat.matchPercent, 100) + '</div>';
        h += '<div style="display:flex;justify-content:space-between;font-size:0.75rem;color:var(--text-dim)">';
        h += '<span>' + cat.matchedSkills + '/' + cat.totalRequired + ' skills matched</span>';
        h += '<span style="color:' + _scoreColor(cat.matchPercent) + '">' + cat.matchPercent + '% aligned</span>';
        h += '</div>';
        h += '<div style="font-size:0.7rem;color:var(--text-dim);margin-top:0.3rem">Market saturation: ' + Math.round(cat.saturation * 100) + '%</div>';
        h += '</div>';
      });
    }

    // Rate analysis
    if (market.rateAnalysis) {
      var ra = market.rateAnalysis;
      var rateColor = ra.position === 'premium' ? '#ff8844' : ra.position === 'below-market' ? '#ff3c3c' : '#00ff88';
      h += '<div class="pia-subheader">Rate Positioning</div>';
      h += '<div class="pia-rec-card">';
      h += '<div class="pia-grid">';
      h += _statCard('Your Rate', '$' + ra.targetRate + '/hr', rateColor);
      h += _statCard('Market Avg', '$' + ra.marketAverage + '/hr', 'var(--text-dim)');
      h += _statCard('Position', ra.position.replace('-', ' '), rateColor);
      h += '</div></div>';
    }

    // Trend insights
    if (market.trendInsights.length > 0) {
      h += '<div class="pia-subheader">Market Insights</div><ul class="pia-list">';
      market.trendInsights.forEach(function (t) { h += '<li>&#128200; ' + _escHtml(t) + '</li>'; });
      h += '</ul>';
    }

    // Saturation warnings
    if (market.saturationWarnings.length > 0) {
      h += '<div class="pia-subheader" style="color:#ff8844">Saturation Warnings</div><ul class="pia-list">';
      market.saturationWarnings.forEach(function (w) { h += '<li>&#9888; ' + _escHtml(w) + '</li>'; });
      h += '</ul>';
    }

    h += '</div>';
    return h;
  }

  function _renderCompeteTab(compete) {
    var h = '<div class="pia-tab-content" data-pia-panel="compete">';
    h += '<div class="pia-subheader">Competitive Position: ' + compete.score + '/100</div>';
    h += _bar(compete.score, 100);

    // Edge type
    var edgeLabels = {
      specialist: 'Results-Driven Specialist',
      generalist: 'Versatile Generalist',
      emerging: 'Emerging Talent',
      growing: 'Growing Professional',
      unknown: 'Not Yet Assessed'
    };
    h += '<div style="text-align:center;margin:0.75rem 0"><span class="pia-badge pia-badge-low" style="font-size:0.8rem;padding:0.3rem 0.8rem">' + (edgeLabels[compete.competitiveEdge] || 'Unknown') + '</span></div>';

    // Differentiators
    if (compete.differentiators.length > 0) {
      h += '<div class="pia-subheader" style="color:#00ff88">Your Differentiators</div><ul class="pia-list">';
      compete.differentiators.forEach(function (d) {
        h += '<li><strong>' + _escHtml(d.factor) + ':</strong> ' + _escHtml(d.detail) + '</li>';
      });
      h += '</ul>';
    }

    // Weaknesses
    if (compete.weaknesses.length > 0) {
      h += '<div class="pia-subheader" style="color:#ff8844">Areas to Improve</div><ul class="pia-list">';
      compete.weaknesses.forEach(function (w) {
        h += '<li><strong>' + _escHtml(w.factor) + ':</strong> ' + _escHtml(w.detail) + '</li>';
      });
      h += '</ul>';
    }

    // Niche potential
    if (compete.nichePotential.length > 0) {
      h += '<div class="pia-subheader" style="color:#00c8ff">Niche Opportunities</div>';
      compete.nichePotential.forEach(function (n) {
        h += '<div class="pia-rec-card">';
        h += '<div class="pia-rec-action">' + _escHtml(n.niche) + '</div>';
        h += '<div class="pia-rec-detail">' + _escHtml(n.reason) + '</div>';
        h += '<div style="margin-top:0.3rem">';
        n.skills.forEach(function (s) { h += '<span class="pia-tag pia-tag-match" style="margin-right:0.25rem">' + _escHtml(s) + '</span>'; });
        h += '<span class="pia-badge pia-badge-' + (n.potential === 'very-high' ? 'low' : n.potential === 'high' ? 'medium' : 'high') + '">' + n.potential + ' potential</span>';
        h += '</div></div>';
      });
    }

    // Positioning advice
    if (compete.positioningAdvice.length > 0) {
      h += '<div class="pia-subheader">Positioning Strategy</div><ul class="pia-list">';
      compete.positioningAdvice.forEach(function (a) { h += '<li>&#128161; ' + _escHtml(a) + '</li>'; });
      h += '</ul>';
    }

    h += '</div>';
    return h;
  }

  function _renderActionsTab(recs) {
    var h = '<div class="pia-tab-content" data-pia-panel="actions">';
    h += '<div class="pia-subheader">Action Plan (' + recs.length + ' recommendations)</div>';

    if (recs.length === 0) {
      h += '<div class="pia-empty"><p>No recommendations — your portfolio looks great!</p></div>';
    }

    recs.forEach(function (rec, idx) {
      h += '<div class="pia-rec-card">';
      h += '<div style="display:flex;justify-content:space-between;align-items:flex-start">';
      h += '<div class="pia-rec-action"><span style="color:var(--text-dim);margin-right:0.3rem">' + (idx + 1) + '.</span>' + _escHtml(rec.action) + '</div>';
      h += '<span class="pia-badge pia-badge-' + rec.priority + '">' + rec.priority + '</span>';
      h += '</div>';
      h += '<div class="pia-rec-detail">' + _escHtml(rec.detail) + '</div>';
      h += '<div class="pia-rec-meta">';
      h += '<span class="pia-tag">' + rec.category + '</span>';
      h += '<span class="pia-tag">impact: ' + rec.impact + '</span>';
      h += '</div></div>';
    });

    h += '</div>';
    return h;
  }

  function _statCard(label, value, color) {
    return '<div class="pia-stat">' +
      '<div class="pia-stat-value" style="color:' + (color || 'var(--text-bright)') + '">' + value + '</div>' +
      '<div class="pia-stat-label">' + _escHtml(label) + '</div></div>';
  }

  function _escHtml(str) {
    var div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  // ─── Tab Switching ───────────────────────────────────────────

  function _switchTab(tabName) {
    var tabs = document.querySelectorAll('.pia-tab');
    var panels = document.querySelectorAll('.pia-tab-content');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].classList.toggle('active', tabs[i].getAttribute('data-pia-tab') === tabName);
    }
    for (var j = 0; j < panels.length; j++) {
      panels[j].classList.toggle('active', panels[j].getAttribute('data-pia-panel') === tabName);
    }
  }

  function _runAndRefresh(containerId) {
    runFullAnalysis();
    renderDashboard(containerId);
  }

  // ─── CLI Support ─────────────────────────────────────────────

  function printHelp() {
    return [
      'Portfolio Improvement Analyzer — Commands:',
      '  analyze              Run full portfolio analysis',
      '  add-item <json>      Add a portfolio item',
      '  remove-item <id>     Remove a portfolio item',
      '  update-profile <json> Update skills, categories, rate',
      '  get-analysis         Get latest analysis results',
      '  get-portfolio        Get current portfolio data',
      '  help                 Show this help'
    ].join('\n');
  }

  function main(args) {
    if (!args || args.length === 0 || args[0] === 'help') return printHelp();

    switch (args[0]) {
      case 'analyze':
        return JSON.stringify(runFullAnalysis(), null, 2);
      case 'add-item':
        try { return JSON.stringify(addPortfolioItem(JSON.parse(args.slice(1).join(' '))), null, 2); }
        catch (e) { return 'Error: invalid JSON — ' + e.message; }
      case 'remove-item':
        removePortfolioItem(args[1]);
        return 'Removed item ' + args[1];
      case 'update-profile':
        try { return JSON.stringify(updateProfile(JSON.parse(args.slice(1).join(' '))), null, 2); }
        catch (e) { return 'Error: invalid JSON — ' + e.message; }
      case 'get-analysis':
        var data = getData();
        return data.analyses.length > 0 ? JSON.stringify(data.analyses[0], null, 2) : 'No analysis found. Run "analyze" first.';
      case 'get-portfolio':
        return JSON.stringify(getData().portfolio, null, 2);
      default:
        return 'Unknown command: ' + args[0] + '\n' + printHelp();
    }
  }

  // ─── Export ──────────────────────────────────────────────────

  CF.PortfolioImprovementAnalyzer = {
    // Core
    runFullAnalysis: runFullAnalysis,
    addPortfolioItem: addPortfolioItem,
    removePortfolioItem: removePortfolioItem,
    updateProfile: updateProfile,
    getData: getData,

    // UI
    renderDashboard: renderDashboard,
    _switchTab: _switchTab,
    _runAndRefresh: _runAndRefresh,

    // CLI
    main: main,
    printHelp: printHelp,

    // Constants
    MARKET_CATEGORIES: MARKET_CATEGORIES,
    PROJECT_TYPES: PROJECT_TYPES,
    INDUSTRY_SECTORS: INDUSTRY_SECTORS
  };

})();
