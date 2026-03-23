const { cors } = require('./middleware/cors');
const { rateLimit } = require('./middleware/rate-limit');
const { sanitize } = require('./middleware/sanitize');
const { withErrorHandler, sendError } = require('./middleware/error-handler');
const { askClaude, getApiKey, ClaudeError } = require('./lib/claude');

// ── Claude Prompt Builder ───────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a senior Upwork career consultant. Analyze this freelancer profile and provide actionable advice.

Respond ONLY in JSON (no markdown, no commentary) with this exact structure:
{
  "summary": "2-3 sentence executive summary",
  "profileStrength": { "score": 1-10, "explanation": "..." },
  "rateAnalysis": { "currentRate": X, "recommendedRange": [low, high], "explanation": "..." },
  "skillGapAnalysis": { "strongSkills": [...], "missingHighDemand": [...], "recommendation": "..." },
  "competitivePosition": { "tier": "top-10%|top-25%|average|below-average", "explanation": "..." },
  "actionPlan": [
    { "priority": 1, "action": "...", "expectedImpact": "...", "effort": "low|medium|high" }
  ],
  "titleSuggestions": ["...", "...", "..."],
  "descriptionFeedback": "..."
}`;

function buildUserMessage(profile) {
  const rate = profile.hourlyRate
    ? `$${String(profile.hourlyRate).replace(/^\$/, '')}/hr`
    : 'Not specified';

  const desc = profile.description
    ? profile.description.slice(0, 500)
    : 'No description provided';

  return `Profile:
- Name: ${profile.name || 'Unknown'}
- Title: ${profile.title || 'Not set'}
- Rate: ${rate}
- Job Success: ${profile.jobSuccess != null ? profile.jobSuccess + '%' : 'Not available'}
- Total Earnings: ${profile.totalEarnings || 'Not available'}
- Total Jobs: ${profile.totalJobs != null ? profile.totalJobs : 'Not available'}
- Skills: ${profile.skills?.length ? profile.skills.join(', ') : 'None listed'}
- Portfolio: ${profile.portfolio?.length || 0} items
- Description: ${desc}
- Location: ${profile.location || 'Not specified'}
- Member Since: ${profile.memberSince || 'Not available'}`;
}

// ── Rule-Based Fallback Analysis ────────────────────────────────────────

function ruleBasedAnalysis(profile) {
  const rate = parseFloat(String(profile.hourlyRate || '0').replace(/[^\d.]/g, '')) || 0;
  const jobSuccess = profile.jobSuccess || 0;
  const totalJobs = profile.totalJobs || 0;
  const skillCount = profile.skills?.length || 0;
  const hasPortfolio = (profile.portfolio?.length || 0) > 0;
  const hasDescription = !!(profile.description && profile.description.length > 50);

  // ── Profile strength score ──
  let score = 3; // base
  if (profile.name) score += 0.5;
  if (profile.title && profile.title.length > 10) score += 1;
  if (hasDescription) score += 1;
  if (rate > 0) score += 0.5;
  if (jobSuccess >= 90) score += 1.5;
  else if (jobSuccess >= 80) score += 1;
  else if (jobSuccess >= 70) score += 0.5;
  if (totalJobs >= 50) score += 1;
  else if (totalJobs >= 20) score += 0.5;
  if (skillCount >= 5) score += 0.5;
  if (hasPortfolio) score += 0.5;
  score = Math.min(10, Math.round(score * 10) / 10);

  // ── Rate analysis ──
  let recommendedLow = rate || 25;
  let recommendedHigh = rate || 50;
  if (jobSuccess >= 90 && totalJobs >= 20) {
    recommendedLow = Math.max(rate * 1.1, rate + 5);
    recommendedHigh = rate * 1.5;
  } else if (rate > 0 && totalJobs < 5) {
    recommendedLow = Math.max(15, rate * 0.7);
    recommendedHigh = rate;
  }
  recommendedLow = Math.round(recommendedLow);
  recommendedHigh = Math.round(recommendedHigh);

  // ── Competitive position ──
  let tier = 'average';
  if (jobSuccess >= 95 && totalJobs >= 50) tier = 'top-10%';
  else if (jobSuccess >= 90 && totalJobs >= 20) tier = 'top-25%';
  else if (jobSuccess < 70 || (totalJobs < 5 && !hasPortfolio)) tier = 'below-average';

  // ── Strong skills ──
  const strongSkills = (profile.skills || []).slice(0, 5);

  // ── High-demand skills commonly missing ──
  const highDemandSkills = [
    'AI/ML', 'React', 'TypeScript', 'Python', 'AWS', 'Node.js',
    'Data Analysis', 'Figma', 'Docker', 'API Development',
  ];
  const profileSkillsLower = (profile.skills || []).map((s) => s.toLowerCase());
  const missingHighDemand = highDemandSkills.filter(
    (s) => !profileSkillsLower.some((ps) => ps.includes(s.toLowerCase()) || s.toLowerCase().includes(ps))
  ).slice(0, 4);

  // ── Action plan ──
  const actions = [];
  let priority = 1;

  if (!hasDescription || (profile.description || '').length < 100) {
    actions.push({
      priority: priority++,
      action: 'Write a compelling profile description (300-500 words) highlighting your expertise and results',
      expectedImpact: 'Significantly improves client trust and search visibility',
      effort: 'medium',
    });
  }

  if (!hasPortfolio) {
    actions.push({
      priority: priority++,
      action: 'Add 3-5 portfolio items showcasing your best work with detailed case studies',
      expectedImpact: 'Portfolio items increase conversion rate by up to 40%',
      effort: 'medium',
    });
  }

  if (skillCount < 5) {
    actions.push({
      priority: priority++,
      action: `Add more relevant skills to your profile (currently ${skillCount}, aim for 10-15)`,
      expectedImpact: 'Better matching with client searches',
      effort: 'low',
    });
  }

  if (rate > 0 && rate < 20) {
    actions.push({
      priority: priority++,
      action: 'Gradually increase your rate — underpricing signals low quality to premium clients',
      expectedImpact: 'Higher quality clients and better earnings per hour',
      effort: 'low',
    });
  }

  if (totalJobs < 5) {
    actions.push({
      priority: priority++,
      action: 'Focus on winning your first 5-10 jobs even at lower rates to build reviews',
      expectedImpact: 'Establishes credibility and job success score',
      effort: 'high',
    });
  }

  if (actions.length === 0) {
    actions.push({
      priority: 1,
      action: 'Consider specializing in a niche to command premium rates',
      expectedImpact: 'Specialists earn 2-3x more than generalists',
      effort: 'medium',
    });
  }

  // ── Title suggestions ──
  const titleBase = profile.title || 'Freelancer';
  const titleSuggestions = [
    `Senior ${titleBase} | Proven Results`,
    `Expert ${titleBase} — ${strongSkills[0] || 'Specialist'}`,
    `${titleBase} | ${jobSuccess ? jobSuccess + '% Job Success' : 'Delivering Excellence'}`,
  ];

  // ── Description feedback ──
  let descriptionFeedback = 'No description provided. ';
  if (hasDescription) {
    const descLen = profile.description.length;
    if (descLen < 200) {
      descriptionFeedback = 'Your description is too short. Aim for 300-500 words covering your expertise, process, and past results.';
    } else if (descLen < 400) {
      descriptionFeedback = 'Good start, but consider expanding with specific metrics, client outcomes, and your unique approach.';
    } else {
      descriptionFeedback = 'Decent length. Make sure it leads with your strongest value proposition and includes measurable results.';
    }
  } else {
    descriptionFeedback += 'A strong description is essential — it\'s your sales pitch to potential clients.';
  }

  return {
    summary: `${profile.name || 'This freelancer'} has a profile strength of ${score}/10. ${tier === 'top-10%' || tier === 'top-25%' ? 'Strong competitive position' : 'There is room for improvement'} with ${totalJobs} completed jobs and ${jobSuccess ? jobSuccess + '% job success' : 'no job success score yet'}.`,
    profileStrength: {
      score,
      explanation: `Based on completeness of profile fields, job history (${totalJobs} jobs), success rate (${jobSuccess}%), and portfolio presence.`,
    },
    rateAnalysis: {
      currentRate: rate,
      recommendedRange: [recommendedLow, recommendedHigh],
      explanation: rate > 0
        ? `Current rate of $${rate}/hr is ${tier.includes('top') ? 'reasonable for your tier' : 'potentially adjustable'}. Consider the recommended range based on your experience level.`
        : 'No rate specified. Setting a competitive rate is important for attracting the right clients.',
    },
    skillGapAnalysis: {
      strongSkills,
      missingHighDemand,
      recommendation: missingHighDemand.length > 0
        ? `Consider adding high-demand skills like ${missingHighDemand.join(', ')} to increase your visibility.`
        : 'Your skill set covers many high-demand areas. Keep them updated as the market evolves.',
    },
    competitivePosition: {
      tier,
      explanation: `Based on ${jobSuccess}% job success rate and ${totalJobs} completed jobs. ${tier === 'top-10%' ? 'Excellent standing.' : tier === 'top-25%' ? 'Strong performance.' : 'Focus on building your track record.'}`,
    },
    actionPlan: actions,
    titleSuggestions,
    descriptionFeedback,
    _meta: { engine: 'rule-based', note: 'AI analysis unavailable — using scoring engine' },
  };
}

// ── Handler ─────────────────────────────────────────────────────────────

module.exports = withErrorHandler(async function handler(req, res) {
  if (cors(req, res)) return;
  if (rateLimit(req, res)) return;
  sanitize(req);

  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method not allowed. Use POST.', 'METHOD_NOT_ALLOWED', 'validation_error');
  }

  const { profileData } = req.body || {};

  if (!profileData || typeof profileData !== 'object') {
    return sendError(
      res, 400,
      'Missing required field: profileData (object with parsed profile fields)',
      'MISSING_PROFILE_DATA',
      'validation_error'
    );
  }

  // Require at least a name or title
  if (!profileData.name && !profileData.title) {
    return sendError(
      res, 400,
      'profileData must contain at least a name or title',
      'INSUFFICIENT_PROFILE_DATA',
      'validation_error'
    );
  }

  // Check for API key — use AI or fallback
  const hasApiKey = !!getApiKey();
  let analysis;
  let engine = 'claude';

  if (hasApiKey) {
    try {
      analysis = await askClaude(SYSTEM_PROMPT, buildUserMessage(profileData));
    } catch (err) {
      console.error('[analyze-profile] Claude API error:', err.message, err.code);

      // Fallback to rule-based on any Claude failure
      engine = 'rule-based-fallback';
      analysis = ruleBasedAnalysis(profileData);
      analysis._meta = {
        ...(analysis._meta || {}),
        engine,
        fallbackReason: err.code || err.message,
      };
    }
  } else {
    engine = 'rule-based';
    analysis = ruleBasedAnalysis(profileData);
  }

  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

  res.status(200).json({
    success: true,
    engine,
    data: analysis,
  });
});
