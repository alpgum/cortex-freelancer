const { cors } = require('./middleware/cors');
const { rateLimit } = require('./middleware/rate-limit');
const { sanitize } = require('./middleware/sanitize');
const { withErrorHandler, sendError } = require('./middleware/error-handler');

// ── Client Intelligence Extraction ──
// Extracts company/client signals from job description and optional client name

const INDUSTRY_SIGNALS = {
  fintech: ['payment', 'banking', 'fintech', 'crypto', 'blockchain', 'defi', 'wallet', 'trading', 'forex', 'lending', 'insurance'],
  saas: ['saas', 'subscription', 'dashboard', 'multi-tenant', 'onboarding', 'churn', 'mrr', 'b2b', 'platform'],
  ecommerce: ['ecommerce', 'e-commerce', 'store', 'shopify', 'woocommerce', 'cart', 'checkout', 'product listing', 'inventory'],
  healthcare: ['health', 'medical', 'hipaa', 'patient', 'telemedicine', 'ehr', 'clinical', 'pharma'],
  education: ['edtech', 'learning', 'course', 'lms', 'student', 'education', 'training', 'e-learning'],
  media: ['media', 'content', 'publishing', 'news', 'cms', 'editorial', 'streaming', 'podcast'],
  marketplace: ['marketplace', 'two-sided', 'buyer', 'seller', 'listing', 'matching', 'booking'],
  ai: ['ai', 'machine learning', 'ml', 'nlp', 'gpt', 'chatbot', 'automation', 'llm', 'deep learning'],
  gaming: ['game', 'gaming', 'unity', 'unreal', 'multiplayer', 'leaderboard', 'in-app purchase'],
  real_estate: ['real estate', 'property', 'listing', 'mls', 'rental', 'mortgage', 'proptech'],
};

const COMPANY_STAGE_SIGNALS = {
  early_stage: ['mvp', 'prototype', 'idea', 'validate', 'pre-seed', 'seed', 'bootstrapped', 'first version', 'proof of concept', 'co-founder'],
  growth: ['scaling', 'series a', 'series b', 'growing team', 'expanding', 'product-market fit', 'traction', 'revenue'],
  established: ['enterprise', 'fortune 500', 'established', 'large team', 'compliance', 'legacy', 'migration', 'replatform', 'mature'],
  agency: ['agency', 'our client', 'white label', 'multiple clients', 'retainer', 'deliverables'],
};

const PAIN_POINT_PATTERNS = [
  { pattern: /(?:struggling|problem|issue|challenge|pain|frustrat)\w*\s+(?:with\s+)?([^.!?\n]{10,80})/gi, type: 'explicit_pain' },
  { pattern: /(?:current|existing)\s+(?:solution|system|platform|app|website)\s+(?:is|doesn't|can't|won't|isn't)\s+([^.!?\n]{10,60})/gi, type: 'current_limitation' },
  { pattern: /(?:need|want|looking for|require)\s+(?:someone|a freelancer|a developer|help)\s+(?:to|who can)\s+([^.!?\n]{10,80})/gi, type: 'requirement' },
  { pattern: /(?:deadline|launch|go live|deliver)\s+(?:by|before|on|is)\s+([^.!?\n]{5,40})/gi, type: 'timeline_pressure' },
  { pattern: /(?:budget|willing to pay|invest)\s+(?:is|of|around|up to)\s+([^.!?\n]{5,40})/gi, type: 'budget_signal' },
];

const DECISION_MAKER_SIGNALS = {
  technical: ['cto', 'tech lead', 'developer', 'engineer', 'architect', 'devops'],
  business: ['ceo', 'founder', 'co-founder', 'owner', 'director', 'manager', 'vp'],
  product: ['product manager', 'product owner', 'pm', 'ux', 'designer'],
  procurement: ['procurement', 'vendor', 'rfp', 'rfi', 'proposal', 'bid'],
};

function extractClientIntelligence(jobDescription, clientName) {
  const desc = (jobDescription || '').toLowerCase();

  // Industry detection
  const industryScores = {};
  for (const [industry, signals] of Object.entries(INDUSTRY_SIGNALS)) {
    let score = 0;
    const matched = [];
    for (const signal of signals) {
      if (desc.includes(signal)) { score++; matched.push(signal); }
    }
    if (score > 0) industryScores[industry] = { score, matched };
  }
  const topIndustry = Object.entries(industryScores)
    .sort((a, b) => b[1].score - a[1].score)[0];

  // Company stage
  const stageScores = {};
  for (const [stage, signals] of Object.entries(COMPANY_STAGE_SIGNALS)) {
    let score = 0;
    const matched = [];
    for (const signal of signals) {
      if (desc.includes(signal)) { score++; matched.push(signal); }
    }
    if (score > 0) stageScores[stage] = { score, matched };
  }
  const topStage = Object.entries(stageScores)
    .sort((a, b) => b[1].score - a[1].score)[0];

  // Pain points
  const painPoints = [];
  for (const { pattern, type } of PAIN_POINT_PATTERNS) {
    let match;
    while ((match = pattern.exec(jobDescription || '')) !== null) {
      const text = match[1].trim();
      if (text.length > 5 && !painPoints.some(p => p.text === text)) {
        painPoints.push({ type, text });
      }
    }
  }

  // Decision maker type
  let decisionMaker = 'unknown';
  for (const [role, signals] of Object.entries(DECISION_MAKER_SIGNALS)) {
    for (const signal of signals) {
      if (desc.includes(signal)) { decisionMaker = role; break; }
    }
    if (decisionMaker !== 'unknown') break;
  }

  // Team size hints
  let teamSize = 'unknown';
  if (/\b(solo|alone|one.?man|just me|myself)\b/.test(desc)) teamSize = 'solo';
  else if (/\b(small team|few people|2-5|startup team)\b/.test(desc)) teamSize = 'small';
  else if (/\b(team of \d{2}|growing team|medium|department)\b/.test(desc)) teamSize = 'medium';
  else if (/\b(large team|enterprise|corporation|100\+|global)\b/.test(desc)) teamSize = 'large';

  // Communication preferences
  const commPrefs = [];
  if (/\b(slack|teams|discord)\b/.test(desc)) commPrefs.push('chat-based');
  if (/\b(daily standup|daily meeting|scrum)\b/.test(desc)) commPrefs.push('daily-sync');
  if (/\b(weekly update|weekly call|weekly meeting)\b/.test(desc)) commPrefs.push('weekly-sync');
  if (/\b(async|asynchronous|flexible|timezone)\b/.test(desc)) commPrefs.push('async-friendly');

  // Previous freelancer experience signals
  let prevFreelancerExp = 'unknown';
  if (/\b(previous freelancer|past contractor|tried before|bad experience|didn't work out)\b/.test(desc)) {
    prevFreelancerExp = 'negative_past';
  } else if (/\b(long.?term|ongoing|multiple projects|repeat|returning)\b/.test(desc)) {
    prevFreelancerExp = 'positive_past';
  } else if (/\b(first time|never hired|new to)\b/.test(desc)) {
    prevFreelancerExp = 'first_time';
  }

  // Build personalization recommendations
  const recommendations = buildPersonalizationRecs({
    industry: topIndustry ? topIndustry[0] : null,
    stage: topStage ? topStage[0] : null,
    painPoints,
    decisionMaker,
    teamSize,
    commPrefs,
    prevFreelancerExp,
  });

  return {
    clientName: clientName || null,
    industry: topIndustry ? { name: topIndustry[0], confidence: Math.min(topIndustry[1].score * 25, 100), signals: topIndustry[1].matched } : null,
    companyStage: topStage ? { stage: topStage[0], confidence: Math.min(topStage[1].score * 30, 100), signals: topStage[1].matched } : null,
    painPoints: painPoints.slice(0, 5),
    decisionMaker,
    teamSize,
    communicationPrefs: commPrefs,
    previousFreelancerExperience: prevFreelancerExp,
    recommendations,
  };
}

function buildPersonalizationRecs(intel) {
  const recs = [];

  // Industry-specific hooks
  const industryHooks = {
    fintech: 'Mention security consciousness, compliance awareness, and experience with sensitive data handling.',
    saas: 'Emphasize scalability, metrics-driven development, and experience with subscription/billing systems.',
    ecommerce: 'Highlight conversion optimization experience, payment integration, and mobile-first approach.',
    healthcare: 'Lead with HIPAA/compliance experience and patient data security awareness.',
    education: 'Focus on user engagement, accessibility, and experience with learning platforms.',
    marketplace: 'Emphasize two-sided marketplace dynamics, trust/safety features, and transaction handling.',
    ai: 'Show technical depth in ML/AI, mention specific models/frameworks, and demo data pipeline experience.',
  };
  if (intel.industry && industryHooks[intel.industry]) {
    recs.push({ type: 'industry', priority: 'high', text: industryHooks[intel.industry] });
  }

  // Stage-specific approach
  const stageApproach = {
    early_stage: 'Emphasize speed, flexibility, and willingness to iterate. Mention MVP experience. Offer phased approach.',
    growth: 'Focus on scalability, performance optimization, and structured development process. Show growth-stage experience.',
    established: 'Lead with process, documentation, security. Mention enterprise experience and compliance awareness.',
    agency: 'Emphasize reliability, fast turnaround, and ability to work within agency workflows.',
  };
  if (intel.stage && stageApproach[intel.stage]) {
    recs.push({ type: 'stage', priority: 'high', text: stageApproach[intel.stage] });
  }

  // Pain point addressing
  if (intel.painPoints.length > 0) {
    const topPain = intel.painPoints[0];
    recs.push({
      type: 'pain_point',
      priority: 'high',
      text: `Directly address their pain point: "${topPain.text}". Show you understand the problem before jumping to solutions.`,
    });
  }

  // Decision maker tailoring
  const decisionMakerTips = {
    technical: 'Include technical specifics, architecture mentions, and code quality signals. Skip the sales talk.',
    business: 'Lead with ROI, timelines, and business outcomes. Minimize jargon. Focus on results.',
    product: 'Show UX awareness, user-centric thinking, and collaborative design process experience.',
    procurement: 'Be formal, include credentials, provide structured pricing, and reference similar scale projects.',
  };
  if (intel.decisionMaker !== 'unknown' && decisionMakerTips[intel.decisionMaker]) {
    recs.push({ type: 'audience', priority: 'medium', text: decisionMakerTips[intel.decisionMaker] });
  }

  // Previous freelancer experience
  if (intel.prevFreelancerExp === 'negative_past') {
    recs.push({ type: 'trust', priority: 'high', text: 'Client has had bad experiences with freelancers. Emphasize communication, accountability, progress tracking, and money-back guarantees.' });
  } else if (intel.prevFreelancerExp === 'first_time') {
    recs.push({ type: 'trust', priority: 'medium', text: 'First-time client on the platform. Offer guidance on process, set expectations clearly, and emphasize your platform track record.' });
  }

  // Communication style
  if (intel.commPrefs.includes('async-friendly')) {
    recs.push({ type: 'comm', priority: 'low', text: 'Client values async communication. Mention timezone flexibility and written update capabilities.' });
  }

  return recs;
}

module.exports = withErrorHandler(async function handler(req, res) {
  if (cors(req, res)) return;
  if (rateLimit(req, res)) return;
  sanitize(req);

  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method not allowed', 'METHOD_NOT_ALLOWED', 'validation_error');
  }

  const { jobDescription, clientName } = req.body || {};

  if (!jobDescription || jobDescription.length < 20) {
    return sendError(res, 400, 'Job description too short', 'MISSING_PARAMS', 'validation_error');
  }

  const intelligence = extractClientIntelligence(jobDescription, clientName);

  res.json({
    success: true,
    intelligence,
    generatedAt: new Date().toISOString(),
  });
});
