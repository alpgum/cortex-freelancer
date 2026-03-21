const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { cors } = require('./_middleware/cors');
const { rateLimit } = require('./_middleware/rate-limit');
const { sanitize } = require('./_middleware/sanitize');
const { withErrorHandler, sendError } = require('./_middleware/error-handler');
const { getFirestore } = require('./_lib/firestore');

const CUSTOMERS_FILE = path.join(__dirname, '..', 'data', 'customers.json');
const MOCK_MODE = !process.env.STRIPE_SECRET_KEY;

let stripe;
if (!MOCK_MODE) {
  stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
}

const { PRICE_IDS } = require('../config/stripe-prices');
const featureFlags = require('../config/feature-flags.json');

function hashEmail(email) {
  return crypto.createHash('sha256').update(email.toLowerCase().trim()).digest('hex');
}

async function logCheckoutError(errorCode, errorType, message, email, plan) {
  const entry = {
    code: errorCode,
    type: errorType,
    message,
    emailHash: email ? hashEmail(email) : null,
    plan: plan || null,
    timestamp: new Date().toISOString()
  };
  console.error('[checkout] Error:', JSON.stringify(entry));
  const firestore = getFirestore();
  if (firestore) {
    try {
      await firestore.collection('payment_errors').add(entry);
    } catch (err) {
      console.error('[checkout] Failed to persist error to Firestore:', err.message);
    }
  }
}

function readCustomers() {
  try { return JSON.parse(fs.readFileSync(CUSTOMERS_FILE, 'utf8')); }
  catch { return []; }
}

function writeCustomers(data) {
  const dir = path.dirname(CUSTOMERS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CUSTOMERS_FILE, JSON.stringify(data, null, 2), 'utf8');
}

module.exports = withErrorHandler(async function handler(req, res) {
  if (cors(req, res)) return;
  if (rateLimit(req, res)) return;
  sanitize(req);

  if (req.method === 'GET') {
    // GET /api/checkout?session_id=... — verify completed checkout
    const sessionId = req.query.session_id;
    if (!sessionId) return sendError(res, 400, 'session_id required', 'MISSING_SESSION_ID', 'validation_error');

    if (MOCK_MODE) {
      return res.json({ success: true, status: 'complete', email: null });
    }

    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      const email = session.customer_email || session.customer_details?.email;
      res.json({ success: true, status: session.payment_status, email });
    } catch (err) {
      sendError(res, 400, 'Invalid session', 'INVALID_SESSION', 'validation_error');
    }
    return;
  }

  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method not allowed', 'METHOD_NOT_ALLOWED', 'validation_error');
  }

  const { email, plan, uid } = req.body || {};

  if (!email || !plan) {
    return sendError(res, 400, 'Email and plan are required.', 'MISSING_FIELDS', 'validation_error');
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (typeof email !== 'string' || !emailRegex.test(email.trim())) {
    return sendError(res, 400, 'Please enter a valid email address.', 'INVALID_EMAIL', 'validation_error');
  }

  if (!['pro_monthly', 'pro_annual'].includes(plan)) {
    return sendError(res, 400, 'Invalid plan. Use pro_monthly or pro_annual.', 'INVALID_PLAN', 'validation_error');
  }

  // Mock mode — Stripe not configured.
  // IMPORTANT: On Vercel serverless, writing to the project filesystem is not reliable.
  // So we do NOT persist mock customers server-side. We simply return a success URL.
  if (MOCK_MODE) {
    return res.json({
      success: true,
      url: '/checkout-success?mock=true&email=' + encodeURIComponent(email) + '&plan=' + encodeURIComponent(plan)
    });
  }

  // Real Stripe mode
  try {
    const host = req.headers.host;
    const protocol = host?.includes('localhost') ? 'http' : 'https';
    const sessionParams = {
      mode: 'subscription',
      customer_email: email,
      line_items: [{ price: PRICE_IDS[plan], quantity: 1 }],
      success_url: `${protocol}://${host}/checkout-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${protocol}://${host}/pricing`,
      metadata: { plan, ...(uid && { uid }) }
    };

    // [316] Apply free trial if feature flag is enabled
    if (featureFlags.free_trial && featureFlags.free_trial.enabled) {
      sessionParams.subscription_data = {
        trial_period_days: featureFlags.free_trial.trial_days || 7
      };
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    res.json({ success: true, url: session.url });
  } catch (err) {
    console.error('Checkout error:', err.message);

    if (err.type === 'StripeCardError') {
      await logCheckoutError('CARD_DECLINED', 'payment_error', err.message, email, plan);
      return sendError(res, 402, 'Your card was declined. Please try another payment method.', 'CARD_DECLINED', 'payment_error');
    }
    if (err.type === 'StripeInvalidRequestError') {
      await logCheckoutError('STRIPE_INVALID_REQUEST', 'payment_error', err.message, email, plan);
      return sendError(res, 400, 'Invalid checkout request. Please try again.', 'STRIPE_INVALID_REQUEST', 'payment_error');
    }
    if (err.type === 'StripeAuthenticationError') {
      await logCheckoutError('STRIPE_AUTH_ERROR', 'payment_error', err.message, email, plan);
      return sendError(res, 500, 'Payment service configuration error. Please contact support.', 'STRIPE_AUTH_ERROR', 'payment_error');
    }
    if (err.type === 'StripeRateLimitError') {
      await logCheckoutError('RATE_LIMIT', 'payment_error', err.message, email, plan);
      return sendError(res, 429, 'Too many requests. Please wait a moment and try again.', 'RATE_LIMIT', 'payment_error');
    }
    if (err.type === 'StripeConnectionError') {
      await logCheckoutError('STRIPE_CONNECTION', 'payment_error', err.message, email, plan);
      return sendError(res, 502, 'Could not connect to payment service. Please try again.', 'STRIPE_CONNECTION', 'payment_error');
    }

    await logCheckoutError('INTERNAL_ERROR', 'server_error', err.message, email, plan);
    sendError(res, 500, 'Something went wrong. Please try again or contact support.', 'INTERNAL_ERROR', 'server_error');
  }
});
