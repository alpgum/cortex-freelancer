const { cors } = require('./_middleware/cors');
const { rateLimit } = require('./_middleware/rate-limit');
const { withErrorHandler, sendError } = require('./_middleware/error-handler');
const { getFirestore } = require('./_lib/firestore');

const MOCK_MODE = !process.env.STRIPE_SECRET_KEY;

let stripe;
if (!MOCK_MODE) {
  stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
}

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const handler = withErrorHandler(async function handler(req, res) {
  if (cors(req, res)) return;
  if (rateLimit(req, res)) return;

  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method not allowed', 'METHOD_NOT_ALLOWED', 'validation_error');
  }

  if (MOCK_MODE) {
    console.log('[stripe-webhook] Mock mode — skipping signature verification');
    return res.json({ received: true, mock: true });
  }

  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!endpointSecret) {
    console.error('[stripe-webhook] STRIPE_WEBHOOK_SECRET is not set');
    return sendError(res, 500, 'Webhook not configured.', 'WEBHOOK_NOT_CONFIGURED', 'server_error');
  }

  const sig = req.headers['stripe-signature'];
  if (!sig) {
    return sendError(res, 400, 'Missing stripe-signature header.', 'MISSING_SIGNATURE', 'validation_error');
  }

  let event;
  try {
    const rawBody = await getRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, endpointSecret);
  } catch (err) {
    console.error(`[stripe-webhook] Signature verification failed: ${err.message}`);
    return sendError(res, 400, 'Webhook signature verification failed.', 'INVALID_SIGNATURE', 'validation_error');
  }

  console.log(`[stripe-webhook] Verified event: ${event.type} (${event.id})`);

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const uid = session.client_reference_id || session.metadata?.uid;
    const plan = session.metadata?.plan || 'pro_monthly';

    if (uid) {
      const firestore = getFirestore();
      if (firestore) {
        try {
          const proExpiresAt = new Date();
          if (plan === 'pro_annual') {
            proExpiresAt.setFullYear(proExpiresAt.getFullYear() + 1);
          } else {
            proExpiresAt.setMonth(proExpiresAt.getMonth() + 1);
          }

          await firestore.collection('users').doc(uid).set({
            isPro: true,
            plan,
            proExpiresAt: proExpiresAt.toISOString(),
            stripeCustomerId: session.customer,
            stripeSubscriptionId: session.subscription,
            updatedAt: new Date().toISOString()
          }, { merge: true });

          console.log(`[stripe-webhook] Firestore updated: users/${uid} → isPro=true, plan=${plan}`);
        } catch (err) {
          console.error(`[stripe-webhook] Firestore write failed for users/${uid}:`, err.message);
        }
      }
    } else {
      console.warn('[stripe-webhook] checkout.session.completed missing uid');
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object;
    const firestore = getFirestore();
    if (firestore) {
      try {
        const snapshot = await firestore.collection('users')
          .where('stripeSubscriptionId', '==', subscription.id)
          .limit(1)
          .get();

        if (!snapshot.empty) {
          const userDoc = snapshot.docs[0];
          await userDoc.ref.update({
            isPro: false,
            updatedAt: new Date().toISOString()
          });
          console.log(`[stripe-webhook] users/${userDoc.id} → isPro=false (subscription deleted)`);
        }
      } catch (err) {
        console.error('[stripe-webhook] Firestore update failed on subscription.deleted:', err.message);
      }
    }
  }

  res.status(200).json({ received: true });
});

handler.config = {
  api: { bodyParser: false }
};

module.exports = handler;
