const { cors } = require('./middleware/cors');
const { rateLimit } = require('./middleware/rate-limit');
const { sanitize } = require('./middleware/sanitize');
const { requireAuth } = require('./middleware/auth');
const { withErrorHandler, sendError } = require('./middleware/error-handler');
const { deleteUserData, getUser } = require('./services/user');

module.exports = withErrorHandler(async function handler(req, res) {
  if (cors(req, res)) return;
  if (rateLimit(req, res)) return;
  sanitize(req);

  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method not allowed', 'METHOD_NOT_ALLOWED', 'validation_error');
  }

  // Require authenticated user
  if (await requireAuth(req, res)) return;

  const { confirmation } = req.body || {};

  if (confirmation !== 'DELETE_MY_ACCOUNT') {
    return sendError(res, 400, 'Confirmation string "DELETE_MY_ACCOUNT" is required', 'INVALID_INPUT', 'validation_error');
  }

  const uid = req.user.uid;
  const email = req.user.email;

  // Delete all user data from Firestore
  const result = await deleteUserData(uid, email);

  // Log deletion for audit trail
  const auditEntry = {
    action: 'account_deletion',
    uid,
    email,
    recordsRemoved: result.results || {},
    totalRemoved: result.totalRemoved || 0,
    timestamp: new Date().toISOString()
  };
  console.log('[GDPR] Account deletion:', JSON.stringify(auditEntry));

  // Log audit to Firestore admin collection (best-effort)
  try {
    const { getFirestore } = require('./lib/firestore');
    const db = getFirestore();
    if (db) {
      await db.collection('admin').doc('audit_log').collection('deletions').add(auditEntry);
    }
  } catch (err) {
    // Non-critical — already logged to console
  }

  res.json({
    success: true,
    data: {
      deleted: true,
      recordsRemoved: result.totalRemoved || 0,
      message: 'Your account data has been deleted. Any remaining data in third-party services (Stripe) will be removed within 90 days.'
    }
  });
});
