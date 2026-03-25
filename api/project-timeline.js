/**
 * CFX-070: Project Timeline Planner — AI Timeline Optimization Endpoint
 * Analyzes project timelines and provides optimization suggestions,
 * risk assessment, critical path analysis, and schedule recommendations.
 */

const { cors } = require('./middleware/cors');
const { rateLimit } = require('./middleware/rate-limit');
const { sanitize } = require('./middleware/sanitize');
const { withErrorHandler, sendError } = require('./middleware/error-handler');
const { askClaude, getApiKey } = require('./lib/claude');

// ── System Prompt ───────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert freelance project manager and timeline optimization specialist. You analyze project timelines, milestones, and dependencies to provide actionable optimization advice.

Respond ONLY in JSON (no markdown, no commentary) with this exact structure:
{
  "timelineHealth": {
    "score": <number 0-100>,
    "status": "<healthy|at_risk|critical>",
    "summary": "<1-2 sentence overall assessment>"
  },
  "criticalPathAnalysis": {
    "totalDuration": <number, days>,
    "bottlenecks": [
      { "milestone": "<name>", "reason": "<why it's a bottleneck>", "impact": "<what happens if delayed>" }
    ],
    "parallelizationOpportunities": [
      { "milestones": ["<name1>", "<name2>"], "suggestion": "<how to parallelize>" }
    ]
  },
  "scheduleOptimizations": [
    {
      "type": "<reorder|compress|split|buffer|parallelize>",
      "milestone": "<affected milestone name>",
      "suggestion": "<specific actionable recommendation>",
      "timeSaved": "<estimated days saved>",
      "priority": "<high|medium|low>"
    }
  ],
  "riskAssessment": {
    "overallRisk": "<low|medium|high|critical>",
    "risks": [
      {
        "type": "<deadline|resource|scope|dependency|budget>",
        "description": "<specific risk description>",
        "probability": "<low|medium|high>",
        "impact": "<low|medium|high>",
        "mitigation": "<suggested mitigation strategy>"
      }
    ]
  },
  "clientCommunication": {
    "suggestedUpdateFrequency": "<daily|weekly|biweekly|monthly>",
    "keyMilestonesToHighlight": ["<milestone names worth sharing with client>"],
    "progressNarrative": "<2-3 sentence progress summary suitable for client>",
    "nextUpdateTopics": ["<topic1>", "<topic2>"]
  },
  "bufferRecommendations": {
    "suggestedBufferDays": <number>,
    "whereToAddBuffer": [
      { "after": "<milestone name>", "days": <number>, "reason": "<why>" }
    ]
  },
  "workloadAnalysis": {
    "peakPeriods": [
      { "period": "<date range>", "hours": <number>, "warning": "<overload warning if applicable>" }
    ],
    "averageHoursPerWeek": <number>,
    "sustainabilityScore": <number 0-100>
  }
}

Guidelines:
- Base recommendations on real project management best practices
- Consider dependency chains and their impact on the critical path
- Factor in realistic buffer time (15-25% for unknowns)
- Identify overloaded periods that could lead to burnout
- Provide client-friendly language for the communication section
- Suggest concrete, actionable optimizations (not generic advice)
- Account for common freelancer challenges: context switching, client delays, scope creep
- If milestones have actual hours exceeding estimates, flag this as a risk`;

// ── Handler ─────────────────────────────────────────────────────────────

async function handler(req, res) {
  if (req.method === 'OPTIONS') return cors(req, res);
  cors(req, res);

  if (req.method !== 'POST') return sendError(res, 405, 'Method not allowed');

  const allowed = rateLimit(req, res, { max: 15, windowSec: 60 });
  if (!allowed) return;

  const apiKey = getApiKey();
  if (!apiKey) return sendError(res, 500, 'API key not configured');

  const body = sanitize(req.body || {});
  const { projectName, client, startDate, endDate, budget, hourlyRate, milestones, phases } = body;

  if (!projectName) return sendError(res, 400, 'Project name is required');
  if (!milestones || milestones.length === 0) return sendError(res, 400, 'At least one milestone is required');

  // Build analysis prompt
  const phaseList = (phases || []).map(p => `  - ${p.name}`).join('\n');
  const milestoneList = milestones.map((m, i) => {
    const deps = (m.dependencies || []).length > 0 ? ` [depends on: ${m.dependencies.length} task(s)]` : '';
    const hours = m.estimatedHours ? ` (est: ${m.estimatedHours}h` + (m.actualHours ? `, actual: ${m.actualHours}h` : '') + ')' : '';
    const progress = m.progress > 0 ? ` — ${m.progress}% done` : '';
    return `  ${i + 1}. ${m.name} | ${m.status} | ${m.priority} priority | ${m.startDate || '?'} → ${m.dueDate || '?'}${hours}${progress}${deps}`;
  }).join('\n');

  const prompt = `Analyze this freelance project timeline and provide optimization recommendations:

PROJECT: ${projectName}
CLIENT: ${client || 'Not specified'}
TIMELINE: ${startDate || '?'} → ${endDate || '?'}
BUDGET: ${budget ? '$' + budget : 'Not specified'}
RATE: ${hourlyRate ? '$' + hourlyRate + '/hr' : 'Not specified'}

PHASES:
${phaseList || '  (no phases defined)'}

MILESTONES:
${milestoneList}

Provide detailed timeline optimization analysis.`;

  try {
    const result = await askClaude(apiKey, SYSTEM_PROMPT, prompt, {
      temperature: 0.3,
      maxTokens: 2000
    });

    res.status(200).json(result);
  } catch (err) {
    console.error('[project-timeline] Claude error:', err.message);
    sendError(res, 500, 'AI analysis failed. Please try again.');
  }
}

module.exports = withErrorHandler(handler);
