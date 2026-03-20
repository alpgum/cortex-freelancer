const { cors } = require('./_middleware/cors');
const { rateLimit } = require('./_middleware/rate-limit');

const MOCK_MODE = !process.env.STRIPE_SECRET_KEY;

let stripe;
if (!MOCK_MODE) {
  stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
}

// Stripe checkout session IDs always start with cs_
const SESSION_ID_RE = /^cs_(test_|live_)[a-zA-Z0-9]{10,}$/;

module.exports = async function handler(req, res) {
  if (cors(req, res)) return;
  if (rateLimit(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sessionId = req.query.session_id;
  if (!sessionId) {
    return res.status(400).json({ error: 'session_id required' });
  }

  if (!SESSION_ID_RE.test(sessionId)) {
    return res.status(400).json({ error: 'Invalid session_id format' });
  }

  if (MOCK_MODE) {
    return res.json({ status: 'complete', email: null, mock: true });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const email = session.customer_email || session.customer_details?.email || null;

    // Map session status to clear response
    if (session.status === 'expired') {
      return res.status(410).json({
        status: 'expired',
        message: 'This checkout session has expired. Please start a new checkout.'
      });
    }

    if (session.status === 'complete' && session.payment_status === 'paid') {
      return res.json({ status: 'complete', email });
    }

    if (session.payment_status === 'unpaid') {
      return res.json({
        status: 'pending',
        message: 'Payment has not been completed yet.'
      });
    }

    // Fallback for any other state
    return res.json({
      status: session.payment_status,
      email
    });
  } catch (err) {
    if (err.type === 'StripeInvalidRequestError') {
      return res.status(404).json({ error: 'Checkout session not found' });
    }
    console.error('checkout-status error:', err.message);
    return res.status(500).json({ error: 'Failed to retrieve checkout status' });
  }
};
