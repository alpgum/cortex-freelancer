/**
 * Gmail Email Templates — AI-powered email generation for freelancers
 *
 * POST /api/gmail-templates
 * { uid, template, context }
 *
 * Templates: proposal_followup, invoice_reminder, project_update,
 *            thank_you, availability_update, rate_increase
 */

const { cors } = require('./middleware/cors');
const { rateLimit } = require('./middleware/rate-limit');
const { withErrorHandler, sendError } = require('./middleware/error-handler');

const TEMPLATES = {
  proposal_followup: {
    subject: (ctx) => `Following up on my proposal — ${ctx.projectTitle || 'your project'}`,
    prompt: (ctx) => `Write a polite follow-up email for a freelance proposal.
Client name: ${ctx.clientName || 'the client'}
Project: ${ctx.projectTitle || 'the project'}
Days since submission: ${ctx.daysSince || 3}
Key selling point: ${ctx.sellingPoint || 'my relevant experience'}
Tone: Professional but warm. Keep it brief (3-4 sentences max).`,
  },

  invoice_reminder: {
    subject: (ctx) => `Friendly reminder: Invoice #${ctx.invoiceNumber || '001'} — ${ctx.amount || 'payment'} due`,
    prompt: (ctx) => `Write a gentle payment reminder email.
Client name: ${ctx.clientName || 'the client'}
Invoice number: ${ctx.invoiceNumber || '001'}
Amount: ${ctx.amount || 'the outstanding amount'}
Due date: ${ctx.dueDate || 'the agreed date'}
Days overdue: ${ctx.daysOverdue || 0}
Tone: Friendly but clear. Include a call to action. Keep brief.`,
  },

  project_update: {
    subject: (ctx) => `Project update: ${ctx.projectTitle || 'your project'} — ${ctx.milestone || 'progress report'}`,
    prompt: (ctx) => `Write a professional project status update email.
Client name: ${ctx.clientName || 'the client'}
Project: ${ctx.projectTitle || 'the project'}
Completed: ${ctx.completed || 'recent deliverables'}
Next steps: ${ctx.nextSteps || 'upcoming work'}
Blockers: ${ctx.blockers || 'none'}
Tone: Professional, clear, structured. Use bullet points.`,
  },

  thank_you: {
    subject: (ctx) => `Thank you, ${ctx.clientName || ''}! It was great working together`,
    prompt: (ctx) => `Write a thank-you email after completing a freelance project.
Client name: ${ctx.clientName || 'the client'}
Project: ${ctx.projectTitle || 'the project'}
Highlight: ${ctx.highlight || 'the successful delivery'}
Include a soft ask for a review/testimonial.
Tone: Grateful, professional, warm. Brief.`,
  },

  availability_update: {
    subject: () => `Availability update — ready for new projects`,
    prompt: (ctx) => `Write an email to a past client letting them know I'm available for new work.
Client name: ${ctx.clientName || 'the client'}
Previous project: ${ctx.previousProject || 'our previous collaboration'}
Current availability: ${ctx.availability || 'open for new projects starting next week'}
Skills highlight: ${ctx.skills || 'my updated expertise'}
Tone: Professional, not pushy. Brief.`,
  },

  rate_increase: {
    subject: () => `Update to my rates — effective next month`,
    prompt: (ctx) => `Write a professional rate increase notification email.
Client name: ${ctx.clientName || 'the client'}
Current rate: ${ctx.currentRate || 'current rate'}
New rate: ${ctx.newRate || 'updated rate'}
Effective date: ${ctx.effectiveDate || 'next month'}
Reason: ${ctx.reason || 'increased demand and expanded expertise'}
Include grandfather clause if mentioned: ${ctx.grandfatherExisting || false}
Tone: Professional, confident, appreciative.`,
  },
};

module.exports = withErrorHandler(async function handler(req, res) {
  if (cors(req, res)) return;
  if (rateLimit(req, res)) return;

  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method not allowed', 'METHOD_NOT_ALLOWED', 'validation_error');
  }

  const { template, context } = req.body || {};

  if (!template || !TEMPLATES[template]) {
    return sendError(res, 400,
      `Invalid template. Available: ${Object.keys(TEMPLATES).join(', ')}`,
      'INVALID_TEMPLATE', 'validation_error'
    );
  }

  const tmpl = TEMPLATES[template];
  const ctx = context || {};
  const subject = tmpl.subject(ctx);
  const aiPrompt = tmpl.prompt(ctx);

  // Generate email body with Claude
  try {
    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic();

    const response = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: aiPrompt + '\n\nReturn ONLY the email body text (no subject line, no "Dear..." if already natural). Format as HTML with <p> tags.',
        },
      ],
      system: 'You are an expert freelance email writer. Write concise, professional emails that get results. Always write in the first person as the freelancer. Never use filler words. Be direct but warm.',
    });

    const emailBody = response.content[0]?.text || '';

    return res.json({
      success: true,
      subject,
      body: emailBody,
      template,
      _meta: {
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
        tokens: response.usage?.output_tokens || 0,
      },
    });
  } catch (err) {
    console.error('[gmail-templates] AI generation failed:', err.message);
    return sendError(res, 500, 'Failed to generate email', 'GENERATION_FAILED', 'server_error');
  }
});
