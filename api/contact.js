const { cors } = require('./middleware/cors');
const { rateLimit } = require('./middleware/rate-limit');
const { sanitize } = require('./middleware/sanitize');
const { withErrorHandler, sendError } = require('./middleware/error-handler');

const RESEND_API = 'https://api.resend.com/emails';
const FROM = 'Cortex Freelancer <noreply@cortexfreelancer.com>';
const TO = 'hello@cortexfreelancer.com';

module.exports = withErrorHandler(async function handler(req, res) {
  if (cors(req, res)) return;
  if (rateLimit(req, res)) return;

  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method not allowed', 'METHOD_NOT_ALLOWED', 'validation_error');
  }

  sanitize(req);

  const { name, email, subject, message } = req.body;

  if (!name || !email || !subject || !message) {
    return sendError(res, 400, 'All fields are required.', 'MISSING_FIELDS', 'validation_error');
  }

  if (typeof name !== 'string' || typeof email !== 'string' || typeof subject !== 'string' || typeof message !== 'string') {
    return sendError(res, 400, 'All fields must be strings.', 'INVALID_FIELDS', 'validation_error');
  }

  if (name.length > 200 || email.length > 200 || subject.length > 200 || message.length > 5000) {
    return sendError(res, 400, 'Field length exceeded.', 'FIELD_TOO_LONG', 'validation_error');
  }

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn('[contact] RESEND_API_KEY not set — skipping email');
    return res.json({ success: true });
  }

  const html = `
    <h2>New Contact Form Submission</h2>
    <p><strong>Name:</strong> ${name}</p>
    <p><strong>Email:</strong> ${email}</p>
    <p><strong>Subject:</strong> ${subject}</p>
    <p><strong>Message:</strong></p>
    <p>${message.replace(/\n/g, '<br>')}</p>
  `;

  const emailRes = await fetch(RESEND_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM,
      to: TO,
      reply_to: email,
      subject: `[Contact] ${subject} — ${name}`,
      html,
    }),
  });

  if (!emailRes.ok) {
    const body = await emailRes.text();
    console.error('[contact] Resend error', emailRes.status, body);
    return sendError(res, 503, 'Failed to send message.', 'EMAIL_FAILED', 'service_error');
  }

  console.log(`[contact] ${subject} from ${email}`);
  res.json({ success: true });
});
