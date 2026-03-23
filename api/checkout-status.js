const { cors } = require('./middleware/cors');
const { rateLimit } = require('./middleware/rate-limit');
const { withErrorHandler, sendError } = require('./middleware/error-handler');

const MOCK_MODE = !process.env.STRIPE_SECRET_KEY;

let stripe;
if (!MOCK_MODE) {
  stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
}

// Stripe checkout session IDs always start with cs_
const SESSION_ID_RE = /^cs_(test_|live_)[a-zA-Z0-9]{10,}$/;

module.exports = withErrorHandler(async function handler(req, res) {
  if (cors(req, res)) return;
  if (rateLimit(req, res)) return;

  if (req.method !== 'GET') {
    return sendError(res, 405, 'Method not allowed', 'METHOD_NOT_ALLOWED', 'validation_error');
  }

  const sessionId = req.query.session_id;
  if (!sessionId) {
    return sendError(res, 400, 'session_id required', 'MISSING_SESSION_ID', 'validation_error');
  }

  if (!SESSION_ID_RE.test(sessionId)) {
    return sendError(res, 400, 'Invalid session_id format', 'INVALID_SESSION_ID', 'validation_error');
  }

  if (MOCK_MODE) {
    return res.json({ success: true, status: 'complete', email: null, mock: true });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const email = session.customer_email || session.customer_details?.email || null;

    // Map session status to clear response
    if (session.status === 'expired') {
      return sendError(res, 410, 'This checkout session has expired. Please start a new checkout.', 'SESSION_EXPIRED', 'payment_error');
    }

    if (session.status === 'complete' && session.payment_status === 'paid') {
      return res.json({ success: true, status: 'complete', email });
    }

    if (session.payment_status === 'unpaid') {
      return res.json({
        success: true,
        status: 'pending',
        message: 'Payment has not been completed yet.'
      });
    }

    // Fallback for any other state
    return res.json({
      success: true,
      status: session.payment_status,
      email
    });
  } catch (err) {
    if (err.type === 'StripeInvalidRequestError') {
      return sendError(res, 404, 'Checkout session not found', 'SESSION_NOT_FOUND', 'not_found_error');
    }
    throw err;
  }
});
