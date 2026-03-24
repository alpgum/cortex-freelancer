const { cors } = require('./middleware/cors');
const { rateLimit } = require('./middleware/rate-limit');
const { sanitize } = require('./middleware/sanitize');
const { withErrorHandler, sendError } = require('./middleware/error-handler');

const TONE_PROMPTS = {
  professional: 'Rewrite the following email in a professional, polished tone. Use formal language, proper salutations, and maintain a respectful, business-appropriate voice. Keep the same intent and key information.',
  friendly: 'Rewrite the following email in a warm, friendly tone. Use casual but respectful language, contractions, and a personable voice. Make it feel like a message from someone the recipient knows and likes.',
  urgent: 'Rewrite the following email with a sense of urgency. Make it clear that this matter needs immediate attention. Use direct, action-oriented language while remaining professional. Add time-sensitive framing.',
  'follow-up': 'Rewrite the following email as a follow-up message. Reference previous communication, gently nudge for a response, and make it easy for the recipient to take action. Keep it brief and polite.',
  complaint: 'Rewrite the following email as a professional complaint. Be firm but respectful. Clearly state the issue, its impact, and what resolution you expect. Maintain professionalism throughout.'
};

module.exports = withErrorHandler(async function handler(req, res) {
  if (cors(req, res)) return;
  if (rateLimit(req, res)) return;
  sanitize(req);

  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method not allowed', 'METHOD_NOT_ALLOWED', 'validation_error');
  }

  const { emailText, tone, context } = req.body || {};

  if (!emailText || !tone) {
    return sendError(res, 400, 'emailText and tone are required', 'MISSING_FIELDS', 'validation_error');
  }

  const tonePrompt = TONE_PROMPTS[tone];
  if (!tonePrompt) {
    return sendError(res, 400, `Invalid tone: ${tone}. Valid: ${Object.keys(TONE_PROMPTS).join(', ')}`, 'INVALID_TONE', 'validation_error');
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return sendError(res, 503, 'AI tone adjustment unavailable', 'NO_API_KEY', 'service_error');
  }

  const systemPrompt = `You are an expert email writing assistant for freelancers. ${tonePrompt}${context ? `\n\nAdditional context: ${context}` : ''}\n\nReturn ONLY the rewritten email body. Do not include "Subject:" lines, explanations, or commentary. Preserve the email structure (greeting, body, closing).`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        { role: 'user', content: `${systemPrompt}\n\nEmail to rewrite:\n\n${emailText}` }
      ]
    })
  });

  if (!response.ok) {
    const err = await response.text().catch(() => 'Unknown error');
    return sendError(res, 502, 'AI service error', 'AI_ERROR', 'service_error');
  }

  const data = await response.json();
  const rewritten = data.content?.[0]?.text || '';

  if (!rewritten) {
    return sendError(res, 502, 'Empty AI response', 'EMPTY_RESPONSE', 'service_error');
  }

  res.status(200).json({ rewritten });
});
