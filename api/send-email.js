const { cors } = require('./_middleware/cors');
const { sanitize } = require('./_middleware/sanitize');
const { sendWelcomeEmail, sendProActivatedEmail } = require('./_services/email');
const { withErrorHandler, sendError } = require('./_middleware/error-handler');

module.exports = withErrorHandler(async function handler(req, res) {
  if (cors(req, res)) return;

  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method not allowed', 'METHOD_NOT_ALLOWED', 'validation_error');
  }

  sanitize(req);

  const { type, email, name } = req.body;

  if (!type || !email) {
    return sendError(res, 400, 'type and email are required.', 'MISSING_FIELDS', 'validation_error');
  }

  if (typeof type !== 'string' || typeof email !== 'string') {
    return sendError(res, 400, 'type and email must be strings.', 'INVALID_FIELDS', 'validation_error');
  }

  const displayName = name || 'there';

  let result;

  if (type === 'welcome') {
    result = await sendWelcomeEmail(email, displayName);
  } else if (type === 'pro_activated') {
    result = await sendProActivatedEmail(email, displayName);
  } else {
    return sendError(res, 400, `Unknown email type: ${type}`, 'INVALID_EMAIL_TYPE', 'validation_error');
  }

  if (!result) {
    return sendError(res, 503, 'Email service unavailable.', 'EMAIL_UNAVAILABLE', 'service_error');
  }

  console.log(`[send-email] ${type} → ${email}`);
  res.json({ success: true });
});
