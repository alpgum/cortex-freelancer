const { cors } = require('./_middleware/cors');
const { rateLimit } = require('./_middleware/rate-limit');
const { sanitize } = require('./_middleware/sanitize');
const { withErrorHandler, sendError } = require('./_middleware/error-handler');

const MOCK_MODE = !process.env.STRIPE_SECRET_KEY;

let stripe;
if (!MOCK_MODE) {
  stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
}

// Valid coupon codes and their Stripe promotion code IDs
// In production, these map to Stripe promotion codes created in the dashboard
const COUPON_MAP = {
  'LAUNCH50': { discount: '50% off first month', stripe_coupon: process.env.STRIPE_COUPON_LAUNCH50 },
  'FRIEND20': { discount: '20% off first month', stripe_coupon: process.env.STRIPE_COUPON_FRIEND20 },
  'ANNUAL10': { discount: '10% off annual plan', stripe_coupon: process.env.STRIPE_COUPON_ANNUAL10 }
};

module.exports = withErrorHandler(async function handler(req, res) {
  if (cors(req, res)) return;
  if (rateLimit(req, res)) return;
  sanitize(req);

  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method not allowed', 'METHOD_NOT_ALLOWED', 'validation_error');
  }

  const { code } = req.body || {};

  if (!code || typeof code !== 'string') {
    return sendError(res, 400, 'Coupon code is required.', 'MISSING_CODE', 'validation_error');
  }

  const normalized = code.trim().toUpperCase();
  const coupon = COUPON_MAP[normalized];

  if (!coupon) {
    return sendError(res, 404, 'Invalid or expired coupon code.', 'INVALID_COUPON', 'validation_error');
  }

  // Mock mode — return coupon details without Stripe validation
  if (MOCK_MODE) {
    return res.json({
      success: true,
      code: normalized,
      discount: coupon.discount,
      stripe_coupon: 'mock_coupon_' + normalized.toLowerCase()
    });
  }

  // Real Stripe mode — validate the coupon exists and is active
  if (!coupon.stripe_coupon) {
    return sendError(res, 500, 'Coupon not configured. Please contact support.', 'COUPON_NOT_CONFIGURED', 'server_error');
  }

  try {
    const stripeCoupon = await stripe.coupons.retrieve(coupon.stripe_coupon);

    if (!stripeCoupon || !stripeCoupon.valid) {
      return sendError(res, 410, 'This coupon has expired.', 'COUPON_EXPIRED', 'validation_error');
    }

    res.json({
      success: true,
      code: normalized,
      discount: coupon.discount,
      stripe_coupon: coupon.stripe_coupon
    });
  } catch (err) {
    if (err.code === 'resource_missing') {
      return sendError(res, 404, 'Invalid or expired coupon code.', 'INVALID_COUPON', 'validation_error');
    }
    console.error('Coupon validation error:', err.message);
    sendError(res, 500, 'Could not validate coupon. Please try again.', 'COUPON_ERROR', 'server_error');
  }
});
