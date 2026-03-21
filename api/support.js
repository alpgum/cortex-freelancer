const { cors } = require('./_middleware/cors');
const { rateLimit } = require('./_middleware/rate-limit');
const { sanitize } = require('./_middleware/sanitize');
const { withErrorHandler, sendError } = require('./_middleware/error-handler');

module.exports = withErrorHandler(async function handler(req, res) {
  if (cors(req, res)) return;
  if (rateLimit(req, res)) return;
  sanitize(req);

  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method not allowed', 'METHOD_NOT_ALLOWED', 'validation_error');
  }

  const { name, email, category, message } = req.body || {};

  if (!name || typeof name !== 'string' || !email || typeof email !== 'string' ||
      !category || typeof category !== 'string' || !message || typeof message !== 'string') {
    return sendError(res, 400, 'All fields are required and must be strings', 'INVALID_INPUT', 'validation_error');
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return sendError(res, 400, 'Invalid email address', 'INVALID_INPUT', 'validation_error');
  }

  if (message.length > 5000) {
    return sendError(res, 400, 'Message too long (max 5000 characters)', 'INVALID_INPUT', 'validation_error');
  }

  const validCategories = ['bug', 'feature', 'billing', 'account', 'general'];
  if (!validCategories.includes(category)) {
    return sendError(res, 400, 'Invalid category', 'INVALID_INPUT', 'validation_error');
  }

  console.log('[SUPPORT]', {
    name: name.substring(0, 100),
    email: email.substring(0, 254),
    category,
    message: message.substring(0, 200),
    timestamp: new Date().toISOString()
  });

  // Try to save to Firestore if available
  try {
    const admin = require('./_lib/firebase-admin');
    if (admin && admin.firestore) {
      const db = admin.firestore();
      await db.collection('support_tickets').add({
        name: name.substring(0, 200),
        email: email.substring(0, 254),
        category,
        message: message.substring(0, 5000),
        status: 'open',
        createdAt: new Date().toISOString()
      });
    }
  } catch (dbErr) {
    console.log('[SUPPORT] Firestore not available, logged to console only');
  }

  res.json({ success: true, data: { message: 'Support ticket created' } });
});
