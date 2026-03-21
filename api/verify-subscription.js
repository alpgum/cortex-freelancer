const { cors } = require('./_middleware/cors');
const { rateLimit } = require('./_middleware/rate-limit');
const { withErrorHandler, sendError } = require('./_middleware/error-handler');
const { getFirestore } = require('./_lib/firestore');

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

  const { uid } = req.body || {};

  if (!uid) {
    return sendError(res, 400, 'uid is required.', 'MISSING_UID', 'validation_error');
  }

  // Mock mode — always return pro
  if (MOCK_MODE) {
    return res.json({ success: true, isPro: true, plan: 'pro_monthly', status: 'active' });
  }

  // Check Firestore first for cached pro status
  const firestore = getFirestore();
  if (firestore) {
    try {
      const userDoc = await firestore.collection('users').doc(uid).get();
      if (userDoc.exists) {
        const data = userDoc.data();
        if (data.isPro && data.stripeSubscriptionId) {
          // Verify with Stripe that subscription is still active
          try {
            const subscription = await stripe.subscriptions.retrieve(data.stripeSubscriptionId);
            const isActive = ['active', 'trialing'].includes(subscription.status);

            // Update Firestore if subscription lapsed
            if (!isActive && data.isPro) {
              await firestore.collection('users').doc(uid).update({
                isPro: false,
                updatedAt: new Date().toISOString()
              });
            }

            return res.json({
              success: true,
              isPro: isActive,
              plan: data.plan || 'pro_monthly',
              status: subscription.status
            });
          } catch (stripeErr) {
            console.error(`[verify-subscription] Stripe lookup failed for uid=${uid}:`, stripeErr.message);
            // Fall back to Firestore data
            return res.json({
              success: true,
              isPro: !!data.isPro,
              plan: data.plan || 'pro_monthly',
              status: data.isPro ? 'active' : 'inactive'
            });
          }
        }

        return res.json({
          success: true,
          isPro: false,
          plan: 'free',
          status: 'inactive'
        });
      }
    } catch (err) {
      console.error(`[verify-subscription] Firestore read failed for uid=${uid}:`, err.message);
    }
  }

  // No Firestore data found
  return res.json({ success: true, isPro: false, plan: 'free', status: 'inactive' });
});
