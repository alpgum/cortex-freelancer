const { cors } = require('./middleware/cors');
const { rateLimit } = require('./middleware/rate-limit');
const { withErrorHandler, sendError } = require('./middleware/error-handler');
const { getUser, getUserByEmail } = require('./services/user');

const MOCK_MODE = !process.env.STRIPE_SECRET_KEY;

let stripe;
if (!MOCK_MODE) {
  stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
}

module.exports = withErrorHandler(async function handler(req, res) {
  if (cors(req, res)) return;
  if (rateLimit(req, res)) return;

  if (req.method !== 'GET') {
    return sendError(res, 405, 'Method not allowed', 'METHOD_NOT_ALLOWED', 'validation_error');
  }

  const email = (req.query.email || '').toLowerCase().trim();
  const uid = (req.query.uid || '').trim();

  if (!email && !uid) {
    return sendError(res, 400, 'email or uid query param required', 'MISSING_IDENTIFIER', 'validation_error');
  }

  // Look up user in Firestore
  const user = uid ? await getUser(uid) : await getUserByEmail(email);

  if (MOCK_MODE) {
    return res.json({
      success: true,
      status: user ? (user.subscriptionStatus || 'active') : 'active',
      plan: user ? (user.plan || 'pro_monthly') : 'pro_monthly',
      current_period_end: new Date(Date.now() + 30 * 86400000).toISOString(),
      cancel_at_period_end: false,
      mock: true
    });
  }

  if (!user || !user.stripeCustomerId) {
    return res.json({
      success: true,
      status: (user && user.isPro) ? 'active' : 'none',
      plan: user?.plan || null,
      current_period_end: user?.proExpiresAt || null,
      cancel_at_period_end: false
    });
  }

  const stripeCustomer = await stripe.customers.retrieve(user.stripeCustomerId, {
    expand: ['subscriptions']
  });

  const sub = stripeCustomer.subscriptions?.data?.[0] || null;

  if (!sub) {
    return res.json({
      success: true,
      status: 'none',
      plan: null,
      current_period_end: null,
      cancel_at_period_end: false
    });
  }

  return res.json({
    success: true,
    status: sub.status,
    plan: user.plan || sub.items?.data?.[0]?.price?.lookup_key || null,
    current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
    cancel_at_period_end: !!sub.cancel_at_period_end
  });
});
