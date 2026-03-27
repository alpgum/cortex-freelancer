const { cors } = require('./middleware/cors');
const { withErrorHandler, sendError } = require('./middleware/error-handler');
const { optionalAuth } = require('./middleware/auth');
const { getFirestore } = require('./lib/firestore');

const VALID_RATINGS = ['up', 'down'];
const MAX_COMMENT_LENGTH = 500;

module.exports = withErrorHandler(async function handler(req, res) {
  if (cors(req, res)) return;

  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method not allowed', 'METHOD_NOT_ALLOWED', 'validation_error');
  }

  // Optional auth — attach user if token present
  await optionalAuth(req);

  const { tool, rating, comment, timestamp } = req.body || {};

  if (!tool || typeof tool !== 'string') {
    return sendError(res, 400, 'Tool name is required', 'INVALID_INPUT', 'validation_error');
  }

  if (!VALID_RATINGS.includes(rating)) {
    return sendError(res, 400, 'Rating must be "up" or "down"', 'INVALID_INPUT', 'validation_error');
  }

  const entry = {
    tool: tool.slice(0, 100),
    rating: rating,
    comment: typeof comment === 'string' ? comment.slice(0, MAX_COMMENT_LENGTH) : '',
    uid: req.user?.uid || null,
    email: req.user?.email || null,
    timestamp: timestamp || new Date().toISOString(),
    receivedAt: new Date().toISOString()
  };

  // Write to Firestore
  const db = getFirestore();
  if (db) {
    try {
      await db.collection('feedback').add(entry);
    } catch (err) {
      console.error('[feedback] Firestore write failed:', err.message);
      // Fall through — still return success to not block user
    }
  } else {
    console.warn('[feedback] Firestore unavailable, feedback not persisted');
  }

  res.json({ success: true, data: { saved: true } });
});
