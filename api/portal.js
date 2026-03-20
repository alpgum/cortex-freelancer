const { cors } = require('./_middleware/cors');
const { rateLimit } = require('./_middleware/rate-limit');

const MOCK_MODE = !process.env.STRIPE_SECRET_KEY;

let stripe;
if (!MOCK_MODE) {
  stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
}

module.exports = async function handler(req, res) {
  if (cors(req, res)) return;
  if (rateLimit(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { stripeCustomerId } = req.body || {};

    if (!stripeCustomerId) {
      return res.status(400).json({ error: 'stripeCustomerId is required.' });
    }

    // Mock mode — return a fake portal URL
    if (MOCK_MODE) {
      return res.json({ url: '/pricing?portal=mock&customer=' + encodeURIComponent(stripeCustomerId) });
    }

    // Real Stripe mode — create billing portal session
    const host = req.headers.host;
    const protocol = host?.includes('localhost') ? 'http' : 'https';

    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${protocol}://${host}/pricing`
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Portal error:', err.message);
    res.status(500).json({ error: 'Failed to create portal session.' });
  }
};
