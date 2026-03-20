const fs = require('fs');
const path = require('path');
const { cors } = require('./_middleware/cors');
const { rateLimit } = require('./_middleware/rate-limit');
const { withErrorHandler, sendError } = require('./_middleware/error-handler');

const CUSTOMERS_FILE = path.join(__dirname, '..', 'data', 'customers.json');
const MOCK_MODE = !process.env.STRIPE_SECRET_KEY;

let stripe;
if (!MOCK_MODE) {
  stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
}

const { getFirestore } = require('./_lib/firestore');
const { sendProActivatedEmail } = require('./_services/email');

function readCustomers() {
  try { return JSON.parse(fs.readFileSync(CUSTOMERS_FILE, 'utf8')); }
  catch { return []; }
}

function writeCustomers(data) {
  const dir = path.dirname(CUSTOMERS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CUSTOMERS_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// Vercel serverless config: disable body parsing so we get raw body for Stripe signature
module.exports.config = {
  api: { bodyParser: false }
};

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

module.exports = withErrorHandler(async function handler(req, res) {
  if (cors(req, res)) return;
  if (rateLimit(req, res)) return;

  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method not allowed', 'METHOD_NOT_ALLOWED', 'validation_error');
  }

  if (MOCK_MODE) {
    console.log('[webhook] Mock mode — no Stripe key set, skipping signature verification');
    return res.json({ received: true, mock: true });
  }

  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!endpointSecret) {
    console.error('[webhook] STRIPE_WEBHOOK_SECRET is not set — rejecting request');
    return sendError(res, 500, 'Webhook not configured.', 'WEBHOOK_NOT_CONFIGURED', 'server_error');
  }

  const sig = req.headers['stripe-signature'];
  if (!sig) {
    console.warn('[webhook] Missing stripe-signature header');
    return sendError(res, 400, 'Missing stripe-signature header.', 'MISSING_SIGNATURE', 'validation_error');
  }

  let event;
  try {
    const rawBody = await getRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, endpointSecret);
  } catch (err) {
    console.error(`[webhook] Signature verification failed: ${err.message}`);
    return sendError(res, 400, 'Webhook signature verification failed.', 'INVALID_SIGNATURE', 'validation_error');
  }

  console.log(`[webhook] Verified event: ${event.type} (${event.id})`);

  const customers = readCustomers();

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const uid = session.metadata?.uid;
    const plan = session.metadata?.plan || 'pro_monthly';
    const email = session.customer_email?.toLowerCase().trim();

    // Update local JSON store (legacy)
    if (email) {
      const existing = customers.find(c => c.email === email);
      if (existing) {
        existing.status = 'active';
        existing.plan = plan;
        existing.stripe_customer_id = session.customer;
        existing.stripe_subscription_id = session.subscription;
        if (uid) existing.uid = uid;
      } else {
        customers.push({
          email,
          plan,
          stripe_customer_id: session.customer,
          stripe_subscription_id: session.subscription,
          created_at: new Date().toISOString(),
          status: 'active',
          ...(uid && { uid })
        });
      }
      writeCustomers(customers);
    }

    // Update Firestore users/{uid}
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

          console.log(`[webhook] Firestore updated: users/${uid} → isPro=true, plan=${plan}`);

          // Send Pro activation email
          if (email) {
            try {
              const displayName = session.customer_details?.name || email.split('@')[0];
              await sendProActivatedEmail(email, displayName, plan);
              console.log(`[webhook] Pro activation email sent to ${email}`);
            } catch (emailErr) {
              console.error(`[webhook] Pro activation email failed for ${email}:`, emailErr.message);
            }
          }
        } catch (err) {
          console.error(`[webhook] Firestore write failed for users/${uid}:`, err.message);
        }
      }
    } else {
      console.warn('[webhook] checkout.session.completed missing uid in metadata');
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object;

    // Update local JSON store (legacy)
    const customer = customers.find(c => c.stripe_subscription_id === subscription.id);
    if (customer) {
      customer.status = 'cancelled';
      writeCustomers(customers);
    }

    // Update Firestore — find user by stripeSubscriptionId
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
          console.log(`[webhook] Firestore updated: users/${userDoc.id} → isPro=false (subscription deleted)`);
        }
      } catch (err) {
        console.error('[webhook] Firestore update failed on subscription.deleted:', err.message);
      }
    }
  }

  res.json({ received: true });
});
