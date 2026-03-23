const { cors } = require('./middleware/cors');
const { rateLimit } = require('./middleware/rate-limit');
const { withErrorHandler, sendError } = require('./middleware/error-handler');

const MOCK_MODE = !process.env.STRIPE_SECRET_KEY;

let stripe;
if (!MOCK_MODE) {
  stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
}

module.exports = withErrorHandler(async function handler(req, res) {
  if (cors(req, res)) return;
  if (rateLimit(req, res)) return;

  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method not allowed', 'METHOD_NOT_ALLOWED', 'validation_error');
  }

  const { stripeCustomerId } = req.body || {};

  if (!stripeCustomerId) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_CUSTOMER_ID',
        type: 'validation_error',
        message: 'No billing account found. This usually means you haven\'t subscribed to a paid plan yet. Please upgrade to Pro first, then you can manage your subscription here.',
        action: 'upgrade',
        upgradeUrl: '/pricing'
      }
    });
  }

  // Mock mode — return a fake portal URL
  if (MOCK_MODE) {
    return res.json({ success: true, url: '/pricing?portal=mock&customer=' + encodeURIComponent(stripeCustomerId) });
  }

  // Real Stripe mode — create billing portal session
  const host = req.headers.host;
  const protocol = host?.includes('localhost') ? 'http' : 'https';

  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: `${protocol}://${host}/pricing`
  });

  res.json({ success: true, url: session.url });
});
