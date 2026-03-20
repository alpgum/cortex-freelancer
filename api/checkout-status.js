const fs = require('fs');
const path = require('path');
const { rateLimit } = require('./_middleware/rate-limit');

const MOCK_MODE = !process.env.STRIPE_SECRET_KEY;

let stripe;
if (!MOCK_MODE) {
  stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
}

module.exports = async function handler(req, res) {
  if (rateLimit(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sessionId = req.query.session_id;
  if (!sessionId) {
    return res.status(400).json({ error: 'session_id required' });
  }

  if (MOCK_MODE) {
    return res.json({ status: 'complete', email: null });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const email = session.customer_email || session.customer_details?.email;
    res.json({ status: session.payment_status, email });
  } catch (err) {
    res.status(400).json({ error: 'Invalid session' });
  }
};
