const { cors } = require('./_middleware/cors');
const { rateLimit } = require('./_middleware/rate-limit');
const { withErrorHandler, sendError } = require('./_middleware/error-handler');

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

  const { email } = req.body || {};

  if (!email) {
    return sendError(res, 400, 'Email is required.', 'MISSING_EMAIL', 'validation_error');
  }

  // Mock mode — redirect to pricing page
  if (MOCK_MODE) {
    return res.json({ success: true, url: '/pricing?portal=mock&email=' + encodeURIComponent(email) });
  }

  // Real Stripe mode — find customer by email, then create portal session
  const customers = await stripe.customers.list({ email: email.toLowerCase().trim(), limit: 1 });

  if (!customers.data.length) {
    return sendError(res, 404, 'No subscription found for this email.', 'CUSTOMER_NOT_FOUND', 'not_found_error');
  }

  const host = req.headers.host;
  const protocol = host?.includes('localhost') ? 'http' : 'https';

  const session = await stripe.billingPortal.sessions.create({
    customer: customers.data[0].id,
    return_url: `${protocol}://${host}/pricing`
  });

  res.json({ success: true, url: session.url });
});
