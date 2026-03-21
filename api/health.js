const { cors } = require('./_middleware/cors');
const { withErrorHandler, sendError } = require('./_middleware/error-handler');
const { getFirestore } = require('./_lib/firestore');

module.exports = withErrorHandler(async function handler(req, res) {
  if (cors(req, res)) return;

  if (req.method !== 'GET') {
    return sendError(res, 405, 'Method not allowed', 'METHOD_NOT_ALLOWED', 'validation_error');
  }

  var checks = {};

  // Firestore check
  try {
    var db = getFirestore();
    if (db) {
      await db.collection('_health').doc('ping').set({ t: Date.now() });
      checks.firestore = 'ok';
    } else {
      checks.firestore = 'unavailable';
    }
  } catch (err) {
    checks.firestore = 'error: ' + err.message;
  }

  // Stripe env check
  checks.stripe = process.env.STRIPE_SECRET_KEY ? 'configured' : 'missing';

  // OpenAI env check
  checks.openai = process.env.OPENAI_API_KEY ? 'configured' : 'missing';

  var allOk = checks.firestore === 'ok' && checks.stripe === 'configured';

  res.json({
    success: true,
    status: allOk ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    uptime: process.uptime(),
    checks: checks
  });
});
