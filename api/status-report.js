/**
 * AI-Powered Weekly Status Report Generator
 *
 * POST /api/status-report
 * Takes project data and generates a professional, client-ready status report
 *
 * Input: { clientName, weekRange, completed, inProgress, blockers, planned, stats }
 * Output: { subject, htmlBody, plainBody }
 */

const { cors } = require('./middleware/cors');
const { rateLimit } = require('./middleware/rate-limit');
const { withErrorHandler, sendError } = require('./middleware/error-handler');

module.exports = withErrorHandler(async function handler(req, res) {
  if (cors(req, res)) return;
  if (rateLimit(req, res)) return;

  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method not allowed', 'METHOD_NOT_ALLOWED', 'validation_error');
  }

  const {
    clientName,
    weekStart,
    weekEnd,
    completed,
    inProgress,
    blockers,
    planned,
    stats,
    tone,
  } = req.body || {};

  if (!weekStart || !weekEnd) {
    return sendError(res, 400, 'weekStart and weekEnd are required', 'MISSING_FIELDS', 'validation_error');
  }

  const safeClient = clientName || 'Team';
  const safeTone = ['formal', 'friendly', 'brief'].includes(tone) ? tone : 'friendly';

  const toneGuide = {
    formal: 'Use a formal, corporate tone. Address the client respectfully. Use complete sentences and professional language.',
    friendly: 'Use a warm, professional tone. Be approachable but still business-appropriate. Use first names naturally.',
    brief: 'Be extremely concise. Use bullet points heavily. Minimize prose. Get straight to the facts.',
  };

  const prompt = buildPrompt({
    clientName: safeClient,
    weekStart,
    weekEnd,
    completed: completed || [],
    inProgress: inProgress || [],
    blockers: blockers || [],
    planned: planned || [],
    stats: stats || {},
    toneGuide: toneGuide[safeTone],
  });

  try {
    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic();

    const response = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
      system: `You are an expert freelance project manager writing weekly status updates for clients.
You produce clear, structured, professional reports that clients love to read.
Always write as the freelancer/contractor updating the client.
Never fabricate data — only use what is provided.
Return valid JSON with "subject", "htmlBody", and "plainBody" fields.
The htmlBody should use inline CSS for email compatibility (no external stylesheets).
Use a clean, modern email design with subtle colors.`,
    });

    const raw = response.content[0]?.text || '';

    // Parse JSON from response
    let result;
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      result = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    } catch (parseErr) {
      // Fallback: use raw as plain body
      result = {
        subject: `Weekly Status Update — ${weekStart} to ${weekEnd}`,
        htmlBody: `<pre>${raw}</pre>`,
        plainBody: raw,
      };
    }

    return res.json({
      success: true,
      subject: result.subject,
      htmlBody: result.htmlBody,
      plainBody: result.plainBody,
      _meta: {
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
        tokens: response.usage?.output_tokens || 0,
        tone: safeTone,
      },
    });
  } catch (err) {
    console.error('[status-report] AI generation failed:', err.message);
    return sendError(res, 500, 'Failed to generate status report', 'GENERATION_FAILED', 'server_error');
  }
});

function buildPrompt({ clientName, weekStart, weekEnd, completed, inProgress, blockers, planned, stats, toneGuide }) {
  const completedList = completed.length
    ? completed.map(c => `- ${c.name}${c.client ? ` (${c.client})` : ''}${c.notes ? `: ${c.notes}` : ''}`).join('\n')
    : '(none)';

  const progressList = inProgress.length
    ? inProgress.map(p => {
        let extra = '';
        if (p.deadline) extra += ` [deadline: ${p.deadline}]`;
        if (p.priority === 'urgent' || p.priority === 'high') extra += ` [${p.priority.toUpperCase()}]`;
        return `- ${p.name}${p.client ? ` (${p.client})` : ''}${extra}${p.notes ? `: ${p.notes}` : ''}`;
      }).join('\n')
    : '(none)';

  const blockerList = blockers.length
    ? blockers.map(b => `- ${typeof b === 'string' ? b : b.text}`).join('\n')
    : '(none)';

  const plannedList = planned.length
    ? planned.map(p => `- ${p.name}${p.client ? ` (${p.client})` : ''}${p.deadline ? ` [deadline: ${p.deadline}]` : ''}`).join('\n')
    : '(none)';

  const statsBlock = [];
  if (stats.hoursLogged != null) statsBlock.push(`Hours logged: ${stats.hoursLogged}h`);
  if (stats.completedCount != null) statsBlock.push(`Tasks completed: ${stats.completedCount}`);
  if (stats.inProgressCount != null) statsBlock.push(`Tasks in progress: ${stats.inProgressCount}`);
  if (stats.earned != null && stats.earned > 0) statsBlock.push(`Budget used: $${Math.round(stats.earned).toLocaleString()}`);
  if (stats.budgetTotal != null && stats.budgetTotal > 0) {
    const pct = stats.earned ? Math.round((stats.earned / stats.budgetTotal) * 100) : 0;
    statsBlock.push(`Budget utilization: ${pct}%`);
  }
  if (stats.milestonesCompleted != null) statsBlock.push(`Milestones completed: ${stats.milestonesCompleted}`);

  return `Generate a professional weekly status report email for my client.

CLIENT: ${clientName}
WEEK: ${weekStart} to ${weekEnd}
TONE: ${toneGuide}

DATA:
${statsBlock.length ? statsBlock.join('\n') : '(no stats available)'}

COMPLETED THIS WEEK:
${completedList}

IN PROGRESS:
${progressList}

BLOCKERS:
${blockerList}

NEXT WEEK PLAN:
${plannedList}

Return a JSON object with exactly these fields:
{
  "subject": "email subject line (include week dates)",
  "htmlBody": "full HTML email body with inline styles, sections for: greeting, summary stats, completed work, in progress, blockers (if any), next week plan, sign-off",
  "plainBody": "plain text version of the same content"
}

Design guidelines for htmlBody:
- Use a max-width container (600px) with padding
- Section headers: bold, slightly larger, with a bottom border
- Completed items: green left border or checkmark
- In progress items: orange/amber indicator
- Blockers: red highlight if any exist
- Stats: displayed in a compact row or grid
- Clean sans-serif font (Arial/Helvetica)
- Subtle background (#f9f9f9) with white content area
- Professional sign-off with "Best regards"`;
}