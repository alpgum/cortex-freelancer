/**
 * CFX-052: Dynamic Rate Calculator with Real-Time Market Research
 * AI-powered pricing analysis: project complexity, client budget signals,
 * confidence intervals, and negotiation guidance.
 */

const { cors } = require('./middleware/cors');
const { rateLimit } = require('./middleware/rate-limit');
const { sanitize } = require('./middleware/sanitize');
const { withErrorHandler, sendError } = require('./middleware/error-handler');
const { askClaude, getApiKey } = require('./lib/claude');

// ── System Prompt ───────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a freelance pricing strategist with deep expertise in global freelance markets (Upwork, Toptal, Fiverr, direct clients). You analyze project details, client signals, and market conditions to recommend optimal pricing strategies.

Respond ONLY in JSON (no markdown, no commentary) with this exact structure:
{
  "recommendedRate": <number, $/hr>,
  "confidenceInterval": { "low": <number>, "high": <number>, "confidence": <number 0-100> },
  "pricingStrategy": "<value-based|competitive|premium|penetration>",
  "strategyRationale": "<2-3 sentence explanation of why this strategy>",
  "projectEstimate": {
    "totalHours": <number>,
    "totalPrice": <number>,
    "breakdown": [
      { "phase": "<phase name>", "hours": <number>, "description": "<brief>" }
    ]
  },
  "clientBudgetAnalysis": {
    "estimatedBudget": "<low|medium|high|enterprise>",
    "signals": ["<signal 1>", "<signal 2>"],
    "willingnessToPayPremium": <number 0-100>
  },
  "negotiationPlaybook": {
    "openingRate": <number, $/hr>,
    "minimumRate": <number, $/hr>,
    "anchorStatement": "<what to say when presenting your rate>",
    "objectionHandlers": [
      { "objection": "<common objection>", "response": "<suggested response>" }
    ],
    "walkAwaySignals": ["<red flag 1>", "<red flag 2>"]
  },
  "marketInsights": {
    "demandLevel": "<hot|growing|stable|declining>",
    "supplyLevel": "<scarce|balanced|saturated>",
    "trendDirection": "<up|stable|down>",
    "keyInsight": "<1-2 sentence market observation>"
  },
  "upsellOpportunities": ["<opportunity 1>", "<opportunity 2>"]
}

Guidelines:
- Base recommendations on real freelance market dynamics
- Factor in experience level, location cost-of-living, and skill demand
- Consider project complexity: simple CRUD vs complex architecture vs R&D
- Client type matters: startup vs enterprise vs agency vs individual
- Always provide a realistic confidence interval
- Negotiation advice should be practical and copy-pasteable
- Account for platform fees (Upwork ~10%, Fiverr ~20%) in take-home calculations`;

// ── Market Data Constants ───────────────────────────────────────────────

const BASE_RATES = {
  'web-development':    { junior: 22, mid: 45, senior: 75, expert: 110 },
  'mobile-development': { junior: 25, mid: 50, senior: 85, expert: 120 },
  'design':             { junior: 18, mid: 38, senior: 65, expert: 95 },
  'graphic-design':     { junior: 15, mid: 30, senior: 52, expert: 75 },
  'writing':            { junior: 12, mid: 25, senior: 45, expert: 68 },
  'data-science':       { junior: 30, mid: 55, senior: 95, expert: 140 },
  'devops':             { junior: 28, mid: 48, senior: 85, expert: 125 },
  'cybersecurity':      { junior: 35, mid: 60, senior: 100, expert: 150 },
  'marketing':          { junior: 15, mid: 32, senior: 55, expert: 80 },
  'seo':                { junior: 14, mid: 28, senior: 48, expert: 72 },
  'social-media':       { junior: 12, mid: 24, senior: 42, expert: 60 },
  'video':              { junior: 16, mid: 30, senior: 50, expert: 75 },
  '3d-modeling':        { junior: 20, mid: 40, senior: 68, expert: 100 },
  'game-dev':           { junior: 25, mid: 48, senior: 80, expert: 115 },
  'product-management': { junior: 22, mid: 42, senior: 75, expert: 108 },
  'ecommerce':          { junior: 18, mid: 35, senior: 58, expert: 85 },
  'translation':        { junior: 10, mid: 20, senior: 38, expert: 55 },
  'blockchain':         { junior: 35, mid: 60, senior: 105, expert: 160 },
  'ar-vr':              { junior: 32, mid: 55, senior: 92, expert: 135 },
  'qa':                 { junior: 16, mid: 32, senior: 54, expert: 78 },
};

const COL_MULTIPLIER = {
  egypt: 0.42, turkey: 0.52, pakistan: 0.36, india: 0.44, nigeria: 0.40,
  philippines: 0.38, bangladesh: 0.30, brazil: 0.58, vietnam: 0.40,
  indonesia: 0.38, mexico: 0.55, ukraine: 0.52, kenya: 0.38,
  us: 1.0, uk: 0.88, de: 0.82, eu: 0.72
};

const COMPLEXITY_MULTIPLIER = {
  simple: 0.85,
  moderate: 1.0,
  complex: 1.25,
  expert: 1.5,
  research: 1.75
};

const CLIENT_TYPE_MULTIPLIER = {
  individual: 0.85,
  startup: 0.95,
  agency: 1.0,
  smb: 1.05,
  enterprise: 1.25,
  government: 1.15
};

const URGENCY_MULTIPLIER = {
  relaxed: 0.95,
  normal: 1.0,
  tight: 1.15,
  rush: 1.35
};

// CF3-004: Regional Market Intelligence Data
const REGIONAL_INTELLIGENCE = {
  turkey: {
    demandMultiplier: { 'web-development': 1.06, 'mobile-development': 1.08, 'data-science': 1.12, 'game-dev': 1.12, 'cybersecurity': 1.08, 'devops': 1.07 },
    topEarnerRate: 55,
    avgProposalsPerJob: 28,
    competitionLevel: 'moderate',
    currencyAdvantage: 'TRY depreciation makes rates 12% more competitive YoY',
    topCities: ['Istanbul (+15%)', 'Ankara (baseline)', 'Izmir (-8%)'],
    marketNotes: 'Strong tech talent pool. EU clients increasingly sourcing from Turkey. Gaming and mobile sectors booming.'
  },
  egypt: {
    demandMultiplier: { 'web-development': 1.05, 'mobile-development': 1.06, 'writing': 1.0, 'design': 1.04 },
    topEarnerRate: 40,
    avgProposalsPerJob: 35,
    competitionLevel: 'high',
    currencyAdvantage: 'EGP devaluation creates strong purchasing power for USD earners',
    topCities: ['Cairo (+12%)', 'Alexandria (-5%)'],
    marketNotes: 'Large English-speaking talent pool. Growing mobile dev community. Strong in content writing.'
  },
  pakistan: {
    demandMultiplier: { 'web-development': 1.04, 'mobile-development': 1.05, 'seo': 1.0, 'data-science': 1.08 },
    topEarnerRate: 35,
    avgProposalsPerJob: 45,
    competitionLevel: 'very-high',
    currencyAdvantage: 'Very low COL means even moderate USD rates provide premium lifestyle',
    topCities: ['Islamabad (+15%)', 'Lahore (+10%)', 'Karachi (+8%)'],
    marketNotes: 'Fastest-growing freelance market. WordPress and Laravel dominant. Government IT initiatives driving growth.'
  },
  india: {
    demandMultiplier: { 'data-science': 1.10, 'devops': 1.07, 'mobile-development': 1.05, 'web-development': 1.03 },
    topEarnerRate: 45,
    avgProposalsPerJob: 50,
    competitionLevel: 'very-high',
    currencyAdvantage: 'Strong IT services background. Bangalore and Hyderabad command premium rates',
    topCities: ['Bangalore (+20%)', 'Mumbai (+15%)', 'Delhi (+10%)', 'Hyderabad (+8%)'],
    marketNotes: 'Largest freelance talent pool. Deep enterprise tech expertise. AI talent in very high demand.'
  },
  nigeria: {
    demandMultiplier: { 'web-development': 1.07, 'mobile-development': 1.06, 'blockchain': 1.08, 'writing': 1.0 },
    topEarnerRate: 38,
    avgProposalsPerJob: 30,
    competitionLevel: 'moderate',
    currencyAdvantage: 'Growing tech ecosystem with fintech driving developer demand',
    topCities: ['Lagos (+15%)', 'Abuja (baseline)'],
    marketNotes: 'Rapidly growing tech ecosystem. Strong English-language content creation. Fintech boom.'
  }
};

// ── Rule-Based Fallback Engine ──────────────────────────────────────────

function calculateDynamicRate(input) {
  const {
    skill = 'web-development',
    experience = 4,
    country = 'turkey',
    complexity = 'moderate',
    clientType = 'startup',
    urgency = 'normal',
    projectDescription = '',
    projectDuration = 'medium',
    techStack = [],
    currentRate = 0
  } = input;

  // Determine experience tier
  const tier = experience <= 2 ? 'junior' : experience <= 5 ? 'mid' : experience <= 8 ? 'senior' : 'expert';
  const baseRate = (BASE_RATES[skill] || BASE_RATES['web-development'])[tier];

  // Apply multipliers
  const colMult = COL_MULTIPLIER[country] || 0.5;
  const compMult = COMPLEXITY_MULTIPLIER[complexity] || 1.0;
  const clientMult = CLIENT_TYPE_MULTIPLIER[clientType] || 1.0;
  const urgMult = URGENCY_MULTIPLIER[urgency] || 1.0;

  // Niche tech stack bonus
  const nicheKeywords = ['rust', 'go', 'elixir', 'haskell', 'scala', 'kubernetes', 'terraform', 'solidity', 'webgl', 'threejs', 'machine learning', 'computer vision', 'nlp', 'reinforcement learning'];
  const nicheBonus = techStack.some(t => nicheKeywords.some(k => t.toLowerCase().includes(k))) ? 1.12 : 1.0;

  // CF3-004: Regional demand multiplier
  const regionalData = REGIONAL_INTELLIGENCE[country];
  const demandMult = (regionalData && regionalData.demandMultiplier[skill]) || 1.0;

  // Calculate recommended rate
  let recommended = Math.round(baseRate * colMult * compMult * clientMult * urgMult * nicheBonus * demandMult);

  // Confidence interval
  const spread = complexity === 'simple' ? 0.12 : complexity === 'complex' ? 0.22 : complexity === 'expert' ? 0.28 : 0.16;
  const confidence = tier === 'expert' ? 72 : tier === 'senior' ? 78 : 82;
  const low = Math.round(recommended * (1 - spread));
  const high = Math.round(recommended * (1 + spread));

  // Pricing strategy
  let strategy, strategyRationale;
  if (clientType === 'enterprise' || complexity === 'expert') {
    strategy = 'value-based';
    strategyRationale = `Enterprise/complex projects benefit from value-based pricing. Your expertise in ${skill} commands a premium — focus on ROI delivered, not hours spent. Position your rate against the cost of failure or delay.`;
  } else if (currentRate > 0 && currentRate < low) {
    strategy = 'competitive';
    strategyRationale = `Your current rate of $${currentRate}/hr is below market. A competitive pricing strategy lets you incrementally raise rates (10-15% per new client) while maintaining win rates. Target ${recommended > currentRate ? `$${recommended}/hr` : 'market rate'} within 2-3 months.`;
  } else if (urgency === 'rush') {
    strategy = 'premium';
    strategyRationale = `Rush projects justify premium pricing. Your availability and speed are the value proposition. Clients requesting urgent delivery expect to pay 25-40% above standard rates.`;
  } else {
    strategy = 'competitive';
    strategyRationale = `For ${complexity} ${skill} projects with ${clientType} clients, competitive pricing wins. Price within the market range ($${low}-$${high}/hr) and differentiate on quality, communication, and reliability.`;
  }

  // Project hours estimation
  const durationHours = {
    micro: { total: 10, phases: [{ phase: 'Implementation', hours: 8 }, { phase: 'Review & Deploy', hours: 2 }] },
    small: { total: 30, phases: [{ phase: 'Planning', hours: 4 }, { phase: 'Implementation', hours: 20 }, { phase: 'Testing & QA', hours: 4 }, { phase: 'Review & Deploy', hours: 2 }] },
    medium: { total: 80, phases: [{ phase: 'Discovery & Planning', hours: 8 }, { phase: 'Design/Architecture', hours: 12 }, { phase: 'Implementation', hours: 44 }, { phase: 'Testing & QA', hours: 10 }, { phase: 'Review & Deploy', hours: 6 }] },
    large: { total: 200, phases: [{ phase: 'Discovery & Planning', hours: 16 }, { phase: 'Architecture & Design', hours: 24 }, { phase: 'Implementation', hours: 120 }, { phase: 'Testing & QA', hours: 24 }, { phase: 'Code Review & Optimization', hours: 8 }, { phase: 'Deployment & Documentation', hours: 8 }] },
    enterprise: { total: 500, phases: [{ phase: 'Discovery & Requirements', hours: 40 }, { phase: 'Architecture & Design', hours: 60 }, { phase: 'Implementation Sprint 1-3', hours: 280 }, { phase: 'Testing & QA', hours: 60 }, { phase: 'Performance Optimization', hours: 20 }, { phase: 'Deployment & Handoff', hours: 40 }] }
  };

  const durData = durationHours[projectDuration] || durationHours.medium;
  const complexityHoursMult = complexity === 'simple' ? 0.8 : complexity === 'complex' ? 1.3 : complexity === 'expert' ? 1.6 : 1.0;
  const totalHours = Math.round(durData.total * complexityHoursMult);
  const hourRatio = totalHours / durData.total;
  const breakdown = durData.phases.map(p => ({
    phase: p.phase,
    hours: Math.round(p.hours * hourRatio),
    description: p.phase
  }));

  // Client budget analysis
  const budgetMap = { individual: 'low', startup: 'medium', agency: 'medium', smb: 'medium', enterprise: 'high', government: 'high' };
  const estimatedBudget = budgetMap[clientType] || 'medium';
  const budgetSignals = [];
  if (clientType === 'enterprise') budgetSignals.push('Enterprise clients typically have established budgets for technical projects');
  if (urgency === 'rush') budgetSignals.push('Rush timeline suggests willingness to pay premium for availability');
  if (complexity === 'expert' || complexity === 'research') budgetSignals.push('Complex/research projects indicate understanding of specialized expertise value');
  if (projectDuration === 'large' || projectDuration === 'enterprise') budgetSignals.push('Large project scope suggests committed budget allocation');
  if (budgetSignals.length === 0) budgetSignals.push('Standard market expectations for this project type');

  const wtpBase = { individual: 30, startup: 50, agency: 55, smb: 60, enterprise: 80, government: 65 };
  const willingness = Math.min(95, (wtpBase[clientType] || 50) + (urgency === 'rush' ? 15 : 0) + (complexity === 'expert' ? 10 : 0));

  // Negotiation playbook
  const openingRate = Math.round(recommended * 1.15);
  const minimumRate = Math.round(recommended * 0.85);

  const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);
  const anchorStatement = `Based on my ${experience}+ years of experience in ${skill.replace(/-/g, ' ')} and the ${complexity} nature of this project, my rate is $${openingRate}/hr. This includes thorough testing, clean documentation, and post-delivery support. For a project of this scope, the total investment would be approximately $${openingRate * totalHours}.`;

  const objectionHandlers = [
    {
      objection: "That's above our budget",
      response: `I understand budget is important. Let's look at this differently — at $${recommended}/hr, I deliver production-ready work with fewer revision cycles. We could also phase the project: start with the core ${breakdown[0]?.phase || 'deliverable'} at $${recommended * Math.round(totalHours * 0.4)} and expand from there.`
    },
    {
      objection: "We found someone cheaper",
      response: `Price is one factor, but the total cost includes revision time, communication overhead, and reliability. My ${tier}-level expertise means faster delivery and fewer bugs. ${currentRate > 0 ? `My clients consistently return — quality pays for itself.` : `I'm happy to share references from similar projects.`}`
    },
    {
      objection: "Can you do it for a fixed price?",
      response: `Absolutely. For the full scope as discussed, I'd quote $${recommended * totalHours} fixed. This includes ${breakdown.length} phases with clear milestones and deliverables at each stage. We can structure payments around those milestones for mutual protection.`
    }
  ];

  const walkAwaySignals = [
    'Client insists on rate below $' + Math.round(minimumRate * 0.8) + '/hr — unsustainable',
    'Requests unlimited revisions without scope definition',
    'Refuses escrow or milestone-based payments',
    'Vague requirements with fixed budget — scope creep risk'
  ];

  // Market insights
  const demandLevels = {
    'data-science': 'hot', 'cybersecurity': 'hot', 'blockchain': 'hot', 'ar-vr': 'hot',
    'devops': 'hot', 'web-development': 'growing', 'mobile-development': 'growing',
    'design': 'growing', 'product-management': 'growing',
    'writing': 'stable', 'translation': 'declining', 'graphic-design': 'stable'
  };
  const supplyLevels = {
    'cybersecurity': 'scarce', 'blockchain': 'scarce', 'ar-vr': 'scarce',
    'data-science': 'balanced', 'devops': 'balanced',
    'web-development': 'saturated', 'graphic-design': 'saturated', 'writing': 'saturated'
  };

  const demandLevel = demandLevels[skill] || 'stable';
  const supplyLevel = supplyLevels[skill] || 'balanced';
  const trendDirection = ['hot', 'growing'].includes(demandLevel) ? 'up' : demandLevel === 'declining' ? 'down' : 'stable';
  const skillLabel = skill.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const keyInsight = trendDirection === 'up'
    ? `${skillLabel} demand is rising, with ${supplyLevel === 'scarce' ? 'limited talent supply creating upward rate pressure' : 'growing opportunities for skilled freelancers'}. Position yourself as a specialist to command premium rates.`
    : trendDirection === 'down'
    ? `${skillLabel} faces increased automation and competition. Differentiate by combining with adjacent skills or targeting enterprise clients who value reliability.`
    : `${skillLabel} market is steady. Focus on building long-term client relationships and niche expertise to stand out in a ${supplyLevel} market.`;

  // Upsell opportunities
  const upsells = [];
  if (skill === 'web-development') upsells.push('Ongoing maintenance retainer ($X/mo for bug fixes + small updates)', 'Performance optimization audit (+$' + Math.round(recommended * 8) + ')');
  else if (skill === 'design') upsells.push('Design system documentation (+$' + Math.round(recommended * 12) + ')', 'Quarterly design refresh retainer');
  else if (skill === 'data-science') upsells.push('Model monitoring & retraining retainer', 'Executive dashboard development (+$' + Math.round(recommended * 16) + ')');
  else upsells.push('Post-launch support package (2 weeks @ 50% rate)', 'Documentation & knowledge transfer session (+$' + Math.round(recommended * 4) + ')');
  if (totalHours > 80) upsells.push('Phased delivery with milestone payments for budget predictability');

  // CF3-004: Regional intelligence
  const regionalIntel = regionalData ? {
    competitionLevel: regionalData.competitionLevel,
    avgProposalsPerJob: regionalData.avgProposalsPerJob,
    topEarnerRate: regionalData.topEarnerRate,
    currencyAdvantage: regionalData.currencyAdvantage,
    topCities: regionalData.topCities,
    marketNotes: regionalData.marketNotes,
    demandAdjustment: demandMult > 1.0 ? `+${Math.round((demandMult - 1) * 100)}% demand premium for ${skillLabel} in this market` : null
  } : null;

  return {
    recommendedRate: recommended,
    confidenceInterval: { low, high, confidence },
    pricingStrategy: strategy,
    strategyRationale: strategyRationale,
    projectEstimate: {
      totalHours,
      totalPrice: recommended * totalHours,
      breakdown
    },
    clientBudgetAnalysis: {
      estimatedBudget,
      signals: budgetSignals,
      willingnessToPayPremium: willingness
    },
    negotiationPlaybook: {
      openingRate,
      minimumRate,
      anchorStatement,
      objectionHandlers,
      walkAwaySignals
    },
    marketInsights: {
      demandLevel,
      supplyLevel,
      trendDirection,
      keyInsight
    },
    upsellOpportunities: upsells,
    regionalIntelligence: regionalIntel
  };
}

// ── Build AI Prompt ─────────────────────────────────────────────────────

function buildUserMessage(input) {
  const lines = [];
  lines.push(`Skill: ${input.skill || 'web-development'}`);
  lines.push(`Experience: ${input.experience || 4} years`);
  lines.push(`Location: ${input.country || 'turkey'}`);
  lines.push(`Project Complexity: ${input.complexity || 'moderate'}`);
  lines.push(`Client Type: ${input.clientType || 'startup'}`);
  lines.push(`Urgency: ${input.urgency || 'normal'}`);
  lines.push(`Project Duration: ${input.projectDuration || 'medium'}`);
  if (input.currentRate) lines.push(`Current Rate: $${input.currentRate}/hr`);
  if (input.techStack && input.techStack.length) lines.push(`Tech Stack: ${input.techStack.join(', ')}`);
  if (input.projectDescription) lines.push(`Project Description: ${input.projectDescription}`);
  if (input.jobPostingText) lines.push(`Job Posting Text (analyze for budget signals): ${input.jobPostingText}`);
  return lines.join('\n');
}

// ── Handler ─────────────────────────────────────────────────────────────

async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method not allowed');
  }

  const input = req.body || {};

  if (!input.skill || !input.country) {
    return sendError(res, 400, 'skill and country are required');
  }

  // Try AI-powered analysis first
  if (getApiKey()) {
    try {
      const userMessage = buildUserMessage(input);
      const result = await askClaude(SYSTEM_PROMPT, userMessage, {
        maxTokens: 2500,
        timeout: 45000
      });

      if (result && result.recommendedRate) {
        return res.status(200).json({
          success: true,
          ...result,
          source: 'ai'
        });
      }
    } catch (err) {
      console.warn('Claude dynamic-rate failed, using fallback:', err.message);
    }
  }

  // Fallback: rule-based calculation
  const result = calculateDynamicRate(input);

  return res.status(200).json({
    success: true,
    ...result,
    source: 'engine'
  });
}

module.exports = withErrorHandler(async (req, res) => {
  await cors(req, res);
  await rateLimit(req, res, { max: 10, windowSec: 60 });
  sanitize(req);
  return handler(req, res);
});
