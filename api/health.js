const { cors } = require('./middleware/cors');
const { withErrorHandler, sendError } = require('./middleware/error-handler');
const { getFirestore } = require('./lib/firestore');

/* ── env var registry ── */
const REQUIRED_VARS = [
  { key: 'STRIPE_SECRET_KEY',          label: 'Stripe API' },
  { key: 'STRIPE_WEBHOOK_SECRET',      label: 'Stripe webhooks' },
  { key: 'STRIPE_PRICE_PRO_MONTHLY',   label: 'Pro monthly price ID' },
  { key: 'STRIPE_PRICE_PRO_ANNUAL',    label: 'Pro annual price ID' },
  { key: 'ANTHROPIC_API_KEY',          label: 'Claude AI chat' },
  { key: 'FIREBASE_SERVICE_ACCOUNT_KEY', label: 'Firebase Admin SDK' },
  { key: 'RESEND_API_KEY',             label: 'Transactional email' },
  { key: 'CRON_SECRET',                label: 'Cron job auth' },
  { key: 'ADMIN_TOKEN',                label: 'Admin endpoints' },
];

const OPTIONAL_VARS = [
  { key: 'ADMIN_EMAIL',                label: 'Daily metrics recipient' },
  { key: 'SLACK_WEBHOOK_URL',          label: 'Revenue notifications' },
  { key: 'SENTRY_DSN',                 label: 'Error monitoring' },
  { key: 'DOMAIN',                     label: 'Checkout redirect URLs' },
  { key: 'STRIPE_COUPON_LAUNCH50',     label: 'Launch 50% coupon' },
  { key: 'STRIPE_COUPON_FRIEND20',     label: 'Friend 20% coupon' },
  { key: 'STRIPE_COUPON_ANNUAL10',     label: 'Annual 10% coupon' },
];

function checkVars(vars) {
  var results = {};
  for (var v of vars) {
    results[v.key] = process.env[v.key] ? 'configured' : 'missing';
  }
  return results;
}

module.exports = withErrorHandler(async function handler(req, res) {
  if (cors(req, res)) return;

  if (req.method !== 'GET') {
    return sendError(res, 405, 'Method not allowed', 'METHOD_NOT_ALLOWED', 'validation_error');
  }

  /* ── service checks ── */
  var services = {};

  // Firestore connectivity
  try {
    var db = getFirestore();
    if (db) {
      await db.collection('_health').doc('ping').set({ t: Date.now() });
      services.firestore = 'ok';
    } else {
      services.firestore = 'unavailable';
    }
  } catch (err) {
    services.firestore = 'error: ' + err.message;
  }

  /* ── env var checks ── */
  var required = checkVars(REQUIRED_VARS);
  var optional = checkVars(OPTIONAL_VARS);

  var missingRequired = Object.entries(required)
    .filter(function (e) { return e[1] === 'missing'; })
    .map(function (e) { return e[0]; });

  var missingOptional = Object.entries(optional)
    .filter(function (e) { return e[1] === 'missing'; })
    .map(function (e) { return e[0]; });

  var allOk = services.firestore === 'ok' && missingRequired.length === 0;

  res.json({
    success: true,
    status: allOk ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    uptime: process.uptime(),
    services: services,
    env: {
      required: required,
      optional: optional,
      missing_required: missingRequired,
      missing_optional: missingOptional,
    },
  });
});
