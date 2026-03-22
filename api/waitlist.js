const { cors } = require('./_middleware/cors');
const { sanitize } = require('./_middleware/sanitize');
const { withErrorHandler, sendError } = require('./_middleware/error-handler');

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

module.exports = withErrorHandler(async function handler(req, res) {
  if (cors(req, res)) return;

  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method not allowed', 'METHOD_NOT_ALLOWED', 'validation_error');
  }

  sanitize(req);
  const { email, country, name, source } = req.body || {};

  if (!email || !country) {
    return sendError(res, 400, 'Email and country are required.', 'MISSING_FIELDS', 'validation_error');
  }

  if (!isValidEmail(email)) {
    return sendError(res, 400, 'Invalid email format.', 'INVALID_EMAIL', 'validation_error');
  }

  // Try Firestore first, fall back to in-memory acknowledgement
  try {
    const { getFirestore } = require('./_lib/firestore');
    const db = getFirestore();
    if (db) {
      const normalizedEmail = email.toLowerCase().trim();
      const existing = await db.collection('waitlist')
        .where('email', '==', normalizedEmail).limit(1).get();

      if (!existing.empty) {
        return sendError(res, 409, 'This email is already on the waitlist.', 'DUPLICATE_EMAIL', 'validation_error');
      }

      await db.collection('waitlist').add({
        email: normalizedEmail,
        country,
        name: name ? name.trim() : null,
        source: source ? source.trim() : null,
        timestamp: new Date().toISOString()
      });
    }
  } catch (err) {
    console.warn('Waitlist Firestore write failed, acknowledging anyway:', err.message);
  }

  res.json({
    success: true,
    message: "You're on the list!"
  });
});
