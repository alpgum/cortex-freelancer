const { cors } = require('./middleware/cors');
const { rateLimit } = require('./middleware/rate-limit');
const { withErrorHandler, sendError } = require('./middleware/error-handler');
const { getFirestore } = require('./lib/firestore');

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

// ── Idempotency: prevent duplicate event processing ─────────────────────
const processedEvents = new Map(); // eventId → timestamp
const IDEMPOTENCY_TTL = 3600000; // 1 hour

function isAlreadyProcessed(eventId) {
  const ts = processedEvents.get(eventId);
  if (ts && Date.now() - ts < IDEMPOTENCY_TTL) return true;
  processedEvents.set(eventId, Date.now());
  return false;
}

// Cleanup old entries every 30 min
setInterval(() => {
  const cutoff = Date.now() - IDEMPOTENCY_TTL;
  for (const [id, ts] of processedEvents) {
    if (ts < cutoff) processedEvents.delete(id);
  }
}, 1800000);

// ── Helper: find user by subscription ID ────────────────────────────────
async function findUserBySubscription(firestore, subscriptionId) {
  const snapshot = await firestore.collection('users')
    .where('stripeSubscriptionId', '==', subscriptionId)
    .limit(1)
    .get();
  return snapshot.empty ? null : snapshot.docs[0];
}

// ── Helper: find user by customer ID ────────────────────────────────────
async function findUserByCustomer(firestore, customerId) {
  const snapshot = await firestore.collection('users')
    .where('stripeCustomerId', '==', customerId)
    .limit(1)
    .get();
  return snapshot.empty ? null : snapshot.docs[0];
}

// ── Helper: send notification ───────────────────────────────────────────
async function notifySlack(message) {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message }),
    });
  } catch {}
}

// ── Helper: send email ──────────────────────────────────────────────────
async function sendEmailSafe(emailFn, ...args) {
  try {
    const { sendProActivatedEmail, sendReceiptEmail, sendTrialExpiryEmail } = require('./services/email');
    const fns = { sendProActivatedEmail, sendReceiptEmail, sendTrialExpiryEmail };
    if (fns[emailFn]) await fns[emailFn](...args);
  } catch (err) {
    console.warn(`[stripe-webhook] Email (${emailFn}) failed:`, err.message);
  }
}

// ── Event Handlers ──────────────────────────────────────────────────────

async function handleCheckoutCompleted(session) {
  const uid = session.client_reference_id || session.metadata?.uid;
  const plan = session.metadata?.plan || 'pro_monthly';
  const email = session.customer_email || session.customer_details?.email;

  if (!uid) {
    console.warn('[stripe-webhook] checkout.session.completed missing uid');
    return;
  }

  const firestore = getFirestore();
  if (!firestore) return;

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
    updatedAt: new Date().toISOString(),
  }, { merge: true });

  console.log(`[stripe-webhook] users/${uid} → isPro=true, plan=${plan}`);

  // Send activation email
  if (email) {
    const userDoc = await firestore.collection('users').doc(uid).get();
    const name = userDoc.data()?.displayName || email.split('@')[0];
    await sendEmailSafe('sendProActivatedEmail', email, name, plan);
  }

  // Slack notification
  await notifySlack(`💰 New Pro subscriber! Plan: ${plan}, Email: ${email || 'unknown'}`);
}

async function handleSubscriptionUpdated(subscription) {
  const firestore = getFirestore();
  if (!firestore) return;

  const userDoc = await findUserBySubscription(firestore, subscription.id);
  if (!userDoc) {
    console.warn(`[stripe-webhook] subscription.updated — no user found for ${subscription.id}`);
    return;
  }

  const updates = { updatedAt: new Date().toISOString() };

  // Handle status changes
  if (subscription.status === 'active') {
    updates.isPro = true;
    if (subscription.current_period_end) {
      updates.proExpiresAt = new Date(subscription.current_period_end * 1000).toISOString();
    }
  } else if (['past_due', 'unpaid'].includes(subscription.status)) {
    // Keep Pro but flag the issue
    updates.subscriptionStatus = subscription.status;
    console.warn(`[stripe-webhook] users/${userDoc.id} subscription ${subscription.status}`);
  } else if (['canceled', 'incomplete_expired'].includes(subscription.status)) {
    updates.isPro = false;
    updates.subscriptionStatus = subscription.status;
  }

  // Track cancel_at_period_end
  if (subscription.cancel_at_period_end) {
    updates.cancelAtPeriodEnd = true;
    updates.cancelAt = subscription.cancel_at
      ? new Date(subscription.cancel_at * 1000).toISOString()
      : null;
  } else {
    updates.cancelAtPeriodEnd = false;
    updates.cancelAt = null;
  }

  await userDoc.ref.update(updates);
  console.log(`[stripe-webhook] users/${userDoc.id} subscription updated: status=${subscription.status}`);
}

async function handleSubscriptionDeleted(subscription) {
  const firestore = getFirestore();
  if (!firestore) return;

  const userDoc = await findUserBySubscription(firestore, subscription.id);
  if (!userDoc) return;

  await userDoc.ref.update({
    isPro: false,
    subscriptionStatus: 'canceled',
    updatedAt: new Date().toISOString(),
  });

  console.log(`[stripe-webhook] users/${userDoc.id} → isPro=false (subscription deleted)`);

  const data = userDoc.data();
  if (data?.email) {
    await notifySlack(`⚠️ Subscription canceled: ${data.email}`);
  }
}

async function handleInvoicePaymentSucceeded(invoice) {
  const firestore = getFirestore();
  if (!firestore) return;

  const email = invoice.customer_email;
  const amount = (invoice.amount_paid / 100).toFixed(2);

  // Log successful payment
  await firestore.collection('payments').add({
    stripeInvoiceId: invoice.id,
    stripeCustomerId: invoice.customer,
    amount: invoice.amount_paid,
    currency: invoice.currency,
    status: 'succeeded',
    email,
    createdAt: new Date().toISOString(),
  });

  // Send receipt
  if (email) {
    const userDoc = await findUserByCustomer(firestore, invoice.customer);
    const name = userDoc?.data()?.displayName || email.split('@')[0];
    await sendEmailSafe('sendReceiptEmail', email, name, amount);
  }

  console.log(`[stripe-webhook] Invoice paid: ${invoice.id} ($${amount})`);
}

async function handleInvoicePaymentFailed(invoice) {
  const firestore = getFirestore();
  if (!firestore) return;

  const email = invoice.customer_email;

  await firestore.collection('payment_errors').add({
    stripeInvoiceId: invoice.id,
    stripeCustomerId: invoice.customer,
    amount: invoice.amount_due,
    attemptCount: invoice.attempt_count,
    nextAttempt: invoice.next_payment_attempt
      ? new Date(invoice.next_payment_attempt * 1000).toISOString()
      : null,
    email: email ? require('crypto').createHash('sha256').update(email.toLowerCase()).digest('hex') : null,
    createdAt: new Date().toISOString(),
  });

  console.error(`[stripe-webhook] Invoice payment failed: ${invoice.id} (attempt ${invoice.attempt_count})`);
  await notifySlack(`🚨 Payment failed: ${email || 'unknown'} — attempt ${invoice.attempt_count}`);
}

async function handleCustomerSubscriptionTrialWillEnd(subscription) {
  const firestore = getFirestore();
  if (!firestore) return;

  const userDoc = await findUserBySubscription(firestore, subscription.id);
  if (!userDoc) return;

  const data = userDoc.data();
  const email = data?.email;
  const name = data?.displayName || 'there';

  if (email) {
    const trialEnd = new Date(subscription.trial_end * 1000);
    const daysLeft = Math.max(0, Math.ceil((trialEnd - new Date()) / 86400000));
    await sendEmailSafe('sendTrialExpiryEmail', email, name, daysLeft);
  }

  console.log(`[stripe-webhook] Trial ending soon for users/${userDoc.id}`);
}

// ── Main Handler ────────────────────────────────────────────────────────

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
    const rawBody = req.rawBody || await getRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, endpointSecret);
  } catch (err) {
    console.error(`[stripe-webhook] Signature verification failed: ${err.message}`);
    return sendError(res, 400, 'Webhook signature verification failed.', 'INVALID_SIGNATURE', 'validation_error');
  }

  // Idempotency check
  if (isAlreadyProcessed(event.id)) {
    console.log(`[stripe-webhook] Duplicate event ignored: ${event.id}`);
    return res.status(200).json({ received: true, duplicate: true });
  }

  console.log(`[stripe-webhook] Processing: ${event.type} (${event.id})`);

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object);
        break;

      case 'customer.subscription.trial_will_end':
        await handleCustomerSubscriptionTrialWillEnd(event.data.object);
        break;

      default:
        console.log(`[stripe-webhook] Unhandled event type: ${event.type}`);
    }
  } catch (err) {
    // Log but still return 200 to prevent Stripe retries for handler errors
    console.error(`[stripe-webhook] Handler error for ${event.type}:`, err.message);
  }

  res.status(200).json({ received: true });
});

handler.config = {
  api: { bodyParser: false }
};

module.exports = handler;
