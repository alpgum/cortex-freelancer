const { cors } = require('./middleware/cors');
const { rateLimit } = require('./middleware/rate-limit');
const { withErrorHandler, sendError } = require('./middleware/error-handler');
const { getFirestore } = require('./lib/firestore');

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

  const { uid, email } = req.body || {};

  if (!uid && !email) {
    return sendError(res, 400, 'uid or email is required.', 'MISSING_FIELDS', 'validation_error');
  }

  // Mock mode
  if (MOCK_MODE) {
    return res.json({ success: true, url: '/pricing?portal=mock' });
  }

  let customerId;

  // Try to find Stripe customer ID from Firestore via uid
  if (uid) {
    const firestore = getFirestore();
    if (firestore) {
      try {
        const userDoc = await firestore.collection('users').doc(uid).get();
        if (userDoc.exists && userDoc.data().stripeCustomerId) {
          customerId = userDoc.data().stripeCustomerId;
        }
      } catch (err) {
        console.error(`[customer-portal] Firestore lookup failed for uid=${uid}:`, err.message);
      }
    }
  }

  // Fallback to email lookup
  if (!customerId && email) {
    try {
      const customers = await stripe.customers.list({ email: email.toLowerCase().trim(), limit: 1 });
      if (customers.data.length) {
        customerId = customers.data[0].id;
      }
    } catch (err) {
      console.error('[customer-portal] Stripe customer lookup failed:', err.message);
    }
  }

  if (!customerId) {
    return sendError(res, 404, 'No subscription found.', 'CUSTOMER_NOT_FOUND', 'not_found_error');
  }

  const host = req.headers.host;
  const protocol = host?.includes('localhost') ? 'http' : 'https';

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${protocol}://${host}/app/dashboard`
  });

  res.json({ success: true, url: session.url });
});
