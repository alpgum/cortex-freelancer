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
    return sendError(res, 400, 'Email or uid query param required', 'MISSING_EMAIL', 'validation_error');
  }

  // Look up user in Firestore
  const user = uid ? await getUser(uid) : await getUserByEmail(email);

  // Mock mode — return realistic fake data
  if (MOCK_MODE) {
    return res.json({
      success: true,
      active: !!user,
      plan: user ? (user.plan || 'pro') : 'pro',
      subscription_status: user ? (user.subscriptionStatus || 'active') : 'active',
      current_period_end: new Date(Date.now() + 30 * 86400000).toISOString(),
      tool_usage: user?.toolUsage || { briefs: 12, seo_audits: 5, social_posts: 28 },
      member_since: user?.createdAt || '2025-11-01T00:00:00.000Z',
      mock: true
    });
  }

  // No user record or no Stripe customer
  if (!user || !user.stripeCustomerId) {
    return res.json({
      success: true,
      active: !!(user && user.isPro),
      plan: user?.plan || null,
      subscription_status: user?.isPro ? 'active' : null,
      current_period_end: user?.proExpiresAt || null,
      tool_usage: user?.toolUsage || null,
      member_since: user?.createdAt || null
    });
  }

  // Fetch live data from Stripe
  const stripeCustomer = await stripe.customers.retrieve(user.stripeCustomerId, {
    expand: ['subscriptions']
  });

  const sub = stripeCustomer.subscriptions?.data?.[0] || null;

  return res.json({
    success: true,
    active: sub ? sub.status === 'active' : false,
    plan: user.plan || (sub?.items?.data?.[0]?.price?.lookup_key) || null,
    subscription_status: sub ? sub.status : 'none',
    current_period_end: sub ? new Date(sub.current_period_end * 1000).toISOString() : null,
    tool_usage: user.toolUsage || { briefs: 0, seo_audits: 0, social_posts: 0 },
    member_since: stripeCustomer.created
      ? new Date(stripeCustomer.created * 1000).toISOString()
      : null
  });
});
